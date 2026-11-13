/* Piles Pro (3.3): the bigger tools of Piles, kept apart from its window code.
   - duplicates(): files with the same content (same size first, then the same SHA-256 of what is inside). It only finds
     them: nothing is ever deleted by itself; you pick what goes to the Trash (and the Trash keeps it).
   - compare(a, b): the lines two text files have in common, and what was taken out or added.
   - lookInside(zip): the files in a .zip, without extracting it; take out just one if you want.
   - versionsSheet(file): the earlier versions of a text file (js/fileops.js), to look at or put back.
   All of them show in a sheet over the window they were asked from. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const fs = () => PatOS.fs;
  const skip = (p) => /(^|\/)\./.test(p) || p === '/System' || p.startsWith('/System/');

  /* ---------- duplicates ---------- */
  async function sha(buf) { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join(''); }
  async function duplicates(root, onProgress) {
    const files = []; fs().walk(root || '/', (p, n) => { if (n.type === 'file' && !skip(p)) files.push({ path: p, n }); });
    const sizeOf = (f) => (f.n.blob ? +f.n.size || 0 : typeof f.n.content === 'string' ? f.n.content.length : 0);
    const bySize = new Map(); files.forEach((f) => { const s = sizeOf(f); if (!s) return; if (!bySize.has(s)) bySize.set(s, []); bySize.get(s).push(f); });
    const cands = [...bySize.values()].filter((l) => l.length > 1).flat();
    const byHash = new Map(); let i = 0;
    for (const f of cands) {
      let buf; try { buf = f.n.blob ? await (await fs().getBlob(f.path)).arrayBuffer() : new TextEncoder().encode(f.n.content); } catch (e) { continue; }
      const k = sizeOf(f) + ':' + (await sha(buf)); if (!byHash.has(k)) byHash.set(k, []); byHash.get(k).push(f.path);
      if (onProgress && ++i % 10 === 0) onProgress(i / cands.length);
    }
    return [...byHash.entries()].filter(([, l]) => l.length > 1).map(([k, paths]) => ({ size: +k.split(':')[0], paths: paths.sort() })).sort((a, b) => b.size * b.paths.length - a.size * a.paths.length);
  }

  /* ---------- compare two text files (line by line) ---------- */
  function compare(aText, bText) {
    const A = String(aText).split('\n'), B = String(bText).split('\n');
    if (A.length * B.length > 4e6) return null; // (too big to compare here)
    const m = A.length, n = B.length, L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < m && j < n) { if (A[i] === B[j]) { out.push(['=', A[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push(['-', A[i++]]); else out.push(['+', B[j++]]); }
    while (i < m) out.push(['-', A[i++]]); while (j < n) out.push(['+', B[j++]]);
    return out;
  }

  /* ---------- a sheet over a window ---------- */
  // (the design system's sheet: js/ui.js)
  const sheet = (win, title, body, actions) => PatOS.ui.sheet(win, { title, body, actions });

  async function duplicatesSheet(win, root) {
    const body = h('div', { class: 'fp-dups' }, h('p', { class: 'fp-muted' }, T('Looking…')));
    const s = sheet(win, T('Duplicate files'), body);
    const a = PatOS.live.start({ app: 'finder', title: T('Looking for duplicates'), progress: 0 });
    let groups; try { groups = await duplicates(root, (p) => a.update({ progress: p })); a.end('done', ''); } catch (e) { a.end('failed', e.message); body.innerHTML = ''; body.appendChild(h('p', { class: 'fp-muted' }, T('That didn’t work.'))); return; }
    const draw = () => {
      body.innerHTML = '';
      const live = groups.map((g) => Object.assign({}, g, { paths: g.paths.filter((p) => fs().exists(p)) })).filter((g) => g.paths.length > 1);
      if (!live.length) { body.appendChild(h('p', { class: 'fp-muted' }, T('No duplicates. Every file is one of a kind.'))); return; }
      const waste = live.reduce((s2, g) => s2 + g.size * (g.paths.length - 1), 0);
      body.appendChild(h('p', { class: 'fp-muted' }, live.length + ' ' + T('groups') + ' · ' + PatOS.fmtBytes(waste) + ' ' + T('could be freed') + '. ' + T('Nothing is deleted unless you choose it.')));
      live.forEach((g) => body.appendChild(h('div', { class: 'fp-group' }, h('small', {}, g.paths.length + ' × ' + PatOS.fmtBytes(g.size)),
        ...g.paths.map((p) => h('div', { class: 'fp-row' }, h('span', { class: 'fp-path' }, p),
          h('button', { class: 'btn', onclick: () => { s.close(); PatOS.launch('finder', { path: fs().dirname(p) }); } }, T('Show')),
          h('button', { class: 'btn', disabled: g.paths.filter((x) => fs().exists(x)).length < 2, onclick: () => { fs().remove(p); draw(); } }, T('Move to Trash')))))));
    };
    draw();
  }

  function compareSheet(win, a, b) {
    const ta = fs().read(a), tb = fs().read(b);
    if (typeof ta !== 'string' || typeof tb !== 'string' || /^data:/.test(ta) || /^data:/.test(tb)) return sheet(win, T('Compare'), h('p', { class: 'fp-muted' }, T('Only text files can be compared.')));
    const d = compare(ta, tb);
    if (!d) return sheet(win, T('Compare'), h('p', { class: 'fp-muted' }, T('These files are too big to compare here.')));
    const added = d.filter((x) => x[0] === '+').length, removed = d.filter((x) => x[0] === '-').length;
    return sheet(win, T('Compare'), h('div', {}, h('p', { class: 'fp-muted' }, fs().basename(a) + ' → ' + fs().basename(b) + ' · ' + (added || removed ? '+' + added + ' −' + removed : T('They are the same.'))),
      h('pre', { class: 'fp-diff' }, ...d.map(([k, l]) => h('div', { class: 'fd-' + (k === '+' ? 'add' : k === '-' ? 'del' : 'same') }, (k === '=' ? '  ' : k + ' ') + l)))));
  }

  async function lookInside(win, path) {
    const body = h('div', {}, h('p', { class: 'fp-muted' }, T('Opening…')));
    const s = sheet(win, fs().basename(path), body);
    let z; try { z = await PatOS.zip.read(await fs().getBlob(path)); } catch (e) { body.innerHTML = ''; body.appendChild(h('p', { class: 'fp-muted' }, T('This archive can’t be read.'))); return; }
    const names = z.names.filter((n) => !n.endsWith('/'));
    body.innerHTML = '';
    body.appendChild(h('p', { class: 'fp-muted' }, names.length + ' ' + T('files') + ' · ' + T('nothing is extracted until you choose')));
    names.slice(0, 400).forEach((n) => body.appendChild(h('div', { class: 'fp-row' }, h('span', { class: 'fp-path' }, n), h('small', {}, PatOS.fmtBytes(z.size(n))),
      h('button', { class: 'btn', onclick: async () => { const dir = fs().dirname(path); const name = fs().uniqueName(dir, n.split('/').pop()); const data = await z.get(n);
        if (/\.(txt|md|json|csv|js|css|html|py|xml)$/i.test(name) && data.length < 2e6) fs().write(dir + '/' + name, new TextDecoder().decode(data)); else await fs().writeBlob(dir + '/' + name, new Blob([data]));
        PatOS.notify({ title: T('Extracted'), body: name, icon: 'finder', priority: 'low' }); } }, T('Extract')))));
    if (names.length > 400) body.appendChild(h('p', { class: 'fp-muted' }, '+ ' + (names.length - 400)));
    s.el.querySelector('.fp-acts');
  }

  function versionsSheet(win, path) {
    const body = h('div', {});
    const draw = () => {
      body.innerHTML = ''; const l = PatOS.versions ? PatOS.versions.list(path) : [];
      if (!l.length) { body.appendChild(h('p', { class: 'fp-muted' }, T('No earlier versions yet. A version is kept when you save over this file (at most one every 2 minutes, the last 10).'))); return; }
      const pv = h('pre', { class: 'fp-preview' });
      l.forEach((v) => body.appendChild(h('div', { class: 'fp-row' }, h('span', { class: 'fp-path' }, new Date(v.t).toLocaleString(PatOS.locale)), h('small', {}, PatOS.fmtBytes(v.size)),
        h('button', { class: 'btn', onclick: () => { pv.textContent = PatOS.versions.read(path, v.i).slice(0, 4000); } }, T('Look')),
        h('button', { class: 'btn', onclick: () => { PatOS.versions.restore(path, v.i); PatOS.notify({ title: T('Version restored'), body: fs().basename(path), icon: 'finder', priority: 'low' }); draw(); } }, T('Restore')))));
      body.appendChild(pv);
    };
    draw(); return sheet(win, T('Versions of') + ' ' + fs().basename(path), body);
  }

  PatOS.finderPro = { duplicates, compare, sheet, duplicatesSheet, compareSheet, lookInside, versionsSheet };
})();
