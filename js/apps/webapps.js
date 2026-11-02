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
})();
