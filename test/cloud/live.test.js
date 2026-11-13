/* PatOS Live (4.0) against the real rules (firestore.rules) in the Firebase emulator: presence is only your own, boards,
   live notes and tasks follow the space's roles and need the next revision (two people never overwrite each other
   silently), voice signals are readable only by the two people they are between, outsiders see nothing. */
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
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); await boot(page, srv.base, { fresh: true });
  const u = name + tag; await page.evaluate(async (u) => { await PatOS.account.signUp(u, 'a long password 1'); window.F = await PatOS.loadFirebase(); window.ME = { uid: PatOS.account.info().uid, username: u }; }, u);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const tryIt = (fn, arg) => page.evaluate(async ([src, a]) => { try { const r = await (0, eval)('(' + src + ')')(a); return { ok: true, r }; } catch (e) { return { ok: false, code: e.code || '', msg: e.message }; } }, [fn.toString(), arg]);
  return { ctx, page, ev, tryIt, name: u, uid: await page.evaluate(() => window.ME.uid) };
}
const once = (P, path) => P.tryIt((path) => new Promise((res, rej) => { const off = F.liveListen(path, (l) => { off(); res(l); }, (e) => { off(); rej(e); }); }), path);
async function join(owner, who, sid, role) {
  await owner.ev(([sid, u, r]) => F.spaceInvite(ME, sid, 'Team', u, r), [sid, who.name, role]);
  const inv = await who.ev(() => new Promise((res) => { const off = F.invitesListen(ME.uid, (l) => { if (l.length) { off(); res(l[0]); } }); }));
  await who.ev((inv) => F.inviteAccept(ME, inv), inv);
}

test('Live: presence, boards, notes and tasks follow the roles and the revisions', { skip: emu.skip }, async () => {
  const A = await person('lown'), B = await person('ledi'), C = await person('lvie'), D = await person('lout');
  const sid = await A.ev(() => F.spaceCreate(ME, 'Team'));
  await join(A, B, sid, 'editor'); await join(A, C, sid, 'viewer');
  // presence: your own, in this space only
  assert.ok((await B.tryIt((sid) => F.presenceSet(ME, sid, 'livespace', 'active'), sid)).ok);
  const pres = await once(C, ['spaces', sid, 'presence']); assert.ok(pres.ok); assert.deepEqual(pres.r.map((p) => p.name), [B.name], 'a viewer sees who is here');
  assert.equal((await D.tryIt((sid) => F.presenceSet(ME, sid, 'x', 'active'), sid)).ok, false, 'an outsider can’t say they are here');
  assert.equal((await once(D, ['spaces', sid, 'presence'])).ok, false, 'an outsider can’t see who is here');
  // someone else's presence can't be written: a raw write as B into A's document
  assert.equal((await B.tryIt(([sid, uid]) => F.presenceSet({ uid, username: 'x' }, sid, 'a', 'active'), [sid, A.uid])).ok, false);
  // boards: editors make and move things, viewers can only look
  const bid = await B.ev((sid) => F.liveHeadCreate(ME, sid, 'boards', 'Plan'), sid);
  assert.equal((await C.tryIt((sid) => F.liveHeadCreate(ME, sid, 'boards', 'Mine'), sid)).ok, false, 'a viewer can’t make a board');
  const item = { kind: 'sticky', x: 10, y: 20, w: 160, h: 120, text: 'Idea', color: '#ffd60a' };
  const put = await B.ev(([sid, bid, it]) => F.livePut(ME, ['spaces', sid, 'boards', bid, 'items'], null, it, 0), [sid, bid, item]);
  assert.equal(put.rev, 1);
  assert.equal((await C.tryIt(([sid, bid, id, it]) => F.livePut(ME, ['spaces', sid, 'boards', bid, 'items'], id, it, 1), [sid, bid, put.id, item])).ok, false, 'a viewer can’t move it');
  // A and B both move it from revision 1: the second one gets a conflict, not an overwrite
  const a1 = await A.ev(([sid, bid, id, it]) => F.livePut(ME, ['spaces', sid, 'boards', bid, 'items'], id, Object.assign({}, it, { x: 300 }), 1), [sid, bid, put.id, item]);
  const b1 = await B.ev(([sid, bid, id, it]) => F.livePut(ME, ['spaces', sid, 'boards', bid, 'items'], id, Object.assign({}, it, { x: 999 }), 1), [sid, bid, put.id, item]);
  assert.equal(a1.ok, true); assert.equal(b1.conflict, true); assert.equal(b1.theirs.x, 300, 'the other change is kept and shown');
  // the server itself refuses a write that skips the revision check, or carries bad values
  assert.equal((await B.tryIt(([sid, bid, id, it]) => F.livePut(ME, ['spaces', sid, 'boards', bid, 'items'], id, Object.assign({}, it, { color: 'red' }), 2), [sid, bid, put.id, item])).ok, false, 'a bad colour is refused');
  assert.equal((await B.tryIt(([sid, bid, it]) => F.livePut(ME, ['spaces', sid, 'boards', bid, 'items'], null, Object.assign({}, it, { w: 99999 }), 0), [sid, bid, item])).ok, false, 'a huge item is refused');
  assert.equal((await B.tryIt(([sid, bid, it]) => F.livePut(ME, ['spaces', sid, 'boards', bid, 'items'], null, Object.assign({}, it, { script: 'x' }), 0), [sid, bid, item])).ok, false, 'unknown fields are refused');
  assert.equal((await once(D, ['spaces', sid, 'boards', bid, 'items'])).ok, false, 'an outsider can’t read the board');
  // live notes: different paragraphs at once are fine; the same one needs the next revision
  const nid = await A.ev((sid) => F.liveHeadCreate(ME, sid, 'notes', 'Minutes'), sid);
  const p1 = await A.ev(([sid, nid]) => F.livePut(ME, ['spaces', sid, 'notes', nid, 'blocks'], null, { order: 1, text: 'First' }, 0), [sid, nid]);
  const p2 = await B.ev(([sid, nid]) => F.livePut(ME, ['spaces', sid, 'notes', nid, 'blocks'], null, { order: 2, text: 'Second' }, 0), [sid, nid]);
  assert.ok(p1.ok && p2.ok);
  const e1 = await A.ev(([sid, nid, id]) => F.livePut(ME, ['spaces', sid, 'notes', nid, 'blocks'], id, { order: 1, text: 'First, by A' }, 1), [sid, nid, p1.id]);
  const e2 = await B.ev(([sid, nid, id]) => F.livePut(ME, ['spaces', sid, 'notes', nid, 'blocks'], id, { order: 1, text: 'First, by B' }, 1), [sid, nid, p1.id]);
  assert.ok(e1.ok && e2.conflict && e2.theirs.text === 'First, by A');
  assert.equal((await C.tryIt(([sid, nid]) => F.livePut(ME, ['spaces', sid, 'notes', nid, 'blocks'], null, { order: 3, text: 'x' }, 0), [sid, nid])).ok, false, 'a viewer can’t write in the note');
  assert.ok((await once(C, ['spaces', sid, 'notes', nid, 'blocks'])).ok, 'but can read it');
  // tasks: the assignee must be a member
  const t1 = await B.ev(([sid, uid]) => F.livePut(ME, ['spaces', sid, 'tasks'], null, { text: 'Slides', done: false, assignee: uid }, 0), [sid, C.uid]);
  assert.ok(t1.ok);
  assert.equal((await B.tryIt(([sid, uid]) => F.livePut(ME, ['spaces', sid, 'tasks'], null, { text: 'Spy', done: false, assignee: uid }, 0), [sid, D.uid])).ok, false, 'not to someone outside the space');
  assert.ok((await A.ev(([sid, id]) => F.livePut(ME, ['spaces', sid, 'tasks'], id, { text: 'Slides', done: true, assignee: '' }, 1), [sid, t1.id])).ok);
  // stamped with who really wrote it: a write that claims to be someone else is refused
  assert.equal((await B.tryIt(([sid, uid]) => F.livePut({ uid, username: 'x' }, ['spaces', sid, 'tasks'], null, { text: 'Fake', done: false, assignee: '' }, 0), [sid, A.uid])).ok, false);
  // removed from the space: nothing more
  await A.ev(([sid, uid]) => F.spaceRemove(ME, sid, uid), [sid, B.uid]);
  assert.equal((await once(B, ['spaces', sid, 'tasks'])).ok, false, 'removed: can’t read anymore');
  for (const P of [A, B, C, D]) await P.ctx.close();
});

