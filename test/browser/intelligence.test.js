/* PatOS Intelligence (js/intelligence.js): deterministic commands, no AI. Parsing (intents, entities, dates), validation,
   permissions, confirmation, undo, workspaces with partial failure, Shortcuts, app-declared actions, French, and honesty. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, page;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); page = await b.newPage(); await boot(page, srv.base, { fresh: true }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('understanding: the right action and parameters, with no side effects', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(() => {
    const P = (t) => { const p = PatOS.intel.parse(t); return p ? [p.id, p.params] : null; };
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return PatOS.dateKey(d); })();
    return {
      open: P('Open Calendar.'), polite: P('could you please open the calculator for me'), recent: P('open my most recently used application'),
      latest: P('open my latest document'), rem: P('Create a reminder to finish my project tomorrow'), remList: P('show my reminders for today'),
      dark: P('Turn on dark mode'), vol: P('Set the volume to 40%'), find: P('find files containing PatOS'), notif: P('show applications that have notifications'),
      folder: P('Create a folder called Projects'), study: P('start my study workspace'), study2: P('prepare my workspace for studying'), motion: P('turn on reduce motion'),
      fr: P('crée un dossier appelé Projets'), nothing: P('flarb the wobble'), tomorrow, before: PatOS.fs.exists('/Documents/Projects')
    };
  });
  assert.deepEqual(r.open, ['app.open', { app: 'calendar' }]); assert.deepEqual(r.polite, ['app.open', { app: 'calculator' }]);
  assert.equal(r.recent[0], 'app.recent'); assert.equal(r.latest[0], 'files.latest');
  assert.deepEqual(r.rem, ['reminders.create', { text: 'finish my project', due: r.tomorrow, time: undefined }]);
  assert.equal(r.remList[0], 'reminders.list'); assert.deepEqual(r.dark, ['settings.theme', { value: 'dark' }]);
  assert.deepEqual(r.vol, ['settings.set', { key: 'volume', value: 40 }]); assert.deepEqual(r.find, ['files.find', { q: 'PatOS', inside: true }]);
  assert.equal(r.notif[0], 'notifications.apps'); assert.deepEqual(r.folder, ['folder.create', { name: 'Projects', dir: '/Documents' }]);
  assert.deepEqual(r.study, ['workspace.start', { name: 'Study' }]); assert.deepEqual(r.study2, ['workspace.start', { name: 'Study' }]);
  assert.deepEqual(r.motion, ['settings.set', { key: 'reduceMotion', value: true }]); assert.deepEqual(r.fr, ['folder.create', { name: 'Projets', dir: '/Documents' }]);
  assert.equal(r.nothing, null); assert.equal(r.before, false, 'parsing changed nothing');
});

test('doing: clear messages, real results, undo, and nothing claimed that did not happen', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const I = PatOS.intel; const o = {};
    o.folder = I.respond('create a folder called Projects'); o.made = PatOS.fs.isDir('/Documents/Projects');
    o.again = I.respond('create a folder called Projects');
    o.undo = I.respond('undo'); o.gone = PatOS.fs.exists('/Documents/Projects');
    o.vol = I.respond('set the volume to 40%'); o.volume = PatOS.settings.volume;
    o.volBad = I.respond('set the volume to 400%'); o.volume2 = PatOS.settings.volume;
    o.dark = I.respond('turn on light mode'); o.theme = PatOS.settings.theme; I.respond('undo'); o.theme2 = PatOS.settings.theme;
    o.rem = I.respond('remind me to water the plants tomorrow at 5pm'); const last = PatOS.store.get('reminders').slice(-1)[0]; o.remItem = [last.text, last.time];
    PatOS.fs.write('/Documents/Plan.txt', 'The PatOS launch plan'); o.find = I.respond('find files containing patos launch'); o.findNone = I.respond('find files containing zzzqqq');
    o.unknown = I.execute('nope.nothing', {}); o.badParam = I.execute('app.open', { app: 'not-an-app' });
    o.history = I.history().slice(-3).map((h) => h.id + ':' + h.ok);
    return o;
  });
  assert.equal(r.folder.ok, true); assert.match(r.folder.message, /Folder “Projects” created in Documents/); assert.equal(r.made, true);
  assert.equal(r.again.ok, false); assert.match(r.again.message, /already/);
  assert.equal(r.undo.ok, true); assert.equal(r.gone, false);
  assert.match(r.vol.message, /Volume set to 40%/); assert.equal(r.volume, 0.4);
  assert.equal(r.volBad.ok, false); assert.equal(r.volume2, 0.4, 'a bad value changes nothing');
  assert.equal(r.theme, 'light'); assert.equal(r.theme2, 'dark', 'undo put it back');
  assert.match(r.rem.message, /Reminder created: “water the plants” for tomorrow/); assert.deepEqual(r.remItem, ['water the plants', '17:00']);
  assert.match(r.find.message, /Found 1 file[\s\S]*Plan\.txt/); assert.equal(r.findNone.ok, true); assert.match(r.findNone.message, /No file contains/);
  assert.equal(r.unknown.ok, false); assert.equal(r.badParam.ok, false); assert.match(r.badParam.message, /not here/);
  assert.ok(r.history.length === 3);
});

test('permissions and confirmation: turned-off kinds are refused honestly; destructive actions ask first', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const I = PatOS.intel; const o = {};
    I.setPerm('files.write', false); o.denied = I.respond('create a folder called Secret'); o.exists = PatOS.fs.exists('/Documents/Secret'); I.setPerm('files.write', true);
    PatOS.fs.write('/.Trash/old.txt', 'x'); o.ask = I.respond('empty the trash'); o.still = PatOS.fs.exists('/.Trash/old.txt');
    o.yes = o.ask.confirm(); o.after = PatOS.fs.exists('/.Trash/old.txt');
    o.appDenied = I.execute('files.find', { q: 'x' }, { source: 'app:evil' });
    return o;
  });
  assert.equal(r.denied.ok, false); assert.equal(r.denied.status, 'denied'); assert.match(r.denied.message, /turned off in Settings › Pat & Intelligence/); assert.equal(r.exists, false);
  assert.equal(r.ask.status, 'confirm'); assert.match(r.ask.message, /Empty the Trash\?/); assert.equal(r.still, true, 'nothing deleted before the yes');
  assert.equal(r.yes.ok, true); assert.equal(r.after, false);
  assert.equal(r.appDenied.ok, false); assert.equal(r.appDenied.status, 'denied');
});

test('workspaces report each step, and say so when one fails', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(() => {
    const I = PatOS.intel; const o = {};
    o.ok = I.respond('start my study workspace'); o.focus = PatOS.focusMode; o.notes = PatOS.wm.windowsOf('notes').length > 0;
    I.setWorkspaces([{ id: 'x', name: 'Broken', words: ['broken'], steps: ['open notes', 'fly to the moon'] }]);
    o.bad = I.respond('start my broken workspace'); I.setWorkspaces([]); PatOS.focusMode = false;
    return o;
  });
  assert.equal(r.ok.ok, true); assert.match(r.ok.message, /Study workspace ready[\s\S]*✓ turn on do not disturb[\s\S]*✓ open notes/); assert.equal(r.focus, true); assert.equal(r.notes, true);
  assert.equal(r.bad.ok, false); assert.match(r.bad.message, /1 of 2 steps worked[\s\S]*✗ fly to the moon/);
});

test('Shortcuts: create from words, explain, run; bad steps refused', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const I = PatOS.intel; const o = {};
    o.make = I.respond('create a shortcut called Morning that opens calendar and turns on dark mode');
    o.sc = PatOS.shortcuts.byName('Morning'); o.explain = I.respond('what does my Morning shortcut do');
    PatOS.setSetting('theme', 'light'); const run = await PatOS.shortcuts.run(o.sc, { quiet: true }); o.run = run.ok; o.theme = PatOS.settings.theme;
    o.bad = I.respond('create a shortcut called Nope that flies away');
    o.pat = PatOS.assistantReply('list my shortcuts');
    return { make: o.make, steps: o.sc.steps.map((s) => s.p.text), explain: o.explain.message, run: o.run, theme: o.theme, bad: o.bad, pat: o.pat };
  });
  assert.equal(r.make.ok, true); assert.deepEqual(r.steps, ['open calendar', 'turn on dark mode']);
  assert.match(r.explain, /“Morning” does 2 steps[\s\S]*1\. Do a command: “open calendar”/);
  assert.equal(r.run, true); assert.equal(r.theme, 'dark');
  assert.equal(r.bad.ok, false); assert.match(r.bad.message, /don’t know how to “flies away”/);
  assert.match(r.pat, /Morning/);
});

test('apps can offer actions, which never outrank system ones; French works', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const I = PatOS.intel; const got = [];
    I.exposeApp('demo', [{ id: 'roll', title: 'Roll dice', phrases: ['roll the demo dice'] }, { id: 'evil', title: 'Hijack', phrases: ['open calendar'] }, { id: 'BAD ID', title: 'x', phrases: ['zzz'] }], (id, p) => { got.push(id); return 'rolled'; });
    const o = { roll: I.respond('roll the demo dice').message, cal: I.parse('open calendar').id, bad: I.list({ owner: 'app:demo' }).map((a) => a.id).sort(), got };
    PatOS.lang = 'fr'; o.fr = I.respond('crée un dossier appelé Projets').message; o.frRem = I.parse('rappelle-moi de payer le loyer demain').id; PatOS.lang = 'en';
    return o;
  });
  assert.equal(r.roll, 'rolled'); assert.deepEqual(r.got, ['roll']); assert.equal(r.cal, 'app.open', 'system actions win');
  assert.deepEqual(r.bad, ['app.demo.evil', 'app.demo.roll']);
  assert.match(r.fr, /Dossier « Projets » créé/); assert.equal(r.frRem, 'reminders.create');
});
