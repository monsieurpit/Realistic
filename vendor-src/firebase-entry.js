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

   Accounts are username and password only. Firebase Authentication needs an email-shaped name, so the username is turned
   into one that can never receive mail (name@patos.invalid). Nobody types it, and no mail is ever sent. The password is
   only ever given to Firebase Authentication, which keeps a salted hash, never the password itself. */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, limit, documentId, serverTimestamp, writeBatch, onSnapshot, runTransaction } from 'firebase/firestore';

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
  if (/network|unavailable|deadline|timeout/.test(c) || /network/i.test((e && e.message) || '')) return fail('offline', 'No internet right now.');
  if (/operation-not-allowed|configuration-not-found/.test(c)) return fail('setup', 'Accounts are not switched on yet. In the Firebase console, open Authentication and turn on Email/Password.');
  if (/permission-denied|insufficient/.test(c)) return fail('rules', 'The database rules do not allow this yet. Paste the rules from firestore.rules into the Firebase console.');
  return e;
}
const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw friendly(e); } };

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
  sendMessage: wrap(async (cid, me, text, id) => {
    init(); const b = writeBatch(db); const now = serverTimestamp();
    b.set(doc(db, 'conversations', cid, 'messages', id), { from: me.uid, text: String(text).slice(0, 2000), t: Date.now(), at: now });
    b.update(doc(db, 'conversations', cid), { lastMessage: String(text).slice(0, 140), lastMessageAt: now, lastFrom: me.uid });
    await b.commit();
  }),
  messageExists: wrap(async (cid, id) => { init(); return (await getDoc(doc(db, 'conversations', cid, 'messages', id))).exists(); }),
  /* the system account opens a conversation that was waiting or declined */
  open: wrap(async (cid) => { init(); await updateDoc(doc(db, 'conversations', cid), { status: 'accepted', decidedAt: serverTimestamp() }); }),
  respond: wrap(async (cid, accept) => { init(); await updateDoc(doc(db, 'conversations', cid), { status: accept ? 'accepted' : 'declined', decidedAt: serverTimestamp() }); })
};
export default api;
