/* Focus — a study timer (Pomodoro) with a task, background sound and stats */
(function () {
  'use strict';
  const { h } = PatOS;
  const MODES = { focus: ['Focus', 25], short: ['Short Break', 5], long: ['Long Break', 15] };
  const day = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  /* background noise made with Web Audio */
  let noise = null;
  function startNoise(kind) {
    stopNoise(); if (kind === 'off') return;
    const a = PatOS.audio(); if (!a) return;
    const len = a.ctx.sampleRate * 2, buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.5; }
    const src = a.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = a.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'rain' ? 1800 : kind === 'brown' ? 900 : 6000;
    const g = a.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(kind === 'rain' ? 0.22 : 0.3, a.ctx.currentTime + 1.2);
    src.connect(f); f.connect(g); g.connect(a.out); src.start();
    let lfo = null;
    if (kind === 'rain') { lfo = setInterval(() => { f.frequency.setTargetAtTime(1400 + Math.random() * 900, a.ctx.currentTime, 0.4); }, 700); }
    noise = { src, g, a, lfo };
  }
  function stopNoise() {
    if (!noise) return; const n = noise; noise = null; clearInterval(n.lfo);
    try { n.g.gain.setTargetAtTime(0, n.a.ctx.currentTime, 0.2); setTimeout(() => { try { n.src.stop(); } catch (e) {} }, 800); } catch (e) {}
  }

  PatOS.registerApp({
    id: 'focus', name: 'Focus', icon: 'focus', width: 760, height: 560, category: 'Utilities', keywords: 'pomodoro study timer concentrate homework productivity',
    about: 'A study timer: 25 minutes of focus, then a break. Keeps track of your time.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const cfg = Object.assign({ focus: 25, short: 5, long: 15, every: 4, auto: false, sound: 'off', goal: 4 }, PatOS.store.get('focusCfg', {}));
      const hist = PatOS.store.get('focusHistory', {}); // { 'YYYY-MM-DD': { n, min, tasks: {name: min} } }
      let mode = 'focus', total = cfg.focus * 60, left = total, running = false, endAt = 0, done = 0, timer = null;
      const task = h('input', { class: 'fo-task', placeholder: 'What are you working on?', value: PatOS.store.get('focusTask', '') });
      task.oninput = () => PatOS.store.set('focusTask', task.value);
      const tabs = h('div', { class: 'seg fo-tabs' });
      const R = 120, C = 2 * Math.PI * R;
      const ring = h('div', { class: 'fo-ring', html: `<svg viewBox="0 0 280 280"><circle cx="140" cy="140" r="${R}" class="fo-bg"/><circle cx="140" cy="140" r="${R}" class="fo-fg" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 140 140)"/></svg>` });
      const time = h('div', { class: 'fo-time' }), sub = h('div', { class: 'fo-sub' });
      ring.appendChild(h('div', { class: 'fo-center' }, time, sub));
      const bStart = h('button', { class: 'btn primary fo-go' }), bReset = h('button', { class: 'btn' }, PatOS.t('Reset')), bSkip = h('button', { class: 'btn' }, PatOS.t('Skip'));
      const dots = h('div', { class: 'fo-dots' });
      const sound = h('select', { class: 'field' }, ...[['off', 'No sound'], ['rain', 'Rain'], ['white', 'White noise'], ['brown', 'Brown noise']].map(([v, l]) => h('option', { value: v }, PatOS.t(l))));
      sound.value = cfg.sound;
      sound.onchange = () => { cfg.sound = sound.value; PatOS.store.set('focusCfg', cfg); if (running && mode === 'focus') startNoise(cfg.sound); else stopNoise(); };
      const bSet = h('button', { class: 'tbtn', title: 'Timer settings', html: PatOS.sym('gear') });
      const bStats = h('button', { class: 'tbtn', title: 'Statistics', html: PatOS.sym('sheet') });
      win.toolbar.append(h('span', { class: 'fo-tl' }, PatOS.t('Sound')), sound, h('div', { style: { flex: 1 } }), bStats, bSet);
      const main = h('div', { class: 'fo-main' }, tabs, ring, task, h('div', { class: 'fo-btns' }, bReset, bStart, bSkip), dots);
      const stats = h('div', { class: 'fo-stats' });
      win.body.appendChild(h('div', { class: 'fo-wrap' }, main, stats));

      function setMode(m, keepRunning) {
        mode = m; total = cfg[m] * 60; left = total; if (!keepRunning) running = false;
        if (running) endAt = Date.now() + left * 1000;
        win.el.dataset.fo = m; paint();
      }
      function renderTabs() {
        tabs.innerHTML = '';
        Object.entries(MODES).forEach(([k, [l]]) => { const b = h('button', { class: 'tab' + (mode === k ? ' on' : '') }, PatOS.t(l)); b.onclick = () => { setMode(k); stopNoise(); }; tabs.appendChild(b); });
      }
      function paint() {
        renderTabs();
        time.textContent = fmt(Math.ceil(left));
        sub.textContent = PatOS.t(running ? (mode === 'focus' ? 'Stay focused' : 'Take a breather') : left < total ? 'Paused' : MODES[mode][0]);
        ring.querySelector('.fo-fg').style.strokeDashoffset = String(C * (1 - left / total));
        bStart.textContent = PatOS.t(running ? 'Pause' : left < total ? 'Resume' : 'Start');
        dots.innerHTML = '';
        for (let i = 0; i < cfg.every; i++) dots.appendChild(h('i', { class: i < done % cfg.every || (done && done % cfg.every === 0 && mode === 'long') ? 'on' : '' }));
        win.setTitle(running ? fmt(Math.ceil(left)) + ' · ' + PatOS.t('Focus') : PatOS.t('Focus'));
      }
      function tick() {
        if (!running) return;
        left = Math.max(0, (endAt - Date.now()) / 1000);
        if (left <= 0) finish(); else paint();
      }
      function finish(skipped) {
        running = false; stopNoise();
        if (!skipped) [0, 0.25, 0.5].forEach((d, i) => PatOS.sound.tone([660, 880, 1100][i], 0.35, { delay: d, vol: 0.18 }));
        if (mode === 'focus') {
          done++;
          if (!skipped) {
          const k = day(), e = hist[k] || (hist[k] = { n: 0, min: 0, tasks: {} });
          e.n++; e.min += cfg.focus; const tn = task.value.trim() || PatOS.t('No task'); e.tasks[tn] = (e.tasks[tn] || 0) + cfg.focus;
          PatOS.store.set('focusHistory', hist);
          }
          if (!skipped) PatOS.notify({ title: PatOS.t('Focus session done'), body: PatOS.t('Nice work. Time for a break.'), icon: 'focus' });
          setMode(done % cfg.every === 0 ? 'long' : 'short');
        } else {
          if (!skipped) PatOS.notify({ title: PatOS.t('Break is over'), body: PatOS.t('Ready for the next session?'), icon: 'focus' });
          setMode('focus');
        }
        renderStats();
        if (cfg.auto) start();
      }
      function start() {
        if (PatOS.alarms) PatOS.alarms.askPermission();
        running = true; endAt = Date.now() + left * 1000;
        if (mode === 'focus') startNoise(cfg.sound);
        paint();
      }
      bStart.onclick = () => { if (running) { running = false; left = Math.max(0, (endAt - Date.now()) / 1000); stopNoise(); paint(); } else start(); };
      bReset.onclick = () => { setMode(mode); stopNoise(); };
      bSkip.onclick = () => { const was = running; left = 0; running = true; endAt = Date.now(); finish(true); if (!was && !cfg.auto) paint(); };
      timer = setInterval(tick, 250);
      // the background beat keeps the session on time when PatOS is hidden (Chrome slows page timers then)
      const offBeat = PatOS.alarms ? PatOS.alarms.onTick(tick) : () => {};
      win.on('closed', () => { clearInterval(timer); offBeat(); stopNoise(); });
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.key === ' ') { e.preventDefault(); bStart.click(); } if (e.key === 'r') bReset.click(); });

      function renderStats() {
        stats.innerHTML = '';
        const today = hist[day()] || { n: 0, min: 0, tasks: {} };
        let streak = 0; for (let d = new Date(); ; d.setDate(d.getDate() - 1)) { const e = hist[day(d)]; if (e && e.n) streak++; else if (day(d) !== day()) break; if (streak > 3650) break; }
        const all = Object.values(hist).reduce((t, e) => t + e.min, 0);
        stats.append(h('h3', {}, PatOS.t('Today')),
          h('div', { class: 'fo-goal' }, h('div', { class: 'fo-bar' }, h('i', { style: { width: Math.min(100, today.n / cfg.goal * 100) + '%' } })), h('span', {}, today.n + ' / ' + cfg.goal + ' ' + PatOS.t('sessions'))),
          h('div', { class: 'fo-nums' },
            h('div', {}, h('b', {}, String(today.min)), h('span', {}, PatOS.t('minutes today'))),
            h('div', {}, h('b', {}, String(streak)), h('span', {}, PatOS.t('day streak'))),
            h('div', {}, h('b', {}, (all / 60).toFixed(1)), h('span', {}, PatOS.t('hours in total')))));
        stats.appendChild(h('h3', {}, PatOS.t('Last 7 days')));
        const week = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); week.push([d, (hist[day(d)] || { min: 0 }).min]); }
        const max = Math.max(cfg.focus, ...week.map((w) => w[1]));
        stats.appendChild(h('div', { class: 'fo-chart' }, ...week.map(([d, m]) => h('div', { class: 'fo-col' + (day(d) === day() ? ' today' : ''), title: m + ' min' }, h('small', {}, m ? String(m) : ''), h('i', { style: { height: Math.max(3, m / max * 100) + '%' } }), h('span', {}, d.toLocaleDateString(PatOS.locale, { weekday: 'narrow' }))))));
        const tasks = Object.entries(today.tasks).sort((a, b) => b[1] - a[1]);
        if (tasks.length) {
          stats.appendChild(h('h3', {}, PatOS.t('Worked on today')));
          tasks.slice(0, 6).forEach(([n, m]) => stats.appendChild(h('div', { class: 'fo-trow' }, h('span', {}, n), h('b', {}, m + ' min'))));
        }
      }
      bStats.onclick = () => win.el.classList.toggle('fo-nostats');
      bSet.onclick = () => {
        const field = (label, key, min, max) => { const i = h('input', { class: 'field', type: 'number', min, max, value: cfg[key] }); i.onchange = () => { const v = Math.round(+i.value); if (v >= min && v <= max) { cfg[key] = v; PatOS.store.set('focusCfg', cfg); if (!running) setMode(mode); renderStats(); } }; return h('label', { class: 'fo-field' }, h('span', {}, PatOS.t(label)), i); };
        const auto = h('input', { type: 'checkbox' }); auto.checked = cfg.auto; auto.onchange = () => { cfg.auto = auto.checked; PatOS.store.set('focusCfg', cfg); };
        const box = h('div', { class: 'fo-settings' },
          h('h3', {}, PatOS.t('Timer settings')),
          field('Focus (minutes)', 'focus', 1, 180), field('Short break (minutes)', 'short', 1, 60), field('Long break (minutes)', 'long', 1, 90),
          field('Long break after', 'every', 2, 10), field('Daily goal (sessions)', 'goal', 1, 20),
          h('label', { class: 'fo-field' }, h('span', {}, PatOS.t('Start the next timer automatically')), auto),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '10px' } },
            h('button', { class: 'btn', onclick: () => PatOS.confirmBox(PatOS.t('Erase all your Focus history?'), '', { danger: true, ok: 'Clear', icon: 'focus' }).then((ok) => { if (ok) { Object.keys(hist).forEach((k) => delete hist[k]); PatOS.store.set('focusHistory', hist); renderStats(); } }) }, PatOS.t('Clear history')),
            h('button', { class: 'btn primary', onclick: () => box.remove() }, PatOS.t('Done'))));
        win.body.appendChild(box);
      };
      win.el.dataset.fo = mode;
      setMode('focus'); renderStats();
    }
  });
})();
