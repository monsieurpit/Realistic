/* Messages — chat with Pat, a command helper built into PatOS.
   Pat is not an AI: it recognizes a fixed list of commands (open an app, math, reminders, notes,
   time and date, a few settings) and answers from that list. Everything runs on the device. */
(function () {
  'use strict';
  const { h } = PatOS;
  const JOKES = ['Why did the computer go to the doctor? It had a virus.', 'Why do programmers prefer dark mode? Because light attracts bugs.', 'What do you call a dinosaur that codes? A Typo-saurus.', 'Why was the math book sad? It had too many problems.', 'How does the moon cut its hair? Eclipse it.', 'I would tell you a UDP joke, but you might not get it.'];
  const FACTS = ['A day on Venus is longer than a year on Venus.', 'Octopuses have three hearts.', 'Honey never spoils. Archaeologists have found 3,000-year-old honey that is still edible.', 'The Eiffel Tower can be about 15 cm taller in summer because the metal expands.', 'There are more possible chess games than atoms in the observable universe.', 'Bananas are berries, but strawberries are not.'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const FR = () => PatOS.lang === 'fr';
  const L = (en, fr) => (FR() ? fr : en);
  const JOKES_FR = ['Pourquoi l’ordinateur est-il allé chez le médecin? Il avait un virus.', 'Pourquoi les programmeurs aiment le mode sombre? Parce que la lumière attire les bogues.', 'Que dit un zéro à un huit? Belle ceinture!', 'Pourquoi le livre de maths est triste? Il a trop de problèmes.', 'Quel est le comble pour un électricien? De ne pas être au courant.'];
  const FACTS_FR = ['Une journée sur Vénus dure plus longtemps qu’une année sur Vénus.', 'Les pieuvres ont trois cœurs.', 'Le miel ne se gâte jamais. On a trouvé du miel de 3 000 ans encore mangeable.', 'La tour Eiffel peut grandir d’environ 15 cm en été parce que le métal se dilate.', 'Les bananes sont des baies, mais pas les fraises.'];
  /* French commands are turned into the matching English command first */
  function fromFrench(t) {
    const rules = [[/^(?:mets|règle|regle|programme)\s+un\s+minuteur\s+(?:de|pour)\s+(.+)/i, 'timer $1'], [/^minuteur\s+(?:de\s+)?(.+)/i, 'timer $1'], [/^(?:réveille-moi|reveille-moi|mets un réveil|mets un reveil)\s+(?:à|a)\s+(\d{1,2})\s*(?:h|:)?\s*(\d{2})?\s*$/i, (m) => 'wake me at ' + m[1] + ':' + (m[2] || '00')],
      [/^(?:qu['’]est-ce que j['’]ai|mon calendrier|mon horaire|mon agenda)\s*(?:aujourd['’]hui|demain)?/i, (m, t) => 'calendar ' + (/demain/i.test(t) ? 'tomorrow' : 'today')], [/^(?:ajoute|ajouter|crée|cree)\s+(?:un\s+)?(?:événement|evenement)\s*:?\s*(.+)/i, 'add event $1'], [/^(?:mes rappels|qu['’]est-ce que j['’]ai à faire|quoi à faire)/i, 'my reminders'],
      [/^convertis?\s+(.+)/i, '$1'], [/^(?:trouve|cherche)\s+(?:le\s+)?fichier\s+(.+)/i, 'find file $1'], [/^ouvre\s+(?:le\s+)?fichier\s+(.+)/i, 'open file $1'], [/^(?:choisis|choisi)\s+(?:entre\s+)?(.+)/i, 'pick $1'], [/^(?:efface|vide)\s+(?:la\s+)?conversation$/i, 'clear'],[/^(salut|bonjour|allo|allô|coucou)\b.*/i, 'hi'], [/^(aide|que peux-tu faire|qu'est-ce que tu peux faire).*/i, 'help'], [/^(ouvre|ouvrir|lance|lancer|démarre)\s+(?:l'|l’|la |le |les )?(.+)/i, 'open $2'],
      [/quelle heure/i, 'time'], [/quel jour|quelle date|la date/i, 'date'], [/^(rappelle-moi|rappelle moi)\s+(?:de |d'|d’)?(.+)/i, 'remind me to $2'], [/^(?:prends une note|note)\s*:?\s*(.+)/i, 'note: $1'],
      [/blague/i, 'joke'], [/anecdote|fait amusant|un fait/i, 'fact'], [/pile ou face/i, 'flip a coin'], [/lance (?:un |le )?dé/i, 'roll a die'], [/mode sombre/i, 'dark mode'], [/mode clair/i, 'light mode'],
      [/fond d.?écran/i, 'wallpaper'], [/(joue|mets) (de la musique|une chanson)/i, 'play music'], [/météo/i, 'weather'], [/merci/i, 'thanks'], [/qui es-tu|ton nom/i, 'who are you'], [/comment (ça|ca) va|ça va\?/i, 'how are you'],
      [/^(cherche|recherche)\s+(.+)/i, 'search $2'], [/^(définis|définition de|que veut dire)\s+(.+)/i, 'define $2'], [/liste des apps|quelles apps/i, 'list apps'], [/^combien (font|fait)\s+(.+)/i, '$2']];
    for (const [re, rep] of rules) if (re.test(t)) return typeof rep === 'function' ? rep(re.exec(t), t) : t.replace(re, rep);
    return t;
  }
  /* ---------- what Pat can do ----------
     Pat is a command helper, not an AI: it matches what you type against a fixed list of commands. */
  const today = () => PatOS.dateKey(new Date());
  const fmtTime = (hm) => { const [h2, m2] = hm.split(':').map(Number); const d = new Date(); d.setHours(h2, m2, 0, 0); return d.toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }); };
  function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
  const appNames = (k) => [PatOS.apps[k].name.toLowerCase(), PatOS.t(PatOS.apps[k].name).toLowerCase()];
  function findApp(q) {
    q = q.toLowerCase().replace(/[.!?]$/, '').replace(/^(the|my|le|la|les|l['’])\s*/, '').trim(); if (!q) return null;
    const ids = PatOS.appOrder.filter((k) => PatOS.apps[k] && !PatOS.apps[k].hidden);
    return ids.find((k) => appNames(k).includes(q) || k === q) || ids.find((k) => appNames(k).some((n) => n.startsWith(q))) || ids.find((k) => appNames(k).some((n) => n.includes(q)));
  }
  function suggestApp(q) {
    q = q.toLowerCase().trim(); let best = null, bd = 3;
    PatOS.appOrder.filter((k) => PatOS.apps[k] && !PatOS.apps[k].hidden).forEach((k) => appNames(k).forEach((n) => { const d = lev(q, n); if (d < bd && d <= Math.max(1, Math.floor(n.length / 3))) { bd = d; best = k; } }));
    return best;
  }
  function findFiles(q) {
    q = q.toLowerCase().trim(); const out = [];
    PatOS.fs.walk('/', (p, n) => { if (!p.startsWith('/.Trash') && n.type === 'file' && PatOS.fs.basename(p).toLowerCase().includes(q)) out.push(p); });
    return out;
  }
  function reply(text) {
    let t = text.trim(); if (FR()) t = fromFrench(t);
    const l = t.toLowerCase(); let m;
    const name = PatOS.settings.userName;
    if (/^(hi|hey|hello|yo|sup)\b/.test(l)) return L(`Hey ${name}. What do you need? I can open an app, set a timer, check your calendar, do a quick calculation, add a reminder, or just tell you a bad joke. Type "help" for the full list.`, `Salut ${name}. Qu’est-ce qu’il te faut? Je peux ouvrir une app, mettre un minuteur, regarder ton calendrier, faire un calcul, ajouter un rappel ou te raconter une mauvaise blague. Écris « aide » pour la liste complète.`);
    if (/\bhelp\b|what can you do/.test(l)) return L('Here’s what you can ask me (I follow a list of commands, I’m not an AI):\n• open galaxy\n• timer 10 min\n• wake me at 7:30\n• what’s on my calendar today?\n• add event math test friday 2pm\n• my reminders\n• remind me to study for math\n• note: buy pencils\n• 24 * 17 + 3   ·   15% of 80\n• 5 km to mi   ·   20 c to f\n• find file essay\n• pick pizza or tacos\n• what time is it?   ·   tell me a joke / a fact\n• flip a coin / roll a die\n• dark mode / light mode / change wallpaper\n• play music   ·   clear', 'Voici ce que tu peux me demander (je suis une liste de commandes, je ne suis pas une IA) :\n• ouvre galaxie\n• minuteur 10 min\n• réveille-moi à 7h30\n• qu’est-ce que j’ai aujourd’hui?\n• ajoute un événement test de maths vendredi 14h\n• mes rappels\n• rappelle-moi d’étudier\n• note : acheter des crayons\n• 24 * 17 + 3   ·   15% de 80\n• convertis 5 km en mi   ·   20 c en f\n• trouve le fichier devoir\n• choisis pizza ou tacos\n• quelle heure est-il?   ·   raconte une blague / un fait\n• pile ou face / lance un dé\n• mode sombre / mode clair / change le fond d’écran\n• joue de la musique   ·   efface la conversation');
    if ((m = l.match(/^(?:open|launch|start)\s+file\s+(.+)/))) {
      const f = findFiles(m[1]); if (!f.length) return L(`I couldn’t find a file called “${m[1]}”.`, `Je n’ai pas trouvé de fichier appelé « ${m[1]} ».`);
      setTimeout(() => PatOS.openFile(f[0]), 400); return L(`Opening ${PatOS.fs.basename(f[0])}.`, `J’ouvre ${PatOS.fs.basename(f[0])}.`);
    }
    if ((m = l.match(/^(?:open|launch|start)\s+(.+)/))) {
      const q = m[1].replace(/[.!?]$/, '').trim(); const id = findApp(q);
      if (id) { setTimeout(() => PatOS.launch(id), 500); return L(`Sure, opening ${PatOS.apps[id].name}.`, `D’accord, j’ouvre ${PatOS.t(PatOS.apps[id].name)}.`); }
      const near = suggestApp(q); if (near) return L(`I don’t have an app called "${q}". Did you mean ${PatOS.apps[near].name}? Say "open ${PatOS.apps[near].name.toLowerCase()}".`, `Je n’ai pas d’app appelée « ${q} ». Tu voulais dire ${PatOS.t(PatOS.apps[near].name)}? Écris « ouvre ${PatOS.t(PatOS.apps[near].name).toLowerCase()} ».`);
      return L(`Hmm, I don’t have an app called "${q}". Say "list apps" and I’ll show you what’s there.`, `Hmm, je n’ai pas d’app appelée « ${q} ». Écris « liste des apps » et je te montre ce qu’il y a.`);
    }
    if (/list (all )?apps|what apps/.test(l)) return L('Here’s everything you’ve got: ', 'Voici tout ce que tu as : ') + PatOS.appOrder.filter((k) => !PatOS.apps[k].hidden).map((k) => PatOS.t(PatOS.apps[k].name)).join(', ') + '.';
    // timers and alarms are rung by PatOS.alarms, so they ring even with Messages closed
    if ((m = l.match(/^(?:set (?:a )?|start (?:a )?)?timer(?: for)?\s+(.+)/))) {
      const ms = PatOS.parseDuration ? PatOS.parseDuration(m[1]) : 0;
      if (ms > 0 && ms <= 24 * 3600000) { PatOS.quickTimer(Math.round(ms / 1000), ''); const mins = Math.round(ms / 60000); return L(`Timer set for ${mins >= 60 ? Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + mins % 60 + ' min' : '') : mins < 1 ? Math.round(ms / 1000) + ' s' : mins + ' min'}. It will ring even if you close Messages.`, `Minuteur réglé pour ${mins >= 60 ? Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + mins % 60 + ' min' : '') : mins < 1 ? Math.round(ms / 1000) + ' s' : mins + ' min'}. Il sonnera même si tu fermes Messages.`); }
      return L('How long? Try “timer 10 min” or “timer 1h 20m”.', 'Combien de temps? Essaie « minuteur 10 min » ou « minuteur 1h 20m ».');
    }
    if ((m = l.match(/^(?:wake me(?: up)? at|set (?:an )?alarm(?: for| at)?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/))) {
      let hh = +m[1]; const mm = +(m[2] || 0); if (m[3] === 'pm' && hh < 12) hh += 12; if (m[3] === 'am' && hh === 12) hh = 0;
      if (hh > 23 || mm > 59) return L('That isn’t a time I can use. Try “wake me at 7:30”.', 'Ce n’est pas une heure valide. Essaie « réveille-moi à 7h30 ».');
      const time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      const list = PatOS.store.get('alarms', []); list.push({ id: PatOS.uid(), time, label: 'Pat', repeat: 'once', on: true }); PatOS.store.set('alarms', list); PatOS.emit('alarms'); PatOS.alarms && PatOS.alarms.askPermission();
      return L(`Alarm set for ${fmtTime(time)}. It rings once; you can change it in Clock.`, `Alarme réglée à ${fmtTime(time)}. Elle sonne une fois; tu peux la changer dans Horloge.`);
    }
    // calendar and reminders
    if ((m = l.match(/^(?:what(?:’s|'s| is)?(?: on)?|show|check)?\s*(?:my\s+)?(?:calendar|schedule|agenda)\s*(today|tomorrow)?\??$/)) || (m = l.match(/^what do i have\s*(today|tomorrow)?\??$/))) {
      const d = new Date(); if (m[1] === 'tomorrow') d.setDate(d.getDate() + 1);
      const evs = PatOS.calendarOn ? PatOS.calendarOn(d) : []; const day = m[1] === 'tomorrow' ? L('tomorrow', 'demain') : L('today', 'aujourd’hui');
      if (!evs.length) return L(`Nothing on your calendar ${day}.`, `Rien dans ton calendrier ${day}.`);
      return L(`On your calendar ${day}:\n`, `Dans ton calendrier ${day} :\n`) + evs.map((e) => '• ' + (e.time ? fmtTime(e.time) + '  ' : L('All day  ', 'Toute la journée  ')) + e.title).join('\n');
    }
    if ((m = t.match(/^(?:add event|event|schedule)\s*:?\s+(.+)/i))) {
      const p = PatOS.parseReminder ? PatOS.parseReminder(m[1], null) : { text: m[1] }; const key = p.due || today();
      const cal = PatOS.store.get('calendar', {}) || {}; (cal[key] = cal[key] || []).push({ id: PatOS.uid(), title: p.text, time: p.time || '', end: '', color: '#0a84ff', notes: '', repeat: '', alert: p.time ? '0' : 'none' });
      PatOS.store.set('calendar', cal); PatOS.emit('calendar'); PatOS.calendarSync && PatOS.calendarSync();
      return L(`Added “${p.text}” to your calendar on ${new Date(key + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' })}${p.time ? ' at ' + fmtTime(p.time) : ''}.`, `J’ai ajouté « ${p.text} » à ton calendrier le ${new Date(key + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' })}${p.time ? ' à ' + fmtTime(p.time) : ''}.`);
    }
    if (/^(?:my reminders|show (?:my )?reminders|what(?:’s|'s| is) due|what do i (?:need|have) to do)\??$/.test(l)) {
      const k = today(); const due = (PatOS.store.get('reminders', []) || []).filter((r) => !r.done && r.due && r.due <= k).sort((a, b) => (a.due + (a.time || '')).localeCompare(b.due + (b.time || '')));
      if (!due.length) return L('You’re all caught up. Nothing is due today.', 'Tu es à jour. Rien n’est dû aujourd’hui.');
      return L('Due today or overdue:\n', 'Dû aujourd’hui ou en retard :\n') + due.slice(0, 8).map((r) => '• ' + r.text + (r.time ? ' (' + fmtTime(r.time) + ')' : '') + (r.due < k ? L(' · overdue', ' · en retard') : '')).join('\n') + (due.length > 8 ? '\n… +' + (due.length - 8) : '');
    }
    if (/^clear( chat| the chat| conversation)?$/.test(l)) return '\u0000clear';
    if (/\btime\b/.test(l) && !/timer/.test(l)) return L('It’s ', 'Il est ') + new Date().toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }) + '.';
    if (/\b(date|day is it|today)\b/.test(l) && !/calendar|due/.test(l)) return L('Today is ', 'On est le ') + new Date().toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '.';
    if ((m = t.match(/^(?:remind me to|reminder:?|add reminder:?)\s+(.+)/i))) {
      const p = PatOS.parseReminder ? PatOS.parseReminder(m[1], null) : { text: m[1] };
      const items = PatOS.store.get('reminders', []) || []; const r = { id: Date.now(), text: p.text, done: false }; if (p.due) r.due = p.due; if (p.time) { r.time = p.time; PatOS.alarms && PatOS.alarms.askPermission(); } if (p.prio) r.prio = p.prio; items.push(r); PatOS.store.set('reminders', items); PatOS.emit('reminders');
      return L(`Got it. I added “${p.text}” to your reminders` + (p.due ? ' for ' + new Date(p.due + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'short', day: 'numeric' }) + (p.time ? ' at ' + fmtTime(p.time) : '') : '') + '.', `C’est noté. J’ai ajouté « ${p.text} » à tes rappels` + (p.due ? ' pour le ' + new Date(p.due + 'T12:00').toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'short', day: 'numeric' }) + (p.time ? ' à ' + fmtTime(p.time) : '') : '') + '.');
    }
    if ((m = t.match(/^(?:note:?|take a note:?|write down:?)\s+(.+)/i))) {
      const notes = PatOS.store.get('notes', []) || []; notes.unshift({ id: PatOS.uid(), title: m[1].slice(0, 40), body: '<div>' + PatOS.esc(m[1]) + '</div>', mtime: Date.now() }); PatOS.store.set('notes', notes);
      return L('Saved. You’ll find it at the top of Notes.', 'C’est enregistré. Tu la trouveras en haut de Notes.');
    }
    if ((m = l.match(/^find (?:the )?files?\s+(.+)/))) {
      const f = findFiles(m[1]); if (!f.length) return L(`I couldn’t find a file with “${m[1]}” in its name.`, `Je n’ai pas trouvé de fichier avec « ${m[1]} » dans son nom.`);
      return L(`Found ${f.length}:\n`, `${f.length} trouvé${f.length > 1 ? 's' : ''} :\n`) + f.slice(0, 6).map((p) => '• ' + p).join('\n') + (f.length > 6 ? '\n… +' + (f.length - 6) : '') + L('\nSay “open file ' + m[1] + '” to open the first one.', '\nÉcris « ouvre le fichier ' + m[1] + ' » pour ouvrir le premier.');
    }
    if ((m = l.match(/^(?:pick|choose)\s+(?:between\s+)?(.+)/)) && /,|\bor\b|\bou\b/.test(m[1])) { const opts = t.replace(/^(?:pick|choose)\s+(?:between\s+)?/i, '').split(/\s*,\s*|\s+or\s+|\s+ou\s+/i).map((x) => x.trim()).filter(Boolean); if (opts.length > 1) return L('I pick: ', 'Je choisis : ') + pick(opts) + '.'; }
    if (/joke/.test(l)) return pick(FR() ? JOKES_FR : JOKES);
    if (/fact/.test(l)) return L('Fun fact: ', 'Le savais-tu? ') + pick(FR() ? FACTS_FR : FACTS);
    if (/flip a coin|coin flip/.test(l)) return Math.random() < 0.5 ? L('Heads.', 'Pile.') : L('Tails.', 'Face.');
    if ((m = l.match(/roll (?:a )?(?:die|dice|d(\d+))/))) { const n = Math.max(2, Math.min(1000, +(m[1] || 6))); return L('You rolled a ', 'Tu as fait ') + (1 + Math.floor(Math.random() * n)) + '.'; }
    if (/dark mode/.test(l)) { PatOS.setSetting('theme', 'dark'); return L('Done, dark mode is on.', 'C’est fait, le mode sombre est activé.'); }
    if (/light mode/.test(l)) { PatOS.setSetting('theme', 'light'); return L('Done, light mode is on.', 'C’est fait, le mode clair est activé.'); }
    if (/wallpaper/.test(l)) { const all = [...Object.keys(PatOS.wallpaper.live), ...Object.keys(PatOS.wallpaper.palettes)]; const next = all[(all.indexOf(PatOS.settings.wallpaper) + 1) % all.length]; PatOS.setSetting('wallpaper', next); return L('New wallpaper: ', 'Nouveau fond d’écran : ') + PatOS.t((PatOS.wallpaper.live[next] || PatOS.wallpaper.palettes[next]).name) + '.'; }
    if (/play (some )?music|play a song/.test(l)) { PatOS.launch('music'); setTimeout(() => PatOS.music && !PatOS.music.nowPlaying() && PatOS.music.toggle(), 600); return L('Putting on a song.', 'Je mets une chanson.'); }
    if (/weather/.test(l)) { setTimeout(() => PatOS.launch('weather'), 400); return L('Here’s the weather.', 'Voici la météo.'); }
    if (/who are you|your name/.test(l)) return L('I’m Pat, a command helper. I’m not an AI: I understand a fixed list of commands (type "help" to see them), and I run on your device, so I work without internet.', 'Moi c’est Pat, un assistant à commandes. Je ne suis pas une IA : je comprends une liste fixe de commandes (écris « aide » pour la voir), et je fonctionne sur ton appareil, même sans Internet.');
    if (/thank/.test(l)) return L('Anytime.', 'Avec plaisir.');
    if (/how are you/.test(l)) return L('Pretty good, thanks. How about you?', 'Ça va bien, merci. Et toi?');
    // percent and unit conversions
    if ((m = l.match(/^(-?\d+(?:[.,]\d+)?)\s*%\s*(?:of|de)\s*(-?\d+(?:[.,]\d+)?)$/))) { const v = parseFloat(m[1].replace(',', '.')) * parseFloat(m[2].replace(',', '.')) / 100; return m[1] + '% ' + L('of', 'de') + ' ' + m[2] + ' = ' + (+v.toPrecision(12)); }
    if (PatOS.convertUnits) { const c = PatOS.convertUnits(t); if (c) return c.text; }
    const expr = t.replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/what is|what's|calculate|=|\?/gi, '').replace(/,/g, '.').trim();
    if (/^[\d\s+\-*/().%^]+$/.test(expr) && /\d/.test(expr) && expr.length < 200) { try { const v = Function('"use strict";return (' + expr.replace(/\^/g, '**') + ')')(); if (Number.isFinite(v)) return expr + ' = ' + (+v.toPrecision(12)); } catch (e) {} }
    if (/^(search|google|look up)\s+/.test(l)) { const q = t.replace(/^(search|google|look up)\s+/i, ''); setTimeout(() => PatOS.launch('browser', { url: q }), 400); return L('Looking up “', 'Je cherche « ') + q + L('” on the web.', ' » sur le Web.'); }
    if ((m = l.match(/^(?:define|meaning of|what does (.+) mean)\s*(.*)/))) { const w = (m[1] || m[2]).trim(); setTimeout(() => PatOS.launch('dictionary', { word: w }), 400); return L('Let me look up “' + w + '”.', 'Je cherche « ' + w + ' ».'); }
    // a lone app name opens it ("galaxy", "notes")
    if (l.length < 24 && !/\s{2,}/.test(l)) { const id = findApp(l); if (id && appNames(id).some((n) => n === l)) { setTimeout(() => PatOS.launch(id), 400); return L(`Opening ${PatOS.apps[id].name}.`, `J’ouvre ${PatOS.t(PatOS.apps[id].name)}.`); } const near = suggestApp(l); if (near) return L(`Did you mean ${PatOS.apps[near].name}? Say "open ${PatOS.apps[near].name.toLowerCase()}".`, `Tu voulais dire ${PatOS.t(PatOS.apps[near].name)}? Écris « ouvre ${PatOS.t(PatOS.apps[near].name).toLowerCase()} ».`); }
    return pick(FR() ? ['Je ne suis pas sûr de comprendre. Écris « aide » pour voir ce que je sais faire.', 'Ça, je ne sais pas encore le faire. Essaie « aide ».'] : ['I’m not sure what you mean. Type "help" to see what I can do.', 'That one’s beyond me for now. Try "help".', 'I can’t answer that, sorry. I’m better at opening apps, timers, quick math and reminders.']);
  }
  PatOS.assistantReply = reply;

  /* Pat, the command helper: the same chat as always, now in a panel that opens from the Pat button in the top bar */
  function patHelper(win) {
      let log = PatOS.store.get('chatLog', null) || [{ from: 'pat', text: PatOS.lang === 'fr' ? `Salut ${PatOS.settings.userName}, moi c’est Pat. Demande-moi d’ouvrir une app, de faire un calcul ou d’ajouter un rappel. Écris « aide » si tu veux la liste.` : `Hi ${PatOS.settings.userName}, I’m Pat. Ask me to open an app, do some math or add a reminder. Type "help" if you want the list.`, t: Date.now() }];
      const list = h('div', { class: 'msg-list' });
      const input = h('input', { class: 'msg-in', placeholder: PatOS.t('Ask Pat') + '…', spellcheck: 'true', autocomplete: 'off', enterkeyhint: 'send', 'aria-label': PatOS.t('Message Pat') });
      const send = h('button', { class: 'msg-send', 'aria-label': 'Send' }, '↑');
      const chips = h('div', { class: 'msg-chips' }, ...(PatOS.lang === 'fr' ? ['aide', 'minuteur 10 min', 'qu’est-ce que j’ai aujourd’hui?', 'mes rappels', 'raconte une blague', 'ouvre galaxie', 'rappelle-moi d’étudier'] : ['help', 'timer 10 min', 'what’s on my calendar today?', 'my reminders', 'tell me a joke', 'open galaxy', 'remind me to study']).map((c) => h('button', { class: 'no-tr', onclick: () => submit(c) }, c)));
      const head = h('div', { class: 'msg-head' }, h('div', { class: 'msg-av sm' }, 'P'), h('b', {}, 'Pat'));
      const mic = PatOS.voice && PatOS.voice.supported() ? h('button', { class: 'msg-mic', title: PatOS.t('Ask with your voice'), 'aria-label': PatOS.t('Ask with your voice'), html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>' }) : null;
      const root = h('div', { class: 'msg-main pat-main' }, head, list, chips, h('div', { class: 'msg-bar' }, mic, input, send));
      function bubble(m, anim) {
        const b = h('div', { class: 'msg-b ' + (m.from === 'me' ? 'me' : 'them') + (anim ? ' pop' : ''), title: m.t ? new Date(m.t).toLocaleString(PatOS.locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null }, m.text);
        list.appendChild(b); list.scrollTop = list.scrollHeight;
      }
      function render() { list.innerHTML = ''; log.slice(-80).forEach((m) => bubble(m)); }
      function submit(text) {
        text = (text || input.value).trim(); if (!text) return; input.value = '';
        sent.push(text); sent = sent.slice(-50); histAt = -1;
        const me = { from: 'me', text, t: Date.now() }; log.push(me); bubble(me, true);
        PatOS.sound.tone(1100, 0.08, { vol: 0.06, slide: 1500 });
        const typing = h('div', { class: 'msg-b them typing' }, h('i'), h('i'), h('i')); list.appendChild(typing); list.scrollTop = list.scrollHeight;
        setTimeout(() => {
          typing.remove();
          let out = PatOS.assistantReply ? PatOS.assistantReply(text) : reply(text);
          if (out === '\u0000clear') { clearChat(); return; }
          const r = { from: 'pat', text: out, t: Date.now() }; log.push(r); bubble(r, true);
          PatOS.sound.tone(700, 0.12, { vol: 0.06 }); PatOS.sound.tone(1050, 0.12, { vol: 0.05, delay: 0.08 });
          if (log.length > 200) log = log.slice(-200);
          PatOS.store.set('chatLog', log);
        }, 500 + Math.random() * 500);
      }
      // up and down bring back what you typed before
      let sent = log.filter((x) => x.from === 'me').map((x) => x.text).slice(-50), histAt = -1;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        else if (e.key === 'ArrowUp' && sent.length) { e.preventDefault(); histAt = histAt < 0 ? sent.length - 1 : Math.max(0, histAt - 1); input.value = sent[histAt]; }
        else if (e.key === 'ArrowDown' && histAt >= 0) { e.preventDefault(); histAt++; if (histAt >= sent.length) { histAt = -1; input.value = ''; } else input.value = sent[histAt]; }
      });
      function clearChat() { log = []; PatOS.store.remove('chatLog'); sent = []; list.innerHTML = ''; const hi = { from: 'pat', text: PatOS.lang === 'fr' ? 'C’est effacé. Écris « aide » si tu veux la liste des commandes.' : 'Cleared. Type "help" if you want the list of commands.', t: Date.now() }; log.push(hi); bubble(hi, true); PatOS.store.set('chatLog', log); }
      const clearAsk = async () => { if (await PatOS.confirmBox(PatOS.t('Clear this conversation?'), PatOS.t('The messages will be deleted.'), { ok: PatOS.t('Clear'), danger: true, icon: 'messages' })) clearChat(); };
      if (mic) { let stop = null; mic.onclick = () => { if (stop) { stop(); return; } mic.classList.add('on'); input.placeholder = PatOS.t('Listening…'); stop = PatOS.voice.listenOnce((t) => { submit(t); }, (err) => { stop = null; mic.classList.remove('on'); input.placeholder = PatOS.t('Ask Pat') + '…'; if (err) PatOS.notify({ title: 'Pat', body: err.message, icon: 'messages' }); }); }; }
      send.onclick = () => submit();
      render();
      return { el: root, focus: () => input.focus(), clear: clearAsk };
  }

  /* ---------- Messages: people with PatOS accounts (the Pat helper is the button in the top bar) ---------- */
  const clock = (t) => { const d = new Date(t), now = new Date(); const hm = d.toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }); return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' }) + ' ' + hm; };
  PatOS.registerApp({
    id: 'messages', name: 'Messages', icon: 'messages', width: 860, height: 600, minWidth: 340, minHeight: 360, keywords: 'chat messages friends people users username request pat helper commands text timer calendar',
    about: 'Message people with a PatOS account: find them by username, and they accept your request first. Pat, the command helper, is the button in the top bar.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const C = PatOS.chat, A = PatOS.account;
      const bPat = h('button', { class: 'btn pat-btn', title: PatOS.t('Pat, the command helper') }, 'Pat'); const who = h('span', { class: 'm2-who' });
      win.toolbar.append(bPat, h('div', { style: { flex: 1 } }), who); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px'; win.toolbar.style.gap = '8px';
      const side = h('div', { class: 'm2-side' }), main = h('div', { class: 'm2-main' }), patBox = h('div', { class: 'm2-pat', 'aria-hidden': 'true' });
      const root = h('div', { class: 'm2' }, side, main, patBox); win.body.appendChild(root);
      let helper = null, query = '', results = null, cur = null /* a conversation id */, target = null /* someone new */, searchTimer = null, listEl = null;
      const T = (x) => PatOS.t(x);
      const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'messages' });
      const fail = (e) => msg(T('That didn’t work'), String((e && e.message) || e));
      /* Pat's panel */
      bPat.onclick = () => {
        if (!helper) { helper = patHelper(win); patBox.appendChild(helper.el); win._clearChat = helper.clear; }
        const open = patBox.classList.toggle('open'); patBox.setAttribute('aria-hidden', String(!open)); bPat.classList.toggle('primary', open); if (open) setTimeout(() => helper.focus(), 220);
      };
      const av = (name) => h('div', { class: 'msg-av' }, (name || '?').charAt(0).toUpperCase());
      const signedIn = () => A && A.signedIn();

      /* the left side: search, requests, conversations */
      function row(name, sub, extra, on, onClick) { const b = h('div', { class: 'm2-row' + (on ? ' on' : ''), role: 'button', tabindex: '0', onclick: onClick }, av(name), h('div', { class: 'm2-rt' }, h('b', {}, name), h('small', {}, sub || '')), extra || null); b.addEventListener('keydown', (e) => { if (e.key === 'Enter') onClick(); }); return b; }
      function drawSide() {
        const keep = side.querySelector('.m2-search'); const had = document.activeElement === keep; const val = keep ? keep.value : query;
        side.innerHTML = '';
        if (!signedIn()) return;
        const search = h('input', { class: 'field m2-search', placeholder: T('Find a person'), spellcheck: 'false', autocapitalize: 'none', autocomplete: 'off', 'aria-label': T('Find a person by username') }); search.value = val;
        search.addEventListener('input', () => { query = search.value.trim(); clearTimeout(searchTimer); if (!query) { results = null; drawSide(); return; } searchTimer = setTimeout(async () => { const q = query; try { const r = await C.search(q); if (q === query) { results = r; drawList(); } } catch (e) { results = []; drawList(); } }, 250); });
        side.appendChild(h('div', { class: 'm2-sh' }, search)); listEl = h('div', { class: 'm2-list' }); side.appendChild(listEl); drawList();
        if (had) { search.focus(); search.setSelectionRange(val.length, val.length); }
      }
      function drawList() {
        if (!listEl) return; listEl.innerHTML = '';
        if (query) {
          if (!results) { listEl.appendChild(h('div', { class: 'm2-empty' }, T('Searching…'))); return; }
          if (!results.length) listEl.appendChild(h('div', { class: 'm2-empty' }, T('Nobody with that username. Check the spelling.')));
          results.forEach((u) => listEl.appendChild(row('@' + u.username, u.conv ? (u.conv.status === 'accepted' ? T('Open the chat') : u.conv.status === 'pending' ? (u.conv.mine ? T('Request sent') : T('Wants to message you')) : T('Declined')) : T('Send a message request'), null, false, () => { query = ''; results = null; if (u.conv) { cur = u.conv.id; target = null; C.open(cur); } else { target = u; cur = null; C.close(); } drawSide(); drawMain(); win.el.classList.add('m2-chat'); })));
          return;
        }
        const reqs = C.requests(), convs = C.conversations(), declined = C.declined();
        if (reqs.length) { listEl.appendChild(h('div', { class: 'm2-h' }, T('Requests') + ' (' + reqs.length + ')')); reqs.forEach((c) => listEl.appendChild(row('@' + c.other.username, c.last, h('span', { class: 'm2-dot' }), cur === c.id, () => openConv(c.id)))); }
        listEl.appendChild(h('div', { class: 'm2-h' }, T('Messages')));
        if (!convs.length) listEl.appendChild(h('div', { class: 'm2-empty' }, T('No conversations yet. Search for a username above to start one.')));
        convs.forEach((c) => listEl.appendChild(row('@' + c.other.username, c.status === 'pending' ? T('Waiting for them to accept') : (c.lastFromMe ? T('You') + ': ' : '') + c.last, c.unread ? h('span', { class: 'm2-dot' }) : h('small', { class: 'm2-time' }, c.lastAt ? clock(c.lastAt) : ''), cur === c.id, () => openConv(c.id))));
        if (declined.length) { listEl.appendChild(h('div', { class: 'm2-h' }, T('Declined'))); declined.forEach((c) => listEl.appendChild(row('@' + c.other.username, T('You declined this request'), null, cur === c.id, () => openConv(c.id)))); }
      }
      function openConv(id) { cur = id; target = null; C.open(id); drawSide(); drawMain(); win.el.classList.add('m2-chat'); }

      /* the right side: one conversation */
      function drawMain() {
        main.innerHTML = '';
        if (!signedIn()) {
          main.appendChild(h('div', { class: 'm2-card' }, h('h2', {}, T('Message your friends')), h('p', {}, T('Messages now work between PatOS accounts. Create a free account with just a username and a password, then find your friends by username. They accept your request first.')),
            h('div', { class: 'm2-cbtns' }, h('button', { class: 'btn primary', onclick: () => PatOS.accountUI.open('signup') }, T('Create Account')), h('button', { class: 'btn', onclick: () => PatOS.accountUI.open('signin') }, T('Sign In'))),
            h('p', { class: 'm2-fine' }, T('Pat, the command helper, works without an account: press Pat in the top bar.')))); return;
        }
        const c = cur ? C.find(cur) : null;
        if (!c && !target) { main.appendChild(h('div', { class: 'm2-card' }, h('h2', {}, T('Messages')), h('p', {}, T('Pick a conversation, or find someone by username in the search box.')), C.outbox() ? h('p', { class: 'm2-fine' }, C.outbox() + ' ' + T('waiting to be sent (you are offline or the connection is slow)')) : null)); return; }
        const name = c ? c.other.username : target.username;
        const back = h('button', { class: 'tbtn m2-back', 'aria-label': T('Back'), onclick: () => { win.el.classList.remove('m2-chat'); } }, '‹');
        main.appendChild(h('div', { class: 'm2-head' }, back, av(name), h('div', {}, h('b', {}, '@' + name), h('small', {}, c ? (c.status === 'accepted' ? T('Chat') : c.status === 'pending' ? (c.mine ? T('Waiting for them to accept') : T('Message request')) : T('Declined')) : T('New message')))));
        const list = h('div', { class: 'm2-msgs', role: 'log', 'aria-live': 'polite' });
        if (c) {
          const ms = C.messages(); let day = '';
          ms.forEach((m) => { const dk = new Date(m.t).toDateString(); if (dk !== day) { day = dk; list.appendChild(h('div', { class: 'm2-day' }, new Date(m.t).toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' }))); } list.appendChild(h('div', { class: 'msg-b ' + (m.mine ? 'me' : 'them') + (m.sending ? ' sending' : ''), title: new Date(m.t).toLocaleString(PatOS.locale) }, m.text)); });
          if (c.status === 'pending' && c.mine) list.appendChild(h('div', { class: 'm2-sys' }, '@' + name + ' ' + T('has to accept your request before you can keep chatting. They get no notifications from you until then.')));
        } else {
          list.appendChild(h('div', { class: 'm2-sys' }, T('Your first message is sent as a request. @') + name + ' ' + T('decides whether to accept it, and gets no notifications from you until they do.')));
          C.outbox() && list.appendChild(h('div', { class: 'm2-sys' }, T('Sending…')));
        }
        main.appendChild(list); setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
        // the bottom: write, or answer a request
        if (c && c.status === 'pending' && !c.mine) {
          main.appendChild(h('div', { class: 'm2-ask' }, h('span', {}, '@' + name + ' ' + T('wants to message you.')), h('div', {}, h('button', { class: 'btn primary', onclick: () => C.respond(c.id, true).catch(fail) }, T('Accept')), h('button', { class: 'btn', onclick: () => C.respond(c.id, false).then(() => { cur = null; C.close(); drawSide(); drawMain(); }).catch(fail) }, T('Decline')))));
        } else if (c && c.status === 'declined') {
          main.appendChild(c.mine ? h('div', { class: 'm2-ask' }, h('span', {}, T('This person did not accept your request.'))) : h('div', { class: 'm2-ask' }, h('span', {}, T('You declined this request.')), h('div', {}, h('button', { class: 'btn', onclick: () => C.respond(c.id, true).catch(fail) }, T('Accept Anyway')))));
        } else if (c && c.status === 'pending' && c.mine) {
          main.appendChild(h('div', { class: 'm2-ask' }, h('span', {}, T('Waiting for them to accept…'))));
        } else {
          const input = h('input', { class: 'msg-in', placeholder: T('Message'), maxlength: '2000', autocomplete: 'off', enterkeyhint: 'send', 'aria-label': T('Message') });
          const send = h('button', { class: 'msg-send', 'aria-label': T('Send') }, '↑');
          const go = async () => { const v = input.value.trim(); if (!v) return; input.value = ''; try { if (c) C.send(c.id, v); else { const id = await C.request(target, v); if (id) { cur = id; target = null; C.open(id); drawSide(); } } } catch (e) { input.value = v; fail(e); } };
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); send.onclick = go;
          main.appendChild(h('div', { class: 'msg-bar' }, input, send)); if (!win._noFocus) setTimeout(() => input.focus(), 60);
        }
      }
      const fullPaint = () => { who.textContent = signedIn() ? '@' + A.info().username : ''; if (!signedIn()) { cur = null; target = null; } drawSide(); drawMain(); };
      const offs = [PatOS.on('chat', () => { if (!root.isConnected) return; drawSide(); const c = cur ? C.find(cur) : null; if (cur && !c) { /* gone */ } else if (c && main.dataset.status !== c.status) { drawMain(); } main.dataset.status = c ? c.status : ''; }),
        PatOS.on('chat:messages', () => { if (!root.isConnected) return; if (cur || target) { const keepFocus = document.activeElement && document.activeElement.classList.contains('msg-in'); const v = keepFocus ? document.activeElement.value : ''; drawMain(); if (keepFocus) { const i = main.querySelector('.msg-in'); if (i) { i.value = v; i.focus(); } } } }),
        PatOS.on('account', () => { if (root.isConnected) fullPaint(); })];
      win.on('closed', () => { offs.forEach((f) => f()); C.close(); });
      win._open = (id) => { if (signedIn()) openConv(id); };
      fullPaint();
      if (signedIn() && C.available() && !C.ready()) { try { PatOS.chat.search(''); } catch (e) {} }
      if (args && args.chat) win._open(args.chat);
    },
    onArgs(win, a) { if (a.chat && win._open) win._open(a.chat); },
    menus(win) {
      return { file: [
        { label: PatOS.t('Clear Pat Conversation…'), action: () => win._clearChat && win._clearChat() },
        { divider: true },
        { label: PatOS.t('Close Window'), shortcut: 'Alt+W', action: () => win.close() }
      ] };
    }
  });
})();
