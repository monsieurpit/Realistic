/* Piles' file operations (3.3): a queue for copies, moves and Trash, and version history for text files.
   Queue
   - A job (copy / move / trash several things) runs one item at a time and gives the screen back between items, so a big
     copy never freezes PatOS. It shows as a Live Activity with real Pause, Resume and Cancel, and Retry for what failed.
   - Jobs are saved. A job that was running when PatOS closed comes back paused (it didn't finish; nothing is done behind
     your back), listed in Command Center with Resume.
   - Each item's result is kept: what failed and why. One failure never stops the others, and nothing is half-written: an
     item is copied or moved whole by the file system, or not at all.
   Versions
   - Saving over a text file (up to 200 KB) keeps the previous text: at most 10 versions a file, 4 MB in all; the oldest go
     first. Not for PatOS's own folders. Restore puts an old version back (and keeps the current text as a version too). */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const fs = () => PatOS.fs;
  let jobs = (PatOS.store.get('fileOps', []) || []).filter((j) => j && j.id && Array.isArray(j.items));
  const live = new Map(); // job id -> Live Activity handle
  const save = () => PatOS.store.set('fileOps', jobs.filter((j) => j.status !== 'done').slice(-20));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const VERB = { copy: 'Copying', move: 'Moving', trash: 'Moving to Trash' };
  const titleOf = (j) => T(VERB[j.kind]) + ' ' + j.items.length + ' ' + T(j.items.length === 1 ? 'item' : 'items');

  function step(j, it) {
    const p = it.src;
    if (!fs().exists(p)) throw new Error(T('It isn’t there anymore.'));
    if (j.kind === 'trash') { fs().remove(p); return; }
    if (j.dest === p || j.dest.startsWith(p + '/')) throw new Error(T('A folder can’t go inside itself.'));
    if (!fs().isDir(j.dest)) throw new Error(T('The folder it goes to is gone.'));
    if (j.kind === 'move') { if (fs().dirname(p) !== j.dest) it.out = fs().move(p, j.dest); else it.out = p; }
    else it.out = fs().copy(p, j.dest);
  }
  // how big an item is (a file's content, a picture's data, everything in a folder), to tell how fast a copy goes
  function sizeOf(p) { let n = 0; const one = (nd) => { n += nd.blob ? +nd.size || 0 : typeof nd.content === 'string' ? nd.content.length : 0; }; const nd = fs().get(p); if (!nd) return 0; if (nd.type === 'dir') fs().walk(p, (q, x) => { if (x.type === 'file') one(x); }); else one(nd); return n; }
  function show(j) {
    let a = live.get(j.id);
    const done = j.items.filter((x) => x.done).length;
    if (!a) {
      a = PatOS.live.start({ id: 'fo-' + j.id, app: 'finder', title: titleOf(j), progress: done / j.items.length, open: j.dest ? { app: 'finder', args: { path: j.dest } } : null,
        pause: () => pause(j.id), resume: () => run(j.id), cancel: () => cancel(j.id), retry: () => retry(j.id) });
      live.set(j.id, a);
    }
    const cur = j.items.find((x) => !x.done);
    const sp = j.meter && j.meter.bytes ? Math.round(j.meter.bytes / (Math.max(16, performance.now() - j.meter.t0) / 1000)) : 0; // (bytes a second: what was really copied, over the time it has taken)
    a.update({ progress: done / j.items.length, detail: done + ' ' + T('of') + ' ' + j.items.length + (cur ? ' · ' + fs().basename(cur.src) : ''), status: j.status === 'paused' ? 'paused' : 'running',
      stats: { speed: sp, file: cur ? fs().basename(cur.src) : '', dest: j.kind === 'trash' ? '' : j.dest } });
    return a;
  }
  async function run(id) {
    const j = jobs.find((x) => x.id === id); if (!j || j.status === 'running') return;
    j.status = 'running'; j.meter = null; save(); show(j); // (the speed counts from now: a pause isn't slowness)
    for (const it of j.items) {
      if (it.done) continue;
      if (j.status !== 'running') { save(); show(j); return; } // (paused or cancelled between items)
      const size = j.kind === 'trash' ? 0 : sizeOf(it.src), t0 = performance.now();
      try { step(j, it); it.error = ''; } catch (e) { it.error = (e && e.message) || T('That didn’t work.'); }
      if (!it.error) { j.meter = j.meter || { bytes: 0, t0 }; j.meter.bytes += size; }
      it.done = true; save(); show(j);
      await new Promise((r) => setTimeout(r, j.items.length > 40 ? 0 : 16)); // (the screen gets its turn)
    }
    finish(j);
  }
  function finish(j) {
    const failed = j.items.filter((x) => x.error); const a = live.get(j.id); live.delete(j.id);
    j.status = failed.length ? 'failed' : 'done'; save();
    const msg = failed.length ? failed.length + ' ' + T('of') + ' ' + j.items.length + ' ' + T('didn’t work') + ': ' + failed[0].error : j.items.length + ' ' + T(j.items.length === 1 ? 'item' : 'items');
    if (a) a.end(failed.length ? 'failed' : 'done', msg);
    PatOS.emit('fileops', j);
  }
  function pause(id) { const j = jobs.find((x) => x.id === id); if (j && j.status === 'running') { j.status = 'paused'; save(); } }
  function cancel(id) { const j = jobs.find((x) => x.id === id); if (!j) return; j.status = 'cancelled'; const a = live.get(id); live.delete(id); jobs = jobs.filter((x) => x !== j); save(); if (a) a.end('cancelled', j.items.filter((x) => x.done).length + ' ' + T('of') + ' ' + j.items.length + ' ' + T('done')); }
  function retry(id) { const j = jobs.find((x) => x.id === id); if (!j) return; j.items.forEach((x) => { if (x.error) { x.done = false; x.error = ''; } }); j.status = 'paused'; save(); run(id); }
  const ops = {
    /* queues a job and starts it; returns its id */
    enqueue(kind, paths, dest) {
      paths = [...new Set(paths)].filter((p) => p && fs().exists(p) && !(fs().isSystem && fs().isSystem(p)));
      if (!paths.length || !VERB[kind] || (kind !== 'trash' && !dest)) return null;
      const j = { id: uid(), kind, dest: dest || '', items: paths.map((src) => ({ src, done: false, error: '' })), status: 'queued', t: Date.now() };
      jobs.push(j); save(); run(j.id); return j.id;
    },
    list: () => jobs.map((j) => ({ id: j.id, kind: j.kind, dest: j.dest, status: j.status, total: j.items.length, done: j.items.filter((x) => x.done).length, failed: j.items.filter((x) => x.error).map((x) => ({ path: x.src, error: x.error })) })),
    pause, resume: run, cancel, retry
  };
  // a job left running when PatOS closed: back, paused, with Resume (it is never restarted on its own)
  setTimeout(() => { jobs.forEach((j) => { if (j.status === 'running' || j.status === 'queued') { j.status = 'paused'; show(j); } }); save(); }, 1500);
  PatOS.fileOps = ops;

  /* ---------- versions ---------- */
  const VKEY = 'fileVersions', PER = 10, MAXB = 4 * 1024 * 1024, MAXF = 200 * 1024;
  let V = PatOS.store.get(VKEY, {}) || {};
  const vsave = PatOS.debounce(() => PatOS.store.set(VKEY, V), 500);
  const textOk = (p, c) => typeof c === 'string' && c.length <= MAXF && !c.startsWith('data:') && !/(^|\/)\./.test(p) && !(p === '/System' || p.startsWith('/System/'));
  function keep(p, old) {
    const l = V[p] = V[p] || []; if (l.length && l[l.length - 1].c === old) return;
    l.push({ t: Date.now(), c: old }); if (l.length > PER) l.splice(0, l.length - PER);
    let total = Object.values(V).reduce((s, x) => s + x.reduce((a, v) => a + v.c.length, 0), 0);
    while (total > MAXB) { let oldest = null; Object.keys(V).forEach((k) => { const v = V[k][0]; if (v && (!oldest || v.t < oldest.t)) oldest = { k, t: v.t }; }); if (!oldest) break; total -= V[oldest.k].shift().c.length; if (!V[oldest.k].length) delete V[oldest.k]; }
    vsave();
  }
  const rawWrite = PatOS.fs.write.bind(PatOS.fs);
  let last = {}; // path -> time a version was last kept (one version per 2 minutes of editing, not one per keystroke)
  PatOS.fs.write = function (path, content, extra) {
    try {
      const n = PatOS.fs.get(path);
      if (n && n.type === 'file' && textOk(path, n.content) && typeof content === 'string' && content !== n.content && PatOS.settings.fileVersions !== false) {
        const now = Date.now(); if (!last[path] || now - last[path] > 120000) { keep(PatOS.fs.norm ? PatOS.fs.norm(path) : path, n.content); last[path] = now; }
      }
    } catch (e) { /* history is a bonus: saving always goes on */ }
    return rawWrite(path, content, extra);
  };
  PatOS.versions = {
    list: (p) => (V[p] || []).map((v, i) => ({ i, t: v.t, size: v.c.length })).reverse(),
    read: (p, i) => (V[p] && V[p][i] ? V[p][i].c : null),
    restore(p, i) { const c = PatOS.versions.read(p, i); if (c == null) return false; const n = PatOS.fs.get(p); if (n && typeof n.content === 'string') keep(p, n.content); last[p] = Date.now(); rawWrite(p, c); return true; },
    clear(p) { if (p) delete V[p]; else V = {}; vsave(); },
    size: () => Object.values(V).reduce((s, x) => s + x.reduce((a, v) => a + v.c.length, 0), 0)
  };
})();
