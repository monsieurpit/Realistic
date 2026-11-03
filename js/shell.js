/* PatOS shell: menu bar, dock, launchpad, spotlight, control center, notifications, desktop, mission control */
(function () {
  'use strict';
  const { h, $, $$, esc, clamp } = PatOS;

  /* =========================== DIALOGS (replace prompt/confirm, which artifacts & some kiosks block) =========================== */
  function dialog(opts) {
    return new Promise((resolve) => {
      const layer = h('div', { class: 'dlg-layer' });
      const input = opts.input != null ? h('input', { class: 'field dlg-in', value: opts.input, spellcheck: 'false', type: opts.password ? 'password' : 'text', autocomplete: opts.password ? 'new-password' : 'off' }) : null;
      const done = (v) => { layer.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const ok = h('button', { class: 'btn ' + (opts.danger ? 'danger' : 'primary') }, opts.ok || 'OK');
      const cancel = h('button', { class: 'btn' }, 'Cancel');
      ok.onclick = () => done(input ? input.value : true);
      cancel.onclick = () => done(input ? null : false);
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel.click(); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ok.click(); } };
      document.addEventListener('keydown', onKey, true);
      layer.appendChild(h('div', { class: 'dlg' }, h('div', { class: 'dlg-ic', html: PatOS.iconHTML(opts.icon || 'about') }), h('b', {}, opts.title || 'PatOS'), opts.text ? h('p', {}, opts.text) : null, input, h('div', { class: 'dlg-btns' }, opts.noCancel ? null : cancel, ok)));
      document.body.appendChild(layer);
      setTimeout(() => { if (input) { input.focus(); input.select(); } else ok.focus(); }, 30);
    });
  }
  PatOS.ask = (title, value, opts) => dialog(Object.assign({ title, input: value == null ? '' : value }, opts));
  PatOS.confirmBox = (title, text, opts) => dialog(Object.assign({ title, text }, opts));
  PatOS.alertBox = (title, text, opts) => dialog(Object.assign({ title, text, noCancel: true }, opts));

  /* =========================== CONTEXT / DROPDOWN MENUS =========================== */
  let openMenu = null;
  function closeMenus() {
    if (openMenu) { openMenu.el.remove(); openMenu.onClose && openMenu.onClose(); openMenu = null; }
    $$('#menubar .open').forEach((b) => b.classList.remove('open'));
  }
  /* items: [{label, action, shortcut, disabled, checked, divider, submenu}] */
  PatOS.menu = function (items, x, y, opts) {
    closeMenus();
    opts = opts || {};
    const el = h('div', { class: 'menu' });
    items.forEach((it) => {
      if (!it) return;
      if (it.divider) return el.appendChild(h('div', { class: 'menu-div' }));
      if (it.header) return el.appendChild(h('div', { class: 'menu-header' }, it.header));
      const row = h('div', { class: 'menu-item' + (it.disabled ? ' disabled' : '') },
        h('span', { class: 'menu-check' }, it.checked ? '✓' : ''),
        h('span', { class: 'menu-label' }, it.label),
        it.shortcut ? h('span', { class: 'menu-sc' }, it.shortcut) : null);
      if (!it.disabled) row.addEventListener('click', (e) => { e.stopPropagation(); closeMenus(); it.action && it.action(); });
      el.appendChild(row);
    });
    $('#menu-layer').appendChild(el);
    const r = el.getBoundingClientRect();
    el.style.left = clamp(x, 4, innerWidth - r.width - 4) + 'px';
    el.style.top = (y + r.height > innerHeight - 4 ? Math.max(4, y - r.height) : y) + 'px';
    openMenu = { el, onClose: opts.onClose };
    return el;
  };
  PatOS.closeMenus = closeMenus;
  PatOS.setLaunchRect = (el) => { if (!el) return; const r = el.getBoundingClientRect(); PatOS._launchRect = { left: r.left, top: r.top, width: r.width, height: r.height, t: Date.now() }; };
  document.addEventListener('pointerdown', (e) => { if (openMenu && !e.target.closest('.menu') && !e.target.closest('#menubar [data-menu]')) closeMenus(); });

  /* =========================== NOTIFICATIONS =========================== */
  const notifs = [];
  PatOS.notify = function (n) {
    n = Object.assign({ title: 'PatOS', body: '', icon: 'about', time: new Date() }, n);
    notifs.unshift(n); if (notifs.length > 30) notifs.pop();
    // screen readers: announce it; other tabs: show a real browser notification
    try { let lr = document.getElementById('sr-live'); if (!lr) { lr = document.createElement('div'); lr.id = 'sr-live'; lr.setAttribute('aria-live', 'polite'); lr.setAttribute('role', 'status'); lr.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)'; document.body.appendChild(lr); } if (PatOS.settings.srAnnounce !== false) lr.textContent = n.title + '. ' + n.body; } catch (e) {}
    if (document.hidden && PatOS.settings.systemNotifications !== false && window.Notification && Notification.permission === 'granted') { try { const sn = new Notification(n.title, { body: n.body, icon: 'assets/icon-180.png' }); sn.onclick = () => { window.focus(); n.onClick && n.onClick(); sn.close(); }; } catch (e) {} }
    if (PatOS.focusMode) return;
    PatOS.sound.notify();
    const t = h('div', { class: 'toast' },
      h('div', { class: 'toast-icon', html: PatOS.iconHTML(n.icon) }),
      h('div', { class: 'toast-text' }, h('div', { class: 'toast-app' }, (PatOS.apps[n.icon] && PatOS.apps[n.icon].name) || 'PatOS', h('span', {}, 'now')), h('b', {}, n.title), h('div', {}, n.body)));
    t.addEventListener('click', () => { t.remove(); n.onClick && n.onClick(); });
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, n.duration || 4500);
  };

  /* =========================== MENU BAR =========================== */
  function activeAppId() { const w = PatOS.wm.active; return w ? w.app.id : 'finder'; }
  function appMenus(appId) {
    const app = PatOS.apps[appId] || PatOS.apps.finder;
    const w = PatOS.wm.active;
    const extra = (app.menus && w) ? app.menus(w) : {};
    return {
      app: [
        { label: 'About ' + app.name, action: () => PatOS.notify({ title: app.name, body: app.about || ('Part of PatOS ' + PatOS.version), icon: app.id }) },
        { divider: true },
        { label: 'Settings…', action: () => PatOS.launch('settings') },
        { divider: true },
        { label: 'Hide ' + app.name, shortcut: 'Alt+H', action: () => PatOS.wm.windowsOf(app.id).forEach((x) => x.minimize()), disabled: !w },
        { label: 'Quit ' + app.name, shortcut: 'Alt+Q', action: () => PatOS.wm.quit(app.id), disabled: !PatOS.wm.isRunning(app.id) }
      ],
      file: extra.file || [
        { label: 'New Window', shortcut: 'Alt+N', action: () => newWindow(appId) },
        { label: 'New Folder on Desktop', action: () => newFolder('/Desktop') },
        { label: 'Open Finder', action: () => PatOS.launch('finder') },
        { divider: true },
        { label: 'Close Window', shortcut: 'Alt+W', action: () => w && w.close(), disabled: !w }
      ],
      edit: extra.edit || [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
        { divider: true },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => navigator.clipboard && navigator.clipboard.readText().then((t) => document.execCommand('insertText', false, t)).catch(() => {}) },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') }
      ],
      view: extra.view || [
        { label: 'Enter Full Screen', shortcut: 'F11', action: toggleFullscreen },
        { label: 'Mission Control', shortcut: 'Alt+↑', action: () => PatOS.mission.toggle() },
        { label: 'Launchpad', shortcut: 'Alt+L', action: () => PatOS.launchpad.toggle() },
        { divider: true },
        { label: PatOS.settings.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode', action: () => PatOS.setSetting('theme', PatOS.settings.theme === 'dark' ? 'light' : 'dark') }
      ],
      window: [
        { label: 'Minimize', shortcut: 'Alt+M', action: () => w && w.minimize(), disabled: !w },
        { label: 'Zoom', action: () => w && w.toggleMax(), disabled: !w },
        { label: w && w.fullscreen ? 'Exit Full Screen' : 'Enter Full Screen', shortcut: 'Alt+F', action: () => w && w.toggleFullscreen && w.toggleFullscreen(), disabled: !w || w.app.resizable === false },
        { label: 'Tile Left', action: () => w && tile(w, 'left'), disabled: !w },
        { label: 'Tile Right', action: () => w && tile(w, 'right'), disabled: !w },
        { divider: true },
        { label: 'Bring All to Front', action: () => PatOS.wm.windows.forEach((x) => PatOS.wm.restore(x)) },
        { divider: true },
        ...PatOS.wm.windows.map((x) => ({ label: x.title, checked: x === w, action: () => PatOS.wm.restore(x) }))
      ],
      help: [
        { label: 'PatOS Help', action: () => PatOS.openFile(PatOS.fs.exists('/Desktop/Bienvenue dans PatOS.txt') ? '/Desktop/Bienvenue dans PatOS.txt' : '/Desktop/Welcome to PatOS.txt') },
        { label: 'Keyboard Shortcuts', action: () => PatOS.launch('settings', { pane: 'keyboard' }) },
        { label: 'About PatOS', action: () => PatOS.launch('about') }
      ],
      system: [
        { label: 'About PatOS', action: () => PatOS.launch('about') },
        { divider: true },
        { label: 'System Settings…', action: () => PatOS.launch('settings') },
        { label: 'App Library (Launchpad)', action: () => PatOS.launchpad.show() },
        { divider: true },
        { label: 'Force Quit…', action: () => PatOS.launch('activity') },
        { divider: true },
        { label: 'Sleep', action: () => PatOS.power.sleep() },
        { label: 'Restart…', action: () => PatOS.power.restart() },
        { label: 'Shut Down…', action: () => PatOS.power.shutdown() },
        { divider: true },
        { label: 'Lock Screen', shortcut: 'Alt+Esc', action: () => PatOS.power.lock() },
        { label: 'Log Out ' + PatOS.settings.userName + '…', action: () => { PatOS.wm.closeAll(); PatOS.power.lock(); } }
      ]
    };
  }
  function tile(w, side) {
    const a = PatOS.wm.workArea(); w.prevRect = w.rect(); w.maximized = false; w.el.classList.remove('maximized');
    w.el.classList.add('animating');
    Object.assign(w.el.style, { left: (side === 'left' ? 0 : a.w / 2) + 'px', top: a.y + 'px', width: a.w / 2 + 'px', height: a.h + 'px' });
    setTimeout(() => w.el.classList.remove('animating'), 320);
  }
  function newWindow(appId) {
    const app = PatOS.apps[appId];
    if (!app || app.action) return PatOS.launch('finder');
    if (app.single) return PatOS.launch(appId);
    PatOS.launch(appId);
  }
  function newFolder(dir) {
    const name = PatOS.fs.uniqueName(dir, 'untitled folder');
    PatOS.fs.mkdir(dir + '/' + name);
    return name;
  }
  PatOS.newFolder = newFolder;

  function setupMenubar() {
    const mb = $('#menubar');
    let hoverMode = false;
    function openFor(btn) {
      const key = btn.dataset.menu;
      const menus = appMenus(activeAppId());
      const items = menus[key]; if (!items) return;
      const r = btn.getBoundingClientRect();
      PatOS.menu(items, r.left, r.bottom + 3, { onClose: () => { hoverMode = false; } });
      btn.classList.add('open'); hoverMode = true;
    }
    mb.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-menu]'); if (!btn) return;
      if (btn.classList.contains('open')) { closeMenus(); return; }
      openFor(btn);
    });
    mb.addEventListener('pointerover', (e) => {
      const btn = e.target.closest('[data-menu]');
      if (!btn || !hoverMode || btn.classList.contains('open')) return;
      openFor(btn);
    });
    PatOS.on('wm:focus', (w) => {
      const app = w ? w.app : PatOS.apps.finder;
      $('.mb-app').textContent = app.name;
    });

    // status icons
    $('#mb-wifi').innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 18.5a1.6 1.6 0 1 0 0 .01zM5.6 12.2a9 9 0 0 1 12.8 0l-1.5 1.5a6.9 6.9 0 0 0-9.8 0zM2.4 9a13.5 13.5 0 0 1 19.2 0l-1.5 1.5a11.4 11.4 0 0 0-16.2 0zM8.8 15.4a4.5 4.5 0 0 1 6.4 0L12 18.6z" fill="currentColor"/></svg>';
    $('#mb-search').innerHTML = '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    $('#mb-cc').innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="5.5" rx="2.75" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7.6" cy="7.75" r="1.7" fill="currentColor"/><rect x="3" y="13.5" width="18" height="5.5" rx="2.75" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16.4" cy="16.25" r="1.7" fill="currentColor"/></svg>';
    $('#mb-search').addEventListener('click', () => PatOS.spotlight.toggle());
    $('#mb-cc').addEventListener('click', (e) => { e.stopPropagation(); togglePanel('#control-center'); });
    $('#mb-clock').addEventListener('click', (e) => { e.stopPropagation(); togglePanel('#notif-center'); });
    $('#mb-wifi').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      PatOS.menu([
        { header: 'Wi-Fi' },
        { label: navigator.onLine ? 'Connected' : 'Not connected', checked: navigator.onLine, disabled: true },
        { divider: true },
        { label: 'Network Settings…', action: () => PatOS.launch('settings', { pane: 'network' }) }
      ], r.left - 120, r.bottom + 3);
    });

    function tick() {
      const d = new Date();
      const opts = { hour: 'numeric', minute: '2-digit', hour12: !PatOS.settings.clock24 };
      if (PatOS.settings.showSeconds) opts.second = '2-digit';
      $('#mb-clock').textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + '  ' + d.toLocaleTimeString(undefined, opts);
      $('#mb-wifi').classList.toggle('off', !navigator.onLine);
    }
    tick(); setInterval(tick, 1000);

    // battery (Chromebooks support the Battery API)
    const bat = $('#mb-battery');
    const drawBat = (level, charging) => {
      const pct = Math.round(level * 100);
      bat.innerHTML = `<span class="bat-pct">${pct}%</span><span class="bat"><span class="bat-fill${pct <= 20 ? ' low' : ''}" style="width:${pct}%"></span>${charging ? '<span class="bat-bolt">⚡</span>' : ''}</span>`;
      bat.title = 'Battery ' + pct + '%' + (charging ? ' (charging)' : '');
    };
    if (navigator.getBattery) navigator.getBattery().then((b) => {
      const up = () => drawBat(b.level, b.charging); up();
      b.addEventListener('levelchange', up); b.addEventListener('chargingchange', up);
    }).catch(() => drawBat(1, true)); else drawBat(1, true);
  }

  /* =========================== PANELS (control center + notification center) =========================== */
  function togglePanel(sel) {
    const p = $(sel); const other = sel === '#control-center' ? '#notif-center' : '#control-center';
    $(other).classList.add('hidden');
    if (p.classList.contains('hidden')) { (sel === '#control-center' ? renderCC : renderNC)(); p.classList.remove('hidden'); }
    else p.classList.add('hidden');
  }
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#control-center, #mb-cc')) $('#control-center') && $('#control-center').classList.add('hidden');
    if (!e.target.closest('#notif-center, #mb-clock')) $('#notif-center') && $('#notif-center').classList.add('hidden');
  });

  PatOS.panels = { toggle: (sel) => togglePanel(sel), closeAll: () => { $('#control-center').classList.add('hidden'); $('#notif-center').classList.add('hidden'); } };
  PatOS.focusMode = false;
  let wakeLock = null, muted = false, preMute = 0.7;
  async function toggleWake() {
    try {
      if (wakeLock) { await wakeLock.release(); wakeLock = null; }
      else if (navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      else PatOS.notify({ title: 'Not supported', body: 'This browser can’t keep the screen on.', icon: 'settings' });
    } catch (e) { PatOS.notify({ title: 'Couldn’t keep the screen on', body: e.message, icon: 'settings' }); }
    renderCC();
  }
  function renderCC() {
    const s = PatOS.settings; const cc = $('#control-center'); cc.innerHTML = '';
    const tog = (label, sub, on, icon, fn) => {
      const b = h('button', { class: 'cc-toggle' + (on ? ' on' : '') }, h('span', { class: 'cc-dot', html: PatOS.symPaths[icon] ? PatOS.sym(icon) : icon }), h('span', { class: 'cc-tl' }, h('b', {}, label), h('small', {}, sub)));
      b.addEventListener('click', () => { fn(); renderCC(); }); return b;
    };
    const conn = h('div', { class: 'cc-tile cc-conn' },
      tog('Wi-Fi', navigator.onLine ? ((navigator.connection && navigator.connection.effectiveType) ? 'Connected · ' + navigator.connection.effectiveType.toUpperCase() : 'Connected') : 'No Internet', navigator.onLine, 'wifi', () => PatOS.launch('settings', { pane: 'network' })),
      tog('Keep Screen On', wakeLock ? 'On' : 'Off', !!wakeLock, 'sun', toggleWake),
      tog('Mute', muted ? 'Sound off' : 'Sound on', muted, 'mute', () => { if (muted) { PatOS.setSetting('volume', preMute || 0.7); muted = false; } else { preMute = s.volume; PatOS.setSetting('volume', 0); muted = true; } }));
    const side = h('div', { class: 'cc-side' },
      h('div', { class: 'cc-tile' }, tog('Focus', PatOS.focusMode ? 'Do Not Disturb' : 'Off', PatOS.focusMode, 'moon', () => { PatOS.focusMode = !PatOS.focusMode; })),
      h('div', { class: 'cc-tile cc-row2' },
        tog(s.theme === 'dark' ? 'Dark' : 'Light', 'Appearance', s.theme === 'dark', 'contrast', () => PatOS.setSetting('theme', s.theme === 'dark' ? 'light' : 'dark')),
        tog('Full Screen', document.fullscreenElement ? 'On' : 'Off', !!document.fullscreenElement, 'fullscreen', toggleFullscreen)));
    const slider = (label, val, icon, fn, min) => {
      const input = h('input', { type: 'range', min: min || 0, max: 100, value: Math.round(val * 100) });
      input.addEventListener('input', () => fn(input.value / 100));
      return h('div', { class: 'cc-tile cc-slider' }, h('b', {}, label), h('div', { class: 'cc-range' }, h('span', { class: 'symw', html: PatOS.sym(icon) }), input));
    };
    const live = PatOS.wallpaper.live[s.wallpaper];
    cc.append(...[
      h('div', { class: 'cc-grid' }, conn, side),
      slider('Display', s.brightness, 'sun', (v) => PatOS.setSetting('brightness', v), 20),
      slider('Sound', s.volume, 'speaker', (v) => PatOS.setSetting('volume', v)),
      h('div', { class: 'cc-tile cc-row2' },
        tog('3D Wallpaper', live ? (s.live3d ? 'Animating' : 'Paused') : 'Pick in Settings', live && s.live3d, 'sparkle', () => { if (live) PatOS.setSetting('live3d', !s.live3d); else PatOS.launch('settings', { pane: 'wallpaper' }); }),
        tog('UI Sounds', s.uiSounds ? 'On' : 'Off', s.uiSounds, 'note', () => PatOS.setSetting('uiSounds', !s.uiSounds))),
      PatOS.music && PatOS.music.nowPlaying ? nowPlayingTile() : null
    ].filter(Boolean));
  }
  function nowPlayingTile() {
    const np = PatOS.music.nowPlaying();
    if (!np) return null;
    const tile = h('div', { class: 'cc-tile cc-np' },
      h('div', { class: 'cc-np-art', style: { background: np.color } }),
      h('div', { class: 'cc-np-t' }, h('b', {}, np.title), h('small', {}, np.artist)),
      h('button', { onclick: () => { PatOS.music.prev(); renderCC(); } }, '⏮'),
      h('button', { onclick: () => { PatOS.music.toggle(); setTimeout(renderCC, 50); } }, np.playing ? '⏸' : '▶'),
      h('button', { onclick: () => { PatOS.music.next(); renderCC(); } }, '⏭'));
    return tile;
  }

  function buildWidgets() {
    const d = new Date();
    // calendar widget
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const cal = h('div', { class: 'widget w-cal' }, h('div', { class: 'w-cal-m' }, d.toLocaleDateString(undefined, { month: 'long' }).toUpperCase()));
    const grid = h('div', { class: 'w-cal-g' });
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((x) => grid.appendChild(h('span', { class: 'dn' }, x)));
    for (let i = 0; i < first; i++) grid.appendChild(h('span'));
    for (let i = 1; i <= days; i++) grid.appendChild(h('span', { class: i === d.getDate() ? 'today' : '' }, i));
    cal.appendChild(grid);
    cal.addEventListener('click', () => PatOS.launch('calendar'));
    // clock widget
    const clock = h('div', { class: 'widget w-clock' }, h('canvas', { width: 120, height: 120 }));
    drawAnalog(clock.firstChild, d);
    clock.addEventListener('click', () => PatOS.launch('clock'));
    // events
    const events = (PatOS.store.get('calendar', {})[PatOS.dateKey ? PatOS.dateKey(d) : ''] || []);
    const up = h('div', { class: 'widget w-up' }, h('b', {}, 'Today'),
      events.length ? events.map((e) => h('div', { class: 'w-ev' }, e.time ? e.time + ' · ' : '', e.title)) : h('div', { class: 'w-muted' }, 'No events today'));
    const rem = PatOS.store.get('reminders', []).filter((r) => !r.done).slice(0, 4);
    const remW = h('div', { class: 'widget w-up' }, h('b', {}, 'Reminders'),
      rem.length ? rem.map((r) => h('div', { class: 'w-ev' }, '○ ' + r.text)) : h('div', { class: 'w-muted' }, 'All done!'));
    remW.addEventListener('click', () => PatOS.launch('reminders'));
    const np = PatOS.music && PatOS.music.nowPlaying && PatOS.music.nowPlaying();
    const music = h('div', { class: 'widget w-music' }, h('div', { class: 'w-np-art', style: { background: np ? np.color : 'linear-gradient(135deg,#ff6482,#fa233b)' } }, '♫'), h('b', {}, np ? np.title : 'Music'), h('small', {}, np ? (np.playing ? 'Now playing · ' : 'Paused · ') + np.artist : 'Tap to play a song'));
    music.addEventListener('click', () => PatOS.launch('music'));
    return { cal, clock, up, remW, music };
  }
  PatOS.buildWidgets = buildWidgets;
  function renderNC() {
    const nc = $('#notif-center'); nc.innerHTML = '';
    const { cal, clock, up, remW } = buildWidgets();
    const list = h('div', { class: 'nc-list' },
      h('div', { class: 'nc-head' }, h('b', {}, 'Notifications'), notifs.length ? h('button', { onclick: () => { notifs.length = 0; renderNC(); } }, 'Clear') : null),
      notifs.length ? notifs.slice(0, 8).map((n) => h('div', { class: 'toast in static' },
        h('div', { class: 'toast-icon', html: PatOS.iconHTML(n.icon) }),
        h('div', { class: 'toast-text' }, h('b', {}, n.title), h('div', {}, n.body)))) : h('div', { class: 'w-muted pad' }, 'No new notifications'));
    nc.append(list, h('div', { class: 'nc-widgets' }, cal, clock, up, remW));
  }
  function drawAnalog(cv, d) {
    const x = cv.getContext('2d'); const W = cv.width, R = W / 2 - 4;
    x.clearRect(0, 0, W, W); x.save(); x.translate(W / 2, W / 2);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1c1c1e'; x.font = '600 11px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; x.fillText(i, Math.sin(a) * (R - 12), -Math.cos(a) * (R - 12)); }
    const hand = (a, len, w, c) => { x.save(); x.rotate(a); x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 6); x.lineTo(0, -len); x.stroke(); x.restore(); };
    hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, R * 0.5, 4, '#1c1c1e');
    hand((d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2, R * 0.75, 3, '#1c1c1e');
    hand(d.getSeconds() / 60 * Math.PI * 2, R * 0.82, 1.2, '#ff9f0a');
    x.fillStyle = '#ff9f0a'; x.beginPath(); x.arc(0, 0, 3, 0, Math.PI * 2); x.fill(); x.restore();
  }
  PatOS.drawAnalog = drawAnalog;

  /* =========================== DOCK =========================== */
  const dockEl = () => $('#dock');
  function dockItems() {
    const pinned = PatOS.settings.dockPinned.filter((id) => PatOS.apps[id]);
    const running = [...new Set(PatOS.wm.windows.map((w) => w.app.id))].filter((id) => !pinned.includes(id));
    return { pinned, running };
  }
  function renderDock() {
    const d = dockEl(); d.innerHTML = '';
    const { pinned, running } = dockItems();
    const mk = (id) => {
      const app = PatOS.apps[id];
      const item = h('div', { class: 'dock-item' + (PatOS.wm.isRunning(id) ? ' running' : ''), 'data-app': id, title: '', role: 'button', tabindex: '0', 'aria-label': app.name },
        h('div', { class: 'dock-label' }, app.name),
        h('div', { class: 'dock-icon', html: PatOS.iconHTML(app.icon || id) }),
        h('div', { class: 'dock-dot' }));
      item.addEventListener('click', () => { if (dockDrag.justDropped) return; PatOS.setLaunchRect(item.querySelector('.dock-icon')); dockClick(id); });
      item.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!dockDrag.active) dockMenu(id, item); });
      item.addEventListener('pointerdown', (e) => dockPress(e, id, item));
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } });
      return item;
    };
    pinned.forEach((id) => d.appendChild(mk(id)));
    if (running.length) { d.appendChild(h('div', { class: 'dock-sep' })); running.forEach((id) => d.appendChild(mk(id))); }
    d.appendChild(h('div', { class: 'dock-sep' }));
    const full = PatOS.fs.trashList().length > 0;
    const trash = h('div', { class: 'dock-item', 'data-app': 'trash' },
      h('div', { class: 'dock-label' }, 'Trash'), h('div', { class: 'dock-icon', html: PatOS.iconHTML('trash', full) }), h('div', { class: 'dock-dot' }));
    trash.addEventListener('click', () => PatOS.launch('finder', { path: '/.Trash' }));
    trash.addEventListener('contextmenu', (e) => { e.preventDefault(); const r = trash.getBoundingClientRect(); PatOS.menu([{ label: 'Open', action: () => PatOS.launch('finder', { path: '/.Trash' }) }, { label: 'Empty Trash', disabled: !full, action: () => { PatOS.fs.emptyTrash(); PatOS.sound.trash(); } }], r.left, r.top - 80); });
    d.appendChild(trash);
    applyDockSize();
  }
  /* ---------- rearrange the Dock: press and hold an icon, then drag it ----------
     Drop it somewhere else in the Dock to move it, or drag it up and away to remove it. */
  const dockDrag = { active: false, justDropped: false };
  function dockPress(e, id, item) {
    if (e.button !== 0 || e.pointerType === 'touch' && PatOS.isMobile) return;
    const sx = e.clientX, sy = e.clientY; let started = false;
    const hold = setTimeout(() => start(), 350);
    const move = (ev) => {
      if (!started) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) start(); else return; }
      drag(ev);
    };
    const up = (ev) => {
      clearTimeout(hold); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (started) drop(ev);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    let ghost = null, d = null, removing = false;
    function start() {
      if (started) return; started = true; dockDrag.active = true;
      d = dockEl(); d.classList.add('rearranging');
      const ic = item.querySelector('.dock-icon'); const r = ic.getBoundingClientRect();
      ghost = h('div', { class: 'dock-ghost', html: ic.innerHTML }); Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', left: r.left + 'px', top: r.top + 'px' });
      document.body.appendChild(ghost);
      item.classList.add('dock-placeholder');
      if (navigator.vibrate) try { navigator.vibrate(10); } catch (err) {}
    }
    function drag(ev) {
      if (!ghost) return;
      const gw = ghost.offsetWidth;
      ghost.style.left = (ev.clientX - gw / 2) + 'px'; ghost.style.top = (ev.clientY - gw / 2) + 'px';
      const dr = d.getBoundingClientRect();
      removing = ev.clientY < dr.top - 70 && id !== 'finder';
      ghost.classList.toggle('removing', removing);
      if (removing) return;
      // live reorder among the pinned icons (everything before the first separator)
      const pinnedEls = []; for (const ch of d.children) { if (ch.classList.contains('dock-sep')) break; pinnedEls.push(ch); }
      const others = pinnedEls.filter((x) => x !== item);
      let before = null;
      for (const o of others) { const r = o.getBoundingClientRect(); if (ev.clientX < r.left + r.width / 2) { before = o; break; } }
      const firstSep = d.querySelector('.dock-sep');
      const target = before || firstSep || null;
      if (item.nextSibling !== target || item.parentNode !== d) {
        const rects = new Map([...d.children].map((c) => [c, c.getBoundingClientRect().left]));
        d.insertBefore(item, target);
        [...d.children].forEach((c) => { const old = rects.get(c); if (old == null || c === item) return; const dx = old - c.getBoundingClientRect().left; if (dx) { c.style.transition = 'none'; c.style.transform = `translateX(${dx}px)`; requestAnimationFrame(() => { c.style.transition = 'transform .22s var(--ease, ease)'; c.style.transform = ''; }); } });
      }
    }
    function drop() {
      dockDrag.active = false; dockDrag.justDropped = true; setTimeout(() => { dockDrag.justDropped = false; }, 80);
      d.classList.remove('rearranging');
      if (removing) {
        const r = ghost.getBoundingClientRect(); ghost.remove();
        const poof = h('div', { class: 'dock-poof' }); Object.assign(poof.style, { left: (r.left + r.width / 2 - 30) + 'px', top: (r.top + r.height / 2 - 30) + 'px' }); document.body.appendChild(poof); setTimeout(() => poof.remove(), 600);
        PatOS.sound.pop();
        PatOS.setSetting('dockPinned', PatOS.settings.dockPinned.filter((x) => x !== id));
        renderDock(); return;
      }
      const ir = item.querySelector('.dock-icon').getBoundingClientRect();
      ghost.style.transition = 'left .2s var(--ease, ease), top .2s var(--ease, ease)'; ghost.style.left = ir.left + 'px'; ghost.style.top = ir.top + 'px';
      setTimeout(() => { ghost.remove(); item.classList.remove('dock-placeholder');
        const order = []; for (const ch of d.children) { if (ch.classList.contains('dock-sep')) break; if (ch.dataset.app) order.push(ch.dataset.app); }
        if (order.join() !== PatOS.settings.dockPinned.join()) PatOS.setSetting('dockPinned', order);
        renderDock();
      }, 200);
    }
  }
  function dockClick(id) {
    const app = PatOS.apps[id];
    const ws = PatOS.wm.windowsOf(id);
    if (!ws.length || app.action) return PatOS.launch(id);
    const visible = ws.filter((w) => !w.minimized);
    if (!visible.length) { ws.forEach((w) => PatOS.wm.restore(w)); return; }
    const top = visible.sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
    if (PatOS.wm.active === top && visible.length === ws.length) { top.minimize(); return; }
    ws.forEach((w) => PatOS.wm.restore(w));
  }
  function dockMenu(id, item) {
    const app = PatOS.apps[id]; const pinned = PatOS.settings.dockPinned.includes(id);
    const ws = PatOS.wm.windowsOf(id);
    const r = item.getBoundingClientRect();
    PatOS.menu([
      ...ws.map((w) => ({ label: w.title, action: () => PatOS.wm.restore(w) })),
      ws.length ? { divider: true } : null,
      { label: app.single && ws.length ? 'Show' : 'Open', action: () => PatOS.launch(id) },
      !app.single && !app.action ? { label: 'New Window', action: () => PatOS.launch(id) } : null,
      { label: pinned ? 'Remove from Dock' : 'Keep in Dock', action: () => {
        const list = PatOS.settings.dockPinned.slice();
        if (pinned) list.splice(list.indexOf(id), 1); else list.push(id);
        PatOS.setSetting('dockPinned', list);
      } },
      ws.length ? { divider: true } : null,
      ws.length ? { label: 'Quit', action: () => PatOS.wm.quit(id) } : null
    ], r.left, r.top - 8 - (ws.length + 4) * 26);
  }
  function applyDockSize() {
    const s = PatOS.settings.dockSize;
    document.documentElement.style.setProperty('--dock', s + 'px');
    $$('.dock-icon').forEach((i) => { i.style.width = i.style.height = s + 'px'; });
    $('#dock-wrap').classList.toggle('autohide', PatOS.settings.dockAutohide);
  }
  function setupDockMagnify() {
    const d = dockEl();
    let raf = 0, mx = null;
    const run = () => {
      raf = 0;
      const base = PatOS.settings.dockSize, maxS = base * PatOS.settings.magnifyScale, range = base * 2.6;
      $$('.dock-item', d).forEach((it) => {
        const ic = it.querySelector('.dock-icon');
        let size = base;
        if (mx != null && PatOS.settings.magnify && !PatOS.settings.reduceMotion) {
          const r = it.getBoundingClientRect(); const c = r.left + r.width / 2;
          const dist = Math.abs(mx - c);
          if (dist < range) size = base + (maxS - base) * Math.cos((dist / range) * (Math.PI / 2)) ** 2;
        }
        ic.style.width = ic.style.height = size + 'px';
      });
    };
    d.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; mx = e.clientX; if (!raf) raf = requestAnimationFrame(run); });
    d.addEventListener('pointerleave', () => { mx = null; if (!raf) raf = requestAnimationFrame(run); });
    // autohide reveal
    document.addEventListener('pointermove', (e) => {
      if (!PatOS.settings.dockAutohide) return;
      const wrap = $('#dock-wrap');
      if (e.clientY > innerHeight - 6) wrap.classList.add('reveal');
      else if (!e.target.closest('#dock-wrap')) wrap.classList.remove('reveal');
    });
  }
  PatOS.dock = {
    render: renderDock,
    iconRect(id) { const el = $(`#dock .dock-item[data-app="${id}"] .dock-icon`); return el ? el.getBoundingClientRect() : null; },
    bounce(id) {
      const el = $(`#dock .dock-item[data-app="${id}"]`);
      if (!el || PatOS.settings.reduceMotion) return;
      el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce');
      setTimeout(() => el.classList.remove('bounce'), 1300);
    }
  };

  /* =========================== LAUNCHPAD =========================== */
  const CATS = ['Apps', 'Office', '3D & Games', 'Utilities'];
  PatOS.launchpad = {
    show() {
      const lp = $('#launchpad'); const input = $('.lp-search', lp);
      input.value = ''; this.render('');
      lp.classList.remove('hidden'); requestAnimationFrame(() => lp.classList.add('in'));
      setTimeout(() => input.focus(), 50);
    },
    hide() { const lp = $('#launchpad'); lp.classList.remove('in'); setTimeout(() => lp.classList.add('hidden'), 220); },
    toggle() { if (PatOS.isMobile && PatOS.mobile) return PatOS.mobile.goHome(); $('#launchpad').classList.contains('hidden') ? this.show() : this.hide(); },
    render(q) {
      const grid = $('.lp-grid'); grid.innerHTML = '';
      q = q.trim().toLowerCase();
      const ids = PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden && id !== 'launchpad' && !(PatOS.settings.hiddenApps || []).includes(id));
      let n = 0;
      CATS.forEach((cat) => {
        const list = ids.filter((id) => (PatOS.apps[id].category || 'Apps') === cat && (!q || PatOS.apps[id].name.toLowerCase().includes(q) || PatOS.t(PatOS.apps[id].name).toLowerCase().includes(q) || (PatOS.apps[id].keywords || '').includes(q)));
        if (!list.length) return;
        grid.appendChild(h('div', { class: 'lp-cat' }, cat));
        const sec = h('div', { class: 'lp-sec' });
        list.forEach((id) => {
          const a = PatOS.apps[id];
          const it = h('button', { class: 'lp-item', style: { animationDelay: Math.min(n++ * 14, 500) + 'ms' } }, h('div', { class: 'lp-icon', html: PatOS.iconHTML(a.icon || id) }), h('span', {}, a.name));
          it.addEventListener('click', () => { PatOS.setLaunchRect(it.querySelector('.lp-icon')); this.hide(); setTimeout(() => PatOS.launch(id), 60); });
          sec.appendChild(it);
        });
        grid.appendChild(sec);
      });
    }
  };
  function setupLaunchpad() {
    const lp = $('#launchpad');
    $('.lp-search', lp).addEventListener('input', (e) => PatOS.launchpad.render(e.target.value));
    $('.lp-search', lp).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const first = $('.lp-item', lp); if (first) first.click(); }
    });
    lp.addEventListener('click', (e) => { if (e.target === lp || e.target.classList.contains('lp-grid') || e.target.classList.contains('lp-sec')) PatOS.launchpad.hide(); });
    PatOS.registerApp({ id: 'launchpad', name: 'Launchpad', icon: 'launchpad', category: 'Utilities', hidden: true, action: () => PatOS.launchpad.toggle() });
  }

  /* =========================== SPOTLIGHT =========================== */
  let spSel = 0, spResults = [];
  PatOS.spotlight = {
    show() {
      const sp = $('#spotlight'); sp.classList.remove('hidden');
      const input = $('.sp-input'); input.value = ''; render('');
      setTimeout(() => input.focus(), 10);
    },
    hide() { $('#spotlight').classList.add('hidden'); },
    toggle() { $('#spotlight').classList.contains('hidden') ? this.show() : this.hide(); }
  };
  function calc(q) {
    if (!/^[\d\s+\-*/().%^,]+$/.test(q) || !/\d/.test(q) || !/[+\-*/^%]/.test(q)) return null;
    try { const v = Function('"use strict";return (' + q.replace(/\^/g, '**').replace(/,/g, '') + ')')(); return Number.isFinite(v) ? +v.toPrecision(12) : null; } catch (e) { return null; }
  }
  /* unit conversions: "5 km to mi", "20 c in f", "3 lb to kg" */
  const UNITS = {
    km: ['len', 1000], m: ['len', 1], cm: ['len', 0.01], mm: ['len', 0.001], mi: ['len', 1609.344], mile: ['len', 1609.344], miles: ['len', 1609.344], ft: ['len', 0.3048], feet: ['len', 0.3048], foot: ['len', 0.3048], in: ['len', 0.0254], inch: ['len', 0.0254], inches: ['len', 0.0254], yd: ['len', 0.9144],
    kg: ['mass', 1], g: ['mass', 0.001], lb: ['mass', 0.45359237], lbs: ['mass', 0.45359237], pound: ['mass', 0.45359237], pounds: ['mass', 0.45359237], oz: ['mass', 0.0283495],
    l: ['vol', 1], ml: ['vol', 0.001], gal: ['vol', 3.78541], cup: ['vol', 0.24], cups: ['vol', 0.24],
    c: ['temp'], f: ['temp'], k: ['temp'], '°c': ['temp'], '°f': ['temp'],
    kmh: ['speed', 1 / 3.6], 'km/h': ['speed', 1 / 3.6], mph: ['speed', 0.44704], 'm/s': ['speed', 1],
    min: ['time', 60], h: ['time', 3600], hr: ['time', 3600], hours: ['time', 3600], s: ['time', 1], sec: ['time', 1], day: ['time', 86400], days: ['time', 86400]
  };
  function convert(q) {
    const m = /^(-?[\d.,]+)\s*([a-z°\/]+)\s+(?:to|in|en|=)\s+([a-z°\/]+)$/i.exec(q.trim()); if (!m) return null;
    const v = parseFloat(m[1].replace(',', '.')), a = m[2].toLowerCase(), b = m[3].toLowerCase(); const A = UNITS[a], B = UNITS[b];
    if (!A || !B || A[0] !== B[0] || isNaN(v)) return null;
    let r;
    if (A[0] === 'temp') { const t = a.replace('°', ''), u = b.replace('°', ''); const cel = t === 'c' ? v : t === 'f' ? (v - 32) * 5 / 9 : v - 273.15; r = u === 'c' ? cel : u === 'f' ? cel * 9 / 5 + 32 : cel + 273.15; }
    else r = v * A[1] / B[1];
    return { text: m[1] + ' ' + m[2] + ' = ' + (+r.toPrecision(6)).toLocaleString() + ' ' + m[3], value: +r.toPrecision(6) };
  }
  PatOS.convertUnits = (q) => convert(q);
  PatOS.quickTimer = function (secs, label) {
    PatOS.notify({ title: PatOS.t('Timer started'), body: Math.round(secs / 60) >= 1 ? Math.round(secs / 60) + ' min' : secs + ' s', icon: 'clock' });
    setTimeout(() => { PatOS.notify({ title: label || PatOS.t('Timer done'), body: PatOS.t('Your timer finished.'), icon: 'clock', duration: 12000 }); for (let i = 0; i < 5; i++) PatOS.sound.tone(880, 0.25, { delay: i * 0.45, vol: 0.2 }); if (PatOS.mobile && PatOS.mobile.islandAlert) PatOS.mobile.islandAlert(PatOS.t('Timer done'), 'clock'); }, secs * 1000);
  };
  function render(q) {
    const box = $('.sp-results'); box.innerHTML = ''; spResults = []; spSel = 0;
    q = q.trim();
    $('.sp-icon').innerHTML = $('#mb-search').innerHTML;
    if (!q) { $('#spotlight .sp-box').classList.remove('has'); const pv0 = $('.sp-preview'); if (pv0) pv0.remove(); return; }
    const ql = q.toLowerCase();
    const c = calc(q);
    const cv = convert(q);
    if (cv) spResults.push({ group: 'Conversion', label: cv.text, icon: 'calculator', preview: () => h('div', { class: 'sp-pv-big' }, String(cv.value)), run: () => { navigator.clipboard && navigator.clipboard.writeText(String(cv.value)).catch(() => {}); PatOS.notify({ title: PatOS.t('Copied'), body: cv.text, icon: 'calculator' }); } });
    const tm = /^(?:timer|minuterie)\s+(\d+(?:[.,]\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hours?)?$/i.exec(q);
    if (tm) { const n = parseFloat(tm[1].replace(',', '.')); const u = (tm[2] || 'm')[0].toLowerCase(); const secs = Math.round(n * (u === 's' ? 1 : u === 'h' ? 3600 : 60)); spResults.push({ group: 'Timer', label: PatOS.t('Start a timer for') + ' ' + tm[1] + ' ' + (u === 's' ? 's' : u === 'h' ? 'h' : 'min'), icon: 'clock', run: () => PatOS.quickTimer(secs) }); }
    if (c !== null) spResults.push({ group: 'Calculator', label: q + ' = ' + c, icon: 'calculator', run: () => { navigator.clipboard && navigator.clipboard.writeText(String(c)).catch(() => {}); PatOS.notify({ title: 'Copied', body: String(c), icon: 'calculator' }); } });
    PatOS.appOrder.forEach((id) => {
      const a = PatOS.apps[id];
      if (a.hidden && (a.external || id === 'extweb')) return;
      const nm = PatOS.t ? PatOS.t(a.name) : a.name;
      if (a.name.toLowerCase().includes(ql) || nm.toLowerCase().includes(ql) || (a.keywords || '').includes(ql)) spResults.push({ group: 'Applications', appId: id, label: nm, icon: a.icon || id, score: a.name.toLowerCase().startsWith(ql) ? 0 : 1, run: () => PatOS.launch(id) });
    });
    spResults.sort((a, b) => (a.group === b.group ? (a.score || 0) - (b.score || 0) : 0));
    let files = 0;
    PatOS.fs.walk('/', (p, n) => {
      if (files > 8) return;
      if (PatOS.fs.basename(p).toLowerCase().includes(ql) || (n.type === 'file' && !String(n.content).startsWith('data:') && String(n.content).toLowerCase().includes(ql))) {
        files++; spResults.push({ group: 'Files', filePath: p, label: PatOS.fs.basename(p), sub: PatOS.fs.dirname(p), iconHTML: PatOS.fileIconHTML(p, n), run: () => PatOS.openFile(p) });
      }
    });
    (PatOS.store.get('notes', []) || []).filter((n) => !n.deletedAt && (n.title + ' ' + n.body).toLowerCase().includes(ql)).slice(0, 4).forEach((n) =>
      spResults.push({ group: 'Notes', label: n.title || 'Untitled', icon: 'notes', run: () => PatOS.launch('notes', { id: n.id }) }));
    spResults.push({ group: 'Web', label: 'Search the web for “' + q + '”', icon: 'browser', run: () => PatOS.launch('browser', { url: q }) });
    let lastG = '';
    spResults.forEach((r, i) => {
      if (r.group !== lastG) { box.appendChild(h('div', { class: 'sp-group' }, r.group)); lastG = r.group; }
      const row = h('div', { class: 'sp-res' + (i === 0 ? ' sel' : '') }, h('div', { class: 'sp-ri', html: r.iconHTML || PatOS.iconHTML(r.icon) }), h('span', {}, r.label), r.sub ? h('small', {}, r.sub) : null);
      row.addEventListener('click', () => { PatOS.spotlight.hide(); r.run(); });
      row.addEventListener('pointermove', () => setSel(i));
      box.appendChild(row);
    });
    $('#spotlight .sp-box').classList.add('has');
    preview(spResults[0]);
  }
  function setSel(i) {
    const rows = $$('.sp-res'); if (!rows.length) return;
    spSel = (i + rows.length) % rows.length;
    rows.forEach((r, j) => r.classList.toggle('sel', j === spSel));
    rows[spSel].scrollIntoView({ block: 'nearest' });
    preview(spResults[spSel]);
  }
  function preview(r) {
    let pv = $('.sp-preview'); if (!pv) { pv = h('div', { class: 'sp-preview' }); $('#spotlight .sp-box').appendChild(pv); }
    pv.innerHTML = ''; if (!r) return;
    if (r.appId) { const a = PatOS.apps[r.appId]; pv.append(h('div', { class: 'sp-pv-ic', html: PatOS.iconHTML(a.icon || r.appId) }), h('b', {}, PatOS.t(a.name)), h('p', {}, PatOS.t(a.about || a.category || 'Apps')), h('small', {}, PatOS.wm.isRunning(r.appId) ? PatOS.t('Open now') : PatOS.t(a.category || 'Apps'))); return; }
    if (r.filePath) {
      const n = PatOS.fs.get(r.filePath); if (!n) return;
      const kind = PatOS.fileKind(r.filePath, n);
      if (kind === 'image') pv.appendChild(h('img', { class: 'sp-pv-img', src: n.content, alt: '' }));
      else pv.appendChild(h('div', { class: 'sp-pv-ic', html: PatOS.fileIconHTML(r.label, n) }));
      pv.append(h('b', {}, r.label), h('small', {}, (r.filePath.startsWith('/') ? '~' + r.filePath : r.filePath) + ' · ' + PatOS.fmtBytes(PatOS.fs.size(n))));
      if (n.type === 'file' && kind === 'text' && !String(n.content).startsWith('data:')) pv.appendChild(h('pre', { class: 'sp-pv-text' }, String(n.content).slice(0, 400)));
      return;
    }
    if (r.preview) { pv.appendChild(r.preview()); pv.appendChild(h('small', {}, PatOS.t('Press Enter to copy'))); return; }
    pv.append(h('div', { class: 'sp-pv-ic', html: r.iconHTML || PatOS.iconHTML(r.icon) }), h('b', {}, r.label));
  }
  function setupSpotlight() {
    const input = $('.sp-input');
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(spSel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(spSel - 1); }
      else if (e.key === 'Enter') { const r = spResults[spSel]; if (r) { PatOS.spotlight.hide(); r.run(); } }
      else if (e.key === 'Escape') PatOS.spotlight.hide();
    });
    $('#spotlight').addEventListener('pointerdown', (e) => { if (e.target.id === 'spotlight') PatOS.spotlight.hide(); });
  }

  /* =========================== MISSION CONTROL =========================== */
  PatOS.mission = {
    on: false,
    toggle() { this.on ? this.exit() : this.enter(); },
    enter() {
      const ws = PatOS.wm.windows.filter((w) => !w.minimized);
      if (!ws.length) { PatOS.notify({ title: 'Mission Control', body: 'No open windows.', icon: 'launchpad' }); return; }
      this.on = true; closeMenus();
      const mc = $('#mission'); mc.classList.remove('hidden');
      const n = ws.length, cols = Math.ceil(Math.sqrt(n * (innerWidth / innerHeight) / 1.4)), rows = Math.ceil(n / cols);
      const pad = 40, top = 70, cw = (innerWidth - pad * 2) / cols, ch = (innerHeight - top - 110) / rows;
      ws.forEach((w, i) => {
        const r = w.rect(); const c = i % cols, ro = Math.floor(i / cols);
        const s = Math.min((cw - 30) / r.w, (ch - 40) / r.h, 1);
        const tx = pad + c * cw + cw / 2 - (r.x + r.w / 2), ty = top + ro * ch + ch / 2 - (r.y + r.h / 2);
        w.el.classList.add('mc');
        w.el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
        w.el.dataset.mcLabel = w.title;
        w._mc = (e) => { e.stopPropagation(); e.preventDefault(); PatOS.mission.exit(); PatOS.wm.focus(w); };
        w.el.addEventListener('pointerdown', w._mc, true);
      });
      document.body.classList.add('mission-on');
    },
    exit() {
      if (!this.on) return; this.on = false;
      $('#mission').classList.add('hidden'); document.body.classList.remove('mission-on');
      PatOS.wm.windows.forEach((w) => {
        if (w._mc) { w.el.removeEventListener('pointerdown', w._mc, true); w._mc = null; }
        w.el.style.transform = '';
        setTimeout(() => w.el.classList.remove('mc'), 350);
      });
    }
  };

  /* =========================== DESKTOP ICONS =========================== */
  let selected = new Set();
  function renderDesktop() {
    const wrap = $('#desktop-icons'); wrap.innerHTML = '';
    const items = PatOS.fs.list('/Desktop');
    const pos = PatOS.settings.desktopPositions || {};
    const cellW = 96, cellH = 100, top = 40;
    const perCol = Math.max(1, Math.floor((innerHeight - top - PatOS.settings.dockSize - 40) / cellH));
    items.forEach((it, i) => {
      const p = pos[it.name] || { x: innerWidth - cellW - 14 - Math.floor(i / perCol) * cellW, y: top + (i % perCol) * cellH };
      const el = h('div', { class: 'desk-icon' + (selected.has(it.path) ? ' sel' : ''), 'data-path': it.path, style: { left: clamp(p.x, 0, innerWidth - 90) + 'px', top: clamp(p.y, 30, innerHeight - 100) + 'px' } },
        h('div', { class: 'di-img', html: PatOS.fileIconHTML(it.name, it) }), h('div', { class: 'di-name' }, it.name));
      el.addEventListener('dblclick', () => PatOS.openFile(it.path));
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); select(it.path); fileMenu(it.path, e.clientX, e.clientY, '/Desktop'); });
      dragIcon(el, it);
      wrap.appendChild(el);
    });
  }
  function select(path, add) {
    if (!add) selected.clear();
    if (path) selected.add(path);
    $$('.desk-icon').forEach((e) => e.classList.toggle('sel', selected.has(e.dataset.path)));
  }
  function dragIcon(el, it) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; e.stopPropagation();
      if (!selected.has(it.path)) select(it.path, e.shiftKey || e.ctrlKey);
      const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop; let moved = false;
      el.setPointerCapture(e.pointerId);
      const mv = (ev) => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return; moved = true; el.classList.add('dragging'); el.style.left = ox + ev.clientX - sx + 'px'; el.style.top = oy + ev.clientY - sy + 'px'; };
      const up = (ev) => {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.classList.remove('dragging');
        if (!moved) return;
        // dropped onto the trash?
        const tr = PatOS.dock.iconRect('trash');
        if (tr && ev.clientX >= tr.left && ev.clientX <= tr.right && ev.clientY >= tr.top - 10 && ev.clientY <= tr.bottom) {
          PatOS.fs.remove(it.path); PatOS.sound.trash(); return;
        }
        // dropped onto a folder icon?
        el.style.pointerEvents = 'none';
        const under = document.elementFromPoint(ev.clientX, ev.clientY); el.style.pointerEvents = '';
        const target = under && under.closest('.desk-icon');
        if (target && target !== el && PatOS.fs.isDir(target.dataset.path)) { PatOS.fs.move(it.path, target.dataset.path); return; }
        const fw = under && under.closest('.window[data-app="finder"]');
        if (fw && fw._finderPath) { PatOS.fs.move(it.path, fw._finderPath()); return; }
        const pos = Object.assign({}, PatOS.settings.desktopPositions);
        pos[it.name] = { x: Math.round(el.offsetLeft / 8) * 8, y: Math.round(el.offsetTop / 8) * 8 };
        PatOS.setSetting('desktopPositions', pos);
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
  }
  PatOS.renameInline = async function (path, done) {
    const name = PatOS.fs.basename(path);
    const nn = await PatOS.ask('Rename “' + name + '”', name, { ok: 'Rename', icon: 'finder' });
    if (nn && nn !== name) { try { const np = PatOS.fs.rename(path, nn); done && done(np); } catch (e) { PatOS.notify({ title: 'Cannot rename', body: e.message, icon: 'finder' }); } }
  };
  function fileMenu(path, x, y) {
    const n = PatOS.fs.get(path);
    PatOS.menu([
      { label: 'Open', action: () => PatOS.openFile(path) },
      n && n.type === 'file' ? { label: 'Open with TextEdit', action: () => PatOS.launch('textedit', { path }) } : null,
      { divider: true },
      { label: 'Rename…', action: () => PatOS.renameInline(path) },
      { label: 'Duplicate', action: () => PatOS.fs.copy(path, PatOS.fs.dirname(path)) },
      n && n.type === 'file' ? { label: 'Download to Computer', action: () => PatOS.downloadFile(PatOS.fs.basename(path), n.content) } : null,
      { label: 'Get Info', action: () => PatOS.notify({ title: PatOS.fs.basename(path), body: (n.type === 'dir' ? 'Folder' : 'File') + ' · ' + PatOS.fmtBytes(PatOS.fs.size(n)) + ' · Modified ' + new Date(n.mtime).toLocaleString(), icon: 'finder' }) },
      { divider: true },
      { label: 'Move to Trash', action: () => { PatOS.fs.remove(path); PatOS.sound.trash(); } }
    ], x, y);
  }
  PatOS.fileMenu = fileMenu;

  function setupDesktop() {
    const desk = $('#desktop');
    const box = $('#selection-box');
    desk.addEventListener('pointerdown', (e) => {
      if (e.target !== desk && !['wallpaper', 'wallpaper3d', 'desktop-icons'].includes(e.target.id)) return;
      if (e.button !== 0) return;
      PatOS.wm.blurAll(); select(null);
      const sx = e.clientX, sy = e.clientY;
      const mv = (ev) => {
        const x = Math.min(sx, ev.clientX), y = Math.min(sy, ev.clientY), w = Math.abs(ev.clientX - sx), hh = Math.abs(ev.clientY - sy);
        Object.assign(box.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
        selected.clear();
        $$('.desk-icon').forEach((el) => {
          const r = el.getBoundingClientRect();
          const hit = r.right > x && r.left < x + w && r.bottom > y && r.top < y + hh;
          el.classList.toggle('sel', hit); if (hit) selected.add(el.dataset.path);
        });
      };
      const up = () => { box.style.display = 'none'; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    desk.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.window, #dock-wrap, #menubar, .desk-icon, #launchpad, #spotlight, .panel')) return;
      e.preventDefault();
      PatOS.menu([
        { label: 'New Folder', action: () => newFolder('/Desktop') },
        { label: 'New Text File', action: () => { const nm = PatOS.fs.uniqueName('/Desktop', 'untitled.txt'); PatOS.fs.write('/Desktop/' + nm, ''); PatOS.launch('textedit', { path: '/Desktop/' + nm }); } },
        { label: 'Import Files from Computer…', action: () => PatOS.importFiles('/Desktop') },
        { divider: true },
        { label: 'Clean Up Icons', action: () => PatOS.setSetting('desktopPositions', {}) },
        { label: 'Change Wallpaper…', action: () => PatOS.launch('settings', { pane: 'wallpaper' }) },
        { label: 'Next Wallpaper', action: nextWallpaper },
        { divider: true },
        { label: 'Open Terminal', action: () => PatOS.launch('terminal') },
        { label: 'Mission Control', action: () => PatOS.mission.enter() }
      ], e.clientX, e.clientY);
    });
    // catch-all to block the browser menu inside PatOS chrome
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea, [contenteditable], iframe, .allow-ctx')) e.preventDefault(); });
    PatOS.on('fs', (ev) => { if (ev.dir.startsWith('/Desktop') || ev.path.startsWith('/Desktop') || ev.dir === '/') renderDesktop(); if (ev.dir === '/.Trash' || ev.path.startsWith('/.Trash')) renderDock(); });
    window.addEventListener('resize', PatOS.debounce(renderDesktop, 150));
    PatOS.on('setting:desktopPositions', renderDesktop);
  }
  function nextWallpaper() {
    const all = [...Object.keys(PatOS.wallpaper.live), ...Object.keys(PatOS.wallpaper.palettes)];
    const i = all.indexOf(PatOS.settings.wallpaper);
    PatOS.setSetting('wallpaper', all[(i + 1) % all.length]);
  }

  /* =========================== DESKTOP WIDGETS =========================== */
  function renderDeskWidgets() {
    let wrap = $('#desk-widgets');
    if (!wrap) { wrap = h('div', { id: 'desk-widgets' }); $('#desktop').insertBefore(wrap, $('#desktop-icons')); }
    wrap.innerHTML = '';
    if (!PatOS.settings.showWidgets) return;
    const { cal, clock, up, music } = buildWidgets();
    wrap.append(clock, cal, up, music);
  }
  PatOS.renderDeskWidgets = renderDeskWidgets;

  /* =========================== APP SWITCHER (hold Alt, press `) =========================== */
  const switcher = { open: false, list: [], i: 0, el: null };
  function switcherOrder() {
    const seen = []; PatOS.wm.windows.slice().sort((a, b) => (b.minimized ? -1 : +b.el.style.zIndex) - (a.minimized ? -1 : +a.el.style.zIndex)).forEach((w) => { if (!seen.includes(w.app.id)) seen.push(w.app.id); });
    return seen;
  }
  function switcherStep(dir) {
    if (!switcher.open) {
      switcher.list = switcherOrder(); if (switcher.list.length < 1) return;
      switcher.open = true; switcher.i = 0;
      switcher.el = h('div', { id: 'app-switcher' }); $('#desktop').appendChild(switcher.el);
    }
    switcher.i = (switcher.i + dir + switcher.list.length) % switcher.list.length;
    switcher.el.innerHTML = '';
    const row = h('div', { class: 'asw-row' });
    switcher.list.forEach((id, j) => { const b = h('div', { class: 'asw-item' + (j === switcher.i ? ' on' : '') }, h('div', { class: 'asw-ic', html: PatOS.iconHTML(PatOS.apps[id].icon || id) })); b.onclick = () => { switcher.i = j; switcherCommit(); }; row.appendChild(b); });
    switcher.el.append(row, h('div', { class: 'asw-name' }, PatOS.apps[switcher.list[switcher.i]].name));
  }
  function switcherCommit() {
    if (!switcher.open) return;
    const id = switcher.list[switcher.i]; switcher.open = false; switcher.el.remove();
    PatOS.wm.windowsOf(id).forEach((w) => PatOS.wm.restore(w));
  }
  document.addEventListener('keyup', (e) => { if (e.key === 'Alt' && switcher.open) switcherCommit(); });

  /* =========================== FULLSCREEN, THEME, KEYS =========================== */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
  }
  PatOS.toggleFullscreen = toggleFullscreen;

  function applyTheme() {
    const s = PatOS.settings;
    let t = s.theme;
    if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    document.documentElement.style.setProperty('--accent', s.accent);
    document.documentElement.classList.toggle('reduce-motion', !!s.reduceMotion);
    document.documentElement.classList.toggle('reduce-transparency', !!s.reduceTransparency);
    ['highContrast', 'boldText', 'showFocus', 'bigTargets'].forEach((k) => document.documentElement.classList.toggle(k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), !!s[k]));
    $('#dimmer').style.opacity = String(1 - s.brightness);
    const chromium = !!window.chrome && !PatOS.isIOS && !/Firefox/.test(navigator.userAgent);
    document.documentElement.classList.toggle('lg-on', !!s.liquidGlass);
    document.documentElement.classList.toggle('lg-refract', !!(s.liquidGlass && s.glassRefraction && chromium && s.quality3d !== 'low' && !s.reduceTransparency));
  }
  PatOS.applyTheme = applyTheme;
  /* Liquid Glass light follows the pointer */
  const GLASS_SEL = '#dock, .mh-dock, .menu, #control-center, .toast, .sp-box, .dlg, .widget, .mw, .cc-tile, .asw-row, .nc-list';
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !document.documentElement.classList.contains('lg-on')) return;
    const g = e.target.closest && e.target.closest(GLASS_SEL); if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    g.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }, { passive: true });

  function setupKeys() {
    document.addEventListener('keydown', (e) => {
      if (!PatOS.loggedIn) return;
      const k = e.key.toLowerCase();
      const w = PatOS.wm.active;
      if ((e.ctrlKey || e.altKey) && e.code === 'Space') { e.preventDefault(); PatOS.spotlight.toggle(); return; }
      if (e.key === 'Escape') {
        if (PatOS.mission.on) return PatOS.mission.exit();
        if (!$('#launchpad').classList.contains('hidden')) return PatOS.launchpad.hide();
        if (!$('#spotlight').classList.contains('hidden')) return PatOS.spotlight.hide();
        closeMenus(); $('#control-center').classList.add('hidden'); $('#notif-center').classList.add('hidden');
        if (e.altKey) PatOS.power.lock();
        return;
      }
      if (e.key === ' ' && !PatOS.wm.active && (document.activeElement === document.body || !document.activeElement)) {
        const s = document.querySelector('.desk-icon.sel');
        if (s) { e.preventDefault(); PatOS.quickLook(s.dataset.path, [...document.querySelectorAll('.desk-icon')].map((x) => x.dataset.path)); return; }
      }
      if (e.key === 'F3' || (e.altKey && e.key === 'ArrowUp')) { e.preventDefault(); PatOS.mission.toggle(); return; }
      if (e.key === 'F4') { e.preventDefault(); PatOS.launchpad.toggle(); return; }
      if (!e.altKey || e.ctrlKey) return;
      const map = {
        w: () => w && w.close(),
        q: () => w && PatOS.wm.quit(w.app.id),
        m: () => w && w.minimize(),
        h: () => w && PatOS.wm.windowsOf(w.app.id).forEach((x) => x.minimize()),
        n: () => newWindow(w ? w.app.id : 'finder'),
        l: () => PatOS.launchpad.toggle(),
        f: () => w && (w.app.resizable === false ? null : w.toggleFullscreen()),
        t: () => PatOS.launch('terminal'),
        e: () => PatOS.launch('finder'),
        b: () => PatOS.launch('browser'),
        ',': () => PatOS.launch('settings'),
        arrowleft: () => w && tile(w, 'left'),
        arrowright: () => w && tile(w, 'right'),
        '`': () => switcherStep(switcher.open ? (e.shiftKey ? -1 : 1) : 1)
      };
      if (map[k]) { e.preventDefault(); map[k](); }
    });
  }

  /* =========================== POWER =========================== */
  PatOS.power = {
    lock() { PatOS.loggedIn = false; closeMenus(); PatOS.boot.showLock(); },
    sleep() { PatOS.loggedIn = false; PatOS.wallpaper.pause(true); const off = $('#off'); off.querySelector('.off-msg').innerHTML = ''; off.classList.remove('hidden'); off.classList.add('sleeping');
      const wake = () => { off.removeEventListener('pointerdown', wake); document.removeEventListener('keydown', wake); off.classList.add('hidden'); off.classList.remove('sleeping'); PatOS.wallpaper.pause(false); PatOS.boot.showLock(); };
      setTimeout(() => { off.addEventListener('pointerdown', wake); document.addEventListener('keydown', wake); }, 400);
    },
    async restart() { if (!(await PatOS.confirmBox('Restart PatOS?', 'Open windows will close.', { ok: 'Restart' }))) return; PatOS.wm.closeAll(); PatOS.loggedIn = false; setTimeout(() => (PatOS._leaving = true, location.reload()), 300); },
    async shutdown() {
      if (!(await PatOS.confirmBox('Shut down PatOS?', 'Open windows will close.', { ok: 'Shut Down' }))) return;
      PatOS.wm.closeAll(); PatOS.loggedIn = false; PatOS.wallpaper.stop();
      $('#desktop').classList.add('hidden');
      const off = $('#off'); off.querySelector('.off-msg').innerHTML = 'PatOS is shut down.<br><small>Click anywhere to start up.</small>'; off.classList.remove('hidden');
      off.addEventListener('pointerdown', () => (PatOS._leaving = true, location.reload()), { once: true });
    }
  };

  /* =========================== INIT =========================== */
  PatOS.shell = {
    init() {
      applyTheme();
      setupMenubar(); setupLaunchpad(); setupSpotlight(); setupDesktop(); setupDockMagnify(); setupKeys();
      PatOS.on('setting', (s) => {
        if (['theme', 'accent', 'brightness', 'reduceMotion', 'reduceTransparency', 'liquidGlass', 'glassRefraction', 'quality3d'].includes(s.key)) applyTheme();
        if (['dockSize', 'dockAutohide'].includes(s.key)) applyDockSize();
        if (s.key === 'dockPinned') renderDock();
      });
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
      ['wm:open', 'wm:close', 'wm:minimize'].forEach((ev) => PatOS.on(ev, () => {
        renderDock();
        // pause 3D wallpaper while a window covers the whole screen (saves battery on Chromebooks)
        PatOS.wallpaper.pause(PatOS.wm.windows.some((w) => w.maximized && !w.minimized));
      }));
      PatOS.on('wm:focus', () => PatOS.wallpaper.pause(PatOS.wm.windows.some((w) => w.maximized && !w.minimized)));
      renderDock(); renderDesktop(); renderDeskWidgets();
      setInterval(renderDeskWidgets, 30000);
      setInterval(() => { const c = $('#desk-widgets .w-clock canvas'); if (c) drawAnalog(c, new Date()); }, 1000);
      PatOS.on('setting:showWidgets', renderDeskWidgets);
      // refresh calendar/clock dock icons every minute
      setInterval(() => { $$('#dock .dock-item[data-app="calendar"] .dock-icon, #dock .dock-item[data-app="clock"] .dock-icon').forEach((el) => { el.innerHTML = PatOS.iconHTML(el.parentNode.dataset.app); }); }, 60000);
    }
  };
})();
