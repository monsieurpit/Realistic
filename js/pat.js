/* Pat: the command helper in the top bar. Pat is not an AI: it matches what you type (or say) against a fixed list of commands (open an app, math,
   reminders, notes, timers, the time and date, a few settings) and answers from that list. Everything runs on the device.
   Click the speech bubble in the top bar (next to Control Center), or open the Pat app on a phone.
   Since 3.1 (roadmap Tasks 42 and 43): natural and polite phrasing, two or more commands in one message, follow-ups ("open it"),
   and skills in the apps (PatOS.pat.skill): search Notes, find documents by what is in them, create a document, tidy a folder
   (asks first, can be undone), summarize a text by picking its key sentences, the day at a glance, run a shortcut. */
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
  /* what Pat remembers between two messages: the last list it showed ("open the second one") and an action waiting for a yes */
  const ctx = { list: null, pending: null, undo: null };
  // a message that arrives later in the chat (when something Pat started turned out not to work)
  const say = (text) => PatOS.emit('pat:say', text);
  // opens an app a moment after the answer is shown, and says so if it did not open
  function openApp(id) {
    setTimeout(() => {
      let w = null, err = null; try { w = PatOS.launch(id); } catch (e) { err = e; }
      const app = PatOS.apps[id];
      if (!w && !(app && app.action)) say(L(`${app ? app.name : id} didn’t open`, `${app ? PatOS.t(app.name) : id} ne s’est pas ouvert`) + (err ? ': ' + err.message : '.'));
    }, 400);
  }
  function findFiles(q) {
    q = q.toLowerCase().trim(); const out = [];
    PatOS.fs.walk('/', (p, n) => { if (!p.startsWith('/.Trash') && n.type === 'file' && PatOS.fs.basename(p).toLowerCase().includes(q)) out.push(p); });
    return out;
  }
  function basic(text) {
    let t = text.trim(); if (FR()) t = fromFrench(t);
    const l = t.toLowerCase(); let m;
    const name = PatOS.settings.userName;
    if (/^(hi|hey|hello|yo|sup)\b/.test(l)) return L(`Hey ${name}. What do you need? I can open an app, set a timer, check your calendar, do a quick calculation, add a reminder, or just tell you a bad joke. Type "help" for the full list.`, `Salut ${name}. Qu’est-ce qu’il te faut? Je peux ouvrir une app, mettre un minuteur, regarder ton calendrier, faire un calcul, ajouter un rappel ou te raconter une mauvaise blague. Écris « aide » pour la liste complète.`);
    if (/\bhelp\b|what can you do/.test(l)) return L('Here’s what you can ask me (I follow a list of commands, I’m not an AI):\n• open galaxy\n• timer 10 min\n• wake me at 7:30\n• what’s on my calendar today?\n• add event math test friday 2pm\n• my reminders\n• remind me to study for math\n• note: buy pencils\n• 24 * 17 + 3   ·   15% of 80\n• 5 km to mi   ·   20 c to f\n• find file essay\n• pick pizza or tacos\n• what time is it?   ·   tell me a joke / a fact\n• flip a coin / roll a die\n• dark mode / light mode / change wallpaper\n• play music   ·   clear', 'Voici ce que tu peux me demander (je suis une liste de commandes, je ne suis pas une IA) :\n• ouvre galaxie\n• minuteur 10 min\n• réveille-moi à 7h30\n• qu’est-ce que j’ai aujourd’hui?\n• ajoute un événement test de maths vendredi 14h\n• mes rappels\n• rappelle-moi d’étudier\n• note : acheter des crayons\n• 24 * 17 + 3   ·   15% de 80\n• convertis 5 km en mi   ·   20 c en f\n• trouve le fichier devoir\n• choisis pizza ou tacos\n• quelle heure est-il?   ·   raconte une blague / un fait\n• pile ou face / lance un dé\n• mode sombre / mode clair / change le fond d’écran\n• joue de la musique   ·   efface la conversation');
    if ((m = l.match(/^(?:open|launch|start)\s+file\s+(.+)/))) {
      const f = findFiles(m[1]); if (!f.length) return L(`I couldn’t find a file called “${m[1]}”.`, `Je n’ai pas trouvé de fichier appelé « ${m[1]} ».`);
      ctx.list = { kind: 'file', items: f, t: Date.now() }; setTimeout(() => { try { PatOS.openFile(f[0]); } catch (e) { say(L('That file didn’t open: ', 'Ce fichier ne s’est pas ouvert : ') + e.message); } }, 400); return L(`Opening ${PatOS.fs.basename(f[0])}.`, `J’ouvre ${PatOS.fs.basename(f[0])}.`);
    }
    if ((m = l.match(/^(?:open|launch|start)\s+(.+)/))) {
      const q = m[1].replace(/[.!?]$/, '').trim(); const id = findApp(q);
      if (id) { openApp(id); return L(`Sure, opening ${PatOS.apps[id].name}.`, `D’accord, j’ouvre ${PatOS.t(PatOS.apps[id].name)}.`); }
      const near = suggestApp(q); if (near) return L(`I don’t have an app called "${q}". Did you mean ${PatOS.apps[near].name}? Say "open ${PatOS.apps[near].name.toLowerCase()}".`, `Je n’ai pas d’app appelée « ${q} ». Tu voulais dire ${PatOS.t(PatOS.apps[near].name)}? Écris « ouvre ${PatOS.t(PatOS.apps[near].name).toLowerCase()} ».`);
      return L(`Hmm, I don’t have an app called "${q}". Say "list apps" and I’ll show you what’s there.`, `Hmm, je n’ai pas d’app appelée « ${q} ». Écris « liste des apps » et je te montre ce qu’il y a.`);
    }
    if (/list (all )?apps|what apps/.test(l)) return L('Here’s everything you’ve got: ', 'Voici tout ce que tu as : ') + PatOS.appOrder.filter((k) => !PatOS.apps[k].hidden).map((k) => PatOS.t(PatOS.apps[k].name)).join(', ') + '.';
    // timers and alarms are rung by PatOS.alarms, so they ring even with Messages closed
    if ((m = l.match(/^(?:set (?:a )?|start (?:a )?)?timer(?: for)?\s+(.+)/))) {
      const ms = PatOS.parseDuration ? PatOS.parseDuration(m[1]) : 0;
      if (ms > 0 && ms <= 24 * 3600000) { PatOS.quickTimer(Math.round(ms / 1000), ''); const mins = Math.round(ms / 60000); return L(`Timer set for ${mins >= 60 ? Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + mins % 60 + ' min' : '') : mins < 1 ? Math.round(ms / 1000) + ' s' : mins + ' min'}. It will ring even if you close Pat.`, `Minuteur réglé pour ${mins >= 60 ? Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + mins % 60 + ' min' : '') : mins < 1 ? Math.round(ms / 1000) + ' s' : mins + ' min'}. Il sonnera même si tu fermes Pat.`); }
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
      ctx.list = { kind: 'file', items: f, t: Date.now() };
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
    if (l.length < 24 && !/\s{2,}/.test(l)) { const id = findApp(l); if (id && appNames(id).some((n) => n === l)) { openApp(id); return L(`Opening ${PatOS.apps[id].name}.`, `J’ouvre ${PatOS.t(PatOS.apps[id].name)}.`); } const near = suggestApp(l); if (near) return L(`Did you mean ${PatOS.apps[near].name}? Say "open ${PatOS.apps[near].name.toLowerCase()}".`, `Tu voulais dire ${PatOS.t(PatOS.apps[near].name)}? Écris « ouvre ${PatOS.t(PatOS.apps[near].name).toLowerCase()} ».`); }
    return null; // (not understood: reply() explains, with an example close to what was asked)
  }
  /* =================== Pat 3.1: more ways of asking, several steps at once, and skills for the apps ===================
     Still a command helper, not an AI: everything below is rules that run on the device. What is new:
     - polite and natural phrasing is understood ("can you open notes please", "peux-tu mettre un minuteur de 5 minutes")
     - several commands in one message ("open notes and set a timer for 5 min"), only when every part is a command
     - follow-ups: after a list, "open it" or "the second one"; after tidying a folder, "undo"
     - skills: things Pat can do in the apps, each one explicit (PatOS.pat.skill). A skill marked sensitive (it moves or
       changes several things at once) is only done after a yes, and says what it will do first. Pat never says something
       worked unless it checked. */
  const STOP = new Set('the a an and or of to in on at for with is are was were be it this that i you we they my your our me de la le les des du un une et ou à au aux en dans sur pour avec est sont je tu il elle nous vous ils mon ton son ma ta sa mes tes ses ce cette qui que'.split(' '));
  const words = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || [];
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<(div|p|br|li|h\d)[^>]*>/gi, ' $&'); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
  const ORD = { first: 0, '1st': 0, one: 0, second: 1, '2nd': 1, two: 1, third: 2, '3rd': 2, three: 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4, last: -1 };

  /* ---------- how people ask ---------- */
  function politeOff(t) {
    let x = t.trim().replace(/^(?:(?:hey|hi|ok|okay|yo|hé|dis|salut)[\s,]+)?pat\b[\s,:!.]*/i, '');
    if (FR()) {
      x = x.replace(/^(?:est-ce que |est ce que )?(?:tu peux|peux-tu|peux tu|pourrais-tu|pourrais tu|tu pourrais|vous pouvez|pouvez-vous|pourriez-vous)\s+/i, '')
        .replace(/^(?:j['’]aimerais|je voudrais|je veux|j['’]ai besoin)\s+(?:que tu\s+|de\s+|d['’])?/i, '')
        .replace(/[\s,]*(?:s['’]il te pla[iî]t|s['’]il vous pla[iî]t|stp|svp|pour moi|merci)\s*[.!?]*$/i, '');
      // after "peux-tu", French says the verb whole: say it the way the commands expect
      x = x.replace(/^me rappeler\s+(?:de |d['’])?/i, 'rappelle-moi de ').replace(/^me réveiller|^me reveiller/i, 'réveille-moi').replace(/^me mettre\s+/i, 'mets ')
        .replace(/^(ouvrir|mettre|ajouter|chercher|trouver|créer|creer|écrire|ecrire|ranger|organiser|résumer|resumer|lancer|noter|jouer|faire)\b/i, (v) => ({ ouvrir: 'ouvre', mettre: 'mets', ajouter: 'ajoute', chercher: 'cherche', trouver: 'trouve', 'créer': 'crée', creer: 'crée', 'écrire': 'écris', ecrire: 'écris', ranger: 'range', organiser: 'organise', 'résumer': 'résume', resumer: 'résume', lancer: 'lance', noter: 'note', jouer: 'joue', faire: 'fais' })[v.toLowerCase()] || v);
    } else {
      x = x.replace(/^(?:(?:please|pls|plz)\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?|i\s+(?:want|need|would like|['’]d like)\s+(?:you\s+)?to\s+|(?:please|pls|plz)\s+|let['’]?s\s+|help me\s+|go\s+and\s+|just\s+)/i, '')
        .replace(/^(?:please|pls)\s+/i, '')
        .replace(/[\s,]*(?:please|pls|plz|for me|thanks|thank you|right now)\s*[.!?]*$/i, '');
    }
    return x.replace(/\?+$/, (q) => (/^(what|how|which|when|qu|quel|comment|combien)/i.test(x) ? q : '')).trim() || t.trim();
  }
  // French for the new skills, said the English way before anything else reads it
  function frenchSkills(t) {
    const R = [
      [/^(?:oui|ouais|ok|d['’]accord|vas-y|vas y|go|confirme|c['’]est bon|fais-le|fais le)\s*[.!]*$/i, 'yes'], [/^(?:non|annule|laisse tomber|pas maintenant)\s*[.!]*$/i, 'no'], [/^(?:annuler|défais|defais|remets(?: comme avant)?|annule ça|annule ca)\s*[.!]*$/i, 'undo'],
      [/^(?:ouvre-le|ouvre-la|ouvre le|ouvre la|ouvre ça|ouvre ca|ouvre-les)\s*[.!]*$/i, 'open it'],
      [/^(?:ouvre\s+)?(?:le |la )?(premi[eè]re?|deuxi[eè]me|second(?:e)?|troisi[eè]me|quatri[eè]me|cinqui[eè]me|derni[eè]re?)\s*[.!]*$/i, (m) => 'open the ' + ({ premier: 'first', 'première': 'first', premiere: 'first', 'deuxième': 'second', deuxieme: 'second', second: 'second', seconde: 'second', 'troisième': 'third', troisieme: 'third', 'quatrième': 'fourth', quatrieme: 'fourth', 'cinquième': 'fifth', cinquieme: 'fifth', dernier: 'last', 'dernière': 'last', derniere: 'last' })[m[1].toLowerCase()] + ' one'],
      [/^(?:cherche|trouve|recherche)\s+(?:dans\s+)?(?:mes\s+|les\s+)?notes?\s+(?:sur |pour |à propos de |a propos de |qui parlent? de |avec )?(.+)/i, 'search notes for $1'],
      [/^(?:trouve|cherche)\s+(?:la |une |ma )note\s+(?:sur |appelée |appelee |intitulée |intitulee |à propos de |a propos de )?(.+)/i, 'search notes for $1'],
      [/^(?:trouve|cherche)\s+(?:un |le |les |des |mes )?(?:documents?|fichiers?)\s+(?:sur|à propos de|a propos de|qui parlent? de|qui contiennent|contenant|avec|qui mentionnent)\s+(.+)/i, 'find documents about $1'],
      [/^(?:crée|cree|écris|ecris|prépare|prepare|fais|commence|nouveau)\s+(?:un\s+)?(?:nouveau\s+)?document\s*(?:appelé|appele|intitulé|intitule|nommé|nomme|sur|pour|à propos de|a propos de)?\s*(.*)/i, 'create a document called $1'],
      [/^(?:range|organise|trie|classe|nettoie|fais le ménage dans|fais le menage dans)\s+(?:mon |le |mes |les |ma )?(bureau|téléchargements|telechargements|documents|images)\b.*/i, (m) => 'tidy my ' + ({ bureau: 'desktop', 'téléchargements': 'downloads', telechargements: 'downloads', documents: 'documents', images: 'pictures' })[m[1].toLowerCase()]],
      [/^(?:résume|resume|résumé|fais un résumé de|fais un resume de)\s+(?:ma |la )note\s+(.+)/i, 'summarize note $1'], [/^(?:résume|resume|résumé|fais un résumé de|fais un resume de)\s*:?\s*([\s\S]+)/i, 'summarize: $1'],
      [/^(?:ma journée|ma journee|comment est ma journée|comment est ma journee|qu['’]est-ce qui m['’]attend(?: aujourd['’]hui)?|résumé de ma journée|resume de ma journee)\s*\??$/i, 'my day'],
      [/^(?:lance|exécute|execute|démarre|demarre)\s+(?:le |mon )?raccourci\s+(.+)/i, 'run shortcut $1']
    ];
    for (const [re, rep] of R) { const m = re.exec(t); if (m) return typeof rep === 'function' ? rep(m) : t.replace(re, rep); }
    return t;
  }
  const prep = (t) => { let x = politeOff(t); if (FR()) x = frenchSkills(x); return x; };

  /* ---------- skills: what Pat can do in the apps ----------
     A skill: { id, app, sensitive, match(text) → what it needs or null, run(what) → the answer, or { text, confirm(): answer } }.
     Pat only does what a skill says. Sensitive ones answer with what they will do, and confirm() runs after a yes. */
  const skills = [];
  function skill(def) { if (def && def.id && def.match && def.run && !skills.some((s) => s.id === def.id)) skills.push(def); }
  const recent = () => ctx.list && Date.now() - ctx.list.t < 10 * 60 * 1000 ? ctx.list : null;
  function openItem(kind, it) {
    if (kind === 'note') { openApp2('notes', { id: it }); return L('Opening the note.', 'J’ouvre la note.'); }
    setTimeout(() => { try { PatOS.openFile(it); } catch (e) { say(L('That file didn’t open: ', 'Ce fichier ne s’est pas ouvert : ') + e.message); } }, 300);
    return L('Opening ', 'J’ouvre ') + PatOS.fs.basename(it) + '.';
  }
  function openApp2(id, args) { setTimeout(() => { let w = null; try { w = PatOS.launch(id, args); } catch (e) {} if (!w && !(PatOS.apps[id] && PatOS.apps[id].action)) say(L('That didn’t open.', 'Ça ne s’est pas ouvert.')); }, 300); }

  // "open it", "the second one"
  skill({ id: 'followup', match: (t) => { const l = recent(); let m = /^(?:open|show)\s+(?:it|that|this|them|the first one|the second one|the last one)$/i.exec(t); if (m && !l) return { none: true }; if (!l) return null; m = /^(?:open|show)\s+(?:it|that|this|them)$/i.exec(t); if (m) return { i: 0 }; m = /^(?:open|show)?\s*(?:the\s+)?(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th|one|two|three)(?:\s+one)?$/i.exec(t) || /^(?:open|show)\s+(?:number\s+|#)?(\d)$/i.exec(t); if (!m) return null; const k = m[1].toLowerCase(); return { i: /^\d$/.test(k) ? +k - 1 : ORD[k] }; },
    run: ({ i, none }) => { if (none) return L('Open what? Say the name of an app or a file, or search first (“search notes for …”).', 'Ouvrir quoi? Dis le nom d’une app ou d’un fichier, ou cherche d’abord (« cherche dans mes notes … »).'); const l = recent(); const it = i < 0 ? l.items[l.items.length - 1] : l.items[i]; if (!it) return L(`There are only ${l.items.length}.`, `Il n’y en a que ${l.items.length}.`); return openItem(l.kind, it); } });

  // Notes: find notes by what is in them
  function searchNotes(q) {
    const want = words(q).filter((w) => !STOP.has(w)); if (!want.length) return [];
    return (PatOS.store.get('notes', []) || []).map((n) => { const text = (n.title || '') + ' ' + plain(n.body); const has = words(text); const hit = want.filter((w) => has.some((x) => x.startsWith(w))).length; return { n, text, hit }; })
      .filter((x) => x.hit === want.length).sort((a, b) => (b.n.mtime || 0) - (a.n.mtime || 0)).map((x) => x);
  }
  skill({ id: 'notes.search', app: 'notes', match: (t) => { const m = /^(?:search|find|look for|look up|show)\s+(?:in\s+)?(?:my\s+|the\s+)?notes?\s+(?:for\s+|about\s+|with\s+|that mention\s+|on\s+|called\s+|named\s+)?(.+)/i.exec(t) || /^(?:which|what)\s+notes?\s+(?:mention|talk about|are about|have|say)\s+(.+)/i.exec(t) || /^(?:find|search for)\s+(?:the\s+|a\s+|my\s+)?note\s+(?:called|named|about|on|with)?\s*(.+)/i.exec(t); return m ? { q: m[1].replace(/[.?!]$/, '') } : null; },
    run: ({ q }) => {
      const r = searchNotes(q); if (!r.length) { ctx.list = null; return L(`No note mentions “${q}”.`, `Aucune note ne parle de « ${q} ».`); }
      ctx.list = { kind: 'note', items: r.map((x) => x.n.id), t: Date.now() };
      return L(`${r.length === 1 ? 'One note' : r.length + ' notes'} with “${q}”:\n`, `${r.length === 1 ? 'Une note' : r.length + ' notes'} avec « ${q} » :\n`) + r.slice(0, 6).map((x) => '• ' + (x.n.title || L('Untitled', 'Sans titre'))).join('\n') + (r.length > 6 ? '\n… +' + (r.length - 6) : '') + L('\nSay “open it” or “open the second one”.', '\nÉcris « ouvre-le » ou « le deuxième ».');
    } });

  // Files: find documents by what is inside them (text files, Docs, Sheets, Slides, notes saved as files)
  function searchDocs(q) {
    const want = words(q).filter((w) => !STOP.has(w)); if (!want.length) return [];
    const out = [];
    PatOS.fs.walk('/', (p, n) => {
      if (n.type !== 'file' || p.startsWith('/.Trash') || /\/\./.test(p)) return;
      let text = PatOS.fs.basename(p);
      if (typeof n.content === 'string' && n.content.length < 2e6 && !/^data:/.test(n.content)) text += ' ' + (/\.(pdoc|html?|psheet|pslide)$/i.test(p) ? plain(n.content) : n.content);
      const has = new Set(words(text)); const hit = want.filter((w) => has.has(w) || [...has].some((x) => x.startsWith(w))).length;
      if (hit === want.length) out.push({ p, m: n.mtime || 0 });
    });
    return out.sort((a, b) => b.m - a.m).map((x) => x.p);
  }
  skill({ id: 'files.search', app: 'finder', match: (t) => { const m = /^(?:find|search for|look for|search)\s+(?:a\s+|the\s+|my\s+|any\s+)?(?:documents?|docs?|files?)\s+(?:about|on|that mentions?|mentioning|with|containing|that (?:talk|talks) about)\s+(.+)/i.exec(t) || /^(?:which|what)\s+(?:files?|documents?|docs?)\s+(?:mention|talk about|contain|have|are about)\s+(.+)/i.exec(t); return m ? { q: m[1].replace(/[.?!]$/, '') } : null; },
    run: ({ q }) => {
      const f = searchDocs(q); if (!f.length) { ctx.list = null; return L(`No document mentions “${q}”.`, `Aucun document ne parle de « ${q} ».`); }
      ctx.list = { kind: 'file', items: f, t: Date.now() };
      return L(`${f.length === 1 ? 'One document' : f.length + ' documents'} with “${q}”:\n`, `${f.length === 1 ? 'Un document' : f.length + ' documents'} avec « ${q} » :\n`) + f.slice(0, 6).map((p) => '• ' + PatOS.fs.basename(p) + '  (' + PatOS.fs.dirname(p) + ')').join('\n') + (f.length > 6 ? '\n… +' + (f.length - 6) : '') + L('\nSay “open it” or “open the second one”.', '\nÉcris « ouvre-le » ou « le deuxième ».');
    } });

  // Docs: start a document
  skill({ id: 'docs.create', app: 'docs', match: (t) => { const m = /^(?:create|make|write|start|prepare|new|open a new)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:new\s+)?(?:document|doc)\b\s*(?:called|named|titled|about|on|for)?\s*(.*)$/i.exec(t); return m ? { title: m[1].replace(/^["“'«\s]+|["”'»\s.!]+$/g, '') } : null; },
    run: ({ title }) => {
      const name = (title ? title.charAt(0).toUpperCase() + title.slice(1) : L('Untitled document', 'Document sans titre')).replace(/[\/\\:*?"<>|]/g, '-').slice(0, 80);
      if (!PatOS.fs.exists('/Documents')) PatOS.fs.mkdir('/Documents');
      const path = '/Documents/' + PatOS.fs.uniqueName('/Documents', name + '.pdoc');
      PatOS.fs.write(path, '<h1>' + PatOS.esc(name) + '</h1><p><br></p>');
      if (!PatOS.fs.exists(path)) return L('I couldn’t make the document.', 'Je n’ai pas pu créer le document.');
      ctx.list = { kind: 'file', items: [path], t: Date.now() }; openApp2('docs', { path });
      return L(`I made “${PatOS.fs.basename(path)}” in Documents and I’m opening it in Docs.`, `J’ai créé « ${PatOS.fs.basename(path)} » dans Documents et je l’ouvre dans Docs.`);
    } });

  // Piles: tidy a folder into folders by kind. Sensitive: it moves many files, so it asks first, and it can be undone
  const PLACES = { desktop: '/Desktop', downloads: '/Downloads', documents: '/Documents', pictures: '/Pictures' };
  function groupOf(name, n) {
    const ext = PatOS.fs.ext(name), k = PatOS.fileKind(name, n);
    if (k === 'image') return 'Images'; if (k === 'audio') return 'Music'; if (k === 'video') return 'Videos'; if (k === 'pdf') return 'PDFs'; if (k === 'link') return 'Links';
    if (['pdoc', 'docx', 'doc', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'Documents';
    if (['psheet', 'xlsx', 'xls', 'csv', 'ods'].includes(ext)) return 'Spreadsheets';
    if (['pslide', 'pptx', 'ppt', 'odp'].includes(ext)) return 'Presentations';
    if (['js', 'css', 'json', 'py', 'html', 'htm', 'pit'].includes(ext)) return 'Code';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'Archives';
    return null; // (anything else stays where it is)
  }
  skill({ id: 'files.tidy', app: 'finder', sensitive: true,
    match: (t) => { const m = /^(?:tidy(?:\s+up)?|organi[sz]e|clean(?:\s+up)?|sort)\s+(?:up\s+)?(?:my\s+|the\s+)?(desktop|downloads|documents|pictures)\b(?:\s+folder)?\s*[.!]*$/i.exec(t); return m ? { dir: PLACES[m[1].toLowerCase()] } : null; },
    run: ({ dir }) => {
      const where = PatOS.t(PatOS.fs.basename(dir));
      if (!PatOS.fs.isDir(dir)) return L(`There is no ${where} folder.`, `Il n’y a pas de dossier ${where}.`);
      // (the folder that would be made for a group is never itself moved, and folders are left alone)
      const plan = PatOS.fs.list(dir).filter((it) => it.type === 'file').map((it) => ({ from: it.path, g: groupOf(it.name, it) })).filter((x) => x.g && PatOS.fs.basename(dir) !== x.g);
      if (plan.length < 2) return L(`${where} is already tidy: nothing to sort.`, `${where} est déjà en ordre : rien à trier.`);
      const by = {}; plan.forEach((x) => { by[x.g] = (by[x.g] || 0) + 1; });
      const groups = Object.keys(by).sort((a, b) => by[b] - by[a]);
      return {
        text: L(`I can tidy ${where}: ${plan.length} files into ${groups.length === 1 ? 'one folder' : groups.length + ' folders'} (${groups.map((g) => g + ' ' + by[g]).join(', ')}). Nothing is deleted, and you can undo it. Should I?`,
          `Je peux ranger ${where} : ${plan.length} fichiers dans ${groups.length === 1 ? 'un dossier' : groups.length + ' dossiers'} (${groups.map((g) => PatOS.t(g) + ' ' + by[g]).join(', ')}). Rien n’est supprimé, et tu peux annuler. Je le fais?`),
        confirm() {
          const made = [], moved = []; let failed = 0;
          groups.forEach((g) => { const p = dir + '/' + PatOS.t(g); if (!PatOS.fs.exists(p)) { try { PatOS.fs.mkdir(p); made.push(p); } catch (e) {} } });
          plan.forEach((x) => { const to = dir + '/' + PatOS.t(x.g); try { const np = PatOS.fs.move(x.from, to); if (PatOS.fs.exists(np) && !PatOS.fs.exists(x.from)) moved.push({ from: x.from, now: np }); else failed++; } catch (e) { failed++; } });
          ctx.undo = moved.length ? { moved, made, t: Date.now(), where } : null;
          if (!moved.length) return L('I couldn’t move any file.', 'Je n’ai pu déplacer aucun fichier.');
          return L(`Done: I moved ${moved.length} file${moved.length > 1 ? 's' : ''} in ${where}` + (failed ? ` (${failed} couldn’t be moved)` : '') + '. Say “undo” to put them back.', `C’est fait : j’ai déplacé ${moved.length} fichier${moved.length > 1 ? 's' : ''} dans ${where}` + (failed ? ` (${failed} n’ont pas pu l’être)` : '') + '. Écris « annule » pour les remettre.');
        }
      };
    } });
  skill({ id: 'files.undo', match: (t) => (/^(?:undo|undo that|put (?:them|it) back)\s*[.!]*$/i.test(t) && ctx.undo ? {} : null),
    run: () => {
      const u = ctx.undo; ctx.undo = null; let back = 0;
      u.moved.slice().reverse().forEach((m) => { try { const dir = PatOS.fs.dirname(m.from); const np = PatOS.fs.move(m.now, dir); if (PatOS.fs.basename(np) !== PatOS.fs.basename(m.from) && !PatOS.fs.exists(m.from)) PatOS.fs.rename(np, PatOS.fs.basename(m.from)); back++; } catch (e) {} });
      u.made.forEach((p) => { try { if (PatOS.fs.isDir(p) && !PatOS.fs.list(p).length) PatOS.fs.remove(p, true); } catch (e) {} });
      return back === u.moved.length ? L(`Put back: ${back} file${back > 1 ? 's' : ''} are where they were.`, `Remis : ${back} fichier${back > 1 ? 's sont' : ' est'} à sa place.`) : L(`I put back ${back} of ${u.moved.length} files.`, `J’ai remis ${back} fichiers sur ${u.moved.length}.`);
    } });

  // summaries of a text you give (or one of your notes): Pat picks the sentences that matter most; it doesn't write new ones
  function keySentences(text) {
    const sents = String(text).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”»)]?|[^.!?]+$/g) || [];
    const list = sents.map((s) => s.trim()).filter((s) => words(s).length > 2);
    if (list.length <= 2) return null;
    const freq = {}; list.forEach((s) => words(s).forEach((w) => { if (!STOP.has(w) && w.length > 2) freq[w] = (freq[w] || 0) + 1; }));
    const scored = list.map((s, i) => { const ws = words(s).filter((w) => !STOP.has(w) && w.length > 2); return { s, i, v: ws.reduce((a, w) => a + freq[w], 0) / Math.pow(Math.max(ws.length, 1), 0.6) + (i === 0 ? 0.6 : 0) }; });
    const n = Math.max(1, Math.min(3, Math.round(list.length / 4)));
    return scored.sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
  }
  const summaryText = (k) => L('The key sentences (I pick them from the text; I don’t write new ones):\n', 'Les phrases clés (je les choisis dans le texte, je n’en écris pas de nouvelles) :\n') + k.map((s) => '• ' + s).join('\n');
  skill({ id: 'summarize.note', app: 'notes', match: (t) => { const m = /^(?:summari[sz]e|sum up)\s+(?:my\s+|the\s+)?note\s+(?:called\s+|named\s+|about\s+)?(.+)/i.exec(t); return m ? { q: m[1] } : null; },
    run: ({ q }) => { const r = searchNotes(q); if (!r.length) return L(`No note mentions “${q}”.`, `Aucune note ne parle de « ${q} ».`); const k = keySentences(plain(r[0].n.body)); return (r[0].n.title || '') + '\n' + (k ? summaryText(k) : L('That note is already short.', 'Cette note est déjà courte.')); } });
  skill({ id: 'summarize', match: (t) => { const m = /^(?:summari[sz]e|sum up|tl;?dr|give me (?:a|the) summary of)\s*(?:this|that)?\s*:?\s*([\s\S]{2,})$/i.exec(t); return m ? { text: m[1] } : null; },
    run: ({ text }) => { const k = keySentences(text); return k ? summaryText(k) : L('That is already short: there is nothing to cut.', 'C’est déjà court : il n’y a rien à couper.'); } });

  // the day at a glance: the calendar and the reminders
  skill({ id: 'day', app: 'calendar', match: (t) => (/^(?:my day|how(?:’s|'s| is) my day(?: looking)?|what(?:’s|'s| is) (?:up |on )?(?:for )?today|what do i have going on(?: today)?|brief me|daily (?:brief|summary)|plan my day)\s*\??$/i.test(t) ? {} : null),
    run: () => {
      const evs = PatOS.calendarOn ? PatOS.calendarOn(new Date()) : []; const k = today();
      const due = (PatOS.store.get('reminders', []) || []).filter((r) => !r.done && r.due && r.due <= k);
      const out = [L('Today, ', 'Aujourd’hui, ') + new Date().toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' }) + '.'];
      out.push(evs.length ? L('Calendar:\n', 'Calendrier :\n') + evs.map((e) => '• ' + (e.time ? fmtTime(e.time) + '  ' : L('All day  ', 'Toute la journée  ')) + e.title).join('\n') : L('Nothing on the calendar.', 'Rien dans le calendrier.'));
      out.push(due.length ? L('Reminders due:\n', 'Rappels à faire :\n') + due.slice(0, 6).map((r) => '• ' + r.text + (r.due < k ? L(' · overdue', ' · en retard') : '')).join('\n') : L('No reminders due.', 'Aucun rappel à faire.'));
      return out.join('\n');
    } });

  // Shortcuts: run one by name ("run shortcut good morning")
  skill({ id: 'shortcuts.run', app: 'shortcuts', match: (t) => { const m = /^(?:run|start|do|launch)\s+(?:the\s+|my\s+)?shortcut\s+(.+)/i.exec(t); return m ? { name: m[1].replace(/[.!?"“”]/g, '').trim() } : null; },
    run: ({ name }) => {
      const S = PatOS.shortcuts; if (!S) return L('Shortcuts isn’t available.', 'Raccourcis n’est pas disponible.');
      const sc = S.byName(name) || S.match(name);
      if (!sc) { const all = S.list().map((s) => s.name); return L(`No shortcut is called “${name}”.`, `Aucun raccourci ne s’appelle « ${name} ».`) + (all.length ? L(' Yours: ', ' Les tiens : ') + all.slice(0, 8).join(', ') + '.' : ''); }
      Promise.resolve(S.run(sc, { from: 'pat' })).then((r) => { if (r && r.ok === false) say(L(`“${sc.name}” stopped: `, `« ${sc.name} » s’est arrêté : `) + (r.log || []).filter((x) => !x.ok).map((x) => x.error).join(' ')); }).catch((e) => say(L(`“${sc.name}” stopped: `, `« ${sc.name} » s’est arrêté : `) + e.message));
      return L('Running ', 'Je lance ') + sc.name + '.';
    } });

  /* ---------- putting it together ---------- */
  // a yes or a no to what Pat asked (only for two minutes; anything else cancels the question)
  function answer(t) {
    const p = ctx.pending;
    if (!p) return /^(?:yes|yeah|yep|no|nope|cancel)\s*[.!]*$/i.test(t) ? L('There’s nothing waiting for a yes or a no right now.', 'Il n’y a rien qui attend un oui ou un non pour l’instant.') : null;
    if (Date.now() - p.t > 2 * 60 * 1000) { ctx.pending = null; return null; }
    if (/^(?:yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|go|confirm|please do)\s*[.!]*$/i.test(t)) { ctx.pending = null; try { return p.confirm(); } catch (e) { return L('That didn’t work: ', 'Ça n’a pas marché : ') + e.message; } }
    if (/^(?:no|nope|cancel|stop|don['’]t|never mind|not now)\s*[.!]*$/i.test(t)) { ctx.pending = null; return L('Okay, I left everything as it was.', 'D’accord, je n’ai rien changé.'); }
    ctx.pending = null; return null;
  }
  function runSkills(t) {
    for (const sk of skills) {
      let args = null; try { args = sk.match(t); } catch (e) { args = null; }
      if (!args) continue;
      let r; try { r = sk.run(args); } catch (e) { if (PatOS.errors) PatOS.errors.report(e, 'pat ' + sk.id); return L('That didn’t work: ', 'Ça n’a pas marché : ') + e.message; }
      if (r && typeof r === 'object' && r.confirm) { ctx.pending = { confirm: r.confirm, t: Date.now(), id: sk.id }; return r.text; }
      return r;
    }
    return null;
  }
  // one command, said any of the ways above; null when Pat does not understand it
  function one(text) {
    const t = prep(text);
    return answer(t) ?? runSkills(t) ?? basic(t);
  }
  // does this look like a command (without doing it)? Used to cut "open notes and set a timer" in two
  const STARTS = /^(?:open|launch|start|timer|set|wake|alarm|remind|note|take a note|write down|add|event|schedule|find|search|look|play|what(?:’s|'s| is)?|show|check|my|dark mode|light mode|turn|wallpaper|calendar|define|weather|roll|flip|pick|choose|summari[sz]e|tidy|organi[sz]e|clean|create|make|write|new|run|calculate|convert|tell me|brief me|ouvre|lance|mets|règle|regle|réveille|reveille|rappelle|prends|ajoute|crée|cree|cherche|trouve|joue|range|organise|résume|resume|minuteur|quelle|quel|écris|ecris)\b/i;
  const looksLikeCommand = (part) => { const x = prep(part); return STARTS.test(x) || !!(findApp(x) && appNames(findApp(x)).includes(x.toLowerCase())); };
  function split(text) {
    if (/^(?:summari[sz]e|sum up|tl;?dr|résume|resume|note\b|take a note|write down|prends une note)/i.test(text.trim())) return null; // (a text given to work on is never cut)
    const parts = text.split(/\s*(?:,\s*)?\b(?:and then|then|and also|and|after that|puis|ensuite|et puis|et aussi|et)\b\s*/i).map((x) => x.trim()).filter(Boolean);
    return parts.length > 1 && parts.length <= 4 && parts.every(looksLikeCommand) ? parts : null;
  }
  const HINTS = [
    [/remind|rappel/i, 'remind me to call Sam tomorrow at 5pm', 'rappelle-moi d’appeler Sam demain à 17h'], [/timer|minut/i, 'timer 10 min', 'minuteur 10 min'], [/alarm|wake|réveil|reveil/i, 'wake me at 7:30', 'réveille-moi à 7h30'],
    [/event|calendar|meeting|appointment|rendez|réunion|reunion|agenda|calendrier/i, 'add event dentist friday 2pm', 'ajoute un événement dentiste vendredi 14h'], [/note/i, 'search notes for recipe', 'cherche dans mes notes recette'],
    [/file|document|doc\b|fichier/i, 'find documents about trip', 'trouve des documents sur voyage'], [/open|launch|ouvr|lance/i, 'open notes', 'ouvre notes'], [/summar|résum|resum/i, 'summarize: (paste a text)', 'résume : (colle un texte)'],
    [/tidy|organi|clean|sort|range|trie|ménage|menage/i, 'tidy my downloads', 'range mes téléchargements'], [/shortcut|raccourci/i, 'run shortcut good morning', 'lance le raccourci bonjour']
  ];
  function notUnderstood(text) {
    const h2 = HINTS.find(([re]) => re.test(text));
    if (h2) return L('I didn’t catch that one. Try it like this: “' + h2[1] + '”. Type “help” for everything I can do.', 'Je n’ai pas compris. Essaie comme ceci : « ' + h2[2] + ' ». Écris « aide » pour tout ce que je sais faire.');
    return pick(FR() ? ['Je ne suis pas sûr de comprendre. Écris « aide » pour voir ce que je sais faire.', 'Ça, je ne sais pas encore le faire. Essaie « aide ».'] : ['I’m not sure what you mean. Type "help" to see what I can do.', 'That one’s beyond me for now. Try "help".', 'I can’t answer that, sorry. I’m better at opening apps, timers, quick math and reminders.']);
  }
  const MORE_HELP = () => L('\n\nNew:\n• search notes for recipe\n• find documents about trip\n• create a document called Trip plan\n• tidy my downloads (asks first, and you can undo)\n• summarize: (paste a text)\n• my day\n• run shortcut good morning\n• two at once: open notes and set a timer for 5 min\n• after a list: open it · the second one',
    '\n\nNouveau :\n• cherche dans mes notes recette\n• trouve des documents sur voyage\n• crée un document appelé Voyage\n• range mes téléchargements (demande d’abord, et tu peux annuler)\n• résume : (colle un texte)\n• ma journée\n• lance le raccourci bonjour\n• deux à la fois : ouvre notes et mets un minuteur de 5 minutes\n• après une liste : ouvre-le · le deuxième');
  function reply(text) {
    text = String(text || '').trim(); if (!text) return '';
    const parts = split(text);
    if (parts) { const outs = parts.map((p) => one(p) || notUnderstood(p)); return outs.join('\n'); }
    const r = one(text);
    if (r == null) return notUnderstood(text);
    if (/^(?:help|aide)\b|what can you do|que peux-tu faire|qu['’]est-ce que tu peux faire/i.test(prep(text)) && typeof r === 'string') return r + MORE_HELP();
    return r;
  }
  // what to suggest under the chat, from what is going on
  function suggestions() {
    const fr = FR(), out = [];
    if (ctx.pending) return fr ? ['oui', 'non'] : ['yes', 'no'];
    if (recent()) out.push(fr ? 'ouvre-le' : 'open it');
    if (ctx.undo && Date.now() - ctx.undo.t < 10 * 60 * 1000) out.push(fr ? 'annule' : 'undo');
    const k = today(); const due = (PatOS.store.get('reminders', []) || []).some((r) => !r.done && r.due && r.due <= k);
    const evs = PatOS.calendarOn ? PatOS.calendarOn(new Date()).length : 0;
    if (due || evs) out.push(fr ? 'ma journée' : 'my day');
    const hr = new Date().getHours();
    (fr ? (hr < 11 ? ['ma journée', 'minuteur 10 min', 'aide'] : ['minuteur 10 min', 'cherche dans mes notes', 'range mes téléchargements', 'raconte une blague', 'aide'])
      : (hr < 11 ? ['my day', 'timer 10 min', 'help'] : ['timer 10 min', 'search notes for', 'tidy my downloads', 'tell me a joke', 'help'])).forEach((x) => { if (!out.includes(x)) out.push(x); });
    return out.slice(0, 6);
  }
  PatOS.assistantReply = reply;

  /* Pat, the command helper: the same chat as always, now in a panel that opens from the Pat button in the top bar */
  /* the chat with Pat, as an element: a list of messages, quick suggestions, and a box to type in */
  function patHelper() {
      let log = PatOS.store.get('chatLog', null) || [{ from: 'pat', text: PatOS.lang === 'fr' ? `Salut ${PatOS.settings.userName}, moi c’est Pat. Demande-moi d’ouvrir une app, de faire un calcul ou d’ajouter un rappel. Écris « aide » si tu veux la liste.` : `Hi ${PatOS.settings.userName}, I’m Pat. Ask me to open an app, do some math or add a reminder. Type "help" if you want the list.`, t: Date.now() }];
      const list = h('div', { class: 'msg-list' });
      const input = h('input', { class: 'msg-in', placeholder: PatOS.t('Ask Pat') + '…', spellcheck: 'true', autocomplete: 'off', enterkeyhint: 'send', 'aria-label': PatOS.t('Message Pat') });
      const send = h('button', { class: 'msg-send', 'aria-label': 'Send' }, '↑');
      // suggestions follow what is going on (a yes/no question, a list to open, what is due today); a suggestion that needs
      // the rest of the sentence ("search notes for") goes into the box instead of being sent
      const chips = h('div', { class: 'msg-chips' });
      function drawChips() {
        chips.innerHTML = '';
        suggestions().forEach((c) => chips.appendChild(h('button', { class: 'no-tr', onclick: () => { if (/(?:\bfor|dans mes notes)$/.test(c)) { input.value = c + ' '; input.focus(); } else submit(c); } }, c)));
      }
      const head = h('div', { class: 'msg-head' }, h('div', { class: 'msg-av sm' }, 'P'), h('b', {}, 'Pat'));
      const mic = PatOS.voice && PatOS.voice.supported() ? h('button', { class: 'msg-mic', title: PatOS.t('Ask with your voice'), 'aria-label': PatOS.t('Ask with your voice'), html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>' }) : null;
      const root = h('div', { class: 'msg-main pat-main' }, head, list, chips, h('div', { class: 'msg-bar' }, mic, input, send));
      function bubble(m, anim) {
        const b = h('div', { class: 'msg-b ' + (m.from === 'me' ? 'me' : 'them') + (anim ? ' pop' : ''), title: m.t ? new Date(m.t).toLocaleString(PatOS.locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null }, m.text);
        list.appendChild(b); list.scrollTop = list.scrollHeight;
      }
      function render() { list.innerHTML = ''; log.slice(-80).forEach((m) => bubble(m)); }
      function submit(text, how) {
        text = (text || input.value).trim(); if (!text) return; input.value = '';
        sent.push(text); sent = sent.slice(-50); histAt = -1;
        const me = { from: 'me', text, t: Date.now() }; log.push(me); bubble(me, true);
        PatOS.sound.tone(1100, 0.08, { vol: 0.06, slide: 1500 });
        const typing = h('div', { class: 'msg-b them typing' }, h('i'), h('i'), h('i')); list.appendChild(typing); list.scrollTop = list.scrollHeight;
        setTimeout(() => {
          typing.remove();
          let out = PatOS.assistantReply ? PatOS.assistantReply(text) : reply(text);
          if (out === '\u0000clear') { clearChat(); return; }
          const r = { from: 'pat', text: out, t: Date.now() }; log.push(r); bubble(r, true); drawChips();
          // asked out loud: the answer is said out loud too (Settings › Pat's voice can turn it off)
          if (how === 'voice' && PatOS.voice && PatOS.voice.speaks()) PatOS.voice.speak(String(out).replace(/[•\n]+/g, '. '));
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
      if (mic) { let stop = null; mic.onclick = () => { if (stop) { stop(); return; } mic.classList.add('on'); input.placeholder = PatOS.t('Listening…'); stop = PatOS.voice.listenOnce((t) => { submit(t, 'voice'); }, (err) => { stop = null; mic.classList.remove('on'); input.placeholder = PatOS.t('Ask Pat') + '…'; if (err) PatOS.notify({ title: 'Pat', body: err.message, icon: 'messages' }); }); }; }
      send.onclick = () => submit();
      // something Pat started that turned out not to work (an app that did not open, a shortcut that stopped) is said here
      PatOS.on('pat:say', (text) => { if (!root.isConnected && !document.body.contains(root)) return; const r = { from: 'pat', text: String(text), t: Date.now() }; log.push(r); bubble(r, true); PatOS.store.set('chatLog', log.slice(-200)); });
      render(); drawChips();
      return { el: root, focus: () => { drawChips(); input.focus(); }, clear: clearAsk };
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
  PatOS.pat = { skill, skills: () => skills.map((x) => ({ id: x.id, app: x.app || null, sensitive: !!x.sensitive })), suggestions, open, close, toggle, isOpen, ask: (t) => { open(); const i = box.querySelector('.msg-in'); if (i) { i.value = t; i.focus(); } } };
  /* on a phone there is no menu bar: Pat is an app in Launchpad that opens the same panel */
  PatOS.iconDefs.pat = { bg: 'linear-gradient(160deg,#7d5cff,#ff4fa0)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M12 14h40a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H31L19 56a1.5 1.5 0 0 1-2.5-1.2V46H12a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#fff"/><circle cx="22" cy="30" r="3.4" fill="#7d5cff"/><circle cx="32" cy="30" r="3.4" fill="#a05cff"/><circle cx="42" cy="30" r="3.4" fill="#ff4fa0"/></svg>' };
  PatOS.registerApp({ id: 'pat', name: 'Pat', icon: 'pat', category: 'Utilities', keywords: 'pat helper assistant commands timer hey pat voice command chat', about: 'Pat, the command helper: type or say what you want (open an app, a timer, a reminder, the weather). A fixed list of commands, not an AI.', action: () => toggle() });
})();
