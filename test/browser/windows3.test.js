/* PatOS 3 smarter windows (js/wm.js): snap layouts (a picker at the top while dragging), window groups (save and reopen a set
   of windows) and stage focus (the active window centered, the others as thumbnails on the left). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('dragging a window to the top opens the layout picker; dropping on a zone gives the window exactly that place', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.setSetting('showWidgets', false); PatOS.launch('notes'); }); await page.waitForTimeout(800);
  const tb = await page.locator('.window .titlebar').first().boundingBox();
  await page.mouse.move(tb.x + 200, tb.y + 20); await page.mouse.down(); await page.mouse.move(tb.x + 220, 120, { steps: 6 });
  assert.equal(await page.evaluate(() => document.querySelector('#snap-picker').classList.contains('show')), true, 'the picker opens near the top');
  assert.equal(await page.$$eval('#snap-picker .sl-box', (e) => e.length), 5, 'halves, thirds, two thirds, quarters, full');
  const c = await page.$eval('#snap-picker .sl-box:nth-child(4) .sl-cell:nth-child(4)', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.mouse.move(c[0], c[1], { steps: 6 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const w = PatOS.wm.windows[0], a = PatOS.wm.workArea(); return { x: w.el.offsetLeft / a.w, y: (w.el.offsetTop - a.y) / a.h, w: w.el.offsetWidth / a.w, h: w.el.offsetHeight / a.h }; });
  assert.ok(Math.abs(r.x - .5) < .02 && Math.abs(r.y - .5) < .02 && Math.abs(r.w - .5) < .02 && Math.abs(r.h - .5) < .02, 'the bottom-right quarter: ' + JSON.stringify(r));
  assert.equal(await page.evaluate(() => document.querySelector('#snap-picker').classList.contains('show')), false, 'the picker closes');
  assert.deepEqual(errors, []); await page.close();
});

test('a window group reopens the same apps in the same places; stage focus puts the active window in the middle and puts everything back after', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.setSetting('showWidgets', false); PatOS.launch('notes'); PatOS.launch('calendar'); PatOS.launch('calculator'); }); await page.waitForTimeout(1200);
  const before = await page.evaluate(() => PatOS.wm.windows.map((w) => w.app.id + '@' + w.el.offsetLeft + ',' + w.el.offsetTop).sort());
  await page.evaluate(() => { PatOS.wm.groups.save('Homework'); PatOS.wm.closeAll(); }); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => PatOS.wm.windows.length), 0);
  assert.equal(await page.evaluate(() => PatOS.wm.groups.open('Homework')), 3); await page.waitForTimeout(1200);
  assert.deepEqual(await page.evaluate(() => PatOS.wm.windows.map((w) => w.app.id + '@' + w.el.offsetLeft + ',' + w.el.offsetTop).sort()), before, 'same apps, same places');
  // stage focus
  await page.evaluate(() => PatOS.wm.stage(true)); await page.waitForTimeout(700);
  assert.equal(await page.$$eval('.window.stage-thumb', (e) => e.length), 2, 'the two others are thumbnails');
  const main = await page.evaluate(() => { const w = PatOS.wm.active, a = PatOS.wm.workArea(); return { left: w.el.offsetLeft, wide: w.el.offsetWidth / a.w, thumb: w.el.classList.contains('stage-thumb') }; });
  assert.ok(main.wide > .7 && !main.thumb && main.left > 100, 'the active window takes the stage: ' + JSON.stringify(main));
  const id = await page.evaluate(() => { const t = document.querySelector('.window.stage-thumb'); return t.dataset.app; });
  await page.click('.window.stage-thumb'); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => PatOS.wm.active.app.id), id, 'clicking a thumbnail brings it on stage');
  await page.evaluate(() => PatOS.wm.stage(false)); await page.waitForTimeout(600);
  assert.equal(await page.$$eval('.window.stage-thumb', (e) => e.length), 0);
  assert.deepEqual(await page.evaluate(() => PatOS.wm.windows.map((w) => w.app.id + '@' + w.el.offsetLeft + ',' + w.el.offsetTop).sort()), before, 'everything goes back where it was');
  assert.deepEqual(errors, []); await page.close();
});
