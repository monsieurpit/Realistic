/* The PatOS Pill (3.3): the live centre of PatOS. A capsule of dark glass at the top of the screen that shows what is happening
   right now and changes shape with it.

   compact     the most important thing. A second one waits in a bubble beside it.
   expanded    (point at it or click it) the Activity Overview: the main activity with its controls, every other activity with
               its state and quick controls, and what finished recently. Click an activity to bring it to the top, its icon to
               open its app. Esc or a click outside closes it.
   flashes     the volume, the brightness, Do Not Disturb, charging, the network, finished or failed jobs, and messages and
               important notifications (they go to Notification Center too).

   What feeds it (only real things: nothing is invented, and progress is only what a job reports):
     live activities (copies, backups, downloads, Shared Spaces), Music (with what's next and the output device), the Clock's
     timer and stopwatch, every timer that rings (Pat, Spotlight: several at once), alarms and timers ringing now (Stop,
     Snooze), Focus sessions, the next calendar event and reminder, Shortcuts that run, Pat's slower actions, PatOS Sync,
     the battery, the network, Do Not Disturb, and the microphone and camera (whichever app uses them, with Turn off).

   The SDK, for apps and Shortcuts:
     const a = PatOS.pill.create({ id, app, title, sub, icon (a symbol name), progress (0..1, or 0..100), status, priority,
                                   endsAt (a countdown), actions: [{ id, label, icon, run }], onAction(id), open: { app, args },
                                   persist (comes back after a reload), doneMessage })
     a.update({...})  a.setProgress(p)  a.setPriority('critical'|'important'|'normal'|'background')  a.complete(msg)
     a.fail(msg)  a.dismiss()          (the same as PatOS.pill.update(id, ...), .complete(id, msg)...)
     Checked: plain text only, a real app's icon is always shown (so an app can't pass for PatOS), and the microphone and
     camera symbols and system ids are kept for PatOS itself.

   The Pill never runs the jobs it shows: if it is off or fails, downloads, timers, backups and recordings go on the same. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const sym = (n) => (PatOS.sym ? PatOS.sym(n) : '');
  const esc = (s) => PatOS.esc(String(s == null ? '' : s));
  const S = () => PatOS.settings;
  const on = () => S().pillOn !== false;
  const PRI = { critical: 100, important: 80, normal: 55, background: 25 };
  const TONE = { warning: '#ff9f0a', critical: '#ff453a', failed: '#ff453a', done: '#34c759' };
  let wrap = null, pill = null, side = null, srLive = null, measure = null;
  let mode = 'hidden', pinned = false, focusId = null, shown = [], flashNow = null, flashT = 0, hoverT = 0, leaveT = 0, tickT = 0, barsRaf = 0;
  const flashQ = [];

  /* ---------- small helpers ---------- */
  const two = (n) => String(n).padStart(2, '0');
  const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); const hh = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (hh ? hh + ':' + two(m) : m) + ':' + two(s % 60); };
  const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? T('now') : s < 3600 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h'; };
  const ring = (p, color) => { const c = 2 * Math.PI * 7.5, d = (c * Math.max(0, Math.min(1, p))).toFixed(1); return '<svg class="pl-ring" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="2.6"/><circle cx="10" cy="10" r="7.5" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="' + d + ' ' + c.toFixed(1) + '" transform="rotate(-90 10 10)"/></svg>'; };
  const spin = '<svg class="pl-ring pl-spin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="2.6"/><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="12 36"/></svg>';
  const appIcon = (id) => '<span class="pl-app">' + (PatOS.iconHTML ? PatOS.iconHTML((PatOS.apps[id] && PatOS.apps[id].icon) || id) : '') + '</span>';
  const glyph = (n, color) => '<span class="pl-glyph" style="color:' + (color || '#fff') + '">' + sym(n) + '</span>';
  const digits = (txt) => '<span class="pl-digits">' + String(txt).split('').map((c) => '<i>' + esc(c) + '</i>').join('') + '</span>';
  const appName = (id) => (PatOS.apps[id] && PatOS.apps[id].name) || 'PatOS';
  const timeAt = (t) => new Date(t).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' });
  const flashMs = () => ({ short: 1200, long: 3200 })[S().pillFlash] || 1800;

  /* ======================= history: what finished ======================= */
  let hist = (PatOS.store.get('pillHistory', []) || []).filter((x) => x && x.title).slice(0, 15);
  const saveHist = () => PatOS.store.set('pillHistory', hist);
  function addHist(x) { hist.unshift(Object.assign({ t: Date.now() }, x)); hist = hist.slice(0, 15); saveHist(); }

  /* ======================= the SDK ======================= */
  const acts = new Map();
  const SYSTEM_ONLY = new Set(['mic', 'camera']);
  const plain = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
  const priOf = (p) => (typeof p === 'number' ? Math.max(0, Math.min(99, p)) : PRI[p] || PRI.normal);
  function clean(o, prev) {
    const a = Object.assign({}, prev || {});
    if (o.app != null) a.app = PatOS.apps[o.app] ? o.app : 'about';
    if (o.title != null) a.title = plain(o.title, 80);
    if (o.sub != null) a.sub = plain(o.sub, 120);
    if (o.icon != null) a.icon = /^[a-z]{2,16}$/.test(o.icon) && (!SYSTEM_ONLY.has(o.icon) || a.system) ? o.icon : '';
    if (o.progress !== undefined) { const p = o.progress == null ? null : +o.progress; a.progress = p == null || isNaN(p) ? null : Math.max(0, Math.min(1, p > 1 ? p / 100 : p)); }
    if (o.status != null) a.status = /^(running|paused|warning|critical|done|failed)$/.test(o.status) ? o.status : 'running';
    if (o.priority != null) a.priority = o.priority;
    if (o.endsAt !== undefined) a.endsAt = +o.endsAt || null;
    if (o.autoEnd != null) a.autoEnd = o.autoEnd !== false;
    if (o.actions != null) a.actions = (Array.isArray(o.actions) ? o.actions : []).filter((x) => x && x.label).slice(0, 4).map((x) => ({ id: plain(x.id || x.label, 30), label: plain(x.label, 24), icon: /^[a-z]{2,16}$/.test(x.icon || '') ? x.icon : '', run: typeof x.run === 'function' ? x.run : null }));
    if (o.onAction !== undefined) a.onAction = typeof o.onAction === 'function' ? o.onAction : null;
    if (o.open !== undefined) a.open = o.open;
    if (o.persist != null) a.persist = !!o.persist;
    if (o.doneMessage != null) a.doneMessage = plain(o.doneMessage, 120);
    a.updated = Date.now(); return a;
  }
  const savePersist = PatOS.debounce(() => PatOS.store.set('pillActs', [...acts.values()].filter((a) => a.persist).map((a) => ({ id: a.id, app: a.app, title: a.title, sub: a.sub, icon: a.icon, progress: a.progress, status: a.status, priority: a.priority, endsAt: a.endsAt, started: a.started, doneMessage: a.doneMessage, persist: true }))), 400);
  function create(o, system) {
    o = o || {}; const id = plain(o.id || ('a' + PatOS.uid()), 40);
    if (!system && /^(media|live|sys|grp|alarm|ring|timer|music|stopwatch|cal|rem|x):/.test(id)) throw new Error('That id is kept for PatOS.');
    const a = clean(o, Object.assign({ id, app: 'about', title: '', sub: '', icon: '', progress: null, status: 'running', priority: 'normal', actions: [], started: Date.now(), system: !!system }, acts.get(id) || {}));
    if (!a.title) throw new Error('An activity needs a title.');
    acts.set(id, a); if (a.persist) savePersist(); schedule(); return handle(id);
  }
  function handle(id) { return { id, update: (p) => update(id, p), setProgress: (p) => update(id, { progress: p }), setPriority: (p) => update(id, { priority: p }), complete: (m) => complete(id, m), fail: (m) => fail(id, m), dismiss: () => dismiss(id) }; }
  function update(id, p) { const a = acts.get(id); if (!a) return false; acts.set(id, clean(p || {}, a)); if (a.persist) savePersist(); schedule(); return true; }
  function end(id, status, msg) {
    const a = acts.get(id); if (!a) return false; acts.delete(id); if (a.persist) savePersist();
    const sub = plain(msg || (status === 'done' ? a.doneMessage || T('Done') : status === 'failed' ? T('didn’t finish') : ''), 120);
    if (status !== 'dismissed') {
      addHist({ title: a.title, sub, app: a.app, icon: a.icon, status });
      flash({ lead: glyph(status === 'done' ? 'check' : 'warn', TONE[status]), title: a.title, sub, tone: TONE[status], status, ms: status === 'failed' ? 3200 : undefined });
    }
    schedule(); return true;
  }
  const complete = (id, m) => end(id, 'done', m), fail = (id, m) => end(id, 'failed', m), dismiss = (id) => end(id, 'dismissed');
  // activities that asked to come back after a reload: a countdown goes on; anything else was stopped by the restart, and says so
  // (once the apps are known, at the first start of the desktop)
  let restored = false;
  function restoreActs() {
    if (restored) return; restored = true;
    (PatOS.store.get('pillActs', []) || []).forEach((a) => {
      if (!a || !a.id || !a.title || acts.has(a.id)) return;
      if (a.endsAt && a.endsAt > Date.now()) { try { create(a, true); } catch (e) {} }
      else addHist({ title: a.title, sub: a.endsAt ? T('Done') : T('Stopped when PatOS restarted'), app: a.app, icon: a.icon, status: a.endsAt ? 'done' : 'interrupted' });
    });
  }
  PatOS.on('wm:ready', restoreActs);
  function sdkItems() {
    return [...acts.values()].map((a) => {
      const left = a.endsAt ? a.endsAt - Date.now() : null;
      if (left != null && left <= 0 && a.autoEnd !== false) { setTimeout(() => complete(a.id), 0); return null; }
      const tone = TONE[a.status] || '';
      const acts2 = (a.actions || []).map((x) => ({ icon: x.icon, label: x.label, run: () => { try { (x.run || (a.onAction && (() => a.onAction(x.id))) || (() => {}))(); } catch (e) {} } }));
      return {
        id: 'x:' + a.id, pri: priOf(a.priority) + (a.status === 'critical' ? 15 : a.status === 'warning' ? 5 : 0), app: a.app, title: a.title, sub: a.sub, tone,
        lead: a.icon && a.system ? glyph(a.icon, tone || '#fff') : appIcon(a.app) + (a.icon ? '<span class="pl-badge">' + sym(a.icon) + '</span>' : ''),
        trail: left != null ? '<b class="pl-num">' + digits(clock(left)) + '</b>' : a.progress != null ? ring(a.progress, tone || 'var(--pl-accent)') + '<b class="pl-num">' + Math.round(a.progress * 100) + '%</b>' : a.status === 'paused' ? glyph('pause') : spin,
        state: left != null ? clock(left) : a.progress != null ? Math.round(a.progress * 100) + '%' : T(a.status === 'paused' ? 'Paused' : 'Working…'), progress: a.progress, ticks: left != null,
        actions: acts2.concat([{ icon: 'close', label: T('Dismiss'), run: () => dismiss(a.id), quiet: true }]),
        open: a.open ? () => (typeof a.open === 'function' ? a.open() : PatOS.launch(a.open.app || a.app, a.open.args || {})) : PatOS.apps[a.app] && a.app !== 'about' ? () => PatOS.launch(a.app) : null,
        big: a.progress != null || left != null ? () => h('div', { class: 'pl-big' }, h('div', { class: 'pl-bar' }, h('i', { style: { width: Math.round((a.progress != null ? a.progress : 0) * 100) + '%' } }))) : null
      };
    }).filter(Boolean);
  }

  /* ======================= what it shows ======================= */
  /* live activities (copies, backups, downloads...): several from the same app are grouped */
  const liveSeen = new Set();
  function liveOne(a) {
    return {
      id: 'live:' + a.id, pri: a.status === 'stalled' ? 45 : 60, app: a.app, lead: appIcon(a.app), title: a.title, sub: a.detail || (a.status === 'paused' ? T('Paused') : a.status === 'stalled' ? T('No news for a while') : ''),
      trail: a.progress != null ? ring(a.progress, 'var(--pl-accent)') + '<b class="pl-num">' + Math.round(a.progress * 100) + '%</b>' : spin, progress: a.progress, tone: a.status === 'stalled' ? TONE.warning : '',
      state: a.status === 'paused' ? T('Paused') : a.progress != null ? Math.round(a.progress * 100) + '%' : T('Working…'),
      actions: [a.can.pause && { icon: 'pause', label: T('Pause'), run: () => PatOS.live.act(a.id, 'pause') }, a.can.resume && { icon: 'play', label: T('Resume'), run: () => PatOS.live.act(a.id, 'resume') },
        a.can.cancel && { icon: 'close', label: T('Cancel'), run: () => PatOS.live.act(a.id, 'cancel') }, a.can.open && { icon: 'folder', label: T('Show'), run: () => PatOS.live.act(a.id, 'open') }].filter(Boolean),
      open: a.can.open ? () => PatOS.live.act(a.id, 'open') : () => PatOS.launch(a.app),
      big: () => h('div', { class: 'pl-big' }, h('div', { class: 'pl-bar' + (a.progress == null ? ' busy' : '') }, h('i', { style: { width: a.progress == null ? '' : Math.round(a.progress * 100) + '%' } })),
        h('div', { class: 'pl-meta' }, h('span', {}, a.progress != null ? Math.round(a.progress * 100) + '%' : T('Working…')), a.eta ? h('span', {}, T('about') + ' ' + clock(a.eta) + ' ' + T('left')) : null))
    };
  }
  function liveItems() {
    if (!PatOS.live) return { compact: [], all: [] };
    const all = PatOS.live.list().map(liveOne), by = new Map();
    all.forEach((x) => { if (!by.has(x.app)) by.set(x.app, []); by.get(x.app).push(x); });
    const compact = [];
    by.forEach((l, app) => {
      if (l.length < 2) { compact.push(l[0]); return; }
      const ps = l.filter((x) => x.progress != null), p = ps.length ? ps.reduce((s, x) => s + x.progress, 0) / ps.length : null;
      compact.push({ id: 'grp:' + app, pri: Math.max(...l.map((x) => x.pri)), app, lead: appIcon(app), title: l.length + ' ' + T('activities'), sub: appName(app), progress: p, group: l.map((x) => x.id),
        trail: p != null ? ring(p, 'var(--pl-accent)') + '<b class="pl-num">' + Math.round(p * 100) + '%</b>' : spin, open: () => PatOS.launch(app) });
    });
    return { compact, all };
  }
  function liveEnded() {
    if (!PatOS.live) return;
    PatOS.live.recent().forEach((a) => {
      if (liveSeen.has(a.id) || Date.now() - a.ended > 4000) return; liveSeen.add(a.id);
      if (a.status === 'cancelled') { addHist({ title: a.title, sub: T('Cancelled'), app: a.app, status: 'cancelled' }); return; }
      const st = a.status === 'done' ? 'done' : 'failed', sub = a.message || (st === 'done' ? T('Done') : T('didn’t finish'));
      addHist({ title: a.title, sub, app: a.app, status: st });
      flash({ lead: glyph(st === 'done' ? 'check' : 'warn', TONE[st]), title: a.title, sub, tone: TONE[st], status: st, ms: st === 'failed' ? 3200 : undefined });
    });
  }

  /* music */
  let lastPlaying = 0, artColor = { key: '', c: '' };
  function tintOf(np) {
    const key = np.path || ('g' + np.gen); if (artColor.key === key) return artColor.c;
    artColor = { key, c: '' };
    const m = String(np.color || '').match(/#[0-9a-f]{6}|rgba?\([^)]+\)/i); if (m) artColor.c = m[0];
    if (np.art) { const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } artColor.c = 'rgb(' + [r, g, b].map((v) => Math.round(v / 16)).join(',') + ')'; schedule(); } catch (e) {} }; img.src = np.art; }
    return artColor.c;
  }
  // the output device (Chrome): PatOS's sound and the music both move to it
  async function outputMenu(x, y) {
    let outs = []; try { outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput'); } catch (e) {}
    const a = PatOS.audio && PatOS.audio();
    if (!outs.length || !a || !a.ctx.setSinkId) { PatOS.notify({ title: T('Output'), body: T('This browser can’t choose where the sound goes.'), icon: 'music', priority: 'low' }); return; }
    PatOS.menu([{ header: T('Play sound on') }, ...outs.map((d, i) => ({ label: d.label || (d.deviceId === 'default' ? T('Default') : T('Speaker') + ' ' + (i + 1)), checked: (S().audioOutput || 'default') === d.deviceId, action: async () => {
      try { await a.ctx.setSinkId(d.deviceId === 'default' ? '' : d.deviceId); if (PatOS.music && PatOS.music.setOutput) await PatOS.music.setOutput(d.deviceId === 'default' ? '' : d.deviceId); PatOS.setSetting('audioOutput', d.deviceId); flash({ kind: 'output', lead: glyph('speaker'), title: d.label || T('Speaker'), sub: T('Sound plays here') }); }
      catch (e) { PatOS.notify({ title: T('That didn’t work'), body: String(e.message || e), icon: 'music' }); }
    } }))], x, y);
  }
  function musicItems() {
    const M = PatOS.music; if (!M || !M.nowPlaying) return [];
    const np = M.nowPlaying(); if (!np) return [];
    if (np.playing) lastPlaying = Date.now(); else if (Date.now() - lastPlaying > 20000) return [];
    const art = np.art ? '<img class="pl-art" src="' + esc(np.art) + '" alt="">' : '<span class="pl-art" style="background:' + esc(np.color || '#444') + '">' + sym('music') + '</span>';
    const tone = tintOf(np) || '#ff375f', next = M.upNext ? M.upNext() : null;
    return [{
      id: 'music', pri: 50, app: 'music', lead: art, title: np.title, sub: np.artist, tone, state: T(np.playing ? 'Playing' : 'Paused'),
      trail: S().pillBars === false ? glyph(np.playing ? 'play' : 'pause', tone) : '<span class="pl-eq' + (np.playing ? ' on' : '') + '"><i></i><i></i><i></i><i></i></span>',
      actions: [{ icon: 'prev', label: T('Previous'), run: () => M.prev() }, { icon: np.playing ? 'pause' : 'play', label: T(np.playing ? 'Pause' : 'Play'), run: () => M.toggle(), main: true }, { icon: 'next', label: T('Next'), run: () => M.next() },
        { icon: 'speaker', label: T('Output'), run: (e) => { const r = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : { left: innerWidth / 2, bottom: 120 }; outputMenu(r.left, r.bottom + 6); }, keep: true }],
      open: () => PatOS.launch('music'),
      big: () => { const p = M.position ? M.position() : { t: 0, d: 0 }; return h('div', { class: 'pl-big' }, h('div', { class: 'pl-bar' }, h('i', { style: { width: p.d ? Math.min(100, p.t / p.d * 100) + '%' : '0' } })), h('div', { class: 'pl-meta' }, h('span', {}, clock(p.t * 1000)), h('span', {}, '−' + clock(Math.max(0, p.d - p.t) * 1000))), next ? h('div', { class: 'pl-next' }, h('small', {}, T('Next')), h('span', {}, next.title + (next.artist ? ' · ' + next.artist : ''))) : null); }
    }];
  }
  function bars() {
    cancelAnimationFrame(barsRaf); barsRaf = 0;
    const eq = pill && pill.querySelector('.pl-eq.on'); if (!eq || document.hidden || !PatOS.music || !PatOS.music.levels) return;
    let last = 0;
    const step = (t) => {
      if (!eq.isConnected) { barsRaf = 0; return; }
      if (t - last > 50) { last = t; const l = PatOS.music.levels(4); [...eq.children].forEach((b, i) => { b.style.transform = 'scaleY(' + (0.18 + Math.min(1, l[i] * 1.15) * 0.82).toFixed(3) + ')'; }); }
      barsRaf = requestAnimationFrame(step);
    };
    eq.classList.add('real'); barsRaf = requestAnimationFrame(step);
  }

  /* the Clock's timer, every other timer that will ring, what is ringing now, the stopwatch */
  const tm = () => Object.assign({ running: false, end: 0, left: 0, total: 0, label: '' }, PatOS.store.get('clockTimer', null) || {});
  function saveTm(x) { PatOS.store.set('clockTimer', x); PatOS.emit('clock:timer'); schedule(); }
  const schedTm = (y) => PatOS.alarms.schedule({ id: 'clock-timer', kind: 'timer', at: y.end, title: y.label || T('Timer done'), body: T('Timer'), icon: 'clock', app: 'clock' });
  function timerItems() {
    const out = [];
    const x = tm(); const left = x.running ? Math.max(0, x.end - Date.now()) : x.left;
    if (x.running || (left > 0 && left < x.total)) {
      const p = x.total ? left / x.total : 0;
      out.push({
        id: 'timer', pri: 75, app: 'clock', lead: glyph('timer', '#ff9f0a'), title: x.label || T('Timer'), sub: x.running ? T('Ends at') + ' ' + timeAt(x.end) : T('Paused'), tone: '#ff9f0a', ticks: true, state: clock(left),
        trail: '<b class="pl-num pl-orange">' + digits(clock(left)) + '</b>', progress: 1 - p, open: () => PatOS.launch('clock', { tab: 3 }),
        actions: [{ icon: x.running ? 'pause' : 'play', label: T(x.running ? 'Pause' : 'Resume'), main: true, run: () => {
          const y = tm(); if (y.running) { y.left = Math.max(0, y.end - Date.now()); y.running = false; PatOS.alarms.cancel('clock-timer'); } else { y.end = Date.now() + y.left; y.running = true; schedTm(y); } saveTm(y);
        } }, { label: '+1 min', run: () => { const y = tm(); y.total += 60000; if (y.running) { y.end += 60000; schedTm(y); } else y.left += 60000; saveTm(y); } },
        { icon: 'rotate', label: T('Reset'), run: () => { const y = tm(); y.left = y.total; if (y.running) { y.end = Date.now() + y.total; schedTm(y); } saveTm(y); } },
        { icon: 'close', label: T('Cancel'), run: () => { const y = tm(); y.running = false; y.left = y.total; PatOS.alarms.cancel('clock-timer'); saveTm(y); } }],
        big: () => h('div', { class: 'pl-big pl-count' }, h('div', { class: 'pl-huge', html: digits(clock(left)) }), h('div', { class: 'pl-bar orange' }, h('i', { style: { width: (p * 100).toFixed(1) + '%' } })))
      });
    }
    // timers from Pat, Spotlight or Shortcuts ("timer 10 min"): as many as there are
    if (PatOS.alarms && PatOS.alarms.upcoming) PatOS.alarms.upcoming('timer').filter((q) => q.id !== 'clock-timer').forEach((q) => {
      const l = Math.max(0, q.at - Date.now()), total = q.start ? q.at - q.start : 0;
      out.push({ id: 'alarm:' + q.id, pri: 74, app: 'clock', lead: glyph('timer', '#ff9f0a'), title: q.title && q.title !== T('Timer done') ? q.title : T('Timer'), sub: T('Ends at') + ' ' + timeAt(q.at), tone: '#ff9f0a', ticks: true, state: clock(l),
        trail: '<b class="pl-num pl-orange">' + digits(clock(l)) + '</b>', progress: total ? 1 - l / total : null,
        actions: [{ label: '+1 min', run: () => { PatOS.alarms.schedule(Object.assign({}, q, { at: q.at + 60000 })); schedule(); } }, { icon: 'close', label: T('Cancel'), run: () => { PatOS.alarms.cancel(q.id); schedule(); } }],
        big: () => h('div', { class: 'pl-big pl-count' }, h('div', { class: 'pl-huge', html: digits(clock(l)) }), total ? h('div', { class: 'pl-bar orange' }, h('i', { style: { width: (l / total * 100).toFixed(1) + '%' } })) : null) });
    });
    // ringing now: the most important thing there is
    if (PatOS.alarms && PatOS.alarms.ringingInfo) PatOS.alarms.ringingInfo().forEach((r) => {
      out.push({ id: 'ring:' + r.id, pri: 110, app: r.app || 'clock', lead: glyph(r.kind === 'timer' ? 'timer' : 'alarm', '#ff9f0a'), title: r.title, sub: T(r.kind === 'timer' ? 'Timer' : 'Alarm'), tone: '#ff9f0a', status: 'ringing', state: T('Ringing'),
        trail: '<span class="pl-dot" style="--c:#ff9f0a"></span>',
        actions: [r.snooze && { icon: 'moon', label: T('Snooze'), run: () => PatOS.alarms.snooze(r.id) }, { icon: 'stop', label: T('Stop'), main: true, run: () => PatOS.alarms.stop(r.id) }].filter(Boolean) });
    });
    const s = Object.assign({ running: false, start: 0, acc: 0, laps: [] }, PatOS.store.get('clockStopwatch', null) || {});
    if (s.running) {
      const t = s.acc + (Date.now() - s.start);
      const fmt = (ms) => { const m = Math.floor(ms / 60000), sec = Math.floor(ms / 1000) % 60; return (m >= 60 ? Math.floor(m / 60) + ':' + two(m % 60) : m) + ':' + two(sec); };
      out.push({ id: 'stopwatch', pri: 40, app: 'clock', lead: glyph('clock', '#ff9f0a'), title: T('Stopwatch'), sub: s.laps.length ? s.laps.length + ' ' + T('laps') : '', tone: '#ff9f0a', ticks: true, state: fmt(t),
        trail: '<b class="pl-num pl-orange">' + digits(fmt(t)) + '</b>', open: () => PatOS.launch('clock', { tab: 2 }),
        actions: [{ icon: 'flag', label: T('Lap'), run: () => { const y = Object.assign({}, s, { laps: s.laps.slice() }); const n = y.acc + (Date.now() - y.start); y.laps.push(n - y.laps.reduce((a, b) => a + b, 0)); PatOS.store.set('clockStopwatch', y); schedule(); } },
          { icon: 'pause', label: T('Stop'), main: true, run: () => { const y = Object.assign({}, s); y.acc = y.acc + (Date.now() - y.start); y.running = false; PatOS.store.set('clockStopwatch', y); schedule(); } }],
        big: () => h('div', { class: 'pl-big pl-count' }, h('div', { class: 'pl-huge', html: digits(fmt(t)) })) });
    }
    return out;
  }

  /* the microphone and the camera: whichever app uses them (only PatOS itself shows these, apps can't fake them) */
  const media = new Map(); let mediaN = 0;
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !navigator.mediaDevices.__pill) {
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await gum(c);
      try { const id = 'media:' + (++mediaN), w = PatOS.wm && PatOS.wm.active; media.set(id, { stream, app: w ? w.app.id : '', name: w ? w.app.name : 'PatOS', since: Date.now() }); stream.getTracks().forEach((t) => t.addEventListener('ended', schedule)); schedule(); } catch (e) {}
      return stream;
    };
    navigator.mediaDevices.__pill = true;
  }
  function mediaItems() {
    const out = [];
    media.forEach((m, id) => {
      const tracks = m.stream.getTracks().filter((t) => t.readyState === 'live'); if (!tracks.length) { media.delete(id); return; }
      const cam = tracks.some((t) => t.kind === 'video'), mic = tracks.some((t) => t.kind === 'audio'), color = cam ? '#30d158' : '#ff9f0a';
      out.push({ id, pri: 95, app: m.app, lead: m.app ? appIcon(m.app) : glyph(cam ? 'camera' : 'mic', color), title: m.name, sub: T(cam && mic ? 'Camera and microphone on' : cam ? 'Camera on' : 'Microphone on'), tone: color, ticks: true, state: T(cam ? 'Camera on' : 'Microphone on'),
        trail: '<span class="pl-dot" style="--c:' + color + '"></span><b class="pl-num">' + digits(clock(Date.now() - m.since)) + '</b>',
        actions: [{ icon: 'stop', label: T('Turn off'), run: () => { tracks.forEach((t) => t.stop()); media.delete(id); schedule(); } }, m.app && { icon: 'window', label: T('Show'), run: () => PatOS.launch(m.app) }].filter(Boolean), open: m.app ? () => PatOS.launch(m.app) : null });
    });
    return out;
  }

  /* the next calendar event and the next reminder */
  function calendarItems() {
    const out = [], now = new Date(), cal = PatOS.store.get('calendar', {}) || {};
    const key = PatOS.dateKey ? PatOS.dateKey(now) : now.toISOString().slice(0, 10);
    const evs = (PatOS.calendarOn ? PatOS.calendarOn(now) : cal[key] || []).filter((e) => e && e.time && /^\d{1,2}:\d{2}$/.test(e.time));
    evs.forEach((e) => {
      const [hh, mm] = e.time.split(':').map(Number); const at = new Date(now); at.setHours(hh, mm, 0, 0); const d = at - now;
      if (d > 60 * 60000 || d < -10 * 60000) return;
      const soon = d <= 10 * 60000;
      out.push({ id: 'cal:' + (e.id || e.title + e.time), pri: soon ? 78 : 36, app: 'calendar', lead: appIcon('calendar'), title: e.title || T('Event'), sub: d > 0 ? T('in') + ' ' + Math.max(1, Math.round(d / 60000)) + ' min · ' + timeAt(at) : T('Now'), state: d > 0 ? Math.round(d / 60000) + ' min' : T('Now'),
        tone: soon ? '#ff453a' : '', trail: '<b class="pl-num">' + (d > 0 ? Math.max(1, Math.round(d / 60000)) + ' min' : T('Now')) + '</b>', open: () => PatOS.launch('calendar') });
    });
    const rems = PatOS.store.get('reminders', null) || [];
    rems.forEach((r) => {
      if (!r || r.done || !r.due || !r.time || r.alerted) return;
      const at = new Date(r.due + 'T' + r.time).getTime(), d = at - Date.now(); if (!(d > 0 && d <= 15 * 60000)) return;
      out.push({ id: 'rem:' + r.id, pri: 68, app: 'reminders', lead: appIcon('reminders'), title: r.text, sub: T('in') + ' ' + Math.max(1, Math.round(d / 60000)) + ' min', state: Math.round(d / 60000) + ' min', trail: '<b class="pl-num">' + Math.max(1, Math.round(d / 60000)) + ' min</b>',
        open: () => PatOS.launch('reminders'), actions: [{ icon: 'check', label: T('Done'), run: () => { const l = PatOS.store.get('reminders', []) || []; const x = l.find((y) => y.id === r.id); if (x) { x.done = true; PatOS.store.set('reminders', l); PatOS.emit('reminders'); } schedule(); } }] });
    });
    return out;
  }

  /* PatOS itself: the battery, sync, the network, Do Not Disturb */
  let battery = null, dndSince = 0;
  if (navigator.getBattery) navigator.getBattery().then((b) => { battery = b; b.addEventListener('levelchange', schedule); b.addEventListener('chargingchange', () => { flash({ kind: 'battery', lead: glyph('bolt', b.charging ? '#34c759' : '#fff'), title: T(b.charging ? 'Charging' : 'On battery'), trail: '<b class="pl-num">' + Math.round(b.level * 100) + '%</b>', tone: b.charging ? '#34c759' : '', status: b.charging ? 'charge' : '' }); schedule(); }); schedule(); }).catch(() => {});
  function systemItems() {
    const out = [];
    if (battery && !battery.charging && battery.level < 0.2) {
      const crit = battery.level < 0.08;
      out.push({ id: 'sys:battery', pri: crit ? 90 : 46, app: 'settings', lead: glyph('bolt', crit ? TONE.critical : TONE.warning), title: T(crit ? 'Battery very low' : 'Battery low'), sub: T('Plug in your computer'), tone: crit ? TONE.critical : TONE.warning, state: Math.round(battery.level * 100) + '%', trail: '<b class="pl-num">' + Math.round(battery.level * 100) + '%</b>' });
    }
    const st = PatOS.sync && PatOS.sync.status ? PatOS.sync.status() : null;
    if (st && st.on && st.state === 'error') out.push({ id: 'sys:sync', pri: 44, app: 'settings', lead: glyph('cloud', TONE.warning), title: T('Sync stopped'), sub: T({ key: 'The sync code isn’t accepted', full: 'The sync server is full', busy: 'The sync server is busy', server: 'The sync server had a problem' }[st.error] || 'It will try again'), tone: TONE.warning, state: T('Stopped'), actions: [{ icon: 'gear', label: T('Settings'), run: () => PatOS.launch('settings', { pane: 'sync' }) }], open: () => PatOS.launch('settings', { pane: 'sync' }) });
    else if (st && st.on && st.state === 'syncing') out.push({ id: 'sys:syncing', pri: 20, app: 'settings', lead: glyph('cloud'), title: T('Syncing'), sub: '', state: T('Working…'), trail: spin });
    if (navigator.onLine === false) out.push({ id: 'sys:offline', pri: 22, app: 'settings', lead: glyph('wifi', TONE.critical), title: T('Offline'), sub: T('PatOS keeps working; it catches up when you’re back'), state: T('Offline') });
    if (PatOS.focusMode) { if (!dndSince) dndSince = Date.now(); out.push({ id: 'sys:dnd', pri: 21, app: 'settings', lead: glyph('moon', '#bf5af2'), title: T('Do Not Disturb'), sub: T('for') + ' ' + ago(dndSince).replace(T('now'), '1 min'), state: T('On'), actions: [{ icon: 'close', label: T('Turn off'), run: () => { PatOS.focusMode = false; PatOS.emit('focus', false); } }] }); } else dndSince = 0;
    return out;
  }

  /* everything, most important first. compact = what may sit in the capsule (background things only show in the overview) */
  function collect() {
    let all = [], compact = [];
    const add = (l, both) => { all = all.concat(l); if (both !== false) compact = compact.concat(l); };
    const L = liveItems();
    for (const f of [mediaItems, timerItems, musicItems, calendarItems, systemItems, sdkItems]) { try { add(f()); } catch (e) { console.error(e); } }
    all = all.concat(L.all); compact = compact.concat(L.compact);
    const by = (a, b) => b.pri - a.pri;
    all.sort(by); compact = compact.filter((x) => x.pri >= 35).sort(by);
    if (focusId) { const i = all.findIndex((x) => x.id === focusId); if (i > 0) all.unshift(all.splice(i, 1)[0]); }
    return { all, compact };
  }

  /* ======================= drawing ======================= */
  const actBtn = (a, cls) => h('button', { class: (cls || 'pl-act') + (a.main ? ' main' : ''), 'data-i': a.icon || '', 'aria-label': a.label, title: a.label,
    onclick: (e) => { e.stopPropagation(); a.run(e); if (!a.keep) setTimeout(render, 80); }, html: a.icon ? sym(a.icon) : esc(a.label) });
  function compactEl(it) {
    return h('div', { class: 'pl-row' }, h('span', { class: 'pl-lead', html: it.lead || '' }),
      h('span', { class: 'pl-t' + (it.flash ? ' inline' : '') }, h('b', {}, it.title || ''), it.bar == null && it.sub && it.flash ? h('small', {}, it.sub) : null),
      it.bar != null ? h('span', { class: 'pl-level' }, h('i', { style: { width: Math.round(it.bar * 100) + '%' } })) : null,
      it.trail ? h('span', { class: 'pl-trail', html: it.trail }) : null);
  }
  function mainCard(it) {
    const acts = (it.actions || []).filter((a) => !a.quiet || !(it.actions || []).some((b) => !b.quiet));
    return h('div', { class: 'pl-card' },
      h('div', { class: 'pl-head' }, h('button', { class: 'pl-lead big', html: it.lead || '', 'aria-label': T('Open'), onclick: (e) => { e.stopPropagation(); if (it.open) { collapse(); it.open(); } } }),
        h('span', { class: 'pl-t' }, h('b', {}, it.title || ''), it.sub ? h('small', {}, it.sub) : null),
        it.open ? h('button', { class: 'pl-open', 'aria-label': T('Open'), title: T('Open') + ' ' + appName(it.app), onclick: (e) => { e.stopPropagation(); collapse(); it.open(); }, html: sym('up') }) : null),
      it.big ? it.big() : null, acts.length ? h('div', { class: 'pl-acts' }, ...acts.map((a) => actBtn(a))) : null);
  }
  function row(it) {
    const quick = (it.actions || []).filter((a) => a.icon && !a.main).slice(0, 2);
    return h('div', { class: 'pl-arow', role: 'button', tabindex: '0', onclick: (e) => { e.stopPropagation(); focusId = it.id; render(); }, onkeydown: (e) => { if (e.key === 'Enter') { focusId = it.id; render(); } } },
      h('span', { class: 'pl-lead', html: it.lead || '' }), h('span', { class: 'pl-t' }, h('b', {}, it.title || ''), it.sub ? h('small', {}, it.sub) : null),
      h('span', { class: 'pl-state' + (it.tone ? ' toned' : ''), style: it.tone ? { color: it.tone } : null }, it.state || ''), ...quick.map((a) => actBtn(a, 'pl-qa')));
  }
  function histRow(x) {
    const g = x.status === 'done' ? glyph('check', TONE.done) : x.status === 'failed' ? glyph('warn', TONE.failed) : glyph('close', 'rgba(255,255,255,.55)');
    const hasApp = x.app && x.app !== 'about' && PatOS.apps[x.app];
    return h('div', { class: 'pl-arow done' }, h('span', { class: 'pl-lead', html: hasApp ? appIcon(x.app) : g }),
      h('span', { class: 'pl-t' }, h('b', {}, x.title), h('small', {}, (x.sub ? x.sub + ' · ' : '') + ago(x.t))),
      hasApp ? h('span', { class: 'pl-state', html: g }) : null, h('button', { class: 'pl-qa', 'aria-label': T('Dismiss'), title: T('Dismiss'), html: sym('close'), onclick: (e) => { e.stopPropagation(); hist = hist.filter((y) => y !== x); saveHist(); render(); } }));
  }
  function overview(all) {
    const main = all[0], rest = all.slice(1);
    const showHist = S().pillHistory !== false && hist.length;
    return h('div', { class: 'pl-list' }, main ? mainCard(main) : h('div', { class: 'pl-none' }, T('Nothing is happening right now.')),
      rest.length ? h('div', { class: 'pl-sec' }, h('small', {}, T('Activities')), ...rest.slice(0, 8).map(row)) : null,
      showHist ? h('div', { class: 'pl-sec' }, h('small', {}, T('Recently finished'), h('button', { class: 'pl-clear', onclick: (e) => { e.stopPropagation(); hist = []; saveHist(); render(); } }, T('Clear'))), ...hist.slice(0, 4).map(histRow)) : null);
  }

  function build() {
    wrap = h('div', { id: 'pill-wrap' });
    pill = h('div', { id: 'pill', role: 'button', tabindex: '0', 'aria-label': T('Activities'), 'aria-expanded': 'false' });
    side = h('button', { id: 'pill-side', 'aria-label': T('Next activity') });
    srLive = h('div', { class: 'pl-sr', 'aria-live': 'polite' });
    measure = h('div', { id: 'pill-measure', 'aria-hidden': 'true' });
    wrap.append(pill, side, srLive, measure); document.body.appendChild(wrap);
    pill.addEventListener('pointerenter', () => { clearTimeout(leaveT); if (flashNow) { clearTimeout(flashT); } else if (mode === 'compact' && !PatOS.isMobile && S().pillHover !== false) hoverT = setTimeout(() => expand(false), 420); });
    pill.addEventListener('pointerleave', () => { clearTimeout(hoverT); if (flashNow) flashT = setTimeout(endFlash, 900); if (mode === 'expanded' && !pinned && S().pillAutoCollapse !== false) leaveT = setTimeout(collapse, 380); });
    pill.addEventListener('click', () => {
      if (flashNow) { const f = flashNow; endFlash(); if (f.onClick) f.onClick(); return; }
      if (mode === 'expanded') { pinned = true; return; }
      expand(true);
    });
    pill.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.target !== pill) return; e.preventDefault(); mode === 'expanded' ? collapse() : expand(true); } });
    pill.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); const it = shown[0]; PatOS.menu([it && it.open ? { label: T('Open') + ' ' + appName(it.app), action: it.open } : null, { label: T('Activity Overview'), action: () => expand(true) }, { label: T('PatOS Pill Settings…'), action: () => PatOS.launch('settings', { pane: 'dock' }) }, { divider: true }, { label: T('Hide the PatOS Pill'), action: () => PatOS.setSetting('pillOn', false) }].filter(Boolean), e.clientX, e.clientY + 8); });
    side.addEventListener('click', (e) => { e.stopPropagation(); const l = collect().compact; if (l[1]) { focusId = l[1].id; expand(true); } });
    document.addEventListener('pointerdown', (e) => { if (mode === 'expanded' && wrap && !wrap.contains(e.target) && !e.target.closest('.menu')) collapse(); }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode === 'expanded') collapse(); });
  }
  function expand(pin) { if (flashNow) endFlash(); pinned = !!pin; mode = 'expanded'; render(); }
  function collapse() { pinned = false; focusId = null; if (mode === 'expanded') { mode = 'compact'; render(); } }

  let lastKey = '';
  function morph(content, key, big) {
    measure.className = big ? 'big' : ''; measure.innerHTML = ''; measure.appendChild(content.cloneNode(true));
    const w = Math.ceil(big ? measure.offsetWidth : Math.min(measure.scrollWidth, innerWidth - 40)), hh = Math.ceil(Math.min(measure.offsetHeight, big ? innerHeight * 0.8 : 99));
    pill.style.width = w + 'px'; pill.style.height = hh + 'px';
    pill.classList.toggle('expanded', big); pill.setAttribute('aria-expanded', String(big));
    const old = pill.querySelector('.pl-c:not(.out)'); const scroll = old && old.firstChild ? old.firstChild.scrollTop : 0;
    const box = h('div', { class: 'pl-c' }); box.appendChild(content);
    if (old && key === lastKey) { old.replaceWith(box); if (scroll && box.firstChild) box.firstChild.scrollTop = scroll; }
    else {
      if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 220); }
      box.classList.add('in'); pill.appendChild(box); requestAnimationFrame(() => box.classList.remove('in'));
      if (old && !PatOS.settings.reduceMotion && pill.animate) pill.animate([{ transform: big ? 'scale(.97,1.03)' : 'scale(1.05,.9)' }, { transform: 'none' }], { duration: 520, easing: PatOS.motion ? PatOS.motion.get().easing : 'ease-out' });
    }
    lastKey = key;
    box.querySelectorAll('.pl-digits').forEach((d, di) => { const prev = (pill._digits || [])[di] || ''; [...d.children].forEach((c, i) => { if (prev[i] !== undefined && prev[i] !== c.textContent) c.classList.add('roll'); }); });
    pill._digits = [...box.querySelectorAll('.pl-digits')].map((d) => d.textContent);
  }

  function render() { return PatOS.proc ? PatOS.proc.sys('pilld', renderNow) : renderNow(); } // (measured as pilld: js/process.js)
  function renderNow() {
    if (!pill) return;
    const vis = on() && PatOS.loggedIn && !document.getElementById('setup');
    if (!flashNow && flashQ.length && vis) startFlash(flashQ.shift());
    const c = vis ? collect() : { all: [], compact: [] }; shown = c.all;
    document.documentElement.classList.toggle('pill-on', on());
    if (!vis) {
      if (mode !== 'hidden') { mode = 'hidden'; wrap.classList.remove('show', 'flashing', 'two', 'urgent', 'idle'); pill.classList.remove('expanded'); }
      cancelAnimationFrame(barsRaf); barsRaf = 0; tick(); return;
    }
    // nothing happening: the Pill rests as a small black capsule (click it for the Activity Overview); things grow out of it
    if (!c.compact.length && !flashNow && mode !== 'expanded') {
      mode = 'idle'; wrap.classList.add('show', 'idle'); wrap.classList.remove('flashing', 'two', 'urgent');
      wrap.className = wrap.className.replace(/\bfs-\w+/g, '').trim() + ' fs-' + (S().pillFs || 'important');
      pill.classList.remove('toned', 'has-p', 'ringing'); pill.style.setProperty('--pl-p', '0');
      morph(h('div', { class: 'pl-idle' }), 'idle', false);
      pill.setAttribute('aria-label', T('Activity Overview') + (hist.length ? ' · ' + hist.length + ' ' + T('finished recently') : ''));
      cancelAnimationFrame(barsRaf); barsRaf = 0; tick(); return;
    }
    wrap.classList.remove('idle');
    if (mode === 'hidden' || mode === 'idle') mode = 'compact';
    wrap.classList.add('show'); wrap.classList.toggle('flashing', !!flashNow);
    wrap.className = wrap.className.replace(/\bfs-\w+/g, '').trim() + ' fs-' + (S().pillFs || 'important');
    const it = flashNow || (mode === 'expanded' ? c.all[0] : c.compact[0]) || c.all[0] || {};
    wrap.classList.toggle('urgent', !!flashNow || (it.pri || 0) >= 80);
    pill.style.setProperty('--pl-tone', it.tone || 'transparent'); pill.classList.toggle('toned', !!it.tone);
    pill.style.setProperty('--pl-p', it.progress != null ? String(it.progress) : '0');
    pill.classList.toggle('has-p', it.progress != null && mode !== 'expanded' && !flashNow);
    pill.classList.toggle('ringing', it.status === 'ringing' && !flashNow);
    if (mode === 'expanded' && !flashNow) morph(overview(c.all), 'x:' + c.all.map((x) => x.id).join(',') + ':' + hist.length, true);
    else morph(compactEl(it), flashNow ? 'f:' + (flashNow.kind || flashNow.title) : 'c:' + it.id, false);
    pill.setAttribute('aria-label', T('Activities') + ': ' + c.all.map((x) => x.title + (x.state ? ', ' + x.state : '')).join('; '));
    const two = mode === 'compact' && !flashNow && c.compact.length > 1 && S().pillBubble !== false;
    wrap.classList.toggle('two', two);
    if (two) { side.innerHTML = c.compact[1].lead || ''; side.title = c.compact[1].title + (c.compact.length > 2 ? ' (+' + (c.compact.length - 2) + ')' : ''); }
    if (S().pillBars !== false) bars(); tick();
  }
  const schedule = PatOS.debounce ? PatOS.debounce(render, 40) : render;
  function tick() {
    clearTimeout(tickT); if (document.hidden || !on()) return;
    const need = shown.some((x) => x.ticks) || (mode === 'expanded' && shown.some((x) => x.id === 'music'));
    tickT = setTimeout(render, need ? 1000 - (Date.now() % 1000) + 20 : 30000); // (calendar and reminders are looked at every 30 s)
  }

  /* ======================= flashes ======================= */
  function startFlash(o) {
    flashNow = o; clearTimeout(flashT); flashT = setTimeout(endFlash, o.ms || flashMs());
    srLive.textContent = (o.title || '') + ' ' + (o.sub || '');
    if (o.status && pill) { pill.classList.remove('pl-success', 'pl-shake'); void pill.offsetWidth; pill.classList.add(o.status === 'done' || o.status === 'charge' ? 'pl-success' : o.status === 'failed' ? 'pl-shake' : ''); }
  }
  function endFlash() { clearTimeout(flashT); flashNow = null; if (pill) pill.classList.remove('pl-success', 'pl-shake'); render(); }
  function flash(o) {
    if (!on() || !PatOS.loggedIn) return;
    o = Object.assign({ flash: true }, o);
    if (o.kind && flashNow && flashNow.kind === o.kind) { startFlash(o); render(); return; }
    if (o.kind) { const i = flashQ.findIndex((x) => x.kind === o.kind); if (i >= 0) flashQ.splice(i, 1); }
    flashQ.push(o); if (flashQ.length > 5) flashQ.shift();
    if (!flashNow && mode !== 'expanded') render();
  }
  PatOS.on('setting:volume', (v) => flash({ kind: 'volume', lead: glyph(v > 0 ? 'speaker' : 'mute'), title: T('Volume'), bar: v }));
  PatOS.on('setting:brightness', (v) => flash({ kind: 'brightness', lead: glyph('sun', '#ffd60a'), title: T('Display'), bar: v }));
  PatOS.on('focus', (v) => { flash({ kind: 'focus', lead: glyph('moon', v ? '#bf5af2' : '#fff'), title: T(v ? 'Do Not Disturb' : 'Do Not Disturb off'), sub: v ? T('On') : '', tone: v ? '#bf5af2' : '' }); schedule(); });
  addEventListener('offline', () => { flash({ kind: 'net', lead: glyph('wifi', TONE.critical), title: T('Offline'), tone: TONE.critical, ms: 2600 }); schedule(); });
  addEventListener('online', () => { flash({ kind: 'net', lead: glyph('wifi', TONE.done), title: T('Back online'), tone: TONE.done }); schedule(); });
  PatOS.on('alarm:fire', (x) => { if (x && (x.kind === 'timer' || x.kind === 'alarm')) addHist({ title: x.title, sub: T(x.kind === 'timer' ? 'Timer' : 'Alarm'), app: x.app || 'clock', status: 'done' }); schedule(); });
  PatOS.on('alarm:stop', schedule);

  /* notifications: messages and important ones come into the Pill (and still go to Notification Center) */
  function takeNotification(rec, n) {
    if (!on() || !PatOS.loggedIn || S().pillNotifs === false || document.hidden || !rec) return false;
    if (rec.priority === 'urgent' || !(rec.app === 'messages' || rec.priority === 'high')) return false;
    flash({ kind: 'notif:' + rec.key, notif: true, lead: appIcon(rec.app), title: rec.title + (rec.count > 1 ? ' ×' + rec.count : ''), sub: rec.body, ms: Math.max(4200, flashMs() * 2), tone: rec.priority === 'high' && rec.app !== 'messages' ? TONE.warning : '',
      onClick: () => { PatOS.nc.open(rec.id); if (!(n && (n.onClick || n.open)) && PatOS.apps[rec.app]) PatOS.launch(rec.app); } });
    return true;
  }

  /* Shortcuts, Pat, Focus and the PatOS Sync all report through the SDK */
  PatOS.on('shortcut:run', (e) => {
    if (!e) return; const id = 'sc-' + e.id; const sc = PatOS.shortcuts && PatOS.shortcuts.get ? PatOS.shortcuts.get(e.id) : null;
    if (e.state === 'start') { try { create({ id, app: 'shortcuts', title: e.name || (sc && sc.name) || T('Shortcut'), sub: T('Running…'), priority: 'normal' }, true); } catch (er) {} }
    else if (e.ok) complete(id, (e.log && e.log.length ? e.log[e.log.length - 1].out : '') || T('Done')); else fail(id, ((e.log || []).find((x) => !x.ok) || {}).error || '');
  });
  const patWait = new Map();
  PatOS.on('intel:start', (e) => { if (!e) return; patWait.set(e.id, setTimeout(() => { patWait.set(e.id, 'shown'); try { create({ id: 'pat-' + e.id, app: 'pat', title: 'Pat', sub: T(e.title) + '…', priority: 'normal' }, true); } catch (er) {} }, 400)); });
  PatOS.on('intel', (e) => { if (!e || !patWait.has(e.id)) return; const w = patWait.get(e.id); patWait.delete(e.id); if (w !== 'shown') { clearTimeout(w); return; } if (e.ok === false) fail('pat-' + e.id, e.message); else complete('pat-' + e.id, e.message || T('Done')); });

  PatOS.on('live', () => { liveEnded(); schedule(); });
  ['music', 'clock:timer', 'wm:ready', 'setting:pillOn', 'setting:language', 'sync', 'calendar', 'reminders', 'notif'].forEach((ev) => PatOS.on(ev, schedule));
  PatOS.on('setting', (s) => { if (s && /^pill/.test(s.key)) schedule(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); else { cancelAnimationFrame(barsRaf); barsRaf = 0; } });
  const st0 = PatOS.store.set; PatOS.store.set = function (k) { const r = st0.apply(this, arguments); if (k === 'clockTimer' || k === 'clockStopwatch' || k === 'alarmQueue') schedule(); return r; };
  setInterval(() => { const vis = on() && PatOS.loggedIn; if (vis !== !!(wrap && wrap.classList.contains('show'))) render(); }, 1500);

  /* a preview, from Settings: a pretend job that fills up and finishes, so you can see the Pill without starting anything */
  function preview() {
    const a = create({ id: 'preview', app: 'settings', title: T('Preview'), sub: T('This is how activities look'), progress: 0, priority: 'important' }, true);
    let p = 0; const t = setInterval(() => { p += 0.1; if (p >= 1) { clearInterval(t); a.complete(T('Done')); } else a.setProgress(p); }, 450);
  }

  PatOS.pill = {
    create: (o) => create(o, false), update, complete, fail, dismiss,
    setProgress: (id, p) => update(id, { progress: p }), setPriority: (id, p) => update(id, { priority: p }),
    // (3.3 beta 8 names)
    set: (id, item) => { try { create(Object.assign({ id: String(id) }, item)); } catch (e) {} }, clear: (id) => dismiss(String(id)),
    has: (id) => acts.has(String(id)),
    dismissApp: (app) => { [...acts.values()].filter((a) => a.app === app && !a.system).forEach((a) => dismiss(a.id)); }, // (its app was force-quit)
    flash, notify: takeNotification, expand: () => expand(true), collapse, render, preview,
    history: () => hist.slice(), clearHistory: () => { hist = []; saveHist(); schedule(); },
    get state() { return { mode, items: shown.map((x) => x.id), flash: flashNow ? flashNow.title : null }; }
  };
  // Alt+A: the Activity Overview, any time (even when nothing is running: what finished recently)
  document.addEventListener('keydown', (e) => { if (PatOS.loggedIn && on() && e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyA') { e.preventDefault(); mode === 'expanded' ? collapse() : expand(true); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { build(); render(); }); else { build(); render(); }
})();
