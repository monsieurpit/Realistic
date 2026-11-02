/* Finder — file manager */
(function () {
  'use strict';
  const { h, $$ } = PatOS;
  const PLACES = [
    { label: 'Desktop', path: '/Desktop', ic: '🖥' },
    { label: 'Documents', path: '/Documents', ic: '📄' },
    { label: 'Downloads', path: '/Downloads', ic: '⬇️' },
    { label: 'Pictures', path: '/Pictures', ic: '🖼' },
    { label: 'Music', path: '/Music', ic: '🎵' },
    { label: 'Home', path: '/', ic: '🏠' }
  ];
  const svgBack = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const svgFwd = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  PatOS.registerApp({
    id: 'finder', name: 'Finder', icon: 'finder', single: false, width: 860, height: 520, keywords: 'files folders explorer',
    about: 'Browse and organize everything stored in PatOS.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let cwd = args.path || '/Desktop';
      let view = PatOS.store.get('finderView', 'grid');
      const back = [], fwd = [];
      let sel = null;

      const bBack = h('button', { class: 'tbtn', html: svgBack, title: 'Back' });
      const bFwd = h('button', { class: 'tbtn', html: svgFwd, title: 'Forward' });
      const title = h('div', { class: 'fd-title' });
      const bGrid = h('button', { class: 'tbtn', title: 'Icons', html: '<svg viewBox="0 0 24 24"><g fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></g></svg>' });
      const bList = h('button', { class: 'tbtn', title: 'List', html: '<svg viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></g></svg>' });
      const bNew = h('button', { class: 'tbtn', title: 'New Folder', html: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10v6M9 13h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' });
      const bImport = h('button', { class: 'tbtn', title: 'Import from computer', html: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
      const search = h('input', { class: 'field fd-search', placeholder: 'Search', spellcheck: 'false' });
      win.toolbar.append(bBack, bFwd, title, h('div', { style: { flex: 1 } }), bGrid, bList, bNew, bImport, search);
      win.toolbar.style.justifyContent = 'flex-start';
      win.toolbar.style.paddingLeft = '70px';

      const side = h('div', { class: 'fd-side' });
      const main = h('div', { class: 'fd-main' });
      const status = h('div', { class: 'fd-status' });
      win.body.append(h('div', { class: 'fd-wrap' }, side, h('div', { class: 'fd-right' }, main, status)));
      win.el._finderPath = () => (cwd === '/.Trash' || cwd === 'apps') ? '/Desktop' : cwd;

      function renderSide() {
        side.innerHTML = '';
        side.appendChild(h('div', { class: 'fd-sh' }, 'Favorites'));
        PLACES.forEach((p) => side.appendChild(sideItem(p.ic, p.label, p.path)));
        side.appendChild(h('div', { class: 'fd-sh' }, 'PatOS'));
        side.appendChild(sideItem('🚀', 'Applications', 'apps'));
        side.appendChild(sideItem('🗑', 'Trash', '/.Trash'));
        side.appendChild(h('div', { class: 'fd-sh' }, 'Storage'));
        const used = PatOS.store.usage(); const cap = 5 * 1024 * 1024;
        side.appendChild(h('div', { class: 'fd-storage' }, h('div', { class: 'fd-bar' }, h('span', { style: { width: Math.min(100, used / cap * 100) + '%' } })), h('small', {}, PatOS.fmtBytes(used) + ' of ~5 MB used')));
      }
      function sideItem(ic, label, path) {
        const it = h('div', { class: 'fd-si' + (cwd === path ? ' on' : '') }, h('span', {}, ic), label);
        it.addEventListener('click', () => go(path));
        if (path !== 'apps') {
          it.addEventListener('dragover', (e) => { e.preventDefault(); it.classList.add('drop'); });
          it.addEventListener('dragleave', () => it.classList.remove('drop'));
          it.addEventListener('drop', (e) => { e.preventDefault(); it.classList.remove('drop'); dropTo(e, path); });
        }
        return it;
      }
      function dropTo(e, path) {
        const src = e.dataTransfer.getData('text/patos-path'); if (!src) return;
        try { if (path === '/.Trash') { PatOS.fs.remove(src); PatOS.sound.trash(); } else PatOS.fs.move(src, path); } catch (er) { PatOS.notify({ title: 'Cannot move', body: er.message, icon: 'finder' }); }
      }
      function go(path, noHist) {
        if (!noHist && path !== cwd) { back.push(cwd); fwd.length = 0; }
        cwd = path; sel = null; search.value = ''; render();
      }
      bBack.onclick = () => { if (back.length) { fwd.push(cwd); go(back.pop(), true); } };
      bFwd.onclick = () => { if (fwd.length) { back.push(cwd); go(fwd.pop(), true); } };
      bGrid.onclick = () => { view = 'grid'; PatOS.store.set('finderView', view); render(); };
      bList.onclick = () => { view = 'list'; PatOS.store.set('finderView', view); render(); };
      bNew.onclick = () => { if (cwd !== 'apps' && cwd !== '/.Trash') PatOS.newFolder(cwd); };
      bImport.onclick = () => { if (cwd !== 'apps' && cwd !== '/.Trash') PatOS.importFiles(cwd); };
      search.addEventListener('input', () => render());

      function items() {
        const q = search.value.trim().toLowerCase();
        if (cwd === 'apps') {
          return PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden).map((id) => ({ name: PatOS.apps[id].name, app: id })).filter((x) => !q || x.name.toLowerCase().includes(q));
        }
        if (q) { const res = []; PatOS.fs.walk(cwd === '/.Trash' ? '/' : cwd, (p, n) => { if (PatOS.fs.basename(p).toLowerCase().includes(q)) res.push({ name: PatOS.fs.basename(p), path: p, ...n }); }); return res; }
        if (cwd === '/.Trash') return PatOS.fs.trashList();
        return PatOS.fs.list(cwd);
      }
      function render() {
        renderSide();
        const label = cwd === 'apps' ? 'Applications' : cwd === '/.Trash' ? 'Trash' : cwd === '/' ? 'Home' : PatOS.fs.basename(cwd);
        title.textContent = label; win.setTitle(label);
        bBack.disabled = !back.length; bFwd.disabled = !fwd.length;
        bGrid.classList.toggle('on', view === 'grid'); bList.classList.toggle('on', view === 'list');
        main.innerHTML = ''; main.className = 'fd-main ' + view;
        const list = items();
        if (cwd === '/.Trash' && list.length) main.appendChild(h('div', { class: 'fd-trashbar' }, 'Items in the Trash', h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox('Empty the Trash?', 'The items will be erased for good.', { ok: 'Empty Trash', danger: true, icon: 'finder' })) { PatOS.fs.emptyTrash(); PatOS.sound.trash(); } } }, 'Empty')));
        if (view === 'list') main.appendChild(h('div', { class: 'fd-lh' }, h('span', {}, 'Name'), h('span', {}, 'Date Modified'), h('span', {}, 'Size'), h('span', {}, 'Kind')));
        list.forEach((it) => main.appendChild(item(it)));
        if (!list.length) main.appendChild(h('div', { class: 'fd-empty' }, search.value ? 'No results' : cwd === '/.Trash' ? 'Trash is empty' : 'This folder is empty'));
        status.textContent = list.length + ' item' + (list.length === 1 ? '' : 's') + (cwd !== 'apps' ? ' · ' + PatOS.fmtBytes(PatOS.store.usage()) + ' used' : '');
      }
      function item(it) {
        const isApp = !!it.app;
        const iconHTML = isApp ? PatOS.iconHTML(PatOS.apps[it.app].icon || it.app) : PatOS.fileIconHTML(it.name, it);
        const kind = isApp ? 'Application' : it.type === 'dir' ? 'Folder' : PatOS.fileKind(it.name, it).replace(/^./, (c) => c.toUpperCase());
        const el = view === 'grid'
          ? h('div', { class: 'fd-item' }, h('div', { class: 'fd-ic', html: iconHTML }), h('div', { class: 'fd-nm' }, it.name))
          : h('div', { class: 'fd-row' }, h('span', { class: 'fd-rn' }, h('span', { class: 'fd-ric', html: iconHTML }), it.name), h('span', {}, it.mtime ? new Date(it.mtime).toLocaleString() : '—'), h('span', {}, isApp || it.type === 'dir' ? '—' : PatOS.fmtBytes(PatOS.fs.size(it))), h('span', {}, kind));
        el.addEventListener('click', (e) => { e.stopPropagation(); $$('.sel', main).forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); sel = it; });
        el.addEventListener('dblclick', () => {
          if (isApp) return PatOS.launch(it.app);
          if (cwd === '/.Trash') return;
          if (it.type === 'dir') go(it.path); else PatOS.openFile(it.path);
        });
        if (!isApp) {
          el.draggable = true;
          el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/patos-path', it.path); });
          if (it.type === 'dir') {
            el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); });
            el.addEventListener('dragleave', () => el.classList.remove('drop'));
            el.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('drop'); dropTo(e, it.path); });
          }
        }
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault(); e.stopPropagation(); el.click();
          if (isApp) return PatOS.menu([{ label: 'Open', action: () => PatOS.launch(it.app) }, { label: PatOS.settings.dockPinned.includes(it.app) ? 'Remove from Dock' : 'Add to Dock', action: () => { const l = PatOS.settings.dockPinned.slice(); const i = l.indexOf(it.app); if (i >= 0) l.splice(i, 1); else l.push(it.app); PatOS.setSetting('dockPinned', l); } }], e.clientX, e.clientY);
          if (cwd === '/.Trash') return PatOS.menu([{ label: 'Put Back', action: () => PatOS.fs.restore(it.name) }, { label: 'Delete Immediately', action: () => PatOS.fs.remove(it.path, true) }], e.clientX, e.clientY);
          PatOS.fileMenu(it.path, e.clientX, e.clientY);
        });
        return el;
      }
      main.addEventListener('click', () => { $$('.sel', main).forEach((x) => x.classList.remove('sel')); sel = null; });
      main.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.fd-item, .fd-row') || cwd === 'apps') return;
        e.preventDefault();
        if (cwd === '/.Trash') return PatOS.menu([{ label: 'Empty Trash', action: () => PatOS.fs.emptyTrash() }], e.clientX, e.clientY);
        PatOS.menu([
          { label: 'New Folder', action: () => PatOS.newFolder(cwd) },
          { label: 'New Text File', action: () => { const nm = PatOS.fs.uniqueName(cwd, 'untitled.txt'); PatOS.fs.write(cwd + '/' + nm, ''); PatOS.launch('textedit', { path: cwd + '/' + nm }); } },
          { label: 'Import from Computer…', action: () => PatOS.importFiles(cwd) },
          { divider: true },
          { label: view === 'grid' ? 'View as List' : 'View as Icons', action: () => { view = view === 'grid' ? 'list' : 'grid'; render(); } }
        ], e.clientX, e.clientY);
      });
      win.body.addEventListener('keydown', (e) => {
        if (!sel || sel.app) return;
        if (e.key === 'Delete' || (e.key === 'Backspace' && e.ctrlKey)) { PatOS.fs.remove(sel.path); PatOS.sound.trash(); }
        if (e.key === 'Enter') PatOS.renameInline(sel.path);
      });
      win.body.tabIndex = 0;
      const off = PatOS.on('fs', () => render());
      win.on('closed', off);
      win._go = go;
      render();
    },
    onArgs(win, args) { if (args.path && win._go) win._go(args.path); }
  });
})();
