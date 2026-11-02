/* Messages — chat with Pat, the built-in assistant */
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
    const rules = [[/^(salut|bonjour|allo|allô|coucou)\b.*/i, 'hi'], [/^(aide|que peux-tu faire|qu'est-ce que tu peux faire).*/i, 'help'], [/^(ouvre|ouvrir|lance|lancer|démarre)\s+(?:l'|l’|la |le |les )?(.+)/i, 'open $2'],
      [/quelle heure/i, 'time'], [/quel jour|quelle date|la date/i, 'date'], [/^(rappelle-moi|rappelle moi)\s+(?:de |d'|d’)?(.+)/i, 'remind me to $2'], [/^(?:prends une note|note)\s*:?\s*(.+)/i, 'note: $1'],
      [/blague/i, 'joke'], [/anecdote|fait amusant|un fait/i, 'fact'], [/pile ou face/i, 'flip a coin'], [/lance (?:un |le )?dé/i, 'roll a die'], [/mode sombre/i, 'dark mode'], [/mode clair/i, 'light mode'],
      [/fond d.?écran/i, 'wallpaper'], [/(joue|mets) (de la musique|une chanson)/i, 'play music'], [/météo/i, 'weather'], [/merci/i, 'thanks'], [/qui es-tu|ton nom/i, 'who are you'], [/comment (ça|ca) va|ça va\?/i, 'how are you'],
      [/^(cherche|recherche)\s+(.+)/i, 'search $2'], [/^(définis|définition de|que veut dire)\s+(.+)/i, 'define $2'], [/liste des apps|quelles apps/i, 'list apps'], [/^combien (font|fait)\s+(.+)/i, '$2']];
    for (const [re, rep] of rules) if (re.test(t)) return t.replace(re, rep);
    return t;
  }
  function reply(text) {
    let t = text.trim(); if (FR()) t = fromFrench(t);
    const l = t.toLowerCase(); let m;
    const name = PatOS.settings.userName;
    if (/^(hi|hey|hello|yo|sup)\b/.test(l)) return L(`Hey ${name}. What do you need? I can open an app, do a quick calculation, add a reminder, or just tell you a bad joke. Type "help" for the full list.`, `Salut ${name}. Qu’est-ce qu’il te faut? Je peux ouvrir une app, faire un calcul, ajouter un rappel ou te raconter une mauvaise blague. Écris « aide » pour la liste complète.`);
    if (/\bhelp\b|what can you do/.test(l)) return L('Here’s what you can ask me:\n• open galaxy\n• what time is it?\n• 24 * 17 + 3\n• remind me to study for math\n• note: buy pencils\n• tell me a joke / a fact\n• flip a coin / roll a die\n• dark mode / light mode\n• change wallpaper\n• play music', 'Voici ce que tu peux me demander :\n• ouvre galaxie\n• quelle heure est-il?\n• 24 * 17 + 3\n• rappelle-moi d’étudier les maths\n• note : acheter des crayons\n• raconte une blague / une anecdote\n• pile ou face / lance un dé\n• mode sombre / mode clair\n• change le fond d’écran\n• joue de la musique');
    if ((m = l.match(/^(open|launch|start)\s+(.+)/))) {
      const q = m[2].replace(/[.!?]$/, '').trim();
      const nm = (k) => [PatOS.apps[k].name.toLowerCase(), PatOS.t(PatOS.apps[k].name).toLowerCase()];
      const id = PatOS.appOrder.find((k) => nm(k).includes(q) || k === q) || PatOS.appOrder.find((k) => nm(k).some((n) => n.includes(q)));
      if (id) { setTimeout(() => PatOS.launch(id), 500); return L(`Sure, opening ${PatOS.apps[id].name}.`, `D’accord, j’ouvre ${PatOS.t(PatOS.apps[id].name)}.`); }
      return L(`Hmm, I don’t have an app called "${q}". Say "list apps" and I’ll show you what’s there.`, `Hmm, je n’ai pas d’app appelée « ${q} ». Écris « liste des apps » et je te montre ce qu’il y a.`);
    }
    if (/list (all )?apps|what apps/.test(l)) return L('Here’s everything you’ve got: ', 'Voici tout ce que tu as : ') + PatOS.appOrder.filter((k) => !PatOS.apps[k].hidden).map((k) => PatOS.t(PatOS.apps[k].name)).join(', ') + '.';
    if (/\btime\b/.test(l)) return L('It’s ', 'Il est ') + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + '.';
    if (/\b(date|day is it|today)\b/.test(l)) return L('Today is ', 'On est le ') + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '.';
    if ((m = t.match(/^(?:remind me to|reminder:?|add reminder:?)\s+(.+)/i))) {
      const items = PatOS.store.get('reminders', []); items.push({ id: Date.now(), text: m[1], done: false }); PatOS.store.set('reminders', items);
      return L(`Got it. I added “${m[1]}” to your reminders.`, `C’est noté. J’ai ajouté « ${m[1]} » à tes rappels.`);
    }
    if ((m = t.match(/^(?:note:?|take a note:?|write down:?)\s+(.+)/i))) {
      const notes = PatOS.store.get('notes', []) || []; notes.unshift({ id: PatOS.uid(), title: m[1].slice(0, 40), body: '<div>' + PatOS.esc(m[1]) + '</div>', mtime: Date.now() }); PatOS.store.set('notes', notes);
      return L('Saved. You’ll find it at the top of Notes.', 'C’est enregistré. Tu la trouveras en haut de Notes.');
    }
    if (/joke/.test(l)) return pick(FR() ? JOKES_FR : JOKES);
    if (/fact/.test(l)) return L('Fun fact: ', 'Le savais-tu? ') + pick(FR() ? FACTS_FR : FACTS);
    if (/flip a coin|coin flip/.test(l)) return Math.random() < 0.5 ? L('Heads.', 'Pile.') : L('Tails.', 'Face.');
    if ((m = l.match(/roll (?:a )?(?:die|dice|d(\d+))/))) { const n = +(m[1] || 6); return L('You rolled a ', 'Tu as fait ') + (1 + Math.floor(Math.random() * n)) + '.'; }
    if (/dark mode/.test(l)) { PatOS.setSetting('theme', 'dark'); return L('Done, dark mode is on.', 'C’est fait, le mode sombre est activé.'); }
    if (/light mode/.test(l)) { PatOS.setSetting('theme', 'light'); return L('Done, light mode is on.', 'C’est fait, le mode clair est activé.'); }
    if (/wallpaper/.test(l)) { const all = [...Object.keys(PatOS.wallpaper.live), ...Object.keys(PatOS.wallpaper.palettes)]; const next = all[(all.indexOf(PatOS.settings.wallpaper) + 1) % all.length]; PatOS.setSetting('wallpaper', next); return L('New wallpaper: ', 'Nouveau fond d’écran : ') + PatOS.t((PatOS.wallpaper.live[next] || PatOS.wallpaper.palettes[next]).name) + '.'; }
    if (/play (some )?music|play a song/.test(l)) { PatOS.launch('music'); setTimeout(() => PatOS.music && !PatOS.music.nowPlaying() && PatOS.music.toggle(), 600); return L('Putting on a song.', 'Je mets une chanson.'); }
    if (/weather/.test(l)) { setTimeout(() => PatOS.launch('weather'), 400); return L('Here’s the weather.', 'Voici la météo.'); }
    if (/who are you|your name/.test(l)) return L('I’m Pat. I live inside PatOS on your device, so I work even without internet.', 'Moi c’est Pat. Je vis dans PatOS sur ton appareil, alors je marche même sans Internet.');
    if (/thank/.test(l)) return L('Anytime.', 'Avec plaisir.');
    if (/how are you/.test(l)) return L('Pretty good, thanks. How about you?', 'Ça va bien, merci. Et toi?');
    const expr = t.replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/what is|what's|calculate|=|\?/gi, '').replace(/,/g, '.').trim();
    if (/^[\d\s+\-*/().%^]+$/.test(expr) && /\d/.test(expr)) { try { const v = Function('"use strict";return (' + expr.replace(/\^/g, '**') + ')')(); if (Number.isFinite(v)) return expr + ' = ' + (+v.toPrecision(12)); } catch (e) {} }
    if (/^(search|google|look up)\s+/.test(l)) { const q = t.replace(/^(search|google|look up)\s+/i, ''); setTimeout(() => PatOS.launch('browser', { url: q }), 400); return L('Looking up “', 'Je cherche « ') + q + L('” on the web.', ' » sur le Web.'); }
    if ((m = l.match(/^(?:define|meaning of|what does (.+) mean)\s*(.*)/))) { const w = (m[1] || m[2]).trim(); setTimeout(() => PatOS.launch('dictionary', { word: w }), 400); return L('Let me look up “' + w + '”.', 'Je cherche « ' + w + ' ».'); }
    return pick(FR() ? ['Je ne suis pas sûr de comprendre. Écris « aide » pour voir ce que je sais faire.', 'Ça, je ne sais pas encore le faire. Essaie « aide ».'] : ['I’m not sure what you mean. Type "help" to see what I can do.', 'That one’s beyond me for now. Try "help".', 'I can’t answer that, sorry. I’m better at opening apps, quick math and reminders.']);
  }
  PatOS.assistantReply = reply;

  PatOS.registerApp({
    id: 'messages', name: 'Messages', icon: 'messages', width: 760, height: 560, keywords: 'chat assistant bot pat siri ai text',
    about: 'Chat with Pat, the assistant built into PatOS.',
    launch(win) {
      let log = PatOS.store.get('chatLog', null) || [{ from: 'pat', text: PatOS.lang === 'fr' ? `Salut ${PatOS.settings.userName}, moi c’est Pat. Demande-moi d’ouvrir une app, de faire un calcul ou d’ajouter un rappel. Écris « aide » si tu veux la liste.` : `Hi ${PatOS.settings.userName}, I’m Pat. Ask me to open an app, do some math or add a reminder. Type "help" if you want the list.`, t: Date.now() }];
      const side = h('div', { class: 'msg-side' }, h('div', { class: 'msg-conv on' }, h('div', { class: 'msg-av' }, 'P'), h('div', {}, h('b', {}, 'Pat'), h('small', {}, 'PatOS Assistant'))));
      const list = h('div', { class: 'msg-list' });
      const input = h('input', { class: 'msg-in', placeholder: 'iMessage', spellcheck: 'true' });
      const send = h('button', { class: 'msg-send', 'aria-label': 'Send' }, '↑');
      const chips = h('div', { class: 'msg-chips' }, ...(PatOS.lang === 'fr' ? ['aide', 'raconte une blague', 'ouvre galaxie', 'quelle heure est-il?', 'rappelle-moi d’étudier'] : ['help', 'tell me a joke', 'open galaxy', 'what time is it?', 'remind me to study']).map((c) => h('button', { class: 'no-tr', onclick: () => submit(c) }, c)));
      const head = h('div', { class: 'msg-head' }, h('div', { class: 'msg-av sm' }, 'P'), h('b', {}, 'Pat'));
      win.body.appendChild(h('div', { class: 'msg-wrap' }, side, h('div', { class: 'msg-main' }, head, list, chips, h('div', { class: 'msg-bar' }, input, send))));
      function bubble(m, anim) {
        const b = h('div', { class: 'msg-b ' + (m.from === 'me' ? 'me' : 'them') + (anim ? ' pop' : '') }, m.text);
        list.appendChild(b); list.scrollTop = list.scrollHeight;
      }
      function render() { list.innerHTML = ''; log.slice(-80).forEach((m) => bubble(m)); }
      function submit(text) {
        text = (text || input.value).trim(); if (!text) return; input.value = '';
        const me = { from: 'me', text, t: Date.now() }; log.push(me); bubble(me, true);
        PatOS.sound.tone(1100, 0.08, { vol: 0.06, slide: 1500 });
        const typing = h('div', { class: 'msg-b them typing' }, h('i'), h('i'), h('i')); list.appendChild(typing); list.scrollTop = list.scrollHeight;
        setTimeout(() => {
          typing.remove();
          const r = { from: 'pat', text: reply(text), t: Date.now() }; log.push(r); bubble(r, true);
          PatOS.sound.tone(700, 0.12, { vol: 0.06 }); PatOS.sound.tone(1050, 0.12, { vol: 0.05, delay: 0.08 });
          if (log.length > 200) log = log.slice(-200);
          PatOS.store.set('chatLog', log);
        }, 500 + Math.random() * 500);
      }
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      send.onclick = () => submit();
      render();
      setTimeout(() => input.focus(), 100);
    }
  });
})();
