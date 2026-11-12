/* 3.2 beta 8: the lag and the black glass. An automatic speed guess never makes Liquid Glass flat; the lens on glass edges keeps
   the filters surfaces still use, belongs to one surface only and skips big ones; moving the pointer doesn't restyle windows;
   the Weather sky doesn't re-make its canvas every frame; Pat's small orbs stay still. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, page, errors;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); page = await b.newPage({ viewport: { width: 1440, height: 900 } }); errors = await boot(page, srv.base, { fresh: true }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('a slow-computer guess never turns Liquid Glass flat; only your own choice does', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(() => {
    const H = document.documentElement, real = PatOS.perf.slow; PatOS.setSetting('liquidGlass', true); PatOS.setSetting('glassRefraction', true);
    PatOS.perf.slow = () => true; PatOS.applyTheme();
    const auto = { on: H.classList.contains('lg-on'), flat: H.classList.contains('perf-light') || H.classList.contains('reduce-transparency'), lens: H.classList.contains('lg-refract') };
    PatOS.perf.slow = real; PatOS.applyTheme();
    return { auto, lensBack: H.classList.contains('lg-refract') === PatOS.glassLens.supported() };
  });
  assert.deepEqual(r.auto, { on: true, flat: false, lens: false }, 'the glass stays see-through; only the bend at the edges goes');
  assert.ok(r.lensBack);
});

test('the lens: one surface only, not on big ones, and in-use filters are never thrown away', { skip: skipNoBrowser }, async () => {
  if (!(await page.evaluate(() => PatOS.glassLens.supported()))) return;
  await page.evaluate(() => { PatOS.setSetting('glassRefraction', true); PatOS.applyTheme(); PatOS.pat.open(); }); await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const lab = document.querySelector('.dock-label'), dock = document.getElementById('dock');
    const out = { dock: !!dock.style.getPropertyValue('--lg-lens'), labelInherits: lab ? getComputedStyle(lab).getPropertyValue('--lg-lens').trim() : '', pat: document.getElementById('pat-panel').style.getPropertyValue('--lg-lens') };
    // 60 different sizes of glass come and go (windows, menus, notifications): the Dock's filter must survive
    const box = document.createElement('div'); box.className = 'lg'; box.style.cssText = 'position:fixed;left:10px;top:60px;border-radius:12px'; document.getElementById('desktop').appendChild(box);
    for (let i = 0; i < 60; i++) { box.style.width = (100 + i * 3) + 'px'; box.style.height = (60 + i) + 'px'; PatOS.glassLens.watch(box); }
    box.remove();
    const id = (dock.style.getPropertyValue('--lg-lens').match(/#(lg-lens-\d+)/) || [])[1];
    out.dockFilterAlive = !!(id && document.getElementById(id)); out.filters = document.querySelectorAll('filter[id^="lg-lens"]').length;
    return out;
  });
  assert.ok(r.dock, 'the Dock has its lens');
  assert.equal(r.labelInherits, '', 'its labels don’t inherit it');
  assert.equal(r.pat, '', 'Pat’s big panel keeps plain glass');
  assert.ok(r.dockFilterAlive, 'the Dock’s filter is still there (a missing one drew the glass black)');
  assert.ok(r.filters <= 45, 'old ones are cleaned up: ' + r.filters);
  await page.keyboard.press('Escape');
});

test('moving the pointer over a window does not restyle it; the Weather sky keeps its canvas', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => PatOS.launch('notes')); await page.waitForTimeout(700);
  const win = await page.$('.window'); const bb = await win.boundingBox();
  for (let i = 0; i < 20; i++) await page.mouse.move(bb.x + 60 + i * 8, bb.y + 120 + i * 4);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.window, .window *')].filter((e) => e.style.getPropertyValue('--mx')).length), 0);
  await page.evaluate(() => PatOS.launch('weather')); await page.waitForTimeout(1500);
  const resets = await page.evaluate(async () => { const c = document.querySelector('.wx-fx, .window canvas'); if (!c) return -1; let n = 0; const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'); Object.defineProperty(c, 'width', { get() { return d.get.call(this); }, set(v) { n++; d.set.call(this, v); }, configurable: true }); await new Promise((r) => setTimeout(r, 1000)); delete c.width; return n; });
  assert.ok(resets >= 0 && resets <= 1, 'the canvas was re-made ' + resets + ' times in a second');
});

test('Pat: only the orbs that say something move, and none while the panel is closed', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => PatOS.pat.open()); await page.waitForSelector('#pat-panel .pat3-in');
  for (let i = 0; i < 3; i++) { await page.fill('#pat-panel .pat3-in', 'what is the capital of Japan'); await page.press('#pat-panel .pat3-in', 'Enter'); await page.waitForTimeout(400); }
  const open = await page.evaluate(() => document.getAnimations().filter((a) => /^po[ABC]$/.test(a.animationName) && a.playState === 'running').length);
  assert.ok(open <= 3, 'only the header orb moves: ' + open);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.getAnimations().filter((a) => /^po/.test(a.animationName) && a.playState === 'running').length), 0);
  assert.deepEqual(errors, []);
});

test('older release notes are not loaded at start, and Software Update still shows them', { skip: skipNoBrowser }, async () => {
  const r0 = await page.evaluate(() => ({ newest: !!(PatOS.releases[0] && PatOS.releases[0].notes), older: PatOS.releases.slice(1).some((r) => r.notes), loaded: !!PatOS.releaseNotes }));
  assert.deepEqual(r0, { newest: true, older: false, loaded: false });
  await page.evaluate(() => PatOS.launch('settings', { pane: 'update' }));
  // (online, the history comes from the server with its notes; with no server answer, the older notes load from js/release-notes.js)
  await page.waitForFunction(() => document.querySelector('.su-history .su-old .su-notes li'), null, { timeout: 8000 });
  const off = await page.evaluate(() => new Promise((res) => { const sc = document.createElement('script'); sc.src = 'js/release-notes.js'; sc.onload = () => res(PatOS.releases.every((r) => r.notes)); sc.onerror = () => res('error'); document.head.appendChild(sc); }));
  assert.equal(off, true, 'the notes file puts every version’s notes back');
});

test('dragging a window slides it (and its shadow) without redrawing what is under it, then puts it in place', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => { PatOS.wm.windows.slice().forEach((w) => w.close()); PatOS.launch('notes'); }); await page.waitForTimeout(800);
  const tb = await (await page.$('.window .titlebar')).boundingBox(); const x0 = await page.evaluate(() => document.querySelector('.window').offsetLeft);
  await page.mouse.move(tb.x + tb.width / 2, tb.y + 10); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(tb.x + tb.width / 2 + i * 10, tb.y + 10 + i * 3);
  const mid = await page.evaluate(() => { const w = document.querySelector('.window'); return { translate: w.style.translate, ghost: !!document.querySelector('.win-ghost-shadow'), noShadow: getComputedStyle(w).boxShadow === 'none' }; });
  await page.mouse.up();
  const end = await page.evaluate(() => { const w = document.querySelector('.window'); return { left: w.offsetLeft, translate: w.style.translate, ghost: !!document.querySelector('.win-ghost-shadow'), shadow: getComputedStyle(w).boxShadow !== 'none' }; });
  assert.match(mid.translate, /px/); assert.ok(mid.ghost && mid.noShadow, 'the shadow moves on its own layer');
  assert.equal(end.translate, ''); assert.equal(end.ghost, false); assert.ok(end.shadow, 'the shadow is back on the window');
  assert.ok(Math.abs(end.left - (x0 + 100)) <= 2, 'the window ends where it was dropped: ' + end.left + ' vs ' + (x0 + 100));
});

test('on a phone, the home screen is not drawn behind an open app, and a 3D wallpaper pauses', { skip: skipNoBrowser }, async () => {
  const { devices } = require('playwright');
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); const errs = await boot(p, srv.base, { fresh: true });
  await p.evaluate(() => PatOS.launch('notes')); await p.waitForTimeout(900);
  const r = await p.evaluate(async () => { let paused = null; const tick = () => new Promise((res) => setTimeout(res, 20)); const real = PatOS.wallpaper.pause; PatOS.wallpaper.pause = (on) => { paused = on; return real(on); };
    const H = document.documentElement; const hidden = getComputedStyle(document.getElementById('m-home')).visibility;
    H.classList.add('m-peek'); await tick(); const peek = getComputedStyle(document.getElementById('m-home')).visibility; const pausedPeek = paused; H.classList.remove('m-peek'); await tick();
    return { hidden, peek, pausedPeek, pausedAgain: paused }; });
  assert.equal(r.hidden, 'hidden'); assert.equal(r.peek, 'visible', 'a swipe home shows it again');
  assert.equal(r.pausedPeek, false); assert.equal(r.pausedAgain, true, 'the wallpaper pauses while the app covers the screen');
  assert.deepEqual(errs, []); await ctx.close();
});
