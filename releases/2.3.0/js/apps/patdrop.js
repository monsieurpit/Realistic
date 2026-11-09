/* PatDrop: a chat with your friend (or your other devices) where you can also drop files, links, clipboard text and apps.
   It uses PatLink (js/link.js) for the sending; everything is encrypted on the device. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const L = () => PatOS.link;
  const fmtSize = (n) => PatOS.fmtBytes(n || 0);
  const clock = (t) => { const d = new Date(t), now = new Date(); const hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + hm; };
  const tile = (a) => '<div class="icon-tile" style="background:linear-gradient(160deg,rgba(255,255,255,.28),rgba(0,0,0,.22)),' + (/^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#0a84ff') + '"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><text x="32" y="44" font-size="34" font-family="system-ui,sans-serif" text-anchor="middle" fill="#fff">' + PatOS.esc(a.icon || '?') + '</text></svg></div>';

  PatOS.registerApp({
    id: 'patdrop', name: 'PatDrop', icon: 'patdrop', width: 460, height: 640, minWidth: 320, minHeight: 360, category: 'Social', keywords: 'patdrop link friend bro chat send share files clipboard airdrop messages patlink',
    about: 'Chat with a friend and drop files, links, clipboard text and apps into their PatOS. Encrypted, and it works offline.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'patdrop' });
      const fail = (e) => msg(T('That didn’t work'), String((e && e.message) || e));
      const root = h('div', { class: 'pd' }); win.body.appendChild(root);
      const off = PatOS.on('link', () => { if (root.isConnected) paint(); }); win.on('closed', off);

      /* not linked yet */
      function welcome() {
        root.innerHTML = '';
        if (!L().available()) { root.appendChild(h('div', { class: 'pd-empty' }, h('h2', {}, 'PatDrop'), h('p', {}, T('This browser can’t do the encryption PatDrop needs. Open PatOS from its https address, or in a newer browser.')))); return; }
        const label = h('input', { class: 'field', placeholder: T('A name for this chat (like Me and Bro)'), maxlength: '40', 'aria-label': T('Chat name') });
        const code = h('input', { class: 'field', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', spellcheck: 'false', autocapitalize: 'characters', autocomplete: 'off', 'aria-label': T('Code from your friend') });
        const note = h('div', { class: 'pd-note' });
        const make = h('button', { class: 'btn primary' }, T('Make a Code')); make.onclick = async () => { make.disabled = true; try { await L().create(label.value); paint(true); } catch (e) { note.textContent = String(e.message || e); make.disabled = false; } };
        const join = h('button', { class: 'btn primary' }, T('Join')); join.onclick = async () => { join.disabled = true; note.textContent = T('Joining…'); try { await L().join(code.value, label.value); paint(); } catch (e) { note.textContent = String(e.message || e); join.disabled = false; } };
        code.addEventListener('keydown', (e) => { if (e.key === 'Enter') join.click(); });
        root.appendChild(h('div', { class: 'pd-empty' },
          h('div', { class: 'pd-logo', html: PatOS.iconHTML('patdrop') }), h('h2', {}, 'PatDrop'),
          h('p', {}, T('Chat with your friend and drop files, links, clipboard text and apps straight into their PatOS. It is encrypted on your device, it works offline (things wait until you are online), and nobody needs an account.')),
          h('div', { class: 'pd-card' }, h('b', {}, T('Start')), h('p', {}, T('Make a code, then give it to your friend. They type it in PatDrop on their PatOS.')), label, make),
          h('div', { class: 'pd-card' }, h('b', {}, T('Have a code?')), h('p', {}, T('Type the code your friend gave you.')), code, join),
          note));
      }

      /* the chat */
      let shownCode = false, list, input, bar;
      function bubble(x) {
        const mine = x.mine; const meta = h('div', { class: 'pd-meta' }, (mine ? T('You') : x.from.name + (x.from.device ? ' · ' + x.from.device : '')) + ' · ' + clock(x.t) + (mine && x.status === 'sending' ? ' · ' + T('Waiting to send') : mine && x.status === 'failed' ? ' · ' + T('Not sent') : ''));
        let body;
        if (x.k === 'text') body = h('div', { class: 'pd-text' }, x.text);
        else if (x.k === 'link') body = h('div', { class: 'pd-card2' }, h('b', {}, (() => { try { return new URL(x.url).host; } catch (e) { return x.url; } })()), h('small', {}, x.url), h('div', { class: 'pd-acts' }, h('button', { class: 'btn', onclick: () => PatOS.launch('browser', { url: x.url }) }, T('Open')), h('button', { class: 'btn', onclick: () => { try { navigator.clipboard.writeText(x.url); } catch (e) {} } }, T('Copy'))));
        else if (x.k === 'clip') body = h('div', { class: 'pd-card2' }, h('small', {}, T('Clipboard')), h('div', { class: 'pd-clip' }, x.text.slice(0, 400) + (x.text.length > 400 ? '…' : '')), h('div', { class: 'pd-acts' }, h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(x.text); PatOS.notify({ title: T('Copied'), body: '', icon: 'patdrop' }); } catch (e) { fail(new Error(T('PatOS could not use your clipboard.'))); } } }, T('Copy'))));
        else if (x.k === 'file') {
          const ic = h('div', { class: 'pd-file' });
          if (x.path && /^image\//.test(x.mime || '') && x.size < 4e6) PatOS.fs.blobURL(x.path).then((u) => { if (u) { ic.innerHTML = ''; ic.appendChild(h('img', { src: u, alt: x.name })); } }).catch(() => {});
          const acts = x.path ? h('div', { class: 'pd-acts' }, h('button', { class: 'btn', onclick: () => PatOS.openFile(x.path) }, T('Open')), h('button', { class: 'btn', onclick: () => PatOS.launch('finder', { path: PatOS.fs.dirname(x.path) }) }, T('Show in Finder'))) : h('small', {}, x.failed ? T('This file could not be saved.') : mine ? T('Sent from another of your devices.') : '');
          body = h('div', { class: 'pd-card2' }, ic, h('b', {}, x.name), h('small', {}, fmtSize(x.size) + (x.path ? ' · ' + T('Saved in Downloads › PatDrop') : '')), acts);
        } else if (x.k === 'app') {
          const a = x.app, have = PatOS.patapps && PatOS.patapps.get(a.id);
          const act = h('button', { class: 'btn primary' }, have && PatOS.patapps.cmp(a.version, have.version) <= 0 ? T('Open') : have ? T('Update') : T('Install'));
          act.onclick = async () => { try { if (have && PatOS.patapps.cmp(a.version, have.version) <= 0) PatOS.patapps.open(a.id); else if (await PatOS.patapps.install(a, { source: 'file' })) paint(); } catch (e) { fail(e); } };
          body = h('div', { class: 'pd-card2' }, h('div', { class: 'pd-app' }, h('div', { class: 'as-ic', html: tile(a) }), h('div', {}, h('b', {}, a.name + ' ' + a.version), h('small', {}, (a.author ? a.author + ' · ' : '') + (a.permissions.length ? T('Asks for:') + ' ' + a.permissions.map((p) => PatOS.patapps.permInfo(p)[0]).join(', ') : T('Asks for nothing special'))))), mine ? h('small', {}, T('You sent this app.')) : h('div', { class: 'pd-acts' }, act, h('small', {}, T('Nobody checked this app. Only install apps from people you trust.'))));
        }
        return h('div', { class: 'pd-row' + (mine ? ' mine' : '') }, h('div', { class: 'pd-b' }, meta, body));
      }
      function paint(showCode) {
        if (showCode) shownCode = true;
        if (!L().linked()) { welcome(); win.setTitle('PatDrop'); return; }
        const s = L().status(); const keepScroll = list ? list.scrollTop : 0, atBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 60;
        win.setTitle(s.label || 'PatDrop');
        root.innerHTML = '';
        const status = s.state === 'offline' || s.offline ? T('Offline: what you send waits and goes out later') : s.state === 'key' ? T('Wrong code for this server') : s.state === 'full' ? T('The server is full') : s.state === 'error' ? T('The server had a problem') : s.outbox ? T('Sending…') : T('Connected');
        const code = h('div', { class: 'pd-code' }, h('div', {}, h('b', {}, T('Your PatDrop code')), h('small', {}, T('Give it to your friend. Anyone with this code can read and write in this chat. Make a new chat to change it.'))), h('div', { class: 'pd-codebox' }, L().code()), h('div', { class: 'pd-acts' }, h('button', { class: 'btn', onclick: () => { try { navigator.clipboard.writeText(L().code()); PatOS.notify({ title: T('Code copied'), body: '', icon: 'patdrop' }); } catch (e) {} } }, T('Copy')), h('button', { class: 'btn', onclick: () => { shownCode = false; paint(); } }, T('Hide'))));
        const head = h('div', { class: 'pd-head' }, h('div', {}, h('b', {}, s.label || T('PatDrop')), h('small', {}, status)), h('div', { class: 'pd-acts' }, h('button', { class: 'tbtn', title: T('Show the code'), onclick: () => { shownCode = !shownCode; paint(); } }, T('Code')), h('button', { class: 'tbtn', title: T('More'), onclick: moreMenu }, '•••')));
        list = h('div', { class: 'pd-list', role: 'log', 'aria-live': 'polite' });
        const feed = L().feed();
        if (!feed.length) list.appendChild(h('div', { class: 'pd-hint' }, T('Nothing here yet. Say hi, or press + to send a file, a link, your clipboard or an app.'))); else feed.forEach((x) => list.appendChild(bubble(x)));
        input = h('input', { class: 'field pd-in', placeholder: T('Message'), maxlength: '5000', 'aria-label': T('Message') });
        const send = h('button', { class: 'btn primary' }, T('Send')); const go = () => { const v = input.value; if (!v.trim()) return; try { L().sendText(v); input.value = ''; } catch (e) { fail(e); } };
        send.onclick = go; input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        const plus = h('button', { class: 'btn', 'aria-label': T('Attach') }, '+'); plus.onclick = () => attachMenu(plus);
        bar = h('div', { class: 'pd-bar' }, plus, input, send);
        root.append(...[head, shownCode ? code : null, list, bar].filter(Boolean));
        list.scrollTop = atBottom ? list.scrollHeight : keepScroll;
        L().markSeen();
      }
      const pick = (multiple) => new Promise((res) => { const i = h('input', { type: 'file', multiple: !!multiple }); i.style.display = 'none'; document.body.appendChild(i); i.onchange = () => { const f = [...i.files]; i.remove(); res(f); }; i.addEventListener('cancel', () => { i.remove(); res([]); }); i.click(); });
      async function sendFiles(files) { for (const f of files) { try { await L().sendFile(f); } catch (e) { fail(e); } } }
      function attachMenu(anchor) {
        const r = anchor.getBoundingClientRect(); const apps = PatOS.patapps ? PatOS.patapps.list() : [];
        PatOS.menu([
          { label: T('File from this computer…'), action: async () => sendFiles(await pick(true)) },
          { label: T('Link…'), action: async () => { const u = await PatOS.ask(T('Send a link'), 'https://', { icon: 'patdrop', ok: T('Send') }); if (u) try { L().sendLink(u); } catch (e) { fail(e); } } },
          { label: T('My clipboard'), action: async () => { try { await L().sendClipboard(); } catch (e) { fail(e); } } },
          apps.length ? { divider: true } : null, apps.length ? { header: T('Send an app') } : null,
          ...apps.map((a) => ({ label: a.app.name + ' ' + a.app.version, action: () => { try { L().sendApp(a.app); } catch (e) { fail(e); } } }))
        ].filter(Boolean), r.left, r.top - 4);
      }
      function moreMenu(e) {
        const r = e.currentTarget.getBoundingClientRect();
        PatOS.menu([
          { label: T('Name this chat…'), action: async () => { const n = await PatOS.ask(T('Name this chat'), L().label(), { icon: 'patdrop', ok: T('Save') }); if (n != null) { L().setLabel(n); paint(); } } },
          { label: T('Clear the history on this device'), action: async () => { if (await PatOS.confirmBox(T('Clear the history?'), T('The messages are removed from this device only. Files you received stay in Downloads.'), { ok: T('Clear'), danger: true, icon: 'patdrop' })) { L().clearHistory(); paint(); } } },
          { divider: true },
          { label: T('Leave this chat…'), action: async () => {
            if (!(await PatOS.confirmBox(T('Leave this chat?'), T('This device leaves the chat. Messages already here are kept until you clear them.'), { ok: T('Leave'), danger: true, icon: 'patdrop' }))) return;
            const wipe = await PatOS.confirmBox(T('Also delete it for everyone?'), T('Delete the encrypted messages from the server too? That ends the chat for your friend as well.'), { ok: T('Delete for everyone'), cancel: T('Keep it for my friend'), safe: true, danger: true, icon: 'patdrop' });
            await L().leave(wipe); paint(); } }
        ], r.left, r.bottom + 4);
      }

      /* dropping files anywhere in the window sends them */
      root.addEventListener('dragover', (e) => { if (L().linked() && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); root.classList.add('drop'); } });
      root.addEventListener('dragleave', () => root.classList.remove('drop'));
      root.addEventListener('drop', (e) => { root.classList.remove('drop'); if (!L().linked() || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); sendFiles([...e.dataTransfer.files]); });

      paint(); L().now().catch(() => {});
    },
    onArgs(win) { if (win._focus) win._focus(); }
  });
  PatOS.iconDefs.patdrop = { bg: 'linear-gradient(160deg,#35d6c4,#0a6cff)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M14 26h30m0 0-8-8m8 8-8 8" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 40H20m0 0 8-8m-8 8 8 8" stroke="#fff" stroke-opacity=".75" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' };
})();
/* "Send with PatDrop" from Finder: files (not folders) go to the chat; if there is no chat yet, PatDrop opens to make one */
PatOS.sendWithPatDrop = async function (paths) {
  const files = (paths || []).filter((p) => { const n = PatOS.fs.get(p); return n && n.type === 'file'; });
  if (!files.length) return;
  if (!PatOS.link.linked()) { PatOS.launch('patdrop'); return PatOS.alertBox(PatOS.t('Link PatDrop first'), PatOS.t('Make or enter a code in PatDrop, then send the file again.'), { icon: 'patdrop' }); }
  let ok = 0;
  for (const p of files) { try { await PatOS.link.sendPath(p); ok++; } catch (e) { PatOS.alertBox(PatOS.t('That didn’t work'), String(e.message || e), { icon: 'patdrop' }); } }
  if (ok) PatOS.notify({ title: PatOS.t('Sent with PatDrop'), body: ok + ' ' + PatOS.t(ok === 1 ? 'file' : 'files'), icon: 'patdrop' });
};
