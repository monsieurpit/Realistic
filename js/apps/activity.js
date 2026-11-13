/* Activity Monitor (3.3): the processes of PatOS (js/process.js), measured live.
   CPU · Memory · Energy views; click a column to sort; select a process to Quit or Force Quit it; double-click (or "i") to
   see everything about it: what it holds (timers, loops, workers, listeners, requests, microphone/camera, sound), its long
   blocks of work and its problems. The numbers are measured (CPU time) or estimated (memory: from what its windows hold),
   and said to be. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const fmtTime = (ms) => { const s = ms / 1000; return s < 60 ? s.toFixed(2) + ' s' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  const ST = { running: 'Running', background: 'Background', 'not responding': 'Not responding', ended: 'Ended', 'force quit': 'Force quit' };
  PatOS.registerApp({
    id: 'activity', name: 'Activity Monitor', icon: 'activity', single: true, width: 860, height: 560, minWidth: 560, minHeight: 360, category: 'Utilities', keywords: 'task manager force quit cpu memory energy processes ps top fps',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'am2-win');
      let tab = PatOS.store.get('amTab', 'cpu'), sortK = 'cpu', sortDir = -1, sel = args && args.pid ? +args.pid : 0, q = '', showSys = PatOS.store.get('amSys', true);
      const COLS = {
        cpu: [['name', 'Process'], ['cpu', '% CPU'], ['cpuTime', 'CPU Time'], ['threads', 'Threads'], ['windows', 'Windows'], ['state', 'State'], ['pid', 'PID']],
        memory: [['name', 'Process'], ['memory', 'Memory'], ['workers', 'Workers'], ['listeners', 'Listeners'], ['requests', 'Requests'], ['pid', 'PID']],
        energy: [['name', 'Process'], ['energy', 'Energy Impact'], ['frames', 'Animations'], ['streams', 'Mic / Camera'], ['sound', 'Sound'], ['pid', 'PID']]
      };
      // toolbar
      const seg = PatOS.ui.segmented([['cpu', 'CPU'], ['memory', 'Memory'], ['energy', 'Energy']], tab, (v) => { tab = v; PatOS.store.set('amTab', v); sortK = v === 'cpu' ? 'cpu' : v === 'memory' ? 'memory' : 'energy'; sortDir = -1; draw(); });
      const bQuit = h('button', { class: 'am2-tb', title: T('Force Quit'), 'aria-label': T('Force Quit'), html: PatOS.sym('stop'), onclick: () => askKill() });
      const bInfo = h('button', { class: 'am2-tb', title: T('Inspect'), 'aria-label': T('Inspect'), html: PatOS.sym('search'), onclick: () => inspect() });
      const sysT = h('button', { class: 'am2-tb' + (showSys ? ' on' : ''), title: T('System processes'), 'aria-label': T('System processes'), html: PatOS.sym('gear'), onclick: () => { showSys = !showSys; PatOS.store.set('amSys', showSys); sysT.classList.toggle('on', showSys); draw(); } });
      const search = PatOS.ui.search({ placeholder: 'Search', onInput: (v) => { q = v.toLowerCase(); draw(); } });
      win.toolbar.append(bQuit, bInfo, sysT, seg, h('div', { style: { flex: 1 } }), search);
      const table = h('div', { class: 'am2-table', role: 'grid', 'aria-label': T('Processes') });
      const foot = h('div', { class: 'am2-foot' });
      win.body.append(table, foot);
      const hist = []; let frames = 0, fps = 60, last = performance.now(), raf;
      const loop = (t) => { frames++; if (t - last >= 1000) { fps = Math.round(frames * 1000 / (t - last)); frames = 0; last = t; } raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);

      const valueOf = (p, k) => (k === 'state' ? p.state : k === 'name' ? p.name.toLowerCase() : p[k] || 0);
      const cell = (p, k) => {
        if (k === 'name') return h('span', { class: 'am2-name' }, h('span', { class: 'am2-ic', html: p.system ? PatOS.sym('gear') : PatOS.iconHTML((PatOS.apps[p.app] && PatOS.apps[p.app].icon) || p.app) }), h('span', {}, p.name));
        if (k === 'cpu') return h('span', { class: 'am2-num' + (p.cpu > 25 ? ' hot' : '') }, p.cpu.toFixed(1));
        if (k === 'cpuTime') return h('span', { class: 'am2-num' }, fmtTime(p.cpuTime));
        if (k === 'memory') return h('span', { class: 'am2-num' }, p.memory ? PatOS.fmtBytes(p.memory) : '—');
        if (k === 'energy') return h('span', { class: 'am2-num' + (p.energy > 40 ? ' hot' : '') }, String(p.energy));
        if (k === 'state') return h('span', { class: 'am2-st ' + p.state.replace(/ /g, '-') }, T(ST[p.state] || p.state));
        if (k === 'streams') return h('span', { class: 'am2-num' }, p.streams ? '● ' + p.streams : '—');
        if (k === 'sound') return h('span', { class: 'am2-num' }, p.sound ? T('Playing') : '—');
        return h('span', { class: 'am2-num' }, String(p[k] == null ? '—' : p[k]));
      };
      function list() {
        const l = PatOS.proc.list().filter((p) => (showSys || !p.system) && (!q || p.name.toLowerCase().includes(q) || String(p.pid) === q));
        return l.sort((a, b) => { const x = valueOf(a, sortK), y = valueOf(b, sortK); return (x > y ? 1 : x < y ? -1 : a.pid - b.pid) * sortDir; });
      }
      function draw() {
        const cols = COLS[tab], l = list(), scroll = table.scrollTop;
        table.style.setProperty('--am2-cols', cols.map((c, i) => (i === 0 ? 'minmax(180px, 1fr)' : c[0] === 'state' ? '120px' : '96px')).join(' '));
        table.innerHTML = '';
        table.appendChild(h('div', { class: 'am2-row am2-head', role: 'row' }, ...cols.map(([k, l2]) => h('button', { class: 'am2-hc' + (sortK === k ? ' on' : ''), role: 'columnheader', onclick: () => { if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = k === 'name' || k === 'pid' ? 1 : -1; } draw(); } }, T(l2), sortK === k ? (sortDir < 0 ? ' ↓' : ' ↑') : ''))));
        if (!l.length) table.appendChild(PatOS.ui.empty({ icon: 'search', title: 'No processes', text: q ? 'Nothing matches your search.' : '' }));
        l.forEach((p) => {
          const r = h('div', { class: 'am2-row' + (p.pid === sel ? ' sel' : '') + (p.system ? ' sys' : ''), role: 'row', tabindex: '0', 'aria-selected': String(p.pid === sel), onclick: () => { sel = p.pid; draw(); }, ondblclick: () => { sel = p.pid; inspect(); }, onkeydown: (e) => { if (e.key === 'Enter') inspect(); } }, ...cols.map(([k]) => cell(p, k)));
          table.appendChild(r);
        });
        table.scrollTop = scroll;
        const s = PatOS.proc.get(sel); bQuit.disabled = !s || s.system; bInfo.disabled = !s;
        // the totals, under the table
        const apps = l.filter((p) => !p.system), all = PatOS.proc.list();
        const total = all.reduce((a, p) => a + p.cpu, 0); hist.push(total); if (hist.length > 60) hist.shift();
        foot.innerHTML = '';
        const stat = (k, v) => h('div', { class: 'am2-stat' }, h('small', {}, T(k)), h('b', {}, String(v)));
        if (tab === 'cpu') {
          const g = h('canvas', { class: 'am2-graph', width: 240, height: 54 });
          foot.append(h('div', { class: 'am2-stats' }, stat('Measured CPU', total.toFixed(1) + '%'), stat('Frames per second', fps), stat('Processes', all.length), stat('Threads', all.reduce((a, p) => a + p.threads, 0))), h('div', { class: 'am2-gbox' }, h('small', {}, T('CPU load')), g));
          const x = g.getContext('2d'); x.clearRect(0, 0, 240, 54); x.fillStyle = 'rgba(48,209,88,.25)'; x.strokeStyle = '#30d158'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, 54);
          hist.forEach((v, i) => x.lineTo(i / 59 * 240, 53 - Math.min(52, v / 100 * 52 * 2))); x.lineTo((hist.length - 1) / 59 * 240, 54); x.closePath(); x.fill();
        } else if (tab === 'memory') {
          const heap = performance.memory ? PatOS.fmtBytes(performance.memory.usedJSHeapSize) + ' / ' + PatOS.fmtBytes(performance.memory.jsHeapSizeLimit) : T('not shared by this browser');
          foot.append(h('div', { class: 'am2-stats' }, stat('JavaScript memory', heap), stat('Items on screen', document.getElementsByTagName('*').length.toLocaleString()), stat('Apps (estimate)', PatOS.fmtBytes(apps.reduce((a, p) => a + p.memory, 0))), stat('Storage', PatOS.fmtBytes(PatOS.store.usage()))));
        } else {
          foot.append(h('div', { class: 'am2-stats' }, stat('Energy impact', all.reduce((a, p) => a + p.energy, 0)), stat('Animations', all.reduce((a, p) => a + p.frames, 0)), stat('Mic / Camera', all.reduce((a, p) => a + p.streams, 0) || '—'), stat('Playing sound', all.filter((p) => p.sound).map((p) => p.name).join(', ') || '—')));
        }
        foot.appendChild(h('p', { class: 'am2-fine' }, T('CPU is measured: the time each app’s own code runs. Memory is an estimate from what its windows hold.')));
      }
      function askKill() {
        const p = PatOS.proc.get(sel); if (!p || p.system) return;
        PatOS.ui.sheet(win, { title: T('Force quit') + ' “' + p.name + '”?', body: h('p', { class: 'am2-p' }, T('Everything it started stops now: its windows, timers, animations, workers, network requests, microphone, camera and sound. What it hasn’t saved is lost. Copies and backups keep going.')),
          actions: (close) => [h('button', { class: 'btn', onclick: () => { close(); PatOS.proc.quit(p.pid); setTimeout(draw, 300); } }, T('Quit')), h('button', { class: 'btn danger', onclick: () => { close(); PatOS.proc.kill(p.pid); sel = 0; setTimeout(draw, 100); } }, T('Force Quit'))] });
      }
      function inspect() {
        const p = PatOS.proc.get(sel); if (!p) return;
        const row = (k, v) => h('div', { class: 'am2-kv' }, h('span', {}, T(k)), h('b', {}, String(v)));
        const body = h('div', { class: 'am2-insp' },
          row('PID', p.pid), row('State', T(ST[p.state] || p.state)), row('Started', new Date(p.started).toLocaleTimeString(PatOS.locale)), row('CPU now', p.cpu.toFixed(1) + '%'), row('CPU time', fmtTime(p.cpuTime)),
          row('Windows', p.windows), row('Repeating timers', p.intervals), row('Pending timers', p.timeouts), row('Animations', p.frames), row('Workers', p.workers), row('Page listeners', p.listeners), row('Network requests', p.requests),
          row('Microphone / camera', p.streams || '—'), row('Playing sound', p.sound || '—'), row('Memory (estimate)', p.memory ? PatOS.fmtBytes(p.memory) : '—'), row('Energy impact', p.energy),
          row('Longest block', p.worst ? (p.worst / 1000).toFixed(2) + ' s' : '—'),
          p.errors.length ? h('div', { class: 'am2-errs' }, h('small', {}, T('Problems')), ...p.errors.map((e) => h('div', {}, new Date(e.t).toLocaleTimeString(PatOS.locale) + ' · ' + e.m))) : null);
        PatOS.ui.sheet(win, { title: p.name, body, actions: (close) => p.system ? [h('button', { class: 'btn', onclick: close }, T('Done'))] : [h('button', { class: 'btn', onclick: () => { close(); PatOS.proc.quit(p.pid); } }, T('Quit')), h('button', { class: 'btn danger', onclick: () => { close(); sel = p.pid; askKill(); } }, T('Force Quit')), h('button', { class: 'btn primary', onclick: close }, T('Done'))] });
      }
      win.onKey = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && sel) askKill(); };
      win.body.addEventListener('keydown', (e) => win.onKey(e));
      const t = setInterval(() => { if (!win.body.querySelector('.ui-sheet')) draw(); }, 1000); draw();
      win._select = (pid) => { sel = +pid; draw(); };
      win.on('closed', () => { clearInterval(t); cancelAnimationFrame(raf); });
    },
    onArgs(win, args) { if (args && args.pid && win._select) win._select(args.pid); }
  });
})();
