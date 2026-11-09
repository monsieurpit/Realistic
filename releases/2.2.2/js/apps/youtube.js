/* YouTube: works like youtube.com inside PatOS. Home, search with suggestions, Shorts, channels,
   comments, related videos, autoplay, subscriptions, likes, Watch later and history.
   Data comes from the PatOS server (no key needed). Videos play in the official YouTube player. */
(function () {
  'use strict';
  const { h } = PatOS;
  const I = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z"/>',
    shorts: '<path d="M14.5 3.5 7 7.6a3.4 3.4 0 0 0 0 6l.9.5-.9.5a3.4 3.4 0 0 0 3.3 6l7.5-4.1a3.4 3.4 0 0 0 0-6l-.9-.5.9-.5a3.4 3.4 0 0 0-3.3-6z"/><path d="m10 9.5 4.5 2.5-4.5 2.5z" fill="currentColor"/>',
    subs: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M6 4h12M10 10.5l5 3-5 3z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    later: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    like: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>',
    share: '<path d="M14 5l7 7-7 7v-4c-5 0-8 1.5-10 5 .5-5 3-10 10-11z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', back: '<path d="M15 5l-7 7 7 7"/>',
    autoplay: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="17" cy="12" r="3" fill="currentColor"/>'
  };
  const ic = (n, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  const LOGO = '<svg viewBox="0 0 100 20" width="100" height="20"><rect x="0" y="1" width="28" height="19" rx="5" fill="#ff0033"/><path d="M11 6v9l8-4.5z" fill="#fff"/><text x="31" y="16" font-family="system-ui,-apple-system,Roboto,sans-serif" font-size="16" font-weight="700" letter-spacing="-.6" fill="currentColor">YouTube</text></svg>';

  /* ---------- where the data comes from ---------- */
  // A found server is remembered. A failure is remembered for 30 seconds only, and not at all while offline,
  // so apps start working again by themselves when the Wi-Fi comes back.
  let serverOK = null, failAt = 0;
  async function server() {
    if (PatOS.sandboxed) return null;
    const custom = (PatOS.store.get('patosServer', '') || '').trim().replace(/\/+$/, '');
    if (serverOK) return serverOK;
    if (navigator.onLine && failAt && Date.now() - failAt < 30000) return null;
    const tryBase = async (b) => { try { const r = await fetch(b + '/api/ping', { cache: 'no-store' }); const j = await r.json(); return j && j.patos ? b : null; } catch (e) { return null; } };
    serverOK = (/^https?:/.test(location.protocol) && await tryBase(location.origin)) || (custom && await tryBase(custom)) || null;
    failAt = serverOK || !navigator.onLine ? 0 : Date.now();
    return serverOK;
  }
  window.addEventListener('online', () => { failAt = 0; });
  PatOS.server = server;
  PatOS.resetServer = () => { serverOK = null; failAt = 0; };
  const hl = () => (PatOS.lang === 'fr' ? 'fr' : 'en');
  const gl = () => ((navigator.language || 'en-CA').split('-')[1] || 'CA').toUpperCase().slice(0, 2);
  /* answers are remembered for a few minutes, so going back, hovering and re-searching are instant */
  const memo = new Map();
  function get(path, params) {
    const key = path + JSON.stringify(params || {}); const hit = memo.get(key); const ttl = path === 'suggest' ? 120000 : 300000;
    if (hit && Date.now() - hit.t < ttl) return hit.p;
    const p = rawGet(path, params); memo.set(key, { t: Date.now(), p });
    p.catch(() => { if (memo.get(key) && memo.get(key).p === p) memo.delete(key); });
    if (memo.size > 120) memo.delete(memo.keys().next().value);
    return p;
  }
  async function rawGet(path, params) {
    const base = await server();
    if (base) {
      const r = await fetch(base + '/api/yt/' + path + '?' + new URLSearchParams(Object.assign({ hl: hl(), gl: gl() }, params)));
      const j = await r.json(); if (j.error) throw new Error(j.error); return j;
    }
    const key = PatOS.store.get('ytKey', '');
    if (key) return keyAPI(key, path, params);
    const e = new Error('noserver'); throw e;
  }
  /* fallback: the official YouTube Data API with the person's own key (for the single-file version) */
  async function keyAPI(key, path, p) {
    const A = 'https://www.googleapis.com/youtube/v3/';
    const call = async (ep, q) => { const r = await fetch(A + ep + '?' + new URLSearchParams(Object.assign({ key }, q))); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; };
    const n = (x) => { x = +x || 0; return x >= 1e9 ? (x / 1e9).toFixed(1) + 'B' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? Math.round(x / 1e3) + 'K' : String(x); };
    const dur = (iso) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ''); if (!m) return ''; const a = +m[1] || 0, b = +m[2] || 0, c = +m[3] || 0; return (a ? a + ':' + String(b).padStart(2, '0') : b) + ':' + String(c).padStart(2, '0'); };
    const dec = (s) => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };
    const vids = async (ids) => { if (!ids.length) return []; const j = await call('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') }); return j.items.map((it) => ({ type: 'video', id: it.id, title: dec(it.snippet.title), channel: it.snippet.channelTitle, channelId: it.snippet.channelId, thumb: 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg', duration: dur(it.contentDetails.duration), views: n(it.statistics.viewCount) + ' views', published: new Date(it.snippet.publishedAt).toLocaleDateString(), desc: it.snippet.description, likes: n(it.statistics.likeCount) })); };
    const srch = async (q) => { const j = await call('search', { part: 'snippet', type: 'video', maxResults: 24, q, safeSearch: 'moderate' }); return vids(j.items.map((i) => i.id.videoId).filter(Boolean)); };
    if (path === 'search') return { items: await srch(p.q), cont: '' };
    if (path === 'home') { const j = await call('videos', { part: 'snippet,statistics,contentDetails', chart: 'mostPopular', maxResults: 24, regionCode: gl() }); return { items: await vids(j.items.map((i) => i.id)), shorts: [] }; }
    if (path === 'video') { const [v] = await vids([p.id]); if (!v) throw new Error('This video isn’t available.'); return Object.assign(v, { views: v.views, date: v.published, related: (await srch(v.title.split(/[|\-–(]/)[0].slice(0, 60))).filter((x) => x.id !== p.id), commentsToken: 'key:' + p.id }); }
    if (path === 'comments') { const j = await call('commentThreads', { part: 'snippet', videoId: p.token.slice(4), maxResults: 20, order: 'relevance', textFormat: 'plainText' }); return { items: j.items.map((c) => { const s = c.snippet.topLevelComment.snippet; return { author: s.authorDisplayName, avatar: s.authorProfileImageUrl, text: s.textDisplay, published: new Date(s.publishedAt).toLocaleDateString(), likes: n(s.likeCount) }; }), cont: '' }; }
    if (path === 'channel') { const j = await call('channels', { part: 'snippet,statistics,brandingSettings', id: p.id }); const c = j.items[0]; const s = await call('search', { part: 'snippet', channelId: p.id, order: 'date', type: 'video', maxResults: 24 }); return { id: p.id, title: c.snippet.title, desc: c.snippet.description, avatar: c.snippet.thumbnails.medium.url, banner: c.brandingSettings && c.brandingSettings.image && c.brandingSettings.image.bannerExternalUrl, subs: n(c.statistics.subscriberCount) + ' subscribers', handle: c.snippet.customUrl, items: await vids(s.items.map((i) => i.id.videoId).filter(Boolean)) }; }
    return { items: [] };
  }

  /* wake the PatOS server and have YouTube's first screen ready before it is opened */
  if (/^https?:/.test(location.protocol) && !PatOS.sandboxed) {
    const warm = async () => {
      try {
        const base = await server(); if (!base) return;
        const topicsNow = (hl() === 'fr' ? ['musique', 'jeux vidéo', 'science', 'humour'] : ['music', 'gaming', 'science', 'comedy']);
        const j = await get('home', { topics: topicsNow.join(',') });
        if (j && j.items && !PatOS.store.get('ytHome:' + hl(), null)) PatOS.store.set('ytHome:' + hl(), { items: j.items, shorts: j.shorts });
      } catch (e) {}
    };
    setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 6000 }) : warm()), 1500);
  }

  PatOS.registerApp({
    id: 'youtube', name: 'YouTube', icon: 'youtube', category: 'Apps', single: true, width: 1180, height: 740, keywords: 'video watch tube music shorts', titlebar: 'hidden',
    about: 'YouTube inside PatOS: search, Shorts, channels, comments and subscriptions, with the official YouTube player.',
    launch(win, args) {
      win.el.classList.add('ytx-win');
      const lib = Object.assign({ subs: [], liked: [], later: [], history: [] }, PatOS.store.get('ytLibrary', {}));
      (PatOS.store.get('ytHistory', []) || []).forEach((v) => { if (!lib.history.some((x) => x.id === v.id)) lib.history.push({ type: 'video', id: v.id, title: v.title, channel: v.channel, thumb: v.thumb || 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg', duration: v.duration }); });
      const saveLib = () => PatOS.store.set('ytLibrary', lib);
      let autoplay = PatOS.store.get('ytAutoplay', true);
      const stack = []; let route = null, upNext = null, scrollMore = null;

      /* ---------- frame ---------- */
      const q = h('input', { class: 'ytx-q', placeholder: 'Search', spellcheck: 'false', autocomplete: 'off' });
      const sugg = h('div', { class: 'ytx-sugg' });
      const bBack = h('button', { class: 'ytx-ib ytx-back', title: 'Back', html: ic('back') });
      const bMenu = h('button', { class: 'ytx-ib', title: 'Menu', html: ic('menu') });
      const logo = h('button', { class: 'ytx-logo', title: 'YouTube Home', html: LOGO });
      const bSet = h('button', { class: 'ytx-ib', title: 'Settings', html: ic('gear') });
      const head = h('div', { class: 'ytx-head' }, h('div', { class: 'ytx-hl' }, bBack, bMenu, logo), h('div', { class: 'ytx-sbox' }, q, h('button', { class: 'ytx-sbtn', title: 'Search', html: ic('search', 20) }), sugg), h('div', { class: 'ytx-hr' }, bSet));
      const nav = h('div', { class: 'ytx-nav' });
      const main = h('div', { class: 'ytx-main no-drag' });
      win.body.appendChild(h('div', { class: 'ytx' }, head, h('div', { class: 'ytx-body' }, nav, main)));
      if (win.el.offsetWidth < 900) win.el.classList.add('ytx-mini');

      function renderNav() {
        nav.innerHTML = '';
        const item = (key, label, icon, fn) => { const b = h('button', { class: 'ytx-ni' + (route && route.key === key ? ' on' : ''), html: ic(icon) + '<span>' + PatOS.t(label) + '</span>' }); b.onclick = fn; nav.appendChild(b); };
        item('home', 'Home', 'home', () => go({ key: 'home' }));
        item('shorts', 'Shorts', 'shorts', () => go({ key: 'shorts' }));
        item('subs', 'Subscriptions', 'subs', () => go({ key: 'subs' }));
        nav.appendChild(h('hr'));
        nav.appendChild(h('div', { class: 'ytx-nh' }, PatOS.t('You')));
        item('history', 'History', 'history', () => go({ key: 'library', which: 'history' }));
        item('later', 'Watch later', 'later', () => go({ key: 'library', which: 'later' }));
        item('liked', 'Liked videos', 'like', () => go({ key: 'library', which: 'liked' }));
        if (lib.subs.length) {
          nav.appendChild(h('hr')); nav.appendChild(h('div', { class: 'ytx-nh' }, PatOS.t('Subscriptions')));
          lib.subs.slice(0, 12).forEach((c) => { const b = h('button', { class: 'ytx-ni ch' }, h('img', { src: c.avatar || '', alt: '' }), h('span', {}, c.title)); b.onclick = () => go({ key: 'channel', id: c.id }); nav.appendChild(b); });
        }
      }
      function go(r, replace) {
        if (route && !replace) stack.push(route);
        route = r; render();
      }
      function render() {
        scrollMore = null; upNext = null;
        main.scrollTop = 0; main.innerHTML = ''; main.classList.remove('ytx-noscroll');
        win.el.classList.toggle('ytx-watching', route.key === 'watch');
        bBack.style.display = stack.length ? '' : 'none';
        renderNav();
        ({ home, search, watch, channel, shorts, subs, library, settings })[route.key](route);
      }
      bBack.onclick = () => { if (stack.length) { route = stack.pop(); render(); } };
      bMenu.onclick = () => win.el.classList.toggle('ytx-mini');
      logo.onclick = () => go({ key: 'home' });
      bSet.onclick = () => go({ key: 'settings' });
      main.addEventListener('scroll', () => { if (scrollMore && main.scrollTop + main.clientHeight > main.scrollHeight - 600) { const f = scrollMore; scrollMore = null; f(); } });

      /* ---------- bits ---------- */
      const spinner = () => h('div', { class: 'ytx-load' }, h('div', { class: 'ytx-spin' }));
      const skeleton = (n, rows) => h('div', { class: rows ? 'ytx-results' : 'ytx-grid' }, ...Array.from({ length: n }, () => h('div', { class: 'ytx-card ytx-sk' + (rows ? ' row' : '') }, h('div', { class: 'ytx-th' }), h('div', { class: 'ytx-ci' }, rows ? null : h('div', { class: 'ytx-av' }), h('div', { class: 'ytx-ct' }, h('b', {}), h('small', {}), h('small', {}))))));
      function problem(e, retry) {
        if (PatOS.isOffline()) return PatOS.offlineCard(retry, { body: 'YouTube needs the internet. Videos you were watching will load by themselves when you’re back online.' });
        const box = h('div', { class: 'ytx-msg' });
        if (e.message === 'noserver' && /^https?:/.test(location.protocol) && !PatOS.sandboxed && !PatOS.store.get('ytKey', '')) {
          box.append(h('div', { class: 'ytx-bigic', html: PatOS.iconHTML('youtube') }), h('h2', {}, PatOS.t('The PatOS server didn’t answer')),
            h('p', {}, PatOS.t('It may be waking up, which can take up to a minute. Try again in a moment.')), retry ? h('button', { class: 'ytx-btn', onclick: () => { PatOS.resetServer(); retry(); } }, PatOS.t('Try again')) : null);
        } else if (e.message === 'noserver') {
          box.append(h('div', { class: 'ytx-bigic', html: PatOS.iconHTML('youtube') }), h('h2', {}, PatOS.t('YouTube needs the PatOS website')),
            h('p', {}, PatOS.sandboxed ? PatOS.t('This copy of PatOS runs inside a Claude Artifact, which blocks YouTube. Open PatOS from its website (your Render link) and YouTube works there.') : PatOS.t('This copy of PatOS was opened as a file, so it has no server to ask YouTube for videos. Open PatOS from its website (your Render link), or type that link in Settings so this copy can use it.')),
            h('button', { class: 'ytx-btn', onclick: () => go({ key: 'settings' }) }, PatOS.t('Settings')));
        } else box.append(h('h2', {}, PatOS.t('Something went wrong')), h('p', {}, navigator.onLine ? PatOS.t('YouTube didn’t answer. If you’re at school, YouTube may be blocked on this network.') + ' (' + e.message + ')' : PatOS.t('You’re offline.')), retry ? h('button', { class: 'ytx-btn', onclick: retry }, PatOS.t('Try again')) : null);
        return box;
      }
      const avatar = (src, name, cls) => (src ? h('img', { class: 'ytx-av ' + (cls || ''), src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('div', { class: 'ytx-av ph ' + (cls || '') }, (name || '?').replace('@', '').charAt(0).toUpperCase()));
      function card(v, mode) {
        const thumb = h('div', { class: 'ytx-th' }, h('img', { src: v.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }), v.live ? h('span', { class: 'ytx-dur live' }, PatOS.t('LIVE')) : v.duration ? h('span', { class: 'ytx-dur' }, v.duration) : null, bad.has(v.id) ? h('span', { class: 'ytx-ext', title: PatOS.t('The uploader doesn’t allow this video to play outside youtube.com.') }, PatOS.t('youtube.com only')) : null);
        const meta = [v.views, v.published].filter(Boolean).join(' · ');
        const chan = h('button', { class: 'ytx-cn' }, v.channel || '');
        if (v.channelId) chan.onclick = (e) => { e.stopPropagation(); go({ key: 'channel', id: v.channelId }); };
        const c = h('div', { class: 'ytx-card ' + (mode || '') },
          thumb,
          h('div', { class: 'ytx-ci' }, mode === 'row' || mode === 'side' ? null : avatar(v.avatar, v.channel),
            h('div', { class: 'ytx-ct' }, h('b', {}, v.title), mode === 'row' ? h('small', {}, meta) : null, mode === 'row' ? h('div', { class: 'ytx-rowch' }, v.avatar ? avatar(v.avatar, v.channel, 'xs') : null, chan) : chan, mode === 'row' ? null : h('small', {}, meta), mode === 'row' && v.desc ? h('p', {}, v.desc) : null)));
        c.onclick = () => go({ key: 'watch', id: v.id, v });
        let pre = 0; c.addEventListener('pointerenter', () => { if (!pre) pre = setTimeout(() => { get('video', { id: v.id }).catch(() => {}); }, 120); }); c.addEventListener('pointerleave', () => { clearTimeout(pre); pre = 0; });
        c.addEventListener('touchstart', () => { get('video', { id: v.id }).catch(() => {}); }, { passive: true });
        c.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: PatOS.t('Save to Watch later'), action: () => toggleList('later', v, true) }, { label: PatOS.t('Copy link'), action: () => copyLink(v.id) }], e.clientX, e.clientY); };
        return c;
      }
      function shortCard(s, list) {
        const c = h('div', { class: 'ytx-short' }, h('img', { src: s.thumb2 || s.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }), h('div', {}, h('b', {}, s.title), h('small', {}, s.views || '')));
        c.onclick = () => go({ key: 'shorts', list, start: list.indexOf(s) });
        return c;
      }
      const grid = (list) => { const g = h('div', { class: 'ytx-grid' }); list.forEach((v) => g.appendChild(card(v))); return g; };
      const shelf = (list) => { const s = h('div', { class: 'ytx-shelf' }, h('h3', { html: ic('shorts', 24) + '<span>Shorts</span>' })); const row = h('div', { class: 'ytx-srow' }); list.forEach((x) => row.appendChild(shortCard(x, list))); s.appendChild(row); return s; };
      function copyLink(id) { const u = 'https://youtu.be/' + id; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => PatOS.notify({ title: PatOS.t('Link copied'), body: u, icon: 'youtube' })).catch(() => PatOS.alertBox(PatOS.t('Share'), u)); }
      function slim(v) { return { type: 'video', id: v.id, title: v.title, channel: v.channel, channelId: v.channelId, thumb: v.thumb || 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg', duration: v.duration || '', avatar: v.avatar || '' }; }
      function toggleList(which, v, forceOn) {
        const i = lib[which].findIndex((x) => x.id === v.id);
        if (i >= 0 && !forceOn) lib[which].splice(i, 1); else if (i < 0) lib[which].unshift(slim(v));
        saveLib(); if (forceOn && which === 'later') PatOS.notify({ title: PatOS.t('Saved to Watch later'), body: v.title, icon: 'youtube' });
        return i < 0 || forceOn;
      }

      /* ---------- pages ---------- */
      const CHIPS = [['All', ''], ['Music', 'music'], ['Gaming', 'gaming'], ['Minecraft', 'minecraft'], ['Live', 'live'], ['Science', 'science'], ['Sports', 'sports highlights'], ['Comedy', 'comedy'], ['Animals', 'funny animals'], ['Cooking', 'cooking'], ['Lofi', 'lofi'], ['News', 'news today'], ['Space', 'space'], ['Cars', 'cars']];
      function topics() {
        const fromHist = lib.history.slice(0, 4).map((v) => v.channel).filter(Boolean);
        const base = PatOS.lang === 'fr' ? ['musique', 'jeux vidéo', 'science', 'humour', 'sport'] : ['music', 'gaming', 'science', 'comedy', 'sports'];
        return [...new Set([...fromHist.slice(0, 1), ...base])].slice(0, 4);
      }
      function home(r) {
        win.setTitle('YouTube');
        const chips = h('div', { class: 'ytx-chips' }, ...CHIPS.map(([l, t]) => h('button', { class: (r.chip || '') === t ? 'on' : '', onclick: () => go({ key: 'home', chip: t }, true) }, PatOS.t(l))));
        main.append(chips); const box = h('div'); main.appendChild(box);
        const cacheKey = 'ytHome:' + hl() + (r.chip || '');
        const paint = (j) => {
          if (route !== r) return;
          const top = main.scrollTop; box.innerHTML = '';
          box.appendChild(grid(j.items.slice(0, 12)));
          if (j.shorts && j.shorts.length) box.appendChild(shelf(j.shorts));
          if (j.items.length > 12) box.appendChild(grid(j.items.slice(12)));
          if (j.cont) moreSearch(box, j.q, j.cont);
          main.scrollTop = top;
        };
        const cached = PatOS.store.get(cacheKey, null);
        if (cached && cached.items && cached.items.length) paint(cached); else box.appendChild(skeleton(12));
        const p = r.chip ? get('search', { q: r.chip }).then((j) => ({ items: j.items.filter((x) => x.type === 'video'), shorts: j.items.filter((x) => x.type === 'short'), cont: j.cont, q: r.chip })) : get('home', { topics: topics().join(',') });
        p.then((j) => { if (!(cached && cached.items && JSON.stringify(cached.items.slice(0, 6).map((x) => x.id)) === JSON.stringify(j.items.slice(0, 6).map((x) => x.id)))) paint(j); PatOS.store.set(cacheKey, { items: j.items, shorts: j.shorts, cont: j.cont, q: j.q }); })
          .catch((e) => { if (cached && cached.items && cached.items.length) return; box.innerHTML = ''; box.appendChild(problem(e, () => render())); });
      }
      function moreSearch(box, text, cont, rows) {
        scrollMore = () => {
          const sp = spinner(); box.appendChild(sp);
          get('search', { cont }).then((j) => {
            sp.remove();
            const vids = j.items.filter((x) => x.type === 'video');
            if (rows) vids.forEach((v) => box.appendChild(card(v, 'row'))); else box.appendChild(grid(vids));
            if (j.cont) moreSearch(box, text, j.cont, rows);
          }).catch(() => sp.remove());
        };
      }
      function search(r) {
        win.setTitle(r.q + ' - YouTube'); q.value = r.q;
        const box = h('div', { class: 'ytx-results' }); main.appendChild(box); box.appendChild(skeleton(6, true));
        get('search', { q: r.q }).then((j) => {
          box.innerHTML = '';
          if (!j.items.length) { box.appendChild(h('div', { class: 'ytx-msg' }, h('h2', {}, PatOS.t('No results found')), h('p', {}, PatOS.t('Try different keywords.')))); return; }
          const shorts = j.items.filter((x) => x.type === 'short');
          let shelfDone = false;
          j.items.forEach((it, i) => {
            if (it.type === 'channel') {
              const sub = lib.subs.some((s) => s.id === it.id);
              const b = h('button', { class: 'ytx-subbtn' + (sub ? ' on' : '') }, PatOS.t(sub ? 'Subscribed' : 'Subscribe'));
              b.onclick = (e) => { e.stopPropagation(); subscribe(it, b); };
              const row = h('div', { class: 'ytx-chrow' }, avatar(it.avatar, it.title, 'xl'), h('div', {}, h('b', {}, it.title), h('small', {}, [it.handle, it.subs].filter(Boolean).join(' · ')), h('p', {}, it.desc || '')), b);
              row.onclick = () => go({ key: 'channel', id: it.id }); box.appendChild(row);
            } else if (it.type === 'video') box.appendChild(card(it, 'row'));
            else if (!shelfDone && i > 2) { shelfDone = true; box.appendChild(shelf(shorts)); }
          });
          if (j.cont) moreSearch(box, r.q, j.cont, true);
        }).catch((e) => { box.innerHTML = ''; box.appendChild(problem(e, () => render())); });
      }
      function subscribe(c, btn) {
        const i = lib.subs.findIndex((s) => s.id === c.id);
        if (i >= 0) lib.subs.splice(i, 1); else lib.subs.unshift({ id: c.id, title: c.title || c.channel, avatar: c.avatar || '' });
        saveLib(); renderNav();
        if (btn) { const on = i < 0; btn.classList.toggle('on', on); btn.textContent = PatOS.t(on ? 'Subscribed' : 'Subscribe'); }
      }
      /* The official YouTube player, controlled with YouTube's own iframe messages. It tells us when a video
         ends, and when it can't play (the uploader turned off playback on other sites, a school block, etc.). */
      const bad = new Set(PatOS.store.get('ytNoEmbed', []));
      const markBad = (id) => { bad.add(id); PatOS.store.set('ytNoEmbed', [...bad].slice(-500)); };
      const ERR = {
        2: 'This video link isn’t valid.',
        5: 'This video can’t play in this browser.',
        100: 'This video was removed or made private.',
        101: 'The uploader doesn’t allow this video to play outside youtube.com.',
        150: 'The uploader doesn’t allow this video to play outside youtube.com.',
        152: 'YouTube didn’t allow this video to play here.',
        153: 'YouTube didn’t allow this video to play here.',
        auth: 'YouTube wants to check that you’re not a robot before it plays videos inside other apps on this network.',
        embedder_identity_denied: 'YouTube didn’t allow this video to play here.'
      };
      const NETWORK = (code) => code === 'auth' || code === 152 || code === 153 || code === 'embedder_identity_denied';
      let errStreak = 0;
      function player(id, o) {
        o = o || {};
        const web = /^https?:/.test(location.protocol);
        const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1', enablejsapi: '1', modestbranding: '1', iv_load_policy: '3' });
        if (o.short) { params.set('loop', '1'); params.set('playlist', id); params.set('controls', '0'); }
        if (o.muted) params.set('mute', '1');
        if (web) { params.set('origin', location.origin); params.set('widget_referrer', location.origin + '/'); }
        const f = h('iframe', { src: 'https://www.youtube.com/embed/' + id + '?' + params, allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', title: 'YouTube video player' });
        const wrap = h('div', { class: 'ytx-pwrap' }, f);
        let heard = false, state = -1, done = false, started = false, errTimer = null;
        const send = (func, args) => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [], id: 1, channel: 'widget' }), '*'); } catch (e) {} };
        wrap.cmd = send;
        wrap.state = () => state;
        const showError = (code) => {
          if (done || started) return; done = true;
          const net = NETWORK(code);
          if (!net) markBad(id);
          errStreak++;
          const msg = ERR[code] || 'This video can’t play here.';
          const box = h('div', { class: 'ytx-perr' },
            h('b', {}, PatOS.t(msg)),
            net ? h('small', {}, PatOS.t('This usually happens when the browser blocks YouTube’s sign-in inside other sites (common on school Chromebooks). Signing in to YouTube in this browser often fixes it. You can always watch on youtube.com.')) : null,
            !net && errStreak >= 4 ? h('small', {}, PatOS.t('Lots of videos are failing in a row. Your school or network may limit YouTube on this device.')) : null,
            h('small', { class: 'ytx-code' }, PatOS.t('Error code') + ' ' + code),
            h('div', { class: 'ytx-perrb' },
              h('button', { class: 'ytx-btn', onclick: () => PatOS.openExternal('https://www.youtube.com/' + (o.short ? 'shorts/' : 'watch?v=') + id) }, PatOS.t('Watch on youtube.com')),
              net ? h('button', { class: 'ytx-btn', onclick: () => PatOS.openExternal('https://accounts.google.com/ServiceLogin?service=youtube&continue=' + encodeURIComponent('https://www.youtube.com/')) }, PatOS.t('Sign in to YouTube')) : null,
              net ? h('button', { class: 'ytx-btn', onclick: () => { const pw = wrap.parentNode; const nw = player(id, o); wrap.replaceWith(nw); } }, PatOS.t('Try again')) : null,
              o.onSkip ? h('button', { class: 'ytx-btn', onclick: () => o.onSkip() }, PatOS.t(o.short ? 'Next Short' : 'Play the next video')) : null));
          wrap.appendChild(box);
          if (o.onError) o.onError(code, net);
        };
        const onMsg = (e) => {
          if (e.source !== f.contentWindow) return;
          let d = e.data; try { d = typeof d === 'string' ? JSON.parse(d) : d; } catch (err) { return; }
          if (!d || typeof d !== 'object') return;
          heard = true;
          if (d.event === 'onError') return showError(d.info);
          if (d.event === 'infoDelivery' && d.info && d.info.videoData && d.info.videoData.errorCode && !started && !errTimer) {
            const code = d.info.videoData.errorCode;
            errTimer = setTimeout(() => { if (!started && f.isConnected) showError(/^\d+$/.test(code) ? +code : code); }, 1500);
          }
          let st = null;
          if (d.event === 'onStateChange') st = d.info;
          else if (d.event === 'infoDelivery' && d.info && typeof d.info.playerState === 'number') st = d.info.playerState;
          if (st === null || st === state) return;
          state = st;
          if (st === 1) { started = true; errStreak = 0; clearTimeout(errTimer); }
          if (o.onState) o.onState(st);
          if (st === 0 && o.onEnd) { const fn = o.onEnd; o.onEnd = null; fn(); }
        };
        window.addEventListener('message', onMsg);
        // keep saying hello until the player answers (it loads after the iframe's load event)
        let tries = 0;
        const hello = setInterval(() => { if (heard || ++tries > 40 || !f.isConnected) return clearInterval(hello); try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) {} }, 250);
        // if autoplay with sound is blocked, start muted and offer sound
        setTimeout(() => {
          if (!f.isConnected || started || done || !heard) return;
          if (state === -1 || state === 5) { send('mute'); send('playVideo'); setTimeout(() => { if (state === 1 && f.isConnected && !wrap.querySelector('.ytx-unmute')) { const u = h('button', { class: 'ytx-unmute' }, PatOS.t('Tap for sound')); u.onclick = (ev) => { ev.stopPropagation(); send('unMute'); send('setVolume', [100]); u.remove(); }; wrap.appendChild(u); } }, 900); }
        }, 2500);
        const obs = new MutationObserver(() => { if (!f.isConnected) { window.removeEventListener('message', onMsg); clearInterval(hello); obs.disconnect(); } });
        obs.observe(main, { childList: true, subtree: true });
        return wrap;
      }
      function watch(r) {
        const id = r.id, v0 = r.v || {};
        win.setTitle(v0.title || 'YouTube');
        const info = h('div', { class: 'ytx-winfo' }), side = h('div', { class: 'ytx-side' });
        const nextUp = () => upNext && go({ key: 'watch', id: upNext.id, v: upNext }, true);
        const next = () => { if (autoplay) nextUp(); };
        const pl = h('div', { class: 'ytx-player' }, player(id, { onEnd: next, onSkip: () => nextUp() }));
        main.appendChild(h('div', { class: 'ytx-watch' }, h('div', { class: 'ytx-left' }, pl, info), side));
        info.appendChild(h('h1', { class: 'ytx-wt' }, v0.title || ''));
        side.appendChild(spinner());
        get('video', { id }).then((v) => {
          win.setTitle(v.title);
          const hv = slim(Object.assign({}, v0, v, { thumb: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg', duration: v0.duration }));
          const hi = lib.history.findIndex((x) => x.id === id); if (hi >= 0) lib.history.splice(hi, 1); lib.history.unshift(hv); lib.history.length = Math.min(lib.history.length, 200); saveLib();
          info.innerHTML = '';
          const sub = lib.subs.some((s) => s.id === v.channelId);
          const bSub = h('button', { class: 'ytx-subbtn' + (sub ? ' on' : '') }, PatOS.t(sub ? 'Subscribed' : 'Subscribe'));
          bSub.onclick = () => subscribe({ id: v.channelId, title: v.channel, avatar: v.avatar }, bSub);
          const liked = lib.liked.some((x) => x.id === id);
          const bLike = h('button', { class: 'ytx-pill' + (liked ? ' on' : ''), html: ic('like', 20) + '<span>' + (v.likes || PatOS.t('Like')) + '</span>' });
          bLike.onclick = () => { const on = toggleList('liked', hv); bLike.classList.toggle('on', on); };
          const inLater = lib.later.some((x) => x.id === id);
          const bLater = h('button', { class: 'ytx-pill' + (inLater ? ' on' : ''), html: ic('later', 20) + '<span>' + PatOS.t('Save') + '</span>' });
          bLater.onclick = () => { const on = toggleList('later', hv); bLater.classList.toggle('on', on); };
          const bShare = h('button', { class: 'ytx-pill', html: ic('share', 20) + '<span>' + PatOS.t('Share') + '</span>' }); bShare.onclick = () => copyLink(id);
          const bOpen = h('button', { class: 'ytx-pill', title: PatOS.t('If the video won’t play here, open it on youtube.com'), html: '<span>' + PatOS.t('Open on YouTube') + '</span>' }); bOpen.onclick = () => PatOS.openExternal('https://www.youtube.com/watch?v=' + id);
          const chan = h('div', { class: 'ytx-chan' }, avatar(v.avatar, v.channel), h('div', { class: 'ytx-chn' }, h('b', {}, v.channel), h('small', {}, v.subs || '')), bSub);
          chan.querySelector('.ytx-chn').onclick = () => v.channelId && go({ key: 'channel', id: v.channelId });
          const desc = h('div', { class: 'ytx-desc' }, h('b', {}, [v.views, v.date].filter(Boolean).join('  ')), h('div', { class: 'ytx-dtext' }, linkify(v.desc || '')), h('button', { class: 'ytx-more' }, PatOS.t('...more')));
          desc.onclick = (e) => { if (e.target.closest('a')) return; desc.classList.toggle('open'); desc.querySelector('.ytx-more').textContent = PatOS.t(desc.classList.contains('open') ? 'Show less' : '...more'); };
          info.append(h('h1', { class: 'ytx-wt' }, v.title), h('div', { class: 'ytx-bar' }, chan, h('div', { class: 'ytx-acts' }, bLike, bShare, bLater, bOpen)), desc);
          const cbox = h('div', { class: 'ytx-comments' }); info.appendChild(cbox);
          if (v.commentsToken) loadComments(cbox, v.commentsToken, true); else cbox.appendChild(h('p', { class: 'ytx-dim' }, PatOS.t('Comments are turned off.')));
          // related
          side.innerHTML = '';
          const ap = h('label', { class: 'ytx-ap' }, h('span', {}, PatOS.t('Autoplay')), h('input', { type: 'checkbox' }));
          ap.querySelector('input').checked = autoplay; ap.querySelector('input').onchange = (e) => { autoplay = e.target.checked; PatOS.store.set('ytAutoplay', autoplay); };
          side.appendChild(ap);
          const rel = (v.related || []).filter((x) => x.id !== id);
          rel.sort((a, b2) => (bad.has(a.id) ? 1 : 0) - (bad.has(b2.id) ? 1 : 0));
          upNext = rel[0] || null;
          rel.forEach((x) => side.appendChild(card(x, 'side')));
          if (v.relatedCont) {
            let cont = v.relatedCont;
            const more = h('button', { class: 'ytx-btn wide' }, PatOS.t('Show more'));
            more.onclick = () => { more.disabled = true; get('more', { token: cont }).then((j) => { j.items.forEach((x) => side.insertBefore(card(x, 'side'), more)); cont = j.cont; more.disabled = false; if (!cont) more.remove(); }).catch(() => more.remove()); };
            side.appendChild(more);
          }
        }).catch((e) => { side.innerHTML = ''; info.appendChild(problem(e, () => render())); });
      }
      function linkify(t) {
        const out = h('span');
        t.split(/(https?:\/\/[^\s]+)/g).forEach((part) => {
          if (/^https?:\/\//.test(part)) { const a = h('a', { href: part }, part.length > 60 ? part.slice(0, 57) + '…' : part); a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const m = part.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/); if (m) go({ key: 'watch', id: m[1] }); else PatOS.launch('browser', { url: part }); }; out.appendChild(a); }
          else out.appendChild(document.createTextNode(part));
        });
        return out;
      }
      function loadComments(box, token, first) {
        const sp = spinner(); box.appendChild(sp);
        get('comments', { token }).then((j) => {
          sp.remove();
          if (first) box.appendChild(h('h3', {}, (j.count ? j.count + ' ' : '') + (j.count && /comment/i.test(j.count) ? '' : PatOS.t('Comments'))));
          if (first && !j.items.length) box.appendChild(h('p', { class: 'ytx-dim' }, PatOS.t('Comments are turned off.')));
          j.items.forEach((c) => box.appendChild(h('div', { class: 'ytx-cm' }, avatar(c.avatar, c.author, 'sm'), h('div', {}, h('div', { class: 'ytx-cmh' }, h('b', {}, c.author), h('small', {}, c.published)), h('p', {}, c.text), h('div', { class: 'ytx-cmf', html: ic('like', 16) + '<span>' + (c.likes || '') + '</span>' + (c.replies ? '<em>' + c.replies + ' ' + PatOS.t('replies') + '</em>' : '') })))));
          if (j.cont) scrollMore = () => loadComments(box, j.cont, false);
        }).catch(() => { sp.remove(); if (first) box.appendChild(h('p', { class: 'ytx-dim' }, PatOS.t('Comments couldn’t load.'))); });
      }
      function channel(r) {
        const box = h('div', { class: 'ytx-channel' }); main.appendChild(box); box.appendChild(spinner());
        get('channel', { id: r.id }).then((c) => {
          win.setTitle(c.title + ' - YouTube');
          box.innerHTML = '';
          const sub = lib.subs.some((s) => s.id === c.id);
          const b = h('button', { class: 'ytx-subbtn big' + (sub ? ' on' : '') }, PatOS.t(sub ? 'Subscribed' : 'Subscribe'));
          b.onclick = () => subscribe(c, b);
          if (c.banner) box.appendChild(h('div', { class: 'ytx-banner', style: { backgroundImage: 'url("' + c.banner + '")' } }));
          box.append(h('div', { class: 'ytx-chead' }, avatar(c.avatar, c.title, 'xxl'), h('div', {}, h('h1', {}, c.title), h('small', {}, [c.handle, c.subs].filter(Boolean).join(' · ')), h('p', {}, (c.desc || '').split('\n')[0].slice(0, 160)), b)),
            h('div', { class: 'ytx-tabs' }, h('span', { class: 'on' }, PatOS.t('Videos'))));
          const g = grid(c.items); box.appendChild(g);
          const more = (cont) => { scrollMore = () => { const sp = spinner(); box.appendChild(sp); get('channel', { cont }).then((j) => { sp.remove(); j.items.filter((x) => x.type === 'video').forEach((v) => { v.channel = v.channel || c.title; g.appendChild(card(v)); }); if (j.cont) more(j.cont); }).catch(() => sp.remove()); }; };
          if (c.cont) more(c.cont);
        }).catch((e) => { box.innerHTML = ''; box.appendChild(problem(e, () => render())); });
      }
      /* Shorts: a vertical feed you scroll or swipe through, one Short per screen. Only the Short on
         screen gets a player; a clear layer over it keeps scrolling and swiping working. */
      function shorts(r) {
        win.setTitle('Shorts - YouTube');
        const feed = h('div', { class: 'ytx-sfeed', tabIndex: 0 }); main.appendChild(feed);
        main.classList.add('ytx-noscroll');
        let list = (r.list || []).filter((s2) => !bad.has(s2.id)), active = -1, loading = false, muted = false;
        const items = [];
        const mk = (s2, k) => {
          const liked = lib.liked.some((x) => x.id === s2.id);
          const bL = h('button', { class: 'ytx-sact' + (liked ? ' on' : ''), html: ic('like', 26) + '<small>' + PatOS.t('Like') + '</small>' }); bL.onclick = () => bL.classList.toggle('on', toggleList('liked', Object.assign({ thumb: s2.thumb2 }, s2)));
          const bS = h('button', { class: 'ytx-sact', html: ic('share', 26) + '<small>' + PatOS.t('Share') + '</small>' }); bS.onclick = () => copyLink(s2.id);
          const bO = h('button', { class: 'ytx-sact', html: ic('back', 26).replace('M15 5l-7 7 7 7', 'M9 5l7 7-7 7') + '<small>YouTube</small>' }); bO.onclick = () => PatOS.openExternal('https://www.youtube.com/shorts/' + s2.id);
          const slot = h('div', { class: 'ytx-sslot' }, h('img', { src: s2.thumb2 || s2.thumb, alt: '', referrerpolicy: 'no-referrer' }));
          const cover = h('div', { class: 'ytx-scover' });
          const icon = h('div', { class: 'ytx-sicon' });
          cover.onclick = () => { const pw = slot.querySelector('.ytx-pwrap'); if (!pw) return; const playingNow = pw.state() === 1; pw.cmd(playingNow ? 'pauseVideo' : 'playVideo'); icon.innerHTML = playingNow ? '❚❚' : '▶'; icon.classList.remove('show'); void icon.offsetWidth; icon.classList.add('show'); };
          const item = h('section', { class: 'ytx-sitem' },
            h('div', { class: 'ytx-sbox2' }, slot, cover, icon, h('div', { class: 'ytx-stitle' }, h('b', {}, s2.title), h('small', {}, s2.views || ''))),
            h('div', { class: 'ytx-sacts' }, bL, bS, bO));
          item.dataset.k = k; item._slot = slot; item._s = s2;
          return item;
        };
        const addItems = (arr) => { arr.forEach((s2) => { const it = mk(s2, items.length); items.push(it); feed.appendChild(it); io.observe(it); }); };
        function activate(k) {
          if (k === active || !items[k]) return;
          if (items[active]) { const sl = items[active]._slot; const pw = sl.querySelector('.ytx-pwrap'); if (pw) pw.remove(); sl.querySelector('img').style.display = ''; }
          active = k;
          const it = items[k], sl = it._slot;
          sl.querySelector('img').style.display = 'none';
          sl.appendChild(player(it._s.id, { short: true, muted, onSkip: () => goTo(k + 1), onError: (code, net) => { if (!net) setTimeout(() => { if (active === k) goTo(k + 1); }, 1800); } }));
          if (k >= items.length - 3) more();
        }
        const io = new IntersectionObserver((ents) => { ents.forEach((en) => { if (en.isIntersecting && en.intersectionRatio > 0.6) activate(+en.target.dataset.k); }); }, { root: feed, threshold: [0.6] });
        const goTo = (k) => { if (items[k]) items[k].scrollIntoView({ behavior: 'smooth', block: 'start' }); else more(); };
        const QUERIES = PatOS.lang === 'fr' ? ['drôle', 'tendance', 'animaux', 'sport', 'minecraft', 'cuisine', 'science', 'musique'] : ['funny', 'trending', 'animals', 'sports', 'minecraft', 'satisfying', 'science', 'music', 'gaming', 'art'];
        let qi = 0;
        function more() {
          if (loading) return; loading = true;
          const term = QUERIES[qi++ % QUERIES.length] + ' #shorts';
          get('search', { q: term }).then((j) => {
            const fresh = j.items.filter((x) => x.type === 'short' && !bad.has(x.id) && !items.some((it) => it._s.id === x.id));
            addItems(fresh); loading = false;
            if (!items.length) { feed.appendChild(h('div', { class: 'ytx-msg' }, PatOS.t('No Shorts found.'))); }
          }).catch((e) => { loading = false; if (!items.length) { feed.innerHTML = ''; feed.appendChild(problem(e, () => render())); } });
        }
        const nav = h('div', { class: 'ytx-snavs' },
          h('button', { class: 'ytx-snav', title: 'Previous', html: ic('up', 26), onclick: () => goTo(Math.max(0, active - 1)) }),
          h('button', { class: 'ytx-snav', title: 'Next', html: ic('down', 26), onclick: () => goTo(active + 1) }));
        main.appendChild(nav);
        const onKey = (e) => {
          if (route.key !== 'shorts' || !feed.isConnected) return document.removeEventListener('keydown', onKey);
          if (e.target.tagName === 'INPUT') return;
          if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); goTo(active + 1); }
          if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); goTo(Math.max(0, active - 1)); }
          if (e.key === ' ') { e.preventDefault(); const it = items[active]; if (it) it.querySelector('.ytx-scover').click(); }
        };
        document.addEventListener('keydown', onKey);
        if (list.length) { addItems(list); const st = Math.max(0, Math.min(list.length - 1, r.start || 0)); setTimeout(() => { items[st].scrollIntoView({ block: 'start' }); activate(st); }, 30); }
        else { feed.appendChild(spinner()); more(); setTimeout(() => { const sp = feed.querySelector('.ytx-load'); if (sp && items.length) sp.remove(); }, 4000); }
        const obs = new MutationObserver(() => { const sp = feed.querySelector('.ytx-load'); if (sp && items.length) sp.remove(); });
        obs.observe(feed, { childList: true });
      }
      function subs() {
        win.setTitle(PatOS.t('Subscriptions') + ' - YouTube');
        if (!lib.subs.length) { main.appendChild(h('div', { class: 'ytx-msg' }, h('div', { class: 'ytx-bigic', html: ic('subs', 64) }), h('h2', {}, PatOS.t('No subscriptions yet')), h('p', {}, PatOS.t('Press Subscribe on a channel and its newest videos show up here.')))); return; }
        const box = h('div'); main.appendChild(box);
        box.appendChild(h('div', { class: 'ytx-subrow' }, ...lib.subs.map((c) => { const b = h('button', {}, avatar(c.avatar, c.title, 'lg'), h('small', {}, c.title)); b.onclick = () => go({ key: 'channel', id: c.id }); return b; })));
        const g = h('div'); box.appendChild(g); g.appendChild(spinner());
        Promise.all(lib.subs.slice(0, 10).map((c) => get('channel', { id: c.id }).then((j) => j.items.slice(0, 8).map((v) => Object.assign(v, { channel: v.channel || c.title, avatar: v.avatar || c.avatar }))).catch(() => []))).then((lists) => {
          const out = []; for (let k = 0; k < 8; k++) lists.forEach((l) => l[k] && out.push(l[k]));
          g.innerHTML = ''; g.appendChild(h('h2', { class: 'ytx-h2' }, PatOS.t('Latest'))); g.appendChild(grid(out));
        });
      }
      function library(r) {
        const names = { history: 'History', later: 'Watch later', liked: 'Liked videos' };
        win.setTitle(PatOS.t(names[r.which]) + ' - YouTube');
        const list = lib[r.which];
        const head2 = h('div', { class: 'ytx-libhead' }, h('h1', {}, PatOS.t(names[r.which])), h('small', {}, list.length + ' ' + PatOS.t('videos')),
          list.length ? h('button', { class: 'ytx-btn', onclick: async () => { if (await PatOS.confirmBox(PatOS.t('Clear this list?'), '', { danger: true, ok: 'Clear', icon: 'youtube' })) { lib[r.which] = []; saveLib(); render(); } } }, PatOS.t(r.which === 'history' ? 'Clear all watch history' : 'Clear list')) : null);
        main.appendChild(head2);
        if (!list.length) { main.appendChild(h('div', { class: 'ytx-msg' }, h('p', {}, PatOS.t('Nothing here yet.')))); return; }
        const box = h('div', { class: 'ytx-results' }); list.forEach((v) => box.appendChild(card(v, 'row'))); main.appendChild(box);
      }
      function settings() {
        win.setTitle(PatOS.t('Settings') + ' - YouTube');
        const srvIn = h('input', { class: 'field', placeholder: 'https://your-patos.onrender.com', value: PatOS.store.get('patosServer', ''), spellcheck: 'false' });
        const keyIn = h('input', { class: 'field', placeholder: PatOS.t('Optional'), value: PatOS.store.get('ytKey', ''), spellcheck: 'false' });
        const status = h('p', { class: 'ytx-dim' }, PatOS.t('Checking…'));
        server().then((b) => { status.textContent = b ? PatOS.t('Connected. Search, Shorts, comments and channels work with no key.') + ' (' + b.replace(/^https?:\/\//, '') + ')' : PatOS.t('Not connected to a PatOS website.'); });
        main.appendChild(h('div', { class: 'ytx-settings' },
          h('h1', {}, PatOS.t('Settings')),
          h('h3', {}, PatOS.t('Connection')), status,
          h('p', {}, PatOS.t('If you opened PatOS as a file, type your PatOS website address here (for example your Render link):')),
          h('div', { class: 'ytx-srow2' }, srvIn, h('button', { class: 'ytx-btn', onclick: () => { PatOS.store.set('patosServer', srvIn.value.trim()); serverOK = null; settings2(); } }, PatOS.t('Save'))),
          h('h3', {}, PatOS.t('Autoplay')),
          (() => { const l = h('label', { class: 'ytx-ap' }, h('span', {}, PatOS.t('Play the next video automatically')), h('input', { type: 'checkbox' })); l.querySelector('input').checked = autoplay; l.querySelector('input').onchange = (e) => { autoplay = e.target.checked; PatOS.store.set('ytAutoplay', autoplay); }; return l; })(),
          h('h3', {}, PatOS.t('YouTube API key (optional)')),
          h('p', { class: 'ytx-dim' }, PatOS.t('Only needed when there is no PatOS website to connect to.')),
          h('div', { class: 'ytx-srow2' }, keyIn, h('button', { class: 'ytx-btn', onclick: () => { PatOS.store.set('ytKey', keyIn.value.trim()); PatOS.notify({ title: PatOS.t('Saved'), body: 'YouTube', icon: 'youtube' }); } }, PatOS.t('Save'))),
          h('h3', {}, PatOS.t('Your data')),
          h('p', { class: 'ytx-dim' }, PatOS.t('Subscriptions, likes, Watch later and history are kept on this device only.'))));
        function settings2() { render(); }
      }

      /* ---------- search box + suggestions ---------- */
      let st = null, selIdx = -1;
      const doSearch = (text) => { text = text.trim(); sugg.classList.remove('on'); q.blur(); if (!text) return; const m = text.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/); if (m) go({ key: 'watch', id: m[1] }); else go({ key: 'search', q: text }); };
      q.addEventListener('input', () => {
        clearTimeout(st); selIdx = -1;
        const v = q.value.trim(); if (!v) { sugg.classList.remove('on'); return; }
        st = setTimeout(() => get('suggest', { q: v }).then((list) => {
          if (!Array.isArray(list) || !list.length || document.activeElement !== q) { sugg.classList.remove('on'); return; }
          sugg.innerHTML = ''; list.forEach((s) => { const b = h('button', { html: ic('search', 16) + '<span></span>' }); b.querySelector('span').textContent = s; b.onmousedown = (e) => { e.preventDefault(); q.value = s; doSearch(s); }; sugg.appendChild(b); });
          sugg.classList.add('on');
        }).catch(() => {}), 160);
      });
      q.addEventListener('keydown', (e) => {
        const items = [...sugg.querySelectorAll('button')];
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sugg.classList.contains('on') && items.length) { e.preventDefault(); selIdx = (selIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((b, k) => b.classList.toggle('sel', k === selIdx)); q.value = items[selIdx].textContent; }
        if (e.key === 'Enter') doSearch(q.value);
        if (e.key === 'Escape') sugg.classList.remove('on');
      });
      q.addEventListener('blur', () => setTimeout(() => sugg.classList.remove('on'), 120));
      head.querySelector('.ytx-sbtn').onclick = () => doSearch(q.value);
      win.on('resize', () => { if (win.el.offsetWidth < 760) win.el.classList.add('ytx-mini'); });

      win._open = (a) => { if (a.id) go({ key: 'watch', id: a.id }); else if (a.q) go({ key: 'search', q: a.q }); };
      if (args.id) go({ key: 'watch', id: args.id }); else if (args.q) go({ key: 'search', q: args.q }); else go({ key: 'home' });
    },
    onArgs(win, a) { win._open && win._open(a); }
  });
})();
