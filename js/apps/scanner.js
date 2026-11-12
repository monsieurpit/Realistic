/* Scanner — photograph pages (or pick photos), straighten them, clean them up and save them as one PDF.
   - The page's corners are found automatically (light paper on a darker background) and can be dragged
   - The page is straightened with a perspective correction, then a filter makes it easy to read:
     Original, Document (white paper, dark text), Grayscale or Black & White
   - Pages can be rotated, reordered, retaken or removed; the PDF is written by PatOS itself (JPEG pages),
     so it works offline and everywhere */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);

  if (!PatOS.glassIcons || !PatOS.glassIcons.scanner) PatOS.iconDefs.scanner = { bg: 'linear-gradient(160deg,#5ac8fa,#0a60ff)', svg: () => '<svg viewBox="0 0 64 64" width="100%" height="100%"><rect x="17" y="12" width="30" height="40" rx="4" fill="#fff"/><path d="M23 22h18M23 28h18M23 34h12" stroke="#0a60ff" stroke-width="3" stroke-linecap="round"/><path d="M10 20v-6a4 4 0 0 1 4-4h6M54 20v-6a4 4 0 0 0-4-4h-6M10 44v6a4 4 0 0 0 4 4h6M54 44v6a4 4 0 0 1-4 4h-6" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><rect x="8" y="30" width="48" height="4" rx="2" fill="#ffd60a"/></svg>' };

  /* ---------- image helpers ---------- */
  const canvas = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; };
  function fitCanvas(src, max) {
    const w = src.videoWidth || src.naturalWidth || src.width, hh = src.videoHeight || src.naturalHeight || src.height;
    const s = Math.min(1, max / Math.max(w, hh)); const c = canvas(Math.round(w * s), Math.round(hh * s));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
  }
  // find the paper: threshold a small copy (Otsu), keep the biggest bright area, take its corner-most points
  function findCorners(src) {
    const W = 240, s = W / src.width, H = Math.max(1, Math.round(src.height * s));
    const c = canvas(W, H); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data; const g = new Uint8Array(W * H); const hist = new Array(256).fill(0);
    for (let i = 0; i < W * H; i++) { const v = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0; g[i] = v; hist[v]++; }
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, best = 0, th = 128; const total = W * H;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF; const between = wB * wF * (mB - mF) * (mB - mF); if (between > best) { best = between; th = t; } }
    const lab = new Int32Array(W * H).fill(-1); let bestLab = -1, bestSize = 0; const stack = [];
    for (let i = 0; i < W * H; i++) {
      if (lab[i] !== -1 || g[i] <= th) continue;
      let size = 0; stack.push(i); lab[i] = i;
      while (stack.length) { const k = stack.pop(); size++; const kx = k % W, ky = (k / W) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = kx + dx, ny = ky + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return; const n = ny * W + nx; if (lab[n] === -1 && g[n] > th) { lab[n] = i; stack.push(n); } }); }
      if (size > bestSize) { bestSize = size; bestLab = i; }
    }
    const inset = () => [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94]].map(([a, b]) => [a * src.width, b * src.height]);
    if (bestSize < total * 0.12 || bestSize > total * 0.97) { const r = inset(); r.none = true; return r; } // (no page found)
    let tl = null, tr = null, br = null, bl = null;
    for (let i = 0; i < W * H; i++) {
      if (lab[i] !== bestLab) continue; const px = i % W, py = (i / W) | 0;
      if (!tl || px + py < tl[0] + tl[1]) tl = [px, py]; if (!br || px + py > br[0] + br[1]) br = [px, py];
      if (!tr || px - py > tr[0] - tr[1]) tr = [px, py]; if (!bl || px - py < bl[0] - bl[1]) bl = [px, py];
    }
    return [tl, tr, br, bl].map(([a, b]) => [Math.min(src.width, (a + 0.5) / s), Math.min(src.height, (b + 0.5) / s)]);
  }
  // perspective: the 3x3 matrix that maps the output rectangle onto the four corners in the photo
  function homography(dst, src) {
    const A = [], B = [];
    for (let i = 0; i < 4; i++) { const [x, y] = dst[i], [u, v] = src[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v); }
    for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]]; for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; } }
    const m = B.map((b, i) => b / A[i][i]); return [m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], 1];
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function straighten(src, q) {
    let w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, hh = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
    const s = Math.min(1.6, 1800 / Math.max(w, hh)); w = Math.max(50, Math.round(w * s)); hh = Math.max(50, Math.round(hh * s));
    const M = homography([[0, 0], [w, 0], [w, hh], [0, hh]], q);
    const sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, src.width, src.height).data; const SW = src.width, SH = src.height;
    const out = canvas(w, hh); const od = out.getContext('2d').createImageData(w, hh); const o = od.data;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const zz = M[6] * x + M[7] * y + 1; let u = (M[0] * x + M[1] * y + M[2]) / zz, v = (M[3] * x + M[4] * y + M[5]) / zz;
      u = Math.max(0, Math.min(SW - 1.001, u)); v = Math.max(0, Math.min(SH - 1.001, v));
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0; const i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4; const k = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) o[k + ch] = (sd[i00 + ch] * (1 - fx) + sd[i10 + ch] * fx) * (1 - fy) + (sd[i01 + ch] * (1 - fx) + sd[i11 + ch] * fx) * fy;
      o[k + 3] = 255;
    }
    out.getContext('2d').putImageData(od, 0, 0); return out;
  }
  // filters: "document" divides by the paper's own brightness (removes shadows), then stretches the contrast
  function filter(src, mode) {
    if (mode === 'original') return src;
    const w = src.width, hh = src.height; const out = canvas(w, hh); const x = out.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
    const img = x.getImageData(0, 0, w, hh); const d = img.data;
    if (mode === 'gray') { for (let i = 0; i < d.length; i += 4) { const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; d[i] = d[i + 1] = d[i + 2] = v; } x.putImageData(img, 0, 0); return out; }
    const sw = Math.max(8, Math.round(w / 24)), sh = Math.max(8, Math.round(hh / 24));
    const small = canvas(sw, sh); const sx = small.getContext('2d', { willReadFrequently: true }); sx.filter = 'blur(2px)'; sx.drawImage(src, 0, 0, sw, sh);
    // the paper is the brightest part around each point: take the brightest of each block's neighbours
    const sdat = sx.getImageData(0, 0, sw, sh).data; const L = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) L[i] = sdat[i * 4] * 0.299 + sdat[i * 4 + 1] * 0.587 + sdat[i * 4 + 2] * 0.114;
    const bgS = new Float32Array(sw * sh);
    for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) { let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = Math.min(sw - 1, Math.max(0, xx + dx)), ny = Math.min(sh - 1, Math.max(0, yy + dy)); m = Math.max(m, L[ny * sw + nx]); } bgS[yy * sw + xx] = Math.max(40, m); }
    const bgAt = (px, py) => { const fx = Math.min(sw - 1.001, px / w * sw - 0.5), fy = Math.min(sh - 1.001, py / hh * sh - 0.5); const x0 = Math.max(0, fx | 0), y0 = Math.max(0, fy | 0), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1); const ax = Math.max(0, fx - x0), ay = Math.max(0, fy - y0); return (bgS[y0 * sw + x0] * (1 - ax) + bgS[y0 * sw + x1] * ax) * (1 - ay) + (bgS[y1 * sw + x0] * (1 - ax) + bgS[y1 * sw + x1] * ax) * ay; };
    for (let py = 0; py < hh; py++) for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4; const bg = bgAt(px, py);
      if (mode === 'color') { for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.min(255, Math.max(0, (d[i + ch] / bg * 255 - 28) * 1.18)); continue; }
      let v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / bg * 255;
      v = Math.min(255, Math.max(0, (v - 40) * 1.32));
      if (mode === 'bw') v = v > 170 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    x.putImageData(img, 0, 0); return out;
  }
  function rotate(src, turns) {
    turns = ((turns % 4) + 4) % 4; if (!turns) return src;
    const c = canvas(turns % 2 ? src.height : src.width, turns % 2 ? src.width : src.height); const x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.rotate(turns * Math.PI / 2); x.drawImage(src, -src.width / 2, -src.height / 2); return c;
  }

  /* ---------- a small PDF writer: one JPEG per page ---------- */
  async function makePDF(pages) {
    const enc = new TextEncoder(); const parts = []; const offsets = []; let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(n + ' 0 obj\n'); body.forEach(push); push('\nendobj\n'); };
    push('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A])); // marks the file as binary
    const n = pages.length; const kids = []; for (let i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    obj(2, ['<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>']);
    for (let i = 0; i < n; i++) {
      const c = pages[i];
      const jpg = new Uint8Array(await (await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82))).arrayBuffer());
      // page width 595 pt (A4 width); the height follows the scan
      const pw = 595, ph = Math.round(595 * c.height / c.width);
      const pn = 3 + i * 3, cn = pn + 1, im = pn + 2;
      obj(pn, ['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + cn + ' 0 R >>']);
      const content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
      obj(cn, ['<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream']);
      obj(im, ['<< /Type /XObject /Subtype /Image /Width ' + c.width + ' /Height ' + c.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n', jpg, '\nendstream']);
    }
    const xref = len; const count = 3 + n * 3;
    let x = 'xref\n0 ' + count + '\n0000000000 65535 f \n'; for (let i = 1; i < count; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + count + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }
  PatOS.scanner = { findCorners, straighten, filter, makePDF };

  /* ---------- the app ---------- */
  PatOS.registerApp({
    id: 'scanner', name: 'Scanner', icon: 'scanner', width: 960, height: 660, category: 'Utilities', keywords: 'scan document camera pdf paper homework worksheet photo numériser scanner',
    about: 'Scan pages with the camera and save them as a PDF.',
    launch(win) {
      win.el.classList.add('has-toolbar', 'sc-win');
      let stream = null, pages = [], editing = null, mode = PatOS.store.get('scanFilter', 'document');
      const FILTERS = [['document', 'Document'], ['color', 'Color'], ['gray', 'Grayscale'], ['bw', 'Black & White'], ['original', 'Original']];
      const bCam = h('select', { class: 'field sc-cam', 'aria-label': T('Camera') });
      const bPick = h('button', { class: 'btn' }, T('Choose Photos…'));
      const count = h('span', { class: 'sc-count' });
      const bSave = h('button', { class: 'btn primary', disabled: true }, T('Save PDF'));
      win.toolbar.append(bCam, bPick, h('div', { style: { flex: 1 } }), count, bSave);
      const stage = h('div', { class: 'sc-stage' });
      const strip = h('div', { class: 'sc-strip' });
      win.body.appendChild(h('div', { class: 'sc-wrap' }, stage, strip));

      /* camera */
      async function listCams() {
        try { const ds = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); bCam.innerHTML = ''; ds.forEach((d, i) => bCam.appendChild(h('option', { value: d.deviceId }, d.label || T('Camera') + ' ' + (i + 1)))); bCam.style.display = ds.length > 1 ? '' : 'none'; const cur = stream && stream.getVideoTracks()[0]; if (cur && cur.getSettings().deviceId) bCam.value = cur.getSettings().deviceId; } catch (e) { bCam.style.display = 'none'; }
      }
      function stopCam() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
      async function camera(deviceId) {
        stopCam(); editing = null; stage.innerHTML = '';
        const video = h('video', { class: 'sc-video', autoplay: true, playsinline: true, muted: true });
        const shutter = h('button', { class: 'sc-shutter', title: T('Take Picture'), 'aria-label': T('Take Picture') });
        const hint = h('div', { class: 'sc-hint' }, T('Put the page on a dark table, fill the frame, then press the button or Space.'));
        // the page's outline, found live several times a second (like a phone scanner); with Auto, a page that holds still is taken
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); outline.setAttribute('class', 'sc-outline'); outline.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const oPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon'); outline.appendChild(oPoly);
        const bAuto = h('button', { class: 'sc-auto' + (PatOS.store.get('scanAuto', true) ? ' on' : ''), html: PatOS.sym('scan') + '<span>' + T('Auto') + '</span>', title: T('Take the scan by itself when the page holds still') });
        bAuto.onclick = () => { const on = !PatOS.store.get('scanAuto', true); PatOS.store.set('scanAuto', on); bAuto.classList.toggle('on', on); };
        const shutterBar = h('div', { class: 'sc-bar' }, bAuto, shutter, h('button', { class: 'sc-pickc', html: PatOS.sym('image'), title: T('Choose Photos…'), onclick: () => pick() }));
        stage.append(h('div', { class: 'sc-live' }, video, outline, hint), shutterBar);
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('none');
          stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
          if (!win.el.isConnected) return stopCam();
          video.srcObject = stream; await video.play().catch(() => {}); listCams();
          let prev = null, still = 0, taken = false;
          const look = setInterval(() => {
            if (!stream || !video.isConnected || editing) return clearInterval(look);
            if (!video.videoWidth) return;
            outline.setAttribute('viewBox', '0 0 ' + video.videoWidth + ' ' + video.videoHeight);
            const small = fitCanvas(video, 320), q = findCorners(small), k = video.videoWidth / small.width;
            if (q.none) { outline.classList.remove('on'); prev = null; still = 0; return; }
            const pts = q.map(([a, b]) => [a * k, b * k]);
            oPoly.setAttribute('points', pts.map((c) => c.join(',')).join(' ')); outline.classList.add('on');
            const moved = prev ? Math.max(...pts.map((c, i) => dist(c, prev[i]))) / video.videoWidth : 1;
            still = moved < 0.025 ? still + 1 : 0; prev = pts;
            outline.classList.toggle('steady', still >= 2);
            if (!taken && still >= 3 && PatOS.store.get('scanAuto', true)) { taken = true; shutter.click(); }
          }, 350);
        } catch (e) {
          stage.innerHTML = '';
          stage.appendChild(h('div', { class: 'sc-empty' }, h('div', { class: 'sc-bigic', html: PatOS.iconHTML('scanner') }), h('h2', {}, T('The camera isn’t available')),
            h('p', {}, T('Allow the camera (the lock icon next to the address). It may be off on school Chromebooks. You can also scan saved photos.')),
            h('div', { class: 'sc-row' }, h('button', { class: 'btn', onclick: () => camera() }, T('Try Again')), h('button', { class: 'btn primary', onclick: pick }, T('Choose Photos…')))));
          return;
        }
        shutter.onclick = () => { if (!video.videoWidth) return; PatOS.sound.tone(1600, 0.05, { vol: 0.12 }); const shot = fitCanvas(video, 2000); flash(); edit({ src: shot, corners: findCorners(shot), turns: 0, mode }, true); };
      }
      function flash() { const f = h('div', { class: 'sc-flash' }); stage.appendChild(f); setTimeout(() => f.remove(), 350); }
      bCam.onchange = () => camera(bCam.value);
      function pick() {
        const i = h('input', { type: 'file', accept: 'image/*', multiple: true });
        i.onchange = async () => {
          const files = [...i.files]; if (!files.length) return;
          for (const f of files) {
            const img = await new Promise((res) => { const u = URL.createObjectURL(f); const im = new Image(); im.onload = () => { res(im); URL.revokeObjectURL(u); }; im.onerror = () => { res(null); URL.revokeObjectURL(u); }; im.src = u; });
            if (!img) continue; const src = fitCanvas(img, 2000);
            const pg = { src, corners: findCorners(src), turns: 0, mode }; render(pg); pages.push(pg);
          }
          drawStrip(); if (files.length === 1) edit(pages[pages.length - 1], false); else if (!editing) camera();
        };
        i.click();
      }
      bPick.onclick = pick;

      /* edit a page: corners, filter, rotate */
      function render(pg) { pg.out = rotate(filter(straighten(pg.src, pg.corners), pg.mode), pg.turns); pg.thumb = fitCanvas(pg.out, 220).toDataURL('image/jpeg', 0.7); }
      function edit(pg, isNew) {
        stopCam(); editing = pg; stage.innerHTML = '';
        const W = pg.src.width, H = pg.src.height;
        const view = h('div', { class: 'sc-edit' });
        const img = h('img', { class: 'sc-photo', src: pg.src.toDataURL('image/jpeg', 0.85), alt: '', draggable: 'false' });
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'sc-svg');
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon'); poly.setAttribute('class', 'sc-poly'); svg.appendChild(poly);
        const knobs = pg.corners.map((c, k) => { const e = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); e.setAttribute('r', Math.max(W, H) / 55); e.setAttribute('class', 'sc-knob'); e.dataset.k = k; svg.appendChild(e); return e; });
        const draw = () => { poly.setAttribute('points', pg.corners.map((c) => c.join(',')).join(' ')); knobs.forEach((e, k) => { e.setAttribute('cx', pg.corners[k][0]); e.setAttribute('cy', pg.corners[k][1]); }); };
        draw();
        svg.addEventListener('pointerdown', (e) => {
          const knob = e.target.closest('.sc-knob'); if (!knob) return; e.preventDefault(); svg.setPointerCapture(e.pointerId);
          const k = +knob.dataset.k; const r = svg.getBoundingClientRect();
          const mv = (ev) => { pg.corners[k] = [Math.max(0, Math.min(W, (ev.clientX - r.left) / r.width * W)), Math.max(0, Math.min(H, (ev.clientY - r.top) / r.height * H))]; draw(); };
          const up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); };
          svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
        });
        const fsel = h('div', { class: 'sc-chips' }, ...FILTERS.map(([k, l]) => { const b = h('button', { class: 'tab sc-chip' + (pg.mode === k ? ' on' : ''), 'data-k': k }, h('canvas', { class: 'sc-chip-pv' }), h('span', {}, T(l))); b.onclick = () => { pg.mode = k; mode = k; PatOS.store.set('scanFilter', k); fsel.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b)); }; return b; }));
        // each filter chip shows this page with that filter (a small straightened copy)
        const previews = () => { try {
          const small = fitCanvas(pg.src, 360), k = small.width / W, flat = straighten(small, pg.corners.map(([a, b]) => [a * k, b * k]));
          fsel.querySelectorAll('.sc-chip').forEach((b) => { const pv = b.querySelector('canvas'), out = filter(flat, b.dataset.k), r = 56 / Math.max(out.width, out.height);
            pv.width = Math.round(out.width * r); pv.height = Math.round(out.height * r); pv.getContext('2d').drawImage(out, 0, 0, pv.width, pv.height); });
        } catch (e) {} };
        setTimeout(previews, 30); svg.addEventListener('pointerup', () => setTimeout(previews, 30));
        const bAuto = h('button', { class: 'btn sc-ib', html: PatOS.sym('scan') + '<span>' + T('Find Edges') + '</span>' }); bAuto.onclick = () => { pg.corners = findCorners(pg.src); draw(); previews(); };
        const bAll = h('button', { class: 'btn sc-ib', html: PatOS.sym('crop') + '<span>' + T('Whole Photo') + '</span>' }); bAll.onclick = () => { pg.corners = [[0, 0], [W, 0], [W, H], [0, H]]; draw(); previews(); };
        const bRot = h('button', { class: 'btn sc-ib' }); const rotLabel = () => { bRot.innerHTML = PatOS.sym('rotate') + '<span>' + PatOS.esc(T('Rotate') + (pg.turns ? ' · ' + pg.turns * 90 + '°' : '')) + '</span>'; }; rotLabel(); bRot.onclick = () => { pg.turns = (pg.turns + 1) % 4; rotLabel(); };
        const bCancel = h('button', { class: 'btn' }, T(isNew ? 'Retake' : 'Cancel'));
        bCancel.onclick = () => { if (!isNew && pg._backup) Object.assign(pg, pg._backup); camera(); };
        const bKeep = h('button', { class: 'btn primary' }, T(isNew ? 'Keep Scan' : 'Done'));
        bKeep.onclick = () => {
          bKeep.disabled = true; bKeep.textContent = T('Processing…');
          setTimeout(() => { render(pg); if (isNew) pages.push(pg); delete pg._backup; drawStrip(); camera(); }, 30);
        };
        if (!isNew) pg._backup = { corners: pg.corners.map((c) => c.slice()), mode: pg.mode, turns: pg.turns };
        view.append(h('div', { class: 'sc-photo-wrap' }, img, svg));
        stage.append(view, h('div', { class: 'sc-controls' }, h('div', { class: 'sc-row' }, fsel), h('div', { class: 'sc-row' }, bAuto, bAll, bRot, h('div', { style: { flex: 1 } }), bCancel, bKeep)),
          h('div', { class: 'sc-tip' }, T('Drag the corners to the edges of the page.')));
      }

      /* the pages */
      function drawStrip() {
        strip.innerHTML = '';
        count.textContent = pages.length ? pages.length + ' ' + T(pages.length === 1 ? 'page' : 'pages') : '';
        bSave.disabled = !pages.length;
        if (!pages.length) { strip.appendChild(h('div', { class: 'sc-none' }, T('Scanned pages show up here.'))); return; }
        pages.forEach((pg, i) => {
          const t = h('div', { class: 'sc-th' + (editing === pg ? ' on' : '') }, h('img', { src: pg.thumb, alt: T('Page') + ' ' + (i + 1) }), h('span', {}, String(i + 1)),
            h('div', { class: 'sc-th-btns' },
              h('button', { class: 'tbtn', title: T('Move Up'), 'aria-label': T('Move Up'), html: PatOS.sym('up'), disabled: i === 0, onclick: (e) => { e.stopPropagation(); [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; drawStrip(); } }),
              h('button', { class: 'tbtn', title: T('Move Down'), 'aria-label': T('Move Down'), html: PatOS.sym('down'), disabled: i === pages.length - 1, onclick: (e) => { e.stopPropagation(); [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; drawStrip(); } }),
              h('button', { class: 'tbtn', title: T('Delete'), 'aria-label': T('Delete'), html: PatOS.sym('close'), onclick: (e) => { e.stopPropagation(); pages.splice(i, 1); drawStrip(); } })));
          t.onclick = () => edit(pg, false);
          strip.appendChild(t);
        });
      }
      bSave.onclick = async () => {
        if (!pages.length) return;
        const name = await PatOS.ask(T('Save PDF as'), T('Scan') + ' ' + new Date().toLocaleDateString(PatOS.locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'), { icon: 'scanner', ok: T('Save') });
        if (!name) return;
        bSave.disabled = true; bSave.textContent = T('Saving…');
        try {
          const blob = await makePDF(pages.map((p) => p.out));
          const fname = PatOS.fs.uniqueName('/Documents', name.replace(/[\/\\:*?"<>|]/g, '-').replace(/\.pdf$/i, '') + '.pdf');
          await PatOS.fs.writeBlob('/Documents/' + fname, blob);
          PatOS.notify({ title: T('Scan saved'), body: fname + ' · ' + pages.length + ' ' + T(pages.length === 1 ? 'page' : 'pages'), icon: 'scanner', onClick: () => PatOS.openFile('/Documents/' + fname) });
          pages = []; drawStrip(); PatOS.openFile('/Documents/' + fname);
        } catch (e) { PatOS.alertBox(T('The scan couldn’t be saved'), String(e && e.message || e), { icon: 'scanner' }); }
        bSave.textContent = T('Save PDF'); bSave.disabled = !pages.length;
      };
      win.el.addEventListener('keydown', (e) => { if (e.key === ' ' && !editing && stream && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') { e.preventDefault(); const s = stage.querySelector('.sc-shutter'); if (s) s.click(); } });
      win.on('closed', stopCam);
      drawStrip(); camera();
    }
  });
})();
