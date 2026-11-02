/* Stickies — little colored notes that float on the desktop */
(function () {
  'use strict';
  const { h } = PatOS;
  const COLORS = { yellow: '#fff59d', pink: '#ffc1e3', blue: '#b3e5fc', green: '#c8f7c5', purple: '#e1d5ff', orange: '#ffd8a8' };
  const all = () => PatOS.store.get('stickies', []);
  const saveAll = (l) => PatOS.store.set('stickies', l);
  PatOS.registerApp({
    id: 'stickies', name: 'Stickies', icon: 'stickies', single: false, width: 260, height: 260, minWidth: 180, minHeight: 140, keywords: 'sticky notes post-it memo',
    launch(win, args) {
      let list = all();
      let note = args.id ? list.find((n) => n.id === args.id) : null;
      if (!note) { note = { id: PatOS.uid(), text: '', color: Object.keys(COLORS)[list.length % 6] }; list.push(note); saveAll(list); }
      win.el.classList.add('sticky-win');
      const ta = h('textarea', { class: 'sticky-ta', placeholder: 'Write something…' }, note.text);
      ta.value = note.text;
      win.body.appendChild(ta);
      const paint = () => { win.el.style.setProperty('--sticky', COLORS[note.color]); };
      const dots = h('div', { class: 'sticky-dots' }, ...Object.keys(COLORS).map((c) => h('button', { style: { background: COLORS[c] }, title: c, onclick: () => { note.color = c; persist(); paint(); } })));
      const bNew = h('button', { class: 'tbtn', title: 'New sticky' }, '+');
      win.toolbar.append(dots, bNew);
      bNew.onclick = () => PatOS.launch('stickies');
      const persist = PatOS.debounce(() => { const l = all(); const i = l.findIndex((n) => n.id === note.id); if (i >= 0) l[i] = note; else l.push(note); saveAll(l); }, 250);
      ta.addEventListener('input', () => { note.text = ta.value; persist(); win.setTitle(ta.value.split('\n')[0].slice(0, 24) || 'Sticky'); });
      win.on('beforeclose', (ev) => { if (!note.text.trim()) { saveAll(all().filter((n) => n.id !== note.id)); } });
      win.setTitle(note.text.split('\n')[0].slice(0, 24) || 'Sticky');
      paint(); setTimeout(() => ta.focus(), 60);
    }
  });
  // reopen saved stickies after login (desktop only)
  PatOS.on('wm:ready', () => { if (PatOS.isMobile) return; all().filter((n) => n.text.trim()).slice(0, 6).forEach((n) => PatOS.launch('stickies', { id: n.id })); });
})();
