/* App Store › Community and Develop: browse apps people made, install an app file, make an app, and send it for review. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tile = (a) => '<div class="icon-tile" style="background:linear-gradient(160deg,rgba(255,255,255,.28),rgba(0,0,0,.22)),' + (/^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#0a84ff') + '"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><text x="32" y="44" font-size="34" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle" fill="#fff">' + esc(a.icon || '?') + '</text></svg></div>';
  const fail = (e) => PatOS.alertBox(T('That didn’t work'), String((e && e.message) || e), { icon: 'appstore' });
  const permTags = (a) => h('div', { class: 'as-tags' }, ...(a.permissions && a.permissions.length ? a.permissions.map((p) => h('span', {}, PatOS.patapps.permInfo(p)[0])) : [h('span', {}, T('nothing special'))]));
  const pickFile = () => new Promise((res) => { const i = h('input', { type: 'file' }); // (no file type filter: phones gray out extensions they do not know, like .patapp. The file is checked after it is picked.)
    i.style.display = 'none'; document.body.appendChild(i); i.onchange = () => { const f = i.files[0]; i.remove(); res(f || null); }; i.addEventListener('cancel', () => { i.remove(); res(null); }); i.click(); });

  /* what is typed in the Develop form is kept (in memory and on the device), so installing to try an app, or leaving and coming back, never empties it */
  let draft = PatOS.store.get('patappDraft', null);
  let saveTimer = 0; const keepDraft = (d) => { draft = d; clearTimeout(saveTimer); saveTimer = setTimeout(() => PatOS.store.set('patappDraft', d), 400); };
  /* put an app into the editor and show the Develop tab */
  function edit(app) {
    keepDraft({ name: app.name, author: app.author || '', description: app.description || '', icon: app.icon || '', id: app.id, color: app.color || '#0a84ff', html: app.html, permissions: (app.permissions || []).slice(), version: app.version, engine: app.engine, width: app.width, height: app.height });
    const w = PatOS.wm && PatOS.wm.windowsOf('appstore')[0]; if (w && w._tab) w._tab('develop'); else PatOS.launch('appstore', { tab: 'develop' });
  }

  function community(main, q, again) {
    const P = PatOS.patapps;
    main.appendChild(h('h1', { class: 'as-h1' }, T('Community')));
    main.appendChild(h('p', { class: 'as-note' }, ''));
    const box = h('div'); main.appendChild(box);
    const row = (a, inst) => {
      const have = P.get(a.id); const newer = have && P.cmp(a.version, have.version) > 0;
      const b = h('button', { class: 'as-get' }, !have ? T('GET') : newer ? T('UPDATE') : T('OPEN'));
      b.onclick = async (e) => { e.stopPropagation(); try { if (!have || newer) { if (await P.store.install(a.id)) again(); } else P.open(a.id); } catch (er) { fail(er); } };
      const ed = have && have.source === 'file' ? h('button', { class: 'btn', style: { marginLeft: '8px' }, onclick: (e) => { e.stopPropagation(); edit(have.app); } }, T('Edit this app')) : null;
      const rm = have && !newer ? h('button', { class: 'btn', style: { marginLeft: '8px' }, onclick: async (e) => { e.stopPropagation(); if (await P.uninstall(a.id)) again(); } }, T('Remove')) : null;
      const el = h('div', { class: 'as-row', role: 'button', tabindex: '0', 'aria-label': a.name + ' ' + a.version }, h('div', { class: 'as-ic', html: tile(a) }), h('div', { class: 'as-txt' }, h('b', {}, a.name + ' ' + a.version), h('small', {}, (a.author ? a.author + ' · ' : '') + (a.category ? T(a.category) + ' · ' : '') + (a.description || '')), permTags(a)), b, ed, rm);
      el.addEventListener('click', () => detail(a, b)); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === el) detail(a, b); });
      return el;
    };
    /* an app's page: only what is really known about it (no made-up ratings or download counts) */
    function detail(a, getBtn) {
      main.innerHTML = ''; const F = window.PatAppFormat; const ok = !F || !F.compatible || F.compatible(a, PatOS.version);
      const info = (l, v) => (v ? h('div', { class: 'st-row' }, h('div', { class: 'st-rl' }, h('span', {}, l)), h('span', { class: 'st-val' }, v)) : null);
      main.append(h('button', { class: 'btn as-back', onclick: again }, '‹ ' + T('Back')),
        h('div', { class: 'as-detail' }, h('div', { class: 'as-dic', html: tile(a) }), h('div', {}, h('h1', {}, a.name), h('p', { class: 'as-cat' }, (a.author ? T('By') + ' ' + a.author : '') + (a.category ? ' · ' + T(a.category) : '')), h('div', { class: 'as-btns' }, getBtn.cloneNode(true))) ),
        h('p', { class: 'as-desc' }, a.description || ''),
        a.screenshots && a.screenshots.length ? h('div', { class: 'as-shots', role: 'list', 'aria-label': T('Screenshots') }, ...a.screenshots.map((src, i) => h('img', { src, alt: a.name + ' ' + T('screenshot') + ' ' + (i + 1), role: 'listitem', loading: 'lazy' }))) : null,
        h('div', { class: 'st-group' }, info(T('Version'), a.version), info(T('Runs on this PatOS'), ok ? T('Yes') : T('Needs PatOS') + ' ' + a.minPatOS), info(T('Permissions'), (a.permissions || []).map((p) => PatOS.patapps.permInfo(p)[0]).join(', ') || T('none')),
          info(T('Actions it offers'), (a.actions || []).map((x) => x.title + ' (“' + (x.phrases[0] || '') + '”)').join(', ')), a.homepage ? h('div', { class: 'st-row' }, h('div', { class: 'st-rl' }, h('span', {}, T('Website'))), h('a', { href: a.homepage, target: '_blank', rel: 'noopener noreferrer' }, a.homepage.replace(/^https:\/\//, ''))) : null),
        a.changelog ? h('div', {}, h('h2', {}, T('What’s new in') + ' ' + a.version), h('p', { class: 'as-desc', style: { whiteSpace: 'pre-wrap' } }, a.changelog)) : null);
      const nb = main.querySelector('.as-btns button'); if (nb) nb.onclick = (e) => { e.stopPropagation(); getBtn.click(); };
    }
    // categories (from the apps themselves) and sorting
    let cat = '', sort = 'name';
    const bar = h('div', { class: 'as-filter', role: 'toolbar', 'aria-label': T('Filter') });
    const sortSel = h('select', { class: 'field', 'aria-label': T('Sort by') }, h('option', { value: 'name' }, T('Name')), h('option', { value: 'new' }, T('Recently updated')));
    sortSel.onchange = () => { sort = sortSel.value; draw(lastList); };
    main.appendChild(bar);
    const fits = (a) => (!q || (a.name + ' ' + (a.description || '') + ' ' + (a.author || '') + ' ' + (a.category || '')).toLowerCase().includes(q)) && (!cat || a.category === cat);
    let lastList = null;
    function chips(list) { bar.innerHTML = ''; const cats = [...new Set(list.map((a) => a.category).filter(Boolean))].sort(); [''].concat(cats).forEach((c) => bar.appendChild(h('button', { class: 'as-chip' + (c === cat ? ' on' : ''), 'aria-pressed': String(c === cat), onclick: () => { cat = c; chips(list); draw(list); } }, c ? T(c) : T('All')))); bar.appendChild(sortSel); }
    const order = (l) => l.slice().sort((x, y) => (sort === 'new' ? (y.updated || 0) - (x.updated || 0) : x.name.localeCompare(y.name)));
    const mine = P.list().map((r) => Object.assign({ updated: r.updated }, r.app));
    box.appendChild(h('p', { class: 'as-note' }, T('Loading…')));
    function draw(list) {
      if (!list) return; lastList = list;
      box.innerHTML = ''; const ids = new Set(list.map((a) => a.id)); const shown = order(list.filter(fits));
      if (shown.length) { const g = h('div', { class: 'as-list' }); shown.forEach((a) => g.appendChild(row(a))); box.appendChild(g); } else box.appendChild(h('p', { class: 'as-note' }, q ? T('No apps match.') : T('No community apps yet. Make the first one in the Develop tab.')));
      const own = order(mine.filter((a) => !ids.has(a.id) && fits(a)));
      if (own.length) { box.appendChild(h('h2', {}, T('Installed from files'))); const g = h('div', { class: 'as-list' }); own.forEach((a) => g.appendChild(row(a))); box.appendChild(g); }
    }
    P.store.list().then((list) => { chips(list.concat(mine)); draw(list); }).catch(() => {
      box.innerHTML = ''; box.appendChild(h('p', { class: 'as-note' }, T('The store can’t be reached right now (are you offline?). Apps you installed still work.')));
      if (mine.length) { box.appendChild(h('h2', {}, T('Installed'))); const g = h('div', { class: 'as-list' }); mine.forEach((a) => g.appendChild(row(a))); box.appendChild(g); }
    });
  }

  function develop(main, again) {
    const P = PatOS.patapps;
    main.appendChild(h('h1', { class: 'as-h1' }, T('Develop')));
    main.appendChild(h('p', { class: 'as-note' }, ''));
    const open = h('button', { class: 'btn primary' }, T('Open a .patapp File…')); open.onclick = async () => { const f = await pickFile('.patapp,.json,application/json'); if (f) { try { const a = P.parse(await f.text()); if (await P.install(a, { source: 'file' })) edit(a); } catch (e) { fail(e); } } };
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
    if (draft) { f.name.value = draft.name || ''; f.author.value = draft.author || ''; f.description.value = draft.description || ''; f.icon.value = draft.icon || ''; f.id.value = draft.id || ''; f.color.value = /^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#0a84ff'; perms.forEach((l) => { l.firstChild.checked = (draft.permissions || []).includes(l.firstChild.value); }); }
    f.html = h('textarea', { class: 'field as-code', spellcheck: 'false', rows: '12', 'aria-label': 'HTML' }); f.html.value = draft && draft.html != null ? draft.html : P.example;
    const state = () => ({ name: f.name.value, author: f.author.value, description: f.description.value, icon: f.icon.value, id: f.id.value, color: f.color.value, html: f.html.value, permissions: perms.map((l) => l.firstChild).filter((c) => c.checked).map((c) => c.value), version: draft && draft.version, engine: draft && draft.engine, width: draft && draft.width, height: draft && draft.height });
    [f.name, f.author, f.description, f.icon, f.id, f.color, f.html, ...perms].forEach((el) => el.addEventListener('input', () => keepDraft(state())));
    perms.forEach((l) => l.firstChild.addEventListener('change', () => keepDraft(state())));
    const build = () => P.make(state());
    const test = h('button', { class: 'btn primary' }, T('Install to Try It')); test.onclick = async () => { try { const a = build(); if (await P.install(a, { source: 'file' })) { f.id.value = a.id; keepDraft(state()); P.open(a.id); } } catch (e) { fail(e); } };
    const save = h('button', { class: 'btn' }, T('Save .patapp')); save.onclick = () => { try { const a = build(); PatOS.downloadFile(a.id + '.patapp', JSON.stringify(a, null, 2)); } catch (e) { fail(e); } };
    const rev = h('button', { class: 'btn' }, T('Send for Review')); rev.onclick = async () => { try { await sendIt(build()); } catch (e) { fail(e); } };
    main.appendChild(h('div', { class: 'as-form' }, f.name, f.author, f.description, h('div', { class: 'as-btns' }, f.icon, f.color), f.id, h('div', { class: 'as-perms' }, h('small', {}, T('It will ask for:')), ...perms), f.html, h('div', { class: 'as-btns' }, test, save, rev)));

    // what was sent
    const sub = h('div'); main.appendChild(h('h2', {}, T('Sent for review'))); main.appendChild(sub);
    const paint = (l) => { sub.innerHTML = ''; if (!l.length) { sub.appendChild(h('p', { class: 'as-note' }, T('Nothing sent yet.'))); return; } l.forEach((s) => sub.appendChild(h('div', { class: 'as-row' }, h('div', { class: 'as-txt' }, h('b', {}, s.name + ' ' + s.version), h('small', {}, (s.status === 'accepted' ? T('Accepted: it is in Community') : s.status === 'rejected' ? T('Not accepted') : T('Waiting for review')) + (s.note ? ' · ' + s.note : '')))))); };
    paint(P.submits()); P.refreshSubmits().then(paint).catch(() => {});
  }
  PatOS.patappsUI = { community, develop, edit };
})();
