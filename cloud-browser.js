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
      '--disable-sync', '--disable-component-update', '--disable-default-apps', '--mute-audio', '--renderer-process-limit=6', '--remote-debugging-port=0',
      '--user-data-dir=' + DATA(), '--proxy-server=http://127.0.0.1:' + gate.address().port, '--proxy-bypass-list=<-loopback>', '--window-size=1280,800', '--lang=' + (process.env.CLOUD_LANG || 'en-US'), 'about:blank'];
    const proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'pipe'] });
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
    try { await send('Browser.setDownloadBehavior', { behavior: 'deny' }); } catch (e) {}
    return c;
  })();
  try { return await starting; } catch (e) { stop('failed'); throw e; } finally { starting = null; }
}
function stop() {
  const c = chrome; if (!c) return; chrome = null;
  c.tabs.forEach((t) => t.clients.forEach((res) => { try { res.write('event: gone\ndata: {}\n\n'); res.end(); } catch (e) {} }));
  c.waits.forEach((w) => w.bad(new Error('Cloud Chrome stopped'))); c.waits.clear();
  try { c.ws.close(); } catch (e) {} try { c.proc.kill('SIGKILL'); } catch (e) {} try { c.gate.close(); } catch (e) {}
}
// nobody watching for a while, or nobody touching it for half an hour: Chrome stops (it costs money while it runs)
setInterval(() => {
  if (!chrome) return; const now = Date.now(); const watching = [...chrome.tabs.values()].some((t) => t.clients.size);
  if (watching) lastSeen = now;
  if (now - lastSeen > IDLE_MS() || now - lastTouch > 30 * 60000) stop('idle');
}, 15000).unref();

