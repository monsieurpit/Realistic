/* Web apps: shortcuts to the web apps you use on a Chromebook, plus embeddable Maps & YouTube players */
(function () {
  'use strict';
  const { h } = PatOS;
  const WEB = [
    { id: 'gsearch', name: 'Google Search', icon: 'search', url: 'https://www.google.com', inside: 'https://www.google.com/webhp?igu=1' },
    { id: 'gmail', name: 'Gmail', icon: 'gmail', url: 'https://mail.google.com' },
    { id: 'gdocs', name: 'Docs', icon: 'docs', url: 'https://docs.google.com/document/' },
    { id: 'gsheets', name: 'Sheets', icon: 'sheets', url: 'https://docs.google.com/spreadsheets/' },
    { id: 'gslides', name: 'Slides', icon: 'slides', url: 'https://docs.google.com/presentation/' },
    { id: 'gforms', name: 'Forms', icon: 'forms', url: 'https://docs.google.com/forms/' },
    { id: 'gdrive', name: 'Drive', icon: 'drive', url: 'https://drive.google.com' },
    { id: 'gclassroom', name: 'Classroom', icon: 'classroom', url: 'https://classroom.google.com' },
    { id: 'gmeet', name: 'Meet', icon: 'meet', url: 'https://meet.google.com' },
    { id: 'gcalendar', name: 'Google Calendar', icon: 'gcal', url: 'https://calendar.google.com' },
    { id: 'gkeep', name: 'Keep', icon: 'keep', url: 'https://keep.google.com' },
    { id: 'gchat', name: 'Chat', icon: 'chat', url: 'https://chat.google.com' },
    { id: 'gphotos', name: 'Google Photos', icon: 'gphotos', url: 'https://photos.google.com' },
    { id: 'gtranslate', name: 'Translate', icon: 'translate', url: 'https://translate.google.com' }
  ];
  WEB.forEach((w) => PatOS.registerApp({
    id: w.id, name: w.name, icon: w.icon, category: 'Google', keywords: 'google web chrome ' + w.name.toLowerCase(),
    action: () => {
      if (w.inside) return PatOS.launch('browser', { url: w.inside });
      PatOS.openExternal(w.url);
      PatOS.notify({ title: w.name + ' opened in a new tab', body: 'Google apps can’t run inside other pages, so PatOS opened a real tab. PatOS keeps running here.', icon: w.icon, duration: 3500 });
    }
  }));

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
        info.textContent = '📍 ' + label; info.classList.remove('hidden');
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

  /* YouTube player: paste a link to watch it inside PatOS */
  PatOS.registerApp({
    id: 'youtube', name: 'YouTube', icon: 'youtube', category: 'Apps', width: 900, height: 580, keywords: 'video watch tube',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const q = h('input', { class: 'field', placeholder: 'Paste a YouTube link, or search…', style: { width: '320px' }, spellcheck: 'false' });
      const bOpen = h('button', { class: 'tbtn', title: 'Open YouTube in a new tab' }, '↗');
      win.toolbar.append(q, bOpen);
      const stage = h('div', { class: 'yt-stage' });
      win.body.appendChild(stage);
      const recent = PatOS.store.get('ytRecent', []);
      function idOf(s) {
        const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/) || s.match(/^([\w-]{11})$/);
        return m ? m[1] : null;
      }
      function home() {
        stage.innerHTML = '';
        stage.appendChild(h('div', { class: 'yt-home' },
          h('div', { class: 'yt-big', html: PatOS.iconHTML('youtube') }),
          h('h2', {}, 'Watch videos in PatOS'),
          h('p', {}, 'Copy a video link from YouTube and paste it above. Searching opens YouTube in a real tab.'),
          recent.length ? h('div', { class: 'yt-recent' }, h('b', {}, 'Recently watched'), ...recent.map((r) => h('button', { class: 'yt-r', onclick: () => play(r.id) }, h('img', { src: 'https://i.ytimg.com/vi/' + r.id + '/mqdefault.jpg', alt: '' }), h('span', {}, r.id)))) : null));
      }
      function play(id) {
        if (PatOS.sandboxed) { PatOS.openExternal('https://www.youtube.com/watch?v=' + id); return; }
        stage.innerHTML = '';
        stage.appendChild(h('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true }));
        const i = recent.findIndex((r) => r.id === id); if (i >= 0) recent.splice(i, 1);
        recent.unshift({ id }); recent.length = Math.min(recent.length, 8); PatOS.store.set('ytRecent', recent);
      }
      q.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const id = idOf(q.value.trim());
        if (id) play(id); else if (q.value.trim()) PatOS.openExternal('https://www.youtube.com/results?search_query=' + encodeURIComponent(q.value));
      });
      bOpen.onclick = () => PatOS.openExternal('https://www.youtube.com');
      if (args.id) play(args.id); else home();
    }
  });
})();
