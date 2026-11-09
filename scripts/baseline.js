/* PatOS quality baseline (roadmap Task 2): one repeatable run that measures what people notice and what can regress,
   on three device profiles, and writes the numbers to a JSON file. docs/QUALITY-BASELINE.md explains every number and
   the targets.

   Usage:  npm run baseline                         (all profiles, 3 warm runs each, prints a summary)
           npm run baseline -- --json docs/baseline/3.0.0-beta7.json
           npm run baseline -- --profiles desktop --runs 1        (quick)
           npm run baseline -- --compare docs/baseline/3.0.0-beta7.json   (also prints the change against a saved run)

   Profiles: desktop (1440×900, real CPU), chromebook (1366×768, CPU 4× slower: an entry-level school Chromebook),
   phone (iPhone 13 emulation, CPU 4× slower). The CPU slowdown is Chrome's own throttling (DevTools), so numbers are
   comparable between runs on the same machine, not between machines: compare against a baseline made on the same host.
   Milliseconds unless the name says otherwise. Nothing here changes PatOS; every run uses its own fresh browser profile. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const H = require(path.join(__dirname, '..', 'test', 'helpers'));
const ROOT = path.join(__dirname, '..');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const RUNS = Math.max(1, +arg('--runs', 3));
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, cpu: 1 },
  chromebook: { viewport: { width: 1366, height: 768 }, cpu: 4 },
  phone: { device: 'iPhone 13', cpu: 4 }
};
const ONLY = (arg('--profiles', Object.keys(PROFILES).join(','))).split(',').filter((p) => PROFILES[p]);
const APPS = ['finder', 'notes', 'calculator', 'settings', 'browser', 'photos', 'music', 'messages', 'calendar', 'terminal', 'textedit', 'docs', 'sheets', 'timeline', 'clock'];
const med = (a) => { const s = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const p95 = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * .95))] : null; };
const round = (x) => (typeof x === 'number' ? Math.round(x) : x);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- build size (no browser) ---------- */
function buildSize() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sum = (files) => files.reduce((o, f) => { const b = fs.readFileSync(path.join(ROOT, f)); o.files++; o.kb += b.length / 1024; o.gzipKb += zlib.gzipSync(b, { level: 9 }).length / 1024; return o; }, { files: 0, kb: 0, gzipKb: 0 });
  const scripts = [...html.matchAll(/<script(?: type="patos\/(\w+)")? src="([^"]+)"/g)].map((m) => ({ kind: m[1] || 'plain', src: m[2] }));
  const fix = (o) => ({ files: o.files, kb: Math.round(o.kb), gzipKb: Math.round(o.gzipKb) });
  return {
    eagerJs: fix(sum(scripts.filter((s) => s.kind === 'js' || s.kind === 'plain').map((s) => s.src))),
    lazyJs: fix(sum(scripts.filter((s) => s.kind === 'lazy').map((s) => s.src))),
    onDemandVendor: fix(sum(scripts.filter((s) => /^(3d|pit|firebase)$/.test(s.kind)).map((s) => s.src))),
    css: fix(sum([...html.matchAll(/href="(css\/[^"]+)"/g)].map((m) => m[1]))),
    singleFileMB: +(fs.statSync(path.join(ROOT, 'dist', 'PatOS.html')).size / 1048576).toFixed(2),
    frozenReleases: fs.readdirSync(path.join(ROOT, 'releases')).length
  };
}

/* ---------- test inventory (no browser) ---------- */
function testInventory() {
  const out = {};
  ['unit', 'browser', 'cloud'].forEach((d) => {
    const dir = path.join(ROOT, 'test', d); if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js'));
    out[d] = { files: files.length, tests: files.reduce((n, f) => n + (fs.readFileSync(path.join(dir, f), 'utf8').match(/^test\(/gm) || []).length, 0) };
  });
  return out;
}

/* ---------- one browser profile ---------- */
async function newContext(b, prof, pw) {
  const opts = prof.device ? Object.assign({}, pw.devices[prof.device]) : { viewport: prof.viewport };
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => {
    window.__long = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  });
  return ctx;
}
async function throttle(ctx, page, cpu) {
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  return cdp;
}
const metric = (m, k) => (m.metrics.find((x) => x.name === k) || {}).value || 0;
async function prepare(page, base) {
  await page.goto(base + '/manifest.webmanifest');
  await page.evaluate((P) => {
    localStorage.setItem('patos-policy', JSON.stringify({ version: P, at: Date.now() }));
    ['setupDone', 'seenWelcome', 'iosHint'].forEach((k) => localStorage.setItem('patos:' + k, 'true'));
    localStorage.setItem('patos:accountPrompt', JSON.stringify({ snoozedUntil: Date.now() + 1e10 }));
  }, H.POLICY);
}
// navigation → lock screen, then login → desktop drawn
async function start(page, base, cdp) {
  const r = {};
  const t0 = Date.now(); await page.goto(base + '/'); await page.waitForSelector('#lock:not(.hidden)', { timeout: 90000 }); r.toLockScreen = Date.now() - t0;
  const m = await cdp.send('Performance.getMetrics'); r.bootScriptMs = Math.round(metric(m, 'ScriptDuration') * 1000); r.bootStyleLayoutMs = Math.round((metric(m, 'LayoutDuration') + metric(m, 'RecalcStyleDuration')) * 1000);
  const l0 = Date.now();
  await page.evaluate(() => PatOS.boot.login());
  await page.waitForFunction(() => PatOS.loggedIn && document.querySelector('#desktop:not(.hidden)'), null, { timeout: 60000 });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  r.loginToDesktop = Date.now() - l0;
  await sleep(1500);
  r.bootLongTasks = await page.evaluate(() => ({ count: window.__long.length, totalMs: Math.round(window.__long.reduce((a, b) => a + b, 0)), worstMs: Math.round(Math.max(0, ...window.__long)) }));
  await page.evaluate(() => { PatOS.notify = () => {}; document.querySelectorAll('.toast').forEach((t) => t.remove()); });
  return r;
}
async function network(page) {
  return page.evaluate(() => {
    const all = performance.getEntriesByType('resource').concat(performance.getEntriesByType('navigation'));
    const by = (re) => all.filter((e) => re.test(e.name.split('?')[0]));
    const kb = (l, k) => Math.round(l.reduce((a, e) => a + (e[k] || 0), 0) / 1024);
    return { requests: all.length, transferKb: kb(all, 'transferSize'), decodedKb: kb(all, 'decodedBodySize'), js: { n: by(/\.js$/).length, transferKb: kb(by(/\.js$/), 'transferSize') }, css: { n: by(/\.css$/).length, transferKb: kb(by(/\.css$/), 'transferSize') } };
  });
}
// from launch until the window has drawn twice; first open (code may load) and a second open (code cached)
async function openApps(page) {
  return page.evaluate(async (ids) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const out = {};
    for (const id of ids) {
      if (!PatOS.apps[id]) continue;
      const times = [];
      for (let k = 0; k < 2; k++) {
        const t = performance.now(); const w = PatOS.launch(id); await frame(); times.push(Math.round(performance.now() - t));
        await new Promise((r) => setTimeout(r, 120)); if (w && w.close) w.close(); else PatOS.wm.closeAll();
        await new Promise((r) => setTimeout(r, 260));
      }
      out[id] = times;
    }
    return out;
  }, APPS);
}
// a lived-in PatOS: 300 notes, 300 visited pages, 200 contacts, 1,000 files in 20 folders
async function seed(page) {
  await page.evaluate(async () => {
    const words = 'plan meeting trip report budget lisbon recipe garden music invoice project draft photo summer list ideas'.split(' ');
    const w = (i) => words[i % words.length] + ' ' + words[(i * 7) % words.length];
    PatOS.store.set('notes', Array.from({ length: 300 }, (_, i) => ({ id: 'n' + i, title: 'Note ' + i + ' ' + w(i), body: '<div>' + (w(i) + ' ').repeat(40) + '</div>', mtime: Date.now() - i * 3600e3 })));
    PatOS.store.set('browserHistory', Array.from({ length: 300 }, (_, i) => ({ u: 'https://example' + i + '.com/' + w(i).replace(' ', '/'), t: Date.now() - i * 60e3, title: 'Page ' + i + ' ' + w(i) })));
    PatOS.store.set('contacts', Array.from({ length: 200 }, (_, i) => ({ id: 'c' + i, first: 'Person' + i, last: w(i), email: 'p' + i + '@example.com' })));
    for (let d = 0; d < 20; d++) { PatOS.fs.mkdir && PatOS.fs.mkdir('/Documents/Folder ' + d); for (let f = 0; f < 50; f++) PatOS.fs.write('/Documents/Folder ' + d + '/File ' + f + '.txt', (w(d * 50 + f) + '\n').repeat(30)); }
    await PatOS.flush();
  });
}
async function responsiveness(page, desktop) {
  const r = await page.evaluate(async () => {
    const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    PatOS.spotlight.show(); await new Promise((res) => setTimeout(res, 250));
    const inp = document.querySelector('.sp-input'); const keys = [];
    for (const q of ['n', 'no', 'not', 'note', 'notes', 'li', 'lis', 'lisb', 'trip', 'budget']) { const t = performance.now(); inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true })); await frame(); keys.push(performance.now() - t); }
    PatOS.spotlight.hide();
    // reading a big saved list (Spotlight and Timeline do this): one store.get of 300 notes
    const t1 = performance.now(); for (let i = 0; i < 20; i++) PatOS.store.get('notes', []); const getNotes = (performance.now() - t1) / 20;
    return { spotlightKeys: keys, storeGetNotes300: getNotes };
  });
  const out = { spotlightKeyMedian: round(med(r.spotlightKeys)), spotlightKeyWorst: round(Math.max(...r.spotlightKeys)), storeGet300NotesMs: +r.storeGetNotes300.toFixed(2) };
  if (desktop) {
    // dragging a window for one second: how even are the frames?
    await page.evaluate(() => { PatOS.wm.closeAll(); PatOS.launch('notes'); }); await sleep(700);
    const tb = await page.locator('.window .titlebar').first().boundingBox();
    await page.evaluate(() => { window.__frames = []; let last = performance.now(); const loop = (t) => { window.__frames.push(t - last); last = t; if (window.__frames.length < 400) window.__fr = requestAnimationFrame(loop); }; window.__fr = requestAnimationFrame(loop); });
    await page.mouse.move(tb.x + 300, tb.y + 20); await page.mouse.down();
    for (let i = 0; i < 40; i++) { await page.mouse.move(tb.x + 300 + Math.sin(i / 4) * 200, tb.y + 20 + i * 4); await sleep(25); }
    await page.mouse.up();
    const frames = await page.evaluate(() => { cancelAnimationFrame(window.__fr); return window.__frames.slice(2); });
    out.dragFrameP95 = round(p95(frames)); out.dragFrameMedian = round(med(frames));
    await page.evaluate(() => PatOS.wm.closeAll());
  }
  return out;
}
async function storage(page) {
  return page.evaluate(async () => {
    const T = async (fn) => { const t = performance.now(); await fn(); return Math.round(performance.now() - t); };
    const n = (() => { let c = 0; PatOS.fs.walk('/', () => { c++; }); return c; })();
    // one small edit with 1,000+ files in the tree: write, then save the filesystem and the store
    const editSave = await T(async () => { PatOS.fs.write('/Documents/edit.txt', 'x' + Math.random()); await PatOS.flush(); });
    const editSave2 = await T(async () => { PatOS.fs.write('/Documents/edit.txt', 'y' + Math.random()); await PatOS.flush(); });
    const big = (mb) => 'data:application/octet-stream;base64,' + btoa(String.fromCharCode.apply(null, new Uint8Array(1024))).repeat(Math.round(mb * 1024 * 0.75));
    const r5 = big(5), r20 = big(20);
    const write5 = await T(async () => { PatOS.fs.write('/Documents/big5.bin', r5); await PatOS.flush(); });
    const write20 = await T(async () => { PatOS.fs.write('/Documents/big20.bin', r20); await PatOS.flush(); });
    const read20 = await T(async () => { const c = PatOS.fs.read('/Documents/big20.bin'); if (!c || c.length < r20.length * 0.9) throw new Error('read back failed'); });
    PatOS.fs.remove && PatOS.fs.remove('/Documents/big5.bin'); PatOS.fs.remove && PatOS.fs.remove('/Documents/big20.bin'); await PatOS.flush();
    let usedMB = null; try { const e = await navigator.storage.estimate(); usedMB = +(e.usage / 1048576).toFixed(1); } catch (e) {}
    return { nodesInTree: n, editAndSaveMs: Math.min(editSave, editSave2), write5MBMs: write5, write20MBMs: write20, read20MBMs: read20, storageUsedMB: usedMB };
  });
}
async function memory(page, cdp) {
  const snap = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); await sleep(300); const m = await cdp.send('Performance.getMetrics'); return { heapMB: +(metric(m, 'JSHeapUsedSize') / 1048576).toFixed(1), domNodes: metric(m, 'Nodes'), listeners: metric(m, 'JSEventListeners') }; };
  const cycle = () => page.evaluate(async (ids) => { for (const id of ids) { const w = PatOS.apps[id] && PatOS.launch(id); await new Promise((r) => setTimeout(r, 150)); if (w && w.close) w.close(); await new Promise((r) => setTimeout(r, 220)); } }, APPS);
  // one warm-up round first (code loads, caches fill), so the growth below is what stays behind per round
  await page.evaluate(() => { PatOS.wm.closeAll(); PatOS.spotlight.hide(); }); await cycle(); await sleep(800);
  const before = await snap();
  for (let c = 0; c < 3; c++) {
    await cycle();
  }
  await sleep(800);
  const after = await snap();
  return { afterWarmup: before, afterOpeningAndClosing15Apps3Times: after, growth: { heapMB: +(after.heapMB - before.heapMB).toFixed(1), domNodes: after.domNodes - before.domNodes, listeners: after.listeners - before.listeners } };
}
async function offline(ctx, base, prof) {
  const page = await ctx.newPage(); const cdp = await throttle(ctx, page, prof.cpu);
  await ctx.setOffline(true);
  const r = { works: false };
  try {
    const t0 = Date.now(); await page.goto(base + '/', { timeout: 60000 }); await page.waitForSelector('#lock:not(.hidden)', { timeout: 60000 }); r.toLockScreen = Date.now() - t0;
    await page.evaluate(() => PatOS.boot.login()); await page.waitForFunction(() => PatOS.loggedIn, null, { timeout: 30000 });
    r.appOpens = await page.evaluate(async () => { const w = PatOS.launch('notes'); await new Promise((res) => setTimeout(res, 600)); return !!(w && w.el.isConnected && !w.body.querySelector('.app-error')); });
    r.works = true;
  } catch (e) { r.error = String(e.message || e).split('\n')[0]; }
  await ctx.setOffline(false); await cdp.detach().catch(() => {}); await page.close();
  return r;
}
async function accessibility(page) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const run = (sel) => page.evaluate(async (s) => {
    const res = await window.axe.run(s ? document.querySelector(s) : document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    const by = {}; res.violations.forEach((v) => { by[v.impact || 'n/a'] = (by[v.impact || 'n/a'] || 0) + v.nodes.length; });
    return { rules: res.violations.length, nodes: res.violations.reduce((n, v) => n + v.nodes.length, 0), byImpact: by, top: res.violations.sort((a, b) => b.nodes.length - a.nodes.length).slice(0, 5).map((v) => v.id + ' ×' + v.nodes.length) };
  }, sel || null);
  const out = { desktop: await run(null) };
  for (const id of ['settings', 'finder', 'notes', 'timeline']) {
    await page.evaluate((a) => { PatOS.wm.closeAll(); PatOS.launch(a); }, id); await sleep(900);
    out[id] = await run('.window');
  }
  await page.evaluate(() => PatOS.wm.closeAll());
  return out;
}
async function coverage(b, base, pw) {
  const ctx = await newContext(b, PROFILES.desktop, pw); const page = await ctx.newPage(); await prepare(page, base);
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  const cdp = await throttle(ctx, page, 1); await start(page, base, cdp); await openApps(page);
  const entries = await page.coverage.stopJSCoverage();
  let total = 0, used = 0;
  entries.filter((e) => e.url.startsWith(base) && /\/js\//.test(e.url)).forEach((e) => {
    const len = (e.source || '').length; total += len;
    // functions with a non-zero count: merge their ranges and count covered characters
    const covered = new Uint8Array(len);
    e.functions.forEach((f) => f.ranges.forEach((r) => { if (r.count > 0) covered.fill(1, r.startOffset, r.endOffset); }));
    e.functions.forEach((f) => f.ranges.forEach((r) => { if (r.count === 0) covered.fill(0, r.startOffset, r.endOffset); }));
    used += covered.reduce((a, x) => a + x, 0);
  });
  await ctx.close();
  return { scriptKb: Math.round(total / 1024), executedPercentAfterBootAnd15Apps: total ? Math.round(used / total * 100) : null };
}

