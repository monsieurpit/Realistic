/* 3.2: Settings opens right on a setting (from Spotlight, Pat or its own search), the new pages work (Applications,
   Notifications, Pat & Intelligence, Diagnostics), and Spotlight does commands and finds settings, shortcuts and events. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const spot = async (page, text) => { await page.evaluate(() => PatOS.spotlight.show()); await page.fill('.sp-input', text); await page.waitForTimeout(250); return page.evaluate(() => [...document.querySelectorAll('.sp-res')].map((e) => e.textContent)); };

test('Spotlight: "reduce motion" finds the exact setting and opens Settings right on it; commands run through PatOS Intelligence', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  const res = await spot(page, 'reduce motion');
  assert.ok(res.some((x) => /Reduce motion/.test(x)), res.join('|'));
  await page.click('.sp-res:has-text("Reduce motion")');
  await page.waitForSelector('.st-found', { timeout: 5000 });
  assert.match(await page.textContent('.st-main h1'), /Accessibility/); assert.match(await page.textContent('.st-found'), /Reduce motion/);
  // a command: the first result does it, and says so
  const res2 = await spot(page, 'create a folder called Spot Folder');
  assert.match(res2[0], /Create a folder called Spot Folder/); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => PatOS.fs.isDir('/Documents/Spot Folder')), true);
  // shortcuts and calendar events are found too
  await page.evaluate(() => { PatOS.shortcuts.save({ name: 'Homework Hour', steps: [{ type: 'command', p: { text: 'open notes' } }] }); const c = PatOS.store.get('calendar', {}) || {}; c[PatOS.dateKey(new Date())] = [{ id: 'e1', title: 'Dentist visit', time: '14:00' }]; PatOS.store.set('calendar', c); });
  assert.ok((await spot(page, 'homework hour')).some((x) => /Homework Hour/.test(x)));
  assert.ok((await spot(page, 'dentist')).some((x) => /Dentist visit/.test(x)));
  assert.ok((await spot(page, 'motion reduce')).some((x) => /Reduce motion/.test(x)), 'words in any order');
  assert.deepEqual(errors, []); await page.close();
});

test('Settings search lists single settings; the new pages work and change real things', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => PatOS.launch('settings')); await page.waitForSelector('.st-search');
  await page.fill('.st-side .st-search', 'volume'); await page.waitForTimeout(150);
  assert.ok(await page.locator('.st-si-one:has-text("Volume")').count() === 1);
  await page.click('.st-si-one:has-text("Volume")'); await page.waitForSelector('.st-found', { timeout: 4000 });
  // Applications: silence an app's notifications for real
  await page.evaluate(() => PatOS.launch('settings', { pane: 'apps' })); await page.waitForSelector('.st-apps');
  await page.click('.st-apps .st-link:has-text("Calendar")'); await page.waitForSelector('.st-apps h2.st-sub');
  await page.click('.st-apps .st-row:has-text("Notifications") .switch');
  const muted = await page.evaluate(() => { const before = document.querySelectorAll('.toast:not(.static)').length; PatOS.notify({ title: 'Muted?', body: 'x', icon: 'calendar' }); return { list: PatOS.settings.mutedApps, banner: document.querySelectorAll('.toast:not(.static)').length - before, kept: PatOS.notifications.list()[0].title }; });
  assert.deepEqual(muted, { list: ['calendar'], banner: 0, kept: 'Muted?' });
  // Pat & Intelligence: turning a kind off really stops it
  await page.evaluate(() => PatOS.launch('settings', { pane: 'intelligence' })); await page.waitForSelector('.st-ws');
  await page.click('.st-main .st-row:has-text("Change settings") .switch');
  assert.equal(await page.evaluate(() => PatOS.intel.respond('turn on bold text').status), 'denied');
  assert.match(await page.textContent('.st-main'), /What you can ask[\s\S]*create a folder called Projects/);
  // Diagnostics: health, a check, and the report reviewed before it leaves (no private things in it)
  await page.evaluate(() => { PatOS.fs.write('/Documents/Secret diary.txt', 'my secret words'); PatOS.errors.report(new Error('test failure in /Documents/Secret diary.txt'), 'test'); PatOS.launch('settings', { pane: 'diagnostics' }); });
  await page.waitForSelector('.st-main .st-badge');
  assert.match(await page.textContent('.st-main'), /System health[\s\S]*Your files[\s\S]*Healthy at start-up/);
  await page.click('.st-main .st-row:has-text("Check your files") .btn'); await page.waitForFunction(() => /No problems found/.test(document.querySelector('.st-main').textContent), null, { timeout: 8000 });
  await page.click('.st-main .st-row:has-text("Make a report") .btn'); await page.waitForSelector('.diag-pre', { timeout: 8000 });
  const rep = await page.textContent('.diag-pre');
  assert.match(rep, /"patos"[\s\S]*"files"[\s\S]*"problems"/); assert.ok(!rep.includes('Secret diary') && !rep.includes('my secret words'), 'no file names or contents'); assert.match(rep, /\[path\]/);
  assert.deepEqual(errors, []); await page.close();
});
