/* App Store — browse every PatOS app, open it, pin it, hide or show it */
(function () {
  'use strict';
  const { h } = PatOS;
  const BLURB = {
    galaxy: 'Build your own spiral galaxy with up to 150,000 stars, then set off supernovas.',
    orbrunner: 'Race a glowing orb down a neon highway. Dodge blocks, grab gems, beat your best.',
    studio: 'Drop shapes into a 3D scene, paint them, make them spin and snap a picture.',
    code: 'Write HTML, CSS and JavaScript and watch your page update as you type.',
    messages: 'Type commands to Pat to open apps, do math and add reminders. A simple command helper, not an AI.',
    piano: 'Play two octaves with your keyboard or fingers, record a melody and play it back.',
    flashcards: 'Make decks for any class and study them with cards that flip in 3D.',
    music: 'Play your own songs with playlists and a queue, or let your computer compose some.',
    typing: 'Measure your typing speed and accuracy and watch your best score climb.',
    voicememos: 'Record your voice, see the waveform and play it back later.',
    browser: 'Tabs, bookmarks and history. Searches open in your real browser, YouTube links in the YouTube app.',
    terminal: 'A real little shell: ls, cd, cat, mkdir, neofetch, matrix and more.',
    docs: 'Write essays and reports with headings, fonts, lists, tables and pictures. Saves as you type.',
    sheets: 'Spreadsheets with real formulas: SUM, AVERAGE, IF, COUNTIF and more, plus charts.',
    slides: 'Build a slide deck with themes and transitions, then present it full screen.',
    drive: 'Every document, spreadsheet, presentation and form you make, in one place.',
    forms: 'Make a survey or a graded quiz, answer it, and see the results as charts.',
    translate: 'Translate between 20 languages and hear the result read aloud.',
    youtube: 'Search and watch YouTube with the real YouTube player, without leaving PatOS.',
    contacts: 'Keep your friends’ phone numbers, emails and birthdays. PatOS reminds you on their birthday.',
    freeform: 'An endless whiteboard: draw, drop sticky notes, text, shapes and pictures.',
    preview: 'Read PDFs and pictures. Highlight, draw and add text to a PDF, then save it.',
    chess: 'Real chess with every rule, against the computer (3 levels) or a friend.',
    screenshot: 'Take a picture of your screen or record it as a video.',
    calculator: 'A basic calculator and a scientific one with sin, cos, logs, powers and more.',
    clock: 'World clocks, alarms, a stopwatch and a timer.',
    grapher: 'A graphing calculator: graph equations and inequalities, use sliders, and find roots and crossing points.',
    elements: 'The whole periodic table with details on every element, plus a molar mass calculator.',
    focus: 'Work in 25-minute sessions with breaks, rain sounds and stats on your study time.',
    journal: 'Write a page a day, track your mood and keep your streak going.',
    sudoku: 'Fresh Sudoku puzzles at three levels, with notes, hints and undo.',
    news: 'Live headlines from NPR, Al Jazeera, Engadget, Space.com, NASA, Radio-Canada and La Presse.',
    books: 'Read thousands of free classic books in a reader that turns pages like a real book.',
    radio: 'Thousands of live radio stations from around the world, with favorites.',
    videos: 'Watch your own video files, with speed control and Picture in Picture.',
    solitaire: 'Classic Klondike solitaire. Drag or tap cards, draw 1 or 3, undo and auto-finish.'
  };
  const FEATURED = ['docs', 'studio', 'orbrunner', 'code'];
  const GRADS = ['linear-gradient(135deg,#3a1c71,#d76d77,#ffaf7b)', 'linear-gradient(135deg,#0b0130,#ff2fa3)', 'linear-gradient(135deg,#1e1e2e,#5b5bd6)', 'linear-gradient(135deg,#0bbf3a,#00a6fb)'];
  PatOS.registerApp({
    id: 'appstore', name: 'App Store', icon: 'appstore', width: 940, height: 640, category: 'Utilities', keywords: 'apps install store download',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let tab = 'discover', q = '';
      const seg = h('div', { class: 'seg' });
      [['discover', 'Discover'], ['phone', 'Phone & Web'], ['office', 'Office'], ['games', '3D & Games'], ['community', 'Community'], ['develop', 'Develop'], ['all', 'All Apps']].forEach(([k, l]) => seg.appendChild(h('button', { class: 'tab', 'data-k': k, onclick: () => { tab = k; render(); } }, l)));
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
      /* ---------- phone & web apps (Snapchat, Instagram, ...) ---------- */
      const X = PatOS.extApps;
      function howItOpens(c) {
        const d = X.device();
        if (d.kind === 'ios') return PatOS.t('On your') + ' ' + d.name + ': ' + PatOS.t('opens the app, or the App Store if it isn’t installed.');
        if (d.kind === 'android') return PatOS.t('On your') + ' ' + d.name + ': ' + PatOS.t('opens the app, or Google Play if it isn’t installed.');
        return PatOS.t('On your') + ' ' + d.name + ': ' + (c.frame ? PatOS.t('opens the website inside PatOS.') : PatOS.t('opens the website in its own app window.'));
      }
      function getBtn(c, after) {
        const b = h('button', { class: 'as-get' }, X.isInstalled(c.id) ? PatOS.t('OPEN') : PatOS.t('GET'));
        b.onclick = (e) => {
          e.stopPropagation();
          if (X.isInstalled(c.id)) { X.open(c.id); return; }
          b.disabled = true; b.classList.add('loading'); b.textContent = '';
          setTimeout(() => { X.install(c.id); PatOS.sound.pop(); b.disabled = false; b.classList.remove('loading'); b.textContent = PatOS.t('OPEN'); PatOS.notify({ title: c.name + ' ' + PatOS.t('is installed'), body: PatOS.t('Find it on your Home Screen or in Launchpad.'), icon: 'x-' + c.id }); if (after) after(); }, 900);
        };
        return b;
      }
      function xrow(c) {
        const el = h('div', { class: 'as-row' }, h('div', { class: 'as-ic', html: PatOS.iconHTML('x-' + c.id) }), h('div', { class: 'as-txt' }, h('b', {}, c.name), h('small', {}, PatOS.t(c.cat))), getBtn(c));
        el.onclick = () => xdetail(c);
        return el;
      }
      function xdetail(c) {
        main.innerHTML = '';
        const id = 'x-' + c.id;
        const btns = h('div', { class: 'as-btns' });
        const paint = () => {
          btns.innerHTML = '';
          btns.appendChild(getBtn(c, paint));
          if (X.isInstalled(c.id)) {
            const dockBtn = h('button', { class: 'btn' }, inDock(id) ? PatOS.t('Remove from Dock') : PatOS.t('Add to Dock'));
            dockBtn.onclick = () => { const key = PatOS.isMobile ? 'mobileDock' : 'dockPinned'; let l = PatOS.settings[key].slice(); if (l.includes(id)) l = l.filter((x) => x !== id); else { if (key === 'mobileDock' && l.length >= 4) l.pop(); l.push(id); } PatOS.setSetting(key, l); paint(); };
            btns.append(dockBtn, h('button', { class: 'btn danger', onclick: () => { X.uninstall(c.id); paint(); } }, PatOS.t('Remove')));
          }
        };
        paint();
        const d = X.device();
        main.append(h('button', { class: 'btn as-back', onclick: render }, '‹ ' + PatOS.t('Back')),
          h('div', { class: 'as-detail' }, h('div', { class: 'as-dic', html: PatOS.iconHTML(id) }), h('div', {}, h('h1', {}, c.name), h('p', { class: 'as-cat' }, PatOS.t(c.cat)), btns)),
          h('p', { class: 'as-desc' }, howItOpens(c)),
          h('div', { class: 'as-how' },
            h('div', {}, h('b', {}, 'iPhone / iPad'), h('small', {}, PatOS.t('The app, or its App Store page'))),
            h('div', {}, h('b', {}, 'Android / Samsung'), h('small', {}, PatOS.t('The app, or its Google Play page'))),
            h('div', {}, h('b', {}, PatOS.t('Computer')), h('small', {}, c.web.replace(/^https:\/\//, '').replace(/\/$/, '')))),
          d.kind === 'computer' ? h('div', { class: 'as-btns', style: { marginTop: '10px' } },
            h('button', { class: 'btn', onclick: () => PatOS.openExternal('https://apps.apple.com/app/id' + c.appStore) }, PatOS.t('See on the App Store')),
            h('button', { class: 'btn', onclick: () => PatOS.openExternal('https://play.google.com/store/apps/details?id=' + c.pkg) }, PatOS.t('See on Google Play'))) : null);
      }
      function phoneTab() {
        const d = X.device();
        main.appendChild(h('h1', { class: 'as-h1' }, PatOS.t('Phone & Web')));
        main.appendChild(h('p', { class: 'as-note' }, (d.kind === 'computer' ? PatOS.t('You’re on a computer:') + ' ' + d.name : PatOS.t('You’re on') + ' ' + d.name) + '. ' + (d.kind === 'computer' ? PatOS.t('These apps open their websites. On a phone they open the real apps.') : PatOS.t('These open the real apps on your phone, or the store page if you don’t have them yet.'))));
        const list = X.list().filter((c) => !q || (c.name + ' ' + c.cat).toLowerCase().includes(q));
        const mine = list.filter((c) => X.isInstalled(c.id));
        if (mine.length) { main.appendChild(h('h2', {}, PatOS.t('Installed'))); const g = h('div', { class: 'as-list' }); mine.forEach((c) => g.appendChild(xrow(c))); main.appendChild(g); }
        const cats = [...new Set(list.map((c) => c.cat))];
        cats.forEach((cat) => { const items = list.filter((c) => c.cat === cat && !X.isInstalled(c.id)); if (!items.length) return; main.appendChild(h('h2', {}, PatOS.t(cat))); const g = h('div', { class: 'as-list' }); items.forEach((c) => g.appendChild(xrow(c))); main.appendChild(g); });
      }
      function render() {
        [...seg.children].forEach((b) => b.classList.toggle('on', b.dataset.k === tab));
        main.innerHTML = '';
        const ids = PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden && id !== 'appstore');
        if (q && tab !== 'phone') { if (X) { const xs = X.list().filter((c) => (c.name + ' ' + c.cat).toLowerCase().includes(q)); if (xs.length) { main.appendChild(h('h2', {}, PatOS.t('Phone & Web'))); const gx = h('div', { class: 'as-list' }); xs.forEach((c) => gx.appendChild(xrow(c))); main.appendChild(gx); } } main.appendChild(h('h2', {}, 'Results')); const g = h('div', { class: 'as-list' }); ids.filter((id) => (PatOS.apps[id].name + ' ' + (PatOS.apps[id].keywords || '')).toLowerCase().includes(q)).forEach((id) => g.appendChild(row(id))); main.appendChild(g); return; }
        if (tab === 'community' && PatOS.patappsUI) { PatOS.patappsUI.community(main, q, render); return; }
        if (tab === 'develop' && PatOS.patappsUI) { PatOS.patappsUI.develop(main, render); return; }
        if (tab === 'phone' && X) { phoneTab(); return; }
        if (tab === 'discover') {
          const hero = h('div', { class: 'as-hero' });
          FEATURED.filter((id) => PatOS.apps[id]).forEach((id, i) => {
            const a = PatOS.apps[id];
            const card = h('div', { class: 'as-card', style: { background: GRADS[i % GRADS.length], animationDelay: i * 80 + 'ms' } }, h('small', {}, i === 0 ? 'APP OF THE DAY' : 'FEATURED'), h('h2', {}, a.name), h('p', {}, BLURB[id]), h('div', { class: 'as-cic', html: PatOS.iconHTML(a.icon || id) }));
            card.onclick = () => detail(id); hero.appendChild(card);
          });
          main.append(h('h1', { class: 'as-h1' }, 'Discover'), hero, h('h2', {}, 'Essentials'));
          const g = h('div', { class: 'as-list' }); ['browser', 'youtube', 'news', 'books', 'radio', 'docs', 'focus', 'grapher', 'elements', 'solitaire', 'chess', 'sudoku'].filter((id) => PatOS.apps[id]).forEach((id) => g.appendChild(row(id))); main.appendChild(g);
          if (X) { main.appendChild(h('h2', {}, PatOS.t('Popular on phones'))); const gx = h('div', { class: 'as-list' }); ['snapchat', 'instagram', 'tiktok', 'spotify', 'roblox', 'whatsapp'].map((k) => X.list().find((c) => c.id === k)).filter(Boolean).forEach((c) => gx.appendChild(xrow(c))); main.appendChild(gx); main.appendChild(h('button', { class: 'btn', onclick: () => { tab = 'phone'; render(); } }, PatOS.t('See all phone & web apps'))); }
          const hidden = PatOS.settings.hiddenApps || [];
          if (hidden.length) { main.appendChild(h('h2', {}, 'Hidden Apps')); const g2 = h('div', { class: 'as-list' }); hidden.filter((id) => PatOS.apps[id]).forEach((id) => g2.appendChild(row(id))); main.appendChild(g2); }
          return;
        }
        const cat = { games: '3D & Games', office: 'Office' }[tab];
        main.appendChild(h('h1', { class: 'as-h1' }, cat || 'All Apps'));
        const g = h('div', { class: 'as-list' }); ids.filter((id) => !cat || PatOS.apps[id].category === cat).forEach((id) => g.appendChild(row(id))); main.appendChild(g);
      }
      win._detail = detail;
      win._tab = (t) => { tab = t; render(); };
      if (args && args.tab) tab = args.tab;
      render();
    },
    onArgs(win, a) { if (a.app && win._detail) win._detail(a.app); if (a.tab && win._tab) win._tab(a.tab); }
  });
})();
