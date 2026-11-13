/* PatOS cloud layer: the ONLY file that talks to Firebase. It is bundled (npm run build:firebase) into vendor/firebase.js,
   which PatOS loads only when someone has, or makes, an account, so PatOS opens and works fully without it and offline.

   What is in the database (see docs/FIREBASE.md and firestore.rules):
     usernames/{name}                       { uid, createdAt }           who is who (search, and one name per person)
     accounts/{uid}                         { username, epoch, createdAt }     the account, private
     accounts/{uid}/records/{r<rid>}        { t, del, n, iv, at }        one saved item: a file, a list, the settings (encrypted)
     accounts/{uid}/chunks/{c<rid>.<t>.<i>} { d }                        the scrambled content of an item, in pieces under 1 MB
     conversations/{uid1_uid2}              { members, usernames, status, requester, lastMessage, lastMessageAt, lastFrom }
     conversations/{id}/messages/{id}       { from, text, t, at }        the history, never changed afterwards
     config/system                          { uid }                      the system account (PatOS); written only in the Firebase console
     bans/{uid}                             { reason, username, at, by } banned accounts; written only by the system account
     spaces/{sid}                           { name, owner, members: { uid: role }, memberIds, names, created, updated }   Shared Spaces
     spaces/{sid}/files/{fid}               { name, kind, content, rev, updatedBy, updatedAt, lockedBy, lockUntil }
     spaces/{sid}/files/{fid}/revs/{rev}    { content, by, at }          each saved revision (never changed afterwards)
     spaces/{sid}/comments/{cid}            { fid, text, by, byName, at }
     spaces/{sid}/activity/{aid}            { what, name, by, byName, at }
     spaces/{sid}/presence/{uid}           { name, app, state, at }      Live: who is here (only your own)
     spaces/{sid}/boards/{bid}/items/{iid} { kind, x, y, w, h, text, color, rev, by, at }   Live boards
     spaces/{sid}/notes/{nid}/blocks/{b}   { order, text, rev, by, at }  Live notes, one paragraph each
     spaces/{sid}/tasks/{tid}              { text, done, assignee, rev, by, at }
     spaces/{sid}/calls/{cid}/peers|signals  voice: who is in the call; WebRTC messages readable only by the two ends
     spaceInvites/{sid_uid}                 { sid, uid, role, spaceName, by, byName, at }   an invitation, until it is answered
   Roles (firestore.rules checks every one): owner > admin > editor > commenter > viewer.

   Accounts are username and password only. Firebase Authentication needs an email-shaped name, so the username is turned
   into one that can never receive mail (name@patos.invalid). Nobody types it, and no mail is ever sent. The password is
   only ever given to Firebase Authentication, which keeps a salted hash, never the password itself. */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, limit, documentId, serverTimestamp, writeBatch, onSnapshot, runTransaction, deleteField } from 'firebase/firestore';

const config = {
  apiKey: 'AIzaSyCBQGN0bxf1aHI0QMkiIm_x-K99Lg5VJGM',
  authDomain: 'patos-92a43.firebaseapp.com',
  projectId: 'patos-92a43',
  storageBucket: 'patos-92a43.firebasestorage.app',
  messagingSenderId: '889703903796',
  appId: '1:889703903796:web:f934b0267182d18d2c9061'
};
const USERNAME = /^[a-z0-9_]{3,20}$/;
const CHUNK = 700000; // characters per piece (a document may hold 1 MiB)
const fail = (code, message) => Object.assign(new Error(message || code), { code });

