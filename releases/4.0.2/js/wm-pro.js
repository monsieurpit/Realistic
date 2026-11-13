/* Window manager 2.0 (3.3): the parts of window handling added on top of js/wm.js.
   - Magnetic edges: a window you move or resize clicks to the screen's edges and to the edges of the windows around it
     (side by side, or lined up). Hold Shift while dragging to place it freely. Thin guides show what it lined up with.
   - Throw: let go of a window while flicking it toward the left or right edge and it fills that half.
   - Tabs: drop a window on the title bar of another window of the same app, or choose Window › Merge All Windows: they
     become tabs of one window. Drag a tab down out of the bar to make it a window again. A tab bar's "+" opens a new tab.
   - Keyboard tiling: Ctrl+Alt+← → ↑ ↓ for halves (press again for thirds and two thirds), Ctrl+Alt+U I J K for quarters,
     Ctrl+Alt+Enter to fill the screen, Ctrl+Alt+C to center, Ctrl+Alt+T to tile every window on the screen.
   Nothing here moves a window on its own: only what you drag, drop or press. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const wm = () => PatOS.wm;
  const MAG = 12; // (how close an edge has to be, in pixels, to click to another)
  const visible = (self) => wm().windows.filter((w) => w !== self && !w.minimized && !w.fullscreen && !w.closed && w.el.style.display !== 'none');

  /* ---------- magnetic edges ---------- */
  let guides = [];
  function guide(axis, at, from, to) {
    const g = h('div', { class: 'wm-guide ' + axis });
    if (axis === 'v') Object.assign(g.style, { left: at + 'px', top: from + 'px', height: Math.max(0, to - from) + 'px' });
    else Object.assign(g.style, { top: at + 'px', left: from + 'px', width: Math.max(0, to - from) + 'px' });
    document.getElementById('windows').appendChild(g); guides.push(g);
  }
  function clearGuides() { guides.forEach((g) => g.remove()); guides = []; }
  /* r: where the window would be ({x, y, w, h}); edges: which of its edges move ('move' = all, or a resize direction like
     'se'). Gives the place it clicks to. */
  function magnet(win, r, edges, ev) {
    clearGuides();
    if ((ev && ev.shiftKey) || PatOS.settings.windowMagnets === false) return r;
    const a = wm().workArea(); const out = Object.assign({}, r);
    const moveAll = edges === 'move';
    const L = moveAll || edges.includes('w'), R = moveAll || edges.includes('e'), Tp = moveAll || edges.includes('n'), B = moveAll || edges.includes('s');
    // the lines it can click to: the screen, then every window's sides (lined up with them, or right next to them)
    const xs = [{ v: a.x, f: a.y, t: a.y + a.h }, { v: a.x + a.w, f: a.y, t: a.y + a.h }], ys = [{ v: a.y, f: 0, t: a.w }, { v: a.y + a.h, f: 0, t: a.w }];
    visible(win).forEach((o) => {
      const q = o.rect(); const overlapY = r.y < q.y + q.h + MAG && r.y + r.h > q.y - MAG, overlapX = r.x < q.x + q.w + MAG && r.x + r.w > q.x - MAG;
      if (overlapY) { xs.push({ v: q.x, f: Math.min(q.y, r.y), t: Math.max(q.y + q.h, r.y + r.h) }, { v: q.x + q.w, f: Math.min(q.y, r.y), t: Math.max(q.y + q.h, r.y + r.h) }); }
      if (overlapX) { ys.push({ v: q.y, f: Math.min(q.x, r.x), t: Math.max(q.x + q.w, r.x + r.w) }, { v: q.y + q.h, f: Math.min(q.x, r.x), t: Math.max(q.x + q.w, r.x + r.w) }); }
    });
    const best = (val, lines) => { let b = null; lines.forEach((l) => { const d = Math.abs(l.v - val); if (d <= MAG && (!b || d < b.d)) b = { d, l }; }); return b; };
    // horizontal: the left edge or the right edge, whichever is closer to a line
    const bl = L ? best(r.x, xs) : null, br = R ? best(r.x + r.w, xs) : null;
    if (moveAll) { const pick = bl && (!br || bl.d <= br.d) ? ['l', bl] : br ? ['r', br] : null; if (pick) { out.x = pick[0] === 'l' ? pick[1].l.v : pick[1].l.v - r.w; guide('v', pick[1].l.v, pick[1].l.f, pick[1].l.t); } }
    else { if (bl) { out.w = r.w + (r.x - bl.l.v); out.x = bl.l.v; guide('v', bl.l.v, bl.l.f, bl.l.t); } if (br) { out.w = br.l.v - out.x; guide('v', br.l.v, br.l.f, br.l.t); } }
    const bt = Tp ? best(r.y, ys) : null, bb = B ? best(r.y + r.h, ys) : null;
    if (moveAll) { const pick = bt && (!bb || bt.d <= bb.d) ? ['t', bt] : bb ? ['b', bb] : null; if (pick) { out.y = pick[0] === 't' ? pick[1].l.v : pick[1].l.v - r.h; guide('h', pick[1].l.v, pick[1].l.f, pick[1].l.t); } }
    else { if (bt) { out.h = r.h + (r.y - bt.l.v); out.y = bt.l.v; guide('h', bt.l.v, bt.l.f, bt.l.t); } if (bb) { out.h = bb.l.v - out.y; guide('h', bb.l.v, bb.l.f, bb.l.t); } }
    if (out.w < win.app.minWidth) { out.w = r.w; out.x = r.x; } if (out.h < win.app.minHeight) { out.h = r.h; out.y = r.y; }
    out.y = Math.max(a.y, out.y);
    return out;
  }

  /* ---------- throw ---------- */
  // the pointer's last positions during a drag; a quick flick at the end means "put it on that side"
  function flick(samples) {
    if (samples.length < 3) return null;
    const last = samples[samples.length - 1]; const first = samples.find((s) => last.t - s.t <= 90) || samples[0];
    const dt = Math.max(1, last.t - first.t), vx = (last.x - first.x) / dt, vy = (last.y - first.y) / dt;
    if (performance.now() - last.t > 100) return null; // (it stopped before letting go)
    if (Math.abs(vx) > 1.6 && Math.abs(vx) > Math.abs(vy) * 1.5) return vx < 0 ? 'left' : 'right';
    return null;
  }

  /* ---------- tabs ---------- */
  // a group: { wins: [...], cur: win }. The windows that are not shown are hidden (and count as minimized).
  function groupOf(win) { return win && win.tabGroup && win.tabGroup.wins.length > 1 ? win.tabGroup : null; }
  function strip(g) {
    g.wins.forEach((w) => {
      let s = w.el.querySelector(':scope > .win-tabs');
      if (g.wins.length < 2) { if (s) s.remove(); w.el.classList.remove('tabbed'); return; }
      if (!s) { s = h('div', { class: 'win-tabs', role: 'tablist', 'aria-label': T('Tabs') }); w.titlebar.after(s); w.el.classList.add('tabbed'); }
      s.innerHTML = '';
      g.wins.forEach((t) => {
        const tab = h('div', { class: 'win-tab' + (t === g.cur ? ' on' : ''), role: 'tab', 'aria-selected': String(t === g.cur), tabindex: '0', title: t.title },
          h('span', { class: 'wt-ic', html: PatOS.iconHTML ? PatOS.iconHTML(t.app.icon || t.app.id) : '' }), h('span', { class: 'wt-l' }, t.title || t.app.name),
          h('button', { class: 'wt-x', 'aria-label': T('Close Tab'), onclick: (e) => { e.stopPropagation(); t.close(); } }, '×'));
        tab.addEventListener('click', () => show(t));
        tab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(t); } });
        tabDrag(tab, t);
        s.appendChild(tab);
      });
      if (!w.app.single) s.appendChild(h('button', { class: 'wt-new', 'aria-label': T('New Tab'), title: T('New Tab'), onclick: () => newTab(w) }, '+'));
    });
  }
  function show(t) {
    const g = groupOf(t); if (!g) return wm().restore(t);
    const from = g.cur; if (from === t) return wm().focus(t);
    const r = from.rect(), max = from.maximized;
    g.cur = t;
    t.el.style.transition = 'none';
    Object.assign(t.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', zIndex: from.el.style.zIndex, display: '' });
    t.maximized = max; t.el.classList.toggle('maximized', max); t.prevRect = from.prevRect;
    t.minimized = false; t.tabHidden = false;
    from.el.style.display = 'none'; from.minimized = true; from.tabHidden = true;
    requestAnimationFrame(() => { t.el.style.transition = ''; });
    strip(g); wm().focus(t);
    PatOS.emit('wm:tab', t);
  }
  function merge(win, into) {
    if (!win || !into || win === into || win.app.id !== into.app.id || into.app.single) return false;
    const g = groupOf(into) || (into.tabGroup = { wins: [into], cur: into });
    if (win.tabGroup === g) return false;
    const movers = groupOf(win) ? groupOf(win).wins.slice() : [win];
    [into, ...movers].forEach((w) => {
      w.tabGroup = g; if (!g.wins.includes(w)) g.wins.push(w);
      if (!w._tabHooked) { w._tabHooked = true; w.on('closed', () => leave(w, true)); }
      if (w !== g.cur) { w.el.style.display = 'none'; w.minimized = true; w.tabHidden = true; }
    });
    show(win); return true;
  }
  /* takes a tab out of its group (closing it, or making it its own window) */
  function leave(w, closing) {
    const g = w.tabGroup; if (!g) return;
    const i = g.wins.indexOf(w); if (i < 0) return;
    const wasCur = g.cur === w, r = w.rect(), max = w.maximized;
    g.wins.splice(i, 1); w.tabGroup = null;
    if (!closing) { const s = w.el.querySelector(':scope > .win-tabs'); if (s) s.remove(); w.el.classList.remove('tabbed'); }
    if (wasCur && g.wins.length) {
      const next = g.wins[Math.min(i, g.wins.length - 1)]; g.cur = next;
      Object.assign(next.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', display: '' });
      next.maximized = max; next.el.classList.toggle('maximized', max); next.minimized = false; next.tabHidden = false;
      if (closing) setTimeout(() => wm().focus(next), 0); else wm().focus(next);
    }
    if (g.wins.length === 1) { const only = g.wins[0]; only.tabGroup = null; g.wins = []; strip({ wins: [only], cur: only }); }
    else strip(g);
  }
  function detach(w, x, y) {
    if (!groupOf(w)) return;
    const r = w.rect(); leave(w, false);
    const a = wm().workArea();
    Object.assign(w.el.style, { display: '', left: Math.max(0, Math.min(a.w - 120, x - r.w / 2)) + 'px', top: Math.max(a.y, y - 18) + 'px' });
    w.minimized = false; w.tabHidden = false; wm().focus(w);
  }
  function newTab(w) {
    const n = PatOS.launch(w.app.id); if (n && n.el && n !== w) setTimeout(() => merge(n, w), 0);
  }
  function tabDrag(tab, t) {
    tab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.wt-x')) return;
      const sx = e.clientX, sy = e.clientY; let gone = false;
      const move = (ev) => { if (!gone && Math.abs(ev.clientY - sy) > 34) { gone = true; cleanup(); detach(t, ev.clientX, ev.clientY); } else if (!gone && Math.abs(ev.clientX - sx) > 6) tab.classList.add('dragging'); };
      const cleanup = () => { tab.classList.remove('dragging'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', cleanup); };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', cleanup);
    });
  }
  /* during a window drag: the title bar of another window of the same app under the pointer (dropping there makes tabs) */
  let hoverBar = null;
  // (the other windows of the same app and where their title bars are, measured once per drag: asking the browser what is
  //  under the pointer on every move cost most of a drag on a slow computer, even with no other window to drop on)
  let bars = null, barsFor = null;
  function tabTarget(win, ev) {
    if (barsFor !== win) { barsFor = win; bars = wm().windows.filter((w) => w !== win && w.app.id === win.app.id && !w.minimized && !(w.tabGroup && w.tabGroup === win.tabGroup)).map((w) => { const t = w.el.querySelector('.win-tabs:not([hidden])') || w.el.querySelector('.titlebar'); return t ? [w, t.getBoundingClientRect(), +getComputedStyle(w.el).zIndex || 0] : null; }).filter(Boolean); }
    const under = bars.filter(([, r]) => ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom).sort((a, b) => b[2] - a[2])[0];
    const tw = under ? under[0] : null;
    const bar = tw ? tw.el : null;
    if (bar !== hoverBar) { if (hoverBar) hoverBar.classList.remove('tab-drop'); hoverBar = bar; if (bar) bar.classList.add('tab-drop'); }
    return tw && !tw.app.single ? tw : null;
  }
  function endTabTarget() { if (hoverBar) hoverBar.classList.remove('tab-drop'); hoverBar = null; bars = barsFor = null; }
  function mergeAll(win) {
    if (!win) return 0; let n = 0;
    wm().windowsOf(win.app.id).filter((w) => w !== win && groupOf(w) !== groupOf(win) || (w !== win && !groupOf(w))).forEach((w) => { if (merge(w, win)) n++; });
    if (n) show(win); return n;
  }
  PatOS.on('wm:title', (w) => { const g = groupOf(w); if (g) strip(g); });
  // switching tabs from the keyboard: Ctrl+Tab and Ctrl+Shift+Tab (when the window does not use them itself)
  document.addEventListener('keydown', (e) => {
    if (!PatOS.loggedIn || !e.ctrlKey || e.key !== 'Tab' || e.altKey) return;
    const g = groupOf(wm().active); if (!g) return;
    e.preventDefault(); const i = g.wins.indexOf(g.cur); show(g.wins[(i + (e.shiftKey ? -1 : 1) + g.wins.length) % g.wins.length]);
  });

  /* ---------- keyboard tiling ---------- */
  const CYCLE = [1 / 2, 1 / 3, 2 / 3];
  function place(win, r) {
    if (!win || win.app.resizable === false || PatOS.isMobile) return;
    if (win.fullscreen) win.toggleFullscreen();
    if (!win.maximized && !win._tiled) win.prevRect = win.rect();
    if (win.maximized) { win.maximized = false; win.el.classList.remove('maximized'); }
    win.el.classList.add('animating');
    Object.assign(win.el.style, { left: Math.round(r.x) + 'px', top: Math.round(r.y) + 'px', width: Math.round(r.w) + 'px', height: Math.round(r.h) + 'px' });
    clearTimeout(win._animT); win._animT = setTimeout(() => win.el.classList.remove('animating'), 420);
    win._tiled = true;
  }
  function tile(win, where) {
    if (!win) return; const a = wm().workArea();
    // pressing the same side again: half → a third → two thirds
    const step = win._tile && win._tile.where === where ? (win._tile.step + 1) % CYCLE.length : 0;
    const f = CYCLE[step]; win._tile = { where, step };
    const R = {
      left: { x: a.x, y: a.y, w: a.w * f, h: a.h }, right: { x: a.x + a.w * (1 - f), y: a.y, w: a.w * f, h: a.h },
      top: { x: a.x, y: a.y, w: a.w, h: a.h * f }, bottom: { x: a.x, y: a.y + a.h * (1 - f), w: a.w, h: a.h * f },
      tl: { x: a.x, y: a.y, w: a.w / 2, h: a.h / 2 }, tr: { x: a.x + a.w / 2, y: a.y, w: a.w / 2, h: a.h / 2 },
      bl: { x: a.x, y: a.y + a.h / 2, w: a.w / 2, h: a.h / 2 }, br: { x: a.x + a.w / 2, y: a.y + a.h / 2, w: a.w / 2, h: a.h / 2 },
      fill: { x: a.x, y: a.y, w: a.w, h: a.h }
    }[where];
    if (where === 'center') { const r = win.rect(); const w = Math.min(r.w, a.w * .8), hh = Math.min(r.h, a.h * .85); return place(win, { x: a.x + (a.w - w) / 2, y: a.y + (a.h - hh) / 2, w, h: hh }); }
    if (where === 'restore') { if (win.prevRect) { place(win, win.prevRect); win._tiled = false; win._tile = null; } return; }
    if (R) place(win, R);
  }
  /* every window on the screen side by side in a grid (the one you use first, biggest) */
  function tileAll() {
    const ws = visible(null).filter((w) => w.app.resizable !== false).sort((x, y) => (y === wm().active) - (x === wm().active));
    if (!ws.length) return 0; const a = wm().workArea(), gap = 8;
    if (ws.length === 1) { tile(ws[0], 'fill'); return 1; }
    // the first one gets the left half; the rest share the right half in rows (or a grid when there are many)
    const rest = ws.slice(1); const cols = rest.length > 3 ? 2 : 1, rows = Math.ceil(rest.length / cols);
    place(ws[0], { x: a.x + gap, y: a.y + gap, w: a.w / 2 - gap * 1.5, h: a.h - gap * 2 });
    rest.forEach((w, i) => { const c = i % cols, r = Math.floor(i / cols), cw = (a.w / 2 - gap * 1.5 - gap * (cols - 1)) / cols, ch = (a.h - gap * 2 - gap * (rows - 1)) / rows;
      place(w, { x: a.x + a.w / 2 + gap / 2 + c * (cw + gap), y: a.y + gap + r * (ch + gap), w: cw, h: ch }); });
    return ws.length;
  }
  document.addEventListener('keydown', (e) => {
    if (!PatOS.loggedIn || !e.ctrlKey || !e.altKey || e.metaKey) return;
    const w = wm().active;
    const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom', KeyU: 'tl', KeyI: 'tr', KeyJ: 'bl', KeyK: 'br', Enter: 'fill', KeyC: 'center', Backspace: 'restore' }[e.code];
    if (e.code === 'KeyT') { e.preventDefault(); e.stopPropagation(); tileAll(); return; }
    if (k && w) { e.preventDefault(); e.stopPropagation(); tile(w, k); }
  }, true);

  PatOS.wmPro = { magnet, clearGuides, flick, merge, mergeAll, detach, showTab: show, groupOf, tabTarget, endTabTarget, tile, tileAll };
})();
