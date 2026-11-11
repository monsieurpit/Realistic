/* Cloud Chrome: a real Chrome running on the PatOS server, shown live inside Patoogle.
   Patoogle shows each tab's screen (JPEG frames from Chrome's screencast, sent as Server-Sent Events) and sends back clicks,
   scrolling and typing; Chrome does everything else, so every site works as in Chrome itself. No npm packages: Chrome is driven
   over its DevTools protocol with Node's own WebSocket (Node 22+).

   Only for the owner: it works only when the server has CLOUD_BROWSER_KEY (8+ characters) and Patoogle sends that key.
   Cost: Chrome starts on the first tab and stops after CLOUD_IDLE_MIN minutes (default 5) with nobody watching, or 30 minutes
   with nobody touching it. At most CLOUD_MAX_TABS tabs (default 8). Data: CLOUD_DAILY_MB per day (default 4000).
   Safety: all of Chrome's traffic goes through a small gate here that refuses private network addresses (services.js safeURL,
   the same rules as Patoogle's proxy), so Chrome on the server can't be pointed at the server's own network.
   Signed in once, stays signed in: Chrome's profile is kept in PATOS_DATA/cloud-chrome (lost on redeploy unless that folder is
   on a Railway volume). Where Chrome is: CHROME_PATH, or chromium / chromium-browser / google-chrome on the PATH. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const { safeURL } = require('./services.js');

const KEY = () => (process.env.CLOUD_BROWSER_KEY || '').trim();
const IDLE_MS = () => (+process.env.CLOUD_IDLE_MIN || 5) * 60000;
const MAX_TABS = () => +process.env.CLOUD_MAX_TABS || 8;
const DAILY = () => (+process.env.CLOUD_DAILY_MB || 4000) * 1048576;
const DATA = () => path.resolve(process.env.PATOS_DATA || path.join(__dirname, 'data'), 'cloud-chrome');

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const names = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'];
  for (const dir of (process.env.PATH || '').split(path.delimiter).concat(['/usr/bin', '/usr/local/bin', '/snap/bin'])) for (const n of names) { const p = path.join(dir, n); try { if (fs.statSync(p).isFile()) return p; } catch (e) {} }
  return null;
}
// sound: Chrome plays into a virtual speaker (PulseAudio null sink); parec records it and ffmpeg makes an MP3 stream for Patoogle
const which = (n) => { for (const dir of (process.env.PATH || '').split(path.delimiter).concat(['/usr/bin', '/usr/local/bin'])) { const p = path.join(dir, n); try { if (fs.statSync(p).isFile()) return p; } catch (e) {} } return null; };
const soundTools = () => (process.env.CLOUD_SOUND === '0' ? null : (which('pulseaudio') && which('parec') && which('ffmpeg') ? { pa: which('pulseaudio'), parec: which('parec'), ffmpeg: which('ffmpeg') } : null));
const RUN = () => path.join(os.tmpdir(), 'patos-cloud-' + process.pid);
let pulse = null;
async function startPulse() {
  const t = soundTools(); if (!t) return null;
  if (pulse) return pulse;
  const dir = path.join(RUN(), 'pulse'); fs.mkdirSync(dir, { recursive: true });
  const sock = path.join(dir, 'native'); try { fs.rmSync(sock, { force: true }); } catch (e) {}
  const env = Object.assign({}, process.env, { HOME: dir, XDG_RUNTIME_DIR: dir, PULSE_RUNTIME_PATH: dir });
  const proc = spawn(t.pa, ['--daemonize=no', '--exit-idle-time=-1', '-n', '--load=module-null-sink sink_name=patos', '--load=module-native-protocol-unix socket=' + sock + ' auth-anonymous=1'], { env, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(sock); i++) await new Promise((r) => setTimeout(r, 100));
  if (!fs.existsSync(sock)) { try { proc.kill(); } catch (e) {} return null; }
  pulse = { proc, sock, env: Object.assign({}, env, { PULSE_SERVER: 'unix:' + sock }) };
  proc.on('exit', () => { if (pulse && pulse.proc === proc) pulse = null; });
  return pulse;
}
const available = () => !!(KEY().length >= 8 && typeof WebSocket === 'function' && findChrome());

/* ---------- the gate: Chrome's only way out ---------- */
let day = '', used = 0;
const count = (n) => { const d = new Date().toISOString().slice(0, 10); if (d !== day) { day = d; used = 0; } used += n; };
const over = () => { count(0); return used > DAILY(); };
function startGate() {
  return new Promise((ok) => {
    const gate = http.createServer(async (req, res) => {
      // plain http: the request line has the whole address
      try {
        if (over()) throw new Error('Daily limit reached');
        const t = await safeURL(req.url); const mod = require('http');
        const up = mod.request({ hostname: t.url.hostname, port: t.url.port || 80, path: t.url.pathname + t.url.search, method: req.method, headers: req.headers,
          lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: t.ip, family: t.family }]) : cb(null, t.ip, t.family)), timeout: 30000 }, (r) => {
          res.writeHead(r.statusCode, r.headers); r.on('data', (c) => count(c.length)); r.pipe(res);
        });
        up.on('error', () => { try { res.writeHead(502); res.end(); } catch (e) {} });
        req.pipe(up);
      } catch (e) { res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('Not allowed: ' + e.message); }
    });
    // https and websockets: CONNECT host:port, checked, then joined to the checked IP
    gate.on('connect', async (req, sock, head) => {
      sock.on('error', () => {});
      try {
        if (over()) throw new Error('Daily limit reached');
        const [host, port] = String(req.url).split(/:(?=\d+$)/);
        if (!['443', '80'].includes(port)) throw new Error('Port not allowed');
        const t = await safeURL((port === '443' ? 'https://' : 'http://') + host + '/');
        const up = net.connect(+port, t.ip, () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head && head.length) up.write(head); up.pipe(sock); sock.pipe(up); });
        up.on('data', (c) => count(c.length)); sock.on('data', (c) => count(c.length));
        up.on('error', () => sock.destroy()); sock.on('close', () => up.destroy());
      } catch (e) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); }
    });
    gate.listen(0, '127.0.0.1', () => ok(gate));
  });
}

