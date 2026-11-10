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
      const av = (name) => h('div', { class: 'msg-av' }, (name || '?').charAt(0).toUpperCase());
      const signedIn = () => A && A.signedIn();

      /* the left side: search, requests, conversations */
      function row(name, sub, extra, on, onClick) { const b = h('div', { class: 'm2-row' + (on ? ' on' : ''), role: 'button', tabindex: '0', onclick: onClick }, av(name), h('div', { class: 'm2-rt' }, h('b', {}, name), h('small', {}, sub || '')), extra || null); b.addEventListener('keydown', (e) => { if (e.key === 'Enter') onClick(); }); return b; }
      function drawSide() {
        const keep = side.querySelector('.m2-search'); const had = document.activeElement === keep; const val = keep ? keep.value : query;
        side.innerHTML = '';
        if (!signedIn()) return;
        const search = h('input', { class: 'field m2-search', placeholder: T('Find a person'), spellcheck: 'false', autocapitalize: 'none', autocomplete: 'off', 'aria-label': T('Find a person by username') }); search.value = val;
        search.addEventListener('input', () => { query = search.value.trim(); clearTimeout(searchTimer); if (!query) { results = null; drawSide(); return; } searchTimer = setTimeout(async () => { const q = query; try { const r = await C.search(q); if (q === query) { results = r; drawList(); } } catch (e) { results = []; drawList(); } }, 250); });
        side.appendChild(h('div', { class: 'm2-sh' }, search)); listEl = h('div', { class: 'm2-list' }); side.appendChild(listEl); drawList();
        if (had) { search.focus(); search.setSelectionRange(val.length, val.length); }
      }
      function drawList() {
        if (!listEl) return; listEl.innerHTML = '';
        if (query) {
          if (!results) { listEl.appendChild(h('div', { class: 'm2-empty' }, T('Searching…'))); return; }
          if (!results.length) listEl.appendChild(h('div', { class: 'm2-empty' }, T('Nobody with that username. Check the spelling.')));
          results.forEach((u) => listEl.appendChild(row('@' + u.username, u.conv ? (u.conv.status === 'accepted' ? T('Open the chat') : u.conv.status === 'pending' ? (u.conv.mine ? T('Request sent') : T('Wants to message you')) : T('Declined')) : T('Send a message request'), null, false, () => { query = ''; results = null; if (u.conv) { cur = u.conv.id; target = null; C.open(cur); } else { target = u; cur = null; C.close(); } drawSide(); drawMain(); win.el.classList.add('m2-chat'); })));
          return;
        }
        const reqs = C.requests(), convs = C.conversations(), declined = C.declined();
        if (reqs.length) { listEl.appendChild(h('div', { class: 'm2-h' }, T('Requests') + ' (' + reqs.length + ')')); reqs.forEach((c) => listEl.appendChild(row('@' + c.other.username, c.last, h('span', { class: 'm2-dot' }), cur === c.id, () => openConv(c.id)))); }
        listEl.appendChild(h('div', { class: 'm2-h' }, T('Messages')));
        if (!convs.length) listEl.appendChild(h('div', { class: 'm2-empty' }, T('No conversations yet. Search for a username above to start one.')));
        convs.forEach((c) => listEl.appendChild(row('@' + c.other.username, c.status === 'pending' ? T('Waiting for them to accept') : (c.lastFromMe ? T('You') + ': ' : '') + c.last, c.unread ? h('span', { class: 'm2-dot' }) : h('small', { class: 'm2-time' }, c.lastAt ? clock(c.lastAt) : ''), cur === c.id, () => openConv(c.id))));
        if (declined.length) { listEl.appendChild(h('div', { class: 'm2-h' }, T('Declined'))); declined.forEach((c) => listEl.appendChild(row('@' + c.other.username, T('You declined this request'), null, cur === c.id, () => openConv(c.id)))); }
      }
      function openConv(id) { cur = id; target = null; C.open(id); drawSide(); drawMain(); win.el.classList.add('m2-chat'); }

      /* the right side: one conversation */
      function drawMain() {
        main.innerHTML = '';
        if (!signedIn()) {
          main.appendChild(h('div', { class: 'm2-card' }, h('h2', {}, T('Message your friends')), h('p', {}, T('Messages now work between PatOS accounts. Create a free account with just a username and a password, then find your friends by username. They accept your request first.')),
            h('div', { class: 'm2-cbtns' }, h('button', { class: 'btn primary', onclick: () => PatOS.accountUI.open('signup') }, T('Create Account')), h('button', { class: 'btn', onclick: () => PatOS.accountUI.open('signin') }, T('Sign In'))),
            h('p', { class: 'm2-fine' }, T('Pat, the command helper, works without an account: click the speech bubble in the top bar.')))); return;
        }
        const c = cur ? C.find(cur) : null;
        if (!c && !target) { main.appendChild(h('div', { class: 'm2-card' }, h('h2', {}, T('Messages')), h('p', {}, T('Pick a conversation, or find someone by username in the search box.')), C.outbox() ? h('p', { class: 'm2-fine' }, C.outbox() + ' ' + T('waiting to be sent (you are offline or the connection is slow)')) : null)); return; }
        const name = c ? c.other.username : target.username;
        const back = h('button', { class: 'tbtn m2-back', 'aria-label': T('Back'), onclick: () => { win.el.classList.remove('m2-chat'); } }, '‹');
        main.appendChild(h('div', { class: 'm2-head' }, back, av(name), h('div', {}, h('b', {}, '@' + name), h('small', {}, c ? (c.status === 'accepted' ? T('Chat') : c.status === 'pending' ? (c.mine ? T('Waiting for them to accept') : T('Message request')) : T('Declined')) : T('New message')))));
        const list = h('div', { class: 'm2-msgs', role: 'log', 'aria-live': 'polite' });
        if (c) {
          const ms = C.messages(); let day = '';
          ms.forEach((m) => { const dk = new Date(m.t).toDateString(); if (dk !== day) { day = dk; list.appendChild(h('div', { class: 'm2-day' }, new Date(m.t).toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric' }))); } list.appendChild(h('div', { class: 'msg-b ' + (m.mine ? 'me' : 'them') + (m.sending ? ' sending' : ''), title: new Date(m.t).toLocaleString(PatOS.locale) }, m.text)); });
          if (c.status === 'pending' && c.mine) list.appendChild(h('div', { class: 'm2-sys' }, '@' + name + ' ' + T('has to accept your request before you can keep chatting. They get no notifications from you until then.')));
        } else {
          list.appendChild(h('div', { class: 'm2-sys' }, T('Your first message is sent as a request. @') + name + ' ' + T('decides whether to accept it, and gets no notifications from you until they do.')));
          C.outbox() && list.appendChild(h('div', { class: 'm2-sys' }, T('Sending…')));
        }
        main.appendChild(list); setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
        // the bottom: write, or answer a request
        if (c && c.status === 'pending' && !c.mine) {
          main.appendChild(h('div', { class: 'm2-ask' }, h('span', {}, '@' + name + ' ' + T('wants to message you.')), h('div', {}, h('button', { class: 'btn primary', onclick: () => C.respond(c.id, true).catch(fail) }, T('Accept')), h('button', { class: 'btn', onclick: () => C.respond(c.id, false).then(() => { cur = null; C.close(); drawSide(); drawMain(); }).catch(fail) }, T('Decline')))));
        } else if (c && c.status === 'declined') {
          main.appendChild(c.mine ? h('div', { class: 'm2-ask' }, h('span', {}, T('This person did not accept your request.'))) : h('div', { class: 'm2-ask' }, h('span', {}, T('You declined this request.')), h('div', {}, h('button', { class: 'btn', onclick: () => C.respond(c.id, true).catch(fail) }, T('Accept Anyway')))));
        } else if (c && c.status === 'pending' && c.mine) {
          main.appendChild(h('div', { class: 'm2-ask' }, h('span', {}, T('Waiting for them to accept…'))));
        } else {
          const input = h('input', { class: 'msg-in', placeholder: T('Message'), maxlength: '2000', autocomplete: 'off', enterkeyhint: 'send', 'aria-label': T('Message') });
          const send = h('button', { class: 'msg-send', 'aria-label': T('Send') }, '↑');
          const go = async () => { const v = input.value.trim(); if (!v) return; input.value = ''; try { if (c) C.send(c.id, v); else { const id = await C.request(target, v); if (id) { cur = id; target = null; C.open(id); drawSide(); } } } catch (e) { input.value = v; fail(e); } };
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); send.onclick = go;
          main.appendChild(h('div', { class: 'msg-bar' }, input, send)); if (!win._noFocus) setTimeout(() => input.focus(), 60);
        }
      }
      const fullPaint = () => { root.classList.toggle('m2-out', !signedIn()); who.textContent = signedIn() ? '@' + A.info().username : ''; if (!signedIn()) { cur = null; target = null; } drawSide(); drawMain(); };
      const offs = [PatOS.on('chat', () => { if (!root.isConnected) return; drawSide(); const c = cur ? C.find(cur) : null; if (cur && !c) { /* gone */ } else if (c && main.dataset.status !== c.status) { drawMain(); } main.dataset.status = c ? c.status : ''; }),
        PatOS.on('chat:messages', () => { if (!root.isConnected) return; if (cur || target) { const keepFocus = document.activeElement && document.activeElement.classList.contains('msg-in'); const v = keepFocus ? document.activeElement.value : ''; drawMain(); if (keepFocus) { const i = main.querySelector('.msg-in'); if (i) { i.value = v; i.focus(); } } } }),
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
