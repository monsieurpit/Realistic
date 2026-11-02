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
    return PatOS.settings.dockSize + 22;
  }
  function workArea() {
    return { x: 0, y: MENUBAR, w: window.innerWidth, h: window.innerHeight - MENUBAR - dockReserve() };
  }

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

    const el = h('div', { class: 'window opening' + (app.titlebar === 'hidden' ? ' tb-hidden' : '') + (app.dark ? ' force-dark' : ''), 'data-app': app.id, id });
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
    const win = {
      id, app, el, body, titlebar, toolbar, titleEl, args: args || {},
      minimized: false, maximized: false, prevRect: null,
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
      emit(ev, d) { (handlers[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); },
      setTitle(t) { titleEl.textContent = t; win.title = t; PatOS.emit('wm:title', win); },
      close: () => closeWindow(win),
      minimize: () => minimizeWindow(win),
      toggleMax: () => toggleMax(win),
      focus: () => focusWindow(win),
      rect() { return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }; }
    };
    win.title = app.name;

    traffic.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); win.close(); });
    traffic.querySelector('.min').addEventListener('click', (e) => { e.stopPropagation(); win.minimize(); });
    traffic.querySelector('.max').addEventListener('click', (e) => { e.stopPropagation(); if (app.resizable !== false) win.toggleMax(); });
    traffic.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('pointerdown', () => focusWindow(win), true);
    titlebar.addEventListener('dblclick', (e) => { if (e.target.closest('.win-toolbar button, input, select')) return; if (app.resizable !== false) win.toggleMax(); });
    setupDrag(win, titlebar);
    setupResize(win);
    if (app.titlebar === 'hidden') setupDrag(win, body, true);

    layer().appendChild(el);
    wins.push(win);
    focusWindow(win);
    openAnim(win);

    try { app.launch(win, win.args); } catch (e) {
      console.error(e);
      body.innerHTML = '<div class="app-error">This app ran into a problem.<br><small>' + PatOS.esc(e.message) + '</small></div>';
    }
    const ro = new ResizeObserver(() => win.emit('resize', win.rect()));
    ro.observe(body);
    win.on('closed', () => ro.disconnect());
    PatOS.emit('wm:open', win);
    return win;
  }

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
    el.animate(frames, { duration: src ? 460 : 300, easing: 'cubic-bezier(.2,.95,.25,1.04)' });
  }
  PatOS.rectTransform = rectTransform;

  function setupDrag(win, handle, bodyMode) {
    let sx, sy, ox, oy, dragging = false, snap = null, pid = null;
    const preview = () => $('#snap-preview') || layer().appendChild(h('div', { id: 'snap-preview' }));
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || PatOS.isMobile) return;
      if (bodyMode && e.target.closest('button, input, textarea, select, canvas, a, [contenteditable], .no-drag, .calc-keys, .scrub')) return;
      if (!bodyMode && e.target.closest('.win-toolbar button, .win-toolbar input, .win-toolbar select, .win-toolbar .tab, .win-toolbar .no-drag')) return;
      sx = e.clientX; sy = e.clientY; ox = win.el.offsetLeft; oy = win.el.offsetTop; dragging = false; pid = e.pointerId;
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
        win.el.style.left = nx + 'px'; win.el.style.top = ny + 'px';
        const area = workArea(); const p = preview();
        snap = ev.clientX <= 3 ? 'left' : ev.clientX >= window.innerWidth - 3 ? 'right' : ev.clientY <= MENUBAR + 1 ? 'max' : null;
        if (snap) {
          const r = snap === 'left' ? { x: 0, w: area.w / 2 } : snap === 'right' ? { x: area.w / 2, w: area.w / 2 } : { x: 0, w: area.w };
          Object.assign(p.style, { left: r.x + 6 + 'px', top: area.y + 6 + 'px', width: r.w - 12 + 'px', height: area.h - 12 + 'px' });
          p.classList.add('show');
        } else p.classList.remove('show');
      };
      const up = () => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
        try { handle.releasePointerCapture(pid); } catch (er) {}
        layer().classList.remove('dragging'); win.el.classList.remove('moving');
        preview().classList.remove('show');
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
          Object.assign(win.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: ht + 'px' });
        };
        const up = () => { hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); layer().classList.remove('dragging'); };
        hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up);
      });
    });
  }

  function animateTo(win, r) {
    win.el.classList.add('animating');
    Object.assign(win.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    setTimeout(() => win.el.classList.remove('animating'), 320);
  }
  function setMax(win, on) {
    win.maximized = on;
    win.el.classList.toggle('maximized', on);
    if (on) { const a = workArea(); animateTo(win, { x: 0, y: a.y, w: a.w, h: a.h }); }
    else if (win.prevRect) animateTo(win, win.prevRect);
  }
  function toggleMax(win) {
    if (!win.maximized) win.prevRect = win.rect();
    setMax(win, !win.maximized);
  }

  function focusWindow(win) {
    if (!win || win.minimized) return;
    if (active === win) { if (+win.el.style.zIndex !== z) win.el.style.zIndex = ++z; return; }
    if (active) { active.el.classList.remove('active'); active.emit('blur'); }
    active = win;
    win.el.style.zIndex = ++z;
    win.el.classList.add('active');
    win.emit('focus');
    PatOS.emit('wm:focus', win);
  }
  function blurAll() {
    if (active) { active.el.classList.remove('active'); active.emit('blur'); }
    active = null; PatOS.emit('wm:focus', null);
  }

  function closeWindow(win) {
    let veto = false;
    win.emit('beforeclose', { cancel: () => { veto = true; } });
    if (veto) return;
    if (motionOK()) win.el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.92)', opacity: 0, filter: 'blur(4px)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    else win.el.classList.add('closing');
    win.el.style.pointerEvents = 'none';
    win.emit('closed');
    const i = wins.indexOf(win); if (i >= 0) wins.splice(i, 1);
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
    if (PatOS.isMobile && PatOS.mobile) return PatOS.mobile.show(win);
    if (!win.minimized) return focusWindow(win);
    win.minimized = false;
    win.el.style.display = '';
    const target = PatOS.dock && PatOS.dock.iconRect(win.app.id);
    if (target && motionOK()) {
      win.el.style.transformOrigin = 'center bottom';
      win.el.animate(genieFrames(win.el.getBoundingClientRect(), target, true), { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => { win.el.style.transformOrigin = ''; };
    }
    focusWindow(win);
    win.emit('restore');
    PatOS.emit('wm:minimize', win);
  }

  /* public API */
  PatOS.wm = {
    windows: wins,
    get active() { return active; },
    workArea,
    focus: focusWindow,
    restore: restoreWindow,
    blurAll,
    windowsOf: (appId) => wins.filter((w) => w.app.id === appId),
    isRunning: (appId) => wins.some((w) => w.app.id === appId),
    quit(appId) { wins.filter((w) => w.app.id === appId).forEach((w) => w.close()); },
    closeAll() { wins.slice().forEach((w) => w.close()); }
  };

  PatOS.launch = function (appId, args) {
    const app = PatOS.apps[appId];
    if (!app) { PatOS.notify && PatOS.notify({ title: 'App not found', body: appId }); return null; }
    if (app.action) { app.action(args || {}); PatOS.emit('app:launch', appId); return null; }
    const existing = PatOS.wm.windowsOf(appId);
    if (app.single && existing.length) {
      const w = existing[0];
      restoreWindow(w);
      if (args && app.onArgs) app.onArgs(w, args);
      return w;
    }
    if (!existing.length && PatOS.dock) PatOS.dock.bounce(appId);
    PatOS.emit('app:launch', appId);
    return createWindow(app, args);
  };

  window.addEventListener('resize', PatOS.debounce(() => {
    const a = workArea();
    wins.forEach((w) => {
      if (w.maximized) { Object.assign(w.el.style, { left: '0px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' }); return; }
      const r = w.rect();
      if (r.x > a.w - 60) w.el.style.left = Math.max(0, a.w - r.w) + 'px';
      if (r.y > window.innerHeight - 60) w.el.style.top = a.y + 'px';
    });
  }, 100));
})();
