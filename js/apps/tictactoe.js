/* Tic-Tac-Toe — vs. computer or a friend */
(function () {
  'use strict';
  const { h } = PatOS;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const winner = (b) => { for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { p: b[a], line: [a, c, d] }; return b.every(Boolean) ? { p: 'draw' } : null; };
  function minimax(b, me, turn) {
    const w = winner(b); if (w) return { s: w.p === me ? 10 : w.p === 'draw' ? 0 : -10 };
    let best = { s: turn === me ? -99 : 99, i: -1 };
    b.forEach((v, i) => { if (v) return; b[i] = turn; const r = minimax(b, me, turn === 'X' ? 'O' : 'X'); b[i] = null; if (turn === me ? r.s > best.s : r.s < best.s) best = { s: r.s, i }; });
    return best;
  }
  PatOS.registerApp({
    id: 'tictactoe', name: 'Tic-Tac-Toe', icon: 'tictactoe', width: 380, height: 500, resizable: false, category: '3D & Games', keywords: 'game xo play',
    launch(win) {
      let board, turn, mode = 'cpu', diff = 'hard', score = PatOS.store.get('tttScore', { X: 0, O: 0, D: 0 }), over;
      const status = h('div', { class: 'ttt-status' });
      const grid = h('div', { class: 'ttt-grid' });
      const sc = h('div', { class: 'ttt-score' });
      const modeSel = h('select', { class: 'field' }, h('option', { value: 'cpu' }, 'vs Computer'), h('option', { value: 'friend' }, 'vs Friend'));
      const diffSel = h('select', { class: 'field' }, h('option', { value: 'hard' }, 'Unbeatable'), h('option', { value: 'easy' }, 'Easy'));
      modeSel.onchange = () => { mode = modeSel.value; diffSel.style.display = mode === 'cpu' ? '' : 'none'; reset(); };
      diffSel.onchange = () => { diff = diffSel.value; reset(); };
      win.body.append(h('div', { class: 'ttt' }, h('div', { class: 'ttt-opts' }, modeSel, diffSel), sc, grid, status, h('button', { class: 'btn primary', onclick: reset }, 'New Game')));
      function reset() { board = Array(9).fill(null); turn = 'X'; over = false; render(); }
      function play(i) {
        if (over || board[i]) return;
        board[i] = turn; PatOS.sound.tone(turn === 'X' ? 600 : 800, 0.08, { vol: 0.08 });
        const w = winner(board);
        if (w) { over = w; score[w.p === 'draw' ? 'D' : w.p]++; PatOS.store.set('tttScore', score); if (w.p !== 'draw') PatOS.sound.pop(); render(); return; }
        turn = turn === 'X' ? 'O' : 'X'; render();
        if (mode === 'cpu' && turn === 'O') setTimeout(() => {
          const empty = board.map((v, j) => (v ? -1 : j)).filter((j) => j >= 0);
          const pick = diff === 'easy' && Math.random() < 0.6 ? empty[Math.floor(Math.random() * empty.length)] : minimax(board.slice(), 'O', 'O').i;
          play(pick);
        }, 350);
      }
      function render() {
        grid.innerHTML = '';
        board.forEach((v, i) => { const c = h('button', { class: 'ttt-cell ' + (v || '') + (over && over.line && over.line.includes(i) ? ' win' : '') }, v || ''); c.onclick = () => { if (mode === 'cpu' && turn === 'O') return; play(i); }; grid.appendChild(c); });
        status.textContent = over ? (over.p === 'draw' ? "It's a draw!" : (mode === 'cpu' ? (over.p === 'X' ? 'You win! 🎉' : 'Computer wins 🤖') : over.p + ' wins! 🎉')) : (mode === 'cpu' ? (turn === 'X' ? 'Your turn (X)' : 'Computer is thinking…') : turn + "'s turn");
        sc.innerHTML = `<span class="X">X ${score.X}</span><span>Draws ${score.D}</span><span class="O">O ${score.O}</span>`;
      }
      reset();
    }
  });
})();
