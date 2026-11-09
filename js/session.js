/* Windows come back after a reload or a crash: PatOS keeps a small snapshot of the open windows
   (which app, which file or note, where it was, its size, maximized or minimized) and reopens them
   after login. Apps keep the snapshot right by calling PatOS.remember(win, { path }) when they switch
   to another file. Settings › General › "Reopen windows when PatOS starts" turns it off. */
(function () {
  'use strict';
  const KEY = 'session';
  // apps that restore themselves, or that should never come back on their own
  const SKIP = new Set(['screenshot', 'extweb', 'stickies', 'setup']);
  const OWN = new Set(['browser', 'music']); // reopened without arguments: they bring back their own tabs and queue
  const T = (s) => PatOS.t(s);
  let restoring = false, ready = false;

  PatOS.remember = (win, args) => { if (win) win.args = Object.assign({}, args || {}); snapshotSoon(); };

  function clean(args) {
    const out = {};
    Object.entries(args || {}).forEach(([k, v]) => { if (['path', 'id', 'url', 'pane', 'game', 'site', 'word', 'q', 'app', 'draft'].includes(k) && (typeof v === 'string' || typeof v === 'number') && String(v).length < 2000) out[k] = v; });
    return out;
  }
  function snapshot() {
    if (restoring || !ready) return;
    PatOS.store.set(KEY, { t: Date.now(), wins: current() });
  }
  const snapshotSoon = PatOS.debounce(snapshot, 800);
  ['wm:open', 'wm:close', 'wm:focus', 'wm:title'].forEach((ev) => PatOS.on(ev, snapshotSoon));
  // moving and resizing don't send events, so look again every few seconds (it is cheap)
  setInterval(() => { if (ready && !document.hidden) snapshot(); }, 4000);
  window.addEventListener('pagehide', snapshot);
  document.addEventListener('visibilitychange', () => { if (document.hidden) snapshot(); });

  // the windows open now, as a list that reopen() can bring back (also used by the Timeline's moments)
  function current() {
    return PatOS.wm.windows.slice().filter((w) => !SKIP.has(w.app.id) && !w.app.noRestore)
      .sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0))
      .map((w) => { const r = w.maximized || w.fullscreen ? (w.prevRect || w.rect()) : w.rect(); return { app: w.app.id, args: OWN.has(w.app.id) ? {} : clean(w.args), title: String(w.title || '').slice(0, 80), x: r.x, y: r.y, w: r.w, h: r.h, max: !!w.maximized, min: !!w.minimized, active: PatOS.wm.active === w }; });
  }
  // open a list of windows where they were; returns how many opened
  async function reopen(wins, opts = {}) {
    let n = 0; let focusMe = null; const was = restoring; restoring = true;
    const area = { w: innerWidth, h: innerHeight };
    for (const it of wins) {
      const app = PatOS.apps[it.app]; if (!app || app.action || SKIP.has(it.app)) continue;
      if (it.args && it.args.path && !PatOS.fs.get(it.args.path)) continue; // the file is gone
      if (app.single !== false && PatOS.wm.isRunning(it.app)) { if (opts.focusRunning) { const r = PatOS.wm.windowsOf(it.app)[0]; if (r) { if (r.minimized) PatOS.wm.restore(r); focusMe = r; } } continue; }
      let w = null; try { w = PatOS.launch(it.app, it.args || {}); } catch (e) { w = null; }
      if (!w) continue; n++;
      if (!PatOS.isMobile) {
        const W = Math.max(320, Math.min(it.w || 600, area.w)), H = Math.max(200, Math.min(it.h || 400, area.h - 28));
        const X = Math.max(0, Math.min(it.x || 0, area.w - 120)), Y = Math.max(28, Math.min(it.y || 28, area.h - 80));
        Object.assign(w.el.style, { left: X + 'px', top: Y + 'px', width: W + 'px', height: H + 'px' });
        if (it.max && !w.maximized) { w.prevRect = { x: X, y: Y, w: W, h: H }; w.toggleMax(); }
      }
      if (it.min && !opts.unminimize) setTimeout(() => w.minimize(), 300);
      if (it.active) focusMe = w;
      await new Promise((r) => setTimeout(r, opts.gap != null ? opts.gap : 40));
    }
    if (focusMe && !focusMe.minimized) focusMe.focus();
    restoring = was;
    return n;
  }
  async function restore() {
    const s = PatOS.store.get(KEY, null);
    if (PatOS.settings.reopenWindows === false || !s || !Array.isArray(s.wins) || !s.wins.length) { ready = true; return; }
    // windows the person already opened (a file from the Files app, a shelf shortcut) win over the snapshot
    restoring = true;
    const n = await reopen(s.wins);
    restoring = false; ready = true; snapshot();
    if (n) PatOS.notify({ title: T('Your windows are back'), body: n + ' ' + T(n === 1 ? 'window was reopened.' : 'windows were reopened.'), icon: 'about', duration: 4000 });
  }
  PatOS.on('wm:ready', () => setTimeout(() => { if (document.getElementById('setup')) { ready = true; return; } restore(); }, 150));
  PatOS.session = { snapshot, restore, current, reopen, clean };
})();