/* ---------- Chrome, and its DevTools protocol ---------- */
let chrome = null; // { proc, ws, gate, seq, waits, tabs: Map<targetId, tab>, bySession: Map }
let starting = null, lastSeen = 0, lastTouch = 0;
function send(method, params, sessionId) {
  const c = chrome; if (!c) return Promise.reject(new Error('Cloud Chrome is not running'));
  const id = ++c.seq; const msg = { id, method, params: params || {} }; if (sessionId) msg.sessionId = sessionId;
  return new Promise((ok, bad) => { c.waits.set(id, { ok, bad }); try { c.ws.send(JSON.stringify(msg)); } catch (e) { c.waits.delete(id); bad(e); } setTimeout(() => { if (c.waits.has(id)) { c.waits.delete(id); bad(new Error(method + ' timed out')); } }, 20000); });
}
async function start() {
  if (chrome) return chrome;
  if (starting) return starting;
  starting = (async () => {
    const exe = findChrome(); if (!exe) throw new Error('Chrome is not installed on this server');
    const gate = await startGate();
    fs.mkdirSync(DATA(), { recursive: true });
    // a Chrome that crashed (or a server that was killed) leaves its profile locked: the lock goes, the profile stays
    ['SingletonLock', 'SingletonSocket', 'SingletonCookie'].forEach((f) => { try { fs.rmSync(path.join(DATA(), f), { force: true }); } catch (e) {} });
    const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-sync', '--disable-component-update', '--disable-default-apps', (process.env.CLOUD_LEAN === '0' ? '--renderer-process-limit=6' : '--renderer-process-limit=1'),
      // lean (CLOUD_LEAN=0 turns it off): Chrome's helpers run inside Chrome instead of beside it, no process launchers, one
      // page process for every tab (no per-site split, no spare), Chrome's low-memory mode, no background features
      ...(process.env.CLOUD_LEAN === '0' ? [] : ['--in-process-gpu', '--no-zygote', '--disable-site-isolation-trials', '--disable-features=IsolateOrigins,site-per-process,SpareRendererForSitePerProcess,Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,BackForwardCache,AutofillServerCommunication,CertificateTransparencyComponentUpdater,InterestFeedContentSuggestions,PrivacySandboxSettings4,LensOverlay,HttpsUpgrades',
        '--enable-features=NetworkServiceInProcess2', '--enable-low-end-device-mode', '--disable-extensions', '--disable-component-extensions-with-background-pages', '--disable-breakpad', '--no-pings', '--disable-domain-reliability', '--disable-client-side-phishing-detection', '--disable-hang-monitor', '--disable-ipc-flooding-protection', '--js-flags=--max-old-space-size=384', '--disk-cache-size=33554432']), '--remote-debugging-port=0',
      '--user-data-dir=' + DATA(), '--proxy-server=http://127.0.0.1:' + gate.address().port, '--proxy-bypass-list=<-loopback>', '--window-size=1280,800', '--lang=' + (process.env.CLOUD_LANG || 'en-US'), 'about:blank'];
    const pa = await startPulse(); if (!pa) args.push('--mute-audio'); // (no sound tools: Chrome stays silent)
    const proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'pipe'], env: pa ? pa.env : process.env });
    const wsURL = await new Promise((ok, bad) => {
      let buf = ''; const t = setTimeout(() => bad(new Error('Chrome did not start')), 20000);
      proc.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); ok(m[1]); } });
      proc.on('exit', () => { clearTimeout(t); bad(new Error('Chrome stopped while starting')); });
    });
    const ws = new WebSocket(wsURL);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = () => bad(new Error('Could not reach Chrome')); });
    const c = { proc, ws, gate, seq: 0, waits: new Map(), tabs: new Map(), bySession: new Map() };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.id) { const w = c.waits.get(m.id); if (w) { c.waits.delete(m.id); if (m.error) w.bad(new Error(m.error.message)); else w.ok(m.result); } return; } onEvent(c, m); };
    ws.onclose = () => stop('closed');
    proc.on('exit', () => stop('exit'));
    chrome = c; lastSeen = lastTouch = Date.now();
    await send('Target.setDiscoverTargets', { discover: true });
    fs.mkdirSync(path.join(RUN(), 'downloads'), { recursive: true }); c.downloads = new Map();
    try { await send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: path.join(RUN(), 'downloads'), eventsEnabled: true }); } catch (e) {}
    return c;
  })();
  try { return await starting; } catch (e) { stop('failed'); throw e; } finally { starting = null; }
}
function stop() {
  if (pulse) { try { pulse.proc.kill(); } catch (e) {} pulse = null; }
  const c = chrome; if (!c) return; chrome = null;
  c.tabs.forEach((t) => { emit(t, 'gone', {}); t.clients.forEach((cl) => { try { if (cl.ws) cl.sock.end(); else cl.res.end(); } catch (e) {} }); });
  c.waits.forEach((w) => w.bad(new Error('Cloud Chrome stopped'))); c.waits.clear();
  try { c.ws.close(); } catch (e) {} try { c.proc.kill('SIGKILL'); } catch (e) {} try { c.gate.close(); } catch (e) {}
}
// nobody watching for a while, or nobody touching it for half an hour: Chrome stops (it costs money while it runs)
setInterval(() => {
  if (!chrome) return; const now = Date.now(); const watching = [...chrome.tabs.values()].some((t) => t.clients.size);
  if (watching) lastSeen = now;
  if (now - lastSeen > IDLE_MS() || now - lastTouch > 30 * 60000) { stop('idle'); return; }
  // a tab nobody is looking at (another Patoogle tab is in front) is parked after CLOUD_PARK_SEC: its page closes here, and
  // Patoogle opens it again at the same address when you come back to it
  chrome.tabs.forEach((t) => { if (!t.clients.size && t.unwatched && now - t.unwatched > (+process.env.CLOUD_PARK_SEC || 60) * 1000) park(t); });
}, 15000).unref();