function emit(tab, event, data) { const s = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'; tab.clients.forEach((res) => { try { res.write(s); } catch (e) {} }); }
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
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: +process.env.CLOUD_JPEG || 62, optimizeForSpeed: true }, tab.sessionId);
    const sum = crypto.createHash('md5').update(r.data).digest('hex');
    if (sum !== tab.lastSum) { tab.lastSum = sum; count(r.data.length); emit(tab, 'frame', { d: r.data, w: tab.w, h: tab.h }); }
  } catch (e) {}
  if (!tab.casting) return;
  const fast = Date.now() < (tab.busyUntil || 0) || tab.loading;
  tab.loop = setTimeout(() => shoot(tab), Math.max(20, (fast ? 120 : 1000) - (Date.now() - t0)));
}
async function cast(tab) {
  const want = tab.clients.size > 0;
  if (want && !tab.casting) { tab.casting = true; tab.lastSum = ''; busy(tab); shoot(tab); }
  else if (want) { tab.lastSum = ''; busy(tab); } // (a new watcher gets the picture now, even if nothing changed)
  else if (!want && tab.casting) { tab.casting = false; clearTimeout(tab.loop); tab.loop = null; }
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
  if (m.method === 'Target.targetCreated' && p.targetInfo.type === 'page' && p.targetInfo.openerId && c.tabs.has(p.targetInfo.openerId) && !c.tabs.has(p.targetInfo.targetId)) {
    // a page opened by one of ours (a link in a new tab, window.open): Patoogle gets a new tab for it
    const opener = c.tabs.get(p.targetInfo.openerId);
    if (c.tabs.size >= MAX_TABS()) { send('Target.closeTarget', { targetId: p.targetInfo.targetId }).catch(() => {}); return; }
    attach(c, p.targetInfo.targetId, p.targetInfo).then((t) => emit(opener, 'popup', { id: t.id, url: p.targetInfo.url })).catch(() => {});
    return;
  }
  if (m.method === 'Target.targetInfoChanged') { const t = c.tabs.get(p.targetInfo.targetId); if (t && (t.url !== p.targetInfo.url || t.title !== p.targetInfo.title)) { t.url = p.targetInfo.url; t.title = p.targetInfo.title; nav(t); } return; }
  if (m.method === 'Target.targetDestroyed') { const t = c.tabs.get(p.targetId); if (t) { t.casting = false; clearTimeout(t.loop); emit(t, 'closed', {}); c.tabs.delete(p.targetId); c.bySession.delete(t.sessionId); } return; }
  const tab = m.sessionId && c.bySession.get(m.sessionId); if (!tab) return;
  if (m.method === 'Page.frameStartedLoading') { if (!tab.loading) { tab.loading = true; emit(tab, 'loading', { on: true }); } }
  else if (m.method === 'Page.frameStoppedLoading' || m.method === 'Page.loadEventFired') { if (tab.loading) { tab.loading = false; emit(tab, 'loading', { on: false }); } nav(tab); busy(tab); }
  else if (m.method === 'Page.frameNavigated' && !p.frame.parentId) { nav(tab); busy(tab); }
  else if (m.method === 'Page.navigatedWithinDocument') nav(tab);
  else if (m.method === 'Page.javascriptDialogOpening') emit(tab, 'dialog', { type: p.type, message: String(p.message || '').slice(0, 2000), value: p.defaultPrompt || '' });
  else if (m.method === 'Page.fileChooserOpened') emit(tab, 'notice', { text: 'Uploading files isn’t possible in Cloud Chrome yet.' });
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
  if (p === '/api/cloud/status') return json(res, 200, { available: available(), chrome: !!findChrome(), keySet: KEY().length >= 8, running: !!chrome, tabs: chrome ? chrome.tabs.size : 0, usedMB: Math.round(used / 1048576), capMB: Math.round(DAILY() / 1048576) });
  const ip = ipOf(req), now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (!keyOK(req, url)) { h.push(now); hits.set(ip, h); if (h.length > 20) return json(res, 429, { error: 'Too many tries. Wait a minute.' }); return json(res, 401, { error: 'The Cloud Chrome key is wrong' }); }
  if (!available()) return json(res, 503, { error: 'Cloud Chrome isn’t set up on this server' });
  try {
    if (p === '/api/cloud/check') return json(res, 200, { ok: true });
    if (p === '/api/cloud/stream') {
      const c = chrome; const tab = c && c.tabs.get(url.searchParams.get('id') || ''); if (!tab) return json(res, 404, { error: 'That tab is gone' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n'); tab.clients.add(res); lastSeen = Date.now();
      const beat = setInterval(() => { try { res.write(': hi\n\n'); } catch (e) {} }, 20000);
      req.on('close', () => { clearInterval(beat); tab.clients.delete(res); cast(tab).catch(() => {}); });
      await cast(tab); await nav(tab);
      return;
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'POST' });
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
    if (p === '/api/cloud/input') {
      busy(tab);
      for (const e of (Array.isArray(b.events) ? b.events : []).slice(0, 60)) {
        const mods = (e.alt ? 1 : 0) | (e.ctrl ? 2 : 0) | (e.meta ? 4 : 0) | (e.shift ? 8 : 0);
        if (e.t === 'mouse') await send('Input.dispatchMouseEvent', { type: e.type, x: +e.x || 0, y: +e.y || 0, button: e.button || 'none', buttons: +e.buttons || 0, clickCount: +e.count || 0, modifiers: mods }, S);
        else if (e.t === 'wheel') await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: +e.x || 0, y: +e.y || 0, deltaX: +e.dx || 0, deltaY: +e.dy || 0, modifiers: mods }, S);
        else if (e.t === 'text' && e.text) await send('Input.insertText', { text: String(e.text).slice(0, 5000) }, S);
        else if (e.t === 'key' && e.key) {
          const k = String(e.key); const code = KEYS[k] || (k.length === 1 ? k.toUpperCase().charCodeAt(0) : +e.keyCode || 0);
          const text = k.length === 1 && !e.ctrl && !e.meta ? k : k === 'Enter' ? '\r' : undefined;
          await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code: e.code || '', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, text, unmodifiedText: text, modifiers: mods }, S);
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: e.code || '', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: mods }, S);
        }
      }
      return json(res, 200, { ok: true });
    }
    if (p === '/api/cloud/cmd') {
      busy(tab);
      const cmd = String(b.cmd || '');
      if (cmd === 'navigate') { const u = new URL(String(b.url || '')); if (!/^https?:$/.test(u.protocol)) return json(res, 400, { error: 'Only web addresses' }); await send('Page.navigate', { url: u.href }, S); }
      else if (cmd === 'back' || cmd === 'forward') { const hh = await send('Page.getNavigationHistory', {}, S); const i = hh.currentIndex + (cmd === 'back' ? -1 : 1); const e = hh.entries[i]; if (e && !(i === 0 && e.url === 'about:blank')) await send('Page.navigateToHistoryEntry', { entryId: e.id }, S); }
      else if (cmd === 'find') {
        // find on page: select the next match (Chrome's own window.find), and count them
        const q = JSON.stringify(String(b.q || '').slice(0, 200));
        const r = await send('Runtime.evaluate', { expression: '(function(q,back,from0){var s=getSelection();if(from0&&s)s.removeAllRanges();var ok=q&&window.find?window.find(q,false,back,true,false,false,false):false;var t=(document.body&&document.body.innerText||"").toLowerCase(),n=0,i=0,l=q.toLowerCase();if(l)while((i=t.indexOf(l,i))>=0){n++;i+=l.length}return{n:n,ok:!!ok}})(' + q + ',' + !!b.back + ',' + !!b.from0 + ')', returnByValue: true }, S);
        return json(res, 200, (r.result && r.result.value) || { n: 0 });
      }
      else if (cmd === 'selection') { const r = await send('Runtime.evaluate', { expression: 'String(getSelection()||"").slice(0,100000)', returnByValue: true }, S); return json(res, 200, { text: (r.result && r.result.value) || '' }); }
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

module.exports = { handle, available, findChrome, stop };
