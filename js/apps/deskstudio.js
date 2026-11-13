/* PatOS Studio (4.0): make your own desktop, visually.
   What it edits is a desktop configuration (js/desk.js): the look, the Dock, widgets (PatOS Widgets), panels (launchers and
   dashboards), extra menus and keyboard shortcuts. The stage is your screen, scaled: drag things to move them, pull a corner to
   resize, click to see their settings on the right. Preview tries it on your real desktop (Keep or Revert); Save keeps it
   with its earlier versions; Apply puts it on a profile (PatOS Profiles). The widget maker builds Studio widgets from blocks
   (text, a live value, a button, a picture): data only, so a shared one can never run code. Export and import .patdesk files. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.deskstudio = { bg: 'linear-gradient(160deg,#bf5af2,#5e5ce6)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="14" width="44" height="30" rx="5" fill="#fff" opacity=".45"/><rect x="15" y="19" width="14" height="10" rx="2.5" fill="#fff"/><rect x="32" y="19" width="17" height="20" rx="2.5" fill="#fff" opacity=".85"/><rect x="15" y="32" width="14" height="7" rx="2" fill="#fff" opacity=".85"/><rect x="20" y="48" width="24" height="4" rx="2" fill="#fff"/></svg>' };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  PatOS.registerApp({
    id: 'deskstudio', name: 'PatOS Studio', icon: 'deskstudio', width: 1180, height: 720, minWidth: 820, minHeight: 520, category: 'Utilities', keywords: 'studio customize desktop editor layout widgets dock panels menus shortcuts theme configuration personnaliser bureau',
    about: 'Make your own desktop: widgets, Dock, panels, menus and shortcuts.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'sd-win');
      let cfg = clone(PatOS.desk.capture(T('This desktop'))), savedId = null, sel = null, dirty = false, preview = null;
      const W = PatOS.widgets, D = PatOS.desk;
      const SIZES = W.SIZES;

      // ---------- toolbar ----------
      const addW = h('button', { class: 'btn', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ header: T('Add a widget') }, ...W.types().filter((t) => t.id !== 'stack').map((t) => ({ label: t.name, action: () => addWidget(t.id) })), { divider: true }, { label: T('Smart Stack'), action: () => addWidget('stack') }], r.left, r.bottom + 4); } }, '+ ' + T('Widget'));
      const addP = h('button', { class: 'btn', onclick: () => addPanel('launcher') }, '+ ' + T('Panel'));
      const bPrev = h('button', { class: 'btn', onclick: () => togglePreview() }, T('Preview'));
      const bSave = h('button', { class: 'btn primary', onclick: () => doSave() }, T('Save'));
      const bApply = h('button', { class: 'btn', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ header: T('Apply to a profile') }, ...PatOS.profiles.list().map((p) => ({ label: p.name + (p.active ? ' (' + T('now') + ')' : ''), action: () => { PatOS.profiles.setConfig(p.id, cfg); PatOS.notify({ title: T('Applied to') + ' ' + p.name, body: cfg.name, icon: 'deskstudio', priority: 'low' }); } }))], r.left, r.bottom + 4); } }, T('Apply…'));
      const title = h('input', { class: 'field sd-name', value: cfg.name, maxlength: '60', 'aria-label': T('Name') }); title.oninput = () => { cfg.name = title.value; touch(); };
      win.toolbar.append(title, addW, addP, h('div', { style: { flex: 1 } }), bPrev, bApply, bSave);

      // ---------- the three columns ----------
      const side = h('div', { class: 'sd-side' }), stageWrap = h('div', { class: 'sd-stagew' }), insp = h('div', { class: 'sd-insp' });
      win.body.append(h('div', { class: 'sd-wrap' }, side, stageWrap, insp));
      const stage = h('div', { class: 'sd-stage', role: 'application', 'aria-label': T('Your desktop, scaled') });
      stageWrap.appendChild(stage);
      const banner = h('div', { class: 'sd-banner hidden' }, h('span', {}, T('Previewing on your desktop')), h('button', { class: 'btn', onclick: () => togglePreview(false) }, T('Revert')), h('button', { class: 'btn primary', onclick: () => { preview = null; banner.classList.add('hidden'); bPrev.textContent = T('Preview'); } }, T('Keep')));
      stageWrap.appendChild(banner);

      function touch() { dirty = true; bSave.disabled = false; }
      const scale = () => Math.max(0.2, Math.min((stageWrap.clientWidth - 40) / innerWidth, (stageWrap.clientHeight - 40) / innerHeight));

      // ---------- left: configurations ----------
      function drawSide() {
        side.innerHTML = '';
        const item = (label, sub, on, fn, menu) => h('button', { class: 'ui-si sd-cfg' + (on ? ' on' : ''), onclick: fn, oncontextmenu: menu ? (e) => { e.preventDefault(); menu(e); } : null }, h('span', {}, label), sub ? h('small', {}, sub) : null);
        side.append(PatOS.ui.heading('Configurations'), item(T('This desktop'), T('What you see now'), !savedId, () => load(null)));
        D.list().slice().sort((a, b) => b.updated - a.updated).forEach((c) => side.appendChild(item(c.name, new Date(c.updated).toLocaleDateString(PatOS.locale) + (c.versions.length ? ' · ' + c.versions.length + ' ' + T('versions') : ''), savedId === c.id, () => load(c.id), (e) => cfgMenu(c, e.clientX, e.clientY))));
        side.append(h('div', { class: 'sd-sidebtns' },
          h('button', { class: 'btn', onclick: () => { savedId = null; cfg = clone(PatOS.desk.capture(T('New desktop'))); cfg.widgets = []; cfg.panels = []; cfg.menus = []; cfg.shortcuts = []; title.value = cfg.name; touch(); draw(); } }, T('New')),
          h('button', { class: 'btn', onclick: () => importFile() }, T('Import…')),
          h('button', { class: 'btn', onclick: () => exportFile() }, T('Export…'))));
      }
      function cfgMenu(c, x, y) {
        PatOS.menu([{ header: c.name },
          { label: T('Duplicate'), action: () => { const id = D.duplicate(c.id); load(id); } },
          ...c.versions.map((v, i) => ({ label: T('Restore') + ' · ' + new Date(v.t).toLocaleString(PatOS.locale), action: () => { D.restoreVersion(c.id, i); load(c.id); } })),
          { divider: true }, { label: T('Delete…'), action: async () => { if (await PatOS.confirmBox(T('Delete') + ' “' + c.name + '”?', T('Your desktop won’t change.'), { ok: T('Delete'), icon: 'deskstudio' })) { D.remove(c.id); if (savedId === c.id) load(null); else drawSide(); } } }], x, y);
      }
      async function load(id) {
        if (dirty && !(await PatOS.confirmBox(T('Leave without saving?'), T('Your changes to this configuration are lost.'), { ok: T('Leave'), icon: 'deskstudio' }))) return;
        savedId = id; cfg = id ? clone(D.get(id).config) : clone(D.capture(T('This desktop'))); title.value = cfg.name; sel = null; dirty = false; draw();
      }

      // ---------- the stage ----------
      function draw() {
        drawSide(); drawStage(); drawInsp();
      }
      function drawStage() {
        const s = scale(); stage.innerHTML = '';
        Object.assign(stage.style, { width: innerWidth * s + 'px', height: innerHeight * s + 'px' });
        const wp = cfg.look.wallpaper || PatOS.settings.wallpaper; try { stage.style.backgroundImage = 'url(' + PatOS.wallpaper.thumb(wp) + ')'; } catch (e) {}
        stage.classList.toggle('light', (cfg.look.theme || PatOS.settings.theme) === 'light');
        stage.appendChild(h('div', { class: 'sd-mb', style: { height: 28 * s + 'px' } }, ...(cfg.menus || []).map((m) => h('span', {}, m.title))));
        const dock = h('div', { class: 'sd-dock', style: { height: ((cfg.dock.size || 54) + 16) * s + 'px', bottom: 8 * s + 'px' } }, ...cfg.dock.apps.map((a) => h('span', { class: 'sd-di', style: { width: (cfg.dock.size || 54) * s + 'px', height: (cfg.dock.size || 54) * s + 'px' }, html: PatOS.iconHTML((PatOS.apps[a] || {}).icon || a) })));
        dock.onclick = () => { sel = { kind: 'dock' }; drawStage(); drawInsp(); };
        stage.appendChild(dock);
        cfg.widgets.forEach((w, i) => { const def = W.types().find((t) => t.id === (w.type === 'stack' ? (w.stack || [])[0] : w.type)); const [ww, wh] = SIZES[w.size] || SIZES.s;
          box({ kind: 'widget', i }, w.x, w.y, ww, wh, h('div', { class: 'sd-wl' }, h('b', {}, w.type === 'stack' ? T('Smart Stack') : def ? def.name : w.type), h('small', {}, { s: T('Small'), m: T('Medium'), l: T('Large') }[w.size]))); });
        cfg.panels.forEach((p, i) => box({ kind: 'panel', i }, p.x, p.y, p.w, p.h, h('div', { class: 'sd-pl' }, h('b', {}, p.title || T('Panel')), h('div', { class: 'sd-pi' }, ...p.items.slice(0, 12).map((a) => h('span', { html: D.actionIcon(a) }))))));
        stage.onclick = (e) => { if (e.target === stage) { sel = null; drawStage(); drawInsp(); } };
      }
      // a thing on the stage: drag it, pull its corner, click it
      function box(ref, x, y, w, hh, inner) {
        const s = scale(), on = sel && sel.kind === ref.kind && sel.i === ref.i;
        const el = h('div', { class: 'sd-box sd-' + ref.kind + (on ? ' on' : ''), tabindex: '0', role: 'button', 'aria-label': inner.textContent }, inner, h('i', { class: 'sd-rz', 'aria-hidden': 'true' }));
        Object.assign(el.style, { left: x * s + 'px', top: y * s + 'px', width: w * s + 'px', height: hh * s + 'px' });
        el.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); sel = ref; [...stage.querySelectorAll('.sd-box.on')].forEach((b) => b.classList.remove('on')); el.classList.add('on'); drawInsp();
          const it = ref.kind === 'widget' ? cfg.widgets[ref.i] : cfg.panels[ref.i]; const resize = e.target.classList.contains('sd-rz');
          const sx = e.clientX, sy = e.clientY, ox = it.x, oy = it.y, ow = ref.kind === 'panel' ? it.w : (SIZES[it.size] || SIZES.s)[0], oh = ref.kind === 'panel' ? it.h : (SIZES[it.size] || SIZES.s)[1];
          el.setPointerCapture(e.pointerId);
          const mv = (ev) => {
            const dx = (ev.clientX - sx) / s, dy = (ev.clientY - sy) / s;
            if (resize) {
              if (ref.kind === 'panel') { it.w = Math.max(140, Math.round((ow + dx) / 8) * 8); it.h = Math.max(90, Math.round((oh + dy) / 8) * 8); el.style.width = it.w * s + 'px'; el.style.height = it.h * s + 'px'; }
              else { const want = [ow + dx, oh + dy]; const def = W.types().find((t) => t.id === it.type) || { sizes: ['s', 'm', 'l'] }; const best = (def.sizes || ['s']).map((k) => [k, Math.abs(SIZES[k][0] - want[0]) + Math.abs(SIZES[k][1] - want[1])]).sort((a, b) => a[1] - b[1])[0][0]; if (best !== it.size) { it.size = best; el.style.width = SIZES[best][0] * s + 'px'; el.style.height = SIZES[best][1] * s + 'px'; } }
            } else { it.x = Math.max(0, Math.min(innerWidth - 60, Math.round((ox + dx) / 8) * 8)); it.y = Math.max(32, Math.min(innerHeight - 60, Math.round((oy + dy) / 8) * 8)); el.style.left = it.x * s + 'px'; el.style.top = it.y * s + 'px'; }
          };
          const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); touch(); drawInsp(); };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
        });
        el.addEventListener('keydown', (e) => {
          const it = ref.kind === 'widget' ? cfg.widgets[ref.i] : cfg.panels[ref.i]; const step = e.shiftKey ? 40 : 8;
          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); return; }
          const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]; if (!d) return;
          e.preventDefault(); it.x = Math.max(0, it.x + d[0]); it.y = Math.max(32, it.y + d[1]); touch(); drawStage(); const nb = stage.querySelectorAll('.sd-box.sd-' + ref.kind)[ref.i]; nb && nb.focus();
        });
        stage.appendChild(el);
      }
      function addWidget(type) { const def = W.types().find((t) => t.id === type) || { sizes: ['s'] }; cfg.widgets.push({ type, size: def.sizes[0], x: 60 + (cfg.widgets.length % 5) * 40, y: 80 + (cfg.widgets.length % 5) * 30, config: {}, stack: type === 'stack' ? ['calendar', 'weather', 'reminders'] : undefined }); sel = { kind: 'widget', i: cfg.widgets.length - 1 }; touch(); drawStage(); drawInsp(); }
      function addPanel(kind) { cfg.panels.push({ id: 'p' + uid(), kind, title: kind === 'launcher' ? T('My apps') : T('Dashboard'), x: Math.round(innerWidth / 2 - 160), y: 120, w: 320, h: 160, items: [{ kind: 'app', id: 'notes' }, { kind: 'app', id: 'calendar' }] }); sel = { kind: 'panel', i: cfg.panels.length - 1 }; touch(); drawStage(); drawInsp(); }
      function removeSel() { if (!sel) return; if (sel.kind === 'widget') cfg.widgets.splice(sel.i, 1); else if (sel.kind === 'panel') cfg.panels.splice(sel.i, 1); sel = null; touch(); drawStage(); drawInsp(); }

      // ---------- right: the inspector ----------
      const field = (label, el) => h('label', { class: 'sd-f' }, h('span', {}, T(label)), el);
      const sel2 = (val, opts, fn) => { const s = h('select', { class: 'field' }, ...opts.map(([v, l]) => h('option', { value: v, selected: String(val) === String(v) }, T(l)))); s.onchange = () => fn(s.value); return s; };
      function actionPicker(onPick) {
        const apps = Object.values(PatOS.apps).filter((a) => !a.hidden && a.id !== 'launchpad').sort((a, b) => a.name.localeCompare(b.name));
        const s = h('select', { class: 'field' }, h('option', { value: '' }, T('Add…')), h('optgroup', { label: T('Apps') }, ...apps.map((a) => h('option', { value: 'app:' + a.id }, a.name))), h('optgroup', { label: T('Shortcuts') }, ...(PatOS.shortcuts ? PatOS.shortcuts.list() : []).map((sc) => h('option', { value: 'shortcut:' + sc.name }, sc.name))), h('optgroup', { label: T('More') }, h('option', { value: 'url' }, T('A web page…')), h('option', { value: 'widgets' }, T('Edit Widgets…')), ...PatOS.profiles.list().map((p) => h('option', { value: 'profile:' + p.id }, T('Profile') + ' · ' + p.name))));
        s.onchange = async () => { const v = s.value; s.value = ''; if (!v) return; let a = null;
          if (v.startsWith('app:')) a = { kind: 'app', id: v.slice(4) }; else if (v.startsWith('shortcut:')) a = { kind: 'shortcut', name: v.slice(9) }; else if (v.startsWith('profile:')) a = { kind: 'profile', id: v.slice(8) }; else if (v === 'widgets') a = { kind: 'widgets' };
          else if (v === 'url') { const u = await PatOS.ask(T('A web page'), 'https://', { icon: 'deskstudio', ok: T('Add') }); a = D.cleanAction({ kind: 'url', url: u }); if (!a) { PatOS.alertBox(T('That didn’t work'), T('Use an address that starts with https://'), { icon: 'deskstudio' }); return; } }
          if (a) onPick(a); };
        return s;
      }
      const chips = (items, onRemove, onMove) => h('div', { class: 'sd-chips' }, ...items.map((a, i) => h('span', { class: 'sd-chip' }, h('span', { class: 'sd-chi', html: D.actionIcon(a) }), D.actionLabel(a), onMove && i ? h('button', { 'aria-label': T('Move up'), onclick: () => onMove(i) }, '↑') : null, h('button', { 'aria-label': T('Remove'), onclick: () => onRemove(i) }, '×'))));
      function drawInsp() {
        insp.innerHTML = '';
        if (sel && sel.kind === 'widget' && cfg.widgets[sel.i]) {
          const w = cfg.widgets[sel.i]; const def = W.types().find((t) => t.id === w.type) || { name: w.type, sizes: ['s', 'm', 'l'], id: w.type };
          insp.append(PatOS.ui.section(def.name), field('Size', sel2(w.size, (def.sizes || ['s']).map((k) => [k, { s: 'Small', m: 'Medium', l: 'Large' }[k]]), (v) => { w.size = v; touch(); drawStage(); })));
          (configOf(w.type) || []).forEach((c) => { const v = (w.config || {})[c.key] != null ? w.config[c.key] : c.def; let input;
            if (c.type === 'select') input = sel2(v, c.options, (x) => { w.config = Object.assign({}, w.config, { [c.key]: x }); touch(); });
            else if (c.type === 'apps') { input = h('input', { class: 'field', value: (v || []).join(', ') }); input.oninput = () => { w.config = Object.assign({}, w.config, { [c.key]: input.value.split(',').map((x) => x.trim()).filter((x) => PatOS.apps[x]) }); touch(); }; }
            else { input = h('input', { class: 'field', type: c.type === 'date' ? 'date' : 'text', value: v || '' }); input.oninput = () => { w.config = Object.assign({}, w.config, { [c.key]: input.value }); touch(); }; }
            insp.appendChild(field(c.label, input)); });
          if (w.type === 'stack') insp.append(field('In the stack', h('div', { class: 'sd-chips' }, ...(w.stack || []).map((t, i) => h('span', { class: 'sd-chip' }, (W.types().find((x) => x.id === t) || { name: t }).name, h('button', { 'aria-label': T('Remove'), onclick: () => { w.stack.splice(i, 1); touch(); drawInsp(); drawStage(); } }, '×'))))), field('Add to the stack', sel2('', [['', 'Add…']].concat(W.types().filter((t) => t.id !== 'stack').map((t) => [t.id, t.name])), (v) => { if (v) { w.stack = (w.stack || []).concat(v).slice(0, 6); touch(); drawInsp(); } })));
          insp.appendChild(h('button', { class: 'btn danger sd-del', onclick: removeSel }, T('Remove Widget')));
        } else if (sel && sel.kind === 'panel' && cfg.panels[sel.i]) {
          const p = cfg.panels[sel.i]; const t = h('input', { class: 'field', value: p.title, maxlength: '40' }); t.oninput = () => { p.title = t.value; touch(); drawStage(); };
          insp.append(PatOS.ui.section('Panel'), field('Title', t), field('Kind', sel2(p.kind, [['launcher', 'Launcher'], ['dashboard', 'Dashboard']], (v) => { p.kind = v; touch(); drawStage(); })),
            field('Buttons', chips(p.items, (i) => { p.items.splice(i, 1); touch(); draw(); }, (i) => { const x = p.items.splice(i, 1)[0]; p.items.splice(i - 1, 0, x); touch(); draw(); })), actionPicker((a) => { p.items.push(a); touch(); draw(); }),
            h('button', { class: 'btn danger sd-del', onclick: removeSel }, T('Remove Panel')));
        } else {
          // the whole desktop: look, Dock, menus, shortcuts, the widget maker
          const L = cfg.look;
          const wps = h('div', { class: 'sd-wps' }, ...[...Object.keys(PatOS.wallpaper.live), ...Object.keys(PatOS.wallpaper.palettes)].slice(0, 18).map((id) => h('button', { class: 'sd-wp' + (L.wallpaper === id ? ' on' : ''), title: id, onclick: () => { L.wallpaper = id; touch(); draw(); } }, h('img', { src: PatOS.wallpaper.thumb(id), alt: '' }))));
          const acc = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(L.accent || '') ? L.accent : '#0a84ff', 'aria-label': T('Accent color') }); acc.oninput = () => { L.accent = acc.value; touch(); };
          insp.append(PatOS.ui.section('Look'), field('Appearance', sel2(L.theme || 'dark', [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Auto']], (v) => { L.theme = v; touch(); drawStage(); })), field('Accent color', acc),
            field('Glass', sel2(L.glassStyle || 'clear', [['clear', 'Clear'], ['tinted', 'Tinted']], (v) => { L.glassStyle = v; touch(); })), h('div', { class: 'sd-f' }, h('span', {}, T('Wallpaper')), wps),
            PatOS.ui.section('Dock'), chips(cfg.dock.apps.map((id) => ({ kind: 'app', id })), (i) => { cfg.dock.apps.splice(i, 1); touch(); draw(); }, (i) => { const x = cfg.dock.apps.splice(i, 1)[0]; cfg.dock.apps.splice(i - 1, 0, x); touch(); draw(); }),
            actionPicker((a) => { if (a.kind === 'app' && !cfg.dock.apps.includes(a.id)) { cfg.dock.apps.push(a.id); touch(); draw(); } }),
            field('Dock size', (() => { const r = h('input', { type: 'range', min: 36, max: 84, value: cfg.dock.size || 54 }); r.oninput = () => { cfg.dock.size = +r.value; touch(); drawStage(); }; return r; })()),
            PatOS.ui.section('Menus'), ...menusEditor(), PatOS.ui.section('Keyboard shortcuts'), ...shortcutsEditor(),
            PatOS.ui.section('Widget maker'), h('p', { class: 'sd-fine' }, T('Make a widget from blocks: text, a live value, a button, a picture.')), h('button', { class: 'btn', onclick: () => widgetMaker() }, T('New widget…')));
        }
      }
      const configOf = (type) => (W.types().find((t) => t.id === type) || {}).config || [];
      function menusEditor() {
        const out = [];
        cfg.menus.forEach((m, mi) => { const t = h('input', { class: 'field', value: m.title, maxlength: '20' }); t.oninput = () => { m.title = t.value; touch(); drawStage(); };
          out.push(h('div', { class: 'sd-menu' }, field('Menu', t), chips(m.items.map((it) => it.action), (i) => { m.items.splice(i, 1); touch(); drawInsp(); }), actionPicker((a) => { m.items.push({ label: D.actionLabel(a), action: a }); touch(); drawInsp(); }), h('button', { class: 'btn', onclick: () => { cfg.menus.splice(mi, 1); touch(); draw(); } }, T('Remove Menu')))); });
        if (cfg.menus.length < 3) out.push(h('button', { class: 'btn', onclick: () => { cfg.menus.push({ title: T('My menu'), items: [] }); touch(); draw(); } }, '+ ' + T('Menu')));
        return out;
      }
      function shortcutsEditor() {
        const out = cfg.shortcuts.map((s, i) => h('div', { class: 'sd-key' }, h('span', { class: 'ui-kbds' }, ...s.keys.split('+').map((k) => h('kbd', {}, k))), h('span', { class: 'sd-keya' }, D.actionLabel(s.action)), h('button', { class: 'btn', 'aria-label': T('Remove'), onclick: () => { cfg.shortcuts.splice(i, 1); touch(); drawInsp(); } }, '×')));
        const rec = h('button', { class: 'btn' }, T('Record keys…')); let keys = null;
        rec.onclick = () => { rec.textContent = T('Press the keys…'); const on = (e) => { if (/^(Control|Alt|Shift|Meta)$/.test(e.key)) return; e.preventDefault(); e.stopPropagation(); removeEventListener('keydown', on, true); const k = D.normKeys([e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.key.length === 1 ? e.key.toUpperCase() : e.key].filter(Boolean).join('+')); if (!k || cfg.shortcuts.some((x) => x.keys === k)) { rec.textContent = T('Not allowed: try Ctrl+Alt and a letter'); return; } keys = k; rec.textContent = k; }; addEventListener('keydown', on, true); };
        out.push(h('div', { class: 'sd-key new' }, rec, actionPicker((a) => { if (!keys) { PatOS.alertBox(T('Keys first'), T('Press “Record keys…”, then the keys.'), { icon: 'deskstudio' }); return; } cfg.shortcuts.push({ keys, action: a }); keys = null; touch(); drawInsp(); })));
        return out;
      }
      // ---------- the widget maker ----------
      function widgetMaker() {
        const d = { schema: 'patos.studiowidget/1', id: 'w' + uid(), name: T('My widget'), bg: 'linear-gradient(135deg,#5e5ce6,#bf5af2)', size: 'm', blocks: [{ type: 'text', text: T('Hello'), size: 18, weight: 'bold' }, { type: 'value', bind: 'clock.time', label: '' }] };
        const body = h('div', { class: 'sd-maker' }); const pv = h('div', { class: 'sd-mpv widget' });
        const BG = [['linear-gradient(135deg,#5e5ce6,#bf5af2)', 'Violet'], ['linear-gradient(135deg,#0a84ff,#64d2ff)', 'Blue'], ['linear-gradient(135deg,#ff9f0a,#ff375f)', 'Sunset'], ['linear-gradient(135deg,#30d158,#64d2ff)', 'Mint'], ['#1c1c1e', 'Dark'], ['', 'Glass']];
        const LABEL = { 'clock.time': 'Time', 'clock.date': 'Date', 'calendar.next': 'Next event', 'reminders.count': 'Reminders to do', 'system.cpu': 'Processor use', 'system.apps': 'Apps open', 'battery.level': 'Battery', 'weather.temp': 'Temperature', 'music.title': 'Song playing', 'notes.count': 'Notes' };
        const render = () => {
          body.innerHTML = ''; const n = h('input', { class: 'field', value: d.name, maxlength: '40' }); n.oninput = () => { d.name = n.value; paint(); };
          body.append(field('Name', n), field('Background', sel2(d.bg, BG, (v) => { d.bg = v; paint(); })));
          d.blocks.forEach((b, i) => { const row = h('div', { class: 'sd-blk' }, h('b', {}, T({ text: 'Text', value: 'Live value', button: 'Button', image: 'Picture' }[b.type])));
            if (b.type === 'text') { const t = h('input', { class: 'field', value: b.text, maxlength: '120' }); t.oninput = () => { b.text = t.value; paint(); }; row.append(t, sel2(b.size, [[13, 'Small'], [18, 'Medium'], [28, 'Big']], (v) => { b.size = +v; paint(); })); }
            if (b.type === 'value') { row.append(sel2(b.bind, Object.keys(LABEL).filter((k) => W.BINDINGS.includes(k)).map((k) => [k, LABEL[k]]), (v) => { b.bind = v; paint(); })); const l = h('input', { class: 'field', value: b.label, placeholder: T('Label'), maxlength: '40' }); l.oninput = () => { b.label = l.value; paint(); }; row.append(l); }
            if (b.type === 'button') { const l = h('input', { class: 'field', value: b.label, maxlength: '24' }); l.oninput = () => { b.label = l.value; paint(); }; row.append(l, actionPicker((a) => { if (a.kind === 'app') b.action = 'app:' + a.id; else if (a.kind === 'shortcut') b.action = 'shortcut:' + a.name; paint(); render(); }), h('small', {}, b.action || '')); }
            if (b.type === 'image') row.append(h('button', { class: 'btn', onclick: () => { const inp = h('input', { type: 'file', accept: 'image/*' }); inp.onchange = () => { const f = inp.files[0]; if (!f || f.size > 200000) { PatOS.alertBox(T('That didn’t work'), T('Use a picture under 200 KB.'), { icon: 'deskstudio' }); return; } const r = new FileReader(); r.onload = () => { b.src = r.result; paint(); }; r.readAsDataURL(f); }; inp.click(); } }, T('Choose a picture…')));
            row.append(h('button', { class: 'btn', 'aria-label': T('Remove'), onclick: () => { d.blocks.splice(i, 1); render(); paint(); } }, '×')); body.appendChild(row); });
          if (d.blocks.length < 8) body.appendChild(h('div', { class: 'sd-addblk' }, ...[['text', 'Text'], ['value', 'Live value'], ['button', 'Button'], ['image', 'Picture']].map(([t, l]) => h('button', { class: 'btn', onclick: () => { d.blocks.push(t === 'text' ? { type: 'text', text: T('Text'), size: 15 } : t === 'value' ? { type: 'value', bind: 'reminders.count', label: T('To do') } : t === 'button' ? { type: 'button', label: T('Open'), action: 'app:notes' } : { type: 'image', src: '' }); render(); paint(); } }, '+ ' + T(l)))));
          body.appendChild(h('div', { class: 'sd-f' }, h('span', {}, T('Preview')), pv)); paint();
        };
        const paint = () => { pv.innerHTML = ''; let w; try { w = W.validateStudioWidget(d); } catch (e) { pv.textContent = e.message; return; } pv.style.background = w.bg || ''; w.blocks.forEach((b) => { if (b.type === 'text') pv.appendChild(h('div', { style: { fontSize: b.size + 'px', fontWeight: b.weight } }, b.text)); else if (b.type === 'value') pv.appendChild(h('div', { class: 'wgs-val' }, b.label ? h('small', {}, b.label) : null, h('b', {}, '…'))); else if (b.type === 'button') pv.appendChild(h('span', { class: 'wgs-btn' }, b.label)); else if (b.type === 'image') pv.appendChild(h('img', { class: 'wgs-img', src: b.src })); }); };
        render();
        PatOS.ui.sheet(win, { title: T('Widget maker'), body, actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: () => { try { const id = W.registerStudio(d); cfg.studioWidgets = (cfg.studioWidgets || []).filter((x) => x.id !== d.id).concat(W.validateStudioWidget(d)); addWidget(id); close(); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'deskstudio' }); } } }, T('Add to the desktop'))] });
      }

      // ---------- preview, save, files ----------
      function togglePreview(force) {
        if (preview && force !== true) { try { preview(); } catch (e) {} preview = null; banner.classList.add('hidden'); bPrev.textContent = T('Preview'); return; }
        try { const r = D.apply(cfg, { preview: true }); preview = r.revert; banner.classList.remove('hidden'); bPrev.textContent = T('Revert'); if (r.warnings.length) PatOS.notify({ title: T('Some parts were left out'), body: r.warnings.join(' · '), icon: 'deskstudio' }); }
        catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'deskstudio' }); }
      }
      function doSave() { try { savedId = D.save(cfg, savedId); dirty = false; drawSide(); PatOS.notify({ title: T('Saved'), body: cfg.name, icon: 'deskstudio', priority: 'low' }); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'deskstudio' }); } }
      function exportFile() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([D.exportText(cfg)], { type: 'application/json' })); a.download = (cfg.name || 'desktop').replace(/[\\/:*?"<>|]/g, '') + '.patdesk'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
      function importFile() {
        const inp = h('input', { type: 'file', accept: '.patdesk,.json' });
        inp.onchange = async () => { try { const { config, warnings } = D.importText(await inp.files[0].text()); cfg = config; savedId = null; title.value = cfg.name; touch(); draw(); if (warnings.length) PatOS.notify({ title: T('Some parts were left out'), body: warnings.join(' · '), icon: 'deskstudio' }); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'deskstudio' }); } };
        inp.click();
      }
      win.on('beforeclose', (e) => { if (preview) { try { preview(); } catch (er) {} preview = null; } if (dirty && !win._askedClose) { e.cancel(); PatOS.confirmBox(T('Close without saving?'), T('Your changes to this configuration are lost.'), { ok: T('Close'), icon: 'deskstudio' }).then((ok) => { if (ok) { win._askedClose = true; dirty = false; win.close(); } }); } });
      win.on('resize', PatOS.debounce(() => drawStage(), 120));
      if (window.ResizeObserver) { const ro = new ResizeObserver(PatOS.debounce(() => drawStage(), 60)); ro.observe(stageWrap); win.on('closed', () => ro.disconnect()); } // (the stage fits the space it has)
      win._studio = { get cfg() { return cfg; }, addWidget, addPanel, select: (s) => { sel = s; drawStage(); drawInsp(); }, save: doSave, preview: togglePreview, load, apply: (c) => { cfg = D.validate(c).config; draw(); } };
      draw(); bSave.disabled = true; requestAnimationFrame(() => drawStage());
      if (args && args.config) { try { cfg = D.validate(args.config).config; title.value = cfg.name; touch(); draw(); } catch (e) {} }
    },
    onArgs(win, args) { if (args && args.config && win._studio) win._studio.apply(args.config); }
  });
})();
