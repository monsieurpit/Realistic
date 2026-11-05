/* examples/device-lab.patapp: a big test app that uses every permission (files, notifications, clipboard, camera, microphone, location, internet).
   It is built from examples/device-lab/ by scripts/build-example.js. These run it for real, with a pretend camera, microphone and location. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const { startServer, boot, playwright, ROOT, skipNoBrowser } = require('../helpers');
const F = require('../../js/patapp-format.js');

const APP = path.join(ROOT, 'examples', 'device-lab.patapp'), PROJECT = path.join(ROOT, 'examples', 'device-lab.patappproject');
let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); const pw = playwright(); b = await pw.chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('the two files are valid and match their sources', () => {
  const app = JSON.parse(fs.readFileSync(APP, 'utf8')); const v = F.validate(app); assert.equal(v.ok, true, v.error);
  assert.deepEqual(v.app.permissions.slice().sort(), ['camera', 'clipboard', 'files', 'location', 'microphone', 'network', 'notifications']);
  const proj = JSON.parse(fs.readFileSync(PROJECT, 'utf8')); assert.equal(proj.format, 'patappproject'); assert.deepEqual(Object.keys(proj.files).sort(), ['app.js', 'index.html', 'style.css']);
  assert.ok(app.html.includes(proj.files['app.js'].trim().slice(0, 80)), 'the app contains the script'); assert.ok(app.html.includes('--patos-accent'), 'and the stylesheet');
  assert.equal(proj.files['app.js'], fs.readFileSync(path.join(ROOT, 'examples', 'device-lab', 'app.js'), 'utf8'), 'run node scripts/build-example.js after changing the sources');
});

async function openLab(ctx, answer) {
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(async ({ text, answer }) => {
    PatOS.confirmBox = async (title) => (/^Install/.test(title) ? true : answer); const notes = []; window.__notes = notes; const n = PatOS.notify; PatOS.notify = (o) => { notes.push(o); return n.call(PatOS, o); };
    const app = PatOS.patapps.parse(text); await PatOS.patapps.install(app, { source: 'file' }); PatOS.launch('pa:' + app.id);
  }, { text: fs.readFileSync(APP, 'utf8'), answer });
  await page.waitForSelector('iframe.pa-frame'); const f = page.frameLocator('iframe.pa-frame'); await f.locator('#runAll').waitFor(); await page.waitForTimeout(800);
  return { page, f, errors };
}

test('Run every test, with everything allowed: each permission works', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['geolocation', 'camera', 'microphone', 'clipboard-read', 'clipboard-write'], geolocation: { latitude: 45.5, longitude: -73.57, accuracy: 25 } });
  const { page, f, errors } = await openLab(ctx, true);
  await f.locator('#runAll').click();
  for (let i = 0; i < 60; i++) { if (/microphone\.record 1 s/.test(await f.locator('#report').innerText())) break; await page.waitForTimeout(500); }
  await page.waitForTimeout(1500);
  const rep = await f.locator('#report').innerText();
  ['storage.set/get', 'info', 'window.setTitle', 'files write, read, list, remove', 'notify (self test)', 'clipboard write and read', 'location.get (self test)', 'camera.snapshot (self test)', 'microphone.record 1 s (self test)'].forEach((n) => assert.match(rep, new RegExp('Works: ' + n.replace(/[().,/]/g, '\\$&')), n + '\n' + rep));
  assert.ok(!/Failed: (?!internet)/.test(rep), 'nothing but the internet may fail (a test machine can be offline):\n' + rep);
  const chips = await f.locator('#perms').innerText(); ['Files', 'Notifications', 'Clipboard', 'Camera', 'Microphone', 'Location'].forEach((p) => assert.match(chips, new RegExp(p + ': works')));
  assert.ok(await f.locator('#camImg').evaluate((i) => !i.hidden && i.src.startsWith('data:image/jpeg')), 'the photo is shown'); assert.ok(await f.locator('#micAudio').evaluate((a) => !a.hidden && a.src.startsWith('data:audio')), 'the recording can be played');
  const notes = await page.evaluate(() => window.__notes.map((n) => n.title + ': ' + n.body)); assert.ok(notes.some((n) => /Self test: notifications work/.test(n)), 'a notification really showed');
  // the buttons one by one: the file really exists in the app's folder, and the clipboard holds what was copied
  await f.locator('#fName').fill('notes/mine.txt'); await f.locator('#fText').fill('written by the test'); await f.locator('#fSave').click(); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => PatOS.fs.read('/Documents/Apps/Device Lab/notes/mine.txt')), 'written by the test');
  await f.locator('#cText').fill('copy me'); await f.locator('#cCopy').click(); await page.waitForTimeout(400); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'copy me');
  await f.locator('#locGet').click(); await page.waitForTimeout(800); assert.match(await f.locator('#locStat').innerText(), /Latitude: 45\.50000/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Refusing the permissions: every one is reported as refused, and the app does not break', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const { page, f, errors } = await openLab(ctx, false);
  await f.locator('#runAll').click(); await page.waitForTimeout(3500);
  const rep = await f.locator('#report').innerText(); assert.match(rep, /Works: storage\.set\/get/); assert.match(rep, /Works: window\.setTitle/);
  ['files write, read, list, remove', 'notify (self test)', 'clipboard write and read', 'location.get (self test)', 'camera.snapshot (self test)', 'microphone.record 1 s (self test)'].forEach((n) => assert.match(rep, new RegExp('Failed: ' + n.replace(/[().,/]/g, '\\$&')), n));
  assert.match(rep, /You did not allow this app to use the files/);
  const chips = await f.locator('#perms').innerText(); ['Files', 'Notifications', 'Clipboard', 'Camera', 'Microphone', 'Location'].forEach((p) => assert.match(chips, new RegExp(p + ': refused')));
  assert.equal(await page.evaluate(() => PatOS.fs.exists('/Documents/Apps/Device Lab/lab/self-test.txt')), false);
  assert.deepEqual(errors, []); await ctx.close();
});

/* ---- the PitCode version: examples/device-lab-pit/ (main.pitx, lab.pit, tools.pit, styles.pitoss), built by scripts/build-example-pit.js ---- */
const PIT_APP = path.join(ROOT, 'examples', 'device-lab-pit.patapp'), PIT_PROJECT = path.join(ROOT, 'examples', 'device-lab-pit.patappproject');

