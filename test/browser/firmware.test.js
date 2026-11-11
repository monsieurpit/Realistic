/* The firmware (js/firmware.js): PatOS starts like a real operating system.
   - /System is there, and it can't be opened, changed or deleted, except with sudo in the Terminal
   - sudo rm -rf /System: PatOS freezes, restarts, can't find its system, reinstalls, setup starts again, /System is back,
     and the files from before are offered back
   - Recovery (reboot --recovery), the boot log (verbose), a kernel panic, restart and shut down */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

const term = async (page, cmd) => page.evaluate(async (c) => {
  const w = PatOS.wm.windows.find((x) => x.app.id === 'terminal') || PatOS.launch('terminal');
  await new Promise((r) => setTimeout(r, 400));
  const inp = w.el.querySelector('input, textarea'); inp.focus(); inp.value = c;
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const pw = document.querySelector('.dlg .dlg-in[type=password]');
  if (pw) { pw.value = 'anything'; document.querySelector('.dlg .btn.primary').click(); }
  await new Promise((r) => setTimeout(r, 500));
  return w.el.textContent;
}, cmd);

test('/System is there and protected', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(() => {
    const tryIt = (fn) => { try { fn(); return 'ok'; } catch (e) { return e.message; } };
    return {
      exists: PatOS.fs.exists('/System'),
      list: tryIt(() => PatOS.fs.list('/System')),
      write: tryIt(() => PatOS.fs.write('/System/x.txt', 'x')),
      remove: tryIt(() => PatOS.fs.remove('/System')),
      rename: tryIt(() => PatOS.fs.rename('/System', 'Sys2')),
      root: PatOS.fs.asRoot(() => PatOS.fs.list('/System').map((n) => n.name || n).length),
      still: PatOS.fs.exists('/System')
    };
  });
  assert.equal(r.exists, true);
  for (const k of ['list', 'write', 'remove', 'rename']) assert.match(r[k], /System Integrity Protection|Permission denied/, k);
  assert.ok(r.root >= 3, 'root sees inside');
  assert.equal(r.still, true);
  const out = await term(page, 'rm -rf /System');
  assert.match(out, /System Integrity Protection|not permitted/i);
  assert.equal(await page.evaluate(() => PatOS.fs.exists('/System')), true);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sudo rm -rf /System: freeze, restart, "might have been deleted", reinstall, setup, files offered back', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => PatOS.fs.write('/Documents/Keep me.txt', 'my homework'));
  await term(page, 'sudo rm -rf /System');
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('fw-frozen')), true, 'frozen');
  // restart (3 s frozen + the restart screen), then the failed boot (3-5 s)
  await page.waitForSelector('.fw-nosys', { timeout: 20000 });
  assert.match(await page.textContent('.fw-nosys'), /PatOS might have been deleted from this device/);
  await page.click('.fw-nosys .fw-btn.primary');
  await page.waitForSelector('.fw-install', { timeout: 5000 });
  // after the install PatOS reloads into setup
  await page.waitForFunction(() => window.PatOS && PatOS.store && !PatOS.store.get('setupDone', false), null, { timeout: 30000 });
  const st = await page.evaluate(() => ({ sys: PatOS.fs.exists('/System'), keep: PatOS.fs.exists('/Documents/Keep me.txt'), fw: PatOS.firmware.state() }));
  assert.equal(st.sys, true, '/System is back');
  assert.equal(st.keep, false, 'PatOS was erased');
  assert.equal(st.fw.state, 'installed');
  // finish setup: the rescue is offered
  await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 }); await page.evaluate(() => PatOS.boot.login());
  await page.waitForSelector('#setup', { timeout: 10000 });
  await page.evaluate(() => { PatOS.store.set('setupDone', true); document.getElementById('setup').remove(); });
  await page.waitForSelector('.dlg', { timeout: 15000 });
  const dlg = await page.textContent('.dlg');
  assert.match(dlg, /Bring back your files and settings/);
  await page.click('.dlg .btn.primary');
  await page.waitForSelector('.fw-power', { timeout: 15000 });
  await page.waitForSelector('#lock:not(.hidden)', { timeout: 30000 }); await page.evaluate(() => PatOS.boot.login());
  assert.equal(await page.evaluate(() => PatOS.fs.read('/Documents/Keep me.txt')), 'my homework', 'the files came back');
  assert.equal(await page.evaluate(() => PatOS.fs.exists('/System')), true);
  assert.deepEqual(errors.filter((e) => !/reload|navigation/i.test(e)), []);
  await page.close();
});

test('Recovery, the boot log and a kernel panic', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => PatOS.firmware.next('recovery'));
  await page.reload();
  await page.waitForSelector('.fw-recovery', { timeout: 20000 });
  assert.match(await page.textContent('.fw-recovery'), /Restore from a Snapshot[\s\S]*Reinstall PatOS[\s\S]*Disk Utility[\s\S]*Terminal/);
  await page.click('.fw-ropt:nth-child(3)');
  await page.waitForFunction(() => /appears to be OK/.test((document.querySelector('.fw-log') || {}).textContent || ''), null, { timeout: 10000 });
  // verbose
  await page.evaluate(() => PatOS.firmware.next('verbose'));
  await page.reload();
  await page.waitForSelector('.fw-verbose', { timeout: 20000 });
  await page.waitForFunction(() => /boot: done/.test((document.querySelector('.fw-verbose') || {}).textContent || ''), null, { timeout: 10000 });
  await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 });
  await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(600);
  // panic
  await page.evaluate(() => { PatOS.firmware.panic('test panic'); });
  await page.waitForSelector('.fw-panic', { timeout: 3000 });
  assert.match(await page.textContent('.fw-panic'), /needs to restart/);
  await page.waitForSelector('#lock:not(.hidden)', { timeout: 25000 });
  await page.evaluate(() => PatOS.boot.login());
  await page.waitForFunction(() => /restarted because of a problem/.test(document.body.textContent), null, { timeout: 10000 });
  await page.close();
});

test('restart and shut down show their screens', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.firmware.power('shutdown', true); });
  await page.waitForSelector('.fw-power', { timeout: 3000 });
  await page.waitForSelector('#off:not(.hidden)', { timeout: 6000 });
  assert.match(await page.textContent('#off'), /shut down/i);
  await page.close();
});
