/* Handoff (js/handoff.js): what you were just doing on one device is offered on the other, through Sync (here two devices
   joined by a sync code, through the PatOS sync server). One click opens it; the server never sees it in clear; Passwords is
   never handed over; "Not now" and the switch in Settings work. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, dataDir;
test.before(async () => { if (skipNoBrowser) return; dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-ho-')); process.env.PATOS_DATA = dataDir; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true }); });
async function device(opts) {
  const ctx = await b.newContext(opts || { viewport: { width: 1366, height: 768 } }); const page = await ctx.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; PatOS.setSetting('showWidgets', false); });
  return { ctx, page, ev: (fn, arg) => page.evaluate(fn, arg) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('a note open on one device is offered on the other, opens with one click, and the server can’t read it', { skip: skipNoBrowser }, async () => {
  const A = await device(Object.assign({}, require('../helpers').playwright().devices['iPhone 13']));
  const B = await device();
  const code = await A.ev(async () => { const c = await PatOS.sync.enable(); await PatOS.sync.now(); return c; });
  await B.ev(async (c) => { await PatOS.sync.join(c); }, code);
  // on the phone: a note
  await A.ev(async () => {
    PatOS.store.set('notes', [{ id: 'nTrip', title: 'Trip to Lisbon', body: '<div>Trip to Lisbon</div><div>secret plan body</div>', mtime: Date.now() }]);
    PatOS.launch('notes', { id: 'nTrip' }); await new Promise((r) => setTimeout(r, 900));
    PatOS.handoff.publish(); await PatOS.sync.now();
  });
  const mine = await A.ev(() => PatOS.store.get('handoff:' + PatOS.handoff.device().id));
  assert.equal(mine.app, 'notes'); assert.equal(mine.args.id, 'nTrip'); assert.equal(mine.name, 'iPhone');
  // on the Chromebook: the card
  await B.ev(async () => { await PatOS.sync.now(); await new Promise((r) => setTimeout(r, 300)); PatOS.handoff.refresh(); });
  await B.page.waitForSelector('#handoff-card', { timeout: 5000 });
  assert.match(await B.page.textContent('#handoff-card'), /Continue from iPhone/);
  assert.match(await B.page.textContent('#handoff-card'), /Notes/);
  // nothing readable on the server
  let bytes = ''; (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else bytes += fs.readFileSync(p, 'latin1'); }); })(dataDir);
  ['Trip to Lisbon', 'nTrip', 'handoff', 'iPhone', 'secret plan'].forEach((w) => assert.ok(!bytes.includes(w), 'the server must not contain: ' + w));
  // one click
  await B.page.click('#handoff-card .ho-main'); await B.page.waitForTimeout(1200);
  const opened = await B.ev(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'notes'); return w ? w.args.id : null; });
  assert.equal(opened, 'nTrip');
  assert.equal(await B.page.locator('#handoff-card').count(), 0, 'the card goes away');
  await A.ctx.close(); await B.ctx.close();
});

test('Passwords is never handed over; “Not now” and the switch in Settings hide the card; old offers are ignored', { skip: skipNoBrowser }, async () => {
  const B = await device();
  const r = await B.ev(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    // this device using Passwords: nothing published
    PatOS.launch('passwords'); await wait(500); PatOS.handoff.publish();
    const sent = PatOS.store.get('handoff:' + PatOS.handoff.device().id, null);
    PatOS.wm.closeAll();
    // another device's offer arrives (as Sync would write it)
    PatOS.store.set('handoff:otherdev', { dev: 'otherdev', name: 'iPhone', t: Date.now(), app: 'calculator', args: {}, title: 'Calculator', icon: 'calculator' });
    await wait(300); const shown = !!document.getElementById('handoff-card');
    document.querySelector('#handoff-card .ho-x').click(); await wait(400); const afterNotNow = !!document.getElementById('handoff-card');
    PatOS.store.set('handoff:otherdev', { dev: 'otherdev', name: 'iPhone', t: Date.now() + 5, app: 'clock', args: {}, title: 'Clock', icon: 'clock' });
    await wait(300); const newOne = !!document.getElementById('handoff-card');
    PatOS.setSetting('handoff', false); await wait(400); const off = !!document.getElementById('handoff-card'); PatOS.setSetting('handoff', true);
    PatOS.store.set('handoff:otherdev', { dev: 'otherdev', name: 'iPhone', t: Date.now() - 31 * 60 * 1000, app: 'clock', args: {}, title: 'Clock', icon: 'clock' });
    PatOS.store.set('handoffSeen', {}); PatOS.handoff.refresh(); await wait(300); const stale = !!document.getElementById('handoff-card');
    return { sent: sent && sent.app, shown, afterNotNow, newOne, off, stale };
  });
  assert.notEqual(r.sent, 'passwords', 'Passwords is never handed over');
  assert.equal(r.shown, true); assert.equal(r.afterNotNow, false, '“Not now” hides it');
  assert.equal(r.newOne, true, 'something new from that device shows again');
  assert.equal(r.off, false, 'off in Settings: no card');
  assert.equal(r.stale, false, 'older than 30 minutes: not offered');
  await B.ctx.close();
});
