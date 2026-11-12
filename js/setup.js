/* Setup Assistant — runs the first time PatOS starts */
(function () {
  'use strict';
  const { h, $ } = PatOS;
  const HELLOS = ['Hello', 'Bonjour', 'Hola', 'Ciao', 'Hallo', 'Olá', 'こんにちは', '안녕하세요', 'Привет', 'مرحبا', '你好'];
  let step = 0, el = null, helloTimer = 0;
  function show(startStep) {
    step = startStep || 0;
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
  function go(n) { step = n; const c = el.querySelector('.su-card'); c.animate([{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.9,.3,1)' }); render(); }
  function render() {
    clearInterval(helloTimer);
    const c = el.querySelector('.su-card'); c.innerHTML = '';
    const T = PatOS.t;
    const next = (label, fn) => h('button', { class: 'btn primary su-next', onclick: fn }, T(label || 'Continue'));
    const dots = h('div', { class: 'su-dots' }, ...[0, 1, 2, 3, 4, 5].map((i) => h('span', { class: i === step ? 'on' : '' })));
    if (step === 0) {
      const hello = h('div', { class: 'su-hello' }, 'Hello');
      let i = 0; helloTimer = setInterval(() => { i = (i + 1) % HELLOS.length; hello.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 300 }).onfinish = () => { hello.textContent = HELLOS[i]; hello.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 400 }); }; }, 1800);
      const have = h('button', { class: 'su-link', onclick: (e) => { const B = PatOS.backup; if (!B) return; const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ label: T('From a backup file…'), action: () => B.ui.pickFile() }, B.folder.supported() ? { label: T('From my backup folder…'), action: () => B.ui.folderMenu(null, e.currentTarget).catch(() => {}) } : null], r.left, r.top - 90); } }, T('I already have a backup'));
      c.append(hello, h('p', { class: 'su-sub' }, T('Welcome to PatOS')), next('Get Started', () => go(1)), have, dots);
    } else if (step === 1) {
      const pick = (code, label, flag) => { const b = h('button', { class: 'su-opt' + (PatOS.lang === code ? ' on' : '') }, h('span', { class: 'su-flag' }, flag), label); b.onclick = () => { if (PatOS.lang === code) return go(2); PatOS.setSetting('language', code); PatOS.store.set('setupStep', 2); (PatOS._leaving = true, location.reload()); }; return b; };
      c.append(h('h1', {}, T('Choose your language')), h('p', { class: 'su-sub' }, T('You can change it later in Settings.')), h('div', { class: 'su-opts' }, pick('en', 'English', 'EN'), pick('fr', 'Français', 'FR')), next(null, () => go(2)), dots);
    } else if (step === 2) {
      const inp = h('input', { class: 'field su-in', value: PatOS.settings.userName, maxlength: '24', spellcheck: 'false' });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      const save = () => { PatOS.setSetting('userName', inp.value.trim() || 'Pat'); go(3); };
      c.append(h('h1', {}, T('What’s your name?')), h('p', { class: 'su-sub' }, ''), inp, next(null, save), dots);
      setTimeout(() => { inp.focus(); inp.select(); }, 50);
    } else if (step === 3) {
      const modes = h('div', { class: 'su-opts' });
      [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].forEach(([k, l]) => { const b = h('button', { class: 'su-opt' + (PatOS.settings.theme === k ? ' on' : '') }, h('div', { class: 'st-mode-pv ' + k }), T(l)); b.onclick = () => { PatOS.setSetting('theme', k); render(); }; modes.appendChild(b); });
      const glass = h('button', { class: 'switch' + (PatOS.settings.liquidGlass ? ' on' : '') }); glass.onclick = () => { PatOS.setSetting('liquidGlass', !PatOS.settings.liquidGlass); render(); };
      c.append(h('h1', {}, T('Choose your look')), modes, h('label', { class: 'su-row' }, glass, h('span', {}, T('Liquid Glass'))), next(null, () => go(4)), dots);
    } else if (step === 4) {
      const grid = h('div', { class: 'su-wps' });
      ['nebula', 'waves', 'crystals', 'sonora', 'aurora', 'sunrise'].forEach((id) => {
        const src = PatOS.wallpaper.live[id] || PatOS.wallpaper.palettes[id];
        const b = h('button', { class: 'su-wp' + (PatOS.settings.wallpaper === id ? ' on' : '') }, h('img', { src: PatOS.wallpaper.thumb(id), alt: '' }), h('span', {}, T(src.name)));
        b.onclick = () => { PatOS.setSetting('wallpaper', id); if (src.live) PatOS.setSetting('live3d', true); render(); };
        grid.appendChild(b);
      });
      c.append(h('h1', {}, T('Pick a wallpaper')), h('p', { class: 'su-sub' }, ''), grid, next(null, () => go(5)), dots);
    } else {
      const tips = PatOS.isMobile
        ? [['⬆️', T('Swipe up from the bottom to go home')], ['⏸', T('Swipe up and pause to switch apps')], ['⬇️', T('Pull down from the top right for Control Center')]]
        : [['🔍', T('Ctrl+Space searches everything')], ['🚀', T('Alt+L shows all your apps')], ['🪟', T('Drag a window to the edge to snap it')]];
      c.append(h('div', { class: 'su-check' }, '✓'), h('h1', {}, T('You’re all set, ') + PatOS.settings.userName + '!'), h('div', { class: 'su-tips' }, ...tips.map(([i, t]) => h('div', {}, h('span', {}, i), t))), next('Start Using PatOS', finish), dots);
    }
  }
  PatOS.setup = {
    maybeShow() {
      if (PatOS.store.get('setupDone', false)) return false;
      show(PatOS.store.get('setupStep', 0)); return true;
    },
    show
  };
})();