async function profileRun(b, base, name, pw) {
  const prof = PROFILES[name]; const res = { profile: name, cpuSlowdown: prof.cpu, viewport: prof.device || prof.viewport.width + 'x' + prof.viewport.height };
  // first start ever: nothing cached
  {
    const ctx = await newContext(b, prof, pw); const page = await ctx.newPage(); await prepare(page, base); const cdp = await throttle(ctx, page, prof.cpu);
    const s = await start(page, base, cdp); res.firstStart = { toLockScreen: s.toLockScreen, loginToDesktop: s.loginToDesktop }; res.networkFirstStart = await network(page);
    await ctx.close();
  }
  // an installed PatOS (service worker ready): the usual start
  const ctx = await newContext(b, prof, pw);
  {
    const page = await ctx.newPage(); await prepare(page, base); await page.goto(base + '/'); await page.waitForSelector('#lock:not(.hidden)', { timeout: 90000 });
    await page.evaluate(() => Promise.race([navigator.serviceWorker ? navigator.serviceWorker.ready : null, new Promise((r) => setTimeout(r, 5000))])); await sleep(3000); await page.close();
  }
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await ctx.newPage(); const cdp = await throttle(ctx, page, prof.cpu);
    const s = await start(page, base, cdp); s.net = await network(page); s.apps = await openApps(page);
    runs.push(s); await cdp.detach().catch(() => {}); await page.close();
  }
  const pick = (f) => med(runs.map(f));
  res.start = { toLockScreen: pick((r) => r.toLockScreen), loginToDesktop: pick((r) => r.loginToDesktop), bootScriptMs: pick((r) => r.bootScriptMs), bootStyleLayoutMs: pick((r) => r.bootStyleLayoutMs), bootLongTasks: runs[0].bootLongTasks };
  res.networkInstalledStart = { requests: runs[0].net.requests, transferKb: pick((r) => r.net.transferKb) };
  res.appOpen = {}; APPS.forEach((id) => { if (runs[0].apps[id]) res.appOpen[id] = { first: pick((r) => r.apps[id] && r.apps[id][0]), again: pick((r) => r.apps[id] && r.apps[id][1]) }; });
  res.appOpenMedian = { first: med(Object.values(res.appOpen).map((a) => a.first)), again: med(Object.values(res.appOpen).map((a) => a.again)) };
  res.appOpenSlowest = Object.entries(res.appOpen).sort((a, b) => b[1].first - a[1].first).slice(0, 3).map(([id, a]) => id + ' ' + a.first);
  // a lived-in PatOS
  {
    const page = await ctx.newPage(); const cdp = await throttle(ctx, page, prof.cpu);
    await start(page, base, cdp); await seed(page); await page.close();
    const page2 = await ctx.newPage(); const cdp2 = await throttle(ctx, page2, prof.cpu);
    const s = await start(page2, base, cdp2); res.startWithData = { toLockScreen: s.toLockScreen, loginToDesktop: s.loginToDesktop, bootLongTasks: s.bootLongTasks };
    res.responsiveness = await responsiveness(page2, name !== 'phone');
    res.storage = await storage(page2);
    res.memory = await memory(page2, cdp2);
    if (name === 'desktop') res.accessibility = await accessibility(page2);
    await cdp2.detach().catch(() => {}); await page2.close();
  }
  res.offline = await offline(ctx, base, prof);
  await ctx.close();
  return res;
}

