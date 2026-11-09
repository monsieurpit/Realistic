/* Slither: steer a glowing snake, eat dots to grow, and trap the other snakes (bots) so they crash into you.
   Everything runs on this device, so it works offline. The world (createWorld) is separate from the drawing, so it can be tested
   by stepping it without a screen. Power-ups: Speed, Magnet, Shield, Double and Far sight. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const TAU = Math.PI * 2;
  const R = 3200; // the arena is a circle with this radius
  const CELL = 160, GW = Math.ceil((2 * R) / CELL) + 2; // the arena is cut in squares so things nearby are found quickly
  const BASE = 2.45, BOOST = 4.7; // distance per tick (60 ticks a second)
  const PELLETS = 5000, POWERUPS = 10;
  const SKINS = [['#ff4d6d', '#ffd1da'], ['#4cc9f0', '#dcf6ff'], ['#80ed99', '#e2ffe8'], ['#ffd166', '#fff1c9'], ['#b388ff', '#efe6ff'], ['#ff9f43', '#ffe5cb'], ['#00e5c3', '#d2fff6'], ['#f1f3f5', '#8e959c']];
  const POWER = {
    speed: { label: 'Speed', color: '#ffd60a', secs: 8 },
    magnet: { label: 'Magnet', color: '#bf5af2', secs: 10 },
    shield: { label: 'Shield', color: '#64d2ff', secs: 8 },
    double: { label: 'Double', color: '#32d74b', secs: 12 },
    zoom: { label: 'Far sight', color: '#ff9f0a', secs: 15 }
  };
  const POWER_KEYS = Object.keys(POWER);
  const LEVELS = {
    easy: { label: 'Easy', bots: 14, think: 14, look: 70, aggr: 0.12, boost: 0.2 },
    normal: { label: 'Normal', bots: 22, think: 8, look: 110, aggr: 0.45, boost: 0.5 },
    hard: { label: 'Hard', bots: 30, think: 4, look: 150, aggr: 0.85, boost: 0.9 }
  };
  const NAMES = ['Viper', 'Noodle', 'Zigzag', 'Mamba', 'Comet', 'Pixel', 'Shadow', 'Lola', 'Rocket', 'Bubbles', 'Ninja', 'Echo', 'Turbo', 'Pip', 'Blaze', 'Mochi', 'Orbit', 'Kiwi', 'Jet', 'Fang', 'Ziggy', 'Nova', 'Sage', 'Tango', 'Wasabi', 'Cobra', 'Mango', 'Pepper', 'Rex', 'Luna', 'Atlas', 'Dash', 'Fizz', 'Sparky', 'Taco', 'Yoyo'];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const cellOf = (x, y) => clamp(Math.floor((y + R) / CELL), 0, GW - 1) * GW + clamp(Math.floor((x + R) / CELL), 0, GW - 1);

  /* ---------- the world (no drawing in here) ---------- */
  function createWorld(opts) {
    opts = opts || {};
    const rnd = opts.random || Math.random;
    const lvl = LEVELS[opts.level] || LEVELS.normal;
    const w = { t: 0, lvl, snakes: [], grid: [], pelletCount: 0, powers: [], respawns: [], player: null, events: [], nextId: 1, sgrid: [], sused: [], names: NAMES.slice(), rnd, R, board: [] };

    const randPoint = (rad) => { const a = rnd() * TAU, d = Math.sqrt(rnd()) * rad; return [Math.cos(a) * d, Math.sin(a) * d]; };
    /* ----- dots ----- */
    function addPellet(x, y, v, color, big) {
      const p = { x, y, v, c: color, r: big ? 5 + Math.min(5, v * 1.2) : 3 + rnd() * 2.2, ph: rnd() * TAU, ci: 0 };
      p.ci = cellOf(x, y); (w.grid[p.ci] || (w.grid[p.ci] = [])).push(p); w.pelletCount++; return p;
    }
    function removePellet(p) { const c = w.grid[p.ci]; const i = c.indexOf(p); if (i >= 0) { c[i] = c[c.length - 1]; c.pop(); w.pelletCount--; } }
    function movePellet(p, x, y) { const c = w.grid[p.ci]; const i = c.indexOf(p); if (i >= 0) { c[i] = c[c.length - 1]; c.pop(); } p.x = x; p.y = y; p.ci = cellOf(x, y); (w.grid[p.ci] || (w.grid[p.ci] = [])).push(p); }
    const pelletColor = () => SKINS[Math.floor(rnd() * SKINS.length)][0];
    const fillPellets = (n) => { for (let i = 0; i < n; i++) { const [x, y] = randPoint(R * 0.97); addPellet(x, y, 1, pelletColor(), false); } };
    /* ----- power-ups ----- */
    function addPower() { const [x, y] = randPoint(R * 0.88); w.powers.push({ type: POWER_KEYS[Math.floor(rnd() * POWER_KEYS.length)], x, y, ph: rnd() * TAU }); }

    /* ----- snakes ----- */
    const dims = (s) => { s.r = 7 + Math.min(16, Math.sqrt(s.mass) * 0.55); s.n = Math.min(700, Math.floor(10 + s.mass * 0.5)); s.gap = s.r * 0.62; };
    function makeSnake(o) {
      const s = { id: w.nextId++, name: o.name, bot: !!o.bot, skin: o.skin, x: o.x, y: o.y, ang: o.ang, want: o.ang, mass: o.mass || 10, boosting: false, px: [], py: [], sx: [], sy: [], alive: true, kills: 0, fx: {}, inv: 150, boostAcc: 0, ai: { tx: o.x, ty: o.y, next: 0, dodge: 0, wobble: rnd() * 6 }, killer: null, reason: '', born: w.t };
      dims(s);
      const steps = Math.ceil((s.n * s.gap) / BASE) + 6;
      for (let i = steps; i >= 0; i--) { s.px.push(s.x - Math.cos(s.ang) * BASE * i); s.py.push(s.y - Math.sin(s.ang) * BASE * i); }
      layout(s); return s;
    }
    function spawnPoint() {
      let best = null, bestD = -1;
      for (let t = 0; t < 10; t++) { const p = randPoint(R * 0.8); let d = 1e9; for (const o of w.snakes) { const dd = Math.hypot(o.x - p[0], o.y - p[1]); if (dd < d) d = dd; } if (d > 500) return p; if (d > bestD) { bestD = d; best = p; } }
      return best;
    }
    function spawnBot() {
      const [x, y] = spawnPoint(); const name = w.names.length ? w.names.splice(Math.floor(rnd() * w.names.length), 1)[0] : NAMES[Math.floor(rnd() * NAMES.length)] + Math.floor(rnd() * 99);
      const s = makeSnake({ name, bot: true, skin: Math.floor(rnd() * SKINS.length), x, y, ang: rnd() * TAU, mass: 10 + Math.floor(rnd() * 25) });
      w.snakes.push(s); return s;
    }
    function spawnPlayer(name, skin) {
      const [x, y] = spawnPoint(); const s = makeSnake({ name: name || 'Pat', bot: false, skin: skin | 0, x, y, ang: Math.atan2(-y, -x), mass: 10 });
      w.snakes.push(s); w.player = s; return s;
    }
    /* the body: one point every s.gap along the path the head has taken */
    function layout(s) {
      const n = s.n, gap = s.gap, px = s.px, py = s.py; let ax = s.x, ay = s.y, carry = 0, k = 1; s.sx[0] = ax; s.sy[0] = ay;
      for (let i = px.length - 1; i >= 0 && k < n; i--) {
        const bx = px[i], by = py[i]; let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
        while (k < n && carry + d >= gap) { const f = (gap - carry) / d; ax += dx * f; ay += dy * f; s.sx[k] = ax; s.sy[k] = ay; k++; dx = bx - ax; dy = by - ay; d = Math.hypot(dx, dy); carry = 0; }
        carry += d; ax = bx; ay = by;
      }
      for (; k < n; k++) { s.sx[k] = ax; s.sy[k] = ay; }
      s.sx.length = n; s.sy.length = n;
    }
    function applyPower(s, type) { const p = POWER[type]; s.fx[type] = Math.min((s.fx[type] || 0) + p.secs, p.secs * 2); if (s === w.player) w.events.push({ type: 'power', power: type }); }

    /* ----- one step of a snake ----- */
    function move(s) {
      const fast = (s.fx.speed || 0) > 0;
      const rate = 0.085 - Math.min(0.045, s.r * 0.0017);
      s.ang += clamp(angDiff(s.want, s.ang), -rate, rate);
      const boosting = fast || (s.boosting && s.mass > 12);
      const sp = fast ? BOOST * 1.08 : boosting ? BOOST : BASE;
      s.x += Math.cos(s.ang) * sp; s.y += Math.sin(s.ang) * sp; s.px.push(s.x); s.py.push(s.y);
      if (boosting && !fast) { s.boostAcc++; if (s.boostAcc >= 7) { s.boostAcc = 0; s.mass = Math.max(10, s.mass - 0.7); addPellet(s.sx[s.n - 1] + (rnd() - 0.5) * 6, s.sy[s.n - 1] + (rnd() - 0.5) * 6, 0.5, SKINS[s.skin][0], false); } }
      s.moving = boosting;
      for (const k in s.fx) { s.fx[k] -= 1 / 60; if (s.fx[k] <= 0) delete s.fx[k]; }
      if (s.inv > 0) s.inv--;
      dims(s);
      const cap = Math.ceil((s.n * s.gap) / (BASE * 0.92)) + 70; if (s.px.length > cap + 80) { s.px.splice(0, s.px.length - cap); s.py.splice(0, s.py.length - cap); }
      layout(s);
    }
    function eat(s) {
      const mag = (s.fx.magnet || 0) > 0, reach = s.r + 9, look = mag ? 270 : reach, c0 = Math.floor((s.x - look + R) / CELL), c1 = Math.floor((s.x + look + R) / CELL), r0 = Math.floor((s.y - look + R) / CELL), r1 = Math.floor((s.y + look + R) / CELL);
      const mult = (s.fx.double || 0) > 0 ? 2 : 1; let got = 0;
      for (let cy = Math.max(0, r0); cy <= Math.min(GW - 1, r1); cy++) for (let cx = Math.max(0, c0); cx <= Math.min(GW - 1, c1); cx++) {
        const cell = w.grid[cy * GW + cx]; if (!cell || !cell.length) continue;
        for (let i = cell.length - 1; i >= 0; i--) {
          const p = cell[i]; const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy);
          if (d < reach) { cell[i] = cell[cell.length - 1]; cell.pop(); w.pelletCount--; s.mass += p.v * mult; got++; }
          else if (mag && d < 270) { const f = Math.min(d, 9) / d; movePellet(p, p.x + dx * f, p.y + dy * f); }
        }
      }
      if (got && s === w.player) w.events.push({ type: 'eat', n: got });
      for (let i = w.powers.length - 1; i >= 0; i--) { const p = w.powers[i]; if (Math.hypot(s.x - p.x, s.y - p.y) < s.r + 18) { applyPower(s, p.type); w.powers.splice(i, 1); w.respawns.push({ at: w.t + 360 + rnd() * 300, power: true }); } }
    }
    /* ----- crashes ----- */
    function buildSegGrid() {
      for (const ci of w.sused) w.sgrid[ci].length = 0; w.sused.length = 0;
      w.snakes.forEach((s, si) => { for (let k = 0; k < s.n; k++) { const ci = cellOf(s.sx[k], s.sy[k]); const c = w.sgrid[ci] || (w.sgrid[ci] = []); if (!c.length) w.sused.push(ci); c.push(si * 2048 + k); } });
    }
    /* the snake (and its segment) that a circle at x,y touches, ignoring one snake */
    function touching(x, y, rad, ignore) {
      const cx = Math.floor((x + R) / CELL), cy = Math.floor((y + R) / CELL);
      for (let yy = Math.max(0, cy - 1); yy <= Math.min(GW - 1, cy + 1); yy++) for (let xx = Math.max(0, cx - 1); xx <= Math.min(GW - 1, cx + 1); xx++) {
        const c = w.sgrid[yy * GW + xx]; if (!c) continue;
        for (let i = 0; i < c.length; i++) {
          const si = (c[i] / 2048) | 0, k = c[i] % 2048, o = w.snakes[si]; if (!o || o === ignore || !o.alive) continue;
          const dx = o.sx[k] - x, dy = o.sy[k] - y, rr = rad + o.r * 0.85; if (dx * dx + dy * dy < rr * rr) return { o, k };
        }
      }
      return null;
    }
    function kill(s, by, reason) {
      if (!s.alive) return; s.alive = false; s.killer = by || null; s.reason = reason; if (by && by !== s) by.kills++;
      const per = Math.max(1.2, (s.mass * 0.8) / Math.max(1, s.n / 2));
      for (let k = 0; k < s.n; k += 2) addPellet(s.sx[k] + (rnd() - 0.5) * 10, s.sy[k] + (rnd() - 0.5) * 10, per, SKINS[s.skin][(k >> 1) % 2 === 0 ? 0 : 1], true);
      if (s === w.player) w.events.push({ type: 'death', reason, killer: by ? by.name : '', mass: Math.floor(s.mass), kills: s.kills });
      else if (by === w.player) w.events.push({ type: 'kill', name: s.name });
      if (s.bot) { w.respawns.push({ at: w.t + 120 + rnd() * 180, bot: true }); w.names.push(s.name); }
    }
    function crashes(s) {
      const d = Math.hypot(s.x, s.y); const shield = (s.fx.shield || 0) > 0;
      if (d > R - s.r * 0.4) { if (shield || s.inv > 0) { s.x *= (R - s.r) / d; s.y *= (R - s.r) / d; } else return kill(s, null, 'wall'); }
      if (s.inv > 0 || shield) return;
      const hit = touching(s.x, s.y, s.r * 0.9, s); if (hit) kill(s, hit.o, 'snake');
    }

    /* ----- bots ----- */
    function danger(s, ang, dist) { // is there a wall or another snake at this spot ahead?
      const x = s.x + Math.cos(ang) * dist, y = s.y + Math.sin(ang) * dist;
      if (Math.hypot(x, y) > R - 70) return 2;
      return touching(x, y, s.r + 4, s) ? 1 : 0;
    }
    function nearestPellet(s, radius) {
      let best = null, bs = 0; const c0 = Math.floor((s.x - radius + R) / CELL), c1 = Math.floor((s.x + radius + R) / CELL), r0 = Math.floor((s.y - radius + R) / CELL), r1 = Math.floor((s.y + radius + R) / CELL);
      for (let cy = Math.max(0, r0); cy <= Math.min(GW - 1, r1); cy++) for (let cx = Math.max(0, c0); cx <= Math.min(GW - 1, c1); cx++) {
        const cell = w.grid[cy * GW + cx]; if (!cell) continue;
        for (let i = 0; i < cell.length; i++) { const p = cell[i], d = Math.hypot(p.x - s.x, p.y - s.y); if (d > radius) continue; const sc = (p.v + 0.3) / (d + 40); if (sc > bs) { bs = sc; best = p; } }
      }
      return best;
    }
    function botThink(s) {
      const a = s.ai, L = lvl; a.next = L.think + Math.floor(rnd() * 4); let boost = false;
      const look = L.look + s.r * 3 + (s.moving ? 60 : 0);
      const mid = danger(s, s.ang, look * 0.55), far = danger(s, s.ang, look), left = danger(s, s.ang - 0.55, look * 0.7), right = danger(s, s.ang + 0.55, look * 0.7);
      if (mid || far) { // turn to the safer side
        const turn = left < right ? -1 : right < left ? 1 : rnd() < 0.5 ? -1 : 1; s.want = s.ang + turn * (mid ? 1.3 : 0.7); a.dodge = 6;
        s.boosting = !!(mid && s.mass > 30 && rnd() < L.boost * 0.5); return;
      }
      if (a.dodge > 0) { a.dodge--; return; }
      const dc = Math.hypot(s.x, s.y);
      let tx = a.tx, ty = a.ty, chosen = false;
      if (dc > R - 320) { tx = 0; ty = 0; chosen = true; }
      if (!chosen) { // run from a bigger snake that is heading my way, or go after a smaller one
        let threat = null, prey = null, pd = 520;
        for (const o of w.snakes) {
          if (o === s || !o.alive) continue; const d = Math.hypot(o.x - s.x, o.y - s.y);
          if (o.mass > s.mass * 1.15 && d < 360 && Math.cos(angDiff(Math.atan2(s.y - o.y, s.x - o.x), o.ang)) > 0.2) { if (!threat || d < threat.d) threat = { o, d }; }
          else if (o.mass < s.mass * 0.8 && s.mass > 28 && d < pd) { pd = d; prey = o; }
        }
        if (threat) { const away = Math.atan2(s.y - threat.o.y, s.x - threat.o.x); tx = s.x + Math.cos(away) * 400; ty = s.y + Math.sin(away) * 400; boost = threat.d < 230 && s.mass > 20; chosen = true; }
        else if (prey && rnd() < L.aggr) { const lead = pd * 0.55 + 60; tx = prey.x + Math.cos(prey.ang) * lead; ty = prey.y + Math.sin(prey.ang) * lead; boost = pd < 300 && rnd() < L.boost; chosen = true; }
      }
      if (!chosen) { let bp = null, bd = 420; for (const p of w.powers) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < bd) { bd = d; bp = p; } } if (bp) { tx = bp.x; ty = bp.y; chosen = true; } }
      if (!chosen) { const p = nearestPellet(s, 420); if (p) { tx = p.x; ty = p.y; chosen = true; } }
      if (!chosen && (Math.hypot(tx - s.x, ty - s.y) < 120 || rnd() < 0.02)) { const q = randPoint(R * 0.75); tx = q[0]; ty = q[1]; }
      a.tx = tx; a.ty = ty; a.wobble += 0.3;
      s.want = Math.atan2(ty - s.y, tx - s.x) + Math.sin(a.wobble) * 0.08; s.boosting = boost;
    }

    /* ----- one tick of the whole world ----- */
    w.step = function () {
      w.t++;
      for (const s of w.snakes) if (s.alive && s.bot && --s.ai.next <= 0) botThink(s);
      for (const s of w.snakes) if (s.alive) move(s);
      buildSegGrid();
      for (const s of w.snakes) if (s.alive) { eat(s); crashes(s); }
      w.snakes = w.snakes.filter((s) => s.alive || s === w.player);
      // new bots and power-ups, and more dots when the arena is getting bare
      for (let i = w.respawns.length - 1; i >= 0; i--) { const r = w.respawns[i]; if (r.at <= w.t) { w.respawns.splice(i, 1); if (r.bot) { if (w.snakes.filter((s) => s.bot && s.alive).length < lvl.bots) spawnBot(); } else if (w.powers.length < POWERUPS) addPower(); } }
      if (w.pelletCount < PELLETS) fillPellets(Math.min(6, PELLETS - w.pelletCount));
      if (w.t % 20 === 0) w.board = w.snakes.filter((s) => s.alive).sort((a, b) => b.mass - a.mass);
    };
    w.spawnPlayer = spawnPlayer; w.pelletsIn = (x0, y0, x1, y1, f) => { for (let cy = Math.max(0, Math.floor((y0 + R) / CELL)); cy <= Math.min(GW - 1, Math.floor((y1 + R) / CELL)); cy++) for (let cx = Math.max(0, Math.floor((x0 + R) / CELL)); cx <= Math.min(GW - 1, Math.floor((x1 + R) / CELL)); cx++) { const c = w.grid[cy * GW + cx]; if (c) for (let i = 0; i < c.length; i++) f(c[i]); } };
    w.addPellet = addPellet; w.addPower = addPower; w.kill = kill; w.applyPower = applyPower; w.layout = layout;
    fillPellets(PELLETS); for (let i = 0; i < POWERUPS; i++) addPower(); for (let i = 0; i < lvl.bots; i++) spawnBot();
    for (let i = 0; i < 40; i++) w.step(); // so the bots are already spread out when you arrive
    return w;
  }

  /* ---------- drawing and the window ---------- */
  const sprites = {};
  function sprite(color) {
    if (sprites[color]) return sprites[color];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(24, 22, 3, 32, 32, 31); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.28, color); gr.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.fill();
    const body = document.createElement('canvas'); body.width = body.height = 64; const b = body.getContext('2d');
    b.fillStyle = color; b.beginPath(); b.arc(32, 32, 31, 0, TAU); b.fill(); b.globalAlpha = 0.5; b.drawImage(c, 0, 0); // a bit of shading
    return (sprites[color] = body);
  }
  const glowSprite = (color) => {
    const k = 'g' + color; if (sprites[k]) return sprites[k];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(0.4, color + '99'); gr.addColorStop(1, color + '00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites[k] = c);
  };
  function icon(g, type, x, y, s) { // a power-up's picture, drawn with lines
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 2.6; g.lineCap = g.lineJoin = 'round';
    if (type === 'speed') { g.beginPath(); g.moveTo(3, -9); g.lineTo(-5, 1); g.lineTo(0, 1); g.lineTo(-3, 9); g.lineTo(5, -2); g.lineTo(0, -2); g.closePath(); g.fill(); }
    else if (type === 'magnet') { g.beginPath(); g.arc(0, 0, 6.5, Math.PI, 0); g.lineTo(6.5, 7); g.moveTo(-6.5, 0); g.lineTo(-6.5, 7); g.stroke(); }
    else if (type === 'shield') { g.beginPath(); g.moveTo(0, -9); g.lineTo(8, -5); g.quadraticCurveTo(8, 5, 0, 10); g.quadraticCurveTo(-8, 5, -8, -5); g.closePath(); g.stroke(); }
    else if (type === 'double') { g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x2', 0, 1); }
    else { g.beginPath(); g.ellipse(0, 0, 9, 5.5, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill(); }
    g.restore();
  }

  PatOS.registerApp({
    id: 'slither', name: 'Slither', icon: 'slither', width: 980, height: 640, dark: true, category: '3D & Games', keywords: 'snake game bots play slither worm io',
    launch(win) {
      const canvas = h('canvas', { class: 'sl-canvas' }); const ctx = canvas.getContext('2d');
      const hud = h('div', { class: 'sl-hud' }), menu = h('div', { class: 'sl-menu' }), over = h('div', { class: 'sl-over hidden' });
      const boostBtn = h('button', { class: 'sl-boost', 'aria-label': T('Boost') }, T('Boost'));
      const stage = h('div', { class: 'sl-stage', tabindex: '0' }, canvas, hud, menu, over, boostBtn); win.body.appendChild(stage);
      const store = PatOS.store;
      const prefs = { name: store.get('slitherName', null) || (PatOS.settings && PatOS.settings.userName) || 'Pat', skin: store.get('slitherSkin', 0), level: store.get('slitherLevel', 'normal'), best: store.get('slitherBest', 0) };
      let world = createWorld({ level: prefs.level }), mode = 'menu', paused = false, raf = 0, last = 0, acc = 0;
      let hudN = 0, cam = { x: 0, y: 0, z: 0.9 }, view = { w: 800, h: 500, dpr: 1 }, pointer = null, keyBoost = false, btnBoost = false, mouseBoost = false, turn = 0, pat = null, banner = null;
      const bigBoard = () => world.board && world.board[0];
      const player = () => world.player;

      /* ----- menu and game over ----- */
      function skinChips() { return SKINS.map((s, i) => { const b = h('button', { class: 'sl-skin' + (i === prefs.skin ? ' on' : ''), style: { background: 'linear-gradient(90deg,' + s[0] + ' 50%,' + s[1] + ' 50%)' }, 'aria-label': T('Skin') + ' ' + (i + 1) }); b.onclick = () => { prefs.skin = i; store.set('slitherSkin', i); [...b.parentNode.children].forEach((x, j) => x.classList.toggle('on', j === i)); }; return b; }); }
      function drawMenu() {
        menu.innerHTML = ''; menu.classList.remove('hidden');
        const name = h('input', { class: 'field sl-name', maxlength: '16', value: prefs.name, placeholder: T('Nickname'), spellcheck: 'false', 'aria-label': T('Nickname') });
        const seg = h('div', { class: 'seg' }, ...Object.keys(LEVELS).map((k) => { const b = h('button', { class: 'tab' + (k === prefs.level ? ' on' : '') }, T(LEVELS[k].label)); b.onclick = () => { prefs.level = k; store.set('slitherLevel', k); world = createWorld({ level: k }); [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); }; return b; }));
        const play = h('button', { class: 'btn primary sl-play' }, T('Play')); play.onclick = () => { prefs.name = name.value.trim() || 'Pat'; store.set('slitherName', prefs.name); start(); };
        name.addEventListener('keydown', (e) => { if (e.key === 'Enter') play.click(); });
        menu.appendChild(h('div', { class: 'sl-card' }, h('h1', {}, 'Slither'), name, h('div', { class: 'sl-skins' }, ...skinChips()), seg, play,
          h('small', { class: 'sl-best' }, T('Best length') + ': ' + prefs.best), h('small', { class: 'sl-help' }, T('Move the mouse to steer. Hold click or Space to boost.'))));
      }
      function start() {
        world = createWorld({ level: prefs.level }); world.spawnPlayer(prefs.name, prefs.skin); mode = 'play'; paused = false; menu.classList.add('hidden'); over.classList.add('hidden'); pointer = null; banner = null; stage.focus(); acc = 0; sync();
      }
      function gameOver(e) {
        mode = 'over'; if (e.mass > prefs.best) { prefs.best = e.mass; store.set('slitherBest', e.mass); }
        PatOS.sound && PatOS.sound.error && PatOS.sound.error();
        over.innerHTML = ''; over.classList.remove('hidden');
        const again = h('button', { class: 'btn primary' }, T('Play Again')); again.onclick = start;
        const back = h('button', { class: 'btn' }, T('Menu')); back.onclick = () => { over.classList.add('hidden'); mode = 'menu'; world = createWorld({ level: prefs.level }); drawMenu(); };
        over.appendChild(h('div', { class: 'sl-card' }, h('h2', {}, e.reason === 'wall' ? T('You hit the wall') : T('You were eaten by') + ' ' + (e.killer || '?')),
          h('div', { class: 'sl-stats' }, h('div', {}, h('b', {}, String(e.mass)), h('span', {}, T('Length'))), h('div', {}, h('b', {}, String(e.kills)), h('span', {}, T('Snakes eaten'))), h('div', {}, h('b', {}, String(prefs.best)), h('span', {}, T('Best length')))),
          h('div', { class: 'sl-btns' }, again, back)));
      }

      /* ----- the loop ----- */
      function frame(now) {
        raf = requestAnimationFrame(frame); if (!win.el.isConnected) return;
        const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
        if (!paused) { acc += dt * 60; let n = 0; while (acc >= 1 && n < 5) { control(); world.step(); acc -= 1; n++; } if (n === 5) acc = 0; events(); }
        draw(now / 1000);
      }
      function control() {
        const p = player(); if (!p || !p.alive || mode !== 'play') return;
        if (turn) p.want = p.ang + turn * 0.5; else if (pointer) { const dx = pointer.x - view.w / 2, dy = pointer.y - view.h / 2; if (dx * dx + dy * dy > 16) p.want = Math.atan2(dy, dx); }
        p.boosting = keyBoost || btnBoost || mouseBoost;
      }
      function events() {
        const list = world.events; if (!list.length) return; world.events = [];
        for (const e of list) {
          if (e.type === 'death' && mode === 'play') gameOver(e);
          else if (e.type === 'power') { banner = { text: T(POWER[e.power].label), color: POWER[e.power].color, t: 1.6 }; PatOS.sound && PatOS.sound.pop && PatOS.sound.pop(); }
          else if (e.type === 'kill') banner = { text: T('You ate') + ' ' + e.name, color: '#ffffff', t: 1.6 };
        }
      }
      function sync() { const r = stage.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 1.5); view = { w: Math.max(200, r.width), h: Math.max(160, r.height), dpr }; canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr); }
      const ro = new ResizeObserver(sync); ro.observe(stage);

      function draw(t) {
        const p = player(); const focus = p && p.alive ? p : (world.board && world.board[0]) || { x: 0, y: 0, mass: 10, fx: {} };
        const targetZ = clamp(1.35 / (1 + focus.mass * 0.0011), 0.42, 1.45) * ((focus.fx.zoom || 0) > 0 && focus === p ? 0.68 : 1) * clamp(view.w / 900, 0.6, 1.2);
        cam.z += (targetZ - cam.z) * 0.06; cam.x += (focus.x - cam.x) * 0.2; cam.y += (focus.y - cam.y) * 0.2;
        const z = cam.z * view.dpr, W = canvas.width, H = canvas.height, ox = W / 2 - cam.x * z, oy = H / 2 - cam.y * z;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
        ctx.setTransform(z, 0, 0, z, ox, oy);
        ctx.fillStyle = 'rgba(255,255,255,.075)'; for (let gx = Math.floor((cam.x - W / 2 / z) / 90) * 90; gx < cam.x + W / 2 / z + 90; gx += 90) for (let gy = Math.floor((cam.y - H / 2 / z) / 90) * 90; gy < cam.y + H / 2 / z + 90; gy += 90) { ctx.beginPath(); ctx.arc(gx, gy, 3, 0, TAU); ctx.fill(); }
        const vx0 = cam.x - W / 2 / z - 60, vx1 = cam.x + W / 2 / z + 60, vy0 = cam.y - H / 2 / z - 60, vy1 = cam.y + H / 2 / z + 60;
        // outside of the arena
        ctx.save(); ctx.beginPath(); ctx.rect(vx0 - 2000, vy0 - 2000, vx1 - vx0 + 4000, vy1 - vy0 + 4000); ctx.arc(0, 0, R, 0, TAU, true); ctx.fillStyle = 'rgba(70,10,24,.62)'; ctx.fill('evenodd'); ctx.restore();
        ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,60,80,.8)'; ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
        // dots
        world.pelletsIn(vx0, vy0, vx1, vy1, (d) => {
          if (d.x < vx0 || d.x > vx1 || d.y < vy0 || d.y > vy1) return;
          const rr = d.r * (1 + Math.sin(t * 3 + d.ph) * 0.12); ctx.globalAlpha = 0.35; ctx.drawImage(glowSprite(d.c), d.x - rr * 2.4, d.y - rr * 2.4, rr * 4.8, rr * 4.8); ctx.globalAlpha = 1; ctx.drawImage(sprite(d.c), d.x - rr, d.y - rr, rr * 2, rr * 2);
        });
        // power-ups
        for (const q of world.powers) {
          if (q.x < vx0 || q.x > vx1 || q.y < vy0 || q.y > vy1) continue;
          const col = POWER[q.type].color, pulse = 1 + Math.sin(t * 4 + q.ph) * 0.12;
          ctx.globalAlpha = 0.6; ctx.drawImage(glowSprite(col), q.x - 46 * pulse, q.y - 46 * pulse, 92 * pulse, 92 * pulse); ctx.globalAlpha = 1;
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, 17 * pulse, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke(); icon(ctx, q.type, q.x, q.y, 0.95);
        }
        // snakes (the smaller ones first, so the big ones are on top)
        const all = world.snakes.filter((s) => s.alive).sort((a, b) => a.mass - b.mass);
        for (const s of all) drawSnake(s, vx0, vx1, vy0, vy1, t);
        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        if (++hudN % 6 === 1) hudDraw(t); if (banner) { banner.t -= 1 / 60; if (banner.t <= 0) banner = null; }
        if (mode === 'menu') { hud.innerHTML = ''; }
      }
      function drawSnake(s, vx0, vx1, vy0, vy1, t) {
        const sk = SKINS[s.skin], a = sprite(sk[0]), b = sprite(sk[1]); const blink = s.inv > 0 && Math.floor(s.inv / 6) % 2 === 0;
        ctx.globalAlpha = blink ? 0.45 : 1;
        if (s.moving) { const g = glowSprite(sk[0]); ctx.globalAlpha = (blink ? 0.45 : 1) * 0.5; for (let k = 0; k < s.n; k += 3) { if (s.sx[k] < vx0 || s.sx[k] > vx1 || s.sy[k] < vy0 || s.sy[k] > vy1) continue; ctx.drawImage(g, s.sx[k] - s.r * 2, s.sy[k] - s.r * 2, s.r * 4, s.r * 4); } ctx.globalAlpha = blink ? 0.45 : 1; }
        for (let k = s.n - 1; k >= 0; k--) {
          const x = s.sx[k], y = s.sy[k]; if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
          const taper = k > s.n * 0.8 ? 0.55 + 0.45 * ((s.n - k) / (s.n * 0.2)) : 1, r = s.r * taper;
          ctx.drawImage(Math.floor(k / 3) % 2 === 0 ? a : b, x - r, y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
        const hx = s.x, hy = s.y, r = s.r, ex = Math.cos(s.ang), ey = Math.sin(s.ang), px = -ey, py = ex;
        if ((s.fx.shield || 0) > 0) { ctx.strokeStyle = 'rgba(100,210,255,.9)'; ctx.fillStyle = 'rgba(100,210,255,.16)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, r * 2.1 + Math.sin(t * 6) * 1.5, 0, TAU); ctx.fill(); ctx.stroke(); }
        if ((s.fx.magnet || 0) > 0) { ctx.strokeStyle = 'rgba(191,90,242,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, 150 + Math.sin(t * 5) * 8, 0, TAU); ctx.stroke(); }
        for (const side of [-1, 1]) {
          const exx = hx + ex * r * 0.35 + px * r * 0.55 * side, eyy = hy + ey * r * 0.35 + py * r * 0.55 * side;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(exx, eyy, r * 0.42, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(exx + ex * r * 0.14, eyy + ey * r * 0.14, r * 0.22, 0, TAU); ctx.fill();
        }
        // the name above the head
        ctx.font = 'bold ' + Math.max(11, r * 0.95) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(s.name, hx, hy - r * 1.9);
      }
      function hudDraw() {
        const p = player(); hud.innerHTML = '';
        if (mode === 'menu') return;
        const rows = (world.board || []).slice(0, 8).map((s) => h('div', { class: 'sl-row' + (s === p ? ' me' : '') }, h('span', {}, s.name), h('b', {}, String(Math.floor(s.mass)))));
        hud.appendChild(h('div', { class: 'sl-board' }, h('div', { class: 'sl-bt' }, T('Leaderboard')), ...rows));
        if (p && p.alive) {
          const rank = (world.board || []).indexOf(p) + 1;
          hud.appendChild(h('div', { class: 'sl-score' }, h('div', {}, T('Length'), ' ', h('b', {}, String(Math.floor(p.mass)))), rank ? h('small', {}, T('Rank') + ' ' + rank + ' / ' + (world.board || []).length) : null, h('small', {}, T('Snakes eaten') + ' ' + p.kills)));
          const fx = Object.keys(p.fx); if (fx.length) hud.appendChild(h('div', { class: 'sl-fx' }, ...fx.map((k) => h('div', { class: 'sl-chip', style: { background: POWER[k].color } }, T(POWER[k].label), ' ', h('b', {}, Math.ceil(p.fx[k]) + 's')))));
          // the minimap: the arena as a circle and the snakes as dots
          const mm = h('canvas', { class: 'sl-map', width: 120, height: 120 }); const g = mm.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(60, 60, 58, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
          const dot = (x, y, c, rr) => { g.fillStyle = c; g.beginPath(); g.arc(60 + (x / R) * 56, 60 + (y / R) * 56, rr, 0, TAU); g.fill(); };
          for (const q of world.powers) dot(q.x, q.y, POWER[q.type].color, 1.8); for (const s of world.snakes) if (s.alive && s !== p) dot(s.x, s.y, 'rgba(255,255,255,.55)', 2); dot(p.x, p.y, '#fff', 3.6); hud.appendChild(mm);
        }
        if (banner) hud.appendChild(h('div', { class: 'sl-banner', style: { color: banner.color } }, banner.text));
        if (paused) hud.appendChild(h('div', { class: 'sl-banner' }, T('Paused')));
      }

      /* ----- input ----- */
      const at = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      canvas.addEventListener('pointermove', (e) => { pointer = at(e); });
      canvas.addEventListener('pointerdown', (e) => { pointer = at(e); if (e.pointerType === 'mouse') mouseBoost = true; stage.focus(); });
      window.addEventListener('pointerup', onUp); function onUp() { mouseBoost = false; }
      boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); btnBoost = true; }); boostBtn.addEventListener('pointerup', () => { btnBoost = false; }); boostBtn.addEventListener('pointerleave', () => { btnBoost = false; });
      const mine = () => win.el.classList.contains('active') && !document.activeElement.matches('input, textarea, select');
      function onKey(e) {
        if (!mine()) return; const down = e.type === 'keydown';
        if (e.key === ' ') { keyBoost = down; e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'a') turn = down ? -1 : (turn === -1 ? 0 : turn);
        else if (e.key === 'ArrowRight' || e.key === 'd') turn = down ? 1 : (turn === 1 ? 0 : turn);
        else if (e.key === 'Escape' && down && mode === 'play') { paused = !paused; }
        else if (e.key === 'Enter' && down && mode === 'over') start();
      }
      window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
      win.on('blur', () => { keyBoost = false; mouseBoost = false; turn = 0; });
      win.on('closed', () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('pointerup', onUp); });
      win._slither = { get world() { return world; }, get mode() { return mode; }, start, prefs, step(n) { for (let i = 0; i < (n || 1); i++) { control(); world.step(); } events(); }, pause(v) { paused = v; }, steer(a) { const p = player(); if (p) p.want = a; }, createWorld };
      drawMenu(); sync(); raf = requestAnimationFrame(frame);
    }
  });
  PatOS.slitherWorld = createWorld;
})();
