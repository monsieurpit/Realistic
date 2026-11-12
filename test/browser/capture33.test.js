/* 3.3: Universal Clipboard (secrets are never kept, transformations, collections, retention) and Universal Capture
   (quick box, understood types, routing with Universal Actions, done, delete and restore, the Capture app). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, page, errors;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); const ctx = await b.newContext({ viewport: { width: 1366, height: 820 }, permissions: ['clipboard-read', 'clipboard-write'] }); page = await ctx.newPage(); errors = await boot(page, srv.base, { fresh: true }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('clipboard: secrets are not kept, transformations work, collections filter, its own retention', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const TL = PatOS.timeline; const has = (t) => TL.clips().some((c) => c.text === t);
    ['4111 1111 1111 1111', 'sk-abcdefghijklmnopqrstuvwxyz123456', 'Tr0ub4dor&3x!', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'].forEach((t) => TL.addClip(t, 'copy'));
    TL.addClip('meet at the library at 4', 'copy'); TL.addClip('https://example.com/a?x=1 and https://www.patos.dev/b', 'copy');
    const secrets = ['4111 1111 1111 1111', 'sk-abcdefghijklmnopqrstuvwxyz123456', 'Tr0ub4dor&3x!', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'].map(has);
    const T = TL.TRANSFORMS.map((x) => x[0]); const tf = (name, text) => TL.transformClip(text, T.indexOf(name));
    const out = { secrets, normal: has('meet at the library at 4'),
      upper: tf('UPPERCASE', 'abc'), dup: tf('Remove duplicate lines', 'a\nb\na'), links: tf('Only the links', 'go https://example.com/a?x=1 and https://www.patos.dev/b'), domains: tf('Only the domains', 'https://example.com/a https://www.patos.dev/b https://example.com/c'),
      enc: tf('Encode for a URL', 'a b&c'), dec: tf('Decode from a URL', 'a%20b'), spaces: tf('Clean spaces', '  a   b  \n\n\n\n c ') };
    // a collection, and the panel filters by it
    const c = TL.clips().find((x) => x.text === 'meet at the library at 4'); c.col = 'School';
    TL.clipPanel(); await new Promise((res) => setTimeout(res, 200));
    out.chips = [...document.querySelectorAll('#clip-panel .cp-chip')].map((x) => x.textContent);
    document.querySelector('#clip-panel .cp-chip:nth-child(2)').click(); await new Promise((res) => setTimeout(res, 100));
    out.filtered = [...document.querySelectorAll('#clip-panel .cp-row .cp-txt > div')].map((x) => x.textContent);
    TL.clipPanel(); // (closes)
    // the clipboard keeps 1 day: an old clip goes, the pinned one stays
    PatOS.setSetting('clipDays', 1); const old = TL.clips()[0]; old.t = Date.now() - 3 * 86400000; old.pin = false; const pinned = TL.clips()[1]; pinned.t = Date.now() - 3 * 86400000; pinned.pin = true; TL.prune();
    out.oldGone = !TL.clips().some((x) => x.id === old.id); out.pinnedKept = TL.clips().some((x) => x.id === pinned.id);
    return out;
  });
  assert.deepEqual(r.secrets, [false, false, false, false], 'a card number, API keys and a password are never kept'); assert.equal(r.normal, true);
  assert.equal(r.upper, 'ABC'); assert.equal(r.dup, 'a\nb'); assert.equal(r.links, 'https://example.com/a?x=1\nhttps://www.patos.dev/b'); assert.equal(r.domains, 'example.com\npatos.dev');
  assert.equal(r.enc, 'a%20b%26c'); assert.equal(r.dec, 'a b'); assert.equal(r.spaces, 'a b\n\nc');
  assert.deepEqual(r.chips, ['All', 'School']); assert.deepEqual(r.filtered, ['meet at the library at 4']);
  assert.equal(r.oldGone, true); assert.equal(r.pinnedKept, true);
});

test('capture: the quick box saves without questions, types are understood, routing, done, delete and restore, the app', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => { PatOS.capture.list().forEach((i) => PatOS.capture.remove(i.id)); PatOS.capture.emptyTrash(); });
  await page.keyboard.press('Alt+KeyC'); await page.waitForSelector('#quick-capture.in');
  await page.keyboard.type('math test friday at 3pm'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.getElementById('quick-capture'));
  const r = await page.evaluate(async () => {
    const C = PatOS.capture;
    C.add('https://example.com/page'); C.add('maya@example.com'); C.add('just a thought to keep');
    const types = C.list().map((i) => [i.obj.type, i.why]);
    const ev = C.list().find((i) => i.obj.type === 'event');
    const thought = C.list().find((i) => i.title === 'just a thought to keep');
    const routed = await C.route(thought.id, 'notes.add');
    const inNotes = (PatOS.store.get('notes', []) || []).some((n) => /just a thought to keep/.test((n.title || '') + (n.body || '')));
    const doneNow = C.get(thought.id).done, inboxCount = C.count();
    const bad = await C.route(ev.id, 'photos.open'); // a date can't open in Photos: refused, not marked done
    const link = C.list().find((i) => i.obj.type === 'url'); C.remove(link.id); const gone = !C.get(link.id), inTrash = C.trash().some((i) => i.id === link.id); C.restore(link.id);
    return { types, evTitle: ev.obj.title, evDay: new Date(ev.obj.start).getDay(), evHour: new Date(ev.obj.start).getHours(), routed: routed.ok, inNotes, doneNow, inboxCount, bad: bad.ok, badDone: C.get(ev.id).done, gone, inTrash, back: !!C.get(link.id) };
  });
  assert.deepEqual(r.types.map((x) => x[0]).sort(), ['contact', 'event', 'text', 'url']);
  assert.ok(r.types.find((x) => x[0] === 'event')[1], 'it says why it is a date');
  assert.equal(r.evDay, 5, 'friday'); assert.equal(r.evHour, 15);
  assert.equal(r.routed, true); assert.ok(r.inNotes, 'really in Notes'); assert.equal(r.doneNow, true); assert.equal(r.inboxCount, 3);
  assert.equal(r.bad, false); assert.equal(r.badDone, false);
  assert.ok(r.gone && r.inTrash && r.back, 'deleted, then put back');
  // the Capture app shows them and sends one on
  await page.evaluate(() => PatOS.launch('capture')); await page.waitForSelector('.cap-row');
  assert.equal(await page.locator('.cap-row').count(), 3, 'the inbox: 3 left to sort');
  await page.click('.cap-row:has-text("maya@example.com")'); await page.waitForSelector('.cap-acts .btn');
  const acts = await page.$$eval('.cap-detail .cap-acts .btn', (b) => b.map((x) => x.textContent));
  assert.ok(acts.includes('Add to Notes') && acts.includes('Remind Me') && acts.includes('Add to Calendar'), acts.join(','));
  assert.deepEqual(errors, []);
});
