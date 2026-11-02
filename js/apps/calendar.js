/* Calendar — month and week views, event editor, reminders */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.dateKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const COLORS = ['#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#0a84ff', '#bf5af2', '#8e8e93'];
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const fmtT = (t) => { const m = toMin(t); if (m == null) return ''; const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };

  PatOS.registerApp({
    id: 'calendar', name: 'Calendar', icon: 'calendar', width: 980, height: 640, keywords: 'date events schedule agenda week',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let cursor = new Date(), selected = new Date(), mode = PatOS.store.get('calMode', 'month');
      let events = PatOS.store.get('calendar', {});
      Object.values(events).forEach((l) => l.forEach((e) => { if (!e.id) e.id = PatOS.uid(); }));
      const save = () => PatOS.store.set('calendar', events);
      const title = h('div', { class: 'cal-title' });
      const seg = h('div', { class: 'seg' }, ...[['week', 'Week'], ['month', 'Month']].map(([k, l]) => h('button', { class: 'tab', 'data-k': k, onclick: () => { mode = k; PatOS.store.set('calMode', mode); render(); } }, l)));
      const bPrev = h('button', { class: 'tbtn', title: 'Previous' }, '‹'), bNext = h('button', { class: 'tbtn', title: 'Next' }, '›');
      const bToday = h('button', { class: 'btn' }, 'Today'), bAdd = h('button', { class: 'tbtn', title: 'New event' }, '+');
      win.toolbar.append(title, h('div', { style: { flex: 1 } }), seg, bAdd, bPrev, bToday, bNext); win.toolbar.style.paddingLeft = '76px';
      const main = h('div', { class: 'cal-main' }), side = h('div', { class: 'cal-side' });
      win.body.appendChild(h('div', { class: 'cal-wrap' }, main, side));
      const dayEvents = (d) => (events[PatOS.dateKey(d)] || []).slice().sort((a, b) => (toMin(a.time) ?? -1) - (toMin(b.time) ?? -1));

      function render() {
        [...seg.children].forEach((b) => b.classList.toggle('on', b.dataset.k === mode));
        main.innerHTML = ''; mode === 'week' ? week() : month(); renderSide();
      }
      function month() {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        title.innerHTML = '<b>' + first.toLocaleDateString(undefined, { month: 'long' }) + '</b> ' + first.getFullYear();
        const grid = h('div', { class: 'cal-grid' });
        for (let i = 0; i < 7; i++) { const d = new Date(2024, 0, 7 + i); grid.appendChild(h('div', { class: 'cal-dn' }, d.toLocaleDateString(undefined, { weekday: 'short' }))); }
        const start = new Date(first); start.setDate(1 - first.getDay());
        const todayK = PatOS.dateKey(new Date()), selK = PatOS.dateKey(selected);
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i); const k = PatOS.dateKey(d);
          const cell = h('div', { class: 'cal-cell' + (d.getMonth() !== first.getMonth() ? ' other' : '') + (k === selK ? ' sel' : '') },
            h('span', { class: 'cal-num' + (k === todayK ? ' today' : '') }, d.getDate() === 1 ? d.toLocaleDateString(undefined, { month: 'short' }) + ' 1' : d.getDate()));
          const evs = dayEvents(d);
          evs.slice(0, 3).forEach((ev) => { const e = h('div', { class: 'cal-ev', style: { '--c': ev.color || COLORS[4] } }, ev.time ? fmtT(ev.time) + ' ' : '', ev.title); e.onclick = (x) => { x.stopPropagation(); editor(d, ev); }; cell.appendChild(e); });
          if (evs.length > 3) cell.appendChild(h('div', { class: 'cal-more' }, '+' + (evs.length - 3) + ' more'));
          cell.onclick = () => { selected = d; render(); }; cell.ondblclick = () => { selected = d; editor(d); };
          grid.appendChild(cell);
        }
        main.appendChild(grid);
      }
      function week() {
        const start = new Date(cursor); start.setDate(cursor.getDate() - cursor.getDay()); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        title.innerHTML = '<b>' + start.toLocaleDateString(undefined, { month: 'long' }) + '</b> ' + start.getFullYear();
        const wrap = h('div', { class: 'cw' });
        const head = h('div', { class: 'cw-head' }, h('div', { class: 'cw-gutter' }));
        const allday = h('div', { class: 'cw-allday' }, h('div', { class: 'cw-gutter' }, PatOS.t('all-day')));
        const body = h('div', { class: 'cw-body' });
        const hours = h('div', { class: 'cw-hours' });
        for (let hr = 0; hr < 24; hr++) { const d = new Date(); d.setHours(hr, 0); hours.appendChild(h('div', { class: 'cw-hr' }, hr ? d.toLocaleTimeString(undefined, { hour: 'numeric' }) : '')); }
        body.appendChild(hours);
        const todayK = PatOS.dateKey(new Date());
        for (let i = 0; i < 7; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i); const k = PatOS.dateKey(d);
          head.appendChild(h('div', { class: 'cw-day' + (k === todayK ? ' today' : '') }, h('small', {}, d.toLocaleDateString(undefined, { weekday: 'short' })), h('b', {}, d.getDate())));
          const ad = h('div', { class: 'cw-adcell' }); allday.appendChild(ad);
          const col = h('div', { class: 'cw-col' + (k === todayK ? ' today' : '') });
          col.addEventListener('dblclick', (e) => { const r = col.getBoundingClientRect(); const mins = Math.round((e.clientY - r.top) / r.height * 1440 / 30) * 30; editor(d, null, String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0')); });
          dayEvents(d).forEach((ev) => {
            const s = toMin(ev.time);
            const el = h('div', { class: 'cw-ev', style: { '--c': ev.color || COLORS[4] } }, h('b', {}, ev.title), s != null ? h('small', {}, fmtT(ev.time) + (ev.end ? ' – ' + fmtT(ev.end) : '')) : null);
            el.onclick = (x) => { x.stopPropagation(); editor(d, ev); };
            if (s == null) { ad.appendChild(el); return; }
            const e2 = toMin(ev.end); const dur = Math.max(30, (e2 != null && e2 > s ? e2 : s + 60) - s);
            el.style.top = (s / 1440 * 100) + '%'; el.style.height = (dur / 1440 * 100) + '%';
            col.appendChild(el);
          });
          if (k === todayK) { const now = new Date(); col.appendChild(h('div', { class: 'cw-now', style: { top: ((now.getHours() * 60 + now.getMinutes()) / 1440 * 100) + '%' } })); }
          body.appendChild(col);
        }
        wrap.append(head, allday, h('div', { class: 'cw-scroll' }, body));
        main.appendChild(wrap);
        setTimeout(() => { const sc = wrap.querySelector('.cw-scroll'); if (sc) sc.scrollTop = sc.scrollHeight * (7.5 / 24); }, 0);
      }
      function renderSide() {
        side.innerHTML = '';
        side.append(h('div', { class: 'cal-sd' }, selected.toLocaleDateString(undefined, { weekday: 'long' })), h('div', { class: 'cal-sdn' }, selected.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })));
        const list = dayEvents(selected);
        if (!list.length) side.appendChild(h('div', { class: 'cal-none' }, 'Nothing planned. Double-click a day or press + to add an event.'));
        list.forEach((ev) => {
          const el = h('div', { class: 'cal-item', style: { '--c': ev.color || COLORS[4] } }, h('b', {}, ev.title), h('small', {}, ev.time ? fmtT(ev.time) + (ev.end ? ' – ' + fmtT(ev.end) : '') : PatOS.t('All day')), ev.notes ? h('div', { class: 'cal-notes' }, ev.notes) : null);
          el.onclick = () => editor(selected, ev); side.appendChild(el);
        });
        // next 7 days
        const up = []; for (let i = 1; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); dayEvents(d).forEach((ev) => up.push({ d, ev })); }
        if (up.length) { side.appendChild(h('div', { class: 'cal-upt' }, PatOS.t('Coming up'))); up.slice(0, 6).forEach(({ d, ev }) => side.appendChild(h('div', { class: 'cal-up', style: { '--c': ev.color || COLORS[4] }, onclick: () => { selected = d; cursor = new Date(d); render(); } }, h('b', {}, ev.title), h('small', {}, d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + (ev.time ? ' · ' + fmtT(ev.time) : ''))))); }
        side.appendChild(h('button', { class: 'btn primary cal-addbtn', onclick: () => editor(selected) }, '+ ' + PatOS.t('New Event')));
      }
      function editor(day, ev, time) {
        const isNew = !ev; const e = ev ? Object.assign({}, ev) : { id: PatOS.uid(), title: '', time: time || '', end: '', color: COLORS[4], notes: '' };
        let date = PatOS.dateKey(day);
        const fTitle = h('input', { class: 'field', value: e.title, placeholder: PatOS.t('Title') });
        const fDate = h('input', { class: 'field', type: 'date', value: date });
        const fAll = h('input', { type: 'checkbox', checked: !e.time });
        const fStart = h('input', { class: 'field', type: 'time', value: e.time || '09:00' }), fEnd = h('input', { class: 'field', type: 'time', value: e.end || '' });
        const times = h('div', { class: 'ce-times' }, fStart, h('span', {}, '–'), fEnd);
        fAll.onchange = () => { times.style.display = fAll.checked ? 'none' : ''; }; fAll.onchange();
        const fNotes = h('textarea', { class: 'field ce-notes', placeholder: PatOS.t('Notes') }, e.notes || ''); fNotes.value = e.notes || '';
        const colors = h('div', { class: 'ce-colors' }, ...COLORS.map((c) => { const b = h('button', { class: 'ce-c' + (e.color === c ? ' on' : ''), style: { background: c } }); b.onclick = () => { e.color = c; colors.querySelectorAll('.ce-c').forEach((x) => x.classList.toggle('on', x === b)); }; return b; }));
        const layer = h('div', { class: 'dlg-layer' });
        const close = () => layer.remove();
        const commit = () => {
          e.title = fTitle.value.trim() || PatOS.t('New Event'); e.time = fAll.checked ? '' : fStart.value; e.end = fAll.checked ? '' : fEnd.value; e.notes = fNotes.value.trim();
          Object.keys(events).forEach((k) => { events[k] = events[k].filter((x) => x.id !== e.id); if (!events[k].length) delete events[k]; });
          (events[fDate.value || date] = events[fDate.value || date] || []).push(e);
          save(); selected = new Date((fDate.value || date) + 'T12:00'); close(); render();
        };
        fTitle.addEventListener('keydown', (k) => { if (k.key === 'Enter') commit(); });
        layer.appendChild(h('div', { class: 'dlg ce' }, h('b', {}, PatOS.t(isNew ? 'New Event' : 'Edit Event')), fTitle,
          h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('Date')), fDate), h('label', { class: 'ce-row' }, h('span', {}, PatOS.t('All day')), fAll), times, colors, fNotes,
          h('div', { class: 'dlg-btns' }, !isNew ? h('button', { class: 'btn danger', onclick: () => { Object.keys(events).forEach((k) => { events[k] = events[k].filter((x) => x.id !== e.id); if (!events[k].length) delete events[k]; }); save(); close(); render(); } }, 'Delete') : null, h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', onclick: commit }, isNew ? 'Add' : 'Save'))));
        layer.addEventListener('pointerdown', (x) => { if (x.target === layer) close(); });
        document.body.appendChild(layer); setTimeout(() => fTitle.focus(), 30);
      }
      const shift = (dir) => { if (mode === 'week') cursor.setDate(cursor.getDate() + 7 * dir); else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1); render(); };
      bPrev.onclick = () => shift(-1); bNext.onclick = () => shift(1);
      bToday.onclick = () => { cursor = new Date(); selected = new Date(); render(); };
      bAdd.onclick = () => editor(selected);
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => { if (e.target !== win.body) return; if (e.key === 'ArrowLeft') shift(-1); if (e.key === 'ArrowRight') shift(1); if (e.key === 't') bToday.click(); if (e.key === 'n') editor(selected); });
      render();
    }
  });

  /* reminders for events with a time today */
  setInterval(() => {
    if (!PatOS.loggedIn) return;
    const d = new Date(); const k = PatOS.dateKey(d);
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    (PatOS.store.get('calendar', {})[k] || []).forEach((ev) => { if (ev.time === hm && d.getSeconds() < 30) PatOS.notify({ title: ev.title, body: PatOS.t('Starting now'), icon: 'calendar' }); });
  }, 30000);
})();
