/* PatOS Gallery (4.0): a visual way to keep and show things. It complements Piles (folders) with collections you arrange.
   - A gallery holds files (pictures, videos, documents), notes and links. It can also follow a PatOS Data collection (it
     changes with it) or a folder.
   - Layouts: Grid · Masonry · Photo wall · Free (place and size things yourself) · List. Same gallery, five ways to see it.
   - Pictures load only when they're about to show, and big galleries draw in pieces, so a large one never slows the desktop.
   - Present: full screen, one at a time, with the arrow keys (and an automatic slideshow).
   - Related: what PatOS Data connects to the selected thing. Drag things to reorder; drop files in to add them.
   - Taking something out of a gallery never deletes the file. Share a gallery to a Shared Space, or export it (.patgallery,
     with small previews inside, so it can be opened on another PatOS). */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.gallery = { bg: 'linear-gradient(160deg,#ff9f0a,#ff375f)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="14" width="20" height="16" rx="4" fill="#fff"/><rect x="34" y="14" width="20" height="24" rx="4" fill="#fff" opacity=".8"/><rect x="10" y="34" width="20" height="16" rx="4" fill="#fff" opacity=".75"/><rect x="34" y="42" width="20" height="8" rx="3" fill="#fff" opacity=".9"/><circle cx="17" cy="20" r="2.6" fill="#ff9f0a"/></svg>' };
  const KEY = 'galleries';
  const uid = () => Math.random().toString(36).slice(2, 10);
  const IMG = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i, VID = /\.(mp4|webm|mov|m4v|ogv)$/i, TXT = /\.(txt|md|csv|json|html?|js|py|pit)$/i;
  const load = () => (PatOS.store.get(KEY, []) || []).filter((g) => g && g.id);
  const store = (l) => { PatOS.store.set(KEY, l); PatOS.emit('gallery'); };
  // an item: { id, kind: 'file'|'note'|'link', path?, noteId?, url?, title?, x, y, w, h (free layout) }
  function cleanItem(it) {
    if (!it) return null; const b = { id: /^[a-z0-9]{4,12}$/.test(it.id || '') ? it.id : uid(), x: +it.x || 0, y: +it.y || 0, w: Math.max(80, +it.w || 240), h: Math.max(60, +it.h || 180), title: String(it.title || '').slice(0, 120) };
    if (it.kind === 'file' && typeof it.path === 'string' && it.path[0] === '/') return Object.assign(b, { kind: 'file', path: it.path.slice(0, 400) });
    if (it.kind === 'note' && it.noteId) return Object.assign(b, { kind: 'note', noteId: String(it.noteId).slice(0, 40) });
    if (it.kind === 'link' && /^https?:\/\/\S{3,500}$/i.test(it.url || '')) return Object.assign(b, { kind: 'link', url: it.url });
    if (it.kind === 'preview' && /^data:image\/(jpeg|png|webp);base64,/.test(it.src || '') && it.src.length < 60000) return Object.assign(b, { kind: 'preview', src: it.src }); // (from a shared .patgallery)
    if (it.kind === 'label' && b.title) return Object.assign(b, { kind: 'label', text: String(it.text || '').slice(0, 600) }); // (a title and a few words: a note or a file, in a shared copy)
    return null;
  }
  // what the gallery shows now (a collection or a folder follows its source)
  function itemsOf(g) {
    if (g.source && g.source.collection && PatOS.data) { const c = PatOS.data.collection(g.source.collection); return c ? c.items.map((i) => { const [kind, ...r] = i.key.split(':'); const id = r.join(':'); return kind === 'file' ? { id: 'k' + btoa(unescape(encodeURIComponent(id))).replace(/[^a-z0-9]/gi, '').slice(-10), kind: 'file', path: id, title: i.title } : kind === 'note' ? { id: 'n' + id.replace(/[^a-z0-9]/gi, '').slice(-10), kind: 'note', noteId: id, title: i.title } : null; }).filter(Boolean) : []; }
    if (g.source && g.source.folder) { const out = []; try { (PatOS.fs.list(g.source.folder) || []).forEach((n) => { const p = g.source.folder.replace(/\/$/, '') + '/' + n; if (!PatOS.fs.isDir(p) && !/^\./.test(n)) out.push({ id: 'f' + n.replace(/[^a-z0-9]/gi, '').slice(-10), kind: 'file', path: p, title: n }); }); } catch (e) {} return out; }
    return g.items || [];
  }
  const G = {
    list: () => load().map((g) => ({ id: g.id, name: g.name, count: itemsOf(g).length, layout: g.layout })),
    create(name, opts) { opts = opts || {}; const g = { id: 'g' + uid(), name: String(name || T('My gallery')).slice(0, 60), layout: opts.layout || 'grid', items: (opts.items || []).map(cleanItem).filter(Boolean), source: opts.source || null, created: Date.now(), updated: Date.now() }; store(load().concat(g)); return g.id; },
    add(id, items) { const l = load(); const g = l.find((x) => x.id === id); if (!g || g.source) return 0; const add = (items || []).map(cleanItem).filter(Boolean).filter((it) => !g.items.some((o) => o.kind === it.kind && o.path === it.path && o.noteId === it.noteId && o.url === it.url)); g.items = g.items.concat(add).slice(0, 5000); g.updated = Date.now(); store(l); return add.length; },
    items: (id) => { const g = load().find((x) => x.id === id); return g ? itemsOf(g) : []; }
  };
  PatOS.gallery = G;

  PatOS.registerApp({
    id: 'gallery', name: 'Gallery', icon: 'gallery', width: 1180, height: 760, minWidth: 680, minHeight: 440, category: 'Photo & Video', keywords: 'gallery collections moodboard photo wall present slideshow visual galerie diaporama',
    about: 'Collections you arrange, present and share.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'gl-win');
      let gid = null, sel = null, urls = new Map(), shown = 120;
      const side = h('div', { class: 'gl-side' }), main = h('div', { class: 'gl-main', tabindex: '0' }), rel = h('div', { class: 'gl-rel hidden' });
      win.body.append(h('div', { class: 'gl-wrap' }, side, main, rel));
      const cur = () => load().find((g) => g.id === gid) || null;
      const mutate = (fn) => { const l = load(); const g = l.find((x) => x.id === gid); if (!g) return; fn(g); g.updated = Date.now(); store(l); };
      const layoutSeg = h('span');
      win.toolbar.append(layoutSeg, h('div', { style: { flex: 1 } }),
        h('button', { class: 'btn', onclick: (e) => addMenu(e) }, '+ ' + T('Add')),
        h('button', { class: 'btn', onclick: () => present(0) }, T('Present')),
        h('button', { class: 'btn', 'aria-label': T('More'), onclick: (e) => moreMenu(e) }, '•••'));

      // pictures load only near the screen; their memory is given back when the gallery changes
      const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { const el = en.target; io.unobserve(el); fillMedia(el); } }), { root: main, rootMargin: '400px' });
      async function urlFor(path) {
        if (urls.has(path)) return urls.get(path);
        let u = null; try { const c = PatOS.fs.read(path); if (typeof c === 'string' && c.startsWith('data:')) u = c; else { const b = await PatOS.fs.getBlob(path); if (b) u = URL.createObjectURL(b); } } catch (e) {}
        if (u) urls.set(path, u); return u;
      }
      function freeUrls() { urls.forEach((u) => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); }); urls = new Map(); }
      async function fillMedia(el) {
        const p = el.dataset.path; if (!p) return; const u = await urlFor(p); if (!u || !el.isConnected) return;
        if (VID.test(p)) { const v = h('video', { src: u, muted: true, preload: 'metadata', playsinline: true, loop: true }); v.muted = true; el.appendChild(v); el.onmouseenter = () => v.play().catch(() => {}); el.onmouseleave = () => v.pause(); }
        else { const img = h('img', { src: u, alt: '', draggable: 'false', loading: 'lazy' }); el.appendChild(img); }
      }
      const noteOf = (id) => (PatOS.store.get('notes', []) || []).find((n) => n.id === id);
      function card(it, i, g) {
        const isFile = it.kind === 'file', name = isFile ? it.path.split('/').pop() : '', exists = !isFile || PatOS.fs.exists(it.path);
        const media = isFile && exists && (IMG.test(name) || VID.test(name));
        const el = h('div', { class: 'gl-card' + (media ? ' media' : '') + (sel === it.id ? ' on' : '') + (VID.test(name) ? ' video' : ''), 'data-id': it.id, tabindex: '0', draggable: g.source ? 'false' : 'true', role: 'button', 'aria-label': it.title || name || it.url || '' });
        if (media) { const m = h('div', { class: 'gl-m', 'data-path': it.path }); el.appendChild(m); io.observe(m); }
        else if (it.kind === 'preview') el.appendChild(h('div', { class: 'gl-m' }, h('img', { src: it.src, alt: '' })));
        else if (isFile) { let prev = ''; if (exists && TXT.test(name)) { const c = PatOS.fs.read(it.path); if (typeof c === 'string' && !c.startsWith('data:')) prev = c.slice(0, 280); }
          el.append(h('div', { class: 'gl-doc' }, h('span', { class: 'gl-di', html: PatOS.fileIconHTML ? PatOS.fileIconHTML(name) : PatOS.sym('doc') }), prev ? h('p', {}, prev) : null)); }
        else if (it.kind === 'note') { const n = noteOf(it.noteId); el.append(h('div', { class: 'gl-doc note' }, h('b', {}, n ? n.title || T('New Note') : T('Not there anymore')), h('p', {}, n ? String(n.body || '').replace(/<[^>]*>/g, ' ').slice(0, 280) : ''))); }
        else if (it.kind === 'link') { let host = it.url; try { host = new URL(it.url).hostname; } catch (e) {} el.append(h('div', { class: 'gl-doc link' }, h('span', { class: 'gl-di', html: PatOS.sym('link') }), h('b', {}, host))); }
        else if (it.kind === 'label') el.append(h('div', { class: 'gl-doc note' }, h('b', {}, it.title), it.text ? h('p', {}, it.text) : null));
        el.appendChild(h('div', { class: 'gl-cap' }, h('b', {}, it.title || name || (it.kind === 'link' ? it.url : '')), isFile ? h('small', {}, exists ? it.path.replace(/\/[^/]*$/, '') || '/' : T('Not there anymore')) : null));
        el.onclick = () => { sel = it.id; main.querySelectorAll('.gl-card.on').forEach((c) => c.classList.remove('on')); el.classList.add('on'); drawRel(it); };
        el.ondblclick = () => openIt(it, i);
        el.onkeydown = (e) => { if (e.key === 'Enter') openIt(it, i); else if ((e.key === 'Delete' || e.key === 'Backspace') && !g.source) removeItem(it); };
        el.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('Open'), action: () => openIt(it, i) }, { label: T('Present from here'), action: () => present(i) }, isFile && exists ? { label: T('Show in Piles'), action: () => PatOS.launch('finder', { path: it.path.replace(/\/[^/]*$/, '') || '/' }) } : null, !g.source ? { divider: true } : null, !g.source ? { label: T('Take out of the gallery'), action: () => removeItem(it) } : null].filter(Boolean), e.clientX, e.clientY); };
        // reorder: drag a card onto another
        el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/gallery-item', it.id); if (isFile) e.dataTransfer.setData('text/patos-path', it.path); el.classList.add('dragging'); });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));
        el.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('text/gallery-item')) { e.preventDefault(); el.classList.add('over'); } });
        el.addEventListener('dragleave', () => el.classList.remove('over'));
        el.addEventListener('drop', (e) => { const from = e.dataTransfer.getData('text/gallery-item'); if (!from || from === it.id) return; e.preventDefault(); e.stopPropagation(); el.classList.remove('over'); mutate((gg) => { const a = gg.items.findIndex((x) => x.id === from), b2 = gg.items.findIndex((x) => x.id === it.id); if (a < 0 || b2 < 0) return; const [m] = gg.items.splice(a, 1); gg.items.splice(b2, 0, m); }); draw(); });
        return el;
      }
      const openIt = (it, i) => { if (it.kind === 'file' && PatOS.fs.exists(it.path)) { if (IMG.test(it.path) || VID.test(it.path)) present(i); else PatOS.openFile(it.path); } else if (it.kind === 'note') PatOS.launch('notes', { id: it.noteId }); else if (it.kind === 'link') PatOS.launch('browser', { url: it.url }); else if (it.kind === 'preview') present(i); };
      async function removeItem(it) { mutate((g) => { g.items = g.items.filter((x) => x.id !== it.id); }); if (sel === it.id) { sel = null; rel.classList.add('hidden'); } draw(); PatOS.notify({ title: T('Taken out of the gallery'), body: T('The file itself is still there.'), icon: 'gallery', priority: 'low', duration: 2500 }); }

      function draw() {
        drawSide(); main.innerHTML = ''; io.disconnect(); freeUrls(); layoutSeg.innerHTML = '';
        const g = cur();
        if (!g) { main.appendChild(PatOS.ui.empty({ icon: 'image', title: load().length ? 'Choose a gallery' : 'No galleries yet', text: 'A gallery is a collection you arrange and present: pictures, videos, documents, notes and links.', action: ['New Gallery', () => newGallery()] })); return; }
        win.setTitle(g.name + ' · ' + T('Gallery'));
        layoutSeg.appendChild(PatOS.ui.segmented([['grid', 'Grid'], ['masonry', 'Masonry'], ['wall', 'Photo wall'], ['free', 'Free'], ['list', 'List']], g.layout, (v) => { mutate((gg) => { gg.layout = v; }); draw(); }));
        const items = itemsOf(g);
        main.appendChild(h('div', { class: 'gl-head' }, h('h2', { ondblclick: () => renameG() }, g.name), h('small', {}, items.length + ' ' + T('things') + (g.source && g.source.collection ? ' · ' + T('follows a Data collection') : g.source && g.source.folder ? ' · ' + T('follows') + ' ' + g.source.folder : ''))));
        if (!items.length) { main.appendChild(PatOS.ui.empty({ icon: 'image', title: 'This gallery is empty', text: 'Drop files here, or add pictures, files, notes and links.', action: ['Add…', () => addMenu({ currentTarget: main })] })); return; }
        const box = h('div', { class: 'gl-' + g.layout });
        if (g.layout === 'free') { box.style.height = Math.max(600, ...items.map((it, i) => (it.y || Math.floor(i / 4) * 220) + (it.h || 200) + 40)) + 'px'; }
        items.slice(0, shown).forEach((it, i) => { const c = card(it, i, g); if (g.layout === 'free') freeCard(c, it, i, g); box.appendChild(c); });
        main.appendChild(box);
        if (items.length > shown) { const more = h('div', { class: 'gl-more' }, T('Loading more…')); main.appendChild(more); const mo = new IntersectionObserver((e) => { if (e[0].isIntersecting) { mo.disconnect(); shown += 120; draw(); } }, { root: main }); mo.observe(more); }
      }
      // the free layout: drag to place, corner to size (saved per item)
      function freeCard(c, it, i, g) {
        if (it.x == null || (!it.x && !it.y && i)) { it.x = (i % 4) * 260 + 20; it.y = Math.floor(i / 4) * 220 + 20; }
        Object.assign(c.style, { left: (it.x || 20) + 'px', top: (it.y || 20) + 'px', width: (it.w || 240) + 'px', height: (it.h || 200) + 'px' }); c.draggable = false; c.appendChild(h('i', { class: 'gl-rz' }));
        if (g.source) return;
        c.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return; const rz = e.target.classList.contains('gl-rz'); const sx = e.clientX, sy = e.clientY, o = { x: it.x || 0, y: it.y || 0, w: it.w || 240, h: it.h || 200 }; let moved = false;
          const mv = (ev) => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; if (rz) { it.w = Math.max(100, Math.round((o.w + dx) / 10) * 10); it.h = Math.max(80, Math.round((o.h + dy) / 10) * 10); c.style.width = it.w + 'px'; c.style.height = it.h + 'px'; } else { it.x = Math.max(0, Math.round((o.x + dx) / 10) * 10); it.y = Math.max(0, Math.round((o.y + dy) / 10) * 10); c.style.left = it.x + 'px'; c.style.top = it.y + 'px'; } };
          const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) mutate((gg) => { const t = gg.items.find((x) => x.id === it.id); if (t) Object.assign(t, { x: it.x, y: it.y, w: it.w, h: it.h }); }); };
          addEventListener('pointermove', mv); addEventListener('pointerup', up);
        });
      }
      function drawSide() {
        side.innerHTML = '';
        side.append(PatOS.ui.heading('Galleries'), ...load().map((g) => PatOS.ui.item({ icon: g.source && g.source.collection ? 'grid' : g.source && g.source.folder ? 'folder' : 'image', label: g.name, count: itemsOf(g).length, on: g.id === gid, onClick: () => { gid = g.id; sel = null; shown = 120; rel.classList.add('hidden'); draw(); } })),
          h('button', { class: 'btn gl-new', onclick: () => newGallery() }, '+ ' + T('New Gallery')));
      }
      // related things (PatOS Data)
      function drawRel(it) {
        if (!PatOS.data) return; const key = it.kind === 'file' ? 'file:' + it.path : it.kind === 'note' ? 'note:' + it.noteId : null; const r = key ? PatOS.data.related(key, 8) : [];
        rel.innerHTML = ''; rel.classList.toggle('hidden', !r.length); if (!r.length) return;
        rel.append(PatOS.ui.section('Related'), ...r.map((x) => h('button', { class: 'gl-ri', onclick: () => PatOS.data.openItem(x), title: x.why.join(' · ') }, h('b', {}, x.title), h('small', {}, x.why.join(' · ')))),
          cur() && !cur().source ? h('button', { class: 'btn', onclick: () => { const add = r.map((x) => { const [kind, ...rr] = x.key.split(':'); const id = rr.join(':'); return kind === 'file' ? { kind: 'file', path: id, title: x.title } : kind === 'note' ? { kind: 'note', noteId: id, title: x.title } : null; }).filter(Boolean); const n = G.add(gid, add); PatOS.notify({ title: n + ' ' + T('added'), body: cur().name, icon: 'gallery', priority: 'low' }); draw(); } }, T('Add these to the gallery')) : null);
      }
      // adding
      function addMenu(e) {
        const g = cur(); if (!g) return newGallery(); if (g.source) { PatOS.alertBox(T('This gallery follows its source'), T('Add to the collection or the folder it follows instead.'), { icon: 'gallery' }); return; }
        const r = e.currentTarget.getBoundingClientRect();
        PatOS.menu([{ label: T('Pictures and videos…'), action: () => pickFiles((p) => IMG.test(p) || VID.test(p)) }, { label: T('Files…'), action: () => pickFiles(() => true) },
          { label: T('Notes…'), action: () => pickNotes() }, { label: T('A link…'), action: async () => { const u = await PatOS.ask(T('A link'), 'https://', { icon: 'gallery', ok: T('Add') }); if (u && /^https?:\/\/\S+/.test(u)) { G.add(gid, [{ kind: 'link', url: u }]); draw(); } } },
          { label: T('From the computer…'), action: () => { const inp = h('input', { type: 'file', multiple: true }); inp.onchange = async () => { const saved = await PatOS.importFileList('/Pictures', [...inp.files]).catch(() => []); G.add(gid, (saved || []).filter((p) => typeof p === 'string').map((p) => ({ kind: 'file', path: p }))); draw(); }; inp.click(); } }], r.left, r.bottom + 4);
      }
      function pickFiles(ok) {
        const all = []; PatOS.fs.walk('/', (p, n) => { if (n.type === 'file' && !/(^|\/)\./.test(p) && !p.startsWith('/System') && ok(p) && all.length < 500) all.push(p); });
        const chosen = new Set(); const list = h('div', { class: 'gl-pick' }, ...all.sort().map((p) => { const b = h('label', { class: 'gl-pi' }, h('input', { type: 'checkbox', onchange: (e) => { if (e.target.checked) chosen.add(p); else chosen.delete(p); } }), h('span', {}, p)); return b; }));
        PatOS.ui.sheet(win, { title: T('Add files'), body: all.length ? list : h('p', {}, T('No files found.')), actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: () => { G.add(gid, [...chosen].map((p) => ({ kind: 'file', path: p }))); close(); draw(); } }, T('Add'))] });
      }
      function pickNotes() {
        const notes = PatOS.store.get('notes', []) || []; const chosen = new Set();
        PatOS.ui.sheet(win, { title: T('Add notes'), body: h('div', { class: 'gl-pick' }, ...notes.map((n) => h('label', { class: 'gl-pi' }, h('input', { type: 'checkbox', onchange: (e) => { if (e.target.checked) chosen.add(n.id); else chosen.delete(n.id); } }), h('span', {}, n.title || T('New Note'))))), actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: () => { G.add(gid, [...chosen].map((id) => ({ kind: 'note', noteId: id }))); close(); draw(); } }, T('Add'))] });
      }
      main.addEventListener('dragover', (e) => { if (!cur() || cur().source) return; if ([...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/patos-path')) { e.preventDefault(); main.classList.add('drop'); } });
      main.addEventListener('dragleave', () => main.classList.remove('drop'));
      main.addEventListener('drop', async (e) => { main.classList.remove('drop'); if (!cur() || cur().source || [...e.dataTransfer.types].includes('text/gallery-item')) return; e.preventDefault();
        const p = e.dataTransfer.getData('text/patos-path'); if (p && PatOS.fs.exists(p)) { G.add(gid, [{ kind: 'file', path: p }]); draw(); return; }
        const fl = [...(e.dataTransfer.files || [])].slice(0, 50); if (fl.length) { const saved = await PatOS.importFileList('/Pictures', fl).catch(() => []); G.add(gid, (saved || []).filter((x) => typeof x === 'string').map((x) => ({ kind: 'file', path: x }))); draw(); } });
      async function newGallery() {
        const body = h('div', { class: 'gl-newb' }); const name = h('input', { class: 'field', value: T('My gallery'), maxlength: '60' });
        const src = h('select', { class: 'field' }, h('option', { value: '' }, T('Empty (you add things)')), h('option', { value: 'pictures' }, T('My Pictures folder')), ...(PatOS.data ? PatOS.data.collections().map((c) => h('option', { value: 'col:' + c.id }, T('Data collection') + ' · ' + c.name)) : []));
        body.append(h('label', {}, h('span', {}, T('Name')), name), h('label', {}, h('span', {}, T('Start from')), src));
        PatOS.ui.sheet(win, { title: T('New Gallery'), body, actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: () => { const v = src.value; const source = v === 'pictures' ? { folder: '/Pictures' } : v.startsWith('col:') ? { collection: v.slice(4) } : null; gid = G.create(name.value.trim() || T('My gallery'), { source, layout: v === 'pictures' ? 'wall' : 'grid' }); close(); draw(); } }, T('Create'))] });
      }
      async function renameG() { const g = cur(); if (!g) return; const n = await PatOS.ask(T('Rename'), g.name, { icon: 'gallery', ok: T('Save') }); if (n) { mutate((gg) => { gg.name = n.slice(0, 60); }); draw(); } }
      function moreMenu(e) {
        const g = cur(); if (!g) return; const r = e.currentTarget.getBoundingClientRect();
        PatOS.menu([{ label: T('Rename…'), action: renameG }, { label: T('Export…'), action: () => exportG() }, { label: T('Import…'), action: () => importG() },
          PatOS.spaces && PatOS.spaces.ready() ? { label: T('Share to a Space…'), action: () => shareG() } : null,
          PatOS.world ? { label: T('Put on a World board'), action: () => { const id = PatOS.world.create(g.name); PatOS.world.addItems(id, itemsOf(g).slice(0, 100).map((it) => it.kind === 'file' ? { kind: 'file', path: it.path, w: 220, h: IMG.test(it.path) ? 180 : 90 } : it.kind === 'note' ? { kind: 'note', noteId: it.noteId } : it.kind === 'link' ? { kind: 'link', url: it.url } : null).filter(Boolean)); PatOS.launch('world', { id }); } } : null,
          { divider: true }, { label: T('Delete Gallery…'), action: async () => { if (await PatOS.confirmBox(T('Delete') + ' “' + g.name + '”?', T('Only the gallery goes. Its files stay where they are.'), { ok: T('Delete'), icon: 'gallery' })) { store(load().filter((x) => x.id !== g.id)); gid = null; draw(); } } }].filter(Boolean), r.left, r.bottom + 4);
      }
      // a shareable copy: titles, links and notes' text, and small previews of up to 12 pictures (so it fits in a Space)
      async function packed() {
        const g = cur(); const out = []; let pics = 0;
        for (const it of itemsOf(g).slice(0, 200)) {
          if (it.kind === 'file' && IMG.test(it.path) && pics < 12 && PatOS.fs.exists(it.path)) { const u = await urlFor(it.path); const src = u ? await thumb(u) : null; if (src) { out.push({ kind: 'preview', src, title: it.title || it.path.split('/').pop() }); pics++; continue; } }
          if (it.kind === 'link') out.push({ kind: 'link', url: it.url, title: it.title });
          else if (it.kind === 'preview') out.push({ kind: 'preview', src: it.src, title: it.title });
          else if (it.kind === 'label') out.push({ kind: 'label', title: it.title, text: it.text });
          else if (it.kind === 'note') { const n = noteOf(it.noteId); if (n) out.push({ kind: 'label', title: n.title || T('Note'), text: String(n.body || '').replace(/<[^>]*>/g, ' ').slice(0, 400) }); }
          else if (it.kind === 'file') out.push({ kind: 'label', title: it.path.split('/').pop(), text: '' }); // (the name only: never where it is on your PatOS)
        }
        return JSON.stringify({ schema: 'patos.gallery/1', name: g.name, layout: g.layout, items: out });
      }
      function thumb(u) { return new Promise((res) => { const img = new Image(); img.onload = () => { try { const s = Math.min(1, 320 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72)); } catch (e) { res(null); } }; img.onerror = () => res(null); img.src = u; }); }
      async function exportG() { const txt = await packed(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = cur().name.replace(/[\\/:*?"<>|]/g, '') + '.patgallery'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
      function fromText(txt) { let o; try { o = JSON.parse(txt); } catch (e) { throw new Error(T('This isn’t a PatOS gallery.')); } if (!o || o.schema !== 'patos.gallery/1' || !Array.isArray(o.items)) throw new Error(T('This isn’t a PatOS gallery.')); return G.create(String(o.name || T('Shared gallery')).slice(0, 60), { layout: ['grid', 'masonry', 'wall', 'free', 'list'].includes(o.layout) ? o.layout : 'grid', items: o.items.slice(0, 500) }); }
      function importG() { const inp = h('input', { type: 'file', accept: '.patgallery,.json' }); inp.onchange = async () => { try { gid = fromText(await inp.files[0].text()); draw(); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'gallery' }); } }; inp.click(); }
      async function shareG() {
        const sps = PatOS.spaces.list().filter((s) => PatOS.spaces.can(s, 'edit')); if (!sps.length) { PatOS.alertBox(T('No Space to share to'), T('Make a Shared Space first (or ask to be an editor in one).'), { icon: 'gallery' }); return; }
        PatOS.menu([{ header: T('Share to a Space') }, ...sps.map((s) => ({ label: s.name, action: async () => { try { const txt = await packed(); if (txt.length > 190000) throw new Error(T('This gallery is too big to share: make a smaller one.')); await PatOS.spaces.addFile(s, cur().name + '.patgallery', txt); PatOS.notify({ title: T('Shared to') + ' ' + s.name, body: cur().name, icon: 'gallery' }); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'gallery' }); } } }))], innerWidth / 2 - 120, 160);
      }
      // presenting: full screen, one at a time
      function present(start) {
        const g = cur(); if (!g) return; const items = itemsOf(g).filter((it) => it.kind !== 'file' || PatOS.fs.exists(it.path)); if (!items.length) return;
        let i = Math.max(0, Math.min(items.length - 1, start || 0)), auto = null;
        const stage = h('div', { class: 'gl-show', tabindex: '0', role: 'dialog', 'aria-label': T('Present') }); const view = h('div', { class: 'gl-sv' }); const cap = h('div', { class: 'gl-scap' });
        const close = () => { clearInterval(auto); stage.remove(); main.focus(); };
        const show = async () => { view.innerHTML = ''; const it = items[i]; cap.textContent = (i + 1) + ' / ' + items.length + ' · ' + (it.title || (it.path || '').split('/').pop() || it.url || '');
          if (it.kind === 'preview') view.appendChild(h('img', { src: it.src, alt: '' }));
          else if (it.kind === 'file' && (IMG.test(it.path) || VID.test(it.path))) { const u = await urlFor(it.path); if (u) view.appendChild(VID.test(it.path) ? h('video', { src: u, controls: true, autoplay: true }) : h('img', { src: u, alt: '' })); }
          else if (it.kind === 'note') { const n = noteOf(it.noteId); view.appendChild(h('div', { class: 'gl-sdoc' }, h('h1', {}, n ? n.title : ''), h('p', {}, n ? String(n.body || '').replace(/<[^>]*>/g, ' ') : ''))); }
          else view.appendChild(h('div', { class: 'gl-sdoc' }, h('h1', {}, it.title || (it.path || it.url || '').split('/').pop()), h('p', {}, it.text || it.url || it.path || ''))); };
        const go = (d) => { i = (i + d + items.length) % items.length; show(); };
        stage.append(view, cap, h('div', { class: 'gl-sbar' }, h('button', { class: 'btn', onclick: () => go(-1), 'aria-label': T('Previous') }, '‹'), h('button', { class: 'btn', onclick: (e) => { if (auto) { clearInterval(auto); auto = null; e.currentTarget.textContent = T('Slideshow'); } else { auto = setInterval(() => go(1), 4000); e.currentTarget.textContent = T('Stop'); } } }, T('Slideshow')), h('button', { class: 'btn', onclick: () => go(1), 'aria-label': T('Next') }, '›'), h('button', { class: 'btn', onclick: close }, T('Done'))));
        stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') close(); });
        document.body.appendChild(stage); stage.focus(); show();
        win._presenting = { go, close, get i() { return i; } };
      }
      win.on('closed', () => { io.disconnect(); freeUrls(); });
      PatOS.on('gallery', () => { if (!win.closed) drawSide(); });
      win._gallery = { open: (id) => { gid = id; draw(); }, present, importText: (t) => { gid = fromText(t); draw(); return gid; }, packed, get gid() { return gid; } };
      const first = load()[0]; gid = (args && args.collection && PatOS.data) ? (load().find((g) => g.source && g.source.collection === args.collection) || { id: G.create((PatOS.data.collection(args.collection) || {}).name || T('Collection'), { source: { collection: args.collection } }) }).id : first ? first.id : null;
      if (args && args.importPath) { try { gid = fromText(PatOS.fs.read(args.importPath)); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'gallery' }); } }
      draw();
    },
    onArgs(win, args) { if (!win._gallery) return; if (args.importPath) { try { win._gallery.importText(PatOS.fs.read(args.importPath)); } catch (e) {} } }
  });
})();
