/* Core reliability (roadmap Task 3): the event bus, window lifecycle, app start-up and error handling.
   - every failure is written down in one place (PatOS.errors), kept across a reload, never synced
   - a listener that throws does not stop the others; the same listener added twice runs once
   - an app that fails to start (at once or asynchronously) says so and offers Try Again, instead of an empty window
   - closing a window twice runs its cleanup once
   - opening and closing apps again and again leaves nothing behind (listeners, timers, animation loops)
   - Weather: a forecast that arrives after the window closed does not start its animation again */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// counts the window/document listeners, intervals and animation frames that are alive (installed before PatOS starts)
const COUNTERS = () => {
  const live = window.__live = { win: new Map(), doc: new Map(), iv: new Set(), raf: 0 };
  const key = (t, o) => t + '|' + (typeof o === 'boolean' ? o : !!(o && o.capture));
  for (const [obj, m] of [[window, live.win], [document, live.doc]]) {
    const add = obj.addEventListener.bind(obj), rem = obj.removeEventListener.bind(obj);
    obj.addEventListener = function (t, f, o) { if (f) { let s = m.get(key(t, o)); if (!s) m.set(key(t, o), s = new Set()); s.add(f); if (o && o.signal) o.signal.addEventListener('abort', () => s.delete(f)); } return add(t, f, o); };
    obj.removeEventListener = function (t, f, o) { const s = m.get(key(t, o)); if (s) s.delete(f); return rem(t, f, o); };
  }
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setInterval = (f, ms, ...a) => { const id = si(f, ms, ...a); live.iv.add(id); return id; };
  window.clearInterval = (id) => { live.iv.delete(id); return ci(id); };
  const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => { live.raf++; return raf(f); };
};
const snap = (page) => page.evaluate(() => { const L = window.__live; let w = 0, d = 0; L.win.forEach((s) => { w += s.size; }); L.doc.forEach((s) => { d += s.size; }); return { w, d, iv: L.iv.size, bus: PatOS.__busCount() }; });
const rafRate = (page) => page.evaluate(async () => { const a = window.__live.raf; await new Promise((r) => setTimeout(r, 1500)); return (window.__live.raf - a) / 1.5; });

test('errors are written down in one place, kept across a reload, and never synced', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    PatOS.errors.clear();
    let ran = 0;
    PatOS.on('test:ev', () => { throw new Error('listener broke'); });
    PatOS.on('test:ev', () => { ran++; });
    PatOS.emit('test:ev');
    Promise.reject(new Error('nobody caught me'));
    setTimeout(() => { throw new Error('thrown later'); }, 0);
    await new Promise((res) => setTimeout(res, 800));
    return { ran, list: PatOS.errors.list().map((e) => e.where + ': ' + e.msg) };
  });
  assert.equal(r.ran, 1, 'the other listener still ran');
  assert.ok(r.list.some((x) => /^event test:ev: listener broke/.test(x)), JSON.stringify(r.list));
  assert.ok(r.list.some((x) => /^promise: nobody caught me/.test(x)), JSON.stringify(r.list));
  assert.ok(r.list.some((x) => /thrown later/.test(x)), JSON.stringify(r.list));
  // the same error in a loop counts once
  const n = await page.evaluate(() => { for (let i = 0; i < 50; i++) PatOS.errors.report(new Error('again'), 'loop'); return PatOS.errors.list().filter((e) => e.msg === 'again').map((e) => e.n); });
  assert.deepEqual(n, [50]);
  // not in PatOS's store (so never in Sync or a backup)
  assert.equal(await page.evaluate(() => PatOS.store.keys().some((k) => /error/i.test(k))), false);
  await page.waitForTimeout(700);
  await page.reload(); await page.waitForFunction(() => window.PatOS && PatOS.errors, null, { timeout: 15000 });
  const after = await page.evaluate(() => PatOS.errors.list().filter((e) => e.before).map((e) => e.msg));
  assert.ok(after.includes('listener broke') && after.includes('again'), 'kept across a reload: ' + JSON.stringify(after));
  await ctx.close();
});

test('the bus: the same listener added twice runs once; once() runs once; off() works', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(() => {
    let a = 0, o = 0, c = 0; const fa = () => { a++; };
    PatOS.on('t:x', fa); PatOS.on('t:x', fa); PatOS.once('t:x', () => { o++; }); const off = PatOS.on('t:x', () => { c++; });
    PatOS.emit('t:x'); off(); PatOS.emit('t:x'); PatOS.off('t:x', fa); PatOS.emit('t:x');
    return { a, o, c };
  });
  assert.deepEqual(r, { a: 2, o: 1, c: 1 });
  await ctx.close();
});

