/* PatOS Intelligence, part 2: what makes it feel smart, still with no AI and no model. Everything here is explicit rules
   on top of the action registry (js/intelligence.js), through its extension points:
   - Synonyms and slang ("fire up", "kill", "whip up") become the words actions know.
   - Phrases you teach: "when I say homework time, start my study workspace" (Settings › Pat & Intelligence lists them).
   - Several commands at once: "turn on dark mode, set the volume to 30 and start a 25 min timer" (each one reported).
   - A conversation: it remembers what it just did and what it showed, so "open it", "the second one", "do it again",
     "and tomorrow?", "move it to friday", "rename it to Trips", "delete it", "what did you just do" work.
   - Questions about this PatOS: storage left, version, sync, battery, online, how many notes/files/apps…, your next event,
     what's due this week, days until a date, what day a date is, the time in another city, your name.
   - Places: "bring me to the nearest gym", "find a pharmacy near me", "directions to the library", "where am I",
     "show Paris on the map" (js/places.js, OpenStreetMap; directions open in Google Maps).
   - Guesses: when nothing matches exactly, the closest simple command is offered as "Did you mean…?" (never done without a yes),
     and Pat shows the closest examples when it doesn't understand.
   - Suggestions: what you usually open at this hour, what's due, what's next. */
(function () {
  'use strict';
  const I = PatOS.intel; if (!I) return;
  const T = (s) => PatOS.t(s);
  const FR = () => PatOS.lang === 'fr';
  const L = (en, fr) => (FR() ? fr : en);
  const E = I.entities; const fold = E.fold;
  const today = () => PatOS.dateKey(new Date());
  const longDate = (key) => new Date(key + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const appName = (id) => (PatOS.apps[id] ? T(PatOS.apps[id].name) : id);

  /* ---------- 1. synonyms and slang → the words actions know ---------- */
  const SYN = [
    [/^(?:fire up|boot up|load up|pull up|bring up|crank up|get me|give me|i need|i want|lemme see|let me see|show me)\s+(?:the\s+)?(?=\w)/, 'open '],
    [/^(?:kill|shut|shut down|exit out of|get rid of)\s+(?=\w)/, 'close '],
    [/^(?:whip up|knock up|spin up|throw together|start a new|start new)\s+/, 'create '],
    [/^(?:jot down|write down|note down|remember that)\s+/, 'note: '],
    [/^(?:look up|hunt for|dig up|track down)\s+(?:my\s+)?(files?|documents?)\s+/, 'find $1 '],
    [/^(?:crank|pump)\s+(?:up\s+)?the volume(?:\s+up)?\s+to\s+/, 'set the volume to '],
    [/^(?:go dark|lights out|night mode on)$/, 'turn on dark mode'], [/^(?:lights on|go light)$/, 'turn on light mode'],
    [/^(?:mute|silence)(?: (?:the )?(?:sound|computer|pc))?$/, 'set the volume to 0'],
    [/^(?:quiet mode|leave me alone|no notifications|don't disturb me)$/, 'turn on do not disturb'],
    [/^(?:what's up|whats up|what's going on|anything new|quoi de neuf)$/, 'my day']
  ];
  I.hooks.normalize.push((raw) => { let t = fold(raw); for (const [re, rep] of SYN) if (re.test(t)) return t.replace(re, rep); return null; });

  /* ---------- 2. phrases you teach ---------- */
  const taught = () => PatOS.settings.intelPhrases || [];
  const setTaught = (l) => PatOS.setSetting('intelPhrases', l.slice(0, 50));
  I.hooks.normalize.unshift((raw) => { const t = fold(raw); const hit = taught().find((x) => x.phrase === t); return hit ? hit.command : null; });
  I.action({ id: 'mind.teach', title: 'Teach a phrase', description: 'A phrase of your own for a command PatOS already understands.', permission: null, priority: 60,
    params: { phrase: { type: 'string', required: true, max: 60 }, command: { type: 'string', required: true, max: 300 } }, examples: ['when I say homework time, start my study workspace'],
    match: (t, raw) => { const m = E.m(/^(?:when i say|if i say|whenever i say|quand je dis|si je dis)\s+["“']?([^,"”':=]+?)["”']?\s*(?:,|:|=|\s+then\s+|\s+do\s+|\s+it means\s+|\s+means\s+|\s+fais\s+)\s*(?:then\s+|do\s+|run\s+|please\s+|you should\s+|fais\s+)?(.+)$/i, raw); return m ? { phrase: fold(m[1]).trim(), command: m[2].trim() } : null; },
    run: ({ phrase, command }) => {
      if (phrase.length < 3) return { ok: false, message: L('Use a phrase of at least 3 letters.', 'Utilise une phrase d’au moins 3 lettres.') };
      const parts = splitCommands(command) || [command]; const bad = parts.filter((c) => { const p = I.parse(c, { raw: true }); return !p || p.guess || p.id === 'mind.teach'; });
      if (bad.length) return { ok: false, message: L('I can’t learn that: I don’t know how to “', 'Je ne peux pas apprendre ça : je ne sais pas « ') + bad[0] + L('” yet.', ' » pour l’instant.') };
      const l = taught().filter((x) => x.phrase !== phrase); l.push({ phrase, command }); setTaught(l);
      return { message: L(`Got it. When you say “${phrase}”, I’ll ${command}.`, `Compris. Quand tu diras « ${phrase} », je vais faire : ${command}.`), undo: () => { setTaught(taught().filter((x) => x.phrase !== phrase)); return L('Forgotten.', 'Oublié.'); } };
    } });
  I.action({ id: 'mind.forget', title: 'Forget a phrase', permission: null, priority: 60, params: { phrase: { type: 'string', required: true, max: 60 } }, examples: ['forget homework time'],
    match: (t) => { const m = /^(?:forget|unlearn|stop understanding|oublie)\s+["“']?(.+?)["”']?$/.exec(t); return m && taught().some((x) => x.phrase === m[1]) ? { phrase: m[1] } : null; },
    run: ({ phrase }) => { setTaught(taught().filter((x) => x.phrase !== phrase)); return L(`Forgotten: “${phrase}”.`, `Oublié : « ${phrase} ».`); } });
  I.action({ id: 'mind.taught', title: 'Phrases you taught', permission: null, priority: 60,
    match: (t) => (/^(?:what (?:have i|did i) taught you|what phrases do you know|my phrases|qu'est-ce que je t'ai appris)$/.test(t) ? {} : null),
    run: () => (taught().length ? L('You taught me:\n', 'Tu m’as appris :\n') + taught().map((x) => '• “' + x.phrase + '” → ' + x.command).join('\n') : L('Nothing yet. Try: “when I say homework time, start my study workspace”.', 'Rien pour l’instant. Essaie : « quand je dis devoirs, lance mon espace étude ».')) });

  /* ---------- 3. several commands in one request ---------- */
  function splitCommands(text) {
    const parts = String(text).split(/\s*(?:;|,\s*(?:and\s+|then\s+|et\s+|puis\s+)?|\s+(?:and then|and also|then|after that|and|puis|ensuite|et)\s+)\s*/i).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > 6) return null;
    // only when every part is a command on its own ("buy milk and eggs" stays one reminder)
    return parts.every((p) => { const x = I.parse(p); return x && !x.guess; }) ? parts : null;
  }
  I.hooks.before.push((text) => {
    if (/^(?:when i say|if i say|quand je dis|note:|take a note|write down|remind me|create a (?:reminder|shortcut)|cree un raccourci)/i.test(fold(text).trim())) return null; // (their own words may contain "and")
    const parts = splitCommands(I.prep(text)); if (!parts) return null;
    const out = []; let allOk = true;
    for (const p of parts) {
      let r = I.respond(p, { source: 'plan' });
      if (r && r.then) { out.push('… ' + p); r.then(() => {}, () => {}); continue; }
      if (!r) { allOk = false; out.push('✗ ' + p); continue; }
      if (r.status === 'confirm' || r.status === 'ask') { allOk = false; out.push('… ' + p + ' — ' + r.message); continue; }
      if (r.ok === false) allOk = false; out.push((r.ok === false ? '✗ ' : '✓ ') + r.message);
    }
    return { ok: allOk, status: allOk ? 'done' : 'failed', message: out.join('\n') };
  });

  /* ---------- 4. the conversation: what was just done and shown ---------- */
  const mem = { last: null, list: null, made: null };
  I.hooks.after.push((a, params, res) => {
    if (/^mind\.(again|follow|what)/.test(a.id) || a.id === 'intel.undo') return;
    if (res.ok !== false) mem.last = { id: a.id, params: Object.assign({}, params), t: Date.now(), message: res.message, title: a.title };
    const d = res.data || {};
    if (d.files) mem.list = { kind: 'file', items: d.files, t: Date.now() };
    if (a.id === 'reminders.create' && d.id) mem.made = { kind: 'reminder', id: d.id, t: Date.now() };
    if (a.id === 'calendar.create' && d.id) mem.made = { kind: 'event', id: d.id, day: d.day, t: Date.now() };
    if (a.id === 'folder.create' && d.path) mem.made = { kind: 'folder', path: d.path, t: Date.now() };
    if (a.id === 'maps.nearby' && d.places) mem.list = { kind: 'place', items: d.places, t: Date.now() };
  });
  const fresh = (x, mins) => x && Date.now() - x.t < (mins || 15) * 60 * 1000;
  I.action({ id: 'mind.again', title: 'Do it again', permission: null, priority: 58, match: (t) => (/^(?:do (?:it|that) again|again|repeat(?: that)?|one more time|encore|refais(?:-le)?|recommence)$/.test(t) && fresh(mem.last) ? {} : null),
    run: () => { const r = I.execute(mem.last.id, mem.last.params, { source: 'again' }); return r && r.then ? r : r; } });
  // "and tomorrow?", "what about friday?": the last question, for another day
  I.action({ id: 'mind.follow.day', title: 'The same, for another day', permission: null, priority: 58,
    match: (t) => { if (!fresh(mem.last) || !/^(?:reminders\.list|calendar\.list)$/.test(mem.last.id)) return null; const m = /^(?:and|what about|how about|and for|et|et pour)\s+(.+?)\??$/.exec(t); if (!m) return null; const d = E.dateOf('x ' + m[1]).due; return d ? { due: d } : null; },
    run: ({ due }) => (mem.last.id === 'calendar.list' ? I.execute('calendar.list', { day: due }, { source: 'follow' }) : I.execute('reminders.list', { due }, { source: 'follow' })) });
  // "move it to friday", "change it to 5pm": the reminder or event just made
  I.action({ id: 'mind.follow.move', title: 'Move what was just made', permission: 'reminders', priority: 58,
    match: (t, raw) => { if (!fresh(mem.made) || !/^(?:reminder|event)$/.test(mem.made.kind)) return null; const m = /^(?:move|change|reschedule|push|put)\s+(?:it|that)\s+(?:to|for|at|until)\s+(.+)$|^(?:deplace|change)[- ]le\s+(?:a|pour|au)\s+(.+)$/.exec(t); if (!m) return null; const p = E.dateOf('x ' + (m[1] || m[2])); return p.due || p.time ? { due: p.due || null, time: p.time || null } : null; },
    run: ({ due, time }) => {
      if (mem.made.kind === 'reminder') {
        const l = PatOS.store.get('reminders', []) || []; const r = l.find((x) => x.id === mem.made.id); if (!r) return { ok: false, message: L('That reminder isn’t there anymore.', 'Ce rappel n’existe plus.') };
        const old = { due: r.due, time: r.time }; if (due) r.due = due; if (time) { r.time = time; if (!due && !r.due) r.due = today(); } PatOS.store.set('reminders', l); PatOS.emit('reminders');
        return { message: L('Moved “', 'Déplacé : « ') + r.text + L('” to ', ' » au ') + longDate(r.due) + (r.time ? ' ' + r.time : '') + '.', undo: () => { const l2 = PatOS.store.get('reminders', []) || []; const x = l2.find((y) => y.id === mem.made.id); if (x) { x.due = old.due; x.time = old.time; PatOS.store.set('reminders', l2); PatOS.emit('reminders'); } return L('Put back.', 'Remis.'); } };
      }
      const cal = PatOS.store.get('calendar', {}) || {}; const day = mem.made.day; const ev = (cal[day] || []).find((e) => e.id === mem.made.id); if (!ev) return { ok: false, message: L('That event isn’t there anymore.', 'Cet événement n’existe plus.') };
      const to = due || day; cal[day] = cal[day].filter((e) => e.id !== ev.id); if (time) ev.time = time; (cal[to] = cal[to] || []).push(ev); PatOS.store.set('calendar', cal); PatOS.emit('calendar'); mem.made.day = to;
      return L('Moved “', 'Déplacé : « ') + ev.title + L('” to ', ' » au ') + longDate(to) + (ev.time ? ' ' + ev.time : '') + '.';
    } });
  I.action({ id: 'mind.follow.rename', title: 'Rename what was just made', permission: 'files.write', priority: 58,
    match: (t, raw) => { if (!fresh(mem.made) || mem.made.kind !== 'folder') return null; const m = E.m(/^(?:rename|call)\s+(?:it|that)\s+(?:to\s+)?["“']?([^"”'/]+?)["”']?$|^renomme[- ]le\s+(?:en\s+)?(.+)$/i, raw); return m ? { name: (m[1] || m[2]).trim() } : null; },
    run: ({ name }) => { const p = mem.made.path; if (!PatOS.fs.exists(p)) return { ok: false, message: L('That folder isn’t there anymore.', 'Ce dossier n’existe plus.') }; PatOS.fs.rename(p, name); const np = PatOS.fs.dirname(p) + '/' + name; const old = p; mem.made.path = np; return { message: L('Renamed to “', 'Renommé en « ') + name + L('”.', ' ».'), undo: () => { PatOS.fs.rename(np, PatOS.fs.basename(old)); return L('Name put back.', 'Nom remis.'); } }; } });
  I.action({ id: 'mind.follow.delete', title: 'Delete what was just made', permission: null, priority: 57,
    match: (t) => (/^(?:delete|remove|cancel|scrap|undo)\s+(?:it|that|this|that one)$|^(?:supprime|efface|annule)[- ]le$/.test(t) && I.undoAvailable() ? {} : null),
    run: () => I.undo() });
  // "open it", "the second one": the files or places just shown
  const ORD = { first: 0, '1st': 0, one: 0, premier: 0, second: 1, '2nd': 1, two: 1, deuxieme: 1, third: 2, '3rd': 2, three: 2, troisieme: 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4, last: -1, dernier: -1 };
  I.action({ id: 'mind.follow.pick', title: 'Open one of what was shown', permission: 'files', priority: 34,
    match: (t) => { if (!fresh(mem.list) || !mem.list.items.length) return null; const m = /^(?:open|show|go to|take me to|bring me to|ouvre)?\s*(?:it|that|the|le|la)?\s*(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|premier|deuxieme|troisieme|dernier|one|two|three)?\s*(?:one|un|file|place|result)?$/.exec(t); if (!m || (!m[1] && !/^(?:open|ouvre) (?:it|that|le|la)$/.test(t))) return null; let i = m[1] ? ORD[m[1]] : 0; if (i < 0) i = mem.list.items.length - 1; return i < mem.list.items.length ? { i } : null; },
    run: ({ i }) => { const it = mem.list.items[i];
      if (mem.list.kind === 'file') { PatOS.openFile(it); return L('Opened ', 'Ouvert : ') + PatOS.fs.basename(it) + '.'; }
      PatOS.launch('maps', { lat: it.lat, lon: it.lon, label: it.name, query: it.name }); return L('Here’s ', 'Voici ') + it.name + (it.distance != null ? ' (' + PatOS.places.fmtDistance(it.distance) + ')' : '') + '.'; } });
  I.action({ id: 'mind.what', title: 'What was just done', permission: null, priority: 58,
    match: (t) => (/^(?:what did (?:you|i) (?:just )?do|what was that|what just happened|qu'est-ce que tu as fait|tu as fait quoi)$/.test(t) ? {} : null),
    run: () => { const h = I.history().filter((x) => !/^mind\.what$/.test(x.id)).slice(-3).reverse(); return h.length ? L('Most recent first:\n', 'Du plus récent :\n') + h.map((x) => (x.ok ? '✓ ' : '✗ ') + T(x.title) + (x.message ? ' — ' + x.message.split('\n')[0] : '')).join('\n') : L('Nothing yet.', 'Rien pour l’instant.'); } });

  /* ---------- 5. questions about this PatOS ---------- */
  const fmtBytes = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : Math.round(n / 1e6) + ' MB');
  I.action({ id: 'know.storage', title: 'Storage left', permission: null, priority: 44, examples: ['how much storage do I have left'],
    match: (t) => (/^(?:how much (?:storage|space|room)(?: do i have| is (?:left|used|free)| left| free)?(?: left)?|storage (?:left|space)|am i (?:running )?out of (?:space|storage)|combien (?:d'espace|de stockage)(?: me reste)?)/.test(t) ? {} : null),
    run: async () => { if (!navigator.storage || !navigator.storage.estimate) return { ok: false, message: L('This browser doesn’t say how much space is left.', 'Ce navigateur ne dit pas combien d’espace il reste.') }; const e = await navigator.storage.estimate(); const free = Math.max(0, (e.quota || 0) - (e.usage || 0));
      return L(`PatOS uses ${fmtBytes(e.usage || 0)}; about ${fmtBytes(free)} more is available to it (the browser’s estimate).`, `PatOS utilise ${fmtBytes(e.usage || 0)}; environ ${fmtBytes(free)} de plus lui est disponible (estimation du navigateur).`); } });
  I.action({ id: 'know.version', title: 'PatOS version', permission: null, priority: 44, match: (t) => (/^(?:what|which) version(?: of patos)?(?: am i on| is this| do i have)?|^(?:patos )?version$|^quelle version/.test(t) ? {} : null),
    run: () => { const b = PatOS.build || {}; return b.channel === 'beta' ? L('You’re on PatOS ', 'Tu as PatOS ') + b.version + ' beta ' + b.beta + '.' : L('You’re on PatOS ', 'Tu as PatOS ') + PatOS.version + '.'; } });
  I.action({ id: 'know.online', title: 'Am I online', permission: null, priority: 44, match: (t) => (/^(?:am i (?:online|connected|offline)|is (?:the )?internet (?:working|on|down)|do i have internet|suis-je (?:en ligne|connecte))$/.test(t) ? {} : null),
    run: () => (navigator.onLine === false ? L('You’re offline. PatOS keeps working; things that need the internet wait.', 'Tu es hors ligne. PatOS continue de marcher; ce qui demande Internet attend.') : L('You’re online.', 'Tu es en ligne.')) });
  I.action({ id: 'know.sync', title: 'Is Sync on', permission: null, priority: 44, match: (t) => (/^(?:is (?:sync|syncing) (?:on|working)|am i (?:syncing|signed in)|sync status|est-ce que sync marche)$/.test(t) ? {} : null),
    run: () => { const s = PatOS.sync && PatOS.sync.status(); const a = PatOS.account && PatOS.account.status(); if (!s || !s.on) return L('Sync is off. Turn it on in Settings › Account & Continuity.', 'Sync est désactivé. Active-le dans Réglages › Compte et continuité.'); return (s.error ? L('Sync has a problem: ', 'Sync a un problème : ') + s.error : L('Sync is on and working', 'Sync est activé et marche') + (s.last ? L(', last saved ', ', dernier enregistrement ') + new Date(s.last).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }) : '') + '.') + (a && a.signedIn ? ' (@' + a.username + ')' : ''); } });
  I.action({ id: 'know.battery', title: 'Battery', permission: null, priority: 44, match: (t) => (/^(?:what(?:'s| is) (?:my |the )?battery(?: level)?|how much battery(?: do i have)?(?: left)?|battery(?: level)?|batterie)$/.test(t) ? {} : null),
    run: async () => { if (!navigator.getBattery) return { ok: false, message: L('This browser doesn’t share the battery level.', 'Ce navigateur ne partage pas le niveau de la batterie.') }; const b = await navigator.getBattery(); return L('Battery: ', 'Batterie : ') + Math.round(b.level * 100) + '%' + (b.charging ? L(', charging.', ', en charge.') : '.'); } });
  const COUNTS = { notes: () => (PatOS.store.get('notes', []) || []).filter((n) => !n.deletedAt).length, reminders: () => (PatOS.store.get('reminders', []) || []).filter((r) => !r.done).length, files: () => { let n = 0; PatOS.fs.walk('/', (p, nd) => { if (nd.type === 'file' && !/^\/(\.Trash|System)(\/|$)/.test(p)) n++; }); return n; },
    apps: () => PatOS.appOrder.filter((k) => PatOS.apps[k] && !PatOS.apps[k].hidden).length, shortcuts: () => (PatOS.shortcuts ? PatOS.shortcuts.list().length : 0), contacts: () => (PatOS.store.get('contacts', []) || []).length, photos: () => { let n = 0; PatOS.fs.walk('/Pictures', (p, nd) => { if (nd.type === 'file') n++; }); return n; } };
  const COUNT_FR = { notes: 'notes', reminders: 'rappels', files: 'fichiers', apps: 'apps', shortcuts: 'raccourcis', contacts: 'contacts', photos: 'photos' };
  I.action({ id: 'know.count', title: 'How many', permission: null, priority: 44, examples: ['how many notes do I have'],
    match: (t) => { const m = /^how many (notes|reminders|files|apps|applications|shortcuts|contacts|photos|pictures)(?: do i have)?(?: open)?$|^combien (?:de |d')(notes|rappels|fichiers|apps|raccourcis|contacts|photos)/.exec(t); if (!m) return null; const k = { applications: 'apps', pictures: 'photos', rappels: 'reminders', fichiers: 'files', raccourcis: 'shortcuts' }[m[1] || m[2]] || m[1] || m[2]; return COUNTS[k] ? { what: k } : null; },
    run: ({ what }) => { const n = COUNTS[what](); return L(`You have ${n} ${what}${what === 'reminders' ? ' to do' : ''}.`, `Tu as ${n} ${COUNT_FR[what]}${what === 'reminders' ? ' à faire' : ''}.`); } });
  function upcoming(days) { const cal = PatOS.store.get('calendar', {}) || {}; const out = []; const now = new Date(); const nowKey = today(), nowHM = now.toTimeString().slice(0, 5);
    for (let i = 0; i <= days; i++) { const d = new Date(); d.setDate(d.getDate() + i); const k = PatOS.dateKey(d); const evs = PatOS.calendarOn ? PatOS.calendarOn(d) : (cal[k] || []); evs.forEach((e) => { if (k === nowKey && e.time && e.time < nowHM) return; out.push({ day: k, time: e.time || '', title: e.title }); }); }
    return out.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time)); }
  I.action({ id: 'know.next', title: 'Your next event', permission: 'calendar', priority: 44, examples: ['when is my next event'],
    match: (t) => (/^(?:when(?:'s| is) my next (?:event|meeting|appointment|class)|what(?:'s| is) next(?: on my calendar)?|what's my next (?:event|meeting|appointment)|(?:my )?next (?:event|meeting|appointment)|c'est quoi mon prochain evenement)$/.test(t) ? {} : null),
    run: () => { const n = upcoming(60)[0]; if (!n) return L('Nothing on your calendar in the next two months.', 'Rien dans ton calendrier pour les deux prochains mois.'); return L('Next: ', 'Prochain : ') + n.title + ' — ' + longDate(n.day) + (n.time ? ' ' + L('at', 'à') + ' ' + n.time : '') + '.'; } });
  I.action({ id: 'know.week', title: 'This week', permission: 'reminders', priority: 44, examples: ['what’s due this week'],
    match: (t) => (/^(?:what(?:'s| is) (?:due|on|happening|coming up)(?: for me)? this week|what do i have this week|my week|this week|cette semaine|ma semaine)$/.test(t) ? {} : null),
    run: () => { const end = new Date(); end.setDate(end.getDate() + 7); const ek = PatOS.dateKey(end); const rem = (PatOS.store.get('reminders', []) || []).filter((r) => !r.done && r.due && r.due <= ek).sort((a, b) => a.due.localeCompare(b.due)); const evs = upcoming(7);
      if (!rem.length && !evs.length) return L('Nothing due and nothing planned in the next 7 days.', 'Rien à faire et rien de prévu dans les 7 prochains jours.');
      return (evs.length ? L('Events:\n', 'Événements :\n') + evs.slice(0, 8).map((e) => '• ' + new Date(e.day + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'short' }) + (e.time ? ' ' + e.time : '') + ' — ' + e.title).join('\n') : '') + (evs.length && rem.length ? '\n' : '') + (rem.length ? L('Due:\n', 'À faire :\n') + rem.slice(0, 8).map((r) => '• ' + new Date(r.due + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'short' }) + ' — ' + r.text).join('\n') : ''); } });
  const HOLI = { christmas: '12-25', noel: '12-25', 'new year': '01-01', "new year's": '01-01', 'jour de l\'an': '01-01', halloween: '10-31', valentine: '02-14', "valentine's day": '02-14', 'saint-valentin': '02-14', 'canada day': '07-01', 'fete du canada': '07-01', 'st patrick': '03-17', 'independence day': '07-04' };
  function dayOf(w) { w = fold(w).replace(/[?.!]$/, '').replace(/^(?:the\s+)/, '').trim(); const h = HOLI[w]; if (h) { const y = new Date().getFullYear(); let k = y + '-' + h; if (k < today()) k = (y + 1) + '-' + h; return k; } return E.dateOf('x ' + w).due || null; }
  I.action({ id: 'know.until', title: 'Days until a date', permission: null, priority: 45, examples: ['how many days until christmas'],
    match: (t) => { const m = /^(?:how many (?:days|sleeps) (?:until|till|before|to)|how long until|combien de jours (?:avant|jusqu'a))\s+(.+?)\??$/.exec(t); if (!m) return null; const k = dayOf(m[1]); return k ? { day: k, label: m[1] } : null; },
    run: ({ day, label }) => { const n = Math.round((new Date(day + 'T12:00') - new Date(today() + 'T12:00')) / 864e5); return n === 0 ? L('That’s today!', 'C’est aujourd’hui!') : n > 0 ? L(`${n} day${n === 1 ? '' : 's'} until ${label} (${longDate(day)}).`, `${n} jour${n > 1 ? 's' : ''} avant ${label} (${longDate(day)}).`) : L(`That was ${-n} days ago.`, `C’était il y a ${-n} jours.`); } });
  I.action({ id: 'know.dayof', title: 'What day a date is', permission: null, priority: 45, examples: ['what day is christmas'],
    match: (t) => { const m = /^what day (?:is|was|will be|does)\s+(.+?)(?:\s+(?:fall on|on))?\??$|^quel jour (?:est|tombe)\s+(.+?)\??$/.exec(t); if (!m) return null; const k = dayOf(m[1] || m[2]); return k ? { day: k } : null; },
    run: ({ day }) => { const s = longDate(day); return s.charAt(0).toUpperCase() + s.slice(1) + ', ' + day.slice(0, 4) + '.'; } });
  const ZONES = { tokyo: 'Asia/Tokyo', london: 'Europe/London', londres: 'Europe/London', paris: 'Europe/Paris', 'new york': 'America/New_York', 'new-york': 'America/New_York', montreal: 'America/Toronto', toronto: 'America/Toronto', vancouver: 'America/Vancouver', 'los angeles': 'America/Los_Angeles', la: 'America/Los_Angeles', chicago: 'America/Chicago', sydney: 'Australia/Sydney', beijing: 'Asia/Shanghai', pekin: 'Asia/Shanghai', shanghai: 'Asia/Shanghai', 'hong kong': 'Asia/Hong_Kong', seoul: 'Asia/Seoul', dubai: 'Asia/Dubai', moscow: 'Europe/Moscow', moscou: 'Europe/Moscow', berlin: 'Europe/Berlin', madrid: 'Europe/Madrid', rome: 'Europe/Rome', mexico: 'America/Mexico_City', 'mexico city': 'America/Mexico_City', 'sao paulo': 'America/Sao_Paulo', cairo: 'Africa/Cairo', 'le caire': 'Africa/Cairo', delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', singapore: 'Asia/Singapore', singapour: 'Asia/Singapore', honolulu: 'Pacific/Honolulu', quebec: 'America/Toronto', calgary: 'America/Edmonton', halifax: 'America/Halifax', lisbon: 'Europe/Lisbon', lisbonne: 'Europe/Lisbon' };
  I.action({ id: 'know.time.zone', title: 'The time in another city', permission: null, priority: 46, examples: ['what time is it in Tokyo'],
    match: (t) => { const m = /^(?:what(?:'s| is) the time|what time is it|time) in\s+(.+?)\??$|^quelle heure est-il (?:a|en)\s+(.+?)\??$/.exec(t); if (!m) return null; const z = ZONES[(m[1] || m[2]).trim()]; return z ? { zone: z, city: (m[1] || m[2]).trim() } : null; },
    run: ({ zone, city }) => { const s = new Date().toLocaleTimeString(PatOS.locale, { timeZone: zone, hour: 'numeric', minute: '2-digit', weekday: 'long' }); return L(`In ${city.replace(/\b\w/g, (c) => c.toUpperCase())} it’s ${s}.`, `À ${city.replace(/\b\w/g, (c) => c.toUpperCase())}, il est ${s}.`); } });
  I.action({ id: 'know.name', title: 'Your name', permission: 'settings', priority: 44, params: { name: { type: 'string', max: 40 } },
    match: (t, raw) => { if (/^(?:what(?:'s| is) my name|who am i|comment je m'appelle)$/.test(t)) return {}; const m = E.m(/^(?:call me|my name is|je m'appelle|appelle-moi)\s+([\p{L}' -]{1,40})$/iu, raw); return m ? { name: m[1].trim() } : null; },
    run: ({ name }) => { if (!name) return L('You’re ', 'Tu es ') + PatOS.settings.userName + '.'; const old = PatOS.settings.userName; PatOS.setSetting('userName', name); return { message: L(`Nice to meet you, ${name}.`, `Enchanté, ${name}.`), undo: () => { PatOS.setSetting('userName', old); return L('Name put back.', 'Nom remis.'); } }; } });

  /* ---------- 6. places (js/places.js) ---------- */
  const P = () => PatOS.places;
  const KINDS = { gym: 'gym fitness', gyms: 'gym fitness', 'gym fitness': 'gym fitness', pharmacy: 'pharmacy', pharmacie: 'pharmacy', drugstore: 'pharmacy', hospital: 'hospital', hopital: 'hospital', 'gas station': 'fuel', 'gas': 'fuel', 'essence': 'fuel', 'coffee shop': 'cafe', coffee: 'cafe', cafe: 'cafe', restaurant: 'restaurant', resto: 'restaurant', grocery: 'supermarket', 'grocery store': 'supermarket', supermarket: 'supermarket', epicerie: 'supermarket', library: 'library', bibliotheque: 'library', park: 'park', parc: 'park', bank: 'bank', banque: 'bank', atm: 'atm', school: 'school', ecole: 'school', 'bus stop': 'bus stop', arret: 'bus stop', 'metro': 'subway station', 'subway': 'subway station', mcdonalds: "McDonald's", "mcdonald's": "McDonald's", 'tim hortons': 'Tim Hortons', 'tims': 'Tim Hortons', starbucks: 'Starbucks', pizza: 'pizza', 'ice cream': 'ice cream', 'movie theater': 'cinema', cinema: 'cinema', dentist: 'dentist', 'police station': 'police', police: 'police', 'post office': 'post office' };
  const kindOf = (w) => { w = fold(w).replace(/^(?:a|an|the|un|une|le|la)\s+/, '').trim(); return KINDS[w] || (w.length >= 3 && w.length <= 30 ? w : null); };
  I.action({ id: 'maps.nearby', title: 'Find the nearest place', description: 'Finds the closest place of a kind near you (OpenStreetMap), shows it in Maps, and opens directions when you ask to go there.', permission: 'apps', online: true, priority: 47, params: { what: { type: 'string', required: true, max: 40 }, go: { type: 'boolean' } },
    examples: ['bring me to the nearest gym', 'find a pharmacy near me', 'where is the closest coffee shop'],
    match: (t) => {
      let m = /^(?:bring|take|get|lead|guide|navigate|drive|walk)\s+me\s+to\s+(?:the\s+)?(?:nearest|closest)\s+(.+)$|^(?:emmene-moi|amene-moi|conduis-moi)\s+(?:au|a la|a l')\s*(?:plus proche\s+)?(.+?)(?:\s+le plus proche|\s+la plus proche)?$|^(?:directions|route|way) to (?:the )?(?:nearest|closest)\s+(.+)$/.exec(t);
      if (m) { const k = kindOf(m[1] || m[2] || m[3]); return k ? { what: k, go: true } : null; }
      m = /^(?:where(?:'s| is) the|find (?:the|a|me a)|show me (?:the|a)|is there an?|any)\s+(?:nearest|closest)?\s*(.+?)\s*(?:near me|nearby|around here|close by|near here)?\??$/.exec(t);
      if (m && /nearest|closest|near me|nearby|around here|close by|near here/.test(t)) { const k = kindOf(m[1]); return k ? { what: k } : null; }
      m = /^(?:nearest|closest)\s+(.+?)\??$|^(.+?)\s+(?:near me|nearby|around here)\??$|^(?:trouve|cherche)\s+(?:un|une|le|la)\s+(.+?)\s+(?:pres de moi|proche|a proximite)$/.exec(t);
      if (m) { const k = kindOf(m[1] || m[2] || m[3]); return k ? { what: k } : null; }
      return null;
    },
    run: async ({ what, go }) => {
      let r; try { r = await P().nearby(what); } catch (e) { return { ok: false, message: e.message }; }
      if (!r.places.length) return { ok: false, message: L(`I couldn’t find a ${what} within about 15 km of you on OpenStreetMap.`, `Je n’ai pas trouvé de ${what} à moins d’environ 15 km de toi sur OpenStreetMap.`), data: { places: [] } };
      const best = r.places[0]; PatOS.launch('maps', { lat: best.lat, lon: best.lon, label: best.name + (best.address ? ', ' + best.address : ''), query: what });
      let msg = L(`The nearest ${what} is ${best.name}, ${P().fmtDistance(best.distance)} away`, `${what} le plus proche : ${best.name}, à ${P().fmtDistance(best.distance)}`) + (best.address ? ' (' + best.address + ')' : '') + '.';
      if (go) { P().directions(best, r.at); msg += L(' Directions are open in Google Maps.', ' L’itinéraire est ouvert dans Google Maps.'); }
      else if (r.places.length > 1) msg += L('\nAlso: ', '\nAussi : ') + r.places.slice(1, 4).map((p, i) => (i + 2) + '. ' + p.name + ' (' + P().fmtDistance(p.distance) + ')').join(', ') + L('. Say “the second one” to see it, or “take me there”.', '. Dis « le deuxième » pour le voir, ou « emmène-moi là ».');
      return { message: msg, data: { places: r.places.slice(0, 5) } };
    } });
  I.action({ id: 'maps.there', title: 'Directions to the place just shown', permission: 'apps', online: true, priority: 58,
    match: (t) => (/^(?:take me there|bring me there|go there|directions(?: there)?|how do i get there|navigate there|emmene-moi la|amene-moi la|itineraire)$/.test(t) && fresh(mem.list) && mem.list.kind === 'place' && mem.list.items.length ? {} : null),
    run: async () => { const p = mem.list.items[0]; let at = null; try { at = await P().locate(); } catch (e) {} P().directions(p, at); return L('Directions to ', 'Itinéraire vers ') + p.name + L(' are open in Google Maps.', ' ouvert dans Google Maps.'); } });
  I.action({ id: 'maps.directions', title: 'Directions to a place', permission: 'apps', online: true, priority: 30, params: { to: { type: 'string', required: true, max: 120, ask: ['Where to?', 'Où ça?'] } }, examples: ['directions to the Eiffel Tower', 'how do I get to Union Station'],
    match: (t, raw) => { const m = E.m(/^(?:directions|route|itinerary|itineraire|the way)\s+(?:to|for|vers|pour)\s+(.+)$|^(?:how do i get to|how to get to|take me to|bring me to|navigate to|drive me to|walk me to|comment aller (?:a|au|a la))\s+(.+)$|^(?:emmene-moi|amene-moi)\s+(?:a|au|a la|chez)\s+(.+)$/i, raw); if (!m) return null; const to = (m[1] || m[2] || m[3]).trim(); if (E.findApp(to) || /nearest|closest|plus proche/.test(fold(to))) return null; return { to }; },
    run: async ({ to }) => {
      let at = null; try { at = await P().locate(); } catch (e) {}
      let l = []; try { l = await P().search(to, at, 5); if (!l.length && at) l = await P().search(to, null, 5); } catch (e) { return { ok: false, message: e.message }; }
      if (!l.length) return { ok: false, message: L(`I couldn’t find “${to}” on the map.`, `Je n’ai pas trouvé « ${to} » sur la carte.`) };
      const p = at ? l.sort((a, b) => (a.distance || 0) - (b.distance || 0))[0] : l[0];
      P().directions(p, at); PatOS.launch('maps', { lat: p.lat, lon: p.lon, label: p.name + (p.address ? ', ' + p.address : ''), query: to });
      return { message: L('Directions to ', 'Itinéraire vers ') + p.name + (p.distance != null ? ' (' + P().fmtDistance(p.distance) + ')' : '') + L(' are open in Google Maps.', ' ouvert dans Google Maps.'), data: { places: [p] } };
    } });
  I.action({ id: 'maps.show', title: 'Show a place on the map', permission: 'apps', online: true, priority: 29, params: { q: { type: 'string', required: true, max: 120 } }, examples: ['show Paris on the map', 'where is the Eiffel Tower'],
    match: (t, raw) => { const m = E.m(/^(?:show|find|locate|montre|trouve)\s+(.+?)\s+on (?:the|a) map$|^(?:map of|where is|where's|ou est|ou se trouve)\s+(.+?)\??$/i, raw); if (!m) return null; const q = (m[1] || m[2]).trim(); return /^(?:the )?(?:nearest|closest)|\bmy\b|reduce|setting|reglage/.test(fold(q)) ? null : { q }; },
    run: async ({ q }) => { let l; try { l = await P().search(q, null, 1); } catch (e) { return { ok: false, message: e.message }; } if (!l.length) return { ok: false, message: L(`I couldn’t find “${q}” on the map.`, `Je n’ai pas trouvé « ${q} » sur la carte.`) }; const p = l[0]; PatOS.launch('maps', { lat: p.lat, lon: p.lon, label: p.name + (p.address ? ', ' + p.address : ''), query: q, zoom: 0.03 }); return { message: L('Here’s ', 'Voici ') + p.name + (p.address ? ', ' + p.address : '') + '.', data: { places: [p] } }; } });
  I.action({ id: 'maps.here', title: 'Where am I', permission: 'apps', online: true, priority: 46, examples: ['where am I'],
    match: (t) => (/^(?:where am i|where are we|what(?:'s| is) my (?:location|address)|ou suis-je|ou je suis)$/.test(t) ? {} : null),
    run: async () => { let at; try { at = await P().locate({ fresh: true }); } catch (e) { return { ok: false, message: e.message }; } let r = null; try { r = await P().reverse(at); } catch (e) {} PatOS.launch('maps', { lat: at.lat, lon: at.lon, label: r ? r.name + ', ' + r.address : L('You are here', 'Tu es ici') }); return r ? L('You’re near ', 'Tu es près de ') + r.name + (r.address ? ', ' + r.address : '') + '.' : L('Here’s where you are on the map.', 'Voici où tu es sur la carte.'); } });

  /* ---------- 7. guesses ("Did you mean…?") and the closest examples ---------- */
  const STOP = new Set(['the', 'a', 'an', 'my', 'me', 'to', 'please', 'for', 'of', 'on', 'in', 'is', 'it', 'and', 'i', 'can', 'you', 'le', 'la', 'les', 'de', 'du', 'un', 'une', 'mon', 'ma', 'mes', 'moi', 'et']);
  const stem = (w) => w.replace(/(?:ing|ed|es|s)$/, '');
  const words = (t) => fold(t).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);
  function closest(text, n) {
    const q = words(text); if (!q.length) return [];
    const out = [];
    I.list().forEach((a) => a.examples.forEach((ex) => { const w = words(ex); let hit = 0; q.forEach((x) => { if (w.some((y) => y === x || (x.length > 3 && E.lev(x, y) <= 1))) hit++; }); const sc = hit / Math.max(q.length, w.length); if (hit) out.push({ id: a.id, ex, sc, simple: !Object.values(a.params).some((p) => p.required) }); }));
    return out.sort((a, b) => b.sc - a.sc).filter((x, i, l) => l.findIndex((y) => y.id === x.id) === i).slice(0, n || 3);
  }
  // only simple commands (nothing to fill in) are offered as a guess, and only when most words match
  I.hooks.fallback.push((t) => { const c = closest(t, 1)[0]; if (!c || !c.simple || c.sc < 0.6) return null; const p = I.parse(c.ex, { raw: true }); return p && !p.guess ? { id: p.id, params: p.params, say: c.ex } : null; });
  I.closest = (text, n) => closest(text, n).map((x) => x.ex);

  /* ---------- 8. suggestions: what you usually do now, what's due, what's next ---------- */
  I.suggestions = function (n) {
    const out = []; const add = (s) => { if (s && !out.includes(s)) out.push(s); };
    const k = today(); if ((PatOS.store.get('reminders', []) || []).some((r) => !r.done && r.due && r.due <= k)) add(L('my reminders', 'mes rappels'));
    const nx = upcoming(0)[0]; if (nx) add(L('when is my next event', 'mon prochain événement'));
    if (I.undoAvailable()) add(L('undo', 'annule'));
    // the apps you open most at this hour (Timeline, on this device)
    if (PatOS.timeline) { const hr = new Date().getHours(); const c = {}; PatOS.timeline.events().forEach((e) => { if (e.k === 'app' && e.ref && new Date(e.t).getHours() === hr) c[e.ref.app] = (c[e.ref.app] || 0) + (e.n || 1); });
      Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([id]) => { if (PatOS.apps[id]) add(L('open ', 'ouvre ') + fold(appName(id))); }); }
    taught().slice(-1).forEach((x) => add(x.phrase));
    return out.slice(0, n || 4);
  };
})();