/* ---------- memory: past CLOUD_SOFT_MB (700) Chrome is asked to free memory and every tab in the background is parked; past
   CLOUD_HARD_MB (800) Chrome restarts (Patoogle opens the page again), well before a 1 GB server runs out ---------- */
// PatOS's own programs (this server, Chrome, the sound tools), each by its real share of memory. (Not the container's counter:
// it also holds the system's file cache, which Linux frees by itself, and on some machines other programs.)
function memMB() {
  try {
    const kids = new Map(); fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d)).forEach((pid) => { try { const st = fs.readFileSync('/proc/' + pid + '/stat', 'utf8'); const ppid = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; (kids.get(ppid) || kids.set(ppid, []).get(ppid)).push(+pid); } catch (e) {} });
    // (PSS: each process's fair share of memory it shares with others; adding up RSS would count Chrome's shared memory many times)
    let kb = 0; const walk = (pid) => { try { const r = fs.readFileSync('/proc/' + pid + '/smaps_rollup', 'utf8'); const m = /^Pss:\s+(\d+)/m.exec(r); if (m) kb += +m[1]; } catch (e) { try { const m = /VmRSS:\s+(\d+)/.exec(fs.readFileSync('/proc/' + pid + '/status', 'utf8')); if (m) kb += +m[1]; } catch (x) {} } (kids.get(pid) || []).forEach(walk); }; walk(process.pid);
    return kb / 1024;
  } catch (e) { return 0; }
}
let lastMem = 0;
setInterval(() => {
  const mb = lastMem = memMB(); if (!chrome || !mb) return;
  if (mb > (+process.env.CLOUD_HARD_MB || 800)) { console.error('Cloud Chrome: ' + Math.round(mb) + ' MB, restarting it to stay under the limit'); stop('memory'); return; }
  if (mb > (+process.env.CLOUD_SOFT_MB || 700)) {
    chrome.tabs.forEach((t) => { if (!t.clients.size) park(t); else send('Memory.simulatePressureNotification', { level: 'critical' }, t.sessionId).catch(() => {}); });
    send('Memory.simulatePressureNotification', { level: 'critical' }).catch(() => {});
  }
}, 5000).unref();
function park(t) { if (t.parked) return; t.parked = true; send('Target.closeTarget', { targetId: t.id }).catch(() => {}); }

