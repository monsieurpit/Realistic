/* PatOS accounts: a username and a password, nothing else (no email).
   - The account lives in the cloud (Firebase). Everything you have (files, notes, calendar, settings, apps...) is saved there
     by Sync, and also kept on this device, so PatOS still opens and works with no internet.
   - What is saved in the cloud is encrypted on the device first, with a key made from your password. The database holds
     scrambled bytes. The password itself only goes to Firebase Authentication, which keeps a salted hash.
   - There is no "forgot my password": nobody could open your cloud copy without it. (The copy on your devices stays.)
   - The cloud layer is vendor/firebase.js (see vendor-src/firebase-entry.js). It is only loaded when there is an account,
     or when someone opens the sign-up box. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const noCrypto = () => !(window.crypto && crypto.subtle && window.TextEncoder);

  /* ---------- the cloud layer, loaded when needed ---------- */
  let loading = null;
  PatOS.loadFirebase = function () {
    if (window.PatFirebase) return Promise.resolve(window.PatFirebase);
    if (!loading) loading = (async () => {
      const tag = document.querySelector('script[type="patos/firebase"]');
      const r = await fetch((tag && tag.getAttribute('src')) || 'vendor/firebase.js'); if (!r.ok) throw new Error(T('The account code could not be loaded.'));
      const s = document.createElement('script'); s.text = await r.text(); document.head.appendChild(s);
      if (!window.PatFirebase) throw new Error(T('The account code could not be loaded.'));
      return window.PatFirebase;
    })().catch((e) => { loading = null; throw e; });
    return loading;
  };

  /* ---------- the key for the cloud copy: made from the password, kept on this device so Sync can run without asking again ---------- */
  async function keyFrom(password, uid) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode('patos-account-v1:' + uid), iterations: 250000, hash: 'SHA-256' }, base, 256));
  }

  let F = null, user = null, state = 'off', resuming = null, transport = null;
  const info = () => PatOS.store.get('accountInfo', null);
  const emit = () => PatOS.emit('account', api.status());
  const setState = (s) => { state = s; emit(); };
  const checks = (username, password) => {
    if (noCrypto()) throw new Error(T('This browser cannot do encryption here'));
    if (!/^[a-z0-9_]{3,20}$/.test(String(username || '').trim().toLowerCase())) throw new Error(T('A username has 3 to 20 letters, numbers or underscores.'));
    if (String(password || '').length < 8) throw new Error(T('Use a password of at least 8 characters.'));
  };
  /* Firebase errors, in the person's language */
  const say = (e) => {
    const c = e && e.code;
    const m = { taken: 'That username is taken.', weak: 'Choose a longer password.', wrong: 'Wrong username or password.', busy: 'Too many tries. Wait a few minutes.', offline: 'No internet right now.', invalid: 'A username has 3 to 20 letters, numbers or underscores.',
      setup: 'Accounts are not switched on yet. In the Firebase console, open Authentication and turn on Email/Password.', rules: 'The database rules do not allow this yet. Paste the rules from firestore.rules into the Firebase console.' }[c];
    return new Error(m ? T(m) : String((e && e.message) || e));
  };

  /* what Sync uses to save into the account */
  function makeTransport(uid, username) {
    let epoch = '';
    return {
      uid,
      async register() {
        let m = await F.syncMeta(uid);
        if (!m.exists) { await F.claim(uid, username); m = await F.syncMeta(uid); }
        epoch = m.epoch; return { epoch, rev: 0 };
      },
      async pull(since) { const r = await F.syncRead(uid, since, 100); return { epoch, rev: r.last, records: r.records, more: r.more }; },
      async push(records) { const r = await F.syncWrite(uid, records); return { epoch, rev: null, applied: r.applied, skipped: r.skipped, rejected: 0 }; },
      wipe: () => F.syncWipe(uid)
    };
  }
  async function startSync(keyBytes) { transport = makeTransport(user.uid, user.username); return PatOS.sync.useAccount(keyBytes, transport); }

  async function enter(u, password, snapshot) {
    const key = await keyFrom(password, u.uid);
    if (snapshot) { try { if (PatOS.backup) await PatOS.backup.snapshot(T('Before signing in'), 'before'); } catch (e) {} } // a way back, in case the account has other versions of what is here
    user = u; PatOS.store.set('accountKey', b64(key)); PatOS.store.set('accountInfo', { uid: u.uid, username: u.username, at: Date.now() });
    state = 'ok'; emit(); PatOS.emit('chat:account'); // (Sync and Messages pick it up)
    try { await startSync(key); } catch (e) { /* the account is made; saving will be tried again */ }
    return u;
  }

  const api = {
    available: () => !noCrypto() && /^https?:$/.test(location.protocol) && !PatOS.singleFile,
    signedIn: () => !!info(),
    info,
    user: () => info(),
    status: () => ({ signedIn: !!info(), username: (info() || {}).username || '', state }),
    /* a new account: the name must be free; everything on this device is then saved into it */
    async signUp(username, password) {
      checks(username, password); username = username.trim().toLowerCase();
      try { F = await PatOS.loadFirebase(); const u = await F.signUp(username, password); return await enter(u, password, false); } catch (e) { throw say(e); }
    },
    /* an account that exists: its things come to this device (what is here and not there is kept and sent) */
    async signIn(username, password) {
      checks(username, password); username = username.trim().toLowerCase();
      try { F = await PatOS.loadFirebase(); const u = await F.signIn(username, password); return await enter(u, password, true); } catch (e) { throw say(e); }
    },
    /* leave the account on this device; everything stays here, and nothing more is sent */
    async signOut() {
      try { if (F || window.PatFirebase) await (F || window.PatFirebase).signOut(); } catch (e) {}
      user = null; transport = null; PatOS.store.remove('accountInfo'); PatOS.store.remove('accountKey'); PatOS.store.remove('syncState');
      try { await PatOS.sync.clearAccount(); } catch (e) {}
      state = 'off'; emit(); PatOS.emit('chat:account');
    },
    /* removes the cloud copy, the username and the sign-in; what is on this device stays */
    async deleteAccount(password) {
      const i = info(); if (!i) return;
      try { F = await PatOS.loadFirebase(); await F.deleteAccount(i.username, password); } catch (e) { throw say(e); }
      await api.signOut();
    },
    /* the signed-in person, for other parts of PatOS (Messages) */
    cloud: async () => { F = await PatOS.loadFirebase(); return F; },
    ready: () => state === 'ok'
  };
  PatOS.account = api;

  /* ---------- coming back on the next start (works offline: the browser remembers the sign-in) ---------- */
  async function resume() {
    const i = info(), k = PatOS.store.get('accountKey', null); if (!i || !k || resuming) return;
    resuming = (async () => {
      try {
        F = await PatOS.loadFirebase(); const u = await F.restore();
        if (!u || u.uid !== i.uid) { state = navigator.onLine === false ? 'ok' : 'reauth'; emit(); if (state === 'reauth') return; } // the sign-in was lost: sign in again to go on saving
        user = { uid: i.uid, username: i.username }; state = 'ok'; emit(); PatOS.emit('chat:account');
        await startSync(unb64(k));
      } catch (e) { state = 'offline'; emit(); }
    })().finally(() => { resuming = null; });
    return resuming;
  }
  api._resume = resume;
  if (info() && api.available()) setTimeout(() => resume(), 1500);
  addEventListener('online', () => { if (info() && state !== 'ok') resume(); });
})();
