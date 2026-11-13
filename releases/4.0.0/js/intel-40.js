/* PatOS AI (4.0): more things Pat understands, all through the PatOS Intelligence registry (js/intelligence.js).
   NOT an AI and no language model: every action below is a pattern, a parser and code that checks what it does.
   - files.when          "the document I edited last Tuesday", "pictures from yesterday"
   - data.related        "everything related to biology" (PatOS Data, with the reasons it gives)
   - data.collect        "make a collection about biology"
   - desk.prepare        "prepare my desktop for school tomorrow": profile + workspace + that day's calendar + tiled windows,
                         each step reported on its own
   - files.duplicates    "find duplicate files in downloads": same content (SHA-256), and the extra copies go to the
                         Trash only after a yes (they can be put back)
   - notifs.summary      "summarize my notifications"
   - automation.create   "every weekday at 8 open calendar and notes": words → a Shortcut with a time or unlock trigger,
                         every step checked against what Pat can already do, saved only after a yes
   - app capabilities    World, Gallery and Data offer their own actions (owner app:<id>), listed like every other action */
(function () {
  'use strict';
  const I = PatOS.intel; if (!I) return;
  const FR = () => PatOS.lang === 'fr';
  const L = (en, fr) => (FR() ? fr : en);
  const T = (s) => PatOS.t(s);
  const fold = I.entities.fold;
  const pad = (n) => String(n).padStart(2, '0');
  const DAY = 86400000;
  const startOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

  /* ---------- when: words → a range of time ---------- */
  const WEEKDAYS = [['sunday', 'dimanche'], ['monday', 'lundi'], ['tuesday', 'mardi'], ['wednesday', 'mercredi'], ['thursday', 'jeudi'], ['friday', 'vendredi'], ['saturday', 'samedi']];
  const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5 };
  function when(t, now) {
    now = now || new Date(); const today = startOf(now); const r = (from, days, label) => ({ from: +from, to: +from + days * DAY, label });
    if (/\b(?:today|aujourd'?hui|this morning|ce matin)\b/.test(t)) return r(today, 1, L('today', 'aujourd’hui'));
    if (/\b(?:yesterday|hier)\b/.test(t)) return r(+today - DAY, 1, L('yesterday', 'hier'));
    let m = /\b(\d+|one|two|three|four|five|six|seven|ten|un|une|deux|trois|quatre|cinq)\s+(day|days|week|weeks|jours?|semaines?)\s+ago\b/.exec(t) || /\bil y a\s+(\d+|un|une|deux|trois|quatre|cinq)\s+(jours?|semaines?)\b/.exec(t);
    if (m) { const n = +m[1] || NUM[m[1]] || 1; const wk = /week|semaine/.test(m[2]); const from = +today - n * (wk ? 7 : 1) * DAY; return r(from, wk ? 7 : 1, n + ' ' + (wk ? L('week', 'semaine') : L('day', 'jour')) + (n > 1 ? 's' : '') + L(' ago', '') ); }
    for (let i = 0; i < 7; i++) {
      const [en, fr] = WEEKDAYS[i];
      if (new RegExp('\\b(?:last|on|this past|past)?\\s*' + en + '\\b|\\b' + fr + '(?:\\s+dernier)?\\b').test(t)) {
        const back = ((today.getDay() - i + 7) % 7) || 7; const d = new Date(+today - back * DAY);
        return r(d, 1, d.toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' }));
      }
    }
    const monday = new Date(+today - ((today.getDay() + 6) % 7) * DAY);
    if (/\b(?:this week|cette semaine)\b/.test(t)) return r(monday, 7, L('this week', 'cette semaine'));
    if (/\b(?:last week|la semaine (?:passee|derniere))\b/.test(t)) return r(+monday - 7 * DAY, 7, L('last week', 'la semaine passée'));
    if (/\b(?:this month|ce mois)\b/.test(t)) { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: +f, to: +today + DAY, label: L('this month', 'ce mois-ci') }; }
    if (/\b(?:last month|le mois (?:passe|dernier))\b/.test(t)) { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1), e = new Date(today.getFullYear(), today.getMonth(), 1); return { from: +f, to: +e, label: L('last month', 'le mois passé') }; }
    return null;
  }

  /* ---------- kinds of file ---------- */
  const KINDS = {
    document: { words: /\b(?:documents?|docs?|text files?|essays?|reports?|fichiers? texte)\b/, ext: ['txt', 'md', 'doc', 'docx', 'rtf', 'pdf', 'odt', 'html', 'pages'], label: ['documents', 'documents'] },
    pdf: { words: /\bpdfs?\b/, ext: ['pdf'], label: ['PDFs', 'PDF'] },
    picture: { words: /\b(?:pictures?|photos?|images?|pics?|screenshots?|captures? d'ecran)\b/, ext: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg', 'bmp'], label: ['pictures', 'images'] },
    sheet: { words: /\b(?:spreadsheets?|sheets?|tableurs?|feuilles? de calcul)\b/, ext: ['csv', 'xls', 'xlsx', 'numbers', 'ods'], label: ['spreadsheets', 'feuilles de calcul'] },
    slides: { words: /\b(?:presentations?|slides?|decks?|diaporamas?)\b/, ext: ['ppt', 'pptx', 'key', 'odp'], label: ['presentations', 'présentations'] },
    video: { words: /\b(?:videos?|movies?|films?|clips?)\b/, ext: ['mp4', 'webm', 'mov', 'mkv', 'avi'], label: ['videos', 'vidéos'] },
    song: { words: /\b(?:songs?|music|audio|musiques?|chansons?)\b/, ext: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'], label: ['songs', 'chansons'] }
  };
  const kindOf = (t) => Object.keys(KINDS).find((k) => KINDS[k].words.test(t)) || null;
  const extOf = (p) => { const m = /\.([a-z0-9]{1,5})$/i.exec(p); return m ? m[1].toLowerCase() : ''; };
  const HIDDEN = /^\/(?:\.Trash|System|\.)/;
  const nodeTime = (n) => n.modified || n.mtime || n.created || 0;

  /* the files changed (or opened, from Timeline) in a range of time, newest first */
  function filesIn(range, kind) {
    const out = new Map();
    const ok = (p) => !HIDDEN.test(p) && (!kind || KINDS[kind].ext.includes(extOf(p)));
    PatOS.fs.walk('/', (p, n) => { if (n.type !== 'file' || !ok(p)) return; const tm = nodeTime(n); if (tm >= range.from && tm < range.to) out.set(p, { path: p, t: tm, how: 'edited' }); });
    if (PatOS.timeline && PatOS.timeline.events) PatOS.timeline.events().forEach((e) => { const p = e.ref && e.ref.path; if (e.k !== 'file' || !p || !ok(p) || !(e.t >= range.from && e.t < range.to) || !PatOS.fs.exists(p)) return; const had = out.get(p); if (!had || had.t < e.t) out.set(p, { path: p, t: e.t, how: e.verb === 'Edited' ? 'edited' : (had ? had.how : 'opened') }); });
    return [...out.values()].sort((a, b) => b.t - a.t);
  }
  const fileButtons = (list) => list.slice(0, 4).map((f) => ({ label: PatOS.fs.basename(f.path), open: f.path }));
  const hm = (t) => new Date(t).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' });
  const dshort = (t) => new Date(t).toLocaleDateString(PatOS.locale, { weekday: 'short', month: 'short', day: 'numeric' });

  I.action({ id: 'files.when', title: 'Find files by when you used them', description: 'Finds the files you changed or opened on a day or in a week.', permission: 'files', priority: 49,
    params: { from: { type: 'number' }, to: { type: 'number' }, label: { type: 'string', max: 80 }, kind: { type: 'string', max: 20 }, open: { type: 'boolean' } },
    examples: ['the document I edited last Tuesday', 'pictures from yesterday', 'what did I work on this week'],
    match: (t) => {
      if (/^(?:remind|add|schedule|event|create|make|new|rappel|ajoute)\b/.test(t)) return null;
      const kind = kindOf(t); const verb = /\b(?:edit|edited|changed?|modified|worked on|wrote|written|saved|made|created|opened|downloaded|used|modifie|ecrit|ouvert|telecharge|travaille)\b/.test(t);
      const fileWord = kind || /\b(?:files?|fichiers?)\b/.test(t);
      if (!verb && !(fileWord && /\b(?:from|of|since|de|du|d')\b/.test(t))) return null;
      if (!fileWord && !/\bwhat (?:did|have) i\b|\bqu'?est-ce que j'ai\b/.test(t)) return null;
      const r = when(t); if (!r) return null;
      return { from: r.from, to: r.to, label: r.label, kind: kind || undefined, open: /^(?:open|ouvre)\b/.test(t) };
    },
    run: ({ from, to, label, kind, open }) => {
      if (from == null || to == null) return { ok: false, message: L('Say when, like “yesterday” or “last Tuesday”.', 'Dis quand, comme « hier » ou « mardi dernier ».') };
      const list = filesIn({ from, to }, kind || null); const what = kind ? L(KINDS[kind].label[0], KINDS[kind].label[1]) : L('files', 'fichiers');
      if (!list.length) return { ok: true, message: L(`I didn’t find ${what} you changed or opened ${label}.`, `Je n’ai trouvé aucun ${what.replace(/s$/, '')} modifié ou ouvert ${label}.`), data: { paths: [] } };
      if (open) PatOS.openFile(list[0].path);
      const lines = list.slice(0, 6).map((f) => '• ' + PatOS.fs.basename(f.path) + '  —  ' + (f.how === 'opened' ? L('opened ', 'ouvert ') : L('changed ', 'modifié ')) + ((to - from) > DAY ? dshort(f.t) + ' ' : '') + hm(f.t));
      return { message: (open ? L(`Opened “${PatOS.fs.basename(list[0].path)}”. `, `J’ai ouvert « ${PatOS.fs.basename(list[0].path)} ». `) : '') + L(`${list.length} of your ${what} from ${label}:\n`, `${list.length} ${what} de ${label} :\n`) + lines.join('\n') + (list.length > 6 ? L(`\n…and ${list.length - 6} more.`, `\n…et ${list.length - 6} de plus.`) : ''),
        buttons: fileButtons(list), data: { paths: list.map((f) => f.path) } };
    } });

  /* ---------- Data: everything related to something ---------- */
  const D = () => PatOS.data;
  const KIND_WORD = { file: ['file', 'fichier'], note: ['note', 'note'], event: ['event', 'événement'], reminder: ['reminder', 'rappel'], capture: ['capture', 'capture'], world: ['world', 'monde'] };
  I.action({ id: 'data.related', title: 'Everything related to something', description: 'Gathers the files, notes, events and reminders about a subject, with the reasons.', permission: 'files', priority: 47,
    params: { q: { type: 'string', required: true, max: 80, label: 'subject', ask: ['Related to what?', 'En lien avec quoi?'] } },
    examples: ['everything related to biology', 'show me all about the trip'],
    match: (t, raw, E) => { const m = E.m(/^(?:show me |open |find |show |list |get |gather |what is |what's )?(?:everything|all|anything|all the things|all my stuff|stuff)\s+(?:related to|about|on|to do with|linked to|connected to|for)\s+(?:the\s+|my\s+)?["“]?(.+?)["”]?$/i, raw) || E.m(/^(?:montre(?:-moi)?\s+)?tout ce qui (?:concerne|parle de|touche)\s+(?:l'|le |la |les |mon |ma |mes )?(.+)$/i, raw); return m ? { q: m[1].trim() } : null; },
    run: ({ q }) => {
      if (!D()) return { ok: false, message: L('PatOS Data isn’t available.', 'PatOS Data n’est pas disponible.') };
      if (D().prefs && D().prefs().on === false) return { ok: false, message: L('PatOS Data is turned off in the Data app.', 'PatOS Data est désactivé dans l’app Data.') };
      const res = D().search(q, 30);
      if (!res.length) return { ok: true, message: L(`Nothing on this PatOS mentions “${q}”.`, `Rien dans ce PatOS ne parle de « ${q} ».`), data: { keys: [] } };
      const by = {}; res.forEach((r) => { by[r.kind] = (by[r.kind] || 0) + 1; });
      const sum = Object.entries(by).map(([k, n]) => n + ' ' + L(KIND_WORD[k] ? KIND_WORD[k][0] : k, KIND_WORD[k] ? KIND_WORD[k][1] : k) + (n > 1 ? 's' : '')).join(', ');
      return { message: L(`About “${q}”: ${sum}.\n`, `Sur « ${q} » : ${sum}.\n`) + res.slice(0, 8).map((r) => '• ' + r.title + (r.sub ? '  —  ' + r.sub : '')).join('\n'),
        buttons: [{ label: L('See in Data', 'Voir dans Data'), launch: 'data', args: { q } }, { label: L('Make a collection', 'Faire une collection'), say: 'make a collection about ' + q }], data: { keys: res.map((r) => r.key) } };
    } });
  I.action({ id: 'data.collect', title: 'Make a collection', description: 'Makes a PatOS Data collection that gathers everything about a subject, now and later.', permission: 'files', priority: 47, undo: true,
    params: { q: { type: 'string', required: true, max: 60 } }, examples: ['make a collection about biology'],
    match: (t, raw, E) => { const m = E.m(/^(?:make|create|start|new)\s+(?:a\s+)?collection\s+(?:about|for|on|called|named)\s+["“]?(.+?)["”]?$/i, raw) || E.m(/^(?:fais|cree|creer)\s+une collection\s+(?:sur|pour|appelee)\s+(.+)$/i, raw); return m ? { q: m[1].trim() } : null; },
    run: ({ q }) => {
      if (!D()) return { ok: false, message: L('PatOS Data isn’t available.', 'PatOS Data n’est pas disponible.') };
      const ex = D().collections().find((c) => fold(c.name) === fold(q)); if (ex) return { ok: true, message: L(`You already have the collection “${ex.name}”.`, `Tu as déjà la collection « ${ex.name} ».`), buttons: [{ label: L('Open it', 'L’ouvrir'), launch: 'data', args: { id: ex.id } }] };
      const words = fold(q).split(/[\s,]+/).filter((w) => w.length > 2).slice(0, 5);
      const id = D().createCollection(q.charAt(0).toUpperCase() + q.slice(1), words.length ? words : [fold(q)]);
      const n = D().collection(id).items.length;
      return { message: L(`Made the collection “${q}”: ${n} thing${n === 1 ? '' : 's'} so far, and new ones join by themselves.`, `Collection « ${q} » créée : ${n} élément${n > 1 ? 's' : ''} pour l’instant, et les nouveaux s’ajoutent seuls.`),
        buttons: [{ label: L('Open it', 'L’ouvrir'), launch: 'data', args: { id } }], data: { id }, undo: () => { D().deleteCollection(id); return L('Collection removed.', 'Collection retirée.'); } };
    } });

  /* ---------- prepare the desktop for something ---------- */
  function calendarOf(dayKey) { const cal = PatOS.store.get('calendar', {}) || {}; return (cal[dayKey] || []).filter(Boolean).slice().sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99'))); }
  function findProfile(word) { if (!PatOS.profiles) return null; const w = fold(word); return PatOS.profiles.list().find((p) => fold(p.name) === w || fold(p.name).startsWith(w) || w.startsWith(fold(p.name))) || null; }
  function findWorkspace(word) { const w = fold(word); return I.workspaces().find((s) => fold(s.name) === w || (s.words || []).some((x) => fold(x) === w)) || null; }
  I.action({ id: 'desk.prepare', title: 'Prepare your desktop for something', description: 'Switches to the matching profile, runs the matching workspace, shows that day’s calendar and arranges the windows. Each step is reported.', permission: 'apps', priority: 47, undo: true,
    params: { purpose: { type: 'string', required: true, max: 40, ask: ['Prepare it for what?', 'Le préparer pour quoi?'] }, day: { type: 'enum', values: ['today', 'tomorrow'] } },
    examples: ['prepare my desktop for school tomorrow', 'get my computer ready for work'],
    match: (t) => {
      // (a bare "get ready for X" only when X is one of your profiles or workspaces, or a day is said)
      const loose = /^(?:get (?:me )?ready|get set)\s+for\s+(?:the\s+|my\s+)?(.+?)(?:\s+(tomorrow|today|tonight))?$/.exec(t);
      const m = /^(?:prepare|set up|setup|get|ready|arrange|organi[sz]e)\s+(?:my\s+|the\s+)?(?:desktop|desk|computer|pc|patos|screen|setup|workspace)\s+(?:ready\s+)?for\s+(?:the\s+|my\s+)?(.+?)(?:\s+(tomorrow|today|tonight))?$/.exec(t)
        || (loose && (loose[2] || findProfile(loose[1]) || findWorkspace(loose[1])) ? loose : null)
        || /^prepare\s+(?:mon\s+)?(?:bureau|ordinateur|ordi|espace)\s+pour\s+(?:l'|le |la |mon |ma )?(.+?)(?:\s+(demain|aujourd'hui|ce soir))?$/.exec(t);
      if (!m) return null; return { purpose: m[1].trim(), day: /tomorrow|demain/.test(m[2] || '') ? 'tomorrow' : 'today' };
    },
    run: ({ purpose, day }, c) => {
      const steps = []; const step = (ok, text, message) => steps.push({ ok, text, message });
      const word = fold(purpose).replace(/^(?:l'|le |la )/, '').split(/\s+/)[0];
      // 1. a profile with that name
      const before = PatOS.profiles ? PatOS.profiles.active() : null; const prof = findProfile(word);
      if (prof && !prof.active) { try { PatOS.profiles.switchTo(prof.id); step(true, L('Switched to the profile ', 'Profil ') + prof.name); } catch (e) { step(false, L('Profile ', 'Profil ') + prof.name, e.message); } }
      else if (prof) step(true, L('Already in the profile ', 'Déjà dans le profil ') + prof.name);
      // 2. a workspace for it (its own steps, each checked)
      const ws = findWorkspace(word) || findWorkspace(purpose);
      if (ws) { const r = I.runWorkspace(ws.name); ((r && r.data && r.data.steps) || []).forEach((s) => step(s.ok, s.text, s.message)); }
      else if (!prof) { const r = I.execute('app.open', { app: 'calendar' }, { source: c.source }); step(r.ok !== false, L('Open Calendar', 'Ouvrir Calendrier'), r.ok === false ? r.message : undefined); }
      // 3. that day's calendar
      const d = new Date(); if (day === 'tomorrow') d.setDate(d.getDate() + 1); const evs = calendarOf(PatOS.dateKey(d));
      const dayW = day === 'tomorrow' ? L('Tomorrow', 'Demain') : L('Today', 'Aujourd’hui');
      step(true, dayW + ': ' + (evs.length ? evs.slice(0, 4).map((e) => (e.time ? e.time + ' ' : '') + e.title).join(', ') + (evs.length > 4 ? '…' : '') : L('nothing on the calendar', 'rien au calendrier')));
      // 4. the windows side by side
      const open = PatOS.wm ? PatOS.wm.windows.filter((w) => !w.minimized && !w.profileHidden) : [];
      if (open.length > 1 && PatOS.wmPro) { try { PatOS.wmPro.tileAll(); step(true, L('Arranged ', 'Rangé ') + open.length + L(' windows side by side', ' fenêtres côte à côte')); } catch (e) { step(false, L('Arrange the windows', 'Ranger les fenêtres'), e.message); } }
      const n = steps.filter((s) => s.ok).length, all = n === steps.length;
      const tip = !prof && !ws ? L(`\n(No profile or workspace is called “${purpose}”. Make one in Settings › Profiles or Settings › Pat & Intelligence and I’ll use it.)`, `\n(Aucun profil ni espace ne s’appelle « ${purpose} ». Crées-en un dans Réglages › Profils ou Réglages › Pat et Intelligence et je l’utiliserai.)`) : '';
      return { ok: all, message: (all ? L(`Ready for ${purpose}:\n`, `Prêt pour ${purpose} :\n`) : L(`${n} of ${steps.length} steps worked:\n`, `${n} étapes sur ${steps.length} ont marché :\n`)) + steps.map((s) => (s.ok ? '✓ ' : '✗ ') + s.text + (s.ok ? '' : ' — ' + s.message)).join('\n') + tip,
        data: { steps }, undo: prof && before && before !== prof.id ? () => { PatOS.profiles.switchTo(before); return L('Back to your other profile.', 'Retour à ton autre profil.'); } : undefined };
    } });

  /* ---------- duplicates ---------- */
  const PLACES = { desktop: '/Desktop', downloads: '/Downloads', documents: '/Documents', pictures: '/Pictures', videos: '/Videos', music: '/Music', bureau: '/Desktop', telechargements: '/Downloads', images: '/Pictures' };
  const size = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
  I.action({ id: 'files.duplicates', title: 'Find duplicate files', description: 'Finds files with exactly the same content. The extra copies go to the Trash only if you say yes.', permission: 'files.write', priority: 48,
    params: { dir: { type: 'path' } }, examples: ['find duplicate files', 'find duplicates in downloads'],
    match: (t) => { const m = /^(?:find|show|look for|search for|check for|any|clean up|remove|delete)\s+(?:the\s+|my\s+|all\s+)?(?:duplicates?|duplicated files?|duplicate (?:files|photos|pictures|documents|copies)|identical files|same files)(?:\s+(?:in|from|on)\s+(?:my\s+|the\s+)?(\w+))?$/.exec(t) || /^(?:trouve|cherche|montre)\s+(?:les\s+)?doublons(?:\s+dans\s+(?:mes\s+|le\s+|les\s+)?(\w+))?$/.exec(t);
      if (!m) return null; if (m[1] && !PLACES[m[1]]) return null; return { dir: m[1] ? PLACES[m[1]] : undefined }; },
    run: async ({ dir }) => {
      const root = dir || '/'; if (!PatOS.fs.isDir(root)) return { ok: false, message: L('That folder isn’t here.', 'Ce dossier n’est pas ici.') };
      if (!PatOS.finderPro) return { ok: false, message: L('Finding duplicates isn’t available.', 'La recherche de doublons n’est pas disponible.') };
      const groups = await PatOS.finderPro.duplicates(root); const where = root === '/' ? L('your files', 'tes fichiers') : T(PatOS.fs.basename(root));
      if (!groups.length) return { ok: true, message: L(`No duplicates in ${where}: every file is different.`, `Aucun doublon dans ${where} : chaque fichier est différent.`), data: { groups: [] } };
      // the copy that stays: the oldest one (the original), else the shortest path
      const plan = groups.map((g) => { const info = g.paths.map((p) => ({ p, t: nodeTime(PatOS.fs.get(p) || {}) })); info.sort((a, b) => (a.t || Infinity) - (b.t || Infinity) || a.p.length - b.p.length || a.p.localeCompare(b.p)); return { keep: info[0].p, extra: info.slice(1).map((x) => x.p), size: g.size }; });
      const extra = plan.reduce((n, g) => n + g.extra.length, 0), saved = plan.reduce((n, g) => n + g.size * g.extra.length, 0);
      const lines = plan.slice(0, 5).map((g) => '• ' + PatOS.fs.basename(g.keep) + ' (' + size(g.size) + ')  ×' + (g.extra.length + 1) + L(' — keeps ', ' — garde ') + g.keep);
      return { text: L(`${plan.length} file${plan.length > 1 ? 's have' : ' has'} exact copies in ${where} (${extra} extra cop${extra > 1 ? 'ies' : 'y'}, ${size(saved)}):\n`, `${plan.length} fichier${plan.length > 1 ? 's ont' : ' a'} des copies exactes dans ${where} (${extra} copie${extra > 1 ? 's' : ''} en trop, ${size(saved)}) :\n`) + lines.join('\n') + (plan.length > 5 ? '\n…' : '')
          + L('\nShould I move the extra copies to the Trash? The originals stay, and you can put them back.', '\nJe mets les copies en trop dans la Corbeille? Les originaux restent, et tu peux les remettre.'),
        confirm() {
          const moved = []; let failed = 0;
          plan.forEach((g) => g.extra.forEach((p) => { try { if (!PatOS.fs.exists(g.keep)) { failed++; return; } PatOS.fs.remove(p); moved.push(p); } catch (e) { failed++; } }));
          const trashNames = () => { const tr = PatOS.fs.list('/.Trash'); return moved.map((p) => (tr.find((x) => x.origin === p) || {}).name).filter(Boolean); };
          return { ok: moved.length > 0 || !failed, message: L(`Moved ${moved.length} extra cop${moved.length === 1 ? 'y' : 'ies'} to the Trash`, `${moved.length} copie${moved.length > 1 ? 's' : ''} en trop dans la Corbeille`) + (failed ? L(` (${failed} couldn’t be moved)`, ` (${failed} n’ont pas pu l’être)`) : '') + '.',
            data: { steps: moved.map((p) => ({ ok: true, text: L('To the Trash: ', 'À la corbeille : ') + p })) },
            undo: () => { let back = 0; trashNames().forEach((n) => { try { PatOS.fs.restore(n); back++; } catch (e) {} }); return L(`Put ${back} file${back === 1 ? '' : 's'} back.`, `${back} fichier${back > 1 ? 's' : ''} remis.`); } };
        } };
    } });

  /* ---------- notifications, summed up ---------- */
  I.action({ id: 'notifs.summary', title: 'Sum up your notifications', description: 'Groups your notifications by app: how many, what is urgent, the latest of each.', permission: null, priority: 47,
    examples: ['summarize my notifications', 'what did I miss'],
    match: (t) => (/^(?:summari[sz]e|sum up|recap|digest of)\s+(?:my\s+|the\s+)?notifications?$|^what (?:did|have) i miss(?:ed)?$|^(?:any|anything) (?:new|important)$|^(?:resume|resume moi)\s+(?:mes\s+)?notifications$|^qu'?est-ce que j'ai manque$/.test(t) ? {} : null),
    run: () => {
      const all = PatOS.nc ? PatOS.nc.list() : []; if (!all.length) return { message: L('No notifications: you didn’t miss anything.', 'Aucune notification : tu n’as rien manqué.'), data: { total: 0 } };
      const unread = all.filter((n) => !n.read), urgent = all.filter((n) => n.priority === 'urgent' || n.priority === 'high');
      const groups = PatOS.nc.groups().map((g) => ({ name: T(g.name || 'PatOS'), n: g.items.reduce((s, x) => s + (x.count || 1), 0), unread: g.items.filter((x) => !x.read).length, top: g.items[0] })).sort((a, b) => b.unread - a.unread || b.n - a.n);
      const total = groups.reduce((s, g) => s + g.n, 0);
      const head = L(`${total} notification${total === 1 ? '' : 's'} from ${groups.length} app${groups.length === 1 ? '' : 's'}`, `${total} notification${total > 1 ? 's' : ''} de ${groups.length} app${groups.length > 1 ? 's' : ''}`) + (unread.length ? L(`, ${unread.length} unread`, `, ${unread.length} non lue${unread.length > 1 ? 's' : ''}`) : '') + '.';
      const imp = urgent.slice(0, 3).map((n) => '‼ ' + T(n.appName || '') + ': ' + n.title);
      const lines = groups.slice(0, 6).map((g) => '• ' + g.name + ' — ' + g.n + (g.unread ? L(` (${g.unread} new)`, ` (${g.unread} nouvelle${g.unread > 1 ? 's' : ''})`) : '') + L(': latest “', ' : dernière « ') + String(g.top.title).slice(0, 60) + L('”', ' »'));
      return { message: head + '\n' + (imp.length ? imp.join('\n') + '\n' : '') + lines.join('\n'), data: { total, unread: unread.length, apps: groups.length } };
    } });

  /* ---------- words → an automation (a Shortcut with a trigger) ---------- */
  const DAYSETS = [[/\b(?:every ?day|daily|each day|chaque jour|tous les jours)\b/, []], [/\b(?:weekdays?|every weekday|on weekdays|school days|semaine|en semaine|jours de semaine)\b/, [1, 2, 3, 4, 5]], [/\b(?:weekends?|on weekends|fin de semaine|week-end)\b/, [0, 6]]];
  function timeOf(t) {
    const m = /\bat\s+(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/.exec(t) || /\ba\s+(\d{1,2})\s*h\s*(\d{2})?/.exec(t); if (!m) return /\b(?:in the morning|le matin)\b/.test(t) ? '08:00' : /\b(?:at noon|a midi)\b/.test(t) ? '12:00' : null;
    let h = +m[1]; const mi = +(m[2] || 0); const ap = (m[3] || '').replace(/\./g, ''); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
    return h < 24 && mi < 60 ? pad(h) + ':' + pad(mi) : null;
  }
  const DAYNAMES = () => [L('Sun', 'dim'), L('Mon', 'lun'), L('Tue', 'mar'), L('Wed', 'mer'), L('Thu', 'jeu'), L('Fri', 'ven'), L('Sat', 'sam')];
  const describeTrigger = (tr) => tr.type === 'login' ? L('when you unlock PatOS', 'quand tu déverrouilles PatOS') : (tr.days && tr.days.length ? (tr.days.join() === '1,2,3,4,5' ? L('weekdays', 'en semaine') : tr.days.join() === '0,6' ? L('weekends', 'les fins de semaine') : tr.days.map((d) => DAYNAMES()[d]).join(', ')) : L('every day', 'chaque jour')) + L(' at ', ' à ') + tr.at;
  I.action({ id: 'automation.create', title: 'Make an automation from words', description: 'Turns “every weekday at 8 open calendar” into a Shortcut that runs by itself. Every step is checked first, and nothing is saved before you say yes.', permission: 'shortcuts', priority: 48, undo: true,
    params: { trigger: { type: 'any', required: true }, steps: { type: 'any', required: true }, name: { type: 'string', max: 60 } },
    examples: ['every weekday at 8am open calendar and notes', 'when I unlock open mail'],
    match: (t, raw) => {
      let rest = null, trigger = null;
      const login = /^(?:when(?:ever)? i (?:unlock|log in|login|sign in|start patos|open patos)|at (?:login|unlock|startup)|quand je (?:deverrouille|me connecte))[,\s]+(.+)$/.exec(t);
      if (login) { trigger = { type: 'login' }; rest = login[1]; }
      else {
        const m = /^((?:every|each|on|daily|weekdays?|weekends?|chaque|tous les|en semaine|le matin)\b.*?\b(?:at\s+\d{1,2}(?:[:h]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|a\s+\d{1,2}\s*h\s*(?:\d{2})?|in the morning|at noon))[,\s]+(.+)$/.exec(t);
        if (!m) return null; const at = timeOf(m[1]); if (!at) return null;
        let days = null; for (const [re, ds] of DAYSETS) if (re.test(m[1])) { days = ds; break; }
        if (!days) { const named = WEEKDAYS.map((w, i) => (new RegExp('\\b(?:' + w[0] + 's?|' + w[1] + 's?)\\b').test(m[1]) ? i : -1)).filter((i) => i >= 0); days = named.length ? named : []; }
        trigger = { type: 'time', at, days }; rest = m[2];
      }
      const steps = rest.replace(/^(?:please\s+|pat\s+)/, '').split(/\s*(?:,\s*)?\b(?:and then|then|and|puis|ensuite|et)\b\s*|\s*,\s*/).map((x) => x.trim()).filter(Boolean)
        .map((p) => p.replace(/^(\w+?)s\b/i, (w, v) => (/^(open|turn|set|start|show|close|play|lock|remind)$/i.test(v) ? v : w)));
      // "open calendar and notes": a part that isn't a command on its own borrows the verb of the one before
      for (let i = 1; i < steps.length; i++) { const p = I.parse(steps[i]); if (p && !p.guess && p.id !== 'app.suggest') continue; const verb = steps[i - 1].split(' ')[0]; const q = I.parse(verb + ' ' + steps[i]); if (q && !q.guess && q.id !== 'app.suggest') steps[i] = verb + ' ' + steps[i]; }
      return steps.length ? { trigger, steps } : null;
    },
    confirm: ({ trigger, steps }) => L('I’ll make an automation that runs ', 'Je vais faire une automatisation qui roule ') + describeTrigger(trigger) + ':\n' + steps.map((s, i) => (i + 1) + '. ' + s).join('\n') + L('\nSave it?', '\nJe l’enregistre?'),
    run: ({ trigger, steps, name }) => {
      const S = PatOS.shortcuts; if (!S) return { ok: false, message: L('Shortcuts isn’t available.', 'Raccourcis n’est pas disponible.') };
      if (!trigger || !(trigger.type === 'login' || (trigger.type === 'time' && /^\d{2}:\d{2}$/.test(trigger.at || '') && Array.isArray(trigger.days) && trigger.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)))) return { ok: false, message: L('That isn’t a time I can use.', 'Ce n’est pas un moment que je peux utiliser.') };
      if (!Array.isArray(steps) || !steps.length || steps.length > 10 || steps.some((s) => typeof s !== 'string' || s.length > 120)) return { ok: false, message: L('An automation needs 1 to 10 steps.', 'Une automatisation a besoin de 1 à 10 étapes.') };
      // every step must be something Pat can already do, and not something that makes more automations or asks first
      const checked = steps.map((s) => { const p = I.parse(s); return { text: s, p }; });
      const bad = checked.find((x) => !x.p || x.p.guess || /^(?:automation\.create|shortcuts\.create|app\.suggest|intel\.undo|files\.duplicates)$/.test(x.p.id) || x.p.action.confirm);
      if (bad) return { ok: false, message: L('I can’t automate “', 'Je ne peux pas automatiser « ') + bad.text + L('”: each step must be something I can do by myself, without asking.', ' » : chaque étape doit être quelque chose que je fais seul, sans demander.'), data: { steps: checked.map((x) => ({ ok: x !== bad, text: x.text })) } };
      let nm = String(name || '').trim() || (trigger.type === 'login' ? L('When I unlock', 'Au déverrouillage') : L('Every ', 'Chaque ') + describeTrigger(trigger).replace(/^every day at /, 'day at ').replace(/^chaque jour à /, 'jour à ')).slice(0, 60);
      let k = 2; const base = nm; while (S.byName(nm)) nm = base + ' ' + k++;
      const sc = S.save({ name: nm, trigger, steps: checked.map((x) => ({ type: 'command', p: { text: x.text } })) });
      return { message: L(`Automation “${nm}” saved: it runs ${describeTrigger(trigger)}. Change or turn it off in Shortcuts.`, `Automatisation « ${nm} » enregistrée : elle roule ${describeTrigger(trigger)}. Modifie-la ou désactive-la dans Raccourcis.`),
        buttons: [{ label: L('Open Shortcuts', 'Ouvrir Raccourcis'), launch: 'shortcuts' }], data: { id: sc.id, steps: checked.map((x) => ({ ok: true, text: x.text })) },
        undo: () => { S.remove(sc.id); return L('Automation removed.', 'Automatisation retirée.'); } };
    } });

  /* ---------- app capabilities: the 4.0 apps say what they can do ----------
     Each is an ordinary action whose owner is the app, so Settings › Pat & Intelligence lists it and its permission
     switch covers it. */
  I.action({ id: 'world.create', owner: 'app:world', title: 'Make a new World', permission: 'apps', priority: 46, undo: true, params: { name: { type: 'string', required: true, max: 60 } },
    examples: ['new world called Trip'], match: (t, raw, E) => { const m = E.m(/^(?:new|make|create|start)\s+(?:a\s+)?(?:new\s+)?world\s+(?:called|named|for)\s+["“]?(.+?)["”]?$/i, raw) || E.m(/^(?:nouveau|cree|creer)\s+(?:un\s+)?monde\s+(?:appele|pour)\s+(.+)$/i, raw); return m ? { name: m[1].trim() } : null; },
    run: ({ name }) => { const id = PatOS.world.create(name); PatOS.launch('world', { id }); return { message: L(`Made the World “${name}”.`, `Monde « ${name} » créé.`), data: { id } }; } });
  I.action({ id: 'gallery.create', owner: 'app:gallery', title: 'Make a gallery of a folder', permission: 'apps', priority: 46, params: { dir: { type: 'path', required: true } },
    examples: ['make a gallery of my pictures'], match: (t) => { const m = /^(?:make|create|new)\s+(?:a\s+)?gallery\s+(?:of|from|with)\s+(?:my\s+|the\s+)?(\w+)(?:\s+folder)?$/.exec(t); return m && PLACES[m[1]] ? { dir: PLACES[m[1]] } : null; },
    run: ({ dir }) => { if (!PatOS.fs.isDir(dir)) return { ok: false, message: L('That folder isn’t here.', 'Ce dossier n’est pas ici.') }; const id = PatOS.gallery.create(T(PatOS.fs.basename(dir)), { source: { folder: dir } }); PatOS.launch('gallery', { id }); return { message: L('Made a gallery that follows ', 'Galerie créée qui suit ') + T(PatOS.fs.basename(dir)) + '.', data: { id } }; } });

  PatOS.intel.when = when; // (for tests and for other parts of PatOS that read times in words)
})();
