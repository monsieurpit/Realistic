/* PatOS system services (3.3): Universal Actions, Live Activities and Notifications 2.0.
   Small, shared and used everywhere, so they load with PatOS. The screens that show them (Command Center, Capture,
   Notification Center, the share sheet) build on these and nothing else. See docs/SERVICES.md. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ======================= Universal Actions =======================
     An object is plain data that says what it is: { type, ...fields }
       file  { path }            image { path } or { url }      text { text }      url { url, title? }
       contact { name, phone?, email? }    event { title, start?, end? }    document { path }
     An action: { id, app, title, icon?, accepts: [types] | (obj) => bool, run(obj) -> result | Promise, undo?(result) }
     - Only actions whose app is installed show up. run() gets a copy of the object, never more than it was given.
     - Community apps (sandboxed) can't register actions here; they reach PatOS through their own permission system. */
  const A = new Map();
  const typeOfPath = (p) => {
    const k = PatOS.fileKind ? PatOS.fileKind(p, PatOS.fs.get(p)) : '';
    if (k === 'image') return 'image'; if (k === 'folder') return 'folder';
    if (/\.(pdoc|docx|pdf|psheet|xlsx|pslides|pptx|txt|md)$/i.test(p)) return 'document';
    return 'file';
  };
  const actions = {
    register(def) {
      if (!def || !/^[a-z0-9.-]{3,60}$/.test(def.id) || typeof def.run !== 'function') throw new Error('An action needs an id (a-z, 0-9, dots, dashes) and run().');
      A.set(def.id, Object.assign({ accepts: [] }, def)); return def.id;
    },
    unregister: (id) => A.delete(id),
    /* what an object is, from a file path, text or a link */
    of(x) {
      if (!x) return null;
      if (typeof x === 'object' && x.type) return x;
      const s = String(x);
      if (s[0] === '/' && PatOS.fs.exists(s)) return { type: typeOfPath(s), path: s };
      if (/^https?:\/\/\S+$/i.test(s.trim())) return { type: 'url', url: s.trim() };
      return { type: 'text', text: s };
    },
    /* the actions that can take this object, in a stable order */
    for(obj) {
      obj = actions.of(obj); if (!obj) return [];
      const alsoFile = obj.type === 'image' || obj.type === 'document';
      return [...A.values()].filter((a) => {
        if (a.app && !PatOS.apps[a.app]) return false;
        const acc = a.accepts;
        try { return typeof acc === 'function' ? !!acc(obj) : acc.includes(obj.type) || (alsoFile && acc.includes('file')); } catch (e) { return false; }
      }).sort((a, b) => (a.order || 50) - (b.order || 50));
    },
    get: (id) => A.get(id) || null,
    list: () => [...A.values()].map((a) => ({ id: a.id, app: a.app || '', title: a.title, accepts: typeof a.accepts === 'function' ? ['custom'] : a.accepts.slice() })),
    /* runs one: { ok, message, result }. A failure is said, never hidden. */
    async run(id, obj) {
      const a = A.get(id); obj = actions.of(obj);
      if (!a) return { ok: false, message: T('That action doesn’t exist.') };
      if (!actions.for(obj).includes(a)) return { ok: false, message: T('This action can’t take that.') };
      try {
        const r = await a.run(Object.assign({}, obj));
        PatOS.emit('action:ran', { id, type: obj.type });
        return { ok: true, message: (r && r.message) || '', result: r, undo: a.undo ? () => a.undo(r) : null };
      } catch (e) { return { ok: false, message: (e && e.message) || T('That didn’t work.') }; }
    },
    /* the share sheet: a menu of what can be done with the object, at x, y */
    sheet(obj, x, y) {
      obj = actions.of(obj); const list = actions.for(obj);
      if (!list.length) { PatOS.notify({ title: T('Nothing can take this'), body: '', icon: 'settings' }); return null; }
      return PatOS.menu([{ header: T('Share') }, ...list.map((a) => ({ label: T(a.title), action: async () => { const r = await actions.run(a.id, obj); if (!r.ok) PatOS.notify({ title: T('That didn’t work'), body: r.message, icon: a.app || 'settings', priority: 'high' }); else if (r.message) PatOS.notify({ title: T(a.title), body: r.message, icon: a.app || 'settings', priority: 'low' }); } }))], x, y);
    }
  };
  PatOS.actions = actions;

  /* ======================= Live Activities =======================
     Something that is happening now: a copy, a backup, a download, a recording, music.
       const a = PatOS.live.start({ app, title, detail?, progress?: 0..1 | null, open?: { app, args }, pause?, resume?, cancel?, retry? })
       a.update({ progress, detail, title })     a.end('done' | 'failed' | 'cancelled', message?)
     The owner of the operation drives it: progress is only what it reports (null = can't be measured), and only the
     controls it gives (pause, cancel...) are offered. An activity left without news for 10 minutes is marked as stalled,
     not as still running. Ended ones stay listed for a while, and a failure (or a long job that finished) also notifies. */
  const L = new Map(); let ended = [];
  const changed = () => PatOS.emit('live');
  function pub(a) { return { id: a.id, app: a.app, title: a.title, detail: a.detail, stats: a.stats || null, eta: a.eta, progress: a.progress, status: a.status, started: a.started, updated: a.updated, ended: a.endedAt || 0, message: a.message || '', can: { pause: !!a.pause && a.status === 'running', resume: !!a.resume && a.status === 'paused', cancel: !!a.cancel && /running|paused/.test(a.status), retry: !!a.retry && a.status === 'failed', open: !!a.open }, eta: a.eta || 0 }; }
  const live = {
    start(o) {
      const a = { id: o.id || uid(), app: o.app || 'settings', title: String(o.title || ''), detail: String(o.detail || ''), progress: o.progress == null ? null : Math.max(0, Math.min(1, +o.progress)), status: 'running', started: Date.now(), updated: Date.now(), open: o.open || null, pause: o.pause, resume: o.resume, cancel: o.cancel, retry: o.retry, rate: [] };
      L.set(a.id, a); changed();
      const h = {
        id: a.id,
        update(u) { if (!L.has(a.id)) return h; u = u || {}; if (u.stats && typeof u.stats === 'object') a.stats = { speed: +u.stats.speed || 0, file: String(u.stats.file || '').slice(0, 120), dest: String(u.stats.dest || '').slice(0, 300) }; if (u.progress != null) { const p = Math.max(0, Math.min(1, +u.progress)); a.rate.push([Date.now(), p]); if (a.rate.length > 8) a.rate.shift(); a.progress = p; a.eta = etaOf(a); } if (u.detail != null) a.detail = String(u.detail); if (u.title != null) a.title = String(u.title); if (u.status === 'paused' || u.status === 'running') a.status = u.status; a.updated = Date.now(); changed(); return h; },
        end(status, message) { return live.end(a.id, status, message); }
      };
      return h;
    },
    end(id, status, message) {
      const a = L.get(id); if (!a) return;
      L.delete(id); a.status = /^(done|failed|cancelled)$/.test(status) ? status : 'done'; a.message = message || ''; a.endedAt = Date.now();
      ended.unshift(a); ended = ended.slice(0, 20); changed();
      const long = a.endedAt - a.started > 8000;
      if (a.status === 'failed') PatOS.notify({ title: a.title + ': ' + T('didn’t finish'), body: a.message, icon: a.app, priority: 'high', category: 'activity', actions: a.retry ? [{ label: T('Retry'), run: () => a.retry() }] : null });
      else if (a.status === 'done' && long) PatOS.notify({ title: a.title, body: a.message || T('Done'), icon: a.app, priority: 'low', category: 'activity' });
    },
    list: () => [...L.values()].map(pub),
    recent: () => ended.map(pub),
    get: (id) => (L.get(id) ? pub(L.get(id)) : null),
    act(id, what) {
      const a = L.get(id) || ended.find((x) => x.id === id); if (!a) return false;
      if (what === 'open') { if (a.open) PatOS.launch(a.open.app, a.open.args || {}); return !!a.open; }
      const fn = a[what]; if (typeof fn !== 'function') return false; // (only what the operation really supports)
      if (what === 'retry') { ended = ended.filter((x) => x !== a); changed(); }
      try { fn(); } catch (e) {}
      if (what === 'pause' && L.has(id)) { a.status = 'paused'; changed(); }
      if (what === 'resume' && L.has(id)) { a.status = 'running'; changed(); }
      return true;
    },
    clearEnded() { ended = []; changed(); }
  };
  function etaOf(a) {
    if (a.rate.length < 3 || a.progress >= 1) return 0;
    const [t0, p0] = a.rate[0], [t1, p1] = a.rate[a.rate.length - 1]; if (p1 <= p0 || t1 - t0 < 1500) return 0;
    return Math.round((1 - p1) * (t1 - t0) / (p1 - p0)); // (ms; shown only when the pace is steady enough to measure)
  }
  // no news for 10 minutes: say it is stalled instead of pretending it is still going
  setInterval(() => { const now = Date.now(); let any = false; L.forEach((a) => { if (a.status === 'running' && now - a.updated > 600000) { a.status = 'stalled'; any = true; } }); if (any) changed(); }, 60000);
  PatOS.live = live;

  /* ======================= Notifications 2.0 =======================
     PatOS.notify({ title, body, icon (the app), priority: 'low'|'normal'|'high'|'urgent', category, actions: [{ label, run }],
                    open: { app, args }, key (same key = one notification, updated), at (a time to deliver it) })
     - History: kept on this device (never synced), searchable, grouped by app, for notifKeepDays days (default 7, at most 400).
     - Rules per app (Settings › Notifications): allow, banners, sounds. Quiet hours and Focus keep banners and sounds away,
       except urgent ones. Everything still lands in Notification Center.
     - The same notification again within a minute is counted (×2) instead of piling up.
     - Scheduled ones (at) wait in a saved queue and are delivered on time, also after a restart (their buttons can't be saved,
       their "open" link can). */
  const KEEP = () => Math.max(1, Math.min(90, +PatOS.settings.notifKeepDays || 7));
  let hist = (PatOS.store.get('notifHistory', []) || []).filter((n) => n && n.id);
  let queue = PatOS.store.get('notifQueue', []) || [];
  const runtime = new Map(); // id -> { actions, onClick } (functions can't be saved)
  const saveHist = () => PatOS.store.set('notifHistory', hist.map(stripN)); // (the store itself groups its writes to disk)
  function stripN(n) { const o = Object.assign({}, n); delete o.actions; delete o.onClick; return o; }
  function prune() { const cut = Date.now() - KEEP() * 86400000; hist = hist.filter((n) => n.time >= cut).slice(0, 400); }
  const rules = () => PatOS.settings.notifRules || {};
  function ruleOf(app) {
    const r = rules()[app] || {}; const muted = (PatOS.settings.mutedApps || []).includes(app);
    return { allow: r.allow !== false, banner: r.banner !== false && !muted, sound: r.sound !== false && !muted };
  }
  function quietNow() {
    if (!PatOS.settings.quietOn) return false;
    const [a, b] = [PatOS.settings.quietFrom || '22:00', PatOS.settings.quietTo || '07:00'].map((s) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); });
    const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
    return a <= b ? now >= a && now < b : now >= a || now < b;
  }
  const nc = {
    /* what Notification Center shows: newest first, optionally only one app, or what matches a search */
    list(opts) { opts = opts || {}; const q = String(opts.q || '').toLowerCase(); return hist.filter((n) => (!opts.app || n.app === opts.app) && (!q || (n.title + ' ' + n.body + ' ' + n.appName).toLowerCase().includes(q))).map((n) => Object.assign({}, n, { actions: (runtime.get(n.id) || {}).actions || [] })); },
    groups() { const g = new Map(); nc.list().forEach((n) => { if (!g.has(n.app)) g.set(n.app, []); g.get(n.app).push(n); }); return [...g.entries()].map(([app, items]) => ({ app, name: items[0].appName, items })); },
    unread: () => hist.filter((n) => !n.read).length,
    markRead() { let any = false; hist.forEach((n) => { if (!n.read) { n.read = true; any = true; } }); if (any) { saveHist(); PatOS.emit('notif'); } },
    dismiss(id) { hist = hist.filter((n) => n.id !== id); runtime.delete(id); saveHist(); PatOS.emit('notif'); },
    clearApp(app) { hist = hist.filter((n) => n.app !== app); saveHist(); PatOS.emit('notif'); },
    clear() { hist = []; runtime.clear(); saveHist(); PatOS.emit('notif'); },
    act(id, i) { const r = runtime.get(id); const a = r && r.actions && r.actions[i]; if (!a) return false; try { a.run(); } catch (e) {} nc.dismiss(id); return true; },
    open(id) { const n = hist.find((x) => x.id === id); const r = runtime.get(id); if (r && r.onClick) { try { r.onClick(); } catch (e) {} } else if (n && n.open && PatOS.apps[n.open.app]) PatOS.launch(n.open.app, n.open.args || {}); nc.dismiss(id); },
    scheduled: () => queue.slice(),
    cancelScheduled(id) { queue = queue.filter((q) => q.id !== id); PatOS.store.set('notifQueue', queue); },
    quietNow, ruleOf,
    /* (used by PatOS.notify in js/shell.js) records it, and says whether a banner / sound should show */
    _add(n) {
      if (n.at && +n.at > Date.now() + 1000) { const q = stripN(Object.assign({}, n, { id: n.id || uid(), at: +n.at })); delete q.at0; queue.push(q); PatOS.store.set('notifQueue', queue); return { scheduled: q.id }; }
      const app = n.icon || 'about', r = ruleOf(app);
      if (!r.allow) return { banner: false, sound: false, dropped: true };
      const pr = /^(low|normal|high|urgent)$/.test(n.priority) ? n.priority : 'normal';
      const key = n.key || (app + '|' + n.title + '|' + (n.body || ''));
      const same = hist.find((x) => x.key === key && Date.now() - x.time < (n.key ? Infinity : 60000));
      let rec;
      if (same) { same.count = (same.count || 1) + (n.key ? 0 : 1); same.time = Date.now(); same.read = false; same.title = n.title; same.body = n.body || ''; hist = [same, ...hist.filter((x) => x !== same)]; rec = same; }
      else { rec = { id: n.id || uid(), key, app, appName: (PatOS.apps[app] && PatOS.apps[app].name) || 'PatOS', title: String(n.title || ''), body: String(n.body || ''), priority: pr, category: n.category || '', time: Date.now(), read: false, count: 1, open: n.open || null }; hist.unshift(rec); }
      if ((n.actions && n.actions.length) || n.onClick) runtime.set(rec.id, { actions: (n.actions || []).filter((a) => a && a.label && typeof a.run === 'function').slice(0, 3), onClick: n.onClick });
      prune(); saveHist(); PatOS.emit('notif', rec);
      const quiet = (PatOS.focusMode || quietNow()) && pr !== 'urgent';
      return { id: rec.id, rec, banner: r.banner && !quiet && pr !== 'low', sound: r.sound && !quiet && pr !== 'low', counted: !!same };
    }
  };
  // scheduled ones, delivered on time (checked every 20 s; at start, anything already due is delivered)
  function deliverDue() {
    const now = Date.now(), due = queue.filter((q) => q.at <= now); if (!due.length) return;
    queue = queue.filter((q) => q.at > now); PatOS.store.set('notifQueue', queue);
    due.forEach((q) => { const n = Object.assign({}, q); delete n.at; PatOS.notify(n); });
  }
  setInterval(deliverDue, 20000); setTimeout(deliverDue, 3000);
  prune();
  PatOS.nc = nc;
})();
