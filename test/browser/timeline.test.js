/* Timeline (js/timeline.js, js/apps/timeline.js): PatOS remembers what you do on this device (apps, files, websites, notes,
   copied text and the windows you had open), shows it day by day, finds it again, and restores a moment in one click.
   It must never record in Passwords or from password fields, never sync, and forget on request. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('apps, files, websites, notes and copied text are recorded; the app shows the day and finds them', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    PatOS.setSetting('showWidgets', false);
    PatOS.launch('calculator'); await new Promise((r) => setTimeout(r, 300));
    PatOS.fs.write('/Documents/Trip plan.txt', 'Flights to Lisbon'); await new Promise((r) => setTimeout(r, 50));
    const H = PatOS.store.get('browserHistory', []); H.unshift({ u: 'https://en.wikipedia.org/wiki/Lisbon', t: Date.now() + 5, title: 'Lisbon - Wikipedia' }); PatOS.store.set('browserHistory', H);
    const N = PatOS.store.get('notes', []); N.push({ id: 'zz', title: 'Packing', body: '<div>Packing</div><div>passport</div>', mtime: Date.now() + 5 }); PatOS.store.set('notes', N);
    // a copy from an ordinary text field
    const ta = document.createElement('textarea'); ta.value = 'confirmation XK29QF'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); ta.remove();
    await new Promise((r) => setTimeout(r, 50));
    return { kinds: PatOS.timeline.events().map((e) => e.k).sort(), clips: PatOS.timeline.clips().map((c) => c.text) };
  });
  assert.deepEqual(r.kinds, ['app', 'file', 'note', 'web'], JSON.stringify(r));
  assert.ok(r.clips.includes('confirmation XK29QF'), 'the copy was kept: ' + JSON.stringify(r.clips));
  await page.evaluate(() => PatOS.launch('timeline')); await page.waitForTimeout(900);
  assert.ok(await page.locator('.tl-card').count() >= 5, 'cards for the day');
  await page.fill('.tl-q', 'lisbon today'); await page.waitForTimeout(500);
  const found = await page.$$eval('.tl-card b, .tl-card .tl-ctext', (e) => e.map((x) => x.textContent).join(' | '));
  assert.match(found, /Lisbon - Wikipedia/); assert.doesNotMatch(found, /Calculator/);
  assert.deepEqual(errors, []); await page.close();
});

test('nothing is recorded in Passwords or from a password field; paused and off record nothing; the Timeline never syncs', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const TL = PatOS.timeline;
    PatOS.launch('passwords'); await new Promise((r) => setTimeout(r, 400));
    const pw = document.createElement('input'); pw.type = 'password'; pw.value = 'hunter2'; document.body.appendChild(pw); pw.focus(); pw.select(); document.execCommand('copy'); pw.remove();
    const a = { ev: TL.events().filter((e) => /passwords/i.test(e.key)).length, clips: TL.clips().length };
    PatOS.wm.closeAll(); await new Promise((r) => setTimeout(r, 200));
    TL.pause(60000); PatOS.launch('calculator'); TL.addClip('while paused'); await new Promise((r) => setTimeout(r, 200));
    const b = { ev: TL.events().length, clips: TL.clips().length };
    TL.pause(0); PatOS.setSetting('timeline', false); PatOS.wm.closeAll(); PatOS.launch('clock'); await new Promise((r) => setTimeout(r, 200));
    const c = TL.events().length; PatOS.setSetting('timeline', true);
    return { a, b, c };
  });
  assert.deepEqual(r.a, { ev: 0, clips: 0 }, 'Passwords and password fields leave no trace');
  assert.deepEqual(r.b, { ev: 0, clips: 0 }, 'paused records nothing');
  assert.equal(r.c, 0, 'off records nothing');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'js', 'sync.js'), 'utf8');
  ['timeline', 'timelineMoments', 'clipHistory', 'timelinePause'].forEach((k) => assert.ok(src.includes("'" + k + "'"), k + ' stays on this device (sync DENY list)'));
  assert.deepEqual(errors, []); await page.close();
});

test('Alt+V opens the clipboard history and pastes the chosen text into the field you were typing in', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.timeline.addClip('first thing'); PatOS.timeline.addClip('second thing'); const i = document.createElement('input'); i.id = 'tgt'; i.style.cssText = 'position:fixed;top:300px;left:300px;z-index:99999'; document.body.appendChild(i); i.focus(); });
  await page.keyboard.press('Alt+KeyV'); await page.waitForTimeout(400);
  assert.equal(await page.locator('#clip-panel .cp-row').count(), 2);
  assert.match(await page.locator('#clip-panel .cp-row').first().textContent(), /second thing/, 'newest first');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert.equal(await page.inputValue('#tgt'), 'first thing');
  assert.equal(await page.locator('#clip-panel').count(), 0, 'the panel closes');
  assert.deepEqual(errors, []); await page.close();
});

test('a moment brings back the windows you had open; after a restart, "pick up where you left off" offers them; forget removes it all', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(async () => { PatOS.setSetting('showWidgets', false); PatOS.setSetting('reopenWindows', false); PatOS.launch('notes'); PatOS.launch('calculator'); await new Promise((r) => setTimeout(r, 700)); PatOS.timeline.snapMoment(); });
  const m = await page.evaluate(() => PatOS.timeline.moments().map((x) => x.wins.map((w) => w.app).sort().join(',')));
  assert.deepEqual(m, ['calculator,notes']);
  await page.waitForTimeout(1800); // let the Timeline save
  await reload(page); await page.waitForSelector('#lock:not(.hidden)'); await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => PatOS.wm.windows.length), 0, 'windows did not come back by themselves (Reopen windows is off)');
  await page.evaluate(() => PatOS.launch('timeline')); await page.waitForTimeout(900);
  assert.equal(await page.locator('.tl-resume').count(), 1, 'the pick-up card is there');
  await page.click('.tl-resume .btn'); await page.waitForTimeout(1200);
  assert.deepEqual(await page.evaluate(() => PatOS.wm.windows.map((w) => w.app.id).sort()), ['calculator', 'notes', 'timeline']);
  await page.evaluate(() => PatOS.timeline.forget(0)); await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => [PatOS.timeline.events().length, PatOS.timeline.moments().length, PatOS.timeline.clips().length]), [0, 0, 0]);
  assert.deepEqual(errors, []); await page.close();
});
