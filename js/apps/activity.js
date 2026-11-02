/* Activity Monitor */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'activity', name: 'Activity Monitor', icon: 'activity', width: 680, height: 460, category: 'Utilities', keywords: 'task manager force quit cpu memory fps',
    launch(win) {
      const stats = h('div', { class: 'am-stats' });
      const table = h('div', { class: 'am-table' });
      const graph = h('canvas', { class: 'am-graph', width: 600, height: 80 });
      win.body.append(stats, graph, table);
      let frames = 0, fps = 60, last = performance.now(), raf; const hist = [];
      const loop = (t) => { frames++; if (t - last >= 1000) { fps = Math.round(frames * 1000 / (t - last)); frames = 0; last = t; hist.push(fps); if (hist.length > 60) hist.shift(); } raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      function render() {
        const mem = performance.memory ? PatOS.fmtBytes(performance.memory.usedJSHeapSize) : 'n/a';
        stats.innerHTML = '';
        [['FPS', fps], ['JS Memory', mem], ['Windows', PatOS.wm.windows.length], ['Storage', PatOS.fmtBytes(PatOS.store.usage())], ['CPU Cores', navigator.hardwareConcurrency || '?'], ['Uptime', Math.round(performance.now() / 60000) + ' min']]
          .forEach(([k, v]) => stats.appendChild(h('div', { class: 'am-stat' }, h('small', {}, k), h('b', {}, String(v)))));
        const x = graph.getContext('2d'); graph.width = graph.clientWidth || 600; x.clearRect(0, 0, graph.width, 80);
        x.strokeStyle = '#32d74b'; x.lineWidth = 2; x.beginPath();
        hist.forEach((v, i) => { const px = i / 59 * graph.width, py = 78 - Math.min(v, 75); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
        table.innerHTML = '';
        table.appendChild(h('div', { class: 'am-row am-h' }, h('span', {}, 'Process'), h('span', {}, 'Windows'), h('span', {}, 'CPU %'), h('span', {}, '')));
        const apps = [...new Set(PatOS.wm.windows.map((w) => w.app.id))];
        [['kernel_task', 1], ['WindowServer', 1], ['Dock', 1], ...apps.map((a) => [a, PatOS.wm.windowsOf(a).length])].forEach(([id, n]) => {
          const app = PatOS.apps[id]; const heavy = ['galaxy', 'orbrunner', 'studio', 'music'].includes(id);
          table.appendChild(h('div', { class: 'am-row' }, h('span', { class: 'am-p' }, app ? h('span', { class: 'am-ic', html: PatOS.iconHTML(app.icon || id) }) : '⚙️', app ? app.name : id), h('span', {}, n), h('span', {}, (Math.random() * (heavy ? 30 : 4) + (heavy ? 15 : 0.2)).toFixed(1)),
            app && id !== 'activity' ? h('button', { class: 'btn danger', onclick: () => { PatOS.wm.quit(id); render(); } }, 'Force Quit') : h('span')));
        });
      }
      const t = setInterval(render, 1000); render();
      win.on('closed', () => { clearInterval(t); cancelAnimationFrame(raf); });
    }
  });
})();
