/* Game Center (4.1): scores, achievements, leaderboards and the daily challenge, for every PatOS game.
   Games call PatOS.gc.report(game, { score, win, level, time, tile, world, gems, daily }) when a round ends, and
   PatOS.gc.event(game, name) for other moments (a ball bought). Loaded from the start (small), because any game can be
   opened on its own; the Games app shows all of it.
   - Stats and achievements are kept on this device (gcStats, gcAch) and synced like other settings.
   - Leaderboards: Firestore scores/{board}/players/{uid}, one best score each, that only goes up (see firestore.rules).
     Friends are the people you have a conversation with in Messages. Signed out, everything else still works.
   - Daily challenge: the same 2048 for everyone each day (a seed from the date), with its own board. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const store = PatOS.store;

  const GAMES = {
    '2048': { name: '2048', app: 'games', board: true }, snake: { name: 'Snake', app: 'games', board: true }, breakout: { name: 'Breakout', app: 'games', board: true },
    mines: { name: 'Minesweeper', app: 'games' }, connect4: { name: 'Connect Four', app: 'games' }, memory: { name: 'Memory', app: 'games' },
    orbrunner: { name: 'Orb Runner', app: 'orbrunner', board: true }, slither: { name: 'Slither', app: 'slither', board: true },
    chess: { name: 'Chess', app: 'chess' }, sudoku: { name: 'Sudoku', app: 'sudoku' }, solitaire: { name: 'Solitaire', app: 'solitaire' }, tictactoe: { name: 'Tic-Tac-Toe', app: 'tictactoe' }
  };
  const all = () => store.get('gcStats', {}) || {};
  const of = (g) => all()[g] || { plays: 0, best: 0, wins: 0, max: {}, sum: {}, ev: {} };
  const totalPlays = () => Object.values(all()).reduce((n, s) => n + (s.plays || 0), 0);

  /* [id, game, name, how to get it, test(stats of that game)] */
  const ACH = [
    ['first', '', 'First Game', 'Play any game.', () => totalPlays() >= 1],
    ['explorer', '', 'Explorer', 'Play 5 different games.', () => Object.values(all()).filter((s) => s.plays > 0).length >= 5],
    ['regular', '', 'Regular', 'Play 50 games.', () => totalPlays() >= 50],
    ['2048-512', '2048', 'Halfway There', 'Make a 512 tile.', (s) => (s.max.tile || 0) >= 512],
    ['2048-2048', '2048', '2048!', 'Make the 2048 tile.', (s) => (s.max.tile || 0) >= 2048],
    ['snake-25', 'snake', 'Long Snake', 'Score 25 in Snake.', (s) => s.best >= 25],
    ['breakout-500', 'breakout', 'Brick Breaker', 'Score 500 in Breakout.', (s) => s.best >= 500],
    ['mines-win', 'mines', 'Clean Sweep', 'Clear a board.', (s) => s.wins >= 1],
    ['mines-hard', 'mines', 'Bomb Squad', 'Clear a hard board.', (s) => (s.ev.hard || 0) >= 1],
    ['connect4-win', 'connect4', 'Four in a Row', 'Beat the computer.', (s) => s.wins >= 1],
    ['memory-6', 'memory', 'Sharp Memory', 'Finish the 6 × 6 board.', (s) => (s.ev.big || 0) >= 1],
    ['orb-w2', 'orbrunner', 'New World', 'Reach world 2.', (s) => (s.max.world || 0) >= 2],
    ['orb-w5', 'orbrunner', 'Deep Space', 'Reach world 5.', (s) => (s.max.world || 0) >= 5],
    ['orb-w8', 'orbrunner', 'Prism', 'Reach world 8.', (s) => (s.max.world || 0) >= 8],
    ['orb-10k', 'orbrunner', 'Ten Thousand', 'Score 10,000.', (s) => s.best >= 10000],
    ['orb-buy', 'orbrunner', 'New Ball', 'Buy a ball.', (s) => (s.ev.buy || 0) >= 1],
    ['orb-gems', 'orbrunner', 'Gem Hoarder', 'Collect 1,000 gems.', (s) => (s.sum.gems || 0) >= 1000],
    ['slither-150', 'slither', 'Big Snake', 'Reach length 150.', (s) => s.best >= 150],
    ['chess-win', 'chess', 'Checkmate', 'Beat the computer.', (s) => s.wins >= 1],
    ['sudoku-win', 'sudoku', 'Solved', 'Solve a puzzle.', (s) => s.wins >= 1],
    ['sudoku-hard', 'sudoku', 'Logician', 'Solve a hard puzzle.', (s) => (s.ev.hard || 0) >= 1],
    ['solitaire-win', 'solitaire', 'Patience', 'Win a game.', (s) => s.wins >= 1],
    ['ttt-win', 'tictactoe', 'Three in a Row', 'Beat the computer.', (s) => s.wins >= 1],
    ['daily-1', '', 'Daily Player', 'Play a daily challenge.', () => (store.get('gcDailyDays', []) || []).length >= 1],
    ['daily-7', '', 'Seven Days', 'Play 7 daily challenges.', () => (store.get('gcDailyDays', []) || []).length >= 7]
  ];
  const unlocked = () => store.get('gcAch', {}) || {};
  function checkAch(game) {
    const got = unlocked(); const fresh = [];
    ACH.forEach(([id, g, name, , test]) => { if (got[id] || (g && g !== game)) return; try { if (test(of(g || game))) { got[id] = Date.now(); fresh.push(name); } } catch (e) {} });
    if (!fresh.length) return;
    store.set('gcAch', got);
    // one banner, even when a round unlocks several
    PatOS.notify({ title: T(fresh.length > 1 ? 'Achievements unlocked' : 'Achievement unlocked'), body: fresh.map((n) => T(n)).join(' · '), icon: 'games', category: 'games', key: 'gc-ach', open: { app: 'games', args: { page: 'achievements' } } });
    if (PatOS.sound && PatOS.sound.tone) [784, 1046, 1318].forEach((f, k) => PatOS.sound.tone(f, 0.16, { vol: 0.06, delay: k * 0.08 }));
    PatOS.emit && PatOS.emit('gc');
  }

  /* ---------- the daily challenge ---------- */
  const dayId = (d) => { d = d || new Date(); return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const seedOf = (id) => [...('patos-daily-' + id)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

  /* ---------- leaderboards ---------- */
  const me = () => (PatOS.account && PatOS.account.signedIn && PatOS.account.signedIn() && PatOS.account.info()) || null;
  async function cloud() { if (!me() || !PatOS.account.available || !PatOS.account.available()) return null; try { return await PatOS.account.cloud(); } catch (e) { return null; } }
  const pending = () => store.get('gcPending', {}) || {};
  async function flush() {
    const p = pending(); const boards = Object.keys(p); if (!boards.length) return; const F = await cloud(); const m = me(); if (!F || !m) return;
    for (const b of boards) { try { await F.scorePut(b, { uid: m.uid, username: m.username }, p[b]); const q = pending(); if (q[b] === p[b]) { delete q[b]; store.set('gcPending', q); } } catch (e) { if (!/offline|network|unavailable/i.test(String(e.code || e.message))) { const q = pending(); delete q[b]; store.set('gcPending', q); } } }
  }
  function post(board, score) { const p = pending(); if ((p[board] || 0) >= score) return; p[board] = score; store.set('gcPending', p); flush(); }
  const friendIds = () => { try { return (PatOS.chat && PatOS.chat.conversations ? PatOS.chat.conversations() : []).filter((c) => c.status === 'accepted').map((c) => c.other.uid); } catch (e) { return []; } };

  const gc = {
    GAMES, ACH,
    stats: of, allStats: all, totalPlays, unlocked,
    /* a round ended */
    report(game, r) {
      if (!GAMES[game]) return; r = r || {};
      const a = all(); const s = Object.assign({ plays: 0, best: 0, wins: 0, max: {}, sum: {}, ev: {} }, a[game]); s.max = Object.assign({}, s.max); s.sum = Object.assign({}, s.sum); s.ev = Object.assign({}, s.ev);
      const score = Math.max(0, Math.floor(+r.score || 0)); const before = s.best;
      s.plays++; s.last = Date.now(); if (score > s.best) s.best = score; if (r.win) s.wins++;
      ['tile', 'world'].forEach((k) => { if (r[k] > (s.max[k] || 0)) s.max[k] = r[k]; });
      ['gems'].forEach((k) => { if (r[k]) s.sum[k] = (s.sum[k] || 0) + r[k]; });
      if (r.win && r.level === 'hard') s.ev.hard = (s.ev.hard || 0) + 1;
      if (r.win && r.level === 6) s.ev.big = (s.ev.big || 0) + 1;
      a[game] = s; store.set('gcStats', a);
      if (GAMES[game].board && score > 0 && score > before) post(game, score);
      if (r.daily) {
        const days = store.get('gcDailyDays', []) || []; if (!days.includes(r.daily)) store.set('gcDailyDays', days.concat([r.daily]).slice(-400));
        const db = store.get('gcDailyBest', {}) || {}; if (score > (db[r.daily] || 0)) { db[r.daily] = score; store.set('gcDailyBest', db); post(game + '-d' + r.daily, score); }
      }
      checkAch(game); PatOS.emit && PatOS.emit('gc', { game, score, best: s.best, newBest: score > before && before > 0 });
      return { best: s.best, newBest: score > before && before > 0 };
    },
    /* another moment worth counting (a ball bought) */
    event(game, name) { const a = all(); const s = Object.assign({ plays: 0, best: 0, wins: 0, max: {}, sum: {}, ev: {} }, a[game]); s.ev = Object.assign({}, s.ev); s.ev[name] = (s.ev[name] || 0) + 1; a[game] = s; store.set('gcStats', a); checkAch(game); },
    daily: () => { const id = dayId(); return { id, game: '2048', rand: seeded(seedOf(id)), best: (store.get('gcDailyBest', {}) || {})[id] || 0, played: (store.get('gcDailyDays', []) || []).includes(id) }; },
    dayId, seeded,
    /* the boards: everyone's top scores, or you and your friends */
    signedIn: () => !!me(),
    async top(board, n) { const F = await cloud(); if (!F) return null; await flush(); return F.scoreTop(board, n || 50); },
    async friends(board) { const F = await cloud(); const m = me(); if (!F || !m) return null; await flush(); return F.scoreOf(board, friendIds().concat([m.uid])); },
    me, flush
  };
  PatOS.gc = gc;
  addEventListener('online', () => flush());
  PatOS.on && PatOS.on('chat:account', () => setTimeout(flush, 3000));
})();
