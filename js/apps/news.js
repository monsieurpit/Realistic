/* News — live headlines from real news sites, with saved stories */
(function () {
  'use strict';
  const { h } = PatOS;
  const EN = ['top', 'world', 'tech', 'science', 'space', 'nasa', 'hn'], FR = ['fr_une', 'fr_presse', 'fr_sport', 'fr_science'];
  const NAMES = { top: 'Top stories', world: 'World', tech: 'Technology', science: 'Science', space: 'Space', nasa: 'NASA', hn: 'Hacker News', fr_une: 'À la une', fr_presse: 'La Presse', fr_sport: 'Sports (Radio-Canada)', fr_science: 'Science (Radio-Canada)' };
  const ago = (d) => { const t = Date.parse(d); if (!t) return ''; const s = (Date.now() - t) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min'; if (s < 86400) return Math.round(s / 3600) + ' h'; return new Date(t).toLocaleDateString(PatOS.locale, { day: 'numeric', month: 'short' }); };

  PatOS.registerApp({
    id: 'news', name: 'News', icon: 'news', width: 1060, height: 700, category: 'Apps', keywords: 'headlines articles journal nouvelles actualités',
    about: 'Live headlines from NPR, Al Jazeera, Engadget, Space.com, NASA, Radio-Canada, La Presse and more.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const saved = PatOS.store.get('newsSaved', []);
      let feed = PatOS.store.get('newsFeed', PatOS.lang === 'fr' ? 'fr_une' : 'top');
      const side = h('div', { class: 'nw-side' }), main = h('div', { class: 'nw-main' });
      const bRefresh = h('button', { class: 'tbtn', title: 'Refresh' }, '↻');
      const q = h('input', { class: 'field', placeholder: 'Filter headlines', style: { width: '200px' } });
      win.toolbar.append(h('div', { style: { flex: 1 } }), q, bRefresh);
      win.body.appendChild(h('div', { class: 'nw-wrap' }, side, main));
      let items = [];
      function renderSide() {
        side.innerHTML = '';
        const sec = (title, keys) => { side.appendChild(h('div', { class: 'nw-sh' }, PatOS.t(title))); keys.forEach((k) => { const b = h('button', { class: 'nw-si' + (feed === k ? ' on' : '') }, PatOS.t(NAMES[k])); b.onclick = () => { feed = k; PatOS.store.set('newsFeed', k); renderSide(); load(); }; side.appendChild(b); }); };
        if (PatOS.lang === 'fr') { sec('En français', FR); sec('In English', EN); } else { sec('Today', EN); sec('En français', FR); }
        side.appendChild(h('div', { class: 'nw-sh' }, PatOS.t('Library')));
        const b = h('button', { class: 'nw-si' + (feed === 'saved' ? ' on' : '') }, PatOS.t('Saved stories') + (saved.length ? ' (' + saved.length + ')' : '')); b.onclick = () => { feed = 'saved'; renderSide(); show(saved, PatOS.t('Saved stories')); }; side.appendChild(b);
      }
      function open(it) {
        const box = h('div', { class: 'nw-reader' },
          h('button', { class: 'tbtn nw-close', title: 'Close' }, '×'),
          it.img ? h('img', { src: it.img, alt: '', referrerpolicy: 'no-referrer' }) : null,
          h('small', {}, (it.source || '') + (it.date ? ' · ' + ago(it.date) : '')), h('h1', {}, it.title), h('p', {}, it.desc || ''),
          h('div', { class: 'nw-ra' },
            h('button', { class: 'btn primary', onclick: () => PatOS.launch('browser', { url: it.link }) }, PatOS.t('Read the full story in Patoogle')),
            h('button', { class: 'btn', onclick: () => PatOS.openExternal(it.link) }, PatOS.t('Open in a new tab')),
            h('button', { class: 'btn', onclick: (e) => { const i = saved.findIndex((x) => x.link === it.link); if (i >= 0) saved.splice(i, 1); else saved.unshift(it); PatOS.store.set('newsSaved', saved.slice(0, 100)); e.target.textContent = PatOS.t(i >= 0 ? 'Save' : 'Saved'); renderSide(); } }, PatOS.t(saved.some((x) => x.link === it.link) ? 'Saved' : 'Save'))));
        const layer = h('div', { class: 'nw-layer' }, box);
        layer.onclick = (e) => { if (e.target === layer || e.target.classList.contains('nw-close')) layer.remove(); };
        win.body.appendChild(layer);
      }
      function show(list, title) {
        main.innerHTML = '';
        const ql = q.value.trim().toLowerCase();
        list = list.filter((x) => !ql || (x.title + ' ' + x.desc).toLowerCase().includes(ql));
        main.appendChild(h('div', { class: 'nw-head' }, h('h1', {}, title), h('small', {}, new Date().toLocaleDateString(PatOS.locale, { weekday: 'long', day: 'numeric', month: 'long' }))));
        if (!list.length) { main.appendChild(h('div', { class: 'nw-empty' }, PatOS.t(feed === 'saved' ? 'Stories you save show up here.' : 'No stories.'))); return; }
        const grid = h('div', { class: 'nw-grid' });
        list.forEach((it, i) => {
          const c = h('article', { class: 'nw-card' + (i === 0 && !ql ? ' hero' : '') + (it.img ? '' : ' noimg') },
            it.img ? h('div', { class: 'nw-img', style: { backgroundImage: 'url("' + it.img.replace(/"/g, '%22') + '")' } }) : null,
            h('div', { class: 'nw-txt' }, h('small', {}, (it.source || '') + (it.date ? ' · ' + ago(it.date) : '')), h('h3', {}, it.title), it.desc ? h('p', {}, it.desc) : null));
          c.onclick = () => open(it); grid.appendChild(c);
        });
        main.appendChild(grid);
      }
      async function load() {
        main.innerHTML = ''; main.appendChild(h('div', { class: 'nw-empty' }, PatOS.t('Loading…')));
        const offline = () => {
          // show the last headlines loaded for this section, if there are any
          const c = PatOS.store.get('newsCache:' + feed, null);
          if (c && c.items && c.items.length) {
            items = c.items; show(items, PatOS.t(NAMES[feed]));
            const when = new Date(c.t).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
            main.insertBefore(h('div', { class: 'nw-offbar' }, PatOS.t('You’re offline. These headlines are from') + ' ' + when + '.'), main.firstChild);
            const back = () => { window.removeEventListener('online', back); if (main.querySelector('.nw-offbar')) setTimeout(load, 600); };
            window.addEventListener('online', back);
            return;
          }
          main.innerHTML = ''; main.appendChild(PatOS.offlineCard(load, { body: 'The news needs the internet. Your saved stories are still here, in Library.' }));
        };
        if (PatOS.isOffline()) return offline();
        const base = PatOS.server && await PatOS.server();
        if (!base && PatOS.isOffline()) return offline();
        if (!base) { main.innerHTML = ''; main.appendChild(h('div', { class: 'nw-empty' }, h('h2', {}, PatOS.t('News needs the PatOS website')), h('p', {}, PatOS.sandboxed ? PatOS.t('This copy of PatOS runs inside a Claude Artifact, which blocks live news. Open PatOS from its website.') : PatOS.t('Open PatOS from its website (your Render link) to read the news.')))); return; }
        try {
          const r = await fetch(base + '/api/news?feed=' + feed); const j = await r.json(); if (j.error) throw new Error(j.error);
          items = j.items.map((x) => Object.assign(x, { source: j.source }));
          PatOS.store.set('newsCache:' + feed, { t: Date.now(), items: items.slice(0, 40) });
          show(items, PatOS.t(NAMES[feed]));
        } catch (e) { if (PatOS.isOffline()) return offline(); main.innerHTML = ''; main.appendChild(h('div', { class: 'nw-empty' }, h('h2', {}, PatOS.t('The news didn’t load')), h('p', {}, e.message), h('button', { class: 'btn', onclick: load }, PatOS.t('Try again')))); }
      }
      q.oninput = () => show(feed === 'saved' ? saved : items, feed === 'saved' ? PatOS.t('Saved stories') : PatOS.t(NAMES[feed]));
      bRefresh.onclick = load;
      renderSide(); if (feed === 'saved') feed = 'top'; load();
    }
  });
})();