test('Live voice: signals only reach the two people they are between', { skip: emu.skip }, async () => {
  const A = await person('vown'), B = await person('vcom'), C = await person('vvie'), D = await person('vout');
  const sid = await A.ev(() => F.spaceCreate(ME, 'Team'));
  await join(A, B, sid, 'commenter'); await join(A, C, sid, 'viewer');
  const cid = await A.ev((sid) => F.callStart(ME, sid), sid);
  assert.equal((await C.tryIt((sid) => F.callStart(ME, sid), sid)).ok, false, 'a viewer can’t start a call');
  assert.ok((await B.tryIt(([sid, cid]) => F.callJoin(ME, sid, cid), [sid, cid])).ok);
  assert.equal((await D.tryIt(([sid, cid]) => F.callJoin(ME, sid, cid), [sid, cid])).ok, false, 'an outsider can’t join');
  // A sends B an offer
  assert.ok((await A.tryIt(([sid, cid, to]) => F.signalSend(ME, sid, cid, to, 'offer', '{"sdp":"x"}'), [sid, cid, B.uid])).ok);
  const got = await B.ev(([sid, cid]) => new Promise((res) => { const off = F.signalsListen(ME, sid, cid, (l) => { if (l.length) { off(); res(l); } }); }), [sid, cid]);
  assert.equal(got[0].from, A.uid); assert.equal(got[0].type, 'offer');
  // C, in the same space, can't read A→B signals, even by asking for all of them
  assert.equal((await once(C, ['spaces', sid, 'calls', cid, 'signals'])).ok, false, 'not readable by a third member');
  assert.equal((await A.tryIt(([sid, cid, to]) => F.signalSend(ME, sid, cid, to, 'offer', 'x'), [sid, cid, D.uid])).ok, false, 'no signals to someone outside the space');
  assert.equal((await A.tryIt(([sid, cid, to]) => F.signalSend(ME, sid, cid, to, 'evil', 'x'), [sid, cid, B.uid])).ok, false, 'only the known kinds');
  // the one who started it ends it
  assert.ok((await A.tryIt(([sid, cid]) => F.callEnd(sid, cid), [sid, cid])).ok);
  for (const P of [A, B, C, D]) await P.ctx.close();
});
