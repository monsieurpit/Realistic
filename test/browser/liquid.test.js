/* Liquid Glass refinement (roadmap Task 14), closer to Apple's Liquid Glass without changing how clear it is:
   - menus grow out of the control that opened them and go back into it
   - the selection of a segmented control is a drop of glass: it stretches toward the tab you pick, then catches up
   - interactive glass: a press lights the glass up from where you press, and the light fades after you let go
   - the glass is exactly as clear as before (same tints and blurs): this test guards it */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, ctx, page;
test.before(async () => {
  if (skipNoBrowser) return; srv = await startServer(); b = await browser();
  ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); page = await ctx.newPage();
  await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; });
});
test.after(async () => { if (ctx) await ctx.close(); if (b) await b.close(); if (srv) srv.stop(); });

test('the glass stays exactly as clear: same tints and blurs on the Dock, tiles, widgets and menus', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    PatOS.panels.toggle('#control-center'); await new Promise((res) => setTimeout(res, 500));
    const read = (sel) => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e); return { t: c.getPropertyValue('--g-t').trim(), b: c.getPropertyValue('--g-b').trim(), bf: c.backdropFilter }; };
    const out = { dock: read('#dock'), tile: read('#control-center .cc-tile'), widget: read('#desk-widgets .widget') };
    PatOS.panels.toggle('#control-center');
    return out;
  });
  // (the values the glass had before Task 14; dark theme, dark wallpaper)
  const px = (v) => parseFloat(String(v).match(/blur\(([\d.]+)px\)/)[1]);
  assert.ok(px(r.dock.bf) <= 0.6, 'the Dock barely blurs: ' + r.dock.bf);
  assert.ok(px(r.tile.bf) <= 0.7, 'Control Center tiles barely blur: ' + r.tile.bf);
  if (r.widget) assert.ok(px(r.widget.bf) <= 0.7, 'widgets barely blur: ' + r.widget.bf);
  const alpha = (c) => { const m = /rgba\(([^)]+)\)/.exec(c); return m ? parseFloat(m[1].split(',')[3]) : 1; };
  assert.ok(alpha(r.tile.t) <= 0.05, 'tiles are near-clear: ' + r.tile.t);
  // and a touch that ended leaves no light behind
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#dock')).backgroundImage);
  assert.match(bg, /^radial-gradient\(circle[^,]*, rgba\(255, 255, 255, 0\), rgba\(255, 255, 255, 0\) 40%/, 'no touch light at rest: ' + bg.slice(0, 120));
});

test('a menu grows out of the control that opened it, and goes back into it', { skip: skipNoBrowser }, async () => {
  await page.click('.mb-logo');
  const r = await page.evaluate(async () => {
    const m = document.querySelector('#menu-layer .menu');
    const a = m.getAnimations().find((x) => x.effect && x.effect.getKeyframes()[0].transform);
    const first = a ? a.effect.getKeyframes()[0].transform : '';
    await new Promise((res) => setTimeout(res, 600));
    PatOS.closeMenus();
    const leaving = document.querySelector('#menu-leave-layer .menu-leaving');
    // a new menu opened at once is the one found (not the one leaving)
    PatOS.menu([{ label: 'Second', action() {} }], 300, 300);
    const found = document.querySelector('.menu').textContent;
    await new Promise((res) => setTimeout(res, 400));
    PatOS.closeMenus(); await new Promise((res) => setTimeout(res, 400));
    return { first, morph: m.classList.contains('menu-morph'), leaving: !!leaving, found, left: document.querySelectorAll('#menu-leave-layer > *').length };
  });
  assert.equal(r.morph, true);
  const sc = /scale\(([\d.]+), ([\d.]+)\)/.exec(r.first);
  assert.ok(sc && +sc[1] < 0.6 && +sc[2] < 0.3, 'it starts the size of the logo button: ' + r.first);
  assert.equal(r.leaving, true, 'on close it goes back into the button');
  assert.match(r.found, /Second/);
  assert.equal(r.left, 0, 'and is gone after');
});

test('a segmented control’s selection stretches like a drop of glass on its way to the new tab', { skip: skipNoBrowser }, async () => {
  await page.evaluate(async () => { PatOS.wm.closeAll(); PatOS.store.set('calMode', 'month'); PatOS.launch('calendar'); await new Promise((res) => setTimeout(res, 1000)); });
  const tabs = await page.$$('.window .seg .tab');
  await tabs[0].click();
  const r = await page.evaluate(async () => {
    await new Promise((res) => setTimeout(res, 40));
    const g = document.querySelector('.window .seg .seg-glide'); if (!g) return null;
    const k = g.getAnimations()[0].effect.getKeyframes();
    return k.map((f) => parseFloat(f.width));
  });
  assert.ok(r && r.length === 3, 'three steps: ' + JSON.stringify(r));
  assert.ok(r[1] > r[0] * 1.5 && r[1] > r[2] * 1.5, 'it stretches across in the middle: ' + JSON.stringify(r));
  await page.evaluate(() => PatOS.wm.closeAll());
});

test('pressing glass lights it up from where you press, and the light fades after', { skip: skipNoBrowser }, async () => {
  await page.evaluate(async () => { PatOS.panels.toggle('#control-center'); await new Promise((res) => setTimeout(res, 500)); });
  const box = await page.evaluate(() => { const r = document.querySelectorAll('#control-center .cc-tile')[2].getBoundingClientRect(); return [r.left + r.width * 0.8, r.top + r.height * 0.3]; });
  await page.mouse.move(box[0], box[1]); await page.mouse.down(); await page.waitForTimeout(250);
  const pressed = await page.evaluate(() => { const e = document.querySelectorAll('#control-center .cc-tile')[2]; const c = getComputedStyle(e); return { touch: parseFloat(c.getPropertyValue('--g-touch')), tx: e.style.getPropertyValue('--g-tx'), ty: e.style.getPropertyValue('--g-ty') }; });
  await page.mouse.up(); await page.waitForTimeout(800);
  const after = await page.evaluate(() => { const e = document.querySelectorAll('#control-center .cc-tile')[2]; return { touch: parseFloat(getComputedStyle(e).getPropertyValue('--g-touch')), anims: e.getAnimations().filter((a) => a.effect && a.effect.getKeyframes().some((k) => '--g-touch' in k)).length }; });
  await page.evaluate(() => PatOS.panels.toggle('#control-center'));
  assert.ok(pressed.touch > 0.9, 'lit while pressed: ' + JSON.stringify(pressed));
  assert.match(pressed.tx, /^(7\d|8\d)/, 'from where it was pressed: ' + pressed.tx);
  assert.equal(after.touch, 0, 'dark again after');
  assert.equal(after.anims, 0, 'and nothing left running');
});

test('with Fewer animations, menus open without growing and nothing lights up', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    PatOS.setSetting('reduceMotion', true); await new Promise((res) => setTimeout(res, 300));
    const m = PatOS.menu([{ label: 'X', action() {} }], 200, 200);
    const morph = m.classList.contains('menu-morph'); PatOS.closeMenus();
    const gone = !document.querySelector('.menu');
    PatOS.setSetting('reduceMotion', false);
    return { morph, gone };
  });
  assert.deepEqual(r, { morph: false, gone: true });
});
