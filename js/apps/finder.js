/* Piles — file manager: icons/list views, sorting, path bar, multi-select (click, Shift, Ctrl, or drag a box),
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
  const T = (s) => PatOS.t(s);

  /* ---------- piles: files gathered by what they are, or by when they changed ---------- */
  const GROUPS = [
    { k: 'folder', label: 'Folders', ic: 'folder', col: '#4aa8ff' }, { k: 'doc', label: 'Documents', ic: 'doc', col: '#5e5ce6' },
    { k: 'image', label: 'Pictures', ic: 'image', col: '#30d158' }, { k: 'audio', label: 'Music & Audio', ic: 'music', col: '#ff375f' },
    { k: 'video', label: 'Videos', ic: 'play', col: '#ff9f0a' }, { k: 'archive', label: 'Archives', ic: 'storage', col: '#a2845e' },
    { k: 'other', label: 'Other', ic: 'doc', col: '#8e8e93' }
  ];
  const DOC_EXT = new Set(['txt', 'md', 'rtf', 'pdoc', 'docx', 'pdf', 'psheet', 'xlsx', 'csv', 'pslides', 'pptx', 'pform', 'html', 'htm', 'json', 'js', 'css', 'py', 'pit', 'xml', 'log']);
  function groupOf(it) {
    if (it.type === 'dir') return 'folder';
    const kind = PatOS.fileKind(it.name, it), ext = PatOS.fs.ext(it.name);
    if (kind === 'image' || kind === 'audio' || kind === 'video') return kind;
    if (ext === 'zip' || ext === 'patapp') return 'archive';
    if (DOC_EXT.has(ext) || ext === '') return 'doc';
    return 'other';
  }
  const DAY = 86400000;
  const DATES = [{ k: 'today', label: 'Today' }, { k: 'yesterday', label: 'Yesterday' }, { k: 'week', label: 'Earlier This Week' }, { k: 'month', label: 'Earlier This Month' }, { k: 'older', label: 'Older' }];
  function dateOf(t) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const today = d0.getTime();
    if (!t) return 'older'; if (t >= today) return 'today'; if (t >= today - DAY) return 'yesterday'; if (t >= today - 7 * DAY) return 'week'; if (t >= today - 30 * DAY) return 'month'; return 'older';
  }
  // the words inside a file, for search (text files only, not pictures or big files kept as blobs)
  function textOf(n) { return n && n.type === 'file' && !n.blob && typeof n.content === 'string' && !n.content.startsWith('data:') && n.content.length < 2e6 ? n.content : ''; }
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // every file and folder in the home, outside hidden folders (the Trash is one)
  function everything() { const out = []; PatOS.fs.walk('/', (p, n) => out.push(Object.assign({ name: PatOS.fs.basename(p), path: p }, n))); return out; }
  // what was opened or saved most recently: Timeline knows what was opened, the file knows when it was saved
  function recents(max) {
    const opened = {};
    if (PatOS.timeline) PatOS.timeline.events().forEach((e) => { if (e.k === 'file' && e.ref && e.ref.path) opened[e.ref.path] = Math.max(opened[e.ref.path] || 0, e.t); });
    return everything().filter((x) => x.type === 'file').map((x) => Object.assign(x, { seen: Math.max(x.mtime || 0, opened[x.path] || 0) }))
      .sort((a, b) => b.seen - a.seen).slice(0, max || 60);
  }
  const ago = (t) => {
    const s = (Date.now() - t) / 1000; if (s < 60) return T('just now'); if (s < 3600) return Math.floor(s / 60) + ' min';
    if (s < 86400) return new Date(t).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' });
    return new Date(t).toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' });
  };
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
    id: 'finder', name: 'Piles', icon: 'finder', single: false, width: 900, height: 560, keywords: 'files folders explorer finder fichiers dossiers',
    about: 'Browse and organize everything stored in PatOS.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      // opened on its own (Dock, menu): the Overview; asked for a folder ("Show in Piles", a restored window): that folder
      let cwd = args.path || 'overview';
      let view = PatOS.store.get('finderView', 'grid');
      let pileBy = PatOS.store.get('pilesBy', 'kind');
      const openPiles = new Set();
      // search filters: what kind, changed when, and where (this folder and the ones inside it, or everywhere)
      let filters = { kind: 'all', when: 'any', scope: 'here' };
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
      const bPiles = h('button', { class: 'tbtn', title: 'Piles', 'aria-label': 'Piles', html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M5 9.5l7-4 7 4-7 4z"/><path d="M5 13.5l7 4 7-4"/><path d="M5 17.5l7 4 7-4" opacity=".55"/></svg>' });
      const bSort = h('button', { class: 'tbtn', title: 'Sort by', html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h11M4 12h8M4 17h5M18 5v14M15 16l3 3 3-3"/></svg>' });
      const bNew = h('button', { class: 'tbtn', title: 'New Folder', html: S('folder') });
      const bImport = h('button', { class: 'tbtn', title: 'Import from computer', html: S('download') });
      const bInfo = h('button', { class: 'tbtn', title: 'Show info', html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>' });
      const search = h('input', { class: 'field fd-search', placeholder: 'Search', spellcheck: 'false' });
      win.toolbar.append(bBack, bFwd, title, h('div', { style: { flex: 1 } }), bGrid, bList, bPiles, bSort, bNew, bImport, bInfo, search);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '70px';
      search.setAttribute('placeholder', T('Search names and contents')); search.setAttribute('aria-label', T('Search names and contents'));

      const side = h('div', { class: 'fd-side' });
      const main = h('div', { class: 'fd-main', tabindex: '0' });
      const pathbar = h('div', { class: 'fd-path' });
      const status = h('div', { class: 'fd-status' });
      const info = h('div', { class: 'fd-info' });
      const filterBar = h('div', { class: 'fd-filters hidden', role: 'toolbar', 'aria-label': T('Search filters') });
      win.body.append(h('div', { class: 'fd-wrap' }, side, h('div', { class: 'fd-right' }, filterBar, main, pathbar, status), info));
      // places that are views, not folders: nothing can be created or dropped there
      const special = () => ['apps', '/.Trash', 'tag', 'overview', 'recents'].includes(cwd) || /^(smart|kind):/.test(cwd);
      win.el._finderPath = () => (special() ? '/Desktop' : cwd);
      const smartPiles = () => PatOS.store.get('smartPiles', []) || [];

      function renderSide() {
        side.innerHTML = '';
        const sec = (t) => side.appendChild(h('div', { class: 'fd-sh' }, t));
        side.appendChild(sideItem('sparkle', T('Overview'), 'overview'));
        side.appendChild(sideItem('history', T('Recents'), 'recents'));
        sec(T('Places')); PLACES.forEach((p) => side.appendChild(sideItem(p.ic, p.label, p.path)));
        sec('PatOS'); side.appendChild(sideItem('apps', 'Applications', 'apps')); side.appendChild(sideItem('trash', 'Trash', '/.Trash'));
        const sp = smartPiles();
        if (sp.length) {
          sec(T('Smart Piles'));
          sp.forEach((s) => {
            const it = sideItem('search', s.name, 'smart:' + s.id);
            it.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); PatOS.menu([{ label: T('Delete Smart Pile'), action: () => { PatOS.store.set('smartPiles', smartPiles().filter((x) => x.id !== s.id)); if (cwd === 'smart:' + s.id) go('overview'); else renderSide(); } }], e.clientX, e.clientY); });
            side.appendChild(it);
          });
        }
        sec('Tags');
        Object.keys(TAGS).forEach((k) => { const it = h('div', { class: 'fd-si' + (cwd === 'tag' && tagFilter === k ? ' on' : '') }, h('span', { class: 'fd-tagdot', style: { background: TAGS[k] } }), TAG_NAMES[k]); it.onclick = () => { tagFilter = k; go('tag'); }; side.appendChild(it); });
        sec(PatOS.t('This Chromebook'));
        const ob = h('div', { class: 'fd-si' }, h('span', { class: 'symw', html: S('download') }), PatOS.t('Open Files…')); ob.onclick = () => { if (canWrite()) PatOS.device.openFiles(special() ? '/Documents' : cwd); };
        const lb = h('div', { class: 'fd-si' }, h('span', { class: 'symw', html: S('folder') }), PatOS.t('Link a Folder…')); lb.onclick = () => PatOS.device.linkFolder(special() ? '/Documents' : cwd);
        side.append(ob, lb);
        sec('Storage');
        const bar = h('div', { class: 'fd-storage' }, h('div', { class: 'fd-bar' }, h('span', { style: { width: '2%' } })), h('small', {}, PatOS.t('Checking…')));
        side.appendChild(bar);
        PatOS.storageInfo().then((i) => { bar.querySelector('span').style.width = Math.max(2, Math.min(100, i.used / i.quota * 100)) + '%'; bar.querySelector('small').textContent = PatOS.fmtBytes(i.used) + ' ' + PatOS.t('used') + ' · ' + PatOS.fmtBytes(i.quota) + ' ' + PatOS.t('available'); });
      }
      function sideItem(ic, label, path) {
        const it = h('div', { class: 'fd-si' + (cwd === path ? ' on' : '') }, h('span', { class: 'symw', html: S(ic) }), label);
        it.addEventListener('click', () => go(path));
        if (path === '/.Trash' || path.startsWith('/')) { // (folders and the Trash take drops; views don't)
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
      function go(path, noHist) {
        if (!noHist && path !== cwd) { back.push(cwd); fwd.length = 0; }
        cwd = path; selected.clear(); anchor = null; search.value = '';
        filters = { kind: 'all', when: 'any', scope: 'here' };
        // a smart pile is a saved search: open it with its words and filters
        const sp = /^smart:/.test(path) && smartPiles().find((s) => 'smart:' + s.id === path);
        if (sp) { search.value = sp.q || ''; filters = Object.assign({ kind: 'all', when: 'any', scope: 'all' }, sp.filters || {}); }
        // (views aren't remembered as a window's place: a restored window opens its last folder)
        if (PatOS.remember && !special()) PatOS.remember(win, { path });
        render(); if (PatOS.paneIn && !noHist) PatOS.paneIn(main);
      }
      bBack.onclick = () => { if (back.length) { fwd.push(cwd); go(back.pop(), true); } };
      bFwd.onclick = () => { if (fwd.length) { back.push(cwd); go(fwd.pop(), true); } };
      bGrid.onclick = () => { view = 'grid'; PatOS.store.set('finderView', view); render(); };
      bList.onclick = () => { view = 'list'; PatOS.store.set('finderView', view); render(); };
      bPiles.onclick = () => { view = 'piles'; PatOS.store.set('finderView', view); render(); };
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
      const canWrite = () => !special();

      // is a search going on (words, or a filter other than "everything")?
      const searching = () => !!search.value.trim() || filters.kind !== 'all' || filters.when !== 'any';
      const passes = (it) => {
        if (filters.kind !== 'all' && groupOf(it) !== filters.kind) return false;
        if (filters.when !== 'any') { const age = Date.now() - (it.mtime || 0); if (age > { today: DAY, week: 7 * DAY, month: 30 * DAY }[filters.when]) return false; }
        return true;
      };
      function items() {
        const q = fold(search.value.trim());
        let out;
        if (cwd === 'apps') out = PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden).map((id) => ({ name: PatOS.t(PatOS.apps[id].name), app: id, path: 'app:' + id }));
        else if (cwd === 'tag') { const tags = tagsOf(); out = Object.keys(tags).filter((p) => tags[p] === tagFilter && PatOS.fs.exists(p)).map((p) => ({ name: PatOS.fs.basename(p), path: p, ...PatOS.fs.get(p) })); }
        else if (cwd === 'recents' && !searching()) out = recents(80);
        else if (/^kind:/.test(cwd) && !searching()) { const k = cwd.slice(5); out = everything().filter((x) => groupOf(x) === k); }
        else if (cwd === '/.Trash' && !searching()) out = PatOS.fs.trashList();
        else if (searching() || /^smart:/.test(cwd)) {
          // names first, then what is written inside text files; folders under the place you are, or everywhere
          const root = filters.scope === 'all' ? '/' : filters.root && PatOS.fs.exists(filters.root) ? filters.root : special() ? '/' : cwd;
          out = [];
          PatOS.fs.walk(root, (p, n) => {
            const it = Object.assign({ name: PatOS.fs.basename(p), path: p }, n);
            if (/^kind:/.test(cwd) && groupOf(it) !== cwd.slice(5)) return;
            if (!passes(it)) return;
            if (!q) return out.push(it);
            if (fold(it.name).includes(q)) return out.push(it);
            const txt = textOf(n); if (!txt) return;
            const i = fold(txt).indexOf(q);
            if (i >= 0) { const raw = txt.replace(/<[^>]+>/g, ' '); const j = Math.max(0, fold(raw).indexOf(q)); it.match = (j > 30 ? '…' : '') + raw.slice(Math.max(0, j - 30), j + q.length + 50).replace(/\s+/g, ' ').trim(); out.push(it); }
          });
        }
        else out = PatOS.fs.list(cwd);
        if (q && cwd === 'apps') out = out.filter((x) => fold(x.name).includes(q));
        if (cwd === 'recents' && !searching()) return out; // newest first, as it is
        const key = { name: (x) => x.name.toLowerCase(), date: (x) => x.mtime || 0, size: (x) => (x.app ? 0 : PatOS.fs.size(x)), kind: (x) => kindLabel(x) }[sort.by];
        return out.sort((a, b) => { if (!a.app && (a.type === 'dir') !== (b.type === 'dir')) return a.type === 'dir' ? -1 : 1; const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.name.localeCompare(b.name); });
      }

      /* ---------- the filter bar: shown while searching, and in smart piles ---------- */
      function renderFilters() {
        const show = searching() || /^smart:/.test(cwd);
        filterBar.classList.toggle('hidden', !show || cwd === 'apps' || cwd === 'overview');
        if (filterBar.classList.contains('hidden')) return;
        filterBar.innerHTML = '';
        const chip = (on, label, fn) => h('button', { class: 'fd-chip' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => { fn(); render(); } }, label);
        const kinds = [['all', T('Any kind')]].concat(GROUPS.map((g) => [g.k, T(g.label)]));
        filterBar.append(
          h('div', { class: 'fd-fg' }, ...kinds.map(([k, l]) => chip(filters.kind === k, l, () => { filters.kind = k; }))),
          h('div', { class: 'fd-fg' }, ...[['any', T('Any time')], ['today', T('Today')], ['week', T('Past 7 days')], ['month', T('Past 30 days')]].map(([k, l]) => chip(filters.when === k, l, () => { filters.when = k; }))),
          special() ? null : h('div', { class: 'fd-fg' }, chip(filters.scope === 'here', T('This folder'), () => { filters.scope = 'here'; }), chip(filters.scope === 'all', T('Everywhere'), () => { filters.scope = 'all'; })),
          h('div', { style: { flex: 1 } }),
          /^smart:/.test(cwd) ? null : h('button', { class: 'btn sm', onclick: saveSmart }, T('Save as Smart Pile')));
      }
      async function saveSmart() {
        const name = await PatOS.ask(T('Name this Smart Pile'), search.value.trim() || T(filters.kind === 'all' ? 'Smart Pile' : (GROUPS.find((g) => g.k === filters.kind) || {}).label || 'Smart Pile'), { ok: T('Save'), icon: 'finder' });
        if (!name || !name.trim()) return;
        const s = { id: Date.now().toString(36), name: name.trim().slice(0, 40), q: search.value.trim(), filters: Object.assign({}, filters, filters.scope === 'here' && !special() ? { root: cwd } : {}) };
        PatOS.store.set('smartPiles', smartPiles().concat([s]));
        go('smart:' + s.id);
      }
      let renderToken = 0;
      function placeLabel() {
        if (cwd === 'overview') return T('Overview'); if (cwd === 'recents') return T('Recents');
        if (/^kind:/.test(cwd)) return T((GROUPS.find((g) => g.k === cwd.slice(5)) || {}).label || 'Other');
        if (/^smart:/.test(cwd)) return (smartPiles().find((s) => 'smart:' + s.id === cwd) || {}).name || T('Smart Pile');
        return T(cwd === 'apps' ? 'Applications' : cwd === '/.Trash' ? 'Trash' : cwd === 'tag' ? TAG_NAMES[tagFilter] : cwd === '/' ? 'Home' : PatOS.fs.basename(cwd));
      }
      function render() {
        renderSide();
        const label = placeLabel();
        title.textContent = label; win.setTitle(label);
        bBack.disabled = !back.length; bFwd.disabled = !fwd.length;
        bGrid.classList.toggle('on', view === 'grid'); bList.classList.toggle('on', view === 'list'); bPiles.classList.toggle('on', view === 'piles'); bInfo.classList.toggle('on', showInfo);
        renderFilters();
        // the Overview is a page of its own (recent files, your piles, where your space goes)
        if (cwd === 'overview' && !searching()) { list = []; pathbar.innerHTML = ''; renderOverview(); updateStatus(); renderInfo(); return; }
        main.innerHTML = ''; main.className = 'fd-main ' + view;
        list = items();
        if (view === 'piles' && cwd !== 'apps' && list.length) { renderPiles(); pathbarFor(); updateStatus(); renderInfo(); return; }
        if (cwd === '/.Trash' && list.length) main.appendChild(h('div', { class: 'fd-trashbar' }, 'Items in the Trash', h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox('Empty the Trash?', 'The items will be erased for good.', { ok: 'Empty Trash', danger: true, icon: 'finder' })) { PatOS.fs.emptyTrash(); PatOS.sound.trash(); } } }, 'Empty')));
        if (view === 'list') {
          const hd = (by, l) => h('span', { class: 'fd-lhc' + (sort.by === by ? ' on' : ''), onclick: () => { sort = { by, dir: sort.by === by ? -sort.dir : 1 }; PatOS.store.set('finderSort', sort); render(); } }, l, sort.by === by ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');
          main.appendChild(h('div', { class: 'fd-lh' }, hd('name', 'Name'), hd('date', 'Date Modified'), hd('size', 'Size'), hd('kind', 'Kind')));
        }
        /* a folder with thousands of files draws the first screenful at once and the rest a moment later, so it opens at once */
        const token = ++renderToken, FIRST = 120; const firstEnd = Math.min(list.length, FIRST);
        for (let i = 0; i < firstEnd; i++) main.appendChild(item(list[i], i));
        if (list.length > firstEnd) { let at = firstEnd; const more = () => { if (token !== renderToken || !main.isConnected) return; const end = Math.min(list.length, at + 250); const frag = document.createDocumentFragment(); for (; at < end; at++) frag.appendChild(item(list[at], at)); main.appendChild(frag); if (at < list.length) requestAnimationFrame(more); }; requestAnimationFrame(more); }
        if (!list.length) main.appendChild(h('div', { class: 'fd-empty' }, h('b', {}, PatOS.t(searching() ? 'No results' : cwd === '/.Trash' ? 'Trash is empty' : cwd === 'tag' ? 'No files with this tag' : cwd === 'recents' ? 'Nothing recent yet' : 'This folder is empty')),
          canWrite() && !searching() ? h('small', {}, PatOS.t(PatOS.isMobile ? 'Press Import to add files from your phone.' : 'Drag files here from your computer, or press Import.')) : null));
        pathbarFor(); updateStatus(); renderInfo();
      }
      function pathbarFor() {
        pathbar.innerHTML = '';
        if (!special()) {
          const parts = cwd === '/' ? [] : cwd.slice(1).split('/');
          const crumb = (lbl, p) => { const c = h('button', { class: 'fd-crumb' }, h('span', { class: 'symw', html: S(p === '/' ? 'home' : 'folder') }), PatOS.t(lbl)); c.onclick = () => go(p); c.addEventListener('dragover', (e) => e.preventDefault()); c.addEventListener('drop', (e) => { e.preventDefault(); dropTo(e, p); }); return c; };
          pathbar.appendChild(crumb(PatOS.settings.userName, '/'));
          parts.forEach((pt, k) => { pathbar.appendChild(h('span', { class: 'fd-sep' }, '›')); pathbar.appendChild(crumb(pt, '/' + parts.slice(0, k + 1).join('/'))); });
        }
      }

      /* ---------- a pile: up to three things fanned out, with how many and how big ---------- */
      function pileCard(g, files, onOpen, extra) {
        const top = files.slice(0, 3);
        const fan = h('div', { class: 'fd-fan' + (top.length > 1 ? ' many' : '') },
          ...top.slice().reverse().map((x, i, a) => h('div', { class: 'fd-fc', style: { '--k': a.length - 1 - i }, html: x.thumb || PatOS.fileIconHTML(x.name, x) })));
        if (!top.length) fan.appendChild(h('div', { class: 'fd-fc', html: PatOS.iconHTML(g.k === 'folder' ? 'folder' : 'file') }));
        const size = files.reduce((t, x) => t + (x.type === 'file' ? PatOS.fs.size(x) : 0), 0);
        return h('button', { class: 'fd-pile', style: { '--pc': g.col || 'var(--accent)' }, onclick: onOpen, 'aria-label': T(g.label) + ', ' + files.length },
          fan, h('b', {}, T(g.label)), h('small', {}, files.length + ' ' + T(files.length === 1 ? 'item' : 'items') + (size ? ' · ' + PatOS.fmtBytes(size) : '')), extra || null);
      }
      /* ---------- the Overview ---------- */
      function renderOverview() {
        main.innerHTML = ''; main.className = 'fd-main fd-ov';
        const all = everything();
        // recent
        const rec = recents(10);
        const recRow = h('div', { class: 'fd-rec' });
        rec.forEach((x) => {
          const c = h('button', { class: 'fd-rc', title: x.path, 'data-path': x.path }, h('div', { class: 'fd-rci', html: PatOS.fileIconHTML(x.name, x) }), h('b', {}, x.name), h('small', {}, ago(x.seen)));
          c.onclick = () => PatOS.openFile(x.path);
          c.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('Open'), action: () => PatOS.openFile(x.path) }, { label: T('Show in Piles'), action: () => { go(PatOS.fs.dirname(x.path)); select([x.path]); } }, { label: T('Quick Look'), action: () => PatOS.quickLook(x.path, rec.map((r) => r.path)) }], e.clientX, e.clientY); };
          recRow.appendChild(c);
        });
        const head = (t, more) => h('div', { class: 'fd-ovh' }, h('h2', {}, t), more || null);
        main.appendChild(head(T('Recent'), rec.length ? h('button', { class: 'fd-more', onclick: () => go('recents') }, T('See all')) : null));
        main.appendChild(rec.length ? recRow : h('div', { class: 'fd-ovempty' }, T('Files you open or save show up here.')));
        // piles, across the whole home
        main.appendChild(head(T('Your piles')));
        const grid = h('div', { class: 'fd-piles' });
        const by = {}; all.forEach((x) => { const k = groupOf(x); (by[k] = by[k] || []).push(x); });
        GROUPS.forEach((g) => { const f = (by[g.k] || []).sort((a, b) => (b.mtime || 0) - (a.mtime || 0)); if (f.length) grid.appendChild(pileCard(g, f, () => go('kind:' + g.k))); });
        main.appendChild(grid);
        // where the space goes
        main.appendChild(head(T('Storage')));
        const sizes = GROUPS.filter((g) => g.k !== 'folder').map((g) => ({ g, n: (by[g.k] || []).reduce((t, x) => t + PatOS.fs.size(x), 0) })).filter((x) => x.n > 0);
        const total = sizes.reduce((t, x) => t + x.n, 0) || 1;
        const bar = h('div', { class: 'fd-sbar', role: 'img', 'aria-label': T('Storage used by kind') }, ...sizes.map((x) => h('span', { style: { width: Math.max(1.5, x.n / total * 100) + '%', background: x.g.col }, title: T(x.g.label) + ' · ' + PatOS.fmtBytes(x.n) })));
        const legend = h('div', { class: 'fd-legend' }, ...sizes.map((x) => h('button', { class: 'fd-lg', onclick: () => go('kind:' + x.g.k) }, h('i', { style: { background: x.g.col } }), T(x.g.label), h('small', {}, PatOS.fmtBytes(x.n)))));
        const free = h('small', { class: 'fd-free' }, T('Checking…'));
        PatOS.storageInfo().then((i) => { free.textContent = PatOS.fmtBytes(i.used) + ' ' + T('used') + ' · ' + PatOS.fmtBytes(Math.max(0, i.quota - i.used)) + ' ' + T('available'); }).catch(() => { free.textContent = ''; });
        main.appendChild(h('div', { class: 'fd-store' }, bar, legend, free));
        // places
        main.appendChild(head(T('Places')));
        main.appendChild(h('div', { class: 'fd-places' }, ...PLACES.filter((p) => p.path !== '/').map((p) => { const n = PatOS.fs.exists(p.path) ? PatOS.fs.list(p.path).length : 0; const b = h('button', { class: 'fd-place' }, h('span', { class: 'fd-pli', html: S(p.ic) }), h('b', {}, T(p.label)), h('small', {}, n + ' ' + T(n === 1 ? 'item' : 'items'))); b.onclick = () => go(p.path); b.addEventListener('dragover', (e) => e.preventDefault()); b.addEventListener('drop', (e) => { e.preventDefault(); dropTo(e, p.path); }); return b; })));
      }
      /* ---------- the Piles view: this folder (or these results) gathered by kind or by date ---------- */
      function renderPiles() {
        main.className = 'fd-main piles';
        const groups = pileBy === 'date' ? DATES.map((d) => ({ k: d.k, label: d.label, col: 'var(--accent)' })) : GROUPS;
        const key = (x) => (pileBy === 'date' ? dateOf(x.mtime) : groupOf(x));
        const by = {}; list.forEach((x) => { (by[key(x)] = by[key(x)] || []).push(x); });
        main.appendChild(h('div', { class: 'fd-pilebar' }, h('span', {}, T('Gather by')),
          h('div', { class: 'seg' }, ...[['kind', T('Kind')], ['date', T('Date')]].map(([k, l]) => h('button', { class: 'tab' + (pileBy === k ? ' on' : ''), onclick: () => { pileBy = k; PatOS.store.set('pilesBy', k); openPiles.clear(); render(); } }, l)))));
        const shelf = h('div', { class: 'fd-piles' }); main.appendChild(shelf);
        let i = 0;
        groups.forEach((g) => {
          const f = by[g.k]; if (!f) return;
          const id = cwd + '|' + pileBy + '|' + g.k, open = openPiles.has(id);
          const card = pileCard(g, f, () => { if (openPiles.has(id)) openPiles.delete(id); else openPiles.add(id); render(); });
          card.classList.toggle('open', open); card.setAttribute('aria-expanded', String(open));
          shelf.appendChild(card);
          if (open) {
            const spread = h('div', { class: 'fd-spread grid', style: { '--pc': g.col } });
            f.forEach((x) => spread.appendChild(item(x, list.indexOf(x), true)));
            shelf.appendChild(spread);
          }
          i++;
        });
      }
      function updateStatus() {
        const n = selected.size;
        const selSize = n ? [...selected].reduce((t, p) => { const x = !p.startsWith('app:') && PatOS.fs.get(p); return t + (x && x.type === 'file' ? PatOS.fs.size(x) : 0); }, 0) : 0;
        if (cwd === 'overview' && !searching()) { const c = everything().filter((x) => x.type === 'file').length; status.textContent = c + ' ' + PatOS.t(c === 1 ? 'file' : 'files') + (freeSpace != null ? ' · ' + PatOS.fmtBytes(freeSpace) + ' ' + PatOS.t('available') : ''); return; }
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
      function item(it, i, asGrid) {
        const isApp = !!it.app;
        const iconHTML = isApp ? PatOS.iconHTML(PatOS.apps[it.app].icon || it.app) : PatOS.fileIconHTML(it.name, it);
        const tg = !isApp && tagsOf()[it.path];
        // results from inside other folders (search, Recents, piles, smart piles): say where
        const where = !isApp && (searching() || special()) && cwd !== '/.Trash' && PatOS.fs.dirname(it.path) !== cwd ? (PatOS.fs.dirname(it.path) === '/' ? '~' : PatOS.fs.basename(PatOS.fs.dirname(it.path))) : '';
        const dot = tg ? h('span', { class: 'fd-tagdot', style: { background: TAGS[tg] } }) : null;
        const match = it.match ? h('small', { class: 'fd-match no-tr' }, it.match) : null;
        const el = asGrid || view !== 'list'
          ? h('div', { class: 'fd-item', 'data-path': it.path, title: (where ? PatOS.t('In') + ' ' + where : '') + (it.match ? (where ? '\n' : '') + it.match : '') || null }, h('div', { class: 'fd-ic', html: iconHTML }), h('div', { class: 'fd-nm' }, dot, it.name), where ? h('small', { class: 'fd-where' }, where) : null)
          : h('div', { class: 'fd-row', 'data-path': it.path }, h('span', { class: 'fd-rn' }, h('span', { class: 'fd-ric', html: iconHTML }), h('span', { class: 'fd-rnt' }, h('span', {}, it.name, dot), match, where ? h('small', { class: 'fd-where' }, PatOS.t('In') + ' ' + where) : null)), h('span', {}, it.mtime ? new Date(it.mtime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'), h('span', {}, isApp || it.type === 'dir' ? '—' : PatOS.fmtBytes(PatOS.fs.size(it))), h('span', {}, PatOS.t(kindLabel(it))));
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
            sel.length === 1 ? { label: PatOS.t('Rename…'), shortcut: 'Enter', action: () => PatOS.renameInline(it.path) } : { label: PatOS.t('Rename') + ' ' + sel.length + ' ' + PatOS.t('Items…'), action: () => renameMany(sel) },
            { label: PatOS.t('Duplicate'), action: () => sel.forEach((p) => PatOS.fs.copy(p, PatOS.fs.dirname(p))) },
            { label: PatOS.t('Compress'), action: () => PatOS.compress(sel) },
            it.type === 'file' && /\.zip$/i.test(it.name) ? { label: PatOS.t('Extract Here'), action: () => PatOS.openZip(it.path) } : null,
            sel.some((p) => { const n = PatOS.fs.get(p); return n && n.type === 'file'; }) && PatOS.link ? { label: PatOS.t('Send with PatDrop'), action: () => PatOS.sendWithPatDrop(sel) } : null,
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
      /* ---------- rename many: replace words, add words, or a name with a number ---------- */
      function renameMany(paths) {
        paths = paths.filter((p) => !p.startsWith('app:') && PatOS.fs.exists(p));
        if (paths.length < 2) return;
        const old = win.body.querySelector('.fd-rmlayer'); if (old) old.remove();
        let mode = 'replace';
        const f1 = h('input', { class: 'field', spellcheck: 'false' }), f2 = h('input', { class: 'field', spellcheck: 'false' });
        const pos = h('select', { class: 'field', 'aria-label': T('Where') }, h('option', { value: 'after' }, T('after the name')), h('option', { value: 'before' }, T('before the name')));
        const start = h('input', { class: 'field', type: 'number', value: '1', min: '0', 'aria-label': T('Start at') });
        const fields = h('div', { class: 'fd-rmf' }), preview = h('div', { class: 'fd-rmp no-tr' }), err = h('small', { class: 'fd-rme' });
        const splitExt = (n, isDir) => { const i = n.lastIndexOf('.'); return isDir || i <= 0 ? [n, ''] : [n.slice(0, i), n.slice(i)]; };
        const plan = () => paths.map((p, k) => {
          const n = PatOS.fs.get(p), name = PatOS.fs.basename(p), [base, ext] = splitExt(name, n.type === 'dir');
          let nb = base;
          if (mode === 'replace') nb = f1.value ? base.split(f1.value).join(f2.value) : base;
          else if (mode === 'add') nb = pos.value === 'before' ? f1.value + base : base + f1.value;
          else nb = (f1.value.trim() || T('File')) + ' ' + String((+start.value || 0) + k).padStart(String((+start.value || 0) + paths.length - 1).length, '0');
          return { p, from: name, to: (nb + ext).replace(/\//g, '-').trim() };
        });
        // (the fields are rebuilt only when the mode changes: rebuilding them on every key took the focus away)
        const drawFields = () => {
          fields.innerHTML = '';
          if (mode === 'replace') { f1.placeholder = T('Find'); f2.placeholder = T('Replace with'); fields.append(f1, f2); }
          else if (mode === 'add') { f1.placeholder = T('Text to add'); fields.append(f1, pos); }
          else { f1.placeholder = T('Name'); fields.append(f1, h('label', { class: 'fd-rml' }, T('Start at'), start)); }
          draw();
        };
        const draw = () => {
          const pl = plan(); preview.innerHTML = '';
          pl.slice(0, 6).forEach((x) => preview.appendChild(h('div', {}, h('span', {}, x.from), h('b', {}, '→'), h('span', { class: x.to !== x.from ? 'chg' : '' }, x.to))));
          if (pl.length > 6) preview.appendChild(h('div', { class: 'more' }, '+ ' + (pl.length - 6)));
          const bad = pl.find((x) => !x.to);
          const dup = pl.some((x, i) => pl.findIndex((y) => PatOS.fs.dirname(y.p) === PatOS.fs.dirname(x.p) && y.to === x.to) !== i);
          const dirOf = (x) => PatOS.fs.dirname(x.p), pathOf = (x) => (dirOf(x) === '/' ? '/' : dirOf(x) + '/') + x.to;
          const taken = pl.some((x) => x.to !== x.from && PatOS.fs.exists(pathOf(x)) && !paths.includes(pathOf(x)));
          err.textContent = bad ? T('A name can’t be empty.') : dup ? T('Two files would get the same name.') : taken ? T('A file with that name is already there.') : '';
          go2.disabled = !!(bad || dup || taken) || pl.every((x) => x.to === x.from);
        };
        const tabs = h('div', { class: 'seg' }, ...[['replace', T('Replace Text')], ['add', T('Add Text')], ['number', T('Name and Number')]].map(([k, l]) => h('button', { class: 'tab' + (k === mode ? ' on' : ''), onclick: (e) => { mode = k; [...tabs.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); f1.value = ''; f2.value = ''; drawFields(); f1.focus(); } }, l)));
        const close = () => layer.remove();
        const go2 = h('button', { class: 'btn primary', onclick: () => {
          const tags = tagsOf(); const out = []; const fails = [];
          plan().forEach((x) => {
            if (x.to === x.from) { out.push(x.p); return; }
            try { PatOS.fs.rename(x.p, x.to); const np = PatOS.fs.dirname(x.p) === '/' ? '/' + x.to : PatOS.fs.dirname(x.p) + '/' + x.to; if (tags[x.p]) { tags[np] = tags[x.p]; delete tags[x.p]; } out.push(np); }
            catch (e) { fails.push(x.from + ': ' + (e.message || e)); }
          });
          PatOS.store.set('fileTags', tags); close();
          if (fails.length) PatOS.notify({ title: T('Some items weren’t renamed'), body: fails.slice(0, 3).join('\n'), icon: 'finder' });
          setTimeout(() => select(out.filter((p) => PatOS.fs.exists(p))), 120);
        } }, T('Rename'));
        [f1, f2, start, pos].forEach((x) => x.addEventListener('input', draw));
        const card = h('div', { class: 'fd-rmcard', role: 'dialog', 'aria-label': T('Rename') + ' ' + paths.length + ' ' + T('Items…') },
          h('b', {}, T('Rename') + ' ' + paths.length + ' ' + T('items')), tabs, fields, preview, err,
          h('div', { class: 'fd-rmb' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), go2));
        const layer = h('div', { class: 'fd-rmlayer' }, card);
        layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); });
        layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'Enter' && !go2.disabled) go2.click(); });
        win.body.appendChild(layer); drawFields(); setTimeout(() => f1.focus(), 30);
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
        const cols = view !== 'list' ? Math.max(1, Math.floor(main.clientWidth / 102)) : 1;
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
      win._finder = { newFolder: newFolderHere, copy: copySel, paste: pasteHere, selectAll: () => select(list.map((x) => x.path)), view: () => view, setView: (v) => { view = v; PatOS.store.set('finderView', v); render(); }, info: () => showInfo, toggleInfo: () => bInfo.click(), renameMany, go, place: () => cwd, search: (q, f) => { search.value = q || ''; if (f) filters = Object.assign(filters, f); render(); }, saveSmart };
      render(); setTimeout(() => main.focus({ preventScroll: true }), 80);
    },
    onArgs(win, args) { if (args.path && win._go) win._go(args.path); },
    menus(win) {
      const F = win._finder || {};
      return {
        file: [
          { label: PatOS.t('New Piles Window'), shortcut: 'Alt+N', action: () => PatOS.launch('finder', { path: win.el._finderPath() }) },
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
          { label: PatOS.t('as Piles'), checked: F.view && F.view() === 'piles', action: () => F.setView && F.setView('piles') },
          { divider: true },
          { label: PatOS.t('Show Info'), checked: !!(F.info && F.info()), action: () => F.toggleInfo && F.toggleInfo() }
        ]
      };
    }
  });
})();
