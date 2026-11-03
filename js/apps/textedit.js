/* TextEdit — plain text / code editor */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'textedit', name: 'TextEdit', icon: 'textedit', single: false, width: 700, height: 520, keywords: 'text editor write code',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let path = args.path || null; let dirty = false;
      // untitled text is kept as a draft, so it comes back after a reload or a crash
      let draft = !path && args.draft ? String(args.draft) : null;
      const DK = () => 'teDraft:' + draft;
      const saveDraft = PatOS.debounce(() => { if (path) return; if (!ta.value.trim()) { if (draft) PatOS.store.remove(DK()); return; } if (!draft) { draft = PatOS.uid(); PatOS.remember && PatOS.remember(win, { draft }); } PatOS.store.set(DK(), ta.value); }, 500);
      const dropDraft = () => { if (draft) { PatOS.store.remove(DK()); draft = null; } };
      let size = PatOS.store.get('teSize', 15); let mono = false;
      const ta = h('textarea', { class: 'te-area', spellcheck: 'true', placeholder: 'Start typing…' });
      const status = h('div', { class: 'te-status' });
      win.body.append(ta, status);
      const nameEl = h('div', { class: 'te-name' });
      const bSave = h('button', { class: 'tbtn', title: 'Save' }, '💾');
      const bSmall = h('button', { class: 'tbtn', title: 'Smaller' }, 'A−');
      const bBig = h('button', { class: 'tbtn', title: 'Bigger' }, 'A+');
      const bMono = h('button', { class: 'tbtn', title: 'Code font' }, '{ }');
      const bPrev = h('button', { class: 'tbtn', title: 'Preview HTML in Patoogle' }, '▶');
      const bDl = h('button', { class: 'tbtn', title: 'Download to computer' }, '⬇');
      win.toolbar.append(nameEl, h('div', { style: { flex: 1 } }), bSmall, bBig, bMono, bPrev, bDl, bSave);
      win.toolbar.style.paddingLeft = '70px';

      function apply() { ta.style.fontSize = size + 'px'; ta.classList.toggle('mono', mono); }
      function label() {
        const n = path ? PatOS.fs.basename(path) : 'Untitled';
        nameEl.textContent = n + (dirty ? ' — Edited' : '');
        win.setTitle(n);
        const words = (ta.value.match(/\S+/g) || []).length;
        status.textContent = words + ' words · ' + ta.value.length + ' characters' + (path ? ' · ' + PatOS.fs.dirname(path) : '');
        bPrev.style.display = path && /\.html?$/i.test(path) ? '' : 'none';
      }
      function load(p) {
        path = p; PatOS.remember && PatOS.remember(win, { path: p }); const c = PatOS.fs.read(p); ta.value = c == null ? '' : c; dirty = false;
        mono = /\.(js|css|html?|json|py|md)$/i.test(p); apply(); label();
      }
      async function save(as) {
        if (!path || as) {
          const nm = await PatOS.ask('Save As', path ? PatOS.fs.basename(path) : 'Untitled.txt', { icon: 'textedit', text: 'The file is saved in Documents.', ok: 'Save' });
          if (!nm) return false;
          path = nm.includes('/') ? PatOS.fs.norm(nm) : '/Documents/' + nm;
        }
        try { PatOS.fs.write(path, ta.value); dirty = false; dropDraft(); PatOS.remember && PatOS.remember(win, { path }); label(); return true; }
        catch (e) { PatOS.notify({ title: 'Could not save', body: e.message, icon: 'textedit' }); return false; }
      }
      ta.addEventListener('input', () => { dirty = true; label(); if (path) autosave(); else saveDraft(); });
      const autosave = PatOS.debounce(() => { if (path && dirty) save(); }, 1200);
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
        if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(e.shiftKey); }
      });
      bSave.onclick = () => save();
      bSmall.onclick = () => { size = Math.max(10, size - 1); PatOS.store.set('teSize', size); apply(); };
      bBig.onclick = () => { size = Math.min(40, size + 1); PatOS.store.set('teSize', size); apply(); };
      bMono.onclick = () => { mono = !mono; apply(); };
      bPrev.onclick = () => PatOS.launch('browser', { html: ta.value, title: PatOS.fs.basename(path) });
      bDl.onclick = () => PatOS.downloadFile(path ? PatOS.fs.basename(path) : 'Untitled.txt', ta.value);
      let closing = false;
      win.on('beforeclose', (ev) => { if (!closing && dirty && !path && ta.value.trim()) { ev.cancel(); PatOS.confirmBox('Close without saving?', 'Your text will be lost.', { ok: 'Close', danger: true, icon: 'textedit' }).then((y) => { if (y) { closing = true; win.close(); } }); } });
      // closed on purpose: the draft isn't needed any more (a reload or a crash never gets here)
      win.on('closed', () => { if (closing || !ta.value.trim() || path) dropDraft(); });
      win._save = save;
      if (path) load(path); else { if (draft) { const t = PatOS.store.get(DK(), null); if (t != null) { ta.value = t; dirty = true; } else draft = null; } apply(); label(); }
      setTimeout(() => ta.focus(), 50);
    },
    menus(win) {
      return { file: [
        { label: 'New Document', shortcut: 'Alt+N', action: () => PatOS.launch('textedit') },
        { label: 'Open…', action: () => PatOS.launch('finder', { path: '/Documents' }) },
        { divider: true },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => win._save() },
        { label: 'Save As…', action: () => win._save(true) },
        { divider: true },
        { label: 'Close', shortcut: 'Alt+W', action: () => win.close() }
      ] };
    }
  });
})();
