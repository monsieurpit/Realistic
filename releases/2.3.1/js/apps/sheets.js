/* Sheets — a spreadsheet with formulas, several sheets per file, charts and a fill handle.
   Files are saved as .psheet (or .csv). */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const COLS = 26;
  const colName = (c) => String.fromCharCode(65 + c);
  const parseRef = (r) => { const m = /^\$?([A-Z])\$?(\d+)$/.exec(r); return m ? { c: m[1].charCodeAt(0) - 65, r: +m[2] - 1 } : null; };
  const refName = (c, r) => colName(c) + (r + 1);

  /* ---------- formula engine ---------- */
  const num = (v) => (typeof v === 'number' ? v : v === '' || v == null ? 0 : isNaN(+v) ? 0 : +v);
  const flat = (a) => [].concat(...a.map((x) => (Array.isArray(x) ? flat(x) : [x])));
  const nums = (a) => flat(a).filter((v) => v !== '' && v != null && typeof v !== 'boolean' && !isNaN(+v)).map(Number);
  const rows2d = (range) => { if (!Array.isArray(range)) return [[range]]; const w = range._w || 1; const out = []; for (let i = 0; i < range.length; i += w) out.push(range.slice(i, i + w)); return out; };
  const FN = {
    SUM: (...a) => nums(a).reduce((s, v) => s + v, 0),
    AVERAGE: (...a) => { const n = nums(a); return n.length ? n.reduce((s, v) => s + v, 0) / n.length : 0; },
    MIN: (...a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: (...a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    COUNT: (...a) => nums(a).length,
    COUNTA: (...a) => flat(a).filter((v) => v !== '' && v != null).length,
    COUNTBLANK: (...a) => flat(a).filter((v) => v === '' || v == null).length,
    MEDIAN: (...a) => { const n = nums(a).sort((x, y) => x - y); if (!n.length) return 0; const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
    MODE: (...a) => { const c = {}; let best = null, bc = 0; nums(a).forEach((v) => { c[v] = (c[v] || 0) + 1; if (c[v] > bc) { bc = c[v]; best = v; } }); return best ?? 0; },
    STDEV: (...a) => { const n = nums(a); if (n.length < 2) return 0; const m = n.reduce((s, v) => s + v, 0) / n.length; return Math.sqrt(n.reduce((s, v) => s + (v - m) ** 2, 0) / (n.length - 1)); },
    IF: (c, a, b) => (c ? a : b === undefined ? false : b),
    IFERROR: (a, b) => (typeof a === 'string' && a[0] === '#' ? b : a),
    AND: (...a) => flat(a).every(Boolean), OR: (...a) => flat(a).some(Boolean), NOT: (a) => !a,
    ROUND: (a, d) => { const p = Math.pow(10, num(d)); return Math.round(num(a) * p) / p; },
    ROUNDUP: (a, d) => { const p = Math.pow(10, num(d)); return Math.ceil(num(a) * p) / p; },
    ROUNDDOWN: (a, d) => { const p = Math.pow(10, num(d)); return Math.floor(num(a) * p) / p; },
    ABS: (a) => Math.abs(num(a)), SQRT: (a) => Math.sqrt(num(a)), POWER: (a, b) => Math.pow(num(a), num(b)), MOD: (a, b) => num(a) % num(b),
    INT: (a) => Math.floor(num(a)), PI: () => Math.PI, RAND: () => Math.random(), RANDBETWEEN: (a, b) => Math.floor(num(a) + Math.random() * (num(b) - num(a) + 1)),
    CONCAT: (...a) => flat(a).join(''), CONCATENATE: (...a) => flat(a).join(''), LEN: (a) => String(a).length, UPPER: (a) => String(a).toUpperCase(), LOWER: (a) => String(a).toLowerCase(),
    PROPER: (a) => String(a).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()), TRIM: (a) => String(a).trim().replace(/\s+/g, ' '),
    LEFT: (a, n) => String(a).slice(0, n === undefined ? 1 : num(n)), RIGHT: (a, n) => String(a).slice(-(n === undefined ? 1 : num(n))),
    MID: (a, s, n) => String(a).substr(num(s) - 1, num(n)), SUBSTITUTE: (a, f, t) => String(a).split(String(f)).join(String(t)),
    FIND: (f, a) => { const i = String(a).indexOf(String(f)); return i < 0 ? '#VALUE!' : i + 1; },
    TODAY: () => new Date().toLocaleDateString(), NOW: () => new Date().toLocaleString(),
    COUNTIF: (range, crit) => flat([range]).filter((v) => matchCrit(v, crit)).length,
    SUMIF: (range, crit, sumRange) => { const r = flat([range]), s = sumRange ? flat([sumRange]) : r; return r.reduce((t, v, i) => t + (matchCrit(v, crit) ? num(s[i]) : 0), 0); },
    AVERAGEIF: (range, crit, avgRange) => { const r = flat([range]), s = avgRange ? flat([avgRange]) : r; let t = 0, n = 0; r.forEach((v, i) => { if (matchCrit(v, crit)) { t += num(s[i]); n++; } }); return n ? t / n : '#DIV/0!'; },
    VLOOKUP: (key, range, col, rangeLookup) => {
      // like Excel and (as in other spreadsheets) the 4th argument FALSE means exact match; text keys always match exactly
      const rs = rows2d(range); const c = num(col) - 1;
      const approx = (rangeLookup === undefined ? true : !!rangeLookup) && key !== '' && !isNaN(+key);
      if (!approx) { for (const row of rs) if (String(row[0]).toLowerCase() === String(key).toLowerCase()) return row[c] ?? '#REF!'; return '#N/A'; }
      let best = null; for (const row of rs) { if (row[0] === '' || isNaN(+row[0])) continue; if (+row[0] <= +key) best = row; else break; }
      return best ? best[c] ?? '#REF!' : '#N/A';
    },
    HLOOKUP: (key, range, row) => { const rs = rows2d(range); const i = rs[0].findIndex((v) => String(v).toLowerCase() === String(key).toLowerCase()); return i < 0 ? '#N/A' : (rs[num(row) - 1] || [])[i] ?? '#REF!'; },
    MATCH: (key, range) => { const i = flat([range]).findIndex((v) => String(v).toLowerCase() === String(key).toLowerCase()); return i < 0 ? '#N/A' : i + 1; },
    INDEX: (range, r, c) => { const rs = rows2d(range); return (rs[num(r) - 1] || [])[(c === undefined ? 1 : num(c)) - 1] ?? '#REF!'; }
  };
  const HINTS = { SUM: 'SUM(range)', AVERAGE: 'AVERAGE(range)', MIN: 'MIN(range)', MAX: 'MAX(range)', COUNT: 'COUNT(range)', COUNTA: 'COUNTA(range)', IF: 'IF(test, if_true, if_false)', IFERROR: 'IFERROR(value, if_error)', ROUND: 'ROUND(number, digits)', VLOOKUP: 'VLOOKUP(key, range, column, [exact])', COUNTIF: 'COUNTIF(range, ">5")', SUMIF: 'SUMIF(range, criteria, [sum_range])', AVERAGEIF: 'AVERAGEIF(range, criteria, [avg_range])', CONCAT: 'CONCAT(text1, text2, …)', INDEX: 'INDEX(range, row, [column])', MATCH: 'MATCH(key, range)', LEFT: 'LEFT(text, count)', RIGHT: 'RIGHT(text, count)', MID: 'MID(text, start, count)', TODAY: 'TODAY()', MEDIAN: 'MEDIAN(range)', STDEV: 'STDEV(range)', RANDBETWEEN: 'RANDBETWEEN(low, high)' };
  function matchCrit(v, crit) {
    const m = /^(>=|<=|<>|>|<|=)?(.*)$/.exec(String(crit)); const op = m[1] || '=', x = m[2];
    const a = isNaN(+v) || v === '' ? String(v).toLowerCase() : +v, b = isNaN(+x) || x === '' ? x.toLowerCase() : +x;
    return op === '=' ? a == b : op === '<>' ? a != b : op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : a <= b;
  }
  const compiled = new Map();
  function compile(src) {
    if (compiled.has(src)) return compiled.get(src);
    const strs = []; let s = src.replace(/"([^"]*)"/g, (_, x) => { strs.push(x); return '§' + (strs.length - 1) + '§'; });
    s = s.toUpperCase().replace(/\$/g, '');
    if (/[^A-Z0-9_.,:+\-*/^()<>=&%§ ]/.test(s)) throw new Error('bad');
    s = s.replace(/([A-Z])(\d+):([A-Z])(\d+)/g, 'R("$1$2","$3$4")');
    s = s.replace(/\b([A-Z]+)\s*\(/g, (m, f) => { if (f === 'R') return m; if (!FN[f]) throw new Error('fn'); return 'F.' + f + '('; });
    s = s.replace(/(^|[^A-Z."§])([A-Z])(\d+)\b/g, '$1C("$2$3")');
    s = s.replace(/\bTRUE\b/g, 'true').replace(/\bFALSE\b/g, 'false');
    s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)').replace(/\^/g, '**').replace(/<>/g, '!=').replace(/([^<>!=])=(?!=)/g, '$1==').replace(/&/g, '+""+');
    if (/[A-Z]{2,}(?!\()/.test(s.replace(/F\.[A-Z]+\(|"[^"]*"|true|false/g, ''))) throw new Error('name');
    s = s.replace(/§(\d+)§/g, (_, i) => JSON.stringify(strs[+i]));
    const f = Function('R', 'C', 'F', '"use strict";return (' + s + ');');
    compiled.set(src, f); if (compiled.size > 2000) compiled.clear();
    return f;
  }
  /* move cell references in a formula (fill handle, insert/delete rows and columns) */
  function shiftRefs(formula, fn) {
    if (typeof formula !== 'string' || formula[0] !== '=') return formula;
    const parts = formula.split(/("[^"]*")/);
    return parts.map((p, i) => (i % 2 ? p : p.replace(/(\$?)([A-Z])(\$?)(\d+)(?![A-Z(\d])/gi, (m, dc, c, dr, r) => {
      const out = fn({ c: c.toUpperCase().charCodeAt(0) - 65, r: +r - 1, absC: !!dc, absR: !!dr });
      if (!out) return '#REF!';
      return dc + colName(out.c) + dr + (out.r + 1);
    }))).join('');
  }

  /* a standalone evaluator, used when saving as Excel (works on any sheet, not just the open one) */
  function makeEvaluator(cells) {
    const cache = {}; const raw = (ref) => (cells[ref] ? cells[ref].v ?? '' : '');
    function value(ref, stack) {
      if (ref in cache) return cache[ref];
      const v = raw(ref);
      if (typeof v !== 'string' || v[0] !== '=') { cache[ref] = v === '' ? '' : v === 'TRUE' ? true : v === 'FALSE' ? false : isNaN(+v) || (cells[ref] && cells[ref].nf === 'text') ? v : +v; return cache[ref]; }
      stack = stack || new Set(); if (stack.has(ref)) return '#CIRCULAR'; stack.add(ref);
      let out;
      try {
        const f = compile(v.slice(1));
        const R = (a, b) => { const p = parseRef(a), q = parseRef(b); const res = []; for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) res.push(value(refName(c, r), stack)); res._w = Math.abs(q.c - p.c) + 1; return res; };
        out = f(R, (x) => value(x, stack), FN);
        if (typeof out === 'number' && !isFinite(out)) out = '#DIV/0!';
        if (Array.isArray(out)) out = out[0];
      } catch (e) { out = e.message === 'fn' ? '#NAME?' : '#ERROR!'; }
      stack.delete(ref); cache[ref] = out; return out;
    }
    return value;
  }

  const TEMPLATES = [
    { name: 'Blank spreadsheet', cells: () => ({}), preview: '<s></s>' },
    { name: 'Budget', sub: 'Income and spending', cells: () => ({ A1: { v: T('Monthly budget'), b: 1, fs: 16 }, A3: { v: T('Category'), b: 1, bg: '#e6f4ea' }, B3: { v: T('Planned'), b: 1, bg: '#e6f4ea' }, C3: { v: T('Actual'), b: 1, bg: '#e6f4ea' }, D3: { v: T('Difference'), b: 1, bg: '#e6f4ea' }, A4: { v: T('Food') }, B4: { v: '200', nf: 'cur' }, C4: { v: '185', nf: 'cur' }, D4: { v: '=B4-C4', nf: 'cur' }, A5: { v: T('Transport') }, B5: { v: '60', nf: 'cur' }, C5: { v: '72', nf: 'cur' }, D5: { v: '=B5-C5', nf: 'cur' }, A6: { v: T('Fun') }, B6: { v: '80', nf: 'cur' }, C6: { v: '64', nf: 'cur' }, D6: { v: '=B6-C6', nf: 'cur' }, A7: { v: T('Savings') }, B7: { v: '100', nf: 'cur' }, C7: { v: '100', nf: 'cur' }, D7: { v: '=B7-C7', nf: 'cur' }, A8: { v: T('Total'), b: 1 }, B8: { v: '=SUM(B4:B7)', b: 1, nf: 'cur' }, C8: { v: '=SUM(C4:C7)', b: 1, nf: 'cur' }, D8: { v: '=SUM(D4:D7)', b: 1, nf: 'cur' } }), preview: '<b>$</b><em></em><em></em><em></em>' },
    { name: 'Grade tracker', cells: () => ({ A1: { v: T('Grades'), b: 1, fs: 16 }, A3: { v: T('Assignment'), b: 1, bg: '#e8f0fe' }, B3: { v: T('Score'), b: 1, bg: '#e8f0fe' }, C3: { v: T('Out of'), b: 1, bg: '#e8f0fe' }, D3: { v: '%', b: 1, bg: '#e8f0fe' }, A4: { v: T('Quiz 1') }, B4: { v: '18' }, C4: { v: '20' }, D4: { v: '=B4/C4', nf: 'pct' }, A5: { v: T('Project') }, B5: { v: '45' }, C5: { v: '50' }, D5: { v: '=B5/C5', nf: 'pct' }, A6: { v: T('Test') }, B6: { v: '71' }, C6: { v: '80' }, D6: { v: '=B6/C6', nf: 'pct' }, A8: { v: T('Average'), b: 1 }, D8: { v: '=SUM(B4:B6)/SUM(C4:C6)', b: 1, nf: 'pct' } }), preview: '<b>A+</b><em></em><em></em>' },
    { name: 'Weekly schedule', cells: () => { const d = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']; const c = { A1: { v: T('Weekly schedule'), b: 1, fs: 16 }, A3: { v: T('Time'), b: 1, bg: '#fef7e0' } }; d.forEach((x, i) => { c[colName(i + 1) + '3'] = { v: T(x), b: 1, bg: '#fef7e0', al: 'center' }; }); ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'].forEach((t, i) => { c['A' + (i + 4)] = { v: t, b: 1 }; }); return c; }, preview: '<s></s>' },
    { name: 'To-do list', cells: () => ({ A1: { v: T('To-do list'), b: 1, fs: 16 }, A3: { v: T('Task'), b: 1, bg: '#fce8e6' }, B3: { v: T('Due'), b: 1, bg: '#fce8e6' }, C3: { v: T('Done?'), b: 1, bg: '#fce8e6' }, A4: { v: T('First thing') }, C4: { v: 'FALSE' }, A5: { v: T('Second thing') }, C5: { v: 'FALSE' }, A7: { v: T('Done'), b: 1 }, C7: { v: '=COUNTIF(C4:C5,"TRUE")&" / "&COUNTA(A4:A5)' } }), preview: '<em></em><em></em><em></em>' }
  ];

  PatOS.registerApp({
    id: 'sheets', name: 'Tables', icon: 'sheets', single: false, width: 1100, height: 720, category: 'Office', keywords: 'spreadsheet excel table formulas sheets numbers tableur',
    about: 'Spreadsheets with formulas, several sheets, charts and a fill handle.',
    launch(win, args) {
      win.el.classList.add('office-win', 'sx-win');
      win.setTitle(T('Tables'));
      if (args.path) return openSheet(win, args.path);
      PatOS.office.startScreen(win, {
        title: 'Tables', icon: 'sheets', ext: ['psheet', 'csv'], templates: TEMPLATES,
        onCreate: (t) => { const p = PatOS.newDocPath('/Documents', t.name === 'Blank spreadsheet' ? 'Untitled spreadsheet' : t.name, 'psheet'); PatOS.fs.write(p, JSON.stringify({ sheets: [{ name: T('Sheet') + ' 1', cells: t.cells(), colW: {} }], active: 0 })); openSheet(win, p); },
        onOpen: (p) => openSheet(win, p),
        importLabel: 'Open an Excel file…', importAccept: '.xlsx,.csv', onImportFile: async (file) => { if (/\.csv$/i.test(file.name)) { const p = '/Documents/' + PatOS.fs.uniqueName('/Documents', file.name); PatOS.fs.write(p, await file.text()); return p; } return (await PatOS.importOffice(file, file.name)).path; }
      });
    }
  });

  function splitCSV(line) { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

  function openSheet(win, path) {
    PatOS.remember && PatOS.remember(win, { path });
    const OF = PatOS.office;
    win.el.classList.add('has-toolbar');
    const isCSV = /\.csv$/i.test(path);
    let book;
    const rawText = PatOS.fs.read(path) || '';
    if (isCSV) { const cells = {}; rawText.split(/\r?\n/).forEach((line, r) => splitCSV(line).forEach((v, c) => { if (v !== '' && c < COLS) cells[refName(c, r)] = { v }; })); book = { sheets: [{ name: T('Sheet') + ' 1', cells, colW: {} }], active: 0 }; }
    else { try { const j = JSON.parse(rawText); book = j.sheets ? j : { sheets: [{ name: T('Sheet') + ' 1', cells: j.cells || {}, colW: {} }], active: 0 }; } catch (e) { book = { sheets: [{ name: T('Sheet') + ' 1', cells: {}, colW: {} }], active: 0 }; } }
    let sh = book.sheets[book.active] || book.sheets[0];
    let data = sh.cells;
    let ROWS = Math.max(100, sh.rows || 100);
    let sel = { c: 0, r: 0 }, anchor = null, editing = null;
    const baseName = () => PatOS.fs.basename(path).replace(/\.(psheet|csv)$/, '');
    const head = OF.header(win, {
      name: baseName(), icon: 'sheets', getPath: () => path,
      onRename: (nn) => { nn = (nn || T('Untitled spreadsheet')).replace(/[\/]/g, '-'); try { path = PatOS.fs.rename(path, PatOS.fs.uniqueName(PatOS.fs.dirname(path), nn + (isCSV ? '.csv' : '.psheet'))); PatOS.remember && PatOS.remember(win, { path }); } catch (e) {} head.name.value = baseName(); win.setTitle(baseName()); }
    });
    win.toolbar.append(head.el); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
    win.setTitle(baseName());

    /* ---------- toolbar ---------- */
    const B = OF.btn;
    const nfSel = h('select', { class: 'of-sel', title: T('Number format') }, ...[['', 'Automatic'], ['num', 'Number'], ['dec', '0.00'], ['cur', 'Currency'], ['pct', 'Percent'], ['date', 'Date'], ['text', 'Plain text']].map(([v, l]) => h('option', { value: v }, T(l))));
    nfSel.onchange = () => setProp('nf', nfSel.value || null);
    const fsSel = h('select', { class: 'of-sel sm', title: T('Font size') }, ...[10, 11, 13, 14, 16, 18, 24, 30].map((s) => h('option', { value: s }, s)));
    fsSel.value = '13'; fsSel.onchange = () => setProp('fs', +fsSel.value === 13 ? null : +fsSel.value);
    const tbB = B('bold', 'Bold (Ctrl+B)', () => fmt('b')), tbI = B('italic', 'Italic (Ctrl+I)', () => fmt('i')), tbS = B('strike', 'Strikethrough', () => fmt('s'));
    const toolbar = h('div', { class: 'of-bar' },
      B('undo', 'Undo (Ctrl+Z)', undo), B('redo', 'Redo (Ctrl+Y)', redo), OF.sep(),
      nfSel, B('<b class="of-t">.0</b>', 'Fewer decimals', () => decimals(-1)), B('<b class="of-t">.00</b>', 'More decimals', () => decimals(1)), OF.sep(),
      fsSel, tbB, tbI, tbS,
      B('color', 'Text color', (e, b) => OF.colorPicker(b, (c) => { setProp('fg', c); b.style.setProperty('--sw', c || '#000'); }), { cls: 'swatch' }),
      B('fill', 'Fill color', (e, b) => OF.colorPicker(b, (c) => setProp('bg', c), { none: true })),
      B('border', 'Borders', (e, b) => { const p = OF.pop(b, h('div', { class: 'of-list' }, ...[['all', 'All borders'], ['outer', 'Outside borders'], ['bottom', 'Bottom border'], ['none', 'No borders']].map(([k, l]) => h('button', { onclick: () => { borders(k); p.close(); } }, T(l))))); }), OF.sep(),
      B('left', 'Align left', () => setProp('al', 'left')), B('center', 'Center', () => setProp('al', 'center')), B('right', 'Align right', () => setProp('al', 'right')), B('wrap', 'Wrap text', () => fmt('w')), OF.sep(),
      B('sum', 'Sum (Alt+=)', autoSum), B('sort', 'Sort column', (e, b) => { const p = OF.pop(b, h('div', { class: 'of-list' }, h('button', { onclick: () => { sortCol(1); p.close(); } }, T('Sort A → Z')), h('button', { onclick: () => { sortCol(-1); p.close(); } }, T('Sort Z → A')))); }),
      B('filter', 'Filter', toggleFilter), B('chart', 'Insert chart', chart), B('search', 'Find (Ctrl+F)', find), OF.sep(),
      B('rowabove', 'Insert row', () => insertRow(sel.r)), B('colleft', 'Insert column', () => insertCol(sel.c)), B('trash', 'Clear', () => clearRange()));
    const fx = h('input', { class: 'sh-fx', spellcheck: 'false', placeholder: T('Type a value or a formula like =SUM(A1:A5)') });
    const refBox = h('input', { class: 'sh-ref', title: T('Go to cell'), spellcheck: 'false' });
    const grid = h('div', { class: 'sh-grid', tabindex: '0' });
    const scroll = h('div', { class: 'sh-scroll' }, grid);
    const status = h('div', { class: 'sh-status sx-status' });
    const tabs = h('div', { class: 'sx-tabs' });
    const ac = h('div', { class: 'sx-ac' });
    win.body.append(toolbar, h('div', { class: 'sh-fxrow' }, refBox, h('span', { class: 'sh-fxl' }, 'fx'), fx), scroll, h('div', { class: 'sx-foot' }, tabs, status), ac);
    head.right.append(h('button', { class: 'btn primary of-share', onclick: (e) => download(e.currentTarget), html: OF.icon('download', 15) + '<span>' + T('Download') + '</span>' }));

    /* ---------- grid ---------- */
    let cells = [], headers = [], rowHeads = [];
    const colW = (c) => (sh.colW && sh.colW[c]) || 100;
    function buildGrid() {
      grid.innerHTML = ''; cells = []; headers = []; rowHeads = [];
      grid.style.gridTemplateColumns = '46px ' + Array.from({ length: COLS }, (_, c) => colW(c) + 'px').join(' ');
      grid.appendChild(h('div', { class: 'sh-h sh-corner', onclick: () => { anchor = { c: 0, r: 0 }; sel = { c: COLS - 1, r: ROWS - 1 }; paintSel(); } }));
      for (let c = 0; c < COLS; c++) {
        const hd = h('div', { class: 'sh-h', 'data-c': c }, colName(c), h('i', { class: 'sx-rz', 'data-c': c }));
        hd.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('sx-rz')) return resizeCol(e, c); anchor = { c, r: 0 }; sel = { c, r: ROWS - 1 }; paintSel(); });
        hd.addEventListener('contextmenu', (e) => { e.preventDefault(); PatOS.menu([{ label: T('Insert column left'), action: () => insertCol(c) }, { label: T('Insert column right'), action: () => insertCol(c + 1) }, { label: T('Delete column'), action: () => deleteCol(c) }, { divider: true }, { label: T('Sort A → Z'), action: () => { sel.c = c; sortCol(1); } }, { label: T('Sort Z → A'), action: () => { sel.c = c; sortCol(-1); } }, { label: T('Fit to content'), action: () => fitCol(c) }], e.clientX, e.clientY); });
        hd.addEventListener('dblclick', (e) => { if (e.target.classList.contains('sx-rz')) fitCol(c); });
        headers.push(hd); grid.appendChild(hd);
      }
      for (let r = 0; r < ROWS; r++) {
        const rh = h('div', { class: 'sh-h sh-rh' }, r + 1);
        rh.addEventListener('pointerdown', () => { anchor = { c: 0, r }; sel = { c: COLS - 1, r }; paintSel(); });
        rh.addEventListener('contextmenu', (e) => { e.preventDefault(); PatOS.menu([{ label: T('Insert row above'), action: () => insertRow(r) }, { label: T('Insert row below'), action: () => insertRow(r + 1) }, { label: T('Delete row'), action: () => deleteRow(r) }], e.clientX, e.clientY); });
        rowHeads.push(rh); grid.appendChild(rh);
        const row = [];
        for (let c = 0; c < COLS; c++) { const el = h('div', { class: 'sh-c', 'data-c': c, 'data-r': r }); row.push(el); grid.appendChild(el); }
        cells.push(row);
      }
      const more = h('button', { class: 'sx-more', onclick: () => { ROWS += 100; sh.rows = ROWS; buildGrid(); renderAll(); persist(); } }, '+ ' + T('Add 100 rows'));
      more.style.gridColumn = '1 / -1'; grid.appendChild(more);
      grid.appendChild(handle);
    }
    const handle = h('div', { class: 'sx-handle', title: T('Drag to fill') });

    /* ---------- evaluation ---------- */
    let cache = {};
    const raw = (ref) => (data[ref] ? data[ref].v ?? '' : '');
    function value(ref, stack) {
      if (ref in cache) return cache[ref];
      const v = raw(ref);
      if (typeof v !== 'string' || v[0] !== '=') { cache[ref] = v === '' ? '' : v === 'TRUE' ? true : v === 'FALSE' ? false : isNaN(+v) || (data[ref] && data[ref].nf === 'text') ? v : +v; return cache[ref]; }
      stack = stack || new Set(); if (stack.has(ref)) return '#CIRCULAR'; stack.add(ref);
      let out;
      try {
        const f = compile(v.slice(1));
        const C = (x) => value(x, stack);
        const R = (a, b) => { const p = parseRef(a), q = parseRef(b); const res = []; for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) res.push(value(refName(c, r), stack)); res._w = Math.abs(q.c - p.c) + 1; return res; };
        out = f(R, C, FN);
        if (typeof out === 'number' && !isFinite(out)) out = '#DIV/0!';
        if (Array.isArray(out)) out = out[0];
      } catch (e) { out = e.message === 'fn' ? '#NAME?' : '#ERROR!'; }
      stack.delete(ref);
      cache[ref] = out; return out;
    }
    function show(v, d) {
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      if (typeof v === 'number') {
        const dp = d && d.dp != null ? d.dp : null;
        const nf = d && d.nf;
        if (nf === 'cur') return v.toLocaleString(PatOS.locale, { style: 'currency', currency: PatOS.currency || 'CAD', minimumFractionDigits: dp ?? 2, maximumFractionDigits: dp ?? 2 });
        if (nf === 'pct') return (v * 100).toFixed(dp ?? 1) + '%';
        if (nf === 'dec') return v.toLocaleString(PatOS.locale, { minimumFractionDigits: dp ?? 2, maximumFractionDigits: dp ?? 2 });
        if (nf === 'num') return v.toLocaleString(PatOS.locale, { minimumFractionDigits: dp ?? 0, maximumFractionDigits: dp ?? 2 });
        if (nf === 'date') { const dt = new Date((v - 25569) * 86400000); return isNaN(dt) ? String(v) : dt.toLocaleDateString(PatOS.locale); }
        if (dp != null) return v.toFixed(dp);
        return String(+v.toPrecision(12));
      }
      return v == null ? '' : String(v);
    }
    let filter = null; // { c, hide: Set of values }
    function renderAll() {
      cache = {};
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const ref = refName(c, r), d = data[ref], el = cells[r][c];
        if (!d) { if (el.textContent || el.style.cssText || el.className !== 'sh-c') { el.textContent = ''; el.style.cssText = ''; el.className = 'sh-c'; } continue; }
        const v = value(ref);
        el.textContent = show(v, d);
        el.className = 'sh-c' + (d.b ? ' b' : '') + (d.i ? ' i' : '') + (d.s ? ' s' : '') + (d.w ? ' w' : '') + (typeof v === 'number' ? ' n' : '') + (typeof v === 'boolean' && String(d.v)[0] !== '=' ? ' bool' + (v ? ' yes' : '') : '') + (typeof v === 'string' && /^#[A-Z/0!?]+$/.test(v) ? ' err' : '') + (d.bd ? ' bd-' + d.bd : '');
        el.style.cssText = (d.bg ? 'background:' + d.bg + ';' : '') + (d.fg ? 'color:' + d.fg + ';' : '') + (d.al ? 'text-align:' + d.al + ';' : '') + (d.fs ? 'font-size:' + d.fs + 'px;' : '');
        if (typeof v === 'string' && v[0] === '#') el.title = v === '#NAME?' ? T('Unknown function name') : v === '#CIRCULAR' ? T('This formula refers to itself') : v === '#DIV/0!' ? T('Division by zero') : T('Check the formula'); else el.removeAttribute('title');
      }
      // filtered rows
      for (let r = 0; r < ROWS; r++) {
        const hide = filter && r > filter.r0 && filter.hide.has(show(value(refName(filter.c, r))));
        rowHeads[r].classList.toggle('sx-hide', !!hide); cells[r].forEach((e) => e.classList.toggle('sx-hide', !!hide));
      }
      headers.forEach((hd, c) => hd.classList.toggle('sx-filtered', !!filter && filter.c === c));
      paintSel();
    }
    function range() { const a = anchor || sel; return { c1: Math.min(a.c, sel.c), c2: Math.max(a.c, sel.c), r1: Math.min(a.r, sel.r), r2: Math.max(a.r, sel.r) }; }
    function eachSel(fn) { const g = range(); for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) fn(refName(c, r), c, r); }
    let statMode = PatOS.store.get('sheetsStat', 0);
    function paintSel() {
      grid.querySelectorAll('.sel, .in').forEach((e) => e.classList.remove('sel', 'in'));
      headers.forEach((hd) => hd.classList.remove('on')); rowHeads.forEach((hd) => hd.classList.remove('on'));
      const g = range(); let sum = 0, cnt = 0, numc = 0, mn = Infinity, mx = -Infinity;
      for (let r = g.r1; r <= Math.min(g.r2, ROWS - 1); r++) { rowHeads[r].classList.add('on'); for (let c = g.c1; c <= g.c2; c++) { cells[r][c].classList.add('in'); const v = value(refName(c, r)); if (v !== '') cnt++; if (typeof v === 'number') { sum += v; numc++; mn = Math.min(mn, v); mx = Math.max(mx, v); } } }
      for (let c = g.c1; c <= g.c2; c++) headers[c].classList.add('on');
      cells[sel.r][sel.c].classList.add('sel');
      const ref = refName(sel.c, sel.r);
      if (document.activeElement !== refBox) refBox.value = g.c1 !== g.c2 || g.r1 !== g.r2 ? refName(g.c1, g.r1) + ':' + refName(g.c2, g.r2) : ref;
      if (document.activeElement !== fx) fx.value = raw(ref);
      status.innerHTML = '';
      if (numc > 1) {
        const opts = [[T('Sum'), sum], [T('Average'), sum / numc], [T('Min'), mn], [T('Max'), mx], [T('Count'), cnt]];
        const [l, v] = opts[statMode % opts.length];
        status.appendChild(h('button', { class: 'sx-stat', title: T('Click to change'), onclick: () => { statMode++; PatOS.store.set('sheetsStat', statMode); paintSel(); } }, l + ': ' + (+(+v).toPrecision(10)).toLocaleString(PatOS.locale)));
      } else if (cnt) status.appendChild(h('span', {}, cnt + ' ' + T('filled')));
      // toolbar state
      const d = data[ref] || {};
      tbB.classList.toggle('on', !!d.b); tbI.classList.toggle('on', !!d.i); tbS.classList.toggle('on', !!d.s);
      nfSel.value = d.nf || ''; fsSel.value = String(d.fs || 13);
      // fill handle at the bottom-right of the selection
      const last = cells[g.r2] && cells[g.r2][g.c2];
      if (last) { handle.style.left = (last.offsetLeft + last.offsetWidth - 4) + 'px'; handle.style.top = (last.offsetTop + last.offsetHeight - 4) + 'px'; handle.style.display = editing ? 'none' : ''; }
      const el = cells[sel.r][sel.c];
      if (el.offsetTop < scroll.scrollTop + 26) scroll.scrollTop = el.offsetTop - 26; else if (el.offsetTop + 26 > scroll.scrollTop + scroll.clientHeight) scroll.scrollTop = el.offsetTop + 26 - scroll.clientHeight;
      if (el.offsetLeft < scroll.scrollLeft + 46) scroll.scrollLeft = el.offsetLeft - 46; else if (el.offsetLeft + el.offsetWidth > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = el.offsetLeft + el.offsetWidth - scroll.clientWidth;
    }

    /* ---------- edits, undo, saving ---------- */
    const past = [], future = [];
    function snap() { past.push(JSON.stringify(book)); if (past.length > 80) past.shift(); future.length = 0; }
    function restoreBook(json) { book = JSON.parse(json); sh = book.sheets[book.active] || book.sheets[0]; data = sh.cells; ROWS = Math.max(100, sh.rows || 100); buildGrid(); renderTabs(); renderAll(); persist(); }
    function undo() { if (!past.length) return; future.push(JSON.stringify(book)); restoreBook(past.pop()); }
    function redo() { if (!future.length) return; past.push(JSON.stringify(book)); restoreBook(future.pop()); }
    function toCSV() { let last = -1, lc = -1; Object.keys(data).forEach((k) => { const p = parseRef(k); if (p && raw(k) !== '') { last = Math.max(last, p.r); lc = Math.max(lc, p.c); } }); const lines = []; for (let r = 0; r <= last; r++) { const row = []; for (let c = 0; c <= lc; c++) { const s = show(value(refName(c, r))); row.push(/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s); } lines.push(row.join(',')); } return lines.join('\n'); }
    const persist = PatOS.debounce(() => { try { PatOS.fs.write(path, isCSV ? toCSV() : JSON.stringify(book)); head.saved(); } catch (e) { head.failed(); } }, 500);
    const changed = () => { head.saving(); renderAll(); persist(); };
    function setCell(ref, v) { if (v === '' || v == null) { if (data[ref]) { delete data[ref].v; if (!Object.keys(data[ref]).length) delete data[ref]; } } else (data[ref] = data[ref] || {}).v = String(v); }
    function commit(v) { snap(); const d = data[refName(sel.c, sel.r)]; if (typeof v === 'string' && /^\s*[\d.,]+\s*%\s*$/.test(v) && !(d && d.nf)) { setCell(refName(sel.c, sel.r), String(parseFloat(v.replace(',', '.')) / 100)); data[refName(sel.c, sel.r)].nf = 'pct'; } else setCell(refName(sel.c, sel.r), v); changed(); }
    function fmt(k) { snap(); const first = data[refName(sel.c, sel.r)]; const on = !(first && first[k]); eachSel((ref) => { data[ref] = data[ref] || {}; if (on) data[ref][k] = 1; else delete data[ref][k]; }); changed(); }
    function setProp(k, v) { snap(); eachSel((ref) => { data[ref] = data[ref] || {}; if (v == null) delete data[ref][k]; else data[ref][k] = v; if (!Object.keys(data[ref]).length) delete data[ref]; }); changed(); }
    function decimals(d) { snap(); eachSel((ref) => { const x = data[ref]; if (!x) return; const v = value(ref); if (typeof v !== 'number') return; const cur = x.dp != null ? x.dp : (String(v).split('.')[1] || '').length; x.dp = Math.max(0, Math.min(10, cur + d)); }); changed(); }
    function borders(kind) {
      snap(); const g = range();
      eachSel((ref, c, r) => { data[ref] = data[ref] || {}; let b = ''; if (kind === 'all') b = 'all'; else if (kind === 'bottom' && r === g.r2) b = 'b'; else if (kind === 'outer') b = [r === g.r1 ? 't' : '', r === g.r2 ? 'b' : '', c === g.c1 ? 'l' : '', c === g.c2 ? 'r' : ''].join(''); if (kind === 'none' || !b) delete data[ref].bd; else data[ref].bd = b; if (!Object.keys(data[ref]).length) delete data[ref]; });
      changed();
    }
    function clearRange() { snap(); eachSel((ref) => delete data[ref]); changed(); }
    function autoSum() {
      const g = range(); snap();
      if (g.r1 === g.r2 && g.c1 === g.c2) { let r = sel.r - 1; while (r >= 0 && typeof value(refName(sel.c, r)) === 'number') r--; if (r < sel.r - 1) setCell(refName(sel.c, sel.r), `=SUM(${refName(sel.c, r + 1)}:${refName(sel.c, sel.r - 1)})`); changed(); return; }
      for (let c = g.c1; c <= g.c2; c++) { const t = refName(c, Math.min(ROWS - 1, g.r2 + 1)); setCell(t, `=SUM(${refName(c, g.r1)}:${refName(c, g.r2)})`); }
      anchor = null; sel = { c: g.c1, r: Math.min(ROWS - 1, g.r2 + 1) }; changed();
    }
    function lastRow() { let last = 0; Object.keys(data).forEach((k) => { const p = parseRef(k); if (p && raw(k) !== '') last = Math.max(last, p.r); }); return last; }
    function sortCol(dir) {
      snap(); const col = sel.c, last = lastRow();
      const header = isNaN(+raw(refName(col, 0))) && raw(refName(col, 0)) !== '' ? 1 : 0;
      const rows = []; for (let r = header; r <= last; r++) { const row = []; for (let c = 0; c < COLS; c++) row.push(data[refName(c, r)]); rows.push({ key: value(refName(col, r)), row }); }
      rows.sort((a, b) => { const x = a.key, y = b.key; if (x === '' || x == null) return 1; if (y === '' || y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), PatOS.locale, { numeric: true })) * dir; });
      rows.forEach((o, i) => o.row.forEach((d, c) => { const ref = refName(c, i + header); if (d) data[ref] = d; else delete data[ref]; }));
      changed();
    }
    function remap(fn) {
      const out = {};
      Object.entries(data).forEach(([k, d]) => { const p = parseRef(k); const q = fn(p); if (!q) return; out[refName(q.c, q.r)] = d; });
      Object.values(out).forEach((d) => { if (typeof d.v === 'string' && d.v[0] === '=') d.v = shiftRefs(d.v, fn); });
      data = sh.cells = out;
    }
    function insertRow(at) { snap(); remap((p) => (p.r >= at ? { c: p.c, r: p.r + 1 } : p)); changed(); }
    function deleteRow(at) { snap(); remap((p) => (p.r === at ? null : p.r > at ? { c: p.c, r: p.r - 1 } : p)); changed(); }
    function insertCol(at) { snap(); remap((p) => (p.c >= at ? (p.c + 1 >= COLS ? null : { c: p.c + 1, r: p.r }) : p)); changed(); }
    function deleteCol(at) { snap(); remap((p) => (p.c === at ? null : p.c > at ? { c: p.c - 1, r: p.r } : p)); changed(); }
    function resizeCol(e, c) {
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, w0 = colW(c);
      const mv = (ev) => { sh.colW = sh.colW || {}; sh.colW[c] = Math.max(36, Math.min(600, w0 + ev.clientX - sx)); grid.style.gridTemplateColumns = '46px ' + Array.from({ length: COLS }, (_, i) => colW(i) + 'px').join(' '); paintSel(); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); persist(); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }
    function fitCol(c) {
      const m = document.createElement('canvas').getContext('2d'); m.font = '13px system-ui'; let w = 50;
      for (let r = 0; r < ROWS; r++) { const t = cells[r][c].textContent; if (t) w = Math.max(w, m.measureText(t).width * ((data[refName(c, r)] || {}).fs || 13) / 13 + 18); }
      sh.colW = sh.colW || {}; sh.colW[c] = Math.min(500, Math.ceil(w)); buildGrid(); renderAll(); persist();
    }
    function toggleFilter(e, b) {
      if (filter) { filter = null; renderAll(); return; }
      const c = sel.c, r0 = Math.max(0, range().r1), last = lastRow();
      const vals = [...new Set(Array.from({ length: Math.max(0, last - r0) }, (_, i) => show(value(refName(c, r0 + 1 + i)))))].sort();
      const hide = new Set();
      const list = h('div', { class: 'sx-flist' }, ...vals.map((v) => { const cb = h('input', { type: 'checkbox' }); cb.checked = true; cb.onchange = () => { if (cb.checked) hide.delete(v); else hide.add(v); filter = { c, r0, hide }; renderAll(); }; return h('label', {}, cb, v || T('(empty)')); }));
      filter = { c, r0, hide };
      OF.pop(b || toolbar, h('div', {}, h('b', { class: 'sx-fh' }, T('Show rows where') + ' ' + colName(c) + ' ' + T('is')), list, h('button', { class: 'btn', style: { marginTop: '6px', width: '100%' }, onclick: () => { filter = null; renderAll(); document.querySelector('.of-pop') && document.querySelector('.of-pop').remove(); } }, T('Remove filter'))));
      renderAll();
    }
    function find() {
      PatOS.ask(T('Find'), '', { icon: 'sheets', ok: T('Find') }).then((q) => {
        if (!q) return; q = q.toLowerCase();
        const start = sel.r * COLS + sel.c;
        for (let i = 1; i <= ROWS * COLS; i++) { const k = (start + i) % (ROWS * COLS); const r = Math.floor(k / COLS), c = k % COLS; if (show(value(refName(c, r))).toLowerCase().includes(q) || String(raw(refName(c, r))).toLowerCase().includes(q)) { anchor = null; sel = { c, r }; paintSel(); return; } }
        OF.toast(win, T('No results'));
      });
    }

    /* ---------- fill handle ---------- */
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const src = range(); let tgt = null;
      const mv = (ev) => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY); const cell = el && el.closest('.sh-c'); if (!cell) return;
        const c = +cell.dataset.c, r = +cell.dataset.r;
        const down = r - src.r2, right = c - src.c2;
        tgt = down >= right ? (r > src.r2 ? { c1: src.c1, c2: src.c2, r1: src.r1, r2: r } : null) : (c > src.c2 ? { c1: src.c1, c2: c, r1: src.r1, r2: src.r2 } : null);
        grid.querySelectorAll('.sx-fillp').forEach((x) => x.classList.remove('sx-fillp'));
        if (tgt) for (let y = tgt.r1; y <= tgt.r2; y++) for (let x = tgt.c1; x <= tgt.c2; x++) cells[y][x].classList.add('sx-fillp');
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        grid.querySelectorAll('.sx-fillp').forEach((x) => x.classList.remove('sx-fillp'));
        if (!tgt) return; snap();
        const vertical = tgt.r2 > src.r2;
        const lines = vertical ? Array.from({ length: src.c2 - src.c1 + 1 }, (_, i) => src.c1 + i) : Array.from({ length: src.r2 - src.r1 + 1 }, (_, i) => src.r1 + i);
        lines.forEach((ln) => {
          const srcCells = vertical ? Array.from({ length: src.r2 - src.r1 + 1 }, (_, i) => ({ c: ln, r: src.r1 + i })) : Array.from({ length: src.c2 - src.c1 + 1 }, (_, i) => ({ c: src.c1 + i, r: ln }));
          const vals = srcCells.map((p) => raw(refName(p.c, p.r)));
          const numeric = vals.every((v) => v !== '' && !isNaN(+v));
          const step = numeric && vals.length > 1 ? (+vals[vals.length - 1] - +vals[0]) / (vals.length - 1) : numeric ? 1 : 0;
          const end = vertical ? tgt.r2 : tgt.c2, from = vertical ? src.r2 + 1 : src.c2 + 1;
          for (let k = from, i = 0; k <= end; k++, i++) {
            const sp = srcCells[i % srcCells.length];
            const dst = vertical ? { c: ln, r: k } : { c: k, r: ln };
            const base = data[refName(sp.c, sp.r)] ? Object.assign({}, data[refName(sp.c, sp.r)]) : null;
            let v;
            if (numeric) v = String(+(+vals[vals.length - 1] + step * (i + 1)).toPrecision(12));
            else { const dr = dst.r - sp.r, dc = dst.c - sp.c; v = shiftRefs(vals[i % vals.length], (p) => { const q = { c: p.absC ? p.c : p.c + dc, r: p.absR ? p.r : p.r + dr }; return q.c < 0 || q.r < 0 || q.c >= COLS ? null : q; }); }
            if (base) { base.v = v; data[refName(dst.c, dst.r)] = base; } else setCell(refName(dst.c, dst.r), v);
          }
        });
        anchor = { c: tgt.c1, r: tgt.r1 }; sel = { c: tgt.c2, r: tgt.r2 }; changed();
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });

    /* ---------- charts ---------- */
    function chart() {
      const g = range(); const labels = [], series = [];
      const hasLabels = g.c1 !== g.c2 && typeof value(refName(g.c1, g.r1 + 1)) !== 'number';
      const firstData = hasLabels ? g.c1 + 1 : g.c1;
      const headerRow = typeof value(refName(firstData, g.r1)) !== 'number' && value(refName(firstData, g.r1)) !== '';
      for (let c = firstData; c <= g.c2; c++) series.push({ name: headerRow ? show(value(refName(c, g.r1))) : colName(c), vals: [] });
      for (let r = headerRow ? g.r1 + 1 : g.r1; r <= g.r2; r++) { labels.push(hasLabels ? show(value(refName(g.c1, r))) : String(r + 1)); series.forEach((s, i) => s.vals.push(num(value(refName(firstData + i, r))))); }
      if (!series.length || !series.some((s) => s.vals.some((v) => v))) return PatOS.alertBox(T('Select some numbers first'), T('Pick a column of numbers (and the labels to its left), then press Chart.'), { icon: 'sheets' });
      let type = 'bar';
      const cv = h('canvas', { width: 1200, height: 640, class: 'sh-chart' });
      const typeBtns = h('div', { class: 'seg' }, ...[['bar', 'Bars'], ['line', 'Line'], ['pie', 'Pie']].map(([k, l]) => h('button', { class: 'tab' + (k === type ? ' on' : ''), onclick: (e) => { type = k; [...typeBtns.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); draw(); } }, T(l))));
      const layer = h('div', { class: 'dlg-layer' }, h('div', { class: 'dlg sh-chartbox' }, h('div', { class: 'sx-chead' }, h('b', {}, T('Chart')), typeBtns), cv, h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: () => { const nm = PatOS.fs.uniqueName('/Pictures', T('Chart') + '.png'); PatOS.fs.write('/Pictures/' + nm, cv.toDataURL('image/png')); OF.toast(win, T('Saved to Pictures')); } }, T('Save to Pictures')), h('button', { class: 'btn primary', onclick: () => layer.remove() }, T('Done')))));
      layer.addEventListener('click', (e) => { if (e.target === layer) layer.remove(); });
      document.body.appendChild(layer);
      const COLORS = ['#3b7cff', '#30b46c', '#ffb020', '#ff4d4f', '#a35cff', '#25b9d6', '#ff8a1f', '#e0353b'];
      function draw() {
        const x = cv.getContext('2d'), W = 1200, H = 640; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
        x.font = '22px system-ui'; x.textBaseline = 'middle';
        // legend
        series.forEach((s, i) => { x.fillStyle = COLORS[i % 8]; x.fillRect(80 + i * 200, 30, 18, 18); x.fillStyle = '#333'; x.fillText(s.name.slice(0, 14), 106 + i * 200, 40); });
        if (type === 'pie') {
          const vals = series[0].vals.map((v) => Math.max(0, v)), tot = vals.reduce((a, b) => a + b, 0) || 1; let a0 = -Math.PI / 2;
          vals.forEach((v, i) => { const a1 = a0 + v / tot * Math.PI * 2; x.beginPath(); x.moveTo(420, 350); x.arc(420, 350, 240, a0, a1); x.closePath(); x.fillStyle = COLORS[i % 8]; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke(); const m = (a0 + a1) / 2; if (v / tot > 0.04) { x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText(Math.round(v / tot * 100) + '%', 420 + Math.cos(m) * 160, 350 + Math.sin(m) * 160); } a0 = a1; });
          x.textAlign = 'left'; labels.forEach((l, i) => { x.fillStyle = COLORS[i % 8]; x.fillRect(740, 120 + i * 40, 22, 22); x.fillStyle = '#333'; x.fillText(String(l).slice(0, 22) + '  ' + (+series[0].vals[i].toPrecision(6)), 772, 131 + i * 40); });
          return;
        }
        const all = series.flatMap((s) => s.vals); const max = Math.max(...all, 0), min = Math.min(...all, 0);
        const L = 90, R = W - 30, Tp = 80, Bt = H - 70; const y = (v) => Bt - (v - min) / ((max - min) || 1) * (Bt - Tp);
        x.strokeStyle = '#e5e7eb'; x.lineWidth = 1.5; x.fillStyle = '#666'; x.textAlign = 'right';
        for (let i = 0; i <= 5; i++) { const v = min + (max - min) * i / 5; x.beginPath(); x.moveTo(L, y(v)); x.lineTo(R, y(v)); x.stroke(); x.fillText(+v.toPrecision(4), L - 10, y(v)); }
        const n = labels.length, bw = (R - L) / n; x.textAlign = 'center';
        labels.forEach((l, i) => { x.fillStyle = '#666'; x.fillText(String(l).slice(0, 10), L + bw * i + bw / 2, Bt + 26); });
        series.forEach((s, si) => {
          x.fillStyle = x.strokeStyle = COLORS[si % 8];
          if (type === 'bar') { const gw = bw * 0.75 / series.length; s.vals.forEach((v, i) => { const x0 = L + bw * i + bw * 0.125 + gw * si; const top = Math.min(y(v), y(0)), hh = Math.abs(y(v) - y(0)) || 1; x.beginPath(); x.roundRect ? x.roundRect(x0, top, gw - 4, hh, 6) : x.rect(x0, top, gw - 4, hh); x.fill(); }); }
          else { x.lineWidth = 4; x.beginPath(); s.vals.forEach((v, i) => { const px = L + bw * i + bw / 2; if (i) x.lineTo(px, y(v)); else x.moveTo(px, y(v)); }); x.stroke(); s.vals.forEach((v, i) => { x.beginPath(); x.arc(L + bw * i + bw / 2, y(v), 6, 0, 7); x.fill(); }); }
        });
      }
      draw();
    }

    /* ---------- sheet tabs ---------- */
    function renderTabs() {
      tabs.innerHTML = '';
      tabs.appendChild(OF.btn('plus', 'Add sheet', () => { snap(); book.sheets.push({ name: T('Sheet') + ' ' + (book.sheets.length + 1), cells: {}, colW: {} }); switchTo(book.sheets.length - 1); }));
      book.sheets.forEach((s, i) => {
        const t = h('button', { class: 'sx-tab' + (s === sh ? ' on' : '') }, s.name);
        t.onclick = () => switchTo(i);
        t.ondblclick = async () => { const n = await PatOS.ask(T('Rename sheet'), s.name, { icon: 'sheets', ok: T('Rename') }); if (n) { s.name = n.slice(0, 30); renderTabs(); persist(); } };
        t.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('Rename'), action: () => t.ondblclick() }, { label: T('Duplicate'), action: () => { snap(); book.sheets.splice(i + 1, 0, JSON.parse(JSON.stringify(Object.assign({}, s, { name: s.name + ' ' + T('copy') })))); switchTo(i + 1); } }, { label: T('Delete'), disabled: book.sheets.length < 2, action: () => { snap(); book.sheets.splice(i, 1); switchTo(Math.max(0, i - 1)); } }], e.clientX, e.clientY); };
        tabs.appendChild(t);
      });
    }
    function switchTo(i) { finishEdit(true); book.active = i; sh = book.sheets[i]; data = sh.cells; ROWS = Math.max(100, sh.rows || 100); filter = null; anchor = null; sel = { c: 0, r: 0 }; buildGrid(); renderTabs(); renderAll(); persist(); }

    /* ---------- downloads ---------- */
    function download(anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      PatOS.menu([
        { label: T('CSV (this sheet)'), action: () => PatOS.downloadFile(baseName() + '.csv', toCSV()) },
        { label: T('Excel (.xlsx)'), action: async () => { try { PatOS.downloadBlob(baseName() + '.xlsx', await PatOS.xlsx.fromBook(book, (si) => makeEvaluator(book.sheets[si].cells))); } catch (err) { PatOS.alertBox(T('Couldn’t save'), err.message, { icon: 'sheets' }); } } },
        { label: T('Import CSV into this sheet…'), action: importCSV }
      ], r.left - 120, r.bottom + 4);
    }
    function importCSV() { const i = h('input', { type: 'file', accept: '.csv,text/csv' }); i.onchange = () => { const fr = new FileReader(); fr.onload = () => { snap(); const cellsIn = {}; fr.result.split(/\r?\n/).forEach((line, y) => splitCSV(line).forEach((v, x) => { if (v !== '' && x < COLS) cellsIn[refName(x, y)] = { v }; })); data = sh.cells = cellsIn; ROWS = Math.max(100, fr.result.split(/\r?\n/).length + 10); sh.rows = ROWS; buildGrid(); changed(); }; fr.readAsText(i.files[0]); }; i.click(); }

    /* ---------- editing ---------- */
    function startEdit(initial) {
      const el = cells[sel.r][sel.c];
      editing = h('input', { class: 'sh-edit', value: initial != null ? initial : raw(refName(sel.c, sel.r)), spellcheck: 'false' });
      Object.assign(editing.style, { left: el.offsetLeft + 'px', top: el.offsetTop + 'px', width: Math.max(el.offsetWidth, 100) + 'px', minWidth: el.offsetWidth + 'px' });
      grid.appendChild(editing); editing.focus(); handle.style.display = 'none';
      if (initial == null) editing.select(); else { const L = editing.value.length; editing.setSelectionRange(L, L); suggest(editing); }
      editing.addEventListener('input', () => { fx.value = editing.value; suggest(editing); });
      editing.addEventListener('keydown', (e) => {
        if (acOpen() && (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || (e.key === 'Enter' && ac.querySelector('.on')))) { e.preventDefault(); acKey(e, editing); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); finishEdit(true); move(e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0, e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : 0); }
        else if (e.key === 'Escape') { e.stopPropagation(); finishEdit(false); }
      });
      editing.addEventListener('blur', () => setTimeout(() => finishEdit(true), 120));
    }
    function finishEdit(save) { if (!editing) return; const e = editing; editing = null; acHide(); if (save) commit(e.value); e.remove(); handle.style.display = ''; grid.focus({ preventScroll: true }); }
    function move(dc, dr, extend) { if (extend) anchor = anchor || { ...sel }; else anchor = null; let r = sel.r + dr; while (dr && r > 0 && r < ROWS - 1 && rowHeads[r].classList.contains('sx-hide')) r += dr; sel = { c: Math.max(0, Math.min(COLS - 1, sel.c + dc)), r: Math.max(0, Math.min(ROWS - 1, r)) }; paintSel(); }
    /* formula suggestions */
    const acOpen = () => ac.classList.contains('on');
    const acHide = () => ac.classList.remove('on');
    function suggest(inp) {
      const v = inp.value; const m = v[0] === '=' && /([A-Za-z]+)$/.exec(v.slice(0, inp.selectionStart));
      if (!m) return acHide();
      const list = Object.keys(FN).filter((k) => k.startsWith(m[1].toUpperCase())).slice(0, 8);
      if (!list.length) return acHide();
      ac.innerHTML = ''; list.forEach((k, i) => { const b = h('button', { class: i === 0 ? 'on' : '' }, h('b', {}, k), h('small', {}, HINTS[k] || k + '(…)')); b.onmousedown = (e) => { e.preventDefault(); pick(inp, k); }; ac.appendChild(b); });
      const r = inp.getBoundingClientRect(), wr = win.body.getBoundingClientRect();
      ac.style.left = (r.left - wr.left) + 'px'; ac.style.top = (r.bottom - wr.top + 2) + 'px'; ac.classList.add('on');
    }
    function pick(inp, k) { const pos = inp.selectionStart; const before = inp.value.slice(0, pos).replace(/[A-Za-z]+$/, k + '('); inp.value = before + inp.value.slice(pos); inp.setSelectionRange(before.length, before.length); fx.value = inp.value; acHide(); inp.focus(); }
    function acKey(e, inp) { const items = [...ac.children]; let i = items.findIndex((x) => x.classList.contains('on')); if (e.key === 'ArrowDown') i = (i + 1) % items.length; else if (e.key === 'ArrowUp') i = (i - 1 + items.length) % items.length; else { pick(inp, items[Math.max(0, i)].querySelector('b').textContent); return; } items.forEach((x, j) => x.classList.toggle('on', j === i)); }

    let dragging = false;
    grid.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.sh-c'); if (!el) return;
      if (editing && editing.value.startsWith('=') && e.target !== editing) { e.preventDefault(); const ref = refName(+el.dataset.c, +el.dataset.r); const pos = editing.selectionStart; editing.value = editing.value.slice(0, pos) + ref + editing.value.slice(pos); editing.setSelectionRange(pos + ref.length, pos + ref.length); fx.value = editing.value; editing.focus(); return; }
      finishEdit(true);
      const p = { c: +el.dataset.c, r: +el.dataset.r };
      if (e.shiftKey) { anchor = anchor || { ...sel }; sel = p; } else { anchor = { ...p }; sel = p; }
      // tick boxes: clicking a TRUE/FALSE cell flips it
      const v = value(refName(p.c, p.r)); if (typeof v === 'boolean' && raw(refName(p.c, p.r))[0] !== '=' && e.detail === 1 && e.offsetX < 26) { commit(v ? 'FALSE' : 'TRUE'); return; }
      dragging = true; paintSel(); grid.focus({ preventScroll: true });
    });
    grid.addEventListener('pointerover', (e) => { if (!dragging) return; const el = e.target.closest('.sh-c'); if (el) { sel = { c: +el.dataset.c, r: +el.dataset.r }; paintSel(); } });
    const stopDrag = () => { dragging = false; };
    window.addEventListener('pointerup', stopDrag);
    win.on('closed', () => { window.removeEventListener('pointerup', stopDrag); try { if (!isCSV) PatOS.fs.write(path, JSON.stringify(book)); } catch (e) {} });
    grid.addEventListener('dblclick', (e) => { if (e.target.closest('.sh-c')) startEdit(); });
    grid.addEventListener('contextmenu', (e) => {
      const el = e.target.closest('.sh-c'); if (!el) return; e.preventDefault();
      const p = { c: +el.dataset.c, r: +el.dataset.r }; const g = range();
      if (p.c < g.c1 || p.c > g.c2 || p.r < g.r1 || p.r > g.r2) { anchor = null; sel = p; paintSel(); }
      PatOS.menu([
        { label: T('Cut'), shortcut: 'Ctrl+X', action: () => { copySel(); clearRange(); } }, { label: T('Copy'), shortcut: 'Ctrl+C', action: copySel }, { label: T('Paste'), shortcut: 'Ctrl+V', action: () => navigator.clipboard && navigator.clipboard.readText().then(pasteText).catch(() => {}) }, { divider: true },
        { label: T('Insert row above'), action: () => insertRow(sel.r) }, { label: T('Insert column left'), action: () => insertCol(sel.c) }, { label: T('Delete row'), action: () => deleteRow(sel.r) }, { label: T('Delete column'), action: () => deleteCol(sel.c) }, { divider: true },
        { label: T('Insert checkbox'), action: () => { snap(); eachSel((ref) => setCell(ref, 'FALSE')); changed(); } },
        { label: T('Clear'), action: () => clearRange() }
      ], e.clientX, e.clientY);
    });
    function copySel() { const g = range(); const lines = []; for (let r = g.r1; r <= g.r2; r++) { const row = []; for (let c = g.c1; c <= g.c2; c++) row.push(raw(refName(c, r))); lines.push(row.join('\t')); } navigator.clipboard && navigator.clipboard.writeText(lines.join('\n')).catch(() => {}); win._clip = { src: { ...g }, text: lines.join('\n') }; }
    function pasteText(t) {
      snap(); const fromInside = win._clip && win._clip.text === t.replace(/\r/g, '');
      t.replace(/\r/g, '').split('\n').forEach((line, y) => line.split('\t').forEach((v, x) => {
        const dst = { c: sel.c + x, r: sel.r + y }; if (dst.r >= ROWS || dst.c >= COLS) return;
        if (fromInside) { const dr = dst.r - (win._clip.src.r1 + y), dc = dst.c - (win._clip.src.c1 + x); v = shiftRefs(v, (p) => { const q = { c: p.absC ? p.c : p.c + dc, r: p.absR ? p.r : p.r + dr }; return q.c < 0 || q.r < 0 || q.c >= COLS ? null : q; }); }
        setCell(refName(dst.c, dst.r), v);
      }));
      changed();
    }
    grid.addEventListener('keydown', (e) => {
      if (editing) return;
      const k = e.key, mod = e.ctrlKey || e.metaKey;
      if (k === 'ArrowUp') { e.preventDefault(); if (mod) { anchor = null; sel = { c: sel.c, r: 0 }; paintSel(); } else move(0, -1, e.shiftKey); }
      else if (k === 'ArrowDown') { e.preventDefault(); if (mod) { anchor = null; sel = { c: sel.c, r: lastRow() }; paintSel(); } else move(0, 1, e.shiftKey); }
      else if (k === 'ArrowLeft') { e.preventDefault(); move(-1, 0, e.shiftKey); }
      else if (k === 'ArrowRight' || k === 'Tab') { e.preventDefault(); move(e.shiftKey && k === 'Tab' ? -1 : 1, 0, e.shiftKey && k !== 'Tab'); }
      else if (k === 'Enter' || k === 'F2') { e.preventDefault(); startEdit(); }
      else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); snap(); eachSel((ref) => setCell(ref, '')); changed(); }
      else if (mod && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && k.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (mod && k.toLowerCase() === 'b') { e.preventDefault(); fmt('b'); }
      else if (mod && k.toLowerCase() === 'i') { e.preventDefault(); fmt('i'); }
      else if (mod && k.toLowerCase() === 'f') { e.preventDefault(); find(); }
      else if (mod && k.toLowerCase() === 'a') { e.preventDefault(); anchor = { c: 0, r: 0 }; sel = { c: COLS - 1, r: ROWS - 1 }; paintSel(); }
      else if (mod && k.toLowerCase() === 'c') { copySel(); }
      else if (mod && k.toLowerCase() === 'x') { copySel(); clearRange(); }
      else if (e.altKey && k === '=') { e.preventDefault(); autoSum(); }
      else if (k.length === 1 && !mod && !e.altKey) { e.preventDefault(); startEdit(k); }
    });
    grid.addEventListener('paste', (e) => { const t = (e.clipboardData || {}).getData && e.clipboardData.getData('text'); if (!t) return; e.preventDefault(); pasteText(t); });
    fx.addEventListener('input', () => suggest(fx));
    fx.addEventListener('keydown', (e) => {
      if (acOpen() && (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || (e.key === 'Enter' && ac.querySelector('.on')))) { e.preventDefault(); acKey(e, fx); return; }
      if (e.key === 'Enter') { e.preventDefault(); commit(fx.value); move(0, 1); grid.focus(); } if (e.key === 'Escape') { fx.value = raw(refName(sel.c, sel.r)); acHide(); grid.focus(); }
    });
    fx.addEventListener('blur', () => setTimeout(acHide, 150));
    refBox.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const v = refBox.value.toUpperCase().trim(); const m = v.split(':').map(parseRef); if (m[0]) { anchor = m[1] ? m[0] : null; sel = m[1] || m[0]; sel.r = Math.min(sel.r, ROWS - 1); paintSel(); grid.focus(); } });
    refBox.addEventListener('focus', () => refBox.select());

    buildGrid(); renderTabs(); renderAll();
    setTimeout(() => grid.focus({ preventScroll: true }), 60);
  }
  PatOS.sheetsEngine = { compile, FN, shiftRefs, makeEvaluator };
})();