function summary(r, prev) {
  const ch = (a, b) => (typeof a === 'number' && typeof b === 'number' && b ? ' (' + (a >= b ? '+' : '') + Math.round((a - b) / b * 100) + '%)' : '');
  const lines = ['', 'PatOS quality baseline · ' + r.version + ' · ' + r.date, ''];
  r.profiles.forEach((p) => {
    const q = prev && prev.profiles && prev.profiles.find((x) => x.profile === p.profile);
    const g = (f) => { try { return q ? f(q) : ''; } catch (e) { return ''; } };
    lines.push('[' + p.profile + '] cpu ×' + p.cpuSlowdown + ' · ' + p.viewport);
    lines.push('  start: lock ' + p.start.toLockScreen + g((x) => ch(p.start.toLockScreen, x.start.toLockScreen)) + ' · desktop ' + p.start.loginToDesktop + g((x) => ch(p.start.loginToDesktop, x.start.loginToDesktop)) + ' · first ever ' + p.firstStart.toLockScreen + ' · with data ' + p.startWithData.toLockScreen);
    lines.push('  apps: first ' + p.appOpenMedian.first + ' · again ' + p.appOpenMedian.again + ' · slowest ' + p.appOpenSlowest.join(', '));
    lines.push('  spotlight key ' + p.responsiveness.spotlightKeyMedian + ' (worst ' + p.responsiveness.spotlightKeyWorst + ')' + (p.responsiveness.dragFrameP95 != null ? ' · drag frame p95 ' + p.responsiveness.dragFrameP95 : ''));
    lines.push('  storage: edit+save ' + p.storage.editAndSaveMs + ' (' + p.storage.nodesInTree + ' nodes) · 20 MB write ' + p.storage.write20MBMs + ' read ' + p.storage.read20MBMs);
    lines.push('  memory: heap ' + p.memory.afterWarmup.heapMB + ' MB → ' + p.memory.afterOpeningAndClosing15Apps3Times.heapMB + ' MB · listeners +' + p.memory.growth.listeners + ' · nodes +' + p.memory.growth.domNodes);
    lines.push('  network: first start ' + p.networkFirstStart.requests + ' requests, ' + p.networkFirstStart.transferKb + ' KB · installed ' + p.networkInstalledStart.transferKb + ' KB · offline ' + (p.offline.works ? 'works (' + p.offline.toLockScreen + ')' : 'FAILS: ' + p.offline.error));
    if (p.accessibility) lines.push('  a11y (axe, WCAG A/AA): ' + Object.entries(p.accessibility).map(([k, v]) => k + ' ' + v.nodes).join(' · '));
    lines.push('');
  });
  lines.push('build: eager JS ' + r.build.eagerJs.kb + ' KB (' + r.build.eagerJs.gzipKb + ' gz) · lazy ' + r.build.lazyJs.kb + ' KB · CSS ' + r.build.css.kb + ' KB · tests ' + JSON.stringify(r.tests) + ' · code run in the smoke tour ' + (r.coverage && r.coverage.executedPercentAfterBootAnd15Apps) + '%');
  return lines.join('\n');
}

