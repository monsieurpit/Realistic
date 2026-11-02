/* Calculator */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'calculator', name: 'Calculator', icon: 'calculator', width: 260, height: 410, resizable: false, titlebar: 'hidden', dark: true, category: 'Utilities', keywords: 'math calc',
    launch(win) {
      let cur = '0', prev = null, op = null, fresh = true;
      const disp = h('div', { class: 'calc-disp' }, '0');
      const keys = h('div', { class: 'calc-keys' });
      win.body.classList.add('calc');
      win.body.append(disp, keys);
      const layout = [['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7'], ['8'], ['9'], ['×', 'op'], ['4'], ['5'], ['6'], ['−', 'op'], ['1'], ['2'], ['3'], ['+', 'op'], ['0', 'zero'], ['.'], ['=', 'op']];
      const btns = {};
      layout.forEach(([k, cls]) => { const b = h('button', { class: 'ck ' + (cls || 'num') }, k); b.onclick = () => press(k); keys.appendChild(b); btns[k] = b; });
      function fmt(n) {
        if (n === 'Error') return n;
        const v = parseFloat(n); if (!isFinite(v)) return 'Error';
        if (String(n).endsWith('.')) return n;
        if (Math.abs(v) >= 1e9 || (Math.abs(v) < 1e-6 && v !== 0)) return v.toExponential(4);
        const [i, d] = String(n).split('.');
        return Number(i).toLocaleString('en-US') + (d !== undefined ? '.' + d.slice(0, 8) : '');
      }
      function show() {
        const s = fmt(cur); disp.textContent = s;
        disp.style.fontSize = s.length > 9 ? Math.max(26, 64 - (s.length - 9) * 5) + 'px' : '64px';
        btns.AC.textContent = cur !== '0' && !fresh ? 'C' : 'AC';
        Object.entries(btns).forEach(([k, b]) => b.classList.toggle('active', k === op && fresh));
      }
      function calc(a, b, o) {
        a = parseFloat(a); b = parseFloat(b);
        const r = o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : o === '÷' ? (b === 0 ? NaN : a / b) : b;
        return isFinite(r) ? String(+r.toPrecision(12)) : 'Error';
      }
      function press(k) {
        PatOS.sound.click();
        if (/^\d$/.test(k)) { if (fresh || cur === '0' || cur === 'Error') { cur = k; fresh = false; } else if (cur.replace(/[-.]/g, '').length < 12) cur += k; }
        else if (k === '.') { if (fresh) { cur = '0.'; fresh = false; } else if (!cur.includes('.')) cur += '.'; }
        else if (k === 'AC' || k === 'C') { if (btns.AC.textContent === 'C') { cur = '0'; fresh = true; } else { cur = '0'; prev = null; op = null; fresh = true; } }
        else if (k === '±') cur = cur.startsWith('-') ? cur.slice(1) : cur === '0' ? '0' : '-' + cur;
        else if (k === '%') cur = String(parseFloat(cur) / 100);
        else if (['+', '−', '×', '÷'].includes(k)) { if (op && !fresh && prev !== null) cur = calc(prev, cur, op); prev = cur; op = k; fresh = true; }
        else if (k === '=') { if (op !== null && prev !== null) { cur = calc(prev, cur, op); prev = null; op = null; fresh = true; } }
        show();
      }
      const keymap = { '/': '÷', '*': '×', '-': '−', '+': '+', Enter: '=', '=': '=', Escape: 'AC', '%': '%', '.': '.', ',': '.' };
      const onKey = (e) => {
        if (PatOS.wm.active !== win) return;
        if (/^\d$/.test(e.key)) press(e.key);
        else if (keymap[e.key]) { e.preventDefault(); press(keymap[e.key] === 'AC' ? (btns.AC.textContent) : keymap[e.key]); }
        else if (e.key === 'Backspace') { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; show(); }
      };
      document.addEventListener('keydown', onKey);
      win.on('closed', () => document.removeEventListener('keydown', onKey));
      show();
    }
  });
})();
