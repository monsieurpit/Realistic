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
  // the system account's name: a longer password when it is made (it can ban people and release versions)
  const SYSTEM_NAME = 'patos';
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
    watchSystem();
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
      if (username === SYSTEM_NAME && String(password).length < 14) throw new Error(T('The PatOS account needs a password of at least 14 characters.'));
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
      if (offBan) { offBan(); offBan = null; } if (offAnn) { offAnn(); offAnn = null; } hideBan();
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
    ready: () => state === 'ok',
    /* the system account (PatOS): its uid comes from config/system, which only the Firebase console can write */
    systemUid: () => PatOS.store.get('systemUid', ''),
    isVerified: (uid) => !!uid && PatOS.store.get('verifiedUids', []).includes(uid),
    isSystem: (uid) => { const s = api.systemUid(); return !!s && (uid == null ? !!info() && info().uid === s : uid === s); },
    /* how a person's name is shown: the system account is "PatOS", everyone else @name */
    display: (uid, username) => (api.isSystem(uid) ? 'PatOS' : '@' + (username || '?')),
    /* asks the password again and gives a fresh sign-in token, for PatOS's own server (releasing a version) */
    async freshToken(password) { const i = info(); if (!i) throw new Error(T('Sign in first.')); try { F = await PatOS.loadFirebase(); return await F.idToken(i.username, password); } catch (e) { throw say(e); } }
  };
  PatOS.account = api;

  /* ---------- the system account and bans ---------- */
  let offBan = null, banEl = null, offAnn = null;
  /* verified badges (given by PatOS) */
  async function loadVerified() { try { const l = await F.verifiedList(); PatOS.store.set('verifiedUids', l); PatOS.emit('chat'); } catch (e) {} }
  /* an announcement from PatOS: shown once to each person */
  function showAnnouncement(a) {
    if (!a || !a.text) return; const id = String(a.at && a.at.toMillis ? a.at.toMillis() : a.at || a.text);
    if (PatOS.store.get('annSeen', '') === id) return; PatOS.store.set('annSeen', id);
    setTimeout(() => PatOS.alertBox(T('Announcement from PatOS'), a.text, { icon: 'about' }), 800);
  }
  async function watchSystem() {
    const i = info(); if (!i || !F) return;
    try { F._sys = null; const s = await F.systemUid(); if (s !== PatOS.store.get('systemUid', '')) { PatOS.store.set('systemUid', s); emit(); PatOS.emit('chat'); } } catch (e) {}
    if (offBan) offBan();
    offBan = F.listenBan(i.uid, (b) => { if (b) showBan(b); else hideBan(); });
    if (offAnn) offAnn();
    offAnn = F.listenAnnouncement(showAnnouncement);
    loadVerified();
  }
  // config/system may be set while PatOS is open: look again now and then (one small read), no restart needed
  setInterval(async () => { const i = info(); if (!i || !F || state !== 'ok' || document.hidden) return; loadVerified(); try { F._sys = null; const s = await F.systemUid(); if (s && s !== PatOS.store.get('systemUid', '')) { PatOS.store.set('systemUid', s); emit(); PatOS.emit('chat'); } } catch (e) {} }, 60000);
  function hideBan() { if (banEl) { banEl.remove(); banEl = null; } }
  /* a banned account: only Log Out is left (what is on this device stays; another account can be made) */
  function showBan(b) {
    hideBan(); const { h } = PatOS;
    const out = h('button', { class: 'btn primary', onclick: async () => { out.disabled = true; await api.signOut(); hideBan(); } }, T('Log Out'));
    banEl = h('div', { class: 'ban-layer', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'ban-t' },
      h('div', { class: 'ban-card' }, h('div', { class: 'ban-ic', html: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>' }),
        h('h2', { id: 'ban-t' }, T('Your account has been banned')),
        h('p', {}, T('PatOS banned @') + ((info() || {}).username || '') + '.'),
        h('div', { class: 'ban-why' }, h('small', {}, T('Reason')), h('div', {}, b.reason || T('No reason was given.'))),
        h('p', { class: 'ban-fine' }, T('You can’t send messages or save to this account anymore. What is on this device stays here.')), out));
    banEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); }, true);
    document.body.appendChild(banEl); setTimeout(() => out.focus(), 50);
  }

  /* the system badge: a seal with twelve soft points and a check mark, drawn here (no image) */
  PatOS.systemBadge = function (size, kind) {
    size = size || 16; const N = 12, R = 10, a = 1.15, c = 12, pts = [];
    for (let i = 0; i <= 96; i++) { const t = i / 96 * Math.PI * 2, r = R + a * Math.cos(N * t); pts.push((c + r * Math.cos(t)).toFixed(2) + ' ' + (c + r * Math.sin(t)).toFixed(2)); }
    const id = 'sb' + Math.random().toString(36).slice(2, 7);
    const el = document.createElement('span'); el.className = 'sys-badge'; el.setAttribute('role', 'img'); const lbl = T(kind === 'verified' ? 'Verified by PatOS' : 'PatOS system account'); el.setAttribute('aria-label', lbl); el.title = lbl;
    el.innerHTML = '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (kind === 'verified' ? '#2aa8ff' : '#7d5cff') + '"/><stop offset="1" stop-color="' + (kind === 'verified' ? '#0a6cff' : '#ff4fa0') + '"/></linearGradient></defs>' +
      '<path d="M' + pts.join(' L') + 'Z" fill="url(#' + id + ')"/><path d="M7.4 12.3l3 3 6.2-6.4" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return el;
  };

  /* ---------- coming back on the next start (works offline: the browser remembers the sign-in) ---------- */
  async function resume() {
    const i = info(), k = PatOS.store.get('accountKey', null); if (!i || !k || resuming) return;
    resuming = (async () => {
      try {
        F = await PatOS.loadFirebase(); const u = await F.restore();
        if (!u || u.uid !== i.uid) { state = navigator.onLine === false ? 'ok' : 'reauth'; emit(); if (state === 'reauth') return; } // the sign-in was lost: sign in again to go on saving
        user = { uid: i.uid, username: i.username }; state = 'ok'; emit(); PatOS.emit('chat:account'); watchSystem();
        await startSync(unb64(k));
      } catch (e) { state = 'offline'; emit(); }
    })().finally(() => { resuming = null; });
    return resuming;
  }
  api._resume = resume;
  if (info() && api.available()) setTimeout(() => resume(), 1500);
  addEventListener('online', () => { if (info() && state !== 'ok') resume(); });
})();
