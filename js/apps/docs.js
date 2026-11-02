/* Docs — a real word processor. Files are saved as .pdoc in PatOS. */
(function () {
  'use strict';
  const { h } = PatOS;
  const FONTS = [['Arial, Helvetica, sans-serif', 'Arial'], ['Georgia, serif', 'Georgia'], ['"Times New Roman", Times, serif', 'Times New Roman'], ['"Courier New", monospace', 'Courier New'], ['Verdana, sans-serif', 'Verdana'], ['"Trebuchet MS", sans-serif', 'Trebuchet'], ['"Comic Sans MS", "Comic Neue", cursive', 'Comic Sans']];
  const SIZES = [['1', '8'], ['2', '10'], ['3', '12'], ['4', '14'], ['5', '18'], ['6', '24'], ['7', '36']];
  PatOS.newDocPath = function (dir, base, ext) { return dir + '/' + PatOS.fs.uniqueName(dir, PatOS.t(base) + '.' + ext); };

  PatOS.registerApp({
    id: 'docs', name: 'Docs', icon: 'docs', single: false, width: 960, height: 680, category: 'Office', keywords: 'word document write essay processor google docs text',
    about: 'Write documents with headings, fonts, lists, tables and images.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'office-win');
      let path = args.path || null;
      if (!path) { path = PatOS.newDocPath('/Documents', 'Untitled document', 'pdoc'); PatOS.fs.write(path, '<h1>' + PatOS.t('Untitled document') + '</h1><p><br></p>'); }
      const page = h('div', { class: 'doc-page', contenteditable: 'true', spellcheck: 'true' });
      page.innerHTML = PatOS.fs.read(path) || '<p><br></p>';
      const status = h('div', { class: 'doc-status' });
      const nameIn = h('input', { class: 'doc-name', value: PatOS.fs.basename(path).replace(/\.pdoc$/, ''), spellcheck: 'false' });
      const saved = h('span', { class: 'doc-saved' }, 'Saved');
      win.toolbar.append(nameIn, saved, h('div', { style: { flex: 1 } }));
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const cmd = (c, v) => (e) => { if (e) e.preventDefault(); page.focus(); document.execCommand('styleWithCSS', false, c === 'hiliteColor' || c === 'foreColor'); document.execCommand(c, false, v); onEdit(); updateState(); };
      const btn = (label, title, fn, cls) => { const b = h('button', { class: 'ob' + (cls ? ' ' + cls : ''), title }, label); b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', fn); return b; };
      const style = h('select', { class: 'ob-sel', title: 'Text style' }, ...[['p', 'Normal text'], ['h1', 'Title'], ['h2', 'Heading 1'], ['h3', 'Heading 2'], ['blockquote', 'Quote'], ['pre', 'Code']].map(([v, l]) => h('option', { value: v }, l)));
      style.onchange = () => { cmd('formatBlock', style.value)(); };
      const font = h('select', { class: 'ob-sel', title: 'Font' }, ...FONTS.map(([v, l]) => h('option', { value: v }, l)));
      font.onchange = () => cmd('fontName', font.value)();
      const size = h('select', { class: 'ob-sel sm', title: 'Font size' }, ...SIZES.map(([v, l]) => h('option', { value: v, selected: v === '3' }, l)));
      size.onchange = () => cmd('fontSize', size.value)();
      const color = h('input', { type: 'color', class: 'ob-color', value: '#000000', title: 'Text color' }); color.oninput = () => cmd('foreColor', color.value)();
      const hl = h('input', { type: 'color', class: 'ob-color', value: '#fff176', title: 'Highlight' }); hl.oninput = () => cmd('hiliteColor', hl.value)();
      const B = btn(h('b', {}, 'B'), 'Bold (Ctrl+B)', cmd('bold')), I = btn(h('i', {}, 'I'), 'Italic (Ctrl+I)', cmd('italic')), U = btn(h('u', {}, 'U'), 'Underline (Ctrl+U)', cmd('underline')), S = btn(h('s', {}, 'S'), 'Strikethrough', cmd('strikeThrough'));
      const bar = h('div', { class: 'ob-bar' },
        btn('↶', 'Undo', cmd('undo')), btn('↷', 'Redo', cmd('redo')), h('span', { class: 'ob-sep' }),
        style, font, size, h('span', { class: 'ob-sep' }), B, I, U, S,
        h('label', { class: 'ob-cl', title: 'Text color' }, 'A', color), h('label', { class: 'ob-cl hl', title: 'Highlight' }, '🖍', hl), h('span', { class: 'ob-sep' }),
        btn('⬅', 'Align left', cmd('justifyLeft')), btn('↔', 'Center', cmd('justifyCenter')), btn('➡', 'Align right', cmd('justifyRight')), btn('☰', 'Justify', cmd('justifyFull')), h('span', { class: 'ob-sep' }),
        btn('•', 'Bulleted list', cmd('insertUnorderedList')), btn('1.', 'Numbered list', cmd('insertOrderedList')), btn('⇥', 'Indent', cmd('indent')), btn('⇤', 'Outdent', cmd('outdent')), h('span', { class: 'ob-sep' }),
        btn('🔗', 'Insert link', async () => { const sel = saveSel(); const u = await PatOS.ask('Link address', 'https://', { icon: 'docs', ok: 'Insert' }); restoreSel(sel); if (u) cmd('createLink', u)(); }),
        btn('🖼', 'Insert image', () => { const sel = saveSel(); const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => shrink(r.result, (src) => { restoreSel(sel); cmd('insertHTML', `<img src="${src}" style="max-width:100%">`)(); }); r.readAsDataURL(f); }; i.click(); }),
        btn('▦', 'Insert table', async () => { const sel = saveSel(); const v = await PatOS.ask('Table size (columns x rows)', '3x3', { icon: 'docs', ok: 'Insert' }); restoreSel(sel); const m = v && v.match(/(\d+)\s*[x×*]\s*(\d+)/i); if (!m) return; const c = Math.min(10, +m[1]), r = Math.min(40, +m[2]); let t = '<table class="doc-table"><tbody>'; for (let y = 0; y < r; y++) { t += '<tr>'; for (let x = 0; x < c; x++) t += y === 0 ? '<th><br></th>' : '<td><br></td>'; t += '</tr>'; } cmd('insertHTML', t + '</tbody></table><p><br></p>')(); }),
        btn('―', 'Horizontal line', cmd('insertHorizontalRule')), btn('☐', 'Checklist item', cmd('insertText', '☐ ')), btn('⌫', 'Clear formatting', cmd('removeFormat')), h('span', { class: 'ob-sep' }),
        btn('🔍', 'Find and replace', findReplace), btn('⬇', 'Download', download), btn('🖨', 'Print', printDoc));
      win.body.append(bar, h('div', { class: 'doc-scroll' }, page), status);
      function shrink(src, done) { const img = new Image(); img.onload = () => { const s = Math.min(1, 900 / img.width); if (s === 1 && src.length < 400000) return done(src); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', 0.82)); }; img.src = src; }
      function saveSel() { const s = window.getSelection(); return s.rangeCount ? s.getRangeAt(0).cloneRange() : null; }
      function restoreSel(r) { page.focus(); if (!r) return; const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      const persist = PatOS.debounce(() => { try { PatOS.fs.write(path, page.innerHTML); saved.textContent = 'Saved'; } catch (e) { saved.textContent = 'Not saved'; } }, 700);
      function onEdit() { saved.textContent = 'Saving…'; persist(); stats(); }
      function stats() { const t = page.innerText || ''; const w = (t.match(/\S+/g) || []).length; status.textContent = w + ' words · ' + t.replace(/\s/g, '').length + ' characters · ' + Math.max(1, Math.round(w / 200)) + ' min read'; }
      function updateState() {
        [['bold', B], ['italic', I], ['underline', U], ['strikeThrough', S]].forEach(([c, b]) => b.classList.toggle('on', document.queryCommandState(c)));
        const blk = (document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, ''); if ([...style.options].some((o) => o.value === blk)) style.value = blk; else style.value = 'p';
      }
      page.addEventListener('input', onEdit);
      page.addEventListener('keyup', updateState); page.addEventListener('mouseup', updateState);
      page.addEventListener('click', (e) => { // toggle checklist boxes
        const s = window.getSelection(); if (!s.rangeCount) return; const n = s.anchorNode; if (!n || n.nodeType !== 3) return;
        const i = s.anchorOffset, t = n.textContent; for (const j of [i - 1, i]) if (t[j] === '☐' || t[j] === '☑') { n.textContent = t.slice(0, j) + (t[j] === '☐' ? '☑' : '☐') + t.slice(j + 1); onEdit(); break; }
      });
      page.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); findReplace(); }
      });
      page.addEventListener('paste', (e) => { // paste images
        const it = [...(e.clipboardData || {}).items || []].find((x) => x.type.startsWith('image/'));
        if (it) { e.preventDefault(); const r = new FileReader(); r.onload = () => shrink(r.result, (src) => cmd('insertHTML', `<img src="${src}" style="max-width:100%">`)()); r.readAsDataURL(it.getAsFile()); }
      });
      nameIn.addEventListener('change', () => { const nn = nameIn.value.trim().replace(/[\/]/g, '-') || PatOS.t('Untitled document'); try { path = PatOS.fs.rename(path, PatOS.fs.uniqueName(PatOS.fs.dirname(path), nn + '.pdoc')); nameIn.value = PatOS.fs.basename(path).replace(/\.pdoc$/, ''); win.setTitle(nameIn.value); } catch (e) { nameIn.value = PatOS.fs.basename(path).replace(/\.pdoc$/, ''); } });
      async function findReplace() {
        const f = await PatOS.ask('Find', '', { icon: 'docs', ok: 'Next' }); if (!f) return;
        const r = await PatOS.ask('Replace “' + f + '” with', '', { icon: 'docs', ok: 'Replace All', text: 'Leave empty to just count matches.' }); if (r === null) return;
        const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); let n = 0;
        const walk = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
        nodes.forEach((t) => { t.textContent = t.textContent.replace(re, (m) => { n++; return r === '' ? m : r; }); });
        onEdit(); PatOS.notify({ title: r === '' ? n + ' matches' : n + ' replaced', body: '“' + f + '”', icon: 'docs' });
      }
      function docHTML() { return `<!doctype html><html><head><meta charset="utf-8"><title>${PatOS.esc(nameIn.value)}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;line-height:1.5;padding:0 20px}table{border-collapse:collapse}td,th{border:1px solid #999;padding:6px 10px}img{max-width:100%}</style></head><body>${page.innerHTML}</body></html>`; }
      function download() { PatOS.menu([{ label: 'Web page (.html)', action: () => PatOS.downloadFile(nameIn.value + '.html', docHTML()) }, { label: 'Plain text (.txt)', action: () => PatOS.downloadFile(nameIn.value + '.txt', page.innerText) }, { label: 'Word document (.doc)', action: () => PatOS.downloadFile(nameIn.value + '.doc', docHTML()) }], innerWidth / 2 - 100, 140); }
      function printDoc() {
        const f = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0' } }); document.body.appendChild(f);
        f.contentDocument.open(); f.contentDocument.write(docHTML()); f.contentDocument.close();
        setTimeout(() => { try { f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 1000); }, 300);
      }
      win.setTitle(nameIn.value);
      stats();
      setTimeout(() => { page.focus(); const r = document.createRange(); r.selectNodeContents(page); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }, 80);
    }
  });
})();
