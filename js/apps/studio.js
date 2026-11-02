/* 3D Studio — build a little 3D scene (three.js) */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'studio', name: '3D Studio', icon: 'studio', width: 980, height: 620, dark: true, category: '3D & Games', keywords: '3d model shapes three editor',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const canvas = h('canvas', { class: 'g3d' });
      const panel = h('div', { class: 'g3d-panel' });
      const stage = h('div', { class: 'g3d-stage' }, canvas, panel, h('div', { class: 'g3d-hint' }, 'Click a shape to select · drag empty space to orbit · scroll to zoom'));
      win.body.appendChild(stage);
      if (!PatOS.has3D) { stage.innerHTML = '<div class="app-error">3D Studio needs WebGL.</div>'; return; }
      const renderer = PatOS.makeRenderer(canvas); renderer.shadowMap.enabled = true; renderer.setClearColor(0x1b1d24, 1);
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
      const target = new THREE.Vector3(0, 0.8, 0);
      const orb = PatOS.orbit(canvas, cam, target, { dist: 11, phi: 1.05, theta: 0.7 });
      scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x302020, 1.0));
      const sunL = new THREE.DirectionalLight(0xffffff, 2); sunL.position.set(6, 10, 4); sunL.castShadow = true; sunL.shadow.mapSize.set(1024, 1024); scene.add(sunL);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      const grid = new THREE.GridHelper(24, 24, 0x555a6a, 0x3a3e4a); grid.position.y = 0.002; scene.add(grid);
      const SHAPES = { Cube: () => new THREE.BoxGeometry(1.4, 1.4, 1.4), Sphere: () => new THREE.SphereGeometry(0.85, 48, 24), Torus: () => new THREE.TorusGeometry(0.75, 0.3, 24, 64), Knot: () => new THREE.TorusKnotGeometry(0.6, 0.22, 128, 16), Cone: () => new THREE.ConeGeometry(0.8, 1.6, 40), Cylinder: () => new THREE.CylinderGeometry(0.7, 0.7, 1.5, 40), Gem: () => new THREE.IcosahedronGeometry(0.9, 0), Ring: () => new THREE.RingGeometry(0.4, 0.9, 40) };
      const objects = []; let sel = null;
      const outline = new THREE.BoxHelper(new THREE.Mesh(), 0x0a84ff); outline.visible = false; scene.add(outline);
      function add(kind, opts) {
        opts = opts || {};
        const m = new THREE.Mesh(SHAPES[kind](), new THREE.MeshStandardMaterial({ color: opts.color || new THREE.Color().setHSL(Math.random(), 0.7, 0.55), metalness: opts.metal != null ? opts.metal : 0.2, roughness: opts.rough != null ? opts.rough : 0.4, side: THREE.DoubleSide }));
        m.castShadow = true; m.receiveShadow = true;
        m.position.set(opts.x != null ? opts.x : (Math.random() - 0.5) * 6, 1, opts.z != null ? opts.z : (Math.random() - 0.5) * 6);
        m.userData = { kind, spin: !!opts.spin, bob: Math.random() * 6 };
        scene.add(m); objects.push(m); select(m); PatOS.sound.pop();
      }
      function select(m) { sel = m; outline.visible = !!m; if (m) outline.setFromObject(m); renderPanel(); }
      const ray = new THREE.Raycaster(); let downAt = null;
      canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
      canvas.addEventListener('pointerup', (e) => {
        if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
        const r = canvas.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), cam);
        const hit = ray.intersectObjects(objects)[0]; select(hit ? hit.object : null);
      });
      const slider = (label, get, set, min, max, step) => { const r = h('input', { type: 'range', min, max, step, value: get() }); r.oninput = () => { set(+r.value); outline.setFromObject(sel); }; return h('label', {}, h('div', {}, label), r); };
      function renderPanel() {
        panel.innerHTML = '';
        panel.appendChild(h('b', {}, 'Add Shape'));
        panel.appendChild(h('div', { class: 'g3d-pres' }, ...Object.keys(SHAPES).map((k) => h('button', { class: 'btn', onclick: () => add(k) }, k))));
        if (!sel) { panel.appendChild(h('p', { class: 'st-note' }, 'Select a shape to edit it.')); return; }
        const m = sel.material;
        const col = h('input', { type: 'color', value: '#' + m.color.getHexString() }); col.oninput = () => m.color.set(col.value);
        const spin = h('button', { class: 'btn' + (sel.userData.spin ? ' primary' : ''), onclick: () => { sel.userData.spin = !sel.userData.spin; renderPanel(); } }, sel.userData.spin ? 'Spinning' : 'Spin');
        const wire = h('button', { class: 'btn' + (m.wireframe ? ' primary' : ''), onclick: () => { m.wireframe = !m.wireframe; renderPanel(); } }, 'Wireframe');
        panel.append(h('b', {}, 'Selected: ' + sel.userData.kind),
          h('label', { class: 'g3d-c' }, 'Color', col),
          slider('Size', () => sel.scale.x, (v) => sel.scale.setScalar(v), 0.2, 3, 0.05),
          slider('Height', () => sel.position.y, (v) => (sel.position.y = v), 0, 5, 0.05),
          slider('Left / Right', () => sel.position.x, (v) => (sel.position.x = v), -8, 8, 0.05),
          slider('Front / Back', () => sel.position.z, (v) => (sel.position.z = v), -8, 8, 0.05),
          slider('Metal', () => m.metalness, (v) => (m.metalness = v), 0, 1, 0.01),
          slider('Roughness', () => m.roughness, (v) => (m.roughness = v), 0, 1, 0.01),
          h('div', { class: 'g3d-pres' }, spin, wire, h('button', { class: 'btn', onclick: () => add(sel.userData.kind, { color: '#' + m.color.getHexString(), x: sel.position.x + 1.5, z: sel.position.z }) }, 'Duplicate'), h('button', { class: 'btn danger', onclick: () => { scene.remove(sel); sel.geometry.dispose(); objects.splice(objects.indexOf(sel), 1); select(null); } }, 'Delete')));
      }
      const bAuto = h('button', { class: 'tbtn' }, '⟳ Auto-rotate');
      const bShot = h('button', { class: 'tbtn', title: 'Save to Photos' }, '📸');
      const bClear = h('button', { class: 'tbtn' }, 'Clear');
      bAuto.onclick = () => { orb.auto = orb.auto ? 0 : 0.004; bAuto.classList.toggle('on', !!orb.auto); };
      bShot.onclick = () => { outline.visible = false; renderer.render(scene, cam); const nm = PatOS.fs.uniqueName('/Pictures', '3D Scene.jpg'); PatOS.fs.write('/Pictures/' + nm, canvas.toDataURL('image/jpeg', 0.85)); outline.visible = !!sel; PatOS.notify({ title: 'Scene saved', body: nm, icon: 'studio' }); };
      bClear.onclick = () => { objects.splice(0).forEach((o) => scene.remove(o)); select(null); };
      win.toolbar.append(bClear, bAuto, bShot);
      add('Knot', { x: 0, z: 0, color: '#ff375f', metal: 0.6, rough: 0.2, spin: true });
      add('Cube', { x: -2.5, z: 1, color: '#0a84ff' }); add('Sphere', { x: 2.5, z: 0.5, color: '#ffd60a', metal: 0.9, rough: 0.1 });
      select(null);
      const resize = () => { const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
      win.on('resize', resize);
      let raf, t = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop); if (win.minimized || document.hidden) return; t += 0.016;
        objects.forEach((o) => { if (o.userData.spin) { o.rotation.y += 0.02; o.rotation.x += 0.01; } });
        if (sel) outline.setFromObject(sel);
        orb.update(); renderer.render(scene, cam);
      };
      resize(); loop();
      win.on('closed', () => { cancelAnimationFrame(raf); renderer.dispose(); });
    }
  });
})();
