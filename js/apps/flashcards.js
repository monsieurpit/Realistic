/* Flashcards — study decks with 3D flipping cards */
(function () {
  'use strict';
  const { h } = PatOS;
  const SAMPLE = [
    { id: 'd1', name: 'French Basics', cards: [['Bonjour', 'Hello'], ['Merci', 'Thank you'], ['Au revoir', 'Goodbye'], ['S’il vous plaît', 'Please'], ['Le chat', 'The cat'], ['La pomme', 'The apple']] },
    { id: 'd2', name: 'Science', cards: [['H₂O', 'Water'], ['Speed of light', '≈ 300,000 km/s'], ['Mitochondria', 'Powerhouse of the cell'], ['Closest planet to the Sun', 'Mercury'], ['Unit of force', 'Newton (N)']] },
    { id: 'd3', name: 'Multiplication', cards: [['7 × 8', '56'], ['6 × 9', '54'], ['12 × 12', '144'], ['8 × 7', '56'], ['9 × 9', '81'], ['11 × 12', '132']] }
  ];
  PatOS.registerApp({
    id: 'flashcards', name: 'Flashcards', icon: 'flashcards', width: 760, height: 560, keywords: 'study school learn quiz cards memorize',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let decks = PatOS.store.get('decks', null) || SAMPLE;
      const save = () => PatOS.store.set('decks', decks);
      const main = h('div', { class: 'fc-main' }); win.body.appendChild(main);
      const bHome = h('button', { class: 'tbtn' }, '‹ Decks'); win.toolbar.append(bHome); bHome.onclick = () => home();
      function home() {
        bHome.style.visibility = 'hidden'; win.setTitle('Flashcards');
        main.innerHTML = '';
        const grid = h('div', { class: 'fc-decks' });
        decks.forEach((d, i) => {
          const c = h('div', { class: 'fc-deck', style: { '--h': (i * 67) % 360 } }, h('b', {}, d.name), h('small', {}, d.cards.length + ' cards' + (d.best != null ? ' · best ' + d.best + '%' : '')),
            h('div', { class: 'fc-dbtns' }, h('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); study(d); } }, 'Study'), h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); edit(d); } }, 'Edit')));
          grid.appendChild(c);
        });
        const add = h('button', { class: 'fc-deck fc-new' }, '+ New Deck');
        add.onclick = async () => { const n = await PatOS.ask('Name your new deck', 'History', { icon: 'flashcards', ok: 'Create' }); if (!n) return; const d = { id: PatOS.uid(), name: n, cards: [] }; decks.push(d); save(); edit(d); };
        grid.appendChild(add);
        main.append(h('h1', { class: 'fc-h1' }, 'Your Decks'), grid);
      }
      function edit(d) {
        bHome.style.visibility = ''; win.setTitle(d.name);
        main.innerHTML = '';
        const list = h('div', { class: 'fc-edit' });
        const draw = () => {
          list.innerHTML = '';
          d.cards.forEach((c, i) => {
            const f = h('input', { class: 'field', value: c[0], placeholder: 'Front' }); const b = h('input', { class: 'field', value: c[1], placeholder: 'Back' });
            f.oninput = () => { c[0] = f.value; save(); }; b.oninput = () => { c[1] = b.value; save(); };
            list.appendChild(h('div', { class: 'fc-erow' }, h('span', {}, i + 1), f, b, h('button', { class: 'tbtn', onclick: () => { d.cards.splice(i, 1); save(); draw(); } }, '×')));
          });
        };
        draw();
        main.append(h('div', { class: 'fc-ehead' }, h('h2', {}, d.name), h('div', { style: { flex: 1 } }),
          h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox('Delete “' + d.name + '”?', 'All its cards will be deleted.', { danger: true, ok: 'Delete', icon: 'flashcards' })) { decks = decks.filter((x) => x !== d); save(); home(); } } }, 'Delete Deck'),
          h('button', { class: 'btn primary', onclick: () => study(d), disabled: !d.cards.length }, 'Study')),
          list, h('button', { class: 'btn fc-addcard', onclick: () => { d.cards.push(['', '']); save(); draw(); list.lastChild.querySelector('input').focus(); } }, '+ Add Card'));
      }
      function study(d) {
        if (!d.cards.length) return edit(d);
        bHome.style.visibility = ''; win.setTitle(d.name);
        const order = d.cards.map((_, i) => i).sort(() => Math.random() - 0.5);
        let i = 0, right = 0;
        main.innerHTML = '';
        const prog = h('div', { class: 'fc-prog' }, h('span'));
        const card = h('div', { class: 'fc-card' }, h('div', { class: 'fc-face front' }), h('div', { class: 'fc-face back' }));
        const stage = h('div', { class: 'fc-stage' }, card);
        const btns = h('div', { class: 'fc-btns' });
        const count = h('div', { class: 'fc-count' });
        main.append(prog, count, stage, h('div', { class: 'fc-tip' }, 'Click the card or press Space to flip'), btns);
        const flip = () => { card.classList.toggle('flipped'); PatOS.sound.tone(900, 0.04, { vol: 0.04 }); showBtns(); };
        card.onclick = flip;
        function showBtns() {
          btns.innerHTML = '';
          if (!card.classList.contains('flipped')) { btns.appendChild(h('button', { class: 'btn primary', onclick: flip }, 'Show Answer')); return; }
          btns.append(h('button', { class: 'btn fc-wrong', onclick: () => next(false) }, 'Didn’t know'), h('button', { class: 'btn fc-right', onclick: () => next(true) }, 'Knew it'));
        }
        function show() {
          const c = d.cards[order[i]];
          card.classList.remove('flipped');
          card.querySelector('.front').textContent = c[0]; card.querySelector('.back').textContent = c[1];
          card.animate([{ transform: 'translateX(60px) rotate(4deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
          prog.firstChild.style.width = (i / order.length * 100) + '%'; count.textContent = (i + 1) + ' / ' + order.length;
          showBtns();
        }
        function next(ok) {
          if (ok) { right++; PatOS.sound.tone(1200, 0.1, { vol: 0.06 }); } else PatOS.sound.tone(300, 0.15, { vol: 0.06 });
          card.animate([{ transform: card.classList.contains('flipped') ? 'rotateY(180deg)' : 'none', opacity: 1 }, { transform: `translateX(${ok ? 200 : -200}px) rotate(${ok ? 12 : -12}deg)`, opacity: 0 }], { duration: 260, easing: 'ease-in' }).onfinish = () => {
            i++;
            if (i >= order.length) return finish();
            show();
          };
        }
        function finish() {
          const pct = Math.round(right / order.length * 100);
          if (d.best == null || pct > d.best) d.best = pct; save();
          main.innerHTML = '';
          main.append(h('div', { class: 'fc-done' }, h('div', { class: 'fc-score' }, pct + '%'), h('h2', {}, pct === 100 ? 'Every single one. Nice.' : pct >= 70 ? 'Solid work.' : 'Give it another go.'), h('p', {}, right + ' of ' + order.length + ' correct'), h('div', { class: 'fc-dbtns' }, h('button', { class: 'btn primary', onclick: () => study(d) }, 'Study Again'), h('button', { class: 'btn', onclick: home }, 'All Decks'))));
        }
        const onKey = (e) => { if (PatOS.wm.active !== win || !main.contains(card)) return; if (e.key === ' ') { e.preventDefault(); flip(); } if (card.classList.contains('flipped')) { if (e.key === 'ArrowRight' || e.key === '1') next(true); if (e.key === 'ArrowLeft' || e.key === '2') next(false); } };
        document.addEventListener('keydown', onKey); win.on('closed', () => document.removeEventListener('keydown', onKey));
        show();
      }
      home();
    }
  });
})();
