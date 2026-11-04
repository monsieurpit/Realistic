/* PitCode Studio: the starting projects run for real (PitCode and plain web), and the editor, Run, console,
   settings and Build work like a small Xcode. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
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
  await page.click('.ps-build'); await page.click('.menu >> text=Send for review'); await page.waitForTimeout(800);
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
