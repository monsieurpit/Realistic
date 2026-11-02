/* Slides — build presentations and present them full screen. Saved as .pslides */
(function () {
  'use strict';
  const { h } = PatOS;
  const W = 960, H = 540;
  const THEMES = {
    Simple: { bg: '#ffffff', fg: '#1d1d1f', accent: '#0a84ff', font: 'Arial, sans-serif' },
    Midnight: { bg: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', fg: '#ffffff', accent: '#64d2ff', font: 'Georgia, serif' },
    Sunset: { bg: 'linear-gradient(135deg,#ff9a8b,#ff6a88,#ff99ac)', fg: '#ffffff', accent: '#fff3b0', font: '"Trebuchet MS", sans-serif' },
    Forest: { bg: 'linear-gradient(135deg,#134e5e,#71b280)', fg: '#ffffff', accent: '#e0ffb3', font: 'Verdana, sans-serif' },
    Neon: { bg: 'linear-gradient(135deg,#0b0130,#3a0ca3)', fg: '#ffffff', accent: '#ff4fd8', font: '"Courier New", monospace' },
    Paper: { bg: '#f5efe0', fg: '#3b2f2f', accent: '#b5651d', font: 'Georgia, serif' }
  };
  const layouts = {
    title: () => [{ type: 'text', x: 80, y: 170, w: 800, h: 120, html: PatOS.t('Presentation title'), size: 60, bold: 1, align: 'center' }, { type: 'text', x: 180, y: 300, w: 600, h: 60, html: PatOS.t('Subtitle'), size: 28, align: 'center', accent: 1 }],
    content: () => [{ type: 'text', x: 60, y: 40, w: 840, h: 90, html: PatOS.t('Slide title'), size: 44, bold: 1 }, { type: 'text', x: 60, y: 150, w: 840, h: 340, html: PatOS.lang === 'fr' ? '• Premier point<br>• Deuxième point<br>• Troisième point' : '• First point<br>• Second point<br>• Third point', size: 28 }],
    blank: () => []
  };
  PatOS.registerApp({
    id: 'slides', name: 'Slides', icon: 'slides', single: false, width: 1080, height: 700, category: 'Office', keywords: 'presentation powerpoint keynote deck google slides',
    about: 'Make slide decks with themes, text, images and shapes, then present them.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'office-win');
      let path = args.path || null, deck;
      if (path) { try { deck = JSON.parse(PatOS.fs.read(path)); } catch (e) { deck = null; } }
      if (!deck) { deck = { theme: 'Midnight', transition: 'fade', slides: [{ els: layouts.title() }, { els: layouts.content() }] }; deck.slides[0].els[0].html = PatOS.t('My Presentation'); deck.slides[0].els[1].html = PatOS.t('Made in PatOS Slides'); deck.slides[1].els[0].html = PatOS.t('Slide title'); }
      if (!path) { path = PatOS.newDocPath('/Documents', 'Untitled presentation', 'pslides'); PatOS.fs.write(path, JSON.stringify(deck)); }
      let cur = 0, selEl = null;
      const nameIn = h('input', { class: 'doc-name', value: PatOS.fs.basename(path).replace(/\.pslides$/, ''), spellcheck: 'false' });
      const saved = h('span', { class: 'doc-saved' }, 'Saved');
      const bPresent = h('button', { class: 'btn primary' }, '▶ Present');
      win.toolbar.append(nameIn, saved, h('div', { style: { flex: 1 } }), bPresent); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const btn = (label, title, fn) => { const b = h('button', { class: 'ob', title }, label); b.addEventListener('mousedown', (e) => e.preventDefault()); b.onclick = fn; return b; };
      const themeSel = h('select', { class: 'ob-sel', title: 'Theme' }, ...Object.keys(THEMES).map((k) => h('option', { value: k, selected: k === deck.theme }, k)));
      themeSel.onchange = () => { deck.theme = themeSel.value; save(); render(); };
      const transSel = h('select', { class: 'ob-sel', title: 'Transition' }, ...[['fade', 'Fade'], ['slide', 'Slide'], ['zoom', 'Zoom'], ['flip', 'Flip'], ['none', 'None']].map(([v, l]) => h('option', { value: v, selected: deck.transition === v }, l)));
      transSel.onchange = () => { deck.transition = transSel.value; save(); };
      const sizeSel = h('select', { class: 'ob-sel sm', title: 'Text size' }, ...[16, 20, 24, 28, 36, 44, 54, 64, 80].map((s) => h('option', { value: s }, s)));
      sizeSel.onchange = () => { if (selEl) { selEl.size = +sizeSel.value; save(); render(); } };
      const tcol = h('input', { type: 'color', class: 'ob-color', title: 'Color' }); tcol.oninput = () => { if (selEl) { selEl.color = tcol.value; delete selEl.accent; save(); render(); } };
      const bar = h('div', { class: 'ob-bar' },
        btn('＋ Slide', 'New slide', () => PatOS.menu([{ label: 'Title slide', action: () => addSlide('title') }, { label: 'Title and content', action: () => addSlide('content') }, { label: 'Blank', action: () => addSlide('blank') }, { divider: true }, { label: 'Duplicate this slide', action: () => { deck.slides.splice(cur + 1, 0, JSON.parse(JSON.stringify(deck.slides[cur]))); cur++; save(); render(); } }], 120, 120)),
        btn('T', 'Text box', () => addEl({ type: 'text', x: 280, y: 220, w: 400, h: 80, html: PatOS.t('New text'), size: 28 })),
        btn('🖼', 'Image', () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 800 / img.width); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const ratio = c.height / c.width; addEl({ type: 'image', x: 280, y: 100, w: 400, h: Math.round(400 * ratio), src: c.toDataURL('image/jpeg', 0.82) }); }; img.src = r.result; }; r.readAsDataURL(f); }; i.click(); }),
        btn('■', 'Rectangle', () => addEl({ type: 'shape', shape: 'rect', x: 380, y: 200, w: 200, h: 140, fill: THEMES[deck.theme].accent })),
        btn('●', 'Circle', () => addEl({ type: 'shape', shape: 'circle', x: 400, y: 190, w: 160, h: 160, fill: THEMES[deck.theme].accent })),
        h('span', { class: 'ob-sep' }), sizeSel,
        btn(h('b', {}, 'B'), 'Bold', () => { if (selEl) { selEl.bold = selEl.bold ? 0 : 1; save(); render(); } }),
        h('label', { class: 'ob-cl', title: 'Color' }, 'A', tcol),
        btn('⬅', 'Align left', () => setAlign('left')), btn('↔', 'Center', () => setAlign('center')), btn('➡', 'Align right', () => setAlign('right')),
        btn('⤒', 'Bring to front', () => { if (!selEl) return; const els = deck.slides[cur].els; els.push(els.splice(els.indexOf(selEl), 1)[0]); save(); render(); }),
        btn('🗑', 'Delete selected', delSel), h('span', { class: 'ob-sep' }), themeSel, transSel);
      const thumbs = h('div', { class: 'sl-thumbs' });
      const stage = h('div', { class: 'sl-stage' });
      const notes = h('textarea', { class: 'sl-notes', placeholder: 'Your notes (only you see them)' });
      win.body.append(bar, h('div', { class: 'sl-wrap' }, thumbs, h('div', { class: 'sl-main' }, stage, notes)));
      const persist = PatOS.debounce(() => { try { PatOS.fs.write(path, JSON.stringify(deck)); saved.textContent = 'Saved'; } catch (e) { saved.textContent = 'Not saved'; } }, 500);
      function save() { saved.textContent = 'Saving…'; persist(); }
      function setAlign(a) { if (selEl && selEl.type === 'text') { selEl.align = a; save(); render(); } }
      function addSlide(kind) { deck.slides.splice(cur + 1, 0, { els: layouts[kind]() }); cur++; save(); render(); }
      function addEl(el) { deck.slides[cur].els.push(el); selEl = el; save(); render(); }
      function delSel() { if (!selEl) return; const els = deck.slides[cur].els; els.splice(els.indexOf(selEl), 1); selEl = null; save(); render(); }
      function slideNode(s, scale, interactive) {
        const t = THEMES[deck.theme];
        const node = h('div', { class: 'sl-slide', style: { width: W + 'px', height: H + 'px', background: s.bg || t.bg, color: t.fg, fontFamily: t.font, transform: `scale(${scale})` } });
        s.els.forEach((el) => {
          const box = h('div', { class: 'sl-el ' + el.type + (interactive && el === selEl ? ' on' : ''), style: { left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: el.h + 'px' } });
          if (el.type === 'text') { box.innerHTML = el.html; Object.assign(box.style, { fontSize: el.size + 'px', fontWeight: el.bold ? '700' : '400', textAlign: el.align || 'left', color: el.color || (el.accent ? t.accent : '') }); }
          if (el.type === 'image') box.appendChild(h('img', { src: el.src, alt: '', draggable: 'false' }));
          if (el.type === 'shape') Object.assign(box.style, { background: el.fill, borderRadius: el.shape === 'circle' ? '50%' : '14px' });
          if (interactive) wire(box, el);
          node.appendChild(box);
        });
        return node;
      }
      function wire(box, el) {
        box.addEventListener('pointerdown', (e) => {
          if (box.isContentEditable) return;
          e.stopPropagation(); const prev = selEl; selEl = el;
          if (prev !== el) { render(); return; }
          const scale = stageScale(); const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y, ow = el.w, oh = el.h;
          const resize = e.target.classList.contains('sl-handle');
          box.setPointerCapture(e.pointerId);
          const mv = (ev) => { const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale; if (resize) { el.w = Math.max(30, Math.round(ow + dx)); el.h = Math.max(20, Math.round(oh + dy)); } else { el.x = Math.round(ox + dx); el.y = Math.round(oy + dy); } box.style.left = el.x + 'px'; box.style.top = el.y + 'px'; box.style.width = el.w + 'px'; box.style.height = el.h + 'px'; };
          const up = () => { box.removeEventListener('pointermove', mv); box.removeEventListener('pointerup', up); save(); renderThumbs(); };
          box.addEventListener('pointermove', mv); box.addEventListener('pointerup', up);
        });
        if (el.type === 'text') box.addEventListener('dblclick', () => {
          const hd = box.querySelector('.sl-handle'); if (hd) hd.remove();
          box.contentEditable = 'true'; box.focus(); document.execCommand('selectAll');
          box.addEventListener('blur', () => { box.contentEditable = 'false'; el.html = box.innerHTML; save(); renderThumbs(); }, { once: true });
        });
        if (el === selEl) box.appendChild(h('div', { class: 'sl-handle' }));
      }
      function stageScale() { return Math.min((stage.clientWidth - 40) / W, (stage.clientHeight - 30) / H); }
      function renderThumbs() {
        thumbs.innerHTML = '';
        deck.slides.forEach((s, i) => {
          const t = h('div', { class: 'sl-thumb' + (i === cur ? ' on' : ''), draggable: 'true' }, h('span', {}, i + 1), h('div', { class: 'sl-tbox' }, slideNode(s, 160 / W)));
          t.onclick = () => { cur = i; selEl = null; render(); };
          t.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: 'Duplicate', action: () => { deck.slides.splice(i + 1, 0, JSON.parse(JSON.stringify(s))); save(); render(); } }, { label: 'Move up', disabled: i === 0, action: () => { deck.slides.splice(i - 1, 0, deck.slides.splice(i, 1)[0]); cur = i - 1; save(); render(); } }, { label: 'Move down', disabled: i === deck.slides.length - 1, action: () => { deck.slides.splice(i + 1, 0, deck.slides.splice(i, 1)[0]); cur = i + 1; save(); render(); } }, { divider: true }, { label: 'Delete slide', disabled: deck.slides.length === 1, action: () => { deck.slides.splice(i, 1); cur = Math.min(cur, deck.slides.length - 1); save(); render(); } }], e.clientX, e.clientY); };
          t.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/slide', i));
          t.addEventListener('dragover', (e) => e.preventDefault());
          t.addEventListener('drop', (e) => { e.preventDefault(); const from = +e.dataTransfer.getData('text/slide'); if (isNaN(from) || from === i) return; deck.slides.splice(i, 0, deck.slides.splice(from, 1)[0]); cur = i; save(); render(); });
          thumbs.appendChild(t);
        });
        thumbs.appendChild(h('button', { class: 'sl-add', onclick: () => addSlide('content') }, '+'));
      }
      function render() {
        renderThumbs();
        stage.innerHTML = '';
        const s = stageScale();
        const holder = h('div', { class: 'sl-holder', style: { width: W * s + 'px', height: H * s + 'px' } }, slideNode(deck.slides[cur], s, true));
        stage.appendChild(holder);
        notes.value = deck.slides[cur].notes || '';
        if (selEl && selEl.size) sizeSel.value = selEl.size;
      }
      stage.addEventListener('pointerdown', (e) => { if (!e.target.closest('.sl-el') && selEl) { selEl = null; render(); } });
      notes.addEventListener('input', () => { deck.slides[cur].notes = notes.value; save(); });
      win.on('resize', PatOS.debounce(render, 60));
      win.body.addEventListener('keydown', (e) => {
        if (e.target.isContentEditable || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        if ((e.key === 'Delete' || e.key === 'Backspace') && selEl) { e.preventDefault(); delSel(); }
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { cur = Math.min(deck.slides.length - 1, cur + 1); selEl = null; render(); }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') { cur = Math.max(0, cur - 1); selEl = null; render(); }
      });
      win.body.tabIndex = 0;
      nameIn.addEventListener('change', () => { const nn = nameIn.value.trim().replace(/[\/]/g, '-') || PatOS.t('Untitled presentation'); try { path = PatOS.fs.rename(path, PatOS.fs.uniqueName(PatOS.fs.dirname(path), nn + '.pslides')); } catch (e) {} nameIn.value = PatOS.fs.basename(path).replace(/\.pslides$/, ''); win.setTitle(nameIn.value); });

      // presenting
      bPresent.onclick = () => present(cur);
      function present(start) {
        let i = start;
        const layer = h('div', { class: 'sl-present' });
        const counter = h('div', { class: 'sl-counter' });
        document.body.appendChild(layer); layer.appendChild(counter);
        if (layer.requestFullscreen) layer.requestFullscreen().catch(() => {});
        let current = null;
        const show = (dir) => {
          const s = Math.min(innerWidth / W, innerHeight / H);
          const node = slideNode(deck.slides[i], s);
          const wrap = h('div', { class: 'sl-pwrap' }, node); node.style.transformOrigin = 'top left';
          wrap.style.width = W * s + 'px'; wrap.style.height = H * s + 'px';
          layer.insertBefore(wrap, counter);
          const tr = deck.transition;
          const inF = { fade: [{ opacity: 0 }, { opacity: 1 }], slide: [{ transform: `translateX(${dir >= 0 ? 100 : -100}%)` }, { transform: 'none' }], zoom: [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], flip: [{ transform: 'perspective(1200px) rotateY(80deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], none: [{}, {}] }[tr] || [{ opacity: 0 }, { opacity: 1 }];
          if (tr !== 'none') wrap.animate(inF, { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' });
          if (current) { const old = current; if (tr === 'slide') old.animate([{ transform: 'none' }, { transform: `translateX(${dir >= 0 ? -100 : 100}%)` }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' }); else old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }); setTimeout(() => old.remove(), 540); }
          current = wrap; counter.textContent = (i + 1) + ' / ' + deck.slides.length;
        };
        const next = () => { if (i < deck.slides.length - 1) { i++; show(1); } else exit(); };
        const prev = () => { if (i > 0) { i--; show(-1); } };
        const onKey = (e) => { if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); next(); } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); } else if (e.key === 'Escape') exit(); };
        const exit = () => { document.removeEventListener('keydown', onKey, true); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); layer.remove(); };
        layer.addEventListener('click', (e) => { if (e.clientX < innerWidth / 3) prev(); else next(); });
        document.addEventListener('keydown', onKey, true);
        show(0);
      }
      win.setTitle(nameIn.value);
      setTimeout(render, 30);
    }
  });
})();
