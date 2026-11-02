/* PatOS Mobile: the phone shell (home screen, status bar, Dynamic Island, gestures, app switcher) */
(function () {
  'use strict';
  const { h, $, $$, clamp } = PatOS;
  const M = (PatOS.mobile = { front: null, built: false });
  const html = document.documentElement;
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
    const home = h('div', { id: 'm-home' },
      h('div', { class: 'mh-pages' }),
      h('div', { class: 'mh-dots' }),
      h('div', { class: 'mh-dock' }));
    const ind = h('div', { id: 'm-indicator' }, h('span'));
    const sw = h('div', { id: 'm-switcher', class: 'hidden' }, h('div', { class: 'msw-empty' }, 'No recent apps'));
    desk.insertBefore(home, $('#windows'));
    desk.append(sw, status, ind);
    renderHome();
    setupGestures();
    setupIsland();
    tickStatus(); setInterval(tickStatus, 1000);
    if (navigator.getBattery) navigator.getBattery().then((b) => { const up = () => { $('.ms-bat-fill').style.width = Math.round(b.level * 100) + '%'; $('.ms-bat').classList.toggle('charging', b.charging); }; up(); b.addEventListener('levelchange', up); b.addEventListener('chargingchange', up); }).catch(() => {});
    window.addEventListener('resize', PatOS.debounce(() => { if (PatOS.isMobile) renderHome(); }, 200));
    PatOS.on('setting', (s) => { if (['mobileDock', 'hiddenApps', 'dockPinned'].includes(s.key)) renderHome(); });
    PatOS.on('wm:open', (w) => { if (PatOS.isMobile) setFront(w); });
    PatOS.on('wm:focus', (w) => { if (PatOS.isMobile && w) setFront(w); });
    PatOS.on('wm:close', (w) => { if (M.front === w) { M.front = null; html.classList.remove('m-in-app'); } });
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
    const events = (PatOS.store.get('calendar', {})[PatOS.dateKey ? PatOS.dateKey(d) : ''] || []);
    const rem = PatOS.store.get('reminders', []).filter((r) => !r.done);
    const cal = h('div', { class: 'mw mw-cal' },
      h('div', { class: 'mw-day' }, d.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()),
      h('div', { class: 'mw-num' }, d.getDate()),
      h('div', { class: 'mw-ev' }, events[0] ? (events[0].time ? events[0].time + ' ' : '') + events[0].title : rem[0] ? '○ ' + rem[0].text : 'No events today'));
    cal.onclick = () => PatOS.launch(events[0] ? 'calendar' : 'reminders');
    return [clock, cal];
  }
  function renderHome() {
    const pages = $('.mh-pages'); if (!pages) return;
    const keep = pages.scrollLeft;
    pages.innerHTML = '';
    const ids = homeApps();
    const avail = window.innerHeight - 64 - 120 - 30; // status + dock + dots
    const rows = Math.max(3, Math.floor(avail / 98));
    const per = rows * 4;
    const firstPer = Math.max(4, per - 8); // page 1 carries two widgets (2x2 each)
    const chunks = [ids.slice(0, firstPer)];
    for (let i = firstPer; i < ids.length; i += per) chunks.push(ids.slice(i, i + per));
    chunks.forEach((list, pi) => {
      const page = h('div', { class: 'mh-page' });
      const grid = h('div', { class: 'mh-grid', style: { gridTemplateRows: `repeat(${rows}, 98px)` } });
      if (pi === 0) homeWidgets().forEach((w) => grid.appendChild(w));
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
        const s = Math.max(0.45, 1 - dy / 900);
        g.tf = `translate(${dx * 0.5}px, ${-dy * 0.55}px) scale(${s})`;
        M.front.el.style.transition = 'none';
        M.front.el.style.transform = g.tf; M.front.el.style.borderRadius = Math.min(44, dy / 3) + 'px';
      }
    });
    const end = (e) => {
      if (!g) return;
      const dy = Math.max(0, g.y - e.clientY); const s = g; g = null;
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
