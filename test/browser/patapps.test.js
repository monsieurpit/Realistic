/* The App SDK: apps run in a locked box, ask before sensitive things, leave a trail in Settings › Privacy,
   and come from files or from the community store (after the owner accepts them). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b, dataDir;
test.before(async () => { if (skipNoBrowser) return; dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-pa-')); process.env.PATOS_DATA = dataDir; process.env.APPS_ADMIN_PASSWORD = 'browser-test-pw'; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true }); });

const APP = (o) => Object.assign({ format: 'patapp', formatVersion: 1, id: 'com.test.probe', name: 'Probe', version: '1.0.0', author: 'T', description: 'Probes the box.', icon: '🧪', color: '#0a84ff', permissions: ['notifications', 'files'], width: 400, height: 300, html: '<h1 id="h">probe</h1>' }, o || {});
async function setup() {
  const page = await b.newPage({ viewport: { width: 1200, height: 760 } }); const errors = await boot(page, srv.base, { fresh: true });
  await stub(page);
  return { page, errors };
}
const stub = (page) => page.evaluate(() => { window.__asked = []; window.__answer = true; window.__notes = []; PatOS.confirmBox = async (title, text, o) => { window.__asked.push({ title, text, ok: o && o.ok }); return window.__answer; }; PatOS.notify = (n) => window.__notes.push(n); });
const frameOf = async (page, id) => { for (let i = 0; i < 60; i++) { for (const f of page.frames()) { if (f === page.mainFrame()) continue; try { if (await f.evaluate(() => window.patos && patos.app.id) === id) return f; } catch (e) {} } await page.waitForTimeout(100); } throw new Error('no frame for ' + id); };
const call = (f, src) => f.evaluate(`(async()=>{try{return {ok:await (${src})}}catch(e){return {err:e.message}}})()`);

test('install, run in a locked box, storage, and what the box cannot do', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup();
  const r = await page.evaluate(async (app) => { const ok = await PatOS.patapps.install(app, { source: 'file' }); return { ok, registered: !!PatOS.apps['pa:com.test.probe'], ordered: PatOS.appOrder.includes('pa:com.test.probe'), icon: !!PatOS.iconDefs['pa:com.test.probe'], asked: window.__asked[0] }; }, APP());
  assert.equal(r.ok, true); assert.equal(r.registered, true); assert.equal(r.ordered, true); assert.equal(r.icon, true);
  assert.match(r.asked.title, /Install “Probe” 1\.0\.0\?/); assert.match(r.asked.text, /Notifications, Files/); assert.match(r.asked.text, /not checked/);
  await page.evaluate(() => PatOS.launch('pa:com.test.probe'));
  const f = await frameOf(page, 'com.test.probe');
  assert.equal(await f.evaluate(() => document.getElementById('h').textContent), 'probe');
  // storage: private to the app, any JSON value
  assert.deepEqual((await call(f, "patos.storage.set('k', {a:[1,2,{b:3}]}).then(()=>patos.storage.get('k'))")).ok, { a: [1, 2, { b: 3 }] });
  assert.equal((await call(f, "patos.storage.get('nope')")).ok, null);
  assert.deepEqual((await call(f, "patos.storage.keys()")).ok, ['k']);
  assert.match((await call(f, "patos.storage.set('x'.repeat(101), 1)")).err, /Keys are text/);
  assert.match((await call(f, "patos.storage.set('big', 'x'.repeat(5200000))")).err, /5 MB/);
  // the box
  const box = await f.evaluate(() => { const o = {}; try { o.parent = typeof parent.document; } catch (e) { o.parent = 'blocked'; } try { o.ls = typeof localStorage.getItem('a'); } catch (e) { o.ls = 'blocked'; } try { o.cookie = document.cookie; } catch (e) { o.cookie = 'blocked'; } try { o.idb = typeof indexedDB.open; } catch (e) { o.idb = 'blocked'; } try { o.win = typeof window.open('about:blank'); } catch (e) { o.win = 'blocked'; } try { o.top = typeof top.PatOS; } catch (e) { o.top = 'blocked'; } return o; });
  assert.equal(box.parent, 'blocked'); assert.equal(box.ls, 'blocked'); assert.equal(box.cookie, 'blocked'); assert.equal(box.top, 'blocked');
  // what the page itself can do (measured from inside, because the test tool bypasses a page's own rules)
  await page.evaluate(async (app) => { await PatOS.patapps.install(app, { source: 'file' }); PatOS.launch('pa:com.test.csp'); }, APP({ id: 'com.test.csp', name: 'Csp', permissions: [], html: '<div id="r"></div><script>var o=[];try{eval("1");o.push("eval allowed")}catch(e){o.push("eval blocked")}try{new Function("return 1")();o.push("fn allowed")}catch(e){o.push("fn blocked")}fetch("https://example.com/").then(function(){o.push("fetch allowed")},function(){o.push("fetch blocked")});var i=new Image();i.onload=function(){o.push("image allowed")};i.onerror=function(){o.push("image blocked")};i.src="https://example.com/x.png";setTimeout(function(){document.getElementById("r").textContent=o.join("|")},1200);<\/script>' }));
  const cf = await frameOf(page, 'com.test.csp'); await page.waitForTimeout(1800);
  assert.equal(await cf.evaluate(() => document.getElementById('r').textContent), 'eval blocked|fn blocked|fetch blocked|image blocked', 'no code from text, and no internet unless it asks for it');
  assert.equal((await call(f, "patos.nothing()")).err !== undefined, true);
  await page.close();
  assert.deepEqual(errors, []);
});

test('permissions: asked on first use, remembered, refused when not declared, and all of it is logged', { skip: skipNoBrowser }, async () => {
  const { page } = await setup();
  await page.evaluate(async (app) => { await PatOS.patapps.install(app, { source: 'file' }); window.__asked.length = 0; PatOS.launch('pa:com.test.probe'); }, APP());
  const f = await frameOf(page, 'com.test.probe');
  // say no the first time
  await page.evaluate(() => { window.__answer = false; });
  assert.match((await call(f, "patos.notify({title:'Hi'})")).err, /did not allow/);
  assert.equal(await page.evaluate(() => window.__notes.filter((n) => n.icon === 'pa:com.test.probe').length), 0);
  assert.equal(await page.evaluate(() => window.__asked.length), 1);
  const q = await page.evaluate(() => window.__asked[0]); assert.match(q.title, /Allow “Probe”/); assert.match(q.text, /show notifications/); assert.match(q.ok, /Allow Notifications/);
  assert.match((await call(f, "patos.notify({title:'Hi'})")).err, /did not allow/); assert.equal(await page.evaluate(() => window.__asked.length), 1, 'the answer is remembered, it is not asked again');
  // change it in Privacy (here: setGrant), then it works
  await page.evaluate(() => PatOS.patapps.setGrant('com.test.probe', 'notifications', 'allow'));
  assert.equal((await call(f, "patos.notify({title:'Hi', body:'There'})")).ok, true);
  const note = await page.evaluate(() => window.__notes.find((n) => n.icon === 'pa:com.test.probe')); assert.equal(note.title, 'Hi'); assert.equal(note.body, 'There'); assert.equal(note.icon, 'pa:com.test.probe');
  // files: only inside the app's own folder
  await page.evaluate(() => { window.__answer = true; });
  assert.equal((await call(f, "patos.files.write('notes/a.txt', 'hello')")).ok, true);
  assert.equal(await page.evaluate(() => PatOS.fs.read('/Documents/Apps/Probe/notes/a.txt')), 'hello');
  assert.equal((await call(f, "patos.files.read('notes/a.txt')")).ok, 'hello');
  assert.deepEqual((await call(f, "patos.files.list('notes')")).ok, [{ name: 'a.txt', folder: false, size: 5 }]);
  for (const bad of ["'../x.txt'", "'a/../../x'", "''", "'/..'"]) assert.match((await call(f, 'patos.files.write(' + bad + ", 'x')")).err, /not a valid file name/, bad);
  assert.equal(await page.evaluate(() => PatOS.fs.exists('/Documents/x.txt')), false);
  assert.equal((await call(f, "patos.files.remove('notes/a.txt')")).ok, true); assert.equal(await page.evaluate(() => PatOS.fs.exists('/Documents/Apps/Probe/notes/a.txt')), false);
  // not declared: refused without even asking
  const before = await page.evaluate(() => window.__asked.length);
  assert.match((await call(f, "patos.camera.snapshot()")).err, /did not ask for the camera/); assert.match((await call(f, "patos.location.get()")).err, /did not ask/); assert.match((await call(f, "patos.clipboard.write('x')")).err, /did not ask/);
  assert.equal(await page.evaluate(() => window.__asked.length), before);
  const log = await page.evaluate(() => PatOS.patapps.logOf().map((x) => x.perm + ':' + x.what));
  assert.ok(log.includes('notifications:denied') && log.includes('notifications:blocked') && log.includes('notifications:used') && log.includes('files:allowed') && log.includes('files:used') && log.includes('camera:blocked'), log.join());
  await page.close();
});

test('Settings › Privacy shows each app, lets you take permission back, and the activity trail', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup();
  await page.evaluate(async (app) => { await PatOS.patapps.install(app, { source: 'file' }); PatOS.patapps.setGrant('com.test.probe', 'files', 'allow'); PatOS.launch('pa:com.test.probe'); }, APP());
  const f = await frameOf(page, 'com.test.probe'); await call(f, "patos.files.write('a.txt','x')");
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const o = {};
    const w = PatOS.launch('settings', { pane: 'privacy' }); await wait(700);
    o.head = w.body.querySelector('.pv').innerText;
    const sw = [...w.body.querySelectorAll('.pv .switch')]; o.switches = sw.filter((x) => !x.closest('.pv-tl')).length; /* the permission switches, not the Timeline ones */ o.filesOn = sw.find((x) => x.getAttribute('aria-label') === 'Files').classList.contains('on');
    sw.find((x) => x.getAttribute('aria-label') === 'Files').click(); await wait(300); o.grant = PatOS.patapps.grants('com.test.probe').files;
    o.log = w.body.querySelector('.pv-log').innerText;
    [...w.body.querySelectorAll('.pv .btn')].find((x) => /Clear Activity/.test(x.textContent)).click(); await wait(300); o.cleared = PatOS.patapps.logOf().length;
    return o;
  });
  assert.match(r.head, /Probe 1\.0\.0/); assert.equal(r.switches, 2); assert.equal(r.filesOn, true); assert.equal(r.grant, 'deny'); assert.match(r.log, /Probe/); assert.match(r.log, /Files/); assert.equal(r.cleared, 0);
  await page.close(); assert.deepEqual(errors, []);
});

