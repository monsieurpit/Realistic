/* The Firestore security rules (firestore.rules), run against the real emulator with real signed-in users:
   who may read and write what. Usage: npm run test:cloud (needs Java and firebase-tools, see test/cloud/emulator.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const emu = require('./emulator');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const F = require('firebase/firestore');

let server; const apps = []; let n = 0;
test.before(async () => { if (emu.skip) return; server = await emu.start(); });
test.after(async () => { await Promise.all(apps.map((a) => deleteApp(a).catch(() => {}))); if (server) server.stop(); });

/* a person with their own connection, like a separate device */
async function person(name, opts) {
  const app = initializeApp({ projectId: 'demo-patos', apiKey: 'demo-key' }, 'p' + (++n) + name);
  apps.push(app); const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:' + emu.ports.auth, { disableWarnings: true });
  const db = F.initializeFirestore(app, { experimentalForceLongPolling: true }); F.connectFirestoreEmulator(db, '127.0.0.1', emu.ports.firestore);
  let uid = null; if (!opts || !opts.anonymous) { const c = await createUserWithEmailAndPassword(auth, name + '@patos.invalid', 'password-' + name); uid = c.user.uid; }
  return { name, db, auth, uid, doc: (...p) => F.doc(db, ...p), col: (...p) => F.collection(db, ...p) };
}
const ok = (p) => assert.doesNotReject(p), no = async (p, why) => { await assert.rejects(p, (e) => /permission|insufficient|PERMISSION/i.test(e.code + e.message), why || 'should be refused'); };
const now = () => F.serverTimestamp();

test('usernames: you can claim only your own name, once; anyone signed in can search; only you can release it', { skip: emu.skip }, async () => {
  const alice = await person('alice' + Date.now().toString(36).slice(-4)), mallory = await person('mallory' + Date.now().toString(36).slice(-4)), nobody = await person('x', { anonymous: true });
  await ok(F.setDoc(alice.doc('usernames', alice.name), { uid: alice.uid, createdAt: now() }));
  await no(F.setDoc(mallory.doc('usernames', 'bobby_taken'), { uid: mallory.uid, createdAt: now() }), 'a name that is not yours (the sign-in says mallory)');
  await no(F.setDoc(mallory.doc('usernames', alice.name), { uid: mallory.uid, createdAt: now() }), 'someone else\'s name');
  await no(F.setDoc(mallory.doc('usernames', mallory.name), { uid: alice.uid, createdAt: now() }), 'a name pointing at someone else');
  await no(F.setDoc(mallory.doc('usernames', mallory.name), { uid: mallory.uid, createdAt: now(), extra: 1 }), 'extra fields');
  await no(F.setDoc(mallory.doc('usernames', mallory.name), { uid: mallory.uid, createdAt: new Date() }), 'a made-up time');
  await ok(F.setDoc(mallory.doc('usernames', mallory.name), { uid: mallory.uid, createdAt: now() }));
  await no(F.updateDoc(mallory.doc('usernames', alice.name), { uid: mallory.uid }), 'taking a name over');
  await no(F.deleteDoc(mallory.doc('usernames', alice.name)), 'deleting someone else\'s name');
  const found = await F.getDocs(F.query(alice.col('usernames'), F.where(F.documentId(), '>=', 'alice'), F.where(F.documentId(), '<', 'alice'))); assert.ok(found.docs.some((d) => d.id === alice.name));
  await no(F.getDocs(nobody.col('usernames')), 'search without signing in');
  await no(F.getDoc(nobody.doc('usernames', alice.name)), 'lookup without signing in');
  await ok(F.deleteDoc(mallory.doc('usernames', mallory.name)));
});

