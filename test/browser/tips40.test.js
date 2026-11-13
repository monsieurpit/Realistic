/* Tips (4.0, js/apps/tips.js): every collection, every "Try it" does the real thing without an error, search, what was
   seen is remembered, and it speaks French. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('Tips: collections, every Try it works, search, seen is remembered', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => PatOS.launch('tips')); await page.waitForSelector('.tp-card');
  const all = await ev(() => PatOS.tips.all());
  assert.ok(all.length >= 45, 'many tips: ' + all.length);
  for (const c of await ev(() => PatOS.tips.collections())) assert.ok(all.some((t) => t.col === c), 'collection ' + c + ' has tips');
  // every "Try it", collection by collection, does what it says without an error
  for (const c of await ev(() => PatOS.tips.collections())) {
    await ev((c) => PatOS.wm.windowsOf('tips')[0]._tips.open(c), c); await page.waitForTimeout(150);
    const n = await ev(() => document.querySelectorAll('.tips-app .tp-main button.btn').length);
    for (let i = 0; i < n; i++) {
      await ev((i) => { document.querySelectorAll('.tips-app .tp-main button.btn')[i].click(); }, i); await page.waitForTimeout(250);
      await page.keyboard.press('Escape'); await ev(() => { try { PatOS.launchpad.hide(); PatOS.spotlight.hide(); PatOS.mission && PatOS.mission.on && PatOS.mission.exit(); PatOS.pill.collapse(); PatOS.command && PatOS.command.close(); PatOS.widgets.edit(false); } catch (e) {} document.querySelectorAll('.menu').forEach((m) => m.remove()); });
      // the Tips window stays reachable for the next one
      await ev(() => { const w = PatOS.wm.windowsOf('tips')[0]; if (w) PatOS.wm.focus ? PatOS.wm.focus(w) : null; });
    }
  }
  // what the main ones open is really open
  for (const app of ['deskstudio', 'world', 'data', 'gallery', 'notes', 'calendar', 'shortcuts', 'appstore', 'messages', 'spaces', 'passwords']) assert.ok(await ev((a) => PatOS.wm.windowsOf(a).length > 0, app), app + ' opened from its tip');
  // search
  await ev(() => PatOS.wm.windowsOf('tips')[0]._tips.search('clipboard')); await page.waitForTimeout(150);
  assert.match(await ev(() => document.querySelector('.tips-app .tp-main').textContent), /Everything you copied/);
  // seen is remembered after a restart of the app
  const seen = await ev(() => PatOS.wm.windowsOf('tips')[0]._tips.seen().length); assert.ok(seen >= 10, 'seen: ' + seen);
  assert.ok(await ev(() => (PatOS.store.get('tipsSeen', []) || []).length >= 10));
  assert.deepEqual(errors, []); await page.close();
});

test('Tips in French, and a nudge once after the update', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1300, height: 860 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await page.waitForTimeout(6800);
  assert.ok(await ev(() => PatOS.nc.list().some((n) => /PatOS 4\.0/.test(n.title))), 'the nudge to see what’s new');
  await ev(() => { PatOS.lang = 'fr'; });
  await ev(() => PatOS.launch('tips')); await page.waitForSelector('.tp-card');
  const txt = await ev(() => document.querySelector('.tips-app').textContent);
  assert.match(txt, /Nouveau dans 4\.0/); assert.match(txt, /Des widgets sur ton bureau/); assert.match(txt, /Raccourcis clavier/);
  assert.deepEqual(errors, []); await page.close();
});
