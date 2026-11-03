/* Grapher — a graphing calculator for math class.
   Type what you would write on paper:
     y = 2x + 1        x^2 + y^2 = 25       y > x^2 - 4       x = y^2
     r = 2sin(3θ)      f(x) = x^3 - 2x      (3, 4)            a = 2  (a slider)
     2^10 + sqrt(49)   (just a number: the answer shows under it)
   Roots, intercepts, highs and lows and crossing points are marked on the graph (hover or click them).
   A table of values is one click away. The math is read by PatOS's own parser (no eval), with
   implicit multiplication (2x, 3(x+1), x sin x), |x|, n!, degrees or radians. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const COLORS = ['#0a84ff', '#ff375f', '#30d158', '#ff9f0a', '#bf5af2', '#64d2ff', '#ac8e68', '#1d1d1f'];

  /* =================== the math parser =================== */
  const FUNCS = {
    sin: 1, cos: 1, tan: 1, sec: 1, csc: 1, cot: 1, asin: 1, acos: 1, atan: 1, arcsin: 1, arccos: 1, arctan: 1, sinh: 1, cosh: 1, tanh: 1,
    sqrt: 1, cbrt: 1, abs: 1, ln: 1, log: 1, exp: 1, floor: 1, ceil: 1, round: 1, sign: 1, min: 2, max: 2, mod: 2, root: 2, nthroot: 2
  };
  const NAMES = Object.keys(FUNCS).concat(['pi', 'theta', 'tau']).sort((a, b) => b.length - a.length);
  function tokenize(src) {
    const s = String(src).replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt');
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (num && !(num[2] && /[a-z]/i.test(s[i + num[0].length] || ''))) { out.push({ k: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
      if (/[a-zA-Zπθτ]/.test(c)) {
        let j = i; while (j < s.length && /[a-zA-Zπθτ_]/.test(s[j])) j++;
        let word = s.slice(i, j); i = j;
        // split "xsin" into x, sin and "ab" into a, b (like on paper)
        while (word) {
          const low = word.toLowerCase(); const known = NAMES.find((n) => low.startsWith(n));
          if (known) { out.push({ k: 'id', v: known }); word = word.slice(known.length); continue; }
          const ch = word[0]; out.push({ k: 'id', v: ch === 'π' ? 'pi' : ch === 'θ' ? 'theta' : ch === 'τ' ? 'tau' : ch }); word = word.slice(1);
        }
        continue;
      }
      const two = s.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '**') { out.push({ k: 'op', v: two === '**' ? '^' : two }); i += 2; continue; }
      if ('+-*/^(),|!=<>[]'.includes(c)) { out.push({ k: 'op', v: c === '[' ? '(' : c === ']' ? ')' : c }); i++; continue; }
      throw new Error(T('I don’t understand') + ' “' + c + '”');
    }
    return out;
  }
  function parse(src) {
    const tk = tokenize(src); let p = 0; let absDepth = 0;
    const peek = () => tk[p], next = () => tk[p++];
    const isOp = (v) => tk[p] && tk[p].k === 'op' && tk[p].v === v;
    const expect = (v) => { if (!isOp(v)) throw new Error(T('Missing') + ' “' + v + '”'); p++; };
    const startsPrimary = () => { const t = peek(); if (!t) return false; if (t.k === 'num' || t.k === 'id') return true; if (t.k === 'op' && t.v === '(') return true; if (t.k === 'op' && t.v === '|' && absDepth === 0) return true; return false; };
    function primary() {
      const t = next(); if (!t) throw new Error(T('Something is missing at the end'));
      if (t.k === 'num') return { t: 'num', v: t.v };
      if (t.k === 'id') {
        if (FUNCS[t.v]) {
          if (isOp('^') && FUNCS[t.v] === 1) { // sin^2(x) means (sin x)^2
            p++; const pw = unary(); const arg = callArg(); return { t: 'bin', op: '^', a: { t: 'call', f: t.v, args: [arg] }, b: pw };
          }
          if (isOp('(')) { p++; const args = [expr()]; while (isOp(',')) { p++; args.push(expr()); } expect(')'); return { t: 'call', f: t.v, args }; }
          return { t: 'call', f: t.v, args: [power()] }; // sin x
        }
        // a user function f(x)? decided later, when we know the names
        if (isOp('(') && /^[a-z]$/.test(t.v) && !['x', 'y', 'e', 't', 'r'].includes(t.v)) { const save = p; p++; try { const args = [expr()]; while (isOp(',')) { p++; args.push(expr()); } expect(')'); return { t: 'ucall', f: t.v, args }; } catch (e) { p = save; } }
        return { t: 'var', n: t.v };
      }
      if (t.k === 'op' && t.v === '(') {
        const items = [expr()]; while (isOp(',')) { p++; items.push(expr()); } expect(')');
        return items.length > 1 ? { t: 'tuple', items } : items[0];
      }
      if (t.k === 'op' && t.v === '|') { absDepth++; const a = expr(); absDepth--; expect('|'); return { t: 'call', f: 'abs', args: [a] }; }
      throw new Error(T('Unexpected') + ' “' + t.v + '”');
    }
    function callArg() { if (isOp('(')) { p++; const a = expr(); expect(')'); return a; } return power(); }
    function postfix() { let a = primary(); while (isOp('!')) { p++; a = { t: 'call', f: 'fact', args: [a] }; } return a; }
    function power() { const a = postfix(); if (isOp('^')) { p++; return { t: 'bin', op: '^', a, b: unary() }; } return a; }
    function unary() { if (isOp('-')) { p++; return { t: 'neg', a: unary() }; } if (isOp('+')) { p++; return unary(); } return power(); }
    function term() {
      let a = unary();
      for (;;) {
        if (isOp('*') || isOp('/')) { const op = next().v; a = { t: 'bin', op, a, b: unary() }; continue; }
        if (startsPrimary()) { a = { t: 'bin', op: '*', a, b: power() }; continue; } // 2x, x(x+1), 3 sin x
        return a;
      }
    }
    function expr() { let a = term(); while (isOp('+') || isOp('-')) { const op = next().v; a = { t: 'bin', op, a, b: term() }; } return a; }
    // a statement: expression, or expression REL expression
    const left = expr(); let rel = null, right = null;
    if (peek() && peek().k === 'op' && ['=', '<', '>', '<=', '>='].includes(peek().v)) { rel = next().v; right = expr(); }
    if (p < tk.length) throw new Error(T('Unexpected') + ' “' + tk[p].v + '”');
    return { left, rel, right };
  }
  function freeVars(n, out = new Set()) {
    if (!n) return out;
    if (n.t === 'var') out.add(n.n); else if (n.t === 'neg') freeVars(n.a, out); else if (n.t === 'bin') { freeVars(n.a, out); freeVars(n.b, out); }
    else if (n.t === 'call' || n.t === 'ucall') { n.args.forEach((a) => freeVars(a, out)); if (n.t === 'ucall') out.add('fn:' + n.f); } else if (n.t === 'tuple') n.items.forEach((a) => freeVars(a, out));
    return out;
  }
  const fact = (n) => { if (n < 0 || n !== Math.floor(n)) return NaN; if (n > 170) return Infinity; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  // AST → fast JavaScript function of an environment
  function build(n, ctx) {
    switch (n.t) {
      case 'num': { const v = n.v; return () => v; }
      case 'var': {
        const name = n.n;
        if (ctx.locals && name in ctx.locals) { const k = name; return (E) => E.L[k]; }
        if (name === 'pi') return () => Math.PI; if (name === 'tau') return () => 2 * Math.PI;
        if (name === 'e' && !ctx.params.has('e')) return () => Math.E;
        if (name === 'x') return (E) => E.x; if (name === 'y') return (E) => E.y; if (name === 'theta' || name === 't') return (E) => E.t;
        if (ctx.params.has(name)) { const P = ctx.paramVals; return () => P[name]; }
        throw new Error(T('Unknown letter') + ' “' + name + '”');
      }
      case 'neg': { const a = build(n.a, ctx); return (E) => -a(E); }
      case 'bin': {
        const a = build(n.a, ctx), b = build(n.b, ctx);
        if (n.op === '+') return (E) => a(E) + b(E); if (n.op === '-') return (E) => a(E) - b(E);
        if (n.op === '*') return (E) => a(E) * b(E); if (n.op === '/') return (E) => a(E) / b(E);
        // odd roots of negative numbers: (-8)^(1/3) = -2, as on paper
        return (E) => { const x = a(E), y = b(E); if (x < 0 && !Number.isInteger(y)) { const inv = 1 / y; if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2) return -Math.pow(-x, y); } return Math.pow(x, y); };
      }
      case 'call': {
        const args = n.args.map((a) => build(a, ctx)); const a0 = args[0], a1 = args[1]; const deg = () => ctx.deg();
        const tr = (f) => (E) => f(deg() ? a0(E) * Math.PI / 180 : a0(E)); const itr = (f) => (E) => { const v = f(a0(E)); return deg() ? v * 180 / Math.PI : v; };
        const need = FUNCS[n.f] || 1; if (n.f !== 'fact' && n.f !== 'log' && args.length !== need) throw new Error(n.f + ' ' + T('needs') + ' ' + need + ' ' + T(need === 1 ? 'value' : 'values'));
        switch (n.f) {
          case 'sin': return tr(Math.sin); case 'cos': return tr(Math.cos); case 'tan': return tr(Math.tan);
          case 'sec': return tr((v) => 1 / Math.cos(v)); case 'csc': return tr((v) => 1 / Math.sin(v)); case 'cot': return tr((v) => 1 / Math.tan(v));
          case 'asin': case 'arcsin': return itr(Math.asin); case 'acos': case 'arccos': return itr(Math.acos); case 'atan': case 'arctan': return itr(Math.atan);
          case 'sinh': return (E) => Math.sinh(a0(E)); case 'cosh': return (E) => Math.cosh(a0(E)); case 'tanh': return (E) => Math.tanh(a0(E));
          case 'sqrt': return (E) => Math.sqrt(a0(E)); case 'cbrt': return (E) => Math.cbrt(a0(E)); case 'abs': return (E) => Math.abs(a0(E));
          case 'ln': return (E) => Math.log(a0(E)); case 'log': return args.length === 2 ? (E) => Math.log(a1(E)) / Math.log(a0(E)) : (E) => Math.log10(a0(E));
          case 'exp': return (E) => Math.exp(a0(E)); case 'floor': return (E) => Math.floor(a0(E)); case 'ceil': return (E) => Math.ceil(a0(E)); case 'round': return (E) => Math.round(a0(E)); case 'sign': return (E) => Math.sign(a0(E));
          case 'min': return (E) => Math.min(a0(E), a1(E)); case 'max': return (E) => Math.max(a0(E), a1(E)); case 'mod': return (E) => { const m = a1(E); return ((a0(E) % m) + m) % m; };
          case 'root': case 'nthroot': return (E) => { const v = a0(E), k = a1(E); return v < 0 && k % 2 === 1 ? -Math.pow(-v, 1 / k) : Math.pow(v, 1 / k); };
          case 'fact': return (E) => fact(a0(E));
        }
        throw new Error(T('Unknown function') + ' “' + n.f + '”');
      }
      case 'ucall': {
        const def = ctx.funcs[n.f];
        if (!def) { if (n.args.length === 1) return build({ t: 'bin', op: '*', a: { t: 'var', n: n.f }, b: n.args[0] }, ctx); throw new Error(T('Unknown function') + ' “' + n.f + '”'); }
        if ((ctx.depth || 0) > 8) throw new Error(T('A function uses itself'));
        const body = build(def.body, Object.assign({}, ctx, { locals: { [def.param]: 1 }, depth: (ctx.depth || 0) + 1 }));
        const arg = build(n.args[0], ctx);
        return (E) => { const L = Object.assign({}, E.L || {}); L[def.param] = arg(E); return body({ x: def.param === 'x' ? L.x : E.x, y: E.y, t: E.t, L }); };
      }
      case 'tuple': throw new Error(T('A point can’t be used inside a formula'));
    }
    throw new Error(T('Something is wrong'));
  }
  const fmt = (v) => { if (!isFinite(v)) return isNaN(v) ? T('undefined') : (v > 0 ? '∞' : '−∞'); if (Math.abs(v) < 1e-10) return '0'; const a = Math.abs(v); if (a >= 1e9 || a < 1e-4) return v.toExponential(4).replace(/\.?0+e/, 'e'); return String(+v.toPrecision(10)); };
  const fmt3 = (v) => (Math.abs(v) < 5e-7 ? '0' : String(+v.toFixed(3)));

  PatOS.registerApp({
    id: 'grapher', name: 'Grapher', icon: 'grapher', width: 1060, height: 680, category: 'Utilities', keywords: 'graph graphing calculator math function plot algebra equation desmos calculatrice graphique',
    about: 'A graphing calculator: equations, inequalities, circles, sliders, tables, roots and crossing points.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const saved = PatOS.store.get('grapher2', null);
      const old = PatOS.store.get('grapherFns', null);
      let rows = saved && saved.rows ? saved.rows : (old ? old.map((f) => ({ src: f.src, color: f.color, on: f.on })) : [{ src: 'y = x^2 - 3', color: COLORS[0], on: true }, { src: 'y = 2sin(x)', color: COLORS[1], on: true }]);
      rows.forEach((r) => { r.id = r.id || PatOS.uid(); });
      let view = saved && saved.view ? saved.view : { cx: 0, cy: 0, scale: 50 };
      let deg = !!(saved && saved.deg), showGrid = !(saved && saved.grid === false);
      const save = PatOS.debounce(() => PatOS.store.set('grapher2', { rows: rows.map(({ src, color, on, min, max, step, id }) => ({ src, color, on, min, max, step, id })), view, deg, grid: showGrid }), 250);

      const side = h('div', { class: 'gr-side' }), list = h('div', { class: 'gr-list' });
      const cv = h('canvas', { class: 'gr-canvas', tabindex: '0', 'aria-label': T('Graph') }), tip = h('div', { class: 'gr-tip' });
      const tableBox = h('div', { class: 'gr-table hidden' });
      const stage = h('div', { class: 'gr-stage' }, cv, tip, tableBox);
      side.append(list, h('button', { class: 'btn gr-add', onclick: () => addRow('', true) }, '+ ' + T('Add Expression')),
        h('details', { class: 'gr-help' }, h('summary', {}, T('Examples and help')),
          h('div', { class: 'gr-exs' }, ...['y = 2x + 1', 'y = x^2 - 4x + 3', 'x^2 + y^2 = 25', 'y > x^2 - 4', 'y = a x^2 + b', 'r = 3sin(2θ)', 'f(x) = x^3 - 3x', 'y = |x| - 2', 'x = y^2 - 2', '(2, 3)', 'y = sqrt(x)', 'y = 1/x', '5! / 3', 'log(100)'].map((ex) => h('button', { class: 'gr-ex', onclick: () => addRow(ex) }, ex))),
          h('small', {}, T('Write 2x for 2·x, x^2 for x², sqrt(x), |x|, pi or π. Letters like a and b become sliders. Drag to move the graph, scroll or pinch to zoom, click a gray point to see it.'))));
      win.body.appendChild(h('div', { class: 'gr-wrap' }, side, stage));
      const bOut = h('button', { class: 'tbtn', title: T('Zoom out') }, '−'), bIn = h('button', { class: 'tbtn', title: T('Zoom in') }, '+'), bHome = h('button', { class: 'tbtn', title: T('Reset view') }, '⌂');
      const bDeg = h('button', { class: 'tbtn gr-deg', title: T('Degrees or radians') }); const syncDeg = () => { bDeg.textContent = deg ? 'DEG' : 'RAD'; }; syncDeg();
      const bGrid = h('button', { class: 'tbtn' + (showGrid ? ' on' : ''), title: T('Grid'), html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16"/></svg>' });
      const bTable = h('button', { class: 'tbtn', title: T('Table of values'), html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16v14H4zM4 10h16M12 5v14"/></svg>' });
      const bShot = h('button', { class: 'tbtn', title: T('Save picture to Photos'), html: PatOS.sym('camera') });
      win.toolbar.append(h('div', { style: { flex: 1 } }), bDeg, bGrid, bTable, bOut, bIn, bHome, bShot);

      /* ---------- reading every row ---------- */
      let model = [];
      const paramVals = {};
      function analyse() {
        const parsed = rows.map((r) => { try { return { r, st: r.src.trim() ? parse(r.src) : null }; } catch (e) { return { r, err: e.message }; } });
        // functions like f(x) = x^2, and sliders like a = 2
        const funcs = {}; const params = new Set();
        parsed.forEach((m) => {
          const st = m.st; if (!st || st.rel !== '=') return;
          if (st.left.t === 'ucall' && st.left.args.length === 1 && st.left.args[0].t === 'var') { m.kind = 'func'; funcs[st.left.f] = { param: st.left.args[0].n, body: st.right }; return; }
          if (st.left.t === 'var' && /^[a-z]$/i.test(st.left.n) && !['x', 'y', 'r', 't'].includes(st.left.n) && !freeVars(st.right).size && st.left.n !== 'e') { m.kind = 'param'; m.pname = st.left.n; params.add(st.left.n); }
        });
        const ctx = { params, paramVals, funcs, deg: () => deg };
        parsed.forEach((m) => { if (m.kind === 'param') { try { paramVals[m.pname] = build(m.st.right, ctx)({ x: 0, y: 0, t: 0 }); } catch (e) { m.err = e.message; } } });
        const missing = new Set();
        parsed.forEach((m) => {
          if (m.err || !m.st || m.kind === 'param') return;
          const st = m.st;
          try {
            const vars = new Set([...freeVars(st.left), ...(st.right ? freeVars(st.right) : [])]);
            vars.forEach((v) => { if (v.startsWith('fn:') && !funcs[v.slice(3)]) v = v.slice(3); if (/^[a-z]$/i.test(v) && !['x', 'y', 'r', 't', 'e'].includes(v) && !params.has(v) && !(m.kind === 'func' && funcs[st.left.f] && funcs[st.left.f].param === v)) missing.add(v); });
            if (m.kind === 'func') { const d = funcs[st.left.f]; m.fn = build(st.right, Object.assign({}, ctx, { locals: { [d.param]: 1 } })); const fn = m.fn; m.f = (x) => fn({ x: d.param === 'x' ? x : 0, y: 0, t: 0, L: { [d.param]: x } }); m.plot = 'y'; m.label = st.left.f + '(' + d.param + ')'; return; }
            if (!st.rel) {
              if (st.left.t === 'tuple') { if (st.left.items.length !== 2) throw new Error(T('A point needs two numbers')); m.plot = 'point'; m.pt = st.left.items.map((it) => build(it, ctx)({ x: 0, y: 0, t: 0 })); return; }
              const fv = freeVars(st.left);
              if (fv.has('y')) throw new Error(T('Add “= …” to make an equation'));
              const fn = build(st.left, ctx);
              if (fv.has('x')) { m.plot = 'y'; m.f = (x) => fn({ x, y: 0, t: 0 }); return; }
              m.value = fn({ x: 0, y: 0, t: 0 }); return;
            }
            const L = st.left, R = st.right; const lv = freeVars(L), rv = freeVars(R);
            if (st.rel === '=' && L.t === 'var' && L.n === 'y' && !rv.has('y')) { const fn = build(R, ctx); m.plot = 'y'; m.f = (x) => fn({ x, y: 0, t: 0 }); return; }
            if (st.rel === '=' && R.t === 'var' && R.n === 'y' && !lv.has('y')) { const fn = build(L, ctx); m.plot = 'y'; m.f = (x) => fn({ x, y: 0, t: 0 }); return; }
            if (st.rel === '=' && L.t === 'var' && L.n === 'x' && !rv.has('x')) { const fn = build(R, ctx); m.plot = 'x'; m.g = (y) => fn({ x: 0, y, t: 0 }); return; }
            if (st.rel === '=' && L.t === 'var' && L.n === 'r') { const fn = build(R, ctx); m.plot = 'polar'; m.polar = (t) => fn({ x: 0, y: 0, t }); return; }
            if (st.rel !== '=' && L.t === 'var' && L.n === 'y' && !rv.has('y')) { const fn = build(R, ctx); m.plot = 'yineq'; m.rel = st.rel; m.f = (x) => fn({ x, y: 0, t: 0 }); return; }
            const fl = build(L, ctx), fr = build(R, ctx);
            const F = (x, y) => fl({ x, y, t: 0 }) - fr({ x, y, t: 0 });
            if (!lv.has('x') && !lv.has('y') && !rv.has('x') && !rv.has('y')) { const a = fl({ x: 0, y: 0, t: 0 }), b = fr({ x: 0, y: 0, t: 0 }); m.value = { '=': Math.abs(a - b) < 1e-9, '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b }[st.rel] ? T('true') : T('false'); return; }
            m.plot = st.rel === '=' ? 'implicit' : 'ineq'; m.rel = st.rel; m.F = F;
          } catch (e) { m.err = e.message; }
        });
        model = parsed; return { missing: [...missing].filter((v) => !params.has(v)) };
      }

      /* ---------- the list on the left ---------- */
      function addRow(src, focus, after) {
        const r = { id: PatOS.uid(), src: src || '', color: COLORS[rows.length % COLORS.length], on: true };
        const i = after != null ? after + 1 : rows.length; rows.splice(i, 0, r); save(); renderList();
        if (focus || !src) setTimeout(() => { const inp = list.querySelector('[data-id="' + r.id + '"] .gr-in'); if (inp) inp.focus(); }, 0);
        draw(); return r;
      }
      function renderList(keepFocusId) {
        const { missing } = analyse();
        const active = document.activeElement && document.activeElement.closest && document.activeElement.closest('.gr-row');
        const focusId = keepFocusId || (active && active.dataset.id); const caret = active && document.activeElement.selectionStart;
        list.innerHTML = '';
        model.forEach((m, i) => {
          const r = m.r;
          const inp = h('input', { class: 'gr-in' + (m.err ? ' err' : ''), value: r.src, spellcheck: 'false', autocomplete: 'off', placeholder: T('Type an equation, like y = 2x + 1'), 'aria-label': T('Expression') + ' ' + (i + 1) });
          inp.oninput = () => { r.src = inp.value; save(); refresh(r.id); };
          inp.addEventListener('focus', () => select(r.id));
          inp.onkeydown = (e) => {
            const all = [...list.querySelectorAll('.gr-in')]; const k = all.indexOf(inp);
            if (e.key === 'Enter') { e.preventDefault(); addRow('', true, i); }
            else if (e.key === 'Backspace' && !inp.value && rows.length > 1) { e.preventDefault(); rows.splice(i, 1); save(); renderList(); const prev = list.querySelectorAll('.gr-in')[Math.max(0, k - 1)]; if (prev) prev.focus(); draw(); }
            else if (e.key === 'ArrowDown' && all[k + 1]) { e.preventDefault(); all[k + 1].focus(); }
            else if (e.key === 'ArrowUp' && all[k - 1]) { e.preventDefault(); all[k - 1].focus(); }
          };
          const plots = !!m.plot;
          const dot = h('button', { class: 'gr-dot' + (r.on && plots ? '' : ' off'), style: { background: plots ? r.color : 'transparent', borderColor: r.color }, title: T('Show or hide'), disabled: !plots }); dot.onclick = () => { r.on = !r.on; save(); renderList(); draw(); };
          dot.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu(COLORS.map((c) => ({ label: '●  ' + c, checked: r.color === c, action: () => { r.color = c; save(); renderList(); draw(); } })), e.clientX, e.clientY); };
          const del = h('button', { class: 'tbtn gr-del', title: T('Remove') }, '×'); del.onclick = () => { rows.splice(i, 1); if (!rows.length) rows.push({ id: PatOS.uid(), src: '', color: COLORS[0], on: true }); save(); renderList(); draw(); };
          const extra = [];
          if (m.err && r.src.trim()) extra.push(h('div', { class: 'gr-err' }, m.err));
          else if (m.value !== undefined) extra.push(h('div', { class: 'gr-val' }, '= ' + (typeof m.value === 'number' ? fmt(m.value) : m.value)));
          else if (m.kind === 'param') extra.push(slider(m));
          else if (m.plot === 'point') extra.push(h('div', { class: 'gr-val' }, '(' + fmt3(m.pt[0]) + ', ' + fmt3(m.pt[1]) + ')'));
          const row = h('div', { class: 'gr-row' + (m.err && r.src.trim() ? ' bad' : '') + (r.id === selectedId ? ' sel' : ''), 'data-id': r.id }, h('div', { class: 'gr-line' }, h('span', { class: 'gr-num' }, String(i + 1)), dot, inp, del), ...extra);
          list.appendChild(row);
        });
        if (missing.length) list.appendChild(h('div', { class: 'gr-missing' }, T('Add a slider for') + ': ', ...missing.map((v) => h('button', { class: 'btn gr-addp', onclick: () => { addRow(v + ' = 1'); } }, v))));
        if (focusId) { const inp = list.querySelector('[data-id="' + focusId + '"] .gr-in'); if (inp) { inp.focus(); try { if (caret != null) inp.setSelectionRange(caret, caret); } catch (e) {} } }
        if (tableFor && !rows.includes(tableFor)) closeTable(); else if (tableFor) drawTable();
      }
      const refresh = PatOS.debounce((id) => { renderList(id); draw(); }, 120);
      function slider(m) {
        const r = m.r; const v = paramVals[m.pname];
        const min = r.min != null ? r.min : Math.min(-10, Math.floor(v)), max = r.max != null ? r.max : Math.max(10, Math.ceil(v)), step = r.step || 0.1;
        const rng = h('input', { type: 'range', min, max, step, value: v, class: 'gr-range', 'aria-label': m.pname });
        const set = (val) => { val = +(+val).toFixed(4); r.src = m.pname + ' = ' + val; save(); paramVals[m.pname] = val; const inp = list.querySelector('[data-id="' + r.id + '"] .gr-in'); if (inp) inp.value = r.src; gridKey = ''; draw(); marksSoon(); if (tableFor) drawTable(); };
        rng.oninput = () => set(rng.value);
        const lo = h('input', { class: 'gr-lim', value: min, 'aria-label': T('Lowest') }), hi = h('input', { class: 'gr-lim', value: max, 'aria-label': T('Highest') });
        lo.onchange = () => { r.min = +lo.value; rng.min = r.min; save(); }; hi.onchange = () => { r.max = +hi.value; rng.max = r.max; save(); };
        let playing = null; const play = h('button', { class: 'tbtn gr-play', title: T('Play') }, '▶');
        play.onclick = () => {
          if (playing) { cancelAnimationFrame(playing); playing = null; play.textContent = '▶'; return; }
          play.textContent = '❚❚'; let dir = 1; const tick = () => { let val = +rng.value + dir * (+rng.max - +rng.min) / 240; if (val >= +rng.max) { val = +rng.max; dir = -1; } if (val <= +rng.min) { val = +rng.min; dir = 1; } rng.value = val; set(val); if (play.isConnected) playing = requestAnimationFrame(tick); }; playing = requestAnimationFrame(tick);
        };
        return h('div', { class: 'gr-slider' }, play, lo, rng, hi);
      }

      /* ---------- drawing ---------- */
      let W = 0, H = 0, marks = [], pinned = null, hover = null;
      let selectedId = (rows.find((r) => r.src.trim()) || {}).id || null;
      function select(id) { if (selectedId === id) return; selectedId = id; pinned = null; list.querySelectorAll('.gr-row').forEach((el) => el.classList.toggle('sel', el.dataset.id === id)); findMarks(); draw(); }
      const toX = (wx) => W / 2 + (wx - view.cx) * view.scale, toY = (wy) => H / 2 - (wy - view.cy) * view.scale;
      const fromX = (px) => (px - W / 2) / view.scale + view.cx, fromY = (py) => view.cy - (py - H / 2) / view.scale;
      const safe = (f, a) => { try { const v = f(a); return typeof v === 'number' ? v : NaN; } catch (e) { return NaN; } };
      let gridKey = '';
      function draw() {
        gridKey = '';
        const dpr = Math.min(2, window.devicePixelRatio || 1); W = stage.clientWidth; H = stage.clientHeight; if (!W || !H) return;
        cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
        const dark = document.documentElement.dataset.theme === 'dark';
        x.fillStyle = dark ? '#16161a' : '#ffffff'; x.fillRect(0, 0, W, H);
        const raw = 90 / view.scale, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw);
        if (showGrid) {
          x.lineWidth = 1;
          const minor = step / 5;
          if (minor * view.scale > 8) { x.strokeStyle = dark ? '#1f1f24' : '#f4f4f7'; x.beginPath(); for (let gx = Math.floor(fromX(0) / minor) * minor; gx <= fromX(W); gx += minor) { x.moveTo(Math.round(toX(gx)) + 0.5, 0); x.lineTo(Math.round(toX(gx)) + 0.5, H); } for (let gy = Math.floor(fromY(H) / minor) * minor; gy <= fromY(0); gy += minor) { x.moveTo(0, Math.round(toY(gy)) + 0.5); x.lineTo(W, Math.round(toY(gy)) + 0.5); } x.stroke(); }
          x.strokeStyle = dark ? '#2c2c33' : '#e2e2e8'; x.beginPath(); for (let gx = Math.floor(fromX(0) / step) * step; gx <= fromX(W); gx += step) { x.moveTo(Math.round(toX(gx)) + 0.5, 0); x.lineTo(Math.round(toX(gx)) + 0.5, H); } for (let gy = Math.floor(fromY(H) / step) * step; gy <= fromY(0); gy += step) { x.moveTo(0, Math.round(toY(gy)) + 0.5); x.lineTo(W, Math.round(toY(gy)) + 0.5); } x.stroke();
        }
        // axes and numbers
        x.strokeStyle = dark ? '#9a9aa2' : '#3a3a3c'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, toY(0)); x.lineTo(W, toY(0)); x.moveTo(toX(0), 0); x.lineTo(toX(0), H); x.stroke();
        x.font = '11px system-ui, sans-serif'; x.fillStyle = dark ? '#9a9aa2' : '#6b6b70';
        const lab = (v) => { const s = +v.toPrecision(6); return Math.abs(s) >= 1e6 || (Math.abs(s) < 1e-3 && s) ? s.toExponential(1) : String(s); };
        x.textAlign = 'center'; for (let gx = Math.floor(fromX(0) / step) * step; gx <= fromX(W); gx += step) if (Math.abs(gx) > step / 2) x.fillText(lab(gx), toX(gx), Math.min(H - 5, Math.max(14, toY(0) + 15)));
        x.textAlign = 'right'; for (let gy = Math.floor(fromY(H) / step) * step; gy <= fromY(0); gy += step) if (Math.abs(gy) > step / 2) x.fillText(lab(gy), Math.min(W - 4, Math.max(28, toX(0) - 5)), toY(gy) + 4);
        x.textAlign = 'left';
        model.forEach((m) => { if (!m.plot || !m.r.on || m.err) return; try { plot(x, m, dark); } catch (e) {} });
        drawMarks(x, dark);
        save();
      }
      function curvePath(x, f) {
        x.beginPath(); let pen = false, prev = null;
        const stepPx = 0.75;
        for (let px = -2; px <= W + 2; px += stepPx) {
          const y = safe(f, fromX(px)); const py = toY(y);
          if (!isFinite(py) || Math.abs(py) > 1e6) { pen = false; prev = null; continue; }
          // a jump across the screen is a break (like 1/x at 0), not a line to draw
          if (prev != null && Math.abs(py - prev) > H * 0.9) { const mid = safe(f, fromX(px - stepPx / 2)); const pm = toY(mid); if (!isFinite(pm) || Math.abs(pm - prev) > H * 0.45 && Math.abs(pm - py) > H * 0.45 || (pm - prev) * (py - pm) < 0) { pen = false; } }
          if (!pen) { x.moveTo(px, py); pen = true; } else x.lineTo(px, py); prev = py;
        }
      }
      function plot(x, m, dark) {
        x.lineWidth = 2.6; x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = m.r.color; x.fillStyle = m.r.color;
        if (m.plot === 'y') { curvePath(x, m.f); x.stroke(); return; }
        if (m.plot === 'x') { x.beginPath(); let pen = false; for (let py = -2; py <= H + 2; py += 0.75) { const v = safe(m.g, fromY(py)); const px = toX(v); if (!isFinite(px) || Math.abs(px) > 1e6) { pen = false; continue; } if (!pen) { x.moveTo(px, py); pen = true; } else x.lineTo(px, py); } x.stroke(); return; }
        if (m.plot === 'polar') { x.beginPath(); let pen = false; const N = 2400; for (let i = 0; i <= N; i++) { const t = (i / N) * 4 * Math.PI; const rr = safe(m.polar, deg ? t * 180 / Math.PI : t); const px = toX(rr * Math.cos(t)), py = toY(rr * Math.sin(t)); if (!isFinite(px) || !isFinite(py)) { pen = false; continue; } if (!pen) { x.moveTo(px, py); pen = true; } else x.lineTo(px, py); } x.stroke(); return; }
        if (m.plot === 'point') { const px = toX(m.pt[0]), py = toY(m.pt[1]); x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.font = '12px system-ui, sans-serif'; x.fillStyle = dark ? '#e5e5ea' : '#1d1d1f'; x.fillText('(' + fmt3(m.pt[0]) + ', ' + fmt3(m.pt[1]) + ')', px + 8, py - 8); return; }
        if (m.plot === 'yineq') {
          // shade above (y >) or below (y <) the curve; a dashed edge means "not included"
          x.save(); x.globalAlpha = 0.18; x.beginPath(); const above = m.rel[0] === '>';
          let started = false; for (let px = 0; px <= W; px += 1) { let py = toY(safe(m.f, fromX(px))); if (!isFinite(py)) { py = above ? H : 0; } py = Math.max(-10, Math.min(H + 10, py)); if (!started) { x.moveTo(px, above ? -10 : H + 10); started = true; } x.lineTo(px, py); }
          x.lineTo(W, above ? -10 : H + 10); x.closePath(); x.fill(); x.restore();
          if (m.rel.length === 1) x.setLineDash([8, 6]); curvePath(x, m.f); x.stroke(); x.setLineDash([]); return;
        }
        if (m.plot === 'implicit' || m.plot === 'ineq') {
          const cell = 5, nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1;
          // the grid of values only changes when the view, the equation or a slider changes
          const key = gridKey || (gridKey = [view.cx, view.cy, view.scale, W, H, deg, JSON.stringify(paramVals)].join('|'));
          let G = m._grid && m._gridKey === key ? m._grid : null;
          if (!G) { G = new Float64Array(nx * ny); const F = m.F; for (let j = 0; j < ny; j++) { const wy = fromY(j * cell); for (let i = 0; i < nx; i++) { let v; try { v = F(fromX(i * cell), wy); } catch (e) { v = NaN; } G[j * nx + i] = v; } } m._grid = G; m._gridKey = key; }
          if (m.plot === 'ineq') {
            const want = m.rel[0] === '<' ? (v) => v < 0 : (v) => v > 0;
            x.save(); x.globalAlpha = 0.18;
            for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const c = (G[j * nx + i] + G[j * nx + i + 1] + G[(j + 1) * nx + i] + G[(j + 1) * nx + i + 1]) / 4; if (want(c)) x.fillRect(i * cell, j * cell, cell, cell); }
            x.restore(); if (m.rel.length === 1) x.setLineDash([8, 6]);
          }
          // marching squares: the curve where the value changes sign
          x.beginPath(); const lerp = (a, b) => (Math.abs(b - a) < 1e-12 ? 0.5 : a / (a - b));
          for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
            const a = G[j * nx + i], b = G[j * nx + i + 1], c = G[(j + 1) * nx + i + 1], d = G[(j + 1) * nx + i];
            if (![a, b, c, d].every(isFinite)) continue;
            const pts = []; const X0 = i * cell, Y0 = j * cell;
            if ((a < 0) !== (b < 0)) pts.push([X0 + cell * lerp(a, b), Y0]);
            if ((b < 0) !== (c < 0)) pts.push([X0 + cell, Y0 + cell * lerp(b, c)]);
            if ((d < 0) !== (c < 0)) pts.push([X0 + cell * lerp(d, c), Y0 + cell]);
            if ((a < 0) !== (d < 0)) pts.push([X0, Y0 + cell * lerp(a, d)]);
            // skip sign changes that are really jumps to infinity (like 1/x)
            if (pts.length >= 2 && Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)) < 1e6) { x.moveTo(pts[0][0], pts[0][1]); x.lineTo(pts[1][0], pts[1][1]); if (pts.length === 4) { x.moveTo(pts[2][0], pts[2][1]); x.lineTo(pts[3][0], pts[3][1]); } }
          }
          x.stroke(); x.setLineDash([]);
        }
      }

      /* ---------- interesting points: roots, intercepts, highs, lows, crossings ---------- */
      function findMarks() {
        marks = []; if (!W) return;
        // points are shown for the selected curve (the one being typed or clicked), and where it crosses the others
        const all = model.filter((m) => m.r.on && !m.err && (m.plot === 'y' || m.plot === 'yineq') && m.f);
        const sel = model.find((m) => m.r.id === selectedId && m.r.on && !m.err);
        if (!sel) return;
        const curves = all.filter((m) => m === sel);
        const x0 = fromX(0), x1 = fromX(W); const N = Math.min(1600, Math.max(400, W)); const dx = (x1 - x0) / N;
        const bisect = (g, a, b) => { let ga = g(a); for (let k = 0; k < 60; k++) { const mid = (a + b) / 2, gm = g(mid); if (!isFinite(gm)) return null; if ((gm < 0) === (ga < 0)) { a = mid; ga = gm; } else b = mid; } return (a + b) / 2; };
        const add = (mx, my, kind, color) => {
          if (!isFinite(mx) || !isFinite(my)) return;
          const same = marks.find((k) => Math.abs(toX(k.x) - toX(mx)) < 4 && Math.abs(toY(k.y) - toY(my)) < 4);
          if (same) { if (!same.kind.split(' · ').includes(kind)) same.kind += ' · ' + kind; return; } // e.g. "Low point · y-intercept"
          marks.push({ x: mx, y: my, kind, color });
        };
        curves.forEach((m) => {
          const f = (v) => safe(m.f, v);
          const y0 = f(0); if (isFinite(y0) && Math.abs(toY(y0) - H / 2) < H) add(0, y0, T('y-intercept'), m.r.color);
          let px = x0, py = f(px);
          for (let k = 1; k <= N; k++) {
            const cx = x0 + k * dx, cy = f(cx);
            if (isFinite(py) && isFinite(cy)) {
              if (py === 0) add(px, 0, T('Root'), m.r.color);
              else if ((py < 0) !== (cy < 0) && Math.abs(py - cy) < Math.abs(H / view.scale)) { const r = bisect(f, px, cx); if (r != null && Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(py) + Math.abs(cy))) add(r, 0, T('Root'), m.r.color); }
              const nx2 = cx + dx, ny2 = f(nx2);
              if (isFinite(ny2) && ((cy > py && cy > ny2) || (cy < py && cy < ny2))) {
                // refine the high or low point (golden-section search)
                let a = px, b = nx2; const isMax = cy > py; const gr = 0.618034;
                for (let it = 0; it < 50; it++) { const c1 = b - gr * (b - a), c2 = a + gr * (b - a); const v1 = f(c1), v2 = f(c2); if ((isMax && v1 > v2) || (!isMax && v1 < v2)) b = c2; else a = c1; }
                const ex = (a + b) / 2; add(ex, f(ex), T(isMax ? 'High point' : 'Low point'), m.r.color);
              }
            }
            px = cx; py = cy;
          }
        });
        const pairs = curves.length ? all.filter((m) => m !== sel).map((o) => [sel, o]) : [];
        for (const [ci, cj] of pairs) {
          const f = (v) => safe(ci.f, v) - safe(cj.f, v); let px = x0, py = f(px);
          for (let k = 1; k <= N; k++) { const cx = x0 + k * dx, cy = f(cx); if (isFinite(py) && isFinite(cy) && (py < 0) !== (cy < 0) && Math.abs(py - cy) < Math.abs(H / view.scale)) { const r = bisect(f, px, cx); if (r != null) add(r, safe(ci.f, r), T('Crossing'), '#8e8e93'); } px = cx; py = cy; }
        }
        // circles and other equations: where they cross the axes
        // where a curve y = f(x) meets an equation like a circle: F(x, f(x)) = 0
        const eqs = model.filter((m) => m.r.on && !m.err && m.plot === 'implicit');
        const mixed = sel.plot === 'implicit' ? all.map((o) => [sel, o]) : (sel.f ? eqs.map((o) => [o, sel]) : []);
        for (const [eq, cu] of mixed) {
          const g = (v) => safe((q) => eq.F(q, cu.f(q)), v); let px = x0, py = g(px);
          for (let k = 1; k <= N; k++) { const cx = x0 + k * dx, cy = g(cx); if (isFinite(py) && isFinite(cy) && (py < 0) !== (cy < 0)) { const r = bisect(g, px, cx); if (r != null && Math.abs(g(r)) < 1e-6) add(r, safe(cu.f, r), T('Crossing'), '#8e8e93'); } px = cx; py = cy; }
        }
        [sel].filter((m) => m.plot === 'implicit').forEach((m) => {
          [[(v) => safe((q) => m.F(q, 0), v), 'x'], [(v) => safe((q) => m.F(0, q), v), 'y']].forEach(([g, axis]) => {
            const a0 = axis === 'x' ? x0 : fromY(H), a1 = axis === 'x' ? x1 : fromY(0); const d = (a1 - a0) / N; let pa = a0, pv = g(pa);
            for (let k = 1; k <= N; k++) { const ca = a0 + k * d, cvv = g(ca); if (isFinite(pv) && isFinite(cvv) && (pv < 0) !== (cvv < 0)) { const r = bisect(g, pa, ca); if (r != null && Math.abs(g(r)) < 1e-6) { if (axis === 'x') add(r, 0, T('Root'), m.r.color); else add(0, r, T('y-intercept'), m.r.color); } } pa = ca; pv = cvv; }
          });
        });
        if (marks.length > 80) marks.length = 80;
      }
      const marksSoon = PatOS.debounce(() => { findMarks(); draw(); }, 140);
      function drawMarks(x, dark) {
        marks.forEach((k) => { const px = toX(k.x), py = toY(k.y); if (px < -5 || py < -5 || px > W + 5 || py > H + 5) return; x.beginPath(); x.arc(px, py, k === hover || k === pinned ? 5.5 : 4, 0, 7); x.fillStyle = dark ? '#16161a' : '#fff'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#8e8e93'; x.stroke(); });
        tip.style.display = 'none';
        const k = hover || pinned;
        if (k) { tip.innerHTML = ''; tip.append(h('small', {}, k.kind), h('b', {}, '(' + fmt3(k.x) + ', ' + fmt3(k.y) + ')')); tip.style.display = ''; tip.style.left = Math.min(W - 140, toX(k.x) + 10) + 'px'; tip.style.top = Math.max(4, toY(k.y) - 46) + 'px'; }
        else if (trace) { tip.innerHTML = ''; tip.append(h('small', { style: { color: trace.color } }, trace.label), h('b', {}, '(' + fmt3(trace.x) + ', ' + fmt3(trace.y) + ')')); tip.style.display = ''; tip.style.left = Math.min(W - 140, toX(trace.x) + 10) + 'px'; tip.style.top = Math.max(4, toY(trace.y) - 46) + 'px'; x.beginPath(); x.arc(toX(trace.x), toY(trace.y), 5, 0, 7); x.fillStyle = trace.color; x.fill(); }
      }

      /* ---------- moving around ---------- */
      let drag = null, trace = null; const pointers = new Map(); let pinch = null;
      cv.addEventListener('pointerdown', (e) => {
        cv.focus(); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId);
        if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale }; drag = null; return; }
        drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
      });
      cv.addEventListener('pointermove', (e) => {
        const r = cv.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; view.scale = Math.min(20000, Math.max(0.5, pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); draw(); marksSoon(); return; }
        if (drag) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 3) drag.moved = true; view.cx = drag.cx - (e.clientX - drag.x) / view.scale; view.cy = drag.cy + (e.clientY - drag.y) / view.scale; hover = null; trace = null; draw(); marksSoon(); return; }
        hover = marks.find((k) => Math.hypot(toX(k.x) - mx, toY(k.y) - my) < 8) || null;
        trace = null;
        if (!hover) { let best = 14; model.forEach((m) => { if (!m.r.on || m.err || !(m.plot === 'y' || m.plot === 'yineq')) return; const wx = fromX(mx), wy = safe(m.f, wx); const d = Math.abs(toY(wy) - my); if (isFinite(wy) && d < best) { best = d; trace = { id: m.r.id, x: wx, y: wy, color: m.r.color, label: m.label || ('y = ' + m.r.src.replace(/^\s*y\s*[=<>]+\s*/, '')) }; } }); }
        cv.style.cursor = hover ? 'pointer' : drag ? 'grabbing' : 'grab';
        draw();
      });
      const endPtr = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (drag && !drag.moved) { if (!hover && trace) select(trace.id); else { pinned = hover && pinned !== hover ? hover : null; draw(); } } drag = null; };
      cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
      cv.addEventListener('pointerleave', () => { hover = null; trace = null; draw(); });
      const zoomAt = (mx, my, k) => { const wx = fromX(mx), wy = fromY(my); view.scale = Math.min(20000, Math.max(0.5, view.scale * k)); view.cx = wx - (mx - W / 2) / view.scale; view.cy = wy + (my - H / 2) / view.scale; draw(); marksSoon(); };
      cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });
      cv.addEventListener('keydown', (e) => { const k = 40 / view.scale; if (e.key === 'ArrowLeft') view.cx -= k; else if (e.key === 'ArrowRight') view.cx += k; else if (e.key === 'ArrowUp') view.cy += k; else if (e.key === 'ArrowDown') view.cy -= k; else if (e.key === '+' || e.key === '=') return zoomAt(W / 2, H / 2, 1.25); else if (e.key === '-') return zoomAt(W / 2, H / 2, 0.8); else return; e.preventDefault(); draw(); marksSoon(); });
      bIn.onclick = () => zoomAt(W / 2, H / 2, 1.4); bOut.onclick = () => zoomAt(W / 2, H / 2, 1 / 1.4);
      bHome.onclick = () => { view = { cx: 0, cy: 0, scale: 50 }; draw(); marksSoon(); };
      bDeg.onclick = () => { deg = !deg; syncDeg(); renderList(); draw(); marksSoon(); };
      bGrid.onclick = () => { showGrid = !showGrid; bGrid.classList.toggle('on', showGrid); draw(); };
      bShot.onclick = () => { const nm = PatOS.fs.uniqueName('/Pictures', T('Graph') + '.png'); PatOS.fs.write('/Pictures/' + nm, cv.toDataURL('image/png')); PatOS.notify({ title: T('Saved to Pictures'), body: nm, icon: 'grapher' }); };

      /* ---------- table of values ---------- */
      let tableFor = null, tStart = -5, tStep = 1;
      function closeTable() { tableFor = null; tableBox.classList.add('hidden'); bTable.classList.remove('on'); }
      function drawTable() {
        const m = model.find((q) => q.r === tableFor); tableBox.innerHTML = '';
        const pick = h('select', { class: 'field' }, ...model.filter((q) => q.f && !q.err).map((q) => h('option', { value: q.r.id, selected: q.r === tableFor }, q.r.src)));
        pick.onchange = () => { tableFor = rows.find((r) => r.id === pick.value); drawTable(); };
        const s0 = h('input', { class: 'field gr-tin', value: tStart, 'aria-label': T('From') }), s1 = h('input', { class: 'field gr-tin', value: tStep, 'aria-label': T('Step') });
        s0.onchange = () => { tStart = +s0.value || 0; drawTable(); }; s1.onchange = () => { tStep = +s1.value || 1; drawTable(); };
        const tb = h('table', {}, h('tr', {}, h('th', {}, 'x'), h('th', {}, 'y')));
        if (m && m.f) for (let k = 0; k <= 20; k++) { const xv = +(tStart + k * tStep).toFixed(10); tb.appendChild(h('tr', {}, h('td', {}, fmt(xv)), h('td', {}, fmt(safe(m.f, xv))))); }
        tableBox.append(h('div', { class: 'gr-thead' }, h('b', {}, T('Table of values')), h('button', { class: 'tbtn', title: T('Close'), onclick: closeTable }, '×')), pick, h('div', { class: 'gr-trow' }, h('label', {}, T('From'), s0), h('label', {}, T('Step'), s1)), h('div', { class: 'gr-tscroll' }, tb));
      }
      bTable.onclick = () => {
        if (tableFor) return closeTable();
        const first = model.find((q) => q.f && !q.err && q.r.on); if (!first) { PatOS.notify({ title: T('Nothing to put in a table'), body: T('Type a function first, like y = 2x + 1.'), icon: 'grapher' }); return; }
        tableFor = first.r; tableBox.classList.remove('hidden'); bTable.classList.add('on'); drawTable();
      };

      const ro = new ResizeObserver(() => { draw(); marksSoon(); }); ro.observe(stage);
      win.on('closed', () => { ro.disconnect(); PatOS.store.set('grapher2', { rows: rows.map(({ src, color, on, min, max, step, id }) => ({ src, color, on, min, max, step, id })), view, deg, grid: showGrid }); });
      renderList(); setTimeout(() => { draw(); findMarks(); draw(); }, 30);
      win._grapher = { parse, get marks() { return marks; }, get model() { return model; }, addRow, rows };
    }
  });
  PatOS.mathParse = parse;
})();