test('accounts and saved items: only the owner reads or writes, and only well-formed items', { skip: emu.skip }, async () => {
  const a = await person('acct' + Date.now().toString(36).slice(-5)), b = await person('other' + Date.now().toString(36).slice(-5));
  await no(F.setDoc(a.doc('accounts', b.uid), { username: a.name, epoch: 'e', createdAt: now() }), 'an account for someone else');
  await no(F.setDoc(a.doc('accounts', a.uid), { username: 'someone_else', epoch: 'e', createdAt: now() }), 'a different name than the sign-in');
  await no(F.setDoc(a.doc('accounts', a.uid), { username: a.name, epoch: 'e', createdAt: now(), admin: true }), 'extra fields');
  await ok(F.setDoc(a.doc('accounts', a.uid), { username: a.name, epoch: 'e', createdAt: now() }));
  await no(F.updateDoc(a.doc('accounts', a.uid), { epoch: 'changed' }), 'changing the account id');
  assert.equal((await F.getDoc(a.doc('accounts', a.uid))).data().epoch, 'e');
  await no(F.getDoc(b.doc('accounts', a.uid)), 'reading someone else\'s account');
  await ok(F.setDoc(a.doc('accounts', a.uid, 'records', 'rAAA'), { t: 5, del: false, n: 2, iv: 'abcd', at: now() }));
  await ok(F.setDoc(a.doc('accounts', a.uid, 'chunks', 'cAAA.5.0'), { d: 'x'.repeat(700000) }));
  await no(F.setDoc(a.doc('accounts', a.uid, 'chunks', 'cAAA.5.1'), { d: 'x'.repeat(900000) }), 'a piece that is too big');
  await no(F.setDoc(a.doc('accounts', a.uid, 'records', 'rBAD'), { t: 'no', del: false, n: 1, iv: '', at: now() }), 'a bad time');
  await no(F.setDoc(a.doc('accounts', a.uid, 'records', 'rBAD'), { t: 1, del: false, n: 1000, iv: '', at: now() }), 'too many pieces');
  await no(F.setDoc(a.doc('accounts', a.uid, 'records', 'rBAD'), { t: 1, del: false, n: 1, iv: '', at: new Date() }), 'a made-up time');
  await no(F.getDocs(b.col('accounts', a.uid, 'records')), 'reading someone else\'s items'); await no(F.setDoc(b.doc('accounts', a.uid, 'records', 'rEVIL'), { t: 1, del: false, n: 0, iv: '', at: now() }), 'writing into someone else\'s items'); await no(F.deleteDoc(b.doc('accounts', a.uid, 'chunks', 'cAAA.5.0')), 'deleting someone else\'s pieces');
  const mine = await F.getDocs(F.query(a.col('accounts', a.uid, 'records'), F.where('at', '>=', new Date(0)), F.orderBy('at'))); assert.equal(mine.size, 1);
});

/* two people who find each other; names are claimed first, like a real sign-up */
async function pair() {
  const tag = Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 99);
  const a = await person('ann' + tag), b = await person('ben' + tag), c = await person('cat' + tag);
  for (const p of [a, b, c]) await F.setDoc(p.doc('usernames', p.name), { uid: p.uid, createdAt: now() });
  return { a, b, c, cid: a.uid < b.uid ? a.uid + '_' + b.uid : b.uid + '_' + a.uid };
}
const convData = (me, other, over) => Object.assign({ members: [me.uid, other.uid].sort(), usernames: { [me.uid]: me.name, [other.uid]: other.name }, status: 'pending', requester: me.uid, createdAt: now(), lastMessage: 'hi', lastMessageAt: now(), lastFrom: me.uid }, over || {});

