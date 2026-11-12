/* PatOS core: utilities, storage, events, settings, file system, sounds, app registry */
(function () {
  'use strict';
  const PatOS = (window.PatOS = window.PatOS || {});
  PatOS.version = '1.0'; // the real number comes from js/version.js, which build.js writes from updates.json
  /* Inside a Claude Artifact the page runs in a locked-down frame: no iframes of other sites, no downloads, no camera. */
  PatOS.singleFile = !!window.PATOS_SINGLE_FILE;
  PatOS.sandboxed = (function () { try { return window.top !== window.self && /claude|anthropic/i.test(document.referrer + location.hostname); } catch (e) { return true; } })();

  /* ---------- tiny DOM helpers ---------- */
  PatOS.$ = (sel, root) => (root || document).querySelector(sel);
  PatOS.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  PatOS.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') { for (const p in v) { if (p.startsWith('--')) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; } }
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      if (typeof kid === 'string' && PatOS.symFor && /[^\x00-\x7F]/.test(kid.slice(0, 3))) { const sym = PatOS.symFor(kid); if (sym) { el.appendChild(sym); continue; } }
      el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  };
  /* HTML from files, notes, pasted text or the web is cleaned before it is put on screen: no scripts,
     frames, plug-ins, event handlers (onerror=…) or javascript: links. parseHTML reads HTML into a
     document that never runs or loads anything, for looking inside it. */
  const DROP_TAGS = new Set(['SCRIPT', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET', 'LINK', 'META', 'BASE', 'NOSCRIPT', 'TEMPLATE', 'STYLE', 'FORM', 'PORTAL', 'FOREIGNOBJECT', 'MATH']);
  const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'cite', 'data', 'srcset', 'ping']);
  PatOS.parseHTML = (html) => new DOMParser().parseFromString('<!doctype html><body>' + String(html == null ? '' : html), 'text/html').body;
  PatOS.sanitize = function (html) {
    const body = PatOS.parseHTML(html);
    const walk = (el) => {
      for (const c of [...el.children]) {
        if (DROP_TAGS.has(c.tagName.toUpperCase())) { c.remove(); continue; }
        for (const a of [...c.attributes]) {
          const n = a.name.toLowerCase(), v = a.value.replace(/[\u0000- ]/g, '').toLowerCase();
          if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction') { c.removeAttribute(a.name); continue; }
          if (URL_ATTRS.has(n) && (/^(javascript|vbscript|livescript):/.test(v) || (/^data:/.test(v) && !(n === 'src' && /^data:image\/(png|jpe?g|gif|webp|bmp|avif);/.test(v))))) { c.removeAttribute(a.name); continue; }
          if (n === 'style' && /expression\(|javascript:|behavior:|-moz-binding/i.test(a.value)) c.removeAttribute(a.name);
        }
        if (c.tagName.toUpperCase() === 'A' && c.getAttribute('target') === '_blank') c.setAttribute('rel', 'noopener noreferrer');
        walk(c);
      }
    };
    walk(body);
    return body.innerHTML;
  };
  // pasting into any editable text: formatted text is cleaned on the way in
  document.addEventListener('paste', (e) => {
    const t = e.target && e.target.closest && e.target.closest('[contenteditable="true"], [contenteditable=""]'); if (!t || !e.clipboardData) return;
    const items = [...(e.clipboardData.items || [])]; if (items.some((x) => x.kind === 'file')) return; // pictures: the app handles them
    const html = e.clipboardData.getData('text/html'); if (!html) return;
    e.preventDefault(); document.execCommand('insertHTML', false, PatOS.sanitize(html.replace(/^[\s\S]*<!--StartFragment-->|<!--EndFragment-->[\s\S]*$/g, '')));
  }, true);
  PatOS.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  PatOS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PatOS.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  PatOS.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  PatOS.fmtBytes = (n) => { n = Math.max(0, Math.round(+n || 0)); const fr = PatOS.lang === 'fr'; const u = fr ? ['o', 'Ko', 'Mo', 'Go'] : ['B', 'KB', 'MB', 'GB']; const f = (v, d) => { const x = v.toFixed(d); return fr ? x.replace('.', ',') : x; }; return n < 1024 ? n + ' ' + u[0] : n < 1048576 ? f(n / 1024, 1) + ' ' + u[1] : n < 1073741824 ? f(n / 1048576, n < 10485760 ? 2 : 1) + ' ' + u[2] : f(n / 1073741824, 1) + ' ' + u[3]; };

  /* ---------- storage ----------
     PatOS keeps every setting and file in memory and saves them to the browser's database (IndexedDB),
     which holds gigabytes. If that isn't available (private windows, some sandboxes) it falls back to
     localStorage (about 5 MB). preload.js loads the database before this file runs. */
  const PREFIX = 'patos:';
  const mem = {};
  const KV = window.__KV || null, DBH = window.__IDB || null;
  const dirty = new Set(), removedKeys = new Set(), fcPut = {}, fcDel = new Set();
  const clone = (v) => { if (v == null || typeof v !== 'object') return v; try { return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };
  let quotaWarned = false;
  function flushNow() {
    if (!DBH || (!dirty.size && !removedKeys.size && !Object.keys(fcPut).length && !fcDel.size)) return Promise.resolve();
    const sets = [...dirty], dels = [...removedKeys], puts = Object.assign({}, fcPut), fdel = [...fcDel];
    dirty.clear(); removedKeys.clear(); Object.keys(fcPut).forEach((k) => delete fcPut[k]); fcDel.clear();
    const batch = { sets, dels, puts, fdel }; inflight.add(batch);
    /* if the save fails, everything in it goes back in the queue: changes AND deletions. Something changed again
       while the save was running is newer, so it is left alone (a deletion must never undo a newer write). */
    const requeue = () => {
      sets.forEach((k) => { if (k in KV) dirty.add(k); });
      dels.forEach((k) => { if (!(k in KV)) removedKeys.add(k); });
      Object.keys(puts).forEach((k) => { if (!(k in fcPut) && !fcDel.has(k)) fcPut[k] = puts[k]; });
      fdel.forEach((k) => { if (!(k in fcPut)) fcDel.add(k); });
      setTimeout(flushSoon, 8000); // try again a little later
    };
    return new Promise((res0) => {
      const res = () => { inflight.delete(batch); res0(); };
      try {
        const tx = DBH.transaction(['kv', 'fc'], 'readwrite'); const st = tx.objectStore('kv'), fc = tx.objectStore('fc');
        sets.forEach((k) => { try { st.put(KV[k], k); } catch (e) { console.error(e); if (PatOS.errors) PatOS.errors.report(e, 'save ' + k); } }); // (a value the database can't hold: written down, the rest still saves)
        dels.forEach((k) => st.delete(k));
        Object.keys(puts).forEach((k) => fc.put(puts[k], k));
        fdel.forEach((k) => fc.delete(k));
        tx.oncomplete = () => { afterMigrate(); res(); };
        const bad = () => {
          requeue(); const err = tx.error; if (PatOS.errors) PatOS.errors.report(err || new Error('save failed'), 'save');
          // only a full disk is called a full disk; anything else is retried quietly (and written down)
          const full = !err || err.name === 'QuotaExceededError' || /quota/i.test(err.message || '');
          if (full && !quotaWarned && PatOS.notify) { quotaWarned = true; PatOS.notify({ title: 'Storage is full', body: 'PatOS could not save. Delete some big files to free space.', icon: 'settings' }); }
          res();
        };
        tx.onerror = tx.onabort = bad;
      } catch (e) { if (PatOS.errors) PatOS.errors.report(e, 'save'); requeue(); res(); }
    });
  }
  const inflight = new Set(); // writes sent to the database that haven't finished yet
  const flushSoon = PatOS.debounce(flushNow, 120);
  /* When the page closes, a database write that hasn't finished can be cancelled by the browser. So the
     changes that aren't safely saved yet are also written to localStorage (which saves at once), and
     js/preload.js puts them back on the next start. */
  function journal() {
    if (!DBH) return;
    const j = { s: {}, d: [], f: {}, fd: [] };
    const add = (sets, dels, puts, fdel) => { sets.forEach((k) => { j.s[k] = KV[k]; j.d = j.d.filter((x) => x !== k); }); dels.forEach((k) => { delete j.s[k]; j.d.push(k); }); Object.assign(j.f, puts); fdel.forEach((k) => { delete j.f[k]; j.fd.push(k); }); };
    inflight.forEach((b) => add(b.sets, b.dels, b.puts, b.fdel));
    add([...dirty], [...removedKeys], fcPut, [...fcDel]);
    if (!Object.keys(j.s).length && !j.d.length && !Object.keys(j.f).length && !j.fd.length) return;
    try { const txt = JSON.stringify(j); if (txt.length < 4e6) localStorage.setItem('patos-journal', txt); } catch (e) {}
  }
  const clearJournal = () => { if (!inflight.size && !dirty.size) { try { localStorage.removeItem('patos-journal'); } catch (e) {} } };
  function afterMigrate() {
    if (!window.__MIGRATE || !window.__MIGRATE.length) return;
    const keys = window.__MIGRATE; window.__MIGRATE = null;
    try { keys.forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  }
  if (KV && window.__MIGRATE) Object.keys(KV).forEach((k) => dirty.add(k));
  PatOS.store = {
    idb: !!KV,
    get(key, fallback) {
      if (KV) return key in KV ? clone(KV[key]) : fallback;
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? (key in mem ? mem[key] : fallback) : JSON.parse(raw);
      } catch (e) { return key in mem ? mem[key] : fallback; }
    },
    set(key, value) {
      if (KV) { KV[key] = value; dirty.add(key); removedKeys.delete(key); flushSoon(); PatOS.emit && PatOS.emit('store:set', key); return true; }
      mem[key] = value;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) {
        if (/quota/i.test(e.name + e.message) && PatOS.notify) PatOS.notify({ title: 'Storage is full', body: 'PatOS could not save. Delete some pictures to free space.', icon: 'settings' });
        return false;
      }
    },
    remove(key) { if (KV) { delete KV[key]; dirty.delete(key); removedKeys.add(key); flushSoon(); PatOS.emit && PatOS.emit('store:set', key); return; } delete mem[key]; try { localStorage.removeItem(PREFIX + key); } catch (e) {} },
    usage() {
      let n = 0;
      if (KV) { try { Object.keys(KV).forEach((k) => { n += JSON.stringify(KV[k]).length * 2; }); } catch (e) {} Object.keys(persistedFC).forEach((k) => { n += persistedFC[k].length * 2; }); return n; }
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PREFIX)) n += (localStorage.getItem(k) || '').length * 2; } } catch (e) {}
      return n;
    },
    flush: flushNow,
    /* look at saved data without copying it (for hashing in Sync); never change what this returns */
    keys() { return KV ? Object.keys(KV) : []; },
    peek(key) { return KV ? KV[key] : undefined; },
    /* everything worth keeping, for backups: all saved data except the file tree (that comes from fs.exportTree)
       and caches that are made again by themselves */
    backupData() { const o = {}; const skip = new Set(['fs', 'wpCache', 'wpLockCache', 'wpThumbs', 'wxCache', 'fsCleaned2', 'snapIndex', 'backupInfo', 'syncState', 'syncServer', 'linkState', 'accountInfo', 'accountKey', 'systemUid', 'verifiedUids', 'accountPrompt', 'msgRead', 'msgOutbox']); const src = KV || (function () { const r = {}; try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => { try { r[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} }); } catch (e) {} return r; })(); Object.keys(src).forEach((k) => { if (!skip.has(k)) o[k] = clone(src[k]); }); return o; },
    /* put saved data back from a backup: keys that are not in it are removed */
    restoreData(data) {
      const keep = new Set(['fs', 'fsCleaned2', 'snapIndex', 'backupInfo', 'syncState', 'syncServer', 'linkState', 'accountInfo', 'accountKey', 'systemUid', 'verifiedUids', 'accountPrompt', 'msgRead', 'msgOutbox']); const neverRemove = new Set(['syncKey']); const old = KV ? Object.keys(KV) : [];
      old.forEach((k) => { if (!keep.has(k) && !neverRemove.has(k) && !(k in data)) PatOS.store.remove(k); });
      Object.keys(data).forEach((k) => { if (!keep.has(k)) PatOS.store.set(k, clone(data[k])); });
    },
    dump() { const o = {}; if (KV) Object.keys(KV).forEach((k) => { if (k !== 'fs') o[k] = clone(KV[k]); }); else { try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX) && k !== PREFIX + 'fs').forEach((k) => { o[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)); }); } catch (e) {} } return o; },
    async clearAll() {
      try { localStorage.setItem('patos-wipe', '1'); } catch (e) {}
      if (KV) { Object.keys(KV).forEach((k) => delete KV[k]); dirty.clear(); removedKeys.clear(); }
      try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    }
  };
  const persistedFC = {};
  PatOS.flush = () => { try { saveFSNow(); } catch (e) { if (PatOS.errors) PatOS.errors.report(e, 'save files'); } return flushNow(); };
  addEventListener('pagehide', () => { try { saveFSNow(); } catch (e) { if (PatOS.errors) PatOS.errors.report(e, 'save files'); } journal(); flushNow().then(clearJournal); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) PatOS.flush(); });

  /* how much room there is: real numbers from the browser */
  PatOS.storageInfo = async function () {
    const out = { used: PatOS.store.usage(), quota: PatOS.store.idb ? 1024 * 1024 * 1024 : 5 * 1024 * 1024, persisted: false, real: false };
    try {
      if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.quota) { out.used = e.usage || out.used; out.quota = e.quota; out.real = true; } }
      if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
    } catch (e) {}
    return out;
  };
  PatOS.askPersist = async function () { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } };
  // ask the browser not to delete PatOS's data when space runs low (it usually says yes for installed apps)
  window.addEventListener('pointerdown', () => { PatOS.askPersist(); }, { once: true, capture: true });

  /* ---------- events ---------- */
  /* ---------- errors: one place where every failure is written down ----------
     Uncaught exceptions, rejected promises nobody handled, a listener that throws, an app that fails to start: each is kept
     here (the last 100 in memory, the last 30 also across a reload, in this browser only: never synced or uploaded), so a
     problem that was silently swallowed can still be found (PatOS.errors.list(), the Terminal's `errors`). Nothing here
     shows anything to the person: apps show their own message. */
  const ERR_KEY = 'patos.errors', errs = [];
  try { (JSON.parse(localStorage.getItem(ERR_KEY) || '[]') || []).forEach((e) => { e.before = true; errs.push(e); }); } catch (e) {}
  let errSave = 0;
  PatOS.errors = {
    report(err, where) {
      const msg = String((err && (err.message || err.reason)) || err || 'Unknown error').slice(0, 300);
      const last = errs[errs.length - 1];
      if (last && !last.before && last.msg === msg && last.where === (where || '') && Date.now() - last.t < 2000) { last.n = (last.n || 1) + 1; return; } // (the same error in a loop counts once)
      errs.push({ t: Date.now(), where: where || '', msg, stack: String((err && err.stack) || '').split('\n').slice(0, 4).join('\n').slice(0, 600), v: PatOS.version || '' });
      if (errs.length > 100) errs.splice(0, errs.length - 100);
      clearTimeout(errSave); errSave = setTimeout(() => { try { localStorage.setItem(ERR_KEY, JSON.stringify(errs.slice(-30).map((e) => { const c = Object.assign({}, e); delete c.before; return c; }))); } catch (e) {} }, 500);
      try { if (typeof PatOS.emit === 'function') (listeners['error'] || []).slice().forEach((f) => { try { f(errs[errs.length - 1]); } catch (e) {} }); } catch (e) {}
    },
    list: () => errs.slice(),
    clear() { errs.length = 0; try { localStorage.removeItem(ERR_KEY); } catch (e) {} }
  };
  window.addEventListener('error', (e) => { if (e && e.error !== undefined || (e && e.message)) PatOS.errors.report(e.error || e.message, 'page' + (e.filename ? ' ' + String(e.filename).replace(location.origin, '') + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', (e) => PatOS.errors.report(e.reason, 'promise'));

  /* ---------- events ---------- */
  const listeners = {};
  // (the same function added twice for one event still runs once: a second setup must not double every reaction)
  PatOS.on = (ev, fn) => { const l = (listeners[ev] = listeners[ev] || []); if (!l.includes(fn)) l.push(fn); return () => PatOS.off(ev, fn); };
  PatOS.once = (ev, fn) => { const off = PatOS.on(ev, function one(d) { off(); fn(d); }); return off; };
  PatOS.off = (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); };
  PatOS.__busCount = () => Object.values(listeners).reduce((n, l) => n + l.length, 0);
  // a listener that throws does not stop the others, and is written down
  PatOS.emit = (ev, data) => { (listeners[ev] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error(e); PatOS.errors.report(e, 'event ' + ev); } }); };

  /* ---------- settings ---------- */
  const DEFAULTS = {
    userName: 'Pat',
    password: '',
    theme: 'dark',           // dark | light | auto
    accent: '#0a84ff',
    wallpaper: 'fold',       // see wallpaper.js (a new install starts on Fold; people keep the one they chose)
    customWallpaper: null,
    live3d: true,
    dockSize: 54,
    magnify: true,
    magnifyScale: 1.7,
    dockAutohide: false,
    dockPinned: ['finder', 'launchpad', 'browser', 'messages', 'notes', 'music', 'photos', 'calendar', 'appstore', 'code', 'terminal', 'orbrunner', 'settings'],
    uiSounds: true,
    volume: 0.7,
    brightness: 1,
    reduceMotion: false, highContrast: false, boldText: false, showFocus: false, bigTargets: false, srAnnounce: true, systemNotifications: true,
    reduceTransparency: false,
    quality3d: 'auto',       // low | auto | high
    perfMode: 'auto',        // auto | light | full (Speed mode: light turns off the see-through blur and the long animations)
    askFullscreen: true,
    iconStyle: 'auto',       // auto (follows light or dark mode) | dark | light: the tiles behind the app icons
    reopenWindows: true,
    timeline: true, timelineClips: true, timelineDays: 30,
    handoff: true,           // Handoff: continue on your other devices what you were doing (js/handoff.js)
    betaUpdates: false,      // Settings › Software Update › Beta updates
    clock24: false,
    showSeconds: false,
    desktopPositions: {},
    deviceMode: 'auto',
    liquidGlass: true,
    glassRefraction: true,
    glassStyle: 'clear',
    motion: 'natural',       // calm | natural | playful (the springs every animation uses, js/wm.js)     // clear | tinted (Liquid Glass: Tinted is thicker, for more contrast)
    language: 'auto',      // auto | en | fr      // auto | desktop | mobile
    showWidgets: true,
    hiddenApps: [],
    mobileDock: ['browser', 'messages', 'music', 'photos']
  };
  const saved = PatOS.store.get('settings', {});
  PatOS.settings = Object.assign({}, DEFAULTS, saved);
  // 3.0: Silk was everyone's starting wallpaper; Fold replaces it once (Silk is still in Settings › Wallpaper, and choosing
  // it again sticks, because this runs only once)
  if (!PatOS.settings.wpFold) { if (PatOS.settings.wallpaper === 'silk') PatOS.settings.wallpaper = 'fold'; PatOS.settings.wpFold = true; if (saved && Object.keys(saved).length) PatOS.store.set('settings', PatOS.settings); }
  // ('color' was the name of the Light icon style in a beta)
  if (PatOS.settings.iconStyle === 'color') PatOS.settings.iconStyle = 'light';
  PatOS.setSetting = function (key, value) {
    PatOS.settings[key] = value;
    PatOS.store.set('settings', PatOS.settings);
    PatOS.emit('setting', { key, value });
    PatOS.emit('setting:' + key, value);
  };
  /* ---------- desktop vs phone mode ---------- */
  /* What the device really is. A real phone (iPhone, Android phone) has its own status bar, notch or
     Dynamic Island and home bar, so PatOS doesn't draw fake ones there; it uses the screen's safe areas. */
  const UA = navigator.userAgent || '';
  PatOS.hw = {
    ios: /iP(hone|od|ad)/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    iphone: /iPhone|iPod/.test(UA),
    android: /Android/i.test(UA),
    phone: /iPhone|iPod/.test(UA) || (/Android/i.test(UA) && /Mobile/i.test(UA)) || /Windows Phone|IEMobile/i.test(UA),
    standalone: () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches),
    touch: navigator.maxTouchPoints > 0 || 'ontouchstart' in window
  };
  PatOS.hw.windows = /Windows NT/.test(UA); PatOS.hw.chromeos = /CrOS/.test(UA);
  // a laptop that is also a tablet (EliteBook x360...): a touch screen on a computer
  PatOS.hw.touchLaptop = PatOS.hw.touch && !PatOS.hw.phone && !PatOS.hw.ios && !PatOS.hw.android;
  /* Speed: a 15 ms test of how fast this computer thinks. Slow ones (an old school laptop) get the light look by default. Nothing is stored: each start measures again. */
  PatOS.perf = (function () {
    let tier = null;
    function measure() {
      if (tier) return tier;
      let best = 0, x = 1;
      for (let k = 0; k < 3; k++) { let n = 0; const end = performance.now() + 15; while (performance.now() < end) { for (let i = 0; i < 2000; i++) x = (x * 1.0000001 + i) % 1000003; n++; } best = Math.max(best, n); }
      PatOS.perf.score = best; tier = best < 200 ? 'light' : 'full'; return tier; // about 500 on a fast laptop, about 150 on a 4x slower school computer
    }
    return { score: 0, tier: () => tier || 'full', measure, light: () => { const m = PatOS.settings.perfMode; return m === 'light' || (m !== 'full' && tier === 'light'); } };
  })();
  PatOS.isIOS = PatOS.hw.ios;
  PatOS.detectMobile = function () {
    const m = PatOS.settings.deviceMode;
    if (m === 'mobile') return true;
    if (m === 'desktop') return false;
    if (PatOS.hw.phone) return true;
    const w = window.innerWidth, ht = window.innerHeight;
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    return w <= 700 || (coarse && Math.min(w, ht) <= 500);
  };
  PatOS.isMobile = PatOS.detectMobile();
  // "real phone": the phone layout on an actual phone (not the phone layout tried on a computer)
  const markDevice = () => {
    const H = document.documentElement;
    H.classList.toggle('mobile', PatOS.isMobile);
    H.classList.toggle('real-phone', PatOS.isMobile && (PatOS.hw.phone || (PatOS.hw.touch && PatOS.hw.ios)));
    H.classList.toggle('ios', PatOS.hw.ios);
    H.classList.toggle('standalone', !!PatOS.hw.standalone());
  };
  markDevice();
  PatOS.applyMode = function () {
    const m = PatOS.detectMobile();
    if (m !== PatOS.isMobile) { PatOS.isMobile = m; markDevice(); PatOS.emit('mode', m); } else markDevice();
  };
  window.addEventListener('resize', PatOS.debounce(() => PatOS.applyMode(), 150));
  PatOS.on('setting:deviceMode', () => PatOS.applyMode());

  PatOS.resetSettings = function () { PatOS.store.set('settings', Object.assign({}, DEFAULTS)); };

  /* ---------- virtual file system ---------- */
  const now = () => Date.now();
  function isFr() { const l = (PatOS.settings && PatOS.settings.language) || 'auto'; return l === 'fr' || (l === 'auto' && /^fr/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '')); }
  function seedFS() {
    const f = (content, extra) => Object.assign({ type: 'file', content, mtime: now() }, extra || {});
    const d = (children) => ({ type: 'dir', children: children || {}, mtime: now() });
    return d({
      Desktop: d(Object.assign(isFr() ? { 'Bienvenue dans PatOS.txt': f(
          'Bienvenue dans PatOS!\n\n' +
          'PatOS est un bureau complet qui fonctionne dans votre navigateur.\n\n' +
          'Astuces :\n' +
          ' • Ctrl+Espace (ou Alt+Espace) ouvre la recherche Spotlight.\n' +
          ' • Alt+L ouvre le Launchpad avec toutes les apps.\n' +
          ' • Alt+Haut affiche Mission Control (toutes les fenêtres).\n' +
          ' • Alt+W ferme une fenêtre, Alt+M la place dans le Dock.\n' +
          ' • Le bouton vert met une fenêtre en plein écran. Laissez la souris en haut ou en bas pour revoir la barre des menus et le Dock.\n' +
          ' • Gardez le clic sur une icône du Dock et glissez-la pour la déplacer.\n' +
          ' • Glissez une fenêtre vers le bord gauche ou droit pour la placer.\n' +
          ' • Clic droit sur le bureau pour créer des dossiers ou changer le fond d’écran.\n\n' +
          'Tout ce que vous créez est enregistré dans ce navigateur.\n\nAmusez-vous bien!\n') } : {}, {
        ...(isFr() ? {} : { 'Welcome to PatOS.txt': f(
          'Welcome to PatOS!\n\n' +
          'PatOS is a full desktop that runs in your browser.\n\n' +
          'Tips:\n' +
          ' • Ctrl+Space (or Alt+Space) opens Spotlight search.\n' +
          ' • Alt+L opens Launchpad with every app.\n' +
          ' • Alt+Up shows Mission Control (all windows).\n' +
          ' • Alt+W closes a window, Alt+M minimizes it.\n' +
          ' • The green button makes a window full screen. Rest the pointer at the top or bottom to see the menu bar and Dock.\n' +
          ' • Press and hold a Dock icon, then drag it to move it.\n' +
          ' • Drag a window to the left or right edge to snap it.\n' +
          ' • Right-click the desktop to make folders or change the wallpaper.\n\n' +
          'Everything you make is saved in this browser.\n\nHave fun!\n'
        ) }),
      })),
      Documents: d({}),
      Downloads: d({}),
      Pictures: d({}),
      Music: d({}),
      Videos: d({}),
      '.Trash': d({})
    });
  }
  let root = PatOS.store.get('fs', null);
  if (!root || root.type !== 'dir') { root = seedFS(); }
  /* one-time clean-up: remove the old example files PatOS used to add (only if they were never changed) */
  if (!PatOS.store.get('fsCleaned2', false)) {
    const OLD = {
      Documents: { 'Homework.txt': 'Math: page 42', 'Ideas.txt': '- Build a 3D game in PatOS' },
      Music: { 'Playlist.txt': 'Neon Drive' }
    };
    try {
      Object.entries(OLD).forEach(([dir, files]) => {
        const dn = root.children[dir]; if (!dn || dn.type !== 'dir') return;
        Object.entries(files).forEach(([name, start]) => { const n = dn.children[name]; if (n && n.type === 'file' && String(n.content || '').startsWith(start)) delete dn.children[name]; });
      });
      const docs = root.children.Documents;
      const school = docs && docs.children.School;
      if (school && school.type === 'dir') { const sc = school.children['Schedule.txt']; if (sc && String(sc.content).startsWith('Mon: Math')) delete school.children['Schedule.txt']; if (!Object.keys(school.children).length) delete docs.children.School; }
      const desk = root.children.Desktop;
      if (desk && desk.children.Projects && desk.children.Projects.type === 'dir' && !Object.keys(desk.children.Projects.children).length) delete desk.children.Projects;
    } catch (e) {}
    PatOS.store.set('fsCleaned2', true); PatOS.store.set('fs', root);
  }

  /* big file contents are saved as separate records, so a small edit doesn't re-save every picture */
  if (!root.children.Videos) root.children.Videos = { type: 'dir', children: {}, mtime: now() };
  const FCLOAD = window.__FC || {};
  (function rehydrate(n) {
    if (n.type === 'dir') { Object.values(n.children).forEach(rehydrate); return; }
    if (n.cref) { n.content = FCLOAD[n.cref] != null ? FCLOAD[n.cref] : ''; n.cid = n.cref; delete n.cref; persistedFC[n.cid] = n.content; }
  })(root);
  const pendingBlobIds = new Set(); let gcBlobs = false;
  function saveFSNow() {
    if (!PatOS.store.idb) { PatOS.store.set('fs', root); return; }
    const seen = new Set(), liveBlobs = new Set();
    const slim = (n) => {
      if (n.type === 'dir') { const out = Object.assign({}, n, { children: {} }); for (const k of Object.keys(n.children)) out.children[k] = slim(n.children[k]); return out; }
      const out = Object.assign({}, n);
      if (n.blob) liveBlobs.add(n.blob);
      if (typeof n.content === 'string' && n.content.length > 4096) {
        if (!n.cid || seen.has(n.cid)) n.cid = PatOS.uid() + PatOS.uid();
        seen.add(n.cid);
        if (persistedFC[n.cid] !== n.content) { persistedFC[n.cid] = n.content; fcPut[n.cid] = n.content; }
        out.content = ''; out.cref = n.cid;
      }
      delete out.cid;
      return out;
    };
    const tree = slim(root);
    Object.keys(persistedFC).forEach((k) => { if (!seen.has(k)) { delete persistedFC[k]; delete fcPut[k]; fcDel.add(k); } });
    PatOS.store.set('fs', tree);
    if (gcBlobs) { gcBlobs = false; collectBlobs(liveBlobs); }
  }
  function collectBlobs(live) {
    if (!DBH) return;
    try {
      const tx = DBH.transaction('blobs', 'readwrite'), st = tx.objectStore('blobs'), req = st.getAllKeys();
      req.onsuccess = () => req.result.forEach((k) => { if (!live.has(k) && !pendingBlobIds.has(k)) st.delete(k); });
    } catch (e) {}
  }
  const saveFS = PatOS.debounce(saveFSNow, 250);
  function norm(path) {
    if (!path) return '/';
    if (path.startsWith('~')) path = '/' + path.slice(1);
    const parts = [];
    path.split('/').forEach((p) => {
      if (!p || p === '.') return;
      if (p === '..') parts.pop(); else parts.push(p);
    });
    return '/' + parts.join('/');
  }
  function node(path) {
    path = norm(path);
    if (path === '/') return root;
    let cur = root;
    for (const part of path.slice(1).split('/')) {
      if (!cur || cur.type !== 'dir') return null;
      cur = cur.children[part];
    }
    return cur || null;
  }
  function parentOf(path) { path = norm(path); const i = path.lastIndexOf('/'); return { dir: path.slice(0, i) || '/', name: path.slice(i + 1) }; }
  const blobUrls = {};
  function changed(path) { saveFS(); PatOS.emit('fs', { path: norm(path), dir: parentOf(path).dir }); }

  /* /System (js/firmware.js): PatOS's system folder can't be opened, changed or deleted, except "as root" (sudo in the Terminal,
     or PatOS itself setting it up), or with System Integrity Protection turned off in Recovery */
  let rootDepth = 0;
  const isSys = (p) => { const n = norm(p); return n === '/System' || n.startsWith('/System/'); };
  const sysOK = () => rootDepth > 0 || !!(PatOS.firmware && PatOS.firmware.sipOff());
  const guard = (p, what) => { if (isSys(p) && !sysOK()) throw new Error((what || 'Operation not permitted') + ': ' + norm(p) + ' (System Integrity Protection)'); };
  PatOS.fs = {
    isSystem: isSys,
    isRoot: () => rootDepth > 0,
    // run something as root (sudo): sync or async
    asRoot(fn) { rootDepth++; let r; try { r = fn(); } catch (e) { rootDepth--; throw e; } if (r && typeof r.then === 'function') return r.finally(() => { rootDepth--; }); rootDepth--; return r; },
    norm,
    join: (...p) => norm(p.join('/')),
    basename: (p) => parentOf(p).name,
    dirname: (p) => parentOf(p).dir,
    ext: (p) => { const n = parentOf(p).name; const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; },
    get: node,
    exists: (p) => !!node(p),
    isDir: (p) => { const n = node(p); return !!n && n.type === 'dir'; },
    list(path) {
      if (isSys(path) && !sysOK()) throw new Error('Permission denied: ' + norm(path));
      const n = node(path);
      if (!n || n.type !== 'dir') return [];
      return Object.keys(n.children).filter((k) => !k.startsWith('.')).sort((a, b) => {
        const da = n.children[a].type === 'dir', db = n.children[b].type === 'dir';
        return da !== db ? (da ? -1 : 1) : a.localeCompare(b, undefined, { numeric: true });
      }).map((name) => ({ name, path: norm(path + '/' + name), ...n.children[name] }));
    },
    read(path) { if (isSys(path) && !sysOK()) throw new Error('Permission denied: ' + norm(path)); const n = node(path); return n && n.type === 'file' ? n.content : null; },
    write(path, content, extra) {
      guard(path);
      const { dir, name } = parentOf(path);
      const parent = node(dir);
      if (!parent || parent.type !== 'dir' || !name) throw new Error('No such folder: ' + dir);
      const existing = parent.children[name];
      if (existing && existing.type === 'dir') throw new Error(name + ' is a folder');
      parent.children[name] = Object.assign({ type: 'file', content: String(content), mtime: now() }, extra || {});
      if (existing && existing.link && !parent.children[name].link) parent.children[name].link = existing.link;
      changed(path);
      if (PatOS.device && PatOS.device.touched) PatOS.device.touched(norm(path));
      return norm(path);
    },
    mkdir(path) {
      guard(path);
      const { dir, name } = parentOf(path);
      const parent = node(dir);
      if (!parent || parent.type !== 'dir') throw new Error('No such folder: ' + dir);
      if (parent.children[name]) throw new Error(name + ' already exists');
      parent.children[name] = { type: 'dir', children: {}, mtime: now() };
      changed(path);
      return norm(path);
    },
    remove(path, permanent) {
      path = norm(path); guard(path);
      // (deleting PatOS's own system folder: PatOS stops working, see js/firmware.js)
      if (path === '/System' && PatOS.firmware) setTimeout(() => PatOS.firmware.systemDeleted(), 300);
      const { dir, name } = parentOf(path);
      const parent = node(dir);
      if (!parent || !parent.children[name]) throw new Error('Not found: ' + path);
      const item = parent.children[name];
      delete parent.children[name];
      if (!permanent && !path.startsWith('/.Trash')) {
        const trash = node('/.Trash');
        let nm = name, i = 2;
        while (trash.children[nm]) nm = name + ' ' + i++;
        item.origin = path;
        trash.children[nm] = item;
      }
      changed(path);
      PatOS.emit('fs', { path: '/.Trash', dir: '/.Trash' });
    },
    rename(path, newName) {
      guard(path);
      const { dir, name } = parentOf(path);
      const parent = node(dir);
      if (!parent || !parent.children[name]) throw new Error('Not found');
      if (newName.includes('/')) throw new Error('Names cannot contain /');
      if (parent.children[newName]) throw new Error(newName + ' already exists');
      parent.children[newName] = parent.children[name];
      delete parent.children[name];
      changed(dir + '/' + newName);
      return norm(dir + '/' + newName);
    },
    move(path, toDir) {
      guard(path); guard(toDir);
      const item = node(path); const target = node(toDir);
      if (!item || !target || target.type !== 'dir') throw new Error('Cannot move');
      const name = parentOf(path).name;
      if (norm(toDir).startsWith(norm(path) + '/') || norm(toDir) === norm(path)) throw new Error('Cannot move a folder into itself');
      let nm = name, i = 2;
      while (target.children[nm]) nm = name.replace(/(\.[^.]+)?$/, ' ' + i++ + '$1');
      delete node(parentOf(path).dir).children[name];
      target.children[nm] = item;
      changed(path); changed(toDir + '/' + nm);
      return norm(toDir + '/' + nm);
    },
    copy(path, toDir) {
      guard(path, 'Permission denied'); guard(toDir);
      const item = node(path); const target = node(toDir);
      if (!item || !target || target.type !== 'dir') throw new Error('Cannot copy');
      const name = PatOS.fs.uniqueName(toDir, parentOf(path).name);
      target.children[name] = JSON.parse(JSON.stringify(item));
      (function strip(n) { delete n.link; delete n.cid; if (n.type === 'dir') Object.values(n.children).forEach(strip); })(target.children[name]);
      target.children[name].mtime = now();
      changed(toDir + '/' + name);
      return norm(toDir + '/' + name);
    },
    restore(trashName) {
      const trash = node('/.Trash'); const item = trash.children[trashName];
      if (!item) return;
      const dest = item.origin || '/Desktop/' + trashName;
      const { dir } = parentOf(dest);
      if (!node(dir)) { delete item.origin; trash.children[trashName] = item; return PatOS.fs.move('/.Trash/' + trashName, '/Desktop'); }
      delete trash.children[trashName];
      const p = node(dir); let name = parentOf(dest).name, i = 2;
      while (p.children[name]) name = parentOf(dest).name + ' ' + i++;
      delete item.origin; p.children[name] = item;
      changed(dir + '/' + name); changed('/.Trash/x');
    },
    emptyTrash() { node('/.Trash').children = {}; gcBlobs = true; changed('/.Trash/x'); },
    trashList() { const t = node('/.Trash'); return Object.keys(t.children).map((name) => ({ name, path: '/.Trash/' + name, ...t.children[name] })); },
    uniqueName(dir, base) {
      const p = node(dir); if (!p) return base;
      if (!p.children[base]) return base;
      const m = base.match(/^(.*?)(\.[^.]+)?$/); let i = 2;
      while (p.children[m[1] + ' ' + i + (m[2] || '')]) i++;
      return m[1] + ' ' + i + (m[2] || '');
    },
    size(n) { if (!n) return 0; if (n.type === 'file') return n.blob ? (n.size || 0) : (n.content || '').length; return Object.values(n.children).reduce((a, c) => a + PatOS.fs.size(c), 0); },
    walk(path, fn) {
      const n = node(path); if (!n || n.type !== 'dir') return;
      for (const k of Object.keys(n.children)) {
        if (k.startsWith('.')) continue;
        const p = norm(path + '/' + k); if (isSys(p) && !sysOK()) continue; fn(p, n.children[k]);
        if (n.children[k].type === 'dir') PatOS.fs.walk(p, fn);
      }
    },
    /* big files (videos, recordings, huge PDFs) are kept as real Blobs in the database, not as text */
    async writeBlob(path, blob, extra) {
      guard(path);
      const { dir, name } = parentOf(path); const parent = node(dir);
      if (!parent || parent.type !== 'dir' || !name) throw new Error('No such folder: ' + dir);
      if (!DBH) {
        if (blob.size > 3 * 1024 * 1024) throw new Error('This browser can only store small files here.');
        const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
        return PatOS.fs.write(path, url, extra);
      }
      const id = PatOS.uid() + PatOS.uid(); pendingBlobIds.add(id);
      try {
        await new Promise((res, rej) => { const tx = DBH.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(blob, id); tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error || new Error('Not enough storage space.')); });
        const existing = parent.children[name];
        parent.children[name] = Object.assign({ type: 'file', content: '', blob: id, size: blob.size, mime: blob.type || '', mtime: now() }, extra || {});
        if (existing && existing.link && !parent.children[name].link) parent.children[name].link = existing.link;
        changed(path);
        if (PatOS.device && PatOS.device.touched) PatOS.device.touched(norm(path));
      } finally { pendingBlobIds.delete(id); }
      return norm(path);
    },
    async getBlob(path) {
      const n = node(path); if (!n || n.type !== 'file') return null;
      if (n.blob) return new Promise((res) => { try { const r = DBH.transaction('blobs').objectStore('blobs').get(n.blob); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); } catch (e) { res(null); } });
      const c = n.content || '';
      if (/^data:/.test(c)) { try { return await (await fetch(c)).blob(); } catch (e) { return null; } }
      return new Blob([c], { type: 'text/plain' });
    },
    async blobURL(path) {
      const n = node(path); if (!n) return null;
      if (!n.blob && /^data:/.test(n.content || '')) return n.content;
      const key = n.blob || path + n.mtime; blobUrls[key] = blobUrls[key] || PatOS.fs.getBlob(path).then((b) => (b ? URL.createObjectURL(b) : null));
      return blobUrls[key];
    },
    reset() { root = seedFS(); PatOS.store.set('fs', root); PatOS.emit('fs', { path: '/', dir: '/' }); },
    /* the whole file tree with every file's content inside it (for backups) */
    exportTree() { const t = clone(root); (function strip(n) { delete n.cid; if (n.type === 'dir') Object.values(n.children).forEach(strip); })(t); return t; },
    /* replace the whole file tree (restoring a backup); big files whose data is no longer here are dropped, and counted */
    async importTree(tree) {
      if (!tree || tree.type !== 'dir' || !tree.children) throw new Error('This is not a PatOS file tree');
      let missing = 0; const have = new Set();
      if (DBH) { await new Promise((res) => { try { const r = DBH.transaction('blobs').objectStore('blobs').getAllKeys(); r.onsuccess = () => { r.result.forEach((k) => have.add(k)); res(); }; r.onerror = () => res(); } catch (e) { res(); } }); }
      (function fix(n) { if (n.type !== 'dir') return; Object.keys(n.children).forEach((k) => { const c = n.children[k]; if (c.type === 'dir') fix(c); else if (c.blob && !have.has(c.blob)) { delete n.children[k]; missing++; } }); })(tree);
      ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', '.Trash'].forEach((d) => { if (!tree.children[d]) tree.children[d] = { type: 'dir', children: {}, mtime: now() }; });
      root = tree; saveFSNow(); // (records of the old files are removed by saveFSNow itself)
      PatOS.emit('fs', { path: '/', dir: '/' });
      return { missing };
    }
  };

  /* file type helpers */
  PatOS.fileKind = function (name, nodeObj) {
    if (nodeObj && nodeObj.type === 'dir') return 'folder';
    const ext = PatOS.fs.ext(name);
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)) return 'video';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (ext === 'url') return 'link';
    if (ext === 'pdf') return 'pdf';
    if (['js', 'css', 'json', 'py', 'md', 'txt', 'csv', ''].includes(ext)) return 'text';
    return 'text';
  };

  /* ---------- sound (Web Audio, synthesized) ---------- */
  let actx = null, master = null;
  PatOS.audio = function () {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC({ latencyHint: 'interactive' }); } catch (e) { actx = new AC(); }
      master = actx.createGain();
      master.gain.value = PatOS.settings.volume;
      master.connect(actx.destination);
      PatOS.on('setting:volume', (v) => { master.gain.value = v; });
    }
    if (actx.state !== 'running') actx.resume().catch(() => {});
    return { ctx: actx, out: master };
  };
  /* Browsers only let a page make sound after the person taps or types. Unlock audio on the very first
     tap or key press, and on iPhone tell Safari this is media so the silent switch doesn't mute it. */
  let unlocked = false, pendingStartup = 0;
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    const a = PatOS.audio(); if (!a) return;
    if (!unlocked) {
      try { const b = a.ctx.createBuffer(1, 1, 22050); const src = a.ctx.createBufferSource(); src.buffer = b; src.connect(a.ctx.destination); src.start(0); } catch (e) {}
      if (/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
        // a silent looping <audio> keeps iOS in "playback" mode so Web Audio isn't muted by the ring switch
        try { const el = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='); el.loop = true; el.volume = 0; el.setAttribute('playsinline', ''); el.play().catch(() => {}); PatOS._silentAudio = el; } catch (e) {}
      }
    }
    if (a.ctx.state === 'running') unlocked = true;
    if (pendingStartup) { const t = pendingStartup; pendingStartup = 0; if (Date.now() - t < 60000) a.ctx.resume().then(() => PatOS.sound.startup()).catch(() => {}); }
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach((ev) => window.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && actx && actx.state !== 'running') actx.resume().catch(() => {}); });
  function tone(freq, dur, opts) {
    // force: alarms and timers, which ring even when interface sounds are off
    if (!PatOS.settings.uiSounds && !(opts && opts.force)) return;
    const a = PatOS.audio(); if (!a) return;
    if (a.ctx.state !== 'running') {
      // wait for the audio engine to wake up instead of scheduling into a frozen clock
      const asked = Date.now();
      a.ctx.resume().then(() => { if (Date.now() - asked < 1500) tone(freq, dur, opts); }).catch(() => {});
      return;
    }
    opts = opts || {};
    const t = a.ctx.currentTime + (opts.delay || 0);
    const o = a.ctx.createOscillator(); const g = a.ctx.createGain();
    o.type = opts.type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(opts.vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (opts.force && PatOS.settings.volume < 0.35) {
      // an alarm must be heard: never quieter than about a third of full volume
      const lift = a.ctx.createGain(); lift.gain.value = 0.35; o.connect(g); g.connect(lift); lift.connect(a.ctx.destination);
    } else { o.connect(g); g.connect(a.out); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  PatOS.sound = {
    tone,
    click() { tone(1400, 0.04, { vol: 0.05, type: 'triangle' }); },
    pop() { tone(600, 0.12, { vol: 0.1, slide: 1200 }); },
    trash() { tone(300, 0.25, { vol: 0.12, type: 'sawtooth', slide: 80 }); },
    notify() { tone(880, 0.25, { vol: 0.1 }); tone(1320, 0.4, { vol: 0.08, delay: 0.12 }); },
    error() { tone(220, 0.18, { vol: 0.12, type: 'square' }); tone(180, 0.25, { vol: 0.1, type: 'square', delay: 0.12 }); },
    startup() {
      if (!PatOS.settings.uiSounds) return;
      const a = PatOS.audio(); if (!a) return;
      if (a.ctx.state !== 'running') { pendingStartup = Date.now(); return; }
      const t = a.ctx.currentTime;
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, i) => {
        const o = a.ctx.createOscillator(); const g = a.ctx.createGain();
        o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.08 + i * 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        o.connect(g); g.connect(a.out); o.start(t + i * 0.01); o.stop(t + 3.4);
      });
    }
  };

  /* ---------- app registry ---------- */
  PatOS.apps = {};
  PatOS.appOrder = [];
  PatOS.registerApp = function (def) {
    def = Object.assign({ width: 760, height: 520, minWidth: 320, minHeight: 220, single: true, category: 'Apps', resizable: true }, def);
    const had = !!PatOS.apps[def.id];
    PatOS.apps[def.id] = def;
    if (!had) PatOS.appOrder.push(def.id); // (a name-only entry replaced by the real app keeps its place)
  };

  /* ---------- apps that load when first opened (see scripts/appmeta.js and js/appmeta.js) ----------
     Launchpad, the Dock and search know these apps by name from the start. Their code is read from their own file the first
     time they are opened (or the first time something they share is used), from the copy PatOS keeps on the device. */
  const lazyLoaded = new Set(), lazyText = new Map(), lazySrcs = new Set();
  /* Soon after start, the text of these files is read from the device's offline copy (nothing is run, so it is cheap). That way an app
     opens at once, also offline, and from the same version as the rest of PatOS even if an update arrives meanwhile. */
  let prefetching = null, prefetched = false;
  PatOS.lazyPending = () => lazySrcs.size > 0 && !prefetched; // true until the app files have been read (usually done long before anyone types a password)
  PatOS.prefetchLazy = function () {
    if (prefetching) return prefetching;
    const queue = [...lazySrcs].filter((x) => !lazyText.has(x)); const worker = async () => { while (queue.length) { const src = queue.shift(); try { const r = await fetch(src); if (r.ok) lazyText.set(src, await r.text()); } catch (e) {} } };
    prefetching = Promise.all([worker(), worker(), worker()]).then(() => { prefetched = true; });
    return prefetching;
  };
  PatOS.loadLazy = function (src) {
    if (lazyLoaded.has(src)) return true; lazyLoaded.add(src);
    try {
      let text = lazyText.get(src);
      if (text == null) { // not read yet (a very early click): ask the network (a synchronous request does not go through the offline copy)
        const x = new XMLHttpRequest(); x.open('GET', src, false); x.send();
        if (x.status !== 200 && !(x.status === 0 && x.responseText)) throw new Error('HTTP ' + x.status); text = x.responseText;
      }
      const s = document.createElement('script'); s.text = text + '\n//# sourceURL=' + src; document.head.appendChild(s); s.remove(); lazyText.delete(src);
      return true;
    } catch (e) {
      lazyLoaded.delete(src); console.error('PatOS could not load ' + src, e);
      if (PatOS.notify) PatOS.notify({ title: 'This app could not open', body: 'Its files are not ready yet. Try again in a moment.', icon: 'settings' });
      return false;
    }
  };
  PatOS.lazyApps = (list) => { list.forEach((m) => { lazySrcs.add(m.lazy); PatOS.registerApp(m); }); setTimeout(() => PatOS.prefetchLazy(), 60); };
  /* PatOS.theHelper: loads the file that makes it the first time it is read. The file's own assignment replaces this entry. */
  PatOS.lazyExports = function (map) {
    Object.keys(map).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(PatOS, key)) return; const src = map[key]; lazySrcs.add(src);
      const plain = (v) => Object.defineProperty(PatOS, key, { value: v, writable: true, configurable: true, enumerable: true });
      Object.defineProperty(PatOS, key, { configurable: true, enumerable: true,
        get() { plain(undefined); delete PatOS[key]; PatOS.loadLazy(src); const d = Object.getOwnPropertyDescriptor(PatOS, key); return d && 'value' in d ? d.value : undefined; },
        set(v) { plain(v); } });
    });
  };
  /* the order apps had when everything loaded at start (name-only entries are registered first, so put them back in place) */
  PatOS.sortApps = function () {
    if (!PatOS.appRank) return; const rank = new Map(PatOS.appRank.map((id, i) => [id, i])); const cur = PatOS.appOrder.slice();
    const lazy = cur.filter((id) => PatOS.apps[id] && PatOS.apps[id].lazy).sort((a, b) => (rank.get(a) || 0) - (rank.get(b) || 0)); const real = cur.filter((id) => !(PatOS.apps[id] && PatOS.apps[id].lazy));
    const out = []; let li = 0;
    real.forEach((id) => { if (rank.has(id)) while (li < lazy.length && rank.get(lazy[li]) < rank.get(id)) out.push(lazy[li++]); out.push(id); });
    while (li < lazy.length) out.push(lazy[li++]);
    PatOS.appOrder.splice(0, PatOS.appOrder.length, ...out);
  };

  /* ---------- open a file with the right app ---------- */
  PatOS.openFile = function (path) {
    const n = PatOS.fs.get(path); if (!n) return;
    const kind = PatOS.fileKind(path, n);
    if (kind === 'folder') return PatOS.launch('finder', { path });
    const ext = PatOS.fs.ext(path);
    const byExt = { pdoc: 'docs', psheet: 'sheets', csv: 'sheets', pslides: 'slides', pform: 'forms', pdf: 'preview' };
    if (byExt[ext]) return PatOS.launch(byExt[ext], { path });
    if (/^(mp4|webm|mov|m4v|ogv)$/.test(ext) && PatOS.apps.videos) return PatOS.launch('videos', { path });
    if (/^(docx|xlsx|pptx)$/.test(ext) && PatOS.openOffice) return PatOS.openOffice(path);
    if (ext === 'zip' && PatOS.openZip) return PatOS.openZip(path);
    if (ext === 'patapp' && PatOS.patapps) return PatOS.patapps.installFromFile(path).catch((e) => PatOS.alertBox(PatOS.t('That didn’t work'), String(e.message || e), { icon: 'appstore' }));
    if (ext === 'patappproject' && PatOS.apps.pitstudio) return PatOS.launch('pitstudio', { importPath: path });
    if (ext === 'ics' && PatOS.apps.calendar) return PatOS.launch('calendar', { ics: path });
    if (ext === 'py' && PatOS.apps.code) return PatOS.launch('code', { path });
    if (kind === 'image') return PatOS.launch('photos', { path });
    if (kind === 'audio') return PatOS.launch('music', { path });
    if (kind === 'link') return PatOS.launch('browser', { url: n.content.trim() });
    if (kind === 'html') return PatOS.launch('browser', { html: n.content, title: PatOS.fs.basename(path) });
    return PatOS.launch('textedit', { path });
  };

  /* ---------- import files from the real computer ---------- */
  /* add real files (from a file picker, or dragged in from the computer) to a PatOS folder */
  PatOS.importFileList = async function (destDir, files) {
    const out = [];
    for (const file of files) {
      const isText = /^text\/|json|javascript|xml|csv/.test(file.type) || /\.(txt|md|js|css|html|json|csv|py)$/i.test(file.name);
      const name = PatOS.fs.uniqueName(destDir, file.name);
      try {
        if (!isText && (file.size > 8 * 1024 * 1024 || /^video\//.test(file.type) || /\.(mp4|webm|mov|m4v|ogv|mkv)$/i.test(file.name))) out.push(await PatOS.fs.writeBlob(destDir + '/' + name, file));
        else {
          const content = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('Could not read the file')); if (isText) r.readAsText(file); else r.readAsDataURL(file); });
          out.push(PatOS.fs.write(destDir + '/' + name, content));
        }
      } catch (e) { PatOS.notify({ title: PatOS.t('Couldn’t add') + ' ' + file.name, body: e.message || PatOS.t('Not enough storage space.'), icon: 'finder' }); }
    }
    return out;
  };
  PatOS.importFiles = function (destDir, accept) {
    return new Promise((resolve) => {
      const input = PatOS.h('input', { type: 'file', multiple: true, accept: accept || '' });
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = async () => { const out = await PatOS.importFileList(destDir, input.files); input.remove(); resolve(out); };
      input.click();
    });
  };
  /* files copied or cut in Piles or on the desktop, waiting to be pasted */
  PatOS.fileClip = {
    paths: [], cut: false,
    set(paths, cut) { this.paths = paths.filter((p) => PatOS.fs.exists(p) && !p.startsWith('/.Trash')); this.cut = !!cut; PatOS.emit('fileclip'); return this.paths.length; },
    has() { return this.paths.some((p) => PatOS.fs.exists(p)); },
    paste(dest) {
      const out = [];
      for (const p of this.paths) {
        if (!PatOS.fs.exists(p)) continue;
        if (dest === p || dest.startsWith(p + '/')) { PatOS.notify({ title: PatOS.t('Cannot copy') + ' ' + PatOS.fs.basename(p), body: PatOS.t('A folder can’t go inside itself.'), icon: 'finder' }); continue; }
        try {
          if (this.cut) { if (PatOS.fs.dirname(p) !== dest) out.push(PatOS.fs.move(p, dest)); else out.push(p); }
          else out.push(PatOS.fs.copy(p, dest));
        } catch (e) { PatOS.notify({ title: PatOS.t(this.cut ? 'Cannot move' : 'Cannot copy') + ' ' + PatOS.fs.basename(p), body: PatOS.t(e.message), icon: 'finder' }); }
      }
      if (this.cut) { this.paths = []; this.cut = false; PatOS.emit('fileclip'); }
      return out;
    }
  };

  PatOS.downloadFile = function (name, content) {
    if (PatOS.sandboxed) { PatOS.notify({ title: 'Downloads are off here', body: 'Claude Artifacts can’t save files to your computer. Open PatOS from its own website to download.', icon: 'finder' }); return; }
    const a = document.createElement('a');
    if (typeof content === 'string' && content.startsWith('data:')) a.href = content;
    else a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- 3D helpers ---------- */
  /* three.js (670 KB) is only loaded when something 3D is about to show: a live wallpaper, Galaxy,
     Orb Runner, 3D Studio, the Music visualizer. PatOS.webgl says whether the device can draw 3D at all;
     PatOS.has3D says whether three.js is ready; PatOS.load3D() loads it once and resolves true or false. */
  PatOS.webgl = (function () {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  })();
  Object.defineProperty(PatOS, 'has3D', { get: () => PatOS.webgl && !!window.THREE });
  let three3D = null;
  PatOS.load3D = function () {
    if (window.THREE) return Promise.resolve(PatOS.webgl);
    if (!PatOS.webgl) return Promise.resolve(false);
    if (three3D) return three3D;
    three3D = new Promise((res) => {
      const tag = document.querySelector('script[type="patos/3d"]');
      const s = document.createElement('script');
      const done = () => { if (!window.THREE) three3D = null; res(PatOS.has3D); };
      if (tag && !tag.getAttribute('src')) { s.text = tag.textContent; document.head.appendChild(s); return setTimeout(done, 0); } // single-file PatOS: it is already inside
      s.src = (tag && tag.getAttribute('src')) || 'vendor/three.min.js'; s.onload = done; s.onerror = done;
      document.head.appendChild(s);
    });
    return three3D;
  };
  /* PitCode (the language; vendor/pitcode.js) is loaded only when something needs it: Studio, or an app written in PitCode */
  let pitSrc = null;
  PatOS.pitcodeSource = function () {
    if (!pitSrc) pitSrc = (async () => {
      const tag = document.querySelector('script[type="patos/pit"]');
      if (tag && !tag.getAttribute('src')) return tag.textContent; // single-file PatOS: it is already inside
      const r = await fetch((tag && tag.getAttribute('src')) || 'vendor/pitcode.js'); if (!r.ok) throw new Error('PitCode could not be loaded.');
      return r.text();
    })().catch((e) => { pitSrc = null; throw e; });
    return pitSrc;
  };
  PatOS.loadPitCode = async function () {
    if (window.PitCode) return window.PitCode;
    const s = document.createElement('script'); s.text = await PatOS.pitcodeSource(); document.head.appendChild(s);
    return window.PitCode;
  };
  /* weaker devices (2-4 cores, little memory, phones) get lighter 3D when quality is "Balanced" */
  PatOS.weakDevice = (function () {
    const c = navigator.hardwareConcurrency || 4, m = navigator.deviceMemory || 8;
    return c <= 4 || m <= 4;
  })();
  PatOS.pixelRatio = function () {
    const q = PatOS.settings.quality3d;
    const dpr = window.devicePixelRatio || 1;
    if (q === 'low') return Math.min(dpr, 1) * 0.75;
    if (q === 'high') return Math.min(dpr, 2);
    return PatOS.weakDevice ? Math.min(dpr, 1) : Math.min(dpr, 1.25);
  };
  PatOS.makeRenderer = function (canvas, opts) {
    const r = new THREE.WebGLRenderer(Object.assign({ canvas, antialias: PatOS.settings.quality3d !== 'low', alpha: true, powerPreference: 'high-performance' }, opts || {}));
    r.setPixelRatio(PatOS.pixelRatio());
    /* GPU pacing: animation loops call r.paced(scene, camera) instead of r.render. A new frame is only
       drawn once the graphics chip has finished the last one (checked without waiting, with a WebGL2
       fence), so a slow GPU gets fewer frames instead of a growing queue that makes everything lag. */
    const gl = r.getContext(); const canFence = !!(gl && typeof gl.fenceSync === 'function');
    let fence = null;
    r.gpuReady = () => {
      if (!fence) return true;
      try { if (gl.isContextLost() || gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED) { gl.deleteSync(fence); fence = null; return true; } } catch (e) { fence = null; return true; }
      return false;
    };
    r.paced = (scene, camera) => {
      if (!r.gpuReady()) return false;
      r.render(scene, camera);
      if (canFence) { try { fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } catch (e) { fence = null; } }
      return true;
    };
    return r;
  };
  /* simple drag-to-orbit camera controller used by 3D apps */
  PatOS.orbit = function (el, camera, target, opts) {
    opts = Object.assign({ dist: 10, min: 2, max: 60, theta: 0.6, phi: 1.1, auto: 0 }, opts || {});
    const s = { theta: opts.theta, phi: opts.phi, dist: opts.dist, vx: 0, vy: 0, down: false, lx: 0, ly: 0, auto: opts.auto };
    el.addEventListener('pointerdown', (e) => { s.down = true; s.lx = e.clientX; s.ly = e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (!s.down) return;
      s.vx = (e.clientX - s.lx) * 0.005; s.vy = (e.clientY - s.ly) * 0.005;
      s.theta -= s.vx; s.phi = PatOS.clamp(s.phi - s.vy, 0.1, Math.PI - 0.1);
      s.lx = e.clientX; s.ly = e.clientY;
    });
    el.addEventListener('pointerup', () => { s.down = false; });
    el.addEventListener('wheel', (e) => { e.preventDefault(); s.dist = PatOS.clamp(s.dist * (1 + Math.sign(e.deltaY) * 0.08), opts.min, opts.max); }, { passive: false });
    s.update = function () {
      if (!s.down) { s.theta -= s.vx; s.vx *= 0.92; s.vy *= 0.92; s.theta += s.auto; }
      camera.position.set(
        target.x + s.dist * Math.sin(s.phi) * Math.sin(s.theta),
        target.y + s.dist * Math.cos(s.phi),
        target.z + s.dist * Math.sin(s.phi) * Math.cos(s.theta)
      );
      camera.lookAt(target);
    };
    return s;
  };
})();
