/* Storage integrity: a damaged file tree is kept (never overwritten), small damage is mended with the original kept,
   missing content is reported, the full check finds problems, and backups carry a fingerprint that catches damage. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

// changes the saved database while PatOS is NOT running (on another page of the same site), like damage from outside
async function tamper(page, fn, arg) {
  await page.goto(srv.base + '/manifest.webmanifest');
  await page.evaluate(async ([src, a]) => {
    const db = await new Promise((ok, bad) => { const r = indexedDB.open('patos', 2); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
    await new Promise((r) => setTimeout(r, 300)); localStorage.removeItem('patos-journal');
    const fn = new Function('db', 'a', 'return (' + src + ')(db, a)'); await fn(db, a); db.close();
  }, [fn.toString(), arg]);
}
const put = (db, [store, key, val]) => new Promise((ok) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = ok; });
const del = (db, [store, key]) => new Promise((ok) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = ok; });
async function start(page) {
  await page.goto(srv.base + '/'); await page.waitForFunction(() => window.PatOS && PatOS.fs && PatOS.boot, null, { timeout: 20000 });
  await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 }); await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(600);
}

test('an unreadable file tree is kept aside, PatOS still starts, and the newest snapshot is offered', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(async () => { PatOS.fs.write('/Documents/Important.txt', 'my essay'); await PatOS.backup.snapshot('Good', 'manual'); await PatOS.flush(); });
  await tamper(page, put, ['kv', 'fs', 'garbage that is not a tree']);
  await start(page);
  const r = await page.evaluate(() => ({ load: PatOS.fs.integrity.load().state, damaged: PatOS.fs.integrity.damaged().map((d) => d.why), kept: PatOS.fs.integrity.damagedTree(0), works: PatOS.fs.exists('/Documents'), crit: PatOS.errors.list().some((e) => e.sev === 'critical' && e.cat === 'storage') }));
  assert.deepEqual(r, { load: 'damaged', damaged: ['unreadable'], kept: 'garbage that is not a tree', works: true, crit: true });
  // offered the snapshot; saying yes brings the file back
  await page.waitForSelector('.dlg', { timeout: 10000 });
  assert.match(await page.textContent('.dlg'), /found a problem with your files[\s\S]*newest snapshot/);
  await page.click('.dlg .btn.primary');
  await page.waitForSelector('#lock:not(.hidden)', { timeout: 30000 }); await page.evaluate(() => PatOS.boot.login());
  assert.equal(await page.evaluate(() => PatOS.fs.read('/Documents/Important.txt')), 'my essay');
  assert.equal(await page.evaluate(() => PatOS.fs.integrity.damaged().length), 1, 'the damaged copy is still kept');
  await ctx.close();
});

test('small damage is mended, the original is kept, and missing content is reported', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(async () => { PatOS.fs.write('/Documents/Keep.txt', 'safe'); PatOS.fs.write('/Documents/Big.txt', 'x'.repeat(9000)); await PatOS.flush(); });
  await tamper(page, async (db) => {
    const tree = await new Promise((ok) => { const q = db.transaction('kv').objectStore('kv').get('fs'); q.onsuccess = () => ok(q.result); });
    tree.children.Documents.children['Broken'] = { type: 'dir' }; tree.children.Documents.children['Num.txt'] = { type: 'file', content: 42 };
    const ref = tree.children.Documents.children['Big.txt'].cref;
    await new Promise((ok) => { const tx = db.transaction(['kv', 'fc'], 'readwrite'); tx.objectStore('kv').put(tree, 'fs'); tx.objectStore('fc').delete(ref); tx.oncomplete = ok; });
  });
  await start(page);
  const r = await page.evaluate(() => { const L = PatOS.fs.integrity.load(); return { state: L.state, what: L.problems.map((p) => p.path + ':' + p.what).sort(), keep: PatOS.fs.read('/Documents/Keep.txt'), num: PatOS.fs.read('/Documents/Num.txt'), broken: PatOS.fs.isDir('/Documents/Broken'), kept: PatOS.fs.integrity.damaged().map((d) => d.why) }; });
  assert.equal(r.keep, 'safe'); assert.equal(r.num, '42'); assert.equal(r.broken, true); assert.deepEqual(r.kept, ['mended']);
  assert.ok(r.what.includes('/Documents/Big.txt:content missing') && r.what.includes('/Documents/Broken:folder without contents') && r.what.includes('/Documents/Num.txt:content is not text'), JSON.stringify(r.what));
  await ctx.close();
});

test('the full check, and backup fingerprints: a changed backup is refused, an old one is marked unverified', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext(); const page = await ctx.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    PatOS.fs.write('/Documents/A.txt', 'alpha');
    const c = await PatOS.fs.integrity.check();
    const s = await PatOS.backup.collect({ blobs: false }); const text = JSON.stringify(s);
    const good = (await PatOS.backup.parse(text)).verified;
    const bad = await PatOS.backup.parse(text.replace('alpha', 'omega')).then(() => 'accepted', (e) => e.message);
    const old = JSON.parse(text); delete old.check; const oldV = (await PatOS.backup.parse(JSON.stringify(old))).verified;
    await PatOS.backup.snapshot('Check', 'manual'); const snaps = await PatOS.backup.verifyAll();
    return { ok: c.ok, files: c.files > 0, good, bad, oldV, snaps: snaps.every((x) => x.state === 'ok') && snaps.length >= 1 };
  });
  assert.equal(r.ok, true); assert.equal(r.files, true); assert.equal(r.good, 'ok'); assert.match(r.bad, /damaged/); assert.equal(r.oldV, 'unverified'); assert.equal(r.snaps, true);
  await ctx.close();
});
