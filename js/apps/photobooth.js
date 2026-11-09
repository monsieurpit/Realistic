/* Camera (id 'photobooth', so pinned icons and old photos keep working).
   Modes: Photo, Video (with sound, saved in Videos), Square (a square crop) and Burst (6 photos in a row).
   Top bar: screen flash (the screen turns white to light your face, as front cameras do), timer (off, 3 s, 10 s), grid, mirror.
   Bottom bar: the last shot (opens Photos), the shutter, switch camera (when there are two).
   Zoom 1×, 2×, 3× is a digital crop of the picture, and the saved photo is cropped the same way. Filters are applied to what
   is saved too. Space takes the photo or starts and stops a video. Photos go to Pictures, videos to Videos. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const FX = [['Original', 'none', '#9aa4b2'], ['Vivid', 'saturate(1.45) contrast(1.08)', '#ff8a3d'], ['Warm', 'sepia(.25) saturate(1.3) hue-rotate(-8deg)', '#ffb84d'],
    ['Cool', 'saturate(1.1) hue-rotate(12deg) brightness(1.03)', '#4db8ff'], ['Mono', 'grayscale(1) contrast(1.15)', '#c7c7cc'], ['Noir', 'grayscale(1) contrast(1.6) brightness(.9)', '#3a3a3c'],
    ['Sepia', 'sepia(1)', '#c69a5c'], ['Dream', 'blur(1.5px) saturate(1.6) brightness(1.1)', '#ff9ad5'], ['Neon', 'hue-rotate(90deg) saturate(3)', '#30d158']];
  const MODES = ['Video', 'Photo', 'Square', 'Burst'];
  const sym = (n) => PatOS.sym(n);

  PatOS.registerApp({
    id: 'photobooth', name: 'Camera', icon: 'photobooth', width: 820, height: 620, dark: true, keywords: 'camera photo booth selfie webcam video record picture appareil photo',
    about: 'Take photos, square photos, bursts and videos, with a timer, flash, grid, zoom and filters.',
    launch(win) {
      const cfg = Object.assign({ mode: 1, fx: 0, mirror: true, grid: false, timer: 0, flash: false, zoom: 1, facing: 'user' }, PatOS.store.get('cameraCfg', {}));
      const save = () => PatOS.store.set('cameraCfg', cfg);
      let stream = null, rec = null, recStart = 0, recTimer = 0, busy = false, cams = [];

      const video = h('video', { autoplay: true, playsinline: true, muted: true, class: 'cm-video' });
      const gridEl = h('div', { class: 'cm-grid' }, h('i'), h('i'), h('i'), h('i'));
      const squareMask = h('div', { class: 'cm-square' });
      const count = h('div', { class: 'cm-count' });
      const flashEl = h('div', { class: 'cm-flash' });
      const msg = h('div', { class: 'cm-msg' }, h('div', { class: 'cm-msg-ic', html: sym('camera') }), h('b', {}, T('Starting the camera…')));
      const recPill = h('div', { class: 'cm-rec hidden' }, h('span', { class: 'cm-dot' }), h('b', {}, '0:00'));
      const zoomBar = h('div', { class: 'cm-zoom' });
      [1, 2, 3].forEach((z) => zoomBar.appendChild(h('button', { class: 'cm-z', 'data-z': z, onclick: () => { cfg.zoom = z; save(); sync(); } }, z + '×')));
      const stage = h('div', { class: 'cm-stage' }, video, squareMask, gridEl, count, recPill, zoomBar, msg, flashEl);

      const topBtn = (icon, label, fn) => h('button', { class: 'cm-tb', title: T(label), 'aria-label': T(label), html: sym(icon), onclick: fn });
      const bFlash = topBtn('flash', 'Flash', () => { cfg.flash = !cfg.flash; save(); sync(); });
      const bTimer = topBtn('timer', 'Timer', () => { cfg.timer = { 0: 3, 3: 10, 10: 0 }[cfg.timer]; save(); sync(); });
      const timerTag = h('span', { class: 'cm-tag' }); bTimer.appendChild(timerTag);
      const bGrid = topBtn('grid', 'Grid', () => { cfg.grid = !cfg.grid; save(); sync(); });
      const bMirror = topBtn('mirror', 'Mirror', () => { cfg.mirror = !cfg.mirror; save(); sync(); });
      const bFx = topBtn('wand', 'Filters', () => { fxRow.classList.toggle('open'); bFx.classList.toggle('on', fxRow.classList.contains('open')); });
      const top = h('div', { class: 'cm-top' }, bFlash, bTimer, h('div', { class: 'cm-sp' }), bGrid, bMirror, bFx);

      const fxRow = h('div', { class: 'cm-fx' });
      FX.forEach(([n, , col], i) => fxRow.appendChild(h('button', { class: 'cm-fxb', onclick: () => { cfg.fx = i; save(); sync(); } }, h('span', { class: 'cm-sw', style: { background: `radial-gradient(circle at 35% 30%, #fff8, transparent 55%), ${col}` } }), h('small', {}, T(n)))));

      const modes = h('div', { class: 'cm-modes', role: 'tablist' });
      // (pressing a mode must not focus it: the strip slides, and the browser would scroll the whole camera sideways to show it)
      MODES.forEach((m, i) => modes.appendChild(h('button', { class: 'cm-mode', role: 'tab', onmousedown: (e) => e.preventDefault(), onclick: () => { if (!rec) { cfg.mode = i; save(); sync(); } } }, T(m).toUpperCase())));
      const thumb = h('button', { class: 'cm-thumb', title: T('Open in Photos'), onclick: () => last && PatOS.launch(last.video ? 'finder' : 'photos', last.video ? { path: '/Videos' } : { path: last.path }) });
      const shutter = h('button', { class: 'cm-shutter', 'aria-label': T('Take photo') }, h('span'));
      const bFlip = h('button', { class: 'cm-flip', title: T('Switch camera'), 'aria-label': T('Switch camera'), html: sym('flip'), onclick: flip });
      const bottom = h('div', { class: 'cm-bottom' }, modes, h('div', { class: 'cm-row' }, thumb, shutter, bFlip));
      win.body.classList.add('cm-body');
      win.body.append(top, stage, fxRow, bottom);
      let last = null;

      function sync() {
        const f = FX[cfg.fx][1];
        video.style.filter = f === 'none' ? '' : f;
        video.style.transform = (cfg.mirror && cfg.facing === 'user' ? 'scaleX(-1) ' : '') + `scale(${cfg.zoom})`;
        gridEl.classList.toggle('on', cfg.grid); squareMask.classList.toggle('on', MODES[cfg.mode] === 'Square');
        bFlash.classList.toggle('on', cfg.flash); bGrid.classList.toggle('on', cfg.grid); bMirror.classList.toggle('on', cfg.mirror);
        bTimer.classList.toggle('on', !!cfg.timer); timerTag.textContent = cfg.timer ? cfg.timer + 's' : '';
        [...fxRow.children].forEach((b, i) => b.classList.toggle('on', i === cfg.fx));
        [...modes.children].forEach((b, i) => b.classList.toggle('on', i === cfg.mode));
        modes.style.setProperty('--m', cfg.mode);
        [...zoomBar.children].forEach((b) => b.classList.toggle('on', +b.dataset.z === cfg.zoom));
        const isVideo = MODES[cfg.mode] === 'Video';
        shutter.classList.toggle('video', isVideo); shutter.classList.toggle('recording', !!rec);
        shutter.setAttribute('aria-label', T(rec ? 'Stop recording' : isVideo ? 'Record video' : 'Take photo'));
        bFlip.disabled = cams.length < 2 || !!rec;
        win.body.scrollLeft = 0; bottom.scrollLeft = 0;
      }
      async function start() {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cfg.facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
          video.srcObject = stream; msg.classList.add('hidden');
          try { cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch (e) { cams = []; }
        } catch (e) {
          stream = null; msg.classList.remove('hidden');
          msg.querySelector('b').textContent = T('The camera isn’t available.');
          if (!msg.querySelector('small')) msg.appendChild(h('small', {}, T('Allow camera access in your browser settings. On a school Chromebook it may be turned off.')));
        }
        sync();
      }
      function flip() { cfg.facing = cfg.facing === 'user' ? 'environment' : 'user'; save(); start(); }
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      async function countdown() {
        for (let i = cfg.timer; i > 0; i--) { count.textContent = i; count.classList.remove('pop'); void count.offsetWidth; count.classList.add('pop'); PatOS.sound.tone(880, 0.08, { vol: 0.08 }); await wait(1000); }
        count.textContent = '';
      }
      /* one frame, as it looks on screen: zoom (a centered crop), filter, mirror, and a square crop in Square mode */
      function grab() {
        const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
        let sw = vw / cfg.zoom, sh = vh / cfg.zoom;
        if (MODES[cfg.mode] === 'Square') sw = sh = Math.min(sw, sh);
        const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
        const c = document.createElement('canvas'); c.width = Math.round(sw); c.height = Math.round(sh);
        const x = c.getContext('2d'); const f = FX[cfg.fx][1]; if (f !== 'none') x.filter = f;
        if (cfg.mirror && cfg.facing === 'user') { x.translate(c.width, 0); x.scale(-1, 1); }
        x.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.9);
      }
      function store(url, n) {
        if (!PatOS.fs.exists('/Pictures')) PatOS.fs.mkdir('/Pictures');
        const stamp = new Date().toLocaleString(PatOS.locale).replace(/[\/:]/g, '-').replace(/,/g, '');
        const nm = PatOS.fs.uniqueName('/Pictures', 'Camera ' + stamp + (n ? ' (' + n + ')' : '') + '.jpg');
        PatOS.fs.write('/Pictures/' + nm, url);
        last = { path: '/Pictures/' + nm }; thumb.style.backgroundImage = `url(${url})`; thumb.classList.remove('bump'); void thumb.offsetWidth; thumb.classList.add('bump');
      }
      async function flashOn() { if (!cfg.flash) return; flashEl.classList.add('screen'); await wait(260); }
      function flashOff() { flashEl.classList.remove('screen'); flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }
      async function photo() {
        if (!stream || busy) return; busy = true;
        try {
          await countdown();
          const burst = MODES[cfg.mode] === 'Burst';
          await flashOn();
          for (let i = 0; i < (burst ? 6 : 1); i++) {
            const url = grab(); if (!url) break;
            PatOS.sound.tone(2000, 0.05, { vol: 0.12, type: 'square' });
            store(url, burst ? i + 1 : 0);
            if (burst) await wait(160);
          }
          flashOff();
        } finally { busy = false; }
      }
      function pickMime() {
        const list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
        return window.MediaRecorder && list.find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
      }
      async function recordToggle() {
        if (rec) { rec.stop(); return; }
        if (!stream || busy || !window.MediaRecorder) { if (!window.MediaRecorder) PatOS.alertBox(T('Video isn’t available'), T('This browser can’t record video.'), { icon: 'photobooth' }); return; }
        busy = true; await countdown(); busy = false;
        let mic = null; try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { mic = null; }
        const mixed = new MediaStream([...stream.getVideoTracks(), ...(mic ? mic.getAudioTracks() : [])]);
        const mime = pickMime(), chunks = [];
        try { rec = new MediaRecorder(mixed, mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : {}); } catch (e) { mic && mic.getTracks().forEach((t) => t.stop()); PatOS.alertBox(T('Couldn’t start recording'), e.message || String(e), { icon: 'photobooth' }); return; }
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = async () => {
          mic && mic.getTracks().forEach((t) => t.stop()); clearInterval(recTimer); recPill.classList.add('hidden');
          const blob = new Blob(chunks, { type: (rec && rec.mimeType) || 'video/webm' }); rec = null; sync();
          if (!blob.size) return;
          if (!PatOS.fs.exists('/Videos')) PatOS.fs.mkdir('/Videos');
          const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
          const nm = PatOS.fs.uniqueName('/Videos', 'Camera Video ' + new Date().toLocaleString(PatOS.locale).replace(/[\/:]/g, '-').replace(/,/g, '') + '.' + ext);
          try { await PatOS.fs.writeBlob('/Videos/' + nm, blob); last = { path: '/Videos/' + nm, video: true }; thumb.classList.add('vid'); PatOS.notify({ title: T('Video saved'), body: nm, icon: 'photobooth' }); }
          catch (e) { PatOS.alertBox(T('Couldn’t save the video'), e.message || String(e), { icon: 'photobooth' }); }
        };
        rec.start(1000); recStart = Date.now(); recPill.classList.remove('hidden');
        recTimer = setInterval(() => { const s = Math.floor((Date.now() - recStart) / 1000); recPill.querySelector('b').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 250);
        sync();
      }
      shutter.onclick = () => (MODES[cfg.mode] === 'Video' ? recordToggle() : photo());
      win.el.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); shutter.click(); } });
      win.on('closed', () => { if (rec) try { rec.stop(); } catch (e) {} stream && stream.getTracks().forEach((t) => t.stop()); clearInterval(recTimer); });
      sync(); start();
    }
  });
})();
