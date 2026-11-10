/* Handoff: pick up on this device what you were just doing on your other one.
   Each device keeps one small record, handoff:<device id>, of the window you are using there: which app, what is open in it
   (a file's path, a note's id, a website's address, a folder; never what is inside) and its title. Sync carries these records
   (encrypted like everything else, js/sync.js); on your other devices a card offers "Continue from iPhone: Notes — Shopping
   list", above the Dock on a computer and above the dock on a phone, and in Spotlight. One click opens it there.
   - Only while Sync is on (with a PatOS account or a sync code), and only for what was used in the last 30 minutes.
   - Never from Passwords, the setup screens or a screenshot in progress. Settings › Privacy › Handoff turns it off: this
     device stops sending, and stops showing cards. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const FRESH = 30 * 60 * 1000;
  const NEVER = new Set(['passwords', 'setup', 'screenshot', 'extweb', 'launchpad']);
  const on = () => PatOS.settings.handoff !== false;
  const syncing = () => !!(PatOS.sync && PatOS.sync.status && PatOS.sync.status().on);

  /* ---------- this device ---------- */
  function deviceName() {
    const hw = PatOS.hw || {};
    if (hw.iphone) return 'iPhone';
    if (hw.ios) return 'iPad';
    if (hw.android) return hw.phone ? T('Android phone') : T('Android tablet');
    if (hw.chromeos) return 'Chromebook';
    if (hw.windows) return T('Windows PC');
    if (/Mac OS X/.test(navigator.userAgent)) return 'Mac';
    return T('Computer');
  }
  let me = PatOS.store.get('handoffDevice', null);
  if (!me || !me.id) { me = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }; PatOS.store.set('handoffDevice', me); }
  const myKey = 'handoff:' + me.id;

  /* ---------- what this device is doing ---------- */
  function current() {
    const w = PatOS.wm && PatOS.wm.active;
    if (!w || w.minimized || NEVER.has(w.app.id) || w.app.hidden || w.app.noRestore) return null;
    const args = PatOS.session ? PatOS.session.clean(w.args || {}) : {};
    // the browser keeps its own tabs: hand over the address of the one in front
    if (w.app.id === 'browser' && w.el) { const u = w.el.querySelector('.br-omni'); const v = u && (u.value || u.textContent || '').trim(); if (/^https?:\/\//.test(v)) args.url = v; }
    return { app: w.app.id, args, title: String(w.title || PatOS.t(w.app.name)).slice(0, 90), icon: w.app.icon || w.app.id };
  }
  const sameAs = (a, b) => !!a && !!b && a.app === b.app && JSON.stringify(a.args || {}) === JSON.stringify(b.args || {});
  let lastSent = PatOS.store.get(myKey, null);
  function publish() {
    if (!on() || !PatOS.loggedIn) return;
    const c = current(); if (!c) return;
    // the same thing again only refreshes the time every few minutes (each write is a small upload)
    if (lastSent && sameAs(lastSent, c) && lastSent.title === c.title && Date.now() - lastSent.t < 4 * 60 * 1000) return;
    lastSent = Object.assign({ dev: me.id, name: deviceName(), t: Date.now() }, c);
    PatOS.store.set(myKey, lastSent);
  }
  const publishSoon = PatOS.debounce(publish, 2500);
  ['wm:focus', 'wm:open', 'wm:title'].forEach((ev) => PatOS.on(ev, publishSoon));
  // (moving to another page inside the browser changes its history, not its window)
  PatOS.on('store:set', (k) => { if (k === 'browserHistory') publishSoon(); });
  // apps tell PatOS when they switch to another file or note (js/session.js PatOS.remember)
  const remember = PatOS.remember;
  if (remember) PatOS.remember = function (win, args) { remember(win, args); publishSoon(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) publish(); else setTimeout(refresh, 1200); });

  /* ---------- what the other devices were doing ---------- */
  function others() {
    if (!on()) return [];
    const seen = PatOS.store.get('handoffSeen', {}) || {};
    return PatOS.store.keys().filter((k) => k.indexOf('handoff:') === 0 && k !== myKey)
      .map((k) => PatOS.store.get(k, null))
      .filter((x) => x && x.app && x.dev !== me.id && Date.now() - x.t < FRESH && x.t > (seen[x.dev] || 0) && PatOS.apps[x.app] && !NEVER.has(x.app))
      .sort((a, b) => b.t - a.t);
  }
  function offer() {
    const x = others()[0]; if (!x) return null;
    // already open here: nothing to hand over
    const here = current(); if (here && sameAs(here, x)) return null;
    return x;
  }
  function open(x) {
    dismiss(x, true);
    const a = x.args || {};
    if (a.path && !PatOS.fs.get(a.path)) {
      // the file may still be on its way: sync, then try once more
      PatOS.notify({ title: T('Getting it from') + ' ' + x.name + '…', body: x.title, icon: x.icon });
      const go = () => { if (PatOS.fs.get(a.path)) PatOS.launch(x.app, a); else PatOS.notify({ title: T('Not here yet'), body: T('This file hasn’t reached this device yet. Try again in a moment.'), icon: x.icon }); };
      return (PatOS.sync && PatOS.sync.now ? PatOS.sync.now().catch(() => {}) : Promise.resolve()).then(go);
    }
    PatOS.launch(x.app, a);
  }
  function dismiss(x, quiet) {
    const seen = PatOS.store.get('handoffSeen', {}) || {}; seen[x.dev] = x.t; PatOS.store.set('handoffSeen', seen);
    if (!quiet) refresh(); else hide();
  }

  /* ---------- the card ---------- */
  let card = null, shown = null;
  function hide() { if (!card) return; const c = card; card = null; shown = null; c.classList.add('out'); setTimeout(() => c.remove(), 260); }
  function refresh() {
    if (!PatOS.loggedIn) return;
    const x = offer();
    if (!x) return hide();
    if (shown && shown.dev === x.dev && shown.t === x.t && card) return;
    if (card) { card.remove(); card = null; }
    shown = x;
    const a = PatOS.apps[x.app];
    card = h('div', { id: 'handoff-card', class: 'lg-elevated', role: 'status', 'aria-live': 'polite' },
      h('button', { class: 'ho-main', 'aria-label': T('Continue from') + ' ' + x.name + ': ' + x.title, onclick: () => open(x) },
        h('span', { class: 'ho-ic', html: PatOS.iconHTML(x.icon || x.app) }),
        h('span', { class: 'ho-txt' }, h('small', {}, T('Continue from') + ' ' + x.name), h('b', {}, (x.title && x.title !== PatOS.t(a.name) ? PatOS.t(a.name) + ' — ' + x.title : PatOS.t(a.name))))),
      h('button', { class: 'ho-x', title: T('Not now'), 'aria-label': T('Not now'), html: PatOS.sym('close'), onclick: (e) => { e.stopPropagation(); dismiss(x); } }));
    document.body.appendChild(card);
  }
  PatOS.on('store:set', (k) => { if (typeof k === 'string' && k.indexOf('handoff:') === 0 && k !== myKey) setTimeout(refresh, 50); });
  PatOS.on('wm:focus', () => setTimeout(refresh, 100));
  PatOS.on('setting:handoff', (v) => { if (v === false) { hide(); } else { publishSoon(); refresh(); } });
  PatOS.on('icons:style', () => { if (card && shown) { const s = shown; shown = null; card.remove(); card = null; refresh(); } });
  setInterval(() => { if (!document.hidden) refresh(); }, 60 * 1000); // (an offer goes away by itself after 30 minutes)
  PatOS.on('wm:ready', () => setTimeout(() => { publish(); refresh(); }, 1500));

  PatOS.handoff = { device: () => Object.assign({ name: deviceName() }, me), current, offer, others, open, refresh, publish, dismiss, syncing };
})();
