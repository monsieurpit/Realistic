/* Calendar — day, week, month and year views, repeating events, alerts, quick add in plain words,
   search, drag an event to another day, and .ics import / export (Google Calendar, Outlook, Apple).
   Events are kept by their date: { 'YYYY-MM-DD': [event…] }. A repeating event lives on its first date
   and shows up on the others (repeat: daily · weekdays · weekly · biweekly · monthly · yearly,
   until: last date, skip: dates removed one by one). Alerts are rung by PatOS.alarms, so they arrive
   on time with Calendar closed and PatOS in the background. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  PatOS.dateKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const K = PatOS.dateKey;
  const fromKey = (k) => new Date(k + 'T12:00');
  const LOC = () => (PatOS.lang === 'fr' ? 'fr-CA' : undefined);
  const COLORS = ['#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#0a84ff', '#bf5af2', '#8e8e93'];
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const fmtT = (t) => { const m = toMin(t); if (m == null) return ''; const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.toLocaleTimeString(LOC(), { hour: 'numeric', minute: '2-digit' }); };
  const REPEATS = [['', 'Never'], ['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month'], ['yearly', 'Every year']];
  const ALERTS = [['none', 'None'], ['0', 'At time of event'], ['5', '5 minutes before'], ['10', '10 minutes before'], ['15', '15 minutes before'], ['30', '30 minutes before'], ['60', '1 hour before'], ['1440', '1 day before']];
  const load = () => { const e = PatOS.store.get('calendar', {}) || {}; Object.values(e).forEach((l) => l.forEach((x) => { if (!x.id) x.id = PatOS.uid(); })); return e; };

  /* does a repeating event (first date `base`) happen on day `k`? */
  function occurs(ev, base, k) {
    if (k === base) return true;
    if (!ev.repeat || k < base || (ev.until && k > ev.until) || (ev.skip && ev.skip.includes(k))) return false;
    const a = fromKey(base), b = fromKey(k), days = Math.round((b - a) / 86400000);
    switch (ev.repeat) {
      case 'daily': return true;
      case 'weekdays': return b.getDay() >= 1 && b.getDay() <= 5;
      case 'weekly': return days % 7 === 0;
      case 'biweekly': return days % 14 === 0;
      case 'monthly': return b.getDate() === a.getDate();
      case 'yearly': return b.getDate() === a.getDate() && b.getMonth() === a.getMonth();
      default: return false;
    }
  }
  /* every event on a day, repeating ones included: [{ ev, base }] sorted by time */
  function onDay(events, d) {
    const k = typeof d === 'string' ? d : K(d); const out = [];
    Object.entries(events).forEach(([base, list]) => list.forEach((ev) => { if (base === k ? !(ev.skip && ev.skip.includes(k)) : occurs(ev, base, k)) out.push({ ev, base }); }));
    return out.sort((x, y) => (toMin(x.ev.time) ?? -1) - (toMin(y.ev.time) ?? -1));
  }
  PatOS.calendarOn = (d) => onDay(load(), d).map((x) => x.ev);

  /* ---------- alerts: the next day and a half of alerts go to PatOS.alarms ---------- */
  function syncAlerts() {
    if (!PatOS.alarms) return;
    const events = load(), now = Date.now(), want = new Map();
    for (let i = 0; i < 3; i++) {
      const d = new Date(); d.setDate(d.getDate() + i); const k = K(d);
      onDay(events, k).forEach(({ ev }) => {
        if (!ev.time) return; const alert = ev.alert == null ? '0' : String(ev.alert); if (alert === 'none') return;
        const [hh, mm] = ev.time.split(':').map(Number); const start = new Date(d); start.setHours(hh, mm, 0, 0);
        const at = start.getTime() - (+alert) * 60000; if (at <= now || at - now > 36 * 3600000) return;
        want.set('cal:' + ev.id + ':' + k, { id: 'cal:' + ev.id + ':' + k, kind: 'notice', at, title: ev.title, body: (+alert ? T('Starts at') + ' ' + fmtT(ev.time) : T('Starting now')) + (ev.where ? ' · ' + ev.where : ''), icon: 'calendar', app: 'calendar' });
      });
    }
    const q = PatOS.store.get('alarmQueue', []) || [];
    q.filter((x) => String(x.id).startsWith('cal:') && !want.has(x.id)).forEach((x) => PatOS.alarms.cancel(x.id));
    want.forEach((item, id) => { const old = q.find((x) => x.id === id); if (!old || old.at !== item.at || old.title !== item.title) PatOS.alarms.schedule(item); });
  }
  PatOS.calendarSync = syncAlerts;
  PatOS.on('wm:ready', () => setTimeout(syncAlerts, 1500));
  setInterval(syncAlerts, 10 * 60000);

  /* ---------- .ics (iCalendar) ---------- */
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const icsUn = (s) => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  const ymd = (k) => k.replace(/-/g, '');
  function toICS(events) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PatOS//Calendar//EN', 'CALSCALE:GREGORIAN'];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const RR = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };
    Object.entries(events).forEach(([k, list]) => list.forEach((ev) => {
      L.push('BEGIN:VEVENT', 'UID:' + ev.id + '@patos', 'DTSTAMP:' + stamp, 'SUMMARY:' + icsEsc(ev.title));
      if (ev.time) {
        const t = ev.time.replace(':', '') + '00'; L.push('DTSTART:' + ymd(k) + 'T' + t);
        const e = ev.end && toMin(ev.end) > toMin(ev.time) ? ev.end : (() => { const m = toMin(ev.time) + 60; return String(Math.min(23, Math.floor(m / 60))).padStart(2, '0') + ':' + String(m >= 1440 ? 59 : m % 60).padStart(2, '0'); })();
        L.push('DTEND:' + ymd(k) + 'T' + e.replace(':', '') + '00');
      } else { const n = new Date(fromKey(k)); n.setDate(n.getDate() + 1); L.push('DTSTART;VALUE=DATE:' + ymd(k), 'DTEND;VALUE=DATE:' + ymd(K(n))); }
      if (ev.repeat && RR[ev.repeat]) L.push('RRULE:' + RR[ev.repeat] + (ev.until ? ';UNTIL=' + ymd(ev.until) + 'T235959' : ''));
      (ev.skip || []).forEach((s) => L.push(ev.time ? 'EXDATE:' + ymd(s) + 'T' + ev.time.replace(':', '') + '00' : 'EXDATE;VALUE=DATE:' + ymd(s)));
      if (ev.where) L.push('LOCATION:' + icsEsc(ev.where));
      if (ev.notes) L.push('DESCRIPTION:' + icsEsc(ev.notes));
      if (ev.time && ev.alert !== 'none') L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.title), 'TRIGGER:-PT' + (+(ev.alert || 0)) + 'M', 'END:VALARM');
      L.push('END:VEVENT');
    }));
    L.push('END:VCALENDAR');
    // lines longer than 75 characters are folded, as the format asks
    return L.map((l) => { let out = ''; while (l.length > 74) { out += l.slice(0, 74) + '\r\n '; l = l.slice(74); } return out + l; }).join('\r\n') + '\r\n';
  }
  function parseICSDate(v, params) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v || ''); if (!m) return null;
    if (!m[4] || /VALUE=DATE(?!-)/.test(params || '')) return { key: m[1] + '-' + m[2] + '-' + m[3], time: '' };
    let d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    if (m[7]) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))); // UTC → this device's time
    return { key: K(d), time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') };
  }
  function fromICS(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const out = []; let cur = null, inAlarm = false;
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') { cur = { skip: [] }; continue; }
      if (line === 'END:VEVENT') { if (cur && cur.start) out.push(cur); cur = null; continue; }
      if (!cur) continue;
      if (line === 'BEGIN:VALARM') { inAlarm = true; continue; } if (line === 'END:VALARM') { inAlarm = false; continue; }
      const i = line.indexOf(':'); if (i < 0) continue;
      const head = line.slice(0, i), val = line.slice(i + 1); const [name, ...ps] = head.split(';'); const params = ps.join(';');
      if (inAlarm) { if (name === 'TRIGGER') { const m = /-P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(val); if (m) cur.alert = String((+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))); } continue; }
      if (name === 'SUMMARY') cur.title = icsUn(val);
      else if (name === 'DESCRIPTION') cur.notes = icsUn(val).slice(0, 4000);
      else if (name === 'LOCATION') cur.where = icsUn(val);
      else if (name === 'DTSTART') cur.start = parseICSDate(val, params);
      else if (name === 'DTEND') cur.endD = parseICSDate(val, params);
      else if (name === 'UID') cur.uid = val;
      else if (name === 'EXDATE') val.split(',').forEach((x) => { const d = parseICSDate(x, params); if (d) cur.skip.push(d.key); });
      else if (name === 'RRULE') {
        const r = Object.fromEntries(val.split(';').map((p) => p.split('=')));
        const iv = +(r.INTERVAL || 1);
        cur.repeat = r.FREQ === 'DAILY' && iv === 1 ? 'daily' : r.FREQ === 'WEEKLY' && /^MO,TU,WE,TH,FR$/.test(r.BYDAY || '') ? 'weekdays' : r.FREQ === 'WEEKLY' && iv === 2 ? 'biweekly' : r.FREQ === 'WEEKLY' && iv === 1 ? 'weekly' : r.FREQ === 'MONTHLY' && iv === 1 ? 'monthly' : r.FREQ === 'YEARLY' && iv === 1 ? 'yearly' : '';
        if (r.UNTIL) { const u = parseICSDate(r.UNTIL); if (u) cur.until = u.key; }
      }
    }
    return out.map((x) => ({ key: x.start.key, ev: { id: PatOS.uid(), uid: x.uid, title: x.title || T('Event'), time: x.start.time, end: x.start.time && x.endD && x.endD.key === x.start.key ? x.endD.time : '', notes: x.notes || '', where: x.where || '', color: COLORS[4], repeat: x.repeat || '', until: x.until || '', skip: x.skip.length ? x.skip : undefined, alert: x.alert != null && x.start.time ? x.alert : 'none' } }));
  }
  PatOS.ics = { toICS, fromICS };

  PatOS.registerApp({
    id: 'calendar', name: 'Calendar', icon: 'calendar', width: 1000, height: 660, keywords: 'date events schedule agenda week day year class timetable horaire calendrier ics',
    about: 'Day, week, month and year views, repeating events with alerts, and .ics import and export.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let cursor = new Date(), selected = new Date(), mode = PatOS.store.get('calMode', 'month'), query = '';
      let events = load();
      const save = () => { PatOS.store.set('calendar', events); syncAlerts(); };
      syncAlerts();
      const title = h('div', { class: 'cal-title' });
      const seg = h('div', { class: 'seg' }, ...[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => h('button', { class: 'tab', 'data-k': k, onclick: () => { mode = k; PatOS.store.set('calMode', mode); render(); } }, T(l))));
      const bPrev = h('button', { class: 'tbtn', title: T('Previous'), 'aria-label': T('Previous') }, '‹'), bNext = h('button', { class: 'tbtn', title: T('Next'), 'aria-label': T('Next') }, '›');
      const bToday = h('button', { class: 'btn' }, T('Today')), bAdd = h('button', { class: 'tbtn', title: T('New Event'), 'aria-label': T('New Event') }, '+');
      const search = h('input', { class: 'field cal-search', placeholder: T('Search'), spellcheck: 'false', 'aria-label': T('Search events') });
      win.toolbar.append(title, h('div', { style: { flex: 1 } }), seg, search, bAdd, bPrev, bToday, bNext); win.toolbar.style.paddingLeft = '76px';
      const main = h('div', { class: 'cal-main' }), side = h('div', { class: 'cal-side' });
      win.body.appendChild(h('div', { class: 'cal-wrap' }, main, side));
      const dayEvents = (d) => onDay(events, d);
      const colorOf = (ev) => ev.color || COLORS[4];

      function render() {
        [...seg.children].forEach((b) => b.classList.toggle('on', b.dataset.k === mode));
        main.innerHTML = ''; main.className = 'cal-main cal-m-' + mode;
        if (mode === 'week') days(7); else if (mode === 'day') days(1); else if (mode === 'year') year(); else month();
        renderSide();
      }
      /* ---------- month ---------- */
      function month() {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        title.innerHTML = ''; title.append(h('b', {}, first.toLocaleDateString(LOC(), { month: 'long' })), ' ' + first.getFullYear());
        const grid = h('div', { class: 'cal-grid' });
        for (let i = 0; i < 7; i++) { const d = new Date(2024, 0, 7 + i); grid.appendChild(h('div', { class: 'cal-dn' }, d.toLocaleDateString(LOC(), { weekday: 'short' }))); }
        const start = new Date(first); start.setDate(1 - first.getDay());
        const todayK = K(new Date()), selK = K(selected);
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i); const k = K(d);
          const cell = h('div', { class: 'cal-cell' + (d.getMonth() !== first.getMonth() ? ' other' : '') + (k === selK ? ' sel' : '') },
            h('span', { class: 'cal-num' + (k === todayK ? ' today' : '') }, d.getDate() === 1 ? d.toLocaleDateString(LOC(), { month: 'short' }) + ' 1' : d.getDate()));
          const evs = dayEvents(d);
          evs.slice(0, 3).forEach(({ ev, base }) => {
            const e = h('div', { class: 'cal-ev', style: { '--c': colorOf(ev) }, draggable: ev.repeat ? 'false' : 'true', title: ev.title }, ev.time ? fmtT(ev.time) + ' ' : '', ev.title, ev.repeat ? ' ↻' : '');
            e.onclick = (x) => { x.stopPropagation(); editor(d, ev, null, base); };
            e.addEventListener('dragstart', (x) => { x.dataTransfer.setData('text/cal', ev.id + '|' + base); });
            cell.appendChild(e);
          });
          if (evs.length > 3) cell.appendChild(h('div', { class: 'cal-more' }, '+' + (evs.length - 3) + ' ' + T('more')));
          cell.onclick = () => { selected = d; render(); }; cell.ondblclick = () => { selected = d; editor(d); };
          cell.addEventListener('dragover', (x) => { if ([...x.dataTransfer.types].includes('text/cal')) { x.preventDefault(); cell.classList.add('drop'); } });
          cell.addEventListener('dragleave', () => cell.classList.remove('drop'));
          cell.addEventListener('drop', (x) => { x.preventDefault(); cell.classList.remove('drop'); const [id, base] = x.dataTransfer.getData('text/cal').split('|'); moveEvent(id, base, k); });
          grid.appendChild(cell);
        }
        main.appendChild(grid);
      }
      function moveEvent(id, from, to) {
        if (!events[from] || from === to) return; const ev = events[from].find((x) => x.id === id); if (!ev) return;
        events[from] = events[from].filter((x) => x !== ev); if (!events[from].length) delete events[from];
        (events[to] = events[to] || []).push(ev); selected = fromKey(to); save(); render();
      }
      /* ---------- day and week ---------- */
      function days(n) {
        const start = new Date(cursor); if (n === 7) start.setDate(cursor.getDate() - cursor.getDay()); start.setHours(0, 0, 0, 0);
        title.innerHTML = '';
        title.append(h('b', {}, n === 1 ? start.toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long' }) : start.toLocaleDateString(LOC(), { month: 'long' })), ' ' + start.getFullYear());
        const wrap = h('div', { class: 'cw' + (n === 1 ? ' one' : '') });
        const head = h('div', { class: 'cw-head' }, h('div', { class: 'cw-gutter' }));
        const allday = h('div', { class: 'cw-allday' }, h('div', { class: 'cw-gutter' }, T('all-day')));
        const body = h('div', { class: 'cw-body' });
        const hours = h('div', { class: 'cw-hours' });
        for (let hr = 0; hr < 24; hr++) { const d = new Date(); d.setHours(hr, 0); hours.appendChild(h('div', { class: 'cw-hr' }, hr ? d.toLocaleTimeString(LOC(), { hour: 'numeric' }) : '')); }
        body.appendChild(hours);
        const todayK = K(new Date());
        for (let i = 0; i < n; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i); const k = K(d);
          const dh = h('div', { class: 'cw-day' + (k === todayK ? ' today' : '') }, h('small', {}, d.toLocaleDateString(LOC(), { weekday: 'short' })), h('b', {}, d.getDate()));
          dh.onclick = () => { cursor = new Date(d); selected = new Date(d); mode = 'day'; PatOS.store.set('calMode', mode); render(); };
          head.appendChild(dh);
          const ad = h('div', { class: 'cw-adcell' }); allday.appendChild(ad);
          const col = h('div', { class: 'cw-col' + (k === todayK ? ' today' : '') });
          col.addEventListener('dblclick', (e) => { const r = col.getBoundingClientRect(); const mins = Math.min(1410, Math.round((e.clientY - r.top) / r.height * 1440 / 30) * 30); editor(d, null, String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0')); });
          // events that overlap share the width of the day
          const timed = dayEvents(d).filter(({ ev }) => toMin(ev.time) != null).map((x) => { const s = toMin(x.ev.time); const e2 = toMin(x.ev.end); return Object.assign(x, { s, e: Math.max(s + 30, e2 != null && e2 > s ? e2 : s + 60) }); });
          const lanes = []; timed.forEach((x) => { let l = lanes.findIndex((end) => end <= x.s); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = x.e; x.lane = l; });
          dayEvents(d).forEach((x) => {
            const { ev, base } = x;
            const el = h('div', { class: 'cw-ev', style: { '--c': colorOf(ev) } }, h('b', {}, ev.title + (ev.repeat ? ' ↻' : '')), toMin(ev.time) != null ? h('small', {}, fmtT(ev.time) + (ev.end ? ' – ' + fmtT(ev.end) : '') + (ev.where ? ' · ' + ev.where : '')) : null);
            el.onclick = (z) => { z.stopPropagation(); editor(d, ev, null, base); };
            if (toMin(ev.time) == null) { ad.appendChild(el); return; }
            const t = timed.find((y) => y.ev === ev); const n2 = Math.max(1, lanes.length);
            el.style.top = (t.s / 1440 * 100) + '%'; el.style.height = ((t.e - t.s) / 1440 * 100) + '%';
            el.style.left = (t.lane / n2 * 100) + '%'; el.style.width = 'calc(' + (100 / n2) + '% - 3px)'; el.style.right = 'auto';
            col.appendChild(el);
          });
          if (k === todayK) { const now = new Date(); col.appendChild(h('div', { class: 'cw-now', style: { top: ((now.getHours() * 60 + now.getMinutes()) / 1440 * 100) + '%' } })); }
          body.appendChild(col);
        }
        wrap.append(head, allday, h('div', { class: 'cw-scroll' }, body));
        main.appendChild(wrap);
        setTimeout(() => { const sc = wrap.querySelector('.cw-scroll'); if (sc) sc.scrollTop = sc.scrollHeight * (7.5 / 24); }, 0);
      }
      /* ---------- year ---------- */
      function year() {
        const y = cursor.getFullYear(); title.innerHTML = ''; title.append(h('b', {}, String(y)));
        const grid = h('div', { class: 'cal-year' }); const todayK = K(new Date());
        // which days have something (one pass over the year)
        const busy = new Set(); for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) if (dayEvents(d).length) busy.add(K(d));
        for (let m = 0; m < 12; m++) {
          const first = new Date(y, m, 1); const box = h('div', { class: 'cy-m' });
          const name = h('button', { class: 'cy-name' }, first.toLocaleDateString(LOC(), { month: 'long' })); name.onclick = () => { cursor = first; mode = 'month'; PatOS.store.set('calMode', mode); render(); };
          const g = h('div', { class: 'cy-g' });
          for (let i = 0; i < 7; i++) g.appendChild(h('span', { class: 'cy-dn' }, new Date(2024, 0, 7 + i).toLocaleDateString(LOC(), { weekday: 'narrow' })));
          for (let i = 0; i < first.getDay(); i++) g.appendChild(h('span'));
          for (let dd = 1; dd <= new Date(y, m + 1, 0).getDate(); dd++) {
            const d = new Date(y, m, dd), k = K(d);
            const b = h('button', { class: 'cy-d' + (k === todayK ? ' today' : '') + (busy.has(k) ? ' busy' : '') }, dd);
            b.onclick = () => { cursor = new Date(d); selected = new Date(d); mode = 'day'; PatOS.store.set('calMode', mode); render(); };
            g.appendChild(b);
          }
          box.append(name, g); grid.appendChild(box);
        }
        main.appendChild(grid);
      }
      /* ---------- side panel: the selected day, search results, coming up, quick add ---------- */
      function renderSide() {
        side.innerHTML = '';
        if (query.trim()) {
          const q = query.trim().toLowerCase(); const hits = [];
          Object.entries(events).forEach(([k, l]) => l.forEach((ev) => { if ((ev.title + ' ' + (ev.notes || '') + ' ' + (ev.where || '')).toLowerCase().includes(q)) hits.push({ k, ev }); }));
          hits.sort((a, b) => a.k.localeCompare(b.k));
          side.appendChild(h('div', { class: 'cal-upt' }, hits.length + ' ' + T(hits.length === 1 ? 'result' : 'results')));
          hits.slice(0, 80).forEach(({ k, ev }) => side.appendChild(h('div', { class: 'cal-up', style: { '--c': colorOf(ev) }, onclick: () => { selected = fromKey(k); cursor = fromKey(k); if (mode === 'year') mode = 'month'; render(); } }, h('b', {}, ev.title + (ev.repeat ? ' ↻' : '')), h('small', {}, fromKey(k).toLocaleDateString(LOC(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + (ev.time ? ' · ' + fmtT(ev.time) : '')))));
          return;
        }
        side.append(h('div', { class: 'cal-sd' }, selected.toLocaleDateString(LOC(), { weekday: 'long' })), h('div', { class: 'cal-sdn' }, selected.toLocaleDateString(LOC(), { month: 'long', day: 'numeric', year: 'numeric' })));
        const list = dayEvents(selected);
        if (!list.length) side.appendChild(h('div', { class: 'cal-none' }, T(PatOS.isMobile ? 'Nothing planned. Type below, or tap New Event.' : 'Nothing planned. Double-click a day, or type below.')));
        list.forEach(({ ev, base }) => {
          const el = h('div', { class: 'cal-item', style: { '--c': colorOf(ev) } }, h('b', {}, ev.title + (ev.repeat ? ' ↻' : '')), h('small', {}, (ev.time ? fmtT(ev.time) + (ev.end ? ' – ' + fmtT(ev.end) : '') : T('All day')) + (ev.where ? ' · ' + ev.where : '')), ev.notes ? h('div', { class: 'cal-notes' }, ev.notes) : null);
          el.onclick = () => editor(selected, ev, null, base); side.appendChild(el);
        });
        const up = []; for (let i = 1; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); dayEvents(d).forEach(({ ev }) => up.push({ d, ev })); }
        if (up.length) { side.appendChild(h('div', { class: 'cal-upt' }, T('Coming up'))); up.slice(0, 6).forEach(({ d, ev }) => side.appendChild(h('div', { class: 'cal-up', style: { '--c': colorOf(ev) }, onclick: () => { selected = d; cursor = new Date(d); render(); } }, h('b', {}, ev.title), h('small', {}, d.toLocaleDateString(LOC(), { weekday: 'short', month: 'short', day: 'numeric' }) + (ev.time ? ' · ' + fmtT(ev.time) : ''))))); }
        // quick add in plain words
        const qa = h('input', { class: 'field cal-quick', placeholder: T('Quick add: “Math class monday 9am weekly”'), spellcheck: 'false' });
        const hint = h('div', { class: 'cal-qhint' });
        const parse = () => quickParse(qa.value);
        qa.addEventListener('input', () => { const p = parse(); hint.textContent = qa.value.trim() ? fromKey(p.key).toLocaleDateString(LOC(), { weekday: 'short', month: 'short', day: 'numeric' }) + (p.time ? ' · ' + fmtT(p.time) : ' · ' + T('All day')) + (p.repeat ? ' · ' + T((REPEATS.find((r) => r[0] === p.repeat) || [])[1] || '') : '') : ''; });
        qa.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' || !qa.value.trim()) return; const p = parse();
          const ev = { id: PatOS.uid(), title: p.text, time: p.time || '', end: p.time ? addMin(p.time, 60) : '', color: COLORS[4], notes: '', repeat: p.repeat || '', alert: p.time ? '0' : 'none' };
          (events[p.key] = events[p.key] || []).push(ev); if (p.time) PatOS.alarms && PatOS.alarms.askPermission();
          selected = fromKey(p.key); cursor = fromKey(p.key); save(); render();
          PatOS.office && PatOS.office.toast && PatOS.office.toast(win, T('Added') + ': ' + ev.title);
        });
        side.append(h('div', { class: 'cal-qa' }, qa, hint), h('button', { class: 'btn primary cal-addbtn', onclick: () => editor(selected) }, '+ ' + T('New Event')));
      }
      const addMin = (t, n) => { const m = Math.min(1439, toMin(t) + n); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
      function quickParse(raw) {
        let s = ' ' + raw + ' ', repeat = '';
        const rep = [[/\s(every day|daily|chaque jour|tous les jours)(?=\s)/i, 'daily'], [/\s(every weekday|weekdays|en semaine)(?=\s)/i, 'weekdays'], [/\s(every 2 weeks|every other week|biweekly|toutes les deux semaines|aux deux semaines)(?=\s)/i, 'biweekly'], [/\s(every week|weekly|chaque semaine|toutes les semaines)(?=\s)/i, 'weekly'], [/\s(every month|monthly|chaque mois|tous les mois)(?=\s)/i, 'monthly'], [/\s(every year|yearly|annually|chaque année|tous les ans)(?=\s)/i, 'yearly']];
        for (const [re, v] of rep) if (re.test(s)) { s = s.replace(re, ' '); repeat = v; break; }
        // "every monday" / "tous les lundis" = weekly on monday
        s = s.replace(/\s(every|chaque|tous les)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundis?|mardis?|mercredis?|jeudis?|vendredis?|samedis?|dimanches?)(?=\s)/i, (m, a, d) => { repeat = repeat || 'weekly'; return ' ' + d.replace(/s$/i, '') + ' '; });
        const p = PatOS.parseReminder ? PatOS.parseReminder(s.trim(), null) : { text: s.trim() };
        return { text: p.text || raw.trim(), key: p.due || K(selected), time: p.time || '', repeat };
      }
      PatOS.calendarQuick = quickParse;

      /* ---------- the event editor ---------- */
      function editor(day, ev, time, base) {
        const isNew = !ev; const e = ev ? Object.assign({}, ev) : { id: PatOS.uid(), title: '', time: time || '', end: time ? addMin(time, 60) : '', color: COLORS[4], notes: '', where: '', repeat: '', alert: '0' };
        const series = !!(ev && ev.repeat);
        const occKey = K(day), startKey = base || occKey;
        const fTitle = h('input', { class: 'field', value: e.title, placeholder: T('Title') });
        const fWhere = h('input', { class: 'field', value: e.where || '', placeholder: T('Location') });
        const fDate = h('input', { class: 'field', type: 'date', value: series ? startKey : occKey });
        const fAll = h('input', { type: 'checkbox', checked: !e.time });
        const fStart = h('input', { class: 'field', type: 'time', value: e.time || '09:00' }), fEnd = h('input', { class: 'field', type: 'time', value: e.end || '' });
        fStart.addEventListener('change', () => { if (!fEnd.value || toMin(fEnd.value) <= toMin(fStart.value)) fEnd.value = addMin(fStart.value, 60); });
        const times = h('div', { class: 'ce-times' }, fStart, h('span', {}, '–'), fEnd);
        const fRep = h('select', { class: 'field' }, ...REPEATS.map(([v, l]) => h('option', { value: v, selected: (e.repeat || '') === v }, T(l))));
        const fUntil = h('input', { class: 'field', type: 'date', value: e.until || '', title: T('Ends on') });
        const untilRow = h('label', { class: 'ce-row' }, h('span', {}, T('Ends on')), fUntil);
        const fAlert = h('select', { class: 'field' }, ...ALERTS.map(([v, l]) => h('option', { value: v, selected: String(e.alert == null ? '0' : e.alert) === v }, T(l))));
        const alertRow = h('label', { class: 'ce-row' }, h('span', {}, T('Alert')), fAlert);
        const sync = () => { times.style.display = fAll.checked ? 'none' : ''; alertRow.style.display = fAll.checked ? 'none' : ''; untilRow.style.display = fRep.value ? '' : 'none'; };
        fAll.onchange = sync; fRep.onchange = sync; sync();
        const fNotes = h('textarea', { class: 'field ce-notes', placeholder: T('Notes') }); fNotes.value = e.notes || '';
        const colors = h('div', { class: 'ce-colors' }, ...COLORS.map((c) => { const b = h('button', { class: 'ce-c' + (e.color === c ? ' on' : ''), style: { background: c }, 'aria-label': T('Color') }); b.onclick = () => { e.color = c; colors.querySelectorAll('.ce-c').forEach((x) => x.classList.toggle('on', x === b)); }; return b; }));
        const layer = h('div', { class: 'dlg-layer' });
        const close = () => layer.remove();
        const removeEverywhere = (id) => Object.keys(events).forEach((k) => { events[k] = events[k].filter((x) => x.id !== id); if (!events[k].length) delete events[k]; });
        const commit = () => {
          e.title = fTitle.value.trim() || T('New Event'); e.where = fWhere.value.trim(); e.time = fAll.checked ? '' : fStart.value; e.end = fAll.checked ? '' : fEnd.value; e.notes = fNotes.value.trim();
          e.repeat = fRep.value; e.until = fRep.value ? fUntil.value : ''; e.alert = fAll.checked ? 'none' : fAlert.value;
          if (!e.repeat) delete e.skip;
          const k = fDate.value || startKey;
          removeEverywhere(e.id); (events[k] = events[k] || []).push(e);
          if (e.time && e.alert !== 'none') PatOS.alarms && PatOS.alarms.askPermission();
          save(); selected = series ? fromKey(occKey) : fromKey(k); close(); render();
        };
        const del = async () => {
          if (series && occKey !== startKey) {
            // a repeating event: this day only, or the whole series
            const one = await new Promise((res) => {
              const l2 = h('div', { class: 'dlg-layer' }); const done = (v) => { l2.remove(); res(v); };
              l2.appendChild(h('div', { class: 'dlg' }, h('div', { class: 'dlg-ic', html: PatOS.iconHTML('calendar') }), h('b', {}, T('Delete this repeating event?')), h('p', {}, T('Delete only this day, or every time it happens.')),
                h('div', { class: 'dlg-btns col' }, h('button', { class: 'btn danger', onclick: () => done('one') }, T('Only This Day')), h('button', { class: 'btn danger', onclick: () => done('all') }, T('All Events')), h('button', { class: 'btn', onclick: () => done(null) }, T('Cancel')))));
              l2.addEventListener('keydown', (x) => { if (x.key === 'Escape') done(null); });
              document.body.appendChild(l2); setTimeout(() => l2.querySelector('.btn:last-child').focus(), 30);
            });
            if (!one) return;
            if (one === 'one') { const orig = events[startKey].find((x) => x.id === e.id); orig.skip = (orig.skip || []).concat(occKey); save(); close(); render(); return; }
          }
          removeEverywhere(e.id); save(); close(); render();
        };
        fTitle.addEventListener('keydown', (k) => { if (k.key === 'Enter') commit(); });
        layer.appendChild(h('div', { class: 'dlg ce cal-ed' }, h('b', {}, T(isNew ? 'New Event' : 'Edit Event')), fTitle, fWhere,
          h('label', { class: 'ce-row' }, h('span', {}, T(series ? 'Starts on' : 'Date')), fDate), h('label', { class: 'ce-row' }, h('span', {}, T('All day')), fAll), times,
          h('label', { class: 'ce-row' }, h('span', {}, T('Repeat')), fRep), untilRow, alertRow, colors, fNotes,
          h('div', { class: 'dlg-btns' }, !isNew ? h('button', { class: 'btn danger', onclick: del }, T('Delete')) : null, h('div', { style: { flex: 1 } }), h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: commit }, T(isNew ? 'Add' : 'Done')))));
        layer.addEventListener('pointerdown', (x) => { if (x.target === layer) close(); });
        layer.addEventListener('keydown', (x) => { if (x.key === 'Escape') close(); });
        document.body.appendChild(layer); setTimeout(() => fTitle.focus(), 30);
      }

      /* ---------- import and export ---------- */
      function importICS() {
        const input = h('input', { type: 'file', accept: '.ics,text/calendar' }); input.style.display = 'none'; document.body.appendChild(input);
        input.onchange = async () => { const f = input.files[0]; input.remove(); if (f) importText(await f.text()); };
        input.click();
      }
      function importText(text) {
        {
          let list = []; try { list = fromICS(text); } catch (err) { list = []; }
          const known = new Set(); Object.values(events).forEach((l) => l.forEach((x) => x.uid && known.add(x.uid)));
          let n = 0; list.forEach(({ key, ev }) => { if (ev.uid && known.has(ev.uid)) return; (events[key] = events[key] || []).push(ev); n++; });
          save(); render();
          PatOS.notify({ title: T('Calendar imported'), body: n + ' ' + T(n === 1 ? 'event added' : 'events added') + (list.length - n ? ' · ' + (list.length - n) + ' ' + T('already there') : ''), icon: 'calendar' });
          if (list[0]) { selected = fromKey(list[0].key); cursor = fromKey(list[0].key); render(); }
        }
      }
      const importPath = (p) => { const t = PatOS.fs.read(p); if (t != null) importText(String(t).startsWith('data:') ? new TextDecoder().decode(Uint8Array.from(atob(String(t).split(',')[1] || ''), (c) => c.charCodeAt(0))) : t); };
      const exportICS = () => PatOS.downloadFile('PatOS Calendar.ics', 'data:text/calendar;charset=utf-8,' + encodeURIComponent(toICS(events)));

      const shift = (dir) => {
        if (mode === 'week') cursor.setDate(cursor.getDate() + 7 * dir);
        else if (mode === 'day') { cursor.setDate(cursor.getDate() + dir); selected = new Date(cursor); }
        else if (mode === 'year') cursor = new Date(cursor.getFullYear() + dir, 0, 1);
        else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
        render();
      };
      bPrev.onclick = () => shift(-1); bNext.onclick = () => shift(1);
      bToday.onclick = () => { cursor = new Date(); selected = new Date(); render(); };
      bAdd.onclick = () => editor(selected);
      search.addEventListener('input', () => { query = search.value; renderSide(); });
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => {
        if (e.target !== win.body) return;
        if (e.key === 'ArrowLeft') shift(-1); if (e.key === 'ArrowRight') shift(1); if (e.key === 't') bToday.click(); if (e.key === 'n') editor(selected);
        const m = { d: 'day', w: 'week', m: 'month', y: 'year' }[e.key]; if (m) { mode = m; PatOS.store.set('calMode', mode); render(); }
      });
      const off = PatOS.on('calendar', () => { events = load(); render(); }); win.on('closed', off);
      win._cal = { importICS, exportICS, importPath, go: (k) => { selected = fromKey(k); cursor = fromKey(k); render(); } };
      if (args.date) { selected = fromKey(args.date); cursor = fromKey(args.date); }
      render();
      if (args.ics) setTimeout(() => importPath(args.ics), 50);
    },
    onArgs(win, args) { if (args.date && win._cal) win._cal.go(args.date); if (args.ics && win._cal) win._cal.importPath(args.ics); },
    menus(win) {
      const C = win._cal || {};
      return { file: [
        { label: T('New Event'), shortcut: 'N', action: () => win.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })) },
        { divider: true },
        { label: T('Import a Calendar (.ics)…'), action: () => C.importICS && C.importICS() },
        { label: T('Export Calendar (.ics)'), action: () => C.exportICS && C.exportICS() },
        { divider: true },
        { label: T('Close Window'), shortcut: 'Alt+W', action: () => win.close() }
      ] };
    }
  });
})();
