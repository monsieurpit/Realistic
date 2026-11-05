/* Updates: a device only changes version when its person chooses (or, for a beta, when PatOS starts with Beta updates on).
   These run a copy of PatOS whose website shows the finished version 1.7.0 to a new visitor, while a beta and later a 1.8.0 exist. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { startServer, copyProject, browser, boot, skipNoBrowser } = require('../helpers');

let b;
test.before(async () => { if (skipNoBrowser) return; b = await browser(); });
test.after(async () => { if (b) await b.close(); });

const status = (page) => page.evaluate(() => PatOS.updateManager.ask({ patosVersion: true }, 8000));
// waits until check() is true (it runs in the page, and survives the page reloading in between)
async function until(page, fn, ms, arg) {
  const end = Date.now() + (ms || 20000); let last;
  while (Date.now() < end) { try { last = await page.evaluate(fn, arg); if (last) return last; } catch (e) { /* the page is reloading */ } await new Promise((r) => setTimeout(r, 150)); }
  throw new Error('timed out waiting for ' + String(fn).slice(0, 120) + ' (last: ' + JSON.stringify(last) + ')');
}
const ready = (page) => until(page, () => window.PatOS && PatOS.boot && PatOS.fs && PatOS.update && PatOS.build && navigator.serviceWorker.controller !== undefined, 25000);
const read = (f) => fs.readFileSync(f, 'utf8');
/* a new finished version 1.8.0 appears on the website (a copy of 1.7.0 that says it is 1.8.0) */
function addRelease(dir, v) {
  const from = path.join(dir, 'releases', '1.7.0'), to = path.join(dir, 'releases', v);
  fs.cpSync(from, to, { recursive: true });
  const vf = path.join(to, 'js', 'version.js');
  const rec = { version: v, date: '2026-11-05', title: { en: 'Newer', fr: 'Plus récent' }, notes: { en: ['A newer version'], fr: ['Une version plus récente'] } };
  fs.writeFileSync(vf, read(vf).replace('PatOS.version = "1.7.0";', 'PatOS.version = "' + v + '";').replace(/PatOS\.releases = (\[.*\]);/, (m, j) => 'PatOS.releases = ' + JSON.stringify([rec].concat(JSON.parse(j))) + ';').replace(/PatOS\.build = .*;/, 'PatOS.build = ' + JSON.stringify({ channel: 'stable', version: v, beta: 0 }) + ';'));
  const uf = path.join(dir, 'updates.json'); const u = JSON.parse(read(uf)); u.splice(1, 0, rec); fs.writeFileSync(uf, JSON.stringify(u, null, 1));
}
/* a newer beta build appears (the number goes up and a file changes) */
function bumpBeta(dir, n) {
  const uf = path.join(dir, 'updates.json'); const u = JSON.parse(read(uf)); u[0].beta = n; fs.writeFileSync(uf, JSON.stringify(u, null, 1));
  const vf = path.join(dir, 'js', 'version.js');
  fs.writeFileSync(vf, read(vf).replace(/PatOS\.beta = (\{.*\});/, (m, j) => 'PatOS.beta = ' + JSON.stringify(Object.assign(JSON.parse(j), { beta: n })) + ';').replace(/PatOS\.build = .*;/, 'PatOS.build = ' + JSON.stringify({ channel: 'beta', version: '2.0.0', beta: n }) + ';'));
  fs.appendFileSync(path.join(dir, 'css', 'patos.css'), '\n/* beta ' + n + ' */\n');
}
async function visit(srv, opts) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 780 } }); const page = await ctx.newPage(); const errors = await boot(page, srv.base, Object.assign({ fresh: true }, opts));
  await page.evaluate(() => navigator.serviceWorker.ready); await until(page, async () => { const s = await PatOS.updateManager.ask({ patosVersion: true }, 5000); return s && s.installed; });
  return { ctx, page, errors };
}
const reload = async (page) => { await page.reload(); await ready(page); };

