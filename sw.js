/* PatOS service worker. It keeps PatOS working offline, and it decides WHICH version of PatOS this device runs.

   This file is the same for every PatOS version (build.js no longer writes it). That matters: a browser swaps in a new
   service worker by itself whenever this file changes, and that is exactly how every visitor used to receive every new
   version, beta included. Now the files of each version are saved on the device in their own box (a cache called
   patos-<version>), and the device only switches when it is told to:
     - a finished version (1.7.0): never by itself. The person presses Update, then PatOS downloads that version, checks
       every file, and switches. Refreshing the page, or closing and opening PatOS, keeps the version you have.
     - a beta (2.0.0-beta.11...): only on devices with Beta updates on. The newest beta is downloaded quietly, and used the
       next time PatOS starts.
   The server side is update-manager.js (it hands out /_v/<version>/... and a list of files with fingerprints).
   Devices that had PatOS before this worker (old caches called patos-<10 letters or numbers>) keep running their old copy
   until the new files are saved; a beta copy moves to the newest beta, and a finished copy to the newest finished version. */
'use strict';
const STATE_CACHE = 'patos-data-update', STATE_KEY = '/__patos/state', OLD_META = 'patos-data-meta', DONE = '/__patos/complete';
const cacheName = (id) => 'patos-' + id;
const isData = (k) => k.startsWith('patos-data-');
const LEGACY_NAME = /^patos-[0-9a-f]{10}$/, LEGACY_ID = /^[0-9a-f]{10}$/;
const STABLE_ID = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

/* What this device runs: { v: 2, channel: 'stable'|'beta', installed, previous, pending, pendingMigrate, useOld, since, legacy }
   installed = the version being used, previous = the one before it (kept for "go back"), pending = a beta that is downloaded
   and waits for the next start, legacy = installed is a copy made before this worker existed. */
let state = null;
const loadState = async () => { try { const r = await (await caches.open(STATE_CACHE)).match(STATE_KEY); state = r ? await r.json() : null; } catch (e) { state = null; } return state; };
const saveState = async (s) => { state = s; await (await caches.open(STATE_CACHE)).put(STATE_KEY, new Response(JSON.stringify(s), { headers: { 'Content-Type': 'application/json' } })); };
const stateReady = loadState();
// Every change to the state goes through here, one at a time, each reading the state as it is at that moment. (Messages and page
// loads can arrive together; downloads are slow, so they never run inside this: only the quick read-and-save does.)
let queue = Promise.resolve();
function update(fn) { const run = queue.then(async () => { const next = fn(state); if (next) await saveState(next); return state; }); queue = run.catch(() => {}); return run; }
let lastBetaCheck = 0;

