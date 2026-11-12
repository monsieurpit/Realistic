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
  const say = (text, r) => PatOS.emit('pat:say', r && (r.card || r.buttons) ? { text, rich: { card: r.card, buttons: r.buttons } } : text);
  let pendingWeb = false; // a web answer is on its way
  const WAIT = () => L('One moment…', 'Un instant…'), LOOK = () => L('Let me look that up…', 'Je cherche…');
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
    // (opening apps, timers, alarms, the calendar, reminders, notes, finding files: PatOS Intelligence, js/intelligence.js)
    if (/^clear( chat| the chat| conversation)?$/.test(l)) return '\u0000clear';
    if (/\btime\b/.test(l) && !/timer/.test(l)) return L('It’s ', 'Il est ') + new Date().toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }) + '.';
    if (/\b(date|day is it|today)\b/.test(l) && !/calendar|due/.test(l)) return L('Today is ', 'On est le ') + new Date().toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '.';
    if ((m = l.match(/^(?:pick|choose)\s+(?:between\s+)?(.+)/)) && /,|\bor\b|\bou\b/.test(m[1])) { const opts = t.replace(/^(?:pick|choose)\s+(?:between\s+)?/i, '').split(/\s*,\s*|\s+or\s+|\s+ou\s+/i).map((x) => x.trim()).filter(Boolean); if (opts.length > 1) return L('I pick: ', 'Je choisis : ') + pick(opts) + '.'; }
    if (/joke/.test(l)) return pick(FR() ? JOKES_FR : JOKES);
    if (/fact/.test(l)) return L('Fun fact: ', 'Le savais-tu? ') + pick(FR() ? FACTS_FR : FACTS);
    if (/flip a coin|coin flip/.test(l)) return Math.random() < 0.5 ? L('Heads.', 'Pile.') : L('Tails.', 'Face.');
    if ((m = l.match(/roll (?:a )?(?:die|dice|d(\d+))/))) { const n = Math.max(2, Math.min(1000, +(m[1] || 6))); return L('You rolled a ', 'Tu as fait ') + (1 + Math.floor(Math.random() * n)) + '.'; }
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
  // a skill is also an action of PatOS Intelligence (js/intelligence.js), so Spotlight, Shortcuts and apps find it the same way
  const SKILL_PERM = { notes: 'notes', finder: 'files', docs: 'files.write', calendar: 'calendar', shortcuts: 'shortcuts' };
  function skill(def) {
    if (!def || !def.id || !def.match || !def.run || skills.some((s) => s.id === def.id)) return;
    skills.push(def);
    if (PatOS.intel) PatOS.intel.action({ id: 'pat.' + def.id, owner: def.app || 'pat', title: def.title || def.id, permission: (def.sensitive && def.app === 'finder') ? 'files.write' : SKILL_PERM[def.app] || null, priority: 35, match: (t, raw) => def.match(raw), run: (a) => def.run(a) });
  }
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
    return answer(t) ?? intel(t) ?? basic(t) ?? guess(t) ?? web(t);
  }
  /* a question nothing here knows: a short answer from the web (Wikipedia), with its source and a Google button */
  function web(t) {
    if (!PatOS.intel || !PatOS.intel.webAnswer || !PatOS.intel.isQuestion(t)) return null;
    if (navigator.onLine === false || PatOS.sandboxed) return L('I don’t know that one, and I can’t look it up offline. Ask me again when you’re online.', 'Je ne sais pas, et je ne peux pas chercher hors ligne. Redemande-moi quand tu seras en ligne.');
    pendingWeb = true;
    PatOS.intel.webAnswer(t).then((r) => { pendingWeb = false; if (r) say(r.message, r); else say(L('I couldn’t find a clear answer. Want to search Google?', 'Je n’ai pas trouvé de réponse claire. Chercher sur Google?'), { buttons: [{ label: L('Search Google', 'Chercher sur Google'), url: 'https://www.google.com/search?q=' + encodeURIComponent(t) }] }); },
      () => { pendingWeb = false; say(L('I couldn’t reach Wikipedia right now.', 'Je n’ai pas pu joindre Wikipédia.'), { buttons: [{ label: L('Search Google', 'Chercher sur Google'), url: 'https://www.google.com/search?q=' + encodeURIComponent(t) }] }); });
    return LOOK();
  }
  // last of all: the closest simple command, as a question ("Did you mean…?"), never done without a yes
  function guess(t) { if (!PatOS.intel) return null; const r = PatOS.intel.respond(t, { source: 'pat', guess: true }); return r && r.status === 'confirm' ? show(r) : null; }
  /* PatOS Intelligence first: every action it knows (and Pat's skills, which are actions too) */
  function intel(t) {
    if (!PatOS.intel) return runSkills(t);
    let r = PatOS.intel.respond(t, { source: 'pat' });
    if (r == null && FR()) { const f = fromFrench(t); if (f !== t) r = PatOS.intel.respond(f, { source: 'pat' }); }
    return r == null ? null : show(r);
  }
  function show(r) {
    if (r && typeof r.then === 'function') { r.then((x) => { const t = show(x); const rr = takeRich(); say(t, rr); }, (e) => say(L('That didn’t work: ', 'Ça n’a pas marché : ') + (e && e.message))); return WAIT(); }
    if (r && (r.card || r.buttons)) rich = { card: r.card, buttons: r.buttons };
    if (r.status === 'confirm') { ctx.pending = { confirm: () => show(r.confirm()), t: Date.now() }; return r.message; }
    return r.message;
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
    // the closest things PatOS Intelligence knows (from its examples), when there are some
    const near = PatOS.intel && PatOS.intel.closest ? PatOS.intel.closest(text, 2) : [];
    if (near.length) return L('I’m not sure what you mean. Did you mean “' + near.join('” or “') + '”? Type “help” for everything I can do.', 'Je ne suis pas sûr de comprendre. Voulais-tu dire « ' + near.join(' » ou « ') + ' »? Écris « aide » pour tout ce que je sais faire.');
    return pick(FR() ? ['Je ne suis pas sûr de comprendre. Écris « aide » pour voir ce que je sais faire.', 'Ça, je ne sais pas encore le faire. Essaie « aide ».'] : ['I’m not sure what you mean. Type "help" to see what I can do.', 'That one’s beyond me for now. Try "help".', 'I can’t answer that, sorry. I’m better at opening apps, timers, quick math and reminders.']);
  }
  const MORE_HELP = () => L('\n\nNew:\n• search notes for recipe\n• find documents about trip\n• create a document called Trip plan\n• tidy my downloads (asks first, and you can undo)\n• summarize: (paste a text)\n• my day\n• run shortcut good morning\n• two at once: open notes and set a timer for 5 min\n• after a list: open it · the second one',
    '\n\nNouveau :\n• cherche dans mes notes recette\n• trouve des documents sur voyage\n• crée un document appelé Voyage\n• range mes téléchargements (demande d’abord, et tu peux annuler)\n• résume : (colle un texte)\n• ma journée\n• lance le raccourci bonjour\n• deux à la fois : ouvre notes et mets un minuteur de 5 minutes\n• après une liste : ouvre-le · le deuxième');
  function reply(text) {
    text = String(text || '').trim(); if (!text) return '';
    const parts = split(text);
    // several commands: PatOS Intelligence does them all and reports each step (✓/✗); Pat's own split is for the rest
    if (parts && PatOS.intel) { const whole = intel(prep(text)); if (whole != null && /^(?:✓|✗|…) /m.test(whole)) return whole; }
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
    if (PatOS.intel && PatOS.intel.waiting && PatOS.intel.waiting()) return fr ? ['annule'] : ['cancel'];
    if (PatOS.intel && PatOS.intel.suggestions) PatOS.intel.suggestions(3).forEach((x) => out.push(x));
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
  /* ================= Pat's conversation (3.2): a premium panel =================
     A living orb that shows what Pat is doing, a welcome with things to try, Pat's answers as clean text with cards (an
     answer with its source, a translation, the weather), buttons inside answers, and a composer with voice. Everything is
     built from text nodes (never HTML from an answer), and the list is a live region for screen readers. */
  let rich = null; // the card and buttons of the answer being shown (set by show(), taken by the panel)
  const takeRich = () => { const r = rich; rich = null; return r; };
  /* every icon of the panel, drawn here (one stroke style: 24-unit grid, round caps) */
  const ic = (d, w) => '<svg viewBox="0 0 24 24" width="' + (w || 18) + '" height="' + (w || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const SVG = {
    send: ic('<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke-width="2.4"/>'),
    mic: ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>'),
    plus: ic('<path d="M14.5 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5V9.5"/><path d="M17.5 3.5l3 3-7 7H10.5v-3z"/>', 17),
    gear: ic('<circle cx="12" cy="12" r="2.8"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4z"/>', 17),
    close: ic('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="2.2"/>', 16),
    copy: ic('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5A2 2 0 0 0 13.5 4.5h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>', 15),
    speak: ic('<path d="M4.5 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>', 15),
    down: ic('<path d="M12 5v14M6 13l6 6 6-6" stroke-width="2.2"/>', 16),
    check: ic('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.4"/>', 14),
    cross: ic('<path d="M7 7l10 10M17 7 7 17" stroke-width="2.4"/>', 14),
    out: ic('<path d="M13.5 4.5h6v6M19.5 4.5l-8 8M17.5 13.5v4a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h4"/>', 13),
    search: ic('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>', 14),
    // the suggestion cards
    day: ic('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/>', 20),
    weather: ic('<circle cx="9" cy="9" r="3.2"/><path d="M9 2.8v1.4M3.5 9H2.3M4.8 4.8l1 1M13.2 4.8l-1 1"/><path d="M8.5 19.5h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5 1.3 2.9 2.9 0 0 0 .2 5.7z"/>', 20),
    translate: ic('<path d="M3.5 6h9M8 4v2c0 4-2.2 7-5 8.5M5.5 9.5c1.2 2.4 3.3 4.2 6 5"/><path d="M12.5 20l4-9 4 9M14 16.8h5"/>', 20),
    place: ic('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>', 20),
    timer: ic('<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M10 2.8h4M18.5 6.5l1.5-1.5"/>', 20),
    idea: ic('<path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16.5h5v-.6c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>', 20)
  };
  // things to try: [icon, color, title, what to say]
  const TRY = () => FR()
    ? [['day', '#ff453a', 'Ma journée', 'ma journée'], ['weather', '#0a84ff', 'La météo', 'quel temps fait-il'], ['translate', '#5e5ce6', 'Traduire', 'traduis bonne nuit en espagnol'], ['place', '#30d158', 'Lieux', 'trouve une pharmacie près de moi'], ['timer', '#ff9f0a', 'Minuteur', 'minuteur 25 min'], ['idea', '#bf5af2', 'Une question', 'quelle est la capitale du Japon']]
    : [['day', '#ff453a', 'My day', 'my day'], ['weather', '#0a84ff', 'Weather', 'what’s the weather'], ['translate', '#5e5ce6', 'Translate', 'translate good night to Spanish'], ['place', '#30d158', 'Places', 'find a pharmacy near me'], ['timer', '#ff9f0a', 'Timer', 'timer 25 min'], ['idea', '#bf5af2', 'Ask anything', 'what is the capital of Japan']];
  /* the orb: a glass sphere with liquid colors inside (three soft blobs that drift), a highlight and a rim */
  const ORB = (cls) => h('div', { class: 'pat-orb ' + (cls || ''), 'aria-hidden': 'true' }, h('span', { class: 'po-b po-1' }), h('span', { class: 'po-b po-2' }), h('span', { class: 'po-b po-3' }), h('span', { class: 'po-gloss' }));
  function patHelper() {
      let log = PatOS.store.get('chatLog', null) || [];
      const list = h('div', { class: 'pat3-list', role: 'log', 'aria-live': 'polite', 'aria-label': PatOS.t('Conversation with Pat') });
      const input = h('textarea', { class: 'pat3-in', rows: 1, placeholder: PatOS.t('Ask Pat') + '…', spellcheck: 'true', autocomplete: 'off', enterkeyhint: 'send', 'aria-label': PatOS.t('Message Pat') });
      const send = h('button', { class: 'pat3-send', 'aria-label': PatOS.t('Send'), html: SVG.send, disabled: true });
      const orb = ORB('po-head');
      const status = h('small', { class: 'pat3-status', role: 'status' });
      const STATUS = { '': ['Ready', 'Prêt'], think: ['Thinking…', 'Je réfléchis…'], listen: ['Listening…', 'J’écoute…'], look: ['Looking it up…', 'Je cherche…'] };
      const state = (s) => { root.dataset.state = s || ''; const off = navigator.onLine === false && !s; status.textContent = off ? L('Offline · what’s on this device still works', 'Hors ligne · ce qui est sur l’appareil marche') : L(STATUS[s || ''][0], STATUS[s || ''][1]); };
      const chips = h('div', { class: 'pat3-chips', role: 'toolbar', 'aria-label': PatOS.t('Suggestions') });
      function drawChips() {
        chips.innerHTML = '';
        suggestions().forEach((c) => chips.appendChild(h('button', { class: 'pat3-chip no-tr', onclick: () => { if (/(?:\bfor|dans mes notes)$/.test(c)) { input.value = c + ' '; grow(); input.focus(); } else submit(c); } }, c)));
      }
      const head = h('div', { class: 'pat3-head' }, orb, h('div', { class: 'pat3-title' }, h('b', {}, 'Pat'), status), h('div', { style: { flex: 1 } }),
        h('button', { class: 'pat3-hb', title: PatOS.t('New conversation'), 'aria-label': PatOS.t('New conversation'), html: SVG.plus, onclick: () => clearAsk() }),
        h('button', { class: 'pat3-hb', title: PatOS.t('Settings'), 'aria-label': PatOS.t('Pat & Intelligence settings'), html: SVG.gear, onclick: () => { close(); PatOS.launch('settings', { pane: 'intelligence' }); } }),
        h('button', { class: 'pat3-hb', title: PatOS.t('Close'), 'aria-label': PatOS.t('Close'), html: SVG.close, onclick: () => close() }));
      const mic = PatOS.voice && PatOS.voice.supported() ? h('button', { class: 'pat3-mic', title: PatOS.t('Ask with your voice'), 'aria-label': PatOS.t('Ask with your voice'), html: SVG.mic }) : null;
      // back to the newest message, when you scrolled up
      const toEnd = h('button', { class: 'pat3-end', 'aria-label': PatOS.t('Latest message'), html: SVG.down, onclick: () => { list.scrollTop = list.scrollHeight; } });
      const root = h('div', { class: 'pat3' }, head, h('div', { class: 'pat3-mid' }, list, toEnd), chips, h('div', { class: 'pat3-bar' }, mic, input, send));
      list.addEventListener('scroll', () => { toEnd.classList.toggle('on', list.scrollHeight - list.scrollTop - list.clientHeight > 120); }, { passive: true });
      addEventListener('online', () => state(root.dataset.state)); addEventListener('offline', () => state(root.dataset.state));
      const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; send.disabled = !input.value.trim(); };
      input.addEventListener('input', grow);
      /* the welcome: a greeting and things to try */
      function welcome() {
        const hr = new Date().getHours(); const nm = PatOS.settings.userName;
        const hi = FR() ? (hr < 12 ? 'Bon matin, ' : hr < 18 ? 'Bon après-midi, ' : 'Bonsoir, ') : (hr < 12 ? 'Good morning, ' : hr < 18 ? 'Good afternoon, ' : 'Good evening, ');
        return h('div', { class: 'pat3-welcome' }, ORB('po-big'), h('h2', {}, hi + nm), h('p', {}, L('Ask me to do something on PatOS, or ask a question. I work offline and always say exactly what I did.', 'Demande-moi de faire quelque chose dans PatOS, ou pose une question. Je marche hors ligne et je dis toujours exactement ce que j’ai fait.')),
          h('div', { class: 'pat3-try' }, ...TRY().map(([icon, color, t, ask]) => h('button', { class: 'pat3-card-try', style: { '--c': color }, onclick: () => submit(ask) }, h('span', { class: 'pat3-ti', html: SVG[icon] }), h('b', {}, t), h('small', {}, '“' + ask + '”')))));
      }
      /* an answer's text: lines become a list, ✓/✗ lines become steps; never HTML */
      function body(text) {
        const out = h('div', { class: 'pat3-text' }); let ul = null;
        String(text).split('\n').forEach((line) => {
          const m = /^\s*(•|✓|✗|…|\d+\.)\s+(.*)$/.exec(line);
          if (m) { if (!ul) { ul = h('ul', { class: 'pat3-ul' }); out.appendChild(ul); } ul.appendChild(h('li', { class: m[1] === '✓' ? 'ok' : m[1] === '✗' ? 'bad' : m[1] === '…' ? 'wait' : '' }, m[1] === '•' ? h('span', { class: 'pat3-dot', 'aria-hidden': 'true' }) : m[1] === '✓' ? h('span', { class: 'pat3-mark', html: SVG.check }) : m[1] === '✗' ? h('span', { class: 'pat3-mark', html: SVG.cross }) : h('span', { class: 'pat3-mark', 'aria-hidden': 'true' }, m[1]), h('span', { class: 'sr-only' }, m[1] === '✓' ? PatOS.t('Done') + ': ' : m[1] === '✗' ? PatOS.t('Didn’t work') + ': ' : ''), m[2])); }
          else { ul = null; if (line.trim()) out.appendChild(h('p', {}, line)); }
        });
        return out;
      }
      function cardEl(c) {
        if (!c) return null;
        return h('div', { class: 'pat3-ans' }, c.image ? h('img', { src: c.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
          h('div', {}, c.title ? h('small', { class: 'pat3-ans-t' }, c.title) : null, c.value ? h('div', { class: 'pat3-ans-v' }, c.value) : null, c.text ? h('p', {}, c.text) : null, c.sub ? h('small', { class: 'pat3-ans-s' }, c.sub) : null,
            c.source ? (c.url ? h('a', { class: 'pat3-src', href: c.url, target: '_blank', rel: 'noopener noreferrer' }, PatOS.t('Source') + ': ' + c.source, h('span', { html: SVG.out })) : h('small', { class: 'pat3-src' }, PatOS.t('Source') + ': ' + c.source)) : null));
      }
      function acts(b) {
        if (!b || !b.length) return null;
        return h('div', { class: 'pat3-acts' }, ...b.map((x) => h('button', { class: 'pat3-act', html: (x.url ? SVG.search : '') + '<span></span>', onclick: () => { if (x.url) PatOS.openExternal ? PatOS.openExternal(x.url) : window.open(x.url, '_blank', 'noopener'); else if (x.launch) PatOS.launch(x.launch, x.args || {}); else if (x.say) submit(x.say); } })).map((el, i) => { el.querySelector('span:last-child').textContent = b[i].label; return el; }));
      }
      function bubble(m, anim) {
        const wel = list.querySelector('.pat3-welcome'); if (wel) wel.remove();
        const time = m.t ? new Date(m.t).toLocaleString(PatOS.locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null;
        const el = m.from === 'me' ? h('div', { class: 'pat3-me' + (anim ? ' in' : ''), title: time }, h('div', { class: 'pat3-mb' }, m.text))
          : h('div', { class: 'pat3-pat' + (anim ? ' in' : ''), title: time }, ORB('po-av'), h('div', { class: 'pat3-pc' }, body(m.text), cardEl(m.card), acts(m.buttons),
              // under each answer: copy it, hear it
              h('div', { class: 'pat3-tools' }, h('button', { class: 'pat3-tool', title: PatOS.t('Copy'), 'aria-label': PatOS.t('Copy'), html: SVG.copy, onclick: (e) => { try { navigator.clipboard.writeText(m.text); const b2 = e.currentTarget; b2.classList.add('done'); setTimeout(() => b2.classList.remove('done'), 1200); } catch (x) {} } }),
                'speechSynthesis' in window ? h('button', { class: 'pat3-tool', title: PatOS.t('Read aloud'), 'aria-label': PatOS.t('Read aloud'), html: SVG.speak, onclick: () => { const u = new SpeechSynthesisUtterance(String(m.text).replace(/[•✓✗]/g, '')); u.lang = PatOS.lang === 'fr' ? 'fr-CA' : 'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u); } }) : null)));
        list.appendChild(el); list.scrollTop = list.scrollHeight;
      }
      function render() { list.innerHTML = ''; if (!log.length) list.appendChild(welcome()); else log.slice(-80).forEach((m) => bubble(m)); }
      function addPat(text, how, r) {
        const m = { from: 'pat', text: String(text), t: Date.now() }; if (r && r.card) m.card = r.card; if (r && r.buttons) m.buttons = r.buttons;
        log.push(m); bubble(m, true); drawChips(); state('');
        if (how === 'voice' && PatOS.voice && PatOS.voice.speaks()) PatOS.voice.speak(String(text).replace(/[•\n✓✗]+/g, '. '));
        PatOS.sound.tone(700, 0.12, { vol: 0.06 }); PatOS.sound.tone(1050, 0.12, { vol: 0.05, delay: 0.08 });
        if (log.length > 200) log = log.slice(-200);
        PatOS.store.set('chatLog', log);
      }
      function submit(text, how) {
        text = (text || input.value).trim(); if (!text) return; input.value = ''; grow();
        sent.push(text); sent = sent.slice(-50); histAt = -1;
        const me = { from: 'me', text, t: Date.now() }; log.push(me); bubble(me, true);
        PatOS.sound.tone(1100, 0.08, { vol: 0.06, slide: 1500 });
        const think = h('div', { class: 'pat3-pat pat3-thinking' }, ORB('po-av'), h('div', { class: 'pat3-dots', 'aria-label': PatOS.t('Thinking…') }, h('i'), h('i'), h('i')));
        list.appendChild(think); list.scrollTop = list.scrollHeight; state('think');
        setTimeout(() => {
          think.remove();
          const out = PatOS.assistantReply ? PatOS.assistantReply(text) : reply(text);
          if (out === '\u0000clear') { clearChat(); state(''); return; }
          lastHow = how;
          // an answer still on its way: the panel keeps "thinking" instead of showing a placeholder message
          if (out === WAIT() || out === LOOK()) { state(out === LOOK() ? 'look' : 'think'); waiting = h('div', { class: 'pat3-pat pat3-thinking' }, ORB('po-av'), h('div', { class: 'pat3-dots', 'aria-label': out }, h('i'), h('i'), h('i')), out === LOOK() ? h('small', { class: 'pat3-look' }, out) : null); list.appendChild(waiting); list.scrollTop = list.scrollHeight; return; }
          addPat(out, how, takeRich());
        }, PatOS.settings.reduceMotion ? 0 : 160 + Math.random() * 140);
      }
      let lastHow = null, waiting = null;
      // up and down bring back what you typed before; Enter sends, Shift+Enter is a new line
      let sent = log.filter((x) => x.from === 'me').map((x) => x.text).slice(-50), histAt = -1;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
        else if (e.key === 'ArrowUp' && sent.length && !input.value.includes('\n')) { e.preventDefault(); histAt = histAt < 0 ? sent.length - 1 : Math.max(0, histAt - 1); input.value = sent[histAt]; grow(); }
        else if (e.key === 'ArrowDown' && histAt >= 0) { e.preventDefault(); histAt++; if (histAt >= sent.length) { histAt = -1; input.value = ''; } else input.value = sent[histAt]; grow(); }
      });
      function clearChat() { log = []; PatOS.store.remove('chatLog'); sent = []; render(); drawChips(); }
      const clearAsk = async () => { if (!log.length) return; if (await PatOS.confirmBox(PatOS.t('Start a new conversation?'), PatOS.t('This conversation will be deleted.'), { ok: PatOS.t('New Conversation'), icon: 'pat' })) clearChat(); };
      if (mic) { let stop = null; mic.onclick = () => { if (stop) { stop(); return; } mic.classList.add('on'); state('listen'); input.placeholder = PatOS.t('Listening…'); stop = PatOS.voice.listenOnce((t) => { submit(t, 'voice'); }, (err) => { stop = null; mic.classList.remove('on'); state(''); input.placeholder = PatOS.t('Ask Pat') + '…'; if (err) PatOS.notify({ title: 'Pat', body: String(err), icon: 'pat' }); }); }; }
      send.onclick = () => submit();
      // something Pat finished later (a web answer, an app that did not open, a shortcut that stopped) is said here
      PatOS.on('pat:say', (x) => { if (!root.isConnected && !document.body.contains(root)) return; if (waiting) { waiting.remove(); waiting = null; } const o = typeof x === 'object' && x ? x : { text: x }; addPat(o.text, lastHow, o.rich || null); });
      render(); drawChips(); state('');
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
      box.append(built.el);
    }
    box.classList.remove('hidden'); bar && bar.classList.add('on'); setTimeout(() => built.focus(), 60);
  }
  function close() { if (box) box.classList.add('hidden'); if (bar) bar.classList.remove('on'); }
  const toggle = () => (isOpen() ? close() : open());
  if (bar) { bar.innerHTML = ICON; bar.title = PatOS.t('Pat'); bar.addEventListener('click', (e) => { e.stopPropagation(); toggle(); }); }
  document.addEventListener('pointerdown', (e) => { if (isOpen() && !e.target.closest('#pat-panel, #mb-pat, .dlg-layer, .menu')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen() && !e.defaultPrevented) close(); });
  PatOS.pat = { takeRich, skill, undoAt: () => (ctx.undo ? ctx.undo.t || 0 : 0), remember: (kind, items) => { ctx.list = { kind, items: (items || []).slice(0, 50), t: Date.now() }; }, skills: () => skills.map((x) => ({ id: x.id, app: x.app || null, sensitive: !!x.sensitive })), suggestions, open, close, toggle, isOpen, ask: (t) => { open(); const i = box.querySelector('.msg-in'); if (i) { i.value = t; i.focus(); } } };
  /* on a phone there is no menu bar: Pat is an app in Launchpad that opens the same panel */
  PatOS.iconDefs.pat = { bg: 'linear-gradient(160deg,#7d5cff,#ff4fa0)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M12 14h40a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H31L19 56a1.5 1.5 0 0 1-2.5-1.2V46H12a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#fff"/><circle cx="22" cy="30" r="3.4" fill="#7d5cff"/><circle cx="32" cy="30" r="3.4" fill="#a05cff"/><circle cx="42" cy="30" r="3.4" fill="#ff4fa0"/></svg>' };
  PatOS.registerApp({ id: 'pat', name: 'Pat', icon: 'pat', category: 'Utilities', keywords: 'pat helper assistant commands timer hey pat voice command chat', about: 'Pat, the command helper: type or say what you want (open an app, a timer, a reminder, the weather). A fixed list of commands, not an AI.', action: () => toggle() });
})();
