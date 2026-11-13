/* PatOS Widgets (4.0): the desktop becomes a dashboard.

   A widget TYPE is registered once: PatOS.widgets.register({ id, name, icon, sizes, permissions, config, render(ctx) }).
   A widget INSTANCE is one of them placed on the desktop: { iid, type, size: 's'|'m'|'l', x, y, config, stack: [types] }.
   The desktop's widgets are saved per profile (js/profiles.js) under 'deskWidgets'.

   Three kinds:
   - built-in: made by PatOS (clock, calendar, today, reminders, music, system, weather, notes, countdown, launcher, photo,
     data collection, stack).
   - Studio widgets: made of blocks in PatOS Studio (text, clock, a live value, a button, a picture). They are data, never code:
     importing one can't run anything.
   - third-party widgets: a small web page with an SDK, installed from a .patwidget file. It runs in a sandboxed frame (a
     different, opaque origin): it can't read PatOS's storage, files, account or the page around it. It can only ask, through
     messages, for what you allowed at install (calendar, reminders, music, system, weather, notes) and to open an app.

   Every widget runs inside a process (js/process.js): what it starts (timers, listeners) is its own, measured, and stopped when
   the widget is removed. Widgets update through ctx.every(ms, fn) and ctx.on(event, fn), which are cleaned up for them. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const types = new Map();
  const SIZES = { s: [150, 150], m: [316, 150], l: [316, 316] };
  const PERMS = {
    calendar: ['Calendar', 'Your events'], reminders: ['Reminders', 'Your reminders, and checking them off'], music: ['Music', 'What plays, and play/pause/next'],
    system: ['System', 'Processor, memory, storage and battery'], weather: ['Weather', 'The weather for your saved place'], notes: ['Notes', 'Your recent notes'],
    data: ['Collections', 'The PatOS Data collections you choose'], photos: ['Pictures', 'Pictures in your Pictures folder']
  };
  const uid = () => 'w' + Math.random().toString(36).slice(2, 9);
  const esc = (s) => PatOS.esc(String(s == null ? '' : s));

  /* ---------- what widgets may read and do (the same calls for built-in and third-party widgets) ---------- */
  const API = {
    'calendar.today': () => { const d = new Date(); return (PatOS.calendarOn ? PatOS.calendarOn(d) : ((PatOS.store.get('calendar', {}) || {})[PatOS.dateKey(d)] || [])).map((e) => ({ title: e.title, time: e.time || '' })); },
    'calendar.next': () => { const now = new Date(), hm = now.toTimeString().slice(0, 5); for (let i = 0; i < 14; i++) { const d = new Date(); d.setDate(d.getDate() + i); const l = (PatOS.calendarOn ? PatOS.calendarOn(d) : ((PatOS.store.get('calendar', {}) || {})[PatOS.dateKey(d)] || [])).filter((e) => i > 0 || !e.time || e.time >= hm).sort((a, b) => (a.time || '').localeCompare(b.time || '')); if (l.length) return { title: l[0].title, time: l[0].time || '', day: PatOS.dateKey(d), inDays: i }; } return null; },
    'reminders.list': () => (PatOS.store.get('reminders', []) || []).filter((r) => !r.done).slice(0, 8).map((r) => ({ id: r.id, text: r.text, due: r.due || '', time: r.time || '' })),
    'reminders.done': (id) => { const l = PatOS.store.get('reminders', []) || []; const r = l.find((x) => x.id === id); if (!r) return false; r.done = true; PatOS.store.set('reminders', l); PatOS.emit('reminders'); return true; },
    'music.now': () => { const np = PatOS.music && PatOS.music.nowPlaying && PatOS.music.nowPlaying(); return np ? { title: np.title, artist: np.artist, playing: !!np.playing, color: np.color || '' } : null; },
    'music.toggle': () => { if (PatOS.music) PatOS.music.toggle(); else PatOS.launch('music'); return true; },
    'music.next': () => { if (PatOS.music) PatOS.music.next(); return true; },
    'system.stats': () => { const l = PatOS.proc ? PatOS.proc.list() : []; return { cpu: Math.round(l.reduce((a, p) => a + p.cpu, 0) * 10) / 10, processes: l.length, apps: l.filter((p) => !p.system).length, heap: performance.memory ? performance.memory.usedJSHeapSize : null, storage: PatOS.store.usage(), windows: PatOS.wm.windows.length, battery: battery ? { level: battery.level, charging: battery.charging } : null }; },
    'weather.now': () => weather.get(),
    'notes.recent': () => (PatOS.store.get('notes', []) || []).slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 5).map((n) => ({ id: n.id, title: n.title || String(n.body || '').split('\n')[0].slice(0, 60) })),
    'data.collection': (id) => (PatOS.data && PatOS.data.collection ? PatOS.data.collection(id) : null),
    'data.collections': () => (PatOS.data && PatOS.data.collections ? PatOS.data.collections().map((c) => ({ id: c.id, name: c.name, count: c.count })) : []),
    'photos.list': () => { const out = []; try { (PatOS.fs.list('/Pictures') || []).forEach((n) => { if (/\.(png|jpe?g|gif|webp)$/i.test(n)) out.push('/Pictures/' + n); }); } catch (e) {} return out.slice(0, 50); }
  };
  const NEEDS = { calendar: ['calendar.today', 'calendar.next'], reminders: ['reminders.list', 'reminders.done'], music: ['music.now', 'music.toggle', 'music.next'], system: ['system.stats'], weather: ['weather.now'], notes: ['notes.recent'], data: ['data.collection', 'data.collections'], photos: ['photos.list'] };
  const allowedCall = (perms, method) => Object.keys(NEEDS).some((p) => perms.includes(p) && NEEDS[p].includes(method));
  let battery = null; if (navigator.getBattery) navigator.getBattery().then((b) => { battery = b; }).catch(() => {});
  // the weather: one request for every widget, at most every 20 minutes (open-meteo, no key needed)
  const weather = { v: null, t: 0, p: null,
    get() { const pl = PatOS.store.get('weatherPlace', null) || { name: 'Montréal', lat: 45.5019, lon: -73.5674 }; if (Date.now() - this.t > 20 * 60000 && !this.p && navigator.onLine !== false) this.fetch(pl); return this.v; },
    fetch(pl) { this.p = fetch('https://api.open-meteo.com/v1/forecast?latitude=' + pl.lat + '&longitude=' + pl.lon + '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto')
      .then((r) => r.json()).then((j) => { this.v = { place: pl.name, temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, hi: Math.round(j.daily.temperature_2m_max[0]), lo: Math.round(j.daily.temperature_2m_min[0]) }; this.t = Date.now(); PatOS.emit('widgets:weather'); })
      .catch(() => { this.t = Date.now() - 15 * 60000; }).finally(() => { this.p = null; }); } };
  const wxWord = (c) => (c === 0 ? ['Clear', 'sunny'] : c <= 3 ? ['Partly cloudy', 'partly'] : c <= 48 ? ['Fog', 'fog'] : c <= 67 ? ['Rain', 'rain'] : c <= 77 ? ['Snow', 'snow'] : c <= 82 ? ['Showers', 'rain'] : ['Storm', 'storm']);

  /* ---------- the context a widget renders with: everything it starts is cleaned up when it goes ---------- */
  function makeCtx(inst, def, el, proc) {
    const offs = [], timers = [];
    const ctx = {
      el, size: inst.size, config: Object.assign({}, defaults(def), inst.config || {}), T,
      every(ms, fn) { const id = setInterval(() => { try { fn(); } catch (e) { console.error(e); } }, Math.max(1000, ms)); timers.push(id); return id; },
      on(ev, fn) { PatOS.on(ev, fn); offs.push([ev, fn]); },
      open(app, args) { if (PatOS.apps[app]) PatOS.launch(app, args || {}); },
      call(method, ...args) { if (!(def.source === 'builtin' || allowedCall(granted(def), method))) throw new Error('Not allowed: ' + method); return API[method] ? API[method](...args) : undefined; },
      refresh() { draw(inst, el); },
      _cleanup() { timers.forEach((id) => clearInterval(id)); offs.forEach(([ev, fn]) => PatOS.off(ev, fn)); timers.length = 0; offs.length = 0; }
    };
    return ctx;
  }
  const defaults = (def) => Object.fromEntries((def.config || []).map((c) => [c.key, c.def]));

  /* ---------- types ---------- */
  function register(def) {
    if (!def || !/^[a-z0-9:_-]{2,40}$/.test(def.id || '') || typeof def.render !== 'function') throw new Error('A widget needs an id and render()');
    types.set(def.id, Object.assign({ source: 'builtin', sizes: ['s', 'm'], permissions: [], config: [], icon: 'widget' }, def));
    PatOS.emit('widgets:types');
  }

  /* ---------- the desktop ---------- */
  const KEY = 'deskWidgets';
  const DEFAULT = () => [{ iid: uid(), type: 'clock', size: 's', x: 20, y: 44 }, { iid: uid(), type: 'calendar', size: 's', x: 186, y: 44 }, { iid: uid(), type: 'today', size: 'm', x: 20, y: 210 }, { iid: uid(), type: 'music', size: 'm', x: 20, y: 376 }];
  let layout = null, editing = false; const mounted = new Map(); // iid -> { el, ctx, proc }
  const load = () => { const l = PatOS.store.get(KEY, null); return Array.isArray(l) ? l.filter((i) => i && i.iid && i.type) : DEFAULT(); };
  const save = () => { PatOS.store.set(KEY, layout); PatOS.emit('widgets:layout'); };
  const host = () => { let w = document.getElementById('desk-widgets'); if (!w) { w = h('div', { id: 'desk-widgets' }); const d = document.getElementById('desktop'); d.insertBefore(w, document.getElementById('desktop-icons')); } return w; };
  function procFor(def) { return PatOS.proc ? PatOS.proc.forApp({ id: 'widget:' + def.id, name: def.name + ' ' + T('widget') }, { keep: true }) : null; }
  const inProc = (proc, fn) => (proc ? PatOS.proc.run(proc, fn) : fn());

  function unmount(iid) {
    const m = mounted.get(iid); if (!m) return;
    try { m.ctx._cleanup(); } catch (e) {}
    if (m.frame) m.frame.remove();
    m.el.remove(); mounted.delete(iid);
    // the type's process ends when its last instance goes
    if (m.proc && ![...mounted.values()].some((x) => x.proc === m.proc)) PatOS.proc.quit(m.proc.pid);
  }
  function draw(inst, el) {
    const m = mounted.get(inst.iid); const def = types.get(stackTop(inst)) || null;
    el.innerHTML = '';
    if (!def) { el.appendChild(h('div', { class: 'wg-missing' }, h('b', {}, T('Widget not installed')), h('small', {}, inst.type))); return; }
    if (disabledTypes().includes(def.id)) { el.appendChild(h('div', { class: 'wg-missing' }, h('b', {}, def.name), h('small', {}, T('Turned off in Settings')))); return; }
    if (m) { m.ctx._cleanup(); m.ctx.size = inst.size; m.ctx.config = Object.assign({}, defaults(def), inst.config || {}); }
    const ctx = m ? m.ctx : null;
    try { inProc(m && m.proc, () => { const out = def.render(ctx); if (out) el.appendChild(out); }); }
    catch (e) { console.error(e); el.innerHTML = ''; el.appendChild(h('div', { class: 'wg-missing' }, h('b', {}, def.name), h('small', {}, T('ran into a problem')))); }
    if (inst.stack && inst.stack.length > 1) el.appendChild(h('div', { class: 'wg-dots' }, ...inst.stack.map((t, i) => h('i', { class: i === (inst.si || 0) ? 'on' : '' }))));
  }
  const stackTop = (inst) => (inst.type === 'stack' && inst.stack && inst.stack.length ? inst.stack[(inst.si || 0) % inst.stack.length] : inst.type);
  function mount(inst) {
    const def = types.get(stackTop(inst));
    const [w, hh] = SIZES[inst.size] || SIZES.s;
    const el = h('div', { class: 'widget wg wg-' + inst.size + (def ? ' wg-t-' + def.id.replace(/[^a-z0-9-]/g, '-') : ''), 'data-iid': inst.iid, role: 'group', 'aria-label': def ? def.name : inst.type, tabindex: '-1' });
    Object.assign(el.style, { left: inst.x + 'px', top: inst.y + 'px', width: w + 'px', height: hh + 'px' });
    const proc = def ? procFor(def) : null;
    const rec = { el, proc, ctx: null }; mounted.set(inst.iid, rec);
    rec.ctx = def ? makeCtx(inst, def, el, proc) : { _cleanup() {} };
    host().appendChild(el); draw(inst, el); wire(inst, el);
    if (PatOS.glassLens) PatOS.glassLens.watch(el);
  }
  function renderDesk() {
    layout = layout || load();
    [...mounted.keys()].forEach(unmount);
    const w = host(); w.classList.toggle('editing', editing);
    w.querySelectorAll('.wg-editbar').forEach((x) => x.remove()); // (the Add Widget / Done bar goes with edit mode)
    if (!PatOS.settings.showWidgets && !editing) return;
    layout.forEach(mount);
    if (editing) w.appendChild(editBar());
  }

  /* moving (always: hold and drag; in edit mode right away), stacks (scroll to flip), edit mode */
  function wire(inst, el) {
    el.addEventListener('wheel', (e) => { if (inst.type !== 'stack' || !inst.stack || inst.stack.length < 2) return; e.preventDefault(); const n = inst.stack.length; inst.si = ((inst.si || 0) + (e.deltaY > 0 ? 1 : -1) + n) % n; const m = mounted.get(inst.iid); if (m) { unmount(inst.iid); mount(inst); } save(); }, { passive: false });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input, a, select, .wg-x, .wg-rz')) return;
      const sx = e.clientX, sy = e.clientY, ox = inst.x, oy = inst.y; let moved = false; const holdT = setTimeout(() => { moved = true; el.classList.add('wg-lift'); }, editing ? 0 : 350);
      const mv = (ev) => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) > 6) { if (!editing) { clearTimeout(holdT); cleanup(); return; } moved = true; el.classList.add('wg-lift'); } if (!moved) return; inst.x = Math.max(0, Math.round((ox + dx) / 8) * 8); inst.y = Math.max(32, Math.round((oy + dy) / 8) * 8); el.style.left = inst.x + 'px'; el.style.top = inst.y + 'px'; };
      const up = () => { clearTimeout(holdT); cleanup(); if (moved) { el.classList.remove('wg-lift'); save(); el.addEventListener('click', (ce) => { ce.stopPropagation(); ce.preventDefault(); }, { capture: true, once: true }); } };
      const cleanup = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation(); const def = types.get(stackTop(inst));
      PatOS.menu([{ header: def ? def.name : inst.type },
        ...(def ? def.sizes.map((s) => ({ label: T({ s: 'Small', m: 'Medium', l: 'Large' }[s]), checked: inst.size === s, action: () => resize(inst.iid, s) })) : []),
        def && def.config.length ? { label: T('Edit Widget…'), action: () => configure(inst.iid) } : null,
        { label: T('Edit Widgets…'), action: () => edit(true) },
        { divider: true }, { label: T('Remove Widget'), action: () => remove(inst.iid) }].filter(Boolean), e.clientX, e.clientY);
    });
    if (editing) {
      el.appendChild(h('button', { class: 'wg-x', 'aria-label': T('Remove Widget'), onclick: (e) => { e.stopPropagation(); remove(inst.iid); } }, '−'));
      const def = types.get(stackTop(inst));
      if (def && def.sizes.length > 1) el.appendChild(h('button', { class: 'wg-rz', 'aria-label': T('Change size'), title: T('Change size'), onclick: (e) => { e.stopPropagation(); const i = def.sizes.indexOf(inst.size); resize(inst.iid, def.sizes[(i + 1) % def.sizes.length]); } }, '⤡'));
    }
  }
  function editBar() {
    return h('div', { class: 'wg-editbar lg-elevated' }, h('button', { class: 'btn', onclick: () => gallery() }, '+ ' + T('Add Widget')), h('button', { class: 'btn primary', onclick: () => edit(false) }, T('Done')));
  }
  function edit(on) { editing = !!on; renderDesk(); }

  /* the gallery of widgets to add */
  function gallery() {
    const body = h('div', { class: 'wg-gal' });
    [...types.values()].filter((d) => !d.hidden && !disabledTypes().includes(d.id)).forEach((d) => body.appendChild(h('button', { class: 'wg-gi', onclick: () => { add(d.id); s.close(); } },
      h('span', { class: 'wg-gic', html: d.source === 'builtin' ? PatOS.sym(d.icon) || PatOS.iconHTML(d.icon) : PatOS.sym('sparkle') }), h('b', {}, d.name), h('small', {}, d.source === 'thirdparty' ? T('Installed') : d.source === 'studio' ? 'Studio' : T('Built in')))));
    body.appendChild(h('button', { class: 'wg-gi', onclick: () => { s.close(); installFromFile(); } }, h('span', { class: 'wg-gic', html: PatOS.sym('download') }), h('b', {}, T('Install from a file…')), h('small', {}, '.patwidget')));
    const s = PatOS.ui.sheet(null, { title: T('Add a widget'), body, actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Close'))] });
  }
  function freeSpot(size) { const [w, hh] = SIZES[size]; for (let y = 44; y < innerHeight - hh - 80; y += 166) for (let x = 20; x < innerWidth - w - 20; x += 166) { if (!layout.some((i) => { const [iw, ih] = SIZES[i.size] || SIZES.s; return x < i.x + iw && x + w > i.x && y < i.y + ih && y + hh > i.y; })) return { x, y }; } return { x: 40, y: 60 }; }
  function add(type, opts) {
    const def = types.get(type); if (!def) throw new Error('No such widget: ' + type);
    layout = layout || load(); const size = (opts && opts.size) || def.sizes[0]; const at = opts && opts.x != null ? { x: opts.x, y: opts.y } : freeSpot(size);
    const inst = { iid: uid(), type, size, x: at.x, y: at.y, config: (opts && opts.config) || {} }; if (type === 'stack') inst.stack = (opts && opts.stack) || ['calendar', 'weather', 'reminders'];
    layout.push(inst); save(); if (PatOS.settings.showWidgets === false) PatOS.setSetting('showWidgets', true); renderDesk(); return inst.iid;
  }
  function remove(iid) { layout = (layout || load()).filter((i) => i.iid !== iid); unmount(iid); save(); }
  function resize(iid, size) { const inst = (layout || load()).find((i) => i.iid === iid); if (!inst || !SIZES[size]) return; inst.size = size; save(); unmount(iid); mount(inst); }
  function configure(iid) {
    const inst = layout.find((i) => i.iid === iid); const def = inst && types.get(stackTop(inst)); if (!def) return;
    const vals = Object.assign({}, defaults(def), inst.config || {});
    const body = h('div', { class: 'wg-cfg' }, ...def.config.map((c) => {
      let input;
      if (c.type === 'select') { input = h('select', { class: 'field' }, ...c.options.map(([v, l]) => h('option', { value: v, selected: String(vals[c.key]) === String(v) }, T(l)))); input.onchange = () => { vals[c.key] = input.value; }; }
      else if (c.type === 'bool') { input = h('input', { type: 'checkbox', checked: !!vals[c.key] }); input.onchange = () => { vals[c.key] = input.checked; }; }
      else if (c.type === 'apps') { input = h('input', { class: 'field', value: (vals[c.key] || []).join(', '), placeholder: 'notes, music, calendar' }); input.oninput = () => { vals[c.key] = input.value.split(',').map((x) => x.trim()).filter((x) => PatOS.apps[x]).slice(0, 8); }; }
      else { input = h('input', { class: 'field', type: c.type === 'date' ? 'date' : 'text', value: vals[c.key] || '', maxlength: '60' }); input.oninput = () => { vals[c.key] = input.value; }; }
      return h('label', { class: 'wg-cfgr' }, h('span', {}, T(c.label)), input);
    }));
    PatOS.ui.sheet(null, { title: def.name, body, actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: () => { inst.config = vals; save(); unmount(iid); mount(inst); close(); } }, T('Save'))] });
  }

  /* ---------- third-party widgets: installed from a .patwidget file, run sandboxed ---------- */
  const INST = 'widgetsInstalled', GRANT = 'widgetGrants', OFF = 'widgetsOff';
  const granted = (def) => (PatOS.store.get(GRANT, {}) || {})[def.id] || [];
  const disabledTypes = () => PatOS.store.get(OFF, []) || [];
  // a manifest: { schema: 'patos.widget/1', id, name, version, permissions: [...], sizes: [...], html } (html: the widget's page)
  function validateManifest(m) {
    if (!m || typeof m !== 'object' || m.schema !== 'patos.widget/1') throw new Error(T('This isn’t a PatOS widget.'));
    if (!/^[a-z0-9-]{2,30}$/.test(m.id || '')) throw new Error(T('The widget has no valid id.'));
    if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 40) throw new Error(T('The widget has no valid name.'));
    if (typeof m.html !== 'string' || m.html.length > 200000) throw new Error(T('The widget’s page is missing or too big.'));
    const perms = (Array.isArray(m.permissions) ? m.permissions : []).filter((p) => PERMS[p]);
    const sizes = (Array.isArray(m.sizes) ? m.sizes : ['s']).filter((s) => SIZES[s]);
    return { schema: m.schema, id: 'x-' + m.id, name: m.name.trim().slice(0, 40), version: String(m.version || '1').slice(0, 12), permissions: perms, sizes: sizes.length ? sizes : ['s'], html: m.html };
  }
  function installManifest(raw, opts) {
    const m = validateManifest(raw);
    const all = PatOS.store.get(INST, {}) || {}; const old = all[m.id];
    const ask = () => new Promise((res) => {
      const body = h('div', {}, h('p', {}, old ? T('Update') + ' ' + m.name + ' (' + old.version + ' → ' + m.version + ')' : T('Install') + ' “' + m.name + '”?'),
        m.permissions.length ? h('div', { class: 'wg-perms' }, h('small', {}, T('It asks to read:')), ...m.permissions.map((p) => h('label', {}, h('input', { type: 'checkbox', checked: true, 'data-p': p }), ' ', T(PERMS[p][0]), h('small', {}, ' · ' + T(PERMS[p][1]))))) : h('p', { class: 'wg-fine' }, T('It asks for nothing: it can only show its own content.')),
        h('p', { class: 'wg-fine' }, T('It runs apart from PatOS: it can’t see your files, your account or other apps.')));
      const s = PatOS.ui.sheet(null, { title: T('Widget'), body, onClose: () => res(null), actions: (close) => [h('button', { class: 'btn', onclick: () => { close(); res(null); } }, T('Cancel')), h('button', { class: 'btn primary', onclick: () => { const g = [...body.querySelectorAll('input[data-p]')].filter((i) => i.checked).map((i) => i.dataset.p); close(); res(g); } }, T(old ? 'Update' : 'Install'))] });
      return s;
    });
    return (opts && opts.grant ? Promise.resolve(opts.grant) : ask()).then((g) => {
      if (!g) return null;
      all[m.id] = m; PatOS.store.set(INST, all);
      const gr = PatOS.store.get(GRANT, {}) || {}; gr[m.id] = g.filter((p) => m.permissions.includes(p)); PatOS.store.set(GRANT, gr);
      registerThirdParty(m); renderDesk(); return m.id;
    });
  }
  function uninstall(id) {
    const all = PatOS.store.get(INST, {}) || {}; if (!all[id]) return false; delete all[id]; PatOS.store.set(INST, all);
    const gr = PatOS.store.get(GRANT, {}) || {}; delete gr[id]; PatOS.store.set(GRANT, gr);
    types.delete(id); layout = (layout || load()).filter((i) => i.type !== id && !(i.stack || []).includes(id)); save(); renderDesk(); return true;
  }
  function installFromFile() {
    const inp = h('input', { type: 'file', accept: '.patwidget,.json,application/json' });
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { await installManifest(JSON.parse(await f.text())); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'settings' }); } };
    inp.click();
  }
  // the frame: opaque origin (sandbox without allow-same-origin), a strict content policy, and a tiny SDK that only sends messages
  const SDK = "<script>(function(){var n=0,w={};window.PatOS={call:function(m){var a=[].slice.call(arguments,1);return new Promise(function(res,rej){var id=++n;w[id]=[res,rej];parent.postMessage({pw:1,id:id,method:m,args:a},'*');});},open:function(app){parent.postMessage({pw:1,open:app},'*');}};addEventListener('message',function(e){var d=e.data;if(!d||!d.pw||!w[d.id])return;var c=w[d.id];delete w[d.id];d.error?c[1](new Error(d.error)):c[0](d.result);});})();<\/script>";
  function registerThirdParty(m) {
    register({ id: m.id, name: m.name, source: 'thirdparty', icon: 'sparkle', sizes: m.sizes, permissions: m.permissions, version: m.version,
      render(ctx) {
        const csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:\">";
        const f = h('iframe', { class: 'wg-frame', sandbox: 'allow-scripts', referrerpolicy: 'no-referrer', title: m.name, srcdoc: '<!doctype html><html><head><meta name="color-scheme" content="normal">' + csp + SDK + '<style>html,body{margin:0;height:100%;overflow:hidden;font:13px system-ui;color:#fff;background:transparent;color-scheme:normal}</style></head><body>' + m.html + '</body></html>' });
        const onMsg = (e) => {
          if (e.source !== f.contentWindow) return; const d = e.data; if (!d || !d.pw) return; // (only this widget's own frame)
          if (d.open) { if (PatOS.apps[d.open]) PatOS.launch(d.open); return; }
          let result, error; try { if (!allowedCall(granted({ id: m.id }), d.method) || !API[d.method]) throw new Error('not allowed'); result = JSON.parse(JSON.stringify(API[d.method](...(Array.isArray(d.args) ? d.args.slice(0, 3) : [])) ?? null)); } catch (er) { error = String(er.message || er); }
          f.contentWindow.postMessage({ pw: 1, id: d.id, result, error }, '*');
        };
        addEventListener('message', onMsg);
        const off = ctx._cleanup; ctx._cleanup = () => { removeEventListener('message', onMsg); off(); };
        return f;
      } });
  }
  Object.values(PatOS.store.get(INST, {}) || {}).forEach((m) => { try { registerThirdParty(m); } catch (e) {} });

  /* ---------- Studio widgets: blocks, never code ---------- */
  const BIND = {
    'clock.time': () => new Date().toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }),
    'clock.date': () => new Date().toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' }),
    'calendar.next': () => { const n = API['calendar.next'](); return n ? (n.inDays ? (n.inDays === 1 ? T('Tomorrow') : n.day) + ' · ' : '') + (n.time ? n.time + ' ' : '') + n.title : T('No events'); },
    'reminders.count': () => String(API['reminders.list']().length), 'system.cpu': () => API['system.stats']().cpu + '%', 'system.apps': () => String(API['system.stats']().apps),
    'battery.level': () => (battery ? Math.round(battery.level * 100) + '%' : '—'), 'weather.temp': () => { const w = weather.get(); return w ? w.temp + '°' : '—'; }, 'music.title': () => { const n = API['music.now'](); return n ? n.title : T('Not playing'); },
    'notes.count': () => String((PatOS.store.get('notes', []) || []).length)
  };
  function validateStudioWidget(d) {
    if (!d || d.schema !== 'patos.studiowidget/1') throw new Error('not a Studio widget');
    const id = /^[a-z0-9-]{2,30}$/.test(d.id || '') ? d.id : null; if (!id) throw new Error('bad id');
    const color = (c) => (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|linear-gradient\([#\w\s.,%()-]+\))$/i.test(String(c || '')) ? c : '');
    const blocks = (Array.isArray(d.blocks) ? d.blocks : []).slice(0, 8).map((b) => {
      if (!b || typeof b !== 'object') return null;
      if (b.type === 'text') return { type: 'text', text: String(b.text || '').slice(0, 120), size: Math.max(10, Math.min(48, +b.size || 15)), weight: b.weight === 'bold' ? 'bold' : 'normal', color: color(b.color) };
      if (b.type === 'value') return BIND[b.bind] ? { type: 'value', bind: b.bind, label: String(b.label || '').slice(0, 40), size: Math.max(10, Math.min(56, +b.size || 26)) } : null;
      if (b.type === 'button') { const a = String(b.action || ''); const ok = /^app:[a-z0-9_-]+$/.test(a) && PatOS.apps[a.slice(4)] || /^shortcut:.{1,40}$/.test(a); return ok ? { type: 'button', label: String(b.label || '').slice(0, 24), action: a } : null; }
      if (b.type === 'image') return /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(String(b.src || '')) && b.src.length < 300000 ? { type: 'image', src: b.src } : null;
      return null;
    }).filter(Boolean);
    return { schema: d.schema, id, name: String(d.name || 'My widget').slice(0, 40), bg: color(d.bg), size: SIZES[d.size] ? d.size : 's', blocks };
  }
  function registerStudio(d, opts) {
    const w = validateStudioWidget(d);
    if (!(opts && opts.noSave)) { const all = (PatOS.store.get('studioWidgets', []) || []).filter((x) => x && x.id !== w.id); all.push(w); PatOS.store.set('studioWidgets', all.slice(-60)); }
    register({ id: 'st-' + w.id, name: w.name, source: 'studio', icon: 'sparkle', sizes: ['s', 'm', 'l'], def: w,
      render(ctx) {
        const box = h('div', { class: 'wg-studio' }); if (w.bg) box.style.background = w.bg;
        const vals = [];
        w.blocks.forEach((b) => {
          if (b.type === 'text') box.appendChild(h('div', { class: 'wgs-text', style: { fontSize: b.size + 'px', fontWeight: b.weight, color: b.color || '' } }, b.text));
          else if (b.type === 'value') { const v = h('b', { style: { fontSize: b.size + 'px' } }); vals.push([v, b.bind]); box.appendChild(h('div', { class: 'wgs-val' }, b.label ? h('small', {}, b.label) : null, v)); }
          else if (b.type === 'button') box.appendChild(h('button', { class: 'wgs-btn', onclick: (e) => { e.stopPropagation(); if (b.action.startsWith('app:')) ctx.open(b.action.slice(4)); else if (PatOS.shortcuts) { const sc = PatOS.shortcuts.byName(b.action.slice(9)); if (sc) PatOS.shortcuts.run(sc, { from: 'widget' }); } } }, b.label));
          else if (b.type === 'image') box.appendChild(h('img', { class: 'wgs-img', src: b.src, alt: '' }));
        });
        const upd = () => vals.forEach(([el, k]) => { try { el.textContent = BIND[k](); } catch (e) { el.textContent = '—'; } });
        upd(); if (vals.length) ctx.every(15000, upd); ctx.on('widgets:weather', upd);
        return box;
      } });
    return 'st-' + w.id;
  }
  (PatOS.store.get('studioWidgets', []) || []).forEach((d) => { try { registerStudio(d, { noSave: true }); } catch (e) {} });

  /* ---------- the built-in widgets ---------- */
  const bi = (def) => register(Object.assign({ source: 'builtin' }, def));
  bi({ id: 'clock', name: 'Clock', icon: 'clock', sizes: ['s', 'm'], config: [{ key: 'style', type: 'select', label: 'Style', def: 'analog', options: [['analog', 'Analog'], ['digital', 'Digital']] }],
    render(ctx) {
      if (ctx.config.style === 'digital' || ctx.size === 'm') { const t = h('div', { class: 'wg-dig' }), d = h('small', {}); const u = () => { const n = new Date(); t.textContent = n.toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }); d.textContent = n.toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' }); }; u(); ctx.every(1000, u); ctx.el.onclick = () => ctx.open('clock'); return h('div', { class: 'wg-clockd' }, t, d); }
      const c = h('canvas', { width: 120, height: 120 }); const u = () => PatOS.drawAnalog && PatOS.drawAnalog(c, new Date()); u(); ctx.every(1000, u); ctx.el.onclick = () => ctx.open('clock'); return h('div', { class: 'w-clock-in' }, c);
    } });
  bi({ id: 'calendar', name: 'Calendar', icon: 'calendar', sizes: ['s'], render(ctx) {
    const d = new Date(), first = new Date(d.getFullYear(), d.getMonth(), 1).getDay(), days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const grid = h('div', { class: 'w-cal-g' }); ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((x) => grid.appendChild(h('span', { class: 'dn' }, x)));
    for (let i = 0; i < first; i++) grid.appendChild(h('span')); for (let i = 1; i <= days; i++) grid.appendChild(h('span', { class: i === d.getDate() ? 'today' : '' }, String(i)));
    ctx.el.onclick = () => ctx.open('calendar'); ctx.every(60 * 60000, () => ctx.refresh());
    return h('div', { class: 'w-cal' }, h('div', { class: 'w-cal-m' }, d.toLocaleDateString(PatOS.locale, { month: 'long' }).toUpperCase()), grid);
  } });
  bi({ id: 'today', name: 'Up Next', icon: 'calendar', sizes: ['s', 'm', 'l'], render(ctx) {
    const evs = ctx.call('calendar.today'), nx = ctx.call('calendar.next');
    ctx.on('calendar', () => ctx.refresh()); ctx.el.onclick = () => ctx.open('calendar');
    return h('div', { class: 'w-up' }, h('b', {}, T('Today')), evs.length ? evs.slice(0, ctx.size === 'l' ? 8 : 3).map((e) => h('div', { class: 'w-ev' }, (e.time ? e.time + ' · ' : '') + e.title)) : h('div', { class: 'w-muted' }, nx ? T('Next') + ': ' + nx.title + ' · ' + (nx.inDays === 1 ? T('Tomorrow') : nx.day) : T('No events today')));
  } });
  bi({ id: 'reminders', name: 'Reminders', icon: 'list', sizes: ['s', 'm', 'l'], permissions: ['reminders'], render(ctx) {
    const l = ctx.call('reminders.list'); ctx.on('reminders', () => ctx.refresh());
    return h('div', { class: 'w-up w-rem' }, h('b', { onclick: () => ctx.open('reminders') }, T('Reminders') + (l.length ? ' · ' + l.length : '')),
      l.length ? l.slice(0, ctx.size === 'l' ? 8 : 3).map((r) => h('button', { class: 'w-remi', title: T('Mark as done'), onclick: (e) => { e.stopPropagation(); ctx.call('reminders.done', r.id); } }, h('i', {}), h('span', {}, r.text))) : h('div', { class: 'w-muted' }, T('All done!')));
  } });
  bi({ id: 'music', name: 'Music', icon: 'music', sizes: ['s', 'm'], render(ctx) {
    const np = ctx.call('music.now'); ctx.on('music', () => ctx.refresh());
    return h('div', { class: 'w-music' }, h('div', { class: 'w-np-art', style: { background: np && np.color ? np.color : 'linear-gradient(135deg,#ff6482,#fa233b)' }, onclick: () => ctx.open('music') }, '♫'),
      h('div', { class: 'w-np-t' }, h('b', {}, np ? np.title : T('Not Playing')), h('small', {}, np ? np.artist : T('Music'))),
      h('div', { class: 'w-np-c' }, h('button', { 'aria-label': T(np && np.playing ? 'Pause' : 'Play'), html: PatOS.sym(np && np.playing ? 'pause' : 'play'), onclick: (e) => { e.stopPropagation(); ctx.call('music.toggle'); setTimeout(() => ctx.refresh(), 150); } }), np ? h('button', { 'aria-label': T('Next'), html: PatOS.sym('next'), onclick: (e) => { e.stopPropagation(); ctx.call('music.next'); } }) : null));
  } });
  bi({ id: 'system', name: 'System', icon: 'chart', sizes: ['s', 'm'], render(ctx) {
    const box = h('div', { class: 'w-sys' });
    const u = () => { const s = ctx.call('system.stats'); box.innerHTML = ''; [['CPU', s.cpu + '%'], ['Apps', s.apps], ['Storage', PatOS.fmtBytes(s.storage)], s.battery ? ['Battery', Math.round(s.battery.level * 100) + '%' + (s.battery.charging ? ' ⚡' : '')] : ['Windows', s.windows]].slice(0, ctx.size === 's' ? 3 : 4).forEach(([k, v]) => box.appendChild(h('div', {}, h('small', {}, T(k)), h('b', {}, String(v))))); };
    u(); ctx.every(2000, u); ctx.el.onclick = () => ctx.open('activity'); return box;
  } });
  bi({ id: 'weather', name: 'Weather', icon: 'partly', sizes: ['s', 'm'], render(ctx) {
    const w = ctx.call('weather.now'); ctx.on('widgets:weather', () => ctx.refresh()); ctx.every(20 * 60000, () => ctx.refresh()); ctx.el.onclick = () => ctx.open('weather');
    if (!w) return h('div', { class: 'w-wx' }, h('small', {}, T('Weather')), h('div', { class: 'w-muted' }, navigator.onLine === false ? T('Offline') : T('Loading…')));
    const [word, ic] = wxWord(w.code);
    return h('div', { class: 'w-wx' }, h('small', {}, w.place), h('div', { class: 'w-wx-t' }, w.temp + '°'), h('span', { class: 'w-wx-ic', html: PatOS.sym(ic) }), h('small', {}, T(word) + ' · H' + w.hi + '° L' + w.lo + '°'));
  } });
  bi({ id: 'notes', name: 'Notes', icon: 'note', sizes: ['s', 'm'], render(ctx) {
    const l = ctx.call('notes.recent'); ctx.on('notes', () => ctx.refresh());
    return h('div', { class: 'w-up' }, h('b', {}, T('Notes')), l.length ? l.slice(0, ctx.size === 'm' ? 3 : 2).map((n) => h('button', { class: 'w-ev w-link', onclick: (e) => { e.stopPropagation(); ctx.open('notes', { id: n.id }); } }, n.title || T('New Note'))) : h('div', { class: 'w-muted' }, T('No notes yet')));
  } });
  bi({ id: 'countdown', name: 'Countdown', icon: 'timer', sizes: ['s', 'm'], config: [{ key: 'title', type: 'text', label: 'Title', def: 'Summer' }, { key: 'date', type: 'date', label: 'Date', def: new Date().getFullYear() + '-06-21' }], render(ctx) {
    const d = new Date(ctx.config.date + 'T00:00'); const days = Math.ceil((d - new Date()) / 86400000);
    ctx.every(60 * 60000, () => ctx.refresh());
    return h('div', { class: 'w-cd' }, h('small', {}, ctx.config.title), h('b', {}, isNaN(days) ? '—' : String(Math.max(0, days))), h('small', {}, isNaN(days) ? T('Choose a date') : days === 1 ? T('day left') : T('days left')));
  } });
  bi({ id: 'launcher', name: 'Apps', icon: 'apps', sizes: ['s', 'm'], config: [{ key: 'apps', type: 'apps', label: 'Apps', def: ['notes', 'calendar', 'music', 'finder'] }], render(ctx) {
    return h('div', { class: 'w-launch' }, ...(ctx.config.apps || []).filter((a) => PatOS.apps[a]).slice(0, ctx.size === 's' ? 4 : 8).map((a) => h('button', { title: PatOS.apps[a].name, 'aria-label': PatOS.apps[a].name, html: PatOS.iconHTML(PatOS.apps[a].icon || a), onclick: (e) => { e.stopPropagation(); ctx.open(a); } })));
  } });
  bi({ id: 'photo', name: 'Photo', icon: 'image', sizes: ['s', 'm', 'l'], render(ctx) {
    const l = ctx.call('photos.list'); if (!l.length) return h('div', { class: 'w-up' }, h('b', {}, T('Photo')), h('div', { class: 'w-muted' }, T('Add pictures to your Pictures folder')));
    const img = h('img', { class: 'w-photo', alt: '' }); let i = Math.floor(Math.random() * l.length);
    const show = async () => { try { const u = PatOS.fs.read(l[i]); if (typeof u === 'string' && u.startsWith('data:')) img.src = u; else { const b = await PatOS.fs.getBlob(l[i]); if (b) { if (img._u) URL.revokeObjectURL(img._u); img._u = URL.createObjectURL(b); img.src = img._u; } } } catch (e) {} };
    show(); ctx.every(60000, () => { i = (i + 1) % l.length; show(); }); ctx.el.onclick = () => ctx.open('photos'); return img;
  } });
  bi({ id: 'collection', name: 'Collection', icon: 'grid', sizes: ['s', 'm', 'l'], permissions: ['data'], config: [{ key: 'id', type: 'text', label: 'Collection', def: '' }], render(ctx) {
    const c = ctx.config.id ? ctx.call('data.collection', ctx.config.id) : null; const all = ctx.call('data.collections');
    ctx.on('data', () => ctx.refresh());
    if (!c) return h('div', { class: 'w-up' }, h('b', {}, T('Collection')), h('div', { class: 'w-muted' }, all.length ? T('Right-click › Edit Widget to choose one') : T('Make collections in PatOS Data')));
    return h('div', { class: 'w-up' }, h('b', { onclick: () => ctx.open('data', { id: c.id }) }, c.name + ' · ' + c.items.length), ...c.items.slice(0, ctx.size === 'l' ? 8 : 3).map((it) => h('button', { class: 'w-ev w-link', onclick: (e) => { e.stopPropagation(); PatOS.data.openItem(it); } }, it.title)));
  } });
  bi({ id: 'stack', name: 'Smart Stack', icon: 'grid', sizes: ['s', 'm', 'l'], hidden: false, render() { return h('div', { class: 'w-muted' }, T('Empty stack')); } });

  /* ---------- public ---------- */
  PatOS.widgets = {
    register, types: () => [...types.values()].map((d) => ({ id: d.id, name: d.name, source: d.source, sizes: d.sizes, permissions: d.permissions, version: d.version || '' })),
    layout: () => (layout || load()).map((i) => Object.assign({}, i)), setLayout(l) { layout = (Array.isArray(l) ? l : []).filter((i) => i && i.iid && i.type).map((i) => Object.assign({}, i)); save(); renderDesk(); },
    add, remove, resize, configure, edit, editing: () => editing, renderDesk, gallery,
    install: installManifest, uninstall, installed: () => Object.values(PatOS.store.get(INST, {}) || {}).map((m) => ({ id: m.id, name: m.name, version: m.version, permissions: m.permissions, granted: granted(m) })),
    setGrant(id, perms) { const gr = PatOS.store.get(GRANT, {}) || {}; gr[id] = perms; PatOS.store.set(GRANT, gr); renderDesk(); },
    setEnabled(id, on) { let off = disabledTypes(); off = on ? off.filter((x) => x !== id) : [...new Set(off.concat(id))]; PatOS.store.set(OFF, off); renderDesk(); },
    registerStudio, validateStudioWidget, validateManifest, PERMS, SIZES, api: API, BINDINGS: Object.keys(BIND)
  };
  PatOS.renderDeskWidgets = renderDesk;
  PatOS.on('profile:switched', () => { layout = null; renderDesk(); });
})();
