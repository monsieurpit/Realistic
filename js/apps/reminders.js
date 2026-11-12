/* Reminders — lists, due dates with alerts, priorities, flags, repeats, search and smart lists.
   Quick add understands plain words: "Math test friday at 3pm !!" or "Devoir de français demain 15h #École". */
(function () {
  'use strict';
  const { h } = PatOS;
  const COLORS = ['#0a84ff', '#ff453a', '#ff9f0a', '#32d74b', '#bf5af2', '#ff375f', '#64d2ff', '#8e8e93'];
  const todayKey = () => PatOS.dateKey(new Date());
  const load = () => PatOS.store.get('reminders', null) || [];
  const REPEATS = [['', 'Never'], ['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']];
  /* the next date of a repeating reminder */
  function nextDue(due, rep) {
    const d = new Date(due + 'T12:00');
    if (rep === 'daily') d.setDate(d.getDate() + 1);
    else if (rep === 'weekdays') { do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6); }
    else if (rep === 'weekly') d.setDate(d.getDate() + 7);
    else if (rep === 'monthly') { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
    else if (rep === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return PatOS.dateKey(d);
  }

  /* quick add (dates, times, priority, list in plain words): PatOS.parseReminder, in js/dates.js (shared with Pat and PatOS Intelligence) */
  const parseReminder = (raw, lists, now) => PatOS.parseReminder(raw, lists, now);
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
    id: 'reminders', name: 'Reminders', icon: 'reminders', width: 860, height: 560, keywords: 'todo tasks list checklist homework due rappels devoirs',
    about: 'To-do lists with due dates and alerts. Type “Math test friday at 3pm !!” and Reminders fills in the date, time and priority.',
    launch(win) {
      let items = load(), lists = PatOS.store.get('remLists', [{ id: 'default', name: PatOS.t('Reminders'), color: COLORS[0] }]);
      let view = 'today', showDone = false, editing = null, query = '';
      const save = () => PatOS.store.set('reminders', items), saveLists = () => PatOS.store.set('remLists', lists);
      const side = h('div', { class: 'rm-side' }), main = h('div', { class: 'rm' });
      win.body.appendChild(h('div', { class: 'rm-wrap' }, side, main));
      if (PatOS.mobile && PatOS.mobile.stack) { PatOS.mobile.stack(win, PatOS.t('Reminders')); side.classList.add('m-list'); main.classList.add('m-detail'); }
      const openView = (k, label) => { view = k; render(); PatOS.mobile && PatOS.mobile.detail && PatOS.mobile.detail(win, true, label); };
      const SMART = [['today', 'Today', '#0a84ff', (r) => !r.done && r.due && r.due <= todayKey()], ['scheduled', 'Scheduled', '#ff453a', (r) => !r.done && r.due], ['all', 'All', '#5e5ce6', (r) => !r.done], ['flagged', 'Flagged', '#ff9f0a', (r) => !r.done && r.flag], ['completed', 'Completed', '#8e8e93', (r) => r.done]];
      let lastView = 'today';
      function listFilter() { if (view === 'search') { const q = query.trim().toLowerCase(); return (r) => (r.text + ' ' + (r.notes || '')).toLowerCase().includes(q); } const sm = SMART.find((s) => s[0] === view); if (sm) return sm[3]; return (r) => (r.list || 'default') === view && (showDone || !r.done); }
      function renderSide() {
        side.innerHTML = '';
        const search = h('input', { class: 'field rm-search', placeholder: PatOS.t('Search'), value: query, spellcheck: 'false', 'aria-label': PatOS.t('Search reminders') });
        search.addEventListener('input', () => { query = search.value; if (query.trim()) { if (view !== 'search') { lastView = view; view = 'search'; } } else if (view === 'search') view = lastView || 'today'; renderMain(); side.querySelectorAll('.rm-tile, .fd-si').forEach((x) => x.classList.toggle('on', false)); });
        side.appendChild(search);
        const grid = h('div', { class: 'rm-smart' });
        // PatOS's smart lists: rows with a small colored glass tile and a drawn symbol (like Settings), the name and a count
        const SYM = { today: 'sun', scheduled: 'calendar', all: 'list', flagged: 'flag', completed: 'check' };
        SMART.forEach(([k, l, c, fn]) => { const b = h('button', { class: 'rm-tile' + (view === k ? ' on' : '') }, h('span', { class: 'rm-dot st-ic', style: { '--ic': c }, html: PatOS.sym(SYM[k]) }), h('span', { class: 'rm-tl' }, PatOS.t(l)), h('b', {}, items.filter(fn).length || '')); b.onclick = () => openView(k, PatOS.t(l)); grid.appendChild(b); });
        side.append(grid, h('div', { class: 'fd-sh' }, PatOS.t('My Lists')));
        lists.forEach((L) => {
          const n = items.filter((r) => (r.list || 'default') === L.id && !r.done).length;
          const el = h('div', { class: 'fd-si' + (view === L.id ? ' on' : '') }, h('span', { class: 'rm-ldot', style: { background: L.color } }), h('span', { class: 'nf-name' }, L.name), h('small', { class: 'nf-count' }, n || ''));
          el.onclick = () => openView(L.id, L.name);
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
        const isSearch = view === 'search';
        const shown = items.filter(listFilter()).sort((a, b) => (a.done - b.done) || ((a.due || '9') + (a.time || '99')).localeCompare((b.due || '9') + (b.time || '99')) || (b.prio || 0) - (a.prio || 0));
        const left = shown.filter((r) => !r.done).length;
        main.appendChild(h('div', { class: 'rm-head' }, h('h1', { style: { color } }, isSearch ? PatOS.t('Results for') + ' “' + query.trim() + '”' : sm ? PatOS.t(sm[1]) : L ? L.name : ''), h('span', {}, left), !sm && !isSearch ? h('button', { class: 'tbtn rm-showdone', onclick: () => { showDone = !showDone; renderMain(); } }, PatOS.t(showDone ? 'Hide Completed' : 'Show Completed')) : null));
        const listEl = h('div', { class: 'rm-list' });
        let group = '';
        shown.forEach((r) => {
          if (view === 'scheduled') { const g = r.due < todayKey() ? PatOS.t('Overdue') : fmtDue({ due: r.due }); if (g !== group) { group = g; listEl.appendChild(h('div', { class: 'rm-group' + (r.due < todayKey() ? ' late' : '') }, g)); } }
          listEl.appendChild(row(r, color));
        });
        if (!shown.length) listEl.appendChild(h('div', { class: 'rm-empty' }, isSearch ? PatOS.t('No results') : view === 'completed' ? PatOS.t('Nothing completed yet') : items.length ? PatOS.t('All done. Nice.') : PatOS.t('Nothing here yet. Type below to add your first reminder.')));
        main.appendChild(listEl);
        if (view !== 'completed' && !isSearch) {
          const add = h('input', { class: 'rm-add', placeholder: '+ ' + PatOS.t('New Reminder') });
          const hint = h('div', { class: 'rm-hint' });
          const understood = () => {
            const p = parseReminder(add.value, lists); const bits = [];
            if (p.due) bits.push(fmtDue(p)); if (p.prio) bits.push('!'.repeat(p.prio) + ' ' + PatOS.t(['', 'Low', 'Medium', 'High'][p.prio])); if (p.list) bits.push('#' + lists.find((x) => x.id === p.list).name);
            hint.textContent = add.value.trim() && bits.length ? bits.join(' · ') : '';
            return p;
          };
          add.addEventListener('input', understood);
          add.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || !add.value.trim()) return;
            const p = understood();
            const r = { id: Date.now(), text: p.text, done: false, list: p.list || (L ? L.id : 'default') };
            if (p.due) r.due = p.due; else if (view === 'today') r.due = todayKey();
            if (p.time) { r.time = p.time; PatOS.alarms.askPermission(); }
            if (p.prio) r.prio = p.prio;
            if (view === 'flagged') r.flag = true;
            items.push(r); add.value = ''; hint.textContent = ''; save(); render(); main.querySelector('.rm-add').focus();
          });
          main.append(add, hint);
          if (!items.length) main.appendChild(h('div', { class: 'rm-tip' }, ''));
        }
      }
      function row(r, color) {
        const chk = h('button', { class: 'rm-chk' + (r.done ? ' on' : ''), style: { '--c': color } });
        const txt = h('div', { class: 'rm-txt', contenteditable: 'true', spellcheck: 'true' }, r.text);
        const lst = lists.find((x) => x.id === (r.list || 'default'));
        const metaBits = [r.due ? h('span', { class: overdue(r) ? 'late' : '' }, fmtDue(r) + (r.repeat ? ' ↻' : '')) : null, SMART.some((s) => s[0] === view) && lst ? h('span', {}, lst.name) : null, r.notes ? h('span', {}, r.notes) : null].filter(Boolean);
        const meta = metaBits.length ? h('div', { class: 'rm-meta' }, ...metaBits) : null;
        const prio = r.prio ? h('span', { class: 'rm-prio' }, '!'.repeat(r.prio)) : null;
        const flag = r.flag ? h('span', { class: 'rm-flag', html: PatOS.sym('flag') }) : null;
        const info = h('button', { class: 'rm-info', title: 'Details' }, 'ⓘ');
        chk.onclick = () => {
          // a repeating reminder moves to its next date instead of being finished
          if (!r.done && r.repeat && r.due) {
            const before = { due: r.due, alerted: r.alerted }; r.due = nextDue(r.due, r.repeat); delete r.alerted; PatOS.sound.pop(); save(); render();
            return undoBar(PatOS.t('Next time:') + ' ' + fmtDue(r), () => { r.due = before.due; if (before.alerted) r.alerted = true; save(); render(); });
          }
          r.done = !r.done; r.doneAt = r.done ? Date.now() : null; if (r.done) { PatOS.sound.pop(); undoBar(PatOS.t('Completed') + ' “' + r.text.slice(0, 40) + '”', () => { r.done = false; r.doneAt = null; save(); render(); }); } const el = chk.closest('.rm-item'); if (r.done && !SMART.some((s) => s[0] === view && s[0] !== 'completed') && !showDone) { el.classList.add('leaving'); setTimeout(() => { save(); render(); }, 450); } else { save(); render(); } };
        txt.onblur = () => { const v = txt.textContent.trim(); if (v === r.text) return; r.text = v; if (!r.text) items = items.filter((x) => x !== r); save(); render(); };
        txt.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); txt.blur(); } };
        info.onclick = () => details(r);
        const el = h('div', { class: 'rm-item' + (r.done ? ' done' : ''), draggable: 'true' }, chk, h('div', { class: 'rm-body' }, h('div', { class: 'rm-line' }, prio, txt, flag), meta), info);
        el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/rem', String(r.id)));
        return el;
      }
      function undoBar(text, undo) {
        const old = win.body.querySelector('.rm-undo'); if (old) old.remove();
        const bar = h('div', { class: 'rm-undo' }, h('span', {}, text), h('button', { onclick: () => { bar.remove(); undo(); } }, PatOS.t('Undo')));
        win.body.appendChild(bar); setTimeout(() => bar.remove(), 5000);
      }
      function details(r) {
        const fDue = h('input', { class: 'field', type: 'date', value: r.due || '' }), fTime = h('input', { class: 'field', type: 'time', value: r.time || '' });
        const fPrio = h('select', { class: 'field' }, ...[[0, 'None'], [1, 'Low'], [2, 'Medium'], [3, 'High']].map(([v, l]) => h('option', { value: v, selected: (r.prio || 0) === v }, PatOS.t(l))));
        const fList = h('select', { class: 'field' }, ...lists.map((L) => h('option', { value: L.id, selected: (r.list || 'default') === L.id }, L.name)));
        const fFlag = h('input', { type: 'checkbox', checked: !!r.flag });
        const fRep = h('select', { class: 'field' }, ...REPEATS.map(([v, l]) => h('option', { value: v, selected: (r.repeat || '') === v }, PatOS.t(l))));
        const fNotes = h('textarea', { class: 'field ce-notes', placeholder: PatOS.t('Notes') }); fNotes.value = r.notes || '';
        const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
        layer.appendChild(h('div', { class: 'dlg ce' }, h('b', {}, r.text),
          h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Date')), fDue), h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Time')), fTime),
          h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Repeat')), fRep), h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Priority')), fPrio), h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('List')), fList), h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Flagged')), fFlag), fNotes,
          h('div', { class: 'dlg-btns' }, h('button', { class: 'btn danger', onclick: () => { items = items.filter((x) => x !== r); save(); close(); render(); } }, 'Delete'), h('button', { class: 'btn primary', onclick: () => { r.repeat = fRep.value || null; if (r.repeat && !fDue.value) fDue.value = todayKey(); r.due = fDue.value || null; r.time = fDue.value ? fTime.value || null : null; if (r.time) PatOS.alarms.askPermission(); r.prio = +fPrio.value; r.list = fList.value; r.flag = fFlag.checked; r.notes = fNotes.value.trim(); delete r.alerted; save(); close(); render(); } }, 'Done'))));
        layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); });
        document.body.appendChild(layer);
      }
      function render() { renderSide(); renderMain(); }
      const off = PatOS.on('reminders', () => { items = load(); render(); }); win.on('closed', off);
      render();
    }
  });
  /* alerts at the due time are sent by PatOS.alarms (js/alarms.js), so they arrive on time in the background */
})();
