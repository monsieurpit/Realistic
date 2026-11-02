/* Reminders — to-do lists */
(function () {
  'use strict';
  const { h } = PatOS;
  PatOS.registerApp({
    id: 'reminders', name: 'Reminders', icon: 'reminders', width: 560, height: 520, keywords: 'todo tasks list checklist homework',
    launch(win) {
      let items = PatOS.store.get('reminders', [{ id: 1, text: 'Finish math homework', done: false }, { id: 2, text: 'Try the 3D Galaxy app', done: false }, { id: 3, text: 'Customize the dock', done: true }]);
      let filter = 'all';
      const save = () => PatOS.store.set('reminders', items);
      const head = h('div', { class: 'rm-head' });
      const list = h('div', { class: 'rm-list' });
      const add = h('input', { class: 'rm-add', placeholder: '+ New Reminder (press Enter)' });
      const seg = h('div', { class: 'seg' });
      [['all', 'All'], ['todo', 'To Do'], ['done', 'Completed']].forEach(([k, l]) => seg.appendChild(h('button', { class: 'tab', 'data-k': k, onclick: () => { filter = k; render(); } }, l)));
      win.toolbar.appendChild(seg);
      win.body.append(h('div', { class: 'rm' }, head, list, add));
      function render() {
        [...seg.children].forEach((b) => b.classList.toggle('on', b.dataset.k === filter));
        const left = items.filter((i) => !i.done).length;
        head.innerHTML = ''; head.append(h('h1', {}, filter === 'done' ? 'Completed' : 'Reminders'), h('span', {}, left + ' left'));
        list.innerHTML = '';
        items.filter((i) => filter === 'all' || (filter === 'done' ? i.done : !i.done)).forEach((it) => {
          const chk = h('button', { class: 'rm-chk' + (it.done ? ' on' : '') });
          const txt = h('div', { class: 'rm-txt', contenteditable: 'true', spellcheck: 'true' }, it.text);
          const del = h('button', { class: 'rm-del', title: 'Delete' }, '×');
          chk.onclick = () => { it.done = !it.done; if (it.done) PatOS.sound.pop(); save(); render(); };
          txt.onblur = () => { it.text = txt.textContent.trim(); if (!it.text) items = items.filter((x) => x !== it); save(); render(); };
          txt.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); txt.blur(); } };
          del.onclick = () => { items = items.filter((x) => x !== it); save(); render(); };
          list.appendChild(h('div', { class: 'rm-item' + (it.done ? ' done' : '') }, chk, txt, del));
        });
      }
      add.addEventListener('keydown', (e) => { if (e.key === 'Enter' && add.value.trim()) { items.push({ id: Date.now(), text: add.value.trim(), done: false }); add.value = ''; save(); render(); } });
      render();
    }
  });
})();