test('messages: a request, its one message, accept, the chat, and nobody else can see or change anything', { skip: emu.skip }, async () => {
  const { a, b, c, cid } = await pair();
  const conv = (p) => p.doc('conversations', cid), msg = (p, id) => p.doc('conversations', cid, 'messages', id);
  // making the request
  await no(F.setDoc(conv(a), convData(a, b, { status: 'accepted' })), 'a conversation that starts accepted');
  await no(F.setDoc(conv(a), convData(a, b, { requester: b.uid })), 'a request in someone else\'s name');
  await no(F.setDoc(conv(a), convData(a, b, { usernames: { [a.uid]: 'not_me', [b.uid]: b.name } })), 'a name that is not yours');
  await no(F.setDoc(conv(a), convData(a, b, { usernames: { [a.uid]: a.name, [b.uid]: 'liar' } })), 'a made-up name for the other person');
  await no(F.setDoc(conv(c), convData(c, b)), 'a conversation under the wrong id');
  await no(F.setDoc(F.doc(c.db, 'conversations', a.uid + '_' + b.uid), convData(a, b)), 'a conversation between two other people');
  const batch = F.writeBatch(a.db); batch.set(conv(a), convData(a, b)); batch.set(msg(a, 'request'), { from: a.uid, text: 'hey, it is Ann', t: Date.now(), at: now() }); await ok(batch.commit());
  // the others cannot look
  await no(F.getDoc(conv(c)), 'a stranger reading the conversation'); await no(F.getDoc(msg(c, 'request')), 'a stranger reading the message'); await no(F.getDocs(F.collection(c.db, 'conversations', cid, 'messages')), 'a stranger reading the history');
  const listC = await F.getDocs(F.query(c.col('conversations'), F.where('members', 'array-contains', c.uid))); assert.equal(listC.size, 0);
  await no(F.getDocs(F.query(c.col('conversations'), F.where('members', 'array-contains', a.uid))), 'a stranger listing someone else\'s conversations');
  // before it is accepted
  const b1 = F.writeBatch(a.db); b1.set(msg(a, 'second'), { from: a.uid, text: 'are you there', t: Date.now(), at: now() }); b1.update(conv(a), { lastMessage: 'are you there', lastMessageAt: now(), lastFrom: a.uid }); await no(b1.commit(), 'a second message before the request is accepted');
  await no(F.updateDoc(conv(a), { status: 'accepted', decidedAt: now() }), 'accepting your own request');
  await no(F.updateDoc(conv(c), { status: 'accepted' }), 'a stranger accepting');
  await no(F.updateDoc(conv(b), { requester: b.uid }), 'changing who asked'); await no(F.updateDoc(conv(b), { status: 'accepted', members: [b.uid] }), 'changing more than the answer'); await no(F.updateDoc(conv(b), { status: 'pwned' }), 'a made-up status');
  assert.equal((await F.getDocs(F.collection(b.db, 'conversations', cid, 'messages'))).size, 1, 'the person asked can read the request');
  // b answers
  await ok(F.updateDoc(conv(b), { status: 'accepted', decidedAt: now() }));
  // the chat
  const b2 = F.writeBatch(a.db); b2.set(msg(a, 'm1'), { from: a.uid, text: 'now we can talk', t: Date.now(), at: now() }); b2.update(conv(a), { lastMessage: 'now we can talk', lastMessageAt: now(), lastFrom: a.uid }); await ok(b2.commit());
  const b3 = F.writeBatch(b.db); b3.set(msg(b, 'm2'), { from: b.uid, text: 'yes!', t: Date.now(), at: now() }); b3.update(conv(b), { lastMessage: 'yes!', lastMessageAt: now(), lastFrom: b.uid }); await ok(b3.commit());
  await no(F.setDoc(msg(a, 'm3'), { from: b.uid, text: 'forged', t: Date.now(), at: now() }), 'a message in someone else\'s name');
  await no(F.setDoc(msg(c, 'm4'), { from: c.uid, text: 'stranger', t: Date.now(), at: now() }), 'a stranger writing in the chat');
  await no(F.setDoc(msg(a, 'm5'), { from: a.uid, text: 'x'.repeat(2001), t: Date.now(), at: now() }), 'too long'); await no(F.setDoc(msg(a, 'm6'), { from: a.uid, text: '', t: Date.now(), at: now() }), 'empty');
  await no(F.setDoc(msg(a, 'm7'), { from: a.uid, text: 'back-dated', t: Date.now(), at: new Date(1000) }), 'a made-up time');
  await no(F.updateDoc(msg(a, 'm1'), { text: 'edited' }), 'editing history'); await no(F.deleteDoc(msg(a, 'm1')), 'deleting history'); await no(F.deleteDoc(conv(a)), 'deleting the conversation');
  const hist = await F.getDocs(F.query(F.collection(a.db, 'conversations', cid, 'messages'), F.orderBy('at'))); assert.deepEqual(hist.docs.map((d) => d.data().text), ['hey, it is Ann', 'now we can talk', 'yes!']);
  const mineList = await F.getDocs(F.query(a.col('conversations'), F.where('members', 'array-contains', a.uid))); assert.equal(mineList.size, 1); assert.equal(mineList.docs[0].data().lastMessage, 'yes!');
  // declining later stops new messages
  await ok(F.updateDoc(conv(b), { status: 'declined', decidedAt: now() }));
  const b4 = F.writeBatch(a.db); b4.set(msg(a, 'm8'), { from: a.uid, text: 'still there?', t: Date.now(), at: now() }); b4.update(conv(a), { lastMessage: 'x', lastMessageAt: now(), lastFrom: a.uid }); await no(b4.commit(), 'writing after being declined');
});

