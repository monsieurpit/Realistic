/* TextEdit: find & replace, smart indent, Markdown preview that never runs scripts */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('TextEdit finds, replaces, indents and previews Markdown safely', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    PatOS.fs.write('/Documents/a.js', 'function f() {\n  return 1;\n}\nf(); f();');
    let w = PatOS.launch('textedit', { path: '/Documents/a.js' }); await wait(300);
    const ta = w.body.querySelector('textarea');
    w._te.find(true); await wait(50);
    const [fin, rin] = w.body.querySelectorAll('.te-fin');
    fin.value = 'f()'; fin.dispatchEvent(new Event('input')); out.count = w.body.querySelector('.te-fcount').textContent;
    rin.value = 'go()'; [...w.body.querySelectorAll('.te-find button')].find((x) => x.textContent === 'Replace All').click(); await wait(50);
    out.replaced = ta.value;
    ta.focus(); ta.setSelectionRange(15, 15); ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    out.indent = JSON.stringify(ta.value.slice(15, 19));
    await wait(1500); out.saved = PatOS.fs.read('/Documents/a.js') === ta.value;
    w.close(); await wait(250);
    PatOS.fs.write('/Documents/r.md', '# Hi\n\n**bold** <img src=x onerror="window.__pwned=1">\n<script>window.__pwned=1</script>');
    w = PatOS.launch('textedit', { path: '/Documents/r.md' }); await wait(400);
    const pv = w.body.querySelector('.te-preview');
    out.md = [!!pv.querySelector('h1'), !!pv.querySelector('b'), getComputedStyle(pv).display !== 'none'];
    await wait(200); out.pwned = window.__pwned || 0;
    return out;
  });
  assert.equal(r.count, '3 matches');
  assert.equal(r.replaced, 'function go() {\n  return 1;\n}\ngo(); go();');
  assert.equal(r.indent, JSON.stringify('\n  \n'), 'Enter after { keeps the indent and adds a level');
  assert.equal(r.saved, true);
  assert.deepEqual(r.md, [true, true, true]);
  assert.equal(r.pwned, 0);
  assert.deepEqual(errors, []);
  await page.close();
});
