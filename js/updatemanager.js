/* PatOS update manager (browser side).
   Which version of PatOS a device runs is decided by the person, not by the website:
     - a finished version (1.7.0 → 1.8.0): you are told it exists (Update available), and it is only downloaded and used when
       you press the button in Settings › Software Update. Refreshing or reopening PatOS keeps the version you have.
     - a beta: only with Settings › Software Update › Beta updates on. The newest beta is downloaded quietly and used the next
       time PatOS starts (the service worker, sw.js, does this); the button installs it at once.
   The files of every version live on the server in their own folder (see update-manager.js) and are saved on the device
   in their own box by sw.js. This file is the part that talks to the person: it asks the server what exists, compares with
   what you run (PatOS.build, written by build.js), asks sw.js to download and switch, and tells you.
   PatOS.update is what Settings › Software Update shows. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const B = PatOS.build || { channel: PatOS.beta ? 'beta' : 'stable', version: PatOS.version, beta: PatOS.beta ? PatOS.beta.beta : 0 };
  const relText = (r, k) => (r && r[k] ? (typeof r[k] === 'string' ? r[k] : r[k][PatOS.lang === 'fr' ? 'fr' : 'en'] || r[k].en) : '');
  const betaOn = () => !!(PatOS.settings && PatOS.settings.betaUpdates);
  const idOf = (r) => (r ? r.version + (r.beta ? 'b' + r.beta : '') : '');
  const label = (r) => (r ? 'PatOS ' + r.version + (r.beta ? ' ' + T('beta') + ' ' + r.beta : '') : 'PatOS');
  /* bigger means newer; a beta is older than the finished version it leads to (2.0.0 beta 11 < 2.0.0) */
  const rank = (r) => { const n = String(r.version).split('.').map(Number); return [n[0] || 0, n[1] || 0, n[2] || 0, r.beta ? 0 : 1, r.beta || 0]; };
  const isNewer = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < 5; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; };
  /* the version these files are: the beta this build was made as, or the finished version */
  const runningRel = () => (B.channel === 'beta' && PatOS.beta ? PatOS.beta : (PatOS.releases || []).find((r) => r.version === B.version) || (PatOS.releases && PatOS.releases[0]) || { version: PatOS.version });
  PatOS.versionLabel = label;
  // the version this copy is really running (with 'beta N' on a beta); About, Terminal and Settings show this
  PatOS.versionNow = () => { const r = runningRel(); return r.version + (r.beta ? ' ' + T('beta') + ' ' + r.beta : ''); };

  /* a message to the service worker, and its answer (null if there is none in time) */
  function ask(msg, ms) {
    return new Promise((res) => {
      if (!navigator.serviceWorker || !window.MessageChannel) return res(null);
      let done = false; const end = (v) => { if (!done) { done = true; res(v); } };
      setTimeout(() => end(null), ms || 15000);
      navigator.serviceWorker.ready.then((r) => { const w = r.active || navigator.serviceWorker.controller; if (!w) return end(null); const ch = new MessageChannel(); ch.port1.onmessage = (e) => end(e.data); w.postMessage(msg, [ch.port2]); }).catch(() => end(null));
    });
  }

  /* the version this device installed, told to the server (a cookie), so a page the service worker doesn't serve still gets it */
  function remember(st) {
    if (!st || !st.installed) return; const id = String(st.installed);
    const ch = /-beta\./.test(id) ? 'beta' : /^\d+\.\d+\.\d+$/.test(id) ? id : ''; if (!ch) return;
    try { document.cookie = 'patos_ch=' + ch + '; path=/; max-age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
  }
  const INSTALLING = 'patos-installing';

  /* starts watching for updates. opts.soft is set when PatOS was just restarted on purpose (to show "PatOS was updated") */
  function setup(opts) {
    opts = opts || {};
    let reg = null, lastCheck = 0, told = 0;
    const U = PatOS.update = {
      state: 'idle', // idle · checking · downloading · ready · uptodate · offline
      newest: null, // the newest finished version on the server
      newestBeta: null, // the beta being built on the server, if any
      releases: PatOS.releases || [],
      get current() { return runningRel(); },
      get target() { const b = U.newestBeta, n = U.newest; return betaOn() && b && (!n || n.version !== b.version) ? b : n; }, // what you could be on
      get newer() { return !!U.target && isNewer(U.target, U.current); }, // never offers an older version
      betaOn, label, relText,
      async fetchReleases() {
        try { const r = await fetch('/api/updates', { cache: 'no-store' }); const l = await r.json(); if (Array.isArray(l) && l.length) { U.releases = l; U.newest = l[0]; } } catch (e) {}
        try { const r = await fetch('/api/updates/beta', { cache: 'no-store' }); U.newestBeta = r.ok ? await r.json() : null; } catch (e) {}
        return U.releases;
      },
      check: (force) => check(force !== false),
      /* Beta updates on or off: a beta is downloaded quietly from now on, or never */
      setBeta(on) { PatOS.setSetting('betaUpdates', !!on); U.state = 'idle'; ask({ patosHello: { betaOn: !!on } }).then(() => check(true)); },
      /* downloads the version offered (if there is one), switches to it, and restarts PatOS on its own boot screen */
      async restart(o) {
        o = o || {};
        if (o.update !== false && U.newer) {
          const t = U.target; set('downloading');
          const r = await ask(t.beta ? { patosInstall: { beta: true } } : { patosInstall: { id: t.version } }, 180000);
          if (!r || !r.ok) { set('ready'); PatOS.alertBox(T('That didn’t work'), (r && r.error) || T('You’re offline. PatOS checks again when the internet is back.'), { icon: 'about' }); return false; }
          remember(r);
          try { sessionStorage.setItem(INSTALLING, JSON.stringify({ want: idOf(t), from: idOf(U.current), t: Date.now(), tries: 0 })); } catch (e) {}
        }
        return PatOS.restartPatOS ? PatOS.restartPatOS(o) : location.reload();
      }
    };
    const set = (st) => { U.state = st; PatOS.emit('update', U); };
    const openPane = () => PatOS.launch('settings', { pane: 'update' });
    const tellReady = () => {
      told = Date.now(); const n = U.target;
      PatOS.notify({ title: T('Update ready to install'), body: label(n) + (relText(n, 'title') ? ': ' + relText(n, 'title') : '') + '. ' + T('Click to see what’s new and install it.'), icon: 'about', duration: 30000, onClick: openPane });
    };
    async function check(force) {
      if (U.state === 'downloading') return U.state;
      if (!force && Date.now() - lastCheck < 30000) return U.state;
      if (!navigator.onLine) { set('offline'); return U.state; }
      lastCheck = Date.now(); if (U.state !== 'ready') set('checking');
      if (reg) { try { await reg.update(); } catch (e) {} } // (looks for a new service worker; this is rare, it is the same file for every version)
      await ask({ patosCheck: true }, 20000); // a device with Beta updates on downloads the newest beta quietly
      await U.fetchReleases();
      if (U.newer && stuck()) { set('uptodate'); return U.state; } // (installed, but this page didn't start with it: see stuck())
      if (U.newer) { const first = U.state !== 'ready'; set('ready'); if (first && !told) tellReady(); } else set('uptodate');
      return U.state;
    }
    /* Just installed a version, and PatOS started again still on the old one: the page didn't come from the downloaded copy.
       Load it once more from the server (which now knows the installed version), instead of offering the same download again. */
    let inst = null; try { inst = JSON.parse(sessionStorage.getItem(INSTALLING) || 'null'); } catch (e) {}
    if (inst && Date.now() - inst.t > 10 * 60000) inst = null;
    if (inst && idOf(runningRel()) === inst.want) { inst = null; try { sessionStorage.removeItem(INSTALLING); } catch (e) {} }
    if (inst && inst.tries < 1) { inst.tries++; try { sessionStorage.setItem(INSTALLING, JSON.stringify(inst)); } catch (e) {} PatOS._leaving = true; location.replace(location.pathname + '?updated=' + Date.now()); return; }
    function stuck() { return !!(inst && U.target && idOf(U.target) === inst.want); }
    if (inst) { // (still not on it after reloading: say so once, never loop)
      try { sessionStorage.removeItem(INSTALLING); } catch (e) {}
      setTimeout(() => PatOS.notify({ title: T('The update is installed'), body: T('Close PatOS’s tab and open it again to start the new version.'), icon: 'about', duration: 15000 }), 2500);
      if (PatOS.errors) PatOS.errors.report(new Error('update: still on ' + idOf(runningRel()) + ' after installing ' + inst.want + ' (controller: ' + !!navigator.serviceWorker.controller + ')'), 'update');
    }
    if (/[?&]updated=/.test(location.search)) try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => {
      reg = r; ask({ patosHello: { betaOn: betaOn() } }).then((st) => { remember(st); check(true); });
    }).catch(() => {});
    setInterval(() => { if (!document.hidden) check(true); }, 3 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
    window.addEventListener('focus', () => check(false)); window.addEventListener('online', () => check(true));
    // a gentle reminder every 20 minutes until it is installed
    setInterval(() => { if (U.state === 'ready' && !document.hidden && PatOS.loggedIn && Date.now() - told > 20 * 60000) tellReady(); }, 30000);
    // just updated (on purpose, or because a beta was used at start): say so once
    const KEY = 'patos-ran'; let ran = null; try { ran = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    const now = runningRel(); try { localStorage.setItem(KEY, JSON.stringify({ version: now.version, beta: now.beta || 0 })); } catch (e) {}
    if ((opts.soft && opts.soft.update) || (ran && isNewer(now, ran))) setTimeout(() => { PatOS.notify({ title: T('PatOS was updated'), body: label(now) + (relText(now, 'title') ? ': ' + relText(now, 'title') : ''), icon: 'about', duration: 7000, onClick: openPane }); }, 1800);
  }
  PatOS.updateManager = { setup, ask, isNewer, rank, label, runningRel };
})();
