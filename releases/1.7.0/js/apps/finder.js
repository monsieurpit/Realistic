/* Finder — file manager: icons/list views, sorting, path bar, multi-select (click, Shift, Ctrl, or drag a box),
   copy/cut/paste, drag and drop (also files dragged in from the computer), tags, Quick Look, info panel */
(function () {
  'use strict';
  const { h, $$ } = PatOS;
  const PLACES = [
    { label: 'Desktop', path: '/Desktop', ic: 'desktop' }, { label: 'Documents', path: '/Documents', ic: 'doc' }, { label: 'Downloads', path: '/Downloads', ic: 'download' },
    { label: 'Pictures', path: '/Pictures', ic: 'image' }, { label: 'Music', path: '/Music', ic: 'music' }, { label: 'Videos', path: '/Videos', ic: 'play' }, { label: 'Home', path: '/', ic: 'home' }
  ];
  const TAGS = { red: '#ff453a', orange: '#ff9f0a', yellow: '#ffd60a', green: '#32d74b', blue: '#0a84ff', purple: '#bf5af2', gray: '#8e8e93' };
  const TAG_NAMES = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple', gray: 'Gray' };
  const tagsOf = () => PatOS.store.get('fileTags', {});
  const kindLabel = (it) => it.app ? 'Application' : it.type === 'dir' ? 'Folder' : ({ image: 'Image', audio: 'Audio', video: 'Video', pdf: 'PDF document', html: 'Web page', link: 'Web link' }[PatOS.fileKind(it.name, it)] || ({ pdoc: 'Document', docx: 'Word document', psheet: 'Spreadsheet', xlsx: 'Excel spreadsheet', csv: 'Spreadsheet', pslides: 'Presentation', pptx: 'PowerPoint presentation', pform: 'Form', zip: 'Zip archive' }[PatOS.fs.ext(it.name)]) || 'Text document');

  /* ---------- Quick Look: press Space on a file to preview it ---------- */
  PatOS.quickLook = function (path, list) {
    const old = document.querySelector('.ql-layer'); if (old) old.remove();
    let idx = list ? Math.max(0, list.indexOf(path)) : 0;
    const layer = h('div', { class: 'ql-layer' });
    const close = () => { layer.classList.add('out'); document.removeEventListener('keydown', onKey, true); setTimeout(() => layer.remove(), 180); };
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (list && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) { e.preventDefault(); e.stopPropagation(); idx = (idx + 1) % list.length; draw(); }
      else if (list && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { e.preventDefault(); e.stopPropagation(); idx = (idx - 1 + list.length) % list.length; draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); PatOS.openFile(list ? list[idx] : path); }
    };
    function draw() {
      const p = list ? list[idx] : path; const n = PatOS.fs.get(p); if (!n) return close();
      const name = PatOS.fs.basename(p), kind = PatOS.fileKind(p, n), ext = PatOS.fs.ext(p);
      const body = h('div', { class: 'ql-body' });
      if (kind === 'image') body.appendChild(h('img', { src: n.content, alt: name }));
      else if (kind === 'audio') body.appendChild(h('div', { class: 'ql-audio' }, h('div', { class: 'ql-icon', html: PatOS.fileIconHTML(name, n) }), h('audio', { src: n.content, controls: true, autoplay: true })));
      else if (kind === 'video') { const v = h('video', { controls: true, autoplay: true, class: 'ql-video', style: { maxWidth: '100%', maxHeight: '70vh', borderRadius: '10px', background: '#000' } }); PatOS.fs.blobURL(p).then((u) => { if (u) v.src = u; }); body.appendChild(v); }
      else if (n.blob) body.appendChild(h('div', { class: 'ql-folder' }, h('div', { class: 'ql-icon', html: PatOS.fileIconHTML(name, n) }), h('b', {}, name), h('small', {}, PatOS.fmtBytes(PatOS.fs.size(n)))));
      else if (kind === 'pdf' || ext === 'pdf') { try { const bin = atob(String(n.content).split(',')[1]); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); body.appendChild(h('iframe', { class: 'ql-pdf', src: URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })) })); } catch (e) {} }
      else if (n.type === 'dir') body.appendChild(h('div', { class: 'ql-folder' }, h('div', { class: 'ql-icon', html: PatOS.iconHTML('folder') }), h('b', {}, name), h('small', {}, PatOS.fs.list(p).length + ' ' + PatOS.t('items'))));
      else if (ext === 'pdoc') body.appendChild(h('div', { class: 'ql-doc', html: PatOS.sanitize(String(n.content)) }));
      else if (ext === 'psheet') { try { const cells = JSON.parse(n.content).cells || {}; const t = h('table', { class: 'ql-sheet' }); for (let r = 1; r <= 14; r++) { const tr = h('tr'); for (let c = 0; c < 6; c++) { const v = cells[String.fromCharCode(65 + c) + r]; tr.appendChild(h('td', {}, v ? String(v.v).slice(0, 18) : '')); } t.appendChild(tr); } body.appendChild(t); } catch (e) {} }
      else if (['pslides', 'pform'].includes(ext) || String(n.content).startsWith('data:')) body.appendChild(h('div', { class: 'ql-folder' }, h('div', { class: 'ql-icon', html: PatOS.fileIconHTML(name, n) }), h('b', {}, name), h('small', {}, PatOS.t(kindLabel({ name, ...n })))));
      else body.appendChild(h('pre', { class: 'ql-text' }, String(n.content).slice(0, 20000)));
      layer.innerHTML = '';
      const card = h('div', { class: 'ql-card' },
        h('div', { class: 'ql-bar' }, h('button', { class: 'ql-x', title: 'Close', onclick: close }, '×'), h('b', {}, name), h('span', { class: 'ql-meta' }, PatOS.fmtBytes(PatOS.fs.size(n))), h('div', { style: { flex: 1 } }),
          list && list.length > 1 ? h('span', { class: 'ql-meta' }, (idx + 1) + ' / ' + list.length) : null,
          h('button', { class: 'btn', onclick: () => { close(); PatOS.openFile(p); } }, 'Open')),
        body);
      layer.appendChild(card);
    }
    layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); });
    document.body.appendChild(layer); document.addEventListener('keydown', onKey, true); draw();
  };

  PatOS.registerApp({
    id: 'finder', name: 'Finder', icon: 'finder', single: false, width: 900, height: 560, keywords: 'files folders explorer',
    about: 'Browse and organize everything stored in PatOS.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let cwd = args.path || '/Desktop';
      let view = PatOS.store.get('finderView', 'grid');
      let sort = PatOS.store.get('finderSort', { by: 'name', dir: 1 });
      let showInfo = PatOS.store.get('finderInfo', false);
      let tagFilter = null;
      const back = [], fwd = [];
      let selected = new Set(), anchor = null, list = [];
      const S = (n) => PatOS.sym(n);

      const bBack = h('button', { class: 'tbtn', html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>', title: 'Back' });
      const bFwd = h('button', { class: 'tbtn', html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>', title: 'Forward' });
      const title = h('div', { class: 'fd-title' });
      const bGrid = h('button', { class: 'tbtn', title: 'Icons', html: S('apps') });
      const bList = h('button', { class: 'tbtn', title: 'List', html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>' });
      const bSort = h('button', { class: 'tbtn', title: 'Sort by', html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h11M4 12h8M4 17h5M18 5v14M15 16l3 3 3-3"/></svg>' });
      const bNew = h('button', { class: 'tbtn', title: 'New Folder', html: S('folder') });
      const bImport = h('button', { class: 'tbtn', title: 'Import from computer', html: S('download') });
      const bInfo = h('button', { class: 'tbtn', title: 'Show info', html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>' });
      const search = h('input', { class: 'field fd-search', placeholder: 'Search', spellcheck: 'false' });
      win.toolbar.append(bBack, bFwd, title, h('div', { style: { flex: 1 } }), bGrid, bList, bSort, bNew, bImport, bInfo, search);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '70px';

      const side = h('div', { class: 'fd-side' });
      const main = h('div', { class: 'fd-main', tabindex: '0' });
      const pathbar = h('div', { class: 'fd-path' });
      const status = h('div', { class: 'fd-status' });
      const info = h('div', { class: 'fd-info' });
      win.body.append(h('div', { class: 'fd-wrap' }, side, h('div', { class: 'fd-right' }, main, pathbar, status), info));
      win.el._finderPath = () => (cwd === '/.Trash' || cwd === 'apps' || cwd === 'tag') ? '/Desktop' : cwd;

      function renderSide() {
        side.innerHTML = '';
        const sec = (t) => side.appendChild(h('div', { class: 'fd-sh' }, t));
        sec('Favorites'); PLACES.forEach((p) => side.appendChild(sideItem(p.ic, p.label, p.path)));
        sec('PatOS'); side.appendChild(sideItem('apps', 'Applications', 'apps')); side.appendChild(sideItem('trash', 'Trash', '/.Trash'));
        sec('Tags');
        Object.keys(TAGS).forEach((k) => { const it = h('div', { class: 'fd-si' + (cwd === 'tag' && tagFilter === k ? ' on' : '') }, h('span', { class: 'fd-tagdot', style: { background: TAGS[k] } }), TAG_NAMES[k]); it.onclick = () => { tagFilter = k; go('tag'); }; side.appendChild(it); });
        sec(PatOS.t('This Chromebook'));
        const ob = h('div', { class: 'fd-si' }, h('span', { class: 'symw', html: S('download') }), PatOS.t('Open Files…')); ob.onclick = () => { if (canWrite()) PatOS.device.openFiles(cwd === '/.Trash' || cwd === 'apps' || cwd === 'tag' ? '/Documents' : cwd); };
        const lb = h('div', { class: 'fd-si' }, h('span', { class: 'symw', html: S('folder') }), PatOS.t('Link a Folder…')); lb.onclick = () => PatOS.device.linkFolder(cwd === '/.Trash' || cwd === 'apps' || cwd === 'tag' ? '/Documents' : cwd);
        side.append(ob, lb);
        sec('Storage');
        const bar = h('div', { class: 'fd-storage' }, h('div', { class: 'fd-bar' }, h('span', { style: { width: '2%' } })), h('small', {}, PatOS.t('Checking…')));
        side.appendChild(bar);
        PatOS.storageInfo().then((i) => { bar.querySelector('span').style.width = Math.max(2, Math.min(100, i.used / i.quota * 100)) + '%'; bar.querySelector('small').textContent = PatOS.fmtBytes(i.used) + ' ' + PatOS.t('used') + ' · ' + PatOS.fmtBytes(i.quota) + ' ' + PatOS.t('available'); });
      }
      function sideItem(ic, label, path) {
        const it = h('div', { class: 'fd-si' + (cwd === path ? ' on' : '') }, h('span', { class: 'symw', html: S(ic) }), label);
        it.addEventListener('click', () => go(path));
        if (path !== 'apps') {
          it.addEventListener('dragover', (e) => { e.preventDefault(); it.classList.add('drop'); });
          it.addEventListener('dragleave', () => it.classList.remove('drop'));
          it.addEventListener('drop', (e) => { e.preventDefault(); it.classList.remove('drop'); dropTo(e, path); });
        }
        return it;
      }
      function dropTo(e, path) {
        const raw = e.dataTransfer.getData('text/patos-paths') || e.dataTransfer.getData('text/patos-path'); if (!raw) return;
        const paths = raw.startsWith('[') ? JSON.parse(raw) : [raw];
        paths.forEach((src) => { try { if (path === '/.Trash') { PatOS.fs.remove(src); } else if (PatOS.fs.dirname(src) !== path) PatOS.fs.move(src, path); } catch (er) { PatOS.notify({ title: PatOS.t('Cannot move'), body: er.message, icon: 'finder' }); } });
        if (path === '/.Trash') PatOS.sound.trash();
      }
      function go(path, noHist) { if (!noHist && path !== cwd) { back.push(cwd); fwd.length = 0; } cwd = path; PatOS.remember && PatOS.remember(win, { path }); selected.clear(); anchor = null; search.value = ''; render(); }
      bBack.onclick = () => { if (back.length) { fwd.push(cwd); go(back.pop(), true); } };
      bFwd.onclick = () => { if (fwd.length) { back.push(cwd); go(fwd.pop(), true); } };
      bGrid.onclick = () => { view = 'grid'; PatOS.store.set('finderView', view); render(); };
      bList.onclick = () => { view = 'list'; PatOS.store.set('finderView', view); render(); };
      bNew.onclick = () => newFolderHere();
      function newFolderHere() { if (!canWrite()) return; const nm = PatOS.newFolder(cwd); const p = (cwd === '/' ? '' : cwd) + '/' + nm; setTimeout(() => { select([p]); anchor = p; PatOS.renameInline(p, (np) => setTimeout(() => select([np]), 80)); }, 60); }
      /* copy, cut and paste files */
      const here = () => (cwd === '/' ? '/' : cwd);
      function copySel(cut) { const sel = [...selected].filter((p) => !p.startsWith('app:')); if (!sel.length || cwd === '/.Trash') return; const n = PatOS.fileClip.set(sel, cut); OFtoast((n === 1 ? '“' + PatOS.fs.basename(sel[0]) + '”' : n + ' ' + PatOS.t('items')) + ' ' + PatOS.t(cut ? 'cut' : 'copied')); render(); }
      function pasteHere() { if (!canWrite() || !PatOS.fileClip.has()) return; const out = PatOS.fileClip.paste(here()); if (out.length) setTimeout(() => select(out), 80); }
      function OFtoast(t) { if (PatOS.office && PatOS.office.toast) PatOS.office.toast(win, t); }
      bImport.onclick = () => { if (!canWrite()) return; const r = bImport.getBoundingClientRect(); PatOS.menu([{ label: PatOS.t('Open Files from This Chromebook…'), action: () => PatOS.device.openFiles(cwd) }, { label: PatOS.t('Link a Folder from This Chromebook…'), action: () => PatOS.device.linkFolder(cwd) }, { divider: true }, { label: PatOS.t('Import Copies…'), action: () => PatOS.importFiles(cwd) }], r.left, r.bottom + 4); };
      bInfo.onclick = () => { showInfo = !showInfo; PatOS.store.set('finderInfo', showInfo); render(); };
      bSort.onclick = () => { const r = bSort.getBoundingClientRect(); const opt = (by, label) => ({ label: PatOS.t(label), checked: sort.by === by, action: () => { sort = { by, dir: sort.by === by ? -sort.dir : 1 }; PatOS.store.set('finderSort', sort); render(); } }); PatOS.menu([{ header: PatOS.t('Sort by') }, opt('name', 'Name'), opt('date', 'Date Modified'), opt('size', 'Size'), opt('kind', 'Kind'), { divider: true }, { label: PatOS.t(sort.dir > 0 ? 'Ascending' : 'Descending'), action: () => { sort.dir = -sort.dir; PatOS.store.set('finderSort', sort); render(); } }], r.left - 120, r.bottom + 4); };
      search.addEventListener('input', () => render());
      const canWrite = () => !['apps', '/.Trash', 'tag'].includes(cwd);

      function items() {
        const q = search.value.trim().toLowerCase();
        let out;
        if (cwd === 'apps') out = PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden).map((id) => ({ name: PatOS.t(PatOS.apps[id].name), app: id, path: 'app:' + id }));
        else if (cwd === 'tag') { const tags = tagsOf(); out = Object.keys(tags).filter((p) => tags[p] === tagFilter && PatOS.fs.exists(p)).map((p) => ({ name: PatOS.fs.basename(p), path: p, ...PatOS.fs.get(p) })); }
        else if (q) { out = []; PatOS.fs.walk(cwd === '/.Trash' ? '/' : cwd, (p, n) => { if (PatOS.fs.basename(p).toLowerCase().includes(q)) out.push({ name: PatOS.fs.basename(p), path: p, ...n }); }); }
        else if (cwd === '/.Trash') out = PatOS.fs.trashList();
        else out = PatOS.fs.list(cwd);
        if (q && cwd === 'apps') out = out.filter((x) => x.name.toLowerCase().includes(q));
        const key = { name: (x) => x.name.toLowerCase(), date: (x) => x.mtime || 0, size: (x) => (x.app ? 0 : PatOS.fs.size(x)), kind: (x) => kindLabel(x) }[sort.by];
        return out.sort((a, b) => { if (!a.app && (a.type === 'dir') !== (b.type === 'dir')) return a.type === 'dir' ? -1 : 1; const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.name.localeCompare(b.name); });
      }
      function render() {
        renderSide();
        const label = cwd === 'apps' ? 'Applications' : cwd === '/.Trash' ? 'Trash' : cwd === 'tag' ? TAG_NAMES[tagFilter] : cwd === '/' ? 'Home' : PatOS.fs.basename(cwd);
        title.textContent = PatOS.t(label); win.setTitle(PatOS.t(label));
        bBack.disabled = !back.length; bFwd.disabled = !fwd.length;
        bGrid.classList.toggle('on', view === 'grid'); bList.classList.toggle('on', view === 'list'); bInfo.classList.toggle('on', showInfo);
        main.innerHTML = ''; main.className = 'fd-main ' + view;
        list = items();
        if (cwd === '/.Trash' && list.length) main.appendChild(h('div', { class: 'fd-trashbar' }, 'Items in the Trash', h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox('Empty the Trash?', 'The items will be erased for good.', { ok: 'Empty Trash', danger: true, icon: 'finder' })) { PatOS.fs.emptyTrash(); PatOS.sound.trash(); } } }, 'Empty')));
        if (view === 'list') {
          const hd = (by, l) => h('span', { class: 'fd-lhc' + (sort.by === by ? ' on' : ''), onclick: () => { sort = { by, dir: sort.by === by ? -sort.dir : 1 }; PatOS.store.set('finderSort', sort); render(); } }, l, sort.by === by ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');
          main.appendChild(h('div', { class: 'fd-lh' }, hd('name', 'Name'), hd('date', 'Date Modified'), hd('size', 'Size'), hd('kind', 'Kind')));
        }
        list.forEach((it, i) => main.appendChild(item(it, i)));
        if (!list.length) main.appendChild(h('div', { class: 'fd-empty' }, h('b', {}, PatOS.t(search.value ? 'No results' : cwd === '/.Trash' ? 'Trash is empty' : cwd === 'tag' ? 'No files with this tag' : 'This folder is empty')),
          canWrite() && !search.value ? h('small', {}, PatOS.t(PatOS.isMobile ? 'Press Import to add files from your phone.' : 'Drag files here from your computer, or press Import.')) : null));
        // path bar
        pathbar.innerHTML = '';
        if (!['apps', '/.Trash', 'tag'].includes(cwd)) {
          const parts = cwd === '/' ? [] : cwd.slice(1).split('/');
          const crumb = (lbl, p) => { const c = h('button', { class: 'fd-crumb' }, h('span', { class: 'symw', html: S(p === '/' ? 'home' : 'folder') }), PatOS.t(lbl)); c.onclick = () => go(p); c.addEventListener('dragover', (e) => e.preventDefault()); c.addEventListener('drop', (e) => { e.preventDefault(); dropTo(e, p); }); return c; };
          pathbar.appendChild(crumb(PatOS.settings.userName, '/'));
          parts.forEach((pt, k) => { pathbar.appendChild(h('span', { class: 'fd-sep' }, '›')); pathbar.appendChild(crumb(pt, '/' + parts.slice(0, k + 1).join('/'))); });
        }
        updateStatus(); renderInfo();
      }
      function updateStatus() {
        const n = selected.size;
        const selSize = n ? [...selected].reduce((t, p) => { const x = !p.startsWith('app:') && PatOS.fs.get(p); return t + (x && x.type === 'file' ? PatOS.fs.size(x) : 0); }, 0) : 0;
        status.textContent = (n ? n + ' ' + PatOS.t('of') + ' ' : '') + list.length + ' ' + PatOS.t(list.length === 1 ? 'item' : 'items') + (selSize ? ' · ' + PatOS.fmtBytes(selSize) : '') + (cwd !== 'apps' && freeSpace != null ? ' · ' + PatOS.fmtBytes(freeSpace) + ' ' + PatOS.t('available') : '');
      }
      let freeSpace = null;
      PatOS.storageInfo().then((i) => { freeSpace = Math.max(0, i.quota - i.used); updateStatus(); }).catch(() => {});
      function select(paths, keep) {
        if (!keep) selected.clear(); paths.forEach((p) => selected.add(p));
        $$('.fd-item, .fd-row', main).forEach((el) => el.classList.toggle('sel', selected.has(el.dataset.path)));
        updateStatus(); renderInfo();
      }
      function renderInfo() {
        info.classList.toggle('hidden', !showInfo); if (!showInfo) return;
        info.innerHTML = '';
        const p = [...selected].pop(); const it = p && list.find((x) => x.path === p);
        if (!it) { info.appendChild(h('div', { class: 'fd-info-empty' }, PatOS.t('Select something to see its details.'))); return; }
        const isApp = !!it.app; const n = isApp ? null : PatOS.fs.get(it.path);
        info.append(h('div', { class: 'fd-info-ic', html: isApp ? PatOS.iconHTML(PatOS.apps[it.app].icon || it.app) : PatOS.fileIconHTML(it.name, n) }), h('b', { class: 'fd-info-nm' }, it.name), h('small', {}, PatOS.t(kindLabel(it)) + (isApp ? '' : ' · ' + PatOS.fmtBytes(PatOS.fs.size(n)))));
        if (!isApp) {
          const row = (k, v) => h('div', { class: 'fd-info-row' }, h('span', {}, PatOS.t(k)), h('b', {}, v));
          info.append(h('div', { class: 'fd-info-rows' }, row('Where', PatOS.fs.dirname(it.path) === '/' ? '~' : PatOS.fs.dirname(it.path)), row('Modified', new Date(n.mtime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })), n.type === 'dir' ? row('Contains', PatOS.fs.list(it.path).length + ' ' + PatOS.t('items')) : null));
          const tg = tagsOf()[it.path];
          info.appendChild(h('div', { class: 'fd-info-tags' }, ...Object.keys(TAGS).map((k) => h('button', { class: 'fd-tagdot big' + (tg === k ? ' on' : ''), title: PatOS.t(TAG_NAMES[k]), style: { background: TAGS[k] }, onclick: () => setTag([it.path], tg === k ? null : k) }))));
          info.appendChild(h('div', { class: 'fd-info-btns' }, h('button', { class: 'btn', onclick: () => PatOS.quickLook(it.path, list.filter((x) => !x.app).map((x) => x.path)) }, 'Quick Look'), h('button', { class: 'btn', onclick: () => PatOS.openFile(it.path) }, 'Open')));
        }
      }
      function setTag(paths, k) { const t = tagsOf(); paths.forEach((p) => { if (k) t[p] = k; else delete t[p]; }); PatOS.store.set('fileTags', t); render(); }
      function item(it, i) {
        const isApp = !!it.app;
        const iconHTML = isApp ? PatOS.iconHTML(PatOS.apps[it.app].icon || it.app) : PatOS.fileIconHTML(it.name, it);
        const tg = !isApp && tagsOf()[it.path];
        // search results come from inside other folders: say where
        const where = !isApp && search.value.trim() && PatOS.fs.dirname(it.path) !== cwd ? (PatOS.fs.dirname(it.path) === '/' ? '~' : PatOS.fs.basename(PatOS.fs.dirname(it.path))) : '';
        const dot = tg ? h('span', { class: 'fd-tagdot', style: { background: TAGS[tg] } }) : null;
        const el = view === 'grid'
          ? h('div', { class: 'fd-item', 'data-path': it.path, title: where ? PatOS.t('In') + ' ' + where : null }, h('div', { class: 'fd-ic', html: iconHTML }), h('div', { class: 'fd-nm' }, dot, it.name), where ? h('small', { class: 'fd-where' }, where) : null)
          : h('div', { class: 'fd-row', 'data-path': it.path }, h('span', { class: 'fd-rn' }, h('span', { class: 'fd-ric', html: iconHTML }), it.name, dot), h('span', {}, it.mtime ? new Date(it.mtime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'), h('span', {}, isApp || it.type === 'dir' ? '—' : PatOS.fmtBytes(PatOS.fs.size(it))), h('span', {}, PatOS.t(kindLabel(it))));
        if (selected.has(it.path)) el.classList.add('sel');
        if (PatOS.fileClip.cut && PatOS.fileClip.paths.includes(it.path)) el.classList.add('cut');
        el.addEventListener('click', (e) => {
          e.stopPropagation(); main.focus({ preventScroll: true });
          if (e.shiftKey && anchor) { const a = list.findIndex((x) => x.path === anchor), b = i; select(list.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.path)); }
          else if (e.ctrlKey || e.metaKey) { if (selected.has(it.path)) { selected.delete(it.path); select([], true); } else select([it.path], true); anchor = it.path; }
          else { select([it.path]); anchor = it.path; }
        });
        el.addEventListener('dblclick', () => openItem(it));
        if (!isApp) {
          el.draggable = true;
          el.addEventListener('dragstart', (e) => { const paths = selected.has(it.path) ? [...selected] : [it.path]; e.dataTransfer.setData('text/patos-paths', JSON.stringify(paths)); e.dataTransfer.setData('text/patos-path', it.path); });
          if (it.type === 'dir') {
            el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); });
            el.addEventListener('dragleave', () => el.classList.remove('drop'));
            el.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('drop'); dropTo(e, it.path); });
          }
        }
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault(); e.stopPropagation(); if (!selected.has(it.path)) { select([it.path]); anchor = it.path; }
          if (isApp) return PatOS.menu([{ label: PatOS.t('Open'), action: () => PatOS.launch(it.app) }, { label: PatOS.t(PatOS.settings.dockPinned.includes(it.app) ? 'Remove from Dock' : 'Add to Dock'), action: () => { const l = PatOS.settings.dockPinned.slice(); const k = l.indexOf(it.app); if (k >= 0) l.splice(k, 1); else l.push(it.app); PatOS.setSetting('dockPinned', l); } }], e.clientX, e.clientY);
          if (cwd === '/.Trash') return PatOS.menu([{ label: PatOS.t('Put Back'), action: () => [...selected].forEach((p) => PatOS.fs.restore(PatOS.fs.basename(p))) }, { label: PatOS.t('Delete Immediately'), action: () => [...selected].forEach((p) => PatOS.fs.remove(p, true)) }], e.clientX, e.clientY);
          const sel = [...selected];
          PatOS.menu([
            { label: PatOS.t('Open'), action: () => sel.forEach((p) => PatOS.openFile(p)) },
            { label: PatOS.t('Quick Look'), shortcut: 'Space', action: () => PatOS.quickLook(it.path, list.filter((x) => !x.app).map((x) => x.path)) },
            { divider: true },
            { label: PatOS.t('Copy'), shortcut: 'Ctrl+C', action: () => copySel(false) },
            { label: PatOS.t('Cut'), shortcut: 'Ctrl+X', action: () => copySel(true) },
            it.type === 'dir' && sel.length === 1 && PatOS.fileClip.has() ? { label: PatOS.t('Paste Into Folder'), action: () => { const out = PatOS.fileClip.paste(it.path); if (out.length) OFtoast(out.length + ' ' + PatOS.t(out.length === 1 ? 'item' : 'items') + ' → ' + it.name); } } : null,
            { divider: true },
            sel.length === 1 ? { label: PatOS.t('Rename…'), shortcut: 'Enter', action: () => PatOS.renameInline(it.path) } : null,
            { label: PatOS.t('Duplicate'), action: () => sel.forEach((p) => PatOS.fs.copy(p, PatOS.fs.dirname(p))) },
            { label: PatOS.t('Compress'), action: () => PatOS.compress(sel) },
            it.type === 'file' && /\.zip$/i.test(it.name) ? { label: PatOS.t('Extract Here'), action: () => PatOS.openZip(it.path) } : null,
            it.type === 'file' && sel.length === 1 ? { label: PatOS.t('Save to This Chromebook…'), action: () => PatOS.device.saveCopy(it.path) } : null,
            it.type === 'dir' && sel.length === 1 && PatOS.device.supported ? { label: PatOS.t('Save Folder to This Chromebook…'), action: () => PatOS.device.exportFolder(it.path) } : null,
            it.type === 'dir' && PatOS.device.isLinked(it.path) ? { label: PatOS.t('Refresh from This Chromebook'), action: () => PatOS.device.refresh(it.path) } : null,
            { divider: true },
            { header: PatOS.t('Tags') },
            ...Object.keys(TAGS).map((k) => ({ label: PatOS.t(TAG_NAMES[k]), checked: sel.every((p) => tagsOf()[p] === k), action: () => setTag(sel, sel.every((p) => tagsOf()[p] === k) ? null : k) })),
            { divider: true },
            { label: PatOS.t('Move to Trash'), shortcut: 'Delete', action: () => { sel.forEach((p) => PatOS.fs.remove(p)); PatOS.sound.trash(); } }
          ], e.clientX, e.clientY);
        });
        return el;
      }
      function openItem(it) {
        if (it.app) return PatOS.launch(it.app);
        if (cwd === '/.Trash') return;
        if (it.type === 'dir') go(it.path); else PatOS.openFile(it.path);
      }
      main.addEventListener('click', (e) => { if (banded) { banded = false; return; } if (e.target.closest('.fd-item, .fd-row, button')) return; select([]); anchor = null; });
      // drag a box on the empty space to select several files
      let banded = false;
      main.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.pointerType === 'touch' || e.target.closest('.fd-item, .fd-row, button, .fd-lh')) return;
        const r0 = main.getBoundingClientRect(), sx = e.clientX - r0.left + main.scrollLeft, sy = e.clientY - r0.top + main.scrollTop;
        const keep = e.ctrlKey || e.metaKey || e.shiftKey ? new Set(selected) : new Set();
        let band = null;
        const mv = (ev) => {
          const x2 = ev.clientX - r0.left + main.scrollLeft, y2 = ev.clientY - r0.top + main.scrollTop;
          if (!band) { if (Math.abs(x2 - sx) + Math.abs(y2 - sy) < 5) return; band = h('div', { class: 'fd-band' }); main.appendChild(band); }
          const x = Math.min(sx, x2), y = Math.min(sy, y2), w = Math.abs(x2 - sx), hh = Math.abs(y2 - sy);
          Object.assign(band.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
          const hit = new Set(keep);
          $$('.fd-item, .fd-row', main).forEach((el) => { const r = el.getBoundingClientRect(); const ex = r.left - r0.left + main.scrollLeft, ey = r.top - r0.top + main.scrollTop; if (ex < x + w && ex + r.width > x && ey < y + hh && ey + r.height > y) hit.add(el.dataset.path); });
          select([...hit]);
        };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (band) { band.remove(); banded = true; setTimeout(() => { banded = false; }, 0); } };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
      // drop files from the computer, or PatOS files, onto the folder
      main.addEventListener('dragover', (e) => { if (!canWrite()) return; e.preventDefault(); main.classList.add('drop-in'); });
      main.addEventListener('dragleave', (e) => { if (!main.contains(e.relatedTarget)) main.classList.remove('drop-in'); });
      main.addEventListener('drop', async (e) => {
        main.classList.remove('drop-in'); if (!canWrite()) return; e.preventDefault();
        const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
        if (files.length) { const out = await PatOS.importFileList(here(), files); if (out.length) { OFtoast(out.length + ' ' + PatOS.t(out.length === 1 ? 'file added' : 'files added')); setTimeout(() => select(out.map((x) => (typeof x === 'string' ? x : x && x.path)).filter(Boolean)), 100); } return; }
        dropTo(e, here());
      });
      main.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.fd-item, .fd-row') || cwd === 'apps' || cwd === 'tag') return;
        e.preventDefault();
        if (cwd === '/.Trash') return PatOS.menu([{ label: PatOS.t('Empty Trash'), action: () => PatOS.fs.emptyTrash() }], e.clientX, e.clientY);
        PatOS.menu([
          { label: PatOS.t('New Folder'), action: newFolderHere },
          { label: PatOS.t('New Text File'), action: () => { const nm = PatOS.fs.uniqueName(cwd, 'untitled.txt'); PatOS.fs.write(cwd + '/' + nm, ''); PatOS.launch('textedit', { path: cwd + '/' + nm }); } },
          { label: PatOS.t('New Document'), action: () => PatOS.launch('docs') },
          { label: PatOS.t('Open Files from This Chromebook…'), action: () => PatOS.device.openFiles(cwd) },
          { label: PatOS.t('Link a Folder from This Chromebook…'), action: () => PatOS.device.linkFolder(cwd) },
          { divider: true },
          { label: PatOS.t('Paste'), shortcut: 'Ctrl+V', disabled: !PatOS.fileClip.has(), action: pasteHere },
          { label: PatOS.t('Select All'), shortcut: 'Ctrl+A', action: () => select(list.map((x) => x.path)) },
          { divider: true },
          { label: PatOS.t(view === 'grid' ? 'View as List' : 'View as Icons'), action: () => { view = view === 'grid' ? 'list' : 'grid'; PatOS.store.set('finderView', view); render(); } },
          { label: PatOS.t(showInfo ? 'Hide Info' : 'Show Info'), action: () => bInfo.click() }
        ], e.clientX, e.clientY);
      });
      main.addEventListener('keydown', (e) => {
        if (e.target !== main) return;
        const cur = [...selected].pop(); let i = list.findIndex((x) => x.path === cur);
        const cols = view === 'grid' ? Math.max(1, Math.floor(main.clientWidth / 102)) : 1;
        const move = (d) => { e.preventDefault(); if (!list.length) return; i = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + d)); if (e.shiftKey && anchor) { const a = list.findIndex((x) => x.path === anchor); select(list.slice(Math.min(a, i), Math.max(a, i) + 1).map((x) => x.path)); } else { select([list[i].path]); anchor = list[i].path; } const el = main.querySelector(`[data-path="${CSS.escape(list[i].path)}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); };
        if (e.key === 'ArrowRight') move(1); else if (e.key === 'ArrowLeft') move(-1); else if (e.key === 'ArrowDown') move(cols); else if (e.key === 'ArrowUp') move(-cols);
        else if (e.key === ' ' && cur && !cur.startsWith('app:')) { e.preventDefault(); PatOS.quickLook(cur, list.filter((x) => !x.app).map((x) => x.path)); }
        else if (e.key === 'Enter' && cur) { e.preventDefault(); if (e.ctrlKey || cur.startsWith('app:')) openItem(list[i]); else PatOS.renameInline(cur); }
        else if ((e.key === 'o' && e.ctrlKey) || (e.key === 'ArrowDown' && e.ctrlKey)) { if (list[i]) openItem(list[i]); }
        else if ((e.key === 'Delete' || (e.key === 'Backspace' && e.ctrlKey)) && selected.size && canWrite()) { [...selected].forEach((p) => PatOS.fs.remove(p)); PatOS.sound.trash(); }
        else if (e.key === 'a' && e.ctrlKey) { e.preventDefault(); select(list.map((x) => x.path)); }
        else if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey) && selected.size) { e.preventDefault(); copySel(false); }
        else if ((e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey) && selected.size && canWrite()) { e.preventDefault(); copySel(true); }
        else if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); pasteHere(); }
        else if ((e.key === 'd' || e.key === 'D') && e.ctrlKey && selected.size && canWrite()) { e.preventDefault(); const out = [...selected].map((p) => PatOS.fs.copy(p, PatOS.fs.dirname(p))); setTimeout(() => select(out), 80); }
        else if (e.key === 'Escape' && selected.size) { select([]); anchor = null; }
        else if (e.key === 'Backspace' && cwd !== '/' && canWrite()) { e.preventDefault(); go(PatOS.fs.dirname(cwd)); }
      });
      const offClip = PatOS.on('fileclip', () => render()); win.on('closed', () => offClip && offClip());
      const off = PatOS.on('fs', PatOS.debounce(() => { const keep = [...selected].filter((p) => PatOS.fs.exists(p)); selected = new Set(keep); render(); }, 60));
      win.on('closed', off);
      win._go = go;
      win._finder = { newFolder: newFolderHere, copy: copySel, paste: pasteHere, selectAll: () => select(list.map((x) => x.path)), view: () => view, setView: (v) => { view = v; PatOS.store.set('finderView', v); render(); }, info: () => showInfo, toggleInfo: () => bInfo.click() };
      render(); setTimeout(() => main.focus({ preventScroll: true }), 80);
    },
    onArgs(win, args) { if (args.path && win._go) win._go(args.path); },
    menus(win) {
      const F = win._finder || {};
      return {
        file: [
          { label: PatOS.t('New Finder Window'), shortcut: 'Alt+N', action: () => PatOS.launch('finder', { path: win.el._finderPath() }) },
          { label: PatOS.t('New Folder'), action: () => F.newFolder && F.newFolder() },
          { divider: true },
          { label: PatOS.t('Import Copies…'), action: () => PatOS.importFiles(win.el._finderPath()) },
          { label: PatOS.t('Open Files from This Chromebook…'), action: () => PatOS.device.openFiles(win.el._finderPath()) },
          { divider: true },
          { label: PatOS.t('Close Window'), shortcut: 'Alt+W', action: () => win.close() }
        ],
        edit: [
          { label: PatOS.t('Copy'), shortcut: 'Ctrl+C', action: () => F.copy && F.copy(false) },
          { label: PatOS.t('Cut'), shortcut: 'Ctrl+X', action: () => F.copy && F.copy(true) },
          { label: PatOS.t('Paste'), shortcut: 'Ctrl+V', disabled: !PatOS.fileClip.has(), action: () => F.paste && F.paste() },
          { label: PatOS.t('Select All'), shortcut: 'Ctrl+A', action: () => F.selectAll && F.selectAll() }
        ],
        view: [
          { label: PatOS.t('as Icons'), checked: F.view && F.view() === 'grid', action: () => F.setView && F.setView('grid') },
          { label: PatOS.t('as List'), checked: F.view && F.view() === 'list', action: () => F.setView && F.setView('list') },
          { divider: true },
          { label: PatOS.t('Show Info'), checked: !!(F.info && F.info()), action: () => F.toggleInfo && F.toggleInfo() }
        ]
      };
    }
  });
})();
