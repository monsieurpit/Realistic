/* PatOS chat: messages between people with PatOS accounts (the Messages app).
   - Find a person by username and send them a message. The first message is a REQUEST: they see it, but get no notifications
     from you until they accept it. If they decline, you can't message them. They can change their mind later.
   - Every conversation and its whole history is saved in the cloud database (conversations/{id}/messages/{id}), so it is the
     same on all your devices. Messages are not encrypted from the database (the other person has to read them): only the two
     people in a conversation can read it, and nobody can change or delete a message afterwards (see firestore.rules).
   - Notifications arrive while PatOS is open (also in a background tab). With PatOS closed there is no way to reach you.
   - Offline: what you send waits in an outbox saved on the device and goes out when you are back. */
(function () {
  'use strict';
  const T = (s) => PatOS.t(s);
  let typingAt = 0; const seenSent = {};
  /* tells the other person their messages were seen (once per new message, only when the window is looked at) */
  function seen(c) { if (!F || !me || !c || c.status !== 'accepted' || c.lastFromMe || document.hidden || (seenSent[c.id] || 0) >= c.lastAt) return; seenSent[c.id] = c.lastAt; F.markSeen(c.id, me.uid).catch(() => {}); }
  let F = null, me = null, offConv = null, offMsg = null, convs = [], current = null, msgs = [], loaded = false, flushing = false, lastError = '';
  const prev = new Map(); // conversation id -> { at, status } from the last look, to know what is new
  const read = () => PatOS.store.get('msgRead', {});
  const outbox = () => PatOS.store.get('msgOutbox', []);
  const setOutbox = (l) => PatOS.store.set('msgOutbox', l);
  const ms = (x) => (x && x.toMillis ? x.toMillis() : +x || 0);
  const emit = (e) => PatOS.emit(e || 'chat', api.status());
  const newId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* a conversation, as the person sees it */
  function shape(c) {
    const other = c.members.find((u) => u !== me.uid);
    return { id: c.id, other: { uid: other, username: (c.usernames && c.usernames[other]) || '?' }, status: c.status, mine: c.requester === me.uid, last: c.lastMessage || '', lastAt: ms(c.lastMessageAt), lastFromMe: c.lastFrom === me.uid, created: ms(c.createdAt),
      otherSeen: ms(c.seen && c.seen[other]), otherTyping: ms(c.typing && c.typing[other]) };
  }
  const isUnread = (c) => c.status === 'accepted' && !c.lastFromMe && c.lastAt > (read()[c.id] || 0);

  function onConvs(list) {
    const next = list.map(shape);
    if (loaded) next.forEach((c) => {
      const p = prev.get(c.id); const watching = current === c.id && !document.hidden && document.hasFocus();
      if (c.status === 'accepted' && !c.lastFromMe && c.lastAt > ((p && p.at) || 0) && !watching) notify(c, c.last);
      else if (p && p.status === 'pending' && c.status === 'accepted' && c.mine) notify(c, T('accepted your message request'));
    });
    next.forEach((c) => prev.set(c.id, { at: c.lastAt, status: c.status }));
    convs = next.sort((a, b) => b.lastAt - a.lastAt); loaded = true; attach(); emit();
  }
  /* the history of the open conversation, live. It can only be read once the conversation exists (a request is made a moment after
     it is written), so this is tried again whenever the list of conversations changes. */
  function attach() {
    if (offMsg || !current || !F || !convs.some((c) => c.id === current)) return; const cid = current;
    offMsg = F.listenMessages(cid, (l) => { msgs = l; emit('chat:messages'); api.markRead(cid); }, (e) => { if (offMsg) { offMsg(); offMsg = null; } lastError = String(e.message || e); emit(); });
  }
  function notify(c, body) {
    try { PatOS.notify({ title: PatOS.account.isSystem(c.other.uid) ? 'PatOS' : c.other.username, body: String(body).slice(0, 120), icon: 'messages', onClick: () => PatOS.launch('messages', { chat: c.id }) }); if (PatOS.sound && PatOS.sound.pop) PatOS.sound.pop(); } catch (e) {}
  }

  async function start() {
    if (offConv || !PatOS.account || !PatOS.account.signedIn() || !PatOS.account.available()) return;
    try { F = await PatOS.account.cloud(); me = PatOS.account.info(); if (!me) return; } catch (e) { return; }
    loaded = false; prev.clear();
    offConv = F.listenConversations(me.uid, onConvs, (e) => { lastError = String(e.message || e); emit(); });
    flush();
  }
  function stop() { if (offConv) offConv(); if (offMsg) offMsg(); offConv = offMsg = null; convs = []; msgs = []; current = null; loaded = false; me = null; emit(); }

  /* ---------- sending (through an outbox, so nothing is lost offline) ---------- */
  const withTimeout = (p, t) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'offline' })), t || 20000))]);
  async function flush() {
    if (flushing || !F || !me || navigator.onLine === false) return;
    flushing = true;
    try {
      for (const it of outbox()) {
        try {
          if (it.kind === 'request') { await withTimeout(F.requestChat(me, it.other, it.text, it.id, PatOS.account.isSystem())); }
          else await withTimeout(F.sendMessage(it.cid, me, it.text, it.id, it.img));
        } catch (e) {
          if (e && e.code === 'offline') break; // try again later
          let there = false; if (it.kind !== 'request') { try { there = await F.messageExists(it.cid, it.id); } catch (x) {} } // it may have gone through already
          if (!there) { lastError = String(e.message || e); emit('chat:error'); }
        }
        setOutbox(outbox().filter((x) => (x.key || x.id) !== (it.key || it.id))); emit('chat:messages'); // (every first message has the id "request": the key tells them apart)
      }
    } finally { flushing = false; }
  }

  const api = {
    available: () => !!(PatOS.account && PatOS.account.signedIn()),
    ready: () => !!me,
    me: () => me,
    conversations: () => convs.filter((c) => c.status === 'accepted' || (c.status === 'pending' && c.mine)).map((c) => Object.assign({ unread: isUnread(c) }, c)),
    requests: () => convs.filter((c) => c.status === 'pending' && !c.mine),
    declined: () => convs.filter((c) => c.status === 'declined' && !c.mine),
    unread: () => convs.filter(isUnread).length + convs.filter((c) => c.status === 'pending' && !c.mine).length,
    find: (id) => convs.find((c) => c.id === id) || null,
    messages: () => msgs.map((m) => ({ id: m.id, mine: m.from === (me && me.uid), text: m.text, img: typeof m.img === 'string' && m.img.startsWith('data:image/') ? m.img : '', reactions: m.reactions || {}, t: m.t || ms(m.at), sending: false }))
      .concat(outbox().filter((o) => o.cid === current || (o.kind === 'request' && current === F.convId(me.uid, o.other.uid))).filter((o) => !msgs.some((m) => m.id === o.id)).map((o) => ({ id: o.id, mine: true, text: o.text, img: o.img || '', reactions: {}, t: o.t, sending: true }))).sort((a, b) => a.t - b.t),
    outbox: () => outbox().length,
    status: () => ({ signedIn: !!(PatOS.account && PatOS.account.signedIn()), ready: !!me, unread: convs.filter(isUnread).length + convs.filter((c) => c.status === 'pending' && !c.mine).length, outbox: outbox().length }),
    error: () => lastError,
    async search(prefix) { if (!F) await start(); if (!F) return []; const r = await F.search(prefix, 8); return r.filter((u) => u.uid !== me.uid).map((u) => Object.assign({ cid: F.convId(me.uid, u.uid), conv: convs.find((c) => c.other.uid === u.uid) || null }, u)); },
    /* look at one conversation: its history comes live */
    open(cid) {
      if (offMsg) offMsg(); offMsg = null; current = cid; msgs = []; attach();
      api.markRead(cid); emit('chat:messages');
    },
    close() { api.open(null); },
    markRead(cid) { if (!cid) return; const c = convs.find((x) => x.id === cid); seen(c); const r = read(); const at = Math.max(Date.now(), c ? c.lastAt : 0); if ((r[cid] || 0) < at - 1000 || !r[cid]) { r[cid] = at; PatOS.store.set('msgRead', r); emit(); } },
    /* a first message to someone: they can accept or decline it */
    async request(other, text) {
      if (!F) await start(); text = String(text || '').trim(); if (!text) return; if (!me) throw new Error(T('Sign in first.'));
      const cid = F.convId(me.uid, other.uid); const c = convs.find((x) => x.id === cid);
      if (c && c.status === 'accepted') return api.send(cid, text);
      // the system account doesn't wait: a waiting or declined conversation opens at once
      if (c && PatOS.account.isSystem()) { await F.open(cid); c.status = 'accepted'; return api.send(cid, text); }
      if (c && c.status === 'declined' && c.mine) throw new Error(T('This person did not accept your message request.'));
      if (c) throw new Error(T('Your message request is waiting for an answer.'));
      setOutbox(outbox().concat([{ kind: 'request', id: 'request', key: newId(), cid, other: { uid: other.uid, username: other.username }, text: text.slice(0, 2000), t: Date.now() }])); emit('chat:messages'); flush(); return cid;
    },
    send(cid, text, img) {
      text = String(text || '').trim(); if (!text && !img) return; const c = convs.find((x) => x.id === cid);
      if (!c || c.status !== 'accepted') throw new Error(c && c.status === 'pending' ? T('Your message request is waiting for an answer.') : T('You can’t message this person right now.'));
      setOutbox(outbox().concat([{ kind: 'msg', id: newId(), cid, text: text.slice(0, 2000), img: img || undefined, t: Date.now() }])); emit('chat:messages'); flush();
    },
    /* a reaction to a message: the same emoji again removes it */
    async react(cid, mid, emoji) {
      if (!F || !me) return; const m = msgs.find((x) => x.id === mid); const cur = m && m.reactions && m.reactions[me.uid];
      const next = cur === emoji ? null : emoji;
      if (m) { m.reactions = Object.assign({}, m.reactions); if (next) m.reactions[me.uid] = next; else delete m.reactions[me.uid]; emit('chat:messages'); } // shown at once
      await F.react(cid, mid, me.uid, next);
    },
    /* "typing…": at most every 4 seconds */
    typing(cid) { const c = convs.find((x) => x.id === cid); if (!F || !me || !c || c.status !== 'accepted' || Date.now() - typingAt < 4000) return; typingAt = Date.now(); F.typing(cid, me.uid).catch(() => {}); },
    async respond(cid, accept) { if (!F) await start(); await F.respond(cid, !!accept); },
    /* ---------- the system account (PatOS) ---------- */
    isSystem: () => PatOS.account.isSystem(),
    /* every account, with its conversation and whether it is banned (the system account only) */
    async everyone() {
      if (!F) await start(); if (!F || !PatOS.account.isSystem()) return [];
      const [all, bans] = await Promise.all([F.allUsers(), F.bans()]); const banned = new Map(bans.map((b) => [b.uid, b]));
      return all.filter((u) => u.uid !== me.uid).map((u) => Object.assign({ cid: F.convId(me.uid, u.uid), conv: convs.find((c) => c.other.uid === u.uid) || null, ban: banned.get(u.uid) || null }, u)).sort((a, b) => a.username.localeCompare(b.username));
    },
    async banOf(uid) { if (!F) await start(); return (await F.bans()).find((b) => b.uid === uid) || null; },
    async ban(other, reason) { if (!F) await start(); if (!PatOS.account.isSystem()) throw new Error(T('Only the PatOS account can do this.')); await F.ban(me, other.uid, other.username, reason); emit(); },
    /* an announcement everyone sees once (empty text removes it) */
    async announce(text) { if (!F) await start(); if (!PatOS.account.isSystem()) throw new Error(T('Only the PatOS account can do this.')); text = String(text || '').trim(); if (text) await F.announce(me, text); else await F.clearAnnouncement(); },
    /* the same message to every account (not the banned ones); returns how many */
    async messageEveryone(text) {
      if (!PatOS.account.isSystem()) throw new Error(T('Only the PatOS account can do this.')); text = String(text || '').trim(); if (!text) return 0;
      const all = (await api.everyone()).filter((u) => !u.ban); let n = 0; for (const u of all) { try { await api.request(u, text); n++; } catch (e) { /* one account that fails doesn't stop the others */ } } return n;
    },
    /* a verified badge for an account (or removed) */
    async verify(other, on) { if (!F) await start(); if (!PatOS.account.isSystem()) throw new Error(T('Only the PatOS account can do this.')); await F.verify(me, other.uid, on); const l = PatOS.store.get('verifiedUids', []).filter((x) => x !== other.uid); if (on) l.push(other.uid); PatOS.store.set('verifiedUids', l); emit(); },
    async unban(other) { if (!F) await start(); if (!PatOS.account.isSystem()) throw new Error(T('Only the PatOS account can do this.')); await F.unban(other.uid); emit(); },
    retry: flush
  };
  PatOS.chat = api;

  PatOS.on('chat:account', () => { if (PatOS.account.signedIn()) start(); else stop(); });
  addEventListener('online', () => flush());
  setInterval(() => { if (me) flush(); }, 20000);
  if (PatOS.account && PatOS.account.signedIn() && PatOS.account.available()) setTimeout(start, 2500);
})();
