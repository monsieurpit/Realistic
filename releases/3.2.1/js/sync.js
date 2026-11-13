/* PatOS Sync: your files, notes, calendar and settings follow you between your devices.
   - It is optional, and PatOS never waits for it. Everything is saved on the device first; Sync only copies changes
     to and from your own PatOS server in the background. Offline, nothing is lost: changes go out later.
   - Everything is encrypted on the device before it leaves (AES-GCM). The server only holds scrambled bytes and
     scrambled ids: it can't read your file names or what is in them. The key is made on your first device
     (a 28-character code) and typed into the others. Nobody can reset it for you, so it is also saved in backups.
   - The key lives only on your devices. If the server's folder is ever lost (a new Railway), the first device that
     syncs makes the account again and sends everything back.
   - A change made later wins (the clocks of your devices are trusted). Deleting is a change too. A device that joins
     keeps its own things, and for anything that exists on both sides the server's version is used (a safety
     snapshot is taken first). Big files (videos, huge pictures) stay on the device where they are. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);

  /* what follows you: these saved lists (the file tree is walked separately) and a few settings */
  const KV_KEYS = ['notes', 'noteFolders', 'noteSort', 'stickies', 'journal', 'calendar', 'reminders', 'remLists', 'alarms', 'contacts',
    'decks', 'fcStreak', 'bookmarks', 'browserShortcuts', 'photoAlbums', 'photoFavs', 'musicPlaylists', 'radioFavs', 'ytLibrary', 'newsSaved',
    'newsFeed', 'booksLib', 'booksPrefs', 'clockCities', 'weatherPlaces', 'weatherPlace', 'weatherUnit', 'termAlias', 'termVars', 'fileTags',
    'focusCfg', 'focusHistory', 'boards', 'patApps', 'patAppData', 'linkRoom', 'searchEngine', 'translatePrefs', 'solStats', 'sudokuBest', 'typingBest', 'orbBest', 'gamesBest', 'tttScore'];
  const SETTING_KEYS = ['userName', 'theme', 'accent', 'wallpaper', 'dockSize', 'magnify', 'magnifyScale', 'dockAutohide', 'dockPinned', 'mobileDock',
    'hiddenApps', 'language', 'clock24', 'showSeconds', 'uiSounds', 'volume', 'reduceMotion', 'highContrast', 'boldText', 'showFocus', 'bigTargets',
    'reduceTransparency', 'liquidGlass', 'glassStyle', 'motion', 'showWidgets', 'reopenWindows'];
  const FILE_CAP = 9 * 1024 * 1024; // a file bigger than this stays where it is
  const BATCH_BYTES = 6 * 1024 * 1024, BATCH_COUNT = 150;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  /* ---------- small helpers ---------- */
  function b64(buf) { const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  function unb64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function cyrb(str) { // a fast 53-bit hash, only to notice that something changed (not for security)
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ':' + str.length;
  }

  /* ---------- the sync code ---------- */
  function check2(chars) { let n = 0; for (let i = 0; i < chars.length; i++) n = (n * 31 + ALPHA.indexOf(chars[i]) + 1) % 1024; return ALPHA[n >> 5] + ALPHA[n & 31]; }
  function keyToCode(bytes) {
    let bits = '', out = ''; for (const b of bytes) bits += b.toString(2).padStart(8, '0');
    bits = bits.padEnd(130, '0'); for (let i = 0; i < 130; i += 5) out += ALPHA[parseInt(bits.slice(i, i + 5), 2)];
    out += check2(out); return out.match(/.{4}/g).join('-');
  }
  function codeToKey(code) {
    const c = String(code || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (c.length !== 28 || /[^0-9A-HJKMNP-TV-Z]/.test(c)) return null;
    if (check2(c.slice(0, 26)) !== c.slice(26)) return null;
    let bits = ''; for (let i = 0; i < 26; i++) bits += ALPHA.indexOf(c[i]).toString(2).padStart(5, '0');
    if (/1/.test(bits.slice(128))) return null;
    const out = new Uint8Array(16); for (let i = 0; i < 16; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    return out;
  }

  /* ---------- keys and encryption ---------- */
  let S = null; // { uid, token, aes, mac }  (null while Sync is off)
  async function derive(raw) {
    const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveBits']);
    const bits = async (info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('patos-sync-v1'), info: enc.encode(info) }, base, n * 8));
    return {
      uid: b64url(await bits('uid', 24)), token: b64url(await bits('token', 32)),
      aes: await crypto.subtle.importKey('raw', await bits('enc', 32), 'AES-GCM', false, ['encrypt', 'decrypt']),
      mac: await crypto.subtle.importKey('raw', await bits('rid', 32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    };
  }
  const ridCache = new Map();
  function ridOf(id) {
    let p = ridCache.get(id);
    if (!p) { p = crypto.subtle.sign('HMAC', S.mac, enc.encode(id)).then(b64url); ridCache.set(id, p); }
    return p;
  }
  async function seal(obj, rid) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(rid) }, S.aes, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), data: b64(ct) };
  }
  async function open(rec) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv), additionalData: enc.encode(rec.rid) }, S.aes, unb64(rec.data));
    return JSON.parse(dec.decode(pt));
  }

  /* ---------- state, kept on this device (never sent anywhere) ---------- */
  let state = null; // { rev, epoch, recs: { rid: { id, t, h, pushed, del } }, touch: { key: ms }, last, error, rejected, bad, hold }
  const blank = () => ({ rev: 0, epoch: '', recs: {}, touch: {}, last: 0, error: '', rejected: 0, bad: 0, hold: 0, mode, who: '' });
  const persist = PatOS.debounce(() => { if (state) PatOS.store.set('syncState', state); }, 1500);
  let status = 'off', lastCounts = { items: 0, excluded: 0 };
  function setStatus(s) { status = s; PatOS.emit('sync', api.status()); }

  /* ---------- what is on this device ---------- */
  /* With a PatOS account, everything that belongs to the person follows them (all saved lists, the files, the settings); only what
     is about this one device, a copy that is made again by itself, or a secret stays. With a sync code, only the list above. */
  let mode = 'code'; // 'code' (a sync code and the PatOS server) or 'account' (a PatOS account in the cloud)
  const DENY = new Set(['fs', 'fsCleaned2', 'snapIndex', 'backupInfo', 'syncState', 'syncKey', 'syncServer', 'linkState', 'accountInfo', 'accountKey', 'systemUid', 'verifiedUids', 'annSeen', 'fsDamaged', 'intelHistory', 'accountPrompt', 'accountSeen', 'msgRead', 'patAppGrants', 'privacyLog',
    'setupStep', 'setupDone', 'setupBack', 'installOffered', 'iosHint', 'notifAsked', 'appInstalled', 'alarmQueue',
    'timeline', 'timelineMoments', 'clipHistory', 'timelinePause', 'handoffDevice', 'handoffSeen',
    'wpCache', 'wpLockCache', 'wpThumbs', 'wxCache', 'dictCache', 'googleCx', 'patosServer', 'ytKey', 'pwVault', 'musicState', 'settings']);
  const DENY_PREFIX = ['newsCache:', 'ytHome:'];
  const denied = (k) => DENY.has(k) || DENY_PREFIX.some((x) => k.indexOf(x) === 0);
  // (handoff:<device> is what each device was just doing, for Handoff in js/handoff.js: it travels with a sync code too)
  const isHandoff = (k) => typeof k === 'string' && k.indexOf('handoff:') === 0;
  const isKV = (k) => (mode === 'account' ? !denied(k) : KV_KEYS.indexOf(k) >= 0 || isHandoff(k));
  const kvKeys = () => (mode === 'account' ? PatOS.store.keys().filter((k) => !denied(k)) : KV_KEYS.concat(PatOS.store.keys().filter(isHandoff)));
  /* a PatOS account takes every setting (dock, desktop icon places, wallpaper, theme...) except the lock password and what depends on this device's screen and graphics */
  const DEVICE_SETTINGS = new Set(['password', 'deviceMode', 'betaUpdates', 'quality3d', 'live3d']);
  const settingKeys = () => (mode === 'account' ? Object.keys(PatOS.settings).filter((k) => !DEVICE_SETTINGS.has(k)) : SETTING_KEYS);
  const settingOk = (k) => (mode === 'account' ? !DEVICE_SETTINGS.has(k) : SETTING_KEYS.indexOf(k) >= 0);
  const pickSettings = () => { const o = {}; settingKeys().forEach((k) => { if (PatOS.settings[k] !== undefined) o[k] = PatOS.settings[k]; }); return o; };
  const fileHash = (c, m, o) => cyrb(c + '\0' + (m || '') + '\0' + (o || ''));
  const fcache = new Map(); // path -> { m, n, mime, origin, h }
  function fileInfo(path, n) {
    const c = typeof n.content === 'string' ? n.content : String(n.content == null ? '' : n.content);
    const hit = fcache.get(path);
    if (hit && hit.m === n.mtime && hit.n === c.length && hit.mime === n.mime && hit.origin === n.origin) return hit.h;
    const h = fileHash(c, n.mime, n.origin); fcache.set(path, { m: n.mtime, n: c.length, mime: n.mime, origin: n.origin, h }); return h;
  }
  /* the item for an id: { h, t } when it exists here, 'big' when it exists but stays on this device, else null */
  function localItem(id) {
    const kind = id[0], rest = id.slice(2);
    if (kind === 'k') { const v = PatOS.store.peek(rest); if (v === undefined) return null; return { h: cyrb(JSON.stringify(v)), t: state.touch[rest] || Date.now() }; }
    if (kind === 's') return { h: cyrb(JSON.stringify(pickSettings())), t: state.touch.settings || Date.now() };
    const n = PatOS.fs.get(rest); if (!n) return null;
    if (kind === 'd') return n.type === 'dir' ? { h: 'dir', t: n.mtime || 0 } : null;
    if (n.type !== 'file') return null;
    if (n.blob || (typeof n.content === 'string' && n.content.length > FILE_CAP)) return 'big';
    return { h: fileInfo(rest, n), t: n.mtime || 0 };
  }
  /* every item on this device: Map rid -> { id, h, t }, and the ones that stay here */
  async function scan() {
    const items = new Map(), big = new Set(); const ids = [];
    kvKeys().forEach((k) => { if (PatOS.store.peek(k) !== undefined) ids.push('k:' + k); });
    ids.push('s:');
    (function walk(node, path) {
      Object.keys(node.children || {}).forEach((name) => {
        const p = path === '/' ? '/' + name : path + '/' + name, n = node.children[name];
        if (p === '/System') return;  // each device has its own system folder (js/firmware.js); it never syncs
        if (n.type === 'dir') { ids.push('d:' + p); walk(n, p); } else ids.push('f:' + p);
      });
    })(PatOS.fs.get('/'), '/');
    for (const id of ids) {
      const it = localItem(id); const rid = await ridOf(id);
      if (it === 'big') big.add(rid); else if (it) items.set(rid, { id, h: it.h, t: it.t });
    }
    lastCounts = { items: items.size, excluded: big.size };
    return { items, big };
  }

  /* ---------- putting a received item onto this device ---------- */
  let applying = false;
  function mkdirp(path) {
    let cur = '';
    for (const part of path.split('/').filter(Boolean)) {
      cur += '/' + part; const n = PatOS.fs.get(cur);
      if (!n) PatOS.fs.mkdir(cur); else if (n.type !== 'dir') return false;
    }
    return true;
  }
  function applyItem(p, t) {
    if (typeof p.path === 'string' && PatOS.fs.isSystem && PatOS.fs.isSystem(p.path)) return null;
    if (p.k === 'kv' && isKV(p.key)) { PatOS.store.set(p.key, p.value); return 'k:' + p.key; }
    if (p.k === 'set' && p.value && typeof p.value === 'object') {
      Object.keys(p.value).forEach((k) => { if (settingOk(k) && JSON.stringify(PatOS.settings[k]) !== JSON.stringify(p.value[k])) PatOS.setSetting(k, p.value[k]); });
      return 's:';
    }
    if (p.k === 'dir' && typeof p.path === 'string' && p.path[0] === '/') { return mkdirp(p.path) ? 'd:' + p.path : null; }
    if (p.k === 'file' && typeof p.path === 'string' && p.path[0] === '/' && typeof p.content === 'string') {
      const path = PatOS.fs.norm(p.path); if (path === '/') return null;
      if (!mkdirp(PatOS.fs.dirname(path))) return null;
      const ex = PatOS.fs.get(path); if (ex && ex.type === 'dir') return null;
      const extra = {}; if (p.mime) extra.mime = String(p.mime); if (p.origin) extra.origin = String(p.origin);
      PatOS.fs.write(path, p.content, extra);
      const n = PatOS.fs.get(path); if (n) n.mtime = t;
      return 'f:' + path;
    }
    return null;
  }
  function dropItem(id) {
    const kind = id[0], rest = id.slice(2);
    if (kind === 'k') { if (denied(rest)) return null; PatOS.store.remove(rest); } // (3.2.1: a device-only key is never deleted by another device)
    else if (kind === 'f') { if (PatOS.fs.isSystem && PatOS.fs.isSystem(rest)) return null; const n = PatOS.fs.get(rest); if (n && n.type === 'file') PatOS.fs.remove(rest, true); }
    else if (kind === 'd') return 'dir';
    return null;
  }

  /* ---------- talking to the server ---------- */
  /* normally this same site; or another PatOS server you choose (a new Railway, while this copy of PatOS is still the old one) */
  function base() { const v = String(PatOS.store.get('syncServer', '') || '').trim().replace(/\/+$/, ''); return /^https?:\/\/[^\s/]+$/i.test(v) ? v : ''; }
  async function call(method, route, body) {
    const res = await fetch(base() + '/api/sync/' + route, { method, cache: 'no-store', headers: Object.assign({ 'X-Patos-Uid': S.uid, Authorization: 'Bearer ' + S.token }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok) throw Object.assign(new Error((j && j.error) || 'HTTP ' + res.status), { status: res.status });
    return j;
  }
  /* where the items go: the PatOS server (a sync code) or the cloud account (set by js/account.js) */
  let acct = null; // { uid, register(), pull(since), push(records), wipe() } while a PatOS account is used
  const W = {
    register: () => (mode === 'account' ? acct.register() : call('POST', 'register')),
    pull: (since) => (mode === 'account' ? acct.pull(since) : call('GET', 'pull?since=' + since)),
    push: (records) => (mode === 'account' ? acct.push(records) : call('POST', 'push', { records })),
    wipe: () => (mode === 'account' ? acct.wipe() : call('DELETE', 'account'))
  };
  /* a new or emptied server: remember nothing was sent there, so everything goes again */
  function newServer(epoch) {
    if (state.epoch) Object.keys(state.recs).forEach((k) => { const r = state.recs[k]; if (r.del) delete state.recs[k]; else r.pushed = false; });
    state.epoch = epoch; state.rev = 0; persist();
  }
  async function ensureAccount() {
    const reg = await W.register();
    if (state.epoch !== reg.epoch) newServer(reg.epoch);
  }

  /* ---------- receiving ---------- */
  async function receive(rec, local, deferred) {
    const r = state.recs[rec.rid];
    if (r && rec.t <= r.t) return; // we have this version, or a newer one
    const here = local.items.get(rec.rid);
    const changed = here && (!r || r.h !== here.h); // edited here since it was last in sync (or never in sync)
    if (rec.deleted) {
      const id = (here && here.id) || (r && r.id); if (!id) return;
      if (!here) { state.recs[rec.rid] = { id, t: rec.t, h: null, pushed: true, del: true }; return; }
      if (changed && r && here.t > rec.t) return; // we changed it after it was deleted elsewhere: keep ours
      if (dropItem(id) === 'dir') deferred.push({ id, rid: rec.rid, t: rec.t });
      else { state.recs[rec.rid] = { id, t: rec.t, h: null, pushed: true, del: true }; local.items.delete(rec.rid); }
      return;
    }
    let p; try { p = await open(rec); } catch (e) { state.bad++; return; }
    const id = p.k === 'kv' ? 'k:' + p.key : p.k === 'set' ? 's:' : p.k === 'dir' ? 'd:' + p.path : p.k === 'file' ? 'f:' + p.path : null;
    if (!id || (await ridOf(id)) !== rec.rid) { state.bad++; return; }
    if (changed && r && here.t > rec.t) return; // we edited it later: ours wins and goes out below
    const done = applyItem(p, rec.t); if (!done) return;
    const now = localItem(done); // what it looks like here now (settings can differ in what they carry)
    state.recs[rec.rid] = { id, t: rec.t, h: now && now !== 'big' ? now.h : null, pushed: true };
    if (now && now !== 'big') local.items.set(rec.rid, { id, h: now.h, t: rec.t });
  }
  async function pull(local) {
    const deferred = []; let guard = 0;
    for (;;) {
      if (++guard > 500) break;
      const r = await W.pull(state.rev);
      if (r.epoch !== state.epoch) { newServer(r.epoch); continue; }
      applying = true;
      try { for (const rec of r.records) await receive(rec, local, deferred); } finally { applying = false; }
      state.rev = r.rev; persist();
      if (!r.more) break;
    }
    applying = true;
    try { // folders that were deleted elsewhere, deepest first, only when nothing is left inside
      deferred.sort((a, b) => b.id.length - a.id.length).forEach((d) => {
        const p = d.id.slice(2), n = PatOS.fs.get(p);
        if (n && n.type === 'dir' && !Object.keys(n.children).length) { try { PatOS.fs.remove(p, true); state.recs[d.rid] = { id: d.id, t: d.t, h: null, pushed: true, del: true }; } catch (e) {} }
      });
    } finally { applying = false; }
  }

  /* ---------- sending ---------- */
  function payloadOf(id) {
    const kind = id[0], rest = id.slice(2);
    if (kind === 'k') return { k: 'kv', key: rest, value: PatOS.store.peek(rest) };
    if (kind === 's') return { k: 'set', value: pickSettings() };
    if (kind === 'd') return { k: 'dir', path: rest };
    const n = PatOS.fs.get(rest); const o = { k: 'file', path: rest, content: n.content };
    if (n.mime) o.mime = n.mime;
    if (n.origin) o.origin = n.origin;
    return o;
  }
  async function push(local, force) {
    const out = [];
    local.items.forEach((it, rid) => {
      const r = state.recs[rid];
      if (!r || r.del || r.h !== it.h) out.push({ rid, id: it.id, h: it.h, t: r ? Math.max(it.t, r.t + 1) : it.t });
      else if (!r.pushed) out.push({ rid, id: it.id, h: it.h, t: r.t });
    });
    const dels = [];
    Object.keys(state.recs).forEach((rid) => { const r = state.recs[rid]; if (r.id && r.id[0] === 'k' && denied(r.id.slice(2))) return; // (3.2.1)
      if (!r.del && !local.items.has(rid) && !local.big.has(rid)) dels.push({ rid, id: r.id, h: null, del: true, t: Math.max(Date.now(), r.t + 1) }); });
    const live = Object.values(state.recs).filter((r) => !r.del).length;
    state.hold = 0;
    if (dels.length > 20 && dels.length > live / 2 && !force) { state.hold = dels.length; dels.length = 0; } // most things vanished at once: ask first
    const all = out.concat(dels); let skipped = 0;
    for (let i = 0; i < all.length;) {
      const batch = []; let bytes = 0;
      while (i < all.length && batch.length < BATCH_COUNT && (bytes < BATCH_BYTES || !batch.length)) {
        const it = all[i++]; let rec;
        if (it.del) rec = { rid: it.rid, t: it.t, deleted: true };
        else { const body = await seal(payloadOf(it.id), it.rid); rec = { rid: it.rid, t: it.t, iv: body.iv, data: body.data }; bytes += body.data.length; }
        batch.push({ it, rec });
      }
      const res = await W.push(batch.map((b) => b.rec));
      if (res.epoch !== state.epoch) { newServer(res.epoch); throw Object.assign(new Error('server changed'), { again: true }); }
      batch.forEach((b) => { state.recs[b.it.rid] = { id: b.it.id, t: b.it.t, h: b.it.h, pushed: true, del: !!b.it.del }; });
      skipped += res.skipped || 0; if (res.rejected) state.rejected += res.rejected;
      if (res.rev != null && res.rev - res.applied === state.rev) state.rev = res.rev; // nobody else wrote in between: no need to read our own changes back
      persist();
    }
    // forget deletions older than 90 days (the server does the same)
    const cut = Date.now() - 90 * 86400000; Object.keys(state.recs).forEach((k) => { const r = state.recs[k]; if (r.del && r.t < cut) delete state.recs[k]; });
    return { skipped, sent: all.length };
  }

  /* ---------- one round ---------- */
  let running = null, queued = false, forceNext = false;
  async function cycle(opts) {
    if (!S || !state) return null;
    if (opts && opts.force) forceNext = true;
    if (running) { queued = true; return running; }
    running = (async () => {
      setStatus('syncing');
      try {
        for (let pass = 0; pass < 3; pass++) {
          await ensureAccount();
          let local = await scan();
          await pull(local);
          local = await scan();
          const force = forceNext; forceNext = false;
          const r = await push(local, force);
          if (!r.skipped) break;
        }
        state.last = Date.now(); state.error = '';
        setStatus('idle');
      } catch (e) {
        applying = false;
        if (e && e.again) { queued = true; setStatus('idle'); }
        else if (e && e.status === 403) { state.error = 'key'; setStatus('error'); }
        else if (e && e.status === 507) { state.error = 'full'; setStatus('error'); }
        else if (e && e.status === 429) { state.error = 'busy'; setStatus('error'); }
        else if (e && e.status >= 400) { state.error = 'server'; setStatus('error'); }
        else { state.error = 'offline'; setStatus('offline'); } // no network (or the server is asleep): try again later
      } finally { running = null; persist(); if (queued) { queued = false; kick(); } }
    })();
    return running;
  }
  const kick = PatOS.debounce(() => { if (S && navigator.onLine !== false) cycle(); }, 4000);
  const kickSlow = PatOS.debounce(() => { if (S && navigator.onLine !== false) cycle(); }, 30000); // open windows and the like change all the time

  /* ---------- start / stop ---------- */
  async function start(raw) {
    S = await derive(raw); ridCache.clear(); fcache.clear();
    loadState();
    setStatus('idle');
  }
  /* the bookkeeping belongs to one way of syncing and one person/code: another one starts clean (everything is sent again) */
  function loadState() {
    const who = mode === 'account' ? 'acct:' + acct.uid : 'code:' + S.uid;
    const old = PatOS.store.get('syncState', {});
    state = Object.assign(blank(), old && (old.who === who || (!old.who && mode === 'code')) ? old : {});
    state.mode = mode; state.who = who; if (!state.recs) state.recs = {}; if (!state.touch) state.touch = {};
  }
  const noCrypto = () => !(window.crypto && crypto.subtle && window.TextEncoder);
  const api = {
    available: () => !noCrypto(),
    on: () => !!S,
    code() { const k = PatOS.store.get('syncKey', null); if (!k) return ''; try { return keyToCode(unb64(k)); } catch (e) { return ''; } },
    async enable() {
      if (S) return api.code();
      if (noCrypto()) throw new Error('This browser cannot do encryption here');
      const raw = crypto.getRandomValues(new Uint8Array(16));
      PatOS.store.set('syncKey', b64(raw)); PatOS.store.remove('syncState');
      await start(raw); cycle(); return api.code();
    },
    async join(code) {
      if (noCrypto()) throw new Error('This browser cannot do encryption here');
      const raw = codeToKey(code); if (!raw) throw new Error('That code is not right. Check it and try again.');
      if (S) throw new Error('Sync is already on');
      try { if (PatOS.backup) await PatOS.backup.snapshot(T('Before joining Sync'), 'before'); } catch (e) {}
      PatOS.store.set('syncKey', b64(raw)); PatOS.store.remove('syncState');
      await start(raw);
      await cycle();
      return status;
    },
    async disable(wipeServer) {
      let failed = false;
      if (wipeServer && S) { try { await W.wipe(); } catch (e) { failed = true; } }
      S = null; state = null; ridCache.clear(); fcache.clear();
      PatOS.store.remove('syncKey'); PatOS.store.remove('syncState');
      setStatus('off'); return { failed };
    },
    /* a new code (lost it, shared it by mistake, or the server is gone for good): this device keeps everything and
       starts a new account under a new key. Other devices join again with the new code. */
    async regenerate() {
      if (!S) throw new Error('Sync is off');
      if (noCrypto()) throw new Error('This browser cannot do encryption here');
      try { await call('DELETE', 'account'); } catch (e) { /* the old server may be gone already */ }
      const raw = crypto.getRandomValues(new Uint8Array(16));
      PatOS.store.set('syncKey', b64(raw)); PatOS.store.remove('syncState');
      await start(raw); await cycle(); return api.code();
    },
    mode: () => mode,
    /* signed in to a PatOS account: from now on Sync saves to the account (key = made from the password), see js/account.js */
    async useAccount(raw, transport) {
      mode = 'account'; acct = transport; S = await derive(raw); ridCache.clear(); fcache.clear(); loadState(); setStatus('idle'); persist(); cycle(); // (it runs in the background: the caller does not wait for the whole upload)
    },
    /* signed out: back to a sync code if there is one, else Sync is off */
    async clearAccount() {
      acct = null; mode = 'code'; ridCache.clear(); fcache.clear();
      const k = PatOS.store.get('syncKey', null);
      if (k) { try { await start(unb64(k)); } catch (e) { S = null; state = null; setStatus('off'); } } else { S = null; state = null; setStatus('off'); }
    },
    now: (opts) => cycle(opts),
    server_url: () => base(),
    /* point this device at another PatOS server; it fills the new one with everything it has */
    setServer(url) {
      url = String(url || '').trim().replace(/\/+$/, '');
      if (url && !/^https?:\/\/[^\s/]+$/i.test(url)) throw new Error('That is not a web address. Use something like https://my-patos.up.railway.app');
      if (url) PatOS.store.set('syncServer', url); else PatOS.store.remove('syncServer');
      return S ? cycle() : null;
    },
    /* send everything again (for example after the server said it was full) */
    resend() { if (!state) return null; Object.keys(state.recs).forEach((k) => { state.recs[k].pushed = false; }); state.rejected = 0; persist(); return cycle(); },
    async server() { if (!S) return null; try { return await call('GET', 'status'); } catch (e) { return null; } },
    status() {
      return { on: !!S, mode, state: status, last: state ? state.last : 0, error: state ? state.error : '', rejected: state ? state.rejected : 0, bad: state ? state.bad : 0,
        hold: state ? state.hold : 0, items: lastCounts.items, stay: lastCounts.excluded, offline: navigator.onLine === false };
    },
    _codeToKey: codeToKey, _keyToCode: keyToCode
  };
  PatOS.sync = api;

  /* ---------- when to sync ---------- */
  function touch(key) { if (!state) return; state.touch[key] = Date.now(); persist(); }
  const CHATTY = new Set(['sessions', 'frameMem', 'browserSession', 'browserRestore', 'autoAppWindow']);
  PatOS.on('store:set', (k) => { if (!S || applying) return; if (isKV(k)) { touch(k); (CHATTY.has(k) ? kickSlow : kick)(); } else if (k === 'settings') { touch('settings'); kick(); } });
  PatOS.on('fs', () => { if (S && !applying) kick(); });
  addEventListener('online', () => { if (S) kick(); });
  document.addEventListener('visibilitychange', () => { if (S && !document.hidden) kick(); });
  setInterval(() => { if (S && !document.hidden && navigator.onLine !== false) cycle(); }, 3 * 60 * 1000);

  const saved = PatOS.store.get('syncKey', null);
  if (saved && !noCrypto() && !PatOS.store.get('accountInfo', null)) {
    try { start(unb64(saved)).then(() => setTimeout(() => { if (navigator.onLine !== false) cycle(); }, 15000)); } catch (e) {}
  }
})();
