/* Piles (js/apps/finder.js): the Overview, the Piles view, search inside files with filters, Smart Piles, renaming many
   files at once, and the old folder views still working. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function seed(page) {
  await page.evaluate((px) => {
    PatOS.notify = () => {}; PatOS.setSetting('showWidgets', false);
    PatOS.fs.mkdir('/Documents/Trip'); PatOS.fs.write('/Documents/Trip/plan.txt', 'Flights to Lisbon, hotel near Alfama');
    PatOS.fs.write('/Documents/budget.csv', 'item,cost'); PatOS.fs.write('/Documents/Report.pdoc', '<p>Quarterly</p>');
    ['beach', 'tram', 'sunset'].forEach((n) => PatOS.fs.write('/Pictures/' + n + '.png', px));
    PatOS.fs.write('/Downloads/photos.zip', 'data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==');
  }, PX);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('opened on its own, Piles shows the Overview: recent files, piles by kind, storage, places; a folder still opens that folder', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true }); await seed(page);
  const r = await page.evaluate(async () => {
    const w = PatOS.launch('finder'); await new Promise((res) => setTimeout(res, 500));
    const piles = [...w.body.querySelectorAll('.fd-piles .fd-pile')].map((p) => p.querySelector('b').textContent + ':' + p.querySelector('small').textContent.split(' ')[0]);
    const recent = [...w.body.querySelectorAll('.fd-rc b')].map((x) => x.textContent);
    const legend = w.body.querySelectorAll('.fd-legend .fd-lg').length;
    const place = w._finder.place(); w.close();
    const w2 = PatOS.launch('finder', { path: '/Documents' }); await new Promise((res) => setTimeout(res, 400));
    return { place, piles, recent, legend, place2: w2._finder.place() };
  });
  assert.equal(r.place, 'overview');
  assert.ok(r.piles.includes('Pictures:3') && r.piles.includes('Archives:1') && r.piles.some((x) => /^Documents:/.test(x)), JSON.stringify(r.piles));
  assert.ok(r.recent.includes('photos.zip') && r.recent.includes('plan.txt'), 'recent files: ' + r.recent);
  assert.ok(r.legend >= 3, 'storage by kind');
  assert.equal(r.place2, '/Documents');
  // a pile opens everything of that kind, from every folder
  const k = await page.evaluate(async () => { const w = PatOS.wm.windows.find((x) => x.app.id === 'finder'); w._finder.go('kind:image'); await new Promise((res) => setTimeout(res, 300)); return [...w.body.querySelectorAll('.fd-main [data-path]')].map((e) => e.dataset.path).sort(); });
  assert.deepEqual(k, ['/Pictures/beach.png', '/Pictures/sunset.png', '/Pictures/tram.png']);
  assert.deepEqual(errors, []); await page.close();
});

test('the Piles view gathers a folder by kind or date, and a pile opens in place', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true }); await seed(page);
  await page.evaluate(async () => { const w = PatOS.launch('finder', { path: '/Documents' }); await new Promise((res) => setTimeout(res, 300)); w._finder.setView('piles'); });
  await page.waitForTimeout(300);
  assert.deepEqual(await page.$$eval('.fd-pile b', (e) => e.map((x) => x.textContent)), ['Folders', 'Documents']);
  await page.click('.fd-pile >> nth=1'); await page.waitForTimeout(300);
  assert.deepEqual(await page.$$eval('.fd-spread [data-path]', (e) => e.map((x) => x.dataset.path).sort()), ['/Documents/Report.pdoc', '/Documents/budget.csv']);
  await page.dblclick('.fd-spread [data-path="/Documents/budget.csv"]'); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => PatOS.wm.windows.some((w) => w.app.id !== 'finder')), true, 'double-clicking a file in an open pile opens it');
  await page.evaluate(() => { PatOS.wm.windows.filter((w) => w.app.id !== 'finder').forEach((w) => w.close()); });
  await page.click('.fd-pilebar .tab >> nth=1'); await page.waitForTimeout(300);
  assert.deepEqual(await page.$$eval('.fd-pile b', (e) => e.map((x) => x.textContent)), ['Today'], 'gathered by date');
  assert.equal(await page.evaluate(() => PatOS.store.get('pilesBy')), 'date', 'the choice is kept');
  assert.deepEqual(errors, []); await page.close();
});

test('search finds words inside files, filters by kind, date and place, and a Smart Pile keeps the search after a restart', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true }); await seed(page);
  const r = await page.evaluate(async () => {
    const w = PatOS.launch('finder', { path: '/Desktop' }); await new Promise((res) => setTimeout(res, 300));
    const paths = () => [...w.body.querySelectorAll('.fd-main [data-path]')].map((e) => e.dataset.path).sort();
    w._finder.search('alfama'); await new Promise((res) => setTimeout(res, 150)); const here = paths();
    w._finder.search('alfama', { scope: 'all' }); await new Promise((res) => setTimeout(res, 150)); const all = paths();
    const snippet = (w.body.querySelector('.fd-match') || {}).textContent || (w.body.querySelector('.fd-item') || {}).title || '';
    w._finder.search('', { kind: 'image', scope: 'all' }); await new Promise((res) => setTimeout(res, 150)); const pics = paths();
    w._finder.search('', { kind: 'all', when: 'today', scope: 'all' }); await new Promise((res) => setTimeout(res, 150)); const today = paths().length;
    w._finder.search('lisbon', { kind: 'doc', when: 'any', scope: 'all' }); await new Promise((res) => setTimeout(res, 150));
    return { here, all, snippet, pics, today, chips: w.body.querySelectorAll('.fd-filters .fd-chip').length };
  });
  assert.deepEqual(r.here, [], 'not on the Desktop');
  assert.deepEqual(r.all, ['/Documents/Trip/plan.txt'], 'found by what is written inside');
  assert.match(r.snippet, /Alfama/);
  assert.deepEqual(r.pics, ['/Pictures/beach.png', '/Pictures/sunset.png', '/Pictures/tram.png']);
  assert.ok(r.today >= 7); assert.ok(r.chips >= 12);
  // save it as a Smart Pile (the name dialog accepts the suggestion)
  await page.evaluate(() => { const w = PatOS.wm.windows[0]; w._finder.saveSmart(); }); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  const sp = await page.evaluate(() => PatOS.store.get('smartPiles'));
  assert.equal(sp.length, 1); assert.equal(sp[0].q, 'lisbon'); assert.equal(sp[0].filters.kind, 'doc');
  await page.waitForTimeout(400); await reload(page); await page.waitForSelector('#lock:not(.hidden)'); await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(700);
  const again = await page.evaluate(async () => {
    PatOS.wm.closeAll(); const w = PatOS.launch('finder'); await new Promise((res) => setTimeout(res, 400));
    const side = [...w.body.querySelectorAll('.fd-side .fd-si')].map((x) => x.textContent);
    const id = PatOS.store.get('smartPiles')[0].id; w._finder.go('smart:' + id); await new Promise((res) => setTimeout(res, 300));
    return { side, paths: [...w.body.querySelectorAll('.fd-main [data-path]')].map((e) => e.dataset.path) };
  });
  assert.ok(again.side.includes('lisbon'), 'the Smart Pile is in the sidebar');
  assert.deepEqual(again.paths, ['/Documents/Trip/plan.txt']);
  assert.deepEqual(errors, []); await page.close();
});

test('renaming many files: name and number, replace, add; tags follow; clashes are refused', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true }); await seed(page);
  await page.evaluate(async () => {
    PatOS.store.set('fileTags', { '/Pictures/tram.png': 'blue' });
    const w = PatOS.launch('finder', { path: '/Pictures' }); await new Promise((res) => setTimeout(res, 300));
    w._finder.renameMany(['/Pictures/beach.png', '/Pictures/tram.png', '/Pictures/sunset.png']);
  });
  await page.click('.fd-rmcard .seg .tab >> nth=2'); await page.keyboard.type('Lisbon'); await page.waitForTimeout(150);
  await page.click('.fd-rmb .btn.primary'); await page.waitForTimeout(400);
  const names = await page.evaluate(() => PatOS.fs.list('/Pictures').map((x) => x.name).sort());
  assert.deepEqual(names, ['Lisbon 1.png', 'Lisbon 2.png', 'Lisbon 3.png']);
  assert.equal(await page.evaluate(() => PatOS.store.get('fileTags')['/Pictures/Lisbon 2.png']), 'blue', 'the tag moved with the file');
  // replace text, and a clash is refused before anything changes
  await page.evaluate(() => PatOS.wm.windows[0]._finder.renameMany(['/Pictures/Lisbon 1.png', '/Pictures/Lisbon 2.png']));
  await page.waitForTimeout(200); await page.keyboard.type('Lisbon '); await page.waitForTimeout(100);
  await page.locator('.fd-rmf .field').nth(1).fill('Porto ');
  await page.waitForTimeout(150);
  assert.equal(await page.isDisabled('.fd-rmb .btn.primary'), false);
  await page.click('.fd-rmb .btn.primary'); await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(() => PatOS.fs.list('/Pictures').map((x) => x.name).sort()), ['Lisbon 3.png', 'Porto 1.png', 'Porto 2.png']);
  await page.evaluate(() => PatOS.wm.windows[0]._finder.renameMany(['/Pictures/Porto 1.png', '/Pictures/Porto 2.png']));
  await page.waitForTimeout(200); await page.keyboard.type('Porto 1'); await page.locator('.fd-rmf .field').nth(1).fill('Porto 2'); await page.waitForTimeout(100);
  assert.equal(await page.isDisabled('.fd-rmb .btn.primary'), true, 'two files would get the same name');
  assert.match(await page.textContent('.fd-rme'), /same name/);
  await page.click('.fd-rmcard .seg .tab >> nth=2'); await page.keyboard.type('Lisbon'); await page.locator('.fd-rml .field').fill('2'); await page.waitForTimeout(100);
  assert.equal(await page.isDisabled('.fd-rmb .btn.primary'), true, 'Lisbon 3.png is already there');
  assert.match(await page.textContent('.fd-rme'), /already there/);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []); await page.close();
});

test('Piles in French and on a phone', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); await boot(page, srv.base, { fresh: true }); await seed(page);
  await page.evaluate(() => PatOS.setSetting('language', 'fr')); await reload(page); await page.waitForSelector('#lock:not(.hidden)'); await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(600);
  const fr = await page.evaluate(async () => { const w = PatOS.launch('finder'); await new Promise((res) => setTimeout(res, 500)); return [w.title, [...w.body.querySelectorAll('.fd-ovh h2')].map((x) => x.textContent)]; });
  assert.equal(fr[0], 'Vue d’ensemble'); assert.ok(fr[1].includes('Vos piles'), JSON.stringify(fr));
  await page.close();
  const ctx = await b.newContext(Object.assign({}, require('../helpers').playwright().devices['iPhone 13']));
  const phone = await ctx.newPage(); const errors = await boot(phone, srv.base, { fresh: true }); await seed(phone);
  const m = await phone.evaluate(async () => { const w = PatOS.launch('finder'); await new Promise((res) => setTimeout(res, 600)); const r = w.body.querySelector('.fd-piles').getBoundingClientRect(); return { w: r.width, vw: innerWidth, piles: w.body.querySelectorAll('.fd-pile').length }; });
  assert.ok(m.piles >= 3 && m.w <= m.vw + 1, 'piles fit the phone: ' + JSON.stringify(m));
  assert.deepEqual(errors, []); await ctx.close();
});
