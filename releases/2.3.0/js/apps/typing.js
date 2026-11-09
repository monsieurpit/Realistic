/* Typing Trainer — words per minute and accuracy */
(function () {
  'use strict';
  const { h } = PatOS;
  const TEXTS = [
    'The quick brown fox jumps over the lazy dog while the sun sets behind the hills.',
    'Practice makes progress. Every key you press today makes tomorrow a little faster.',
    'Space is big. Really big. You just won’t believe how vastly huge it is.',
    'A good programmer looks both ways before crossing a one-way street.',
    'Planets orbit stars, moons orbit planets, and students orbit the snack table.',
    'Learning to type without looking at the keyboard is a superpower that lasts forever.',
    'Three.js lets you draw galaxies, worlds and games right inside a web page.'
  ];
  PatOS.registerApp({
    id: 'typing', name: 'Typing Trainer', mobileName: 'Typing', icon: 'typing', width: 780, height: 460, keywords: 'typing speed wpm keyboard practice test',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let best = PatOS.store.get('typingBest', 0);
      const stats = h('div', { class: 'ty-stats' });
      const textEl = h('div', { class: 'ty-text' });
      const input = h('input', { class: 'ty-in', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Type here' });
      const bNew = h('button', { class: 'btn primary' }, 'New Text');
      win.toolbar.append(bNew);
      win.body.appendChild(h('div', { class: 'tyt' }, stats, textEl, input, h('div', { class: 'ty-hint' }, 'Start typing to begin the timer. Press Esc to restart.')));
      let target = '', start = 0, errors = 0, done = false, timer = 0;
      function setStats(wpm, acc) { stats.innerHTML = ''; [['WPM', wpm], ['Accuracy', acc + '%'], ['Best', best + ' WPM']].forEach(([k, v]) => stats.appendChild(h('div', {}, h('small', {}, k), h('b', {}, String(v))))); }
      function newText() {
        target = TEXTS[Math.floor(Math.random() * TEXTS.length)]; start = 0; errors = 0; done = false; input.value = ''; input.disabled = false;
        clearInterval(timer); render(); setStats(0, 100); setTimeout(() => input.focus(), 30);
      }
      function render() {
        const v = input.value; textEl.innerHTML = '';
        for (let i = 0; i < target.length; i++) {
          const cls = i < v.length ? (v[i] === target[i] ? 'ok' : 'bad') : i === v.length ? 'cur' : '';
          textEl.appendChild(h('span', { class: cls }, target[i]));
        }
      }
      function live() {
        const v = input.value; const mins = (Date.now() - start) / 60000;
        const correct = [...v].filter((c, i) => c === target[i]).length;
        const wpm = mins > 0 ? Math.round(correct / 5 / mins) : 0;
        const acc = v.length + errors ? Math.max(0, Math.round((v.length - errors) / Math.max(1, v.length) * 100)) : 100;
        setStats(wpm, Math.min(100, acc)); return wpm;
      }
      input.addEventListener('input', () => {
        if (done) return;
        if (!start) { start = Date.now(); timer = setInterval(live, 250); }
        const v = input.value; const last = v.length - 1;
        if (last >= 0 && v[last] !== target[last]) { errors++; PatOS.sound.tone(200, 0.05, { vol: 0.04, type: 'square' }); } else PatOS.sound.click();
        render();
        if (v === target) {
          done = true; clearInterval(timer); input.disabled = true;
          const wpm = live();
          if (wpm > best) { best = wpm; PatOS.store.set('typingBest', best); PatOS.notify({ title: 'New best: ' + wpm + ' WPM', body: 'That’s the fastest you’ve typed so far.', icon: 'typing' }); }
          live(); PatOS.sound.pop();
        }
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); newText(); } });
      textEl.onclick = () => input.focus();
      bNew.onclick = newText;
      win.on('closed', () => clearInterval(timer));
      newText();
    }
  });
})();
