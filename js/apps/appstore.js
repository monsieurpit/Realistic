/* App Store — browse every PatOS app, open it, pin it, hide or show it */
(function () {
  'use strict';
  const { h } = PatOS;
  const BLURB = {
    galaxy: 'Build your own spiral galaxy with up to 150,000 stars, then set off supernovas.',
    orbrunner: 'Race a glowing orb down a neon highway. Dodge blocks, grab gems, beat your best.',
    studio: 'Drop shapes into a 3D scene, paint them, make them spin and snap a picture.',
    code: 'Write HTML, CSS and JavaScript and watch your page update as you type.',
    messages: 'Chat with Pat, the built-in assistant that opens apps, does math and keeps reminders.',
    piano: 'Play two octaves with your keyboard or fingers, record a melody and play it back.',
    flashcards: 'Make decks for any class and study them with cards that flip in 3D.',
    music: 'Five songs composed live by your computer, a 3D visualizer and your own MP3s.',
    typing: 'Measure your typing speed and accuracy and watch your best score climb.',
    voicememos: 'Record your voice, see the waveform and play it back later.',
    browser: 'Tabs, bookmarks and a search box. YouTube links play right inside.',
    terminal: 'A real little shell: ls, cd, cat, mkdir, neofetch, matrix and more.'
  };
  const FEATURED = ['galaxy', 'orbrunner', 'code', 'messages'];
  const GRADS = ['linear-gradient(135deg,#3a1c71,#d76d77,#ffaf7b)', 'linear-gradient(135deg,#0b0130,#ff2fa3)', 'linear-gradient(135deg,#1e1e2e,#5b5bd6)', 'linear-gradient(135deg,#0bbf3a,#00a6fb)'];
  PatOS.registerApp({
    id: 'appstore', name: 'App Store', icon: 'appstore', width: 940, height: 640, category: 'Utilities', keywords: 'apps install store download',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let tab = 'discover', q = '';
      const seg = h('div', { class: 'seg' });
      [['discover', 'Discover'], ['games', '3D & Games'], ['google', 'Google'], ['all', 'All Apps']].forEach(([k, l]) => seg.appendChild(h('button', { class: 'tab', 'data-k': k, onclick: () => { tab = k; render(); } }, l)));
      const search = h('input', { class: 'field', placeholder: 'Search apps', style: { width: '170px' } });
      search.oninput = () => { q = search.value.toLowerCase(); render(); };
      win.toolbar.append(seg, h('div', { style: { flex: 1 } }), search);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const main = h('div', { class: 'as-main' }); win.body.appendChild(main);
      const isHidden = (id) => (PatOS.settings.hiddenApps || []).includes(id);
      const inDock = (id) => (PatOS.isMobile ? PatOS.settings.mobileDock : PatOS.settings.dockPinned).includes(id);
      function row(id) {
        const a = PatOS.apps[id];
        const open = h('button', { class: 'as-get' }, isHidden(id) ? 'GET' : 'OPEN');
        open.onclick = (e) => { e.stopPropagation(); if (isHidden(id)) { PatOS.setSetting('hiddenApps', PatOS.settings.hiddenApps.filter((x) => x !== id)); open.textContent = 'OPEN'; PatOS.sound.pop(); PatOS.notify({ title: a.name + ' is back', body: 'Find it in Launchpad and on your Home Screen.', icon: a.icon || id }); } else { PatOS.setLaunchRect(el.querySelector('.as-ic')); PatOS.launch(id); } };
        const el = h('div', { class: 'as-row' }, h('div', { class: 'as-ic', html: PatOS.iconHTML(a.icon || id) }), h('div', { class: 'as-txt' }, h('b', {}, a.name), h('small', {}, BLURB[id] || a.about || (a.category || 'Apps'))), open);
        el.onclick = () => detail(id);
        return el;
      }
      function detail(id) {
        const a = PatOS.apps[id];
        main.innerHTML = '';
        const dockBtn = h('button', { class: 'btn' }, inDock(id) ? 'Remove from Dock' : 'Add to Dock');
        dockBtn.onclick = () => {
          const key = PatOS.isMobile ? 'mobileDock' : 'dockPinned'; let l = PatOS.settings[key].slice();
          if (l.includes(id)) l = l.filter((x) => x !== id); else { if (key === 'mobileDock' && l.length >= 4) l.pop(); l.push(id); }
          PatOS.setSetting(key, l); dockBtn.textContent = inDock(id) ? 'Remove from Dock' : 'Add to Dock';
        };
        const hideBtn = h('button', { class: 'btn' }, isHidden(id) ? 'Show App' : 'Hide App');
        hideBtn.onclick = () => { const l = (PatOS.settings.hiddenApps || []).slice(); PatOS.setSetting('hiddenApps', isHidden(id) ? l.filter((x) => x !== id) : [...l, id]); hideBtn.textContent = isHidden(id) ? 'Show App' : 'Hide App'; };
        main.append(h('button', { class: 'btn as-back', onclick: render }, '‹ Back'),
          h('div', { class: 'as-detail' }, h('div', { class: 'as-dic', html: PatOS.iconHTML(a.icon || id) }),
            h('div', {}, h('h1', {}, a.name), h('p', { class: 'as-cat' }, a.category || 'Apps'),
              h('div', { class: 'as-btns' }, h('button', { class: 'btn primary', onclick: () => PatOS.launch(id) }, a.action ? 'Open in New Tab' : 'Open'), a.action ? null : dockBtn, hideBtn))),
          h('p', { class: 'as-desc' }, BLURB[id] || a.about || 'Part of PatOS.'),
          a.keywords ? h('div', { class: 'as-tags' }, ...a.keywords.split(' ').slice(0, 6).map((k) => h('span', {}, k))) : null);
      }
      function render() {
        [...seg.children].forEach((b) => b.classList.toggle('on', b.dataset.k === tab));
        main.innerHTML = '';
        const ids = PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden && id !== 'appstore');
        if (q) { main.appendChild(h('h2', {}, 'Results')); const g = h('div', { class: 'as-list' }); ids.filter((id) => (PatOS.apps[id].name + ' ' + (PatOS.apps[id].keywords || '')).toLowerCase().includes(q)).forEach((id) => g.appendChild(row(id))); main.appendChild(g); return; }
        if (tab === 'discover') {
          const hero = h('div', { class: 'as-hero' });
          FEATURED.filter((id) => PatOS.apps[id]).forEach((id, i) => {
            const a = PatOS.apps[id];
            const card = h('div', { class: 'as-card', style: { background: GRADS[i % GRADS.length], animationDelay: i * 80 + 'ms' } }, h('small', {}, i === 0 ? 'APP OF THE DAY' : 'FEATURED'), h('h2', {}, a.name), h('p', {}, BLURB[id]), h('div', { class: 'as-cic', html: PatOS.iconHTML(a.icon || id) }));
            card.onclick = () => detail(id); hero.appendChild(card);
          });
          main.append(h('h1', { class: 'as-h1' }, 'Discover'), hero, h('h2', {}, 'Essentials'));
          const g = h('div', { class: 'as-list' }); ['browser', 'notes', 'music', 'messages', 'terminal', 'typing', 'flashcards', 'piano'].filter((id) => PatOS.apps[id]).forEach((id) => g.appendChild(row(id))); main.appendChild(g);
          const hidden = PatOS.settings.hiddenApps || [];
          if (hidden.length) { main.appendChild(h('h2', {}, 'Hidden Apps')); const g2 = h('div', { class: 'as-list' }); hidden.filter((id) => PatOS.apps[id]).forEach((id) => g2.appendChild(row(id))); main.appendChild(g2); }
          return;
        }
        const cat = { games: '3D & Games', google: 'Google' }[tab];
        main.appendChild(h('h1', { class: 'as-h1' }, cat || 'All Apps'));
        const g = h('div', { class: 'as-list' }); ids.filter((id) => !cat || PatOS.apps[id].category === cat).forEach((id) => g.appendChild(row(id))); main.appendChild(g);
      }
      win._detail = detail;
      render();
    },
    onArgs(win, a) { if (a.app && win._detail) win._detail(a.app); }
  });
})();