test('an app that fails to start says so and offers Try Again; closing twice cleans up once', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    PatOS.errors.clear(); let tries = 0;
    PatOS.registerApp({ id: 'brokenSync', name: 'Broken', icon: 'settings', hidden: true, launch() { tries++; throw new Error('sync boom'); } });
    PatOS.registerApp({ id: 'brokenAsync', name: 'Broken Later', icon: 'settings', hidden: true, async launch(win) { win.body.textContent = 'loading'; await new Promise((res) => setTimeout(res, 50)); throw new Error('async boom'); } });
    const w1 = PatOS.launch('brokenSync'); const w2 = PatOS.launch('brokenAsync');
    await new Promise((res) => setTimeout(res, 300));
    const e1 = w1.body.querySelector('.app-error'), e2 = w2.body.querySelector('.app-error');
    const out = { e1: e1 && e1.textContent, e2: e2 && e2.textContent, again: !!(e1 && e1.querySelector('button')), logged: PatOS.errors.list().map((e) => e.where) };
    e1.querySelector('button').click(); await new Promise((res) => setTimeout(res, 500));
    out.tries = tries; out.reopened = PatOS.wm.windows.filter((w) => w.app.id === 'brokenSync').length;
    // closing twice
    let closed = 0, wmClose = 0; const w = PatOS.launch('calculator'); await new Promise((res) => setTimeout(res, 300));
    w.on('closed', () => { closed++; }); const off = PatOS.on('wm:close', (x) => { if (x === w) wmClose++; });
    w.close(); w.close(); await new Promise((res) => setTimeout(res, 300)); off();
    out.closed = closed; out.wmClose = wmClose;
    PatOS.wm.closeAll();
    return out;
  });
  assert.match(r.e1, /ran into a problem/); assert.match(r.e1, /sync boom/);
  assert.match(r.e2, /async boom/, 'an asynchronous failure also shows');
  assert.equal(r.again, true);
  assert.ok(r.logged.includes('brokenSync start') && r.logged.includes('brokenAsync start'), JSON.stringify(r.logged));
  assert.equal(r.tries, 2, 'Try Again starts the app again'); assert.equal(r.reopened, 1, 'in one window');
  assert.equal(r.closed, 1); assert.equal(r.wmClose, 1);
  await ctx.close();
});

test('opening and closing apps again and again leaves nothing behind', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const page = await ctx.newPage();
  await page.addInitScript(COUNTERS);
  await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; });
  const apps = ['notes', 'browser', 'music', 'terminal', 'photos', 'clock', 'calendar', 'finder', 'timeline', 'weather', 'paint', 'orbrunner'];
  const cycle = (id) => page.evaluate(async (id) => { const w = PatOS.launch(id); await new Promise((r) => setTimeout(r, 600)); if (w) w.close(); await new Promise((r) => setTimeout(r, 300)); }, id);
  for (const id of apps) await cycle(id); // the first time loads each app's code and its shared parts
  await wait(500);
  const a = await snap(page);
  for (let i = 0; i < 3; i++) for (const id of apps) await cycle(id);
  await wait(500);
  const z = await snap(page);
  assert.deepEqual({ w: z.w - a.w, d: z.d - a.d, iv: z.iv - a.iv, bus: z.bus - a.bus }, { w: 0, d: 0, iv: 0, bus: 0 }, 'listeners/timers left behind');
  assert.ok(await rafRate(page) <= 3, 'no animation keeps running with every app closed');
  await ctx.close();
});

test('Weather: a forecast that arrives after the window closed does not start the animation again', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await page.addInitScript(COUNTERS);
  let release; const gate = new Promise((r) => { release = r; });
  await ctx.route(/open-meteo\.com/, async (route) => { await gate; await route.fulfill({ status: 429, body: '{}' }).catch(() => {}); });
  await boot(page, srv.base, { fresh: true });
  await page.evaluate(async () => { PatOS.notify = () => {}; const w = PatOS.launch('weather'); await new Promise((r) => setTimeout(r, 900)); w.close(); await new Promise((r) => setTimeout(r, 400)); });
  release(); await wait(1500);
  assert.ok(await rafRate(page) <= 3, 'the closed Weather window stays still');
  await ctx.close();
});
