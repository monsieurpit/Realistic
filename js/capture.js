/* Universal Capture (3.3): save anything first, decide where it goes later.
   - Alt+C (or Command Center, Spotlight "capture", a Share menu, the Clipboard) opens a small box: type, paste text or a
     picture, or drop files, and press Enter. Nothing to fill in, no destination to pick.
   - Everything lands in the Capture inbox (the Capture app). There it can be tagged, searched, and sent on with Universal
     Actions (Notes, Reminders, Calendar, Piles...). Sent items are marked done and kept; deleted ones stay 30 days in Recently
     Deleted, so nothing is lost by a wrong click.
   - What an item is comes from plain rules (no AI): a link, an email or phone number (a contact), a date ("friday 3pm",
     "2026-12-01": an event), a file, a picture, or text. The rule that matched is shown, so it is never a guess you can't see.
   - It only captures what you give it: it never reads other apps, pages or the clipboard on its own. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const KEY = 'captureInbox', TRASH = 'captureTrash', MAX = 1000, KEEP_TRASH = 30 * 86400000;
  let items = PatOS.store.get(KEY, []) || [], trash = PatOS.store.get(TRASH, []) || [];
  const save = () => { PatOS.store.set(KEY, items); PatOS.store.set(TRASH, trash); PatOS.emit('capture'); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* what it is, and why we think so */
  function understand(obj) {
    if (obj.type !== 'text') return { obj, why: '' };
    const t = String(obj.text || '').trim();
    if (/^https?:\/\/\S+$/i.test(t)) return { obj: { type: 'url', url: t }, why: T('a link') };
    const email = t.match(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i), phone = t.match(/^\+?[\d\s().-]{7,20}$/);
    if (email) return { obj: { type: 'contact', name: t, email: t }, why: T('an email address') };
    if (phone && (t.match(/\d/g) || []).length >= 7) return { obj: { type: 'contact', name: t, phone: t }, why: T('a phone number') };
    // a date or a time in a short text ("math test friday at 3pm"): an event, with the words that were left as its title
    if (t.length < 140 && PatOS.parseReminder) { let p = null; try { p = PatOS.parseReminder(t, null); } catch (e) {}
      if (p && (p.due || p.time)) { const d = p.due ? new Date(p.due + 'T' + (p.time || '09:00')) : new Date(new Date().toDateString() + ' ' + p.time); if (!isNaN(d)) return { obj: { type: 'event', title: (p.text || t).trim() || t, start: +d }, why: T('a date') }; } }
    return { obj, why: '' };
  }
  const titleOf = (o) => (o.type === 'url' ? o.title || o.url : o.type === 'file' || o.type === 'image' || o.type === 'document' || o.type === 'folder' ? (o.path ? PatOS.fs.basename(o.path) : T('Picture')) : o.type === 'contact' ? o.name : o.type === 'event' ? o.title : String(o.text || '').split('\n')[0].slice(0, 120));

  const capture = {
    /* saves it now; returns the item */
    add(x, opts) {
      opts = opts || {};
      let obj = PatOS.actions ? PatOS.actions.of(x) : (typeof x === 'object' ? x : { type: 'text', text: String(x) });
      if (!obj) return null;
      if (obj.type === 'text' && !String(obj.text || '').trim()) return null;
      if (obj.type === 'text' && obj.text.length > 20000) obj = Object.assign({}, obj, { text: obj.text.slice(0, 20000) });
      if (obj.type === 'image' && obj.url && obj.url.length > 600000) return PatOS.notify({ title: T('That picture is too big to capture'), body: T('Save it as a file, then capture the file.'), icon: 'capture' }), null;
      const u = understand(obj);
      const it = { id: uid(), t: Date.now(), obj: u.obj, why: u.why, title: titleOf(u.obj), tags: [], from: opts.from || '', done: false };
      items.unshift(it); if (items.length > MAX) items = items.slice(0, MAX);
      save(); return it;
    },
    list(opts) {
      opts = opts || {}; const q = String(opts.q || '').toLowerCase();
      return items.filter((i) => (opts.done == null || i.done === opts.done) && (!opts.tag || i.tags.includes(opts.tag)) && (!opts.type || i.obj.type === opts.type)
        && (!q || (i.title + ' ' + (i.obj.text || '') + ' ' + (i.obj.url || '') + ' ' + i.tags.join(' ')).toLowerCase().includes(q)));
    },
    get: (id) => items.find((i) => i.id === id) || null,
    tags: () => [...new Set(items.flatMap((i) => i.tags))].sort(),
    update(id, patch) { const i = capture.get(id); if (!i) return null; if (patch.tags) i.tags = [...new Set(patch.tags.map((x) => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 12); if (patch.title != null) i.title = String(patch.title).slice(0, 200); if (patch.done != null) i.done = !!patch.done; save(); return i; },
    /* sends it on with a Universal Action; it is marked done (and kept) only if that worked */
    async route(id, actionId) {
      const i = capture.get(id); if (!i) return { ok: false, message: T('That item is gone.') };
      const r = await PatOS.actions.run(actionId, i.obj);
      if (r.ok) { i.done = true; i.routed = { to: actionId, t: Date.now() }; save(); }
      return r;
    },
    remove(id) { const i = capture.get(id); if (!i) return; items = items.filter((x) => x !== i); trash.unshift(Object.assign({}, i, { deleted: Date.now() })); trash = trash.filter((x) => Date.now() - x.deleted < KEEP_TRASH).slice(0, 300); save(); },
    restore(id) { const i = trash.find((x) => x.id === id); if (!i) return; trash = trash.filter((x) => x !== i); delete i.deleted; items.unshift(i); save(); },
    trash: () => trash.slice(),
    emptyTrash() { trash = []; save(); },
    count: () => items.filter((i) => !i.done).length,
    understand,
    quick
  };

  /* ---------- the quick box ---------- */
  let box = null;
  function quick(prefill) {
    if (box) { const i = box.querySelector('textarea'); i && i.focus(); return; }
    const ta = h('textarea', { class: 'qc-in', rows: '3', placeholder: T('Type, paste or drop anything'), 'aria-label': T('Capture') });
    if (prefill) ta.value = prefill;
    const files = []; const chips = h('div', { class: 'qc-files' });
    const note = h('small', { class: 'qc-note' }, T('Enter saves · Shift+Enter new line · Esc'));
    const done = () => { const n = capture.count(); close(); PatOS.notify({ title: T('Captured'), body: n + ' ' + T('in your inbox'), icon: 'capture', priority: 'low', duration: 2200, actions: [{ label: T('Open'), run: () => PatOS.launch('capture') }] }); };
    const commit = () => { let any = false; files.forEach((f) => { if (capture.add(f, { from: 'quick' })) any = true; }); if (ta.value.trim() && capture.add(ta.value, { from: 'quick' })) any = true; if (any) done(); else close(); };
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
    ta.addEventListener('paste', (e) => {
      const f = [...((e.clipboardData && e.clipboardData.items) || [])].find((i) => i.kind === 'file' && /^image\//.test(i.type)); if (!f) return;
      e.preventDefault(); const b = f.getAsFile(); if (!b) return;
      const r = new FileReader(); r.onload = () => { files.push({ type: 'image', url: r.result }); chips.appendChild(h('span', { class: 'qc-chip' }, T('Picture'))); }; r.readAsDataURL(b);
    });
    box = h('div', { id: 'quick-capture', class: 'lg-elevated', role: 'dialog', 'aria-label': T('Capture') },
      h('div', { class: 'qc-head' }, h('span', { class: 'qc-ic', html: PatOS.iconHTML('capture') }), h('b', {}, T('Capture')), h('button', { class: 'qc-open', onclick: () => { close(); PatOS.launch('capture'); } }, T('Inbox') + (capture.count() ? ' · ' + capture.count() : ''))),
      ta, chips, h('div', { class: 'qc-foot' }, note, h('button', { class: 'btn primary', onclick: commit }, T('Save'))));
    // files dropped on it (from Piles, or from the computer)
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('over'); });
    box.addEventListener('dragleave', () => box.classList.remove('over'));
    box.addEventListener('drop', async (e) => {
      e.preventDefault(); box.classList.remove('over');
      const p = e.dataTransfer.getData('text/patos-path') || e.dataTransfer.getData('text/plain');
      if (p && p[0] === '/' && PatOS.fs.exists(p)) { files.push(PatOS.actions.of(p)); chips.appendChild(h('span', { class: 'qc-chip' }, PatOS.fs.basename(p))); return; }
      const fl = [...(e.dataTransfer.files || [])].slice(0, 10);
      if (fl.length && PatOS.importFileList) { const saved = await PatOS.importFileList('/Downloads', fl).catch(() => []); (saved || []).forEach((path) => { if (typeof path === 'string') { files.push(PatOS.actions.of(path)); chips.appendChild(h('span', { class: 'qc-chip' }, PatOS.fs.basename(path))); } }); }
      else if (p) ta.value = (ta.value ? ta.value + '\n' : '') + p;
    });
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(box); requestAnimationFrame(() => box && box.classList.add('in'));
    setTimeout(() => ta.focus(), 30);
  }
  function close() { if (!box) return; const b = box; box = null; b.classList.remove('in'); setTimeout(() => b.remove(), 200); }
  document.addEventListener('pointerdown', (e) => { if (box && !box.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (PatOS.loggedIn && e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyC') { e.preventDefault(); quick(); } }, true);
  PatOS.capture = capture;
})();
