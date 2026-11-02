/* PatOS boot + login */
(function () {
  'use strict';
  const { $ } = PatOS;
  let shellReady = false;
  let lockTimer = null;

  function lockClock() {
    const d = new Date();
    $('.lock-date').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    $('.lock-time').textContent = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !PatOS.settings.clock24 }).replace(/\s?[AP]M$/i, '');
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
    $('.lock-hint').textContent = s.password ? '' : 'No password set — you can add one in System Settings › Lock Screen';
    lockClock(); clearInterval(lockTimer); lockTimer = setInterval(lockClock, 1000);
    setTimeout(() => pass.focus(), 300);
  }

  function login() {
    const s = PatOS.settings; const pass = $('.lock-pass');
    if (s.password && pass.value !== s.password) {
      const form = $('.lock-form'); form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      PatOS.sound.error(); pass.value = ''; return;
    }
    clearInterval(lockTimer);
    const lock = $('#lock'); lock.classList.add('unlocking');
    $('#desktop').classList.remove('hidden');
    if (!shellReady) { PatOS.shell.init(); shellReady = true; firstRun(); }
    setTimeout(() => lock.classList.add('hidden'), 500);
    PatOS.loggedIn = true;
    PatOS.sound.startup();
    if (s.askFullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function firstRun() {
    const seen = PatOS.store.get('seenWelcome', false);
    setTimeout(() => {
      PatOS.notify({ title: 'Welcome to PatOS, ' + PatOS.settings.userName + '!', body: seen ? 'Press Ctrl+Space to search, Alt+L for Launchpad.' : 'Double-click “Welcome to PatOS” on the desktop for tips. Press Ctrl+Space to search.', icon: 'about', duration: 6500 });
      if (!seen) PatOS.store.set('seenWelcome', true);
    }, 900);
  }

  function boot() {
    const fill = $('.boot-fill'); let p = 0;
    const fast = PatOS.store.get('seenWelcome', false);
    const step = () => {
      p += (fast ? 9 : 4) + Math.random() * (fast ? 14 : 9);
      fill.style.width = Math.min(100, p) + '%';
      if (p < 100) setTimeout(step, 60 + Math.random() * 120);
      else setTimeout(showLock, 350);
    };
    setTimeout(step, 400);
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
