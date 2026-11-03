/* Calculator — basic and scientific modes, a history tape you can reuse, copy and paste (Ctrl+C / Ctrl+V),
   repeated =, real percent (50 + 10% = 55), inverse trig with 2nd, and numbers written the French way in French */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'calculator', name: 'Calculator', icon: 'calculator', width: 260, height: 410, resizable: false, titlebar: 'hidden', dark: true, category: 'Utilities', keywords: 'math calc scientific',
    launch(win) {
      let sci = PatOS.store.get('calcSci', false);
      let cur = '0', prev = null, op = null, fresh = true;   // basic mode state
      let expr = '', lastAns = 0, deg = true, justEval = false, second = false; // scientific mode state
      let lastOp = null, lastB = null; // basic: pressing = again repeats the last operation
      const FRN = PatOS.lang === 'fr', DEC = FRN ? ',' : '.';
      const T = (x) => PatOS.t(x);
      let history = PatOS.store.get('calcHistory', []);
      const remember = (e, r) => { if (r === 'Error' || !isFinite(parseFloat(r))) return; history.unshift({ e, r: String(r), t: Date.now() }); history = history.slice(0, 60); PatOS.store.set('calcHistory', history); if (!histEl.classList.contains('hidden')) renderHistory(); };
      const modeBtn = h('button', { class: 'calc-mode', title: T('Switch mode') });
      const histBtn = h('button', { class: 'calc-mode calc-hbtn', title: T('History'), 'aria-label': T('History'), html: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>' });
      const histEl = h('div', { class: 'calc-hist hidden' });
      const sub = h('div', { class: 'calc-sub' });
      const disp = h('div', { class: 'calc-disp' }, '0');
      const keys = h('div', { class: 'calc-keys' });
      win.body.classList.add('calc');
      win.body.append(histBtn, modeBtn, sub, disp, keys, histEl);
      function renderHistory() {
        histEl.innerHTML = '';
        histEl.append(h('div', { class: 'calc-hhead' }, h('b', {}, T('History')), h('button', { class: 'calc-hclear', onclick: () => { history = []; PatOS.store.set('calcHistory', history); renderHistory(); } }, T('Clear')), h('button', { class: 'calc-hclear', onclick: () => histEl.classList.add('hidden') }, T('Done'))));
        if (!history.length) histEl.appendChild(h('div', { class: 'calc-hempty' }, T('Your calculations will show up here.')));
        history.forEach((it) => histEl.appendChild(h('button', { class: 'calc-hrow', title: T('Use this result'), onclick: () => { useNumber(it.r); histEl.classList.add('hidden'); } }, h('small', {}, pretty(it.e) + ' ='), h('b', {}, fmt(it.r)))));
      }
      histBtn.onclick = () => { const on = histEl.classList.contains('hidden'); histEl.classList.toggle('hidden', !on); if (on) renderHistory(); };
      function useNumber(r) {
        r = String(r);
        if (sci) { if (justEval || !expr) expr = r; else expr += (/[\d.)]$/.test(expr) ? '×' : '') + r; justEval = false; disp.textContent = pretty(expr); size(); }
        else { cur = r; fresh = true; disp.textContent = fmt(cur); size(); }
      }
      const pretty = (e) => String(e).replace(/asin\(/g, 'sin⁻¹(').replace(/acos\(/g, 'cos⁻¹(').replace(/atan\(/g, 'tan⁻¹(').replace(/abs\(/g, 'abs(').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\./g, DEC);
      const fmt = (n) => {
        if (n === 'Error') return PatOS.t('Error'); const v = parseFloat(n); if (!isFinite(v)) return PatOS.t('Error');
        if (String(n).endsWith('.')) return n;
        if (Math.abs(v) >= 1e12 || (Math.abs(v) < 1e-7 && v !== 0)) return v.toExponential(5);
        if (/e/i.test(String(n))) return String(n).replace('.', DEC);
        const [i, d] = String(n).split('.'); const neg = i.startsWith('-') ? '-' : '';
        return neg + Number(i.replace('-', '') || 0).toLocaleString(FRN ? 'fr-CA' : 'en-US') + (d !== undefined ? DEC + d.slice(0, 10) : '');
      };
      function size() {
        const s = disp.textContent; const max = sci ? 22 : 9;
        disp.style.fontSize = s.length > max ? Math.max(sci ? 22 : 26, (sci ? 48 : 64) - (s.length - max) * (sci ? 2 : 5)) + 'px' : (sci ? 48 : 64) + 'px';
      }
      /* ---------- basic ---------- */
      const BASIC = [['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7'], ['8'], ['9'], ['×', 'op'], ['4'], ['5'], ['6'], ['−', 'op'], ['1'], ['2'], ['3'], ['+', 'op'], ['0', 'zero'], ['.'], ['=', 'op']];
      function calc(a, b, o) { a = parseFloat(a); b = parseFloat(b); const r = o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : o === '÷' ? (b === 0 ? NaN : a / b) : b; return isFinite(r) ? String(+r.toPrecision(12)) : 'Error'; }
      function pressBasic(k) {
        if (/^\d$/.test(k)) { if (fresh || cur === '0' || cur === 'Error') { cur = k; fresh = false; } else if (cur.replace(/[-.]/g, '').length < 12) cur += k; }
        else if (k === '.') { if (fresh) { cur = '0.'; fresh = false; } else if (!cur.includes('.')) cur += '.'; }
        else if (k === 'AC' || k === 'C') { if (k === 'C') { cur = '0'; fresh = true; } else { cur = '0'; prev = null; op = null; fresh = true; } }
        else if (k === '±') cur = cur.startsWith('-') ? cur.slice(1) : cur === '0' ? '0' : '-' + cur;
        else if (k === '%') cur = String(+(op && prev !== null && (op === '+' || op === '−') ? parseFloat(prev) * parseFloat(cur) / 100 : parseFloat(cur) / 100).toPrecision(12));
        else if (['+', '−', '×', '÷'].includes(k)) { if (op && !fresh && prev !== null) cur = calc(prev, cur, op); prev = cur; op = k; fresh = true; lastOp = null; }
        else if (k === '=') {
          if (op !== null && prev !== null) { const e = prev + ' ' + op + ' ' + cur; lastOp = op; lastB = cur; cur = calc(prev, cur, op); remember(e.replace(/\./g, '.'), cur); prev = null; op = null; fresh = true; }
          else if (lastOp && cur !== 'Error') { const e = cur + ' ' + lastOp + ' ' + lastB; cur = calc(cur, lastB, lastOp); remember(e, cur); fresh = true; }
        }
        disp.textContent = fmt(cur); sub.textContent = prev !== null && op ? fmt(prev) + ' ' + op : '';
        const ac = keys.querySelector('[data-k="AC"],[data-k="C"]'); if (ac) { const c = cur !== '0' && !fresh; ac.textContent = c ? 'C' : 'AC'; ac.dataset.k = c ? 'C' : 'AC'; }
        keys.querySelectorAll('.ck.op').forEach((b) => b.classList.toggle('active', b.dataset.k === op && fresh));
        size();
      }
      /* ---------- scientific ---------- */
      const SCI = [['2nd', 'fx'], ['1/x', 'fx'], ['eˣ', 'fx'], ['10ˣ', 'fx'], ['|x|', 'fx'], ['(', 'fn'], [')', 'fn'], ['AC', 'fn'], ['⌫', 'fn'], ['÷', 'op'], ['sin', 'fx'], ['cos', 'fx'], ['tan', 'fx'], ['x²', 'fx'], ['×', 'op'], ['ln', 'fx'], ['log', 'fx'], ['√', 'fx'], ['xʸ', 'fx'], ['−', 'op'], ['7'], ['8'], ['9'], ['π', 'fx'], ['+', 'op'], ['4'], ['5'], ['6'], ['e', 'fx'], ['=', 'op eq'], ['1'], ['2'], ['3'], ['n!', 'fx'], ['Ans', 'fx'], ['0'], ['.'], ['%', 'fx'], ['Rad', 'fx']];
      const TOK = { '÷': '/', '×': '*', '−': '-', '+': '+', '(': '(', ')': ')', '.': '.', 'π': 'π', 'e': 'e', 'sin': 'sin(', 'cos': 'cos(', 'tan': 'tan(', 'ln': 'ln(', 'log': 'log(', '√': '√(', 'x²': '^2', 'xʸ': '^', '%': '%', 'n!': '!', 'Ans': 'Ans', '1/x': '^(-1)', 'sin⁻¹': 'asin(', 'cos⁻¹': 'acos(', 'tan⁻¹': 'atan(', 'eˣ': 'e^(', '10ˣ': '10^(', '|x|': 'abs(' };
      function evaluate(src) {
        let s = src.replace(/π/g, '(PI)').replace(/Ans/g, '(' + lastAns + ')').replace(/\be\b/g, '(E)').replace(/√\(/g, 'sqrt(').replace(/ln\(/g, 'LN(').replace(/log\(/g, 'LOG(')
          .replace(/(\d+(?:\.\d+)?|\))!/g, 'fact($1)').replace(/(\d+(?:\.\d+)?)%/g, '($1/100)').replace(/\^/g, '**');
        s = s.replace(/(\d|\))\s*(\(|[A-Za-z])/g, '$1*$2'); // 2π, 3(4)
        if (/[^0-9+\-*/().\sA-Za-z]/.test(s.replace(/\*\*/g, ''))) throw new Error('bad');
        if (/[A-Za-z]+/.test(s.replace(/\b(PI|E|sqrt|LN|LOG|sin|cos|tan|asin|acos|atan|abs|fact)\b/g, ''))) throw new Error('bad');
        const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length; s += ')'.repeat(Math.max(0, open));
        const k = deg ? Math.PI / 180 : 1;
        const fact = (n) => { if (n < 0 || n > 170 || n % 1) return NaN; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
        const r = Function('PI', 'E', 'sqrt', 'LN', 'LOG', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'abs', 'fact', '"use strict";return (' + s + ');')(Math.PI, Math.E, Math.sqrt, Math.log, Math.log10, (x) => Math.sin(x * k), (x) => Math.cos(x * k), (x) => Math.tan(x * k), (x) => Math.asin(x) / k, (x) => Math.acos(x) / k, (x) => Math.atan(x) / k, Math.abs, fact);
        if (typeof r !== 'number' || !isFinite(r)) throw new Error('bad');
        return Math.abs(r) < 1e-12 ? 0 : +r.toPrecision(12);
      }
      function pressSci(k) {
        if (k === 'AC') { expr = ''; sub.textContent = ''; }
        else if (k === '⌫') expr = expr.replace(/(asin\(|acos\(|atan\(|abs\(|sin\(|cos\(|tan\(|ln\(|log\(|√\(|e\^\(|10\^\(|Ans|\^\(-1\)|.)$/, '');
        else if (k === '2nd') { second = !second; build(); return; }
        else if (k === 'Rad' || k === 'Deg') { deg = !deg; }
        else if (k === '=') { if (!expr) return; try { const r = evaluate(expr); remember(expr, r); sub.textContent = pretty(expr) + ' ='; lastAns = r; expr = String(r); justEval = true; disp.textContent = fmt(r); size(); return; } catch (e) { sub.textContent = expr; disp.textContent = PatOS.t('Error'); expr = ''; size(); return; } }
        else {
          if (justEval && /^[\d.(πe]|sin|cos|tan|ln|log|√|abs|Ans/.test(TOK[k] || k)) expr = '';
          expr += TOK[k] !== undefined ? TOK[k] : k;
          if (second && /⁻¹$/.test(k)) { second = false; build(); }
        }
        justEval = false;
        disp.textContent = pretty(expr) || '0';
        const rd = keys.querySelector('[data-k="Rad"],[data-k="Deg"]'); if (rd) { rd.textContent = deg ? 'Rad' : 'Deg'; rd.dataset.k = deg ? 'Rad' : 'Deg'; }
        sub.textContent = sub.textContent && expr ? sub.textContent : (deg ? 'DEG' : 'RAD');
        size();
      }
      function build() {
        keys.innerHTML = ''; win.body.classList.toggle('sci', sci);
        modeBtn.textContent = sci ? '123' : 'ƒ(x)';
        const keyList = (sci ? SCI : BASIC).map(([k, cls]) => [second && { sin: 1, cos: 1, tan: 1 }[k] ? k + '⁻¹' : k, cls + (k === '2nd' && second ? ' on' : '')]);
        keyList.forEach(([k, cls]) => { const b = h('button', { class: 'ck ' + (cls || 'num'), 'data-k': k }, k); b.onclick = () => { PatOS.sound.click(); sci ? pressSci(b.dataset.k) : pressBasic(b.dataset.k); }; keys.appendChild(b); });
        if (!PatOS.isMobile) { win.el.style.width = (sci ? 440 : 260) + 'px'; win.el.style.height = (sci ? 530 : 410) + 'px'; }
        if (sci) { disp.textContent = pretty(expr) || '0'; sub.textContent = deg ? 'DEG' : 'RAD'; } else { disp.textContent = fmt(cur); sub.textContent = ''; }
        size();
      }
      modeBtn.onclick = () => { sci = !sci; PatOS.store.set('calcSci', sci); build(); };
      const keymap = { '/': '÷', '*': '×', '-': '−', '+': '+', Enter: '=', '=': '=', '%': '%', '.': '.', ',': '.', '(': '(', ')': ')', '^': 'xʸ' };
      const onKey = (e) => {
        if (PatOS.wm.active !== win || e.altKey) return;
        if (e.ctrlKey || e.metaKey) {
          const kk = e.key.toLowerCase();
          if (kk === 'c') { e.preventDefault(); const raw = sci ? (justEval ? expr : String(lastAns)) : cur; if (navigator.clipboard) navigator.clipboard.writeText(raw.replace('.', DEC)).catch(() => {}); disp.classList.add('flash'); setTimeout(() => disp.classList.remove('flash'), 250); }
          else if (kk === 'v') { e.preventDefault(); if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((t) => { const n = parseFloat(String(t).replace(/[\s\u00a0\u202f]/g, '').replace(/,(?=\d{1,2}$|\d*$)/, '.').replace(/,/g, '')); if (isFinite(n)) useNumber(String(n)); }).catch(() => {}); }
          return;
        }
        let k = /^\d$/.test(e.key) ? e.key : keymap[e.key];
        if (e.key === 'Escape') k = 'AC';
        if (e.key === 'Backspace') { e.preventDefault(); if (sci) pressSci('⌫'); else { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; disp.textContent = fmt(cur); size(); } return; }
        if (!k) return; e.preventDefault();
        if (sci) pressSci(k); else if (!['(', ')', 'xʸ'].includes(k)) pressBasic(k === 'AC' ? (keys.querySelector('[data-k="C"]') ? 'C' : 'AC') : k);
        const b = keys.querySelector(`[data-k="${k}"]`); if (b) { b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120); }
      };
      document.addEventListener('keydown', onKey);
      win.on('closed', () => document.removeEventListener('keydown', onKey));
      PatOS.calcEval = (s) => evaluate(s);
      build();
    }
  });
})();
