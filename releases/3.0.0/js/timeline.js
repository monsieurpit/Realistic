/* Timeline: PatOS remembers what you do, so you can find it again and pick up where you left off.
   - Activity: the apps and files you open, the files you save, the websites you visit, the notes you write.
   - Moments: the windows you had open (which app, which file, where), kept as you work; one click puts them back.
   - Clipboard: what you copy is kept (Alt+V opens it anywhere and pastes); pin what you want to keep for good.
   Everything stays on this device: it is never synced, never sent anywhere, and there are no screenshots. Nothing is
   recorded in Passwords or from password fields. Pause it, forget the last hour, a day or everything, or turn it off
   (Settings › Privacy, or the Timeline app). The Timeline app (js/apps/timeline.js) shows it all; this file records. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const DAY = 86400000, MIN = 60000;
  const MAX_EVENTS = 5000, MAX_MOMENTS = 300, MAX_CLIPS = 150, MAX_CLIP_LEN = 20000;
  // apps that are never recorded (secrets, the Timeline itself, system screens)
  const NEVER = new Set(['passwords', 'timeline', 'setup', 'launchpad', 'screenshot', 'extweb']);
  const on = () => PatOS.settings.timeline !== false && !paused();
  const clipsOn = () => PatOS.settings.timelineClips !== false && !paused();
  const keepDays = () => Math.max(1, +PatOS.settings.timelineDays || 30);

  let events = PatOS.store.get('timeline', []) || [];
  let moments = PatOS.store.get('timelineMoments', []) || [];
  let clips = PatOS.store.get('clipHistory', []) || [];
  if (!Array.isArray(events)) events = []; if (!Array.isArray(moments)) moments = []; if (!Array.isArray(clips)) clips = [];
  const bootT = Date.now();

  const save = PatOS.debounce(() => {
    PatOS.store.set('timeline', events.slice());
    PatOS.store.set('timelineMoments', moments.slice());
    PatOS.store.set('clipHistory', clips.slice());
  }, 1500);
  const changed = PatOS.debounce(() => PatOS.emit('timeline'), 250);
  const touch = () => { save(); changed(); };

  function paused() { const u = +PatOS.store.get('timelinePause', 0) || 0; return u > Date.now(); }
  function activeApp() { const w = PatOS.wm && PatOS.wm.active; return w ? w.app.id : ''; }

  /* ---------- activity ---------- */
  // one entry per thing: doing the same thing again soon moves it to now instead of adding a copy
  function record(ev, mergeMins) {
    if (!on() || !ev || !ev.key) return null;
    const now = Date.now(); ev.t = now;
    const win = (mergeMins == null ? 20 : mergeMins) * MIN;
    for (let i = events.length - 1; i >= 0 && now - events[i].t < win; i--) {
      if (events[i].key === ev.key) { const old = events.splice(i, 1)[0]; ev.n = (old.n || 1) + 1; break; }
    }
    events.push(ev);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    touch(); return ev;
  }

  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const strip = (html) => String(html || '').replace(/<(br|\/div|\/p|\/li)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const hidden = (p) => !p || /(^|\/)\./.test(p);

  function onOpen(win) {
    if (!win || !win.app || NEVER.has(win.app.id) || win.app.hidden) return;
    const a = win.args || {};
    if (a.path && typeof a.path === 'string') {
      if (hidden(a.path)) return;
      return record({ k: 'file', key: 'file:' + a.path, l: PatOS.fs.basename(a.path), s: PatOS.fs.dirname(a.path), verb: 'Opened', ref: { path: a.path } });
    }
    if (a.url) return; // websites come from the browser's history
    const args = PatOS.session ? PatOS.session.clean(a) : {};
    record({ k: 'app', key: 'app:' + win.app.id + (args.id ? ':' + args.id : ''), l: T(win.app.name), s: '', ic: win.app.icon || win.app.id, ref: { app: win.app.id, args } }, 30);
  }

  const fsSeen = {};
  function onFS(d) {
    if (!d || !d.path || hidden(d.path) || !on()) return;
    const p = d.path, now = Date.now();
    if (fsSeen[p] && now - fsSeen[p] < 90000) return; // autosave every few seconds is still one edit
    const n = PatOS.fs.get(p); if (!n || n.type !== 'file') return;
    if (NEVER.has(activeApp())) return;
    fsSeen[p] = now;
    record({ k: 'file', key: 'file:' + p, l: PatOS.fs.basename(p), s: PatOS.fs.dirname(p), verb: 'Edited', ref: { path: p } });
  }

  let lastWebT = Date.now(), lastNoteT = Date.now();
  function onStore(key) {
    if (!on()) return;
    if (key === 'browserHistory') {
      const H = PatOS.store.get('browserHistory', []) || [];
      H.filter((x) => x && x.t > lastWebT && /^https?:/.test(x.u || '') && !/igu=1/.test(x.u)).reverse().forEach((x) => {
        lastWebT = Math.max(lastWebT, x.t);
        let q = null; try { const U = new URL(x.u); if (/google\.|bing\.|duckduckgo\./.test(U.hostname) && U.searchParams.get('q')) q = U.searchParams.get('q'); } catch (e) {}
        if (q) record({ k: 'web', key: 'search:' + q.toLowerCase(), l: q, s: T('Web search'), verb: 'Searched', ref: { url: x.u } }, 60);
        else record({ k: 'web', key: 'web:' + x.u.replace(/#.*$/, ''), l: x.title && x.title !== hostOf(x.u) ? x.title : hostOf(x.u), s: hostOf(x.u), verb: 'Visited', ref: { url: x.u } }, 30);
      });
    } else if (key === 'notes') {
      const N = PatOS.store.get('notes', []) || [];
      N.filter((n) => n && !n.deletedAt && n.mtime > lastNoteT).forEach((n) => {
        lastNoteT = Math.max(lastNoteT, n.mtime);
        const title = (n.title || strip(n.body).trim().split('\n')[0] || T('Untitled')).slice(0, 90);
        record({ k: 'note', key: 'note:' + n.id, l: title, s: T('Notes'), verb: 'Wrote', ic: 'notes', ref: { note: n.id }, x: strip(n.body).replace(/\s+/g, ' ').slice(0, 300) });
      });
    }
  }

  /* ---------- moments: the windows you had open ---------- */
  const sigOf = (wins) => wins.map((w) => w.app + JSON.stringify(w.args || {})).sort().join('|');
  function snapMoment() {
    if (!on() || !PatOS.session || !PatOS.loggedIn) return;
    const wins = PatOS.session.current().filter((w) => !NEVER.has(w.app));
    if (!wins.length) return;
    const now = Date.now(), sig = sigOf(wins), last = moments[moments.length - 1];
    if (last && last.sig === sig) { last.t1 = now; last.wins = wins; touch(); return; }
    // a moment that lasted under two minutes was just on the way to this one
    if (last && now - last.t < 2 * MIN && last.t > bootT) moments.pop();
    moments.push({ t: now, t1: now, sig, wins });
    if (moments.length > MAX_MOMENTS) moments.splice(0, moments.length - MAX_MOMENTS);
    touch();
  }
  const snapSoon = PatOS.debounce(snapMoment, 12000);
  async function restoreMoment(m) {
    if (!m || !PatOS.session) return 0;
    const n = await PatOS.session.reopen(m.wins, { focusRunning: true, unminimize: true, gap: 60 });
    PatOS.notify({ title: T('Moment restored'), body: n ? n + ' ' + T(n === 1 ? 'window was reopened.' : 'windows were reopened.') : T('Those windows are already open.'), icon: 'timeline', duration: 3500 });
    return n;
  }
  // the last moment from before PatOS started this time: what "pick up where you left off" offers
  function lastSession() { for (let i = moments.length - 1; i >= 0; i--) if (moments[i].t1 < bootT) return moments[i]; return null; }

  /* ---------- clipboard ---------- */
  function addClip(text, src) {
    if (!clipsOn()) return;
    text = String(text == null ? '' : text); if (!text.trim()) return;
    if (NEVER.has(activeApp())) return;
    if (text.length > MAX_CLIP_LEN) text = text.slice(0, MAX_CLIP_LEN);
    const i = clips.findIndex((c) => c.text === text);
    let c;
    if (i >= 0) { c = clips.splice(i, 1)[0]; c.t = Date.now(); }
    else c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), text, app: activeApp(), src: src || '' };
    clips.push(c);
    const loose = clips.filter((x) => !x.pin);
    if (loose.length > MAX_CLIPS) { const drop = new Set(loose.slice(0, loose.length - MAX_CLIPS).map((x) => x.id)); clips = clips.filter((x) => !drop.has(x.id)); }
    touch();
  }
  window.addEventListener('copy', (e) => {
    const el = document.activeElement;
    if (el && el.matches && el.matches('input[type=password], [autocomplete*=password]')) return;
    let text = '';
    try { text = e.clipboardData && e.clipboardData.getData('text/plain'); } catch (err) {}
    if (!text) {
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && el.selectionStart != null) text = el.value.slice(el.selectionStart, el.selectionEnd);
      else text = String(window.getSelection ? window.getSelection() : '');
    }
    addClip(text, 'copy');
  });
  window.addEventListener('cut', () => {
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && el.type !== 'password' && el.selectionStart != null) addClip(el.value.slice(el.selectionStart, el.selectionEnd), 'cut');
    else addClip(String(window.getSelection ? window.getSelection() : ''), 'cut');
  });
  // apps that copy with a button (a result, a link, a color) go through the clipboard API
  let rawWrite = null;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      rawWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (t) => { addClip(t, 'app'); return rawWrite(t); };
    }
  } catch (e) { rawWrite = null; }
  const writeClip = (t) => (rawWrite ? rawWrite(t) : Promise.reject(new Error('no clipboard'))).catch(() => {
    const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {} ta.remove();
  });

  /* ---------- forgetting ---------- */
  function prune() {
    const cut = Date.now() - keepDays() * DAY;
    const ne = events.filter((e) => e.t >= cut), nm = moments.filter((m) => m.t1 >= cut), nc = clips.filter((c) => c.pin || c.t >= cut);
    if (ne.length !== events.length || nm.length !== moments.length || nc.length !== clips.length) { events = ne; moments = nm; clips = nc; touch(); }
  }
  function forget(from, to) {
    to = to || Infinity;
    events = events.filter((e) => e.t < from || e.t > to);
    moments = moments.filter((m) => m.t1 < from || m.t > to);
    clips = clips.filter((c) => c.pin || c.t < from || c.t > to);
    touch();
  }
  function forgetItem(kind, id) {
    if (kind === 'moment') moments = moments.filter((m) => m.t !== id);
    else if (kind === 'clip') clips = clips.filter((c) => c.id !== id);
    else events = events.filter((e) => e.t !== id);
    touch();
  }
  function pause(ms) { PatOS.store.set('timelinePause', ms ? Date.now() + ms : 0); changed(); }

  /* ---------- the clipboard panel (Alt+V) ---------- */
  let panel = null, prevEl = null, sel = 0, shown = [];
  const ago = (t) => {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return T('just now');
    if (s < 3600) return Math.floor(s / 60) + ' min';
    if (s < DAY / 1000) return new Date(t).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' });
    return new Date(t).toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' });
  };
  const editable = (el) => el && el.isConnected && (el.isContentEditable || (/^(INPUT|TEXTAREA)$/.test(el.tagName) && !el.readOnly && !/^(button|checkbox|radio|range|color|file|submit|password)$/i.test(el.type || '')));
  function closePanel() {
    if (!panel) return;
    const p = panel; panel = null;
    p.classList.add('out'); setTimeout(() => p.remove(), 220);
  }
  async function paste(c) {
    const target = prevEl; closePanel();
    await writeClip(c.text);
    addClip(c.text, 'paste');
    if (editable(target)) {
      target.focus();
      let ok = false; try { ok = document.execCommand('insertText', false, c.text); } catch (e) {}
      if (!ok && /^(INPUT|TEXTAREA)$/.test(target.tagName)) {
        const s0 = target.selectionStart || 0, e0 = target.selectionEnd || 0;
        target.value = target.value.slice(0, s0) + c.text + target.value.slice(e0); target.selectionStart = target.selectionEnd = s0 + c.text.length;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else PatOS.notify({ title: T('Copied'), body: c.text.slice(0, 80), icon: 'timeline', duration: 2200 });
  }
  function clipPanel() {
    if (panel) return closePanel();
    prevEl = document.activeElement;
    const q = h('input', { class: 'cp-q', placeholder: T('Search what you copied'), spellcheck: 'false', 'aria-label': T('Search what you copied') });
    const list = h('div', { class: 'cp-list', role: 'listbox' });
    const fill = () => {
      const s = q.value.trim().toLowerCase();
      shown = clips.slice().reverse().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0)).filter((c) => !s || c.text.toLowerCase().includes(s)).slice(0, 40);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.innerHTML = '';
      if (!shown.length) list.appendChild(h('div', { class: 'cp-empty' }, h('span', { html: PatOS.sym('history') }), clips.length ? T('Nothing matches.') : (PatOS.settings.timelineClips === false ? T('Clipboard history is off. Turn it on in the Timeline app.') : T('What you copy shows up here. Copy something, then press Alt+V.'))));
      shown.forEach((c, i) => {
        const row = h('div', { class: 'cp-row' + (i === sel ? ' sel' : '') + (c.pin ? ' pin' : ''), role: 'option', style: { '--i': Math.min(i, 12) } },
          h('span', { class: 'cp-k' }, i < 9 ? String(i + 1) : ''),
          h('div', { class: 'cp-txt' }, h('div', {}, c.text.length > 240 ? c.text.slice(0, 240) + '…' : c.text), h('small', {}, ago(c.t) + (c.text.length > 240 ? ' · ' + c.text.length + ' ' + T('characters') : ''))),
          h('button', { class: 'cp-b' + (c.pin ? ' on' : ''), title: c.pin ? T('Unpin') : T('Pin'), 'aria-label': c.pin ? T('Unpin') : T('Pin'), html: PatOS.sym('pin'), onclick: (e) => { e.stopPropagation(); c.pin = !c.pin; touch(); fill(); } }),
          h('button', { class: 'cp-b', title: T('Remove'), 'aria-label': T('Remove'), html: PatOS.sym('close'), onclick: (e) => { e.stopPropagation(); forgetItem('clip', c.id); fill(); } }));
        row.addEventListener('click', () => paste(c));
        row.addEventListener('pointermove', () => { if (sel !== i) { sel = i; [...list.children].forEach((r, j) => r.classList.toggle('sel', j === sel)); } });
        list.appendChild(row);
      });
    };
    q.addEventListener('input', () => { sel = 0; fill(); });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!shown.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; [...list.children].forEach((r, j) => r.classList.toggle('sel', j === sel)); list.children[sel].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) paste(shown[sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); if (prevEl && prevEl.focus) prevEl.focus(); }
      else if (/^[1-9]$/.test(e.key) && !q.value) { e.preventDefault(); const c = shown[+e.key - 1]; if (c) paste(c); }
    });
    panel = h('div', { id: 'clip-panel', class: 'lg-elevated', role: 'dialog', 'aria-label': T('Clipboard') },
      h('div', { class: 'cp-head' }, h('span', { class: 'cp-ic', html: PatOS.sym('history') }), h('b', {}, T('Clipboard')), h('small', {}, T('Enter pastes · 1–9 · Esc')),
        h('button', { class: 'cp-open', onclick: () => { closePanel(); PatOS.launch('timeline', { filter: 'clip' }); } }, T('Open Timeline'))),
      q, list);
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(panel);
    fill(); setTimeout(() => q.focus(), 20);
  }
  document.addEventListener('pointerdown', (e) => { if (panel && !panel.contains(e.target)) closePanel(); });
  document.addEventListener('keydown', (e) => {
    if (!PatOS.loggedIn) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyV') { e.preventDefault(); clipPanel(); }
  }, true);

  /* ---------- search, for Spotlight ---------- */
  function searchClips(q, max) {
    q = String(q || '').toLowerCase(); if (q.length < 2) return [];
    return clips.slice().reverse().filter((c) => c.text.toLowerCase().includes(q)).slice(0, max || 3);
  }

  /* ---------- wiring ---------- */
  PatOS.on('wm:open', (w) => { try { onOpen(w); } catch (e) { console.error(e); } snapSoon(); });
  PatOS.on('wm:close', snapSoon);
  PatOS.on('fs', onFS);
  PatOS.on('store:set', onStore);
  PatOS.on('setting:timelineDays', prune);
  setInterval(() => { if (!document.hidden) snapMoment(); }, 10 * MIN);
  setInterval(prune, 60 * MIN);
  window.addEventListener('pagehide', () => { try { snapMoment(); PatOS.store.set('timeline', events.slice()); PatOS.store.set('timelineMoments', moments.slice()); PatOS.store.set('clipHistory', clips.slice()); } catch (e) {} });
  setTimeout(prune, 3000);

  PatOS.timeline = {
    events: () => events.slice(), moments: () => moments.slice(), clips: () => clips.slice(),
    record, forget, forgetItem, prune, pause, paused, restoreMoment, lastSession, clipPanel, searchClips, addClip, snapMoment,
    copy: (t) => writeClip(t).then(() => addClip(t, 'app')),
    pin: (id) => { const c = clips.find((x) => x.id === id); if (c) { c.pin = !c.pin; touch(); } },
    pauseUntil: () => +PatOS.store.get('timelinePause', 0) || 0,
    bootT
  };
})();
