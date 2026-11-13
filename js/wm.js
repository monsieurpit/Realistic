/* PatOS window manager */
(function () {
  'use strict';
  const { h, $, clamp } = PatOS;
  const MENUBAR = 28;
  let z = 10;
  let cascade = 0;
  const wins = [];
  let active = null;

  function layer() { return $('#windows'); }
  function dockReserve() {
    if (PatOS.settings.dockAutohide) return 8;
    return (PatOS.dockBase ? PatOS.dockBase() : PatOS.settings.dockSize) + 26;
  }
  function workArea() {
    if (document.body.classList.contains('patos-fs')) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    return { x: 0, y: MENUBAR, w: window.innerWidth, h: window.innerHeight - MENUBAR - dockReserve() };
  }

  /* ---------- full screen, like macOS ----------
     The green button (or Control Center > Full Screen) fills the whole screen and hides the menu bar
     and the Dock. Rest the pointer at the top or bottom edge for a second to bring them back. */
  let weAskedBrowserFS = false;
  function updateFS() {
    // like macOS: only an app in full screen hides the bars (green button, or a zoomed window while the browser is full screen)
    const on = !PatOS.isMobile && (wins.some((w) => w.fullscreen && !w.minimized) || (!!document.fullscreenElement && !!active && active.maximized && !active.minimized));
    const was = document.body.classList.contains('patos-fs');
    document.body.classList.toggle('patos-fs', on);
    if (!on) document.body.classList.remove('reveal-top', 'reveal-bottom');
    if (was !== on) { window.dispatchEvent(new Event('resize')); PatOS.emit('wm:fullscreen', on); }
  }
  function setFullscreen(win, on) {
    if (!!win.fullscreen === on) return;
    if (on) {
      if (!win.maximized) win.prevRect = win.rect();
      win.fullscreen = true; win.el.classList.add('fullscreen');
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) { weAskedBrowserFS = true; document.documentElement.requestFullscreen().catch(() => { weAskedBrowserFS = false; }); }
      updateFS();
      animateTo(win, { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
      focusWindow(win);
    } else {
      win.fullscreen = false; win.el.classList.remove('fullscreen');
      if (!wins.some((w) => w.fullscreen) && weAskedBrowserFS && document.fullscreenElement) { weAskedBrowserFS = false; document.exitFullscreen().catch(() => {}); }
      updateFS();
      if (win.maximized) { const a = workArea(); animateTo(win, { x: 0, y: a.y, w: a.w, h: a.h }); } else if (win.prevRect) animateTo(win, win.prevRect);
    }
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) { weAskedBrowserFS = false; wins.filter((w) => w.fullscreen).forEach((w) => setFullscreen(w, false)); }
    updateFS();
  });
  let revealT = null, revealing = null;
  document.addEventListener('pointermove', (e) => {
    const b = document.body;
    if (!b.classList.contains('patos-fs') || e.pointerType === 'touch') return;
    const atTop = e.clientY <= 3, atBottom = e.clientY >= window.innerHeight - 3;
    const edge = atTop ? 'top' : atBottom ? 'bottom' : null;
    if (edge && revealing !== edge && !b.classList.contains('reveal-' + edge)) {
      clearTimeout(revealT); revealing = edge;
      revealT = setTimeout(() => { b.classList.add('reveal-' + edge); revealing = null; }, 1000);
    } else if (!edge) { clearTimeout(revealT); revealing = null; }
    // hide again once the pointer leaves the bar (and no menu is open)
    if (b.classList.contains('reveal-top') && e.clientY > 40 && !e.target.closest('#menubar, .menu, .ctx-menu, #control-center, #notif-center') && !document.querySelector('#menubar .open, .menu.open')) b.classList.remove('reveal-top');
    if (b.classList.contains('reveal-bottom') && !e.target.closest('#dock-wrap, .menu, .ctx-menu') && e.clientY < window.innerHeight - ((PatOS.dockBase ? PatOS.dockBase() : PatOS.settings.dockSize) + 40)) b.classList.remove('reveal-bottom');
  });
  document.addEventListener('pointerleave', () => { clearTimeout(revealT); revealing = null; });

  function createWindow(app, args) {
    const id = 'w' + PatOS.uid();
    const area = workArea();
    let w = Math.min(app.width, area.w - 20);
    let ht = Math.min(app.height, area.h - 10);
    const off = (cascade++ % 8) * 26;
    let x = Math.round((area.w - w) / 2 + off - 80);
    let y = Math.round(area.y + Math.max(8, (area.h - ht) / 2 - 30) + off * 0.6);
    x = clamp(x, 4, Math.max(4, area.w - w - 4));
    y = clamp(y, area.y + 2, Math.max(area.y + 2, area.y + area.h - ht));

    const el = h('div', { role: 'dialog', 'aria-label': app.name, class: 'window opening' + (app.titlebar === 'hidden' ? ' tb-hidden' : '') + (app.dark ? ' force-dark' : ''), 'data-app': app.id, id });
    const traffic = h('div', { class: 'traffic' },
      h('button', { class: 'tl close', title: 'Close (Alt+W)', 'aria-label': 'Close' }),
      h('button', { class: 'tl min', title: 'Minimize (Alt+M)', 'aria-label': 'Minimize' }),
      h('button', { class: 'tl max', title: 'Zoom', 'aria-label': 'Zoom', disabled: app.resizable === false })
    );
    const titleEl = h('div', { class: 'win-title' }, app.name);
    const toolbar = h('div', { class: 'win-toolbar' });
    const titlebar = h('div', { class: 'titlebar' }, traffic, titleEl, toolbar);
    const body = h('div', { class: 'win-body' });
    el.append(titlebar, body);
    if (app.resizable !== false) ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((d) => el.appendChild(h('div', { class: 'rz rz-' + d, 'data-dir': d })));
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: ht + 'px' });

    const handlers = {};
    // (3.3) the app's process: its code runs inside it, so PatOS can measure it and stop it (js/process.js)
    const proc = PatOS.proc ? PatOS.proc.forApp(app) : null;
    const inProc = (fn, args) => (proc ? PatOS.proc.run(proc, fn, null, args || []) : fn.apply(null, args || []));
    const win = {
      id, app, el, body, titlebar, toolbar, titleEl, args: args || {},
      minimized: false, maximized: false, prevRect: null,
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return () => { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); }; },
      emit(ev, d) { (handlers[ev] || []).slice().forEach((f) => { try { inProc(f, [d]); } catch (e) { console.error(e); PatOS.errors && PatOS.errors.report(e, app.id + ' ' + ev); } }); },
      setTitle(t) { titleEl.textContent = t; win.title = t; el.setAttribute('aria-label', t); PatOS.emit('wm:title', win); },
      close: () => closeWindow(win),
      minimize: () => minimizeWindow(win),
      toggleMax: () => toggleMax(win),
      toggleFullscreen: () => setFullscreen(win, !win.fullscreen),
      focus: () => focusWindow(win),
      rect() { return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }; }
    };
    win.title = app.name; win.pid = proc ? proc.pid : 0; if (proc) proc.windows.add(win);
    const sysRun = (fn) => (PatOS.proc ? PatOS.proc.sys('windowserver', fn) : fn());
    sysRun(() => { // (the title bar, its buttons, moving and resizing: the window server's work, not the app's)

    traffic.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); win.close(); });
    traffic.querySelector('.min').addEventListener('click', (e) => { e.stopPropagation(); win.minimize(); });
    traffic.querySelector('.max').addEventListener('click', (e) => { e.stopPropagation(); if (app.resizable === false) return; if (e.altKey || PatOS.isMobile) win.toggleMax(); else win.toggleFullscreen(); });
    traffic.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('pointerdown', () => focusWindow(win), true);
    titlebar.addEventListener('dblclick', (e) => { if (e.target.closest('.win-toolbar button, input, select')) return; if (app.resizable !== false) win.toggleMax(); });
    setupDrag(win, titlebar);
    setupResize(win);
    if (app.titlebar === 'hidden') setupDrag(win, body, true);
    });

    layer().appendChild(el);
    wins.push(win);
    focusWindow(win);
    openAnim(win);

    // an app that fails to start (right away, or later if it starts asynchronously) shows why and offers to try again,
    // instead of an empty window; the failure is written down (PatOS.errors)
    const failed = (e) => {
      console.error(e); if (PatOS.errors) PatOS.errors.report(e, app.id + ' start');
      if (!wins.includes(win)) return;
      const T = (x) => (PatOS.t ? PatOS.t(x) : x);
      body.innerHTML = '';
      const box = document.createElement('div'); box.className = 'app-error'; box.setAttribute('role', 'alert');
      box.innerHTML = T('This app ran into a problem.') + '<br><small>' + PatOS.esc((e && e.message) || String(e)) + '</small>';
      const again = document.createElement('button'); again.className = 'btn primary'; again.textContent = T('Try Again');
      again.onclick = () => { const a = win.args; win.close(); setTimeout(() => PatOS.launch(app.id, a), 220); };
      box.appendChild(document.createElement('br')); box.appendChild(again); body.appendChild(box);
    };
    const run = () => {
      try { const r = inProc(() => app.launch(win, win.args)); if (r && typeof r.then === 'function') r.then(null, failed); } catch (e) { failed(e); }
    };
    // 3D apps wait for three.js, which PatOS only loads when it is needed
    if (app.needs3D && !window.THREE && PatOS.webgl) {
      const wait = document.createElement('div'); wait.className = 'app-loading'; wait.innerHTML = '<div class="spinner"></div>'; body.appendChild(wait);
      PatOS.load3D().then(() => { wait.remove(); if (wins.includes(win)) run(); }, (e) => { wait.remove(); failed(e || new Error('3D could not load')); });
    } else run();
    const ro = new ResizeObserver(() => win.emit('resize', win.rect()));
    ro.observe(body);
    win.on('closed', () => ro.disconnect());
    PatOS.emit('wm:open', win);
    return win;
  }

  /* ---------- springs: one physical motion for the whole system ----------
     A damped spring (stiffness k, damping c, mass 1) is simulated once and turned into a native linear() easing curve, so
     windows, menus, panels and sheets all settle the same way. Settings › Appearance › Motion: Calm (no overshoot), Natural
     (a hint of settle) or Playful (bouncier). Browsers without linear() get a close cubic-bezier. */
  const SPRINGS = { calm: [190, 28], natural: [230, 21], playful: [270, 14] };
  const linearOK = (() => { try { return CSS.supports('animation-timing-function', 'linear(0, 1)'); } catch (e) { return false; } })();
  function springCurve(k, c) {
    let x = 0, v = 0, t = 0; const dt = 1 / 240, pts = [];
    while (t < 2) { const a = -k * (x - 1) - c * v; v += a * dt; x += v * dt; t += dt; pts.push([t, x]); if (t > .2 && Math.abs(x - 1) < .0015 && Math.abs(v) < .02) break; }
    const dur = Math.round(t * 1000), step = Math.max(1, Math.floor(pts.length / 44));
    const list = ['0']; for (let i = step; i < pts.length; i += step) list.push(pts[i][1].toFixed(4) + ' ' + (pts[i][0] / t * 100).toFixed(1) + '%'); list.push('1');
    return { easing: linearOK ? 'linear(' + list.join(', ') + ')' : 'cubic-bezier(.2,.95,.25,1.08)', dur: Math.min(900, Math.max(320, dur)) };
  }
  const motion = { calm: null, natural: null, playful: null };
  PatOS.motion = {
    get() { const m = PatOS.settings.motion in SPRINGS ? PatOS.settings.motion : 'natural'; return motion[m] || (motion[m] = springCurve(...SPRINGS[m])); },
    apply() { const m = PatOS.motion.get(), r = document.documentElement.style; r.setProperty('--spring', m.easing); r.setProperty('--spring-dur', m.dur + 'ms'); r.setProperty('--spring-dur-short', Math.min(400, Math.round(m.dur * .6)) + 'ms'); }
  };
  PatOS.motion.apply(); PatOS.on('setting:motion', () => PatOS.motion.apply());

  /* zoom the window out of the icon that launched it (dock, Launchpad, home screen) */
  const motionOK = () => !PatOS.settings.reduceMotion && el0().animate;
  const el0 = () => document.body;
  function rectTransform(from, to) {
    const s = Math.max(0.04, Math.min(from.width / to.width, from.height / to.height));
    return `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${s})`;
  }
  function openAnim(win) {
    const el = win.el;
    const src = PatOS._launchRect && Date.now() - PatOS._launchRect.t < 900 ? PatOS._launchRect : null;
    PatOS._launchRect = null;
    if (!motionOK()) { el.classList.remove('opening'); return; }
    el.classList.remove('opening');
    const r = el.getBoundingClientRect();
    const frames = src
      ? [{ transform: rectTransform(src, r), opacity: 0.2, borderRadius: '40px' }, { transform: 'none', opacity: 1, borderRadius: PatOS.isMobile ? '0px' : '12px' }]
      : [{ transform: 'scale(.9) translateY(14px)', opacity: 0, filter: 'blur(6px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }];
    const sp = PatOS.motion.get(); el.animate(frames, { duration: src ? sp.dur : Math.round(sp.dur * .75), easing: sp.easing });
  }
  PatOS.rectTransform = rectTransform;

  /* Snap layouts: the picker that opens at the top while a window is dragged there. Each zone is a rectangle as a fraction of
     the work area ({x, y, w, h}); dropping the window on a zone gives it exactly that place. */
  const LAYOUTS = [
    [[0, 0, .5, 1], [.5, 0, .5, 1]],
    [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
    [[0, 0, 2 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
    [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]],
    [[0, 0, 1, 1]]
  ];
  let pickerEl = null;
  function picker() {
    if (pickerEl && pickerEl.isConnected) return pickerEl;
    pickerEl = h('div', { id: 'snap-picker', 'aria-hidden': 'true' });
    LAYOUTS.forEach((cells) => {
      const box = h('div', { class: 'sl-box' });
      cells.forEach(([x, y, w, hh]) => box.appendChild(h('div', { class: 'sl-cell', 'data-r': JSON.stringify({ x, y, w, h: hh }), style: { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: hh * 100 + '%' } })));
      pickerEl.appendChild(box);
    });
    document.getElementById('desktop').appendChild(pickerEl);
    return pickerEl;
  }
  const zoneRect = (z) => { const a = workArea(); return { x: Math.round(a.w * z.x), y: Math.round(a.y + a.h * z.y), w: Math.round(a.w * z.w), h: Math.round(a.h * z.h) }; };
  PatOS.snapLayouts = LAYOUTS;

  function setupDrag(win, handle, bodyMode) {
    let sx, sy, ox, oy, dragging = false, snap = null, pid = null, zone = null, base = null, last = null, ghost = null, samples = [], tabInto = null;
    const P = () => PatOS.wmPro;
    const preview = () => $('#snap-preview') || layer().appendChild(h('div', { id: 'snap-preview' }));
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || PatOS.isMobile) return;
      if (bodyMode && e.target.closest('button, input, textarea, select, canvas, a, [contenteditable], .no-drag, .calc-keys, .scrub')) return;
      if (!bodyMode && e.target.closest('.win-toolbar button, .win-toolbar input, .win-toolbar select, .win-toolbar .tab, .win-toolbar .no-drag')) return;
      sx = e.clientX; sy = e.clientY; ox = win.el.offsetLeft; oy = win.el.offsetTop; dragging = false; pid = e.pointerId; samples = []; tabInto = null;
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!dragging && Math.hypot(dx, dy) < 4) return;
        if (!dragging) {
          dragging = true; layer().classList.add('dragging'); win.el.classList.add('moving');
          if (win.maximized) {
            const pr = win.prevRect || { w: 700, h: 480 };
            const ratio = (sx - ox) / win.el.offsetWidth;
            win.maximized = false; win.el.classList.remove('maximized');
            win.el.style.width = pr.w + 'px'; win.el.style.height = pr.h + 'px';
            ox = sx - pr.w * ratio; oy = MENUBAR;
          }
        }
        let nx = ox + dx, ny = Math.max(MENUBAR, oy + dy);
        ny = Math.min(ny, window.innerHeight - 40);
        samples.push({ x: ev.clientX, y: ev.clientY, t: performance.now() }); if (samples.length > 8) samples.shift();
        // (2.0) magnetic edges: it clicks to the screen's edges and the windows around it (Shift: place it freely)
        if (P() && ev.clientY >= MENUBAR + 110 && ev.clientX > 3 && ev.clientX < window.innerWidth - 3) { const m = P().magnet(win, { x: nx, y: ny, w: win.el.offsetWidth, h: win.el.offsetHeight }, 'move', ev); nx = m.x; ny = m.y; } else if (P()) P().clearGuides();
        tabInto = P() ? P().tabTarget(win, ev) : null;
        // (moved with translate while dragging: the graphics chip slides the window as it is. Setting left and top on every
        //  move made the browser lay it out and redraw it each frame; they're set once when the drag ends.)
        if (base === null) {
          base = { x: win.el.offsetLeft, y: win.el.offsetTop };
          // the window's shadow travels on its own layer during the drag: drawn on the window, the browser paints it into the
          // desktop under it, so every move redrew the wallpaper and widgets there (most of a drag's cost)
          const cs = getComputedStyle(win.el);
          ghost = h('div', { class: 'win-ghost-shadow' }); Object.assign(ghost.style, { left: base.x + 'px', top: base.y + 'px', width: win.el.offsetWidth + 'px', height: win.el.offsetHeight + 'px', borderRadius: cs.borderTopLeftRadius, boxShadow: cs.boxShadow, zIndex: String((parseInt(cs.zIndex, 10) || 1) - 1) });
          win.el.parentNode.insertBefore(ghost, win.el); win.el.classList.add('shadow-out');
        }
        last = { x: nx, y: ny }; win.el.style.translate = (nx - base.x) + 'px ' + (ny - base.y) + 'px'; if (ghost) ghost.style.translate = win.el.style.translate;
        const area = workArea(); const p = preview();
        snap = ev.clientX <= 3 ? 'left' : ev.clientX >= window.innerWidth - 3 ? 'right' : ev.clientY <= MENUBAR + 1 ? 'max' : null;
        // near the top, the layout picker opens; pointing at one of its zones previews exactly where the window will go
        zone = null;
        if (win.app.resizable !== false && ev.clientY < MENUBAR + 110) {
          const pk = picker(); pk.classList.add('show');
          const hit = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.classList && n.classList.contains('sl-cell'));
          pk.querySelectorAll('.sl-cell.on').forEach((c) => c !== hit && c.classList.remove('on'));
          if (hit) { hit.classList.add('on'); zone = JSON.parse(hit.dataset.r); snap = null; }
        } else if (pickerEl) pickerEl.classList.remove('show');
        if (zone) {
          const r = zoneRect(zone);
          Object.assign(p.style, { left: r.x + 6 + 'px', top: r.y + 6 + 'px', width: r.w - 12 + 'px', height: r.h - 12 + 'px' }); p.classList.add('show');
        } else if (snap) {
          const r = snap === 'left' ? { x: 0, w: area.w / 2 } : snap === 'right' ? { x: area.w / 2, w: area.w / 2 } : { x: 0, w: area.w };
          Object.assign(p.style, { left: r.x + 6 + 'px', top: area.y + 6 + 'px', width: r.w - 12 + 'px', height: area.h - 12 + 'px' });
          p.classList.add('show');
        } else p.classList.remove('show');
      };
      const up = () => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
        if (last) { win.el.style.translate = ''; win.el.style.left = last.x + 'px'; win.el.style.top = last.y + 'px'; } base = null; last = null;
        if (ghost) { const g0 = ghost; ghost = null; win.el.style.transition = 'none'; win.el.classList.remove('shadow-out'); void win.el.offsetWidth; g0.remove(); requestAnimationFrame(() => { win.el.style.transition = ''; }); }
        try { handle.releasePointerCapture(pid); } catch (er) {}
        layer().classList.remove('dragging'); win.el.classList.remove('moving');
        preview().classList.remove('show'); if (pickerEl) pickerEl.classList.remove('show');
        if (P()) { P().clearGuides(); P().endTabTarget(); }
        if (dragging && tabInto) { const into = tabInto; tabInto = null; dragging = false; snap = null; zone = null; P().merge(win, into); return; }
        if (dragging && !snap && !zone && P() && win.app.resizable !== false) { const f = P().flick(samples); if (f) snap = f; }
        if (dragging && zone) { win.prevRect = { x: ox, y: oy, w: win.el.offsetWidth, h: win.el.offsetHeight }; animateTo(win, zoneRect(zone)); zone = null; dragging = false; snap = null; return; }
        if (dragging && snap && win.app.resizable !== false) {
          const area = workArea();
          if (snap === 'max') { win.prevRect = { x: ox, y: oy, w: win.el.offsetWidth, h: win.el.offsetHeight }; setMax(win, true); }
          else {
            win.prevRect = { x: ox, y: oy, w: win.el.offsetWidth, h: win.el.offsetHeight };
            animateTo(win, { x: snap === 'left' ? 0 : area.w / 2, y: area.y, w: area.w / 2, h: area.h });
          }
        }
        dragging = false; snap = null;
      };
      handle.setPointerCapture(e.pointerId);
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
    });
  }

  function setupResize(win) {
    win.el.querySelectorAll('.rz').forEach((hd) => {
      hd.addEventListener('pointerdown', (e) => {
        if (PatOS.isMobile) return;
        e.preventDefault(); e.stopPropagation();
        const dir = hd.dataset.dir; const r = win.rect(); const sx = e.clientX, sy = e.clientY;
        const minW = win.app.minWidth, minH = win.app.minHeight;
        hd.setPointerCapture(e.pointerId); layer().classList.add('dragging');
        if (win.maximized) { win.maximized = false; win.el.classList.remove('maximized'); }
        const move = (ev) => {
          const dx = ev.clientX - sx, dy = ev.clientY - sy; let { x, y, w, h: ht } = r;
          if (dir.includes('e')) w = Math.max(minW, r.w + dx);
          if (dir.includes('s')) ht = Math.max(minH, r.h + dy);
          if (dir.includes('w')) { w = Math.max(minW, r.w - dx); x = r.x + r.w - w; }
          if (dir.includes('n')) { ht = Math.max(minH, r.h - dy); y = r.y + r.h - ht; if (y < MENUBAR) { ht -= MENUBAR - y; y = MENUBAR; } }
          if (PatOS.wmPro) ({ x, y, w, h: ht } = PatOS.wmPro.magnet(win, { x, y, w, h: ht }, dir, ev));
          Object.assign(win.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: ht + 'px' });
        };
        const up = () => { hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); layer().classList.remove('dragging'); if (PatOS.wmPro) PatOS.wmPro.clearGuides(); };
        hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up);
      });
    });
  }

  function animateTo(win, r) {
    win.el.classList.add('animating');
    Object.assign(win.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    clearTimeout(win._animT); win._animT = setTimeout(() => win.el.classList.remove('animating'), Math.min(400, Math.round(PatOS.motion.get().dur * .6)) + 20);
  }
  function setMax(win, on) {
    win.maximized = on;
    win.el.classList.toggle('maximized', on);
    setTimeout(updateFS, 0);
    if (on) { const a = workArea(); animateTo(win, { x: 0, y: a.y, w: a.w, h: a.h }); }
    else if (win.prevRect) animateTo(win, win.prevRect);
  }
  function toggleMax(win) {
    if (!win.maximized) win.prevRect = win.rect();
    setMax(win, !win.maximized);
  }

  function focusWindow(win) {
    if (!win || win.minimized || win.closed) return; // (a window that is closing never takes focus back)
    if (active === win) { if (+win.el.style.zIndex !== z) win.el.style.zIndex = ++z; return; }
    if (active) { active.el.classList.remove('active'); active.emit('blur'); }
    active = win;
    win.el.style.zIndex = ++z;
    win.el.classList.add('active');
    win.emit('focus');
    setTimeout(updateFS, 0);
    PatOS.emit('wm:focus', win);
  }
  function blurAll() {
    if (active) { active.el.classList.remove('active'); active.emit('blur'); }
    active = null; PatOS.emit('wm:focus', null); setTimeout(updateFS, 0);
  }

  function closeWindow(win) {
    if (win.closed) return; // (closing twice, e.g. a double tap, must not run every cleanup twice)
    let veto = false;
    if (!win._force) win.emit('beforeclose', { cancel: () => { veto = true; } }); // (Force Quit doesn't ask)
    if (veto) return;
    if (motionOK()) win.el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.92)', opacity: 0, filter: 'blur(4px)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    else win.el.classList.add('closing');
    win.el.style.pointerEvents = 'none';
    win.closed = true;
    win.emit('closed');
    if (PatOS.proc && win.pid) { const pr = PatOS.proc._raw(win.pid); if (pr) PatOS.proc.windowClosed(pr, win); }
    const i = wins.indexOf(win); if (i >= 0) wins.splice(i, 1);
    if (win.fullscreen) { win.fullscreen = false; if (!wins.some((w) => w.fullscreen) && weAskedBrowserFS && document.fullscreenElement) { weAskedBrowserFS = false; document.exitFullscreen().catch(() => {}); } }
    updateFS();
    setTimeout(() => win.el.remove(), 210);
    if (active === win) {
      active = null;
      const next = wins.filter((w) => !w.minimized).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
      if (next) focusWindow(next); else PatOS.emit('wm:focus', null);
    }
    PatOS.emit('wm:close', win);
  }

  function genieFrames(r, target, reverse) {
    const dx = target.left + target.width / 2 - (r.left + r.width / 2);
    const dy = target.top + target.height / 2 - (r.top + r.height / 2);
    const s = Math.max(0.04, target.width / r.width);
    const f = [
      { transform: 'none', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.25}px, ${dy * 0.35}px) scale(${0.85}, ${0.7}) skewX(${dx > 0 ? -10 : 10}deg)`, opacity: 0.95, offset: 0.4 },
      { transform: `translate(${dx * 0.8}px, ${dy * 0.85}px) scale(${s * 1.6}, ${s * 2.2}) skewX(${dx > 0 ? -4 : 4}deg)`, opacity: 0.6, offset: 0.8 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0, offset: 1 }
    ];
    return reverse ? f.reverse().map((k, i, a) => Object.assign({}, k, { offset: 1 - k.offset })) : f;
  }
  function minimizeWindow(win) {
    setTimeout(updateFS, 0);
    if (win.minimized) return;
    if (PatOS.isMobile && PatOS.mobile) return PatOS.mobile.home(win);
    const target = PatOS.dock && PatOS.dock.iconRect(win.app.id);
    const r = win.el.getBoundingClientRect();
    win.minimized = true;
    if (target && motionOK()) {
      win.el.style.transformOrigin = 'center bottom';
      win.el.animate(genieFrames(r, target), { duration: 560, easing: 'cubic-bezier(.55,.05,.4,1)' }).onfinish = () => { if (win.minimized) win.el.style.display = 'none'; win.el.style.transformOrigin = ''; };
    } else win.el.style.display = 'none';
    win.emit('minimize');
    if (active === win) {
      active = null;
      const next = wins.filter((w) => !w.minimized).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
      if (next) focusWindow(next); else PatOS.emit('wm:focus', null);
    }
    PatOS.emit('wm:minimize', win);
  }
  function restoreWindow(win) {
    if (win.tabHidden && PatOS.wmPro) return PatOS.wmPro.showTab(win); // (a tab that isn't shown: show that tab)
    setTimeout(updateFS, 0);
    if (PatOS.isMobile && PatOS.mobile) return PatOS.mobile.show(win);
    if (!win.minimized) return focusWindow(win);
    win.minimized = false;
    win.el.style.display = '';
    const target = PatOS.dock && PatOS.dock.iconRect(win.app.id);
    if (target && motionOK()) {
      win.el.style.transformOrigin = 'center bottom';
      win.el.animate(genieFrames(win.el.getBoundingClientRect(), target, true), { duration: PatOS.motion.get().dur, easing: PatOS.motion.get().easing }).onfinish = () => { win.el.style.transformOrigin = ''; };
    }
    focusWindow(win);
    win.emit('restore');
    PatOS.emit('wm:minimize', win);
  }

  /* public API */
  PatOS.wm = {
    /* (3.3) put a window on the left or right half of the screen, the same as dragging it to that edge */
    snap(win, side) { if (!win || PatOS.isMobile) return; const a = workArea(); win.prevRect = { x: win.el.offsetLeft, y: win.el.offsetTop, w: win.el.offsetWidth, h: win.el.offsetHeight }; if (win.maximized) { win.maximized = false; win.el.classList.remove('maximized'); } animateTo(win, { x: side === 'right' ? a.w / 2 : 0, y: a.y, w: a.w / 2, h: a.h }); },
    windows: wins,
    get active() { return active; },
    workArea,
    focus: focusWindow,
    restore: restoreWindow,
    blurAll,
    windowsOf: (appId) => wins.filter((w) => w.app.id === appId),
    isRunning: (appId) => wins.some((w) => w.app.id === appId),
    quit(appId) { wins.filter((w) => w.app.id === appId).forEach((w) => w.close()); },
    closeAll() { wins.slice().forEach((w) => w.close()); },
    setFullscreen,
    updateFS,
    groups: {
      /* Window groups: the open windows (their apps and places) saved under a name, reopened together in one click */
      list: () => PatOS.store.get('windowGroups', []),
      save(name) {
        const ws = wins.filter((w) => !w.minimized).map((w) => ({ app: w.app.id, r: w.maximized ? 'max' : w.rect() }));
        if (!name || !ws.length) return false;
        const all = PatOS.store.get('windowGroups', []).filter((g) => g.name !== name);
        all.push({ name, ws, at: Date.now() }); PatOS.store.set('windowGroups', all); return true;
      },
      open(name) {
        const g = PatOS.store.get('windowGroups', []).find((x) => x.name === name); if (!g) return 0;
        let n = 0;
        g.ws.forEach((it) => {
          if (!PatOS.apps[it.app]) return;
          const w = PatOS.launch(it.app); if (!w || !w.el) return; n++;
          if (it.r === 'max') { w.prevRect = w.rect(); setMax(w, true); }
          else { const a = workArea(); Object.assign(w.el.style, { left: Math.max(0, Math.min(it.r.x, a.w - 80)) + 'px', top: Math.max(a.y, it.r.y) + 'px', width: it.r.w + 'px', height: it.r.h + 'px' }); }
        });
        return n;
      },
      remove(name) { PatOS.store.set('windowGroups', PatOS.store.get('windowGroups', []).filter((g) => g.name !== name)); }
    },
    stage: (on) => stage(on),
    get staged() { return staging; }
  };

  /* Stage focus: the window you are using sits large in the middle; the others wait as live thumbnails down the left side.
     Clicking a thumbnail puts it on stage. Windows go back to where they were when Stage focus is turned off. */
  let staging = false;
  const homes = new Map();
  function stageLayout() {
    if (!staging) return;
    const a = workArea(), side = Math.min(200, Math.max(140, a.w * .14)), gap = 18;
    const open = wins.filter((w) => !w.minimized && !w.fullscreen);
    const main = (active && open.includes(active)) ? active : open[open.length - 1];
    let slot = 0;
    open.forEach((w) => {
      if (!homes.has(w)) homes.set(w, { r: w.rect(), max: w.maximized });
      if (w.maximized) { w.maximized = false; w.el.classList.remove('maximized'); }
      w.el.classList.add('animating');
      if (w === main) {
        w.el.classList.remove('stage-thumb'); w.el.style.transform = '';
        Object.assign(w.el.style, { left: side + gap * 2 + 'px', top: a.y + gap + 'px', width: a.w - side - gap * 3 + 'px', height: a.h - gap * 2 + 'px' });
      } else {
        const r = homes.get(w).r, sc = side / Math.max(1, r.w), th = r.h * sc;
        w.el.classList.add('stage-thumb');
        Object.assign(w.el.style, { left: gap + 'px', top: a.y + gap + slot + 'px', width: r.w + 'px', height: r.h + 'px', transformOrigin: '0 0', transform: `scale(${sc.toFixed(3)})` });
        slot += th + 26;
      }
      setTimeout(() => w.el.classList.remove('animating'), 320);
    });
  }
  function stage(on) {
    on = on == null ? !staging : !!on; if (PatOS.isMobile) on = false;
    if (on === staging) return staging;
    staging = on; document.body.classList.toggle('stage-on', on);
    if (on) stageLayout();
    else {
      homes.forEach((home, w) => {
        if (!wins.includes(w)) return;
        w.el.classList.add('animating'); w.el.classList.remove('stage-thumb'); w.el.style.transform = ''; w.el.style.transformOrigin = '';
        Object.assign(w.el.style, { left: home.r.x + 'px', top: home.r.y + 'px', width: home.r.w + 'px', height: home.r.h + 'px' });
        if (home.max) setMax(w, true);
        setTimeout(() => w.el.classList.remove('animating'), 320);
      });
      homes.clear();
    }
    PatOS.emit('wm:stage', staging); return staging;
  }
  PatOS.on('wm:focus', () => staging && setTimeout(stageLayout, 0));
  ['wm:minimize', 'wm:close', 'app:launch'].forEach((ev) => PatOS.on(ev, () => staging && setTimeout(stageLayout, 60)));
  window.addEventListener('resize', PatOS.debounce(() => staging && stageLayout(), 150));

  PatOS.launch = function (appId, args) {
    let app = PatOS.apps[appId];
    if (!app) { PatOS.notify && PatOS.notify({ title: 'App not found', body: appId }); return null; }
    if (app.lazy) { // an app whose code has not been read yet: read it now (js/appmeta.js)
      if (!PatOS.loadLazy(app.lazy)) return null;
      app = PatOS.apps[appId]; if (!app || app.lazy) { PatOS.notify && PatOS.notify({ title: 'App not found', body: appId }); return null; }
    }
    if (app.action) { app.action(args || {}); PatOS.emit('app:launch', appId); return null; }
    const existing = PatOS.wm.windowsOf(appId);
    if (app.single && existing.length) {
      const w = existing[0];
      restoreWindow(w);
      if (args && app.onArgs) { const pr = PatOS.proc && PatOS.proc.forApp(app); if (pr) PatOS.proc.run(pr, app.onArgs, app, [w, args]); else app.onArgs(w, args); }
      return w;
    }
    if (!existing.length && PatOS.dock) PatOS.dock.bounce(appId);
    PatOS.emit('app:launch', appId);
    return createWindow(app, args);
  };

  window.addEventListener('resize', PatOS.debounce(() => {
    const a = workArea();
    wins.forEach((w) => {
      if (w.fullscreen) { Object.assign(w.el.style, { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px' }); return; }
      if (w.maximized) { Object.assign(w.el.style, { left: '0px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' }); return; }
      const r = w.rect();
      if (r.x > a.w - 60) w.el.style.left = Math.max(0, a.w - r.w) + 'px';
      if (r.y > window.innerHeight - 60) w.el.style.top = a.y + 'px';
    });
  }, 100));
})();