test('updates keep data and permissions; removing an app removes them; apps survive a restart and arrive through Sync', { skip: skipNoBrowser }, async () => {
  const { page } = await setup();
  await page.evaluate(async (app) => { await PatOS.patapps.install(app, { source: 'file' }); PatOS.patapps.setGrant('com.test.probe', 'files', 'allow'); PatOS.launch('pa:com.test.probe'); }, APP());
  let f = await frameOf(page, 'com.test.probe'); await call(f, "patos.storage.set('keep', 42)");
  const up = await page.evaluate(async (app) => { window.__asked.length = 0; const ok = await PatOS.patapps.install(app, { source: 'file' }); return { ok, ask: window.__asked[0].title, version: PatOS.patapps.get('com.test.probe').version, grant: PatOS.patapps.grants('com.test.probe').files, data: PatOS.store.get('patAppData', {})['com.test.probe'], order: PatOS.appOrder.filter((x) => x === 'pa:com.test.probe').length }; }, APP({ version: '1.1.0', html: '<h1 id="h">probe two</h1>' }));
  assert.equal(up.ok, true); assert.match(up.ask, /Update “Probe” 1\.1\.0/); assert.equal(up.version, '1.1.0'); assert.equal(up.grant, 'allow'); assert.deepEqual(up.data, { keep: 42 }); assert.equal(up.order, 1);
  // an older file asks first
  const old = await page.evaluate(async (app) => { window.__asked.length = 0; window.__answer = false; const ok = await PatOS.patapps.install(app, { source: 'file' }); window.__answer = true; return { ok, ask: window.__asked[0].title, version: PatOS.patapps.get('com.test.probe').version }; }, APP({ version: '0.9.0' }));
  assert.deepEqual(old, { ok: false, ask: 'Install an older version?', version: '1.1.0' });
  // a restart: still there, with its data
  await page.evaluate(() => PatOS.flush()); await reload(page); await stub(page);
  assert.deepEqual(await page.evaluate(() => [!!PatOS.apps['pa:com.test.probe'], PatOS.store.get('patAppData', {})['com.test.probe'].keep, PatOS.patapps.grants('com.test.probe').files]), [true, 42, 'allow']);
  // what Sync does: another device's apps arrive in the saved list, and the app appears (and goes away)
  const saved = await page.evaluate(() => PatOS.store.get('patApps'));
  await page.evaluate(async () => { await PatOS.patapps.uninstall('com.test.probe'); });
  const gone = await page.evaluate(() => ({ app: !!PatOS.apps['pa:com.test.probe'], icon: !!PatOS.iconDefs['pa:com.test.probe'], data: PatOS.store.get('patAppData', {})['com.test.probe'], grants: PatOS.patapps.grants('com.test.probe'), list: PatOS.patapps.list().length }));
  assert.deepEqual(gone, { app: false, icon: false, data: undefined, grants: {}, list: 0 });
  assert.equal(await page.evaluate((s) => { PatOS.store.set('patApps', s); return !!PatOS.apps['pa:com.test.probe']; }, saved), true, 'an app that arrives through Sync shows up by itself');
  assert.equal(await page.evaluate(() => { PatOS.store.set('patApps', {}); return !!PatOS.apps['pa:com.test.probe']; }), false);
  await page.close();
});

