/* PatOS Commons (4.0) against the real rules (firestore.rules) in the Firebase emulator: public and private communities,
   roles (owner > mod > member, pending), announcements and challenges only from moderators, the posting rate limit,
   bans, reports only moderators read, profiles, follows and blocks. */
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
const posts = (P, cid) => P.tryIt((cid) => new Promise((res, rej) => { const off = F.comPostsListen(cid, (l) => { off(); res(l); }, (e) => { off(); rej(e); }); }), cid);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('Commons: public and private communities, roles, the rate limit, bans and reports', { skip: emu.skip }, async () => {
  const O = await person('co'), M = await person('cm'), U = await person('cu'), X = await person('cx');
  // a public community: anyone can find it and join
  const pub = await O.ev(() => F.comCreate(ME, 'Pixel Art', 'Share your pixels', 'public', ['art']));
  assert.ok((await U.ev(() => F.comPublic(50))).some((c) => c.id === pub), 'found in discovery');
  assert.ok((await U.tryIt((cid) => F.comJoin(ME, cid, true), pub)).ok, 'joins a public one');
  assert.ok((await M.tryIt((cid) => F.comJoin(ME, cid, true), pub)).ok);
  // nobody makes themselves owner or moderator
  assert.equal((await U.tryIt(([cid, uid]) => F.comSetRole(cid, uid, 'mod'), [pub, U.uid])).ok, false, 'a member can’t make themselves a moderator');
  assert.equal((await X.tryIt(async (cid) => { await F.comJoin(ME, cid, true); await F.comSetRole(cid, ME.uid, 'owner'); }, pub)).ok, false);
  assert.ok((await O.tryIt(([cid, uid]) => F.comSetRole(cid, uid, 'mod'), [pub, M.uid])).ok, 'the owner makes a moderator');
  // posts: anyone in it; announcements and challenges only moderators
  assert.ok((await U.tryIt((cid) => F.comPost(ME, cid, { kind: 'post', title: 'My cat', text: '8-bit cat' }), pub)).ok);
  assert.equal((await U.tryIt((cid) => F.comPost(ME, cid, { kind: 'announcement', title: 'I rule', text: 'x' }), pub)).ok, false, 'members can’t announce');
  assert.ok((await M.tryIt((cid) => F.comPost(ME, cid, { kind: 'announcement', title: 'Welcome', text: 'Be kind' }), pub)).ok, 'a moderator can');
  // the rate limit: a second post right away is refused by the server
  assert.equal((await U.tryIt((cid) => F.comPost(ME, cid, { kind: 'post', title: 'Spam', text: 'spam' }), pub)).ok, false, 'too fast');
  // ...and so is lying about it (a post without moving lastPost)
  assert.equal((await U.tryIt((cid) => F.comPost(ME, cid, { kind: 'post', title: 'Sneaky', text: 'x', attach: 'x'.repeat(200000), attachKind: 'desk' }), pub)).ok, false, 'too big');
  // a challenge, and an entry while it is open
  await wait(21000); // (the rate limit: one post per 20 s for each person)
  const ch = await M.ev((cid) => F.comPost(ME, cid, { kind: 'challenge', title: 'Draw a dragon', text: 'One week', endsAt: Date.now() + 7 * 864e5 }), pub);
  assert.ok((await U.tryIt(([cid, ch]) => F.comPost(ME, cid, { kind: 'entry', title: 'Dragon', text: 'rawr', challenge: ch, attach: '{"schema":"patos.studiowidget/1"}', attachKind: 'widget' }), [pub, ch])).ok, 'an entry with a shared widget');
  assert.equal((await O.tryIt((cid) => F.comPost(ME, cid, { kind: 'post', title: 'Code', text: 'x', attach: '<script>', attachKind: 'app' }), pub)).ok, false, 'only desks, galleries and widgets can be shared');
  // reports: one per person per post, only moderators read them
  const list = (await posts(X, pub)).r; const cat = list.find((p) => p.title === 'My cat');
  assert.ok((await X.tryIt(([cid, pid]) => F.comReport(ME, cid, pid, 'not a cat'), [pub, cat.id])).ok, 'anyone who can read it can report it');
  assert.equal((await U.tryIt((cid) => F.comReports(cid), pub)).ok, false, 'members can’t read reports');
  const reps = await M.ev((cid) => F.comReports(cid), pub); assert.equal(reps.length, 1); assert.equal(reps[0].reason, 'not a cat');
  // moderation: a moderator removes the post and bans the person; they can’t come back or post
  assert.equal((await X.tryIt(([cid, pid]) => F.comDeletePost(cid, pid), [pub, cat.id])).ok, false, 'not your post');
  assert.ok((await M.tryIt(([cid, pid]) => F.comDeletePost(cid, pid), [pub, cat.id])).ok);
  assert.ok((await M.tryIt(([cid, uid]) => F.comBan(ME, cid, uid, 'spam'), [pub, U.uid])).ok);
  assert.equal((await U.tryIt((cid) => F.comJoin(ME, cid, true), pub)).ok, false, 'banned: can’t join again');
  assert.equal((await M.tryIt(([cid, uid]) => F.comBan(ME, cid, uid, 'coup'), [pub, O.uid])).ok, false, 'nobody bans the owner');
  assert.equal((await M.tryIt(([cid, uid]) => F.comRemove(cid, uid), [pub, O.uid])).ok, false, 'nor removes them');
  // a private community: invisible to outsiders until a moderator lets them in
  const priv = await O.ev(() => F.comCreate(ME, 'Study group', 'Grade 10', 'private', []));
  assert.ok(!(await X.ev(() => F.comPublic(50))).some((c) => c.id === priv), 'not in discovery');
  assert.equal((await X.tryIt((cid) => F.comJoin(ME, cid, true), priv)).ok, false, 'can’t just join');
  assert.ok((await X.tryIt((cid) => F.comJoin(ME, cid, false), priv)).ok, 'can ask');
  assert.equal((await posts(X, priv)).ok, false, 'asking isn’t reading');
  assert.equal((await X.tryIt((cid) => F.comPost(ME, cid, { kind: 'post', title: 'hi', text: 'x' }), priv)).ok, false, 'nor posting');
  assert.ok((await O.tryIt(([cid, uid]) => F.comSetRole(cid, uid, 'member'), [priv, X.uid])).ok, 'let in');
  assert.ok((await posts(X, priv)).ok, 'now X reads it');
  assert.equal((await M.tryIt((cid) => F.comGet(cid), priv)).ok, false, 'an outsider can’t read a private community');
  for (const P of [O, M, U, X]) await P.ctx.close();
});

