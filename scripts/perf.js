/* How fast does PatOS feel? Starts PatOS in a real browser, slows the processor down like a modest laptop, and times what people notice:
   getting to the lock screen, getting to the desktop, opening apps, Pat's answers and search.
   Usage: node scripts/perf.js [--slow 4] [--fast] [--json out.json] [--viewport 1366x657]
   (--slow N = the processor is N times slower, 4 is about a school Chromebook; the default). Numbers are milliseconds. */
'use strict';
const path = require('path');
const { startServer, browser } = require(path.join(__dirname, '..', 'test', 'helpers'));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const PAGE = arg('--page', '/'); const SETTINGS = arg('--settings', ''); const SLOW = process.argv.includes('--fast') ? 1 : +arg('--slow', 4); const VP = arg('--viewport', '1280x720').split('x').map(Number);
const APPS = ['finder', 'notes', 'calculator', 'settings', 'browser', 'photos', 'music', 'messages', 'calendar', 'terminal', 'textedit', 'paint', 'docs', 'sheets', 'weather'];
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

async function once(b, base, warm, ctxIn) {
  const ctx = ctxIn || await b.newContext({ viewport: { width: VP[0], height: VP[1] } }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable'); if (SLOW > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
  await page.addInitScript(() => { window.__long = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
  const out = {}; const t0 = Date.now();
  await page.goto(base + '/manifest.webmanifest'); await page.evaluate((S) => { localStorage.setItem('patos:setupDone', 'true'); localStorage.setItem('patos:seenWelcome', 'true'); localStorage.setItem('patos:iosHint', 'true'); if (S) localStorage.setItem('patos:settings', S); localStorage.setItem('patos:accountPrompt', JSON.stringify({ snoozedUntil: Date.now() + 1e10 })); }, SETTINGS);
  const n0 = Date.now(); await page.goto(base + PAGE); await page.waitForSelector('#lock:not(.hidden)', { timeout: 60000 }); out.toLockScreen = Date.now() - n0;
  out.scriptsAtStart = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\.js(\?|$)/.test(e.name)).length);
  const m1 = await cdp.send('Performance.getMetrics'); const g = (m, k) => (m.metrics.find((x) => x.name === k) || {}).value || 0; out.bootScriptMs = Math.round(g(m1, 'ScriptDuration') * 1000); out.bootLayoutMs = Math.round((g(m1, 'LayoutDuration') + g(m1, 'RecalcStyleDuration')) * 1000);
  const l0 = Date.now(); await page.evaluate(() => PatOS.boot.login()); await page.waitForFunction(() => PatOS.loggedIn && document.querySelector('#dock .dock-item, #dock [data-app], #dock > *'), null, { timeout: 30000 }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); out.loginToDesktop = Date.now() - l0;
  await page.waitForTimeout(1500 * (SLOW > 1 ? 2 : 1));
  out.longTasks = await page.evaluate(() => ({ n: window.__long.length, total: Math.round(window.__long.reduce((a, b) => a + b, 0)), worst: Math.round(Math.max(0, ...window.__long)) }));
  out.heapMB = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  await page.evaluate(() => { PatOS.notify = () => {}; });
  // opening apps: from the click until the window is on screen and has drawn (two frames later)
  const open = await page.evaluate(async (ids) => {
    const res = {}; const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const id of ids) {
      if (!PatOS.apps[id]) continue; const t = performance.now(); const w = PatOS.launch(id); await frame(); const first = performance.now() - t;
      (PatOS.wm.windowsOf(id) || []).forEach((x) => x.close()); await new Promise((r) => setTimeout(r, 120));
      const t2 = performance.now(); PatOS.launch(id); await frame(); const second = performance.now() - t2; (PatOS.wm.windowsOf(id) || []).forEach((x) => x.close()); await new Promise((r) => setTimeout(r, 120));
      res[id] = [Math.round(first), Math.round(second)];
    }
    return res;
  }, APPS);
  out.open = open;
  // Pat's answer, and search
  out.pat = await page.evaluate(async () => { await PatOS.pat.open(); const input = document.querySelector('#pat-panel .msg-in'); const bubbles = () => document.querySelectorAll('#pat-panel .msg-b.them:not(.typing)').length; const n = bubbles(); const t = performance.now(); input.value = 'what time is it'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); while (bubbles() === n && performance.now() - t < 5000) await new Promise((r) => setTimeout(r, 10)); const d = Math.round(performance.now() - t); PatOS.pat.close(); return d; });
  out.search = await page.evaluate(async () => { PatOS.spotlight.toggle(); await new Promise((r) => setTimeout(r, 200)); const inp = document.querySelector('#spotlight input'); const t = performance.now(); inp.value = 'notes'; inp.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const d = Math.round(performance.now() - t); PatOS.spotlight.toggle(); return d; });
  await page.close(); return { out, ctx };
}
(async () => {
  const srv = await startServer(); const b = await browser(); const runs = [];
  try {
    // the first start (nothing saved yet), then three starts of an installed PatOS (the usual case)
    const first = await once(b, srv.base, false); const cold = first.out; await first.ctx.close();
    const ctx = await b.newContext({ viewport: { width: VP[0], height: VP[1] } }); await (async () => { const p = await ctx.newPage(); await p.goto(srv.base + PAGE); await p.waitForSelector('#lock:not(.hidden)', { timeout: 60000 }); await p.evaluate(() => Promise.race([navigator.serviceWorker ? navigator.serviceWorker.ready : null, new Promise((r) => setTimeout(r, 4000))])); await p.waitForTimeout(3000); await p.close(); })();
    for (let i = 0; i < 3; i++) runs.push((await once(b, srv.base, true, ctx)).out);
    const pick = (f) => med(runs.map(f)); const apps = {}; APPS.forEach((id) => { if (runs[0].open[id]) apps[id] = { first: pick((r) => r.open[id][0]), again: pick((r) => r.open[id][1]) }; });
    const res = { cpuSlowdown: SLOW, viewport: VP.join('x'), scriptsAtStart: runs[0].scriptsAtStart, firstEverToLock: cold.toLockScreen, toLockScreen: pick((r) => r.toLockScreen), loginToDesktop: pick((r) => r.loginToDesktop), bootScriptMs: pick((r) => r.bootScriptMs), bootLayoutMs: pick((r) => r.bootLayoutMs), longTasks: runs[0].longTasks, heapMB: runs[0].heapMB, patAnswer: pick((r) => r.pat), searchKey: pick((r) => r.search), appOpenFirstMedian: med(Object.values(apps).map((a) => a.first)), appOpenAgainMedian: med(Object.values(apps).map((a) => a.again)), apps };
    console.log(JSON.stringify(res, null, 1)); if (arg('--json')) require('fs').writeFileSync(arg('--json'), JSON.stringify(res, null, 1));
  } finally { await b.close(); srv.stop(); }
})();