test('PitCode version: the files are valid, match their sources, and PitCode finds no mistakes in them', { skip: skipNoBrowser }, async () => {
  const app = JSON.parse(fs.readFileSync(PIT_APP, 'utf8')); const v = F.validate(app); assert.equal(v.ok, true, v.error); assert.equal(v.app.engine, 'pitcode'); assert.equal(v.app.permissions.length, 7);
  const proj = JSON.parse(fs.readFileSync(PIT_PROJECT, 'utf8')); assert.deepEqual(Object.keys(proj.files).sort(), ['lab.pit', 'main.pitx', 'styles.pitoss', 'tools.pit']); assert.equal(proj.meta.language, 'pitcode');
  Object.keys(proj.files).forEach((f) => assert.equal(proj.files[f], fs.readFileSync(path.join(ROOT, 'examples', 'device-lab-pit', f), 'utf8'), f + ': run node scripts/build-example-pit.js after changing the sources'));
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const probs = await page.evaluate(async (files) => { await PatOS.loadPitCode(); const out = []; Object.keys(files).forEach((n) => { const o = /\.pitx$/.test(n) ? { jsx: true } : /\.pitoss$/.test(n) ? { css: true } : {}; o.file = n; o.files = files; PitCode.check(files[n], o).forEach((p) => out.push(n + ' ' + p.severity + ' ' + p.line + ': ' + p.message)); }); return out; }, proj.files);
  assert.deepEqual(probs, []);
  // Studio imports the project file
  const imp = await page.evaluate((t) => { const p = PatOS.studio.parseProject(t); return { name: p.meta.name, entry: p.meta.entry, files: Object.keys(p.files).sort() }; }, fs.readFileSync(PIT_PROJECT, 'utf8'));
  assert.deepEqual(imp, { name: 'Device Lab PitCode', entry: 'main.pitx', files: ['lab.pit', 'main.pitx', 'styles.pitoss', 'tools.pit'] }); await page.close();
});

