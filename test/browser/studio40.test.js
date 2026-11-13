/* PatOS Studio (4.0, js/apps/deskstudio.js): the visual editor of desktop configurations. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('Studio: add, drag, resize, save with versions, preview and revert, apply, the widget maker', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => PatOS.launch('deskstudio')); await page.waitForSelector('.sd-stage .sd-box');
  assert.equal(await ev(() => document.querySelectorAll('.sd-stage .sd-widget').length), 4, 'the stage shows this desktop’s widgets');
  assert.equal(await ev(() => PatOS.apps.studio.name), '3D Studio', '3D Studio is still there, untouched');
  // add a widget and a panel
  await ev(() => { const s = PatOS.wm.windowsOf('deskstudio')[0]._studio; s.addWidget('weather'); s.addPanel('launcher'); });
  assert.equal(await ev(() => document.querySelectorAll('.sd-stage .sd-box').length), 6);
  // drag the panel with the pointer: it moves in screen pixels, snapped to 8
  // (wait for the window to finish opening and the stage to stop moving, or the press can miss the panel)
  const box = await ev(async () => { const at = () => { const r = [...document.querySelectorAll('.sd-stage .sd-panel')].pop().getBoundingClientRect(); return { x: r.x + 20, y: r.y + 10 }; };
    let a = at(); for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 100)); const b = at(); if (b.x === a.x && b.y === a.y && document.elementFromPoint(b.x, b.y) && document.elementFromPoint(b.x, b.y).closest('.sd-panel')) return b; a = b; } return a; });
  const before = await ev(() => { const c = PatOS.wm.windowsOf('deskstudio')[0]._studio.cfg; return [c.panels[0].x, c.panels[0].y]; });
  await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 30, box.y + 20, { steps: 5 }); await page.mouse.up();
  const after = await ev(() => { const c = PatOS.wm.windowsOf('deskstudio')[0]._studio.cfg; return [c.panels[0].x, c.panels[0].y]; });
  assert.ok(after[0] > before[0] && after[1] > before[1] && after[0] % 8 === 0, 'moved: ' + before + ' → ' + after);
  // the inspector of the selected panel: add a button from the picker
  assert.ok(await ev(() => !!document.querySelector('.sd-insp .sd-chips')), 'the panel’s inspector shows');
  // keyboard: arrows move the selected thing
  await ev(() => [...document.querySelectorAll('.sd-stage .sd-panel')].pop().focus()); await page.keyboard.press('ArrowRight');
  assert.equal(await ev(() => PatOS.wm.windowsOf('deskstudio')[0]._studio.cfg.panels[0].x), after[0] + 8);
  // save, change, save: one earlier version
  await ev(() => { const s = PatOS.wm.windowsOf('deskstudio')[0]._studio; s.cfg.name = 'Exam week'; s.save(); s.cfg.look.wallpaper = 'nebula'; s.save(); });
  const saved = await ev(() => PatOS.desk.list().map((c) => [c.name, c.versions.length]));
  assert.deepEqual(saved, [['Exam week', 1]]);
  // preview, then revert
  const wp0 = await ev(() => PatOS.settings.wallpaper);
  await ev(() => PatOS.wm.windowsOf('deskstudio')[0]._studio.preview()); await page.waitForTimeout(300);
  assert.equal(await ev(() => PatOS.settings.wallpaper), 'nebula', 'preview shows it on the real desktop');
  assert.ok(await ev(() => document.querySelectorAll('#desk-panels .dk-panel').length >= 1), 'with its panel');
  await ev(() => PatOS.wm.windowsOf('deskstudio')[0]._studio.preview()); await page.waitForTimeout(300);
  assert.equal(await ev(() => PatOS.settings.wallpaper), wp0, 'revert puts it back');
  // apply to the profile you're in
  await ev(() => PatOS.profiles.setConfig(PatOS.profiles.active(), PatOS.wm.windowsOf('deskstudio')[0]._studio.cfg)); await page.waitForTimeout(300);
  assert.equal(await ev(() => PatOS.settings.wallpaper), 'nebula'); assert.ok(await ev(() => PatOS.widgets.layout().some((w) => w.type === 'weather')));
  // the widget maker: blocks become a widget on the stage
  await ev(() => document.querySelector('.sd-stage').click()); await page.waitForTimeout(100);
  await ev(() => [...document.querySelectorAll('.sd-insp .btn')].find((x) => /New widget/.test(x.textContent)).click()); await page.waitForSelector('.sd-maker');
  await ev(() => [...document.querySelectorAll('.ui-sheet .btn.primary')].find((x) => /Add to the desktop/.test(x.textContent)).click()); await page.waitForTimeout(300);
  const st = await ev(() => { const c = PatOS.wm.windowsOf('deskstudio')[0]._studio.cfg; return [c.studioWidgets.length, c.widgets.some((w) => w.type.startsWith('st-'))]; });
  assert.deepEqual(st, [1, true], 'the made widget is part of the configuration');
  // export → import round trip keeps it
  const back = await ev(() => { const s = PatOS.wm.windowsOf('deskstudio')[0]._studio; return PatOS.desk.importText(PatOS.desk.exportText(s.cfg)).config.widgets.length === s.cfg.widgets.length; });
  assert.equal(back, true);
  assert.deepEqual(errors, []); await page.close();
});
