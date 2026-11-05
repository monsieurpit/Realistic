/* Pat: the command helper in the top bar. Pat is not an AI: it matches what you type (or say) against a fixed list of commands (open an app, math,
   reminders, notes, timers, the time and date, a few settings) and answers from that list. Everything runs on the device.
   Click the speech bubble in the top bar (next to Control Center), or open the Pat app on a phone. */
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
  /* the chat with Pat, as an element: a list of messages, quick suggestions, and a box to type in */
  function patHelper() {
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
        }, PatOS.settings.reduceMotion ? 0 : 120 + Math.random() * 120);
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

  /* ---------- the Pat button in the top bar (next to Control Center) and its panel ---------- */
  const bar = document.getElementById('mb-pat'), box = document.getElementById('pat-panel');
  let built = null;
  const ICON = '<svg viewBox="0 0 24 24"><path d="M5.2 4h13.6A2.2 2.2 0 0 1 21 6.2v8.1a2.2 2.2 0 0 1-2.2 2.2H12l-4.4 3.5a.6.6 0 0 1-1-.5v-3H5.2A2.2 2.2 0 0 1 3 14.3V6.2A2.2 2.2 0 0 1 5.2 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.4" cy="10.2" r="1.25" fill="currentColor"/><circle cx="12" cy="10.2" r="1.25" fill="currentColor"/><circle cx="15.6" cy="10.2" r="1.25" fill="currentColor"/></svg>';
  const isOpen = () => !!box && !box.classList.contains('hidden');
  function open() {
    if (!box) return;
    ['#control-center', '#notif-center'].forEach((s) => { const e = document.querySelector(s); if (e) e.classList.add('hidden'); });
    if (!built) {
      built = patHelper();
      const top = h('div', { class: 'pat-top' }, h('b', {}, 'Pat'), h('span', { class: 'pat-sub' }, PatOS.t('Command helper, not an AI')), h('div', { style: { flex: 1 } }),
        h('button', { class: 'tbtn', title: PatOS.t('Clear the conversation'), onclick: () => built.clear() }, PatOS.t('Clear')), h('button', { class: 'tbtn', title: PatOS.t('Close'), 'aria-label': PatOS.t('Close'), onclick: close }, '×'));
      box.append(top, built.el);
    }
    box.classList.remove('hidden'); bar && bar.classList.add('on'); setTimeout(() => built.focus(), 60);
  }
  function close() { if (box) box.classList.add('hidden'); if (bar) bar.classList.remove('on'); }
  const toggle = () => (isOpen() ? close() : open());
  if (bar) { bar.innerHTML = ICON; bar.title = PatOS.t('Pat'); bar.addEventListener('click', (e) => { e.stopPropagation(); toggle(); }); }
  document.addEventListener('pointerdown', (e) => { if (isOpen() && !e.target.closest('#pat-panel, #mb-pat, .dlg-layer, .menu')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen() && !e.defaultPrevented) close(); });
  PatOS.pat = { open, close, toggle, isOpen, ask: (t) => { open(); const i = box.querySelector('.msg-in'); if (i) { i.value = t; i.focus(); } } };
  /* on a phone there is no menu bar: Pat is an app in Launchpad that opens the same panel */
  PatOS.iconDefs.pat = { bg: 'linear-gradient(160deg,#7d5cff,#ff4fa0)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M12 14h40a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H31L19 56a1.5 1.5 0 0 1-2.5-1.2V46H12a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#fff"/><circle cx="22" cy="30" r="3.4" fill="#7d5cff"/><circle cx="32" cy="30" r="3.4" fill="#a05cff"/><circle cx="42" cy="30" r="3.4" fill="#ff4fa0"/></svg>' };
  PatOS.registerApp({ id: 'pat', name: 'Pat', icon: 'pat', category: 'Utilities', keywords: 'pat helper assistant commands timer hey pat voice command chat', about: 'Pat, the command helper: type or say what you want (open an app, a timer, a reminder, the weather). A fixed list of commands, not an AI.', action: () => toggle() });
})();
