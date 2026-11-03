/* Clock — world clock, stopwatch, timer */
(function () {
  'use strict';
  const { h } = PatOS;
  const CITIES = [['Local', null], ['Montréal', 'America/Toronto'], ['Vancouver', 'America/Vancouver'], ['London', 'Europe/London'], ['Paris', 'Europe/Paris'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['New York', 'America/New_York']];
  const inTZ = (tz) => tz ? new Date(new Date().toLocaleString('en-US', { timeZone: tz })) : new Date();
  const fmt = (ms, cs) => { const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + (cs ? '.' + String(c).padStart(2, '0') : ''); };

  /* Alarms and the timer are rung by PatOS.alarms, so they work with Clock closed and in the background.
     The timer is saved, so it keeps going when Clock is closed or PatOS is reloaded. */
  const TM = 'clockTimer';
  const tmState = () => Object.assign({ running: false, end: 0, left: 5 * 60000, total: 5 * 60000 }, PatOS.store.get(TM, null) || {});
  const tmSave = (tm) => PatOS.store.set(TM, tm);
  PatOS.on('alarm:fire', (x) => { if (x.id === 'clock-timer') { const tm = tmState(); tm.running = false; tm.left = tm.total; tmSave(tm); PatOS.emit('clock:timer'); } });
  const REPEATS = [['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['once', 'Once']];

  PatOS.registerApp({
    id: 'clock', name: 'Clock', icon: 'clock', width: 720, height: 500, dark: true, category: 'Utilities', keywords: 'time stopwatch timer alarm world',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const tabs = ['World Clock', 'Alarms', 'Stopwatch', 'Timer'];
      let tab = 0;
      const seg = h('div', { class: 'seg' });
      tabs.forEach((t, i) => seg.appendChild(h('button', { class: 'tab', onclick: () => { tab = i; render(); } }, t)));
      win.toolbar.style.justifyContent = 'center'; win.toolbar.append(seg);
      const body = h('div', { class: 'clk' }); win.body.appendChild(body);
      let timers = [], cleanups = [];
      const clearTimers = () => { timers.forEach(clearInterval); timers = []; cleanups.forEach((f) => f()); cleanups = []; };

      // stopwatch state persists across tab switches
      const sw = { running: false, start: 0, acc: 0, laps: [] };


      function render() {
        clearTimers(); body.innerHTML = '';
        [...seg.children].forEach((b, i) => b.classList.toggle('on', i === tab));
        if (tab === 0) world(); else if (tab === 1) alarms(); else if (tab === 2) stopwatch(); else timer();
      }
      function world() {
        const g = h('div', { class: 'clk-world' });
        const items = CITIES.map(([name, tz]) => {
          const c = h('canvas', { width: 130, height: 130 });
          const t = h('div', { class: 'clk-t' }); const sub = h('div', { class: 'clk-sub' });
          g.appendChild(h('div', { class: 'clk-city' }, c, h('b', {}, name), t, sub));
          return { c, t, sub, tz };
        });
        const tick = () => items.forEach((it) => {
          const d = inTZ(it.tz); PatOS.drawAnalog(it.c, d);
          it.t.textContent = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
          const diff = Math.round((d - new Date()) / 3600000);
          it.sub.textContent = it.tz ? (diff === 0 ? 'Same time' : (diff > 0 ? '+' : '') + diff + ' hrs') : 'Your time';
        });
        tick(); timers.push(setInterval(tick, 1000));
        body.appendChild(g);
      }
      function alarms() {
        const list = PatOS.store.get('alarms', []);
        const save = () => PatOS.store.set('alarms', list);
        const wrap = h('div', { class: 'clk-alarms' });
        const draw = () => {
          wrap.innerHTML = '';
          if (!list.length) wrap.appendChild(h('div', { class: 'clk-sub', style: { padding: '30px', textAlign: 'center' } }, PatOS.t('No alarms yet. Alarms ring while PatOS is open.')));
          list.sort((a, b) => a.time.localeCompare(b.time)).forEach((a) => {
            const sw = h('button', { class: 'switch' + (a.on ? ' on' : '') }); sw.onclick = () => { a.on = !a.on; save(); draw(); };
            const [hh, mm] = a.time.split(':').map(Number); const d = new Date(); d.setHours(hh, mm, 0, 0);
            wrap.appendChild(h('div', { class: 'clk-alarm' + (a.on ? '' : ' off') }, h('div', {}, h('div', { class: 'clk-at' }, d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })), h('small', {}, (a.label || PatOS.t('Alarm')) + ' · ' + PatOS.t((REPEATS.find((r) => r[0] === (a.repeat || 'daily')) || REPEATS[0])[1]))), h('div', { style: { flex: 1 } }), h('button', { class: 'tbtn', title: 'Delete', onclick: () => { list.splice(list.indexOf(a), 1); save(); draw(); } }, '🗑'), sw));
          });
        };
        const tIn = h('input', { type: 'time', class: 'field', value: '07:00' });
        const lIn = h('input', { class: 'field', placeholder: PatOS.t('Label'), style: { width: '140px' } });
        const rIn = h('select', { class: 'field' }, ...REPEATS.map(([v, l]) => h('option', { value: v }, PatOS.t(l))));
        const add = h('button', { class: 'btn primary', onclick: () => { if (!tIn.value) return; PatOS.alarms.askPermission(); list.push({ id: PatOS.uid(), time: tIn.value, label: lIn.value.trim(), repeat: rIn.value, on: true }); lIn.value = ''; save(); draw(); } }, PatOS.t('Add Alarm'));
        body.append(h('div', { class: 'clk-addalarm' }, tIn, lIn, rIn, add), wrap);
        const onAl = () => { const fresh = PatOS.store.get('alarms', []); list.splice(0, list.length, ...fresh); draw(); };
        PatOS.on('alarms', onAl); cleanups.push(() => PatOS.off('alarms', onAl));
        draw();
      }
      function stopwatch() {
        const disp = h('div', { class: 'clk-big' });
        const bL = h('button', { class: 'clk-btn gray' }); const bS = h('button', { class: 'clk-btn' });
        const laps = h('div', { class: 'clk-laps' });
        const now = () => sw.acc + (sw.running ? Date.now() - sw.start : 0);
        const upd = () => {
          disp.textContent = fmt(now(), true);
          bS.textContent = sw.running ? 'Stop' : 'Start'; bS.className = 'clk-btn ' + (sw.running ? 'red' : 'green');
          bL.textContent = sw.running || !now() ? 'Lap' : 'Reset';
        };
        const drawLaps = () => { laps.innerHTML = ''; sw.laps.slice().reverse().forEach((l, i) => laps.appendChild(h('div', { class: 'clk-lap' }, h('span', {}, 'Lap ' + (sw.laps.length - i)), h('span', {}, fmt(l, true))))); };
        bS.onclick = () => { if (sw.running) { sw.acc = now(); sw.running = false; } else { sw.start = Date.now(); sw.running = true; } upd(); };
        bL.onclick = () => { if (sw.running) { const t = now(); const prev = sw.laps.reduce((a, b) => a + b, 0); sw.laps.push(t - prev); drawLaps(); } else { sw.acc = 0; sw.laps = []; drawLaps(); } upd(); };
        body.append(disp, h('div', { class: 'clk-row' }, bL, bS), laps);
        upd(); drawLaps(); timers.push(setInterval(upd, 31));
      }
      function timer() {
        const ring = h('canvas', { width: 260, height: 260, class: 'clk-ring' });
        const disp = h('div', { class: 'clk-tdisp' });
        const presets = h('div', { class: 'clk-presets' });
        const set = (ms) => { const tm = tmState(); if (tm.running) return; tm.left = tm.total = ms; tmSave(tm); upd(); };
        [1, 3, 5, 10, 15, 25].forEach((m) => presets.appendChild(h('button', { class: 'btn', onclick: () => set(m * 60000) }, m + ' min')));
        const custom = h('input', { type: 'number', class: 'field', min: 1, max: 600, placeholder: PatOS.t('Minutes'), style: { width: '90px' } });
        custom.addEventListener('keydown', (e) => { if (e.key === 'Enter' && +custom.value > 0) { set(Math.min(600, +custom.value) * 60000); custom.value = ''; } });
        presets.appendChild(custom);
        const bS = h('button', { class: 'clk-btn' }); const bC = h('button', { class: 'clk-btn gray' }, PatOS.t('Cancel'));
        const left = (tm) => tm.running ? Math.max(0, tm.end - Date.now()) : tm.left;
        const upd = () => {
          const tm = tmState(); const l = left(tm);
          disp.textContent = fmt(Math.ceil(l / 1000) * 1000);
          bS.textContent = PatOS.t(tm.running ? 'Pause' : l < tm.total ? 'Resume' : 'Start'); bS.className = 'clk-btn ' + (tm.running ? 'orange' : 'green');
          presets.classList.toggle('dim', tm.running);
          const x = ring.getContext('2d'); x.clearRect(0, 0, 260, 260); x.lineWidth = 10; x.lineCap = 'round';
          x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(130, 130, 118, 0, Math.PI * 2); x.stroke();
          x.strokeStyle = '#ff9f0a'; x.beginPath(); x.arc(130, 130, 118, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (l / tm.total)); x.stroke();
        };
        bS.onclick = () => {
          const tm = tmState();
          if (tm.running) { tm.left = left(tm); tm.running = false; PatOS.alarms.cancel('clock-timer'); }
          else {
            PatOS.alarms.askPermission();
            tm.end = Date.now() + tm.left; tm.running = true;
            PatOS.alarms.schedule({ id: 'clock-timer', kind: 'timer', at: tm.end, title: PatOS.t('Timer done'), body: fmt(tm.total) + ' · ' + PatOS.t('Timer'), icon: 'clock', app: 'clock' });
          }
          tmSave(tm); upd();
        };
        bC.onclick = () => { const tm = tmState(); tm.running = false; tm.left = tm.total; tmSave(tm); PatOS.alarms.cancel('clock-timer'); upd(); };
        body.append(h('div', { class: 'clk-timer' }, ring, disp), h('div', { class: 'clk-row' }, bC, bS), presets);
        PatOS.on('clock:timer', upd); cleanups.push(() => PatOS.off('clock:timer', upd));
        upd(); timers.push(setInterval(upd, 200));
      }
      win.on('closed', clearTimers);
      render();
    }
  });
})();