/* the system account (PatOS): its uid is in config/system, which only the Firebase console can write (here: the emulator's
   owner access, like the console). It can message anyone without a request, can't be declined, bans and unbans. */
async function setSystemKey(uid) { const r = await fetch('http://127.0.0.1:' + emu.ports.firestore + '/v1/projects/demo-patos/databases/(default)/documents/config/system', { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { [uid]: { stringValue: '' } } }) }); assert.ok(r.ok); }
async function setSystem(uid) {
  const r = await fetch('http://127.0.0.1:' + emu.ports.firestore + '/v1/projects/demo-patos/databases/(default)/documents/config/system', { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { uid: { stringValue: uid } } }) });
  assert.ok(r.ok, 'the console can write config/system: ' + r.status);
}
test('the system account: nobody can make themselves it; no request needed; can\'t be declined; bans and unbans', { skip: emu.skip }, async () => {
  const tag = Date.now().toString(36).slice(-5);
  const god = await person('patos' + tag), b = await person('bea' + tag), c = await person('cal' + tag);
  for (const p of [god, b, c]) await F.setDoc(p.doc('usernames', p.name), { uid: p.uid, createdAt: now() });
  // nobody can write config/system, not even the account itself
  await no(F.setDoc(god.doc('config', 'system'), { uid: god.uid }), 'making yourself the system account');
  await no(F.setDoc(c.doc('config', 'system'), { uid: c.uid }), 'a stranger making themselves the system account');
  await setSystem(god.uid);
  await no(F.updateDoc(c.doc('config', 'system'), { uid: c.uid }), 'taking it over'); await no(F.deleteDoc(c.doc('config', 'system')), 'deleting it');
  assert.equal((await F.getDoc(c.doc('config', 'system'))).data().uid, god.uid, 'everyone signed in can see who it is (for the badge)');
  // its first message opens the chat at once; others still can't start accepted
  const cid = (x, y) => (x.uid < y.uid ? x.uid + '_' + y.uid : y.uid + '_' + x.uid);
  const conv = (p, x, y) => p.doc('conversations', cid(x, y));
  await no(F.setDoc(conv(c, c, b), convData(c, b, { status: 'accepted' })), 'a normal account starting accepted');
  const bt = F.writeBatch(god.db); bt.set(conv(god, god, b), convData(god, b, { status: 'accepted' })); bt.set(god.doc('conversations', cid(god, b), 'messages', 'request'), { from: god.uid, text: 'Hi from PatOS', t: Date.now(), at: now() }); await ok(bt.commit());
  const b2 = F.writeBatch(god.db); b2.set(god.doc('conversations', cid(god, b), 'messages', 'm2'), { from: god.uid, text: 'second', t: Date.now(), at: now() }); b2.update(conv(god, god, b), { lastMessage: 'second', lastMessageAt: now(), lastFrom: god.uid }); await ok(b2.commit());
  await no(F.updateDoc(conv(b, god, b), { status: 'declined', decidedAt: now() }), 'declining the system account');
  // someone asks it: it can accept; and it can reopen a conversation it is in
  await ok(F.setDoc(conv(c, c, god), convData(c, god)));
  await ok(F.updateDoc(conv(god, c, god), { status: 'accepted', decidedAt: now() }));
  // bans: only the system account, never itself, with a reason; the banned person reads their own ban and can't write
  const ban = (p, who, over) => F.setDoc(p.doc('bans', who.uid), Object.assign({ reason: 'spam', username: who.name, at: now(), by: p.uid }, over || {}));
  await no(ban(c, b), 'a normal account banning'); await no(ban(god, god), 'banning itself'); await no(ban(god, b, { by: c.uid }), 'a ban in someone else\'s name'); await no(ban(god, b, { extra: 1 }), 'extra fields');
  await ok(ban(god, c));
  assert.equal((await F.getDoc(c.doc('bans', c.uid))).data().reason, 'spam', 'the banned person sees why');
  await no(F.getDoc(b.doc('bans', c.uid)), 'someone else reading a ban'); await no(F.getDocs(b.col('bans')), 'listing bans');
  assert.equal((await F.getDocs(god.col('bans'))).size >= 1, true);
  const cb = F.writeBatch(c.db); cb.set(c.doc('conversations', cid(c, god), 'messages', 'x1'), { from: c.uid, text: 'banned talking', t: Date.now(), at: now() }); cb.update(conv(c, c, god), { lastMessage: 'x', lastMessageAt: now(), lastFrom: c.uid }); await no(cb.commit(), 'a banned account sending');
  await no(F.setDoc(c.doc('accounts', c.uid, 'records', 'r1'), { t: 1, del: false, n: 0, iv: '', at: now() }), 'a banned account saving');
  await no(F.deleteDoc(c.doc('bans', c.uid)), 'unbanning yourself');
  await ok(F.deleteDoc(god.doc('bans', c.uid)));
  const cb2 = F.writeBatch(c.db); cb2.set(c.doc('conversations', cid(c, god), 'messages', 'x2'), { from: c.uid, text: 'back', t: Date.now(), at: now() }); cb2.update(conv(c, c, god), { lastMessage: 'back', lastMessageAt: now(), lastFrom: c.uid }); await ok(cb2.commit());
});
test('config/system with the id as the field name: the same powers, and still nobody else', { skip: emu.skip }, async () => {
  const tag = Date.now().toString(36).slice(-5);
  const god = await person('patos' + tag), b = await person('bob' + tag), c = await person('cy' + tag);
  for (const p of [god, b, c]) await F.setDoc(p.doc('usernames', p.name), { uid: p.uid, createdAt: now() });
  await setSystemKey(god.uid);
  await ok(F.setDoc(god.doc('bans', b.uid), { reason: 'x', username: b.name, at: now(), by: god.uid }));
  await no(F.setDoc(c.doc('bans', god.uid), { reason: 'x', username: god.name, at: now(), by: c.uid }), 'someone else banning');
  await no(F.setDoc(c.doc('config', 'system'), { [c.uid]: '' }), 'writing config/system');
  await ok(F.deleteDoc(god.doc('bans', b.uid)));
});
test('announcements and verified badges: only PatOS writes them, everyone signed in reads them', { skip: emu.skip }, async () => {
  const tag = Date.now().toString(36).slice(-5);
  const god = await person('patos' + tag), b = await person('bix' + tag);
  await setSystem(god.uid);
  await no(F.setDoc(b.doc('announcements', 'current'), { text: 'fake', at: now(), by: b.uid }), 'a normal account announcing');
  await ok(F.setDoc(god.doc('announcements', 'current'), { text: 'Hello everyone', at: now(), by: god.uid }));
  assert.equal((await F.getDoc(b.doc('announcements', 'current'))).data().text, 'Hello everyone');
  await no(F.deleteDoc(b.doc('announcements', 'current')), 'removing it');
  await no(F.setDoc(b.doc('verified', b.uid), { at: now(), by: b.uid }), 'verifying yourself');
  await ok(F.setDoc(god.doc('verified', b.uid), { at: now(), by: god.uid }));
  assert.ok((await F.getDocs(b.col('verified'))).docs.some((d) => d.id === b.uid));
  await no(F.deleteDoc(b.doc('verified', b.uid)), 'removing a badge');
  await ok(F.deleteDoc(god.doc('verified', b.uid))); await ok(F.deleteDoc(god.doc('announcements', 'current')));
});

