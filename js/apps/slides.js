/* Slides — build presentations and present them full screen. Saved as .pslides */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const W = 960, H = 540;
  const THEMES = {
    Simple: { bg: '#ffffff', fg: '#1d1d1f', accent: '#0a84ff', font: 'Inter, Arial, sans-serif', head: 'Inter, Arial, sans-serif' },
    Midnight: { bg: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', fg: '#ffffff', accent: '#64d2ff', font: 'Inter, Arial, sans-serif', head: 'Georgia, serif' },
    Sunset: { bg: 'linear-gradient(135deg,#ff9a8b,#ff6a88,#ff99ac)', fg: '#ffffff', accent: '#fff3b0', font: '"Trebuchet MS", sans-serif', head: '"Trebuchet MS", sans-serif' },
    Forest: { bg: 'linear-gradient(135deg,#134e5e,#71b280)', fg: '#ffffff', accent: '#e0ffb3', font: 'Verdana, sans-serif', head: 'Georgia, serif' },
    Neon: { bg: 'linear-gradient(135deg,#0b0130,#3a0ca3)', fg: '#ffffff', accent: '#ff4fd8', font: '"Courier New", monospace', head: '"Courier New", monospace' },
    Paper: { bg: '#f5efe0', fg: '#3b2f2f', accent: '#b5651d', font: 'Georgia, serif', head: 'Georgia, serif' },
    Ocean: { bg: 'linear-gradient(160deg,#e0f2fe,#bae6fd)', fg: '#0c4a6e', accent: '#0284c7', font: 'Inter, Arial, sans-serif', head: 'Inter, Arial, sans-serif' },
    Graphite: { bg: '#1c1c1e', fg: '#f5f5f7', accent: '#ff9f0a', font: 'Inter, Arial, sans-serif', head: 'Inter, Arial, sans-serif' },
    Candy: { bg: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)', fg: '#2d1b4e', accent: '#7c3aed', font: '"Trebuchet MS", sans-serif', head: '"Trebuchet MS", sans-serif' },
    Mint: { bg: '#ecfdf5', fg: '#064e3b', accent: '#10b981', font: 'Inter, Arial, sans-serif', head: 'Georgia, serif' }
  };
  const fr = () => PatOS.lang === 'fr';
  const LAYOUTS = {
    title: { name: 'Title slide', els: () => [{ type: 'text', role: 'title', x: 80, y: 170, w: 800, h: 120, html: T('Presentation title'), size: 60, bold: 1, align: 'center' }, { type: 'text', x: 180, y: 300, w: 600, h: 60, html: T('Subtitle'), size: 26, align: 'center', accent: 1 }] },
    content: { name: 'Title and content', els: () => [{ type: 'text', role: 'title', x: 60, y: 40, w: 840, h: 90, html: T('Slide title'), size: 44, bold: 1 }, { type: 'text', x: 60, y: 150, w: 840, h: 340, html: fr() ? '<ul><li>Premier point</li><li>Deuxième point</li><li>Troisième point</li></ul>' : '<ul><li>First point</li><li>Second point</li><li>Third point</li></ul>', size: 28 }] },
    section: { name: 'Section header', els: () => [{ type: 'shape', shape: 'rect', x: 0, y: 0, w: 14, h: 540, fill: 'accent' }, { type: 'text', role: 'title', x: 80, y: 200, w: 800, h: 90, html: T('Section'), size: 56, bold: 1 }, { type: 'text', x: 80, y: 290, w: 800, h: 50, html: T('What this part is about'), size: 24, accent: 1 }] },
    two: { name: 'Two columns', els: () => [{ type: 'text', role: 'title', x: 60, y: 40, w: 840, h: 90, html: T('Slide title'), size: 44, bold: 1 }, { type: 'text', x: 60, y: 150, w: 400, h: 330, html: '<b>' + T('Left') + '</b><br>' + T('Write here'), size: 24 }, { type: 'text', x: 500, y: 150, w: 400, h: 330, html: '<b>' + T('Right') + '</b><br>' + T('Write here'), size: 24 }] },
    image: { name: 'Image and caption', els: () => [{ type: 'shape', shape: 'rounded', x: 60, y: 60, w: 520, h: 420, fill: 'rgba(128,128,128,.25)' }, { type: 'text', x: 70, y: 245, w: 500, h: 50, html: T('Add a picture with Image in the toolbar'), size: 18, align: 'center' }, { type: 'text', role: 'title', x: 620, y: 150, w: 300, h: 120, html: T('Caption title'), size: 36, bold: 1 }, { type: 'text', x: 620, y: 280, w: 300, h: 160, html: T('A few words about the picture.'), size: 20 }] },
    number: { name: 'Big number', els: () => [{ type: 'text', role: 'title', x: 80, y: 120, w: 800, h: 200, html: '87%', size: 160, bold: 1, align: 'center', accent: 1 }, { type: 'text', x: 180, y: 340, w: 600, h: 80, html: T('of something important'), size: 30, align: 'center' }] },
    quote: { name: 'Quote', els: () => [{ type: 'text', x: 120, y: 140, w: 720, h: 200, html: '“' + T('A great quote goes here.') + '”', size: 44, align: 'center', italic: 1 }, { type: 'text', x: 220, y: 360, w: 520, h: 50, html: '— ' + T('Someone famous'), size: 22, align: 'center', accent: 1 }] },
    blank: { name: 'Blank', els: () => [] }
  };
  const SHAPES = [['rect', 'Rectangle'], ['rounded', 'Rounded rectangle'], ['circle', 'Circle'], ['triangle', 'Triangle'], ['arrow', 'Arrow'], ['star', 'Star'], ['line', 'Line'], ['bubble', 'Speech bubble']];
  const CLIP = { triangle: 'polygon(50% 0, 100% 100%, 0 100%)', arrow: 'polygon(0 30%, 62% 30%, 62% 0, 100% 50%, 62% 100%, 62% 70%, 0 70%)', star: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', bubble: 'polygon(0 0, 100% 0, 100% 75%, 35% 75%, 18% 100%, 20% 75%, 0 75%)' };
  const ANIMS = [['', 'None'], ['fade', 'Fade in'], ['fly', 'Fly in'], ['zoom', 'Zoom in'], ['pop', 'Pop']];

  PatOS.slideThemes = THEMES;
  function slideNode(deck, s, scale, opts) {
    opts = opts || {};
    const t = THEMES[deck.theme] || THEMES.Simple;
    const node = h('div', { class: 'sl-slide', style: { width: W + 'px', height: H + 'px', background: s.bg || t.bg, color: t.fg, fontFamily: t.font, transform: `scale(${scale})` } });
    s.els.forEach((el, i) => {
      const box = h('div', { class: 'sl-el ' + el.type + (opts.sel && opts.sel.includes(el) ? ' on' : ''), 'data-i': i, style: { left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: el.h + 'px', opacity: el.opacity != null ? el.opacity : '' } });
      if (el.type === 'text') { box.innerHTML = el.html; Object.assign(box.style, { fontSize: el.size + 'px', fontWeight: el.bold ? '700' : '400', fontStyle: el.italic ? 'italic' : '', textDecoration: el.underline ? 'underline' : '', textAlign: el.align || 'left', color: el.color || (el.accent ? t.accent : ''), fontFamily: el.role === 'title' ? t.head : '', background: el.fill || '' }); }
      if (el.type === 'image') box.appendChild(h('img', { src: el.src, alt: '', draggable: 'false', style: { borderRadius: (el.radius || 0) + 'px' } }));
      if (el.type === 'shape') {
        const fill = el.fill === 'accent' ? t.accent : el.fill;
        if (el.shape === 'line') Object.assign(box.style, { background: 'transparent', borderTop: Math.max(2, el.stroke || 4) + 'px solid ' + fill, height: Math.max(8, el.h) + 'px' });
        else Object.assign(box.style, { background: fill, borderRadius: el.shape === 'circle' ? '50%' : el.shape === 'rounded' ? '18px' : el.shape === 'rect' ? '4px' : '', clipPath: CLIP[el.shape] || '' });
      }
      if (opts.hideAnim && el.anim && opts.step != null && i >= 0) { const order = s.els.filter((x) => x.anim).indexOf(el); if (order >= opts.step) box.style.visibility = 'hidden'; box.dataset.anim = el.anim; box.dataset.order = order; }
      node.appendChild(box);
    });
    return node;
  }
  PatOS.slideNode = slideNode;

  PatOS.registerApp({
    id: 'slides', name: 'Slides', icon: 'slides', single: false, width: 1140, height: 740, category: 'Office', keywords: 'presentation powerpoint keynote deck google slides présentations',
    about: 'Make slide decks with themes, layouts, shapes, animations and speaker notes, then present them.',
    launch(win, args) {
      win.el.classList.add('office-win', 'sv-win');
      win.setTitle(T('Slides'));
      if (args.path) return openDeck(win, args.path);
      const templates = Object.keys(THEMES).map((k) => ({ name: k, theme: k, preview: '' }));
      const ss = PatOS.office.startScreen(win, {
        title: 'Slides', icon: 'slides', ext: ['pslides'], templates,
        onCreate: (t) => { const deck = { theme: t.theme, transition: 'fade', slides: [{ els: LAYOUTS.title.els() }, { els: LAYOUTS.content.els() }] }; deck.slides[0].els[0].html = T('My Presentation'); deck.slides[0].els[1].html = PatOS.settings.userName || T('Subtitle'); const p = PatOS.newDocPath('/Documents', 'Untitled presentation', 'pslides'); PatOS.fs.write(p, JSON.stringify(deck)); openDeck(win, p); },
        onOpen: (p) => openDeck(win, p),
        importLabel: 'Open a PowerPoint file…', importAccept: '.pptx', onImportFile: async (file) => { if (/\.csv$/i.test(file.name)) { const p = '/Documents/' + PatOS.fs.uniqueName('/Documents', file.name); PatOS.fs.write(p, await file.text()); return p; } return (await PatOS.importOffice(file, file.name)).path; }
      });
      // live theme previews on the template cards
      ss.querySelectorAll('.of-tplprev').forEach((pv, i) => {
        pv.classList.add('wide'); pv.style.padding = '0'; pv.style.position = 'relative';
        const deck = { theme: templates[i].theme, slides: [] };
        const n = slideNode(deck, { els: LAYOUTS.title.els().map((e, j) => Object.assign(e, { html: j ? T('Subtitle') : templates[i].name })) }, 0.14);
        n.style.transformOrigin = 'top left'; pv.appendChild(n);
        requestAnimationFrame(() => { n.style.transform = 'scale(' + (pv.clientWidth / W) + ')'; });
      });
    }
  });

  function openDeck(win, path) {
    PatOS.remember && PatOS.remember(win, { path });
    const OF = PatOS.office;
    win.el.classList.add('has-toolbar');
    let deck; try { deck = JSON.parse(PatOS.fs.read(path)); } catch (e) { deck = null; }
    if (!deck || !deck.slides) deck = { theme: 'Simple', transition: 'fade', slides: [{ els: LAYOUTS.title.els() }] };
    if (!deck.slides.length) deck.slides.push({ els: [] });
    let cur = 0, sel = [];
    const baseName = () => PatOS.fs.basename(path).replace(/\.pslides$/, '');
    const head = OF.header(win, {
      name: baseName(), icon: 'slides', getPath: () => path,
      onRename: (nn) => { nn = (nn || T('Untitled presentation')).replace(/[\/]/g, '-'); try { path = PatOS.fs.rename(path, PatOS.fs.uniqueName(PatOS.fs.dirname(path), nn + '.pslides')); PatOS.remember && PatOS.remember(win, { path }); } catch (e) {} head.name.value = baseName(); win.setTitle(baseName()); }
    });
    win.toolbar.append(head.el); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
    win.setTitle(baseName());
    const bPresent = h('button', { class: 'btn primary of-share', html: OF.icon('play', 15) + '<span>' + T('Present') + '</span>' });
    const bPresentMenu = h('button', { class: 'btn of-share', title: T('More ways to present'), html: OF.icon('more', 15) });
    head.right.append(h('button', { class: 'btn of-share', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ label: T('PowerPoint (.pptx)'), action: async () => { try { PatOS.downloadBlob(baseName() + '.pptx', await PatOS.pptx.fromDeck(deck, THEMES)); } catch (err) { PatOS.alertBox(T('Couldn’t save'), err.message, { icon: 'slides' }); } } }, { label: T('PDF (print, then Save as PDF)'), action: printDeck }], r.left - 100, r.bottom + 4); }, title: T('Download'), html: OF.icon('download', 15) }), bPresentMenu, bPresent);

    /* ---------- toolbar ---------- */
    const B = OF.btn;
    const one = () => (sel.length === 1 ? sel[0] : null);
    const sizeIn = h('input', { class: 'of-size', value: '28', title: T('Text size') });
    sizeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { setAll('size', Math.max(8, Math.min(200, +sizeIn.value || 28))); } });
    const themeSel = h('select', { class: 'of-sel', title: T('Theme') }, ...Object.keys(THEMES).map((k) => h('option', { value: k }, k)));
    themeSel.value = deck.theme; themeSel.onchange = () => { snap(); deck.theme = themeSel.value; save(); render(); };
    const transSel = h('select', { class: 'of-sel', title: T('Transition') }, ...[['fade', 'Fade'], ['slide', 'Slide'], ['zoom', 'Zoom'], ['flip', 'Flip'], ['cube', 'Cube'], ['none', 'None']].map(([v, l]) => h('option', { value: v }, T(l))));
    transSel.value = deck.transition || 'fade'; transSel.onchange = () => { deck.transition = transSel.value; save(); };
    const animSel = h('select', { class: 'of-sel', title: T('Animation (appears on click)') }, ...ANIMS.map(([v, l]) => h('option', { value: v }, T(l))));
    animSel.onchange = () => setAll('anim', animSel.value || null);
    const toolbar = h('div', { class: 'of-bar' },
      B('undo', 'Undo (Ctrl+Z)', undo), B('redo', 'Redo (Ctrl+Y)', redo), OF.sep(),
      B('plus', 'New slide', (e, b) => layoutPicker(b), { label: 'Slide' }),
      B('text', 'Text box', () => addEl({ type: 'text', x: 280, y: 220, w: 400, h: 80, html: T('New text'), size: 28 })),
      B('image', 'Image', addImage),
      B('shape', 'Shape', (e, b) => { const p = OF.pop(b, h('div', { class: 'sv-shapes' }, ...SHAPES.map(([k, l]) => { const prev = h('i', { class: 'sv-sh sv-sh-' + k }); if (CLIP[k]) prev.style.clipPath = CLIP[k]; return h('button', { title: T(l), onclick: () => { p.close(); addEl({ type: 'shape', shape: k, x: 380, y: 200, w: k === 'line' ? 300 : 200, h: k === 'line' ? 8 : k === 'circle' || k === 'star' ? 200 : 140, fill: 'accent' }); } }, prev); }))); }),
      OF.sep(), sizeIn,
      B('bold', 'Bold', () => toggleAll('bold')), B('italic', 'Italic', () => toggleAll('italic')), B('underline', 'Underline', () => toggleAll('underline')),
      B('color', 'Color', (e, b) => OF.colorPicker(b, (c) => { setAll(sel.some((x) => x.type === 'shape') ? 'fill' : 'color', c); b.style.setProperty('--sw', c || '#000'); }), { cls: 'swatch' }),
      B('left', 'Align left', () => setAll('align', 'left')), B('center', 'Center', () => setAll('align', 'center')), B('right', 'Align right', () => setAll('align', 'right')), OF.sep(),
      B('front', 'Bring to front', () => order(1)), B('layers', 'Send to back', () => order(-1)), B('copy', 'Duplicate (Ctrl+D)', duplicateSel), B('trash', 'Delete', delSel), OF.sep(),
      animSel, B('fill', 'Slide background', (e, b) => OF.colorPicker(b, (c) => { snap(); deck.slides[cur].bg = c || undefined; save(); render(); }, { none: true })), themeSel, transSel);
    const thumbs = h('div', { class: 'sl-thumbs sv-thumbs' });
    const stage = h('div', { class: 'sl-stage sv-stage' });
    const notes = h('textarea', { class: 'sl-notes sv-notes', placeholder: T('Speaker notes (only you see them)') });
    const status = h('div', { class: 'sv-status' });
    win.body.append(toolbar, h('div', { class: 'sl-wrap sv-wrap' }, thumbs, h('div', { class: 'sl-main' }, stage, notes)), status);

    /* ---------- state ---------- */
    const past = [], future = [];
    function snap() { past.push(JSON.stringify(deck)); if (past.length > 80) past.shift(); future.length = 0; }
    function load(json) { deck = JSON.parse(json); cur = Math.min(cur, deck.slides.length - 1); sel = []; themeSel.value = deck.theme; save(); render(); }
    function undo() { if (!past.length) return; future.push(JSON.stringify(deck)); load(past.pop()); }
    function redo() { if (!future.length) return; past.push(JSON.stringify(deck)); load(future.pop()); }
    const persist = PatOS.debounce(() => { try { PatOS.fs.write(path, JSON.stringify(deck)); head.saved(); } catch (e) { head.failed(); } }, 400);
    function save() { head.saving(); persist(); }
    function setAll(k, v) { if (!sel.length) return; snap(); sel.forEach((el) => { if (v == null) delete el[k]; else el[k] = v; if (k === 'color') delete el.accent; }); save(); render(); }
    function toggleAll(k) { if (!sel.length) return; snap(); const on = !sel[0][k]; sel.forEach((el) => { el[k] = on ? 1 : 0; }); save(); render(); }
    function addEl(el) { snap(); deck.slides[cur].els.push(el); sel = [el]; save(); render(); }
    function delSel() { if (!sel.length) return; snap(); const els = deck.slides[cur].els; sel.forEach((x) => { const i = els.indexOf(x); if (i >= 0) els.splice(i, 1); }); sel = []; save(); render(); }
    function duplicateSel() { if (!sel.length) return; snap(); const els = deck.slides[cur].els; const copies = sel.map((x) => Object.assign(JSON.parse(JSON.stringify(x)), { x: x.x + 20, y: x.y + 20 })); els.push(...copies); sel = copies; save(); render(); }
    function order(d) { if (!sel.length) return; snap(); const els = deck.slides[cur].els; sel.forEach((x) => { els.splice(els.indexOf(x), 1); if (d > 0) els.push(x); else els.unshift(x); }); save(); render(); }
    function addSlide(kind, at) { snap(); const i = at == null ? cur + 1 : at; deck.slides.splice(i, 0, { els: LAYOUTS[kind].els() }); cur = i; sel = []; save(); render(); }
    function layoutPicker(anchor) {
      const g = h('div', { class: 'sv-layouts' });
      Object.entries(LAYOUTS).forEach(([k, l]) => { const prev = h('div', { class: 'sv-lprev' }); const n = slideNode(deck, { els: l.els() }, 0.13); n.style.transformOrigin = 'top left'; prev.appendChild(n); g.appendChild(h('button', { onclick: () => { p.close(); addSlide(k); } }, prev, h('small', {}, T(l.name)))); });
      const p = OF.pop(anchor, g);
    }
    function addImage() {
      const i = h('input', { type: 'file', accept: 'image/*' });
      i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 1200 / img.width); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const ratio = img.height / img.width; const w = Math.min(560, 400 / ratio); addEl({ type: 'image', src: c.toDataURL('image/jpeg', 0.85), x: (W - w) / 2, y: (H - w * ratio) / 2, w: Math.round(w), h: Math.round(w * ratio) }); }; img.src = r.result; }; r.readAsDataURL(f); };
      i.click();
    }

    /* ---------- editing on the stage ---------- */
    const stageScale = () => Math.max(0.1, Math.min((stage.clientWidth - 48) / W, (stage.clientHeight - 36) / H));
    let guides = [];
    function wire(node, scale) {
      const els = deck.slides[cur].els;
      node.querySelectorAll('.sl-el').forEach((box) => {
        const el = els[+box.dataset.i];
        if (sel.includes(el) && sel.length === 1) ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((d) => box.appendChild(h('div', { class: 'sv-h sv-h-' + d, 'data-d': d })));
        box.addEventListener('pointerdown', (e) => {
          if (box.isContentEditable) return;
          e.stopPropagation();
          if (e.shiftKey) { if (sel.includes(el)) sel = sel.filter((x) => x !== el); else sel.push(el); render(); return; }
          if (!sel.includes(el)) { sel = [el]; render(); }
          const d = e.target.dataset.d; const sx = e.clientX, sy = e.clientY;
          const starts = sel.map((x) => ({ x: x.x, y: x.y, w: x.w, h: x.h }));
          let moved = false;
          const mv = (ev) => {
            const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
            if (!moved && Math.hypot(dx, dy) < 2) return;
            if (!moved) { snap(); moved = true; }
            if (d) {
              const o = starts[0], x = sel[0]; let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
              if (d.includes('e')) nw = o.w + dx; if (d.includes('s')) nh = o.h + dy;
              if (d.includes('w')) { nw = o.w - dx; nx = o.x + dx; } if (d.includes('n')) { nh = o.h - dy; ny = o.y + dy; }
              if ((ev.shiftKey || x.type === 'image') && d.length === 2) { const r = o.h / o.w; nh = nw * r; if (d.includes('n')) ny = o.y + o.h - nh; }
              x.w = Math.max(20, Math.round(nw)); x.h = Math.max(8, Math.round(nh)); x.x = Math.round(nx); x.y = Math.round(ny);
            } else {
              let ddx = dx, ddy = dy;
              // snap the first element's edges and centre to the slide centre and other elements
              const a = starts[0], s0 = sel[0]; guides = [];
              const targetsX = [0, W / 2, W], targetsY = [0, H / 2, H];
              els.forEach((o) => { if (sel.includes(o)) return; targetsX.push(o.x, o.x + o.w / 2, o.x + o.w); targetsY.push(o.y, o.y + o.h / 2, o.y + o.h); });
              const snapAxis = (pos, size, targets) => { for (const off of [0, size / 2, size]) for (const t of targets) if (Math.abs(pos + off - t) < 6) return { d: t - (pos + off), g: t }; return null; };
              const sxr = snapAxis(a.x + ddx, s0.w, targetsX); if (sxr && !ev.altKey) { ddx += sxr.d; guides.push({ x: sxr.g }); }
              const syr = snapAxis(a.y + ddy, s0.h, targetsY); if (syr && !ev.altKey) { ddy += syr.d; guides.push({ y: syr.g }); }
              sel.forEach((x, i) => { x.x = Math.round(starts[i].x + ddx); x.y = Math.round(starts[i].y + ddy); });
            }
            node.querySelectorAll('.sl-el').forEach((b) => { const x = els[+b.dataset.i]; Object.assign(b.style, { left: x.x + 'px', top: x.y + 'px', width: x.w + 'px', height: x.h + 'px' }); });
            drawGuides(node);
          };
          const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); guides = []; drawGuides(node); if (moved) { save(); renderThumbs(); paintStatus(); } };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
        });
        if (el.type === 'text') box.addEventListener('dblclick', () => {
          box.querySelectorAll('.sv-h').forEach((x) => x.remove());
          box.contentEditable = 'true'; box.focus(); document.execCommand('selectAll');
          box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') box.blur(); });
          box.addEventListener('blur', () => { box.contentEditable = 'false'; if (el.html !== box.innerHTML) { snap(); el.html = box.innerHTML; save(); } renderThumbs(); }, { once: true });
        });
      });
    }
    function drawGuides(node) { node.querySelectorAll('.sv-guide').forEach((g) => g.remove()); guides.forEach((g) => node.appendChild(h('div', { class: 'sv-guide ' + (g.x != null ? 'v' : 'hz'), style: g.x != null ? { left: g.x + 'px' } : { top: g.y + 'px' } }))); }
    function renderThumbs() {
      thumbs.innerHTML = '';
      deck.slides.forEach((s, i) => {
        const t = h('div', { class: 'sl-thumb' + (i === cur ? ' on' : ''), draggable: 'true' }, h('span', {}, i + 1), h('div', { class: 'sl-tbox' }, slideNode(deck, s, 168 / W)), s.notes ? h('i', { class: 'sv-hasnotes', title: T('Has speaker notes') }) : null);
        t.onclick = () => { cur = i; sel = []; render(); };
        t.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('New slide'), action: () => addSlide('content', i + 1) }, { label: T('Duplicate'), action: () => { snap(); deck.slides.splice(i + 1, 0, JSON.parse(JSON.stringify(s))); cur = i + 1; save(); render(); } }, { label: T('Move up'), disabled: i === 0, action: () => { snap(); deck.slides.splice(i - 1, 0, deck.slides.splice(i, 1)[0]); cur = i - 1; save(); render(); } }, { label: T('Move down'), disabled: i === deck.slides.length - 1, action: () => { snap(); deck.slides.splice(i + 1, 0, deck.slides.splice(i, 1)[0]); cur = i + 1; save(); render(); } }, { divider: true }, { label: T('Delete'), disabled: deck.slides.length < 2, action: () => { snap(); deck.slides.splice(i, 1); cur = Math.min(cur, deck.slides.length - 1); save(); render(); } }], e.clientX, e.clientY); };
        t.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/slide', i); t.classList.add('dragging'); });
        t.addEventListener('dragend', () => t.classList.remove('dragging'));
        t.addEventListener('dragover', (e) => { e.preventDefault(); t.classList.add('over'); });
        t.addEventListener('dragleave', () => t.classList.remove('over'));
        t.addEventListener('drop', (e) => { e.preventDefault(); const from = +e.dataTransfer.getData('text/slide'); if (isNaN(from) || from === i) return; snap(); deck.slides.splice(i, 0, deck.slides.splice(from, 1)[0]); cur = i; save(); render(); });
        thumbs.appendChild(t);
      });
      thumbs.appendChild(h('button', { class: 'sl-add', title: T('New slide'), onclick: (e) => layoutPicker(e.currentTarget) }, '+'));
      const on = thumbs.querySelector('.sl-thumb.on'); if (on) { const tr = on.getBoundingClientRect(), sr = thumbs.getBoundingClientRect(); if (tr.top < sr.top || tr.bottom > sr.bottom) thumbs.scrollTop += tr.top - sr.top - 40; }
    }
    function paintStatus() {
      const x = one();
      status.textContent = T('Slide') + ' ' + (cur + 1) + ' / ' + deck.slides.length + (x ? '   ·   x ' + x.x + '  y ' + x.y + '  ' + x.w + ' × ' + x.h : sel.length > 1 ? '   ·   ' + sel.length + ' ' + T('selected') : '');
    }
    function render() {
      renderThumbs();
      stage.innerHTML = '';
      const s = stageScale();
      const node = slideNode(deck, deck.slides[cur], s, { sel });
      const holder = h('div', { class: 'sl-holder', style: { width: W * s + 'px', height: H * s + 'px' } }, node);
      stage.appendChild(holder); wire(node, s);
      notes.value = deck.slides[cur].notes || '';
      const x = one(); if (x && x.size) sizeIn.value = x.size; animSel.value = (x && x.anim) || '';
      paintStatus();
    }
    stage.addEventListener('pointerdown', (e) => { if (!e.target.closest('.sl-el') && sel.length) { sel = []; render(); } });
    notes.addEventListener('input', () => { deck.slides[cur].notes = notes.value; save(); });
    win.on('resize', PatOS.debounce(render, 60));
    win.body.tabIndex = 0;
    let clip = null;
    win.body.addEventListener('keydown', (e) => {
      if (e.target.isContentEditable || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); delSel(); }
      else if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && k === 'y') { e.preventDefault(); redo(); }
      else if (mod && k === 'd') { e.preventDefault(); duplicateSel(); }
      else if (mod && k === 'c' && sel.length) { clip = JSON.stringify(sel); }
      else if (mod && k === 'v' && clip) { e.preventDefault(); snap(); const items = JSON.parse(clip).map((x) => Object.assign(x, { x: x.x + 16, y: x.y + 16 })); deck.slides[cur].els.push(...items); sel = items; save(); render(); }
      else if (mod && k === 'a') { e.preventDefault(); sel = deck.slides[cur].els.slice(); render(); }
      else if (e.key.startsWith('Arrow') && sel.length) { e.preventDefault(); snap(); const st = e.shiftKey ? 10 : 1; sel.forEach((x) => { if (e.key === 'ArrowLeft') x.x -= st; if (e.key === 'ArrowRight') x.x += st; if (e.key === 'ArrowUp') x.y -= st; if (e.key === 'ArrowDown') x.y += st; }); save(); render(); }
      else if (e.key === 'ArrowDown' || e.key === 'PageDown') { cur = Math.min(deck.slides.length - 1, cur + 1); sel = []; render(); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { cur = Math.max(0, cur - 1); sel = []; render(); }
      else if (e.key === 'Enter' && sel.length === 1 && one().type === 'text') { e.preventDefault(); const b = stage.querySelector('.sl-el.on'); if (b) b.dispatchEvent(new MouseEvent('dblclick')); }
      else if (e.key === 'F5' || (mod && e.key === 'Enter')) { e.preventDefault(); present(e.shiftKey ? cur : 0); }
    });

    /* ---------- presenting ---------- */
    bPresent.onclick = () => present(0);
    bPresentMenu.onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([{ label: T('Present from the beginning'), shortcut: 'F5', action: () => present(0) }, { label: T('Present from this slide'), action: () => present(cur) }, { label: T('Presenter view (with notes and timer)'), action: () => present(cur, true) }, { divider: true }, { label: T('Download as PDF'), action: printDeck }], r.left - 160, r.bottom + 4); };
    function present(start, presenter) {
      let i = start, step = 0;
      const layer = h('div', { class: 'sl-present sv-present' + (presenter ? ' presenter' : '') });
      const counter = h('div', { class: 'sl-counter' });
      const area = h('div', { class: 'sv-parea' });
      const side = h('div', { class: 'sv-pside' });
      const laser = h('div', { class: 'sv-laser' });
      layer.append(area, side, counter, laser);
      document.body.appendChild(layer);
      if (layer.requestFullscreen) layer.requestFullscreen().catch(() => {});
      const t0 = Date.now(); let timerI = null;
      let current = null;
      const steps = () => deck.slides[i].els.filter((x) => x.anim).length;
      const show = (dir) => {
        const aw = area.clientWidth || innerWidth, ah = area.clientHeight || innerHeight;
        const s = Math.min(aw / W, ah / H);
        const node = slideNode(deck, deck.slides[i], s, { hideAnim: true, step });
        const wrap = h('div', { class: 'sl-pwrap' }, node); node.style.transformOrigin = 'top left';
        wrap.style.width = W * s + 'px'; wrap.style.height = H * s + 'px';
        area.appendChild(wrap);
        const tr = deck.transition || 'fade', ease = 'cubic-bezier(.2,.8,.2,1)';
        const inF = { fade: [{ opacity: 0 }, { opacity: 1 }], slide: [{ transform: `translateX(${dir >= 0 ? 100 : -100}%)` }, { transform: 'none' }], zoom: [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], flip: [{ transform: 'perspective(1200px) rotateY(80deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], cube: [{ transform: `perspective(1600px) rotateY(${dir >= 0 ? 90 : -90}deg)`, transformOrigin: dir >= 0 ? 'left center' : 'right center' }, { transform: 'none', transformOrigin: dir >= 0 ? 'left center' : 'right center' }] }[tr];
        if (tr !== 'none' && dir !== 0) wrap.animate(inF, { duration: 600, easing: ease });
        if (current) { const old = current; if (tr === 'slide') old.animate([{ transform: 'none' }, { transform: `translateX(${dir >= 0 ? -100 : 100}%)` }], { duration: 600, easing: ease }); else old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420 }); setTimeout(() => old.remove(), 560); }
        current = wrap; paintSide();
      };
      const reveal = () => {
        const box = current && current.querySelector(`[data-order="${step}"]`); if (!box) return;
        box.style.visibility = '';
        const kf = { fade: [{ opacity: 0 }, { opacity: 1 }], fly: [{ transform: 'translateY(60px)', opacity: 0 }, { transform: 'none', opacity: 1 }], zoom: [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], pop: [{ transform: 'scale(.6)' }, { transform: 'scale(1.08)', offset: 0.7 }, { transform: 'none' }] }[box.dataset.anim] || [{ opacity: 0 }, { opacity: 1 }];
        box.animate(kf, { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
        step++; paintSide();
      };
      function paintSide() {
        counter.textContent = (i + 1) + ' / ' + deck.slides.length;
        if (!presenter) return;
        side.innerHTML = '';
        const el = (Date.now() - t0) / 1000;
        const nextS = deck.slides[i + 1];
        const nx = h('div', { class: 'sv-pnext' }); if (nextS) { const n = slideNode(deck, nextS, 300 / W); n.style.transformOrigin = 'top left'; nx.appendChild(n); } else nx.appendChild(h('span', {}, T('End of presentation')));
        side.append(h('div', { class: 'sv-ptimer' }, Math.floor(el / 60) + ':' + String(Math.floor(el % 60)).padStart(2, '0')), h('small', {}, T('Next')), nx, h('small', {}, T('Notes')), h('div', { class: 'sv-pnotes' }, deck.slides[i].notes || T('No notes for this slide.')));
      }
      if (presenter) timerI = setInterval(() => { const tm = side.querySelector('.sv-ptimer'); if (tm) { const el = (Date.now() - t0) / 1000; tm.textContent = Math.floor(el / 60) + ':' + String(Math.floor(el % 60)).padStart(2, '0'); } }, 1000);
      const next = () => { if (step < steps()) { reveal(); return; } if (i < deck.slides.length - 1) { i++; step = 0; show(1); } else exit(); };
      const prev = () => { if (i > 0) { i--; step = steps(); show(-1); } };
      let overview = null;
      const toggleOverview = () => {
        if (overview) { overview.remove(); overview = null; return; }
        overview = h('div', { class: 'sv-overview' }, ...deck.slides.map((s, k) => { const n = slideNode(deck, s, 220 / W); n.style.transformOrigin = 'top left'; const b = h('button', { class: k === i ? 'on' : '' }, h('div', { class: 'sv-ovbox' }, n), h('span', {}, k + 1)); b.onclick = (e) => { e.stopPropagation(); i = k; step = 0; overview.remove(); overview = null; show(0); }; return b; }));
        layer.appendChild(overview);
      };
      let laserOn = false;
      const onKey = (e) => {
        if (['ArrowRight', ' ', 'PageDown', 'Enter', 'ArrowDown'].includes(e.key)) { e.preventDefault(); next(); }
        else if (['ArrowLeft', 'PageUp', 'Backspace', 'ArrowUp'].includes(e.key)) { e.preventDefault(); prev(); }
        else if (e.key === 'Escape') { if (overview) toggleOverview(); else exit(); }
        else if (e.key.toLowerCase() === 'g') toggleOverview();
        else if (e.key.toLowerCase() === 'l') { laserOn = !laserOn; layer.classList.toggle('laser', laserOn); }
        else if (e.key.toLowerCase() === 'b') layer.classList.toggle('black');
        else if (e.key.toLowerCase() === 'n') { presenter = !presenter; layer.classList.toggle('presenter', presenter); setTimeout(() => show(0), 50); }
        else if (e.key === 'Home') { i = 0; step = 0; show(-1); } else if (e.key === 'End') { i = deck.slides.length - 1; step = 0; show(1); }
      };
      const exit = () => { clearInterval(timerI); document.removeEventListener('keydown', onKey, true); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); layer.remove(); cur = Math.min(i, deck.slides.length - 1); sel = []; render(); };
      layer.addEventListener('pointermove', (e) => { if (laserOn) { laser.style.left = e.clientX + 'px'; laser.style.top = e.clientY + 'px'; } });
      area.addEventListener('click', (e) => { if (layer.classList.contains('black')) { layer.classList.remove('black'); return; } const r = area.getBoundingClientRect(); if (e.clientX - r.left < r.width / 4) prev(); else next(); });
      let tx = null; area.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true }); area.addEventListener('touchend', (e) => { if (tx == null) return; const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) { if (d < 0) next(); else prev(); } tx = null; });
      document.addEventListener('keydown', onKey, true);
      const hint = h('div', { class: 'sv-hint' }, T('→ next · ← back · G all slides · N notes · L laser · B black · Esc exit')); layer.appendChild(hint); setTimeout(() => hint.classList.add('out'), 3500);
      requestAnimationFrame(() => show(0));
    }
    function printDeck() {
      const f = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0' } }); document.body.appendChild(f);
      const d = f.contentDocument; d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"><title>' + PatOS.esc(baseName()) + '</title><style>@page{size:960px 540px;margin:0}body{margin:0}.pg{width:960px;height:540px;position:relative;overflow:hidden;page-break-after:always}.sl-slide{position:absolute;left:0;top:0;transform-origin:top left}.sl-el{position:absolute;overflow:hidden;line-height:1.25;word-wrap:break-word}.sl-el img{width:100%;height:100%;object-fit:cover}.sl-el ul{margin:0;padding-left:1.1em}</style></head><body></body></html>'); d.close();
      deck.slides.forEach((s) => { const pg = d.createElement('div'); pg.className = 'pg'; pg.appendChild(d.importNode(slideNode(deck, s, 1), true)); d.body.appendChild(pg); });
      setTimeout(() => { try { f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 1500); }, 400);
    }
    setTimeout(render, 30);
  }
})();
