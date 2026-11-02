/* Messages — chat with Pat, the built-in assistant */
(function () {
  'use strict';
  const { h } = PatOS;
  const JOKES = ['Why did the computer go to the doctor? It had a virus.', 'Why do programmers prefer dark mode? Because light attracts bugs.', 'What do you call a dinosaur that codes? A Typo-saurus.', 'Why was the math book sad? It had too many problems.', 'How does the moon cut its hair? Eclipse it.', 'I would tell you a UDP joke, but you might not get it.'];
  const FACTS = ['A day on Venus is longer than a year on Venus.', 'Octopuses have three hearts.', 'Honey never spoils. Archaeologists have found 3,000-year-old honey that is still edible.', 'The Eiffel Tower can be about 15 cm taller in summer because the metal expands.', 'There are more possible chess games than atoms in the observable universe.', 'Bananas are berries, but strawberries are not.'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function reply(text) {
    const t = text.trim(); const l = t.toLowerCase();
    let m;
    if (/^(hi|hey|hello|yo|sup|bonjour|salut)\b/.test(l)) return `Hey ${PatOS.settings.userName}! 👋 I can open apps, do math, tell the time, save notes and reminders, or tell you a joke. Type "help" to see everything.`;
    if (/\bhelp\b|what can you do/.test(l)) return 'Try:\n• open galaxy\n• what time is it?\n• 24 * 17 + 3\n• remind me to study for math\n• note: buy pencils\n• tell me a joke / a fact\n• flip a coin / roll a die\n• dark mode / light mode\n• change wallpaper\n• play music';
    if ((m = l.match(/^(open|launch|start)\s+(.+)/))) {
      const q = m[2].replace(/[.!?]$/, '').trim();
      const id = PatOS.appOrder.find((k) => PatOS.apps[k].name.toLowerCase() === q || k === q) || PatOS.appOrder.find((k) => PatOS.apps[k].name.toLowerCase().includes(q));
      if (id) { setTimeout(() => PatOS.launch(id), 500); return `Opening ${PatOS.apps[id].name} 🚀`; }
      return `I couldn't find an app called "${q}". Say "list apps" to see them all.`;
    }
    if (/list (all )?apps|what apps/.test(l)) return 'Your apps: ' + PatOS.appOrder.filter((k) => !PatOS.apps[k].hidden).map((k) => PatOS.apps[k].name).join(', ') + '.';
    if (/\btime\b/.test(l)) return 'It’s ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + ' ⏰';
    if (/\b(date|day is it|today)\b/.test(l)) return 'Today is ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' 📅';
    if ((m = t.match(/^(?:remind me to|reminder:?|add reminder:?)\s+(.+)/i))) {
      const items = PatOS.store.get('reminders', []); items.push({ id: Date.now(), text: m[1], done: false }); PatOS.store.set('reminders', items);
      return `✅ Added to Reminders: “${m[1]}”`;
    }
    if ((m = t.match(/^(?:note:?|take a note:?|write down:?)\s+(.+)/i))) {
      const notes = PatOS.store.get('notes', []) || []; notes.unshift({ id: PatOS.uid(), title: m[1].slice(0, 40), body: '<div>' + PatOS.esc(m[1]) + '</div>', mtime: Date.now() }); PatOS.store.set('notes', notes);
      return '📝 Saved a new note. Open Notes to see it.';
    }
    if (/joke/.test(l)) return pick(JOKES) + ' 😄';
    if (/fact/.test(l)) return '🤓 ' + pick(FACTS);
    if (/flip a coin|coin flip/.test(l)) return Math.random() < 0.5 ? '🪙 Heads!' : '🪙 Tails!';
    if ((m = l.match(/roll (?:a )?(?:die|dice|d(\d+))/))) { const n = +(m[1] || 6); return '🎲 You rolled a ' + (1 + Math.floor(Math.random() * n)) + (n !== 6 ? ' (d' + n + ')' : ''); }
    if (/dark mode/.test(l)) { PatOS.setSetting('theme', 'dark'); return '🌙 Dark mode on.'; }
    if (/light mode/.test(l)) { PatOS.setSetting('theme', 'light'); return '☀️ Light mode on.'; }
    if (/wallpaper/.test(l)) { const all = [...Object.keys(PatOS.wallpaper.live), ...Object.keys(PatOS.wallpaper.palettes)]; const next = all[(all.indexOf(PatOS.settings.wallpaper) + 1) % all.length]; PatOS.setSetting('wallpaper', next); return '🖼 Switched the wallpaper to ' + ((PatOS.wallpaper.live[next] || PatOS.wallpaper.palettes[next]).name) + '.'; }
    if (/play (some )?music|play a song/.test(l)) { PatOS.launch('music'); setTimeout(() => PatOS.music && !PatOS.music.nowPlaying() && PatOS.music.toggle(), 600); return '🎵 Here comes a song.'; }
    if (/weather/.test(l)) { setTimeout(() => PatOS.launch('weather'), 400); return '🌤 Opening Weather for you.'; }
    if (/who are you|your name/.test(l)) return 'I’m Pat, the assistant built into PatOS. I live on your computer, so I don’t need the internet.';
    if (/thank/.test(l)) return 'Anytime! 😊';
    if (/how are you/.test(l)) return 'Running at 60 frames per second and feeling great. You?';
    const expr = t.replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/what is|what's|calculate|=|\?/gi, '').trim();
    if (/^[\d\s+\-*/().%^]+$/.test(expr) && /\d/.test(expr)) { try { const v = Function('"use strict";return (' + expr.replace(/\^/g, '**') + ')')(); if (Number.isFinite(v)) return '🧮 ' + expr + ' = ' + (+v.toPrecision(12)); } catch (e) {} }
    if (/^(search|google|look up)\s+/.test(l)) { const q = t.replace(/^(search|google|look up)\s+/i, ''); setTimeout(() => PatOS.launch('browser', { url: q }), 400); return '🔎 Searching the web for “' + q + '”'; }
    if ((m = l.match(/^(?:define|meaning of|what does (.+) mean)\s*(.*)/))) { const w = (m[1] || m[2]).trim(); setTimeout(() => PatOS.launch('dictionary', { word: w }), 400); return '📖 Looking up “' + w + '” in Dictionary.'; }
    return pick(['Hmm, I’m not sure about that one. Type "help" to see what I can do.', 'I don’t know that yet! Try "help".', 'Interesting! I can’t answer that, but I can open apps, do math and keep reminders.']);
  }
  PatOS.assistantReply = reply;

  PatOS.registerApp({
    id: 'messages', name: 'Messages', icon: 'messages', width: 760, height: 560, keywords: 'chat assistant bot pat siri ai text',
    about: 'Chat with Pat, the assistant built into PatOS.',
    launch(win) {
      let log = PatOS.store.get('chatLog', null) || [{ from: 'pat', text: `Hi ${PatOS.settings.userName}! I’m Pat, your PatOS assistant. Ask me to open an app, do math, add a reminder or tell a joke. Type "help" to see more.`, t: Date.now() }];
      const side = h('div', { class: 'msg-side' }, h('div', { class: 'msg-conv on' }, h('div', { class: 'msg-av' }, 'P'), h('div', {}, h('b', {}, 'Pat'), h('small', {}, 'PatOS Assistant'))));
      const list = h('div', { class: 'msg-list' });
      const input = h('input', { class: 'msg-in', placeholder: 'iMessage', spellcheck: 'true' });
      const send = h('button', { class: 'msg-send', 'aria-label': 'Send' }, '↑');
      const chips = h('div', { class: 'msg-chips' }, ...['help', 'tell me a joke', 'open galaxy', 'what time is it?', 'remind me to study'].map((c) => h('button', { onclick: () => submit(c) }, c)));
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
