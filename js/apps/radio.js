/* Radio — thousands of real live radio stations from around the world (radio-browser.info) */
(function () {
  'use strict';
  const { h } = PatOS;
  const API = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];
  const TAGS = ['pop', 'rock', 'hip hop', 'jazz', 'classical', 'electronic', 'lofi', 'news', 'country', 'chill', 'dance', 'kids'];
  async function api(path) {
    let err;
    for (const b of API) { try { const r = await fetch(b + path, { cache: 'no-store' }); if (r.ok) return r.json(); err = new Error('HTTP ' + r.status); } catch (e) { err = e; } }
    throw err || new Error('offline');
  }
  let audio = null, playing = null;
  PatOS.registerApp({
    id: 'radio', name: 'Radio', icon: 'radio', width: 960, height: 640, category: 'Apps', keywords: 'live stations music fm stream',
    about: 'Live radio stations from around the world.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const favs = PatOS.store.get('radioFavs', []);
      const country = ((navigator.language || 'en-CA').split('-')[1] || 'CA').toUpperCase();
      const q = h('input', { class: 'field', placeholder: 'Search stations', style: { width: '220px' } });
      win.toolbar.append(h('div', { style: { flex: 1 } }), q);
      const side = h('div', { class: 'rd-side' }), list = h('div', { class: 'rd-list' });
      const now = h('div', { class: 'rd-now' });
      win.body.appendChild(h('div', { class: 'rd-wrap' }, side, h('div', { class: 'rd-col' }, list, now)));
      let view = 'local';
      function renderSide() {
        side.innerHTML = '';
        const item = (k, label) => { const b = h('button', { class: 'rd-si' + (view === k ? ' on' : '') }, PatOS.t(label)); b.onclick = () => { view = k; renderSide(); load(); }; side.appendChild(b); };
        item('local', 'Near you'); item('top', 'Most popular'); item('favs', 'Favorites');
        side.appendChild(h('div', { class: 'rd-sh' }, PatOS.t('Genres')));
        TAGS.forEach((t) => item('tag:' + t, t.replace(/^./, (c) => c.toUpperCase())));
      }
      function row(s) {
        const fav = favs.some((f) => f.stationuuid === s.stationuuid);
        const bFav = h('button', { class: 'rd-fav' + (fav ? ' on' : ''), title: 'Favorite' }, fav ? '★' : '☆');
        bFav.onclick = (e) => { e.stopPropagation(); const i = favs.findIndex((f) => f.stationuuid === s.stationuuid); if (i >= 0) favs.splice(i, 1); else favs.unshift({ stationuuid: s.stationuuid, name: s.name, url_resolved: s.url_resolved, url: s.url, favicon: s.favicon, tags: s.tags, country: s.country }); PatOS.store.set('radioFavs', favs); bFav.textContent = i >= 0 ? '☆' : '★'; bFav.classList.toggle('on', i < 0); };
        const r = h('div', { class: 'rd-row' + (playing && playing.stationuuid === s.stationuuid ? ' on' : '') },
          s.favicon ? h('img', { src: s.favicon, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => { e.target.replaceWith(h('div', { class: 'rd-ph' }, (s.name || '?').trim().charAt(0))); } }) : h('div', { class: 'rd-ph' }, (s.name || '?').trim().charAt(0)),
          h('div', { class: 'rd-info' }, h('b', {}, s.name.trim()), h('small', {}, [s.country, (s.tags || '').split(',').slice(0, 3).join(', ')].filter(Boolean).join(' · '))), bFav);
        r.onclick = () => play(s);
        return r;
      }
      async function load() {
        list.innerHTML = ''; list.appendChild(h('div', { class: 'rd-msg' }, PatOS.t('Loading stations…')));
        try {
          let res;
          const base = '?hidebroken=true&order=clickcount&reverse=true&limit=60';
          if (view === 'favs') res = favs;
          else if (view === 'local') res = await api('/json/stations/bycountrycodeexact/' + country + base);
          else if (view === 'top') res = await api('/json/stations/topclick/60?hidebroken=true');
          else if (view.startsWith('tag:')) res = await api('/json/stations/bytagexact/' + encodeURIComponent(view.slice(4)) + base);
          else if (view.startsWith('q:')) res = await api('/json/stations/search?name=' + encodeURIComponent(view.slice(2)) + '&hidebroken=true&order=clickcount&reverse=true&limit=60');
          res = (res || []).filter((s) => s.url_resolved || s.url).filter((s) => /^https:/.test(s.url_resolved || s.url) || location.protocol !== 'https:');
          list.innerHTML = '';
          if (!res.length) { list.appendChild(h('div', { class: 'rd-msg' }, PatOS.t(view === 'favs' ? 'Press ☆ on a station to keep it here.' : 'No stations found.'))); return; }
          res.forEach((s) => list.appendChild(row(s)));
        } catch (e) { list.innerHTML = ''; list.appendChild(h('div', { class: 'rd-msg' }, PatOS.sandboxed ? PatOS.t('Claude Artifacts block live radio. Open PatOS from its website.') : PatOS.t('Radio stations couldn’t load. Your network may block them.'))); }
      }
      function paintNow() {
        now.innerHTML = '';
        if (!playing) { now.classList.remove('on'); return; }
        now.classList.add('on');
        const bars = h('div', { class: 'rd-eq' + (audio && !audio.paused ? ' go' : '') }, h('i'), h('i'), h('i'), h('i'));
        const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: audio ? audio.volume : 1, class: 'rd-vol', title: 'Volume' });
        vol.oninput = () => { if (audio) audio.volume = +vol.value; };
        const bPlay = h('button', { class: 'rd-play', title: 'Play or pause' }, audio && !audio.paused ? '❚❚' : '▶');
        bPlay.onclick = () => { if (!audio) return; if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
        now.append(playing.favicon ? h('img', { src: playing.favicon, alt: '', referrerpolicy: 'no-referrer' }) : h('div', { class: 'rd-ph' }, playing.name.charAt(0)), h('div', { class: 'rd-info' }, h('b', {}, playing.name.trim()), h('small', { class: 'rd-state' }, playing.state || '')), bars, bPlay, vol);
      }
      function play(s) {
        if (!audio) {
          audio = new Audio(); audio.preload = 'none';
          audio.addEventListener('playing', () => { if (playing) playing.state = PatOS.t('Live'); paintNow(); list.querySelectorAll('.rd-row').forEach((r) => r.classList.remove('on')); });
          audio.addEventListener('pause', () => { if (playing) playing.state = PatOS.t('Paused'); paintNow(); });
          audio.addEventListener('waiting', () => { if (playing) playing.state = PatOS.t('Connecting…'); paintNow(); });
          audio.addEventListener('error', () => { if (playing) playing.state = PatOS.t('This station isn’t working right now. Try another one.'); paintNow(); });
        }
        playing = Object.assign({}, s, { state: PatOS.t('Connecting…') });
        audio.src = s.url_resolved || s.url; audio.play().catch(() => {});
        if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: s.name.trim(), artist: PatOS.t('Live radio'), artwork: s.favicon ? [{ src: s.favicon }] : [] }); } catch (e) {} }
        fetch(API[0] + '/json/url/' + s.stationuuid).catch(() => {}); // counts the click, as radio-browser asks
        paintNow();
        list.querySelectorAll('.rd-row').forEach((r) => r.classList.remove('on'));
      }
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && q.value.trim()) { view = 'q:' + q.value.trim(); renderSide(); load(); } });
      win.on('closed', () => { if (audio) { audio.pause(); audio.src = ''; audio = null; playing = null; } });
      renderSide(); load(); paintNow();
    }
  });
})();
