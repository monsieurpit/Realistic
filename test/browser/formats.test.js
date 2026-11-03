/* File formats and engines: Word, Excel, PowerPoint, zip, PDF, spreadsheet formulas, the Grapher's math. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, page;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); page = await b.newPage(); await boot(page, srv.base); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('Word: a document goes out to .docx and comes back', { skip: skipNoBrowser }, async () => {
  const html = await page.evaluate(async () => {
    const el = document.createElement('div'); el.innerHTML = '<h1>Essay</h1><p>Hello <b>bold</b> and <i>italic</i>, café</p><ul><li>One</li><li>Two</li></ul>';
    const blob = await PatOS.docx.fromElement(el, { title: 'Essay' });
    return PatOS.docx.toHTML(blob);
  });
  const text = typeof html === 'string' ? html : JSON.stringify(html);
  for (const s of ['Essay', 'Hello', 'bold', 'italic', 'café', 'One', 'Two']) assert.ok(text.includes(s), 'keeps ' + s);
  assert.match(text, /<b>|<strong>|font-weight/i);
});
test('Excel: values and formulas go out to .xlsx and come back', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const book = { sheets: [{ name: 'Grades', cells: { A1: { v: 'Math' }, B1: { v: '90' }, A2: { v: 'Science' }, B2: { v: '80' }, B3: { v: '=AVERAGE(B1:B2)' } }, colW: {} }], active: 0 };
    const blob = await PatOS.xlsx.fromBook(book, (si) => PatOS.sheetsEngine.makeEvaluator(book.sheets[si].cells));
    const back = await PatOS.xlsx.toBook(blob); const c = back.sheets[0].cells;
    return { name: back.sheets[0].name, a1: c.A1 && c.A1.v, b1: c.B1 && c.B1.v, b3: c.B3 && c.B3.v };
  });
  assert.equal(r.name, 'Grades'); assert.equal(r.a1, 'Math'); assert.equal(String(r.b1), '90'); assert.match(String(r.b3), /AVERAGE\(B1:B2\)|^85$/);
});
test('PowerPoint: slides go out to .pptx and come back', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const deck = { theme: 'Simple', slides: [{ els: [{ type: 'text', role: 'title', x: 80, y: 170, w: 800, h: 120, html: 'Photosynthesis', size: 60, bold: 1 }] }, { els: [{ type: 'text', x: 60, y: 150, w: 840, h: 340, html: 'Light into energy', size: 24 }] }] };
    const blob = await PatOS.pptx.fromDeck(deck, PatOS.slideThemes || {});
    const back = await PatOS.pptx.toDeck(blob);
    return { n: back.slides.length, text: JSON.stringify(back.slides) };
  });
  assert.equal(r.n, 2); assert.ok(r.text.includes('Photosynthesis')); assert.ok(r.text.includes('Light into energy'));
});
test('zip: files go in and come out the same', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    PatOS.fs.mkdir('/Documents/Zipme'); PatOS.fs.write('/Documents/Zipme/a.txt', 'alpha é'); PatOS.fs.write('/Documents/Zipme/b.txt', 'beta '.repeat(1000));
    const blob = await PatOS.zip.zipPaths(['/Documents/Zipme']);
    const z = await PatOS.zip.read(blob);
    return { names: z.names.sort(), a: await z.text('Zipme/a.txt'), bLen: (await z.text('Zipme/b.txt')).length };
  });
  assert.deepEqual(r.names, ['Zipme/', 'Zipme/a.txt', 'Zipme/b.txt']); assert.equal(r.a, 'alpha é'); assert.equal(r.bLen, 5000);
});
test('Scanner: its PDF is a real PDF', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 300, 400); x.fillStyle = '#000'; x.fillText('Page', 20, 40);
    const blob = await PatOS.scanner.makePDF([c, c]); const u = new Uint8Array(await blob.arrayBuffer());
    const head = String.fromCharCode(...u.slice(0, 8)), tail = String.fromCharCode(...u.slice(-6));
    return { head, tail, pages: (new TextDecoder('latin1').decode(u).match(/\/Type \/Page\b/g) || []).length };
  });
  assert.equal(r.head, '%PDF-1.4'); assert.match(r.tail, /%%EOF/); assert.equal(r.pages, 2);
});
test('Sheets: formulas compute like a spreadsheet', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(() => {
    const cells = { A1: { v: '2' }, A2: { v: '3' }, A3: { v: '=A1*A2+1' }, B1: { v: '=SUM(A1:A3)' }, B2: { v: '=IF(A3>5,"big","small")' }, B3: { v: '=ROUND(10/3,2)' }, C1: { v: '=A1/0' }, C2: { v: '=C3' }, C3: { v: '=C2' }, D1: { v: 'apple' }, D2: { v: '=VLOOKUP("apple",D1:E1,2,FALSE)' }, E1: { v: '5' } };
    const ev = PatOS.sheetsEngine.makeEvaluator(cells);
    return ['A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'D2'].map((k) => String(ev(k)));
  });
  assert.equal(r[0], '7'); assert.equal(r[1], '12'); assert.equal(r[2], 'big'); assert.equal(r[3], '3.33');
  assert.match(r[4], /DIV|#/); assert.match(r[5], /CIRC|#/); assert.equal(r[6], '5');
});
test('Grapher: the math reads like on paper', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(() => {
    const w = PatOS.launch('grapher');
    const val = (src) => { w._grapher.rows.splice(0, w._grapher.rows.length, { src, on: true, color: '#000', id: 'r1' }); return null; };
    PatOS.wm.closeAll();
    // read values through the app itself
    PatOS.store.set('grapher2', { rows: ['2^10 + sqrt(49)', '5!/3', '-2^2', '(-8)^(1/3)', '|-3| + 1', '2(3+4)', 'y = 2x + 1', 'x^2 + y^2 = 25', 'r = 2sin(3θ)', 'f(x) = x^3', 'a = 2', '(2, 3)'].map((src) => ({ src, on: true, color: '#000' })) });
    const g = PatOS.launch('grapher'); const m = g._grapher.model; const out = m.map((x) => x.value !== undefined ? String(x.value) : (x.plot || x.kind || x.err));
    PatOS.wm.closeAll(); return out;
  });
  assert.deepEqual(r, ['1031', '40', '-4', '-2', '4', '14', 'y', 'implicit', 'polar', 'y', 'param', 'point']);
});
