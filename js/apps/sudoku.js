/* Sudoku — fresh puzzles with one solution, notes, hints, undo and a timer */
(function () {
  'use strict';
  const { h } = PatOS;
  const LEVELS = { easy: ['Easy', 40], medium: ['Medium', 32], hard: ['Hard', 26] };
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ok = (g, i, v) => {
    const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3;
    for (let k = 0; k < 9; k++) { if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false; }
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (g[(br + y) * 9 + bc + x] === v) return false;
    return true;
  };
  function fill(g) {
    const i = g.indexOf(0); if (i < 0) return true;
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) { if (ok(g, i, v)) { g[i] = v; if (fill(g)) return true; g[i] = 0; } }
    return false;
  }
  function count(g, limit) {
    // counts solutions up to limit, picking the cell with the fewest options
    let best = -1, opts = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const o = []; for (let v = 1; v <= 9; v++) if (ok(g, i, v)) o.push(v);
      if (!o.length) return 0;
      if (!opts || o.length < opts.length) { best = i; opts = o; if (o.length === 1) break; }
    }
    if (best < 0) return 1;
    let n = 0;
    for (const v of opts) { g[best] = v; n += count(g, limit - n); if (n >= limit) break; }
    g[best] = 0; return n;
  }
  function generate(level) {
    const sol = new Array(81).fill(0); fill(sol);
    const puz = sol.slice(), target = LEVELS[level][1];
    let clues = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (clues <= target) break;
      const v = puz[i]; puz[i] = 0;
      if (count(puz.slice(), 2) !== 1) puz[i] = v; else clues--;
    }
    return { puz, sol };
  }
  const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  PatOS.registerApp({
    id: 'sudoku', name: 'Sudoku', icon: 'sudoku', width: 800, height: 620, category: '3D & Games', keywords: 'puzzle numbers game logic',
    about: 'Number puzzles with exactly one answer, made fresh every game.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let st = PatOS.store.get('sudokuGame', null), sel = -1, notesMode = false, undo = [], timer = null;
      const best = PatOS.store.get('sudokuBest', {});
      const lvl = h('select', { class: 'field' }, ...Object.entries(LEVELS).map(([k, [l]]) => h('option', { value: k }, PatOS.t(l))));
      const bNew = h('button', { class: 'btn' }, PatOS.t('New Game'));
      const clock = h('span', { class: 'sd-clock' }), mistakes = h('span', { class: 'sd-mis' });
      win.toolbar.append(lvl, bNew, h('div', { style: { flex: 1 } }), mistakes, clock);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const board = h('div', { class: 'sd-board' }), pad = h('div', { class: 'sd-pad' }), tools = h('div', { class: 'sd-tools' });
      const overlay = h('div', { class: 'sd-done' });
      win.body.appendChild(h('div', { class: 'sd-wrap' }, h('div', { class: 'sd-bwrap' }, board, overlay), h('div', { class: 'sd-side' }, pad, tools)));
      const cells = [];
      for (let i = 0; i < 81; i++) {
        const c = h('button', { class: 'sd-cell', 'data-r': Math.floor(i / 9), 'data-c': i % 9 });
        c.onclick = () => { sel = i; paint(); };
        cells.push(c); board.appendChild(c);
      }
      const save = () => PatOS.store.set('sudokuGame', st);
      function newGame(level) {
        board.classList.add('sd-busy');
        setTimeout(() => {
          const { puz, sol } = generate(level);
          st = { level, puz, sol, val: puz.slice(), notes: Array.from({ length: 81 }, () => []), time: 0, mis: 0, done: false, hints: 0 };
          undo = []; sel = -1; save(); board.classList.remove('sd-busy'); paint();
        }, 20);
      }
      function set(i, v, asNote) {
        if (st.done || i < 0 || st.puz[i]) return;
        undo.push({ i, val: st.val[i], notes: st.notes[i].slice() });
        if (asNote && v) {
          if (st.val[i]) return;
          const n = st.notes[i], k = n.indexOf(v); if (k >= 0) n.splice(k, 1); else n.push(v);
        } else {
          st.val[i] = st.val[i] === v ? 0 : v; st.notes[i] = [];
          if (v && st.val[i] && st.val[i] !== st.sol[i]) { st.mis++; PatOS.sound.error(); }
          if (st.val[i] && st.val[i] === st.sol[i]) {
            // clear this number from notes in the same row, column and box
            const r = Math.floor(i / 9), c = i % 9;
            for (let j = 0; j < 81; j++) { const rj = Math.floor(j / 9), cj = j % 9; if (rj === r || cj === c || (Math.floor(rj / 3) === Math.floor(r / 3) && Math.floor(cj / 3) === Math.floor(c / 3))) { const k = st.notes[j].indexOf(v); if (k >= 0) st.notes[j].splice(k, 1); } }
          }
        }
        check(); save(); paint();
      }
      function check() {
        if (st.val.every((v, i) => v === st.sol[i])) {
          st.done = true; PatOS.gc && PatOS.gc.report('sudoku', { win: true, level: st.level, time: st.time });
          const b = best[st.level]; if (!b || st.time < b) { best[st.level] = st.time; PatOS.store.set('sudokuBest', best); }
          [523, 659, 784, 1046].forEach((f, i) => PatOS.sound.tone(f, 0.3, { delay: i * 0.12, vol: 0.15 }));
        }
      }
      function paint() {
        if (!st) return;
        lvl.value = st.level;
        const sv = sel >= 0 ? st.val[sel] : 0, sr = Math.floor(sel / 9), sc = sel % 9;
        cells.forEach((c, i) => {
          const r = Math.floor(i / 9), col = i % 9, v = st.val[i];
          const peer = sel >= 0 && (r === sr || col === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(col / 3) === Math.floor(sc / 3)));
          c.className = 'sd-cell' + (st.puz[i] ? ' given' : '') + (i === sel ? ' sel' : peer ? ' peer' : '') + (v && sv && v === sv && i !== sel ? ' same' : '') + (v && v !== st.sol[i] ? ' wrong' : '');
          if (v) c.textContent = v;
          else { c.innerHTML = ''; if (st.notes[i].length) { const g = h('div', { class: 'sd-notes' }); for (let n = 1; n <= 9; n++) g.appendChild(h('span', {}, st.notes[i].includes(n) ? String(n) : '')); c.appendChild(g); } }
        });
        pad.innerHTML = '';
        for (let n = 1; n <= 9; n++) {
          const left = 9 - st.val.filter((v, i) => v === n && v === st.sol[i]).length;
          const b = h('button', { class: 'sd-num' + (left ? '' : ' full') }, h('b', {}, String(n)), h('small', {}, left ? String(left) : ''));
          b.onclick = () => set(sel, n, notesMode); pad.appendChild(b);
        }
        tools.innerHTML = '';
        const tool = (label, icon, fn, on) => { const b = h('button', { class: 'sd-tool' + (on ? ' on' : '') }, h('span', { html: icon }), h('small', {}, PatOS.t(label))); b.onclick = fn; tools.appendChild(b); };
        tool('Undo', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2"/></svg>', () => { const u = undo.pop(); if (!u || st.done) return; st.val[u.i] = u.val; st.notes[u.i] = u.notes; sel = u.i; save(); paint(); });
        tool('Erase', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 20H8l-5-5 10-10 8 8-6 7"/><path d="m8 10 6 6"/></svg>', () => { if (sel >= 0 && !st.puz[sel] && (st.val[sel] || st.notes[sel].length)) { undo.push({ i: sel, val: st.val[sel], notes: st.notes[sel].slice() }); st.val[sel] = 0; st.notes[sel] = []; save(); paint(); } });
        tool(notesMode ? 'Notes on' : 'Notes off', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>', () => { notesMode = !notesMode; paint(); }, notesMode);
        tool('Hint', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>', () => {
          if (st.done) return;
          let i = sel >= 0 && !st.puz[sel] && st.val[sel] !== st.sol[sel] ? sel : -1;
          if (i < 0) { const open = []; st.val.forEach((v, k) => { if (v !== st.sol[k]) open.push(k); }); i = open[rnd(open.length)]; }
          if (i == null) return;
          undo.push({ i, val: st.val[i], notes: st.notes[i].slice() }); st.val[i] = st.sol[i]; st.notes[i] = []; st.hints++; sel = i; check(); save(); paint();
        });
        mistakes.textContent = PatOS.t('Mistakes') + ': ' + st.mis;
        clock.textContent = fmt(st.time);
        overlay.innerHTML = '';
        overlay.classList.toggle('on', st.done);
        if (st.done) overlay.append(h('h2', {}, PatOS.t('Solved!')), h('p', {}, PatOS.t(LEVELS[st.level][0]) + ' · ' + fmt(st.time) + (best[st.level] === st.time ? ' · ' + PatOS.t('New best time') : '')), h('button', { class: 'btn primary', onclick: () => newGame(st.level) }, PatOS.t('Play Again')));
      }
      timer = setInterval(() => { if (st && !st.done && !document.hidden) { st.time++; clock.textContent = fmt(st.time); if (st.time % 5 === 0) save(); } }, 1000);
      win.on('closed', () => { clearInterval(timer); save(); });
      win.body.tabIndex = 0;
      win.body.addEventListener('keydown', (e) => {
        if (!st || e.target.tagName === 'SELECT') return;
        const k = e.key;
        if (/^[1-9]$/.test(k)) { set(sel, +k, notesMode !== e.shiftKey); e.preventDefault(); return; }
        if (k === 'Backspace' || k === 'Delete' || k === '0') { tools.children[1].click(); e.preventDefault(); return; }
        if (k === 'n' || k === 'N') { notesMode = !notesMode; paint(); return; }
        if (k === 'z' && (e.ctrlKey || e.metaKey || e.altKey)) { tools.children[0].click(); e.preventDefault(); return; }
        const mv = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
        if (mv) { e.preventDefault(); if (sel < 0) sel = 0; else { const r = Math.floor(sel / 9), c = sel % 9; if (mv === -1) sel = r * 9 + (c + 8) % 9; else if (mv === 1) sel = r * 9 + (c + 1) % 9; else sel = (sel + mv + 81) % 81; } paint(); }
      });
      bNew.onclick = () => newGame(lvl.value);
      lvl.onchange = () => newGame(lvl.value);
      if (st && st.sol) paint(); else newGame('easy');
    }
  });
})();