function emit(tab, event, data) {
  let text = null, bin = null;
  tab.clients.forEach((c) => {
    try {
      if (c.ws) {
        if (event === 'frame') { if (c.sock.writableLength > 160 * 1024) { c.skipped = (c.skipped || 0) + 1; return; } bin = bin || Buffer.from(data.d, 'base64'); wsSend(c.sock, bin, 2); }
        else wsSend(c.sock, Buffer.from(JSON.stringify({ e: event, d: data })), 1);
      } else {
        if (event === 'frame' && c.res.writableLength > 320 * 1024) return;
        text = text || 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'; c.res.write(text);
      }
    } catch (e) {}
  });
}
/* ---------- the live connection (WebSocket, RFC 6455, no package): pictures as binary, events and input as JSON ---------- */
function wsSend(sock, payload, op) {
  const n = payload.length; let head;
  if (n < 126) head = Buffer.from([0x80 | op, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  sock.write(Buffer.concat([head, payload]));
}
function wsReader(sock, onMessage, onClose) {
  let buf = Buffer.alloc(0), parts = [];
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > 4 * 1048576) { sock.destroy(); return; }
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (!masked) { sock.destroy(); return; } // (browsers always mask)
      if (buf.length < off + 4 + len) return;
      const mask = buf.slice(off, off + 4), data = Buffer.from(buf.slice(off + 4, off + 4 + len)); for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.slice(off + 4 + len);
      if (op === 8) { try { wsSend(sock, Buffer.alloc(0), 8); } catch (e) {} sock.end(); return; }
      if (op === 9) { try { wsSend(sock, data, 10); } catch (e) {} continue; }
      if (op === 10) continue;
      parts.push(data); if (fin) { const msg = Buffer.concat(parts).toString('utf8'); parts = []; onMessage(msg); }
    }
  });
  sock.on('close', onClose); sock.on('error', () => sock.destroy());
}
function upgrade(req, sock) {
  const url = new URL(req.url, 'http://x');
  const no = (code) => { try { sock.end('HTTP/1.1 ' + code + ' No\r\n\r\n'); } catch (e) {} };
  if (url.pathname !== '/api/cloud/ws' || !keyOK(req, url) || !available()) return no(401);
  const c = chrome; const tab = c && c.tabs.get(url.searchParams.get('id') || ''); if (!tab) return no(404);
  const k = req.headers['sec-websocket-key']; if (!k) return no(400);
  const accept = crypto.createHash('sha1').update(k + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const client = { ws: true, sock }; tab.clients.add(client); lastSeen = Date.now();
  const beat = setInterval(() => { try { wsSend(sock, Buffer.alloc(0), 9); } catch (e) {} }, 20000);
  wsReader(sock, (msg) => {
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    if (m && Array.isArray(m.events)) { lastTouch = Date.now(); runInput(tab, m.events).catch(() => {}); }
  }, () => { clearInterval(beat); tab.clients.delete(client); cast(tab).catch(() => {}); });
  cast(tab).then(() => nav(tab)).catch(() => {});
}
async function attach(c, targetId, info) {
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const tab = { id: targetId, sessionId, clients: new Set(), url: info.url || '', title: info.title || '', w: 1280, h: 800, mobile: false, casting: false, loading: false, opener: info.openerId || null };
  c.tabs.set(targetId, tab); c.bySession.set(sessionId, tab);
  await send('Page.enable', {}, sessionId);
  try { await send('Page.setInterceptFileChooserDialog', { enabled: true }, sessionId); } catch (e) {}
  await size(tab, tab.w, tab.h, false);
  return tab;
}
async function size(tab, w, h, mobile) {
  tab.w = Math.max(240, Math.min(2560, Math.round(w))); tab.h = Math.max(240, Math.min(1600, Math.round(h))); tab.mobile = !!mobile;
  await send('Emulation.setDeviceMetricsOverride', { width: tab.w, height: tab.h, deviceScaleFactor: 1, mobile: tab.mobile }, tab.sessionId);
  try { await send('Emulation.setTouchEmulationEnabled', { enabled: tab.mobile, maxTouchPoints: tab.mobile ? 5 : 0 }, tab.sessionId); } catch (e) {}
  if (tab.casting) { tab.casting = false; await cast(tab); }
}
/* the picture of the page: Chrome's screencast barely sends frames without a screen, so the page is photographed instead:
   about 8 times a second for 3 seconds after any click, key or page load, once a second otherwise (videos, animations); a
   picture identical to the last one isn't sent */
const busy = (tab) => { tab.busyUntil = Date.now() + 3000; if (tab.casting && tab.loop) { clearTimeout(tab.loop); tab.loop = setTimeout(() => shoot(tab), 30); } };
async function shoot(tab) {
  tab.loop = null; if (!tab.casting || !chrome) return;
  const t0 = Date.now();
  try {
    const moving = tab.video || Date.now() < (tab.busyUntil || 0);
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: moving ? Math.min(50, +process.env.CLOUD_JPEG || 62) : +process.env.CLOUD_JPEG || 62, optimizeForSpeed: true }, tab.sessionId);
    const sum = crypto.createHash('md5').update(r.data).digest('hex');
    if (sum !== tab.lastSum || tab.forceNext) { tab.forceNext = false; tab.lastSum = sum; count(r.data.length); emit(tab, 'frame', { d: r.data, w: tab.w, h: tab.h }); }
  } catch (e) {}
  if (!tab.casting) return;
  // (every second or so: is a video playing? then the picture keeps up with it)
  if (!tab.vCheck || Date.now() - tab.vCheck > 1000) { tab.vCheck = Date.now(); send('Runtime.evaluate', { expression: '[...document.querySelectorAll("video")].some(function(v){return !v.paused&&!v.ended&&v.readyState>2})', returnByValue: true }, tab.sessionId).then((r) => { tab.video = !!(r.result && r.result.value); }).catch(() => {}); }
  const fast = Date.now() < (tab.busyUntil || 0) || tab.loading;
  const every = tab.video ? Math.round(1000 / (+process.env.CLOUD_VIDEO_FPS || 15)) : fast ? 60 : 1000;
  tab.loop = setTimeout(() => shoot(tab), Math.max(15, every - (Date.now() - t0)));
}
async function cast(tab) {
  const want = tab.clients.size > 0;
  if (want && !tab.casting) { tab.casting = true; tab.lastSum = ''; busy(tab); shoot(tab); }
  else if (want) { tab.lastSum = ''; busy(tab); } // (a new watcher gets the picture now, even if nothing changed)
  else if (!want && tab.casting) { tab.casting = false; clearTimeout(tab.loop); tab.loop = null; }
  tab.unwatched = want ? 0 : (tab.unwatched || Date.now());
}
async function nav(tab) {
  try {
    const h = await send('Page.getNavigationHistory', {}, tab.sessionId); const e = h.entries[h.currentIndex] || {};
    tab.url = e.url || tab.url; tab.title = e.title || tab.title;
    const first = h.entries[0] && h.entries[0].url === 'about:blank' && h.entries.length > 1 ? 1 : 0; tab.firstEntry = first;
    emit(tab, 'nav', { url: tab.url, title: tab.title, back: h.currentIndex > first, fwd: h.currentIndex < h.entries.length - 1 });
  } catch (e) {}
}
function onEvent(c, m) {
  const p = m.params || {};
  if (m.method === 'Browser.downloadWillBegin') { const tab = c.tabs.get(p.frameId) || [...c.tabs.values()].find((x) => x.clients.size); c.downloads.set(p.guid, { name: String(p.suggestedFilename || 'download').replace(/[\/\\:*?"<>|]/g, '-').slice(0, 120), tab: tab && tab.id, t: Date.now() }); return; }
  if (m.method === 'Browser.downloadProgress') {
    const d = c.downloads.get(p.guid); if (!d) return;
    if (p.state === 'completed') { d.done = true; d.size = p.totalBytes || p.receivedBytes || 0; const tab = c.tabs.get(d.tab) || [...c.tabs.values()].find((x) => x.clients.size); if (tab) emit(tab, 'download', { guid: p.guid, name: d.name, size: d.size }); setTimeout(() => { try { fs.rmSync(path.join(RUN(), 'downloads', p.guid), { force: true }); } catch (e) {} c.downloads.delete(p.guid); }, 30 * 60000).unref(); }
    else if (p.state === 'canceled') c.downloads.delete(p.guid);
    else if ((p.receivedBytes || 0) > (+process.env.CLOUD_DOWNLOAD_MB || 200) * 1048576) send('Browser.cancelDownload', { guid: p.guid }).catch(() => {});
    return;
  }
  if (m.method === 'Target.targetCreated' && p.targetInfo.type === 'page' && p.targetInfo.openerId && c.tabs.has(p.targetInfo.openerId) && !c.tabs.has(p.targetInfo.targetId)) {
    // a page opened by one of ours (a link in a new tab, window.open): Patoogle gets a new tab for it
    const opener = c.tabs.get(p.targetInfo.openerId);
    if (c.tabs.size >= MAX_TABS()) { send('Target.closeTarget', { targetId: p.targetInfo.targetId }).catch(() => {}); return; }
    attach(c, p.targetInfo.targetId, p.targetInfo).then((t) => emit(opener, 'popup', { id: t.id, url: p.targetInfo.url })).catch(() => {});
    return;
  }
  if (m.method === 'Target.targetInfoChanged') { const t = c.tabs.get(p.targetInfo.targetId); if (t && (t.url !== p.targetInfo.url || t.title !== p.targetInfo.title)) { t.url = p.targetInfo.url; t.title = p.targetInfo.title; nav(t); } return; }
  if (m.method === 'Target.targetDestroyed') { const t = c.tabs.get(p.targetId); if (t) { t.casting = false; clearTimeout(t.loop); emit(t, t.parked ? 'parked' : 'closed', {}); c.tabs.delete(p.targetId); c.bySession.delete(t.sessionId); } return; }
  const tab = m.sessionId && c.bySession.get(m.sessionId); if (!tab) return;
  if (m.method === 'Page.frameStartedLoading') { if (!tab.loading) { tab.loading = true; emit(tab, 'loading', { on: true }); } }
  else if (m.method === 'Page.frameStoppedLoading' || m.method === 'Page.loadEventFired') { if (tab.loading) { tab.loading = false; emit(tab, 'loading', { on: false }); } nav(tab); busy(tab); }
  else if (m.method === 'Page.frameNavigated' && !p.frame.parentId) { nav(tab); busy(tab); }
  else if (m.method === 'Page.navigatedWithinDocument') nav(tab);
  else if (m.method === 'Page.javascriptDialogOpening') emit(tab, 'dialog', { type: p.type, message: String(p.message || '').slice(0, 2000), value: p.defaultPrompt || '' });
  else if (m.method === 'Page.fileChooserOpened') { tab.chooser = { node: p.backendNodeId, multiple: p.mode === 'selectMultiple' }; emit(tab, 'filechooser', { multiple: tab.chooser.multiple }); }
}

/* ---------- input: clicks, scrolling, touch, keys ---------- */
async function runInput(tab, list) {
  if (!chrome || !Array.isArray(list)) return;
  tab.forceNext = true; busy(tab); const S = tab.sessionId;
  // a burst of moves becomes the last one, and scroll steps in a row add up: fewer calls, same result
  const evs = [];
  for (const e of list.slice(0, 120)) {
    const prev = evs[evs.length - 1];
    if (prev && e.t === 'wheel' && prev.t === 'wheel') { prev.dx = (+prev.dx || 0) + (+e.dx || 0); prev.dy = (+prev.dy || 0) + (+e.dy || 0); prev.x = e.x; prev.y = e.y; continue; }
    if (prev && e.t === 'mouse' && e.type === 'mouseMoved' && prev.t === 'mouse' && prev.type === 'mouseMoved') { evs[evs.length - 1] = e; continue; }
    if (prev && e.t === 'touch' && e.type === 'touchMove' && prev.t === 'touch' && prev.type === 'touchMove') { evs[evs.length - 1] = e; continue; }
    evs.push(Object.assign({}, e));
  }
  const all = [];
  for (const e of evs) {
    const mods = (e.alt ? 1 : 0) | (e.ctrl ? 2 : 0) | (e.meta ? 4 : 0) | (e.shift ? 8 : 0);
    if (e.t === 'mouse') all.push(send('Input.dispatchMouseEvent', { type: e.type, x: +e.x || 0, y: +e.y || 0, button: e.button || 'none', buttons: +e.buttons || 0, clickCount: +e.count || 0, modifiers: mods }, S));
    else if (e.t === 'wheel') all.push(send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: +e.x || 0, y: +e.y || 0, deltaX: +e.dx || 0, deltaY: +e.dy || 0, modifiers: mods }, S));
    else if (e.t === 'touch') all.push(send('Input.dispatchTouchEvent', { type: e.type, touchPoints: e.type === 'touchEnd' || e.type === 'touchCancel' ? [] : [{ x: +e.x || 0, y: +e.y || 0, id: 1, radiusX: 4, radiusY: 4, force: 1 }], modifiers: mods }, S));
    else if (e.t === 'text' && e.text) all.push(send('Input.insertText', { text: String(e.text).slice(0, 5000) }, S));
    else if (e.t === 'key' && e.key) {
      const k = String(e.key); const code = KEYS[k] || (k.length === 1 ? k.toUpperCase().charCodeAt(0) : +e.keyCode || 0);
      const text = k.length === 1 && !e.ctrl && !e.meta ? k : k === 'Enter' ? '\r' : undefined;
      all.push(send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code: e.code || '', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, text, unmodifiedText: text, modifiers: mods }, S));
      all.push(send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: e.code || '', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: mods }, S));
    }
  }
  await Promise.all(all.map((p) => p.catch(() => {})));
  tab.forceNext = true; busy(tab);
}

