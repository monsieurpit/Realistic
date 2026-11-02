/* Photos — gallery & viewer */
(function () {
  'use strict';
  const { h } = PatOS;
  const samples = [];
  function sampleArt() {
    if (samples.length) return samples;
    const kinds = ['sonora', 'aurora', 'monterra', 'ocean', 'sunrise', 'mint', 'ember', 'midnight'];
    kinds.forEach((k) => samples.push({ name: PatOS.wallpaper.palettes[k].name + ' Waves', src: PatOS.wallpaper.thumbLarge(k), sample: true }));
    // generative extra pieces
    const gen = (name, fn) => { const c = document.createElement('canvas'); c.width = 640; c.height = 400; fn(c.getContext('2d'), 640, 400); samples.push({ name, src: c.toDataURL('image/jpeg', 0.85), sample: true }); };
    gen('Circles', (x, W, H) => { x.fillStyle = '#0d1b2a'; x.fillRect(0, 0, W, H); for (let i = 0; i < 70; i++) { x.fillStyle = `hsla(${180 + Math.random() * 140},80%,60%,.35)`; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, 10 + Math.random() * 70, 0, 7); x.fill(); } });
    gen('Mountains', (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ff9a8b'); g.addColorStop(1, '#ff6a88'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#fff6'; x.beginPath(); x.arc(W * 0.7, H * 0.35, 50, 0, 7); x.fill(); ['#7a3b69', '#563d7c', '#2d1e4f'].forEach((c, j) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 20) x.lineTo(i, H * (0.45 + j * 0.15) - Math.abs(Math.sin(i * 0.01 * (j + 1) + j)) * 90); x.lineTo(W, H); x.fill(); }); });
    gen('Grid City', (x, W, H) => { x.fillStyle = '#090018'; x.fillRect(0, 0, W, H); x.strokeStyle = '#ff2fa3'; for (let i = -20; i <= 20; i++) { x.beginPath(); x.moveTo(W / 2 + i * 12, H * 0.55); x.lineTo(W / 2 + i * 90, H); x.stroke(); } for (let j = 0; j < 12; j++) { const y = H * 0.55 + Math.pow(j / 12, 2) * H * 0.45; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } const g = x.createLinearGradient(0, 60, 0, 220); g.addColorStop(0, '#ffd319'); g.addColorStop(1, '#ff2975'); x.fillStyle = g; x.beginPath(); x.arc(W / 2, H * 0.55, 120, Math.PI, 0); x.fill(); });
    return samples;
  }

  PatOS.registerApp({
    id: 'photos', name: 'Photos', icon: 'photos', width: 900, height: 600, keywords: 'pictures images gallery',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const seg = h('div', { class: 'seg' });
      const bImport = h('button', { class: 'tbtn', title: 'Import photos' }, '⬆ Import');
      win.toolbar.style.justifyContent = 'space-between'; win.toolbar.style.paddingLeft = '70px';
      win.toolbar.append(seg, bImport);
      let tab = 'library';
      [['library', 'Library'], ['samples', 'Art']].forEach(([k, l]) => seg.appendChild(h('button', { class: 'tab', 'data-k': k, onclick: () => { tab = k; render(); } }, l)));
      const grid = h('div', { class: 'ph-grid' });
      const viewer = h('div', { class: 'ph-view hidden' });
      win.body.append(grid, viewer);
      let list = [];
      function userImages() { const out = []; PatOS.fs.walk('/', (p, n) => { if (PatOS.fileKind(p, n) === 'image' && String(n.content).startsWith('data:image')) out.push({ name: PatOS.fs.basename(p), src: n.content, path: p, mtime: n.mtime }); }); return out.sort((a, b) => b.mtime - a.mtime); }
      function render() {
        [...seg.children].forEach((b) => b.classList.toggle('on', b.dataset.k === tab));
        list = tab === 'library' ? userImages() : sampleArt();
        grid.innerHTML = '';
        if (!list.length) grid.appendChild(h('div', { class: 'ph-empty' }, h('div', { style: { fontSize: '48px' } }, '🖼'), h('b', {}, 'No photos yet'), h('p', {}, 'Take pictures in Photo Booth, draw in Paint, or import images from your computer.'), h('button', { class: 'btn primary', onclick: () => PatOS.importFiles('/Pictures', 'image/*') }, 'Import Photos')));
        list.forEach((p, i) => { const t = h('div', { class: 'ph-thumb' }, h('img', { src: p.src, alt: p.name, loading: 'lazy' })); t.onclick = () => open(i); grid.appendChild(t); });
      }
      function open(i) {
        const p = list[i]; if (!p) return;
        viewer.innerHTML = ''; viewer.classList.remove('hidden');
        const img = h('img', { src: p.src, alt: p.name });
        const bar = h('div', { class: 'ph-bar' },
          h('button', { class: 'btn', onclick: () => viewer.classList.add('hidden') }, '‹ All Photos'),
          h('b', {}, p.name), h('div', { style: { flex: 1 } }),
          h('button', { class: 'btn', onclick: () => { PatOS.setSetting('customWallpaper', p.src); PatOS.setSetting('wallpaper', 'custom'); PatOS.notify({ title: 'Wallpaper set', body: p.name, icon: 'photos' }); } }, 'Set as Wallpaper'),
          h('button', { class: 'btn', onclick: () => PatOS.downloadFile(p.name.includes('.') ? p.name : p.name + '.jpg', p.src) }, 'Download'),
          p.path ? h('button', { class: 'btn danger', onclick: () => { PatOS.fs.remove(p.path); viewer.classList.add('hidden'); } }, 'Delete') : null);
        const prev = h('button', { class: 'ph-nav l', onclick: () => open((i - 1 + list.length) % list.length) }, '‹');
        const next = h('button', { class: 'ph-nav r', onclick: () => open((i + 1) % list.length) }, '›');
        viewer.append(bar, h('div', { class: 'ph-stage' }, img, list.length > 1 ? prev : null, list.length > 1 ? next : null));
        win.setTitle(p.name);
      }
      bImport.onclick = () => PatOS.importFiles('/Pictures', 'image/*');
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => { if (viewer.classList.contains('hidden')) return; if (e.key === 'ArrowRight') viewer.querySelector('.ph-nav.r') && viewer.querySelector('.ph-nav.r').click(); if (e.key === 'ArrowLeft') viewer.querySelector('.ph-nav.l') && viewer.querySelector('.ph-nav.l').click(); if (e.key === 'Escape') viewer.classList.add('hidden'); });
      const off = PatOS.on('fs', () => { if (tab === 'library') render(); });
      win.on('closed', off);
      win._open = (a) => { if (a.path) { tab = 'library'; render(); const i = list.findIndex((x) => x.path === PatOS.fs.norm(a.path)); if (i >= 0) open(i); } };
      render(); if (args.path) win._open(args);
    },
    onArgs(win, args) { win._open(args); }
  });
})();
