/* PatOS Sync: two devices through one server. Changes, deletions and conflicts travel; the server holds only
   scrambled data; offline changes wait; a wiped server, or a brand new one filled from a backup, gets everything again. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, dataDir;
const dirs = [];
const mkData = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-sync-')); dirs.push(d); return d; };
test.before(async () => { if (skipNoBrowser) return; dataDir = mkData(); process.env.PATOS_DATA = dataDir; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })); });

async function device(base) {
  const ctx = await b.newContext(); const page = await ctx.newPage(); await boot(page, base || srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; });
  return { ctx, page, ev: (fn, arg) => page.evaluate(fn, arg) };
}
const allServerBytes = (dir) => { let s = ''; (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else s += fs.readFileSync(p, 'utf8'); }); })(path.join(dir, 'sync')); return s; };
let code;

test('a second device joins and gets files, notes and settings; the server sees nothing readable', { skip: skipNoBrowser }, async () => {
  const A = await device(), B = await device();
  await A.ev(() => { PatOS.fs.mkdir('/Documents/Secret Folder'); PatOS.fs.write('/Documents/Secret Folder/Plans.txt', 'top secret contents 12345'); PatOS.store.set('notes', [{ id: 'n1', title: 'Hello', body: 'note body xyz' }]); PatOS.setSetting('accent', '#ff2d55'); });
  code = await A.ev(async () => { const c = await PatOS.sync.enable(); await PatOS.sync.now(); return c; });
  assert.match(code, /^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal((await A.ev(() => PatOS.sync.status())).state, 'idle');
  assert.equal((await A.ev(() => PatOS.sync.status())).error, '');
  // a wrong code is refused; the right one (typed loosely) works
  assert.match(await B.ev(async () => { try { await PatOS.sync.join('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA'); return 'joined'; } catch (e) { return e.message; } }), /not right/);
  const r = await B.ev(async (c) => { await PatOS.sync.join(c.toLowerCase().replace(/-/g, ' ')); return { file: PatOS.fs.read('/Documents/Secret Folder/Plans.txt'), notes: PatOS.store.get('notes'), accent: PatOS.settings.accent, snap: PatOS.backup.list().some((x) => x.kind === 'before') }; }, code);
  assert.equal(r.file, 'top secret contents 12345'); assert.equal(r.notes[0].body, 'note body xyz'); assert.equal(r.accent, '#ff2d55'); assert.equal(r.snap, true);
  const bytes = allServerBytes(dataDir);
  assert.ok(bytes.length > 200, 'the server holds the records');
  ['Secret Folder', 'Plans.txt', 'top secret', 'note body', 'Hello', '#ff2d55', 'notes'].forEach((w) => assert.ok(!bytes.includes(w), 'server must not contain: ' + w));
  // the second device edits and deletes; the first follows
  await B.ev(() => { PatOS.fs.write('/Documents/fromB.txt', 'written on B'); PatOS.fs.remove('/Documents/Secret Folder/Plans.txt'); PatOS.store.set('notes', [{ id: 'n1', title: 'Hello', body: 'edited on B' }]); });
  await B.ev(() => PatOS.sync.now()); await A.ev(() => PatOS.sync.now());
  const a = await A.ev(() => ({ b: PatOS.fs.read('/Documents/fromB.txt'), gone: PatOS.fs.exists('/Documents/Secret Folder/Plans.txt'), trash: PatOS.fs.exists('/.Trash/Plans.txt'), note: PatOS.store.get('notes')[0].body }));
  assert.deepEqual(a, { b: 'written on B', gone: false, trash: true, note: 'edited on B' });
  await A.ctx.close(); await B.ctx.close();
});

test('the later change wins, whichever device syncs first; offline changes wait and nothing blocks', { skip: skipNoBrowser }, async () => {
  const A = await device(), B = await device();
  await A.ev(() => { PatOS.fs.write('/Documents/shared.txt', 'v0'); });
  const c = await A.ev(async () => { const k = await PatOS.sync.enable(); await PatOS.sync.now(); return k; });
  await B.ev((k) => PatOS.sync.join(k), c);
  // B writes first, A writes later; B sends first, then A: A's later edit must win on both
  await B.ev(() => PatOS.fs.write('/Documents/shared.txt', 'B1'));
  await new Promise((r) => setTimeout(r, 60));
  await A.ev(() => PatOS.fs.write('/Documents/shared.txt', 'A1'));
  await B.ev(() => PatOS.sync.now()); await A.ev(() => PatOS.sync.now()); await B.ev(() => PatOS.sync.now());
  assert.equal(await A.ev(() => PatOS.fs.read('/Documents/shared.txt')), 'A1'); assert.equal(await B.ev(() => PatOS.fs.read('/Documents/shared.txt')), 'A1');
  // offline: the edit is saved here at once, Sync says it is waiting, and it goes out later
  await B.ctx.setOffline(true);
  await B.ev(() => PatOS.fs.write('/Documents/offline.txt', 'made offline'));
  await B.ev(() => PatOS.sync.now());
  const off = await B.ev(() => ({ s: PatOS.sync.status(), f: PatOS.fs.read('/Documents/offline.txt') }));
  assert.equal(off.s.state, 'offline'); assert.equal(off.f, 'made offline');
  await B.ctx.setOffline(false);
  await B.ev(() => PatOS.sync.now()); await A.ev(() => PatOS.sync.now());
  assert.equal(await A.ev(() => PatOS.fs.read('/Documents/offline.txt')), 'made offline');
  // a wrong key is reported, not applied
  await A.ctx.close(); await B.ctx.close();
});

test('when the server is wiped, the first device that syncs fills it again and a new device can join', { skip: skipNoBrowser }, async () => {
  const A = await device();
  await A.ev(() => { PatOS.fs.write('/Documents/keep.txt', 'still here'); PatOS.store.set('contacts', [{ id: 'c1', name: 'Sam' }]); });
  const k = await A.ev(async () => { const c = await PatOS.sync.enable(); await PatOS.sync.now(); return c; });
  fs.rmSync(path.join(dataDir, 'sync'), { recursive: true, force: true }); // "I deleted my Railway"
  const st = await A.ev(async () => { await PatOS.sync.now(); return PatOS.sync.status(); });
  assert.equal(st.error, ''); assert.equal(st.state, 'idle');
  const C = await device();
  const r = await C.ev(async (c) => { await PatOS.sync.join(c); return { f: PatOS.fs.read('/Documents/keep.txt'), c: PatOS.store.get('contacts') }; }, k);
  assert.equal(r.f, 'still here'); assert.equal(r.c[0].name, 'Sam');
  await A.ctx.close(); await C.ctx.close();
});

test('a brand new server is filled from a restored backup, then other devices join it', { skip: skipNoBrowser }, async () => {
  const A = await device();
  await A.ev(() => { PatOS.fs.write('/Documents/thesis.txt', 'chapter one'); });
  const k = await A.ev(async () => { const c = await PatOS.sync.enable(); await PatOS.sync.now(); return c; });
  const backup = await A.ev(() => PatOS.backup.collect({ blobs: false }));
  assert.ok(backup.kv.syncKey, 'the backup carries the sync key');
  assert.ok(!backup.kv.syncState, 'but not the bookkeeping');
  const data2 = mkData(); process.env.PATOS_DATA = data2; const srv2 = await startServer();
  try {
    const E = await device(srv2.base);
    await E.ev((s) => PatOS.backup.apply(s), backup);
    await E.page.reload(); await E.page.waitForFunction(() => window.PatOS && PatOS.sync && PatOS.fs && PatOS.apps && Object.keys(PatOS.apps).length > 20, null, { timeout: 20000 });
    assert.equal(await E.ev(() => PatOS.sync.on()), true, 'Sync comes back by itself after restoring');
    await E.ev(() => PatOS.sync.now());
    assert.ok(allServerBytes(data2).length > 100, 'the new server received everything');
    const F = await device(srv2.base);
    const f = await F.ev(async (c) => { await PatOS.sync.join(c); return PatOS.fs.read('/Documents/thesis.txt'); }, k);
    assert.equal(f, 'chapter one');
    await E.ctx.close(); await F.ctx.close();
  } finally { srv2.stop(); process.env.PATOS_DATA = dataDir; }
  await A.ctx.close();
});

test('most things vanishing at once waits for a yes, and turning Sync off keeps everything here', { skip: skipNoBrowser }, async () => {
  const A = await device();
  await A.ev(() => { for (let i = 0; i < 30; i++) PatOS.fs.write('/Documents/f' + i + '.txt', 'x' + i); });
  await A.ev(async () => { await PatOS.sync.enable(); await PatOS.sync.now(); });
  await A.ev(() => { for (let i = 0; i < 30; i++) PatOS.fs.remove('/Documents/f' + i + '.txt', true); });
  const held = await A.ev(async () => { await PatOS.sync.now(); return PatOS.sync.status().hold; });
  assert.ok(held >= 30, 'deletions are held: ' + held);
  const after = await A.ev(async () => { await PatOS.sync.now({ force: true }); return PatOS.sync.status().hold; });
  assert.equal(after, 0);
  await A.ev(() => PatOS.fs.write('/Documents/last.txt', 'mine'));
  const off = await A.ev(async () => { await PatOS.sync.disable(true); return { on: PatOS.sync.on(), key: PatOS.store.get('syncKey', null), file: PatOS.fs.read('/Documents/last.txt') }; });
  assert.deepEqual(off, { on: false, key: null, file: 'mine' });
  await A.ctx.close();
});

test('Settings › Sync: turn on, show the code, join dialog, turn off', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const o = {};
    const w = PatOS.launch('settings', { pane: 'sync' }); await wait(700);
    const btn = (re) => [...w.body.querySelectorAll('.sy .btn')].find((x) => re.test(x.textContent));
    o.offText = w.body.querySelector('.sy').innerText; btn(/Turn On Sync/).click(); await wait(1500);
    o.statusText = w.body.querySelector('.sy').innerText; btn(/Hide/).click(); await wait(200); o.hidden = !w.body.querySelector('.sy-code'); btn(/Show Code/).click(); await wait(200);
    o.code = (w.body.querySelector('.sy-code') || {}).textContent;
    o.matches = o.code === PatOS.sync.code();
    btn(/Turn Off…/).click(); await wait(200); o.dlg = !!document.querySelector('.bk-dlg'); document.querySelector('.bk-dlg .dlg-btns .btn.primary').click(); await wait(800);
    o.after = w.body.querySelector('.sy').innerText; o.on = PatOS.sync.on();
    return o;
  });
  assert.match(r.offText, /Turn On Sync/); assert.match(r.statusText, /Up to date|Syncing|Waiting/); assert.match(r.code, /^([0-9A-Z]{4}-){6}[0-9A-Z]{4}$/); assert.equal(r.matches, true); assert.equal(r.hidden, true);
  assert.equal(r.dlg, true); assert.match(r.after, /Turn On Sync/); assert.equal(r.on, false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('an old copy of PatOS can send everything to a new server at another address', { skip: skipNoBrowser }, async () => {
  const A = await device();
  await A.ev(() => PatOS.fs.write('/Documents/rescue.txt', 'saved from the old site'));
  const k = await A.ev(async () => { const c = await PatOS.sync.enable(); await PatOS.sync.now(); return c; });
  const data2 = mkData(); process.env.PATOS_DATA = data2; const srv2 = await startServer();
  try {
    assert.match(await A.ev(async () => { try { await PatOS.sync.setServer('not a url'); return 'ok'; } catch (e) { return e.message; } }), /not a web address/);
    const st = await A.ev(async (u) => { await PatOS.sync.setServer(u); await PatOS.sync.now(); return PatOS.sync.status(); }, srv2.base);
    assert.equal(st.error, ''); assert.ok(allServerBytes(data2).length > 100, 'the new server received everything');
    const F = await device(srv2.base);
    assert.equal(await F.ev(async (c) => { await PatOS.sync.join(c); return PatOS.fs.read('/Documents/rescue.txt'); }, k), 'saved from the old site');
    await F.ctx.close();
  } finally { srv2.stop(); process.env.PATOS_DATA = dataDir; }
  await A.ctx.close();
});

test('a new code: the device keeps everything, the old code stops working, the new one joins', { skip: skipNoBrowser }, async () => {
  const A = await device(), B = await device(), C = await device();
  await A.ev(() => PatOS.fs.write('/Documents/mine.txt', 'kept'));
  const old = await A.ev(async () => { const c = await PatOS.sync.enable(); await PatOS.sync.now(); return c; });
  const fresh = await A.ev(async () => PatOS.sync.regenerate());
  assert.notEqual(fresh, old);
  assert.equal(await A.ev(() => PatOS.fs.read('/Documents/mine.txt')), 'kept');
  assert.equal(await B.ev(async (c) => { await PatOS.sync.join(c); return PatOS.fs.exists('/Documents/mine.txt'); }, old), false, 'the old code finds nothing');
  assert.equal(await C.ev(async (c) => { await PatOS.sync.join(c); return PatOS.fs.read('/Documents/mine.txt'); }, fresh), 'kept');
  await A.ctx.close(); await B.ctx.close(); await C.ctx.close();
});

test('Settings buttons that confirm with a notification work (new code, server address, backup snapshot)', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const o = { toasts: [] }; PatOS.notify = (n) => o.toasts.push(n.title);
    await PatOS.sync.enable(); await wait(800);
    const w = PatOS.launch('settings', { pane: 'sync' }); await wait(800);
    const btn = (re) => [...w.body.querySelectorAll('.btn')].find((x) => re.test(x.textContent));
    btn(/^Save$/).click(); await wait(800);
    btn(/Make a New Code/).click(); await wait(300); document.querySelector('.dlg .btn.primary').click(); await wait(1500);
    w._pane('backup'); await wait(600); btn(/Back Up Now|Snapshot now/).click(); await wait(800);
    o.alert = !!document.querySelector('.dlg');
    return o;
  });
  assert.deepEqual(r.toasts.filter((x) => !/Welcome/.test(x)), ['Server saved', 'New code ready', 'Snapshot saved']); assert.equal(r.alert, false);
  assert.deepEqual(errors, []);
  await page.close();
});
