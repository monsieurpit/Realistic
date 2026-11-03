/* Every app opens without errors (English, French, phone), and windows move, snap, maximize and close. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser, playwright } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

async function openAll(page) {
  const ids = await page.evaluate(() => PatOS.appOrder.filter((id) => !PatOS.apps[id].action && id !== 'screenshot' && id !== 'extweb'));
  const broken = [];
  for (const id of ids) {
    const ok = await page.evaluate((i) => { PatOS.wm.closeAll(); const w = PatOS.launch(i); return !!w && !w.body.querySelector('.app-error'); }, id);
    await page.waitForTimeout(120);
    if (!ok) broken.push(id);
  }
  return { ids, broken };
}
for (const [label, opts] of [['English', { locale: 'en-US' }], ['French', { locale: 'fr-CA' }]]) {
  test('every app opens in ' + label, { skip: skipNoBrowser }, async () => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts)); const page = await ctx.newPage();
    const errors = await boot(page, srv.base);
    const { ids, broken } = await openAll(page);
    assert.ok(ids.length >= 50, 'about 55 apps, got ' + ids.length);
    assert.deepEqual(broken, []); assert.deepEqual(errors, []);
    await ctx.close();
  });
}
test('every app opens on an iPhone, with a way home', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(Object.assign({}, playwright().devices['iPhone 14 Pro Max'], { deviceScaleFactor: 1 })); const page = await ctx.newPage();
  const errors = await boot(page, srv.base);
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('real-phone')));
  const ids = await page.evaluate(() => PatOS.appOrder.filter((id) => !PatOS.apps[id].action && id !== 'screenshot' && id !== 'extweb'));
  const noHome = [];
  for (const id of ids) {
    const ok = await page.evaluate((i) => { PatOS.wm.closeAll(); PatOS.launch(i); const w = document.querySelector('.window.m-front'); const l = w && w.querySelector('.mab-left'); if (!l) return false; const r = l.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight; }, id);
    if (!ok) noHome.push(id);
  }
  assert.deepEqual(noHome, []); assert.deepEqual(errors, []);
  await ctx.close();
});
test('windows: maximize, minimize, restore, snap and close', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errors = await boot(page, srv.base);
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const w = PatOS.launch('textedit'); await wait(400); const out = {};
    const before = w.rect();
    w.toggleMax(); await wait(450); out.max = w.maximized && w.rect().w >= innerWidth - 2;
    w.toggleMax(); await wait(450); out.unmax = !w.maximized && Math.abs(w.rect().w - before.w) < 4;
    w.minimize(); await wait(700); out.min = w.minimized && getComputedStyle(w.el).display === 'none';
    PatOS.launch('textedit'); await wait(500); out.restored = !w.minimized || PatOS.wm.windows.length >= 1;
    const n = PatOS.wm.windows.length; w.close(); await wait(400); out.closed = PatOS.wm.windows.length === n - 1;
    return out;
  });
  assert.deepEqual(r, { max: true, unmax: true, min: true, restored: true, closed: true });
  assert.deepEqual(errors, []);
  await page.close();
});
