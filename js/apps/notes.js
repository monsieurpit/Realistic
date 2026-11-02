/* Notes */
(function () {
  'use strict';
  const { h } = PatOS;
  const load = () => PatOS.store.get('notes', null) || [
    { id: 'n1', title: 'Welcome to Notes', body: '<div><b>Welcome to Notes</b></div><div>Your notes save automatically.</div><div><br></div><div>• Use the toolbar for <b>bold</b>, <i>italic</i> and checklists</div><div>• Search with the box on the left</div>', mtime: Date.now(), pinned: true },
    { id: 'n2', title: 'Shopping list', body: '<div>Shopping list</div><div>☐ Pencils</div><div>☐ Binder</div><div>☐ Snacks</div>', mtime: Date.now() - 86400000 }
  ];
  const plain = (html) => { const t = document.createElement('textarea'); t.innerHTML = html.replace(/<(div|br|p|h\d|li)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''); return t.value.replace(/^\n+/, ''); };
  PatOS.registerApp({
    id: 'notes', name: 'Notes', icon: 'notes', width: 820, height: 540, keywords: 'note write memo',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let notes = load(); let cur = null;
      const save = PatOS.debounce(() => PatOS.store.set('notes', notes), 300);
      const list = h('div', { class: 'nt-list' });
      const q = h('input', { class: 'field', placeholder: 'Search', style: { width: '100%' } });
      const side = h('div', { class: 'notes-side' }, h('div', { class: 'notes-search' }, q), list);
      const ed = h('div', { class: 'notes-ed', contenteditable: 'true', spellcheck: 'true' });
      const meta = h('div', { class: 'notes-meta' });
      win.body.append(h('div', { class: 'notes-wrap' }, side, h('div', { class: 'notes-main' }, meta, ed)));
      const fmt = (cmd, val) => () => { ed.focus(); document.execCommand(cmd, false, val); };
      const bNew = h('button', { class: 'tbtn', title: 'New note', html: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z M14 6l4 4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>' });
      const bDel = h('button', { class: 'tbtn', title: 'Delete note', html: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>' });
      const bB = h('button', { class: 'tbtn', title: 'Bold', onclick: fmt('bold') }, h('b', {}, 'B'));
      const bI = h('button', { class: 'tbtn', title: 'Italic', onclick: fmt('italic') }, h('i', {}, 'I'));
      const bU = h('button', { class: 'tbtn', title: 'Underline', onclick: fmt('underline') }, h('u', {}, 'U'));
      const bH = h('button', { class: 'tbtn', title: 'Heading', onclick: fmt('formatBlock', 'h2') }, 'Aa');
      const bL = h('button', { class: 'tbtn', title: 'Bulleted list', onclick: fmt('insertUnorderedList') }, '☰');
      const bC = h('button', { class: 'tbtn', title: 'Checkbox', onclick: () => { ed.focus(); document.execCommand('insertText', false, '☐ '); } }, '☑');
      win.toolbar.append(bNew, h('div', { style: { width: '12px' } }), bH, bB, bI, bU, bL, bC, h('div', { style: { flex: 1 } }), bDel);
      win.toolbar.style.paddingLeft = '200px';

      function titleOf(n) { const t = plain(n.body).trim().split('\n')[0]; return t.slice(0, 60) || 'New Note'; }
      function renderList() {
        list.innerHTML = '';
        const ql = q.value.toLowerCase();
        notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.mtime - a.mtime)
          .filter((n) => !ql || plain(n.body).toLowerCase().includes(ql))
          .forEach((n) => {
            const text = plain(n.body).trim().split('\n');
            const el = h('div', { class: 'nt-item' + (cur && cur.id === n.id ? ' on' : '') },
              h('b', {}, (n.pinned ? '📌 ' : '') + titleOf(n)),
              h('div', {}, h('span', {}, new Date(n.mtime).toLocaleDateString()), ' ', (text[1] || 'No additional text').slice(0, 40)));
            el.onclick = () => open(n);
            el.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: n.pinned ? 'Unpin' : 'Pin to top', action: () => { n.pinned = !n.pinned; save(); renderList(); } }, { label: 'Export as .txt to Documents', action: () => { const nm = PatOS.fs.uniqueName('/Documents', titleOf(n).replace(/[\/]/g, '-') + '.txt'); PatOS.fs.write('/Documents/' + nm, plain(n.body)); PatOS.notify({ title: 'Exported', body: nm + ' saved in Documents', icon: 'notes' }); } }, { divider: true }, { label: 'Delete', action: () => del(n) }], e.clientX, e.clientY); };
            list.appendChild(el);
          });
      }
      function open(n) {
        cur = n; ed.innerHTML = n.body; meta.textContent = new Date(n.mtime).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
        n.title = titleOf(n);
        renderList();
      }
      function del(n) { notes = notes.filter((x) => x !== n); save(); if (cur === n) { cur = null; notes[0] ? open(notes[0]) : create(); } else renderList(); }
      function create() { const n = { id: PatOS.uid(), title: '', body: '<div><br></div>', mtime: Date.now() }; notes.unshift(n); save(); open(n); ed.focus(); }
      ed.addEventListener('input', () => { if (!cur) return; cur.body = ed.innerHTML; cur.mtime = Date.now(); cur.title = titleOf(cur); save(); renderList(); });
      ed.addEventListener('click', (e) => {
        // toggle checkboxes by clicking on them
        const sel = window.getSelection(); if (!sel.rangeCount) return;
        const node = sel.anchorNode; if (!node || node.nodeType !== 3) return;
        const i = sel.anchorOffset; const t = node.textContent;
        for (const j of [i - 1, i]) {
          if (t[j] === '☐' || t[j] === '☑') { node.textContent = t.slice(0, j) + (t[j] === '☐' ? '☑' : '☐') + t.slice(j + 1); ed.dispatchEvent(new Event('input')); break; }
        }
      });
      q.addEventListener('input', renderList);
      bNew.onclick = create; bDel.onclick = () => cur && del(cur);
      win._openNote = (id) => { const n = notes.find((x) => x.id === id); if (n) open(n); };
      const first = args.id ? notes.find((n) => n.id === args.id) : null;
      open(first || notes.sort((a, b) => b.mtime - a.mtime)[0] || (create(), notes[0]));
    },
    onArgs(win, args) { if (args.id) win._openNote(args.id); }
  });
})();
