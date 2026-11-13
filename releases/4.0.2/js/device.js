/* PatOS.device — real files on this Chromebook (Chrome's File System Access).
   - openFiles(): pick files; they are copied into PatOS and stay linked, so saving in PatOS saves the real file
   - linkFolder(): pick a folder (like Downloads or a Google Drive folder); its files appear in PatOS and
     new or changed files are written back to the real folder
   - saveCopy(path) / exportFolder(path): write PatOS files out to the real disk
   Browsers only allow this after you pick the file or folder, and may ask again after a restart. */
(function () {
  'use strict';
  const T = (s) => (PatOS.t ? PatOS.t(s) : s);
  const supported = !!(window.showOpenFilePicker && window.showDirectoryPicker) && window.top === window;
  const db = window.__IDB || null;
  const TEXT_RE = /\.(txt|md|js|css|html?|json|csv|py|xml|svg|yml|yaml|log|ts|c|cpp|java|psheet|pdoc|pslides|pform)$/i;
  const SKIP_DIR = /^(\.|node_modules$|__pycache__$)/;

  const tx = (store, mode, fn) => new Promise((res, rej) => { if (!db) return res(null); try { const t = db.transaction(store, mode); const r = fn(t.objectStore(store)); t.oncomplete = () => res(r && r.result); t.onerror = t.onabort = () => rej(t.error); } catch (e) { res(null); } });
  const memo = new Map(); // handles used during this session, so they don't have to be read back from the database
  const putHandle = async (h) => { const id = PatOS.uid() + PatOS.uid(); memo.set(id, h); await tx('handles', 'readwrite', (s) => s.put(h, id)); return id; };
  const getHandle = async (id) => { if (memo.has(id)) return memo.get(id); const h = await tx('handles', 'readonly', (s) => s.get(id)); if (h) memo.set(id, h); return h; };
  async function perm(handle, write, ask) {
    const o = { mode: write ? 'readwrite' : 'read' };
    try { if ((await handle.queryPermission(o)) === 'granted') return true; if (!ask) return false; return (await handle.requestPermission(o)) === 'granted'; } catch (e) { return false; }
  }
  const asDataURL = (file) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
  const asText = (file) => file.text();
  const notify = (title, body) => PatOS.notify && PatOS.notify({ title, body, icon: 'finder' });

  async function importFile(path, handle, file) {
    const isText = TEXT_RE.test(file.name) || /^text\//.test(file.type);
    const link = await putHandle(handle);
    const extra = { link, dmod: file.lastModified };
    if (!isText && (file.size > 8 * 1024 * 1024 || /^video\//.test(file.type))) await PatOS.fs.writeBlob(path, file, extra);
    else PatOS.fs.write(path, isText ? await asText(file) : await asDataURL(file), extra);
  }

  async function openFiles(dest) {
    dest = dest || '/Documents';
    if (!supported) return PatOS.importFiles(dest);
    let handles; try { handles = await showOpenFilePicker({ multiple: true }); } catch (e) { return []; }
    return importHandles(handles, dest);
  }
  // files handed to PatOS by the Chromebook (Files app › Open with › PatOS) or picked by the person
  async function importHandles(handles, dest) {
    dest = dest || '/Documents';
    const out = [];
    for (const h of handles) {
      if (!h || h.kind !== 'file') continue;
      try {
        const file = await h.getFile();
        // the same real file opened again: refresh the copy PatOS already has instead of making a second one
        const same = await findSame(dest, h, file.name);
        const p = same || dest + '/' + PatOS.fs.uniqueName(dest, file.name);
        await importFile(p, h, file); out.push(p);
      } catch (e) { notify(T('Couldn’t open the file'), e.message); }
    }
    return out;
  }
  async function findSame(dest, handle, fileName) {
    const dir = PatOS.fs.get(dest); if (!dir || dir.type !== 'dir' || !handle.isSameEntry) return null;
    // only copies with the same name (or the same name plus a number, like “report 2.txt”) can be the same file
    const dot = fileName.lastIndexOf('.'); const base = dot > 0 ? fileName.slice(0, dot) : fileName; const ext = dot > 0 ? fileName.slice(dot) : '';
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('^' + esc(base) + '( \\(?\\d+\\)?)?' + esc(ext) + '$', 'i');
    for (const [name, n] of Object.entries(dir.children || {})) {
      if (!n || !n.link || n.type === 'dir' || !re.test(name)) continue;
      try { const other = await getHandle(n.link); if (other && (await other.isSameEntry(handle))) return dest + '/' + name; } catch (e) {}
    }
    return null;
  }

  async function scan(dirHandle, dirPath, state) {
    for await (const [name, h] of dirHandle.entries()) {
      if (state.count >= 1500) { state.capped = true; return; }
      if (h.kind === 'directory') {
        if (SKIP_DIR.test(name)) continue;
        let node = PatOS.fs.get(dirPath + '/' + name);
        if (!node) { PatOS.fs.mkdir(dirPath + '/' + name); node = PatOS.fs.get(dirPath + '/' + name); }
        if (!node.link) node.link = await putHandle(h);
        await scan(h, dirPath + '/' + name, state);
      } else {
        if (name.startsWith('.')) continue;
        const p = dirPath + '/' + name; const existing = PatOS.fs.get(p);
        const file = await h.getFile();
        if (existing && existing.link && existing.dmod === file.lastModified) { state.count++; continue; }
        if (file.size > 200 * 1024 * 1024) { state.skipped++; continue; }
        await importFile(p, h, file); state.count++;
      }
    }
  }

  async function linkFolder(dest) {
    if (!supported) { PatOS.alertBox(T('Not available here'), T('Linking a folder needs Chrome on a computer, with PatOS opened from its website.'), { icon: 'finder' }); return null; }
    let dh; try { dh = await showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { return null; }
    dest = dest || '/Documents';
    const name = PatOS.fs.uniqueName(dest, dh.name); const path = dest + '/' + name;
    PatOS.fs.mkdir(path); PatOS.fs.get(path).link = await putHandle(dh);
    notify(T('Linking folder…'), dh.name);
    const state = { count: 0, skipped: 0, capped: false };
    try { await scan(dh, path, state); } catch (e) { notify(T('Couldn’t read the folder'), e.message); }
    PatOS.emit('fs', { path, dir: dest });
    notify(T('Folder linked'), dh.name + ' · ' + state.count + ' ' + T('files') + (state.capped ? ' (' + T('first 1,500 only') + ')' : '') + (state.skipped ? ' · ' + state.skipped + ' ' + T('too big, skipped') : ''));
    return path;
  }
  async function refresh(path) {
    const n = PatOS.fs.get(path); if (!n || !n.link) return false;
    const h = await getHandle(n.link); if (!h || !(await perm(h, false, true))) return false;
    const state = { count: 0, skipped: 0, capped: false }; await scan(h, PatOS.fs.norm(path), state);
    PatOS.emit('fs', { path, dir: PatOS.fs.dirname(path) }); notify(T('Folder updated'), PatOS.fs.basename(path)); return true;
  }

  /* ----- write changes back ----- */
  const timers = {}, waiting = new Map();
  function touched(path) {
    path = PatOS.fs.norm(path);
    clearTimeout(timers[path]);
    timers[path] = setTimeout(() => push(path).catch(() => {}), 900);
  }
  async function dirHandleFor(dirPath) {
    const n = PatOS.fs.get(dirPath);
    if (n && n.link) return getHandle(n.link);
    if (dirPath === '/' || !n) return null;
    const parent = await dirHandleFor(PatOS.fs.dirname(dirPath)); if (!parent) return null;
    if (!(await perm(parent, true, false))) return null;
    const dh = await parent.getDirectoryHandle(PatOS.fs.basename(dirPath), { create: true });
    n.link = await putHandle(dh); return dh;
  }
  async function push(path) {
    const n = PatOS.fs.get(path); if (!n || n.type !== 'file') return;
    let handle = n.link ? await getHandle(n.link) : null;
    if (!handle) {
      const dh = await dirHandleFor(PatOS.fs.dirname(path)); if (!dh) return; // not inside a linked folder
      if (!(await perm(dh, true, false))) return needPermission(dh, path);
      handle = await dh.getFileHandle(PatOS.fs.basename(path), { create: true }); n.link = await putHandle(handle);
    }
    if (!(await perm(handle, true, false))) return needPermission(handle, path);
    const w = await handle.createWritable();
    try {
      if (n.blob) await w.write(await PatOS.fs.getBlob(path));
      else if (/^data:/.test(n.content || '')) await w.write(await PatOS.fs.getBlob(path));
      else await w.write(n.content || '');
    } finally { await w.close(); }
    try { n.dmod = (await handle.getFile()).lastModified; } catch (e) {}
    PatOS.emit('device:saved', path);
  }
  function needPermission(handle, path) {
    waiting.set(handle, path);
    if (waiting.size === 1) {
      notify(T('Allow saving to this Chromebook?'), T('Click anywhere in PatOS and choose Allow to save to the real file.'));
      const once = async () => { const items = [...waiting.entries()]; waiting.clear(); for (const [h, p] of items) { if (await perm(h, true, true)) push(p).catch(() => {}); } };
      window.addEventListener('pointerdown', once, { once: true, capture: true });
    }
  }

  /* ----- write PatOS files out ----- */
  async function saveCopy(path) {
    const n = PatOS.fs.get(path); if (!n || n.type !== 'file') return false;
    const blob = await PatOS.fs.getBlob(path); const name = PatOS.fs.basename(path);
    if (!window.showSaveFilePicker || window.top !== window) { PatOS.downloadFile ? downloadBlob(name, blob) : null; return true; }
    try { const h = await showSaveFilePicker({ suggestedName: name }); const w = await h.createWritable(); await w.write(blob); await w.close(); notify(T('Saved to this Chromebook'), name); return true; } catch (e) { return false; }
  }
  function downloadBlob(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function exportFolder(path) {
    if (!supported) return false;
    let dh; try { dh = await showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { return false; }
    let count = 0;
    const walk = async (dirPath, handle) => {
      for (const it of PatOS.fs.list(dirPath)) {
        if (it.type === 'dir') await walk(it.path, await handle.getDirectoryHandle(it.name, { create: true }));
        else { const fh = await handle.getFileHandle(it.name, { create: true }); const w = await fh.createWritable(); await w.write(await PatOS.fs.getBlob(it.path)); await w.close(); count++; }
      }
    };
    await walk(path, dh); notify(T('Saved to this Chromebook'), count + ' ' + T('files')); return true;
  }

  window.addEventListener('beforeunload', (e) => { if (waiting.size) { e.preventDefault(); e.returnValue = ''; } });
  PatOS.device = { supported, openFiles, importHandles, linkFolder, refresh, touched, saveCopy, exportFolder, isLinked: (path) => { const n = PatOS.fs.get(path); return !!(n && n.link); } };
})();
