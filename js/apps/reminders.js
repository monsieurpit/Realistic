/* Reminders — lists, due dates with alerts, priorities, flags and smart lists */
(function () {
  'use strict';
  const { h } = PatOS;
  const COLORS = ['#0a84ff', '#ff453a', '#ff9f0a', '#32d74b', '#bf5af2', '#ff375f', '#64d2ff', '#8e8e93'];
  const todayKey = () => PatOS.dateKey(new Date());
  const load = () => PatOS.store.get('reminders', null) || [{ id: 1, text: 'Finish math homework', done: false, due: todayKey(), time: '18:00', prio: 2 }, { id: 2, text: 'Try the 3D Galaxy app', done: false }, { id: 3, text: 'Customize the dock', done: true }];
  const fmtDue = (r) => {
    if (!r.due) return '';
    const d = new Date(r.due + 'T12:00'), t = new Date(); t.setHours(12, 0, 0, 0);
    const diff = Math.round((d - t) / 86400000);
    let s = diff === 0 ? PatOS.t('Today') : diff === 1 ? PatOS.t('Tomorrow') : diff === -1 ? PatOS.t('Yesterday') : d.toLocaleDateString(undefined, { weekday: diff > 0 && diff < 7 ? 'long' : undefined, month: 'short', day: 'numeric' });
    if (r.time) { const [hh, mm] = r.time.split(':').map(Number); const x = new Date(); x.setHours(hh, mm, 0, 0); s += ', ' + x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
    return s;
  };
  const overdue = (r) => !r.done && r.due && (r.due < todayKey() || (r.due === todayKey() && r.time && r.time < new Date().toTimeString().slice(0, 5)));

  PatOS.registerApp({
    id: 'reminders', name: 'Reminders', icon: 'reminders', width: 860, height: 560, keywords: 'todo tasks list checklist homework due',
    launch(win) {
      let items = load(), lists = PatOS.store.get('remLists', [{ id: 'default', name: PatOS.t('Reminders'), color: COLORS[0] }]);
      let view = 'today', showDone = false, editing = null;
      const save = () => PatOS.store.set('reminders', items), saveLists = () => PatOS.store.set('remLists', lists);
      const side = h('div', { class: 'rm-side' }), main = h('div', { class: 'rm' });
      win.body.appendChild(h('div', { class: 'rm-wrap' }, side, main));
      const SMART = [['today', 'Today', '#0a84ff', (r) => !r.done && r.due && r.due <= todayKey()], ['scheduled', 'Scheduled', '#ff453a', (r) => !r.done && r.due], ['all', 'All', '#3a3a3c', (r) => !r.done], ['flagged', 'Flagged', '#ff9f0a', (r) => !r.done && r.flag], ['completed', 'Completed', '#8e8e93', (r) => r.done]];
      function listFilter() { const sm = SMART.find((s) => s[0] === view); if (sm) return sm[3]; return (r) => (r.list || 'default') === view && (showDone || !r.done); }
      function renderSide() {
        side.innerHTML = '';
        const grid = h('div', { class: 'rm-smart' });
        SMART.forEach(([k, l, c, fn]) => { const b = h('button', { class: 'rm-tile' + (view === k ? ' on' : '') }, h('span', { class: 'rm-dot', style: { background: c } }), h('b', {}, items.filter(fn).length), h('span', {}, PatOS.t(l))); b.onclick = () => { view = k; render(); }; grid.appendChild(b); });
        side.append(grid, h('div', { class: 'fd-sh' }, PatOS.t('My Lists')));
        lists.forEach((L) => {
          const n = items.filter((r) => (r.list || 'default') === L.id && !r.done).length;
          const el = h('div', { class: 'fd-si' + (view === L.id ? ' on' : '') }, h('span', { class: 'rm-ldot', style: { background: L.color } }), h('span', { class: 'nf-name' }, L.name), h('small', { class: 'nf-count' }, n || ''));
          el.onclick = () => { view = L.id; render(); };
          el.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: PatOS.t('Rename List…'), action: async () => { const v = await PatOS.ask(PatOS.t('Rename List…'), L.name, { icon: 'reminders', ok: 'Rename' }); if (v) { L.name = v; saveLists(); render(); } } }, { header: PatOS.t('Color') }, ...COLORS.map((c, i) => ({ label: ['Blue', 'Red', 'Orange', 'Green', 'Purple', 'Pink', 'Teal', 'Gray'].map(PatOS.t)[i], checked: L.color === c, action: () => { L.color = c; saveLists(); render(); } })), { divider: true }, { label: PatOS.t('Delete List'), disabled: lists.length < 2, action: async () => { if (await PatOS.confirmBox(PatOS.t('Delete this list?'), PatOS.t('Its reminders will be deleted too.'), { danger: true, ok: 'Delete', icon: 'reminders' })) { items = items.filter((r) => (r.list || 'default') !== L.id); lists = lists.filter((x) => x !== L); save(); saveLists(); view = 'today'; render(); } } }], e.clientX, e.clientY); };
          el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); }); el.addEventListener('dragleave', () => el.classList.remove('drop'));
          el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drop'); const r = items.find((x) => String(x.id) === e.dataTransfer.getData('text/rem')); if (r) { r.list = L.id; save(); render(); } });
          side.appendChild(el);
        });
        side.appendChild(h('button', { class: 'nf-new', onclick: async () => { const v = await PatOS.ask(PatOS.t('New List'), PatOS.t('Homework'), { icon: 'reminders', ok: 'Create' }); if (v) { const L = { id: PatOS.uid(), name: v, color: COLORS[lists.length % COLORS.length] }; lists.push(L); saveLists(); view = L.id; render(); } } }, '+ ' + PatOS.t('Add List')));
      }
      function renderMain() {
        main.innerHTML = '';
        const sm = SMART.find((s) => s[0] === view); const L = lists.find((x) => x.id === view);
        const color = sm ? sm[2] : L ? L.color : COLORS[0];
        const shown = items.filter(listFilter()).sort((a, b) => (a.done - b.done) || ((a.due || '9') + (a.time || '99')).localeCompare((b.due || '9') + (b.time || '99')) || (b.prio || 0) - (a.prio || 0));
        const left = shown.filter((r) => !r.done).length;
        main.appendChild(h('div', { class: 'rm-head' }, h('h1', { style: { color } }, sm ? PatOS.t(sm[1]) : L ? L.name : ''), h('span', {}, left), !sm ? h('button', { class: 'tbtn rm-showdone', onclick: () => { showDone = !showDone; renderMain(); } }, PatOS.t(showDone ? 'Hide Completed' : 'Show Completed')) : null));
        const listEl = h('div', { class: 'rm-list' });
        let group = '';
        shown.forEach((r) => {
          if (view === 'scheduled') { const g = r.due < todayKey() ? PatOS.t('Overdue') : fmtDue({ due: r.due }); if (g !== group) { group = g; listEl.appendChild(h('div', { class: 'rm-group' + (r.due < todayKey() ? ' late' : '') }, g)); } }
          listEl.appendChild(row(r, color));
        });
        if (!shown.length) listEl.appendChild(h('div', { class: 'rm-empty' }, view === 'completed' ? PatOS.t('Nothing completed yet') : PatOS.t('All done. Nice.')));
        main.appendChild(listEl);
        if (view !== 'completed') {
          const add = h('input', { class: 'rm-add', placeholder: '+ ' + PatOS.t('New Reminder') });
          add.addEventListener('keydown', (e) => { if (e.key === 'Enter' && add.value.trim()) { const r = { id: Date.now(), text: add.value.trim(), done: false, list: L ? L.id : 'default' }; if (view === 'today') r.due = todayKey(); if (view === 'flagged') r.flag = true; items.push(r); add.value = ''; save(); render(); main.querySelector('.rm-add').focus(); } });
          main.appendChild(add);
        }
      }
      function row(r, color) {
        const chk = h('button', { class: 'rm-chk' + (r.done ? ' on' : ''), style: { '--c': color } });
        const txt = h('div', { class: 'rm-txt', contenteditable: 'true', spellcheck: 'true' }, r.text);
        const lst = lists.find((x) => x.id === (r.list || 'default'));
        const metaBits = [r.due ? h('span', { class: overdue(r) ? 'late' : '' }, fmtDue(r)) : null, SMART.some((s) => s[0] === view) && lst ? h('span', {}, lst.name) : null, r.notes ? h('span', {}, r.notes) : null].filter(Boolean);
        const meta = metaBits.length ? h('div', { class: 'rm-meta' }, ...metaBits) : null;
        const prio = r.prio ? h('span', { class: 'rm-prio' }, '!'.repeat(r.prio)) : null;
        const flag = r.flag ? h('span', { class: 'rm-flag', html: PatOS.sym('flag') }) : null;
        const info = h('button', { class: 'rm-info', title: 'Details' }, 'ⓘ');
        chk.onclick = () => { r.done = !r.done; r.doneAt = r.done ? Date.now() : null; if (r.done) PatOS.sound.pop(); const el = chk.closest('.rm-item'); if (r.done && !SMART.some((s) => s[0] === view && s[0] !== 'completed') && !showDone) { el.classList.add('leaving'); setTimeout(() => { save(); render(); }, 450); } else { save(); render(); } };
        txt.onblur = () => { const v = txt.textContent.trim(); if (v === r.text) return; r.text = v; if (!r.text) items = items.filter((x) => x !== r); save(); render(); };
        txt.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); txt.blur(); } };
        info.onclick = () => details(r);
        const el = h('div', { class: 'rm-item' + (r.done ? ' done' : ''), draggable: 'true' }, chk, h('div', { class: 'rm-body' }, h('div', { class: 'rm-line' }, prio, txt, flag), meta), info);
        el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/rem', String(r.id)));
        return el;
      }
      function details(r) {
        const fDue = h('input', { class: 'field', type: 'date', value: r.due || '' }), fTime = h('input', { class: 'field', type: 'time', value: r.time || '' });
        const fPrio = h('select', { class: 'field' }, ...[[0, 'None'], [1, 'Low'], [2, 'Medium'], [3, 'High']].map(([v, l]) => h('option', { value: v, selected: (r.prio || 0) === v }, PatOS.t(l))));
        const fList = h('select', { class: 'field' }, ...lists.map((L) => h('option', { value: L.id, selected: (r.list || 'default') === L.id }, L.name)));
        const fFlag = h('input', { type: 'checkbox', checked: !!r.flag });
        const fNotes = h('textarea', { class: 'field ce-notes', placeholder: PatOS.t('Notes') }); fNotes.value = r.notes || '';
        const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
        layer.appendChild(h('div', { class: 'dlg ce' }, h('b', {}, r.text),
          h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Date')), fDue), h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Time')), fTime),
          h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Priority')), fPrio), h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('List')), fList), h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Flagged')), fFlag), fNotes,
          h('div', { class: 'dlg-btns' }, h('button', { class: 'btn danger', onclick: () => { items = items.filter((x) => x !== r); save(); close(); render(); } }, 'Delete'), h('button', { class: 'btn primary', onclick: () => { r.due = fDue.value || null; r.time = fDue.value ? fTime.value || null : null; r.prio = +fPrio.value; r.list = fList.value; r.flag = fFlag.checked; r.notes = fNotes.value.trim(); delete r.alerted; save(); close(); render(); } }, 'Done'))));
        layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); });
        document.body.appendChild(layer);
      }
      function render() { renderSide(); renderMain(); }
      const off = PatOS.on('reminders', () => { items = load(); render(); }); win.on('closed', off);
      render();
    }
  });
  /* alerts at the due time, while PatOS is open */
  setInterval(() => {
    if (!PatOS.loggedIn) return;
    const items = PatOS.store.get('reminders', []); let changed = false;
    const now = new Date(), k = PatOS.dateKey(now), hm = now.toTimeString().slice(0, 5);
    items.forEach((r) => { if (!r.done && !r.alerted && r.due === k && r.time && r.time <= hm) { r.alerted = true; changed = true; PatOS.notify({ title: r.text, body: PatOS.t('Reminder'), icon: 'reminders', duration: 10000 }); } });
    if (changed) { PatOS.store.set('reminders', items); PatOS.emit('reminders'); }
  }, 20000);
})();
