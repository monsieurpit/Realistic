/* Flashcards — study decks with spaced repetition.
   - Smart study (Leitner boxes): cards you know come back later (1, 3, 7, 14, 30 days), cards you miss come
     back in the same session, new cards are added a few at a time.
   - Two ways to study: flip the card, or type the answer (accents, capitals and one small typo are forgiven).
   - Either side first, or both. Study all cards, or only the ones that are due.
   - Paste a list to make a deck (Quizlet exports work: a tab between term and definition), copy a deck out.
   - A streak counts the days you study. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const DAY = 86400000, GAPS = [0, 1, 3, 7, 14, 30]; // days until a card in box 1..5 is due again
  const NEW_PER_SESSION = 15;
  const todayKey = () => PatOS.dateKey(new Date());

  /* ---------- cards ---------- */
  const mk = (f, b) => ({ id: PatOS.uid(), f: f || '', b: b || '', box: 0, due: 0, seen: 0, right: 0 });
  function migrate(decks) {
    decks.forEach((d) => { d.cards = (d.cards || []).map((c) => (Array.isArray(c) ? mk(c[0], c[1]) : Object.assign(mk('', ''), c))); d.mode = d.mode || 'flip'; d.dir = d.dir || 'fb'; });
    return decks;
  }
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();
  function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
  /* is what was typed one of the accepted answers? "Water (H2O)", "colour; color" and "a / b" give several ways to be right */
  function accepts(answer, typed) {
    const t = norm(typed); if (!t) return false;
    const opts = new Set(); String(answer).split(/\s*[;\/]\s*/).concat(String(answer)).forEach((x) => { opts.add(norm(x)); opts.add(norm(x.replace(/\(.*?\)/g, ''))); });
    for (const o of opts) { if (!o) continue; if (o === t) return true; if (o.length >= 6 && lev(o, t) <= 1) return true; }
    return false;
  }
  PatOS.flashAccepts = accepts;
  const isDue = (c, now) => c.box === 0 || c.due <= now;
  const stats = (d) => { const now = Date.now(); let due = 0, fresh = 0, mastered = 0; d.cards.forEach((c) => { if (c.box === 0) fresh++; else if (c.due <= now) due++; if (c.box >= 4) mastered++; }); return { due, fresh, mastered }; };
  function grade(c, ok) {
    c.seen++; if (ok) c.right++;
    if (ok) { c.box = Math.min(5, (c.box || 0) + 1); c.due = Date.now() + GAPS[c.box] * DAY; } else { c.box = 1; c.due = Date.now() + 10 * 60000; }
  }
  function touchStreak() {
    const s = PatOS.store.get('fcStreak', { last: '', n: 0, today: 0 }); const k = todayKey();
    if (s.last !== k) { const y = new Date(); y.setDate(y.getDate() - 1); s.n = s.last === PatOS.dateKey(y) ? s.n + 1 : 1; s.today = 0; s.last = k; }
    s.today++; PatOS.store.set('fcStreak', s); return s;
  }
  const streak = () => { const s = PatOS.store.get('fcStreak', { last: '', n: 0, today: 0 }); const y = new Date(); y.setDate(y.getDate() - 1); return s.last === todayKey() || s.last === PatOS.dateKey(y) ? s : { last: '', n: 0, today: 0 }; };

  /* "term<TAB>definition" per line (also ; , or " - "): returns [[term, definition]…] */
  function parseList(text) {
    const rows = String(text).replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean); if (!rows.length) return [];
    const sep = rows.some((l) => l.includes('\t')) ? '\t' : rows.every((l) => l.includes(';')) ? ';' : rows.every((l) => /\s[-–—]\s/.test(l)) ? /\s[-–—]\s/ : ',';
    return rows.map((l) => { const i = typeof sep === 'string' ? l.indexOf(sep) : l.search(sep); if (i < 0) return null; const len = typeof sep === 'string' ? sep.length : l.match(sep)[0].length; return [l.slice(0, i).trim(), l.slice(i + len).trim()]; }).filter((r) => r && (r[0] || r[1]));
  }
  PatOS.flashParse = parseList;

  PatOS.registerApp({
    id: 'flashcards', name: 'Flashcards', icon: 'flashcards', width: 780, height: 580, keywords: 'study school learn quiz cards memorize vocabulary exam cartes étudier',
    about: 'Study with spaced repetition: cards you know come back later, cards you miss come back today. Flip or type the answer.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let decks = migrate(PatOS.store.get('decks', null) || []);
      const save = () => PatOS.store.set('decks', decks);
      const main = h('div', { class: 'fc-main' }); win.body.appendChild(main);
      const bHome = h('button', { class: 'tbtn', title: T('Decks') }, '‹ ' + T('Decks')); win.toolbar.append(bHome); bHome.onclick = () => home();
      let cleanup = null; const leave = () => { if (cleanup) { cleanup(); cleanup = null; } };
      const toast = (t) => PatOS.office && PatOS.office.toast && PatOS.office.toast(win, t);

      /* ---------- the list of decks ---------- */
      function home() {
        leave(); bHome.style.visibility = 'hidden'; win.setTitle(T('Flashcards')); main.innerHTML = '';
        const st = streak();
        main.appendChild(h('div', { class: 'fc-top' }, h('h1', { class: 'fc-h1' }, T('Your Decks')), st.n ? h('div', { class: 'fc-streak', title: T('Days in a row you studied') }, h('b', {}, st.n), ' ' + T(st.n === 1 ? 'day' : 'days') + ' ' + T('in a row')) : null));
        if (!decks.length) {
          main.appendChild(h('div', { class: 'fc-empty' }, h('div', { class: 'fc-big', html: PatOS.iconHTML('flashcards') }), h('b', {}, T('No decks yet')), h('p', {}, T('Make a deck for a test, a language or a chapter. Cards you know come back later; the ones you miss come back today.')),
            h('div', { class: 'fc-ebtns' }, h('button', { class: 'btn primary', onclick: newDeck }, T('New Deck')), h('button', { class: 'btn', onclick: () => importDialog() }, T('Paste a List…')))));
          return;
        }
        const grid = h('div', { class: 'fc-decks' });
        decks.forEach((d, i) => {
          const s = stats(d); const pct = d.cards.length ? Math.round(s.mastered / d.cards.length * 100) : 0;
          const c = h('div', { class: 'fc-deck', style: { '--h': (i * 67) % 360 }, tabindex: '0', role: 'button' },
            h('b', {}, d.name), h('small', {}, d.cards.length + ' ' + T(d.cards.length === 1 ? 'card' : 'cards') + (d.best != null ? ' · ' + T('best') + ' ' + d.best + '%' : '')),
            h('div', { class: 'fc-mastbar', title: pct + '% ' + T('mastered') }, h('span', { style: { width: pct + '%' } })),
            h('small', { class: 'fc-due' }, d.cards.length ? (s.due + s.fresh ? (s.due ? s.due + ' ' + T('due') : '') + (s.due && s.fresh ? ' · ' : '') + (s.fresh ? s.fresh + ' ' + T('new') : '') : T('All caught up')) : T('Empty')),
            h('div', { class: 'fc-dbtns' }, h('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); ready(d); } }, T('Study')), h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); edit(d); } }, T('Edit'))));
          const open = () => (d.cards.length ? ready(d) : edit(d)); c.onclick = open; c.onkeydown = (e) => { if (e.key === 'Enter') open(); };
          grid.appendChild(c);
        });
        const add = h('button', { class: 'fc-deck fc-new' }, '+ ' + T('New Deck')); add.onclick = newDeck; grid.appendChild(add);
        main.append(grid, h('div', { class: 'fc-hint' }, h('button', { class: 'ct-addrow', onclick: () => importDialog() }, T('Paste a List…'))));
      }
      async function newDeck() {
        const n = await PatOS.ask(T('Name your new deck'), '', { icon: 'flashcards', ok: T('Create'), text: T('For example: Spanish unit 3, or Science test.') }); if (!n || !n.trim()) return;
        const d = { id: PatOS.uid(), name: n.trim().slice(0, 60), cards: [], mode: 'flip', dir: 'fb' }; decks.push(d); save(); edit(d);
      }
      /* paste a list (from Quizlet, a spreadsheet, a document) to fill a deck */
      function importDialog(into) {
        const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
        const name = h('input', { class: 'field', placeholder: T('Deck name'), value: into ? into.name : '', disabled: !!into, 'aria-label': T('Deck name') });
        const box = h('textarea', { class: 'field fc-paste', placeholder: T('One card per line:\nbonjour\thello\nmerci\tthank you'), spellcheck: 'false', 'aria-label': T('List') });
        const info = h('div', { class: 'fc-pinfo' });
        box.addEventListener('input', () => { const n = parseList(box.value).length; info.textContent = n ? n + ' ' + T(n === 1 ? 'card found' : 'cards found') : ''; });
        layer.appendChild(h('div', { class: 'dlg ce fc-pdlg' }, h('b', {}, T(into ? 'Add cards from a list' : 'Make a deck from a list')), h('p', { class: 'fc-pnote' }, T('Put the term and its definition on each line, with a tab between them (copying from Quizlet or a spreadsheet does this). A comma, semicolon or “ - ” works too.')), into ? null : name, box, info,
          h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: () => {
            const rows = parseList(box.value); if (!rows.length) { info.textContent = T('Nothing to import yet.'); return; }
            let d = into; if (!d) { d = { id: PatOS.uid(), name: (name.value || '').trim() || T('New Deck'), cards: [], mode: 'flip', dir: 'fb' }; decks.push(d); }
            rows.forEach(([f, b]) => d.cards.push(mk(f, b))); save(); close(); edit(d); toast(rows.length + ' ' + T(rows.length === 1 ? 'card added' : 'cards added'));
          } }, T('Add Cards')))));
        layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); }); layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        document.body.appendChild(layer); setTimeout(() => (into ? box : name).focus(), 30);
      }

      /* ---------- editing a deck ---------- */
      function edit(d) {
        leave(); bHome.style.visibility = ''; win.setTitle(d.name); main.innerHTML = '';
        const list = h('div', { class: 'fc-edit' });
        const rowEl = (c, i) => {
          const f = h('input', { class: 'field', value: c.f, placeholder: T('Front'), 'aria-label': T('Front') + ' ' + (i + 1) }); const b = h('input', { class: 'field', value: c.b, placeholder: T('Back'), 'aria-label': T('Back') + ' ' + (i + 1) });
          f.oninput = () => { c.f = f.value; save(); }; b.oninput = () => { c.b = b.value; save(); };
          // Enter on the last back adds a new card, so a whole deck can be typed without the mouse
          b.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (i === d.cards.length - 1) { d.cards.push(mk()); save(); draw(); list.lastChild.querySelector('input').focus(); } else list.children[i + 1].querySelector('input').focus(); } });
          f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); b.focus(); } });
          return h('div', { class: 'fc-erow' }, h('span', {}, i + 1), f, b, h('button', { class: 'tbtn', title: T('Delete card'), 'aria-label': T('Delete card'), onclick: () => { d.cards.splice(i, 1); save(); draw(); } }, '×'));
        };
        const count = h('small', { class: 'fc-ecount' });
        const draw = () => { list.innerHTML = ''; d.cards.forEach((c, i) => list.appendChild(rowEl(c, i))); count.textContent = d.cards.length + ' ' + T(d.cards.length === 1 ? 'card' : 'cards'); if (!d.cards.length) list.appendChild(h('div', { class: 'fc-hint' }, T('No cards yet. Add one, or paste a list.'))); };
        draw();
        const title = h('h2', { class: 'fc-etitle', title: T('Click to rename'), tabindex: '0' }, d.name);
        title.onclick = async () => { const n = await PatOS.ask(T('Rename deck'), d.name, { icon: 'flashcards', ok: T('Rename') }); if (n && n.trim()) { d.name = n.trim().slice(0, 60); save(); title.textContent = d.name; win.setTitle(d.name); } };
        const more = h('button', { class: 'btn', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu([
          { label: T('Add Cards from a List…'), action: () => importDialog(d) },
          { label: T('Copy Deck as Text'), disabled: !d.cards.length, action: () => { const t = d.cards.map((c) => c.f + '\t' + c.b).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(T('Copied'))).catch(() => PatOS.downloadFile(d.name + '.txt', t)); } },
          { label: T('Download as Text File'), disabled: !d.cards.length, action: () => PatOS.downloadFile(d.name + '.txt', d.cards.map((c) => c.f + '\t' + c.b).join('\n')) },
          { divider: true },
          { label: T('Swap Fronts and Backs'), disabled: !d.cards.length, action: () => { d.cards.forEach((c) => { const t = c.f; c.f = c.b; c.b = t; }); save(); draw(); } },
          { label: T('Reset Progress'), disabled: !d.cards.length, action: async () => { if (await PatOS.confirmBox(T('Reset progress for this deck?'), T('Every card goes back to new. The cards themselves stay.'), { ok: T('Reset'), danger: true, icon: 'flashcards' })) { d.cards.forEach((c) => Object.assign(c, { box: 0, due: 0, seen: 0, right: 0 })); delete d.best; save(); toast(T('Progress reset')); } } },
          { divider: true },
          { label: T('Delete Deck…'), action: async () => { if (await PatOS.confirmBox(T('Delete') + ' “' + d.name + '”?', T('All its cards will be deleted.'), { danger: true, ok: T('Delete'), icon: 'flashcards' })) { decks = decks.filter((x) => x !== d); save(); home(); } } }
        ], r.left - 120, r.bottom + 4); } }, '⋯');
        main.append(h('div', { class: 'fc-ehead' }, title, count, h('div', { style: { flex: 1 } }), more, h('button', { class: 'btn primary', onclick: () => ready(d), disabled: !d.cards.length }, T('Study'))),
          list, h('button', { class: 'btn fc-addcard', onclick: () => { d.cards.push(mk()); save(); draw(); list.lastChild.querySelector('input').focus(); } }, '+ ' + T('Add Card')));
        if (!d.cards.length) setTimeout(() => { d.cards.push(mk()); save(); draw(); list.lastChild.querySelector('input').focus(); }, 0);
      }

      /* ---------- before studying: what's due, and how ---------- */
      function ready(d) {
        leave(); const clean = d.cards.filter((c) => c.f.trim() || c.b.trim()); if (!clean.length) return edit(d);
        bHome.style.visibility = ''; win.setTitle(d.name); main.innerHTML = '';
        const s = stats(d); const smart = s.due + s.fresh > 0; let order = smart ? 'smart' : 'all';
        const seg = (opts, get, set) => { const box = h('div', { class: 'seg fc-seg' }); const paint = () => [...box.children].forEach((b) => b.classList.toggle('on', b.dataset.v === get())); opts.forEach(([v, l]) => box.appendChild(h('button', { class: 'tab', 'data-v': v, onclick: () => { set(v); save(); paint(); } }, T(l)))); paint(); return box; };
        const orderSeg = seg([['smart', 'Due and new'], ['all', 'All cards']], () => order, (v) => { order = v; refresh(); });
        const summary = h('div', { class: 'fc-sum' });
        const refresh = () => { const n = order === 'smart' ? Math.min(s.due + Math.min(s.fresh, NEW_PER_SESSION), clean.length) : clean.length; summary.innerHTML = ''; summary.append(h('div', { class: 'fc-sumn' }, String(n)), h('div', {}, T(order === 'smart' ? 'cards to study now' : 'cards, in random order')), order === 'smart' ? h('small', {}, s.due + ' ' + T('due') + ' · ' + Math.min(s.fresh, NEW_PER_SESSION) + ' ' + T('new') + (s.fresh > NEW_PER_SESSION ? ' (' + (s.fresh - NEW_PER_SESSION) + ' ' + T('more later') + ')' : '')) : null); go.disabled = n === 0; };
        const go = h('button', { class: 'btn primary fc-go', onclick: () => study(d, order) }, T('Start'));
        main.append(h('div', { class: 'fc-ready' }, h('h2', {}, d.name),
          summary,
          h('div', { class: 'fc-opt' }, h('span', {}, T('Study')), orderSeg),
          h('div', { class: 'fc-opt' }, h('span', {}, T('How')), seg([['flip', 'Flip the card'], ['write', 'Type the answer']], () => d.mode, (v) => { d.mode = v; })),
          h('div', { class: 'fc-opt' }, h('span', {}, T('Show first')), seg([['fb', 'Front'], ['bf', 'Back'], ['both', 'Both']], () => d.dir, (v) => { d.dir = v; })),
          h('div', { class: 'fc-rbtns' }, go, h('button', { class: 'btn', onclick: () => edit(d) }, T('Edit Cards'))),
          s.mastered ? h('small', { class: 'fc-hint' }, s.mastered + ' ' + T(s.mastered === 1 ? 'card mastered' : 'cards mastered')) : null));
        refresh(); setTimeout(() => go.focus(), 30);
      }

      /* ---------- a study session ---------- */
      function study(d, orderMode, only) {
        leave(); const now = Date.now();
        let pool = only || d.cards.filter((c) => c.f.trim() || c.b.trim());
        if (!only && orderMode === 'smart') { const due = pool.filter((c) => c.box > 0 && c.due <= now).sort((a, b) => a.due - b.due); const fresh = pool.filter((c) => c.box === 0).slice(0, NEW_PER_SESSION); pool = due.concat(fresh); }
        else pool = pool.slice().sort(() => Math.random() - 0.5);
        if (!pool.length) return ready(d);
        const queue = pool.slice(); const total = pool.length; const missed = new Set(), attempted = new Set(); let done = 0, busy = false, curOk = false;
        bHome.style.visibility = ''; main.innerHTML = '';
        const prog = h('div', { class: 'fc-prog' }, h('span'));
        const count = h('div', { class: 'fc-count' });
        const stage = h('div', { class: 'fc-stage' });
        const area = h('div', { class: 'fc-area' });
        const tip = h('div', { class: 'fc-tip' }, d.mode === 'write' ? '' : T('Click the card or press Space to flip. 1 = didn’t know, 2 = knew it.'));
        main.append(prog, count, stage, tip, area);
        let cur = null, flipped = false, answered = false, side = 'fb', card = null, input = null;
        const pickSide = () => (d.dir === 'both' ? (Math.random() < 0.5 ? 'fb' : 'bf') : d.dir);
        const q = () => (side === 'fb' ? cur.f : cur.b), a = () => (side === 'fb' ? cur.b : cur.f);
        function show() {
          if (!queue.length) return finish();
          cur = queue[0]; side = pickSide(); flipped = false; answered = false; stage.innerHTML = ''; area.innerHTML = '';
          count.textContent = Math.min(done + 1, total) + ' / ' + total + (cur.box === 0 ? ' · ' + T('new') : '');
          prog.firstChild.style.width = (done / total * 100) + '%';
          if (d.mode === 'write') {
            const qEl = h('div', { class: 'fc-face front fc-qface' }, q()); const fb = h('div', { class: 'fc-feedback' });
            card = h('div', { class: 'fc-card fc-flat' }, qEl); stage.appendChild(card);
            input = h('input', { class: 'field fc-write', placeholder: T('Type the answer'), spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': T('Your answer') });
            const check = () => {
              if (answered) return next(curOk);
              const ok = accepts(a(), input.value); answered = true; curOk = ok; input.disabled = true;
              fb.className = 'fc-feedback ' + (ok ? 'ok' : 'bad'); fb.innerHTML = ''; fb.append(h('b', {}, ok ? T('Correct') : T('Not quite')), ok ? null : h('span', {}, T('The answer is') + ': ' + a()));
              PatOS.sound.tone(ok ? 1200 : 300, ok ? 0.1 : 0.15, { vol: 0.06 });
              btn.textContent = T('Continue'); area.querySelector('.fc-over') && area.querySelector('.fc-over').remove();
              if (!ok) area.appendChild(h('button', { class: 'ct-addrow fc-over', onclick: () => { curOk = true; fb.className = 'fc-feedback ok'; fb.textContent = T('Counted as correct'); area.querySelector('.fc-over').remove(); } }, T('I was right')));
              btn.focus();
            };
            const btn = h('button', { class: 'btn primary', onclick: check }, T('Check'));
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
            area.append(h('div', { class: 'fc-wrow' }, input, btn), fb); input.focus();
            btn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); check(); } });
          } else {
            card = h('div', { class: 'fc-card' }, h('div', { class: 'fc-face front' }, q()), h('div', { class: 'fc-face back' }, a()));
            card.onclick = flip; stage.appendChild(card);
            card.animate([{ transform: 'translateX(60px) rotate(4deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
            buttons();
          }
        }
        function flip() { if (d.mode === 'write') return; flipped = !flipped; card.classList.toggle('flipped', flipped); PatOS.sound.tone(900, 0.04, { vol: 0.04 }); buttons(); }
        function buttons() {
          if (d.mode === 'write') return; area.innerHTML = '';
          if (!flipped) { area.appendChild(h('div', { class: 'fc-btns' }, h('button', { class: 'btn primary', onclick: flip }, T('Show Answer')))); return; }
          area.appendChild(h('div', { class: 'fc-btns' }, h('button', { class: 'btn fc-wrong', onclick: () => next(false) }, T('Didn’t know') + ' (1)'), h('button', { class: 'btn fc-right', onclick: () => next(true) }, T('Knew it') + ' (2)')));
        }
        function next(ok) {
          if (!cur || busy) return; busy = true; const c = cur;
          // only the first answer counts for scheduling; coming back after a miss is just practice
          if (!attempted.has(c.id)) { attempted.add(c.id); grade(c, ok); }
          queue.shift();
          if (ok) { done++; PatOS.sound.tone(1200, 0.1, { vol: 0.06 }); }
          else { missed.add(c); queue.push(c); PatOS.sound.tone(300, 0.15, { vol: 0.06 }); }
          save();
          const out = card && card.animate([{ transform: card.classList.contains('flipped') ? 'rotateY(180deg)' : 'none', opacity: 1 }, { transform: `translateX(${ok ? 200 : -200}px) rotate(${ok ? 12 : -12}deg)`, opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
          const after = () => { busy = false; show(); };
          if (out) out.onfinish = after; else after();
        }
        function finish() {
          leave(); const s2 = touchStreak(); const first = total - missed.size; const pct = Math.round(first / total * 100);
          if (!only && (d.best == null || pct > d.best)) d.best = pct; save();
          const left = stats(d); main.innerHTML = '';
          main.append(h('div', { class: 'fc-done' }, h('div', { class: 'fc-score' }, pct + '%'), h('h2', {}, pct === 100 ? T('Every single one. Nice.') : pct >= 70 ? T('Solid work.') : T('Give it another go.')),
            h('p', {}, first + ' ' + T('of') + ' ' + total + ' ' + T('right the first time')),
            h('p', { class: 'fc-hint' }, left.due + left.fresh ? left.due + ' ' + T('due') + ' · ' + left.fresh + ' ' + T('new') + ' ' + T('left in this deck') : T('You’re all caught up. The cards will come back when they are due.')),
            s2.n > 1 ? h('p', { class: 'fc-hint' }, s2.n + ' ' + T('days in a row') + '.') : null,
            h('div', { class: 'fc-rbtns' }, missed.size ? h('button', { class: 'btn primary', onclick: () => study(d, 'all', [...missed]) }, T('Study the ones I missed') + ' (' + missed.size + ')') : null, left.due + left.fresh ? h('button', { class: 'btn' + (missed.size ? '' : ' primary'), onclick: () => ready(d) }, T('Keep Studying')) : null, h('button', { class: 'btn', onclick: () => home() }, T('Done')))));
        }
        const onKey = (e) => {
          if (PatOS.wm.active !== win || !main.contains(stage) || (e.target && e.target.closest && e.target.closest('input, textarea')) || e.ctrlKey || e.metaKey || e.altKey) return;
          if (d.mode === 'write') { if (e.key === 'Escape') home(); return; }
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!flipped) flip(); }
          else if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) next(false); else if (flipped && (e.key === '2' || e.key === 'ArrowRight')) next(true);
          else if (e.key === 'Escape') home();
        };
        document.addEventListener('keydown', onKey); cleanup = () => document.removeEventListener('keydown', onKey);
        show();
      }
      win.on('closed', leave);
      win._fc = { newDeck, import: () => importDialog(), home };
      home();
    },
    menus(win) {
      const F = win._fc || {};
      return { file: [
        { label: PatOS.t('New Deck'), shortcut: 'Alt+N', action: () => F.newDeck && F.newDeck() },
        { label: PatOS.t('Paste a List…'), action: () => F.import && F.import() },
        { divider: true },
        { label: PatOS.t('All Decks'), action: () => F.home && F.home() },
        { label: PatOS.t('Close Window'), shortcut: 'Alt+W', action: () => win.close() }
      ] };
    }
  });
})();
