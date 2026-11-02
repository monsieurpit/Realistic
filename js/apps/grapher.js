/* Grapher — plot y = f(x): several functions, pan, zoom, trace, roots */
(function () {
  'use strict';
  const { h } = PatOS;
  const COLORS = ['#0a84ff', '#ff375f', '#32d74b', '#ff9f0a', '#bf5af2', '#64d2ff'];
  const FN = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'log', 'ln', 'exp', 'floor', 'ceil', 'round', 'pow', 'min', 'max', 'sign'];
  function compile(src) {
    let s = String(src).toLowerCase().replace(/^\s*y\s*=\s*/, '').replace(/\s+/g, '');
    if (!s) return null;
    if (/[^0-9x+\-*/^().,a-z]/.test(s)) throw new Error('bad');
    s = s.replace(/π/g, 'pi');
    s = s.replace(/(\d)(x|pi|e(?![a-z])|\(|[a-z])/g, '$1*$2').replace(/\)(\(|x|\d|[a-z])/g, ')*$1').replace(/x\(/g, 'x*(').replace(/x(\d)/g, 'x*$1');
    const words = s.match(/[a-z]+/g) || [];
    for (const w of words) if (!['x', 'pi', 'e'].includes(w) && !FN.includes(w)) throw new Error('name');
    s = s.replace(/\^/g, '**').replace(/\bln\(/g, 'L(').replace(/\blog\(/g, 'G(').replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|exp|floor|ceil|round|pow|min|max|sign)\(/g, 'Math.$1(').replace(/\bpi\b/g, 'Math.PI').replace(/\be\b/g, 'Math.E');
    const f = Function('x', 'L', 'G', '"use strict";return (' + s + ');');
    f(1, Math.log, Math.log10);
    return (x) => f(x, Math.log, Math.log10);
  }
  PatOS.registerApp({
    id: 'grapher', name: 'Grapher', icon: 'grapher', width: 980, height: 640, category: 'Utilities', keywords: 'graph math function plot calculator algebra',
    about: 'Draw graphs of math functions like y = x² or y = sin(x).',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let fns = PatOS.store.get('grapherFns', null) || [{ src: 'x^2 - 3', color: COLORS[0], on: true }, { src: '2sin(x)', color: COLORS[1], on: true }];
      let view = { cx: 0, cy: 0, scale: 50 };
      const save = () => PatOS.store.set('grapherFns', fns);
      const side = h('div', { class: 'gr-side' }), cv = h('canvas', { class: 'gr-canvas' }), readout = h('div', { class: 'gr-read' });
      const stage = h('div', { class: 'gr-stage' }, cv, readout);
      win.body.appendChild(h('div', { class: 'gr-wrap' }, side, stage));
      const bIn = h('button', { class: 'tbtn', title: 'Zoom in' }, '+'), bOut = h('button', { class: 'tbtn', title: 'Zoom out' }, '−'), bHome = h('button', { class: 'tbtn', title: 'Reset view' }, '⌂');
      const bShot = h('button', { class: 'tbtn', title: 'Save picture to Photos', html: PatOS.sym('camera') });
      win.toolbar.append(bOut, bIn, bHome, bShot);
      let mouse = null;
      function renderSide() {
        side.innerHTML = '';
        fns.forEach((f, i) => {
          let err = false; try { compile(f.src); } catch (e) { err = true; }
          const inp = h('input', { class: 'gr-in' + (err ? ' err' : ''), value: f.src, spellcheck: 'false', placeholder: 'x^2' });
          inp.oninput = () => { f.src = inp.value; let bad = false; try { compile(f.src); } catch (e) { bad = true; } inp.classList.toggle('err', bad); save(); draw(); };
          const dot = h('button', { class: 'gr-dot' + (f.on ? '' : ' off'), style: { background: f.color }, title: 'Show or hide' }); dot.onclick = () => { f.on = !f.on; save(); renderSide(); draw(); };
          side.appendChild(h('div', { class: 'gr-row' }, dot, h('span', { class: 'gr-y' }, 'y ='), inp, h('button', { class: 'tbtn', title: 'Remove', onclick: () => { fns.splice(i, 1); save(); renderSide(); draw(); } }, '×')));
        });
        side.appendChild(h('button', { class: 'btn gr-add', onclick: () => { fns.push({ src: '', color: COLORS[fns.length % COLORS.length], on: true }); save(); renderSide(); side.querySelectorAll('.gr-in')[fns.length - 1].focus(); } }, '+ ' + PatOS.t('Add Function')));
        side.appendChild(h('div', { class: 'gr-help' }, h('b', {}, PatOS.t('Examples')), ...['x^3 - 2x', 'sqrt(x)', 'sin(x)/x', '1/x', 'abs(x) - 2', 'ln(x)', '2^x', 'cos(2x) + 1'].map((ex) => h('button', { class: 'gr-ex', onclick: () => { fns.push({ src: ex, color: COLORS[fns.length % COLORS.length], on: true }); save(); renderSide(); draw(); } }, ex)),
          h('small', {}, PatOS.t('Drag to move · scroll to zoom · hover to trace'))));
      }
      function draw() {
        const dpr = Math.min(2, window.devicePixelRatio || 1), W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
        cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.scale(dpr, dpr);
        const dark = document.documentElement.dataset.theme === 'dark';
        x.fillStyle = dark ? '#16161a' : '#fff'; x.fillRect(0, 0, W, H);
        const toX = (wx) => W / 2 + (wx - view.cx) * view.scale, toY = (wy) => H / 2 - (wy - view.cy) * view.scale;
        const fromX = (px) => (px - W / 2) / view.scale + view.cx;
        const raw = 80 / view.scale, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
        x.lineWidth = 1; x.font = '11px system-ui'; x.fillStyle = dark ? '#8e8e93' : '#6b6b70';
        const x0 = Math.floor(fromX(0) / step) * step, x1 = fromX(W);
        for (let gx = x0; gx <= x1; gx += step) { x.strokeStyle = dark ? '#2a2a30' : '#ececf0'; x.beginPath(); x.moveTo(toX(gx), 0); x.lineTo(toX(gx), H); x.stroke(); if (Math.abs(gx) > step / 2) x.fillText(+gx.toPrecision(6), toX(gx) + 3, Math.min(H - 4, Math.max(12, toY(0) + 13))); }
        const y0 = Math.floor((view.cy - H / 2 / view.scale) / step) * step, y1 = view.cy + H / 2 / view.scale;
        for (let gy = y0; gy <= y1; gy += step) { x.strokeStyle = dark ? '#2a2a30' : '#ececf0'; x.beginPath(); x.moveTo(0, toY(gy)); x.lineTo(W, toY(gy)); x.stroke(); if (Math.abs(gy) > step / 2) x.fillText(+gy.toPrecision(6), Math.min(W - 30, Math.max(3, toX(0) + 4)), toY(gy) - 3); }
        x.strokeStyle = dark ? '#8e8e93' : '#3a3a3c'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, toY(0)); x.lineTo(W, toY(0)); x.moveTo(toX(0), 0); x.lineTo(toX(0), H); x.stroke();
        const traces = [];
        fns.forEach((f) => {
          if (!f.on) return; let fn; try { fn = compile(f.src); } catch (e) { return; } if (!fn) return;
          x.strokeStyle = f.color; x.lineWidth = 2.5; x.beginPath(); let pen = false, prevY = null;
          for (let px = 0; px <= W; px += 1) {
            const y = fn(fromX(px)); const py = toY(y);
            if (!isFinite(y) || (prevY != null && Math.abs(py - prevY) > H * 1.5)) { pen = false; prevY = null; continue; }
            if (!pen) { x.moveTo(px, py); pen = true; } else x.lineTo(px, py); prevY = py;
          }
          x.stroke();
          if (mouse) { const wx = fromX(mouse.x), wy = fn(wx); if (isFinite(wy)) { traces.push({ f, wx, wy }); x.fillStyle = f.color; x.beginPath(); x.arc(toX(wx), toY(wy), 5, 0, 7); x.fill(); } }
        });
        readout.innerHTML = '';
        traces.forEach((t) => readout.appendChild(h('div', {}, h('i', { style: { background: t.f.color } }), 'x = ' + (+t.wx.toFixed(3)) + '   y = ' + (+t.wy.toFixed(3)))));
        readout.style.display = traces.length ? '' : 'none';
      }
      let drag = null;
      cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; if (drag) { view.cx = drag.cx - (e.clientX - drag.x) / view.scale; view.cy = drag.cy + (e.clientY - drag.y) / view.scale; } draw(); });
      cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('pointerleave', () => { mouse = null; draw(); });
      cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2; const wx = view.cx + mx / view.scale, wy = view.cy - my / view.scale; view.scale = Math.min(5000, Math.max(2, view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); view.cx = wx - mx / view.scale; view.cy = wy + my / view.scale; draw(); }, { passive: false });
      bIn.onclick = () => { view.scale = Math.min(5000, view.scale * 1.4); draw(); }; bOut.onclick = () => { view.scale = Math.max(2, view.scale / 1.4); draw(); }; bHome.onclick = () => { view = { cx: 0, cy: 0, scale: 50 }; draw(); };
      bShot.onclick = () => { const nm = PatOS.fs.uniqueName('/Pictures', PatOS.t('Graph') + '.jpg'); PatOS.fs.write('/Pictures/' + nm, cv.toDataURL('image/jpeg', 0.9)); PatOS.notify({ title: PatOS.t('Saved to Pictures'), body: nm, icon: 'grapher' }); };
      win.on('resize', draw);
      renderSide(); setTimeout(draw, 30);
    }
  });
  PatOS.grapherCompile = compile;
})();
