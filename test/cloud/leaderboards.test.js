/* Game Center leaderboards (4.1, js/gamecenter.js) against the Firebase emulator and the real firestore.rules:
   friends (people you talk to in Messages) and everyone, scores that only go up, the daily challenge's own board,
   and nobody can write someone else's score or a made-up name. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const emu = require('./emulator');
const { startServer, browser, boot } = require('../helpers');

let server, srv, b;
const tag = Date.now().toString(36).slice(-5);
test.before(async () => { if (emu.skip) return; server = await emu.start(); srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (server) server.stop(); });
const EMU = { auth: 'http://127.0.0.1:9199', firestoreHost: '127.0.0.1', firestorePort: 8180, projectId: 'demo-patos' };
async function person(name) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const u = name + tag; await page.evaluate(async (u) => { await PatOS.account.signUp(u, 'a long password 1'); }, u);
  await page.waitForFunction(() => PatOS.chat.ready(), null, { timeout: 20000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { ctx, page, ev, errors, name: u, uid: await ev(() => PatOS.account.info().uid) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const board = (P, kind, id) => P.ev(([k, id]) => (k === 'friends' ? PatOS.gc.friends(id) : PatOS.gc.top(id, 50)).then((l) => l.map((x) => [x.username, x.score])), [kind, id]);

test('leaderboards: friends and everyone, scores only go up, nobody writes for someone else', { skip: emu.skip }, async () => {
  const A = await person('lba'), B = await person('lbb'), C = await person('lbc');
  // Ann and Ben are friends (an accepted conversation); Cleo is a stranger
  const cid = await A.ev(async (o) => PatOS.chat.request(o, 'hi'), { uid: B.uid, username: B.name });
  await B.page.waitForFunction(() => PatOS.chat.requests().length === 1, null, { timeout: 15000 });
  await B.ev(async (id) => PatOS.chat.respond(id, true), cid);
  await A.page.waitForFunction((id) => (PatOS.chat.find(id) || {}).status === 'accepted', cid, { timeout: 15000 });
  // rounds end in Orb Runner
  await A.ev(() => PatOS.gc.report('orbrunner', { score: 500, world: 1 }));
  await B.ev(() => PatOS.gc.report('orbrunner', { score: 900, world: 1 }));
  await C.ev(() => PatOS.gc.report('orbrunner', { score: 700, world: 1 }));
  await wait(2500);
  assert.deepEqual(await board(A, 'friends', 'orbrunner'), [[B.name, 900], [A.name, 500]], 'friends: Ben and me, not Cleo');
  assert.deepEqual((await board(C, 'all', 'orbrunner')).filter(([n]) => n.endsWith(tag)), [[B.name, 900], [C.name, 700], [A.name, 500]], 'everyone');
  // a worse round changes nothing; a better one goes up
  await A.ev(() => PatOS.gc.report('orbrunner', { score: 200 })); await A.ev(() => PatOS.gc.report('orbrunner', { score: 1200 })); await wait(2000);
  assert.deepEqual(await board(B, 'friends', 'orbrunner'), [[A.name, 1200], [B.name, 900]]);
  // the daily challenge has its own board
  const day = await A.ev(() => PatOS.gc.daily().id);
  await A.ev((d) => PatOS.gc.report('2048', { score: 640, tile: 64, daily: d }), day); await wait(1500);
  assert.deepEqual(await board(B, 'friends', '2048-d' + day), [[A.name, 640]]);
  assert.equal(await A.ev(() => PatOS.gc.daily().best), 640); assert.equal(await A.ev(() => PatOS.gc.daily().played), true);

  // the rules, written directly: someone else's score, a made-up name, a lower score, a strange board, a huge score
  const tryPut = (P, o) => P.ev(async (o) => { const F = await PatOS.account.cloud(); try { await F.scorePut(o.board, { uid: o.uid, username: o.name }, o.score); return 'ok'; } catch (e) { return String(e.code || e.message); } }, o);
  assert.match(await tryPut(C, { board: 'orbrunner', uid: A.uid, name: A.name, score: 99999 }), /permission|rules/i, 'not for someone else');
  assert.match(await tryPut(C, { board: 'orbrunner', uid: C.uid, name: A.name, score: 99999 }), /permission|rules/i, 'not under someone else’s name');
  assert.match(await tryPut(C, { board: 'Bad Board!', uid: C.uid, name: C.name, score: 5 }), /permission|rules/i, 'board names are checked');
  assert.match(await tryPut(C, { board: 'orbrunner', uid: C.uid, name: C.name, score: 500000000 }), /permission|rules/i, 'no absurd scores');
  const raw = await C.ev(async (o) => { const F = await PatOS.account.cloud(); return F.scorePut('orbrunner', { uid: o.uid, username: o.name }, 10); }, { uid: C.uid, name: C.name });
  assert.equal(raw, false, 'a lower score is not even sent');
  assert.deepEqual((await board(A, 'all', 'orbrunner')).filter(([n]) => n === C.name), [[C.name, 700]]);
  for (const P of [A, B, C]) { assert.deepEqual(P.errors, []); await P.ctx.close(); }
});
