/* PatOS AI (4.0, js/intel-40.js): more things Pat understands. No language model: patterns, parsers, checked actions. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('Pat: files by when, everything about something, notifications summed up, the history says what it understood', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  // a document changed last Tuesday, a picture yesterday, an old one
  await ev(() => {
    const at = (p, t) => { const n = PatOS.fs.get(p); n.mtime = t; n.modified = t; };
    const day = (back) => { const d = new Date(); d.setHours(11, 0, 0, 0); d.setDate(d.getDate() - back); return +d; };
    const tue = ((new Date().getDay() - 2 + 7) % 7) || 7;
    PatOS.fs.write('/Documents/Essay draft.txt', 'about rivers'); at('/Documents/Essay draft.txt', day(tue));
    PatOS.fs.write('/Pictures/beach.png', 'x'); at('/Pictures/beach.png', day(1));
    PatOS.fs.write('/Documents/Old letter.txt', 'hi'); at('/Documents/Old letter.txt', day(40));
  });
  const r1 = await ev(() => PatOS.intel.respond('the document I edited last Tuesday'));
  assert.equal(r1.ok, true, r1.message); assert.deepEqual(r1.data.paths, ['/Documents/Essay draft.txt'], r1.message);
  const r2 = await ev(() => PatOS.intel.respond('pictures from yesterday'));
  assert.deepEqual(r2.data.paths, ['/Pictures/beach.png'], r2.message);
  const r3 = await ev(() => PatOS.intel.respond('open the document i edited last tuesday'));
  assert.match(r3.message, /Opened/); await page.waitForTimeout(400);
  assert.ok(await ev(() => PatOS.wm.windows.length > 0), 'the file opened');
  assert.equal(await ev(() => PatOS.intel.respond('remind me to call mom tomorrow').message.includes('changed')), false, 'a reminder is not a file search');
  // words for time
  assert.equal(await ev(() => PatOS.intel.when('files from last week').label), 'last week');
  assert.equal(await ev(() => PatOS.intel.when('the stuff 3 days ago').to - PatOS.intel.when('the stuff 3 days ago').from), 86400000);
  // everything related to something (PatOS Data)
  await ev(() => { PatOS.fs.write('/Documents/Biology report.txt', 'mitosis #biology'); PatOS.store.set('notes', [{ id: 'n1', title: 'Biology notes', body: 'cells' }, { id: 'n2', title: 'Groceries', body: 'milk' }]); PatOS.store.set('reminders', [{ id: 'r1', text: 'Study biology' }]); PatOS.emit('fs'); PatOS.emit('notes'); });
  const r4 = await ev(() => PatOS.intel.respond('show me everything related to biology'));
  assert.ok(r4.data.keys.includes('note:n1') && r4.data.keys.includes('reminder:r1') && r4.data.keys.includes('file:/Documents/Biology report.txt'), r4.message);
  assert.ok(!r4.data.keys.includes('note:n2'));
  const r5 = await ev(() => PatOS.intel.respond('make a collection about biology'));
  assert.ok(r5.ok && r5.canUndo, r5.message); assert.equal(await ev(() => PatOS.data.collections().length), 1);
  await ev(() => PatOS.intel.undo()); assert.equal(await ev(() => PatOS.data.collections().length), 0, 'undo removes it');
  // notifications summed up
  await ev(() => { PatOS.notify({ title: 'New message from Sam', icon: 'messages' }); PatOS.notify({ title: 'Lunch?', icon: 'messages' }); PatOS.notify({ title: 'Storage almost full', icon: 'settings', priority: 'urgent' }); });
  const r6 = await ev(() => PatOS.intel.respond('summarize my notifications'));
  assert.ok(r6.data.total >= 3 && r6.data.apps >= 2, r6.message); assert.match(r6.message, /Storage almost full/); assert.match(r6.message, /Lunch\?/);
  // the history keeps what was understood
  const h = await ev(() => PatOS.intel.history().filter((x) => x.id === 'files.when').pop());
  assert.ok(h.params && h.params.label && h.params.kind === 'picture' || h.params.label, JSON.stringify(h));
  // ... and Settings shows it
  await ev(() => PatOS.launch('settings', { pane: 'intelligence' })); await page.waitForTimeout(700);
  assert.match(await ev(() => document.body.textContent), /Understood: /);
  assert.deepEqual(errors, []); await page.close();
});

test('Pat: prepare the desktop step by step, duplicates only after a yes (and back from the Trash), automations from words', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  // a School profile, and a test tomorrow
  await ev(() => { PatOS.profiles.create({ name: 'School' }); const home = PatOS.profiles.list().find((p) => p.name !== 'School'); PatOS.profiles.switchTo(home.id);
    const d = new Date(); d.setDate(d.getDate() + 1); const c = {}; c[PatOS.dateKey(d)] = [{ id: 'e1', title: 'Biology test', time: '09:00' }]; PatOS.store.set('calendar', c); });
  const r1 = await ev(() => { const r = PatOS.intel.respond('prepare my desktop for school tomorrow'); return { ok: r.ok, message: r.message, steps: r.data.steps, undo: r.canUndo }; });
  assert.equal(r1.ok, true, r1.message);
  assert.equal(await ev(() => PatOS.profiles.current().name), 'School');
  assert.ok(r1.steps.some((s) => /Biology test/.test(s.text)), 'tomorrow’s calendar: ' + r1.message);
  assert.ok(r1.steps.some((s) => /notes/i.test(s.text)), 'the Study workspace ran: ' + r1.message);
  await page.waitForTimeout(500);
  assert.ok(await ev(() => PatOS.wm.windows.filter((w) => !w.profileHidden).length >= 2), 'apps opened');
  await ev(() => PatOS.intel.undo()); assert.notEqual(await ev(() => PatOS.profiles.current().name), 'School', 'undo goes back');
  // duplicates: asks first, keeps the original, the copies go to the Trash and come back
  await ev(() => { PatOS.fs.write('/Downloads/photo.txt', 'same bytes here'); const n = PatOS.fs.get('/Downloads/photo.txt'); n.mtime = n.modified = Date.now() - 100000;
    PatOS.fs.write('/Downloads/photo (1).txt', 'same bytes here'); PatOS.fs.write('/Downloads/photo copy.txt', 'same bytes here'); PatOS.fs.write('/Downloads/other.txt', 'different'); });
  const ask = await ev(async () => { const r = await PatOS.intel.respond('find duplicates in downloads'); window._dup = r; return { status: r.status, message: r.message }; });
  assert.equal(ask.status, 'confirm', ask.message); assert.match(ask.message, /2 extra copies/);
  assert.ok(await ev(() => PatOS.fs.exists('/Downloads/photo (1).txt')), 'nothing moves before the yes');
  const no = await ev(() => { window._dup.decline(); return PatOS.intel.history().slice(-1)[0].status; }); assert.equal(no, 'declined', 'a no is written in the history');
  const ask2 = await ev(async () => { const r = await PatOS.intel.respond('find duplicates in downloads'); const d = r.confirm(); return { ok: d.ok, message: d.message, undo: d.canUndo }; });
  assert.equal(ask2.ok, true, ask2.message);
  assert.deepEqual(await ev(() => ['/Downloads/photo.txt', '/Downloads/photo (1).txt', '/Downloads/photo copy.txt', '/Downloads/other.txt'].map((p) => PatOS.fs.exists(p))), [true, false, false, true], 'the oldest stays');
  await ev(() => PatOS.intel.undo()); assert.ok(await ev(() => PatOS.fs.exists('/Downloads/photo (1).txt') && PatOS.fs.exists('/Downloads/photo copy.txt')), 'back from the Trash');
  // automations from words: checked, shown, saved only after a yes
  const a1 = await ev(() => { const r = PatOS.intel.respond('every weekday at 8am open calendar and notes'); window._auto = r; return { status: r.status, message: r.message }; });
  assert.equal(a1.status, 'confirm'); assert.match(a1.message, /weekdays at 08:00/); assert.equal(await ev(() => PatOS.shortcuts.list().length), 0);
  const a2 = await ev(() => { const r = window._auto.confirm(); return { ok: r.ok, message: r.message }; }); assert.equal(a2.ok, true, a2.message);
  const sc = await ev(() => PatOS.shortcuts.list()[0]); assert.deepEqual(sc.trigger, { type: 'time', at: '08:00', days: [1, 2, 3, 4, 5] }); assert.deepEqual(sc.steps.map((s) => s.p.text), ['open calendar', 'open notes']);
  const a3 = await ev(() => { const r = PatOS.intel.respond('when I unlock open music and fly to the moon'); return r.confirm ? r.confirm() : r; });
  assert.equal(a3.ok, false); assert.match(a3.message, /fly to the moon/, 'a step Pat can’t do is refused'); assert.equal(await ev(() => PatOS.shortcuts.list().length), 1);
  const a4 = await ev(() => PatOS.intel.respond('every day at 7:30pm, empty the trash')); const a4b = await ev(() => { const r = PatOS.intel.respond('every day at 7:30pm, empty the trash'); return r.confirm ? r.confirm().message : r.message; });
  assert.ok(a4 && /can’t automate|empty/i.test(a4b), 'something that asks first can’t run alone: ' + a4b);
  // app capabilities
  assert.ok(await ev(() => PatOS.intel.list().some((a) => a.owner === 'app:world')));
  const w = await ev(() => PatOS.intel.respond('new world called Trip')); assert.equal(w.ok, true, w.message);
  await page.waitForSelector('.wd-win, .wd-plane', { timeout: 5000 });
  assert.deepEqual(errors, []); await page.close();
});
