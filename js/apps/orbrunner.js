/* Orb Runner — an original 3D endless runner (three.js). Steer your orb down a neon highway, dodge blocks, grab gems. */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    needs3D: true, id: 'orbrunner', name: 'Orb Runner', icon: 'orbrunner', width: 900, height: 600, dark: true, category: '3D & Games', keywords: 'game 3d play racing runner',
    launch(win) {
      const canvas = h('canvas', { class: 'g3d' });
      const hud = h('div', { class: 'or-hud' });
      const overlay = h('div', { class: 'or-over' });
      const stage = h('div', { class: 'g3d-stage' }, canvas, hud, overlay);
      win.body.appendChild(stage);
      if (!PatOS.has3D) { stage.innerHTML = '<div class="app-error">Orb Runner needs WebGL.</div>'; return; }
      const renderer = PatOS.makeRenderer(canvas, { antialias: true });
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0b0130, 20, 120);
      renderer.setClearColor(0x0b0130, 1);
      const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 300);
      scene.add(new THREE.HemisphereLight(0x8866ff, 0x110022, 1.2));
      const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(5, 10, 5); scene.add(dl);

      // sky: retro sun + stars
      const sunC = document.createElement('canvas'); sunC.width = sunC.height = 256; const sx = sunC.getContext('2d');
      const sg = sx.createLinearGradient(0, 0, 0, 256); sg.addColorStop(0, '#ffe259'); sg.addColorStop(1, '#ff2fa3'); sx.fillStyle = sg; sx.beginPath(); sx.arc(128, 128, 126, 0, 7); sx.fill();
      sx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 8; i++) sx.fillRect(0, 140 + i * 15, 256, 3 + i);
      const sun = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sunC), transparent: true, fog: false }));
      sun.position.set(0, 18, -200); scene.add(sun);
      const stG = new THREE.BufferGeometry(); const stP = new Float32Array(1200 * 3);
      for (let i = 0; i < 1200; i++) stP.set([(Math.random() - 0.5) * 400, 10 + Math.random() * 120, -150 - Math.random() * 60], i * 3);
      stG.setAttribute('position', new THREE.BufferAttribute(stP, 3)); scene.add(new THREE.Points(stG, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, fog: false })));

      // road
      const LANE = 2.6, LANES = [-LANE, 0, LANE];
      const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 400), new THREE.MeshStandardMaterial({ color: 0x140638, metalness: 0.4, roughness: 0.6 }));
      road.rotation.x = -Math.PI / 2; road.position.z = -150; scene.add(road);
      const grid = new THREE.GridHelper(400, 160, 0xff4fd8, 0xff4fd8); grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = 0.01; scene.add(grid);
      const edgeM = new THREE.MeshBasicMaterial({ color: 0x5cf2ff });
      [-5, 5].forEach((x) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 400), edgeM); e.position.set(x, 0.1, -150); scene.add(e); });
      // side mountains
      const mtn = new THREE.Mesh(new THREE.PlaneGeometry(400, 60, 80, 12), new THREE.MeshBasicMaterial({ color: 0xff2fa3, wireframe: true, transparent: true, opacity: 0.25 }));
      const mp = mtn.geometry.attributes.position; for (let i = 0; i < mp.count; i++) { const x = mp.getX(i); if (Math.abs(x) > 14) mp.setZ(i, Math.random() * Math.min(18, (Math.abs(x) - 14) * 0.6)); }
      mtn.rotation.x = -Math.PI / 2; mtn.position.set(0, 0, -150); scene.add(mtn);

      // player
      const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), new THREE.MeshStandardMaterial({ color: 0x5cf2ff, emissive: 0x1a8cff, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.2 }));
      orbMesh.position.y = 0.7; scene.add(orbMesh);
      const glow = new THREE.PointLight(0x5cf2ff, 30, 12); orbMesh.add(glow);
      const trailG = new THREE.BufferGeometry(); const TR = 40; const trP = new Float32Array(TR * 3); trailG.setAttribute('position', new THREE.BufferAttribute(trP, 3));
      const trail = new THREE.Points(trailG, new THREE.PointsMaterial({ color: 0x5cf2ff, size: 0.12, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(trail);

      const boxGeo = new THREE.BoxGeometry(2, 1.6, 1.2); const gemGeo = new THREE.OctahedronGeometry(0.45);
      const boxMats = [0xff2fa3, 0xff7a18, 0x9d4dff].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.3 }));
      const gemMat = new THREE.MeshStandardMaterial({ color: 0xffe259, emissive: 0xffb300, emissiveIntensity: 0.9 });
      let objs = [], parts = [];
      const S = { state: 'menu', lane: 1, x: 0, y: 0.7, vy: 0, speed: 18, dist: 0, score: 0, gems: 0, spawnZ: -40, best: PatOS.store.get('orbBest', 0), shake: 0 };

      function reset() {
        objs.forEach((o) => scene.remove(o.m)); objs = [];
        Object.assign(S, { lane: 1, x: 0, y: 0.7, vy: 0, speed: 18, dist: 0, score: 0, gems: 0, spawnZ: -30 });
        orbMesh.visible = true;
      }
      function spawnRow(z) {
        const free = Math.floor(Math.random() * 3);
        const pattern = Math.random();
        LANES.forEach((x, i) => {
          if (i === free) { if (Math.random() < 0.7) { const g = new THREE.Mesh(gemGeo, gemMat); g.position.set(x, 1, z); scene.add(g); objs.push({ m: g, type: 'gem', lane: i }); } return; }
          if (pattern < 0.35 && Math.random() < 0.5) return;
          const low = Math.random() < 0.25 && S.dist > 300;
          const b = new THREE.Mesh(boxGeo, boxMats[i]); b.position.set(x, low ? 0.35 : 0.8, z); if (low) b.scale.y = 0.45;
          scene.add(b); objs.push({ m: b, type: 'box', lane: i, low });
        });
      }
      function boom() {
        S.state = 'over'; S.shake = 1; orbMesh.visible = false; PatOS.sound.tone(90, 0.7, { vol: 0.3, type: 'sawtooth', slide: 30 });
        for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.15), new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x5cf2ff : 0xff4fd8 })); m.position.copy(orbMesh.position); scene.add(m); parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.4, (Math.random() - 0.5) * 0.4), life: 1.5 }); }
        if (S.score > S.best) { S.best = S.score; PatOS.store.set('orbBest', S.best); }
        setTimeout(() => showOverlay('over'), 700);
      }
      function showOverlay(kind) {
        overlay.classList.remove('hidden'); overlay.innerHTML = '';
        if (kind === 'menu') overlay.append(h('h1', {}, 'ORB RUNNER'), h('p', {}, '← → or A / D to switch lanes · Space / ↑ to jump'), h('p', {}, 'Dodge the blocks, grab the gems. It gets faster!'), h('button', { class: 'or-btn', onclick: start }, '▶  PLAY'), h('small', {}, 'Best: ' + S.best));
        else overlay.append(h('h1', {}, 'GAME OVER'), h('p', {}, 'Score ' + S.score + ' · Gems ' + S.gems), h('p', {}, S.score >= S.best ? 'New personal best' : 'Best: ' + S.best), h('button', { class: 'or-btn', onclick: start }, '↻  PLAY AGAIN'));
      }
      function start() { overlay.classList.add('hidden'); reset(); S.state = 'play'; stage.focus(); }
      const moveLane = (d) => { if (S.state !== 'play') return; const n = Math.max(0, Math.min(2, S.lane + d)); if (n !== S.lane) { S.lane = n; PatOS.sound.tone(500 + n * 120, 0.06, { vol: 0.06 }); } };
      const jump = () => { if (S.state === 'play' && S.y <= 0.71) { S.vy = 11; PatOS.sound.tone(400, 0.15, { vol: 0.08, slide: 900 }); } };
      stage.tabIndex = 0;
      stage.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') { e.preventDefault(); moveLane(-1); }
        else if (k === 'arrowright' || k === 'd') { e.preventDefault(); moveLane(1); }
        else if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); if (S.state === 'play') jump(); else start(); }
        else if (k === 'p' || k === 'escape') { if (S.state === 'play') { S.state = 'pause'; overlay.classList.remove('hidden'); overlay.innerHTML = ''; overlay.append(h('h1', {}, 'PAUSED'), h('button', { class: 'or-btn', onclick: () => { overlay.classList.add('hidden'); S.state = 'play'; stage.focus(); } }, 'RESUME')); } }
      });
      let tx0 = null; // touch / swipe
      stage.addEventListener('pointerdown', (e) => { tx0 = { x: e.clientX, y: e.clientY }; stage.focus(); });
      stage.addEventListener('pointerup', (e) => { if (!tx0 || S.state !== 'play') return; const dx = e.clientX - tx0.x, dy = e.clientY - tx0.y; if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else if (dy < -30) jump(); else { const r = stage.getBoundingClientRect(); moveLane(e.clientX < r.left + r.width / 2 ? -1 : 1); } tx0 = null; });
      win.on('blur', () => { if (S.state === 'play') stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); });

      const resize = () => { const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
      win.on('resize', resize);
      const clock = new THREE.Clock(); let raf, t = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (win.minimized || document.hidden) return;
        const dt = Math.min(0.05, clock.getDelta()); t += dt;
        const playing = S.state === 'play';
        const v = playing ? S.speed : S.state === 'menu' ? 8 : 0;
        // scroll world
        grid.position.z = (grid.position.z + v * dt) % 2.5;
        if (playing) {
          S.speed = Math.min(55, 18 + S.dist / 120); S.dist += v * dt; S.score = Math.floor(S.dist) + S.gems * 50;
          S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 14);
          S.vy -= 32 * dt; S.y = Math.max(0.7, S.y + S.vy * dt); if (S.y === 0.7) S.vy = 0;
          orbMesh.position.set(S.x, S.y, 0); orbMesh.rotation.x -= v * dt / 0.7;
          S.spawnZ += v * dt;
          while (S.spawnZ > -110) { spawnRow(S.spawnZ - 100); S.spawnZ -= Math.max(9, 18 - S.dist / 400); }
        } else if (S.state === 'menu') { orbMesh.position.set(Math.sin(t) * 2, 0.7 + Math.abs(Math.sin(t * 3)) * 0.6, 0); orbMesh.rotation.x -= dt * 6; }
        for (let i = objs.length - 1; i >= 0; i--) {
          const o = objs[i]; o.m.position.z += v * dt;
          if (o.type === 'gem') { o.m.rotation.y += dt * 4; o.m.position.y = 1 + Math.sin(t * 5 + i) * 0.2; }
          if (playing && Math.abs(o.m.position.z) < 0.9 && Math.abs(o.m.position.x - S.x) < 1.3) {
            if (o.type === 'gem') { S.gems++; PatOS.sound.tone(1200, 0.12, { vol: 0.08 }); PatOS.sound.tone(1800, 0.12, { vol: 0.06, delay: 0.06 }); scene.remove(o.m); objs.splice(i, 1); continue; }
            if (!(o.low && S.y > 1.3)) { boom(); }
          }
          if (o.m.position.z > 12) { scene.remove(o.m); objs.splice(i, 1); }
        }
        for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.m.position.add(p.v); p.v.y -= 0.012; p.m.rotation.x += 0.2; p.life -= dt; if (p.life <= 0) { scene.remove(p.m); p.m.geometry.dispose(); parts.splice(i, 1); } }
        // trail
        for (let i = TR - 1; i > 0; i--) { trP[i * 3] = trP[(i - 1) * 3] + (Math.random() - 0.5) * 0.05; trP[i * 3 + 1] = trP[(i - 1) * 3 + 1]; trP[i * 3 + 2] = trP[(i - 1) * 3 + 2] + v * dt; }
        trP[0] = orbMesh.position.x; trP[1] = orbMesh.position.y; trP[2] = orbMesh.position.z + 0.6; trailG.attributes.position.needsUpdate = true; trail.visible = orbMesh.visible;
        // camera
        S.shake *= 0.9;
        cam.position.set(S.x * 0.5 + (Math.random() - 0.5) * S.shake, 4 + (Math.random() - 0.5) * S.shake, 8);
        cam.lookAt(S.x * 0.3, 1, -10);
        cam.fov = 65 + (S.speed - 18) * 0.4; cam.updateProjectionMatrix();
        hud.innerHTML = playing || S.state === 'pause' ? `<b>${S.score}</b><span>${PatOS.sym('gem')} ${S.gems}</span><span>${PatOS.sym('bolt')} ${Math.round(S.speed * 3.6)} km/h</span>` : '';
        renderer.paced(scene, cam);
      };
      resize(); showOverlay('menu'); loop();
      setTimeout(() => stage.focus(), 100);
      win.on('closed', () => { cancelAnimationFrame(raf); renderer.dispose(); });
    }
  });
})();
