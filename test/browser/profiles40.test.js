/* Desktop configurations (js/desk.js) and PatOS Profiles (js/profiles.js), 4.0. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('a configuration is checked: unknown or unsafe parts are dropped and said, nothing runs', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(() => {
    const out = {};
    try { PatOS.desk.validate({ schema: 'patos.desktop/9' }); } catch (e) { out.newer = e.message; }
    try { PatOS.desk.importText('not json'); } catch (e) { out.bad = e.message; }
    const { config, warnings } = PatOS.desk.validate({ schema: 'patos.desktop/1', name: '<b>Mine</b>', look: { theme: 'dark', accent: 'javascript:x', wallpaper: 'nope' },
      dock: { apps: ['notes', 'evilapp', 'music'] }, widgets: [{ type: 'clock', size: 'xl', x: -50, y: 9e9 }, { type: 'nope' }],
      panels: [{ kind: 'launcher', title: 'Go', items: [{ kind: 'app', id: 'notes' }, { kind: 'url', url: 'javascript:alert(1)' }, { kind: 'url', url: 'http://plain.example' }, { kind: 'url', url: 'https://ok.example' }, { kind: 'file', path: '/System/Kernel/patos-kernel' }] }],
      shortcuts: [{ keys: 'Alt+W', action: { kind: 'app', id: 'notes' } }, { keys: 'Ctrl+Alt+9', action: { kind: 'app', id: 'music' } }, { keys: 'X', action: { kind: 'app', id: 'notes' } }],
      menus: [{ title: 'School', items: [{ label: 'Notes', action: { kind: 'app', id: 'notes' } }] }], evil: 'drop me' });
    out.config = config; out.warnings = warnings; return out;
  });
  assert.match(r.newer, /newer PatOS/); assert.match(r.bad, /desktop configuration/);
  assert.equal(r.config.name, 'bMine/b', 'no markup'); assert.equal(r.config.look.accent, undefined); assert.equal(r.config.look.wallpaper, undefined);
  assert.deepEqual(r.config.dock.apps, ['notes', 'music']); assert.equal(r.config.widgets.length, 1); assert.equal(r.config.widgets[0].size, 's'); assert.equal(r.config.widgets[0].x, 0);
  assert.deepEqual(r.config.panels[0].items, [{ kind: 'app', id: 'notes' }, { kind: 'url', url: 'https://ok.example' }], 'only safe actions');
  assert.deepEqual(r.config.shortcuts, [{ keys: 'Ctrl+Alt+9', action: { kind: 'app', id: 'music' } }], 'system and bare keys refused');
  assert.equal(r.config.evil, undefined);
  assert.ok(r.warnings.some((w) => /evilapp/.test(w)) && r.warnings.some((w) => /Alt\+W/.test(w)), 'what was dropped is said: ' + r.warnings.join(' | '));
  assert.deepEqual(errors, []); await page.close();
});

test('applying a configuration: panel, menu and shortcut work; preview puts it back; saved with versions', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  const cfg = { schema: 'patos.desktop/1', name: 'Study', look: { theme: 'light', wallpaper: 'fold' }, dock: { apps: ['notes', 'calendar'] }, widgets: [{ type: 'today', size: 'm', x: 40, y: 60 }],
    panels: [{ kind: 'launcher', title: 'Class', x: 500, y: 100, items: [{ kind: 'app', id: 'calculator' }] }], menus: [{ title: 'Study', items: [{ label: 'Open Notes', action: { kind: 'app', id: 'notes' } }] }],
    shortcuts: [{ keys: 'Ctrl+Alt+8', action: { kind: 'app', id: 'calendar' } }] };
  const before = await ev(() => [PatOS.settings.theme, PatOS.settings.wallpaper]);
  const rev = await ev((c) => { const r = PatOS.desk.apply(c, { preview: true }); window._revert = r.revert; return [PatOS.settings.theme, PatOS.settings.wallpaper, PatOS.settings.dockPinned.join(',')]; }, cfg);
  assert.deepEqual(rev, ['light', 'fold', 'notes,calendar']);
  await ev(() => window._revert()); assert.deepEqual(await ev(() => [PatOS.settings.theme, PatOS.settings.wallpaper]), before, 'the preview is put back');
  await ev((c) => PatOS.desk.apply(c), cfg); await page.waitForTimeout(300);
  // (regression: panels had no styles, so their icons were drawn full size over the widgets)
  assert.deepEqual(await ev(() => { const p = document.querySelector('#desk-panels .dk-panel'); const ic = p.querySelector('.dk-ic'); return [getComputedStyle(p).position, Math.round(ic.getBoundingClientRect().width), p.getBoundingClientRect().width <= 340]; }), ['absolute', 44, true], 'a panel is a small glass card with normal icons');
  await ev(() => document.querySelector('#desk-panels .dk-item').click()); await page.waitForTimeout(500);
  assert.ok(await ev(() => PatOS.wm.isRunning('calculator')), 'a panel button opens its app');
  await ev(() => document.querySelector('#menubar [data-menu="desk:0"]').click()); await page.waitForTimeout(200);
  await ev(() => [...document.querySelectorAll('.menu .menu-item, .menu button, .menu [role=menuitem]')].find((x) => /Open Notes/.test(x.textContent)).click()); await page.waitForTimeout(400);
  assert.ok(await ev(() => PatOS.wm.isRunning('notes')), 'the extra menu works');
  await page.keyboard.press('Control+Alt+8'); await page.waitForTimeout(500);
  assert.ok(await ev(() => PatOS.wm.isRunning('calendar')), 'your keyboard shortcut works');
  const id = await ev((c) => PatOS.desk.save(c), cfg);
  await ev((i) => { const c = PatOS.desk.get(i).config; c.name = 'Study 2'; PatOS.desk.save(c, i); }, id);
  assert.deepEqual(await ev((i) => [PatOS.desk.get(i).name, PatOS.desk.get(i).versions.length], id), ['Study 2', 1]);
  await ev((i) => PatOS.desk.restoreVersion(i, 0), id); assert.equal(await ev((i) => PatOS.desk.get(i).name, id), 'Study');
  const dup = await ev((i) => PatOS.desk.duplicate(i), id); assert.match(await ev((i) => PatOS.desk.get(i).name, dup), /Study copy/);
  assert.deepEqual(errors, []); await page.close();
});

test('profiles: each has its own look, widgets and windows; switching is instant and survives a reload; files are shared', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await page.waitForTimeout(1500);
  await ev(() => { PatOS.setSetting('wallpaper', 'fold'); PatOS.launch('notes'); PatOS.fs.write('/Documents/shared.txt', 'one copy'); });
  await page.waitForTimeout(600);
  const school = await ev(() => PatOS.profiles.create({ name: 'School', icon: 'doc' }));
  assert.equal(school, 'school');
  await ev((id) => PatOS.profiles.switchTo(id), school); await page.waitForTimeout(500);
  assert.equal(await ev(() => PatOS.wm.windows.filter((w) => !w.profileHidden).length), 0, 'the other profile’s windows are kept hidden');
  assert.equal(await ev(() => PatOS.wm.windowsOf('notes').length), 1, '(still open, with its state)');
  await ev(() => { PatOS.setSetting('wallpaper', 'nebula'); PatOS.widgets.setLayout([{ iid: 'z1', type: 'system', size: 'm', x: 40, y: 60 }]); PatOS.launch('calculator'); });
  await page.waitForTimeout(400);
  await ev(() => PatOS.profiles.switchTo('personal')); await page.waitForTimeout(500);
  assert.equal(await ev(() => PatOS.settings.wallpaper), 'fold', 'Personal has its wallpaper back');
  assert.deepEqual(await ev(() => PatOS.widgets.layout().map((w) => w.type)), ['clock', 'calendar', 'today', 'music'], 'and its widgets');
  assert.deepEqual(await ev(() => PatOS.wm.windows.filter((w) => !w.profileHidden).map((w) => w.app.id)), ['notes'], 'and its windows, as they were');
  assert.equal(await ev(() => PatOS.fs.read('/Documents/shared.txt')), 'one copy', 'files are the same in every profile');
  // a Dock click on an app kept in another profile doesn't pull its window in by accident
  await ev(() => PatOS.profiles.switchTo('school')); await page.waitForTimeout(400);
  assert.equal(await ev(() => PatOS.settings.wallpaper), 'nebula');
  await ev(() => PatOS.flush && PatOS.flush()); await page.reload(); await page.waitForTimeout(2200); await ev(() => PatOS.boot.login()); await page.waitForTimeout(1500);
  assert.equal(await ev(() => PatOS.profiles.active()), 'school', 'the device stays in its profile');
  assert.deepEqual(await ev(() => [PatOS.settings.wallpaper, PatOS.widgets.layout().map((w) => w.type).join(',')]), ['nebula', 'system']);
  await ev(() => PatOS.profiles.switchTo('personal')); await page.waitForTimeout(800);
  assert.deepEqual(await ev(() => [PatOS.settings.wallpaper, PatOS.wm.windows.map((w) => w.app.id).includes('notes')]), ['fold', true], 'after a reload, a profile reopens its apps');
  // export / import, and the checks on delete
  const txt = await ev(() => PatOS.profiles.exportProfile('school'));
  const imp = await ev((t) => PatOS.profiles.importProfile(t.replace('"School"', '"School B"')), txt);
  assert.equal(imp, 'school-b');
  assert.match(await ev(() => { try { PatOS.profiles.remove(PatOS.profiles.active()); return 'removed'; } catch (e) { return e.message; } }), /another profile first/);
  assert.equal(await ev(() => PatOS.profiles.remove('school-b')), true);
  assert.deepEqual(errors, []); await page.close();
});
