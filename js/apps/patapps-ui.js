/* App Store › Community and Develop: browse apps people made, install an app file, make an app, and send it for review. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tile = (a) => '<div class="icon-tile" style="background:linear-gradient(160deg,rgba(255,255,255,.28),rgba(0,0,0,.22)),' + (/^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#0a84ff') + '"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><text x="32" y="44" font-size="34" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle" fill="#fff">' + esc(a.icon || '?') + '</text></svg></div>';
  const fail = (e) => PatOS.alertBox(T('That didn’t work'), String((e && e.message) || e), { icon: 'appstore' });
  const permTags = (a) => h('div', { class: 'as-tags' }, ...(a.permissions && a.permissions.length ? a.permissions.map((p) => h('span', {}, PatOS.patapps.permInfo(p)[0])) : [h('span', {}, T('nothing special'))]));
  const pickFile = (accept) => new Promise((res) => { const i = h('input', { type: 'file', accept }); i.style.display = 'none'; document.body.appendChild(i); i.onchange = () => { const f = i.files[0]; i.remove(); res(f || null); }; i.addEventListener('cancel', () => { i.remove(); res(null); }); i.click(); });

  function community(main, q, again) {
    const P = PatOS.patapps;
    main.appendChild(h('h1', { class: 'as-h1' }, T('Community')));
    main.appendChild(h('p', { class: 'as-note' }, T('Apps that people made for PatOS. The owner of this PatOS reads each one before it shows up here. Installed apps work offline.')));
    const box = h('div'); main.appendChild(box);
    const row = (a, inst) => {
      const have = P.get(a.id); const newer = have && P.cmp(a.version, have.version) > 0;
      const b = h('button', { class: 'as-get' }, !have ? T('GET') : newer ? T('UPDATE') : T('OPEN'));
      b.onclick = async (e) => { e.stopPropagation(); try { if (!have || newer) { if (await P.store.install(a.id)) again(); } else P.open(a.id); } catch (er) { fail(er); } };
      const rm = have && !newer ? h('button', { class: 'btn', style: { marginLeft: '8px' }, onclick: async (e) => { e.stopPropagation(); if (await P.uninstall(a.id)) again(); } }, T('Remove')) : null;
      return h('div', { class: 'as-row' }, h('div', { class: 'as-ic', html: tile(a) }), h('div', { class: 'as-txt' }, h('b', {}, a.name + ' ' + a.version), h('small', {}, (a.author ? a.author + ' · ' : '') + (a.description || '')), permTags(a)), b, rm);
    };
    const fits = (a) => !q || (a.name + ' ' + (a.description || '') + ' ' + (a.author || '')).toLowerCase().includes(q);
    const mine = P.list().map((r) => r.app).filter(fits);
    box.appendChild(h('p', { class: 'as-note' }, T('Loading…')));
    P.store.list().then((list) => {
      box.innerHTML = ''; const ids = new Set(list.map((a) => a.id)); const shown = list.filter(fits);
      if (shown.length) { const g = h('div', { class: 'as-list' }); shown.forEach((a) => g.appendChild(row(a))); box.appendChild(g); } else box.appendChild(h('p', { class: 'as-note' }, q ? T('No apps match.') : T('No community apps yet. Make the first one in the Develop tab.')));
      const own = mine.filter((a) => !ids.has(a.id));
      if (own.length) { box.appendChild(h('h2', {}, T('Installed from files'))); const g = h('div', { class: 'as-list' }); own.forEach((a) => g.appendChild(row(a))); box.appendChild(g); }
    }).catch(() => {
      box.innerHTML = ''; box.appendChild(h('p', { class: 'as-note' }, T('The store can’t be reached right now (are you offline?). Apps you installed still work.')));
      if (mine.length) { box.appendChild(h('h2', {}, T('Installed'))); const g = h('div', { class: 'as-list' }); mine.forEach((a) => g.appendChild(row(a))); box.appendChild(g); }
    });
  }

  function develop(main, again) {
    const P = PatOS.patapps;
    main.appendChild(h('h1', { class: 'as-h1' }, T('Develop')));
    main.appendChild(h('p', { class: 'as-note' }, T('A PatOS app is one .patapp file: a web page with a name, an icon and a list of what it needs. It runs in a locked box and talks to PatOS through patos.storage, patos.notify, patos.files and a few more. Each sensitive thing is asked on the device before first use.')));
    const open = h('button', { class: 'btn primary' }, T('Open a .patapp File…')); open.onclick = async () => { const f = await pickFile('.patapp,.json,application/json'); if (f) { try { if (await P.installFromFile(f)) again(); } catch (e) { fail(e); } } };
    const send = h('button', { class: 'btn' }, T('Send a File for Review…')); send.onclick = async () => { const f = await pickFile('.patapp,.json,application/json'); if (f) { try { await sendIt(P.parse(await f.text())); } catch (e) { fail(e); } } };
    const guide = h('button', { class: 'btn', onclick: () => PatOS.openExternal(location.origin + '/docs/APP-SDK.md') }, T('Developer Guide'));
    main.appendChild(h('div', { class: 'as-btns' }, open, send, guide));
    async function sendIt(app) {
      if (!(await PatOS.confirmBox(T('Send') + ' “' + app.name + '” ' + T('for review?'), T('The owner of this PatOS reads the app and decides. If it is accepted, it shows up in Community for everyone who uses this server. You can follow its status below.'), { ok: T('Send'), icon: 'appstore' }))) return;
      await P.submit(app); PatOS.notify({ title: T('Sent for review'), body: app.name, icon: 'appstore' }); again();
    }

    // the form
    main.appendChild(h('h2', {}, T('Make an app')));
    const f = {};
    const field = (k, label, props) => { f[k] = h('input', Object.assign({ class: 'field', 'aria-label': label, placeholder: label }, props || {})); return f[k]; };
    field('name', T('Name'), { maxlength: '40' }); field('author', T('Your name'), { maxlength: '40' }); field('description', T('What it does'), { maxlength: '300' });
    field('icon', T('Icon (an emoji or a letter)'), { maxlength: '4', style: { width: '120px' }, value: '✨' }); field('id', T('App id (optional, like com.maya.timer)'), { maxlength: '49' });
    f.color = h('input', { type: 'color', value: '#0a84ff', 'aria-label': T('Color') });
    const perms = P.permInfo ? ['files', 'clipboard', 'notifications', 'camera', 'microphone', 'location', 'network'].map((p) => { const c = h('input', { type: 'checkbox', value: p }); return h('label', { class: 'as-perm' }, c, ' ' + P.permInfo(p)[0]); }) : [];
    f.html = h('textarea', { class: 'field as-code', spellcheck: 'false', rows: '12', 'aria-label': 'HTML' }); f.html.value = P.example;
    const build = () => P.make({ name: f.name.value, author: f.author.value, description: f.description.value, icon: f.icon.value, id: f.id.value, color: f.color.value, html: f.html.value, permissions: perms.map((l) => l.firstChild).filter((c) => c.checked).map((c) => c.value) });
    const test = h('button', { class: 'btn primary' }, T('Install to Try It')); test.onclick = async () => { try { const a = build(); if (await P.install(a, { source: 'file' })) { again(); P.open(a.id); } } catch (e) { fail(e); } };
    const save = h('button', { class: 'btn' }, T('Save .patapp')); save.onclick = () => { try { const a = build(); PatOS.downloadFile(a.id + '.patapp', JSON.stringify(a, null, 2)); } catch (e) { fail(e); } };
    const rev = h('button', { class: 'btn' }, T('Send for Review')); rev.onclick = async () => { try { await sendIt(build()); } catch (e) { fail(e); } };
    main.appendChild(h('div', { class: 'as-form' }, f.name, f.author, f.description, h('div', { class: 'as-btns' }, f.icon, f.color), f.id, h('div', { class: 'as-perms' }, h('small', {}, T('It will ask for:')), ...perms), f.html, h('div', { class: 'as-btns' }, test, save, rev)));

    // what was sent
    const sub = h('div'); main.appendChild(h('h2', {}, T('Sent for review'))); main.appendChild(sub);
    const paint = (l) => { sub.innerHTML = ''; if (!l.length) { sub.appendChild(h('p', { class: 'as-note' }, T('Nothing sent yet.'))); return; } l.forEach((s) => sub.appendChild(h('div', { class: 'as-row' }, h('div', { class: 'as-txt' }, h('b', {}, s.name + ' ' + s.version), h('small', {}, (s.status === 'accepted' ? T('Accepted: it is in Community') : s.status === 'rejected' ? T('Not accepted') : T('Waiting for review')) + (s.note ? ' · ' + s.note : '')))))); };
    paint(P.submits()); P.refreshSubmits().then(paint).catch(() => {});
  }
  PatOS.patappsUI = { community, develop };
})();
