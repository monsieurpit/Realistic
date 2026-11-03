/* Dictionary — look up English words (dictionaryapi.dev, free, no key) */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'dictionary', name: 'Dictionary', icon: 'dictionary', width: 640, height: 560, category: 'Utilities', keywords: 'define word meaning definition english thesaurus',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const q = h('input', { class: 'field', placeholder: 'Look up a word', style: { width: '240px' }, spellcheck: 'true' });
      win.toolbar.append(q);
      const main = h('div', { class: 'dc-main' }); win.body.appendChild(main);
      const recent = PatOS.store.get('dictRecent', []);
      function home() {
        main.innerHTML = '';
        main.append(h('div', { class: 'dc-home' }, h('div', { class: 'dc-big', html: PatOS.iconHTML('dictionary') }), h('h2', {}, 'Dictionary'), h('p', {}, 'Type a word above and press Enter.'),
          recent.length ? h('div', { class: 'dc-recent' }, ...recent.map((w) => h('button', { class: 'btn', onclick: () => look(w) }, w))) : null));
      }
      async function look(word) {
        word = word.trim().toLowerCase(); if (!word) return; q.value = word;
        main.innerHTML = '<div class="dc-loading">Looking up…</div>';
        // words looked up before are kept on the device, so they open instantly and work offline
        const cache = PatOS.store.get('dictCache', {});
        try {
          let j = cache[word] && cache[word].d;
          if (!j) {
            if (PatOS.isOffline()) { main.innerHTML = ''; main.appendChild(PatOS.offlineCard(() => look(word), { body: 'Looking up a new word needs the internet. Words you looked up before work offline.' })); return; }
            const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
            if (r.status === 404) { main.innerHTML = ''; main.appendChild(h('div', { class: 'dc-home' }, h('h2', {}, PatOS.t('No definition found')), h('p', {}, PatOS.t('Check the spelling and try again.') + ' (' + word + ')'))); return; }
            j = await r.json();
            cache[word] = { t: Date.now(), d: j };
            const keys = Object.keys(cache); if (keys.length > 300) keys.sort((a, b) => cache[a].t - cache[b].t).slice(0, keys.length - 300).forEach((k) => delete cache[k]);
            PatOS.store.set('dictCache', cache);
          }
          const e = j[0];
          const i = recent.indexOf(word); if (i >= 0) recent.splice(i, 1); recent.unshift(word); recent.length = Math.min(recent.length, 10); PatOS.store.set('dictRecent', recent);
          main.innerHTML = '';
          const audio = (e.phonetics || []).find((p) => p.audio);
          main.appendChild(h('div', { class: 'dc-word' }, h('h1', {}, e.word), h('span', { class: 'dc-ph' }, e.phonetic || ((e.phonetics || []).find((p) => p.text) || {}).text || ''),
            audio ? h('button', { class: 'tbtn', title: 'Listen', onclick: () => new Audio(audio.audio).play().catch(() => {}) }, '🔊') : null));
          j.forEach((entry) => entry.meanings.forEach((m) => {
            main.appendChild(h('div', { class: 'dc-pos' }, m.partOfSpeech));
            const ol = h('ol', { class: 'dc-defs' });
            m.definitions.slice(0, 5).forEach((d) => ol.appendChild(h('li', {}, d.definition, d.example ? h('div', { class: 'dc-ex' }, '“' + d.example + '”') : null)));
            main.appendChild(ol);
            if (m.synonyms && m.synonyms.length) main.appendChild(h('div', { class: 'dc-syn' }, h('b', {}, 'Synonyms: '), ...m.synonyms.slice(0, 8).map((s) => h('button', { class: 'dc-link', onclick: () => look(s) }, s))));
          }));
          win.setTitle('Dictionary — ' + e.word);
        } catch (er) {
          if (PatOS.isOffline()) { main.innerHTML = ''; main.appendChild(PatOS.offlineCard(() => look(word))); return; }
          main.innerHTML = ''; main.appendChild(h('div', { class: 'dc-home' }, h('h2', {}, 'Can’t reach the dictionary'), h('p', {}, PatOS.sandboxed ? 'Claude Artifacts block live data. Open PatOS from its own website to use Dictionary.' : 'Check your internet connection and try again.')));
        }
      }
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') look(q.value); });
      win._look = look;
      if (args.word) look(args.word); else home();
    },
    onArgs(win, a) { if (a.word) win._look(a.word); }
  });
})();
