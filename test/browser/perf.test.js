/* Speed: three.js is only loaded when something 3D shows, 3D apps still work, and the GPU never falls
   behind (a queue of unfinished frames made PatOS lag and take seconds to close). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('three.js waits until something 3D is needed', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage();
  await page.goto(srv.base + '/manifest.webmanifest');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('patos:setupDone', 'true'); localStorage.setItem('patos-policy', JSON.stringify({ version: '2026-11-09' })); localStorage.setItem('patos:seenWelcome', 'true'); localStorage.setItem('patos:settings', JSON.stringify({ live3d: false })); });
  await page.goto(srv.base + '/');
  await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 });
  await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => !!window.THREE), false, 'three.js should not load with a flat wallpaper');
  const r = await page.evaluate(async () => {
    const w = PatOS.launch('studio'); const waiting = !!w.body.querySelector('.app-loading');
    for (let i = 0; i < 50 && !w.body.querySelector('canvas'); i++) await new Promise((res) => setTimeout(res, 100));
    return { webgl: PatOS.webgl, waiting, three: !!window.THREE, canvas: !!w.body.querySelector('canvas'), error: !!w.body.querySelector('.app-error') };
  });
  if (r.webgl) assert.deepEqual(r, { webgl: true, waiting: true, three: true, canvas: true, error: false });
  await page.close();
});

test('the 3D wallpaper never builds up a queue of unfinished frames', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const on = await page.waitForFunction(() => document.getElementById('wallpaper3d').classList.contains('on'), null, { timeout: 15000 }).then(() => true, () => false);
  if (!on) return page.close(); // no WebGL in this browser
  await page.waitForTimeout(8000);
  const ms = await page.evaluate(() => { const c = document.getElementById('wallpaper3d'); const gl = c.getContext('webgl2'); const t = performance.now(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); return performance.now() - t; });
  assert.ok(ms < 1000, 'the GPU was ' + Math.round(ms) + ' ms behind');
  const t = Date.now(); await page.goto('about:blank'); assert.ok(Date.now() - t < 3000, 'closing PatOS took ' + (Date.now() - t) + ' ms');
  await page.close();
});

test('switching the 3D wallpaper off and on again works', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    for (let i = 0; i < 60 && !document.querySelector('#wallpaper3d.on'); i++) await wait(100);
    if (!document.querySelector('#wallpaper3d.on')) return 'no-webgl';
    PatOS.setSetting('live3d', false); await wait(200); const off = !document.querySelector('#wallpaper3d.on');
    PatOS.setSetting('live3d', true); await wait(500); PatOS.setSetting('wallpaper', 'waves'); await wait(500);
    return { off, on: !!document.querySelector('#wallpaper3d.on') };
  });
  if (r !== 'no-webgl') assert.deepEqual(r, { off: true, on: true });
  await page.close();
});

test('the Dock magnifies by scaling drawn icons (no re-layout per icon) and comes back to rest; the 3D wallpaper holds still during drags', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; PatOS.setSetting('magnify', true); document.querySelectorAll('.toast').forEach((t) => t.remove()); }); await page.waitForTimeout(600);
  const d = await page.locator('#dock').boundingBox();
  const rest = await page.evaluate(() => { const t = document.querySelector('#dock .dock-item .dock-icon > .icon-tile'); return { scale: getComputedStyle(t).scale, w: t.offsetWidth }; });
  for (let i = 0; i < 12; i++) { await page.mouse.move(d.x + d.width * .5 + i, d.y + d.height / 2); await page.waitForTimeout(30); }
  const heldWhileMoving = await page.evaluate(() => PatOS.wallpaper.held());
  await page.waitForTimeout(300);
  const hover = await page.evaluate(() => { const its = [...document.querySelectorAll('#dock .dock-item')]; const big = Math.max(...its.map((it) => +getComputedStyle(it.querySelector('.dock-icon > .icon-tile')).scale || 1)); return { big, held: PatOS.wallpaper.held(), slotMax: Math.max(...its.map((it) => it.querySelector('.dock-icon').offsetWidth)) }; });
  assert.ok(+rest.scale < 1, 'icons are drawn bigger and scaled down at rest (sharp when magnified): ' + rest.scale);
  assert.ok(hover.big > +rest.scale * 1.4, 'an icon grows under the pointer: ' + JSON.stringify(hover));
  assert.ok(hover.slotMax > await page.evaluate(() => PatOS.dockBase()) + 4, 'its slot widens so neighbours make room');
  assert.equal(heldWhileMoving, true, 'the wallpaper holds while the Dock magnifies');
  await page.mouse.move(d.x + 30, d.y - 300); await page.waitForTimeout(900);
  const back = await page.evaluate(() => [...document.querySelectorAll('#dock .dock-item .dock-icon')].every((ic) => Math.abs(ic.offsetWidth - PatOS.dockBase()) < 1));
  assert.equal(back, true, 'every icon is back to its size');
  assert.equal(await page.evaluate(() => PatOS.wallpaper.held()), false, 'and the wallpaper moves again');
  assert.deepEqual(errors, []); await page.close();
});

test('every icon in the Dock sits in its slot, web-app icons included', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; const id = Object.keys(PatOS.apps).find((k) => /^x-chatgpt/.test(k)); PatOS.setSetting('dockPinned', PatOS.settings.dockPinned.concat([id])); PatOS.dock.render(); });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => [...document.querySelectorAll('#dock .dock-item')].map((it) => {
    const slot = it.querySelector('.dock-icon').getBoundingClientRect(), tile = it.querySelector('.dock-icon > .icon-tile').getBoundingClientRect();
    return { app: it.dataset.app, dx: Math.round(Math.abs((tile.left + tile.width / 2) - (slot.left + slot.width / 2))), dy: Math.round(Math.abs(tile.bottom - slot.bottom)), w: Math.round(tile.width - slot.width) };
  }));
  const off = r.filter((x) => x.dx > 1 || x.dy > 1 || Math.abs(x.w) > 1);
  assert.ok(r.some((x) => /^x-chatgpt/.test(x.app)), 'the web app is in the Dock');
  assert.deepEqual(off, [], 'icons out of their slot');
  assert.deepEqual(errors, []); await page.close();
});
