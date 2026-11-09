/* Patoogle — tabbed web browser with Google search, suggestions, history, and saved passwords */
(function () {
  'use strict';
  const { h, esc } = PatOS;
  const T = (s) => PatOS.t(s);
  const BLOCKED = ['youtube.com', 'mail.google.com', 'docs.google.com', 'drive.google.com', 'classroom.google.com', 'meet.google.com', 'calendar.google.com', 'accounts.google.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'github.com', 'reddit.com', 'amazon.', 'netflix.com', 'tiktok.com', 'discord.com', 'chatgpt.com', 'openai.com', 'claude.ai',
    'microsoft.com', 'office.com', 'live.com', 'outlook.', 'linkedin.com', 'spotify.com', 'twitch.tv', 'apple.com', 'stackoverflow.com', 'canva.com', 'quizlet.com', 'kahoot', 'khanacademy.org', 'duckduckgo.com', 'roblox.com', 'scratch.mit.edu', 'pinterest.', 'translate.google.com', 'photos.google.com', 'keep.google.com', 'forms.google.com'];
  const DEFAULT_BM = [
    { t: 'Patoogle', u: 'patos://newtab' },
    { t: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/Main_Page' },
    { t: 'three.js', u: 'https://threejs.org/examples/' },
    { t: 'Maps', u: 'https://www.openstreetmap.org/export/embed.html?bbox=-74.2%2C45.3%2C-73.3%2C45.8&layer=mapnik' },
    { t: 'Internet Archive', u: 'https://archive.org' }
  ];
  const SHORTCUTS = [
    { t: 'Google', u: 'https://www.google.com/webhp?igu=1', i: 'search' },
    { t: 'Classroom', u: 'https://classroom.google.com/' },
    { t: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/Main_Page', i: 'W' },
    { t: 'YouTube', app: 'youtube', i: 'youtube' },
    { t: 'Docs', app: 'docs', i: 'docs' },
    { t: 'Drive', app: 'drive', i: 'drive' },
    { t: 'Translate', app: 'translate', i: 'translate' },
    { t: 'Maps', app: 'maps', i: 'maps' },
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
    return searchURL(q);
  }
  /* Searching. A search typed in Patoogle opens in the device's own browser (Chrome, Safari…) with
     Google or Bing, and Patoogle closes: Google doesn't allow its results page inside other apps, and
     the real browser keeps your Google account, history and extensions. */
  let serverCx = '';
  const googleCx = () => (PatOS.store.get('googleCx', '') || '').trim() || serverCx;
  const engine = () => (PatOS.store.get('searchEngine', 'google') === 'bing' ? 'bing' : 'google');
  const glang = () => (PatOS.lang === 'fr' ? 'fr' : 'en');
  function googleURL(q) { return 'https://www.google.com/search?igu=1&hl=' + glang() + '&q=' + encodeURIComponent(q); }
  function searchURL(q) {
    const e = engine();
    if (e === 'cse') return 'patos://google?q=' + encodeURIComponent(q);
    if (e === 'patoogle') return 'patos://search?q=' + encodeURIComponent(q);
    if (e === 'bing') return bingURL(q);
    return googleURL(q);
  }
  const isGoogleFrame = (url) => /^https:\/\/www\.google\.[a-z.]+\/(search|webhp)\?(.*&)?igu=1/.test(url);
  if (/^https?:/.test(location.protocol) && !PatOS.sandboxed) fetch('/api/config', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j && j.googleCx) serverCx = String(j.googleCx); }).catch(() => {});
  function bingURL(q) { return 'https://www.bing.com/search?q=' + encodeURIComponent(q) + '&setlang=' + (PatOS.lang || 'en'); }
  let cseState = null; // { cx, ready: Promise }
  function loadCSE(cx) {
    if (cseState && cseState.cx === cx) return cseState.ready;
    if (cseState && cseState.cx !== cx) return Promise.reject(new Error('restart'));
    const ready = new Promise((resolve, reject) => {
      window.__gcse = { parsetags: 'explicit', callback: () => resolve(window.google.search.cse.element) };
      const sc = document.createElement('script'); sc.async = true; sc.src = 'https://cse.google.com/cse.js?cx=' + encodeURIComponent(cx);
      sc.onerror = () => { cseState = null; reject(new Error('offline')); };
      document.head.appendChild(sc);
      setTimeout(() => reject(new Error('timeout')), 15000);
    });
    cseState = { cx, ready };
    return ready;
  }
  function fixGoogle(url) {
    try {
      const u = new URL(url);
      if (!/(^|\.)google\.[a-z.]+$/.test(u.hostname) || !/^www\.|^google\./.test(u.hostname)) return url;
      if (u.searchParams.get('igu') === '1') return url;
      if (u.pathname === '/search' && u.searchParams.get('q')) return engine() === 'cse' ? searchURL(u.searchParams.get('q')) : googleURL(u.searchParams.get('q'));
      if (u.pathname === '/' || u.pathname === '/webhp') return 'https://www.google.com/webhp?igu=1&hl=' + glang();
    } catch (e) {}
    return url;
  }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }
  const favicon = (url) => { try { const u = new URL(url); return /^https?:/.test(u.protocol) ? 'https://www.google.com/s2/favicons?sz=32&domain=' + u.hostname : null; } catch (e) { return null; } };
  /* If a web page inside Patoogle ever tries to replace the whole PatOS page, the browser asks first. */
  let webTabs = 0;
  window.addEventListener('beforeunload', (e) => { if (webTabs > 0 && !PatOS._leaving) { e.preventDefault(); e.returnValue = ''; } });
  PatOS.openExternal = (url) => {
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- password helper added to pages PatOS makes itself (your own HTML files) ----------
     It only listens for one thing: when you press Fill in Patoogle's key menu, it types your saved login
     into that page. It never reads or sends what you type. Real websites belong to another site and
     browsers don't let any page type into them, so for those the key menu copies the login instead. */
  const PW_HELPER = `<script>(function(){var P=parent;function f(){var p=document.querySelector('input[type=password]');if(!p)return null;var form=p.form||document;var u=form.querySelector('input[type=email],input[autocomplete=username],input[name*=user i],input[name*=mail i],input[type=text]');return{p:p,u:u}}
window.addEventListener('message',function(e){if(e.source!==P)return;var d=e.data||{};if(d.patosPw!=='fill')return;var x=f();if(!x)return;function set(el,v){if(!el)return;el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.style.background='#fff8c5';setTimeout(function(){el.style.background=''},1200)}set(x.u,d.username);set(x.p,d.password)});})();<\/script>`;

  PatOS.registerApp({
    id: 'browser', name: 'Patoogle', icon: 'browser', single: true, width: 1100, height: 720, keywords: 'chrome safari web internet browser google',
    about: 'A web browser with tabs, bookmarks and history. Searches open in your device’s own browser.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'browser-win', 'pb-win');
      const OF = PatOS.office;
      const tabs = []; let cur = null; const closed = [];
      let bookmarks = PatOS.store.get('bookmarks', DEFAULT_BM).map((b) => (/google\.com\/webhp(?!\?igu)/.test(b.u) || /^https:\/\/www\.bing\.com\/?$/.test(b.u) ? { t: 'Patoogle', u: 'patos://newtab' } : b));
      if (!bookmarks.some((b) => /google\.com\/webhp\?igu/.test(b.u))) bookmarks.splice(1, 0, { t: 'Google', u: 'https://www.google.com/webhp?igu=1' });
      const tabStrip = h('div', { class: 'br-tabs pb-tabs' });
      const addTab = h('button', { class: 'br-newtab pb-newtab', title: T('New tab') + ' (Alt+T)' }, '+');
      win.toolbar.append(tabStrip, addTab);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '72px';
      win.titlebar.style.height = '40px';

      const ic = (n) => OF.icon(n, 17);
      const bBack = h('button', { class: 'tbtn', title: T('Back') + ' (Alt+←)', html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>' });
      const bFwd = h('button', { class: 'tbtn', title: T('Forward') + ' (Alt+→)', html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>' });
      const bReload = h('button', { class: 'tbtn', title: T('Reload'), html: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>' });
      const bHome = h('button', { class: 'tbtn', title: T('Home'), html: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z"/></svg>' });
      const omni = h('input', { class: 'br-omni', placeholder: T('Search Google or type a web address'), spellcheck: 'false', autocomplete: 'off' });
      const lockIc = h('button', { class: 'br-lock pb-site', title: T('Site information'), html: PatOS.sym('lock') });
      const bKey = h('button', { class: 'pb-key', title: T('Saved passwords for this site'), html: ic('key') });
      const zoomTag = h('button', { class: 'pb-zoomtag', title: T('Reset zoom') });
      const bStar = h('button', { class: 'pb-star', title: T('Bookmark this page'), html: ic('star') });
      const sugg = h('div', { class: 'pb-sugg' });
      const omniWrap = h('div', { class: 'br-omniwrap pb-omni' }, lockIc, omni, zoomTag, bKey, bStar, sugg);
      const bPw = h('button', { class: 'tbtn', title: T('Passwords'), html: ic('key') });
      const bMenu = h('button', { class: 'tbtn', title: T('Menu'), html: ic('more') });
      const nav = h('div', { class: 'br-nav pb-nav' }, bBack, bFwd, bReload, bHome, omniWrap, bPw, bMenu);
      const bmBar = h('div', { class: 'br-bm' });
      const infobar = h('div', { class: 'pb-info' });
      const view = h('div', { class: 'br-view' });
      win.body.append(nav, bmBar, infobar, view);

      function renderBM() {
        bmBar.innerHTML = '';
        bookmarks.forEach((b, i) => {
          const el = h('button', { class: 'br-bmi', title: b.u, draggable: 'true' }, favicon(b.u) ? h('img', { class: 'br-fav img', src: favicon(b.u), alt: '', onerror: (e) => { e.target.replaceWith(h('span', { class: 'br-fav' }, (b.t[0] || '?').toUpperCase())); } }) : h('span', { class: 'br-fav' }, (b.t[0] || '?').toUpperCase()), b.t);
          el.onclick = (e) => (e.ctrlKey || e.metaKey ? newTab(b.u, null, null, true) : navigate(b.u));
          el.onauxclick = (e) => { if (e.button === 1) newTab(b.u, null, null, true); };
          el.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); PatOS.menu([{ label: T('Open in New Tab'), action: () => newTab(b.u) }, { label: T('Rename…'), action: async () => { const n = await PatOS.ask(T('Rename'), b.t, { icon: 'browser', ok: T('Rename') }); if (n) { b.t = n; saveBM(); } } }, { label: T('Delete Bookmark'), action: () => { bookmarks.splice(i, 1); saveBM(); } }], e.clientX, e.clientY); };
          el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/bm', i));
          el.addEventListener('dragover', (e) => e.preventDefault());
          el.addEventListener('drop', (e) => { e.preventDefault(); const from = +e.dataTransfer.getData('text/bm'); if (isNaN(from) || from === i) return; bookmarks.splice(i, 0, bookmarks.splice(from, 1)[0]); saveBM(); });
          bmBar.appendChild(el);
        });
      }
      function saveBM() { PatOS.store.set('bookmarks', bookmarks); renderBM(); syncUI(); }

      /* ---------- tabs ---------- */
      function newTab(url, html, title, background, at) {
        const t = { id: PatOS.uid(), url: 'patos://newtab', title: T('New Tab'), hist: [], idx: -1, pane: h('div', { class: 'br-pane' }), tabEl: null, zoom: 1, loading: false, gen: 0 };
        t.tabEl = h('div', { class: 'tab br-tab pb-tab', draggable: 'true' }, h('span', { class: 'br-tic none' }), h('span', { class: 'br-tt' }, T('New Tab')), h('button', { class: 'br-tx', title: T('Close tab') }, '×'));
        t.tabEl.addEventListener('click', (e) => { if (e.target.classList.contains('br-tx')) closeTab(t); else select(t); });
        t.tabEl.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(t); });
        t.tabEl.addEventListener('contextmenu', (e) => { e.preventDefault(); PatOS.menu([{ label: T('New tab'), action: () => newTab() }, { label: T('Reload'), action: () => navigate(t.url, t, true) }, { label: T('Duplicate'), action: () => newTab(t.url, null, null, false, tabs.indexOf(t) + 1) }, { divider: true }, { label: T('Close tab'), action: () => closeTab(t) }, { label: T('Close other tabs'), disabled: tabs.length < 2, action: () => tabs.slice().forEach((x) => x !== t && closeTab(x)) }, { label: T('Reopen closed tab'), disabled: !closed.length, action: reopen }], e.clientX, e.clientY); });
        t.tabEl.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/tab', t.id); t.tabEl.classList.add('dragging'); });
        t.tabEl.addEventListener('dragend', () => t.tabEl.classList.remove('dragging'));
        t.tabEl.addEventListener('dragover', (e) => e.preventDefault());
        t.tabEl.addEventListener('drop', (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/tab'); const from = tabs.findIndex((x) => x.id === id); const to = tabs.indexOf(t); if (from < 0 || from === to) return; const [m] = tabs.splice(from, 1); tabs.splice(to, 0, m); tabStrip.insertBefore(m.tabEl, from < to ? t.tabEl.nextSibling : t.tabEl); saveSession(); });
        if (at != null && tabs[at]) { tabStrip.insertBefore(t.tabEl, tabs[at].tabEl); tabs.splice(at, 0, t); } else { tabStrip.appendChild(t.tabEl); tabs.push(t); }
        view.appendChild(t.pane);
        requestAnimationFrame(() => t.tabEl.classList.add('in'));
        if (!background || !cur) select(t); else t.pane.style.display = 'none';
        if (html) loadHTML(t, html, title); else navigate(url || 'patos://newtab', t);
        return t;
      }
      function closeTab(t) {
        const i = tabs.indexOf(t); if (i < 0) return;
        if (t.url !== 'patos://newtab' && !t.url.startsWith('patos://file')) { closed.push({ url: t.url, at: i }); if (closed.length > 20) closed.shift(); }
        if (t.web) { webTabs--; t.web = false; }
        tabs.splice(i, 1); t.pane.remove();
        t.tabEl.classList.remove('in'); t.tabEl.classList.add('out'); setTimeout(() => t.tabEl.remove(), 180);
        if (!tabs.length) { win.close(); return; }
        if (cur === t) select(tabs[Math.min(i, tabs.length - 1)]);
        saveSession();
      }
      function reopen() { const c = closed.pop(); if (c) newTab(c.url, null, null, false, c.at); }
      function select(t) {
        cur = t; tabs.forEach((x) => { x.tabEl.classList.toggle('on', x === t); x.pane.style.display = x === t ? '' : 'none'; });
        syncUI(); checkLogin();
      }
      function syncUI() {
        if (!cur) return;
        if (document.activeElement !== omni) omni.value = cur.url === 'patos://newtab' ? '' : cur.url.startsWith('patos://file') ? '' : cur.url;
        const secure = cur.url.startsWith('https'), internal = cur.url.startsWith('patos');
        lockIc.innerHTML = internal ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>' : PatOS.sym(secure ? 'lock' : 'warn');
        lockIc.classList.toggle('warn', !secure && !internal);
        bBack.disabled = cur.idx <= 0; bFwd.disabled = cur.idx >= cur.hist.length - 1;
        const starred = bookmarks.some((b) => b.u === cur.url); bStar.classList.toggle('on', starred); bStar.style.display = internal ? 'none' : '';
        const site = siteOf(cur); const n = site && !PatOS.passwords.locked ? PatOS.passwords.forSite(site).length : 0;
        bKey.style.display = n ? '' : 'none'; bKey.dataset.n = n;
        zoomTag.textContent = cur.zoom !== 1 ? Math.round(cur.zoom * 100) + '%' : ''; zoomTag.style.display = cur.zoom !== 1 ? '' : 'none';
        cur.tabEl.querySelector('.br-tt').textContent = cur.title;
        tabs.forEach((t) => { const icn = t.tabEl.querySelector('.br-tic'); const f = favicon(t.url); icn.style.backgroundImage = f && !t.loading ? `url(${f})` : ''; icn.classList.toggle('none', !f && !t.loading); icn.classList.toggle('spin', t.loading); t.tabEl.title = t.title; });
        win.setTitle(cur.title);
      }
      const siteOf = (t) => (t.url.startsWith('patos://file') ? 'file:' + (t.fileKey || t.title) : /^https?:/.test(t.url) ? PatOS.passwords.hostOf(t.url) : null);
      const saveSession = PatOS.debounce(() => { PatOS.store.set('browserSession', { tabs: tabs.filter((t) => /^(https?|patos):/.test(t.url) && !t.url.startsWith('patos://file')).map((t) => t.url).slice(0, 12), active: Math.max(0, tabs.indexOf(cur)) }); }, 300);

      function navigate(input, t, noHist) {
        t = t || cur;
        // searches go to the Chromebook's own browser (Chrome, Safari, Edge...), where every site works
        const raw = String(input || '').trim();
        let gq = null;
        if (raw && !/^(patos|https?):\/\//i.test(raw) && !(/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(raw) && !raw.includes(' '))) gq = raw;
        else if (/^https?:\/\/(www\.)?(google\.[a-z.]+\/search|bing\.com\/search)\?/i.test(raw)) { try { gq = new URL(raw).searchParams.get('q'); } catch (e) {} }
        else if (/^patos:\/\/(google|search)\?/.test(raw)) { try { gq = new URL(raw.replace('patos://', 'http://x/')).searchParams.get('q'); } catch (e) {} }
        if (gq && !noHist && PatOS.isOffline()) {
          if (t.web) { webTabs--; t.web = false; }
          t.pane.innerHTML = ''; t.frame = null; t.loading = false; t.title = gq; t.url = 'patos://newtab';
          t.pane.appendChild(PatOS.offlineCard(() => navigate(raw, t), { auto: false, body: 'Searching needs the internet. Connect to Wi-Fi, then press Try again.' }));
          syncUI(); return;
        }
        if (gq && !noHist) {
          const H = PatOS.store.get('browserHistory', []); H.unshift({ u: 'https://www.google.com/search?q=' + encodeURIComponent(gq), t: Date.now(), title: gq }); PatOS.store.set('browserHistory', H.slice(0, 300));
          PatOS.openExternal(engine() === 'bing' ? bingURL(gq) : 'https://www.google.com/search?q=' + encodeURIComponent(gq) + '&hl=' + glang());
          setTimeout(() => win.close(), 50); return;
        }
        let url = fixGoogle(toURL(input));
        const yt = ytEmbed(url);
        if (yt || /(^|\.)youtube\.com$/.test(host(url).replace(/^m\./, ''))) { const vid = yt && yt.match(/embed\/([\w-]{11})/); PatOS.launch('youtube', vid ? { id: vid[1] } : (new URL(url).searchParams.get('search_query') ? { q: new URL(url).searchParams.get('search_query') } : {})); if (t.url === 'patos://newtab' || !t.hist.length) { t.hist = []; t.idx = -1; } return; }
        if (!noHist) { t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(url); t.idx = t.hist.length - 1; }
        if (/^https?:/.test(url)) { const H = PatOS.store.get('browserHistory', []); if (!H[0] || H[0].u !== url) { H.unshift({ u: url, t: Date.now(), title: host(url) }); PatOS.store.set('browserHistory', H.slice(0, 300)); } }
        if (t.web) { webTabs--; t.web = false; }
        if (/^https?:/.test(url) && !isBlocked(url)) { webTabs++; t.web = true; }
        t.url = url; t.pane.innerHTML = ''; t.loading = false; t.frame = null;
        if (url === 'patos://newtab') { t.title = T('New Tab'); t.pane.appendChild(newTabPage()); }
        else if (url.startsWith('patos://history')) { t.title = T('History'); t.pane.appendChild(historyPage()); }
        else if (url.startsWith('patos://google-setup')) { t.title = 'Google'; t.pane.appendChild(googleSetup(new URL(url.replace('patos://', 'http://x/')).searchParams.get('q') || '')); }
        else if (url.startsWith('patos://search')) { const q = new URL(url.replace('patos://', 'http://x/')).searchParams.get('q') || ''; t.title = q || 'Patoogle'; t.pane.appendChild(patoogleResults(q)); }
        else if (url.startsWith('patos://google')) { const q = new URL(url.replace('patos://', 'http://x/')).searchParams.get('q') || ''; t.title = q || 'Google'; if (googleCx()) t.pane.appendChild(googlePage(t, q)); else { setTimeout(() => navigate(q ? googleURL(q) : 'https://www.google.com/webhp?igu=1&hl=' + glang(), t, true), 0); } }
        else if (/^https?:/.test(url) && PatOS.isOffline()) {
          if (t.web) { webTabs--; t.web = false; }
          t.title = host(url); t.pane.appendChild(PatOS.offlineCard(() => { if (t.url === url) navigate(url, t, true); }, { body: 'This website needs the internet. The page will load by itself when you’re back online.' }));
        }
        else if (isBlocked(url)) { t.title = host(url); t.pane.appendChild(blockedPage(url)); autoOpen(url, t); }
        else {
          const gq = isGoogleFrame(url) ? new URL(url).searchParams.get('q') : null;
          t.title = /bing\.com\/search/.test(url) ? new URL(url).searchParams.get('q') : gq ? gq + ' - Google' : isGoogleFrame(url) ? 'Google' : host(url);
          const mine = ++t.gen;
          const build = () => {
            if (t.url !== url || t.gen !== mine) return;
            const bar = h('div', { class: 'pb-load' });
            const attrs = { src: url, allow: 'fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write; geolocation', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: true };
            if (isGoogleFrame(url)) attrs.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-top-navigation-by-user-activation allow-storage-access-by-user-activation';
            const frame = h('iframe', attrs); t.frame = frame; t.loading = true;
            frame.addEventListener('load', () => { t.loading = false; bar.classList.add('done'); setTimeout(() => bar.remove(), 400); try { const d = frame.contentDocument; if (d && d.title) t.title = d.title; } catch (e) {} if (t === cur) syncUI(); });
            t.pane.innerHTML = ''; t.pane.append(bar, frame);
            applyZoom(t);
            if (isGoogleFrame(url)) t.pane.insertBefore(h('div', { class: 'pg-banner g' }, h('span', {}, T('If a page says it refused to connect, that site doesn’t allow being shown inside other apps.')), h('button', { class: 'pg-link', onclick: () => PatOS.openExternal(url.replace('igu=1&', '').replace('?igu=1', '?')) }, T('Open this search in a new tab')), h('button', { class: 'pg-link', onclick: () => navigate('patos://google-setup' + (gq ? '?q=' + encodeURIComponent(gq) : '')) }, T('Search settings'))), bar);
            setTimeout(() => { if (t.loading && t.gen === mine) { t.loading = false; bar.remove(); if (t === cur) syncUI(); } }, 12000);
          };
          if (isGoogleFrame(url)) build();
          else {
            // ask the server first whether this site allows being shown inside another page; if not, don't show a broken frame
            t.loading = true; t.pane.appendChild(h('div', { class: 'pb-load' })); t.pane.appendChild(h('div', { class: 'pb-checking' }, h('span', {}, T('Opening') + ' ' + host(url) + '…')));
            canFrame(url).then((ok) => {
              if (t.url !== url || t.gen !== mine) return;
              if (ok === false) { t.loading = false; t.pane.innerHTML = ''; t.pane.appendChild(blockedPage(url)); autoOpen(url, t); if (t === cur) syncUI(); }
              else build();
            });
          }
        }
        if (t === cur) { syncUI(); checkLogin(); } else t.tabEl.querySelector('.br-tt').textContent = t.title;
        saveSession();
      }
      function googlePage(t, q) {
        const box = h('input', { class: 'pg-q', value: q, spellcheck: 'false', placeholder: 'Search Google' });
        box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && box.value.trim()) navigate('patos://google?q=' + encodeURIComponent(box.value.trim())); });
        const results = h('div', { class: 'pg-results', id: 'pg-' + t.id });
        const status = h('div', { class: 'pg-status' }, PatOS.t('Searching…'));
        const page = h('div', { class: 'pg-page' }, h('div', { class: 'pg-head' }, h('div', { class: 'pg-logo' }, 'Patoogle'), h('div', { class: 'pg-qwrap', html: PatOS.sym('search') }, box)), status, results,
          h('div', { class: 'pg-foot' }, h('span', {}, 'Results by Google'), h('button', { class: 'pg-link', onclick: () => navigate('patos://google-setup') }, 'Search settings')));
        // open results inside Patoogle instead of a new browser tab
        results.addEventListener('click', (e) => {
          const a = e.target.closest('a[href]'); if (!a) return;
          const href = a.getAttribute('data-ctorig') || a.href;
          if (!/^https?:/.test(href) || /google\.com\/(url|aclk)|googleadservices/.test(href) && !a.getAttribute('data-ctorig')) return;
          e.preventDefault(); e.stopPropagation(); navigate(href);
        }, true);
        results.addEventListener('mousedown', (e) => { if (e.target.closest('a[href]')) e.stopPropagation(); }, true);
        if (q && !googleCx()) { status.textContent = ''; setTimeout(() => navigate(googleURL(q), t, true), 0); return page; }
        if (q) loadCSE(googleCx()).then((el) => {
          status.remove();
          const gname = 'pg' + t.id + Date.now();
          el.render({ div: results.id, tag: 'searchresults-only', gname, attributes: { linkTarget: '_self', enableHistory: false } });
          el.getElement(gname).execute(q);
        }).catch((err) => {
          status.textContent = err.message === 'restart' ? PatOS.t('Close and reopen PatOS to use your new Search engine ID.') : err.message === 'offline' && navigator.onLine ? PatOS.t('Google search was blocked. Your school’s Chromebook settings may not allow it on this network.') : PatOS.sandboxed ? PatOS.t('Google search can’t run inside a Claude Artifact. Open PatOS from its website.') : PatOS.t('Google search didn’t load. Check your internet connection, or the Search engine ID in Search settings.');
        });
        else status.textContent = '';
        setTimeout(() => { if (!q) box.focus(); }, 50);
        return page;
      }
      /* Patoogle's own results, drawn inside PatOS: instant answers + Wikipedia. Used when no Google ID is set,
         because many school Chromebooks block Bing ("your administrator has blocked this"). */
      function patoogleResults(q) {
        const box = h('input', { class: 'pg-q', value: q, spellcheck: 'false', placeholder: 'Search Patoogle' });
        box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && box.value.trim()) navigate(box.value.trim()); });
        const answers = h('div', { class: 'pr-answers' }), results = h('div', { class: 'pr-results' }), panel = h('div', { class: 'pr-panel' });
        const page = h('div', { class: 'pg-page' }, h('div', { class: 'pg-head' }, h('div', { class: 'pg-logo' }, 'Patoogle'), h('div', { class: 'pg-qwrap', html: PatOS.sym('search') }, box)),
          h('div', { class: 'pr-wrap' }, h('div', { class: 'pr-col' }, answers, results,
            h('div', { class: 'pr-more' }, h('b', {}, PatOS.t('Want full web results?')), h('p', {}, PatOS.t('These results come from Wikipedia. Search Google for everything else.')),
              h('div', { class: 'pr-btns' }, h('button', { class: 'btn primary', onclick: () => navigate(googleURL(q)) }, 'Search Google'), h('button', { class: 'btn', onclick: () => navigate(bingURL(q)) }, 'Try Bing')),
              h('small', {}, PatOS.t('Some schools block Bing. If you see “blocked by your administrator”, that’s your school’s setting.')))), panel));
        setTimeout(() => { if (!q) box.focus(); }, 50);
        if (!q) return page;
        // instant answers
        const ans = (title, value, sub) => answers.appendChild(h('div', { class: 'pr-answer' }, h('small', {}, PatOS.t(title)), h('div', { class: 'pr-big' }, value), sub ? h('small', {}, sub) : null));
        const expr = q.replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
        if (/^[\d\s+\-*/().%^]+$/.test(expr) && /\d/.test(expr) && /[+\-*/^%]/.test(expr)) { try { const v = Function('"use strict";return (' + expr.replace(/\^/g, '**') + ')')(); if (Number.isFinite(v)) ans('Calculator', q + ' = ' + (+v.toPrecision(12))); } catch (e) {} }
        const cv = PatOS.convertUnits && PatOS.convertUnits(q); if (cv) ans('Conversion', cv.text);
        if (/^(time|heure|what time is it|quelle heure)/i.test(q)) ans('Time', new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), new Date().toLocaleDateString(undefined, { dateStyle: 'full' }));
        const dm = /^(?:define|definition of|meaning of|définition de|définir)\s+(\w[\w-]*)$/i.exec(q);
        if (dm) fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(dm[1])).then((r) => r.json()).then((j) => { const m = j[0] && j[0].meanings[0]; if (m) ans('Dictionary', j[0].word, m.partOfSpeech + ' · ' + m.definitions[0].definition); }).catch(() => {});
        // Wikipedia results (works through most school filters)
        const lang = PatOS.lang === 'fr' ? 'fr' : 'en';
        results.appendChild(h('div', { class: 'pg-status' }, PatOS.t('Searching…')));
        const getJSON = (u, tries = 3) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => (tries > 1 ? new Promise((res) => setTimeout(res, 700)).then(() => getJSON(u, tries - 1)) : Promise.reject(e)));
        getJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=10&utf8=1`).then((j) => {
          results.innerHTML = '';
          const hits = (j.query && j.query.search) || [];
          if (!hits.length) { results.appendChild(h('div', { class: 'pg-status' }, PatOS.t('No results found. Try different words.'))); return; }
          results.appendChild(h('div', { class: 'pr-src' }, PatOS.t('Results from Wikipedia') + ' · ' + (j.query.searchinfo ? j.query.searchinfo.totalhits.toLocaleString() : '') + ' ' + PatOS.t('articles')));
          hits.forEach((hit) => {
            const url = `https://${lang}.wikipedia.org/wiki/` + encodeURIComponent(hit.title.replace(/ /g, '_'));
            const a = h('div', { class: 'pr-hit' }, h('div', { class: 'pr-url' }, h('span', { class: 'pr-fav', html: PatOS.sym('doc') }), lang + '.wikipedia.org › ' + hit.title), h('a', { class: 'pr-title', href: url }, hit.title), h('p', { class: 'pr-snip', html: PatOS.sanitize(hit.snippet.replace(/<(?!\/?span)[^>]*>/g, '')) + '…' }));
            a.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); navigate(url); });
            results.appendChild(a);
          });
          // knowledge panel for the top hit
          getJSON(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/` + encodeURIComponent(hits[0].title.replace(/ /g, '_'))).then((s) => {
            if (!s.extract) return;
            panel.append(s.thumbnail ? h('img', { src: s.thumbnail.source, alt: '' }) : null, h('h3', {}, s.title), s.description ? h('small', {}, s.description) : null, h('p', {}, s.extract), h('button', { class: 'pg-link', onclick: () => navigate(s.content_urls.desktop.page) }, PatOS.t('Read more on Wikipedia')));
            panel.classList.add('on');
          }).catch(() => {});
        }).catch(() => { results.innerHTML = ''; results.appendChild(h('div', { class: 'pg-status' }, PatOS.sandboxed ? PatOS.t('Search can’t run inside a Claude Artifact. Open PatOS from its website.') : PatOS.t('Search couldn’t reach Wikipedia. Check the internet connection, or your school may block it.'))); });
        return page;
      }
      function googleSetup() {
        const cur = engine();
        const opt = (id, title, desc) => { const r = h('label', { class: 'pg-eng' + (cur === id ? ' on' : '') }, h('input', { type: 'radio', name: 'eng', value: id }), h('div', {}, h('b', {}, PatOS.t(title)), h('small', {}, PatOS.t(desc)))); const i = r.querySelector('input'); i.checked = cur === id; i.onchange = () => { PatOS.store.set('searchEngine', id); navigate('patos://newtab'); OF.toast(win, PatOS.t('Search engine') + ': ' + title); }; return r; };
        return h('div', { class: 'pg-setup' },
          h('div', { class: 'pg-logo big' }, 'Patoogle'),
          h('h2', {}, PatOS.t('Search engine')),
          h('p', {}, ''),
          opt('google', 'Google', 'The usual Google, with your account and history.'),
          opt('bing', 'Bing', 'Some school networks block Bing.'));
      }
      function loadHTML(t, html, title) {
        t.url = 'patos://file'; t.title = title || T('Document'); t.fileKey = title || 'file'; t.hist = [t.url]; t.idx = 0; t.loading = false;
        t.pane.innerHTML = '';
        const withHelper = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + PW_HELPER) : PW_HELPER + html;
        const f = h('iframe', { srcdoc: withHelper, sandbox: 'allow-scripts allow-forms allow-modals allow-popups' });
        t.frame = f; t.pane.appendChild(f); syncUI(); checkLogin();
      }

      /* ---------- new tab page ---------- */
      function shortcuts() {
        const pinned = PatOS.store.get('browserShortcuts', null);
        if (pinned) return pinned;
        return SHORTCUTS.map((s) => ({ t: s.t, u: s.u, app: s.app, i: s.i }));
      }
      function newTabPage() {
        const q = h('input', { class: 'nt-search', placeholder: T('Search Google or type a web address'), spellcheck: 'false', autocomplete: 'off' });
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && q.value.trim()) navigate(q.value); });
        q.addEventListener('input', () => { omni.value = q.value; showSugg(q); });
        const ENG = { google: 'Google', cse: 'Google', patoogle: 'Patoogle', bing: 'Bing' };
        const engineRow = h('div', { class: 'nt-engine' }, h('span', {}, T('Searching with') + ' ' + ENG[engine()]), h('button', { class: 'pg-link', onclick: () => navigate('patos://google-setup') }, T('Change')));
        const grid = h('div', { class: 'nt-grid' });
        const list = shortcuts();
        list.forEach((s, i) => {
          const tile = h('button', { class: 'nt-tile' }, h('div', { class: 'nt-ic', html: s.i && PatOS.iconDefs[s.i] ? PatOS.iconHTML(s.i) : favicon(s.u || '') ? `<img src="${favicon(s.u)}" alt="" class="nt-favimg">` : `<div class="nt-letter">${esc((s.t || '?')[0])}</div>` }), h('span', {}, s.t));
          tile.onclick = () => (s.app ? PatOS.launch(s.app) : navigate(s.u));
          tile.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('Remove shortcut'), action: () => { const l = shortcuts(); l.splice(i, 1); PatOS.store.set('browserShortcuts', l); navigate('patos://newtab', cur, true); } }], e.clientX, e.clientY); };
          grid.appendChild(tile);
        });
        if (list.length < 12) { const add = h('button', { class: 'nt-tile nt-addtile' }, h('div', { class: 'nt-ic' }, h('div', { class: 'nt-letter' }, '+')), h('span', {}, T('Add shortcut'))); add.onclick = async () => { const u = await PatOS.ask(T('Website address'), 'https://', { icon: 'browser', ok: T('Next') }); if (!u || u === 'https://') return; const n = await PatOS.ask(T('Name'), host(toURL(u)), { icon: 'browser', ok: T('Add') }); const l = shortcuts(); l.push({ t: n || host(toURL(u)), u: toURL(u) }); PatOS.store.set('browserShortcuts', l); navigate('patos://newtab', cur, true); }; grid.appendChild(add); }
        const hour = new Date().getHours();
        const greet = hour < 12 ? T('Good morning') : hour < 18 ? T('Good afternoon') : T('Good evening');
        const recent = PatOS.store.get('browserHistory', []).filter((x, i, a) => a.findIndex((y) => host(y.u) === host(x.u)) === i).slice(0, 5);
        setTimeout(() => q.focus(), 50);
        return h('div', { class: 'nt-page pb-nt' },
          h('div', { class: 'nt-logo' }, 'Patoogle'),
          h('div', { class: 'nt-greet' }, greet + ', ' + PatOS.settings.userName),
          h('div', { class: 'pb-ntsearch' }, q), engineRow, grid,
          recent.length ? h('div', { class: 'pb-recent' }, h('b', {}, T('Continue where you left off')), ...recent.map((r) => h('button', { onclick: () => navigate(r.u) }, favicon(r.u) ? h('img', { src: favicon(r.u), alt: '' }) : null, h('span', {}, host(r.u))))) : null,
          h('div', { class: 'nt-tip' }, ''));
      }
      function historyPage() {
        const q = h('input', { class: 'field pb-hsearch', placeholder: T('Search history') });
        const box = h('div', { class: 'pb-hlist' });
        const draw = () => {
          box.innerHTML = '';
          const H = PatOS.store.get('browserHistory', []); const ql = q.value.trim().toLowerCase();
          let day = '';
          const rows = H.filter((x) => !ql || x.u.toLowerCase().includes(ql) || (x.title || '').toLowerCase().includes(ql));
          if (!rows.length) { box.appendChild(h('p', { class: 'pb-hnone' }, T(ql ? 'No results' : 'No history yet'))); return; }
          rows.forEach((x) => {
            const d = new Date(x.t).toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' });
            if (d !== day) { day = d; box.appendChild(h('h3', {}, d)); }
            const row = h('div', { class: 'pb-hrow' }, h('small', {}, new Date(x.t).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' })), favicon(x.u) ? h('img', { src: favicon(x.u), alt: '' }) : h('span'), h('a', { href: '#' }, x.title && x.title !== host(x.u) ? x.title : x.u), h('span', { class: 'pb-hhost' }, host(x.u)), h('button', { class: 'tbtn', title: T('Remove'), onclick: (e) => { e.stopPropagation(); const all = PatOS.store.get('browserHistory', []); PatOS.store.set('browserHistory', all.filter((y) => !(y.t === x.t && y.u === x.u))); draw(); } }, '×'));
            row.querySelector('a').onclick = (e) => { e.preventDefault(); navigate(x.u); };
            box.appendChild(row);
          });
        };
        q.oninput = draw; draw();
        return h('div', { class: 'pb-history' }, h('div', { class: 'pb-hhead' }, h('h1', {}, T('History')), q, h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Clear browsing history?'), '', { danger: true, ok: T('Clear'), icon: 'browser' })) { PatOS.store.set('browserHistory', []); draw(); } } }, T('Clear browsing data'))), box);
      }
      /* ---------- sites that don't allow being shown inside other pages ---------- */
      const frameMem = PatOS.store.get('frameMem', {});
      const frameKey = (url) => { try { const u = new URL(url); return u.hostname + '/' + (u.pathname.split('/')[1] || ''); } catch (e) { return url; } };
      async function canFrame(url) {
        const k = frameKey(url); const m = frameMem[k]; if (m && Date.now() - m.t < 6 * 3600 * 1000) return m.ok;
        const base = PatOS.server && await PatOS.server(); if (!base) return null;
        try {
          const r = await Promise.race([fetch(base + '/api/frameable?url=' + encodeURIComponent(url)).then((x) => x.json()), new Promise((res) => setTimeout(() => res(null), 3000))]);
          if (r && !r.unknown) { frameMem[k] = { ok: r.frameable, t: Date.now() }; PatOS.store.set('frameMem', frameMem); return r.frameable; }
        } catch (e) {}
        return null;
      }
      const appWins = {};
      function openAppWindow(url) {
        const w = Math.min(1180, screen.availWidth - 80), hh = Math.min(820, screen.availHeight - 80);
        const key = 'patoogle_' + host(url).replace(/\W/g, '_');
        let win2 = appWins[key]; if (win2 && !win2.closed) { try { win2.focus(); return win2; } catch (e) {} }
        try { win2 = window.open(url, key, `popup=yes,width=${w},height=${hh},left=${Math.max(0, (screen.availWidth - w) / 2)},top=${Math.max(0, (screen.availHeight - hh) / 2)}`); } catch (e) { win2 = null; }
        if (win2) appWins[key] = win2; return win2;
      }
      let restoring = false;
      // these sites can't be shown here, so open them in their own app window right away
      function autoOpen(url, t) {
        if (restoring || t !== cur || !PatOS.store.get('autoAppWindow', true) || PatOS.sandboxed || t.opened === url) return;
        t.opened = url; const w = openAppWindow(url);
        if (w) { const note = t.pane.querySelector('.bb-note'); if (note) note.textContent = T('It opened in its own window. If you don’t see it, check that your browser allows pop-ups from this site.'); }
      }
      function blockedPage(url) {
        const hn = host(url);
        return h('div', { class: 'br-blocked' },
          h('div', { class: 'bb-ic', html: '<svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="13" rx="2.5"/><path d="M8 20.5h8M12 17.5v3M9 9l6 4M15 9l-6 4"/></svg>' }),
          h('h2', {}, hn + ' ' + T('doesn’t allow being shown inside PatOS')),
          h('p', {}, PatOS.sandboxed ? T('PatOS is running inside a Claude Artifact, which can’t show other websites inside it. Open the page in a real browser tab instead.') : T('This website tells browsers not to show it inside other pages. That is the website’s own rule, so PatOS opens it in its own window instead.')),
          h('p', { class: 'bb-note' }, PatOS.sandboxed ? '' : T('Opening in its own window…')),
          h('div', { class: 'br-alts' },
            h('button', { class: 'btn primary', onclick: () => { const w = openAppWindow(url); if (!w) PatOS.openExternal(url); } }, T('Open') + ' ' + hn + ' ' + T('in its own window')),
            h('button', { class: 'btn', onclick: () => navigate(searchURL(hn)) }, T('Search Google for') + ' ' + hn),
            h('button', { class: 'btn', onclick: () => PatOS.openExternal(url) }, T('Open in a new tab'))));
      }
      /* ---------- address bar suggestions ---------- */
      let sIdx = -1, sTimer = null, sItems = [];
      function showSugg(input) {
        const v = input.value.trim();
        clearTimeout(sTimer);
        if (!v) { hideSugg(); return; }
        const vl = v.toLowerCase();
        const local = [];
        bookmarks.forEach((b) => { if ((b.t + ' ' + b.u).toLowerCase().includes(vl)) local.push({ kind: 'bm', text: b.t, sub: b.u, go: b.u }); });
        const seen = new Set(local.map((x) => x.go));
        PatOS.store.get('browserHistory', []).forEach((x) => { if (local.length < 5 && !seen.has(x.u) && x.u.toLowerCase().includes(vl)) { seen.add(x.u); local.push({ kind: 'hist', text: x.title && x.title !== host(x.u) ? x.title : host(x.u), sub: x.u, go: x.u }); } });
        const looksUrl = /^[\w-]+(\.[\w-]+)+/.test(v) && !v.includes(' ');
        const first = looksUrl ? { kind: 'url', text: toURL(v), sub: T('Go to site'), go: toURL(v) } : { kind: 'search', text: v, sub: T('Search Google'), go: v };
        paintSugg([first, ...local.slice(0, 5)], input);
        if (looksUrl) return;
        sTimer = setTimeout(async () => {
          let list = [];
          try { const base = PatOS.server && await PatOS.server(); if (base) { const r = await fetch(base + '/api/suggest?hl=' + (PatOS.lang === 'fr' ? 'fr' : 'en') + '&q=' + encodeURIComponent(v)); list = await r.json(); } } catch (e) {}
          if (input.value.trim() !== v || !Array.isArray(list)) return;
          const g = list.filter((s) => s.toLowerCase() !== vl).slice(0, 6).map((s) => ({ kind: 'search', text: s, go: s }));
          paintSugg([first, ...local.slice(0, 3), ...g], input);
        }, 140);
      }
      function paintSugg(items, input) {
        sItems = items; sIdx = -1; sugg.innerHTML = '';
        if (!items.length || document.activeElement !== input) return hideSugg();
        const icons = { search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>', hist: OF.icon('history', 15), bm: OF.icon('star', 15), url: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>' };
        items.forEach((it, i) => { const b = h('button', { class: 'pb-si', html: icons[it.kind] + '<span class="pb-st"></span>' + (it.sub ? '<small></small>' : '') }); b.querySelector('.pb-st').textContent = it.text; if (it.sub) b.querySelector('small').textContent = it.sub; b.onmousedown = (e) => { e.preventDefault(); hideSugg(); input.blur(); navigate(it.go); }; sugg.appendChild(b); });
        // place under whichever box is being typed in
        const r = input.getBoundingClientRect(), wr = win.body.getBoundingClientRect();
        if (input === omni) { sugg.style.cssText = ''; } else { sugg.style.cssText = `position:fixed;left:${r.left}px;top:${r.bottom + 4}px;width:${r.width}px;`; }
        sugg.classList.add('on');
      }
      function hideSugg() { sugg.classList.remove('on'); sItems = []; sIdx = -1; }
      function suggKey(e, input) {
        if (!sugg.classList.contains('on') || !sItems.length) return false;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sIdx = (sIdx + (e.key === 'ArrowDown' ? 1 : -1) + sItems.length + 1) % (sItems.length + 1) - 0; if (sIdx === sItems.length) sIdx = -1; [...sugg.children].forEach((b, i) => b.classList.toggle('sel', i === sIdx)); if (sIdx >= 0) input.value = sItems[sIdx].kind === 'search' ? sItems[sIdx].text : sItems[sIdx].go; return true; }
        if (e.key === 'Escape') { hideSugg(); return true; }
        return false;
      }
      omni.addEventListener('input', () => showSugg(omni));
      omni.addEventListener('keydown', (e) => { if (suggKey(e, omni)) return; if (e.key === 'Enter') { const v = sIdx >= 0 ? sItems[sIdx].go : omni.value; hideSugg(); navigate(v); omni.blur(); } if (e.key === 'Escape') { omni.value = cur.url === 'patos://newtab' ? '' : cur.url; omni.blur(); } });
      omni.addEventListener('focus', () => omni.select());
      omni.addEventListener('blur', () => setTimeout(() => { hideSugg(); syncUI(); }, 120));
      win.body.addEventListener('keydown', (e) => { if (e.target.classList && e.target.classList.contains('nt-search')) { if (suggKey(e, e.target)) return; if (e.key === 'Enter' && sIdx >= 0) { e.preventDefault(); e.stopPropagation(); const go = sItems[sIdx].go; hideSugg(); navigate(go); } } }, true);
      win.body.addEventListener('focusout', (e) => { if (e.target.classList && e.target.classList.contains('nt-search')) setTimeout(hideSugg, 120); });

      /* ---------- zoom ---------- */
      function applyZoom(t) { if (t.frame) { t.frame.style.zoom = t.zoom; } const p = t.pane.firstElementChild; if (!t.frame && p) p.style.zoom = t.zoom; }
      function zoom(d) { if (!cur) return; cur.zoom = d === 0 ? 1 : Math.max(0.3, Math.min(3, Math.round((cur.zoom + d) * 10) / 10)); applyZoom(cur); syncUI(); }
      zoomTag.onclick = () => zoom(0);

      /* ---------- site info, bookmarks, menu ---------- */
      lockIc.onclick = () => {
        if (!cur) return; const secure = cur.url.startsWith('https'), internal = cur.url.startsWith('patos');
        const site = siteOf(cur); const n = site && !PatOS.passwords.locked ? PatOS.passwords.forSite(site).length : 0;
        const p = OF.pop(lockIc, h('div', { class: 'pb-siteinfo' },
          h('b', {}, internal ? 'Patoogle' : host(cur.url)),
          h('p', {}, internal ? T('This is a page inside PatOS.') : secure ? T('Connection is secure. Information you send to this site is private.') : T('Connection is not secure. Don’t enter passwords or card numbers here.')),
          !internal ? h('button', { class: 'of-listbtn', onclick: () => { p.close(); PatOS.launch('passwords', { site }); } }, OF.icon('key', 15), ' ' + n + ' ' + T(n === 1 ? 'saved password' : 'saved passwords')) : null,
          !internal ? h('button', { class: 'of-listbtn', onclick: () => { p.close(); PatOS.openExternal(cur.url); } }, T('Open in a real browser tab')) : null));
      };
      bStar.onclick = () => {
        if (!cur || cur.url.startsWith('patos')) return;
        const i = bookmarks.findIndex((b) => b.u === cur.url);
        if (i >= 0) bookmarks.splice(i, 1); else { bookmarks.push({ t: cur.title.slice(0, 24), u: cur.url }); bStar.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 300 }); }
        saveBM();
      };
      bMenu.onclick = () => {
        const r = bMenu.getBoundingClientRect();
        PatOS.menu([
          { label: T('New tab'), shortcut: 'Alt+T', action: () => newTab() },
          { label: T('Reopen closed tab'), shortcut: 'Alt+Shift+T', disabled: !closed.length, action: reopen },
          { divider: true },
          { label: T('History'), shortcut: 'Alt+Y', action: () => newTab('patos://history') },
          { label: T('Passwords'), action: () => PatOS.launch('passwords') },
          { label: T('Bookmark this page'), disabled: !cur || cur.url.startsWith('patos'), action: () => bStar.click() },
          { divider: true },
          { label: T('Zoom in'), shortcut: 'Ctrl +', action: () => zoom(0.1) }, { label: T('Zoom out'), shortcut: 'Ctrl -', action: () => zoom(-0.1) }, { label: T('Actual size'), shortcut: 'Ctrl 0', action: () => zoom(0) },
          { divider: true },
          { label: T('Search engine…'), action: () => navigate('patos://google-setup') },
          { label: (PatOS.store.get('browserRestore', false) ? '✓ ' : '') + T('Reopen my tabs next time'), action: () => PatOS.store.set('browserRestore', !PatOS.store.get('browserRestore', false)) },
          { label: T('Open in a real browser tab'), disabled: !cur || cur.url.startsWith('patos'), action: () => PatOS.openExternal(cur.url.replace('youtube-nocookie.com/embed/', 'youtube.com/watch?v=').replace('?autoplay=1', '').replace('igu=1&', '').replace('?igu=1', '?')) }
        ], r.right - 230, r.bottom + 4);
      };
      bPw.onclick = () => PatOS.launch('passwords', cur && siteOf(cur) ? { site: siteOf(cur) } : {});
      bKey.onclick = () => keyPop(bKey);

      /* ---------- passwords: the key menu (fill your own HTML pages, copy for real sites) ---------- */
      function copy(text, what) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => OF.toast(win, what + ' ' + T('copied'))).catch(() => {}); }
      function keyPop(anchor) {
        const site = cur && siteOf(cur); if (!site) return;
        if (PatOS.passwords.locked) { PatOS.launch('passwords'); return; }
        const list = PatOS.passwords.forSite(site);
        const canFill = cur.url.startsWith('patos://file');
        const p = OF.pop(anchor, h('div', { class: 'pb-keypop' },
          h('b', {}, T('Saved passwords for') + ' ' + (site.startsWith('file:') ? site.slice(5) : site)),
          ...list.map((x) => h('div', { class: 'pb-krow' }, h('div', {}, h('span', {}, x.username || T('(no username)')), h('small', {}, '••••••••')),
            canFill ? h('button', { class: 'btn primary', onclick: () => { fill(x); p.close(); } }, T('Fill')) : null,
            h('button', { class: 'btn', onclick: () => copy(x.username, T('Username')) }, T('Copy username')),
            h('button', { class: 'btn', onclick: () => { copy(x.password, T('Password')); PatOS.passwords.used(x.id); } }, T('Copy password')))),
          h('button', { class: 'of-listbtn', onclick: () => { p.close(); PatOS.launch('passwords', { site }); } }, T('Manage passwords'))), { alignRight: true });
      }
      function fill(x) { if (cur && cur.frame && cur.frame.contentWindow) { cur.frame.contentWindow.postMessage({ patosPw: 'fill', username: x.username, password: x.password }, '*'); PatOS.passwords.used(x.id); } }
      function bar(content, kind) {
        infobar.innerHTML = ''; if (!content) { infobar.classList.remove('on'); return; }
        infobar.appendChild(h('div', { class: 'pb-ibar ' + (kind || '') }, h('span', { class: 'pb-iic', html: OF.icon('key', 18) }), ...content, h('button', { class: 'tbtn pb-ix', title: T('Close'), onclick: () => bar(null) }, '×')));
        infobar.classList.add('on');
      }
      function checkLogin() { bar(null); } // nothing is saved or filled on its own: you choose Fill or Copy in the key menu
      const onPw = () => syncUI(); PatOS.on('passwords', onPw);
      win.on('closed', () => { PatOS.off('passwords', onPw); tabs.forEach((t) => { if (t.web) { webTabs--; t.web = false; } }); });

      bBack.onclick = () => { if (cur.idx > 0) { cur.idx--; navigate(cur.hist[cur.idx], cur, true); } };
      bFwd.onclick = () => { if (cur.idx < cur.hist.length - 1) { cur.idx++; navigate(cur.hist[cur.idx], cur, true); } };
      bReload.onclick = () => { if (cur.url.startsWith('patos://file') && cur.frame) { cur.frame.srcdoc = cur.frame.srcdoc; return; } navigate(cur.url, cur, true); };
      bHome.onclick = () => navigate('patos://newtab');
      addTab.onclick = () => newTab();
      win._open = (a) => { if (a.html) newTab(null, a.html, a.title); else if (a.url) { if (cur && cur.url === 'patos://newtab') navigate(a.url); else newTab(a.url); } };
      win.body.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
        if (e.altKey && k === 't') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) reopen(); else newTab(); }
        else if (e.altKey && k === 'd') { e.preventDefault(); e.stopPropagation(); omni.focus(); }
        else if (e.altKey && k === 'y') { e.preventDefault(); e.stopPropagation(); newTab('patos://history'); }
        else if (e.altKey && k === 'arrowleft') { e.preventDefault(); e.stopPropagation(); bBack.click(); }
        else if (e.altKey && k === 'arrowright') { e.preventDefault(); e.stopPropagation(); bFwd.click(); }
        else if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoom(0.1); }
        else if (mod && k === '-') { e.preventDefault(); zoom(-0.1); }
        else if (mod && k === '0') { e.preventDefault(); zoom(0); }
        else if (e.key === 'F5') { e.preventDefault(); bReload.click(); }
      });
      renderBM();
      // load Google's page in the background once, so the first search opens faster (its files are then already saved)
      if (!PatOS.sandboxed && engine() === 'google' && !sessionStorage.getItem('pbWarm')) { try { sessionStorage.setItem('pbWarm', '1'); } catch (e) {} setTimeout(() => { const wf = h('iframe', { src: 'https://www.google.com/webhp?igu=1&hl=' + glang(), style: { position: 'fixed', width: '1px', height: '1px', left: '-10px', top: '-10px', border: '0', opacity: '0', pointerEvents: 'none' }, sandbox: 'allow-scripts allow-same-origin', 'aria-hidden': 'true', tabindex: '-1' }); document.body.appendChild(wf); setTimeout(() => wf.remove(), 9000); }, 1200); }
      const session = PatOS.store.get('browserSession', null);
      if (args.html) newTab(null, args.html, args.title);
      else if (args.url) newTab(args.url);
      else if (session && session.tabs && session.tabs.length && PatOS.store.get('browserRestore', false)) { restoring = true; session.tabs.forEach((u, i) => newTab(u, null, null, i !== session.active)); if (tabs[session.active]) select(tabs[session.active]); setTimeout(() => { restoring = false; }, 4000); }
      else newTab();
    },
    onArgs(win, args) { win._open && win._open(args); },
    menus(win) {
      return { file: [
        { label: T('New Tab'), action: () => win._open({ url: 'patos://newtab' }) },
        { label: T('New Window'), action: () => PatOS.launch('browser') },
        { divider: true },
        { label: T('Close Window'), action: () => win.close() }
      ] };
    }
  });
})();
