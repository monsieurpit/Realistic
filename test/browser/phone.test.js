/* iPhone: swiping up from the bar at the bottom leaves the app; a tap on the bar still reaches the app */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser, playwright } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('iPhone: swipe up from the bottom goes Home, a tap passes through', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(playwright().devices['iPhone 14 Pro Max']); const page = await ctx.newPage();
  const errors = await boot(page, srv.base, { fresh: true });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await page.evaluate(() => PatOS.launch('notes')); await page.waitForTimeout(900);
  const y0 = await page.evaluate(() => document.getElementById('m-indicator').getBoundingClientRect().top + 15);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('real-phone') && PatOS.mobile.front.app.id), 'notes');
  await touch('touchStart', 215, y0); for (let i = 1; i <= 8; i++) { await touch('touchMove', 215, y0 - i * 40); await page.waitForTimeout(12); } await touch('touchEnd');
  await page.waitForTimeout(900);
  assert.equal(await page.evaluate(() => PatOS.mobile.front), null, 'the app should be gone after the swipe');
  await page.evaluate(() => PatOS.launch('textedit')); await page.waitForTimeout(900);
  await page.evaluate((y) => { const ind = document.getElementById('m-indicator'); ind.style.pointerEvents = 'none'; const el = document.elementFromPoint(215, y); ind.style.pointerEvents = ''; el.addEventListener('click', () => { window.__hit = 1; }, { once: true }); }, y0);
  await touch('touchStart', 215, y0); await touch('touchEnd'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__hit), 1, 'a tap on the bar reaches the app');
  assert.equal(await page.evaluate(() => PatOS.mobile.front && PatOS.mobile.front.app.id), 'textedit');
  assert.deepEqual(errors, []);
  await ctx.close();
});
