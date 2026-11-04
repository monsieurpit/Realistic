/* PatOS App SDK: apps people write as a single .patapp file (see docs/APP-SDK.md).
   - An app is a web page that runs in a locked box (a sandboxed frame with no access to PatOS, your files or its
     storage). It can only ask PatOS for things through `patos.*`, and PatOS decides.
   - What an app may ask for is listed in the file and shown before installing. Each sensitive thing (camera,
     microphone, location, files, clipboard, notifications, internet) is asked again, on this device, the first time
     the app uses it. Settings › Privacy shows what each app is allowed to do, what it did, and lets you take it back.
   - Installed apps are saved on this device and work offline. They follow you with Sync, but their permissions don't:
     each device asks for itself.
   - Apps from the store were read by the owner of this PatOS server (/apprequests). Apps opened from a file were not. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s); const F = window.PatAppFormat;
  const K = { apps: 'patApps', data: 'patAppData', grants: 'patAppGrants', log: 'privacyLog', subs: 'patAppSubmits' };
  const get = (k, d) => PatOS.store.get(k, d), set = (k, v) => PatOS.store.set(k, v);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DATA_CAP = 5e6;

  /* ---------- words for each permission ---------- */
  function permInfo(p) {
    switch (p) {
      case 'files': return [T('Files'), T('save and read files in its own folder (Documents › Apps)')];
      case 'clipboard': return [T('Clipboard'), T('copy to and paste from your clipboard')];
      case 'notifications': return [T('Notifications'), T('show notifications')];
      case 'camera': return [T('Camera'), T('take pictures with your camera')];
      case 'microphone': return [T('Microphone'), T('record sound with your microphone')];
      case 'location': return [T('Location'), T('see where you are')];
      case 'network': return [T('Internet'), T('connect to the internet')];
      default: return [p, p];
    }
  }
  const grantsOf = (id) => (get(K.grants, {})[id] || {});
  function setGrant(id, perm, v) { const g = get(K.grants, {}); g[id] = Object.assign({}, g[id]); if (v == null) delete g[id][perm]; else g[id][perm] = v; set(K.grants, g); PatOS.emit('patapps'); }

  /* ---------- what each app did (Settings › Privacy) ---------- */
  function log(rec, perm, what) {
    const l = get(K.log, []); l.push({ t: Date.now(), id: rec.id, name: rec.name, perm, what }); if (l.length > 300) l.splice(0, l.length - 300);
    set(K.log, l); PatOS.emit('patapps');
  }

  /* ---------- the box an app runs in ---------- */
  const SDK = `(function(){var P=window.parent,n=0,wait={},ev={};
function call(m,a){return new Promise(function(ok,no){var i=++n;wait[i]=[ok,no];P.postMessage({patos:1,id:i,m:m,a:a||{}},'*');});}
function theme(t){var r=document.documentElement;r.style.setProperty('--patos-bg',t.bg);r.style.setProperty('--patos-text',t.text);r.style.setProperty('--patos-accent',t.accent);r.style.colorScheme=t.dark?'dark':'light';}
window.addEventListener('message',function(e){if(e.source!==P)return;var d=e.data;if(!d||d.patos!==2)return;
if(d.event){if(d.event==='theme')theme(d.data);(ev[d.event]||[]).forEach(function(f){try{f(d.data);}catch(x){}});return;}
var w=wait[d.id];if(!w)return;delete wait[d.id];if(d.err)w[1](new Error(d.err));else w[0](d.v);});
window.patos={app:INFO,
on:function(name,f){(ev[name]=ev[name]||[]).push(f);},
info:function(){return call('info');},
storage:{get:function(k){return call('storage.get',{k:k});},set:function(k,v){return call('storage.set',{k:k,v:v});},remove:function(k){return call('storage.remove',{k:k});},keys:function(){return call('storage.keys');},clear:function(){return call('storage.clear');}},
notify:function(o){return call('notify',o);},
files:{list:function(d){return call('files.list',{dir:d||''});},read:function(p){return call('files.read',{path:p});},write:function(p,c){return call('files.write',{path:p,content:c});},remove:function(p){return call('files.remove',{path:p});}},
clipboard:{read:function(){return call('clipboard.read');},write:function(t){return call('clipboard.write',{text:t});}},
camera:{snapshot:function(){return call('camera.snapshot');}},
microphone:{record:function(ms){return call('microphone.record',{ms:ms});}},
location:{get:function(){return call('location.get');}},
log:function(t,e){return call('console',{text:t,err:!!e});},
window:{setTitle:function(t){return call('window.setTitle',{t:t});},close:function(){return call('window.close');}}};
call('hello').then(function(t){theme(t);});})();`;
  function themeNow() {
    const th = PatOS.settings.theme; const dark = th === 'dark' || (th === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    return { dark, bg: dark ? '#1c1c1e' : '#ffffff', text: dark ? '#f2f2f7' : '#1c1c1e', accent: PatOS.settings.accent || '#0a84ff' };
  }
  /* engine 'pitcode': the app is written in PitCode, so its page needs the language (PatOS puts it in) and may build code
     inside its own box ('unsafe-eval'): the box is still just as locked */
  function pageFor(app, net, pit) {
    const t = themeNow();
    const csp = "default-src 'none'; script-src 'unsafe-inline'" + (app.engine === 'pitcode' ? " 'unsafe-eval'" : '') + "; style-src 'unsafe-inline'; img-src data: blob:" + (net ? ' https:' : '') + "; media-src data: blob:" + (net ? ' https:' : '') + "; font-src data:" + (net ? ' https:' : '') + "; connect-src " + (net ? 'https:' : "'none'") + "; form-action 'none'; base-uri 'none'";
    const info = JSON.stringify({ id: app.id, name: app.name, version: app.version, network: !!net }).replace(/</g, '\\u003c');
    return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>:root{--patos-bg:' + t.bg + ';--patos-text:' + t.text + ';--patos-accent:' + t.accent + ';color-scheme:' + (t.dark ? 'dark' : 'light') + '}html,body{margin:0}body{background:var(--patos-bg);color:var(--patos-text);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}</style>' +
      '<script>var INFO=' + info + ';' + SDK + '<\/script>' + (pit ? '<script>' + pit.replace(/<\/script/gi, '<\\/script') + '<\/script>' : '') + '</head><body>' + app.html;
  }

  /* one listener for every open app */
  const live = new Map(); // the frame's window -> { rec, win, frame }
  window.addEventListener('message', async (e) => {
    const ctx = live.get(e.source); const d = e.data;
    if (!ctx || !d || d.patos !== 1 || typeof d.id !== 'number' || typeof d.m !== 'string') return;
    const reply = (o) => { try { e.source.postMessage(Object.assign({ patos: 2, id: d.id }, o), '*'); } catch (x) {} };
    try { reply({ v: await handle(ctx, d.m, d.a && typeof d.a === 'object' ? d.a : {}) }); }
    catch (err) { reply({ err: String((err && err.message) || err).slice(0, 200) }); }
  });
  const sendAll = (ev, data) => live.forEach((c) => { try { c.frame.contentWindow.postMessage({ patos: 2, event: ev, data }, '*'); } catch (x) {} });
  PatOS.on('setting:theme', () => sendAll('theme', themeNow())); PatOS.on('setting:accent', () => sendAll('theme', themeNow()));

  /* ask before the first use of something sensitive (and remember the answer) */
  async function allow(rec, perm) {
    if (rec.permissions.indexOf(perm) < 0) { log(rec, perm, 'blocked'); throw new Error('This app did not ask for the ' + perm + ' permission.'); }
    const g = grantsOf(rec.id)[perm];
    if (g === 'allow') return true;
    if (g === 'deny') { log(rec, perm, 'blocked'); throw new Error('You did not allow this app to use the ' + perm + '.'); }
    const [label, what] = permInfo(perm);
    const ok = await PatOS.confirmBox(T('Allow') + ' “' + rec.name + '” ' + T('to use this?'), '“' + rec.name + '” ' + T('wants to') + ' ' + what + '. ' + T('You can change this later in Settings › Privacy.'), { ok: T('Allow') + ' ' + label, cancel: T('Don’t Allow'), safe: true, icon: 'settings' });
    setGrant(rec.id, perm, ok ? 'allow' : 'deny'); log(rec, perm, ok ? 'allowed' : 'denied');
    if (!ok) throw new Error('You did not allow this app to use the ' + perm + '.');
    return true;
  }
  const folderOf = (rec) => '/Documents/Apps/' + (rec.name.replace(/[^\p{L}\p{N} _.-]/gu, '').trim() || rec.id);
  function inFolder(rec, rel, allowEmpty) {
    rel = String(rel == null ? '' : rel); const parts = rel.split('/').filter((x) => x !== '');
    if (rel.length > 200 || parts.some((x) => x === '.' || x === '..' || x.length > 100) || (!allowEmpty && !parts.length)) throw new Error('That is not a valid file name.');
    return folderOf(rec) + (parts.length ? '/' + parts.join('/') : '');
  }
  function mk(path) { let cur = ''; for (const p of path.split('/').filter(Boolean)) { cur += '/' + p; if (!PatOS.fs.exists(cur)) PatOS.fs.mkdir(cur); } }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const toURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read it')); r.readAsDataURL(blob); });

  async function handle(ctx, m, a) {
    const rec = ctx.rec; const id = rec.id;
    const all = () => get(K.data, {}); const mine = () => Object.assign({}, all()[id]);
    const save = (o) => { const x = all(); x[id] = o; if (JSON.stringify(o).length > DATA_CAP) throw new Error('This app has used all of its storage (5 MB).'); set(K.data, x); };
    const key = () => { if (typeof a.k !== 'string' || !a.k || a.k.length > 100) throw new Error('Keys are text, up to 100 characters.'); return a.k; };
    switch (m) {
      case 'hello': return themeNow();
      case 'info': return Object.assign(themeNow(), { language: PatOS.lang || 'en', mobile: !!PatOS.isMobile, app: { id, name: rec.name, version: rec.version } });
      case 'storage.get': { const v = mine()[key()]; return v === undefined ? null : v; }
      case 'storage.set': { const o = mine(); o[key()] = a.v === undefined ? null : a.v; save(o); return true; }
      case 'storage.remove': { const o = mine(); delete o[key()]; save(o); return true; }
      case 'storage.keys': return Object.keys(mine());
      case 'storage.clear': save({}); return true;
      case 'notify': await allow(rec, 'notifications'); log(rec, 'notifications', 'used'); PatOS.notify({ title: String(a.title || rec.name).slice(0, 80), body: String(a.body || '').slice(0, 200), icon: 'pa:' + id }); return true;
      case 'files.list': { await allow(rec, 'files'); const p = inFolder(rec, a.dir, true); log(rec, 'files', 'used'); return PatOS.fs.isDir(p) ? PatOS.fs.list(p).map((x) => ({ name: x.name, folder: x.type === 'dir', size: x.type === 'dir' ? 0 : (x.content || '').length })) : []; }
      case 'files.read': { await allow(rec, 'files'); const p = inFolder(rec, a.path); log(rec, 'files', 'used'); const c = PatOS.fs.read(p); return c == null ? null : c; }
      case 'files.write': { await allow(rec, 'files'); const p = inFolder(rec, a.path); if (typeof a.content !== 'string' || a.content.length > 5e6) throw new Error('Files are text (or a data: address), up to 5 MB.'); mk(PatOS.fs.dirname(p)); log(rec, 'files', 'used'); PatOS.fs.write(p, a.content); return true; }
      case 'files.remove': { await allow(rec, 'files'); const p = inFolder(rec, a.path); log(rec, 'files', 'used'); if (PatOS.fs.exists(p)) PatOS.fs.remove(p); return true; }
      case 'clipboard.write': await allow(rec, 'clipboard'); log(rec, 'clipboard', 'used'); await navigator.clipboard.writeText(String(a.text == null ? '' : a.text).slice(0, 1e6)); return true;
      case 'clipboard.read': await allow(rec, 'clipboard'); log(rec, 'clipboard', 'used'); return await navigator.clipboard.readText();
      case 'camera.snapshot': {
        await allow(rec, 'camera'); log(rec, 'camera', 'used');
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        try { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = s; await v.play(); await sleep(400); const w = v.videoWidth || 640, hh = v.videoHeight || 480, k = Math.min(1, 1280 / w); const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85); }
        finally { s.getTracks().forEach((t) => t.stop()); }
      }
      case 'microphone.record': {
        await allow(rec, 'microphone'); log(rec, 'microphone', 'used'); const ms = Math.max(500, Math.min(60000, +a.ms || 5000));
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        try { const r = new MediaRecorder(s); const chunks = []; r.ondataavailable = (e) => chunks.push(e.data); const done = new Promise((res) => { r.onstop = res; }); r.start(); await sleep(ms); r.stop(); await done; return await toURL(new Blob(chunks, { type: r.mimeType })); }
        finally { s.getTracks().forEach((t) => t.stop()); }
      }
      case 'location.get': await allow(rec, 'location'); log(rec, 'location', 'used'); return await new Promise((res, rej) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }), () => rej(new Error('Your location is not available.')), { timeout: 15000 }));
      case 'console': if (ctx.onConsole) ctx.onConsole(String(a.text == null ? '' : a.text).slice(0, 4000), !!a.err); return true;
      case 'window.setTitle': ctx.win.setTitle(String(a.t || rec.name).slice(0, 80)); return true;
      case 'window.close': setTimeout(() => ctx.win.close(), 0); return true;
      default: throw new Error('Unknown request: ' + m.slice(0, 40));
    }
  }

  /* ---------- installed apps ---------- */
  const all = () => get(K.apps, {});
  const recOf = (id) => { const r = all()[id]; return r ? r.app : null; };
  function iconFor(app) {
    PatOS.iconDefs['pa:' + app.id] = { bg: 'linear-gradient(160deg,rgba(255,255,255,.28),rgba(0,0,0,.22)),' + app.color, svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><text x="32" y="44" font-size="34" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle" fill="#fff">' + esc(app.icon) + '</text></svg>' };
  }
  function register(app) {
    const id = 'pa:' + app.id; iconFor(app);
    const had = !!PatOS.apps[id];
    PatOS.registerApp({ id, name: app.name, icon: id, category: 'Community', width: app.width, height: app.height, minWidth: 240, minHeight: 200, single: true, patapp: true, about: app.description, keywords: (app.name + ' ' + app.description + ' ' + app.author).toLowerCase(), launch: (win) => launchApp(win, app) });
    if (had) { const i = PatOS.appOrder.indexOf(id), j = PatOS.appOrder.lastIndexOf(id); if (i !== j) PatOS.appOrder.splice(j, 1); }
  }
  const redraw = () => PatOS.setSetting('hiddenApps', (PatOS.settings.hiddenApps || []).slice()); // redraws Launchpad and the Home Screen
  function unregister(appId) {
    const id = 'pa:' + appId; PatOS.wm.windowsOf(id).forEach((w) => w.close());
    delete PatOS.apps[id]; const i = PatOS.appOrder.indexOf(id); if (i >= 0) PatOS.appOrder.splice(i, 1); delete PatOS.iconDefs[id];
    ['dockPinned', 'mobileDock'].forEach((k) => { const l = PatOS.settings[k] || []; if (l.includes(id)) PatOS.setSetting(k, l.filter((x) => x !== id)); });
  }
  /* puts a running app in `parent` (a window's body, or Studio's preview); returns a way to stop it */
  async function mount(app, parent, win, opts) {
    opts = opts || {}; let net = false;
    if (app.permissions.indexOf('network') >= 0) { try { net = await allow(app, 'network'); } catch (e) { net = false; } if (net) log(app, 'network', 'used'); }
    const pit = app.engine === 'pitcode' ? await PatOS.pitcodeSource() : null;
    const frame = h('iframe', { class: 'pa-frame', sandbox: 'allow-scripts allow-forms allow-modals allow-downloads', referrerpolicy: 'no-referrer', allow: '', title: app.name });
    frame.srcdoc = pageFor(app, net, pit); parent.appendChild(frame);
    const ctx = { rec: app, win, frame, onConsole: opts.onConsole }; live.set(frame.contentWindow, ctx);
    frame.addEventListener('load', () => { if (frame.contentWindow) live.set(frame.contentWindow, ctx); });
    const stop = () => { live.forEach((c, k) => { if (c === ctx) live.delete(k); }); frame.remove(); };
    return { frame, stop };
  }
  async function launchApp(win, app) {
    const rec = recOf(app.id) || app; win.setTitle(app.name);
    const m = await mount(rec, win.body, win);
    win.on('closed', () => m.stop());
  }
  function syncRegistry() { // makes the registry match what is saved (also after Sync brought in another device's apps)
    const have = all(); let changed = false;
    Object.keys(have).forEach((id) => { const a = have[id].app; if (!PatOS.apps['pa:' + id] || PatOS.apps['pa:' + id].about !== a.description || PatOS.apps['pa:' + id].name !== a.name) { register(a); changed = true; } });
    PatOS.appOrder.filter((x) => x.startsWith('pa:') && !have[x.slice(3)]).forEach((x) => { unregister(x.slice(3)); changed = true; });
    if (changed) redraw();
  }

  /* ---------- install, remove, open ---------- */
  function parse(text) {
    let raw; try { raw = JSON.parse(text); } catch (e) { throw new Error(T('This is not a PatOS app file.')); }
    const v = F.validate(raw); if (!v.ok) throw new Error(T(v.error)); return v.app;
  }
  async function install(app, opts) {
    opts = opts || {}; const have = all()[app.id]; const upd = !!have;
    if (have && F.cmp(app.version, have.app.version) < 0 && !opts.downgrade) {
      if (!(await PatOS.confirmBox(T('Install an older version?'), '“' + app.name + '” ' + have.app.version + ' ' + T('is installed. This file is version') + ' ' + app.version + '.', { ok: T('Install'), icon: 'appstore' }))) return false;
    }
    const lines = app.permissions.length ? app.permissions.map((p) => permInfo(p)[0]).join(', ') : T('nothing special');
    const text = (app.author ? T('By') + ' ' + app.author + '. ' : '') + (app.description ? app.description + ' ' : '') + T('It asks for:') + ' ' + lines + '. ' + T('Each one is asked again the first time the app uses it.') + ' ' + (opts.source === 'store' ? T('This app was checked by the owner of this PatOS.') : T('This app was not checked. Only install apps you trust.'));
    if (!(await PatOS.confirmBox((upd ? T('Update') : T('Install')) + ' “' + app.name + '” ' + app.version + '?', text, { ok: upd ? T('Update') : T('Install'), icon: 'appstore', safe: !opts.source }))) return false;
    const a = all(); a[app.id] = { app, installed: have ? have.installed : Date.now(), updated: Date.now(), source: opts.source || 'file' }; set(K.apps, a);
    register(app); redraw(); PatOS.emit('patapps');
    return true;
  }
  async function uninstall(id) {
    const rec = recOf(id); if (!rec) return false;
    if (!(await PatOS.confirmBox(T('Remove') + ' “' + rec.name + '”?', T('The app is removed from this device. Its saved data and permissions are removed too. Files it made in Documents › Apps are kept.'), { ok: T('Remove'), danger: true, icon: 'appstore' }))) return false;
    const a = all(); delete a[id]; set(K.apps, a);
    const d = get(K.data, {}); delete d[id]; set(K.data, d); const g = get(K.grants, {}); delete g[id]; set(K.grants, g);
    unregister(id); redraw(); PatOS.emit('patapps'); return true;
  }
  async function installFromFile(src) { // a path in PatOS, or a File
    const text = typeof src === 'string' ? PatOS.fs.read(src) : await src.text();
    if (text == null) throw new Error(T('That file could not be read.'));
    return install(parse(text), { source: 'file' });
  }

  /* ---------- the community store and sending an app for review ---------- */
  async function api(method, route, body) {
    const r = await fetch('/api/apps/' + route, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((j && j.error) || 'HTTP ' + r.status);
    return j;
  }
  const storeList = async () => (await api('GET', 'store')).apps;
  async function storeInstall(id) { const j = await api('GET', 'get?id=' + encodeURIComponent(id)); const v = F.validate(j.app); if (!v.ok) throw new Error(T(v.error)); return install(v.app, { source: 'store' }); }
  async function submit(app) {
    const j = await api('POST', 'submit', { app }); const l = get(K.subs, []); l.unshift({ ticket: j.ticket, id: app.id, name: app.name, version: app.version, t: Date.now(), status: 'pending', note: '' }); set(K.subs, l.slice(0, 30)); PatOS.emit('patapps'); return j.ticket;
  }
  async function refreshSubmits() {
    const l = get(K.subs, []); let ch = false;
    for (const s of l) { if (s.status !== 'pending') continue; try { const j = await api('GET', 'status?ticket=' + encodeURIComponent(s.ticket)); if (j.status !== s.status || j.note !== s.note) { s.status = j.status; s.note = j.note || ''; ch = true; } } catch (e) {} }
    if (ch) { set(K.subs, l); PatOS.emit('patapps'); }
    return l;
  }
  /* an app file, made from a form (the Develop tab) */
  function make(o) {
    const id = String(o.id || '').trim() || ('local.' + String(o.name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.' + Math.random().toString(36).slice(2, 6));
    const v = F.validate({ format: 'patapp', formatVersion: 1, id, engine: o.engine, name: o.name, version: o.version || '1.0.0', author: o.author, description: o.description, icon: o.icon, color: o.color, permissions: o.permissions || [], width: o.width, height: o.height, html: o.html });
    if (!v.ok) throw new Error(T(v.error)); return v.app;
  }
  const EXAMPLE = '<h2>Hello!</h2>\n<p>You opened this app <b id="n">0</b> times.</p>\n<button id="b">Say hi</button>\n<script>\n  patos.storage.get("opens").then(function (n) {\n    n = (n || 0) + 1; document.getElementById("n").textContent = n; patos.storage.set("opens", n);\n  });\n  document.getElementById("b").onclick = function () {\n    patos.notify({ title: "Hello", body: "Made with the PatOS App SDK" }).catch(function (e) { alert(e.message); });\n  };\n<\/script>\n<style>button{background:var(--patos-accent);color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit}</style>\n';

  PatOS.patapps = {
    list: () => Object.keys(all()).map((id) => Object.assign({ id }, all()[id])), get: recOf, isInstalled: (id) => !!all()[id],
    permInfo, grants: grantsOf, setGrant, logOf: () => get(K.log, []).slice().reverse(), clearLog: () => { set(K.log, []); PatOS.emit('patapps'); },
    mount, parse, install, uninstall, installFromFile, open: (id) => PatOS.launch('pa:' + id),
    store: { list: storeList, install: storeInstall }, submit, submits: () => get(K.subs, []), refreshSubmits, make, example: EXAMPLE, validate: F.validate, cmp: F.cmp
  };
  /* what is saved comes to life at start-up, and again whenever Sync changes it */
  syncRegistry(); PatOS.on('store:set', (k) => { if (k === K.apps) syncRegistry(); });
})();
