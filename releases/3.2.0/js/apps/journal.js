/* Journal — one entry per day, with mood, prompts, streaks and search */
(function () {
  'use strict';
  const { h } = PatOS;
  const MOODS = [['great', 'Great', '#30d158', 'Super'], ['good', 'Good', '#64d2ff', 'Bien'], ['okay', 'Okay', '#ffd60a', 'Correct'], ['meh', 'Meh', '#ff9f0a', 'Bof'], ['bad', 'Rough', '#ff453a', 'Difficile']];
  const moodName = (m) => PatOS.lang === 'fr' ? m[3] : m[1];
  const FACES = { great: 'M8 14c1.2 2 6.8 2 8 0', good: 'M8.5 14.5c1.5 1.2 5.5 1.2 7 0', okay: 'M8.5 15h7', meh: 'M8.5 15.5c1.5-.8 5.5-.8 7 0', bad: 'M8 16c1.2-2 6.8-2 8 0' };
  const face = (m, c) => `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10" fill="${c}" opacity=".9"/><circle cx="9" cy="10" r="1.2" fill="#1c1c1e"/><circle cx="15" cy="10" r="1.2" fill="#1c1c1e"/><path d="${FACES[m]}" stroke="#1c1c1e" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
  const PROMPTS = [
    'What made you smile today?', 'What is one thing you learned today?', 'What are you looking forward to this week?',
    'Who helped you today, and how?', 'What was the hardest part of your day?', 'If today had a title, what would it be?',
    'What is something you want to get better at?', 'Describe a small win from today.', 'What would you tell yourself from a year ago?',
    'What are three things you are thankful for?', 'What is on your mind right now?', 'What did you do today just for fun?',
    'What is a goal for tomorrow?', 'What song matches your mood today, and why?'
  ];
  const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

  PatOS.registerApp({
    id: 'journal', name: 'Journal', icon: 'journal', width: 940, height: 620, category: 'Apps', keywords: 'diary daily writing mood gratitude',
    about: 'A private diary: one page a day, with your mood and a question.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const data = PatOS.store.get('journal', {}); // { 'YYYY-MM-DD': { text, mood, updated } }
      const save = () => PatOS.store.set('journal', data);
      let cur = key(new Date()), query = '';
      const list = h('div', { class: 'jn-list' }), page = h('div', { class: 'jn-page' });
      const search = h('input', { class: 'field', placeholder: 'Search', style: { width: '180px' } });
      const streakEl = h('span', { class: 'jn-streak' });
      const bToday = h('button', { class: 'btn' }, PatOS.t('Today'));
      const bPick = h('input', { class: 'field', type: 'date', title: 'Go to a date', style: { width: '140px' } });
      win.toolbar.append(bToday, bPick, h('div', { style: { flex: 1 } }), streakEl, search);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      win.body.appendChild(h('div', { class: 'jn-wrap' }, list, page));
      const words = (t) => (t.trim().match(/\S+/g) || []).length;

      function streak() {
        let n = 0; const d = new Date();
        if (!(data[key(d)] && data[key(d)].text.trim())) d.setDate(d.getDate() - 1);
        while (data[key(d)] && data[key(d)].text.trim()) { n++; d.setDate(d.getDate() - 1); }
        return n;
      }
      function renderList() {
        list.innerHTML = '';
        const ql = query.toLowerCase();
        const keys = Object.keys(data).filter((k) => data[k].text.trim() && (!ql || data[k].text.toLowerCase().includes(ql))).sort().reverse();
        if (!keys.includes(cur) && !ql) keys.unshift(cur), keys.sort().reverse();
        let month = '';
        keys.forEach((k) => {
          const d = parse(k), m = d.toLocaleDateString(PatOS.locale, { month: 'long', year: 'numeric' });
          if (m !== month) { month = m; list.appendChild(h('div', { class: 'jn-month' }, m)); }
          const e = data[k] || { text: '' }, md = MOODS.find((x) => x[0] === e.mood);
          const row = h('div', { class: 'jn-item' + (k === cur ? ' on' : '') },
            h('div', { class: 'jn-day' }, h('b', {}, String(d.getDate())), h('small', {}, d.toLocaleDateString(PatOS.locale, { weekday: 'short' }))),
            h('div', { class: 'jn-prev' }, h('div', {}, e.text.trim().split('\n')[0].slice(0, 80) || PatOS.t('Nothing written yet')), h('small', {}, words(e.text) + ' ' + PatOS.t('words'))),
            md ? h('span', { class: 'jn-mood-s', html: face(md[0], md[2]) }) : null);
          row.onclick = () => { cur = k; render(); };
          row.oncontextmenu = (ev) => { ev.preventDefault(); PatOS.menu([{ label: PatOS.t('Delete Entry'), action: async () => { if (await PatOS.confirmBox(PatOS.t('Delete this entry?'), PatOS.t('This can’t be undone.'), { danger: true, ok: 'Delete', icon: 'journal' })) { delete data[k]; save(); render(); } } }], ev.clientX, ev.clientY); };
          list.appendChild(row);
        });
        if (!keys.length) list.appendChild(h('div', { class: 'jn-empty' }, PatOS.t('No results')));
        const s = streak();
        streakEl.textContent = s ? s + ' ' + PatOS.t(s === 1 ? 'day in a row' : 'days in a row') : '';
      }
      function renderPage() {
        page.innerHTML = '';
        const d = parse(cur), e = data[cur] || { text: '', mood: null };
        const prompt = PROMPTS[(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % PROMPTS.length];
        const moods = h('div', { class: 'jn-moods' }, h('span', {}, PatOS.t('How was your day?')));
        MOODS.forEach((m) => {
          const [id, , c] = m;
          const b = h('button', { class: 'jn-mood' + (e.mood === id ? ' on' : ''), title: moodName(m), html: face(id, c) + '<small>' + moodName(m) + '</small>' });
          b.onclick = () => { const x = data[cur] || (data[cur] = { text: '' }); x.mood = x.mood === id ? null : id; x.updated = Date.now(); save(); render(); };
          moods.appendChild(b);
        });
        const ta = h('textarea', { class: 'jn-text', placeholder: PatOS.t('Start writing…'), spellcheck: 'true' }); ta.value = e.text;
        const count = h('div', { class: 'jn-count' });
        const upd = () => { count.textContent = words(ta.value) + ' ' + PatOS.t('words') + (e.updated ? ' · ' + PatOS.t('Saved') : ''); };
        let t = null;
        ta.oninput = () => { const x = data[cur] || (data[cur] = { text: '', mood: null }); x.text = ta.value; x.updated = Date.now(); clearTimeout(t); t = setTimeout(() => { save(); renderList(); }, 400); upd(); };
        const today = cur === key(new Date());
        page.append(
          h('div', { class: 'jn-head' },
            h('button', { class: 'tbtn', title: 'Previous day', onclick: () => { const x = parse(cur); x.setDate(x.getDate() - 1); cur = key(x); render(); } }, '‹'),
            h('div', {}, h('h1', {}, d.toLocaleDateString(PatOS.locale, { weekday: 'long', day: 'numeric', month: 'long' })), h('small', {}, today ? PatOS.t('Today') : String(d.getFullYear()))),
            h('button', { class: 'tbtn', title: 'Next day', onclick: () => { const x = parse(cur); x.setDate(x.getDate() + 1); if (x <= new Date()) { cur = key(x); render(); } } }, '›')),
          moods,
          h('div', { class: 'jn-prompt' }, h('small', {}, PatOS.t('Something to write about')), h('div', {}, PatOS.t(prompt)), h('button', { class: 'jn-use', onclick: () => { ta.value = (ta.value ? ta.value + '\n\n' : '') + PatOS.t(prompt) + '\n'; ta.oninput(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, PatOS.t('Use it'))),
          ta, count);
        upd();
        if (today && !e.text) setTimeout(() => ta.focus(), 50);
      }
      function render() { renderList(); renderPage(); bPick.value = cur; }
      search.oninput = () => { query = search.value.trim(); renderList(); };
      bToday.onclick = () => { cur = key(new Date()); render(); };
      bPick.onchange = () => { if (bPick.value && parse(bPick.value) <= new Date()) { cur = bPick.value; render(); } };
      render();
    }
  });
})();
