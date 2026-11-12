/* PatOS Backups — so your data survives almost anything.
   - Snapshots: PatOS keeps a copy of your files and settings once a day (the last 7), and one before any restore.
     "Restore PatOS to how it was on Tuesday" brings everything back.
   - Backup file: Export saves everything in one .patos-backup file (optionally locked with a password), and
     Import puts it back, on this device or a new one. On an iPhone it goes to the Files app.
   - Auto-backup folder (Chrome on a computer or Chromebook): PatOS writes a backup into a folder you choose,
     every day. That folder is on the real disk, so it survives even if PatOS, the website or the browser's
     data is deleted.
   - It asks the browser to keep PatOS's storage safe from automatic clean-up.
   Snapshots don't contain big files (videos and very large pictures): those stay where they are. A backup
   file can include them when the total is not too big. Passwords are saved the way they are stored: a list
   protected only by this device's key can't be opened on another device, so add a master password. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const FORMAT = 'patos-backup', ENC = 'patos-backup-encrypted';
  const KEEP = { auto: 7, manual: 10, before: 3 };
  const FOLDER_CAP = 1024 * 1024 * 1024, FILES_DIR = 'PatOS-files'; // the folder keeps a full copy of big files, up to this much
  const BLOB_CAP = 150 * 1024 * 1024; // a backup file includes big files only up to this much in total
  const DAY = 86400000;
  const db = () => window.__IDB;
  const FOLDER_KEY = 'backup-dir', FOLDER_FILE = /^PatOS-backup-\d{4}-\d{2}-\d{2}\.patos-backup$/;

  /* ---------- the database, in small pieces ---------- */
  function idb(store, mode, fn) {
    return new Promise((res, rej) => {
      if (!db()) return rej(new Error('This browser has no storage database'));
      try { const tx = db().transaction(store, mode); let out; try { out = fn(tx.objectStore(store)); } catch (e) { return rej(e); } tx.oncomplete = () => res(out && 'result' in out ? out.result : out); tx.onerror = tx.onabort = () => rej(tx.error || new Error('storage error')); } catch (e) { rej(e); }
    });
  }
  const putSnap = (key, val) => idb('handles', 'readwrite', (s) => s.put(val, key));
  const getSnap = (key) => idb('handles', 'readonly', (s) => s.get(key));
  const delSnap = (key) => idb('handles', 'readwrite', (s) => s.delete(key));

  /* ---------- helpers ---------- */
  function count(tree) {
    const r = { files: 0, bytes: 0, blobFiles: 0, blobBytes: 0 };
    (function walk(n) { if (n.type === 'dir') { Object.values(n.children || {}).forEach(walk); return; } r.files++; if (n.blob) { r.blobFiles++; r.blobBytes += n.size || 0; } else r.bytes += (n.content || '').length; })(tree);
    return r;
  }
  const device = () => { const ua = navigator.userAgent; return PatOS.hw && PatOS.hw.iphone ? 'iPhone' : /CrOS/.test(ua) ? 'Chromebook' : PatOS.hw && PatOS.hw.android ? 'Android' : /Mac/.test(navigator.platform) ? 'Mac' : /Win/.test(navigator.platform) ? 'Windows' : 'Browser'; };
  const stamp = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const when = (t) => new Date(t).toLocaleString(PatOS.lang === 'fr' ? 'fr-CA' : undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const b64 = (u8) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(new Blob([u8])); });
  const unb64 = async (s) => new Uint8Array(await (await fetch('data:application/octet-stream;base64,' + s)).arrayBuffer());

  /* ---------- fingerprints: a backup knows what it should contain, so a damaged one is noticed ---------- */
  async function digest(state) {
    const text = JSON.stringify({ kv: state.kv, fs: state.fs }); // (big files can be left out of a backup on purpose, so they aren't part of it)
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function seal(state) { if (window.crypto && crypto.subtle) state.check = { alg: 'sha256', hash: await digest(state) }; return state; }
  /* 'ok' (fingerprint matches), 'unverified' (an older backup without one), or 'damaged' */
  async function verify(state) {
    if (!state || !state.fs || !state.kv) return 'damaged';
    if (!state.check || !state.check.hash) return 'unverified';
    try { return (await digest(state)) === state.check.hash ? 'ok' : 'damaged'; } catch (e) { return 'unverified'; }
  }

  /* ---------- making a backup of everything ---------- */
  async function collect(opts) {
    opts = opts || {};
    try { await PatOS.flush(); } catch (e) {}
    const tree = PatOS.fs.exportTree();
    const state = { format: FORMAT, version: 1, created: Date.now(), patos: PatOS.version, device: device(), kv: PatOS.store.backupData(), fs: tree };
    const c = count(tree); state.stats = { files: c.files, bytes: c.bytes, bigFiles: c.blobFiles, bigBytes: c.blobBytes };
    if (opts.blobs && c.blobFiles) {
      state.blobs = {}; let total = 0, skipped = 0;
      const ids = []; (function walk(n) { if (n.type === 'dir') Object.values(n.children).forEach(walk); else if (n.blob) ids.push([n.blob, n.size || 0]); })(tree);
      for (const [id, size] of ids) {
        if (total + size > BLOB_CAP) { skipped++; continue; }
        const blob = await idb('blobs', 'readonly', (s) => s.get(id)); if (!blob) { skipped++; continue; }
        state.blobs[id] = { type: blob.type, data: await b64(new Uint8Array(await blob.arrayBuffer())) }; total += size;
      }
      state.stats.bigIncluded = Object.keys(state.blobs).length; state.stats.bigSkipped = skipped;
    }
    return seal(state);
  }
  async function encrypt(obj, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    return { format: ENC, version: 1, created: obj.created, device: obj.device, salt: await b64(salt), iv: await b64(iv), data: await b64(data) };
  }
  async function decrypt(w, pass) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: await unb64(w.salt), iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: await unb64(w.iv) }, key, await unb64(w.data)))); }
    catch (e) { const err = new Error('wrong password'); err.wrongPassword = true; throw err; }
  }
  /* a backup file's contents → the backup (asks for the password through err.needPassword when it is locked) */
  async function parse(text, pass) {
    let j; try { j = JSON.parse(text); } catch (e) { throw new Error('This is not a PatOS backup'); }
    if (j && j.format === ENC) { if (!pass) { const err = new Error('password needed'); err.needPassword = true; throw err; } j = await decrypt(j, pass); }
    if (!j || j.format !== FORMAT || !j.fs || !j.kv) throw new Error('This is not a PatOS backup');
    const v = await verify(j);
    if (v === 'damaged') { const err = new Error('This backup is damaged: its contents don’t match its fingerprint, so PatOS won’t restore it.'); err.damaged = true; throw err; }
    if (PatOS.fs.integrity && PatOS.fs.integrity.inspect(j.fs).fatal) throw new Error('This backup is damaged: its file list can’t be read.');
    j.verified = v; return j;
  }

  /* ---------- snapshots ---------- */
  const index = () => PatOS.store.get('snapIndex', []);
  const setIndex = (l) => PatOS.store.set('snapIndex', l);
  async function snapshot(label, kind, t) {
    kind = kind || 'manual'; t = t || Date.now();
    const s = await collect({ blobs: false }); const key = 'snap:' + t + ':' + kind;
    await putSnap(key, { t, label, kind, kv: s.kv, fs: s.fs, stats: s.stats, patos: s.patos, device: s.device, check: s.check });
    // read it back: a snapshot only counts once it is really there, whole
    const back = await getSnap(key); if (!back || (await verify(back)) === 'damaged') { try { await delSnap(key); } catch (e) {} throw new Error('The snapshot could not be saved whole'); }
    const l = index().filter((x) => x.key !== key); l.push({ key, t, label, kind, files: s.stats.files, bytes: s.stats.bytes }); setIndex(l);
    await prune();
    return key;
  }
  async function prune() {
    const l = index().sort((a, b) => b.t - a.t); const keep = new Set(); const seen = { auto: 0, manual: 0, before: 0 };
    l.forEach((x) => { if (seen[x.kind] < (KEEP[x.kind] || 5)) { seen[x.kind]++; keep.add(x.key); } });
    for (const x of l) if (!keep.has(x.key)) { try { await delSnap(x.key); } catch (e) {} }
    setIndex(l.filter((x) => keep.has(x.key)));
  }
  const list = () => index().slice().sort((a, b) => b.t - a.t);
  async function removeSnapshot(key) { try { await delSnap(key); } catch (e) {} setIndex(index().filter((x) => x.key !== key)); }

  /* ---------- putting a backup back ---------- */
  async function apply(state, opts) {
    if (!state || state.format !== FORMAT || !state.fs || !state.kv) throw new Error('This is not a PatOS backup');
    if ((await verify(state)) === 'damaged') throw new Error('This backup is damaged: its contents don’t match its fingerprint, so PatOS won’t restore it.');
    await snapshot(T('Before restoring'), 'before'); // always keep a way back
    if (opts && opts.blobDir) await loadBigFiles(opts.blobDir, state.fs);
    if (state.blobs) for (const id of Object.keys(state.blobs)) { const b = state.blobs[id]; const blob = new Blob([await unb64(b.data)], { type: b.type || '' }); await idb('blobs', 'readwrite', (s) => s.put(blob, id)); }
    PatOS.store.restoreData(structuredClone(state.kv));
    const r = await PatOS.fs.importTree(structuredClone(state.fs));
    await PatOS.flush();
    return r; // { missing }: big files that were not in the backup
  }
  async function restoreSnapshot(key) { const v = await getSnap(key); if (!v) throw new Error('That snapshot is gone'); return apply(Object.assign({ format: FORMAT }, v)); }

  /* ---------- the backup file ---------- */
  async function exportFile(opts) {
    opts = opts || {}; const state = await collect({ blobs: !!opts.blobs });
    const wrapped = opts.password ? await encrypt(state, opts.password) : state;
    const blob = new Blob([JSON.stringify(wrapped)], { type: 'application/json' });
    return { blob, name: 'PatOS Backup ' + stamp() + '.patos-backup', stats: state.stats, encrypted: !!opts.password };
  }
  async function saveFile(f) {
    // on an iPhone the share sheet can put it straight into Files
    try { const file = new File([f.blob], f.name, { type: 'application/json' }); if (PatOS.hw && PatOS.hw.ios && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: f.name }); return 'shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    PatOS.downloadBlob ? PatOS.downloadBlob(f.name, f.blob) : PatOS.downloadFile(f.name, URL.createObjectURL(f.blob)); return 'downloaded';
  }

  /* ---------- the auto-backup folder (Chrome on a computer or Chromebook) ---------- */
  const folderSupported = () => typeof window.showDirectoryPicker === 'function' && !PatOS.sandboxed;
  const info = () => PatOS.store.get('backupInfo', {});
  const setInfo = (o) => PatOS.store.set('backupInfo', Object.assign(info(), o));
  const getFolder = () => idb('handles', 'readonly', (s) => s.get(FOLDER_KEY)).catch(() => null);
  async function folderPermission(h, ask) {
    if (!h) return 'none';
    try { let p = await h.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask) p = await h.requestPermission({ mode: 'readwrite' }); return p; } catch (e) { return 'denied'; }
  }
  /* writes today's backup file into a folder, and removes the oldest PatOS backup files there (keeps 14) */
  async function writeToFolder(dir, state, keep) {
    const name = 'PatOS-backup-' + stamp(state.created) + '.patos-backup';
    const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(JSON.stringify(state)); await w.close();
    // read the file back before removing any older backup: a backup that can't be read back doesn't count
    let back = null; try { back = JSON.parse(await (await fh.getFile()).text()); } catch (e) {}
    if (!back || (await verify(back)) === 'damaged') throw new Error('The backup file could not be read back whole, so older backups were kept');
    const names = []; for await (const [n] of dir.entries()) if (FOLDER_FILE.test(n)) names.push(n);
    names.sort().reverse().slice(keep || 14).forEach((n) => { dir.removeEntry(n).catch(() => {}); });
    return name;
  }
  const bigIds = (tree) => { const ids = []; (function walk(n) { if (n.type === 'dir') Object.values(n.children || {}).forEach(walk); else if (n.blob && /^[A-Za-z0-9]+$/.test(n.blob)) ids.push([n.blob, n.size || 0]); })(tree); return ids; };
  /* big files (videos, recordings) go into the folder as real files, one each, so the folder holds everything.
     Only new ones are copied each time. Files that are no longer in PatOS are removed after 14 days. */
  async function copyBigFiles(dir, tree) {
    const ids = bigIds(tree); const out = { total: ids.length, copied: 0, skipped: 0 };
    const fd = await dir.getDirectoryHandle(FILES_DIR, { create: true }); const have = new Map();
    for await (const [n, hd] of fd.entries()) have.set(n, hd);
    let bytes = 0;
    for (const [id, size] of ids) {
      bytes += size; if (have.has(id)) continue;
      if (bytes > FOLDER_CAP) { out.skipped++; continue; }
      const blob = await idb('blobs', 'readonly', (st) => st.get(id)).catch(() => null); if (!blob) { out.skipped++; continue; }
      try { const fh = await fd.getFileHandle(id, { create: true }); const w = await fh.createWritable(); await w.write(blob); await w.close(); out.copied++; }
      catch (e) { out.skipped++; try { await fd.removeEntry(id); } catch (e2) {} }
    }
    const live = new Set(ids.map((x) => x[0]));
    for (const [n, hd] of have) if (!live.has(n)) { try { const f = await hd.getFile(); if (Date.now() - f.lastModified > 14 * DAY) await fd.removeEntry(n); } catch (e) {} }
    return out;
  }
  /* before a restore from a folder: bring its big files back into PatOS's storage */
  async function loadBigFiles(dir, tree) {
    let fd; try { fd = await dir.getDirectoryHandle(FILES_DIR); } catch (e) { return 0; }
    const have = new Set(await idb('blobs', 'readonly', (st) => st.getAllKeys()).catch(() => [])); let n = 0;
    const mime = {}; (function walk(x) { if (x.type === 'dir') Object.values(x.children || {}).forEach(walk); else if (x.blob) mime[x.blob] = x.mime || ''; })(tree);
    for (const [id] of bigIds(tree)) {
      if (have.has(id)) continue;
      try { const f = await (await fd.getFileHandle(id)).getFile(); const blob = new Blob([await f.arrayBuffer()], { type: mime[id] || f.type || '' }); await idb('blobs', 'readwrite', (st) => st.put(blob, id)); n++; } catch (e) {}
    }
    return n;
  }
  async function linkFolder() {
    if (!folderSupported()) throw new Error('This browser can’t save to a folder');
    const h = await window.showDirectoryPicker({ id: 'patos-backup', mode: 'readwrite' });
    await idb('handles', 'readwrite', (s) => s.put(h, FOLDER_KEY)); setInfo({ folder: h.name });
    await writeFolderNow(true); return h.name;
  }
  async function unlinkFolder() { await idb('handles', 'readwrite', (s) => s.delete(FOLDER_KEY)).catch(() => {}); setInfo({ folder: null, folderLast: null }); }
  async function folderStatus() {
    const h = await getFolder(); if (!h) return { linked: false, supported: folderSupported() };
    return { linked: true, supported: true, name: h.name, permission: await folderPermission(h, false), last: info().folderLast || 0 };
  }
  async function writeFolderNow(ask) {
    const h = await getFolder(); if (!h) return { ok: false, why: 'none' };
    const p = await folderPermission(h, !!ask); if (p !== 'granted') return { ok: false, why: 'permission' };
    const state = await collect({ blobs: false });
    try { const name = await writeToFolder(h, state); let big = null; try { big = await copyBigFiles(h, state.fs); } catch (e) { big = { total: 0, copied: 0, skipped: 0, failed: true }; } setInfo({ folderLast: Date.now(), folderBig: big }); PatOS.emit('backup'); return { ok: true, name }; } catch (e) { return { ok: false, why: String(e.message || e) }; }
  }


  /* ---------- the "put it back" screens (used by Settings and by the Setup Assistant) ---------- */
  const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'settings' });
  const ui = {
    /* ask before replacing everything, then restart PatOS on its own boot screen */
    async confirmRestore(title, run) {
      if (!(await PatOS.confirmBox(title, T('Your files and settings go back to how they were then, and anything newer is replaced. A copy of right now is saved first, as “Before restoring”.'), { ok: T('Restore'), danger: true, icon: 'settings' }))) return;
      const r = await run();
      if (r && r.missing) await msg(T('Restored'), r.missing + ' ' + T(r.missing === 1 ? 'big file was not in this backup, so it was left out.' : 'big files were not in this backup, so they were left out.'));
      PatOS.restartPatOS ? PatOS.restartPatOS({ update: false }) : location.reload();
    },
    async fromFile(file, opts) {
      let pass = null, state = null; const text = await file.text();
      for (let i = 0; i < 4 && !state; i++) {
        try { state = await parse(text, pass); }
        catch (e) {
          if (e.needPassword || e.wrongPassword) { pass = await PatOS.ask(T(e.wrongPassword ? 'That password is not right' : 'This backup is locked'), '', { icon: 'settings', ok: T('Unlock'), password: true, text: T('Type the password you chose when you saved it.') }); if (pass == null) return; } else throw e;
        }
      }
      if (!state) return;
      const st = state.stats || {};
      await ui.confirmRestore(T('Restore this backup?') + ' (' + when(state.created) + ', ' + (st.files || 0) + ' ' + T('files') + ', ' + (state.device || '') + ')', () => apply(state, opts));
    },
    pickFile() {
      return new Promise((res) => {
        const i = document.createElement('input'); i.type = 'file'; i.accept = '.patos-backup,.json,application/json'; i.style.display = 'none'; document.body.appendChild(i);
        i.onchange = async () => { const f = i.files[0]; i.remove(); if (f) { try { await ui.fromFile(f); } catch (e) { msg(T('That didn’t work'), T(String(e.message || e))); } } res(); };
        i.addEventListener('cancel', () => { i.remove(); res(); });
        i.click();
      });
    },
    /* list the backups in a folder (the linked one, or one you pick right now) and restore the one you choose */
    async folderMenu(dir, anchor) {
      if (!dir) dir = await getFolder();
      if (!dir) { if (!folderSupported()) return; dir = await window.showDirectoryPicker({ id: 'patos-backup', mode: 'read' }); }
      if ((await dir.requestPermission({ mode: 'read' })) !== 'granted') return;
      const files = []; for await (const [n, hd] of dir.entries()) if (/^PatOS-backup-.*\.patos-backup$/.test(n) && hd.kind === 'file') files.push([n, hd]);
      files.sort((a, b) => b[0].localeCompare(a[0]));
      if (!files.length) return msg(T('No backups here yet'), T('This folder has no PatOS backups.'));
      const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - 100, bottom: innerHeight / 2 - 100 };
      PatOS.menu([{ header: T('Restore from this folder') }, ...files.slice(0, 14).map(([n, hd]) => ({ label: n.replace(/^PatOS-backup-/, '').replace(/\.patos-backup$/, ''), action: async () => { try { await ui.fromFile(await hd.getFile(), { blobDir: dir }); } catch (e) { msg(T('That didn’t work'), T(String(e.message || e))); } } }))], r.left, r.bottom + 4);
    }
  };

  /* ---------- keeping storage safe, and the daily routine ---------- */
  const persist = {
    supported: () => !!(navigator.storage && navigator.storage.persist),
    status: async () => { try { return await navigator.storage.persisted(); } catch (e) { return false; } },
    request: async () => { try { return await navigator.storage.persist(); } catch (e) { return false; } }
  };
  const autoOn = () => info().auto !== false;
  async function autoTick(force) {
    if (!PatOS.store.idb || !PatOS.loggedIn) return;
    // after a damaged start, no automatic snapshot: it would push out the good ones (offerRecovery asks first)
    const L = PatOS.fs.integrity && PatOS.fs.integrity.load(); if (L && (L.state === 'damaged' || L.state === 'missing') && !force) return;
    if (autoOn()) {
      const last = list().find((x) => x.kind === 'auto'); const t = Date.now();
      if (force || !last || t - last.t > 20 * 3600e3) { try { await snapshot(T('Daily snapshot'), 'auto'); PatOS.emit('backup'); } catch (e) { console.warn('PatOS backup:', e); } }
    }
    const h = await getFolder();
    if (h && (force || Date.now() - (info().folderLast || 0) > 20 * 3600e3)) {
      const r = await writeFolderNow(false);
      // the browser may want a click before it lets PatOS write again: ask once a day, with a notification you can click
      if (!r.ok && r.why === 'permission' && Date.now() - (info().folderAsked || 0) > DAY) {
        setInfo({ folderAsked: Date.now() });
        PatOS.notify({ title: T('Backup folder needs permission'), body: T('Click to let PatOS save today’s backup.'), icon: 'settings', duration: 20000, onClick: async () => { const r2 = await writeFolderNow(true); if (r2.ok) PatOS.notify({ title: T('Backup saved'), body: info().folder || '', icon: 'settings' }); } });
      }
    }
  }
  /* the file tree could not be read at start: it was kept (PatOS.fs.integrity), and the newest snapshot is offered.
     Nothing is put back without a yes, and the damaged copy stays either way. */
  async function offerRecovery() {
    const L = PatOS.fs.integrity && PatOS.fs.integrity.load(); if (!L || (L.state !== 'damaged' && L.state !== 'missing')) return;
    const snap = list()[0];
    const body = (L.state === 'damaged' ? T('PatOS couldn’t read your files when it started, so it kept them aside and started with empty folders.') : T('Some files lost their content when PatOS started.')) + (snap ? ' ' + T('The newest snapshot is from') + ' ' + when(snap.t) + '.' : ' ' + T('There is no snapshot on this device. You can restore a backup file from Settings › Backup.'));
    if (!snap) return msg(T('PatOS found a problem with your files'), body);
    if (await PatOS.confirmBox(T('PatOS found a problem with your files'), body, { ok: T('Restore the Snapshot'), icon: 'settings' })) {
      try { await restoreSnapshot(snap.key); PatOS.restartPatOS ? PatOS.restartPatOS({ update: false }) : location.reload(); } catch (e) { msg(T('That didn’t work'), String(e.message || e)); }
    }
  }
  PatOS.on('wm:ready', () => { persist.request(); setTimeout(() => autoTick(false), 25000); setTimeout(offerRecovery, 2500); });
  setInterval(() => autoTick(false), 3600e3);

  /* every snapshot, read and checked (for Settings › Backup and Diagnostics) */
  async function verifyAll() { const out = []; for (const x of list()) { let st = 'missing'; try { const v = await getSnap(x.key); if (v) st = await verify(v); } catch (e) { st = 'damaged'; } out.push({ key: x.key, t: x.t, label: x.label, state: st }); } return out; }
  PatOS.backup = { ui, collect, parse, apply, verify, verifyAll, snapshot, list, removeSnapshot, restoreSnapshot, exportFile, saveFile, count, when, stamp, autoTick, setAuto: (on) => setInfo({ auto: !!on }), autoOn, persist, info,
    folder: { handle: getFolder, supported: folderSupported, link: linkFolder, unlink: unlinkFolder, status: folderStatus, writeNow: writeFolderNow, write: writeToFolder, copyBig: copyBigFiles, loadBig: loadBigFiles } };
})();
