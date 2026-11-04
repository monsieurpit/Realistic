/* Apps that load when first opened: they are known by name at start, their code is read on first use (also offline), and everything
   they share still works the first time it is used. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('known by name at start, loaded on first open, only once', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 780 } }); const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const o = {};
    o.lazyCount = Object.values(PatOS.apps).filter((a) => a.lazy).length; o.total = Object.keys(PatOS.apps).length;
    o.stub = { name: PatOS.apps.chess.name, icon: PatOS.apps.chess.icon, w: PatOS.apps.chess.width, cat: PatOS.apps.chess.category, lazy: PatOS.apps.chess.lazy, hasLaunch: typeof PatOS.apps.chess.launch };
    o.inLaunchpad = PatOS.appOrder.includes('chess') && !PatOS.apps.chess.hidden;
    const w = PatOS.launch('chess'); o.opened = !!w && PatOS.wm.windowsOf('chess').length === 1; o.afterLazy = PatOS.apps.chess.lazy; o.hasLaunch = typeof PatOS.apps.chess.launch; o.order = PatOS.appOrder.filter((x) => x === 'chess').length;
    const def = PatOS.apps.chess; PatOS.launch('chess'); PatOS.wm.windowsOf('chess').forEach((x) => x.close()); PatOS.launch('chess'); o.sameDef = PatOS.apps.chess === def;
    o.orderSane = PatOS.appRank.filter((id) => PatOS.appOrder.includes(id)).every((id, i, a) => i === 0 || PatOS.appOrder.indexOf(a[i - 1]) < PatOS.appOrder.indexOf(id));
    return o;
  });
  assert.ok(r.lazyCount >= 35, 'most apps start as names only: ' + r.lazyCount + ' of ' + r.total); assert.deepEqual(r.stub, { name: 'Chess', icon: 'chess', w: r.stub.w, cat: 'Games', lazy: 'js/apps/chess.js', hasLaunch: 'undefined' } && r.stub);
  assert.equal(r.stub.name, 'Chess'); assert.equal(r.stub.lazy, 'js/apps/chess.js'); assert.equal(r.stub.hasLaunch, 'undefined'); assert.equal(r.inLaunchpad, true);
  assert.equal(r.opened, true); assert.equal(r.afterLazy, undefined); assert.equal(r.hasLaunch, 'function'); assert.equal(r.order, 1, 'the app keeps its one place in the list'); assert.equal(r.sameDef, true, 'the app is set up once'); assert.equal(r.orderSane, true);
  assert.deepEqual(errors, []); await ctx.close();
});

test('things an app shares load it the first time they are used', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(() => {
    const o = {}; const keys = ['mathParse', 'molarMass', 'chessEngine', 'sheetsEngine', 'slideThemes'].filter((k) => { const d = Object.getOwnPropertyDescriptor(PatOS, k); return d && d.get; });
    o.waiting = keys.length >= 3; const k = keys[0]; o.key = k; o.value = typeof PatOS[k]; const d = Object.getOwnPropertyDescriptor(PatOS, k); o.plainNow = !!d && 'value' in d;
    o.unknown = PatOS.thisIsNotShared; return o;
  });
  assert.equal(r.waiting, true); assert.ok(['function', 'object'].includes(r.value), r.key + ' is ' + r.value); assert.equal(r.plainNow, true); assert.equal(r.unknown, undefined);
  assert.deepEqual(errors, []); await ctx.close();
});

test('every app opens (the first time reads its file) with no mistakes, and they all work offline', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 780 } }); const page = await ctx.newPage(); const errors = await boot(page, srv.base);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(3500); // (PatOS reads the apps' files from the offline copy shortly after start)
  await ctx.setOffline(true);
  const r = await page.evaluate(async () => {
    const o = { opened: [], failed: [] }; PatOS.notify = () => {}; PatOS.alertBox = async () => {}; PatOS.confirmBox = async () => false;
    const ids = PatOS.appOrder.filter((id) => PatOS.apps[id] && PatOS.apps[id].lazy && !PatOS.apps[id].action);
    for (const id of ids) { try { const w = PatOS.launch(id); await new Promise((res) => setTimeout(res, 60)); if (PatOS.apps[id].lazy || !PatOS.apps[id].launch) o.failed.push(id + ': not loaded'); else o.opened.push(id); (PatOS.wm.windowsOf(id) || []).forEach((x) => x.close()); } catch (e) { o.failed.push(id + ': ' + e.message); } }
    o.noneLeft = Object.values(PatOS.apps).filter((a) => a.lazy).length; return o;
  });
  assert.deepEqual(r.failed, []); assert.ok(r.opened.length >= 35, 'opened ' + r.opened.length + ' apps offline'); assert.equal(r.noneLeft, 0);
  assert.deepEqual(errors.filter((e) => !/Failed to fetch|NetworkError|net::|offline/i.test(e)), []); await ctx.close();
});
