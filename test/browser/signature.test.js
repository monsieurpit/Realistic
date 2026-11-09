/* PatOS signature (css/signature.css) and Flow (js/flow.js): PatOS's own window controls, the PatOS mark, the lock screen
   layout, and the motion (gliding selection, light/dark view transition) — without changing what anything does. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('window controls are one capsule of drawn glyphs (not colored dots) and still close, minimize and zoom', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.setSetting('showWidgets', false); PatOS.launch('notes'); }); await page.waitForTimeout(900);
  const look = await page.evaluate(() => { const c = document.querySelector('.window .tl.close'); const cs = getComputedStyle(c), b = getComputedStyle(c, '::before'); return { bg: cs.backgroundColor, mask: b.webkitMaskImage || b.maskImage, w: c.offsetWidth }; });
  assert.notEqual(look.bg, 'rgb(255, 95, 87)', 'no red dot'); assert.match(look.mask, /svg/, 'a drawn glyph'); assert.ok(look.w >= 24, 'a comfortable target');
  await page.click('.window .tl.max'); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => PatOS.wm.windows[0].fullscreen), true, 'the zoom button goes full screen, as before');
  await page.evaluate(() => PatOS.wm.windows[0].toggleFullscreen()); await page.waitForTimeout(600);
  await page.click('.window .tl.close'); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => PatOS.wm.windows.length), 0);
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector('.mb-logo'), '::before').backgroundImage), /svg/, 'the PatOS mark in the menu bar');
  assert.deepEqual(errors, []); await page.close();
});

test('a segmented control glides to the new tab; with Reduce Motion it just switches', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.setSetting('showWidgets', false); PatOS.launch('clock', { tab: 0 }); }); await page.waitForTimeout(900);
  await page.locator('.window .seg .tab').nth(2).click(); await page.waitForTimeout(60);
  assert.equal(await page.locator('.seg-glide').count(), 1, 'the highlight is moving');
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.seg-glide').count(), 0, 'and is gone when it arrives');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.window .seg .tab')[2].classList.contains('on')), true);
  await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));
  await page.locator('.window .seg .tab').nth(0).click(); await page.waitForTimeout(60);
  assert.equal(await page.locator('.seg-glide').count(), 0);
  assert.deepEqual(errors, []); await page.close();
});

test('switching light/dark by a click saves at once and changes the screen; scripts still change it instantly', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  // (Playwright's evaluate counts as a user gesture, so this goes through the transition too: the value is saved at once, the screen follows)
  assert.equal(await page.evaluate(() => { PatOS.setSetting('theme', 'light'); PatOS.setSetting('theme', 'dark'); return PatOS.settings.theme; }), 'dark', 'quick changes keep their order');
  await page.waitForTimeout(800); assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.evaluate(() => PatOS.launch('settings', { pane: 'appearance' })); await page.waitForTimeout(1200);
  await page.locator('.window button', { hasText: /^Light$/ }).first().click();
  assert.equal(await page.evaluate(() => PatOS.settings.theme), 'light', 'saved right away');
  await page.waitForTimeout(900);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light', 'and the screen follows');
  assert.deepEqual(errors, []); await page.close();
});

test('the lock screen puts the time at the lower left and the login card at the lower right', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true, login: false });
  await page.waitForSelector('#lock:not(.hidden)'); await page.waitForTimeout(1200);
  const r = await page.evaluate(() => { const c = document.querySelector('.lock-clock').getBoundingClientRect(), u = document.querySelector('.lock-user').getBoundingClientRect(); return { cx: c.left, cy: c.bottom, ux: u.right, uy: u.bottom }; });
  assert.ok(r.cx < 300 && r.cy > 600, 'clock lower left: ' + JSON.stringify(r)); assert.ok(r.ux > 1100 && r.uy > 600, 'card lower right');
  await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  assert.equal(await page.evaluate(() => PatOS.loggedIn), true, 'Enter still logs in');
  assert.deepEqual(errors, []); await page.close();
});
