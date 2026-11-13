/* Search inside everything (4.0, js/fulltext.js): the words inside files, notes, reminders, events and contacts, in any
   order, with the passage; kept up to date one file at a time; built in small pieces; Spotlight, Piles and Pat use it. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

const seed = () => {
  PatOS.fs.mkdir('/Documents/School');
  PatOS.fs.write('/Documents/School/Lab notes.txt', 'Today we wrote the report for biology class. The mitochondria is the powerhouse of the cell.');
  PatOS.fs.write('/Documents/Groceries.txt', 'milk, eggs, bread');
  PatOS.fs.write('/.Trash/old secret.txt', 'biology report draft that was thrown away');
  PatOS.store.set('notes', [{ id: 'n1', title: 'Été à Montréal', body: '<p>Pique-nique au parc, apporter la crème solaire</p>', updated: Date.now() }]);
  PatOS.store.set('reminders', [{ id: 'r1', text: 'Call the dentist', notes: 'ask about the appointment for Thursday' }]);
  const c = {}; c[PatOS.dateKey(new Date())] = [{ id: 'e1', title: 'Science fair', time: '10:00', notes: 'bring the volcano model' }]; PatOS.store.set('calendar', c);
  PatOS.emit('fs'); PatOS.emit('notes'); PatOS.emit('reminders'); PatOS.emit('calendar');
};

test('the index: words in any order, the start of a word, accents, every kind of thing, the passage; the Trash stays out', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(seed);
  const s = (q, o) => ev(([q, o]) => PatOS.fulltext.search(q, o).map((r) => ({ key: r.key, p: r.passage })), [q, o]);
  const r1 = await s('biology report');
  assert.deepEqual(r1.map((x) => x.key), ['file:/Documents/School/Lab notes.txt'], 'words in any order, and the Trash is never searched');
  assert.ok(r1[0].p && /biology|report/i.test(r1[0].p.match), JSON.stringify(r1[0].p));
  assert.deepEqual((await s('mitoch')).map((x) => x.key), ['file:/Documents/School/Lab notes.txt'], 'the start of a word, while typing');
  const r3 = await s('creme'); assert.equal(r3[0].key, 'note:n1', 'without accents'); assert.equal(r3[0].p.match, 'crème', 'the passage keeps the real word');
  assert.equal((await s('appointment thursday'))[0].key, 'reminder:r1', 'a reminder’s notes');
  assert.ok((await s('volcano'))[0].key.startsWith('event:'), 'an event’s notes');
  assert.deepEqual(await s('biology zebra'), [], 'every word must be there');
  // kept up to date: a file changed, a file deleted
  await ev(() => PatOS.fs.write('/Documents/Groceries.txt', 'milk, eggs, bread, mitochondria cookies')); await page.waitForTimeout(400);
  assert.equal((await s('mitochondria cookies'))[0].key, 'file:/Documents/Groceries.txt');
  await ev(() => PatOS.fs.remove('/Documents/School/Lab notes.txt')); await page.waitForTimeout(400);
  assert.ok(!(await s('powerhouse')).length, 'a file in the Trash is gone from search');
  assert.deepEqual(errors, []); await page.close();
});

test('Spotlight, Piles and Pat show what is written inside, with the passage', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1300, height: 820 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(seed);
  // Spotlight
  await ev(() => PatOS.spotlight.show()); await page.waitForTimeout(300); await page.keyboard.type('powerhouse cell'); await page.waitForTimeout(600);
  const row = await ev(() => { const r = [...document.querySelectorAll('.sp-res')].find((x) => /Lab notes/.test(x.textContent)); return r ? { pass: (r.querySelector('.sp-pass') || {}).textContent || '', mark: (r.querySelector('.sp-pass mark') || {}).textContent || '' } : null; });
  assert.ok(row, 'the file is found by what is written in it'); assert.match(row.pass, /powerhouse/); assert.ok(/powerhouse|cell/i.test(row.mark));
  await page.keyboard.press('Escape');
  await ev(() => PatOS.spotlight.show()); await page.fill('.sp-input', 'creme solaire'); await page.waitForTimeout(600);
  assert.match(await ev(() => document.querySelector('.sp-results').textContent), /Été à Montréal/);
  await page.keyboard.press('Escape');
  // Piles
  await ev(() => PatOS.launch('finder', { path: '/Documents' })); await page.waitForTimeout(900);
  const rows = await ev(async () => { const w = PatOS.wm.windowsOf('finder')[0]; const inp = w.el.querySelector('input[type=search], .fd-search input, input.field'); inp.value = 'class biology'; inp.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 700)); return w.el.textContent; });
  assert.match(rows, /Lab notes/, 'Piles finds it by its words, in any order');
  // Pat
  const pat = await ev(() => PatOS.intel.respond('find files containing powerhouse cell').message);
  assert.match(pat, /Lab notes\.txt/); assert.match(pat, /powerhouse/i, 'Pat quotes where it matched: ' + pat);
  assert.deepEqual(errors, []); await page.close();
});

test('building the index never blocks PatOS: small pieces only', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    PatOS.fs.mkdir('/Documents/Many'); const para = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';
    for (let i = 0; i < 400; i++) PatOS.fs.write('/Documents/Many/f' + i + '.txt', para.repeat(40) + ' unique' + i);
    const long = []; const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push(Math.round(e.duration)))); po.observe({ entryTypes: ['longtask'] });
    PatOS.fulltext.start(); const t0 = performance.now(); while (!PatOS.fulltext.ready() && performance.now() - t0 < 20000) await new Promise((x) => setTimeout(x, 100));
    po.disconnect(); return { ready: PatOS.fulltext.ready(), long, found: PatOS.fulltext.search('unique123').map((x) => x.key), size: PatOS.fulltext.size() };
  });
  assert.ok(r.ready, 'built'); assert.deepEqual(r.found, ['file:/Documents/Many/f123.txt']);
  assert.ok(r.long.every((d) => d < 150), 'no long pause while building: ' + JSON.stringify(r.long));
  assert.ok(r.size.textKB < 6200, 'within its memory budget: ' + JSON.stringify(r.size));
  assert.deepEqual(errors, []); await page.close();
});
