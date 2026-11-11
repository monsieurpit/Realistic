/* Cloud Chrome (cloud-browser.js): a real Chrome on the PatOS server, shown live in Patoogle. These run a real Chrome as the
   server's (this machine's Chromium) against small local sites, and drive Patoogle in another browser: the picture arrives,
   clicks, typing, Back/Forward, a link that opens a new tab, page dialogs, find on page, the key, the network gate (no private
   addresses, not the server itself), Chrome going to sleep and waking up, and Patoogle falling back when the key is wrong. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, browser, boot, skipNoBrowser, playwright } = require('../helpers');

let site, sp, srv, b, page, dataDir;
const KEY = 'test-cloud-key-123';
const HOME = '<!doctype html><title>Cloud home</title><style>body{margin:0;font:20px sans-serif}a,button,input{position:absolute;left:0;width:300px;height:80px;display:block}</style>' +
  '<a id="two" href="/two" style="top:0;background:#cde">Go to two</a>' +
  '<a id="pop" href="/three" target="_blank" style="top:100px;background:#edc">New tab</a>' +
  '<button id="al" style="top:200px" onclick="alert(\'Hello from the page\')">Alert</button>' +
  '<input id="q" style="top:300px" oninput="document.getElementById(\'echo\').textContent=\'typed:\'+this.value">' +
  '<div id="echo" style="position:absolute;top:400px">typed:</div><p style="position:absolute;top:460px">lisbon lisbon lisbon</p>';
test.before(async () => {
  if (skipNoBrowser) return;
  // a short video for the video test (ffmpeg makes it once)
  const vid = path.join(os.tmpdir(), 'patos-cloud-test.webm');
  try { if (!fs.existsSync(vid)) require('child_process').execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=8', '-c:v', 'libvpx', '-b:v', '400k', vid]); } catch (e) {}
  const BOX = 'position:absolute;left:0;top:0;width:400px;height:120px;display:block;font:20px sans-serif';
  const MORE = {
    '/up': '<title>Upload</title><input id="f" type="file" style="' + BOX + '" onchange="var f=this.files[0];f.text().then(function(t){document.getElementById(\'out\').textContent=\'file:\'+f.name+\':\'+t})"><div id="out" style="position:absolute;top:200px">none</div>',
    '/dl': '<title>Download</title><a href="/file.txt" download="notes from cloud.txt" style="' + BOX + ';background:#cde">Download</a>',
    '/drop': '<title>Drop</title><div id="z" style="' + BOX + ';background:#eee">drop here</div><div id="out" style="position:absolute;top:200px">none</div><script>var z=document.getElementById("z");z.ondragover=function(e){e.preventDefault()};z.ondrop=function(e){e.preventDefault();var f=e.dataTransfer.files[0];f.text().then(function(t){document.getElementById("out").textContent="dropped:"+f.name+":"+t})}</script>',
    '/tone': '<title>Tone</title><button style="' + BOX + '" onclick="var c=new AudioContext();var o=c.createOscillator();o.frequency.value=440;o.connect(c.destination);o.start();this.textContent=\'playing\'">Play a tone</button>',
    '/video': '<title>Video</title><video src="/v.webm" autoplay muted loop style="position:absolute;left:0;top:0;width:640px;height:480px"></video>',
    '/rc': '<title>Right click</title><div style="' + BOX + ';background:#eee" oncontextmenu="event.preventDefault();this.textContent=\'right-clicked\'">right-click me</div><p id="w" style="position:absolute;top:200px;margin:0;font:30px sans-serif">copyable</p><textarea id="ta" style="position:absolute;top:300px;left:0;width:400px;height:80px"></textarea>'
  };
  site = http.createServer((req, res) => {
    if (req.url === '/file.txt') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="notes from cloud.txt"' }); return res.end('Downloaded from Cloud Chrome'); }
    if (req.url === '/v.webm') { try { const d = fs.readFileSync(vid); res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': d.length }); return res.end(d); } catch (e) { res.writeHead(404); return res.end(); } }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(MORE[req.url] || (req.url === '/two' ? '<title>Cloud two</title><h1>Second page</h1>' : req.url === '/three' ? '<title>Cloud three</title><h1>Third</h1>' : HOME));
  });
  await new Promise((ok) => site.listen(0, '127.0.0.1', ok)); sp = site.address().port;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-cloud-'));
  Object.assign(process.env, { CLOUD_BROWSER_KEY: KEY, CHROME_PATH: playwright().chromium.executablePath(), PROXY_TEST_HOSTS: '127.0.0.1:' + sp, PATOS_DATA: dataDir, CLOUD_IDLE_MIN: '0.05', CLOUD_PARK_SEC: '1' });
  srv = await startServer(); b = await browser();
  page = await b.newPage({ viewport: { width: 1280, height: 860 } });
  await boot(page, srv.base, { fresh: true });
  await page.evaluate((k) => { PatOS.notify = () => {}; PatOS.store.set('cloudKey', k); window.__alerts = []; PatOS.alertBox = (t, m) => { window.__alerts.push(m); return Promise.resolve(); }; }, KEY);
});
test.after(async () => { ['CLOUD_BROWSER_KEY', 'CHROME_PATH', 'PROXY_TEST_HOSTS', 'PATOS_DATA', 'CLOUD_IDLE_MIN', 'CLOUD_PARK_SEC'].forEach((k) => delete process.env[k]); if (b) await b.close(); if (srv) srv.stop(); if (site) site.close(); if (dataDir) { await wait(1500); try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {} } });
const S = () => 'http://127.0.0.1:' + sp;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 10000) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await wait(150); } return v; }
const state = () => page.evaluate(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); if (!w) return null; const cv = w.el.querySelector('.br-pane:not([style*="none"]) .br-cloudcv'); return { omni: w.el.querySelector('.br-omni').value, title: w.title, tabs: w.el.querySelectorAll('.br-tab').length, cloud: !!cv, painted: !!(cv && +cv.dataset.frames > 0), sized: !!(cv && Math.abs(cv.width - cv.offsetWidth) <= 2 && Math.abs(cv.height - cv.offsetHeight) <= 2), back: !w.el.querySelector('.br-back').disabled, fwd: !w.el.querySelector('.br-fwd').disabled }; });
const status = () => fetch(srv.base + '/api/cloud/status').then((r) => r.json());
// a click on the page's picture, at a point of the page
async function clickPage(x, y) { const r = await page.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); const b = cv.getBoundingClientRect(); return { x: b.left, y: b.top, sx: b.width / cv.width, sy: b.height / cv.height }; }); await page.mouse.click(r.x + x * r.sx, r.y + y * r.sy); }

test('the server says Cloud Chrome is ready, and refuses a wrong key', { skip: skipNoBrowser }, async () => {
  const s = await status(); assert.equal(s.available, true); assert.equal(s.running, false, 'Chrome only starts when needed');
  const bad = await fetch(srv.base + '/api/cloud/open', { method: 'POST', headers: { 'x-cloud-key': 'wrong-key-000' }, body: '{}' });
  assert.equal(bad.status, 401);
});

test('a page opens in Cloud Chrome: its picture, its address and title', { skip: skipNoBrowser }, async () => {
  await page.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/');
  const st = await until(async () => { const s = await state(); return s && s.painted && s.title.startsWith('Cloud home') ? s : null; }, 15000);
  assert.ok(st, 'shown: ' + JSON.stringify(await state()));
  assert.equal(st.cloud, true); assert.equal(st.omni, S() + '/'); assert.equal(st.sized, true, 'Chrome’s page is exactly the tab’s size (not stretched)'); assert.equal(st.back, false, 'nothing to go back to');
  // the picture really has the page: the light blue link box at the top left
  const px = await page.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); const d = cv.getContext('2d').getImageData(260, 60, 1, 1).data; return [d[0], d[1], d[2]]; });
  assert.ok(Math.abs(px[0] - 0xcc) < 20 && Math.abs(px[1] - 0xdd) < 20 && Math.abs(px[2] - 0xee) < 20, 'painted pixel ' + px);
  assert.equal((await status()).running, true);
});

test('clicking, Back and Forward, and a link that opens a new tab', { skip: skipNoBrowser }, async () => {
  await clickPage(100, 40);
  let st = await until(async () => { const s = await state(); return s.title.startsWith('Cloud two') ? s : null; });
  assert.ok(st, 'the click followed the link: ' + JSON.stringify(await state())); assert.equal(st.omni, S() + '/two'); assert.equal(st.back, true);
  await page.click('.br-back');
  st = await until(async () => { const s = await state(); return s.title.startsWith('Cloud home') ? s : null; });
  assert.ok(st, 'Back'); assert.equal(st.fwd, true);
  await page.click('.br-fwd');
  assert.ok(await until(async () => (await state()).title.startsWith('Cloud two')), 'Forward');
  await page.click('.br-back'); await until(async () => (await state()).title.startsWith('Cloud home'));
  await wait(500);
  await clickPage(100, 140);
  st = await until(async () => { const s = await state(); return s.tabs === 2 && s.title.startsWith('Cloud three') ? s : null; });
  assert.ok(st, 'a new tab with the page: ' + JSON.stringify(await state()));
  await page.evaluate(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); w.el.querySelectorAll('.br-tab')[1].querySelector('.br-tx').click(); });
  await until(async () => (await state()).title.startsWith('Cloud home'));
  assert.ok(await until(async () => (await status()).tabs === 1), 'closing the tab closes its Chrome page');
});

test('typing and a page dialog', { skip: skipNoBrowser }, async () => {
  await clickPage(100, 340); await wait(300);
  await page.keyboard.type('hi there'); await page.keyboard.press('Backspace');
  const got = await until(async () => { const j = await page.evaluate(async (k) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const id = w && w._cloudId && w._cloudId(); if (!id) return null; return (await fetch('/api/cloud/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloud-key': k }, body: JSON.stringify({ id, cmd: 'text' }) })).json(); }, KEY); return j && /typed:hi ther\b/.test(j.text || '') ? j.text : null; });
  assert.ok(got, 'typed into the page (and Backspace worked)');
  await clickPage(100, 240);
  assert.deepEqual(await until(() => page.evaluate(() => (window.__alerts.length ? window.__alerts.slice() : null))), ['Hello from the page'], 'the page’s alert is shown by PatOS');
});

test('find on page works in Cloud Chrome', { skip: skipNoBrowser }, async () => {
  await page.keyboard.press('Control+f');
  assert.ok(await until(() => page.evaluate(() => !document.querySelector('.pb-find').hidden)), 'Ctrl+F on the page opens Find');
  await page.fill('.pb-fin', 'lisbon');
  assert.equal(await until(() => page.evaluate(() => { const t = document.querySelector('.pb-fcount').textContent; return /\//.test(t) ? t : null; })), '1 / 3');
  await page.press('.pb-fin', 'Escape');
});

test('the network gate: no private addresses, not the server itself', { skip: skipNoBrowser }, async () => {
  for (const u of ['http://localhost:' + srv.port + '/api/cloud/status', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/']) {
    await page.evaluate((x) => { const w = PatOS.wm.windows.find((y) => y.app.id === 'browser'); const o = w.el.querySelector('.br-omni'); o.value = x; o.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, u);
    const txt = await until(async () => { const j = await page.evaluate(async (k) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const id = w._cloudId(); return (await fetch('/api/cloud/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloud-key': k }, body: JSON.stringify({ id, cmd: 'text' }) })).json(); }, KEY); return j && j.text && /Not allowed/.test(j.text) ? j.text : null; });
    assert.ok(txt, u + ' must be refused by the gate');
    assert.doesNotMatch(txt, /"available"|"running"/, 'nothing from the server itself');
  }
});

test('Chrome goes to sleep when nobody watches, and wakes up with one click', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => PatOS.wm.closeAll());
  assert.ok(await until(async () => !(await status()).running, 30000), 'Chrome stopped after the idle time');
  await page.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/two');
  assert.ok(await until(async () => { const s = await state(); return s && s.painted && s.title.startsWith('Cloud two'); }, 15000), 'and starts again for the next page');
  await page.evaluate(() => PatOS.wm.closeAll());
});

test('a wrong key on the device: the page still opens (without Cloud Chrome) and PatOS says why', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => { PatOS.store.set('cloudKey', 'not-the-key-999'); window.__notes = []; PatOS.notify = (n) => window.__notes.push(n.body); });
  await page.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/two');
  const st = await until(async () => { const s = await state(); return s && !s.cloud && s.omni === S() + '/two' ? s : null; }, 12000);
  assert.ok(st, 'opened another way: ' + JSON.stringify(await state()));
  assert.ok((await page.evaluate(() => window.__notes)).some((n) => /key on this device is wrong/.test(n)));
  await page.evaluate((k) => { PatOS.store.set('cloudKey', k); PatOS.wm.closeAll(); }, KEY);
});

const go = (u) => page.evaluate((x) => { const w = PatOS.wm.windows.find((y) => y.app.id === 'browser'); if (!w) return PatOS.launch('browser', { url: x }); const o = w.el.querySelector('.br-omni'); o.value = x; o.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, u);
const pageText = () => page.evaluate(async (k) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const id = w && w._cloudId && w._cloudId(); if (!id) return ''; const j = await (await fetch('/api/cloud/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloud-key': k }, body: JSON.stringify({ id, cmd: 'text' }) })).json(); return j.text || ''; }, KEY);
const opened = async (title) => until(async () => { const s = await state(); return s && s.painted && s.title.startsWith(title) ? s : null; }, 15000);

test('a page asks for a file: Patoogle picks one on this device and the page gets it', { skip: skipNoBrowser }, async () => {
  await go(S() + '/up'); assert.ok(await opened('Upload'));
  await clickPage(100, 60);
  assert.ok(await until(() => page.evaluate(() => !!document.querySelector('.br-cloudfile'))), 'the “This page wants a file” sheet');
  await page.setInputFiles('.br-cloudfile input[type=file]', { name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('HELLO FROM PATOS') });
  assert.ok(await until(async () => /file:hello\.txt:HELLO FROM PATOS/.test(await pageText())), 'the page read the file: ' + await pageText());
  assert.equal(await page.evaluate(() => !!document.querySelector('.br-cloudfile')), false, 'the sheet goes away');
});

test('a download lands in PatOS’s Downloads folder', { skip: skipNoBrowser }, async () => {
  await go(S() + '/dl'); assert.ok(await opened('Download'));
  await clickPage(100, 60);
  const f = await until(() => page.evaluate(async () => { const l = PatOS.fs.list('/Downloads').find((x) => /notes from cloud/.test(x.name)); return l ? l.path : null; }), 15000);
  assert.ok(f, 'the file is in Downloads');
  const text = await page.evaluate(async (p) => { const n = PatOS.fs.get(p); if (typeof n.content === 'string' && n.content) return n.content; const b = await PatOS.fs.getBlob(p); return b ? await b.text() : ''; }, f);
  assert.equal(text, 'Downloaded from Cloud Chrome');
});

test('files dropped on a page reach it', { skip: skipNoBrowser }, async () => {
  await go(S() + '/drop'); assert.ok(await opened('Drop'));
  await page.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); const r = cv.getBoundingClientRect(); const dt = new DataTransfer(); dt.items.add(new File(['DROPPED TEXT'], 'drop.txt', { type: 'text/plain' })); const o = { bubbles: true, cancelable: true, clientX: r.left + 100 * r.width / cv.width, clientY: r.top + 60 * r.height / cv.height, dataTransfer: dt }; cv.dispatchEvent(new DragEvent('dragover', o)); cv.dispatchEvent(new DragEvent('drop', o)); });
  assert.ok(await until(async () => /dropped:drop\.txt:DROPPED TEXT/.test(await pageText())), 'the page got the file: ' + await pageText());
});

test('right-click, paste, and copy into this device’s clipboard', { skip: skipNoBrowser }, async () => {
  await go(S() + '/rc'); assert.ok(await opened('Right click'));
  const r = await page.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); const b = cv.getBoundingClientRect(); return { x: b.left, y: b.top, sx: b.width / cv.width, sy: b.height / cv.height }; });
  await page.mouse.click(r.x + 100 * r.sx, r.y + 60 * r.sy, { button: 'right' });
  assert.ok(await until(async () => /right-clicked/.test(await pageText())), 'right-click reached the page');
  // paste into the text box
  await clickPage(100, 330); await wait(300);
  await page.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); const dt = new DataTransfer(); dt.setData('text/plain', 'pasted words'); cv.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  assert.ok(await until(() => page.evaluate(async (k) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const id = w._cloudId(); const r2 = await (await fetch('/api/cloud/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloud-key': k }, body: JSON.stringify({ id, cmd: 'value' }) })).json(); return r2.value === 'pasted words'; }, KEY)), 'the pasted words are in the text box');
  // copy: double-click a word, Ctrl+C, and it is in this device's clipboard
  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); }, readText: () => Promise.resolve('') } }); });
  const cr = await page.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); const b = cv.getBoundingClientRect(); return { x: b.left + 60 * b.width / cv.width, y: b.top + 222 * b.height / cv.height }; });
  await page.mouse.dblclick(cr.x, cr.y); await wait(400);
  await page.keyboard.press('Control+c');
  assert.deepEqual(await until(() => page.evaluate(() => (window.__copied.length ? window.__copied.slice() : null))), ['copyable']);
});

test('a video playing makes the picture faster (about 15 a second)', { skip: skipNoBrowser || !fs.existsSync(path.join(os.tmpdir(), 'patos-cloud-test.webm')) }, async () => {
  await go(S() + '/video'); assert.ok(await opened('Video'));
  await wait(2500);
  const f0 = await page.evaluate(() => +[...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth).dataset.frames);
  await wait(3000);
  const f1 = await page.evaluate(() => +[...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth).dataset.frames);
  const fps = (f1 - f0) / 3;
  assert.ok(fps >= 6, 'pictures a second while a video plays: ' + fps.toFixed(1));
});

test('sound: Cloud Chrome’s sound comes as a live stream (when the server has the sound tools)', { skip: skipNoBrowser }, async (t) => {
  const s = await status(); if (!s.sound) { t.skip('no PulseAudio/ffmpeg on this machine'); return; }
  await go(S() + '/tone'); assert.ok(await opened('Tone'));
  await clickPage(100, 60);
  assert.ok(await until(async () => /playing/.test(await pageText())), 'the page started its tone');
  // 2 seconds of the stream, decoded: not silence
  const ac = new AbortController(); const parts = [];
  const r = await fetch(srv.base + '/api/cloud/audio?key=' + KEY, { signal: ac.signal });
  assert.equal(r.headers.get('content-type'), 'audio/mpeg');
  const rd = r.body.getReader(); const t0 = Date.now();
  while (Date.now() - t0 < 2500) { const { value, done } = await rd.read(); if (done) break; parts.push(Buffer.from(value)); }
  ac.abort();
  const mp3 = Buffer.concat(parts); assert.ok(mp3.length > 8000, 'MP3 bytes: ' + mp3.length);
  const pcm = require('child_process').execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'mp3', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', 'pipe:1'], { input: mp3 });
  let sum = 0; const n = Math.floor(pcm.length / 2); for (let i = 0; i < n; i++) { const v = pcm.readInt16LE(i * 2); sum += v * v; }
  const rms = Math.sqrt(sum / Math.max(1, n)); assert.ok(rms > 1000, 'the tone is in the stream (rms ' + Math.round(rms) + ')');
  // and Patoogle plays it after a click in the page, with a speaker button to mute
  assert.ok(await until(() => page.evaluate(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const b2 = w.el.querySelector('.pb-snd'); return b2 && getComputedStyle(b2).display !== 'none'; })), 'the speaker button shows');
});

test('on an iPhone: the phone layout, a tap opens a link, a drag scrolls, and the keyboard button types', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(Object.assign({}, playwright().devices['iPhone 14'])); const ph = await ctx.newPage();
  await boot(ph, srv.base, { fresh: true });
  await ph.evaluate((k) => { PatOS.notify = () => {}; PatOS.store.set('cloudKey', k); }, KEY);
  await ph.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/');
  const ok = await until(() => ph.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); return cv && +cv.dataset.frames > 0 && /Cloud home/.test(PatOS.wm.windows.find((x) => x.app.id === 'browser').title); }), 15000);
  assert.ok(ok, 'the page shows on the phone');
  const ua = await ph.evaluate(async (k) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const id = w._cloudId(); const r = await fetch('/api/cloud/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloud-key': k }, body: JSON.stringify({ id, cmd: 'text' }) }); void r; return navigator.userAgent; }, KEY);
  void ua;
  const box = () => ph.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); const r = cv.getBoundingClientRect(); return { x: r.left, y: r.top, sx: r.width / cv.width, sy: r.height / cv.height, w: cv.width }; });
  const bx = await box();
  assert.ok(bx.w <= 400, 'the page has the phone’s width: ' + bx.w);
  // typing with the keyboard button: tap the text box, then type through the phone keyboard's box
  await ph.touchscreen.tap(bx.x + 100 * bx.sx, bx.y + 340 * bx.sy); await wait(400);
  assert.equal(await ph.evaluate(() => getComputedStyle(document.querySelector('.pb-kbbtn:not(.pb-snd)')).display !== 'none'), true, 'the keyboard button shows');
  await ph.evaluate(() => document.querySelector('.pb-kbbtn:not(.pb-snd)').click());
  await ph.keyboard.type('phone');
  const typed = await until(() => ph.evaluate(async (k) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const id = w._cloudId(); const j = await (await fetch('/api/cloud/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloud-key': k }, body: JSON.stringify({ id, cmd: 'text' }) })).json(); return /typed:phone/.test(j.text || '') ? j.text : null; }, KEY));
  assert.ok(typed, 'typed from the phone keyboard');
  // a tap on the link
  await ph.touchscreen.tap(bx.x + 100 * bx.sx, bx.y + 40 * bx.sy);
  assert.ok(await until(() => ph.evaluate(() => /Cloud two/.test(PatOS.wm.windows.find((x) => x.app.id === 'browser').title))), 'the tap followed the link');
  await ctx.close();
});

test('memory: a tab in the background is parked on the server, and comes back by itself when you return to it', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => PatOS.wm.closeAll()); await wait(400);
  await page.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/two'); assert.ok(await opened('Cloud two'));
  await page.evaluate((u) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); w._open({ url: u }); }, S() + '/three');
  await until(async () => (await state()).tabs === 2); assert.ok(await opened('Cloud three'));
  // the first tab is in the background (and anything left from earlier tests): parked, only the tab in front stays
  assert.ok(await until(async () => (await status()).tabs === 1, 25000), 'the background tab was parked');
  await page.evaluate(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); w.el.querySelectorAll('.br-tab')[0].click(); });
  const back = await until(async () => { const st = await state(); return st && st.title.startsWith('Cloud two') && st.painted && st.omni === S() + '/two' ? st : null; }, 15000);
  assert.ok(back, 'it came back at the same page: ' + JSON.stringify(await state()));
  assert.equal(await page.evaluate(() => !!document.querySelector('.br-cloudwake:not([hidden])')), false, 'without the wake-up card');
  await page.evaluate(() => PatOS.wm.closeAll());
});

test('memory: past the hard limit Chrome restarts before the server runs out, and starts again for the next page', { skip: skipNoBrowser }, async () => {
  process.env.CLOUD_HARD_MB = '1'; process.env.PORT_TEST = '1';
  const small = await startServer(); delete process.env.CLOUD_HARD_MB;
  try {
    const H = { 'Content-Type': 'application/json', 'x-cloud-key': KEY };
    // (with a 1 MB limit, the guard may stop Chrome while this page is still opening: that is the point)
    await fetch(small.base + '/api/cloud/open', { method: 'POST', headers: H, body: JSON.stringify({ url: S() + '/two', w: 800, h: 600 }) }).catch(() => {});
    assert.ok(await until(async () => !(await (await fetch(small.base + '/api/cloud/status')).json()).running, 15000), 'Chrome was stopped to stay under the limit');
    const st = await (await fetch(small.base + '/api/cloud/status')).json(); assert.ok(st.memMB > 0, 'it reports memory: ' + st.memMB);
  } finally { small.stop(); }
});

test('on a phone, tapping a text box of the page opens the keyboard, and typing fills it', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(Object.assign({}, playwright().devices['iPhone 14'])); const ph = await ctx.newPage();
  await boot(ph, srv.base, { fresh: true });
  await ph.evaluate((k) => { PatOS.notify = () => {}; PatOS.store.set('cloudKey', k); }, KEY);
  await ph.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/');
  assert.ok(await until(() => ph.evaluate(() => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); return cv && +cv.dataset.frames > 0; }), 15000));
  await wait(800);
  const at = (x, y) => ph.evaluate(([x, y]) => { const cv = [...document.querySelectorAll('.br-cloudcv')].find((c) => c.offsetWidth); const r = cv.getBoundingClientRect(); return { x: r.left + x * r.width / cv.width, y: r.top + y * r.height / cv.height }; }, [x, y]);
  const p = await at(100, 340); await ph.touchscreen.tap(p.x, p.y);
  assert.ok(await until(() => ph.evaluate(() => document.activeElement && document.activeElement.classList.contains('br-cloudkb'))), 'the keyboard opened on the tap');
  await ph.keyboard.type('pat@example.com');
  const read = () => ph.evaluate(async (k) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const id = w._cloudId(); return (await (await fetch('/api/cloud/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloud-key': k }, body: JSON.stringify({ id, cmd: 'text' }) })).json()).text || ''; }, KEY);
  const v = await until(async () => /typed:pat@example\.com/.test(await read()));
  assert.ok(v, 'the page got it: ' + (await read()).slice(0, 200));
  await ctx.close();
});

test('typing keeps every character: dots, dashes and symbols (they were taken for Delete, Insert and the arrows)', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => PatOS.wm.closeAll()); await wait(300);
  await page.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/'); assert.ok(await until(async () => { const s2 = await state(); return s2 && s2.painted && s2.title.startsWith('Cloud home'); }, 15000));
  await clickPage(100, 340); await wait(300);
  const text = 'a.b-c_d@e.com!"#$%&\'()*+,/:;<=>?[]{}~';
  await page.keyboard.type(text, { delay: 20 });
  const got = await until(() => page.evaluate(async ([k, want]) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const id = w._cloudId(); const j = await (await fetch('/api/cloud/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cloud-key': k }, body: JSON.stringify({ id, cmd: 'text' }) })).json(); return (j.text || '').includes('typed:' + want) ? want : null; }, [KEY, text]));
  assert.equal(got, text);
  await page.evaluate(() => PatOS.wm.closeAll());
});
