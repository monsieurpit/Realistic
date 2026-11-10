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

test('menus stay the size of their items (not the width of the screen) with Liquid Glass on', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await page.click('.mb-logo'); await page.waitForTimeout(500);
  const m = await page.evaluate(() => { const e = document.querySelector('.menu'); return { pos: getComputedStyle(e).position, w: e.offsetWidth, glass: document.documentElement.classList.contains('lg-on') }; });
  assert.equal(m.pos, 'absolute'); assert.ok(m.w < 400, 'the menu is ' + m.w + ' px wide');
  assert.deepEqual(errors, []); await page.close();
});

test('a desktop icon takes clicks on its picture and name only, not on the empty square around them', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; PatOS.setSetting('showWidgets', false); PatOS.fs.mkdir('/Desktop/Stuff'); }); await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  const r = await page.evaluate(() => [...document.querySelectorAll('.desk-icon')].map((el) => {
    const img = el.querySelector('.di-img').getBoundingClientRect(), box = el.getBoundingClientRect();
    const mine = (x, y) => { const t = document.elementFromPoint(x, y); return !!(t && t.closest('.desk-icon') === el); };
    return { shape: el.dataset.shape, center: mine(img.left + img.width / 2, img.top + img.height / 2), corner: mine(img.left + 3, img.top + 3), edge: mine(box.right - 2, img.top + img.height / 2) };
  }));
  assert.ok(r.length >= 2);
  r.forEach((x) => assert.deepEqual({ center: x.center, corner: x.corner, edge: x.edge }, { center: true, corner: false, edge: false }, x.shape));
  const img = await page.locator('.desk-icon[data-shape=folder] .di-img').boundingBox();
  await page.mouse.dblclick(img.x + img.width / 2, img.y + img.height / 2); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => PatOS.wm.windows.some((w) => w.app.id === 'finder')), true, 'double-clicking the picture still opens it');
  assert.deepEqual(errors, []); await page.close();
});

test('Fold is the new wallpaper (Silk moves to it once); Liquid Glass on the desktop follows the wallpaper, floating panels follow the theme; light icons are their own setting; flat icons have no line over them', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errors = await boot(page, srv.base, { fresh: true });
  assert.equal(await page.evaluate(() => PatOS.settings.wallpaper), 'fold', 'a new install starts on Fold');
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    PatOS.setSetting('theme', 'light'); PatOS.setSetting('wallpaper', 'silk'); await wait(1500);
    const widget = getComputedStyle(document.querySelector('.widget')).color, tone = document.documentElement.dataset.wpTone;
    PatOS.launch('notes'); await wait(500); PatOS.menu([{ label: 'x' }], 100, 100); await wait(100);
    const menu = getComputedStyle(document.querySelector('.menu')).color; PatOS.closeMenus && PatOS.closeMenus();
    PatOS.setSetting('wallpaper', 'fold'); await wait(1500);
    const toneFold = document.documentElement.dataset.wpTone, widgetFold = getComputedStyle(document.querySelector('.widget')).color;
    PatOS.setSetting('theme', 'dark'); PatOS.setSetting('iconStyle', 'light'); await wait(300);
    const tile = document.querySelector('#dock .icon-tile.gi:not(.flat):not(.colored)'); const light = getComputedStyle(tile).backgroundImage;
    PatOS.setSetting('iconStyle', 'auto'); await wait(200); const auto = !document.documentElement.classList.contains('icons-dark');
    const flat = document.querySelector('.desk-icon .icon-tile.flat'); const flatShadow = flat ? getComputedStyle(flat).boxShadow : 'none';
    return { widget, tone, menu, toneFold, widgetFold, light, auto, flatShadow };
  });
  assert.equal(r.tone, 'dark'); assert.equal(r.widget, 'rgb(255, 255, 255)', 'light mode over a dark wallpaper: white words on the desktop glass');
  assert.equal(r.menu, 'rgb(29, 29, 31)', 'a menu (over windows) follows light mode');
  assert.equal(r.toneFold, 'light'); assert.equal(r.widgetFold, 'rgb(29, 29, 31)', 'light Fold: dark words');
  assert.match(r.light, /rgb\(2[0-5]\d, 2[0-5]\d, 2[0-5]\d\)/, 'light (silver) icon tiles with dark mode');
  assert.equal(r.auto, false, 'automatic icons follow dark mode');
  assert.equal(r.flatShadow, 'none', 'no line over flat icons');
  assert.deepEqual(errors, []); await page.close();
});

