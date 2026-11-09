/* Liquid Glass (css/glass.css, js/shell.js): one material system with three tiers, a lens on the Dock's edges in Chromium,
   a menu bar that reads the wallpaper under it, glass titlebars over opaque window contents, and every way to turn it down. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

const look = (page) => page.evaluate(() => {
  const cs = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };
  const win = document.querySelector('.window:not(.tb-hidden)');
  return {
    cls: document.documentElement.className, wpTop: document.documentElement.dataset.wpTop || null,
    dock: cs('#dock').backdropFilter, dockBg: cs('#dock').backgroundColor, lens: document.querySelector('#dock').style.getPropertyValue('--lg-lens'),
    menubarColor: cs('#menubar').color,
    window: win ? getComputedStyle(win).backdropFilter : null, titlebar: win ? getComputedStyle(win.querySelector('.titlebar')).backdropFilter : null,
    body: win ? getComputedStyle(win.querySelector('.win-body')).backgroundImage : null
  };
});

test('the glass is see-through, the Dock bends at its edges, and only titlebars (not whole windows) blur', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => PatOS.launch('textedit')); await page.waitForSelector('.window .titlebar'); await page.waitForTimeout(400);
  const g = await look(page);
  assert.match(g.cls, /\blg-on\b/); assert.match(g.cls, /\blg-refract\b/, 'Chromium gets the lens');
  assert.match(g.dock, /blur\(0px\)/, 'the Dock is the clear tier (unblurred, like iOS): ' + g.dock);
  assert.match(g.dock, /saturate\(1\.06\) brightness\(1\.05\)/, 'the clear tier\'s own look wins over the shared rule: ' + g.dock);
  assert.match(g.dock, /url\("?#lg-lens-\d+"?\)/, 'the Dock uses a lens made for its size: ' + g.dock);
  const filterOk = await page.evaluate((id) => { const f = document.getElementById(id); return !!(f && f.querySelector('feImage') && f.querySelector('feDisplacementMap')); }, g.lens.replace(/^url\(#|\)$/g, ''));
  assert.ok(filterOk, 'the lens filter exists: ' + g.lens);
  const alpha = Number((g.dockBg.match(/[\d.]+(?=\))/) || ['1'])[0]); assert.ok(alpha <= 0.06, 'the Dock tint is transparent: ' + g.dockBg);
  assert.equal(g.window, 'none', 'a window does not blur everything behind it');
  assert.match(g.titlebar, /blur/, 'its titlebar is glass');
  assert.match(g.body, /linear-gradient/, 'its contents sit on an opaque layer');
  assert.deepEqual(errors, []); await page.close();
});

test('the menu bar follows the wallpaper under it, not the theme', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.setSetting('theme', 'dark'); PatOS.setSetting('wallpaper', 'sunrise'); }); await page.waitForTimeout(400);
  let g = await look(page); assert.equal(g.wpTop, 'light'); assert.equal(g.menubarColor, 'rgb(17, 17, 17)', 'dark words over a light picture, even in dark mode');
  await page.evaluate(() => { PatOS.setSetting('theme', 'light'); PatOS.setSetting('wallpaper', 'midnight'); }); await page.waitForTimeout(400);
  g = await look(page); assert.equal(g.wpTop, 'dark'); assert.equal(g.menubarColor, 'rgb(255, 255, 255)', 'white words over a dark picture, even in light mode');
  await page.close();
});

test('Tinted, Reduce transparency, the system preference, and Liquid Glass off all work and are in Settings', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => PatOS.setSetting('glassStyle', 'tinted')); let g = await look(page);
  assert.match(g.cls, /\blg-tinted\b/); const alpha = Number((g.dockBg.match(/[\d.]+(?=\))/) || ['0'])[0]); assert.ok(alpha > 0.3, 'tinted is thicker: ' + g.dockBg);
  await page.evaluate(() => PatOS.setSetting('reduceTransparency', true)); g = await look(page);
  assert.equal(g.dock, 'none', 'no blur with Reduce transparency'); assert.doesNotMatch(g.cls, /\blg-refract\b/);
  await page.evaluate(() => PatOS.setSetting('reduceTransparency', false));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100); g = await look(page);
  assert.match(g.cls, /\breduce-motion\b/, 'the system asking for less motion counts');
  await page.evaluate(() => PatOS.setSetting('liquidGlass', false)); g = await look(page);
  assert.doesNotMatch(g.cls, /\blg-on\b/); assert.equal(g.lens, '', 'no lens without Liquid Glass');
  await page.evaluate(() => { PatOS.setSetting('liquidGlass', true); PatOS.launch('settings', { pane: 'appearance' }); });
  await page.waitForSelector('.st-main h3:has-text("Liquid Glass")');
  const labels = await page.$$eval('.st-main .st-row .st-rl span', (els) => els.map((e) => e.textContent.trim()));
  for (const l of ['Liquid Glass', 'Glass style', 'Lens edges', 'Reduce transparency']) assert.ok(labels.includes(l), l + ' in ' + labels.join('|'));
  assert.ok(!labels.includes(''), 'no setting without a name');
  assert.deepEqual(errors, []); await page.close();
});

test('a notification does not cover an open Control Center', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); await boot(page, srv.base, { fresh: true });
  await page.click('#mb-cc'); await page.waitForSelector('#control-center:not(.hidden)');
  await page.evaluate(() => PatOS.notify({ title: 'Hello', body: 'Over the panel?', icon: 'notes' })); await page.waitForTimeout(700);
  const [cc, t] = await page.evaluate(() => [document.querySelector('#control-center').getBoundingClientRect().toJSON(), document.querySelector('#toasts .toast').getBoundingClientRect().toJSON()]);
  assert.ok(t.right <= cc.left + 1, 'the toast is beside the panel: ' + JSON.stringify({ cc, t }));
  await page.close();
});

test('every glass surface is a thick pane: Control Center tiles and menus get a lens, and their rim takes the color behind them', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.click('#mb-cc'); await page.waitForSelector('#control-center:not(.hidden) .cc-tile'); await page.waitForTimeout(400);
  const tile = await page.evaluate(() => { const t = document.querySelector('#control-center .cc-tile'); const id = t.style.getPropertyValue('--lg-lens').replace(/^url\(#|\)$/g, ''); const f = document.getElementById(id);
    return { lens: t.style.getPropertyValue('--lg-lens'), bf: getComputedStyle(t).backdropFilter, boost: f ? f.querySelectorAll('feColorMatrix').length : -1, slopes: f ? Array.from(f.querySelectorAll('feComponentTransfer feFuncR')).map((e) => Number(e.getAttribute('slope'))) : [],
      masks: f ? f.querySelectorAll('feImage').length : 0, flood: f && f.querySelector('feFlood').getAttribute('flood-color'), after: getComputedStyle(t, '::after').content }; });
  assert.match(tile.lens, /^url\(#lg-lens-\d+\)$/, 'a tile has its own lens');
  assert.match(tile.bf, /url\(/, 'and uses it: ' + tile.bf);
  assert.equal(tile.boost, 0, 'no color is boosted or added: the glass is the color of what is behind');
  assert.ok(tile.slopes.some((v) => v < 1) && tile.slopes.some((v) => v > 1), 'the bevel shows the same background, deeper at the bottom and lighter at the top: ' + tile.slopes);
  assert.equal(tile.masks, 3, 'one picture bends, two say where the bevel is deeper (bottom) and lighter (top)');
  assert.equal(tile.flood, 'rgb(128,128,128)', 'where the map is missing nothing moves (no flashing bar)');
  assert.equal(tile.after, 'none', 'with the lens, nothing is painted on the bevel (it stays clear glass)');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#control-center .cc-tile.cc-slider')).borderTopLeftRadius), '999px', 'a slider tile is a pill');
  await page.keyboard.press('Escape'); await page.click('.mb-logo'); await page.waitForSelector('.menu'); await page.waitForTimeout(300);
  assert.match(await page.evaluate(() => document.querySelector('.menu').style.getPropertyValue('--lg-lens')), /lg-lens/, 'a menu that just opened gets a lens too');
  assert.deepEqual(errors, []); await page.close();
});

test('one fixed light for all the glass, readable words over busy pictures, and glass that sinks when pressed', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  // the light leans toward the pointer
  const angle = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--g-angle').trim());
  await page.mouse.move(20, 400); await page.waitForTimeout(50); const left = await angle();
  await page.mouse.move(1260, 400); await page.waitForTimeout(50); const right = await angle();
  assert.equal(left, '150deg'); assert.equal(right, '150deg', 'the light stays put (a moving light made the rims jump)');
  // a smooth wallpaper is not busy; a picture full of fine detail is, and glass with words thickens over it
  await page.evaluate(() => PatOS.setSetting('wallpaper', 'sunrise')); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.wpBusy || null), null);
  const busy = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 960; c.height = 640; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 960, 640); x.fillStyle = '#000'; for (let i = 0; i < 960; i += 20) for (let j = 0; j < 640; j += 20) if ((i + j) % 40 === 0) x.fillRect(i, j, 20, 20); return c.toDataURL('image/png'); });
  await page.evaluate((u) => { PatOS.setSetting('customWallpaper', u); PatOS.setSetting('wallpaper', 'custom'); }, busy); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.wpBusy || null), '1');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--g-blur').trim()), '4px');
  // pressing a Control Center tile pushes it in: the shade moves inside the top edge
  await page.click('#mb-cc'); await page.waitForSelector('#control-center:not(.hidden) .cc-tile'); await page.waitForTimeout(300);
  // (the pressed state is forced through the DevTools protocol: a real held click is flaky, because Control Center can redraw
  // its tiles while the button is down, and a redrawn tile is no longer the one being pressed)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#control-center .cc-tile.cc-slider' });
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] }); await page.waitForTimeout(500);
  const pressed = await page.evaluate(() => getComputedStyle(document.querySelector('#control-center .cc-tile.cc-slider')).boxShadow);
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  assert.match(pressed, /^rgba\(0, 0, 0, 0\.22\) 0px 3px 8px 0px inset/, 'pressed in: ' + pressed);
  assert.deepEqual(errors, []); await page.close();
});
