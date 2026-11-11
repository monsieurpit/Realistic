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
  site = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(req.url === '/two' ? '<title>Cloud two</title><h1>Second page</h1>' : req.url === '/three' ? '<title>Cloud three</title><h1>Third</h1>' : HOME);
  });
  await new Promise((ok) => site.listen(0, '127.0.0.1', ok)); sp = site.address().port;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-cloud-'));
  Object.assign(process.env, { CLOUD_BROWSER_KEY: KEY, CHROME_PATH: playwright().chromium.executablePath(), PROXY_TEST_HOSTS: '127.0.0.1:' + sp, PATOS_DATA: dataDir, CLOUD_IDLE_MIN: '0.05' });
  srv = await startServer(); b = await browser();
  page = await b.newPage({ viewport: { width: 1280, height: 860 } });
  await boot(page, srv.base, { fresh: true });
  await page.evaluate((k) => { PatOS.notify = () => {}; PatOS.store.set('cloudKey', k); window.__alerts = []; PatOS.alertBox = (t, m) => { window.__alerts.push(m); return Promise.resolve(); }; }, KEY);
});
test.after(async () => { ['CLOUD_BROWSER_KEY', 'CHROME_PATH', 'PROXY_TEST_HOSTS', 'PATOS_DATA', 'CLOUD_IDLE_MIN'].forEach((k) => delete process.env[k]); if (b) await b.close(); if (srv) srv.stop(); if (site) site.close(); if (dataDir) { await wait(1500); try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {} } });
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
