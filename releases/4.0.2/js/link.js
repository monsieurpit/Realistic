/* PatLink: your PatOS talks to your friend's PatOS (and to your own other devices).
   Messages, files, links, clipboard text and apps go straight into each other's PatDrop, without anyone logging in.
   - You share a code (28 characters, like Sync's). Everyone who has it is in the same room. Make a new room to start over.
   - Everything is encrypted on the device before it leaves (AES-GCM); the server (link-server.js) holds only scrambled
     bytes in a room it can't read. Items older than 30 days are forgotten by the server; each device keeps what it received.
   - Offline-first: what you send waits in an outbox (saved on the device) and goes out when the internet is back.
   - Files that arrive are saved in Downloads › PatDrop. Apps that arrive are only installed if you press Install.
   - The room's code also follows you between your own devices with Sync, so your phone joins by itself. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const KEEP_ITEMS = 300, MAX_PAYLOAD = 9.5e6;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => { const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const noCrypto = () => !(window.crypto && crypto.subtle && window.TextEncoder);

  let K = null; // { uid, token, aes } while linked
  let st = null; // { since, epoch, outbox: [{id,t,iv,data,feedId}], feed: [], device: {id} }
  let state = 'off', polling = false, flushing = false, lastOk = 0, backoff = 0, started = false;
  const room = () => PatOS.store.get('linkRoom', null);
  const emit = () => PatOS.emit('link', api.status());
  const save = () => { if (st) PatOS.store.set('linkState', st); }; // the store itself writes to disk a moment later, and when the page closes
  const setState = (s) => { state = s; emit(); };

  async function derive(raw) {
    const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveBits']);
    const bits = async (info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('patos-link-v1'), info: enc.encode(info) }, base, n * 8));
    return { uid: b64url(await bits('room', 24)), token: b64url(await bits('token', 32)), aes: await crypto.subtle.importKey('raw', await bits('enc', 32), 'AES-GCM', false, ['encrypt', 'decrypt']) };
  }
  async function seal(obj, id) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(id) }, K.aes, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), data: b64(ct) };
  }
  async function open(rec) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv), additionalData: enc.encode(rec.id) }, K.aes, unb64(rec.data));
    return JSON.parse(dec.decode(pt));
  }
  async function call(method, route, body) {
    const res = await fetch('/api/link/' + route, { method, cache: 'no-store', headers: Object.assign({ 'X-Patos-Uid': K.uid, Authorization: 'Bearer ' + K.token }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok) throw Object.assign(new Error((j && j.error) || 'HTTP ' + res.status), { status: res.status });
    return j;
  }
  /* the room is made on first use (and again if the server forgot it) */
  async function ensureRoom() {
    const r = await call('POST', 'register');
    if (st.epoch !== r.epoch) { st.since = 0; st.epoch = r.epoch; save(); } // a new server or room: read from the start
    return r;
  }
  const deviceName = () => { try { return PatOS.extApps ? PatOS.extApps.device().name : 'PatOS'; } catch (e) { return 'PatOS'; } };
  const me = () => ({ id: st.device.id, name: String(PatOS.settings.userName || 'Pat').slice(0, 30), device: deviceName() });

  /* ---------- sending ---------- */
  async function queue(payload, feedExtra) {
    if (!K) throw new Error(T('PatDrop is not linked yet.'));
    const id = b64url(crypto.getRandomValues(new Uint8Array(16))); const t = Date.now();
    const body = Object.assign({}, payload, { from: me(), t });
    if (JSON.stringify(body).length > MAX_PAYLOAD) throw new Error(T('That is too big to send (the limit is about 7 MB).'));
    const sealed = await seal(body, id);
    st.outbox.push({ id, t, iv: sealed.iv, data: sealed.data });
    addFeed(Object.assign({ id, t, from: me(), mine: true, k: payload.k, status: 'sending' }, feedExtra || {}));
    save(); emit(); flush();
    return id;
  }
  function addFeed(item) {
    if (st.feed.some((x) => x.id === item.id)) return false;
    st.feed.push(item); st.feed.sort((a, b) => a.t - b.t);
    while (st.feed.length > KEEP_ITEMS) st.feed.shift();
    return true;
  }
  let flushP = null, pollP = null;
  function flush() { if (flushP) return flushP; flushP = doFlush().finally(() => { flushP = null; }); return flushP; }
  function poll() { if (pollP) return pollP; pollP = doPoll().finally(() => { pollP = null; }); return pollP; }
  async function doFlush() {
    if (!K || !st.outbox.length) return;
    if (navigator.onLine === false) return setState('offline');
    flushing = true;
    try {
      await ensureRoom();
      while (st.outbox.length) {
        const batch = []; let bytes = 0;
        for (const o of st.outbox) { if (batch.length && bytes + o.data.length > 10e6) break; batch.push(o); bytes += o.data.length; if (batch.length >= 20) break; }
        const r = await call('POST', 'send', { items: batch.map((o) => ({ id: o.id, t: o.t, iv: o.iv, data: o.data })) });
        const done = new Set(batch.map((o) => o.id));
        st.outbox = st.outbox.filter((o) => !done.has(o.id));
        const refused = r.rejected && !(r.applied + r.duplicate); // the server took nothing: it did not like these
        st.feed.forEach((x) => { if (done.has(x.id)) x.status = refused ? 'failed' : 'sent'; });
        save(); emit();
      }
      lastOk = Date.now(); backoff = 0; setState('idle');
    } catch (e) { fail(e); } finally { flushing = false; }
  }
  function fail(e) {
    if (e && e.status === 403) setState('key');
    else if (e && e.status === 507) setState('full');
    else if (e && e.status >= 400 && e.status !== 429) setState('error');
    else setState('offline');
    backoff = Math.min(60000, (backoff || 5000) * 2); // what is waiting stays in the outbox and goes out later
    emit();
  }

  /* ---------- receiving ---------- */
  const safeName = (n) => String(n || 'file').replace(/[\/\\\u0000-\u001f]/g, '_').replace(/^\.+/, '_').slice(0, 80) || 'file';
  function mkdirs(p) { let cur = ''; p.split('/').filter(Boolean).forEach((x) => { cur += '/' + x; if (!PatOS.fs.exists(cur)) PatOS.fs.mkdir(cur); }); }
  async function saveFile(p) {
    const dir = '/Downloads/PatDrop'; mkdirs(dir); const name = PatOS.fs.uniqueName(dir, safeName(p.name)); const path = dir + '/' + name;
    if (p.enc === 'data' && typeof p.content === 'string' && /^data:/.test(p.content)) {
      if (p.content.length > 3 * 1024 * 1024 && PatOS.fs.writeBlob) { const blob = await (await fetch(p.content)).blob(); await PatOS.fs.writeBlob(path, blob); }
      else PatOS.fs.write(path, p.content, p.mime ? { mime: String(p.mime).slice(0, 80) } : undefined);
    } else PatOS.fs.write(path, String(p.content == null ? '' : p.content));
    return path;
  }
  async function receive(rec, quiet) {
    if (st.feed.some((x) => x.id === rec.id)) return; // our own item coming back, or one we already have
    let p; try { p = await open(rec); } catch (e) { return; }
    const from = p.from && typeof p.from === 'object' ? { id: String(p.from.id || '').slice(0, 40), name: String(p.from.name || '?').slice(0, 30), device: String(p.from.device || '').slice(0, 30) } : { id: '', name: '?', device: '' };
    const base = { id: rec.id, t: Number(p.t) || rec.t, from, mine: from.id === st.device.id, k: p.k, status: 'sent', seen: !!quiet };
    let item = null, preview = '';
    if (p.k === 'text' && typeof p.text === 'string') { item = Object.assign(base, { text: p.text.slice(0, 5000) }); preview = item.text; }
    else if (p.k === 'clip' && typeof p.text === 'string') { item = Object.assign(base, { text: p.text.slice(0, 100000) }); preview = T('Clipboard') + ': ' + item.text.slice(0, 60); }
    else if (p.k === 'link' && /^https?:\/\/\S+$/i.test(String(p.url || ''))) { item = Object.assign(base, { url: String(p.url).slice(0, 2000) }); preview = item.url; }
    else if (p.k === 'file' && typeof p.name === 'string') {
      if (base.mine) item = Object.assign(base, { name: safeName(p.name), size: +p.size || 0, mime: String(p.mime || '').slice(0, 80) }); // sent from another of my devices: not saved again
      else { try { const path = await saveFile(p); item = Object.assign(base, { name: safeName(p.name), size: +p.size || 0, mime: String(p.mime || '').slice(0, 80), path }); preview = T('File') + ': ' + item.name; } catch (e) { item = Object.assign(base, { name: safeName(p.name), size: +p.size || 0, failed: true }); } }
    } else if (p.k === 'app' && window.PatAppFormat) {
      const v = PatAppFormat.validate(p.app); if (v.ok) { item = Object.assign(base, { app: v.app }); preview = T('App') + ': ' + v.app.name; }
    }
    if (!item) return;
    if (!addFeed(item)) return;
    if (!item.mine && !quiet) { try { PatOS.notify({ title: from.name, body: preview.slice(0, 120), icon: 'patdrop', onClick: () => PatOS.launch('patdrop') }); PatOS.sound && PatOS.sound.pop && PatOS.sound.pop(); } catch (e) {} }
  }
  async function doPoll() {
    if (!K) return;
    if (navigator.onLine === false) return setState('offline');
    polling = true;
    try {
      await ensureRoom(); const first = !st.synced; let guard = 0; // the very first read of a room is quiet: old messages are not news
      for (;;) {
        if (++guard > 100) break;
        const r = await call('GET', 'poll?since=' + st.since);
        if (r.epoch !== st.epoch) { st.epoch = r.epoch; st.since = 0; continue; }
        for (const rec of r.items) await receive(rec, first);
        st.since = r.rev; save(); emit();
        if (!r.more) break;
      }
      st.synced = true; save(); lastOk = Date.now(); backoff = 0; if (state !== 'idle') setState('idle'); else emit();
    } catch (e) { fail(e); } finally { polling = false; }
  }

  /* ---------- starting and stopping ---------- */
  let startP = null;
  function start() { if (!startP) startP = begin().finally(() => { startP = null; }); return startP; }
  async function begin() {
    const r = room(); if (!r || !r.key || K || noCrypto()) return;
    try { K = await derive(unb64(r.key)); } catch (e) { return; }
    const old = PatOS.store.get('linkState', null);
    st = Object.assign({ since: 0, epoch: '', outbox: [], feed: [], device: { id: b64url(crypto.getRandomValues(new Uint8Array(12))) } }, old || {});
    if (!st.device || !st.device.id) st.device = { id: b64url(crypto.getRandomValues(new Uint8Array(12))) };
    if (!old) PatOS.store.set('linkState', st);
    setState('idle'); poll(); flush();
  }
  function stop() { K = null; st = null; setState('off'); }
  const api = {
    available: () => !noCrypto(),
    linked: () => !!K,
    code() { const r = room(); const f = PatOS.sync && PatOS.sync._keyToCode; if (!r || !f) return ''; try { return f(unb64(r.key)); } catch (e) { return ''; } },
    label: () => (room() || {}).label || '',
    setLabel(l) { const r = room(); if (!r) return; PatOS.store.set('linkRoom', Object.assign({}, r, { label: String(l || '').trim().slice(0, 40) })); emit(); },
    async create(label) {
      if (noCrypto()) throw new Error(T('This browser cannot do encryption here'));
      if (K) throw new Error(T('PatDrop is already linked.'));
      PatOS.store.remove('linkState'); PatOS.store.set('linkRoom', { key: b64(crypto.getRandomValues(new Uint8Array(16))), label: String(label || '').trim().slice(0, 40), created: Date.now() });
      await start(); return api.code();
    },
    async join(code, label) {
      if (noCrypto()) throw new Error(T('This browser cannot do encryption here'));
      const raw = PatOS.sync && PatOS.sync._codeToKey ? PatOS.sync._codeToKey(code) : null; if (!raw) throw new Error(T('That code is not right. Check it and try again.'));
      if (K) throw new Error(T('PatDrop is already linked.'));
      PatOS.store.remove('linkState'); PatOS.store.set('linkRoom', { key: b64(raw), label: String(label || '').trim().slice(0, 40), created: Date.now() });
      await start(); await poll(); return state;
    },
    async leave(wipe) {
      if (wipe && K) { try { await call('DELETE', 'room'); } catch (e) {} }
      PatOS.store.remove('linkRoom'); PatOS.store.remove('linkState'); stop();
    },
    feed: () => (st ? st.feed.slice() : []),
    unread: () => (st ? st.feed.filter((x) => !x.mine && !x.seen).length : 0),
    markSeen() { if (!st) return; let ch = false; st.feed.forEach((x) => { if (!x.seen) { x.seen = true; ch = true; } }); if (ch) { save(); emit(); } },
    now: async () => { await flush(); await poll(); },
    retry: () => flush(),
    clearHistory() { if (!st) return; st.feed = st.feed.filter((x) => st.outbox.some((o) => o.id === x.id)); save(); emit(); },
    sendText(text) { text = String(text || '').trim(); if (!text) return null; return queue({ k: 'text', text: text.slice(0, 5000) }, { text: text.slice(0, 5000) }); },
    sendLink(url) { url = String(url || '').trim(); if (!/^https?:\/\/\S+$/i.test(url)) throw new Error(T('Type a web address that starts with http:// or https://')); return queue({ k: 'link', url }, { url }); },
    async sendClipboard(text) {
      if (text == null) { try { text = await navigator.clipboard.readText(); } catch (e) { throw new Error(T('PatOS could not read your clipboard. Copy something first and allow it.')); } }
      text = String(text); if (!text.trim()) throw new Error(T('Your clipboard is empty.'));
      return queue({ k: 'clip', text: text.slice(0, 100000) }, { text: text.slice(0, 100000) });
    },
    async sendPath(path) {
      const n = PatOS.fs.get(path); if (!n || n.type !== 'file') throw new Error(T('That is not a file.'));
      let content, encoding = 'text', mime = n.mime || '', size = n.size || (n.content || '').length;
      if (n.blob) { if ((n.size || 0) > 7e6) throw new Error(T('That is too big to send (the limit is about 7 MB).')); const blob = await PatOS.fs.getBlob(path); content = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('read')); r.readAsDataURL(blob); }); encoding = 'data'; mime = mime || blob.type; size = blob.size; }
      else { content = String(n.content == null ? '' : n.content); if (/^data:/.test(content)) { encoding = 'data'; const m = content.match(/^data:([^;,]+)/); if (m && !mime) mime = m[1]; size = Math.round(content.length * 0.75); } }
      return queue({ k: 'file', name: PatOS.fs.basename(path), mime, size, enc: encoding, content }, { name: PatOS.fs.basename(path), size, mime, path });
    },
    async sendFile(file) { // a File from this computer (picked, or dropped)
      if (file.size > 7e6) throw new Error(T('That is too big to send (the limit is about 7 MB).') + ' (' + file.name + ')');
      const text = /^text\/|json|javascript|xml|csv/.test(file.type) || /\.(txt|md|js|css|html|json|csv|py|pit|pitx|pitoss|patapp)$/i.test(file.name);
      const content = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error(T('That file could not be read.'))); if (text) r.readAsText(file); else r.readAsDataURL(file); });
      return queue({ k: 'file', name: file.name, mime: file.type, size: file.size, enc: text ? 'text' : 'data', content }, { name: file.name, size: file.size, mime: file.type });
    },
    sendApp(app) { const v = window.PatAppFormat ? PatAppFormat.validate(app) : { ok: false, error: 'No app format.' }; if (!v.ok) throw new Error(T(v.error)); return queue({ k: 'app', app: v.app }, { app: v.app }); },
    status() { return { linked: !!K, state, outbox: st ? st.outbox.length : 0, last: lastOk, unread: api.unread(), label: api.label(), offline: navigator.onLine === false }; }
  };
  PatOS.link = api;

  /* ---------- when to look for new things ---------- */
  const open_ = () => PatOS.wm && PatOS.wm.windowsOf('patdrop').length > 0;
  setInterval(() => {
    if (!K) return;
    const every = open_() ? 5000 : document.hidden ? 60000 : 20000;
    if (Date.now() - (api._lastTry || 0) < Math.max(every, backoff)) return;
    api._lastTry = Date.now(); if (st.outbox.length) flush(); poll();
  }, 2500);
  addEventListener('online', () => { if (K) { backoff = 0; flush(); poll(); } });
  document.addEventListener('visibilitychange', () => { if (K && !document.hidden) { flush(); poll(); } });
  PatOS.on('store:set', (k) => { if (k !== 'linkRoom') return; const r = room(); if (r && !K) start(); else if (!r && K) stop(); });
  if (!started) { started = true; start(); }
})();
