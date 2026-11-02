/* Maps (OpenStreetMap) and YouTube (official player + YouTube Data API) */
(function () {
  'use strict';
  const { h } = PatOS;
  /* Maps: embeddable OpenStreetMap with place search */
  PatOS.registerApp({
    id: 'maps', name: 'Maps', icon: 'maps', category: 'Apps', width: 900, height: 600, keywords: 'map location directions',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const q = h('input', { class: 'field', placeholder: 'Search for a place', style: { width: '260px' }, spellcheck: 'false' });
      const bLoc = h('button', { class: 'tbtn', title: 'My location' }, '➤');
      const bG = h('button', { class: 'tbtn', title: 'Open in Google Maps' }, '↗');
      win.toolbar.append(bLoc, q, bG);
      const frame = h('iframe', { class: 'map-frame', allow: 'geolocation' });
      const info = h('div', { class: 'map-info hidden' });
      win.body.append(frame, info);
      let lat = 45.5019, lon = -73.5674, label = 'Montréal';
      if (PatOS.sandboxed) {
        frame.replaceWith(h('div', { class: 'br-blocked' }, h('div', { class: 'bb-ic', html: PatOS.iconHTML('maps') }), h('h2', {}, 'Maps opens in a new tab here'), h('p', {}, 'Claude Artifacts can’t show maps inside the page. Search for a place and PatOS opens it in a real tab.')));
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && q.value.trim()) PatOS.openExternal('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q.value)); });
        bG.onclick = () => PatOS.openExternal('https://www.google.com/maps'); bLoc.style.display = 'none';
        return;
      }
      function show(z) {
        const d = z || 0.06;
        frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d * 1.6}%2C${lat - d}%2C${lon + d * 1.6}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lon}`;
        info.textContent = label; info.classList.remove('hidden');
      }
      q.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter' || !q.value.trim()) return;
        try {
          const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q.value));
          const j = await r.json();
          if (!j.length) { info.textContent = 'No place found for “' + q.value + '”'; info.classList.remove('hidden'); return; }
          lat = +j[0].lat; lon = +j[0].lon; label = j[0].display_name.split(',').slice(0, 3).join(','); show(0.03);
        } catch (er) { info.textContent = 'Search needs an internet connection.'; info.classList.remove('hidden'); }
      });
      bLoc.onclick = () => navigator.geolocation && navigator.geolocation.getCurrentPosition((p) => { lat = p.coords.latitude; lon = p.coords.longitude; label = 'Your location'; show(0.01); }, () => PatOS.notify({ title: 'Location unavailable', body: 'PatOS could not get your location.', icon: 'maps' }));
      bG.onclick = () => PatOS.openExternal(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
      show();
    }
  });

  /* YouTube: the official YouTube player inside PatOS, with real search, trending, channels and comments
     from the YouTube Data API (each person adds their own free API key once). */
  PatOS.registerApp({
    id: 'youtube', name: 'YouTube', icon: 'youtube', category: 'Apps', single: true, width: 1100, height: 700, dark: true, keywords: 'video watch tube music',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'yt-win');
      const API = 'https://www.googleapis.com/youtube/v3/';
      let key = PatOS.store.get('ytKey', '');
      const q = h('input', { class: 'yt-search', placeholder: 'Search', spellcheck: 'false' });
      const bGo = h('button', { class: 'yt-sbtn', title: 'Search' }, '🔍');
      const bHome = h('button', { class: 'tbtn', title: 'Home' }, '⌂');
      const bKey = h('button', { class: 'tbtn', title: 'YouTube settings' }, '⚙');
      win.toolbar.append(bHome, h('div', { class: 'yt-sbox' }, q, bGo), bKey);
      win.toolbar.style.justifyContent = 'center';
      const main = h('div', { class: 'yt-main' }); win.body.appendChild(main);
      const hist = PatOS.store.get('ytHistory', []);
      const fmtN = (n) => { n = +n || 0; return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(n); };
      const ago = (d) => { const s = (Date.now() - new Date(d)) / 1000; const u = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']]; for (const [k, n] of u) if (s >= k) { const v = Math.floor(s / k); return v + ' ' + n + (v > 1 ? 's' : '') + ' ago'; } return 'just now'; };
      const dur = (iso) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ''); if (!m) return ''; const hh = +m[1] || 0, mm = +m[2] || 0, ss = +m[3] || 0; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
      const dec = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
      async function api(path, params) {
        const u = API + path + '?' + new URLSearchParams(Object.assign({ key }, params));
        const r = await fetch(u); const j = await r.json();
        if (j.error) throw new Error(j.error.message || 'YouTube error');
        return j;
      }
      function loading() { main.innerHTML = ''; main.appendChild(h('div', { class: 'yt-loading' }, h('div', { class: 'yt-spin' }))); }
      function fail(e) {
        main.innerHTML = '';
        const bad = /API key|keyInvalid|not valid/i.test(e.message);
        main.appendChild(h('div', { class: 'yt-msg' }, h('h2', {}, bad ? 'That API key doesn’t work' : 'YouTube couldn’t load'), h('p', {}, PatOS.sandboxed ? 'Claude Artifacts block live data. Open PatOS from its own website to use YouTube.' : bad ? 'Check the key in YouTube settings (⚙).' : e.message), h('button', { class: 'btn', onclick: home }, 'Try again')));
      }
      function setup() {
        main.innerHTML = '';
        const inp = h('input', { class: 'field yt-keyin', placeholder: 'Paste your YouTube API key', value: key, spellcheck: 'false' });
        const link = h('input', { class: 'field yt-keyin', placeholder: 'Or paste a YouTube video link to watch it now', spellcheck: 'false' });
        link.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const id = idOf(link.value); if (id) watch(id); } });
        main.appendChild(h('div', { class: 'yt-setup' },
          h('div', { class: 'yt-big', html: PatOS.iconHTML('youtube') }),
          h('h1', {}, 'YouTube in PatOS'),
          h('p', {}, 'Videos play in the real YouTube player, right here. To search and see trending videos, PatOS needs a free YouTube API key from Google (you only do this once):'),
          h('ol', { class: 'yt-steps' },
            h('li', {}, 'On a computer, go to console.cloud.google.com and sign in with a Google account.'),
            h('li', {}, 'Create a project, then open “APIs & Services” › “Library” and turn on “YouTube Data API v3”.'),
            h('li', {}, 'Open “Credentials” › “Create credentials” › “API key”, and copy the key.'),
            h('li', {}, 'Paste it below. It stays only on this device.')),
          h('div', { class: 'yt-keyrow' }, inp, h('button', { class: 'btn primary', onclick: async () => { key = inp.value.trim(); PatOS.store.set('ytKey', key); home(); } }, 'Save key')),
          link,
          hist.length ? h('div', { class: 'yt-section' }, h('h3', {}, 'Watch again'), grid(hist.slice(0, 8))) : null));
      }
      function idOf(s) { const m = String(s).match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/) || String(s).match(/^([\w-]{11})$/); return m ? m[1] : null; }
      function card(v) {
        const c = h('div', { class: 'yt-card' },
          h('div', { class: 'yt-thumb' }, h('img', { src: v.thumb, alt: '', loading: 'lazy' }), v.duration ? h('span', { class: 'yt-dur' }, v.duration) : null),
          h('div', { class: 'yt-info' }, h('div', { class: 'yt-av' }, (v.channel || '?').charAt(0)), h('div', {}, h('b', { class: 'yt-title' }, v.title), h('small', {}, v.channel), h('small', {}, [v.views ? fmtN(v.views) + ' views' : '', v.date ? ago(v.date) : ''].filter(Boolean).join(' · ')))));
        c.onclick = () => watch(v.id, v);
        return c;
      }
      function grid(list) { const g = h('div', { class: 'yt-grid' }); list.forEach((v) => g.appendChild(card(v))); return g; }
      async function details(ids) {
        if (!ids.length) return {};
        const j = await api('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
        const map = {}; j.items.forEach((it) => { map[it.id] = toVid(it); }); return map;
      }
      function toVid(it) { const s = it.snippet || {}; return { id: typeof it.id === 'string' ? it.id : it.id.videoId, title: dec(s.title || ''), channel: s.channelTitle, channelId: s.channelId, date: s.publishedAt, desc: s.description, thumb: ((s.thumbnails || {}).medium || (s.thumbnails || {}).default || {}).url, views: it.statistics && it.statistics.viewCount, likes: it.statistics && it.statistics.likeCount, duration: it.contentDetails && dur(it.contentDetails.duration) }; }
      const CHIPS = ['All', 'Music', 'Gaming', 'Minecraft', 'Science', 'Space', 'Coding', 'Sports', 'Comedy', 'Animals', 'Cooking', 'Lofi'];
      async function home(chip) {
        win.setTitle('YouTube');
        if (!key) return setup();
        loading();
        try {
          let list;
          if (!chip || chip === 'All') { const region = (navigator.language.split('-')[1] || 'CA').toUpperCase(); const j = await api('videos', { part: 'snippet,statistics,contentDetails', chart: 'mostPopular', maxResults: 24, regionCode: region }); list = j.items.map(toVid); }
          else list = await searchList(chip);
          main.innerHTML = '';
          const chips = h('div', { class: 'yt-chips' }, ...CHIPS.map((c) => h('button', { class: (chip || 'All') === c ? 'on' : '', onclick: () => home(c) }, c)));
          main.append(chips, grid(list));
          if (hist.length && (!chip || chip === 'All')) main.append(h('div', { class: 'yt-section' }, h('h3', {}, 'Watch again'), grid(hist.slice(0, 4))));
        } catch (e) { fail(e); }
      }
      async function searchList(text) {
        const j = await api('search', { part: 'snippet', type: 'video', maxResults: 24, q: text, safeSearch: 'moderate' });
        const ids = j.items.map((i) => i.id.videoId).filter(Boolean);
        const d = await details(ids); return ids.map((id) => d[id]).filter(Boolean);
      }
      async function search(text) {
        const id = idOf(text); if (id) return watch(id);
        if (!key) return setup();
        loading(); win.setTitle(text + ' - YouTube');
        try { const list = await searchList(text); main.innerHTML = ''; main.appendChild(h('div', { class: 'yt-results' }, ...list.map((v) => { const c = card(v); c.classList.add('row'); return c; }))); }
        catch (e) { fail(e); }
      }
      async function watch(id, v) {
        main.innerHTML = '';
        const player = h('div', { class: 'yt-player' }, h('iframe', { src: 'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1', allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' }));
        const info = h('div', { class: 'yt-winfo' });
        const side = h('div', { class: 'yt-side' });
        main.appendChild(h('div', { class: 'yt-watch' }, h('div', { class: 'yt-left' }, player, info), side));
        if (!key) { info.appendChild(h('p', { class: 'yt-hint' }, 'Add a YouTube API key in settings (⚙) to see the title, comments and more videos.')); return; }
        try {
          if (!v || !v.views) { const d = await details([id]); v = d[id]; }
          if (!v) throw new Error('This video is unavailable.');
          win.setTitle(v.title);
          const i = hist.findIndex((x) => x.id === id); if (i >= 0) hist.splice(i, 1); hist.unshift({ id: v.id, title: v.title, channel: v.channel, thumb: v.thumb, duration: v.duration }); hist.length = Math.min(hist.length, 30); PatOS.store.set('ytHistory', hist);
          const desc = h('div', { class: 'yt-desc' }, h('b', {}, fmtN(v.views) + ' views · ' + ago(v.date)), h('div', { class: 'yt-dtext' }, v.desc || ''));
          desc.onclick = () => desc.classList.toggle('open');
          info.append(h('h2', { class: 'yt-wt' }, v.title), h('div', { class: 'yt-chan' }, h('div', { class: 'yt-av' }, (v.channel || '?').charAt(0)), h('b', {}, v.channel), h('span', { class: 'yt-likes' }, '👍 ' + fmtN(v.likes))), desc);
          searchList(v.title.split(/[|\-–(]/)[0].slice(0, 60)).then((list) => { side.innerHTML = ''; list.filter((x) => x.id !== id).slice(0, 15).forEach((x) => { const c = card(x); c.classList.add('row', 'sm'); side.appendChild(c); }); }).catch(() => {});
          api('commentThreads', { part: 'snippet', videoId: id, maxResults: 20, order: 'relevance', textFormat: 'plainText' }).then((j) => {
            const box = h('div', { class: 'yt-comments' }, h('h3', {}, 'Comments'));
            j.items.forEach((c) => { const s = c.snippet.topLevelComment.snippet; box.appendChild(h('div', { class: 'yt-cm' }, h('div', { class: 'yt-av sm' }, (s.authorDisplayName || '?').replace('@', '').charAt(0)), h('div', {}, h('b', {}, s.authorDisplayName, h('small', {}, '  ' + ago(s.publishedAt))), h('p', {}, s.textDisplay), h('small', {}, '👍 ' + fmtN(s.likeCount))))); });
            info.appendChild(box);
          }).catch(() => info.appendChild(h('p', { class: 'yt-hint' }, 'Comments are turned off for this video.')));
        } catch (e) { info.appendChild(h('p', { class: 'yt-hint' }, e.message)); }
      }
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && q.value.trim()) { search(q.value.trim()); q.blur(); } });
      bGo.onclick = () => q.value.trim() && search(q.value.trim());
      bHome.onclick = () => home();
      bKey.onclick = setup;
      win._open = (a) => { if (a.id) watch(a.id); else if (a.q) search(a.q); };
      if (args.id) watch(args.id); else if (args.q) search(args.q); else home();
    },
    onArgs(win, a) { win._open && win._open(a); }
  });
})();
