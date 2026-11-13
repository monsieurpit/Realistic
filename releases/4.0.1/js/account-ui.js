/* The screens for PatOS accounts: create one, sign in, and the big invitation everyone gets once this update arrives. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const A = () => PatOS.account;

  /* create an account / sign in (one box, two tabs); onDone runs when it worked */
  function box(start, onDone) {
    return new Promise((resolve) => {
      let mode = start === 'signin' ? 'signin' : 'signup';
      const layer = h('div', { class: 'dlg-layer acc-layer' }); const card = h('div', { class: 'acc-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('PatOS account') }); layer.appendChild(card);
      const close = (v) => { document.removeEventListener('keydown', onKey, true); layer.remove(); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); close(false); } };
      document.addEventListener('keydown', onKey, true);
      let busy = false;
      function paint() {
        card.innerHTML = '';
        const user = h('input', { class: 'field', placeholder: T('Username'), autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: '20', 'aria-label': T('Username') });
        const pass = h('input', { class: 'field', type: 'password', placeholder: T('Password'), autocomplete: mode === 'signup' ? 'new-password' : 'current-password', 'aria-label': T('Password') });
        const again = mode === 'signup' ? h('input', { class: 'field', type: 'password', placeholder: T('Password again'), autocomplete: 'new-password', 'aria-label': T('Password again') }) : null;
        const note = h('div', { class: 'acc-note', 'aria-live': 'polite' });
        const go = h('button', { class: 'btn primary acc-go' }, mode === 'signup' ? T('Create Account') : T('Sign In'));
        const tabs = h('div', { class: 'acc-tabs' }, ...[['signup', T('Create account')], ['signin', T('Sign in')]].map(([k, l]) => h('button', { class: 'acc-tab' + (mode === k ? ' on' : ''), disabled: busy, onclick: () => { mode = k; paint(); } }, l)));
        const submit = async () => {
          if (busy) return; note.className = 'acc-note'; note.textContent = '';
          if (mode === 'signup' && pass.value !== again.value) { note.className = 'acc-note err'; note.textContent = T('The two passwords are different.'); return; }
          busy = true; go.disabled = user.disabled = pass.disabled = true; if (again) again.disabled = true; note.textContent = mode === 'signup' ? T('Creating your account…') : T('Signing in…');
          try { await (mode === 'signup' ? A().signUp(user.value, pass.value) : A().signIn(user.value, pass.value)); saving(); } catch (e) { busy = false; go.disabled = user.disabled = pass.disabled = false; if (again) again.disabled = false; note.className = 'acc-note err'; note.textContent = String(e.message || e); }
        };
        [user, pass, again].forEach((i) => i && i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
        go.onclick = submit;
        card.append(h('div', { class: 'acc-logo', html: PatOS.iconHTML('settings') }), h('h2', {}, mode === 'signup' ? T('Create your PatOS account') : T('Welcome back')), tabs,
          h('p', { class: 'acc-sub' }, mode === 'signup' ? T('A username and a password. No email.') : T('Your files, notes and settings come back to this device.')),
          user, pass, again, mode === 'signup' ? h('p', { class: 'acc-fine' }, T('There’s no password reset. Pick one you’ll remember.')) : null,
          note, h('div', { class: 'acc-btns' }, h('button', { class: 'btn', disabled: busy, onclick: () => close(false) }, T('Cancel')), go));
        setTimeout(() => user.focus(), 40);
      }
      /* after it worked: watch Sync save everything, then close */
      function saving() {
        card.innerHTML = '';
        const msg = h('p', { class: 'acc-sub', 'aria-live': 'polite' }, T('Saving everything to your account…')); const bar = h('div', { class: 'acc-bar' }, h('i'));
        const done = h('button', { class: 'btn primary', disabled: true, onclick: () => close(true) }, T('Done'));
        card.append(h('div', { class: 'acc-logo', html: PatOS.iconHTML('settings') }), h('h2', {}, '@' + (A().info() || {}).username), msg, bar, h('div', { class: 'acc-btns' }, done));
        let finished = false; let seenSyncing = false; const t0 = Date.now();
        const check = () => {
          const s = PatOS.sync.status();
          if (s.state === 'syncing') seenSyncing = true;
          if (finished) return;
          if (s.state === 'error' || s.state === 'offline') { finished = true; msg.textContent = s.state === 'offline' ? T('Your account is ready. It will sync when you’re online.') : T('Your account is ready. Saving will try again.'); bar.classList.add('stop'); done.disabled = false; off(); return; }
          if (s.state === 'idle' && s.last && (seenSyncing || Date.now() - t0 > 4000) && s.mode === 'account') { finished = true; msg.textContent = T('All saved.') + ' ' + s.items + ' ' + T('items are in your account.'); bar.classList.add('full'); done.disabled = false; done.focus(); off(); }
        };
        const off = PatOS.on('sync', check); const iv = setInterval(() => { check(); if (finished) clearInterval(iv); }, 700); check();
        if (onDone) try { onDone(); } catch (e) {}
      }
      paint(); document.body.appendChild(layer);
    });
  }

  /* the big invitation: once this update is installed, everyone without an account sees it (and again each day until they choose) */
  const DAY = 86400000;
  function invite() {
    if (document.querySelector('.acc-layer')) return;
    const layer = h('div', { class: 'dlg-layer acc-layer' });
    const later = () => { PatOS.store.set('accountPrompt', { snoozedUntil: Date.now() + DAY }); layer.remove(); };
    const item = (t, d) => h('li', {}, h('b', {}, t), h('span', {}, d));
    layer.appendChild(h('div', { class: 'acc-card big', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('Create your PatOS account') },
      h('div', { class: 'acc-logo big', html: PatOS.iconHTML('settings') }), h('h2', {}, T('Create your PatOS account')),
      h('p', { class: 'acc-sub' }, T('A username and a password. No email.')),
      h('ul', { class: 'acc-list' }, item(T('Everything is saved'), T('Your files and settings on every device.')), item(T('Still works offline'), T('PatOS still works offline.')), item(T('Message your friends'), T('Find people by username in Messages.')), item(T('Private'), T('What is saved is locked with your password.'))),
      h('div', { class: 'acc-btns col' }, h('button', { class: 'btn primary acc-go', onclick: () => { layer.remove(); box('signup'); } }, T('Create My Account')), h('button', { class: 'btn', onclick: () => { layer.remove(); box('signin'); } }, T('I Already Have an Account')), h('button', { class: 'tbtn acc-later', onclick: later }, T('Later')))));
    document.body.appendChild(layer);
    PatOS.notify && PatOS.notify({ title: T('Create your PatOS account'), body: T('Save everything to the cloud and message your friends.'), icon: 'settings', duration: 6000, onClick: () => {} });
  }
  function maybeInvite() {
    if (navigator.webdriver) return; // (automated test browsers are not invited)
    if (!PatOS.loggedIn || !A() || !A().available() || A().signedIn() || navigator.onLine === false) return;
    // (4.0) never during or before setup, which asks for the account itself: a new device used to get this old invitation on
    //  top of the setup ("setup done" was read as true when it was not set yet)
    if (!PatOS.store.get('setupDone', false) || document.getElementById('setup')) return;
    const p = PatOS.store.get('accountPrompt', {}); if (p.snoozedUntil && Date.now() < p.snoozedUntil) return;
    invite();
  }
  PatOS.accountUI = { open: box, invite, maybeInvite };
  setInterval(maybeInvite, 15000); setTimeout(maybeInvite, 6000);
})();