test('an app written in PitCode runs with the language provided; the others cannot build code', { skip: skipNoBrowser }, async () => {
  const { page } = await setup();
  await page.evaluate(async (app) => { await PatOS.patapps.install(app, { source: 'file' }); PatOS.launch('pa:com.test.pit'); }, APP({ id: 'com.test.pit', name: 'Pit', engine: 'pitcode', permissions: [], html: '<div id="root"></div><script>PitCode.run("say 1 + 2", {write: function (t) { document.getElementById("root").textContent = "out:" + t.trim(); }});<\/script>' }));
  const f = await frameOf(page, 'com.test.pit');
  await page.waitForFunction(() => true); await page.waitForTimeout(800);
  assert.equal(await f.evaluate(() => document.getElementById('root').textContent), 'out:3');
  assert.equal(await f.evaluate(() => { try { return typeof parent.document; } catch (e) { return 'blocked'; } }), 'blocked');
  await page.close();
});

test('the store: send an app, the owner accepts it, and it can be installed as a checked app', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup();
  const ticket = await page.evaluate((app) => PatOS.patapps.submit(app), APP({ id: 'com.test.shared', name: 'Shared' }));
  assert.match(ticket, /^[A-Za-z0-9_-]{16,}$/);
  assert.equal(await page.evaluate(async () => (await PatOS.patapps.store.list()).length), 0, 'not public yet');
  assert.equal(await page.evaluate(async () => (await PatOS.patapps.refreshSubmits())[0].status), 'pending');
  const login = await (await fetch(srv.base + '/api/apps/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'browser-test-pw' }) })).json();
  const d = await (await fetch(srv.base + '/api/apps/admin/decide', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token }, body: JSON.stringify({ id: 'com.test.shared', decision: 'accept', note: 'Looks good' }) })).json();
  assert.equal(d.status, 'accepted');
  const sub = await page.evaluate(async () => (await PatOS.patapps.refreshSubmits())[0]); assert.equal(sub.status, 'accepted'); assert.equal(sub.note, 'Looks good');
  // the App Store's Community tab lists it and installs it
  const ui = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const o = {};
    const w = PatOS.launch('appstore', {}); await wait(500); w._tab('community'); await wait(1200);
    o.listed = w.body.querySelector('.as-main').innerText;
    const get = [...w.body.querySelectorAll('.as-row .as-get')].find((x) => /GET/.test(x.textContent)); get.click(); await wait(1200);
    o.installed = !!PatOS.apps['pa:com.test.shared']; o.src = PatOS.patapps.list()[0].source; o.ask = window.__asked.pop();
    w._tab('develop'); await wait(800); o.dev = w.body.querySelector('.as-main').innerText;
    return o;
  });
  assert.match(ui.listed, /Shared 1\.0\.0/); assert.equal(ui.installed, true); assert.equal(ui.src, 'store'); assert.match(ui.ask.text, /checked by the owner/);
  assert.match(ui.dev, /Accepted: it is in Community · Looks good/);
  await page.close(); assert.deepEqual(errors, []);
});

