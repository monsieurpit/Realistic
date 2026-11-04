/* PatOS boot + login */
(function () {
  'use strict';
  const { $ } = PatOS;
  let shellReady = false;
  let lockTimer = null;

  function lockClock() {
    const d = new Date();
    $('.lock-date').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const parts = new Intl.DateTimeFormat(PatOS.locale, { hour: 'numeric', minute: '2-digit', hour12: !PatOS.settings.clock24 }).formatToParts(d);
    $('.lock-time').textContent = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
  }

  // PatOS started fine: tell the update safety check (js/preload.js)
  let bootMarked = false;
  function markBooted() {
    if (bootMarked) return; bootMarked = true;
    const rolled = window.__patosBootOK && window.__patosBootOK();
    if (rolled) setTimeout(() => PatOS.notify({ title: PatOS.t('PatOS went back to the previous version'), body: PatOS.t('The newest version didn’t start on this device, so the one that worked before is back. The next update will be tried again.'), icon: 'about', duration: 12000 }), 2500);
  }
  function showLock() {
    markBooted();
    const s = PatOS.settings;
    PatOS.wallpaper.apply();
    $('#boot').classList.add('hidden');
    const lock = $('#lock');
    lock.classList.remove('hidden', 'unlocking');
    $('.lock-name').textContent = s.userName;
    $('.lock-avatar').textContent = (s.userName || 'P').trim().charAt(0).toUpperCase();
    const pass = $('.lock-pass');
    pass.value = '';
    pass.placeholder = s.password ? 'Enter Password' : 'Press Enter to log in';
    $('.lock-hint').textContent = PatOS.isMobile ? (s.password ? 'Swipe up, then enter your password' : 'Swipe up to open') : (s.password ? '' : 'No password set. You can add one in System Settings › Lock Screen.');
    lock.classList.remove('need-pass');
    lockClock(); clearInterval(lockTimer); lockTimer = setInterval(lockClock, 1000);
    if (soft && soft.wasIn && !s.password && !(PatOS.setup && document.getElementById('setup'))) { const was = soft; soft = Object.assign({}, was, { wasIn: false }); setTimeout(() => login(), 60); }
    setTimeout(() => pass.focus(), 300);
  }

  function login() {
    const s = PatOS.settings; const pass = $('.lock-pass');
    if (PatOS.isMobile && s.password && !$('#lock').classList.contains('need-pass')) { $('#lock').classList.add('need-pass'); setTimeout(() => pass.focus(), 50); return; }
    if (s.password && pass.value !== s.password) {
      const form = $('.lock-form'); form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      PatOS.sound.error(); pass.value = ''; return;
    }
    clearInterval(lockTimer);
    const lock = $('#lock'); lock.classList.add('unlocking');
    $('#desktop').classList.remove('hidden');
    if (!shellReady) { PatOS.shell.init(); PatOS.mobile && PatOS.mobile.init(); shellReady = true; if (!(PatOS.setup && PatOS.setup.maybeShow())) firstRun(); else setTimeout(() => PatOS.emit('wm:ready'), 1200); }
    setTimeout(() => lock.classList.add('hidden'), 500);
    PatOS.loggedIn = true;
    if (!soft) PatOS.sound.startup();
    if (PatOS.isMobile && PatOS.isIOS && !navigator.standalone && !PatOS.store.get('iosHint', false)) {
      PatOS.store.set('iosHint', true);
      setTimeout(() => PatOS.notify({ title: 'Make PatOS full screen', body: 'In Safari tap Share, then “Add to Home Screen”. PatOS then opens like a real app.', icon: 'about', duration: 9000 }), 8000);
    }
    if (!PatOS.isMobile && s.askFullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function firstRun() {
    setTimeout(() => PatOS.emit('wm:ready'), 1200);
    const seen = PatOS.store.get('seenWelcome', false);
    if (soft) return; // back from a restart: no welcome again
    setTimeout(() => {
      const body = PatOS.isMobile
        ? (seen ? 'Tap Search above the Dock to find anything. Press and hold an app for more.' : 'Tap Search above the Dock to find anything. Press and hold an app for more. The ⊞ button in an app takes you home.')
        : (seen ? 'Press Ctrl+Space to search, Alt+L for Launchpad.' : 'Double-click “Welcome to PatOS” on the desktop for tips. Press Ctrl+Space to search.');
      PatOS.notify({ title: 'Welcome to PatOS, ' + PatOS.settings.userName + '!', body, icon: 'about', duration: 6500 });
      if (!seen) PatOS.store.set('seenWelcome', true);
    }, 900);
  }

  /* particle intro: dots fly in and form the P logo */
  function bootParticles() {
    // returning users only see the boot screen for a moment, so they get the plain logo
    const holder = $('.boot-logo'); if (!holder || PatOS.settings.reduceMotion || PatOS.store.get('seenWelcome', false)) return;
    const S = 150, dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = h('canvas', { class: 'boot-canvas' }); c.width = c.height = S * dpr; holder.innerHTML = ''; holder.appendChild(c);
    const off = document.createElement('canvas'); off.width = off.height = S; const o = off.getContext('2d');
    o.fillStyle = '#fff'; o.font = '800 140px ' + getComputedStyle(document.body).fontFamily; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('P', S / 2, S / 2 + 8);
    const data = o.getImageData(0, 0, S, S).data; const pts = [];
    for (let y = 0; y < S; y += 3) for (let x = 0; x < S; x += 3) if (data[(y * S + x) * 4 + 3] > 128) pts.push({ tx: x, ty: y, x: S / 2 + (Math.random() - 0.5) * 600, y: S / 2 + (Math.random() - 0.5) * 600, d: Math.random() * 0.5 });
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    const t0 = performance.now();
    const step = (now) => {
      const t = (now - t0) / 1000; ctx.clearRect(0, 0, S, S);
      let settled = true;
      pts.forEach((p) => {
        const k = Math.min(1, Math.max(0, (t - p.d) / 1.1)); const e = 1 - Math.pow(1 - k, 4);
        const x = p.x + (p.tx - p.x) * e, y = p.y + (p.ty - p.y) * e; if (k < 1) settled = false;
        ctx.fillStyle = `hsla(${260 + (1 - e) * 80}, 90%, ${70 + e * 30}%, ${0.4 + e * 0.6})`;
        ctx.beginPath(); ctx.arc(x, y, 1.5 + (1 - e) * 1.5, 0, 7); ctx.fill();
      });
      if (!settled && t < 3) requestAnimationFrame(step);
      else { ctx.clearRect(0, 0, S, S); holder.innerHTML = '<span>P</span>'; }
    };
    requestAnimationFrame(step);
  }
  const { h } = PatOS;

  /* The bar follows real work: by now every script and the saved data are loaded, so it waits only
     for the fonts and the first frame of the wallpaper. Returning users see it for under half a second;
     the first start keeps a little more time for the intro. */
  function boot() {
    const fill = $('.boot-fill');
    if (soft) { const m = h('div', { class: 'boot-msg' }, PatOS.t(soft.update ? 'Updating PatOS…' : 'Restarting…')); $('#boot').appendChild(m); fill.style.transition = 'none'; fill.style.width = '45%'; } else bootParticles();
    const minMs = soft ? 250 : PatOS.store.get('seenWelcome', false) ? 400 : 1500, t0 = performance.now();
    requestAnimationFrame(() => { fill.style.transition = ''; fill.style.width = soft ? '70%' : '35%'; });
    const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    fonts.then(() => { fill.style.width = '75%'; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); })
      .catch(() => {})
      .then(() => setTimeout(() => { fill.style.width = '100%'; setTimeout(showLock, 250); }, Math.max(0, minMs - (performance.now() - t0))));
  }
  /* ---------- Software Update ----------
     The browser only looks for a new PatOS when the page loads, so PatOS asks the server itself every few
     minutes and whenever you come back to it. When a new version is found you get "Update available"; once
     it is downloaded, "Ready to install", which opens Settings › Software Update (version, what changed,
     Restart PatOS). Installing restarts PatOS on its own boot screen and brings your windows back. */
  const SOFT = 'patos-soft';
  let soft = null; try { soft = JSON.parse(localStorage.getItem(SOFT) || 'null'); localStorage.removeItem(SOFT); if (soft && Date.now() - soft.t > 60000) soft = null; } catch (e) { soft = null; }
  const relText = (r, k) => (r && r[k] ? (typeof r[k] === 'string' ? r[k] : r[k][PatOS.lang === 'fr' ? 'fr' : 'en'] || r[k].en) : '');
  /* Versions: the normal releases, plus a beta being built (a "beta" number in updates.json). People with
     Settings › Software Update › Beta updates on are told about each beta; everyone else only about normal
     releases. There is one website, so everyone receives the same files: the switch decides what you are told. */
  const betaOn = () => !!PatOS.settings.betaUpdates;
  const idOf = (r) => (r ? r.version + (r.beta ? 'b' + r.beta : '') : '');
  const label = (r) => (r ? 'PatOS ' + r.version + (r.beta ? ' ' + PatOS.t('beta') + ' ' + r.beta : '') : 'PatOS');
  PatOS.versionLabel = label;
  // the version this copy is really running (with 'beta N' on a beta); About, Terminal and Settings show this
  PatOS.versionNow = () => { const r = runningRel(); return r.version + (r.beta ? ' ' + PatOS.t('beta') + ' ' + r.beta : ''); };
  // what this copy of PatOS is: the beta (when Beta updates is on and this code has one) or the release
  const runningRel = () => (betaOn() && PatOS.beta ? PatOS.beta : (PatOS.releases && PatOS.releases[0]) || { version: PatOS.version });
  function setupUpdates() {
    let reg = null, lastCheck = 0, told = 0;
    const U = PatOS.update = {
      state: 'idle', // idle · checking · downloading · ready · uptodate · offline
      newest: null, // the newest normal release on the server
      newestBeta: null, // the beta being built on the server, if any
      releases: PatOS.releases || [],
      get current() { return runningRel(); },
      get target() { const b = U.newestBeta, n = U.newest; return betaOn() && b && (!n || n.version !== b.version) ? b : n; }, // what you should be on
      get newer() { return !!U.target && idOf(U.target) !== idOf(U.current); },
      betaOn, label, relText,
      async fetchReleases() {
        try { const r = await fetch('/api/updates', { cache: 'no-store' }); const l = await r.json(); if (Array.isArray(l) && l.length) { U.releases = l; U.newest = l[0]; } } catch (e) {}
        try { const r = await fetch('/api/updates/beta', { cache: 'no-store' }); U.newestBeta = r.ok ? await r.json() : null; } catch (e) {}
        return U.releases;
      },
      check: (force) => check(force !== false),
      setBeta(on) { PatOS.setSetting('betaUpdates', !!on); U.state = 'idle'; check(true); },
      restart
    };
    const set = (st) => { U.state = st; PatOS.emit('update', U); };
    const openPane = () => PatOS.launch('settings', { pane: 'update' });
    const tellReady = () => {
      told = Date.now(); const n = U.target;
      PatOS.notify({ title: PatOS.t('Update ready to install'), body: label(n) + (relText(n, 'title') ? ': ' + relText(n, 'title') : '') + '. ' + PatOS.t('Click to see what’s new and install it.'), icon: 'about', duration: 30000, onClick: openPane });
    };
    const ready = async () => {
      if (U.state === 'ready') return; await U.fetchReleases();
      // nothing new for you (a beta while Beta updates is off): the new files are simply used the next time PatOS starts
      if (!U.newer) { if (U.state === 'downloading' || U.state === 'checking') set('uptodate'); return; }
      set('ready'); tellReady();
    };
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => {
      reg = r;
      r.addEventListener('updatefound', async () => {
        if (!navigator.serviceWorker.controller || U.state === 'ready') return; // the very first install is not an update
        await U.fetchReleases(); if (!U.newer) return;
        set('downloading');
        PatOS.notify({ title: PatOS.t('Update available'), body: label(U.target) + ' · ' + PatOS.t('Downloading…'), icon: 'about', duration: 8000, onClick: openPane });
      });
    }).catch(() => {});
    async function check(force) {
      if (!reg || U.state === 'ready' || U.state === 'downloading') return U.state;
      if (!force && Date.now() - lastCheck < 30000) return U.state;
      if (!navigator.onLine) { set('offline'); return U.state; }
      lastCheck = Date.now(); set('checking');
      try { await reg.update(); } catch (e) {}
      await U.fetchReleases();
      // already downloaded earlier, quietly (for example a beta before Beta updates was turned on): a restart installs it
      if (U.newer && !reg.installing && U.state === 'checking') { set('ready'); tellReady(); return U.state; }
      setTimeout(() => { if (U.state === 'checking') set('uptodate'); }, 2500);
      return U.state;
    }
    setInterval(() => { if (!document.hidden) check(true); }, 3 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
    window.addEventListener('focus', () => check(false)); window.addEventListener('online', () => check(true));
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.patosUpdate) ready(); });
    // a gentle reminder every 20 minutes until it is installed
    setInterval(() => { if (U.state === 'ready' && !document.hidden && PatOS.loggedIn && Date.now() - told > 20 * 60000) tellReady(); }, 30000);
    // just updated
    if (soft && soft.update) setTimeout(() => { const c = runningRel(); PatOS.notify({ title: PatOS.t('PatOS was updated'), body: label(c) + (relText(c, 'title') ? ': ' + relText(c, 'title') : ''), icon: 'about', duration: 7000, onClick: openPane }); }, 1800);
  }
  /* restart PatOS itself: its boot screen comes up, your work is saved, and it starts again with your windows */
  async function restart(opts) {
    opts = opts || {};
    const boot = $('#boot'), fill = $('.boot-fill');
    let msg = boot.querySelector('.boot-msg'); if (!msg) { msg = h('div', { class: 'boot-msg' }); boot.appendChild(msg); }
    msg.textContent = PatOS.t(opts.update === false ? 'Restarting…' : 'Updating PatOS…');
    $('.boot-logo').innerHTML = '<span>P</span>';
    fill.style.transition = 'none'; fill.style.width = '0%';
    boot.classList.remove('hidden'); boot.classList.add('boot-over');
    requestAnimationFrame(() => { fill.style.transition = ''; fill.style.width = '45%'; });
    PatOS._leaving = true;
    try { PatOS.session && PatOS.session.snapshot(); await PatOS.flush(); } catch (e) {}
    try { localStorage.setItem(SOFT, JSON.stringify({ t: Date.now(), wasIn: !!PatOS.loggedIn, update: opts.update !== false })); } catch (e) {}
    await new Promise((r) => setTimeout(r, 450));
    location.reload();
  }
  PatOS.restartPatOS = restart;
  PatOS.boot = { showLock, login };

  (document.readyState === 'loading' ? (fn) => document.addEventListener('DOMContentLoaded', fn) : (fn) => fn())(() => {
    PatOS.applyTheme && PatOS.applyTheme();
    $('.lock-form').addEventListener('submit', (e) => { e.preventDefault(); login(); });
    document.addEventListener('keydown', (e) => {
      if ($('#lock').classList.contains('hidden') || PatOS.loggedIn || e.target === $('.lock-pass')) return;
      if (e.key === 'Enter') { e.preventDefault(); login(); }
      else if (e.key.length === 1) $('.lock-pass').focus();
    });
    let sw = null;
    $('#lock').addEventListener('pointerdown', (e) => { if (!PatOS.isMobile || e.target.closest('.lock-form')) return; sw = { y: e.clientY }; });
    $('#lock').addEventListener('pointermove', (e) => { if (!sw) return; const dy = Math.max(0, sw.y - e.clientY); $('#lock').style.transform = `translateY(${-dy * 0.6}px)`; $('#lock').style.transition = 'none'; });
    $('#lock').addEventListener('pointerup', (e) => {
      if (!sw) return; const dy = sw.y - e.clientY; sw = null;
      const l = $('#lock'); l.style.transition = ''; l.style.transform = '';
      if (dy > 90) login();
    });
    $('#lock').addEventListener('click', (e) => { if (!e.target.closest('.lock-form, .lock-actions')) $('.lock-pass').focus(); });
    $('.lock-actions').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'restart') (PatOS._leaving = true, location.reload());
      if (b.dataset.act === 'sleep') PatOS.power.sleep();
      if (b.dataset.act === 'shutdown') {
        $('#lock').classList.add('hidden');
        PatOS.wallpaper.stop();
        const off = $('#off'); off.classList.remove('hidden');
        off.addEventListener('pointerdown', () => (PatOS._leaving = true, location.reload()), { once: true });
      }
    });
    if (PatOS.sortApps) PatOS.sortApps();
    boot();
    // offline support / installable app when served over http(s)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !PatOS.singleFile) setupUpdates();
  });
})();
