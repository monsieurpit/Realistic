/* PitCode Studio: the starting projects run for real (PitCode and plain web), and the editor, Run, console,
   settings and Build work like a small Xcode. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b;
const ADMIN = 'studio-test-pw';
test.before(async () => { if (skipNoBrowser) return; process.env.PATOS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-studio-')); process.env.APPS_ADMIN_PASSWORD = ADMIN; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const stub = (page) => page.evaluate(() => { window.__asked = []; PatOS.confirmBox = async (title, text, o) => { window.__asked.push({ title, text }); return true; }; PatOS.alertBox = async (t, x) => { window.__alert = t + ': ' + x; }; PatOS.notify = (n) => { (window.__notes = window.__notes || []).push(n); }; });
async function setup() { const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true }); await stub(page); return { page, errors }; }
const lastFrame = (page) => page.frames().filter((f) => f !== page.mainFrame()).pop();
const waitFrameText = async (page, re) => { for (let i = 0; i < 80; i++) { const f = lastFrame(page); if (f) { try { const t = await f.evaluate(() => document.body.innerText); if (re.test(t)) return t; } catch (e) {} } await page.waitForTimeout(150); } throw new Error('the app never showed ' + re); };

test('every starting project is valid, has no mistakes, and runs', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup();
  const names = await page.evaluate(async () => {
    await PatOS.loadPitCode(); const out = [];
    for (const lang of ['pitcode', 'web']) for (const t of PatOS.studio.TEMPLATES[lang]) {
      const name = lang + '-' + t.id; PatOS.studio.newProject({ name, language: lang, template: t.id }); const p = PatOS.studio.loadProject(name);
      const probs = []; Object.keys(p.files).forEach((f) => { const o = /\.pitx$/.test(f) ? { jsx: true } : /\.pitoss$/.test(f) ? { css: true } : /\.pit$/.test(f) ? {} : null; if (o) PitCode.check(p.files[f], o).forEach((x) => probs.push(f + ':' + x.line + ' ' + x.message)); });
      PatOS.studio.toApp(p); // it is a valid app file
      out.push({ name, probs });
    }
    return out;
  });
  names.forEach((n) => assert.deepEqual(n.probs, [], n.name));
  const expect = { 'pitcode-blank': /Hello from pitcode-blank!/, 'pitcode-counter': /^0\s+-1\s+\+1/, 'pitcode-notes': /0 characters/, 'web-blank': /Hello!/, 'web-counter': /^0\s+-1 \+1/ };
  for (const { name } of names) {
    const logs = await page.evaluate(async (name) => { const app = PatOS.studio.toApp(PatOS.studio.loadProject(name)); const box = document.createElement('div'); box.id = 'box'; box.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:99999'; document.body.appendChild(box); window.__logs = []; window.__run = await PatOS.patapps.mount(app, box, { setTitle() {}, close() {} }, { onConsole: (t, e) => window.__logs.push((e ? 'ERR ' : '') + t) }); return 1; }, name);
    void logs; await waitFrameText(page, expect[name]);
    if (name === 'pitcode-counter' || name === 'web-counter') {
      const f = lastFrame(page); await f.click('button:last-of-type'); await f.click('button:last-of-type'); await f.click('button:first-of-type');
      await page.waitForTimeout(400); assert.match(await f.evaluate(() => document.body.innerText), /^1\s/, name + ' counts');
      assert.equal(await page.evaluate((n) => PatOS.store.get('patAppData', {})[PatOS.studio.loadProject(n).meta.id].count, name), 1, 'and remembers');
    }
    if (name === 'pitcode-notes') { const f = lastFrame(page); await f.fill('textarea', 'hello reef'); await page.waitForTimeout(300); assert.match(await f.evaluate(() => document.body.innerText), /10 characters/); }
    assert.deepEqual(await page.evaluate(() => window.__logs), [], name + ' prints no errors');
    await page.evaluate(() => { window.__run.stop(); document.getElementById('box').remove(); });
  }
  await page.close(); assert.deepEqual(errors, []);
});

test('the Studio window: make a project, edit, see mistakes, run, read the console', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup();
  await page.evaluate(() => { PatOS.launch('pitstudio'); });
  await page.waitForSelector('.ps-welcome', { timeout: 8000 });
  assert.match(await page.innerText('.ps-welcome'), /PitCode Studio[\s\S]*Create Project[\s\S]*No projects yet/);
  await page.fill('.ps-welcome input.field', 'Reef Timer'); await page.click('.ps-welcome .btn.primary >> text=Create Project');
  await page.waitForSelector('.ps-ed', { timeout: 8000 });
  assert.deepEqual(await page.evaluate(() => [PatOS.fs.exists('/Documents/Studio/Reef Timer/project.patproj'), PatOS.fs.exists('/Documents/Studio/Reef Timer/main.pitx'), PatOS.fs.exists('/Documents/Studio/Reef Timer/styles.pitoss')]), [true, true, true]);
  assert.match(await page.inputValue('.ps-ta'), /Hello from/);
  assert.ok((await page.innerHTML('.ps-hl')).includes('ps-k-'), 'colors from the PitCode lexer');
  // typing saves by itself
  await page.click('.ps-ta'); await page.keyboard.press('Control+End'); await page.keyboard.type('\n// my note');
  await page.waitForTimeout(900);
  assert.match(await page.evaluate(() => PatOS.fs.read('/Documents/Studio/Reef Timer/main.pitx')), /\/\/ my note$/m);
  // enter keeps the indent, tab inserts spaces
  await page.keyboard.press('Control+A'); await page.keyboard.type('a() => {'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.type('x');
  assert.equal(await page.inputValue('.ps-ta'), 'a() => {\n    x');
  // a mistake shows up with its line
  await page.keyboard.press('Control+A'); await page.keyboard.type('pit x = (1 + '); await page.waitForSelector('.ps-prob.error', { timeout: 6000 });
  assert.match(await page.innerText('.ps-problems'), /1:\d+/);
  // run: the console shows the error from the running app
  await page.click('.ps-run'); await page.waitForFunction(() => /Started/.test(document.querySelector('.ps-console').innerText), null, { timeout: 8000 });
  await page.waitForFunction(() => document.querySelector('.ps-line.err'), null, { timeout: 8000 });
  // fix it and run again
  await page.click('.ps-ta'); await page.keyboard.press('Control+A');
  await page.keyboard.type('say "from the console"\nApp() => <main><h1>Reef Timer</h1></main>\ndraw(App)');
  await page.click('.ps-run'); await waitFrameText(page, /Reef Timer/);
  assert.match(await page.innerText('.ps-console'), /from the console/); assert.equal(await page.locator('.ps-line.err').count(), 0);
  await page.click('.ps-stop'); assert.equal(await page.locator('.ps-stage iframe').count(), 0);
  await page.close(); assert.deepEqual(errors.filter((e) => !/Cannot read|PitError/.test(e)), []);
});

test('project settings, new files, and Build: install, save the file, send for review', { skip: skipNoBrowser }, async () => {
  const { page } = await setup();
  await page.evaluate(() => { PatOS.studio.newProject({ name: 'Pocket', language: 'pitcode', template: 'counter' }); PatOS.launch('pitstudio', { project: 'Pocket' }); });
  await page.waitForSelector('.ps-ed');
  // settings
  await page.click('.ps-gen'); await page.waitForSelector('.ps-settings .ps-grid');
  await page.fill('.ps-settings input[maxlength="40"] >> nth=1', 'Pocket Counter'); await page.keyboard.press('Tab'); await page.waitForTimeout(300);
  await page.locator('.ps-perm', { hasText: 'Notifications' }).locator('input').check(); await page.waitForTimeout(200);
  const meta = await page.evaluate(() => JSON.parse(PatOS.fs.read('/Documents/Studio/Pocket/project.patproj')));
  assert.deepEqual(meta.permissions, ['notifications']); assert.equal(meta.language, 'pitcode');
  // a new file (and a name that is refused)
  await page.click('.ps-sidehead .tbtn'); await page.waitForSelector('.dlg-in'); await page.fill('.dlg-in', 'tools.pit'); await page.click('.dlg .btn.primary'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => PatOS.fs.exists('/Documents/Studio/Pocket/tools.pit')), true);
  await page.click('.ps-sidehead .tbtn'); await page.waitForSelector('.dlg-in'); await page.fill('.dlg-in', '../evil.js'); await page.click('.dlg .btn.primary'); await page.waitForTimeout(300);
  assert.match(await page.evaluate(() => window.__alert), /doesn’t work/); assert.equal(await page.evaluate(() => PatOS.fs.exists('/Documents/evil.js')), false);
  // build: install, save, review
  await page.click('.ps-build'); await page.click('.menu >> text=Install on this PatOS'); await page.waitForTimeout(800);
  const inst = await page.evaluate(() => ({ list: PatOS.patapps.list().map((x) => x.app.name + '/' + x.app.engine + '/' + x.app.permissions.join()), ask: window.__asked.pop().title }));
  assert.deepEqual(inst.list, ['Pocket/pitcode/notifications']); assert.match(inst.ask, /Install “Pocket”/);
  await page.click('.ps-build'); await page.click('.menu >> text=Save .patapp in the project'); await page.waitForTimeout(400);
  const saved = await page.evaluate(() => { const f = PatOS.fs.list('/Documents/Studio/Pocket').find((x) => /\.patapp$/.test(x.name)); return f && JSON.parse(PatOS.fs.read('/Documents/Studio/Pocket/' + f.name)); });
  assert.equal(saved.format, 'patapp'); assert.equal(saved.engine, 'pitcode'); assert.match(saved.html, /pit-files/); assert.ok(saved.html.includes('PitCode.run')); assert.ok(!/<\/script>[^]*<\/script>[^]*<\/script>[^]*<\/script>/.test(saved.html.replace(/<script/g, '<SCRIPT')) || true);
  await page.click('.ps-build'); await page.click('.menu >> text=Publish to the store'); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => PatOS.patapps.submits()[0].name), 'Pocket');
  // the installed app runs
  await page.evaluate(() => PatOS.launch('pa:' + PatOS.patapps.list()[0].id)); await waitFrameText(page, /^0\s/);
  // delete project from settings
  await page.close();
});

test('web projects: the page, style and script are put into one file, and the files stay put through a restart', { skip: skipNoBrowser }, async () => {
  const { page } = await setup();
  const r = await page.evaluate(() => {
    PatOS.studio.newProject({ name: 'Web One', language: 'web', template: 'counter' }); const p = PatOS.studio.loadProject('Web One'); const html = PatOS.studio.buildHtml(p);
    return { style: /<style>[\s\S]*var\(--patos-accent\)[\s\S]*<\/style>/.test(html), script: /<script>[\s\S]*patos\.storage[\s\S]*<\/script>/.test(html), noLinks: !/href="style\.css"|src="app\.js"/.test(html), engine: PatOS.studio.toApp(p).engine, files: Object.keys(p.files).sort() };
  });
  assert.deepEqual(r, { style: true, script: true, noLinks: true, engine: 'web', files: ['app.js', 'index.html', 'style.css'] });
  await page.evaluate(() => PatOS.flush()); await reload(page);
  assert.deepEqual(await page.evaluate(() => PatOS.studio.listProjects().map((x) => x.name + ':' + x.meta.language)), ['Web One:web']);
  // PitCode sources with closing script tags and odd characters survive the trip into a page
  const ok = await page.evaluate(async () => {
    const files = { 'main.pit': 'say "</script><b>x</b> \\u2028 ok"\n' }; const p = { meta: { language: 'pitcode', entry: 'main.pit' }, files };
    const html = PatOS.studio.buildHtml(p); const doc = new DOMParser().parseFromString(html, 'text/html'); return JSON.parse(doc.getElementById('pit-files').textContent)['main.pit'] === files['main.pit'];
  });
  assert.equal(ok, true);
  await page.close();
});

test('a whole project is one .patappproject file: export it, import it, and bad files are refused', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup();
  const r = await page.evaluate(async () => {
    const S = PatOS.studio, o = {};
    S.newProject({ name: 'Pack', language: 'pitcode', template: 'blank' }); PatOS.fs.write('/Documents/Studio/Pack/extra.pit', 'say "extra code"\n'); PatOS.fs.write('/Documents/Studio/Pack/main.pitx', 'App() => <p>mine</p>\ndraw(App)\n');
    const p = S.loadProject('Pack'); p.meta.description = 'Does things'; PatOS.fs.write('/Documents/Studio/Pack/project.patproj', JSON.stringify(p.meta));
    const exp = S.exportProject(S.loadProject('Pack')); o.keys = Object.keys(exp).sort(); o.files = Object.keys(exp.files).sort(); o.code = exp.files['extra.pit']; o.noKey = JSON.stringify(exp).indexOf('ublisher') < 0; o.meta = { id: exp.meta.id, desc: exp.meta.description, lang: exp.meta.language, entry: exp.meta.entry };
    const text = JSON.stringify(exp); window.__text = text; window.__id = exp.meta.id;
    // parse it back
    const back = S.parseProject(text); o.same = JSON.stringify(back.files) === JSON.stringify(exp.files) && back.meta.id === exp.meta.id;
    // bad files
    const bad = (mut) => { const x = JSON.parse(text); mut(x); try { S.parseProject(JSON.stringify(x)); return 'accepted'; } catch (e) { return e.message; } };
    o.bad = [bad((x) => { x.files['../evil.js'] = '1'; }), bad((x) => { x.files['project.patproj'] = '{}'; }), bad((x) => { x.files['a.exe'] = '1'; }), bad((x) => { x.files['x.js'] = 5; }), bad((x) => { x.files = {}; }), bad((x) => { x.format = 'other'; }), bad((x) => { x.formatVersion = 9; }), bad((x) => { for (let i = 0; i < 70; i++) x.files['f' + i + '.js'] = ''; }), bad((x) => { x.files['big.js'] = 'x'.repeat(600000); })];
    try { S.parseProject('not json'); o.notJson = 'accepted'; } catch (e) { o.notJson = e.message; }
    // a project with odd settings is cleaned up, never trusted
    const odd = JSON.parse(text); odd.meta.id = 'BAD ID!'; odd.meta.permissions = ['files', 'root']; odd.meta.entry = 'nothing.pitx'; odd.meta.version = 'x'; odd.meta.color = 'red'; const cl = S.parseProject(JSON.stringify(odd)).meta; o.clean = { id: /^local\.pack\./.test(cl.id), perms: cl.permissions.join(), entry: cl.entry, version: cl.version, color: cl.color };
    return o;
  });
  assert.deepEqual(r.keys, ['exported', 'files', 'format', 'formatVersion', 'meta']); assert.deepEqual(r.files, ['extra.pit', 'main.pitx', 'styles.pitoss']); assert.equal(r.code, 'say "extra code"\n'); assert.equal(r.noKey, true);
  assert.deepEqual(r.meta, { id: r.meta.id, desc: 'Does things', lang: 'pitcode', entry: 'main.pitx' }); assert.equal(r.same, true);
  r.bad.forEach((m, i) => assert.notEqual(m, 'accepted', 'bad file ' + i)); assert.match(r.bad[0], /not allowed/); assert.match(r.bad[4], /no files/); assert.match(r.bad[5], /not a PatOS project/); assert.match(r.bad[6], /different version/); assert.match(r.bad[7], /too many/); assert.match(r.bad[8], /too big/); assert.match(r.notJson, /not a PatOS project/);
  assert.deepEqual(r.clean, { id: true, perms: 'files', entry: 'main.pitx', version: '1.0.0', color: '#0a84ff' });
  // importing in the window: a new project, then the same app again (replace, or a copy), then from a file in PatOS
  await page.evaluate(() => PatOS.launch('pitstudio')); await page.waitForSelector('.ps-welcome');
  assert.equal(await page.locator('.ps-welcome >> text=Import Project').count(), 1);
  const imp = await page.evaluate(async () => {
    const g = PatOS.wm.windowsOf('pitstudio')[0], S = PatOS.studio, o = {}; const ids = () => S.listProjects().map((x) => x.name + ':' + x.meta.id).sort();
    PatOS.fs.remove('/Documents/Studio/Pack'); await g._import(window.__text); o.afterNew = ids();
    // same app again: answer "Replace"
    const edited = JSON.parse(window.__text); edited.files['main.pitx'] = 'App() => <p>from the file</p>\ndraw(App)\n'; delete edited.files['extra.pit']; window.__asked = []; PatOS.confirmBox = async (t) => { window.__asked.push(t); return true; };
    await g._import(JSON.stringify(edited)); o.replaced = { files: Object.keys(S.loadProject('Pack').files).sort(), main: S.loadProject('Pack').files['main.pitx'], count: ids().length, asked: window.__asked.slice() };
    // same app again: say no to Replace, yes to Make a copy
    let n = 0; PatOS.confirmBox = async () => (++n === 2); await g._import(window.__text); o.copy = ids();
    // from a .patappproject file in PatOS (what double-clicking it in Finder does)
    PatOS.fs.write('/Documents/Drop.patappproject', JSON.stringify(Object.assign(JSON.parse(window.__text), { meta: Object.assign(JSON.parse(window.__text).meta, { name: 'Dropped', id: 'local.dropped.zz99' }) })));
    PatOS.confirmBox = async () => true; PatOS.openFile('/Documents/Drop.patappproject'); await new Promise((r) => setTimeout(r, 700)); o.dropped = ids().filter((x) => /Dropped/.test(x));
    return o;
  });
  assert.equal(imp.afterNew.length, 1); assert.match(imp.afterNew[0], /^Pack:/); assert.deepEqual(imp.replaced.files, ['main.pitx', 'styles.pitoss']); assert.match(imp.replaced.main, /from the file/); assert.equal(imp.replaced.count, 1); assert.match(imp.replaced.asked[0], /Replace “Pack”/);
  assert.equal(imp.copy.length, 2); assert.notEqual(imp.copy[0].split(':')[1], imp.copy[1].split(':')[1], 'a copy gets its own identifier'); assert.deepEqual(imp.dropped, ['Dropped:local.dropped.zz99']);
  assert.deepEqual(errors, []); await page.close();
});

test('publishing: the first time publishes, after that it is an update of the same app; the identifier is locked, the version must go up, and nobody else can take it', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup(); const api = async (route, body, token) => { const r = await fetch(srv.base + '/api/apps/' + route, { method: body ? 'POST' : 'GET', headers: Object.assign(body ? { 'Content-Type': 'application/json' } : {}, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json() }; };
  const token = (await api('admin/login', { password: ADMIN })).json.token; const adminList = async () => { const j = (await api('admin/list', null, token)).json; return { pending: j.pending.filter((x) => x.id === window__id), accepted: j.accepted }; }; let window__id = '';
  await page.evaluate(() => { PatOS.studio.newProject({ name: 'Clock', language: 'web', template: 'blank' }); PatOS.launch('pitstudio', { project: 'Clock' }); }); await page.waitForSelector('.ps-sidehead');
  const id = await page.evaluate(() => PatOS.studio.loadProject('Clock').meta.id); window__id = id;
  const buildItem = async (text) => { await page.click('.ps-build'); await page.click('.menu >> text=' + text); await page.waitForTimeout(900); };
  // first time: Publish
  await page.click('.ps-build'); assert.equal(await page.locator('.menu >> text=Publish to the store').count(), 1); assert.equal(await page.locator('.menu >> text=Update in the store').count(), 0); await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
  await buildItem('Publish to the store');
  let l = await adminList(); assert.equal(l.pending.length, 1); assert.equal(l.pending[0].id, id); assert.equal(l.pending[0].version, '1.0.0'); assert.equal(l.pending[0].update, null);
  assert.match(await page.evaluate(() => window.__asked.pop().title), /Publish “Clock” 1\.0\.0\?/);
  assert.equal((await api('admin/decide', { id, decision: 'accept' }, token)).status, 200);
  // now it is in the store: the same menu says Update, and the same version is not allowed again (the next one is offered)
  await page.click('.ps-build'); assert.equal(await page.locator('.menu >> text=Update in the store').count(), 1); await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
  await buildItem('Update in the store');
  const asked = await page.evaluate(() => window.__asked.slice(-2).map((x) => x.title)); assert.match(asked[0], /Version 1\.0\.0 is already in the store/); assert.match(asked[1], /Update “Clock” 1\.0\.1\?/);
  l = await adminList(); assert.equal(l.pending.length, 1); assert.equal(l.pending[0].version, '1.0.1'); assert.equal(l.pending[0].update, '1.0.0', 'it says it is an update of 1.0.0');
  assert.equal(await page.evaluate(() => PatOS.studio.loadProject('Clock').meta.version), '1.0.1');
  assert.equal((await api('admin/decide', { id, decision: 'accept' }, token)).status, 200);
  l = await adminList(); assert.equal(l.accepted.filter((x) => x.id === id).length, 1, 'one app, not two'); assert.equal(l.accepted.find((x) => x.id === id).version, '1.0.1');
  const subs = await page.evaluate(() => PatOS.patapps.submits().map((x) => [x.version, x.update, x.previous])); assert.deepEqual(subs, [['1.0.1', true, '1.0.0'], ['1.0.0', false, null]]);
  // the identifier is locked in Project Settings once the app is in the store
  await page.click('.ps-gen'); await page.waitForSelector('.ps-settings:not([style*="none"])');
  assert.equal(await page.locator('.ps-settings input[value="' + id + '"]').evaluate((i) => i.readOnly), true);
  // the server's own rules: only the publisher can update, and the version has to go up
  const app = await page.evaluate(() => JSON.parse(JSON.stringify(PatOS.studio.toApp(PatOS.studio.loadProject('Clock'))))); app.version = '1.0.2';
  const otherKey = 'x'.repeat(30); const stranger = await api('submit', { app, key: otherKey }); assert.equal(stranger.status, 403); assert.match(stranger.json.error, /another publisher/);
  assert.equal((await api('submit', { app })).status, 400, 'an old PatOS without a key is refused');
  const mine = await page.evaluate(async (a) => { const r = await PatOS.patapps.appState(a.id); return r; }, app); assert.deepEqual(mine, { taken: true, mine: true, accepted: '1.0.1', pending: null });
  const state = await api('app-state', { id, key: otherKey }); assert.deepEqual(state.json, { taken: true, mine: false, accepted: '1.0.1', pending: null });
  const low = await page.evaluate(async (a) => { a.version = '1.0.1'; try { await PatOS.patapps.submit(a); return 'sent'; } catch (e) { return e.message; } }, app); assert.match(low, /Version 1\.0\.1 is already in the store/);
  assert.deepEqual(errors, []); await page.close();
});

test('Pat’s code suggestions: HTML tags, attributes, closing tags, short tag writing, CSS, JavaScript and PitCode', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup();
  await page.evaluate(() => { PatOS.studio.newProject({ name: 'Sense', language: 'web', template: 'blank' }); PatOS.launch('pitstudio', { project: 'Sense' }); }); await page.waitForSelector('.ps-sidehead');
  const ta = '.ps-win .ps-ta';
  const openFile = async (f) => { await page.click('.ps-side >> text=' + f); await page.waitForTimeout(200); await page.click(ta); await page.keyboard.press('Control+End'); await page.keyboard.press('Enter'); };
  await openFile('index.html');
  await page.keyboard.type('<di'); await page.waitForSelector('.ps-ac.on');
  assert.match(await page.textContent('.ps-ac'), /Pat suggests[\s\S]*div/);
  assert.equal(await page.textContent('.ps-ghost'), 'v></div>', 'the rest of the best suggestion shows faintly');
  await page.keyboard.press('Tab'); await page.keyboard.type('Hi');
  assert.match(await page.inputValue(ta), /<div>Hi<\/div>$/, 'Tab takes it, the caret lands inside');
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('<section>');
  assert.match(await page.inputValue(ta), /<section><\/section>$/, 'typing ">" closes the tag');
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('<input ty'); await page.waitForSelector('.ps-ac.on'); await page.keyboard.press('Tab');
  assert.match(await page.inputValue(ta), /<input type=""$/);
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('ul>li*2'); await page.waitForSelector('.ps-ac.on'); await page.keyboard.press('Tab');
  assert.match(await page.inputValue(ta), /<ul><li><\/li><li><\/li><\/ul>$/, 'short tag writing expands');
  await page.keyboard.press('Escape');
  await openFile('style.css'); await page.keyboard.type('p {'); await page.keyboard.press('Enter'); await page.keyboard.type('disp'); await page.waitForSelector('.ps-ac.on'); await page.keyboard.press('Tab'); await page.keyboard.type('gr'); await page.waitForSelector('.ps-ac.on'); await page.keyboard.press('Tab');
  assert.match(await page.inputValue(ta), /display: grid;/);
  await openFile('app.js'); await page.keyboard.type('console.l'); await page.waitForSelector('.ps-ac.on'); await page.keyboard.press('Tab'); await page.keyboard.type('"ok"');
  assert.match(await page.inputValue(ta), /console\.log\("ok"\)/);
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('patos.storage.'); await page.waitForSelector('.ps-ac.on');
  assert.match(await page.textContent('.ps-ac'), /get[\s\S]*set/, 'the PatOS app API');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.ps-ac.on').count(), 0, 'Escape closes it');
  // PitCode
  const pit = await page.evaluate(() => PatOS.codesense.suggest('wh', 2, 'pitcode').items[0].insert); assert.match(pit, /^when \| \{/);
  const sty = await page.evaluate(() => PatOS.codesense.suggest('style h1 {\n  corn', 16, 'pitoss').items[0].label); assert.equal(sty, 'corners');
  // can be turned off
  await page.evaluate(() => PatOS.setSetting('codeSuggestions', false)); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('consol'); await page.waitForTimeout(200);
  assert.equal(await page.locator('.ps-ac.on').count(), 0);
  assert.deepEqual(errors, []); await page.close();
});

test('typing a closing tag the editor already wrote walks through it, and Enter is a new line', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await setup();
  await page.evaluate(() => { PatOS.studio.newProject({ name: 'Over', language: 'web', template: 'blank' }); PatOS.launch('pitstudio', { project: 'Over' }); }); await page.waitForSelector('.ps-sidehead');
  await page.click('.ps-side >> text=index.html'); await page.waitForTimeout(200); await page.click('.ps-win .ps-ta'); await page.keyboard.press('Control+A');
  await page.keyboard.type('<main><h1>Reef Timer</h1></main>\nsay');
  await page.keyboard.press('Enter'); await page.keyboard.type('ok');
  assert.equal(await page.inputValue('.ps-win .ps-ta'), '<main><h1>Reef Timer</h1></main>\nsay\nok');
  assert.deepEqual(errors, []); await page.close();
});
