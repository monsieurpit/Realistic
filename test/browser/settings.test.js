/* Settings: an account card on top, then groups (General, ...); a group opens a list of its settings; the card shows the person and the computer. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('groups in the sidebar open lists of settings, and each setting opens with a way back', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1200, height: 780 } }); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => PatOS.launch('settings', { cat: 'general' })); await page.waitForSelector('.st-side .st-card');
  const side = await page.$$eval('.st-side .st-si', (els) => els.map((e) => e.textContent.trim()));
  assert.equal(side.length, 6, side.join('|'));
  assert.match(side.join('|'), /General/); assert.match(side.join('|'), /Appearance & Display/); assert.match(side.join('|'), /Privacy & Security/);
  const rows = await page.$$eval('.st-main .st-link', (els) => els.map((e) => e.textContent));
  assert.ok(rows.some((x) => /Network/.test(x)) && rows.some((x) => /Software Update/.test(x)), rows.join('|'));
  await page.click('.st-main .st-link:has-text("Network")'); await page.waitForSelector('.st-back');
  assert.match(await page.textContent('.st-main h1'), /Network/); assert.match(await page.textContent('.st-back'), /General/);
  await page.click('.st-back'); assert.ok(await page.locator('.st-main .st-link').count() >= 6);
  await page.click('.st-side .st-si:has-text("Appearance")'); assert.ok(await page.locator('.st-main .st-link:has-text("Wallpaper")').count() === 1);
  assert.deepEqual(errors, []); await page.close();
});

test('the account card shows the user and this computer; opening a setting directly still works', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1200, height: 780 } }); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => PatOS.launch('settings')); await page.waitForSelector('.st-card');
  await page.click('.st-card'); await page.waitForSelector('.st-me');
  const t = await page.textContent('.st-main');
  assert.match(t, /Account Info/); assert.match(t, /You/); assert.match(t, /Not signed in/); assert.match(t, /This computer/); assert.match(t, /Browser/);
  await page.evaluate(() => PatOS.launch('settings', { pane: 'privacy' })); await page.waitForTimeout(300);
  assert.match(await page.textContent('.st-back'), /Privacy & Security/);
  await page.fill('.st-search', 'wallpaper'); assert.ok(await page.locator('.st-side .st-si').count() >= 1); assert.match(await page.textContent('.st-side .st-si'), /Wallpaper/);
  await page.screenshot({ path: '/tmp/claude-0/-home-user/fea9efca-5d96-5e50-9835-94056e091100/scratchpad/settings.png' });
  assert.deepEqual(errors, []); await page.close();
});
