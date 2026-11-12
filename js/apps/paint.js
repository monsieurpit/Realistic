/* Paint — drawing app.
   A real canvas with a size you choose (New…), zoom, 12 tools including text and shapes with fill, opacity
   that doesn't darken where strokes overlap, hold Shift for straight lines, squares and circles, rotate and
   flip, up to 50 undo steps (fewer on very big canvases), keyboard shortcuts, and it can reopen and save over
   a picture (Photos › More › Open in Paint). Transparent canvases save as PNG. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const COLORS = ['#000000', '#ffffff', '#8e8e93', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0a84ff', '#5856d6', '#af52de', '#ff2d55', '#a2845e'];
  const svg = (d, fill) => `<svg class="sym" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    line: svg('<path d="M5 19L19 5"/>'), rect: svg('<rect x="4" y="6" width="16" height="12" rx="1.5"/>'), ellipse: svg('<ellipse cx="12" cy="12" rx="8" ry="6"/>'),
    text: svg('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'), undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 0 12h-3"/>'), redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9h-9a6 6 0 0 0 0 12h3"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'), open: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    down: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'), rotate: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'), flip: svg('<path d="M12 3v18M8 7L3 12l5 5V7zM16 7l5 5-5 5V7z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'), minus: svg('<path d="M5 12h14"/>'), fit: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'), file: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
    filled: svg('<rect x="5" y="7" width="14" height="10" rx="1.5"/>', true)
  };
  const TOOLS = [['brush', 'brush', 'Brush', 'B'], ['pencil', 'pencil', 'Pencil', 'P'], ['marker', 'marker', 'Highlighter', 'M'], ['spray', 'spray', 'Spray', 'S'], ['rainbow', 'rainbow', 'Rainbow brush', 'W'], ['eraser', 'eraser', 'Eraser', 'E'],
    ['fill', 'bucket', 'Fill', 'G'], ['picker', 'drop', 'Color picker', 'I'], ['line', 'line', 'Line', 'L'], ['rect', 'rect', 'Rectangle', 'R'], ['ellipse', 'ellipse', 'Ellipse', 'O'], ['text', 'text', 'Text', 'T']];
  const SHAPES = ['line', 'rect', 'ellipse'];
  const PRESETS = [['Window size', 0, 0], ['Square 1080', 1080, 1080], ['HD 1920 × 1080', 1920, 1080], ['Poster 1200 × 1600', 1200, 1600], ['Small 600 × 400', 600, 400]];

  PatOS.registerApp({
    id: 'paint', name: 'Paint', icon: 'paint', width: 960, height: 660, keywords: 'draw sketch art brush dessin peinture',
    about: 'Draw and paint with brushes, shapes and text.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'pt-win');
      let tool = 'brush', color = '#0a84ff', size = 8, alpha = 1, fillShapes = false, zoom = 1;
      let doc = { path: null, transparent: false, dirty: false, name: '' };
      const undo = [], redo = [];
      const canvas = h('canvas', { class: 'pt-canvas' });
      const overlay = h('canvas', { class: 'pt-canvas pt-over' });
      const stack = h('div', { class: 'pt-stack' }, canvas, overlay);
      const wrap = h('div', { class: 'pt-wrap pt-ws' }, h('div', { class: 'pt-doc' }, stack));
      const tools = h('div', { class: 'pt-tools' });
      win.body.append(tools, wrap);
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); const octx = overlay.getContext('2d');

      /* ---------- the tool column ---------- */
      TOOLS.forEach(([k, ic, tt, key]) => tools.appendChild(h('button', { class: 'pt-tool', title: T(tt) + ' (' + key + ')', 'aria-label': T(tt), 'data-k': k, html: ic in ICON ? ICON[ic] : PatOS.sym(ic), onclick: () => { tool = k; sync(); } })));
      const bFill = h('button', { class: 'pt-tool pt-fillbtn', title: T('Fill shapes'), 'aria-label': T('Fill shapes'), html: ICON.filled, onclick: () => { fillShapes = !fillShapes; sync(); } });
      tools.append(bFill, h('div', { class: 'pt-sep' }));
      const swatches = h('div', { class: 'pt-sw' });
      COLORS.forEach((c) => swatches.appendChild(h('button', { class: 'pt-c', style: { background: c }, 'data-c': c, 'aria-label': c, onclick: () => { color = c; picker.value = c; sync(); } })));
      const picker = h('input', { type: 'color', value: color, class: 'pt-pick', title: T('Custom color'), 'aria-label': T('Custom color') });
      picker.oninput = () => { color = picker.value; sync(); };
      swatches.appendChild(picker); tools.appendChild(swatches);
      const sizeIn = h('input', { type: 'range', min: 1, max: 80, value: size, class: 'pt-size', title: T('Brush size') + ' ([ ])', 'aria-label': T('Brush size') });
      sizeIn.oninput = () => { size = +sizeIn.value; sync(); };
      const alphaIn = h('input', { type: 'range', min: 5, max: 100, value: 100, class: 'pt-size pt-alpha', title: T('Opacity'), 'aria-label': T('Opacity') });
      alphaIn.oninput = () => { alpha = +alphaIn.value / 100; };
      tools.append(h('div', { class: 'pt-lbl' }, T('Size')), sizeIn, h('div', { class: 'pt-lbl' }, T('Opacity')), alphaIn);

      /* ---------- the toolbar ---------- */
      const tb = (ic, title, fn) => h('button', { class: 'tbtn', title: T(title), 'aria-label': T(title), html: ICON[ic], onclick: fn });
      const bUndo = tb('undo', 'Undo', () => stepUndo()), bRedo = tb('redo', 'Redo', () => stepRedo());
      const zoomLbl = h('button', { class: 'btn pt-zoomlbl', title: T('Zoom to 100%'), onclick: () => setZoom(1) }, '100%');
      win.toolbar.append(tb('file', 'New…', () => newDoc()), tb('open', 'Open image', () => openImage()), h('div', { class: 'pt-tsep' }), bUndo, bRedo, h('div', { class: 'pt-tsep' }),
        tb('rotate', 'Rotate', () => transform('rotate')), tb('flip', 'Flip', () => transform('flip')), tb('trash', 'Clear', () => clearAll()), h('div', { style: { flex: 1 } }),
        tb('minus', 'Zoom out', () => setZoom(zoom / 1.25)), zoomLbl, tb('plus', 'Zoom in', () => setZoom(zoom * 1.25)), tb('fit', 'Fit to window', () => fit()), h('div', { class: 'pt-tsep' }),
        tb('down', 'Download PNG', () => PatOS.downloadFile((doc.name || 'drawing') + '.png', canvas.toDataURL('image/png'))), h('button', { class: 'btn primary', onclick: () => save() }, T('Save')));

      function sync() {
        [...tools.querySelectorAll('.pt-tool[data-k]')].forEach((b) => b.classList.toggle('on', b.dataset.k === tool));
        bFill.classList.toggle('on', fillShapes); bFill.style.display = SHAPES.includes(tool) ? '' : 'none';
        [...swatches.querySelectorAll('.pt-c')].forEach((b) => b.classList.toggle('on', b.dataset.c === color));
        wrap.style.cursor = tool === 'fill' || tool === 'picker' ? 'pointer' : tool === 'text' ? 'text' : 'crosshair';
        sizeIn.value = size;
        bUndo.disabled = !undo.length; bRedo.disabled = !redo.length;
      }

      /* ---------- the canvas: its size, zoom and undo ---------- */
      const maxUndo = () => Math.max(5, Math.min(50, Math.floor(150e6 / (canvas.width * canvas.height * 4))));
      function snapshot() { undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); while (undo.length > maxUndo()) undo.shift(); redo.length = 0; doc.dirty = true; sync(); }
      function stepUndo() { if (!undo.length) return; redo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); const d = undo.pop(); if (d.width !== canvas.width) resizeTo(d.width, d.height, true); ctx.putImageData(d, 0, 0); sync(); }
      function stepRedo() { if (!redo.length) return; undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); const d = redo.pop(); if (d.width !== canvas.width) resizeTo(d.width, d.height, true); ctx.putImageData(d, 0, 0); sync(); }
      function resizeTo(w, hh, keepZoom) { canvas.width = overlay.width = w; canvas.height = overlay.height = hh; if (!keepZoom) fit(); else setZoom(zoom); }
      function paintBackground() { ctx.clearRect(0, 0, canvas.width, canvas.height); if (!doc.transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); } }
      function setZoom(z) {
        zoom = Math.max(0.1, Math.min(8, z));
        const w = Math.round(canvas.width * zoom), hh = Math.round(canvas.height * zoom);
        stack.style.width = w + 'px'; stack.style.height = hh + 'px';
        zoomLbl.textContent = Math.round(zoom * 100) + '%';
      }
      function fit() { const r = wrap.getBoundingClientRect(); setZoom(Math.min(1, (r.width - 48) / canvas.width, (r.height - 48) / canvas.height) || 1); }
      function freshDoc(w, hh, transparent) {
        undo.length = 0; redo.length = 0; doc = { path: null, transparent: !!transparent, dirty: false, name: '' };
        resizeTo(w, hh); paintBackground(); sync();
      }
      function windowSize() { const r = wrap.getBoundingClientRect(); const m = PatOS.isMobile ? [200, 200] : [600, 400]; return [Math.max(m[0], Math.round(r.width - (PatOS.isMobile ? 24 : 48))), Math.max(m[1], Math.round(r.height - (PatOS.isMobile ? 24 : 48)))]; }
      async function newDoc() {
        if (doc.dirty && !(await PatOS.confirmBox(T('Start a new drawing?'), T('Your current drawing has changes you haven’t saved.'), { ok: T('Start New'), danger: true, icon: 'paint' }))) return;
        const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
        let [pw, ph] = windowSize(); let transparent = false;
        const fw = h('input', { class: 'field', type: 'number', min: 16, max: 4000, value: pw, 'aria-label': T('Width') }), fh = h('input', { class: 'field', type: 'number', min: 16, max: 4000, value: ph, 'aria-label': T('Height') });
        const presets = h('div', { class: 'pt-presets' }, ...PRESETS.map(([l, w, hh]) => h('button', { class: 'btn', onclick: () => { const s = w ? [w, hh] : windowSize(); fw.value = s[0]; fh.value = s[1]; } }, T(l))));
        const tr = h('input', { type: 'checkbox' }); tr.onchange = () => { transparent = tr.checked; };
        layer.appendChild(h('div', { class: 'dlg ce' }, h('b', {}, T('New Drawing')), presets,
          h('label', { class: 'ce-row' }, h('span', {}, T('Width')), fw), h('label', { class: 'ce-row' }, h('span', {}, T('Height')), fh), h('label', { class: 'ce-row' }, h('span', {}, T('Transparent background')), tr),
          h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: () => { const w = Math.max(16, Math.min(4000, +fw.value || pw)), hh = Math.max(16, Math.min(4000, +fh.value || ph)); freshDoc(w, hh, transparent); close(); } }, T('Create')))));
        layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); }); layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        document.body.appendChild(layer);
      }
      async function clearAll() { snapshot(); paintBackground(); }
      function transform(kind) {
        snapshot(); const w = canvas.width, hh = canvas.height; const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = hh; tmp.getContext('2d').drawImage(canvas, 0, 0);
        if (kind === 'rotate') { resizeTo(hh, w, true); ctx.save(); ctx.translate(hh, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(tmp, 0, 0); ctx.restore(); fit(); }
        else { ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.clearRect(-w, 0, w, hh); ctx.drawImage(tmp, 0, 0); ctx.restore(); }
      }

      /* ---------- drawing ---------- */
      const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; };
      let drawing = false, start = null, last = null, hueT = 0, shift = false;
      const layered = () => ['brush', 'pencil', 'marker', 'rainbow'].includes(tool) || SHAPES.includes(tool);
      const layerAlpha = () => (tool === 'marker' ? Math.min(1, alpha * 0.35) : alpha);
      function stroke(c, a, b, pressure) {
        c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
        let w = size * (pressure || 1);
        if (tool === 'pencil') { w = Math.max(1, size / 4); c.strokeStyle = color; }
        else if (tool === 'marker') { c.strokeStyle = color; w = size * 2; c.lineCap = 'square'; }
        else if (tool === 'eraser') { if (doc.transparent) c.globalCompositeOperation = 'destination-out'; c.strokeStyle = '#fff'; w = size * 2; }
        else if (tool === 'rainbow') { hueT = (hueT + 4) % 360; c.strokeStyle = `hsl(${hueT},90%,55%)`; }
        else c.strokeStyle = color;
        if (tool === 'spray') { c.globalAlpha = alpha; c.fillStyle = color; for (let i = 0; i < size * 2; i++) { const a2 = Math.random() * Math.PI * 2, r = Math.random() * size * 1.5; c.fillRect(b.x + Math.cos(a2) * r, b.y + Math.sin(a2) * r, 1.4, 1.4); } c.restore(); return; }
        c.lineWidth = w; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
      }
      function constrain(a, b) {
        if (!shift) return b; let dx = b.x - a.x, dy = b.y - a.y;
        if (tool === 'line') { const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy); return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len }; }
        const m = Math.max(Math.abs(dx), Math.abs(dy)); return { x: a.x + Math.sign(dx || 1) * m, y: a.y + Math.sign(dy || 1) * m };
      }
      function shape(c, a, b) {
        c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = Math.max(1, size / 2); c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath();
        if (tool === 'line') { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
        else { if (tool === 'rect') c.rect(a.x, a.y, b.x - a.x, b.y - a.y); else c.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2); if (fillShapes) c.fill(); else c.stroke(); }
        c.restore();
      }
      function fill(p) {
        const W = canvas.width, H = canvas.height; const x0 = Math.floor(p.x), y0 = Math.floor(p.y); if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
        const img = ctx.getImageData(0, 0, W, H); const d = img.data; const i0 = (y0 * W + x0) * 4;
        const t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
        const c = parseInt(color.slice(1), 16); const nc = [(c >> 16) & 255, (c >> 8) & 255, c & 255, Math.round(alpha * 255)];
        if (alpha === 1 && t.every((v, i) => Math.abs(v - nc[i]) < 4)) return;
        const match = (i) => Math.abs(d[i] - t[0]) < 32 && Math.abs(d[i + 1] - t[1]) < 32 && Math.abs(d[i + 2] - t[2]) < 32 && Math.abs(d[i + 3] - t[3]) < 32;
        const seen = new Uint8Array(W * H); const stack2 = [[x0, y0]];
        while (stack2.length) {
          let [x, y] = stack2.pop(); let i = (y * W + x) * 4;
          while (y >= 0 && match(i) && !seen[y * W + x]) { y--; i -= W * 4; }
          y++; i += W * 4; let l = false, r = false;
          while (y < H && match(i) && !seen[y * W + x]) {
            seen[y * W + x] = 1;
            if (alpha === 1) { d[i] = nc[0]; d[i + 1] = nc[1]; d[i + 2] = nc[2]; d[i + 3] = 255; } else { const a = alpha; d[i] = d[i] * (1 - a) + nc[0] * a; d[i + 1] = d[i + 1] * (1 - a) + nc[1] * a; d[i + 2] = d[i + 2] * (1 - a) + nc[2] * a; d[i + 3] = Math.max(d[i + 3], nc[3]); }
            if (x > 0) { if (match(i - 4) && !seen[y * W + x - 1]) { if (!l) { stack2.push([x - 1, y]); l = true; } } else l = false; }
            if (x < W - 1) { if (match(i + 4) && !seen[y * W + x + 1]) { if (!r) { stack2.push([x + 1, y]); r = true; } } else r = false; }
            y++; i += W * 4;
          }
        }
        ctx.putImageData(img, 0, 0);
      }
      async function addText(p) {
        const txt = await PatOS.ask(T('Text'), '', { icon: 'paint', ok: T('Add'), text: T('Type the text to put on the drawing.') }); if (!txt) return;
        snapshot(); const fs = Math.max(14, size * 3 + 8);
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.font = `600 ${fs}px system-ui, -apple-system, sans-serif`; ctx.textBaseline = 'top';
        txt.split('\n').forEach((line, i) => ctx.fillText(line, p.x, p.y + i * fs * 1.2)); ctx.restore();
      }
      overlay.addEventListener('pointerdown', (e) => {
        if (e.button > 0 || !e.isPrimary) return;
        const p = pos(e); shift = e.shiftKey;
        if (tool === 'picker') { const d = ctx.getImageData(Math.max(0, Math.min(canvas.width - 1, p.x | 0)), Math.max(0, Math.min(canvas.height - 1, p.y | 0)), 1, 1).data; color = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); picker.value = color; tool = 'brush'; sync(); return; }
        if (tool === 'text') { addText(p); return; }
        snapshot();
        if (tool === 'fill') { fill(p); return; }
        drawing = true; start = last = p; overlay.setPointerCapture(e.pointerId);
        overlay.style.opacity = layered() ? layerAlpha() : 1;
        if (!SHAPES.includes(tool)) stroke(layered() ? octx : ctx, p, { x: p.x + 0.01, y: p.y }, e.pointerType === 'pen' ? e.pressure * 2 : 1);
      });
      overlay.addEventListener('pointermove', (e) => {
        if (!drawing) return; const p = pos(e); shift = e.shiftKey;
        if (SHAPES.includes(tool)) { octx.clearRect(0, 0, overlay.width, overlay.height); shape(octx, start, constrain(start, p)); }
        else { stroke(layered() ? octx : ctx, last, p, e.pointerType === 'pen' ? e.pressure * 2 : 1); last = p; }
      });
      const end = (e) => {
        if (!drawing) return; drawing = false;
        if (SHAPES.includes(tool)) { octx.clearRect(0, 0, overlay.width, overlay.height); ctx.save(); ctx.globalAlpha = alpha; shape(ctx, start, constrain(start, pos(e))); ctx.restore(); }
        else if (layered()) { ctx.save(); ctx.globalAlpha = layerAlpha(); ctx.drawImage(overlay, 0, 0); ctx.restore(); octx.clearRect(0, 0, overlay.width, overlay.height); }
        overlay.style.opacity = 1;
      };
      overlay.addEventListener('pointerup', end); overlay.addEventListener('pointercancel', end);
      wrap.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });

      /* ---------- files ---------- */
      async function loadSrc(src, name, path) {
        const img = new Image(); img.onload = () => {
          const s = Math.min(1, 4000 / Math.max(img.naturalWidth, img.naturalHeight)); const w = Math.max(16, Math.round(img.naturalWidth * s)), hh = Math.max(16, Math.round(img.naturalHeight * s));
          freshDoc(w, hh, false); ctx.drawImage(img, 0, 0, w, hh); doc.path = path || null; doc.name = (name || '').replace(/\.\w+$/, ''); fit(); win.setTitle(doc.name || T('Paint'));
        };
        img.onerror = () => PatOS.notify({ title: T('Could not open the picture'), body: name || '', icon: 'paint' });
        img.src = src;
      }
      async function openPath(path) {
        const n = PatOS.fs.get(path); if (!n) return;
        const src = n.blob ? await PatOS.fs.blobURL(path) : n.content; if (src) loadSrc(src, PatOS.fs.basename(path), path);
      }
      function openImage() {
        const inp = h('input', { type: 'file', accept: 'image/*' }); inp.style.display = 'none'; document.body.appendChild(inp);
        inp.onchange = () => { const f = inp.files[0]; inp.remove(); if (!f) return; const r = new FileReader(); r.onload = () => loadSrc(r.result, f.name, null); r.readAsDataURL(f); };
        inp.click();
      }
      async function save(as) {
        let path = doc.path;
        if (!path || as) {
          const def = (doc.name || 'Drawing ' + new Date().toLocaleDateString().replace(/\//g, '-')) + (doc.transparent ? '.png' : '.png');
          const nm = await PatOS.ask(T('Save Drawing'), def, { icon: 'paint', ok: T('Save'), text: T('It is saved in Pictures. Use .png or .jpg at the end.') }); if (!nm || !nm.trim()) return false;
          const clean = nm.trim().replace(/[\\/]/g, '-'); const full = /\.(png|jpe?g)$/i.test(clean) ? clean : clean + '.png';
          path = '/Pictures/' + (PatOS.fs.exists('/Pictures/' + full) && !(await PatOS.confirmBox(T('Replace the existing file?'), full, { ok: T('Replace'), danger: true, icon: 'paint' })) ? PatOS.fs.uniqueName('/Pictures', full) : full);
        }
        const jpg = /\.jpe?g$/i.test(path); let data;
        if (jpg && doc.transparent) { const t = document.createElement('canvas'); t.width = canvas.width; t.height = canvas.height; const x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, t.width, t.height); x.drawImage(canvas, 0, 0); data = t.toDataURL('image/jpeg', 0.9); }
        else data = canvas.toDataURL(jpg ? 'image/jpeg' : 'image/png', 0.9);
        try { PatOS.fs.write(path, data); doc.path = path; doc.name = PatOS.fs.basename(path).replace(/\.\w+$/, ''); doc.dirty = false; win.setTitle(doc.name); PatOS.notify({ title: T('Saved to Pictures'), body: PatOS.fs.basename(path), icon: 'paint' }); return true; }
        catch (e) { PatOS.notify({ title: T('Could not save'), body: e.message, icon: 'paint' }); return false; }
      }

      /* ---------- keyboard ---------- */
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea')) return;
        const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
        if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? stepRedo() : stepUndo(); }
        else if (mod && k === 'y') { e.preventDefault(); stepRedo(); }
        else if (mod && k === 's') { e.preventDefault(); save(e.shiftKey); }
        else if (mod && k === 'o') { e.preventDefault(); openImage(); }
        else if (mod && k === '0') { e.preventDefault(); fit(); }
        else if (mod && (k === '=' || k === '+')) { e.preventDefault(); setZoom(zoom * 1.25); }
        else if (mod && k === '-') { e.preventDefault(); setZoom(zoom / 1.25); }
        else if (!mod && !e.altKey) {
          const t = TOOLS.find((x) => x[3].toLowerCase() === k); if (t) { tool = t[0]; sync(); }
          else if (k === '[') { size = Math.max(1, size - 2); sync(); } else if (k === ']') { size = Math.min(80, size + 2); sync(); }
        }
      });
      let closing = false;
      win.on('beforeclose', (ev) => { if (!closing && doc.dirty) { ev.cancel(); PatOS.confirmBox(T('Close without saving?'), T('Your drawing will be lost.'), { ok: T('Close'), danger: true, icon: 'paint' }).then((y) => { if (y) { closing = true; win.close(); } }); } });
      win._paint = { open: openPath, save, newDoc };
      const ro = new ResizeObserver(() => { if (!doc.dirty && !undo.length && !doc.path) { const [w, hh] = windowSize(); if (Math.abs(w - canvas.width) > 2 || Math.abs(hh - canvas.height) > 2) { resizeTo(w, hh); paintBackground(); } } });
      ro.observe(wrap); win.on('closed', () => ro.disconnect());
      sync();
      setTimeout(() => { const [w, hh] = windowSize(); freshDoc(w, hh, false); if (args && args.path) openPath(args.path); }, 30);
    },
    onArgs(win, args) { if (args && args.path && win._paint) win._paint.open(args.path); },
    menus(win) {
      const P = win._paint || {};
      return { file: [
        { label: PatOS.t('New…'), shortcut: 'Alt+N', action: () => P.newDoc && P.newDoc() },
        { label: PatOS.t('Save'), shortcut: 'Ctrl+S', action: () => P.save && P.save() },
        { label: PatOS.t('Save As…'), shortcut: 'Ctrl+Shift+S', action: () => P.save && P.save(true) },
        { divider: true },
        { label: PatOS.t('Close Window'), shortcut: 'Alt+W', action: () => win.close() }
      ] };
    }
  });
})();
