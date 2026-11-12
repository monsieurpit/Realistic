/* PatOS Mobile: the phone shell (home screen, status bar, Dynamic Island, gestures, app switcher) */
(function () {
  'use strict';
  const { h, $, $$, clamp } = PatOS;
  const M = (PatOS.mobile = { front: null, built: false });
  const html = document.documentElement;
  // a 3D wallpaper doesn't need to move while an app covers the whole phone screen (it kept rendering every frame behind it)
  let wpPaused = null;
  new MutationObserver(() => {
    const cover = html.classList.contains('mobile') && html.classList.contains('m-in-app') && !html.classList.contains('m-peek');
    if (cover !== wpPaused && PatOS.wallpaper) { wpPaused = cover; PatOS.wallpaper.pause(cover); }
  }).observe(html, { attributes: true, attributeFilter: ['class'] });
  const ICON_SIG = '<svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>';
  const ICON_WIFI = '<svg viewBox="0 0 24 18"><path d="M12 17.5l3.2-3.3a4.6 4.6 0 0 0-6.4 0zM5 10.6a10 10 0 0 1 14 0l-1.9 1.9a7.3 7.3 0 0 0-10.2 0zM1.5 7a15 15 0 0 1 21 0l-1.9 1.9a12.3 12.3 0 0 0-17.2 0z"/></svg>';
  const motion = () => !PatOS.settings.reduceMotion;

  /* ---------------- build ---------------- */
  function build() {
    if (M.built) return; M.built = true;
    const desk = $('#desktop');
    const status = h('div', { id: 'm-status' },
      h('div', { class: 'ms-l' }, h('span', { class: 'ms-time' })),
      h('button', { id: 'm-island', 'aria-label': 'Now playing' }, h('div', { class: 'mi-art' }), h('div', { class: 'mi-text' }), h('div', { class: 'mi-bars' }, h('i'), h('i'), h('i'), h('i'))),
      h('div', { class: 'ms-r' }, h('span', { class: 'ms-ic', html: ICON_SIG }), h('span', { class: 'ms-ic', html: ICON_WIFI }), h('span', { class: 'ms-bat' }, h('span', { class: 'ms-bat-fill' }))));
    const search = h('button', { class: 'mh-search', 'aria-label': PatOS.t('Search') }, h('span', { html: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>' }), PatOS.t('Search'));
    search.onclick = () => PatOS.spotlight.show();
    const home = h('div', { id: 'm-home' },
      h('div', { class: 'mh-pages' }),
      h('div', { class: 'mh-dots' }),
      search,
      h('div', { class: 'mh-dock' }));
    const ind = h('div', { id: 'm-indicator' }, h('span'));
    const sw = h('div', { id: 'm-switcher', class: 'hidden' }, h('div', { class: 'msw-empty' }, 'No recent apps'));
    desk.insertBefore(home, $('#windows'));
    desk.append(sw, status, ind);
    renderHome();
    setupGestures();
    setupIsland();
    setupViewport();
    setupBanners();
    setupHistory();
    setupTopEdge();
    tickStatus(); setInterval(tickStatus, 1000);
    if (navigator.getBattery) navigator.getBattery().then((b) => { const up = () => { $('.ms-bat-fill').style.width = Math.round(b.level * 100) + '%'; $('.ms-bat').classList.toggle('charging', b.charging); }; up(); b.addEventListener('levelchange', up); b.addEventListener('chargingchange', up); }).catch(() => {});
    window.addEventListener('resize', PatOS.debounce(() => { if (PatOS.isMobile) renderHome(); }, 200));
    PatOS.on('setting', (s) => { if (['mobileDock', 'hiddenApps', 'dockPinned'].includes(s.key)) renderHome(); });
    // light, dark or colored app icons: the icons are pictures painted for their tile, so the home screen is painted again
    PatOS.on('icons:style', () => renderHome());
    PatOS.on('wm:open', (w) => { if (PatOS.isMobile) setFront(w); });
    // a toolbar wider than the screen scrolls sideways: its edges fade where there is more to see
    const tbEdges = (t) => { if (!t || !t.classList.contains('win-toolbar')) return; const more = t.scrollWidth > t.clientWidth + 2; t.classList.toggle('tb-more-r', more && t.scrollLeft + t.clientWidth < t.scrollWidth - 2); t.classList.toggle('tb-more-l', more && t.scrollLeft > 2); };
    document.addEventListener('scroll', (e) => { if (PatOS.isMobile) tbEdges(e.target); }, true);
    const tbAll = () => { if (PatOS.isMobile) document.querySelectorAll('.window .win-toolbar').forEach(tbEdges); };
    PatOS.on('wm:open', () => { setTimeout(tbAll, 400); setTimeout(tbAll, 1500); });
    window.addEventListener('resize', PatOS.debounce(tbAll, 250));
    M.toolbarEdges = tbAll;
    PatOS.on('wm:focus', (w) => { if (PatOS.isMobile && w) setFront(w); });
    PatOS.on('wm:close', (w) => { if (M.front === w) { M.front = null; html.classList.remove('m-in-app'); popApp(); } });
    PatOS.on('wm:title', (w) => { if (w && w._mbar) syncBar(w); });
  }

  function tickStatus() {
    const t = $('.ms-time'); if (!t) return;
    t.textContent = new Intl.DateTimeFormat(PatOS.locale, { hour: 'numeric', minute: '2-digit', hour12: !PatOS.settings.clock24 }).formatToParts(new Date()).filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
    updateIsland();
  }

  /* ---------------- home screen ---------------- */
  function homeApps() {
    const dock = PatOS.settings.mobileDock;
    const hidden = PatOS.settings.hiddenApps || [];
    return PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden && id !== 'launchpad' && !dock.includes(id) && !hidden.includes(id) && !PatOS.apps[id].desktopOnly);
  }
  function appButton(id, withLabel) {
    const a = PatOS.apps[id];
    const b = h('button', { class: 'mh-app', 'data-app': id }, h('div', { class: 'mh-ic', html: PatOS.iconHTML(a.icon || id) }), withLabel ? h('span', {}, a.mobileName || a.name) : null);
    let timer = null, long = false, sx = 0, sy = 0;
    b.addEventListener('pointerdown', (e) => { long = false; sx = e.clientX; sy = e.clientY; timer = setTimeout(() => { long = true; quickMenu(id, b); }, 520); });
    b.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) clearTimeout(timer); });
    b.addEventListener('pointerup', () => clearTimeout(timer));
    b.addEventListener('pointercancel', () => clearTimeout(timer));
    b.addEventListener('click', (e) => { if (long) { e.preventDefault(); return; } launchFrom(id, b); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }
  function launchFrom(id, btn) {
    PatOS.sound.click();
    PatOS.setLaunchRect(btn.querySelector('.mh-ic'));
    const ws = PatOS.wm.windowsOf(id);
    if (ws.length && !PatOS.apps[id].action) return M.show(ws[0]);
    PatOS.launch(id);
  }
  function quickMenu(id, btn) {
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
    $('#m-home').classList.add('jiggle');
    const a = PatOS.apps[id]; const r = btn.getBoundingClientRect();
    const inDock = PatOS.settings.mobileDock.includes(id);
    PatOS.menu([
      { header: a.name },
      { label: 'Open', action: () => launchFrom(id, btn) },
      PatOS.wm.isRunning(id) ? { label: 'Close App', action: () => PatOS.wm.quit(id) } : null,
      { label: inDock ? 'Remove from Dock' : 'Add to Dock', action: () => {
        let d = PatOS.settings.mobileDock.slice();
        if (inDock) d = d.filter((x) => x !== id); else { if (d.length >= 4) d.pop(); d.push(id); }
        PatOS.setSetting('mobileDock', d);
      } },
      inDock && PatOS.settings.mobileDock.indexOf(id) > 0 ? { label: 'Move Left', action: () => { const d = PatOS.settings.mobileDock.slice(); const i = d.indexOf(id); [d[i - 1], d[i]] = [d[i], d[i - 1]]; PatOS.setSetting('mobileDock', d); } } : null,
      inDock && PatOS.settings.mobileDock.indexOf(id) < PatOS.settings.mobileDock.length - 1 ? { label: 'Move Right', action: () => { const d = PatOS.settings.mobileDock.slice(); const i = d.indexOf(id); [d[i + 1], d[i]] = [d[i], d[i + 1]]; PatOS.setSetting('mobileDock', d); } } : null,
      { label: 'Hide App', action: () => PatOS.setSetting('hiddenApps', [...(PatOS.settings.hiddenApps || []), id]) },
      { divider: true },
      { label: 'Edit Home Screen in Settings', action: () => PatOS.launch('settings', { pane: 'dock' }) }
    ], r.left, r.bottom + 6, { onClose: () => $('#m-home').classList.remove('jiggle') });
  }
  function homeWidgets() {
    const d = new Date();
    const clock = h('div', { class: 'mw mw-clock' }, h('canvas', { width: 220, height: 220 }));
    PatOS.drawAnalog(clock.firstChild, d);
    clock.onclick = () => PatOS.launch('clock');
    const events = PatOS.calendarOn ? PatOS.calendarOn(d) : (PatOS.store.get('calendar', {})[PatOS.dateKey ? PatOS.dateKey(d) : ''] || []);
    const rem = PatOS.store.get('reminders', []).filter((r) => !r.done);
    const cal = h('div', { class: 'mw mw-cal' },
      h('div', { class: 'mw-day' }, d.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()),
      h('div', { class: 'mw-num' }, d.getDate()),
      h('div', { class: 'mw-ev' }, events[0] ? (events[0].time ? events[0].time + ' ' : '') + events[0].title : rem[0] ? '○ ' + rem[0].text : PatOS.t('No events today')));
    cal.onclick = () => PatOS.launch(events[0] ? 'calendar' : 'reminders');
    return [clock, cal];
  }
  function renderHome() {
    const pages = $('.mh-pages'); if (!pages) return;
    const keep = pages.scrollLeft;
    pages.innerHTML = '';
    const ids = homeApps();
    // fit the grid to this screen: icons, labels and rows come from the real height (safe areas included)
    const cs = getComputedStyle(html); const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    const top = Math.max(px('--sat'), html.classList.contains('real-phone') ? 0 : 20) + 34, bottom = px('--sab') + 8;
    const cellH = innerWidth > innerHeight ? 90 : Math.round(Math.min(108, Math.max(88, (innerWidth - 40) / 4 + 14)));
    html.style.setProperty('--mh-cell', cellH + 'px');
    const avail = window.innerHeight - top - bottom - (innerWidth > innerHeight ? 150 : 174); // dock, dots, search
    // sideways: a wider grid and no widgets, so nothing overlaps on a short screen
    const land = innerWidth > innerHeight;
    const cols = land ? Math.max(5, Math.min(8, Math.floor((innerWidth - 60) / 96))) : 4;
    html.style.setProperty('--mh-cols', cols);
    const rows = Math.max(land ? 1 : 3, Math.floor(avail / cellH));
    const per = rows * cols;
    const firstPer = land ? per : Math.max(4, per - 8); // page 1 carries two widgets (2x2 each) when upright
    const chunks = [ids.slice(0, firstPer)];
    for (let i = firstPer; i < ids.length; i += per) chunks.push(ids.slice(i, i + per));
    chunks.forEach((list, pi) => {
      const page = h('div', { class: 'mh-page' });
      const grid = h('div', { class: 'mh-grid', style: { gridTemplateRows: `repeat(${rows}, var(--mh-cell))` } });
      if (pi === 0 && !land) homeWidgets().forEach((w) => grid.appendChild(w));
      list.forEach((id) => grid.appendChild(appButton(id, true)));
      page.appendChild(grid); pages.appendChild(page);
    });
    const dots = $('.mh-dots'); dots.innerHTML = '';
    chunks.forEach((_, i) => dots.appendChild(h('span', { class: i === 0 ? 'on' : '' })));
    pages.onscroll = () => { const i = Math.round(pages.scrollLeft / pages.clientWidth); $$('.mh-dots span').forEach((s, j) => s.classList.toggle('on', j === i)); };
    pages.scrollLeft = keep;
    const dock = $('.mh-dock'); dock.innerHTML = '';
    PatOS.settings.mobileDock.filter((id) => PatOS.apps[id]).forEach((id) => dock.appendChild(appButton(id, false)));
  }
  M.renderHome = renderHome;
  M.iconRect = function (id) {
    const el = $(`#m-home .mh-app[data-app="${id}"] .mh-ic`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.left > -10 && r.right < innerWidth + 10 ? r : null;
  };

  /* ---------------- windows on the phone ---------------- */
  function setFront(w) {
    if (!w) return;
    M.front = w;
    PatOS.wm.windows.forEach((o) => { if (o !== w && !o.minimized) { o.minimized = true; o.el.style.display = 'none'; } });
    $$('.window').forEach((e) => e.classList.toggle('m-front', e === w.el));
    html.classList.add('m-in-app');
    html.classList.toggle('m-dark-app', !!(w.app.dark || w.app.titlebar === 'hidden'));
    PatOS.panels.closeAll();
    appBar(w); syncBar(w); pushApp();
  }
  function toIconFrames(w, fromTransform) {
    const r = { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const icon = M.iconRect(w.app.id);
    const end = icon ? { transform: PatOS.rectTransform(icon, r), opacity: 0, borderRadius: '60px' } : { transform: 'scale(.6)', opacity: 0, borderRadius: '60px' };
    return [{ transform: fromTransform || 'none', opacity: 1, borderRadius: fromTransform ? '40px' : '0px' }, end];
  }
  M.home = function (w, fromTransform) {
    w = w || M.front; if (!w) return;
    w.minimized = true;
    const done = () => { if (w.minimized) { w.el.style.display = 'none'; w.el.style.transform = ''; w.el.style.borderRadius = ''; } };
    if (motion()) { const a = w.el.animate(toIconFrames(w, fromTransform), { duration: 420, easing: 'cubic-bezier(.3,.9,.3,1)' }); a.onfinish = done; }
    else done();
    if (M.front === w) M.front = null;
    html.classList.remove('m-in-app');
    popApp();
    PatOS.wm.blurAll();
    PatOS.emit('wm:minimize', w);
    PatOS.sound.tone(500, 0.08, { vol: 0.04 });
  };
  M.goHome = function () { closeSwitcher(true); if (M.front) M.home(M.front); PatOS.spotlight.hide(); PatOS.panels.closeAll(); };
  M.show = function (w) {
    closeSwitcher(true);
    const wasHidden = w.minimized;
    w.minimized = false;
    w.el.style.display = ''; w.el.style.transform = ''; w.el.style.borderRadius = '';
    PatOS.wm.focus(w);
    setFront(w);
    if (wasHidden && motion()) {
      const icon = M.iconRect(w.app.id);
      const r = { left: 0, top: 0, width: innerWidth, height: innerHeight };
      w.el.animate([{ transform: icon ? PatOS.rectTransform(icon, r) : 'scale(.7)', opacity: 0.3, borderRadius: '60px' }, { transform: 'none', opacity: 1, borderRadius: '0px' }], { duration: 440, easing: 'cubic-bezier(.2,.95,.25,1.03)' });
    }
    w.emit('restore');
    PatOS.emit('wm:minimize', w);
  };

  /* ---------------- app switcher ---------------- */
  const SW = { open: false, list: [], offset: 0 };
  function recency() {
    return PatOS.wm.windows.slice().sort((a, b) => (b === M.front ? 1e9 : +b.el.style.zIndex) - (a === M.front ? 1e9 : +a.el.style.zIndex));
  }
  function layoutCards(anim) {
    const cardW = innerWidth * 0.66, gap = cardW * 0.82;
    SW.list.forEach((w, i) => {
      const x = -i * gap + SW.offset;
      w.el.style.transition = anim ? 'transform .38s cubic-bezier(.2,.9,.3,1), opacity .3s' : 'none';
      w.el.style.transform = `translateX(${x}px) translateY(-2%) scale(.66)`;
      w.el.style.zIndex = 1000 - i;
      w.el.style.opacity = Math.abs(x) > innerWidth * 1.4 ? '0' : '1';
    });
  }
  function openSwitcher(fromTransform) {
    SW.list = recency();
    const sw = $('#m-switcher'); sw.classList.remove('hidden');
    sw.classList.toggle('empty', !SW.list.length);
    html.classList.add('m-switching'); html.classList.remove('m-in-app');
    SW.open = true; SW.offset = 0;
    SW.list.forEach((w) => { w.el.style.display = ''; w.el.classList.add('m-card'); w.el.dataset.mcLabel = w.app.name; });
    if (fromTransform && SW.list[0]) { SW.list[0].el.style.transition = 'none'; SW.list[0].el.style.transform = fromTransform; void SW.list[0].el.offsetWidth; }
    requestAnimationFrame(() => layoutCards(true));
    PatOS.wm.blurAll();
  }
  function closeSwitcher(silent) {
    if (!SW.open) return;
    SW.open = false;
    $('#m-switcher').classList.add('hidden');
    html.classList.remove('m-switching');
    SW.list.forEach((w) => {
      w.el.classList.remove('m-card'); w.el.style.transition = ''; w.el.style.opacity = ''; w.el.style.transform = '';
      if (silent) { w.minimized = true; w.el.style.display = 'none'; }
    });
    if (!silent) M.front = null;
  }
  function setupSwitcherInput() {
    const layer = $('#windows');
    let st = null;
    layer.addEventListener('pointerdown', (e) => {
      if (!SW.open) return;
      const card = e.target.closest('.window.m-card'); e.preventDefault(); e.stopPropagation();
      st = { x: e.clientX, y: e.clientY, off: SW.offset, card, t: Date.now(), mode: null };
      layer.setPointerCapture(e.pointerId);
    }, true);
    layer.addEventListener('pointermove', (e) => {
      if (!SW.open || !st) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.mode && Math.hypot(dx, dy) > 8) st.mode = Math.abs(dy) > Math.abs(dx) && dy < 0 && st.card ? 'close' : 'pan';
      if (st.mode === 'pan') { SW.offset = st.off + dx; layoutCards(false); }
      if (st.mode === 'close') { st.card.style.transition = 'none'; st.card.style.transform = st.card.style.transform.replace(/translateY\([^)]*\)/, `translateY(${dy}px)`); st.dy = dy; }
    }, true);
    layer.addEventListener('pointerup', (e) => {
      if (!SW.open || !st) return;
      const s = st; st = null;
      if (s.mode === 'close') {
        const w = SW.list.find((x) => x.el === s.card);
        if (s.dy < -120 && w) { s.card.style.transition = 'transform .25s ease-in, opacity .25s'; s.card.style.transform += ` translateY(-${innerHeight}px)`; s.card.style.opacity = '0'; SW.list = SW.list.filter((x) => x !== w); setTimeout(() => { w.close(); if (!SW.list.length) { closeSwitcher(); } else layoutCards(true); }, 220); }
        else layoutCards(true);
        return;
      }
      if (s.mode === 'pan') {
        const gap = innerWidth * 0.66 * 0.82;
        SW.offset = clamp(Math.round(SW.offset / gap) * gap, 0, Math.max(0, (SW.list.length - 1) * gap)); layoutCards(true); return;
      }
      const w = s.card && SW.list.find((x) => x.el === s.card);
      if (w) {
        SW.list.forEach((x) => { if (x !== w) { x.el.style.transition = 'opacity .2s'; x.el.style.opacity = '0'; } });
        w.el.style.transition = 'transform .36s cubic-bezier(.2,.9,.3,1)'; w.el.style.transform = 'none';
        setTimeout(() => { const others = SW.list.filter((x) => x !== w); closeSwitcher(false); others.forEach((x) => { x.minimized = true; x.el.style.display = 'none'; }); w.minimized = false; M.show(w); }, 340);
      } else { const all = SW.list.slice(); closeSwitcher(false); all.forEach((x) => { x.minimized = true; x.el.style.display = 'none'; }); html.classList.remove('m-in-app'); }
    }, true);
  }

  /* ---------------- gestures ---------------- */
  function setupGestures() {
    setupSwitcherInput();
    // home indicator: swipe up = home, swipe up and pause = app switcher
    const ind = $('#m-indicator');
    let g = null;
    ind.addEventListener('pointerdown', (e) => {
      g = { y: e.clientY, x: e.clientX, t: Date.now(), last: e.clientY, lt: Date.now(), v: 0, held: 0 };
      ind.setPointerCapture(e.pointerId);
    });
    ind.addEventListener('pointermove', (e) => {
      if (!g) return;
      const now = Date.now(); g.v = (g.last - e.clientY) / Math.max(1, now - g.lt); g.last = e.clientY; g.lt = now;
      const dy = Math.max(0, g.y - e.clientY), dx = e.clientX - g.x;
      if (Math.abs(g.v) < 0.15 && dy > 120) g.held = g.held || now; else if (Math.abs(g.v) > 0.3) g.held = 0;
      if (M.front) {
        if (dy > 2) html.classList.add('m-peek'); // (the home screen shows again behind the app being swiped away)
        const s = Math.max(0.45, 1 - dy / 900);
        g.tf = `translate(${dx * 0.5}px, ${-dy * 0.55}px) scale(${s})`;
        M.front.el.style.transition = 'none';
        M.front.el.style.transform = g.tf; M.front.el.style.borderRadius = Math.min(44, dy / 3) + 'px';
      }
    });
    // a tap (no swipe) on the bar goes to whatever is under it, so the bottom of the app still works
    const passTap = (e) => {
      ind.style.pointerEvents = 'none'; const el = document.elementFromPoint(e.clientX, e.clientY); ind.style.pointerEvents = '';
      if (!el || el === ind || ind.contains(el)) return;
      if (el.matches('input, textarea, select, [contenteditable]')) el.focus(); else el.click();
    };
    const end = (e) => {
      if (!g) return;
      setTimeout(() => html.classList.remove('m-peek'), 500);
      const dy = Math.max(0, g.y - e.clientY); const s = g; g = null;
      if (e.type === 'pointerup' && dy < 8 && Math.abs(e.clientX - s.x) < 10 && Date.now() - s.t < 400) { if (M.front) { M.front.el.style.transform = ''; M.front.el.style.borderRadius = ''; } passTap(e); return; }
      const front = M.front;
      if (!front) { if (dy > 60) openSwitcher(); return; }
      front.el.style.transition = '';
      const paused = (s.held && Date.now() - s.held > 160) || (dy > 110 && Date.now() - s.lt > 220);
      if (dy < 50 && s.v < 0.5) { front.el.animate([{ transform: s.tf || 'none' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.1)' }); front.el.style.transform = ''; front.el.style.borderRadius = ''; return; }
      if (paused && s.v < 0.6) { front.el.style.borderRadius = ''; openSwitcher(s.tf); return; }
      front.el.style.transform = ''; front.el.style.borderRadius = '';
      M.home(front, s.tf);
    };
    ind.addEventListener('pointerup', end); ind.addEventListener('pointercancel', end);
    // keyboard fallback on computers in phone mode
    document.addEventListener('keydown', (e) => { if (PatOS.isMobile && PatOS.loggedIn && e.key === 'Escape' && !e.defaultPrevented) { if (SW.open) closeSwitcher(true); } });
    // pull down from the top: left = notifications, right = control center
    const status = $('#m-status');
    let p = null;
    status.addEventListener('pointerdown', (e) => { if (e.target.closest('#m-island')) return; p = { x: e.clientX, y: e.clientY }; status.setPointerCapture(e.pointerId); });
    status.addEventListener('pointerup', (e) => {
      if (!p) return; const dy = e.clientY - p.y; const x = p.x; p = null;
      if (dy > 25 || Math.abs(dy) < 6) PatOS.panels.toggle(x > innerWidth * 0.55 ? '#control-center' : '#notif-center');
    });
    // swipe down on the home screen = search
    const home = $('#m-home');
    let hs = null;
    home.addEventListener('pointerdown', (e) => { if (e.target.closest('.mh-app, .mw')) { hs = { y: e.clientY, x: e.clientX, app: true }; return; } hs = { y: e.clientY, x: e.clientX }; });
    home.addEventListener('pointerup', (e) => {
      if (!hs) return; const dy = e.clientY - hs.y, dx = Math.abs(e.clientX - hs.x); const s = hs; hs = null;
      if (dy > 70 && dx < 50 && !s.app) PatOS.spotlight.show();
    });
    // swipe up on panels closes them
    ['#control-center', '#notif-center'].forEach((sel) => {
      const el = $(sel); let s = null;
      el.addEventListener('pointerdown', (e) => { if (e.target.closest('input, button')) return; s = e.clientY; });
      el.addEventListener('pointerup', (e) => { if (s != null && s - e.clientY > 50) el.classList.add('hidden'); s = null; });
    });
  }

  /* ---------------- Dynamic Island ---------------- */
  function setupIsland() {
    $('#m-island').addEventListener('click', (e) => {
      e.stopPropagation();
      const np = PatOS.music && PatOS.music.nowPlaying && PatOS.music.nowPlaying();
      if (np) { const isl = $('#m-island'); if (isl.classList.contains('big')) PatOS.launch('music'); else { isl.classList.add('big'); setTimeout(() => isl.classList.remove('big'), 3500); } }
    });
    M.islandAlert = function (text, icon) {
      const isl = $('#m-island'); if (!isl || !PatOS.isMobile) return;
      isl.querySelector('.mi-text').textContent = text;
      isl.querySelector('.mi-art').innerHTML = icon ? PatOS.iconHTML(icon) : '';
      isl.querySelector('.mi-art').style.background = '';
      isl.classList.add('alert');
      clearTimeout(isl._t); isl._t = setTimeout(() => { isl.classList.remove('alert'); updateIsland(); }, 2600);
    };
  }
  function updateIsland() {
    const isl = $('#m-island'); if (!isl || isl.classList.contains('alert')) return;
    const np = PatOS.music && PatOS.music.nowPlaying && PatOS.music.nowPlaying();
    const playing = !!(np && np.playing);
    isl.classList.toggle('playing', playing);
    if (playing) { isl.querySelector('.mi-art').innerHTML = ''; isl.querySelector('.mi-art').style.background = np.color; isl.querySelector('.mi-text').textContent = np.title; }
  }

  /* ---------------- the app bar: Home or Back, the title, and the app's own menus ---------------- */
  const T = (x) => PatOS.t(x);
  const ICO_HOME = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.6"/><rect x="14" y="4" width="6" height="6" rx="1.6"/><rect x="4" y="14" width="6" height="6" rx="1.6"/><rect x="14" y="14" width="6" height="6" rx="1.6"/></svg>';
  const ICO_BACK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  const ICO_MORE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
  function appBar(w) {
    if (w._mbar) return w._mbar;
    const left = h('button', { class: 'mab-left' }); const title = h('div', { class: 'mab-title' }); const more = h('button', { class: 'mab-more', 'aria-label': T('More'), html: ICO_MORE });
    const bar = h('div', { class: 'm-appbar' }, left, title, more);
    w.titlebar.prepend(bar); w._mbar = { bar, left, title, more };
    let lp = null, long = false;
    left.addEventListener('pointerdown', () => { long = false; lp = setTimeout(() => { long = true; try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} openSwitcher(); }, 520); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => left.addEventListener(ev, () => clearTimeout(lp)));
    left.addEventListener('click', () => { if (long) return; if (w.el.classList.contains('m-show-detail')) M.detail(w, false); else M.goHome(); });
    left.addEventListener('contextmenu', (e) => e.preventDefault());
    more.onclick = () => moreMenu(w, more);
    return w._mbar;
  }
  function syncBar(w) {
    const b = w._mbar; if (!b) return;
    const detail = w.el.classList.contains('m-show-detail');
    b.left.innerHTML = detail ? ICO_BACK + '<span>' + PatOS.esc(w._mlistTitle || T(w.app.name)) + '</span>' : ICO_HOME;
    b.left.setAttribute('aria-label', detail ? T('Back') : T('Home Screen'));
    b.left.classList.toggle('back', detail);
    b.title.textContent = detail ? (w._mdetailTitle || w.title || T(w.app.name)) : (w.el.classList.contains('m-stack') ? (w._mlistTitle || T(w.app.name)) : (w.title || T(w.app.name)));
  }
  function moreMenu(w, btn) {
    const items = [];
    try {
      const extra = w.app.menus ? w.app.menus(w) || {} : {};
      Object.entries(extra).forEach(([name, list]) => { if (!Array.isArray(list) || !list.length) return; if (items.length) items.push({ divider: true }); list.forEach((it) => { if (it && !it.divider && !it.header) items.push(Object.assign({}, it, { shortcut: undefined })); }); });
    } catch (e) {}
    if (items.length) items.push({ divider: true });
    items.push({ label: T('App Switcher'), action: () => openSwitcher() }, { label: T('Control Center'), action: () => PatOS.panels.toggle('#control-center') }, { label: T('Close App'), action: () => w.close() });
    const r = btn.getBoundingClientRect(); PatOS.menu(items, r.right - 220, r.bottom + 6);
  }
  /* list → detail screens (Notes, Settings, Contacts…): apps mark their two panes with m-list and m-detail
     and call PatOS.mobile.detail(win, true) when something is picked */
  M.stack = function (win, listTitle) { win.el.classList.add('m-stack'); win._mlistTitle = listTitle; if (win._mbar) syncBar(win); };
  M.detail = function (win, on, title) {
    if (!win || !PatOS.isMobile) return;
    const was = win.el.classList.contains('m-show-detail');
    win.el.classList.toggle('m-show-detail', !!on); if (title !== undefined) win._mdetailTitle = title;
    if (on && !was) { pushApp('detail'); if (motion()) { const d = win.el.querySelector('.m-detail'); if (d) d.animate([{ transform: 'translateX(28%)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1)' }); } }
    if (!on && was) { popApp('detail'); win.emit('m-back'); }
    syncBar(win);
  };
  M.inDetail = (win) => !!(win && win.el.classList.contains('m-show-detail'));

  /* ---------------- the back button of the phone (Android) and Safari's swipe back ---------------- */
  // depth = how many history entries PatOS added on top of the page: 1 inside an app, 2 inside a detail screen.
  // Going back in history happens a moment later, so a new entry waits until that has finished
  // (otherwise opening an app right after closing one would get the history out of step).
  let depth = 0, ignorePop = 0, quiet = false, pending = 0, queued = null;
  function pushApp(kind) {
    if (!PatOS.isMobile || !history.pushState) return;
    if (pending) { queued = kind || 'app'; return; }
    if (kind !== 'detail' && depth >= 1) return;
    try { history.pushState({ patos: kind || 'app' }, ''); depth++; } catch (e) {}
  }
  function popApp(kind) {
    if (quiet) return;
    if (kind !== 'detail') queued = null;
    if (!depth) return;
    if (kind === 'detail') { if (depth < 2) return; depth--; ignorePop++; pending++; history.back(); return; }
    const n = depth; depth = 0; ignorePop++; pending++; // history.go(-n) sends one popstate, whatever n is
    try { history.go(-n); } catch (e) { ignorePop--; pending--; }
  }
  function settle() {
    pending = Math.max(0, pending - 1);
    if (!pending && queued) { const k = queued; queued = null; if (M.front) { if (k === 'detail' && depth < 1) pushApp('app'); pushApp(k); } }
  }
  function setupHistory() {
    window.addEventListener('popstate', () => {
      if (!PatOS.isMobile) return;
      if (ignorePop > 0) { ignorePop--; settle(); return; }
      depth = Math.max(0, depth - 1); // the phone's back button (or a swipe back) took one step
      if (SW.open) { closeSwitcher(true); return; }
      const w = M.front;
      if (w && w.el.classList.contains('m-show-detail')) { w.el.classList.remove('m-show-detail'); w.emit('m-back'); syncBar(w); return; }
      if (w) { quiet = true; try { M.home(w); } finally { quiet = false; } depth = 0; }
    });
  }

  /* ---------------- the screen: keyboard and the real visible height ---------------- */
  function setupViewport() {
    const vv = window.visualViewport;
    const upd = () => {
      const hgt = vv ? vv.height : innerHeight, top = vv ? vv.offsetTop : 0;
      html.style.setProperty('--vvh', Math.round(hgt) + 'px'); html.style.setProperty('--vvt', Math.round(top) + 'px');
      const kb = Math.max(0, innerHeight - hgt - top);
      html.classList.toggle('m-kb', kb > 120);
      if (kb > 120) { const a = document.activeElement; if (a && a.scrollIntoView && /INPUT|TEXTAREA/.test(a.tagName) || (a && a.isContentEditable)) setTimeout(() => { try { a.scrollIntoView({ block: 'nearest' }); } catch (e) {} }, 60); }
    };
    if (vv) { vv.addEventListener('resize', upd); vv.addEventListener('scroll', upd); }
    window.addEventListener('resize', upd); window.addEventListener('orientationchange', () => setTimeout(() => { upd(); renderHome(); }, 300));
    upd();
  }

  /* ---------------- notifications: one banner at a time, swipe up to dismiss ---------------- */
  function setupBanners() {
    const box = $('#toasts'); if (!box) return;
    new MutationObserver((muts) => {
      if (!PatOS.isMobile) return;
      const added = []; muts.forEach((m) => m.addedNodes.forEach((t) => { if (t instanceof HTMLElement && t.classList.contains('toast') && t.isConnected) added.push(t); }));
      if (!added.length) return;
      const newest = added[added.length - 1];
      // a banner on a phone leaves after 4 seconds at most (tap it to act, swipe it up to dismiss)
      setTimeout(() => { if (newest.isConnected) { newest.classList.remove('in'); setTimeout(() => newest.remove(), 400); } }, 4000);
      [...box.children].forEach((o) => { if (o !== newest) o.remove(); }); // one banner at a time: the newest
      [newest].forEach((t) => {
        let sy = null, dy = 0;
        t.addEventListener('pointerdown', (e) => { sy = e.clientY; dy = 0; t.style.transition = 'none'; });
        t.addEventListener('pointermove', (e) => { if (sy == null) return; dy = Math.min(0, e.clientY - sy); t.style.transform = 'translateY(' + dy + 'px)'; });
        const end = (e) => { if (sy == null) return; sy = null; t.style.transition = ''; if (dy < -30) { e.stopPropagation(); t.style.transform = 'translateY(-160px)'; setTimeout(() => t.remove(), 250); } else t.style.transform = ''; };
        t.addEventListener('pointerup', end, true); t.addEventListener('pointercancel', end);
      });
    }).observe(box, { childList: true });
  }

  /* ---------------- swipes from the top of the Home Screen (there is no fake status bar on a real phone) ---------------- */
  function setupTopEdge() {
    const home = $('#m-home'); let st = null;
    home.addEventListener('pointerdown', (e) => { const zone = parseFloat(getComputedStyle(html).getPropertyValue('--sat')) + 44; if (e.clientY > zone || e.target.closest('.mh-app, .mw, .mh-search')) return; st = { x: e.clientX, y: e.clientY }; });
    home.addEventListener('pointerup', (e) => {
      if (!st) return; const dy = e.clientY - st.y, x = st.x; st = null; if (dy < 40) return;
      if (x > innerWidth * 0.6) PatOS.panels.toggle('#control-center'); else if (x < innerWidth * 0.4) PatOS.panels.toggle('#notif-center');
    });
  }

  /* ---------------- mode switching ---------------- */
  function enter() {
    build();
    renderHome();
    $('#launchpad').classList.add('hidden');
    PatOS.mission && PatOS.mission.exit();
    const vis = PatOS.wm.windows.filter((w) => !w.minimized).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
    if (vis[0]) setFront(vis[0]); else html.classList.remove('m-in-app');
  }
  function leave() {
    closeSwitcher(true);
    html.classList.remove('m-in-app', 'm-switching');
    $$('.window').forEach((e) => e.classList.remove('m-front'));
    if (M.front) { M.front.minimized = false; M.front.el.style.display = ''; }
    M.front = null;
    PatOS.dock && PatOS.dock.render();
  }
  PatOS.on('mode', (m) => { if (!PatOS.loggedIn && !M.built) return; m ? enter() : leave(); });
  M.init = function () { if (PatOS.isMobile) enter(); };
})();