/* ---------- what Patoogle asks ---------- */
const hits = new Map();
const ipOf = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
function keyOK(req, url) {
  const k = String(req.headers['x-cloud-key'] || url.searchParams.get('key') || ''); const K = KEY();
  if (K.length < 8 || !k) return false;
  const a = crypto.createHash('sha256').update(k).digest(), b = crypto.createHash('sha256').update(K).digest();
  return crypto.timingSafeEqual(a, b);
}
function json(res, code, o) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); }
function body(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 262144) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { ok({}); } }); req.on('error', () => ok({})); }); }
const KEYS = { Enter: 13, Backspace: 8, Tab: 9, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, Home: 36, End: 35, PageUp: 33, PageDown: 34, ' ': 32 };

async function handle(req, res, url) {
  const p = url.pathname;
  if (p === '/api/cloud/status') return json(res, 200, { available: available(), memMB: Math.round(lastMem || memMB()), sound: !!soundTools(), chrome: !!findChrome(), keySet: KEY().length >= 8, running: !!chrome, tabs: chrome ? chrome.tabs.size : 0, usedMB: Math.round(used / 1048576), capMB: Math.round(DAILY() / 1048576) });
  const ip = ipOf(req), now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (!keyOK(req, url)) { h.push(now); hits.set(ip, h); if (h.length > 20) return json(res, 429, { error: 'Too many tries. Wait a minute.' }); return json(res, 401, { error: 'The Cloud Chrome key is wrong' }); }
  if (!available()) return json(res, 503, { error: 'Cloud Chrome isn’t set up on this server' });
  try {
    if (p === '/api/cloud/check') return json(res, 200, { ok: true });
    if (p === '/api/cloud/stream') {
      const c = chrome; const tab = c && c.tabs.get(url.searchParams.get('id') || ''); if (!tab) return json(res, 404, { error: 'That tab is gone' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n'); const client = { res }; tab.clients.add(client); lastSeen = Date.now();
      const beat = setInterval(() => { try { res.write(': hi\n\n'); } catch (e) {} }, 20000);
      req.on('close', () => { clearInterval(beat); tab.clients.delete(client); cast(tab).catch(() => {}); });
      await cast(tab); await nav(tab);
      return;
    }
    if (p === '/api/cloud/audio') {
      // the sound of Cloud Chrome as an MP3 stream (all its tabs mixed), while someone listens
      const t = soundTools(); if (!t || !chrome || !pulse) return json(res, 404, { error: 'No sound here' });
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
      const rec = spawn(t.parec, ['-d', 'patos.monitor', '--format=s16le', '--rate=44100', '--channels=2', '--latency-msec=40'], { env: pulse.env, stdio: ['ignore', 'pipe', 'ignore'] });
      const enc = spawn(t.ffmpeg, ['-loglevel', 'error', '-fflags', '+nobuffer', '-f', 's16le', '-ar', '44100', '-ac', '2', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', (process.env.CLOUD_AUDIO_KBPS || '128') + 'k', '-flush_packets', '1', '-f', 'mp3', 'pipe:1'], { stdio: ['pipe', 'pipe', 'ignore'] });
      rec.stdout.pipe(enc.stdin); enc.stdin.on('error', () => {});
      enc.stdout.on('data', (c) => { count(c.length); try { res.write(c); } catch (e) {} });
      const end = () => { try { rec.kill('SIGKILL'); } catch (e) {} try { enc.kill('SIGKILL'); } catch (e) {} try { res.end(); } catch (e) {} };
      req.on('close', end); rec.on('exit', end); enc.on('exit', end);
      return;
    }
    if (p === '/api/cloud/download') {
      const d = chrome && chrome.downloads.get(url.searchParams.get('guid') || ''); const f = d && d.done && path.join(RUN(), 'downloads', url.searchParams.get('guid'));
      if (!f || !fs.existsSync(f)) return json(res, 404, { error: 'That download is gone' });
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(f).size, 'Content-Disposition': 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(d.name), 'Cache-Control': 'no-store' });
      return fs.createReadStream(f).pipe(res);
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'POST' });
    if (p === '/api/cloud/upload') {
      // one file for a page's file box, or to drop on the page; kept 10 minutes
      const c = chrome; const tab = c && c.tabs.get(url.searchParams.get('id') || ''); if (!tab) return json(res, 404, { error: 'That tab is gone' });
      const max = (+process.env.CLOUD_UPLOAD_MB || 50) * 1048576; const name = String(url.searchParams.get('name') || 'file').replace(/[\/\\:*?"<>|\x00-\x1f]/g, '-').slice(0, 120) || 'file';
      const dir = path.join(RUN(), 'uploads', crypto.randomBytes(8).toString('hex')); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, name);
      const out = fs.createWriteStream(f); let n = 0, tooBig = false;
      await new Promise((ok) => { req.on('data', (ch) => { n += ch.length; if (n > max) { tooBig = true; req.destroy(); } else out.write(ch); }); req.on('end', ok); req.on('close', ok); req.on('error', ok); });
      out.end(); lastTouch = Date.now(); count(n);
      if (tooBig) { fs.rmSync(dir, { recursive: true, force: true }); return json(res, 413, { error: 'That file is too big for Cloud Chrome (' + Math.round(max / 1048576) + ' MB at most)' }); }
      (tab.uploads = tab.uploads || []).push(f); setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 10 * 60000).unref();
      return json(res, 200, { ok: true, n: tab.uploads.length });
    }
    const b = await body(req); lastTouch = Date.now();
    if (p === '/api/cloud/open') {
      if (over()) return json(res, 429, { error: 'Cloud Chrome has used today’s data. It works again tomorrow.' });
      const c = await start(); if (c.tabs.size >= MAX_TABS()) return json(res, 429, { error: 'Too many Cloud Chrome tabs. Close one first.' });
      let target = 'about:blank'; if (b.url) { try { const u = new URL(String(b.url)); if (/^https?:$/.test(u.protocol)) target = u.href; } catch (e) {} }
      // (the tab is made at its address, so Back from the first page doesn't land on an empty page)
      const { targetId } = await send('Target.createTarget', { url: 'about:blank', newWindow: false, background: false });
      const tab = await attach(c, targetId, { url: target });
      await size(tab, +b.w || 1280, +b.h || 800, !!b.mobile);
      if (b.mobile) try { await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, tab.sessionId); } catch (e) {}
      if (target !== 'about:blank') { await send('Page.navigate', { url: target }, tab.sessionId); tab.firstNav = true; }
      return json(res, 200, { id: targetId });
    }
    const c = chrome; const tab = c && c.tabs.get(String(b.id || '')); if (!tab) return json(res, 404, { error: 'That tab is gone' });
    const S = tab.sessionId;
    if (p === '/api/cloud/input') { await runInput(tab, b.events); return json(res, 200, { ok: true }); }
    if (p === '/api/cloud/cmd') {
      busy(tab);
      const cmd = String(b.cmd || '');
      if (cmd === 'navigate') { const u = new URL(String(b.url || '')); if (!/^https?:$/.test(u.protocol)) return json(res, 400, { error: 'Only web addresses' }); await send('Page.navigate', { url: u.href }, S); }
      else if (cmd === 'back' || cmd === 'forward') { const hh = await send('Page.getNavigationHistory', {}, S); const i = hh.currentIndex + (cmd === 'back' ? -1 : 1); const e = hh.entries[i]; if (e && !(i === 0 && e.url === 'about:blank')) await send('Page.navigateToHistoryEntry', { entryId: e.id }, S); }
      else if (cmd === 'files') {
        const files = (tab.uploads || []).splice(0); const ch = tab.chooser; tab.chooser = null;
        if (!ch) return json(res, 409, { error: 'The page isn’t asking for a file any more' });
        await send('DOM.setFileInputFiles', { files: ch.multiple ? files : files.slice(0, 1), backendNodeId: ch.node }, S);
      }
      else if (cmd === 'nofiles') { tab.uploads = []; tab.chooser = null; }
      else if (cmd === 'drop') {
        const files = (tab.uploads || []).splice(0); const x = +b.x || 0, y = +b.y || 0; const data = { items: [], files, dragOperationsMask: 1 };
        for (const type of ['dragEnter', 'dragOver', 'drop']) await send('Input.dispatchDragEvent', { type, x, y, data }, S);
      }
      else if (cmd === 'find') {
        // find on page: select the next match (Chrome's own window.find), and count them
        const q = JSON.stringify(String(b.q || '').slice(0, 200));
        const r = await send('Runtime.evaluate', { expression: '(function(q,back,from0){var s=getSelection();if(from0&&s)s.removeAllRanges();var ok=q&&window.find?window.find(q,false,back,true,false,false,false):false;var t=(document.body&&document.body.innerText||"").toLowerCase(),n=0,i=0,l=q.toLowerCase();if(l)while((i=t.indexOf(l,i))>=0){n++;i+=l.length}return{n:n,ok:!!ok}})(' + q + ',' + !!b.back + ',' + !!b.from0 + ')', returnByValue: true }, S);
        return json(res, 200, (r.result && r.result.value) || { n: 0 });
      }
      else if (cmd === 'selection') { const r = await send('Runtime.evaluate', { expression: 'String(getSelection()||"").slice(0,100000)', returnByValue: true }, S); return json(res, 200, { text: (r.result && r.result.value) || '' }); }
      else if (cmd === 'scroll') { const r = await send('Runtime.evaluate', { expression: 'scrollY', returnByValue: true }, S); return json(res, 200, { y: r.result && r.result.value }); }
      else if (cmd === 'value') { const r = await send('Runtime.evaluate', { expression: '(document.activeElement && "value" in document.activeElement) ? String(document.activeElement.value).slice(0, 2000) : null', returnByValue: true }, S); return json(res, 200, { value: r.result && r.result.value }); }
      else if (cmd === 'text') { const r = await send('Runtime.evaluate', { expression: 'document.body ? document.body.innerText.slice(0, 2000) : ""', returnByValue: true }, S); return json(res, 200, { text: r.result && r.result.value }); }
      else if (cmd === 'reload') await send('Page.reload', {}, S);
      else if (cmd === 'resize') await size(tab, +b.w, +b.h, !!b.mobile);
      else if (cmd === 'dialog') await send('Page.handleJavaScriptDialog', { accept: !!b.accept, promptText: b.text != null ? String(b.text) : undefined }, S);
      else if (cmd === 'close') { await send('Target.closeTarget', { targetId: tab.id }); }
      else if (cmd === 'zoom') await send('Emulation.setPageScaleFactor', { pageScaleFactor: Math.max(0.3, Math.min(3, +b.z || 1)) }, S);
      else return json(res, 400, { error: 'Unknown command' });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Not found' });
  } catch (e) { return json(res, 502, { error: e.message || 'Cloud Chrome didn’t answer' }); }
}

// the server stopping (Railway sends SIGTERM on every redeploy) stops its Chrome too, so no Chrome is left running and locking
process.on('exit', () => stop());
['SIGTERM', 'SIGINT'].forEach((sig) => process.once(sig, () => { stop(); process.exit(0); }));

module.exports = { handle, upgrade, available, findChrome, stop };
