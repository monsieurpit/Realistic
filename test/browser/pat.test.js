/* Pat (roadmap Tasks 42 and 43): more ways of asking, several steps at once, follow-ups, and skills in the apps. Pat is still a
   command helper (no AI): these check that it understands more, does exactly what it says, asks before moving files, can undo,
   and never says something worked when it did not. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, page, errors;
test.before(async () => {
  if (skipNoBrowser) return; srv = await startServer(); b = await browser();
  page = await b.newPage(); errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; });
});
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('polite and natural asking, in English and in French', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const say = (t) => PatOS.assistantReply(t); const o = {};
    o.en = say('can you open the calculator please'); await new Promise((res) => setTimeout(res, 700));
    o.enOpen = PatOS.wm.windows.some((w) => w.app.id === 'calculator'); PatOS.wm.closeAll();
    o.en2 = say('Hey Pat, could you tell me a joke?');
    PatOS.lang = 'fr';
    o.fr = say('peux-tu ouvrir notes s’il te plaît'); await new Promise((res) => setTimeout(res, 700));
    o.frOpen = PatOS.wm.windows.some((w) => w.app.id === 'notes'); PatOS.wm.closeAll();
    o.fr2 = say('tu peux me mettre un minuteur de 3 minutes stp');
    PatOS.lang = 'en';
    return o;
  });
  assert.match(r.en, /opening Calculator/); assert.equal(r.enOpen, true);
  assert.doesNotMatch(r.en2, /not sure|beyond me|didn’t catch/, 'a joke: ' + r.en2);
  assert.match(r.fr, /j’ouvre Notes/); assert.equal(r.frOpen, true);
  assert.match(r.fr2, /Minuteur réglé pour 3 min/);
});

test('two commands in one message; a note is never cut in two', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const q0 = (PatOS.store.get('alarmQueue') || []).length;
    const out = PatOS.assistantReply('open notes and set a timer for 5 min'); await new Promise((res) => setTimeout(res, 700));
    const o = { out, notes: PatOS.wm.windows.some((w) => w.app.id === 'notes'), timers: (PatOS.store.get('alarmQueue') || []).length - q0 };
    PatOS.wm.closeAll();
    const n0 = (PatOS.store.get('notes') || []).length;
    o.note = PatOS.assistantReply('note: buy eggs and milk and open the window');
    const notes = PatOS.store.get('notes') || []; o.added = notes.length - n0; o.text = notes[0].title;
    o.remind = PatOS.assistantReply('remind me to call Sam and Alex');
    o.rem = (PatOS.store.get('reminders') || []).slice(-1)[0].text;
    return o;
  });
  assert.match(r.out, /opening Notes[\s\S]*Timer set for 5 min/); assert.equal(r.notes, true); assert.equal(r.timers, 1);
  assert.equal(r.added, 1); assert.match(r.text, /buy eggs and milk and open/);
  assert.equal(r.rem, 'call Sam and Alex');
});

test('Notes and files: search by what is inside, then “open it” or “the second one”', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const say = (t) => PatOS.assistantReply(t); const o = {};
    PatOS.store.set('notes', [{ id: 'nA', title: 'Pasta recipe', body: '<div>Pasta recipe</div><div>Boil water, add salt.</div>', mtime: Date.now() }, { id: 'nB', title: 'Groceries', body: '<div>Groceries</div><div>salt, pasta, basil</div>', mtime: Date.now() - 5000 }, { id: 'nC', title: 'Trip', body: '<div>Lisbon</div>', mtime: Date.now() - 9000 }]);
    o.list = say('search my notes for pasta');
    o.second = say('the second one'); await wait(700);
    const w = PatOS.wm.windows.find((x) => x.app.id === 'notes'); o.openedId = w && w.args.id; PatOS.wm.closeAll();
    o.none = say('which notes mention zeppelin'); o.afterNone = say('open it');
    PatOS.fs.write('/Documents/Budget.txt', 'The hotel in Lisbon costs 120 euros a night');
    PatOS.fs.write('/Documents/Packing.pdoc', '<h1>Packing</h1><p>Passport and a Lisbon map</p>');
    o.docs = say('find documents about lisbon');
    o.open = say('open it'); await wait(700);
    o.win = PatOS.wm.windows.map((x) => x.app.id); PatOS.wm.closeAll();
    return o;
  });
  assert.match(r.list, /2 notes with “pasta”:\n• Pasta recipe\n• Groceries/);
  assert.match(r.second, /Opening the note/); assert.equal(r.openedId, 'nB');
  assert.match(r.none, /No note mentions “zeppelin”/); assert.match(r.afterNone, /^Open what?/, 'nothing left to open after an empty search: ' + r.afterNone);
  assert.match(r.docs, /2 documents with “lisbon”/); assert.match(r.docs, /Packing\.pdoc/); assert.match(r.docs, /Budget\.txt/);
  assert.match(r.open, /^Opening /); assert.ok(r.win.length === 1, 'the document opened: ' + r.win);
});

test('Docs: “create a document called …” makes it in Documents and opens it', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const out = PatOS.assistantReply('please create a document called Trip plan'); await new Promise((res) => setTimeout(res, 900));
    const w = PatOS.wm.windows.find((x) => x.app.id === 'docs'); const o = { out, exists: PatOS.fs.exists('/Documents/Trip plan.pdoc'), content: PatOS.fs.read('/Documents/Trip plan.pdoc'), docs: !!w };
    PatOS.wm.closeAll(); return o;
  });
  assert.match(r.out, /I made “Trip plan\.pdoc” in Documents/); assert.equal(r.exists, true); assert.match(r.content, /<h1>Trip plan<\/h1>/); assert.equal(r.docs, true);
});

test('tidying a folder asks first, moves nothing on a no, and can be undone', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const say = (t) => PatOS.assistantReply(t); const ls = () => PatOS.fs.list('/Downloads').map((x) => x.name + (x.type === 'dir' ? '/' : '')).sort();
    ['a.png', 'b.jpg', 'c.mp3', 'd.pdf'].forEach((n) => PatOS.fs.write('/Downloads/' + n, 'x'));
    const before = ls(); const o = { before };
    o.ask = say('tidy my downloads'); o.afterAsk = ls();
    o.no = say('no'); o.afterNo = ls();
    say('organize my downloads folder'); o.yes = say('yes'); o.afterYes = ls(); o.images = PatOS.fs.list('/Downloads/Images').map((x) => x.name).sort();
    o.undo = say('undo'); o.afterUndo = ls();
    o.stray = say('yes');
    return o;
  });
  assert.match(r.ask, /I can tidy Downloads: 4 files into 3 folders \(Images 2, Music 1, PDFs 1\)\. Nothing is deleted, and you can undo it\. Should I\?/);
  assert.deepEqual(r.afterAsk, r.before, 'nothing moves before a yes');
  assert.match(r.no, /left everything as it was/); assert.deepEqual(r.afterNo, r.before);
  assert.match(r.yes, /moved 4 files/); assert.deepEqual(r.images, ['a.png', 'b.jpg']);
  assert.ok(r.afterYes.includes('Images/') && !r.afterYes.includes('a.png'));
  assert.match(r.undo, /Put back: 4 files/); assert.deepEqual(r.afterUndo, r.before, 'everything back, and the new folders gone');
  assert.match(r.stray, /nothing waiting for a yes/);
});

test('summaries pick sentences from your text, and never claim more', { skip: skipNoBrowser }, async () => {
  const text = 'PatOS runs in the browser. It has many apps. The Dock keeps your favorite apps close. Sync keeps two devices together without the server reading anything. Handoff lets you continue on the other device. People use it at home.';
  const out = await page.evaluate((t) => PatOS.assistantReply('summarize: ' + t), text);
  assert.match(out, /^The key sentences \(I pick them from the text; I don’t write new ones\):/);
  const picked = out.split('\n').slice(1).map((l) => l.replace(/^• /, ''));
  assert.ok(picked.length >= 1 && picked.length <= 3);
  picked.forEach((s) => assert.ok(text.includes(s), 'a sentence from the text: ' + s));
  assert.match(await page.evaluate(() => PatOS.assistantReply('summarize: Short one. Two.')), /already short/);
});

test('it never says something worked when it didn’t, and explains what it didn’t understand', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(async () => {
    const said = []; const off = PatOS.on('pat:say', (t) => said.push(t));
    const launch = PatOS.launch; PatOS.launch = () => null; // an app that does not open
    const first = PatOS.assistantReply('open calculator'); await new Promise((res) => setTimeout(res, 700));
    PatOS.launch = launch; off();
    return { first, said, hint: PatOS.assistantReply('could you remind me something about the thing'), hint2: PatOS.assistantReply('organize everything somehow'), other: PatOS.assistantReply('flarb the wobble') };
  });
  assert.deepEqual(r.said, ['Calculator didn’t open.'], 'Pat says so after: ' + JSON.stringify(r.said));
  assert.match(r.hint, /Try it like this: “remind me to call Sam tomorrow at 5pm”/);
  assert.match(r.hint2, /tidy my downloads/);
  assert.match(r.other, /help/);
});

test('skills are explicit: listed, marked sensitive, and an app can add one', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(() => {
    const list = PatOS.pat.skills();
    let ran = 0;
    PatOS.pat.skill({ id: 'test.water', app: 'notes', sensitive: true, match: (t) => (/^water the plants$/i.test(t) ? {} : null), run: () => ({ text: 'Water them now?', confirm: () => { ran++; return 'Watered.'; } }) });
    const a = PatOS.assistantReply('water the plants'); const before = ran; const c = PatOS.assistantReply('yes');
    return { tidy: list.find((s) => s.id === 'files.tidy'), notes: list.find((s) => s.id === 'notes.search'), a, before, c, ran };
  });
  assert.deepEqual(r.tidy, { id: 'files.tidy', app: 'finder', sensitive: true });
  assert.equal(r.notes.sensitive, false);
  assert.equal(r.a, 'Water them now?'); assert.equal(r.before, 0, 'not before a yes'); assert.equal(r.c, 'Watered.'); assert.equal(r.ran, 1);
});

test('the chat panel: suggestions follow what is going on, and late messages appear', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => { ['x.png', 'y.png', 'z.mp3'].forEach((n) => PatOS.fs.write('/Downloads/' + n, 'x')); PatOS.pat.open(); });
  await page.waitForSelector('#pat-panel .msg-in');
  await page.fill('#pat-panel .msg-in', 'tidy my downloads'); await page.press('#pat-panel .msg-in', 'Enter'); await wait(800);
  const chips = await page.$$eval('#pat-panel .msg-chips button', (b) => b.map((x) => x.textContent));
  assert.deepEqual(chips, ['yes', 'no']);
  await page.click('#pat-panel .msg-chips button:has-text("no")'); await wait(800);
  await page.evaluate(() => PatOS.emit('pat:say', 'A late message'));
  assert.match(await page.textContent('#pat-panel .msg-list'), /left everything as it was[\s\S]*A late message/);
  await page.evaluate(() => PatOS.pat.close());
  assert.deepEqual(errors, []);
});
