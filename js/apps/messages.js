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
    if (/^(hi|hey|hello|yo|sup)\b/.test(l)) return L(`Hey ${name}! 👋 I can open apps, do math, tell the time, save notes and reminders, or tell you a joke. Type "help" to see everything.`, `Salut ${name}! 👋 Je peux ouvrir des apps, faire des calculs, donner l’heure, prendre des notes et des rappels, ou raconter une blague. Écris « aide » pour tout voir.`);
    if (/\bhelp\b|what can you do/.test(l)) return L('Try:\n• open galaxy\n• what time is it?\n• 24 * 17 + 3\n• remind me to study for math\n• note: buy pencils\n• tell me a joke / a fact\n• flip a coin / roll a die\n• dark mode / light mode\n• change wallpaper\n• play music', 'Essaie :\n• ouvre galaxie\n• quelle heure est-il?\n• 24 * 17 + 3\n• rappelle-moi d’étudier les maths\n• note : acheter des crayons\n• raconte une blague / une anecdote\n• pile ou face / lance un dé\n• mode sombre / mode clair\n• change le fond d’écran\n• joue de la musique');
    if ((m = l.match(/^(open|launch|start)\s+(.+)/))) {
      const q = m[2].replace(/[.!?]$/, '').trim();
      const nm = (k) => [PatOS.apps[k].name.toLowerCase(), PatOS.t(PatOS.apps[k].name).toLowerCase()];
      const id = PatOS.appOrder.find((k) => nm(k).includes(q) || k === q) || PatOS.appOrder.find((k) => nm(k).some((n) => n.includes(q)));
      if (id) { setTimeout(() => PatOS.launch(id), 500); return L(`Opening ${PatOS.apps[id].name} 🚀`, `J’ouvre ${PatOS.t(PatOS.apps[id].name)} 🚀`); }
      return L(`I couldn't find an app called "${q}". Say "list apps" to see them all.`, `Je ne trouve pas d’app appelée « ${q} ». Écris « liste des apps » pour toutes les voir.`);
    }
    if (/list (all )?apps|what apps/.test(l)) return L('Your apps: ', 'Tes apps : ') + PatOS.appOrder.filter((k) => !PatOS.apps[k].hidden).map((k) => PatOS.t(PatOS.apps[k].name)).join(', ') + '.';
    if (/\btime\b/.test(l)) return L('It’s ', 'Il est ') + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + ' ⏰';
    if (/\b(date|day is it|today)\b/.test(l)) return L('Today is ', 'Nous sommes le ') + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' 📅';
    if ((m = t.match(/^(?:remind me to|reminder:?|add reminder:?)\s+(.+)/i))) {
      const items = PatOS.store.get('reminders', []); items.push({ id: Date.now(), text: m[1], done: false }); PatOS.store.set('reminders', items);
      return L(`✅ Added to Reminders: “${m[1]}”`, `✅ Ajouté aux Rappels : « ${m[1]} »`);
    }
    if ((m = t.match(/^(?:note:?|take a note:?|write down:?)\s+(.+)/i))) {
      const notes = PatOS.store.get('notes', []) || []; notes.unshift({ id: PatOS.uid(), title: m[1].slice(0, 40), body: '<div>' + PatOS.esc(m[1]) + '</div>', mtime: Date.now() }); PatOS.store.set('notes', notes);
      return L('📝 Saved a new note. Open Notes to see it.', '📝 Nouvelle note enregistrée. Ouvre Notes pour la voir.');
    }
    if (/joke/.test(l)) return pick(FR() ? JOKES_FR : JOKES) + ' 😄';
    if (/fact/.test(l)) return '🤓 ' + pick(FR() ? FACTS_FR : FACTS);
    if (/flip a coin|coin flip/.test(l)) return Math.random() < 0.5 ? L('🪙 Heads!', '🪙 Pile!') : L('🪙 Tails!', '🪙 Face!');
    if ((m = l.match(/roll (?:a )?(?:die|dice|d(\d+))/))) { const n = +(m[1] || 6); return L('🎲 You rolled a ', '🎲 Tu as obtenu ') + (1 + Math.floor(Math.random() * n)); }
    if (/dark mode/.test(l)) { PatOS.setSetting('theme', 'dark'); return L('🌙 Dark mode on.', '🌙 Mode sombre activé.'); }
    if (/light mode/.test(l)) { PatOS.setSetting('theme', 'light'); return L('☀️ Light mode on.', '☀️ Mode clair activé.'); }
    if (/wallpaper/.test(l)) { const all = [...Object.keys(PatOS.wallpaper.live), ...Object.keys(PatOS.wallpaper.palettes)]; const next = all[(all.indexOf(PatOS.settings.wallpaper) + 1) % all.length]; PatOS.setSetting('wallpaper', next); return L('🖼 Switched the wallpaper to ', '🖼 Nouveau fond d’écran : ') + PatOS.t((PatOS.wallpaper.live[next] || PatOS.wallpaper.palettes[next]).name) + '.'; }
    if (/play (some )?music|play a song/.test(l)) { PatOS.launch('music'); setTimeout(() => PatOS.music && !PatOS.music.nowPlaying() && PatOS.music.toggle(), 600); return L('🎵 Here comes a song.', '🎵 Voici une chanson.'); }
    if (/weather/.test(l)) { setTimeout(() => PatOS.launch('weather'), 400); return L('🌤 Opening Weather for you.', '🌤 J’ouvre la Météo.'); }
    if (/who are you|your name/.test(l)) return L('I’m Pat, the assistant built into PatOS. I live on your computer, so I don’t need the internet.', 'Je suis Pat, l’assistant intégré à PatOS. Je vis sur ton appareil, alors je n’ai pas besoin d’Internet.');
    if (/thank/.test(l)) return L('Anytime! 😊', 'Avec plaisir! 😊');
    if (/how are you/.test(l)) return L('Running at 60 frames per second and feeling great. You?', 'Je roule à 60 images par seconde et je me sens super bien. Et toi?');
    const expr = t.replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/what is|what's|calculate|=|\?/gi, '').replace(/,/g, '.').trim();
    if (/^[\d\s+\-*/().%^]+$/.test(expr) && /\d/.test(expr)) { try { const v = Function('"use strict";return (' + expr.replace(/\^/g, '**') + ')')(); if (Number.isFinite(v)) return '🧮 ' + expr + ' = ' + (+v.toPrecision(12)); } catch (e) {} }
    if (/^(search|google|look up)\s+/.test(l)) { const q = t.replace(/^(search|google|look up)\s+/i, ''); setTimeout(() => PatOS.launch('browser', { url: q }), 400); return L('🔎 Searching the web for “', '🔎 Je cherche « ') + q + L('”', ' » sur le Web'); }
    if ((m = l.match(/^(?:define|meaning of|what does (.+) mean)\s*(.*)/))) { const w = (m[1] || m[2]).trim(); setTimeout(() => PatOS.launch('dictionary', { word: w }), 400); return L('📖 Looking up “' + w + '” in Dictionary.', '📖 Je cherche « ' + w + ' » dans le Dictionnaire.'); }
    return pick(FR() ? ['Hmm, je ne suis pas sûr. Écris « aide » pour voir ce que je peux faire.', 'Je ne sais pas encore ça! Essaie « aide ».'] : ['Hmm, I’m not sure about that one. Type "help" to see what I can do.', 'I don’t know that yet! Try "help".', 'Interesting! I can’t answer that, but I can open apps, do math and keep reminders.']);
  }
  PatOS.assistantReply = reply;

  PatOS.registerApp({
    id: 'messages', name: 'Messages', icon: 'messages', width: 760, height: 560, keywords: 'chat assistant bot pat siri ai text',
    about: 'Chat with Pat, the assistant built into PatOS.',
    launch(win) {
      let log = PatOS.store.get('chatLog', null) || [{ from: 'pat', text: PatOS.lang === 'fr' ? `Salut ${PatOS.settings.userName}! Je suis Pat, ton assistant PatOS. Demande-moi d’ouvrir une app, de faire un calcul, d’ajouter un rappel ou de raconter une blague. Écris « aide » pour en voir plus.` : `Hi ${PatOS.settings.userName}! I’m Pat, your PatOS assistant. Ask me to open an app, do math, add a reminder or tell a joke. Type "help" to see more.`, t: Date.now() }];
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
