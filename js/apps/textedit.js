/* TextEdit — plain text and code editor.
   Find & Replace (Ctrl+F, Ctrl+H), line and column, word wrap, smart indent for code (Enter keeps the
   indent, Tab / Shift+Tab move the selected lines), a Markdown preview for .md files, recent files,
   print, and untitled text kept as a draft so it survives a reload or a crash. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const svg = (d) => `<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const IC = {
    open: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    save: svg('<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
    find: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
    wrap: svg('<path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M4 18h5"/><path d="M14 16l-2 2 2 2"/>'),
    eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    code: svg('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>'),
    down: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    print: svg('<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>'),
    play: svg('<path d="M7 5l12 7-12 7z"/>')
  };
  const CODE = /\.(js|mjs|ts|css|html?|json|py|md|xml|svg|sh|c|cpp|h|java|rb|go|rs|php|sql|yml|yaml|toml|ini|csv)$/i;
  const recent = () => PatOS.store.get('teRecent', []).filter((p) => PatOS.fs.exists(p));
  const addRecent = (p) => PatOS.store.set('teRecent', [p, ...recent().filter((x) => x !== p)].slice(0, 10));

  /* a small Markdown reader: headings, bold, italic, code, links, lists, quotes, rules, code blocks */
  function markdown(src) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (m, a, b) => '<b>' + (a || b) + '</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const out = []; let list = null, code = null, para = [];
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
    for (const line of String(src).split('\n')) {
      if (code !== null) { if (/^```/.test(line)) { out.push('<pre><code>' + esc(code) + '</code></pre>'); code = null; } else code += (code ? '\n' : '') + line; continue; }
      if (/^```/.test(line)) { flushPara(); flushList(); code = ''; continue; }
      let m;
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flushPara(); flushList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
      else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); }
      else if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); }
      else if ((m = line.match(/^\s*[-*+]\s+(\[( |x)\]\s+)?(.*)$/i))) { flushPara(); if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + (m[1] ? '<input type="checkbox" disabled' + (m[2] !== ' ' ? ' checked' : '') + '> ' : '') + inline(m[3]) + '</li>'); }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); }
      else if (!line.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(line); }
    }
    if (code !== null) out.push('<pre><code>' + esc(code) + '</code></pre>');
    flushPara(); flushList();
    return PatOS.sanitize(out.join('\n'));
  }
  PatOS.markdown = markdown;

  PatOS.registerApp({
    id: 'textedit', name: 'TextEdit', icon: 'textedit', single: false, width: 760, height: 540, keywords: 'text editor write code notepad markdown',
    about: 'Write text and code, with find and replace and a Markdown preview.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let path = args.path || null; let dirty = false;
      // untitled text is kept as a draft, so it comes back after a reload or a crash
      let draft = !path && args.draft ? String(args.draft) : null;
      const DK = () => 'teDraft:' + draft;
      const saveDraft = PatOS.debounce(() => { if (path) return; if (!ta.value.trim()) { if (draft) PatOS.store.remove(DK()); return; } if (!draft) { draft = PatOS.uid(); PatOS.remember && PatOS.remember(win, { draft }); } PatOS.store.set(DK(), ta.value); }, 500);
      const dropDraft = () => { if (draft) { PatOS.store.remove(DK()); draft = null; } };
      let size = PatOS.store.get('teSize', 15); let mono = false; let wrap = PatOS.store.get('teWrap', true); let preview = false;

      const ta = h('textarea', { class: 'te-area', spellcheck: 'true', placeholder: T('Start typing…'), 'aria-label': T('Text') });
      const pv = h('div', { class: 'te-preview allow-ctx' });
      const pos = h('span', { class: 'te-pos' }); const info = h('span', { class: 'te-info' });
      const status = h('div', { class: 'te-status' }, info, h('span', { style: { flex: 1 } }), pos);
      // find & replace bar
      const fIn = h('input', { class: 'field te-fin', placeholder: T('Find'), spellcheck: 'false' });
      const rIn = h('input', { class: 'field te-fin', placeholder: T('Replace with'), spellcheck: 'false' });
      const fCount = h('span', { class: 'te-fcount' });
      const fCase = h('label', { class: 'te-fopt' }, h('input', { type: 'checkbox' }), 'Aa');
      const findBar = h('div', { class: 'te-find hidden' },
        fIn, h('button', { class: 'btn sm', title: T('Previous'), onclick: () => findStep(-1) }, '‹'), h('button', { class: 'btn sm', title: T('Next'), onclick: () => findStep(1) }, '›'), fCount, fCase,
        h('span', { class: 'te-rep' }, rIn, h('button', { class: 'btn sm', onclick: () => replaceOne() }, T('Replace')), h('button', { class: 'btn sm', onclick: () => replaceAll() }, T('Replace All'))),
        h('button', { class: 'tbtn te-fx', title: T('Close'), onclick: () => showFind(false) }, '×'));
      win.body.append(findBar, h('div', { class: 'te-stage' }, ta, pv), status);

      const nameEl = h('div', { class: 'te-name' });
      const tb = (ic, title, fn) => { const b = h('button', { class: 'tbtn', title: T(title), 'aria-label': T(title), html: IC[ic] }); b.onclick = fn; return b; };
      const bOpen = tb('open', 'Open…', () => openMenu(bOpen));
      const bFind = tb('find', 'Find and Replace', () => showFind(findBar.classList.contains('hidden')));
      const bSmall = h('button', { class: 'tbtn', title: T('Smaller text') }, 'A−');
      const bBig = h('button', { class: 'tbtn', title: T('Bigger text') }, 'A+');
      const bWrap = tb('wrap', 'Wrap long lines', () => { wrap = !wrap; PatOS.store.set('teWrap', wrap); apply(); });
      const bMono = tb('code', 'Code font', () => { mono = !mono; apply(); });
      const bPrev = tb('play', 'Preview HTML in Patoogle', () => PatOS.launch('browser', { html: ta.value, title: PatOS.fs.basename(path) }));
      const bMd = tb('eye', 'Markdown preview', () => { preview = !preview; apply(); });
      const bDl = tb('down', 'Download to computer', () => PatOS.downloadFile(path ? PatOS.fs.basename(path) : T('Untitled') + '.txt', ta.value));
      const bSave = tb('save', 'Save', () => save());
      win.toolbar.append(nameEl, h('div', { style: { flex: 1 } }), bOpen, bFind, bSmall, bBig, bWrap, bMono, bMd, bPrev, bDl, bSave);
      win.toolbar.style.paddingLeft = '70px';

      function apply() {
        ta.style.fontSize = size + 'px'; ta.classList.toggle('mono', mono); ta.classList.toggle('nowrap', !wrap); ta.wrap = wrap ? 'soft' : 'off';
        bWrap.classList.toggle('on', wrap); bMono.classList.toggle('on', mono); bMd.classList.toggle('on', preview);
        const md = !!path && /\.(md|markdown)$/i.test(path);
        bMd.style.display = md ? '' : 'none'; if (!md) preview = false;
        win.body.classList.toggle('te-split', preview);
        if (preview) pv.innerHTML = markdown(ta.value);
      }
      function label() {
        const n = path ? PatOS.fs.basename(path) : T('Untitled');
        nameEl.textContent = n + (dirty ? ' — ' + T('Edited') : '');
        win.setTitle(n);
        const v = ta.value, words = (v.match(/\S+/g) || []).length;
        const sel = Math.abs(ta.selectionEnd - ta.selectionStart);
        info.textContent = words + ' ' + T(words === 1 ? 'word' : 'words') + ' · ' + v.length + ' ' + T('characters') + (sel ? ' · ' + sel + ' ' + T('selected') : '') + (path ? ' · ' + PatOS.fs.dirname(path) : '');
        bPrev.style.display = path && /\.html?$/i.test(path) ? '' : 'none';
        caret();
      }
      function caret() {
        const before = ta.value.slice(0, ta.selectionStart); const line = before.split('\n').length; const col = before.length - before.lastIndexOf('\n');
        pos.textContent = T('Line') + ' ' + line + ', ' + T('Col') + ' ' + col;
      }
      function load(p) {
        const c = PatOS.fs.read(p);
        path = p; PatOS.remember && PatOS.remember(win, { path: p }); addRecent(p);
        ta.value = c == null ? '' : c; dirty = false;
        mono = CODE.test(p) && !/\.md$/i.test(p); preview = /\.(md|markdown)$/i.test(p) && ta.value.trim().length > 0 && PatOS.store.get('teMdPreview', true);
        apply(); label(); ta.setSelectionRange(0, 0); ta.scrollTop = 0;
      }
      async function save(as) {
        if (!path || as) {
          const nm = await PatOS.ask(T('Save As'), path ? PatOS.fs.basename(path) : T('Untitled') + '.txt', { icon: 'textedit', text: T('The file is saved in Documents. Type a folder too, like /Desktop/notes.txt'), ok: T('Save') });
          if (!nm) return false;
          let np = nm.includes('/') ? PatOS.fs.norm(nm) : '/Documents/' + nm;
          if (!/\.[a-z0-9]{1,6}$/i.test(np)) np += '.txt';
          if (PatOS.fs.exists(np) && np !== path && !(await PatOS.confirmBox(T('Replace the existing file?'), '“' + PatOS.fs.basename(np) + '” ' + T('already exists in that folder.'), { ok: T('Replace'), danger: true, icon: 'textedit' }))) return false;
          path = np;
        }
        try { PatOS.fs.write(path, ta.value); dirty = false; dropDraft(); addRecent(path); PatOS.remember && PatOS.remember(win, { path }); apply(); label(); return true; }
        catch (e) { PatOS.notify({ title: T('Could not save'), body: e.message, icon: 'textedit' }); return false; }
      }
      const autosave = PatOS.debounce(() => { if (path && dirty) save(); }, 1200);
      const livePreview = PatOS.debounce(() => { if (preview) pv.innerHTML = markdown(ta.value); }, 200);
      ta.addEventListener('input', () => { dirty = true; label(); livePreview(); if (path) autosave(); else saveDraft(); if (!findBar.classList.contains('hidden')) countMatches(); });
      ['keyup', 'click', 'select'].forEach((ev) => ta.addEventListener(ev, label));

      /* ---------- smart editing ---------- */
          // typed through the browser so Undo keeps working; the text area must have the focus for that
      const insert = (text) => { if (document.activeElement !== ta) ta.focus({ preventScroll: true }); if (!document.execCommand('insertText', false, text)) { const a = ta.selectionStart, b = ta.selectionEnd; ta.setRangeText(text, a, b, 'end'); ta.dispatchEvent(new Event('input')); } };
      function lineRange() { const v = ta.value; const s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1; let e = v.indexOf('\n', ta.selectionEnd - (ta.selectionEnd > ta.selectionStart && v[ta.selectionEnd - 1] === '\n' ? 1 : 0)); if (e < 0) e = v.length; return [s, e]; }
      function indentLines(back) {
        const [s, e] = lineRange(); const block = ta.value.slice(s, e);
        const out = block.split('\n').map((l) => (back ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l)).join('\n');
        ta.setSelectionRange(s, e); insert(out); ta.setSelectionRange(s, s + out.length);
      }
      ta.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (e.key === 'Tab') { e.preventDefault(); if (e.shiftKey || ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n')) indentLines(e.shiftKey); else insert('  '); return; }
        if (e.key === 'Enter' && mono && !e.shiftKey && !e.ctrlKey) {
          const v = ta.value, s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1; const ind = (v.slice(s, ta.selectionStart).match(/^[ \t]*/) || [''])[0];
          const extra = /[{[(:]\s*$/.test(v.slice(s, ta.selectionStart)) ? '  ' : '';
          if (ind || extra) { e.preventDefault(); insert('\n' + ind + extra); }
          return;
        }
        if ((e.ctrlKey || e.altKey) && k === 's') { e.preventDefault(); save(e.shiftKey); }
        else if (e.ctrlKey && k === 'f') { e.preventDefault(); showFind(true); }
        else if (e.ctrlKey && k === 'h') { e.preventDefault(); showFind(true, true); }
        else if (e.ctrlKey && k === 'g') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
        else if (e.key === 'Escape' && !findBar.classList.contains('hidden')) { e.preventDefault(); showFind(false); }
      });

      /* ---------- find & replace ---------- */
      const flags = () => (fCase.querySelector('input').checked ? 'g' : 'gi');
      const needle = () => fIn.value ? new RegExp(fIn.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags()) : null;
      function matches() { const re = needle(); if (!re) return []; const out = []; let m; while ((m = re.exec(ta.value))) { out.push(m.index); if (out.length > 5000) break; } return out; }
      function countMatches() { const n = matches().length; fCount.textContent = fIn.value ? (n ? n + ' ' + T(n === 1 ? 'match' : 'matches') : T('Not found')) : ''; fIn.classList.toggle('bad', !!fIn.value && !n); return n; }
      function findStep(dir) {
        const list = matches(); if (!list.length) { countMatches(); return; }
        const from = dir > 0 ? ta.selectionEnd : ta.selectionStart;
        let i = dir > 0 ? list.findIndex((x) => x >= from) : list.map((x, j) => [x, j]).filter(([x]) => x < from).map(([, j]) => j).pop();
        if (i == null || i < 0) i = dir > 0 ? 0 : list.length - 1;
        ta.focus(); ta.setSelectionRange(list[i], list[i] + fIn.value.length);
        // scroll the match into view
        const lineH = parseFloat(getComputedStyle(ta).lineHeight) || size * 1.6; const line = ta.value.slice(0, list[i]).split('\n').length - 1;
        if (!wrap) ta.scrollTop = Math.max(0, line * lineH - ta.clientHeight / 2);
        fCount.textContent = (i + 1) + ' / ' + list.length; label();
      }
      function replaceOne() {
        const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
        const same = fCase.querySelector('input').checked ? sel === fIn.value : sel.toLowerCase() === fIn.value.toLowerCase();
        if (fIn.value && same) { ta.focus({ preventScroll: true }); insert(rIn.value); }
        findStep(1); countMatches();
      }
      function replaceAll() {
        const re = needle(); if (!re) return; const n = countMatches(); if (!n) return;
        const start = ta.selectionStart; ta.focus({ preventScroll: true }); ta.setSelectionRange(0, ta.value.length); insert(ta.value.replace(re, () => rIn.value)); ta.setSelectionRange(Math.min(start, ta.value.length), Math.min(start, ta.value.length));
        countMatches(); PatOS.office && PatOS.office.toast && PatOS.office.toast(win, n + ' ' + T(n === 1 ? 'replacement' : 'replacements'));
      }
      function showFind(on, rep) {
        findBar.classList.toggle('hidden', !on); bFind.classList.toggle('on', on);
        if (on) { const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd); if (sel && !sel.includes('\n')) fIn.value = sel; setTimeout(() => { (rep ? rIn : fIn).focus(); fIn.select(); }, 20); countMatches(); }
        else ta.focus();
      }
      fIn.addEventListener('input', countMatches); fCase.querySelector('input').addEventListener('change', countMatches);
      fIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') showFind(false); else if (e.ctrlKey && e.key.toLowerCase() === 'h') { e.preventDefault(); rIn.focus(); } });
      rIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } else if (e.key === 'Escape') showFind(false); });
      findBar.querySelector('.te-fopt').title = T('Match upper and lower case');

      /* ---------- open, recent, print ---------- */
      async function openPath(p) {
        if (!p || p === path) return;
        if (!path && !ta.value.trim()) { load(p); return; }
        PatOS.launch('textedit', { path: p });
      }
      function openMenu(anchor) {
        const r = anchor.getBoundingClientRect(); const rec = recent().filter((p) => p !== path);
        PatOS.menu([
          { label: T('New Document'), shortcut: 'Alt+N', action: () => PatOS.launch('textedit') },
          { label: T('Open from Files…'), action: () => PatOS.launch('finder', { path: path ? PatOS.fs.dirname(path) : '/Documents' }) },
          { label: T('Open from This Chromebook…'), action: async () => { const out = await PatOS.importFiles('/Documents', '.txt,.md,.js,.css,.html,.json,.py,.csv,text/*'); if (out && out[0]) openPath(typeof out[0] === 'string' ? out[0] : out[0].path); } },
          rec.length ? { divider: true } : null, rec.length ? { header: T('Open Recent') } : null,
          ...rec.map((p) => ({ label: PatOS.fs.basename(p), action: () => openPath(p) }))
        ], r.left - 160, r.bottom + 4);
      }
      function printText() {
        const f = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0' } }); document.body.appendChild(f);
        const title = path ? PatOS.fs.basename(path) : T('Untitled');
        const body = preview ? markdown(ta.value) : '<pre>' + PatOS.esc(ta.value) + '</pre>';
        f.contentDocument.open(); f.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>${PatOS.esc(title)}</title><style>body{font:12pt/1.55 system-ui,sans-serif;margin:2cm}pre{white-space:pre-wrap;font:${mono ? '10.5pt/1.45 ui-monospace,monospace' : 'inherit'}}</style></head><body>${body}</body></html>`); f.contentDocument.close();
        setTimeout(() => { try { f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 1000); }, 300);
      }

      bSmall.onclick = () => { size = Math.max(10, size - 1); PatOS.store.set('teSize', size); apply(); };
      bBig.onclick = () => { size = Math.min(40, size + 1); PatOS.store.set('teSize', size); apply(); };
      bMd.addEventListener('click', () => PatOS.store.set('teMdPreview', preview));
      let closing = false;
      win.on('beforeclose', (ev) => { if (!closing && dirty && !path && ta.value.trim()) { ev.cancel(); PatOS.confirmBox(T('Close without saving?'), T('Your text will be lost.'), { ok: T('Close'), danger: true, icon: 'textedit' }).then((y) => { if (y) { closing = true; win.close(); } }); } });
      // closed on purpose: the draft isn't needed any more (a reload or a crash never gets here)
      win.on('closed', () => { if (closing || !ta.value.trim() || path) dropDraft(); });
      win._te = { save, find: (rep) => showFind(true, rep), print: printText, open: openMenu, wrap: () => bWrap.click(), bigger: () => bBig.click(), smaller: () => bSmall.click(), load: openPath, get value() { return ta.value; } };
      if (path) load(path); else { if (draft) { const t = PatOS.store.get(DK(), null); if (t != null) { ta.value = t; dirty = true; } else draft = null; } apply(); label(); }
      setTimeout(() => ta.focus(), 50);
    },
    onArgs(win, args) { if (args.path && win._te) win._te.load(args.path); },
    menus(win) {
      const E = win._te || {};
      return {
        file: [
          { label: T('New Document'), shortcut: 'Alt+N', action: () => PatOS.launch('textedit') },
          { label: T('Open…'), action: () => E.open && E.open(win.toolbar) },
          { divider: true },
          { label: T('Save'), shortcut: 'Ctrl+S', action: () => E.save && E.save() },
          { label: T('Save As…'), shortcut: 'Ctrl+Shift+S', action: () => E.save && E.save(true) },
          { label: T('Print…'), action: () => E.print && E.print() },
          { divider: true },
          { label: T('Close'), shortcut: 'Alt+W', action: () => win.close() }
        ],
        edit: [
          { label: T('Undo'), shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
          { label: T('Redo'), shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
          { divider: true },
          { label: T('Find…'), shortcut: 'Ctrl+F', action: () => E.find && E.find(false) },
          { label: T('Find and Replace…'), shortcut: 'Ctrl+H', action: () => E.find && E.find(true) },
          { divider: true },
          { label: T('Select All'), shortcut: 'Ctrl+A', action: () => { const t = win.body.querySelector('textarea'); t.focus(); t.select(); } }
        ],
        view: [
          { label: T('Wrap long lines'), action: () => E.wrap && E.wrap() },
          { label: T('Bigger text'), action: () => E.bigger && E.bigger() },
          { label: T('Smaller text'), action: () => E.smaller && E.smaller() }
        ]
      };
    }
  });
})();
