/* Messages (4.1): chat with people who have a PatOS account (see js/chat.js). Find a username, send a request, they accept,
   then talk. Messages are grouped by sender, with replies, reactions, photos, voice messages, game challenges, links, and
   (your own, in their first 15 minutes) edits and unsending. Chats can be pinned, muted and searched.
   Pat, the command helper, is not here: it lives in the top bar (js/pat.js). */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const sym = (n) => PatOS.sym(n);
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  const clock = (t) => { const d = new Date(t), now = new Date(); const hm = d.toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }); return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' }) + ' ' + hm; };
  /* when, in the list of chats: the time today, the day this week, the date before */
  const when = (t) => { if (!t) return ''; const d = new Date(t), now = new Date(); if (sameDay(t, now)) return d.toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }); if (now - d < 6 * 864e5) return d.toLocaleDateString(PatOS.locale, { weekday: 'short' }); return d.toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' }); };
  const dur = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  /* words, with web addresses that open in PatOS's browser */
  const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
  function linkify(text) {
    const out = document.createDocumentFragment(); let last = 0; String(text).replace(URL_RE, (u, i) => { if (i > last) out.append(text.slice(last, i)); const a = h('a', { class: 'm2-link', href: u, target: '_blank', rel: 'noopener noreferrer' }, u); a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (PatOS.apps.browser) PatOS.launch('browser', { url: u }); else window.open(u, '_blank', 'noopener'); }); out.append(a); last = i + u.length; return u; });
    if (last < text.length) out.append(text.slice(last)); return out;
  }
  const REACT = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
  const EMO = ['😀', '😂', '🥹', '😍', '😎', '🤔', '😭', '😡', '👍', '👎', '👏', '🙏', '❤️', '🔥', '🎉', '✨', '💀', '😴', '🤯', '🥳', '👀', '💯', '✅', '❌'];

  PatOS.registerApp({
    id: 'messages', name: 'Messages', icon: 'messages', width: 920, height: 640, minWidth: 340, minHeight: 380, keywords: 'chat messages friends people users username request text voice reply',
    about: 'Message people with a PatOS account: find them by username, and they accept your request first. Pat, the command helper, is the button in the top bar.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const C = PatOS.chat, A = PatOS.account;
      const who = h('span', { class: 'm2-who' });
      win.toolbar.append(h('div', { style: { flex: 1 } }), who); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px'; win.toolbar.style.gap = '8px';
      const side = h('div', { class: 'm2-side' }), main = h('div', { class: 'm2-main' });
      const root = h('div', { class: 'm2' }, side, main); win.body.appendChild(root);
      let query = '', results = null, cur = null /* a conversation id */, target = null /* someone new */, searchTimer = null, listEl = null;
      let replyTo = null, editing = null, find = null; // (the composer: answering a message, fixing one; searching this chat)
      const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'messages' });
      const fail = (e) => msg(T('That didn’t work'), String((e && e.message) || e));
      const isSys = (uid) => A && A.isSystem(uid);
      const av = (name, uid, cls) => isSys(uid) ? h('div', { class: 'msg-av sys' + (cls ? ' ' + cls : '') }, 'P') : (() => { const el = h('div', { class: 'msg-av' + (cls ? ' ' + cls : '') }, (name || '?').charAt(0).toUpperCase()); let x = 0; for (const ch of String(name)) x = (x * 31 + ch.charCodeAt(0)) % 360; el.style.setProperty('--h', x); return el; })();
      // a person's name: "PatOS" with the system badge for the system account, @name for everyone else
      const nameEl = (uid, username, tag) => h(tag || 'b', { class: 'm2-name', translate: 'no' }, A.display(uid, username), isSys(uid) ? PatOS.systemBadge(14) : A.isVerified(uid) ? PatOS.systemBadge(14, 'verified') : null);
      let everyone = null, everyoneAt = 0; // the system account: every account
      const loadEveryone = async (force) => { if (!C.isSystem() || (!force && everyone && Date.now() - everyoneAt < 30000)) return; everyoneAt = Date.now(); try { everyone = await C.everyone(); } catch (e) { everyone = everyone || []; } drawList(); };
      const signedIn = () => A && A.signedIn();

      /* ================= the left side: search, requests, chats ================= */
      function row(u, sub, opts) {
        opts = opts || {};
        const b = h('div', { class: 'm2-row' + (opts.on ? ' on' : '') + (opts.unread ? ' unread' : ''), role: 'button', tabindex: '0', 'aria-current': opts.on ? 'true' : null, onclick: opts.onClick },
          av(u.username, u.uid),
          h('div', { class: 'm2-rt' },
            h('div', { class: 'm2-r1' }, nameEl(u.uid, u.username), opts.time ? h('small', { class: 'm2-time' }, opts.time) : null),
            h('div', { class: 'm2-r2' }, h('small', { translate: 'no' }, sub || ''), opts.muted ? h('span', { class: 'm2-ic', html: sym('bellOff'), title: T('Muted') }) : null, opts.unread ? h('span', { class: 'm2-dot', 'aria-label': T('Unread') }) : null, opts.badge || null)));
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter') opts.onClick(); });
        if (opts.menu) b.addEventListener('contextmenu', (e) => { e.preventDefault(); PatOS.menu(opts.menu(), e.clientX, e.clientY); });
        return b;
      }
      function drawSide() {
        const keep = side.querySelector('.m2-search'); const had = document.activeElement === keep; const val = keep ? keep.value : query;
        side.innerHTML = '';
        if (!signedIn()) return;
        side.appendChild(h('div', { class: 'm2-top' }, h('h2', {}, T('Messages')), h('button', { class: 'm2-ibtn', title: T('New Message'), 'aria-label': T('New Message'), html: sym('pencil'), onclick: () => { const s = side.querySelector('.m2-search'); s && s.focus(); } })));
        const search = h('input', { class: 'field m2-search', type: 'search', placeholder: T('Search or find a person'), spellcheck: 'false', autocapitalize: 'none', autocomplete: 'off', 'aria-label': T('Search or find a person') }); search.value = val;
        search.addEventListener('input', () => { query = search.value.trim(); clearTimeout(searchTimer); if (!query) { results = null; drawList(); return; } drawList(); searchTimer = setTimeout(async () => { const q = query; try { const r = await C.search(q.replace(/^@/, '')); if (q === query) { results = r; drawList(); } } catch (e) { results = []; drawList(); } }, 250); });
        side.appendChild(h('div', { class: 'm2-sh' }, search)); const nb = notifBar(); if (nb) side.appendChild(nb); listEl = h('div', { class: 'm2-list' }); side.appendChild(listEl); drawList();
        if (had) { search.focus(); search.setSelectionRange(val.length, val.length); }
      }
      /* notifications on this device, so new messages arrive when PatOS isn't in front */
      function notifBar() {
        const st = C.notifState ? C.notifState() : 'on'; const hide = PatOS.store.get('msgNotifHide', '');
        if (st === 'on' || st === 'unsupported' || hide === st) return null;
        const close = h('button', { class: 'm2-nb-x', 'aria-label': T('Close'), onclick: () => { PatOS.store.set('msgNotifHide', st); drawSide(); } }, '×');
        const text = { ask: T('Get notified of new messages.'), off: T('Message notifications are off.'), denied: T('Notifications are blocked in your browser’s settings.'), homescreen: T('To get notifications, add PatOS to your Home Screen.') }[st];
        const btn = st === 'ask' || st === 'off' ? h('button', { class: 'btn small primary', onclick: async () => {
          if (st === 'off') { PatOS.setSetting('mutedApps', (PatOS.settings.mutedApps || []).filter((x) => x !== 'messages')); const r = Object.assign({}, PatOS.settings.notifRules || {}); if (r.messages) { r.messages = Object.assign({}, r.messages, { allow: true }); PatOS.setSetting('notifRules', r); } }
          await C.enableNotifications(); drawSide(); } }, T('Turn On')) : null;
        return h('div', { class: 'm2-nb', role: 'status' }, h('span', { class: 'm2-nb-t' }, text), btn, close);
      }
      const chatMenu = (c) => () => [
        { label: T(C.pinned().includes(c.id) ? 'Unpin Conversation' : 'Pin Conversation'), action: () => C.pin(c.id, !C.pinned().includes(c.id)) },
        { label: T(C.muted().includes(c.id) ? 'Unmute Conversation' : 'Mute Conversation'), action: () => C.mute(c.id, !C.muted().includes(c.id)) }
      ];
      const preview = (c) => c.status === 'pending' ? (c.mine ? T('Waiting for them to accept') : T('Wants to message you')) : (c.lastFromMe ? T('You') + ': ' : '') + c.last;
      function convRow(c) { return row(c.other, preview(c), { on: cur === c.id, unread: c.unread, time: when(c.lastAt), muted: C.muted().includes(c.id), onClick: () => openConv(c.id), menu: c.status === 'accepted' ? chatMenu(c) : null }); }
      function drawList() {
        if (!listEl) return; listEl.innerHTML = '';
        const head = (t) => listEl.appendChild(h('div', { class: 'm2-h' }, T(t)));
        if (query) {
          const q = query.replace(/^@/, '').toLowerCase();
          const mine = C.conversations().filter((c) => c.other.username.toLowerCase().includes(q) || (c.last || '').toLowerCase().includes(q));
          if (mine.length) { head('Chats'); mine.forEach((c) => listEl.appendChild(convRow(c))); }
          const people = (results || []).filter((u) => !(u.conv && mine.some((c) => c.id === u.conv.id)));
          head('People');
          if (!results) { listEl.appendChild(h('div', { class: 'm2-empty' }, T('Searching…'))); return; }
          if (!people.length) listEl.appendChild(h('div', { class: 'm2-empty' }, mine.length ? T('No one else with that username.') : T('Nobody with that username. Check the spelling.')));
          people.forEach((u) => listEl.appendChild(row(u, u.conv ? (u.conv.status === 'accepted' ? T('Open the chat') : u.conv.status === 'pending' ? (u.conv.mine ? T('Request sent') : T('Wants to message you')) : T('Declined')) : T('Send a message request'), { onClick: () => { query = ''; results = null; if (u.conv) { openConv(u.conv.id); return; } target = u; cur = null; C.close(); drawSide(); drawMain(); win.el.classList.add('m2-chat'); } })));
          return;
        }
        const reqs = C.requests(), convs = C.conversations(), declined = C.declined(); const pins = C.pinned();
        if (reqs.length) { head('Requests'); reqs.forEach((c) => listEl.appendChild(row(c.other, c.last, { on: cur === c.id, unread: true, time: when(c.lastAt), onClick: () => openConv(c.id) }))); }
        const pinned = pins.map((id) => convs.find((c) => c.id === id)).filter(Boolean);
        if (pinned.length) { head('Pinned'); pinned.forEach((c) => listEl.appendChild(convRow(c))); }
        const rest = convs.filter((c) => !pins.includes(c.id));
        if (pinned.length || reqs.length) head('Messages');
        if (!convs.length) listEl.appendChild(h('div', { class: 'm2-empty' }, T('No conversations yet. Search for a username above to start one.')));
        rest.forEach((c) => listEl.appendChild(convRow(c)));
        if (declined.length) { head('Declined'); declined.forEach((c) => listEl.appendChild(row(c.other, T('You declined this request'), { on: cur === c.id, onClick: () => openConv(c.id) }))); }
        // the system account has every account here, and sees who is banned
        if (C.isSystem()) {
          loadEveryone(false);
          head('PatOS Powers');
          listEl.appendChild(h('div', { class: 'm2-powers' },
            h('button', { class: 'btn', onclick: async () => { const t = await PatOS.ask(T('Announcement'), '', { icon: 'about', ok: T('Send to Everyone'), text: T('Everyone sees it once, next time they open PatOS. Leave it empty to remove it.') }); if (t == null) return; try { await C.announce(t); PatOS.notify({ title: T(t.trim() ? 'Announcement sent' : 'Announcement removed'), body: t.slice(0, 120), icon: 'about' }); } catch (e) { fail(e); } } }, T('Announce…')),
            h('button', { class: 'btn', onclick: async () => { const t = await PatOS.ask(T('Message Everyone'), '', { icon: 'messages', ok: T('Send'), text: T('The same message to every account (not banned ones). No request needed.') }); if (!t || !t.trim()) return; try { const n = await C.messageEveryone(t); PatOS.notify({ title: T('Sent'), body: n + ' ' + T('accounts'), icon: 'messages' }); } catch (e) { fail(e); } } }, T('Message Everyone…'))));
          listEl.appendChild(h('div', { class: 'm2-h' }, T('All Accounts') + (everyone ? ' (' + everyone.length + ')' : '')));
          if (!everyone) listEl.appendChild(h('div', { class: 'm2-empty' }, T('Loading…')));
          else everyone.forEach((u) => listEl.appendChild(row(u, u.ban ? T('Banned') + (u.ban.reason ? ': ' + u.ban.reason : '') : u.conv ? T('Open the chat') : T('Message (no request needed)'), { on: cur === u.cid, badge: u.ban ? h('span', { class: 'm2-ban' }, T('Banned')) : null, onClick: () => { if (u.conv) openConv(u.conv.id); else { target = u; cur = null; C.close(); drawSide(); drawMain(); win.el.classList.add('m2-chat'); } } })));
        }
      }
      async function banIt(u) {
        const reason = await PatOS.ask(T('Ban') + ' @' + u.username + '?', '', { icon: 'messages', ok: T('Ban'), danger: true, text: T('They see this reason, and can only log out. They can make a new account.') });
        if (reason == null) return;
        try { await C.ban(u, reason.trim()); await loadEveryone(true); drawMain(); PatOS.notify({ title: T('Banned'), body: '@' + u.username, icon: 'messages' }); } catch (e) { fail(e); }
      }
      async function unbanIt(u) {
        if (!(await PatOS.confirmBox(T('Unban') + ' @' + u.username + '?', T('They can use their account again.'), { ok: T('Unban'), icon: 'messages' }))) return;
        try { await C.unban(u); await loadEveryone(true); drawMain(); } catch (e) { fail(e); }
      }

      /* ================= one message ================= */
      const nameOf = (c, uid) => (uid && uid === (A.info() || {}).uid ? T('You') : '@' + (c ? c.other.username : '?'));
      function voicePlayer(m) {
        const audio = new Audio(); audio.preload = 'none'; audio.src = m.voice;
        const bars = h('div', { class: 'm2-wave', 'aria-hidden': 'true' }); let s = 0; for (const ch of m.id) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
        for (let i = 0; i < 28; i++) { s = (s * 1103515245 + 12345) >>> 0; bars.appendChild(h('i', { style: { height: (20 + (s % 80)) + '%' } })); }
        const time = h('small', {}, dur(m.dur)); const play = h('button', { class: 'm2-vplay', 'aria-label': T('Play'), html: sym('play') });
        const paint = () => { const p = audio.duration && isFinite(audio.duration) ? audio.currentTime / audio.duration : audio.currentTime / (m.dur || 1); [...bars.children].forEach((b, i) => b.classList.toggle('on', i / bars.children.length < p)); time.textContent = dur(audio.paused && !audio.currentTime ? m.dur : audio.currentTime); };
        audio.ontimeupdate = paint; audio.onended = () => { play.innerHTML = sym('play'); audio.currentTime = 0; paint(); };
        play.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.m2 audio').forEach(() => {}); if (audio.paused) { audio.play().catch(() => {}); play.innerHTML = sym('pause'); } else { audio.pause(); play.innerHTML = sym('play'); } };
        bars.addEventListener('click', (e) => { e.stopPropagation(); const r = bars.getBoundingClientRect(); const d = audio.duration && isFinite(audio.duration) ? audio.duration : m.dur; audio.currentTime = Math.max(0, Math.min(d, ((e.clientX - r.left) / r.width) * d)); paint(); });
        return h('div', { class: 'm2-voice' }, play, bars, time);
      }
      function gameCard(m) {
        const g = m.game; const app = g.id.startsWith('2048') ? 'games' : g.id;
        const art = PatOS.iconHTML(PatOS.apps[app] ? PatOS.apps[app].icon || app : 'games');
        const play = () => { if (g.id === '2048-daily') PatOS.launch('games', { game: '2048', daily: true }); else if (PatOS.apps[g.id]) PatOS.launch(g.id); else PatOS.launch('games'); };
        const today = g.day && PatOS.gc && g.day === PatOS.gc.dayId();
        return h('div', { class: 'm2-game' }, h('div', { class: 'm2-gart', html: art }),
          h('div', { class: 'm2-gt' }, h('small', {}, T(g.label)), h('b', {}, Number(g.score).toLocaleString(PatOS.locale)), h('span', {}, m.mine ? T('Your challenge') : T('Can you beat it?'))),
          h('button', { class: 'btn small primary', onclick: (e) => { e.stopPropagation(); play(); }, disabled: g.day && !today ? true : null }, g.day && !today ? T('Ended') : h('span', { translate: 'no' }, PatOS.lang === 'fr' ? 'Jouer' : 'Play')));
      }
      function bubble(c, m, pos) {
        const mine = m.mine;
        if (m.unsent) return h('div', { class: 'm2-mw ' + (mine ? 'me' : 'them') + ' ' + pos, 'data-mid': m.id }, h('div', { class: 'msg-b unsent' }, mine ? T('You unsent a message') : '@' + c.other.username + ' ' + T('unsent a message')));
        const parts = [];
        if (m.reply) parts.push(h('button', { class: 'm2-quote', onclick: (e) => { e.stopPropagation(); jumpTo(m.reply.id); } }, h('b', {}, nameOf(c, m.reply.from)), h('span', {}, m.reply.text || T('Photo'))));
        if (m.img) parts.push(h('img', { class: 'm2-img', src: m.img, alt: T('Photo'), loading: 'lazy', onclick: (e) => { e.stopPropagation(); viewPhoto(m.img); } }));
        if (m.voice) parts.push(voicePlayer(m));
        if (m.game) parts.push(gameCard(m));
        if (m.text) parts.push(h('span', { class: 'm2-txt', translate: 'no' }, find && find.q ? highlight(m.text, find.q) : linkify(m.text)));
        if (m.edited) parts.push(h('small', { class: 'm2-edited' }, T('Edited')));
        const only = (m.img || m.game) && !m.text && !m.reply;
        const b = h('div', { class: 'msg-b ' + (mine ? 'me' : 'them') + (m.sending ? ' sending' : '') + (m.img ? ' has-img' : '') + (m.voice ? ' has-voice' : '') + (m.game ? ' has-game' : '') + (only ? ' only-media' : ''), title: new Date(m.t).toLocaleString(PatOS.locale) }, ...parts);
        const wrap = h('div', { class: 'm2-mw ' + (mine ? 'me' : 'them') + ' ' + pos, 'data-mid': m.id }, b);
        const rs = Object.values(m.reactions || {});
        if (rs.length) { const count = {}; rs.forEach((e) => { count[e] = (count[e] || 0) + 1; }); const myR = (m.reactions || {})[(A.info() || {}).uid]; wrap.appendChild(h('div', { class: 'm2-reacts' }, ...Object.entries(count).map(([e, n]) => h('button', { class: e === myR ? 'mine' : '', onclick: (ev) => { ev.stopPropagation(); C.react(c.id, m.id, e).catch(fail); } }, e + (n > 1 ? ' ' + n : ''))))); }
        if (c.status === 'accepted' && !m.sending) {
          b.addEventListener('dblclick', (e) => { e.preventDefault(); C.react(c.id, m.id, '❤️').catch(fail); });
          const acts = h('div', { class: 'm2-acts', role: 'toolbar', 'aria-label': T('Message actions') },
            h('button', { title: T('React'), 'aria-label': T('React'), html: sym('smile'), onclick: (e) => { e.stopPropagation(); reactBar(c, m, wrap); } }),
            h('button', { title: T('Reply'), 'aria-label': T('Reply'), html: sym('reply'), onclick: (e) => { e.stopPropagation(); startReply(c, m); } }),
            h('button', { title: T('More'), 'aria-label': T('More'), html: sym('more'), onclick: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); PatOS.menu(msgMenu(c, m), r.left, r.bottom + 4); } }));
          wrap.appendChild(acts);
          b.addEventListener('contextmenu', (e) => { e.preventDefault(); PatOS.menu(msgMenu(c, m), e.clientX, e.clientY); });
        }
        return wrap;
      }
      function msgMenu(c, m) {
        const items = [{ label: T('Reply'), action: () => startReply(c, m) }];
        if (m.text) items.push({ label: T('Copy'), action: () => { try { navigator.clipboard.writeText(m.text); } catch (e) {} } });
        if (C.canChange(m)) {
          if (m.text && !m.voice && !m.game) items.push({ label: T('Edit Message'), action: () => startEdit(c, m) });
          items.push({ divider: true }, { label: T('Unsend'), action: async () => { if (await PatOS.confirmBox(T('Unsend this message?'), T('It goes away for both of you.'), { ok: T('Unsend'), icon: 'messages', danger: true })) C.unsend(c.id, m.id).catch(fail); } });
        }
        return items;
      }
      function reactBar(c, m, wrap) {
        const open = wrap.querySelector('.m2-rbar'); main.querySelectorAll('.m2-rbar').forEach((x) => x.remove()); if (open) return;
        const mineR = (m.reactions || {})[(A.info() || {}).uid];
        wrap.insertBefore(h('div', { class: 'm2-rbar', role: 'toolbar', 'aria-label': T('React') }, ...REACT.map((e) => h('button', { class: e === mineR ? 'on' : '', 'aria-label': e, onclick: (ev) => { ev.stopPropagation(); wrap.querySelector('.m2-rbar').remove(); C.react(c.id, m.id, e).catch(fail); } }, e))), wrap.firstChild);
      }
      function jumpTo(mid) { const el = main.querySelector('.m2-mw[data-mid="' + mid + '"]'); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      function highlight(text, q) { const out = document.createDocumentFragment(); const lo = text.toLowerCase(), ql = q.toLowerCase(); let i = 0, j; while ((j = lo.indexOf(ql, i)) >= 0) { out.append(text.slice(i, j), h('mark', {}, text.slice(j, j + q.length))); i = j + q.length; } out.append(text.slice(i)); return out; }
      function viewPhoto(src) { const l = h('div', { class: 'm2-photo', onclick: () => l.remove(), role: 'dialog', 'aria-label': T('Photo') }, h('img', { src })); document.body.appendChild(l); }
      /* a photo to send: made smaller (at most 1280 px, JPEG) so it fits in a message */
      async function shrink(file) {
        const url = URL.createObjectURL(file); try {
          const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error(T('That isn’t a picture PatOS can read.'))); i.src = url; });
          for (const [max, q] of [[1280, 0.72], [1024, 0.62], [800, 0.55], [600, 0.5]]) {
            const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); const d = cv.toDataURL('image/jpeg', q); if (d.length <= 390000) return d;
          }
          throw new Error(T('That picture is too big.'));
        } finally { URL.revokeObjectURL(url); }
      }
      function openConv(id) { if (cur !== id) { replyTo = null; editing = null; find = null; nearBottom = true; } cur = id; target = null; C.open(id); drawSide(); drawMain(); win.el.classList.add('m2-chat'); }
      function startReply(c, m) { editing = null; replyTo = { id: m.id, text: (m.text || (m.img ? T('Photo') : m.voice ? T('Voice message') : m.game ? m.game.label : '')).slice(0, 140), from: m.from || (m.mine ? (A.info() || {}).uid : c.other.uid) }; redraw(); focusInput(); }
      function startEdit(c, m) { replyTo = null; editing = { id: m.id, text: m.text }; redraw(); const i = main.querySelector('.msg-in'); if (i) { i.value = m.text; autosize(i); i.focus(); } }
      const focusInput = () => { const f = () => { const i = main.querySelector('.msg-in'); if (i && document.activeElement !== i) i.focus(); }; f(); setTimeout(f, 0); };
      const autosize = (i) => { i.style.height = 'auto'; i.style.height = Math.min(140, i.scrollHeight) + 'px'; };

      /* ================= the right side: one conversation ================= */
      function drawMain() {
        main.innerHTML = '';
        if (!signedIn()) {
          main.appendChild(h('div', { class: 'm2-card' }, h('div', { class: 'm2-cart', html: PatOS.iconHTML('messages') }), h('h2', {}, T('Message your friends')), h('p', {}, T('Messages works between PatOS accounts. Create one, then find friends by username.')),
            h('div', { class: 'm2-cbtns' }, h('button', { class: 'btn primary', onclick: () => PatOS.accountUI.open('signup') }, T('Create Account')), h('button', { class: 'btn', onclick: () => PatOS.accountUI.open('signin') }, T('Sign In'))))); return;
        }
        const c = cur ? C.find(cur) : null; main.dataset.status = c ? c.status : '';
        if (!c && !target) { main.appendChild(h('div', { class: 'm2-card' }, h('div', { class: 'm2-cart', html: PatOS.iconHTML('messages') }), h('h2', {}, T('Messages')), h('p', {}, T('Pick a conversation, or find someone by username in the search box.')), C.outbox() ? h('p', { class: 'm2-fine' }, C.outbox() + ' ' + T('waiting to be sent (you are offline or the connection is slow)')) : null)); return; }
        const name = c ? c.other.username : target.username, ouid = c ? c.other.uid : target.uid;
        const other = { uid: ouid, username: name }; const god = C.isSystem() && !isSys(ouid);
        const known = everyone && everyone.find((u) => u.uid === ouid); const isBanned = !!(known && known.ban);
        const ver = A.isVerified(ouid);
        // the header: who, what they are doing, and what you can do
        const typing = c && Date.now() - (c.otherTyping || 0) < 6000;
        const status = isBanned ? T('Banned') : isSys(ouid) ? T('PatOS system account') : !c ? T('New message') : c.status === 'accepted' ? (typing ? T('typing…') : C.muted().includes(c.id) ? T('Muted') : '') : c.status === 'pending' ? (c.mine ? T('Request sent') : T('Wants to message you')) : T('Declined');
        const back = h('button', { class: 'm2-ibtn m2-back', 'aria-label': T('Back'), onclick: () => { win.el.classList.remove('m2-chat'); } }, '‹');
        const tools = h('div', { class: 'm2-htools' });
        if (c && c.status === 'accepted') {
          tools.append(h('button', { class: 'm2-ibtn' + (find ? ' on' : ''), title: T('Search in this chat'), 'aria-label': T('Search in this chat'), html: sym('search'), onclick: () => { find = find ? null : { q: '', i: 0 }; redraw(); if (find) setTimeout(() => { const f = main.querySelector('.m2-find input'); f && f.focus(); }, 0); } }),
            h('button', { class: 'm2-ibtn', title: T('More'), 'aria-label': T('More'), html: sym('more'), onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu(chatMenu(c)().concat(god ? [{ divider: true }, { label: ver ? T('Remove Badge') : T('Verify'), action: () => C.verify(other, !ver).then(() => { drawSide(); drawMain(); }).catch(fail) }, { label: isBanned ? T('Unban') : T('Ban'), action: () => (isBanned ? unbanIt(other) : banIt(other)) }] : []), r.right - 180, r.bottom + 4); } }));
        } else if (god) tools.append(h('button', { class: 'btn small' + (isBanned ? '' : ' danger'), onclick: () => (isBanned ? unbanIt(other) : banIt(other)) }, isBanned ? T('Unban') : T('Ban')));
        main.appendChild(h('div', { class: 'm2-head' }, back, av(name, ouid, 'md'), h('div', { class: 'm2-hn' }, nameEl(ouid, name), status ? h('small', { class: typing ? 'typing' : '' }, status) : null), tools));
        // search in this chat
        let hits = [];
        if (find && c) {
          const fi = h('input', { type: 'search', class: 'field', placeholder: T('Search in this chat'), value: find.q, 'aria-label': T('Search in this chat') });
          const count = h('small', { class: 'm2-fcount' });
          const step = (d) => { if (!hits.length) return; find.i = (find.i + d + hits.length) % hits.length; count.textContent = (find.i + 1) + ' / ' + hits.length; jumpTo(hits[find.i]); };
          fi.addEventListener('input', () => { find.q = fi.value; find.i = 0; redraw(); });
          fi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') { find = null; redraw(); } });
          main.appendChild(h('div', { class: 'm2-find' }, fi, count, h('button', { class: 'm2-ibtn', 'aria-label': T('Previous'), onclick: () => step(-1) }, '↑'), h('button', { class: 'm2-ibtn', 'aria-label': T('Next'), onclick: () => step(1) }, '↓'), h('button', { class: 'm2-ibtn', 'aria-label': T('Close'), onclick: () => { find = null; redraw(); } }, '×')));
          main._findCount = count;
        }
        const list = h('div', { class: 'm2-msgs', role: 'log', 'aria-live': 'polite' });
        if (c) {
          const ms = C.messages(); let prev = null;
          if (find && find.q) hits = ms.filter((m) => m.text && m.text.toLowerCase().includes(find.q.toLowerCase())).map((m) => m.id);
          ms.forEach((m, i) => {
            const gap = !prev || m.t - prev.t > 45 * 60000 || !sameDay(prev.t, m.t);
            if (gap) list.appendChild(h('div', { class: 'm2-day' }, h('b', {}, sameDay(m.t, Date.now()) ? T('Today') : new Date(m.t).toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' })), ' ' + new Date(m.t).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' })));
            const next = ms[i + 1];
            const joinPrev = prev && !gap && prev.mine === m.mine && m.t - prev.t < 5 * 60000 && !prev.unsent && !m.unsent;
            const joinNext = next && next.mine === m.mine && next.t - m.t < 5 * 60000 && sameDay(m.t, next.t) && !next.unsent && !m.unsent;
            const pos = joinPrev && joinNext ? 'mid' : joinPrev ? 'last' : joinNext ? 'first' : 'solo';
            const el = bubble(c, m, pos); if (find && find.q && !hits.includes(m.id)) el.classList.add('dim');
            list.appendChild(el); prev = m;
          });
          if (find && main._findCount) main._findCount.textContent = hits.length ? (Math.min(find.i, hits.length - 1) + 1) + ' / ' + hits.length : (find.q ? T('No results') : '');
          // "Seen" under your last message once they read it, and "typing…" while they write
          const lastMine = [...ms].reverse().find((m) => m.mine && !m.sending);
          if (lastMine && ms[ms.length - 1] === lastMine) list.appendChild(h('div', { class: 'm2-seen' }, c.otherSeen && c.otherSeen >= lastMine.t - 2000 ? T('Seen') + ' ' + clock(c.otherSeen) : T('Delivered')));
          list.appendChild(h('div', { class: 'm2-typing' + (typing ? ' on' : ''), 'aria-label': T('typing…') }, h('i'), h('i'), h('i')));
          if (c.status === 'pending' && c.mine && !C.isSystem()) list.appendChild(h('div', { class: 'm2-sys' }, '@' + name + ' ' + T('has to accept your request before you can keep chatting.')));
        } else {
          list.appendChild(h('div', { class: 'm2-hello' }, av(name, ouid, 'lg'), nameEl(ouid, name), h('p', {}, C.isSystem() ? T('You are the PatOS account: your message opens the chat at once, no request needed.') : T('Your first message is sent as a request. @') + name + ' ' + T('decides whether to accept it, and gets no notifications from you until they do.'))));
        }
        main.appendChild(list);
        list.addEventListener('scroll', () => { nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80; keepTop = list.scrollTop; }, { passive: true });
        if (!(find && find.q && hits.length)) { list.scrollTop = list.scrollHeight; setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0); } else setTimeout(() => jumpTo(hits[Math.min(find.i, hits.length - 1)]), 0);
        list.addEventListener('click', () => main.querySelectorAll('.m2-rbar, .m2-emo, .m2-plus').forEach((x) => x.remove()));
        // the bottom: write, or answer a request
        if (c && c.status === 'pending' && !c.mine) {
          main.appendChild(h('div', { class: 'm2-ask' }, h('span', {}, '@' + name + ' ' + T('wants to message you.')), h('div', {}, h('button', { class: 'btn primary', onclick: () => C.respond(c.id, true).catch(fail) }, T('Accept')), h('button', { class: 'btn', onclick: () => C.respond(c.id, false).then(() => { cur = null; C.close(); drawSide(); drawMain(); }).catch(fail) }, T('Decline')))));
        } else if (c && c.status !== 'accepted' && C.isSystem()) {
          drawInput(c); // the system account never waits for an answer
        } else if (c && c.status === 'declined') {
          main.appendChild(c.mine ? h('div', { class: 'm2-ask' }, h('span', {}, T('This person did not accept your request.'))) : h('div', { class: 'm2-ask' }, h('span', {}, T('You declined this request.')), h('div', {}, h('button', { class: 'btn', onclick: () => C.respond(c.id, true).catch(fail) }, T('Accept Anyway')))));
        } else if (c && c.status === 'pending' && c.mine) {
          main.appendChild(h('div', { class: 'm2-ask' }, h('span', {}, T('Waiting for them to accept…'))));
        } else drawInput(c);
      }

      /* ================= the composer ================= */
      let rec = null; // a voice message being recorded
      let stick = false; // the next drawing scrolls to the newest message
      let nearBottom = true, keepTop = 0; // where you are reading (updated as you scroll)
      function drawInput(c) {
        const open = c && c.status === 'accepted';
        const input = h('textarea', { class: 'msg-in', rows: '1', placeholder: editing ? T('Edit message') : T('Message'), maxlength: '2000', autocomplete: 'off', enterkeyhint: 'send', 'aria-label': T('Message') });
        input.addEventListener('input', () => { autosize(input); if (open) C.typing(c.id); sendBtn.classList.toggle('ready', !!input.value.trim()); micBtn.hidden = !!input.value.trim() || !open || !!editing; sendBtn.hidden = !micBtn.hidden ? true : false; });
        // above the field: what you are answering or fixing
        const ctx = replyTo ? h('div', { class: 'm2-ctx' }, h('span', { class: 'm2-ctx-ic', html: sym('reply') }), h('div', {}, h('b', {}, T('Replying to') + ' ' + nameOf(c, replyTo.from)), h('span', {}, replyTo.text)), h('button', { class: 'm2-ibtn', 'aria-label': T('Cancel'), onclick: () => { replyTo = null; redraw(); } }, '×'))
          : editing ? h('div', { class: 'm2-ctx' }, h('span', { class: 'm2-ctx-ic', html: sym('pencil') }), h('div', {}, h('b', {}, T('Editing')), h('span', {}, editing.text)), h('button', { class: 'm2-ibtn', 'aria-label': T('Cancel'), onclick: () => { editing = null; redraw(); } }, '×')) : null;
        // + : a photo, a voice message, a game challenge
        const pick = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
        pick.onchange = async () => { const f = pick.files && pick.files[0]; pick.value = ''; if (!f) return; try { const d = await shrink(f); C.send(c.id, input.value.trim(), d, replyTo ? { reply: replyTo } : undefined); input.value = ''; replyTo = null; redraw(); } catch (e) { fail(e); } };
        const plus = open && !editing ? h('button', { class: 'm2-ibtn m2-plusbtn', 'aria-label': T('Add'), title: T('Add'), html: sym('plus'), onclick: (e) => { e.stopPropagation(); const o = main.querySelector('.m2-plus'); main.querySelectorAll('.m2-emo, .m2-plus').forEach((x) => x.remove()); if (o) return;
          main.appendChild(h('div', { class: 'm2-plus', role: 'menu' },
            h('button', { role: 'menuitem', onclick: () => { main.querySelector('.m2-plus').remove(); pick.click(); } }, h('span', { html: sym('image') }), T('Photo')),
            h('button', { role: 'menuitem', onclick: () => { main.querySelector('.m2-plus').remove(); startVoice(c); } }, h('span', { html: sym('mic') }), T('Voice Message')),
            h('button', { role: 'menuitem', onclick: () => { main.querySelector('.m2-plus').remove(); challenge(c); } }, h('span', { html: sym('game') }), T('Game Challenge')))); } }) : null;
        const emoBtn = h('button', { class: 'm2-ibtn m2-emobtn', 'aria-label': T('Emoji'), title: T('Emoji'), html: sym('smile'), onclick: (e) => { e.stopPropagation(); const o = main.querySelector('.m2-emo'); main.querySelectorAll('.m2-emo, .m2-plus').forEach((x) => x.remove()); if (o) return;
          main.appendChild(h('div', { class: 'm2-emo', role: 'listbox' }, ...EMO.map((x) => h('button', { onclick: () => { const p = input.selectionStart == null ? input.value.length : input.selectionStart; input.value = input.value.slice(0, p) + x + input.value.slice(p); input.focus(); input.setSelectionRange(p + x.length, p + x.length); input.dispatchEvent(new Event('input')); } }, x)))); } });
        const sendBtn = h('button', { class: 'msg-send', 'aria-label': editing ? T('Save') : T('Send'), html: editing ? sym('check') : sym('send') });
        const micBtn = h('button', { class: 'msg-send mic', 'aria-label': T('Voice Message'), title: T('Voice Message'), html: sym('mic'), onclick: () => startVoice(c) });
        micBtn.hidden = !open || !!editing; sendBtn.hidden = !micBtn.hidden;
        const go = async () => {
          const v = input.value.trim(); if (!v) return; main.querySelectorAll('.m2-emo, .m2-plus').forEach((x) => x.remove());
          if (editing) { const id = editing.id; editing = null; input.value = ''; try { await C.edit(c.id, id, v); } catch (e) { fail(e); } redraw(); return; }
          input.value = ''; autosize(input); const r = replyTo; replyTo = null; stick = true; // (your own message: show it)
          try { if (open) C.send(c.id, v, null, r ? { reply: r } : undefined); else if (c) await C.request(c.other, v); else { const id = await C.request(target, v); if (id) { cur = id; target = null; C.open(id); drawSide(); } } } catch (e) { input.value = v; fail(e); }
          if (r) redraw();
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } if (e.key === 'Escape' && (replyTo || editing)) { replyTo = null; editing = null; redraw(); } if (e.key === 'ArrowUp' && !input.value && open) { const last = [...C.messages()].reverse().find((m) => C.canChange(m) && m.text && !m.voice && !m.game); if (last) { e.preventDefault(); startEdit(c, last); } } });
        sendBtn.onclick = go;
        main.appendChild(h('div', { class: 'msg-dock' }, ctx, h('div', { class: 'msg-bar' }, pick, plus, h('div', { class: 'msg-field' }, input, emoBtn), sendBtn, micBtn)));
        if (!win._noFocus) setTimeout(() => input.focus(), 60);
      }
      /* a voice message: record (at most a minute), then send or throw away */
      async function startVoice(c) {
        if (rec) return;
        if (!navigator.mediaDevices || !window.MediaRecorder) { fail(T('This browser can’t record sound.')); return; }
        let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { fail(T('PatOS can’t use the microphone. Allow it in your browser, then try again.')); return; }
        const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
        const mr = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 24000 }, type ? { mimeType: type } : {})); const chunks = []; const t0 = Date.now();
        rec = { mr, stream, t0, cancel: false };
        mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        const bar = main.querySelector('.msg-bar'); const time = h('b', {}, '0:00');
        const ui = h('div', { class: 'msg-bar rec' }, h('button', { class: 'm2-ibtn', 'aria-label': T('Delete'), title: T('Delete'), html: sym('trash'), onclick: () => { rec.cancel = true; mr.stop(); } }), h('span', { class: 'm2-recdot' }), time, h('span', { class: 'm2-rechint' }, T('Recording…')), h('button', { class: 'msg-send ready', 'aria-label': T('Send'), html: sym('send'), onclick: () => mr.stop() }));
        if (bar) bar.replaceWith(ui);
        const tick = setInterval(() => { const s = (Date.now() - t0) / 1000; time.textContent = dur(s); if (s >= 60) mr.stop(); }, 250);
        mr.onstop = async () => {
          clearInterval(tick); stream.getTracks().forEach((x) => x.stop()); const cancel = rec.cancel; const secs = Math.min(60, (Date.now() - t0) / 1000); rec = null;
          if (cancel || secs < 0.6 || !chunks.length) { redraw(); return; }
          const blob = new Blob(chunks, { type: mr.mimeType || type || 'audio/webm' });
          const url = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
          if (url.length > 395000) { fail(T('That voice message is too long.')); redraw(); return; }
          const r = replyTo; replyTo = null; stick = true; C.send(c.id, '', null, Object.assign({ voice: url, dur: Math.round(secs * 10) / 10 }, r ? { reply: r } : {})); redraw();
        };
        mr.start(250);
      }
      /* a game challenge: your best in a game, as a card they can answer by playing */
      function challenge(c) {
        const gc = PatOS.gc; if (!gc) return;
        const d = gc.daily(); const opts = [];
        if (d.best) opts.push({ id: '2048-daily', label: T('Daily Challenge') + ' · 2048', score: d.best, day: d.id });
        [['orbrunner', 'Orb Runner'], ['2048', '2048'], ['snake', 'Snake'], ['breakout', 'Breakout'], ['slither', 'Slither']].forEach(([id, n]) => { const s = gc.stats(id); if (s.best) opts.push({ id, label: n, score: s.best }); });
        if (!opts.length) { msg(T('No scores yet'), T('Play a game first, then challenge your friend to beat your score.')); return; }
        const r = main.querySelector('.m2-plusbtn') ? main.querySelector('.m2-plusbtn').getBoundingClientRect() : { left: 40, top: 400 };
        PatOS.menu([{ header: T('Challenge with your best') }].concat(opts.map((o) => ({ label: o.label + ' · ' + Number(o.score).toLocaleString(PatOS.locale), action: () => { stick = true; C.send(c.id, '', null, { game: o }); } }))), r.left, r.top - 8 - (opts.length + 1) * 30);
      }
      const fullPaint = () => { root.classList.toggle('m2-out', !signedIn()); who.innerHTML = ''; if (signedIn()) who.append(nameEl(A.info().uid, A.info().username, 'span')); if (!signedIn()) { cur = null; target = null; } drawSide(); drawMain(); };
      // draws the conversation again, keeping what is being typed (and where), unless a voice message is being recorded
      function redraw() {
        if (!(cur || target) || rec) return;
        const i0 = main.querySelector('.msg-in'); const v = i0 ? i0.value : ''; const focus = document.activeElement === i0; const pos = i0 ? i0.selectionStart : 0;
        const fi0 = main.querySelector('.m2-find input'); const ff = document.activeElement === fi0; const fpos = fi0 ? fi0.selectionStart : 0;
        const atBottom = stick || nearBottom; const top0 = keepTop; stick = false;
        drawMain();
        const i = main.querySelector('.msg-in'); if (i && v && !(editing && i.value)) { i.value = v; autosize(i); i.dispatchEvent(new Event('input')); } if (i && focus) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} }
        const fi = main.querySelector('.m2-find input'); if (fi && ff) { fi.focus(); try { fi.setSelectionRange(fpos, fpos); } catch (e) {} }
        const l = main.querySelector('.m2-msgs'); if (l && !atBottom && !(find && find.q)) { l.scrollTop = top0; setTimeout(() => { l.scrollTop = top0; }, 0); } else if (l && atBottom) nearBottom = true;
      }
      // "typing…" and "Seen" change without new messages: update them in place
      const live = () => {
        const c = cur ? C.find(cur) : null; const t = main.querySelector('.m2-typing'); if (!c || !t) return;
        const on = Date.now() - (c.otherTyping || 0) < 6000;
        if (t.classList.contains('on') !== on) { t.classList.toggle('on', on); const s = main.querySelector('.m2-hn small'); if (s) { s.textContent = on ? T('typing…') : C.muted().includes(c.id) ? T('Muted') : ''; s.classList.toggle('typing', on); } if (on) { const l = main.querySelector('.m2-msgs'); if (l && l.scrollHeight - l.scrollTop - l.clientHeight < 80) l.scrollTop = l.scrollHeight; } }
        if (main.dataset.seen !== String(c.otherSeen || 0)) { main.dataset.seen = String(c.otherSeen || 0); if (main.querySelector('.m2-msgs') && !main.querySelector('.m2-rbar, .m2-emo, .m2-plus')) redraw(); }
      };
      const liveTimer = setInterval(() => { if (root.isConnected) live(); }, 1500); win.on('closed', () => clearInterval(liveTimer));
      const offs = [PatOS.on('chat', () => { if (!root.isConnected) return; drawSide(); const c = cur ? C.find(cur) : null; if (c && main.dataset.status !== c.status) redraw(); live(); }), // (a request accepted, declined...: what is being typed stays)
        PatOS.on('chat:messages', () => { if (root.isConnected) redraw(); }),
        PatOS.on('account', () => { if (root.isConnected) fullPaint(); })];
      win.on('closed', () => { offs.forEach((f) => f()); C.close(); if (rec) { rec.cancel = true; try { rec.mr.stop(); } catch (e) {} } });
      win._open = (id) => { if (signedIn()) openConv(id); };
      win._m = { reply: (mid) => { const c = C.find(cur); const m = C.messages().find((x) => x.id === mid); if (c && m) startReply(c, m); }, edit: (mid) => { const c = C.find(cur); const m = C.messages().find((x) => x.id === mid); if (c && m) startEdit(c, m); }, find: (q) => { find = { q, i: 0 }; redraw(); } };
      fullPaint();
      if (signedIn() && C.available() && !C.ready()) { try { PatOS.chat.search(''); } catch (e) {} }
      if (args && args.chat) win._open(args.chat);
    },
    onArgs(win, a) { if (a.chat && win._open) win._open(a.chat); },
    menus(win) {
      return { file: [
        { label: PatOS.t('Close Window'), shortcut: 'Alt+W', action: () => win.close() }
      ] };
    }
  });
})();
