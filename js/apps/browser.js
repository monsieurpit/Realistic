/* Surf — tabbed web browser */
(function () {
  'use strict';
  const { h, esc } = PatOS;
  const BLOCKED = ['youtube.com', 'mail.google.com', 'docs.google.com', 'drive.google.com', 'classroom.google.com', 'meet.google.com', 'calendar.google.com', 'accounts.google.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'github.com', 'reddit.com', 'amazon.', 'netflix.com', 'tiktok.com', 'discord.com', 'chatgpt.com', 'openai.com', 'claude.ai',
    'microsoft.com', 'office.com', 'live.com', 'outlook.', 'linkedin.com', 'spotify.com', 'twitch.tv', 'apple.com', 'stackoverflow.com', 'canva.com', 'quizlet.com', 'kahoot', 'khanacademy.org', 'duckduckgo.com', 'roblox.com', 'scratch.mit.edu', 'pinterest.', 'translate.google.com', 'photos.google.com', 'keep.google.com', 'forms.google.com'];
  const DEFAULT_BM = [
    { t: 'Google', u: 'https://www.google.com/webhp?igu=1' },
    { t: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/Main_Page' },
    { t: 'three.js', u: 'https://threejs.org/examples/' },
    { t: 'Maps', u: 'https://www.openstreetmap.org/export/embed.html?bbox=-74.2%2C45.3%2C-73.3%2C45.8&layer=mapnik' },
    { t: 'Internet Archive', u: 'https://archive.org' }
  ];
  const SHORTCUTS = [
    { t: 'Google', u: 'https://www.google.com/webhp?igu=1', i: 'search' },
    { t: 'YouTube', u: 'https://www.youtube.com', i: 'youtube' },
    { t: 'Gmail', u: 'https://mail.google.com', i: 'gmail' },
    { t: 'Classroom', u: 'https://classroom.google.com', i: 'classroom' },
    { t: 'Drive', u: 'https://drive.google.com', i: 'drive' },
    { t: 'Docs', u: 'https://docs.google.com', i: 'docs' },
    { t: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/Main_Page', i: 'W' },
    { t: 'three.js', u: 'https://threejs.org/examples/', i: '3' }
  ];

  function isBlocked(url) { if (PatOS.sandboxed && !/^patos:/.test(url)) return true; try { const host = new URL(url).hostname; return BLOCKED.some((b) => host === b || host.endsWith('.' + b) || (b.endsWith('.') && host.includes(b))); } catch (e) { return false; } }
  function ytEmbed(url) {
    try {
      const u = new URL(url);
      let id = null;
      if (u.hostname.endsWith('youtu.be')) id = u.pathname.slice(1);
      else if (u.hostname.includes('youtube.com') && u.pathname === '/watch') id = u.searchParams.get('v');
      else if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2];
      return id ? 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1' : null;
    } catch (e) { return null; }
  }
  function toURL(q) {
    q = q.trim();
    if (!q) return 'patos://newtab';
    if (/^patos:\/\//.test(q)) return q;
    if (/^https?:\/\//i.test(q)) return q;
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(q) && !q.includes(' ')) return 'https://' + q;
    return 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(q);
  }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }
  PatOS.openExternal = (url) => {
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  };

  PatOS.registerApp({
    id: 'browser', name: 'Surf', icon: 'browser', single: true, width: 1040, height: 680, keywords: 'chrome safari web internet browser google',
    about: 'A tabbed web browser. Some sites (like Gmail or YouTube) refuse to load inside other pages — Surf opens those in a real browser tab.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'browser-win');
      const tabs = []; let cur = null;
      let bookmarks = PatOS.store.get('bookmarks', DEFAULT_BM);
      const tabStrip = h('div', { class: 'br-tabs' });
      const addTab = h('button', { class: 'br-newtab', title: 'New tab' }, '+');
      win.toolbar.append(tabStrip, addTab);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '64px';
      win.titlebar.style.height = '38px';

      const bBack = h('button', { class: 'tbtn', title: 'Back' }, '‹');
      const bFwd = h('button', { class: 'tbtn', title: 'Forward' }, '›');
      const bReload = h('button', { class: 'tbtn', title: 'Reload' }, '↻');
      const bHome = h('button', { class: 'tbtn', title: 'Home' }, '⌂');
      const omni = h('input', { class: 'br-omni', placeholder: 'Search Google or type a URL', spellcheck: 'false' });
      const lockIc = h('span', { class: 'br-lock' }, '🔒');
      const bStar = h('button', { class: 'tbtn', title: 'Bookmark this page' }, '☆');
      const bExt = h('button', { class: 'tbtn', title: 'Open in a real browser tab' }, '↗');
      const nav = h('div', { class: 'br-nav' }, bBack, bFwd, bReload, bHome, h('div', { class: 'br-omniwrap' }, lockIc, omni), bStar, bExt);
      const bmBar = h('div', { class: 'br-bm' });
      const view = h('div', { class: 'br-view' });
      win.body.append(nav, bmBar, view);

      function renderBM() {
        bmBar.innerHTML = '';
        bookmarks.forEach((b, i) => {
          const el = h('button', { class: 'br-bmi', title: b.u }, h('span', { class: 'br-fav' }, (b.t[0] || '?').toUpperCase()), b.t);
          el.onclick = () => navigate(b.u);
          el.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); PatOS.menu([{ label: 'Open in New Tab', action: () => newTab(b.u) }, { label: 'Delete Bookmark', action: () => { bookmarks.splice(i, 1); PatOS.store.set('bookmarks', bookmarks); renderBM(); } }], e.clientX, e.clientY); };
          bmBar.appendChild(el);
        });
      }
      function newTab(url, html, title) {
        const t = { id: PatOS.uid(), url: 'patos://newtab', title: 'New Tab', hist: [], idx: -1, pane: h('div', { class: 'br-pane' }), tabEl: null };
        t.tabEl = h('div', { class: 'tab br-tab' }, h('span', { class: 'br-tt' }, 'New Tab'), h('button', { class: 'br-tx', title: 'Close tab' }, '×'));
        t.tabEl.addEventListener('click', (e) => { if (e.target.classList.contains('br-tx')) closeTab(t); else select(t); });
        t.tabEl.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(t); });
        tabStrip.appendChild(t.tabEl); view.appendChild(t.pane); tabs.push(t);
        select(t);
        if (html) loadHTML(t, html, title); else navigate(url || 'patos://newtab', t);
        return t;
      }
      function closeTab(t) {
        const i = tabs.indexOf(t); tabs.splice(i, 1); t.tabEl.remove(); t.pane.remove();
        if (!tabs.length) { win.close(); return; }
        if (cur === t) select(tabs[Math.min(i, tabs.length - 1)]);
      }
      function select(t) {
        cur = t; tabs.forEach((x) => { x.tabEl.classList.toggle('on', x === t); x.pane.style.display = x === t ? '' : 'none'; });
        syncUI();
      }
      function syncUI() {
        if (!cur) return;
        omni.value = cur.url === 'patos://newtab' ? '' : cur.url;
        lockIc.textContent = cur.url.startsWith('https') ? '🔒' : cur.url.startsWith('patos') ? '🔍' : 'ⓘ';
        bBack.disabled = cur.idx <= 0; bFwd.disabled = cur.idx >= cur.hist.length - 1;
        bStar.textContent = bookmarks.some((b) => b.u === cur.url) ? '★' : '☆';
        cur.tabEl.querySelector('.br-tt').textContent = cur.title;
        win.setTitle(cur.title);
      }
      function navigate(input, t, noHist) {
        t = t || cur;
        let url = toURL(input);
        const yt = ytEmbed(url); if (yt) url = yt;
        if (!noHist) { t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(url); t.idx = t.hist.length - 1; }
        t.url = url;
        t.pane.innerHTML = '';
        if (url === 'patos://newtab') { t.title = 'New Tab'; t.pane.appendChild(newTabPage()); }
        else if (isBlocked(url)) { t.title = host(url); t.pane.appendChild(blockedPage(url)); }
        else {
          t.title = url.includes('google.com/search') ? (new URL(url).searchParams.get('q') + ' - Search') : host(url);
          const loader = h('div', { class: 'br-loading' });
          const frame = h('iframe', { src: url, allow: 'fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: true });
          frame.addEventListener('load', () => { loader.remove(); try { const d = frame.contentDocument; if (d && d.title) { t.title = d.title; syncUI(); } } catch (e) {} });
          t.pane.append(loader, frame);
          setTimeout(() => loader.remove(), 8000);
        }
        if (t === cur) syncUI(); else t.tabEl.querySelector('.br-tt').textContent = t.title;
      }
      function loadHTML(t, html, title) {
        t.url = 'patos://file'; t.title = title || 'Document'; t.hist = [t.url]; t.idx = 0;
        t.pane.innerHTML = ''; t.pane.appendChild(h('iframe', { srcdoc: html, sandbox: 'allow-scripts allow-forms allow-modals' })); syncUI();
      }
      function newTabPage() {
        const q = h('input', { class: 'nt-search', placeholder: 'Search Google or type a URL', spellcheck: 'false' });
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(q.value); });
        const grid = h('div', { class: 'nt-grid' });
        SHORTCUTS.forEach((s) => {
          const tile = h('button', { class: 'nt-tile' }, h('div', { class: 'nt-ic', html: PatOS.iconDefs[s.i] ? PatOS.iconHTML(s.i) : `<div class="nt-letter">${esc(s.i)}</div>` }), h('span', {}, s.t));
          tile.onclick = () => navigate(s.u); grid.appendChild(tile);
        });
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        setTimeout(() => q.focus(), 50);
        return h('div', { class: 'nt-page' },
          h('div', { class: 'nt-logo' }, h('span', { style: { color: '#4285f4' } }, 'S'), h('span', { style: { color: '#ea4335' } }, 'u'), h('span', { style: { color: '#fbbc05' } }, 'r'), h('span', { style: { color: '#34a853' } }, 'f')),
          h('div', { class: 'nt-greet' }, greet + ', ' + PatOS.settings.userName),
          q, grid,
          h('div', { class: 'nt-tip' }, 'Tip: sites like Gmail, Docs and YouTube open in a real browser tab because they block being shown inside other pages. YouTube video links play right here!'));
      }
      function blockedPage(url) {
        return h('div', { class: 'br-blocked' },
          h('div', { class: 'bb-ic' }, '🧱'),
          h('h2', {}, host(url) + ' can’t be shown inside PatOS'),
          h('p', {}, PatOS.sandboxed ? 'PatOS is running inside a Claude Artifact, which can’t show other websites inside it. Open the page in a real browser tab instead. PatOS stays open in this one.' : 'This website blocks being displayed inside other pages (for your security). You can open it in a real browser tab instead. PatOS stays open in this one.'),
          h('a', { class: 'btn primary br-ext', href: url.replace('youtube-nocookie.com/embed/', 'youtube.com/watch?v=').replace('?autoplay=1', '').replace('igu=1&', '').replace('?igu=1', ''), target: '_blank', rel: 'noopener noreferrer' }, 'Open ' + host(url) + ' in a new tab'));
      }
      omni.addEventListener('keydown', (e) => { if (e.key === 'Enter') { navigate(omni.value); omni.blur(); } });
      omni.addEventListener('focus', () => omni.select());
      bBack.onclick = () => { if (cur.idx > 0) { cur.idx--; navigate(cur.hist[cur.idx], cur, true); } };
      bFwd.onclick = () => { if (cur.idx < cur.hist.length - 1) { cur.idx++; navigate(cur.hist[cur.idx], cur, true); } };
      bReload.onclick = () => navigate(cur.url, cur, true);
      bHome.onclick = () => navigate('patos://newtab');
      bExt.onclick = () => { if (!cur.url.startsWith('patos')) PatOS.openExternal(cur.url.replace('youtube-nocookie.com/embed/', 'youtube.com/watch?v=').replace('?autoplay=1', '').replace('igu=1&', '')); };
      bStar.onclick = () => {
        if (cur.url.startsWith('patos')) return;
        const i = bookmarks.findIndex((b) => b.u === cur.url);
        if (i >= 0) bookmarks.splice(i, 1); else bookmarks.push({ t: cur.title.slice(0, 24), u: cur.url });
        PatOS.store.set('bookmarks', bookmarks); renderBM(); syncUI();
      };
      addTab.onclick = () => newTab();
      win._open = (a) => { if (a.html) newTab(null, a.html, a.title); else if (a.url) { if (cur && cur.url === 'patos://newtab') navigate(a.url); else newTab(a.url); } };
      win.body.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 't') { e.preventDefault(); e.stopPropagation(); newTab(); }
      });
      renderBM();
      if (args.html) newTab(null, args.html, args.title); else newTab(args.url);
    },
    onArgs(win, args) { win._open && win._open(args); },
    menus(win) {
      return { file: [
        { label: 'New Tab', action: () => win._open({ url: 'patos://newtab' }) },
        { label: 'New Window', action: () => PatOS.launch('browser') },
        { divider: true },
        { label: 'Close Window', action: () => win.close() }
      ] };
    }
  });
})();