test('Messages 3.2: photos, reactions (only your own), seen and typing (only your own time)', { skip: emu.skip }, async () => {
  const { a, b, c, cid } = await pair();
  const conv = (p) => p.doc('conversations', cid), msg = (p, id) => p.doc('conversations', cid, 'messages', id);
  const bt = F.writeBatch(a.db); bt.set(conv(a), convData(a, b)); bt.set(msg(a, 'request'), { from: a.uid, text: 'hi', t: Date.now(), at: now() }); await ok(bt.commit());
  await no(F.updateDoc(msg(b, 'request'), { ['reactions.' + b.uid]: '❤️' }), 'reacting before the chat is accepted');
  await no(F.updateDoc(conv(b), { ['seen.' + b.uid]: now() }), 'seen before accepting');
  await ok(F.updateDoc(conv(b), { status: 'accepted', decidedAt: now() }));
  // a photo
  const img = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
  const p1 = F.writeBatch(a.db); p1.set(msg(a, 'p1'), { from: a.uid, text: '', img, t: Date.now(), at: now() }); p1.update(conv(a), { lastMessage: '📷 Photo', lastMessageAt: now(), lastFrom: a.uid }); await ok(p1.commit());
  const p2 = F.writeBatch(a.db); p2.set(msg(a, 'p2'), { from: a.uid, text: '', img: 'x'.repeat(400001), t: Date.now(), at: now() }); p2.update(conv(a), { lastMessage: 'x', lastMessageAt: now(), lastFrom: a.uid }); await no(p2.commit(), 'a photo that is too big');
  const p3 = F.writeBatch(a.db); p3.set(msg(a, 'p3'), { from: a.uid, text: '', t: Date.now(), at: now() }); p3.update(conv(a), { lastMessage: 'x', lastMessageAt: now(), lastFrom: a.uid }); await no(p3.commit(), 'no words and no photo');
  // reactions
  await ok(F.updateDoc(msg(b, 'p1'), { ['reactions.' + b.uid]: '❤️' }));
  await ok(F.updateDoc(msg(a, 'p1'), { ['reactions.' + a.uid]: '😂' }));
  await no(F.updateDoc(msg(b, 'p1'), { ['reactions.' + a.uid]: '👎' }), 'changing someone else\'s reaction');
  await no(F.updateDoc(msg(b, 'p1'), { text: 'edited', ['reactions.' + b.uid]: '👍' }), 'editing the message with a reaction');
  await no(F.updateDoc(msg(c, 'p1'), { ['reactions.' + c.uid]: '❤️' }), 'a stranger reacting');
  await ok(F.updateDoc(msg(b, 'p1'), { ['reactions.' + b.uid]: F.deleteField() }));
  const r = (await F.getDoc(msg(a, 'p1'))).data().reactions; assert.deepEqual(r, { [a.uid]: '😂' });
  // seen and typing
  await ok(F.updateDoc(conv(b), { ['seen.' + b.uid]: now() }));
  await ok(F.updateDoc(conv(a), { ['typing.' + a.uid]: now() }));
  await no(F.updateDoc(conv(b), { ['seen.' + a.uid]: now() }), 'marking it seen for someone else');
  await no(F.updateDoc(conv(b), { ['seen.' + b.uid]: new Date(0) }), 'a made-up time');
  await no(F.updateDoc(conv(c), { ['typing.' + c.uid]: now() }), 'a stranger typing');
});
