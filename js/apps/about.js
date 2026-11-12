/* About PatOS — with a spinning 3D logo */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    needs3D: true, id: 'about', name: 'About PatOS', icon: 'about', width: 520, height: 400, resizable: false, category: 'Utilities', keywords: 'info version system',
    launch(win) {
      const canvas = h('canvas', { class: 'ab-canvas', width: 200, height: 200 });
      const ua = navigator.userAgent;
      const info = [['Version', 'PatOS ' + (PatOS.versionNow ? PatOS.versionNow() : PatOS.version)], ['Device', ua.includes('CrOS') ? 'Chromebook' : (navigator.platform || 'Computer')], ['Browser', (ua.match(/(Chrome|Firefox|Safari|Edg)\/[\d]+/) || ['Web browser'])[0].replace('/', ' ')],
        ['Graphics', PatOS.has3D ? 'WebGL · three.js r' + THREE.REVISION : PatOS.webgl ? 'WebGL' : 'No WebGL'], ['Display', screen.width + ' × ' + screen.height], ['Apps', PatOS.appOrder.length + ' installed'], ['Storage', PatOS.fmtBytes(PatOS.store.usage()) + ' used']];
      win.body.appendChild(h('div', { class: 'ab' }, canvas, h('div', { class: 'ab-info' }, h('h1', {}, 'PatOS'), h('div', { class: 'ab-ver' }, 'Version ' + (PatOS.versionNow ? PatOS.versionNow() : PatOS.version)),
        ...info.map(([k, v]) => h('div', { class: 'ab-row' }, h('span', {}, k), h('b', {}, v))),
        h('div', { class: 'ab-btns' }, h('button', { class: 'btn', onclick: () => PatOS.launch('settings') }, 'Settings…'), h('button', { class: 'btn', onclick: () => PatOS.launch('activity') }, 'Activity…')),
        h('small', { class: 'ab-cr' }, 'Made by Pat'))));
      if (!PatOS.has3D) return;
      const r = PatOS.makeRenderer(canvas); r.setSize(200, 200, false);
      const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50); cam.position.z = 7;
      const shape = new THREE.Shape(); // letter "P"
      shape.moveTo(-0.9, -1.5); shape.lineTo(-0.9, 1.5); shape.lineTo(0.3, 1.5); shape.bezierCurveTo(1.5, 1.5, 1.5, -0.3, 0.3, -0.3); shape.lineTo(-0.3, -0.3); shape.lineTo(-0.3, -1.5); shape.lineTo(-0.9, -1.5);
      const hole = new THREE.Path(); hole.moveTo(-0.3, 0.25); hole.lineTo(0.25, 0.25); hole.bezierCurveTo(0.85, 0.25, 0.85, 0.95, 0.25, 0.95); hole.lineTo(-0.3, 0.95); hole.lineTo(-0.3, 0.25); shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 4 }); geo.center();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.2 })); scene.add(mesh);
      const l1 = new THREE.PointLight(0x7d5cff, 60, 20); l1.position.set(-3, 2, 4); scene.add(l1);
      const l2 = new THREE.PointLight(0xff4fa0, 60, 20); l2.position.set(3, -2, 4); scene.add(l2);
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      let raf; const loop = () => { raf = requestAnimationFrame(loop); if (win.minimized || document.hidden) return; mesh.rotation.y += 0.015; mesh.rotation.x = Math.sin(Date.now() / 1200) * 0.2; r.paced(scene, cam); };
      loop(); win.on('closed', () => { cancelAnimationFrame(raf); r.dispose(); geo.dispose(); });
    }
  });
})();
