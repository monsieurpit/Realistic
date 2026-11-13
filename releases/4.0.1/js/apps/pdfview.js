/* PatOS PDF viewer and annotator (used by Preview).
   - Pages are drawn with pdf.js, so text can be selected, copied and searched
   - Tools: highlight, pen, text, box and eraser, with undo and redo
   - Notes are kept with the file in PatOS (the PDF itself is not changed) and can be exported
     into a real PDF with pdf-lib: "Export PDF with Notes" saves a copy next to the original
   Both libraries live in vendor/pdf and are loaded the first time a PDF is opened. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const BASE = 'vendor/pdf/';

  /* ---------- loading the libraries once ---------- */
  const loaded = {};
  function script(src) {
    if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Couldn’t load ' + src)); }; document.head.appendChild(s); });
    return loaded[src];
  }
  async function pdfjs() {
    await script(BASE + 'pdf.min.js');
    const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';
    return lib;
  }
  async function pdflib() { await script(BASE + 'pdf-lib.min.js'); return window.PDFLib; }
  const available = () => /^https?:$/.test(location.protocol) && !PatOS.singleFile && !PatOS.sandboxed;

  /* ---------- the bytes of a PDF stored in PatOS ---------- */
  async function bytesOf(path) {
    const b = await PatOS.fs.getBlob(path); if (!b) throw new Error('missing');
    return new Uint8Array(await b.arrayBuffer());
  }

  const COLORS = { yellow: '#ffd60a', green: '#30d158', blue: '#0a84ff', pink: '#ff375f', red: '#ff3b30', black: '#1d1d1f' };
  const TOOLS = [['select', 'Select text', 'M5 3l14 8-6 2-2 6z'], ['highlight', 'Highlight', 'M4 20h16M7 16l9-9 3 3-9 9H7z'], ['pen', 'Pen', 'M3 21l3-1 12-12-2-2L4 18zM14 6l2 2'], ['text', 'Text', 'M5 5h14M12 5v14'], ['box', 'Box', 'M4 5h16v14H4z'], ['eraser', 'Eraser', 'M8 20h11M4 15l9-9 6 6-6 6H9z']];
  const ico = (d) => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const fold = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* PatOS.pdfView(win, path) fills the window with the viewer. Returns false when pdf.js can't be used here. */
  PatOS.pdfView = async function (win, path, host) {
    if (!available()) return false;
    let lib;
    try { lib = await pdfjs(); } catch (e) { return false; }
    const bytes = await bytesOf(path);
    let doc;
    try { doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false, standardFontDataUrl: BASE + 'standard_fonts/', useSystemFonts: true }).promise; }
    catch (e) {
      host.innerHTML = '';
      host.appendChild(h('div', { class: 'pv-empty' }, h('h2', {}, T(e && e.name === 'PasswordException' ? 'This PDF is protected by a password' : 'This PDF can’t be opened')), h('p', {}, T('It may be damaged, or not really a PDF.'))));
      return true;
    }

    /* ---------- state ---------- */
    const KEY = 'pdfAnn:' + path;
    const saved = PatOS.store.get(KEY, null);
    let ann = saved && saved.pages ? saved.pages : {}; // page number -> list of notes, in page units at 100%
    const undo = [], redo = [];
    let tool = 'select', color = 'yellow', scale = 1, fitMode = 'width', pages = [], current = 1;
    const snapshot = () => JSON.stringify(ann);
    const commit = (before) => { undo.push(before); if (undo.length > 60) undo.shift(); redo.length = 0; persist(); syncButtons(); };
    let pTimer = null;
    const saveNow = () => { pTimer = null; const empty = !Object.values(ann).some((l) => l && l.length); if (empty) PatOS.store.remove(KEY); else PatOS.store.set(KEY, { v: 1, pages: ann }); };
    const persist = () => { clearTimeout(pTimer); pTimer = setTimeout(saveNow, 300); };
    persist.flush = () => { if (pTimer) { clearTimeout(pTimer); saveNow(); } };

    /* ---------- toolbar ---------- */
    win.toolbar.innerHTML = '';
    const bSide = h('button', { class: 'tbtn', title: T('Pages'), html: ico('M4 4h6v16H4zM14 4h6M14 9h6M14 14h6M14 19h6') });
    const toolBtns = TOOLS.map(([id, label, d]) => { const b = h('button', { class: 'tbtn pdv-tool', title: T(label), 'aria-label': T(label), 'data-tool': id, html: ico(d) }); b.onclick = () => setTool(id); return b; });
    // one button shows the current color; its menu lists the others
    const cap = (k) => T(k[0].toUpperCase() + k.slice(1));
    const dot = h('span', { class: 'pdv-cdot', style: { background: COLORS.yellow } });
    const bColor = h('button', { class: 'tbtn pdv-cbtn', title: T('Color'), 'aria-label': T('Color') }, dot);
    bColor.onclick = () => { const r = bColor.getBoundingClientRect(); PatOS.menu(Object.keys(COLORS).map((k) => ({ label: cap(k), checked: color === k, action: () => { color = k; dot.style.background = COLORS[k]; } })), r.left, r.bottom + 4); };
    const bUndo = h('button', { class: 'tbtn', title: T('Undo'), html: ico('M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3') });
    const bRedo = h('button', { class: 'tbtn', title: T('Redo'), html: ico('M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3') });
    const pageIn = h('input', { class: 'field pdv-pagein', value: '1', 'aria-label': T('Page') });
    const pageOf = h('span', { class: 'pdv-of' }, '/ ' + doc.numPages);
    const bOut = h('button', { class: 'tbtn', title: T('Zoom out') }, '−'), zoomLbl = h('button', { class: 'tbtn pdv-zoom', title: T('Fit to width') }, '100%'), bIn = h('button', { class: 'tbtn', title: T('Zoom in') }, '+');
    const bFind = h('button', { class: 'tbtn', title: T('Find') + ' (Ctrl+F)', html: ico('M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4') });
    const bMore = h('button', { class: 'btn primary pdv-export' }, T('Export…'));
    win.toolbar.append(bSide, h('div', { class: 'pdv-tools' }, ...toolBtns), bColor, bUndo, bRedo, h('div', { style: { flex: 1, minWidth: '8px' } }), pageIn, pageOf, bOut, zoomLbl, bIn, bFind, bMore);

    /* ---------- layout ---------- */
    host.innerHTML = '';
    const side = h('div', { class: 'pdv-side hidden' });
    const scroller = h('div', { class: 'pdv-scroll', tabindex: '0' });
    const findBar = h('div', { class: 'pdv-find hidden' });
    const wrap = h('div', { class: 'pdv-wrap' }, side, h('div', { class: 'pdv-main' }, findBar, scroller));
    host.appendChild(wrap);

    /* ---------- pages ---------- */
    const first = await doc.getPage(1); const base1 = first.getViewport({ scale: 1 });
    function fitScale() { const w = scroller.clientWidth - 48; return Math.max(0.4, Math.min(2.2, w / base1.width)); }
    for (let i = 1; i <= doc.numPages; i++) {
      const el = h('div', { class: 'pdv-page', 'data-page': i });
      const p = { i, el, page: null, vp1: null, rendered: 0, task: null };
      pages.push(p); scroller.appendChild(el);
    }
    async function pageInfo(p) { if (!p.page) { p.page = await doc.getPage(p.i); p.vp1 = p.page.getViewport({ scale: 1 }); } return p; }
    function sizePages() {
      pages.forEach((p) => { const vp = p.vp1 || base1; p.el.style.width = Math.round(vp.width * scale) + 'px'; p.el.style.height = Math.round(vp.height * scale) + 'px'; p.el.style.setProperty('--scale-factor', scale); });
      zoomLbl.textContent = Math.round(scale * 100) + '%';
    }
    // draw the pages on screen (and a page above and below); pages far away are let go to save memory
    async function render(p) {
      await pageInfo(p);
      if (p.rendered === scale) return; p.rendered = scale;
      const vp = p.page.getViewport({ scale });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvas = h('canvas', { class: 'pdv-canvas' }); canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = Math.round(vp.width) + 'px'; canvas.style.height = Math.round(vp.height) + 'px';
      if (p.task) { try { p.task.cancel(); } catch (e) {} }
      const ctx = canvas.getContext('2d');
      p.task = p.page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      try { await p.task.promise; } catch (e) { if (e && e.name === 'RenderingCancelledException') return; }
      p.task = null;
      const old = p.el.querySelector('.pdv-canvas'); if (old) old.replaceWith(canvas); else p.el.prepend(canvas);
      // text layer: lets people select, copy and search the text
      const tl = h('div', { class: 'textLayer' });
      try { const tc = await p.page.getTextContent(); const tt = lib.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp }); await tt.promise; } catch (e) {}
      const oldTl = p.el.querySelector('.textLayer'); if (oldTl) oldTl.replaceWith(tl); else p.el.appendChild(tl);
      drawAnn(p); markHits(p);
    }
    function release(p) { if (!p.rendered) return; const c = p.el.querySelector('.pdv-canvas'); if (c) { c.width = c.height = 0; c.remove(); } const t = p.el.querySelector('.textLayer'); if (t) t.remove(); p.rendered = 0; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { const p = pages[+en.target.dataset.page - 1]; if (en.isIntersecting) { render(p); if (pages[p.i]) render(pages[p.i]); } });
      // keep at most about 12 pages drawn
      const drawn = pages.filter((p) => p.rendered); if (drawn.length > 12) { const mid = current; drawn.sort((a, b) => Math.abs(b.i - mid) - Math.abs(a.i - mid)).slice(0, drawn.length - 12).forEach(release); }
    }, { root: scroller, rootMargin: '400px 0px' });
    pages.forEach((p) => io.observe(p.el));

    /* ---------- notes layer ---------- */
    function layer(p) {
      let svg = p.el.querySelector('.pdv-svg');
      if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'pdv-svg'); p.el.appendChild(svg); }
      const vp = p.vp1 || base1; svg.setAttribute('viewBox', '0 0 ' + vp.width + ' ' + vp.height); svg.setAttribute('preserveAspectRatio', 'none');
      return svg;
    }
    const svgEl = (tag, attrs) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    function drawAnn(p) {
      const svg = layer(p); svg.innerHTML = '';
      p.el.querySelectorAll('.pdv-note').forEach((n) => n.remove());
      (ann[p.i] || []).forEach((a, idx) => {
        let e = null;
        if (a.t === 'hl') e = svgEl('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: COLORS[a.c] || a.c, 'fill-opacity': 0.38, class: 'pdv-a pdv-hl' });
        else if (a.t === 'box') e = svgEl('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: 'none', stroke: COLORS[a.c] || a.c, 'stroke-width': a.s || 2, class: 'pdv-a' });
        else if (a.t === 'ink') e = svgEl('polyline', { points: a.p.map((q) => q.join(',')).join(' '), fill: 'none', stroke: COLORS[a.c] || a.c, 'stroke-width': a.s || 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'pdv-a' });
        else if (a.t === 'text') {
          const n = h('div', { class: 'pdv-note', 'data-idx': idx, style: { left: (a.x * scale) + 'px', top: (a.y * scale) + 'px', fontSize: (a.fs * scale) + 'px', color: COLORS[a.c] || a.c } }, a.text);
          n.addEventListener('pointerdown', (ev) => { if (tool === 'eraser') { ev.stopPropagation(); remove(p, idx); } else if (tool === 'text') { ev.stopPropagation(); ev.preventDefault(); editText(p, idx); } });
          p.el.appendChild(n); return;
        }
        if (e) { e.dataset.idx = idx; svg.appendChild(e); }
      });
    }
    function remove(p, idx) { const before = snapshot(); ann[p.i].splice(idx, 1); commit(before); drawAnn(p); }
    function addNote(p, a) { const before = snapshot(); (ann[p.i] = ann[p.i] || []).push(a); commit(before); drawAnn(p); }

    /* ---------- drawing with the mouse, pen or finger ---------- */
    const local = (p, ev) => { const r = p.el.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) / scale * 10) / 10, Math.round((ev.clientY - r.top) / scale * 10) / 10]; };
    scroller.addEventListener('pointerdown', async (ev) => {
      const pel = ev.target.closest('.pdv-page'); if (!pel || ev.button > 0) return;
      const p = pages[+pel.dataset.page - 1]; await pageInfo(p);
      if (tool === 'select') return;
      if (tool === 'eraser') { const t = ev.target.closest('.pdv-a'); if (t) remove(p, +t.dataset.idx); return; }
      ev.preventDefault();
      const [x0, y0] = local(p, ev); const svg = layer(p);
      if (tool === 'text') { startText(p, x0, y0); return; }
      let live; const pts = [[x0, y0]];
      if (tool === 'pen') live = svgEl('polyline', { points: x0 + ',' + y0, fill: 'none', stroke: COLORS[color], 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      else live = svgEl('rect', { x: x0, y: y0, width: 0, height: 0, fill: tool === 'highlight' ? COLORS[color] : 'none', 'fill-opacity': 0.38, stroke: tool === 'box' ? COLORS[color] : 'none', 'stroke-width': 2 });
      svg.appendChild(live);
      pel.setPointerCapture(ev.pointerId);
      const move = (e2) => {
        const [x, y] = local(p, e2);
        if (tool === 'pen') { const l = pts[pts.length - 1]; if (Math.hypot(x - l[0], y - l[1]) > 1.2) { pts.push([x, y]); live.setAttribute('points', pts.map((q) => q.join(',')).join(' ')); } }
        else { live.setAttribute('x', Math.min(x0, x)); live.setAttribute('y', Math.min(y0, y)); live.setAttribute('width', Math.abs(x - x0)); live.setAttribute('height', Math.abs(y - y0)); pts[1] = [x, y]; }
      };
      const up = () => {
        pel.removeEventListener('pointermove', move); pel.removeEventListener('pointerup', up); pel.removeEventListener('pointercancel', up);
        live.remove();
        if (tool === 'pen') { if (pts.length > 1) addNote(p, { t: 'ink', p: pts, c: color, s: 2 }); return; }
        if (!pts[1]) return; const [x1, y1] = pts[1];
        const r = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
        if (r.w < 3 || r.h < 3) return;
        addNote(p, Object.assign({ t: tool === 'highlight' ? 'hl' : 'box', c: color, s: 2 }, r));
      };
      pel.addEventListener('pointermove', move); pel.addEventListener('pointerup', up); pel.addEventListener('pointercancel', up);
    });
    // text notes: click to place, type, click elsewhere to finish
    function startText(p, x, y, idx) {
      const a = idx != null ? ann[p.i][idx] : { t: 'text', x, y, text: '', fs: 14, c: color === 'yellow' ? 'black' : color };
      const box = h('div', { class: 'pdv-note editing', contenteditable: 'true', spellcheck: 'true', style: { left: (a.x * scale) + 'px', top: (a.y * scale) + 'px', fontSize: (a.fs * scale) + 'px', color: COLORS[a.c] || a.c } });
      box.textContent = a.text;
      if (idx != null) { const old = p.el.querySelector('.pdv-note[data-idx="' + idx + '"]'); if (old) old.remove(); }
      p.el.appendChild(box); setTimeout(() => { box.focus(); const r = document.createRange(); r.selectNodeContents(box); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, 0);
      box.addEventListener('pointerdown', (e) => e.stopPropagation());
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.blur(); e.stopPropagation(); });
      box.addEventListener('blur', () => {
        const text = box.innerText.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trimEnd(); box.remove();
        const before = snapshot();
        if (idx != null) { if (!text.trim()) ann[p.i].splice(idx, 1); else ann[p.i][idx] = Object.assign({}, a, { text }); commit(before); }
        else if (text.trim()) { (ann[p.i] = ann[p.i] || []).push(Object.assign({}, a, { text })); commit(before); }
        drawAnn(p);
      });
    }
    function editText(p, idx) { startText(p, 0, 0, idx); }

    /* ---------- tools ---------- */
    function setTool(t) {
      tool = t; toolBtns.forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
      host.dataset.tool = t;
    }
    setTool('select');
    function syncButtons() { bUndo.disabled = !undo.length; bRedo.disabled = !redo.length; }
    function step(from, to) { if (!from.length) return; to.push(snapshot()); ann = JSON.parse(from.pop()); persist(); syncButtons(); pages.forEach((p) => p.rendered && drawAnn(p)); }
    bUndo.onclick = () => step(undo, redo); bRedo.onclick = () => step(redo, undo); syncButtons();

    /* ---------- zoom and pages ---------- */
    function setScale(s, keep) {
      const ratio = scroller.scrollTop / Math.max(1, scroller.scrollHeight);
      scale = Math.max(0.3, Math.min(4, s)); sizePages();
      pages.forEach((p) => { if (p.rendered) { p.rendered = -1; render(p); } });
      if (keep !== false) scroller.scrollTop = ratio * scroller.scrollHeight;
    }
    bIn.onclick = () => { fitMode = null; setScale(scale * 1.2); };
    bOut.onclick = () => { fitMode = null; setScale(scale / 1.2); };
    zoomLbl.onclick = () => { fitMode = 'width'; setScale(fitScale()); };
    scroller.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); fitMode = null; setScale(scale * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });
    const ro = new ResizeObserver(PatOS.debounce(() => { if (fitMode === 'width' && Math.abs(fitScale() - scale) > 0.02) setScale(fitScale()); }, 150)); ro.observe(scroller);
    function goTo(n, smooth) { n = Math.max(1, Math.min(doc.numPages, n)); const el = pages[n - 1].el; scroller.scrollTo({ top: el.offsetTop - 12, behavior: smooth ? 'smooth' : 'auto' }); }
    pageIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { goTo(parseInt(pageIn.value, 10) || 1, true); pageIn.blur(); } });
    scroller.addEventListener('scroll', PatOS.debounce(() => {
      const mid = scroller.scrollTop + scroller.clientHeight / 3; let n = 1;
      for (const p of pages) { if (p.el.offsetTop <= mid) n = p.i; else break; }
      if (n !== current) { current = n; if (document.activeElement !== pageIn) pageIn.value = n; side.querySelectorAll('.pdv-th').forEach((t) => t.classList.toggle('on', +t.dataset.page === n)); }
    }, 60));
    scroller.addEventListener('keydown', (e) => {
      if (e.target.isContentEditable) return;
      if (e.key === 'PageDown' || (e.key === 'ArrowRight' && !e.ctrlKey)) { e.preventDefault(); goTo(current + 1); }
      if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && !e.ctrlKey)) { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'Home') { e.preventDefault(); goTo(1); } if (e.key === 'End') { e.preventDefault(); goTo(doc.numPages); }
    });

    /* ---------- page thumbnails ---------- */
    let thumbsMade = false;
    bSide.onclick = () => {
      side.classList.toggle('hidden'); bSide.classList.toggle('on', !side.classList.contains('hidden'));
      if (thumbsMade || side.classList.contains('hidden')) return; thumbsMade = true;
      const tio = new IntersectionObserver((en) => en.forEach(async (x) => {
        if (!x.isIntersecting || x.target.dataset.done) return; x.target.dataset.done = '1'; tio.unobserve(x.target);
        const p = await pageInfo(pages[+x.target.dataset.page - 1]); const vp = p.page.getViewport({ scale: 110 / p.vp1.width });
        const c = h('canvas'); c.width = vp.width; c.height = vp.height; x.target.prepend(c);
        try { await p.page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; } catch (e) {}
      }), { root: side, rootMargin: '200px 0px' });
      pages.forEach((p) => { const t = h('button', { class: 'pdv-th' + (p.i === current ? ' on' : ''), 'data-page': p.i }, h('span', {}, String(p.i))); t.onclick = () => goTo(p.i, true); side.appendChild(t); tio.observe(t); });
    };

    /* ---------- find ---------- */
    let texts = null, hits = [], hitAt = -1, query = '';
    const fIn = h('input', { class: 'field', placeholder: T('Find in this PDF'), 'aria-label': T('Find in this PDF') });
    const fCount = h('span', { class: 'pdv-fcount' });
    const fPrev = h('button', { class: 'tbtn', title: T('Previous') }, '‹'), fNext = h('button', { class: 'tbtn', title: T('Next') }, '›');
    const fClose = h('button', { class: 'tbtn', title: T('Close') }, '×');
    findBar.append(fIn, fCount, fPrev, fNext, fClose);
    async function allText() {
      if (texts) return texts; texts = [];
      for (const p of pages) { await pageInfo(p); try { const tc = await p.page.getTextContent(); texts.push(fold(tc.items.map((it) => it.str).join(' '))); } catch (e) { texts.push(''); } }
      return texts;
    }
    function markHits(p) {
      const tl = p.el.querySelector('.textLayer'); if (!tl) return;
      tl.querySelectorAll('.pdv-hit').forEach((s) => s.classList.remove('pdv-hit', 'cur'));
      if (!query) return;
      tl.querySelectorAll('span').forEach((s) => { if (fold(s.textContent).includes(query)) s.classList.add('pdv-hit'); });
      if (hits[hitAt] === p.i) { const f = tl.querySelector('.pdv-hit'); if (f) f.classList.add('cur'); }
    }
    const runFind = PatOS.debounce(async () => {
      query = fold(fIn.value.trim()); hits = []; hitAt = -1;
      if (!query) { fCount.textContent = ''; pages.forEach(markHits); return; }
      fCount.textContent = T('Searching…');
      const tx = await allText();
      tx.forEach((t, i) => { let k = t.indexOf(query); while (k >= 0) { hits.push(i + 1); k = t.indexOf(query, k + query.length); } });
      if (!hits.length) { fCount.textContent = T('Not found'); pages.forEach(markHits); return; }
      hitAt = Math.max(0, hits.findIndex((pg) => pg >= current)); showHit();
    }, 200);
    function showHit() { fCount.textContent = (hitAt + 1) + ' / ' + hits.length; goTo(hits[hitAt]); pages.forEach(markHits); }
    fIn.addEventListener('input', runFind);
    fIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && hits.length) { hitAt = (hitAt + (e.shiftKey ? -1 : 1) + hits.length) % hits.length; showHit(); } if (e.key === 'Escape') fClose.click(); });
    fNext.onclick = () => { if (hits.length) { hitAt = (hitAt + 1) % hits.length; showHit(); } };
    fPrev.onclick = () => { if (hits.length) { hitAt = (hitAt - 1 + hits.length) % hits.length; showHit(); } };
    fClose.onclick = () => { findBar.classList.add('hidden'); fIn.value = ''; query = ''; hits = []; pages.forEach(markHits); scroller.focus(); };
    bFind.onclick = () => { findBar.classList.remove('hidden'); fIn.focus(); fIn.select(); };
    win.el.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); bFind.click(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.isContentEditable && e.target.tagName !== 'INPUT') { e.preventDefault(); (e.shiftKey ? bRedo : bUndo).click(); }
    });

    /* ---------- export: a real PDF with the notes drawn in ---------- */
    async function exportPDF() {
      const L = await pdflib();
      const out = await L.PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await out.embedFont(L.StandardFonts.Helvetica);
      const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return L.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
      // Helvetica only knows Western letters; anything else becomes "?" rather than failing
      const safe = (s) => [...s].map((ch) => { try { font.encodeText(ch); return ch; } catch (e) { return '?'; } }).join('');
      for (const [num, list] of Object.entries(ann)) {
        if (!list || !list.length) continue;
        const pg = out.getPage(+num - 1); const p = await pageInfo(pages[+num - 1]); const vp = p.vp1;
        const toPdf = (x, y) => vp.convertToPdfPoint(x, y);
        const rect = (a) => { const [ax, ay] = toPdf(a.x, a.y), [bx, by] = toPdf(a.x + a.w, a.y + a.h); return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) }; };
        const rot = ((pg.getRotation().angle % 360) + 360) % 360;
        for (const a of list) {
          const col = rgb(COLORS[a.c] || '#000000');
          if (a.t === 'hl') pg.drawRectangle(Object.assign(rect(a), { color: col, opacity: 0.38, blendMode: L.BlendMode.Multiply }));
          else if (a.t === 'box') pg.drawRectangle(Object.assign(rect(a), { borderColor: col, borderWidth: a.s || 2 }));
          else if (a.t === 'ink') for (let k = 1; k < a.p.length; k++) { const [x1, y1] = toPdf(a.p[k - 1][0], a.p[k - 1][1]), [x2, y2] = toPdf(a.p[k][0], a.p[k][1]); pg.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: a.s || 2, color: col, lineCap: L.LineCapStyle.Round }); }
          else if (a.t === 'text') {
            a.text.split('\n').forEach((line, k) => {
              // the baseline sits one font size below the top of the note, each line 1.25 sizes lower
              const [x, y] = toPdf(a.x + 2, a.y + a.fs * (1 + k * 1.25));
              pg.drawText(safe(line), { x, y, size: a.fs, font, color: col, rotate: L.degrees(rot) });
            });
          }
        }
      }
      return new Blob([await out.save()], { type: 'application/pdf' });
    }
    bMore.onclick = () => {
      const r = bMore.getBoundingClientRect();
      const hasNotes = Object.values(ann).some((l) => l && l.length);
      PatOS.menu([
        { label: T('Export PDF with Notes'), disabled: !hasNotes, action: () => doExport('save') },
        { label: T('Download PDF with Notes to This Chromebook'), disabled: !hasNotes, action: () => doExport('download') },
        { label: T('Print…'), action: () => doExport('print') },
        { divider: true },
        { label: T('Clear All Notes'), disabled: !hasNotes, action: async () => { if (await PatOS.confirmBox(T('Clear all notes?'), T('Every highlight, drawing and text note on this PDF will be removed.'), { ok: T('Clear'), danger: true, icon: 'preview' })) { const before = snapshot(); ann = {}; commit(before); pages.forEach((p) => p.rendered && drawAnn(p)); } } }
      ], r.left - 120, r.bottom + 4);
    };
    async function doExport(kind) {
      let blob;
      try { blob = Object.values(ann).some((l) => l && l.length) ? await exportPDF() : new Blob([bytes], { type: 'application/pdf' }); }
      catch (e) { PatOS.alertBox(T('The PDF couldn’t be exported'), String(e && e.message || e), { icon: 'preview' }); return; }
      const base = PatOS.fs.basename(path).replace(/\.pdf$/i, '');
      if (kind === 'download') return PatOS.downloadBlob(base + ' (' + T('with notes') + ').pdf', blob);
      if (kind === 'print') { const url = URL.createObjectURL(blob); PatOS.openExternal(url); setTimeout(() => URL.revokeObjectURL(url), 60000); return; }
      const dir = PatOS.fs.dirname(path); const name = PatOS.fs.uniqueName(dir, base + ' (' + T('with notes') + ').pdf');
      try { await PatOS.fs.writeBlob(dir + '/' + name, blob); } catch (e) { PatOS.alertBox(T('The PDF couldn’t be saved'), String(e && e.message || e), { icon: 'preview' }); return; }
      PatOS.notify({ title: T('PDF saved'), body: name + ' · ' + T('Click to show it in Piles'), icon: 'preview', onClick: () => PatOS.launch('finder', { path: dir }) });
    }

    /* ---------- start ---------- */
    scale = fitScale(); sizePages();
    await Promise.all(pages.slice(0, Math.min(3, pages.length)).map(pageInfo)); sizePages();
    // all page sizes in the background, so the scroll bar is right for mixed page sizes
    (async () => { for (const p of pages) { await pageInfo(p); } sizePages(); })();
    win.on('closed', () => { io.disconnect(); ro.disconnect(); persist.flush && persist.flush(); try { doc.destroy(); } catch (e) {} });
    win.setTitle(PatOS.fs.basename(path));
    scroller.focus();
    win._pdf = { exportPDF, get ann() { return ann; }, setTool, goTo, get scale() { return scale; } };
    return true;
  };
})();
