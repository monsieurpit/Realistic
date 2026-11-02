/* Paint — drawing app */
(function () {
  'use strict';
  const { h } = PatOS;
  const COLORS = ['#000000', '#ffffff', '#8e8e93', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0a84ff', '#5856d6', '#af52de', '#ff2d55', '#a2845e'];
  PatOS.registerApp({
    id: 'paint', name: 'Paint', icon: 'paint', width: 900, height: 620, keywords: 'draw sketch art brush',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let tool = 'brush', color = '#0a84ff', size = 8, alpha = 1;
      const undo = [], redo = [];
      const canvas = h('canvas', { class: 'pt-canvas' });
      const overlay = h('canvas', { class: 'pt-canvas pt-over' });
      const wrap = h('div', { class: 'pt-wrap' }, canvas, overlay);
      const tools = h('div', { class: 'pt-tools' });
      win.body.append(tools, wrap);
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); const octx = overlay.getContext('2d');
      const TOOLS = [['brush', '🖌', 'Brush'], ['pencil', '✏️', 'Pencil'], ['marker', '🖍', 'Highlighter'], ['spray', '💨', 'Spray'], ['eraser', '🧽', 'Eraser'], ['fill', '🪣', 'Fill'], ['line', '╱', 'Line'], ['rect', '▭', 'Rectangle'], ['ellipse', '◯', 'Ellipse'], ['picker', '💧', 'Color picker'], ['rainbow', '🌈', 'Rainbow brush']];
      TOOLS.forEach(([k, ic, tt]) => tools.appendChild(h('button', { class: 'pt-tool', title: tt, 'data-k': k, onclick: () => { tool = k; sync(); } }, ic)));
      tools.appendChild(h('div', { class: 'pt-sep' }));
      const swatches = h('div', { class: 'pt-sw' });
      COLORS.forEach((c) => swatches.appendChild(h('button', { class: 'pt-c', style: { background: c }, 'data-c': c, onclick: () => { color = c; picker.value = c; sync(); } })));
      const picker = h('input', { type: 'color', value: color, class: 'pt-pick', title: 'Custom color' });
      picker.oninput = () => { color = picker.value; sync(); };
      swatches.appendChild(picker); tools.appendChild(swatches);
      const sizeIn = h('input', { type: 'range', min: 1, max: 80, value: size, class: 'pt-size', title: 'Brush size' });
      sizeIn.oninput = () => { size = +sizeIn.value; };
      tools.append(h('div', { class: 'pt-lbl' }, 'Size'), sizeIn);

      const bUndo = h('button', { class: 'tbtn', title: 'Undo (Ctrl+Z)' }, '↶'); const bRedo = h('button', { class: 'tbtn', title: 'Redo' }, '↷');
      const bClear = h('button', { class: 'tbtn', title: 'Clear' }, '🗑'); const bSave = h('button', { class: 'btn primary' }, 'Save to Pictures');
      const bDl = h('button', { class: 'tbtn', title: 'Download PNG' }, '⬇'); const bOpen = h('button', { class: 'tbtn', title: 'Open image' }, '📂');
      win.toolbar.append(bUndo, bRedo, bClear, bOpen, bDl, bSave);

      function sync() {
        [...tools.querySelectorAll('.pt-tool')].forEach((b) => b.classList.toggle('on', b.dataset.k === tool));
        [...swatches.querySelectorAll('.pt-c')].forEach((b) => b.classList.toggle('on', b.dataset.c === color));
        wrap.style.cursor = tool === 'fill' || tool === 'picker' ? 'pointer' : 'crosshair';
      }
      function snapshot() { undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (undo.length > 30) undo.shift(); redo.length = 0; }
      function resize() {
        const w = wrap.clientWidth, hh = wrap.clientHeight; if (!w || !hh) return;
        if (canvas.width >= w && canvas.height >= hh) return;
        const old = canvas.width ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
        canvas.width = overlay.width = Math.max(w, canvas.width); canvas.height = overlay.height = Math.max(hh, canvas.height);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (old) ctx.putImageData(old, 0, 0);
      }
      win.on('resize', resize); setTimeout(resize, 30);
      const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      let drawing = false, start = null, last = null, hueT = 0;
      function stroke(a, b, pressure) {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        let w = size * (pressure || 1);
        if (tool === 'pencil') { w = Math.max(1, size / 4); ctx.strokeStyle = color; }
        else if (tool === 'marker') { ctx.globalAlpha = 0.3; ctx.strokeStyle = color; w = size * 2; ctx.lineCap = 'square'; }
        else if (tool === 'eraser') { ctx.strokeStyle = '#fff'; w = size * 2; }
        else if (tool === 'rainbow') { hueT = (hueT + 4) % 360; ctx.strokeStyle = `hsl(${hueT},90%,55%)`; }
        else ctx.strokeStyle = color;
        if (tool === 'spray') { ctx.fillStyle = color; for (let i = 0; i < size * 2; i++) { const a2 = Math.random() * Math.PI * 2, r = Math.random() * size * 1.5; ctx.fillRect(b.x + Math.cos(a2) * r, b.y + Math.sin(a2) * r, 1.2, 1.2); } ctx.restore(); return; }
        ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
      }
      function shape(c, a, b) {
        c.save(); c.strokeStyle = color; c.lineWidth = Math.max(1, size / 2); c.lineCap = 'round';
        c.beginPath();
        if (tool === 'line') { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
        else if (tool === 'rect') c.rect(a.x, a.y, b.x - a.x, b.y - a.y);
        else if (tool === 'ellipse') c.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
        c.stroke(); c.restore();
      }
      function fill(p) {
        const W = canvas.width, H = canvas.height; const img = ctx.getImageData(0, 0, W, H); const d = img.data;
        const x0 = Math.floor(p.x), y0 = Math.floor(p.y); const i0 = (y0 * W + x0) * 4;
        const t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
        const c = parseInt(color.slice(1), 16); const nc = [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
        if (t.every((v, i) => Math.abs(v - nc[i]) < 4)) return;
        const match = (i) => Math.abs(d[i] - t[0]) < 32 && Math.abs(d[i + 1] - t[1]) < 32 && Math.abs(d[i + 2] - t[2]) < 32 && Math.abs(d[i + 3] - t[3]) < 32;
        const stack = [[x0, y0]];
        while (stack.length) {
          let [x, y] = stack.pop(); let i = (y * W + x) * 4;
          while (y >= 0 && match(i)) { y--; i -= W * 4; }
          y++; i += W * 4; let l = false, r = false;
          while (y < H && match(i)) {
            d[i] = nc[0]; d[i + 1] = nc[1]; d[i + 2] = nc[2]; d[i + 3] = 255;
            if (x > 0) { if (match(i - 4)) { if (!l) { stack.push([x - 1, y]); l = true; } } else l = false; }
            if (x < W - 1) { if (match(i + 4)) { if (!r) { stack.push([x + 1, y]); r = true; } } else r = false; }
            y++; i += W * 4;
          }
        }
        ctx.putImageData(img, 0, 0);
      }
      overlay.addEventListener('pointerdown', (e) => {
        const p = pos(e);
        if (tool === 'picker') { const d = ctx.getImageData(p.x, p.y, 1, 1).data; color = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); picker.value = color; tool = 'brush'; sync(); return; }
        snapshot();
        if (tool === 'fill') { fill(p); return; }
        drawing = true; start = last = p; overlay.setPointerCapture(e.pointerId);
        if (!['line', 'rect', 'ellipse'].includes(tool)) stroke(p, { x: p.x + 0.01, y: p.y }, e.pressure || 1);
      });
      overlay.addEventListener('pointermove', (e) => {
        if (!drawing) return; const p = pos(e);
        if (['line', 'rect', 'ellipse'].includes(tool)) { octx.clearRect(0, 0, overlay.width, overlay.height); shape(octx, start, p); }
        else { stroke(last, p, e.pointerType === 'pen' ? e.pressure * 2 : 1); last = p; }
      });
      const end = (e) => { if (!drawing) return; drawing = false; if (['line', 'rect', 'ellipse'].includes(tool)) { octx.clearRect(0, 0, overlay.width, overlay.height); shape(ctx, start, pos(e)); } };
      overlay.addEventListener('pointerup', end); overlay.addEventListener('pointercancel', end);
      bUndo.onclick = () => { if (!undo.length) return; redo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); ctx.putImageData(undo.pop(), 0, 0); };
      bRedo.onclick = () => { if (!redo.length) return; undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); ctx.putImageData(redo.pop(), 0, 0); };
      bClear.onclick = () => { snapshot(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); };
      const exportImg = () => { const c = document.createElement('canvas'); c.width = wrap.clientWidth; c.height = wrap.clientHeight; c.getContext('2d').drawImage(canvas, 0, 0); return c.toDataURL('image/jpeg', 0.88); };
      bSave.onclick = () => { const nm = PatOS.fs.uniqueName('/Pictures', 'Drawing ' + new Date().toLocaleDateString().replace(/\//g, '-') + '.jpg'); if (PatOS.fs.write('/Pictures/' + nm, exportImg())) PatOS.notify({ title: 'Saved to Pictures', body: nm, icon: 'paint' }); };
      bDl.onclick = () => PatOS.downloadFile('drawing.png', canvas.toDataURL('image/png'));
      bOpen.onclick = () => {
        const inp = h('input', { type: 'file', accept: 'image/*' }); inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { snapshot(); const s = Math.min(canvas.width / img.width, canvas.height / img.height, 1); ctx.drawImage(img, 0, 0, img.width * s, img.height * s); }; img.src = r.result; }; r.readAsDataURL(f); }; inp.click();
      };
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'z') { e.preventDefault(); bUndo.click(); } if (e.ctrlKey && e.key === 'y') { e.preventDefault(); bRedo.click(); } });
      sync();
    }
  });
})();