/* ---------- saving a whole version on the device ---------- */
async function sha256(buf) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function fetchManifest(name) {
  const r = await fetch('/_v/' + name + '/patos-release.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('No such version (' + name + ', ' + r.status + ').');
  const m = await r.json();
  if (!m || typeof m.id !== 'string' || !Array.isArray(m.files) || !m.files.length) throw new Error('The version list is not valid.');
  return m;
}
// what a manifest says it is, for comparing versions (a beta is older than the finished version it leads to)
const verOf = (m) => ({ version: m.version, beta: m.beta || 0 });
function newerVer(a, b) {
  const r = (v) => { const n = String(v.version).split('.').map(Number); return [n[0] || 0, n[1] || 0, n[2] || 0, v.beta ? 0 : 1, v.beta || 0]; };
  const x = r(a), y = r(b); for (let i = 0; i < 5; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false;
}
// the version a device that follows betas moves to: the beta being built, or, when there is none (it was finished), that finished version
async function fetchBetaOrFinished() { try { return await fetchManifest('beta'); } catch (e) { return fetchManifest('stable'); } }
async function isComplete(id) { if (!(await caches.has(cacheName(id)))) return false; return !!(await (await caches.open(cacheName(id))).match(DONE)); }
async function getFile(c, m, f) {
  const r = await fetch('/_v/' + m.id + '/' + f.p, { cache: 'no-store' });
  if (!r.ok || r.status !== 200) throw new Error(f.p + ' could not be downloaded (' + r.status + ').');
  const buf = await r.arrayBuffer();
  if (f.h && (await sha256(buf)) !== f.h) throw new Error(f.p + ' arrived damaged.');
  await c.put('/' + f.p, new Response(buf, { headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream' } }));
}
const downloads = new Map();
// all the files of a version, or nothing: the box is only marked complete when every file arrived and matched its fingerprint
function download(m) {
  if (!downloads.has(m.id)) downloads.set(m.id, doDownload(m).finally(() => downloads.delete(m.id)));
  return downloads.get(m.id);
}
async function doDownload(m) {
  if (await isComplete(m.id)) return;
  await caches.delete(cacheName(m.id));
  const c = await caches.open(cacheName(m.id));
  try {
    const queue = m.files.slice(); let failed = null;
    const worker = async () => { while (queue.length && !failed) { const f = queue.shift(); try { await getFile(c, m, f); } catch (e) { failed = e; } } };
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    if (failed) throw failed;
    const index = await c.match('/index.html'); if (!index) throw new Error('index.html is missing.');
    await c.put('/', index.clone()); // the page is asked for as "/" too
    await c.put(DONE, new Response('1'));
  } catch (e) { await caches.delete(cacheName(m.id)); throw e; }
}

/* ---------- which version runs ---------- */
function readSettings() { // PatOS's own database (only called when an old copy exists, so the database exists)
  return new Promise((res) => {
    try {
      const r = indexedDB.open('patos');
      r.onerror = () => res(null); r.onblocked = () => res(null);
      r.onsuccess = () => { const db = r.result; try { const g = db.transaction('kv', 'readonly').objectStore('kv').get('settings'); g.onsuccess = () => { db.close(); res(g.result || null); }; g.onerror = () => { db.close(); res(null); }; } catch (e) { try { db.close(); } catch (e2) {} res(null); } };
    } catch (e) { res(null); }
  });
}
async function findLegacy() {
  const keys = (await caches.keys()).filter((k) => LEGACY_NAME.test(k)); if (!keys.length) return null;
  let name = keys[0];
  try { const r = await (await caches.open(OLD_META)).match('/__patos/meta'); const m = r ? await r.json() : {}; const run = m.useOld && m.previous ? m.previous : m.current; if (run && keys.includes(run)) name = run; } catch (e) {}
  // Every old copy holds the beta files (everyone used to receive them), so the files say nothing. What counts is the choice the
  // person made: Settings › Software Update › Beta updates. Only a device with it on keeps following the beta.
  const settings = await readSettings();
  const beta = !!(settings && settings.betaUpdates === true);
  return { id: name.slice(6), beta };
}
const hasVersion = async (s) => !!(s && s.v === 2 && s.installed && (LEGACY_ID.test(s.installed) ? await caches.has(cacheName(s.installed)) : await isComplete(s.installed)));
let verified = null; // the version that was last checked to be fully saved (so each request does not check again)
async function versionReady() { if (state && state.installed && verified === state.installed) return true; const ok = await hasVersion(state); verified = ok ? state.installed : null; return ok; }
/* Makes sure there is a version to run (a new device saves the one its page came from), and for an old copy, that the newer
   version it moves to is downloaded. Safe to run again and again. */
async function prepare() {
  await stateReady;
  if (await hasVersion(state)) { if (state.legacy && !state.pending) await migrate(); return; }
  const legacy = await findLegacy();
  if (legacy) {
    await update(() => ({ v: 2, channel: legacy.beta ? 'beta' : 'stable', installed: legacy.id, previous: null, pending: null, pendingMigrate: false, useOld: false, since: Date.now(), legacy: true }));
    return migrate();
  }
  const channel = state && state.channel === 'beta' ? 'beta' : 'stable';
  const m = channel === 'beta' ? await fetchBetaOrFinished() : await fetchManifest('root'); await download(m);
  await update(() => ({ v: 2, channel, ver: verOf(m), installed: m.id, previous: null, pending: null, pendingMigrate: false, useOld: false, since: Date.now(), legacy: false }));
}
async function migrate() {
  const m = state.channel === 'beta' ? await fetchBetaOrFinished() : await fetchManifest('stable'); await download(m);
  await update((s) => Object.assign({}, s, { pending: m.id, pendingVer: verOf(m), pendingMigrate: true }));
}
async function cleanup() {
  const keep = new Set([state && state.installed, state && state.previous, state && state.pending].filter(Boolean).map(cacheName));
  downloads.forEach((p, id) => keep.add(cacheName(id))); // a version that is being downloaded right now
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith('patos-') && !isData(k) && !keep.has(k)).map((k) => caches.delete(k)));
}
/* switch to a downloaded version; the one that was running stays as "previous" */
async function promote(m) {
  const id = m.id;
  await update((s) => Object.assign({}, s, { previous: s.installed && s.installed !== id ? s.installed : s.previous, installed: id, ver: verOf(m), pendingVer: null, pending: null, pendingMigrate: false, useOld: false, since: Date.now(), legacy: false }));
  await cleanup();
}
// at the start of PatOS: a beta that was downloaded earlier (Beta updates on), or an old copy's move, is used now
async function promoteAtStart() {
  const id = state && state.pending; if (!id || !(state.channel === 'beta' || state.pendingMigrate)) return;
  const ok = await isComplete(id);
  await update((s) => {
    if (s.pending !== id) return null; // changed meanwhile
    if (!ok) return Object.assign({}, s, { pending: null, pendingMigrate: false });
    return Object.assign({}, s, { previous: s.installed && s.installed !== id ? s.installed : s.previous, installed: id, ver: s.pendingVer || null, pending: null, pendingVer: null, pendingMigrate: false, useOld: false, since: Date.now(), legacy: false });
  });
  await cleanup();
}
// Beta updates on: download the newest beta quietly (it is used the next time PatOS starts)
async function checkBeta() {
  await stateReady; if (!state || state.channel !== 'beta') return;
  let m; try { m = await fetchBetaOrFinished(); } catch (e) { return; }
  if (m.id === state.installed || m.id === state.pending) return;
  // never go down: only a newer beta, a rebuilt copy of the same beta, or the finished version the beta led to
  const same = m.channel === 'beta' && state.ver && state.ver.version === m.version && (state.ver.beta || 0) === (m.beta || 0);
  if (state.ver && !newerVer(m, state.ver) && !same) return;
  await download(m);
  // (the choice may have changed while it downloaded: then the files are simply thrown away by cleanup)
  await update((s) => (s.channel === 'beta' && m.id !== s.installed ? Object.assign({}, s, { pending: m.id, pendingVer: verOf(m), pendingMigrate: false }) : null)); await cleanup();
}
async function setChannel(ch) {
  await prepare().catch(() => {}); if (!state) return;
  await update((s) => (s.channel === ch ? null : Object.assign({}, s, { channel: ch }, ch !== 'beta' && s.pending && !s.pendingMigrate ? { pending: null, pendingVer: null } : {}))); // a beta that was waiting is no longer wanted
  await cleanup();
}
const runningId = () => (state.useOld && state.previous ? state.previous : state.installed);
const status = () => ({ ok: true, running: cacheName(runningId()), newest: cacheName(state.installed), current: cacheName(state.installed), previous: state.previous ? cacheName(state.previous) : null, useOld: !!state.useOld, since: state.since, channel: state.channel, installed: state.installed, pending: state.pending || null, ver: state.ver || null, legacy: !!state.legacy });

self.addEventListener('install', (e) => { e.waitUntil((async () => { try { await prepare(); } catch (er) { /* the page still works from the network; this is tried again on the next start */ } await self.skipWaiting(); })()); });
self.addEventListener('activate', (e) => { e.waitUntil((async () => {
  await stateReady; try { await prepare(); } catch (er) {}
  await cleanup(); await self.clients.claim();
  if (state && state.legacy && state.pending) (await self.clients.matchAll()).forEach((c) => c.postMessage({ patosUpdate: true })); // an older copy of PatOS: tell it a newer one is ready
})()); });

// buttons on PatOS's Chrome notifications (Stop, Snooze): tell the open PatOS, or open it
self.addEventListener('notificationclick', (e) => {
  const n = e.notification; const d = n.data || {}; const action = e.action || 'open'; n.close();
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cs.length) { cs.forEach((c) => c.postMessage({ patosNotif: true, id: d.id, action })); if (action === 'open') { try { await cs[0].focus(); } catch (er) {} } }
    else if (action === 'open' && self.clients.openWindow) await self.clients.openWindow('./');
  })());
});
// input() for Python: the Python worker waits on /__stdin/<run id> until PatOS sends it a line
const stdin = {};
self.addEventListener('message', (e) => {
  const d = e.data; if (!d) return;
  if (d.patosStdin) { const st = stdin[d.id] = stdin[d.id] || { q: [], w: [] }; if (st.w.length) st.w.shift()(d.text); else st.q.push(d.text); return; }
  const reply = (x) => { if (e.ports && e.ports[0]) e.ports[0].postMessage(x); };
  if (!(d.patosVersion || d.patosRollback || d.patosUseNewest || d.patosHello || d.patosCheck || d.patosInstall)) return;
  e.waitUntil((async () => {
    try {
      await stateReady; if (!(await hasVersion(state))) await prepare().catch(() => {});
      if (!state) return reply({ ok: false, reason: 'none' });
      if (d.patosHello) { await setChannel(d.patosHello.betaOn ? 'beta' : 'stable'); await checkBeta().catch(() => {}); }
      if (d.patosCheck) { await checkBeta().catch(() => {}); if (state.legacy && !state.pending) await prepare().catch(() => {}); }
      if (d.patosInstall) {
        const want = d.patosInstall.beta ? 'beta' : String(d.patosInstall.id || '');
        if (want !== 'beta' && !STABLE_ID.test(want)) return reply({ ok: false, error: 'That is not a version.' });
        let m; try { m = await fetchManifest(want); await download(m); } catch (er) { return reply({ ok: false, error: String((er && er.message) || er) }); }
        await promote(m);
      }
      if (d.patosRollback) { if (!state.previous || !(await caches.has(cacheName(state.previous)))) return reply({ ok: false, reason: 'none' }); await update((s) => Object.assign({}, s, { useOld: true })); }
      if (d.patosUseNewest) await update((s) => Object.assign({}, s, { useOld: false }));
      reply(status());
    } catch (er) { reply({ ok: false, error: String((er && er.message) || er) }); }
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/__stdin/')) {
    e.respondWith(new Promise((res) => { const id = url.pathname.split('/')[2]; const st = stdin[id] = stdin[id] || { q: [], w: [] }; const ans = (t) => res(t == null ? new Response('', { status: 204 }) : new Response(t)); if (st.q.length) ans(st.q.shift()); else st.w.push(ans); }));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_v/') || url.pathname === '/apprequests' || url.pathname === '/apprequests/') return; // (the review page is not a part of PatOS)
  // Python's files never change for a given version, so they are kept apart and survive PatOS updates
  if (url.pathname.startsWith('/pyodide/') || url.pathname.startsWith('/vendor/pdf/')) {
    // the PDF tools are fetched the first time a PDF is opened; the cache name carries their version
    e.respondWith(caches.open(url.pathname.startsWith('/pyodide/') ? 'patos-data-pyodide' : 'patos-data-pdf-3.11.174').then((c) => c.match(e.request, { ignoreSearch: true }).then((m) => m || fetch(e.request).then((r) => { if (r.ok && r.status === 200) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (e.request.destination === 'document' && Date.now() - lastBetaCheck > 60000) { lastBetaCheck = Date.now(); e.waitUntil(stateReady.then(() => checkBeta()).catch(() => {})); } // a newer beta is fetched in the background
  e.respondWith(serve(e.request, url));
});

// Files come from one version only (the one this device runs, or the previous one after going back), never a mix.
async function serve(request, url) {
  await stateReady;
  if (request.destination === 'document') { try { await promoteAtStart(); } catch (e) {} } // the start of PatOS (not a frame inside it)
  if (!(await versionReady())) { try { await prepare(); } catch (e) {} if (!(await versionReady())) return fetch(request); }
  const id = runningId();
  const c = await caches.open(cacheName(id));
  const hit = await c.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    // not saved (a file that is not on the list): ask for it from the same version, never from a newer one
    if (LEGACY_ID.test(id)) return await fetch(request);
    const r = await fetch('/_v/' + id + url.pathname + url.search, { cache: 'no-store' });
    if (r.status === 404) return await fetch(request); // not one of this version's files (/apprequests, /docs/...): the website itself answers
    if (r.ok && r.status === 200) c.put(request, r.clone());
    return r;
  } catch (er) { return (await c.match('/index.html')) || Response.error(); }
}
