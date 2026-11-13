/* PatOS Widgets (4.0, js/widgets.js): a dashboard desktop. Widgets are placed, resized, removed and saved; each type runs in its
   own process; third-party widgets are sandboxed and only get what they were granted; Studio widgets are data, never code. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('widgets: the default dashboard, adding, resizing, removing, interactive, processes, saved', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  assert.deepEqual(await ev(() => PatOS.widgets.layout().map((i) => i.type)), ['clock', 'calendar', 'today', 'music']);
  assert.equal(await ev(() => document.querySelectorAll('#desk-widgets .wg').length), 4);
  const pos = await ev(() => [...document.querySelectorAll('#desk-widgets .wg')].map((w) => [w.offsetLeft, w.offsetTop])); // (the layout position; the entrance animation moves them a little at first)
  assert.deepEqual(pos[1], [186, 44], 'placed where it is saved (not in the page flow): ' + JSON.stringify(pos));
  const sys = await ev(() => PatOS.widgets.add('system', { size: 'm' }));
  const rem = await ev(() => PatOS.widgets.add('reminders'));
  await ev(() => { PatOS.store.set('reminders', [{ id: 'r1', text: 'Buy milk' }, { id: 'r2', text: 'Call Sam' }]); PatOS.emit('reminders'); });
  await page.waitForTimeout(500);
  assert.ok(await ev(() => PatOS.proc.list().some((p) => p.app === 'widget:system' && p.state === 'running')), 'the System widget runs in its own process');
  await ev(() => document.querySelector('.w-remi').click()); await page.waitForTimeout(200);
  assert.equal(await ev(() => PatOS.store.get('reminders').find((r) => r.id === 'r1').done), true, 'a reminder is checked off from its widget');
  await ev((i) => PatOS.widgets.resize(i, 'l'), rem);
  assert.equal(await ev((i) => document.querySelector('.wg[data-iid="' + i + '"]').offsetHeight, rem), 316, 'resized');
  // edit mode: its Add Widget / Done bar goes away with Done (it used to stay)
  await ev(() => PatOS.widgets.edit(true)); assert.equal(await ev(() => document.querySelectorAll('.wg-editbar').length), 1);
  await ev(() => document.querySelector('.wg-editbar .btn.primary').click()); await page.waitForTimeout(100);
  assert.equal(await ev(() => document.querySelectorAll('.wg-editbar').length), 0, 'Done closes edit mode and its bar');
  await ev((i) => PatOS.widgets.remove(i), sys); await page.waitForTimeout(300);
  assert.equal(await ev(() => PatOS.proc.list().filter((p) => p.app === 'widget:system').length), 0, 'removing the last one ends its process (its timer stops)');
  await ev(() => PatOS.flush && PatOS.flush()); await page.reload(); await page.waitForTimeout(2000); await ev(() => PatOS.boot.login()); await page.waitForTimeout(1200);
  assert.deepEqual(await ev(() => PatOS.widgets.layout().map((i) => i.type + ':' + i.size)), ['clock:s', 'calendar:s', 'today:m', 'music:m', 'reminders:l'], 'saved');
  assert.deepEqual(errors, []); await page.close();
});

test('third-party widgets are sandboxed: no access to PatOS, only the permissions granted', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { PatOS.store.set('reminders', [{ id: 'a', text: 'x' }]); PatOS.store.set('notes', [{ id: 'n', title: 'secret' }]); window._rep = []; addEventListener('message', (e) => { if (e.data && e.data.report) window._rep.push(e.data.report); }); });
  const html = `<script>const out = [];
    try { out.push('parent:' + typeof parent.document.body); } catch (e) { out.push('parent:blocked'); }
    try { localStorage.setItem('x', 1); out.push('storage:open'); } catch (e) { out.push('storage:blocked'); }
    PatOS.call('reminders.list').then((r) => out.push('rem:' + r.length), (e) => out.push('rem:' + e.message))
      .then(() => PatOS.call('notes.recent')).then((r) => out.push('notes:' + JSON.stringify(r)), (e) => out.push('notes:' + e.message))
      .then(() => parent.postMessage({ pw: 1, id: -1, report: out }, '*'));</script>`;
  const id = await ev((h) => PatOS.widgets.install({ schema: 'patos.widget/1', id: 'demo', name: 'Demo', version: '1', permissions: ['reminders', 'notes'], sizes: ['m'], html: h }, { grant: ['reminders'] }), html);
  assert.equal(id, 'x-demo');
  await ev((t) => PatOS.widgets.add(t), id); await page.waitForTimeout(1500);
  assert.deepEqual(await ev(() => window._rep[0]), ['parent:blocked', 'storage:blocked', 'rem:1', 'notes:not allowed']);
  assert.equal(await ev(() => document.querySelector('.wg-frame').getAttribute('sandbox')), 'allow-scripts', 'an opaque origin (no allow-same-origin)');
  for (const bad of [{ schema: 'x' }, { schema: 'patos.widget/1', id: 'A B', name: 'x', html: '' }, { schema: 'patos.widget/1', id: 'ok', name: '', html: 'x' }]) {
    assert.ok(await ev((m) => { try { PatOS.widgets.validateManifest(m); return false; } catch (e) { return true; } }, bad), 'refused: ' + JSON.stringify(bad));
  }
  assert.equal(await ev(() => PatOS.widgets.uninstall('x-demo')), true);
  assert.equal(await ev(() => document.querySelectorAll('.wg-frame').length), 0, 'uninstalling removes it from the desktop');
  assert.deepEqual(errors, []); await page.close();
});

test('Studio widgets are blocks: text stays text, unknown blocks are dropped, nothing runs', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { window._alerted = 0; window.alert = () => { window._alerted++; }; });
  const id = await ev(() => PatOS.widgets.registerStudio({ schema: 'patos.studiowidget/1', id: 'mine', name: 'Mine', bg: 'red;background:url(javascript:alert(1))', blocks: [{ type: 'text', text: 'Hi <img src=x onerror=alert(1)>' }, { type: 'value', bind: 'reminders.count', label: 'To do' }, { type: 'button', label: 'Go', action: 'app:notes' }, { type: 'button', label: 'Bad', action: 'javascript:alert(1)' }, { type: 'evil', code: 'alert(1)' }] }));
  await ev((t) => PatOS.widgets.add(t, { size: 'm' }), id); await page.waitForTimeout(500);
  const r = await ev(() => { const w = document.querySelector('.wg-studio'); return { imgs: w.querySelectorAll('img').length, text: w.textContent, buttons: w.querySelectorAll('button').length, bg: w.style.background }; });
  assert.equal(r.imgs, 0); assert.match(r.text, /Hi <img src=x onerror=alert\(1\)>/); assert.equal(r.buttons, 1, 'only the valid button'); assert.equal(r.bg, '', 'a bad color is dropped');
  assert.equal(await ev(() => window._alerted), 0);
  assert.deepEqual(errors, []); await page.close();
});


test('desktop widgets keep the Liquid Glass bend and bevel, without the rainbow edge that made PatOS lag; the Dock keeps it all', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  await page.waitForSelector('#desk-widgets .widget'); await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const filt = (el) => { const m = /url\("?#([\w-]+)/.exec(getComputedStyle(el).backdropFilter); const f = m && document.getElementById(m[1]); return f ? { bend: !!f.querySelector('feDisplacementMap'), rainbow: f.querySelectorAll('feDisplacementMap').length > 1 } : null; };
    return { refract: document.documentElement.classList.contains('lg-refract'), widgets: [...document.querySelectorAll('#desk-widgets .widget')].map(filt), dock: filt(document.getElementById('dock')) };
  });
  if (!r.refract) return page.close();
  assert.ok(r.widgets.length && r.widgets.every((w) => w && w.bend && !w.rainbow), 'every widget is bent, none has the rainbow: ' + JSON.stringify(r.widgets));
  assert.ok(r.dock && r.dock.bend, 'the Dock keeps its bend');
  assert.deepEqual(errors, []); await page.close();
});
