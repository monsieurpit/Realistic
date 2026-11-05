/* System behaviour: offline start, windows coming back, alarms, search, and the phone's back button. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser, playwright } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('starts with no internet once it has loaded, and Docs still works', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage(); await boot(page, srv.base);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 }); await page.evaluate(() => PatOS.boot.login());
  const ok = await page.evaluate(() => { PatOS.fs.write('/Documents/Offline.pdoc', '<p>offline</p>'); const w = PatOS.launch('docs', { path: '/Documents/Offline.pdoc' }); return !!w && PatOS.isOffline(); });
  assert.ok(ok);
  await ctx.close();
});
test('open windows come back after a reload', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); await boot(page, srv.base);
  await page.evaluate(() => { PatOS.fs.write('/Documents/Essay.pdoc', '<h1>x</h1>'); PatOS.openFile('/Documents/Essay.pdoc'); PatOS.launch('settings', { pane: 'network' }); PatOS.launch('calculator'); });
  await page.waitForTimeout(1500); await page.evaluate(() => PatOS.session.snapshot());
  await reload(page); await page.waitForSelector('#lock:not(.hidden)'); await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(2500);
  const apps = await page.evaluate(() => PatOS.wm.windows.map((w) => w.app.id + (w.args.path || w.args.pane ? ':' + (w.args.path || w.args.pane) : '')).sort());
  assert.deepEqual(apps, ['calculator', 'docs:/Documents/Essay.pdoc', 'settings:network']);
  await page.close();
});
test('a timer rings, even with the Clock closed', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base);
  await page.evaluate(() => PatOS.alarms.schedule({ id: 't-test', kind: 'timer', at: Date.now() + 1500, title: 'Tea is ready' }));
  await page.waitForSelector('.al-card', { timeout: 6000 });
  assert.match(await page.textContent('.al-card'), /Tea is ready/);
  await page.click('.al-btn.stop'); await page.waitForTimeout(400);
  assert.equal(await page.locator('.al-card').count(), 0);
  await page.close();
});
test('Spotlight finds apps, settings and what is inside files', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base);
  await page.evaluate(() => PatOS.fs.write('/Documents/Lab.txt', 'The mitochondria is the powerhouse of the cell'));
  const q = async (text) => { await page.evaluate(() => PatOS.spotlight.show()); await page.fill('.sp-input', text); await page.waitForTimeout(200); return page.evaluate(() => [...document.querySelectorAll('.sp-res')].slice(0, 3).map((e) => e.textContent)); };
  assert.match((await q('setings'))[0], /System Settings/);
  assert.match((await q('mitochondria'))[0], /Lab\.txt/);
  assert.match((await q('wifi'))[0], /Network/);
  await page.close();
});
test('phone: back goes from a note to the list, then home', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(Object.assign({}, playwright().devices['iPhone 14 Pro Max'], { deviceScaleFactor: 1 })); const page = await ctx.newPage(); await boot(page, srv.base);
  await page.evaluate(() => { PatOS.store.set('notes', [{ id: 'a', title: 'Bio', body: '<div>Bio</div>', mtime: Date.now() }]); PatOS.launch('notes'); }); await page.waitForTimeout(600);
  await page.locator('.nt-item').first().click(); await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => document.querySelector('.window[data-app="notes"]').classList.contains('m-show-detail')));
  await page.goBack(); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => !document.querySelector('.window[data-app="notes"]').classList.contains('m-show-detail')));
  await page.goBack(); await page.waitForTimeout(600);
  assert.ok(await page.evaluate(() => window.PatOS && !document.documentElement.classList.contains('m-in-app')), 'back at the Home Screen, still in PatOS');
  await ctx.close();
});

test('pages that are not part of PatOS (the /apprequests review page, /docs) still open while the service worker runs', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage(); await boot(page, srv.base);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(async () => { const s = await PatOS.updateManager.ask({ patosVersion: true }, 3000); return s && s.installed; }, null, { timeout: 20000 });
  await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  for (const [path, text] of [['/apprequests', 'PatOS app requests'], ['/docs/APP-SDK.md', 'patapp']]) {
    const r = await page.goto(srv.base + path); assert.equal(r.status(), 200, path); assert.match(await page.content(), new RegExp(text, 'i'), path);
  }
  await page.goto(srv.base + '/'); await page.waitForFunction(() => window.PatOS && PatOS.fs); await ctx.close();
});
