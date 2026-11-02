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
        try {
          const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
          if (r.status === 404) { main.innerHTML = ''; main.appendChild(h('div', { class: 'dc-home' }, h('h2', {}, 'No definition found'), h('p', {}, 'Check the spelling of “' + word + '” and try again.'))); return; }
          const j = await r.json(); const e = j[0];
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
