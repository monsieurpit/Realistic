/* PatOS processes (3.3): every app that runs is a process, with a PID, measured and stoppable.

   What makes it real: everything an app starts is done "inside" its process, and PatOS keeps track of it.
     - its code: starting the app, its window's events, and every timer, repeating timer, animation frame and event listener
       it sets up (they run inside its process again when they fire, so whatever they set up is its too)
     - what it opens: background workers, network requests, the microphone and camera, audio and video players
   So PatOS knows, for each app:
     - the processor time its code really used (measured: % CPU over the last seconds, and the total)
     - long blocks of work (over 250 ms: PatOS froze for that long) and the problems it ran into
     - how many timers, loops, workers, listeners and streams it holds; an estimate of its memory; its energy impact
   States: Running · Background (no window, but still doing something, like music playing after its window closed) ·
   Not responding (it blocked PatOS for a long time) · Ended.
   Quit closes its windows the normal way. Force Quit stops everything it started: its windows close (even if they would
   ask), its repeating timers and animation loops stop, its page-wide listeners are removed, its workers end, its network
   requests are cancelled, its microphone and camera turn off, its players pause, and its activities leave the Pill.
   Copies, backups and other system jobs are never stopped by force-quitting the app that started them.
   An app whose last window closed ends by itself once nothing of it is still running.

   Limits (a web page has one main thread): an app that loops forever freezes all of PatOS, and can't be stopped from inside;
   work that continues after an "await" is not counted for its app. */
