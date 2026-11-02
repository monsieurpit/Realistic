/* Sheets — a real spreadsheet with formulas. Files are saved as .psheet (or .csv). */
(function () {
  'use strict';
  const { h } = PatOS;
  const COLS = 26, ROWS = 100;
  const colName = (c) => String.fromCharCode(65 + c);
  const parseRef = (r) => { const m = /^([A-Z])(\d+)$/.exec(r); return m ? { c: m[1].charCodeAt(0) - 65, r: +m[2] - 1 } : null; };
  const refName = (c, r) => colName(c) + (r + 1);

  /* ---------- formula engine ---------- */
  const num = (v) => (typeof v === 'number' ? v : v === '' || v == null ? 0 : isNaN(+v) ? 0 : +v);
  const flat = (a) => [].concat(...a.map((x) => (Array.isArray(x) ? flat(x) : [x])));
  const nums = (a) => flat(a).filter((v) => v !== '' && v != null && !isNaN(+v)).map(Number);
  const FN = {
    SUM: (...a) => nums(a).reduce((s, v) => s + v, 0),
    AVERAGE: (...a) => { const n = nums(a); return n.length ? n.reduce((s, v) => s + v, 0) / n.length : 0; },
    MIN: (...a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: (...a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    COUNT: (...a) => nums(a).length,
    COUNTA: (...a) => flat(a).filter((v) => v !== '' && v != null).length,
    MEDIAN: (...a) => { const n = nums(a).sort((x, y) => x - y); if (!n.length) return 0; const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
    IF: (c, a, b) => (c ? a : b === undefined ? false : b),
    AND: (...a) => flat(a).every(Boolean), OR: (...a) => flat(a).some(Boolean), NOT: (a) => !a,
    ROUND: (a, d) => { const p = Math.pow(10, num(d)); return Math.round(num(a) * p) / p; },
    ABS: (a) => Math.abs(num(a)), SQRT: (a) => Math.sqrt(num(a)), POWER: (a, b) => Math.pow(num(a), num(b)), MOD: (a, b) => num(a) % num(b),
    INT: (a) => Math.floor(num(a)), PI: () => Math.PI, RAND: () => Math.random(),
    CONCAT: (...a) => flat(a).join(''), LEN: (a) => String(a).length, UPPER: (a) => String(a).toUpperCase(), LOWER: (a) => String(a).toLowerCase(),
    LEFT: (a, n) => String(a).slice(0, n === undefined ? 1 : num(n)), RIGHT: (a, n) => String(a).slice(-(n === undefined ? 1 : num(n))),
    TODAY: () => new Date().toLocaleDateString(), NOW: () => new Date().toLocaleString(),
    COUNTIF: (range, crit) => flat([range]).filter((v) => matchCrit(v, crit)).length,
    SUMIF: (range, crit, sumRange) => { const r = flat([range]), s = sumRange ? flat([sumRange]) : r; return r.reduce((t, v, i) => t + (matchCrit(v, crit) ? num(s[i]) : 0), 0); }
  };
  function matchCrit(v, crit) {
    const m = /^(>=|<=|<>|>|<|=)?(.*)$/.exec(String(crit)); const op = m[1] || '=', x = m[2];
    const a = isNaN(+v) ? String(v) : +v, b = isNaN(+x) || x === '' ? x : +x;
    return op === '=' ? a == b : op === '<>' ? a != b : op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : a <= b;
  }
  function compile(src) {
    // tokenize strings out first so nothing inside quotes is rewritten
    const strs = []; let s = src.replace(/"([^"]*)"/g, (_, x) => { strs.push(x); return '§' + (strs.length - 1) + '§'; });
    s = s.toUpperCase();
    if (/[^A-Z0-9_.,:+\-*/^()<>=&%§ ]/.test(s)) throw new Error('bad');
    s = s.replace(/([A-Z])(\d+):([A-Z])(\d+)/g, 'R("$1$2","$3$4")');
    s = s.replace(/\b([A-Z]+)\s*\(/g, (m, f) => { if (f === 'R') return m; if (!FN[f]) throw new Error('fn'); return 'F.' + f + '('; });
    s = s.replace(/(^|[^A-Z."§])([A-Z])(\d+)\b/g, '$1C("$2$3")');
    s = s.replace(/\bTRUE\b/g, 'true').replace(/\bFALSE\b/g, 'false');
    s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)').replace(/\^/g, '**').replace(/<>/g, '!=').replace(/([^<>!=])=(?!=)/g, '$1==').replace(/&/g, '+""+');
    if (/[A-Z]{2,}(?!\()/.test(s.replace(/F\.[A-Z]+\(|"[^"]*"|true|false/g, ''))) throw new Error('name');
    s = s.replace(/§(\d+)§/g, (_, i) => JSON.stringify(strs[+i]));
    return Function('R', 'C', 'F', '"use strict";return (' + s + ');');
  }

  PatOS.registerApp({
    id: 'sheets', name: 'Sheets', icon: 'sheets', single: false, width: 1040, height: 680, category: 'Office', keywords: 'spreadsheet excel table formulas google sheets numbers',
    about: 'Spreadsheets with formulas like SUM, AVERAGE, IF and COUNTIF.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'office-win');
      let path = args.path || null;
      let data = {};
      if (path) {
        const raw = PatOS.fs.read(path) || '';
        if (/\.csv$/i.test(path)) { raw.split(/\r?\n/).forEach((line, r) => splitCSV(line).forEach((v, c) => { if (v !== '' && c < COLS && r < ROWS) data[refName(c, r)] = { v }; })); }
        else { try { data = JSON.parse(raw).cells || {}; } catch (e) { data = {}; } }
      } else {
        path = PatOS.newDocPath('/Documents', 'Untitled spreadsheet', 'psheet');
        const T = PatOS.t; data = { A1: { v: T('Item'), b: 1 }, B1: { v: T('Cost'), b: 1 }, A2: { v: T('Notebook') }, B2: { v: '3.5' }, A3: { v: T('Pens') }, B3: { v: '2.25' }, A4: { v: T('Calculator') }, B4: { v: '12' }, A5: { v: T('Total'), b: 1 }, B5: { v: '=SUM(B2:B4)', b: 1 } };
        PatOS.fs.write(path, JSON.stringify({ cells: data }));
      }
      let sel = { c: 0, r: 0 }, anchor = null, editing = null;
      const nameIn = h('input', { class: 'doc-name', value: PatOS.fs.basename(path).replace(/\.(psheet|csv)$/, ''), spellcheck: 'false' });
      const saved = h('span', { class: 'doc-saved' }, 'Saved');
      win.toolbar.append(nameIn, saved); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const btn = (label, title, fn) => { const b = h('button', { class: 'ob', title }, label); b.addEventListener('mousedown', (e) => e.preventDefault()); b.onclick = fn; return b; };
      const fx = h('input', { class: 'sh-fx', spellcheck: 'false', placeholder: 'Type a value or a formula like =SUM(A1:A5)' });
      const refBox = h('div', { class: 'sh-ref' }, 'A1');
      const fill = h('input', { type: 'color', class: 'ob-color', value: '#fff59d', title: 'Fill color' });
      const tcol = h('input', { type: 'color', class: 'ob-color', value: '#000000', title: 'Text color' });
      const bar = h('div', { class: 'ob-bar' },
        btn('↶', 'Undo', undo), h('span', { class: 'ob-sep' }),
        btn(h('b', {}, 'B'), 'Bold', () => fmt('b')), btn(h('i', {}, 'I'), 'Italic', () => fmt('i')),
        h('label', { class: 'ob-cl', title: 'Text color' }, 'A', tcol), h('label', { class: 'ob-cl hl', title: 'Fill color' }, '🪣', fill), h('span', { class: 'ob-sep' }),
        btn('⬅', 'Align left', () => setProp('al', 'left')), btn('↔', 'Center', () => setProp('al', 'center')), btn('➡', 'Align right', () => setProp('al', 'right')), h('span', { class: 'ob-sep' }),
        btn('$', 'Currency', () => setProp('nf', 'cur')), btn('%', 'Percent', () => setProp('nf', 'pct')), btn('.0', 'Two decimals', () => setProp('nf', 'dec')), btn('123', 'Plain number', () => setProp('nf', null)), h('span', { class: 'ob-sep' }),
        btn('Σ', 'Sum the selection', autoSum), btn('↑↓', 'Sort by this column', sortCol), btn('📊', 'Chart the selection', chart), btn('🧹', 'Clear selection', () => clearRange()), h('span', { class: 'ob-sep' }),
        btn('⬆', 'Import CSV', importCSV), btn('⬇', 'Export CSV', () => PatOS.downloadFile(nameIn.value + '.csv', toCSV())));
      fill.oninput = () => setProp('bg', fill.value); tcol.oninput = () => setProp('fg', tcol.value);
      const grid = h('div', { class: 'sh-grid', tabindex: '0' });
      const status = h('div', { class: 'sh-status' });
      win.body.append(bar, h('div', { class: 'sh-fxrow' }, refBox, h('span', { class: 'sh-fxl' }, 'fx'), fx), h('div', { class: 'sh-scroll' }, grid), status);

      // build grid
      grid.style.gridTemplateColumns = `46px repeat(${COLS}, 100px)`;
      grid.appendChild(h('div', { class: 'sh-h sh-corner' }));
      for (let c = 0; c < COLS; c++) grid.appendChild(h('div', { class: 'sh-h', 'data-c': c, onclick: () => { anchor = { c, r: 0 }; sel = { c, r: ROWS - 1 }; paintSel(); } }, colName(c)));
      const cells = [];
      for (let r = 0; r < ROWS; r++) {
        grid.appendChild(h('div', { class: 'sh-h sh-rh', onclick: () => { anchor = { c: 0, r }; sel = { c: COLS - 1, r }; paintSel(); } }, r + 1));
        const row = [];
        for (let c = 0; c < COLS; c++) { const el = h('div', { class: 'sh-c', 'data-c': c, 'data-r': r }); row.push(el); grid.appendChild(el); }
        cells.push(row);
      }
      // evaluation with cache + cycle detection
      let cache = {};
      function raw(ref) { return data[ref] ? data[ref].v : ''; }
      function value(ref, stack) {
        if (ref in cache) return cache[ref];
        const v = raw(ref);
        if (typeof v !== 'string' || v[0] !== '=') { cache[ref] = v === '' ? '' : isNaN(+v) ? v : +v; return cache[ref]; }
        stack = stack || new Set(); if (stack.has(ref)) return '#CIRCULAR'; stack.add(ref);
        let out;
        try {
          const f = compile(v.slice(1));
          const C = (x) => { const r = value(x, stack); return r; };
          const R = (a, b) => { const p = parseRef(a), q = parseRef(b); const res = []; for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) res.push(value(refName(c, r), stack)); return res; };
          out = f(R, C, FN);
          if (typeof out === 'number' && !isFinite(out)) out = '#DIV/0!';
          if (Array.isArray(out)) out = out[0];
        } catch (e) { out = '#ERROR'; }
        stack.delete(ref);
        cache[ref] = out; return out;
      }
      function show(v, d) {
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (typeof v === 'number') {
          if (d && d.nf === 'cur') return v.toLocaleString(undefined, { style: 'currency', currency: PatOS.currency || 'CAD' });
          if (d && d.nf === 'pct') return (v * 100).toFixed(1) + '%';
          if (d && d.nf === 'dec') return v.toFixed(2);
          return String(+v.toPrecision(12));
        }
        return v == null ? '' : String(v);
      }
      function renderAll() {
        cache = {};
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const ref = refName(c, r), d = data[ref], el = cells[r][c];
          if (!d) { if (el.textContent || el.style.cssText) { el.textContent = ''; el.style.cssText = ''; el.className = 'sh-c'; } continue; }
          const v = value(ref);
          el.textContent = show(v, d);
          el.className = 'sh-c' + (d.b ? ' b' : '') + (d.i ? ' i' : '') + (typeof v === 'number' ? ' n' : '') + (String(v)[0] === '#' ? ' err' : '');
          el.style.cssText = (d.bg ? 'background:' + d.bg + ';' : '') + (d.fg ? 'color:' + d.fg + ';' : '') + (d.al ? 'text-align:' + d.al + ';' : '');
        }
        paintSel();
      }
      function range() { const a = anchor || sel; return { c1: Math.min(a.c, sel.c), c2: Math.max(a.c, sel.c), r1: Math.min(a.r, sel.r), r2: Math.max(a.r, sel.r) }; }
      function eachSel(fn) { const g = range(); for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) fn(refName(c, r), c, r); }
      function paintSel() {
        grid.querySelectorAll('.sel, .in').forEach((e) => e.classList.remove('sel', 'in'));
        const g = range(); let sum = 0, cnt = 0, numc = 0;
        for (let r = g.r1; r <= Math.min(g.r2, ROWS - 1); r++) for (let c = g.c1; c <= g.c2; c++) { cells[r][c].classList.add('in'); const v = value(refName(c, r)); if (v !== '') cnt++; if (typeof v === 'number') { sum += v; numc++; } }
        cells[sel.r][sel.c].classList.add('sel');
        const ref = refName(sel.c, sel.r); refBox.textContent = g.c1 !== g.c2 || g.r1 !== g.r2 ? refName(g.c1, g.r1) + ':' + refName(g.c2, g.r2) : ref;
        if (document.activeElement !== fx) fx.value = raw(ref);
        status.textContent = numc > 1 ? 'Sum: ' + +sum.toPrecision(10) + '   Average: ' + +(sum / numc).toPrecision(10) + '   Count: ' + cnt : cnt + ' filled';
        const el = cells[sel.r][sel.c]; const sc = grid.parentNode;
        if (el.offsetTop < sc.scrollTop + 26) sc.scrollTop = el.offsetTop - 26; else if (el.offsetTop + 26 > sc.scrollTop + sc.clientHeight) sc.scrollTop = el.offsetTop + 26 - sc.clientHeight;
        if (el.offsetLeft < sc.scrollLeft + 46) sc.scrollLeft = el.offsetLeft - 46; else if (el.offsetLeft + 100 > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = el.offsetLeft + 100 - sc.clientWidth;
      }
      const history = [];
      function snap() { history.push(JSON.stringify(data)); if (history.length > 60) history.shift(); }
      function undo() { if (!history.length) return; data = JSON.parse(history.pop()); renderAll(); persist(); }
      const persist = PatOS.debounce(() => { try { PatOS.fs.write(path, /\.csv$/i.test(path) ? toCSV() : JSON.stringify({ cells: data })); saved.textContent = 'Saved'; } catch (e) { saved.textContent = 'Not saved'; } }, 600);
      function setCell(ref, v) { if (v === '' || v == null) { if (data[ref]) { delete data[ref].v; if (Object.keys(data[ref]).length === 0) delete data[ref]; else data[ref].v = ''; } } else (data[ref] = data[ref] || {}).v = String(v); }
      function commit(v) { snap(); setCell(refName(sel.c, sel.r), v); saved.textContent = 'Saving…'; renderAll(); persist(); }
      function fmt(k) { snap(); const first = data[refName(sel.c, sel.r)]; const on = !(first && first[k]); eachSel((ref) => { data[ref] = data[ref] || { v: '' }; if (on) data[ref][k] = 1; else delete data[ref][k]; }); renderAll(); persist(); }
      function setProp(k, v) { snap(); eachSel((ref) => { data[ref] = data[ref] || { v: '' }; if (v == null) delete data[ref][k]; else data[ref][k] = v; }); renderAll(); persist(); }
      function clearRange() { snap(); eachSel((ref) => delete data[ref]); renderAll(); persist(); }
      function autoSum() { const g = range(); const target = refName(g.c1, g.r2 + 1 < ROWS ? g.r2 + 1 : g.r2); snap(); (data[target] = data[target] || {}).v = `=SUM(${refName(g.c1, g.r1)}:${refName(g.c1, g.r2)})`; anchor = null; sel = parseRef(target); renderAll(); persist(); }
      function sortCol() {
        snap(); const col = sel.c; let last = 0; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (data[refName(c, r)]) last = Math.max(last, r);
        const header = data[refName(col, 0)] && isNaN(+raw(refName(col, 0))) ? 1 : 0;
        const rows = []; for (let r = header; r <= last; r++) { const row = []; for (let c = 0; c < COLS; c++) row.push(data[refName(c, r)]); rows.push({ key: value(refName(col, r)), row }); }
        const asc = !(win._asc = !win._asc) ? -1 : 1;
        rows.sort((a, b) => { const x = a.key, y = b.key; if (x === '' || x == null) return 1; if (y === '' || y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * asc; });
        rows.forEach((o, i) => o.row.forEach((d, c) => { const ref = refName(c, i + header); if (d) data[ref] = d; else delete data[ref]; }));
        renderAll(); persist();
      }
      function chart() {
        const g = range(); const labels = [], vals = [];
        for (let r = g.r1; r <= g.r2; r++) { const v = value(refName(g.c2, r)); if (typeof v !== 'number') continue; labels.push(g.c1 !== g.c2 ? show(value(refName(g.c1, r))) : refName(g.c2, r)); vals.push(v); }
        if (!vals.length) return PatOS.alertBox('Select some numbers first', 'Pick a column of numbers (and the labels to its left), then press Chart.', { icon: 'sheets' });
        const cv = h('canvas', { width: 560, height: 300, class: 'sh-chart' });
        const layer = h('div', { class: 'dlg-layer' }, h('div', { class: 'dlg sh-chartbox' }, h('b', {}, 'Chart'), cv, h('div', { class: 'dlg-btns' }, h('button', { class: 'btn primary', onclick: () => layer.remove() }, 'Done'))));
        layer.addEventListener('click', (e) => { if (e.target === layer) layer.remove(); });
        document.body.appendChild(layer);
        const x = cv.getContext('2d'); const max = Math.max(...vals, 0), min = Math.min(...vals, 0); const W = 560, H = 300, pad = 36, bw = (W - pad * 2) / vals.length;
        const fg = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#888';
        x.strokeStyle = 'rgba(128,128,128,.25)'; x.fillStyle = fg; x.font = '11px system-ui';
        for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4, y = H - pad - (v - min) / (max - min || 1) * (H - pad * 2); x.beginPath(); x.moveTo(pad, y); x.lineTo(W - 10, y); x.stroke(); x.fillText(+v.toPrecision(4), 2, y + 4); }
        vals.forEach((v, i) => {
          const y0 = H - pad - (0 - min) / (max - min || 1) * (H - pad * 2), y1 = H - pad - (v - min) / (max - min || 1) * (H - pad * 2);
          const gr = x.createLinearGradient(0, y1, 0, y0); gr.addColorStop(0, '#34c759'); gr.addColorStop(1, '#0f9d58'); x.fillStyle = gr;
          x.beginPath(); x.roundRect ? x.roundRect(pad + i * bw + bw * 0.15, Math.min(y0, y1), bw * 0.7, Math.abs(y0 - y1) || 1, 4) : x.rect(pad + i * bw + bw * 0.15, Math.min(y0, y1), bw * 0.7, Math.abs(y0 - y1) || 1); x.fill();
          x.fillStyle = fg; x.textAlign = 'center'; x.fillText(String(labels[i]).slice(0, 10), pad + i * bw + bw / 2, H - pad + 14); x.textAlign = 'left';
        });
      }
      function splitCSV(line) { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
      function toCSV() { let last = -1, lc = -1; Object.keys(data).forEach((k) => { const p = parseRef(k); if (p) { last = Math.max(last, p.r); lc = Math.max(lc, p.c); } }); const lines = []; for (let r = 0; r <= last; r++) { const row = []; for (let c = 0; c <= lc; c++) { const s = show(value(refName(c, r))); row.push(/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s); } lines.push(row.join(',')); } return lines.join('\n'); }
      function importCSV() { const i = h('input', { type: 'file', accept: '.csv,text/csv' }); i.onchange = () => { const r = new FileReader(); r.onload = () => { snap(); data = {}; r.result.split(/\r?\n/).forEach((line, y) => splitCSV(line).forEach((v, x) => { if (v !== '' && x < COLS && y < ROWS) data[refName(x, y)] = { v }; })); renderAll(); persist(); }; r.readAsText(i.files[0]); }; i.click(); }

      // editing
      function startEdit(initial) {
        const el = cells[sel.r][sel.c];
        editing = h('input', { class: 'sh-edit', value: initial != null ? initial : raw(refName(sel.c, sel.r)), spellcheck: 'false' });
        editing.style.left = el.offsetLeft + 'px'; editing.style.top = el.offsetTop + 'px';
        grid.appendChild(editing); editing.focus();
        if (initial == null) editing.select();
        editing.addEventListener('input', () => { fx.value = editing.value; });
        editing.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); finishEdit(true); move(e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0, e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : 0); }
          else if (e.key === 'Escape') { e.stopPropagation(); finishEdit(false); }
        });
        editing.addEventListener('blur', () => finishEdit(true));
      }
      function finishEdit(save) { if (!editing) return; const e = editing; editing = null; if (save) commit(e.value); e.remove(); grid.focus(); }
      function move(dc, dr, extend) { if (extend) { anchor = anchor || { ...sel }; } else anchor = null; sel = { c: Math.max(0, Math.min(COLS - 1, sel.c + dc)), r: Math.max(0, Math.min(ROWS - 1, sel.r + dr)) }; paintSel(); }
      let dragging = false;
      grid.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('.sh-c'); if (!el) return;
        if (editing && editing.value.startsWith('=') && e.target !== editing) { e.preventDefault(); editing.value += refName(+el.dataset.c, +el.dataset.r); fx.value = editing.value; editing.focus(); return; }
        finishEdit(true);
        const p = { c: +el.dataset.c, r: +el.dataset.r };
        if (e.shiftKey) { anchor = anchor || { ...sel }; sel = p; } else { anchor = { ...p }; sel = p; }
        dragging = true; paintSel(); grid.focus();
      });
      grid.addEventListener('pointerover', (e) => { if (!dragging) return; const el = e.target.closest('.sh-c'); if (el) { sel = { c: +el.dataset.c, r: +el.dataset.r }; paintSel(); } });
      window.addEventListener('pointerup', () => { dragging = false; });
      grid.addEventListener('dblclick', (e) => { if (e.target.closest('.sh-c')) startEdit(); });
      grid.addEventListener('keydown', (e) => {
        if (editing) return;
        const k = e.key;
        if (k === 'ArrowUp') { e.preventDefault(); move(0, -1, e.shiftKey); } else if (k === 'ArrowDown') { e.preventDefault(); move(0, 1, e.shiftKey); }
        else if (k === 'ArrowLeft') { e.preventDefault(); move(-1, 0, e.shiftKey); } else if (k === 'ArrowRight' || k === 'Tab') { e.preventDefault(); move(e.shiftKey && k === 'Tab' ? -1 : 1, 0, e.shiftKey && k !== 'Tab'); }
        else if (k === 'Enter' || k === 'F2') { e.preventDefault(); startEdit(); }
        else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); snap(); eachSel((ref) => setCell(ref, '')); renderAll(); persist(); }
        else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'b') { e.preventDefault(); fmt('b'); }
        else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') { const g = range(); const lines = []; for (let r = g.r1; r <= g.r2; r++) { const row = []; for (let c = g.c1; c <= g.c2; c++) row.push(raw(refName(c, r))); lines.push(row.join('\t')); } navigator.clipboard && navigator.clipboard.writeText(lines.join('\n')).catch(() => {}); }
        else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); startEdit(k); }
      });
      grid.addEventListener('paste', (e) => {
        const t = (e.clipboardData || {}).getData && e.clipboardData.getData('text'); if (!t) return; e.preventDefault(); snap();
        t.replace(/\r/g, '').split('\n').forEach((line, y) => line.split('\t').forEach((v, x) => { if (sel.r + y < ROWS && sel.c + x < COLS) setCell(refName(sel.c + x, sel.r + y), v); }));
        renderAll(); persist();
      });
      fx.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(fx.value); move(0, 1); grid.focus(); } if (e.key === 'Escape') { fx.value = raw(refName(sel.c, sel.r)); grid.focus(); } });
      nameIn.addEventListener('change', () => { const ext = /\.csv$/i.test(path) ? '.csv' : '.psheet'; const nn = nameIn.value.trim().replace(/[\/]/g, '-') || PatOS.t('Untitled spreadsheet'); try { path = PatOS.fs.rename(path, PatOS.fs.uniqueName(PatOS.fs.dirname(path), nn + ext)); } catch (e) {} nameIn.value = PatOS.fs.basename(path).replace(/\.(psheet|csv)$/, ''); win.setTitle(nameIn.value); });
      win.setTitle(nameIn.value);
      renderAll(); setTimeout(() => grid.focus(), 60);
    }
  });
  PatOS.sheetsEngine = { compile, FN };
})();
