/* Forms — build surveys and quizzes, fill them in, see the results. Saved as .pform */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const TYPES = [['short', 'Short answer'], ['long', 'Paragraph'], ['choice', 'Multiple choice'], ['check', 'Checkboxes'], ['dropdown', 'Dropdown'], ['scale', 'Linear scale'], ['rating', 'Rating'], ['number', 'Number'], ['email', 'Email'], ['date', 'Date'], ['time', 'Time'], ['section', 'Section']];
  const HAS_OPTS = ['choice', 'check', 'dropdown'];
  const COLORS = ['#7248b9', '#1a73e8', '#188038', '#d93025', '#e37400', '#0097a7', '#c2185b', '#455a64'];
  const q = (type, text, extra) => Object.assign({ id: PatOS.uid(), type, text: T(text) }, HAS_OPTS.includes(type) ? { options: [T('Option 1'), T('Option 2')] } : {}, extra || {});
  const TEMPLATES = [
    { name: 'Blank form', form: () => ({ title: T('Untitled form'), questions: [q('choice', 'Untitled question')] }), preview: '<b>Form</b><i></i><em></em><em></em>' },
    { name: 'Quiz', sub: 'Graded automatically', form: () => ({ title: T('Quiz'), quiz: true, color: '#1a73e8', questions: [q('choice', 'What is 7 × 8?', { options: ['54', '56', '64'], answer: 1, points: 1 }), q('choice', 'Which planet is closest to the Sun?', { options: [T('Venus'), T('Mercury'), T('Mars')], answer: 1, points: 1 }), q('short', 'What is the capital of Canada?', { answer: 'Ottawa', points: 1 })] }), preview: '<b>Quiz</b><em></em><em></em><em></em>' },
    { name: 'Event sign-up', form: () => ({ title: T('Event sign-up'), color: '#188038', questions: [q('short', 'Your name', { req: true }), q('email', 'Email', { req: true }), q('choice', 'Will you come?', { options: [T('Yes'), T('No'), T('Maybe')], req: true }), q('number', 'How many people with you?')] }), preview: '<b>Sign-up</b><i></i><i></i><em></em>' },
    { name: 'Feedback', form: () => ({ title: T('Feedback'), color: '#e37400', questions: [q('rating', 'How would you rate it?', { max: 5, req: true }), q('scale', 'How likely are you to recommend it?', { min: 0, max: 10, lo: T('Not likely'), hi: T('Very likely') }), q('long', 'What could be better?')] }), preview: '<b>★★★★</b><i></i><s></s>' },
    { name: 'Class poll', form: () => ({ title: T('Class poll'), color: '#c2185b', questions: [q('choice', 'What is your favourite subject?', { options: [T('Math'), T('Science'), T('Art'), T('Gym')] }), q('check', 'Which clubs would you join?', { options: [T('Robotics'), T('Drama'), T('Chess'), T('Sports')] })] }), preview: '<b>Poll</b><em></em><em></em>' }
  ];

  PatOS.registerApp({
    id: 'forms', name: 'Forms', icon: 'forms', single: false, width: 900, height: 720, category: 'Office', keywords: 'survey quiz questionnaire poll google forms formulaire',
    about: 'Make surveys and quizzes, answer them and see the results.',
    launch(win, args) {
      win.el.classList.add('office-win', 'fx-win');
      win.setTitle(T('Forms'));
      if (args.path) return openForm(win, args.path);
      PatOS.office.startScreen(win, {
        title: 'Forms', icon: 'forms', ext: ['pform'], templates: TEMPLATES,
        onCreate: (t) => { const f = Object.assign({ desc: '', quiz: false, color: COLORS[0], responses: [], accepting: true, settings: {} }, t.form()); const p = PatOS.newDocPath('/Documents', f.title, 'pform'); PatOS.fs.write(p, JSON.stringify(f)); openForm(win, p); },
        onOpen: (p) => openForm(win, p)
      });
    }
  });

  function openForm(win, path) {
    PatOS.remember && PatOS.remember(win, { path });
    const OF = PatOS.office;
    win.el.classList.add('has-toolbar');
    let form; try { form = JSON.parse(PatOS.fs.read(path)); } catch (e) { form = null; }
    form = Object.assign({ title: T('Untitled form'), desc: '', quiz: false, color: COLORS[0], questions: [], responses: [], accepting: true, settings: {} }, form || {});
    let tab = 'edit', active = form.questions[0] ? form.questions[0].id : null, respIdx = 0;
    const baseName = () => PatOS.fs.basename(path).replace(/\.pform$/, '');
    const head = OF.header(win, {
      name: baseName(), icon: 'forms', getPath: () => path,
      onRename: (nn) => { nn = (nn || T('Untitled form')).replace(/[\/]/g, '-'); try { path = PatOS.fs.rename(path, PatOS.fs.uniqueName(PatOS.fs.dirname(path), nn + '.pform')); PatOS.remember && PatOS.remember(win, { path }); } catch (e) {} head.name.value = baseName(); win.setTitle(baseName()); }
    });
    win.toolbar.append(head.el); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
    win.setTitle(baseName());
    head.right.append(
      OF.btn('theme', 'Theme color', (e, b) => { const p = OF.pop(b, h('div', { class: 'fx-colors' }, ...COLORS.map((c) => h('button', { style: { background: c }, class: form.color === c ? 'on' : '', onclick: () => { form.color = c; save(); paintColor(); p.close(); render(); } })))); }),
      OF.btn('settings', 'Settings', openSettings),
      OF.btn('eye', 'Preview', () => { tab = 'fill'; render(); }));
    const tabs = h('div', { class: 'fx-tabs' });
    [['edit', 'Questions'], ['fill', 'Answer'], ['results', 'Responses']].forEach(([k, l]) => tabs.appendChild(h('button', { 'data-k': k, onclick: () => { tab = k; render(); } }, T(l))));
    const main = h('div', { class: 'fm-main fx-main' });
    win.body.append(tabs, main);
    function paintColor() { win.body.style.setProperty('--fc', form.color || COLORS[0]); }
    paintColor();
    const persist = PatOS.debounce(() => { try { PatOS.fs.write(path, JSON.stringify(form)); head.saved(); } catch (e) { head.failed(); } }, 350);
    function save() { head.saving(); persist(); }

    /* ---------- editor ---------- */
    function edit() {
      const hd = h('div', { class: 'fm-card fm-head fx-card' });
      const t = h('input', { class: 'fm-title', value: form.title, placeholder: T('Form title') }); t.oninput = () => { form.title = t.value; save(); };
      const d = h('textarea', { class: 'fm-desc fx-desc', placeholder: T('Form description'), rows: 1 }); d.value = form.desc || ''; d.oninput = () => { form.desc = d.value; d.style.height = 'auto'; d.style.height = d.scrollHeight + 'px'; save(); };
      const quiz = h('button', { class: 'switch' + (form.quiz ? ' on' : '') }); quiz.onclick = () => { form.quiz = !form.quiz; save(); render(); };
      hd.append(t, d, h('label', { class: 'fm-quiz' }, quiz, ' ' + T('Make this a quiz (mark the right answers to grade it)')));
      main.appendChild(hd);
      setTimeout(() => { d.style.height = d.scrollHeight + 'px'; }, 0);
      form.questions.forEach((qq, qi) => main.appendChild(qq.id === active ? editCard(qq, qi) : previewCard(qq, qi)));
      const add = h('div', { class: 'fx-add' }, ...[['choice', 'Multiple choice'], ['short', 'Short answer'], ['check', 'Checkboxes'], ['scale', 'Linear scale'], ['section', 'Section']].map(([k, l]) => h('button', { onclick: () => addQ(k) }, '+ ' + T(l))), h('button', { onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu(TYPES.map(([k, l]) => ({ label: T(l), action: () => addQ(k) })), r.left, r.bottom + 4); } }, T('More…')));
      main.appendChild(add);
    }
    function addQ(type, after) {
      const nq = q(type, type === 'section' ? 'Section title' : '', type === 'scale' ? { min: 1, max: 5 } : type === 'rating' ? { max: 5 } : {});
      if (type !== 'section') nq.text = '';
      const i = after != null ? after + 1 : (form.questions.findIndex((x) => x.id === active) + 1 || form.questions.length);
      form.questions.splice(i, 0, nq); active = nq.id; save(); render();
      setTimeout(() => { const el = main.querySelector('.fx-card.active .fm-q'); if (el) { el.focus(); el.closest('.fx-card').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 30);
    }
    function previewCard(qq, qi) {
      const card = h('div', { class: 'fm-card fx-card fx-prev' + (qq.type === 'section' ? ' fx-sec' : ''), draggable: 'true' },
        h('div', { class: 'fx-grip', html: OF.icon('grip', 16) }),
        h('b', { class: 'fm-qt' }, qq.text || T(qq.type === 'section' ? 'Section' : 'Untitled question'), qq.req ? h('span', { class: 'fm-req' }, ' *') : null, form.quiz && qq.points ? h('span', { class: 'fx-pts' }, qq.points + ' ' + T('pt')) : null),
        qq.desc ? h('small', { class: 'fx-qdesc' }, qq.desc) : null,
        h('div', { class: 'fx-mini' }, ...inputFor(qq, {}, true)));
      card.onclick = () => { active = qq.id; render(); };
      dnd(card, qi);
      return card;
    }
    function dnd(card, qi) {
      card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/fq', qi); card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('over'); });
      card.addEventListener('dragleave', () => card.classList.remove('over'));
      card.addEventListener('drop', (e) => { e.preventDefault(); card.classList.remove('over'); const from = +e.dataTransfer.getData('text/fq'); if (isNaN(from) || from === qi) return; form.questions.splice(qi, 0, form.questions.splice(from, 1)[0]); save(); render(); });
    }
    function editCard(qq, qi) {
      const card = h('div', { class: 'fm-card fx-card active' + (qq.type === 'section' ? ' fx-sec' : ''), draggable: 'false' });
      const grip = h('div', { class: 'fx-grip', html: OF.icon('grip', 16), title: T('Drag to move') });
      grip.addEventListener('pointerdown', () => { card.draggable = true; }); card.addEventListener('dragend', () => { card.draggable = false; });
      dnd(card, qi);
      const text = h('input', { class: 'fm-q', value: qq.text, placeholder: T(qq.type === 'section' ? 'Section title' : 'Question') }); text.oninput = () => { qq.text = text.value; save(); };
      const type = h('select', { class: 'field fx-type' }, ...TYPES.map(([v, l]) => h('option', { value: v }, T(l)))); type.value = qq.type;
      type.onchange = () => { qq.type = type.value; if (HAS_OPTS.includes(qq.type) && !qq.options) qq.options = [T('Option 1')]; if (qq.type === 'scale') { qq.min = qq.min ?? 1; qq.max = qq.max ?? 5; } if (qq.type === 'rating') qq.max = qq.max || 5; delete qq.answer; save(); render(); };
      const desc = h('input', { class: 'fx-qd', value: qq.desc || '', placeholder: T('Description (optional)') }); desc.oninput = () => { qq.desc = desc.value; save(); };
      card.append(grip, h('div', { class: 'fm-row' }, text, type), desc);
      if (HAS_OPTS.includes(qq.type)) {
        const list = h('div', { class: 'fx-opts' });
        qq.options.forEach((o, oi) => {
          const oin = h('input', { class: 'fm-opt', value: o, placeholder: T('Option') + ' ' + (oi + 1) });
          oin.oninput = () => { qq.options[oi] = oin.value; save(); };
          oin.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); qq.options.splice(oi + 1, 0, ''); save(); render(); setTimeout(() => { const all = main.querySelectorAll('.fx-card.active .fm-opt'); all[oi + 1] && all[oi + 1].focus(); }, 20); } if (e.key === 'Backspace' && !oin.value && qq.options.length > 1) { e.preventDefault(); qq.options.splice(oi, 1); save(); render(); setTimeout(() => { const all = main.querySelectorAll('.fx-card.active .fm-opt'); all[Math.max(0, oi - 1)] && all[Math.max(0, oi - 1)].focus(); }, 20); } });
          const isRight = qq.type === 'check' ? (qq.answer || []).includes(oi) : qq.answer === oi;
          const mark = form.quiz ? h('button', { class: 'fm-key' + (isRight ? ' on' : ''), title: T('Correct answer') }, '✓') : null;
          if (mark) mark.onclick = () => { if (qq.type === 'check') { qq.answer = qq.answer || []; const k = qq.answer.indexOf(oi); if (k >= 0) qq.answer.splice(k, 1); else qq.answer.push(oi); } else qq.answer = qq.answer === oi ? undefined : oi; save(); render(); };
          list.appendChild(h('div', { class: 'fm-orow' }, h('span', { class: qq.type === 'check' ? 'fm-box' : qq.type === 'dropdown' ? 'fx-num' : 'fm-radio' }, qq.type === 'dropdown' ? String(oi + 1) : ''), oin, mark, qq.options.length > 1 ? h('button', { class: 'tbtn', title: T('Remove'), onclick: () => { qq.options.splice(oi, 1); if (qq.answer === oi) delete qq.answer; save(); render(); } }, '×') : null));
        });
        card.appendChild(list);
        card.appendChild(h('div', { class: 'fx-optbtns' }, h('button', { class: 'fm-addopt', onclick: () => { qq.options.push(T('Option') + ' ' + (qq.options.length + 1)); save(); render(); } }, '+ ' + T('Add option')), qq.type !== 'dropdown' && !qq.other ? h('button', { class: 'fm-addopt', onclick: () => { qq.other = true; save(); render(); } }, T('Add “Other”')) : null));
        if (qq.other) card.appendChild(h('div', { class: 'fm-orow fx-other' }, h('span', { class: qq.type === 'check' ? 'fm-box' : 'fm-radio' }), h('span', {}, T('Other…')), h('button', { class: 'tbtn', onclick: () => { qq.other = false; save(); render(); } }, '×')));
      } else if (qq.type === 'scale') {
        const mn = h('select', { class: 'field' }, ...[0, 1].map((n) => h('option', { value: n }, n))); mn.value = String(qq.min ?? 1); mn.onchange = () => { qq.min = +mn.value; save(); };
        const mx = h('select', { class: 'field' }, ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => h('option', { value: n }, n))); mx.value = String(qq.max ?? 5); mx.onchange = () => { qq.max = +mx.value; save(); };
        const lo = h('input', { class: 'fm-opt', value: qq.lo || '', placeholder: T('Label (optional)') }); lo.oninput = () => { qq.lo = lo.value; save(); };
        const hi = h('input', { class: 'fm-opt', value: qq.hi || '', placeholder: T('Label (optional)') }); hi.oninput = () => { qq.hi = hi.value; save(); };
        card.append(h('div', { class: 'fx-scaleset' }, mn, h('span', {}, T('to')), mx), h('div', { class: 'fx-scaleset' }, h('span', {}, String(qq.min ?? 1)), lo), h('div', { class: 'fx-scaleset' }, h('span', {}, String(qq.max ?? 5)), hi));
      } else if (qq.type === 'rating') {
        const mx = h('select', { class: 'field' }, ...[3, 4, 5, 6, 7, 8, 9, 10].map((n) => h('option', { value: n }, n + ' ' + T('stars')))); mx.value = String(qq.max || 5); mx.onchange = () => { qq.max = +mx.value; save(); };
        card.appendChild(h('div', { class: 'fx-scaleset' }, mx));
      } else if (qq.type === 'number') {
        const mn = h('input', { class: 'fm-opt fx-small', type: 'number', value: qq.nmin ?? '', placeholder: T('Min') }); mn.oninput = () => { qq.nmin = mn.value === '' ? undefined : +mn.value; save(); };
        const mx = h('input', { class: 'fm-opt fx-small', type: 'number', value: qq.nmax ?? '', placeholder: T('Max') }); mx.oninput = () => { qq.nmax = mx.value === '' ? undefined : +mx.value; save(); };
        card.appendChild(h('div', { class: 'fx-scaleset' }, h('span', {}, T('Allowed range')), mn, mx));
        if (form.quiz) { const ans = h('input', { class: 'fm-opt', type: 'number', value: qq.answer ?? '', placeholder: T('Correct answer (optional)') }); ans.oninput = () => { qq.answer = ans.value === '' ? undefined : +ans.value; save(); }; card.appendChild(ans); }
      } else if (qq.type === 'short' && form.quiz) {
        const ans = h('input', { class: 'fm-opt', value: qq.answer || '', placeholder: T('Correct answer (optional; separate several with |)') }); ans.oninput = () => { qq.answer = ans.value; save(); }; card.appendChild(ans);
      } else if (qq.type !== 'section') card.appendChild(h('div', { class: 'fx-mini' }, ...inputFor(qq, {}, true)));
      const tools = h('div', { class: 'fm-tools fx-tools' });
      if (form.quiz && qq.type !== 'section') { const pts = h('input', { class: 'fx-ptsin', type: 'number', min: 0, value: qq.points ?? 1, title: T('Points') }); pts.oninput = () => { qq.points = Math.max(0, +pts.value || 0); save(); }; tools.append(h('label', { class: 'fx-ptsl' }, pts, ' ' + T('points'))); }
      tools.append(
        h('button', { class: 'tbtn', title: T('Duplicate'), html: OF.icon('copy', 17), onclick: () => { const c = Object.assign(JSON.parse(JSON.stringify(qq)), { id: PatOS.uid() }); form.questions.splice(qi + 1, 0, c); active = c.id; save(); render(); } }),
        h('button', { class: 'tbtn', title: T('Delete'), html: OF.icon('trash', 17), onclick: () => { form.questions.splice(qi, 1); active = form.questions[Math.max(0, qi - 1)] ? form.questions[Math.max(0, qi - 1)].id : null; save(); render(); } }),
        qq.type !== 'section' ? h('span', { class: 'fx-vsep' }) : null,
        qq.type !== 'section' ? h('label', { class: 'fx-req' }, T('Required'), (() => { const s = h('button', { class: 'switch' + (qq.req ? ' on' : '') }); s.onclick = () => { qq.req = !qq.req; s.classList.toggle('on', qq.req); save(); }; return s; })()) : null,
        HAS_OPTS.includes(qq.type) ? h('label', { class: 'fx-req' }, T('Shuffle'), (() => { const s = h('button', { class: 'switch' + (qq.shuffle ? ' on' : '') }); s.onclick = () => { qq.shuffle = !qq.shuffle; s.classList.toggle('on', qq.shuffle); save(); }; return s; })()) : null);
      card.appendChild(tools);
      return card;
    }

    /* ---------- answering ---------- */
    function inputFor(qq, answers, disabled) {
      const set = (v) => { answers[qq.id] = v; };
      const out = [];
      let opts = (qq.options || []).map((o, i) => [o, i]);
      if (qq.shuffle && !disabled) opts = opts.sort(() => Math.random() - 0.5);
      if (qq.type === 'choice') { opts.forEach(([o, oi]) => out.push(h('label', { class: 'fm-pick' }, h('input', { type: 'radio', name: 'q' + qq.id + (disabled ? 'p' : ''), disabled, onchange: () => set(oi) }), ' ', o))); if (qq.other) { const t = h('input', { class: 'fx-otherin', placeholder: T('Other…'), disabled }); t.oninput = () => set('other:' + t.value); out.push(h('label', { class: 'fm-pick' }, h('input', { type: 'radio', name: 'q' + qq.id + (disabled ? 'p' : ''), disabled, onchange: () => set('other:' + t.value) }), ' ', t)); } }
      else if (qq.type === 'check') { opts.forEach(([o, oi]) => out.push(h('label', { class: 'fm-pick' }, h('input', { type: 'checkbox', disabled, onchange: (e) => { const a = answers[qq.id] = (answers[qq.id] || []).filter((x) => x !== oi); if (e.target.checked) a.push(oi); } }), ' ', o))); }
      else if (qq.type === 'dropdown') { const s = h('select', { class: 'field fx-dd', disabled }, h('option', { value: '' }, T('Choose')), ...opts.map(([o, oi]) => h('option', { value: oi }, o))); s.onchange = () => set(s.value === '' ? undefined : +s.value); out.push(s); }
      else if (qq.type === 'short' || qq.type === 'email') { const i = h('input', { class: 'field fx-in', type: qq.type === 'email' ? 'email' : 'text', placeholder: T(qq.type === 'email' ? 'name@example.com' : 'Your answer'), disabled }); i.oninput = () => set(i.value); out.push(i); }
      else if (qq.type === 'long') { const i = h('textarea', { class: 'field fm-long fx-in', placeholder: T('Your answer'), disabled }); i.oninput = () => set(i.value); out.push(i); }
      else if (qq.type === 'number') { const i = h('input', { class: 'field fx-in', type: 'number', min: qq.nmin, max: qq.nmax, placeholder: T('Number'), disabled }); i.oninput = () => set(i.value === '' ? undefined : +i.value); out.push(i); }
      else if (qq.type === 'date' || qq.type === 'time') { const i = h('input', { class: 'field fx-in fx-small', type: qq.type, disabled }); i.oninput = () => set(i.value); out.push(i); }
      else if (qq.type === 'scale') { const row = h('div', { class: 'fm-scale fx-scale' }); if (qq.lo) row.appendChild(h('span', { class: 'fx-lab' }, qq.lo)); for (let n = qq.min ?? 1; n <= (qq.max ?? 5); n++) row.appendChild(h('label', {}, h('small', {}, n), h('input', { type: 'radio', name: 'q' + qq.id + (disabled ? 'p' : ''), disabled, onchange: () => set(n) }))); if (qq.hi) row.appendChild(h('span', { class: 'fx-lab' }, qq.hi)); out.push(row); }
      else if (qq.type === 'rating') { const row = h('div', { class: 'fx-stars' }); const paint = (n) => [...row.children].forEach((b, i) => b.classList.toggle('on', i < n)); for (let n = 1; n <= (qq.max || 5); n++) { const b = h('button', { type: 'button', disabled, html: '<svg viewBox="0 0 24 24" width="30" height="30"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>' }); b.onclick = () => { set(n); paint(n); }; b.onmouseenter = () => !disabled && paint(n); b.onmouseleave = () => paint(answers[qq.id] || 0); row.appendChild(b); } out.push(row); }
      return out;
    }
    function missingOrInvalid(qq, a) {
      const v = a[qq.id];
      if (qq.req && (v == null || v === '' || (Array.isArray(v) && !v.length) || v === 'other:')) return T('This question is required.');
      if (v == null || v === '') return null;
      if (qq.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return T('Enter a valid email address.');
      if (qq.type === 'number' && ((qq.nmin != null && v < qq.nmin) || (qq.nmax != null && v > qq.nmax))) return T('Enter a number between') + ' ' + (qq.nmin ?? '…') + ' ' + T('and') + ' ' + (qq.nmax ?? '…') + '.';
      return null;
    }
    function fill() {
      if (!form.accepting) { main.appendChild(h('div', { class: 'fm-card fm-head fx-card' }, h('h1', {}, form.title), h('p', {}, T('This form isn’t accepting responses right now.')))); return; }
      const answers = {};
      // sections split the form into pages
      const pages = [[]]; form.questions.forEach((qq) => { if (qq.type === 'section' && pages[pages.length - 1].length) pages.push([qq]); else pages[pages.length - 1].push(qq); });
      let pg = 0;
      const wrap = h('div', { class: 'fx-fill' }); main.appendChild(wrap);
      const draw = () => {
        wrap.innerHTML = '';
        const prog = pages.length > 1 ? h('div', { class: 'fx-prog' }, h('i', {}, h('b', { class: 'fx-progfill', style: { width: ((pg + 1) / pages.length * 100) + '%' } })), h('small', {}, T('Page') + ' ' + (pg + 1) + ' / ' + pages.length)) : null;
        wrap.appendChild(h('div', { class: 'fm-card fm-head fx-card' }, h('h1', {}, form.title), form.desc ? h('p', {}, form.desc) : null, h('small', { class: 'fx-reqnote' }, '* ' + T('Required')), prog));
        const errs = {};
        pages[pg].forEach((qq) => {
          if (qq.type === 'section') { wrap.appendChild(h('div', { class: 'fm-card fx-card fx-sec' }, h('h2', {}, qq.text), qq.desc ? h('p', {}, qq.desc) : null)); return; }
          const err = h('div', { class: 'fx-err' }); errs[qq.id] = err;
          wrap.appendChild(h('div', { class: 'fm-card fx-card', 'data-q': qq.id }, h('b', { class: 'fm-qt' }, qq.text || T('Untitled question'), qq.req ? h('span', { class: 'fm-req' }, ' *') : null, form.quiz && qq.points && form.settings.showPoints !== false ? h('span', { class: 'fx-pts' }, qq.points + ' ' + T('pt')) : null), qq.desc ? h('small', { class: 'fx-qdesc' }, qq.desc) : null, ...inputFor(qq, answers), err));
        });
        const check = () => { let first = null; pages[pg].forEach((qq) => { if (!errs[qq.id]) return; const m = missingOrInvalid(qq, answers); errs[qq.id].textContent = m || ''; errs[qq.id].parentNode.classList.toggle('bad', !!m); if (m && !first) first = errs[qq.id].parentNode; }); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return !first; };
        const nav = h('div', { class: 'fx-nav' });
        if (pg > 0) nav.appendChild(h('button', { class: 'btn', onclick: () => { pg--; draw(); main.scrollTop = 0; } }, T('Back')));
        if (pg < pages.length - 1) nav.appendChild(h('button', { class: 'btn primary fx-btn', onclick: () => { if (check()) { pg++; draw(); main.scrollTop = 0; } } }, T('Next')));
        else nav.appendChild(h('button', { class: 'btn primary fx-btn', onclick: () => { if (!check()) return; submit(answers); } }, T('Submit')));
        nav.appendChild(h('button', { class: 'fx-clear', onclick: () => { Object.keys(answers).forEach((k) => delete answers[k]); pg = 0; draw(); } }, T('Clear form')));
        wrap.appendChild(nav);
      };
      draw();
    }
    function submit(answers) {
      form.responses.push({ t: Date.now(), a: answers }); save();
      main.innerHTML = '';
      const g = form.quiz ? grade(answers) : null;
      const card = h('div', { class: 'fm-card fm-head fx-card fx-thanks' }, h('div', { class: 'fx-check' }, '✓'), h('h1', {}, form.title), h('p', {}, form.settings.thanks || T('Your response has been recorded.')));
      if (g) card.appendChild(h('div', { class: 'fx-score' }, h('b', {}, g.got + ' / ' + g.max), h('span', {}, T('points'))));
      card.appendChild(h('div', { class: 'fx-nav' }, h('button', { class: 'btn', onclick: render }, T('Submit another response')), g ? h('button', { class: 'btn', onclick: () => review(answers) }, T('View score')) : null));
      main.appendChild(card);
      if (g && g.got === g.max && g.max) confetti(card);
    }
    function confetti(el) { for (let i = 0; i < 40; i++) { const c = h('i', { class: 'fx-conf', style: { left: Math.random() * 100 + '%', background: COLORS[i % COLORS.length], animationDelay: Math.random() * 0.4 + 's', transform: 'rotate(' + Math.random() * 360 + 'deg)' } }); el.appendChild(c); setTimeout(() => c.remove(), 2200); } }
    function correct(qq, v) {
      if (qq.answer == null || qq.answer === '' || (Array.isArray(qq.answer) && !qq.answer.length)) return null;
      if (qq.type === 'check') return Array.isArray(v) && v.slice().sort().join() === qq.answer.slice().sort().join();
      if (qq.type === 'short') return String(qq.answer).split('|').some((a) => String(v || '').trim().toLowerCase() === a.trim().toLowerCase());
      return v === qq.answer;
    }
    function grade(a) { let got = 0, max = 0; form.questions.forEach((qq) => { const c = correct(qq, a[qq.id]); if (c === null) return; const p = qq.points ?? 1; max += p; if (c) got += p; }); return { got, max }; }
    function review(a) {
      main.innerHTML = '';
      main.appendChild(h('div', { class: 'fm-card fm-head fx-card' }, h('h1', {}, form.title), h('p', {}, T('Score') + ': ' + grade(a).got + ' / ' + grade(a).max)));
      form.questions.forEach((qq) => {
        if (qq.type === 'section') return;
        const c = correct(qq, a[qq.id]);
        const label = (v) => (v == null || v === '' ? '—' : HAS_OPTS.includes(qq.type) ? [].concat(v).map((x) => (typeof x === 'string' && x.startsWith('other:') ? x.slice(6) : qq.options[x])).join(', ') : String(v));
        main.appendChild(h('div', { class: 'fm-card fx-card fx-rev ' + (c === true ? 'ok' : c === false ? 'no' : '') }, h('b', { class: 'fm-qt' }, qq.text), h('div', {}, T('Your answer') + ': ' + label(a[qq.id])), c === false ? h('div', { class: 'fx-right' }, T('Correct answer') + ': ' + (qq.type === 'short' ? String(qq.answer).split('|')[0] : label(qq.answer))) : null));
      });
      main.appendChild(h('div', { class: 'fx-nav' }, h('button', { class: 'btn', onclick: render }, T('Done'))));
    }

    /* ---------- responses ---------- */
    function results() {
      const n = form.responses.length;
      const acc = h('button', { class: 'switch' + (form.accepting ? ' on' : '') }); acc.onclick = () => { form.accepting = !form.accepting; acc.classList.toggle('on', form.accepting); save(); };
      const view = h('div', { class: 'seg fx-rseg' }, ...[['summary', 'Summary'], ['individual', 'Individual']].map(([k, l]) => h('button', { class: 'tab' + ((win._rv || 'summary') === k ? ' on' : ''), onclick: () => { win._rv = k; render(); } }, T(l))));
      main.appendChild(h('div', { class: 'fm-card fm-head fx-card' }, h('div', { class: 'fx-rhead' }, h('h1', {}, n + ' ' + T(n === 1 ? 'response' : 'responses')), h('div', { class: 'fx-ract' },
        n ? h('button', { class: 'btn', onclick: exportCSV, html: OF.icon('download', 15) + ' ' + T('Download CSV') }) : null,
        n ? h('button', { class: 'btn', onclick: () => { const p = PatOS.newDocPath('/Documents', form.title + ' ' + T('responses'), 'csv'); PatOS.fs.write(p, csv()); PatOS.launch('sheets', { path: p }); } }, T('Open in Sheets')) : null,
        n ? h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Delete all responses?'), T('This cannot be undone.'), { danger: true, ok: T('Delete'), icon: 'forms' })) { form.responses = []; save(); render(); } } }, T('Delete all')) : null)),
        h('label', { class: 'fx-accept' }, acc, ' ' + T('Accepting responses')), n ? view : null));
      if (!n) { main.appendChild(h('div', { class: 'fm-card fx-card fx-empty' }, T('No responses yet. Open the Answer tab to fill in the form.'))); return; }
      if ((win._rv || 'summary') === 'individual') return individual();
      if (form.quiz) {
        const scores = form.responses.map((r) => grade(r.a)); const max = scores[0] ? scores[0].max : 0;
        const avg = scores.reduce((s, x) => s + x.got, 0) / n;
        main.appendChild(h('div', { class: 'fm-card fx-card fx-stats' }, ...[[T('Average'), (+avg.toFixed(1)) + ' / ' + max], [T('Highest'), Math.max(...scores.map((s) => s.got)) + ' / ' + max], [T('Lowest'), Math.min(...scores.map((s) => s.got)) + ' / ' + max]].map(([l, v]) => h('div', {}, h('small', {}, l), h('b', {}, v)))));
      }
      form.questions.forEach((qq) => {
        if (qq.type === 'section') return;
        const vals = form.responses.map((r) => r.a[qq.id]).filter((v) => v != null && v !== '');
        const card = h('div', { class: 'fm-card fx-card' }, h('b', { class: 'fm-qt' }, qq.text || T('Untitled question')), h('small', { class: 'fx-qdesc' }, vals.length + ' ' + T(vals.length === 1 ? 'response' : 'responses')));
        if (HAS_OPTS.includes(qq.type) || qq.type === 'scale' || qq.type === 'rating') {
          const labels = qq.type === 'scale' ? Array.from({ length: (qq.max ?? 5) - (qq.min ?? 1) + 1 }, (_, i) => String((qq.min ?? 1) + i)) : qq.type === 'rating' ? Array.from({ length: qq.max || 5 }, (_, i) => '★'.repeat(i + 1)) : qq.options.slice();
          const counts = labels.map((_, i) => vals.filter((v) => (qq.type === 'check' ? (v || []).includes(i) : qq.type === 'scale' ? v === (qq.min ?? 1) + i : qq.type === 'rating' ? v === i + 1 : v === i)).length);
          if (qq.other) { labels.push(T('Other')); counts.push(vals.filter((v) => [].concat(v).some((x) => typeof x === 'string' && x.startsWith('other:'))).length); }
          const total = Math.max(1, qq.type === 'check' ? vals.length : counts.reduce((a, b) => a + b, 0)), max = Math.max(1, ...counts);
          labels.forEach((o, i) => card.appendChild(h('div', { class: 'fm-bar fx-bar' + (form.quiz && (qq.type === 'check' ? (qq.answer || []).includes(i) : qq.answer === i) ? ' right' : '') }, h('span', { class: 'fm-bl' }, o), h('div', { class: 'fm-bt' }, h('i', { style: { width: (counts[i] / max * 100) + '%' } })), h('span', { class: 'fm-bn' }, counts[i] + ' · ' + Math.round(counts[i] / total * 100) + '%'))));
          if (qq.type === 'scale' || qq.type === 'rating') { const nv = vals.filter((v) => typeof v === 'number'); if (nv.length) card.appendChild(h('small', { class: 'fx-avg' }, T('Average') + ': ' + (nv.reduce((a, b) => a + b, 0) / nv.length).toFixed(2))); }
        } else if (qq.type === 'number') { const nv = vals.map(Number); card.appendChild(h('div', { class: 'fx-stats sm' }, ...[[T('Average'), (nv.reduce((a, b) => a + b, 0) / nv.length).toFixed(2)], [T('Min'), Math.min(...nv)], [T('Max'), Math.max(...nv)]].map(([l, v]) => h('div', {}, h('small', {}, l), h('b', {}, String(v)))))); }
        else vals.slice(-30).reverse().forEach((v) => card.appendChild(h('div', { class: 'fm-ans' }, String(v))));
        main.appendChild(card);
      });
    }
    function individual() {
      respIdx = Math.max(0, Math.min(form.responses.length - 1, respIdx));
      const r = form.responses[respIdx];
      main.appendChild(h('div', { class: 'fm-card fx-card fx-inav' }, h('button', { class: 'btn', disabled: respIdx === 0, onclick: () => { respIdx--; render(); } }, '‹'), h('span', {}, (respIdx + 1) + ' / ' + form.responses.length + ' · ' + new Date(r.t).toLocaleString(PatOS.locale)), h('button', { class: 'btn', disabled: respIdx >= form.responses.length - 1, onclick: () => { respIdx++; render(); } }, '›'), h('button', { class: 'tbtn', title: T('Delete this response'), html: OF.icon('trash', 17), onclick: () => { form.responses.splice(respIdx, 1); save(); render(); } }), form.quiz ? h('b', { class: 'fx-iscore' }, grade(r.a).got + ' / ' + grade(r.a).max) : null));
      form.questions.forEach((qq) => { if (qq.type === 'section') return; const v = r.a[qq.id]; const txt = v == null || v === '' ? '—' : HAS_OPTS.includes(qq.type) ? [].concat(v).map((x) => (typeof x === 'string' && x.startsWith('other:') ? x.slice(6) : qq.options[x])).join(', ') : qq.type === 'rating' ? '★'.repeat(v) : String(v); const c = form.quiz ? correct(qq, v) : null; main.appendChild(h('div', { class: 'fm-card fx-card fx-rev ' + (c === true ? 'ok' : c === false ? 'no' : '') }, h('b', { class: 'fm-qt' }, qq.text || T('Untitled question')), h('div', {}, txt))); });
    }
    function csv() {
      const qs = form.questions.filter((x) => x.type !== 'section');
      const esc = (s) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
      const rows = [[T('Time'), ...qs.map((x) => x.text || T('Untitled question')), ...(form.quiz ? [T('Score')] : [])].map(esc).join(',')];
      form.responses.forEach((r) => rows.push([new Date(r.t).toLocaleString(PatOS.locale), ...qs.map((x) => { const v = r.a[x.id]; return v == null ? '' : HAS_OPTS.includes(x.type) ? [].concat(v).map((y) => (typeof y === 'string' && y.startsWith('other:') ? y.slice(6) : x.options[y])).join('; ') : String(v); }), ...(form.quiz ? [grade(r.a).got + '/' + grade(r.a).max] : [])].map((s) => esc(String(s))).join(',')));
      return rows.join('\n');
    }
    function exportCSV() { PatOS.downloadFile(baseName() + ' - ' + T('responses') + '.csv', csv()); }
    function openSettings(e, b) {
      const thanks = h('input', { class: 'field', value: form.settings.thanks || '', placeholder: T('Your response has been recorded.') }); thanks.oninput = () => { form.settings.thanks = thanks.value; save(); };
      const sp = h('button', { class: 'switch' + (form.settings.showPoints !== false ? ' on' : '') }); sp.onclick = () => { form.settings.showPoints = form.settings.showPoints === false; sp.classList.toggle('on'); save(); };
      OF.pop(b, h('div', { class: 'fx-settings' }, h('b', {}, T('Settings')), h('label', {}, T('Message after submitting')), thanks, form.quiz ? h('label', { class: 'fx-row' }, T('Show points on each question'), sp) : null), { alignRight: true });
    }
    function render() {
      [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === tab));
      const top = main.scrollTop;
      main.innerHTML = ''; main.classList.toggle('fx-answer', tab === 'fill');
      ({ edit, fill, results })[tab]();
      if (tab === 'edit') main.scrollTop = top;
    }
    render();
  }
})();
