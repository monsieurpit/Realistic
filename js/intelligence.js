/* PatOS Intelligence: the system's own command layer. NOT an AI and no language model: every capability is an ACTION written
   here (or declared by an app), with explicit words that call it. It is predictable (the same words always do the same
   thing), transparent (every action says what it did, or why it didn't), fast, testable and works offline.

   - The registry: PatOS.intel.action({ id, owner, title, description, params, permission, confirm, undo, online, mobile, apps,
     priority, match, run }). Pat, Spotlight, Shortcuts and apps all go through it, so a capability exists once.
   - The engine: text → the best matching action (each action recognizes its own words, in English and French) → its
     parameters are checked → permission is checked → it asks first when it changes something big → it runs → a clear
     message (and an undo, where it makes sense). PatOS.intel.respond(text), .parse(text) (no side effects), .execute(id, params).
   - Workspaces: several actions in one request ("start my study workspace"), each checked and reported separately.
   - Permissions: Settings › Pat & Intelligence can turn off whole kinds of action (files, settings, calendar...). Apps (.patapp)
     can offer their own actions and run a few safe system ones, never more (see docs/INTELLIGENCE.md).
   The words each action understands are in its match(); docs/INTELLIGENCE.md lists them. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  const FR = () => PatOS.lang === 'fr';
  const L = (en, fr) => (FR() ? fr : en);
  const fold = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"');
  const appName = (id) => (PatOS.apps[id] ? T(PatOS.apps[id].name) : id);
  const today = () => PatOS.dateKey(new Date());
  const dayWords = (key) => { if (!key) return ''; const t = today(); const d = new Date(key + 'T12:00'); const tm = new Date(); tm.setDate(tm.getDate() + 1);
    return key === t ? L('today', 'aujourd’hui') : key === PatOS.dateKey(tm) ? L('tomorrow', 'demain') : d.toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' }); };
  const fmtTime = (hm) => { const [a, b] = hm.split(':').map(Number); const d = new Date(); d.setHours(a, b, 0, 0); return d.toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }); };

  /* ---------- kinds of action, which Settings › Pat & Intelligence can turn off ---------- */
  const PERMS = {
    apps: ['Open and close apps', 'Ouvrir et fermer des apps'],
    files: ['Find and open your files', 'Trouver et ouvrir vos fichiers'],
    'files.write': ['Create folders and files', 'Créer des dossiers et des fichiers'],
    settings: ['Change settings', 'Changer les réglages'],
    calendar: ['See and add calendar events', 'Voir et ajouter des événements'],
    reminders: ['See and add reminders', 'Voir et ajouter des rappels'],
    notes: ['See and add notes', 'Voir et ajouter des notes'],
    shortcuts: ['Run and create shortcuts', 'Lancer et créer des raccourcis'],
    system: ['Focus, lock and other system controls', 'Concentration, verrouillage et autres contrôles']
  };
  const userPerms = () => PatOS.settings.intelPerms || {};
  const allowedKind = (k) => !k || userPerms()[k] !== false;

  /* ---------- the registry ---------- */
  const actions = new Map();
  const ID = /^[a-z][a-z0-9_.:-]{1,60}$/;
  const TYPES = ['string', 'number', 'boolean', 'app', 'date', 'path', 'enum', 'any'];
  function action(def) {
    if (!def || !ID.test(def.id || '') || typeof def.run !== 'function') throw new Error('An action needs an id (a-z, 0-9, . _ : -) and run()');
    if (def.permission && !PERMS[def.permission]) throw new Error('Unknown permission: ' + def.permission);
    const old = actions.get(def.id); if (old && old.owner !== (def.owner || 'system')) throw new Error('Another owner already has the action ' + def.id);
    Object.keys(def.params || {}).forEach((k) => { if (!TYPES.includes(def.params[k].type)) throw new Error('Unknown parameter type for ' + k); });
    const a = Object.freeze(Object.assign({ owner: 'system', title: def.id, description: '', params: {}, permission: null, confirm: false, undo: false, online: false, mobile: true, apps: false, priority: 30, examples: [] }, def));
    actions.set(a.id, a); return a;
  }
  const list = (filter) => [...actions.values()].filter((a) => !filter || Object.keys(filter).every((k) => a[k] === filter[k]))
    .map((a) => ({ id: a.id, owner: a.owner, title: a.title, description: a.description, params: a.params, permission: a.permission, confirm: !!a.confirm, undo: !!a.undo, online: !!a.online, mobile: a.mobile !== false, apps: !!a.apps, examples: a.examples.slice() }));

  /* ---------- parameters: checked before anything runs ---------- */
  function validate(a, p) {
    p = p || {};
    for (const [k, s] of Object.entries(a.params || {})) {
      const v = p[k];
      if (v == null || v === '') { if (s.required) return L('Something is missing: ', 'Il manque : ') + (s.label || k) + '.'; continue; }
      if ((s.type === 'string' || s.type === 'path') && (typeof v !== 'string' || v.length > (s.max || 500))) return L('That is not a valid ', 'Ce n’est pas un ') + (s.label || k) + '.';
      if (s.type === 'path' && (!v.startsWith('/') || v.split('/').some((x) => x === '..'))) return L('That is not a valid place.', 'Ce n’est pas un emplacement valide.');
      if (s.type === 'number' && (typeof v !== 'number' || !Number.isFinite(v) || (s.min != null && v < s.min) || (s.max != null && v > s.max))) return (s.label || k) + L(' must be between ', ' doit être entre ') + s.min + L(' and ', ' et ') + s.max + '.';
      if (s.type === 'boolean' && typeof v !== 'boolean') return L('That is not a yes or no.', 'Ce n’est pas un oui ou un non.');
      if (s.type === 'app' && !PatOS.apps[v]) return L('That app is not here.', 'Cette app n’est pas ici.');
      if (s.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return L('That is not a date.', 'Ce n’est pas une date.');
      if (s.type === 'enum' && !(s.values || []).includes(v)) return L('That is not one of the choices.', 'Ce n’est pas un des choix.');
    }
    return null;
  }

  /* ---------- context, only when an action asks for it ---------- */
  function context(keys) {
    const out = {}; const want = (k) => !keys || keys.includes(k);
    if (want('activeApp')) { const w = PatOS.wm && PatOS.wm.active; out.activeApp = w && w.app ? w.app.id : null; }
    if (want('openApps')) out.openApps = PatOS.wm ? [...new Set(PatOS.wm.windows.map((w) => w.app.id))] : [];
    if (want('recentFiles')) out.recentFiles = recentFiles(5);
    if (want('recentApps')) out.recentApps = recentApps(5);
    if (want('online')) out.online = navigator.onLine !== false;
    if (want('device')) out.device = PatOS.isMobile ? 'phone' : 'computer';
    if (want('focus')) out.focus = !!PatOS.focusMode;
    return out;
  }
  function recentFiles(n) {
    const seen = new Set(), out = [];
    if (PatOS.timeline) PatOS.timeline.events().slice().reverse().forEach((e) => { const p = e.ref && e.ref.path; if (e.k === 'file' && p && !seen.has(p) && PatOS.fs.exists(p)) { seen.add(p); out.push(p); } });
    if (out.length < n) { const all = []; PatOS.fs.walk('/', (p, nd) => { if (nd.type === 'file' && !/^\/(\.Trash|System)(\/|$)/.test(p) && !seen.has(p) && /^\/(Documents|Desktop|Downloads)\//.test(p)) all.push([p, nd.mtime || 0]); });
      all.sort((a, b) => b[1] - a[1]).forEach(([p]) => out.push(p)); }
    return out.slice(0, n);
  }
  function recentApps(n) {
    const out = []; const add = (id) => { if (id && PatOS.apps[id] && !PatOS.apps[id].hidden && !out.includes(id)) out.push(id); };
    if (PatOS.timeline) PatOS.timeline.events().slice().reverse().forEach((e) => { if (e.k === 'app' && e.ref) add(e.ref.app); });
    if (PatOS.wm) PatOS.wm.windows.slice().reverse().forEach((w) => add(w.app.id));
    return out.slice(0, n);
  }

  /* ---------- finding things in what was said ---------- */
  const appNames = (k) => [fold(PatOS.apps[k].name), fold(T(PatOS.apps[k].name))];
  function findApp(q) {
    q = fold(q).replace(/[.!?]$/, '').replace(/^(the|my|le|la|les|l'|mon|ma|mes)\s*/, '').replace(/\s+(app|application|appli)$/, '').trim(); if (!q) return null;
    const ids = PatOS.appOrder.filter((k) => PatOS.apps[k] && !PatOS.apps[k].hidden);
    return ids.find((k) => appNames(k).includes(q) || k === q) || ids.find((k) => appNames(k).some((n) => n.startsWith(q) && q.length >= 3)) || null;
  }
  function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
  function nearApp(q) {
    q = fold(q).trim(); let best = null, bd = 3;
    PatOS.appOrder.filter((k) => PatOS.apps[k] && !PatOS.apps[k].hidden).forEach((k) => appNames(k).forEach((n) => { const d = lev(q, n); if (d < bd && d <= Math.max(1, Math.floor(n.length / 3))) { bd = d; best = k; } }));
    return best;
  }
  const dateOf = (text) => (PatOS.parseReminder ? PatOS.parseReminder(text, null) : { text });
  /* matches without caring about accents or capitals, but gives back the words as they were typed ("crée un dossier Été") */
  function mt(re, raw) {
    const plain = String(raw).normalize('NFC'); const bare = plain.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (bare.length !== plain.length) { const x = new RegExp(re.source, re.flags.includes('i') ? re.flags : re.flags + 'i').exec(plain); if (x) return x; }
    const r = new RegExp(re.source, (re.flags.includes('i') ? re.flags : re.flags + 'i').replace('d', '') + 'd').exec(bare);
    if (!r) return null; return r.map((g, i) => (g == null ? g : plain.slice(r.indices[i][0], r.indices[i][1])));
  }
  const E = { fold, findApp, nearApp, dateOf, lev, m: mt };

  /* ---------- understanding: which action, with what ---------- */
  // polite words around a command don't change it
  function prep(text) {
    let t = String(text || '').trim().replace(/\s+/g, ' '), was;
    do { was = t; t = t.replace(/^(?:hey|hi|ok|okay|salut|dis)\s+pat[,!.\s]*/i, '').replace(/^(?:please|pls|plz|can you|could you|would you|will you|i want you to|i'?d like you to|i want to|i'd like to|peux-tu|pourrais-tu|tu peux|veux-tu|svp|s'il te pla[iî]t)[\s,]+/i, '');
    } while (t !== was);
    t = t.replace(/[\s,]*(?:please|pls|plz|for me|thanks|thank you|svp|stp|s'il te pla[iî]t|s'il vous pla[iî]t|merci)[.!?\s]*$/i, '').replace(/[.!?]+$/, '').trim();
    return t;
  }
  function parse(text) {
    const raw = prep(text); if (!raw) return null; const t = fold(raw);
    const sorted = [...actions.values()].filter((a) => a.match).sort((a, b) => b.priority - a.priority);
    for (const a of sorted) {
      let p = null; try { p = a.match(t, raw, E); } catch (e) { p = null; }
      if (p) return { action: a, id: a.id, params: p === true ? {} : p, text: raw };
    }
    return null;
  }

  /* ---------- doing it ---------- */
  const history = []; const undos = []; const HISTORY_KEY = 'intelHistory';
  try { (PatOS.store.get(HISTORY_KEY, []) || []).forEach((x) => history.push(x)); } catch (e) {}
  const remember = (a, r, source) => {
    history.push({ t: Date.now(), id: a.id, title: a.title, owner: a.owner, ok: r.ok, status: r.status, source: String(source || 'user').slice(0, 40), message: String(r.message || '').slice(0, 140) });
    if (history.length > 50) history.splice(0, history.length - 50);
    PatOS.store.set(HISTORY_KEY, history.slice()); PatOS.emit('intel', { id: a.id, ok: r.ok });
  };
  const result = (ok, message, extra) => Object.assign({ ok, status: ok ? 'done' : 'failed', message: String(message || '') }, extra || {});
  // what a run() gave back → a result
  function finish(a, r, source) {
    if (r && typeof r === 'object' && typeof r.confirm === 'function' && r.text != null) { // (a Pat skill that asks first)
      const c = r.confirm; return { ok: null, status: 'confirm', message: String(r.text), confirm: () => { const x = finish(a, c(), source); return x && x.then ? x : x; } };
    }
    const res = r == null ? result(true, L('Done.', 'C’est fait.')) : typeof r === 'string' ? result(true, r) : result(r.ok !== false, r.message, { data: r.data });
    if (r && typeof r === 'object' && typeof r.undo === 'function' && res.ok) { undos.push({ t: Date.now(), id: a.id, title: a.title, undo: r.undo }); if (undos.length > 10) undos.shift(); res.canUndo = true; }
    remember(a, res, source); return res;
  }
  const fail = (a, msg, source, status) => { const r = result(false, msg, { status: status || 'failed' }); if (a) remember(a, r, source); return r; };
  /* runs an action. Synchronous when the action is (Pat answers at once); a Promise otherwise. */
  function execute(id, params, opts) {
    opts = opts || {}; const source = opts.source || 'user'; const a = actions.get(id);
    if (!a) return fail(null, L('PatOS doesn’t know that action.', 'PatOS ne connaît pas cette action.'));
    if (String(source).startsWith('app:') && !a.apps) return fail(a, L('Apps can’t use this action.', 'Les apps ne peuvent pas utiliser cette action.'), source, 'denied');
    if (!allowedKind(a.permission)) return fail(a, L('I couldn’t do that: ', 'Je n’ai pas pu : ') + L(PERMS[a.permission][0], PERMS[a.permission][1]).toLowerCase() + L(' is turned off in Settings › Pat & Intelligence.', ' est désactivé dans Réglages › Pat et Intelligence.'), source, 'denied');
    if (a.online && navigator.onLine === false) return fail(a, L('That needs the internet, and you’re offline.', 'Il faut Internet, et vous êtes hors ligne.'), source, 'unavailable');
    if (a.mobile === false && PatOS.isMobile) return fail(a, L('That isn’t available on a phone.', 'Ce n’est pas disponible sur un téléphone.'), source, 'unavailable');
    const bad = validate(a, params); if (bad) return fail(a, bad, source, 'invalid');
    const ask = typeof a.confirm === 'function' ? a.confirm(params || {}) : a.confirm;
    if (ask && !opts.confirmed) return { ok: null, status: 'confirm', message: typeof ask === 'string' ? ask : L('Are you sure? ', 'Êtes-vous sûr? ') + a.title + '?', confirm: () => execute(id, params, Object.assign({}, opts, { confirmed: true })) };
    let r; try { r = a.run(Object.assign({}, params), { source, context }); }
    catch (e) { PatOS.errors && PatOS.errors.report(e, 'intelligence ' + a.id, { category: 'intelligence', severity: 'warning' }); return fail(a, L('That didn’t work: ', 'Ça n’a pas marché : ') + (e.message || e), source); }
    if (r && typeof r.then === 'function') return r.then((x) => finish(a, x, source), (e) => fail(a, L('That didn’t work: ', 'Ça n’a pas marché : ') + (e && e.message || e), source));
    return finish(a, r, source);
  }
  /* text → the result (or null when nothing matched) */
  function respond(text, opts) { const p = parse(text); if (!p) return null; return execute(p.id, p.params, opts); }
  function undo() {
    const u = undos.pop(); if (!u || Date.now() - u.t > 30 * 60 * 1000) return result(false, L('There is nothing to undo.', 'Il n’y a rien à annuler.'));
    try { const m = u.undo(); return result(true, m || L('Undone: ', 'Annulé : ') + T(u.title) + '.'); } catch (e) { return result(false, L('That couldn’t be undone: ', 'Impossible d’annuler : ') + e.message); }
  }

  /* ================= the actions ================= */
  const W = (re) => (t) => (re.test(t) ? {} : null);

  // ---- apps ----
  action({ id: 'app.open', title: 'Open an app', description: 'Opens an app by its name.', permission: 'apps', params: { app: { type: 'app', required: true, label: 'App' } }, apps: true, priority: 40,
    examples: ['open calendar', 'launch the calculator', 'ouvre notes'],
    match: (t) => { const m = /^(?:open|launch|start|show|run|go to|ouvre|ouvrir|lance|lancer|demarre|affiche)\s+(?:the\s+|my\s+|le\s+|la\s+|l'|les\s+|mon\s+|ma\s+)?(?:app\s+|application\s+|appli\s+)?(.+)$/.exec(t); if (!m) return null; const id = findApp(m[1]); return id ? { app: id } : null; },
    run: ({ app }) => { const w = PatOS.launch(app); if (!w && !(PatOS.apps[app] && PatOS.apps[app].action)) return { ok: false, message: L(appName(app) + ' didn’t open.', appName(app) + ' ne s’est pas ouvert.') }; return { ok: true, message: L('Sure, opening ' + appName(app) + '.', 'D’accord, j’ouvre ' + appName(app) + '.'), undo: () => { PatOS.wm.windowsOf(app).forEach((x) => x.close()); return L(appName(app) + ' closed.', appName(app) + ' fermé.'); } }; } });
  // "open calcluator": not an app, but close to one
  action({ id: 'app.suggest', title: 'Suggest an app name', permission: null, priority: 5,
    match: (t) => { const m = /^(?:open|launch|start|ouvre|lance)\s+(.+)$/.exec(t); if (!m || findApp(m[1]) || /\b(file|fichier|document|folder|dossier)\b/.test(m[1])) return null; return { q: m[1] }; },
    run: ({ q }) => { const near = nearApp(q); return { ok: false, message: near ? L(`I don’t have an app called "${q}". Did you mean ${appName(near)}? Say "open ${fold(appName(near))}".`, `Je n’ai pas d’app appelée « ${q} ». Voulais-tu dire ${appName(near)}? Dis « ouvre ${fold(appName(near))} ».`) : L(`Hmm, I don’t have an app called "${q}". Say "list apps" and I’ll show you what’s there.`, `Hmm, je n’ai pas d’app appelée « ${q} ». Écris « liste des apps » et je te montre ce qu’il y a.`) }; } });
  action({ id: 'app.close', title: 'Close an app', permission: 'apps', params: { app: { type: 'app', required: true } }, priority: 40, examples: ['close music', 'quit the calculator'],
    match: (t) => { const m = /^(?:close|quit|exit|ferme|fermer|quitte)\s+(?:the\s+|my\s+|le\s+|la\s+|l')?(.+)$/.exec(t); if (!m) return null; const id = findApp(m[1]); return id ? { app: id } : null; },
    run: ({ app }) => { const ws = PatOS.wm.windowsOf(app); if (!ws.length) return { ok: false, message: L(appName(app) + ' isn’t open.', appName(app) + ' n’est pas ouvert.') }; ws.forEach((w) => w.close()); return { message: L(appName(app) + ' closed.', appName(app) + ' fermé.'), undo: () => { PatOS.launch(app); return L(appName(app) + ' opened again.', appName(app) + ' rouvert.'); } }; } });
  action({ id: 'app.recent', title: 'Open the app you used last', permission: 'apps', priority: 45, examples: ['open my most recently used app', 'open the last app'],
    match: W(/^(?:open|reopen|go back to|ouvre|rouvre)\s+(?:my\s+|the\s+|la\s+|ma\s+|mon\s+)?(?:most\s+)?(?:recent(?:ly used)?|last|previous|derniere|dernier)\s+(?:used\s+)?(?:app|application|appli)(?:\s+(?:i used|utilisee))?$/),
    run: (_, c) => { const cur = c.context(['activeApp']).activeApp; const id = recentApps(6).find((x) => x !== cur); if (!id) return { ok: false, message: L('I don’t know which app you used last yet.', 'Je ne sais pas encore quelle app tu as utilisée en dernier.') }; PatOS.launch(id); return L(appName(id) + ' opened (the app you used last).', appName(id) + ' ouvert (la dernière app utilisée).'); } });
  action({ id: 'app.list', title: 'List the apps', permission: null, priority: 40, match: W(/^(?:list (?:all )?(?:the )?apps|what apps(?: do i have)?|which apps|liste des apps|quelles apps)/),
    run: () => L('Here’s everything you’ve got: ', 'Voici tout ce que tu as : ') + PatOS.appOrder.filter((k) => PatOS.apps[k] && !PatOS.apps[k].hidden).map(appName).join(', ') + '.' });

  // ---- files and folders ----
  action({ id: 'files.latest', title: 'Open your latest document', permission: 'files', priority: 46, examples: ['open my latest document', 'open the last file'],
    match: W(/^(?:open|reopen|show|ouvre|rouvre)\s+(?:my\s+|the\s+|mon\s+|le\s+)?(?:latest|last|most recent|newest|recent|dernier|plus recent)\s+(?:document|doc|file|fichier)s?$/),
    run: () => { const p = recentFiles(1)[0]; if (!p) return { ok: false, message: L('You don’t have a recent document yet.', 'Tu n’as pas encore de document récent.') }; PatOS.openFile(p); return { message: L('Opened ', 'Ouvert : ') + PatOS.fs.basename(p) + '.', data: { path: p } }; } });
  function searchFiles(q, inside) {
    const fq = fold(q), out = []; let n = 0;
    PatOS.fs.walk('/', (p, nd) => {
      if (out.length >= 50 || nd.type !== 'file' || /^\/(\.Trash|System)(\/|$)/.test(p)) return;
      if (fold(PatOS.fs.basename(p)).includes(fq)) { out.push(p); return; }
      if (inside && typeof nd.content === 'string' && !nd.blob && n++ < 3000 && nd.content.length < 2e6 && fold(nd.content.replace(/<[^>]+>/g, ' ')).includes(fq)) out.push(p);
    });
    return out;
  }
  action({ id: 'files.find', title: 'Find files', description: 'Finds files by name, or by what is in them.', permission: 'files', params: { q: { type: 'string', required: true, max: 100 }, inside: { type: 'boolean' } }, apps: false, priority: 38,
    examples: ['find files containing PatOS', 'find file essay', 'trouve les fichiers contenant PatOS'],
    match: (t, raw) => {
      let m = mt(/^(?:find|search(?: for)?|look for|show|trouve|cherche|montre)\s+(?:all\s+|my\s+|the\s+|les\s+|mes\s+|tous les\s+)?(?:files?|documents?|docs?|fichiers?)\s+(?:that\s+)?(?:containing|contain|with|mentioning|that mention|qui contiennent|contenant|avec|qui mentionnent)\s+(.+)$/i, raw);
      if (m) return { q: m[1].replace(/^["']|["']$/g, ''), inside: true };
      m = mt(/^(?:find|search for|look for|trouve|cherche)\s+(?:the\s+|a\s+|le\s+|un\s+)?(?:files?|fichiers?)\s+(?:named|called|nomme|appele)?\s*(.+)$/i, raw);
      return m && !/^(?:about|on|sur|au sujet)\b/i.test(m[1]) ? { q: m[1].replace(/^["']|["']$/g, ''), inside: false } : null;
    },
    run: ({ q, inside }) => {
      const f = searchFiles(q, inside); if (PatOS.pat && PatOS.pat.remember) PatOS.pat.remember('file', f);
      if (!f.length) return { ok: true, message: inside ? L(`No file contains “${q}”.`, `Aucun fichier ne contient « ${q} ».`) : L(`I couldn’t find a file with “${q}” in its name.`, `Je n’ai pas trouvé de fichier avec « ${q} » dans son nom.`), data: { files: [] } };
      return { message: L(`Found ${f.length} file${f.length > 1 ? 's' : ''}:\n`, `${f.length} fichier${f.length > 1 ? 's' : ''} trouvé${f.length > 1 ? 's' : ''} :\n`) + f.slice(0, 6).map((p) => '• ' + p).join('\n') + (f.length > 6 ? '\n… +' + (f.length - 6) : '') + L('\nSay “open it” to open the first one.', '\nDis « ouvre-le » pour ouvrir le premier.'), data: { files: f } };
    } });
  action({ id: 'folder.create', title: 'Create a folder', permission: 'files.write', params: { name: { type: 'string', required: true, max: 100 }, dir: { type: 'path' } }, priority: 42,
    examples: ['create a folder called Projects', 'make a folder named Trips in Desktop', 'crée un dossier appelé Projets'],
    match: (t, raw) => {
      const m = mt(/^(?:create|make|add|new|cree|creer|fais|ajoute)\s+(?:a\s+|an\s+|un\s+)?(?:new\s+|nouveau\s+)?(?:folder|directory|dossier|repertoire)\s+(?:called|named|nomme|appele|qui s'appelle)?\s*["“']?([^"”'/]+?)["”']?(?:\s+(?:in|on|inside|dans|sur)\s+(?:the\s+|my\s+|le\s+|mon\s+)?(\w+))?$/i, raw);
      if (!m) return null;
      const places = { desktop: '/Desktop', bureau: '/Desktop', documents: '/Documents', downloads: '/Downloads', telechargements: '/Downloads', pictures: '/Pictures', images: '/Pictures', music: '/Music', musique: '/Music', videos: '/Videos' };
      const dir = m[2] ? places[fold(m[2])] : '/Documents'; if (m[2] && !dir) return null;
      return { name: m[1].trim(), dir };
    },
    run: ({ name, dir }) => {
      dir = dir || '/Documents'; if (/[\\:*?"<>|]/.test(name) || name === '.' || name === '..') return { ok: false, message: L('A folder name can’t have those characters.', 'Un nom de dossier ne peut pas contenir ces caractères.') };
      const p = dir + '/' + name; if (PatOS.fs.exists(p)) return { ok: false, message: L(`There’s already a “${name}” in ${PatOS.fs.basename(dir)}.`, `Il y a déjà un « ${name} » dans ${PatOS.fs.basename(dir)}.`) };
      PatOS.fs.mkdir(p);
      return { message: L(`Folder “${name}” created in ${T(PatOS.fs.basename(dir))}.`, `Dossier « ${name} » créé dans ${T(PatOS.fs.basename(dir))}.`), data: { path: p },
        undo: () => { if (PatOS.fs.isDir(p) && !PatOS.fs.list(p).length) { PatOS.fs.remove(p, true); return L(`Folder “${name}” removed.`, `Dossier « ${name} » retiré.`); } throw new Error(L('the folder isn’t empty anymore', 'le dossier n’est plus vide')); } };
    } });
  action({ id: 'trash.empty', title: 'Empty the Trash', permission: 'files.write', priority: 40, confirm: () => L('Empty the Trash? The files in it are deleted for good.', 'Vider la corbeille? Les fichiers qu’elle contient seront supprimés pour de bon.'),
    match: W(/^(?:empty|clear)\s+(?:the\s+|my\s+)?(?:trash|bin|recycle bin)$|^vide[rz]?\s+(?:la\s+)?corbeille$/),
    run: () => { const n = PatOS.fs.list('/.Trash').length; PatOS.fs.list('/.Trash').forEach((x) => PatOS.fs.remove('/.Trash/' + x.name, true)); return L(`Trash emptied (${n} item${n === 1 ? '' : 's'}).`, `Corbeille vidée (${n} élément${n > 1 ? 's' : ''}).`); } });

  // ---- reminders ----
  const loadRem = () => PatOS.store.get('reminders', []) || [];
  action({ id: 'reminders.create', title: 'Create a reminder', permission: 'reminders', params: { text: { type: 'string', required: true, max: 300 }, due: { type: 'date' }, time: { type: 'string', max: 5 } }, apps: false, priority: 42,
    examples: ['create a reminder to finish my project tomorrow', 'remind me to call Sam friday at 5pm', 'rappelle-moi de payer le loyer demain'],
    match: (t, raw) => {
      const m = mt(/^(?:(?:create|add|make|set|new|cree|ajoute)\s+(?:a\s+|un\s+)?(?:new\s+)?(?:reminder|rappel)\s*(?:to|for|that|:|pour|de|d')?|remind me\s+(?:to|that|about)|reminder:|add reminder:?|rappelle[- ]moi(?:\s+de|\s+d'|\s+que)?)\s*(.+)$/i, raw);
      if (!m) return null; const p = dateOf(m[1].trim()); return { text: p.text, due: p.due || undefined, time: p.time || undefined };
    },
    run: ({ text, due, time }) => {
      const items = loadRem(); const r = { id: Date.now(), text, done: false }; if (due) r.due = due; if (time) { r.time = time; PatOS.alarms && PatOS.alarms.askPermission && PatOS.alarms.askPermission(); }
      items.push(r); PatOS.store.set('reminders', items); PatOS.emit('reminders');
      const when = due ? ' ' + L('for', 'pour') + ' ' + dayWords(due) + (time ? ' ' + L('at', 'à') + ' ' + fmtTime(time) : '') : '';
      return { message: L(`Reminder created: “${text}”${when}.`, `Rappel créé : « ${text} »${when}.`), data: { id: r.id },
        undo: () => { PatOS.store.set('reminders', loadRem().filter((x) => x.id !== r.id)); PatOS.emit('reminders'); return L('Reminder removed.', 'Rappel retiré.'); } };
    } });
  action({ id: 'reminders.list', title: 'Show your reminders', permission: 'reminders', params: { due: { type: 'date' } }, priority: 41, examples: ['show my reminders for today', 'my reminders for friday', 'what’s due tomorrow'],
    match: (t) => {
      const m = /^(?:(?:show|list|what are|see|check)\s+)?(?:me\s+)?(?:my\s+|the\s+)?(?:reminders|to-?dos?|tasks)(?:\s+(?:for|on|due)\s+(.+))?$|^what(?:'s| is| do i have) due(?:\s+(.+))?$|^what do i (?:need|have) to do(?:\s+(.+))?$|^(?:mes\s+)?rappels(?:\s+(?:pour|de)\s+(.+))?$/.exec(t);
      if (!m) return null; const w = m[1] || m[2] || m[3] || m[4]; if (!w) return {}; const d = dateOf('x ' + w).due; return d ? { due: d } : null;
    },
    run: ({ due }) => {
      const k = today(); const all = loadRem().filter((r) => !r.done);
      const pick = due ? all.filter((r) => r.due === due) : all.filter((r) => r.due && r.due <= k);
      pick.sort((a, b) => ((a.due || '') + (a.time || '')).localeCompare((b.due || '') + (b.time || '')));
      const label = due ? dayWords(due) : L('today or overdue', 'aujourd’hui ou en retard');
      if (!pick.length) return { message: due ? L(`No reminders for ${label}.`, `Aucun rappel pour ${label}.`) : L('You’re all caught up. Nothing is due today.', 'Tu es à jour. Rien n’est dû aujourd’hui.'), data: { items: [] } };
      return { message: (due ? L(`Reminders for ${label}:\n`, `Rappels pour ${label} :\n`) : L('Due today or overdue:\n', 'Dû aujourd’hui ou en retard :\n')) + pick.slice(0, 8).map((r) => '• ' + r.text + (r.time ? ' (' + fmtTime(r.time) + ')' : '') + (!due && r.due < k ? L(' · overdue', ' · en retard') : '')).join('\n'), data: { items: pick.map((r) => r.id) } };
    } });

  // ---- calendar ----
  action({ id: 'calendar.list', title: 'Show your calendar', permission: 'calendar', params: { day: { type: 'date' } }, priority: 41, examples: ['what’s on my calendar today', 'my schedule tomorrow', 'calendar friday'],
    match: (t) => {
      const m = /^(?:what(?:'s| is)?(?: on)?|show(?: me)?|check|see)?\s*(?:my\s+)?(?:calendar|schedule|agenda|events)\s*(?:for\s+|on\s+)?(.*?)\??$|^what do i have\s*(.*?)\??$/.exec(t);
      if (!m) return null; const w = (m[1] || m[2] || '').trim(); if (!w) return { day: today() }; const d = dateOf('x ' + w).due; return d ? { day: d } : null;
    },
    run: ({ day }) => {
      const d = new Date((day || today()) + 'T12:00'); const evs = PatOS.calendarOn ? PatOS.calendarOn(d) : []; const label = dayWords(day || today());
      if (!evs.length) return L(`Nothing on your calendar ${label}.`, `Rien dans ton calendrier ${label}.`);
      return L(`On your calendar ${label}:\n`, `Dans ton calendrier ${label} :\n`) + evs.map((e) => '• ' + (e.time ? fmtTime(e.time) + '  ' : L('All day  ', 'Toute la journée  ')) + e.title).join('\n');
    } });
  action({ id: 'calendar.create', title: 'Add a calendar event', permission: 'calendar', params: { title: { type: 'string', required: true, max: 200 }, day: { type: 'date' }, time: { type: 'string', max: 5 } }, priority: 42, examples: ['add event dentist friday 2pm', 'schedule lunch tomorrow at noon'],
    match: (t, raw) => { const m = mt(/^(?:add (?:an )?event|create (?:an )?event|new event|event|schedule|ajoute un evenement|ajoute un événement|nouvel evenement)\s*:?\s+(.+)$/i, raw); if (!m) return null; const p = dateOf(m[1]); return { title: p.text, day: p.due || undefined, time: p.time || undefined }; },
    run: ({ title, day, time }) => {
      const key = day || today(); const cal = PatOS.store.get('calendar', {}) || {}; const id = PatOS.uid();
      (cal[key] = cal[key] || []).push({ id, title, time: time || '', end: '', color: '#0a84ff', notes: '', repeat: '', alert: time ? '0' : 'none' });
      PatOS.store.set('calendar', cal); PatOS.emit('calendar'); PatOS.calendarSync && PatOS.calendarSync();
      return { message: L(`Added “${title}” to your calendar on ${new Date(key + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' })}${time ? ' at ' + fmtTime(time) : ''}.`, `J’ai ajouté « ${title} » à ton calendrier le ${new Date(key + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' })}${time ? ' à ' + fmtTime(time) : ''}.`),
        undo: () => { const c = PatOS.store.get('calendar', {}) || {}; c[key] = (c[key] || []).filter((e) => e.id !== id); PatOS.store.set('calendar', c); PatOS.emit('calendar'); return L('Event removed.', 'Événement retiré.'); } };
    } });

  // ---- notes ----
  action({ id: 'notes.create', title: 'Take a note', permission: 'notes', params: { text: { type: 'string', required: true, max: 5000 } }, priority: 42, examples: ['note: buy milk', 'take a note call the coach'],
    match: (t, raw) => { const m = mt(/^(?:note:?|take a note:?|write down:?|make a note:?|create a note:?|new note:?|prends une note:?|note que)\s+([\s\S]+)$/i, raw); return m ? { text: m[1].trim() } : null; },
    run: ({ text }) => {
      const notes = PatOS.store.get('notes', []) || []; const id = PatOS.uid(); notes.unshift({ id, title: text.slice(0, 40), body: '<div>' + PatOS.esc(text) + '</div>', mtime: Date.now() }); PatOS.store.set('notes', notes); PatOS.emit('notes');
      return { message: L('Saved. You’ll find it at the top of Notes.', 'C’est enregistré. Tu la trouveras en haut de Notes.'), undo: () => { PatOS.store.set('notes', (PatOS.store.get('notes', []) || []).filter((n) => n.id !== id)); PatOS.emit('notes'); return L('Note removed.', 'Note retirée.'); } };
    } });

  // ---- timers and alarms (PatOS.alarms rings them, even with Clock closed) ----
  action({ id: 'timer.start', title: 'Start a timer', permission: 'system', params: { seconds: { type: 'number', required: true } }, priority: 42, examples: ['timer 10 min', 'set a timer for 1h 20m'],
    match: (t) => { const m = /^(?:set (?:a )?|start (?:a )?)?timer(?: for)?\s+(.+)$/.exec(t); if (!m) return null; const ms = PatOS.parseDuration ? PatOS.parseDuration(m[1]) : 0; return { seconds: ms > 0 ? Math.round(ms / 1000) : -1 }; },
    run: ({ seconds }) => { if (!(seconds > 0 && seconds <= 86400)) return { ok: false, message: L('How long? Try “timer 10 min” or “timer 1h 20m”.', 'Combien de temps? Essaie « minuteur 10 min » ou « minuteur 1h 20m ».') }; PatOS.quickTimer(seconds, ''); const mins = Math.round(seconds / 60); return L(`Timer set for ${mins >= 60 ? Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + mins % 60 + ' min' : '') : mins >= 1 ? mins + ' min' : seconds + ' s'}. It rings even if you close Messages.`, `Minuteur réglé pour ${mins >= 60 ? Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + mins % 60 + ' min' : '') : mins >= 1 ? mins + ' min' : seconds + ' s'}.`); } });
  action({ id: 'alarm.set', title: 'Set an alarm', permission: 'system', params: { time: { type: 'string', required: true, max: 5 } }, priority: 42, examples: ['wake me at 7:30', 'set an alarm for 6am'],
    match: (t) => { const m = /^(?:wake me(?: up)? at|set (?:an )?alarm(?: for| at)?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t); if (!m) return null; let hh = +m[1]; const mm = +(m[2] || 0); if (m[3] === 'pm' && hh < 12) hh += 12; if (m[3] === 'am' && hh === 12) hh = 0; return { time: hh > 23 || mm > 59 ? 'bad' : String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') }; },
    run: ({ time }) => {
      if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, message: L('That isn’t a time I can use. Try “wake me at 7:30”.', 'Ce n’est pas une heure valide. Essaie « réveille-moi à 7h30 ».') };
      const id = PatOS.uid(); const list2 = PatOS.store.get('alarms', []); list2.push({ id, time, label: 'Pat', repeat: 'once', on: true }); PatOS.store.set('alarms', list2); PatOS.emit('alarms'); PatOS.alarms && PatOS.alarms.askPermission && PatOS.alarms.askPermission();
      return { message: L(`Alarm set for ${fmtTime(time)}. It rings once; you can change it in Clock.`, `Alarme réglée à ${fmtTime(time)}. Elle sonne une fois; tu peux la changer dans Horloge.`), undo: () => { PatOS.store.set('alarms', PatOS.store.get('alarms', []).filter((a) => a.id !== id)); PatOS.emit('alarms'); return L('Alarm removed.', 'Alarme retirée.'); } };
    } });

  // ---- settings (the same list Settings search and Spotlight use: PatOS.settingsCatalog) ----
  const CATALOG = PatOS.settingsCatalog; // (js/settings-catalog.js: the same list Settings search and Spotlight use)
  function findSetting(words) { const w = fold(words).replace(/^(?:the|my|le|la|les|mon|ma)\s+/, '').trim(); if (!w) return null; return CATALOG.find((c) => fold(c.label) === w || fold(T(c.label)) === w) || CATALOG.find((c) => (' ' + c.words + ' ').includes(' ' + w + ' ')) || CATALOG.find((c) => w.length > 3 && c.words.includes(w)) || null; }
  function setSetting(key, value) { const old = PatOS.settings[key]; PatOS.setSetting(key, value); return () => { PatOS.setSetting(key, old); return L('Put back the way it was.', 'Remis comme avant.'); }; }
  action({ id: 'settings.theme', title: 'Dark or light mode', permission: 'settings', params: { value: { type: 'enum', values: ['dark', 'light', 'auto'], required: true } }, priority: 44, examples: ['turn on dark mode', 'light mode', 'mode sombre'],
    match: (t) => { if (/\b(dark mode|night mode|mode sombre|mode nuit)\b/.test(t) && !/\b(off|disable|desactive|eteins)\b/.test(t)) return { value: 'dark' }; if (/\b(light mode|mode clair)\b/.test(t) || /\b(dark mode|mode sombre)\b/.test(t)) return { value: 'light' }; if (/\b(automatic|auto) (appearance|mode|theme)\b|\bmode automatique\b/.test(t)) return { value: 'auto' }; return null; },
    run: ({ value }) => ({ message: value === 'dark' ? L('Done, dark mode is on.', 'C’est fait, le mode sombre est activé.') : value === 'light' ? L('Done, light mode is on.', 'C’est fait, le mode clair est activé.') : L('Appearance now follows the time of day.', 'L’apparence suit maintenant l’heure.'), undo: setSetting('theme', value) }) });
  action({ id: 'settings.set', title: 'Change a setting', description: 'Turns a setting on or off, or sets a level (volume, brightness).', permission: 'settings', params: { key: { type: 'string', required: true, max: 40 }, value: { type: 'any', required: true } }, priority: 39,
    examples: ['set the volume to 40%', 'turn on reduce motion', 'disable sound effects', 'monte le volume à 80 %'],
    match: (t) => {
      let m = /^(?:set|change|put|turn|regle|mets|monte|baisse)\s+(?:the\s+|my\s+|le\s+|la\s+)?(volume|sound|son|brightness|luminosite)\s+(?:to|at|a|au)?\s*(\d{1,3})\s*%?$/.exec(t);
      if (m) { const c = findSetting(m[1]); return c ? { key: c.key, value: +m[2] } : null; }
      m = /^(?:(turn on|enable|activate|switch on|active|allume|activer)\s+(.+)|(turn off|disable|deactivate|switch off|desactive|eteins|desactiver)\s+(.+)|(.+?)\s+(on|off))$/.exec(t);
      if (!m) return null; const on = !!(m[1] || (m[6] === 'on')); const c = findSetting(m[2] || m[4] || m[5]); if (!c || c.type !== 'bool') return null; return { key: c.key, value: on };
    },
    run: ({ key, value }) => {
      const c = CATALOG.find((x) => x.key === key); if (!c) return { ok: false, message: L('PatOS doesn’t have that setting.', 'PatOS n’a pas ce réglage.') };
      if (c.type === 'bool') { if (typeof value !== 'boolean') return { ok: false, message: L('That is not a yes or no.', 'Ce n’est pas un oui ou un non.') }; return { message: T(c.label) + ' ' + (value ? L('turned on.', 'activé.') : L('turned off.', 'désactivé.')), undo: setSetting(key, value) }; }
      if (c.type === 'percent') { if (typeof value !== 'number' || value < (c.min || 0) || value > 100) return { ok: false, message: T(c.label) + L(` goes from ${c.min || 0} to 100%.`, ` va de ${c.min || 0} à 100 %.`) }; return { message: T(c.label) + L(' set to ', ' réglé à ') + value + '%.', undo: setSetting(key, value / 100) }; }
      return { ok: false, message: L('Use the Settings app for that one.', 'Utilise l’app Réglages pour celui-là.') };
    } });
  action({ id: 'settings.open', title: 'Open a setting', permission: null, params: { key: { type: 'string', max: 40 }, pane: { type: 'string', max: 40 } }, apps: true, priority: 43, examples: ['open sound settings', 'show the accessibility settings', 'where is reduce motion'],
    match: (t) => { const m = /^(?:open|show|go to|where is|where are|find|ouvre|montre|ou est|ou sont)\s+(?:the\s+|my\s+|les\s+|le\s+|la\s+)?(?:settings? for\s+|reglages? (?:de |du |des |pour )?)?(.+?)\s*(?:settings?|reglages?|preferences)?$/.exec(t); if (!m || !/settings?|reglages?|preferences|where|ou est|ou sont/.test(t)) return null; const c = findSetting(m[1]); if (c) return { key: c.key, pane: c.pane }; const panes = { sound: 'sound', son: 'sound', display: 'display', ecran: 'display', accessibility: 'accessibility', accessibilite: 'accessibility', privacy: 'privacy', confidentialite: 'privacy', storage: 'storage', stockage: 'storage', backup: 'backup', sauvegarde: 'backup', notifications: 'notifications', general: 'general', appearance: 'appearance', apparence: 'appearance', wallpaper: 'wallpaper', 'fond d\'ecran': 'wallpaper', account: 'account', compte: 'account', network: 'network', reseau: 'network', update: 'update', updates: 'update', 'mise a jour': 'update', dock: 'dock', 'pat & intelligence': 'intelligence', intelligence: 'intelligence', pat: 'intelligence', diagnostics: 'diagnostics', health: 'diagnostics' }; const p = panes[fold(m[1]).trim()]; return p ? { pane: p } : null; },
    run: ({ key, pane }) => { PatOS.launch('settings', { pane: pane || 'general', find: key || '' }); const c = key && CATALOG.find((x) => x.key === key); return c ? L('Here’s ', 'Voici ') + T(c.label) + L(' in Settings.', ' dans Réglages.') : L('Settings opened.', 'Réglages ouverts.'); } });

  // ---- focus, lock, notifications ----
  action({ id: 'focus.set', title: 'Do Not Disturb', permission: 'system', params: { on: { type: 'boolean', required: true } }, priority: 44, examples: ['turn on do not disturb', 'focus mode on', 'active ne pas déranger'],
    match: (t) => { if (!/do not disturb|\bdnd\b|focus mode|\bfocus\b|ne pas deranger|concentration/.test(t) || /settings|reglages/.test(t)) return null; return { on: !/\b(off|disable|stop|end|desactive|eteins|arrete)\b/.test(t) }; },
    run: ({ on }) => { const old = !!PatOS.focusMode; PatOS.focusMode = on; PatOS.emit('focus', on); return { message: on ? L('Do Not Disturb is on: notifications stay quiet.', 'Ne pas déranger est activé : les notifications restent silencieuses.') : L('Do Not Disturb is off.', 'Ne pas déranger est désactivé.'), undo: () => { PatOS.focusMode = old; PatOS.emit('focus', old); return L('Put back the way it was.', 'Remis comme avant.'); } }; } });
  action({ id: 'system.lock', title: 'Lock the screen', permission: 'system', priority: 44, match: W(/^(?:lock|lock the screen|lock my computer|lock (?:the )?(?:pc|computer|screen)|verrouille(?: l'ecran)?)$/),
    run: () => { setTimeout(() => PatOS.power && PatOS.power.lock(), 300); return L('Locking the screen.', 'Je verrouille l’écran.'); } });
  action({ id: 'notifications.apps', title: 'Apps with notifications', permission: null, priority: 41, examples: ['show applications that have notifications', 'which apps sent notifications'],
    match: W(/^(?:show|list|which|what)\s+(?:the\s+|me\s+)?(?:apps|applications)\s+(?:that\s+)?(?:have|with|sent|that sent)\s+notifications|^(?:show|list)\s+(?:my\s+)?notifications$|^quelles apps ont des notifications/),
    run: () => {
      const l = PatOS.notifications ? PatOS.notifications.list() : []; if (!l.length) return L('No notifications right now.', 'Aucune notification pour l’instant.');
      const by = {}; l.forEach((n) => { const k = PatOS.apps[n.icon] ? n.icon : 'about'; by[k] = (by[k] || 0) + 1; });
      return L('Apps with notifications:\n', 'Apps avec des notifications :\n') + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => '• ' + (k === 'about' ? 'PatOS' : appName(k)) + ' (' + n + ')').join('\n');
    } });
  action({ id: 'context.now', title: 'What is open right now', permission: null, priority: 41, examples: ['what am I working on', 'what’s open'],
    match: W(/^(?:what am i (?:working on|doing)|what(?:'s| is) open|which apps are open|what apps are open|qu'est-ce qui est ouvert|sur quoi je travaille)$/),
    run: (_, c) => { const x = c.context(['activeApp', 'openApps', 'recentFiles']); if (!x.openApps.length && !x.recentFiles.length) return L('Nothing is open right now.', 'Rien n’est ouvert pour l’instant.');
      return (x.openApps.length ? L('Open: ', 'Ouvert : ') + x.openApps.map(appName).join(', ') + (x.activeApp ? L(' (in front: ', ' (devant : ') + appName(x.activeApp) + ')' : '') : L('No app is open.', 'Aucune app n’est ouverte.')) + (x.recentFiles.length ? L('\nRecent files: ', '\nFichiers récents : ') + x.recentFiles.slice(0, 3).map((p) => PatOS.fs.basename(p)).join(', ') : ''); } });

  // ---- undo ----
  action({ id: 'intel.undo', title: 'Undo the last action', permission: null, priority: 55, match: (t) => (/^(?:undo|undo (?:that|it|the last (?:one|thing|action))|annule|annuler|defais)$/.test(t) && undos.length && Date.now() - undos[undos.length - 1].t < 30 * 60 * 1000 && undos[undos.length - 1].t > (PatOS.pat && PatOS.pat.undoAt ? PatOS.pat.undoAt() : 0) ? {} : null), // (the newest undo wins: Pat's tidy-up keeps its own)
    run: () => undo() });

  // ---- shortcuts: find, run (Pat's skill), explain, create ----
  const S = () => PatOS.shortcuts;
  action({ id: 'shortcuts.list', title: 'List your shortcuts', permission: 'shortcuts', priority: 41, match: W(/^(?:list|show|what are)\s+(?:my\s+|the\s+)?shortcuts$|^(?:mes\s+)?raccourcis$/),
    run: () => { const l = S() ? S().list() : []; return l.length ? L('Your shortcuts: ', 'Tes raccourcis : ') + l.map((s) => s.name).join(', ') + '.' : L('You don’t have any shortcuts yet. Try “create a shortcut called Morning that opens calendar and turns on dark mode”.', 'Tu n’as pas encore de raccourci. Essaie « crée un raccourci appelé Matin qui ouvre calendrier et active le mode sombre ».'); } });
  function describeStep(st) { const d = S() && S().actions[st.type]; if (!d) return st.type; const v = st.p || {}; return T(d.label) + (v.app ? ': ' + appName(v.app) : v.command ? ': “' + v.command + '”' : v.text ? ': “' + String(v.text).slice(0, 40) + '”' : v.value ? ': ' + v.value : v.percent != null ? ': ' + v.percent + '%' : ''); }
  action({ id: 'shortcuts.explain', title: 'Explain a shortcut', permission: 'shortcuts', params: { name: { type: 'string', required: true, max: 80 } }, priority: 42, examples: ['what does my Morning shortcut do', 'explain shortcut study time'],
    match: (t) => { const m = /^(?:what does|explain|describe)\s+(?:the\s+|my\s+)?(?:shortcut\s+)?["“]?(.+?)["”]?(?:\s+shortcut)?\s*(?:do)?$/.exec(t); return m && /shortcut/.test(t) ? { name: m[1].replace(/\s+shortcut$/, '') } : null; },
    run: ({ name }) => { const sc = S() && (S().byName(name) || S().match(name)); if (!sc) return { ok: false, message: L(`No shortcut is called “${name}”.`, `Aucun raccourci ne s’appelle « ${name} ».`) };
      const st = sc.steps || []; const trig = sc.trigger && sc.trigger.type && sc.trigger.type !== 'manual' ? L(' It also starts ', ' Il démarre aussi ') + (sc.trigger.type === 'login' ? L('when you unlock PatOS', 'quand tu déverrouilles PatOS') : sc.trigger.type === 'time' ? L('every day at ', 'chaque jour à ') + sc.trigger.time : L('when you say its phrase', 'quand tu dis sa phrase')) + '.' : '';
      return L(`“${sc.name}” does ${st.length} step${st.length === 1 ? '' : 's'}:\n`, `« ${sc.name} » fait ${st.length} étape${st.length > 1 ? 's' : ''} :\n`) + st.map((s, i) => (i + 1) + '. ' + describeStep(s)).join('\n') + trig; } });
  action({ id: 'shortcuts.create', title: 'Create a shortcut from words', permission: 'shortcuts', params: { name: { type: 'string', required: true, max: 60 }, steps: { type: 'any', required: true } }, priority: 47,
    examples: ['create a shortcut called Morning that opens calendar and turns on dark mode'],
    match: (t, raw) => {
      const m = mt(/^(?:create|make|new|add|cree|creer|fais)\s+(?:a\s+|un\s+)?(?:new\s+)?(?:shortcut|raccourci)\s+(?:called|named|appele|nomme)\s+["“]?(.+?)["”]?\s+(?:that|which|to|qui|pour)\s+(.+)$/i, raw);
      if (!m) return null;
      const parts = m[2].split(/\s*(?:,\s*)?\b(?:and then|then|and|puis|ensuite|et)\b\s*/i).map((x) => x.trim()).filter(Boolean);
      // "opens calendar" → "open calendar": each part must be something PatOS Intelligence can already do
      const steps = parts.map((p) => p.replace(/^(\w+?)s\b/i, (w, v) => (/^(open|turn|set|start|create|show|close|find|add|play|lock|empty|remind)$/i.test(v) ? v : w)).replace(/^(ouvre|active|desactive|lance|cree|montre|ferme|mets)\b/i, '$1'));
      return { name: m[1].trim(), steps };
    },
    run: ({ name, steps }) => {
      if (!S()) return { ok: false, message: L('Shortcuts isn’t available.', 'Raccourcis n’est pas disponible.') };
      if (S().byName(name)) return { ok: false, message: L(`There’s already a shortcut called “${name}”.`, `Il y a déjà un raccourci appelé « ${name} ».`) };
      const bad = steps.filter((s) => { const p = parse(s); return !p || p.id === 'shortcuts.create' || p.id === 'app.suggest' || p.id === 'intel.undo'; });
      if (!steps.length || bad.length) return { ok: false, message: L('I can’t make that shortcut: I don’t know how to “', 'Je ne peux pas faire ce raccourci : je ne sais pas « ') + (bad[0] || '') + L('”. Each step must be something I can already do.', ' ». Chaque étape doit être quelque chose que je sais déjà faire.') };
      const sc = S().save({ name, steps: steps.map((s) => ({ type: 'command', p: { text: s } })) });
      return { message: L(`Shortcut “${name}” created with ${steps.length} step${steps.length === 1 ? '' : 's'}. Say “run shortcut ${name}”.`, `Raccourci « ${name} » créé avec ${steps.length} étape${steps.length > 1 ? 's' : ''}. Dis « lance le raccourci ${name} ».`), data: { id: sc.id },
        undo: () => { S().remove(sc.id); return L('Shortcut removed.', 'Raccourci retiré.'); } };
    } });

  // ---- workspaces: several actions in one request ----
  const DEFAULT_SPACES = [{ id: 'study', name: 'Study', words: ['study', 'studying', 'homework', 'school', 'etude', 'etudier', 'devoirs', 'ecole'], steps: ['turn on do not disturb', 'open notes', 'open calendar', 'my reminders'] },
    { id: 'focus', name: 'Focus', words: ['focus', 'work', 'working', 'travail', 'concentration'], steps: ['turn on do not disturb', 'close music'] },
    { id: 'relax', name: 'Relax', words: ['relax', 'chill', 'break', 'detente', 'pause'], steps: ['turn off do not disturb', 'open music'] }];
  const spaces = () => { const s = PatOS.settings.intelWorkspaces; return Array.isArray(s) && s.length ? s : DEFAULT_SPACES; };
  function findSpace(w) { w = fold(w).trim(); return spaces().find((s) => fold(s.name) === w || (s.words || []).some((x) => fold(x) === w)) || null; }
  function runSpace(sp, source) {
    const done = [];
    for (const st of sp.steps || []) {
      const p = parse(st);
      if (!p || p.id === 'workspace.start') { done.push({ ok: false, text: st, message: L('I don’t know how to do this step.', 'Je ne sais pas faire cette étape.') }); continue; }
      let r = execute(p.id, p.params, { source: 'workspace:' + (source || 'user') });
      if (r && r.then) { done.push({ ok: true, text: st, message: L('started', 'lancé') }); r.catch(() => {}); continue; }
      if (r.status === 'confirm') r = { ok: false, message: L('needs a yes: do it on its own', 'demande un oui : fais-le à part') };
      done.push({ ok: r.ok !== false, text: st, message: r.message });
    }
    const ok = done.every((d) => d.ok); const n = done.filter((d) => d.ok).length;
    return { ok, message: (ok ? L(`${T(sp.name)} workspace ready:\n`, `Espace ${T(sp.name)} prêt :\n`) : L(`${T(sp.name)} workspace: ${n} of ${done.length} steps worked:\n`, `Espace ${T(sp.name)} : ${n} étapes sur ${done.length} ont marché :\n`)) + done.map((d) => (d.ok ? '✓ ' : '✗ ') + d.text + (d.ok ? '' : ' — ' + d.message)).join('\n'), data: { steps: done } };
  }
  action({ id: 'workspace.start', title: 'Start a workspace', description: 'Runs the steps of a workspace (Settings › Pat & Intelligence), each checked on its own.', permission: null, params: { name: { type: 'string', required: true, max: 40 } }, priority: 48,
    examples: ['start my study workspace', 'prepare my workspace for studying', 'study mode'],
    match: (t) => {
      let m = /^(?:start|open|prepare|set up|setup|get|launch|begin|lance|demarre|prepare)\s+(?:my\s+|the\s+|mon\s+|l')?(\w+)\s+(?:workspace|mode|space|session|espace)$/.exec(t) || /^(?:prepare|set up|get|ready)\s+(?:my\s+)?(?:workspace|desk|computer)\s+(?:for\s+)?(\w+)$/.exec(t) || /^(\w+)\s+(?:mode|time)$/.exec(t) || /^(?:prepare|lance)\s+(?:mon\s+)?espace\s+(?:de\s+|pour\s+)?(?:l')?(\w+)$/.exec(t);
      if (!m) return null; const sp = findSpace(m[1]); return sp ? { name: sp.name } : null;
    },
    run: ({ name }, c) => { const sp = spaces().find((s) => s.name === name); if (!sp) return { ok: false, message: L('There’s no workspace called ', 'Il n’y a pas d’espace appelé ') + name + '.' }; return runSpace(sp, c.source); } });

  /* ---------- apps (.patapp) offering their own actions ----------
     An app declares up to 10 actions (id, title, the words that call them); PatOS stores them and asks the app to do them
     (opening it if needed). App actions never outrank system ones and only ever reach their own app. */
  function exposeApp(appId, defs, deliver) {
    [...actions.values()].filter((a) => a.owner === 'app:' + appId).forEach((a) => actions.delete(a.id));
    (defs || []).slice(0, 10).forEach((d) => {
      if (!d || !/^[a-z0-9-]{1,30}$/.test(d.id || '') || typeof d.title !== 'string') return;
      const phrases = (Array.isArray(d.phrases) ? d.phrases : []).slice(0, 10).map((p) => fold(String(p).slice(0, 80)).trim()).filter((p) => p.length >= 3);
      if (!phrases.length) return;
      action({ id: 'app.' + appId + '.' + d.id, owner: 'app:' + appId, title: String(d.title).slice(0, 60), description: String(d.description || '').slice(0, 200), permission: 'apps', priority: 10, params: { text: { type: 'string', max: 200 } },
        match: (t) => { const p = phrases.find((x) => t === x || t.startsWith(x + ' ')); return p ? { text: t.slice(p.length).trim() } : null; },
        run: (params) => deliver(d.id, params) });
    });
  }

  PatOS.intel = { action, list, parse, execute, respond, undo, context, history: () => history.slice(), clearHistory: () => { history.length = 0; PatOS.store.set(HISTORY_KEY, []); }, undoAvailable: () => undos.length > 0,
    perms: () => Object.keys(PERMS).map((k) => ({ key: k, label: L(PERMS[k][0], PERMS[k][1]), on: allowedKind(k) })), setPerm: (k, on) => { if (!PERMS[k]) return; const p = Object.assign({}, userPerms()); if (on) delete p[k]; else p[k] = false; PatOS.setSetting('intelPerms', p); },
    workspaces: spaces, setWorkspaces: (l) => PatOS.setSetting('intelWorkspaces', l), runWorkspace: (name) => { const sp = spaces().find((s) => s.name === name || s.id === name); return sp ? runSpace(sp, 'user') : null; },
    exposeApp, entities: E, prep };
})();
