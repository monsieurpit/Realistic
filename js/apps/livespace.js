/* PatOS Live (4.0): working together in real time, inside a Shared Space (js/spaces.js gives the spaces, members and roles).
   - Here now: who has the space open, and in which part (presence, written every 30 s only while this window is open)
   - Boards: stickies, text and boxes everyone moves at once
   - Live notes: one paragraph per block, so two people write different paragraphs at the same time
   - Tasks: a shared list with who does what
   - Voice: a call between the members (WebRTC, browser to browser; the database only carries how to connect)
   Conflict-safe: every item, paragraph and task has a revision. A change is written only on top of the revision it was
   made from (vendor-src/firebase-entry.js livePut, checked again by firestore.rules). If someone changed it first, their
   change stays and yours is kept next to it ("your version"), never silently lost. */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  PatOS.iconDefs.livespace = { bg: 'linear-gradient(160deg,#ff6b6b,#ff2d55 55%,#bf5af2)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="24" r="7" fill="#fff"/><circle cx="42" cy="24" r="7" fill="#fff" opacity=".8"/><path d="M9 46c1-7 6-11 13-11s12 4 13 11z" fill="#fff"/><path d="M29 46c1-7 6-11 13-11s12 4 13 11z" fill="#fff" opacity=".8"/><circle cx="50" cy="12" r="5" fill="#30d158" stroke="#fff" stroke-width="2"/></svg>' };
  const COLORS = ['#ffd60a', '#ff9f0a', '#ff6b6b', '#64d2ff', '#30d158', '#bf5af2', '#f2f2f7'];
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
  const ms = (t) => (!t ? 0 : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : +t);
  const MID = (a, b) => (a + b) / 2;

  PatOS.registerApp({
    id: 'livespace', name: 'PatOS Live', icon: 'livespace', width: 1080, height: 680, minWidth: 420, minHeight: 380, category: 'Productivity', keywords: 'live together collaborate real time board whiteboard notes tasks voice call presence ensemble tableau appel',
    about: 'Work together in real time inside a Shared Space: boards, live notes, tasks and voice.',
    launch(win, args) {
      const S = PatOS.spaces; let F = null;
      let sid = args.sid || null, view = { kind: 'home' }, offs = [], viewOffs = [];
      let presence = [], boards = [], notes = [], tasks = [], calls = [];
      let call = null; // { cid, stream, peers: Map(uid → { pc, audio }), off, muted, activity }
      const side = h('div', { class: 'lv-side' }), main = h('div', { class: 'lv-main' });
      win.body.appendChild(h('div', { class: 'lv' }, side, main));
      const me = () => S.me();
      const sp = () => S.get(sid);
      const canEdit = () => S.can(sp(), 'edit'), canTalk = () => S.can(sp(), 'comment');
      const nameOf = (uid) => ((sp() && sp().names) || {})[uid] || '?';
      const toast = (title, body) => PatOS.notify({ title, body: body || '', icon: 'livespace', priority: 'low' });
      const guard = async (fn) => { try { return await fn(); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message || String(e), { icon: 'livespace' }); return null; } };
      const P = (...rest) => ['spaces', sid, ...rest];

      /* ---------- the space: what is in it, who is here ---------- */
      let beat = null;
      const here = () => (view.kind === 'board' ? 'board:' + view.id : view.kind === 'note' ? 'note:' + view.id : view.kind);
      function heartbeat() { if (F && sid && me()) F.presenceSet(me(), sid, here(), document.hidden ? 'away' : 'active').catch(() => {}); }
      function leaveSpace() {
        offs.forEach((o) => o && o()); offs = []; clearInterval(beat); beat = null;
        if (F && sid && me()) F.presenceClear(me(), sid).catch(() => {});
        presence = boards = notes = tasks = calls = [];
      }
      async function enter(id) {
        if (call) await hangUp();
        leaveSpace(); closeView(); sid = id; view = { kind: 'home' };
        if (!sid) return draw();
        try { F = F || await PatOS.account.cloud(); } catch (e) { F = null; return draw(); }
        offs.push(F.presenceListen(sid, (l) => { presence = l; drawSide(); if (view.kind === 'home') drawMain(); }, () => {}));
        offs.push(F.liveListen(P('boards'), (l) => { boards = l.sort((a, b) => ms(a.at) - ms(b.at)); drawSide(); if (view.kind === 'home') drawMain(); }, () => {}));
        offs.push(F.liveListen(P('notes'), (l) => { notes = l.sort((a, b) => ms(a.at) - ms(b.at)); drawSide(); if (view.kind === 'home') drawMain(); }, () => {}));
        offs.push(F.liveListen(P('tasks'), (l) => { tasks = l.sort((a, b) => ms(a.at) - ms(b.at)); if (view.kind === 'tasks' || view.kind === 'home') drawMain(); drawSide(); }, () => {}));
        offs.push(F.liveListen(P('calls'), (l) => { calls = l; drawSide(); if (view.kind === 'call' || view.kind === 'home') drawMain(); }, () => {}));
        heartbeat(); beat = setInterval(heartbeat, 30000);
        draw();
      }
      const onVis = () => heartbeat(); document.addEventListener('visibilitychange', onVis);
      const fresh = (p) => Date.now() - ms(p.at) < 90000; // (someone whose window closed without saying so disappears after 90 s)
      const herePeople = () => presence.filter(fresh);

      function drawSide() {
        side.innerHTML = '';
        if (!S.ready()) { side.appendChild(h('p', { class: 'lv-muted' }, T('Sign in to your PatOS account to work with others.'))); return; }
        side.appendChild(h('div', { class: 'lv-sh' }, T('Spaces')));
        S.list().forEach((s) => side.appendChild(h('button', { class: 'lv-si' + (s.id === sid ? ' on' : ''), onclick: () => enter(s.id) }, h('span', { class: 'lv-dot' }, (s.name || '?').charAt(0).toUpperCase()), h('span', {}, s.name))));
        if (!S.list().length) side.appendChild(h('p', { class: 'lv-muted' }, T('Make a space in Shared Spaces and invite people: then work on it together here.')), h('button', { class: 'btn', onclick: () => PatOS.launch('spaces') }, T('Open Shared Spaces')));
        if (!sp()) return;
        const people = herePeople();
        side.appendChild(h('div', { class: 'lv-sh' }, T('Here now') + ' · ' + people.length));
        side.appendChild(h('div', { class: 'lv-here' }, ...people.map((p) => h('span', { class: 'lv-av' + (p.state === 'away' ? ' away' : ''), title: '@' + p.name + ' · ' + where(p.app) + (p.state === 'away' ? ' · ' + T('away') : '') }, p.name.charAt(0).toUpperCase()))));
        const item = (kind, it, label) => h('button', { class: 'lv-si' + (view.kind === kind && view.id === it.id ? ' on' : ''), onclick: () => open({ kind, id: it.id }) }, h('span', { class: 'lv-k lv-k-' + kind }), h('span', {}, label), h('small', {}, people.filter((p) => p.app === kind + ':' + it.id).map((p) => p.name.charAt(0).toUpperCase()).join(' ')));
        side.appendChild(h('div', { class: 'lv-sh' }, T('Boards'), canEdit() ? h('button', { class: 'lv-add', title: T('New Board'), 'aria-label': T('New Board'), onclick: () => newHead('boards') }, '+') : null));
        boards.forEach((b) => side.appendChild(item('board', b, b.name)));
        side.appendChild(h('div', { class: 'lv-sh' }, T('Live Notes'), canEdit() ? h('button', { class: 'lv-add', title: T('New Note'), 'aria-label': T('New Note'), onclick: () => newHead('notes') }, '+') : null));
        notes.forEach((n) => side.appendChild(item('note', n, n.title)));
        side.appendChild(h('div', { class: 'lv-sh' }, T('Together')));
        side.appendChild(h('button', { class: 'lv-si' + (view.kind === 'tasks' ? ' on' : ''), onclick: () => open({ kind: 'tasks' }) }, h('span', { class: 'lv-k lv-k-tasks' }), h('span', {}, T('Tasks')), h('small', {}, String(tasks.filter((t) => !t.done).length))));
        side.appendChild(h('button', { class: 'lv-si' + (view.kind === 'call' ? ' on' : '') + (calls.length ? ' live' : ''), onclick: () => open({ kind: 'call' }) }, h('span', { class: 'lv-k lv-k-call' }), h('span', {}, call ? T('In the call') : calls.length ? T('A call is on') : T('Voice'))));
      }
      function where(app) { if (!app) return ''; const [k, id] = String(app).split(':'); if (k === 'board') return (boards.find((b) => b.id === id) || {}).name || T('a board'); if (k === 'note') return (notes.find((n) => n.id === id) || {}).title || T('a note'); return T(({ home: 'Overview', tasks: 'Tasks', call: 'Voice' })[k] || k); }
      async function newHead(kind) {
        const n = await PatOS.ask(kind === 'boards' ? T('New Board') : T('New Note'), kind === 'boards' ? T('Ideas') : T('Meeting notes'), { ok: T('Create'), icon: 'livespace' }); if (!n) return;
        const id = await guard(() => F.liveHeadCreate(me(), sid, kind, n.trim().slice(0, 60) || T('Untitled')));
        if (id) open({ kind: kind === 'boards' ? 'board' : 'note', id });
      }
      function draw() { drawSide(); drawMain(); }
      function closeView() { viewOffs.forEach((o) => o && o()); viewOffs = []; }
      function open(v) { closeView(); view = v; heartbeat(); draw(); }
      function drawMain() {
        if (view.kind === 'board' || view.kind === 'note') { if (!main.querySelector('.lv-board, .lv-note')) { main.innerHTML = ''; view.kind === 'board' ? boardView() : noteView(); } return; }
        main.innerHTML = '';
        if (!S.ready() || !sp()) return main.appendChild(h('div', { class: 'lv-empty' }, h('span', { class: 'lv-ic', html: PatOS.iconHTML('livespace') }), h('h2', {}, T('PatOS Live')), h('p', {}, S.ready() ? T('Pick a space to work in it with the others, at the same time.') : T('Sign in to your PatOS account to work with others.'))));
        if (view.kind === 'tasks') return tasksView();
        if (view.kind === 'call') return callView();
        // overview
        const people = herePeople();
        main.append(h('div', { class: 'lv-head' }, h('h2', {}, sp().name), h('span', { class: 'lv-role' }, T(S.roleOf(sp())))),
          h('div', { class: 'lv-cards' },
            card(T('Here now'), people.length ? people.map((p) => '@' + p.name + ' — ' + where(p.app)).join('\n') : T('Only you right now.')),
            card(T('Boards'), boards.length + ' · ' + boards.map((b) => b.name).slice(0, 4).join(', ')),
            card(T('Live Notes'), notes.length + ' · ' + notes.map((n) => n.title).slice(0, 4).join(', ')),
            card(T('Tasks'), tasks.filter((t) => !t.done).length + ' ' + T('to do') + ' · ' + tasks.filter((t) => t.done).length + ' ' + T('done')),
            card(T('Voice'), calls.length ? T('A call is on.') : T('No call right now.'))),
          h('p', { class: 'lv-fine' }, T('Everything here is stored in PatOS’s cloud so the members can see it, like the rest of a Shared Space. Voice goes straight between browsers.')));
      }
      const card = (title, text) => h('div', { class: 'lv-card' }, h('b', {}, title), h('p', {}, text));

      /* ---------- a board ---------- */
      function boardView() {
        const bid = view.id; const b = boards.find((x) => x.id === bid);
        let items = new Map(); const els = new Map(); const busy = new Set(); // (an item being dragged or typed in isn't redrawn under you)
        const plane = h('div', { class: 'lv-plane' });
        const bar = h('div', { class: 'lv-bar' }, h('b', {}, b ? b.name : T('Board')), canEdit() ? h('div', { class: 'lv-colors' }, ...['sticky', 'text', 'box'].map((k) => h('button', { class: 'btn', onclick: () => add(k, 40 + Math.random() * 200, 40 + Math.random() * 120) }, T(({ sticky: 'Sticky', text: 'Text', box: 'Box' })[k])))) : h('span', { class: 'lv-muted' }, T('You can look, not change.')),
          canEdit() ? h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox(T('Delete this board?'), T('It is deleted for everyone in the space.'), { danger: true })) { await guard(() => F.liveHeadDelete(sid, 'boards', bid)); open({ kind: 'home' }); } } }, T('Delete')) : null);
        const root = h('div', { class: 'lv-board' }, bar, h('div', { class: 'lv-scroll' }, plane));
        main.appendChild(root);
        plane.addEventListener('dblclick', (e) => { if (e.target === plane && canEdit()) { const r = plane.getBoundingClientRect(); add('sticky', e.clientX - r.left - 80, e.clientY - r.top - 20); } });
        async function add(kind, x, y) {
          const it = { kind, x: Math.round(Math.max(0, x)), y: Math.round(Math.max(0, y)), w: kind === 'text' ? 220 : 170, h: kind === 'text' ? 60 : 130, text: '', color: kind === 'box' ? '#64d2ff' : kind === 'text' ? '#f2f2f7' : '#ffd60a' };
          const r = await guard(() => F.livePut(me(), P('boards', bid, 'items'), null, it, 0)); if (r && r.id) setTimeout(() => { const el = els.get(r.id); if (el) el.querySelector('textarea').focus(); }, 300);
        }
        // a change, on top of the revision it was made from; if someone was first, theirs stays and yours is kept beside it
        async function put(id, patch) {
          const cur = items.get(id); if (!cur) return;
          const data = { kind: cur.kind, x: cur.x, y: cur.y, w: cur.w, h: cur.h, text: cur.text, color: cur.color }; Object.assign(data, patch);
          const r = await guard(() => F.livePut(me(), P('boards', bid, 'items'), id, data, cur.rev)); if (!r) return;
          if (r.conflict && r.theirs) {
            const textClash = patch.text != null && patch.text !== r.theirs.text;
            if (textClash) { await guard(() => F.livePut(me(), P('boards', bid, 'items'), null, Object.assign({}, data, { x: Math.min(r.theirs.x + 30, 99000), y: Math.min(r.theirs.y + 30, 99000), text: (T('Your version') + ': ' + patch.text).slice(0, 2000) }), 0)); toast(T('Someone changed it first'), '@' + (r.theirs.byName || '?') + ' · ' + T('Your version was kept next to theirs.')); }
            else toast(T('Someone moved it first'), '@' + (r.theirs.byName || '?'));
            items.set(id, Object.assign({ id }, r.theirs)); paint(id);
          }
        }
        function paint(id) {
          const it = items.get(id); let el = els.get(id);
          if (!it) { if (el) { el.remove(); els.delete(id); } return; }
          if (!el) {
            const ta = h('textarea', { 'aria-label': T('Text'), placeholder: canEdit() ? T('Write…') : '', readonly: !canEdit() || undefined });
            el = h('div', { class: 'lv-it' }, h('div', { class: 'lv-grip', title: T('Drag to move') }), ta, h('small', { class: 'lv-by' }));
            if (canEdit()) {
              ta.addEventListener('focus', () => busy.add(id)); ta.addEventListener('blur', () => { busy.delete(id); const cur = items.get(id); if (cur && ta.value !== cur.text) put(id, { text: ta.value.slice(0, 2000) }); });
              el.addEventListener('contextmenu', (e) => { e.preventDefault(); PatOS.menu([...COLORS.map((c) => ({ label: '● ' + c, action: () => put(id, { color: c }) })), { divider: true }, { label: T('Delete'), action: () => guard(() => F.liveDelete(P('boards', bid, 'items'), id)) }], e.clientX, e.clientY); });
              const grip = el.querySelector('.lv-grip');
              grip.addEventListener('pointerdown', (e) => {
                e.preventDefault(); grip.setPointerCapture(e.pointerId); busy.add(id); const cur = items.get(id); const sx = e.clientX, sy = e.clientY, ox = cur.x, oy = cur.y; let nx = ox, ny = oy;
                const mv = (ev) => { nx = Math.max(0, Math.round(ox + ev.clientX - sx)); ny = Math.max(0, Math.round(oy + ev.clientY - sy)); el.style.transform = `translate(${nx}px,${ny}px)`; };
                const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); busy.delete(id); if (nx !== ox || ny !== oy) put(id, { x: nx, y: ny }); };
                grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
              });
            }
            els.set(id, el); plane.appendChild(el);
          }
          if (busy.has(id)) return;
          el.className = 'lv-it lv-' + it.kind; el.dataset.id = id;
          el.style.cssText = `transform:translate(${it.x}px,${it.y}px);width:${it.w}px;height:${it.h}px;--c:${it.color}`;
          const ta = el.querySelector('textarea'); if (document.activeElement !== ta) ta.value = it.text || '';
          el.querySelector('.lv-by').textContent = '@' + (it.byName || '');
        }
        viewOffs.push(F.liveListen(P('boards', bid, 'items'), (l) => { const seen = new Set(); l.forEach((it) => { seen.add(it.id); items.set(it.id, it); paint(it.id); }); [...items.keys()].filter((k) => !seen.has(k)).forEach((k) => { items.delete(k); paint(k); }); }, () => {}));
        win._live.board = { add, put, items: () => [...items.values()] };
      }

      /* ---------- a live note: one block per paragraph ---------- */
      function noteView() {
        const nid = view.id; const n = notes.find((x) => x.id === nid);
        let blocks = []; const els = new Map(); const editing = new Set(); const timers = new Map();
        const list = h('div', { class: 'lv-blocks' });
        const root = h('div', { class: 'lv-note' }, h('div', { class: 'lv-bar' }, h('b', {}, n ? n.title : T('Note')), h('span', { class: 'lv-muted' }, canEdit() ? T('Two people can write different paragraphs at the same time.') : T('You can read, not change.')),
          canEdit() ? h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox(T('Delete this note?'), T('It is deleted for everyone in the space.'), { danger: true })) { await guard(() => F.liveHeadDelete(sid, 'notes', nid)); open({ kind: 'home' }); } } }, T('Delete')) : null), list,
          canEdit() ? h('button', { class: 'btn lv-addb', onclick: () => addBlock(blocks.length ? blocks[blocks.length - 1].order + 1 : 1, '') }, '+ ' + T('Paragraph')) : null);
        main.appendChild(root);
        async function addBlock(order, text, focus) { const r = await guard(() => F.livePut(me(), P('notes', nid, 'blocks'), null, { order, text }, 0)); if (r && r.id && focus !== false) setTimeout(() => { const el = els.get(r.id); if (el) el.querySelector('textarea').focus(); }, 300); return r; }
        async function save(id, text) {
          const cur = blocks.find((x) => x.id === id); if (!cur || cur.text === text) return;
          const r = await guard(() => F.livePut(me(), P('notes', nid, 'blocks'), id, { order: cur.order, text }, cur.rev)); if (!r) return;
          if (r.conflict && r.theirs) { // both kept: theirs where it was, yours right after
            const i = blocks.indexOf(cur); const next = blocks[i + 1]; await addBlock(next ? MID(cur.order, next.order) : cur.order + 1, text, false);
            toast(T('Someone changed this paragraph first'), '@' + (r.theirs.byName || '?') + ' · ' + T('Your version was kept just after theirs.'));
          }
        }
        function paintAll() {
          const seen = new Set();
          blocks.forEach((bk, i) => {
            seen.add(bk.id); let el = els.get(bk.id);
            if (!el) {
              const ta = h('textarea', { rows: 1, 'aria-label': T('Paragraph'), readonly: !canEdit() || undefined });
              const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
              ta.addEventListener('input', () => { fit(); clearTimeout(timers.get(bk.id)); timers.set(bk.id, setTimeout(() => save(bk.id, ta.value.slice(0, 5000)), 900)); });
              ta.addEventListener('focus', () => editing.add(bk.id)); ta.addEventListener('blur', () => { editing.delete(bk.id); clearTimeout(timers.get(bk.id)); save(bk.id, ta.value.slice(0, 5000)); });
              ta.addEventListener('keydown', (e) => {
                const cur = blocks.find((x) => x.id === bk.id); const k = blocks.indexOf(cur);
                if (e.key === 'Enter' && !e.shiftKey && canEdit()) { e.preventDefault(); const next = blocks[k + 1]; save(bk.id, ta.value); addBlock(next ? MID(cur.order, next.order) : cur.order + 1, ''); }
                if (e.key === 'Backspace' && !ta.value && blocks.length > 1 && canEdit()) { e.preventDefault(); const prev = blocks[k - 1]; guard(() => F.liveDelete(P('notes', nid, 'blocks'), bk.id)); if (prev && els.get(prev.id)) els.get(prev.id).querySelector('textarea').focus(); }
              });
              el = h('div', { class: 'lv-blk' }, ta, h('small', { class: 'lv-by' })); el._fit = fit; els.set(bk.id, el);
            }
            const ta = el.querySelector('textarea');
            if (!editing.has(bk.id) && ta.value !== bk.text) ta.value = bk.text || '';
            el.classList.toggle('changed', editing.has(bk.id) && ta.value !== bk.text && bk.by !== (me() || {}).uid);
            el.querySelector('.lv-by').textContent = '@' + (bk.byName || '');
            if (list.children[i] !== el) list.insertBefore(el, list.children[i] || null); el._fit();
          });
          [...els.keys()].filter((k) => !seen.has(k)).forEach((k) => { els.get(k).remove(); els.delete(k); });
          if (!blocks.length && !list.querySelector('.lv-muted')) list.appendChild(h('p', { class: 'lv-muted' }, T('Empty. Add a paragraph.')));
          else if (blocks.length) { const m = list.querySelector('.lv-muted'); if (m) m.remove(); }
        }
        viewOffs.push(F.liveListen(P('notes', nid, 'blocks'), (l) => { blocks = l.sort((a, b) => a.order - b.order); paintAll(); }, () => {}));
        win._live.note = { addBlock, save, blocks: () => blocks.slice() };
      }

      /* ---------- tasks ---------- */
      function tasksView() {
        const members = Object.keys(sp().members || {});
        const input = h('input', { class: 'ui-input', placeholder: T('Add a task…'), 'aria-label': T('Add a task'), disabled: !canEdit() || undefined, onkeydown: (e) => { if (e.key === 'Enter' && input.value.trim()) { const t = input.value.trim().slice(0, 300); input.value = ''; guard(() => F.livePut(me(), P('tasks'), null, { text: t, done: false, assignee: '' }, 0)); } } });
        const put = async (t, patch) => { const r = await guard(() => F.livePut(me(), P('tasks'), t.id, Object.assign({ text: t.text, done: t.done, assignee: t.assignee || '' }, patch), t.rev)); if (r && r.conflict) toast(T('Someone changed it first'), '@' + ((r.theirs || {}).byName || '?')); };
        main.append(h('div', { class: 'lv-head' }, h('h2', {}, T('Tasks')), h('span', { class: 'lv-muted' }, tasks.filter((t) => !t.done).length + ' ' + T('to do'))), h('div', { class: 'lv-tadd' }, input),
          h('div', { class: 'lv-tasks' }, ...tasks.map((t) => h('div', { class: 'lv-task' + (t.done ? ' done' : '') },
            h('input', { type: 'checkbox', checked: t.done || undefined, disabled: !canEdit() || undefined, 'aria-label': t.text, onchange: (e) => put(t, { done: e.target.checked }) }),
            h('span', {}, t.text),
            h('select', { class: 'ui-select', disabled: !canEdit() || undefined, 'aria-label': T('Who does it'), onchange: (e) => put(t, { assignee: e.target.value }) }, h('option', { value: '' }, T('Nobody')), ...members.map((u) => h('option', { value: u, selected: t.assignee === u || undefined }, '@' + nameOf(u)))),
            canEdit() ? h('button', { class: 'btn', 'aria-label': T('Delete'), onclick: () => guard(() => F.liveDelete(P('tasks'), t.id)) }, '×') : null)),
            !tasks.length ? h('p', { class: 'lv-muted' }, T('No tasks yet.')) : null));
        if (canEdit()) input.focus();
      }

      /* ---------- voice ---------- */
      function callView() {
        const c = calls[0];
        const peopleIn = call ? [...call.peers.keys()].map(nameOf) : [];
        main.append(h('div', { class: 'lv-head' }, h('h2', {}, T('Voice')), h('span', { class: 'lv-muted' }, T('Up to 4 people, straight between your browsers.'))),
          h('div', { class: 'lv-call' },
            call ? h('div', {}, h('p', {}, T('You are in the call.') + (peopleIn.length ? ' ' + T('With') + ' @' + peopleIn.join(', @') : ' ' + T('Waiting for the others…'))),
              h('div', { class: 'lv-cbtn' }, h('button', { class: 'btn', onclick: () => { call.muted = !call.muted; call.stream.getAudioTracks().forEach((t) => { t.enabled = !call.muted; }); drawMain(); } }, call.muted ? T('Unmute') : T('Mute')), h('button', { class: 'btn danger', onclick: () => hangUp() }, T('Leave'))))
              : !canTalk() ? h('p', { class: 'lv-muted' }, T('Viewers can’t join calls in this space.'))
                : h('div', {}, h('p', {}, c ? T('A call is on, started by') + ' @' + c.byName + '.' : T('No call right now.')), h('button', { class: 'btn primary', onclick: () => joinCall(c ? c.id : null) }, c ? T('Join the call') : T('Start a call')),
                  h('p', { class: 'lv-fine' }, T('PatOS asks for your microphone only when you join, and stops using it when you leave. The sound goes between browsers; PatOS’s cloud only passes the messages that connect them.')))));
      }
      async function joinCall(cid) {
        if (call) return; if (!navigator.mediaDevices || !window.RTCPeerConnection) return PatOS.alertBox(T('Voice isn’t available'), T('This browser can’t make calls.'), { icon: 'livespace' });
        let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); } catch (e) { return PatOS.alertBox(T('No microphone'), T('PatOS couldn’t use the microphone: ') + (e.message || e.name), { icon: 'livespace' }); }
        const id = cid || await guard(() => F.callStart(me(), sid)); if (!id) { stream.getTracks().forEach((t) => t.stop()); return; }
        call = { cid: id, stream, peers: new Map(), muted: false, offs: [] };
        try { call.activity = PatOS.live && PatOS.live.start({ app: 'livespace', title: T('In a call') + ' · ' + sp().name }); } catch (e) {}
        await guard(() => F.callJoin(me(), sid, id));
        const my = me().uid;
        const peerFor = (uid) => {
          if (call.peers.has(uid)) return call.peers.get(uid).pc;
          const pc = new RTCPeerConnection({ iceServers: ICE }); const audio = new Audio(); audio.autoplay = true;
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));
          pc.onicecandidate = (e) => { if (e.candidate) F.signalSend(me(), sid, id, uid, 'ice', JSON.stringify(e.candidate)).catch(() => {}); };
          pc.ontrack = (e) => { audio.srcObject = e.streams[0]; audio.play().catch(() => {}); };
          pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) drop(uid); drawMain(); };
          call.peers.set(uid, { pc, audio }); return pc;
        };
        const drop = (uid) => { const p = call && call.peers.get(uid); if (!p) return; try { p.pc.close(); } catch (e) {} p.audio.srcObject = null; call.peers.delete(uid); };
        // who is in the call: the one with the smaller id makes the offer (so two people never both offer)
        call.offs.push(F.liveListen(P('calls', id, 'peers'), async (l) => {
          if (!call) return; const ids = l.map((x) => x.id).filter((u) => u !== my).slice(0, 3);
          for (const u of ids) if (!call.peers.has(u) && my < u) { const pc = peerFor(u); const o = await pc.createOffer(); await pc.setLocalDescription(o); F.signalSend(me(), sid, id, u, 'offer', JSON.stringify(o)).catch(() => {}); }
          [...call.peers.keys()].filter((u) => !ids.includes(u)).forEach(drop); drawMain();
        }, () => {}));
        call.offs.push(F.signalsListen(me(), sid, id, async (l) => {
          for (const s of l) {
            if (!call) return; F.signalDelete(sid, id, s.id).catch(() => {});
            try {
              if (s.type === 'offer') { const pc = peerFor(s.from); await pc.setRemoteDescription(JSON.parse(s.data)); const a = await pc.createAnswer(); await pc.setLocalDescription(a); F.signalSend(me(), sid, id, s.from, 'answer', JSON.stringify(a)).catch(() => {}); }
              else if (s.type === 'answer') { const p = call.peers.get(s.from); if (p) await p.pc.setRemoteDescription(JSON.parse(s.data)); }
              else if (s.type === 'ice') { const p = call.peers.get(s.from); if (p) await p.pc.addIceCandidate(JSON.parse(s.data)); }
              else if (s.type === 'bye') drop(s.from);
            } catch (e) {}
          }
          drawMain();
        }, () => {}));
        open({ kind: 'call' });
      }
      async function hangUp() {
        const c = call; if (!c) return; call = null;
        c.offs.forEach((o) => o && o()); c.peers.forEach((p, uid) => { F.signalSend(me(), sid, c.cid, uid, 'bye', '').catch(() => {}); try { p.pc.close(); } catch (e) {} p.audio.srcObject = null; });
        c.stream.getTracks().forEach((t) => t.stop()); // (the microphone is off from here)
        await F.callLeave(me(), sid, c.cid).catch(() => {});
        // the last one out ends the call
        const left = await new Promise((res) => { const off = F.liveListen(P('calls', c.cid, 'peers'), (l) => { off(); res(l.length); }, () => res(1)); });
        if (!left) await F.callEnd(sid, c.cid).catch(() => {});
        try { c.activity && c.activity.end('done', ''); } catch (e) {}
        if (view.kind === 'call') drawMain(); drawSide();
      }

      const onSpaces = () => { if (sid && !sp()) enter(null); else drawSide(); }; PatOS.on('spaces', onSpaces);
      win.on('closed', () => { PatOS.off && PatOS.off('spaces', onSpaces); document.removeEventListener('visibilitychange', onVis); if (call) hangUp(); closeView(); leaveSpace(); });
      win._live = { enter, open, view: () => view, people: herePeople, joinCall, hangUp, call: () => call, tasks: () => tasks.slice(), boards: () => boards.slice(), notes: () => notes.slice() };
      if (sid) enter(sid); else draw();
    },
    onArgs(win, args) { if (args && args.sid && win._live) win._live.enter(args.sid); }
  });
})();
