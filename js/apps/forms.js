/* Forms — build surveys and quizzes, fill them in, see the results. Saved as .pform */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'forms', name: 'Forms', icon: 'forms', single: false, width: 820, height: 660, category: 'Office', keywords: 'survey quiz questionnaire poll google forms',
    about: 'Make surveys and quizzes, answer them and see the results.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let path = args.path || null, form;
      if (path) { try { form = JSON.parse(PatOS.fs.read(path)); } catch (e) {} }
      if (!form) form = PatOS.lang === 'fr' ? { title: 'Formulaire sans titre', desc: '', quiz: false, questions: [{ id: PatOS.uid(), type: 'choice', text: 'Quelle est ta matière préférée?', options: ['Maths', 'Sciences', 'Français', 'Arts'], answer: null }], responses: [] } : { title: 'Untitled form', desc: '', quiz: false, questions: [{ id: PatOS.uid(), type: 'choice', text: 'What is your favorite subject?', options: ['Math', 'Science', 'English', 'Art'], answer: null }], responses: [] };
      if (!path) { path = PatOS.newDocPath('/Documents', 'Untitled form', 'pform'); PatOS.fs.write(path, JSON.stringify(form)); }
      let tab = 'edit';
      const seg = h('div', { class: 'seg' });
      [['edit', 'Questions'], ['fill', 'Answer'], ['results', 'Responses']].forEach(([k, l]) => seg.appendChild(h('button', { class: 'tab', 'data-k': k, onclick: () => { tab = k; render(); } }, l)));
      win.toolbar.append(seg); win.toolbar.style.justifyContent = 'center';
      const main = h('div', { class: 'fm-main' }); win.body.appendChild(main);
      const persist = PatOS.debounce(() => PatOS.fs.write(path, JSON.stringify(form)), 400);
      const syncName = PatOS.debounce(() => { const nn = (form.title || 'Untitled form').replace(/[\/]/g, '-').slice(0, 60); if (PatOS.fs.basename(path) !== nn + '.pform') { try { path = PatOS.fs.rename(path, PatOS.fs.uniqueName(PatOS.fs.dirname(path), nn + '.pform')); } catch (e) {} } win.setTitle(form.title); }, 800);
      function edit() {
        const head = h('div', { class: 'fm-card fm-head' });
        const t = h('input', { class: 'fm-title', value: form.title, placeholder: 'Form title' }); t.oninput = () => { form.title = t.value; persist(); syncName(); };
        const d = h('input', { class: 'fm-desc', value: form.desc, placeholder: 'Form description' }); d.oninput = () => { form.desc = d.value; persist(); };
        const quiz = h('button', { class: 'switch' + (form.quiz ? ' on' : '') }); quiz.onclick = () => { form.quiz = !form.quiz; persist(); render(); };
        head.append(t, d, h('label', { class: 'fm-quiz' }, quiz, ' Make this a quiz (mark the right answers to grade it)'));
        main.appendChild(head);
        form.questions.forEach((q, qi) => {
          const card = h('div', { class: 'fm-card' });
          const text = h('input', { class: 'fm-q', value: q.text, placeholder: 'Question' }); text.oninput = () => { q.text = text.value; persist(); };
          const type = h('select', { class: 'field' }, ...[['choice', 'Multiple choice'], ['check', 'Checkboxes'], ['short', 'Short answer'], ['long', 'Paragraph'], ['scale', 'Linear scale 1–5']].map(([v, l]) => h('option', { value: v, selected: q.type === v }, l)));
          type.onchange = () => { q.type = type.value; if (['choice', 'check'].includes(q.type) && !q.options) q.options = ['Option 1']; persist(); render(); };
          card.append(h('div', { class: 'fm-row' }, text, type));
          if (['choice', 'check'].includes(q.type)) {
            (q.options || []).forEach((o, oi) => {
              const oin = h('input', { class: 'fm-opt', value: o }); oin.oninput = () => { q.options[oi] = oin.value; persist(); };
              const mark = form.quiz ? h('button', { class: 'fm-key' + ((q.type === 'check' ? (q.answer || []).includes(oi) : q.answer === oi) ? ' on' : ''), title: 'Correct answer' }, '✓') : null;
              if (mark) mark.onclick = () => { if (q.type === 'check') { q.answer = q.answer || []; const k = q.answer.indexOf(oi); if (k >= 0) q.answer.splice(k, 1); else q.answer.push(oi); } else q.answer = oi; persist(); render(); };
              card.appendChild(h('div', { class: 'fm-orow' }, h('span', { class: q.type === 'check' ? 'fm-box' : 'fm-radio' }), oin, mark, h('button', { class: 'tbtn', onclick: () => { q.options.splice(oi, 1); persist(); render(); } }, '×')));
            });
            card.appendChild(h('button', { class: 'fm-addopt', onclick: () => { q.options.push('Option ' + (q.options.length + 1)); persist(); render(); } }, '+ Add option'));
          } else if (q.type === 'short' && form.quiz) {
            const ans = h('input', { class: 'fm-opt', value: q.answer || '', placeholder: 'Correct answer (optional)' }); ans.oninput = () => { q.answer = ans.value; persist(); }; card.appendChild(ans);
          }
          card.appendChild(h('div', { class: 'fm-tools' }, h('label', {}, h('input', { type: 'checkbox', checked: !!q.req, onchange: (e) => { q.req = e.target.checked; persist(); } }), ' Required'),
            h('button', { class: 'tbtn', title: 'Duplicate', onclick: () => { form.questions.splice(qi + 1, 0, Object.assign(JSON.parse(JSON.stringify(q)), { id: PatOS.uid() })); persist(); render(); } }, '⧉'),
            h('button', { class: 'tbtn', title: 'Delete', onclick: () => { form.questions.splice(qi, 1); persist(); render(); } }, '🗑')));
          main.appendChild(card);
        });
        main.appendChild(h('button', { class: 'btn primary fm-add', onclick: () => { form.questions.push({ id: PatOS.uid(), type: 'choice', text: '', options: ['Option 1', 'Option 2'] }); persist(); render(); main.scrollTop = 1e9; } }, '+ Add question'));
      }
      function fill() {
        const answers = {};
        main.appendChild(h('div', { class: 'fm-card fm-head' }, h('h1', {}, form.title), form.desc ? h('p', {}, form.desc) : null));
        form.questions.forEach((q) => {
          const card = h('div', { class: 'fm-card' }, h('b', { class: 'fm-qt' }, q.text || 'Untitled question', q.req ? h('span', { class: 'fm-req' }, ' *') : null));
          if (q.type === 'choice') q.options.forEach((o, oi) => card.appendChild(h('label', { class: 'fm-pick' }, h('input', { type: 'radio', name: q.id, onchange: () => { answers[q.id] = oi; } }), ' ' + o)));
          if (q.type === 'check') q.options.forEach((o, oi) => card.appendChild(h('label', { class: 'fm-pick' }, h('input', { type: 'checkbox', onchange: (e) => { const a = answers[q.id] = answers[q.id] || []; if (e.target.checked) a.push(oi); else a.splice(a.indexOf(oi), 1); } }), ' ' + o)));
          if (q.type === 'short') { const i = h('input', { class: 'field', style: { width: '100%' } }); i.oninput = () => { answers[q.id] = i.value; }; card.appendChild(i); }
          if (q.type === 'long') { const i = h('textarea', { class: 'field fm-long' }); i.oninput = () => { answers[q.id] = i.value; }; card.appendChild(i); }
          if (q.type === 'scale') { const row = h('div', { class: 'fm-scale' }); [1, 2, 3, 4, 5].forEach((n) => row.appendChild(h('label', {}, h('input', { type: 'radio', name: q.id, onchange: () => { answers[q.id] = n; } }), n))); card.appendChild(row); }
          main.appendChild(card);
        });
        const submit = h('button', { class: 'btn primary fm-add' }, 'Submit');
        submit.onclick = () => {
          const missing = form.questions.find((q) => q.req && (answers[q.id] == null || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !answers[q.id].length)));
          if (missing) return PatOS.alertBox('Please answer every required question', '“' + (missing.text || 'Untitled question') + '” is required.', { icon: 'forms' });
          form.responses.push({ t: Date.now(), a: answers }); persist();
          main.innerHTML = '';
          let score = '';
          if (form.quiz) { const g = grade(answers); score = 'You scored ' + g.right + ' / ' + g.total; }
          main.appendChild(h('div', { class: 'fm-card fm-head fm-thanks' }, h('h1', {}, '✅ Response recorded'), score ? h('p', { class: 'fm-score' }, score) : null, h('button', { class: 'btn', onclick: render }, 'Submit another response')));
        };
        main.appendChild(submit);
      }
      function grade(a) {
        let right = 0, total = 0;
        form.questions.forEach((q) => {
          if (q.answer == null || q.answer === '' || (Array.isArray(q.answer) && !q.answer.length)) return; total++;
          const v = a[q.id];
          if (q.type === 'check') { if (Array.isArray(v) && v.slice().sort().join() === q.answer.slice().sort().join()) right++; }
          else if (q.type === 'short') { if (String(v || '').trim().toLowerCase() === String(q.answer).trim().toLowerCase()) right++; }
          else if (v === q.answer) right++;
        });
        return { right, total };
      }
      function results() {
        const n = form.responses.length;
        main.appendChild(h('div', { class: 'fm-card fm-head' }, h('h1', {}, n + (n === 1 ? ' response' : ' responses')), n ? h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox('Delete all responses?', 'This cannot be undone.', { danger: true, ok: 'Delete', icon: 'forms' })) { form.responses = []; persist(); render(); } } }, 'Delete all responses') : h('p', {}, 'No responses yet. Use the Answer tab to fill in the form.')));
        if (!n) return;
        if (form.quiz) { const scores = form.responses.map((r) => grade(r.a)); const avg = scores.reduce((s, x) => s + (x.total ? x.right / x.total : 0), 0) / n; main.appendChild(h('div', { class: 'fm-card' }, h('b', {}, 'Average score: ' + Math.round(avg * 100) + '%'))); }
        form.questions.forEach((q) => {
          const card = h('div', { class: 'fm-card' }, h('b', { class: 'fm-qt' }, q.text || 'Untitled question'));
          const vals = form.responses.map((r) => r.a[q.id]).filter((v) => v != null && v !== '');
          if (['choice', 'check', 'scale'].includes(q.type)) {
            const opts = q.type === 'scale' ? ['1', '2', '3', '4', '5'] : q.options;
            const counts = opts.map((_, i) => vals.filter((v) => (q.type === 'check' ? (v || []).includes(i) : q.type === 'scale' ? v === i + 1 : v === i)).length);
            const max = Math.max(1, ...counts);
            opts.forEach((o, i) => card.appendChild(h('div', { class: 'fm-bar' }, h('span', { class: 'fm-bl' }, o), h('div', { class: 'fm-bt' }, h('i', { style: { width: (counts[i] / max * 100) + '%' } })), h('span', { class: 'fm-bn' }, counts[i]))));
          } else vals.slice(-20).forEach((v) => card.appendChild(h('div', { class: 'fm-ans' }, String(v))));
          main.appendChild(card);
        });
      }
      function render() { [...seg.children].forEach((b) => b.classList.toggle('on', b.dataset.k === tab)); main.innerHTML = ''; ({ edit, fill, results })[tab](); win.setTitle(form.title); }
      render();
    }
  });
})();
