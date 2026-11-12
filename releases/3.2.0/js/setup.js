/* Setup: runs the first time PatOS starts.
   hello → language → account (required: sign in or create one)
     - sign in: the account's settings and files come down (language, name, look, wallpaper...), and setup ends
     - create: name → look → wallpaper → done
   Where accounts can't work (the single-file PatOS, a page opened from a file), the account step is skipped. */
(function () {
  'use strict';
  const { h, $ } = PatOS;
  const HELLOS = ['Hello', 'Bonjour', 'Hola', 'Ciao', 'Hallo', 'Olá', 'こんにちは', '안녕하세요', 'Привет', 'مرحبا', '你好'];
  const NEW = ['hello', 'lang', 'account', 'name', 'look', 'wallpaper', 'done']; // (the dots: someone who signs in skips name to wallpaper)
  let step = 'hello', el = null, helloTimer = 0;
  const A = () => PatOS.account;
  const accountsWork = () => !!(A() && A().available());

  function show(start) {
    step = NEW.includes(start) || start === 'restore' ? start : 'hello';
    if (step === 'account' && A() && A().signedIn()) step = 'name'; // (back after a reload, already signed in)
    if (step === 'restore' && !(A() && A().signedIn())) step = 'account';
    el = h('div', { id: 'setup' }, h('div', { class: 'su-card lg' }));
    $('#desktop').appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    render();
  }
  function finish() {
    PatOS.store.set('setupDone', true); PatOS.store.remove('setupStep');
    clearInterval(helloTimer);
    el.classList.remove('in'); setTimeout(() => el.remove(), 500);
    PatOS.sound.startup();
  }
  function go(s) {
    step = s; PatOS.store.set('setupStep', s);
    const c = el.querySelector('.su-card'); c.animate([{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.9,.3,1)' });
    render();
  }
  const reloadAt = (s) => { PatOS.store.set('setupStep', s); PatOS._leaving = true; location.reload(); };

  function render() {
    clearInterval(helloTimer);
    const c = el.querySelector('.su-card'); c.innerHTML = '';
    const T = PatOS.t;
    const next = (label, fn) => h('button', { class: 'btn primary su-next', onclick: fn }, T(label || 'Continue'));
    const dots = h('div', { class: 'su-dots' }, ...NEW.map((s) => h('span', { class: s === step ? 'on' : '' })));

    if (step === 'hello') {
      const hello = h('div', { class: 'su-hello' }, 'Hello');
      let i = 0; helloTimer = setInterval(() => { i = (i + 1) % HELLOS.length; hello.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 300 }).onfinish = () => { hello.textContent = HELLOS[i]; hello.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 400 }); }; }, 1800);
      c.append(hello, h('p', { class: 'su-sub' }, T('Welcome to PatOS')), next('Get Started', () => go('lang')), dots);

    } else if (step === 'lang') {
      const after = accountsWork() ? 'account' : 'name';
      const pick = (code, label, flag) => { const b = h('button', { class: 'su-opt' + (PatOS.lang === code ? ' on' : '') }, h('span', { class: 'su-flag' }, flag), label); b.onclick = () => { if (PatOS.lang === code) return go(after); PatOS.setSetting('language', code); reloadAt(after); }; return b; };
      c.append(h('h1', {}, T('Choose your language')), h('div', { class: 'su-opts' }, pick('en', 'English', 'EN'), pick('fr', 'Français', 'FR')), next(null, () => go(after)), dots);

    } else if (step === 'account') {
      account(c, dots);

    } else if (step === 'restore') {
      restore(c);

    } else if (step === 'name') {
      const inp = h('input', { class: 'field su-in', value: PatOS.settings.userName, maxlength: '24', spellcheck: 'false', 'aria-label': T('Your name') });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      const save = () => { PatOS.setSetting('userName', inp.value.trim() || 'Pat'); go('look'); };
      c.append(h('h1', {}, T('What’s your name?')), inp, next(null, save), dots);
      setTimeout(() => { inp.focus(); inp.select(); }, 50);

    } else if (step === 'look') {
      const modes = h('div', { class: 'su-opts' });
      [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].forEach(([k, l]) => { const b = h('button', { class: 'su-opt' + (PatOS.settings.theme === k ? ' on' : '') }, h('div', { class: 'st-mode-pv ' + k }), T(l)); b.onclick = () => { PatOS.setSetting('theme', k); render(); }; modes.appendChild(b); });
      const glass = h('button', { class: 'switch' + (PatOS.settings.liquidGlass ? ' on' : ''), role: 'switch', 'aria-checked': String(!!PatOS.settings.liquidGlass), 'aria-label': 'Liquid Glass' }); glass.onclick = () => { PatOS.setSetting('liquidGlass', !PatOS.settings.liquidGlass); render(); };
      c.append(h('h1', {}, T('Choose your look')), modes, h('label', { class: 'su-row' }, glass, h('span', {}, T('Liquid Glass'))), next(null, () => go('wallpaper')), dots);

    } else if (step === 'wallpaper') {
      const grid = h('div', { class: 'su-wps' });
      ['lumen', 'fold', 'nebula', 'waves', 'silk', 'aurora'].forEach((id) => {
        const src = PatOS.wallpaper.live[id] || PatOS.wallpaper.palettes[id];
        const b = h('button', { class: 'su-wp' + (PatOS.settings.wallpaper === id ? ' on' : '') }, h('img', { src: PatOS.wallpaper.thumb(id), alt: '' }), h('span', {}, T(src.name)));
        b.onclick = () => { PatOS.setSetting('wallpaper', id); if (src.live) PatOS.setSetting('live3d', true); render(); };
        grid.appendChild(b);
      });
      c.append(h('h1', {}, T('Pick a wallpaper')), grid, next(null, () => go('done')), dots);

    } else {
      const back = PatOS.store.get('setupBack', false);
      const tips = PatOS.isMobile
        ? [['⬆️', T('Swipe up from the bottom to go home')], ['⏸', T('Swipe up and hold to switch apps')], ['⬇️', T('Pull down from the top right for Control Center')]]
        : [['🔍', T('Ctrl+Space to search')], ['🚀', T('Alt+L to see all apps')], ['🪟', T('Drag a window to an edge to snap it')]];
      c.append(h('div', { class: 'su-check' }, '✓'), h('h1', {}, (back ? T('Welcome back, ') : T('You’re all set, ')) + PatOS.settings.userName + '!'),
        h('div', { class: 'su-tips' }, ...tips.map(([i, t]) => h('div', {}, h('span', {}, i), t))), next('Start', () => { PatOS.store.remove('setupBack'); finish(); }));
    }
  }

  /* the account: required. Sign in (an account you have) or create one. */
  let mode = 'signup';
  function account(c, dots) {
    const T = PatOS.t;
    const user = h('input', { class: 'field su-in', placeholder: T('Username'), autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: '20', 'aria-label': T('Username') });
    const pass = h('input', { class: 'field su-in', type: 'password', placeholder: T('Password'), autocomplete: mode === 'signup' ? 'new-password' : 'current-password', 'aria-label': T('Password') });
    const again = mode === 'signup' ? h('input', { class: 'field su-in', type: 'password', placeholder: T('Password again'), autocomplete: 'new-password', 'aria-label': T('Password again') }) : null;
    const note = h('p', { class: 'su-note', 'aria-live': 'polite' });
    const btn = next2(mode === 'signup' ? T('Create Account') : T('Sign In'));
    function next2(label) { return h('button', { class: 'btn primary su-next' }, label); }
    const tabs = h('div', { class: 'su-tabs', role: 'tablist' }, ...[['signup', T('Create account')], ['signin', T('Sign in')]].map(([k, l]) =>
      h('button', { class: 'su-tab' + (mode === k ? ' on' : ''), role: 'tab', 'aria-selected': String(mode === k), onclick: () => { if (mode !== k) { mode = k; render(); } } }, l)));
    let busy = false;
    const submit = async () => {
      if (busy) return; note.className = 'su-note'; note.textContent = '';
      if (mode === 'signup' && pass.value !== again.value) { note.className = 'su-note err'; note.textContent = T('The passwords don’t match.'); return; }
      if (navigator.onLine === false) { note.className = 'su-note err'; note.textContent = T('You’re offline. Connect to the internet to continue.'); return; }
      busy = true; [user, pass, again, btn].forEach((x) => x && (x.disabled = true)); note.textContent = mode === 'signup' ? T('Creating your account…') : T('Signing in…');
      try {
        if (mode === 'signup') {
          await A().signUp(user.value, pass.value);
          if (PatOS.settings.userName === 'Pat' || !PatOS.settings.userName) { const u = user.value.trim(); PatOS.setSetting('userName', u.charAt(0).toUpperCase() + u.slice(1)); }
          go('name');
        } else { await A().signIn(user.value, pass.value); step = 'restore'; PatOS.store.set('setupStep', 'restore'); render(); }
      } catch (e) {
        busy = false; [user, pass, again, btn].forEach((x) => x && (x.disabled = false));
        note.className = 'su-note err'; note.textContent = (e && e.message) || T('That didn’t work. Try again.');
      }
    };
    [user, pass, again].forEach((i) => i && i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
    btn.onclick = submit;
    c.append(h('h1', {}, T('Your account')), tabs,
      h('p', { class: 'su-sub' }, mode === 'signup' ? T('A username and a password. No email needed.') : T('Your settings and files come back to this device.')),
      h('div', { class: 'su-form' }, user, pass, again),
      mode === 'signup' ? h('p', { class: 'su-fine' }, T('Remember your password: it can’t be reset.')) : null,
      note, btn, dots);
    setTimeout(() => user.focus(), 60);
  }

  /* signed in: wait for the account's settings and files (at most 25 s; the rest keeps coming in the background) */
  async function restore(c) {
    const T = PatOS.t;
    c.append(h('div', { class: 'su-spin', 'aria-hidden': 'true' }), h('h1', {}, T('Getting your things…')), h('p', { class: 'su-sub' }, '@' + ((A().info() || {}).username || '')));
    const lang0 = PatOS.settings.language;
    try { await Promise.race([PatOS.sync.now(), new Promise((r) => setTimeout(r, 25000))]); } catch (e) { /* offline or slow: it goes on later */ }
    PatOS.store.set('setupBack', true);
    if (PatOS.settings.language !== lang0) return reloadAt('done'); // (the account's language: shown from the next screen on)
    go('done');
  }

  PatOS.setup = {
    maybeShow() {
      if (PatOS.store.get('setupDone', false)) return false;
      const s = PatOS.store.get('setupStep', 'hello');
      show(typeof s === 'number' ? ['hello', 'lang', 'name', 'look', 'wallpaper', 'done'][s] || 'hello' : s); return true; // (a number: a setup started before 3.2)
    },
    show
  };
})();
