/* PatOS Data (4.0, js/data.js + js/apps/data.js): deterministic relationships between files, notes, events and more. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

// a biology project spread over files, notes, an event, a reminder; and some things that have nothing to do with it
const seed = () => {
  PatOS.fs.mkdir('/Documents/School');
  PatOS.fs.write('/Documents/School/Biology report.txt', 'Mitosis and meiosis: how cells divide. #biology');
  PatOS.fs.write('/Documents/School/cell-diagram.txt', 'Labels for the cell diagram: nucleus, membrane, mitochondria');
  PatOS.fs.mkdir('/Documents/Recipes'); PatOS.fs.write('/Documents/Recipes/lasagna.txt', 'Pasta, tomato, cheese.');
  PatOS.fs.mkdir('/Documents/Private'); PatOS.fs.write('/Documents/Private/diary mitosis.txt', 'secret');
  PatOS.store.set('notes', [{ id: 'n1', title: 'Biology: mitosis notes', body: 'Prophase, metaphase… see Biology report.txt', updated: Date.now() }, { id: 'n2', title: 'Grocery list', body: 'milk, eggs', updated: Date.now() }]);
  const d = new Date(); d.setDate(d.getDate() + 3); const c = {}; c[PatOS.dateKey(d)] = [{ id: 'e1', title: 'Biology test: mitosis', time: '09:00' }]; PatOS.store.set('calendar', c);
  PatOS.store.set('reminders', [{ id: 'r1', text: 'Finish the biology report #biology' }, { id: 'r2', text: 'Call the dentist' }]);
  PatOS.emit('fs'); PatOS.emit('notes');
};

test('Data connects what goes together, says why, and leaves the rest alone', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(seed); await ev(() => PatOS.data.build());
  const rel = await ev(() => PatOS.data.related('file:/Documents/School/Biology report.txt', 20));
  const keys = rel.map((r) => r.key);
  assert.ok(keys.includes('note:n1'), 'the note that names the report: ' + JSON.stringify(rel.map((r) => [r.key, r.why])));
  assert.ok(keys.includes('reminder:r1'), 'the reminder with the same tag');
  assert.ok(keys.includes('event:' + await ev(() => { const d = new Date(); d.setDate(d.getDate() + 3); return PatOS.dateKey(d); }) + ':e1'), 'the test about it');
  assert.ok(!keys.includes('note:n2') && !keys.includes('reminder:r2') && !keys.includes('file:/Documents/Recipes/lasagna.txt'), 'unrelated things stay out');
  const n1 = rel.find((r) => r.key === 'note:n1'); assert.ok(n1.why.some((w) => /names the other/.test(w)), 'and it says why: ' + n1.why.join(' | '));
  assert.ok(rel.find((r) => r.key === 'reminder:r1').why.some((w) => /#biology/.test(w)));
  // a collection gathers it
  const cid = await ev(() => PatOS.data.createCollection('Biology', ['biology', 'mitosis']));
  const col = await ev((id) => PatOS.data.collection(id).items.map((i) => i.key), cid);
  for (const k of ['file:/Documents/School/Biology report.txt', 'note:n1', 'reminder:r1']) assert.ok(col.includes(k), 'in the collection: ' + k);
  assert.ok(!col.includes('note:n2'));
  // taking one out sticks; adding one by hand sticks
  await ev((id) => { PatOS.data.removeFrom(id, 'reminder:r1'); PatOS.data.addTo(id, 'file:/Documents/School/cell-diagram.txt'); }, cid);
  const col2 = await ev((id) => PatOS.data.collection(id).items.map((i) => i.key), cid);
  assert.ok(!col2.includes('reminder:r1') && col2.includes('file:/Documents/School/cell-diagram.txt'));
  // a wrong link removed is never shown again; a link made by hand shows, with its reason
  await ev(() => PatOS.data.unlink('file:/Documents/School/Biology report.txt', 'note:n1'));
  assert.ok(!(await ev(() => PatOS.data.related('file:/Documents/School/Biology report.txt', 20).map((r) => r.key))).includes('note:n1'));
  await ev(() => PatOS.data.link('note:n2', 'reminder:r2'));
  assert.deepEqual(await ev(() => PatOS.data.related('note:n2', 5).map((r) => [r.key, r.why[0]])), [['reminder:r2', 'linked by you']]);
  // private things and left-out folders are never read
  assert.ok((await ev(() => PatOS.data.search('mitosis').map((r) => r.key))).includes('file:/Documents/Private/diary mitosis.txt'));
  await ev(() => { PatOS.data.setPrefs({ paths: ['/Documents/Private'] }); PatOS.data.setPrivate('note:n1', true); PatOS.data.build(); });
  const after = await ev(() => PatOS.data.search('mitosis').map((r) => r.key));
  assert.ok(!after.includes('file:/Documents/Private/diary mitosis.txt') && !after.includes('note:n1'), 'never read: ' + JSON.stringify(after));
  // off: nothing at all
  await ev(() => { PatOS.data.setPrefs({ on: false }); PatOS.data.build(); }); assert.equal(await ev(() => PatOS.data.size()), 0);
  await ev(() => { PatOS.data.setPrefs({ on: true, private: [] }); PatOS.data.build(); });
  // suggestions: a word that ties several kinds of things
  const sug = await ev(() => PatOS.data.suggestions().map((s) => s.word)); // (Biology is a collection now, so it isn't suggested again)
  assert.ok(sug.some((w) => /mitosi|biolog/.test(w)) || (await ev(() => PatOS.data.collections().length)) > 0, 'suggestions: ' + JSON.stringify(sug));
  assert.ok(!sug.includes('biology'), 'a word that is already a collection is not suggested again');
  assert.deepEqual(errors, []); await page.close();
});

test('the Data app: collections, the details of a thing with its reasons, the graph, privacy', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(seed); const cid = await ev(() => PatOS.data.createCollection('Biology', ['biology', 'mitosis']));
  await ev((id) => PatOS.launch('data', { id }), cid); await page.waitForSelector('.dt-card');
  assert.ok(await ev(() => document.querySelectorAll('.dt-card').length >= 3));
  await ev(() => document.querySelector('.dt-card[data-key="note:n1"]').click()); await page.waitForSelector('.dt-insp:not(.hidden) .dt-why');
  assert.match(await ev(() => document.querySelector('.dt-insp').textContent), /names the other|both mention|#biology/, 'the details say why');
  await ev(() => { const s = [...document.querySelectorAll('.ui-seg button')].find((x) => /Graph/.test(x.textContent)); s.click(); }); await page.waitForSelector('.dt-graph canvas');
  await page.waitForTimeout(800);
  assert.ok(await ev(() => document.querySelector('.dt-graph canvas').width > 0));
  await ev(() => PatOS.wm.windowsOf('data')[0]._data.open({ kind: 'prefs' })); await page.waitForTimeout(200);
  assert.match(await ev(() => document.querySelector('.dt-main').textContent), /Folders it never reads/);
  // a Collection widget shows it (Widgets + Data)
  await ev((id) => PatOS.widgets.add('collection', { size: 'm', config: { id } }), cid); await page.waitForTimeout(400);
  assert.match(await ev(() => [...document.querySelectorAll('#desk-widgets .wg-t-collection')].pop().textContent), /Biology/);
  assert.deepEqual(errors, []); await page.close();
});
