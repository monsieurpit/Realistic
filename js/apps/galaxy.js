/* Galaxy — interactive 3D galaxy generator (three.js) */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    needs3D: true, id: 'galaxy', name: 'Galaxy', icon: 'galaxy', width: 960, height: 620, dark: true, category: '3D & Games', keywords: '3d space stars three',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const canvas = h('canvas', { class: 'g3d' });
      const panel = h('div', { class: 'g3d-panel' });
      const stage = h('div', { class: 'g3d-stage' }, canvas, panel, h('div', { class: 'g3d-hint' }, 'Drag to orbit · scroll to zoom · click to make a supernova'));
      win.body.appendChild(stage);
      if (!PatOS.has3D) { stage.innerHTML = '<div class="app-error">3D graphics (WebGL) are not available on this device.</div>'; return; }
      const P = { stars: 60000, arms: 5, radius: 9, spin: 1.1, randomness: 0.35, power: 3, inside: '#ff8a3d', outside: '#3d5bff', size: 0.018, speed: 0.15 };
      const renderer = PatOS.makeRenderer(canvas);
      renderer.setClearColor(0x000000, 1);
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
      const orb = PatOS.orbit(canvas, cam, new THREE.Vector3(), { dist: 14, phi: 0.95, min: 2, max: 40 });
      let points = null, geo = null, mat = null;
      const bg = new THREE.BufferGeometry(); const bp = new Float32Array(3000 * 3);
      for (let i = 0; i < 3000; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(50 + Math.random() * 50); bp.set([v.x, v.y, v.z], i * 3); }
      bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
      scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ size: 0.15, color: 0xaaaaff })));
      const novas = [];

      function build() {
        if (points) { geo.dispose(); mat.dispose(); scene.remove(points); }
        geo = new THREE.BufferGeometry();
        const pos = new Float32Array(P.stars * 3), col = new Float32Array(P.stars * 3);
        const ci = new THREE.Color(P.inside), co = new THREE.Color(P.outside);
        for (let i = 0; i < P.stars; i++) {
          const r = Math.random() * P.radius; const br = ((i % P.arms) / P.arms) * Math.PI * 2; const sp = r * P.spin;
          const rr = () => Math.pow(Math.random(), P.power) * (Math.random() < 0.5 ? 1 : -1) * P.randomness * r;
          pos[i * 3] = Math.cos(br + sp) * r + rr(); pos[i * 3 + 1] = rr() * 0.6; pos[i * 3 + 2] = Math.sin(br + sp) * r + rr();
          const c = ci.clone().lerp(co, r / P.radius); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        mat = new THREE.PointsMaterial({ size: P.size * 3, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true });
        points = new THREE.Points(geo, mat); scene.add(points);
      }
      const ctl = (label, key, min, max, step) => {
        const v = h('span'); const r = h('input', { type: 'range', min, max, step, value: P[key] });
        const upd = () => (v.textContent = (+r.value).toFixed(step < 1 ? 2 : 0)); upd();
        r.oninput = upd; r.onchange = () => { P[key] = +r.value; build(); };
        if (key === 'speed') r.oninput = () => { P.speed = +r.value; upd(); };
        return h('label', {}, h('div', {}, label, v), r);
      };
      const color = (label, key) => { const c = h('input', { type: 'color', value: P[key] }); c.oninput = () => { P[key] = c.value; build(); }; return h('label', { class: 'g3d-c' }, label, c); };
      const presets = { Spiral: { arms: 5, spin: 1.1, randomness: 0.35, inside: '#ff8a3d', outside: '#3d5bff' }, Nebula: { arms: 3, spin: 0.4, randomness: 1.2, inside: '#ff4fd8', outside: '#38f2ff' }, Ring: { arms: 12, spin: 0, randomness: 0.1, inside: '#ffffff', outside: '#ff2e63' }, Vortex: { arms: 2, spin: 3, randomness: 0.2, inside: '#ffe259', outside: '#ff2fa3' } };
      const pres = h('div', { class: 'g3d-pres' }, ...Object.keys(presets).map((k) => h('button', { class: 'btn', onclick: () => { Object.assign(P, presets[k]); build(); render(); } }, k)));
      function render() {
        panel.innerHTML = '';
        panel.append(h('b', {}, 'Galaxy Generator'), pres, ctl('Stars', 'stars', 5000, 150000, 1000), ctl('Arms', 'arms', 1, 12, 1), ctl('Radius', 'radius', 2, 20, 0.5), ctl('Spin', 'spin', -4, 4, 0.05), ctl('Spread', 'randomness', 0, 2, 0.01), ctl('Star size', 'size', 0.005, 0.08, 0.001), ctl('Rotation speed', 'speed', 0, 1, 0.01), h('div', { class: 'g3d-cs' }, color('Core', 'inside'), color('Edge', 'outside')));
      }
      const bPanel = h('button', { class: 'tbtn', title: 'Toggle controls' }, '⚙ Controls');
      const bShot = h('button', { class: 'tbtn', title: 'Save picture to Photos' }, '📸');
      bPanel.onclick = () => panel.classList.toggle('hidden');
      bShot.onclick = () => { renderer.render(scene, cam); const nm = PatOS.fs.uniqueName('/Pictures', 'Galaxy.jpg'); PatOS.fs.write('/Pictures/' + nm, canvas.toDataURL('image/jpeg', 0.85)); PatOS.notify({ title: 'Galaxy saved', body: nm + ' is in Photos', icon: 'galaxy' }); };
      win.toolbar.append(bShot, bPanel);
      if (PatOS.isMobile) panel.classList.add('hidden');
      canvas.addEventListener('click', (e) => {
        if (orb.vx * orb.vx + orb.vy * orb.vy > 0.0001) return;
        const r = canvas.getBoundingClientRect();
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), cam);
        const p = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p); if (!p) return;
        const n = 800; const g = new THREE.BufferGeometry(); const a = new Float32Array(n * 3); const vel = [];
        for (let i = 0; i < n; i++) { a.set([p.x, p.y, p.z], i * 3); vel.push(new THREE.Vector3().randomDirection().multiplyScalar(0.02 + Math.random() * 0.06)); }
        g.setAttribute('position', new THREE.BufferAttribute(a, 3));
        const m = new THREE.PointsMaterial({ size: 0.08, color: new THREE.Color().setHSL(Math.random(), 1, 0.7), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
        const pts = new THREE.Points(g, m); scene.add(pts); novas.push({ pts, vel, life: 1 });
        PatOS.sound.tone(120, 0.6, { vol: 0.15, slide: 40 });
      });
      const resize = () => { const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
      win.on('resize', resize);
      let raf; const clock = new THREE.Clock();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (win.minimized || document.hidden) return;
        const dt = clock.getDelta();
        if (points) points.rotation.y += dt * P.speed;
        for (let i = novas.length - 1; i >= 0; i--) {
          const nv = novas[i]; const arr = nv.pts.geometry.attributes.position.array;
          nv.vel.forEach((v, j) => { arr[j * 3] += v.x; arr[j * 3 + 1] += v.y; arr[j * 3 + 2] += v.z; v.multiplyScalar(0.985); });
          nv.pts.geometry.attributes.position.needsUpdate = true; nv.life -= dt * 0.4; nv.pts.material.opacity = Math.max(0, nv.life);
          if (nv.life <= 0) { scene.remove(nv.pts); nv.pts.geometry.dispose(); nv.pts.material.dispose(); novas.splice(i, 1); }
        }
        orb.update(); renderer.paced(scene, cam);
      };
      build(); render(); resize(); loop();
      win.on('closed', () => { cancelAnimationFrame(raf); geo && geo.dispose(); renderer.dispose(); });
    }
  });
})();
