/* Calendar */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.dateKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const COLORS = ['#ff453a', '#ff9f0a', '#32d74b', '#0a84ff', '#bf5af2'];
  PatOS.registerApp({
    id: 'calendar', name: 'Calendar', icon: 'calendar', width: 900, height: 600, keywords: 'date events schedule',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let view = new Date(); view.setDate(1);
      let selected = new Date();
      let events = PatOS.store.get('calendar', {});
      const save = () => PatOS.store.set('calendar', events);
      const title = h('div', { class: 'cal-title' });
      const bPrev = h('button', { class: 'tbtn' }, '‹'); const bNext = h('button', { class: 'tbtn' }, '›');
      const bToday = h('button', { class: 'btn' }, 'Today');
      const bAdd = h('button', { class: 'tbtn', title: 'New event' }, '+');
      win.toolbar.append(title, h('div', { style: { flex: 1 } }), bAdd, bPrev, bToday, bNext);
      win.toolbar.style.paddingLeft = '76px';
      const grid = h('div', { class: 'cal-grid' });
      const side = h('div', { class: 'cal-side' });
      win.body.appendChild(h('div', { class: 'cal-wrap' }, h('div', { class: 'cal-main' }, grid), side));

      function render() {
        title.innerHTML = '<b>' + view.toLocaleDateString(undefined, { month: 'long' }) + '</b> ' + view.getFullYear();
        grid.innerHTML = '';
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => grid.appendChild(h('div', { class: 'cal-dn' }, d)));
        const start = new Date(view); start.setDate(1 - view.getDay());
        const todayK = PatOS.dateKey(new Date()), selK = PatOS.dateKey(selected);
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const k = PatOS.dateKey(d);
          const cell = h('div', { class: 'cal-cell' + (d.getMonth() !== view.getMonth() ? ' other' : '') + (k === selK ? ' sel' : '') },
            h('span', { class: 'cal-num' + (k === todayK ? ' today' : '') }, d.getDate() === 1 ? d.toLocaleDateString(undefined, { month: 'short' }) + ' ' + 1 : d.getDate()));
          (events[k] || []).slice(0, 3).forEach((ev) => cell.appendChild(h('div', { class: 'cal-ev', style: { '--c': ev.color || COLORS[3] } }, ev.time ? ev.time + ' ' : '', ev.title)));
          if ((events[k] || []).length > 3) cell.appendChild(h('div', { class: 'cal-more' }, '+' + (events[k].length - 3) + ' more'));
          cell.onclick = () => { selected = d; render(); };
          cell.ondblclick = () => { selected = d; add(); };
          grid.appendChild(cell);
        }
        renderSide();
      }
      function renderSide() {
        const k = PatOS.dateKey(selected);
        side.innerHTML = '';
        side.append(h('div', { class: 'cal-sd' }, selected.toLocaleDateString(undefined, { weekday: 'long' })), h('div', { class: 'cal-sdn' }, selected.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })));
        const list = (events[k] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        if (!list.length) side.appendChild(h('div', { class: 'cal-none' }, 'No events. Double-click a day or press + to add one.'));
        list.forEach((ev) => {
          const el = h('div', { class: 'cal-item', style: { '--c': ev.color || COLORS[3] } }, h('b', {}, ev.title), h('small', {}, ev.time || 'All day'), h('button', { class: 'cal-del', title: 'Delete' }, '×'));
          el.querySelector('.cal-del').onclick = () => { events[k] = events[k].filter((x) => x !== ev); if (!events[k].length) delete events[k]; save(); render(); };
          side.appendChild(el);
        });
        side.appendChild(h('button', { class: 'btn primary cal-addbtn', onclick: add }, '+ Add Event'));
      }
      async function add() {
        const t = await PatOS.ask('New event on ' + selected.toLocaleDateString(), 'Study session', { icon: 'calendar', ok: 'Next' }); if (!t) return;
        const tm = await PatOS.ask('Time (e.g. 14:30)', '', { icon: 'calendar', text: 'Leave empty for an all-day event.', ok: 'Add Event' }); if (tm === null) return;
        const time = tm;
        const k = PatOS.dateKey(selected);
        (events[k] = events[k] || []).push({ title: t, time: time.trim(), color: COLORS[Math.floor(Math.random() * COLORS.length)] });
        save(); render();
      }
      bPrev.onclick = () => { view.setMonth(view.getMonth() - 1); render(); };
      bNext.onclick = () => { view.setMonth(view.getMonth() + 1); render(); };
      bToday.onclick = () => { view = new Date(); view.setDate(1); selected = new Date(); render(); };
      bAdd.onclick = add;
      win.body.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > 30) { view.setMonth(view.getMonth() + (e.deltaY > 0 ? 1 : -1)); render(); } }, { passive: true });
      render();
    }
  });

  /* reminders for events with a time today */
  setInterval(() => {
    if (!PatOS.loggedIn) return;
    const d = new Date(); const k = PatOS.dateKey(d);
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    (PatOS.store.get('calendar', {})[k] || []).forEach((ev) => { if (ev.time === hm && d.getSeconds() < 30) PatOS.notify({ title: ev.title, body: 'Starting now · ' + ev.time, icon: 'calendar' }); });
  }, 30000);
})();
