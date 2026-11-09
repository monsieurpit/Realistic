/* Preview — open PDFs and pictures */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'preview', name: 'Preview', icon: 'preview', single: false, width: 980, height: 700, category: 'Utilities', keywords: 'pdf viewer image picture open document reader',
    about: 'Read PDF files and pictures. Highlight, draw and add text to a PDF, then save it.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let path = args.path || null, zoom = 1, rot = 0, blobUrl = null;
      const bOpen = h('button', { class: 'tbtn', title: PatOS.t('Open…'), 'aria-label': PatOS.t('Open…'), html: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' });
      const bOut = h('button', { class: 'tbtn', title: 'Zoom out' }, '−'), bIn = h('button', { class: 'tbtn', title: 'Zoom in' }, '+'), bRot = h('button', { class: 'tbtn', title: 'Rotate' }, '⟳'), bFit = h('button', { class: 'tbtn', title: 'Actual size' }, '1:1');

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
      function bar() { win.toolbar.innerHTML = ''; win.toolbar.append(bOpen, h('div', { style: { flex: 1 } }), bOut, bIn, bFit, bRot); }
      async function open(p) {
        path = p; PatOS.remember && PatOS.remember(win, { path: p }); const data = PatOS.fs.read(p) || ''; view.innerHTML = ''; zoom = 1; rot = 0;
        if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
        win.setTitle(PatOS.fs.basename(p)); bar();
        const node = PatOS.fs.get(p);
        if (/\.pdf$/i.test(p) || data.startsWith('data:application/pdf') || (node && node.mime === 'application/pdf')) {
          // the full viewer (select text, find, highlight, draw, write, export); a plain view if it can't load here
          view.appendChild(h('div', { class: 'pv-empty' }, h('p', {}, PatOS.t('Opening…'))));
          let ok = false;
          try { ok = await PatOS.pdfView(win, p, view); } catch (e) { ok = false; }
          if (ok) { win.toolbar.prepend(bOpen); return; }
          bar(); view.innerHTML = '';
          if (node && node.blob) { const u = await PatOS.fs.blobURL(p); if (u) { view.appendChild(h('iframe', { class: 'pv-pdf', src: u, title: PatOS.fs.basename(p) })); [bOut, bIn, bRot, bFit].forEach((b) => { b.disabled = true; }); return; } }
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
      bar();
      if (path) open(path); else empty();
    }
  });
})();
