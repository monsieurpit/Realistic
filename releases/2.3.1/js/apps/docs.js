/* Docs — a word processor. Files are saved as .pdoc (HTML) in PatOS. */
(function () {
  'use strict';
  const { h } = PatOS;
  const O = () => PatOS.office;
  const FONTS = [['Inter, system-ui, sans-serif', 'Inter'], ['Arial, Helvetica, sans-serif', 'Arial'], ['Georgia, serif', 'Georgia'], ['"Times New Roman", Times, serif', 'Times New Roman'], ['Garamond, "EB Garamond", serif', 'Garamond'], ['"Courier New", monospace', 'Courier New'], ['Verdana, sans-serif', 'Verdana'], ['"Trebuchet MS", sans-serif', 'Trebuchet'], ['"Comic Sans MS", "Comic Neue", cursive', 'Comic Sans'], ['Impact, sans-serif', 'Impact']];
  const STYLES = [['p', 'Normal text'], ['h1', 'Title'], ['h2', 'Heading 1'], ['h3', 'Heading 2'], ['h4', 'Heading 3'], ['blockquote', 'Quote'], ['pre', 'Code']];
  PatOS.newDocPath = function (dir, base, ext) { return dir + '/' + PatOS.fs.uniqueName(dir, PatOS.t(base) + '.' + ext); };
  const T = (s) => PatOS.t(s);
  const today = () => new Date().toLocaleDateString(PatOS.locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const TEMPLATES = [
    { name: 'Blank document', html: () => '<p><br></p>', preview: '<i></i>' },
    { name: 'Essay', sub: 'MLA format', html: () => `<p>${T('Your Name')}</p><p>${T('Teacher’s Name')}</p><p>${T('Class')}</p><p>${today()}</p><h1 style="text-align:center">${T('Essay Title')}</h1><p style="line-height:2">${T('Start your introduction here. End it with your thesis: the main idea your essay will prove.')}</p><p style="line-height:2">${T('Body paragraph: one idea, with evidence and an explanation.')}</p><p style="line-height:2">${T('Conclusion: restate your thesis in new words and say why it matters.')}</p>`, preview: '<b>Essay</b><i></i><i></i><i></i>' },
    { name: 'Report', sub: 'With headings', html: () => `<h1>${T('Report Title')}</h1><p style="color:#666">${T('Your Name')} · ${today()}</p><h2>${T('Introduction')}</h2><p>${T('What this report is about.')}</p><h2>${T('Findings')}</h2><ul><li>${T('First finding')}</li><li>${T('Second finding')}</li></ul><h2>${T('Conclusion')}</h2><p>${T('What you learned.')}</p>`, preview: '<b>Report</b><u></u><i></i><u></u><i></i>' },
    { name: 'Class notes', sub: 'Cornell style', html: () => `<h1>${T('Class notes')}</h1><p style="color:#666">${today()}</p><table class="doc-table"><tbody><tr><th style="width:30%">${T('Questions / key words')}</th><th>${T('Notes')}</th></tr><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><h3>${T('Summary')}</h3><p><br></p>`, preview: '<b>Notes</b><s></s>' },
    { name: 'Letter', html: () => `<p>${T('Your Name')}<br>${T('Your Address')}</p><p>${today()}</p><p>${T('Dear')} ${T('Name')},</p><p>${T('Write your letter here.')}</p><p>${T('Sincerely,')}</p><p>${T('Your Name')}</p>`, preview: '<i></i><i></i><i></i><i></i>' },
    { name: 'Resume', html: () => `<h1>${T('Your Name')}</h1><p style="color:#666">${T('email@example.com')} · ${T('City')}</p><h2>${T('Experience')}</h2><p><b>${T('Job title')}</b> — ${T('Company')}, 2024–2025</p><ul><li>${T('What you did and what it changed')}</li></ul><h2>${T('Education')}</h2><p><b>${T('School')}</b>, ${T('Grade or diploma')}</p><h2>${T('Skills')}</h2><ul><li><br></li></ul>`, preview: '<b>Resume</b><u></u><i></i><u></u>' },
    { name: 'Lab report', html: () => `<h1>${T('Lab report')}</h1><p style="color:#666">${T('Your Name')} · ${today()}</p><h2>${T('Question')}</h2><p><br></p><h2>${T('Hypothesis')}</h2><p><br></p><h2>${T('Materials')}</h2><ul><li><br></li></ul><h2>${T('Procedure')}</h2><ol><li><br></li></ol><h2>${T('Results')}</h2><table class="doc-table"><tbody><tr><th>${T('Trial')}</th><th>${T('Measurement')}</th></tr><tr><td>1</td><td><br></td></tr><tr><td>2</td><td><br></td></tr></tbody></table><h2>${T('Conclusion')}</h2><p><br></p>`, preview: '<b>Lab</b><u></u><s></s>' },
    { name: 'To-do list', html: () => `<h1>${T('To-do list')}</h1><ul class="dx-check"><li>${T('First thing')}</li><li>${T('Second thing')}</li><li><br></li></ul>`, preview: '<b>To-do</b><em></em><em></em><em></em>' }
  ];
  const SPECIAL = '— – … • · ° ± × ÷ ≠ ≤ ≥ ≈ ∞ √ π Σ Δ Ω α β γ λ μ θ ← → ↑ ↓ ⇒ © ® ™ € £ ¥ ¢ § ¶ ½ ¼ ¾ ² ³ ✓ ✗ ★ ♥ « » ¿ ¡ é è ê à ç ô û ù ë ï'.split(' ');
  const EMOJI = '😀 😂 🥲 😍 🤩 😎 🤔 😴 😭 😡 👍 👎 👏 🙏 💪 🎉 🔥 ✨ 💡 📌 📎 📚 ✏️ 📝 ✅ ❌ ⚠️ ❤️ ⭐ 🌍 🚀 🎵 🏆 ⏰ 📅'.split(' ');

  PatOS.registerApp({
    id: 'docs', name: 'Write', icon: 'docs', single: false, width: 1040, height: 720, category: 'Office', keywords: 'word document write essay processor docs text',
    about: 'Write documents with headings, fonts, lists, tables, images, voice typing and version history.',
    launch(win, args) {
      win.el.classList.add('office-win', 'dx-win');
      win.setTitle(T('Write'));
      if (args.path) return openDoc(win, args.path);
      O().startScreen(win, {
        title: 'Write', icon: 'docs', ext: ['pdoc'], templates: TEMPLATES,
        onCreate: (t) => { const p = PatOS.newDocPath('/Documents', t.name === 'Blank document' ? 'Untitled document' : t.name, 'pdoc'); PatOS.fs.write(p, t.html()); openDoc(win, p); },
        onOpen: (p) => openDoc(win, p),
        importLabel: 'Open a Word file…', importAccept: '.docx', onImportFile: async (file) => { if (/\.csv$/i.test(file.name)) { const p = '/Documents/' + PatOS.fs.uniqueName('/Documents', file.name); PatOS.fs.write(p, await file.text()); return p; } return (await PatOS.importOffice(file, file.name)).path; }
      });
    }
  });

  function openDoc(win, path) {
    PatOS.remember && PatOS.remember(win, { path });
    const OF = O();
    win.el.classList.add('has-toolbar');
    let raw = PatOS.fs.read(path) || '<p><br></p>';
    const page = h('div', { class: 'doc-page dx-page', contenteditable: 'true', spellcheck: 'true' });
    page.innerHTML = PatOS.sanitize(raw); // a document file can't carry scripts or event handlers
    const baseName = () => PatOS.fs.basename(path).replace(/\.pdoc$/, '');
    const head = OF.header(win, {
      name: baseName(), icon: 'docs', getPath: () => path,
      onRename: (nn) => { nn = (nn || T('Untitled document')).replace(/[\/]/g, '-'); try { const old = path; path = PatOS.fs.rename(path, PatOS.fs.uniqueName(PatOS.fs.dirname(path), nn + '.pdoc')); PatOS.remember && PatOS.remember(win, { path }); moveVersions(old, path); } catch (e) {} head.name.value = baseName(); win.setTitle(baseName()); }
    });
    win.toolbar.append(head.el); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
    win.setTitle(baseName());

    /* ---------- commands ---------- */
    const exec = (c, v) => { page.focus(); document.execCommand('styleWithCSS', false, c === 'hiliteColor' || c === 'foreColor'); document.execCommand(c, false, v); onEdit(); updateState(); };
    let savedRange = null;
    const keepSel = () => { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); };
    const restoreSel = () => { page.focus(); if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };
    function setFontSize(px) {
      restoreSel();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('fontSize', false, '7');
      page.querySelectorAll('font[size="7"]').forEach((f) => { const s = document.createElement('span'); s.style.fontSize = px + 'px'; s.innerHTML = f.innerHTML; f.replaceWith(s); });
      onEdit(); updateState();
    }
    function blocksInSelection() {
      const s = getSelection(); if (!s.rangeCount) return [];
      const r = s.getRangeAt(0); const out = new Set();
      const blk = (n) => { while (n && n !== page) { if (n.nodeType === 1 && /^(P|H1|H2|H3|H4|LI|BLOCKQUOTE|PRE|DIV)$/.test(n.tagName)) return n; n = n.parentNode; } return null; };
      const st = blk(r.startContainer), en = blk(r.endContainer);
      if (st) out.add(st);
      if (st && en && st !== en) { let n = st; while (n && n !== en) { n = n.nextElementSibling || (n.parentNode !== page ? n.parentNode.nextElementSibling : null); if (n) out.add(n); else break; } out.add(en); }
      return [...out];
    }

    /* ---------- menus ---------- */
    const menu = (label, items) => { const b = h('button', { class: 'dx-mb' }, T(label)); b.addEventListener('mousedown', (e) => { e.preventDefault(); keepSel(); }); b.onclick = () => { const r = b.getBoundingClientRect(); PatOS.menu(items().filter(Boolean), r.left, r.bottom + 2); }; return b; };
    const menubar = h('div', { class: 'dx-menus' },
      menu('File', () => [
        { label: T('New document'), action: () => PatOS.launch('docs', {}) },
        { label: T('Open…'), action: () => PatOS.launch('docs', {}) },
        { label: T('Make a copy'), action: () => { const p = PatOS.newDocPath(PatOS.fs.dirname(path), baseName() + ' ' + T('copy'), 'pdoc'); PatOS.fs.write(p, page.innerHTML); PatOS.launch('docs', { path: p }); } },
        { divider: true },
        { label: T('Version history'), action: showHistory },
        { label: T('Download'), action: () => download(menubar.firstChild) },
        { label: T('Print or save as PDF'), shortcut: 'Ctrl+P', action: printDoc },
        { divider: true },
        { label: T('Show in Finder'), action: () => PatOS.launch('finder', { path: PatOS.fs.dirname(path) }) },
        { label: T('Move to Trash'), action: async () => { if (await PatOS.confirmBox(T('Move this document to the Trash?'), '', { danger: true, ok: T('Move to Trash'), icon: 'docs' })) { trashed = true; PatOS.fs.remove(path); win.close(); } } }
      ]),
      menu('Edit', () => [
        { label: T('Undo'), shortcut: 'Ctrl+Z', action: () => exec('undo') }, { label: T('Redo'), shortcut: 'Ctrl+Y', action: () => exec('redo') }, { divider: true },
        { label: T('Select all'), shortcut: 'Ctrl+A', action: () => { restoreSel(); exec('selectAll'); } },
        { label: T('Find and replace'), shortcut: 'Ctrl+F', action: openFind }
      ]),
      menu('Insert', () => [
        { label: T('Image…'), action: insertImage }, { label: T('Table'), action: () => tablePicker(tbTable) }, { label: T('Link'), shortcut: 'Ctrl+K', action: insertLink },
        { divider: true },
        { label: T('Checklist'), action: () => toggleChecklist() }, { label: T('Horizontal line'), action: () => exec('insertHorizontalRule') }, { label: T('Page break'), action: () => insertHTML('<div class="dx-pb" contenteditable="false"></div><p><br></p>') },
        { label: T('Table of contents'), action: insertTOC }, { label: T('Date'), action: () => insertHTML(PatOS.esc(today())) },
        { label: T('Special characters'), action: () => charsPop(tbMore, SPECIAL) }, { label: T('Emoji'), action: () => charsPop(tbMore, EMOJI) }
      ]),
      menu('Format', () => [
        ...STYLES.map(([v, l]) => ({ label: T(l), action: () => { restoreSel(); exec('formatBlock', v); } })), { divider: true },
        { label: T('Line spacing') + ': 1', action: () => lineSpacing(1.15) }, { label: T('Line spacing') + ': 1.5', action: () => lineSpacing(1.5) }, { label: T('Line spacing') + ': 2', action: () => lineSpacing(2) }, { divider: true },
        { label: T('Clear formatting'), shortcut: 'Ctrl+\\', action: () => { restoreSel(); exec('removeFormat'); } }
      ]),
      menu('Tools', () => [
        { label: T('Word count'), shortcut: 'Ctrl+Shift+C', action: wordCount },
        { label: T('Voice typing'), action: voice }, { label: T('Read aloud'), action: readAloud },
        { label: T(outlineOn ? 'Hide outline' : 'Show outline'), action: toggleOutline },
        { label: T(focusMode ? 'Exit focus mode' : 'Focus mode'), action: () => { focusMode = !focusMode; win.el.classList.toggle('dx-focus', focusMode); } }
      ]));

    /* ---------- toolbar ---------- */
    const B = OF.btn;
    const styleSel = h('select', { class: 'of-sel', title: T('Text style') }, ...STYLES.map(([v, l]) => h('option', { value: v }, T(l))));
    styleSel.addEventListener('mousedown', keepSel); styleSel.onchange = () => { restoreSel(); exec('formatBlock', styleSel.value); };
    const fontSel = h('select', { class: 'of-sel', title: T('Font') }, ...FONTS.map(([v, l]) => h('option', { value: v, style: { fontFamily: v } }, l)));
    fontSel.addEventListener('mousedown', keepSel); fontSel.onchange = () => { restoreSel(); exec('fontName', fontSel.value); };
    const sizeIn = h('input', { class: 'of-size', value: '15', title: T('Font size'), inputmode: 'numeric' });
    sizeIn.addEventListener('mousedown', keepSel);
    sizeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = Math.max(6, Math.min(96, +sizeIn.value || 15)); setFontSize(v); } });
    const sizeStep = (d) => () => { keepSel(); const v = Math.max(6, Math.min(96, (+sizeIn.value || 15) + d)); sizeIn.value = v; setFontSize(v); };
    const tbB = B('bold', 'Bold (Ctrl+B)', () => exec('bold')), tbI = B('italic', 'Italic (Ctrl+I)', () => exec('italic')), tbU = B('underline', 'Underline (Ctrl+U)', () => exec('underline')), tbS = B('strike', 'Strikethrough', () => exec('strikeThrough'));
    const tbColor = B('color', 'Text color', (e, b) => { keepSel(); OF.colorPicker(b, (c) => { restoreSel(); exec('foreColor', c || '#000000'); b.style.setProperty('--sw', c || '#000'); }); }, { cls: 'swatch' });
    const tbHL = B('marker', 'Highlight', (e, b) => { keepSel(); OF.colorPicker(b, (c) => { restoreSel(); exec('hiliteColor', c || 'transparent'); b.style.setProperty('--sw', c || 'transparent'); }, { none: true }); }, { cls: 'swatch' });
    tbHL.style.setProperty('--sw', '#fef08a');
    const tbAlign = B('left', 'Align', (e, b) => { keepSel(); const p = OF.pop(b, h('div', { class: 'of-row' }, ...[['left', 'justifyLeft', 'Align left'], ['center', 'justifyCenter', 'Center'], ['right', 'justifyRight', 'Align right'], ['justify', 'justifyFull', 'Justify']].map(([ic, c, t]) => B(ic, t, () => { restoreSel(); exec(c); p.close(); })))); });
    const tbSpacing = B('spacing', 'Line spacing', (e, b) => { keepSel(); const p = OF.pop(b, h('div', { class: 'of-list' }, ...[[1.15, '1.15'], [1.5, '1.5'], [2, T('Double')]].map(([v, l]) => h('button', { onclick: () => { lineSpacing(v); p.close(); } }, l)))); });
    const tbTable = B('table', 'Insert table', (e, b) => { keepSel(); tablePicker(b); });
    const tbMore = B('omega', 'Special characters', (e, b) => { keepSel(); charsPop(b, SPECIAL); });
    const tbMic = B('mic', 'Voice typing', voice);
    const zoomSel = h('select', { class: 'of-sel sm', title: T('Zoom') }, ...[50, 75, 90, 100, 125, 150, 200].map((z) => h('option', { value: z }, z + '%')));
    zoomSel.value = String(PatOS.store.get('docsZoom', 100)); zoomSel.onchange = () => { setZoom(+zoomSel.value); };
    const toolbar = h('div', { class: 'of-bar' },
      B('undo', 'Undo (Ctrl+Z)', () => exec('undo')), B('redo', 'Redo (Ctrl+Y)', () => exec('redo')), B('print', 'Print', printDoc), zoomSel, OF.sep(),
      styleSel, fontSel, OF.sep(),
      B('<b class="of-t">−</b>', 'Smaller text', sizeStep(-1)), sizeIn, B('<b class="of-t">+</b>', 'Bigger text', sizeStep(1)), OF.sep(),
      tbB, tbI, tbU, tbS, tbColor, tbHL, OF.sep(),
      B('link', 'Insert link (Ctrl+K)', insertLink), B('image', 'Insert image', insertImage), tbTable, OF.sep(),
      tbAlign, tbSpacing, B('check', 'Checklist', () => toggleChecklist()), B('bullets', 'Bulleted list', () => exec('insertUnorderedList')), B('numbers', 'Numbered list', () => exec('insertOrderedList')), B('outdent', 'Decrease indent', () => exec('outdent')), B('indent', 'Increase indent', () => exec('indent')), B('clear', 'Clear formatting', () => exec('removeFormat')), OF.sep(),
      tbMore, tbMic, B('speaker', 'Read aloud', readAloud), B('outline', 'Outline', toggleOutline), B('search', 'Find and replace (Ctrl+F)', openFind));

    /* ---------- layout ---------- */
    const outline = h('div', { class: 'dx-outline' });
    const findBar = h('div', { class: 'dx-find' });
    const scroll = h('div', { class: 'doc-scroll dx-scroll' }, findBar, h('div', { class: 'dx-zoom' }, page));
    const status = h('div', { class: 'dx-status' });
    const reveal = (el, center) => { const r = el.getBoundingClientRect(), sr = scroll.getBoundingClientRect(); scroll.scrollBy({ top: r.top - sr.top - (center ? sr.height / 2 : 60), behavior: 'smooth' }); };
    const imgBar = h('div', { class: 'dx-imgbar' });
    win.body.append(menubar, toolbar, h('div', { class: 'dx-main' }, outline, scroll), status, imgBar);
    let outlineOn = PatOS.store.get('docsOutline', false), focusMode = false, trashed = false;
    win.el.classList.toggle('dx-outline-on', outlineOn);
    function setZoom(z) { page.parentNode.style.zoom = z / 100; PatOS.store.set('docsZoom', z); zoomSel.value = String(z); }
    setZoom(+zoomSel.value || 100);

    /* ---------- saving + versions ---------- */
    const vKey = (p) => 'docVersions:' + p;
    function moveVersions(a, b) { const v = PatOS.store.get(vKey(a), null); if (v) { PatOS.store.set(vKey(b), v); PatOS.store.set(vKey(a), null); } }
    let lastVersion = 0;
    function addVersion(force) {
      const list = PatOS.store.get(vKey(path), []);
      const html = page.innerHTML;
      if (!force && (Date.now() - lastVersion < 120000 || (list[0] && list[0].html === html))) return;
      lastVersion = Date.now();
      list.unshift({ t: Date.now(), html, words: words() }); PatOS.store.set(vKey(path), list.slice(0, 25));
    }
    const persist = PatOS.debounce(() => {
      if (trashed) return;
      try { const marks = page.querySelector('mark.dx-hit'); PatOS.fs.write(path, marks ? page.innerHTML.replace(/<mark class="dx-hit( cur)?">([\s\S]*?)<\/mark>/g, '$2') : page.innerHTML); head.saved(); addVersion(); } catch (e) { head.failed(); }
    }, 500);
    function onEdit() { head.saving(); persist(); statsSoon(); outlineSoon(); }
    const words = () => ((page.innerText || '').match(/\S+/g) || []).length;
    const statsSoon = PatOS.debounce(stats, 200), outlineSoon = PatOS.debounce(renderOutline, 300);
    function stats() {
      const t = page.innerText || ''; const w = words();
      const pages = Math.max(1, Math.ceil(page.scrollHeight / 1056)) + page.querySelectorAll('.dx-pb').length;
      status.innerHTML = '';
      const wc = h('button', { class: 'dx-stat', onclick: wordCount }, w.toLocaleString() + ' ' + T(w === 1 ? 'word' : 'words'));
      status.append(wc, h('span', {}, t.replace(/\s/g, '').length.toLocaleString() + ' ' + T('characters')), h('span', {}, pages + ' ' + T(pages === 1 ? 'page' : 'pages')), h('span', {}, Math.max(1, Math.round(w / 230)) + ' ' + T('min read')));
    }
    function updateState() {
      [['bold', tbB], ['italic', tbI], ['underline', tbU], ['strikeThrough', tbS]].forEach(([c, b]) => b.classList.toggle('on', document.queryCommandState(c)));
      const blk = (document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, ''); styleSel.value = STYLES.some(([v]) => v === blk) ? blk : 'p';
      const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) {
        let n = s.anchorNode.nodeType === 3 ? s.anchorNode.parentNode : s.anchorNode;
        const cs = getComputedStyle(n); sizeIn.value = Math.round(parseFloat(cs.fontSize));
        const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
        const f = FONTS.find(([v]) => v.toLowerCase().includes(fam)); if (f) fontSel.value = f[0];
      }
      selectImage(null);
    }

    /* ---------- outline ---------- */
    function renderOutline() {
      if (!outlineOn) return;
      outline.innerHTML = '';
      outline.appendChild(h('div', { class: 'dx-oh' }, h('b', {}, T('Outline')), OF.btn('<b class="of-t">×</b>', 'Close', toggleOutline)));
      const hs = [...page.querySelectorAll('h1, h2, h3, h4')];
      if (!hs.length) { outline.appendChild(h('p', { class: 'dx-onone' }, T('Headings you add appear here.'))); return; }
      hs.forEach((x) => { const b = h('button', { class: 'dx-oi l' + x.tagName[1] }, x.textContent.trim() || '…'); b.onclick = () => { reveal(x); x.classList.add('dx-flash'); setTimeout(() => x.classList.remove('dx-flash'), 900); }; outline.appendChild(b); });
    }
    function toggleOutline() { outlineOn = !outlineOn; PatOS.store.set('docsOutline', outlineOn); win.el.classList.toggle('dx-outline-on', outlineOn); renderOutline(); }

    /* ---------- inserts ---------- */
    function insertHTML(html) { restoreSel(); document.execCommand('insertHTML', false, html); onEdit(); }
    async function insertLink() {
      keepSel(); const sel = getSelection().toString();
      const u = await PatOS.ask(T('Link address'), 'https://', { icon: 'docs', ok: T('Insert') });
      if (!u) return; restoreSel();
      if (sel) exec('createLink', u); else insertHTML(`<a href="${PatOS.esc(u)}">${PatOS.esc(u)}</a>&nbsp;`);
    }
    function shrink(src, done) { const img = new Image(); img.onload = () => { const s = Math.min(1, 1000 / img.width); if (s === 1 && src.length < 400000) return done(src); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', 0.84)); }; img.src = src; }
    function insertImage() {
      keepSel();
      const i = h('input', { type: 'file', accept: 'image/*' });
      i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => shrink(r.result, (src) => insertHTML(`<img src="${src}" style="width:60%">`)); r.readAsDataURL(f); };
      i.click();
    }
    function tablePicker(anchor) {
      const g = h('div', { class: 'dx-tgrid' }), lab = h('div', { class: 'dx-tlab' }, '1 × 1');
      for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) {
        const cell = h('i', { 'data-r': r, 'data-c': c });
        cell.onmouseenter = () => { g.querySelectorAll('i').forEach((x) => x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c)); lab.textContent = (c + 1) + ' × ' + (r + 1); };
        cell.onclick = () => { p.close(); let t = '<table class="doc-table"><tbody>'; for (let y = 0; y <= r; y++) { t += '<tr>'; for (let x = 0; x <= c; x++) t += y === 0 ? '<th><br></th>' : '<td><br></td>'; t += '</tr>'; } insertHTML(t + '</tbody></table><p><br></p>'); };
        g.appendChild(cell);
      }
      const p = OF.pop(anchor, h('div', {}, g, lab));
    }
    function charsPop(anchor, list) { const p = OF.pop(anchor, h('div', { class: 'dx-chars' }, ...list.map((c) => h('button', { onclick: () => { insertHTML(c); } }, c)))); }
    function lineSpacing(v) { restoreSel(); const bl = blocksInSelection(); (bl.length ? bl : [...page.children]).forEach((b) => { b.style.lineHeight = v; }); onEdit(); }
    function toggleChecklist() {
      restoreSel();
      const s = getSelection(); let n = s.anchorNode; while (n && n !== page && !(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName))) n = n.parentNode;
      if (n && n !== page && n.tagName === 'UL') { n.classList.toggle('dx-check'); onEdit(); return; }
      document.execCommand('insertUnorderedList'); s.anchorNode && (function () { let m = s.anchorNode; while (m && m !== page && m.tagName !== 'UL') m = m.parentNode; if (m && m !== page) m.classList.add('dx-check'); })(); onEdit();
    }
    function insertTOC() {
      const hs = [...page.querySelectorAll('h1, h2, h3')]; if (!hs.length) return PatOS.alertBox(T('No headings yet'), T('Use Title or Heading styles, then insert the table of contents.'), { icon: 'docs' });
      hs.forEach((x, i) => { if (!x.id) x.id = 'h' + Date.now().toString(36) + i; });
      insertHTML('<div class="dx-toc" contenteditable="false"><b>' + T('Contents') + '</b>' + hs.map((x) => `<a href="#${x.id}" class="l${x.tagName[1]}">${PatOS.esc(x.textContent)}</a>`).join('') + '</div><p><br></p>');
    }

    /* ---------- images: click to resize / align ---------- */
    let selImg = null;
    function selectImage(img) {
      if (selImg) selImg.classList.remove('dx-imgsel');
      selImg = img; imgBar.innerHTML = '';
      if (!img) { imgBar.classList.remove('on'); return; }
      img.classList.add('dx-imgsel');
      const size = (w) => () => { img.style.width = w; onEdit(); place(); };
      const al = (m) => () => { img.style.float = m === 'center' ? '' : m; img.style.display = m === 'center' ? 'block' : ''; img.style.margin = m === 'center' ? '8px auto' : m === 'left' ? '4px 16px 8px 0' : '4px 0 8px 16px'; onEdit(); place(); };
      imgBar.append(...[['25%', 'S'], ['50%', 'M'], ['75%', 'L'], ['100%', 'XL']].map(([w, l]) => h('button', { onclick: size(w) }, l)), h('span', { class: 'of-sep' }), OF.btn('left', 'Wrap left', al('left')), OF.btn('center', 'Center', al('center')), OF.btn('right', 'Wrap right', al('right')), h('span', { class: 'of-sep' }), OF.btn('trash', 'Delete', () => { img.remove(); selectImage(null); onEdit(); }));
      imgBar.classList.add('on'); place();
      function place() { const r = img.getBoundingClientRect(), wr = win.body.getBoundingClientRect(); imgBar.style.left = Math.max(8, r.left - wr.left + r.width / 2 - imgBar.offsetWidth / 2) + 'px'; imgBar.style.top = Math.max(8, r.top - wr.top - 44) + 'px'; }
    }
    scroll.addEventListener('scroll', () => { if (selImg) selectImage(null); }, { passive: true });

    /* ---------- tables: right-click to add/remove rows and columns ---------- */
    page.addEventListener('contextmenu', (e) => {
      const cell = e.target.closest('td, th'); if (!cell) return;
      e.preventDefault();
      const row = cell.parentNode, table = cell.closest('table'), idx = [...row.children].indexOf(cell);
      const newRow = (after) => { const r = row.cloneNode(true); [...r.children].forEach((c) => { const n = document.createElement('td'); n.innerHTML = '<br>'; c.replaceWith(n); }); row.parentNode.insertBefore(r, after ? row.nextSibling : row); onEdit(); };
      const newCol = (after) => { table.querySelectorAll('tr').forEach((tr) => { const ref = tr.children[idx]; const n = document.createElement(ref && ref.tagName === 'TH' ? 'th' : 'td'); n.innerHTML = '<br>'; tr.insertBefore(n, after ? (ref ? ref.nextSibling : null) : ref); }); onEdit(); };
      PatOS.menu([
        { label: T('Insert row above'), action: () => newRow(false) }, { label: T('Insert row below'), action: () => newRow(true) },
        { label: T('Insert column left'), action: () => newCol(false) }, { label: T('Insert column right'), action: () => newCol(true) }, { divider: true },
        { label: T('Delete row'), action: () => { row.remove(); if (!table.querySelector('tr')) table.remove(); onEdit(); } },
        { label: T('Delete column'), action: () => { table.querySelectorAll('tr').forEach((tr) => tr.children[idx] && tr.children[idx].remove()); if (!table.querySelector('td, th')) table.remove(); onEdit(); } },
        { label: T('Delete table'), action: () => { table.remove(); onEdit(); } }
      ], e.clientX, e.clientY);
    });

    /* ---------- find & replace ---------- */
    let hits = [], hitIdx = 0;
    function openFind() {
      findBar.innerHTML = ''; findBar.classList.add('on');
      const fi = h('input', { class: 'field', placeholder: T('Find in document') }), ri = h('input', { class: 'field', placeholder: T('Replace with') });
      const cnt = h('span', { class: 'dx-fcount' }), mc = h('label', { class: 'dx-fmc' }, h('input', { type: 'checkbox' }), 'Aa');
      const run = () => { clearMarks(); hits = []; const q = fi.value; if (!q) { cnt.textContent = ''; return; } const flags = mc.querySelector('input').checked ? 'g' : 'gi'; const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); const walk = document.createTreeWalker(page, NodeFilter.SHOW_TEXT); const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode); nodes.forEach((t) => { const m = [...t.textContent.matchAll(re)]; if (!m.length) return; let node = t; let off = 0; m.forEach((x) => { const start = x.index - off; const mid = node.splitText(start); const rest = mid.splitText(x[0].length); const mark = document.createElement('mark'); mark.className = 'dx-hit'; mid.replaceWith(mark); mark.appendChild(mid); hits.push(mark); node = rest; off = x.index + x[0].length; }); }); hitIdx = 0; cnt.textContent = hits.length ? '1/' + hits.length : T('No results'); focusHit(); };
      const focusHit = () => { hits.forEach((m, i) => m.classList.toggle('cur', i === hitIdx)); if (hits[hitIdx]) { reveal(hits[hitIdx], true); cnt.textContent = (hitIdx + 1) + '/' + hits.length; } };
      const step = (d) => { if (!hits.length) return; hitIdx = (hitIdx + d + hits.length) % hits.length; focusHit(); };
      const replaceOne = () => { const m = hits[hitIdx]; if (!m) return; m.replaceWith(document.createTextNode(ri.value)); hits.splice(hitIdx, 1); onEdit(); if (hitIdx >= hits.length) hitIdx = 0; cnt.textContent = hits.length ? (hitIdx + 1) + '/' + hits.length : T('No results'); focusHit(); };
      const replaceAll = () => { const n = hits.length; hits.forEach((m) => m.replaceWith(document.createTextNode(ri.value))); hits = []; page.normalize(); onEdit(); cnt.textContent = n + ' ' + T('replaced'); };
      fi.oninput = PatOS.debounce(run, 150); mc.querySelector('input').onchange = run;
      fi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') closeFind(); });
      findBar.append(fi, cnt, OF.btn('<b class="of-t">‹</b>', 'Previous', () => step(-1)), OF.btn('<b class="of-t">›</b>', 'Next', () => step(1)), mc, ri, h('button', { class: 'btn', onclick: replaceOne }, T('Replace')), h('button', { class: 'btn', onclick: replaceAll }, T('Replace all')), OF.btn('<b class="of-t">×</b>', 'Close', closeFind));
      const s = getSelection().toString(); if (s && s.length < 80) { fi.value = s; run(); }
      setTimeout(() => fi.focus(), 30);
    }
    function clearMarks() { page.querySelectorAll('mark.dx-hit').forEach((m) => m.replaceWith(...m.childNodes)); page.normalize(); }
    function closeFind() { clearMarks(); findBar.classList.remove('on'); findBar.innerHTML = ''; page.focus(); }

    /* ---------- tools ---------- */
    function wordCount() {
      const t = page.innerText || '', sel = getSelection().toString();
      const sent = (t.match(/[^.!?]+[.!?]+/g) || []).length, paras = [...page.children].filter((x) => x.textContent.trim()).length;
      PatOS.alertBox(T('Word count'), [[T('Words'), words()], [T('Characters'), t.length], [T('Characters without spaces'), t.replace(/\s/g, '').length], [T('Sentences'), sent], [T('Paragraphs'), paras], sel ? [T('Selected words'), (sel.match(/\S+/g) || []).length] : null].filter(Boolean).map(([a, b]) => a + ': ' + b.toLocaleString()).join('\n'), { icon: 'docs' });
    }
    let rec = null;
    function voice() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return PatOS.alertBox(T('Voice typing isn’t available'), T('This browser can’t turn speech into text. Chrome on a computer or Android can.'), { icon: 'docs' });
      if (rec) { rec.stop(); return; }
      keepSel(); restoreSel();
      rec = new SR(); rec.lang = PatOS.lang === 'fr' ? 'fr-CA' : 'en-US'; rec.continuous = true; rec.interimResults = false;
      tbMic.classList.add('on', 'rec');
      rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { let txt = e.results[i][0].transcript.trim(); txt = txt.replace(/\b(period|point)\b/gi, '.').replace(/\b(comma|virgule)\b/gi, ','); page.focus(); document.execCommand('insertText', false, txt + ' '); onEdit(); } };
      rec.onerror = (e) => { if (e.error === 'not-allowed') PatOS.alertBox(T('Microphone blocked'), T('Allow the microphone for this site to use voice typing.'), { icon: 'docs' }); };
      rec.onend = () => { rec = null; tbMic.classList.remove('on', 'rec'); };
      try { rec.start(); OF.toast(win, T('Listening… press the microphone again to stop.')); } catch (e) { rec = null; tbMic.classList.remove('on', 'rec'); }
    }
    function readAloud() {
      if (!window.speechSynthesis) return;
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
      const text = getSelection().toString() || page.innerText; if (!text.trim()) return;
      const u = new SpeechSynthesisUtterance(text.slice(0, 30000)); u.lang = PatOS.lang === 'fr' ? 'fr-CA' : 'en-US'; speechSynthesis.speak(u);
    }
    function showHistory() {
      addVersion(true);
      const list = PatOS.store.get(vKey(path), []);
      const side = h('div', { class: 'dx-vlist' }), prev = h('div', { class: 'dx-vprev doc-page' });
      let pick = 0;
      const paint = () => { side.innerHTML = ''; list.forEach((v, i) => { const b = h('button', { class: i === pick ? 'on' : '' }, h('b', {}, new Date(v.t).toLocaleString(PatOS.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })), h('small', {}, (i === 0 ? T('Current version') + ' · ' : '') + v.words + ' ' + T('words'))); b.onclick = () => { pick = i; paint(); }; side.appendChild(b); }); prev.innerHTML = list[pick] ? list[pick].html : ''; };
      const layer = h('div', { class: 'dx-vlayer' }, h('div', { class: 'dx-vbox' }, h('div', { class: 'dx-vhead' }, h('b', {}, T('Version history')), h('div', { style: { flex: 1 } }), h('button', { class: 'btn', onclick: () => layer.remove() }, T('Close')), h('button', { class: 'btn primary', onclick: () => { if (!list[pick] || pick === 0) return layer.remove(); page.innerHTML = list[pick].html; onEdit(); addVersion(true); layer.remove(); OF.toast(win, T('Version restored')); } }, T('Restore this version'))), h('div', { class: 'dx-vbody' }, prev, side)));
      win.body.appendChild(layer); paint();
    }

    /* ---------- export ---------- */
    function docHTML() { return `<!doctype html><html><head><meta charset="utf-8"><title>${PatOS.esc(baseName())}</title><style>body{font-family:Inter,Arial,sans-serif;max-width:760px;margin:40px auto;line-height:1.55;padding:0 24px;color:#1d1d1f}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px 10px;text-align:left}th{background:#f3f4f6}img{max-width:100%}blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:14px;color:#555}pre{background:#f4f4f5;padding:10px;border-radius:6px}.dx-pb{page-break-after:always;height:0}ul.dx-check{list-style:none;padding-left:4px}ul.dx-check li::before{content:'☐ '}ul.dx-check li.done::before{content:'☑ '}ul.dx-check li.done{text-decoration:line-through;color:#888}.dx-toc a{display:block;color:#3b7cff;text-decoration:none}.dx-toc .l2{padding-left:14px}.dx-toc .l3{padding-left:28px}@page{margin:2cm}</style></head><body>${page.innerHTML}</body></html>`; }
    function toMarkdown() {
      const md = (n) => { if (n.nodeType === 3) return n.textContent; if (n.nodeType !== 1) return ''; const k = [...n.childNodes].map(md).join(''); switch (n.tagName) { case 'H1': return '# ' + k + '\n\n'; case 'H2': return '## ' + k + '\n\n'; case 'H3': return '### ' + k + '\n\n'; case 'H4': return '#### ' + k + '\n\n'; case 'P': case 'DIV': return k + '\n\n'; case 'B': case 'STRONG': return '**' + k + '**'; case 'I': case 'EM': return '*' + k + '*'; case 'A': return '[' + k + '](' + n.getAttribute('href') + ')'; case 'LI': return (n.parentNode.tagName === 'OL' ? '1. ' : n.parentNode.classList.contains('dx-check') ? (n.classList.contains('done') ? '- [x] ' : '- [ ] ') : '- ') + k + '\n'; case 'UL': case 'OL': return k + '\n'; case 'BLOCKQUOTE': return '> ' + k + '\n\n'; case 'PRE': return '```\n' + n.textContent + '\n```\n\n'; case 'BR': return '\n'; case 'HR': return '---\n\n'; case 'IMG': return '![](image)'; default: return k; } };
      return [...page.childNodes].map(md).join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }
    function download(anchor) {
      const r = (anchor || toolbar).getBoundingClientRect();
      PatOS.menu([
        { label: T('PDF (print, then Save as PDF)'), action: printDoc },
        { label: T('Word (.docx)'), action: async () => { try { clearMarks(); PatOS.downloadBlob(baseName() + '.docx', await PatOS.docx.fromElement(page, { title: baseName() })); } catch (err) { PatOS.alertBox(T('Couldn’t save'), err.message, { icon: 'docs' }); } } },
        { label: T('Web page (.html)'), action: () => PatOS.downloadFile(baseName() + '.html', docHTML()) },
        { label: 'Markdown (.md)', action: () => PatOS.downloadFile(baseName() + '.md', toMarkdown()) },
        { label: T('Plain text (.txt)'), action: () => PatOS.downloadFile(baseName() + '.txt', page.innerText) }
      ], r.left, r.bottom + 4);
    }
    function printDoc() {
      const f = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0' } }); document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(docHTML()); f.contentDocument.close();
      setTimeout(() => { try { f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 1000); }, 300);
    }
    head.right.append(h('button', { class: 'btn primary of-share', onclick: (e) => download(e.currentTarget), html: OF.icon('download', 15) + '<span>' + T('Download') + '</span>' }));

    /* ---------- typing helpers: Markdown shortcuts, checklists, keyboard ---------- */
    page.addEventListener('input', (e) => {
      onEdit();
      if (e.inputType !== 'insertText' || e.data !== ' ') return;
      const s = getSelection(); const n = s.anchorNode; if (!n || n.nodeType !== 3) return;
      const blk = n.parentNode.closest ? n.parentNode.closest('p, div, h1, h2, h3, h4') : null; if (!blk || blk === page || blk.textContent.length > 6) return;
      const pre = n.textContent.slice(0, s.anchorOffset).replace(/ /g, ' ');
      const rules = { '# ': ['formatBlock', 'h1'], '## ': ['formatBlock', 'h2'], '### ': ['formatBlock', 'h3'], '> ': ['formatBlock', 'blockquote'], '- ': ['insertUnorderedList'], '* ': ['insertUnorderedList'], '1. ': ['insertOrderedList'], '[] ': ['check'] };
      const r = rules[pre]; if (!r) return;
      n.textContent = n.textContent.slice(s.anchorOffset);
      if (!blk.textContent) blk.innerHTML = '<br>';
      const rg = document.createRange(); rg.setStart(blk, 0); rg.collapse(true); s.removeAllRanges(); s.addRange(rg);
      if (r[0] === 'check') { toggleChecklist(); return; }
      document.execCommand(r[0], false, r[1]); onEdit();
    });
    page.addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG') { selectImage(e.target); return; }
      const li = e.target.closest('ul.dx-check > li'); if (li && e.offsetX < 0) { li.classList.toggle('done'); onEdit(); }
      const a = e.target.closest('a[href]'); if (a && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const href = a.getAttribute('href'); if (href.startsWith('#')) { const t = page.querySelector(href); if (t) reveal(t); } else PatOS.launch('browser', { url: href }); }
      const toc = e.target.closest('.dx-toc a'); if (toc) { e.preventDefault(); const t = page.querySelector(toc.getAttribute('href')); if (t) reveal(t); }
    });
    page.addEventListener('pointerdown', (e) => { const li = e.target.closest('ul.dx-check > li'); if (li) { const r = li.getBoundingClientRect(); if (e.clientX < r.left + 2) { e.preventDefault(); li.classList.toggle('done'); onEdit(); } } });
    page.addEventListener('keyup', updateState); page.addEventListener('mouseup', updateState);
    page.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Tab') { const cell = getSelection().anchorNode && (getSelection().anchorNode.nodeType === 3 ? getSelection().anchorNode.parentNode : getSelection().anchorNode).closest('td, th'); e.preventDefault(); if (cell) { const all = [...cell.closest('table').querySelectorAll('td, th')]; const nx = all[all.indexOf(cell) + (e.shiftKey ? -1 : 1)]; if (nx) { const r = document.createRange(); r.selectNodeContents(nx); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); } return; } document.execCommand(e.shiftKey ? 'outdent' : 'indent'); return; }
      if (mod && k === 'f') { e.preventDefault(); openFind(); }
      else if (mod && k === 'k') { e.preventDefault(); insertLink(); }
      else if (mod && k === 'p') { e.preventDefault(); printDoc(); }
      else if (mod && k === 's') { e.preventDefault(); persist(); addVersion(true); OF.toast(win, T('Saved')); }
      else if (mod && e.shiftKey && k === 'c') { e.preventDefault(); wordCount(); }
      else if (mod && e.key === '\\') { e.preventDefault(); exec('removeFormat'); }
      else if (mod && (k === '=' || k === '+')) { e.preventDefault(); sizeStep(1)(); }
      else if (mod && k === '-') { e.preventDefault(); sizeStep(-1)(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (selImg) { e.preventDefault(); selImg.remove(); selectImage(null); onEdit(); } }
    });
    page.addEventListener('paste', (e) => {
      const it = [...((e.clipboardData || {}).items || [])].find((x) => x.type.startsWith('image/'));
      if (it) { e.preventDefault(); keepSel(); const r = new FileReader(); r.onload = () => shrink(r.result, (src) => insertHTML(`<img src="${src}" style="width:60%">`)); r.readAsDataURL(it.getAsFile()); }
    });
    win.on('closed', () => { if (rec) rec.stop(); if (window.speechSynthesis && speechSynthesis.speaking) speechSynthesis.cancel(); if (!trashed) try { clearMarks(); PatOS.fs.write(path, page.innerHTML); addVersion(); } catch (e) {} });
    stats(); renderOutline();
    setTimeout(() => { page.focus(); const r = document.createRange(); r.selectNodeContents(page); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, 80);
  }
})();