test('a device on a finished version keeps it: refreshing never brings the beta or a newer version, only the update button does', { skip: skipNoBrowser }, async () => {
  const c = copyProject(); const srv = await startServer({ cwd: c.dir, root: 'stable' });
  try {
    const { ctx, page, errors } = await visit(srv);
    assert.deepEqual(await page.evaluate(() => PatOS.build), { channel: 'stable', version: '1.7.0', beta: 0 }, 'a new visitor gets the finished version, not the beta that is being built');
    let st = await status(page); assert.equal(st.installed, '1.7.0'); assert.equal(st.channel, 'stable'); assert.equal(st.pending, null); assert.equal(st.legacy, false);
    addRelease(c.dir, '1.8.0'); // a newer finished version is now on the website, and the beta is too
    for (let i = 0; i < 2; i++) { await reload(page); assert.equal(await page.evaluate(() => PatOS.build.version), '1.7.0', 'refreshing does not update'); }
    await page.evaluate(() => PatOS.update.check(true));
    const o = await page.evaluate(() => ({ state: PatOS.update.state, newer: PatOS.update.newer, target: PatOS.update.target.version, beta: !!PatOS.update.target.beta, running: PatOS.versionNow() }));
    assert.deepEqual(o, { state: 'ready', newer: true, target: '1.8.0', beta: false, running: '1.7.0' });
    st = await status(page); assert.equal(st.installed, '1.7.0', 'it is only offered, nothing was installed'); assert.equal(st.pending, null);
    // the button: downloads 1.8.0 (never the beta), switches, restarts
    await page.evaluate(() => { PatOS.update.restart(); });
    await until(page, () => window.PatOS && PatOS.build && PatOS.build.version === '1.8.0', 30000);
    await ready(page); st = await status(page);
    assert.equal(st.installed, '1.8.0'); assert.equal(st.previous, 'patos-1.7.0'); assert.equal(st.channel, 'stable'); assert.equal(st.pending, null);
    assert.equal(await page.evaluate(() => PatOS.update.newer), false, 'now it is up to date');
    await reload(page); assert.equal(await page.evaluate(() => PatOS.build.version), '1.8.0');
    // it works with no internet
    await ctx.setOffline(true); await page.reload(); await ready(page); assert.equal(await page.evaluate(() => PatOS.build.version), '1.8.0'); await ctx.setOffline(false);
    assert.deepEqual(errors, []); await ctx.close();
  } finally { srv.stop(); c.remove(); }
});

test('a version that cannot be downloaded changes nothing', { skip: skipNoBrowser }, async () => {
  const c = copyProject(); const srv = await startServer({ cwd: c.dir, root: 'stable' });
  try {
    const { ctx, page } = await visit(srv);
    const bad = await page.evaluate(() => PatOS.updateManager.ask({ patosInstall: { id: '9.9.9' } }, 15000)); assert.equal(bad.ok, false);
    const worse = await page.evaluate(() => PatOS.updateManager.ask({ patosInstall: { id: '../x' } }, 15000)); assert.equal(worse.ok, false);
    const st = await status(page); assert.equal(st.installed, '1.7.0'); assert.equal(st.previous, null);
    await reload(page); assert.equal(await page.evaluate(() => PatOS.build.version), '1.7.0'); await ctx.close();
  } finally { srv.stop(); c.remove(); }
});

