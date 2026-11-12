/* Command Center (3.3): what is happening in PatOS, in one place. Not Control Center (that is quick settings); this answers
   "what is going on, did it work, what needs me": things that need attention, activities running now (Live Activities),
   the state of sync, backups, storage and the account, recent notifications, and a search for commands and places.
   It only reads the system services (PatOS.live, PatOS.nc, PatOS.sync, PatOS.backup, PatOS.account); it keeps nothing of
   its own except which sections you hid. Open it with Alt+K, the menu bar, or Control Center on a phone.
   Also here: the menu bar pill that shows running activities. */
(function () {
  'use strict';
  const { h, $ } = PatOS;
  const T = (s) => PatOS.t(s);
  let el = null, query = '', storage = null;
  const ago = (t) => { if (!t) return T('never'); const s = Math.round((Date.now() - t) / 1000); if (s < 60) return T('just now'); const x = s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + (PatOS.lang === 'fr' ? ' j' : ' d'); return PatOS.lang === 'fr' ? 'il y a ' + x : x + ' ago'; };
  const hidden = () => PatOS.settings.cmdHidden || [];
  const SECTIONS = [['attention', 'Needs attention'], ['now', 'Now'], ['status', 'Status'], ['recent', 'Recent']];

  /* ---------- what PatOS knows (read from the services, never copied) ---------- */
  function lastBackup() { try { const l = PatOS.backup && PatOS.backup.list ? PatOS.backup.list() : []; return l.reduce((m, x) => Math.max(m, +x.time || +x.t || 0), 0); } catch (e) { return 0; } }
  function attention() {
    const out = [];
    PatOS.live.recent().filter((a) => a.status === 'failed').slice(0, 3).forEach((a) => out.push({ icon: 'warn', tone: 'bad', title: a.title + ': ' + T('didn’t finish'), sub: a.message, act: a.can.retry ? [T('Retry'), () => PatOS.live.act(a.id, 'retry')] : null }));
    PatOS.live.list().filter((a) => a.status === 'stalled').forEach((a) => out.push({ icon: 'warn', tone: 'warn', title: a.title + ': ' + T('no progress for 10 minutes'), sub: '', act: a.can.cancel ? [T('Cancel'), () => PatOS.live.act(a.id, 'cancel')] : null }));
    const s = PatOS.sync && PatOS.sync.status ? PatOS.sync.status() : null;
    if (s && s.on && s.state === 'error') out.push({ icon: 'cloud', tone: 'bad', title: T('Sync stopped'), sub: { key: T('The sync key is wrong.'), full: T('The server is full.'), busy: T('The server is busy.') }[s.error] || T('The server had a problem.'), act: [T('Try again'), () => PatOS.sync.now()] });
    if (s && s.on && s.rejected) out.push({ icon: 'cloud', tone: 'warn', title: s.rejected + ' ' + T('items couldn’t be synced'), sub: '', act: [T('Open'), () => PatOS.launch('settings', { pane: 'sync' })] });
    const lb = lastBackup(); if (!lb || Date.now() - lb > 7 * 86400000) out.push({ icon: 'history', tone: 'warn', title: lb ? T('No backup in over a week') : T('No backup yet'), sub: '', act: [T('Back up now'), () => runBackup()] });
    if (storage && storage.quota && storage.usage / storage.quota > 0.85) out.push({ icon: 'storage', tone: 'warn', title: T('Storage almost full'), sub: Math.round(storage.usage / storage.quota * 100) + '%', act: [T('Open'), () => PatOS.launch('settings', { pane: 'storage' })] });
    PatOS.nc.list().filter((n) => !n.read && (n.priority === 'high' || n.priority === 'urgent')).slice(0, 3).forEach((n) => out.push({ icon: 'bell', tone: 'warn', title: n.title, sub: n.appName, act: [T('Open'), () => PatOS.nc.open(n.id)] }));
    return out;
  }
  /* a backup, shown as a Live Activity (a real one: it ends when the snapshot is written, or says it failed) */
  async function runBackup() {
    if (!PatOS.backup || !PatOS.backup.snapshot) return;
    const a = PatOS.live.start({ app: 'settings', title: T('Backup'), detail: T('Saving a snapshot…'), progress: null, open: { app: 'settings', args: { pane: 'backup' } } });
    try { await PatOS.backup.snapshot(T('Manual'), 'manual'); a.end('done', T('Snapshot saved')); } catch (e) { a.end('failed', (e && e.message) || ''); }
  }

  /* ---------- search: commands, settings, apps and places ---------- */
  function results(q) {
    q = q.trim().toLowerCase(); if (!q) return [];
    const out = [];
    Object.values(PatOS.apps).filter((a) => !a.hidden && (a.name.toLowerCase().includes(q) || T(a.name).toLowerCase().includes(q))).slice(0, 4).forEach((a) => out.push({ k: T('App'), label: T(a.name), run: () => PatOS.launch(a.id) }));
    (PatOS.settingsCatalog || []).filter((c) => (T(c.label) + ' ' + c.words).toLowerCase().includes(q)).slice(0, 4).forEach((c) => out.push({ k: T('Setting'), label: T(c.label), run: () => PatOS.launch('settings', { pane: c.pane, find: c.key }) }));
    [['Back up now', runBackup], ['Sync now', () => PatOS.sync && PatOS.sync.now()], ['Clear notifications', () => PatOS.nc.clear()], ['Open Clipboard', () => PatOS.timeline && PatOS.timeline.clipPanel()], ['Capture', () => PatOS.capture && PatOS.capture.quick()]]
      .filter(([l]) => T(l).toLowerCase().includes(q) || l.toLowerCase().includes(q)).forEach(([l, fn]) => out.push({ k: T('Command'), label: T(l), run: fn }));
    return out.slice(0, 9);
  }

  /* ---------- the panel ---------- */
  function sec(id, title, body) { if (hidden().includes(id) || !body) return null; return h('section', { class: 'cmd-sec', 'data-sec': id }, h('h3', {}, T(title)), body); }
  function render() {
    if (!el) return;
    const keep = el.querySelector('.cmd-q'), focus = keep && document.activeElement === keep;
    el.innerHTML = '';
    const q = h('input', { class: 'field cmd-q', type: 'search', value: query, placeholder: T('Search commands, settings and apps'), 'aria-label': T('Search commands, settings and apps') });
    q.addEventListener('input', () => { query = q.value; render(); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = results(query)[0]; if (r) { close(); r.run(); } } });
    const head = h('div', { class: 'cmd-head' }, h('span', { class: 'cmd-mark', html: PatOS.sym('grid') }), h('b', {}, T('Command Center')),
      h('button', { class: 'cmd-ic', title: T('Sections'), 'aria-label': T('Sections'), html: PatOS.sym('list'), onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); PatOS.menu(SECTIONS.map(([k, l]) => ({ label: T(l), checked: !hidden().includes(k), action: () => { const hd = hidden().slice(); const i = hd.indexOf(k); if (i >= 0) hd.splice(i, 1); else hd.push(k); PatOS.setSetting('cmdHidden', hd); render(); } })), r.left, r.bottom + 4); } }),
      h('button', { class: 'cmd-ic', title: T('Close'), 'aria-label': T('Close'), html: PatOS.sym('close'), onclick: close }));
    el.append(head, q);
    if (query.trim()) {
      const r = results(query);
      el.appendChild(h('div', { class: 'cmd-results', role: 'listbox' }, ...(r.length ? r.map((x) => h('button', { class: 'cmd-row', role: 'option', onclick: () => { close(); x.run(); } }, h('small', {}, x.k), h('span', {}, x.label))) : [h('p', { class: 'cmd-empty' }, T('Nothing matches.'))])));
      if (focus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      return;
    }
    // needs attention
    const att = attention();
    const attBody = att.length ? h('div', { class: 'cmd-list' }, ...att.map((x) => h('div', { class: 'cmd-item ' + x.tone }, h('span', { class: 'cmd-i', html: PatOS.sym(x.icon) }), h('div', { class: 'cmd-t' }, h('b', {}, x.title), x.sub ? h('small', {}, x.sub) : null), x.act ? h('button', { class: 'btn', onclick: () => { x.act[1](); setTimeout(render, 300); } }, x.act[0]) : null)))
      : h('div', { class: 'cmd-ok' }, h('span', { html: PatOS.sym('check') }), T('Everything is fine.'));
    // now: live activities
    const now = PatOS.live.list();
    const ctl = (a, what, label, sym) => (a.can[what] ? h('button', { class: 'cmd-ic', title: label, 'aria-label': label, html: PatOS.sym(sym), onclick: () => { PatOS.live.act(a.id, what); render(); } }) : null);
    const nowBody = now.length ? h('div', { class: 'cmd-list' }, ...now.map((a) => h('div', { class: 'cmd-live' + (a.status !== 'running' ? ' ' + a.status : '') },
      h('div', { class: 'cmd-live-ic', html: PatOS.iconHTML(a.app) }),
      h('div', { class: 'cmd-t' }, h('b', {}, a.title), h('small', {}, [a.status === 'paused' ? T('Paused') : a.status === 'stalled' ? T('No progress') : a.detail, a.progress != null ? Math.round(a.progress * 100) + '%' : '', a.eta ? '~' + Math.max(1, Math.round(a.eta / 60000)) + ' min' : ''].filter(Boolean).join(' · ')),
        h('div', { class: 'cmd-bar' + (a.progress == null ? ' busy' : '') }, h('i', { style: { width: a.progress == null ? '' : Math.round(a.progress * 100) + '%' } }))),
      ctl(a, 'pause', T('Pause'), 'pause'), ctl(a, 'resume', T('Resume'), 'play'), ctl(a, 'open', T('Open'), 'up'), ctl(a, 'cancel', T('Cancel'), 'close'))))
      : h('p', { class: 'cmd-empty' }, T('Nothing running.'));
    // status
    const s = PatOS.sync && PatOS.sync.status ? PatOS.sync.status() : { on: false };
    const acct = PatOS.account && PatOS.account.info ? PatOS.account.info() : null;
    const tile = (sym, label, value, tone, go) => h('button', { class: 'cmd-tile ' + (tone || ''), onclick: go }, h('span', { html: PatOS.sym(sym) }), h('small', {}, T(label)), h('b', {}, value));
    const statusBody = h('div', { class: 'cmd-tiles' },
      tile('cloud', 'Sync', !s.on ? T('Off') : s.state === 'syncing' ? T('Syncing…') : s.state === 'error' ? T('Stopped') : s.state === 'offline' ? T('Waiting for internet') : T('Up to date') + (s.last ? ' · ' + ago(s.last) : ''), s.state === 'error' ? 'bad' : '', () => { close(); PatOS.launch('settings', { pane: 'sync' }); }),
      tile('history', 'Backup', ago(lastBackup()), '', () => { close(); PatOS.launch('settings', { pane: 'backup' }); }),
      tile('storage', 'Storage', storage && storage.quota ? Math.round(storage.usage / 1048576) + ' MB · ' + Math.round(storage.usage / storage.quota * 100) + '%' : '—', storage && storage.quota && storage.usage / storage.quota > 0.85 ? 'warn' : '', () => { close(); PatOS.launch('settings', { pane: 'storage' }); }),
      tile('person', 'Account', acct ? '@' + acct.username : T('Not signed in'), '', () => { close(); PatOS.launch('settings', { pane: 'me' }); }),
      PatOS.spaces ? tile('apps', 'Shared Spaces', PatOS.spaces.summary(), '', () => { close(); PatOS.launch('spaces'); }) : null);
    // recent
    const rec = [...PatOS.live.recent().slice(0, 3).map((a) => ({ t: a.ended, icon: a.app, title: a.title, sub: a.status === 'done' ? T('Finished') : a.status === 'failed' ? T('Didn’t finish') : T('Cancelled') })),
      ...PatOS.nc.list().slice(0, 4).map((n) => ({ t: n.time, icon: n.app, title: n.title, sub: n.appName, go: () => PatOS.nc.open(n.id) }))].sort((a, b) => b.t - a.t).slice(0, 6);
    const recBody = rec.length ? h('div', { class: 'cmd-list' }, ...rec.map((x) => h('div', { class: 'cmd-item', onclick: x.go ? () => { close(); x.go(); } : null }, h('div', { class: 'cmd-live-ic sm', html: PatOS.iconHTML(x.icon) }), h('div', { class: 'cmd-t' }, h('b', {}, x.title), h('small', {}, x.sub + ' · ' + ago(x.t)))))) : null;
    el.append(...[sec('attention', 'Needs attention', attBody), sec('now', 'Now', nowBody), sec('status', 'Status', statusBody), sec('recent', 'Recent', recBody)].filter(Boolean));
    if (focus) q.focus();
  }
  function open() {
    if (el) return;
    el = h('div', { id: 'cmd', class: 'lg-elevated', role: 'dialog', 'aria-label': T('Command Center') });
    document.body.appendChild(el); render();
    requestAnimationFrame(() => el && el.classList.add('in'));
    try { navigator.storage && navigator.storage.estimate().then((e) => { storage = e; render(); }); } catch (e) {}
    setTimeout(() => { const q = el && el.querySelector('.cmd-q'); if (q && !PatOS.isMobile) q.focus(); }, 60);
  }
  function close() { if (!el) return; const e = el; el = null; query = ''; e.classList.remove('in'); setTimeout(() => e.remove(), 220); }
  const toggle = () => (el ? close() : open());
  const redraw = PatOS.debounce(() => { if (el && !(document.activeElement && document.activeElement.classList.contains('cmd-q') && query)) render(); pill(); }, 150);
  PatOS.on('live', redraw); PatOS.on('notif', redraw); PatOS.on('sync', redraw);
  document.addEventListener('keydown', (e) => { if (!PatOS.loggedIn) return; if (e.altKey && !e.ctrlKey && e.code === 'KeyK') { e.preventDefault(); toggle(); } else if (e.key === 'Escape' && el) close(); });
  document.addEventListener('pointerdown', (e) => { if (el && !e.target.closest('#cmd, #mb-cmd, #mb-live, .menu, .dlg-layer, .cc-cmd')) close(); });

  /* ---------- the menu bar: Command Center, and the pill for running activities ---------- */
  function pill() {
    const b = document.getElementById('mb-live'); if (!b) return;
    const l = PatOS.live.list(); b.classList.toggle('hidden', !l.length);
    if (!l.length) return;
    const p = l.find((a) => a.progress != null); const pct = p ? Math.round(p.progress * 100) : null;
    b.innerHTML = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="2.4"/>' +
      (pct == null ? '<circle class="mbl-spin" cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="12 36" stroke-linecap="round"/>' : '<circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="' + (47.1 * pct / 100).toFixed(1) + ' 47.1" transform="rotate(-90 10 10)"/>') + '</svg>' +
      '<span>' + (l.length > 1 ? l.length : pct != null ? pct + '%' : '') + '</span>';
    b.title = l.map((a) => a.title + (a.progress != null ? ' ' + Math.round(a.progress * 100) + '%' : '')).join('\n');
    b.setAttribute('aria-label', T('Activities') + ': ' + b.title);
  }
  function wire() {
    const c = document.getElementById('mb-cmd'); if (c && !c._w) { c._w = 1; c.innerHTML = PatOS.sym('grid'); c.addEventListener('click', (e) => { e.stopPropagation(); toggle(); }); }
    const l = document.getElementById('mb-live'); if (l && !l._w) { l._w = 1; l.addEventListener('click', (e) => { e.stopPropagation(); open(); }); }
    pill();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  PatOS.command = { open, close, toggle, isOpen: () => !!el, attention, runBackup };
})();