test('an older PatOS on Silk moves to Fold once, and choosing Silk again sticks', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await page.goto(srv.base + '/manifest.webmanifest');
  await page.evaluate((P) => { localStorage.clear(); localStorage.setItem('patos-policy', JSON.stringify({ version: P, at: Date.now() })); localStorage.setItem('patos:setupDone', 'true'); localStorage.setItem('patos:settings', JSON.stringify({ wallpaper: 'silk', theme: 'dark' })); }, require('../helpers').POLICY);
  await page.goto(srv.base + '/'); await page.waitForFunction(() => window.PatOS && PatOS.settings, null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => PatOS.settings.wallpaper), 'fold');
  await page.evaluate(() => PatOS.setSetting('wallpaper', 'silk')); await page.waitForTimeout(600);
  await page.reload(); await page.waitForFunction(() => window.PatOS && PatOS.settings, null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => PatOS.settings.wallpaper), 'silk');
  await page.close();
});

test('light app icons are painted for a white tile (solid colors), and switching back paints the dark ones again', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const src = () => document.querySelector('#dock .dock-item[data-app="photos"] .gi-img').src; // (an app without a color of its own: white in Light, dark glass in Dark)
    PatOS.setSetting('theme', 'dark'); PatOS.setSetting('iconStyle', 'dark'); await wait(300); const dark = src();
    PatOS.setSetting('iconStyle', 'light'); await wait(300); const light = src();
    PatOS.setSetting('iconStyle', 'dark'); await wait(300); const back = src();
    return { changed: dark !== light, back: back === dark, solid: /translate\(0%201\.[26]\)/.test(light) && !/translate\(0%201\.[26]\)/.test(dark) };
  });
  assert.deepEqual(r, { changed: true, back: true, solid: true });
  assert.deepEqual(errors, []); await page.close();
});

test('one-color apps get a tile of their own color with a white drawing in Light and Dark; the others are white in Light and dark glass in Dark; Automatic follows the theme', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    PatOS.setSetting('theme', 'dark'); PatOS.setSetting('iconStyle', 'light'); await wait(300);
    const tile = (app) => document.querySelector('#dock .dock-item[data-app="' + app + '"] .icon-tile');
    const music = tile('music'), photos = tile('photos');
    const out = { musicColored: music.classList.contains('colored'), musicBg: music.style.background, photosColored: photos.classList.contains('colored'),
      musicWhite: /stop-color%3D%22%23ffffff/.test(music.querySelector('img').src) };
    PatOS.setSetting('iconStyle', 'auto'); PatOS.setSetting('theme', 'light'); await wait(400);
    out.autoLight = document.documentElement.classList.contains('icons-color') && !document.documentElement.classList.contains('icons-dark');
    PatOS.setSetting('theme', 'dark'); await wait(400);
    out.autoDark = document.documentElement.classList.contains('icons-dark');
    out.darkMusicColored = tile('music').classList.contains('colored'); out.darkPhotosBg = getComputedStyle(tile('photos')).backgroundImage;
    return out;
  });
  assert.equal(r.musicColored, true); assert.match(r.musicBg, /gradient/); assert.equal(r.musicWhite, true, 'Music’s note is white on its red tile');
  assert.equal(r.photosColored, false, 'Photos keeps a white tile');
  assert.equal(r.autoLight, true); assert.equal(r.autoDark, true);
  assert.equal(r.darkMusicColored, true, 'Music keeps its red tile in Dark'); assert.doesNotMatch(r.darkPhotosBg, /255, 255, 255/, 'Photos is on the dark glass in Dark');
  assert.deepEqual(errors, []); await page.close();
});
