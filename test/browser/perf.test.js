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
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('patos:setupDone', 'true'); localStorage.setItem('patos:seenWelcome', 'true'); localStorage.setItem('patos:settings', JSON.stringify({ live3d: false })); });
  await page.goto(srv.base + '/');
  await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 });
  await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => !!window.THREE), false, 'three.js should not load with a flat wallpaper');
  const r = await page.evaluate(async () => {
    const w = PatOS.launch('galaxy'); const waiting = !!w.body.querySelector('.app-loading');
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
