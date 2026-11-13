/* PatOS Data (4.0): the app. Collections (your projects), suggestions, a timeline, a graph of what connects, and your control.
   The engine is js/data.js (PatOS.data). */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.data = { bg: 'linear-gradient(160deg,#5e5ce6,#0a84ff)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M20 22 32 34 46 20M32 34v14M20 22l-4 20M46 20l2 22" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/><circle cx="20" cy="22" r="6" fill="#fff"/><circle cx="46" cy="20" r="6" fill="#fff"/><circle cx="32" cy="34" r="7" fill="#fff"/><circle cx="32" cy="48" r="5" fill="#fff" opacity=".85"/><circle cx="16" cy="42" r="4" fill="#fff" opacity=".8"/><circle cx="48" cy="42" r="4" fill="#fff" opacity=".8"/></svg>' };
  const KIND = { file: ['doc', '#0a84ff', 'Files'], note: ['note', '#ffd60a', 'Notes'], event: ['calendar', '#ff453a', 'Events'], reminder: ['list', '#ff9f0a', 'Reminders'], capture: ['capture', '#30d158', 'Captures'], world: ['grid', '#64d2ff', 'Boards'] };
  const ago = (t) => (t ? new Date(t).toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : '');

  PatOS.registerApp({
    id: 'data', name: 'Data', icon: 'data', width: 1100, height: 700, minWidth: 720, minHeight: 460, category: 'Productivity', keywords: 'data relationships projects collections graph knowledge related links connections donnees projets liens',
    about: 'What connects your files, notes, events and more.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'dt-win');
      const D = PatOS.data;
      let view = args && args.id ? { kind: 'col', id: args.id, tab: 'items' } : { kind: 'home' }, sel = null;
      const side = h('div', { class: 'dt-side' }), main = h('div', { class: 'dt-main' }), insp = h('div', { class: 'dt-insp hidden' });
      win.body.append(h('div', { class: 'dt-wrap' }, side, main, insp));
      const search = PatOS.ui.search({ placeholder: 'Search everything', onInput: PatOS.debounce((v) => { view = v.trim() ? { kind: 'explore', q: v } : { kind: 'home' }; draw(); }, 200) });
      win.toolbar.append(search, h('div', { style: { flex: 1 } }), h('button', { class: 'btn', onclick: () => newCollection() }, '+ ' + T('Collection')));

      const card = (it, opts) => h('button', { class: 'dt-card' + (sel === it.key ? ' on' : ''), 'data-key': it.key, onclick: () => select(it.key), ondblclick: () => D.openItem(it), title: it.title },
        h('span', { class: 'dt-ci', style: { '--kc': (KIND[it.kind] || KIND.file)[1] }, html: PatOS.sym((KIND[it.kind] || KIND.file)[0]) }),
        h('span', { class: 'dt-ct' }, h('b', {}, it.title || T('Untitled')), h('small', {}, (it.sub || '') + (it.date ? ' · ' + ago(it.date) : ''))),
        opts && opts.remove ? h('span', { class: 'dt-x', role: 'button', 'aria-label': T('Take out of the collection'), title: T('Take out of the collection'), onclick: (e) => { e.stopPropagation(); opts.remove(it); } }, '×') : null);
      function drawSide() {
        side.innerHTML = ''; const cs = D.collections();
        side.append(PatOS.ui.item({ icon: 'sparkle', label: 'Overview', on: view.kind === 'home', onClick: () => { view = { kind: 'home' }; draw(); } }), PatOS.ui.heading('Collections'),
          ...cs.map((c) => PatOS.ui.item({ icon: 'grid', label: c.name, count: c.count, on: view.kind === 'col' && view.id === c.id, onClick: () => { view = { kind: 'col', id: c.id, tab: 'items' }; draw(); } })),
          cs.length ? null : h('p', { class: 'dt-fine' }, T('None yet.')),
          PatOS.ui.heading('Your control'), PatOS.ui.item({ icon: 'shield', label: 'Privacy & indexing', on: view.kind === 'prefs', onClick: () => { view = { kind: 'prefs' }; draw(); } }));
      }
      function draw() { drawSide(); main.innerHTML = ''; ({ home, col, explore, prefs: prefsView })[view.kind](); if (sel) drawInsp(); }

      function home() {
        if (!D.prefs().on) { main.appendChild(PatOS.ui.empty({ icon: 'shield', title: 'PatOS Data is off', text: 'Nothing is read or connected.', action: ['Turn On', () => { D.setPrefs({ on: true }); draw(); }] })); return; }
        const n = D.size(), sug = D.suggestions();
        main.append(h('h2', { class: 'dt-h' }, T('What connects')), h('p', { class: 'dt-sub' }, n + ' ' + T('things read: files, notes, events, reminders, captures and boards. Every link says why.')));
        if (sug.length) main.append(PatOS.ui.section('Suggested collections'), h('div', { class: 'dt-sugs' }, ...sug.map((s) => h('button', { class: 'dt-sug', onclick: () => { const id = D.createCollection(s.word.charAt(0).toUpperCase() + s.word.slice(1), [s.word]); view = { kind: 'col', id, tab: 'items' }; draw(); } },
          h('b', {}, '“' + s.word + '”'), h('small', {}, s.count + ' ' + T('things') + ' · ' + s.kinds.map((k) => T((KIND[k] || KIND.file)[2])).join(', ')), h('span', { class: 'dt-sugp' }, '+ ' + T('Make a collection'))))));
        const cs = D.collections();
        if (cs.length) main.append(PatOS.ui.section('Your collections'), h('div', { class: 'dt-cols' }, ...cs.map((c) => h('button', { class: 'dt-colc', onclick: () => { view = { kind: 'col', id: c.id, tab: 'items' }; draw(); } }, h('b', {}, c.name), h('small', {}, c.count + ' ' + T('things') + ' · ' + c.keywords.join(', '))))));
        if (!sug.length && !cs.length) main.appendChild(PatOS.ui.empty({ icon: 'grid', title: 'No collections yet', text: 'Make one for a project: give it a name and a few words, and Data gathers what goes with it.', action: ['New Collection', () => newCollection()] }));
      }
      function col() {
        const c = D.collection(view.id); if (!c) { view = { kind: 'home' }; return home(); }
        const kw = h('input', { class: 'field dt-kw', value: c.keywords.join(', '), 'aria-label': T('Words'), title: T('The words that gather this collection, separated by commas') });
        kw.onchange = () => { D.updateCollection(c.id, { keywords: kw.value.split(',') }); draw(); };
        const tabs = PatOS.ui.segmented([['items', 'Things'], ['history', 'History'], ['graph', 'Graph']], view.tab, (v) => { view.tab = v; draw(); });
        main.append(h('div', { class: 'dt-head' }, h('h2', { class: 'dt-h', ondblclick: async () => { const n = await PatOS.ask(T('Rename'), c.name, { icon: 'data', ok: T('Save') }); if (n) { D.updateCollection(c.id, { name: n }); draw(); } } }, c.name), h('span', { class: 'dt-cnt' }, c.items.length + ' ' + T('things')), h('div', { style: { flex: 1 } }), tabs,
          h('button', { class: 'btn', 'aria-label': T('More'), onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([
            { label: T('Add something…'), action: () => addPicker(c.id) },
            PatOS.world ? { label: T('Put on a World board'), action: () => { const id = PatOS.world.create(c.name); PatOS.world.addItems(id, c.items.slice(0, 80).map((it) => it.kind === 'file' ? { kind: 'file', path: it.key.slice(5), w: 220, h: 90 } : it.kind === 'note' ? { kind: 'note', noteId: it.key.slice(5), w: 220, h: 140 } : { kind: 'sticky', text: it.title, w: 200, h: 120 })); PatOS.launch('world', { id }); } } : null,
            PatOS.apps.gallery ? { label: T('Open in Gallery'), action: () => PatOS.launch('gallery', { collection: c.id }) } : null,
            { divider: true }, { label: T('Rename…'), action: async () => { const n = await PatOS.ask(T('Rename'), c.name, { icon: 'data', ok: T('Save') }); if (n) { D.updateCollection(c.id, { name: n }); draw(); } } },
            { label: T('Delete Collection…'), action: async () => { if (await PatOS.confirmBox(T('Delete') + ' “' + c.name + '”?', T('Only the collection goes. Nothing in it is deleted.'), { ok: T('Delete'), icon: 'data' })) { D.deleteCollection(c.id); view = { kind: 'home' }; draw(); } } }].filter(Boolean), r.left, r.bottom + 4); } }, '•••')),
          h('label', { class: 'dt-kwl' }, h('small', {}, T('Words')), kw));
        if (view.tab === 'items') {
          if (!c.items.length) { main.appendChild(PatOS.ui.empty({ icon: 'search', title: 'Nothing matches yet', text: 'Add words above, or add things by hand.', action: ['Add something…', () => addPicker(c.id)] })); return; }
          const groups = {}; c.items.forEach((it) => { (groups[it.kind] = groups[it.kind] || []).push(it); });
          Object.keys(KIND).filter((k) => groups[k]).forEach((k) => main.append(PatOS.ui.section(KIND[k][2]), h('div', { class: 'dt-grid' }, ...groups[k].map((it) => card(it, { remove: (x) => { D.removeFrom(c.id, x.key); draw(); } })))));
        } else if (view.tab === 'history') {
          const hst = D.history(c.id); if (!hst.length) { main.appendChild(PatOS.ui.empty({ icon: 'history', title: 'No dates yet' })); return; }
          let last = ''; const list = h('div', { class: 'dt-hist' });
          hst.forEach((it) => { const d = new Date(it.date).toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); if (d !== last) { list.appendChild(h('div', { class: 'dt-hd' }, d)); last = d; } list.appendChild(card(it)); });
          main.appendChild(list);
        } else graph(c.items.slice(0, 60));
      }
      function explore() {
        const res = D.search(view.q, 60);
        main.append(h('h2', { class: 'dt-h' }, '“' + view.q + '”'), h('p', { class: 'dt-sub' }, res.length + ' ' + T('things')),
          res.length ? h('div', { class: 'dt-explore' }, h('div', { class: 'dt-grid' }, ...res.map((it) => card(it))), h('div', {}, h('button', { class: 'btn', onclick: () => { const id = D.createCollection(view.q, [view.q]); view = { kind: 'col', id, tab: 'items' }; draw(); } }, '+ ' + T('Make a collection')))) : PatOS.ui.empty({ icon: 'search', title: 'Nothing found' }));
      }
      function prefsView() {
        const p = D.prefs();
        const sw = (on, fn, label) => { const b = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), 'aria-label': T(label) }); b.onclick = () => { fn(!on); draw(); }; return b; };
        main.append(h('h2', { class: 'dt-h' }, T('Privacy & indexing')), h('p', { class: 'dt-sub' }, T('Data only reads when you use it, keeps its index in memory, and never reads what you leave out.')),
          PatOS.ui.group([PatOS.ui.row({ label: 'PatOS Data', sub: 'Turned off, nothing is read or connected.', control: sw(p.on, (v) => D.setPrefs({ on: v }), 'PatOS Data') })]),
          PatOS.ui.section('What it may read'), PatOS.ui.group(D.KINDS.map((k) => PatOS.ui.row({ label: KIND[k][2], control: sw(p.kinds.includes(k), (v) => D.setPrefs({ kinds: v ? p.kinds.concat(k) : p.kinds.filter((x) => x !== k) }), KIND[k][2]) }))),
          PatOS.ui.section('Folders it never reads'), PatOS.ui.group([...p.paths.map((f) => PatOS.ui.row({ label: f, control: h('button', { class: 'btn', onclick: () => { D.setPrefs({ paths: p.paths.filter((x) => x !== f) }); draw(); } }, T('Remove')) })),
            PatOS.ui.row({ label: 'Leave out a folder', control: h('button', { class: 'btn', onclick: async () => { const f = await PatOS.ask(T('A folder'), '/Documents/Private', { icon: 'data', ok: T('Leave out') }); if (f && PatOS.fs.isDir(f)) { D.setPrefs({ paths: [...new Set(p.paths.concat(f))] }); draw(); } else if (f) PatOS.alertBox(T('That didn’t work'), T('There’s no folder there.'), { icon: 'data' }); } }, T('Add…')) })]),
          PatOS.ui.section('Private things'), p.private.length ? PatOS.ui.group(p.private.map((k) => PatOS.ui.row({ label: k.replace(/^[a-z]+:/, ''), sub: k.split(':')[0], control: h('button', { class: 'btn', onclick: () => { D.setPrivate(k, false); draw(); } }, T('Read it again')) }))) : h('p', { class: 'dt-fine' }, T('Mark a thing private from its details: Data stops reading it.')),
          PatOS.ui.section('Index'), PatOS.ui.group([PatOS.ui.row({ label: 'Rebuild now', sub: T('Reads everything again from the start.'), control: h('button', { class: 'btn', onclick: () => { const n = D.build(); PatOS.notify({ title: T('Rebuilt'), body: n + ' ' + T('things'), icon: 'data', priority: 'low' }); draw(); } }, T('Rebuild')) })]));
      }
      // the details of one thing: what goes with it, and why
      function select(key) { sel = key; [...main.querySelectorAll('.dt-card')].forEach((c) => c.classList.toggle('on', c.dataset.key === key)); drawInsp(); }
      function drawInsp() {
        const it = D.item(sel); if (!it) { insp.classList.add('hidden'); return; } insp.classList.remove('hidden'); insp.innerHTML = '';
        const rel = D.related(sel, 12);
        insp.append(h('div', { class: 'dt-ih' }, h('span', { class: 'dt-ci big', style: { '--kc': (KIND[it.kind] || KIND.file)[1] }, html: PatOS.sym((KIND[it.kind] || KIND.file)[0]) }), h('div', {}, h('b', {}, it.title), h('small', {}, it.sub + (it.tags.length ? ' · ' + it.tags.map((t) => '#' + t).join(' ') : ''))), h('button', { class: 'dt-ix', 'aria-label': T('Close'), onclick: () => { sel = null; insp.classList.add('hidden'); } }, '×')),
          h('div', { class: 'dt-ib' }, h('button', { class: 'btn primary', onclick: () => D.openItem(it) }, T('Open')), view.kind === 'col' ? h('button', { class: 'btn', onclick: () => { D.addTo(view.id, it.key); draw(); } }, T('Keep in collection')) : null,
            h('button', { class: 'btn', title: T('Data stops reading it'), onclick: async () => { if (await PatOS.confirmBox(T('Make it private?'), T('Data stops reading it and it leaves every collection. The thing itself doesn’t change.'), { ok: T('Make Private'), icon: 'data' })) { D.setPrivate(it.key, true); sel = null; insp.classList.add('hidden'); draw(); } } }, T('Private'))),
          PatOS.ui.section('Goes with'), rel.length ? h('div', { class: 'dt-rel' }, ...rel.map((r) => h('div', { class: 'dt-ri' }, card(r), h('small', { class: 'dt-why' }, r.why.join(' · ')), h('button', { class: 'dt-unl', title: T('Not related'), onclick: () => { D.unlink(sel, r.key); drawInsp(); } }, T('Not related'))))) : h('p', { class: 'dt-fine' }, T('Nothing yet. Link something by hand:')),
          h('button', { class: 'btn', onclick: () => linkPicker(sel) }, '+ ' + T('Link to…')));
      }
      // finding any thing (to add to a collection, or to link)
      function picker(title, onPick) {
        const list = h('div', { class: 'dt-pick' }); const inp = h('input', { class: 'field', type: 'search', placeholder: T('Search everything'), 'aria-label': T('Search everything') });
        const fill = () => { list.innerHTML = ''; (inp.value.trim() ? D.search(inp.value, 30) : []).forEach((r) => list.appendChild(h('button', { class: 'dt-pi', onclick: () => { onPick(r.key); s.close(); } }, h('span', { class: 'dt-ci', style: { '--kc': (KIND[r.kind] || KIND.file)[1] }, html: PatOS.sym((KIND[r.kind] || KIND.file)[0]) }), h('span', {}, r.title), h('small', {}, r.sub)))); };
        inp.oninput = PatOS.debounce(fill, 150);
        const s = PatOS.ui.sheet(win, { title, body: h('div', { class: 'dt-pickw' }, inp, list), actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Close'))] });
      }
      const addPicker = (id) => picker(T('Add something'), (key) => { D.addTo(id, key); draw(); });
      const linkPicker = (a) => picker(T('Link to…'), (b) => { if (b !== a) { D.link(a, b); drawInsp(); } });
      async function newCollection() { const n = await PatOS.ask(T('New collection'), T('Biology project'), { icon: 'data', ok: T('Create'), text: T('Data gathers what matches its name; you can add more words after.') }); if (!n) return; try { const id = D.createCollection(n); view = { kind: 'col', id, tab: 'items' }; draw(); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'data' }); } }

      // ---------- the graph: drawn on a canvas, settles, then stops ----------
      function graph(items) {
        const wrap = h('div', { class: 'dt-graph' }); const cv = h('canvas', { 'aria-label': T('Graph of what connects') }); const tip = h('div', { class: 'dt-tip hidden' }); wrap.append(cv, tip); main.appendChild(wrap);
        const nodes = items.map((it, i) => ({ it, x: Math.cos(i * 2.4) * 120 * Math.sqrt(i + 1), y: Math.sin(i * 2.4) * 120 * Math.sqrt(i + 1), vx: 0, vy: 0 }));
        const pos = new Map(nodes.map((n) => [n.it.key, n])), edges = [];
        nodes.forEach((n) => D.related(n.it.key, 8).forEach((r) => { const m = pos.get(r.key); if (m && n.it.key < r.key) edges.push({ a: n, b: m, s: r.score, why: r.why }); }));
        let raf = 0, steps = 0, drag = null, hover = null; const dpr = devicePixelRatio || 1;
        const size = () => { const r = wrap.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = Math.max(300, r.height) * dpr; cv.style.width = r.width + 'px'; cv.style.height = Math.max(300, r.height) + 'px'; };
        const tick = () => {
          for (let k = 0; k < 2; k++) {
            nodes.forEach((a) => { nodes.forEach((b) => { if (a === b) return; const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01; const f = 2400 / d2; a.vx += dx * f / Math.sqrt(d2); a.vy += dy * f / Math.sqrt(d2); }); a.vx -= a.x * 0.002; a.vy -= a.y * 0.002; });
            edges.forEach((e) => { const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1; const f = (d - 110) * 0.01 * Math.min(2, e.s / 5); e.a.vx += dx / d * f; e.a.vy += dy / d * f; e.b.vx -= dx / d * f; e.b.vy -= dy / d * f; });
            nodes.forEach((n) => { if (n === drag) return; n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx; n.y += n.vy; });
          }
          paint(); steps++;
          const energy = nodes.reduce((s, n) => s + Math.abs(n.vx) + Math.abs(n.vy), 0);
          raf = (steps < 400 && energy > 0.05 * nodes.length) || drag ? requestAnimationFrame(tick) : 0; // (settled: it stops)
        };
        const toScreen = (n) => [cv.width / 2 + n.x * dpr, cv.height / 2 + n.y * dpr];
        const paint = () => {
          const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); const dark = document.documentElement.classList.contains('dark') || PatOS.settings.theme !== 'light';
          edges.forEach((e) => { const [x1, y1] = toScreen(e.a), [x2, y2] = toScreen(e.b); x.strokeStyle = dark ? 'rgba(255,255,255,' + Math.min(0.5, 0.1 + e.s / 30) + ')' : 'rgba(0,0,0,' + Math.min(0.4, 0.08 + e.s / 30) + ')'; x.lineWidth = Math.min(4, 0.6 + e.s / 6) * dpr; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); });
          nodes.forEach((n) => { const [sx, sy] = toScreen(n); const k = KIND[n.it.kind] || KIND.file; const r = (n === hover || sel === n.it.key ? 11 : 8) * dpr; x.fillStyle = k[1]; x.beginPath(); x.arc(sx, sy, r, 0, Math.PI * 2); x.fill(); if (sel === n.it.key) { x.strokeStyle = '#fff'; x.lineWidth = 2 * dpr; x.stroke(); }
            x.fillStyle = dark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.8)'; x.font = (11 * dpr) + 'px system-ui'; x.textAlign = 'center'; x.fillText(n.it.title.slice(0, 22), sx, sy + r + 13 * dpr); });
        };
        const at = (e) => { const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr; return nodes.find((n) => { const [sx, sy] = toScreen(n); return Math.hypot(sx - px, sy - py) < 14 * dpr; }); };
        cv.onpointermove = (e) => { if (drag) { const r = cv.getBoundingClientRect(); drag.x = (e.clientX - r.left - r.width / 2); drag.y = (e.clientY - r.top - r.height / 2); paint(); return; } const n = at(e); if (n !== hover) { hover = n; paint(); } if (n) { tip.classList.remove('hidden'); tip.textContent = n.it.title + ' · ' + T((KIND[n.it.kind] || KIND.file)[2]); tip.style.left = (e.offsetX + 14) + 'px'; tip.style.top = (e.offsetY + 10) + 'px'; } else tip.classList.add('hidden'); };
        cv.onpointerdown = (e) => { const n = at(e); if (!n) return; drag = n; cv.setPointerCapture(e.pointerId); select(n.it.key); if (!raf) raf = requestAnimationFrame(tick); };
        cv.onpointerup = () => { drag = null; };
        cv.ondblclick = (e) => { const n = at(e); if (n) D.openItem(n.it); };
        size(); if (!nodes.length) { main.removeChild(wrap); main.appendChild(PatOS.ui.empty({ icon: 'grid', title: 'Nothing to draw yet' })); return; }
        raf = requestAnimationFrame(tick);
        const ro = new ResizeObserver(() => { size(); paint(); }); ro.observe(wrap);
        const off = () => { cancelAnimationFrame(raf); ro.disconnect(); }; win.on('closed', off); wrap._off = off;
      }
      PatOS.on('data', PatOS.debounce(() => { if (win.closed) return; draw(); }, 200));
      win._data = { open: (v) => { view = v; draw(); }, select, get view() { return view; } };
      draw();
    },
    onArgs(win, args) { if (args && args.id && win._data) win._data.open({ kind: 'col', id: args.id, tab: 'items' }); }
  });
})();
