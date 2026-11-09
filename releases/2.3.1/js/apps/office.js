/* Shared pieces for Docs, Sheets, Slides and Forms: line icons, the start screen with templates and
   recent files, the document header (name, star, saved state) and small popovers. */
(function () {
  'use strict';
  const { h } = PatOS;
  const P = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    italic: '<path d="M14 5h-4M14 19h-4M14 5l-4 14"/>',
    underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
    strike: '<path d="M16 6.5C15.3 5 13.8 4 12 4c-2.5 0-4 1.4-4 3.3 0 1.4.9 2.4 2.6 3M4 12h16M8 17.5c.7 1.5 2.2 2.5 4.2 2.5 2.6 0 4.3-1.5 4.3-3.5 0-.9-.3-1.6-.9-2.2"/>',
    color: '<path d="M6 16 11.5 4h1L18 16M8 12h8"/><path d="M4 20h16" stroke-width="3" class="of-swatch"/>',
    marker: '<path d="m9 15 6.5-6.5a2 2 0 0 0-3-3L6 12l-1 4z"/><path d="M4 20h16" stroke-width="3" class="of-swatch"/>',
    left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', justify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
    bullets: '<circle cx="5" cy="7" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="17" r="1.2" fill="currentColor"/><path d="M9 7h11M9 12h11M9 17h11"/>',
    numbers: '<path d="M4 5h2v5M4 10h4M4 14h3l-3 4h3.5M10 7h10M10 12h10M10 17h10"/>',
    check: '<rect x="3.5" y="4.5" width="6" height="6" rx="1.5"/><path d="m5 7.5 1.2 1.2L8.5 6M12 7.5h8M3.5 13.5h6v6h-6zM12 16.5h8"/>',
    indent: '<path d="M4 6h16M10 10h10M10 14h10M4 18h16M4 9l3 3-3 3"/>', outdent: '<path d="M4 6h16M10 10h10M10 14h10M4 18h16M7 9l-3 3 3 3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 2.5-2.5L20 19"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15"/>',
    line: '<path d="M4 12h16"/>', pagebreak: '<path d="M6 3v5h12V3M6 21v-5h12v5M3 12h2M8 12h2M13 12h2M18 12h3"/>',
    clear: '<path d="M6 5h12M12 5l-3 14M15 13l5 5M20 13l-5 5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', print: '<path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2M7 14h10v6H7z"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    outline: '<path d="M4 6h3M4 12h3M4 18h3M10 6h10M12 12h8M12 18h8"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 3.5v5h5M12 7.5V12l3 2"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    sum: '<path d="M17 5H6l6 7-6 7h11"/>', sort: '<path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3"/>', chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>', fill: '<path d="m5 12 7-7 7 7-7 7zM5 12h14"/><path d="M20 15s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3z"/>',
    border: '<rect x="4" y="4" width="16" height="16" rx="1.5" stroke-dasharray="2 2"/><path d="M4 20h16"/>', wrap: '<path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M4 18h5M15 15l-2.5 3 2.5 3"/>',
    rowabove: '<rect x="4" y="11" width="16" height="9" rx="1.5"/><path d="M12 3v6M9 6h6"/>', colleft: '<rect x="11" y="4" width="9" height="16" rx="1.5"/><path d="M3 12h6M6 9v6"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>', shape: '<rect x="3.5" y="9.5" width="9" height="9" rx="1.5"/><circle cx="15.5" cy="8.5" r="5"/>',
    text: '<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>', theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.5 0 2-1 2-2 0-1.5-1.3-2-1.3-3.2 0-1 .8-1.8 2-1.8H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.6 16.7 3.5 12 3.5z"/>',
    layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 13 8.5 4.5 8.5-4.5"/>', front: '<rect x="8.5" y="8.5" width="11" height="11" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', send: '<path d="M4 12 20 4l-4 16-4-6.5z"/><path d="m12 13.5 8-9.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 6.5l2.6 1.5M17.2 16l2.6 1.5M4.2 17.5 6.8 16M17.2 8l2.6-1.5"/>',
    grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
    zoomin: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8 11h6M11 8v6"/>', zoomout: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8 11h6"/>',
    emoji: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/>',
    omega: '<path d="M5 19h4v-2.5A6.5 6.5 0 1 1 15 16.5V19h4"/>', calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    toc: '<path d="M4 6h10M4 10h7M4 14h10M4 18h7M18 6h2M18 10h2M18 14h2M18 18h2"/>', quote: '<path d="M7 7c-2 1-3 3-3 5.5V17h5v-5H6.5C6.5 10 7.5 9 9 8.5zM17 7c-2 1-3 3-3 5.5V17h5v-5h-2.5c0-2 1-3 2.5-3.5z"/>',
    code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5"/>', spacing: '<path d="M10 6h10M10 12h10M10 18h10M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2"/>',
    lockic: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>', warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17v.5"/>', key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2.5 2.5M14 9l2 2"/>',
    comment: '<path d="M4.5 5.5h15v10h-9l-4.5 4v-4h-1.5z"/>', more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>'
  };
  const icon = (n, s = 18) => `<svg class="of-i" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;

  /* a toolbar button that doesn't steal the text selection */
  function btn(ic, title, fn, opts) {
    opts = opts || {};
    const b = h('button', { class: 'of-b' + (opts.cls ? ' ' + opts.cls : ''), title: PatOS.t(title), 'aria-label': PatOS.t(title), html: (P[ic] ? icon(ic) : ic) + (opts.label ? '<span>' + PatOS.t(opts.label) + '</span>' : '') });
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', (e) => fn(e, b));
    return b;
  }
  const sep = () => h('span', { class: 'of-sep' });

  /* small popover under a button */
  function pop(anchor, content, opts) {
    opts = opts || {};
    document.querySelectorAll('.of-pop').forEach((p) => p.remove());
    const p = h('div', { class: 'of-pop' + (opts.cls ? ' ' + opts.cls : '') }, content);
    document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    const w = p.offsetWidth, hh = p.offsetHeight;
    p.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + (opts.alignRight ? r.width - w : 0))) + 'px';
    p.style.top = (r.bottom + hh + 8 > innerHeight ? Math.max(8, r.top - hh - 6) : r.bottom + 6) + 'px';
    const close = (e) => { if (e && (p.contains(e.target) || anchor.contains(e.target))) return; p.remove(); document.removeEventListener('pointerdown', close, true); document.removeEventListener('keydown', esc, true); if (opts.onClose) opts.onClose(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    setTimeout(() => { document.addEventListener('pointerdown', close, true); document.addEventListener('keydown', esc, true); }, 0);
    p.close = () => close();
    return p;
  }
  const SWATCHES = ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff', '#e8453c', '#f29d38', '#f6c344', '#4bae4f', '#2f9de8', '#4a5cd5', '#9c45d1', '#e2438f', '#8b5a2b', '#00897b', '#fde6e4', '#fdeed9', '#fef6d6', '#e3f2e2', '#dcedfb', '#e5e6f8', '#f1e1f8', '#fbe0ec'];
  function colorPicker(anchor, onPick, opts) {
    const grid = h('div', { class: 'of-sw' });
    if (opts && opts.none) grid.appendChild(h('button', { class: 'of-swn', title: PatOS.t('None'), onclick: () => { onPick(null); p.close(); } }, PatOS.t('None')));
    SWATCHES.forEach((c) => grid.appendChild(h('button', { style: { background: c }, title: c, onclick: () => { onPick(c); p.close(); } })));
    const custom = h('input', { type: 'color', value: '#2f9de8' }); custom.oninput = () => onPick(custom.value);
    const p = pop(anchor, h('div', {}, grid, h('label', { class: 'of-custom' }, PatOS.t('Custom color'), custom)));
    return p;
  }

  /* toast message at the bottom of a window */
  function toast(win, text) {
    const t = h('div', { class: 'of-toast' }, text); win.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 1800); setTimeout(() => t.remove(), 2200);
  }

  /* header: icon, editable name, star, saved state, right-side actions */
  function header(win, o) {
    const name = h('input', { class: 'of-name', value: o.name, spellcheck: 'false', 'aria-label': PatOS.t('Name') });
    const starred = () => (PatOS.store.get('officeStars', [])).includes(o.getPath());
    const star = h('button', { class: 'of-star' + (starred() ? ' on' : ''), title: PatOS.t('Star'), html: icon('star', 16) });
    star.onclick = () => { const l = PatOS.store.get('officeStars', []); const p = o.getPath(); const i = l.indexOf(p); if (i >= 0) l.splice(i, 1); else l.push(p); PatOS.store.set('officeStars', l); star.classList.toggle('on', i < 0); };
    const saved = h('span', { class: 'of-saved', html: icon('history', 14) + '<span>' + PatOS.t('Saved') + '</span>' });
    const right = h('div', { class: 'of-hright' });
    const el = h('div', { class: 'of-head' }, h('div', { class: 'of-hic', html: PatOS.iconHTML(o.icon) }), h('div', { class: 'of-htitle' }, h('div', { class: 'of-hrow' }, name, star), saved), right);
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
    name.addEventListener('change', () => o.onRename(name.value.trim()));
    let t = null;
    return {
      el, name, right,
      saving() { saved.classList.add('busy'); saved.lastChild.textContent = PatOS.t('Saving…'); clearTimeout(t); },
      saved() { t = setTimeout(() => { saved.classList.remove('busy'); saved.lastChild.textContent = PatOS.t('Saved'); }, 250); },
      failed() { saved.classList.remove('busy'); saved.lastChild.textContent = PatOS.t('Not saved'); }
    };
  }

  /* start screen: templates + recent files of this kind */
  function recent(ext) {
    const out = [];
    PatOS.fs.walk('/', (p, n) => { if (n.type === 'file' && ext.some((e) => p.toLowerCase().endsWith('.' + e)) && !p.startsWith('/.Trash')) out.push({ path: p, mtime: n.mtime || 0 }); });
    return out.sort((a, b) => b.mtime - a.mtime);
  }
  function startScreen(win, o) {
    win.el.classList.add('of-starting');
    const q = h('input', { class: 'of-ssearch', placeholder: PatOS.t('Search'), spellcheck: 'false' });
    const list = h('div', { class: 'of-recent' });
    const tpl = h('div', { class: 'of-tpls' });
    o.templates.forEach((t) => {
      const card = h('button', { class: 'of-tpl' }, h('div', { class: 'of-tplprev', html: t.preview || '' }), h('b', {}, PatOS.t(t.name)), t.sub ? h('small', {}, PatOS.t(t.sub)) : null);
      card.onclick = () => { win.el.classList.remove('of-starting'); wrap.remove(); o.onCreate(t); };
      tpl.appendChild(card);
    });
    const draw = () => {
      list.innerHTML = '';
      const ql = q.value.trim().toLowerCase();
      const files = recent(o.ext).filter((f) => !ql || PatOS.fs.basename(f.path).toLowerCase().includes(ql));
      if (!files.length) { list.appendChild(h('div', { class: 'of-empty' }, PatOS.t(ql ? 'No results' : o.emptyText || 'Nothing here yet. Pick a template above to start.'))); return; }
      const stars = PatOS.store.get('officeStars', []);
      files.slice(0, 60).forEach((f) => {
        const nm = PatOS.fs.basename(f.path).replace(/\.[^.]+$/, '');
        const row = h('div', { class: 'of-file' }, h('div', { class: 'of-fic', html: PatOS.iconHTML(o.icon) }), h('div', { class: 'of-fname' }, h('b', {}, nm), h('small', {}, PatOS.fs.dirname(f.path))), stars.includes(f.path) ? h('span', { class: 'of-fstar', html: icon('star', 14) }) : null, h('small', { class: 'of-fdate' }, f.mtime ? new Date(f.mtime).toLocaleDateString(PatOS.locale, { day: 'numeric', month: 'short', year: new Date(f.mtime).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : ''));
        row.onclick = () => { win.el.classList.remove('of-starting'); wrap.remove(); o.onOpen(f.path); };
        row.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: PatOS.t('Open'), action: () => row.click() }, { label: PatOS.t('Show in Finder'), action: () => PatOS.launch('finder', { path: PatOS.fs.dirname(f.path) }) }, { label: PatOS.t('Move to Trash'), action: () => { PatOS.fs.remove(f.path); draw(); } }], e.clientX, e.clientY); };
        list.appendChild(row);
      });
    };
    q.oninput = draw;
    const APP = { docs: '#3b7cff', sheets: '#1a9e5f', slides: '#ff9f0a', forms: '#8a5cf6' }[o.icon] || 'var(--accent)'; // each app's own color
    const wrap = h('div', { class: 'of-start', style: { '--app': APP } },
      h('div', { class: 'of-shead' }, h('div', { class: 'of-slogo', html: PatOS.iconHTML(o.icon) }, h('b', {}, PatOS.t(o.title))), o.onImportFile ? h('button', { class: 'btn of-import', onclick: () => { const i = h('input', { type: 'file', accept: o.importAccept || '' }); i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const p = await o.onImportFile(f); win.el.classList.remove('of-starting'); wrap.remove(); o.onOpen(p); } catch (e) { PatOS.alertBox(PatOS.t('Couldn’t open this file'), e.message || String(e), { icon: o.icon }); } }; i.click(); } }, PatOS.t(o.importLabel || 'Open a file…')) : null, q),
      h('div', { class: 'of-sband' }, h('h1', { class: 'of-create' }, PatOS.t('Create')), tpl),
      h('div', { class: 'of-slist' }, h('h3', {}, PatOS.t('Recent')), list));
    win.body.appendChild(wrap);
    draw();
    setTimeout(() => q.focus(), 60);
    return wrap;
  }

  PatOS.office = { icon, btn, sep, pop, colorPicker, toast, header, startScreen, recent, P };
})();
