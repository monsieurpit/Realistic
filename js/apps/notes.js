/* Notes — folders, pinned notes, pictures, checklists, Recently Deleted, export */
(function () {
  'use strict';
  const { h } = PatOS;
  const seed = () => [
    { id: 'n1', title: 'Welcome to Notes', body: '<div><b>Welcome to Notes</b></div><div>Your notes save as you type.</div><div><br></div><div>• Put notes in folders with the sidebar</div><div>• Paste a picture straight into a note</div><div>• Press ☑ for a checklist</div>', mtime: Date.now(), pinned: true },
    { id: 'n2', title: 'Shopping list', body: '<div>Shopping list</div><div>☐ Pencils</div><div>☐ Binder</div><div>☐ Snacks</div>', mtime: Date.now() - 86400000 }
  ];
  const plain = (html) => { const t = document.createElement('textarea'); t.innerHTML = String(html).replace(/<img[^>]*>/gi, ' ').replace(/<(div|br|p|h\d|li|tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''); return t.value.replace(/^\n+/, ''); };
  const DAY = 86400000;
  PatOS.registerApp({
    id: 'notes', name: 'Notes', icon: 'notes', width: 980, height: 600, keywords: 'note write memo folders checklist',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let notes = PatOS.store.get('notes', null) || seed();
      let folders = PatOS.store.get('noteFolders', []);
      let folder = 'all', cur = null, sortBy = PatOS.store.get('noteSort', 'date');
      notes = notes.filter((n) => !(n.deletedAt && Date.now() - n.deletedAt > 30 * DAY)); // empty Recently Deleted after 30 days
      const save = PatOS.debounce(() => PatOS.store.set('notes', notes), 300);
      const saveFolders = () => PatOS.store.set('noteFolders', folders);
      const fside = h('div', { class: 'nf-side' });
      const listEl = h('div', { class: 'nt-list' });
      const q = h('input', { class: 'field', placeholder: 'Search all notes', style: { width: '100%' } });
      const listHead = h('div', { class: 'nl-head' });
      const side = h('div', { class: 'notes-side' }, h('div', { class: 'notes-search' }, q), listHead, listEl);
      const ed = h('div', { class: 'notes-ed', contenteditable: 'true', spellcheck: 'true' });
      const meta = h('div', { class: 'notes-meta' });
      const empty = h('div', { class: 'notes-empty' });
      const mainEl = h('div', { class: 'notes-main' }, meta, ed, empty);
      win.body.append(h('div', { class: 'notes-wrap' }, fside, side, mainEl));
      const fmt = (cmd, val) => (e) => { if (e) e.preventDefault(); ed.focus(); document.execCommand(cmd, false, val); onInput(); };
      const tb = (label, title, fn) => { const b = h('button', { class: 'tbtn', title }, label); b.addEventListener('mousedown', (e) => e.preventDefault()); b.onclick = fn; return b; };
      const bNew = tb(h('span', { class: 'symw', html: PatOS.sym('pencil') }), 'New note', () => create());
      const bStyle = tb('Aa', 'Text style', (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ label: PatOS.t('Title'), action: fmt('formatBlock', 'h1') }, { label: PatOS.t('Heading'), action: fmt('formatBlock', 'h2') }, { label: PatOS.t('Body'), action: fmt('formatBlock', 'div') }, { label: PatOS.t('Monospaced'), action: fmt('formatBlock', 'pre') }, { divider: true }, { label: PatOS.t('Bulleted list'), action: fmt('insertUnorderedList') }, { label: PatOS.t('Numbered list'), action: fmt('insertOrderedList') }], r.left, r.bottom + 4); });
      const bB = tb(h('b', {}, 'B'), 'Bold', fmt('bold')), bI = tb(h('i', {}, 'I'), 'Italic', fmt('italic')), bU = tb(h('u', {}, 'U'), 'Underline', fmt('underline')), bS = tb(h('s', {}, 'S'), 'Strikethrough', fmt('strikeThrough'));
      const bCheck = tb('☑', 'Checklist', () => { ed.focus(); document.execCommand('insertText', false, '☐ '); onInput(); });
      const bTable = tb(h('span', { class: 'symw', html: PatOS.sym('sheet') }), 'Table', () => { ed.focus(); document.execCommand('insertHTML', false, '<table class="nt-table"><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></table><div><br></div>'); onInput(); });
      const bImg = tb(h('span', { class: 'symw', html: PatOS.sym('image') }), 'Add a picture', () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { if (i.files[0]) readImage(i.files[0]); }; i.click(); });
      const bShare = tb(h('span', { class: 'symw', html: PatOS.sym('upload') }), 'Share and export', (e) => {
        if (!cur) return; const r = e.currentTarget.getBoundingClientRect(); const txt = plain(cur.body);
        PatOS.menu([
          { label: PatOS.t('Copy Text'), action: () => navigator.clipboard && navigator.clipboard.writeText(txt).then(() => PatOS.notify({ title: PatOS.t('Copied'), body: titleOf(cur), icon: 'notes' })).catch(() => {}) },
          { label: PatOS.t('Open in Docs'), action: () => { const p = PatOS.newDocPath('/Documents', titleOf(cur).replace(/[\/]/g, '-').slice(0, 40), 'pdoc'); PatOS.fs.write(p, cur.body); PatOS.launch('docs', { path: p }); } },
          { label: PatOS.t('Save as Text File in Documents'), action: () => { const nm = PatOS.fs.uniqueName('/Documents', titleOf(cur).replace(/[\/]/g, '-').slice(0, 40) + '.txt'); PatOS.fs.write('/Documents/' + nm, txt); PatOS.notify({ title: PatOS.t('Saved'), body: nm, icon: 'notes' }); } },
          { label: PatOS.t('Download'), action: () => PatOS.downloadFile(titleOf(cur).slice(0, 40) + '.txt', txt) }
        ], r.left - 160, r.bottom + 4);
      });
      const bDel = tb(h('span', { class: 'symw', html: PatOS.sym('trash') }), 'Delete note', () => cur && del(cur));
      win.toolbar.append(bNew, h('div', { class: 'tb-gap' }), bStyle, bB, bI, bU, bS, bCheck, bTable, bImg, h('div', { style: { flex: 1 } }), bShare, bDel);
      win.toolbar.style.paddingLeft = '200px';

      const titleOf = (n) => { const t = plain(n.body).trim().split('\n')[0]; return t.slice(0, 60) || PatOS.t('New Note'); };
      const inFolder = (n) => folder === 'deleted' ? !!n.deletedAt : !n.deletedAt && (folder === 'all' || (folder === 'notes' ? !n.folder : n.folder === folder));
      function renderFolders() {
        fside.innerHTML = '';
        const item = (key, label, ic, count, extra) => { const el = h('div', { class: 'fd-si' + (folder === key ? ' on' : '') }, h('span', { class: 'symw', html: PatOS.sym(ic) }), h('span', { class: 'nf-name' }, label), h('small', { class: 'nf-count' }, count || '')); el.onclick = () => { folder = key; cur = null; render(); }; if (extra) extra(el); return el; };
        const live = notes.filter((n) => !n.deletedAt);
        fside.append(h('div', { class: 'fd-sh' }, 'PatOS'), item('all', PatOS.t('All Notes'), 'folder', live.length), item('notes', PatOS.t('Notes'), 'folder', live.filter((n) => !n.folder).length));
        folders.forEach((f) => fside.appendChild(item(f.id, f.name, 'folder', live.filter((n) => n.folder === f.id).length, (el) => {
          el.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: PatOS.t('Rename Folder…'), action: async () => { const n = await PatOS.ask(PatOS.t('Rename Folder…'), f.name, { icon: 'notes', ok: 'Rename' }); if (n) { f.name = n; saveFolders(); render(); } } }, { label: PatOS.t('Delete Folder'), action: async () => { if (await PatOS.confirmBox(PatOS.t('Delete this folder?'), PatOS.t('Its notes move to Recently Deleted.'), { danger: true, ok: 'Delete', icon: 'notes' })) { notes.forEach((n) => { if (n.folder === f.id) { n.deletedAt = Date.now(); n.folder = null; } }); folders = folders.filter((x) => x !== f); saveFolders(); save(); folder = 'all'; render(); } } }], e.clientX, e.clientY); };
          el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); }); el.addEventListener('dragleave', () => el.classList.remove('drop'));
          el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drop'); const n = notes.find((x) => x.id === e.dataTransfer.getData('text/note')); if (n) { n.folder = f.id; save(); render(); } });
        })));
        const del = notes.filter((n) => n.deletedAt).length;
        if (del) fside.appendChild(item('deleted', PatOS.t('Recently Deleted'), 'trash', del));
        fside.appendChild(h('button', { class: 'nf-new', onclick: async () => { const n = await PatOS.ask(PatOS.t('New Folder'), PatOS.t('School'), { icon: 'notes', ok: 'Create' }); if (n) { const f = { id: PatOS.uid(), name: n }; folders.push(f); saveFolders(); folder = f.id; render(); } } }, '+ ' + PatOS.t('New Folder')));
      }
      function renderList() {
        listEl.innerHTML = '';
        const ql = q.value.toLowerCase();
        const items = notes.filter((n) => (ql ? !n.deletedAt : inFolder(n)) && (!ql || plain(n.body).toLowerCase().includes(ql)))
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (sortBy === 'title' ? titleOf(a).localeCompare(titleOf(b)) : b.mtime - a.mtime));
        const fname = folder === 'all' ? PatOS.t('All Notes') : folder === 'notes' ? PatOS.t('Notes') : folder === 'deleted' ? PatOS.t('Recently Deleted') : (folders.find((f) => f.id === folder) || {}).name;
        listHead.innerHTML = '';
        listHead.append(h('b', {}, ql ? PatOS.t('Results') : fname), h('small', {}, items.length + ' ' + PatOS.t(items.length === 1 ? 'note' : 'notes')), h('button', { class: 'tbtn nl-sort', title: 'Sort by', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ label: PatOS.t('Date Edited'), checked: sortBy === 'date', action: () => { sortBy = 'date'; PatOS.store.set('noteSort', sortBy); renderList(); } }, { label: PatOS.t('Title'), checked: sortBy === 'title', action: () => { sortBy = 'title'; PatOS.store.set('noteSort', sortBy); renderList(); } }], r.left, r.bottom + 4); } }, '⇅'));
        let section = '';
        items.forEach((n) => {
          const age = Date.now() - n.mtime; const sec = n.pinned && !ql ? PatOS.t('Pinned') : age < DAY ? PatOS.t('Today') : age < 7 * DAY ? PatOS.t('Previous 7 Days') : PatOS.t('Earlier');
          if (sortBy === 'date' && sec !== section) { section = sec; listEl.appendChild(h('div', { class: 'nl-sec' }, sec)); }
          const text = plain(n.body).trim().split('\n').filter(Boolean);
          const img = (/<img[^>]+src="([^"]+)"/.exec(n.body) || [])[1];
          const el = h('div', { class: 'nt-item' + (cur && cur.id === n.id ? ' on' : '') + (n.pinned ? ' pinned' : ''), draggable: 'true' },
            h('div', { class: 'nt-txt' }, h('b', {}, titleOf(n)), h('div', {}, h('span', {}, new Date(n.mtime).toLocaleDateString(undefined, age < DAY ? undefined : { month: 'short', day: 'numeric' }).replace(/\/\d{4}$/, '')), ' ', (text[1] || PatOS.t('No additional text')).slice(0, 60))),
            img ? h('img', { class: 'nt-thumb', src: img, alt: '' }) : null);
          el.onclick = () => open(n);
          el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/note', n.id));
          el.oncontextmenu = (e) => {
            e.preventDefault();
            if (n.deletedAt) return PatOS.menu([{ label: PatOS.t('Recover'), action: () => { delete n.deletedAt; save(); render(); } }, { label: PatOS.t('Delete Immediately'), action: () => { notes = notes.filter((x) => x !== n); save(); if (cur === n) cur = null; render(); } }], e.clientX, e.clientY);
            PatOS.menu([{ label: PatOS.t(n.pinned ? 'Unpin' : 'Pin to top'), action: () => { n.pinned = !n.pinned; save(); renderList(); } },
              { header: PatOS.t('Move to') }, { label: PatOS.t('Notes'), checked: !n.folder, action: () => { n.folder = null; save(); render(); } }, ...folders.map((f) => ({ label: f.name, checked: n.folder === f.id, action: () => { n.folder = f.id; save(); render(); } })),
              { divider: true }, { label: PatOS.t('Delete'), action: () => del(n) }], e.clientX, e.clientY);
          };
          listEl.appendChild(el);
        });
        if (!items.length) listEl.appendChild(h('div', { class: 'nl-empty' }, folder === 'deleted' ? PatOS.t('Nothing here. Deleted notes stay for 30 days.') : PatOS.t('No notes yet')));
      }
      function open(n) {
        cur = n; ed.innerHTML = n.body; ed.contentEditable = n.deletedAt ? 'false' : 'true';
        meta.textContent = new Date(n.mtime).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) + (n.deletedAt ? ' · ' + PatOS.t('In Recently Deleted') : '');
        empty.style.display = 'none'; ed.style.display = ''; meta.style.display = '';
        renderList();
      }
      function showEmpty() { cur = null; ed.style.display = 'none'; meta.style.display = 'none'; empty.style.display = ''; empty.textContent = PatOS.t('No note selected'); }
      function del(n) {
        if (n.deletedAt) { notes = notes.filter((x) => x !== n); } else { n.deletedAt = Date.now(); n.pinned = false; }
        save(); PatOS.sound.trash();
        const next = notes.filter(inFolder).sort((a, b) => b.mtime - a.mtime)[0];
        if (cur === n) { if (next) open(next); else { showEmpty(); } } render(true);
      }
      function create() {
        if (folder === 'deleted') folder = 'all';
        const n = { id: PatOS.uid(), title: '', body: '<div><br></div>', mtime: Date.now(), folder: ['all', 'notes'].includes(folder) ? null : folder };
        notes.unshift(n); save(); open(n); render(true); ed.focus();
      }
      function onInput() { if (!cur || cur.deletedAt) return; cur.body = ed.innerHTML; cur.mtime = Date.now(); cur.title = titleOf(cur); save(); renderList(); renderFolders(); }
      function readImage(file) {
        const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 700 / img.width); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ed.focus(); document.execCommand('insertHTML', false, `<img src="${c.toDataURL('image/jpeg', 0.8)}" alt=""><div><br></div>`); onInput(); }; img.src = r.result; }; r.readAsDataURL(file);
      }
      ed.addEventListener('input', onInput);
      ed.addEventListener('paste', (e) => { const it = [...((e.clipboardData || {}).items || [])].find((x) => x.type.startsWith('image/')); if (it) { e.preventDefault(); readImage(it.getAsFile()); } });
      ed.addEventListener('drop', (e) => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) { e.preventDefault(); readImage(f); } });
      ed.addEventListener('click', () => {
        const sel = window.getSelection(); if (!sel.rangeCount) return; const node = sel.anchorNode; if (!node || node.nodeType !== 3) return;
        const i = sel.anchorOffset; const t = node.textContent;
        for (const j of [i - 1, i]) if (t[j] === '☐' || t[j] === '☑') { node.textContent = t.slice(0, j) + (t[j] === '☐' ? '☑' : '☐') + t.slice(j + 1); onInput(); break; }
      });
      ed.addEventListener('keydown', (e) => {
        // keep checklists going: Enter on a "☐ " line starts a new one
        if (e.key === 'Enter' && !e.shiftKey) { const sel = window.getSelection(); const line = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.textContent : sel.anchorNode.textContent || ''); if (/^[☐☑]\s/.test(line || '')) { e.preventDefault(); if (/^[☐☑]\s*$/.test(line)) { sel.anchorNode.textContent = ''; } else { document.execCommand('insertParagraph'); document.execCommand('insertText', false, '☐ '); } onInput(); } }
      });
      q.addEventListener('input', renderList);
      function render(keepCur) { renderFolders(); renderList(); if (!keepCur && !cur) { const first = notes.filter(inFolder).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.mtime - a.mtime)[0]; if (first) open(first); else showEmpty(); } }
      win._openNote = (id) => { const n = notes.find((x) => x.id === id); if (n) { folder = 'all'; open(n); render(true); } };
      const first = args.id ? notes.find((n) => n.id === args.id) : null;
      if (first) { open(first); render(true); } else render();
    },
    onArgs(win, args) { if (args.id) win._openNote(args.id); }
  });
})();
