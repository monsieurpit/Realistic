/* Games — a game center that works offline: 2048, Snake, Minesweeper, Breakout, Connect Four and Memory,
   plus PatOS's other games (Chess, Sudoku, Solitaire, Tic-Tac-Toe, Orb Runner). Best scores are kept.
   Every game works with the keyboard, the mouse and touch (swipe or tap). */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const tone = (f, d, o) => PatOS.sound.tone(f, d, Object.assign({ vol: 0.08 }, o || {}));
  const svg = (inner, bg) => `<svg viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" rx="14" fill="${bg}"/>${inner}</svg>`;

  PatOS.iconDefs.games = { bg: 'linear-gradient(150deg,#ff2d55,#af52de 55%,#5856d6)', svg: () => '<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M18 22h28a10 10 0 0 1 10 10v4a8 8 0 0 1-14 5l-3-3H25l-3 3a8 8 0 0 1-14-5v-4a10 10 0 0 1 10-10z" fill="#fff"/><path d="M21 28v8M17 32h8" stroke="#5856d6" stroke-width="3.2" stroke-linecap="round"/><circle cx="41" cy="30" r="2.6" fill="#ff2d55"/><circle cx="46" cy="35" r="2.6" fill="#ff9f0a"/></svg>' };

  /* ---------- swipe helper ---------- */
  function onSwipe(el, fn) {
    let s = null;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; s = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => { if (!s) return; const dx = e.clientX - s.x, dy = e.clientY - s.y; s = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); });
  }
  const KEYDIR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };

  /* =================== 2048 =================== */
  function g2048(root, api) {
    const N = 4; let grid, score, won, keepGoing, tiles, idc = 0;
    const board = h('div', { class: 'g2-board' }); const cells = h('div', { class: 'g2-cells' }); for (let i = 0; i < N * N; i++) cells.appendChild(h('div', { class: 'g2-cell' }));
    const layer = h('div', { class: 'g2-layer' }); board.append(cells, layer); root.appendChild(h('div', { class: 'g2-wrap' }, board, h('p', { class: 'gm-hint' }, T('Use the arrow keys or swipe. Tiles with the same number merge.'))));
    function reset() { grid = Array.from({ length: N }, () => Array(N).fill(null)); score = 0; won = false; keepGoing = false; tiles = []; layer.innerHTML = ''; spawn(); spawn(); paint(); api.score(0); }
    function spawn() { const free = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) free.push([r, c]); if (!free.length) return; const [r, c] = free[Math.floor(Math.random() * free.length)]; const t = { id: ++idc, v: Math.random() < 0.9 ? 2 : 4, r, c, isNew: true }; grid[r][c] = t; tiles.push(t); }
    function paint() {
      const live = new Set(tiles.map((t) => t.id));
      layer.querySelectorAll('.g2-tile').forEach((el) => { if (!live.has(+el.dataset.id)) el.remove(); });
      tiles.forEach((t) => {
        let el = layer.querySelector('[data-id="' + t.id + '"]');
        if (!el) { el = h('div', { class: 'g2-tile' + (t.isNew ? ' new' : ''), 'data-id': t.id }); layer.appendChild(el); }
        el.textContent = t.v; el.dataset.v = t.v > 2048 ? 'big' : t.v; el.style.setProperty('--r', t.r); el.style.setProperty('--c', t.c);
        if (t.merged) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
        t.isNew = false; t.merged = false;
      });
    }
    function move(dir) {
      if (api.isOver()) return;
      const vec = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir]; let moved = false;
      const order = [...Array(N).keys()]; const rows = vec[0] === 1 ? order.slice().reverse() : order, cols = vec[1] === 1 ? order.slice().reverse() : order;
      const merged = new Set(); const gone = [];
      rows.forEach((r) => cols.forEach((c) => {
        const t = grid[r][c]; if (!t) return;
        let nr = r, nc = c;
        while (true) { const tr = nr + vec[0], tc = nc + vec[1]; if (tr < 0 || tc < 0 || tr >= N || tc >= N) break; const o = grid[tr][tc]; if (!o) { nr = tr; nc = tc; continue; } if (o.v === t.v && !merged.has(o.id)) { nr = tr; nc = tc; } break; }
        if (nr === r && nc === c) return;
        moved = true; grid[r][c] = null; const o = grid[nr][nc];
        if (o) { o.v *= 2; o.merged = true; merged.add(o.id); score += o.v; t.r = nr; t.c = nc; gone.push(t); if (o.v === 2048 && !won) won = true; }
        else { grid[nr][nc] = t; t.r = nr; t.c = nc; }
      }));
      if (!moved) return;
      tone(merged.size ? 520 : 300, 0.05);
      paint(); // slide, then remove the tiles that merged
      setTimeout(() => { tiles = tiles.filter((t) => !gone.includes(t)); spawn(); paint(); api.score(score); check(); }, 110);
    }
    function check() {
      if (won && !keepGoing) { keepGoing = true; api.message(T('You made 2048!'), T('Keep going'), () => {}); }
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const t = grid[r][c]; if (!t) return; if ((grid[r][c + 1] && grid[r][c + 1].v === t.v) || (grid[r + 1] && grid[r + 1][c] && grid[r + 1][c].v === t.v)) return; }
      api.over(T('No more moves'));
    }
    onSwipe(board, move);
    reset();
    return { key: (e) => { const d = KEYDIR[e.key]; if (d) { e.preventDefault(); move(d); } }, restart: reset };
  }

  /* =================== Snake =================== */
  function snake(root, api) {
    const CW = 26, CH = 18; const cv = h('canvas', { class: 'gm-canvas', width: CW * 24, height: CH * 24 }); const x = cv.getContext('2d');
    root.appendChild(h('div', { class: 'gm-center' }, cv, h('p', { class: 'gm-hint' }, T('Arrow keys or swipe to turn. Space to pause.'))));
    let body, dir, nextDir, food, timer, speed, score, paused;
    function reset() { body = [[8, 9], [7, 9], [6, 9]]; dir = [1, 0]; nextDir = [1, 0]; score = 0; speed = 130; paused = false; place(); api.score(0); clearTimeout(timer); loop(); }
    function place() { do { food = [Math.floor(Math.random() * CW), Math.floor(Math.random() * CH)]; } while (body.some((b) => b[0] === food[0] && b[1] === food[1])); }
    function loop() { timer = setTimeout(() => { if (!paused && !api.isOver() && api.visible()) step(); draw(); if (!api.isOver()) loop(); }, speed); }
    function step() {
      dir = nextDir; const head = [body[0][0] + dir[0], body[0][1] + dir[1]];
      if (head[0] < 0 || head[1] < 0 || head[0] >= CW || head[1] >= CH || body.some((b, i) => i < body.length - 1 && b[0] === head[0] && b[1] === head[1])) { tone(160, 0.3, { type: 'square' }); api.over(T('Game over')); return; }
      body.unshift(head);
      if (head[0] === food[0] && head[1] === food[1]) { score++; api.score(score); tone(660, 0.06); place(); speed = Math.max(55, speed - 3); } else body.pop();
    }
    function draw() {
      const dark = document.documentElement.dataset.theme === 'dark';
      x.fillStyle = dark ? '#121417' : '#eef3e8'; x.fillRect(0, 0, cv.width, cv.height);
      x.fillStyle = dark ? '#171a1e' : '#e4ebdc'; for (let i = 0; i < CW; i++) for (let j = 0; j < CH; j++) if ((i + j) % 2) x.fillRect(i * 24, j * 24, 24, 24);
      x.fillStyle = '#ff375f'; x.beginPath(); x.arc(food[0] * 24 + 12, food[1] * 24 + 12, 8, 0, 7); x.fill();
      body.forEach((b, i) => { x.fillStyle = i ? '#30d158' : '#1fa84a'; const r = 6; const px = b[0] * 24 + 2, py = b[1] * 24 + 2; x.beginPath(); x.roundRect(px, py, 20, 20, r); x.fill(); });
      if (paused) { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#fff'; x.font = '600 28px system-ui'; x.textAlign = 'center'; x.fillText(T('Paused'), cv.width / 2, cv.height / 2); x.textAlign = 'left'; }
    }
    const turn = (d) => { const v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[d]; if (v[0] !== -dir[0] || v[1] !== -dir[1]) nextDir = v; };
    onSwipe(cv, turn);
    reset();
    return { key: (e) => { const d = KEYDIR[e.key]; if (d) { e.preventDefault(); turn(d); } else if (e.key === ' ') { e.preventDefault(); paused = !paused; draw(); } }, restart: reset, destroy: () => clearTimeout(timer), pause: () => { paused = true; draw(); } };
  }

  /* =================== Minesweeper =================== */
  function mines(root, api) {
    const LEVELS = { easy: [9, 9, 10], medium: [16, 16, 40], hard: [16, 30, 99] };
    let level = PatOS.store.get('gmMinesLevel', 'easy'), R, C, M, cells, started, opened, flags, t0, tick, done;
    const bar = h('div', { class: 'gm-seg' }, ...Object.keys(LEVELS).map((k) => { const b = h('button', { class: 'tab' + (k === level ? ' on' : '') }, T(k === 'easy' ? 'Easy' : k === 'medium' ? 'Medium' : 'Hard')); b.onclick = () => { level = k; PatOS.store.set('gmMinesLevel', k); bar.querySelectorAll('.tab').forEach((x2) => x2.classList.toggle('on', x2 === b)); reset(); }; return b; }));
    const info = h('div', { class: 'ms-info' }); const grid = h('div', { class: 'ms-grid' });
    root.appendChild(h('div', { class: 'gm-center' }, bar, info, grid, h('p', { class: 'gm-hint' }, T('Click to open. Right-click or long-press to place a flag. Click a number to open around it.'))));
    function reset() {
      [R, C, M] = LEVELS[level]; cells = []; started = false; opened = 0; flags = 0; done = false; clearInterval(tick); t0 = 0; api.score(0, level);
      grid.innerHTML = ''; grid.style.gridTemplateColumns = 'repeat(' + C + ', var(--ms))'; grid.style.setProperty('--ms', (C > 16 ? 24 : 30) + 'px');
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const el = h('button', { class: 'ms-c', 'aria-label': T('Board square') }); const cell = { r, c, el, mine: false, n: 0, open: false, flag: false }; cells.push(cell); bind(cell); grid.appendChild(el); }
      updInfo();
    }
    const at = (r, c) => (r < 0 || c < 0 || r >= R || c >= C ? null : cells[r * C + c]);
    const around = (cell) => { const o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const n = at(cell.r + dr, cell.c + dc); if (n) o.push(n); } return o; };
    function lay(safe) {
      const avoid = new Set([safe, ...around(safe)]); const pool = cells.filter((x2) => !avoid.has(x2));
      for (let i = 0; i < M; i++) { const k = i + Math.floor(Math.random() * (pool.length - i)); [pool[i], pool[k]] = [pool[k], pool[i]]; pool[i].mine = true; }
      cells.forEach((x2) => { x2.n = around(x2).filter((y) => y.mine).length; });
      started = true; t0 = Date.now(); tick = setInterval(updInfo, 500);
    }
    function updInfo() { const s = t0 ? Math.floor((Date.now() - t0) / 1000) : 0; info.textContent = T('Mines') + ': ' + (M - flags) + '   ·   ' + T('Elapsed') + ': ' + s + ' s'; }
    function openCell(cell) {
      if (done || cell.open || cell.flag) return;
      if (!started) lay(cell);
      if (cell.mine) { cell.el.classList.add('boom'); lose(); return; }
      const stack = [cell];
      while (stack.length) { const k = stack.pop(); if (k.open || k.flag) continue; k.open = true; opened++; k.el.classList.add('open'); if (k.n) { k.el.textContent = k.n; k.el.dataset.n = k.n; } else around(k).forEach((n) => { if (!n.open && !n.mine) stack.push(n); }); }
      tone(440 + Math.min(opened, 40) * 6, 0.03);
      if (opened === R * C - M) win();
    }
    function chord(cell) { if (!cell.open || !cell.n) return; const ar = around(cell); if (ar.filter((x2) => x2.flag).length === cell.n) ar.forEach(openCell); }
    function flag(cell) { if (done || cell.open) return; if (!started) return; cell.flag = !cell.flag; flags += cell.flag ? 1 : -1; cell.el.classList.toggle('flag', cell.flag); tone(cell.flag ? 700 : 500, 0.04); updInfo(); }
    function lose() { done = true; clearInterval(tick); cells.forEach((x2) => { if (x2.mine) x2.el.classList.add('mine'); else if (x2.flag) x2.el.classList.add('wrong'); }); tone(140, 0.4, { type: 'sawtooth' }); api.over(T('Boom! You found a mine.')); }
    function win() { done = true; clearInterval(tick); const s = Math.max(1, Math.round((Date.now() - t0) / 1000)); cells.forEach((x2) => { if (x2.mine) x2.el.classList.add('flag'); }); api.time(s, level); api.over(T('You cleared the board!') + ' ' + s + ' s', true); }
    function bind(cell) {
      let lp = null, longDone = false;
      cell.el.addEventListener('click', () => { if (longDone) { longDone = false; return; } if (cell.open) chord(cell); else openCell(cell); });
      cell.el.addEventListener('contextmenu', (e) => { e.preventDefault(); flag(cell); });
      cell.el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; lp = setTimeout(() => { longDone = true; flag(cell); try { navigator.vibrate && navigator.vibrate(20); } catch (er) {} }, 380); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => cell.el.addEventListener(ev, () => clearTimeout(lp)));
    }
    reset();
    return { restart: reset, destroy: () => clearInterval(tick) };
  }

  /* =================== Breakout =================== */
  function breakout(root, api) {
    const W = 640, H = 480; const cv = h('canvas', { class: 'gm-canvas', width: W, height: H }); const x = cv.getContext('2d');
    root.appendChild(h('div', { class: 'gm-center' }, cv, h('p', { class: 'gm-hint' }, T('Move with the mouse, a finger or the arrow keys. Click or Space to launch.'))));
    let paddle, ball, bricks, lives, score, level, raf, held = false, keys = {}, lastT = 0;
    const COLORS = ['#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#5e5ce6'];
    function build() { bricks = []; const rows = Math.min(6, 3 + level), cols = 10, bw = 58, bh = 18, gap = 4, left = (W - cols * (bw + gap) + gap) / 2; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) bricks.push({ x: left + c * (bw + gap), y: 54 + r * (bh + gap), w: bw, h: bh, color: COLORS[r % COLORS.length], hits: level > 2 && r === 0 ? 2 : 1 }); }
    function resetBall() { ball = { x: paddle.x + paddle.w / 2, y: H - 46, vx: 0, vy: 0, r: 7, stuck: true }; }
    function reset() { level = 1; lives = 3; score = 0; paddle = { x: W / 2 - 50, y: H - 30, w: 100, h: 12 }; build(); resetBall(); api.score(0); }
    function launch() { if (!ball.stuck || api.isOver()) return; const sp = 5 + level * 0.6; const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8; ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp; ball.stuck = false; }
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(2, (t - (lastT || t)) / 16.67); lastT = t;
      if (!api.visible() || api.isOver()) { draw(); return; }
      if (keys.left) paddle.x -= 9 * dt; if (keys.right) paddle.x += 9 * dt; paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
      if (ball.stuck) { ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y - ball.r - 1; draw(); return; }
      const steps = Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 4);
      for (let s = 0; s < steps; s++) {
        ball.x += ball.vx * dt / steps; ball.y += ball.vy * dt / steps;
        if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); tone(300, 0.03); }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); tone(300, 0.03); }
        if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); tone(300, 0.03); }
        if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h && ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
          // where it hits the paddle sets the angle
          const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); const sp = Math.hypot(ball.vx, ball.vy); const a = -Math.PI / 2 + hit * 1.05;
          ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp; ball.y = paddle.y - ball.r; tone(420, 0.04);
        }
        for (const b of bricks) {
          if (b.dead) continue;
          if (ball.x + ball.r < b.x || ball.x - ball.r > b.x + b.w || ball.y + ball.r < b.y || ball.y - ball.r > b.y + b.h) continue;
          const ox = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r)), oy = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
          if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
          if (--b.hits <= 0) { b.dead = true; score += 10 * level; api.score(score); tone(600 + Math.random() * 200, 0.04); } else tone(250, 0.05);
          const sp = Math.hypot(ball.vx, ball.vy); if (sp < 11) { ball.vx *= 1.01; ball.vy *= 1.01; }
          break;
        }
        if (ball.y > H + 20) { lives--; tone(180, 0.3, { type: 'triangle' }); if (lives <= 0) { api.over(T('Game over')); return draw(); } resetBall(); break; }
      }
      if (bricks.every((b) => b.dead)) { level++; tone(880, 0.2); build(); resetBall(); }
      draw();
    }
    function draw() {
      const dark = document.documentElement.dataset.theme === 'dark';
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, dark ? '#101018' : '#1c1c3a'); g.addColorStop(1, dark ? '#05050a' : '#0d0d1f'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      bricks.forEach((b) => { if (b.dead) return; x.fillStyle = b.color; x.globalAlpha = b.hits > 1 ? 1 : 0.92; x.beginPath(); x.roundRect(b.x, b.y, b.w, b.h, 4); x.fill(); if (b.hits > 1) { x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); } });
      x.globalAlpha = 1; x.fillStyle = '#e5e5ea'; x.beginPath(); x.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '600 14px system-ui'; x.fillText(T('Level') + ' ' + level, 14, 26); x.textAlign = 'right'; x.fillText('●'.repeat(Math.max(0, lives)), W - 14, 26); x.textAlign = 'left';
      if (ball.stuck && !api.isOver()) { x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '500 15px system-ui'; x.textAlign = 'center'; x.fillText(T('Click or press Space to launch'), W / 2, H / 2 + 60); x.textAlign = 'left'; }
    }
    const toCanvas = (e) => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; };
    cv.addEventListener('pointermove', (e) => { paddle.x = Math.max(0, Math.min(W - paddle.w, toCanvas(e) - paddle.w / 2)); });
    cv.addEventListener('pointerdown', (e) => { paddle.x = Math.max(0, Math.min(W - paddle.w, toCanvas(e) - paddle.w / 2)); launch(); });
    reset(); raf = requestAnimationFrame(frame);
    return {
      key: (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') { keys.left = e.type === 'keydown'; e.preventDefault(); } if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = e.type === 'keydown'; e.preventDefault(); } if (e.key === ' ' && e.type === 'keydown') { e.preventDefault(); launch(); } },
      keyup: true, restart: reset, destroy: () => cancelAnimationFrame(raf)
    };
  }

  /* =================== Connect Four =================== */
  function connect4(root, api) {
    const R = 6, C = 7; let board, turn, mode = PatOS.store.get('gmC4Mode', 'cpu'), level = PatOS.store.get('gmC4Level', 'medium'), busy = false, over = false;
    const modeSeg = h('div', { class: 'gm-seg' }, ...[['cpu', 'vs Computer'], ['friend', 'vs Friend']].map(([k, l]) => { const b = h('button', { class: 'tab' + (mode === k ? ' on' : '') }, T(l)); b.onclick = () => { mode = k; PatOS.store.set('gmC4Mode', k); modeSeg.querySelectorAll('.tab').forEach((y) => y.classList.toggle('on', y === b)); lvl.style.display = k === 'cpu' ? '' : 'none'; reset(); }; return b; }));
    const lvl = h('select', { class: 'field' }, ...[['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([k, l]) => h('option', { value: k, selected: k === level }, T(l)))); lvl.onchange = () => { level = lvl.value; PatOS.store.set('gmC4Level', level); reset(); }; lvl.style.display = mode === 'cpu' ? '' : 'none';
    const status = h('div', { class: 'c4-status' }); const grid = h('div', { class: 'c4-grid' });
    root.appendChild(h('div', { class: 'gm-center' }, h('div', { class: 'gm-row' }, modeSeg, lvl), status, grid, h('p', { class: 'gm-hint' }, T('Click a column (or press 1 to 7). Line up four in a row to win.'))));
    function reset() {
      board = Array.from({ length: R }, () => Array(C).fill(0)); turn = 1; over = false; busy = false; grid.innerHTML = '';
      for (let c = 0; c < C; c++) { const col = h('button', { class: 'c4-col', 'aria-label': T('Column') + ' ' + (c + 1) }); for (let r = 0; r < R; r++) col.appendChild(h('div', { class: 'c4-hole' })); col.onclick = () => humanPlay(c); grid.appendChild(col); }
      say();
    }
    const say = (txt) => { status.innerHTML = ''; status.append(h('i', { class: 'c4-disc p' + turn }), txt || (mode === 'cpu' ? T(turn === 1 ? 'Your turn' : 'The computer is thinking…') : T(turn === 1 ? 'Red’s turn' : 'Yellow’s turn'))); };
    const drop = (b, c, p) => { for (let r = R - 1; r >= 0; r--) if (!b[r][c]) { b[r][c] = p; return r; } return -1; };
    function lines(b, p) {
      const wins = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = []; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= R || cc < 0 || cc >= C || b[rr][cc] !== p) break; cells.push([rr, cc]); }
        if (cells.length === 4) wins.push(cells);
      }
      return wins;
    }
    function show(r, c, p) { const hole = grid.children[c].children[r]; const d = h('div', { class: 'c4-disc p' + p }); d.style.setProperty('--fall', (r + 1)); hole.appendChild(d); tone(p === 1 ? 330 : 392, 0.06); }
    function play(c) {
      if (over) return false; const r = drop(board, c, turn); if (r < 0) return false; show(r, c, turn);
      const w = lines(board, turn); if (w.length) { over = true; w[0].forEach(([rr, cc]) => grid.children[cc].children[rr].firstChild.classList.add('win')); const who = mode === 'cpu' ? (turn === 1 ? T('You win!') : T('The computer wins')) : (turn === 1 ? T('Red wins!') : T('Yellow wins!')); say(who); if (mode === 'cpu' && turn === 1) api.win(); api.over(who, mode === 'cpu' && turn === 1); return true; }
      if (board[0].every(Boolean)) { over = true; say(T('It’s a draw')); api.over(T('It’s a draw')); return true; }
      turn = 3 - turn; say(); return true;
    }
    // the computer: minimax with alpha-beta, looking a few moves ahead
    function score(b) {
      let s = 0; const center = 3; for (let r = 0; r < R; r++) { if (b[r][center] === 2) s += 3; else if (b[r][center] === 1) s -= 3; }
      const evalW = (w) => { const a = w.filter((v) => v === 2).length, o = w.filter((v) => v === 1).length, e = w.filter((v) => !v).length; if (a === 4) return 1000; if (a === 3 && e === 1) return 5; if (a === 2 && e === 2) return 2; if (o === 3 && e === 1) return -4; return 0; };
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const w = []; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= R || cc < 0 || cc >= C) break; w.push(b[rr][cc]); } if (w.length === 4) s += evalW(w); }
      return s;
    }
    function minimax(b, depth, alpha, beta, max) {
      if (lines(b, 2).length) return [null, 100000 + depth]; if (lines(b, 1).length) return [null, -100000 - depth];
      const moves = [3, 2, 4, 1, 5, 0, 6].filter((c) => !b[0][c]); if (!moves.length) return [null, 0]; if (!depth) return [null, score(b)];
      let best = moves[0];
      if (max) { let v = -Infinity; for (const c of moves) { const nb = b.map((row) => row.slice()); drop(nb, c, 2); const s = minimax(nb, depth - 1, alpha, beta, false)[1]; if (s > v) { v = s; best = c; } alpha = Math.max(alpha, v); if (alpha >= beta) break; } return [best, v]; }
      let v = Infinity; for (const c of moves) { const nb = b.map((row) => row.slice()); drop(nb, c, 1); const s = minimax(nb, depth - 1, alpha, beta, true)[1]; if (s < v) { v = s; best = c; } beta = Math.min(beta, v); if (alpha >= beta) break; } return [best, v];
    }
    function cpu() {
      busy = true;
      setTimeout(() => {
        let c; const moves = [0, 1, 2, 3, 4, 5, 6].filter((k) => !board[0][k]);
        if (level === 'easy' && Math.random() < 0.55) c = moves[Math.floor(Math.random() * moves.length)];
        else c = minimax(board, level === 'hard' ? 6 : 4, -Infinity, Infinity, true)[0];
        if (c == null) c = moves[0];
        play(c); busy = false;
      }, 380);
    }
    function humanPlay(c) { if (busy || over) return; if (mode === 'cpu' && turn !== 1) return; if (play(c) && mode === 'cpu' && !over) cpu(); }
    reset();
    return { key: (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 7) humanPlay(n - 1); }, restart: reset };
  }

  /* =================== Memory =================== */
  function memory(root, api) {
    const SHAPES = ['M32 10l6 14 15 1-12 10 4 15-13-8-13 8 4-15-12-10 15-1z', 'M32 52S12 40 12 25a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 15-20 27-20 27z', 'M32 10l20 22-20 22-20-22z', 'M14 14h36v36H14z', 'M32 10a22 22 0 1 0 .1 0z', 'M32 10l22 40H10z', 'M24 10h16v14h14v16H40v14H24V40H10V24h14z', 'M32 12a20 20 0 1 0 14 34A16 16 0 1 1 32 12z', 'M10 32q11-22 22 0t22 0', 'M20 10h24l10 22-10 22H20L10 32z', 'M32 8l6 18h18l-15 11 6 19-15-12-15 12 6-19L8 26h18z', 'M12 44l10-22 10 12 10-20 10 30z', 'M16 12h32v8H16zM16 28h32v8H16zM16 44h32v8H16z', 'M32 8c10 12 18 20 18 30a18 18 0 0 1-36 0c0-10 8-18 18-30z', 'M8 32h48M32 8v48', 'M20 20h24v24H20zM12 12h40v40H12z', 'M32 14l18 18-18 18-18-18zM32 24l8 8-8 8-8-8z', 'M14 50V30a18 18 0 0 1 36 0v20'];
    const PAL = ['#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#5e5ce6', '#bf5af2', '#ac8e68'];
    let size = PatOS.store.get('gmMemSize', 4), cards, first, lock, moves, found, t0, tick;
    const seg = h('div', { class: 'gm-seg' }, ...[[4, '4 × 4'], [6, '6 × 6']].map(([k, l]) => { const b = h('button', { class: 'tab' + (size === k ? ' on' : '') }, l); b.onclick = () => { size = k; PatOS.store.set('gmMemSize', k); seg.querySelectorAll('.tab').forEach((y) => y.classList.toggle('on', y === b)); reset(); }; return b; }));
    const info = h('div', { class: 'ms-info' }); const grid = h('div', { class: 'mem-grid' });
    root.appendChild(h('div', { class: 'gm-center' }, seg, info, grid, h('p', { class: 'gm-hint' }, T('Turn over two cards at a time and find all the pairs.'))));
    function reset() {
      const pairs = size * size / 2; const pick = SHAPES.slice(0, pairs).map((d, i) => ({ d, color: PAL[i % PAL.length] }));
      const deck = [...pick, ...pick].map((c, i) => Object.assign({ k: i % pairs }, c)).sort(() => Math.random() - 0.5);
      // make the pairs by shape, not position
      deck.forEach((c) => { c.k = SHAPES.indexOf(c.d); });
      first = null; lock = false; moves = 0; found = 0; clearInterval(tick); t0 = 0; grid.innerHTML = ''; grid.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)'; grid.dataset.size = size;
      cards = deck.map((c) => {
        const el = h('button', { class: 'mem-card', 'aria-label': T('Card') }, h('div', { class: 'mem-inner' }, h('div', { class: 'mem-back' }), h('div', { class: 'mem-front', html: '<svg viewBox="0 0 64 64"><path d="' + c.d + '" fill="' + c.color + '" stroke="' + c.color + '" stroke-width="2" stroke-linejoin="round"/></svg>' })));
        const card = Object.assign({ el, open: false, done: false }, c); el.onclick = () => flip(card); grid.appendChild(el); return card;
      });
      api.score(0); upd();
    }
    function upd() { info.textContent = T('Moves') + ': ' + moves + '   ·   ' + T('Pairs') + ': ' + found + ' / ' + (size * size / 2) + (t0 ? '   ·   ' + Math.floor((Date.now() - t0) / 1000) + ' s' : ''); }
    function flip(card) {
      if (lock || card.open || card.done) return;
      if (!t0) { t0 = Date.now(); tick = setInterval(upd, 1000); }
      card.open = true; card.el.classList.add('open'); tone(500, 0.03);
      if (!first) { first = card; return; }
      moves++; const a = first; first = null;
      if (a.k === card.k) { a.done = card.done = true; found++; setTimeout(() => { a.el.classList.add('done'); card.el.classList.add('done'); tone(760, 0.08); }, 250); if (found === size * size / 2) { clearInterval(tick); const s = Math.round((Date.now() - t0) / 1000); setTimeout(() => api.over(T('All pairs found in') + ' ' + moves + ' ' + T('moves') + ' · ' + s + ' s', true), 600); api.moves(moves, size); } }
      else { lock = true; setTimeout(() => { a.open = card.open = false; a.el.classList.remove('open'); card.el.classList.remove('open'); lock = false; }, 800); }
      upd();
    }
    reset();
    return { restart: reset, destroy: () => clearInterval(tick) };
  }

  /* =================== the game center =================== */
  const GAMES = [
    { id: '2048', name: '2048', play: g2048, best: 'high', art: svg('<rect x="10" y="10" width="20" height="20" rx="4" fill="#eee4da"/><rect x="34" y="10" width="20" height="20" rx="4" fill="#f2b179"/><rect x="10" y="34" width="20" height="20" rx="4" fill="#f59563"/><rect x="34" y="34" width="20" height="20" rx="4" fill="#edc22e"/><text x="44" y="49" font-size="10" font-weight="800" text-anchor="middle" fill="#fff" font-family="system-ui">2048</text>', '#bbada0'), desc: 'Slide and merge the tiles to reach 2048.' },
    { id: 'snake', name: 'Snake', play: snake, best: 'high', art: svg('<path d="M14 44h18V30h18" fill="none" stroke="#30d158" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="30" r="5" fill="#1fa84a"/><circle cx="46" cy="16" r="5" fill="#ff375f"/>', '#1c2a1e'), desc: 'Eat, grow, and don’t bite your tail.' },
    { id: 'mines', name: 'Minesweeper', play: mines, best: 'time', art: svg('<g fill="#c7c7cc"><rect x="10" y="10" width="13" height="13" rx="2"/><rect x="25" y="10" width="13" height="13" rx="2"/><rect x="41" y="10" width="13" height="13" rx="2"/><rect x="10" y="26" width="13" height="13" rx="2"/><rect x="10" y="42" width="13" height="13" rx="2"/></g><text x="31" y="36" font-size="13" font-weight="800" fill="#0a84ff" font-family="system-ui">1</text><text x="47" y="36" font-size="13" font-weight="800" fill="#30d158" font-family="system-ui">2</text><circle cx="40" cy="47" r="6" fill="#1d1d1f"/><path d="M40 38v18M31 47h18" stroke="#1d1d1f" stroke-width="2"/>', '#e5e5ea'), desc: 'Open every square without hitting a mine.' },
    { id: 'breakout', name: 'Breakout', play: breakout, best: 'high', art: svg('<g><rect x="8" y="12" width="14" height="6" rx="2" fill="#ff375f"/><rect x="25" y="12" width="14" height="6" rx="2" fill="#ff9f0a"/><rect x="42" y="12" width="14" height="6" rx="2" fill="#ffd60a"/><rect x="8" y="21" width="14" height="6" rx="2" fill="#30d158"/><rect x="42" y="21" width="14" height="6" rx="2" fill="#64d2ff"/></g><circle cx="34" cy="38" r="4" fill="#fff"/><rect x="22" y="50" width="22" height="5" rx="2.5" fill="#e5e5ea"/>', '#1c1c3a'), desc: 'Break all the bricks with the ball.' },
    { id: 'connect4', name: 'Connect Four', play: connect4, best: 'wins', art: svg('<rect x="8" y="12" width="48" height="42" rx="6" fill="#0a60ff"/><g fill="#fff"><circle cx="18" cy="22" r="5"/><circle cx="32" cy="22" r="5"/><circle cx="46" cy="22" r="5"/><circle cx="18" cy="44" r="5" fill="#ff375f"/><circle cx="32" cy="44" r="5" fill="#ffd60a"/><circle cx="46" cy="44" r="5" fill="#ff375f"/><circle cx="18" cy="33" r="5"/><circle cx="32" cy="33" r="5" fill="#ff375f"/><circle cx="46" cy="33" r="5" fill="#ffd60a"/></g>', '#dbe8ff'), desc: 'Line up four discs before the computer does.' },
    { id: 'memory', name: 'Memory', play: memory, best: 'moves', art: svg('<rect x="10" y="12" width="20" height="26" rx="4" fill="#5e5ce6"/><rect x="34" y="12" width="20" height="26" rx="4" fill="#fff"/><path d="M44 18l3 6 6 .5-4.5 4 1.5 6-6-3.5-6 3.5 1.5-6-4.5-4 6-.5z" fill="#ff9f0a"/><rect x="22" y="30" width="20" height="26" rx="4" fill="#bf5af2"/>', '#2c2c54'), desc: 'Find all the pairs with as few moves as you can.' }
  ];
  const OTHERS = ['chess', 'sudoku', 'solitaire', 'tictactoe', 'orbrunner'];

  PatOS.registerApp({
    id: 'games', name: 'Games', icon: 'games', width: 900, height: 680, category: '3D & Games', keywords: 'game games play 2048 snake minesweeper breakout connect four memory arcade jeux jeu',
    about: 'Offline games: 2048, Snake, Minesweeper, Breakout, Connect Four, Memory and more.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'gm-win');
      const bests = () => PatOS.store.get('gamesBest', {}) || {};
      const setBest = (k, v) => { const b = bests(); b[k] = v; PatOS.store.set('gamesBest', b); };
      const bBack = h('button', { class: 'tbtn', title: T('All Games'), 'aria-label': T('All Games') }, '‹');
      const title = h('b', { class: 'gm-title' });
      const scoreEl = h('span', { class: 'gm-score' }), bestEl = h('span', { class: 'gm-best' });
      const bNew = h('button', { class: 'btn' }, T('New Game'));
      win.toolbar.append(bBack, title, h('div', { style: { flex: 1 } }), scoreEl, bestEl, bNew);
      const body = h('div', { class: 'gm-body', tabindex: '0' }); win.body.appendChild(body);
      let cur = null, game = null, isOver = false;
      const visible = () => !document.hidden && PatOS.wm.active === win;
      function bestText(g, sub) {
        const b = bests(); const k = g.id + (sub ? ':' + sub : '');
        if (g.best === 'time') return b[k] ? T('Best') + ': ' + b[k] + ' s' : '';
        if (g.best === 'moves') return b[k] ? T('Best') + ': ' + b[k] + ' ' + T('moves') : '';
        if (g.best === 'wins') return b[k] ? T('Wins') + ': ' + b[k] : '';
        return b[k] ? T('Best') + ': ' + b[k] : '';
      }
      function home() {
        if (game && game.destroy) game.destroy(); game = null; cur = null;
        body.innerHTML = ''; win.setTitle(T('Games')); title.textContent = ''; scoreEl.textContent = ''; bestEl.textContent = ''; bNew.style.display = 'none'; bBack.style.display = 'none';
        const grid = h('div', { class: 'gm-home' });
        GAMES.forEach((g) => {
          const card = h('button', { class: 'gm-card' }, h('div', { class: 'gm-art', html: g.art }), h('div', { class: 'gm-txt' }, h('b', {}, T(g.name)), h('small', {}, T(g.desc)), h('span', { class: 'gm-cbest' }, bestText(g, g.id === 'mines' ? PatOS.store.get('gmMinesLevel', 'easy') : g.id === 'memory' ? PatOS.store.get('gmMemSize', 4) : ''))));
          card.onclick = () => start(g); grid.appendChild(card);
        });
        body.appendChild(h('h2', { class: 'gm-h' }, T('Arcade')));
        body.appendChild(grid);
        const more = OTHERS.filter((id) => PatOS.apps[id]);
        if (more.length) {
          body.appendChild(h('h2', { class: 'gm-h' }, T('More games')));
          body.appendChild(h('div', { class: 'gm-more' }, ...more.map((id) => { const a = PatOS.apps[id]; const b = h('button', { class: 'gm-mini' }, h('div', { class: 'gm-mic', html: PatOS.iconHTML(a.icon || id) }), h('span', {}, T(a.name))); b.onclick = () => PatOS.launch(id); return b; })));
        }
      }
      function start(g) {
        if (game && game.destroy) game.destroy();
        cur = g; isOver = false; body.innerHTML = ''; win.setTitle(T(g.name)); title.textContent = T(g.name); bNew.style.display = ''; bBack.style.display = '';
        const stage = h('div', { class: 'gm-stage' }); body.appendChild(stage);
        let sub = '';
        const api = {
          score: (n, s) => { if (s !== undefined) sub = s; if (g.best === 'high') { scoreEl.textContent = T('Score') + ': ' + n; const b = bests()[g.id] || 0; if (n > b) setBest(g.id, n); } else scoreEl.textContent = ''; bestEl.textContent = bestText(g, sub || (g.id === 'memory' ? PatOS.store.get('gmMemSize', 4) : '')); },
          time: (s, lvl) => { const k = g.id + ':' + lvl; const b = bests()[k]; if (!b || s < b) setBest(k, s); bestEl.textContent = bestText(g, lvl); },
          moves: (m, size) => { const k = g.id + ':' + size; const b = bests()[k]; if (!b || m < b) setBest(k, m); bestEl.textContent = bestText(g, size); },
          win: () => { setBest(g.id, (bests()[g.id] || 0) + 1); bestEl.textContent = bestText(g); },
          isOver: () => isOver, visible,
          over: (text, good) => { if (isOver) return; isOver = true; overlay(text, good); },
          message: (text, btn) => overlay(text, true, btn, true)
        };
        function overlay(text, good, btnLabel, soft) {
          const o = h('div', { class: 'gm-over' + (good ? ' good' : '') }, h('div', { class: 'gm-ocard' }, h('b', {}, text),
            h('div', { class: 'gm-row' }, soft ? h('button', { class: 'btn primary', onclick: () => o.remove() }, btnLabel || T('Continue')) : h('button', { class: 'btn primary', onclick: () => { o.remove(); restart(); } }, T('Play Again')), soft ? null : h('button', { class: 'btn', onclick: home }, T('All Games')))));
          stage.appendChild(o); setTimeout(() => { const b = o.querySelector('.btn.primary'); if (b) b.focus(); }, 50);
        }
        function restart() { stage.querySelectorAll('.gm-over').forEach((o) => o.remove()); isOver = false; game.restart(); body.focus(); }
        bNew.onclick = restart;
        game = g.play(stage, api); body.focus();
      }
      body.addEventListener('keydown', (e) => { if (game && game.key && !e.target.closest('select, input')) game.key(e); });
      body.addEventListener('keyup', (e) => { if (game && game.keyup && game.key) game.key(e); });
      bBack.onclick = home;
      win.on('blur', () => { if (game && game.pause) game.pause(); });
      win.on('closed', () => { if (game && game.destroy) game.destroy(); });
      const pick = args && args.game && GAMES.find((g) => g.id === args.game);
      if (pick) start(pick); else home();
    }
  });
})();
