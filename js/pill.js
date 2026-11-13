/* The PatOS Pill (3.3): a capsule of dark glass at the top centre of the screen that shows what is happening right now, and
   changes shape with it.
     - compact: the most important thing (a timer counting down, a copy's progress, the song playing with its live bars, an app
       using the microphone). A second thing shows as a small bubble beside it.
     - expanded (point at it, or click it): a card with what each thing is doing and its controls (pause, cancel, +1 min,
       play/next, turn the microphone off...). Click outside or press Esc to close it.
     - flashes: the volume, the brightness, Do Not Disturb, charging, going offline, a job that finished or failed: shown for a
       moment, then it goes back to what it was showing.
   What feeds it:
     PatOS.live (copies, backups, downloads...), Music, the Clock's timer and stopwatch, the microphone and camera (any app that
     uses them, so you always know), and anything else through PatOS.pill.set(id, item) / clear(id) / flash(item).
     item = { pri, lead (html), title, sub, trail (html), tone (a color), progress (0..1), actions: [{ icon, label, run }],
              big: () => element (the expanded view), open: () => {} }
   Only what is real is shown: no item is invented, and a job's progress is only what that job reports. Settings › Desktop &
   Dock › PatOS Pill turns it off (the small activity button in the menu bar comes back). */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const sym = (n) => (PatOS.sym ? PatOS.sym(n) : '');
  const esc = (s) => PatOS.esc(String(s == null ? '' : s));
  const on = () => PatOS.settings.pillOn !== false;
  const custom = new Map();
  let wrap = null, pill = null, side = null, live = null, measure = null;
  let mode = 'hidden', pinned = false, focusId = null, shown = null, flashNow = null, flashT = 0, hoverT = 0, leaveT = 0, tickT = 0, barsRaf = 0;
  const flashQ = [];

  /* ---------- small helpers ---------- */
  const two = (n) => String(n).padStart(2, '0');
  const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); const hh = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (hh ? hh + ':' + two(m) : m) + ':' + two(s % 60); };
  const ring = (p, color) => { const c = 2 * Math.PI * 7.5, d = (c * Math.max(0, Math.min(1, p))).toFixed(1); return '<svg class="pl-ring" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="2.6"/><circle cx="10" cy="10" r="7.5" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="' + d + ' ' + c.toFixed(1) + '" transform="rotate(-90 10 10)"/></svg>'; };
  const spin = '<svg class="pl-ring pl-spin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="2.6"/><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="12 36"/></svg>';
  const appIcon = (id) => '<span class="pl-app">' + (PatOS.iconHTML ? PatOS.iconHTML((PatOS.apps[id] && PatOS.apps[id].icon) || id) : '') + '</span>';
  const glyph = (n, color) => '<span class="pl-glyph" style="color:' + (color || '#fff') + '">' + sym(n) + '</span>';
  // digits that roll when they change (the timer, the stopwatch)
  const digits = (txt) => '<span class="pl-digits">' + String(txt).split('').map((c) => '<i>' + esc(c) + '</i>').join('') + '</span>';

  /* ======================= what it shows ======================= */
  /* 1. live activities */
  const ended = new Set();
  function liveItems() {
    if (!PatOS.live) return [];
    return PatOS.live.list().map((a) => ({
      id: 'live:' + a.id, pri: a.status === 'stalled' ? 45 : 60, lead: appIcon(a.app), title: a.title, sub: a.detail || (a.status === 'paused' ? T('Paused') : a.status === 'stalled' ? T('No news for a while') : ''),
      trail: a.progress != null ? ring(a.progress, 'var(--pl-accent)') + '<b class="pl-num">' + Math.round(a.progress * 100) + '%</b>' : spin, progress: a.progress,
      actions: [a.can.pause && { icon: 'pause', label: T('Pause'), run: () => PatOS.live.act(a.id, 'pause') }, a.can.resume && { icon: 'play', label: T('Resume'), run: () => PatOS.live.act(a.id, 'resume') },
        a.can.cancel && { icon: 'close', label: T('Cancel'), run: () => PatOS.live.act(a.id, 'cancel') }, a.can.open && { icon: 'window', label: T('Open'), run: () => PatOS.live.act(a.id, 'open') }].filter(Boolean),
      big: () => h('div', { class: 'pl-big' }, h('div', { class: 'pl-bar' + (a.progress == null ? ' busy' : '') }, h('i', { style: { width: a.progress == null ? '' : Math.round(a.progress * 100) + '%' } })),
        h('div', { class: 'pl-meta' }, h('span', {}, a.progress != null ? Math.round(a.progress * 100) + '%' : T('Working…')), a.eta ? h('span', {}, T('about') + ' ' + clock(a.eta) + ' ' + T('left')) : null))
    }));
  }
  function liveEnded() {
    if (!PatOS.live) return;
    PatOS.live.recent().forEach((a) => {
      if (ended.has(a.id) || Date.now() - a.ended > 4000) return; ended.add(a.id);
      if (a.status === 'done') flash({ lead: glyph('check', '#34c759'), title: a.title, sub: a.message || T('Done'), tone: '#34c759' });
      else if (a.status === 'failed') flash({ lead: glyph('warn', '#ff453a'), title: a.title, sub: T('didn’t finish'), tone: '#ff453a', ms: 3200 });
    });
  }

  /* 2. music */
  let lastPlaying = 0, artColor = { key: '', c: '' };
  function tintOf(np) {
    const key = np.path || ('g' + np.gen); if (artColor.key === key) return artColor.c;
    artColor = { key, c: '' };
    const m = String(np.color || '').match(/#[0-9a-f]{6}|rgba?\([^)]+\)/i); if (m) artColor.c = m[0];
    if (np.art) { const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } artColor.c = 'rgb(' + [r, g, b].map((v) => Math.round(v / 16)).join(',') + ')'; schedule(); } catch (e) {} }; img.src = np.art; }
    return artColor.c;
  }
  function musicItems() {
    const M = PatOS.music; if (!M || !M.nowPlaying) return [];
    const np = M.nowPlaying(); if (!np) return [];
    if (np.playing) lastPlaying = Date.now(); else if (Date.now() - lastPlaying > 20000) return [];
    const art = np.art ? '<img class="pl-art" src="' + esc(np.art) + '" alt="">' : '<span class="pl-art" style="background:' + esc(np.color || '#444') + '">' + sym('music') + '</span>';
    const tone = tintOf(np) || '#ff375f';
    return [{
      id: 'music', pri: 50, lead: art, title: np.title, sub: np.artist, tone,
      trail: '<span class="pl-eq' + (np.playing ? ' on' : '') + '"><i></i><i></i><i></i><i></i></span>',
      actions: [{ icon: 'prev', label: T('Previous'), run: () => M.prev() }, { icon: np.playing ? 'pause' : 'play', label: T(np.playing ? 'Pause' : 'Play'), run: () => M.toggle(), main: true }, { icon: 'next', label: T('Next'), run: () => M.next() }],
      open: () => PatOS.launch('music'),
      big: () => { const p = M.position ? M.position() : { t: 0, d: 0 }; return h('div', { class: 'pl-big' }, h('div', { class: 'pl-bar' }, h('i', { style: { width: p.d ? Math.min(100, p.t / p.d * 100) + '%' : '0' } })), h('div', { class: 'pl-meta' }, h('span', {}, clock(p.t * 1000)), h('span', {}, '−' + clock(Math.max(0, p.d - p.t) * 1000)))); }
    }];
  }
  // the bars move with the music itself (read from the player a few times a second, only while they're on screen)
  function bars() {
    cancelAnimationFrame(barsRaf); barsRaf = 0;
    const eq = pill && pill.querySelector('.pl-eq.on'); if (!eq || document.hidden || !PatOS.music || !PatOS.music.levels) return;
    let last = 0;
    const step = (t) => {
      if (!eq.isConnected) { barsRaf = 0; return; }
      if (t - last > 50) { last = t; const l = PatOS.music.levels(4); [...eq.children].forEach((b, i) => { b.style.transform = 'scaleY(' + (0.18 + Math.min(1, l[i] * 1.15) * 0.82).toFixed(3) + ')'; }); }
      barsRaf = requestAnimationFrame(step);
    };
    eq.classList.add('real'); barsRaf = requestAnimationFrame(step);
  }

  /* 3. the Clock's timer and stopwatch (saved, so they run with the Clock closed) */
  const tm = () => Object.assign({ running: false, end: 0, left: 0, total: 0, label: '' }, PatOS.store.get('clockTimer', null) || {});
  function saveTm(x) { PatOS.store.set('clockTimer', x); PatOS.emit('clock:timer'); schedule(); }
  function timerItems() {
    const x = tm(); const left = x.running ? Math.max(0, x.end - Date.now()) : x.left;
    if (!x.running && !(left > 0 && left < x.total)) return []; // (only one that runs, or is paused partway)
    const p = x.total ? left / x.total : 0;
    return [{
      id: 'timer', pri: 70, lead: glyph('timer', '#ff9f0a'), title: x.label || T('Timer'), sub: x.running ? T('Ends at') + ' ' + new Date(x.end).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' }) : T('Paused'), tone: '#ff9f0a',
      trail: '<b class="pl-num pl-orange">' + digits(clock(left)) + '</b>', progress: 1 - p, open: () => PatOS.launch('clock', { tab: 3 }),
      actions: [{ icon: x.running ? 'pause' : 'play', label: T(x.running ? 'Pause' : 'Resume'), main: true, run: () => {
        const y = tm();
        if (y.running) { y.left = Math.max(0, y.end - Date.now()); y.running = false; PatOS.alarms.cancel('clock-timer'); }
        else { y.end = Date.now() + y.left; y.running = true; PatOS.alarms.schedule({ id: 'clock-timer', kind: 'timer', at: y.end, title: y.label || T('Timer done'), body: T('Timer'), icon: 'clock', app: 'clock' }); }
        saveTm(y);
      } }, { icon: 'timer', label: '+1 min', run: () => {
        const y = tm(); y.total += 60000; if (y.running) { y.end += 60000; PatOS.alarms.schedule({ id: 'clock-timer', kind: 'timer', at: y.end, title: y.label || T('Timer done'), body: T('Timer'), icon: 'clock', app: 'clock' }); } else y.left += 60000; saveTm(y);
      } }, { icon: 'close', label: T('Cancel'), run: () => { const y = tm(); y.running = false; y.left = y.total; PatOS.alarms.cancel('clock-timer'); saveTm(y); } }],
      big: () => h('div', { class: 'pl-big pl-count' }, h('div', { class: 'pl-huge', html: digits(clock(left)) }), h('div', { class: 'pl-bar orange' }, h('i', { style: { width: (p * 100).toFixed(1) + '%' } })))
    }];
  }
  const sw = () => Object.assign({ running: false, start: 0, acc: 0, laps: [] }, PatOS.store.get('clockStopwatch', null) || {});
  function stopwatchItems() {
    const s = sw(); if (!s.running) return [];
    const t = s.acc + (Date.now() - s.start);
    const fmt = (ms) => { const m = Math.floor(ms / 60000), sec = Math.floor(ms / 1000) % 60; return (m >= 60 ? Math.floor(m / 60) + ':' + two(m % 60) : m) + ':' + two(sec); };
    return [{ id: 'stopwatch', pri: 40, lead: glyph('clock', '#ff9f0a'), title: T('Stopwatch'), sub: s.laps.length ? s.laps.length + ' ' + T('laps') : '', tone: '#ff9f0a', trail: '<b class="pl-num pl-orange">' + digits(fmt(t)) + '</b>', open: () => PatOS.launch('clock', { tab: 2 }),
      actions: [{ icon: 'pause', label: T('Stop'), main: true, run: () => { const y = sw(); y.acc = y.acc + (Date.now() - y.start); y.running = false; PatOS.store.set('clockStopwatch', y); schedule(); } }],
      big: () => h('div', { class: 'pl-big pl-count' }, h('div', { class: 'pl-huge', html: digits(fmt(t)) })) }];
  }

  /* 4. the microphone and the camera: whichever app uses them, it is shown (and they can be turned off from here) */
  const media = new Map(); let mediaN = 0;
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !navigator.mediaDevices.__pill) {
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await gum(c);
      try {
        const id = 'media:' + (++mediaN), w = PatOS.wm && PatOS.wm.active;
        media.set(id, { stream, app: w ? w.app.id : '', name: w ? w.app.name : 'PatOS', since: Date.now() });
        stream.getTracks().forEach((t) => t.addEventListener('ended', schedule)); schedule();
      } catch (e) {}
      return stream;
    };
    navigator.mediaDevices.__pill = true;
  }
  function mediaItems() {
    const out = [];
    media.forEach((m, id) => {
      const tracks = m.stream.getTracks().filter((t) => t.readyState === 'live'); if (!tracks.length) { media.delete(id); return; }
      const cam = tracks.some((t) => t.kind === 'video'), mic = tracks.some((t) => t.kind === 'audio'), color = cam ? '#30d158' : '#ff9f0a';
      out.push({ id, pri: 90, lead: m.app ? appIcon(m.app) : glyph(cam ? 'camera' : 'mic', color), title: m.name, sub: T(cam && mic ? 'Camera and microphone on' : cam ? 'Camera on' : 'Microphone on'), tone: color,
        trail: '<span class="pl-dot" style="--c:' + color + '"></span><b class="pl-num">' + digits(clock(Date.now() - m.since)) + '</b>',
        actions: [{ icon: 'stop', label: T('Turn off'), run: () => { tracks.forEach((t) => t.stop()); media.delete(id); schedule(); } }, m.app && { icon: 'window', label: T('Show'), run: () => PatOS.launch(m.app) }].filter(Boolean) });
    });
    return out;
  }

  /* everything, most important first */
  function items() {
    let l = [];
    for (const f of [mediaItems, timerItems, liveItems, musicItems, stopwatchItems]) { try { l = l.concat(f()); } catch (e) {} }
    custom.forEach((it, id) => l.push(Object.assign({ pri: 55 }, it, { id: 'x:' + id })));
    l.sort((a, b) => b.pri - a.pri);
    if (focusId) { const i = l.findIndex((x) => x.id === focusId); if (i > 0) l.unshift(l.splice(i, 1)[0]); }
    return l;
  }

  /* ======================= drawing ======================= */
  function compactEl(it) {
    return h('div', { class: 'pl-row' }, h('span', { class: 'pl-lead', html: it.lead || '' }),
      h('span', { class: 'pl-t' + (it.flash ? ' inline' : '') }, h('b', {}, it.title || ''), it.bar == null && it.sub && it.flash ? h('small', {}, it.sub) : null),
      it.bar != null ? h('span', { class: 'pl-level' }, h('i', { style: { width: Math.round(it.bar * 100) + '%' } })) : null,
      it.trail ? h('span', { class: 'pl-trail', html: it.trail }) : null);
  }
  function card(it, first) {
    const acts = (it.actions || []).map((a) => h('button', { class: 'pl-act' + (a.main ? ' main' : ''), 'data-i': a.icon, 'aria-label': a.label, title: a.label, onclick: (e) => { e.stopPropagation(); a.run(); setTimeout(render, 60); }, html: a.icon && !/^\+/.test(a.label) ? sym(a.icon) : esc(a.label) }));
    if (!first) return h('button', { class: 'pl-mini', onclick: (e) => { e.stopPropagation(); focusId = it.id; render(); } }, h('span', { class: 'pl-lead', html: it.lead || '' }), h('span', { class: 'pl-t' }, h('b', {}, it.title || ''), it.sub ? h('small', {}, it.sub) : null), it.trail ? h('span', { class: 'pl-trail', html: it.trail }) : null);
    return h('div', { class: 'pl-card' },
      h('div', { class: 'pl-head' }, h('span', { class: 'pl-lead big', html: it.lead || '' }), h('span', { class: 'pl-t' }, h('b', {}, it.title || ''), it.sub ? h('small', {}, it.sub) : null),
        it.open ? h('button', { class: 'pl-open', 'aria-label': T('Open'), title: T('Open'), onclick: (e) => { e.stopPropagation(); collapse(); it.open(); }, html: sym('up') }) : null),
      it.big ? it.big() : null, acts.length ? h('div', { class: 'pl-acts' }, ...acts) : null);
  }
  function build() {
    wrap = h('div', { id: 'pill-wrap', 'aria-hidden': 'true' });
    pill = h('div', { id: 'pill', role: 'button', tabindex: '0', 'aria-label': T('Activities') });
    side = h('button', { id: 'pill-side', 'aria-label': T('Next activity') });
    live = h('div', { class: 'pl-sr', 'aria-live': 'polite' });
    measure = h('div', { id: 'pill-measure', 'aria-hidden': 'true' });
    wrap.append(pill, side, live, measure); document.body.appendChild(wrap);
    pill.addEventListener('pointerenter', () => { clearTimeout(leaveT); if (mode === 'compact' && !PatOS.isMobile) hoverT = setTimeout(() => expand(false), 420); });
    pill.addEventListener('pointerleave', () => { clearTimeout(hoverT); if (mode === 'expanded' && !pinned) leaveT = setTimeout(collapse, 380); });
    pill.addEventListener('click', () => { if (mode === 'expanded') { if (!pinned) { pinned = true; return; } const it = shown && shown[0]; if (it && it.open && !flashNow) { collapse(); it.open(); } return; } expand(true); });
    pill.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mode === 'expanded' ? collapse() : expand(true); } });
    pill.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); const it = shown && shown[0]; PatOS.menu([it && it.open ? { label: T('Open'), action: it.open } : null, { label: T('Hide the PatOS Pill'), action: () => PatOS.setSetting('pillOn', false) }].filter(Boolean), e.clientX, e.clientY + 8); });
    side.addEventListener('click', (e) => { e.stopPropagation(); const l = items(); if (l[1]) { focusId = l[1].id; expand(true); } });
    document.addEventListener('pointerdown', (e) => { if (mode === 'expanded' && wrap && !wrap.contains(e.target) && !e.target.closest('.menu')) collapse(); }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode === 'expanded') collapse(); });
  }
  function expand(pin) { if (!shown || !shown.length || flashNow) return; pinned = !!pin; mode = 'expanded'; render(); }
  function collapse() { pinned = false; focusId = null; if (mode === 'expanded') { mode = 'compact'; render(); } }

  /* sizes the capsule to its new content (measured first), then swaps the content with a short crossfade */
  let lastKey = '';
  function morph(content, key, cls) {
    const big = cls === 'expanded';
    measure.className = big ? 'big' : ''; measure.innerHTML = ''; measure.appendChild(content.cloneNode(true));
    const w = Math.ceil(big ? measure.offsetWidth : Math.min(measure.scrollWidth, innerWidth - 40)), hh = Math.ceil(measure.offsetHeight);
    pill.style.width = w + 'px'; pill.style.height = hh + 'px';
    pill.classList.toggle('expanded', big);
    const old = pill.querySelector('.pl-c:not(.out)');
    const box = h('div', { class: 'pl-c' }); box.appendChild(content);
    if (old && key === lastKey) { old.replaceWith(box); } // (the same thing, new numbers: no crossfade)
    else {
      if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 220); }
      box.classList.add('in'); pill.appendChild(box); requestAnimationFrame(() => box.classList.remove('in'));
      if (old && !PatOS.settings.reduceMotion && pill.animate) pill.animate([{ transform: big ? 'scale(.97,1.03)' : 'scale(1.05,.9)' }, { transform: 'none' }], { duration: 520, easing: PatOS.motion ? PatOS.motion.get().easing : 'ease-out' });
    }
    lastKey = key;
    // rolling digits: the ones that changed slide in
    box.querySelectorAll('.pl-digits').forEach((d, di) => { const prev = (pill._digits || [])[di] || ''; [...d.children].forEach((c, i) => { if (prev[i] !== undefined && prev[i] !== c.textContent) c.classList.add('roll'); }); });
    pill._digits = [...box.querySelectorAll('.pl-digits')].map((d) => d.textContent);
  }

  function render() {
    if (!pill) return;
    const vis = on() && PatOS.loggedIn && !document.getElementById('setup');
    if (!flashNow && flashQ.length && vis) { flashNow = flashQ.shift(); clearTimeout(flashT); flashT = setTimeout(() => { flashNow = null; render(); }, flashNow.ms || 1700); live.textContent = (flashNow.title || '') + ' ' + (flashNow.sub || ''); }
    const l = vis ? items() : []; shown = l;
    document.documentElement.classList.toggle('pill-on', on());
    if (!vis || (!l.length && !flashNow)) { if (mode !== 'hidden') { mode = 'hidden'; wrap.classList.remove('show', 'flashing', 'two'); pill.classList.remove('expanded'); } cancelAnimationFrame(barsRaf); barsRaf = 0; tick(); return; }
    if (mode === 'hidden') mode = 'compact';
    wrap.classList.add('show'); wrap.classList.toggle('flashing', !!flashNow);
    const it = flashNow || l[0];
    pill.style.setProperty('--pl-tone', it.tone || 'rgba(255,255,255,.0)');
    pill.classList.toggle('toned', !!it.tone);
    pill.style.setProperty('--pl-p', it.progress != null && mode !== 'expanded' ? String(it.progress) : '0');
    pill.classList.toggle('has-p', it.progress != null && mode !== 'expanded' && !flashNow);
    if (mode === 'expanded' && !flashNow) morph(h('div', { class: 'pl-list' }, ...l.slice(0, 4).map((x, i) => card(x, i === 0))), 'x:' + l.map((x) => x.id).join(','), 'expanded');
    else morph(compactEl(it), (flashNow ? 'f:' + (flashNow.kind || flashNow.title) : 'c:' + it.id), 'compact');
    pill.setAttribute('aria-label', T('Activities') + ': ' + l.map((x) => x.title + (x.sub ? ', ' + x.sub : '')).join('; '));
    // the second thing, as a bubble beside it
    const two = mode === 'compact' && !flashNow && l.length > 1;
    wrap.classList.toggle('two', two);
    if (two) { side.innerHTML = l[1].lead || ''; side.title = l[1].title + (l.length > 2 ? ' (+' + (l.length - 2) + ')' : ''); side.style.setProperty('--pl-tone', l[1].tone || 'transparent'); }
    bars(); tick();
  }
  const schedule = PatOS.debounce ? PatOS.debounce(render, 40) : render;

  /* a timer, a stopwatch, a recording or an expanded card change every second; nothing else needs a clock */
  function tick() {
    clearTimeout(tickT);
    const need = shown && shown.some((x) => x.id === 'timer' || x.id === 'stopwatch' || x.id.startsWith('media:') || (x.id === 'music' && mode === 'expanded'));
    if (need && !document.hidden) tickT = setTimeout(render, 1000 - (Date.now() % 1000) + 20);
  }

  /* ======================= flashes ======================= */
  function flash(o) {
    if (!on()) return;
    o = Object.assign({ flash: true }, o);
    // the same kind (volume, brightness) replaces the one on screen instead of waiting in line
    if (o.kind && flashNow && flashNow.kind === o.kind) { flashNow = o; clearTimeout(flashT); flashT = setTimeout(() => { flashNow = null; render(); }, o.ms || 1700); render(); return; }
    if (o.kind) { const i = flashQ.findIndex((x) => x.kind === o.kind); if (i >= 0) flashQ.splice(i, 1); }
    flashQ.push(o); if (flashQ.length > 4) flashQ.shift();
    if (!flashNow) render();
  }
  PatOS.on('setting:volume', (v) => flash({ kind: 'volume', lead: glyph(v > 0 ? 'speaker' : 'mute'), title: T('Volume'), bar: v }));
  PatOS.on('setting:brightness', (v) => flash({ kind: 'brightness', lead: glyph('sun', '#ffd60a'), title: T('Display'), bar: v }));
  PatOS.on('focus', (v) => flash({ kind: 'focus', lead: glyph('moon', v ? '#bf5af2' : '#fff'), title: T(v ? 'Do Not Disturb' : 'Do Not Disturb off'), sub: v ? T('On') : '', tone: v ? '#bf5af2' : '' }));
  addEventListener('offline', () => flash({ kind: 'net', lead: glyph('wifi', '#ff453a'), title: T('Offline'), tone: '#ff453a', ms: 2600 }));
  addEventListener('online', () => flash({ kind: 'net', lead: glyph('wifi', '#34c759'), title: T('Back online'), tone: '#34c759' }));
  if (navigator.getBattery) navigator.getBattery().then((b) => b.addEventListener('chargingchange', () => flash({ kind: 'battery', lead: glyph('bolt', b.charging ? '#34c759' : '#fff'), title: T(b.charging ? 'Charging' : 'On battery'), trail: '<b class="pl-num">' + Math.round(b.level * 100) + '%</b>', tone: b.charging ? '#34c759' : '' }))).catch(() => {});
  PatOS.on('alarm:fire', (x) => { if (x && x.id === 'clock-timer') flash({ lead: glyph('timer', '#ff9f0a'), title: T('Timer done'), tone: '#ff9f0a', ms: 3000 }); });

  PatOS.on('live', () => { liveEnded(); schedule(); });
  ['music', 'clock:timer', 'wm:ready', 'setting:pillOn', 'setting:language'].forEach((ev) => PatOS.on(ev, schedule));
  PatOS.on('setting', (s) => { if (s && (s.key === 'clockTimer' || s.key === 'clockStopwatch')) schedule(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); else { cancelAnimationFrame(barsRaf); barsRaf = 0; } });
  // the Clock saves its timer and stopwatch in the store: look again when it changes them
  const st0 = PatOS.store.set; PatOS.store.set = function (k) { const r = st0.apply(this, arguments); if (k === 'clockTimer' || k === 'clockStopwatch') schedule(); return r; };
  // logging in and out
  setInterval(() => { const vis = on() && PatOS.loggedIn; if (vis !== !!(wrap && wrap.classList.contains('show')) && (vis ? items().length : true)) render(); }, 1500);

  PatOS.pill = {
    set(id, item) { custom.set(String(id), item); schedule(); },
    clear(id) { custom.delete(String(id)); schedule(); },
    flash, expand: () => expand(true), collapse, render,
    get state() { return { mode, items: (shown || []).map((x) => x.id), flash: flashNow ? flashNow.title : null }; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { build(); render(); }); else { build(); render(); }
})();
