/* Security: files and notes can't run code in PatOS, and the password vault never stores plain text. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

const EVIL = '<h1>Essay</h1><img src="x" onerror="window.__pwned=1"><a href="javascript:window.__pwned=2">link</a><script>window.__pwned=3</script><iframe src="javascript:parent.__pwned=4"></iframe><svg onload="window.__pwned=5"></svg><p style="color:red" onclick="window.__pwned=6">ok</p>';

test('the sanitizer keeps formatting and removes anything that runs', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base);
  const out = await page.evaluate((h) => PatOS.sanitize(h), EVIL);
  assert.ok(out.includes('<h1>Essay</h1>') && out.includes('style="color:red"') && out.includes('link'));
  for (const bad of ['onerror', 'javascript:', '<script', '<iframe', 'onload', 'onclick']) assert.ok(!out.includes(bad), 'removed ' + bad + ': ' + out);
  await page.close();
});
test('opening a booby-trapped document or note runs nothing', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base);
  await page.evaluate((h) => {
    PatOS.fs.write('/Documents/Trap.pdoc', h); PatOS.openFile('/Documents/Trap.pdoc');
    PatOS.store.set('notes', [{ id: 'trap', title: 'Trap', body: '<div>Trap</div>' + h, mtime: Date.now() }]); PatOS.launch('notes', { id: 'trap' });
    PatOS.fs.write('/Documents/Trap.pslides', JSON.stringify({ theme: 'Simple', slides: [{ els: [{ type: 'text', x: 0, y: 0, w: 500, h: 100, html: h }] }] })); PatOS.openFile('/Documents/Trap.pslides');
  }, EVIL);
  await page.waitForTimeout(1500);
  // also click the planted link and paragraph
  await page.evaluate(() => document.querySelectorAll('.window a, .window p').forEach((e) => { try { e.click(); } catch (er) {} }));
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__pwned || 0), 0);
  await page.close();
});
test('pasted formatted text is cleaned', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base);
  const html = await page.evaluate((h) => {
    const ed = document.createElement('div'); ed.contentEditable = 'true'; document.body.appendChild(ed); ed.focus();
    const dt = new DataTransfer(); dt.setData('text/html', h); dt.setData('text/plain', 'x');
    ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    return ed.innerHTML;
  }, EVIL);
  assert.ok(html.includes('Essay'), html); assert.ok(!/onerror|javascript:|<script/.test(html), html);
  assert.equal(await page.evaluate(() => window.__pwned || 0), 0);
  await page.close();
});
test('passwords: an old plain-text vault is encrypted, and nothing readable is stored', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(async () => { PatOS.store.set('pwVault', { v: 1, enc: false, items: [{ id: '1', site: 'example.com', url: 'https://example.com', username: 'pat', password: 'Sup3rSecret!' }] }); await PatOS.flush(); });
  await reload(page);
  const r = await page.evaluate(async () => { await PatOS.passwords.ready; await new Promise((res) => setTimeout(res, 300)); await PatOS.flush(); return { stored: JSON.stringify(PatOS.store.get('pwVault')), list: PatOS.passwords.all().map((x) => x.password), mode: PatOS.passwords.deviceOnly }; });
  assert.ok(!r.stored.includes('Sup3rSecret') && !r.stored.includes('example.com'), r.stored.slice(0, 200));
  assert.deepEqual(r.list, ['Sup3rSecret!']); assert.equal(r.mode, true);
  // a restart still opens them on this device
  await reload(page);
  assert.deepEqual(await page.evaluate(async () => { await PatOS.passwords.ready; return PatOS.passwords.all().map((x) => x.username); }), ['pat']);
  await page.close();
});
test('passwords: with a master password they lock when PatOS locks', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const P = PatOS.passwords; await P.ready; await P.save({ url: 'https://school.example', username: 'me', password: 'Pa55word!' });
    await P.setMaster('correct horse'); const before = P.locked;
    PatOS.power.lock(); const after = P.locked;
    const wrong = await P.unlock('nope'); const right = await P.unlock('correct horse');
    return { before, after, wrong, right, back: P.all().length, stored: JSON.stringify(PatOS.store.get('pwVault')) };
  });
  assert.deepEqual([r.before, r.after, r.wrong, r.right, r.back], [false, true, false, true, 1]);
  assert.ok(!r.stored.includes('Pa55word') && !r.stored.includes('school.example'));
  await page.close();
});
