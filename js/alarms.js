/* PatOS.alarms — alarms, timers and reminders that ring on time, even when PatOS is in the background.
   - Chrome slows down a page's timers when its tab is hidden (sometimes to once a minute), but not the
     timers of a Worker. So a tiny Worker sends a beat every second and everything time-based uses it.
   - Alarms and timers ring until they are stopped: a card on screen with Stop and Snooze, plus a Chrome
     notification with the same buttons when PatOS isn't in front.
   - Things that came due while PatOS was closed are reported as missed when it opens again.
   Alarms can only ring while PatOS is open somewhere (a tab or the installed app); a web page can't
   wake itself up once it is closed. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const now = () => Date.now();
  const timeStr = (t) => new Date(t).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' });

  /* ---------- the beat ---------- */
  const subs = new Set();
  let lastBeat = 0;
  function beat() {
    const t = now(); if (t - lastBeat < 400) return; lastBeat = t;
    subs.forEach((fn) => { try { fn(t); } catch (e) {} });
    try { checkQueue(t); } catch (e) { console.warn('PatOS alarms (queue):', e); }
    try { checkClockAlarms(t); } catch (e) { console.warn('PatOS alarms (clock):', e); }
    try { if (Math.floor(t / 1000) % 5 === 0) checkReminders(t); } catch (e) { console.warn('PatOS alarms (reminders):', e); }
  }
  let fallback = null;
  const useFallback = () => { if (!fallback) fallback = setInterval(beat, 1000); };
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},1000)'], { type: 'text/javascript' })));
    w.onmessage = beat; w.onerror = useFallback;
  } catch (e) { useFallback(); }
  // the beat can be late after the device sleeps; check right away when PatOS comes back
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastBeat = 0; beat(); } });

  // ring once PatOS has been unlocked in this session, including later on the lock screen (Alt+Esc)
  let seenLogin = false;
  const ready = () => (seenLogin = seenLogin || !!PatOS.loggedIn);

  /* ---------- scheduled one-time items (timers, snoozes, Focus) ---------- */
  const Q = 'alarmQueue';
  const queue = () => PatOS.store.get(Q, []) || [];
  function schedule(item) {
    const q = queue().filter((x) => x.id !== item.id);
    q.push(Object.assign({ kind: 'notice', icon: 'clock' }, item)); PatOS.store.set(Q, q);
  }
  function cancel(id) { const q = queue(); const n = q.filter((x) => x.id !== id); if (n.length !== q.length) PatOS.store.set(Q, n); stop(id); }
  function checkQueue(t) {
    if (!ready()) return;
    const q = queue(); const due = q.filter((x) => x.at <= t); if (!due.length) return;
    PatOS.store.set(Q, q.filter((x) => x.at > t));
    due.forEach((x) => (t - x.at > 120000 ? missed(x) : fire(x)));
  }

  /* ---------- Clock alarms (repeat every day, on weekdays, on weekends, or once) ---------- */
  const repeatOK = (rep, d) => { const wd = d.getDay(); return rep === 'weekdays' ? wd >= 1 && wd <= 5 : rep === 'weekends' ? wd === 0 || wd === 6 : true; };
  // when alarms were last checked: kept in memory, saved every 30 seconds and whenever one rings,
  // so an alarm never rings twice and alarms that came due while PatOS was closed can be reported
  let checked = 0, savedAt = 0;
  function checkClockAlarms(t) {
    if (!ready()) return;
    if (!checked) checked = PatOS.store.get('alarmsChecked', 0) || 0;
    let last = checked;
    if (!last || t - last > 7 * 864e5) { checked = savedAt = t; PatOS.store.set('alarmsChecked', t); return; }
    if (t - last < 900) return;
    let rang = false;
    const list = PatOS.store.get('alarms', []) || []; let changed = false;
    list.forEach((a) => {
      if (!a.on || !/^\d\d:\d\d$/.test(a.time || '')) return;
      const [hh, mm] = a.time.split(':').map(Number);
      // every day from the last check to now (normally just today)
      for (let d = new Date(last); d.getTime() <= t + 864e5; d.setDate(d.getDate() + 1)) {
        const occ = new Date(d); occ.setHours(hh, mm, 0, 0); const o = occ.getTime();
        if (o <= last || o > t || !repeatOK(a.repeat, occ)) continue;
        const item = { id: 'alarm:' + a.id, kind: 'alarm', at: o, title: a.label || T('Alarm'), body: timeStr(o), icon: 'clock', app: 'clock', snooze: true };
        if (t - o < 120000) fire(item); else if (t - o < 6 * 3600e3) missed(item);
        rang = true;
        if (a.repeat === 'once') { a.on = false; changed = true; }
      }
    });
    checked = t;
    if (rang || t - savedAt > 30000) { savedAt = t; PatOS.store.set('alarmsChecked', t); }
    if (changed) { PatOS.store.set('alarms', list); PatOS.emit('alarms'); }
  }

  /* ---------- Reminders with a date and time ---------- */
  function checkReminders(t) {
    if (!ready()) return;
    const items = PatOS.store.get('reminders', null); if (!items) return; let changed = false;
    items.forEach((r) => {
      if (r.done || r.alerted || !r.due || !r.time) return;
      const at = new Date(r.due + 'T' + r.time).getTime(); if (!(at <= t)) return;
      r.alerted = true; changed = true;
      if (t - at < 12 * 3600e3) fire({ id: 'rem:' + r.id, kind: 'reminder', at, title: r.text, body: T('Reminder') + ' · ' + timeStr(at), icon: 'reminders', app: 'reminders', late: t - at > 120000 });
    });
    if (changed) { PatOS.store.set('reminders', items); PatOS.emit('reminders'); }
  }

  /* ---------- system notifications (Chrome's own, outside PatOS) ---------- */
  const wantsSystem = () => PatOS.settings.systemNotifications !== false && window.Notification && Notification.permission === 'granted';
  const away = () => document.hidden || !document.hasFocus();
  async function sysNotify(x, ringing) {
    if (!wantsSystem()) return;
    const opts = { body: x.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: x.id, renotify: true, requireInteraction: !!ringing, data: { id: x.id } };
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        if (ringing) opts.actions = x.snooze ? [{ action: 'stop', title: T('Stop') }, { action: 'snooze', title: T('Snooze') }] : [{ action: 'stop', title: T('Stop') }];
        await reg.showNotification(x.title, opts); return;
      }
    } catch (e) {}
    try { const n = new Notification(x.title, opts); n.onclick = () => { window.focus(); n.close(); }; } catch (e) {}
  }
  async function closeSys(id) { try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg && reg.getNotifications) (await reg.getNotifications({ tag: id })).forEach((n) => n.close()); } catch (e) {} }
  // the Stop and Snooze buttons on Chrome's notification come back through the service worker
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data; if (!d || !d.patosNotif) return;
    if (d.action === 'snooze') snooze(d.id); else if (d.action === 'stop') stop(d.id);
    else if (ringing.has(d.id)) { const r = ringing.get(d.id); if (r.x.app && PatOS.apps[r.x.app]) PatOS.launch(r.x.app); }
  });
  let asked = false;
  function askPermission() {
    // asked once, when the person sets their first alarm, timer or reminder (Chrome needs a click to ask)
    if (asked || !window.Notification || Notification.permission !== 'default' || PatOS.store.get('notifAsked', false)) return;
    asked = true; PatOS.store.set('notifAsked', true);
    try { Notification.requestPermission().catch(() => {}); } catch (e) {}
  }

  /* ---------- ringing ---------- */
  const ringing = new Map();
  let stack = null, baseTitle = '';
  function fire(x) {
    PatOS.emit('alarm:fire', x);
    if (x.kind !== 'alarm' && x.kind !== 'timer') {
      PatOS.notify({ title: x.title, body: x.body || '', icon: x.icon, duration: 10000, onClick: () => x.app && PatOS.apps[x.app] && PatOS.launch(x.app) });
      if (!document.hidden && !document.hasFocus()) sysNotify(x, false);
      return;
    }
    stop(x.id);
    if (!stack) { stack = h('div', { id: 'alarm-stack', role: 'alertdialog', 'aria-live': 'assertive' }); document.body.appendChild(stack); }
    const card = h('div', { class: 'al-card' },
      h('div', { class: 'al-ic', html: PatOS.iconHTML(x.icon || 'clock') }),
      h('div', { class: 'al-txt' }, h('small', {}, T(x.kind === 'timer' ? 'Timer' : 'Alarm')), h('b', {}, x.title), h('span', {}, x.body || '')),
      h('div', { class: 'al-btns' },
        x.snooze ? h('button', { class: 'al-btn', onclick: () => snooze(x.id) }, T('Snooze')) : null,
        h('button', { class: 'al-btn stop', onclick: () => stop(x.id) }, T('Stop'))));
    stack.appendChild(card); requestAnimationFrame(() => card.classList.add('in'));
    const started = now(); let n = 0;
    const sound = (t) => {
      if (t - started > 60000) return; // a minute of ringing is enough
      if (n++ % 2) return;
      for (let i = 0; i < 4; i++) { PatOS.sound.tone(880, 0.12, { delay: i * 0.25, vol: 0.28, type: 'square', force: true }); PatOS.sound.tone(1175, 0.1, { delay: i * 0.25 + 0.12, vol: 0.22, type: 'square', force: true }); }
      if (document.hidden) { if (!baseTitle) baseTitle = document.title; document.title = n % 4 === 1 ? x.title + ' · ' + T(x.kind === 'timer' ? 'Timer' : 'Alarm') : baseTitle; }
    };
    sound(started); subs.add(sound);
    ringing.set(x.id, { x, card, sound });
    if (away()) sysNotify(x, true);
    if (PatOS.mobile && PatOS.mobile.islandAlert) PatOS.mobile.islandAlert(x.title, x.icon || 'clock');
    try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) {}
  }
  function stop(id) {
    const r = ringing.get(id); if (!r) return;
    ringing.delete(id); subs.delete(r.sound);
    r.card.classList.remove('in'); setTimeout(() => r.card.remove(), 250);
    if (!ringing.size && baseTitle) { document.title = baseTitle; baseTitle = ''; }
    closeSys(id); PatOS.emit('alarm:stop', r.x);
  }
  function snooze(id) {
    const r = ringing.get(id); const x = r ? r.x : null; stop(id); if (!x) return;
    const at = now() + 9 * 60000;
    schedule(Object.assign({}, x, { id: x.id.replace(/:snooze$/, '') + ':snooze', at, body: T('Snoozed') + ' · ' + timeStr(x.at) }));
    PatOS.notify({ title: T('Snoozed for 9 minutes'), body: x.title + ' · ' + timeStr(at), icon: x.icon || 'clock', duration: 3500 });
  }
  function missed(x) {
    PatOS.notify({ title: T('Missed') + ': ' + x.title, body: T(x.kind === 'timer' ? 'Timer' : x.kind === 'alarm' ? 'Alarm' : 'Reminder') + ' · ' + timeStr(x.at) + ' · ' + T('PatOS was closed'), icon: x.icon || 'clock', duration: 12000 });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ringing.size) { const id = [...ringing.keys()].pop(); stop(id); } });

  PatOS.alarms = {
    onTick: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    schedule, cancel, stop, snooze, askPermission,
    get: (id) => queue().find((x) => x.id === id) || null,
    ringing: () => [...ringing.keys()],
    ringingInfo: () => [...ringing.values()].map((r) => r.x), // (the Pill shows them, with Stop and Snooze)
    upcoming: (kind) => queue().filter((x) => !kind || x.kind === kind)
  };
})();
