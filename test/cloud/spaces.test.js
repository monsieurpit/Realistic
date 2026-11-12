/* Shared Spaces against the real rules (firestore.rules) in the Firebase emulator: invitations, roles enforced by the
   server (not the app), outsiders see nothing, saves need the next revision (conflicts are caught), locks, comments, leaving. */
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

test('Shared Spaces: roles and invitations are enforced by the server', { skip: emu.skip }, async () => {
  const A = await person('own'), B = await person('edi'), C = await person('vie'), D = await person('out'), E = await person('sne');
  const sid = await A.ev(() => F.spaceCreate(ME, 'Science Project'));
  // invitations: B as editor, C as viewer
  assert.ok((await A.tryIt(([sid, u]) => F.spaceInvite(ME, sid, 'Science Project', u, 'editor'), [sid, B.name])).ok);
  assert.ok((await A.tryIt(([sid, u]) => F.spaceInvite(ME, sid, 'Science Project', u, 'viewer'), [sid, C.name])).ok);
  // before accepting, B can't read the space or its files
  assert.equal((await B.tryIt((sid) => new Promise((res, rej) => { const off = F.filesListen(sid, (l) => { off(); res(l); }, (e) => { off(); rej(e); }); }), sid)).ok, false, 'not a member yet: no files');
  // B sees the invitation and accepts it; C too
  const inv = await B.ev(() => new Promise((res) => { const off = F.invitesListen(ME.uid, (l) => { if (l.length) { off(); res(l[0]); } }); }));
  assert.equal(inv.role, 'editor'); assert.equal(inv.spaceName, 'Science Project');
  assert.ok((await B.tryIt((inv) => F.inviteAccept(ME, inv), inv)).ok);
  const invC = await C.ev(() => new Promise((res) => { const off = F.invitesListen(ME.uid, (l) => { if (l.length) { off(); res(l[0]); } }); }));
  assert.ok((await C.tryIt((inv) => F.inviteAccept(ME, inv), invC)).ok);
  // D was never invited: can't join by sending an accept for an invitation that isn't theirs, nor add themselves
  assert.equal((await D.tryIt(([sid, uid]) => F.spaceSetRole(ME, sid, uid, 'editor'), [sid, D.uid])).ok, false, 'an outsider can’t add themselves');
  assert.equal((await D.tryIt((inv) => F.inviteAccept(ME, inv), { sid })).ok, false, 'no invitation, no entry');
  // outsiders can't read anything
  assert.equal((await E.tryIt((sid) => new Promise((res, rej) => { const off = F.filesListen(sid, (l) => { off(); res(l); }, (e) => { off(); rej(e); }); }), sid)).ok, false);
  // the viewer can't raise their own role, save, or comment; the editor can't invite
  assert.equal((await C.tryIt(([sid, uid]) => F.spaceSetRole(ME, sid, uid, 'editor'), [sid, C.uid])).ok, false, 'a viewer can’t make themselves editor');
  const fid = await B.ev((sid) => F.fileCreate(ME, sid, 'Notes.txt', 'text', 'v1'), sid);
  assert.equal((await C.tryIt(([sid, fid]) => F.fileSave(ME, sid, fid, 'hacked', 1), [sid, fid])).ok, false, 'a viewer can’t save');
  assert.equal((await C.tryIt(([sid, fid]) => F.commentAdd(ME, sid, fid, 'hi'), [sid, fid])).ok, false, 'a viewer can’t comment');
  assert.equal((await B.tryIt(([sid, u]) => F.spaceInvite(ME, sid, 'Science Project', u, 'viewer'), [sid, D.name])).ok, false, 'an editor can’t invite');
  // saves: the next revision only; a save on an old revision is a conflict, nothing is overwritten
  assert.deepEqual((await A.ev(([sid, fid]) => F.fileSave(ME, sid, fid, 'v2 by owner', 1), [sid, fid])), { ok: true, rev: 2 });
  const stale = await B.ev(([sid, fid]) => F.fileSave(ME, sid, fid, 'v2 by editor', 1), [sid, fid]);
  assert.equal(stale.conflict, true); assert.equal(stale.theirs, 'v2 by owner');
  const revs = await A.ev(([sid, fid]) => F.fileRevs(sid, fid), [sid, fid]); assert.deepEqual(revs.map((r) => r.rev).sort(), [1, 2]);
  // a lock: while B holds it, the owner's save is refused
  await B.ev(([sid, fid]) => F.fileLock(ME, sid, fid, true), [sid, fid]);
  assert.equal((await A.ev(([sid, fid]) => F.fileSave(ME, sid, fid, 'v3', 2), [sid, fid])).locked, true);
  await B.ev(([sid, fid]) => F.fileLock(ME, sid, fid, false), [sid, fid]);
  // admins: the owner makes B admin; B can't make C admin, but can make C a commenter; then C can comment
  assert.ok((await A.tryIt(([sid, uid]) => F.spaceSetRole(ME, sid, uid, 'admin'), [sid, B.uid])).ok);
  assert.equal((await B.tryIt(([sid, uid]) => F.spaceSetRole(ME, sid, uid, 'admin'), [sid, C.uid])).ok, false, 'an admin can’t make admins');
  assert.equal((await B.tryIt(([sid, uid]) => F.spaceSetRole(ME, sid, uid, 'viewer'), [sid, A.uid])).ok, false, 'nobody changes the owner');
  assert.ok((await B.tryIt(([sid, uid]) => F.spaceSetRole(ME, sid, uid, 'commenter'), [sid, C.uid])).ok);
  assert.ok((await C.tryIt(([sid, fid]) => F.commentAdd(ME, sid, fid, 'looks good'), [sid, fid])).ok);
  // leaving: C leaves and then sees nothing; only the owner can delete the space
  assert.ok((await C.tryIt(([sid, uid]) => F.spaceRemove(ME, sid, uid), [sid, C.uid])).ok);
  assert.equal((await C.tryIt((sid) => new Promise((res, rej) => { const off = F.filesListen(sid, (l) => { off(); res(l); }, (e) => { off(); rej(e); }); }), sid)).ok, false);
  assert.equal((await B.tryIt((sid) => F.spaceDelete(sid), sid)).ok, false, 'an admin can’t delete the space');
  assert.ok((await A.tryIt((sid) => F.spaceDelete(sid), sid)).ok);
  for (const p of [A, B, C, D, E]) await p.ctx.close();
});
