/* Chess — full rules (castling, en passant, promotion, check, checkmate, stalemate) against the computer or a friend */
(function () {
  'use strict';
  const { h } = PatOS;
  const GLYPH = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };
  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  const PST_P = [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0];
  const PST_N = [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50];
  const CENTER = (i) => { const r = i >> 3, c = i & 7; return 14 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) * 4; };

  function start() {
    const b = Array(64).fill(null); const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) { b[c] = 'b' + back[c]; b[8 + c] = 'bP'; b[48 + c] = 'wP'; b[56 + c] = 'w' + back[c]; }
    return { b, turn: 'w', castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1, half: 0 };
  }
  const opp = (c) => (c === 'w' ? 'b' : 'w');
  function attacked(s, sq, by) {
    const b = s.b, r = sq >> 3, c = sq & 7;
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) { const cc = c + dc; if (pr >= 0 && pr < 8 && cc >= 0 && cc < 8 && b[pr * 8 + cc] === by + 'P') return true; }
    for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === by + 'N') return true; }
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === by + 'K') return true; }
    const rays = (dirs, kinds) => { for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const p = b[rr * 8 + cc]; if (p) { if (p[0] === by && kinds.includes(p[1])) return true; break; } rr += dr; cc += dc; } } return false; };
    return rays([[1, 0], [-1, 0], [0, 1], [0, -1]], 'RQ') || rays([[1, 1], [1, -1], [-1, 1], [-1, -1]], 'BQ');
  }
  function pseudo(s) {
    const out = [], b = s.b, me = s.turn;
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p || p[0] !== me) continue;
      const r = i >> 3, c = i & 7, k = p[1];
      const add = (to, extra) => out.push(Object.assign({ from: i, to }, extra || {}));
      if (k === 'P') {
        const d = me === 'w' ? -1 : 1, r1 = r + d;
        if (r1 >= 0 && r1 < 8 && !b[r1 * 8 + c]) { add(r1 * 8 + c, r1 === 0 || r1 === 7 ? { promo: 'Q' } : null); const sr = me === 'w' ? 6 : 1; if (r === sr && !b[(r + 2 * d) * 8 + c]) add((r + 2 * d) * 8 + c, { double: true }); }
        for (const dc of [-1, 1]) { const cc = c + dc; if (cc < 0 || cc > 7 || r1 < 0 || r1 > 7) continue; const t = r1 * 8 + cc; if (b[t] && b[t][0] !== me) add(t, r1 === 0 || r1 === 7 ? { promo: 'Q' } : null); else if (t === s.ep) add(t, { epCap: true }); }
      } else if (k === 'N' || k === 'K') {
        const ds = k === 'N' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of ds) { const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue; const t = rr * 8 + cc; if (!b[t] || b[t][0] !== me) add(t); }
        if (k === 'K') {
          const row = me === 'w' ? 56 : 0;
          if (i === row + 4 && !attacked(s, i, opp(me))) {
            if (s.castle[me + 'K'] && !b[row + 5] && !b[row + 6] && b[row + 7] === me + 'R' && !attacked(s, row + 5, opp(me)) && !attacked(s, row + 6, opp(me))) add(row + 6, { castle: 'K' });
            if (s.castle[me + 'Q'] && !b[row + 3] && !b[row + 2] && !b[row + 1] && b[row] === me + 'R' && !attacked(s, row + 3, opp(me)) && !attacked(s, row + 2, opp(me))) add(row + 2, { castle: 'Q' });
          }
        }
      } else {
        const ds = k === 'R' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : k === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of ds) { let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const t = rr * 8 + cc; if (b[t]) { if (b[t][0] !== me) add(t); break; } add(t); rr += dr; cc += dc; } }
      }
    }
    return out;
  }
  function make(s, m) {
    const b = s.b.slice(), p = b[m.from], me = s.turn;
    const cap = b[m.to] || (m.epCap ? b[m.to + (me === 'w' ? 8 : -8)] : null);
    b[m.to] = m.promo ? me + m.promo : p; b[m.from] = null;
    if (m.epCap) b[m.to + (me === 'w' ? 8 : -8)] = null;
    if (m.castle) { const row = me === 'w' ? 56 : 0; if (m.castle === 'K') { b[row + 5] = b[row + 7]; b[row + 7] = null; } else { b[row + 3] = b[row]; b[row] = null; } }
    const castle = Object.assign({}, s.castle);
    if (p[1] === 'K') { castle[me + 'K'] = false; castle[me + 'Q'] = false; }
    [[56, 'wQ'], [63, 'wK'], [0, 'bQ'], [7, 'bK']].forEach(([sq, k]) => { if (m.from === sq || m.to === sq) castle[k] = false; });
    return { b, turn: opp(me), castle, ep: m.double ? (m.from + m.to) / 2 : -1, half: p[1] === 'P' || cap ? 0 : s.half + 1, cap };
  }
  function legal(s) { return pseudo(s).filter((m) => { const n = make(s, m); const k = n.b.indexOf(s.turn + 'K'); return !attacked(n, k, n.turn); }); }
  function inCheck(s) { return attacked(s, s.b.indexOf(s.turn + 'K'), opp(s.turn)); }
  function evaluate(s) {
    let v = 0;
    for (let i = 0; i < 64; i++) { const p = s.b[i]; if (!p) continue; const idx = p[0] === 'w' ? i : (7 - (i >> 3)) * 8 + (i & 7); let x = VAL[p[1]] + (p[1] === 'P' ? PST_P[idx] : p[1] === 'N' ? PST_N[idx] : p[1] === 'K' ? 0 : CENTER(i) * (p[1] === 'Q' ? 0.5 : 1)); v += p[0] === 'w' ? x : -x; }
    return v;
  }
  function search(s, depth, a, bt) {
    const ms = legal(s);
    if (!ms.length) return inCheck(s) ? -100000 - depth : 0;
    if (depth === 0) return (s.turn === 'w' ? 1 : -1) * evaluate(s);
    ms.sort((x, y) => (s.b[y.to] ? VAL[s.b[y.to][1]] : 0) - (s.b[x.to] ? VAL[s.b[x.to][1]] : 0));
    let best = -Infinity;
    for (const m of ms) { const v = -search(make(s, m), depth - 1, -bt, -a); if (v > best) best = v; if (v > a) a = v; if (a >= bt) break; }
    return best;
  }
  function bestMove(s, depth) {
    const ms = legal(s); let best = null, bv = -Infinity;
    ms.sort(() => Math.random() - 0.5);
    for (const m of ms) { const v = -search(make(s, m), depth - 1, -Infinity, -bv); if (v > bv) { bv = v; best = m; } }
    return best;
  }
  PatOS.chessEngine = { start, legal, make, inCheck };

  PatOS.registerApp({
    id: 'chess', name: 'Chess', icon: 'chess', width: 640, height: 720, resizable: true, category: '3D & Games', keywords: 'game board strategy play',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let st = start(), hist = [], selSq = -1, moves = [], mode = 'cpu', level = 2, flip = false, last = null, over = false;
      const modeSel = h('select', { class: 'field' }, h('option', { value: 'cpu' }, 'vs Computer'), h('option', { value: 'friend' }, 'vs Friend'));
      const lvl = h('select', { class: 'field' }, h('option', { value: '1' }, 'Easy'), h('option', { value: '2', selected: true }, 'Medium'), h('option', { value: '3' }, 'Hard'));
      const bUndo = h('button', { class: 'tbtn', title: 'Undo' }, '↶'), bFlip = h('button', { class: 'tbtn', title: 'Flip board' }, '⇅'), bNew = h('button', { class: 'btn primary' }, 'New Game');
      win.toolbar.append(modeSel, lvl, h('div', { style: { flex: 1 } }), bUndo, bFlip, bNew);
      const board = h('div', { class: 'ch-board' });
      const status = h('div', { class: 'ch-status' });
      const caps = h('div', { class: 'ch-caps' });
      win.body.appendChild(h('div', { class: 'ch-wrap' }, status, board, caps));
      modeSel.onchange = () => { mode = modeSel.value; lvl.style.display = mode === 'cpu' ? '' : 'none'; reset(); };
      lvl.onchange = () => { level = +lvl.value; };
      function reset() { st = start(); hist = []; selSq = -1; moves = []; last = null; over = false; render(); }
      function render() {
        board.innerHTML = '';
        const legalNow = legal(st);
        const chk = inCheck(st);
        for (let k = 0; k < 64; k++) {
          const i = flip ? 63 - k : k; const r = i >> 3, c = i & 7;
          const p = st.b[i];
          const sq = h('div', { class: 'ch-sq ' + ((r + c) % 2 ? 'd' : 'l') + (i === selSq ? ' sel' : '') + (last && (i === last.from || i === last.to) ? ' last' : '') + (chk && p === st.turn + 'K' ? ' check' : '') });
          if (p) sq.appendChild(h('span', { class: 'ch-pc ' + p[0] }, GLYPH[p]));
          if (moves.some((m) => m.to === i)) sq.appendChild(h('i', { class: st.b[i] ? 'ch-cap' : 'ch-dot' }));
          if ((flip ? r === 0 : r === 7)) sq.appendChild(h('small', { class: 'ch-f' }, 'abcdefgh'[c]));
          if ((flip ? c === 7 : c === 0)) sq.appendChild(h('small', { class: 'ch-r' }, 8 - r));
          sq.onclick = () => click(i);
          board.appendChild(sq);
        }
        const who = st.turn === 'w' ? PatOS.t('White') : PatOS.t('Black');
        if (!legalNow.length) { over = true; status.textContent = chk ? (PatOS.t('Checkmate!') + ' ' + (st.turn === 'w' ? PatOS.t('Black wins') : PatOS.t('White wins'))) : PatOS.t('Stalemate. It’s a draw.'); }
        else if (st.half >= 100) { over = true; status.textContent = PatOS.t('Draw (50-move rule)'); }
        else status.textContent = (mode === 'cpu' && st.turn === 'b' ? PatOS.t('Computer is thinking…') : who + ' ' + PatOS.t('to move')) + (chk ? ' · ' + PatOS.t('Check!') : '');
        const taken = { w: [], b: [] }; hist.forEach((x) => { if (x.cap) taken[x.cap[0]].push(GLYPH[x.cap]); });
        caps.textContent = taken.b.join('') + '   ' + taken.w.join('');
      }
      function click(i) {
        if (over || (mode === 'cpu' && st.turn === 'b')) return;
        const m = moves.find((x) => x.to === i);
        if (m) { play(m); return; }
        if (st.b[i] && st.b[i][0] === st.turn) { selSq = i; moves = legal(st).filter((x) => x.from === i); } else { selSq = -1; moves = []; }
        render();
      }
      function play(m) {
        const n = make(st, m); hist.push({ s: st, cap: n.cap }); st = n; last = m; selSq = -1; moves = [];
        PatOS.sound.tone(n.cap ? 300 : 520, 0.06, { vol: 0.08, type: 'triangle' });
        render();
        if (!over && mode === 'cpu' && st.turn === 'b') setTimeout(() => { const bm = bestMove(st, level); if (bm) play(bm); }, 250);
      }
      bUndo.onclick = () => { if (!hist.length) return; let x = hist.pop(); if (mode === 'cpu' && x.s.turn === 'b' && hist.length) x = hist.pop(); st = x.s; over = false; last = null; selSq = -1; moves = []; render(); };
      bFlip.onclick = () => { flip = !flip; render(); };
      bNew.onclick = reset;
      render();
    }
  });
})();
