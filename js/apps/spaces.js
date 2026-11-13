/* Shared Spaces: the app (the service is js/spaces.js; the server's rules decide what each role may do). */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.spaces = { bg: 'linear-gradient(160deg,#64d2ff,#5e5ce6)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="25" r="8" fill="#fff"/><circle cx="41" cy="25" r="8" fill="#fff" opacity=".7"/><path d="M10 48c1-8 7-13 14-13s13 5 14 13z" fill="#fff"/><path d="M30 48c1-8 6-13 11-13 7 0 12 5 13 13z" fill="#fff" opacity=".7"/></svg>' };
  const ROLES = ['admin', 'editor', 'commenter', 'viewer'];
  const when = (t) => (t ? new Date(t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : t).toLocaleString(PatOS.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
  const ICON_OF = { doc: 'docs', sheet: 'sheets', slides: 'slides', note: 'notes', text: 'textedit' };

  PatOS.registerApp({
    id: 'spaces', name: 'Shared Spaces', icon: 'spaces', width: 940, height: 600, minWidth: 380, minHeight: 360, category: 'Productivity', keywords: 'shared spaces team group collaborate workspace share espace partagé équipe',
    about: 'Workspaces you share with other PatOS accounts.',
    launch(win, args) {
      const S = PatOS.spaces;
      let sel = args.sid || null, tab = 'files', fsel = null, offs = [], files = [], comments = [], activity = [], addPath = args.addPath || null;
      const side = h('div', { class: 'sp-side' }), main = h('div', { class: 'sp-main' });
      win.body.appendChild(h('div', { class: 'spc' }, side, main));
      const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'spaces' });
      const guard = async (fn) => { try { return await fn(); } catch (e) { msg(T('That didn’t work'), e.message || String(e)); } };
      function unsub() { offs.forEach((o) => o && o()); offs = []; }
      function watch(sp) { unsub(); files = []; comments = []; activity = []; if (!sp) return; offs = [S.files(sp, (l) => { files = l.sort((a, b) => a.name.localeCompare(b.name)); drawMain(); }), S.comments(sp, (l) => { comments = l; drawMain(); }), S.activity(sp, (l) => { activity = l; if (tab === 'activity') drawMain(); })]; }
      function drawSide() {
        side.innerHTML = '';
        side.append(h('div', { class: 'sp-shead' }, h('b', {}, T('Spaces')), h('button', { class: 'btn', disabled: !S.ready(), onclick: async () => { const n = await PatOS.ask(T('New Space'), T('Group Project'), { ok: T('Create'), icon: 'spaces' }); if (n) { const id = await guard(() => S.create(n)); if (id) { sel = id; draw(); } } } }, '+')));
        if (!S.ready()) { side.appendChild(h('p', { class: 'sp-muted' }, T('Sign in to your PatOS account to use Shared Spaces.'))); return; }
        S.invites().forEach((inv) => side.appendChild(h('div', { class: 'sp-inv' }, h('b', {}, inv.spaceName), h('small', {}, inv.byName + ' · ' + T(inv.role)),
          h('div', { class: 'sp-invb' }, h('button', { class: 'btn primary', onclick: () => guard(async () => { await S.accept(inv); sel = inv.sid; }) }, T('Accept')), h('button', { class: 'btn', onclick: () => guard(() => S.decline(inv)) }, T('Decline'))))));
        S.list().forEach((sp) => side.appendChild(h('button', { class: 'sp-si' + (sp.id === sel ? ' on' : ''), onclick: () => { sel = sp.id; fsel = null; tab = 'files'; draw(); } }, h('span', { class: 'sp-dot' }, (sp.name || '?').charAt(0).toUpperCase()), h('span', {}, sp.name), h('small', {}, Object.keys(sp.members || {}).length))));
        if (!S.list().length && !S.invites().length) side.appendChild(h('p', { class: 'sp-muted' }, T('No spaces yet. Make one and invite your friends by username.')));
        if (S.pending().length) side.appendChild(h('p', { class: 'sp-muted' }, S.pending().length + ' ' + T('changes are waiting for the internet')));
      }
      function drawMain() {
        main.innerHTML = '';
        const sp = S.get(sel);
        if (!sp) { main.appendChild(h('div', { class: 'sp-empty' }, h('span', { class: 'sp-ic', html: PatOS.iconHTML('spaces') }), h('h2', {}, T('Shared Spaces')), h('p', {}, T('Work on files with other people: each person has a role, and every change is kept.')), h('p', { class: 'sp-fine' }, T('Spaces are stored in PatOS’s cloud so their members can read them. Unlike your own files, they aren’t end-to-end encrypted.')))); return; }
        const role = S.roleOf(sp);
        if (addPath) { const p = addPath; addPath = null; if (S.can(sp, 'edit')) guard(async () => { await S.addFromPiles(sp, p); PatOS.notify({ title: T('Added to') + ' ' + sp.name, body: PatOS.fs.basename(p), icon: 'spaces', priority: 'low' }); }); }
        const tabs = h('div', { class: 'sp-tabs', role: 'tablist' }, ...[['files', 'Files'], ['activity', 'Activity'], ['members', 'Members']].map(([k, l]) => h('button', { class: 'sp-tab' + (tab === k ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; drawMain(); } }, T(l))));
        main.append(h('div', { class: 'sp-head' }, h('h2', {}, sp.name), h('span', { class: 'sp-role r-' + role }, T(role)), h('button', { class: 'btn', title: T('Boards, live notes, tasks and voice with the members'), onclick: () => PatOS.launch('livespace', { sid: sp.id }) }, T('Open in Live')), h('div', { class: 'sp-avs' }, ...Object.keys(sp.members).slice(0, 6).map((u) => h('span', { class: 'sp-av', title: '@' + ((sp.names || {})[u] || '?') + ' · ' + T(sp.members[u]) }, ((sp.names || {})[u] || '?').charAt(0).toUpperCase())))), tabs);
        if (tab === 'files') drawFiles(sp); else if (tab === 'activity') drawActivity(); else drawMembers(sp);
      }
      function drawFiles(sp) {
        const edit = S.can(sp, 'edit');
        const bar = h('div', { class: 'sp-bar' },
          edit ? h('button', { class: 'btn', onclick: async () => { const n = await PatOS.ask(T('New file'), T('Notes.txt'), { ok: T('Create'), icon: 'spaces' }); if (n) guard(() => S.addFile(sp, n.includes('.') ? n : n + '.txt', '')); } }, T('New file')) : null,
          edit ? h('button', { class: 'btn', onclick: () => { PatOS.alertBox(T('Add from Piles'), T('In Piles, right-click a text file or a PatOS document, then Share… › Add to a Space.'), { icon: 'spaces' }); } }, T('Add from Piles')) : null,
          !edit ? h('span', { class: 'sp-muted' }, role2(sp)) : null);
        const list = h('div', { class: 'sp-files' }, ...(files.length ? files.map((f) => h('div', { class: 'sp-file' + (fsel === f.id ? ' on' : ''), onclick: () => { fsel = f.id; drawMain(); } },
          h('span', { class: 'sp-fic', html: PatOS.iconHTML(ICON_OF[f.kind] || 'textedit') }), h('div', { class: 'sp-ft' }, h('b', {}, f.name), h('small', {}, T('rev') + ' ' + f.rev + ' · ' + (f.updatedName ? '@' + f.updatedName + ' · ' : '') + when(f.updatedAt) + (f.lockedBy && f.lockUntil > Date.now() ? ' · ' + T('being edited by') + ' @' + (f.lockedName || '') : ''))))) : [h('p', { class: 'sp-muted' }, T('No files yet.'))]));
        main.append(bar, h('div', { class: 'sp-split' }, list, filePanel(sp, files.find((f) => f.id === fsel))));
      }
      const role2 = (sp) => ({ commenter: T('You can read and comment.'), viewer: T('You can read.') })[S.roleOf(sp)] || '';
      function filePanel(sp, f) {
        if (!f) return h('div', { class: 'sp-fpanel sp-muted' }, T('Pick a file.'));
        const edit = S.can(sp, 'edit'); const mineLock = f.lockedBy === (S.me() || {}).uid && f.lockUntil > Date.now();
        const note = h('p', { class: 'sp-muted' });
        const cIn = h('input', { class: 'field', placeholder: T('Add a comment'), 'aria-label': T('Add a comment'), maxlength: '2000' });
        cIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && cIn.value.trim()) { const t = cIn.value.trim(); cIn.value = ''; guard(() => S.comment(sp, f, t)); } });
        const mineC = comments.filter((c) => c.fid === f.id).reverse();
        return h('div', { class: 'sp-fpanel' },
          h('h3', {}, f.name), h('small', { class: 'sp-muted' }, T('rev') + ' ' + f.rev),
          h('div', { class: 'sp-acts' },
            h('button', { class: 'btn primary', onclick: () => S.openFile(sp, f) }, edit ? T('Open and edit') : T('Open')),
            edit ? h('button', { class: 'btn', onclick: () => guard(async () => { await S.lock(sp, f, !mineLock); }) }, mineLock ? T('Stop editing') : T('I’m editing (lock)')) : null,
            h('button', { class: 'btn', onclick: () => guard(async () => { const r = await S.revs(sp, f); note.innerHTML = ''; r.forEach((v) => note.appendChild(h('div', {}, T('rev') + ' ' + v.rev + ' · @' + (v.byName || '') + ' · ' + when(v.at)))); }) }, T('History')),
            edit ? h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Delete') + ' “' + f.name + '”?', T('It is removed for everyone in the space, with its history.'), { ok: T('Delete'), danger: true, icon: 'spaces' })) guard(() => S.delFile(sp, f)); } }, T('Delete')) : null),
          note, h('h4', {}, T('Comments')), h('div', { class: 'sp-comments' }, ...(mineC.length ? mineC.map((c) => h('div', { class: 'sp-c' }, h('b', {}, '@' + c.byName), h('span', {}, c.text), h('small', {}, when(c.at)),
            c.by === (S.me() || {}).uid || S.can(sp, 'admin') ? h('button', { class: 'sp-cx', 'aria-label': T('Delete'), onclick: () => guard(() => S.delComment(sp, c)) }, '×') : null)) : [h('p', { class: 'sp-muted' }, T('No comments yet.'))])),
          S.can(sp, 'comment') ? cIn : null);
      }
      function drawActivity() {
        const W = { created: 'created the space', invited: 'invited', joined: 'joined', added: 'added', deleted: 'deleted' };
        main.appendChild(h('div', { class: 'sp-act' }, ...(activity.length ? activity.map((a) => h('div', { class: 'sp-arow' }, h('b', {}, '@' + a.byName), ' ' + T(W[a.what] || a.what) + ' ', a.what !== 'created' && a.what !== 'joined' ? h('i', {}, a.name) : null, h('small', {}, when(a.at)))) : [h('p', { class: 'sp-muted' }, T('Nothing yet.'))])));
      }
      function drawMembers(sp) {
        const admin = S.can(sp, 'admin'), owner = S.can(sp, 'owner'), meU = (S.me() || {}).uid;
        const rows = Object.keys(sp.members).map((u) => {
          const r = sp.members[u]; const changeable = admin && u !== sp.owner && u !== meU && (owner || (r !== 'admin'));
          const selR = h('select', { class: 'field', disabled: !changeable, 'aria-label': T('Role') }, ...(r === 'owner' ? ['owner'] : ROLES.filter((x) => owner || x !== 'admin' || r === 'admin')).map((x) => h('option', { value: x, selected: x === r }, T(x))));
          selR.onchange = () => guard(() => S.setRole(sp, u, selR.value));
          return h('div', { class: 'sp-mrow' }, h('span', { class: 'sp-av' }, ((sp.names || {})[u] || '?').charAt(0).toUpperCase()), h('b', {}, '@' + ((sp.names || {})[u] || '?') + (u === meU ? ' (' + T('you') + ')' : '')), selR,
            changeable ? h('button', { class: 'btn', onclick: () => guard(() => S.remove(sp, u)) }, T('Remove')) : null);
        });
        const uIn = h('input', { class: 'field', placeholder: T('Username'), 'aria-label': T('Username') }), rIn = h('select', { class: 'field', 'aria-label': T('Role') }, ...ROLES.filter((x) => owner || x !== 'admin').map((x) => h('option', { value: x, selected: x === 'editor' }, T(x))));
        main.append(h('div', { class: 'sp-members' }, ...rows),
          admin ? h('div', { class: 'sp-invite' }, h('h4', {}, T('Invite someone')), h('div', { class: 'sp-acts' }, uIn, rIn, h('button', { class: 'btn primary', onclick: () => guard(async () => { await S.invite(sp, uIn.value, rIn.value); uIn.value = ''; PatOS.notify({ title: T('Invitation sent'), body: sp.name, icon: 'spaces', priority: 'low' }); }) }, T('Invite')))) : null,
          h('div', { class: 'sp-acts sp-danger' }, owner ? h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Delete') + ' “' + sp.name + '”?', T('The space, its files and their history are deleted for everyone.'), { ok: T('Delete'), danger: true, icon: 'spaces' })) { await guard(() => S.del(sp)); sel = null; draw(); } } }, T('Delete Space'))
            : h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox(T('Leave') + ' “' + sp.name + '”?', T('You won’t see it anymore unless someone invites you again.'), { ok: T('Leave'), icon: 'spaces' })) { await guard(() => S.leave(sp)); sel = null; draw(); } } }, T('Leave Space'))));
      }
      function draw() { drawSide(); watch(S.get(sel)); drawMain(); }
      const off = PatOS.on('spaces', () => { drawSide(); if (sel && !S.get(sel)) { sel = null; unsub(); } drawMain(); });
      win.on('closed', () => { off(); unsub(); });
      if (!S.ready()) S.start().then(draw); else { if (addPath && !sel) { const sp = S.list().find((x) => S.can(x, 'edit')); if (sp) sel = sp.id; } draw(); }
    },
    onArgs(win, args) { if (args.addPath || args.sid) { win.close(); setTimeout(() => PatOS.launch('spaces', args), 300); } }
  });
})();