test('a .patapp file opens from Finder, and bad files say what is wrong', { skip: skipNoBrowser }, async () => {
  const { page } = await setup();
  const r = await page.evaluate(async (app) => {
    const o = {}; PatOS.alertBox = async (t, b) => { o.alert = t + ': ' + b; };
    PatOS.fs.write('/Documents/probe.patapp', JSON.stringify(app)); PatOS.openFile('/Documents/probe.patapp'); await new Promise((res) => setTimeout(res, 500)); o.installed = !!PatOS.apps['pa:com.test.probe'];
    PatOS.fs.write('/Documents/bad.patapp', '{"format":"patapp"'); PatOS.openFile('/Documents/bad.patapp'); await new Promise((res) => setTimeout(res, 500)); o.bad = o.alert;
    PatOS.fs.write('/Documents/bad2.patapp', JSON.stringify(Object.assign({}, app, { permissions: ['root'] }))); PatOS.openFile('/Documents/bad2.patapp'); await new Promise((res) => setTimeout(res, 500)); o.bad2 = o.alert;
    return o;
  }, APP());
  assert.equal(r.installed, true); assert.match(r.bad, /not a PatOS app file/); assert.match(r.bad2, /does not offer/);
  await page.close();
});

test('Develop: trying an app keeps the code in the form, and an opened .patapp file can be edited', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1200, height: 760 } }); const errors = await boot(page, srv.base, { fresh: true }); await stub(page);
  await page.evaluate(() => { PatOS.launch('appstore', { tab: 'develop' }); }); await page.waitForSelector('.as-form');
  await page.fill('.as-form input[aria-label="Name"]', 'Keeper'); await page.fill('.as-form textarea', '<h2>my code</h2>');
  await page.click('.as-form button:has-text("Install to Try It")'); await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ name: document.querySelector('.as-form input[aria-label="Name"]').value, html: document.querySelector('.as-form textarea').value, id: document.querySelector('.as-form input[aria-label^="App id"]').value, count: PatOS.patapps.list().length }));
  assert.equal(after.name, 'Keeper'); assert.equal(after.html, '<h2>my code</h2>'); assert.match(after.id, /^local\.keeper\./); assert.equal(after.count, 1);
  await page.fill('.as-form textarea', '<h2>edited</h2>'); await page.click('.as-form button:has-text("Install to Try It")'); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => PatOS.patapps.list().length), 1, 'trying again updates the same app, not a new one');
  assert.match(await page.evaluate(() => PatOS.patapps.list()[0].app.html), /edited/);
  // an installed file app can be sent back to the editor
  await page.evaluate(() => { PatOS.patappsUI.edit(PatOS.patapps.list()[0].app); }); await page.waitForTimeout(500);
  const v = await page.evaluate(() => ({ name: document.querySelector('.as-form input[aria-label="Name"]').value, html: document.querySelector('.as-form textarea').value }));
  assert.equal(v.name, 'Keeper'); assert.match(v.html, /edited/);
  // after a restart the draft is still there
  await page.evaluate(() => PatOS.flush()); await reload(page); await page.waitForSelector('#lock:not(.hidden)'); await page.evaluate(() => PatOS.boot.login());
  await page.evaluate(() => { PatOS.launch('appstore', { tab: 'develop' }); }); await page.waitForSelector('.as-form');
  assert.equal(await page.inputValue('.as-form input[aria-label="Name"]'), 'Keeper');
  assert.deepEqual(errors, []); await page.close();
});
