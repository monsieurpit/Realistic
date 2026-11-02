/* Photos — library, albums, favorites, slideshow and a photo editor */
(function () {
  'use strict';
  const { h } = PatOS;
  const samples = [];
  function sampleArt() {
    if (samples.length) return samples;
    ['sonora', 'aurora', 'monterra', 'ocean', 'sunrise', 'mint', 'ember', 'midnight'].forEach((k) => samples.push({ name: PatOS.wallpaper.palettes[k].name, src: PatOS.wallpaper.thumbLarge(k), sample: true }));
    const gen = (name, fn) => { const c = document.createElement('canvas'); c.width = 640; c.height = 400; fn(c.getContext('2d'), 640, 400); samples.push({ name, src: c.toDataURL('image/jpeg', 0.85), sample: true }); };
    gen('Circles', (x, W, H) => { x.fillStyle = '#0d1b2a'; x.fillRect(0, 0, W, H); for (let i = 0; i < 70; i++) { x.fillStyle = `hsla(${180 + Math.random() * 140},80%,60%,.35)`; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, 10 + Math.random() * 70, 0, 7); x.fill(); } });
    gen('Mountains', (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ff9a8b'); g.addColorStop(1, '#ff6a88'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#fff6'; x.beginPath(); x.arc(W * 0.7, H * 0.35, 50, 0, 7); x.fill(); ['#7a3b69', '#563d7c', '#2d1e4f'].forEach((c, j) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 20) x.lineTo(i, H * (0.45 + j * 0.15) - Math.abs(Math.sin(i * 0.01 * (j + 1) + j)) * 90); x.lineTo(W, H); x.fill(); }); });
    gen('Grid City', (x, W, H) => { x.fillStyle = '#090018'; x.fillRect(0, 0, W, H); x.strokeStyle = '#ff2fa3'; for (let i = -20; i <= 20; i++) { x.beginPath(); x.moveTo(W / 2 + i * 12, H * 0.55); x.lineTo(W / 2 + i * 90, H); x.stroke(); } for (let j = 0; j < 12; j++) { const y = H * 0.55 + Math.pow(j / 12, 2) * H * 0.45; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } const g = x.createLinearGradient(0, 60, 0, 220); g.addColorStop(0, '#ffd319'); g.addColorStop(1, '#ff2975'); x.fillStyle = g; x.beginPath(); x.arc(W / 2, H * 0.55, 120, Math.PI, 0); x.fill(); });
    return samples;
  }
  const FILTERS = { Original: {}, Vivid: { sat: 45, con: 15 }, Warm: { warm: 40, sat: 10 }, Cool: { warm: -40 }, Mono: { sat: -100 }, Noir: { sat: -100, con: 45, light: -10 }, Fade: { con: -25, light: 10, sat: -25 }, Dramatic: { con: 35, light: -12, vig: 50 } };
  const favs = () => PatOS.store.get('photoFavs', []);

  PatOS.registerApp({
    id: 'photos', name: 'Photos', icon: 'photos', width: 980, height: 640, keywords: 'pictures images gallery edit',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let album = 'library', size = PatOS.store.get('photoSize', 160), list = [];
      const zoom = h('input', { type: 'range', min: 90, max: 280, value: size, class: 'ph-zoom', title: 'Thumbnail size' });
      const bShow = h('button', { class: 'tbtn', title: 'Slideshow', html: PatOS.sym('play') });
      const bImport = h('button', { class: 'tbtn', title: 'Import photos', html: PatOS.sym('upload') });
      win.toolbar.append(zoom, bShow, bImport); win.toolbar.style.paddingLeft = '200px';
      const side = h('div', { class: 'ph-side' });
      const grid = h('div', { class: 'ph-grid' });
      const viewer = h('div', { class: 'ph-view hidden' });
      win.body.appendChild(h('div', { class: 'ph-wrap' }, side, h('div', { class: 'ph-main' }, grid, viewer)));
      function userImages() { const out = []; PatOS.fs.walk('/', (p, n) => { if (PatOS.fileKind(p, n) === 'image' && String(n.content).startsWith('data:image')) out.push({ name: PatOS.fs.basename(p), src: n.content, path: p, mtime: n.mtime }); }); return out.sort((a, b) => b.mtime - a.mtime); }
      const ALBUMS = [
        ['library', 'Library', 'image', () => userImages()],
        ['favorites', 'Favorites', 'star', () => userImages().filter((p) => favs().includes(p.path))],
        ['screens', 'Screenshots', 'desktop', () => userImages().filter((p) => /screenshot|capture/i.test(p.name))],
        ['booth', 'Photo Booth', 'camera', () => userImages().filter((p) => /photo booth/i.test(p.name))],
        ['drawings', 'Drawings', 'brush', () => userImages().filter((p) => /drawing|dessin|galaxy|scene/i.test(p.name))],
        ['art', 'Art', 'sparkle', () => sampleArt()]
      ];
      function renderSide() {
        side.innerHTML = '';
        side.appendChild(h('div', { class: 'fd-sh' }, PatOS.t('Photos')));
        ALBUMS.forEach(([k, l, ic, fn], i) => {
          if (i === 2) side.appendChild(h('div', { class: 'fd-sh' }, PatOS.t('Albums')));
          const n = fn().length;
          const b = h('div', { class: 'fd-si' + (album === k ? ' on' : '') }, h('span', { class: 'symw', html: PatOS.sym(ic) }), PatOS.t(l), h('small', { class: 'ph-count' }, n || ''));
          b.onclick = () => { album = k; viewer.classList.add('hidden'); render(); }; side.appendChild(b);
        });
      }
      function render() {
        renderSide();
        list = ALBUMS.find((a) => a[0] === album)[3]();
        grid.style.setProperty('--ph', size + 'px');
        grid.innerHTML = '';
        if (!list.length) grid.appendChild(h('div', { class: 'ph-empty' }, h('div', { class: 'ph-big', html: PatOS.iconHTML('photos') }), h('b', {}, album === 'favorites' ? 'No favorites yet' : 'No photos here yet'), h('p', {}, album === 'favorites' ? 'Open a photo and press the star to add it here.' : 'Take pictures in Photo Booth, draw in Paint, or import images from your computer.'), album === 'library' ? h('button', { class: 'btn primary', onclick: () => PatOS.importFiles('/Pictures', 'image/*') }, 'Import Photos') : null));
        let lastDay = '';
        list.forEach((p, i) => {
          const day = p.mtime ? new Date(p.mtime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '';
          if (day && day !== lastDay && album !== 'art') { lastDay = day; grid.appendChild(h('div', { class: 'ph-day' }, day)); }
          const t = h('div', { class: 'ph-thumb' }, h('img', { src: p.src, alt: p.name, loading: 'lazy' }), p.path && favs().includes(p.path) ? h('span', { class: 'ph-heart', html: PatOS.sym('star') }) : null);
          t.onclick = () => open(i); grid.appendChild(t);
        });
        win.setTitle(PatOS.t(ALBUMS.find((a) => a[0] === album)[1]));
      }
      function open(i) {
        const p = list[i]; if (!p) return;
        viewer.innerHTML = ''; viewer.classList.remove('hidden');
        const isFav = p.path && favs().includes(p.path);
        const img = h('img', { src: p.src, alt: p.name, draggable: 'false' });
        const heart = p.path ? h('button', { class: 'tbtn ph-fav' + (isFav ? ' on' : ''), title: 'Favorite', html: PatOS.sym('star') }) : null;
        if (heart) heart.onclick = () => { const f = favs(); const k = f.indexOf(p.path); if (k >= 0) f.splice(k, 1); else f.push(p.path); PatOS.store.set('photoFavs', f); heart.classList.toggle('on', k < 0); renderSide(); };
        const bar = h('div', { class: 'ph-bar' },
          h('button', { class: 'btn', onclick: () => { viewer.classList.add('hidden'); render(); } }, '‹ ' + PatOS.t('All Photos')),
          h('div', { class: 'ph-title' }, h('b', {}, p.name), p.mtime ? h('small', {}, new Date(p.mtime).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })) : null), h('div', { style: { flex: 1 } }),
          heart, h('button', { class: 'btn primary', onclick: () => edit(p) }, 'Edit'),
          h('button', { class: 'tbtn', title: 'More', html: '<svg class="sym" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([
            { label: PatOS.t('Set as Wallpaper'), action: () => { PatOS.setSetting('customWallpaper', p.src); PatOS.setSetting('wallpaper', 'custom'); PatOS.notify({ title: PatOS.t('Wallpaper set'), body: p.name, icon: 'photos' }); } },
            { label: PatOS.t('Slideshow'), action: () => slideshow(i) },
            { label: PatOS.t('Download'), action: () => PatOS.downloadFile(p.name.includes('.') ? p.name : p.name + '.jpg', p.src) },
            p.path ? { divider: true } : null, p.path ? { label: PatOS.t('Delete'), action: () => { PatOS.fs.remove(p.path); viewer.classList.add('hidden'); } } : null], r.left - 150, r.bottom + 4); } }));
        const prev = h('button', { class: 'ph-nav l', onclick: () => open((i - 1 + list.length) % list.length) }, '‹');
        const next = h('button', { class: 'ph-nav r', onclick: () => open((i + 1) % list.length) }, '›');
        const stage = h('div', { class: 'ph-stage' }, img, list.length > 1 ? prev : null, list.length > 1 ? next : null);
        let z = 1; stage.addEventListener('dblclick', () => { z = z === 1 ? 2.2 : 1; img.style.transform = `scale(${z})`; });
        viewer.append(bar, stage);
        win._viewIdx = i;
        win.setTitle(p.name);
      }
      /* ---------- photo editor ---------- */
      function edit(p) {
        const st = { light: 0, con: 0, sat: 0, warm: 0, vig: 0, rot: 0, flip: false, crop: 'original', filter: 'Original' };
        const src = new Image(); src.src = p.src;
        const cv = h('canvas', { class: 'ed-canvas' });
        const panel = h('div', { class: 'ed-panel' });
        const layer = h('div', { class: 'ed-layer' }, h('div', { class: 'ed-top' }, h('button', { class: 'btn', onclick: () => layer.remove() }, 'Cancel'), h('b', {}, PatOS.t('Edit') + ' · ' + p.name), h('div', { style: { flex: 1 } }),
          h('button', { class: 'btn', onclick: () => { Object.assign(st, { light: 0, con: 0, sat: 0, warm: 0, vig: 0, rot: 0, flip: false, crop: 'original', filter: 'Original' }); buildPanel(); draw(); } }, 'Revert'),
          p.path ? h('button', { class: 'btn', onclick: () => save(false) }, 'Save as Copy') : null, h('button', { class: 'btn primary', onclick: () => save(!!p.path) }, p.path ? 'Done' : 'Save to Photos')), h('div', { class: 'ed-body' }, h('div', { class: 'ed-stage' }, cv), panel));
        viewer.appendChild(layer);
        const v = (k) => st[k] + (FILTERS[st.filter][k] || 0);
        function paint(target, maxW) {
          const rot = st.rot % 180 !== 0; let sw = src.width, sh = src.height, sx = 0, sy = 0;
          const ratio = { square: 1, wide: 16 / 9, photo: 4 / 3, portrait: 3 / 4 }[st.crop];
          if (ratio) { if (sw / sh > ratio) { const nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / ratio; sy = (sh - nh) / 2; sh = nh; } }
          const scale = Math.min(1, maxW / Math.max(sw, sh));
          const W = Math.round((rot ? sh : sw) * scale), H = Math.round((rot ? sw : sh) * scale);
          target.width = W; target.height = H; const x = target.getContext('2d');
          x.save(); x.translate(W / 2, H / 2); x.rotate(st.rot * Math.PI / 180); if (st.flip) x.scale(-1, 1);
          x.filter = `brightness(${100 + v('light')}%) contrast(${100 + v('con')}%) saturate(${Math.max(0, 100 + v('sat'))}%)`;
          const dw = sw * scale, dh = sh * scale; x.drawImage(src, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh); x.restore(); x.filter = 'none';
          const warm = v('warm'); if (warm) { x.globalCompositeOperation = 'soft-light'; x.fillStyle = warm > 0 ? `rgba(255,150,40,${warm / 160})` : `rgba(40,120,255,${-warm / 160})`; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; }
          const vig = v('vig'); if (vig > 0) { const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vig / 100})`); x.fillStyle = g; x.fillRect(0, 0, W, H); }
        }
        const draw = () => { if (src.complete && src.naturalWidth) paint(cv, 1100); };
        src.onload = draw;
        function buildPanel() {
          panel.innerHTML = '';
          const sec = (t) => panel.appendChild(h('div', { class: 'ed-sec' }, PatOS.t(t)));
          sec('Filters');
          const fr = h('div', { class: 'ed-filters' });
          Object.keys(FILTERS).forEach((f) => { const c = h('canvas', { width: 80, height: 60 }); const b = h('button', { class: 'ed-filter' + (st.filter === f ? ' on' : '') }, c, h('span', {}, PatOS.t(f))); b.onclick = () => { st.filter = f; buildPanel(); draw(); }; fr.appendChild(b); setTimeout(() => { const keep = st.filter; st.filter = f; if (src.naturalWidth) { const tmp = document.createElement('canvas'); paint(tmp, 120); c.getContext('2d').drawImage(tmp, 0, 0, 80, 60); } st.filter = keep; }, 0); });
          panel.appendChild(fr);
          sec('Adjust');
          [['light', 'Brightness', -60, 60], ['con', 'Contrast', -60, 60], ['sat', 'Color', -100, 100], ['warm', 'Warmth', -100, 100], ['vig', 'Vignette', 0, 100]].forEach(([k, l, mn, mx]) => {
            const val = h('span', {}, st[k]);
            const r = h('input', { type: 'range', min: mn, max: mx, value: st[k] }); r.oninput = () => { st[k] = +r.value; val.textContent = r.value; draw(); };
            r.ondblclick = () => { st[k] = 0; r.value = 0; val.textContent = 0; draw(); };
            panel.appendChild(h('label', { class: 'ed-adj' }, h('div', {}, PatOS.t(l), val), r));
          });
          sec('Crop and Rotate');
          panel.appendChild(h('div', { class: 'ed-crop' }, ...[['original', 'Original'], ['square', 'Square'], ['wide', '16:9'], ['photo', '4:3'], ['portrait', '3:4']].map(([k, l]) => h('button', { class: 'btn' + (st.crop === k ? ' primary' : ''), onclick: () => { st.crop = k; buildPanel(); draw(); } }, PatOS.t(l)))));
          panel.appendChild(h('div', { class: 'ed-crop' }, h('button', { class: 'btn', onclick: () => { st.rot = (st.rot + 270) % 360; draw(); } }, '⟲ ' + PatOS.t('Rotate')), h('button', { class: 'btn', onclick: () => { st.flip = !st.flip; draw(); } }, '⇋ ' + PatOS.t('Mirror'))));
        }
        function save(replace) {
          const out = document.createElement('canvas'); paint(out, 1800);
          const data = out.toDataURL('image/jpeg', 0.9);
          if (replace) { PatOS.fs.write(p.path, data); }
          else { const nm = PatOS.fs.uniqueName('/Pictures', p.name.replace(/\.\w+$/, '') + ' ' + PatOS.t('edited') + '.jpg'); PatOS.fs.write('/Pictures/' + nm, data); }
          layer.remove(); PatOS.notify({ title: PatOS.t(replace ? 'Photo saved' : 'Copy saved to Pictures'), body: p.name, icon: 'photos' });
          album = album === 'art' ? 'library' : album; render(); viewer.classList.add('hidden');
        }
        buildPanel();
      }
      /* ---------- slideshow ---------- */
      function slideshow(start) {
        if (!list.length) return;
        let i = start || 0;
        const layer = h('div', { class: 'ph-show' }); document.body.appendChild(layer);
        if (layer.requestFullscreen) layer.requestFullscreen().catch(() => {});
        const step = () => { const img = h('img', { src: list[i].src, alt: '' }); layer.appendChild(img); requestAnimationFrame(() => img.classList.add('in')); const old = layer.querySelectorAll('img'); if (old.length > 2) old[0].remove(); i = (i + 1) % list.length; };
        step(); const t = setInterval(step, 4000);
        const end = () => { clearInterval(t); document.removeEventListener('keydown', key, true); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); layer.remove(); };
        const key = (e) => { if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); end(); } };
        layer.onclick = end; document.addEventListener('keydown', key, true);
      }
      zoom.oninput = () => { size = +zoom.value; PatOS.store.set('photoSize', size); grid.style.setProperty('--ph', size + 'px'); };
      bShow.onclick = () => slideshow(0);
      bImport.onclick = () => PatOS.importFiles('/Pictures', 'image/*');
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => {
        if (viewer.classList.contains('hidden') || viewer.querySelector('.ed-layer')) return;
        if (e.key === 'ArrowRight') viewer.querySelector('.ph-nav.r') && viewer.querySelector('.ph-nav.r').click();
        if (e.key === 'ArrowLeft') viewer.querySelector('.ph-nav.l') && viewer.querySelector('.ph-nav.l').click();
        if (e.key === 'Escape') { viewer.classList.add('hidden'); render(); }
      });
      const off = PatOS.on('fs', PatOS.debounce(() => { if (viewer.classList.contains('hidden')) render(); else renderSide(); }, 200));
      win.on('closed', off);
      win._open = (a) => { if (a.path) { album = 'library'; render(); const i = list.findIndex((x) => x.path === PatOS.fs.norm(a.path)); if (i >= 0) open(i); } };
      render(); if (args.path) win._open(args);
    },
    onArgs(win, args) { win._open(args); }
  });
})();
