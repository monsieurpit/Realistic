/* PatOS Gallery (4.0, js/apps/gallery.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const G = 'PatOS.wm.windowsOf("gallery")[0]._gallery';

// real little pictures (PNG made on a canvas), saved in /Pictures
const pictures = (n) => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d'); const out = [];
  try { PatOS.fs.mkdir('/Pictures/Lots'); } catch (e) {}
  for (let i = 0; i < n; i++) { x.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,55%)'; x.fillRect(0, 0, 64, 48); const p = '/Pictures/Lots/p' + i + '.png'; PatOS.fs.write(p, c.toDataURL('image/png')); out.push(p); } return out; };

test('Gallery: big galleries stay light, five layouts, present, remove keeps the file, reorder', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  const paths = await ev(pictures, 300);
  await ev(() => { PatOS.store.set('notes', [{ id: 'n1', title: 'Field trip', body: 'We saw birds.' }]); PatOS.launch('gallery'); });
  await page.waitForSelector('.gl-win');
  const id = await ev((ps) => PatOS.gallery.create('Lots', { items: ps.map((p) => ({ kind: 'file', path: p })).concat([{ kind: 'note', noteId: 'n1' }, { kind: 'link', url: 'https://example.com' }, { kind: 'link', url: 'javascript:alert(1)' }]) }), paths);
  assert.equal(await ev((i) => PatOS.gallery.items(i).length, id), 302, 'a bad link is refused');
  await ev((a) => eval(a[0]).open(a[1]), [G, id]); await page.waitForTimeout(800);
  const drawn = await ev(() => [document.querySelectorAll('.gl-card').length, document.querySelectorAll('.gl-card img').length]);
  assert.ok(drawn[0] <= 120, 'drawn in pieces: ' + drawn[0]); assert.ok(drawn[1] < 80, 'only pictures near the screen load: ' + drawn[1]);
  // every layout
  for (const lay of ['masonry', 'wall', 'free', 'list', 'grid']) {
    await ev((l) => [...document.querySelectorAll('.ui-seg button')].find((x) => x.textContent.toLowerCase().replace(' ', '') === ({ masonry: 'masonry', wall: 'photowall', free: 'free', list: 'list', grid: 'grid' })[l]).click(), lay);
    await page.waitForTimeout(200);
    assert.ok(await ev((l) => !!document.querySelector('.gl-' + l), lay), 'layout ' + lay);
  }
  // remove one: the file stays
  await ev(() => document.querySelector('.gl-card').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 300, clientY: 300 })));
  await ev(() => [...document.querySelectorAll('.menu *')].find((x) => /Take out of the gallery/.test(x.textContent) && x.children.length === 0).click()); await page.waitForTimeout(200);
  assert.equal(await ev((i) => PatOS.gallery.items(i).length, id), 301); assert.ok(await ev(() => PatOS.fs.exists('/Pictures/Lots/p0.png')), 'the file is still there');
  // present: arrows move, Escape closes
  await ev((g) => eval(g).present(0), G); await page.waitForSelector('.gl-show img');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  assert.equal(await ev(() => PatOS.wm.windowsOf('gallery')[0]._presenting.i), 2);
  await page.keyboard.press('Escape'); assert.equal(await ev(() => document.querySelectorAll('.gl-show').length), 0);
  assert.deepEqual(errors, []); await page.close();
});

test('Gallery: follows a Data collection; export → import keeps it, without your file paths', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(pictures, 3);
  await ev(() => { PatOS.fs.write('/Documents/Bird list.txt', 'robin, jay #birds'); PatOS.store.set('notes', [{ id: 'n1', title: 'Birds seen', body: 'robin #birds' }]); PatOS.emit('notes'); PatOS.emit('fs'); });
  const cid = await ev(() => PatOS.data.createCollection('Birds', ['birds']));
  await ev((c) => PatOS.launch('gallery', { collection: c }), cid); await page.waitForSelector('.gl-card');
  assert.ok((await ev(() => [...document.querySelectorAll('.gl-card')].map((c) => c.textContent).join(' '))).includes('Bird list'), 'the collection’s things show');
  // a new thing in the collection shows up by itself
  await ev(() => { PatOS.fs.write('/Documents/Bird photos plan.txt', 'camera #birds'); PatOS.emit('fs'); PatOS.data.build(); });
  const gid = await ev((g) => eval(g).gid, G);
  assert.ok((await ev((i) => PatOS.gallery.items(i).map((x) => x.path || '').join(' '), gid)).includes('Bird photos plan'));
  // export → import: previews and titles travel, your file paths don't
  const own = await ev(() => PatOS.gallery.create('Trip', { items: ['/Pictures/Lots/p0.png', '/Pictures/Lots/p1.png', '/Documents/Bird list.txt'].map((p) => ({ kind: 'file', path: p })).concat([{ kind: 'note', noteId: 'n1' }]) }));
  await ev((a) => eval(a[0]).open(a[1]), [G, own]);
  const txt = await ev((g) => eval(g).packed(), G);
  assert.ok(!/\/Pictures\/Lots|\/Documents\//.test(txt), 'no paths from this PatOS in the shared copy');
  const o = JSON.parse(txt); assert.equal(o.items.filter((i) => i.kind === 'preview').length, 2); assert.ok(o.items.some((i) => i.kind === 'label' && i.title === 'Birds seen'));
  const imp = await ev((a) => eval(a[0]).importText(a[1]), [G, txt]);
  assert.equal(await ev((i) => PatOS.gallery.items(i).length, imp), 4);
  assert.match(await ev((a) => { try { eval(a[0]).importText('{"schema":"nope"}'); return 'ok'; } catch (e) { return e.message; } }, [G]), /isn’t a PatOS gallery/);
  // opening a .patgallery file from Piles imports it
  await ev((t) => { PatOS.fs.write('/Downloads/shared.patgallery', t); PatOS.openFile('/Downloads/shared.patgallery'); }, txt); await page.waitForTimeout(500);
  assert.equal(await ev(() => PatOS.gallery.list().filter((g) => g.name === 'Trip').length), 3, 'imported again from the file');
  assert.deepEqual(errors, []); await page.close();
});
