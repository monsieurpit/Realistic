/* PatOS Commons (4.0): communities of PatOS people. Public ones anyone can find and join; private ones need a moderator's yes.
   Posts, announcements (moderators), events (add them to your Calendar), showcases (share a desktop, a gallery or a widget
   made in Studio: data only, never code, and checked again by PatOS before anything is used), challenges (moderators) and
   their entries. Profiles, follows, blocks, likes, reports.
   The server decides (firestore.rules): who reads what, roles, the posting rate limit (one post per 20 s per community), bans,
   reports only moderators read, nobody follows someone who blocked them. PatOS hides what people you blocked post. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.commons = { bg: 'linear-gradient(160deg,#34c759,#0a84ff)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="20" r="8" fill="#fff"/><circle cx="16" cy="30" r="6" fill="#fff" opacity=".8"/><circle cx="48" cy="30" r="6" fill="#fff" opacity=".8"/><path d="M18 52c1-9 7-14 14-14s13 5 14 14z" fill="#fff"/><path d="M4 50c1-6 5-10 12-10 3 0 5 1 7 2-3 2-5 5-6 8z M60 50c-1-6-5-10-12-10-3 0-5 1-7 2 3 2 5 5 6 8z" fill="#fff" opacity=".8"/></svg>' };
  const ms = (t) => (!t ? 0 : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : +t);
  const when = (t) => new Date(ms(t)).toLocaleString(PatOS.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const KINDS = { post: 'Post', announcement: 'Announcement', event: 'Event', showcase: 'Showcase', challenge: 'Challenge', entry: 'Entry' };
  const ATTACH = { desk: 'Desktop', gallery: 'Gallery', widget: 'Widget' };
  const JOINED = 'commonsJoined';
  const joined = () => PatOS.store.get(JOINED, []) || [];
  const setJoined = (l) => PatOS.store.set(JOINED, [...new Set(l)].slice(0, 50));

  PatOS.registerApp({
    id: 'commons', name: 'PatOS Commons', icon: 'commons', width: 1040, height: 680, minWidth: 420, minHeight: 380, category: 'Apps', keywords: 'commons community communities social posts events showcase challenge follow communauté',
    about: 'Communities of PatOS people: posts, events, showcases and challenges.',
    launch(win, args) {
      let F = null; const me = () => (PatOS.account && PatOS.account.signedIn() ? (() => { const i = PatOS.account.info(); return { uid: i.uid, username: i.username }; })() : null);
      let view = { kind: 'discover' }, mine = [], found = [], blocked = new Set(), off = null, offM = null, posts = [], members = [], com = null, filter = 'all';
      const side = h('div', { class: 'cm-side' }), main = h('div', { class: 'cm-main' });
      win.body.appendChild(h('div', { class: 'cm' }, side, main));
      const guard = async (fn) => { try { return await fn(); } catch (e) { PatOS.alertBox(T('That didn’t work'), (e && e.code === 'permission-denied') ? T('PatOS’s server didn’t allow that.') : (e.message || String(e)), { icon: 'commons' }); return null; } };
      const myRole = () => { const m = me() && members.find((x) => x.id === me().uid); return m ? m.role : ''; };
      const isMod = () => ['owner', 'mod'].includes(myRole());
      const isMember = () => ['owner', 'mod', 'member'].includes(myRole());

      async function start() {
        if (!me()) return draw();
        try { F = F || await PatOS.account.cloud(); } catch (e) { F = null; return draw(); }
        const asked = joined();
        const [m, b] = await Promise.all([F.comMany(me(), asked).catch(() => null), F.blocked(me()).catch(() => [])]);
        if (m) { mine = m.filter((c) => c.myRole); setJoined(joined().filter((id) => !asked.includes(id) || mine.some((c) => c.id === id))); } // (forgets only the ones checked and no longer yours; one joined meanwhile stays)
        blocked = new Set(b);
        draw(); if (args.cid) openCom(args.cid); else discover();
      }
      async function discover() { view = { kind: 'discover' }; draw(); found = await F.comPublic(100).catch(() => []); found.sort((a, b) => ms(b.at) - ms(a.at)); if (view.kind === 'discover') drawMain(); }
      function stopCom() { if (off) off(); if (offM) offM(); off = offM = null; posts = []; members = []; com = null; }
      async function openCom(cid) {
        stopCom(); view = { kind: 'com', cid, tab: 'posts' }; filter = 'all'; draw();
        com = await F.comGet(cid).catch(() => null);
        if (!com) { main.innerHTML = ''; main.appendChild(h('div', { class: 'cm-empty' }, h('h2', {}, T('This community isn’t open to you')), h('p', {}, T('It is private, or it no longer exists.')))); return; }
        offM = F.comMembersListen(cid, (l) => { members = l; drawMain(); }, () => { members = []; drawMain(); });
        off = F.comPostsListen(cid, (l) => { posts = l; drawMain(); }, () => { posts = []; drawMain(); });
        drawMain();
      }

      function draw() { drawSide(); drawMain(); }
      function drawSide() {
        side.innerHTML = '';
        if (!me()) { side.appendChild(h('p', { class: 'cm-muted' }, T('Sign in to your PatOS account to join communities.'))); return; }
        const si = (label, on, fn, sub) => h('button', { class: 'cm-si' + (on ? ' on' : ''), onclick: fn }, h('span', {}, label), sub ? h('small', {}, sub) : null);
        side.append(si(T('Discover'), view.kind === 'discover', discover), si(T('My profile'), view.kind === 'profile' && view.uid === me().uid, () => openProfile(me().uid, me().username)),
          h('div', { class: 'cm-sh' }, T('My communities'), h('button', { class: 'cm-add', title: T('New Community'), 'aria-label': T('New Community'), onclick: newCom }, '+')));
        mine.forEach((c) => side.appendChild(si(c.name, view.kind === 'com' && view.cid === c.id, () => openCom(c.id), c.myRole === 'pending' ? T('asked') : c.visibility === 'private' ? T('private') : '')));
        if (!mine.length) side.appendChild(h('p', { class: 'cm-muted' }, T('Join one from Discover, or make your own.')));
      }
      function drawMain() {
        main.innerHTML = '';
        if (!me()) return main.appendChild(h('div', { class: 'cm-empty' }, h('span', { class: 'cm-ic', html: PatOS.iconHTML('commons') }), h('h2', {}, T('PatOS Commons')), h('p', {}, T('Sign in to your PatOS account to join communities.'))));
        if (view.kind === 'discover') return discoverView();
        if (view.kind === 'profile') return profileView();
        if (view.kind === 'com' && com) return comView();
      }

      /* ---------- discover ---------- */
      function discoverView() {
        const q = h('input', { class: 'ui-input', placeholder: T('Search communities'), 'aria-label': T('Search communities'), oninput: () => paint() });
        const list = h('div', { class: 'cm-cards' });
        const paint = () => { list.innerHTML = ''; const w = q.value.trim().toLowerCase(); const l = found.filter((c) => !w || (c.name + ' ' + c.about + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(w));
          l.forEach((c) => list.appendChild(h('button', { class: 'cm-card', onclick: () => openCom(c.id) }, h('b', {}, c.name), h('p', {}, c.about || ''), h('small', {}, (c.tags || []).map((t) => '#' + t).join(' ') + (mine.some((m) => m.id === c.id) ? '  ·  ' + T('joined') : '')))));
          if (!l.length) list.appendChild(h('p', { class: 'cm-muted' }, found.length ? T('Nothing matches.') : T('No public communities yet. Make the first one!'))); };
        main.append(h('div', { class: 'cm-head' }, h('h2', {}, T('Discover')), h('button', { class: 'btn primary', onclick: newCom }, T('New Community'))), q, list); paint();
      }
      async function newCom() {
        const name = h('input', { class: 'ui-input', placeholder: T('Name'), maxlength: 60 }), about = h('textarea', { class: 'ui-input', placeholder: T('What is it about?'), maxlength: 500, rows: 3 }), tags = h('input', { class: 'ui-input', placeholder: T('Tags, separated by commas') });
        const vis = h('select', { class: 'ui-select' }, h('option', { value: 'public' }, T('Public: anyone can find it and join')), h('option', { value: 'private' }, T('Private: people ask, a moderator lets them in')));
        PatOS.ui.sheet(win, { title: T('New Community'), body: h('div', { class: 'cm-form' }, name, about, tags, vis), actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: async () => {
          if (!name.value.trim()) return name.focus();
          const id = await guard(() => F.comCreate(me(), name.value.trim(), about.value.trim(), vis.value, tags.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)));
          if (id) { close(); setJoined(joined().concat([id])); mine.push({ id, name: name.value.trim(), visibility: vis.value, myRole: 'owner' }); openCom(id); }
        } }, T('Create'))] });
        setTimeout(() => name.focus(), 50);
      }

      /* ---------- a community ---------- */
      function comView() {
        const role = myRole(); const cid = com.id;
        const join = role ? (role === 'owner' ? null : h('button', { class: 'btn', onclick: async () => { if (await guard(() => F.comLeave(me(), cid)) !== null) { setJoined(joined().filter((x) => x !== cid)); mine = mine.filter((m) => m.id !== cid); drawSide(); } } }, role === 'pending' ? T('Cancel request') : T('Leave')))
          : h('button', { class: 'btn primary', onclick: async () => { if (await guard(() => F.comJoin(me(), cid, com.visibility === 'public')) !== null) { setJoined(joined().concat([cid])); mine.push({ id: cid, name: com.name, visibility: com.visibility, myRole: com.visibility === 'public' ? 'member' : 'pending' }); drawSide(); } } }, com.visibility === 'public' ? T('Join') : T('Ask to join'));
        const tabs = [['posts', 'Posts'], ['events', 'Events'], ['showcases', 'Showcases'], ['challenges', 'Challenges'], ['members', 'Members']].concat(isMod() ? [['mod', 'Moderation']] : []);
        main.append(h('div', { class: 'cm-head' }, h('h2', {}, com.name), h('span', { class: 'cm-badge' }, T(com.visibility === 'public' ? 'Public' : 'Private')), role ? h('span', { class: 'cm-badge' }, T(role)) : null, join),
          com.about ? h('p', { class: 'cm-about' }, com.about) : null,
          PatOS.ui.segmented(tabs.map(([k, l]) => [k, T(l)]), view.tab, (k) => { view.tab = k; drawMain(); }));
        const body = h('div', { class: 'cm-body' }); main.appendChild(body);
        if (role === 'pending') body.appendChild(h('p', { class: 'cm-muted' }, T('You asked to join. A moderator will let you in.')));
        if (view.tab === 'members') return membersView(body);
        if (view.tab === 'mod') return modView(body);
        const want = { posts: null, events: ['event'], showcases: ['showcase', 'entry'], challenges: ['challenge'] }[view.tab];
        if (isMember()) body.appendChild(composer(want));
        const list = posts.filter((p) => !blocked.has(p.by) && (!want || want.includes(p.kind))).sort((a, b) => (b.kind === 'announcement') - (a.kind === 'announcement') || ms(b.at) - ms(a.at));
        if (view.tab === 'events') list.sort((a, b) => ms(a.eventAt) - ms(b.eventAt));
        list.forEach((p) => body.appendChild(postCard(p)));
        if (!list.length) body.appendChild(h('p', { class: 'cm-muted' }, T('Nothing here yet.')));
      }
      function composer(want, challenge) {
        const kinds = ['post', 'event', 'showcase'].concat(isMod() ? ['announcement', 'challenge'] : []).concat(challenge ? ['entry'] : []);
        const kind = h('select', { class: 'ui-select', 'aria-label': T('Kind') }, ...kinds.map((k) => h('option', { value: k, selected: (challenge ? k === 'entry' : want && want[0] === k) || undefined }, T(KINDS[k]))));
        const title = h('input', { class: 'ui-input', placeholder: T('Title'), maxlength: 120 }), text = h('textarea', { class: 'ui-input', placeholder: T('Write something…'), maxlength: 4000, rows: 3 });
        const date = h('input', { class: 'ui-input', type: 'datetime-local', 'aria-label': T('When') }), place = h('input', { class: 'ui-input', placeholder: T('Where'), maxlength: 120 });
        let attach = null; const attLabel = h('small', { class: 'cm-muted' });
        const share = h('button', { class: 'btn', onclick: (e) => PatOS.menu([
          { label: T('My desktop (look, Dock, widgets)'), action: () => { attach = { kind: 'desk', data: PatOS.desk.exportText(PatOS.desk.capture()) }; attLabel.textContent = T('Desktop') + ' ✓'; } },
          ...(PatOS.gallery ? PatOS.gallery.list().slice(0, 12).map((g) => ({ label: T('Gallery') + ': ' + g.name, action: async () => { const t = await packGallery(g.id); if (t) { attach = { kind: 'gallery', data: t }; attLabel.textContent = T('Gallery') + ' ✓ ' + g.name; } } })) : []),
          ...(PatOS.widgets ? (PatOS.store.get('studioWidgets', []) || []).slice(0, 12).map((w) => ({ label: T('Widget') + ': ' + (w.name || w.id), action: () => { attach = { kind: 'widget', data: JSON.stringify(w) }; attLabel.textContent = T('Widget') + ' ✓ ' + (w.name || ''); } })) : []),
          attach ? { label: T('Share nothing'), action: () => { attach = null; attLabel.textContent = ''; } } : null].filter(Boolean), e.clientX, e.clientY) }, T('Share…'));
        const extra = h('div', { class: 'cm-extra' });
        const showExtra = () => { extra.innerHTML = ''; if (kind.value === 'event') extra.append(date, place); if (kind.value === 'challenge') extra.append(h('label', {}, T('Ends'), ' ', date)); };
        kind.onchange = showExtra; showExtra();
        const send = h('button', { class: 'btn primary', onclick: async () => {
          if (!title.value.trim() && !text.value.trim()) return title.focus();
          const k = kind.value; const at = date.value ? new Date(date.value).getTime() : 0;
          if ((k === 'event' || k === 'challenge') && !at) return date.focus();
          if (attach && attach.data.length > 150000) return PatOS.alertBox(T('Too big to share'), T('Shared things must be under 150 KB.'), { icon: 'commons' });
          send.disabled = true; let id = null;
          try { id = await F.comPost(me(), com.id, { kind: k, title: title.value.trim(), text: text.value.trim(), eventAt: k === 'event' ? at : 0, place: k === 'event' ? place.value.trim() : '', endsAt: k === 'challenge' ? at : 0, challenge: challenge || '', attach: attach && attach.data, attachKind: attach && attach.kind }); }
          catch (e) { // (the server refuses a post that comes too soon after your last one, or one you may no longer make)
            const last = Math.max(0, ...posts.filter((x) => x.by === me().uid).map((x) => ms(x.at)));
            PatOS.alertBox(Date.now() - last < 21000 ? T('Slow down a little') : T('That didn’t work'), Date.now() - last < 21000 ? T('One post every 20 seconds in each community.') : (e.code === 'permission-denied' ? T('PatOS’s server didn’t allow that.') : e.message), { icon: 'commons' }); }
          send.disabled = false;
          if (id) { title.value = text.value = ''; attach = null; attLabel.textContent = ''; }
        } }, T('Post'));
        return h('div', { class: 'cm-compose' }, h('div', { class: 'cm-row' }, kind, title), text, extra, h('div', { class: 'cm-row' }, share, attLabel, h('span', { style: { flex: 1 } }), send));
      }
      async function packGallery(id) {
        PatOS.launch('gallery', { id }); for (let i = 0; i < 40 && !(PatOS.wm.windowsOf('gallery')[0] || {})._gallery; i++) await new Promise((r) => setTimeout(r, 100));
        const g = (PatOS.wm.windowsOf('gallery')[0] || {})._gallery; if (!g) return null; g.open(id); return guard(() => g.packed());
      }
      function postCard(p) {
        const mine2 = me() && p.by === me().uid; const likes = h('small', { class: 'cm-likes' });
        let liked = false, n = 0;
        const likeBtn = h('button', { class: 'btn', disabled: !isMember() || undefined, onclick: async () => { const on = !liked; if (await guard(() => F.comLike(me(), com.id, p.id, on)) !== null) { liked = on; n += on ? 1 : -1; paintLikes(); } } });
        const paintLikes = () => { likeBtn.textContent = (liked ? '♥ ' : '♡ ') + n; };
        F.comLikes(com.id, p.id).then((l) => { n = l.length; liked = l.includes(me().uid); paintLikes(); }).catch(() => paintLikes()); paintLikes();
        const parts = [h('div', { class: 'cm-ph' }, h('span', { class: 'cm-kind k-' + p.kind }, T(KINDS[p.kind] || p.kind)), h('b', {}, p.title || ''), h('span', { style: { flex: 1 } }),
          h('button', { class: 'cm-by', onclick: () => openProfile(p.by, p.byName) }, '@' + p.byName), h('small', { class: 'cm-muted' }, when(p.at)))];
        if (p.text) parts.push(h('p', { class: 'cm-text' }, p.text));
        if (p.kind === 'event' && p.eventAt) parts.push(h('div', { class: 'cm-event' }, '📅 ' + when(p.eventAt) + (p.place ? '  ·  ' + p.place : ''), h('button', { class: 'btn', onclick: () => addToCalendar(p) }, T('Add to Calendar'))));
        if (p.kind === 'challenge' && p.endsAt) { const open = ms(p.endsAt) > Date.now(); parts.push(h('div', { class: 'cm-event' }, (open ? T('Open until') + ' ' : T('Ended') + ' ') + when(p.endsAt), h('small', { class: 'cm-muted' }, posts.filter((x) => x.challenge === p.id).length + ' ' + T('entries')), open && isMember() ? h('button', { class: 'btn', onclick: (e) => { e.currentTarget.replaceWith(composer(null, p.id)); } }, T('Enter')) : null)); }
        if (p.kind === 'entry' && p.challenge) { const c = posts.find((x) => x.id === p.challenge); if (c) parts.push(h('small', { class: 'cm-muted' }, T('For the challenge') + ' “' + c.title + '”')); }
        if (p.attach && ATTACH[p.attachKind]) parts.push(h('div', { class: 'cm-att' }, h('span', {}, '📎 ' + T(ATTACH[p.attachKind])), h('button', { class: 'btn', onclick: () => useAttachment(p) }, T(p.attachKind === 'desk' ? 'Try this desktop' : p.attachKind === 'gallery' ? 'Import the gallery' : 'Add the widget'))));
        parts.push(h('div', { class: 'cm-acts' }, likeBtn, likes,
          h('button', { class: 'btn', 'aria-label': T('More'), onclick: (e) => PatOS.menu([
            !mine2 ? { label: T('Report…'), action: async () => { const r = await PatOS.ask(T('Report this post'), '', { ok: T('Report'), icon: 'commons', placeholder: T('What is wrong with it?') }); if (r != null && await guard(() => F.comReport(me(), com.id, p.id, r || T('No reason given'))) !== null) PatOS.notify({ title: T('Reported'), body: T('The moderators will see it.'), icon: 'commons', priority: 'low' }); } } : null,
            !mine2 ? { label: T('Block @') + p.byName, action: () => blockUser(p.by, p.byName) } : null,
            mine2 || isMod() ? { label: T('Delete'), action: async () => { if (await PatOS.confirmBox(T('Delete this post?'), '', { danger: true })) guard(() => F.comDeletePost(com.id, p.id)); } } : null,
            isMod() && !mine2 ? { label: T('Ban @') + p.byName, action: () => banUser(p.by, p.byName) } : null].filter(Boolean), e.clientX, e.clientY) }, '···')));
        return h('div', { class: 'cm-post' + (p.kind === 'announcement' ? ' ann' : '') }, ...parts);
      }
      function addToCalendar(p) {
        const d = new Date(ms(p.eventAt)); const key = PatOS.dateKey(d); const cal = PatOS.store.get('calendar', {}) || {};
        const ev = { id: 'cm' + p.id, title: p.title || T('Event'), time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), notes: (p.place ? p.place + '\n' : '') + com.name };
        cal[key] = (cal[key] || []).filter((x) => x.id !== ev.id).concat([ev]); PatOS.store.set('calendar', cal); PatOS.emit('calendar');
        PatOS.notify({ title: T('Added to Calendar'), body: ev.title + ' · ' + when(p.eventAt), icon: 'calendar', priority: 'low', open: { app: 'calendar', args: { day: key } } });
      }
      /* something shared: checked by the same code as a file you open would be, and nothing changes before you say so */
      async function useAttachment(p) {
        try {
          if (p.attachKind === 'desk') {
            const { config, warnings } = PatOS.desk.importText(p.attach); const prev = PatOS.desk.apply(config, { preview: true });
            const keep = await PatOS.confirmBox(T('Keep this desktop?'), T('You are seeing @') + p.byName + T('’s desktop.') + (warnings.length ? '\n' + warnings.slice(0, 3).join('\n') : ''), { ok: T('Keep it'), cancel: T('Put mine back') });
            if (!keep) prev.revert(); else PatOS.desk.save(Object.assign({}, config, { name: (p.title || T('Shared desktop')).slice(0, 40) }));
          } else if (p.attachKind === 'gallery') {
            const path = '/Downloads/' + (p.title || 'Shared').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) + '.patgallery'; PatOS.fs.write(path, p.attach); PatOS.openFile(path);
          } else if (p.attachKind === 'widget') {
            const v = PatOS.widgets.validateStudioWidget(JSON.parse(p.attach)); const tid = PatOS.widgets.registerStudio(v); PatOS.widgets.add(tid, { size: 'm' });
            PatOS.notify({ title: T('Widget added'), body: (v.name || '') + ' · ' + T('on your desktop'), icon: 'commons', priority: 'low' });
          }
        } catch (e) { PatOS.alertBox(T('That can’t be used'), e.message || String(e), { icon: 'commons' }); }
      }
      async function blockUser(uid, name) {
        if (!await PatOS.confirmBox(T('Block @') + name + '?', T('You won’t see what they post, and they can’t follow you.'), { ok: T('Block'), danger: true })) return;
        if (await guard(() => F.block(me(), uid, true)) !== null) { blocked.add(uid); drawMain(); }
      }
      async function banUser(uid, name) {
        const why = await PatOS.ask(T('Ban @') + name, '', { ok: T('Ban'), icon: 'commons', placeholder: T('Why?') }); if (why == null) return;
        guard(() => F.comBan(me(), com.id, uid, why));
      }
      function membersView(body) {
        const order = { owner: 0, mod: 1, member: 2, pending: 3 };
        members.slice().sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name)).forEach((m) => {
          const canManage = isMod() && m.role !== 'owner' && m.id !== me().uid && (m.role !== 'mod' || myRole() === 'owner');
          body.appendChild(h('div', { class: 'cm-mem' }, h('button', { class: 'cm-by', onclick: () => openProfile(m.id, m.name) }, '@' + m.name), h('span', { class: 'cm-badge' }, T(m.role)), h('span', { style: { flex: 1 } }),
            canManage && m.role === 'pending' ? h('button', { class: 'btn primary', onclick: () => guard(() => F.comSetRole(com.id, m.id, 'member')) }, T('Let in')) : null,
            canManage && myRole() === 'owner' && m.role === 'member' ? h('button', { class: 'btn', onclick: () => guard(() => F.comSetRole(com.id, m.id, 'mod')) }, T('Make moderator')) : null,
            canManage && myRole() === 'owner' && m.role === 'mod' ? h('button', { class: 'btn', onclick: () => guard(() => F.comSetRole(com.id, m.id, 'member')) }, T('Remove moderator')) : null,
            canManage ? h('button', { class: 'btn', onclick: () => guard(() => F.comRemove(com.id, m.id)) }, m.role === 'pending' ? T('Decline') : T('Remove')) : null));
        });
        if (!members.length) body.appendChild(h('p', { class: 'cm-muted' }, T('Only members see who is in a private community.')));
      }
      async function modView(body) {
        body.appendChild(h('h3', {}, T('Reports')));
        const reps = await F.comReports(com.id).catch(() => []); const bans = await F.comBans(com.id).catch(() => []);
        reps.forEach((r) => { const p = posts.find((x) => x.id === r.pid);
          body.appendChild(h('div', { class: 'cm-mem' }, h('span', {}, (p ? '“' + (p.title || p.text.slice(0, 40)) + '” @' + p.byName : T('A removed post')) + ' — ' + r.reason), h('span', { style: { flex: 1 } }),
            p ? h('button', { class: 'btn', onclick: async () => { await guard(() => F.comDeletePost(com.id, p.id)); await guard(() => F.comReportDone(com.id, r.id)); drawMain(); } }, T('Delete the post')) : null,
            h('button', { class: 'btn', onclick: async () => { await guard(() => F.comReportDone(com.id, r.id)); drawMain(); } }, T('Dismiss')))); });
        if (!reps.length) body.appendChild(h('p', { class: 'cm-muted' }, T('No reports.')));
        body.appendChild(h('h3', {}, T('Banned')));
        bans.forEach((x) => body.appendChild(h('div', { class: 'cm-mem' }, h('span', {}, x.uid.slice(0, 8) + '… — ' + (x.reason || '')), h('span', { style: { flex: 1 } }), h('button', { class: 'btn', onclick: async () => { await guard(() => F.comUnban(com.id, x.uid)); drawMain(); } }, T('Unban')))));
        if (!bans.length) body.appendChild(h('p', { class: 'cm-muted' }, T('Nobody is banned.')));
        if (myRole() === 'owner') body.appendChild(h('div', { class: 'cm-row' }, h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Delete this community?'), T('Every post in it is deleted for everyone.'), { danger: true })) { await guard(() => F.comDelete(com.id)); setJoined(joined().filter((x) => x !== com.id)); mine = mine.filter((m) => m.id !== com.id); stopCom(); discover(); } } }, T('Delete the community'))));
      }

      /* ---------- profiles ---------- */
      async function openProfile(uid, name) {
        stopCom(); view = { kind: 'profile', uid, name, data: null, follows: null }; draw();
        const [p, f] = await Promise.all([F.profileGet(uid).catch(() => null), F.follows(uid).catch(() => ({ following: [], followers: [] }))]);
        if (view.kind === 'profile' && view.uid === uid) { view.data = p; view.follows = f; drawMain(); }
      }
      function profileView() {
        const own = view.uid === me().uid; const f = view.follows || { following: [], followers: [] };
        main.append(h('div', { class: 'cm-head' }, h('span', { class: 'cm-avatar' }, (view.name || '?').charAt(0).toUpperCase()), h('h2', {}, '@' + view.name)),
          h('p', { class: 'cm-muted' }, f.followers.length + ' ' + T('followers') + '  ·  ' + f.following.length + ' ' + T('following')));
        if (own) {
          const bio = h('textarea', { class: 'ui-input', rows: 3, maxlength: 300, placeholder: T('A few words about you') }); bio.value = (view.data && view.data.bio) || '';
          main.append(bio, h('div', { class: 'cm-row' }, h('button', { class: 'btn primary', onclick: async () => { if (await guard(() => F.profileSet(me(), bio.value.trim())) !== null) PatOS.notify({ title: T('Profile saved'), icon: 'commons', priority: 'low' }); } }, T('Save'))),
            h('p', { class: 'cm-fine' }, T('Your profile, posts and the communities you join are seen by other PatOS people. Your files, notes and everything else stay private.')));
        } else {
          const following = f.followers.includes(me().uid);
          main.append(h('p', { class: 'cm-text' }, (view.data && view.data.bio) || T('No bio yet.')),
            h('div', { class: 'cm-row' }, blocked.has(view.uid) ? h('button', { class: 'btn', onclick: async () => { if (await guard(() => F.block(me(), view.uid, false)) !== null) { blocked.delete(view.uid); openProfile(view.uid, view.name); } } }, T('Unblock'))
              : h('button', { class: 'btn primary', onclick: async () => { if (await guard(() => F.follow(me(), view.uid, !following)) !== null) openProfile(view.uid, view.name); } }, following ? T('Unfollow') : T('Follow')),
              !blocked.has(view.uid) ? h('button', { class: 'btn', onclick: () => blockUser(view.uid, view.name).then(() => openProfile(view.uid, view.name)) }, T('Block')) : null));
        }
      }

      let who = me() && me().uid; const onAcc = () => { const now = me() && me().uid; if (now !== who) { who = now; stopCom(); mine = []; start(); } }; PatOS.on('account', onAcc); // (only when someone else signs in: the event also fires for sync news)
      win.on('closed', () => { stopCom(); PatOS.off('account', onAcc); });
      win._commons = { openCom, discover, openProfile, view: () => view, posts: () => posts.slice(), members: () => members.slice(), mine: () => mine.slice(), useAttachment, addToCalendar, composer };
      start();
    },
    onArgs(win, args) { if (args && args.cid && win._commons) win._commons.openCom(args.cid); }
  });
})();