let app = null, auth = null, db = null;
function init() {
  if (app) return;
  const emu = typeof window !== 'undefined' ? window.__PATOS_FIREBASE_EMULATOR : null; // tests talk to a local emulator, never to the real project
  app = initializeApp(emu ? Object.assign({}, config, { projectId: emu.projectId || 'demo-patos', apiKey: 'demo-key' }) : config);
  auth = getAuth(app);
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true });
  if (emu) { connectAuthEmulator(auth, emu.auth, { disableWarnings: true }); connectFirestoreEmulator(db, emu.firestoreHost || '127.0.0.1', emu.firestorePort); }
}
const emailOf = (u) => u + '@patos.invalid';
const nameOf = (user) => (user && user.email ? user.email.replace(/@patos\.invalid$/, '') : '');
/* Firebase's error codes, in words PatOS can show */
function friendly(e) {
  const c = (e && e.code) || '';
  if (/email-already-in-use/.test(c)) return fail('taken', 'That username is taken.');
  if (/weak-password/.test(c)) return fail('weak', 'Choose a longer password.');
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return fail('wrong', 'Wrong username or password.');
  if (/too-many-requests/.test(c)) return fail('busy', 'Too many tries. Wait a few minutes.');
  if (/network|unavailable|deadline|timeout/.test(c) || /network/i.test((e && e.message) || '')) return fail('offline', 'No internet right now.' + (c ? ' (' + c + ')' : ''));
  if (/operation-not-allowed|configuration-not-found/.test(c)) return fail('setup', 'Accounts are not switched on yet. In the Firebase console, open Authentication and turn on Email/Password.');
  if (/permission-denied|insufficient/.test(c)) return fail('rules', 'The database rules do not allow this yet. Paste the rules from firestore.rules into the Firebase console.');
  return e;
}
const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw friendly(e); } };

