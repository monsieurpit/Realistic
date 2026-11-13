/* Shared Spaces (3.3): workspaces you share with other PatOS accounts. The server (firestore.rules) decides what each person
   may do from the role stored in the space (owner, admin, editor, commenter, viewer); the app only shows it.
   - A file of a space is opened as a copy on this device, in /Spaces/<space>/, with the app that fits it (Docs, Sheets,
     Slides, TextEdit). Saving the copy sends it back with the revision it was based on. If someone saved in between, nothing
     is overwritten: your version is kept as "name (your version)" in the space, and you are told.
   - Offline, saves wait in a list kept on this device and go out when the internet is back (a Live Activity while they do).
   - Spaces are stored in PatOS's cloud so that their members can read them: unlike your own files (encrypted with your
     password), they are not end-to-end encrypted. Settings and the Spaces app say so. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  let F = null, me = null, spaces = [], invites = [], offS = null, offI = null, seenInv = new Set(PatOS.store.get('spacesSeenInv', []));
  let pending = PatOS.store.get('spacesPending', []) || [];
  let links = PatOS.store.get('spacesLinks', {}) || {}; // local copy path -> { sid, fid, rev, name }
  const saveP = () => PatOS.store.set('spacesPending', pending), saveL = () => PatOS.store.set('spacesLinks', links);
  const emit = () => PatOS.emit('spaces');
  const ROLE_CAN = { owner: 5, admin: 4, editor: 3, commenter: 2, viewer: 1 };
  const can = (sp, what) => { const r = sp && sp.members && me ? sp.members[me.uid] : ''; const lvl = ROLE_CAN[r] || 0; return what === 'edit' ? lvl >= 3 : what === 'comment' ? lvl >= 2 : what === 'admin' ? lvl >= 4 : what === 'owner' ? lvl === 5 : lvl >= 1; };

  async function start() {
    if (!PatOS.account || !PatOS.account.signedIn() || offS) return;
    try { F = await PatOS.account.cloud(); } catch (e) { return; }
    const i = PatOS.account.info(); me = { uid: i.uid, username: i.username };
    offS = F.spacesListen(me.uid, (l) => { spaces = l.sort((a, b) => String(a.name).localeCompare(String(b.name))); emit(); }, () => {});
    offI = F.invitesListen(me.uid, (l) => {
      invites = l; emit();
      l.filter((x) => !seenInv.has(x.id)).forEach((x) => { seenInv.add(x.id); PatOS.notify({ title: T('Invitation to a space'), body: x.byName + ' · ' + x.spaceName + ' (' + T(x.role) + ')', icon: 'spaces', priority: 'high', open: { app: 'spaces' },
        actions: [{ label: T('Accept'), run: () => api.accept(x) }, { label: T('Decline'), run: () => api.decline(x) }] }); });
      PatOS.store.set('spacesSeenInv', [...seenInv].slice(-100));
    }, () => {});
    flush();
  }
  function stop() { if (offS) offS(); if (offI) offI(); offS = offI = null; spaces = []; invites = []; me = null; emit(); }

  /* ---------- saving, with the revision it was based on ---------- */
  async function save(sid, fid, content, baseRev, name) {
    if (!F || !me) return { queued: false, ok: false, message: T('Sign in to use Shared Spaces.') };
    if (navigator.onLine === false) { pending = pending.filter((p) => !(p.sid === sid && p.fid === fid)); pending.push({ sid, fid, content, baseRev, name, t: Date.now() }); saveP(); emit(); return { queued: true }; }
    const r = await F.fileSave(me, sid, fid, content, baseRev);
    if (r.conflict) {
      const copy = await F.fileCreate(me, sid, (name || T('File')).replace(/(\.[a-z0-9]+)?$/i, (m) => ' (' + T('your version') + ')' + m), kindOf(name), content);
      PatOS.notify({ title: T('Someone saved first'), body: (r.by ? r.by + ' · ' : '') + T('Your version was kept as a copy in the space.'), icon: 'spaces', priority: 'high', open: { app: 'spaces', args: { sid } } });
      return { conflict: true, copy, theirs: r.theirs, rev: r.rev };
    }
    if (r.locked) { PatOS.notify({ title: T('This file is being edited'), body: (r.by || '') + ' · ' + T('Try again in a few minutes.'), icon: 'spaces' }); return r; }
    return r;
  }
  async function flush() {
    if (!F || !me || !pending.length || navigator.onLine === false) return;
    const job = PatOS.live.start({ app: 'spaces', title: T('Sending changes to Shared Spaces'), progress: 0 });
    const all = pending.slice(); let i = 0, failed = 0;
    for (const p of all) {
      try { const r = await save(p.sid, p.fid, p.content, p.baseRev, p.name); if (r.ok || r.conflict) { pending = pending.filter((x) => x !== p); const l = Object.values(links).find((x) => x.sid === p.sid && x.fid === p.fid); if (l && r.rev) l.rev = r.rev; } else failed++; }
      catch (e) { failed++; }
      job.update({ progress: ++i / all.length }); saveP(); saveL();
    }
    emit(); job.end(failed ? 'failed' : 'done', failed ? failed + ' ' + T('changes are waiting') : '');
  }
  window.addEventListener('online', () => setTimeout(flush, 1500));

  /* ---------- a file of a space, opened as a copy on this device ---------- */
  const kindOf = (name) => (/\.pdoc$/i.test(name) ? 'doc' : /\.psheet$/i.test(name) ? 'sheet' : /\.pslides$/i.test(name) ? 'slides' : /\.md$/i.test(name) ? 'note' : 'text');
  const safe = (s) => String(s).replace(/[\/\\:*?"<>|]/g, '-').slice(0, 60) || 'Space';
  function openFile(sp, f) {
    const dir = '/Spaces/' + safe(sp.name); ['/Spaces', dir].forEach((d) => { if (!PatOS.fs.exists(d)) PatOS.fs.mkdir(d); });
    const path = dir + '/' + safe(f.name);
    const had = links[path]; const localNewer = had && had.fid === f.id && PatOS.fs.exists(path) && pending.some((p) => p.fid === f.id);
    if (!localNewer) { links[path] = { sid: sp.id, fid: f.id, rev: f.rev, name: f.name, writing: true }; PatOS.fs.write(path, f.content || ''); links[path].writing = false; saveL(); }
    PatOS.openFile(path); return path;
  }
  // a copy that changes on this device is saved back (a moment after the last change)
  const timers = {};
  PatOS.on('fs', () => {
    Object.keys(links).forEach((path) => {
      const l = links[path]; if (l.writing || !PatOS.fs.exists(path)) return;
      const c = PatOS.fs.read(path); if (typeof c !== 'string' || c === l.last) return;
      clearTimeout(timers[path]); timers[path] = setTimeout(async () => {
        l.last = c; const r = await save(l.sid, l.fid, c, l.rev, l.name).catch((e) => ({ ok: false, message: e.message }));
        if (r.ok) { l.rev = r.rev; saveL(); } else if (r.conflict) { delete links[path]; saveL(); }
      }, 1200);
    });
  });

  const api = {
    ready: () => !!(F && me),
    me: () => me,
    list: () => spaces.slice(), invites: () => invites.slice(), pending: () => pending.slice(), get: (sid) => spaces.find((s) => s.id === sid) || null,
    roleOf: (sp) => (sp && me && sp.members ? sp.members[me.uid] || '' : ''), can,
    summary: () => (!me ? T('Not signed in') : spaces.length + ' ' + T(spaces.length === 1 ? 'space' : 'spaces') + (invites.length ? ' · ' + invites.length + ' ' + T(invites.length === 1 ? 'invitation' : 'invitations') : '') + (pending.length ? ' · ' + pending.length + ' ' + T('waiting') : '')),
    create: (name) => F.spaceCreate(me, String(name || '').trim() || T('New Space')),
    invite: (sp, username, role) => F.spaceInvite(me, sp.id, sp.name, String(username || '').trim().replace(/^@/, '').toLowerCase(), role),
    accept: (inv) => F.inviteAccept(me, inv), decline: (inv) => F.inviteDecline(me, inv),
    setRole: (sp, uid, role) => F.spaceSetRole(me, sp.id, uid, role),
    remove: (sp, uid) => F.spaceRemove(me, sp.id, uid), leave: (sp) => F.spaceRemove(me, sp.id, me.uid),
    rename: (sp, name) => F.spaceRename(sp.id, name), del: (sp) => F.spaceDelete(sp.id),
    files: (sp, cb) => F.filesListen(sp.id, cb, () => {}), comments: (sp, cb) => F.commentsListen(sp.id, cb, () => {}), activity: (sp, cb) => F.activityListen(sp.id, cb, () => {}),
    addFile: (sp, name, content) => F.fileCreate(me, sp.id, name, kindOf(name), content),
    addFromPiles: (sp, path) => { const c = PatOS.fs.read(path); if (typeof c !== 'string' || c.startsWith('data:') || c.length > 200000) throw new Error(T('Only text files and PatOS documents under 200 KB can be shared for now.')); return F.fileCreate(me, sp.id, PatOS.fs.basename(path), kindOf(path), c); },
    save, flush, openFile, revs: (sp, f) => F.fileRevs(sp.id, f.id),
    lock: (sp, f, on) => F.fileLock(me, sp.id, f.id, on), delFile: (sp, f) => F.fileDelete(me, sp.id, f.id, f.name),
    comment: (sp, f, text) => F.commentAdd(me, sp.id, f ? f.id : '', text), delComment: (sp, c) => F.commentDelete(sp.id, c.id),
    start, stop
  };
  PatOS.spaces = api;
  PatOS.on('chat:account', () => { if (PatOS.account.signedIn()) start(); else stop(); });
  setTimeout(start, 2500);
  // "Add to a Space" for files (Universal Actions)
  if (PatOS.actions) PatOS.actions.register({ id: 'spaces.add', app: 'spaces', title: 'Add to a Space', order: 35, accepts: (o) => !!o.path && /\.(txt|md|pdoc|psheet|pslides|csv|json|html|css|js)$/i.test(o.path) && api.ready() && spaces.some((s) => can(s, 'edit')),
    run: (o) => { PatOS.launch('spaces', { addPath: o.path }); } }); // (the Spaces app asks which space)
})();
