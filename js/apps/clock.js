/* Clock — world clock, stopwatch, timer */
(function () {
  'use strict';
  const { h } = PatOS;
  const CITIES = [['Local', null], ['Montréal', 'America/Toronto'], ['Vancouver', 'America/Vancouver'], ['London', 'Europe/London'], ['Paris', 'Europe/Paris'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['New York', 'America/New_York']];
  const inTZ = (tz) => tz ? new Date(new Date().toLocaleString('en-US', { timeZone: tz })) : new Date();
  const fmt = (ms, cs) => { const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + (cs ? '.' + String(c).padStart(2, '0') : ''); };

  PatOS.registerApp({
    id: 'clock', name: 'Clock', icon: 'clock', width: 720, height: 500, dark: true, category: 'Utilities', keywords: 'time stopwatch timer alarm world',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const tabs = ['World Clock', 'Stopwatch', 'Timer'];
      let tab = 0;
      const seg = h('div', { class: 'seg' });
      tabs.forEach((t, i) => seg.appendChild(h('button', { class: 'tab', onclick: () => { tab = i; render(); } }, t)));
      win.toolbar.style.justifyContent = 'center'; win.toolbar.append(seg);
      const body = h('div', { class: 'clk' }); win.body.appendChild(body);
      let timers = [];
      const clearTimers = () => { timers.forEach(clearInterval); timers = []; };

      // stopwatch state persists across tab switches
      const sw = { running: false, start: 0, acc: 0, laps: [] };
      const tm = { running: false, end: 0, left: 5 * 60000, total: 5 * 60000 };

      function render() {
        clearTimers(); body.innerHTML = '';
        [...seg.children].forEach((b, i) => b.classList.toggle('on', i === tab));
        if (tab === 0) world(); else if (tab === 1) stopwatch(); else timer();
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
        [1, 3, 5, 10, 15, 25].forEach((m) => presets.appendChild(h('button', { class: 'btn', onclick: () => { tm.running = false; tm.left = tm.total = m * 60000; upd(); } }, m + ' min')));
        const bS = h('button', { class: 'clk-btn' }); const bC = h('button', { class: 'clk-btn gray' }, 'Cancel');
        const left = () => tm.running ? Math.max(0, tm.end - Date.now()) : tm.left;
        const upd = () => {
          const l = left();
          disp.textContent = fmt(Math.ceil(l / 1000) * 1000);
          bS.textContent = tm.running ? 'Pause' : 'Start'; bS.className = 'clk-btn ' + (tm.running ? 'orange' : 'green');
          const x = ring.getContext('2d'); x.clearRect(0, 0, 260, 260); x.lineWidth = 10; x.lineCap = 'round';
          x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(130, 130, 118, 0, Math.PI * 2); x.stroke();
          x.strokeStyle = '#ff9f0a'; x.beginPath(); x.arc(130, 130, 118, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (l / tm.total)); x.stroke();
          if (tm.running && l <= 0) { tm.running = false; tm.left = tm.total; PatOS.notify({ title: 'Timer done!', body: fmt(tm.total) + ' timer finished', icon: 'clock' }); [0, 0.4, 0.8].forEach((d) => PatOS.sound.tone(880, 0.3, { delay: d, vol: 0.2 })); }
        };
        bS.onclick = () => { if (tm.running) { tm.left = left(); tm.running = false; } else { tm.end = Date.now() + tm.left; tm.running = true; } upd(); };
        bC.onclick = () => { tm.running = false; tm.left = tm.total; upd(); };
        body.append(h('div', { class: 'clk-timer' }, ring, disp), h('div', { class: 'clk-row' }, bC, bS), presets);
        upd(); timers.push(setInterval(upd, 200));
      }
      win.on('closed', clearTimers);
      render();
    }
  });
})();
