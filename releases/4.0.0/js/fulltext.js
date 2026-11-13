/* PatOS search inside everything (4.0): one index of the words inside your files, notes, reminders, calendar events,
   contacts and captures, kept up to date as you edit. Spotlight, Piles and Pat ask it.
   - Words in any order: "biology report" finds "the report for biology". The last word you type also matches the start of
     a word ("biol"), so results come while you type.
   - Ranked: words in the title count more, the exact phrase more again, then how often they appear, then how recent.
   - Every result carries the passage where it matches (before / match / after: plain text, never HTML).
   - Built in small pieces when the computer is idle, and only the file that changed is read again: never a pause.
   - Limited for small computers: at most 100 KB of text per item and 6 MB in all; anything bigger is found by its name.
   - Private: on this device only, never saved or synced. Hidden folders (the Trash) and /System are left out.
   Not an AI: words and positions only. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const MAX_DOC = 100 * 1024, MAX_ALL = 6 * 1024 * 1024;
  const TEXTY = /\.(txt|md|markdown|js|css|html?|json|csv|tsv|py|xml|log|ya?ml|ts|c|cpp|h|java|rb|go|rs|sh|ini|pdoc|psheet|pslides|pform|patdesk)$/i;
  // the same length as what it folds, so a place found in the folded text is the same place in the real text
  const foldKeep = (s) => { let o = ''; for (const ch of String(s || '')) { const f = (ch.normalize('NFD')[0] || ch).toLowerCase(); o += f.length === ch.length ? f : ch; } return o; };
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
  const words = (s) => (fold(s).match(WORD) || []).map((w) => w.replace(/['’_-]+$/, '')).filter((w) => w.length >= 2);

  const docs = new Map();   // key -> { key, kind, title, sub, raw, low, t, path? }
  const inv = new Map();    // word -> Set(key)
  let sorted = null;        // every word, sorted (for "starts with"); made again when needed
  let total = 0, ready = false, building = false;
  const queue = [];         // what still has to be read: ['file', path] | ['notes'] | ...

  function unindex(key) {
    const d = docs.get(key); if (!d) return;
    total -= d.raw.length;
    for (const w of d.words) { const s = inv.get(w); if (s) { s.delete(key); if (!s.size) { inv.delete(w); sorted = null; } } }
    docs.delete(key);
  }
  function index(key, kind, title, raw, extra) {
    unindex(key);
    raw = String(raw || ''); if (raw.length > MAX_DOC) raw = raw.slice(0, MAX_DOC);
    if (total + raw.length > MAX_ALL) raw = ''; // (full: the name is still found)
    const ws = new Set(words(title + ' ' + raw));
    const d = Object.assign({ key, kind, title: String(title || ''), raw, low: foldKeep(raw), lowTitle: fold(title), words: ws, t: 0 }, extra || {});
    docs.set(key, d); total += raw.length;
    for (const w of ws) { let s = inv.get(w); if (!s) { s = new Set(); inv.set(w, s); sorted = null; } s.add(key); }
  }
  // the words a person would read in a file (a PatOS document is stored as data: its text is pulled out of it)
  function readable(path, content) {
    let t = content;
    if (/\.(pdoc|pslides|pform|html?)$/i.test(path)) t = t.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\\[nrt]/g, ' ').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/g, ' ').replace(/"[a-zA-Z]+":/g, ' ').replace(/["{}[\],]+/g, ' ');
    else if (/\.(psheet|json|patdesk)$/i.test(path)) t = t.replace(/"[a-zA-Z0-9_]+":/g, ' ').replace(/["{}[\],]+/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }
  const hidden = (p) => /\/\./.test(p) || p === '/System' || p.startsWith('/System/');
  function indexFile(p) {
    const key = 'file:' + p; const n = PatOS.fs.get(p);
    if (!n || hidden(p)) { unindex(key); return; }
    const name = PatOS.fs.basename(p);
    const text = n.type === 'file' && !n.blob && typeof n.content === 'string' && !n.content.startsWith('data:') && TEXTY.test(name) ? readable(p, n.content.length > MAX_DOC * 3 ? n.content.slice(0, MAX_DOC * 3) : n.content) : '';
    index(key, n.type === 'dir' ? 'folder' : 'file', name, text, { path: p, sub: PatOS.fs.dirname(p), t: n.modified || n.mtime || 0 });
  }
  function indexTree(root) { // (a folder that was added, moved or deleted: what is under it now)
    for (const k of [...docs.keys()]) if (k === 'file:' + root || k.startsWith('file:' + (root === '/' ? '/' : root + '/'))) { const p = k.slice(5); if (!PatOS.fs.exists(p)) unindex(k); }
    if (PatOS.fs.exists(root)) PatOS.fs.walk(root, (p) => { if (p !== '/') queue.push(['file', p]); });
  }
  const look = (k, d) => (PatOS.store.peek && PatOS.store.peek(k) !== undefined ? PatOS.store.peek(k) : PatOS.store.get(k, d)) || d;
  const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  function indexList(kind) {
    for (const k of [...docs.keys()]) if (k.startsWith(kind + ':')) unindex(k);
    if (kind === 'note') look('notes', []).filter((n) => n && n.id && !n.deletedAt).forEach((n) => { const body = strip(n.body); index('note:' + n.id, 'note', n.title || body.split(/[.\n]/)[0].slice(0, 60) || T('Untitled'), body, { t: n.updated || 0 }); });
    if (kind === 'reminder') look('reminders', []).filter((r) => r && r.id).forEach((r) => index('reminder:' + r.id, 'reminder', r.text || '', r.notes || '', { sub: r.due || '', t: r.due ? Date.parse(r.due) || 0 : 0, done: !!r.done }));
    if (kind === 'event') { const cal = look('calendar', {}); Object.keys(cal).forEach((day) => (cal[day] || []).forEach((e) => { if (e) index('event:' + day + ':' + (e.id || e.title), 'event', e.title || '', [e.notes, e.location].filter(Boolean).join(' · '), { sub: day + (e.time ? ' ' + e.time : ''), day, t: Date.parse(day) || 0 }); })); }
    if (kind === 'contact') look('contacts', []).forEach((c) => { if (!c || !c.id) return; const name = ((c.first || '') + ' ' + (c.last || '')).trim() || c.company || c.email || ''; index('contact:' + c.id, 'contact', name, [c.company, c.email, c.phone, c.notes].filter(Boolean).join(' · '), { sub: c.email || c.phone || '' }); });
    if (kind === 'capture' && PatOS.capture && PatOS.capture.list) PatOS.capture.list({}).forEach((c) => { const o = c.obj || {}; index('capture:' + c.id, 'capture', c.title || '', [o.text, o.url, (c.tags || []).join(' ')].filter(Boolean).join(' '), { t: c.t || 0 }); });
  }
  // a little at a time, when the computer has nothing else to do
  const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 30));
  function pump() {
    if (building) return; building = true;
    idle(function work(deadline) {
      let n = 0;
      while (queue.length && (deadline.timeRemaining() > 2 || n < 2)) {
        const [kind, arg] = queue.shift(); n++;
        try { kind === 'file' ? indexFile(arg) : kind === 'tree' ? indexTree(arg) : indexList(kind); } catch (e) {}
      }
      if (queue.length) idle(work); else { building = false; if (!ready) { ready = true; PatOS.emit('fulltext:ready'); } }
    });
  }
  function start() {
    if (ready || building || queue.length) return;
    PatOS.fs.walk('/', (p) => { if (p !== '/' && !hidden(p)) queue.push(['file', p]); });
    ['note', 'reminder', 'event', 'contact', 'capture'].forEach((k) => queue.push([k]));
    pump();
  }
  // kept up to date: only what changed is read again
  PatOS.on('fs', (e) => { if (!ready && !building && !queue.length) return; const p = e && e.path; if (!p || p === '/') { queue.push(['tree', '/']); } else if (PatOS.fs.isDir(p)) queue.push(['tree', p]); else { queue.push(['file', p]); if (!PatOS.fs.exists(p)) queue.push(['tree', p]); } pump(); });
  const later = (k) => () => { if (ready || building) { queue.push([k]); pump(); } };
  PatOS.on('notes', later('note')); PatOS.on('reminders', later('reminder')); PatOS.on('calendar', later('event')); PatOS.on('contacts', later('contact')); PatOS.on('capture', later('capture'));
  // (started a little after PatOS opens, when nothing else is going on; or right away by the first search)
  setTimeout(() => idle(start), 8000);

  /* ---------- asking it ---------- */
  function prefixed(p) {
    if (!sorted) sorted = [...inv.keys()].sort();
    let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < p) lo = m + 1; else hi = m; }
    const out = []; for (let i = lo; i < sorted.length && sorted[i].startsWith(p) && out.length < 200; i++) out.push(sorted[i]); return out;
  }
  // the passage around the first place it matches (the phrase if it's there, else the rarest word)
  function passage(d, terms, phrase) {
    const low = d.low; let at = phrase ? low.indexOf(phrase) : -1, len = phrase ? phrase.length : 0;
    if (at < 0) for (const w of terms) { const re = new RegExp('(^|[^\\p{L}\\p{N}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'); const m = re.exec(low); if (m) { at = m.index + m[1].length; len = (/^[\p{L}\p{N}'’_-]+/u.exec(low.slice(at)) || [w])[0].length; break; } }
    if (at < 0) return null;
    const a = Math.max(0, at - 50), b = Math.min(d.raw.length, at + len + 80);
    let before = d.raw.slice(a, at), after = d.raw.slice(at + len, b);
    if (a > 0) before = '…' + before.replace(/^\S*\s/, ''); if (b < d.raw.length) after = after.replace(/\s\S*$/, '') + '…';
    return { before, match: d.raw.slice(at, at + len), after };
  }
  function search(q, opts) {
    opts = opts || {}; const n = opts.limit || 20;
    if (!ready) { start(); if (opts.wait !== false) flushSync(); }
    const qw = words(q); if (!qw.length) return [];
    const last = qw[qw.length - 1], typing = opts.prefix !== false && !/\s$/.test(q);
    // every word must be somewhere (the last one may be the start of a word while typing)
    let keys = null;
    for (let i = 0; i < qw.length; i++) {
      const w = qw[i]; const set = new Set(inv.get(w) || []);
      if (i === qw.length - 1 && typing && w.length >= 2) prefixed(w).forEach((x) => (inv.get(x) || []).forEach((k) => set.add(k)));
      keys = keys ? new Set([...keys].filter((k) => set.has(k))) : set;
      if (!keys.size) return [];
    }
    const phrase = qw.length > 1 ? fold(q).replace(/\s+/g, ' ').trim() : '';
    const N = docs.size || 1, out = [];
    for (const k of keys) {
      const d = docs.get(k); if (!d || (opts.kinds && !opts.kinds.includes(d.kind)) || (opts.under && !(d.path && (d.path === opts.under || d.path.startsWith(opts.under + '/'))))) continue;
      let s = 0;
      for (const w of qw) {
        const df = (inv.get(w) || new Set()).size || 1; const idf = Math.log(1 + N / df);
        if (d.lowTitle.includes(w)) s += 3 * idf;
        let c = 0, i = -1; while (c < 20 && (i = d.low.indexOf(w, i + 1)) >= 0) c++;
        s += Math.min(c, 20) ** 0.5 * idf;
      }
      if (phrase && (d.lowTitle.includes(phrase) || d.low.includes(phrase))) s *= 1.8;
      if (d.t) s += Math.max(0, 1 - (Date.now() - d.t) / (90 * 864e5)) * 0.5; // (a little for what is recent)
      out.push({ d, s });
    }
    out.sort((a, b) => b.s - a.s);
    return out.slice(0, n).map(({ d, s }) => ({ key: d.key, kind: d.kind, title: d.title, sub: d.sub || '', path: d.path, day: d.day, score: Math.round(s * 10) / 10, passage: passage(d, qw.slice().sort((a, b) => (inv.get(a) || []).size - (inv.get(b) || []).size), phrase) }));
  }
  // (a search before the index is ready: read what is left now, so the answer is complete)
  function flushSync() { while (queue.length) { const [kind, arg] = queue.shift(); try { kind === 'file' ? indexFile(arg) : kind === 'tree' ? indexTree(arg) : indexList(kind); } catch (e) {} } ready = true; }
  function open(r) {
    const [kind, ...rest] = String(r.key).split(':'); const id = rest.join(':');
    if (kind === 'file') return PatOS.fs.isDir(id) ? PatOS.launch('finder', { path: id }) : PatOS.openFile(id);
    if (kind === 'note') return PatOS.launch('notes', { id });
    if (kind === 'reminder') return PatOS.launch('reminders');
    if (kind === 'event') return PatOS.launch('calendar', { day: id.split(':')[0] });
    if (kind === 'contact') return PatOS.launch('contacts', { id });
    if (kind === 'capture') return PatOS.launch('capture');
  }
  PatOS.fulltext = { search, open, ready: () => ready, start, size: () => ({ items: docs.size, words: inv.size, textKB: Math.round(total / 1024) }), words };
})();
