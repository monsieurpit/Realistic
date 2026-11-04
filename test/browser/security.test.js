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
test('passwords: only using the vault keeps it open, and closing it locks it', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const P = PatOS.passwords; await P.ready;
    await P.save({ url: 'https://x.example', username: 'a', password: 'secret1' }); await P.setMaster("correct horse"); const out = {};
    // activity in some other app does not count
    await wait(60); document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    out.other = P.lockIfIdle(30); // true = it locked
    await P.unlock('correct horse'); await wait(60);
    // activity inside the Passwords window does
    const el = document.createElement('div'); el.className = 'pw-win'; document.body.appendChild(el); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    out.inside = P.lockIfIdle(30); el.remove();
    // closing the Passwords window locks it
    const w = PatOS.launch('passwords'); await wait(300); out.openBefore = !P.locked; w.close(); await wait(300); out.afterClose = P.locked;
    return out;
  });
  assert.deepEqual(r, { other: true, inside: false, openBefore: true, afterClose: true });
  await page.close();
});

/* Programs run in Terminal and Python live in a Worker with PatOS's own web address. Without the lockdown such a
   worker can open PatOS's database, where the password list's device key and the files are kept. */
const ATTEMPTS = `
const tries = {
  idb: () => indexedDB.open('patos'), idbSelf: () => self.indexedDB.open('patos'), idbProto: () => Object.getPrototypeOf(self).indexedDB.open('patos'),
  idbFactory: () => IDBFactory.prototype.open.call({}, 'patos'), idbDatabases: () => IDBFactory.prototype.databases.call({}),
  caches: () => caches.open('patos-data-meta'), cachesProto: () => CacheStorage.prototype.open.call({}, 'x'),
  worker: () => new Worker(URL.createObjectURL(new Blob(['postMessage(1)']))), sharedWorker: () => new SharedWorker('x'), channel: () => new BroadcastChannel('patos'),
  serviceWorker: () => navigator.serviceWorker.controller.postMessage({ patosRollback: true }),
  opfs: () => navigator.storage.getDirectory(),
  putBack: () => { Object.defineProperty(self, 'indexedDB', { value: 1 }); return self.indexedDB.open('patos'); },
  remove: () => { delete self.indexedDB; return self.indexedDB.open('patos'); },
  viaScript: () => importScripts('data:text/javascript,self.__got=indexedDB.open("patos")')
};
onmessage = () => { const out = {}; for (const k in tries) { try { const r = tries[k](); out[k] = r === undefined ? 'blocked' : 'ALLOWED'; } catch (e) { out[k] = 'blocked'; } } postMessage(out); };`;
test('programs: an unprotected worker can reach PatOS storage, a locked-down one cannot', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async (ATTEMPTS) => {
    const ask = (src) => new Promise((res) => { const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); w.onmessage = (e) => { w.terminate(); res(e.data); }; w.onerror = (e) => { w.terminate(); res({ error: e.message }); }; w.postMessage(0); });
    const control = await ask('onmessage=()=>{const r=indexedDB.open("patos");r.onsuccess=()=>{postMessage({opened:true,stores:[...r.result.objectStoreNames]})};r.onerror=()=>postMessage({opened:false})}');
    const locked = await ask(PatOS.workerLockdown + ATTEMPTS);
    return { control, locked };
  }, ATTEMPTS);
  assert.equal(r.control.opened, true, 'the control: without the lockdown a worker opens the PatOS database');
  assert.ok(r.control.stores.includes('handles'), 'and sees the store that holds the password key');
  Object.keys(r.locked).forEach((k) => assert.equal(r.locked[k], 'blocked', k + ' must be blocked'));
  assert.equal(Object.keys(r.locked).length, 15);
  await page.close();
});
test('programs: the Terminal JavaScript runner is locked down too', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1000, height: 700 } }); const errors = await boot(page, srv.base, { fresh: true });
  const out = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const w = PatOS.launch('terminal'); await wait(300);
    const input = w.body.querySelector('.term-in'); const term = w.body.querySelector('.term');
    const run = async (cmd) => { const before = term.querySelectorAll('.term-row').length; input.value = cmd; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await wait(900); return [...term.querySelectorAll('.term-row')].slice(before + 1).map((x) => x.textContent).join('\n'); };
    return { idb: await run("node -e \"try { indexedDB.open('patos'); console.log('OPEN') } catch (e) { console.log('BLOCKED') }\""), math: await run('node -e "console.log(6 * 7)"'), ver: await run('node --version') };
  });
  assert.equal(out.idb, 'BLOCKED'); assert.equal(out.math, '42'); assert.match(out.ver, /not Node\.js/);
  assert.deepEqual(errors, []);
  await page.close();
});
test('programs: Python is locked down too (skipped when its runtime can’t be downloaded)', { skip: skipNoBrowser, timeout: 150000 }, async (t) => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    let out = ''; const code = ['import js', 'res = []', 'for n in ["indexedDB", "caches", "Worker", "SharedWorker", "BroadcastChannel"]:', '    try:', '        getattr(js, n); res.append(n + ":ALLOWED")', '    except Exception:', '        res.append(n + ":blocked")', 'print(",".join(res))', 'print(6 * 7)'].join('\n');
    try { await Promise.race([PatOS.python.run(code, { onOut: (s) => { out += s; }, onErr: (s) => { out += s; }, onStatus() {}, writeBack: false }), new Promise((_, rej) => setTimeout(() => rej(new Error('python did not start')), 120000))]); return { ok: true, out }; }
    catch (e) { return { ok: false, out: String(e.message) }; }
  });
  if (!r.ok) { t.skip('Python could not start here: ' + r.out); await page.close(); return; }
  assert.equal(r.out.trim(), 'indexedDB:blocked,caches:blocked,Worker:blocked,SharedWorker:blocked,BroadcastChannel:blocked\n42');
  assert.deepEqual(errors, []);
  await page.close();
});
