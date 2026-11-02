/* Patoogle — tabbed web browser */
(function () {
  'use strict';
  const { h, esc } = PatOS;
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
    { t: 'Google', u: 'patos://google', i: 'search' },
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
  /* Searching. google.com refuses to load inside other apps (you get a 403 or an old stripped-down page),
     so Patoogle shows real Google results through Google Programmable Search, which Google made for exactly
     this. It needs a free Search engine ID from the user. Until one is added, searches go to Bing. */
  const googleCx = () => (PatOS.store.get('googleCx', '') || '').trim();
  function searchURL(q) { return (googleCx() ? 'patos://google?q=' : 'patos://search?q=') + encodeURIComponent(q); }
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
      if (u.pathname === '/search' && u.searchParams.get('q')) return searchURL(u.searchParams.get('q'));
      if (u.pathname === '/' || u.pathname === '/webhp') return googleCx() ? 'patos://newtab' : 'patos://google-setup';
    } catch (e) {}
    return url;
  }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }
  const favicon = (url) => { try { const u = new URL(url); return /^https?:/.test(u.protocol) ? 'https://www.google.com/s2/favicons?sz=32&domain=' + u.hostname : null; } catch (e) { return null; } };
  PatOS.openExternal = (url) => {
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  };

  PatOS.registerApp({
    id: 'browser', name: 'Patoogle', icon: 'browser', single: true, width: 1040, height: 680, keywords: 'chrome safari web internet browser google',
    about: 'A web browser with tabs. Searches go through Bing, since Google won’t show its results inside other apps.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'browser-win');
      const tabs = []; let cur = null;
      let bookmarks = PatOS.store.get('bookmarks', DEFAULT_BM).map((b) => (/google\.com\/webhp/.test(b.u) || /^https:\/\/www\.bing\.com\/?$/.test(b.u) ? { t: 'Patoogle', u: 'patos://newtab' } : b));
      const tabStrip = h('div', { class: 'br-tabs' });
      const addTab = h('button', { class: 'br-newtab', title: 'New tab' }, '+');
      win.toolbar.append(tabStrip, addTab);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '64px';
      win.titlebar.style.height = '38px';

      const bBack = h('button', { class: 'tbtn', title: 'Back' }, '‹');
      const bFwd = h('button', { class: 'tbtn', title: 'Forward' }, '›');
      const bReload = h('button', { class: 'tbtn', title: 'Reload' }, '↻');
      const bHome = h('button', { class: 'tbtn', title: 'Home' }, '⌂');
      const omni = h('input', { class: 'br-omni', placeholder: 'Search Patoogle or type a web address', spellcheck: 'false' });
      const lockIc = h('span', { class: 'br-lock', html: PatOS.sym('lock') });
      const bStar = h('button', { class: 'tbtn', title: 'Bookmark this page' }, '☆');
      const bExt = h('button', { class: 'tbtn', title: 'Open in a real browser tab' }, '↗');
      const bHist = h('button', { class: 'tbtn', title: 'History' }, '🕘');
      const nav = h('div', { class: 'br-nav' }, bBack, bFwd, bReload, bHome, h('div', { class: 'br-omniwrap' }, lockIc, omni), bStar, bHist, bExt);
      const bmBar = h('div', { class: 'br-bm' });
      const view = h('div', { class: 'br-view' });
      win.body.append(nav, bmBar, view);

      function renderBM() {
        bmBar.innerHTML = '';
        bookmarks.forEach((b, i) => {
          const el = h('button', { class: 'br-bmi', title: b.u }, favicon(b.u) ? h('img', { class: 'br-fav img', src: favicon(b.u), alt: '', onerror: (e) => { e.target.replaceWith(h('span', { class: 'br-fav' }, (b.t[0] || '?').toUpperCase())); } }) : h('span', { class: 'br-fav' }, (b.t[0] || '?').toUpperCase()), b.t);
          el.onclick = () => navigate(b.u);
          el.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); PatOS.menu([{ label: 'Open in New Tab', action: () => newTab(b.u) }, { label: 'Delete Bookmark', action: () => { bookmarks.splice(i, 1); PatOS.store.set('bookmarks', bookmarks); renderBM(); } }], e.clientX, e.clientY); };
          bmBar.appendChild(el);
        });
      }
      function newTab(url, html, title) {
        const t = { id: PatOS.uid(), url: 'patos://newtab', title: 'New Tab', hist: [], idx: -1, pane: h('div', { class: 'br-pane' }), tabEl: null };
        t.tabEl = h('div', { class: 'tab br-tab' }, h('span', { class: 'br-tic none' }), h('span', { class: 'br-tt' }, 'New Tab'), h('button', { class: 'br-tx', title: 'Close tab' }, '×'));
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
        lockIc.innerHTML = PatOS.sym(cur.url.startsWith('https') ? 'lock' : cur.url.startsWith('patos') ? 'search' : 'warn');
        bBack.disabled = cur.idx <= 0; bFwd.disabled = cur.idx >= cur.hist.length - 1;
        bStar.textContent = bookmarks.some((b) => b.u === cur.url) ? '★' : '☆';
        cur.tabEl.querySelector('.br-tt').textContent = cur.title;
        const ic = cur.tabEl.querySelector('.br-tic'); const f = favicon(cur.url); if (ic) { ic.style.backgroundImage = f ? `url(${f})` : ''; ic.classList.toggle('none', !f); }
        win.setTitle(cur.title);
      }
      function navigate(input, t, noHist) {
        t = t || cur;
        let url = fixGoogle(toURL(input));
        const yt = ytEmbed(url);
        if (yt || /(^|\.)youtube\.com$/.test(host(url).replace(/^m\./, ''))) { const vid = yt && yt.match(/embed\/([\w-]{11})/); PatOS.launch('youtube', vid ? { id: vid[1] } : (new URL(url).searchParams.get('search_query') ? { q: new URL(url).searchParams.get('search_query') } : {})); if (t.url === 'patos://newtab' || !t.hist.length) { t.hist = []; t.idx = -1; } return; }
        if (!noHist) { t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(url); t.idx = t.hist.length - 1; }
        if (/^https?:/.test(url)) { const H = PatOS.store.get('browserHistory', []); if (!H[0] || H[0].u !== url) { H.unshift({ u: url, t: Date.now() }); PatOS.store.set('browserHistory', H.slice(0, 100)); } }
        t.url = url;
        t.pane.innerHTML = '';
        if (url === 'patos://newtab') { t.title = 'New Tab'; t.pane.appendChild(newTabPage()); }
        else if (url.startsWith('patos://google-setup')) { t.title = 'Google'; t.pane.appendChild(googleSetup(new URL(url.replace('patos://', 'http://x/')).searchParams.get('q') || '')); }
        else if (url.startsWith('patos://search')) { const q = new URL(url.replace('patos://', 'http://x/')).searchParams.get('q') || ''; t.title = q || 'Patoogle'; t.pane.appendChild(patoogleResults(q)); }
        else if (url.startsWith('patos://google')) { const q = new URL(url.replace('patos://', 'http://x/')).searchParams.get('q') || ''; t.title = q || 'Google'; t.pane.appendChild(googleCx() ? googlePage(t, q) : googleSetup(q)); }
        else if (isBlocked(url)) { t.title = host(url); t.pane.appendChild(blockedPage(url)); }
        else {
          t.title = /bing\.com\/search/.test(url) ? new URL(url).searchParams.get('q') : host(url);
          const loader = h('div', { class: 'br-loading' });
          const frame = h('iframe', { src: url, allow: 'fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: true });
          frame.addEventListener('load', () => { loader.remove(); try { const d = frame.contentDocument; if (d && d.title) { t.title = d.title; syncUI(); } } catch (e) {} });
          t.pane.append(loader, frame);
          if (/bing\.com\/search/.test(url) && !googleCx()) {
            const q = new URL(url).searchParams.get('q') || '';
            t.pane.insertBefore(h('div', { class: 'pg-banner' }, h('span', {}, 'These results are from Bing.'), h('button', { class: 'pg-link', onclick: () => navigate('patos://google-setup?q=' + encodeURIComponent(q)) }, 'Get real Google results')), frame);
          }
          setTimeout(() => loader.remove(), 8000);
        }
        if (t === cur) syncUI(); else t.tabEl.querySelector('.br-tt').textContent = t.title;
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
            h('div', { class: 'pr-more' }, h('b', {}, PatOS.t('Want full web results like Google?')), h('p', {}, PatOS.t('Add a free Google search ID (about a minute) and Patoogle shows real Google results here.')),
              h('div', { class: 'pr-btns' }, h('button', { class: 'btn primary', onclick: () => navigate('patos://google-setup?q=' + encodeURIComponent(q)) }, 'Set up Google results'), h('button', { class: 'btn', onclick: () => navigate(bingURL(q)) }, 'Try Bing')),
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
            const a = h('div', { class: 'pr-hit' }, h('div', { class: 'pr-url' }, h('span', { class: 'pr-fav', html: PatOS.sym('doc') }), lang + '.wikipedia.org › ' + hit.title), h('a', { class: 'pr-title', href: url }, hit.title), h('p', { class: 'pr-snip', html: hit.snippet.replace(/<(?!\/?span)[^>]*>/g, '') + '…' }));
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
      function googleSetup(q) {
        const inp = h('input', { class: 'field pg-cx', placeholder: 'Search engine ID (looks like a1b2c3d4e5f6g7h8i)', value: googleCx(), spellcheck: 'false' });
        const save = () => {
          let v = inp.value.trim(); const m = v.match(/cx=([\w:-]+)/); if (m) v = m[1];
          PatOS.store.set('googleCx', v);
          if (cseState && v && cseState.cx !== v) { PatOS.alertBox(PatOS.t('Saved'), PatOS.t('Close and reopen PatOS to use your new Search engine ID.'), { icon: 'browser' }); return; }
          navigate(v ? (q ? 'patos://google?q=' + encodeURIComponent(q) : 'patos://newtab') : (q ? bingURL(q) : 'patos://newtab'));
        };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
        return h('div', { class: 'pg-setup' },
          h('div', { class: 'pg-logo big' }, 'Patoogle'),
          h('h2', {}, 'Get real Google results'),
          h('p', {}, 'google.com doesn’t let other apps show it, which is why you saw an error or an old-looking Google page. Google does offer an official search box that apps can use. It gives the same up-to-date results. You just need a free ID for it:'),
          h('ol', {},
            h('li', {}, 'On any device, go to programmablesearchengine.google.com and sign in.'),
            h('li', {}, 'Click Add. Give it any name, and pick “Search the entire web”.'),
            h('li', {}, 'Click Create, then copy the Search engine ID it shows you.'),
            h('li', {}, 'Paste it here. It only stays on this device.')),
          h('div', { class: 'pg-row' }, inp, h('button', { class: 'btn primary', onclick: save }, 'Use Google')),
          googleCx() ? h('button', { class: 'pg-link', onclick: () => { inp.value = ''; save(); } }, 'Stop using Google and search with Bing') : h('button', { class: 'pg-link', onclick: () => navigate(q ? bingURL(q) : 'patos://newtab') }, 'Not now, keep using Bing'));
      }
      function loadHTML(t, html, title) {
        t.url = 'patos://file'; t.title = title || 'Document'; t.hist = [t.url]; t.idx = 0;
        t.pane.innerHTML = ''; t.pane.appendChild(h('iframe', { srcdoc: html, sandbox: 'allow-scripts allow-forms allow-modals' })); syncUI();
      }
      function newTabPage() {
        const q = h('input', { class: 'nt-search', placeholder: 'Search Patoogle or type a web address', spellcheck: 'false' });
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(q.value); });
        const engine = h('div', { class: 'nt-engine' }, h('span', {}, googleCx() ? 'Searching with Google' : 'Searching with Patoogle'), h('button', { class: 'pg-link', onclick: () => navigate('patos://google-setup') }, googleCx() ? 'Change' : 'Use Google instead'));
        const grid = h('div', { class: 'nt-grid' });
        SHORTCUTS.forEach((s) => {
          const tile = h('button', { class: 'nt-tile' }, h('div', { class: 'nt-ic', html: PatOS.iconDefs[s.i] ? PatOS.iconHTML(s.i) : `<div class="nt-letter">${esc(s.i)}</div>` }), h('span', {}, s.t));
          tile.onclick = () => (s.app ? PatOS.launch(s.app) : navigate(s.u)); grid.appendChild(tile);
        });
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        setTimeout(() => q.focus(), 50);
        return h('div', { class: 'nt-page' },
          h('div', { class: 'nt-logo' }, 'Patoogle'),
          h('div', { class: 'nt-greet' }, greet + ', ' + PatOS.settings.userName),
          q, engine, grid,
          h('div', { class: 'nt-tip' }, 'Most sites open right here. A few big ones, like Gmail, won’t load inside other apps, so use the PatOS app for those.'));
      }
      function blockedPage(url) {
        return h('div', { class: 'br-blocked' },
          h('div', { class: 'bb-ic' }, '🧱'),
          h('h2', {}, host(url) + ' can’t be shown inside PatOS'),
          h('p', {}, PatOS.sandboxed ? 'PatOS is running inside a Claude Artifact, which can’t show other websites inside it. Open the page in a real browser tab instead. PatOS stays open in this one.' : 'This site doesn’t let other apps show it, so it won’t open in Patoogle. You can search for it instead, or use the PatOS app that does the same thing (YouTube, Docs, Drive, Maps or Translate).'),
          h('div', { class: 'br-alts' }, h('button', { class: 'btn primary', onclick: () => navigate(searchURL(host(url))) }, 'Search the web for ' + host(url))), h('a', { class: 'br-ext', href: url.replace('youtube-nocookie.com/embed/', 'youtube.com/watch?v=').replace('?autoplay=1', '').replace('igu=1&', '').replace('?igu=1', ''), target: '_blank', rel: 'noopener noreferrer' }, 'Open outside PatOS'));
      }
      omni.addEventListener('keydown', (e) => { if (e.key === 'Enter') { navigate(omni.value); omni.blur(); } });
      omni.addEventListener('focus', () => omni.select());
      bBack.onclick = () => { if (cur.idx > 0) { cur.idx--; navigate(cur.hist[cur.idx], cur, true); } };
      bFwd.onclick = () => { if (cur.idx < cur.hist.length - 1) { cur.idx++; navigate(cur.hist[cur.idx], cur, true); } };
      bReload.onclick = () => navigate(cur.url, cur, true);
      bHome.onclick = () => navigate('patos://newtab');
      bHist.onclick = () => {
        const H = PatOS.store.get('browserHistory', []); const r = bHist.getBoundingClientRect();
        PatOS.menu([{ header: PatOS.t('History') }, ...(H.length ? H.slice(0, 15).map((x) => ({ label: host(x.u) + ' · ' + new Date(x.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), action: () => navigate(x.u) })) : [{ label: PatOS.t('No history yet'), disabled: true }]), { divider: true }, { label: PatOS.t('Clear History'), disabled: !H.length, action: () => PatOS.store.set('browserHistory', []) }], r.left - 200, r.bottom + 4);
      };
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
