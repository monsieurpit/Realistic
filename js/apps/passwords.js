/* Passwords — a password manager for PatOS.
   Passwords are never kept as plain text:
   - without a master password they are encrypted (AES-GCM) with a key made for this device, which the
     browser keeps and won't let anyone copy out. Anyone using this browser on this device can still open
     them, so the app recommends a master password.
   - with a master password they are encrypted with a key made from it (PBKDF2, 250,000 rounds) and stay
     locked until it is typed. The vault locks again when PatOS locks or after 15 minutes without use. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const KEY = 'pwVault';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const canCrypt = !!(window.crypto && crypto.subtle);

  let vault = PatOS.store.get(KEY, null) || { v: 2, enc: 'device', items: [] };
  const master = () => vault.enc === true;
  let items = vault.enc && vault.data ? null : (vault.items || []); // decrypted items in memory
  let aesKey = null, unreadable = false;

  /* the device key: made once, kept by the browser in the database, never readable as bytes */
  async function deviceKey() {
    const db = window.__IDB; if (!db || !canCrypt) return null;
    const get = () => new Promise((res) => { try { const r = db.transaction('handles').objectStore('handles').get('pw-device-key'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); } catch (e) { res(null); } });
    let k = await get(); if (k) return k;
    k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await new Promise((res) => { try { const tx = db.transaction('handles', 'readwrite'); tx.objectStore('handles').put(k, 'pw-device-key'); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } });
    return (await get()) || k;
  }
  const ready = (async () => {
    if (vault.enc === 'device' && !vault.data) { items = vault.items || []; } // a new, empty vault
    else if (vault.enc === 'device') {
      try { const k = await deviceKey(); const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, k, unb64(vault.data)); items = JSON.parse(dec.decode(data)); }
      catch (e) { unreadable = true; items = null; } // saved on another device or browser: its key isn't here
    } else if (!vault.enc) { await persist(); } // older plain-text vault: encrypt it now
    PatOS.emit('passwords');
  })();

  async function deriveKey(pw, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function persist() {
    if (!items) return;
    const iv = crypto.getRandomValues && crypto.getRandomValues(new Uint8Array(12));
    if (master()) {
      if (!aesKey) return;
      const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(JSON.stringify(items)));
      vault = { v: 2, enc: true, salt: vault.salt, iv: b64(iv), data: b64(data) };
    } else {
      const k = await deviceKey().catch(() => null);
      if (k) { const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(items))); vault = { v: 2, enc: 'device', iv: b64(iv), data: b64(data) }; }
      else vault = { v: 1, enc: false, items }; // this browser can't encrypt (very old, or no database)
    }
    PatOS.store.set(KEY, vault);
    PatOS.emit('passwords');
  }
  const norm = (host) => String(host || '').toLowerCase().replace(/^(www|m|mobile|accounts?|login|signin|auth)\./, '');
  const hostOf = (url) => { try { const u = new URL(url); return u.protocol.startsWith('http') ? norm(u.hostname) : url; } catch (e) { return norm(url); } };
  const sameSite = (a, b) => { a = norm(a); b = norm(b); return a === b || a.endsWith('.' + b) || b.endsWith('.' + a); };

  const P = PatOS.passwords = {
    hostOf, sameSite, canCrypt,
    get locked() { return !items; },
    get encrypted() { return master(); },
    get deviceOnly() { return vault.enc === 'device'; },
    get plain() { return !vault.enc; },
    get unreadable() { return unreadable; },
    ready,
    async startOver() { items = []; unreadable = false; vault = { v: 2, enc: 'device' }; await persist(); },
    all: () => (items || []).slice(),
    forSite: (site) => (items || []).filter((x) => sameSite(x.site, site)),
    has: (site, username, password) => (items || []).some((x) => sameSite(x.site, site) && x.username === username && (password == null || x.password === password)),
    async save(o) {
      if (!items) throw new Error('locked');
      const site = hostOf(o.url || o.site);
      let it = items.find((x) => sameSite(x.site, site) && x.username === (o.username || ''));
      if (it) Object.assign(it, { password: o.password, updated: Date.now(), note: o.note != null ? o.note : it.note, url: o.url || it.url });
      else { it = { id: PatOS.uid(), site, url: o.url || 'https://' + site, username: o.username || '', password: o.password || '', note: o.note || '', created: Date.now(), updated: Date.now() }; items.push(it); }
      await persist(); return it;
    },
    async update(id, patch) { const it = (items || []).find((x) => x.id === id); if (!it) return; Object.assign(it, patch, { updated: Date.now() }); if (patch.site) it.site = hostOf(patch.site); await persist(); },
    async remove(id) { items = (items || []).filter((x) => x.id !== id); await persist(); },
    async used(id) { const it = (items || []).find((x) => x.id === id); if (it) { it.used = Date.now(); await persist(); } },
    never: () => PatOS.store.get('pwNever', []),
    addNever(site) { const l = P.never(); if (!l.includes(norm(site))) { l.push(norm(site)); PatOS.store.set('pwNever', l); } },
    removeNever(site) { PatOS.store.set('pwNever', P.never().filter((x) => x !== site)); },
    async unlock(pw) {
      if (!master()) return !!items;
      try { const k = await deriveKey(pw, unb64(vault.salt)); const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, k, unb64(vault.data)); items = JSON.parse(dec.decode(data)); aesKey = k; PatOS.emit('passwords'); return true; } catch (e) { return false; }
    },
    lock() { if (master() && items) { items = null; aesKey = null; PatOS.emit('passwords'); } },
    async setMaster(pw) { if (!canCrypt || !items) return false; const salt = crypto.getRandomValues(new Uint8Array(16)); aesKey = await deriveKey(pw, salt); vault = { v: 2, enc: true, salt: b64(salt) }; await persist(); return true; },
    async removeMaster() { if (!items) return false; vault = { v: 2, enc: 'device' }; aesKey = null; await persist(); return true; },
    strength(pw) {
      pw = String(pw || ''); if (!pw) return { score: 0, label: '' };
      let s = 0; const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
      if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (pw.length >= 16) s++; if (kinds >= 3) s++; if (kinds === 4 && pw.length >= 10) s++;
      if (/^(.)\1+$/.test(pw) || /^(password|motdepasse|123456|qwerty|azerty|abc123|letmein|iloveyou)/i.test(pw) || pw.length < 6) s = 0;
      s = Math.min(4, s);
      return { score: s, label: T(['Very weak', 'Weak', 'Okay', 'Strong', 'Very strong'][s]) };
    },
    generate(o) {
      o = Object.assign({ length: 16, upper: true, digits: true, symbols: true, words: false }, o || {});
      const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
      if (o.words) { const W = 'apple river tiger cloud pencil rocket maple ocean silver planet garden violet thunder pixel banana castle forest lemon comet window jungle copper falcon meadow nebula orbit puzzle quartz rainbow saturn walnut zebra'.split(' '); const parts = Array.from({ length: Math.max(3, Math.round(o.length / 5)) }, () => W[rnd(W.length)]); return parts.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join('-') + '-' + rnd(100); }
      let pool = 'abcdefghijkmnpqrstuvwxyz'; const req = [pool];
      if (o.upper) { pool += 'ABCDEFGHJKLMNPQRSTUVWXYZ'; req.push('ABCDEFGHJKLMNPQRSTUVWXYZ'); }
      if (o.digits) { pool += '23456789'; req.push('23456789'); }
      if (o.symbols) { pool += '!@#$%&*?-_=+'; req.push('!@#$%&*?-_=+'); }
      let out; do { out = Array.from({ length: o.length }, () => pool[rnd(pool.length)]).join(''); } while (!req.every((set) => [...out].some((c) => set.includes(c))));
      return out;
    },
    /* Have I Been Pwned: only the first 5 characters of the SHA-1 hash leave the device */
    async pwned(pw) {
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-1', enc.encode(pw)))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const r = await fetch('https://api.pwnedpasswords.com/range/' + hash.slice(0, 5), { headers: { 'Add-Padding': 'true' } });
      const text = await r.text(); const line = text.split('\n').find((l) => l.startsWith(hash.slice(5)));
      return line ? +line.split(':')[1] : 0;
    }
  };

  let lastInput = Date.now();
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { lastInput = Date.now(); }, { capture: true, passive: true }));
  setInterval(() => { if (master() && items && Date.now() - lastInput > 15 * 60000) P.lock(); }, 30000);
  setTimeout(() => { const pw = PatOS.power; if (pw && pw.lock && !pw._pwWrapped) { const orig = pw.lock; pw.lock = function () { P.lock(); return orig.apply(this, arguments); }; pw._pwWrapped = true; } }, 0);
  const isFile = (site) => String(site).startsWith('file:');
  const label = (site) => (isFile(site) ? site.slice(5) : site);
  const fav = (site) => (isFile(site) ? 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#007aff"/><path d="M7 5h7l3 3v11H7z" fill="#fff"/></svg>') : 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(site));

  PatOS.registerApp({
    id: 'passwords', name: 'Passwords', icon: 'passwords', width: 900, height: 600, category: 'Utilities', keywords: 'password manager keychain login vault mots de passe security',
    about: 'Keep your passwords in one place, encrypted. Copy a login when you need it, or fill it into your own HTML pages in Patoogle.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'pw-win');
      const OF = PatOS.office;
      let filter = 'all', q = '', selId = null, leaks = {};
      const search = h('input', { class: 'field', placeholder: T('Search'), style: { width: '200px' } });
      const bAdd = h('button', { class: 'btn primary', html: OF.icon('plus', 15) + ' ' + T('Add') });
      win.toolbar.append(h('div', { style: { flex: 1 } }), search, bAdd);
      const side = h('div', { class: 'pw-side' }), list = h('div', { class: 'pw-list' }), detail = h('div', { class: 'pw-detail' });
      win.body.appendChild(h('div', { class: 'pw-wrap' }, side, list, detail));
      if (PatOS.mobile && PatOS.mobile.stack) { PatOS.mobile.stack(win, T('Passwords')); side.classList.add('m-list'); list.classList.add('m-list'); detail.classList.add('m-detail'); }
      search.oninput = () => { q = search.value.trim().toLowerCase(); renderList(); };
      bAdd.onclick = () => editItem(null);
      const onChange = () => render();
      PatOS.on('passwords', onChange);
      win.on('closed', () => PatOS.off && PatOS.off('passwords', onChange));

      function counts() {
        const all = P.all(); const byPw = {};
        all.forEach((x) => { byPw[x.password] = (byPw[x.password] || 0) + 1; });
        return { all: all.length, weak: all.filter((x) => P.strength(x.password).score < 2).length, reused: all.filter((x) => byPw[x.password] > 1).length, leaked: all.filter((x) => leaks[x.id] > 0).length, byPw };
      }
      function renderSide() {
        side.innerHTML = '';
        const c = counts();
        const item = (k, label, n, ic) => { const b = h('button', { class: 'pw-si' + (filter === k ? ' on' : ''), html: OF.icon(ic, 16) + '<span>' + T(label) + '</span><b>' + (n || '') + '</b>' }); b.onclick = () => { filter = k; renderSide(); renderList(); }; side.appendChild(b); };
        item('all', 'All passwords', c.all, 'lockic'); item('weak', 'Weak', c.weak, 'warn'); item('reused', 'Reused', c.reused, 'copy'); item('leaked', 'Found in leaks', c.leaked, 'eye');
        side.appendChild(h('hr'));
        side.append(
          h('button', { class: 'pw-si', html: OF.icon('settings', 16) + '<span>' + T('Generator') + '</span>', onclick: generator }),
          h('button', { class: 'pw-si', html: OF.icon('search', 16) + '<span>' + T('Check for leaks') + '</span>', onclick: checkLeaks }),
          h('button', { class: 'pw-si', html: OF.icon('settings', 16) + '<span>' + T('Settings') + '</span>', onclick: settings }));
      }
      function filtered() {
        const c = counts();
        return P.all().filter((x) => (filter === 'all' || (filter === 'weak' && P.strength(x.password).score < 2) || (filter === 'reused' && c.byPw[x.password] > 1) || (filter === 'leaked' && leaks[x.id] > 0)) && (!q || (label(x.site) + ' ' + x.username + ' ' + (x.note || '')).toLowerCase().includes(q))).sort((a, b) => a.site.localeCompare(b.site));
      }
      function renderList() {
        list.innerHTML = '';
        // without a master password, say clearly who can see the passwords
        if (!P.encrypted && P.all().length) list.appendChild(h('div', { class: 'pw-warn' }, h('span', {}, P.plain ? T('This browser can’t encrypt passwords. Anyone using it can see them.') : T('Encrypted on this device, but anyone using this browser can open them. Add a master password to lock them.')), canCrypt ? h('button', { class: 'btn', onclick: () => settings() }, T('Add a Master Password')) : null));
        const l = filtered();
        if (!l.length) { list.appendChild(h('div', { class: 'pw-empty' }, h('div', { class: 'pw-bigic', html: PatOS.iconHTML('passwords') }), h('b', {}, T(P.all().length ? 'No results' : 'No passwords yet')), P.all().length ? null : h('p', {}, T('Press + to add a login, or import the list you exported from Chrome, Safari or another password app.')))); return; }
        let letter = '';
        l.forEach((x) => {
          const L = label(x.site)[0] ? label(x.site)[0].toUpperCase() : '#'; if (L !== letter) { letter = L; list.appendChild(h('div', { class: 'pw-letter' }, L)); }
          const st = P.strength(x.password).score;
          const row = h('div', { class: 'pw-row' + (x.id === selId ? ' on' : '') }, h('img', { class: 'pw-fav', src: fav(x.site), alt: '', onerror: (e) => { e.target.replaceWith(h('span', { class: 'pw-fav ph' }, L)); } }), h('div', { class: 'pw-rt' }, h('b', {}, label(x.site)), h('small', {}, x.username || T('(no username)'))), st < 2 || leaks[x.id] ? h('span', { class: 'pw-warn', title: leaks[x.id] ? T('Found in leaks') : T('Weak') }, '!') : null);
          row.onclick = () => { selId = x.id; renderList(); renderDetail(); PatOS.mobile && PatOS.mobile.detail && PatOS.mobile.detail(win, true, x.site); };
          list.appendChild(row);
        });
      }
      function copy(text, what) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => OF.toast(win, what + ' ' + T('copied'))).catch(() => PatOS.alertBox(what, text)); }
      function meter(pw) { const s = P.strength(pw); return h('div', { class: 'pw-meter s' + s.score }, h('i'), h('i'), h('i'), h('i'), h('span', {}, s.label)); }
      function renderDetail() {
        detail.innerHTML = '';
        const x = P.all().find((i) => i.id === selId);
        if (!x) { detail.appendChild(h('div', { class: 'pw-dempty' }, T('Select a password to see it.'))); return; }
        const pwSpan = h('code', { class: 'pw-pw' }, '••••••••••');
        let shown = false;
        const bShow = h('button', { class: 'tbtn', title: T('Show'), html: OF.icon('eye', 17), onclick: () => { shown = !shown; pwSpan.textContent = shown ? x.password : '••••••••••'; bShow.classList.toggle('on', shown); } });
        const reused = counts().byPw[x.password] > 1;
        detail.append(...[
          h('div', { class: 'pw-dhead' }, h('img', { class: 'pw-fav lg', src: fav(x.site), alt: '' }), h('div', {}, h('h2', {}, label(x.site)), isFile(x.site) ? h('small', {}, T('Page inside PatOS')) : null, h('small', {}, T('Last changed') + ' ' + new Date(x.updated).toLocaleDateString(PatOS.locale)))),
          h('div', { class: 'pw-field' }, h('label', {}, T('Username or email')), h('div', { class: 'pw-val' }, h('span', {}, x.username || '—'), x.username ? h('button', { class: 'tbtn', title: T('Copy'), html: OF.icon('copy', 17), onclick: () => copy(x.username, T('Username')) }) : null)),
          h('div', { class: 'pw-field' }, h('label', {}, T('Password')), h('div', { class: 'pw-val' }, pwSpan, bShow, h('button', { class: 'tbtn', title: T('Copy'), html: OF.icon('copy', 17), onclick: () => { copy(x.password, T('Password')); P.used(x.id); } })), meter(x.password)),
          reused ? h('div', { class: 'pw-alert' }, T('You use this password on other sites too. If one site leaks it, the others are at risk.')) : null,
          leaks[x.id] ? h('div', { class: 'pw-alert red' }, T('This password appeared in known data leaks') + ' (' + leaks[x.id].toLocaleString() + '). ' + T('Change it on the site.')) : null,
          x.note ? h('div', { class: 'pw-field' }, h('label', {}, T('Note')), h('div', { class: 'pw-note' }, x.note)) : null,
          isFile(x.site) ? null : h('div', { class: 'pw-field' }, h('label', {}, T('Website')), h('div', { class: 'pw-val' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); PatOS.launch('browser', { url: x.url || 'https://' + x.site }); } }, x.url || 'https://' + x.site))),
          h('div', { class: 'pw-dbtns' }, h('button', { class: 'btn', onclick: () => editItem(x) }, T('Edit')), h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Delete this password?'), label(x.site) + ' · ' + x.username, { danger: true, ok: T('Delete'), icon: 'passwords' })) { await P.remove(x.id); selId = null; } } }, T('Delete')))].filter(Boolean));
      }
      function editItem(x) {
        const site = h('input', { class: 'field', value: x ? (isFile(x.site) ? x.site : x.url || x.site) : '', placeholder: 'https://example.com' });
        const user = h('input', { class: 'field', value: x ? x.username : '', placeholder: T('Username or email'), autocomplete: 'off' });
        const pw = h('input', { class: 'field', value: x ? x.password : '', placeholder: T('Password'), type: 'password', autocomplete: 'new-password' });
        const note = h('textarea', { class: 'field', placeholder: T('Note (optional)'), rows: 2 }); note.value = x ? x.note || '' : '';
        const m = h('div'); const paint = () => { m.innerHTML = ''; m.appendChild(meter(pw.value)); }; pw.oninput = paint; paint();
        const layer = h('div', { class: 'pw-layer' }, h('div', { class: 'pw-modal' }, h('h3', {}, T(x ? 'Edit password' : 'Add password')),
          h('label', {}, T('Website')), site, h('label', {}, T('Username or email')), user,
          h('label', {}, T('Password')), h('div', { class: 'pw-pwrow' }, pw, h('button', { class: 'tbtn', title: T('Show'), html: OF.icon('eye', 17), onclick: () => { pw.type = pw.type === 'password' ? 'text' : 'password'; } }), h('button', { class: 'btn', onclick: () => { pw.value = P.generate(); pw.type = 'text'; paint(); } }, T('Generate'))), m,
          h('label', {}, T('Note')), note,
          h('div', { class: 'pw-dbtns' }, h('button', { class: 'btn', onclick: () => layer.remove() }, T('Cancel')), h('button', { class: 'btn primary', onclick: async () => { if (!site.value.trim() || !pw.value) return; const url = /^(https?:\/\/|file:)/.test(site.value.trim()) ? site.value.trim() : 'https://' + site.value.trim(); if (x) await P.update(x.id, { site: url, url, username: user.value, password: pw.value, note: note.value }); else { const it = await P.save({ url, username: user.value, password: pw.value, note: note.value }); selId = it.id; } layer.remove(); } }, T('Save')))));
        win.body.appendChild(layer); setTimeout(() => (x ? pw : site).focus(), 30);
      }
      function generator() {
        const o = Object.assign({ length: 16, upper: true, digits: true, symbols: true, words: false }, PatOS.store.get('pwGen', {}));
        const out = h('code', { class: 'pw-gen' });
        const len = h('input', { type: 'range', min: 8, max: 40, value: o.length }), lenL = h('b', {}, o.length);
        const tog = (k, l) => { const s = h('button', { class: 'switch' + (o[k] ? ' on' : '') }); s.onclick = () => { o[k] = !o[k]; s.classList.toggle('on', o[k]); make(); }; return h('label', { class: 'pw-opt' }, T(l), s); };
        const make = () => { PatOS.store.set('pwGen', o); out.textContent = P.generate(o); m.innerHTML = ''; m.appendChild(meter(out.textContent)); };
        const m = h('div');
        len.oninput = () => { o.length = +len.value; lenL.textContent = len.value; make(); };
        const layer = h('div', { class: 'pw-layer' }, h('div', { class: 'pw-modal' }, h('h3', {}, T('Password generator')), out, m,
          h('label', { class: 'pw-opt' }, T('Length'), h('span', { class: 'pw-len' }, len, lenL)), tog('upper', 'Capital letters'), tog('digits', 'Numbers'), tog('symbols', 'Symbols'), tog('words', 'Easy to say (words)'),
          h('div', { class: 'pw-dbtns' }, h('button', { class: 'btn', onclick: make }, T('New one')), h('button', { class: 'btn', onclick: () => copy(out.textContent, T('Password')) }, T('Copy')), h('button', { class: 'btn primary', onclick: () => layer.remove() }, T('Done')))));
        win.body.appendChild(layer); make();
      }
      async function checkLeaks() {
        if (!canCrypt) return PatOS.alertBox(T('Not available here'), T('Open PatOS from its website to check passwords.'), { icon: 'passwords' });
        const all = P.all(); if (!all.length) return;
        OF.toast(win, T('Checking…'));
        try {
          for (const x of all) leaks[x.id] = await P.pwned(x.password);
          const n = all.filter((x) => leaks[x.id] > 0).length;
          PatOS.alertBox(n ? n + ' ' + T(n === 1 ? 'password was found in leaks' : 'passwords were found in leaks') : T('No leaked passwords found'), T('Only the first 5 characters of a scrambled version of each password were sent to haveibeenpwned.com, never the password itself.'), { icon: 'passwords' });
          if (n) filter = 'leaked'; render();
        } catch (e) { PatOS.alertBox(T('The check didn’t work'), T('Your network may block haveibeenpwned.com.'), { icon: 'passwords' }); }
      }
      function settings() {
        const never = P.never();
        const layer = h('div', { class: 'pw-layer' }, h('div', { class: 'pw-modal' }, h('h3', {}, T('Settings')),
          h('b', {}, T('Master password')),
          h('p', { class: 'pw-small' }, P.encrypted ? T('Your passwords are locked with your master password. They lock again when PatOS locks, or after 15 minutes without use.') : canCrypt ? T('Right now your passwords are encrypted with a key kept on this device, so anyone using this browser can open them. A master password locks them. If you forget it, they can’t be recovered.') : T('Open PatOS from its website to use a master password.')),
          P.encrypted ? h('div', { class: 'pw-dbtns' }, h('button', { class: 'btn', onclick: () => { P.lock(); layer.remove(); } }, T('Lock now')), h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox(T('Remove the master password?'), T('Your passwords stay encrypted on this device, but anyone using this browser will be able to open them.'), { icon: 'passwords' })) { await P.removeMaster(); layer.remove(); } } }, T('Remove master password'))) : canCrypt ? h('button', { class: 'btn', onclick: async () => { const a = await PatOS.ask(T('New master password'), '', { icon: 'passwords', ok: T('Next'), password: true }); if (!a) return; if (a.length < 6) return PatOS.alertBox(T('Too short'), T('Use at least 6 characters.'), { icon: 'passwords' }); const b2 = await PatOS.ask(T('Type it again'), '', { icon: 'passwords', ok: T('Turn on'), password: true }); if (a !== b2) return PatOS.alertBox(T('They don’t match'), '', { icon: 'passwords' }); await P.setMaster(a); layer.remove(); OF.toast(win, T('Passwords encrypted')); } }, T('Add master password')) : null,
          h('b', {}, T('Never save for these sites')),
          never.length ? h('div', { class: 'pw-never' }, ...never.map((s) => h('div', {}, h('span', {}, s), h('button', { class: 'tbtn', onclick: (e) => { P.removeNever(s); e.currentTarget.parentNode.remove(); } }, '×')))) : h('p', { class: 'pw-small' }, T('None')),
          h('b', {}, T('Import and export')),
          h('div', { class: 'pw-dbtns' }, h('button', { class: 'btn', onclick: importCSV }, T('Import CSV…')), h('button', { class: 'btn', onclick: exportCSV }, T('Export CSV'))),
          h('p', { class: 'pw-small' }, T('CSV files from Chrome, Edge, Safari and most password managers work. Exported files are not encrypted, so delete them after use.')),
          h('div', { class: 'pw-dbtns' }, h('button', { class: 'btn primary', onclick: () => layer.remove() }, T('Done')))));
        win.body.appendChild(layer);
      }
      function exportCSV() { const esc = (s) => (/[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : s); PatOS.downloadFile('PatOS Passwords.csv', ['name,url,username,password,note', ...P.all().map((x) => [x.site, x.url, x.username, x.password, x.note || ''].map(esc).join(','))].join('\n')); }
      function importCSV() {
        const i = h('input', { type: 'file', accept: '.csv,text/csv' });
        i.onchange = () => { const r = new FileReader(); r.onload = async () => {
          const rows = r.result.replace(/\r/g, '').split('\n').filter(Boolean).map((l) => { const out = []; let cur = '', qt = false; for (let k = 0; k < l.length; k++) { const ch = l[k]; if (qt) { if (ch === '"' && l[k + 1] === '"') { cur += '"'; k++; } else if (ch === '"') qt = false; else cur += ch; } else if (ch === '"') qt = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; });
          const hd = rows.shift().map((x) => x.toLowerCase()); const col = (names) => hd.findIndex((x) => names.includes(x));
          const cu = col(['url', 'login_uri', 'website', 'site']), cn = col(['username', 'login_username', 'user', 'email', 'login']), cp = col(['password', 'login_password']), co = col(['note', 'notes', 'extra']);
          let n = 0; for (const row of rows) { if (cp < 0 || !row[cp]) continue; await P.save({ url: row[cu] || row[0], username: row[cn] || '', password: row[cp], note: co >= 0 ? row[co] : '' }); n++; }
          OF.toast(win, n + ' ' + T('passwords imported'));
        }; r.readAsText(i.files[0]); };
        i.click();
      }
      function lockScreen() {
        win.body.querySelectorAll('.pw-lock').forEach((x) => x.remove());
        const inp = h('input', { class: 'field', type: 'password', placeholder: T('Master password'), autocomplete: 'current-password' });
        const err = h('small', { class: 'pw-err' });
        const go = async () => { if (await P.unlock(inp.value)) return; err.textContent = T('That isn’t the master password.'); inp.select(); win.el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 260 }); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        if (P.unreadable) {
          win.body.appendChild(h('div', { class: 'pw-lock' }, h('div', { class: 'pw-bigic', html: PatOS.iconHTML('passwords') }), h('h2', {}, T('These passwords can’t be opened here')), h('p', {}, T('They were saved on another device or browser, and only that device has the key. Restore a backup made with a master password, or start a new empty list.')),
            h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Start a new list?'), T('The passwords that can’t be opened will be replaced by an empty list.'), { ok: T('Start Over'), danger: true, icon: 'passwords' })) await P.startOver(); } }, T('Start a New List'))));
          return;
        }
        if (!P.encrypted) { win.body.appendChild(h('div', { class: 'pw-lock' }, h('p', {}, T('Opening…')))); P.ready.then(() => render()); return; }
        win.body.appendChild(h('div', { class: 'pw-lock' }, h('div', { class: 'pw-bigic', html: PatOS.iconHTML('passwords') }), h('h2', {}, T('Passwords are locked')), h('p', {}, T('Enter your master password to see them.')), inp, err, h('button', { class: 'btn primary', onclick: go }, T('Unlock'))));
        setTimeout(() => inp.focus(), 50);
      }
      function render() {
        win.body.querySelectorAll('.pw-lock').forEach((x) => x.remove());
        if (P.locked) { side.innerHTML = list.innerHTML = detail.innerHTML = ''; lockScreen(); return; }
        renderSide(); renderList(); renderDetail();
      }
      win._open = (a) => { if (a && a.site) { search.value = PatOS.passwords.hostOf(a.site); q = search.value; renderList(); const f = filtered()[0]; if (f) { selId = f.id; renderList(); renderDetail(); } } };
      render(); if (args && args.site) win._open(args);
    },
    onArgs(win, a) { win._open && win._open(a); }
  });
})();
