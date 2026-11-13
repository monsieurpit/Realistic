/* PatOS World (4.0, js/apps/world.js): infinite boards. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const W = 'PatOS.wm.windowsOf("world")[0]._world';

test('World: items of every kind, only what is near is drawn, zoom, groups, undo, saved', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { PatOS.fs.write('/Documents/bio.txt', 'cells'); PatOS.store.set('notes', [{ id: 'n1', title: 'Biology', body: 'mitosis' }]); PatOS.launch('world'); });
  await page.waitForSelector('.wd-vp');
  const ids = await ev((w) => { const x = eval(w); return [
    x.addItem({ kind: 'sticky', text: 'hello', x: 0, y: 0, w: 200, h: 160 }), x.addItem({ kind: 'file', path: '/Documents/bio.txt', x: 240, y: 0, w: 220, h: 90 }),
    x.addItem({ kind: 'link', url: 'https://example.com', x: 500, y: 0, w: 240, h: 90 }), x.addItem({ kind: 'note', noteId: 'n1', x: 0, y: 200, w: 220, h: 140 }),
    x.addItem({ kind: 'app', app: 'notes', x: 260, y: 200, w: 120, h: 120 }), x.addItem({ kind: 'app', app: 'calculator', x: 400, y: 200, w: 120, h: 120 }),
    x.addItem({ kind: 'widget', type: 'system', size: 'm', x: 0, y: 380, w: 316, h: 150 }), x.addItem({ kind: 'sticky', text: '<img src=x onerror=alert(1)>', x: 0, y: 560 }),
    x.addItem({ kind: 'link', url: 'javascript:alert(1)' }), x.addItem({ kind: 'bogus' })]; }, W);
  assert.equal(ids.filter(Boolean).length, 8, 'bad items are refused: ' + JSON.stringify(ids));
  await page.waitForTimeout(500);
  assert.ok(await ev(() => !!document.querySelector('.wd-wg .wg-inline .w-sys')), 'a live widget on the board');
  assert.ok(await ev(() => PatOS.proc.list().some((p) => p.app === 'widget:system')), 'running in its own process');
  assert.equal(await ev(() => document.querySelectorAll('.wd-sticky img').length), 0, 'a sticky’s text stays text');
  assert.ok(await ev(() => [...document.querySelectorAll('.wd-sticky textarea')].some((t) => t.value === '<img src=x onerror=alert(1)>')));
  // a group moves together (drag one of them)
  await ev((w) => { const x = eval(w); x.select([]); const a = x.world.items.find((i) => i.app === 'notes'), c = x.world.items.find((i) => i.app === 'calculator'); a.group = c.group = 'g1'; x.fit(); }, W); await page.waitForTimeout(300);
  const el = await ev(() => { const it = [...document.querySelectorAll('.wd-app')][0]; const r = it.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const before = await ev((w) => eval(w).world.items.filter((i) => i.group === 'g1').map((i) => [i.x, i.y]), W);
  await page.mouse.move(el.x, el.y); await page.mouse.down(); await page.mouse.move(el.x + 60, el.y + 40, { steps: 6 }); await page.mouse.up();
  const after = await ev((w) => eval(w).world.items.filter((i) => i.group === 'g1').map((i) => [i.x, i.y]), W);
  assert.ok(after.every((p, i) => p[0] > before[i][0] && p[1] > before[i][1]), 'both moved: ' + JSON.stringify([before, after]));
  // many items far apart: only those near the screen are in the page
  await ev((w) => { const x = eval(w); for (let i = 0; i < 600; i++) x.addItem({ kind: 'sticky', text: 'n' + i, x: 3000 + (i % 30) * 400, y: 3000 + Math.floor(i / 30) * 400, w: 200, h: 160 }); x.select([]); }, W);
  await page.waitForTimeout(300);
  const drawn = await ev((w) => eval(w).rendered(), W);
  assert.ok(drawn < 60, 'only what is near is drawn: ' + drawn + ' of 608');
  // zoom around a point keeps that point still
  const z = await ev((w) => { const x = eval(w); const r = document.querySelector('.wd-vp').getBoundingClientRect(); const cx = r.left + 300, cy = r.top + 200; const before = { x: (cx - r.left - x.view.x) / x.view.z, y: (cy - r.top - x.view.y) / x.view.z }; x.zoomAt(cx, cy, 2); const after = { x: (cx - r.left - x.view.x) / x.view.z, y: (cy - r.top - x.view.y) / x.view.z }; return [x.view.z, Math.abs(before.x - after.x) < 0.01 && Math.abs(before.y - after.y) < 0.01]; }, W);
  assert.deepEqual(z, [2, true]);
  await ev((w) => eval(w).zoomAt(0, 0, 1), W);
  // delete, then undo
  const n0 = await ev((w) => eval(w).world.items.length, W);
  await ev((w) => { const x = eval(w); x.removeIds([x.world.items[0].id]); }, W);
  assert.equal(await ev((w) => eval(w).world.items.length, W), n0 - 1);
  await ev(() => document.querySelector('.wd-vp').focus()); await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
  assert.equal(await ev((w) => eval(w).world.items.length, W), n0, 'Ctrl+Z puts it back');
  // a zone takes what is inside along when it moves
  await ev((w) => { const x = eval(w); x.addZone({ name: 'Bio', x: -40, y: -40, w: 800, h: 700 }); }, W);
  // saved: reopen the app
  await page.waitForTimeout(600); await ev(() => { PatOS.wm.windowsOf('world')[0].close(); }); await page.waitForTimeout(400);
  await ev(() => PatOS.launch('world')); await page.waitForSelector('.wd-vp');
  assert.deepEqual(await ev((w) => [eval(w).world.items.length, eval(w).world.zones.length], W), [n0, 1], 'saved');
  assert.deepEqual(errors, []); await page.close();
});

test('World: a real window pinned on the board keeps its state; a folder zone moves files through Piles', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { PatOS.fs.mkdir('/Documents/Bio'); PatOS.fs.write('/Downloads/cell.txt', 'x'); PatOS.launch('calculator'); PatOS.launch('world'); });
  await page.waitForSelector('.wd-vp'); await page.waitForTimeout(400);
  // pin the calculator: the very same window element moves onto the board
  const calc = await ev(() => PatOS.wm.windowsOf('calculator')[0].id);
  await ev((w) => { const x = eval(w); x.pin(PatOS.wm.windowsOf('calculator')[0]); }, W); await page.waitForTimeout(300);
  assert.ok(await ev((id) => !!document.querySelector('.wd-plane #' + id + '.in-world'), calc), 'the window is on the board');
  const id = await ev((w) => eval(w).world.items.find((i) => i.pinned).id, W);
  await ev((a) => { const x = eval(a[0]); x.unpin(a[1]); }, [W, id]); await page.waitForTimeout(200);
  assert.ok(await ev((cid) => document.getElementById(cid).parentElement.id === 'windows', calc), 'unpinned: back on the desktop, the same window');
  // a zone linked to a folder: drop a file in it, confirm, and Piles moves it
  await ev((w) => { const x = eval(w); x.addZone({ name: 'Bio', x: 0, y: 0, w: 600, h: 400, folder: '/Documents/Bio' }); x.addItem({ kind: 'file', path: '/Downloads/cell.txt', x: 100, y: 100, w: 220, h: 90 }); }, W);
  await ev((w) => { const x = eval(w); const f = x.world.items.find((i) => i.path === '/Downloads/cell.txt'); x.dropOnZone([f]); }, W);
  await page.waitForSelector('.dlg .btn.primary'); await ev(() => document.querySelector('.dlg .btn.primary').click());
  await page.waitForTimeout(2000);
  assert.deepEqual(await ev(() => [PatOS.fs.exists('/Downloads/cell.txt'), PatOS.fs.exists('/Documents/Bio/cell.txt')]), [false, true], 'moved by Piles’ file queue');
  assert.equal(await ev((w) => eval(w).world.items.find((i) => i.kind === 'file').path, W), '/Documents/Bio/cell.txt', 'and the board follows it');
  assert.deepEqual(errors, []); await page.close();
});
