/* Translate — real translations from the free MyMemory service, plus read-aloud */
(function () {
  'use strict';
  const { h } = PatOS;
  const LANGS = [['en', 'English'], ['fr', 'French'], ['es', 'Spanish'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['ru', 'Russian'], ['zh-CN', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['tr', 'Turkish'], ['pl', 'Polish'], ['sv', 'Swedish'], ['el', 'Greek'], ['vi', 'Vietnamese'], ['uk', 'Ukrainian'], ['ht', 'Haitian Creole']];
  PatOS.registerApp({
    id: 'translate', name: 'Translate', icon: 'translate', width: 860, height: 520, category: 'Utilities', keywords: 'language translation french english spanish dictionary',
    about: 'Translate text between 20 languages and hear it read aloud.',
    onArgs(win, a) { if (win._set) win._set(a); },
    launch(win, args) {
      args = args || {};
      const st = PatOS.store.get('translatePrefs', { from: 'en', to: PatOS.lang === 'fr' ? 'en' : 'fr' });
      if (PatOS.lang === 'fr' && st.from === 'en' && st.to === 'fr' && !PatOS.store.get('translatePrefs')) { st.from = 'fr'; st.to = 'en'; }
      const sel = (v) => h('select', { class: 'field tr-lang' }, ...LANGS.map(([c, n]) => h('option', { value: c, selected: c === v }, n)));
      const from = sel(st.from), to = sel(st.to);
      const swap = h('button', { class: 'tr-swap', title: 'Swap languages' }, '⇄');
      const src = h('textarea', { class: 'tr-box', placeholder: 'Enter text', maxlength: '500', spellcheck: 'true' });
      const out = h('div', { class: 'tr-box tr-out' });
      const count = h('small', { class: 'tr-count' }, '0 / 500');
      const speak = (text, lang) => { if (!('speechSynthesis' in window) || !text) return; const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.cancel(); speechSynthesis.speak(u); };
      const hist = h('div', { class: 'tr-hist' });
      win.body.appendChild(h('div', { class: 'tr' },
        h('div', { class: 'tr-langs' }, from, swap, to),
        h('div', { class: 'tr-panes' },
          h('div', { class: 'tr-pane' }, src, h('div', { class: 'tr-foot' }, h('button', { class: 'tbtn', title: 'Listen', onclick: () => speak(src.value, from.value) }, '🔊'), h('button', { class: 'tbtn', title: 'Clear', onclick: () => { src.value = ''; out.textContent = ''; count.textContent = '0 / 500'; } }, '✕'), h('div', { style: { flex: 1 } }), count)),
          h('div', { class: 'tr-pane' }, out, h('div', { class: 'tr-foot' }, h('button', { class: 'tbtn', title: 'Listen', onclick: () => speak(out.textContent, to.value) }, '🔊'), h('button', { class: 'tbtn', title: 'Copy', onclick: () => navigator.clipboard && navigator.clipboard.writeText(out.textContent).then(() => PatOS.notify({ title: 'Copied', body: out.textContent.slice(0, 60), icon: 'translate' })).catch(() => {}) }, '⧉')))),
        hist, h('small', { class: 'tr-credit' }, 'Translations by MyMemory (needs internet)')));
      let reqId = 0;
      async function go() {
        const text = src.value.trim(); count.textContent = src.value.length + ' / 500';
        if (!text) { out.textContent = ''; return; }
        if (from.value === to.value) { out.textContent = text; return; }
        const id = ++reqId; out.classList.add('loading');
        try {
          // (the same service as Pat's “translate…”: PatOS.translate, js/intel-know.js)
          let t = ''; try { t = await PatOS.translate(text, from.value, to.value); } catch (er) { if (/limit/i.test(er.message)) t = er.message; else throw er; }
          if (id !== reqId) return;
          out.textContent = t;
          saveHist(text, out.textContent);
        } catch (e) { if (id === reqId) out.textContent = PatOS.sandboxed ? 'Claude Artifacts block live data. Open PatOS from its own website to translate.' : 'Can’t reach the translation service. Check your internet connection.'; }
        out.classList.remove('loading');
      }
      const saveHist = PatOS.debounce((a, b) => { const l = PatOS.store.get('translateHist', []); if (l[0] && l[0].a === a) return; l.unshift({ a, b, f: from.value, t: to.value }); PatOS.store.set('translateHist', l.slice(0, 8)); drawHist(); }, 1500);
      function drawHist() { const l = PatOS.store.get('translateHist', []); hist.innerHTML = ''; if (!l.length) return; hist.appendChild(h('b', {}, 'Recent')); l.forEach((x) => { const b = h('button', { class: 'tr-hi' }, h('span', {}, x.a), h('small', {}, x.b)); b.onclick = () => { from.value = x.f; to.value = x.t; src.value = x.a; go(); }; hist.appendChild(b); }); }
      const deb = PatOS.debounce(go, 600);
      src.addEventListener('input', deb);
      const savePrefs = () => PatOS.store.set('translatePrefs', { from: from.value, to: to.value });
      from.onchange = () => { savePrefs(); go(); }; to.onchange = () => { savePrefs(); go(); };
      swap.onclick = () => { const f = from.value; from.value = to.value; to.value = f; if (out.textContent) src.value = out.textContent; savePrefs(); go(); swap.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }], { duration: 300 }); };
      // opened by Pat (“translate good morning to Spanish”): that text, those languages
      win._set = (a) => { if (!a || !a.text) return; const has = (sel, v) => [...sel.options].some((o) => o.value === v); if (a.from && has(from, a.from)) from.value = a.from; if (a.to && has(to, a.to)) to.value = a.to; src.value = String(a.text).slice(0, 500); savePrefs(); go(); };
      win._set(args);
      drawHist(); if (!args.text) setTimeout(() => src.focus(), 60);
    }
  });
})();
