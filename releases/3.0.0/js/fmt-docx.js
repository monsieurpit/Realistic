/* Word (.docx): open Word files in Docs and save Docs as Word files. */
(function () {
  'use strict';
  const xml = PatOS.xml = {
    esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''),
    parse(text) { const d = new DOMParser().parseFromString(text, 'application/xml'); if (d.querySelector('parsererror')) throw new Error('This file looks damaged.'); return d; },
    kids: (el, name) => (el ? [...el.children].filter((c) => c.localName === name) : []),
    kid: (el, name) => (el ? [...el.children].find((c) => c.localName === name) || null : null),
    attr: (el, name) => { if (!el) return null; for (const a of el.attributes) if (a.localName === name) return a.value; return null; },
    deep: (el, name) => (el ? [...el.getElementsByTagName('*')].filter((c) => c.localName === name) : [])
  };
  const { esc, kids, kid, attr } = xml;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };
  const HL = { yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#00008b', darkCyan: '#008b8b', darkGreen: '#006400', darkMagenta: '#8b008b', darkRed: '#8b0000', darkYellow: '#808000', darkGray: '#a9a9a9', lightGray: '#d3d3d3', black: '#000000', white: '#ffffff' };
  const on = (el) => { if (!el) return false; const v = attr(el, 'val'); return v == null || !/^(0|false|off|none)$/i.test(v); };

  /* ---------------- open ---------------- */
  async function toHTML(blob) {
    const z = await PatOS.zip.read(blob);
    if (!z.has('word/document.xml')) throw new Error('This isn’t a Word (.docx) file.');
    const doc = xml.parse(await z.text('word/document.xml'));
    const rels = {};
    if (z.has('word/_rels/document.xml.rels')) xml.deep(xml.parse(await z.text('word/_rels/document.xml.rels')).documentElement, 'Relationship').forEach((r) => { rels[r.getAttribute('Id')] = { target: r.getAttribute('Target'), type: r.getAttribute('Type'), ext: r.getAttribute('TargetMode') === 'External' }; });
    const styles = {};
    if (z.has('word/styles.xml')) xml.deep(xml.parse(await z.text('word/styles.xml')).documentElement, 'style').forEach((s) => { const nm = attr(kid(s, 'name'), 'val'); const sn = kid(kid(s, 'pPr'), 'numPr'); styles[attr(s, 'styleId')] = { name: (nm || '').toLowerCase(), outline: attr(kid(kid(s, 'pPr'), 'outlineLvl'), 'val'), based: attr(kid(s, 'basedOn'), 'val'), numId: sn ? attr(kid(sn, 'numId'), 'val') : null, ilvl: sn ? attr(kid(sn, 'ilvl'), 'val') : null }; });
    const numFmt = {};
    if (z.has('word/numbering.xml')) {
      const nd = xml.parse(await z.text('word/numbering.xml')).documentElement; const abs = {};
      kids(nd, 'abstractNum').forEach((a) => { abs[attr(a, 'abstractNumId')] = kids(a, 'lvl').map((l) => attr(kid(l, 'numFmt'), 'val') || 'decimal'); });
      kids(nd, 'num').forEach((n) => { numFmt[attr(n, 'numId')] = abs[attr(kid(n, 'abstractNumId'), 'val')] || []; });
    }
    const media = {};
    async function image(rid, cx) {
      const r = rels[rid]; if (!r || r.ext) return '';
      let p = r.target.replace(/^\//, ''); p = p.startsWith('word/') ? p : 'word/' + p; if (!z.has(p)) return '';
      const ext = p.split('.').pop().toLowerCase(); if (!MIME[ext]) return '';
      if (!media[p]) media[p] = 'data:' + MIME[ext] + ';base64,' + PatOS.zip.b64(await z.get(p));
      const w = cx ? Math.round(cx / 9525) : 0;
      return `<img src="${media[p]}" style="${w ? 'width:' + Math.min(w, 648) + 'px;' : ''}max-width:100%">`;
    }
    const styleLevel = (id) => {
      let s = styles[id], n = 0; while (s && n++ < 6) { const m = /^(?:heading|titre|überschrift|título|rubrik)\s*(\d)/.exec(s.name); if (m) return +m[1]; if (/^(title|titre|titel|título)$/.test(s.name)) return 0; if (s.outline != null) return +s.outline + 1; s = styles[s.based]; }
      return -1;
    };
    const styleNum = (id) => { let st = styles[id], n = 0; while (st && n++ < 6) { if (st.numId) return { numId: st.numId, ilvl: st.ilvl || '0' }; st = styles[st.based]; } return null; };
    async function runs(p) {
      let out = '';
      for (const c of p.children) {
        if (c.localName === 'r') out += await run(c);
        else if (c.localName === 'hyperlink') { const inner = (await Promise.all(kids(c, 'r').map(run))).join(''); const rid = c.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || attr(c, 'id'); const rel = rels[rid]; out += rel && rel.ext ? `<a href="${esc(rel.target)}">${inner}</a>` : inner; }
        else if (c.localName === 'sdt') { const content = kid(c, 'sdtContent'); if (content) out += await runs(content); }
        else if (c.localName === 'smartTag' || c.localName === 'ins') out += await runs(c);
      }
      return out;
    }
    async function run(r) {
      const pr = kid(r, 'rPr'); let inner = '';
      for (const c of r.children) {
        if (c.localName === 't') inner += esc(c.textContent);
        else if (c.localName === 'tab') inner += '&emsp;';
        else if (c.localName === 'br') inner += attr(c, 'type') === 'page' ? '</p><div class="dx-pb" contenteditable="false"></div><p>' : '<br>';
        else if (c.localName === 'noBreakHyphen') inner += '‑';
        else if (c.localName === 'drawing') { const blip = xml.deep(c, 'blip')[0]; const ext = xml.deep(c, 'extent')[0]; if (blip) { const rid = blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') || [...blip.attributes].find((a) => a.localName === 'embed')?.value; inner += await image(rid, ext ? +ext.getAttribute('cx') : 0); } }
      }
      if (!inner) return '';
      if (pr) {
        const css = []; const col = attr(kid(pr, 'color'), 'val'); if (col && col !== 'auto' && /^[0-9a-f]{6}$/i.test(col)) css.push('color:#' + col);
        const hl = attr(kid(pr, 'highlight'), 'val'); if (hl && HL[hl]) css.push('background-color:' + HL[hl]); const shd = attr(kid(pr, 'shd'), 'fill'); if (shd && /^[0-9a-f]{6}$/i.test(shd)) css.push('background-color:#' + shd);
        const sz = attr(kid(pr, 'sz'), 'val'); if (sz && +sz !== 22 && +sz > 0) css.push('font-size:' + Math.round(+sz / 2 * 1.333) + 'px');
        const ff = attr(kid(pr, 'rFonts'), 'ascii'); if (ff) css.push('font-family:"' + ff.replace(/"/g, '') + '"');
        if (css.length) inner = `<span style="${css.join(';')}">${inner}</span>`;
        if (on(kid(pr, 'b'))) inner = `<b>${inner}</b>`; if (on(kid(pr, 'i'))) inner = `<i>${inner}</i>`;
        const u = kid(pr, 'u'); if (u && on(u)) inner = `<u>${inner}</u>`; if (on(kid(pr, 'strike'))) inner = `<s>${inner}</s>`;
        const va = attr(kid(pr, 'vertAlign'), 'val'); if (va === 'superscript') inner = `<sup>${inner}</sup>`; if (va === 'subscript') inner = `<sub>${inner}</sub>`;
      }
      return inner;
    }
    async function block(body) {
      let html = ''; const stack = []; // open lists
      const closeLists = (to) => { while (stack.length > to) html += '</li></' + stack.pop() + '>'; };
      for (const el of body.children) {
        if (el.localName === 'p') {
          const pp = kid(el, 'pPr'); const num = kid(pp, 'numPr'); const sid = attr(kid(pp, 'pStyle'), 'val'); const lvl = sid ? styleLevel(sid) : -1;
          const content = await runs(el);
          const jc = attr(kid(pp, 'jc'), 'val'); const align = { center: 'center', right: 'right', end: 'right', both: 'justify' }[jc];
          const sNum = !num && sid ? styleNum(sid) : null;
          const nid = num ? attr(kid(num, 'numId'), 'val') : sNum && sNum.numId;
          if ((num || sNum) && nid && nid !== '0') {
            const il = +((num ? attr(kid(num, 'ilvl'), 'val') : sNum.ilvl) || 0), fmt = (numFmt[nid] || [])[il] || 'bullet', tag = fmt === 'bullet' || fmt === 'none' ? 'ul' : 'ol';
            while (stack.length > il + 1) html += '</li></' + stack.pop() + '>';
            if (stack.length === il + 1 && stack[il] !== tag) { html += '</li></' + stack.pop() + '>'; }
            if (stack.length === il + 1) html += '</li><li>'; else { while (stack.length < il + 1) { html += (stack.length ? '' : '') + '<' + tag + '><li>'; stack.push(tag); } }
            html += content || '<br>';
            continue;
          }
          closeLists(0);
          const st = align ? ` style="text-align:${align}"` : '';
          if (lvl === 0) html += `<h1${st}>${content || '<br>'}</h1>`;
          else if (lvl >= 1) html += `<h${Math.min(4, lvl + 1)}${st}>${content || '<br>'}</h${Math.min(4, lvl + 1)}>`;
          else html += `<p${st}>${content || '<br>'}</p>`;
        } else if (el.localName === 'tbl') {
          closeLists(0);
          let t = '<table class="doc-table"><tbody>';
          for (const tr of kids(el, 'tr')) {
            t += '<tr>';
            for (const tc of kids(tr, 'tc')) {
              const span = attr(kid(kid(tc, 'tcPr'), 'gridSpan'), 'val'); const parts = [];
              for (const p of kids(tc, 'p')) parts.push(await runs(p));
              const shd = attr(kid(kid(tc, 'tcPr'), 'shd'), 'fill');
              t += `<td${span ? ' colspan="' + span + '"' : ''}${shd && /^[0-9a-f]{6}$/i.test(shd) ? ' style="background:#' + shd + '"' : ''}>${parts.join('<br>') || '<br>'}</td>`;
            }
            t += '</tr>';
          }
          html += t + '</tbody></table><p><br></p>';
        } else if (el.localName === 'sdt') { const c = kid(el, 'sdtContent'); if (c) html += await block(c); }
      }
      closeLists(0);
      return html;
    }
    let html = await block(kid(doc.documentElement, 'body'));
    html = html.replace(/<p><\/p>/g, '').replace(/<p><br><\/p>(?=<div class="dx-pb")/g, '');
    return html || '<p><br></p>';
  }

  /* ---------------- save ---------------- */
  const px2hp = (px) => Math.round(px * 0.75 * 2);
  const hex = (c) => { if (!c) return null; c = String(c).trim(); const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c); if (m) return (m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]).toUpperCase(); const r = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c); if (r && (r[4] == null || +r[4] > 0)) return [r[1], r[2], r[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase(); return null; };
  const SIZE_PT = [0, 8, 10, 12, 14, 18, 24, 36];

  async function fromElement(root, opts) {
    opts = opts || {};
    const media = []; const hyper = []; const numDefs = []; // ordered list instances
    let rid = 100, docPr = 1;
    const dataBytes = (url) => { const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url); if (!m) return null; const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return { mime: m[1], bytes: u8 }; };
    function imageXml(img) {
      const d = dataBytes(img.getAttribute('src') || ''); if (!d) return '';
      let ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'image/bmp': 'bmp' }[d.mime]; if (!ext) return '';
      const id = 'rId' + rid++; const name = 'image' + (media.length + 1) + '.' + ext; media.push({ id, name, bytes: d.bytes });
      const nw = img.naturalWidth || 400, nh = img.naturalHeight || 300; const sw = img.style.width; let wpx = /%$/.test(sw) ? 648 * parseFloat(sw) / 100 : /px$/.test(sw) ? parseFloat(sw) : Math.min(nw, 648); wpx = Math.min(648, wpx || nw);
      const cx = Math.round(wpx * 9525), cy = Math.round(wpx * (nh / nw) * 9525); const n = docPr++;
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }
    function rpr(st) {
      let s = ''; if (st.font) s += `<w:rFonts w:ascii="${esc(st.font)}" w:hAnsi="${esc(st.font)}" w:cs="${esc(st.font)}"/>`;
      if (st.b) s += '<w:b/>'; if (st.i) s += '<w:i/>'; if (st.s) s += '<w:strike/>';
      if (st.color) s += `<w:color w:val="${st.color}"/>`; if (st.sz) s += `<w:sz w:val="${st.sz}"/><w:szCs w:val="${st.sz}"/>`;
      if (st.u) s += '<w:u w:val="single"/>'; if (st.bg) s += `<w:shd w:val="clear" w:color="auto" w:fill="${st.bg}"/>`; if (st.sup) s += '<w:vertAlign w:val="superscript"/>'; if (st.sub) s += '<w:vertAlign w:val="subscript"/>';
      if (st.link) s = '<w:rStyle w:val="Hyperlink"/>' + s;
      return s ? `<w:rPr>${s}</w:rPr>` : '';
    }
    function inline(node, st, pre) {
      let out = '';
      node.childNodes.forEach((c) => {
        if (c.nodeType === 3) { let t = c.textContent; if (!pre) t = t.replace(/[\n\r\t ]+/g, ' '); if (t) out += `<w:r>${rpr(st)}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`; return; }
        if (c.nodeType !== 1) return;
        const tag = c.tagName.toLowerCase(); const s2 = Object.assign({}, st); const cs = c.style || {};
        if (tag === 'br') { out += '<w:r><w:br/></w:r>'; return; }
        if (tag === 'img') { out += imageXml(c); return; }
        if (/^(b|strong)$/.test(tag)) s2.b = 1; if (/^(i|em)$/.test(tag)) s2.i = 1; if (tag === 'u') s2.u = 1; if (/^(s|strike|del)$/.test(tag)) s2.s = 1; if (tag === 'sup') s2.sup = 1; if (tag === 'sub') s2.sub = 1;
        if (tag === 'font') { const col = hex(c.getAttribute('color')); if (col) s2.color = col; const sz = SIZE_PT[+c.getAttribute('size')]; if (sz) s2.sz = sz * 2; const f = c.getAttribute('face'); if (f) s2.font = f.split(',')[0].replace(/["']/g, '').trim(); }
        if (cs.fontWeight === 'bold' || +cs.fontWeight >= 600) s2.b = 1; if (cs.fontStyle === 'italic') s2.i = 1;
        const td = cs.textDecorationLine || cs.textDecoration || ''; if (/underline/.test(td)) s2.u = 1; if (/line-through/.test(td)) s2.s = 1;
        if (cs.color) { const h = hex(cs.color); if (h) s2.color = h; } if (cs.backgroundColor) { const h = hex(cs.backgroundColor); if (h) s2.bg = h; }
        if (cs.fontSize && /px$/.test(cs.fontSize)) s2.sz = px2hp(parseFloat(cs.fontSize)); if (cs.fontFamily) s2.font = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (tag === 'a' && c.getAttribute('href')) {
          const href = c.getAttribute('href'); if (/^https?:|^mailto:/.test(href)) { const id = 'rId' + rid++; hyper.push({ id, href }); out += `<w:hyperlink r:id="${id}">${inline(c, Object.assign(s2, { link: 1, u: 1, color: s2.color || '0563C1' }), pre)}</w:hyperlink>`; return; }
        }
        out += inline(c, s2, pre || tag === 'pre');
      });
      return out;
    }
    const jcOf = (el) => { const a = el.style && el.style.textAlign; return { center: 'center', right: 'right', justify: 'both' }[a] ? `<w:jc w:val="${{ center: 'center', right: 'right', justify: 'both' }[a]}"/>` : ''; };
    const lineOf = (el) => { const lh = el.style && parseFloat(el.style.lineHeight); return lh ? `<w:spacing w:line="${Math.round(lh * 240)}" w:lineRule="auto"/>` : ''; };
    const para = (ppr, inner) => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`;
    function list(el, lvl, kind) {
      const ordered = el.tagName.toLowerCase() === 'ol'; const check = el.classList && el.classList.contains('dx-check');
      let numId = ordered ? 0 : 1; if (ordered) { numDefs.push(1); numId = 100 + numDefs.length; }
      let out = '';
      [...el.children].forEach((li) => {
        if (li.tagName.toLowerCase() !== 'li') return;
        const clone = li.cloneNode(true); clone.querySelectorAll('ul,ol').forEach((n) => n.remove());
        let inner = inline(clone, {});
        if (check) inner = `<w:r><w:t xml:space="preserve">${li.classList.contains('done') ? '☑ ' : '☐ '}</w:t></w:r>` + inner;
        out += para((check ? '' : `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${numId}"/></w:numPr>`) + (check ? '<w:ind w:left="360"/>' : '') + jcOf(li), inner);
        li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => { out += list(sub, Math.min(lvl + 1, 2)); });
      });
      return out;
    }
    function table(el) {
      const rows = [...el.querySelectorAll('tr')]; const cols = Math.max(1, ...rows.map((r) => r.children.length));
      let t = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/>`).join('') + '</w:tblBorders></w:tblPr><w:tblGrid>' + Array.from({ length: cols }, () => `<w:gridCol w:w="${Math.floor(9360 / cols)}"/>`).join('') + '</w:tblGrid>';
      rows.forEach((r, ri) => {
        t += '<w:tr>';
        [...r.children].forEach((c) => {
          const span = +c.getAttribute('colspan') || 1; const th = c.tagName.toLowerCase() === 'th'; const bg = hex(c.style && c.style.backgroundColor) || (th ? 'F2F2F7' : null);
          t += `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9360 / cols) * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : ''}</w:tcPr>`;
          const segs = []; let cur = document.createElement('div'); c.childNodes.forEach((n) => { if (n.nodeType === 1 && n.tagName.toLowerCase() === 'br') { segs.push(cur); cur = document.createElement('div'); } else cur.appendChild(n.cloneNode(true)); }); segs.push(cur);
          t += segs.map((s) => para(jcOf(c), inline(s, th ? { b: 1 } : {}))).join('') || para('', ''); t += '</w:tc>';
        });
        t += '</w:tr>';
      });
      return t + '</w:tbl>' + para('', '');
    }
    function blocks(parent) {
      let out = '';
      parent.childNodes.forEach((el) => {
        if (el.nodeType === 3) { if (el.textContent.trim()) out += para('', inline({ childNodes: [el] }, {})); return; }
        if (el.nodeType !== 1) return;
        const tag = el.tagName.toLowerCase(); const cls = el.classList;
        if (cls.contains('dx-pb')) out += para('', '<w:r><w:br w:type="page"/></w:r>');
        else if (cls.contains('dx-toc')) return;
        else if (/^h[1-4]$/.test(tag)) out += para(`<w:pStyle w:val="${['Title', 'Heading1', 'Heading2', 'Heading3'][+tag[1] - 1]}"/>` + jcOf(el), inline(el, {}));
        else if (tag === 'ul' || tag === 'ol') out += list(el, 0);
        else if (tag === 'table') out += table(el);
        else if (tag === 'blockquote') out += para('<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="C7C7CC"/></w:pBdr><w:ind w:left="480"/>', inline(el, { i: 1, color: '555555' }));
        else if (tag === 'pre') out += para('<w:shd w:val="clear" w:color="auto" w:fill="F4F4F6"/>', inline(el, { font: 'Courier New', sz: 20 }, true));
        else if (tag === 'hr') out += para('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>', '');
        else if (tag === 'img') out += para('', imageXml(el));
        else if ((tag === 'div' || tag === 'section') && [...el.children].some((c) => /^(p|div|h[1-4]|ul|ol|table|blockquote|pre)$/i.test(c.tagName))) out += blocks(el);
        else out += para(jcOf(el) + lineOf(el), inline(el, {}) || '');
      });
      return out;
    }
    const body = blocks(root);
    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body || para('', '')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const H = (id, name, size, extra) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${extra}" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${H('Title', 'Title', 56, 0)}${H('Heading1', 'heading 1', 40, 240)}${H('Heading2', 'heading 2', 32, 200)}${H('Heading3', 'heading 3', 26, 160)}<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
    const lv = (fmt, txt, i) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${txt}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + i * 360}" w:hanging="360"/></w:pPr>${fmt === 'bullet' ? '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>' : ''}</w:lvl>`;
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2].map((i) => lv('bullet', '', i)).join('')}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2].map((i) => lv('decimal', '%' + (i + 1) + '.', i)).join('')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${numDefs.map((_, k) => `<w:num w:numId="${101 + k}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join('')}</w:numbering>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${media.map((m) => `<Relationship Id="${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')}${hyper.map((h) => `<Relationship Id="${h.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(h.href)}" TargetMode="External"/>`).join('')}</Relationships>`;
    const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bmp" ContentType="image/bmp"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(opts.title || '')}</dc:title><dc:creator>${esc((PatOS.settings && PatOS.settings.userName) || 'PatOS')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`;
    return PatOS.zip.write([
      { name: '[Content_Types].xml', data: types }, { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
      { name: 'docProps/core.xml', data: core }, { name: 'word/document.xml', data: docXml }, { name: 'word/styles.xml', data: styles }, { name: 'word/numbering.xml', data: numbering }, { name: 'word/_rels/document.xml.rels', data: rels },
      ...media.map((m) => ({ name: 'word/media/' + m.name, data: m.bytes, store: true }))
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  PatOS.docx = { toHTML, fromElement };
})();
