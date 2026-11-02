/* Contacts — your address book, saved on this device */
(function () {
  'use strict';
  const { h } = PatOS;
  const FIELDS = [['phone', 'Phone'], ['email', 'Email'], ['birthday', 'Birthday'], ['address', 'Address'], ['notes', 'Notes']];
  PatOS.registerApp({
    id: 'contacts', name: 'Contacts', icon: 'contacts', width: 780, height: 540, keywords: 'people address book phone email friends',
    about: 'Keep your friends’ phone numbers, emails and birthdays.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      let list = PatOS.store.get('contacts', []);
      let cur = list[0] ? list[0].id : null, editing = false;
      const save = () => PatOS.store.set('contacts', list);
      const q = h('input', { class: 'field', placeholder: 'Search', style: { width: '100%' } });
      const listEl = h('div', { class: 'ct-list' });
      const card = h('div', { class: 'ct-card' });
      const bAdd = h('button', { class: 'tbtn', title: 'New contact' }, '＋');
      const bMore = h('button', { class: 'tbtn', title: 'Import or export' }, '⋯');
      win.toolbar.append(bAdd, bMore);
      win.body.appendChild(h('div', { class: 'ct-wrap' }, h('div', { class: 'ct-side' }, h('div', { class: 'ct-search' }, q), listEl), card));
      const fullName = (c) => [c.first, c.last].filter(Boolean).join(' ') || PatOS.t('No Name');
      const initials = (c) => ((c.first || '?')[0] + (c.last || '')[0 || 0]).toUpperCase().replace('UNDEFINED', '');
      function avatar(c, big) { return h('div', { class: 'ct-av' + (big ? ' big' : ''), style: c.photo ? { backgroundImage: `url(${c.photo})` } : { background: `hsl(${(fullName(c).charCodeAt(0) * 37) % 360},55%,55%)` } }, c.photo ? '' : ((c.first || '?')[0] + ((c.last || '')[0] || '')).toUpperCase()); }
      function renderList() {
        listEl.innerHTML = '';
        const ql = q.value.toLowerCase();
        const items = list.filter((c) => !ql || JSON.stringify(c).toLowerCase().includes(ql)).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || fullName(a).localeCompare(fullName(b)));
        let letter = '';
        items.forEach((c) => {
          const L = c.fav ? '★' : fullName(c)[0].toUpperCase();
          if (L !== letter) { letter = L; listEl.appendChild(h('div', { class: 'ct-letter' }, L === '★' ? PatOS.t('Favorites') : L)); }
          const row = h('div', { class: 'ct-row' + (c.id === cur ? ' on' : '') }, avatar(c), h('span', {}, fullName(c)));
          row.onclick = () => { cur = c.id; editing = false; render(); };
          listEl.appendChild(row);
        });
        if (!list.length) listEl.appendChild(h('div', { class: 'ct-empty' }, 'No contacts yet. Press + to add one.'));
      }
      function renderCard() {
        card.innerHTML = '';
        const c = list.find((x) => x.id === cur);
        if (!c) { card.appendChild(h('div', { class: 'ct-none' }, h('div', { class: 'ct-big', html: PatOS.iconHTML('contacts') }), h('p', {}, 'Select a contact or add a new one.'))); return; }
        if (editing) {
          const inp = (k, ph, type) => { const i = h('input', { class: 'field', value: c[k] || '', placeholder: ph, type: type || 'text' }); i.oninput = () => { c[k] = i.value; save(); renderList(); }; return i; };
          const photo = avatar(c, true); photo.classList.add('ct-edit-photo'); photo.title = 'Change photo';
          photo.onclick = () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); cv.width = cv.height = 160; const s = Math.max(160 / img.width, 160 / img.height); cv.getContext('2d').drawImage(img, (160 - img.width * s) / 2, (160 - img.height * s) / 2, img.width * s, img.height * s); c.photo = cv.toDataURL('image/jpeg', 0.8); save(); render(); }; img.src = r.result; }; r.readAsDataURL(i.files[0]); }; i.click(); };
          card.append(h('div', { class: 'ct-head' }, photo, h('div', { class: 'ct-names' }, inp('first', 'First name'), inp('last', 'Last name'))),
            h('div', { class: 'ct-form' }, h('label', {}, 'Phone', inp('phone', '514-555-0123', 'tel')), h('label', {}, 'Email', inp('email', 'name@example.com', 'email')), h('label', {}, 'Birthday', inp('birthday', '', 'date')), h('label', {}, 'Address', inp('address', '')), h('label', {}, 'Notes', inp('notes', ''))),
            h('div', { class: 'ct-btns' }, h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox('Delete this contact?', fullName(c), { danger: true, ok: 'Delete', icon: 'contacts' })) { list = list.filter((x) => x !== c); cur = list[0] ? list[0].id : null; editing = false; save(); render(); } } }, 'Delete Contact'), h('div', { style: { flex: 1 } }), h('button', { class: 'btn primary', onclick: () => { editing = false; render(); } }, 'Done')));
          return;
        }
        const copy = (v) => navigator.clipboard && navigator.clipboard.writeText(v).then(() => PatOS.notify({ title: PatOS.t('Copied'), body: v, icon: 'contacts' })).catch(() => {});
        const age = c.birthday ? Math.floor((Date.now() - new Date(c.birthday + 'T12:00')) / 31557600000) : null;
        card.append(h('div', { class: 'ct-head center' }, avatar(c, true), h('h1', {}, fullName(c)),
          h('div', { class: 'ct-actions' }, h('button', { class: 'btn', onclick: () => { c.fav = !c.fav; save(); render(); } }, c.fav ? '★ Favorite' : '☆ Favorite'), h('button', { class: 'btn', onclick: () => { editing = true; render(); } }, 'Edit'), h('button', { class: 'btn', onclick: () => PatOS.launch('messages') }, 'Message'))));
        const rows = h('div', { class: 'ct-info' });
        FIELDS.forEach(([k, label]) => {
          if (!c[k]) return;
          let v = c[k]; if (k === 'birthday') v = new Date(c[k] + 'T12:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) + (age >= 0 && age < 130 ? ' (' + age + ')' : '');
          rows.appendChild(h('div', { class: 'ct-field' }, h('small', {}, PatOS.t(label)), h('div', { class: 'ct-val' }, v), ['phone', 'email', 'address'].includes(k) ? h('button', { class: 'tbtn', title: 'Copy', onclick: () => copy(c[k]) }, '⧉') : null));
        });
        if (!rows.children.length) rows.appendChild(h('div', { class: 'ct-empty' }, 'Press Edit to add a phone number, email or birthday.'));
        card.appendChild(rows);
      }
      function render() { renderList(); renderCard(); }
      bAdd.onclick = () => { const c = { id: PatOS.uid(), first: '', last: '' }; list.push(c); cur = c.id; editing = true; save(); render(); const f = card.querySelector('input'); if (f) f.focus(); };
      bMore.onclick = () => { const r = bMore.getBoundingClientRect(); PatOS.menu([
        { label: 'Import a vCard (.vcf)…', action: () => { const i = h('input', { type: 'file', accept: '.vcf,text/vcard' }); i.onchange = () => { const rd = new FileReader(); rd.onload = () => { let n = 0; rd.result.split(/END:VCARD/i).forEach((blk) => { const get = (k) => { const m = blk.match(new RegExp('^' + k + '[^:]*:(.*)$', 'im')); return m ? m[1].trim() : ''; }; const nm = get('N').split(';'); const fn = get('FN'); if (!fn && !nm[0]) return; list.push({ id: PatOS.uid(), first: nm[1] || fn.split(' ')[0] || '', last: nm[0] || fn.split(' ').slice(1).join(' '), phone: get('TEL'), email: get('EMAIL'), birthday: (get('BDAY').match(/\d{4}-?\d{2}-?\d{2}/) || [''])[0].replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), notes: get('NOTE') }); n++; }); save(); render(); PatOS.notify({ title: PatOS.t('Contacts'), body: n + ' ' + PatOS.t('contacts imported'), icon: 'contacts' }); }; rd.readAsText(i.files[0]); }; i.click(); } },
        { label: 'Export all as vCard', disabled: !list.length, action: () => PatOS.downloadFile('contacts.vcf', list.map((c) => ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + (c.last || '') + ';' + (c.first || ''), 'FN:' + fullName(c), c.phone ? 'TEL:' + c.phone : '', c.email ? 'EMAIL:' + c.email : '', c.birthday ? 'BDAY:' + c.birthday : '', c.notes ? 'NOTE:' + c.notes : '', 'END:VCARD'].filter(Boolean).join('\n')).join('\n')) }
      ], r.left - 150, r.bottom + 4); };
      q.addEventListener('input', renderList);
      render();
    }
  });
  /* birthday notifications */
  setTimeout(() => {
    const d = new Date(), md = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (PatOS.store.get('bdayChecked') === d.toDateString()) return;
    (PatOS.store.get('contacts', []) || []).forEach((c) => { if (c.birthday && c.birthday.slice(5) === md) PatOS.notify({ title: '🎂 ' + PatOS.t('Birthday today'), body: [c.first, c.last].filter(Boolean).join(' '), icon: 'contacts' }); });
    PatOS.store.set('bdayChecked', d.toDateString());
  }, 15000);
})();
