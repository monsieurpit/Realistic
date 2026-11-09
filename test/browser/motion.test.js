/* PatOS 3 motion (js/wm.js, js/shell.js, js/apps/photos.js): one spring for everything, a Motion setting, panels that follow the
   pointer, and a photo that flies from its thumbnail into the viewer. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('one spring drives the motion, and the Motion setting changes how bouncy it is', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  const nat = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--spring').trim());
  assert.match(nat, /^linear\(0, /, 'a native spring curve: ' + nat.slice(0, 40));
  const peak = (s) => Math.max(...s.replace(/^linear\(|\)$/g, '').split(',').map((x) => parseFloat(x)));
  assert.ok(peak(nat) > 1, 'Natural settles past its end a little');
  await page.evaluate(() => PatOS.setSetting('motion', 'calm'));
  const calm = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--spring').trim());
  assert.ok(peak(calm) <= 1.01, 'Calm does not overshoot: ' + peak(calm));
  await page.evaluate(() => PatOS.setSetting('motion', 'playful'));
  const play = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--spring').trim());
  assert.ok(peak(play) > peak(nat), 'Playful bounces more');
  // a window opens on that spring
  const easing = await page.evaluate(() => { const w = PatOS.launch('notes'); const a = w.el.getAnimations()[0]; return a ? a.effect.getTiming().easing : ''; });
  assert.match(easing, /^linear\(/, 'windows open on the spring');
  assert.deepEqual(errors, []); await page.close();
});

test('Control Center follows a drag upward and closes; a small drag springs back', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); await boot(page, srv.base, { fresh: true });
  await page.click('#mb-cc'); await page.waitForSelector('#control-center:not(.hidden)'); await page.waitForTimeout(400);
  const box = await page.locator('#control-center').boundingBox();
  const sx = box.x + 8, sy = box.y + box.height - 8; // a gap between tiles, not a control
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 30, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => document.querySelector('#control-center').classList.contains('hidden')), false, 'a small drag springs back');
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 160, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => document.querySelector('#control-center').classList.contains('hidden')), true, 'a long drag closes it');
  await page.close();
});

test('a photo flies from its thumbnail into the viewer', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#e44'; x.fillRect(0, 0, 300, 200); PatOS.fs.write('/Pictures/fly.png', c.toDataURL()); PatOS.launch('photos'); });
  await page.waitForSelector('.ph-grid img, .ph-th img'); await page.waitForTimeout(500);
  await page.click('.ph-grid img, .ph-th img');
  const flew = await page.waitForFunction(() => { const img = document.querySelector('.ph-view:not(.hidden) .ph-stage img'); return img && img.getAnimations().length > 0; }, null, { timeout: 3000 }).then(() => true).catch(() => false);
  assert.equal(flew, true, 'the viewer image animates in from the thumbnail');
  assert.deepEqual(errors, []); await page.close();
});