test('Commons: profiles, follows and blocks', { skip: emu.skip }, async () => {
  const A = await person('pa'), B = await person('pb');
  assert.ok((await A.tryIt(() => F.profileSet(ME, 'I draw dragons'))).ok);
  assert.equal((await B.ev((uid) => F.profileGet(uid), A.uid)).bio, 'I draw dragons', 'anyone signed in reads a profile');
  assert.equal((await B.tryIt((uid) => F.profileSet({ uid, username: 'x' }, 'hacked'), A.uid)).ok, false, 'only your own');
  assert.ok((await B.tryIt((uid) => F.follow(ME, uid, true), A.uid)).ok);
  assert.deepEqual((await A.ev((uid) => F.follows(uid), A.uid)).followers, [B.uid]);
  // A blocks B: B no longer follows A and can't follow again
  assert.ok((await A.tryIt((uid) => F.block(ME, uid, true), B.uid)).ok);
  assert.deepEqual((await A.ev((uid) => F.follows(uid), A.uid)).followers, [], 'the block removed the follow');
  assert.equal((await B.tryIt((uid) => F.follow(ME, uid, true), A.uid)).ok, false, 'can’t follow someone who blocked you');
  assert.equal((await B.ev(() => F.blocked(ME))).length, 0, 'B doesn’t see A’s blocks');
  assert.equal((await B.tryIt(([a, b]) => F.follow({ uid: a, username: 'x' }, b, true), [A.uid, B.uid])).ok, false, 'a follow can’t be made for someone else');
  for (const P of [A, B]) await P.ctx.close();
});
