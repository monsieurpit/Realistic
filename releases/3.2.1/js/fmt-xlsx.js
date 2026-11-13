/* Excel (.xlsx): open Excel files in Sheets and save Sheets as Excel files. */
(function () {
  'use strict';
  const { esc, kids, kid, attr, deep, parse } = PatOS.xml;
  const COLS = 26;
  const colIdx = (s) => { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const colName = (c) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  const BUILTIN = { 1: 'num', 2: 'dec', 3: 'num', 4: 'dec', 5: 'cur', 6: 'cur', 7: 'cur', 8: 'cur', 9: 'pct', 10: 'pct', 11: 'dec', 14: 'date', 15: 'date', 16: 'date', 17: 'date', 22: 'date', 37: 'num', 38: 'num', 39: 'dec', 40: 'dec', 44: 'cur' };
  const fmtKind = (code) => { code = String(code || ''); if (/%/.test(code)) return 'pct'; if (/[$€£¥]|\[\$/.test(code)) return 'cur'; if (/[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, '')) && /[dy]/i.test(code.replace(/"[^"]*"/g, ''))) return 'date'; if (/0\.0/.test(code)) return 'dec'; if (/^#,##0$|^0$/.test(code)) return 'num'; return null; };
  const rgb = (c) => { if (!c) return null; const v = attr(c, 'rgb'); if (v && /^[0-9a-f]{8}$/i.test(v)) return '#' + v.slice(2).toLowerCase(); if (v && /^[0-9a-f]{6}$/i.test(v)) return '#' + v.toLowerCase(); return null; };

  /* ---------------- open ---------------- */
  async function toBook(blob) {
    const z = await PatOS.zip.read(blob);
    if (!z.has('xl/workbook.xml')) throw new Error('This isn’t an Excel (.xlsx) file.');
    const wb = parse(await z.text('xl/workbook.xml')).documentElement;
    const rels = {}; deep(parse(await z.text('xl/_rels/workbook.xml.rels')).documentElement, 'Relationship').forEach((r) => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const shared = [];
    if (z.has('xl/sharedStrings.xml')) deep(parse(await z.text('xl/sharedStrings.xml')).documentElement, 'si').forEach((si) => { shared.push(deep(si, 't').filter((t) => !(t.parentNode.localName === 'rPh')).map((t) => t.textContent).join('')); });
    // styles: number formats, bold, italic, fills, font colours, alignment
    const xfs = [];
    if (z.has('xl/styles.xml')) {
      const st = parse(await z.text('xl/styles.xml')).documentElement;
      const nf = {}; deep(kid(st, 'numFmts'), 'numFmt').forEach((n) => { nf[attr(n, 'numFmtId')] = attr(n, 'formatCode'); });
      const fonts = kids(kid(st, 'fonts'), 'font').map((f) => ({ b: !!kid(f, 'b') && attr(kid(f, 'b'), 'val') !== '0', i: !!kid(f, 'i') && attr(kid(f, 'i'), 'val') !== '0', fg: rgb(kid(f, 'color')), fs: parseFloat(attr(kid(f, 'sz'), 'val')) || 0 }));
      const fills = kids(kid(st, 'fills'), 'fill').map((f) => { const p = kid(f, 'patternFill'); return p && attr(p, 'patternType') === 'solid' ? rgb(kid(p, 'fgColor')) : null; });
      kids(kid(st, 'cellXfs'), 'xf').forEach((x) => {
        const id = attr(x, 'numFmtId'); const al = kid(x, 'alignment'); const f = fonts[+attr(x, 'fontId')] || {};
        const o = {}; const kind = BUILTIN[id] || (nf[id] ? fmtKind(nf[id]) : null); if (kind) o.nf = kind;
        const dp = nf[id] ? (/\.(0+)/.exec(nf[id]) || [])[1] : null; if (dp != null && kind) o.dp = dp.length;
        if (f.b) o.b = 1; if (f.i) o.i = 1; if (f.fg && f.fg !== '#000000') o.fg = f.fg; if (f.fs && Math.abs(f.fs - 11) > 0.5) o.fs = Math.round(f.fs * 1.333);
        const bg = fills[+attr(x, 'fillId')]; if (bg) o.bg = bg;
        const h = al && attr(al, 'horizontal'); if (h === 'center' || h === 'right' || h === 'left') o.al = h; if (al && attr(al, 'wrapText') === '1') o.w = 1;
        xfs.push(o);
      });
    }
    const sheets = [];
    for (const s of kids(kid(wb, 'sheets'), 'sheet')) {
      const rid = [...s.attributes].find((a) => a.localName === 'id' && a.prefix === 'r')?.value;
      let target = rels[rid]; if (!target) continue; target = target.replace(/^\//, ''); const path = target.startsWith('xl/') ? target : 'xl/' + target; if (!z.has(path)) continue;
      const sd = parse(await z.text(path)).documentElement; const cells = {}; const colW = {}; let maxR = 0, skipped = 0;
      deep(kid(sd, 'cols'), 'col').forEach((c) => { const w = Math.round((parseFloat(attr(c, 'width')) || 8.43) * 7 + 5); for (let k = +attr(c, 'min') - 1; k <= Math.min(+attr(c, 'max') - 1, COLS - 1); k++) if (w !== 100) colW[k] = w; });
      deep(kid(sd, 'sheetData'), 'c').forEach((c) => {
        const ref = attr(c, 'r'); const m = /^([A-Z]+)(\d+)$/.exec(ref); if (!m) return; if (colIdx(m[1]) >= COLS) { skipped++; return; }
        const t = attr(c, 't'); const f = kid(c, 'f'); const v = kid(c, 'v'); const is = kid(c, 'is');
        let val = '';
        if (f && f.textContent) val = '=' + f.textContent;
        else if (t === 's' && v) val = shared[+v.textContent] ?? '';
        else if (t === 'inlineStr' && is) val = deep(is, 't').map((x) => x.textContent).join('');
        else if (t === 'b' && v) val = v.textContent === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'e' && v) val = v.textContent;
        else if (v) val = v.textContent;
        const s = xfs[+(attr(c, 's') || 0)] || {}; const o = Object.assign({}, s);
        if (val === '' && !Object.keys(o).length) return;
        o.v = String(val); cells[ref] = o; maxR = Math.max(maxR, +m[2]);
      });
      sheets.push({ name: attr(s, 'name') || 'Sheet', cells, colW, rows: Math.max(100, maxR + 20), skipped });
    }
    return { sheets, active: 0 };
  }

  /* ---------------- save ---------------- */
  const hexOf = (c) => (c && /^#[0-9a-f]{6}$/i.test(c) ? 'FF' + c.slice(1).toUpperCase() : null);
  async function fromBook(book, evalSheet) {
    const fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], numFmts = [], xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const reg = new Map(); const nfId = {};
    const intern = (arr, x) => { let i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; };
    const numFmtOf = (d) => {
      const dp = d.dp; const k = d.nf; if (!k) return 0;
      const code = k === 'cur' ? `"$"#,##0.${'0'.repeat(dp ?? 2)}` : k === 'pct' ? (dp === 0 ? '0%' : '0.' + '0'.repeat(dp ?? 1) + '%') : k === 'dec' ? '#,##0.' + '0'.repeat(dp ?? 2) : k === 'num' ? (dp ? '#,##0.' + '0'.repeat(dp) : '#,##0') : k === 'date' ? 'yyyy-mm-dd' : k === 'text' ? '@' : null;
      if (!code) return 0; if (!(code in nfId)) { nfId[code] = 164 + numFmts.length; numFmts.push(`<numFmt numFmtId="${nfId[code]}" formatCode="${esc(code)}"/>`); } return nfId[code];
    };
    function style(d) {
      const key = JSON.stringify([d.b, d.i, d.s, d.fg, d.bg, d.nf, d.dp, d.al, d.w, d.fs, d.bd]); if (reg.has(key)) return reg.get(key);
      const fa = []; if (d.b) fa.push('<b/>'); if (d.i) fa.push('<i/>'); if (d.s) fa.push('<strike/>'); fa.push(`<sz val="${d.fs ? Math.round(d.fs * 0.75) : 11}"/>`); if (hexOf(d.fg)) fa.push(`<color rgb="${hexOf(d.fg)}"/>`); fa.push('<name val="Calibri"/><family val="2"/>');
      const fontId = intern(fonts, '<font>' + fa.join('') + '</font>');
      const fillId = hexOf(d.bg) ? intern(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${hexOf(d.bg)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      let borderId = 0; if (d.bd) { const all = d.bd === 'all'; const sd = (s, ch) => (all || d.bd.includes(ch) ? `<${s} style="thin"><color rgb="FF5F6368"/></${s}>` : `<${s}/>`); borderId = intern(borders, `<border>${sd('left', 'l')}${sd('right', 'r')}${sd('top', 't')}${sd('bottom', 'b')}<diagonal/></border>`); }
      const nid = numFmtOf(d); const al = d.al || d.w ? `<alignment${d.al ? ` horizontal="${d.al}"` : ''}${d.w ? ' wrapText="1"' : ''} vertical="top"/>` : '';
      xfs.push(`<xf numFmtId="${nid}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${nid ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${borderId ? ' applyBorder="1"' : ''}${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`);
      reg.set(key, xfs.length - 1); return xfs.length - 1;
    }
    const sheetXml = [];
    for (let si = 0; si < book.sheets.length; si++) {
      const sh = book.sheets[si]; const value = evalSheet(si); const rows = {};
      Object.keys(sh.cells).forEach((ref) => { const m = /^([A-Z])(\d+)$/.exec(ref); if (m) (rows[+m[2]] = rows[+m[2]] || []).push([m[1].charCodeAt(0) - 65, ref, sh.cells[ref]]); });
      let sd = '';
      Object.keys(rows).map(Number).sort((a, b) => a - b).forEach((r) => {
        sd += `<row r="${r}">`;
        rows[r].sort((a, b) => a[0] - b[0]).forEach(([c, ref, d]) => {
          const raw = d.v == null ? '' : String(d.v); const s = style(d); const sa = s ? ` s="${s}"` : '';
          if (raw === '' ) { if (s) sd += `<c r="${ref}"${sa}/>`; return; }
          if (raw[0] === '=') {
            const v = value(ref); const f = esc(raw.slice(1));
            if (typeof v === 'number') sd += `<c r="${ref}"${sa}><f>${f}</f><v>${v}</v></c>`;
            else if (typeof v === 'boolean') sd += `<c r="${ref}"${sa} t="b"><f>${f}</f><v>${v ? 1 : 0}</v></c>`;
            else if (typeof v === 'string' && /^#[A-Z/0!?]+$/.test(v)) sd += `<c r="${ref}"${sa} t="e"><f>${f}</f><v>${esc(v === '#ERROR!' ? '#VALUE!' : v)}</v></c>`;
            else sd += `<c r="${ref}"${sa} t="str"><f>${f}</f><v>${esc(v == null ? '' : v)}</v></c>`;
          } else if (raw !== '' && !isNaN(+raw) && d.nf !== 'text') sd += `<c r="${ref}"${sa}><v>${+raw}</v></c>`;
          else if (raw === 'TRUE' || raw === 'FALSE') sd += `<c r="${ref}"${sa} t="b"><v>${raw === 'TRUE' ? 1 : 0}</v></c>`;
          else sd += `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(raw)}</t></is></c>`;
        });
        sd += '</row>';
      });
      const cols = Object.keys(sh.colW || {}).map(Number).sort((a, b) => a - b).map((c) => `<col min="${c + 1}" max="${c + 1}" width="${Math.max(2, (sh.colW[c] - 5) / 7).toFixed(2)}" customWidth="1"/>`).join('');
      sheetXml.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ''}/></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? '<cols>' + cols + '</cols>' : ''}<sheetData>${sd}</sheetData></worksheet>`);
    }
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const names = book.sheets.map((s, i) => { let n = String(s.name || 'Sheet' + (i + 1)).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31).trim() || 'Sheet' + (i + 1); return n; });
    const uniq = []; names.forEach((n) => { let m = n, k = 2; while (uniq.includes(m)) m = n.slice(0, 28) + ' ' + k++; uniq.push(m); });
    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="${book.active || 0}"/></bookViews><sheets>${uniq.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${uniq.map((n, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${uniq.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${uniq.map((n, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    return PatOS.zip.write([
      { name: '[Content_Types].xml', data: types }, { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: wbXml }, { name: 'xl/_rels/workbook.xml.rels', data: wbRels }, { name: 'xl/styles.xml', data: stylesXml },
      ...sheetXml.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: x }))
    ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  PatOS.xlsx = { toBook, fromBook, colName };
})();