(async () => {
  const pw = H.playwright(); if (!pw) { console.error('Playwright is not installed.'); process.exit(1); }
  const srv = await H.startServer(); const b = await H.browser();
  const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'updates.json'), 'utf8'))[0];
  const report = { version: ver.version + (ver.beta ? '-beta' + ver.beta : ''), date: new Date().toISOString(), host: { node: process.version, platform: process.platform, cpus: require('os').cpus().length }, runs: RUNS, build: buildSize(), tests: testInventory(), profiles: [] };
  try {
    for (const name of ONLY) { process.stderr.write('measuring ' + name + '…\n'); report.profiles.push(await profileRun(b, srv.base, name, pw)); }
    process.stderr.write('measuring code coverage…\n'); report.coverage = await coverage(b, srv.base, pw);
  } finally { await b.close(); srv.stop(); }
  const prev = arg('--compare') ? JSON.parse(fs.readFileSync(arg('--compare'), 'utf8')) : null;
  console.log(summary(report, prev));
  if (arg('--json')) { fs.mkdirSync(path.dirname(arg('--json')), { recursive: true }); fs.writeFileSync(arg('--json'), JSON.stringify(report, null, 1) + '\n'); console.log('\nsaved ' + arg('--json')); }
})().catch((e) => { console.error(e); process.exit(1); });
