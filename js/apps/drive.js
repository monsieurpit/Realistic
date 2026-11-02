/* Drive — every document, spreadsheet, presentation and form in one place */
(function () {
  'use strict';
  const { h } = PatOS;
  const TYPES = { pdoc: ['docs', 'Document'], psheet: ['sheets', 'Spreadsheet'], csv: ['sheets', 'Spreadsheet'], pslides: ['slides', 'Presentation'], pform: ['forms', 'Form'] };
  PatOS.registerApp({
    id: 'drive', name: 'Drive', icon: 'drive', width: 920, height: 600, category: 'Office', keywords: 'files documents cloud storage google drive',
    about: 'All your documents, spreadsheets, presentations and forms.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let filter = 'all', q = '';
      const search = h('input', { class: 'field', placeholder: 'Search in Drive', style: { width: '220px' } });
      search.oninput = () => { q = search.value.toLowerCase(); render(); };
      const bNew = h('button', { class: 'btn primary' }, '＋ New');
      bNew.onclick = () => { const r = bNew.getBoundingClientRect(); PatOS.menu([
        { label: 'Document', action: () => PatOS.launch('docs') }, { label: 'Spreadsheet', action: () => PatOS.launch('sheets') },
        { label: 'Presentation', action: () => PatOS.launch('slides') }, { label: 'Form', action: () => PatOS.launch('forms') },
        { divider: true }, { label: 'Upload a file…', action: () => PatOS.importFiles('/Documents') }], r.left, r.bottom + 4); };
      win.toolbar.append(bNew, h('div', { style: { flex: 1 } }), search);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const side = h('div', { class: 'dv-side' });
      const main = h('div', { class: 'dv-main' });
      win.body.appendChild(h('div', { class: 'dv-wrap' }, side, main));
      function files() {
        const out = [];
        PatOS.fs.walk('/', (p, n) => { const t = TYPES[PatOS.fs.ext(p)]; if (n.type === 'file' && t) out.push({ p, n, t }); });
        return out.sort((a, b) => b.n.mtime - a.n.mtime);
      }
      function render() {
        side.innerHTML = '';
        [['all', '🗂', 'My Drive'], ['docs', '📄', 'Documents'], ['sheets', '📊', 'Spreadsheets'], ['slides', '📽', 'Presentations'], ['forms', '📋', 'Forms']].forEach(([k, ic, l]) => {
          const b = h('button', { class: 'dv-si' + (filter === k ? ' on' : '') }, h('span', {}, ic), l); b.onclick = () => { filter = k; render(); }; side.appendChild(b);
        });
        const used = PatOS.store.usage();
        side.append(h('div', { class: 'dv-storage' }, h('div', { class: 'fd-bar' }, h('span', { style: { width: Math.min(100, used / (5 * 1048576) * 100) + '%' } })), h('small', {}, PatOS.fmtBytes(used) + ' of about 5 MB used')));
        main.innerHTML = '';
        const list = files().filter((f) => (filter === 'all' || f.t[0] === filter) && (!q || PatOS.fs.basename(f.p).toLowerCase().includes(q)));
        const quick = h('div', { class: 'dv-quick' }, ...[['docs', 'Blank document'], ['sheets', 'Blank spreadsheet'], ['slides', 'Blank presentation'], ['forms', 'Blank form']].map(([id, l]) => {
          const c = h('button', { class: 'dv-new' }, h('div', { class: 'dv-nic', html: PatOS.iconHTML(id) }), h('span', {}, l)); c.onclick = () => { PatOS.setLaunchRect(c.querySelector('.dv-nic')); PatOS.launch(id); }; return c;
        }));
        main.append(h('h2', {}, 'Start something new'), quick, h('h2', {}, filter === 'all' ? 'Recent files' : side.querySelector('.on').textContent.slice(2)));
        if (!list.length) { main.appendChild(h('div', { class: 'fd-empty' }, q ? 'No files match your search' : 'Nothing here yet. Create one above.')); return; }
        const grid = h('div', { class: 'dv-grid' });
        list.forEach((f) => {
          const name = PatOS.fs.basename(f.p).replace(/\.\w+$/, '');
          const card = h('div', { class: 'dv-card' }, h('div', { class: 'dv-prev t-' + f.t[0] }, preview(f)), h('div', { class: 'dv-meta' }, h('div', { class: 'dv-ic', html: PatOS.iconHTML(f.t[0]) }), h('div', { class: 'dv-txt' }, h('b', {}, name), h('small', {}, f.t[1] + ' · ' + new Date(f.n.mtime).toLocaleDateString()))));
          card.onclick = () => { PatOS.setLaunchRect(card); PatOS.openFile(f.p); };
          card.oncontextmenu = (e) => { e.preventDefault(); PatOS.fileMenu(f.p, e.clientX, e.clientY); };
          grid.appendChild(card);
        });
        main.appendChild(grid);
      }
      function preview(f) {
        try {
          if (f.t[0] === 'docs') { const d = h('div', { class: 'dv-doc', html: String(f.n.content).replace(/<img[^>]*>/g, '') }); return d; }
          if (f.t[0] === 'slides') { const deck = JSON.parse(f.n.content); const t = deck.slides[0] && deck.slides[0].els.find((e) => e.type === 'text'); return h('div', { class: 'dv-slide' }, t ? h('div', { html: t.html }) : ''); }
          if (f.t[0] === 'sheets') { const g = h('div', { class: 'dv-sheet' }); for (let i = 0; i < 24; i++) g.appendChild(h('span')); return g; }
          if (f.t[0] === 'forms') { const fm = JSON.parse(f.n.content); return h('div', { class: 'dv-form' }, h('b', {}, fm.title || 'Form'), h('small', {}, (fm.questions || []).length + ' questions')); }
        } catch (e) {}
        return '';
      }
      const off = PatOS.on('fs', PatOS.debounce(render, 200)); win.on('closed', off);
      render();
    }
  });
})();
