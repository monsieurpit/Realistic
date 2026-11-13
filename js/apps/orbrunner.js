/* Orb Runner (4.1): an original 3D endless runner (three.js).
   - Worlds: every 1,500 points the road turns into the next world (colors, sky, weather, obstacle shapes, new obstacles).
   - Gems are money: they stay in your wallet and buy balls in the Ball Shop (each drawn by hand, in 2D for the shop and in 3D
     on the road).
   - Power-ups: Magnet (gems come to you), Shield (one free hit), Double (everything counts twice).
   Saved: orbBest, orbWallet, orbOwned, orbBall, orbWorldMax. Light on slow computers: shared geometry and materials, the HUD
   is only written when it changes, and the renderer waits for the graphics chip (PatOS.makeRenderer().paced). */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const G = (en, fr) => (PatOS.lang === 'fr' ? fr : en); // a word that means something else elsewhere in PatOS (shown as is, never translated again)
  const store = PatOS.store;
  const WORLD_EVERY = 1500;

  /* ---------- the worlds ---------- */
  const WORLDS = [
    { name: 'Neon Highway', bg: 0x0b0130, road: 0x140638, grid: 0xff4fd8, edge: 0x5cf2ff, mtn: 0xff2fa3, sun: ['#ffe259', '#ff2fa3'], boxes: [0xff2fa3, 0xff7a18, 0x9d4dff], hemi: [0x8866ff, 0x110022], deco: 'stars', shape: 'box' , props: 'lamps' },
    { name: 'Crystal Caverns', bg: 0x041a33, road: 0x0a2a44, grid: 0x7fe7ff, edge: 0xd8fbff, mtn: 0x4fb8ff, sun: ['#f2fdff', '#4fb8ff'], boxes: [0x7fe7ff, 0xb69bff, 0x5ad1ff], hemi: [0xbfefff, 0x081a30], deco: 'snow', shape: 'crystal' , props: 'spires' },
    { name: 'Ember Core', bg: 0x220503, road: 0x260a06, grid: 0xff5a1f, edge: 0xffc23d, mtn: 0xff3d00, sun: ['#ffe08a', '#ff3d00'], boxes: [0xff4d1a, 0xffa31a, 0xc21a1a], hemi: [0xff9a5d, 0x200400], deco: 'embers', shape: 'rock', moving: true , props: 'rocks' },
    { name: 'Emerald Ruins', bg: 0x03200f, road: 0x0b2a1c, grid: 0x3dffa0, edge: 0xffe17a, mtn: 0x1fd17a, sun: ['#fff6b8', '#2fd67f'], boxes: [0x2fd67f, 0xffd34d, 0x1aa3a3], hemi: [0x9dffd0, 0x02140b], deco: 'fireflies', shape: 'pillar', moving: true, arcs: true , props: 'columns' },
    { name: 'Deep Space', bg: 0x03020c, road: 0x0b0820, grid: 0x8f7bff, edge: 0xff6bd6, mtn: 0x5b3dff, sun: ['#d9ceff', '#5b3dff'], boxes: [0x8f7bff, 0xff6bd6, 0x47d7ff], hemi: [0xa99bff, 0x02020a], deco: 'warp', shape: 'asteroid', moving: true, arcs: true , props: 'planet' },
    { name: 'Aurora Peaks', bg: 0x04142a, road: 0x0a1d2e, grid: 0x5affc8, edge: 0xff7ae0, mtn: 0x2ad6c1, sun: ['#e0fff6', '#ff7ae0'], boxes: [0x5affc8, 0xff7ae0, 0x8fa8ff], hemi: [0xaaffea, 0x020c18], deco: 'snow', shape: 'crystal', moving: true, arcs: true , props: 'aurora' },
    { name: 'Golden Dunes', bg: 0x341606, road: 0x2e1608, grid: 0xffb340, edge: 0xfff0b8, mtn: 0xff8a1f, sun: ['#fff8d0', '#ff6a1f'], boxes: [0xffb340, 0xff6a1f, 0xd4a017], hemi: [0xffd9a0, 0x1a0a02], deco: 'dust', shape: 'pillar', moving: true, arcs: true , props: 'pyramids' },
    { name: 'Prism', bg: 0x0c0018, road: 0x140628, grid: 0xffffff, edge: 0xffffff, mtn: 0xb66bff, sun: ['#ffffff', '#ff4fd8'], boxes: [0xff4f6a, 0x4fd0ff, 0xffe14f], hemi: [0xffffff, 0x100020], deco: 'warp', shape: 'crystal', moving: true, arcs: true, prism: true , props: 'prisms' }
  ];
  const worldAt = (score) => Math.floor(score / WORLD_EVERY);
  const worldOf = (i) => WORLDS[i % WORLDS.length];

  /* ---------- the balls ---------- */
  const BALLS = [
    { id: 'neon', name: 'Neon', price: 0, kind: 'neon', color: '#5cf2ff', glow: 0x5cf2ff },
    { id: 'ruby', name: 'Ruby', price: 150, kind: 'jewel', color: '#ff1f4b', glow: 0xff2a55 },
    { id: 'sapphire', name: 'Sapphire', price: 250, kind: 'jewel', color: '#2a62ff', glow: 0x4a85ff },
    { id: 'emerald', name: 'Emerald', price: 350, kind: 'jewel', color: '#10c96b', glow: 0x2bff9a },
    { id: 'amethyst', name: 'Amethyst', price: 500, kind: 'jewel', color: '#9b4dff', glow: 0xb06bff },
    { id: 'opal', name: 'Opal', price: 700, kind: 'tex', tex: 'opal', glow: 0xd4f2ff },
    { id: 'magma', name: 'Magma', price: 900, kind: 'tex', tex: 'lava', glow: 0xff5a1f },
    { id: 'galaxy', name: 'Galaxy', price: 1200, kind: 'tex', tex: 'galaxy', glow: 0xa58bff },
    { id: 'royal', name: 'Royal Gold', price: 1600, kind: 'studded', tex: 'gold', studs: ['#ff1f4b', '#2a62ff', '#10c96b', '#ffffff'], glow: 0xffc94d },
    { id: 'diamond', name: 'Diamond', price: 2200, kind: 'jewel', color: '#eaf7ff', glow: 0xe4f6ff, sats: ['#ffffff', '#bfe8ff', '#ffffff'] },
    { id: 'prism', name: 'Prism', price: 3000, kind: 'prism', glow: 0xffffff, sats: ['#ff4f6a', '#ffb14f', '#ffe14f', '#4fff9a', '#4fd0ff', '#b06bff'] }
  ];
  const ballOf = (id) => BALLS.find((b) => b.id === id) || BALLS[0];

  /* ---------- drawing (shared by the shop and the 3D balls) ---------- */
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  function shade(col, amt) { // lighter (amt > 0) or darker (amt < 0)
    const n = parseInt(col.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt));
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const texCache = {};
  /* a 512 × 256 picture wrapped around a ball */
  function texture(kind) {
    if (texCache[kind]) return texCache[kind];
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); seed = kind.length * 977 + 13;
    if (kind === 'opal') {
      x.fillStyle = '#eef7ff'; x.fillRect(0, 0, 512, 256); x.globalCompositeOperation = 'multiply';
      const cols = ['#ff9ad5', '#8affc8', '#86c5ff', '#ffe08a', '#c6a2ff'];
      for (let i = 0; i < 70; i++) { const px = rnd() * 512, py = rnd() * 256, r = 16 + rnd() * 50; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, cols[i % cols.length]); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 90; i++) { const px = rnd() * 512, py = rnd() * 256; x.fillStyle = 'rgba(' + [255, 200 + rnd() * 55, 255].map(Math.round).join(',') + ',' + (0.15 + rnd() * 0.3) + ')'; x.beginPath(); x.ellipse(px, py, 3 + rnd() * 10, 1 + rnd() * 3, rnd() * 3, 0, 7); x.fill(); }
    } else if (kind === 'lava') {
      x.fillStyle = '#1b0b07'; x.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(' + (40 + rnd() * 30) + ',' + (18 + rnd() * 14) + ',12,' + (0.4 + rnd() * 0.5) + ')'; x.beginPath(); x.arc(rnd() * 512, rnd() * 256, 4 + rnd() * 16, 0, 7); x.fill(); }
      x.lineCap = 'round'; x.lineJoin = 'round';
      for (let i = 0; i < 26; i++) {
        let px = rnd() * 512, py = rnd() * 256; x.beginPath(); x.moveTo(px, py);
        for (let k = 0; k < 9; k++) { px += (rnd() - 0.5) * 70; py += (rnd() - 0.5) * 40; x.lineTo(px, py); }
        x.shadowColor = '#ff5a1f'; x.shadowBlur = 14; x.strokeStyle = '#ff6a1f'; x.lineWidth = 2 + rnd() * 4; x.stroke(); x.shadowBlur = 0; x.strokeStyle = '#ffd36b'; x.lineWidth = 1; x.stroke();
      }
    } else if (kind === 'galaxy') {
      const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#0a0624'); g.addColorStop(0.5, '#160a3a'); g.addColorStop(1, '#050414'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
      x.globalCompositeOperation = 'lighter';
      [['#6b3dff', 0.5], ['#ff4fd8', 0.35], ['#2fb5ff', 0.4]].forEach(([col, a]) => { for (let i = 0; i < 9; i++) { const px = rnd() * 512, py = 60 + rnd() * 140, r = 40 + rnd() * 70; const rg = x.createRadialGradient(px, py, 0, px, py, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a * 0.5; x.fillStyle = rg; x.fillRect(px - r, py - r, r * 2, r * 2); } });
      x.globalAlpha = 1;
      for (let i = 0; i < 520; i++) { const px = rnd() * 512, py = rnd() * 256, r = rnd() < 0.94 ? 0.4 + rnd() * 0.9 : 1.6 + rnd(); x.fillStyle = 'rgba(255,255,255,' + (0.5 + rnd() * 0.5) + ')'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); if (r > 1.7) { x.fillRect(px - 6, py - 0.4, 12, 0.8); x.fillRect(px - 0.4, py - 6, 0.8, 12); } }
    } else if (kind === 'gold') {
      const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#fff1b0'); g.addColorStop(0.35, '#f4c542'); g.addColorStop(0.7, '#c98a12'); g.addColorStop(1, '#8a5a06'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
      x.strokeStyle = 'rgba(110,64,0,.55)'; x.lineWidth = 2;
      for (let i = 0; i < 16; i++) { const px = i * 32 + 16; for (let k = 0; k < 4; k++) { const py = 32 + k * 64; x.beginPath(); x.arc(px, py, 10, 0.3, 5.5); x.stroke(); x.beginPath(); x.arc(px + 8, py + 4, 5, 3, 8.5); x.stroke(); } }
      x.strokeStyle = 'rgba(255,248,210,.6)'; x.lineWidth = 1.5; [64, 128, 192].forEach((py) => { x.beginPath(); x.moveTo(0, py); x.lineTo(512, py); x.stroke(); });
    }
    texCache[kind] = c; return c;
  }
  const fib = (n) => Array.from({ length: n }, (_, i) => { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; return [Math.cos(th) * r, y, Math.sin(th) * r]; });
  function star4(x, cx, cy, r, a) { x.save(); x.globalAlpha = a; x.fillStyle = '#fff'; x.beginPath(); x.moveTo(cx, cy - r); x.quadraticCurveTo(cx, cy, cx + r, cy); x.quadraticCurveTo(cx, cy, cx, cy + r); x.quadraticCurveTo(cx, cy, cx - r, cy); x.quadraticCurveTo(cx, cy, cx, cy - r); x.fill(); x.restore(); }
  function gemShape(x, cx, cy, r, col) { // a small cut gem, seen from the front
    const g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, shade(col, 0.55)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.45));
    x.fillStyle = g; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r * 0.45, cy - r * 0.1); x.lineTo(cx - r * 0.2, cy - r * 0.1); x.closePath(); x.fill();
  }
  /* the shop picture of a ball, on a square canvas */
  function drawBall(cv, b) {
    const s = cv.width, x = cv.getContext('2d'), cx = s / 2, cy = s * 0.47, r = s * 0.34;
    x.clearRect(0, 0, s, s);
    const sh = x.createRadialGradient(cx, s * 0.9, 0, cx, s * 0.9, r); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sh; x.beginPath(); x.ellipse(cx, s * 0.9, r * 0.9, r * 0.2, 0, 0, 7); x.fill();
    x.save(); x.shadowColor = hex(b.glow); x.shadowBlur = s * 0.12; x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.restore(); // glow
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip();
    if (b.kind === 'neon') {
      const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r); g.addColorStop(0, '#f0ffff'); g.addColorStop(0.35, '#5cf2ff'); g.addColorStop(1, '#0a4fb8'); x.fillStyle = g; x.fillRect(0, 0, s, s);
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = s * 0.012; [0.55, 0.8].forEach((k) => { x.beginPath(); x.ellipse(cx, cy, r, r * k * 0.5, 0.4, 0, 7); x.stroke(); });
    } else if (b.kind === 'jewel' || b.kind === 'prism') {
      const base = b.color || '#ffffff'; const n = 16, tr = r * 0.46;
      const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r); g.addColorStop(0, shade(base, 0.4)); g.addColorStop(0.6, base); g.addColorStop(1, shade(base, -0.55)); x.fillStyle = g; x.fillRect(0, 0, s, s);
      for (let i = 0; i < n; i++) { // the crown facets, between the table and the edge
        const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2, am = (a0 + a1) / 2;
        const col = b.kind === 'prism' ? 'hsl(' + Math.round(i / n * 360) + ',95%,62%)' : base; const light = Math.cos(am + 2.2);
        x.fillStyle = b.kind === 'prism' ? col : shade(base, light > 0 ? light * 0.55 : light * 0.5);
        x.beginPath(); x.moveTo(cx + Math.cos(i % 2 ? a0 : am) * tr, cy + Math.sin(i % 2 ? a0 : am) * tr); x.lineTo(cx + Math.cos(a0) * r * 1.02, cy + Math.sin(a0) * r * 1.02); x.lineTo(cx + Math.cos(a1) * r * 1.02, cy + Math.sin(a1) * r * 1.02); x.closePath(); x.fill();
      }
      const tg = x.createLinearGradient(cx - tr, cy - tr, cx + tr, cy + tr); tg.addColorStop(0, b.kind === 'prism' ? '#ffffff' : shade(base, 0.7)); tg.addColorStop(1, b.kind === 'prism' ? '#ffd1f4' : shade(base, 0.05));
      x.fillStyle = tg; x.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 8; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * tr, cy + Math.sin(a) * tr); } x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = s * 0.006; x.stroke();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 8; x.beginPath(); x.moveTo(cx + Math.cos(a) * tr, cy + Math.sin(a) * tr); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.stroke(); }
    } else {
      x.drawImage(texture(b.tex), 128, 0, 256, 256, cx - r, cy - r, r * 2, r * 2);
      if (b.kind === 'studded') fib(30).forEach(([px, py, pz], i) => { if (pz < 0.15) return; gemShape(x, cx + px * r * 0.92, cy - py * r * 0.92, s * 0.03 * (0.55 + pz * 0.6), b.studs[i % b.studs.length]); });
    }
    const sg = x.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.4, cx, cy, r * 1.05); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.5)'); x.fillStyle = sg; x.fillRect(0, 0, s, s); // roundness
    const hl = x.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 0, cx - r * 0.38, cy - r * 0.45, r * 0.5); hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = hl; x.fillRect(0, 0, s, s);
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = s * 0.008; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    if (b.sats) b.sats.forEach((col, i) => { const a = (i / b.sats.length) * Math.PI * 2 + 0.6; const px = cx + Math.cos(a) * r * 1.32, py = cy + Math.sin(a) * r * 0.42; if (Math.sin(a) < 0) gemShape(x, px, py, s * 0.035, col); });
    if (b.kind === 'jewel' || b.kind === 'prism' || b.kind === 'studded') { star4(x, cx - r * 0.42, cy - r * 0.5, s * 0.05, 0.95); star4(x, cx + r * 0.55, cy - r * 0.15, s * 0.028, 0.75); star4(x, cx + r * 0.1, cy + r * 0.62, s * 0.022, 0.6); }
    if (b.sats) b.sats.forEach((col, i) => { const a = (i / b.sats.length) * Math.PI * 2 + 0.6; const px = cx + Math.cos(a) * r * 1.32, py = cy + Math.sin(a) * r * 0.42; if (Math.sin(a) >= 0) gemShape(x, px, py, s * 0.045, col); });
  }
  /* a round glow (particles, power-ups) */
  function dotTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; }
  function iconTex(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.lineCap = 'round'; x.lineJoin = 'round'; x.shadowColor = 'rgba(255,255,255,.9)'; x.shadowBlur = 10;
    if (kind === 'magnet') { x.lineWidth = 20; x.strokeStyle = '#ff3d5a'; x.beginPath(); x.arc(64, 58, 28, Math.PI, 0, true); x.stroke(); x.beginPath(); x.moveTo(36, 58); x.lineTo(36, 92); x.moveTo(92, 58); x.lineTo(92, 92); x.stroke(); x.strokeStyle = '#ffffff'; x.beginPath(); x.moveTo(36, 84); x.lineTo(36, 98); x.moveTo(92, 84); x.lineTo(92, 98); x.stroke(); }
    else if (kind === 'shield') { x.fillStyle = '#4fd0ff'; x.beginPath(); x.moveTo(64, 18); x.lineTo(102, 32); x.quadraticCurveTo(100, 88, 64, 110); x.quadraticCurveTo(28, 88, 26, 32); x.closePath(); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.moveTo(64, 30); x.lineTo(90, 40); x.quadraticCurveTo(88, 80, 64, 96); x.closePath(); x.fill(); }
    else { x.fillStyle = '#ffd34d'; x.font = '900 64px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('×2', 64, 68); }
    return c;
  }
  const POWERS = { magnet: { name: 'Magnet', color: 0xff3d5a, time: 8 }, shield: { name: 'Shield', color: 0x4fd0ff, time: 0 }, double: { name: 'Double', color: 0xffd34d, time: 10 } };

  PatOS.registerApp({
    needs3D: true, id: 'orbrunner', name: 'Orb Runner', icon: 'orbrunner', width: 960, height: 620, dark: true, category: '3D & Games', keywords: 'game 3d play racing runner balls shop worlds jeu boules',
    launch(win) {
      const canvas = h('canvas', { class: 'g3d' });
      const hud = h('div', { class: 'or-hud' }); const banner = h('div', { class: 'or-banner' });
      const overlay = h('div', { class: 'or-over' });
      const stage = h('div', { class: 'g3d-stage or-stage' }, canvas, hud, banner, overlay);
      win.body.appendChild(stage);
      if (!PatOS.has3D) { stage.innerHTML = '<div class="app-error">' + T('Orb Runner needs WebGL.') + '</div>'; return; }
      const renderer = PatOS.makeRenderer(canvas, { antialias: true });
      const scene = new THREE.Scene(); const W0 = WORLDS[0];
      scene.fog = new THREE.Fog(W0.bg, 20, 120); renderer.setClearColor(W0.bg, 1);
      const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 300);
      const hemi = new THREE.HemisphereLight(W0.hemi[0], W0.hemi[1], 1.2); scene.add(hemi);
      const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(5, 10, 6); scene.add(dl);
      const dot = new THREE.CanvasTexture(dotTex());

      // sky: a sun with stripes, drawn again when the world changes
      const sunC = document.createElement('canvas'); sunC.width = sunC.height = 256; const sx = sunC.getContext('2d');
      const sunTex = new THREE.CanvasTexture(sunC);
      function drawSun(c1, c2) { sx.clearRect(0, 0, 256, 256); sx.globalCompositeOperation = 'source-over'; const g = sx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, c1); g.addColorStop(1, c2); sx.fillStyle = g; sx.beginPath(); sx.arc(128, 128, 126, 0, 7); sx.fill(); sx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 8; i++) sx.fillRect(0, 140 + i * 15, 256, 3 + i); sunTex.needsUpdate = true; }
      drawSun(W0.sun[0], W0.sun[1]);
      const sun = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false })); sun.position.set(0, 18, -200); scene.add(sun);
      const stG = new THREE.BufferGeometry(); const stP = new Float32Array(900 * 3);
      for (let i = 0; i < 900; i++) stP.set([(Math.random() - 0.5) * 400, 10 + Math.random() * 120, -150 - Math.random() * 60], i * 3);
      stG.setAttribute('position', new THREE.BufferAttribute(stP, 3)); scene.add(new THREE.Points(stG, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, fog: false })));

      // road, grid lines, edges, mountains
      const LANE = 2.6, LANES = [-LANE, 0, LANE];
      const roadM = new THREE.MeshStandardMaterial({ color: W0.road, metalness: 0.4, roughness: 0.6 });
      const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 400), roadM); road.rotation.x = -Math.PI / 2; road.position.z = -150; scene.add(road);
      const gl = []; for (let x = -20; x <= 20; x += 2.5) gl.push(x, 0, -350, x, 0, 50); for (let z = -350; z <= 50; z += 2.5) gl.push(-20, 0, z, 20, 0, z);
      const gridG = new THREE.BufferGeometry(); gridG.setAttribute('position', new THREE.Float32BufferAttribute(gl, 3));
      const gridM = new THREE.LineBasicMaterial({ color: W0.grid, transparent: true, opacity: 0.35 }); const grid = new THREE.LineSegments(gridG, gridM); grid.position.y = 0.01; scene.add(grid);
      const edgeM = new THREE.MeshBasicMaterial({ color: W0.edge });
      [-5, 5].forEach((x) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 400), edgeM); e.position.set(x, 0.1, -150); scene.add(e); });
      const mtnM = new THREE.MeshBasicMaterial({ color: W0.mtn, wireframe: true, transparent: true, opacity: 0.25 });
      const mtn = new THREE.Mesh(new THREE.PlaneGeometry(400, 60, 80, 12), mtnM);
      const mp = mtn.geometry.attributes.position; for (let i = 0; i < mp.count; i++) { const x = mp.getX(i); if (Math.abs(x) > 14) mp.setZ(i, Math.random() * Math.min(18, (Math.abs(x) - 14) * 0.6)); }
      mtn.rotation.x = -Math.PI / 2; mtn.position.set(0, 0, -150); scene.add(mtn);

      // the world's weather (snow, embers, fireflies, stars rushing by, dust)
      const DN = 240; const decoG = new THREE.BufferGeometry(); const decoP = new Float32Array(DN * 3); const decoS = new Float32Array(DN);
      for (let i = 0; i < DN; i++) { decoP.set([(Math.random() - 0.5) * 60, Math.random() * 22, -120 + Math.random() * 130], i * 3); decoS[i] = Math.random() * 6.28; }
      decoG.setAttribute('position', new THREE.BufferAttribute(decoP, 3));
      const decoM = new THREE.PointsMaterial({ color: W0.edge, size: 0.35, map: dot, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
      const deco = new THREE.Points(decoG, decoM); scene.add(deco); let decoKind = W0.deco;
      if (PatOS.settings.quality3d === 'low') deco.visible = false; // (slow computers: no weather)

      // scenery along the road, one set per world (it grows in when the world arrives)
      const propMats = {}; const pm = (k, o) => propMats[k] || (propMats[k] = new THREE.MeshStandardMaterial(Object.assign({ metalness: 0.3, roughness: 0.5, flatShading: true }, o)));
      function buildProps(kind) {
        const g = new THREE.Group(); const side = (i) => (i % 2 ? 1 : -1); const along = (i, n) => -140 + (i / n) * 150;
        if (kind === 'lamps') for (let i = 0; i < 20; i++) { const p = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), pm('pole', { color: 0x2a1b4a })); pole.position.y = 2.5; const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0x5cf2ff })); lamp.position.set(-side(i) * 0.6, 5, 0); p.add(pole, lamp); p.position.set(side(i) * 6.2, 0, along(i, 20)); g.add(p); }
        else if (kind === 'spires') for (let i = 0; i < 22; i++) { const p = new THREE.Group(); for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), pm('ice', { color: 0xbff0ff, emissive: 0x2a7fd4, emissiveIntensity: 0.5, transparent: true, opacity: 0.85, roughness: 0.1 })); s.scale.set(0.5 + Math.random() * 0.4, 1.6 + Math.random() * 2.4, 0.5); s.position.set((k - 1) * 0.9, s.scale.y * 0.7, (Math.random() - 0.5) * 1.5); s.rotation.z = (k - 1) * 0.25; p.add(s); } p.position.set(side(i) * (8 + Math.random() * 6), 0, along(i, 22)); g.add(p); }
        else if (kind === 'rocks') for (let i = 0; i < 22; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 1.6, 0), pm('rock', { color: 0x2a0d06, emissive: 0xff3d00, emissiveIntensity: 0.25 })); s.position.set(side(i) * (8 + Math.random() * 7), 0.4, along(i, 22)); s.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(s); }
        else if (kind === 'columns') for (let i = 0; i < 18; i++) { const hgt = 2 + Math.random() * 4; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, hgt, 10), pm('stone', { color: 0xc9c09a, emissive: 0x1a3a22, emissiveIntensity: 0.3, roughness: 0.8 })); s.position.set(side(i) * (7.5 + Math.random() * 3), hgt / 2, along(i, 18)); s.rotation.z = (Math.random() - 0.5) * 0.15; g.add(s); const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.6), propMats.stone); cap.position.set(s.position.x, hgt + 0.15, s.position.z); g.add(cap); }
        else if (kind === 'pyramids') for (let i = 0; i < 10; i++) { const sz = 4 + Math.random() * 6; const s = new THREE.Mesh(new THREE.ConeGeometry(sz, sz * 0.9, 4), pm('sand', { color: 0xe0a24a, emissive: 0x5a2a06, emissiveIntensity: 0.3, roughness: 0.9 })); s.position.set(side(i) * (14 + Math.random() * 10), sz * 0.45, along(i, 10)); s.rotation.y = Math.PI / 4; g.add(s); }
        else if (kind === 'prisms') for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.9 + Math.random() * 0.6, 0), pm('prism' + (i % 3), { color: [0xff4f6a, 0x4fd0ff, 0xffe14f][i % 3], emissive: [0xff4f6a, 0x4fd0ff, 0xffe14f][i % 3], emissiveIntensity: 0.5, transparent: true, opacity: 0.85 })); s.position.set(side(i) * (7 + Math.random() * 6), 2 + Math.random() * 4, along(i, 18)); s.userData.spin = 0.5 + Math.random(); g.add(s); }
        else if (kind === 'planet') { const p = new THREE.Group(); const ball = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 20), new THREE.MeshStandardMaterial({ color: 0x6b4dff, emissive: 0x2a1580, emissiveIntensity: 0.6, roughness: 0.8, fog: false })); const ring = new THREE.Mesh(new THREE.RingGeometry(18, 26, 64), new THREE.MeshBasicMaterial({ color: 0xff9be0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, fog: false })); ring.rotation.x = 1.25; p.add(ball, ring); p.position.set(-55, 40, -180); p.userData.sky = true; g.add(p); }
        else if (kind === 'aurora') { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,122,224,0)'); gr.addColorStop(0.4, 'rgba(255,122,224,.55)'); gr.addColorStop(0.75, 'rgba(90,255,200,.75)'); gr.addColorStop(1, 'rgba(90,255,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 64); const tx = new THREE.CanvasTexture(c);
          for (let k = 0; k < 3; k++) { const geo = new THREE.PlaneGeometry(260, 34, 40, 1); const pp = geo.attributes.position; for (let v = 0; v < pp.count; v++) pp.setZ(v, Math.sin(pp.getX(v) * 0.04 + k) * 14); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.position.set(0, 48 + k * 8, -170 + k * 10); m.userData.wave = k; g.add(m); } g.userData.sky = true; }
        g.children.forEach((c) => { c.userData.full = c.scale.clone(); }); return g;
      }
      const propSets = {}; let propsOn = null, propsOff = null, propK = 1;
      function showProps(kind) { if (propsOn && propsOn.userData.kind === kind) return; if (propsOff) scene.remove(propsOff); propsOff = propsOn; propsOn = propSets[kind] || (propSets[kind] = buildProps(kind)); propsOn.userData.kind = kind; scene.add(propsOn); propK = 0; }
      showProps(W0.props); propK = 1;

      // obstacles and pickups (shared shapes and materials)
      const SHAPES = {
        box: new THREE.BoxGeometry(2, 1.6, 1.2),
        crystal: (() => { const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.95, 1.25, 0.8); return g; })(),
        rock: new THREE.DodecahedronGeometry(0.98, 0),
        pillar: new THREE.CylinderGeometry(0.85, 0.95, 1.7, 8),
        asteroid: new THREE.IcosahedronGeometry(0.98, 0)
      };
      const beamGeo = new THREE.BoxGeometry(2.3, 0.45, 0.5), gemGeo = new THREE.OctahedronGeometry(0.42), moverGeo = new THREE.IcosahedronGeometry(0.85, 1);
      const boxMats = W0.boxes.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.3, flatShading: true }));
      const beamM = new THREE.MeshStandardMaterial({ color: W0.edge, emissive: W0.edge, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.4 });
      const moverM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2050, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.3, flatShading: true });
      const gemMat = new THREE.MeshStandardMaterial({ color: 0xffe259, emissive: 0xffb300, emissiveIntensity: 0.9, flatShading: true });
      const bubbleGeo = new THREE.SphereGeometry(0.62, 20, 12);
      const powerLook = {}; Object.keys(POWERS).forEach((k) => { powerLook[k] = { bubble: new THREE.MeshStandardMaterial({ color: POWERS[k].color, emissive: POWERS[k].color, emissiveIntensity: 0.35, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.2 }), icon: new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(iconTex(k)), transparent: true, depthWrite: false }) }; });
      const tetra = new THREE.TetrahedronGeometry(0.15); const partMats = [new THREE.MeshBasicMaterial({ color: 0x5cf2ff }), new THREE.MeshBasicMaterial({ color: 0xff4fd8 })];

      // the player's ball
      const holder = new THREE.Group(); scene.add(holder); // follows the ball without rolling (light, shield, orbiting gems)
      let orb = null; const sats = []; let prismGeo = null; let ballDef = null;
      const glow = new THREE.PointLight(0x5cf2ff, 30, 12); holder.add(glow);
      const shieldM = new THREE.MeshStandardMaterial({ color: 0x4fd0ff, emissive: 0x4fd0ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.22, depthWrite: false });
      const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 14), shieldM); shieldMesh.visible = false; holder.add(shieldMesh);
      const trailG = new THREE.BufferGeometry(); const TR = 40; const trP = new Float32Array(TR * 3); trailG.setAttribute('position', new THREE.BufferAttribute(trP, 3));
      const trailM = new THREE.PointsMaterial({ color: 0x5cf2ff, size: 0.16, map: dot, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }); const trail = new THREE.Points(trailG, trailM); scene.add(trail);
      const disposeOrb = () => { if (!orb) return; holder.remove(orb); orb.traverse((o) => { if (o.material && o.material.map) o.material.map.dispose(); if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== gemGeo) o.geometry.dispose(); }); sats.splice(0).forEach((m) => { holder.remove(m); m.material.dispose(); }); orb = null; prismGeo = null; };
      function makeBall(b) {
        disposeOrb(); ballDef = b;
        if (b.kind === 'neon') orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), new THREE.MeshStandardMaterial({ color: 0x5cf2ff, emissive: 0x1a8cff, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.2 }));
        else if (b.kind === 'jewel') {
          const col = new THREE.Color(b.color);
          orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), new THREE.MeshPhysicalMaterial({ color: col, emissive: col.clone().multiplyScalar(b.id === 'diamond' ? 0.35 : 0.3), metalness: 0.25, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true, transparent: true, opacity: 0.9 }));
          orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), 0.5) }))); // a glow inside
        } else if (b.kind === 'prism') {
          prismGeo = new THREE.IcosahedronGeometry(0.74, 0).toNonIndexed(); prismGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(prismGeo.attributes.position.count * 3), 3));
          orb = new THREE.Mesh(prismGeo, new THREE.MeshPhysicalMaterial({ vertexColors: true, emissive: 0x333333, metalness: 0.2, roughness: 0.08, clearcoat: 1, flatShading: true }));
        } else {
          const tx = new THREE.CanvasTexture(texture(b.tex)); tx.colorSpace = THREE.SRGBColorSpace;
          const glowy = b.tex === 'lava' ? 1.4 : b.tex === 'galaxy' ? 0.9 : b.tex === 'opal' ? 0.35 : 0.15;
          orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 40, 22), new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: glowy, metalness: b.tex === 'gold' ? 0.75 : 0.15, roughness: b.tex === 'gold' ? 0.3 : 0.25 }));
          if (b.kind === 'studded') fib(30).forEach(([x, y, z], i) => { const c = new THREE.Color(b.studs[i % b.studs.length]); const g = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, flatShading: true, metalness: 0.3, roughness: 0.1 })); g.scale.setScalar(0.13); g.scale.y = 0.1; g.position.set(x * 0.7, y * 0.7, z * 0.7); g.lookAt(x * 2, y * 2, z * 2); orb.add(g); });
        }
        if (b.sats) b.sats.forEach((c) => { const col = new THREE.Color(c); const m = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.7, flatShading: true })); m.scale.setScalar(0.38); holder.add(m); sats.push(m); });
        holder.add(orb); glow.color.setHex(b.glow); trailM.color.setHex(b.glow);
      }

      // what is saved
      const owned = () => { const l = store.get('orbOwned', ['neon']) || ['neon']; return l.includes('neon') ? l : ['neon'].concat(l); };
      const wallet = () => Math.max(0, +store.get('orbWallet', 0) || 0);
      const addGems = (n) => store.set('orbWallet', wallet() + n);
      makeBall(ballOf(store.get('orbBall', 'neon')));

      let objs = [], parts = [];
      const S = { state: 'menu', lane: 1, x: 0, y: 0.7, vy: 0, speed: 18, dist: 0, pts: 0, score: 0, gems: 0, spawnZ: -40, best: +store.get('orbBest', 0) || 0, shake: 0, world: 0, power: {}, shield: false, safe: 0, newBest: false };

      /* ---------- worlds: changing smoothly from one to the next ---------- */
      const colorsOf = (w) => ({ bg: new THREE.Color(w.bg), road: new THREE.Color(w.road), grid: new THREE.Color(w.grid), edge: new THREE.Color(w.edge), mtn: new THREE.Color(w.mtn), h0: new THREE.Color(w.hemi[0]), h1: new THREE.Color(w.hemi[1]), b: w.boxes.map((c) => new THREE.Color(c)) });
      let shift = null; const tmp = new THREE.Color();
      function applyColors(a, b, k) {
        const L = (x, y) => tmp.lerpColors(x, y, k);
        renderer.setClearColor(L(a.bg, b.bg), 1); scene.fog.color.copy(tmp);
        roadM.color.copy(L(a.road, b.road)); gridM.color.copy(L(a.grid, b.grid)); edgeM.color.copy(L(a.edge, b.edge)); beamM.color.copy(tmp); beamM.emissive.copy(tmp); decoM.color.copy(tmp);
        mtnM.color.copy(L(a.mtn, b.mtn)); hemi.color.copy(L(a.h0, b.h0)); hemi.groundColor.copy(L(a.h1, b.h1));
        boxMats.forEach((m, i) => { m.color.copy(L(a.b[i], b.b[i])); m.emissive.copy(tmp); });
      }
      function goWorld(i, instant) {
        const from = worldOf(S.world), to = worldOf(i); S.world = i;
        if (instant) { applyColors(colorsOf(to), colorsOf(to), 1); drawSun(to.sun[0], to.sun[1]); decoKind = to.deco; shift = null; showProps(to.props); propK = 1; if (propsOff) { scene.remove(propsOff); propsOff = null; } return; }
        shift = { a: colorsOf(from), b: colorsOf(to), from, to, p: 0, frame: 0 };
        banner.innerHTML = ''; banner.append(h('small', {}, T('World') + ' ' + (i + 1)), h('b', {}, T(to.name)));
        banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
        PatOS.sound.tone(520, 0.18, { vol: 0.07 }); PatOS.sound.tone(780, 0.24, { vol: 0.06, delay: 0.12 }); PatOS.sound.tone(1040, 0.3, { vol: 0.05, delay: 0.24 });
        if (i + 1 > (+store.get('orbWorldMax', 1) || 1)) store.set('orbWorldMax', i + 1);
      }
      const mixCss = (c1, c2, k) => '#' + tmp.lerpColors(new THREE.Color(c1), new THREE.Color(c2), k).getHexString();

      function reset() {
        objs.forEach((o) => scene.remove(o.m)); objs = [];
        Object.assign(S, { lane: 1, x: 0, y: 0.7, vy: 0, speed: 18, dist: 0, pts: 0, score: 0, gems: 0, spawnZ: -30, power: {}, shield: false, safe: 0, newBest: false });
        shieldMesh.visible = false; holder.visible = true; goWorld(0, true); S.world = 0;
      }
      const W = () => worldOf(S.world);
      function add(m, o) { scene.add(m); objs.push(Object.assign({ m }, o)); }
      function gem(x, y, z) { const g = new THREE.Mesh(gemGeo, gemMat); g.position.set(x, y, z); add(g, { type: 'gem', baseY: y }); }
      function spawnRow(z) {
        const w = W(); const r = Math.random();
        if (w.moving && S.dist > 200 && r < 0.14) { // a ball that rolls across the lanes
          const m = new THREE.Mesh(moverGeo, moverM); m.position.set(0, 0.85, z); add(m, { type: 'box', mover: true, phase: Math.random() * 6.28 }); return;
        }
        if (w.arcs && r > 0.9) { // a beam to jump, with gems in the air above it
          const lane = Math.floor(Math.random() * 3); const b = new THREE.Mesh(beamGeo, beamM); b.position.set(LANES[lane], 0.25, z); add(b, { type: 'box', low: true });
          for (let k = -3; k <= 3; k++) gem(LANES[lane], 1.1 + (9 - k * k) * 0.22, z + k * 1.4); return;
        }
        const free = Math.floor(Math.random() * 3); const pattern = Math.random();
        LANES.forEach((x, i) => {
          if (i === free) {
            const p = Math.random(); const kinds = Object.keys(POWERS).filter((k) => !(k === 'shield' ? S.shield : S.power[k]));
            if (S.dist > 250 && p < 0.045 && kinds.length) { const k = kinds[Math.floor(Math.random() * kinds.length)]; const grp = new THREE.Group(); grp.add(new THREE.Mesh(bubbleGeo, powerLook[k].bubble)); const sp = new THREE.Sprite(powerLook[k].icon); sp.scale.setScalar(0.8); grp.add(sp); grp.position.set(x, 1.1, z); add(grp, { type: 'power', kind: k, baseY: 1.1 }); }
            else if (p < 0.75) gem(x, 1, z);
            return;
          }
          if (pattern < 0.35 && Math.random() < 0.5) return;
          const low = Math.random() < 0.25 && S.dist > 300;
          const b = low ? new THREE.Mesh(beamGeo, beamM) : new THREE.Mesh(SHAPES[w.shape] || SHAPES.box, boxMats[i]);
          if (low) b.position.set(x, 0.25, z); else { b.position.set(x, 0.85, z); b.rotation.y = w.shape === 'box' ? 0 : Math.random() * 6.28; }
          add(b, { type: 'box', low });
        });
      }
      function burst(pos, n, mats) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(tetra, mats[i % mats.length]); m.position.copy(pos); scene.add(m); parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.4, (Math.random() - 0.5) * 0.4), life: 1.2 + Math.random() * 0.4 }); } }
      function boom() {
        S.state = 'over'; S.shake = 1; holder.visible = false; PatOS.sound.tone(90, 0.7, { vol: 0.3, type: 'sawtooth', slide: 30 });
        partMats[0].color.setHex(ballDef.glow); burst(holder.position, 110, partMats);
        if (S.score > S.best) { S.best = S.score; S.newBest = true; store.set('orbBest', S.best); }
        setTimeout(() => { if (S.state === 'over') showOverlay('over'); }, 700);
      }
      function hit(o, i) {
        if (S.safe > 0) return;
        if (S.shield) { S.shield = false; shieldMesh.visible = false; S.safe = 1; S.shake = 0.5; partMats[0].color.setHex(0x4fd0ff); burst(o.m.position, 40, partMats); scene.remove(o.m); objs.splice(i, 1); PatOS.sound.tone(300, 0.25, { vol: 0.12, slide: 120 }); return; }
        boom();
      }
      function takePower(k) {
        if (k === 'shield') { S.shield = true; shieldMesh.visible = true; } else S.power[k] = POWERS[k].time;
        PatOS.sound.tone(660, 0.1, { vol: 0.08 }); PatOS.sound.tone(990, 0.16, { vol: 0.07, delay: 0.08 });
      }

      /* ---------- screens: menu, game over, Ball Shop ---------- */
      const gemSym = () => h('span', { class: 'or-gem', html: PatOS.sym('gem') });
      const chip = (...k) => h('span', { class: 'or-chip' }, ...k);
      function showOverlay(kind) {
        overlay.classList.remove('hidden', 'shop'); overlay.classList.toggle('menu', kind === 'menu'); overlay.innerHTML = '';
        if (kind === 'menu') {
          overlay.append(h('h1', {}, 'ORB RUNNER'),
            h('div', { class: 'or-chips' }, chip(T('Best') + ' ', h('b', {}, String(S.best))), chip(gemSym(), h('b', {}, String(wallet()))), chip(T('World') + ' ', h('b', {}, String(+store.get('orbWorldMax', 1) || 1)))),
            h('div', { class: 'or-btns' }, h('button', { class: 'or-btn', translate: 'no', onclick: start }, G('Play', 'Jouer')), h('button', { class: 'or-btn ghost', onclick: shop }, T('Balls'))),
            h('small', { class: 'or-keys' }, T('← → to switch lanes · Space to jump')));
        } else {
          const w = worldOf(S.world);
          overlay.append(h('h1', { class: 'sm' }, S.newBest ? T('New Best') : T('Game Over')),
            h('div', { class: 'or-stats' }, h('div', {}, h('b', {}, String(S.score)), h('small', { translate: 'no' }, G('Score', 'Score'))), h('div', {}, h('b', {}, '+' + S.gems), h('small', {}, T('Gems'))), h('div', {}, h('b', {}, String(S.world + 1)), h('small', {}, T(w.name)))),
            h('div', { class: 'or-btns' }, h('button', { class: 'or-btn', onclick: start }, T('Play Again')), h('button', { class: 'or-btn ghost', onclick: shop }, T('Balls'))),
            h('small', { class: 'or-keys' }, S.newBest ? '' : T('Best') + ' ' + S.best));
        }
        setTimeout(() => { const b = overlay.querySelector('.or-btn'); if (b) b.focus(); }, 30);
      }
      function shop() {
        S.state = 'shop'; holder.visible = true; overlay.classList.remove('hidden', 'menu'); overlay.classList.add('shop'); overlay.innerHTML = '';
        const purse = h('b', {}, String(wallet())); const list = h('div', { class: 'or-shelf' });
        overlay.append(h('div', { class: 'or-shop-top' }, h('button', { class: 'or-back', 'aria-label': T('Back'), onclick: () => { S.state = 'menu'; showOverlay('menu'); } }, '‹'), h('h2', {}, T('Balls')), h('span', { class: 'or-chip' }, gemSym(), purse)), list);
        const draw = () => {
          const had = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.ball : null;
          list.innerHTML = ''; purse.textContent = String(wallet()); const have = owned(), cur = ballDef.id;
          BALLS.forEach((b) => {
            const cv = h('canvas', { width: 220, height: 220, class: 'or-art' }); drawBall(cv, b);
            const mine = have.includes(b.id), on = cur === b.id, can = wallet() >= b.price;
            const act = on ? h('span', { class: 'or-tag on' }, T('In use')) : mine ? h('span', { class: 'or-tag' }, T('Use')) : h('span', { class: 'or-tag price' + (can ? '' : ' short') }, gemSym(), String(b.price));
            const card = h('button', { class: 'or-ball' + (on ? ' on' : '') + (!mine && !can ? ' locked' : ''), 'data-ball': b.id, 'aria-label': T(b.name) }, cv, h('span', { class: 'or-bn' }, T(b.name)), act);
            card.onclick = () => { if (mine) { equip(b.id); draw(); } else if (can) { buy(b.id); draw(); } else { PatOS.sound.tone(180, 0.12, { vol: 0.06 }); card.classList.remove('nope'); void card.offsetWidth; card.classList.add('nope'); } };
            list.appendChild(card);
          });
          const back = had && list.querySelector('[data-ball="' + had + '"]'); (back || stage).focus({ preventScroll: true }); // (keeps Escape and the arrow keys working)
        };
        draw();
      }
      function equip(id) { if (!owned().includes(id)) return false; store.set('orbBall', id); makeBall(ballOf(id)); PatOS.sound.tone(880, 0.08, { vol: 0.06 }); return true; }
      function buy(id) {
        const b = ballOf(id); if (b.id !== id || owned().includes(id) || wallet() < b.price) return false;
        store.set('orbWallet', wallet() - b.price); store.set('orbOwned', owned().concat([id])); equip(id);
        [880, 1175, 1568].forEach((f, i) => PatOS.sound.tone(f, 0.14, { vol: 0.07, delay: i * 0.07 })); return true;
      }
      function start() { overlay.classList.add('hidden'); reset(); S.state = 'play'; stage.focus(); }
      function pause() { if (S.state !== 'play') return; S.state = 'pause'; overlay.classList.remove('hidden', 'shop', 'menu'); overlay.innerHTML = ''; overlay.append(h('h1', { class: 'sm' }, T('Paused')), h('div', { class: 'or-btns' }, h('button', { class: 'or-btn', onclick: () => { overlay.classList.add('hidden'); S.state = 'play'; stage.focus(); } }, T('Resume')))); }
      const moveLane = (d) => { if (S.state !== 'play') return; const n = Math.max(0, Math.min(2, S.lane + d)); if (n !== S.lane) { S.lane = n; PatOS.sound.tone(500 + n * 120, 0.06, { vol: 0.06 }); } };
      const jump = () => { if (S.state === 'play' && S.y <= 0.71) { S.vy = 11; PatOS.sound.tone(400, 0.15, { vol: 0.08, slide: 900 }); } };
      stage.tabIndex = 0;
      stage.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (S.state === 'shop') { if (k === 'escape') { S.state = 'menu'; showOverlay('menu'); } return; }
        if (k === 'arrowleft' || k === 'a') { e.preventDefault(); moveLane(-1); }
        else if (k === 'arrowright' || k === 'd') { e.preventDefault(); moveLane(1); }
        else if (k === ' ' || k === 'arrowup' || k === 'w') { if (e.target.closest('button') && S.state !== 'play') return; e.preventDefault(); if (S.state === 'play') jump(); else if (S.state !== 'pause') start(); }
        else if (k === 'p' || k === 'escape') pause();
      });
      let tx0 = null; // touch and swipe
      stage.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; tx0 = { x: e.clientX, y: e.clientY }; stage.focus(); });
      stage.addEventListener('pointerup', (e) => { if (!tx0 || S.state !== 'play') { tx0 = null; return; } const dx = e.clientX - tx0.x, dy = e.clientY - tx0.y; if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else if (dy < -30) jump(); else { const r = stage.getBoundingClientRect(); moveLane(e.clientX < r.left + r.width / 2 ? -1 : 1); } tx0 = null; });
      win.on('blur', pause);

      /* ---------- the HUD (written only when something changes) ---------- */
      const hScore = h('b', { class: 'or-score' }), hWorld = h('span', { class: 'or-wname' }), hBar = h('i'), hGems = h('b'), hPow = h('div', { class: 'or-pows' });
      hud.append(h('div', { class: 'or-left' }, hScore, h('div', { class: 'or-prog' }, hWorld, h('span', { class: 'or-bar' }, hBar)), hPow), h('div', { class: 'or-right' }, h('span', { class: 'or-chip' }, gemSym(), hGems)));
      let last = {};
      function drawHud() {
        const on = S.state === 'play' || S.state === 'pause'; hud.classList.toggle('hidden', !on); if (!on) { last = {}; return; }
        if (last.score !== S.score) { hScore.textContent = String(S.score); last.score = S.score; }
        if (last.gems !== S.gems) { hGems.textContent = String(S.gems); last.gems = S.gems; }
        if (last.world !== S.world) { hWorld.textContent = T('World') + ' ' + (S.world + 1); last.world = S.world; }
        const prog = Math.round(((S.score % WORLD_EVERY) / WORLD_EVERY) * 100); if (last.prog !== prog) { hBar.style.width = prog + '%'; last.prog = prog; }
        const pk = Object.keys(S.power).map((k) => k + Math.ceil(S.power[k] * 4)).join() + (S.shield ? 's' : '');
        if (last.pk !== pk) {
          last.pk = pk; hPow.innerHTML = '';
          if (S.shield) hPow.appendChild(h('span', { class: 'or-pow shield' }, T('Shield')));
          Object.keys(S.power).forEach((k) => hPow.appendChild(h('span', { class: 'or-pow ' + k, style: { '--left': (S.power[k] / POWERS[k].time * 100) + '%' } }, T(POWERS[k].name))));
        }
      }

      const resize = () => { const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
      win.on('resize', resize);
      const clock = new THREE.Clock(); let raf, t = 0, frame = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (win.minimized || document.hidden) return;
        const dt = Math.min(0.05, clock.getDelta()); t += dt; frame++;
        const playing = S.state === 'play';
        const v = playing ? S.speed : S.state === 'menu' || S.state === 'shop' ? 8 : 0;
        grid.position.z = (grid.position.z + v * dt) % 2.5;
        if (shift) { // the road becoming the next world
          shift.p = Math.min(1, shift.p + dt / 2.5); const k = shift.p * shift.p * (3 - 2 * shift.p);
          applyColors(shift.a, shift.b, k); if (++shift.frame % 3 === 0 || shift.p === 1) drawSun(mixCss(shift.from.sun[0], shift.to.sun[0], k), mixCss(shift.from.sun[1], shift.to.sun[1], k));
          if (shift.p > 0.5) { decoKind = shift.to.deco; showProps(shift.to.props); } if (shift.p === 1) shift = null;
        }
        if (playing) {
          S.speed = Math.min(55, 18 + S.dist / 120); S.dist += v * dt; S.pts += v * dt * (S.power.double ? 2 : 1);
          S.score = Math.floor(S.pts); if (worldAt(S.score) > S.world) goWorld(worldAt(S.score));
          S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 14);
          S.vy -= 32 * dt; S.y = Math.max(0.7, S.y + S.vy * dt); if (S.y === 0.7) S.vy = 0;
          holder.position.set(S.x, S.y, 0); if (orb) orb.rotation.x -= v * dt / 0.7;
          Object.keys(S.power).forEach((k) => { S.power[k] -= dt; if (S.power[k] <= 0) delete S.power[k]; }); if (S.safe > 0) S.safe -= dt;
          S.spawnZ += v * dt;
          while (S.spawnZ > -110) { spawnRow(S.spawnZ - 100); S.spawnZ -= Math.max(9, 18 - S.dist / 400); }
        } else if (S.state === 'menu' || S.state === 'shop') { if (S.state === 'shop') { const sw = stage.clientWidth, pw = overlay.offsetWidth || 0, halfW = 6 * Math.tan(cam.fov * Math.PI / 360) * cam.aspect; holder.position.set(sw < 640 ? 0 : (-1 + (sw - pw) / sw) * halfW, 1.55 + Math.sin(t * 2) * 0.1, 2); } else holder.position.set(Math.sin(t) * 2, 0.9 + Math.abs(Math.sin(t * 3)) * 0.6, 0); if (orb) { orb.rotation.x -= dt * (S.state === 'shop' ? 1 : 6); orb.rotation.y += dt * (S.state === 'shop' ? 0.8 : 0); } }
        sats.forEach((m, i) => { const a = t * 2.2 + (i / sats.length) * Math.PI * 2; m.position.set(Math.cos(a) * 1.15, Math.sin(a * 1.3) * 0.25, Math.sin(a) * 1.15); m.rotation.y += dt * 3; });
        if (prismGeo && frame % 3 === 0) { const c = prismGeo.attributes.color; for (let f = 0; f < c.count / 3; f++) { tmp.setHSL((f / 20 + t * 0.08) % 1, 0.95, 0.6); for (let k = 0; k < 3; k++) c.setXYZ(f * 3 + k, tmp.r, tmp.g, tmp.b); } c.needsUpdate = true; }
        if (S.shield) shieldMesh.material.opacity = 0.18 + Math.sin(t * 6) * 0.06;
        holder.visible = S.state !== 'over' || false; if (S.safe > 0) holder.visible = Math.floor(t * 20) % 2 === 0;
        const magnet = playing && S.power.magnet;
        for (let i = objs.length - 1; i >= 0; i--) {
          const o = objs[i]; o.m.position.z += v * dt;
          if (o.type === 'gem' || o.type === 'power') { o.m.rotation.y += dt * 4; if (!magnet || o.type !== 'gem') o.m.position.y = o.baseY + Math.sin(t * 5 + i) * 0.15; }
          if (o.mover) o.m.position.x = Math.sin(t * 1.7 + o.phase) * LANE, o.m.rotation.z -= dt * 4;
          if (magnet && o.type === 'gem' && o.m.position.z > -26 && o.m.position.z < 2) { const k = Math.min(1, dt * 7); o.m.position.x += (S.x - o.m.position.x) * k; o.m.position.y += (S.y - o.m.position.y) * k; o.m.position.z += (0 - o.m.position.z) * k * 0.6; }
          if (playing && Math.abs(o.m.position.z) < 0.9 && Math.abs(o.m.position.x - S.x) < 1.3) {
            if (o.type === 'gem') { if (Math.abs(o.m.position.y - S.y) < 1.3) { S.gems++; addGems(1); S.pts += 50 * (S.power.double ? 2 : 1); PatOS.sound.tone(1200, 0.12, { vol: 0.08 }); PatOS.sound.tone(1800, 0.12, { vol: 0.06, delay: 0.06 }); scene.remove(o.m); objs.splice(i, 1); } continue; }
            if (o.type === 'power') { takePower(o.kind); scene.remove(o.m); objs.splice(i, 1); continue; }
            if (!(o.low && S.y > 1.3)) { hit(o, i); if (S.state !== 'play') break; continue; }
          }
          if (o.m.position.z > 12) { scene.remove(o.m); objs.splice(i, 1); }
        }
        for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.m.position.add(p.v); p.v.y -= 0.012; p.m.rotation.x += 0.2; p.life -= dt; if (p.life <= 0) { scene.remove(p.m); parts.splice(i, 1); } }
        // scenery: moves with the road, grows in, the old one shrinks away
        if (propK < 1) { propK = Math.min(1, propK + dt * 1.2); if (propsOff) { propsOff.children.forEach((c) => c.scale.copy(c.userData.full).multiplyScalar(1 - propK)); if (propK === 1) { scene.remove(propsOff); propsOff.children.forEach((c) => c.scale.copy(c.userData.full)); propsOff = null; } } }
        if (propsOn) propsOn.children.forEach((c) => { if (propK < 1) c.scale.copy(c.userData.full).multiplyScalar(propK * propK * (3 - 2 * propK)); if (c.userData.wave != null) c.position.x = Math.sin(t * 0.3 + c.userData.wave) * 10; if (c.userData.spin) c.rotation.y += dt * c.userData.spin; if (propsOn.userData.sky || c.userData.sky) { if (c.userData.sky) c.rotation.y += dt * 0.02; return; } c.position.z += v * dt; if (c.position.z > 14) c.position.z -= 150; });
        // the world's weather
        if (deco.visible) for (let i = 0; i < DN; i++) {
          const j = i * 3; let x = decoP[j], y = decoP[j + 1], z = decoP[j + 2];
          if (decoKind === 'snow') { y -= dt * 2.2; x += Math.sin(t + decoS[i]) * dt * 0.8; z += v * dt * 0.35; }
          else if (decoKind === 'embers') { y += dt * 2.6; x += Math.sin(t * 2 + decoS[i]) * dt; z += v * dt * 0.35; }
          else if (decoKind === 'fireflies') { x += Math.sin(t * 1.3 + decoS[i]) * dt * 1.2; y += Math.cos(t * 1.7 + decoS[i]) * dt * 0.8; z += v * dt * 0.3; }
          else if (decoKind === 'warp') { z += (v * 1.6 + 20) * dt; }
          else if (decoKind === 'dust') { x += dt * 5; y += Math.sin(t + decoS[i]) * dt * 0.3; z += v * dt * 0.4; }
          else { z += v * dt * 0.15; y += Math.sin(t * 2 + decoS[i]) * dt * 0.1; }
          if (y < 0) y += 22; if (y > 22) y -= 22; if (z > 10) z -= 130; if (x > 30) x -= 60;
          decoP[j] = x; decoP[j + 1] = y; decoP[j + 2] = z;
        }
        decoG.attributes.position.needsUpdate = true; decoM.size = decoKind === 'warp' ? 0.5 : decoKind === 'fireflies' ? 0.45 : 0.3;
        // trail
        for (let i = TR - 1; i > 0; i--) { trP[i * 3] = trP[(i - 1) * 3] + (Math.random() - 0.5) * 0.05; trP[i * 3 + 1] = trP[(i - 1) * 3 + 1]; trP[i * 3 + 2] = trP[(i - 1) * 3 + 2] + v * dt; }
        trP[0] = holder.position.x; trP[1] = holder.position.y; trP[2] = holder.position.z + 0.6; trailG.attributes.position.needsUpdate = true; trail.visible = holder.visible && S.state !== 'shop';
        // camera
        S.shake *= 0.9;
        cam.position.set(S.x * 0.5 + (Math.random() - 0.5) * S.shake, 4 + (Math.random() - 0.5) * S.shake, 8);
        cam.lookAt(S.x * 0.3, 1, -10);
        cam.fov = 65 + (S.speed - 18) * 0.4; cam.updateProjectionMatrix();
        drawHud();
        renderer.paced(scene, cam);
      };
      resize(); showOverlay('menu'); loop();
      setTimeout(() => stage.focus(), 100);
      win.on('closed', () => { cancelAnimationFrame(raf); disposeOrb(); renderer.dispose(); });
      // (for tests)
      win._orb = { S, objs: () => objs, worlds: WORLDS, balls: BALLS, start, shop, buy, equip, wallet, owned, pause, world: () => S.world, ball: () => ballDef.id, setScore: (n) => { S.pts = n; S.dist = Math.max(S.dist, n / 4); }, power: takePower, drawBall };
    }
  });
})();
