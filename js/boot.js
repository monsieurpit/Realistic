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

  function showLock() {
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
    PatOS.sound.startup();
    if (PatOS.isMobile && PatOS.isIOS && !navigator.standalone && !PatOS.store.get('iosHint', false)) {
      PatOS.store.set('iosHint', true);
      setTimeout(() => PatOS.notify({ title: 'Make PatOS full screen', body: 'In Safari tap Share, then “Add to Home Screen”. PatOS then opens like a real app.', icon: 'about', duration: 9000 }), 2500);
    }
    if (!PatOS.isMobile && s.askFullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function firstRun() {
    setTimeout(() => PatOS.emit('wm:ready'), 1200);
    const seen = PatOS.store.get('seenWelcome', false);
    setTimeout(() => {
      PatOS.notify({ title: 'Welcome to PatOS, ' + PatOS.settings.userName + '!', body: seen ? 'Press Ctrl+Space to search, Alt+L for Launchpad.' : 'Double-click “Welcome to PatOS” on the desktop for tips. Press Ctrl+Space to search.', icon: 'about', duration: 6500 });
      if (!seen) PatOS.store.set('seenWelcome', true);
    }, 900);
  }

  /* particle intro: dots fly in and form the P logo */
  function bootParticles() {
    const holder = $('.boot-logo'); if (!holder || PatOS.settings.reduceMotion) return;
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

  function boot() {
    bootParticles();
    const fill = $('.boot-fill'); let p = 0;
    const fast = PatOS.store.get('seenWelcome', false);
    const step = () => {
      p += (fast ? 9 : 4) + Math.random() * (fast ? 14 : 9);
      fill.style.width = Math.min(100, p) + '%';
      if (p < 100) setTimeout(step, 60 + Math.random() * 120);
      else setTimeout(showLock, 350);
    };
    setTimeout(step, fast ? 700 : 1300);
  }

  PatOS.boot = { showLock, login };

  document.addEventListener('DOMContentLoaded', () => {
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
      if (b.dataset.act === 'restart') location.reload();
      if (b.dataset.act === 'sleep') PatOS.power.sleep();
      if (b.dataset.act === 'shutdown') {
        $('#lock').classList.add('hidden');
        PatOS.wallpaper.stop();
        const off = $('#off'); off.classList.remove('hidden');
        off.addEventListener('pointerdown', () => location.reload(), { once: true });
      }
    });
    boot();
    // offline support / installable app when served over http(s)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !PatOS.singleFile) navigator.serviceWorker.register('sw.js').catch(() => {});
  });
})();
