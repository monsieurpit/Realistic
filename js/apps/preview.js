/* Preview — open PDFs and pictures */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'preview', name: 'Preview', icon: 'preview', single: false, width: 860, height: 640, category: 'Utilities', keywords: 'pdf viewer image picture open document reader',
    about: 'Open PDF files and pictures.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let path = args.path || null, zoom = 1, rot = 0, blobUrl = null;
      const bOpen = h('button', { class: 'btn' }, 'Open…');
      const bOut = h('button', { class: 'tbtn', title: 'Zoom out' }, '−'), bIn = h('button', { class: 'tbtn', title: 'Zoom in' }, '+'), bRot = h('button', { class: 'tbtn', title: 'Rotate' }, '⟳'), bFit = h('button', { class: 'tbtn', title: 'Actual size' }, '1:1');
      win.toolbar.append(bOpen, h('div', { style: { flex: 1 } }), bOut, bIn, bFit, bRot);
      const view = h('div', { class: 'pv-view' }); win.body.appendChild(view);
      function empty() {
        view.innerHTML = '';
        const files = []; PatOS.fs.walk('/', (p, n) => { if (n.type === 'file' && (/\.pdf$/i.test(p) || PatOS.fileKind(p, n) === 'image')) files.push(p); });
        view.appendChild(h('div', { class: 'pv-empty' }, h('div', { class: 'pv-big', html: PatOS.iconHTML('preview') }), h('h2', {}, 'Open a PDF or a picture'), h('p', {}, 'Choose a file from your computer, or one already in PatOS.'),
          h('button', { class: 'btn primary', onclick: importFile }, 'Choose a File…'),
          files.length ? h('div', { class: 'pv-recent' }, ...files.slice(0, 12).map((p) => h('button', { class: 'pv-file', onclick: () => open(p) }, h('span', { class: 'pv-fic', html: PatOS.fileIconHTML(p, PatOS.fs.get(p)) }), PatOS.fs.basename(p)))) : null));
        [bOut, bIn, bRot, bFit].forEach((b) => { b.disabled = true; });
      }
      function importFile() { PatOS.importFiles('/Documents', 'application/pdf,image/*').then((ps) => { if (ps[0]) open(ps[0]); }); }
      function open(p) {
        path = p; const data = PatOS.fs.read(p) || ''; view.innerHTML = ''; zoom = 1; rot = 0;
        if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
        win.setTitle(PatOS.fs.basename(p));
        if (/\.pdf$/i.test(p) || data.startsWith('data:application/pdf')) {
          try { const bin = atob(data.split(',')[1]); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); blobUrl = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })); }
          catch (e) { view.appendChild(h('div', { class: 'pv-empty' }, h('h2', {}, 'This PDF can’t be opened'))); return; }
          view.appendChild(h('iframe', { class: 'pv-pdf', src: blobUrl, title: PatOS.fs.basename(p) }));
          [bOut, bIn, bRot, bFit].forEach((b) => { b.disabled = true; });
          return;
        }
        const img = h('img', { class: 'pv-img', src: data, alt: PatOS.fs.basename(p), draggable: 'false' });
        view.appendChild(h('div', { class: 'pv-canvas' }, img));
        [bOut, bIn, bRot, bFit].forEach((b) => { b.disabled = false; });
        apply();
      }
      function apply() { const img = view.querySelector('.pv-img'); if (img) { img.style.transform = `rotate(${rot}deg) scale(${zoom})`; img.classList.toggle('free', zoom !== 1); } }
      bOpen.onclick = importFile; bIn.onclick = () => { zoom = Math.min(6, zoom * 1.25); apply(); }; bOut.onclick = () => { zoom = Math.max(0.2, zoom / 1.25); apply(); }; bFit.onclick = () => { zoom = 1; apply(); }; bRot.onclick = () => { rot = (rot + 90) % 360; apply(); };
      view.addEventListener('wheel', (e) => { if (!view.querySelector('.pv-img') || !e.ctrlKey) return; e.preventDefault(); zoom = Math.min(6, Math.max(0.2, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); apply(); }, { passive: false });
      win.on('closed', () => blobUrl && URL.revokeObjectURL(blobUrl));
      if (path) open(path); else empty();
    }
  });
})();
