/* PatOS's core: the file system, saving to the browser database, settings and moving old data over. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('files: create, edit, rename, move, copy, trash and restore', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(() => {
    const fs = PatOS.fs, out = {};
    fs.mkdir('/Documents/School');
    fs.write('/Documents/School/notes.txt', 'hello');
    out.read = fs.read('/Documents/School/notes.txt');
    fs.write('/Documents/School/notes.txt', 'hello again'); out.edited = fs.read('/Documents/School/notes.txt');
    const renamed = fs.rename('/Documents/School/notes.txt', 'homework.txt'); out.renamed = fs.read(renamed);
    fs.copy(renamed, '/Desktop'); out.copied = fs.read('/Desktop/homework.txt');
    fs.move('/Desktop/homework.txt', '/Downloads'); out.moved = !fs.get('/Desktop/homework.txt') && fs.read('/Downloads/homework.txt');
    fs.remove('/Downloads/homework.txt'); out.inTrash = fs.trashList().length > 0 && !fs.get('/Downloads/homework.txt');
    const t = fs.trashList()[0]; fs.restore(t.name); out.restored = fs.read('/Downloads/homework.txt');
    out.unique = fs.uniqueName('/Documents/School', 'homework.txt');
    return out;
  });
  assert.equal(r.read, 'hello'); assert.equal(r.edited, 'hello again'); assert.equal(r.renamed, 'hello again');
  assert.equal(r.copied, 'hello again'); assert.equal(r.moved, 'hello again'); assert.ok(r.inTrash); assert.equal(r.restored, 'hello again');
  assert.equal(r.unique, 'homework 2.txt');
  assert.deepEqual(errors, []);
  await page.close();
});

test('saving: text, big files and settings survive a restart', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(async () => {
    PatOS.fs.write('/Documents/keep.txt', 'x'.repeat(2 * 1024 * 1024)); // 2 MB of text
    await PatOS.fs.writeBlob('/Videos/clip.bin', new Blob([new Uint8Array(3 * 1024 * 1024).fill(7)]));
    PatOS.setSetting('userName', 'Tester');
  });
  await reload(page); // no explicit save: closing the page must keep the changes
  const r = await page.evaluate(async () => ({ text: (PatOS.fs.read('/Documents/keep.txt') || '').length, blob: (await PatOS.fs.getBlob('/Videos/clip.bin')).size, name: PatOS.settings.userName, db: !!PatOS.store.idb }));
  assert.equal(r.text, 2 * 1024 * 1024); assert.equal(r.blob, 3 * 1024 * 1024); assert.equal(r.name, 'Tester'); assert.ok(r.db, 'uses IndexedDB');
  await page.close();
});

test('old data in localStorage moves to the database once', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage();
  await page.goto(srv.base + '/manifest.webmanifest');
  await page.evaluate(() => new Promise((res) => { localStorage.clear(); const d = indexedDB.deleteDatabase('patos'); d.onsuccess = d.onerror = d.onblocked = () => res(); }));
  await page.evaluate(() => { localStorage.setItem('patos:setupDone', 'true'); localStorage.setItem('patos-policy', JSON.stringify({ version: '2026-11-09' })); localStorage.setItem('patos:notes', JSON.stringify([{ id: 'old1', title: 'From before', body: '<div>From before</div>', mtime: 1 }])); });
  await page.goto(srv.base + '/'); await page.waitForFunction(() => window.PatOS && PatOS.store);
  const r = await page.evaluate(() => ({ notes: (PatOS.store.get('notes') || []).map((n) => n.id), lsLeft: Object.keys(localStorage).filter((k) => k === 'patos:notes').length }));
  assert.deepEqual(r.notes, ['old1']);
  await page.close();
});

test('settings: defaults are filled in and new settings appear for old saves', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(async () => { PatOS.store.set('settings', { theme: 'light' }); await PatOS.flush(); });
  await reload(page);
  const s = await page.evaluate(() => PatOS.settings);
  assert.equal(s.theme, 'light'); assert.equal(s.reopenWindows, true); assert.ok('volume' in s && 'dockPinned' in s);
  await page.close();
});

test('a failed save keeps deletions too, and never undoes a newer write', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    PatOS.store.set('keep', 1); PatOS.store.set('gone', 1); PatOS.store.set('again', 1); await PatOS.flush();
    // the next save fails (as when the disk is full) while one key is deleted and another deleted then written again
    const real = window.__IDB.transaction.bind(window.__IDB); window.__IDB.transaction = () => { throw new Error('disk full'); };
    PatOS.store.remove('gone'); PatOS.store.remove('again'); await PatOS.flush();
    PatOS.store.set('again', 2); // newer than the deletion that failed
    window.__IDB.transaction = real; await PatOS.flush();
    return { gone: PatOS.store.get('gone', 'deleted'), again: PatOS.store.get('again') };
  });
  assert.equal(r.gone, 'deleted'); assert.equal(r.again, 2);
  await reload(page);
  const after = await page.evaluate(() => ({ keep: PatOS.store.get('keep'), gone: PatOS.store.get('gone', 'deleted'), again: PatOS.store.get('again') }));
  assert.deepEqual(after, { keep: 1, gone: 'deleted', again: 2 });
  await page.close();
});
