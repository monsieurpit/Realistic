/* PatOS wallpapers: procedural 2D art + live three.js 3D wallpapers */
(function () {
  'use strict';
  const { $ } = PatOS;

  const PALETTES = {
    // premium (painted by paintSilk below): ribbons of silk lit from above, with grain and a vignette
    silk:      { name: 'Silk', silk: true, dark: true, base: ['#06060b', '#0e0b1c', '#04040a'],
      glows: [[.72, .28, .55, '#3b2bff', .35], [.2, .8, .5, '#0a5cff', .25]],
      ribbons: [{ y: .30, amp: .10, thick: .30, col: '#5a3cff', hi: '#e2d8ff', ph: .4 }, { y: .55, amp: .12, thick: .34, col: '#1f5bff', hi: '#cfe6ff', ph: 2.1 }, { y: .78, amp: .08, thick: .22, col: '#a32cff', hi: '#ffd8ff', ph: 4.0 }] },
    obsidian:  { name: 'Obsidian', silk: true, dark: true, base: ['#020203', '#09090d', '#020203'],
      glows: [[.5, .55, .6, '#2a2a3a', .4]],
      ribbons: [{ y: .52, amp: .14, thick: .26, col: '#2c2c3a', hi: '#f0f0ff', ph: 1.2 }, { y: .70, amp: .06, thick: .10, col: '#1c1c26', hi: '#a9a9c8', ph: 3.3 }] },
    embersilk: { name: 'Flame', silk: true, dark: true, base: ['#0a0403', '#160705', '#060202'],
      glows: [[.25, .3, .5, '#ff4a12', .3], [.8, .75, .5, '#c2185b', .28]],
      ribbons: [{ y: .34, amp: .11, thick: .30, col: '#ff5a1f', hi: '#ffe0bf', ph: .9 }, { y: .62, amp: .10, thick: .30, col: '#c81d5e', hi: '#ffc2d6', ph: 2.8 }] },
    glacier:   { name: 'Glacier', silk: true, dark: false, base: ['#eaf2ff', '#d5e5fb', '#f2f5fb'],
      glows: [[.3, .25, .6, '#ffffff', .6], [.8, .7, .5, '#b9cfff', .4]],
      ribbons: [{ y: .36, amp: .10, thick: .30, col: '#8db6ff', hi: '#ffffff', ph: .3 }, { y: .64, amp: .11, thick: .30, col: '#b6a9ff', hi: '#ffffff', ph: 2.4 }] },
    dune:      { name: 'Dune', silk: true, dark: false, base: ['#f7e8d8', '#efd3ba', '#e8c2a5'],
      glows: [[.7, .2, .6, '#fff6ea', .7], [.2, .8, .5, '#f0b9a0', .35]],
      ribbons: [{ y: .40, amp: .09, thick: .32, col: '#dcae88', hi: '#fff6ec', ph: 1.6 }, { y: .70, amp: .10, thick: .30, col: '#d89582', hi: '#fff0ea', ph: 3.6 }] },
    sonora:   { name: 'Sonora',   base: ['#1b0f3b', '#3a1c71', '#0b1a4a'], bands: ['#7b2ff7', '#f107a3', '#3a86ff', '#ff6ec7', '#5f0f9e'], dark: true },
    monterra: { name: 'Monterra', base: ['#2b0a2f', '#7a1d3a', '#ff6a3d'], bands: ['#ff9a3c', '#ff3d68', '#a4133c', '#ffd166', '#6a0d52'], dark: true },
    aurora:   { name: 'Aurora',   base: ['#020b1c', '#05263b', '#0b0423'], bands: ['#00f5a0', '#00d9f5', '#7f5af0', '#2cb67d', '#00a6fb'], dark: true },
    sunrise:  { name: 'Sunrise',  base: ['#ffd6a5', '#ffadad', '#fdffb6'], bands: ['#ff8fab', '#ffc6ff', '#ffb703', '#fb6f92', '#ffd166'], dark: false },
    ocean:    { name: 'Ocean',    base: ['#03045e', '#023e8a', '#0077b6'], bands: ['#00b4d8', '#48cae4', '#0096c7', '#90e0ef', '#023e8a'], dark: true },
    mint:     { name: 'Mint',     base: ['#e0fff4', '#e8e4ff', '#d8f3ff'], bands: ['#9bf6ff', '#bdb2ff', '#caffbf', '#a0c4ff', '#ffc6ff'], dark: false },
    midnight: { name: 'Midnight', base: ['#050508', '#0d1020', '#06060c'], bands: ['#1f2a5a', '#2d1b4e', '#14325c', '#3b1f5f', '#0f3d5e'], dark: true },
    ember:    { name: 'Ember',    base: ['#140400', '#3a0a00', '#1a0500'], bands: ['#ff4800', '#ff8500', '#ffaa00', '#c1121f', '#ff6d00'], dark: true }
  };
  const LIVE = {
    nebula:   { name: 'Nebula',   live: true, fallback: 'sonora' },
    waves:    { name: 'Dot Waves', live: true, fallback: 'ocean' },
    crystals: { name: 'Crystals', live: true, fallback: 'aurora' },
    tunnel:   { name: 'Warp',     live: true, fallback: 'midnight' }
  };

  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function hash(str) { let x = 2166136261; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return x >>> 0; }

  /* Silk: ribbons of fabric lit from above. A ribbon is ~70 fine strands laid side by side; each strand's color comes from
     where it sits across the ribbon (a specular highlight near its upper edge, shade in the fold below, soft edges), and the
     ribbon's width swells and pinches along its length, so the strands cross and the fabric seems to twist. Then an ambient
     glow, a vignette and fine grain. Painted once per size and kept (see drawStatic). */
  const mixc = (a, b, t) => { const p = (c) => [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  function paintSilk(ctx, p, w, hgt, r) {
    const g = ctx.createLinearGradient(0, 0, w * .4, hgt);
    p.base.forEach((c, i) => g.addColorStop(i / (p.base.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hgt);
    p.glows.forEach(([x, y, rad, col, a]) => {
      const rg = ctx.createRadialGradient(x * w, y * hgt, 0, x * w, y * hgt, rad * Math.max(w, hgt));
      rg.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, '0')); rg.addColorStop(1, col + '00');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, hgt);
    });
    const N = 72, step = Math.max(6, w / 220);
    try { ctx.filter = `blur(${Math.max(.4, w / 2600).toFixed(2)}px)`; } catch (e) {}
    ctx.globalCompositeOperation = p.dark ? 'screen' : 'source-over';
    p.ribbons.forEach((rb, ri) => {
      const f1 = 1.1 + r() * .8, f2 = 2.3 + r() * 1.4, tw = 1.6 + r() * 1.2;
      const centre = (x) => hgt * rb.y + Math.sin(x / w * Math.PI * f1 + rb.ph) * hgt * rb.amp + Math.sin(x / w * Math.PI * f2 + rb.ph * 1.7) * hgt * rb.amp * .35;
      const width = (x) => hgt * rb.thick * (.55 + .45 * Math.sin(x / w * Math.PI * tw + rb.ph * 2.3)); // swells and pinches: the twist
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const hl = Math.exp(-Math.pow((t - .3) / .085, 2)), sh = Math.exp(-Math.pow((t - .74) / .16, 2)), edge = Math.pow(Math.sin(Math.PI * t), .7);
        ctx.strokeStyle = mixc(mixc(rb.col, rb.hi, Math.min(1, hl * .95)), p.dark ? '#000000' : '#5a4636', sh * (p.dark ? .55 : .25));
        ctx.globalAlpha = edge * (p.dark ? .5 : .55); ctx.lineWidth = Math.max(1, hgt * rb.thick / N * 1.8);
        ctx.beginPath();
        for (let x = -step * 2; x <= w + step * 2; x += step) { const y = centre(x) + (t - .5) * width(x); x === -step * 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    // vignette: the corners fall off, so the light sits in the middle of the screen
    const v = ctx.createRadialGradient(w / 2, hgt * .45, Math.min(w, hgt) * .3, w / 2, hgt / 2, Math.max(w, hgt) * .78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, p.dark ? 'rgba(0,0,0,.55)' : 'rgba(90,60,40,.16)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, hgt);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .55; ctx.fillStyle = grainPattern(ctx, r); ctx.fillRect(0, 0, w, hgt); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function paint(canvas, id, w, hgt) {
    const p = PALETTES[id] || PALETTES.sonora;
    if (p.silk) { canvas.width = w; canvas.height = hgt; paintSilk(canvas.getContext('2d'), p, w, hgt, rng(hash(id))); return; }
    canvas.width = w; canvas.height = hgt;
    const ctx = canvas.getContext('2d');
    const r = rng(hash(id));
    const g = ctx.createLinearGradient(0, 0, w, hgt);
    p.base.forEach((c, i) => g.addColorStop(i / (p.base.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hgt);
    const blur = Math.round(Math.min(w, hgt) / 18);
    // soft glows
    for (let i = 0; i < 5; i++) {
      const x = r() * w, y = r() * hgt, rad = (0.3 + r() * 0.5) * Math.max(w, hgt);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, p.bands[i % p.bands.length] + 'aa'); rg.addColorStop(1, p.bands[i % p.bands.length] + '00');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, hgt);
    }
    // flowing bands
    try { ctx.filter = `blur(${blur}px)`; } catch (e) {}
    for (let b = 0; b < 6; b++) {
      const col = p.bands[b % p.bands.length];
      const yBase = hgt * (0.25 + b * 0.12 + r() * 0.08);
      const amp = hgt * (0.08 + r() * 0.14), freq = 1 + r() * 2.2, phase = r() * Math.PI * 2, thick = hgt * (0.08 + r() * 0.12);
      const grad = ctx.createLinearGradient(0, yBase - amp, w, yBase + amp);
      grad.addColorStop(0, col + '00'); grad.addColorStop(0.3 + r() * 0.3, col + 'dd'); grad.addColorStop(1, col + '22');
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let x = -40; x <= w + 40; x += 20) { const y = yBase + Math.sin((x / w) * Math.PI * freq + phase) * amp; x === -40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      for (let x = w + 40; x >= -40; x -= 20) { const y = yBase + thick + Math.sin((x / w) * Math.PI * freq + phase + 0.6) * amp * 0.8; ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill();
    }
    ctx.filter = 'none';
    // subtle grain: one small noise tile, repeated (touching every pixel one by one took over a second on a modest laptop)
    ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = grainPattern(ctx, r); ctx.fillRect(0, 0, w, hgt); ctx.globalCompositeOperation = 'source-over';
  }
  let grainTile = null;
  function grainPattern(ctx, r) {
    if (!grainTile) { grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 96; const g = grainTile.getContext('2d'); const img = g.createImageData(96, 96); for (let i = 0; i < img.data.length; i += 4) { const v = 118 + Math.floor(r() * 20); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } g.putImageData(img, 0, 0); }
    return ctx.createPattern(grainTile, 'repeat');
  }

  const thumbCache = {};
  function thumb(id) {
    if (thumbCache[id]) return thumbCache[id];
    const c = document.createElement('canvas');
    const src = LIVE[id] ? LIVE[id].fallback : id;
    paint(c, src, 192, 120);
    if (LIVE[id]) decorateThumb(c, id);
    return (thumbCache[id] = c.toDataURL('image/jpeg', 0.85));
  }
  function decorateThumb(c, id) {
    const ctx = c.getContext('2d'); const r = rng(hash(id + 'x'));
    if (id === 'nebula') { ctx.fillStyle = '#05010f'; ctx.fillRect(0, 0, c.width, c.height); for (let i = 0; i < 600; i++) { const a = r() * Math.PI * 6, d = r() * 55; ctx.fillStyle = `hsla(${260 + d * 2},90%,${60 + r() * 30}%,.9)`; ctx.fillRect(96 + Math.cos(a + d / 12) * d * 1.4, 60 + Math.sin(a + d / 12) * d * 0.6, 1.3, 1.3); } }
    if (id === 'waves') { ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, c.width, c.height); for (let z = 0; z < 22; z++) for (let x = 0; x < 40; x++) { const px = x * 5 + (z % 2) * 2, py = 40 + z * 3.6 + Math.sin(x * 0.4 + z * 0.5) * 5; ctx.fillStyle = `hsla(${190 + z * 3},90%,${45 + z * 1.5}%,.9)`; ctx.fillRect(px, py, 1.4, 1.4); } }
    if (id === 'crystals') { for (let i = 0; i < 9; i++) { ctx.fillStyle = `hsla(${160 + i * 20},80%,60%,.55)`; const x = r() * 192, y = r() * 120, s = 10 + r() * 18; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.8, y); ctx.fill(); } }
    if (id === 'tunnel') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height); for (let i = 0; i < 260; i++) { const a = r() * Math.PI * 2, d = 4 + r() * 100; ctx.strokeStyle = `hsla(${200 + r() * 120},90%,70%,.8)`; ctx.beginPath(); ctx.moveTo(96 + Math.cos(a) * d, 60 + Math.sin(a) * d); ctx.lineTo(96 + Math.cos(a) * d * 1.25, 60 + Math.sin(a) * d * 1.25); ctx.stroke(); } }
  }

  /* ---------- live 3D wallpaper ---------- */
  let three = null;
  function stop3D() {
    if (!three) return;
    cancelAnimationFrame(three.raf);
    three.dispose && three.dispose();
    three.renderer.dispose();
    // give the graphics memory back right away instead of waiting for the browser to clean up
    try { three.renderer.forceContextLoss(); } catch (e) {}
    three = null;
    // a canvas whose context was let go can't draw again, so the next start gets a fresh one
    const old = $('#wallpaper3d'); if (old) { const fresh = old.cloneNode(false); fresh.classList.remove('on'); old.replaceWith(fresh); }
  }
  function start3D(id) {
    stop3D();
    if (!PatOS.has3D) return false;
    const canvas = $('#wallpaper3d');
    let renderer;
    try { renderer = PatOS.makeRenderer(canvas, { antialias: false }); } catch (e) { return false; }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
    const low = PatOS.settings.quality3d === 'low';
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e) => { mouse.tx = (e.clientX / innerWidth - 0.5) * 2; mouse.ty = (e.clientY / innerHeight - 0.5) * 2; };
    window.addEventListener('pointermove', onMove);
    let update = () => {};
    const disposables = [];

    if (id === 'nebula') {
      renderer.setClearColor(0x05010f, 1);
      const N = low ? 14000 : 32000, arms = 4;
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      const inner = new THREE.Color('#ffd1f5'), outer = new THREE.Color('#3a5bff'), mid = new THREE.Color('#b84dff');
      for (let i = 0; i < N; i++) {
        const rad = Math.pow(Math.random(), 1.6) * 26;
        const branch = ((i % arms) / arms) * Math.PI * 2, spin = rad * 0.32;
        const rx = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (1 + rad * 0.25);
        const ry = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.6 + rad * 0.06);
        const rz = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (1 + rad * 0.25);
        pos[i * 3] = Math.cos(branch + spin) * rad + rx; pos[i * 3 + 1] = ry; pos[i * 3 + 2] = Math.sin(branch + spin) * rad + rz;
        const c = inner.clone().lerp(rad < 9 ? mid : outer, Math.min(1, rad / 18));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size: 0.09, sizeAttenuation: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const galaxy = new THREE.Points(geo, mat); galaxy.rotation.x = 0.35; scene.add(galaxy);
      // background stars
      const S = low ? 1500 : 4000, sp = new Float32Array(S * 3);
      for (let i = 0; i < S; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(80 + Math.random() * 120); sp.set([v.x, v.y, v.z], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, transparent: true, opacity: 0.8 })); scene.add(stars);
      // glowing core sprite
      const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gx = gc.getContext('2d');
      const rg = gx.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(255,220,255,1)'); rg.addColorStop(0.2, 'rgba(220,120,255,.5)'); rg.addColorStop(1, 'rgba(80,0,160,0)');
      gx.fillStyle = rg; gx.fillRect(0, 0, 128, 128);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false }));
      core.scale.set(18, 18, 1); scene.add(core);
      disposables.push(geo, mat, sg);
      camera.position.set(0, 9, 30);
      update = (t) => {
        galaxy.rotation.y = t * 0.035; stars.rotation.y = t * 0.004;
        camera.position.x += (mouse.x * 6 - camera.position.x) * 0.03;
        camera.position.y += (9 - mouse.y * 4 - camera.position.y) * 0.03;
        camera.lookAt(0, 0, 0);
      };
    } else if (id === 'waves') {
      renderer.setClearColor(0x020617, 1);
      const W = low ? 120 : 200, D = low ? 70 : 110;
      const pos = new Float32Array(W * D * 3);
      for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) { const i = (z * W + x) * 3; pos[i] = (x - W / 2) * 0.5; pos[i + 1] = 0; pos[i + 2] = (z - D / 2) * 0.5; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() } },
        vertexShader: `uniform float uTime; uniform vec2 uMouse; varying float vH; varying float vD;
          void main(){ vec3 p = position;
            float d = length(p.xz - uMouse*vec2(25.0,12.0));
            p.y = sin(p.x*0.18 + uTime*0.9)*1.6 + cos(p.z*0.22 + uTime*0.7)*1.4 + sin(d*0.35 - uTime*2.0)*0.9*exp(-d*0.05);
            vH = p.y; vec4 mv = modelViewMatrix*vec4(p,1.0); vD = -mv.z;
            gl_PointSize = 90.0 / vD; gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `varying float vH; varying float vD;
          void main(){ vec2 c = gl_PointCoord-0.5; float a = smoothstep(0.5,0.1,length(c));
            vec3 col = mix(vec3(0.1,0.45,1.0), vec3(0.95,0.3,1.0), clamp(vH*0.25+0.5,0.0,1.0));
            gl_FragColor = vec4(col, a*clamp(1.4-vD/70.0,0.0,1.0)); }`
      });
      scene.add(new THREE.Points(geo, mat)); disposables.push(geo, mat);
      camera.position.set(0, 7, 24); camera.lookAt(0, 0, 0);
      update = (t) => {
        mat.uniforms.uTime.value = t; mat.uniforms.uMouse.value.set(mouse.x, mouse.y);
        camera.position.x += (mouse.x * 3 - camera.position.x) * 0.02; camera.lookAt(0, 0, -4);
      };
    } else if (id === 'crystals') {
      renderer.setClearColor(0x04121a, 1);
      scene.fog = new THREE.Fog(0x04121a, 18, 60);
      scene.add(new THREE.AmbientLight(0x406080, 1.2));
      const l1 = new THREE.PointLight(0x00f5a0, 220, 80); l1.position.set(10, 10, 10); scene.add(l1);
      const l2 = new THREE.PointLight(0x7f5af0, 220, 80); l2.position.set(-12, -6, 6); scene.add(l2);
      const l3 = new THREE.DirectionalLight(0xffffff, 0.8); l3.position.set(0, 10, 5); scene.add(l3);
      const geos = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0)];
      const items = [];
      const count = low ? 26 : 50;
      for (let i = 0; i < count; i++) {
        const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.45 + Math.random() * 0.35, 0.7, 0.55), metalness: 0.6, roughness: 0.15, flatShading: true, transparent: true, opacity: 0.92 });
        const mesh = new THREE.Mesh(geos[i % geos.length], m);
        mesh.position.set((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 30, -Math.random() * 40);
        const s = 0.5 + Math.random() * 1.8; mesh.scale.setScalar(s);
        mesh.userData = { rx: (Math.random() - 0.5) * 0.01, ry: (Math.random() - 0.5) * 0.012, fy: Math.random() * 6, y0: mesh.position.y };
        scene.add(mesh); items.push(mesh); disposables.push(m);
      }
      geos.forEach((g) => disposables.push(g));
      camera.position.set(0, 0, 18);
      update = (t) => {
        items.forEach((m) => { m.rotation.x += m.userData.rx; m.rotation.y += m.userData.ry; m.position.y = m.userData.y0 + Math.sin(t * 0.5 + m.userData.fy) * 0.8; });
        camera.position.x += (mouse.x * 4 - camera.position.x) * 0.03; camera.position.y += (-mouse.y * 3 - camera.position.y) * 0.03; camera.lookAt(0, 0, -10);
      };
    } else if (id === 'tunnel') {
      renderer.setClearColor(0x000000, 1);
      const N = low ? 2500 : 6000;
      const pos = new Float32Array(N * 6), col = new Float32Array(N * 6);
      const speeds = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 18, z = -Math.random() * 200;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        pos.set([x, y, z, x, y, z - 2], i * 6);
        const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.3, 0.9, 0.65);
        col.set([c.r, c.g, c.b, 0, 0, 0], i * 6); speeds[i] = 0.6 + Math.random();
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending });
      const lines = new THREE.LineSegments(geo, mat); scene.add(lines); disposables.push(geo, mat);
      camera.position.set(0, 0, 5);
      update = (t, dt) => {
        const p = geo.attributes.position.array;
        for (let i = 0; i < N; i++) {
          const k = i * 6, v = speeds[i] * dt * 40;
          p[k + 2] += v; p[k + 5] += v;
          if (p[k + 2] > 6) { p[k + 2] -= 200; p[k + 5] -= 200; }
          p[k + 5] = p[k + 2] - 1.5 - speeds[i] * 2;
        }
        geo.attributes.position.needsUpdate = true;
        lines.rotation.z = t * 0.05;
        camera.position.x += (mouse.x * 2 - camera.position.x) * 0.04; camera.position.y += (-mouse.y * 2 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, -50);
      };
    }

    const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
    resize(); window.addEventListener('resize', resize);
    canvas.classList.add('on');
    let last = performance.now(), t = 0, acc = 0, pend = 0;
    /* How often the 3D wallpaper draws. Every frame it draws, everything see-through over it (the Dock, widgets, menus, titlebars)
       has to be filtered again, which is most of what PatOS costs to draw. So: 60 frames a second only with High quality; 30 with
       Balanced and Low (the wallpapers drift slowly, 30 looks the same); 10 while PatOS is not the window you are using (it keeps
       moving, but nobody is looking at it closely); none while a maximized window covers it (see js/shell.js). */
    const frameMs = () => (!document.hasFocus() ? 100 : PatOS.settings.quality3d === 'high' && !PatOS.weakDevice ? 0 : 1000 / 30);
    three = { renderer, raf: 0, paused: false };
    const loop = (now) => {
      three.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (three.paused || document.hidden) return;
      // frames that are skipped still count as time, so the wallpaper moves at the same speed whatever the frame rate
      pend += dt; const fm = frameMs(); if (fm) { acc += dt * 1000; if (acc < fm - 2) return; acc = 0; }
      const step = Math.min(0.15, pend); pend = 0;
      mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
      t += PatOS.settings.reduceMotion ? step * 0.2 : step;
      if (!renderer.gpuReady()) return; // the graphics chip is still busy with the last frame
      update(t, step); renderer.paced(scene, camera);
    };
    three.raf = requestAnimationFrame(loop);
    three.dispose = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', resize); disposables.forEach((d) => d.dispose()); };
    return true;
  }

  /* How light the wallpaper is under the menu bar and under the Dock. Liquid Glass uses it so the menu bar's words are dark
     over a light picture and white over a dark one, whatever the theme (html[data-wp-top] / [data-wp-bottom], css/glass.css).
     Read once each time the wallpaper is drawn, from a few pixels: nothing runs in the background. */
  function readTone(c) {
    try {
      if (!c.width || !c.height) return;
      const s = document.createElement('canvas'); s.width = 48; s.height = 32;
      const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 48, 32);
      const band = (y0, y1) => {
        const d = x.getImageData(0, y0, 48, Math.max(1, y1 - y0)).data; let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          sum += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
        }
        return sum / (d.length / 4);
      };
      const topRows = Math.max(1, Math.round(32 * 34 / Math.max(1, innerHeight)));
      // 0.3 relative luminance: white text and black text have about the same contrast against it
      const root = document.documentElement;
      root.dataset.wpTop = band(0, topRows) > 0.3 ? 'light' : 'dark';
      root.dataset.wpBottom = band(32 - Math.max(2, topRows * 3), 32) > 0.3 ? 'light' : 'dark';
      // how busy the picture is: the average jump in brightness between neighbouring pixels (smooth gradients are near 0,
      // photos of leaves or text are high). Glass that holds words thickens a little over busy pictures (css/glass.css).
      const d = x.getImageData(0, 0, 48, 32).data, L = new Float32Array(48 * 32);
      for (let i = 0; i < L.length; i++) L[i] = (d[i * 4] * 0.2126 + d[i * 4 + 1] * 0.7152 + d[i * 4 + 2] * 0.0722) / 255;
      let edge = 0, n = 0;
      for (let y = 0; y < 31; y++) for (let x2 = 0; x2 < 47; x2++) { const i = y * 48 + x2; edge += Math.abs(L[i] - L[i + 1]) + Math.abs(L[i] - L[i + 48]); n += 2; }
      if (edge / n > 0.06) root.dataset.wpBusy = '1'; else delete root.dataset.wpBusy;
    } catch (e) { /* a picture the browser won't let PatOS read: the theme decides instead */ delete document.documentElement.dataset.wpTop; delete document.documentElement.dataset.wpBottom; delete document.documentElement.dataset.wpBusy; }
  }

  function drawStatic(id) {
    const c = $('#wallpaper');
    const scale = 0.5;
    if (id === 'custom' && PatOS.settings.customWallpaper) {
      const img = new Image();
      img.onload = () => {
        c.width = innerWidth; c.height = innerHeight; const ctx = c.getContext('2d');
        const s = Math.max(c.width / img.width, c.height / img.height);
        ctx.drawImage(img, (c.width - img.width * s) / 2, (c.height - img.height * s) / 2, img.width * s, img.height * s);
        readTone(c);
      };
      img.src = PatOS.settings.customWallpaper; return;
    }
    const src = LIVE[id] ? LIVE[id].fallback : id, full = PALETTES[src] && PALETTES[src].silk ? Math.min(1, 2560 / innerWidth) / scale : 1;
    const w = Math.max(320, Math.round(innerWidth * scale * full)), hh = Math.max(200, Math.round(innerHeight * scale * full));
    // the painting is the same every time for a given size, so the last one is kept and shown again
    const key = src + '|' + w + 'x' + hh, saved = PatOS.store.get('wpCache', null);
    if (saved && saved.key === key && saved.url) {
      c.width = w; c.height = hh; const img = new Image(); const mine = ++drawN;
      img.onload = () => { if (mine === drawN) { c.getContext('2d').drawImage(img, 0, 0, w, hh); readTone(c); } };
      img.onerror = () => { if (mine === drawN) { PatOS.store.remove('wpCache'); paint(c, src, w, hh); readTone(c); } };
      img.src = saved.url; return;
    }
    ++drawN; paint(c, src, w, hh); readTone(c);
    const keep = () => { try { PatOS.store.set('wpCache', { key, url: c.toDataURL('image/jpeg', 0.88) }); } catch (e) {} };
    if (window.requestIdleCallback) requestIdleCallback(keep, { timeout: 4000 }); else setTimeout(keep, 1500);
  }
  let drawN = 0;

  function apply() {
    let id = PatOS.settings.wallpaper;
    if (!PALETTES[id] && !LIVE[id] && id !== 'custom') id = 'sonora';
    drawStatic(id);
    if (LIVE[id] && PatOS.settings.live3d) {
      if (window.THREE) { if (!start3D(id)) stop3D(); }
      else if (PatOS.webgl) {
        // the flat picture shows right away; three.js loads once PatOS has finished starting
        stop3D(); const want = id;
        const go = () => PatOS.load3D().then((ok) => { if (ok && PatOS.settings.wallpaper === want && PatOS.settings.live3d && !three) start3D(want); });
        if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 800);
      }
    } else stop3D();
    const lockBg = $('.lock-bg');
    if (lockBg) lockBg.style.backgroundImage = `url(${id === 'custom' && PatOS.settings.customWallpaper ? PatOS.settings.customWallpaper : thumbLarge(id)})`;
  }
  let lockCache = {};
  function thumbLarge(id) {
    if (lockCache[id]) return lockCache[id];
    const saved = PatOS.store.get('wpLockCache', null);
    if (saved && saved.id === id && saved.url) return (lockCache[id] = saved.url);
    const all = PatOS.store.get('wpThumbs', {}); if (all[id]) return (lockCache[id] = all[id]);
    const c = document.createElement('canvas'); paint(c, LIVE[id] ? LIVE[id].fallback : id, 640, 400);
    lockCache[id] = c.toDataURL('image/jpeg', 0.8);
    PatOS.store.set('wpLockCache', { id, url: lockCache[id] });
    if (id !== PatOS.settings.wallpaper) { all[id] = lockCache[id]; PatOS.store.set('wpThumbs', all); } // (made again by itself if lost)
    return lockCache[id];
  }

  PatOS.wallpaper = {
    palettes: PALETTES, live: LIVE, apply, thumb, thumbLarge,
    isDark(id) { id = id || PatOS.settings.wallpaper; return LIVE[id] ? true : PALETTES[id] ? PALETTES[id].dark : true; },
    pause(on) { if (three) three.paused = on; },
    stop: stop3D
  };
  window.addEventListener('resize', PatOS.debounce(() => { const id = PatOS.settings.wallpaper; drawStatic(LIVE[id] || PALETTES[id] || id === 'custom' ? id : 'sonora'); }, 200));
  PatOS.on('setting:wallpaper', apply);
  PatOS.on('setting:live3d', apply);
  PatOS.on('setting:customWallpaper', apply);
  PatOS.on('setting:quality3d', apply);
})();
