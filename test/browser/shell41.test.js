/* The desktop (4.1): banners that group by app and never pile up, Dock badges and attention hops, the genie, and windows
   that grow out of their Dock icon however they are opened. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('banners: one per app with a count, three at most, the others glide', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
  const shown = () => ev(() => [...document.querySelectorAll('#toasts .toast:not(.leaving)')].map((t) => [t.dataset.app, t.querySelector('.toast-title').textContent, t.querySelector('.toast-body').textContent, t.querySelector('.toast-when').textContent]));
  await ev(() => { PatOS.notify({ title: 'Saved', body: 'Report', icon: 'textedit' }); PatOS.notify({ title: 'Goal', body: 'one', icon: 'games' }); });
  await ev(() => { PatOS.notify({ title: 'Goal', body: 'two', icon: 'games' }); PatOS.notify({ title: 'Goal', body: 'three', icon: 'games' }); });
  assert.deepEqual(await shown(), [['textedit', 'Saved', 'Report', 'now'], ['games', 'Goal', 'three', '+2']], 'the same app again: one banner, the newest, and how many more');
  await ev(() => { PatOS.notify({ title: 'Lunch', body: 'noon', icon: 'calendar' }); PatOS.notify({ title: 'Homework', body: 'math', icon: 'reminders' }); });
  assert.deepEqual((await shown()).map((x) => x[0]), ['games', 'calendar', 'reminders'], 'three at most: the oldest made room');
  assert.ok(await ev(() => PatOS.nc.list().some((n) => n.title === 'Saved')), 'it is still in Notification Center');
  // urgent ones and ones with buttons are never merged
  await ev(() => { PatOS.notify({ title: 'Alarm', body: 'now', icon: 'reminders', priority: 'urgent' }); });
  assert.equal((await shown()).filter((x) => x[0] === 'reminders').length, 2);
  // a banner goes away by itself
  await page.waitForFunction(() => !document.querySelector('#toasts .toast[data-app="calendar"]'), null, { timeout: 8000 });
  assert.deepEqual(errors, []); await page.close();
});

test('the Dock: badges, an attention hop, windows grow out of their icon, and the genie', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  const badge = () => ev(() => { const x = document.querySelector('#dock .dock-item[data-app="messages"] .dock-badge'); return x ? x.textContent : null; });
  await ev(() => PatOS.dock.badge('messages', 3)); assert.equal(await badge(), '3');
  await ev(() => PatOS.dock.badge('messages', 140)); assert.equal(await badge(), '99+');
  await ev(() => PatOS.dock.render()); assert.equal(await badge(), '99+', 'it stays when the Dock is drawn again');
  await ev(() => PatOS.dock.badge('messages', 0)); assert.equal(await badge(), null);
  // unread messages put the number there
  await ev(() => PatOS.emit('chat', { signedIn: true, unread: 2 })); assert.equal(await badge(), '2');
  // an app that isn't in front: its icon hops when it notifies; low ones don't
  const hops = () => ev(() => document.querySelector('#dock .dock-item[data-app="calendar"]').classList.contains('bounce'));
  await ev(() => PatOS.notify({ title: 'x', body: 'y', icon: 'calendar', priority: 'low' })); assert.equal(await hops(), false);
  await ev(() => PatOS.notify({ title: 'Lunch', body: 'noon', icon: 'calendar' })); assert.equal(await hops(), true);
  // opened from Spotlight (no click on the Dock): it still grows out of its Dock icon
  const from = await ev(() => { PatOS._launchRect = null; const r = PatOS.dock.iconRect('notes'); const w = PatOS.launch('notes'); const a = w.el.getAnimations()[0]; const k = a && a.effect.getKeyframes()[0]; return { icon: [Math.round(r.left), Math.round(r.top)], first: k && k.transform }; });
  assert.match(from.first || '', /translate|matrix/, 'the first frame is at the icon');
  await page.waitForTimeout(700);
  // the genie: a funnel (clip-path) into the icon, and back out
  const g = await ev(() => { const w = PatOS.wm.windowsOf('notes')[0]; w.minimize(); const k = w.el.getAnimations()[0].effect.getKeyframes(); return k.map((x) => x.clipPath); });
  assert.equal(g.length, 4); assert.match(g[1], /polygon\(0% 0%, 100% 0%, [\d.]+% 100%, [\d.]+% 100%\)/, 'the bottom pinches first');
  await page.waitForTimeout(700); assert.equal(await ev(() => PatOS.wm.windowsOf('notes')[0].el.style.display), 'none');
  await ev(() => PatOS.wm.restore(PatOS.wm.windowsOf('notes')[0])); await page.waitForTimeout(600);
  assert.equal(await ev(() => PatOS.wm.windowsOf('notes')[0].el.style.display), '');
  assert.deepEqual(errors, []); await page.close();
});
