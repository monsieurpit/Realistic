/* Contacts — your address book, saved on this device.
   Several phone numbers and emails per person (home, work…), company, birthday, address, notes, a photo,
   favorites, search that ignores accents, tap-to-call and tap-to-email, Undo after deleting, merging
   duplicates, and real vCard (.vcf) import and export that understands photos, folded lines and groups of
   people in one file. `phone` and `email` stay as a copy of the first entry (Spotlight uses them). */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const LOC = () => (PatOS.lang === 'fr' ? 'fr-CA' : undefined);
  const PHONE_LABELS = ['mobile', 'home', 'work', 'other'], EMAIL_LABELS = ['home', 'work', 'school', 'other'];
  const LABEL_TXT = { mobile: 'Mobile', home: 'Home', work: 'Work', school: 'School', other: 'Other' };
  const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const digits = (s) => String(s || '').replace(/\D/g, '');

  /* contacts saved by older versions had one `phone` and one `email`: turn them into lists */
  function migrate(list) {
    list.forEach((c) => {
      if (!c.phones) c.phones = c.phone ? [{ l: 'mobile', v: c.phone }] : [];
      if (!c.emails) c.emails = c.email ? [{ l: 'home', v: c.email }] : [];
      mirror(c);
    });
    return list;
  }
  function mirror(c) { c.phone = (c.phones.find((p) => p.v) || {}).v || ''; c.email = (c.emails.find((p) => p.v) || {}).v || ''; }
  const fullName = (c) => [c.first, c.last].filter(Boolean).join(' ') || c.company || '';
  const isEmpty = (c) => !fullName(c) && !c.nickname && !c.phones.some((p) => p.v) && !c.emails.some((p) => p.v) && !c.birthday && !c.address && !c.notes && !c.photo;
  // a birthday whose year is unknown is stored as 1900
  const knownYear = (b) => b && +b.slice(0, 4) > 1904;
  function nextBirthday(b, from) {
    const now = from || new Date(); const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let d = new Date(now.getFullYear(), +b.slice(5, 7) - 1, +b.slice(8, 10));
    if (d < t) d = new Date(now.getFullYear() + 1, +b.slice(5, 7) - 1, +b.slice(8, 10));
    return { date: d, days: Math.round((d - t) / 86400000), turns: knownYear(b) ? d.getFullYear() - +b.slice(0, 4) : null };
  }

  /* ---------- vCard ---------- */
  const vEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const vUn = (s) => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;:\\])/g, '$1');
  const fold = (l) => { let out = ''; while (l.length > 74) { out += l.slice(0, 74) + '\r\n '; l = l.slice(74); } return out + l; };
  function toVCard(list) {
    return list.map((c) => {
      const L = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + vEsc(c.last) + ';' + vEsc(c.first) + ';;;', 'FN:' + vEsc(fullName(c) || '—')];
      if (c.nickname) L.push('NICKNAME:' + vEsc(c.nickname));
      if (c.company) L.push('ORG:' + vEsc(c.company));
      c.phones.filter((p) => p.v).forEach((p) => L.push('TEL;TYPE=' + (p.l === 'mobile' ? 'CELL' : p.l.toUpperCase()) + ':' + vEsc(p.v)));
      c.emails.filter((p) => p.v).forEach((p) => L.push('EMAIL;TYPE=' + p.l.toUpperCase() + ':' + vEsc(p.v)));
      if (c.birthday) L.push('BDAY:' + (knownYear(c.birthday) ? c.birthday : '--' + c.birthday.slice(5).replace('-', '')));
      if (c.address) L.push('ADR;TYPE=HOME:;;' + vEsc(c.address) + ';;;;');
      if (c.notes) L.push('NOTE:' + vEsc(c.notes));
      const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(c.photo || ''); if (m) L.push('PHOTO;ENCODING=b;TYPE=' + m[1].toUpperCase() + ':' + m[2]);
      L.push('END:VCARD'); return L.map(fold).join('\r\n');
    }).join('\r\n') + '\r\n';
  }
  function fromVCard(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const out = []; let c = null;
    for (const line of lines) {
      if (/^BEGIN:VCARD/i.test(line)) { c = { id: PatOS.uid(), first: '', last: '', phones: [], emails: [] }; continue; }
      if (/^END:VCARD/i.test(line)) { if (c) { if (!c.first && !c.last && c.fn) { const p = c.fn.split(' '); c.first = p.shift() || ''; c.last = p.join(' '); } delete c.fn; mirror(c); if (!isEmpty(c)) out.push(c); } c = null; continue; }
      if (!c) continue;
      const i = line.indexOf(':'); if (i < 0) continue;
      const head = line.slice(0, i), val = line.slice(i + 1); const parts = head.split(';'); const name = parts[0].replace(/^.*\./, '').toUpperCase(); const params = parts.slice(1).join(';').toUpperCase();
      const type = /WORK/.test(params) ? 'work' : /CELL|MOBILE/.test(params) ? 'mobile' : /HOME/.test(params) ? 'home' : 'other';
      if (name === 'N') { const p = val.split(';'); c.last = vUn(p[0]); c.first = vUn(p[1]); }
      else if (name === 'FN') c.fn = vUn(val);
      else if (name === 'NICKNAME') c.nickname = vUn(val);
      else if (name === 'ORG') c.company = vUn(val.split(';')[0]);
      else if (name === 'TEL') c.phones.push({ l: type, v: vUn(val).replace(/^tel:/i, '') });
      else if (name === 'EMAIL') c.emails.push({ l: type === 'mobile' ? 'home' : type, v: vUn(val) });
      else if (name === 'BDAY') { const m = /^(\d{4}|--)-?(\d{2})-?(\d{2})/.exec(val); if (m) c.birthday = (m[1] === '--' ? '1900' : m[1]) + '-' + m[2] + '-' + m[3]; }
      else if (name === 'ADR') c.address = val.split(';').slice(2, 6).map(vUn).filter(Boolean).join(', ');
      else if (name === 'NOTE') c.notes = vUn(val);
      else if (name === 'PHOTO' && /ENCODING=B|BASE64/.test(params) && val.length > 40) c.photo = 'data:image/' + (/PNG/.test(params) ? 'png' : 'jpeg') + ';base64,' + val.replace(/\s/g, '');
    }
    return out;
  }
  PatOS.vcard = { toVCard, fromVCard };

  /* is `b` the same person as `a`? same name, or a phone number or email in common */
  function same(a, b) {
    const na = plain(fullName(a)).trim(), nb = plain(fullName(b)).trim();
    if (na && na === nb) return true;
    const pa = a.phones.map((p) => digits(p.v)).filter((d) => d.length >= 7), pb = b.phones.map((p) => digits(p.v)).filter((d) => d.length >= 7);
    if (pa.some((d) => pb.some((e) => d.slice(-9) === e.slice(-9)))) return true;
    const ea = a.emails.map((p) => plain(p.v)).filter(Boolean), eb = b.emails.map((p) => plain(p.v)).filter(Boolean);
    return ea.some((e) => eb.includes(e));
  }
  function mergeInto(a, b) {
    ['first', 'last', 'nickname', 'company', 'birthday', 'address', 'photo'].forEach((k) => { if (!a[k] && b[k]) a[k] = b[k]; });
    b.phones.forEach((p) => { if (p.v && !a.phones.some((x) => digits(x.v) === digits(p.v))) a.phones.push(p); });
    b.emails.forEach((p) => { if (p.v && !a.emails.some((x) => plain(x.v) === plain(p.v))) a.emails.push(p); });
    if (b.notes && !(a.notes || '').includes(b.notes)) a.notes = [a.notes, b.notes].filter(Boolean).join('\n');
    a.fav = a.fav || b.fav; mirror(a); return a;
  }

  PatOS.registerApp({
    id: 'contacts', name: 'Contacts', icon: 'contacts', width: 820, height: 580, keywords: 'people address book phone email friends birthday vcard contacts carnet',
    about: 'Phone numbers, emails and birthdays. Import and export vCard files.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'ct-win');
      win.body.style.position = 'relative';
      let list = migrate(PatOS.store.get('contacts', []) || []);
      let cur = args && args.id && list.some((c) => c.id === args.id) ? args.id : list[0] ? list[0].id : null, editing = false;
      const save = () => PatOS.store.set('contacts', list);
      const q = h('input', { class: 'field', placeholder: T('Search'), style: { width: '100%' }, 'aria-label': T('Search contacts') });
      const listEl = h('div', { class: 'ct-list' });
      const card = h('div', { class: 'ct-card' });
      const bAdd = h('button', { class: 'tbtn', title: T('New contact'), 'aria-label': T('New contact') }, '＋');
      const bMore = h('button', { class: 'tbtn', title: T('Import or export'), 'aria-label': T('Import or export') }, '⋯');
      win.toolbar.append(h('div', { style: { flex: 1 } }), bAdd, bMore);
      const ctSide = h('div', { class: 'ct-side' }, h('div', { class: 'ct-search' }, q), listEl);
      win.body.appendChild(h('div', { class: 'ct-wrap' }, ctSide, card));
      if (PatOS.mobile && PatOS.mobile.stack) { PatOS.mobile.stack(win, T('Contacts')); ctSide.classList.add('m-list'); card.classList.add('m-detail'); win.on('m-back', () => { leaveEdit(); render(); }); }
      const nameOf = (c) => fullName(c) || T('New Contact');
      const hue = (c) => { const s = fullName(c) || '?'; let x = 0; for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) % 360; return x; };
      const initials = (c) => (((c.first || c.company || '?')[0] || '?') + ((c.first || c.last) ? (c.last || '')[0] || '' : '')).toUpperCase();
      function avatar(c, big) { return h('div', { class: 'ct-av' + (big ? ' big' : ''), style: c.photo ? { backgroundImage: `url(${c.photo})` } : { background: `hsl(${hue(c)},55%,52%)` } }, c.photo ? '' : initials(c)); }
      const undoBar = (text, undo) => {
        const old = win.body.querySelector('.rm-undo'); if (old) old.remove();
        const bar = h('div', { class: 'rm-undo' }, h('span', {}, text), h('button', { onclick: () => { bar.remove(); undo(); } }, T('Undo')));
        win.body.appendChild(bar); setTimeout(() => bar.remove(), 6000);
      };
      /* an empty "New Contact" that was never filled in is not kept */
      function leaveEdit() { editing = false; const c = list.find((x) => x.id === cur); if (c && isEmpty(c)) { list = list.filter((x) => x !== c); cur = list[0] ? list[0].id : null; save(); } }
      const match = (c, ql) => !ql || plain([fullName(c), c.nickname, c.company, c.address, c.notes, c.phones.map((p) => p.v).join(' '), digits(c.phone), c.emails.map((p) => p.v).join(' ')].join(' ')).includes(ql);

      function renderList() {
        listEl.innerHTML = '';
        const ql = plain(q.value.trim());
        const items = list.filter((c) => match(c, ql)).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || nameOf(a).localeCompare(nameOf(b), LOC()));
        let letter = '';
        items.forEach((c) => {
          const L = c.fav ? '★' : (plain(nameOf(c))[0] || '#').toUpperCase().replace(/[^A-Z]/, '#');
          if (L !== letter) { letter = L; listEl.appendChild(h('div', { class: 'ct-letter' }, L === '★' ? T('Favorites') : L)); }
          const row = h('div', { class: 'ct-row' + (c.id === cur ? ' on' : ''), tabindex: '0', role: 'button' }, avatar(c), h('span', {}, nameOf(c)), c.company && (c.first || c.last) ? h('small', {}, c.company) : null);
          const open = () => { if (editing) leaveEdit(); cur = c.id; editing = false; render(); PatOS.mobile && PatOS.mobile.detail && PatOS.mobile.detail(win, true, nameOf(c)); };
          row.onclick = open; row.onkeydown = (e) => { if (e.key === 'Enter') open(); };
          listEl.appendChild(row);
        });
        if (!list.length) listEl.appendChild(h('div', { class: 'ct-empty' }, T('No contacts yet. Press + to add one, or import a .vcf file.')));
        else if (!items.length) listEl.appendChild(h('div', { class: 'ct-empty' }, T('No results')));
        else listEl.appendChild(h('div', { class: 'ct-count' }, list.length + ' ' + T(list.length === 1 ? 'contact' : 'contacts')));
      }

      /* a list of labelled values: phone numbers or emails */
      function multi(c, key, labels, ph, type) {
        const box = h('div', { class: 'ct-multi' });
        const draw = () => {
          box.innerHTML = '';
          c[key].forEach((it, i) => {
            const sel = h('select', { class: 'field ct-lab', 'aria-label': T('Label') }, ...labels.map((l) => h('option', { value: l, selected: it.l === l }, T(LABEL_TXT[l]))));
            sel.onchange = () => { it.l = sel.value; save(); };
            const inp = h('input', { class: 'field', value: it.v, placeholder: ph, type, 'aria-label': T(key === 'phones' ? 'Phone' : 'Email') });
            inp.oninput = () => { it.v = inp.value; mirror(c); save(); renderList(); };
            const del = h('button', { class: 'tbtn', title: T('Remove'), 'aria-label': T('Remove'), onclick: () => { c[key].splice(i, 1); mirror(c); save(); draw(); renderList(); } }, '−');
            box.appendChild(h('div', { class: 'ct-mrow' }, sel, inp, del));
          });
          box.appendChild(h('button', { class: 'ct-addrow', onclick: () => { c[key].push({ l: labels[0], v: '' }); draw(); const ins = box.querySelectorAll('input'); ins[ins.length - 1].focus(); } }, '+ ' + T(key === 'phones' ? 'add phone' : 'add email')));
        };
        draw(); return box;
      }

      function renderCard() {
        card.innerHTML = '';
        const c = list.find((x) => x.id === cur);
        if (!c) { card.appendChild(h('div', { class: 'ct-none' }, h('div', { class: 'ct-big', html: PatOS.iconHTML('contacts') }), h('p', {}, T('Select a contact or add a new one.')))); return; }
        if (editing) {
          const inp = (k, ph, type) => { const i = h('input', { class: 'field', value: c[k] || '', placeholder: ph, type: type || 'text', 'aria-label': ph }); i.oninput = () => { c[k] = i.value; save(); renderList(); }; return i; };
          const photo = avatar(c, true); photo.classList.add('ct-edit-photo'); photo.title = T('Change photo');
          photo.onclick = () => {
            const i = h('input', { type: 'file', accept: 'image/*' });
            i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); cv.width = cv.height = 200; const s = Math.max(200 / img.width, 200 / img.height); cv.getContext('2d').drawImage(img, (200 - img.width * s) / 2, (200 - img.height * s) / 2, img.width * s, img.height * s); c.photo = cv.toDataURL('image/jpeg', 0.85); save(); render(); }; img.src = r.result; }; r.readAsDataURL(f); };
            i.click();
          };
          const rmPhoto = c.photo ? h('button', { class: 'ct-addrow', onclick: () => { delete c.photo; save(); render(); } }, T('Remove photo')) : null;
          const bday = h('input', { class: 'field', type: 'date', value: knownYear(c.birthday) ? c.birthday : c.birthday ? '' : '', 'aria-label': T('Birthday') });
          bday.oninput = () => { c.birthday = bday.value; save(); };
          card.append(h('div', { class: 'ct-head' }, h('div', { class: 'ct-photo-col' }, photo, rmPhoto), h('div', { class: 'ct-names' }, inp('first', T('First name')), inp('last', T('Last name')), inp('company', T('Company')))),
            h('div', { class: 'ct-form' }, h('div', { class: 'ct-flabel' }, T('Phone')), multi(c, 'phones', PHONE_LABELS, '514-555-0123', 'tel'), h('div', { class: 'ct-flabel' }, T('Email')), multi(c, 'emails', EMAIL_LABELS, 'name@example.com', 'email'),
              h('label', {}, T('Birthday'), bday), h('label', {}, T('Address'), inp('address', '')), h('label', {}, T('Notes'), (() => { const t = h('textarea', { class: 'field ce-notes' }); t.value = c.notes || ''; t.oninput = () => { c.notes = t.value; save(); }; return t; })())),
            h('div', { class: 'ct-btns' },
              h('button', { class: 'btn danger', onclick: () => removeContact(c) }, T('Delete')), h('div', { style: { flex: 1 } }),
              h('button', { class: 'btn primary', onclick: () => { leaveEdit(); render(); } }, T('Done'))));
          return;
        }
        const copy = (v) => navigator.clipboard && navigator.clipboard.writeText(v).then(() => PatOS.notify({ title: T('Copied'), body: v, icon: 'contacts' })).catch(() => {});
        const bd = c.birthday ? nextBirthday(c.birthday) : null;
        card.append(h('div', { class: 'ct-head center' }, avatar(c, true), h('h1', {}, nameOf(c)), c.nickname ? h('div', { class: 'ct-sub' }, '“' + c.nickname + '”') : null, c.company && (c.first || c.last) ? h('div', { class: 'ct-sub' }, c.company) : null,
          h('div', { class: 'ct-actions' },
            h('button', { class: 'btn', onclick: () => { c.fav = !c.fav; save(); render(); } }, T(c.fav ? 'Favorite' : 'Add to Favorites')),
            h('button', { class: 'btn', onclick: () => { editing = true; render(); } }, T('Edit')),
            h('button', { class: 'btn', onclick: () => PatOS.downloadFile(nameOf(c) + '.vcf', 'data:text/vcard;charset=utf-8,' + encodeURIComponent(toVCard([c]))) }, T('Share')))));
        const rows = h('div', { class: 'ct-info' });
        const field = (label, value, extras) => rows.appendChild(h('div', { class: 'ct-field' }, h('small', {}, label), h('div', { class: 'ct-val' }, value), extras || null));
        const copyBtn = (v) => h('button', { class: 'tbtn', title: T('Copy'), 'aria-label': T('Copy'), onclick: () => copy(v) }, '⧉');
        c.phones.filter((p) => p.v).forEach((p) => field(T(LABEL_TXT[p.l] || 'Phone'), h('a', { class: 'ct-link', href: 'tel:' + p.v.replace(/[^\d+]/g, '') }, p.v), copyBtn(p.v)));
        c.emails.filter((p) => p.v).forEach((p) => field(T(LABEL_TXT[p.l] || 'Email'), h('a', { class: 'ct-link', href: 'mailto:' + p.v, target: '_blank', rel: 'noopener' }, p.v), copyBtn(p.v)));
        if (bd) field(T('Birthday'), new Date(c.birthday + 'T12:00').toLocaleDateString(LOC(), { month: 'long', day: 'numeric', year: knownYear(c.birthday) ? 'numeric' : undefined }) + (bd.days === 0 ? ' · ' + T('today') + (bd.turns ? ' (' + bd.turns + ')' : '') : bd.days <= 30 ? ' · ' + T('in') + ' ' + bd.days + ' ' + T(bd.days === 1 ? 'day' : 'days') + (bd.turns ? ' (' + bd.turns + ')' : '') : ''));
        if (c.address) field(T('Address'), c.address, copyBtn(c.address));
        if (c.notes) field(T('Notes'), h('span', { style: { whiteSpace: 'pre-wrap' } }, c.notes));
        if (!rows.children.length) rows.appendChild(h('div', { class: 'ct-empty' }, T('Press Edit to add a phone number, email or birthday.')));
        card.appendChild(rows);
      }
      function removeContact(c) {
        const i = list.indexOf(c); list = list.filter((x) => x !== c); editing = false; cur = list[Math.min(i, list.length - 1)] ? list[Math.min(i, list.length - 1)].id : null; save(); render();
        PatOS.mobile && PatOS.mobile.detail && PatOS.mobile.detail(win, false);
        if (!isEmpty(c)) undoBar(T('Deleted') + ' ' + nameOf(c), () => { list.splice(Math.min(i, list.length), 0, c); cur = c.id; save(); render(); });
      }
      function render() { renderList(); renderCard(); }
      bAdd.onclick = () => { if (editing) leaveEdit(); const c = { id: PatOS.uid(), first: '', last: '', phones: [], emails: [] }; list.push(c); cur = c.id; editing = true; save(); q.value = ''; render(); PatOS.mobile && PatOS.mobile.detail && PatOS.mobile.detail(win, true, T('New Contact')); const f = card.querySelector('input.field'); if (f) f.focus(); };

      /* ---------- import, export, merge ---------- */
      function importText(text) {
        const found = fromVCard(text); let added = 0, merged = 0;
        found.forEach((n) => { const old = list.find((c) => same(c, n)); if (old) { mergeInto(old, n); merged++; } else { list.push(n); added++; } });
        save(); render();
        PatOS.notify({ title: T('Contacts imported'), body: added + ' ' + T(added === 1 ? 'contact added' : 'contacts added') + (merged ? ' · ' + merged + ' ' + T('updated') : ''), icon: 'contacts' });
      }
      function importFile() {
        const i = h('input', { type: 'file', accept: '.vcf,text/vcard,text/x-vcard', multiple: true }); i.style.display = 'none'; document.body.appendChild(i);
        i.onchange = async () => { const files = [...i.files]; i.remove(); for (const f of files) importText(await f.text()); };
        i.click();
      }
      function mergeDuplicates() {
        let n = 0;
        for (let a = 0; a < list.length; a++) for (let b = list.length - 1; b > a; b--) if (same(list[a], list[b])) { mergeInto(list[a], list[b]); if (cur === list[b].id) cur = list[a].id; list.splice(b, 1); n++; }
        save(); render();
        PatOS.notify({ title: n ? T('Duplicates merged') : T('No duplicates found'), body: n ? n + ' ' + T(n === 1 ? 'contact merged' : 'contacts merged') : T('Every contact is different.'), icon: 'contacts' });
      }
      bMore.onclick = () => { const r = bMore.getBoundingClientRect(); PatOS.menu([
        { label: T('Import a vCard (.vcf)…'), action: importFile },
        { label: T('Export all as vCard'), disabled: !list.length, action: () => PatOS.downloadFile('contacts.vcf', 'data:text/vcard;charset=utf-8,' + encodeURIComponent(toVCard(list))) },
        { divider: true },
        { label: T('Merge Duplicates'), disabled: list.length < 2, action: mergeDuplicates }
      ], r.left - 150, r.bottom + 4); };
      q.addEventListener('input', renderList);
      // drop a .vcf file on the window
      win.body.addEventListener('dragover', (e) => { if ([...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
      win.body.addEventListener('drop', async (e) => { const fs = [...(e.dataTransfer.files || [])].filter((f) => /\.vcf$/i.test(f.name) || /vcard/.test(f.type)); if (!fs.length) return; e.preventDefault(); for (const f of fs) importText(await f.text()); });
      win.on('closed', () => { if (editing) leaveEdit(); });
      win._show = (id) => { const c = list.find((x) => x.id === id); if (c) { cur = id; editing = false; render(); PatOS.mobile && PatOS.mobile.detail && PatOS.mobile.detail(win, true, nameOf(c)); } };
      win._ct = { importFile, mergeDuplicates, add: () => bAdd.click() };
      win.body.addEventListener('keydown', (e) => { if ((e.key === 'n' || e.key === 'N') && (e.altKey) ) { e.preventDefault(); bAdd.click(); } });
      render();
    },
    onArgs(win, a) { if (a && a.id && win._show) win._show(a.id); },
    menus(win) {
      const C = win._ct || {};
      return { file: [
        { label: T('New contact'), shortcut: 'Alt+N', action: () => C.add && C.add() },
        { divider: true },
        { label: T('Import a vCard (.vcf)…'), action: () => C.importFile && C.importFile() },
        { label: T('Merge Duplicates'), action: () => C.mergeDuplicates && C.mergeDuplicates() },
        { divider: true },
        { label: T('Close Window'), shortcut: 'Alt+W', action: () => win.close() }
      ] };
    }
  });

  /* birthday notifications: today, and a heads-up the day before */
  setTimeout(() => {
    const d = new Date(); const key = d.toDateString();
    if (PatOS.store.get('bdayChecked') === key) return;
    const list = migrate(PatOS.store.get('contacts', []) || []);
    list.forEach((c) => {
      if (!c.birthday) return; const n = nextBirthday(c.birthday, d);
      if (n.days === 0) PatOS.notify({ title: T('Birthday today'), body: fullName(c) + (n.turns ? ' · ' + n.turns : ''), icon: 'contacts', onClick: () => PatOS.launch('contacts', { id: c.id }) });
      else if (n.days === 1) PatOS.notify({ title: T('Birthday tomorrow'), body: fullName(c) + (n.turns ? ' · ' + n.turns : ''), icon: 'contacts', onClick: () => PatOS.launch('contacts', { id: c.id }) });
    });
    PatOS.store.set('bdayChecked', key);
  }, 15000);
})();
