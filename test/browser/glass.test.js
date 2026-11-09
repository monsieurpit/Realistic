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
  assert.match(g.dock, /blur\(9px\)/, 'the Dock is the clear tier: ' + g.dock);
  assert.match(g.dock, /url\("?#lg-lens-\d+"?\)/, 'the Dock uses a lens made for its size: ' + g.dock);
  const filterOk = await page.evaluate((id) => { const f = document.getElementById(id); return !!(f && f.querySelector('feImage') && f.querySelector('feDisplacementMap')); }, g.lens.replace(/^url\(#|\)$/g, ''));
  assert.ok(filterOk, 'the lens filter exists: ' + g.lens);
  const alpha = Number((g.dockBg.match(/[\d.]+(?=\))/) || ['1'])[0]); assert.ok(alpha < 0.5, 'the Dock tint is transparent: ' + g.dockBg);
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
