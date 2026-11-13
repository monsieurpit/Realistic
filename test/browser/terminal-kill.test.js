/* The Terminal's kill, on the real processes (js/process.js): exactly the PID given, -9 force-quits, PatOS's own processes are
   protected, anything invalid is an error (never a panic), and only "sudo kill 1" / "sudo kill 42" panic, on purpose. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

// runs one command in the Terminal and gives back what it printed for it
const term = async (page, cmd) => page.evaluate(async (c) => {
  const w = PatOS.wm.windows.find((x) => x.app.id === 'terminal') || PatOS.launch('terminal');
  await new Promise((r) => setTimeout(r, 400));
  const before = w.el.textContent.length;
  const inp = w.el.querySelector('input, textarea'); inp.focus(); inp.value = c;
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const pw = document.querySelector('.dlg .dlg-in[type=password]');
  if (pw) { pw.value = 'anything'; document.querySelector('.dlg .btn.primary').click(); }
  await new Promise((r) => setTimeout(r, 500));
  return w.el.textContent.slice(before);
}, cmd);
// an app that keeps working (a repeating timer), so it is easy to see whether it was stopped
const startWorker = (page, id) => page.evaluate((appId) => {
  if (!PatOS.apps[appId]) PatOS.registerApp({ id: appId, name: appId, icon: 'settings', width: 320, height: 200, launch(win) { win.body.textContent = appId; window['_' + appId] = 0; setInterval(() => { window['_' + appId]++; }, 50); } });
  PatOS.launch(appId); return PatOS.proc.ofApp(appId).pid;
}, id);
const panicking = (page) => page.evaluate(() => !!document.querySelector('.fw-panic'));

test('kill stops exactly the PID given; kill -9 force-quits it', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const a = await startWorker(page, 'worka'), c = await startWorker(page, 'workb');
  assert.ok(a >= 400 && c >= 400 && a !== c, 'apps get their own PIDs: ' + a + ', ' + c);
  await term(page, 'kill ' + a); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => PatOS.wm.windowsOf('worka').length), 0, 'kill closed that app’s window');
  assert.equal(await page.evaluate(() => PatOS.wm.windowsOf('workb').length), 1, 'and only that app');
  // its timer still runs (it was quit, not force-quit): it is in the background now
  assert.equal(await page.evaluate((p) => PatOS.proc.get(p) && PatOS.proc.get(p).state, a), 'background');
  await term(page, 'kill -9 ' + a); await page.waitForTimeout(300);
  const n = await page.evaluate(() => window._worka); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window._worka), n, 'kill -9 stopped everything it started');
  assert.equal(await page.evaluate((p) => PatOS.proc.get(p), a), null, 'and it is gone');
  await term(page, 'kill -9 ' + c); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => PatOS.wm.windowsOf('workb').length), 0, 'kill -9 closes its windows too');
  assert.equal(await panicking(page), false);
  assert.deepEqual(errors, []); await page.close();
});

test('PatOS’s own processes are protected, and anything that isn’t a PID is an error, never a panic', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const a = await startWorker(page, 'workc');
  for (const pid of [88, 97, 103, 110, 120]) {
    assert.match(await term(page, 'kill ' + pid), /Operation not permitted/, 'kill ' + pid);
    assert.match(await term(page, 'kill -9 ' + pid), /Operation not permitted/, 'kill -9 ' + pid);
    assert.ok(await page.evaluate((p) => !!PatOS.proc.get(p), pid), pid + ' is still there');
  }
  assert.match(await term(page, 'sudo kill -9 88'), /part of PatOS and can’t be stopped/, 'even with sudo');
  // without sudo, 1 and 42 are refused like the rest
  assert.match(await term(page, 'kill 1'), /Operation not permitted/); assert.match(await term(page, 'kill -9 42'), /Operation not permitted/);
  // not PIDs: nothing happens to the app whose PID they look like, and nothing panics
  for (const bad of ['0' + a, String(a) + 'x', (a / 100) + 'e2', '-' + a, 'abc', '01', '042', '1.0', '42abc']) {
    const out = await term(page, 'sudo kill ' + bad);
    assert.match(out, /arguments must be process IDs|invalid signal/, 'kill ' + bad + ' → ' + out.trim());
  }
  assert.match(await term(page, 'kill 99999'), /No such process/);
  assert.match(await term(page, 'kill -HUP ' + a), /invalid signal/);
  assert.match(await term(page, 'kill'), /usage/);
  assert.equal(await panicking(page), false, 'no panic');
  assert.equal(await page.evaluate(() => PatOS.wm.windowsOf('workc').length), 1, 'the app those looked like is untouched');
  assert.deepEqual(errors, []); await page.close();
});

test('sudo kill 1 and sudo kill 42 are the kernel panic, on purpose', { skip: skipNoBrowser }, async () => {
  for (const pid of ['1', '42']) {
    const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
    await term(page, 'sudo kill ' + pid);
    await page.waitForSelector('.fw-panic', { timeout: 5000 });
    assert.match(await page.evaluate(() => document.querySelector('.fw-panic').textContent), pid === '1' ? /kill init/ : /kill the kernel/);
    await page.close();
  }
});
