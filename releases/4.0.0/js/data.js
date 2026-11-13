/* PatOS Data (4.0): how the things in PatOS connect. Search finds a thing; Data knows what goes with it.

   What it reads (only these, only when it's asked, and never what you exclude):
     files (their name, folder, date, and the first 2 KB of text files) · notes · calendar events · reminders · captures ·
     World boards
   How it connects them (fixed rules, no AI, and every link says why):
     - the same tag (#biology) · the same distinctive words in their titles (a word that's everywhere counts for little,
       a rare one for a lot) · a note or file that names another file · the same folder · the same day
     - links you make yourself (strongest) · links you removed (never shown again)
   Collections (projects): a name, some words, things you add by hand and things you take out. Everything that matches the
   words, plus what you added, minus what you took out. Data also suggests collections for words that tie together several
   kinds of things.
   Your control (Settings live in the Data app): turn it off, leave out kinds or folders, mark a thing private (never read),
   remove a wrong link, add a right one, rebuild. The index lives only in memory; what is saved is your choices
   (collections, links, exclusions), and they sync like your other data. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const K = { cols: 'dataCollections', links: 'dataLinks', unlinks: 'dataUnlinks', prefs: 'dataPrefs' };
  const prefs = () => Object.assign({ on: true, kinds: ['file', 'note', 'event', 'reminder', 'capture', 'world'], paths: [], private: [] }, PatOS.store.get(K.prefs, {}) || {});
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set(('the and for with that this from your you are was were have has had not but all any can our out who what when where why how into onto about over under then than them they their there here just also more most some such only very will would could should text file files note notes new untitled copy document documents image images photo photos download downloads desktop pictures music video videos ' +
    'les des une pour avec dans sur par est sont pas plus que qui quoi mais ou donc car nous vous ils elles leur leurs ces cet cette son ses mes tes nos vos aux fichier fichiers nouveau nouvelle sans titre').split(' '));
  const stem = (w) => (w.length > 5 ? w.replace(/(ations?|ements?|ings?|iques?|ies|es|s)$/, '') : w.length > 3 ? w.replace(/s$/, '') : w);
  const words = (s) => (fold(s).match(/[a-z0-9][a-z0-9-]{2,}/g) || []).filter((w) => !STOP.has(w) && !/^\d+$/.test(w)).map(stem);
  const tagsOf = (s) => (fold(s).match(/#[a-z0-9][a-z0-9_-]{1,30}/g) || []).map((t) => t.slice(1));
  const dayOf = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '');

  /* ---------- the index (in memory, rebuilt when it's old and something changed) ---------- */
  let idx = null, stale = true, built = 0;
  ['fs', 'notes', 'calendar', 'reminders', 'capture', 'world', 'setting'].forEach((ev) => PatOS.on(ev, () => { stale = true; }));
  const priv = () => new Set(prefs().private);
  function collect() {
    const p = prefs(), kinds = new Set(p.kinds), out = [], hidden = priv();
    const add = (e) => { if (hidden.has(e.key)) return; e.tok = new Map(); const bump = (ws, w8) => ws.forEach((x) => e.tok.set(x, (e.tok.get(x) || 0) + w8)); bump(words(e.title), 3); bump(words(e.ctx || ''), 1); e.tags = [...new Set((e.tags || []).concat(tagsOf(e.title + ' ' + (e.ctx || ''))))]; e.tags.forEach((t) => e.tok.set(stem(t), (e.tok.get(stem(t)) || 0) + 3)); out.push(e); };
    if (kinds.has('file')) PatOS.fs.walk('/', (path, n) => {
      if (n.type !== 'file' || /(^|\/)\./.test(path) || path.startsWith('/System') || p.paths.some((x) => path === x || path.startsWith(x.replace(/\/$/, '') + '/'))) return;
      const name = path.split('/').pop(), folder = path.slice(0, path.length - name.length - 1) || '/';
      let ctx = folder.split('/').filter(Boolean).slice(-2).join(' ');
      if (typeof n.content === 'string' && !n.content.startsWith('data:') && /\.(txt|md|csv|json|html?|js|py|pit)$/i.test(name)) ctx += ' ' + n.content.slice(0, 2048);
      add({ key: 'file:' + path, kind: 'file', title: name.replace(/\.[a-z0-9]{1,5}$/i, ''), sub: folder, date: n.modified || n.mtime || n.created || 0, folder, path, ctx, text: typeof n.content === 'string' ? n.content.slice(0, 2048) : '' });
    });
    if (kinds.has('note')) (PatOS.store.get('notes', []) || []).forEach((n) => { if (!n || !n.id) return; const body = String(n.body || '').replace(/<[^>]*>/g, ' '); add({ key: 'note:' + n.id, kind: 'note', title: n.title || body.split('\n')[0].slice(0, 60) || T('New Note'), sub: T('Note'), date: n.updated || n.created || 0, ctx: body.slice(0, 3000), text: body.slice(0, 3000), tags: n.tags || [] }); });
    if (kinds.has('event')) { const cal = PatOS.store.get('calendar', {}) || {}; Object.keys(cal).forEach((day) => (cal[day] || []).forEach((e) => { if (!e) return; add({ key: 'event:' + day + ':' + (e.id || e.title), kind: 'event', title: e.title || '', sub: day + (e.time ? ' ' + e.time : ''), date: new Date(day + 'T' + (e.time || '12:00')).getTime(), ctx: e.notes || '', day }); })); }
    if (kinds.has('reminder')) (PatOS.store.get('reminders', []) || []).forEach((r) => { if (!r || !r.id) return; add({ key: 'reminder:' + r.id, kind: 'reminder', title: r.text || '', sub: r.due || T('Reminder'), date: r.due ? new Date(r.due + 'T' + (r.time || '12:00')).getTime() : r.created || 0, ctx: r.notes || '', done: !!r.done }); });
    if (kinds.has('capture') && PatOS.capture) PatOS.capture.list({}).forEach((c) => add({ key: 'capture:' + c.id, kind: 'capture', title: c.title || '', sub: T('Capture'), date: c.t || 0, ctx: (c.obj && (c.obj.text || c.obj.url)) || '', tags: c.tags || [] }));
    if (kinds.has('world') && PatOS.world) PatOS.world.list().forEach((w) => add({ key: 'world:' + w.id, kind: 'world', title: w.name, sub: 'World', date: w.updated || 0, ctx: '' }));
    return out;
  }
  function build(force) {
    if (!prefs().on) { idx = { list: [], by: new Map(), df: new Map(), n: 0 }; return idx; }
    if (idx && !force && (!stale || Date.now() - built < 3000)) return idx;
    const list = collect(), by = new Map(list.map((e) => [e.key, e])), df = new Map();
    list.forEach((e) => e.tok.forEach((v, w) => df.set(w, (df.get(w) || 0) + 1)));
    // references: a text that names a file (by its full name with extension)
    const files = list.filter((e) => e.kind === 'file'); const nameMap = new Map(); files.forEach((f) => { const nm = fold(f.path.split('/').pop()); if (nm.length >= 5) nameMap.set(nm, f.key); });
    list.forEach((e) => { e.refs = new Set(); const t = fold(e.text || ''); if (t) nameMap.forEach((k, nm) => { if (k !== e.key && t.includes(nm)) e.refs.add(k); }); });
    idx = { list, by, df, n: list.length || 1 }; stale = false; built = Date.now(); return idx;
  }
  const idf = (w) => Math.log(1 + idx.n / (idx.df.get(w) || 1));
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const links = () => new Set(PatOS.store.get(K.links, []) || []), unlinks = () => new Set(PatOS.store.get(K.unlinks, []) || []);

  /* how strongly two things go together, and why */
  function score(a, b, L, U) {
    if (a.key === b.key) return null; const pk = pairKey(a.key, b.key);
    if (U.has(pk)) return null;
    let s = 0; const why = [];
    if (L.has(pk)) { s += 10; why.push(T('linked by you')); }
    const shared = a.tags.filter((t) => b.tags.includes(t)); if (shared.length) { s += 5 * shared.length; why.push(shared.map((t) => '#' + t).join(' ')); }
    if (a.refs.has(b.key) || b.refs.has(a.key)) { s += 6; why.push(T('one names the other')); }
    let tw = 0; const common = []; a.tok.forEach((va, w) => { const vb = b.tok.get(w); if (vb) { const c = Math.min(va, vb) * idf(w); tw += c; if (c > 1.2) common.push(w); } });
    if (tw > 2.2) { s += Math.min(8, tw / 2); why.push(T('both mention') + ' “' + common.slice(0, 3).join('”, “') + '”'); }
    if (a.folder && a.folder === b.folder && a.folder !== '/' && a.folder !== '/Downloads' && a.folder !== '/Desktop') { s += 1.5; why.push(T('same folder')); }
    if (s > 0 && a.date && b.date && dayOf(a.date) === dayOf(b.date)) { s += 1; why.push(T('same day')); }
    return s >= 2.5 ? { s, why } : null;
  }

  /* ---------- the public side ---------- */
  function related(key, n) {
    build(); const a = idx.by.get(key); if (!a) return [];
    const L = links(), U = unlinks(), out = [];
    idx.list.forEach((b) => { const r = score(a, b, L, U); if (r) out.push({ key: b.key, kind: b.kind, title: b.title, sub: b.sub, score: Math.round(r.s * 10) / 10, why: r.why }); });
    return out.sort((x, y) => y.score - x.score).slice(0, n || 12);
  }
  // everything about a few words: the things whose words match, best first (Pat, Spotlight, collections)
  function search(q, n) {
    build(); const ws = words(q), tg = tagsOf(q); if (!ws.length && !tg.length) return [];
    const out = [];
    idx.list.forEach((e) => { let s = 0; ws.forEach((w) => { const v = e.tok.get(w) || [...e.tok.keys()].some((x) => x.length > 4 && x.startsWith(w)) && 1; if (v) s += v * idf(w); }); tg.forEach((t) => { if (e.tags.includes(t)) s += 6; }); if (s > 0) out.push({ key: e.key, kind: e.kind, title: e.title, sub: e.sub, date: e.date, score: Math.round(s * 10) / 10 }); });
    return out.sort((a, b) => b.score - a.score).slice(0, n || 40);
  }
  const cols = () => (PatOS.store.get(K.cols, []) || []).filter((c) => c && c.id);
  const saveCols = (l) => { PatOS.store.set(K.cols, l); PatOS.emit('data'); };
  function members(c) {
    build(); const ex = new Set(c.excluded || []), seen = new Map();
    (c.keywords || []).forEach((kw) => search(kw, 200).forEach((r) => { if (r.score >= 2 && !ex.has(r.key)) seen.set(r.key, Math.max(seen.get(r.key) || 0, r.score)); }));
    (c.manual || []).forEach((k) => { if (!ex.has(k) && idx.by.has(k)) seen.set(k, 99); });
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => { const e = idx.by.get(k); return { key: k, kind: e.kind, title: e.title, sub: e.sub, date: e.date, manual: (c.manual || []).includes(k) }; });
  }
  const api = {
    build: () => { build(true); return idx.list.length; }, size: () => (build(), idx.list.length),
    item: (key) => { build(); const e = idx.by.get(key); return e ? { key: e.key, kind: e.kind, title: e.title, sub: e.sub, date: e.date, tags: e.tags.slice() } : null; },
    related, search,
    explain(a, b) { build(); const x = idx.by.get(a), y = idx.by.get(b); if (!x || !y) return null; const r = score(x, y, links(), unlinks()); return r ? r.why : []; },
    link(a, b) { const l = links(); l.add(pairKey(a, b)); PatOS.store.set(K.links, [...l]); const u = unlinks(); u.delete(pairKey(a, b)); PatOS.store.set(K.unlinks, [...u]); PatOS.emit('data'); },
    unlink(a, b) { const u = unlinks(); u.add(pairKey(a, b)); PatOS.store.set(K.unlinks, [...u]); const l = links(); l.delete(pairKey(a, b)); PatOS.store.set(K.links, [...l]); PatOS.emit('data'); },
    // collections
    collections: () => cols().map((c) => ({ id: c.id, name: c.name, keywords: c.keywords || [], count: members(c).length })),
    collection(id) { const c = cols().find((x) => x.id === id); return c ? { id: c.id, name: c.name, keywords: c.keywords || [], items: members(c) } : null; },
    createCollection(name, keywords) { const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60); if (!n) throw new Error(T('A collection needs a name.')); const c = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: n, keywords: (keywords && keywords.length ? keywords : [n]).map((k) => String(k).trim().slice(0, 40)).filter(Boolean).slice(0, 10), manual: [], excluded: [], created: Date.now() }; saveCols(cols().concat(c)); return c.id; },
    updateCollection(id, patch) { const l = cols(); const c = l.find((x) => x.id === id); if (!c) return false; if (patch.name) c.name = String(patch.name).slice(0, 60); if (Array.isArray(patch.keywords)) c.keywords = patch.keywords.map((k) => String(k).trim().slice(0, 40)).filter(Boolean).slice(0, 10); saveCols(l); return true; },
    addTo(id, key) { const l = cols(); const c = l.find((x) => x.id === id); if (!c) return false; c.manual = [...new Set((c.manual || []).concat(key))]; c.excluded = (c.excluded || []).filter((k) => k !== key); saveCols(l); return true; },
    removeFrom(id, key) { const l = cols(); const c = l.find((x) => x.id === id); if (!c) return false; c.manual = (c.manual || []).filter((k) => k !== key); c.excluded = [...new Set((c.excluded || []).concat(key))]; saveCols(l); return true; },
    deleteCollection(id) { saveCols(cols().filter((c) => c.id !== id)); },
    // words that tie several kinds of things together, not yet a collection
    suggestions() {
      build(); const have = new Set(cols().flatMap((c) => (c.keywords || []).map((k) => stem(fold(k))))); const byWord = new Map();
      idx.list.forEach((e) => e.tok.forEach((v, w) => { if (v < 3 || w.length < 4) return; if (!byWord.has(w)) byWord.set(w, new Set()); byWord.get(w).add(e); }));
      const out = []; byWord.forEach((set, w) => { const kinds = new Set([...set].map((e) => e.kind)); if (set.size >= 3 && kinds.size >= 2 && set.size <= idx.n * 0.4 && !have.has(w)) out.push({ word: w, count: set.size, kinds: [...kinds] }); });
      return out.sort((a, b) => b.kinds.length - a.kinds.length || b.count - a.count).slice(0, 8);
    },
    // a project's history: its things by date (newest first)
    history(id) { const c = api.collection(id); return c ? c.items.filter((i) => i.date).sort((a, b) => b.date - a.date).map((i) => ({ key: i.key, kind: i.kind, title: i.title, date: i.date })) : []; },
    openItem(it) {
      const key = typeof it === 'string' ? it : it.key; const [kind, ...rest] = key.split(':'); const id = rest.join(':');
      if (kind === 'file') { if (PatOS.fs.exists(id)) PatOS.openFile(id); }
      else if (kind === 'note') PatOS.launch('notes', { id }); else if (kind === 'event') PatOS.launch('calendar', { day: id.split(':')[0] }); else if (kind === 'reminder') PatOS.launch('reminders');
      else if (kind === 'capture') PatOS.launch('capture'); else if (kind === 'world') PatOS.launch('world', { id });
    },
    // your control
    prefs, setPrefs(p) { PatOS.store.set(K.prefs, Object.assign(prefs(), p)); stale = true; PatOS.emit('data'); },
    setPrivate(key, on) { const p = prefs(); const s = new Set(p.private); if (on) s.add(key); else s.delete(key); api.setPrefs({ private: [...s] }); },
    KINDS: ['file', 'note', 'event', 'reminder', 'capture', 'world'], words
  };
  PatOS.data = api;
})();
