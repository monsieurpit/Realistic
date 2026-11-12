/* PatOS.ui (3.3): the components of the design system (css/ui.css), as functions. Screens made with these look and behave
   like the rest of PatOS without inventing their own classes:
     ui.sidebar([ ui.item({ icon, label, count, on, onClick }), ui.heading('Tags'), ... ])
     ui.empty({ icon, title, text, action: [label, fn] })
     ui.group([ ui.row({ label, sub, control, onClick }) ])     ui.section('Title')
     ui.badge(text, tone)  ui.avatar(name)  ui.progress(0..1 | null)  ui.kbd('Alt+K')  ui.search({ placeholder, onInput })
     ui.segmented([[value, label]], current, onChange)  ui.sheet(win, { title, body, actions: (close) => [buttons] })
   Every one gives a plain element back, keyboard-reachable, with its words for screen readers. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const sym = (n) => (n && PatOS.sym ? PatOS.sym(n) : '');
  const hue = (s) => { let x = 0; for (const c of String(s || '')) x = (x * 31 + c.charCodeAt(0)) % 360; return x; };
  const ui = {
    sidebar: (children, opts) => h('nav', { class: 'ui-side' + (opts && opts.cls ? ' ' + opts.cls : ''), 'aria-label': (opts && opts.label) || T('Sidebar') }, ...children.filter(Boolean)),
    heading: (text) => h('h4', { class: 'ui-sh' }, T(text)),
    item: (o) => h('button', { class: 'ui-si' + (o.on ? ' on' : ''), 'aria-current': o.on ? 'page' : null, onclick: o.onClick },
      o.icon ? h('span', { html: sym(o.icon), 'aria-hidden': 'true' }) : null, h('span', {}, T(o.label)), o.count ? h('small', {}, String(o.count)) : null),
    empty: (o) => h('div', { class: 'ui-empty', role: 'status' },
      o.icon ? h('span', { class: 'ui-empty-ic', html: sym(o.icon), 'aria-hidden': 'true' }) : null, o.title ? h('h3', {}, T(o.title)) : null, o.text ? h('p', {}, T(o.text)) : null,
      o.action ? h('button', { class: 'btn primary', onclick: o.action[1] }, T(o.action[0])) : null),
    section: (text) => h('h3', { class: 'ui-section' }, T(text)),
    group: (rows) => h('div', { class: 'ui-group' }, ...rows.filter(Boolean)),
    row: (o) => h(o.onClick ? 'button' : 'div', { class: 'ui-row' + (o.onClick ? ' link' : ''), onclick: o.onClick || null },
      o.icon ? h('span', { html: sym(o.icon), 'aria-hidden': 'true' }) : null,
      h('span', { class: 'ui-row-l' }, h('span', {}, T(o.label)), o.sub ? h('small', {}, T(o.sub)) : null), o.control || (o.onClick ? h('span', { 'aria-hidden': 'true' }, '›') : null)),
    badge: (text, tone) => h('span', { class: 'ui-badge' + (tone ? ' ' + tone : '') }, String(text)),
    avatar: (name) => { const n = String(name || '?'); const a = hue(n); const el = h('span', { class: 'ui-avatar', title: n, 'aria-hidden': 'true' }, n.replace(/^@/, '').charAt(0).toUpperCase()); el.style.setProperty('--av1', 'hsl(' + a + ' 85% 58%)'); el.style.setProperty('--av2', 'hsl(' + ((a + 40) % 360) + ' 80% 50%)'); return el; },
    progress: (p, label) => h('div', { class: 'ui-progress' + (p == null ? ' busy' : ''), role: 'progressbar', 'aria-label': label ? T(label) : null, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': p == null ? null : String(Math.round(p * 100)) }, h('i', { style: { width: p == null ? '' : Math.round(p * 100) + '%' } })),
    kbd: (keys) => h('span', { class: 'ui-kbds' }, ...String(keys).split('+').map((k) => h('kbd', {}, k))),
    search(o) {
      o = o || {}; const i = h('input', { class: 'field', type: 'search', placeholder: T(o.placeholder || 'Search'), 'aria-label': T(o.placeholder || 'Search'), value: o.value || '' });
      if (o.onInput) i.addEventListener('input', () => o.onInput(i.value));
      return h('label', { class: 'ui-search' }, h('span', { class: 'ui-search-ic', html: sym('search'), 'aria-hidden': 'true' }), i);
    },
    segmented(options, current, onChange) {
      const el = h('div', { class: 'ui-seg', role: 'tablist' });
      options.forEach(([v, l]) => el.appendChild(h('button', { class: v === current ? 'on' : '', role: 'tab', 'aria-selected': String(v === current), onclick: (e) => { const me = e.currentTarget; [...el.children].forEach((b) => { b.classList.toggle('on', b === me); b.setAttribute('aria-selected', String(b === me)); }); onChange && onChange(v); } }, T(l))));
      return el;
    },
    sheet(win, o) {
      const host = (win && win.body) || document.body; const old = host.querySelector(':scope > .ui-sheet'); if (old) old.remove();
      const close = () => { el.remove(); if (o.onClose) o.onClose(); };
      const el = h('div', { class: 'ui-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': T(o.title || '') },
        h('div', { class: 'ui-sheet-card' }, h('div', { class: 'fp-head' }, h('b', {}, T(o.title || '')), h('button', { class: 'fp-x', 'aria-label': T('Close'), onclick: close }, '×')),
          h('div', { class: 'fp-body' }, o.body), o.actions ? h('div', { class: 'fp-acts' }, ...o.actions(close)) : null));
      el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
      el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
      host.appendChild(el); setTimeout(() => { const f = el.querySelector('input, button:not(.fp-x)') || el.querySelector('button'); f && f.focus(); }, 30);
      return { el, close };
    }
  };
  PatOS.ui = ui;
})();