/* every document of a collection, as a list, live (path: ['spaces', sid, 'presence']) */
function listenAll(path, cb, onError) { init(); return onSnapshot(collection(db, ...path), (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' })))), (e) => { if (onError) onError(e); }); }
const api = {
  available: true,
  USERNAME,
  validUsername: (u) => USERNAME.test(String(u || '')),
  init,

  /* ---------- who you are ---------- */
  signUp: wrap(async (username, password) => {
    init(); username = String(username || '').trim().toLowerCase();
    if (!USERNAME.test(username)) throw fail('invalid', 'A username has 3 to 20 letters, numbers or underscores.');
    let cred;
    try { cred = await createUserWithEmailAndPassword(auth, emailOf(username), password); } // fails if the name is taken: that is how names stay unique
    catch (e) { if (/invalid-email/.test((e && e.code) || '')) throw fail('setup', 'Firebase did not accept the internal sign-in name. See docs/FIREBASE.md.'); throw e; }
    const uid = cred.user.uid;
    try { await api.claim(uid, username); }
    catch (e) { try { await deleteUser(cred.user); } catch (x) {} throw e; }
    return { uid, username };
  }),
  signIn: wrap(async (username, password) => {
    init(); username = String(username || '').trim().toLowerCase();
    const cred = await signInWithEmailAndPassword(auth, emailOf(username), password);
    await api.claim(cred.user.uid, username).catch(() => {}); // makes the name lookup again if it was never written
    return { uid: cred.user.uid, username };
  }),
  signOut: wrap(async () => { init(); api._sys = null; await fbSignOut(auth); }),
  /* the person who was signed in last time (the browser remembers, even offline); null if nobody */
  restore() {
    init();
    return new Promise((res) => { const off = onAuthStateChanged(auth, (u) => { off(); res(u ? { uid: u.uid, username: nameOf(u) } : null); }); });
  },
  user() { init(); const u = auth.currentUser; return u ? { uid: u.uid, username: nameOf(u) } : null; },
  onAuth(cb) { init(); return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, username: nameOf(u) } : null)); },
  /* the username belongs to this uid: one document for searching, one for the account */
  claim: wrap(async (uid, username) => {
    init();
    const acct = doc(db, 'accounts', uid), snap = await getDoc(acct);
    if (!snap.exists()) await setDoc(acct, { username, epoch: Math.random().toString(36).slice(2, 12) + Date.now().toString(36), createdAt: serverTimestamp() });
    const un = doc(db, 'usernames', username);
    if (!(await getDoc(un)).exists()) await setDoc(un, { uid, createdAt: serverTimestamp() });
  }),
  changePassword: wrap(async (username, oldPassword, newPassword) => {
    init(); const u = auth.currentUser; if (!u) throw fail('wrong', 'Sign in first.');
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(emailOf(username), oldPassword)); await updatePassword(u, newPassword);
  }),
  /* removes the saved data, the name and the sign-in (messages other people hold stay in their history) */
  deleteAccount: wrap(async (username, password) => {
    init(); const u = auth.currentUser; if (!u) throw fail('wrong', 'Sign in first.');
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(emailOf(username), password));
    await api.syncWipe(u.uid);
    await deleteDoc(doc(db, 'usernames', username)).catch(() => {}); await deleteDoc(doc(db, 'accounts', u.uid)).catch(() => {});
    await deleteUser(u);
  }),
  lookup: wrap(async (username) => { init(); const s = await getDoc(doc(db, 'usernames', String(username || '').toLowerCase())); return s.exists() ? { username: s.id, uid: s.data().uid } : null; }),
  /* people whose username starts with these letters */
  search: wrap(async (prefix, n) => {
    init(); prefix = String(prefix || '').toLowerCase().replace(/[^a-z0-9_]/g, ''); if (!prefix) return [];
    const s = await getDocs(query(collection(db, 'usernames'), where(documentId(), '>=', prefix), where(documentId(), '<', prefix + ''), limit(n || 10)));
    return s.docs.map((d) => ({ username: d.id, uid: d.data().uid }));
  }),

  /* ---------- the saved items of an account (what Sync moves) ---------- */
  syncMeta: wrap(async (uid) => { init(); const s = await getDoc(doc(db, 'accounts', uid)); return s.exists() ? { epoch: s.data().epoch, exists: true } : { epoch: '', exists: false }; }),
  /* headers changed since a time (ms), oldest first, with their content */
  syncRead: wrap(async (uid, sinceMs, n) => {
    init(); const base = collection(db, 'accounts', uid, 'records');
    const s = await getDocs(query(base, where('at', '>=', new Date(sinceMs)), orderBy('at'), limit(n || 100)));
    const heads = s.docs.map((d) => { const x = d.data(); return { rid: d.id.slice(1), t: x.t, del: !!x.del, n: x.n || 0, iv: x.iv || '', at: x.at ? x.at.toMillis() : sinceMs }; });
    const wanted = []; heads.forEach((h) => { if (!h.del) for (let i = 0; i < h.n; i++) wanted.push('c' + h.rid + '.' + h.t + '.' + i); });
    const got = {};
    for (let i = 0; i < wanted.length; i += 30) {
      const part = wanted.slice(i, i + 30);
      (await getDocs(query(collection(db, 'accounts', uid, 'chunks'), where(documentId(), 'in', part)))).docs.forEach((d) => { got[d.id] = d.data().d; });
    }
    const records = [];
    for (const h of heads) {
      if (h.del) { records.push({ rid: h.rid, t: h.t, deleted: true }); continue; }
      let data = ''; let ok = true; for (let i = 0; i < h.n; i++) { const c = got['c' + h.rid + '.' + h.t + '.' + i]; if (c == null) { ok = false; break; } data += c; }
      if (ok) records.push({ rid: h.rid, t: h.t, iv: h.iv, data });
    }
    return { records, last: heads.length ? heads[heads.length - 1].at : sinceMs, count: heads.length, more: heads.length >= (n || 100) };
  }),
  /* writes items; an item is only taken when it is newer than the one saved (the newest change wins) */
  syncWrite: wrap(async (uid, items) => {
    init(); let applied = 0, skipped = 0;
    for (const it of items) {
      const ref = doc(db, 'accounts', uid, 'records', 'r' + it.rid); const chunks = [];
      if (!it.deleted) for (let i = 0; i * CHUNK < it.data.length; i++) chunks.push(it.data.slice(i * CHUNK, (i + 1) * CHUNK));
      const cur = await getDoc(ref);
      if (cur.exists() && cur.data().t > it.t) { skipped++; continue; }
      for (let i = 0; i < chunks.length; i += 8) { // pieces first, under their own names, so a half-written item is never seen
        const b = writeBatch(db); chunks.slice(i, i + 8).forEach((c, j) => b.set(doc(db, 'accounts', uid, 'chunks', 'c' + it.rid + '.' + it.t + '.' + (i + j)), { d: c })); await b.commit();
      }
      const old = await runTransaction(db, async (tx) => {
        const s = await tx.get(ref); if (s.exists() && s.data().t > it.t) return { lost: true };
        tx.set(ref, { t: it.t, del: !!it.deleted, n: chunks.length, iv: it.iv || '', at: serverTimestamp() });
        return s.exists() ? { t: s.data().t, n: s.data().n || 0 } : null;
      });
      if (old && old.lost) { skipped++; for (let i = 0; i < chunks.length; i++) deleteDoc(doc(db, 'accounts', uid, 'chunks', 'c' + it.rid + '.' + it.t + '.' + i)).catch(() => {}); continue; }
      applied++;
      if (old && old.t !== it.t) for (let i = 0; i < old.n; i++) deleteDoc(doc(db, 'accounts', uid, 'chunks', 'c' + it.rid + '.' + old.t + '.' + i)).catch(() => {}); // the old version's pieces
    }
    return { applied, skipped };
  }),
  syncWipe: wrap(async (uid) => {
    init();
    for (const name of ['records', 'chunks']) for (;;) {
      const s = await getDocs(query(collection(db, 'accounts', uid, name), limit(400))); if (s.empty) break;
      const b = writeBatch(db); s.docs.forEach((d) => b.delete(d.ref)); await b.commit();
    }
  }),

  /* ---------- the system account (PatOS) and bans ---------- */
  /* the uid of the system account, or '' when config/system was not set yet (asked once per sign-in) */
  systemUid: wrap(async () => {
    init(); if (api._sys) return api._sys;
    try { const s = await getDoc(doc(db, 'config', 'system')); return (api._sys = s.exists() ? api.sysOf(s.data()) : ''); } catch (e) { return ''; }
  }),
  /* config/system: { uid: <id> }, or the id as the name of its only field (the same reading as firestore.rules) */
  sysOf: (d) => { if (!d) return ''; if ('uid' in d) return String(d.uid || ''); const k = Object.keys(d); return k.length === 1 ? k[0] : ''; },
  _sys: null,
  /* every account (the system account sees them all) */
  allUsers: wrap(async () => { init(); const s = await getDocs(collection(db, 'usernames')); return s.docs.map((d) => ({ username: d.id, uid: d.data().uid })); }),
  /* your own ban, live: cb(null) or cb({ reason, at, by }) */
  listenBan(uid, cb) {
    init();
    return onSnapshot(doc(db, 'bans', uid), (s) => cb(s.exists() ? Object.assign({}, s.data({ serverTimestamps: 'estimate' })) : null), () => {});
  },
  bans: wrap(async () => { init(); const s = await getDocs(collection(db, 'bans')); return s.docs.map((d) => Object.assign({ uid: d.id }, d.data({ serverTimestamps: 'estimate' }))); }),
  ban: wrap(async (me, uid, username, reason) => { init(); await setDoc(doc(db, 'bans', uid), { reason: String(reason || '').slice(0, 500), username: String(username || '').slice(0, 40), at: serverTimestamp(), by: me.uid }); }),
  unban: wrap(async (uid) => { init(); await deleteDoc(doc(db, 'bans', uid)); }),
  /* announcements from PatOS, and verified badges */
  listenAnnouncement(cb) { init(); return onSnapshot(doc(db, 'announcements', 'current'), (s) => cb(s.exists() ? Object.assign({}, s.data({ serverTimestamps: 'estimate' })) : null), () => {}); },
  announce: wrap(async (me, text) => { init(); await setDoc(doc(db, 'announcements', 'current'), { text: String(text).slice(0, 500), at: serverTimestamp(), by: me.uid }); }),
  clearAnnouncement: wrap(async () => { init(); await deleteDoc(doc(db, 'announcements', 'current')); }),
  verifiedList: wrap(async () => { init(); const s = await getDocs(collection(db, 'verified')); return s.docs.map((d) => d.id); }),
  verify: wrap(async (me, uid, on) => { init(); if (on) await setDoc(doc(db, 'verified', uid), { at: serverTimestamp(), by: me.uid }); else await deleteDoc(doc(db, 'verified', uid)); }),
  /* a sign-in token for PatOS's own server (releasing a version); fresh: after asking the password again */
  idToken: wrap(async (username, password) => {
    init(); const u = auth.currentUser; if (!u) throw fail('wrong', 'Sign in first.');
    if (password != null) await reauthenticateWithCredential(u, EmailAuthProvider.credential(emailOf(username), password));
    return u.getIdToken(true);
  }),

  /* ---------- messages ---------- */
  convId: (a, b) => (a < b ? a + '_' + b : b + '_' + a),
  /* all of someone's conversations, live; call the returned function to stop */
  listenConversations(uid, cb, onError) {
    init();
    return onSnapshot(query(collection(db, 'conversations'), where('members', 'array-contains', uid)), (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' })))), (e) => { if (onError) onError(friendly(e)); });
  },
  /* the newest messages of a conversation, live, oldest first */
  listenMessages(cid, cb, onError, n) {
    init();
    return onSnapshot(query(collection(db, 'conversations', cid, 'messages'), orderBy('at', 'desc'), limit(n || 100)), (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' }))).reverse()), (e) => { if (onError) onError(friendly(e)); });
  },
  /* the first message to someone: a request they can accept or decline */
  requestChat: wrap(async (me, other, text, id, accepted) => {
    init(); const cid = api.convId(me.uid, other.uid); const members = [me.uid, other.uid].sort(); const ref = doc(db, 'conversations', cid);
    const cur = await getDoc(ref).catch(() => null); if (cur && cur.exists()) return { cid, existed: true, status: cur.data().status };
    const b = writeBatch(db); const now = serverTimestamp();
    b.set(ref, { members, usernames: { [me.uid]: me.username, [other.uid]: other.username }, status: accepted ? 'accepted' : 'pending', requester: me.uid, createdAt: now, lastMessage: String(text).slice(0, 140), lastMessageAt: now, lastFrom: me.uid });
    b.set(doc(db, 'conversations', cid, 'messages', 'request'), { from: me.uid, text: String(text).slice(0, 2000), t: Date.now(), at: now });
    await b.commit(); return { cid, existed: false, status: 'pending' };
  }),
  /* a message: text, and maybe a photo (a small JPEG as a data address, under 400 KB) */
  sendMessage: wrap(async (cid, me, text, id, img) => {
    init(); const b = writeBatch(db); const now = serverTimestamp(); text = String(text || '').slice(0, 2000);
    const m = { from: me.uid, text, t: Date.now(), at: now }; if (img) m.img = String(img);
    b.set(doc(db, 'conversations', cid, 'messages', id), m);
    b.update(doc(db, 'conversations', cid), { lastMessage: (img ? '📷 ' : '') + (text || (img ? 'Photo' : '')).slice(0, 130), lastMessageAt: now, lastFrom: me.uid });
    await b.commit();
  }),
  /* your reaction to a message (one per person; null removes it) */
  react: wrap(async (cid, mid, uid, emoji) => { init(); await updateDoc(doc(db, 'conversations', cid, 'messages', mid), { ['reactions.' + uid]: emoji ? String(emoji).slice(0, 16) : deleteField() }); }),
  /* "seen" and "typing…": a time per person in the conversation */
  markSeen: wrap(async (cid, uid) => { init(); await updateDoc(doc(db, 'conversations', cid), { ['seen.' + uid]: serverTimestamp() }); }),
  typing: wrap(async (cid, uid) => { init(); await updateDoc(doc(db, 'conversations', cid), { ['typing.' + uid]: serverTimestamp() }); }),
  messageExists: wrap(async (cid, id) => { init(); return (await getDoc(doc(db, 'conversations', cid, 'messages', id))).exists(); }),
  /* the system account opens a conversation that was waiting or declined */
  open: wrap(async (cid) => { init(); await updateDoc(doc(db, 'conversations', cid), { status: 'accepted', decidedAt: serverTimestamp() }); }),
  respond: wrap(async (cid, accept) => { init(); await updateDoc(doc(db, 'conversations', cid), { status: accept ? 'accepted' : 'declined', decidedAt: serverTimestamp() }); }),
  /* ================= Shared Spaces ================= */
  spacesListen(uid, cb, onError) { init(); return onSnapshot(query(collection(db, 'spaces'), where('memberIds', 'array-contains', uid)), (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' })))), (e) => { if (onError) onError(friendly(e)); }); },
  spaceCreate: wrap(async (me, name) => {
    init(); const ref = doc(collection(db, 'spaces')); const now = serverTimestamp();
    const b = writeBatch(db);
    b.set(ref, { name: String(name).slice(0, 60), owner: me.uid, members: { [me.uid]: 'owner' }, memberIds: [me.uid], names: { [me.uid]: me.username }, created: now, updated: now });
    b.set(doc(collection(db, 'spaces', ref.id, 'activity')), { what: 'created', name: String(name).slice(0, 60), by: me.uid, byName: me.username, at: now });
    await b.commit(); return ref.id;
  }),
  spaceInvite: wrap(async (me, sid, spaceName, username, role) => {
    init(); const u = await getDoc(doc(db, 'usernames', String(username || '').toLowerCase()));
    if (!u.exists()) throw fail('nouser', 'No account has that username.');
    const uid = u.data().uid; if (uid === me.uid) throw fail('self', 'You are already in this space.');
    const b = writeBatch(db); const now = serverTimestamp();
    b.set(doc(db, 'spaceInvites', sid + '_' + uid), { sid, uid, username: String(username).toLowerCase(), role, spaceName: String(spaceName).slice(0, 60), by: me.uid, byName: me.username, at: now });
    b.set(doc(collection(db, 'spaces', sid, 'activity')), { what: 'invited', name: String(username).toLowerCase(), by: me.uid, byName: me.username, at: now });
    await b.commit(); return uid;
  }),
  invitesListen(uid, cb, onError) { init(); return onSnapshot(query(collection(db, 'spaceInvites'), where('uid', '==', uid)), (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' })))), (e) => { if (onError) onError(friendly(e)); }); },
  inviteAccept: wrap(async (me, inv) => {
    init(); const sref = doc(db, 'spaces', inv.sid), iref = doc(db, 'spaceInvites', inv.sid + '_' + me.uid);
    await runTransaction(db, async (tx) => {
      const iv = await tx.get(iref); if (!iv.exists()) throw fail('gone', 'This invitation is no longer there.');
      const sp = await tx.get(sref); if (!sp.exists()) throw fail('gone', 'This space no longer exists.');
      const d = sp.data(); const role = iv.data().role;
      tx.update(sref, { ['members.' + me.uid]: role, memberIds: d.memberIds.concat([me.uid]), ['names.' + me.uid]: me.username, updated: serverTimestamp() });
      tx.delete(iref);
    });
    await setDoc(doc(collection(db, 'spaces', inv.sid, 'activity')), { what: 'joined', name: me.username, by: me.uid, byName: me.username, at: serverTimestamp() });
  }),
  inviteDecline: wrap(async (me, inv) => { init(); await deleteDoc(doc(db, 'spaceInvites', inv.sid + '_' + me.uid)); }),
  spaceInvitesOf: wrap(async (sid) => { init(); const s = await getDocs(query(collection(db, 'spaceInvites'), where('sid', '==', sid))); return s.docs.map((d) => Object.assign({ id: d.id }, d.data())); }),
  spaceSetRole: wrap(async (me, sid, uid, role) => { init(); await updateDoc(doc(db, 'spaces', sid), { ['members.' + uid]: role, updated: serverTimestamp() }); }),
  spaceRemove: wrap(async (me, sid, uid) => {
    init(); const sref = doc(db, 'spaces', sid);
    await runTransaction(db, async (tx) => { const sp = await tx.get(sref); if (!sp.exists()) return; const d = sp.data(); const m = Object.assign({}, d.members); delete m[uid]; const n = Object.assign({}, d.names || {}); delete n[uid];
      tx.update(sref, { members: m, memberIds: d.memberIds.filter((x) => x !== uid), names: n, updated: serverTimestamp() }); });
  }),
  spaceRename: wrap(async (sid, name) => { init(); await updateDoc(doc(db, 'spaces', sid), { name: String(name).slice(0, 60), updated: serverTimestamp() }); }),
  spaceDelete: wrap(async (sid) => {
    init(); for (const [k, subs] of [['boards', ['items']], ['notes', ['blocks']], ['calls', ['peers', 'signals']], ['tasks', []], ['presence', []]]) { try { const s = await getDocs(collection(db, 'spaces', sid, k)); for (const d of s.docs) { for (const sub of subs) { try { const x = await getDocs(collection(db, 'spaces', sid, k, d.id, sub)); for (const y of x.docs) { try { await deleteDoc(y.ref); } catch (e) {} } } catch (e) {} } await deleteDoc(d.ref); } } catch (e) {} }
    for (const sub of ['files', 'comments', 'activity']) { const s = await getDocs(collection(db, 'spaces', sid, sub)); for (const d of s.docs) { if (sub === 'files') { const r = await getDocs(collection(db, 'spaces', sid, 'files', d.id, 'revs')); for (const x of r.docs) await deleteDoc(x.ref); } await deleteDoc(d.ref); } }
    await deleteDoc(doc(db, 'spaces', sid));
  }),
  filesListen(sid, cb, onError) { init(); return onSnapshot(collection(db, 'spaces', sid, 'files'), (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' })))), (e) => { if (onError) onError(friendly(e)); }); },
  fileCreate: wrap(async (me, sid, name, kind, content) => {
    init(); const ref = doc(collection(db, 'spaces', sid, 'files')); const now = serverTimestamp(); const b = writeBatch(db);
    b.set(ref, { name: String(name).slice(0, 100), kind, content: String(content || ''), rev: 1, updatedBy: me.uid, updatedName: me.username, updatedAt: now, lockedBy: '', lockUntil: 0 });
    b.set(doc(db, 'spaces', sid, 'files', ref.id, 'revs', '1'), { content: String(content || ''), by: me.uid, byName: me.username, at: now });
    b.set(doc(collection(db, 'spaces', sid, 'activity')), { what: 'added', name: String(name).slice(0, 100), by: me.uid, byName: me.username, at: now });
    await b.commit(); return ref.id;
  }),
  /* saves on top of baseRev; if someone saved in between, nothing is written and { conflict, theirs } comes back */
  fileSave: wrap(async (me, sid, fid, content, baseRev) => {
    init(); const ref = doc(db, 'spaces', sid, 'files', fid);
    return runTransaction(db, async (tx) => {
      const cur = await tx.get(ref); if (!cur.exists()) throw fail('gone', 'This file is no longer in the space.');
      const d = cur.data(); if (d.rev !== baseRev) return { conflict: true, rev: d.rev, theirs: d.content, by: d.updatedName || '' };
      if (d.lockedBy && d.lockedBy !== me.uid && d.lockUntil > Date.now()) return { locked: true, by: d.lockedName || '' };
      const rev = d.rev + 1, now = serverTimestamp();
      tx.update(ref, { content: String(content), rev, updatedBy: me.uid, updatedName: me.username, updatedAt: now });
      tx.set(doc(db, 'spaces', sid, 'files', fid, 'revs', String(rev)), { content: String(content), by: me.uid, byName: me.username, at: now });
      return { ok: true, rev };
    });
  }),
  fileRevs: wrap(async (sid, fid) => { init(); const s = await getDocs(query(collection(db, 'spaces', sid, 'files', fid, 'revs'), orderBy('at', 'desc'), limit(30))); return s.docs.map((d) => Object.assign({ rev: +d.id }, d.data({ serverTimestamps: 'estimate' }))); }),
  fileLock: wrap(async (me, sid, fid, on) => { init(); await updateDoc(doc(db, 'spaces', sid, 'files', fid), on ? { lockedBy: me.uid, lockedName: me.username, lockUntil: Date.now() + 10 * 60000 } : { lockedBy: '', lockedName: '', lockUntil: 0 }); }),
  fileDelete: wrap(async (me, sid, fid, name) => {
    init(); const r = await getDocs(collection(db, 'spaces', sid, 'files', fid, 'revs')); for (const x of r.docs) await deleteDoc(x.ref);
    await deleteDoc(doc(db, 'spaces', sid, 'files', fid));
    await setDoc(doc(collection(db, 'spaces', sid, 'activity')), { what: 'deleted', name: String(name || '').slice(0, 100), by: me.uid, byName: me.username, at: serverTimestamp() });
  }),
  commentsListen(sid, cb, onError) { init(); return onSnapshot(query(collection(db, 'spaces', sid, 'comments'), orderBy('at', 'desc'), limit(200)), (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' })))), (e) => { if (onError) onError(friendly(e)); }); },
  commentAdd: wrap(async (me, sid, fid, text) => { init(); await setDoc(doc(collection(db, 'spaces', sid, 'comments')), { fid: fid || '', text: String(text).slice(0, 2000), by: me.uid, byName: me.username, at: serverTimestamp() }); }),
  commentDelete: wrap(async (sid, cid) => { init(); await deleteDoc(doc(db, 'spaces', sid, 'comments', cid)); }),
  activityListen(sid, cb, onError) { init(); return onSnapshot(query(collection(db, 'spaces', sid, 'activity'), orderBy('at', 'desc'), limit(50)), (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' })))), (e) => { if (onError) onError(friendly(e)); }); },
  /* ================= Live (4.0): presence, boards, live notes, tasks, voice signaling (inside a space) ================= */
  presenceSet: wrap(async (me, sid, app, state) => { init(); await setDoc(doc(db, 'spaces', sid, 'presence', me.uid), { name: me.username, app: String(app || '').slice(0, 40), state: state === 'away' ? 'away' : 'active', at: serverTimestamp() }); }),
  presenceClear: wrap(async (me, sid) => { init(); await deleteDoc(doc(db, 'spaces', sid, 'presence', me.uid)); }),
  presenceListen(sid, cb, onError) { return listenAll(['spaces', sid, 'presence'], cb, onError); },
  liveListen(path, cb, onError) { return listenAll(path, cb, onError); },
  /* a board or a note: { name } / { title } */
  liveHeadCreate: wrap(async (me, sid, kind, title) => {
    init(); const field = kind === 'boards' ? 'name' : 'title'; const ref = doc(collection(db, 'spaces', sid, kind));
    await setDoc(ref, { [field]: String(title).slice(0, 60), by: me.uid, byName: me.username, at: serverTimestamp() }); return ref.id;
  }),
  liveHeadRename: wrap(async (sid, kind, id, title) => { init(); await updateDoc(doc(db, 'spaces', sid, kind, id), { [kind === 'boards' ? 'name' : 'title']: String(title).slice(0, 60) }); }),
  liveHeadDelete: wrap(async (sid, kind, id) => {
    init(); const sub = kind === 'boards' ? 'items' : 'blocks'; const s = await getDocs(collection(db, 'spaces', sid, kind, id, sub));
    for (const d of s.docs) await deleteDoc(d.ref); await deleteDoc(doc(db, 'spaces', sid, kind, id));
  }),
  /* writes one revisioned thing (a board item, a note paragraph, a task) on top of baseRev (0 = new). If someone changed it in
     between, nothing is written and { conflict, theirs } comes back, so the app can keep both. */
  livePut: wrap(async (me, path, id, data, baseRev) => {
    init(); const ref = id ? doc(db, ...path, id) : doc(collection(db, ...path));
    return runTransaction(db, async (tx) => {
      const cur = await tx.get(ref); const rev = cur.exists() ? cur.data().rev : 0;
      if (rev !== (baseRev || 0)) return { conflict: true, rev, theirs: cur.exists() ? cur.data() : null, id: ref.id };
      const next = Object.assign({}, data, { rev: rev + 1, by: me.uid, byName: me.username, at: serverTimestamp() });
      tx.set(ref, next); return { ok: true, rev: rev + 1, id: ref.id };
    });
  }),
  liveDelete: wrap(async (path, id) => { init(); await deleteDoc(doc(db, ...path, id)); }),
  /* voice: a call, who is in it, and the messages two browsers need to connect (only readable by those two) */
  callStart: wrap(async (me, sid) => { init(); const ref = doc(collection(db, 'spaces', sid, 'calls')); await setDoc(ref, { by: me.uid, byName: me.username, at: serverTimestamp() }); return ref.id; }),
  callEnd: wrap(async (sid, cid) => {
    init(); for (const sub of ['peers', 'signals']) { try { const s = await getDocs(collection(db, 'spaces', sid, 'calls', cid, sub)); for (const d of s.docs) { try { await deleteDoc(d.ref); } catch (e) {} } } catch (e) {} }
    await deleteDoc(doc(db, 'spaces', sid, 'calls', cid));
  }),
  callJoin: wrap(async (me, sid, cid) => { init(); await setDoc(doc(db, 'spaces', sid, 'calls', cid, 'peers', me.uid), { name: me.username, at: serverTimestamp() }); }),
  callLeave: wrap(async (me, sid, cid) => { init(); await deleteDoc(doc(db, 'spaces', sid, 'calls', cid, 'peers', me.uid)); }),
  signalSend: wrap(async (me, sid, cid, to, type, data) => { init(); await setDoc(doc(collection(db, 'spaces', sid, 'calls', cid, 'signals')), { from: me.uid, to, type, data: String(data || '').slice(0, 20000), at: serverTimestamp() }); }),
  signalsListen(me, sid, cid, cb, onError) { init(); return onSnapshot(query(collection(db, 'spaces', sid, 'calls', cid, 'signals'), where('to', '==', me.uid)), (s) => cb(s.docChanges().filter((c) => c.type === 'added').map((c) => Object.assign({ id: c.doc.id }, c.doc.data({ serverTimestamps: 'estimate' })))), (e) => { if (onError) onError(e); }); },
  signalDelete: wrap(async (sid, cid, id) => { init(); await deleteDoc(doc(db, 'spaces', sid, 'calls', cid, 'signals', id)); }),
};
export default api;
