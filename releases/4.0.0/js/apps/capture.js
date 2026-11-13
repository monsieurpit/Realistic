/* Capture: the inbox for Universal Capture (js/capture.js). Sort later: tag, search, preview, and send things on with Universal
   Actions; sent ones move to Done, deleted ones stay 30 days in Recently Deleted. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.capture = { bg: 'linear-gradient(160deg,#ffd60a,#ff9f0a)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M14 20a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v8H38l-3 5h-6l-3-5H14z" fill="#fff" opacity=".55"/><path d="M14 30h12l3 5h6l3-5h12v14a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#fff"/><path d="M32 8v14m-5-5 5 5 5-5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' };
  const KIND = { text: 'Text', url: 'Link', image: 'Picture', file: 'File', document: 'Document', folder: 'Folder', contact: 'Contact', event: 'Date' };
  const SYM = { text: 'note', url: 'link', image: 'image', file: 'doc', document: 'doc', folder: 'folder', contact: 'person', event: 'calendar' };
  const ago = (t) => new Date(t).toLocaleString(PatOS.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  PatOS.registerApp({
    id: 'capture', name: 'Capture', icon: 'capture', width: 860, height: 560, minWidth: 360, minHeight: 320, category: 'Productivity', keywords: 'capture inbox save quick note later collect saisir capturer boîte',
    about: 'Save anything now (Alt+C), sort it later.',
    launch(win) {
      const C = PatOS.capture;
      let view = 'inbox', tag = '', q = '', sel = null;
      const side = h('div', { class: 'cap-side' }), list = h('div', { class: 'cap-list', role: 'listbox', 'aria-label': T('Items') }), detail = h('div', { class: 'cap-detail' });
      const search = h('input', { class: 'field cap-q', type: 'search', placeholder: T('Search'), 'aria-label': T('Search') });
      search.addEventListener('input', () => { q = search.value; drawList(); });
      win.body.appendChild(h('div', { class: 'cap' }, side, h('div', { class: 'cap-mid' }, h('div', { class: 'cap-top' }, search, h('button', { class: 'btn primary', onclick: () => C.quick() }, T('New'))), list), detail));
      const MB = PatOS.mobile; if (MB && MB.stack) { MB.stack(win, T('Capture')); }
      function drawSide() {
        side.innerHTML = '';
        const it = (k, label, n, sym) => h('button', { class: 'cap-si' + (view === k && !tag ? ' on' : ''), onclick: () => { view = k; tag = ''; sel = null; draw(); } }, h('span', { html: PatOS.sym(sym) }), h('span', {}, T(label)), n ? h('small', {}, String(n)) : null);
        side.append(it('inbox', 'Inbox', C.count(), 'download'), it('done', 'Done', C.list({ done: true }).length, 'check'), it('trash', 'Recently Deleted', C.trash().length, 'trash'));
        const tags = C.tags(); if (tags.length) { side.appendChild(h('h4', {}, T('Tags'))); tags.forEach((tg) => side.appendChild(h('button', { class: 'cap-si' + (tag === tg ? ' on' : ''), onclick: () => { tag = tg; view = 'tag'; sel = null; draw(); } }, h('span', { html: PatOS.sym('flag') }), h('span', {}, '#' + tg)))); }
      }
      const shown = () => (view === 'trash' ? C.trash().filter((i) => !q || i.title.toLowerCase().includes(q.toLowerCase())) : C.list({ done: view === 'tag' ? undefined : view === 'done', tag: tag || undefined, q }));
      function drawList() {
        list.innerHTML = ''; const l = shown();
        if (!l.length) { list.appendChild(h('div', { class: 'cap-empty' }, h('span', { html: PatOS.sym(view === 'trash' ? 'trash' : 'download') }), q ? T('Nothing matches.') : view === 'inbox' ? T('Nothing to sort. Press Alt+C anywhere to capture something.') : T('Nothing here.'))); return; }
        l.forEach((i) => list.appendChild(h('button', { class: 'cap-row' + (sel === i.id ? ' on' : ''), role: 'option', 'aria-selected': String(sel === i.id), onclick: () => { sel = i.id; drawList(); drawDetail(); if (MB && MB.detail) MB.detail(win, true, i.title); } },
          h('span', { class: 'cap-k k-' + i.obj.type, html: PatOS.sym(SYM[i.obj.type] || 'note') }),
          h('span', { class: 'cap-rt' }, h('b', {}, i.title || T(KIND[i.obj.type])), h('small', {}, T(KIND[i.obj.type] || 'Text') + ' · ' + ago(i.t) + (i.tags.length ? ' · #' + i.tags.join(' #') : ''))))));
      }
      function drawDetail() {
        detail.innerHTML = '';
        const i = view === 'trash' ? C.trash().find((x) => x.id === sel) : C.get(sel);
        if (!i) { detail.appendChild(h('div', { class: 'cap-empty' }, h('span', { html: PatOS.sym('sparkle') }), T('Pick an item to see it and send it on.'))); return; }
        const o = i.obj;
        const pv = o.type === 'image' ? h('img', { class: 'cap-img', src: o.url || '', alt: '' }) : o.type === 'url' ? h('a', { class: 'cap-link', href: o.url, target: '_blank', rel: 'noopener' }, o.url) : o.type === 'contact' ? h('div', { class: 'cap-card' }, h('b', {}, o.name), o.email ? h('div', {}, o.email) : null, o.phone ? h('div', {}, o.phone) : null) : o.type === 'event' ? h('div', { class: 'cap-card' }, h('b', {}, o.title), o.start ? h('div', {}, new Date(o.start).toLocaleString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })) : null) : o.path ? h('div', { class: 'cap-card' }, h('b', {}, PatOS.fs.basename(o.path)), h('div', {}, o.path)) : h('pre', { class: 'cap-text' }, o.text || '');
        if (o.type === 'image' && o.path && PatOS.fs.blobURL) PatOS.fs.blobURL(o.path).then((u) => { if (u) pv.src = u; });
        const head = h('div', { class: 'cap-dhead' }, h('span', { class: 'cap-k big k-' + o.type, html: PatOS.sym(SYM[o.type] || 'note') }), h('div', {}, h('h2', {}, i.title || T(KIND[o.type])), h('small', {}, T(KIND[o.type] || 'Text') + (i.why ? ' (' + T('recognized as') + ' ' + i.why + ')' : '') + ' · ' + ago(i.t) + (i.routed ? ' · ' + T('sent') : ''))));
        if (view === 'trash') { detail.append(head, pv, h('div', { class: 'cap-acts' }, h('button', { class: 'btn primary', onclick: () => { C.restore(i.id); sel = null; draw(); } }, T('Put Back')))); return; }
        const acts = PatOS.actions.for(o).filter((a) => a.id !== 'capture.add');
        const note = h('p', { class: 'cap-note', 'aria-live': 'polite' });
        const tags = h('input', { class: 'field cap-tags', value: i.tags.map((x) => '#' + x).join(' '), placeholder: T('#tags'), 'aria-label': T('Tags') });
        tags.addEventListener('change', () => { C.update(i.id, { tags: tags.value.split(/[\s,]+/).map((x) => x.replace(/^#/, '')) }); drawSide(); drawList(); });
        detail.append(head, pv, h('h4', {}, T('Send to')), h('div', { class: 'cap-acts' }, ...acts.map((a) => h('button', { class: 'btn', onclick: async () => { note.textContent = ''; const r = await C.route(i.id, a.id); note.className = 'cap-note' + (r.ok ? '' : ' err'); note.textContent = r.ok ? (r.message || T('Done')) : r.message; drawSide(); drawList(); } }, T(a.title)))), note,
          h('h4', {}, T('Tags')), tags,
          h('div', { class: 'cap-acts' }, i.done ? h('button', { class: 'btn', onclick: () => { C.update(i.id, { done: false }); draw(); } }, T('Back to Inbox')) : h('button', { class: 'btn', onclick: () => { C.update(i.id, { done: true }); draw(); } }, T('Mark as Done')),
            h('button', { class: 'btn danger', onclick: () => { C.remove(i.id); sel = null; draw(); } }, T('Delete'))));
      }
      function draw() { drawSide(); drawList(); drawDetail(); }
      const off = PatOS.on('capture', () => { drawSide(); drawList(); });
      win.on('closed', off);
      draw();
    }
  });
})();
