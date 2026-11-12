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
      const cancel = h('button', { class: 'btn' }, opts.cancel || 'Cancel');
      ok.onclick = () => done(input ? input.value : true);
      cancel.onclick = () => done(input ? null : false);
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel.click(); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); (opts.safe ? cancel : ok).click(); } };
      document.addEventListener('keydown', onKey, true);
      layer.appendChild(h('div', { class: 'dlg' }, h('div', { class: 'dlg-ic', html: PatOS.iconHTML(opts.icon || 'about') }), h('b', {}, opts.title || 'PatOS'), opts.text ? h('p', {}, opts.text) : null, input, h('div', { class: 'dlg-btns' }, opts.noCancel ? null : cancel, ok)));
      document.body.appendChild(layer);
      setTimeout(() => { if (input) { input.focus(); input.select(); } else (opts.safe ? cancel : ok).focus(); }, 30);
    });
  }
  PatOS.ask = (title, value, opts) => dialog(Object.assign({ title, input: value == null ? '' : value }, opts));
  PatOS.confirmBox = (title, text, opts) => dialog(Object.assign({ title, text }, opts));
  PatOS.alertBox = (title, text, opts) => dialog(Object.assign({ title, text, noCancel: true }, opts));

  /* =========================== CONTEXT / DROPDOWN MENUS =========================== */
  let openMenu = null;
  /* Liquid Glass: a menu grows out of the control that opened it (its glass stretches into the menu) and goes back into it
     when it closes; opened with a right-click, it grows from the pointer. Only transform and opacity move. */
  const morphOK = () => !PatOS.settings.reduceMotion && !document.documentElement.classList.contains('reduce-motion') && !!document.body.animate;
  let lastPress = null;
  document.addEventListener('pointerdown', (e) => { const c = e.target.closest && e.target.closest('button, [role="button"], [data-menu], .tbtn, .btn, select'); lastPress = c && !c.closest('.menu') ? { el: c, t: Date.now() } : null; }, true);
  function morphFrom(el, x, y) {
    const m = el.getBoundingClientRect(); if (!m.width || !m.height) return null;
    const src = lastPress && Date.now() - lastPress.t < 900 && lastPress.el.isConnected ? lastPress.el.getBoundingClientRect() : null;
    // (the control must be next to where the menu opens, or it was not what opened it)
    const near = src && src.width && Math.abs(src.left - x) < Math.max(80, src.width) && Math.abs(src.bottom - y) < 60;
    const r = near ? src : { left: x - 8, top: y - 8, width: 16, height: 16 };
    const sx = Math.min(1, Math.max(0.08, r.width / m.width)), sy = Math.min(1, Math.max(0.06, r.height / m.height));
    const dx = r.left + r.width / 2 - (m.left + m.width / 2), dy = r.top + r.height / 2 - (m.top + m.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  }
  function closeMenus() {
    if (openMenu) {
      const el = openMenu.el, from = openMenu.from;
      if (from && morphOK() && el.isConnected) {
        // it leaves into the control it came from, from a layer after the live one (so a new menu is the one found and clicked)
        let gone = document.getElementById('menu-leave-layer');
        if (!gone) { gone = document.createElement('div'); gone.id = 'menu-leave-layer'; $('#menu-layer').after(gone); }
        el.classList.add('menu-leaving'); el.style.pointerEvents = 'none'; gone.appendChild(el);
        const a = el.animate([{ transform: 'none', opacity: 1 }, { transform: from, opacity: 0 }], { duration: 170, easing: 'cubic-bezier(.4,0,.8,.4)', fill: 'forwards' });
        a.onfinish = a.oncancel = () => el.remove();
      } else el.remove();
      openMenu.onClose && openMenu.onClose(); openMenu = null;
    }
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
    let from = null;
    if (morphOK()) {
      from = morphFrom(el, x, y);
      if (from) {
        el.classList.add('menu-morph'); const sp = PatOS.motion.get();
        el.animate([{ transform: from, opacity: 0.35 }, { transform: 'none', opacity: 1 }], { duration: Math.min(520, Math.max(340, sp.dur * 0.8)), easing: sp.easing });
      }
    }
    openMenu = { el, from, onClose: opts.onClose };
    return el;
  };
  PatOS.closeMenus = closeMenus;
  PatOS.setLaunchRect = (el) => { if (!el) return; const r = el.getBoundingClientRect(); PatOS._launchRect = { left: r.left, top: r.top, width: r.width, height: r.height, t: Date.now() }; };
  document.addEventListener('pointerdown', (e) => { if (openMenu && !e.target.closest('.menu') && !e.target.closest('#menubar [data-menu]')) closeMenus(); });

  /* =========================== NOTIFICATIONS ===========================
     PatOS.notify keeps its old shape (title, body, icon, onClick, duration) and gains priority, actions, open, key and at
     (js/services.js records it, applies the app's rules, quiet hours and Focus, and keeps the history). */
  PatOS.notifications = { list: () => PatOS.nc.list().map((n) => ({ title: n.title, icon: n.app, time: new Date(n.time) })), clear: () => PatOS.nc.clear() };
  PatOS.notify = function (n) {
    n = Object.assign({ title: 'PatOS', body: '', icon: 'about' }, n);
    const r = PatOS.nc._add(n);
    if (r.scheduled || r.dropped) return r.scheduled || null;
    // screen readers: announce it; other tabs: show a real browser notification
    try { let lr = document.getElementById('sr-live'); if (!lr) { lr = document.createElement('div'); lr.id = 'sr-live'; lr.setAttribute('aria-live', 'polite'); lr.setAttribute('role', 'status'); lr.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)'; document.body.appendChild(lr); } lr.textContent = n.title + '. ' + (n.body || ''); } catch (e) {}
    if (document.hidden && r.banner && PatOS.settings.systemNotifications !== false && window.Notification && Notification.permission === 'granted') { try { const sn = new Notification(n.title, { body: n.body, icon: 'assets/icon-180.png' }); sn.onclick = () => { window.focus(); PatOS.nc.open(r.id); }; } catch (e) {} }
    if (r.sound && PatOS.settings.notifSound !== false) PatOS.sound.notify();
    if (!r.banner) return r.id;
    const old = document.querySelector('#toasts .toast[data-nid="' + r.id + '"]'); if (old) old.remove(); // (the same one again: one banner, counted)
    const acts = (PatOS.nc.list().find((x) => x.id === r.id) || {}).actions || [];
    const t = h('div', { class: 'toast' + (r.rec.priority === 'urgent' ? ' urgent' : ''), 'data-nid': r.id },
      h('div', { class: 'toast-icon', html: PatOS.iconHTML(n.icon) }),
      h('div', { class: 'toast-text' }, h('div', { class: 'toast-app' }, r.rec.appName, h('span', {}, r.rec.count > 1 ? '×' + r.rec.count : PatOS.t('now'))), h('b', {}, n.title), n.body ? h('div', {}, n.body) : null,
        acts.length ? h('div', { class: 'toast-acts' }, ...acts.map((a, i) => h('button', { class: 'toast-act', onclick: (e) => { e.stopPropagation(); PatOS.nc.act(r.id, i); t.remove(); } }, a.label))) : null));
    t.addEventListener('click', () => { t.remove(); PatOS.nc.open(r.id); });
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, n.duration || (r.rec.priority === 'urgent' ? 12000 : acts.length ? 8000 : 4500));
    return r.id;
  };

  /* One look for "you're offline" everywhere. retry() runs by itself when the connection comes back,
     as long as the card is still on screen (unless opts.auto is false, for things that need a click). */
  PatOS.offlineCard = function (retry, opts) {
    opts = opts || {};
    const card = h('div', { class: 'pos-offline', role: 'status' },
      h('div', { class: 'pos-off-ic', html: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 8.8a15 15 0 0 1 4.2-2.6M9.6 5.2A15 15 0 0 1 22 8.8M5 12.5a10 10 0 0 1 4-2.2M14.5 10.4A10 10 0 0 1 19 12.5M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/><path d="M3 3l18 18"/></svg>' }),
      h('h2', {}, PatOS.t(opts.title || 'You’re offline')),
      h('p', {}, PatOS.t(opts.body || 'This needs the internet. It will load by itself when you’re back online.')),
      retry ? h('button', { class: 'btn', onclick: () => retry() }, PatOS.t('Try again')) : null);
    if (retry && opts.auto !== false) {
      const back = () => { window.removeEventListener('online', back); if (card.isConnected) setTimeout(retry, 600); };
      window.addEventListener('online', back);
    }
    return card;
  };
  PatOS.isOffline = () => navigator.onLine === false;

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
        { label: 'Open Piles', action: () => PatOS.launch('finder') },
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
        { label: 'Stage Focus', shortcut: 'Alt+S', checked: PatOS.wm.staged, action: () => PatOS.wm.stage() },
        { divider: true },
        { label: 'Save Window Group…', disabled: !PatOS.wm.windows.some((x) => !x.minimized), action: saveGroup },
        ...PatOS.wm.groups.list().map((g) => ({ label: PatOS.t('Open') + ' “' + g.name + '”', action: () => PatOS.wm.groups.open(g.name) })),
        PatOS.wm.groups.list().length ? { label: 'Delete a Window Group…', action: deleteGroup } : null,
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
        { label: 'Settings…', action: () => PatOS.launch('settings') },
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
  /* window groups: name the windows that are open now, reopen them all later from the Window menu */
  async function saveGroup() {
    const n = PatOS.wm.windows.filter((x) => !x.minimized).length;
    const name = await PatOS.ask(PatOS.t('Save Window Group'), PatOS.t('Homework'), { icon: 'finder', ok: PatOS.t('Save'), text: n + ' ' + PatOS.t(n === 1 ? 'window' : 'windows') + ' · ' + PatOS.t('Reopen them all from the Window menu.') });
    if (name && name.trim()) { PatOS.wm.groups.save(name.trim().slice(0, 40)); PatOS.notify({ title: PatOS.t('Window group saved'), body: name.trim(), icon: 'finder' }); }
  }
  function deleteGroup() {
    PatOS.menu([{ header: PatOS.t('Delete a Window Group…') }, ...PatOS.wm.groups.list().map((g) => ({ label: g.name, action: () => PatOS.wm.groups.remove(g.name) }))], innerWidth / 2 - 110, 120);
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

    // going offline or back online: say so once the change has lasted a moment (Wi-Fi can flicker)
    let netTimer = null, netShown = navigator.onLine;
    const netChange = () => {
      $('#mb-wifi').classList.toggle('off', !navigator.onLine);
      clearTimeout(netTimer);
      netTimer = setTimeout(() => {
        if (navigator.onLine === netShown) return; netShown = navigator.onLine;
        if (netShown) PatOS.notify({ title: PatOS.t('Back online'), body: PatOS.t('Apps that need the internet work again.'), icon: 'settings', duration: 3500 });
        else PatOS.notify({ title: PatOS.t('You’re offline'), body: PatOS.t('Your files and apps keep working. Apps that need the internet will wait.'), icon: 'settings', duration: 7000 });
      }, 1500);
    };
    window.addEventListener('online', netChange); window.addEventListener('offline', netChange);
    // PatOS started without internet: say so once, after the welcome
    if (!navigator.onLine) { netShown = false; setTimeout(() => { if (!navigator.onLine) PatOS.notify({ title: PatOS.t('You’re offline'), body: PatOS.t('Your files and apps keep working. Apps that need the internet will wait.'), icon: 'settings', duration: 7000 }); }, 2500); }

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
  // on a phone, Control Center and notifications fill the screen: a tap on their empty background closes them
  ['#control-center', '#notif-center'].forEach((sel) => { const p = $(sel); if (p) p.addEventListener('click', (e) => { if (PatOS.isMobile && (e.target === p || e.target.classList.contains('nc-list'))) p.classList.add('hidden'); }); });

  /* panels follow the pointer: drag Control Center, notifications or Pat up and they leave with your movement (fast or far
     enough), or spring back if you let go early */
  ['#control-center', '#notif-center', '#pat-panel'].forEach((sel) => {
    const p = $(sel); if (!p) return;
    p.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input, select, textarea, a, [contenteditable], .cc-range, .no-drag')) return;
      const y0 = e.clientY, t0 = performance.now(); let dy = 0, moved = false, lastY = y0, lastT = t0, vel = 0;
      const move = (ev) => {
        dy = Math.min(0, ev.clientY - y0); if (!moved && dy > -6) return;
        if (!moved) { moved = true; p.classList.add('dragging'); try { p.setPointerCapture(e.pointerId); } catch (er) {} }
        const now = performance.now(); vel = (ev.clientY - lastY) / Math.max(1, now - lastT); lastY = ev.clientY; lastT = now;
        p.style.transform = `translateY(${dy}px)`; p.style.opacity = String(Math.max(.25, 1 + dy / 260));
      };
      const up = () => {
        p.removeEventListener('pointermove', move); p.removeEventListener('pointerup', up); p.removeEventListener('pointercancel', up);
        if (!moved) return;
        p.classList.remove('dragging'); p.classList.add('springing');
        if (dy < -70 || vel < -0.5) { p.style.transform = 'translateY(-110%)'; p.style.opacity = '0'; setTimeout(() => { p.classList.add('hidden'); p.classList.remove('springing'); p.style.transform = ''; p.style.opacity = ''; }, 260); }
        else { p.style.transform = ''; p.style.opacity = ''; setTimeout(() => p.classList.remove('springing'), 500); }
      };
      p.addEventListener('pointermove', move); p.addEventListener('pointerup', up); p.addEventListener('pointercancel', up);
    });
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
    const events = PatOS.calendarOn ? PatOS.calendarOn(d) : (PatOS.store.get('calendar', {})[PatOS.dateKey ? PatOS.dateKey(d) : ''] || []);
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
  let ncQuery = '';
  const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? PatOS.t('now') : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : new Date(t).toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' }); };
  // a notification that arrives while Notification Center is open shows up in it
  PatOS.on('notif', PatOS.debounce(() => { const p = document.getElementById('notif-center'); if (p && !p.classList.contains('hidden') && !(document.activeElement && document.activeElement.classList.contains('nc-search'))) renderNC(); }, 120));
  function renderNC() {
    const nc = $('#notif-center'); const keep = nc.querySelector('.nc-search'); const hadFocus = keep && document.activeElement === keep; nc.innerHTML = '';
    const { cal, clock, up, remW } = buildWidgets();
    const T = PatOS.t;
    const q = h('input', { class: 'field nc-search', type: 'search', placeholder: T('Search notifications'), 'aria-label': T('Search notifications'), value: ncQuery });
    q.addEventListener('input', () => { ncQuery = q.value; renderNC(); });
    const groups = PatOS.nc.groups().map((g) => ({ app: g.app, name: g.name, items: g.items.filter((n) => !ncQuery || (n.title + ' ' + n.body).toLowerCase().includes(ncQuery.toLowerCase())) })).filter((g) => g.items.length);
    const item = (n) => h('div', { class: 'toast in static nc-item' + (n.priority === 'urgent' || n.priority === 'high' ? ' hi' : ''), onclick: () => { PatOS.nc.open(n.id); renderNC(); } },
      h('div', { class: 'toast-icon', html: PatOS.iconHTML(n.app) }),
      h('div', { class: 'toast-text' }, h('div', { class: 'toast-app' }, n.appName, h('span', {}, (n.count > 1 ? '×' + n.count + ' · ' : '') + ago(n.time))), h('b', {}, n.title), n.body ? h('div', {}, n.body) : null,
        n.actions.length ? h('div', { class: 'toast-acts' }, ...n.actions.map((a, i) => h('button', { class: 'toast-act', onclick: (e) => { e.stopPropagation(); PatOS.nc.act(n.id, i); renderNC(); } }, a.label))) : null),
      h('button', { class: 'nc-x', title: T('Dismiss'), 'aria-label': T('Dismiss'), onclick: (e) => { e.stopPropagation(); PatOS.nc.dismiss(n.id); renderNC(); } }, '×'));
    const list = h('div', { class: 'nc-list' },
      h('div', { class: 'nc-head' }, h('b', {}, T('Notifications')), groups.length ? h('button', { onclick: () => { PatOS.nc.clear(); renderNC(); } }, T('Clear all')) : null),
      PatOS.nc.list().length > 3 || ncQuery ? q : null,
      groups.length ? groups.map((g) => h('div', { class: 'nc-group' },
        g.items.length > 1 ? h('div', { class: 'nc-ghead' }, h('span', {}, g.name + ' · ' + g.items.length), h('button', { onclick: () => { PatOS.nc.clearApp(g.app); renderNC(); } }, T('Clear'))) : null,
        g.items.slice(0, 4).map(item))) : h('div', { class: 'w-muted pad' }, ncQuery ? T('Nothing matches.') : T('No new notifications')));
    nc.append(list, h('div', { class: 'nc-widgets' }, cal, clock, up, remW));
    if (hadFocus) { const nq = nc.querySelector('.nc-search'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }
    PatOS.nc.markRead();
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
  /* the Dock's icon size on a computer: the setting, a little bigger (10%), so the Dock reads well on big screens */
  PatOS.dockBase = () => Math.round((+PatOS.settings.dockSize || 50) * 1.1);
  function applyDockSize() {
    const s = PatOS.dockBase();
    // icons are drawn at their largest (magnified) size and scaled down at rest, so they stay sharp while magnified (css: --dock-max)
    const k = Math.max(1, PatOS.settings.magnify ? +PatOS.settings.magnifyScale || 1 : 1);
    document.documentElement.style.setProperty('--dock', s + 'px');
    document.documentElement.style.setProperty('--dock-max', Math.round(s * k) + 'px');
    document.documentElement.style.setProperty('--dock-rest-s', (1 / k).toFixed(4));
    $$('.dock-icon').forEach((i) => { i.style.width = i.style.height = s + 'px'; i.style.removeProperty('--dock-s'); if (i.parentNode) i.parentNode._dockSize = null; });
    $('#dock-wrap').classList.toggle('autohide', PatOS.settings.dockAutohide);
  }
  function setupDockMagnify() {
    const d = dockEl();
    let raf = 0, mx = null;
    /* One layout read per frame, then all the writes. Reading an icon's position right after resizing the one before it
       made the browser lay the Dock out again for every icon, every frame (~17 layouts a frame: the Dock ran at ~27 fps on a
       Chromebook-class CPU). Sizes that didn't change aren't written again. */
    const run = () => {
      raf = 0;
      const base = PatOS.dockBase(), maxS = base * PatOS.settings.magnifyScale, range = base * 2.6;
      const on = mx != null && PatOS.settings.magnify && !PatOS.settings.reduceMotion;
      const items = $$('.dock-item', d);
      const centers = on ? items.map((it) => { const r = it.getBoundingClientRect(); return r.left + r.width / 2; }) : null;
      let moving = false;
      items.forEach((it, i) => {
        let target = base;
        if (on) { const dist = Math.abs(mx - centers[i]); if (dist < range) target = base + (maxS - base) * Math.cos((dist / range) * (Math.PI / 2)) ** 2; }
        // ease toward the target here (no CSS transition: a transition re-styles every icon on its own frames on top of these)
        const from = it._dockBase === base && it._dockSize != null ? it._dockSize : base;
        let size = from + (target - from) * 0.45;
        if (Math.abs(target - size) < 0.6) size = target; else moving = true;
        size = Math.round(size * 2) / 2;
        if (it._dockSize === size && it._dockBase === base) return;
        it._dockSize = size; it._dockBase = base;
        const ic = it.querySelector('.dock-icon');
        // the slot widens (so neighbours make room) but keeps the Dock's height: the icon itself grows up out of the Dock
        // (css: .dock-icon > .icon-tile is pinned to the slot's bottom), and its label rises with it
        ic.style.width = size + 'px'; ic.style.height = base + 'px';
        ic.style.setProperty('--dock-s', (size / (base * Math.max(1, PatOS.settings.magnify ? +PatOS.settings.magnifyScale || 1 : 1))).toFixed(4));
        it.style.setProperty('--lift', (size - base).toFixed(1) + 'px');
      });
      if (moving && !raf) raf = requestAnimationFrame(run);
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
  // "timer 5 min" in Spotlight: rung by PatOS.alarms, so it rings on time even in the background
  PatOS.quickTimer = function (secs, label) {
    const mins = Math.round(secs / 60);
    const len = mins >= 1 ? mins + ' min' : secs + ' s';
    if (PatOS.alarms) {
      PatOS.alarms.askPermission();
      PatOS.alarms.schedule({ id: 'quick-' + PatOS.uid(), kind: 'timer', at: Date.now() + secs * 1000, title: label || PatOS.t('Timer done'), body: len + ' · ' + PatOS.t('Timer'), icon: 'clock', app: 'clock' });
    }
    PatOS.notify({ title: PatOS.t('Timer started'), body: len, icon: 'clock' });
  };

  /* ---------- matching: ignores accents and case, ranks better matches first, forgives one typo ---------- */
  const fold = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function oneEdit(a, b) {
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }
  // strict: for long keyword lists, where loose letter-by-letter matching would match almost anything
  function score(text, q, strict) {
    const t = fold(text); if (!t || !q) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 92 - Math.min(12, (t.length - q.length) * 0.3);
    const words = t.split(/[\s\-_./·,()]+/).filter(Boolean);
    if (words.some((w) => w.startsWith(q))) return 78;
    const i = t.indexOf(q); if (i >= 0) return 62 - Math.min(10, i * 0.1);
    if (!strict && q.length >= 2 && words.length > 1 && words.map((w) => w[0]).join('').startsWith(q)) return 66; // "pn" = Pat Notes
    if (q.length >= 4 && words.some((w) => oneEdit(w.slice(0, q.length), q) || oneEdit(w.slice(0, q.length + 1), q) || oneEdit(w.slice(0, q.length - 1), q))) return 40; // one typo
    // several words, in any order ("mode dark"): every word must start a word of the text
    const qw = q.split(/\s+/).filter(Boolean); if (qw.length > 1 && qw.every((x) => words.some((w) => w.startsWith(x)))) return 58;
    if (!strict && q.length >= 3 && t.length <= 40) { let j = 0; for (const ch of t) { if (ch === q[j]) j++; if (j === q.length) break; } if (j === q.length) return 22; } // letters in order
    return 0;
  }
  // where in the original text the match is, for highlighting (same length after folding for Latin letters)
  function markLabel(text, q) {
    const t = fold(text); const i = q ? t.indexOf(q) : -1;
    if (i < 0 || t.length !== String(text).length) return h('span', {}, text);
    return h('span', {}, text.slice(0, i), h('mark', {}, text.slice(i, i + q.length)), text.slice(i + q.length));
  }

  /* ---------- what was opened from Spotlight, so it ranks higher next time ---------- */
  const usage = () => PatOS.store.get('spUsage', {}) || {};
  function used(key) {
    const u = usage(); const e = u[key] || { n: 0, t: 0 }; e.n++; e.t = Date.now(); u[key] = e;
    const keys = Object.keys(u); if (keys.length > 200) keys.sort((a, b) => u[a].t - u[b].t).slice(0, keys.length - 200).forEach((k) => delete u[k]);
    PatOS.store.set('spUsage', u);
  }
  const boost = (u, key) => { const e = u[key]; if (!e) return 0; return Math.min(12, e.n * 2) + (Date.now() - e.t < 3 * 864e5 ? 6 : 0); };

  /* ---------- the file index: built once, then kept up to date when files change ---------- */
  let fileIndex = null;
  const TEXTY = /\.(txt|md|js|css|html?|json|csv|py|xml|log|yml|yaml|ts|c|cpp|java|pdoc|psheet|pslides|pform)$/i;
  function buildIndex() {
    const out = [];
    PatOS.fs.walk('/', (p, n) => {
      if (p === '/' || /\/\./.test(p)) return; // skip Trash and hidden folders
      const name = PatOS.fs.basename(p);
      let text = '';
      if (n.type === 'file' && !n.blob && typeof n.content === 'string' && TEXTY.test(name) && !n.content.startsWith('data:')) {
        text = n.content.length > 120000 ? n.content.slice(0, 120000) : n.content;
        if (/\.(pdoc|psheet|pslides|pform|html?)$/i.test(name)) text = text.replace(/<[^>]+>/g, ' ').replace(/\\[nrt]|&nbsp;/g, ' ').replace(/["{}[\],:]+/g, ' ');
        text = fold(text).replace(/\s+/g, ' ');
      }
      out.push({ p, name, dir: n.type === 'dir', text });
    });
    return out;
  }
  PatOS.on('fs', () => { fileIndex = null; });

  /* ---------- quick actions ---------- */
  const ACTIONS = [
    { label: 'Lock Screen', kw: 'lock verrouiller ecran screen', icon: 'settings', run: () => PatOS.power.lock() },
    { label: () => (PatOS.settings.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'), kw: 'dark light mode theme sombre clair mode nuit', icon: 'settings', run: () => PatOS.setSetting('theme', PatOS.settings.theme === 'dark' ? 'light' : 'dark') },
    { label: () => (PatOS.focusMode ? 'Turn Off Do Not Disturb' : 'Turn On Do Not Disturb'), kw: 'do not disturb focus ne pas deranger concentration silence', icon: 'settings', run: () => { PatOS.focusMode = !PatOS.focusMode; PatOS.notify({ title: PatOS.t(PatOS.focusMode ? 'Do Not Disturb is on' : 'Do Not Disturb is off'), icon: 'settings' }); } },
    { label: 'Empty Trash', kw: 'empty trash vider corbeille', icon: 'finder', run: async () => { if (await PatOS.confirmBox(PatOS.t('Empty Trash?'), PatOS.t('Items in the Trash will be deleted for good.'), { ok: PatOS.t('Empty'), danger: true, icon: 'finder' })) PatOS.fs.emptyTrash(); } },
    { label: 'Record the Screen', kw: 'record screen enregistrer ecran capture video screenshot', icon: 'screenshot', run: () => PatOS.launch('screenshot') },
    { label: () => (document.fullscreenElement ? 'Exit Full Screen' : 'Enter Full Screen'), kw: 'full screen plein ecran', icon: 'settings', run: () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); } },
    { label: 'Restart PatOS', kw: 'restart reload redemarrer recharger', icon: 'about', run: () => { PatOS._leaving = true; location.reload(); } },
    { label: 'Clipboard History', kw: 'clipboard history paste copied copy presse papiers historique coller copie', icon: 'timeline', run: () => PatOS.timeline && setTimeout(() => PatOS.timeline.clipPanel(), 80) },
    { label: () => { const x = PatOS.handoff && PatOS.handoff.offer(); return x ? PatOS.t('Continue from') + ' ' + x.name + ': ' + x.title : 'Continue from Another Device'; }, kw: 'handoff continue other device iphone chromebook phone continuer appareil autre', icon: 'timeline', run: () => { const x = PatOS.handoff && PatOS.handoff.offer(); if (x) PatOS.handoff.open(x); else PatOS.notify({ title: PatOS.t('Nothing to continue'), body: PatOS.t('Use PatOS on another device with Sync on, and it shows up here.'), icon: 'timeline' }); } },
    { label: 'Pick Up Where You Left Off', kw: 'restore resume reopen windows moment last session timeline reprendre restaurer rouvrir fenetres', icon: 'timeline', run: () => { const T = PatOS.timeline; const m = T && (T.lastSession() || T.moments().slice(-1)[0]); if (m) T.restoreMoment(m); else PatOS.launch('timeline'); } }
  ];
  const actLabel = (a) => PatOS.t(typeof a.label === 'function' ? a.label() : a.label);

  function webSearch(q) {
    if (PatOS.isOffline && PatOS.isOffline()) return PatOS.launch('browser', { url: q });
    PatOS.openExternal('https://www.google.com/search?q=' + encodeURIComponent(q) + '&hl=' + (PatOS.lang === 'fr' ? 'fr' : 'en'));
  }

  function search(raw) {
    const q = fold(raw.trim()); const T = PatOS.t; const u = usage(); const out = [];
    const add = (group, key, sc, r) => { if (sc > 0) out.push(Object.assign({ group, key, score: sc + boost(u, key) }, r)); };
    // instant answers
    const cv = convert(raw);
    if (cv) out.push({ group: 'Conversion', key: 'cv', score: 1000, label: cv.text, icon: 'calculator', preview: () => h('div', { class: 'sp-pv-big' }, String(cv.value)), copy: String(cv.value), run: () => copyOut(String(cv.value), cv.text) });
    const tm = /^(?:timer|minuterie|minuteur)\s+(\d+(?:[.,]\d+)?)\s*(s|sec|secs|seconds?|secondes?|m|min|mins|minutes?|h|hours?|heures?)?$/i.exec(raw.trim());
    if (tm) { const n = parseFloat(tm[1].replace(',', '.')); const un = (tm[2] || 'm')[0].toLowerCase(); const secs = Math.round(n * (un === 's' ? 1 : un === 'h' ? 3600 : 60)); if (secs > 0) out.push({ group: 'Timer', key: 'tm', score: 1000, label: T('Start a timer for') + ' ' + tm[1] + ' ' + (un === 's' ? 's' : un === 'h' ? 'h' : 'min'), icon: 'clock', run: () => PatOS.quickTimer(secs) }); }
    const c = calc(raw.trim());
    if (c !== null) out.push({ group: 'Calculator', key: 'calc', score: 1000, label: raw.trim() + ' = ' + c, icon: 'calculator', preview: () => h('div', { class: 'sp-pv-big' }, String(c)), copy: String(c), run: () => copyOut(String(c), String(c)) });
    // PatOS Intelligence: a command typed here is done by the same engine as Pat ("create a folder called Projects")
    if (PatOS.intel && raw.trim().length > 3) {
      const ip = PatOS.intel.parse(raw);
      if (ip && !/^(app\.open|app\.suggest|app\.list)$/.test(ip.id)) out.push({ group: 'PatOS Intelligence', key: 'intel:' + ip.id, score: 990, label: ip.text.charAt(0).toUpperCase() + ip.text.slice(1), sub: T(ip.action.title), icon: 'pat', run: () => runIntel(raw, ip.action) });
    }
    const def = /^(?:define|definition|definir|définir|définition)\s+(.+)$/i.exec(raw.trim());
    if (def && PatOS.apps.dictionary) out.push({ group: 'Dictionary', key: 'def', score: 1000, label: T('Look up') + ' “' + def[1] + '”', icon: 'dictionary', run: () => PatOS.launch('dictionary', { word: def[1] }) });
    // apps
    PatOS.appOrder.forEach((id) => {
      // hidden phone/web apps stay out of results, except Google's, which open with one click
      const a = PatOS.apps[id]; if (!a || (a.hidden && (id === 'extweb' || (a.external && a.external.cat !== 'Google')))) return;
      const nm = T(a.name);
      const sc = Math.max(score(nm, q), score(a.name, q), score(a.keywords || '', q, true) * 0.75);
      add('Applications', 'app:' + id, sc, { appId: id, label: nm, icon: a.icon || id, run: () => PatOS.launch(id) });
    });
    // settings: the pages, and each setting on its own (it opens right on it)
    if (PatOS.settingsIndex) PatOS.settingsIndex().forEach((st) => {
      const sc = Math.max(score(T(st.label), q), score(st.label, q), score(st.keywords, q, true) * 0.8);
      add('Settings', 'set:' + st.pane, sc * 0.9, { label: T(st.label), sub: T('Settings'), icon: 'settings', run: () => PatOS.launch('settings', { pane: st.pane }) });
    });
    (PatOS.settingsCatalog || []).forEach((c) => {
      const sc = Math.max(score(T(c.label), q), score(c.label, q), score(c.words, q, true) * 0.85);
      add('Settings', 'setk:' + c.key, sc, { label: T(c.label), sub: T('Settings'), icon: 'settings', run: () => PatOS.launch('settings', { pane: c.pane, find: c.key }) });
    });
    // shortcuts: Enter runs it
    if (PatOS.shortcuts) PatOS.shortcuts.list().forEach((sc0) => add('Shortcuts', 'sc:' + sc0.id, score(sc0.name, q), { label: sc0.name, sub: T('Run shortcut'), icon: 'shortcuts', run: () => PatOS.shortcuts.run(sc0) }));
    // calendar events (the next 60 days and the last 30)
    const cal = (PatOS.store.peek ? PatOS.store.peek('calendar') : PatOS.store.get('calendar', {})) || {};
    if (q.length >= 2) { const lo = PatOS.dateKey(new Date(Date.now() - 30 * 864e5)), hi = PatOS.dateKey(new Date(Date.now() + 60 * 864e5));
      Object.keys(cal).forEach((day) => { if (day < lo || day > hi) return; (cal[day] || []).forEach((ev) => add('Calendar', 'ev:' + ev.id, score(ev.title || '', q), { label: ev.title, sub: new Date(day + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'short', month: 'short', day: 'numeric' }) + (ev.time ? ' ' + ev.time : ''), icon: 'calendar', run: () => PatOS.launch('calendar', { date: day }) })); }); }
    // actions
    ACTIONS.forEach((a, i) => { const lab = actLabel(a); add('Actions', 'act:' + i, Math.max(score(lab, q), score(a.kw, q, true) * 0.85), { label: lab, icon: a.icon, run: a.run }); });
    // files: name first, then what's inside
    if (!fileIndex) fileIndex = buildIndex();
    const files = [];
    for (const f of fileIndex) {
      let sc = score(f.name, q), inText = -1;
      if (sc < 40 && q.length >= 3 && f.text) { inText = f.text.indexOf(q); if (inText >= 0) sc = Math.max(sc, 35); }
      if (sc > 0) files.push({ f, sc: sc + boost(u, 'file:' + f.p) + (f.dir ? -3 : 0), inText });
    }
    files.sort((a, b) => b.sc - a.sc).slice(0, 10).forEach(({ f, sc, inText }) => out.push({ group: f.dir ? 'Folders' : 'Files', key: 'file:' + f.p, score: sc, filePath: f.p, inText, label: f.name, sub: PatOS.fs.dirname(f.p), iconHTML: PatOS.fileIconHTML(f.p, PatOS.fs.get(f.p)), run: () => PatOS.openFile(f.p) }));
    // notes, reminders, contacts
    const look = (k, d) => (PatOS.store.peek && PatOS.store.peek(k) !== undefined ? PatOS.store.peek(k) : PatOS.store.get(k, d)) || d; // (read only: no copy per keystroke)
    look('notes', []).filter((n) => !n.deletedAt).forEach((n) => {
      const sc = Math.max(score(n.title, q), q.length >= 3 && fold(n.body).includes(q) ? 35 : 0);
      add('Notes', 'note:' + n.id, sc, { label: n.title || T('Untitled'), icon: 'notes', snippet: n.body, run: () => PatOS.launch('notes', { id: n.id }) });
    });
    // what you copied (Timeline's clipboard history): Enter copies it again
    if (PatOS.timeline) PatOS.timeline.searchClips(raw.trim(), 3).forEach((c) => add('Clipboard', 'clip:' + c.id, 36, { label: c.text.replace(/\s+/g, ' ').slice(0, 90), sub: T('Copied'), icon: 'timeline', snippet: c.text, run: () => PatOS.timeline.copy(c.text).then(() => PatOS.notify({ title: T('Copied'), body: c.text.slice(0, 80), icon: 'timeline', duration: 2000 })) }));
    look('reminders', []).filter((r) => !r.done).forEach((r) => add('Reminders', 'rem:' + r.id, score(r.text, q), { label: r.text, sub: r.due ? r.due + (r.time ? ' ' + r.time : '') : '', icon: 'reminders', run: () => PatOS.launch('reminders') }));
    look('contacts', []).forEach((ct) => {
      const name = ((ct.first || '') + ' ' + (ct.last || '')).trim() || ct.company || ct.email || '';
      add('Contacts', 'ct:' + ct.id, Math.max(score(name, q), score(ct.email || '', q) * 0.8, score(ct.company || '', q) * 0.7), { label: name, sub: ct.email || ct.phone || '', icon: 'contacts', run: () => PatOS.launch('contacts', { id: ct.id }) });
    });
    // passwords: the site and the user name only, never the password
    if (PatOS.passwords && !PatOS.passwords.locked) PatOS.passwords.all().forEach((pw) => add('Passwords', 'pw:' + pw.id, Math.max(score(pw.site, q), score(pw.username, q) * 0.8) * 0.9, { label: pw.site, sub: pw.username, icon: 'passwords', run: () => PatOS.launch('passwords', { site: pw.site }) }));
    // Patoogle bookmarks and history
    const seen = new Set();
    [...look('bookmarks', []).map((b) => ({ u: b.u, title: b.t })), ...look('browserHistory', []).slice(0, 300)].forEach((x) => {
      if (!x || !/^https?:/.test(x.u || '') || /igu=1/.test(x.u)) return; const k = x.u.replace(/[#?].*$/, ''); if (seen.has(k)) return; seen.add(k);
      let host = ''; try { host = new URL(x.u).hostname.replace(/^www\./, ''); } catch (e) {}
      add('Websites', 'web:' + k, Math.max(score(x.title || '', q), score(host, q)) * 0.85, { label: x.title && x.title !== host ? x.title : host, sub: host, icon: 'browser', run: () => PatOS.launch('browser', { url: x.u }) });
    });
    // groups in order of their best match; instant answers first; a "top hit" when one result clearly wins
    const groups = {}; out.forEach((r) => (groups[r.group] = groups[r.group] || []).push(r));
    const LIMIT = { 'PatOS Intelligence': 1, Clipboard: 3, Applications: 6, Settings: 5, Shortcuts: 3, Calendar: 3, Actions: 3, Files: 8, Folders: 4, Notes: 4, Reminders: 3, Contacts: 3, Passwords: 3, Websites: 4 };
    const ordered = Object.entries(groups).map(([g, list]) => { list.sort((a, b) => b.score - a.score); return [g, list.slice(0, LIMIT[g] || 4)]; }).sort((a, b) => b[1][0].score - a[1][0].score);
    let res = [].concat(...ordered.map(([, l]) => l));
    // leave out weak guesses when there are good matches
    const top = res.length ? res[0].score : 0; if (top >= 60 && top < 1000) res = res.filter((r) => r.score >= top * 0.4);
    const best = res[0];
    if (best && best.score < 1000 && best.score >= 70) res = [Object.assign({}, best, { group: 'Top Hit' })].concat(res.filter((r) => r !== best));
    res.push({ group: 'Web', key: 'web', label: T('Search Google for') + ' “' + raw.trim() + '”', icon: 'browser', run: () => webSearch(raw.trim()) });
    return res;
  }
  /* runs a command through PatOS Intelligence and says what happened (asks first when the action does) */
  async function runIntel(raw, a) {
    let r = PatOS.intel.respond(raw, { source: 'spotlight' }); if (!r) return; r = await r;
    if (r.status === 'confirm') { if (!(await PatOS.confirmBox(PatOS.t(a.title), r.message, { icon: 'pat' }))) return; r = await r.confirm(); }
    PatOS.notify({ title: PatOS.t(a.title), body: r.message.split('\n').slice(0, 3).join(' · '), icon: 'pat', onClick: r.data && r.data.files && r.data.files[0] ? () => PatOS.openFile(r.data.files[0]) : null });
  }
  function copyOut(text, shown) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).catch(() => {}); PatOS.notify({ title: PatOS.t('Copied'), body: shown, icon: 'calculator' }); }

  let lastQ = '';
  function render(qRaw) {
    const box = $('.sp-results'); box.innerHTML = ''; spResults = []; spSel = 0;
    lastQ = qRaw; const q = qRaw.trim();
    $('.sp-icon').innerHTML = $('#mb-search').innerHTML;
    const sb = $('#spotlight .sp-box');
    if (!q) {
      // nothing typed: what was opened recently from Spotlight
      const u = usage(); const recent = Object.entries(u).sort((a, b) => b[1].t - a[1].t).map(([k]) => k).filter((k) => /^(app|file):/.test(k)).slice(0, 6);
      recent.forEach((k) => {
        if (k.startsWith('app:')) { const id = k.slice(4); const a = PatOS.apps[id]; if (a) spResults.push({ group: 'Recent', key: k, appId: id, label: PatOS.t(a.name), icon: a.icon || id, run: () => PatOS.launch(id) }); }
        else { const p = k.slice(5); const n = PatOS.fs.get(p); if (n) spResults.push({ group: 'Recent', key: k, filePath: p, label: PatOS.fs.basename(p), sub: PatOS.fs.dirname(p), iconHTML: PatOS.fileIconHTML(p, n), run: () => PatOS.openFile(p) }); }
      });
      if (!spResults.length) { sb.classList.remove('has'); const pv0 = $('.sp-preview'); if (pv0) pv0.remove(); return; }
    } else spResults = search(q);
    const fq = fold(q);
    let lastG = '';
    spResults.forEach((r, i) => {
      if (r.group !== lastG) { box.appendChild(h('div', { class: 'sp-group', role: 'presentation' }, PatOS.t(r.group))); lastG = r.group; }
      const row = h('div', { class: 'sp-res' + (i === 0 ? ' sel' : ''), role: 'option', id: 'sp-opt-' + i, 'aria-selected': String(i === 0) }, h('div', { class: 'sp-ri', html: r.iconHTML || PatOS.iconHTML(r.icon) }), markLabel(r.label, fq), r.sub ? h('small', {}, r.sub) : null);
      row.addEventListener('click', () => go(r));
      row.addEventListener('pointermove', () => { if (spSel !== i) setSel(i); });
      box.appendChild(row);
    });
    sb.classList.add('has');
    preview(spResults[0]);
  }
  function go(r, reveal) {
    PatOS.spotlight.hide();
    if (r.key && !/^(calc|cv|tm|web|def)$/.test(r.key) && !/^clip:/.test(r.key)) used(r.key);
    if (reveal && r.filePath) return PatOS.launch('finder', { path: PatOS.fs.dirname(r.filePath) });
    r.run();
  }
  function setSel(i) {
    const rows = $$('.sp-res'); if (!rows.length) return;
    spSel = (i + rows.length) % rows.length;
    rows.forEach((r, j) => { r.classList.toggle('sel', j === spSel); r.setAttribute('aria-selected', String(j === spSel)); });
    const inp = $('.sp-input'); if (inp) inp.setAttribute('aria-activedescendant', rows[spSel].id || ''); // (screen readers follow the highlighted result)
    rows[spSel].scrollIntoView({ block: 'nearest' });
    preview(spResults[spSel]);
  }
  // a few lines around the match, with the match marked
  function snippet(text, q) {
    const plain = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const i = fold(plain).indexOf(q); if (i < 0) return h('pre', { class: 'sp-pv-text' }, plain.slice(0, 400));
    const s0 = Math.max(0, i - 120), e0 = Math.min(plain.length, i + q.length + 260);
    return h('pre', { class: 'sp-pv-text' }, (s0 ? '…' : '') + plain.slice(s0, i), h('mark', {}, plain.slice(i, i + q.length)), plain.slice(i + q.length, e0) + (e0 < plain.length ? '…' : ''));
  }
  function preview(r) {
    let pv = $('.sp-preview'); if (!pv) { pv = h('div', { class: 'sp-preview' }); $('#spotlight .sp-box').appendChild(pv); }
    pv.innerHTML = ''; if (!r) return;
    const fq = fold(lastQ.trim());
    if (r.appId) { const a = PatOS.apps[r.appId]; pv.append(h('div', { class: 'sp-pv-ic', html: PatOS.iconHTML(a.icon || r.appId) }), h('b', {}, PatOS.t(a.name)), h('p', {}, PatOS.t(a.about || a.category || 'Apps')), h('small', {}, PatOS.wm.isRunning(r.appId) ? PatOS.t('Open now') : PatOS.t(a.category || 'Apps'))); return; }
    if (r.filePath) {
      const n = PatOS.fs.get(r.filePath); if (!n) return;
      const kind = PatOS.fileKind(r.filePath, n);
      if (kind === 'image' && !n.blob && String(n.content).startsWith('data:')) pv.appendChild(h('img', { class: 'sp-pv-img', src: n.content, alt: '' }));
      else pv.appendChild(h('div', { class: 'sp-pv-ic', html: PatOS.fileIconHTML(r.label, n) }));
      pv.append(h('b', {}, r.label), h('small', {}, '~' + r.filePath + (n.type === 'file' ? ' · ' + PatOS.fmtBytes(PatOS.fs.size(n)) : '')));
      if (n.type === 'file' && !n.blob && typeof n.content === 'string' && !n.content.startsWith('data:') && TEXTY.test(r.label)) pv.appendChild(snippet(n.content.slice(0, 200000), fq));
      pv.appendChild(h('small', { class: 'sp-pv-hint' }, PatOS.t('Enter to open · Alt+Enter to show in Piles')));
      return;
    }
    if (r.snippet) { pv.append(h('div', { class: 'sp-pv-ic', html: PatOS.iconHTML(r.icon) }), h('b', {}, r.label), snippet(r.snippet, fq)); return; }
    if (r.preview) { pv.appendChild(r.preview()); pv.appendChild(h('small', {}, PatOS.t('Press Enter to copy'))); return; }
    pv.append(h('div', { class: 'sp-pv-ic', html: r.iconHTML || PatOS.iconHTML(r.icon) }), h('b', {}, r.label), r.sub ? h('small', {}, r.sub) : null);
  }
  function setupSpotlight() {
    const input = $('.sp-input');
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-label', PatOS.t('Spotlight Search'));
    let timer = null;
    input.addEventListener('input', () => { clearTimeout(timer); const big = fileIndex && fileIndex.length > 400; if (big) timer = setTimeout(() => render(input.value), 60); else render(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(spSel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(spSel - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (timer) { clearTimeout(timer); timer = null; if (input.value !== lastQ) render(input.value); } const r = spResults[spSel]; if (r) go(r, e.altKey); }
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
    const perCol = Math.max(1, Math.floor((innerHeight - top - PatOS.dockBase() - 40) / cellH));
    items.forEach((it, i) => {
      const p = pos[it.name] || { x: innerWidth - cellW - 14 - Math.floor(i / perCol) * cellW, y: top + (i % perCol) * cellH };
      // only the icon's drawn shape and its name take the pointer, not the whole square around them (css: .di-hit)
      const icon = PatOS.fileIconHTML(it.name, it);
      const shape = !/icon-tile[^"]*\bflat\b/.test(icon) ? 'tile' : /\bthumb\b/.test(icon) ? 'thumb' : PatOS.fileKind(it.name, it) === 'folder' ? 'folder' : 'page';
      const el = h('div', { class: 'desk-icon' + (selected.has(it.path) ? ' sel' : ''), 'data-path': it.path, 'data-shape': shape, style: { left: clamp(p.x, 0, innerWidth - 90) + 'px', top: clamp(p.y, 30, innerHeight - 100) + 'px' } },
        h('div', { class: 'di-img', html: icon }, h('span', { class: 'di-hit', 'aria-hidden': 'true' })), h('div', { class: 'di-name' }, it.name));
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
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => PatOS.fileClip.set(selected.has(path) ? [...selected] : [path], false) },
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => PatOS.fileClip.set(selected.has(path) ? [...selected] : [path], true) },
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
        { label: 'Paste', shortcut: 'Ctrl+V', disabled: !PatOS.fileClip.has(), action: () => PatOS.fileClip.paste('/Desktop') },
        { divider: true },
        { label: 'Clean Up Icons', action: () => PatOS.setSetting('desktopPositions', {}) },
        { label: 'Change Wallpaper…', action: () => PatOS.launch('settings', { pane: 'wallpaper' }) },
        { label: 'Next Wallpaper', action: nextWallpaper },
        { divider: true },
        { label: 'Open Terminal', action: () => PatOS.launch('terminal') },
        { label: 'Mission Control', action: () => PatOS.mission.enter() }
      ], e.clientX, e.clientY);
    });
    // files dragged in from the computer land on the desktop
    desk.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files') && !e.target.closest('.window')) e.preventDefault(); });
    desk.addEventListener('drop', (e) => { const files = [...((e.dataTransfer && e.dataTransfer.files) || [])]; if (!files.length || e.target.closest('.window')) return; e.preventDefault(); PatOS.importFileList('/Desktop', files); });
    // copy, cut and paste desktop icons when no window has the keyboard
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || PatOS.wm.active || e.target.closest('input, textarea, [contenteditable]') || !PatOS.loggedIn) return;
      const k = e.key.toLowerCase();
      if ((k === 'c' || k === 'x') && selected.size) { e.preventDefault(); PatOS.fileClip.set([...selected], k === 'x'); }
      else if (k === 'v' && PatOS.fileClip.has()) { e.preventDefault(); PatOS.fileClip.paste('/Desktop'); }
    });
    // catch-all to block the browser menu inside PatOS chrome
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea, [contenteditable], iframe, .allow-ctx')) e.preventDefault(); });
    PatOS.on('fs', (ev) => { if (ev.dir.startsWith('/Desktop') || ev.path.startsWith('/Desktop') || ev.dir === '/') renderDesktop(); if (ev.dir === '/.Trash' || ev.path.startsWith('/.Trash')) renderDock(); });
    // light or dark app icons: the Dock and the desktop are painted again (Launchpad and app windows paint theirs when they open or redraw)
    PatOS.on('icons:style', () => { renderDock(); renderDesktop(); if (!$('#launchpad').classList.contains('hidden')) PatOS.launchpad.render($('.lp-search').value || ''); });
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
    PatOS.glassLens.watch(row);
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

  const sysReduceTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const sysReduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function applyTheme() {
    const s = PatOS.settings;
    let t = s.theme;
    if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const root = document.documentElement;
    root.dataset.theme = t;
    root.style.setProperty('--accent', s.accent);
    // the system's own "reduce motion" and "reduce transparency" count as much as the settings
    root.classList.toggle('reduce-motion', !!s.reduceMotion || sysReduceMotion.matches);
    const lessGlass = !!s.reduceTransparency || sysReduceTransparency.matches || PatOS.perf.light();
    root.classList.toggle('reduce-transparency', lessGlass);
    root.classList.toggle('perf-light', PatOS.perf.light());
    // app icons: one-color apps always have a tile of their own color; the others have a white tile (Light) or a dark one (Dark).
    // Automatic follows light or dark mode. ('color' was the name of Light in a beta.)
    const st = s.iconStyle === 'color' ? 'light' : s.iconStyle;
    const iconMode = st === 'light' ? 'light' : st === 'dark' ? 'dark' : (t === 'light' ? 'light' : 'dark');
    const was = !root.classList.contains('icons-color') ? '' : root.classList.contains('icons-dark') ? 'dark' : 'light';
    if (was !== iconMode) {
      root.classList.add('icons-color'); root.classList.toggle('icons-dark', iconMode === 'dark'); root.classList.remove('icons-light');
      // the icons are pictures painted for their tile: paint the ones on screen again (the rest are painted as they appear)
      if (PatOS.loggedIn || PatOS.dock) setTimeout(() => PatOS.emit('icons:style', iconMode), 0);
    }
    root.classList.toggle('win', !!PatOS.hw.windows);
    ['highContrast', 'boldText', 'showFocus', 'bigTargets'].forEach((k) => root.classList.toggle(k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), !!s[k]));
    root.style.setProperty('--text-zoom', String([1, 1.15, 1.3, 1.5].includes(+s.textScale) ? +s.textScale : 1)); // Settings › Accessibility › Text size (what is inside app windows)
    $('#dimmer').style.opacity = String(1 - s.brightness);
    root.classList.toggle('lg-on', !!s.liquidGlass);
    root.classList.toggle('lg-tinted', !!s.liquidGlass && s.glassStyle === 'tinted');
    root.classList.toggle('lg-refract', !!(s.liquidGlass && s.glassRefraction && lens.supported() && s.quality3d !== 'low' && !lessGlass && !PatOS.perf.slow() && !root.classList.contains('mobile')));
    lens.refresh();
  }
  PatOS.applyTheme = applyTheme;
  [sysReduceTransparency, sysReduceMotion].forEach((m) => m.addEventListener && m.addEventListener('change', () => applyTheme()));

  /* Liquid Glass lens: the edges of the Dock, the app switcher and Launchpad's search bend what is behind them, like the rim of
     a thick pane of glass, while the middle stays clear. A displacement map (red = sideways, green = up/down, 128 = no move)
     is drawn for each bar's exact size and corner radius and used by an SVG filter in its backdrop-filter. Only Chromium
     can use an SVG filter in backdrop-filter (Safari would drop the whole blur), so everywhere else the glass is the same
     without the bend. Maps are made only when a bar settles at a new size (not on every frame of the Dock's magnification). */
  const lens = (() => {
    // every glass surface gets a lens on its edges (the 3D look); tiny things (labels, segmented controls) do not
    const SEL = '#dock, .asw-row, .lp-search, .widget, .cc-tile, .toast:not(.static), .menu, .sp-box, .dlg, .nc-list, #pat-panel, .lg, .lg-clear, .lg-elevated';
    const isChromium = (!!navigator.userAgentData || !!window.chrome || /Chrome\//.test(navigator.userAgent)) && !PatOS.isIOS && !/Firefox|FxiOS/.test(navigator.userAgent);
    const maps = new Map(); // "w×h×r" -> filter id
    let svg = null, ro = null, n = 0;
    const on = () => document.documentElement.classList.contains('lg-refract');
    /* The lens is a dome, read from a thick gel slab: the whole face magnifies a little (the middle samples closer to the
       centre), and along the rounded rim the glass bends hardest (a quarter circle: flat face, steepest at the very edge).
       Returns the map (red = sideways, green = up/down, 128 = no move) and the filter scale that the map is encoded for. */
    const LENS_MAX = 120000; // px², about a 600 × 200 surface
    const MAG = 1.1, MAG_MAX = 14; // 10% bigger, but never more than 14px of shift (so wide bars like the Dock don't swim)
    function domeMap(W, H, R, B) {
      const q = W * H > 60000 ? 2 : 1; // big panes: draw the (smooth) map at half size, the filter stretches it back
      const w = Math.ceil(W / q), hh = Math.ceil(H / q), bezel = B / q; const r = Math.min(R / q, w / 2, hh / 2);
      const magX = Math.min(W / 2 * (1 - 1 / MAG), MAG_MAX), magY = Math.min(H / 2 * (1 - 1 / MAG), MAG_MAX); // in screen px
      const rim = B * 1.6; // the bevel's strongest bend, in screen px
      const scale = 2 * (rim + Math.max(magX, magY)); // the largest shift fits in 0..255
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const x = c.getContext('2d'); const d = x.createImageData(w, hh); const a = d.data;
      // second picture: where the glass is thick enough to deepen the color behind it (white, with alpha = how much):
      // a band along the edge, strongest at the bottom, half on the sides, none at the top (the top is where light enters)
      const c2 = document.createElement('canvas'); c2.width = w; c2.height = hh;
      const x2 = c2.getContext('2d'); const d2 = x2.createImageData(w, hh); const a2 = d2.data;

      for (let j = 0; j < hh; j++) {
        for (let i = 0; i < w; i++) {
          const px = i + 0.5 - w / 2, py = j + 0.5 - hh / 2;
          const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (hh / 2 - r);
          const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
          const dist = -(Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r); // how far inside the rounded edge
          const u = 1 - Math.min(1, Math.max(0, dist / bezel)); // 1 at the rim, 0 where the flat face starts
          const k = 1 - Math.sqrt(1 - u * u); // quarter circle
          let nx = 0, ny = 0;
          if (qx > 0 && qy > 0) { const l = Math.hypot(ox, oy) || 1; nx = ox / l * Math.sign(px); ny = oy / l * Math.sign(py); }
          else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
          // where this pixel looks, in screen px: toward the centre (magnify) plus inward at the rim (bend)
          const dx = -(px / (w / 2)) * magX - nx * k * rim, dy = -(py / (hh / 2)) * magY - ny * k * rim;
          const o = (j * w + i) * 4;
          a[o] = Math.max(0, Math.min(255, Math.round(128 + 255 * dx / scale)));
          a[o + 1] = Math.max(0, Math.min(255, Math.round(128 + 255 * dy / scale)));
          a[o + 2] = 128; a[o + 3] = 255;
          const t = dist < bezel ? (1 - 0.35 * dist / bezel) * Math.min(1, (bezel - dist) / (0.35 * bezel)) : 0, side = Math.min(1, Math.max(0, 0.5 + 0.55 * ny)); // the bevel band (--g-rim-w), flowing into the face (no hard line)
          // the bevel's shade, as one gray: the filter multiplies the bent picture by .85 + .3 × gray, so 128 leaves it as it
          // is, the lower bevel comes out ~7% deeper and the upper bevel (where light enters) ~6% lighter
          const up = Math.min(1, Math.max(0, 0.45 - 0.6 * ny)); // top 1, sides about half, bottom 0
          const g = Math.round(255 * (0.5 - 0.2333 * t * side + 0.2 * t * up));
          a2[o] = a2[o + 1] = a2[o + 2] = Math.max(0, Math.min(255, g)); a2[o + 3] = 255;
        }
      }
      x.putImageData(d, 0, 0); x2.putImageData(d2, 0, 0);
      return { url: c.toDataURL(), rim: c2.toDataURL(), scale: Math.round(scale) };
    }
    function filterFor(w, hh, r, rimW) {
      const key = w + 'x' + hh + 'x' + r + 'x' + rimW; if (maps.has(key)) return maps.get(key);
      if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute'; document.body.appendChild(svg); }
      if (maps.size > 40) prune(); // (never removes a filter a surface still uses: that made the glass draw black)
      const id = 'lg-lens-' + (++n), bezel = Math.round(Math.min(rimW, Math.min(w, hh) * 0.3)); // the same band as the CSS bevel ring (--g-rim-w, at most 30%)
      const m = domeMap(w, hh, r, bezel);
      svg.insertAdjacentHTML('beforeend', '<filter id="' + id + '" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
        // under the map, a flat 128 grey (= "do not move"). Wherever the map is missing (the frames before its picture is
        // decoded, or the part of a surface that has just grown, like the Dock while it magnifies) nothing moves. Without it,
        // missing map reads as 0, which shifts that strip sideways and flashes a bar along the edge.
        '<feFlood flood-color="rgb(128,128,128)" result="still"/>' +
        '<feImage href="' + m.url + '" x="0" y="0" width="' + w + '" height="' + hh + '" preserveAspectRatio="none" result="img"/>' +
        '<feComposite in="img" in2="still" operator="over" result="map"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + m.scale + '" xChannelSelector="R" yChannelSelector="G" result="bent"/>' +
        // the bevel, lit from above: a little deeper at the bottom and sides, a little lighter at the top, always in the background's
        // own color. One shade picture and one arithmetic step (bent × (.85 + .3 × shade)), so the filter stays cheap: it runs
        // again every time what is behind the glass changes (every frame of a 3D wallpaper). The shade under the map is 128
        // (no change) where the picture is missing. (A ::after can't re-read the backdrop of glass in Chromium.)
        '<feFlood flood-color="rgb(128,128,128)" result="even"/>' +
        '<feImage href="' + m.rim + '" x="0" y="0" width="' + w + '" height="' + hh + '" preserveAspectRatio="none" result="shadeImg"/>' +
        '<feComposite in="shadeImg" in2="even" operator="over" result="shade"/>' +
        '<feComposite in="bent" in2="shade" operator="arithmetic" k1=".3" k2=".85" k3="0" k4="0"/></filter>');
      maps.set(key, id); return id;
    }
    /* drop the maps no surface uses any more (sizes come and go as windows, menus and notifications change) */
    function prune() {
      const used = new Set(); document.querySelectorAll(SEL).forEach((el) => { const v = el.style.getPropertyValue('--lg-lens'); const m = v && v.match(/#(lg-lens-\d+)/); if (m) used.add(m[1]); });
      for (const [key, id] of maps) if (!used.has(id)) { maps.delete(key); const f = svg && svg.querySelector('#' + id); if (f) f.remove(); }
    }
    function fit(el) {
      if (!on()) { el.style.removeProperty('--lg-lens'); return; }
      const w = Math.round(el.offsetWidth), hh = Math.round(el.offsetHeight);
      if (w < 24 || hh < 16) return;
      // the bend is drawn by the processor, not the graphics chip, again every time what's behind changes: on big surfaces
      // (Pat's panel, the notification list, large dialogs) it cost whole frames. They keep the same clear glass, without the bend.
      if (w * hh > LENS_MAX) { el.style.removeProperty('--lg-lens'); return; }
      const cs = getComputedStyle(el), r = Math.round(parseFloat(cs.borderTopLeftRadius) || 0);
      const rimW = Math.round(parseFloat(cs.getPropertyValue('--g-rim-w')) || 12);
      el.style.setProperty('--lg-lens', 'url(#' + filterFor(w, hh, r, rimW) + ')');
    }
    const pending = new Set(); const flush = PatOS.debounce(() => { pending.forEach((el) => el.isConnected && fit(el)); pending.clear(); }, 160);
    const settle = (els) => { els.forEach((el) => { if (!el.style.getPropertyValue('--lg-lens')) fit(el); else pending.add(el); }); flush(); };
    // menus, notifications, dialogs and Spotlight come and go: new ones are picked up when they appear
    let mo = null;
    // (new nodes are looked at together once a frame, not one by one as apps add them: typing in an editor or a long
    //  terminal output adds nodes all the time)
    const fresh = new Set(); let scanRaf = 0;
    const scanNow = () => { scanRaf = 0; fresh.forEach((n) => { if (!n.isConnected || !ro) return; if (n.matches(SEL)) ro.observe(n); if (n.firstElementChild) n.querySelectorAll(SEL).forEach((e) => ro.observe(e)); }); fresh.clear(); };
    const scan = (nodes) => { nodes.forEach((n) => { if (n.nodeType === 1) fresh.add(n); }); if (fresh.size && !scanRaf) scanRaf = requestAnimationFrame(scanNow); };
    function refresh() {
      const els = Array.from(document.querySelectorAll(SEL));
      if (!on()) { els.forEach((el) => el.style.removeProperty('--lg-lens')); if (ro) { ro.disconnect(); ro = null; } if (mo) { mo.disconnect(); mo = null; } return; }
      if (!ro && window.ResizeObserver) ro = new ResizeObserver((entries) => settle(entries.map((e) => e.target)));
      if (!mo && window.MutationObserver) { mo = new MutationObserver((recs) => recs.forEach((r) => scan(r.addedNodes))); mo.observe(document.getElementById('desktop') || document.body, { childList: true, subtree: true }); }
      els.forEach((el) => { fit(el); if (ro) ro.observe(el); });
    }
    /* After the computer sleeps, the tab is hidden for a while or the graphics chip resets, Chrome can lose the pictures the
       filters read, and glass that uses them draws black. Coming back, the filters are made again under new names, so the
       browser has to read them afresh. */
    function rebuild() { if (!on() || !svg) return; maps.clear(); svg.innerHTML = ''; refresh(); }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(rebuild, 60); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) rebuild(); });
    return { supported: () => isChromium, refresh, rebuild, watch: (el) => { if (on()) { fit(el); if (ro) ro.observe(el); } } };
  })();
  PatOS.glassLens = lens;

  /* Liquid Glass light follows the pointer */
  const TILT_SEL = '.cc-tile, #desk-widgets .widget'; let tilted = null;
  const untilt = () => { if (tilted) { tilted.style.removeProperty('--rx'); tilted.style.removeProperty('--ry'); tilted = null; } };
  /* (3.2 beta 8: this used to write the pointer's position (--mx, --my) on whatever glass it was over, windows included, on every
     mouse event. Nothing drew with those values, but each write made the browser restyle the whole window under the pointer:
     thousands of elements, many times a frame. Now only the small tilting tiles are touched, once a frame.) */
  let tiltEv = null, tiltRaf = 0;
  const tiltNow = () => {
    tiltRaf = 0; const e = tiltEv; if (!e) return;
    const t = e.target.closest && e.target.closest(TILT_SEL);
    if (tilted && tilted !== t) untilt();
    if (!t || document.documentElement.classList.contains('reduce-motion')) return;
    const r = t.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    t.style.setProperty('--rx', ((0.5 - fy) * 10).toFixed(2) + 'deg'); t.style.setProperty('--ry', ((fx - 0.5) * 10).toFixed(2) + 'deg'); tilted = t;
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !document.documentElement.classList.contains('lg-on')) return;
    if (!tilted && !(e.target.closest && e.target.closest(TILT_SEL))) return; // (most moves: nothing to do)
    tiltEv = e; if (!tiltRaf) tiltRaf = requestAnimationFrame(tiltNow);
  }, { passive: true });
  document.addEventListener('pointerleave', untilt);
  /* (one light for all the glass: --g-angle in css/glass.css, fixed at the upper left. It used to lean toward the pointer in
     15° steps, but every step made the rims jump, so it stays put.) */

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
        s: () => PatOS.wm.stage(),
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
    appMenus,
    init() {
      applyTheme();
      setupMenubar(); setupLaunchpad(); setupSpotlight(); setupDesktop(); setupDockMagnify(); setupKeys();
      PatOS.on('setting', (s) => {
        if (['theme', 'iconStyle', 'accent', 'brightness', 'reduceMotion', 'reduceTransparency', 'liquidGlass', 'glassRefraction', 'glassStyle', 'quality3d', 'perfMode'].includes(s.key)) applyTheme();
        if (['dockSize', 'dockAutohide', 'magnify', 'magnifyScale'].includes(s.key)) applyDockSize();
        if (s.key === 'dockPinned') renderDock();
      });
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
      // pause the 3D wallpaper while a window covers the whole screen (saves battery on Chromebooks; on a phone, any open app)
      const covered = () => { const H = document.documentElement; return H.classList.contains('mobile') ? H.classList.contains('m-in-app') && !H.classList.contains('m-peek') : PatOS.wm.windows.some((w) => w.maximized && !w.minimized); };
      ['wm:open', 'wm:close', 'wm:minimize'].forEach((ev) => PatOS.on(ev, () => { renderDock(); PatOS.wallpaper.pause(covered()); }));
      PatOS.on('wm:focus', () => PatOS.wallpaper.pause(covered()));
      renderDock(); renderDesktop(); renderDeskWidgets();
      setInterval(renderDeskWidgets, 30000);
      setInterval(() => { const c = $('#desk-widgets .w-clock canvas'); if (c) drawAnalog(c, new Date()); }, 1000);
      PatOS.on('setting:showWidgets', renderDeskWidgets);
      // refresh calendar/clock dock icons every minute
      setInterval(() => { $$('#dock .dock-item[data-app="calendar"] .dock-icon, #dock .dock-item[data-app="clock"] .dock-icon').forEach((el) => { el.innerHTML = PatOS.iconHTML(el.parentNode.dataset.app); }); }, 60000);
    }
  };
})();
