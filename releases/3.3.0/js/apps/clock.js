/* Clock — world clock, alarms, stopwatch and timer.
   - World Clock: add any city (every time zone the browser knows), remove them, half-hour zones shown right
   - Alarms: edit by clicking, says when the next one rings; PatOS.alarms rings them (see js/alarms.js)
   - Stopwatch: keeps running when Clock is closed or PatOS reloads; fastest and slowest laps marked
   - Timer: hours, minutes and seconds, an optional name, keeps going in the background */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const DEFAULT_CITIES = [null, 'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney', 'America/New_York'];
  // some browsers still use older zone names; show the city's current name
  const NAMES = { 'America/Toronto': 'Montréal', 'America/Montreal': 'Montréal', 'Asia/Calcutta': 'Kolkata', 'Asia/Saigon': 'Ho Chi Minh City', 'Asia/Katmandu': 'Kathmandu', 'Asia/Rangoon': 'Yangon', 'Europe/Kiev': 'Kyiv', 'America/Godthab': 'Nuuk', 'Atlantic/Faeroe': 'Faroe Islands', 'Asia/Ulan_Bator': 'Ulaanbaatar', 'Pacific/Truk': 'Chuuk', 'Pacific/Ponape': 'Pohnpei', 'America/Buenos_Aires': 'Buenos Aires', 'Asia/Dacca': 'Dhaka', 'Asia/Thimbu': 'Thimphu' };
  const cityName = (tz) => (tz ? NAMES[tz] || tz.split('/').pop().replace(/_/g, ' ') : T('Here'));
  const regionOf = (tz) => (tz ? tz.split('/')[0].replace(/_/g, ' ') : '');
  const inTZ = (tz) => (tz ? new Date(new Date().toLocaleString('en-US', { timeZone: tz })) : new Date());
  const allZones = () => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return DEFAULT_CITIES.filter(Boolean).concat(['Asia/Kolkata', 'Asia/Shanghai', 'Europe/Berlin', 'America/Los_Angeles', 'America/Mexico_City', 'America/Sao_Paulo', 'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai', 'Pacific/Auckland']); } };
  const two = (n) => String(n).padStart(2, '0');
  // stopwatch: 00:00.00 ; timer: 0:00 / 1:00:00
  const fmtSW = (ms) => { const hh = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100; return (hh ? hh + ':' + two(m) : two(m)) + ':' + two(s) + '.' + two(c); };
  const fmtT = (ms) => { const t = Math.ceil(ms / 1000), hh = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return hh ? hh + ':' + two(m) + ':' + two(s) : two(m) + ':' + two(s); };
  const fmtLong = (ms) => { const t = Math.round(ms / 1000), hh = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return [hh ? hh + ' h' : '', m ? m + ' min' : '', s && !hh ? s + ' s' : ''].filter(Boolean).join(' ') || '0 s'; };
  // "5", "1:30", "1:30:00", "90s", "1h", "1h 20m" → milliseconds
  function parseDuration(v) {
    v = String(v || '').trim().toLowerCase().replace(',', '.'); if (!v) return 0;
    let m;
    if ((m = v.match(/^(\d+):(\d{1,2}):(\d{1,2})$/))) return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000;
    if ((m = v.match(/^(\d+):(\d{1,2})$/))) return (+m[1] * 60 + +m[2]) * 1000; // m:ss
    if (/^\d+(\.\d+)?$/.test(v)) return Math.round(+v * 60000); // plain number = minutes
    let ms = 0, any = false;
    v.replace(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|heures?|m|min|mins|minutes?|s|sec|secs|seconds?|secondes?)/g, (_, n, u) => { any = true; ms += +n * (u[0] === 'h' ? 3600000 : u[0] === 's' ? 1000 : 60000); return ''; });
    return any ? Math.round(ms) : 0;
  }
  PatOS.parseDuration = parseDuration;

  /* the timer is saved, so it keeps going when Clock is closed or PatOS reloads; PatOS.alarms rings it */
  const TM = 'clockTimer';
  const tmState = () => Object.assign({ running: false, end: 0, left: 5 * 60000, total: 5 * 60000, label: '' }, PatOS.store.get(TM, null) || {});
  const tmSave = (tm) => PatOS.store.set(TM, tm);
  PatOS.on('alarm:fire', (x) => { if (x.id === 'clock-timer') { const tm = tmState(); tm.running = false; tm.left = tm.total; tmSave(tm); PatOS.emit('clock:timer'); } });
  /* the stopwatch is saved too */
  const SW = 'clockStopwatch';
  const swState = () => Object.assign({ running: false, start: 0, acc: 0, laps: [] }, PatOS.store.get(SW, null) || {});
  const swSave = (s) => PatOS.store.set(SW, s);
  const REPEATS = [['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['once', 'Once']];
  const repeatOK = (rep, d) => { const wd = d.getDay(); return rep === 'weekdays' ? wd >= 1 && wd <= 5 : rep === 'weekends' ? wd === 0 || wd === 6 : true; };
  function nextRing(a, from) {
    const [hh, mm] = a.time.split(':').map(Number); const d = new Date(from); d.setSeconds(0, 0); d.setHours(hh, mm);
    for (let i = 0; i < 8; i++) { if (d > from && repeatOK(a.repeat || 'daily', d)) return d; d.setDate(d.getDate() + 1); d.setHours(hh, mm); }
    return null;
  }

  PatOS.registerApp({
    id: 'clock', name: 'Clock', icon: 'clock', width: 760, height: 540, dark: true, category: 'Utilities', keywords: 'time stopwatch timer alarm world horloge minuteur chronomètre réveil',
    about: 'World clocks, alarms, a stopwatch and a timer.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const tabs = ['World Clock', 'Alarms', 'Stopwatch', 'Timer'];
      let tab = typeof args.tab === 'number' ? args.tab : PatOS.store.get('clockTab', 0);
      const seg = h('div', { class: 'seg' });
      tabs.forEach((t, i) => seg.appendChild(h('button', { class: 'tab', onclick: () => { tab = i; PatOS.store.set('clockTab', i); render(); } }, T(t))));
      win.toolbar.style.justifyContent = 'center'; win.toolbar.append(seg);
      const body = h('div', { class: 'clk' }); win.body.appendChild(body);
      let timers = [], cleanups = [];
      const clearTimers = () => { timers.forEach(clearInterval); timers = []; cleanups.forEach((f) => f()); cleanups = []; };
      const onKey = (fn) => { const k = (e) => { if (PatOS.wm.active !== win || e.altKey || e.ctrlKey || e.metaKey || (e.target && e.target.closest && e.target.closest('input, textarea, select, button, [contenteditable]'))) return; fn(e); }; document.addEventListener('keydown', k); cleanups.push(() => document.removeEventListener('keydown', k)); };

      function render() {
        clearTimers(); body.innerHTML = ''; body.className = 'clk clk-tab' + tab;
        [...seg.children].forEach((b, i) => b.classList.toggle('on', i === tab));
        if (tab === 0) world(); else if (tab === 1) alarms(); else if (tab === 2) stopwatch(); else timer();
      }

      /* ---------- world clock ---------- */
      function world() {
        let cities = PatOS.store.get('clockCities', null) || DEFAULT_CITIES.slice();
        const save = () => PatOS.store.set('clockCities', cities);
        const g = h('div', { class: 'clk-world' });
        const top = h('div', { class: 'clk-wtop' }, h('button', { class: 'btn', onclick: () => addCity() }, '+ ' + T('Add a City')));
        let items = [];
        const draw = () => {
          g.innerHTML = '';
          items = cities.map((tz) => {
            const c = h('canvas', { width: 130, height: 130 });
            const t = h('div', { class: 'clk-t' }); const sub = h('div', { class: 'clk-sub' });
            const x = tz ? h('button', { class: 'clk-cx', title: T('Remove'), 'aria-label': T('Remove') + ' ' + cityName(tz), onclick: () => { cities = cities.filter((z) => z !== tz); save(); draw(); tick(); } }, '×') : null;
            g.appendChild(h('div', { class: 'clk-city', title: tz || '' }, x, c, h('b', {}, cityName(tz)), t, sub));
            return { c, t, sub, tz };
          });
        };
        const tick = () => {
          const local = new Date();
          items.forEach((it) => {
            const d = inTZ(it.tz); PatOS.drawAnalog(it.c, d);
            it.t.textContent = d.toLocaleTimeString(PatOS.lang === 'fr' ? 'fr-CA' : undefined, { hour: 'numeric', minute: '2-digit' });
            if (!it.tz) { it.sub.textContent = T('Your time'); return; }
            const mins = Math.round((d - local) / 900000) * 15; // time zones move in quarter hours
            const day = d.getDate() !== local.getDate() ? (d > local ? T('Tomorrow') : T('Yesterday')) : T('Today');
            const off = mins === 0 ? T('Same time') : (mins > 0 ? '+' : '−') + Math.floor(Math.abs(mins) / 60) + (Math.abs(mins) % 60 ? ':' + two(Math.abs(mins) % 60) : '') + ' h';
            it.sub.textContent = day + ', ' + off;
          });
        };
        function addCity() {
          const layer = h('div', { class: 'clk-pick' });
          const q = h('input', { class: 'field', placeholder: T('Search for a city or region'), spellcheck: 'false' });
          const list = h('div', { class: 'clk-plist' });
          const zones = allZones().filter((z) => z.includes('/') && !/^(Etc|SystemV|US|Canada)\//.test(z));
          const fill = () => {
            const s = q.value.trim().toLowerCase().replace(/\s+/g, '_'); list.innerHTML = '';
            zones.filter((z) => !s || z.toLowerCase().includes(s) || cityName(z).toLowerCase().includes(s.replace(/_/g, ' '))).slice(0, 80).forEach((z) => {
              const have = cities.includes(z);
              list.appendChild(h('button', { class: 'clk-prow' + (have ? ' have' : ''), onclick: () => { if (!have) { cities.push(z); save(); } layer.remove(); draw(); tick(); } }, h('b', {}, cityName(z)), h('small', {}, regionOf(z) + ' · ' + inTZ(z).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))));
            });
            if (!list.children.length) list.appendChild(h('div', { class: 'clk-sub', style: { padding: '16px' } }, T('No results')));
          };
          q.addEventListener('input', fill); q.addEventListener('keydown', (e) => { if (e.key === 'Escape') layer.remove(); if (e.key === 'Enter') { const b = list.querySelector('.clk-prow:not(.have)'); if (b) b.click(); } });
          layer.append(h('div', { class: 'clk-pcard' }, h('div', { class: 'clk-phead' }, h('b', {}, T('Add a City')), h('button', { class: 'btn', onclick: () => layer.remove() }, T('Cancel'))), q, list));
          layer.addEventListener('pointerdown', (e) => { if (e.target === layer) layer.remove(); });
          body.appendChild(layer); fill(); setTimeout(() => q.focus(), 30);
        }
        body.append(top, g); draw(); tick(); timers.push(setInterval(tick, 1000));
      }

      /* ---------- alarms ---------- */
      function alarms() {
        const list = PatOS.store.get('alarms', []);
        const save = () => PatOS.store.set('alarms', list);
        const wrap = h('div', { class: 'clk-alarms' });
        const next = h('div', { class: 'clk-next' });
        let editing = null;
        const tIn = h('input', { type: 'time', class: 'field', value: '07:00', 'aria-label': T('Time') });
        const lIn = h('input', { class: 'field', placeholder: T('Label'), style: { width: '150px' } });
        const rIn = h('select', { class: 'field', 'aria-label': T('Repeat') }, ...REPEATS.map(([v, l]) => h('option', { value: v }, T(l))));
        const add = h('button', { class: 'btn primary' });
        const cancelEdit = h('button', { class: 'btn', onclick: () => { editing = null; resetForm(); } }, T('Cancel'));
        const resetForm = () => { add.textContent = T(editing ? 'Save' : 'Add Alarm'); cancelEdit.style.display = editing ? '' : 'none'; if (!editing) { lIn.value = ''; } };
        add.onclick = () => {
          if (!tIn.value) return; PatOS.alarms.askPermission();
          if (editing) Object.assign(editing, { time: tIn.value, label: lIn.value.trim(), repeat: rIn.value, on: true });
          else list.push({ id: PatOS.uid(), time: tIn.value, label: lIn.value.trim(), repeat: rIn.value, on: true });
          editing = null; save(); resetForm(); draw();
        };
        const draw = () => {
          wrap.innerHTML = '';
          if (!list.length) wrap.appendChild(h('div', { class: 'clk-sub', style: { padding: '30px', textAlign: 'center' } }, T('No alarms yet. Alarms ring while PatOS is open, even in the background.')));
          list.sort((a, b) => a.time.localeCompare(b.time)).forEach((a) => {
            const sw = h('button', { class: 'switch' + (a.on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!a.on), 'aria-label': T('Alarm') + ' ' + a.time }); sw.onclick = (e) => { e.stopPropagation(); a.on = !a.on; save(); draw(); };
            const [hh, mm] = a.time.split(':').map(Number); const d = new Date(); d.setHours(hh, mm, 0, 0);
            const row = h('div', { class: 'clk-alarm' + (a.on ? '' : ' off') + (editing === a ? ' editing' : ''), title: T('Click to change') },
              h('div', {}, h('div', { class: 'clk-at' }, d.toLocaleTimeString(PatOS.lang === 'fr' ? 'fr-CA' : undefined, { hour: 'numeric', minute: '2-digit' })), h('small', {}, (a.label || T('Alarm')) + ' · ' + T((REPEATS.find((r) => r[0] === (a.repeat || 'daily')) || REPEATS[0])[1]))),
              h('div', { style: { flex: 1 } }),
              h('button', { class: 'tbtn clk-del', title: T('Delete'), 'aria-label': T('Delete'), html: '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>', onclick: (e) => { e.stopPropagation(); list.splice(list.indexOf(a), 1); if (editing === a) { editing = null; resetForm(); } save(); draw(); } }), sw);
            row.onclick = () => { editing = a; tIn.value = a.time; lIn.value = a.label || ''; rIn.value = a.repeat || 'daily'; resetForm(); draw(); tIn.focus(); };
            wrap.appendChild(row);
          });
          showNext();
        };
        const showNext = () => {
          const now = new Date(); const up = list.filter((a) => a.on).map((a) => nextRing(a, now)).filter(Boolean).sort((x, y) => x - y)[0];
          next.textContent = up ? T('Next alarm in') + ' ' + fmtLong(Math.ceil((up - now) / 60000) * 60000) : '';
        };
        body.append(next, h('div', { class: 'clk-addalarm' }, tIn, lIn, rIn, cancelEdit, add), wrap);
        const onAl = () => { const fresh = PatOS.store.get('alarms', []); list.splice(0, list.length, ...fresh); draw(); };
        PatOS.on('alarms', onAl); cleanups.push(() => PatOS.off('alarms', onAl));
        resetForm(); draw(); timers.push(setInterval(showNext, 20000));
      }

      /* ---------- stopwatch ---------- */
      function stopwatch() {
        const disp = h('div', { class: 'clk-big' });
        const bL = h('button', { class: 'clk-btn gray' }); const bS = h('button', { class: 'clk-btn' });
        const laps = h('div', { class: 'clk-laps' });
        const hint = h('div', { class: 'clk-sub clk-keys' }, T('Space: start or stop · L: lap'));
        const now = (s) => s.acc + (s.running ? Date.now() - s.start : 0);
        const upd = () => {
          const s = swState(), n = now(s);
          disp.textContent = fmtSW(n);
          bS.textContent = T(s.running ? 'Stop' : n ? 'Resume' : 'Start'); bS.className = 'clk-btn ' + (s.running ? 'red' : 'green');
          bL.textContent = T(s.running || !n ? 'Lap' : 'Reset'); bL.disabled = !s.running && !n;
          const cur = laps.querySelector('.clk-lap.cur span:last-child'); if (cur) cur.textContent = fmtSW(n - s.laps.reduce((a, b) => a + b, 0));
        };
        const drawLaps = () => {
          const s = swState(); laps.innerHTML = '';
          const n = now(s);
          if (s.running || (n && s.laps.length)) laps.appendChild(h('div', { class: 'clk-lap cur' }, h('span', {}, T('Lap') + ' ' + (s.laps.length + 1)), h('span', {}, fmtSW(n - s.laps.reduce((a, b) => a + b, 0)))));
          const best = s.laps.length >= 2 ? Math.min(...s.laps) : -1, worst = s.laps.length >= 2 ? Math.max(...s.laps) : -1;
          s.laps.map((l, i) => [l, i]).reverse().forEach(([l, i]) => laps.appendChild(h('div', { class: 'clk-lap' + (l === best ? ' best' : l === worst ? ' worst' : '') }, h('span', {}, T('Lap') + ' ' + (i + 1)), h('span', {}, fmtSW(l)))));
        };
        const toggle = () => { const s = swState(); if (s.running) { s.acc = now(s); s.running = false; } else { s.start = Date.now(); s.running = true; } swSave(s); upd(); drawLaps(); };
        const lap = () => { const s = swState(); if (s.running) { const t = now(s); s.laps.push(t - s.laps.reduce((a, b) => a + b, 0)); } else { s.acc = 0; s.laps = []; } swSave(s); drawLaps(); upd(); };
        bS.onclick = toggle; bL.onclick = lap;
        onKey((e) => { if (e.key === ' ') { e.preventDefault(); toggle(); } else if (e.key.toLowerCase() === 'l' || e.key === 'Enter') { e.preventDefault(); if (swState().running) lap(); } else if (e.key.toLowerCase() === 'r' && !swState().running) lap(); });
        body.append(disp, h('div', { class: 'clk-row' }, bL, bS), laps, hint);
        upd(); drawLaps(); timers.push(setInterval(upd, 31));
      }

      /* ---------- timer ---------- */
      function timer() {
        const ring = h('canvas', { width: 520, height: 520, class: 'clk-ring' });
        const disp = h('div', { class: 'clk-tdisp' });
        const name = h('div', { class: 'clk-tname' });
        const ends = h('div', { class: 'clk-tends' });
        const presets = h('div', { class: 'clk-presets' });
        const set = (ms) => { const tm = tmState(); if (tm.running || !(ms > 0)) return; tm.left = tm.total = Math.min(ms, 24 * 3600000); tmSave(tm); upd(); };
        [1, 3, 5, 10, 15, 25, 45, 60].forEach((m) => presets.appendChild(h('button', { class: 'btn', onclick: () => set(m * 60000) }, m === 60 ? '1 h' : m + ' min')));
        const custom = h('input', { class: 'field', placeholder: T('e.g. 7, 1:30, 1h 20m'), style: { width: '150px' }, 'aria-label': T('Custom time') });
        const applyCustom = () => { const ms = parseDuration(custom.value); if (ms > 0) { set(ms); custom.value = ''; custom.classList.remove('bad'); } else if (custom.value) custom.classList.add('bad'); };
        custom.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyCustom(); });
        custom.addEventListener('change', applyCustom);
        const label = h('input', { class: 'field', placeholder: T('Name (optional)'), style: { width: '150px' }, value: tmState().label || '' });
        label.addEventListener('input', () => { const tm = tmState(); tm.label = label.value.trim().slice(0, 40); tmSave(tm); upd(); });
        presets.append(custom, label);
        const bS = h('button', { class: 'clk-btn' }); const bC = h('button', { class: 'clk-btn gray' }, T('Cancel'));
        const left = (tm) => (tm.running ? Math.max(0, tm.end - Date.now()) : tm.left);
        const upd = () => {
          const tm = tmState(); const l = left(tm);
          disp.textContent = fmtT(l); disp.classList.toggle('long', l >= 3600000);
          name.textContent = tm.label || '';
          bS.textContent = T(tm.running ? 'Pause' : l < tm.total ? 'Resume' : 'Start'); bS.className = 'clk-btn ' + (tm.running ? 'orange' : 'green');
          bC.disabled = !tm.running && l === tm.total;
          ends.textContent = tm.running ? T('Ends at') + ' ' + new Date(tm.end).toLocaleTimeString(PatOS.lang === 'fr' ? 'fr-CA' : undefined, { hour: 'numeric', minute: '2-digit' }) : fmtLong(tm.total);
          presets.classList.toggle('dim', tm.running);
          const x = ring.getContext('2d'); x.clearRect(0, 0, 520, 520); x.lineWidth = 18; x.lineCap = 'round';
          x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(260, 260, 234, 0, Math.PI * 2); x.stroke();
          if (l > 0) { x.strokeStyle = getComputedStyle(win.body).getPropertyValue('--accent').trim() || '#0a84ff'; x.beginPath(); x.arc(260, 260, 234, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (l / tm.total)); x.stroke(); }
        };
        const startPause = () => {
          const tm = tmState();
          if (tm.running) { tm.left = left(tm); tm.running = false; PatOS.alarms.cancel('clock-timer'); }
          else {
            if (tm.left <= 0) tm.left = tm.total;
            PatOS.alarms.askPermission();
            tm.end = Date.now() + tm.left; tm.running = true;
            PatOS.alarms.schedule({ id: 'clock-timer', kind: 'timer', at: tm.end, title: tm.label ? tm.label : T('Timer done'), body: fmtLong(tm.total) + ' · ' + T('Timer'), icon: 'clock', app: 'clock' });
          }
          tmSave(tm); upd();
        };
        bS.onclick = startPause;
        bC.onclick = () => { const tm = tmState(); tm.running = false; tm.left = tm.total; tmSave(tm); PatOS.alarms.cancel('clock-timer'); upd(); };
        onKey((e) => { if (e.key === ' ') { e.preventDefault(); startPause(); } });
        body.append(h('div', { class: 'clk-timer' }, ring, h('div', { class: 'clk-tmid' }, name, disp, ends)), h('div', { class: 'clk-row' }, bC, bS), presets);
        PatOS.on('clock:timer', upd); cleanups.push(() => PatOS.off('clock:timer', upd));
        upd(); timers.push(setInterval(upd, 200));
      }
      win.on('closed', clearTimers);
      win._tab = (i) => { tab = i; PatOS.store.set('clockTab', i); render(); };
      render();
    },
    onArgs(win, args) { if (typeof args.tab === 'number' && win._tab) win._tab(args.tab); }
  });
})();