(function () {
  'use strict';
  const raw = {
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window)
  };
  PatOS.rawTimers = raw;
  const now = () => performance.now();
  const procs = new Map(), byApp = new Map();
  let nextPid = 400, cur = null; const stack = [];

  function mk(o) {
    return { pid: o.pid || nextPid++, app: o.app || '', name: o.name, system: !!o.system, started: Date.now(), windows: new Set(),
      intervals: new Set(), timeouts: new Set(), rafs: new Set(), listeners: new Set(), workers: new Set(), streams: new Set(), media: new Set(), aborts: new Set(),
      cpu: 0, ring: new Float64Array(8), ringSec: new Float64Array(8), longs: [], worst: 0, errors: [], dead: false, endedAt: 0, forced: false, napped: false };
  }
  // the parts of PatOS itself (some are measured: the window server, the Pill, the wallpaper)
  const SYS = {};
  [[1, 'launchd'], [42, 'kernel_task'], [88, 'windowserver'], [97, 'spotlightd'], [103, 'syncd'], [110, 'pilld'], [120, 'wallpaperd']].forEach(([pid, name]) => { const p = mk({ pid, name, system: true }); SYS[name] = p; procs.set(pid, p); });

  /* ---------- running code inside a process, and measuring it ---------- */
  function account(p, dt) {
    if (!(dt > 0)) return;
    p.cpu += dt; const s = Math.floor(Date.now() / 1000), i = s % 8;
    if (p.ringSec[i] !== s) { p.ringSec[i] = s; p.ring[i] = 0; } p.ring[i] += dt;
    if (dt > 250) { p.longs.push([Date.now(), dt]); if (p.longs.length > 20) p.longs.shift(); if (dt > p.worst) p.worst = dt; }
  }
  function run(p, fn, self, args) {
    if (!p || typeof fn !== 'function') return fn && fn.apply(self, args);
    const t = now();
    if (stack.length) { const top = stack[stack.length - 1]; account(top.p, t - top.t0); }
    stack.push({ p, t0: t }); const prev = cur; cur = p;
    try { return fn.apply(self, args); }
    catch (e) { p.errors.push({ t: Date.now(), m: String((e && e.message) || e).slice(0, 200) }); if (p.errors.length > 20) p.errors.shift(); throw e; }
    finally { const t2 = now(); const me = stack.pop(); account(me.p, t2 - me.t0); cur = prev; if (stack.length) stack[stack.length - 1].t0 = t2; }
  }
  const cpuPct = (p) => { const s = Math.floor(Date.now() / 1000); let sum = 0; for (let k = 1; k <= 3; k++) { const i = (s - k) % 8; if (p.ringSec[i] === s - k) sum += p.ring[i]; } return Math.min(100, sum / 30); };

  /* ---------- timers, frames, listeners, workers, requests, media: whoever starts them owns them ---------- */
  const tOwner = new Map(), rOwner = new Map();
  window.setTimeout = function (fn, ms, ...a) {
    if (!cur || typeof fn !== 'function') return raw.setTimeout(fn, ms, ...a);
    const p = cur; let id;
    id = raw.setTimeout(function () { p.timeouts.delete(id); tOwner.delete(id); if (p.dead) return fn.apply(this, a); return run(p, fn, this, a); }, ms);
    p.timeouts.add(id); tOwner.set(id, p); return id;
  };
  window.clearTimeout = function (id) { const p = tOwner.get(id); if (p) { p.timeouts.delete(id); tOwner.delete(id); } return raw.clearTimeout(id); };
  window.setInterval = function (fn, ms, ...a) {
    if (!cur || typeof fn !== 'function') return raw.setInterval(fn, ms, ...a);
    const p = cur; const id = raw.setInterval(function () { if (p.dead) { raw.clearInterval(id); return; } return run(p, fn, this, a); }, ms);
    p.intervals.add(id); tOwner.set(id, p); return id;
  };
  window.clearInterval = function (id) { const p = tOwner.get(id); if (p) { p.intervals.delete(id); tOwner.delete(id); } return raw.clearInterval(id); };
  window.requestAnimationFrame = function (fn) {
    if (!cur || typeof fn !== 'function') return raw.requestAnimationFrame(fn);
    const p = cur; let id;
    id = raw.requestAnimationFrame((t) => { p.rafs.delete(id); rOwner.delete(id); if (p.dead) return; run(p, fn, window, [t]); });
    p.rafs.add(id); rOwner.set(id, p); return id;
  };
  window.cancelAnimationFrame = function (id) { const p = rOwner.get(id); if (p) { p.rafs.delete(id); rOwner.delete(id); } return raw.cancelAnimationFrame(id); };

  // listeners: those on the page itself (the window, the document) are what an app forgets; they are removed when it ends
  const ael = EventTarget.prototype.addEventListener, rel = EventTarget.prototype.removeEventListener;
  const wrapped = new WeakMap();
  const isGlobal = (t) => !(t instanceof Node) || t === document || t === document.documentElement || t === document.body;
  EventTarget.prototype.addEventListener = function (type, l, opts) {
    if (!cur || !l || (typeof l !== 'function' && typeof l.handleEvent !== 'function')) return ael.call(this, type, l, opts);
    const p = cur, capture = typeof opts === 'boolean' ? opts : !!(opts && opts.capture);
    const list = wrapped.get(l) || [];
    if (list.some((e) => e.target === this && e.type === type && e.capture === capture)) return;
    const e = { target: this, type, capture, p, once: !!(opts && typeof opts === 'object' && opts.once) };
    e.w = function (ev) {
      if (e.once) drop(l, e);
      if (p.dead) return;
      return typeof l === 'function' ? run(p, l, this, [ev]) : run(p, l.handleEvent, l, [ev]);
    };
    list.push(e); wrapped.set(l, list); if (isGlobal(this)) p.listeners.add(e);
    return ael.call(this, type, e.w, opts);
  };
  function drop(l, e) { const list = wrapped.get(l); if (list) { const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); } e.p.listeners.delete(e); }
  EventTarget.prototype.removeEventListener = function (type, l, opts) {
    const list = l && wrapped.get(l);
    if (list) {
      const capture = typeof opts === 'boolean' ? opts : !!(opts && opts.capture);
      const e = list.find((x) => x.target === this && x.type === type && x.capture === capture);
      if (e) { drop(l, e); return rel.call(this, type, e.w, opts); }
    }
    return rel.call(this, type, l, opts);
  };
  // workers
  if (window.Worker) { const W = window.Worker; const PW = function (...a) { const w = new W(...a); if (cur) { const p = cur; p.workers.add(w); const t0 = w.terminate.bind(w); w.terminate = () => { p.workers.delete(w); t0(); }; } return w; }; PW.prototype = W.prototype; window.Worker = PW; }
  // network requests (cancelled when the app is force-quit)
  const f0 = window.fetch && window.fetch.bind(window);
  if (f0) window.fetch = function (input, init) {
    if (!cur || !window.AbortController) return f0(input, init);
    const p = cur, ac = new AbortController(); const o = Object.assign({}, init || {});
    if (o.signal) { if (!AbortSignal.any) return f0(input, init); o.signal = AbortSignal.any([o.signal, ac.signal]); } else o.signal = ac.signal;
    p.aborts.add(ac); const done = () => p.aborts.delete(ac);
    const r = f0(input, o); r.then(done, done); return r;
  };
  // the microphone and camera, and audio/video players
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const g0 = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => { const p = cur; const s = await g0(c); if (p) p.streams.add(s); return s; };
  }
  const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (tag) { const el = ce.apply(this, arguments); if (cur && /^(audio|video)$/i.test(tag)) cur.media.add(el); return el; };
  if (window.Audio) { const A = window.Audio; const PA = function (...a) { const el = new A(...a); if (cur) cur.media.add(el); return el; }; PA.prototype = A.prototype; window.Audio = PA; }

  /* ---------- the life of a process ---------- */
  function forApp(app) {
    let p = byApp.get(app.id);
    if (!p || p.dead) { p = mk({ app: app.id, name: app.name }); procs.set(p.pid, p); byApp.set(app.id, p); PatOS.emit('proc:start', { pid: p.pid, app: app.id }); }
    return p;
  }
  const liveStreams = (p) => [...p.streams].filter((s) => s.getTracks().some((t) => t.readyState === 'live'));
  const playing = (p) => [...p.media].filter((m) => !m.paused && !m.ended);
  // still doing something without a window: a repeating timer, a pending timer, a worker, the microphone or camera, sound
  const busy = (p) => p.intervals.size || p.timeouts.size || p.workers.size || liveStreams(p).length || playing(p).length;
  function stopAll(p) {
    p.intervals.forEach((id) => raw.clearInterval(id)); p.intervals.clear();
    p.rafs.forEach((id) => raw.cancelAnimationFrame(id)); p.rafs.clear();
    p.listeners.forEach((e) => { try { rel.call(e.target, e.type, e.w, e.capture); } catch (er) {} }); p.listeners.clear();
  }
  function end(p, forced) {
    if (p.dead || p.system) return;
    p.dead = true; p.forced = !!forced; p.endedAt = Date.now();
    stopAll(p);
    if (forced) {
      p.timeouts.forEach((id) => { tOwner.delete(id); }); // (they still run once, outside the process: system work they hold, like saving, must happen)
      p.workers.forEach((w) => { try { w.terminate(); } catch (e) {} }); p.workers.clear();
      p.aborts.forEach((ac) => { try { ac.abort(); } catch (e) {} }); p.aborts.clear();
      p.streams.forEach((s) => s.getTracks().forEach((t) => t.stop())); p.streams.clear();
      p.media.forEach((m) => { try { m.pause(); } catch (e) {} }); p.media.clear();
      if (PatOS.pill && PatOS.pill.dismissApp) PatOS.pill.dismissApp(p.app);
    }
    p.timeouts.clear(); p.media.clear(); p.streams.clear();
    if (byApp.get(p.app) === p) byApp.delete(p.app);
    procs.delete(p.pid); recent.unshift(info(p)); recent = recent.slice(0, 10);
    PatOS.emit('proc:exit', { pid: p.pid, app: p.app, forced: !!forced });
  }
  let recent = [];
  function windowClosed(p, win) {
    if (!p) return; p.windows.delete(win);
    if (!p.windows.size) raw.setTimeout(() => check(p), 1500); // (its close handlers stop what they started first)
  }
  function check(p) {
    if (p.dead || p.system || p.windows.size) return;
    p.rafs.forEach((id) => raw.cancelAnimationFrame(id)); p.rafs.clear(); // (drawing for a window that is gone)
    if (!busy(p)) end(p, false);
  }

  /* quit: its windows close the normal way (they may ask to save). force quit: everything it started stops */
  function quit(pid) { const p = procs.get(pidOf(pid)); if (!p || p.system) return false; if (!p.windows.size) { end(p, true); return true; } [...p.windows].forEach((w) => w.close()); return true; }
  function kill(pid) {
    const p = procs.get(pidOf(pid)); if (!p || p.system) return false;
    [...p.windows].forEach((w) => { w._force = true; try { w.close(); } catch (e) {} });
    end(p, true);
    if (PatOS.pill && PatOS.pill.flash) PatOS.pill.flash({ lead: '<span class="pl-app">' + PatOS.iconHTML((PatOS.apps[p.app] && PatOS.apps[p.app].icon) || p.app) + '</span>', title: p.name, sub: PatOS.t('was force quit'), status: 'failed', tone: '#ff453a' });
    return true;
  }

  /* ---------- what Activity Monitor and the Terminal show ---------- */
  function memOf(p) {
    let b = 0;
    if (p.system) {
      if (p.name === 'kernel_task' && performance.memory) return performance.memory.usedJSHeapSize;
      if (p.name === 'windowserver') return document.getElementsByTagName('*').length * 700;
      if (p.name === 'wallpaperd') { const c = document.querySelector('#wallpaper canvas, canvas.wp3d, #desktop canvas'); return c ? c.width * c.height * 8 : 0; }
      return 0;
    }
    p.windows.forEach((w) => { b += w.el.getElementsByTagName('*').length * 700; w.el.querySelectorAll('canvas').forEach((c) => { b += c.width * c.height * 4; }); });
    b += p.workers.size * 4e6 + p.media.size * 2e6 + 2e5;
    return b;
  }
  function stateOf(p) {
    if (p.dead) return p.forced ? 'force quit' : 'ended';
    const recentLong = p.longs.filter(([t]) => Date.now() - t < 6000);
    if (recentLong.some(([, d]) => d > 1500) || recentLong.length >= 3) return 'not responding';
    if (!p.system && !p.windows.size) return 'background';
    return 'running';
  }
  function info(p) {
    const cpu = cpuPct(p), threads = p.intervals.size + p.timeouts.size + p.rafs.size + p.workers.size;
    const streams = liveStreams(p).length, sound = playing(p).length;
    const gpu = [...p.windows].some((w) => w.el.querySelector('canvas.g3d, canvas.webgl, canvas[data-gl]')) || p.name === 'wallpaperd';
    return {
      pid: p.pid, name: p.name, app: p.app, system: p.system, state: stateOf(p), started: p.started, windows: p.windows.size,
      cpu: Math.round(cpu * 10) / 10, cpuTime: p.cpu, threads, intervals: p.intervals.size, timeouts: p.timeouts.size, frames: p.rafs.size, workers: p.workers.size,
      listeners: p.listeners.size, requests: p.aborts.size, streams, sound, memory: memOf(p),
      energy: Math.min(100, Math.round(cpu * 1.6 + p.rafs.size * 4 + streams * 10 + sound * 6 + (gpu ? 8 : 0) + p.workers.size * 3)),
      longs: p.longs.slice(-5), worst: Math.round(p.worst), errors: p.errors.slice(-5)
    };
  }

  /* ---------- watching: an app that blocks PatOS, keeps failing, or uses a lot in the background (the Pill says so) ---------- */
  const pidOf = (x) => (typeof x === 'number' && Number.isInteger(x) ? x : /^[1-9]\d{0,6}$/.test(String(x)) ? +x : -1); // (exactly a PID, or nothing)
  const told = new Map();
  raw.setInterval(() => {
    procs.forEach((p) => {
      if (p.system || p.dead) return;
      if (!p.windows.size && !busy(p)) { check(p); return; }
      const st = stateOf(p), errs = p.errors.filter((e) => Date.now() - e.t < 20000).length, cpu = cpuPct(p);
      const key = 'proc-' + p.pid; const until = told.get(key) || 0; if (Date.now() < until) return;
      let warn = null;
      if (st === 'not responding') warn = { title: p.name + ' ' + PatOS.t('is slowing PatOS down'), sub: PatOS.t('It kept PatOS busy for') + ' ' + (p.worst / 1000).toFixed(1) + ' s', status: 'critical', priority: 'critical' };
      else if (errs >= 3) warn = { title: p.name + ' ' + PatOS.t('keeps running into problems'), sub: p.errors[p.errors.length - 1].m, status: 'warning', priority: 'important' };
      else if (!p.windows.size && cpu > 25) { p.hot = (p.hot || 0) + 1; if (p.hot >= 10) warn = { title: p.name + ' ' + PatOS.t('is using a lot of energy'), sub: PatOS.t('In the background') + ' · ' + Math.round(cpu) + '% CPU', status: 'warning', priority: 'important' }; }
      else p.hot = 0;
      if (warn && PatOS.pill && PatOS.pill.create && !PatOS.pill.has(key)) {
        try { PatOS.pill.create(Object.assign({ id: key, app: p.app, actions: [{ id: 'kill', label: PatOS.t('Force Quit'), icon: 'stop', run: () => { told.set(key, 0); PatOS.pill.dismiss(key); kill(p.pid); } }, { id: 'wait', label: PatOS.t('Wait'), icon: 'clock', run: () => { told.set(key, Date.now() + 60000); PatOS.pill.dismiss(key); } }, { id: 'am', label: PatOS.t('Activity Monitor'), icon: 'chart', run: () => PatOS.launch('activity', { pid: p.pid }) }] }, warn)); } catch (e) {}
      } else if (!warn && PatOS.pill && PatOS.pill.has && PatOS.pill.has(key)) PatOS.pill.dismiss(key);
    });
  }, 1000);
  PatOS.on('proc:exit', (e) => { if (PatOS.pill && PatOS.pill.has && PatOS.pill.has('proc-' + e.pid)) PatOS.pill.dismiss('proc-' + e.pid); });

  PatOS.proc = {
    forApp, run, quit, kill, windowClosed, _raw: (pid) => procs.get(pidOf(pid)) || null,
    sys: (name, fn, self, args) => run(SYS[name], fn, self, args), // (runs PatOS's own work as that part of the system, measured)
    list: () => [...procs.values()].map(info).sort((a, b) => a.pid - b.pid),
    get: (pid) => { const p = procs.get(pidOf(pid)); return p ? info(p) : null; },
    ofApp: (id) => { const p = byApp.get(id); return p && !p.dead ? info(p) : null; },
    recent: () => recent.slice(),
    current: () => (cur ? cur.pid : 0)
  };
})();
