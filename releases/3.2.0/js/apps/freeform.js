/* Freeform — an endless whiteboard: draw, add sticky notes, text, shapes and pictures */
(function () {
  'use strict';
  const { h } = PatOS;
  const NOTE_COLORS = ['#fff59d', '#ffc1e3', '#b3e5fc', '#c8f7c5', '#e1d5ff', '#ffd8a8'];
  PatOS.registerApp({
    id: 'freeform', name: 'Freeform', icon: 'freeform', width: 1000, height: 640, keywords: 'whiteboard draw board brainstorm canvas sketch',
    about: 'An endless whiteboard for ideas: draw, add notes, text, shapes and pictures.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let boards = PatOS.store.get('boards', null) || [{ id: 'b1', name: 'My Board', items: [], strokes: [], view: { x: 0, y: 0, z: 1 } }];
      let bi = 0, tool = 'select', color = '#0a84ff', sel = null;
      const B = () => boards[bi];
      const save = PatOS.debounce(() => PatOS.store.set('boards', boards), 400);
      const boardSel = h('select', { class: 'field' });
      const tools = h('div', { class: 'seg' });
      [['select', '✋', 'Select and move'], ['pen', '✏️', 'Draw'], ['note', '🗒', 'Sticky note'], ['text', 'T', 'Text'], ['rect', '▢', 'Box'], ['circle', '◯', 'Circle'], ['erase', '🧽', 'Eraser']].forEach(([k, ic, tt]) => tools.appendChild(h('button', { class: 'tab', title: tt, 'data-k': k, onclick: () => { tool = k; syncTools(); } }, ic)));
      const col = h('input', { type: 'color', class: 'ff-col', value: color, title: 'Color' }); col.oninput = () => { color = col.value; if (sel) { sel.color = color; save(); draw(); } };
      const bImg = h('button', { class: 'tbtn', title: 'Add a picture' }, '🖼');
      const bZoom = h('button', { class: 'tbtn', title: 'Fit everything' }, '⤢');
      const bMenu = h('button', { class: 'tbtn', title: 'Boards' }, '⋯');
      win.toolbar.append(boardSel, tools, col, bImg, bZoom, bMenu); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const stage = h('div', { class: 'ff-stage' });
      const world = h('div', { class: 'ff-world' });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ff-svg');
      world.appendChild(svg); stage.appendChild(world);
      const zoomLbl = h('div', { class: 'ff-zoom' });
      win.body.append(stage, zoomLbl);
      function syncTools() { [...tools.children].forEach((b) => b.classList.toggle('on', b.dataset.k === tool)); stage.dataset.tool = tool; }
      function syncBoards() { boardSel.innerHTML = ''; boards.forEach((b, i) => boardSel.appendChild(h('option', { value: i, selected: i === bi }, b.name))); }
      boardSel.onchange = () => { bi = +boardSel.value; sel = null; draw(); };
      const toWorld = (cx, cy) => { const r = stage.getBoundingClientRect(), v = B().view; return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }; };
      function applyView() { const v = B().view; world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`; stage.style.backgroundPosition = `${v.x}px ${v.y}px`; stage.style.backgroundSize = `${24 * v.z}px ${24 * v.z}px`; zoomLbl.textContent = Math.round(v.z * 100) + '%'; }
      function path(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); }
      function draw() {
        [...world.querySelectorAll('.ff-item')].forEach((e) => e.remove());
        svg.innerHTML = '';
        B().strokes.forEach((s) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', path(s.pts)); p.setAttribute('stroke', s.color); p.setAttribute('stroke-width', s.w || 3); p.setAttribute('fill', 'none'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); p.dataset.id = s.id; svg.appendChild(p); });
        B().items.forEach((it) => world.appendChild(itemEl(it)));
        applyView();
      }
      function itemEl(it) {
        const el = h('div', { class: 'ff-item ff-t-' + it.type + (sel === it ? ' on' : ''), style: { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px' } });
        if (it.type === 'note') { el.style.background = it.color; el.appendChild(h('div', { class: 'ff-text', contenteditable: 'true', spellcheck: 'true' }, it.text || '')); }
        if (it.type === 'text') { el.style.color = it.color; el.appendChild(h('div', { class: 'ff-text', contenteditable: 'true', spellcheck: 'true' }, it.text || '')); }
        if (it.type === 'rect' || it.type === 'circle') { el.style.borderColor = it.color; el.style.background = it.color + '22'; }
        if (it.type === 'img') el.appendChild(h('img', { src: it.src, alt: '', draggable: 'false' }));
        const tx = el.querySelector('.ff-text'); if (tx) tx.addEventListener('input', () => { it.text = tx.innerText; save(); });
        el.appendChild(h('div', { class: 'ff-handle' }));
        el.addEventListener('pointerdown', (e) => {
          if (tool === 'erase') { e.stopPropagation(); B().items = B().items.filter((x) => x !== it); save(); draw(); return; }
          if (tool !== 'select' || (e.target.classList.contains('ff-text') && sel === it)) return;
          e.stopPropagation(); sel = it; world.querySelectorAll('.ff-item.on').forEach((x) => x.classList.remove('on')); el.classList.add('on');
          const s = toWorld(e.clientX, e.clientY), o = { x: it.x, y: it.y, w: it.w, h: it.h }, resize = e.target.classList.contains('ff-handle');
          el.setPointerCapture(e.pointerId);
          const mv = (ev) => { const p = toWorld(ev.clientX, ev.clientY); if (resize) { it.w = Math.max(40, o.w + p.x - s.x); it.h = Math.max(30, o.h + p.y - s.y); } else { it.x = o.x + p.x - s.x; it.y = o.y + p.y - s.y; } Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px' }); };
          const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); save(); };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
        });
        return el;
      }
      let act = null;
      stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.ff-item')) return;
        const p = toWorld(e.clientX, e.clientY); stage.setPointerCapture(e.pointerId);
        if (tool === 'pen') { const s = { id: PatOS.uid(), color, w: 3 / B().view.z + 1, pts: [[p.x, p.y]] }; B().strokes.push(s); act = { type: 'pen', s }; draw(); return; }
        if (tool === 'erase') { act = { type: 'erase' }; return; }
        if (['note', 'text', 'rect', 'circle'].includes(tool)) {
          const size = tool === 'note' ? [180, 160] : tool === 'text' ? [220, 50] : [160, 120];
          const it = { id: PatOS.uid(), type: tool, x: p.x - size[0] / 2, y: p.y - size[1] / 2, w: size[0], h: size[1], color: tool === 'note' ? NOTE_COLORS[B().items.length % NOTE_COLORS.length] : color, text: '' };
          B().items.push(it); sel = it; save(); draw(); tool = 'select'; syncTools();
          const tx = world.querySelector('.ff-item.on .ff-text'); if (tx) tx.focus();
          return;
        }
        sel = null; world.querySelectorAll('.ff-item.on').forEach((x) => x.classList.remove('on'));
        act = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: B().view.x, oy: B().view.y };
      });
      stage.addEventListener('pointermove', (e) => {
        if (!act) return;
        if (act.type === 'pan') { B().view.x = act.ox + e.clientX - act.sx; B().view.y = act.oy + e.clientY - act.sy; applyView(); }
        if (act.type === 'pen') { const p = toWorld(e.clientX, e.clientY); act.s.pts.push([p.x, p.y]); const el = svg.querySelector(`[data-id="${act.s.id}"]`); if (el) el.setAttribute('d', path(act.s.pts)); }
        if (act.type === 'erase') { const p = toWorld(e.clientX, e.clientY); const before = B().strokes.length; B().strokes = B().strokes.filter((s) => !s.pts.some((q) => Math.hypot(q[0] - p.x, q[1] - p.y) < 10 / B().view.z)); if (B().strokes.length !== before) draw(); }
      });
      stage.addEventListener('pointerup', () => { if (act) { act = null; save(); } });
      stage.addEventListener('wheel', (e) => {
        e.preventDefault(); const v = B().view; const r = stage.getBoundingClientRect();
        if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
          const nz = Math.min(4, Math.max(0.2, v.z * (e.deltaY < 0 ? 1.1 : 0.9))); const mx = e.clientX - r.left, my = e.clientY - r.top;
          v.x = mx - (mx - v.x) * nz / v.z; v.y = my - (my - v.y) * nz / v.z; v.z = nz; applyView(); save();
        }
      }, { passive: false });
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !e.target.isContentEditable) { B().items = B().items.filter((x) => x !== sel); sel = null; save(); draw(); } });
      bImg.onclick = () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 600 / img.width); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const p = toWorld(stage.getBoundingClientRect().left + stage.clientWidth / 2, stage.getBoundingClientRect().top + stage.clientHeight / 2); const w = Math.min(320, c.width), hh = w * c.height / c.width; B().items.push({ id: PatOS.uid(), type: 'img', x: p.x - w / 2, y: p.y - hh / 2, w, h: hh, src: c.toDataURL('image/jpeg', 0.8) }); save(); draw(); }; img.src = r.result; }; r.readAsDataURL(i.files[0]); }; i.click(); };
      bZoom.onclick = () => {
        const xs = [], ys = []; B().items.forEach((it) => { xs.push(it.x, it.x + it.w); ys.push(it.y, it.y + it.h); }); B().strokes.forEach((s) => s.pts.forEach((p) => { xs.push(p[0]); ys.push(p[1]); }));
        const v = B().view; if (!xs.length) { v.x = 0; v.y = 0; v.z = 1; applyView(); return; }
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        v.z = Math.min(2, Math.max(0.2, Math.min(stage.clientWidth / (x1 - x0 + 80), stage.clientHeight / (y1 - y0 + 80)))); v.x = stage.clientWidth / 2 - (x0 + x1) / 2 * v.z; v.y = stage.clientHeight / 2 - (y0 + y1) / 2 * v.z; applyView(); save();
      };
      bMenu.onclick = () => { const r = bMenu.getBoundingClientRect(); PatOS.menu([
        { label: 'New Board', action: async () => { const n = await PatOS.ask('Name the new board', PatOS.t('Board') + ' ' + (boards.length + 1), { icon: 'freeform', ok: 'Create' }); if (!n) return; boards.push({ id: PatOS.uid(), name: n, items: [], strokes: [], view: { x: 0, y: 0, z: 1 } }); bi = boards.length - 1; save(); syncBoards(); draw(); } },
        { label: 'Rename Board…', action: async () => { const n = await PatOS.ask('Rename board', B().name, { icon: 'freeform', ok: 'Rename' }); if (n) { B().name = n; save(); syncBoards(); } } },
        { label: 'Clear Board', action: async () => { if (await PatOS.confirmBox('Clear this board?', 'Everything on it will be removed.', { danger: true, ok: 'Clear', icon: 'freeform' })) { B().items = []; B().strokes = []; save(); draw(); } } },
        { label: 'Delete Board', disabled: boards.length < 2, action: () => { boards.splice(bi, 1); bi = 0; save(); syncBoards(); draw(); } }
      ], r.left - 150, r.bottom + 4); };
      syncTools(); syncBoards(); draw();
    }
  });
})();
