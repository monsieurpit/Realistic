/* PatOS Commons (4.0): communities of PatOS people. Public ones anyone can find and join; private ones need a moderator's yes.
   Home (what's new in your communities), Discover, a page for each community (posts, events, showcases, challenges,
   members, moderation) and profiles.
   Posts, announcements (moderators), events (add them to your Calendar), showcases (share a desktop, a gallery or a widget
   made in Studio: data only, never code, and checked again by PatOS before anything is used), challenges (moderators) and
   their entries. Profiles, follows, blocks, likes, reports.
   The server decides (firestore.rules): who reads what, roles, the posting rate limit (one post per 20 s per community), bans,
   reports only moderators read, nobody follows someone who blocked them. PatOS hides what people you blocked post. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.commons = { bg: 'linear-gradient(160deg,#34c759,#0a84ff)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="20" r="8" fill="#fff"/><circle cx="16" cy="30" r="6" fill="#fff" opacity=".8"/><circle cx="48" cy="30" r="6" fill="#fff" opacity=".8"/><path d="M18 52c1-9 7-14 14-14s13 5 14 14z" fill="#fff"/><path d="M4 50c1-6 5-10 12-10 3 0 5 1 7 2-3 2-5 5-6 8z M60 50c-1-6-5-10-12-10-3 0-5 1-7 2 3 2 5 5 6 8z" fill="#fff" opacity=".8"/></svg>' };
  const I = {
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
    compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    clip: '<svg viewBox="0 0 24 24"><path d="M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
    desk: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    gallery: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/></svg>',
    widget: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>'
  };
  const ic = (k, cls) => h('span', { class: 'cm-i' + (cls ? ' ' + cls : ''), html: I[k] });
  const ms = (t) => (!t ? 0 : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : +t);
  const when = (t) => new Date(ms(t)).toLocaleString(PatOS.locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  // "3 min ago", "yesterday", "Nov 3"
  function ago(t) {
    const s = (Date.now() - ms(t)) / 1000; const fr = PatOS.lang === 'fr';
    if (s < 60) return fr ? 'à l’instant' : 'just now';
    if (s < 3600) return (fr ? 'il y a ' : '') + Math.floor(s / 60) + (fr ? ' min' : ' min ago');
    if (s < 86400) return (fr ? 'il y a ' : '') + Math.floor(s / 3600) + (fr ? ' h' : ' h ago');
    if (s < 172800) return fr ? 'hier' : 'yesterday';
    return new Date(ms(t)).toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' });
  }
  function until(t) { const d = (ms(t) - Date.now()) / 864e5; const fr = PatOS.lang === 'fr'; if (d < 0) return T('Ended'); if (d < 1) { const hh = Math.max(1, Math.round(d * 24)); return fr ? 'encore ' + hh + ' h' : hh + ' h left'; } const n = Math.round(d); return fr ? 'encore ' + n + ' jour' + (n > 1 ? 's' : '') : n + ' day' + (n > 1 ? 's' : '') + ' left'; }
  // a colour that belongs to a name (communities and people keep theirs)
  const hue = (s) => { let x = 0; for (const c of String(s || '')) x = (x * 31 + c.charCodeAt(0)) % 360; return x; };
  const avatar = (name, cls) => h('span', { class: 'cm-av' + (cls ? ' ' + cls : ''), style: { '--h': hue(name) }, 'aria-hidden': 'true' }, String(name || '?').replace(/^@/, '').charAt(0).toUpperCase()); // (a flat, muted colour that belongs to the name)
  const KINDS = { post: 'Post', announcement: 'Announcement', event: 'Event', showcase: 'Showcase', challenge: 'Challenge', entry: 'Entry' };
  const ROLE = { owner: 'Owner', mod: 'Moderator', member: 'Member', pending: 'Asked to join' };
  const ATTACH = { desk: ['Desktop', 'desk', 'A whole desktop: look, Dock and widgets', 'Try this desktop'], gallery: ['Gallery', 'gallery', 'Pictures and notes, arranged', 'Import the gallery'], widget: ['Widget', 'widget', 'A widget made in Studio', 'Add the widget'] };
  const JOINED = 'commonsJoined';
  const joined = () => PatOS.store.get(JOINED, []) || [];
  const setJoined = (l) => PatOS.store.set(JOINED, [...new Set(l)].slice(0, 50));

  PatOS.registerApp({
    id: 'commons', name: 'PatOS Commons', icon: 'commons', width: 1120, height: 720, minWidth: 420, minHeight: 400, category: 'Apps', keywords: 'commons community communities social posts events showcase challenge follow communauté',
    about: 'Communities of PatOS people: posts, events, showcases and challenges.',
    launch(win, args) {
      let F = null; const me = () => (PatOS.account && PatOS.account.signedIn() ? (() => { const i = PatOS.account.info(); return { uid: i.uid, username: i.username }; })() : null);
      let view = { kind: 'home' }, mine = [], found = [], blocked = new Set(), offs = [], posts = [], members = [], com = null, tagFilter = '';
      const homePosts = new Map(); // community id → its posts (Home)
      const keep = { composer: null, key: '', entries: new Map() };
      const side = h('nav', { class: 'cm-side ui-side', 'aria-label': T('Commons') }), main = h('div', { class: 'cm-main' });
      win.body.appendChild(h('div', { class: 'cm' }, side, main));
      const msg = (e) => (e && e.code === 'permission-denied') ? T('PatOS’s server didn’t allow that.') : (e && e.message) || String(e);
      const guard = async (fn) => { try { return await fn(); } catch (e) { PatOS.alertBox(T('That didn’t work'), msg(e), { icon: 'commons' }); return null; } };
      const myRole = () => { const m = me() && members.find((x) => x.id === me().uid); return m ? m.role : ''; };
      const isMod = () => ['owner', 'mod'].includes(myRole());
      const isMember = () => ['owner', 'mod', 'member'].includes(myRole());
      const stop = () => { offs.forEach((o) => o && o()); offs = []; };

      async function start() {
        if (!me()) return draw();
        try { F = F || await PatOS.account.cloud(); } catch (e) { F = null; return draw(); }
        const asked = joined();
        const [m, b] = await Promise.all([F.comMany(me(), asked).catch(() => null), F.blocked(me()).catch(() => [])]);
        if (m) { const meanwhile = mine.filter((c) => !m.some((x) => x.id === c.id)); mine = m.filter((c) => c.myRole).concat(meanwhile); setJoined(joined().filter((id) => !asked.includes(id) || mine.some((c) => c.id === id))); } // (forgets only the ones checked and no longer yours; one joined meanwhile stays)
        blocked = new Set(b);
        if (args.cid) openCom(args.cid); else if (mine.length) home(); else discover();
      }

      /* ---------- the sidebar (PatOS.ui: the same as every other app) ---------- */
      function drawSide() {
        side.innerHTML = '';
        if (!me()) return;
        const item = (label, on, fn, lead, tail) => h('button', { class: 'cm-si' + (on ? ' on' : ''), 'aria-current': on ? 'page' : null, onclick: fn }, lead, h('span', { class: 'cm-sl' }, label), tail || null);
        side.append(
          item(T('Home'), view.kind === 'home', home, ic('home')),
          item(T('Discover'), view.kind === 'discover', discover, ic('compass')),
          h('h4', { class: 'ui-sh cm-shead' }, h('span', {}, T('Communities')), h('button', { class: 'cm-sadd', title: T('New Community'), 'aria-label': T('New Community'), onclick: newCom, html: I.plus })));
        mine.forEach((c) => side.appendChild(item(c.name, view.kind === 'com' && view.cid === c.id, () => openCom(c.id), avatar(c.name, 'av-xs sq'),
          c.myRole === 'pending' ? h('small', {}, T('asked')) : c.visibility === 'private' ? ic('lock', 'cm-faint') : null)));
        if (!mine.length) side.appendChild(h('p', { class: 'cm-sidehint' }, T('Join one from Discover, or make your own.')));
        side.appendChild(h('div', { class: 'cm-sfill' }));
        side.appendChild(item('@' + me().username, view.kind === 'profile' && view.uid === me().uid, () => openProfile(me().uid, me().username), avatar(me().username, 'av-xs')));
      }
      function draw() { drawSide(); drawMain(); }
      function drawMain() {
        const top = main.scrollTop; main.innerHTML = '';
        if (!me()) return main.appendChild(PatOS.ui.empty({ title: 'PatOS Commons', text: 'Sign in to your PatOS account to join communities.' }));
        ({ home: homeView, discover: discoverView, com: comView, profile: profileView })[view.kind]();
        main.scrollTop = top; // (a new post or like doesn't jump you back to the top)
      }
      const page = (...kids) => { const p = h('div', { class: 'cm-page' }, ...kids); main.appendChild(p); return p; };
      const empty = (title, text, action) => PatOS.ui.empty({ title, text, action });
      const head = (title, sub, ...right) => h('header', { class: 'cm-head' }, h('div', { class: 'cm-htxt' }, h('h1', {}, title), sub ? h('p', {}, sub) : null), ...right.filter(Boolean));
      const dateTile = (t) => { const d = new Date(ms(t)); return h('span', { class: 'cm-date', 'aria-hidden': 'true' }, h('small', {}, d.toLocaleDateString(PatOS.locale, { month: 'short' }).replace('.', '')), h('b', {}, String(d.getDate()))); };

      /* ---------- Home: what's new in your communities ---------- */
      function home() {
        stop(); view = { kind: 'home' }; homePosts.clear(); main.scrollTop = 0; draw();
        mine.filter((c) => c.myRole && c.myRole !== 'pending').slice(0, 8).forEach((c) => offs.push(F.comPostsListen(c.id, (l) => { homePosts.set(c.id, l.map((p) => Object.assign({ cid: c.id, cname: c.name }, p))); if (view.kind === 'home') drawMain(); }, () => {})));
      }
      function homeView() {
        const all = [...homePosts.values()].flat().filter((p) => !blocked.has(p.by)).sort((a, b) => ms(b.at) - ms(a.at)).slice(0, 60);
        const p = page(head(T('Home'), T('What’s new in your communities.')));
        if (!mine.some((c) => c.myRole && c.myRole !== 'pending')) { p.appendChild(empty('Nothing here yet', 'Join communities to see their posts here.', ['Discover communities', discover])); return; }
        const upcoming = all.filter((x) => x.kind === 'event' && ms(x.eventAt) > Date.now()).sort((a, b) => ms(a.eventAt) - ms(b.eventAt)).slice(0, 3);
        if (upcoming.length) p.append(h('h3', { class: 'ui-section' }, T('Coming up')), PatOS.ui.group(upcoming.map((e) => h('button', { class: 'ui-row link cm-evrow', onclick: () => openCom(e.cid, 'events') }, dateTile(e.eventAt), h('span', { class: 'ui-row-l' }, h('span', {}, e.title), h('small', {}, e.cname + ' · ' + when(e.eventAt))), h('span', { 'aria-hidden': 'true' }, '›')))));
        if (!all.length) { p.appendChild(empty('All quiet', 'No posts in your communities yet. Say hello!')); return; }
        p.appendChild(h('h3', { class: 'ui-section' }, T('Latest')));
        p.appendChild(h('div', { class: 'cm-feed' }, ...all.map((x) => postRow(x, { showCom: true }))));
      }

      /* ---------- Discover ---------- */
      async function discover() { stop(); view = { kind: 'discover' }; main.scrollTop = 0; draw(); found = await F.comPublic(100).catch(() => []); found.sort((a, b) => ms(b.at) - ms(a.at)); if (view.kind === 'discover') drawMain(); }
      function discoverView() {
        const list = h('div', { class: 'ui-group cm-dlist' });
        const search = PatOS.ui.search({ placeholder: 'Search communities', onInput: (v) => paint(v) });
        const tags = [...new Set(found.flatMap((c) => c.tags || []))].slice(0, 6);
        const seg = tags.length ? PatOS.ui.segmented([['', T('All')], ...tags.map((t) => [t, '#' + t])], tagFilter, (v) => { tagFilter = v; paint(search.querySelector('input').value); }) : null;
        const paint = (q) => {
          list.innerHTML = ''; const w = String(q || '').trim().toLowerCase();
          const l = found.filter((c) => (!tagFilter || (c.tags || []).includes(tagFilter)) && (!w || (c.name + ' ' + c.about + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(w)));
          l.forEach((c) => list.appendChild(comRow(c)));
          list.hidden = !l.length; emptyBox.innerHTML = ''; if (!l.length) emptyBox.appendChild(found.length ? empty('Nothing matches.', '') : empty('No public communities yet', 'Make the first one!', ['New Community', newCom]));
        };
        const emptyBox = h('div', {});
        page(head(T('Discover'), T('Find communities of PatOS people, or start your own.'), h('button', { class: 'btn primary', onclick: newCom }, T('New Community'))),
          h('div', { class: 'cm-tools' }, search, seg), list, emptyBox);
        paint('');
      }
      function comRow(c) {
        const mineC = mine.find((m) => m.id === c.id);
        return h('div', { class: 'ui-row cm-crow', role: 'button', tabindex: 0, 'data-cid': c.id, onclick: () => openCom(c.id), onkeydown: (e) => { if (e.key === 'Enter') openCom(c.id); } },
          avatar(c.name, 'av-md sq'),
          h('span', { class: 'ui-row-l' }, h('span', { class: 'cm-cname' }, c.name, c.visibility === 'private' ? ic('lock', 'cm-faint') : null), h('small', {}, c.about || T('No description yet.')),
            (c.tags || []).length ? h('small', { class: 'cm-tags' }, (c.tags || []).slice(0, 3).map((t) => '#' + t).join('  ')) : null),
          mineC ? h('small', { class: 'cm-faint' }, mineC.myRole === 'pending' ? T('Asked') : T('Joined'))
            : h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); joinCom(c); } }, c.visibility === 'public' ? T('Join') : T('Ask to join')));
      }
      async function joinCom(c) {
        if (await guard(() => F.comJoin(me(), c.id, c.visibility === 'public')) === null) return;
        setJoined(joined().concat([c.id])); mine.push({ id: c.id, name: c.name, visibility: c.visibility, myRole: c.visibility === 'public' ? 'member' : 'pending' });
        drawSide(); drawMain();
      }
      async function newCom() {
        const name = h('input', { class: 'field', placeholder: T('Name'), maxlength: 60, 'aria-label': T('Name') }), about = h('textarea', { class: 'field cm-ta', placeholder: T('What is it about?'), maxlength: 500, rows: 3, 'aria-label': T('What is it about?') }), tags = h('input', { class: 'field', placeholder: T('Tags, separated by commas'), 'aria-label': T('Tags') });
        let vis = 'public'; const hint = h('small', { class: 'cm-faint' }, T('Anyone can find it and join.'));
        const seg = PatOS.ui.segmented([['public', T('Public')], ['private', T('Private')]], vis, (v) => { vis = v; hint.textContent = T(v === 'public' ? 'Anyone can find it and join.' : 'People ask, a moderator lets them in.'); });
        PatOS.ui.sheet(win, { title: T('New Community'), body: h('div', { class: 'cm-form' }, name, about, tags, seg, hint), actions: (close) => [h('button', { class: 'btn', onclick: close }, T('Cancel')), h('button', { class: 'btn primary', onclick: async () => {
          if (!name.value.trim()) return name.focus();
          const id = await guard(() => F.comCreate(me(), name.value.trim(), about.value.trim(), vis, tags.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)));
          if (id) { close(); setJoined(joined().concat([id])); mine.push({ id, name: name.value.trim(), visibility: vis, myRole: 'owner' }); openCom(id); }
        } }, T('Create'))] });
        setTimeout(() => name.focus(), 50);
      }

      /* ---------- a community ---------- */
      async function openCom(cid, tab) {
        stop(); view = { kind: 'com', cid, tab: tab || 'posts' }; posts = []; members = []; com = null; keep.composer = null; keep.entries.clear(); main.scrollTop = 0; draw();
        com = await F.comGet(cid).catch(() => null);
        if (view.cid !== cid) return;
        if (!com) { main.innerHTML = ''; page(empty('This community isn’t open to you', 'It is private, or it no longer exists.', ['Discover', discover])); return; }
        offs.push(F.comMembersListen(cid, (l) => {
          members = l;
          // the server's member list is the truth: if you are in it, PatOS remembers the community (joined here, or on another device)
          const meIn = me() && l.find((m) => m.id === me().uid);
          if (meIn && com && !mine.some((c) => c.id === cid)) { mine.push({ id: cid, name: com.name, visibility: com.visibility, myRole: meIn.role }); drawSide(); }
          if (meIn && !joined().includes(cid)) setJoined(joined().concat([cid]));
          const mc = mine.find((c) => c.id === cid); if (mc && meIn && mc.myRole !== meIn.role) { mc.myRole = meIn.role; drawSide(); }
          drawMain();
        }, () => { members = []; drawMain(); }));
        offs.push(F.comPostsListen(cid, (l) => { posts = l; drawMain(); }, () => { posts = []; drawMain(); }));
        drawMain();
      }
      function comView() {
        if (!com) return page(h('p', { class: 'cm-faint cm-loading' }, T('Loading…')));
        const role = myRole(); const cid = com.id; const count = members.filter((m) => m.role !== 'pending').length;
        const action = !role ? h('button', { class: 'btn primary', onclick: () => joinCom(com) }, com.visibility === 'public' ? T('Join') : T('Ask to join'))
          : role === 'owner' ? null
          : h('button', { class: 'btn', onclick: async () => { if (role !== 'pending' && !await PatOS.confirmBox(T('Leave') + ' ' + com.name + '?', '', { ok: T('Leave') })) return; if (await guard(() => F.comLeave(me(), cid)) !== null) { setJoined(joined().filter((x) => x !== cid)); mine = mine.filter((m) => m.id !== cid); drawSide(); } } }, role === 'pending' ? T('Cancel request') : T('Leave'));
        const meta = [T(com.visibility === 'private' ? 'Private' : 'Public'), count + ' ' + T(count === 1 ? 'member' : 'members')].concat(role && role !== 'pending' ? [T(ROLE[role])] : []).join(' · ');
        const tabs = [['posts', 'Posts'], ['events', 'Events'], ['showcases', 'Showcases'], ['challenges', 'Challenges'], ['members', 'Members']].concat(isMod() ? [['mod', 'Moderation']] : []);
        const p = h('div', { class: 'cm-page wide' }); main.appendChild(p);
        p.appendChild(h('header', { class: 'cm-head com' }, avatar(com.name, 'av-lg sq'), h('div', { class: 'cm-htxt' }, h('h1', {}, com.name), h('p', {}, meta)), action));
        p.appendChild(h('div', { class: 'cm-tabsrow' }, PatOS.ui.segmented(tabs.map(([k, l]) => [k, T(l) + (k === 'members' && isMod() && members.some((m) => m.role === 'pending') ? ' •' : '')]), view.tab, (k) => { view.tab = k; drawMain(); })));
        const cols = h('div', { class: 'cm-cols' }); const feed = h('div', { class: 'cm-col' }); cols.append(feed, rail()); p.appendChild(cols);
        if (role === 'pending') feed.appendChild(h('p', { class: 'cm-note' }, T('You asked to join. A moderator will let you in.')));
        if (view.tab === 'members') return membersView(feed);
        if (view.tab === 'mod') return modView(feed);
        const want = { posts: null, events: ['event'], showcases: ['showcase', 'entry'], challenges: ['challenge'] }[view.tab];
        // the same composer is kept while you stay on this tab: new posts and likes coming in redraw the page, never what you are writing
        if (isMember()) { const key = cid + ':' + view.tab + ':' + isMod(); if (!keep.composer || keep.key !== key) { keep.composer = composer(want && want[0]); keep.key = key; } feed.appendChild(keep.composer); }
        let list = posts.filter((x) => !blocked.has(x.by) && (!want || want.includes(x.kind)));
        list = view.tab === 'events' ? list.sort((a, b) => ms(a.eventAt) - ms(b.eventAt)) : list.sort((a, b) => (b.kind === 'announcement') - (a.kind === 'announcement') || ms(b.at) - ms(a.at));
        if (list.length) feed.appendChild(h('div', { class: 'cm-feed' }, ...list.map((x) => postRow(x))));
        else feed.appendChild(empty('Nothing here yet.', isMember() ? 'Be the first to post.' : !role ? 'Join to post.' : ''));
      }
      // the column on the right: about, who's in it, what's coming
      function rail() {
        const up = posts.filter((x) => x.kind === 'event' && ms(x.eventAt) > Date.now()).sort((a, b) => ms(a.eventAt) - ms(b.eventAt)).slice(0, 3);
        const open = posts.filter((x) => x.kind === 'challenge' && ms(x.endsAt) > Date.now()).slice(0, 2);
        const people = members.filter((m) => m.role !== 'pending');
        return h('aside', { class: 'cm-rail' },
          h('h3', { class: 'ui-section' }, T('About')), h('p', { class: 'cm-about' }, com.about || T('No description yet.')),
          (com.tags || []).length ? h('p', { class: 'cm-tags' }, com.tags.map((t) => '#' + t).join('  ')) : null,
          people.length ? h('h3', { class: 'ui-section' }, T('Members') + ' · ' + people.length) : null,
          people.length ? h('div', { class: 'cm-faces' }, ...people.slice(0, 16).map((m) => h('button', { class: 'cm-face', title: '@' + m.name, 'aria-label': '@' + m.name, onclick: () => openProfile(m.id, m.name) }, avatar(m.name, 'av-xs')))) : null,
          up.length ? h('h3', { class: 'ui-section' }, T('Coming up')) : null,
          ...up.map((e) => h('div', { class: 'cm-railrow' }, dateTile(e.eventAt), h('span', {}, h('b', {}, e.title), h('small', {}, when(e.eventAt))))),
          open.length ? h('h3', { class: 'ui-section' }, T('Open challenges')) : null,
          ...open.map((c) => h('div', { class: 'cm-railrow' }, ic('trophy', 'cm-faint'), h('span', {}, h('b', {}, c.title), h('small', {}, until(c.endsAt))))));
      }

      /* ---------- writing a post ---------- */
      function composer(kind0, challenge) {
        let kind = challenge ? 'entry' : kind0 || 'post', attach = null;
        const kinds = challenge ? ['entry'] : ['post', 'event', 'showcase'].concat(isMod() ? ['announcement', 'challenge'] : []);
        const box = h('div', { class: 'cm-compose' + (challenge || kind0 ? ' open' : '') });
        const title = h('input', { class: 'field cm-ctitle', maxlength: 120, 'aria-label': T('Title') });
        const text = h('textarea', { class: 'field cm-ta', placeholder: T('Write something…'), maxlength: 4000, rows: 3, 'aria-label': T('Write something…') });
        const date = h('input', { class: 'field', type: 'datetime-local', 'aria-label': T('When') }), place = h('input', { class: 'field', placeholder: T('Where'), maxlength: 120, 'aria-label': T('Where') });
        const extra = h('div', { class: 'cm-extra' }); const attEl = h('div', { class: 'cm-attpick' });
        const seg = kinds.length > 1 ? PatOS.ui.segmented(kinds.map((k) => [k, T(KINDS[k])]), kind, (k) => { kind = k; paintExtra(); }) : null;
        if (seg) seg.classList.add('cm-kinds');
        const paintExtra = () => { extra.innerHTML = ''; if (kind === 'event') extra.append(date, place); if (kind === 'challenge') extra.append(h('label', { class: 'cm-lab' }, T('Ends'), date)); title.placeholder = kind === 'post' ? T('Title (optional)') : T('Title'); send.textContent = T(kind === 'entry' ? 'Enter' : 'Post'); };
        const paintAtt = () => { attEl.innerHTML = ''; if (!attach) return; const a = ATTACH[attach.kind]; attEl.appendChild(h('div', { class: 'cm-attchip' }, ic(a[1]), h('span', {}, T(a[0]) + (attach.label ? ': ' + attach.label : '')), h('button', { class: 'cm-x', 'aria-label': T('Share nothing'), onclick: () => { attach = null; paintAtt(); } }, '×'))); };
        const pick = (e) => PatOS.menu([
          { label: T('My desktop (look, Dock, widgets)'), action: () => { attach = { kind: 'desk', data: PatOS.desk.exportText(PatOS.desk.capture()) }; paintAtt(); } },
          ...(PatOS.gallery ? PatOS.gallery.list().slice(0, 12).map((g) => ({ label: T('Gallery') + ': ' + g.name, action: async () => { const t = await packGallery(g.id); if (t) { attach = { kind: 'gallery', data: t, label: g.name }; paintAtt(); } } })) : []),
          ...((PatOS.store.get('studioWidgets', []) || []).slice(0, 12).map((w) => ({ label: T('Widget') + ': ' + (w.name || w.id), action: () => { attach = { kind: 'widget', data: JSON.stringify(w), label: w.name || '' }; paintAtt(); } })))], e.clientX, e.clientY);
        const send = h('button', { class: 'btn primary cm-send', onclick: async () => {
          if (!title.value.trim() && !text.value.trim()) return text.focus();
          const at = date.value ? new Date(date.value).getTime() : 0;
          if ((kind === 'event' || kind === 'challenge') && !at) return date.focus();
          if (attach && attach.data.length > 150000) return PatOS.alertBox(T('Too big to share'), T('Shared things must be under 150 KB.'), { icon: 'commons' });
          send.disabled = true; let id = null;
          try { id = await F.comPost(me(), com.id, { kind, title: title.value.trim(), text: text.value.trim(), eventAt: kind === 'event' ? at : 0, place: kind === 'event' ? place.value.trim() : '', endsAt: kind === 'challenge' ? at : 0, challenge: challenge || '', attach: attach && attach.data, attachKind: attach && attach.kind }); }
          catch (e) { // (the server refuses a post that comes too soon after your last one, or one you may no longer make)
            const last = Math.max(0, ...posts.filter((x) => x.by === me().uid).map((x) => ms(x.at)));
            const fast = Date.now() - last < 21000;
            PatOS.alertBox(fast ? T('Slow down a little') : T('That didn’t work'), fast ? T('One post every 20 seconds in each community.') : msg(e), { icon: 'commons' }); }
          send.disabled = false;
          if (id) { title.value = text.value = ''; attach = null; paintAtt(); if (!challenge) box.classList.remove('open'); else { keep.entries.delete(challenge); box.remove(); } }
        } });
        const opener = h('button', { class: 'cm-opener field', onclick: () => { box.classList.add('open'); setTimeout(() => text.focus(), 30); } }, T('Write a post…'));
        box.append(opener, h('div', { class: 'cm-cform' }, seg, title, text, extra, attEl,
          h('div', { class: 'cm-cfoot' }, h('button', { class: 'btn cm-share', onclick: pick }, T('Share…')), h('span', { class: 'cm-grow' }),
            challenge ? null : h('button', { class: 'btn', onclick: () => box.classList.remove('open') }, T('Cancel')), send)));
        paintExtra();
        return box;
      }
      async function packGallery(id) {
        PatOS.launch('gallery', { id }); for (let i = 0; i < 40 && !(PatOS.wm.windowsOf('gallery')[0] || {})._gallery; i++) await new Promise((r) => setTimeout(r, 100));
        const g = (PatOS.wm.windowsOf('gallery')[0] || {})._gallery; if (!g) return null; g.open(id); return guard(() => g.packed());
      }

      /* ---------- a post ---------- */
      function postRow(p, opts) {
        opts = opts || {};
        const cid = p.cid || (com && com.id); const mineP = me() && p.by === me().uid; const canMod = !opts.showCom && isMod();
        let liked = false, n = 0;
        const likeBtn = h('button', { class: 'cm-act like', 'aria-label': T('Like'), 'aria-pressed': 'false', disabled: (!opts.showCom && !isMember()) || undefined, onclick: async () => { const on = !liked; if (await guard(() => F.comLike(me(), cid, p.id, on)) !== null) { liked = on; n += on ? 1 : -1; paintLikes(); } } }, ic('heart'), h('span', {}));
        const paintLikes = () => { likeBtn.classList.toggle('on', liked); likeBtn.setAttribute('aria-pressed', String(liked)); likeBtn.lastChild.textContent = n ? String(n) : ''; };
        F.comLikes(cid, p.id).then((l) => { n = l.length; liked = l.includes(me().uid); paintLikes(); }).catch(() => paintLikes()); paintLikes();
        const body = h('div', { class: 'cm-pbody' });
        body.appendChild(h('div', { class: 'cm-pmeta' }, h('button', { class: 'cm-name', onclick: () => openProfile(p.by, p.byName) }, '@' + p.byName),
          opts.showCom ? h('span', { class: 'cm-faint' }, T('in')) : null, opts.showCom ? h('button', { class: 'cm-name com', onclick: () => openCom(p.cid) }, p.cname) : null,
          h('span', { class: 'cm-faint', title: when(p.at) }, '· ' + ago(p.at)),
          p.kind === 'announcement' ? h('span', { class: 'cm-pinned' }, ic('pin'), T('Pinned post')) : p.kind !== 'post' ? PatOS.ui.badge(T(KINDS[p.kind] || p.kind)) : null));
        if (p.title) body.appendChild(h('h3', { class: 'cm-ptitle' }, p.title));
        if (p.text) body.appendChild(h('p', { class: 'cm-text' }, p.text));
        if (p.kind === 'event' && p.eventAt) body.appendChild(h('div', { class: 'cm-inset' }, dateTile(p.eventAt), h('span', { class: 'cm-insett' }, h('b', {}, when(p.eventAt)), p.place ? h('small', {}, p.place) : null), h('button', { class: 'btn', onclick: () => addToCalendar(p) }, T('Add to Calendar'))));
        if (p.kind === 'challenge' && p.endsAt) { const open = ms(p.endsAt) > Date.now(); const entries = posts.filter((x) => x.challenge === p.id).length; const holder = h('div', {});
          body.appendChild(h('div', { class: 'cm-inset' }, ic('trophy', 'cm-faint big'), h('span', { class: 'cm-insett' }, h('b', {}, open ? until(p.endsAt) : T('Ended')), h('small', {}, entries + ' ' + T(entries === 1 ? 'entry' : 'entries'))),
            open && isMember() && !opts.showCom && !keep.entries.has(p.id) ? h('button', { class: 'btn', onclick: (e) => { e.currentTarget.remove(); const c = composer(null, p.id); keep.entries.set(p.id, c); holder.appendChild(c); } }, T('Enter')) : null));
          if (keep.entries.has(p.id)) holder.appendChild(keep.entries.get(p.id)); // (an entry being written survives the page being redrawn)
          body.appendChild(holder); }
        if (p.kind === 'entry' && p.challenge) { const c = posts.find((x) => x.id === p.challenge); if (c) body.appendChild(h('small', { class: 'cm-faint' }, T('For the challenge') + ' “' + c.title + '”')); }
        if (p.attach && ATTACH[p.attachKind]) { const a = ATTACH[p.attachKind];
          body.appendChild(h('div', { class: 'cm-inset' }, ic(a[1], 'cm-faint big'), h('span', { class: 'cm-insett' }, h('b', {}, T(a[0])), h('small', {}, T(a[2]))), h('button', { class: 'btn', onclick: () => useAttachment(p) }, T(a[3])))); }
        body.appendChild(h('div', { class: 'cm-pacts' }, likeBtn,
          h('button', { class: 'cm-act', 'aria-label': T('More'), title: T('More'), onclick: (e) => PatOS.menu([
            !mineP ? { label: T('Report…'), action: () => report(cid, p) } : null,
            !mineP ? { label: T('Block @') + p.byName, action: () => blockUser(p.by, p.byName) } : null,
            mineP || canMod ? { label: T('Delete'), action: async () => { if (await PatOS.confirmBox(T('Delete this post?'), '', { danger: true })) guard(() => F.comDeletePost(cid, p.id)); } } : null,
            canMod && !mineP ? { divider: true } : null,
            canMod && !mineP ? { label: T('Ban @') + p.byName, action: () => banUser(p.by, p.byName) } : null].filter(Boolean), e.clientX, e.clientY), html: I.more })));
        return h('article', { class: 'cm-post', 'data-id': p.id, 'data-kind': p.kind }, h('button', { class: 'cm-pav', onclick: () => openProfile(p.by, p.byName), 'aria-label': '@' + p.byName }, avatar(p.byName, 'av-md')), body);
      }
      async function report(cid, p) {
        const r = await PatOS.ask(T('Report this post'), '', { ok: T('Report'), icon: 'commons', placeholder: T('What is wrong with it?') });
        if (r != null && await guard(() => F.comReport(me(), cid, p.id, r || T('No reason given'))) !== null) PatOS.notify({ title: T('Reported'), body: T('The moderators will see it.'), icon: 'commons', priority: 'low' });
      }
      function addToCalendar(p) {
        const d = new Date(ms(p.eventAt)); const key = PatOS.dateKey(d); const cal = PatOS.store.get('calendar', {}) || {};
        const ev = { id: 'cm' + p.id, title: p.title || T('Event'), time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), notes: (p.place ? p.place + '\n' : '') + (p.cname || (com && com.name) || '') };
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

      /* ---------- members and moderation ---------- */
      function membersView(feed) {
        const order = { owner: 0, mod: 1, member: 2, pending: 3 };
        const pend = members.filter((m) => m.role === 'pending');
        const row = (m) => {
          const canManage = isMod() && m.role !== 'owner' && m.id !== me().uid && (m.role !== 'mod' || myRole() === 'owner');
          return h('div', { class: 'ui-row cm-mrow' }, h('button', { class: 'cm-pav', onclick: () => openProfile(m.id, m.name), 'aria-label': '@' + m.name }, avatar(m.name, 'av-sm')),
            h('span', { class: 'ui-row-l' }, h('span', {}, '@' + m.name), h('small', {}, T(ROLE[m.role]))),
            canManage && m.role === 'pending' ? h('button', { class: 'btn primary', onclick: () => guard(() => F.comSetRole(com.id, m.id, 'member')) }, T('Let in')) : null,
            canManage && myRole() === 'owner' && m.role === 'member' ? h('button', { class: 'btn', onclick: () => guard(() => F.comSetRole(com.id, m.id, 'mod')) }, T('Make moderator')) : null,
            canManage && myRole() === 'owner' && m.role === 'mod' ? h('button', { class: 'btn', onclick: () => guard(() => F.comSetRole(com.id, m.id, 'member')) }, T('Remove moderator')) : null,
            canManage ? h('button', { class: 'btn', onclick: () => guard(() => F.comRemove(com.id, m.id)) }, m.role === 'pending' ? T('Decline') : T('Remove')) : null);
        };
        if (pend.length && isMod()) feed.append(h('h3', { class: 'ui-section' }, T('Waiting to join') + ' · ' + pend.length), PatOS.ui.group(pend.map(row)));
        const rest = members.filter((m) => m.role !== 'pending').sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
        if (rest.length) feed.append(h('h3', { class: 'ui-section' }, T('Members') + ' · ' + rest.length), PatOS.ui.group(rest.map(row)));
        else feed.appendChild(empty('Members', 'Only members see who is in a private community.'));
      }
      async function modView(feed) {
        const box = h('div', {}, h('p', { class: 'cm-faint cm-loading' }, T('Loading…'))); feed.appendChild(box);
        const [reps, bans] = await Promise.all([F.comReports(com.id).catch(() => []), F.comBans(com.id).catch(() => [])]);
        box.innerHTML = '';
        box.append(h('h3', { class: 'ui-section' }, T('Reports') + ' · ' + reps.length));
        box.appendChild(reps.length ? PatOS.ui.group(reps.map((r) => { const p = posts.find((x) => x.id === r.pid);
          return h('div', { class: 'ui-row cm-mrow' }, h('span', { class: 'ui-row-l' }, h('span', {}, p ? (p.title || p.text.slice(0, 60)) : T('A removed post')), h('small', {}, (p ? '@' + p.byName + ' · ' : '') + '“' + r.reason + '”')),
            p ? h('button', { class: 'btn', onclick: async () => { await guard(() => F.comDeletePost(com.id, p.id)); await guard(() => F.comReportDone(com.id, r.id)); drawMain(); } }, T('Delete the post')) : null,
            h('button', { class: 'btn', onclick: async () => { await guard(() => F.comReportDone(com.id, r.id)); drawMain(); } }, T('Dismiss'))); })) : h('p', { class: 'cm-faint' }, T('No reports.')));
        box.append(h('h3', { class: 'ui-section' }, T('Banned') + ' · ' + bans.length));
        box.appendChild(bans.length ? PatOS.ui.group(bans.map((x) => h('div', { class: 'ui-row cm-mrow' }, h('span', { class: 'ui-row-l' }, h('span', {}, x.uid.slice(0, 10) + '…'), h('small', {}, x.reason || '')), h('button', { class: 'btn', onclick: async () => { await guard(() => F.comUnban(com.id, x.uid)); drawMain(); } }, T('Unban'))))) : h('p', { class: 'cm-faint' }, T('Nobody is banned.')));
        if (myRole() === 'owner') box.append(h('h3', { class: 'ui-section' }, T('Community')), PatOS.ui.group([h('div', { class: 'ui-row cm-mrow' }, h('span', { class: 'ui-row-l' }, h('span', {}, T('Delete the community')), h('small', {}, T('Every post in it is deleted for everyone.'))),
          h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Delete this community?'), T('Every post in it is deleted for everyone.'), { danger: true })) { await guard(() => F.comDelete(com.id)); setJoined(joined().filter((x) => x !== com.id)); mine = mine.filter((m) => m.id !== com.id); stop(); discover(); } } }, T('Delete')))]));
      }

      /* ---------- profiles ---------- */
      async function openProfile(uid, name) {
        stop(); view = { kind: 'profile', uid, name, data: null, follows: null }; main.scrollTop = 0; draw();
        const [p, f] = await Promise.all([F.profileGet(uid).catch(() => null), F.follows(uid).catch(() => ({ following: [], followers: [] }))]);
        if (view.kind === 'profile' && view.uid === uid) { view.data = p; view.follows = f; drawMain(); }
      }
      function profileView() {
        const own = view.uid === me().uid; const f = view.follows || { following: [], followers: [] }; const follows = f.followers.includes(me().uid);
        const btns = own ? null : h('div', { class: 'cm-hbtns' }, blocked.has(view.uid) ? h('button', { class: 'btn', onclick: async () => { if (await guard(() => F.block(me(), view.uid, false)) !== null) { blocked.delete(view.uid); openProfile(view.uid, view.name); } } }, T('Unblock'))
          : h('button', { class: 'btn' + (follows ? '' : ' primary'), onclick: async () => { if (await guard(() => F.follow(me(), view.uid, !follows)) !== null) openProfile(view.uid, view.name); } }, follows ? T('Unfollow') : T('Follow')),
          !blocked.has(view.uid) ? h('button', { class: 'btn', onclick: () => blockUser(view.uid, view.name).then(() => openProfile(view.uid, view.name)) }, T('Block')) : null);
        const p = page(h('header', { class: 'cm-head com' }, avatar(view.name, 'av-lg'), h('div', { class: 'cm-htxt' }, h('h1', {}, '@' + view.name), h('p', {}, f.followers.length + ' ' + T('followers') + ' · ' + f.following.length + ' ' + T('following'))), btns));
        if (own) {
          const bio = h('textarea', { class: 'field cm-ta', rows: 3, maxlength: 300, placeholder: T('A few words about you'), 'aria-label': T('Bio') }); bio.value = (view.data && view.data.bio) || '';
          p.append(h('h3', { class: 'ui-section' }, T('Bio')), bio, h('div', { class: 'cm-cfoot' }, h('small', { class: 'cm-faint' }, T('Your profile, posts and the communities you join are seen by other PatOS people. Your files, notes and everything else stay private.')), h('span', { class: 'cm-grow' }),
            h('button', { class: 'btn primary', onclick: async () => { if (await guard(() => F.profileSet(me(), bio.value.trim())) !== null) PatOS.notify({ title: T('Profile saved'), icon: 'commons', priority: 'low' }); } }, T('Save'))));
          p.append(h('h3', { class: 'ui-section' }, T('Communities')), mine.length ? PatOS.ui.group(mine.map((c) => h('button', { class: 'ui-row link cm-mrow', onclick: () => openCom(c.id) }, avatar(c.name, 'av-sm sq'), h('span', { class: 'ui-row-l' }, h('span', {}, c.name), h('small', {}, T(ROLE[c.myRole] || ''))), h('span', { 'aria-hidden': 'true' }, '›')))) : h('p', { class: 'cm-faint' }, T('Join one from Discover, or make your own.')));
        } else p.append(h('h3', { class: 'ui-section' }, T('Bio')), h('p', { class: 'cm-text' }, (view.data && view.data.bio) || T('No bio yet.')));
      }

      let who = me() && me().uid; const onAcc = () => { const now = me() && me().uid; if (now !== who) { who = now; stop(); mine = []; start(); } }; PatOS.on('account', onAcc); // (only when someone else signs in: the event also fires for sync news)
      win.on('closed', () => { stop(); PatOS.off('account', onAcc); });
      win._commons = { openCom, discover, home, openProfile, view: () => view, posts: () => posts.slice(), members: () => members.slice(), mine: () => mine.slice(), useAttachment, addToCalendar };
      draw(); start();
    },
    onArgs(win, args) { if (args && args.cid && win._commons) win._commons.openCom(args.cid); }
  });
})();
