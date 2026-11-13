/* Messages: chat with people who have a PatOS account (see js/chat.js). Find a username, send a request, they accept, then talk.
   Pat, the command helper, is not here: it lives in the top bar (js/pat.js). */
(function () {
  'use strict';
  const { h } = PatOS;

  /* ---------- Messages: people with PatOS accounts. (Pat, the command helper, is in the top bar: js/pat.js) ---------- */
  const clock = (t) => { const d = new Date(t), now = new Date(); const hm = d.toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }); return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' }) + ' ' + hm; };
  PatOS.registerApp({
    id: 'messages', name: 'Messages', icon: 'messages', width: 860, height: 600, minWidth: 340, minHeight: 360, keywords: 'chat messages friends people users username request pat helper commands text timer calendar',
    about: 'Message people with a PatOS account: find them by username, and they accept your request first. Pat, the command helper, is the button in the top bar.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const C = PatOS.chat, A = PatOS.account;
      const who = h('span', { class: 'm2-who' });
      win.toolbar.append(h('div', { style: { flex: 1 } }), who); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px'; win.toolbar.style.gap = '8px';
      const side = h('div', { class: 'm2-side' }), main = h('div', { class: 'm2-main' });
      const root = h('div', { class: 'm2' }, side, main); win.body.appendChild(root);
      let query = '', results = null, cur = null /* a conversation id */, target = null /* someone new */, searchTimer = null, listEl = null;
      const T = (x) => PatOS.t(x);
      const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'messages' });
      const fail = (e) => msg(T('That didn’t work'), String((e && e.message) || e));
      const isSys = (uid) => A && A.isSystem(uid);
      const av = (name, uid) => isSys(uid) ? h('div', { class: 'msg-av sys' }, 'P') : h('div', { class: 'msg-av' }, (name || '?').charAt(0).toUpperCase());
      // a person's name: "PatOS" with the system badge for the system account, @name for everyone else
      const nameEl = (uid, username, tag) => h(tag || 'b', { class: 'm2-name' }, A.display(uid, username), isSys(uid) ? PatOS.systemBadge(14) : A.isVerified(uid) ? PatOS.systemBadge(14, 'verified') : null);
      let everyone = null, everyoneAt = 0; // the system account: every account
      const loadEveryone = async (force) => { if (!C.isSystem() || (!force && everyone && Date.now() - everyoneAt < 30000)) return; everyoneAt = Date.now(); try { everyone = await C.everyone(); } catch (e) { everyone = everyone || []; } drawList(); };
      const signedIn = () => A && A.signedIn();

      /* the left side: search, requests, conversations */
      function row(u, sub, extra, on, onClick) { const b = h('div', { class: 'm2-row' + (on ? ' on' : ''), role: 'button', tabindex: '0', onclick: onClick }, av(u.username, u.uid), h('div', { class: 'm2-rt' }, nameEl(u.uid, u.username), h('small', {}, sub || '')), extra || null); b.addEventListener('keydown', (e) => { if (e.key === 'Enter') onClick(); }); return b; }
      function drawSide() {
        const keep = side.querySelector('.m2-search'); const had = document.activeElement === keep; const val = keep ? keep.value : query;
        side.innerHTML = '';
        if (!signedIn()) return;
        const search = h('input', { class: 'field m2-search', placeholder: T('Find a person'), spellcheck: 'false', autocapitalize: 'none', autocomplete: 'off', 'aria-label': T('Find a person by username') }); search.value = val;
        search.addEventListener('input', () => { query = search.value.trim(); clearTimeout(searchTimer); if (!query) { results = null; drawSide(); return; } searchTimer = setTimeout(async () => { const q = query; try { const r = await C.search(q); if (q === query) { results = r; drawList(); } } catch (e) { results = []; drawList(); } }, 250); });
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
      function drawList() {
        if (!listEl) return; listEl.innerHTML = '';
        if (query) {
          if (!results) { listEl.appendChild(h('div', { class: 'm2-empty' }, T('Searching…'))); return; }
          if (!results.length) listEl.appendChild(h('div', { class: 'm2-empty' }, T('Nobody with that username. Check the spelling.')));
          results.forEach((u) => listEl.appendChild(row(u, u.conv ? (u.conv.status === 'accepted' ? T('Open the chat') : u.conv.status === 'pending' ? (u.conv.mine ? T('Request sent') : T('Wants to message you')) : T('Declined')) : T('Send a message request'), null, false, () => { query = ''; results = null; if (u.conv) { cur = u.conv.id; target = null; C.open(cur); } else { target = u; cur = null; C.close(); } drawSide(); drawMain(); win.el.classList.add('m2-chat'); })));
          return;
        }
        const reqs = C.requests(), convs = C.conversations(), declined = C.declined();
        if (reqs.length) { listEl.appendChild(h('div', { class: 'm2-h' }, T('Requests') + ' (' + reqs.length + ')')); reqs.forEach((c) => listEl.appendChild(row(c.other, c.last, h('span', { class: 'm2-dot' }), cur === c.id, () => openConv(c.id)))); }
        listEl.appendChild(h('div', { class: 'm2-h' }, T('Messages')));
        if (!convs.length) listEl.appendChild(h('div', { class: 'm2-empty' }, T('No conversations yet. Search for a username above to start one.')));
        convs.forEach((c) => listEl.appendChild(row(c.other, c.status === 'pending' ? T('Waiting for them to accept') : (c.lastFromMe ? T('You') + ': ' : '') + c.last, c.unread ? h('span', { class: 'm2-dot' }) : h('small', { class: 'm2-time' }, c.lastAt ? clock(c.lastAt) : ''), cur === c.id, () => openConv(c.id))));
        if (declined.length) { listEl.appendChild(h('div', { class: 'm2-h' }, T('Declined'))); declined.forEach((c) => listEl.appendChild(row(c.other, T('You declined this request'), null, cur === c.id, () => openConv(c.id)))); }
        // the system account has every account here, and sees who is banned
        if (C.isSystem()) {
          loadEveryone(false);
          listEl.appendChild(h('div', { class: 'm2-h' }, T('PatOS Powers')));
          listEl.appendChild(h('div', { class: 'm2-powers' },
            h('button', { class: 'btn', onclick: async () => { const t = await PatOS.ask(T('Announcement'), '', { icon: 'about', ok: T('Send to Everyone'), text: T('Everyone sees it once, next time they open PatOS. Leave it empty to remove it.') }); if (t == null) return; try { await C.announce(t); PatOS.notify({ title: T(t.trim() ? 'Announcement sent' : 'Announcement removed'), body: t.slice(0, 120), icon: 'about' }); } catch (e) { fail(e); } } }, T('Announce…')),
            h('button', { class: 'btn', onclick: async () => { const t = await PatOS.ask(T('Message Everyone'), '', { icon: 'messages', ok: T('Send'), text: T('The same message to every account (not banned ones). No request needed.') }); if (!t || !t.trim()) return; try { const n = await C.messageEveryone(t); PatOS.notify({ title: T('Sent'), body: n + ' ' + T('accounts'), icon: 'messages' }); } catch (e) { fail(e); } } }, T('Message Everyone…'))));
          listEl.appendChild(h('div', { class: 'm2-h' }, T('All Accounts') + (everyone ? ' (' + everyone.length + ')' : '')));
          if (!everyone) listEl.appendChild(h('div', { class: 'm2-empty' }, T('Loading…')));
          else everyone.forEach((u) => listEl.appendChild(row(u, u.ban ? T('Banned') + (u.ban.reason ? ': ' + u.ban.reason : '') : u.conv ? T('Open the chat') : T('Message (no request needed)'), u.ban ? h('span', { class: 'm2-ban' }, T('Banned')) : null, cur === u.cid, () => { if (u.conv) openConv(u.conv.id); else { target = u; cur = null; C.close(); drawSide(); drawMain(); win.el.classList.add('m2-chat'); } })));
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
      /* one message: words and/or a photo, its reactions, and the reaction bar (click a message; double-click for ❤️) */
      const REACT = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
      function bubble(c, m) {
        const b = h('div', { class: 'msg-b ' + (m.mine ? 'me' : 'them') + (m.sending ? ' sending' : '') + (m.img ? ' has-img' : '') + (m.img && !m.text ? ' only-img' : ''), title: new Date(m.t).toLocaleString(PatOS.locale) },
          m.img ? h('img', { class: 'm2-img', src: m.img, alt: T('Photo'), loading: 'lazy', onclick: (e) => { e.stopPropagation(); viewPhoto(m.img); } }) : null,
          m.text ? h('span', {}, m.text) : null);
        const rs = Object.values(m.reactions || {}); const wrap = h('div', { class: 'm2-mw ' + (m.mine ? 'me' : 'them') }, b);
        if (rs.length) { const count = {}; rs.forEach((e) => { count[e] = (count[e] || 0) + 1; }); wrap.appendChild(h('div', { class: 'm2-reacts' }, ...Object.entries(count).map(([e, n]) => h('span', {}, e + (n > 1 ? ' ' + n : ''))))); }
        if (c.status === 'accepted' && !m.sending) {
          b.addEventListener('dblclick', (e) => { e.preventDefault(); C.react(c.id, m.id, '❤️').catch(fail); });
          b.addEventListener('click', () => { const open = wrap.querySelector('.m2-rbar'); main.querySelectorAll('.m2-rbar').forEach((x) => x.remove()); if (open) return;
            const mineR = (m.reactions || {})[A.info().uid];
            wrap.insertBefore(h('div', { class: 'm2-rbar', role: 'toolbar', 'aria-label': T('React') }, ...REACT.map((e) => h('button', { class: e === mineR ? 'on' : '', 'aria-label': e, onclick: (ev) => { ev.stopPropagation(); C.react(c.id, m.id, e).catch(fail); } }, e))), b); });
        }
        return wrap;
      }
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
      function openConv(id) { cur = id; target = null; C.open(id); drawSide(); drawMain(); win.el.classList.add('m2-chat'); }

      /* the right side: one conversation */
      function drawMain() {
        main.innerHTML = '';
        if (!signedIn()) {
          main.appendChild(h('div', { class: 'm2-card' }, h('h2', {}, T('Message your friends')), h('p', {}, T('Messages works between PatOS accounts. Create one, then find friends by username.')),
            h('div', { class: 'm2-cbtns' }, h('button', { class: 'btn primary', onclick: () => PatOS.accountUI.open('signup') }, T('Create Account')), h('button', { class: 'btn', onclick: () => PatOS.accountUI.open('signin') }, T('Sign In'))),
            h('p', { class: 'm2-fine' }, T('Pat works without an account: click the speech bubble in the top bar.')))); return;
        }
        const c = cur ? C.find(cur) : null;
        if (!c && !target) { main.appendChild(h('div', { class: 'm2-card' }, h('h2', {}, T('Messages')), h('p', {}, T('Pick a conversation, or find someone by username in the search box.')), C.outbox() ? h('p', { class: 'm2-fine' }, C.outbox() + ' ' + T('waiting to be sent (you are offline or the connection is slow)')) : null)); return; }
        const name = c ? c.other.username : target.username, ouid = c ? c.other.uid : target.uid;
        const other = { uid: ouid, username: name }; const god = C.isSystem() && !isSys(ouid);
        const known = everyone && everyone.find((u) => u.uid === ouid); const isBanned = !!(known && known.ban);
        const ver = A.isVerified(ouid);
        const verBtn = god ? h('button', { class: 'btn m2-banbtn', onclick: () => C.verify(other, !ver).then(() => { drawSide(); drawMain(); }).catch(fail) }, ver ? T('Remove Badge') : T('Verify')) : null;
        const banBtn = god ? h('button', { class: 'btn m2-banbtn' + (isBanned ? '' : ' danger'), onclick: () => (isBanned ? unbanIt(other) : banIt(other)) }, isBanned ? T('Unban') : T('Ban')) : null;
        const back = h('button', { class: 'tbtn m2-back', 'aria-label': T('Back'), onclick: () => { win.el.classList.remove('m2-chat'); } }, '‹');
        main.appendChild(h('div', { class: 'm2-head' }, back, av(name, ouid), h('div', { style: { flex: 1, minWidth: 0 } }, nameEl(ouid, name), h('small', {}, isBanned ? T('Banned') : isSys(ouid) ? T('PatOS system account') : c ? (c.status === 'accepted' ? T('Chat') : c.status === 'pending' ? (c.mine ? T('Waiting for them to accept') : T('Message request')) : T('Declined')) : T('New message'))), verBtn, banBtn));
        const list = h('div', { class: 'm2-msgs', role: 'log', 'aria-live': 'polite' });
        if (c) {
          const ms = C.messages(); let day = '';
          ms.forEach((m) => { const dk = new Date(m.t).toDateString(); if (dk !== day) { day = dk; list.appendChild(h('div', { class: 'm2-day' }, new Date(m.t).toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' }))); } list.appendChild(bubble(c, m)); });
          // "Seen" under your last message once they read it, and "typing…" while they write
          const lastMine = [...ms].reverse().find((m) => m.mine && !m.sending);
          if (lastMine && c.otherSeen && c.otherSeen >= lastMine.t - 2000 && ms[ms.length - 1] === lastMine) list.appendChild(h('div', { class: 'm2-seen' }, T('Seen') + ' ' + clock(c.otherSeen)));
          list.appendChild(h('div', { class: 'm2-typing' + (Date.now() - (c.otherTyping || 0) < 6000 ? ' on' : ''), 'aria-label': T('typing…') }, h('i'), h('i'), h('i')));
          if (c.status === 'pending' && c.mine && !C.isSystem()) list.appendChild(h('div', { class: 'm2-sys' }, '@' + name + ' ' + T('has to accept your request before you can keep chatting.')));
        } else {
          list.appendChild(h('div', { class: 'm2-sys' }, C.isSystem() ? T('You are the PatOS account: your message opens the chat at once, no request needed.') : T('Your first message is sent as a request. @') + name + ' ' + T('decides whether to accept it, and gets no notifications from you until they do.')));
          C.outbox() && list.appendChild(h('div', { class: 'm2-sys' }, T('Sending…')));
        }
        main.appendChild(list); setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
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
        function drawInput(c) {
          const input = h('input', { class: 'msg-in', placeholder: T('Message'), maxlength: '2000', autocomplete: 'off', enterkeyhint: 'send', 'aria-label': T('Message') });
          const send = h('button', { class: 'msg-send', 'aria-label': T('Send') }, '↑');
          input.addEventListener('input', () => { if (c && c.status === 'accepted') C.typing(c.id); });
          // photos (only in a chat that is open) and emoji
          const pick = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
          pick.onchange = async () => { const f = pick.files && pick.files[0]; pick.value = ''; if (!f) return; try { const d = await shrink(f); C.send(c.id, input.value.trim(), d); input.value = ''; } catch (e) { fail(e); } };
          const photo = c && c.status === 'accepted' ? h('button', { class: 'msg-tool', 'aria-label': T('Send a photo'), title: T('Send a photo'), onclick: () => pick.click() }, '📷') : null;
          const EMO = ['😀', '😂', '🥹', '😍', '😎', '🤔', '😭', '😡', '👍', '👎', '👏', '🙏', '❤️', '🔥', '🎉', '✨', '💀', '😴', '🤯', '🥳', '👀', '💯', '✅', '❌'];
          const emoBtn = h('button', { class: 'msg-tool', 'aria-label': T('Emoji'), title: T('Emoji'), onclick: (e) => { e.stopPropagation(); const open = main.querySelector('.m2-emo'); if (open) { open.remove(); return; }
            main.appendChild(h('div', { class: 'm2-emo', role: 'listbox' }, ...EMO.map((x) => h('button', { onclick: () => { const p = input.selectionStart == null ? input.value.length : input.selectionStart; input.value = input.value.slice(0, p) + x + input.value.slice(p); input.focus(); input.setSelectionRange(p + x.length, p + x.length); } }, x)))); } }, '😊');
          const go = async () => { const v = input.value.trim(); if (!v) return; input.value = ''; const e2 = main.querySelector('.m2-emo'); if (e2) e2.remove(); try { if (c && c.status === 'accepted') C.send(c.id, v); else if (c) await C.request(c.other, v); else { const id = await C.request(target, v); if (id) { cur = id; target = null; C.open(id); drawSide(); } } } catch (e) { input.value = v; fail(e); } };
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); send.onclick = go;
          main.appendChild(h('div', { class: 'msg-bar' }, pick, photo, emoBtn, input, send)); if (!win._noFocus) setTimeout(() => input.focus(), 60);
        }
      }
      const fullPaint = () => { root.classList.toggle('m2-out', !signedIn()); who.innerHTML = ''; if (signedIn()) who.append(nameEl(A.info().uid, A.info().username, 'span')); if (!signedIn()) { cur = null; target = null; } drawSide(); drawMain(); };
      // draws the conversation again, keeping what is being typed (and where)
      function redraw() { if (!(cur || target)) return; const i0 = main.querySelector('.msg-in'); const v = i0 ? i0.value : ''; const focus = document.activeElement === i0; const pos = i0 ? i0.selectionStart : 0; drawMain(); const i = main.querySelector('.msg-in'); if (i && v) { i.value = v; } if (i && focus) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } }
      // "typing…" and "Seen" change without new messages: update them in place
      const live = () => { const c = cur ? C.find(cur) : null; const t = main.querySelector('.m2-typing'); if (!c || !t) return; const on = Date.now() - (c.otherTyping || 0) < 6000; if (t.classList.contains('on') !== on) { t.classList.toggle('on', on); if (on) { const l = main.querySelector('.m2-msgs'); if (l) l.scrollTop = l.scrollHeight; } }
        if (main.dataset.seen !== String(c.otherSeen || 0)) { main.dataset.seen = String(c.otherSeen || 0); if (main.querySelector('.m2-msgs') && !main.querySelector('.m2-rbar, .m2-emo')) redraw(); } };
      const liveTimer = setInterval(() => { if (root.isConnected) live(); }, 1500); win.on('closed', () => clearInterval(liveTimer));
      const offs = [PatOS.on('chat', () => { if (!root.isConnected) return; drawSide(); const c = cur ? C.find(cur) : null; if (cur && !c) { /* gone */ } else if (c && main.dataset.status !== c.status) { drawMain(); } main.dataset.status = c ? c.status : ''; live(); }),
        PatOS.on('chat:messages', () => { if (root.isConnected) redraw(); }),
        PatOS.on('account', () => { if (root.isConnected) fullPaint(); })];
      win.on('closed', () => { offs.forEach((f) => f()); C.close(); });
      win._open = (id) => { if (signedIn()) openConv(id); };
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
