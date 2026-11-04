/* Backups: snapshots and restore, the backup file (also locked, also on a brand new device), big files,
   the auto-backup folder (tested with a stand-in folder), and that restored data survives a restart. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('snapshots: restore brings back files and settings, and a copy of "before" is kept', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    PatOS.notify = () => {}; const B = PatOS.backup; const o = {};
    PatOS.fs.write('/Documents/essay.txt', 'version one'); PatOS.store.set('myThing', { n: 1 }); PatOS.store.set('toDelete', 'x');
    const key = await B.snapshot('Test', 'manual');
    PatOS.fs.write('/Documents/essay.txt', 'version two'); PatOS.fs.write('/Documents/new.txt', 'extra'); PatOS.store.set('myThing', { n: 2 }); PatOS.store.remove('toDelete'); PatOS.store.set('added', 1);
    const res = await B.restoreSnapshot(key);
    o.essay = PatOS.fs.read('/Documents/essay.txt'); o.newFile = PatOS.fs.exists('/Documents/new.txt'); o.thing = PatOS.store.get('myThing'); o.back = PatOS.store.get('toDelete'); o.added = PatOS.store.get('added', 'gone'); o.missing = res.missing;
    o.kinds = B.list().map((x) => x.kind).sort().join();
    // the "before" copy has the newer state, so the restore itself can be undone
    const before = B.list().find((x) => x.kind === 'before'); await B.restoreSnapshot(before.key);
    o.undone = [PatOS.fs.read('/Documents/essay.txt'), PatOS.fs.exists('/Documents/new.txt'), PatOS.store.get('myThing').n];
    return o;
  });
  assert.equal(r.essay, 'version one'); assert.equal(r.newFile, false); assert.deepEqual(r.thing, { n: 1 }); assert.equal(r.back, 'x'); assert.equal(r.added, 'gone'); assert.equal(r.missing, 0);
  assert.equal(r.kinds, 'before,manual'); assert.deepEqual(r.undone, ['version two', true, 2]);
  // and it is really saved: still there after a restart
  await page.evaluate(() => PatOS.backup.restoreSnapshot(PatOS.backup.list().find((x) => x.kind === 'manual').key));
  await reload(page);
  assert.deepEqual(await page.evaluate(() => [PatOS.fs.read('/Documents/essay.txt'), PatOS.fs.exists('/Documents/new.txt'), PatOS.store.get('myThing').n]), ['version one', false, 1]);
  await page.close();
});

test('snapshots: seven daily ones are kept, once a day', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const B = PatOS.backup; const o = {}; const day = 86400000;
    for (let i = 10; i >= 1; i--) await B.snapshot('old ' + i, 'auto', Date.now() - i * day);
    o.kept = B.list().filter((x) => x.kind === 'auto').length; o.newestAge = Math.round((Date.now() - B.list()[0].t) / day);
    await B.autoTick(false); o.afterTick = B.list().filter((x) => x.kind === 'auto').length; // the last one is a day old: a new one is made
    await B.autoTick(false); o.again = B.list().filter((x) => x.kind === 'auto').length; // but not twice in a row
    return o;
  });
  assert.equal(r.kept, 7); assert.equal(r.newestAge, 1); assert.equal(r.afterTick, 7); assert.equal(r.again, 7);
  await page.close();
});

test('backup file: locked with a password, restored on a brand new device, big files included', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const made = await page.evaluate(async () => {
    const B = PatOS.backup;
    PatOS.fs.write('/Documents/Zoë’s notes.txt', 'café ☕ ' + 'x'.repeat(6000)); PatOS.store.set('flashThing', { a: [1, 2, 3] });
    const bytes = new Uint8Array(900000).map((_, i) => i % 251); await PatOS.fs.writeBlob('/Videos/clip.bin', new Blob([bytes], { type: 'application/octet-stream' }));
    const plain = await B.exportFile({ blobs: true }); const locked = await B.exportFile({ blobs: true, password: 'correct horse' });
    const lt = await locked.blob.text(); const out = { plainName: plain.name, lockedIsText: !lt.includes('Zoë') && !lt.includes('flashThing'), encrypted: locked.encrypted, big: plain.stats.bigIncluded };
    const e = {}; for (const [k, p] of [['none', null], ['wrong', 'nope']]) { try { await B.parse(lt, p); e[k] = 'opened'; } catch (x) { e[k] = x.needPassword ? 'needPassword' : x.wrongPassword ? 'wrongPassword' : x.message; } }
    out.errors = e; out.lockedText = lt; out.plainText = await plain.blob.text(); return out;
  });
  assert.match(made.plainName, /^PatOS Backup \d{4}-\d{2}-\d{2}\.patos-backup$/); assert.equal(made.lockedIsText, true); assert.equal(made.big, 1);
  assert.deepEqual(made.errors, { none: 'needPassword', wrong: 'wrongPassword' });
  // a different, empty browser (like a new device) opens the locked file with the password
  const page2 = await b.newPage(); await boot(page2, srv.base, { fresh: true });
  const r = await page2.evaluate(async (text) => {
    const B = PatOS.backup; PatOS.notify = () => {}; const state = await B.parse(text, 'correct horse'); const res = await B.apply(state);
    return { res, note: PatOS.fs.read('/Documents/Zoë’s notes.txt').slice(0, 6), thing: PatOS.store.get('flashThing') };
  }, made.lockedText);
  assert.equal(r.res.missing, 0); assert.equal(r.note, 'café ☕'); assert.deepEqual(r.thing, { a: [1, 2, 3] });
  await reload(page2);
  const after = await page2.evaluate(async () => { const blob = await PatOS.fs.getBlob('/Videos/clip.bin'); const u = new Uint8Array(await blob.arrayBuffer()); return { size: blob.size, ok: u[0] === 0 && u[250] === 250 && u[251] === 0, note: PatOS.fs.read('/Documents/Zoë’s notes.txt').length }; });
  assert.deepEqual(after, { size: 900000, ok: true, note: 7 + 'x'.length * 6000 });
  // a backup file made without the big files leaves them out and says so
  const page3 = await b.newPage(); await boot(page3, srv.base, { fresh: true });
  const lite = await page3.evaluate(async (text) => { const s = JSON.parse(text); delete s.blobs; const res = await PatOS.backup.apply(s); return { missing: res.missing, clip: PatOS.fs.exists('/Videos/clip.bin') }; }, made.plainText);
  assert.deepEqual(lite, { missing: 1, clip: false });
  await page.close(); await page2.close(); await page3.close();
});

test('auto-backup folder: writes one file a day and keeps the newest 14', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const files = new Map(); const dir = { async getFileHandle(n) { return { async createWritable() { let buf = ''; return { async write(t) { buf += t; }, async close() { files.set(n, buf); } }; } }; }, async removeEntry(n) { files.delete(n); }, async *entries() { for (const k of [...files.keys()]) yield [k, {}]; } };
    files.set('holiday photos.zip', 'not mine'); // other files in the folder are never touched
    const state = await PatOS.backup.collect({ blobs: false });
    for (let i = 20; i >= 0; i--) await PatOS.backup.folder.write(dir, Object.assign({}, state, { created: Date.now() - i * 86400000 }), 14);
    await new Promise((res) => setTimeout(res, 50));
    const names = [...files.keys()].sort(); const newest = JSON.parse(files.get(names.filter((n) => /^PatOS-backup/.test(n)).pop()));
    return { names, hasFs: !!newest.fs, format: newest.format };
  });
  assert.equal(r.names.filter((n) => /^PatOS-backup-\d{4}-\d{2}-\d{2}\.patos-backup$/.test(n)).length, 14);
  assert.ok(r.names.includes('holiday photos.zip')); assert.equal(r.hasFs, true); assert.equal(r.format, 'patos-backup');
  await page.close();
});

test('Settings › Backup & Restore shows snapshots and works', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); await PatOS.backup.snapshot('Test', 'manual');
    const w = PatOS.launch('settings', { pane: 'backup' }); await wait(700);
    const out = { snaps: w.body.querySelectorAll('.bk-snap').length, restoreBtn: !!w.body.querySelector('.bk-snap .btn'), text: w.body.querySelector('.bk').innerText.slice(0, 80) };
    const now = [...w.body.querySelectorAll('.bk .btn')].find((x) => /Snapshot now|Back Up Now/.test(x.textContent) || x.textContent === 'Back Up Now'); out.hasNow = !!now;
    return out;
  });
  assert.equal(r.snaps, 1); assert.equal(r.restoreBtn, true); assert.match(r.text, /Your data is yours/); assert.equal(r.hasNow, true);
  assert.deepEqual(errors, []);
  await page.close();
});

test('restore screens: a locked file asks for its password, then for a confirmation, then restores', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } }); await boot(page, srv.base, { fresh: true });
  const text = await page.evaluate(async () => { PatOS.fs.write('/Documents/keep.txt', 'my homework'); return await (await PatOS.backup.exportFile({ password: 'sesame1' })).blob.text(); });
  const page2 = await b.newPage({ viewport: { width: 1100, height: 760 } }); await boot(page2, srv.base, { fresh: true });
  const r = await page2.evaluate(async (text) => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    PatOS.restartPatOS = () => { window.__restarted = true; };
    const done = PatOS.backup.ui.fromFile(new File([text], 'b.patos-backup'));
    const until = async (fn) => { for (let i = 0; i < 100 && !fn(); i++) await wait(100); };
    await until(() => document.querySelector('.dlg .dlg-in')); out.asksPassword = !!document.querySelector('.dlg .dlg-in[type=password]');
    let inp = document.querySelector('.dlg .dlg-in'); inp.value = 'wrong'; document.querySelector('.dlg .btn.primary').click(); await until(() => /not right/.test((document.querySelector('.dlg') || {}).innerText || ''));
    out.asksAgain = /not right/.test(document.querySelector('.dlg').innerText);
    inp = document.querySelector('.dlg .dlg-in'); inp.value = 'sesame1'; document.querySelector('.dlg .btn.primary').click(); await until(() => /Restore this backup/.test((document.querySelector('.dlg') || {}).innerText || ''));
    out.confirm = /Restore this backup/.test(document.querySelector('.dlg').innerText) && !PatOS.fs.exists('/Documents/keep.txt'); // nothing changes until you confirm
    document.querySelector('.dlg .btn.danger').click(); await done; await wait(200);
    out.restored = PatOS.fs.read('/Documents/keep.txt'); out.restarted = !!window.__restarted;
    return out;
  }, text);
  assert.deepEqual(r, { asksPassword: true, asksAgain: true, confirm: true, restored: 'my homework', restarted: true });
  await page.close(); await page2.close();
});

test('auto-backup folder: big files are copied as real files and come back after everything is lost', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const mk = () => { const files = new Map(), dirs = new Map(); return { files, dirs,
      async getFileHandle(n, o) { if (!files.has(n)) { if (!o || !o.create) throw new Error('nf'); files.set(n, new Blob([])); } return { async getFile() { const f = files.get(n); return new File([f], n, { lastModified: Date.now() }); }, async createWritable() { const parts = []; return { async write(x) { parts.push(x); }, async close() { files.set(n, new Blob(parts)); } }; } }; },
      async getDirectoryHandle(n, o) { if (!dirs.has(n)) { if (!o || !o.create) throw new Error('nf'); dirs.set(n, mk()); } return dirs.get(n); },
      async removeEntry(n) { files.delete(n); },
      async *entries() { for (const k of [...files.keys()]) yield [k, await this.getFileHandle(k)]; } }; };
    const dir = mk(); const bytes = new Uint8Array(300000).map((_, i) => i % 251);
    await PatOS.fs.writeBlob('/Videos/clip.bin', new Blob([bytes], { type: 'video/mp4' }));
    const tree = PatOS.fs.exportTree(); const id = PatOS.fs.get('/Videos/clip.bin').blob;
    const c = await PatOS.backup.folder.copyBig(dir, tree);
    const again = await PatOS.backup.folder.copyBig(dir, tree); // nothing new the second time
    const copy = dir.dirs.get('PatOS-files').files.get(id);
    // everything in PatOS's storage is lost
    await new Promise((res) => { const tx = window.__IDB.transaction('blobs', 'readwrite'); tx.objectStore('blobs').delete(id); tx.oncomplete = res; });
    const gone = await PatOS.fs.getBlob('/Videos/clip.bin');
    const n = await PatOS.backup.folder.loadBig(dir, tree);
    const back = await PatOS.fs.getBlob('/Videos/clip.bin');
    const same = back && back.size === bytes.length && new Uint8Array(await back.arrayBuffer()).every((v, i) => v === bytes[i]);
    return { c, again, size: copy && copy.size, gone: !!gone, n, same, type: back && back.type };
  });
  assert.deepEqual(r.c, { total: 1, copied: 1, skipped: 0 }); assert.deepEqual(r.again, { total: 1, copied: 0, skipped: 0 });
  assert.equal(r.size, 300000); assert.equal(r.gone, false); assert.equal(r.n, 1); assert.equal(r.same, true); assert.equal(r.type, 'video/mp4');
  await page.close();
});
