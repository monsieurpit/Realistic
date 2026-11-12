/* PatOS Intelligence 2 (js/intel-mind.js, js/places.js): asking for what's missing, several commands at once, a conversation
   that remembers, phrases you teach, synonyms, questions about the system, places (with a fake OpenStreetMap and a fake
   location: no real network), and guesses that are never done without a yes. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, page;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); page = await b.newPage(); await boot(page, srv.base, { fresh: true }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const R = (t) => page.evaluate(async (x) => { const r = await PatOS.intel.respond(x); return r && { ok: r.ok, status: r.status, message: r.message }; }, t);

test('asking for what is missing, and the answer completes it', { skip: skipNoBrowser }, async () => {
  const a = await R('create a reminder'); assert.equal(a.status, 'ask'); assert.match(a.message, /What should I remind you about\?/);
  const b2 = await R('call mom tomorrow at 5pm'); assert.equal(b2.ok, true); assert.match(b2.message, /Reminder created: “call mom” for tomorrow/);
  const t1 = await R('set a timer'); assert.match(t1.message, /How long\?/);
  const t2 = await R('banana'); assert.equal(t2.status, 'ask'); assert.match(t2.message, /I didn’t get that\. How long\?/);
  const t3 = await R('10 minutes'); assert.match(t3.message, /Timer set for 10 min/);
  await R('create a folder'); const c = await R('cancel'); assert.match(c.message, /left it/);
  await R('take a note'); const other = await R('turn on dark mode'); assert.match(other.message, /dark mode is on/, 'a different command is done instead');
  assert.equal(await page.evaluate(() => PatOS.intel.waiting()), false);
});

test('several commands at once, each reported; words with "and" inside stay one command', { skip: skipNoBrowser }, async () => {
  const r = await R('turn on dark mode, set the volume to 30 and start a 25 min timer');
  assert.equal(r.ok, true); assert.match(r.message, /✓ Done, dark mode is on\.\n✓ Volume set to 30%\.\n✓ Timer set for 25 min/);
  const one = await R('remind me to buy milk and eggs'); assert.match(one.message, /“buy milk and eggs”/);
  const bad = await R('open notes and fly to the moon'); assert.ok(!bad || !/✓/.test(bad.message), 'not every part is a command: not split');
});

test('a conversation: move it, do it again, the second one, and tomorrow?, rename it, delete it, what did you do', { skip: skipNoBrowser }, async () => {
  await R('create a reminder to call Sam tomorrow');
  const fri = await page.evaluate(() => { const d = new Date(); do d.setDate(d.getDate() + 1); while (d.getDay() !== 5); return PatOS.dateKey(d); });
  const mv = await R('move it to friday'); assert.match(mv.message, /Moved “call Sam”/);
  assert.equal(await page.evaluate(() => PatOS.store.get('reminders').find((r) => r.text === 'call Sam').due), fri);
  await page.evaluate(() => { PatOS.fs.write('/Documents/alpha one.txt', 'x'); PatOS.fs.write('/Documents/alpha two.txt', 'x'); });
  await R('find files containing alpha'); const pick = await R('open the second one'); assert.match(pick.message, /Open(ed|ing) alpha (one|two)\.txt/);
  await R('show my reminders for today'); const tm = await R('and tomorrow?'); assert.match(tm.message, /tomorrow/);
  await R('create a folder called Trip'); const rn = await R('rename it to Trips'); assert.match(rn.message, /Renamed to “Trips”/);
  assert.equal(await page.evaluate(() => PatOS.fs.isDir('/Documents/Trips')), true);
  const again = await R('do it again'); assert.ok(again && again.message, 'repeats the last thing');
  const what = await R('what did you just do'); assert.match(what.message, /Most recent first/);
});

test('phrases you teach, synonyms and nicknames', { skip: skipNoBrowser }, async () => {
  assert.equal(await R('get ready for class'), null, 'not known before');
  const t = await R('when I say get ready for class, start my study workspace'); assert.match(t.message, /When you say “get ready for class”/);
  const run = await R('get ready for class'); assert.match(run.message, /Study workspace/);
  const bad = await R('when I say zzz top, fly to mars'); assert.equal(bad.ok, false);
  const f = await R('forget get ready for class'); assert.match(f.message, /Forgotten/); assert.equal(await R('get ready for class'), null);
  assert.deepEqual(await page.evaluate(() => [PatOS.intel.parse('fire up the calculator').params.app, PatOS.intel.parse('open my files').params.app, PatOS.intel.parse('go dark').id]), ['calculator', 'finder', 'settings.theme']);
  await page.evaluate(() => { PatOS.focusMode = false; });
});

test('questions about this PatOS', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => { PatOS.store.set('notes', [{ id: 'a', title: 'x', body: '' }, { id: 'b', title: 'y', body: '' }]); const d = new Date(); d.setDate(d.getDate() + 2); const c = {}; c[PatOS.dateKey(d)] = [{ id: 'e', title: 'Science fair', time: '09:00' }]; PatOS.store.set('calendar', c); });
  assert.match((await R('how many notes do I have')).message, /You have 2 notes/);
  assert.match((await R('what version am I on')).message, /PatOS 3\.2\.0/);
  assert.match((await R('when is my next event')).message, /Science fair/);
  assert.match((await R('how many days until christmas')).message, /days? until christmas|That’s today/);
  assert.match((await R('what day is christmas')).message, /December 25/);
  assert.match((await R('what time is it in tokyo')).message, /In Tokyo it’s/);
  assert.match((await R('am I online')).message, /online/);
  assert.match((await R('what’s due this week')).message, /Science fair|Due/);
  const st = await R('how much storage do I have left'); assert.match(st.message, /PatOS uses|doesn’t say/);
});

test('places: nearest gym with directions, near me, the second one, take me there, directions, where am I; refused location is said', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ geolocation: { latitude: 45.5, longitude: -73.57 }, permissions: ['geolocation'] });
  const p2 = await ctx.newPage(); await boot(p2, srv.base, { fresh: true });
  const asked = [];
  await ctx.route('https://nominatim.openstreetmap.org/**', (route) => { const u = route.request().url(); asked.push(u);
    const body = /reverse/.test(u) ? { display_name: '100 Rue Test, Montréal, Québec, Canada', lat: '45.5', lon: '-73.57' }
      : /q=gym/.test(u) ? [{ name: 'Far Gym', display_name: 'Far Gym, 9 Rue B, Montréal', lat: '45.53', lon: '-73.57' }, { name: 'Close Gym', display_name: 'Close Gym, 1 Rue A, Montréal', lat: '45.502', lon: '-73.57' }]
      : /q=pharmacy/.test(u) ? [{ name: 'Pharma One', display_name: 'Pharma One, 2 Rue C', lat: '45.501', lon: '-73.571' }, { name: 'Pharma Two', display_name: 'Pharma Two, 3 Rue D', lat: '45.51', lon: '-73.58' }]
      : /q=Union/.test(u) ? [{ name: 'Union Station', display_name: 'Union Station, Toronto', lat: '43.645', lon: '-79.38' }] : [];
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); });
  const r = await p2.evaluate(async () => {
    const opened = []; PatOS.openExternal = (u) => opened.push(u); const say = async (t) => (await PatOS.intel.respond(t)).message;
    const o = { gym: await say('bring me to the nearest gym'), maps: PatOS.wm.windowsOf('maps').length, dir: opened[0] || '' };
    o.ph = await say('find a pharmacy near me'); o.second = await say('the second one'); o.there = await say('take me there'); o.dir2 = opened[1] || '';
    o.to = await say('directions to Union Station'); o.here = await say('where am I');
    return o;
  });
  assert.match(r.gym, /The nearest gym fitness is Close Gym, 2[0-9]0 m away[\s\S]*Directions are open in Google Maps/);
  assert.equal(r.maps, 1); assert.match(r.dir, /google\.com\/maps\/dir\/\?api=1&origin=45\.5,-73\.57&destination=45\.502,-73\.57/);
  assert.match(r.ph, /Pharma One[\s\S]*Also: 2\. Pharma Two/); assert.match(r.second, /Pharma Two/); assert.match(r.there, /Directions to Pharma One are open/); assert.match(r.dir2, /destination=45\.501/);
  assert.match(r.to, /Directions to Union Station/); assert.match(r.here, /You’re near 100 Rue Test/);
  assert.ok(asked.some((u) => /viewbox=/.test(u) && /bounded=1/.test(u)), 'near me searches only around you');
  await ctx.close();
  // location refused: says so honestly
  const ctx2 = await b.newContext(); const p3 = await ctx2.newPage(); await boot(p3, srv.base, { fresh: true });
  const no = await p3.evaluate(async () => { navigator.geolocation.getCurrentPosition = (ok, bad) => bad({ code: 1 }); return (await PatOS.intel.respond('nearest gym')).message; });
  assert.match(no, /didn’t allow PatOS to see your location/); await ctx2.close();
});

test('guesses: Pat offers the closest simple command as a question, and only does it on a yes', { skip: skipNoBrowser }, async () => {
  const r = await page.evaluate(() => { const a = PatOS.assistantReply('how mny notes'); const q = PatOS.assistantReply('notificaton apps show'); return { a, q }; });
  assert.match(r.a + r.q, /Did you mean|not sure/);
  assert.equal(await page.evaluate(() => PatOS.intel.parse('notificaton apps show')), null, 'no guess unless asked');
});
