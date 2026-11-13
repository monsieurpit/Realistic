/* Desktop configurations (4.0): one format for "how my PatOS looks and works", used by PatOS Studio (makes and edits them),
   PatOS Profiles (one per environment), PatOS World (shows them on its boards) and PatOS Commons (shares them).

   A configuration is data, never code:
     { schema: 'patos.desktop/1', name, look: { theme, accent, wallpaper, glassStyle, liquidGlass },
       dock: { apps: [appId], size, magnify, autohide },
       widgets: [ { type, size, x, y, config, stack } ],          (PatOS Widgets, js/widgets.js)
       studioWidgets: [ Studio widget definitions ],              (blocks; validated by PatOS.widgets)
       panels: [ { id, kind: 'launcher'|'dashboard', title, x, y, w, h, items: [action] } ],
       menus: [ { title, items: [ { label, action } ] } ],        (extra menus in the menu bar)
       shortcuts: [ { keys: 'Ctrl+Alt+1', action } ] }            (your own keyboard shortcuts)
   An action is one of: { kind: 'app', id } · { kind: 'shortcut', name } (runs a Shortcut) · { kind: 'url', url } (https only,
   opened in Patoogle) · { kind: 'file', path } · { kind: 'profile', id } · { kind: 'world', id } · { kind: 'widgets' } (edit).
   validate() keeps only what it knows, checks every value, drops what isn't safe or isn't there (an app that isn't installed)
   and says what it dropped. Importing a configuration can change how PatOS looks and what its buttons open: nothing else. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const SCHEMA = 'patos.desktop/1';
  const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
  const num = (v, lo, hi, d) => { const n = +v; return isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d; };
  const ACCENTS = /^(#[0-9a-f]{6}|blue|purple|pink|red|orange|yellow|green|graphite|multicolor)$/i;
  // keys PatOS keeps for itself (a configuration can't take them over)
  const RESERVED = ['Alt+W', 'Alt+Q', 'Alt+M', 'Alt+H', 'Alt+N', 'Alt+L', 'Alt+F', 'Alt+T', 'Alt+E', 'Alt+B', 'Alt+K', 'Alt+C', 'Alt+A', 'Alt+S', 'Alt+Space', 'Ctrl+Space', 'Alt+Escape', 'Ctrl+Alt+T', 'Ctrl+Alt+C', 'Ctrl+Alt+Enter', 'Ctrl+Alt+ArrowLeft', 'Ctrl+Alt+ArrowRight', 'Ctrl+Alt+ArrowUp', 'Ctrl+Alt+ArrowDown', 'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+A', 'Ctrl+S', 'Ctrl+F', 'Ctrl+W', 'Ctrl+T', 'Ctrl+R'];
  const keysOf = (e) => [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean).concat(e.key.length === 1 ? e.key.toUpperCase() : e.key).join('+');
  function normKeys(k) {
    const parts = String(k || '').split('+').map((x) => x.trim()).filter(Boolean); if (parts.length < 2) return null;
    const mods = ['Ctrl', 'Alt', 'Shift'].filter((m) => parts.some((p) => p.toLowerCase() === m.toLowerCase())); const key = parts.find((p) => !/^(ctrl|alt|shift)$/i.test(p));
    if (!mods.length || !key || !(mods.includes('Ctrl') || mods.includes('Alt')) || !/^([A-Za-z0-9]|F\d{1,2}|Arrow(Left|Right|Up|Down))$/.test(key)) return null;
    const out = mods.concat(key.length === 1 ? key.toUpperCase() : key).join('+'); return RESERVED.includes(out) ? null : out;
  }

  /* ---------- actions ---------- */
  function cleanAction(a, warn) {
    if (!a || typeof a !== 'object') return null;
    if (a.kind === 'app') { if (PatOS.apps[a.id]) return { kind: 'app', id: a.id }; warn && warn.push(T('App not installed') + ': ' + str(a.id, 40)); return null; }
    if (a.kind === 'shortcut') return a.name ? { kind: 'shortcut', name: str(a.name, 60) } : null;
    if (a.kind === 'url') return /^https:\/\/[^\s<>"']{3,500}$/i.test(String(a.url || '')) ? { kind: 'url', url: String(a.url) } : null;
    if (a.kind === 'file') return /^\/[^\u0000<>]{1,300}$/.test(String(a.path || '')) && !/^\/System(\/|$)/.test(a.path) ? { kind: 'file', path: String(a.path) } : null;
    if (a.kind === 'profile') return /^[a-z0-9-]{1,30}$/.test(a.id || '') ? { kind: 'profile', id: a.id } : null;
    if (a.kind === 'world') return /^[a-z0-9-]{1,30}$/.test(a.id || '') ? { kind: 'world', id: a.id } : null;
    if (a.kind === 'widgets') return { kind: 'widgets' };
    return null;
  }
  function runAction(a) {
    a = cleanAction(a); if (!a) return false;
    if (a.kind === 'app') PatOS.launch(a.id);
    else if (a.kind === 'shortcut') { const sc = PatOS.shortcuts && PatOS.shortcuts.byName(a.name); if (sc) PatOS.shortcuts.run(sc, { from: 'desktop' }); else PatOS.notify({ title: T('No shortcut has that name.'), body: a.name, icon: 'shortcuts' }); }
    else if (a.kind === 'url') PatOS.launch('browser', { url: a.url });
    else if (a.kind === 'file') { if (PatOS.fs.exists(a.path)) PatOS.openFile(a.path); else PatOS.notify({ title: T('That file isn’t there anymore'), body: a.path, icon: 'finder' }); }
    else if (a.kind === 'profile') { if (PatOS.profiles) PatOS.profiles.switchTo(a.id); }
    else if (a.kind === 'world') PatOS.launch('world', { id: a.id });
    else if (a.kind === 'widgets') PatOS.widgets && PatOS.widgets.edit(true);
    return true;
  }
  const actionLabel = (a) => (!a ? '' : a.kind === 'app' ? (PatOS.apps[a.id] ? PatOS.apps[a.id].name : a.id) : a.kind === 'shortcut' ? a.name : a.kind === 'url' ? a.url.replace(/^https:\/\//, '') : a.kind === 'file' ? a.path.split('/').pop() : a.kind === 'profile' ? T('Profile') + ' ' + a.id : a.kind === 'world' ? 'World ' + a.id : T('Edit Widgets…'));
  const actionIcon = (a) => (a && a.kind === 'app' && PatOS.apps[a.id] ? PatOS.iconHTML(PatOS.apps[a.id].icon || a.id) : PatOS.sym(a && a.kind === 'url' ? 'link' : a && a.kind === 'file' ? 'doc' : a && a.kind === 'shortcut' ? 'bolt' : 'grid'));

  /* ---------- validation: what a configuration may contain ---------- */
  function validate(cfg) {
    if (!cfg || typeof cfg !== 'object') throw new Error(T('This isn’t a desktop configuration.'));
    if (cfg.schema !== SCHEMA) { if (/^patos\.desktop\/\d+$/.test(cfg.schema || '')) throw new Error(T('This configuration was made by a newer PatOS.')); throw new Error(T('This isn’t a desktop configuration.')); }
    const warn = [], out = { schema: SCHEMA, name: str(cfg.name || T('My desktop'), 60) || T('My desktop') };
    const L = cfg.look || {};
    out.look = {};
    if (['light', 'dark', 'auto'].includes(L.theme)) out.look.theme = L.theme;
    if (ACCENTS.test(String(L.accent || ''))) out.look.accent = L.accent;
    if (L.wallpaper && PatOS.wallpaper && (PatOS.wallpaper.live[L.wallpaper] || PatOS.wallpaper.palettes[L.wallpaper])) out.look.wallpaper = L.wallpaper; else if (L.wallpaper) warn.push(T('Wallpaper not available') + ': ' + str(L.wallpaper, 40));
    if (['clear', 'tinted'].includes(L.glassStyle)) out.look.glassStyle = L.glassStyle;
    if (typeof L.liquidGlass === 'boolean') out.look.liquidGlass = L.liquidGlass;
    const D = cfg.dock || {};
    out.dock = { apps: (Array.isArray(D.apps) ? D.apps : []).filter((id) => { if (PatOS.apps[id]) return true; warn.push(T('App not installed') + ': ' + str(id, 40)); return false; }).slice(0, 30) };
    if (D.size != null) out.dock.size = num(D.size, 36, 84, 56); if (typeof D.magnify === 'boolean') out.dock.magnify = D.magnify; if (typeof D.autohide === 'boolean') out.dock.autohide = D.autohide;
    out.studioWidgets = [];
    (Array.isArray(cfg.studioWidgets) ? cfg.studioWidgets : []).slice(0, 20).forEach((d) => { try { out.studioWidgets.push(PatOS.widgets.validateStudioWidget(d)); } catch (e) { warn.push(T('A Studio widget was not valid')); } });
    const studioIds = new Set(out.studioWidgets.map((d) => 'st-' + d.id));
    const known = (t) => (PatOS.widgets && PatOS.widgets.types().some((x) => x.id === t)) || studioIds.has(t);
    out.widgets = (Array.isArray(cfg.widgets) ? cfg.widgets : []).slice(0, 40).map((w) => {
      if (!w || typeof w.type !== 'string') return null;
      if (!known(w.type)) { warn.push(T('Widget not installed') + ': ' + str(w.type, 40)); return null; }
      const o = { type: w.type, size: ['s', 'm', 'l'].includes(w.size) ? w.size : 's', x: num(w.x, 0, 4000, 20), y: num(w.y, 32, 3000, 44), config: {} };
      if (w.config && typeof w.config === 'object') Object.keys(w.config).slice(0, 10).forEach((k) => { if (!/^[a-z][a-zA-Z0-9]{0,20}$/.test(k)) return; const v = w.config[k]; if (typeof v === 'string') o.config[k] = str(v, 120); else if (typeof v === 'boolean' || typeof v === 'number') o.config[k] = v; else if (Array.isArray(v)) o.config[k] = v.filter((x) => typeof x === 'string').map((x) => str(x, 40)).slice(0, 12); });
      if (w.type === 'stack') o.stack = (Array.isArray(w.stack) ? w.stack : []).filter((t) => t !== 'stack' && known(t)).slice(0, 6);
      return o;
    }).filter(Boolean);
    out.panels = (Array.isArray(cfg.panels) ? cfg.panels : []).slice(0, 12).map((p, i) => {
      if (!p || !['launcher', 'dashboard'].includes(p.kind)) return null;
      return { id: /^[a-z0-9-]{1,20}$/.test(p.id || '') ? p.id : 'p' + i, kind: p.kind, title: str(p.title, 40), x: num(p.x, 0, 4000, 300), y: num(p.y, 32, 3000, 120), w: num(p.w, 140, 900, 300), h: num(p.h, 90, 900, 180), items: (Array.isArray(p.items) ? p.items : []).map((a) => cleanAction(a, warn)).filter(Boolean).slice(0, 24) };
    }).filter(Boolean);
    out.menus = (Array.isArray(cfg.menus) ? cfg.menus : []).slice(0, 3).map((m) => (m && m.title ? { title: str(m.title, 20), items: (Array.isArray(m.items) ? m.items : []).map((it) => { const a = cleanAction(it && it.action, warn); return a ? { label: str(it.label || actionLabel(a), 40), action: a } : null; }).filter(Boolean).slice(0, 20) } : null)).filter((m) => m && m.items.length);
    out.shortcuts = []; const used = new Set();
    (Array.isArray(cfg.shortcuts) ? cfg.shortcuts : []).slice(0, 30).forEach((s) => { const k = normKeys(s && s.keys); const a = cleanAction(s && s.action, warn); if (!k) { if (s && s.keys) warn.push(T('Shortcut not allowed') + ': ' + str(s.keys, 30)); return; } if (a && !used.has(k)) { used.add(k); out.shortcuts.push({ keys: k, action: a }); } });
    return { config: out, warnings: [...new Set(warn)] };
  }

  /* ---------- what the desktop is now, as a configuration ---------- */
  const PANELS = 'deskPanels', MENUS = 'deskMenus', KEYS = 'deskShortcuts';
  function capture(name) {
    const s = PatOS.settings;
    const used = new Set((PatOS.widgets ? PatOS.widgets.layout() : []).flatMap((w) => [w.type].concat(w.stack || [])));
    return {
      schema: SCHEMA, name: name || T('My desktop'),
      look: { theme: s.theme, accent: s.accent, wallpaper: s.wallpaper, glassStyle: s.glassStyle, liquidGlass: !!s.liquidGlass },
      dock: { apps: (s.dockPinned || []).slice(), size: s.dockSize, magnify: !!s.magnify, autohide: !!s.dockAutohide },
      widgets: (PatOS.widgets ? PatOS.widgets.layout() : []).map((w) => ({ type: w.type, size: w.size, x: w.x, y: w.y, config: w.config || {}, stack: w.stack })),
      studioWidgets: (PatOS.store.get('studioWidgets', []) || []).filter((d) => used.has('st-' + d.id)),
      panels: PatOS.store.get(PANELS, []) || [], menus: PatOS.store.get(MENUS, []) || [], shortcuts: PatOS.store.get(KEYS, []) || []
    };
  }
  /* applies a configuration (checked first). With { preview: true } it gives back a function that puts everything back. */
  function apply(raw, opts) {
    const { config: c, warnings } = validate(raw);
    const before = opts && opts.preview ? capture() : null;
    c.studioWidgets.forEach((d) => { try { PatOS.widgets.registerStudio(d); } catch (e) {} });
    const set = (k, v) => { if (v !== undefined && PatOS.settings[k] !== v) PatOS.setSetting(k, v); };
    set('theme', c.look.theme); set('accent', c.look.accent); set('wallpaper', c.look.wallpaper); set('glassStyle', c.look.glassStyle); set('liquidGlass', c.look.liquidGlass);
    if (c.dock.apps.length) set('dockPinned', c.dock.apps); set('dockSize', c.dock.size); set('magnify', c.dock.magnify); set('dockAutohide', c.dock.autohide);
    if (PatOS.widgets) PatOS.widgets.setLayout(c.widgets.map((w) => Object.assign({ iid: 'w' + Math.random().toString(36).slice(2, 9) }, w)));
    PatOS.store.set(PANELS, c.panels); PatOS.store.set(MENUS, c.menus); PatOS.store.set(KEYS, c.shortcuts);
    renderPanels(); renderMenus();
    PatOS.emit('desk:applied', c);
    return { warnings, revert: before ? () => apply(before) : null };
  }

  /* ---------- panels on the desktop: launchers and dashboards ---------- */
  function renderPanels() {
    let layer = document.getElementById('desk-panels');
    if (!layer) { const d = document.getElementById('desktop'); if (!d) return; layer = h('div', { id: 'desk-panels' }); d.insertBefore(layer, document.getElementById('desktop-icons')); }
    layer.innerHTML = '';
    (PatOS.store.get(PANELS, []) || []).forEach((p) => {
      const el = h('div', { class: 'dk-panel lg ' + p.kind, role: 'group', 'aria-label': p.title || T('Panel') }, p.title ? h('b', { class: 'dk-pt' }, p.title) : null,
        h('div', { class: 'dk-pi' }, ...p.items.map((a) => h('button', { class: 'dk-item', title: actionLabel(a), onclick: () => runAction(a) }, h('span', { class: 'dk-ic', html: actionIcon(a) }), h('small', {}, actionLabel(a))))));
      Object.assign(el.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', minHeight: p.h + 'px' });
      // hold and drag to move it (like widgets); right-click to remove it or edit it in Studio
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('.dk-item')) return;
        const sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y; let moved = false;
        const mv = (ev) => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 5) return; moved = true; el.classList.add('dk-lift'); p.x = Math.max(0, Math.round((ox + dx) / 8) * 8); p.y = Math.max(32, Math.round((oy + dy) / 8) * 8); el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; };
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); el.classList.remove('dk-lift'); if (moved) { const all = PatOS.store.get(PANELS, []) || []; const t = all.find((x) => x.id === p.id); if (t) { t.x = p.x; t.y = p.y; PatOS.store.set(PANELS, all); } } };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); PatOS.menu([{ header: p.title || T('Panel') }, { label: T('Edit in Studio'), action: () => PatOS.launch('deskstudio') }, { divider: true }, { label: T('Remove Panel'), action: () => { PatOS.store.set(PANELS, (PatOS.store.get(PANELS, []) || []).filter((x) => x.id !== p.id)); renderPanels(); } }], e.clientX, e.clientY); });
      layer.appendChild(el); if (PatOS.glassLens) PatOS.glassLens.watch(el);
    });
  }
  /* ---------- menus in the menu bar ---------- */
  function renderMenus() {
    const left = document.querySelector('#menubar .mb-left'); if (!left) return;
    left.querySelectorAll('[data-menu^="desk:"]').forEach((b) => b.remove());
    (PatOS.store.get(MENUS, []) || []).forEach((m, i) => left.appendChild(h('button', { class: 'mb-item mb-desk', 'data-menu': 'desk:' + i }, m.title)));
  }
  const menuItems = (key) => { const m = /^desk:(\d)$/.exec(key || ''); const menu = m && (PatOS.store.get(MENUS, []) || [])[+m[1]]; return menu ? menu.items.map((it) => ({ label: it.label, action: () => runAction(it.action) })) : null; };
  /* ---------- your keyboard shortcuts ---------- */
  document.addEventListener('keydown', (e) => {
    if (!PatOS.loggedIn || e.repeat || !(e.ctrlKey || e.altKey) || e.metaKey) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]') && !e.altKey) return;
    const k = keysOf(e); const s = (PatOS.store.get(KEYS, []) || []).find((x) => x.keys === k);
    if (s) { e.preventDefault(); e.stopPropagation(); runAction(s.action); }
  }, true);

  /* ---------- saved configurations, each with its earlier versions ---------- */
  const SAVED = 'deskConfigs';
  const all = () => (PatOS.store.get(SAVED, []) || []).filter((x) => x && x.id && x.config);
  function save(cfg, id) {
    const { config } = validate(cfg); const list = all(); let rec = id && list.find((x) => x.id === id);
    if (rec) { rec.versions = [{ t: rec.updated, config: rec.config }].concat(rec.versions || []).slice(0, 10); rec.config = config; rec.name = config.name; rec.updated = Date.now(); }
    else { rec = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: config.name, config, updated: Date.now(), versions: [] }; list.push(rec); }
    PatOS.store.set(SAVED, list.slice(-50)); PatOS.emit('desk:saved', rec.id); return rec.id;
  }
  function duplicate(id) { const r = all().find((x) => x.id === id); if (!r) return null; const c = JSON.parse(JSON.stringify(r.config)); c.name = r.name + ' ' + T('copy'); return save(c); }
  function restoreVersion(id, i) { const list = all(); const r = list.find((x) => x.id === id); if (!r || !r.versions[i]) return false; const v = r.versions[i]; r.versions.splice(i, 1); r.versions.unshift({ t: r.updated, config: r.config }); r.config = v.config; r.name = v.config.name; r.updated = Date.now(); PatOS.store.set(SAVED, list); PatOS.emit('desk:saved', id); return true; }
  function removeSaved(id) { PatOS.store.set(SAVED, all().filter((x) => x.id !== id)); PatOS.emit('desk:saved', id); }
  /* sharing: a .patdesk file (JSON). Reading one only checks it; nothing is applied until you choose to. */
  function exportText(cfg) { return JSON.stringify(validate(cfg).config, null, 1); }
  function importText(text) { let o; try { o = JSON.parse(String(text)); } catch (e) { throw new Error(T('This isn’t a desktop configuration.')); } return validate(o); }

  PatOS.desk = { SCHEMA, validate, capture, apply, save, list: all, get: (id) => all().find((x) => x.id === id) || null, duplicate, restoreVersion, remove: removeSaved, exportText, importText, runAction, cleanAction, actionLabel, actionIcon, normKeys, RESERVED, renderPanels, renderMenus, menuItems };
  PatOS.on('wm:ready', () => { renderPanels(); renderMenus(); });
  PatOS.on('profile:switched', () => { renderPanels(); renderMenus(); });
})();
