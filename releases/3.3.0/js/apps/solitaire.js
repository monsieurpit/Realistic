/* Solitaire — classic Klondike patience: drag or tap cards, draw 1 or 3, undo, auto-finish */
(function () {
  'use strict';
  const { h } = PatOS;
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const red = (c) => c.s === 1 || c.s === 2;
  function deal() {
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) deck.push({ s, r, up: false });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const tab = [];
    for (let i = 0; i < 7; i++) { tab.push(deck.splice(0, i + 1)); tab[i][i].up = true; }
    return { stock: deck, waste: [], found: [[], [], [], []], tab, moves: 0, time: 0, won: false };
  }
  PatOS.registerApp({
    id: 'solitaire', name: 'Solitaire', icon: 'solitaire', width: 900, height: 660, category: '3D & Games', keywords: 'cards klondike patience game',
    about: 'Classic Klondike solitaire.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const cfg = Object.assign({ draw: 1 }, PatOS.store.get('solCfg', {}));
      const stats = Object.assign({ played: 0, won: 0, best: 0 }, PatOS.store.get('solStats', {}));
      let g = PatOS.store.get('solGame', null) || deal(), undo = [], sel = null;
      const drawSel = h('select', { class: 'field' }, h('option', { value: 1 }, PatOS.t('Draw 1')), h('option', { value: 3 }, PatOS.t('Draw 3'))); drawSel.value = String(cfg.draw);
      const bNew = h('button', { class: 'btn' }, PatOS.t('New Game')), bUndo = h('button', { class: 'btn' }, PatOS.t('Undo')), bAuto = h('button', { class: 'btn' }, PatOS.t('Finish'));
      const info = h('span', { class: 'sol-info' });
      win.toolbar.append(bNew, drawSel, bUndo, bAuto, h('div', { style: { flex: 1 } }), info);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const table = h('div', { class: 'sol-table' }); win.body.appendChild(table);
      const save = () => PatOS.store.set('solGame', g);
      const snap = () => { undo.push(JSON.stringify(g)); if (undo.length > 200) undo.shift(); };
      const canFound = (c, f) => (f.length ? f[f.length - 1].s === c.s && f[f.length - 1].r === c.r - 1 : c.r === 0);
      const canTab = (c, t) => (t.length ? t[t.length - 1].up && red(t[t.length - 1]) !== red(c) && t[t.length - 1].r === c.r + 1 : c.r === 12);
      function pile(where) { const [k, i] = where; return k === 'waste' ? g.waste : k === 'found' ? g.found[i] : g.tab[i]; }
      function take(where, n) { return pile(where).splice(pile(where).length - n, n); }
      function flipTops() { g.tab.forEach((t) => { if (t.length && !t[t.length - 1].up) t[t.length - 1].up = true; }); }
      function tryMove(from, n, to) {
        const src = pile(from), cards = src.slice(src.length - n), c = cards[0];
        if (!c || !c.up) return false;
        const [k, i] = to;
        if (k === 'found') { if (n !== 1 || !canFound(c, g.found[i])) return false; }
        else if (k === 'tab') { if (from[0] === 'tab' && from[1] === i) return false; if (!canTab(c, g.tab[i])) return false; }
        else return false;
        snap(); pile(to).push(...take(from, n)); g.moves++; flipTops(); after(); return true;
      }
      function autoFound(from) {
        const src = pile(from), c = src[src.length - 1]; if (!c || !c.up) return false;
        for (let i = 0; i < 4; i++) if (canFound(c, g.found[i])) return tryMove(from, 1, ['found', i]);
        for (let i = 0; i < 7; i++) if (canTab(c, g.tab[i]) && !(from[0] === 'tab' && from[1] === i) && g.tab[i].length) return tryMove(from, 1, ['tab', i]);
        return false;
      }
      function drawCard() {
        snap();
        if (!g.stock.length) { g.stock = g.waste.reverse().map((c) => Object.assign(c, { up: false })); g.waste = []; }
        else { const n = Math.min(cfg.draw, g.stock.length); for (let i = 0; i < n; i++) { const c = g.stock.pop(); c.up = true; g.waste.push(c); } }
        g.moves++; PatOS.sound.click(); after();
      }
      function after() {
        sel = null;
        if (!g.won && g.found.every((f) => f.length === 13)) {
          g.won = true; stats.won++; if (!stats.best || g.time < stats.best) stats.best = g.time; PatOS.store.set('solStats', stats);
          [523, 659, 784, 1046, 1318].forEach((f, i) => PatOS.sound.tone(f, 0.3, { delay: i * 0.1, vol: 0.14 }));
        }
        save(); render();
      }
      const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      function cardEl(c, where, n) {
        if (!c.up) return h('div', { class: 'sol-card back' });
        const el = h('div', { class: 'sol-card' + (red(c) ? ' red' : '') + (sel && sel.where[0] === where[0] && sel.where[1] === where[1] && n <= sel.n ? ' sel' : '') },
          h('span', { class: 'sol-tl' }, RANKS[c.r], h('i', {}, SUITS[c.s])), h('span', { class: 'sol-mid' }, c.r > 9 ? RANKS[c.r] : SUITS[c.s]), h('span', { class: 'sol-br' }, RANKS[c.r], h('i', {}, SUITS[c.s])));
        el.dataset.n = n;
        el.addEventListener('pointerdown', (e) => startDrag(e, where, n, el));
        el.addEventListener('dblclick', () => { if (n === 1) autoFound(where); });
        return el;
      }
      function slot(where, cls) {
        const el = h('div', { class: 'sol-slot ' + (cls || '') }); el.dataset.where = where.join(':');
        el.addEventListener('click', (e) => { if (e.target !== el && !e.target.classList.contains('sol-pile')) return; if (sel) { tryMove(sel.where, sel.n, where) || (sel = null, render()); } });
        return el;
      }
      function render() {
        table.innerHTML = '';
        const top = h('div', { class: 'sol-top' });
        const stock = h('div', { class: 'sol-slot stock' + (g.stock.length ? '' : ' empty') }, g.stock.length ? h('div', { class: 'sol-card back' }) : h('span', { class: 'sol-re' }, '↻'));
        stock.onclick = drawCard;
        const waste = slot(['waste', 0], 'waste');
        const show = g.waste.slice(-(cfg.draw === 3 ? 3 : 1));
        show.forEach((c, k) => { const el = k === show.length - 1 ? cardEl(c, ['waste', 0], 1) : h('div', { class: 'sol-card' + (red(c) ? ' red' : '') }, h('span', { class: 'sol-tl' }, RANKS[c.r], h('i', {}, SUITS[c.s]))); el.style.left = k * 18 + 'px'; waste.appendChild(el); });
        top.append(stock, waste, h('div', { class: 'sol-gap' }));
        g.found.forEach((f, i) => { const s = slot(['found', i], 'found'); s.appendChild(h('span', { class: 'sol-fs' }, SUITS[i])); if (f.length) s.appendChild(cardEl(f[f.length - 1], ['found', i], 1)); top.appendChild(s); });
        const tabs = h('div', { class: 'sol-tabs' });
        g.tab.forEach((t, i) => {
          const col = slot(['tab', i], 'tab'); col.classList.add('sol-pile');
          let y = 0;
          t.forEach((c, k) => { const el = cardEl(c, ['tab', i], t.length - k); el.style.top = y + 'px'; y += c.up ? 26 : 9; col.appendChild(el); });
          col.style.minHeight = (y + 120) + 'px';
          tabs.appendChild(col);
        });
        table.append(top, tabs);
        if (g.won) table.appendChild(h('div', { class: 'sol-win' }, h('h2', {}, PatOS.t('You won!')), h('p', {}, fmt(g.time) + ' · ' + g.moves + ' ' + PatOS.t('moves')), h('button', { class: 'btn primary', onclick: newGame }, PatOS.t('Play Again'))));
        info.textContent = PatOS.t('Moves') + ' ' + g.moves + '   ' + fmt(g.time) + '   ' + PatOS.t('Won') + ' ' + stats.won + '/' + stats.played;
        bUndo.disabled = !undo.length;
      }
      /* drag a card (and the ones on top of it) with mouse or finger; a tap selects instead */
      function startDrag(e, where, n, el) {
        if (e.button > 0) return;
        e.stopPropagation();
        const src = pile(where); const startIdx = src.length - n;
        if (!src[startIdx] || !src[startIdx].up) return;
        const sx = e.clientX, sy = e.clientY; let ghost = null;
        const els = [...el.parentNode.querySelectorAll('.sol-card')].filter((x) => +x.dataset.n <= n && x.dataset.n);
        const move = (ev) => {
          const dx = ev.clientX - sx, dy = ev.clientY - sy;
          if (!ghost && Math.hypot(dx, dy) < 6) return;
          if (!ghost) { ghost = true; els.forEach((x) => x.classList.add('drag')); }
          els.forEach((x) => { x.style.transform = `translate(${dx}px, ${dy}px)`; });
        };
        const up = (ev) => {
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
          if (!ghost) { // tap
            if (sel && !(sel.where[0] === where[0] && sel.where[1] === where[1])) { if (!tryMove(sel.where, sel.n, where)) { sel = { where, n }; render(); } }
            else if (sel && sel.n === n) { sel = null; if (!autoFound(where)) render(); }
            else { sel = { where, n }; render(); }
            return;
          }
          els.forEach((x) => { x.style.visibility = 'hidden'; });
          const target = document.elementFromPoint(ev.clientX, ev.clientY);
          els.forEach((x) => { x.style.visibility = ''; });
          const s = target && target.closest('.sol-slot');
          if (s && s.dataset.where) { const [k, i] = s.dataset.where.split(':'); if (tryMove(where, n, [k, +i])) return; }
          render();
        };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      }
      function newGame() { stats.played++; g = deal(); undo = []; PatOS.store.set('solStats', stats); save(); render(); }
      bNew.onclick = newGame;
      drawSel.onchange = () => { cfg.draw = +drawSel.value; PatOS.store.set('solCfg', cfg); render(); };
      bUndo.onclick = () => { if (!undo.length) return; g = JSON.parse(undo.pop()); save(); render(); };
      bAuto.onclick = () => {
        let moved = true, guard = 0;
        const step = () => {
          moved = false;
          for (const from of [['waste', 0], ...g.tab.map((t, i) => ['tab', i])]) { const p = pile(from), c = p[p.length - 1]; if (c && c.up) for (let i = 0; i < 4; i++) if (canFound(c, g.found[i])) { tryMove(from, 1, ['found', i]); moved = true; break; } if (moved) break; }
          if (moved && guard++ < 60) setTimeout(step, 70);
        };
        step();
      };
      const tick = setInterval(() => { if (!g.won && g.moves && !document.hidden) { g.time++; info.textContent = PatOS.t('Moves') + ' ' + g.moves + '   ' + fmt(g.time) + '   ' + PatOS.t('Won') + ' ' + stats.won + '/' + stats.played; if (g.time % 10 === 0) save(); } }, 1000);
      win.on('closed', () => { clearInterval(tick); save(); });
      if (!PatOS.store.get('solGame', null)) { stats.played++; PatOS.store.set('solStats', stats); }
      render();
    }
  });
})();