test('with Beta updates on, the newest beta is downloaded quietly and used when PatOS starts; with it off, a beta never arrives', { skip: skipNoBrowser }, async () => {
  const c = copyProject(); const srv = await startServer({ cwd: c.dir, root: 'stable' });
  try {
    const { ctx, page, errors } = await visit(srv);
    assert.equal(await page.evaluate(() => PatOS.build.channel), 'stable');
    const base = JSON.parse(read(path.join(c.dir, 'updates.json')))[0].beta; // the beta number now
    await page.evaluate(() => PatOS.update.setBeta(true));
    const pending = await until(page, async () => { const s = await PatOS.updateManager.ask({ patosVersion: true }, 5000); return s && s.pending; }, 30000);
    assert.match(pending, /^2\.0\.0-beta\.\d+\.[0-9a-f]{8}$/);
    let st = await status(page); assert.equal(st.installed, '1.7.0', 'downloaded, but this window keeps running what it started with'); assert.equal(st.channel, 'beta');
    await reload(page); // PatOS starts again: the beta is used
    assert.equal(await page.evaluate(() => PatOS.build.channel), 'beta'); st = await status(page);
    assert.equal(st.installed, pending); assert.equal(st.previous, 'patos-1.7.0'); assert.equal(st.pending, null);
    // a newer beta comes out: downloaded by itself, used at the next start
    bumpBeta(c.dir, base + 1);
    await page.evaluate(() => PatOS.updateManager.ask({ patosCheck: true }, 30000));
    st = await status(page); assert.ok(st.pending && st.pending !== st.installed, 'the new beta is waiting'); assert.equal(await page.evaluate(() => PatOS.build.beta), base);
    await reload(page); assert.equal(await page.evaluate(() => PatOS.build.beta), base + 1, 'used at the next start');
    // Beta updates off: a newer beta is not downloaded, and nothing older is offered
    await page.evaluate(() => PatOS.update.setBeta(false)); bumpBeta(c.dir, base + 2);
    await page.evaluate(() => PatOS.updateManager.ask({ patosCheck: true }, 30000)); st = await status(page);
    assert.equal(st.pending, null); assert.equal(st.channel, 'stable');
    await reload(page); assert.equal(await page.evaluate(() => PatOS.build.beta), base + 1);
    assert.equal(await page.evaluate(async () => { await PatOS.update.check(true); return PatOS.update.newer; }), false, 'a beta is never "updated" down to 1.7.0');
    assert.deepEqual(errors, []); await ctx.close();
  } finally { srv.stop(); c.remove(); }
});

test('a device from before the update manager: Beta updates off goes to the finished version, on follows the beta, and the old copy stays as the way back', { skip: skipNoBrowser }, async () => {
  for (const betaOn of [false, true]) {
    const c = copyProject(); const srv = await startServer({ cwd: c.dir, root: 'stable' });
    try {
      const { ctx, page } = await visit(srv);
      // make this look like an old device: its choice saved, an old-style copy in the cache, no memory of the new system
      await page.evaluate(async (on) => {
        PatOS.setSetting('betaUpdates', on); await PatOS.flush();
        const reg = await navigator.serviceWorker.getRegistration(); await reg.unregister();
        for (const k of await caches.keys()) if (k.startsWith('patos-') && !k.startsWith('patos-data-')) await caches.delete(k);
        await caches.delete('patos-data-update');
        const old = await caches.open('patos-abcdef0123'); await old.put('/index.html', new Response('<html>old copy</html>', { headers: { 'Content-Type': 'text/html' } }));
        await (await caches.open('patos-data-meta')).put('/__patos/meta', new Response(JSON.stringify({ current: 'patos-abcdef0123', previous: null })));
      }, betaOn);
      await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready);
      let st = await until(page, async () => { const s = await PatOS.updateManager.ask({ patosVersion: true }, 5000); return s && s.legacy && s.pending ? s : null; }, 30000);
      assert.equal(st.installed, 'abcdef0123', 'the old copy keeps running until PatOS starts again'); assert.equal(st.channel, betaOn ? 'beta' : 'stable');
      assert.ok(betaOn ? /-beta\./.test(st.pending) : st.pending === '1.7.0', 'it moves to ' + (betaOn ? 'the beta' : 'the finished version') + ', got ' + st.pending);
      await reload(page); st = await status(page);
      if (betaOn) assert.match(st.installed, /^2\.0\.0-beta\.\d+\.[0-9a-f]{8}$/); else assert.equal(st.installed, '1.7.0'); assert.equal(st.legacy, false); assert.equal(st.previous, 'patos-abcdef0123'); assert.equal(st.pending, null);
      assert.equal(await page.evaluate(() => PatOS.build.channel), betaOn ? 'beta' : 'stable');
      await ctx.close();
    } finally { srv.stop(); c.remove(); }
  }
});
