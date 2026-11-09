/* Photos — library, your own albums, favorites, search, multi-select, a viewer you can zoom, pan and swipe,
   photo info, slideshow and a photo editor. Thumbnails are made small and only for what is on screen, so
   thousands of photos stay fast; large photos kept as files work too. Drop pictures on the window to add them. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const LOC = () => (PatOS.lang === 'fr' ? 'fr-CA' : undefined);
  const samples = [];
  function sampleArt() {
    if (samples.length) return samples;
    /* each picture is made the first time it is looked at (counting the album must not make them all) */
    const lazy = (name, make) => { const it = { name, sample: true }; let url = null; Object.defineProperty(it, 'src', { enumerable: true, get() { return url || (url = make()); }, set(v) { url = v; } }); return it; };
    ['sonora', 'aurora', 'monterra', 'ocean', 'sunrise', 'mint', 'ember', 'midnight'].forEach((k) => samples.push(lazy(PatOS.wallpaper.palettes[k].name, () => PatOS.wallpaper.thumbLarge(k))));
    const gen = (name, fn) => samples.push(lazy(name, () => { const c = document.createElement('canvas'); c.width = 640; c.height = 400; fn(c.getContext('2d'), 640, 400); return c.toDataURL('image/jpeg', 0.85); }));
    gen('Circles', (x, W, H) => { x.fillStyle = '#0d1b2a'; x.fillRect(0, 0, W, H); for (let i = 0; i < 70; i++) { x.fillStyle = `hsla(${180 + Math.random() * 140},80%,60%,.35)`; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, 10 + Math.random() * 70, 0, 7); x.fill(); } });
    gen('Mountains', (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ff9a8b'); g.addColorStop(1, '#ff6a88'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#fff6'; x.beginPath(); x.arc(W * 0.7, H * 0.35, 50, 0, 7); x.fill(); ['#7a3b69', '#563d7c', '#2d1e4f'].forEach((c, j) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 20) x.lineTo(i, H * (0.45 + j * 0.15) - Math.abs(Math.sin(i * 0.01 * (j + 1) + j)) * 90); x.lineTo(W, H); x.fill(); }); });
    gen('Grid City', (x, W, H) => { x.fillStyle = '#090018'; x.fillRect(0, 0, W, H); x.strokeStyle = '#ff2fa3'; for (let i = -20; i <= 20; i++) { x.beginPath(); x.moveTo(W / 2 + i * 12, H * 0.55); x.lineTo(W / 2 + i * 90, H); x.stroke(); } for (let j = 0; j < 12; j++) { const y = H * 0.55 + Math.pow(j / 12, 2) * H * 0.45; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } const g = x.createLinearGradient(0, 60, 0, 220); g.addColorStop(0, '#ffd319'); g.addColorStop(1, '#ff2975'); x.fillStyle = g; x.beginPath(); x.arc(W / 2, H * 0.55, 120, Math.PI, 0); x.fill(); });
    return samples;
  }
  const FILTERS = { Original: {}, Vivid: { sat: 45, con: 15 }, Warm: { warm: 40, sat: 10 }, Cool: { warm: -40 }, Mono: { sat: -100 }, Noir: { sat: -100, con: 45, light: -10 }, Fade: { con: -25, light: 10, sat: -25 }, Dramatic: { con: 35, light: -12, vig: 50 } };
  const favs = () => PatOS.store.get('photoFavs', []);
  const userAlbums = () => PatOS.store.get('photoAlbums', []);

  /* small pictures for the grid: made one at a time, kept in memory */
  const thumbs = new Map(); let thumbChain = Promise.resolve();
  const srcOf = async (p) => { if (p.src) return p.src; if (p.blob) p.src = await PatOS.fs.blobURL(p.path); return p.src; };
  function thumbOf(p) {
    const key = (p.path || p.name) + '|' + (p.mtime || 0);
    if (thumbs.has(key)) return thumbs.get(key);
    const job = thumbChain.then(async () => {
      const src = await srcOf(p); if (!src) return '';
      if (p.sample) return src;
      return new Promise((res) => {
        const im = new Image();
        im.onload = () => { try { const s = Math.min(1, 360 / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); p.w = im.naturalWidth; p.h = im.naturalHeight; res(c.toDataURL('image/jpeg', 0.72)); } catch (e) { res(src); } };
        im.onerror = () => res('');
        im.src = src;
      });
    });
    thumbChain = job.catch(() => '').then(() => new Promise((r) => setTimeout(r, 0)));
    thumbs.set(key, job); return job;
  }

  PatOS.registerApp({
    id: 'photos', name: 'Photos', icon: 'photos', width: 1000, height: 660, keywords: 'pictures images gallery edit album camera roll photos',
    about: 'Your pictures: albums, favorites, search, a viewer you can zoom and swipe, and an editor with filters.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let album = 'library', size = PatOS.store.get('photoSize', 160), list = [], selecting = false, query = '';
      const sel = new Set();
      const zoom = h('input', { type: 'range', min: 90, max: 280, value: size, class: 'ph-zoom', title: T('Thumbnail size'), 'aria-label': T('Thumbnail size') });
      const search = h('input', { class: 'field ph-search', placeholder: T('Search'), spellcheck: 'false', 'aria-label': T('Search photos') });
      const bSel = h('button', { class: 'btn ph-selbtn' }, T('Select'));
      const bShow = h('button', { class: 'tbtn', title: T('Slideshow'), 'aria-label': T('Slideshow'), html: PatOS.sym('play') });
      const bImport = h('button', { class: 'tbtn', title: T('Import photos'), 'aria-label': T('Import photos'), html: PatOS.sym('upload') });
      win.toolbar.append(h('div', { style: { flex: 1 } }), search, zoom, bSel, bShow, bImport); win.toolbar.style.paddingLeft = '200px';
      const side = h('div', { class: 'ph-side' });
      const grid = h('div', { class: 'ph-grid' });
      const viewer = h('div', { class: 'ph-view hidden' });
      const selBar = h('div', { class: 'ph-selbar hidden' });
      win.body.appendChild(h('div', { class: 'ph-wrap' }, side, h('div', { class: 'ph-main' }, h('div', { class: 'ph-col' }, grid, selBar), viewer)));
      if (PatOS.mobile && PatOS.mobile.stack) { /* the phone shows the album chips over the grid, no stack needed */ }

      function userImages() {
        const out = [];
        PatOS.fs.walk('/', (p, n) => {
          if (p.startsWith('/.Trash') || PatOS.fileKind(p, n) !== 'image') return;
          if (n.blob) out.push({ name: PatOS.fs.basename(p), path: p, mtime: n.mtime, blob: true, size: PatOS.fs.size(n) });
          else if (String(n.content).startsWith('data:image')) out.push({ name: PatOS.fs.basename(p), src: n.content, path: p, mtime: n.mtime, size: PatOS.fs.size(n) });
        });
        return out.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      }
      const BASE = [
        ['library', 'Library', 'image', () => userImages()],
        ['favorites', 'Favorites', 'star', () => userImages().filter((p) => favs().includes(p.path))],
        ['screens', 'Screenshots', 'desktop', () => userImages().filter((p) => /screenshot|capture/i.test(p.name))],
        ['booth', 'Photo Booth', 'camera', () => userImages().filter((p) => /photo booth/i.test(p.name))],
        ['drawings', 'Drawings', 'brush', () => userImages().filter((p) => /drawing|dessin|galaxy|scene/i.test(p.name))],
        ['art', 'Art', 'sparkle', () => sampleArt()]
      ];
      const albums = () => BASE.concat(userAlbums().map((a) => ['u:' + a.id, a.name, 'image', () => userImages().filter((p) => a.paths.includes(p.path)), true]));
      const current = () => albums().find((a) => a[0] === album) || BASE[0];
      const label = (a) => (a[4] ? a[1] : T(a[1]));

      function renderSide() {
        side.innerHTML = '';
        side.appendChild(h('div', { class: 'fd-sh' }, T('Photos')));
        const all = userImages();
        albums().forEach(([k, l, ic, fn, mine], i) => {
          if (i === 2) side.appendChild(h('div', { class: 'fd-sh' }, T('Albums')));
          if (mine && !side.querySelector('.ph-mine')) side.appendChild(h('div', { class: 'fd-sh ph-mine' }, T('My Albums')));
          const n = k === 'library' ? all.length : fn().length;
          const b = h('div', { class: 'fd-si' + (album === k ? ' on' : ''), tabindex: '0', role: 'button' }, h('span', { class: 'symw', html: PatOS.sym(ic) }), mine ? l : T(l), h('small', { class: 'ph-count' }, n || ''));
          const go = () => { album = k; selecting = false; sel.clear(); viewer.classList.add('hidden'); render(); }; b.onclick = go; b.onkeydown = (e) => { if (e.key === 'Enter') go(); };
          if (mine) b.oncontextmenu = (e) => { e.preventDefault(); const a = userAlbums().find((x) => 'u:' + x.id === k); PatOS.menu([
            { label: T('Rename Album…'), action: async () => { const v = await PatOS.ask(T('Rename Album…'), a.name, { icon: 'photos', ok: T('Rename') }); if (v) { const all2 = userAlbums(); all2.find((x) => x.id === a.id).name = v.trim().slice(0, 40) || a.name; PatOS.store.set('photoAlbums', all2); render(); } } },
            { label: T('Delete Album'), action: async () => { if (await PatOS.confirmBox(T('Delete this album?'), T('The photos stay in your library.'), { danger: true, ok: T('Delete'), icon: 'photos' })) { PatOS.store.set('photoAlbums', userAlbums().filter((x) => x.id !== a.id)); if (album === k) album = 'library'; render(); } } }], e.clientX, e.clientY); };
          side.appendChild(b);
        });
        side.appendChild(h('button', { class: 'nf-new ph-newalbum', onclick: newAlbum }, '+ ' + T('New Album')));
      }
      async function newAlbum(withPaths) {
        const name = await PatOS.ask(T('New Album'), '', { icon: 'photos', ok: T('Create'), text: T('Give the album a name.') }); if (!name || !name.trim()) return null;
        const a = { id: PatOS.uid(), name: name.trim().slice(0, 40), paths: Array.isArray(withPaths) ? withPaths.slice() : [] };
        PatOS.store.set('photoAlbums', userAlbums().concat(a)); album = 'u:' + a.id; render(); return a;
      }
      function addToAlbum(paths, anchor) {
        const r = anchor.getBoundingClientRect(); const ua = userAlbums();
        PatOS.menu([{ header: T('Add to Album') }, ...ua.map((a) => ({ label: a.name, action: () => { const all = userAlbums(); const t = all.find((x) => x.id === a.id); paths.forEach((p) => { if (!t.paths.includes(p)) t.paths.push(p); }); PatOS.store.set('photoAlbums', all); PatOS.office && PatOS.office.toast && PatOS.office.toast(win, paths.length + ' → ' + a.name); render(); } })), ua.length ? { divider: true } : null, { label: T('New Album…'), action: () => newAlbum(paths) }], r.left, r.top - 8 - 36 * (ua.length + 2));
      }

      /* ---------- the grid ---------- */
      let io = null;
      function render() {
        renderSide();
        const cur = current(); list = cur[3]();
        const q = query.trim().toLowerCase(); if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
        grid.style.setProperty('--ph', size + 'px');
        grid.innerHTML = ''; if (io) io.disconnect();
        io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; io.unobserve(e.target); const img = e.target; const p = list[+img.dataset.i]; if (p) thumbOf(p).then((u) => { if (u && img.isConnected) { img.src = u; img.classList.add('in'); } }); }), { root: grid, rootMargin: '300px' });
        if (!list.length) grid.appendChild(h('div', { class: 'ph-empty' }, h('div', { class: 'ph-big', html: PatOS.iconHTML('photos') }), h('b', {}, T(q ? 'No results' : album === 'favorites' ? 'No favorites yet' : 'No photos here yet')), h('p', {}, q ? '' : T(album === 'favorites' ? 'Open a photo and press the star.' : cur[4] ? 'Select photos in the Library and add them to this album.' : 'Take a picture with Photo Booth, drag pictures in, or use the import button.'))));
        let lastDay = '';
        list.forEach((p, i) => {
          const day = p.mtime ? new Date(p.mtime).toLocaleDateString(LOC(), { weekday: 'long', month: 'long', day: 'numeric' }) : '';
          if (day && day !== lastDay && album !== 'art') { lastDay = day; grid.appendChild(h('div', { class: 'ph-day' }, day)); }
          const img = h('img', { alt: p.name, 'data-i': String(i), draggable: 'false' });
          const isSel = p.path && sel.has(p.path);
          const t = h('div', { class: 'ph-thumb' + (isSel ? ' sel' : ''), tabindex: '0', role: 'button', 'aria-label': p.name }, img, p.path && favs().includes(p.path) ? h('span', { class: 'ph-heart', html: PatOS.sym('star') }) : null, selecting ? h('span', { class: 'ph-check' }, isSel ? '✓' : '') : null);
          const act = () => { flyFrom = (t.querySelector('img') || t).getBoundingClientRect(); if (selecting && p.path) { if (sel.has(p.path)) sel.delete(p.path); else sel.add(p.path); t.classList.toggle('sel', sel.has(p.path)); const ck = t.querySelector('.ph-check'); if (ck) ck.textContent = sel.has(p.path) ? '✓' : ''; paintSelBar(); } else open(i); };
          t.onclick = act; t.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } };
          t.oncontextmenu = (e) => { if (!p.path) return; e.preventDefault(); PatOS.menu([{ label: T('Open'), action: () => open(i) }, { label: favs().includes(p.path) ? T('Remove from Favorites') : T('Favorite'), action: () => toggleFav(p.path) }, { label: T('Add to Album'), action: () => addToAlbum([p.path], t) }, { label: T('Download'), action: () => download(p) }, { divider: true }, { label: T('Move to Trash'), action: () => trash([p.path]) }], e.clientX, e.clientY); };
          grid.appendChild(t); io.observe(img);
        });
        bSel.textContent = selecting ? T('Done') : T('Select'); bSel.classList.toggle('primary', selecting);
        paintSelBar();
        win.setTitle(label(cur));
      }
      function toggleFav(path) { const f = favs(); const k = f.indexOf(path); if (k >= 0) f.splice(k, 1); else f.push(path); PatOS.store.set('photoFavs', f); render(); }
      async function download(p) { const src = await srcOf(p); PatOS.downloadFile(p.name.includes('.') ? p.name : p.name + '.jpg', src); }
      function trash(paths) {
        paths.forEach((p) => { try { PatOS.fs.remove(p); } catch (e) {} });
        sel.clear(); PatOS.office && PatOS.office.toast && PatOS.office.toast(win, paths.length + ' ' + T(paths.length === 1 ? 'photo moved to the Trash' : 'photos moved to the Trash')); PatOS.sound && PatOS.sound.trash && PatOS.sound.trash();
      }
      function paintSelBar() {
        selBar.classList.toggle('hidden', !selecting); if (!selecting) return;
        selBar.innerHTML = '';
        const n = sel.size, paths = [...sel];
        const b = (t, fn, cls) => { const x = h('button', { class: 'btn' + (cls ? ' ' + cls : ''), disabled: !n }, t); x.onclick = () => fn(x); return x; };
        selBar.append(h('span', { class: 'ph-selcount' }, n ? (n === 1 ? T('1 photo selected') : n + ' ' + T('photos selected')) : T('Select photos')), h('div', { style: { flex: 1 } }),
          h('button', { class: 'btn', onclick: () => { list.forEach((p) => p.path && sel.add(p.path)); render(); } }, T('Select All')),
          b(T('Favorite'), () => { const f = favs(); const all = paths.every((p) => f.includes(p)); PatOS.store.set('photoFavs', all ? f.filter((p) => !paths.includes(p)) : [...new Set(f.concat(paths))]); render(); }),
          b(T('Add to Album'), (x) => addToAlbum(paths, x)),
          b(T('Download'), async () => { for (const p of paths) { const it = list.find((z) => z.path === p); if (it) await download(it); } }),
          b(T('Move to Trash'), () => trash(paths), 'danger'));
      }

      /* ---------- the viewer: zoom with the wheel or a pinch, drag to pan, swipe or arrows to move on ---------- */
      let flyFrom = null; // where the photo was tapped: it flies from there into the viewer
      async function open(i) {
        const p = list[i]; if (!p) return;
        const src = await srcOf(p); if (!src) return;
        viewer.innerHTML = ''; viewer.classList.remove('hidden');
        const isFav = p.path && favs().includes(p.path);
        const img = h('img', { src, alt: p.name, draggable: 'false' });
        img.onload = () => { p.w = img.naturalWidth; p.h = img.naturalHeight; if (info.isConnected && !info.classList.contains('hidden')) paintInfo(); };
        const heart = p.path ? h('button', { class: 'tbtn ph-fav' + (isFav ? ' on' : ''), title: T('Favorite'), 'aria-label': T('Favorite'), html: PatOS.sym('star') }) : null;
        if (heart) heart.onclick = () => { const f = favs(); const k = f.indexOf(p.path); if (k >= 0) f.splice(k, 1); else f.push(p.path); PatOS.store.set('photoFavs', f); heart.classList.toggle('on', k < 0); renderSide(); };
        const info = h('div', { class: 'ph-info hidden' });
        const paintInfo = () => {
          info.innerHTML = '';
          const row = (k, v) => v ? h('div', { class: 'ph-ir' }, h('small', {}, T(k)), h('span', {}, v)) : null;
          info.append(h('b', {}, p.name), row('Date', p.mtime ? new Date(p.mtime).toLocaleString(LOC(), { dateStyle: 'long', timeStyle: 'short' }) : ''), row('Size', p.size ? PatOS.fmtBytes(p.size) : ''), row('Dimensions', p.w ? p.w + ' × ' + p.h : ''), row('Where', p.path ? PatOS.fs.dirname(p.path) : ''));
        };
        const bInfo = h('button', { class: 'tbtn', title: T('Info'), 'aria-label': T('Info'), html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>', onclick: () => { info.classList.toggle('hidden'); paintInfo(); } });
        const bar = h('div', { class: 'ph-bar' },
          h('button', { class: 'btn', onclick: close }, '‹ ' + T('All Photos')),
          h('div', { class: 'ph-title' }, h('b', {}, p.name), p.mtime ? h('small', {}, new Date(p.mtime).toLocaleString(LOC(), { dateStyle: 'long', timeStyle: 'short' })) : null), h('div', { style: { flex: 1 } }),
          heart, bInfo, h('button', { class: 'btn primary', onclick: () => openEdit(p) }, T('Edit')),
          h('button', { class: 'tbtn', title: T('More'), 'aria-label': T('More'), html: '<svg class="sym" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([
            { label: T('Set as Wallpaper'), action: async () => { PatOS.setSetting('customWallpaper', await srcOf(p)); PatOS.setSetting('wallpaper', 'custom'); PatOS.notify({ title: T('Wallpaper set'), body: p.name, icon: 'photos' }); } },
            { label: T('Slideshow'), action: () => slideshow(i) },
            p.path ? { label: T('Open in Paint'), action: () => PatOS.launch('paint', { path: p.path }) } : null,
            p.path ? { label: T('Add to Album'), action: () => addToAlbum([p.path], e.currentTarget) } : null,
            { label: T('Download'), action: () => download(p) },
            p.path ? { divider: true } : null, p.path ? { label: T('Move to Trash'), action: removeCurrent } : null], r.left - 150, r.bottom + 4); } }));
        const removeCurrent = () => { if (!p.path) return; trash([p.path]); render(); if (list.length) open(Math.min(i, list.length - 1)); else close(); };
        const go = (d) => open((i + d + list.length) % list.length);
        const prev = h('button', { class: 'ph-nav l', 'aria-label': T('Previous'), onclick: () => go(-1) }, '‹');
        const next = h('button', { class: 'ph-nav r', 'aria-label': T('Next'), onclick: () => go(1) }, '›');
        const stage = h('div', { class: 'ph-stage' }, img, list.length > 1 ? prev : null, list.length > 1 ? next : null, info);
        /* zoom and pan */
        let z = 1, tx = 0, ty = 0; const pts = new Map(); let startD = 0, startZ = 1, drag = null;
        const apply = (smooth) => { img.style.transition = smooth ? '' : 'none'; img.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`; img.style.cursor = z > 1 ? 'grab' : ''; };
        const clampPan = () => { const r = stage.getBoundingClientRect(); const mx = Math.max(0, (img.clientWidth * z - r.width) / 2), my = Math.max(0, (img.clientHeight * z - r.height) / 2); tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty)); };
        const setZoom = (nz, cx, cy) => { nz = Math.max(1, Math.min(8, nz)); const r = stage.getBoundingClientRect(); const ox = (cx == null ? r.left + r.width / 2 : cx) - (r.left + r.width / 2), oy = (cy == null ? r.top + r.height / 2 : cy) - (r.top + r.height / 2); tx = ox - (ox - tx) * nz / z; ty = oy - (oy - ty) * nz / z; z = nz; if (z === 1) { tx = 0; ty = 0; } clampPan(); apply(false); };
        stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
        stage.addEventListener('dblclick', (e) => { if (e.target.closest('button, .ph-info')) return; if (z === 1) setZoom(2.5, e.clientX, e.clientY); else { z = 1; tx = ty = 0; apply(true); } });
        stage.addEventListener('pointerdown', (e) => { if (e.target.closest('button, .ph-info')) return; stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b2] = [...pts.values()]; startD = Math.hypot(a.x - b2.x, a.y - b2.y); startZ = z; drag = null; } else drag = { x: e.clientX, y: e.clientY, tx, ty, t: Date.now(), moved: 0 }; });
        stage.addEventListener('pointermove', (e) => {
          if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pts.size === 2) { const [a, b2] = [...pts.values()]; setZoom(startZ * Math.hypot(a.x - b2.x, a.y - b2.y) / (startD || 1), (a.x + b2.x) / 2, (a.y + b2.y) / 2); return; }
          if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
          if (z > 1) { tx = drag.tx + dx; ty = drag.ty + dy; clampPan(); apply(false); } else { img.style.transition = 'none'; img.style.transform = `translateX(${dx}px)`; }
        });
        const up = (e) => {
          pts.delete(e.pointerId); if (!drag || pts.size) return; const d = drag; drag = null;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (z === 1) { img.style.transition = ''; img.style.transform = ''; if (list.length > 1 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); else if (dy > 120 && Math.abs(dx) < 80) close(); }
        };
        stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); drag = null; apply(true); });
        viewer.append(bar, stage);
        // shared element: the photo grows from its thumbnail into place, on the system spring
        const from = flyFrom; flyFrom = null;
        if (from && from.width && !PatOS.settings.reduceMotion && img.animate) {
          const fly = () => { const r = img.getBoundingClientRect(); if (!r.width) return; const s2 = Math.max(from.width / r.width, from.height / r.height), sp = PatOS.motion ? PatOS.motion.get() : { dur: 420, easing: 'ease-out' };
            img.animate([{ transform: `translate(${from.left + from.width / 2 - (r.left + r.width / 2)}px, ${from.top + from.height / 2 - (r.top + r.height / 2)}px) scale(${s2})`, borderRadius: '12px' }, { transform: 'none', borderRadius: '0px' }], { duration: sp.dur, easing: sp.easing });
            bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 }); };
          if (img.complete && img.naturalWidth) requestAnimationFrame(fly); else img.addEventListener('load', () => requestAnimationFrame(fly), { once: true });
        }
        win._viewIdx = i; win._viewer = { go, close, zoom: (f) => setZoom(f === 0 ? 1 : z * f), info: () => bInfo.click(), fav: () => heart && heart.click(), edit: () => openEdit(p), del: removeCurrent };
        win.setTitle(p.name);
      }
      function close() { viewer.classList.add('hidden'); viewer.innerHTML = ''; win._viewer = null; render(); }
      async function openEdit(p) { await srcOf(p); edit(p); }

      /* ---------- photo editor ---------- */
      function edit(p) {
        const st = { light: 0, con: 0, sat: 0, warm: 0, vig: 0, rot: 0, flip: false, crop: 'original', filter: 'Original' };
        const src = new Image(); src.src = p.src; // p.src is ready (see openEdit)
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
      bSel.onclick = () => { selecting = !selecting; if (!selecting) sel.clear(); render(); };
      search.addEventListener('input', () => { query = search.value; render(); });
      // drop pictures on the window to add them to Pictures
      win.body.addEventListener('dragover', (e) => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); win.body.classList.add('ph-drop'); } });
      win.body.addEventListener('dragleave', (e) => { if (!win.body.contains(e.relatedTarget)) win.body.classList.remove('ph-drop'); });
      win.body.addEventListener('drop', async (e) => { win.body.classList.remove('ph-drop'); const fs = [...(e.dataTransfer.files || [])].filter((f) => /^image\//.test(f.type)); if (!fs.length) return; e.preventDefault(); const out = await PatOS.importFileList('/Pictures', fs); PatOS.office && PatOS.office.toast && PatOS.office.toast(win, out.length + ' ' + T(out.length === 1 ? 'photo added' : 'photos added')); });
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea')) return;
        const V = win._viewer;
        if (viewer.querySelector('.ed-layer')) return;
        if (V) {
          if (e.key === 'ArrowRight') { e.preventDefault(); V.go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); V.go(-1); }
          else if (e.key === 'Escape') { e.preventDefault(); V.close(); } else if (e.key === '+' || e.key === '=') V.zoom(1.3); else if (e.key === '-') V.zoom(1 / 1.3); else if (e.key === '0') V.zoom(0);
          else if (e.key.toLowerCase() === 'i') V.info(); else if (e.key.toLowerCase() === 'f') V.fav(); else if (e.key.toLowerCase() === 'e') V.edit(); else if (e.key === 'Delete' || e.key === 'Backspace') V.del();
        } else if ((e.key === 'a' || e.key === 'A') && e.ctrlKey && selecting) { e.preventDefault(); list.forEach((p) => p.path && sel.add(p.path)); render(); }
        else if (e.key === 'Escape' && selecting) { selecting = false; sel.clear(); render(); }
        else if ((e.key === 'Delete' || e.key === 'Backspace') && selecting && sel.size) trash([...sel]);
      });
      const off = PatOS.on('fs', PatOS.debounce(() => { for (const p of [...sel]) if (!PatOS.fs.exists(p)) sel.delete(p); if (viewer.classList.contains('hidden')) render(); else renderSide(); }, 200));
      win.on('closed', () => { off(); if (io) io.disconnect(); });
      win._open = (a) => { if (a.path) { album = 'library'; query = ''; render(); const i = list.findIndex((x) => x.path === PatOS.fs.norm(a.path)); if (i >= 0) open(i); } };
      render(); if (args.path) win._open(args);
    },
    onArgs(win, args) { win._open(args); }
  });
})();
