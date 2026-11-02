/* PatOS core: utilities, storage, events, settings, file system, sounds, app registry */
(function () {
  'use strict';
  const PatOS = (window.PatOS = window.PatOS || {});
  PatOS.version = '1.0';
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
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  };
  PatOS.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  PatOS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PatOS.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  PatOS.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  PatOS.fmtBytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';

  /* ---------- storage (safe localStorage) ---------- */
  const PREFIX = 'patos:';
  const mem = {};
  PatOS.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? (key in mem ? mem[key] : fallback) : JSON.parse(raw);
      } catch (e) { return key in mem ? mem[key] : fallback; }
    },
    set(key, value) {
      mem[key] = value;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) {
        if (/quota/i.test(e.name + e.message) && PatOS.notify) PatOS.notify({ title: 'Storage is full', body: 'PatOS could not save. Delete some pictures to free space.', icon: 'settings' });
        return false;
      }
    },
    remove(key) { delete mem[key]; try { localStorage.removeItem(PREFIX + key); } catch (e) {} },
    usage() {
      let n = 0;
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PREFIX)) n += (localStorage.getItem(k) || '').length * 2; } } catch (e) {}
      return n;
    },
    clearAll() {
      try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    }
  };

  /* ---------- events ---------- */
  const listeners = {};
  PatOS.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); return () => PatOS.off(ev, fn); };
  PatOS.off = (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); };
  PatOS.emit = (ev, data) => { (listeners[ev] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); };

  /* ---------- settings ---------- */
  const DEFAULTS = {
    userName: 'Pat',
    password: '',
    theme: 'dark',           // dark | light | auto
    accent: '#0a84ff',
    wallpaper: 'nebula',     // see wallpaper.js
    customWallpaper: null,
    live3d: true,
    dockSize: 54,
    magnify: true,
    magnifyScale: 1.7,
    dockAutohide: false,
    dockPinned: ['finder', 'launchpad', 'browser', 'notes', 'music', 'photos', 'calendar', 'terminal', 'galaxy', 'orbrunner', 'settings'],
    uiSounds: true,
    volume: 0.7,
    brightness: 1,
    reduceMotion: false,
    reduceTransparency: false,
    quality3d: 'auto',       // low | auto | high
    askFullscreen: true,
    clock24: false,
    showSeconds: false,
    desktopPositions: {}
  };
  const saved = PatOS.store.get('settings', {});
  PatOS.settings = Object.assign({}, DEFAULTS, saved);
  PatOS.setSetting = function (key, value) {
    PatOS.settings[key] = value;
    PatOS.store.set('settings', PatOS.settings);
    PatOS.emit('setting', { key, value });
    PatOS.emit('setting:' + key, value);
  };
  PatOS.resetSettings = function () { PatOS.store.set('settings', Object.assign({}, DEFAULTS)); };

  /* ---------- virtual file system ---------- */
  const now = () => Date.now();
  function seedFS() {
    const f = (content, extra) => Object.assign({ type: 'file', content, mtime: now() }, extra || {});
    const d = (children) => ({ type: 'dir', children: children || {}, mtime: now() });
    return d({
      Desktop: d({
        'Welcome to PatOS.txt': f(
          'Welcome to PatOS!\n\n' +
          'PatOS is a full desktop that runs in your browser.\n\n' +
          'Tips:\n' +
          ' • Ctrl+Space (or Alt+Space) opens Spotlight search.\n' +
          ' • Alt+L opens Launchpad with every app.\n' +
          ' • Alt+Up shows Mission Control (all windows).\n' +
          ' • Alt+W closes a window, Alt+M minimizes it.\n' +
          ' • Double-click a title bar to zoom a window.\n' +
          ' • Drag a window to the left or right edge to snap it.\n' +
          ' • Right-click the desktop to make folders or change the wallpaper.\n\n' +
          'Everything you make is saved in this browser.\n\nHave fun!\n'
        ),
        Projects: d({})
      }),
      Documents: d({
        'Homework.txt': f('Math: page 42, problems 1-10\nScience: read chapter 3\nEnglish: essay draft due Friday\n'),
        'Ideas.txt': f('- Build a 3D game in PatOS\n- Learn three.js\n- Customize my dock\n'),
        School: d({ 'Schedule.txt': f('Mon: Math, Science, Gym\nTue: English, History, Art\nWed: Math, Music, Science\nThu: English, French, Gym\nFri: History, Math, Free period\n') })
      }),
      Downloads: d({}),
      Pictures: d({}),
      Music: d({ 'Playlist.txt': f('Neon Drive\nMidnight Garden\nPixel Rain\nStarfall\nSummer Arcade\n') }),
      '.Trash': d({})
    });
  }
  let root = PatOS.store.get('fs', null);
  if (!root || root.type !== 'dir') { root = seedFS(); }

  const saveFS = PatOS.debounce(() => { PatOS.store.set('fs', root); }, 250);
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
  function changed(path) { saveFS(); PatOS.emit('fs', { path: norm(path), dir: parentOf(path).dir }); }

  PatOS.fs = {
    norm,
    join: (...p) => norm(p.join('/')),
    basename: (p) => parentOf(p).name,
    dirname: (p) => parentOf(p).dir,
    ext: (p) => { const n = parentOf(p).name; const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; },
    get: node,
    exists: (p) => !!node(p),
    isDir: (p) => { const n = node(p); return !!n && n.type === 'dir'; },
    list(path) {
      const n = node(path);
      if (!n || n.type !== 'dir') return [];
      return Object.keys(n.children).filter((k) => !k.startsWith('.')).sort((a, b) => {
        const da = n.children[a].type === 'dir', db = n.children[b].type === 'dir';
        return da !== db ? (da ? -1 : 1) : a.localeCompare(b, undefined, { numeric: true });
      }).map((name) => ({ name, path: norm(path + '/' + name), ...n.children[name] }));
    },
    read(path) { const n = node(path); return n && n.type === 'file' ? n.content : null; },
    write(path, content, extra) {
      const { dir, name } = parentOf(path);
      const parent = node(dir);
      if (!parent || parent.type !== 'dir' || !name) throw new Error('No such folder: ' + dir);
      const existing = parent.children[name];
      if (existing && existing.type === 'dir') throw new Error(name + ' is a folder');
      parent.children[name] = Object.assign({ type: 'file', content: String(content), mtime: now() }, extra || {});
      changed(path);
      return norm(path);
    },
    mkdir(path) {
      const { dir, name } = parentOf(path);
      const parent = node(dir);
      if (!parent || parent.type !== 'dir') throw new Error('No such folder: ' + dir);
      if (parent.children[name]) throw new Error(name + ' already exists');
      parent.children[name] = { type: 'dir', children: {}, mtime: now() };
      changed(path);
      return norm(path);
    },
    remove(path, permanent) {
      path = norm(path);
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
      const item = node(path); const target = node(toDir);
      if (!item || !target || target.type !== 'dir') throw new Error('Cannot copy');
      const name = PatOS.fs.uniqueName(toDir, parentOf(path).name);
      target.children[name] = JSON.parse(JSON.stringify(item));
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
    emptyTrash() { node('/.Trash').children = {}; changed('/.Trash/x'); },
    trashList() { const t = node('/.Trash'); return Object.keys(t.children).map((name) => ({ name, path: '/.Trash/' + name, ...t.children[name] })); },
    uniqueName(dir, base) {
      const p = node(dir); if (!p) return base;
      if (!p.children[base]) return base;
      const m = base.match(/^(.*?)(\.[^.]+)?$/); let i = 2;
      while (p.children[m[1] + ' ' + i + (m[2] || '')]) i++;
      return m[1] + ' ' + i + (m[2] || '');
    },
    size(n) { if (!n) return 0; if (n.type === 'file') return (n.content || '').length; return Object.values(n.children).reduce((a, c) => a + PatOS.fs.size(c), 0); },
    walk(path, fn) {
      const n = node(path); if (!n || n.type !== 'dir') return;
      for (const k of Object.keys(n.children)) {
        if (k.startsWith('.')) continue;
        const p = norm(path + '/' + k); fn(p, n.children[k]);
        if (n.children[k].type === 'dir') PatOS.fs.walk(p, fn);
      }
    },
    reset() { root = seedFS(); PatOS.store.set('fs', root); PatOS.emit('fs', { path: '/', dir: '/' }); }
  };

  /* file type helpers */
  PatOS.fileKind = function (name, nodeObj) {
    if (nodeObj && nodeObj.type === 'dir') return 'folder';
    const ext = PatOS.fs.ext(name);
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (ext === 'url') return 'link';
    if (['js', 'css', 'json', 'py', 'md', 'txt', 'csv', ''].includes(ext)) return 'text';
    return 'text';
  };

  /* ---------- sound (Web Audio, synthesized) ---------- */
  let actx = null, master = null;
  PatOS.audio = function () {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = PatOS.settings.volume;
      master.connect(actx.destination);
      PatOS.on('setting:volume', (v) => { master.gain.value = v; });
    }
    if (actx.state === 'suspended') actx.resume();
    return { ctx: actx, out: master };
  };
  function tone(freq, dur, opts) {
    if (!PatOS.settings.uiSounds) return;
    const a = PatOS.audio(); if (!a) return;
    opts = opts || {};
    const t = a.ctx.currentTime + (opts.delay || 0);
    const o = a.ctx.createOscillator(); const g = a.ctx.createGain();
    o.type = opts.type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(opts.vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.out); o.start(t); o.stop(t + dur + 0.05);
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
    PatOS.apps[def.id] = def;
    PatOS.appOrder.push(def.id);
  };

  /* ---------- open a file with the right app ---------- */
  PatOS.openFile = function (path) {
    const n = PatOS.fs.get(path); if (!n) return;
    const kind = PatOS.fileKind(path, n);
    if (kind === 'folder') return PatOS.launch('finder', { path });
    if (kind === 'image') return PatOS.launch('photos', { path });
    if (kind === 'audio') return PatOS.launch('music', { path });
    if (kind === 'link') return PatOS.launch('browser', { url: n.content.trim() });
    if (kind === 'html') return PatOS.launch('browser', { html: n.content, title: PatOS.fs.basename(path) });
    return PatOS.launch('textedit', { path });
  };

  /* ---------- import files from the real computer ---------- */
  PatOS.importFiles = function (destDir, accept) {
    return new Promise((resolve) => {
      const input = PatOS.h('input', { type: 'file', multiple: true, accept: accept || '' });
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = async () => {
        const out = [];
        for (const file of input.files) {
          const isText = /^text\/|json|javascript|xml|csv/.test(file.type) || /\.(txt|md|js|css|html|json|csv|py)$/i.test(file.name);
          const content = await new Promise((res) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            if (isText) r.readAsText(file); else r.readAsDataURL(file);
          });
          if (!isText && file.size > 3 * 1024 * 1024) {
            PatOS.notify({ title: 'File too large', body: file.name + ' is over 3 MB and cannot be stored in PatOS.', icon: 'finder' });
            continue;
          }
          const name = PatOS.fs.uniqueName(destDir, file.name);
          try { out.push(PatOS.fs.write(destDir + '/' + name, content)); } catch (e) { console.error(e); }
        }
        input.remove();
        resolve(out);
      };
      input.click();
    });
  };

  PatOS.downloadFile = function (name, content) {
    if (PatOS.sandboxed) { PatOS.notify({ title: 'Downloads are off here', body: 'Claude Artifacts can’t save files to your computer. Open PatOS from its own website to download.', icon: 'finder' }); return; }
    const a = document.createElement('a');
    if (typeof content === 'string' && content.startsWith('data:')) a.href = content;
    else a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- 3D helpers ---------- */
  PatOS.has3D = (function () {
    try { const c = document.createElement('canvas'); return !!(window.THREE && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  })();
  PatOS.pixelRatio = function () {
    const q = PatOS.settings.quality3d;
    const dpr = window.devicePixelRatio || 1;
    if (q === 'low') return Math.min(dpr, 1) * 0.75;
    if (q === 'high') return Math.min(dpr, 2);
    return Math.min(dpr, 1.25);
  };
  PatOS.makeRenderer = function (canvas, opts) {
    const r = new THREE.WebGLRenderer(Object.assign({ canvas, antialias: PatOS.settings.quality3d !== 'low', alpha: true, powerPreference: 'high-performance' }, opts || {}));
    r.setPixelRatio(PatOS.pixelRatio());
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