async function openPit(ctx, answer) {
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(async ({ text, answer }) => {
    PatOS.confirmBox = async (title) => (/^Install/.test(title) ? true : answer); const notes = []; window.__notes = notes; const n = PatOS.notify; PatOS.notify = (o) => { notes.push(o); return n.call(PatOS, o); };
    const app = PatOS.patapps.parse(text); await PatOS.patapps.install(app, { source: 'file' }); PatOS.launch('pa:' + app.id);
  }, { text: fs.readFileSync(PIT_APP, 'utf8'), answer });
  await page.waitForSelector('iframe.pa-frame'); const f = page.frameLocator('iframe.pa-frame'); await f.getByRole('button', { name: 'Run every test' }).waitFor({ timeout: 20000 }); await page.waitForTimeout(800);
  return { page, f, errors };
}

test('PitCode version: Run every test with everything allowed, each permission works', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['geolocation', 'camera', 'microphone', 'clipboard-read', 'clipboard-write'], geolocation: { latitude: 45.5, longitude: -73.57, accuracy: 25 } });
  const { page, f, errors } = await openPit(ctx, true);
  assert.match(await f.locator('.sub').innerText(), /Device Lab PitCode 1\.0\.0/);
  await f.getByRole('button', { name: 'Run every test' }).click();
  for (let i = 0; i < 80; i++) { if (/microphone\.record 1 s/.test(await f.locator('.report').innerText())) break; await page.waitForTimeout(500); }
  await page.waitForTimeout(1500);
  const rep = await f.locator('.report').innerText();
  ['storage.set/get', 'info', 'window.setTitle', 'files write, read, list, remove', 'notify (self test)', 'clipboard write and read', 'location.get (self test)', 'camera.snapshot (self test)', 'microphone.record 1 s (self test)'].forEach((n) => assert.match(rep, new RegExp('Works: ' + n.replace(/[().,/]/g, '\\$&')), n + '\n' + rep));
  assert.ok(!/Failed: (?!internet)/.test(rep), 'only the internet may fail on an offline test machine:\n' + rep);
  const chips = await f.locator('.perms').innerText(); ['Files', 'Notifications', 'Clipboard', 'Camera', 'Microphone', 'Location'].forEach((p) => assert.match(chips, new RegExp(p + ': works')));
  assert.ok(await f.locator('img.photo').count() >= 1 && (await f.locator('img.photo').first().getAttribute('src')).startsWith('data:image/jpeg'), 'the photo is shown'); assert.ok((await f.locator('audio').getAttribute('src')).startsWith('data:audio'), 'the recording can be played');
  assert.ok((await page.evaluate(() => window.__notes.map((n) => n.body))).some((n) => /Self test: notifications work/.test(n)), 'a notification really showed');
  // a few buttons one by one
  await f.locator('input[placeholder="folder/name.txt"]').fill('notes/mine.txt'); await f.locator('textarea').first().fill('written by the test'); await f.getByRole('button', { name: 'Save', exact: true }).first().click(); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => PatOS.fs.read('/Documents/Apps/Device Lab PitCode/notes/mine.txt')), 'written by the test');
  await f.getByRole('button', { name: 'Copy this text' }).click(); await page.waitForTimeout(400); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'Copied by Device Lab');
  await f.getByRole('button', { name: 'Where am I?' }).click(); await page.waitForTimeout(800); assert.match(await f.locator('.stat').innerText(), /Latitude: 45\.50000/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('PitCode version: refusing the permissions is reported as refused, and the app does not break', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const { page, f, errors } = await openPit(ctx, false);
  await f.getByRole('button', { name: 'Run every test' }).click(); await page.waitForTimeout(4000);
  const rep = await f.locator('.report').innerText(); assert.match(rep, /Works: storage\.set\/get/); assert.match(rep, /Works: window\.setTitle/);
  ['files write, read, list, remove', 'notify (self test)', 'clipboard write and read', 'location.get (self test)', 'camera.snapshot (self test)', 'microphone.record 1 s (self test)'].forEach((n) => assert.match(rep, new RegExp('Failed: ' + n.replace(/[().,/]/g, '\\$&')), n));
  const chips = await f.locator('.perms').innerText(); ['Files', 'Notifications', 'Clipboard', 'Camera', 'Microphone', 'Location'].forEach((p) => assert.match(chips, new RegExp(p + ': refused')));
  assert.deepEqual(errors, []); await ctx.close();
});
