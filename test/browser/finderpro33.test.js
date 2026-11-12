/* 3.3 Piles Pro: the operation queue (Live Activity, pause, cancel, errors, an interrupted job comes back paused), versions,
   duplicates (never deleted by themselves), compare, looking inside a zip, tabs and split view. Also the chain the spec asks
   for: a Piles job -> Live Activity -> a failure notification -> Command Center. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, reload, skipNoBrowser } = require('../helpers');

let srv, b, page, errors;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); page = await b.newPage({ viewport: { width: 1366, height: 820 } }); errors = await boot(page, srv.base, { fresh: true }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('the queue: a copy is a Live Activity; pause, resume; errors are said; Command Center shows a failed job', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    PatOS.fs.mkdir('/Documents/Batch'); PatOS.fs.mkdir('/Documents/Dest');
    const src = []; for (let i = 0; i < 8; i++) { const p = '/Documents/Batch/f' + i + '.txt'; PatOS.fs.write(p, 'file ' + i); src.push(p); }
    const id = PatOS.fileOps.enqueue('copy', src, '/Documents/Dest');
    const act = PatOS.live.list().find((a) => /Copying 8/.test(a.title));
    PatOS.live.act(act.id, 'pause'); await wait(150);
    const pausedAt = PatOS.fileOps.list().find((j) => j.id === id).done, status1 = PatOS.fileOps.list().find((j) => j.id === id).status;
    await wait(200); const still = PatOS.fileOps.list().find((j) => j.id === id).done;
    PatOS.live.act(act.id, 'resume'); for (let i = 0; i < 40 && PatOS.fs.list('/Documents/Dest').length < 8; i++) await wait(50);
    const copied = PatOS.fs.list('/Documents/Dest').length;
    // a job where one item fails: its file is deleted while the job is paused
    PatOS.fs.write('/Documents/Batch/extra.txt', 'x'); const src2 = src.slice(0, 5).concat(['/Documents/Batch/extra.txt']);
    const id2 = PatOS.fileOps.enqueue('move', src2, '/Documents/Dest'); PatOS.fileOps.pause(id2); await wait(100);
    PatOS.fs.remove('/Documents/Batch/extra.txt'); PatOS.fileOps.resume(id2);
    return { pausedAt, status1, still, copied, id2 };
  });
  assert.equal(r.status1, 'paused'); assert.equal(r.pausedAt, r.still, 'nothing happens while it is paused'); assert.equal(r.copied, 8);
  await page.waitForFunction(() => PatOS.live.recent().some((a) => /Moving/.test(a.title) && a.status === 'failed'), null, { timeout: 8000 });
  const f = await page.evaluate(async () => {
    const job = PatOS.fileOps.list().find((j) => j.kind === 'move'); const note = PatOS.nc.list().find((n) => /Moving/.test(n.title));
    PatOS.command.open(); await new Promise((res) => setTimeout(res, 250)); const att = document.querySelector('#cmd [data-sec="attention"]').innerText; PatOS.command.close();
    return { failed: job.failed, note: note && note.body, att, moved: PatOS.fs.list('/Documents/Batch').length };
  });
  assert.equal(f.failed.length, 1); assert.equal(f.failed[0].path, '/Documents/Batch/extra.txt'); assert.match(f.failed[0].error, /isn’t there anymore/);
  assert.match(f.note, /1 of 6 didn’t work/); assert.match(f.att, /Moving 6 items: didn’t finish/);
  assert.equal(f.moved, 3, 'the 5 that existed moved; the others stayed');
});

test('a job interrupted by closing PatOS comes back paused, with Resume', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => { const src = []; for (let i = 0; i < 6; i++) { const p = '/Documents/Batch/g' + i + '.txt'; PatOS.fs.write(p, 'g' + i); src.push(p); } PatOS.store.set('fileOps', [{ id: 'jx', kind: 'copy', dest: '/Documents/Dest', items: src.map((s, i) => ({ src: s, done: i < 2, error: '' })), status: 'running', t: Date.now() }]); });
  await reload(page); await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 }); await page.evaluate(() => PatOS.boot.login()); await page.waitForTimeout(600);
  await page.waitForFunction(() => PatOS.live && PatOS.live.list().some((a) => a.id === 'fo-jx'), null, { timeout: 8000 });
  const r = await page.evaluate(() => { const a = PatOS.live.list().find((x) => x.id === 'fo-jx'); return { status: a.status, can: a.can, progress: Math.round(a.progress * 100) }; });
  assert.equal(r.status, 'paused'); assert.equal(r.can.resume, true); assert.equal(r.progress, 33, 'it remembers what was done');
  await page.evaluate(() => PatOS.live.act('fo-jx', 'resume'));
  await page.waitForFunction(() => !PatOS.live.list().some((a) => a.id === 'fo-jx'), null, { timeout: 8000 });
});

test('versions, duplicates (nothing deleted by itself), compare, look inside a zip', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const p = '/Documents/essay.txt'; PatOS.fs.write(p, 'first draft'); PatOS.fs.write(p, 'second draft');
    const v = PatOS.versions.list(p); const ok = PatOS.versions.restore(p, v[0].i); const now = PatOS.fs.read(p), v2 = PatOS.versions.list(p).length;
    PatOS.fs.write('/Documents/a.txt', 'same content here'); PatOS.fs.write('/Pictures/b.txt', 'same content here'); PatOS.fs.write('/Documents/c.txt', 'same content herE');
    const groups = await PatOS.finderPro.duplicates('/');
    const g = groups.find((x) => x.paths.includes('/Documents/a.txt'));
    const d = PatOS.finderPro.compare('a\nb\nc', 'a\nc\nd');
    const blob = await PatOS.zip.zipPaths(['/Documents/a.txt', '/Documents/essay.txt']); await PatOS.fs.writeBlob('/Documents/pack.zip', blob);
    const win = PatOS.launch('finder', { path: '/Documents' }); await new Promise((res) => setTimeout(res, 400));
    await PatOS.finderPro.lookInside(win, '/Documents/pack.zip'); const rows = [...win.body.querySelectorAll('.ui-sheet .fp-path')].map((x) => x.textContent);
    const before = PatOS.fs.exists('/Documents/a.txt') && PatOS.fs.exists('/Pictures/b.txt');
    return { v: v.length, ok, now, v2, gPaths: g && g.paths, cIn: groups.some((x) => x.paths.includes('/Documents/c.txt')), d, rows, extracted: PatOS.fs.list('/Documents').some((x) => x.name === 'pack'), before };
  });
  assert.equal(r.v, 1); assert.equal(r.ok, true); assert.equal(r.now, 'first draft'); assert.equal(r.v2, 2, 'the text it replaced is kept too');
  assert.deepEqual(r.gPaths, ['/Documents/a.txt', '/Pictures/b.txt']); assert.equal(r.cIn, false, 'one different letter: not a duplicate');
  assert.ok(r.before, 'finding duplicates deletes nothing');
  assert.deepEqual(r.d, [['=', 'a'], ['-', 'b'], ['=', 'c'], ['+', 'd']]);
  assert.ok(r.rows.some((x) => /a\.txt/.test(x)) && r.rows.some((x) => /essay\.txt/.test(x))); assert.equal(r.extracted, false, 'looking inside extracts nothing');
});

test('tabs keep their own folders; split view puts two windows side by side', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => PatOS.wm.closeAll()); await page.waitForFunction(() => !PatOS.wm.windows.length, null, { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500);
  await page.evaluate(() => PatOS.launch('finder', { path: '/Documents' })); await page.waitForSelector('.window .fd-main');
  await page.click('.fd-main'); await page.keyboard.press('Control+t'); await page.waitForTimeout(200);
  await page.evaluate(() => PatOS.wm.windows.find((w) => w.app.id === 'finder')._go('/Pictures')); await page.waitForTimeout(150);
  const t = await page.evaluate(() => ({ tabs: PatOS.wm.windows.find((w) => w.app.id === 'finder')._finder.tabs(), bar: document.querySelectorAll('.fd-tab').length }));
  assert.deepEqual(t.tabs, ['/Documents', '/Pictures']); assert.equal(t.bar, 2);
  await page.click('.fd-tab:first-child'); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => PatOS.wm.windows.find((w) => w.app.id === 'finder').el._finderPath && PatOS.wm.windows.find((w) => w.app.id === 'finder').el._finderPath()), '/Documents');
  await page.evaluate(() => PatOS.wm.windows.find((w) => w.app.id === 'finder')._finder.split()); await page.waitForTimeout(900);
  const s = await page.evaluate(() => PatOS.wm.windows.filter((w) => w.app.id === 'finder').map((w) => Math.round(w.el.getBoundingClientRect().left / 50)));
  assert.equal(s.length, 2); assert.notEqual(s[0], s[1], 'side by side');
  assert.deepEqual(errors, []);
});
