/* PatOS World (4.0): workspaces that aren't made of windows. An infinite canvas for each workspace, where you place and arrange
   sticky notes, files, links, notes, live widgets, app tiles, Data collections, zones and groups, and even real app windows.

   - Navigate: drag empty space (or scroll) to pan; Ctrl + scroll or pinch to zoom around the pointer; Fit shows everything.
   - Select: click; Shift + click adds; Shift + drag on empty space draws a selection box. Drag to move; pull a corner to resize;
     Delete removes (Ctrl+Z puts it back). Double-click empty space for a sticky note.
   - Zones: named areas. A zone can be linked to a folder: drop a file in it and World offers to move the file there, through
     Piles' file queue (it can be paused, undone, and nothing is half-moved), never by itself.
   - Groups: select several things and Group them; an app group opens all its apps at once and arranges them.
   - Windows: "Pin a window" puts an open app window on the board, with everything it has open; Unpin gives it back to the desktop.
   - Only what is near the screen is drawn (the rest waits), so a big board stays fast; widgets far away are stopped.
   Workspaces are saved (store 'worlds') and sync with your account like your other data; each remembers where you were. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.world = { bg: 'linear-gradient(160deg,#64d2ff,#30d158)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="12" width="20" height="16" rx="4" fill="#fff"/><rect x="34" y="10" width="22" height="12" rx="4" fill="#fff" opacity=".7"/><rect x="32" y="28" width="24" height="24" rx="5" fill="#fff" opacity=".85"/><rect x="10" y="34" width="16" height="18" rx="4" fill="#fff" opacity=".6"/><path d="M28 20h4M44 22v6M26 42h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>' };
  const KEY = 'worlds';
  const uid = () => Math.random().toString(36).slice(2, 10);
  const COLORS = ['#ffd60a', '#ff9f0a', '#ff6482', '#bf5af2', '#64d2ff', '#30d158', '#f2f2f7'];
  const MIN_Z = 0.1, MAX_Z = 3;
  const load = () => { const d = PatOS.store.get(KEY, null); return d && Array.isArray(d.list) ? d : { list: [], active: null }; };
  const newWorld = (name) => ({ id: 'w' + uid(), name: name || T('My world'), created: Date.now(), updated: Date.now(), view: { x: 0, y: 0, z: 1 }, items: [], zones: [] });

  /* ---------- the public side (Pat, Studio, Data and Profiles use it) ---------- */
  const W = {
    list: () => load().list.map((w) => ({ id: w.id, name: w.name, items: w.items.length, updated: w.updated })),
    get: (id) => load().list.find((w) => w.id === id) || null,
    create(name) { const d = load(); const w = newWorld(String(name || '').slice(0, 40) || T('My world')); d.list.push(w); d.active = w.id; PatOS.store.set(KEY, d); PatOS.emit('world'); return w.id; },
    /* adds things to a world without opening it (Pat: "put my biology files on a board") */
    addItems(id, items) {
      const d = load(); const w = d.list.find((x) => x.id === id); if (!w) return 0;
      let x = 40, y = 40 + Math.max(0, ...w.items.map((i) => i.y + i.h)), n = 0;
      (items || []).slice(0, 200).forEach((it) => { const c = cleanItem(Object.assign({ x, y }, it)); if (!c) return; w.items.push(c); n++; x += c.w + 20; if (x > 1400) { x = 40; y += 200; } });
      w.updated = Date.now(); PatOS.store.set(KEY, d); PatOS.emit('world'); return n;
    }
  };
  // what an item may be (also for items that come from outside: Pat, Data, an import)
  function cleanItem(it) {
    if (!it || typeof it !== 'object') return null;
    const kinds = ['sticky', 'file', 'link', 'note', 'widget', 'app', 'collection', 'window', 'image'];
    if (!kinds.includes(it.kind)) return null;
    const n = (v, d) => (isFinite(+v) ? Math.round(+v) : d);
    const base = { id: it.id && /^[a-z0-9]{4,12}$/.test(it.id) ? it.id : uid(), kind: it.kind, x: n(it.x, 0), y: n(it.y, 0), w: Math.max(60, Math.min(2000, n(it.w, 220))), h: Math.max(40, Math.min(2000, n(it.h, 140))), group: typeof it.group === 'string' ? it.group.slice(0, 12) : undefined };
    if (it.kind === 'sticky') return Object.assign(base, { text: String(it.text || '').slice(0, 4000), color: COLORS.includes(it.color) ? it.color : COLORS[0] });
    if (it.kind === 'file' || it.kind === 'image') return typeof it.path === 'string' && it.path[0] === '/' ? Object.assign(base, { path: it.path.slice(0, 400) }) : null;
    if (it.kind === 'link') return /^https?:\/\/\S{3,500}$/i.test(it.url || '') ? Object.assign(base, { url: it.url, title: String(it.title || '').slice(0, 120) }) : null;
    if (it.kind === 'note') return it.noteId ? Object.assign(base, { noteId: String(it.noteId).slice(0, 40) }) : null;
    if (it.kind === 'widget') return typeof it.type === 'string' ? Object.assign(base, { type: it.type.slice(0, 40), size: ['s', 'm', 'l'].includes(it.size) ? it.size : 's', config: it.config && typeof it.config === 'object' ? JSON.parse(JSON.stringify(it.config)) : {} }) : null;
    if (it.kind === 'app' || it.kind === 'window') return PatOS.apps[it.app] ? Object.assign(base, { kind: 'app', app: it.app, w: base.w || 120 }) : null;
    if (it.kind === 'collection') return it.collectionId ? Object.assign(base, { collectionId: String(it.collectionId).slice(0, 40) }) : null;
    return null;
  }
  PatOS.world = W;

  PatOS.registerApp({
    id: 'world', name: 'World', icon: 'world', width: 1200, height: 760, minWidth: 640, minHeight: 420, category: 'Productivity', keywords: 'world canvas board infinite whiteboard workspace spatial zones moodboard tableau espace',
    about: 'Infinite boards for your files, notes, widgets and apps.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'wd-win');
      let data = load(); if (!data.list.length) { data.list.push(newWorld(T('My world'))); data.active = data.list[0].id; }
      let world = data.list.find((w) => w.id === (args && args.id)) || data.list.find((w) => w.id === data.active) || data.list[0];
      let view = Object.assign({ x: 0, y: 0, z: 1 }, world.view), sel = new Set(), undo = [];
      const pinned = new Map(); // item id -> window
      const mountedW = new Map(); // item id -> unmount (live widgets)
      const save = PatOS.debounce(() => { world.view = view; world.updated = Date.now(); data.active = world.id; const d = load(); const i = d.list.findIndex((w) => w.id === world.id); if (i >= 0) d.list[i] = world; else d.list.push(world); d.active = world.id; PatOS.store.set(KEY, d); data = d; }, 400);
      const snap = () => { undo.push(JSON.stringify({ items: world.items, zones: world.zones })); if (undo.length > 40) undo.shift(); };

      // ---------- layout ----------
      const side = h('div', { class: 'wd-side' }), vp = h('div', { class: 'wd-vp', tabindex: '0', role: 'application', 'aria-label': T('Board') });
      const plane = h('div', { class: 'wd-plane' }), marquee = h('div', { class: 'wd-marq hidden' }), zoomL = h('span', { class: 'wd-zoom' });
      vp.append(plane, marquee);
      win.body.append(h('div', { class: 'wd-wrap' }, side, vp));
      const tb = (label, icon, fn, title) => h('button', { class: 'wd-tb', title: T(title || label), 'aria-label': T(title || label), onclick: fn }, icon ? h('span', { html: PatOS.sym(icon) }) : null, label ? h('span', {}, T(label)) : null);
      win.toolbar.append(
        tb('Note', 'sticky', () => addAtCenter({ kind: 'sticky', text: '', w: 200, h: 160 }), 'Sticky note'),
        tb('Link', 'link', async () => { const u = await PatOS.ask(T('A link'), 'https://', { icon: 'world', ok: T('Add') }); if (u && /^https?:\/\/\S+/.test(u)) addAtCenter({ kind: 'link', url: u, w: 240, h: 90 }); }),
        tb('File', 'doc', () => pickFile()),
        tb('Widget', 'grid', (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ header: T('Add a widget') }, ...PatOS.widgets.types().filter((t) => t.id !== 'stack').map((t) => ({ label: t.name, action: () => { const sz = t.sizes[0]; const [ww, hh] = PatOS.widgets.SIZES[sz]; addAtCenter({ kind: 'widget', type: t.id, size: sz, w: ww, h: hh }); } }))], r.left, r.bottom + 4); }),
        tb('App', 'apps', (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ header: T('Add an app') }, ...Object.values(PatOS.apps).filter((a) => !a.hidden && !a.action && a.id !== 'world').sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60).map((a) => ({ label: a.name, action: () => addAtCenter({ kind: 'app', app: a.id, w: 120, h: 120 }) }))], r.left, r.bottom + 4); }),
        PatOS.data ? tb('Collection', 'grid', (e) => { const r = e.currentTarget.getBoundingClientRect(); const cs = PatOS.data.collections(); PatOS.menu(cs.length ? [{ header: T('Add a collection') }, ...cs.map((c) => ({ label: c.name, action: () => addAtCenter({ kind: 'collection', collectionId: c.id, w: 280, h: 220 }) }))] : [{ header: T('No collections yet') }, { label: T('Open PatOS Data'), action: () => PatOS.launch('data') }], r.left, r.bottom + 4); }) : null,
        tb('Zone', 'window', () => addZone()),
        tb('Window', 'window', (e) => pinMenu(e), 'Pin a window'),
        h('div', { style: { flex: 1 } }),
        tb('', 'search', () => fit(), 'Fit everything'), zoomL);

      // ---------- view ----------
      const applyView = () => { plane.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.z + ')'; zoomL.textContent = Math.round(view.z * 100) + '%'; vp.style.backgroundPosition = view.x + 'px ' + view.y + 'px'; vp.style.backgroundSize = 28 * view.z + 'px ' + 28 * view.z + 'px'; schedule(); save(); };
      const toWorld = (cx, cy) => { const r = vp.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z }; };
      function zoomAt(cx, cy, z) { const r = vp.getBoundingClientRect(); const p = toWorld(cx, cy); view.z = Math.max(MIN_Z, Math.min(MAX_Z, z)); view.x = cx - r.left - p.x * view.z; view.y = cy - r.top - p.y * view.z; applyView(); }
      function fit() { const all = world.items.concat(world.zones); if (!all.length) { view = { x: 40, y: 40, z: 1 }; applyView(); return; } const x0 = Math.min(...all.map((i) => i.x)), y0 = Math.min(...all.map((i) => i.y)), x1 = Math.max(...all.map((i) => i.x + i.w)), y1 = Math.max(...all.map((i) => i.y + i.h)); const r = vp.getBoundingClientRect(); const z = Math.max(MIN_Z, Math.min(1.2, Math.min((r.width - 80) / (x1 - x0), (r.height - 80) / (y1 - y0)))); view = { z, x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - (y1 - y0) * z) / 2 - y0 * z }; applyView(); }

      // ---------- drawing: only what is near the screen ----------
      let raf = 0; const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
      const els = new Map(); // id -> element
      function visibleRect() { const r = vp.getBoundingClientRect(); const m = 300 / view.z; return { x0: -view.x / view.z - m, y0: -view.y / view.z - m, x1: (r.width - view.x) / view.z + m, y1: (r.height - view.y) / view.z + m }; }
      const inView = (o, v) => o.x < v.x1 && o.x + o.w > v.x0 && o.y < v.y1 && o.y + o.h > v.y0;
      function render() {
        const v = visibleRect(), keep = new Set();
        world.zones.forEach((z) => { if (!inView(z, v)) return; keep.add(z.id); let el = els.get(z.id); if (!el) { el = zoneEl(z); els.set(z.id, el); plane.insertBefore(el, plane.firstChild); } place(el, z); el.classList.toggle('sel', sel.has(z.id)); });
        world.items.forEach((it) => { if (!inView(it, v) && !pinned.has(it.id)) return; keep.add(it.id); let el = els.get(it.id); if (!el) { el = itemEl(it); els.set(it.id, el); plane.appendChild(el); } place(el, it); el.classList.toggle('sel', sel.has(it.id)); });
        els.forEach((el, id) => { if (!keep.has(id)) { el.remove(); els.delete(id); const um = mountedW.get(id); if (um) { um(); mountedW.delete(id); } } });
        plane.classList.toggle('far', view.z < 0.35); // (far away: simpler drawing)
        win.setTitle(world.name + ' · ' + T('World'));
      }
      const place = (el, o) => { el.style.transform = 'translate(' + o.x + 'px,' + o.y + 'px)'; el.style.width = o.w + 'px'; el.style.height = o.h + 'px'; };
      function redraw(id) { const el = els.get(id); if (el) { el.remove(); els.delete(id); const um = mountedW.get(id); if (um) { um(); mountedW.delete(id); } } schedule(); }
      function zoneEl(z) {
        const el = h('div', { class: 'wd-zone', 'data-id': z.id, style: { '--zc': z.color || '#64d2ff' } }, h('div', { class: 'wd-zt' }, h('b', {}, z.name), z.folder ? h('small', {}, '→ ' + z.folder) : null), h('i', { class: 'wd-rz' }));
        el.querySelector('.wd-zt').ondblclick = async (e) => { e.stopPropagation(); const n = await PatOS.ask(T('Zone name'), z.name, { icon: 'world', ok: T('Save') }); if (n) { snap(); z.name = n.slice(0, 40); redraw(z.id); save(); } };
        el.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); PatOS.menu([{ header: z.name }, { label: T('Link to a folder…'), action: async () => { const p = await PatOS.ask(T('A folder'), z.folder || '/Documents', { icon: 'world', ok: T('Link') }); if (p && PatOS.fs.isDir(p)) { snap(); z.folder = p; redraw(z.id); save(); } else if (p) PatOS.alertBox(T('That didn’t work'), T('There’s no folder there.'), { icon: 'world' }); } }, z.folder ? { label: T('Unlink the folder'), action: () => { z.folder = null; redraw(z.id); save(); } } : null, { label: T('Color'), action: () => { z.color = COLORS[(COLORS.indexOf(z.color) + 1) % COLORS.length]; redraw(z.id); save(); } }, { divider: true }, { label: T('Remove Zone'), action: () => removeIds([z.id]) }].filter(Boolean), e.clientX, e.clientY); };
        return el;
      }
      function itemEl(it) {
        const el = h('div', { class: 'wd-item wd-' + it.kind + (it.group ? ' grouped' : ''), 'data-id': it.id, tabindex: '-1' });
        const body = h('div', { class: 'wd-ib' }); el.append(body, h('i', { class: 'wd-rz' }));
        if (it.kind === 'sticky') { el.style.setProperty('--sc', it.color); const ta = h('textarea', { class: 'wd-st', placeholder: T('Write something…'), 'aria-label': T('Sticky note') }); ta.value = it.text || ''; /* (a textarea's text is its value, not an attribute) */ ta.oninput = () => { it.text = ta.value; save(); }; ta.onpointerdown = (e) => { if (!sel.has(it.id)) return; e.stopPropagation(); }; body.appendChild(ta); }
        else if (it.kind === 'file' || it.kind === 'image') {
          const ok = PatOS.fs.exists(it.path), name = it.path.split('/').pop(), isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
          if (isImg && ok) { const img = h('img', { class: 'wd-img', alt: name, draggable: 'false' }); body.appendChild(img); (async () => { try { const u = PatOS.fs.read(it.path); if (typeof u === 'string' && u.startsWith('data:')) img.src = u; else { const bl = await PatOS.fs.getBlob(it.path); if (bl) { img.src = URL.createObjectURL(bl); img.onload = () => setTimeout(() => URL.revokeObjectURL(img.src), 2000); } } } catch (e) {} })(); }
          else body.append(h('span', { class: 'wd-fi', html: PatOS.fileIconHTML ? PatOS.fileIconHTML(name) : PatOS.sym('doc') }), h('b', {}, name), h('small', {}, ok ? it.path.replace(/\/[^/]*$/, '') || '/' : T('Not there anymore')));
          el.ondblclick = () => { if (PatOS.fs.exists(it.path)) PatOS.openFile(it.path); };
        } else if (it.kind === 'link') { let host = it.url; try { host = new URL(it.url).hostname; } catch (e) {} body.append(h('span', { class: 'wd-fi', html: PatOS.sym('link') }), h('b', {}, it.title || host), h('small', {}, it.url)); el.ondblclick = () => PatOS.launch('browser', { url: it.url }); }
        else if (it.kind === 'note') { const n = (PatOS.store.get('notes', []) || []).find((x) => x.id === it.noteId); body.append(h('b', {}, n ? n.title || T('New Note') : T('Not there anymore')), h('p', { class: 'wd-np' }, n ? String(n.body || '').replace(/<[^>]*>/g, ' ').slice(0, 400) : '')); el.ondblclick = () => PatOS.launch('notes', { id: it.noteId }); }
        else if (it.kind === 'app') { const a = PatOS.apps[it.app]; body.append(h('span', { class: 'wd-ai', html: PatOS.iconHTML(a.icon || a.id) }), h('small', {}, a.name)); el.ondblclick = () => openApps([it]); }
        else if (it.kind === 'widget') { el.classList.add('wd-wg'); requestAnimationFrame(() => { if (el.isConnected && !mountedW.has(it.id)) mountedW.set(it.id, PatOS.widgets.mountInto(body, { type: it.type, size: it.size, config: it.config })); }); }
        else if (it.kind === 'collection') { const c = PatOS.data && PatOS.data.collection(it.collectionId); body.append(h('b', {}, c ? c.name : T('Not there anymore')), ...(c ? c.items.slice(0, 8).map((x) => h('button', { class: 'wd-ci', onclick: (e) => { e.stopPropagation(); PatOS.data.openItem(x); } }, x.title)) : [])); el.ondblclick = () => PatOS.launch('data', { id: it.collectionId }); }
        el.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); if (!sel.has(it.id)) { sel = new Set([it.id]); schedule(); } itemMenu(e.clientX, e.clientY); };
        return el;
      }
      function itemMenu(x, y) {
        const ids = [...sel], items = world.items.filter((i) => ids.includes(i.id)), one = items.length === 1 ? items[0] : null;
        PatOS.menu([
          one && one.kind === 'sticky' ? { label: T('Color'), action: () => { one.color = COLORS[(COLORS.indexOf(one.color) + 1) % COLORS.length]; redraw(one.id); save(); } } : null,
          items.length > 1 ? { label: T('Group'), action: () => { snap(); const g = uid(); items.forEach((i) => { i.group = g; redraw(i.id); }); save(); } } : null,
          items.some((i) => i.group) ? { label: T('Ungroup'), action: () => { snap(); items.forEach((i) => { i.group = undefined; redraw(i.id); }); save(); } } : null,
          items.some((i) => i.kind === 'app') ? { label: T('Open these apps'), action: () => openApps(items.filter((i) => i.kind === 'app')) } : null,
          pinned.size && items.some((i) => pinned.has(i.id)) ? { label: T('Unpin the window'), action: () => items.forEach((i) => unpin(i.id)) } : null,
          { divider: true }, { label: T('Delete'), shortcut: 'Del', action: () => removeIds(ids) }].filter(Boolean), x, y);
      }

      // ---------- adding ----------
      function centerPoint() { const r = vp.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); }
      function addAtCenter(it) { const c = centerPoint(); return addItem(Object.assign({}, it, { x: Math.round(c.x - (it.w || 200) / 2 + (Math.random() * 40 - 20)), y: Math.round(c.y - (it.h || 140) / 2 + (Math.random() * 40 - 20)) })); }
      function addItem(it) { const c = cleanItem(it); if (!c) return null; snap(); world.items.push(c); sel = new Set([c.id]); save(); schedule(); if (c.kind === 'sticky') setTimeout(() => { const ta = els.get(c.id) && els.get(c.id).querySelector('textarea'); ta && ta.focus(); }, 60); return c.id; }
      async function addZone() { const n = await PatOS.ask(T('Zone name'), T('Ideas'), { icon: 'world', ok: T('Add') }); if (!n) return; const c = centerPoint(); snap(); const z = { id: uid(), name: n.slice(0, 40), x: Math.round(c.x - 300), y: Math.round(c.y - 200), w: 600, h: 400, color: COLORS[world.zones.length % COLORS.length], folder: null }; world.zones.push(z); save(); schedule(); }
      function pickFile() {
        const files = []; PatOS.fs.walk('/', (p, n) => { if (n.type === 'file' && !/(^|\/)\./.test(p) && !p.startsWith('/System') && files.length < 300) files.push(p); });
        PatOS.menu([{ header: T('Add a file') }, ...files.sort().slice(0, 60).map((p) => ({ label: p, action: () => addAtCenter({ kind: 'file', path: p, w: 220, h: /\.(png|jpe?g|gif|webp)$/i.test(p) ? 180 : 90 }) }))], innerWidth / 2 - 160, 140);
      }
      function removeIds(ids) { snap(); ids.forEach((id) => { unpin(id); const um = mountedW.get(id); if (um) { um(); mountedW.delete(id); } }); world.items = world.items.filter((i) => !ids.includes(i.id)); world.zones = world.zones.filter((z) => !ids.includes(z.id)); sel = new Set(); ids.forEach((id) => { const el = els.get(id); if (el) { el.remove(); els.delete(id); } }); save(); schedule(); }
      // an app group: opens its apps and arranges them side by side
      function openApps(items) { const ws = items.map((i) => PatOS.launch(i.app)).filter((w) => w && w.el); if (ws.length > 1 && PatOS.wmPro) setTimeout(() => PatOS.wmPro.tileAll(), 150); }

      // ---------- pinned windows: a real app window, on the board ----------
      function pinMenu(e) {
        const r = e.currentTarget.getBoundingClientRect(); const ws = PatOS.wm.windows.filter((w) => w !== win && !w.minimized && ![...pinned.values()].includes(w));
        PatOS.menu(ws.length ? [{ header: T('Pin a window') }, ...ws.map((w) => ({ label: w.title, action: () => pin(w) }))] : [{ header: T('No windows to pin') }], r.left, r.bottom + 4);
      }
      function pin(w) {
        const c = centerPoint(); const rr = w.rect(); const id = addItem({ kind: 'app', app: w.app.id, x: Math.round(c.x - rr.w / 2), y: Math.round(c.y - rr.h / 2), w: rr.w, h: rr.h }); if (!id) return;
        const it = world.items.find((i) => i.id === id); it.pinned = true; pinned.set(id, w); w._worldHome = rr;
        schedule(); requestAnimationFrame(() => { const el = els.get(id); if (!el) return; el.classList.add('wd-pin'); const b = el.querySelector('.wd-ib'); b.innerHTML = ''; b.appendChild(w.el); Object.assign(w.el.style, { left: '0px', top: '0px', width: '100%', height: '100%', transform: '', zIndex: '' }); w.el.classList.add('in-world'); });
        w.on('closed', () => { if (pinned.get(id) === w) { pinned.delete(id); const i = world.items.find((x) => x.id === id); if (i) { i.pinned = false; redraw(id); } } });
      }
      function unpin(id) {
        const w = pinned.get(id); if (!w) return; pinned.delete(id); w.el.classList.remove('in-world');
        const layer = document.getElementById('windows'); layer.appendChild(w.el); const r = w._worldHome || { x: 80, y: 80, w: 700, h: 480 }; Object.assign(w.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        const it = world.items.find((i) => i.id === id); if (it) { it.pinned = false; redraw(id); } PatOS.wm.focus(w);
      }

      // ---------- pointer: pan, select, move, resize ----------
      vp.addEventListener('wheel', (e) => { e.preventDefault(); if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, view.z * Math.exp(-e.deltaY * 0.0022)); else { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); } }, { passive: false });
      vp.addEventListener('dblclick', (e) => { if (e.target !== vp && e.target !== plane) return; const p = toWorld(e.clientX, e.clientY); addItem({ kind: 'sticky', text: '', x: Math.round(p.x - 100), y: Math.round(p.y - 80), w: 200, h: 160 }); });
      vp.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.button !== 1) return;
        if (e.target.closest('.in-world')) return; // (a pinned window handles its own clicks)
        vp.focus({ preventScroll: true });
        const node = e.target.closest('.wd-item, .wd-zone'); const resize = e.target.classList.contains('wd-rz');
        const sx = e.clientX, sy = e.clientY;
        if (!node || e.button === 1) {
          if (e.shiftKey && e.button === 0) { // a selection box
            const p0 = toWorld(sx, sy); marquee.classList.remove('hidden');
            const mv = (ev) => { const p1 = toWorld(ev.clientX, ev.clientY); const r = { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y), w: Math.abs(p1.x - p0.x), h: Math.abs(p1.y - p0.y) }; const vr = vp.getBoundingClientRect(); Object.assign(marquee.style, { left: Math.min(sx, ev.clientX) - vr.left + 'px', top: Math.min(sy, ev.clientY) - vr.top + 'px', width: Math.abs(ev.clientX - sx) + 'px', height: Math.abs(ev.clientY - sy) + 'px' }); sel = new Set(world.items.filter((i) => i.x < r.x + r.w && i.x + i.w > r.x && i.y < r.y + r.h && i.y + i.h > r.y).map((i) => i.id)); schedule(); };
            const up = () => { marquee.classList.add('hidden'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
            addEventListener('pointermove', mv); addEventListener('pointerup', up); return;
          }
          sel = new Set(); schedule(); const ox = view.x, oy = view.y; vp.classList.add('panning');
          const mv = (ev) => { view.x = ox + ev.clientX - sx; view.y = oy + ev.clientY - sy; applyView(); };
          const up = () => { vp.classList.remove('panning'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
          addEventListener('pointermove', mv); addEventListener('pointerup', up); return;
        }
        if (e.target.closest('textarea') && sel.has(node.dataset.id)) return;
        const id = node.dataset.id; const isZone = node.classList.contains('wd-zone');
        if (e.shiftKey) { if (sel.has(id)) sel.delete(id); else sel.add(id); } else if (!sel.has(id)) sel = new Set([id]);
        // a group moves together
        const groupIds = new Set(); world.items.filter((i) => sel.has(i.id) && i.group).forEach((i) => world.items.forEach((j) => { if (j.group === i.group) groupIds.add(j.id); })); groupIds.forEach((g) => sel.add(g));
        schedule();
        const objs = world.items.filter((i) => sel.has(i.id)).concat(world.zones.filter((z) => sel.has(z.id)));
        // moving a zone takes what is inside it along
        if (isZone && !resize) { const z = world.zones.find((x) => x.id === id); world.items.forEach((i) => { if (i.x >= z.x && i.y >= z.y && i.x + i.w <= z.x + z.w && i.y + i.h <= z.y + z.h && !objs.includes(i)) objs.push(i); }); }
        const start = objs.map((o) => ({ o, x: o.x, y: o.y, w: o.w, h: o.h })); let moved = false;
        const mv = (ev) => { const dx = (ev.clientX - sx) / view.z, dy = (ev.clientY - sy) / view.z; if (!moved && Math.hypot(dx, dy) * view.z < 3) return; if (!moved) { moved = true; snap(); }
          if (resize) { const s0 = start.find((s) => s.o.id === id); s0.o.w = Math.max(60, Math.round(s0.w + dx)); s0.o.h = Math.max(40, Math.round(s0.h + dy)); const el = els.get(id); if (el) place(el, s0.o); }
          else start.forEach((s) => { s.o.x = Math.round(s.x + dx); s.o.y = Math.round(s.y + dy); const el = els.get(s.o.id); if (el) place(el, s.o); }); };
        const up = (ev) => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) { save(); if (!resize && !isZone) dropOnZone(start.map((s) => s.o), ev); if (resize) { const it = world.items.find((i) => i.id === id); if (it && it.kind === 'widget') { const sz = it.w > 300 ? (it.h > 300 ? 'l' : 'm') : 's'; if (sz !== it.size) { it.size = sz; redraw(id); } } } schedule(); } };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
      // a file dropped into a zone linked to a folder: offer to move it there (Piles' file queue)
      async function dropOnZone(objs, ev) {
        const files = objs.filter((o) => (o.kind === 'file' || o.kind === 'image') && PatOS.fs.exists(o.path)); if (!files.length) return;
        const z = world.zones.find((zz) => zz.folder && files.every((f) => f.x + f.w / 2 > zz.x && f.x + f.w / 2 < zz.x + zz.w && f.y + f.h / 2 > zz.y && f.y + f.h / 2 < zz.y + zz.h)); if (!z) return;
        const todo = files.filter((f) => f.path.replace(/\/[^/]*$/, '') !== z.folder); if (!todo.length) return;
        if (!(await PatOS.confirmBox(T('Move') + ' ' + (todo.length === 1 ? '“' + todo[0].path.split('/').pop() + '”' : todo.length + ' ' + T('files')) + ' ' + T('to') + ' ' + z.folder + '?', T('The file moves in Piles too. You can undo it there.'), { ok: T('Move'), icon: 'world' }))) return;
        const settle = () => { todo.forEach((f) => { const np = z.folder.replace(/\/$/, '') + '/' + f.path.split('/').pop(); if (!PatOS.fs.exists(f.path) && PatOS.fs.exists(np)) { f.path = np; redraw(f.id); } }); save(); };
        const jid = PatOS.fileOps.enqueue('move', todo.map((f) => f.path), z.folder); if (!jid) return;
        const onJob = (j) => { if (j && j.id === jid) { PatOS.off('fileops', onJob); settle(); } }; PatOS.on('fileops', onJob); setTimeout(settle, 1500);
      }
      // keyboard
      vp.addEventListener('keydown', (e) => {
        if (e.target.closest('textarea, input')) return;
        if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size) { e.preventDefault(); removeIds([...sel]); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); const u = undo.pop(); if (u) { const o = JSON.parse(u); world.items = o.items; world.zones = o.zones; els.forEach((el) => el.remove()); els.clear(); mountedW.forEach((um) => um()); mountedW.clear(); sel = new Set(); save(); schedule(); } }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); sel = new Set(world.items.map((i) => i.id)); schedule(); }
        else if (e.key === '+' || e.key === '=') { const r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view.z * 1.2); }
        else if (e.key === '-') { const r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view.z / 1.2); }
        else if (e.key === '0') fit();
        else if (sel.size && /^Arrow/.test(e.key)) { e.preventDefault(); const d = e.shiftKey ? 40 : 8; const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0; world.items.concat(world.zones).forEach((o) => { if (sel.has(o.id)) { o.x += dx; o.y += dy; } }); save(); schedule(); }
      });
      // drops: files from Piles or the desktop, files from the computer, links and text
      vp.addEventListener('dragover', (e) => { e.preventDefault(); vp.classList.add('drop'); });
      vp.addEventListener('dragleave', () => vp.classList.remove('drop'));
      vp.addEventListener('drop', async (e) => {
        e.preventDefault(); vp.classList.remove('drop'); const p = toWorld(e.clientX, e.clientY);
        const path = e.dataTransfer.getData('text/patos-path'); const txt = e.dataTransfer.getData('text/plain'); const fl = [...(e.dataTransfer.files || [])].slice(0, 20);
        if (path && path[0] === '/' && PatOS.fs.exists(path)) { addItem({ kind: 'file', path, x: Math.round(p.x - 110), y: Math.round(p.y - 45), w: 220, h: /\.(png|jpe?g|gif|webp)$/i.test(path) ? 180 : 90 }); return; }
        if (fl.length && PatOS.importFileList) { const saved = await PatOS.importFileList('/Downloads', fl).catch(() => []); (saved || []).forEach((sp, i) => { if (typeof sp === 'string') addItem({ kind: 'file', path: sp, x: Math.round(p.x + i * 30), y: Math.round(p.y + i * 30), w: 220, h: /\.(png|jpe?g|gif|webp)$/i.test(sp) ? 180 : 90 }); }); return; }
        if (/^https?:\/\/\S+$/i.test((txt || '').trim())) { addItem({ kind: 'link', url: txt.trim(), x: Math.round(p.x - 120), y: Math.round(p.y - 45), w: 240, h: 90 }); return; }
        if (txt) addItem({ kind: 'sticky', text: txt.slice(0, 4000), x: Math.round(p.x - 100), y: Math.round(p.y - 80), w: 200, h: 160 });
      });

      // ---------- the workspaces list ----------
      function drawSide() {
        side.innerHTML = ''; const d = load(); if (!d.list.some((w) => w.id === world.id)) d.list.push(world);
        side.append(PatOS.ui.heading('Worlds'), ...d.list.map((w) => h('button', { class: 'ui-si' + (w.id === world.id ? ' on' : ''), onclick: () => openWorld(w.id), oncontextmenu: (e) => { e.preventDefault(); worldMenu(w, e.clientX, e.clientY); } }, h('span', {}, w.name), h('small', {}, String(w.items.length)))),
          h('button', { class: 'btn wd-new', onclick: async () => { const n = await PatOS.ask(T('New world'), T('Project'), { icon: 'world', ok: T('Create') }); if (n) openWorld(W.create(n)); } }, '+ ' + T('New world')));
      }
      function worldMenu(w, x, y) {
        PatOS.menu([{ header: w.name }, { label: T('Rename…'), action: async () => { const n = await PatOS.ask(T('Rename'), w.name, { icon: 'world', ok: T('Save') }); if (!n) return; const d = load(); const t = d.list.find((x2) => x2.id === w.id); if (t) { t.name = n.slice(0, 40); PatOS.store.set(KEY, d); } if (w.id === world.id) world.name = n.slice(0, 40); drawSide(); render(); } },
          { label: T('Delete…'), disabled: load().list.length < 2, action: async () => { if (!(await PatOS.confirmBox(T('Delete') + ' “' + w.name + '”?', T('The board goes. The files, notes and apps on it stay where they are.'), { ok: T('Delete'), icon: 'world' }))) return; const d = load(); d.list = d.list.filter((x2) => x2.id !== w.id); if (d.active === w.id) d.active = d.list[0].id; PatOS.store.set(KEY, d); if (w.id === world.id) openWorld(d.active); else drawSide(); } }], x, y);
      }
      function openWorld(id) {
        save(); [...pinned.keys()].forEach(unpin); mountedW.forEach((um) => um()); mountedW.clear(); els.forEach((el) => el.remove()); els.clear();
        const d = load(); world = d.list.find((w) => w.id === id) || d.list[0]; view = Object.assign({ x: 0, y: 0, z: 1 }, world.view); sel = new Set(); undo = []; d.active = world.id; PatOS.store.set(KEY, d); drawSide(); applyView();
      }
      win.on('closed', () => { [...pinned.keys()].forEach(unpin); mountedW.forEach((um) => um()); mountedW.clear(); cancelAnimationFrame(raf); });
      win.on('resize', () => schedule());
      PatOS.on('world', () => { const d = load(); const fresh = d.list.find((w) => w.id === world.id); if (fresh && fresh.updated > world.updated) { world = fresh; els.forEach((el) => el.remove()); els.clear(); schedule(); } drawSide(); });
      win._world = { get world() { return world; }, get view() { return view; }, addItem, addZone: (z) => { const zz = Object.assign({ id: uid(), name: 'Zone', x: 0, y: 0, w: 600, h: 400, color: COLORS[4], folder: null }, z); world.zones.push(zz); save(); schedule(); return zz.id; }, pin, unpin, removeIds, select: (ids) => { sel = new Set(ids); schedule(); }, fit, zoomAt, open: openWorld, rendered: () => els.size, openApps, dropOnZone };
      drawSide(); applyView(); if (!world.items.length) { view = { x: 60, y: 60, z: 1 }; applyView(); }
    },
    onArgs(win, args) { if (args && args.id && win._world) win._world.open(args.id); }
  });
})();
