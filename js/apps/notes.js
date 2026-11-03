/* Notes — folders, #tags, pinned notes, real checklists, pictures, drawings, tables, search that
   highlights what it finds, Recently Deleted, and export to Docs, Word or PDF. Notes are kept in
   PatOS's storage under "notes" (same format as before, so older notes open as they were). */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const seed = () => [
    { id: 'n1', title: 'Welcome to Notes', body: '<div><b>Welcome to Notes</b></div><div>Your notes save as you type.</div><div><br></div><div class="nt-chk done">Make a checklist with the ☑ button</div><div class="nt-chk">Put notes in folders with the sidebar</div><div class="nt-chk">Add #tags to find notes faster</div><div class="nt-chk">Paste a picture or make a drawing</div><div><br></div><div>#school</div>', mtime: Date.now() },
    { id: 'n2', title: 'Shopping list', body: '<div>Shopping list</div><div class="nt-chk">Pencils</div><div class="nt-chk">Binder</div><div class="nt-chk">Snacks</div>', mtime: Date.now() - 86400000 }
  ];
  const plain = (html) => { const t = document.createElement('textarea'); t.innerHTML = String(html).replace(/<img[^>]*>/gi, ' ').replace(/<(div|br|p|h\d|li|tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''); return t.value.replace(/^\n+/, ''); };
  const fold = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const TAG_RE = /(^|\s)#([\p{L}\p{N}_-]{2,30})/gu;
  const tagsOf = (n) => { const out = new Set(); let m; const txt = plain(n.body); TAG_RE.lastIndex = 0; while ((m = TAG_RE.exec(txt))) out.add(m[2].toLowerCase()); return [...out]; };
  const DAY = 86400000;
  // older notes used ☐ and ☑ characters; turn those lines into real checklist items
  function upgrade(html) {
    if (!/[☐☑]/.test(html)) return html;
    const box = document.createElement('div'); box.innerHTML = html;
    box.querySelectorAll(':scope > div').forEach((d) => {
      const m = /^\s*([☐☑])\s?/.exec(d.textContent); if (!m) return;
      d.classList.add('nt-chk'); if (m[1] === '☑') d.classList.add('done');
      const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); const tn = w.nextNode(); if (tn) tn.textContent = tn.textContent.replace(/^\s*[☐☑]\s?/, '');
    });
    return box.innerHTML;
  }

  PatOS.registerApp({
    id: 'notes', name: 'Notes', icon: 'notes', width: 1000, height: 620, keywords: 'note write memo folders checklist tags drawing notes',
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
      const q = h('input', { class: 'field', type: 'search', placeholder: T('Search all notes'), 'aria-label': T('Search all notes'), style: { width: '100%' } });
      const listHead = h('div', { class: 'nl-head' });
      const side = h('div', { class: 'notes-side' }, h('div', { class: 'notes-search' }, q), listHead, listEl);
      const ed = h('div', { class: 'notes-ed', contenteditable: 'true', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': T('Note') });
      const meta = h('div', { class: 'notes-meta' });
      const empty = h('div', { class: 'notes-empty' });
      const mainEl = h('div', { class: 'notes-main' }, meta, ed, empty);
      win.body.append(h('div', { class: 'notes-wrap' }, fside, side, mainEl));

      /* ---------- toolbar ---------- */
      const fmt = (cmd, val) => (e) => { if (e && e.preventDefault) e.preventDefault(); ed.focus(); document.execCommand(cmd, false, val); onInput(); };
      const tb = (label, title, fn) => { const b = h('button', { class: 'tbtn', title: T(title), 'aria-label': T(title) }, label); b.addEventListener('mousedown', (e) => e.preventDefault()); b.onclick = fn; return b; };
      const sym = (n) => h('span', { class: 'symw', html: PatOS.sym(n) });
      const bNew = tb(sym('pencil'), 'New note', () => create());
      const bStyle = tb('Aa', 'Text style', (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([
        { label: T('Title'), action: fmt('formatBlock', 'h1') }, { label: T('Heading'), action: fmt('formatBlock', 'h2') }, { label: T('Body'), action: fmt('formatBlock', 'div') }, { label: T('Monospaced'), action: fmt('formatBlock', 'pre') },
        { divider: true }, { label: T('Bulleted list'), action: fmt('insertUnorderedList') }, { label: T('Numbered list'), action: fmt('insertOrderedList') },
        { divider: true }, { label: T('Move Checked Items to Bottom'), disabled: !cur || !ed.querySelector('.nt-chk.done'), action: sinkChecked }, { label: T('Uncheck All'), disabled: !cur || !ed.querySelector('.nt-chk.done'), action: () => { ed.querySelectorAll('.nt-chk.done').forEach((d) => d.classList.remove('done')); onInput(); } }
      ], r.left, r.bottom + 4); });
      const bB = tb(h('b', {}, 'B'), 'Bold', fmt('bold')), bI = tb(h('i', {}, 'I'), 'Italic', fmt('italic')), bU = tb(h('u', {}, 'U'), 'Underline', fmt('underline')), bS = tb(h('s', {}, 'S'), 'Strikethrough', fmt('strikeThrough'));
      const bCheck = tb(h('span', { class: 'nt-chkic' }), 'Checklist', () => toggleChecklist());
      const bTable = tb(sym('sheet'), 'Table', () => { ed.focus(); document.execCommand('insertHTML', false, '<table class="nt-table"><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></table><div><br></div>'); onInput(); });
      const bImg = tb(sym('image'), 'Add a picture', () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { if (i.files[0]) readImage(i.files[0]); }; i.click(); });
      const bDraw = tb(h('span', { class: 'symw', html: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l3-1 12-12-2-2L4 18zM14 6l2 2M15 19c2-2 4-2 6 0"/></svg>' }), 'Add a drawing', () => drawing());
      const bShare = tb(sym('upload'), 'Share and export', (e) => {
        if (!cur) return; const r = e.currentTarget.getBoundingClientRect(); const txt = textOut(cur.body);
        const safe = titleOf(cur).replace(/[\/\\:*?"<>|]/g, '-').slice(0, 50);
        PatOS.menu([
          { label: T('Copy Text'), action: () => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => PatOS.notify({ title: T('Copied'), body: titleOf(cur), icon: 'notes' })).catch(() => {}) },
          { label: T('Open in Docs'), action: () => { const p = PatOS.newDocPath('/Documents', safe, 'pdoc'); PatOS.fs.write(p, exportHTML(cur.body)); PatOS.launch('docs', { path: p }); } },
          { label: T('Export as Word (.docx)…'), action: async () => { try { const box = h('div', { html: exportHTML(cur.body) }); PatOS.downloadBlob(safe + '.docx', await PatOS.docx.fromElement(box, { title: safe })); } catch (err) { PatOS.alertBox(T('Couldn’t save'), err.message, { icon: 'notes' }); } } },
          { label: T('Print or Save as PDF…'), action: () => printNote(cur) },
          { divider: true },
          { label: T('Save as Text File in Documents'), action: () => { const nm = PatOS.fs.uniqueName('/Documents', safe + '.txt'); PatOS.fs.write('/Documents/' + nm, txt); PatOS.notify({ title: T('Saved'), body: nm, icon: 'notes', onClick: () => PatOS.launch('finder', { path: '/Documents' }) }); } },
          { label: T('Download as Text'), action: () => PatOS.downloadFile(safe + '.txt', txt) }
        ], r.left - 170, r.bottom + 4);
      });
      const bDel = tb(sym('trash'), 'Delete note', () => cur && del(cur));
      win.toolbar.append(bNew, h('div', { class: 'tb-gap' }), bStyle, bB, bI, bU, bS, bCheck, bTable, bImg, bDraw, h('div', { style: { flex: 1 } }), bShare, bDel);
      win.toolbar.style.paddingLeft = '200px';

      const titleOf = (n) => { const t = plain(n.body).trim().split('\n')[0]; return t.slice(0, 60) || T('New Note'); };
      const inFolder = (n) => folder === 'deleted' ? !!n.deletedAt : !n.deletedAt && (folder === 'all' || (folder === 'notes' ? !n.folder : folder.startsWith('tag:') ? tagsOf(n).includes(folder.slice(4)) : n.folder === folder));
      // what other apps get: checklist items written as ☐ / ☑ so they still read as a checklist
      const exportHTML = (html) => { const box = document.createElement('div'); box.innerHTML = html; box.querySelectorAll('.nt-chk').forEach((d) => { d.insertBefore(document.createTextNode(d.classList.contains('done') ? '☑ ' : '☐ '), d.firstChild); d.removeAttribute('class'); }); return box.innerHTML; };
      const textOut = (html) => plain(exportHTML(html));

      /* ---------- sidebar: folders and tags ---------- */
      function renderFolders() {
        fside.innerHTML = '';
        const item = (key, label, ic, count, extra) => { const el = h('div', { class: 'fd-si' + (folder === key ? ' on' : ''), role: 'button', tabindex: '0' }, typeof ic === 'string' ? h('span', { class: 'symw', html: PatOS.sym(ic) }) : ic, h('span', { class: 'nf-name' }, label), h('small', { class: 'nf-count' }, count || '')); el.onclick = () => { folder = key; q.value = ''; cur = null; render(); }; el.onkeydown = (e) => { if (e.key === 'Enter') el.click(); }; if (extra) extra(el); return el; };
        const live = notes.filter((n) => !n.deletedAt);
        fside.append(h('div', { class: 'fd-sh' }, 'PatOS'), item('all', T('All Notes'), 'folder', live.length), item('notes', T('Notes'), 'folder', live.filter((n) => !n.folder).length));
        folders.forEach((f) => fside.appendChild(item(f.id, f.name, 'folder', live.filter((n) => n.folder === f.id).length, (el) => {
          el.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('Rename Folder…'), action: async () => { const n = await PatOS.ask(T('Rename Folder…'), f.name, { icon: 'notes', ok: T('Rename') }); if (n) { f.name = n; saveFolders(); render(true); } } }, { label: T('Delete Folder'), action: async () => { if (await PatOS.confirmBox(T('Delete this folder?'), T('Its notes move to Recently Deleted.'), { ok: T('Delete'), danger: true, icon: 'notes' })) { notes.forEach((n) => { if (n.folder === f.id) { n.folder = null; n.deletedAt = Date.now(); } }); folders = folders.filter((x) => x !== f); saveFolders(); save(); folder = 'all'; cur = null; render(); } } }], e.clientX, e.clientY); };
          el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); }); el.addEventListener('dragleave', () => el.classList.remove('drop'));
          el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drop'); const n = notes.find((x) => x.id === e.dataTransfer.getData('text/note')); if (n) { n.folder = f.id; save(); render(true); } });
        })));
        const deleted = notes.filter((n) => n.deletedAt).length;
        if (deleted) fside.appendChild(item('deleted', T('Recently Deleted'), 'trash', deleted));
        fside.appendChild(h('button', { class: 'nf-new', onclick: async () => { const n = await PatOS.ask(T('New Folder'), T('School'), { icon: 'notes', ok: T('Create') }); if (n) { const f = { id: PatOS.uid(), name: n }; folders.push(f); saveFolders(); folder = f.id; cur = null; render(); } } }, '+ ' + T('New Folder')));
        // tags used in notes
        const counts = {}; live.forEach((n) => tagsOf(n).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
        const tags = Object.keys(counts).sort();
        if (tags.length) {
          fside.appendChild(h('div', { class: 'fd-sh' }, T('Tags')));
          fside.appendChild(h('div', { class: 'nf-tags' }, ...tags.map((t) => { const b = h('button', { class: 'nf-tag' + (folder === 'tag:' + t ? ' on' : '') }, '#' + t); b.onclick = () => { folder = folder === 'tag:' + t ? 'all' : 'tag:' + t; q.value = ''; cur = null; render(); }; return b; })));
        }
      }

      /* ---------- the list ---------- */
      const markText = (text, ql) => { if (!ql) return text; const i = fold(text).indexOf(ql); if (i < 0 || fold(text).length !== text.length) return text; return h('span', {}, text.slice(0, i), h('mark', {}, text.slice(i, i + ql.length)), text.slice(i + ql.length)); };
      function renderList() {
        listEl.innerHTML = '';
        const ql = fold(q.value.trim());
        const items = notes.filter((n) => (ql ? !n.deletedAt : inFolder(n)) && (!ql || fold(plain(n.body)).includes(ql)))
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (sortBy === 'title' ? titleOf(a).localeCompare(titleOf(b)) : b.mtime - a.mtime));
        const fname = folder === 'all' ? T('All Notes') : folder === 'notes' ? T('Notes') : folder === 'deleted' ? T('Recently Deleted') : folder.startsWith('tag:') ? '#' + folder.slice(4) : (folders.find((f) => f.id === folder) || {}).name;
        listHead.innerHTML = '';
        listHead.append(h('b', {}, ql ? T('Results') : fname), h('small', {}, items.length + ' ' + T(items.length === 1 ? 'note' : 'notes')), h('button', { class: 'tbtn nl-sort', title: T('Sort by'), onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ label: T('Date Edited'), checked: sortBy === 'date', action: () => { sortBy = 'date'; PatOS.store.set('noteSort', sortBy); renderList(); } }, { label: T('Title'), checked: sortBy === 'title', action: () => { sortBy = 'title'; PatOS.store.set('noteSort', sortBy); renderList(); } }], r.left, r.bottom + 4); } }, '⇅'));
        let section = '';
        items.forEach((n) => {
          const age = Date.now() - n.mtime; const sec = n.pinned && !ql ? T('Pinned') : age < DAY ? T('Today') : age < 7 * DAY ? T('Previous 7 Days') : T('Earlier');
          if (sortBy === 'date' && sec !== section) { section = sec; listEl.appendChild(h('div', { class: 'nl-sec' }, sec)); }
          const lines = textOut(n.body).trim().split('\n').filter((l) => l.trim());
          // with a search, show the line that matches
          let second = lines[1] || T('No additional text');
          if (ql) { const hit = lines.find((l, k) => k > 0 && fold(l).includes(ql)); if (hit) second = hit; }
          const img = (/<img[^>]+src="([^"]+)"/.exec(n.body) || [])[1];
          const box = document.createElement('div'); box.innerHTML = n.body; const all = box.querySelectorAll('.nt-chk').length, done = box.querySelectorAll('.nt-chk.done').length;
          const el = h('div', { class: 'nt-item' + (cur && cur.id === n.id ? ' on' : '') + (n.pinned ? ' pinned' : ''), draggable: 'true', role: 'button', tabindex: '0' },
            h('div', { class: 'nt-txt' }, h('b', {}, markText(titleOf(n), ql)), h('div', {}, h('span', {}, new Date(n.mtime).toLocaleDateString(PatOS.locale, age < DAY ? undefined : { month: 'short', day: 'numeric' })), ' ', markText(second.slice(0, 70), ql)),
              all ? h('small', { class: 'nt-prog' + (done === all ? ' full' : '') }, done + '/' + all + ' ' + T('done')) : null),
            img ? h('img', { class: 'nt-thumb', src: img, alt: '' }) : null);
          el.onclick = () => open(n); el.onkeydown = (e) => { if (e.key === 'Enter') open(n); };
          el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/note', n.id));
          el.oncontextmenu = (e) => {
            e.preventDefault();
            if (n.deletedAt) return PatOS.menu([{ label: T('Recover'), action: () => { delete n.deletedAt; save(); render(true); } }, { label: T('Delete Immediately'), action: () => { notes = notes.filter((x) => x !== n); save(); if (cur === n) cur = null; render(); } }], e.clientX, e.clientY);
            PatOS.menu([{ label: T(n.pinned ? 'Unpin' : 'Pin to top'), action: () => { n.pinned = !n.pinned; save(); renderList(); } },
              { header: T('Move to') }, { label: T('Notes'), checked: !n.folder, action: () => { n.folder = null; save(); render(true); } }, ...folders.map((f) => ({ label: f.name, checked: n.folder === f.id, action: () => { n.folder = f.id; save(); render(true); } })),
              { divider: true }, { label: T('Delete'), action: () => del(n) }], e.clientX, e.clientY);
          };
          listEl.appendChild(el);
        });
        if (!items.length) listEl.appendChild(h('div', { class: 'nl-empty' }, ql ? T('No notes match your search.') : folder === 'deleted' ? T('Nothing here. Deleted notes stay for 30 days.') : T('No notes yet')));
      }

      /* ---------- the note ---------- */
      function updateMeta() {
        if (!cur) return;
        const words = (plain(cur.body).match(/[\p{L}\p{N}'’-]+/gu) || []).length;
        meta.textContent = new Date(cur.mtime).toLocaleString(PatOS.locale, { dateStyle: 'long', timeStyle: 'short' }) + ' · ' + words + ' ' + T(words === 1 ? 'word' : 'words') + (cur.deletedAt ? ' · ' + T('In Recently Deleted') : '');
      }
      function open(n) {
        cur = n;
        const up = upgrade(n.body); if (up !== n.body) { n.body = up; save(); }
        ed.innerHTML = n.body; ed.contentEditable = n.deletedAt ? 'false' : 'true';
        updateMeta();
        empty.style.display = 'none'; ed.style.display = ''; meta.style.display = '';
        renderList(); highlightSearch();
      }
      function showEmpty() { cur = null; ed.style.display = 'none'; meta.style.display = 'none'; empty.style.display = ''; empty.textContent = T('No note selected'); }
      function del(n) {
        if (n.deletedAt) { notes = notes.filter((x) => x !== n); } else { n.deletedAt = Date.now(); n.pinned = false; }
        save(); PatOS.sound.trash();
        const next = notes.filter(inFolder).sort((a, b) => b.mtime - a.mtime)[0];
        if (cur === n) { if (next) open(next); else showEmpty(); } render(true);
      }
      function create() {
        if (folder === 'deleted') folder = 'all';
        const tag = folder.startsWith('tag:') ? folder.slice(4) : null;
        const n = { id: PatOS.uid(), title: '', body: tag ? '<div><br></div><div><br></div><div>#' + tag + '</div>' : '<div><br></div>', mtime: Date.now(), folder: ['all', 'notes'].includes(folder) || tag ? null : folder };
        notes.unshift(n); save(); open(n); render(true); ed.focus();
        const r = document.createRange(); r.setStart(ed.firstChild, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      }
      const refreshSoon = PatOS.debounce(() => { renderList(); renderFolders(); }, 250);
      function onInput() { if (!cur || cur.deletedAt) return; cur.body = ed.innerHTML; cur.mtime = Date.now(); cur.title = titleOf(cur); save(); updateMeta(); refreshSoon(); }

      /* ---------- checklists ---------- */
      const blockOf = (node) => { while (node && node.parentNode !== ed) node = node.parentNode; return node && node.nodeType === 1 ? node : null; };
      function toggleChecklist() {
        if (!cur || cur.deletedAt) return;
        ed.focus();
        const sel = getSelection(); if (!sel.rangeCount) return;
        let a = blockOf(sel.getRangeAt(0).startContainer), b = blockOf(sel.getRangeAt(0).endContainer);
        if (!a) { document.execCommand('formatBlock', false, 'div'); a = b = blockOf(getSelection().getRangeAt(0).startContainer); }
        if (!a) return;
        const blocks = []; for (let n = a; n; n = n.nextElementSibling) { blocks.push(n); if (n === b) break; }
        const turnOn = !blocks.every((x) => x.classList.contains('nt-chk'));
        blocks.forEach((x) => { if (x.tagName !== 'DIV') return; if (turnOn) x.classList.add('nt-chk'); else x.classList.remove('nt-chk', 'done'); if (!x.className) x.removeAttribute('class'); });
        onInput();
      }
      function sinkChecked() {
        // checked items move below the unchecked ones in each checklist
        const kids = [...ed.children]; let i = 0;
        while (i < kids.length) {
          if (!kids[i].classList.contains('nt-chk')) { i++; continue; }
          let j = i; while (j < kids.length && kids[j].classList.contains('nt-chk')) j++;
          const run = kids.slice(i, j); const anchor = kids[j] || null;
          [...run.filter((x) => !x.classList.contains('done')), ...run.filter((x) => x.classList.contains('done'))].forEach((x) => ed.insertBefore(x, anchor));
          i = j;
        }
        onInput();
      }
      // a click on the circle checks the item
      ed.addEventListener('mousedown', (e) => {
        const it = e.target.closest && e.target.closest('.nt-chk'); if (!it || ed.contentEditable !== 'true') return;
        const r = it.getBoundingClientRect(); if (e.clientX - r.left > 26) return;
        e.preventDefault(); it.classList.toggle('done'); PatOS.sound.click(); onInput();
      });
      ed.addEventListener('keydown', (e) => {
        const sel = getSelection(); if (!sel.rangeCount) return; const blk = blockOf(sel.anchorNode);
        if (blk && blk.classList.contains('nt-chk')) {
          const textEmpty = !blk.textContent.trim();
          if (e.key === 'Enter' && !e.shiftKey && textEmpty) { e.preventDefault(); blk.classList.remove('nt-chk', 'done'); if (!blk.className) blk.removeAttribute('class'); onInput(); return; }
          if (e.key === 'Enter' && !e.shiftKey) { setTimeout(() => { const nb = blockOf(getSelection().anchorNode); if (nb && nb !== blk) { nb.classList.add('nt-chk'); nb.classList.remove('done'); onInput(); } }, 0); return; }
          if (e.key === 'Backspace' && sel.isCollapsed) { const r = document.createRange(); r.selectNodeContents(blk); r.setEnd(sel.anchorNode, sel.anchorOffset); if (!r.toString().length) { e.preventDefault(); blk.classList.remove('nt-chk', 'done'); if (!blk.className) blk.removeAttribute('class'); onInput(); return; } }
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); toggleChecklist(); }
      });

      /* ---------- pictures and drawings ---------- */
      function insertImage(url, cls) { ed.focus(); document.execCommand('insertHTML', false, '<img class="' + (cls || '') + '" src="' + url + '" alt=""><div><br></div>'); onInput(); }
      function readImage(file) {
        const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 900 / img.width); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); insertImage(c.toDataURL(/png|gif/.test(file.type) ? 'image/png' : 'image/jpeg', 0.85)); }; img.src = r.result; }; r.readAsDataURL(file);
      }
      function drawing() {
        if (!cur || cur.deletedAt) return;
        const sel = getSelection(); const keep = sel.rangeCount && ed.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
        const W = 720, H = 420; const dpr = Math.min(2, devicePixelRatio || 1);
        const cv = h('canvas', { class: 'nd-canvas', width: W * dpr, height: H * dpr, style: { width: W + 'px', height: H + 'px' } });
        const x = cv.getContext('2d'); x.scale(dpr, dpr); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.lineCap = x.lineJoin = 'round';
        let pen = '#1d1d1f', size = 3, eraser = false; const history = [];
        const colors = ['#1d1d1f', '#0a84ff', '#ff3b30', '#30d158', '#ff9f0a', '#bf5af2'];
        const swatches = colors.map((c, i) => { const b = h('button', { class: 'nd-sw' + (i === 0 ? ' on' : ''), style: { background: c }, 'aria-label': c }); b.onclick = () => { pen = c; eraser = false; swatches.forEach((s) => s.classList.toggle('on', s === b)); bEr.classList.remove('on'); }; return b; });
        const sizes = [2, 4, 8].map((s, i) => { const b = h('button', { class: 'nd-size' + (i === 0 ? ' on' : '') }, h('i', { style: { width: s + 3 + 'px', height: s + 3 + 'px' } })); b.onclick = () => { size = s; sizes.forEach((z) => z.classList.toggle('on', z === b)); }; return b; });
        const bEr = h('button', { class: 'btn nd-er' }, T('Eraser')); bEr.onclick = () => { eraser = !eraser; bEr.classList.toggle('on', eraser); };
        const bUndo = h('button', { class: 'btn' }, T('Undo')); bUndo.onclick = () => { const s = history.pop(); if (s) x.putImageData(s, 0, 0); };
        const bClear = h('button', { class: 'btn' }, T('Clear')); bClear.onclick = () => { history.push(x.getImageData(0, 0, cv.width, cv.height)); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.restore(); };
        let drawn = false;
        cv.addEventListener('pointerdown', (e) => {
          cv.setPointerCapture(e.pointerId); history.push(x.getImageData(0, 0, cv.width, cv.height)); if (history.length > 30) history.shift();
          const r = cv.getBoundingClientRect(); let lx = e.clientX - r.left, ly = e.clientY - r.top;
          const line = (nx, ny, pr) => { x.strokeStyle = eraser ? '#fff' : pen; x.lineWidth = (eraser ? size * 4 : size) * (pr ? 0.6 + pr : 1); x.beginPath(); x.moveTo(lx, ly); x.lineTo(nx, ny); x.stroke(); lx = nx; ly = ny; drawn = true; };
          line(lx + 0.01, ly, e.pressure);
          const mv = (ev) => (ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]).forEach((c) => line(c.clientX - r.left, c.clientY - r.top, c.pointerType === 'pen' ? c.pressure : 0));
          const up = () => { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); };
          cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
        });
        const layer = h('div', { class: 'nd-layer' });
        const close = () => layer.remove();
        const bIns = h('button', { class: 'btn primary' }, T('Insert Drawing'));
        bIns.onclick = () => {
          close(); if (!drawn) return;
          if (keep) { const s = getSelection(); s.removeAllRanges(); s.addRange(keep); } else { ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
          insertImage(cv.toDataURL('image/png'), 'nt-drawing');
        };
        layer.appendChild(h('div', { class: 'nd-box', role: 'dialog', 'aria-label': T('Drawing') },
          h('div', { class: 'nd-bar' }, ...swatches, h('span', { class: 'nd-gap' }), ...sizes, h('span', { class: 'nd-gap' }), bEr, bUndo, bClear),
          h('div', { class: 'nd-wrap' }, cv),
          h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), bIns)));
        layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
        win.body.appendChild(layer);
      }
      function printNote(n) {
        const fr = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' }, 'aria-hidden': 'true' });
        document.body.appendChild(fr);
        const d = fr.contentDocument;
        d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"><title>' + titleOf(n).replace(/[<&]/g, '') + '</title><style>body{font:15px/1.55 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;color:#111;margin:32px}img{max-width:100%;border-radius:6px}table{border-collapse:collapse}td{border:1px solid #bbb;padding:4px 8px;min-width:60px}body>div:first-child{font-size:22px;font-weight:700}</style></head><body>' + exportHTML(n.body) + '</body></html>'); d.close();
        setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} setTimeout(() => fr.remove(), 60000); }, 300);
      }

      /* ---------- search highlights inside the open note (nothing is written into the note) ---------- */
      function highlightSearch() {
        if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
        CSS.highlights.delete('nt-search');
        const ql = fold(q.value.trim()); if (!ql || !cur) return;
        const ranges = []; const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let tn;
        while ((tn = w.nextNode())) { const f = fold(tn.textContent); if (f.length !== tn.textContent.length) continue; let i = f.indexOf(ql); while (i >= 0 && ranges.length < 200) { const r = new Range(); r.setStart(tn, i); r.setEnd(tn, i + ql.length); ranges.push(r); i = f.indexOf(ql, i + ql.length); } }
        if (ranges.length) CSS.highlights.set('nt-search', new Highlight(...ranges));
      }

      ed.addEventListener('input', onInput);
      ed.addEventListener('paste', (e) => { const it = [...((e.clipboardData || {}).items || [])].find((x) => x.type.startsWith('image/')); if (it) { e.preventDefault(); readImage(it.getAsFile()); } });
      ed.addEventListener('drop', (e) => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) { e.preventDefault(); readImage(f); } });
      q.addEventListener('input', () => { renderList(); highlightSearch(); });
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = listEl.querySelector('.nt-item'); if (first) first.click(); } if (e.key === 'Escape') { q.value = ''; renderList(); highlightSearch(); } });
      win.el.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f' && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); } });
      win.on('closed', () => { if (window.CSS && CSS.highlights) CSS.highlights.delete('nt-search'); PatOS.store.set('notes', notes); });
      function render(keepCur) { renderFolders(); renderList(); if (!keepCur && !cur) { const first = notes.filter(inFolder).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.mtime - a.mtime)[0]; if (first) open(first); else showEmpty(); } }
      win._openNote = (id) => { const n = notes.find((x) => x.id === id); if (n) { folder = 'all'; open(n); render(true); } };
      const first = args.id ? notes.find((n) => n.id === args.id) : null;
      if (first) { open(first); render(true); } else render();
    },
    onArgs(win, args) { if (args.id) win._openNote(args.id); }
  });
})();
