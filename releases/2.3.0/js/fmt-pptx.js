/* PowerPoint (.pptx): open PowerPoint files in Slides and save Slides as PowerPoint files. */
(function () {
  'use strict';
  const { esc, kids, kid, attr, deep, parse } = PatOS.xml;
  const W = 960, H = 540, EMU = 9525;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const rattr = (el, name) => (el ? el.getAttributeNS(NS_R, name) || [...el.attributes].find((a) => a.localName === name && a.prefix === 'r')?.value || null : null);

  /* ---------------- open ---------------- */
  async function toDeck(blob) {
    const z = await PatOS.zip.read(blob);
    if (!z.has('ppt/presentation.xml')) throw new Error('This isn’t a PowerPoint (.pptx) file.');
    const relsOf = async (part) => { const dir = part.slice(0, part.lastIndexOf('/') + 1), rp = dir + '_rels/' + part.slice(dir.length) + '.rels'; const out = {}; if (z.has(rp)) deep(parse(await z.text(rp)).documentElement, 'Relationship').forEach((r) => { let t = r.getAttribute('Target'); if (!/^https?:/.test(t)) { const parts = (t.startsWith('/') ? t.slice(1) : dir + t).split('/'); const st = []; parts.forEach((p) => { if (p === '..') st.pop(); else if (p !== '.') st.push(p); }); t = st.join('/'); } out[r.getAttribute('Id')] = { target: t, type: r.getAttribute('Type') }; }); return out; };
    const pres = parse(await z.text('ppt/presentation.xml')).documentElement;
    const sz = kid(pres, 'sldSz'); const SW = +attr(sz, 'cx') || 9144000, SH = +attr(sz, 'cy') || 5143500; const sc = W / SW, scy = H / SH;
    const prel = await relsOf('ppt/presentation.xml');
    // theme colours
    const themeFile = Object.values(prel).find((r) => /theme$/.test(r.type));
    const theme = {};
    if (themeFile && z.has(themeFile.target)) { const cs = deep(parse(await z.text(themeFile.target)).documentElement, 'clrScheme')[0]; kids(cs, 'dk1 lt1 dk2 lt2 accent1 accent2 accent3 accent4 accent5 accent6 hlink'.split(' ').length ? null : null); if (cs) [...cs.children].forEach((c) => { const v = c.firstElementChild; theme[c.localName] = v ? (attr(v, 'val') && attr(v, 'val').length === 6 ? attr(v, 'val') : attr(v, 'lastClr') || '000000') : '000000'; }); }
    const mapSch = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
    const color = (el) => {
      if (!el) return null; const c = [...el.children].find((x) => /^(srgbClr|schemeClr|sysClr|prstClr)$/.test(x.localName)); if (!c) return null;
      let hex = null; if (c.localName === 'srgbClr') hex = attr(c, 'val'); else if (c.localName === 'schemeClr') hex = theme[mapSch[attr(c, 'val')] || attr(c, 'val')]; else if (c.localName === 'sysClr') hex = attr(c, 'lastClr') || '000000'; else hex = { black: '000000', white: 'FFFFFF' }[attr(c, 'val')];
      if (!hex) return null; const lm = attr(kid(c, 'lumMod'), 'val'), lo = attr(kid(c, 'lumOff'), 'val');
      if (lm) { const n = [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16)); const f = +lm / 100000, off = lo ? +lo / 100000 : 0; hex = n.map((v) => Math.max(0, Math.min(255, Math.round(v * f + 255 * off))).toString(16).padStart(2, '0')).join(''); }
      return '#' + hex.toLowerCase();
    };
    const slideIds = kids(kid(pres, 'sldIdLst'), 'sldId').map((s) => rattr(s, 'id')); const deck = { theme: 'Simple', transition: 'fade', slides: [] };
    let skippedMedia = 0;
    for (const id of slideIds) {
      const part = prel[id] && prel[id].target; if (!part || !z.has(part)) continue;
      const sld = parse(await z.text(part)).documentElement; const srel = await relsOf(part);
      // layout placeholders give positions to shapes that don't have their own
      const layoutPos = {};
      const layout = Object.values(srel).find((r) => /slideLayout$/.test(r.type));
      for (const lp of [layout && layout.target].filter(Boolean)) {
        if (!z.has(lp)) continue; const ld = parse(await z.text(lp)).documentElement;
        const lrel = await relsOf(lp); const master = Object.values(lrel).find((r) => /slideMaster$/.test(r.type));
        const grab = (doc) => deep(doc, 'sp').forEach((sp) => { const ph = deep(kid(kid(sp, 'nvSpPr'), 'nvPr'), 'ph')[0]; const x = deep(kid(sp, 'spPr'), 'xfrm')[0]; if (ph && x) { const key = (attr(ph, 'type') || 'body') + ':' + (attr(ph, 'idx') || '0'); const off = kid(x, 'off'), ext = kid(x, 'ext'); layoutPos[key] = layoutPos[key] || { x: +attr(off, 'x'), y: +attr(off, 'y'), cx: +attr(ext, 'cx'), cy: +attr(ext, 'cy') }; if (!layoutPos[attr(ph, 'type') || 'body']) layoutPos[attr(ph, 'type') || 'body'] = layoutPos[key]; } });
        grab(ld); if (master && z.has(master.target)) grab(parse(await z.text(master.target)).documentElement);
      }
      const els = []; let bg;
      const bgEl = deep(kid(sld, 'cSld'), 'bg')[0]; if (bgEl) { const sf = deep(bgEl, 'solidFill')[0]; if (sf) bg = color(sf); }
      const tree = kid(kid(sld, 'cSld'), 'spTree');
      const walkTree = async (parent) => {
        for (const sp of parent.children) {
          if (sp.localName === 'grpSp') { await walkTree(sp); continue; }
          if (!/^(sp|pic)$/.test(sp.localName)) continue;
          const nv = kid(sp, sp.localName === 'pic' ? 'nvPicPr' : 'nvSpPr'); const ph = deep(kid(nv, 'nvPr'), 'ph')[0];
          let xf = deep(kid(sp, 'spPr'), 'xfrm')[0]; let pos = null;
          if (xf) { const off = kid(xf, 'off'), ext = kid(xf, 'ext'); pos = { x: +attr(off, 'x'), y: +attr(off, 'y'), cx: +attr(ext, 'cx'), cy: +attr(ext, 'cy') }; }
          else if (ph) pos = layoutPos[(attr(ph, 'type') || 'body') + ':' + (attr(ph, 'idx') || '0')] || layoutPos[attr(ph, 'type') || 'body'];
          if (!pos) continue;
          const box = { x: Math.round(pos.x * sc), y: Math.round(pos.y * scy), w: Math.max(10, Math.round(pos.cx * sc)), h: Math.max(10, Math.round(pos.cy * scy)) };
          if (sp.localName === 'pic') {
            const blip = deep(sp, 'blip')[0]; const rid = rattr(blip, 'embed'); const mt = srel[rid] && srel[rid].target; if (!mt || !z.has(mt)) continue;
            const ext = mt.split('.').pop().toLowerCase(); if (!MIME[ext]) { skippedMedia++; continue; }
            els.push(Object.assign({ type: 'image', src: 'data:' + MIME[ext] + ';base64,' + PatOS.zip.b64(await z.get(mt)) }, box)); continue;
          }
          const tx = kid(sp, 'txBody'); const spPr = kid(sp, 'spPr'); const fill = deep(spPr, 'solidFill').filter((f) => f.parentNode === spPr)[0]; const geom = attr(deep(spPr, 'prstGeom')[0], 'prst');
          const text = tx ? [...kids(tx, 'p')].map((p) => ({ p, t: deep(p, 't').map((t) => t.textContent).join('') })) : []; const has = text.some((x) => x.t.trim());
          if (!has && (fill || geom)) { const col = color(fill) || '#cccccc'; els.push(Object.assign({ type: 'shape', shape: { ellipse: 'circle', roundRect: 'rounded', triangle: 'triangle', rightArrow: 'arrow', star5: 'star', line: 'line', straightConnector1: 'line', wedgeRectCallout: 'bubble' }[geom] || 'rect', fill: col }, box)); continue; }
          if (!has) continue;
          let html = '', size = 0, bold = 0, col = null, italic = 0, align; let inList = false;
          text.forEach(({ p }) => {
            const pPr = kid(p, 'pPr'); const bullet = pPr && (kid(pPr, 'buChar') || kid(pPr, 'buAutoNum')); const al = attr(pPr, 'algn'); if (al && !align) align = { ctr: 'center', r: 'right', just: 'justify' }[al];
            let inner = '';
            kids(p, 'r').forEach((r) => {
              const rp = kid(r, 'rPr'); let t = esc(deep(r, 't').map((x) => x.textContent).join(''));
              if (!t) return;
              const szv = rp && attr(rp, 'sz'); if (szv && !size) size = Math.round(+szv / 100 * 12700 * sc); if (rp && attr(rp, 'b') === '1') { if (text.length === 1) bold = 1; else t = '<b>' + t + '</b>'; }
              if (rp && attr(rp, 'i') === '1') { if (text.length === 1) italic = 1; else t = '<i>' + t + '</i>'; }
              const c = rp && color(kid(rp, 'solidFill')); if (c && !col) col = c;
              inner += t;
            });
            kids(p, 'br').forEach(() => { inner += '<br>'; });
            if (bullet) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + (inner || '<br>') + '</li>'; } else { if (inList) { html += '</ul>'; inList = false; } html += inner + '<br>'; }
          });
          if (inList) html += '</ul>'; html = html.replace(/(<br>)+$/, '');
          if (!size) { const dsz = deep(tx, 'defRPr')[0]; size = dsz && attr(dsz, 'sz') ? Math.round(+attr(dsz, 'sz') / 100 * 12700 * sc) : (attr(ph, 'type') === 'title' || attr(ph, 'type') === 'ctrTitle' ? 40 : 24); }
          els.push(Object.assign({ type: 'text', html, size: Math.max(10, Math.min(120, size || 24)), bold, italic, align, color: col || undefined, role: ph && /^(title|ctrTitle)$/.test(attr(ph, 'type') || '') ? 'title' : undefined, fill: fill && !has ? color(fill) : undefined }, box));
        }
      };
      await walkTree(tree);
      let notes = ''; const nrel = Object.values(srel).find((r) => /notesSlide$/.test(r.type));
      if (nrel && z.has(nrel.target)) { const nd = parse(await z.text(nrel.target)).documentElement; notes = deep(nd, 'sp').filter((sp) => deep(sp, 'ph')[0] && attr(deep(sp, 'ph')[0], 'type') === 'body').map((sp) => deep(sp, 'p').map((p) => deep(p, 't').map((t) => t.textContent).join('')).join('\n')).join('\n').trim(); }
      deck.slides.push({ els, bg, notes: notes || undefined });
    }
    // light slides need dark text: use the plain white theme, dark ones keep text colours from the file
    deck.warn = skippedMedia;
    return deck;
  }

  /* ---------------- save ---------------- */
  const hex6 = (c) => { if (!c) return null; const m = /^#([0-9a-f]{6})$/i.exec(c); if (m) return m[1].toUpperCase(); const m3 = /^#([0-9a-f]{3})$/i.exec(c); if (m3) return m3[1].replace(/./g, '$&$&').toUpperCase(); const r = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return r ? [r[1], r[2], r[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase() : null; };
  const PRST = { rect: 'rect', rounded: 'roundRect', circle: 'ellipse', triangle: 'triangle', arrow: 'rightArrow', star: 'star5', line: 'line', bubble: 'wedgeRectCallout' };
  async function fromDeck(deck, THEMES) {
    const t = THEMES[deck.theme] || THEMES.Simple; const media = []; let rid;
    const fgHex = hex6(t.fg) || '000000', accent = hex6(t.accent) || '0A84FF';
    const bgXml = (bg) => {
      const css = bg || t.bg; const colors = (String(css).match(/#[0-9a-f]{6}|#[0-9a-f]{3}\b/gi) || []).map(hex6).filter(Boolean);
      if (/gradient/.test(css) && colors.length > 1) return `<p:bg><p:bgPr><a:gradFill rotWithShape="1"><a:gsLst>${colors.map((c, i) => `<a:gs pos="${Math.round(i / (colors.length - 1) * 100000)}"><a:srgbClr val="${c}"/></a:gs>`).join('')}</a:gsLst><a:lin ang="2700000" scaled="0"/></a:gradFill><a:effectLst/></p:bgPr></p:bg>`;
      return `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${colors[0] || 'FFFFFF'}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;
    };
    function paragraphs(el) {
      const wrap = PatOS.parseHTML(el.html || '');
      const base = { sz: Math.round((el.size || 24) * 0.75 * 100), b: el.bold ? 1 : 0, i: el.italic ? 1 : 0, u: el.underline ? 1 : 0, color: hex6(el.color) || (el.accent ? accent : fgHex), font: el.role === 'title' ? t.head : t.font };
      const paras = []; let cur = []; let bullet = false;
      const flush = () => { paras.push({ runs: cur, bullet }); cur = []; bullet = false; };
      const walk = (node, st) => {
        node.childNodes.forEach((c) => {
          if (c.nodeType === 3) { if (c.textContent) cur.push({ t: c.textContent, st }); return; }
          const tag = c.tagName.toLowerCase(); const s2 = Object.assign({}, st);
          if (tag === 'br') { flush(); return; } if (tag === 'b' || tag === 'strong') s2.b = 1; if (tag === 'i' || tag === 'em') s2.i = 1; if (tag === 'u') s2.u = 1;
          if (tag === 'ul' || tag === 'ol') { [...c.children].forEach((li) => { if (cur.length) flush(); bullet = true; walk(li, s2); flush(); }); return; }
          if (tag === 'div' || tag === 'p') { if (cur.length) flush(); walk(c, s2); if (cur.length) flush(); return; }
          if (c.style && c.style.color) { const h = hex6(c.style.color); if (h) s2.color = h; }
          walk(c, s2);
        });
      };
      walk(wrap, base); if (cur.length || !paras.length) flush();
      return paras.map((p) => `<a:p><a:pPr algn="${{ center: 'ctr', right: 'r', justify: 'just' }[el.align] || 'l'}"${p.bullet ? ' marL="342900" indent="-342900"' : ''}>${p.bullet ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>' : '<a:buNone/>'}</a:pPr>${p.runs.map((r) => `<a:r><a:rPr lang="en-US" sz="${r.st.sz}"${r.st.b ? ' b="1"' : ''}${r.st.i ? ' i="1"' : ''}${r.st.u ? ' u="sng"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${r.st.color}"/></a:solidFill><a:latin typeface="${esc(String(r.st.font).split(',')[0].replace(/["']/g, '').trim())}"/></a:rPr><a:t>${esc(r.t)}</a:t></a:r>`).join('')}${p.runs.length ? '' : `<a:endParaRPr lang="en-US" sz="${base.sz}"/>`}</a:p>`).join('');
    }
    const slideFiles = [];
    for (let i = 0; i < deck.slides.length; i++) {
      const s = deck.slides[i]; const rels = []; let id = 2; let shapes = '';
      for (const el of s.els) {
        const off = `<a:xfrm><a:off x="${Math.round(el.x * EMU)}" y="${Math.round(el.y * EMU)}"/><a:ext cx="${Math.round(el.w * EMU)}" cy="${Math.round(el.h * EMU)}"/></a:xfrm>`; const n = id++;
        if (el.type === 'text') shapes += `<p:sp><p:nvSpPr><p:cNvPr id="${n}" name="${el.role === 'title' ? 'Title' : 'TextBox'} ${n}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${off}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${el.fill ? `<a:solidFill><a:srgbClr val="${hex6(el.fill) || 'FFFFFF'}"/></a:solidFill>` : '<a:noFill/>'}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paragraphs(el)}</p:txBody></p:sp>`;
        else if (el.type === 'shape') { const fill = hex6(el.fill === 'accent' ? t.accent : el.fill) || accent; shapes += el.shape === 'line' ? `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${n}" name="Line ${n}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${Math.round(el.x * EMU)}" y="${Math.round(el.y * EMU)}"/><a:ext cx="${Math.round(el.w * EMU)}" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${Math.round((el.stroke || 4) * EMU)}"><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill></a:ln></p:spPr></p:cxnSp>` : `<p:sp><p:nvSpPr><p:cNvPr id="${n}" name="Shape ${n}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${off}<a:prstGeom prst="${PRST[el.shape] || 'rect'}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`; }
        else if (el.type === 'image') {
          const m = /^data:([^;,]+);base64,(.*)$/s.exec(el.src || ''); if (!m) continue; const ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif' }[m[1]]; if (!ext) continue;
          const bin = atob(m[2]); const u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
          const name = 'image' + (media.length + 1) + '.' + ext; media.push({ name, bytes: u8 }); rid = 'rId' + (rels.length + 2); rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${name}"/>`);
          shapes += `<p:pic><p:nvPicPr><p:cNvPr id="${n}" name="Picture ${n}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${off}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
        }
      }
      const hasNotes = !!(s.notes && s.notes.trim());
      if (hasNotes) rels.push(`<Relationship Id="rId${rels.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${i + 1}.xml"/>`);
      slideFiles.push({ xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_R}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${bgXml(s.bg)}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`, rels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${rels.join('')}</Relationships>`, notes: hasNotes ? s.notes : null });
    }
    const P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' + NS_R + '" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const REL = (items) => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join('')}</Relationships>`;
    const grp = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
    const hasNotes = slideFiles.some((f) => f.notes);
    const files = [];
    files.push({ name: '[Content_Types].xml', data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${hasNotes ? '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' : ''}${slideFiles.map((f, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>${f.notes ? `<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>` : ''}`).join('')}</Types>` });
    files.push({ name: '_rels/.rels', data: REL(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>']) });
    const presRels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>', ...slideFiles.map((f, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`), `<Relationship Id="rId${slideFiles.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`];
    if (hasNotes) presRels.push(`<Relationship Id="rId${slideFiles.length + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/>`);
    files.push({ name: 'ppt/_rels/presentation.xml.rels', data: REL(presRels) });
    files.push({ name: 'ppt/presentation.xml', data: `${XML}<p:presentation ${P}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>${hasNotes ? `<p:notesMasterIdLst><p:notesMasterId r:id="rId${slideFiles.length + 3}"/></p:notesMasterIdLst>` : ''}<p:sldIdLst>${slideFiles.map((f, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` });
    const txStyle = '<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles>';
    files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: `${XML}<p:sldMaster ${P}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${grp}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>${txStyle}</p:sldMaster>` });
    files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: REL(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>', '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>']) });
    files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: `${XML}<p:sldLayout ${P} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${grp}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` });
    files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: REL(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>']) });
    const themeXml = (name) => `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${name}"><a:themeElements><a:clrScheme name="${name}"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="${accent}"/></a:accent1><a:accent2><a:srgbClr val="FF375F"/></a:accent2><a:accent3><a:srgbClr val="32D74B"/></a:accent3><a:accent4><a:srgbClr val="FF9F0A"/></a:accent4><a:accent5><a:srgbClr val="BF5AF2"/></a:accent5><a:accent6><a:srgbClr val="64D2FF"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="${name}"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="${name}"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
    files.push({ name: 'ppt/theme/theme1.xml', data: themeXml('PatOS') });
    if (hasNotes) {
      files.push({ name: 'ppt/theme/theme2.xml', data: themeXml('PatOS Notes') });
      files.push({ name: 'ppt/notesMasters/notesMaster1.xml', data: `${XML}<p:notesMaster ${P}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${grp}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:notesMaster>` });
      files.push({ name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: REL(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme2.xml"/>']) });
    }
    slideFiles.forEach((f, i) => {
      files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: f.xml }, { name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: f.rels });
      if (f.notes) {
        files.push({ name: `ppt/notesSlides/notesSlide${i + 1}.xml`, data: `${XML}<p:notes ${P}><p:cSld><p:spTree>${grp}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${f.notes.split('\n').map((l) => `<a:p><a:r><a:rPr lang="en-US"/><a:t>${esc(l)}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>` });
        files.push({ name: `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, data: REL(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>', `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${i + 1}.xml"/>`]) });
      }
    });
    media.forEach((m) => files.push({ name: 'ppt/media/' + m.name, data: m.bytes, store: true }));
    return PatOS.zip.write(files, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  }
  PatOS.pptx = { toDeck, fromDeck };
})();
