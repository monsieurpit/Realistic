/* Timeline — everything you did in PatOS, day by day, searchable, with one-click "restore this moment".
   The recording happens in js/timeline.js; this app shows it. Nothing here leaves the device. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const DAY = 86400000, HOUR = 3600000;
  const startOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const KINDS = [
    ['all', 'Everything', 'sparkle'], ['moment', 'Moments', 'window'], ['app', 'Apps', 'apps'], ['file', 'Files', 'doc'],
    ['web', 'Websites', 'link'], ['note', 'Notes', 'sticky'], ['clip', 'Clipboard', 'history']
  ];
  const CHEV = (d) => `<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;
  const VERB = { Opened: 'Opened', Edited: 'Edited', Visited: 'Visited', Searched: 'Searched for', Wrote: 'Wrote in' };

  PatOS.registerApp({
    id: 'timeline', name: 'Timeline', icon: 'timeline', width: 1060, height: 690, category: 'Utilities', single: true,
    onArgs: (w, a) => w.emit('args', a),
    keywords: 'history activity clipboard recall moments restore past yesterday find again historique activité presse-papiers moments restaurer hier retrouver',
    about: 'Everything you did in PatOS, day by day: find any file, website, note or copied text again, and bring back the windows you had open. It stays on this device.',
    launch(win, args) {
      const TL = PatOS.timeline;
      win.el.classList.add('has-toolbar');
      let day = args && args.day ? startOf(args.day) : startOf(Date.now());
      let filter = (args && args.filter) || 'all';
      let query = '';
      let month = new Date(day); month.setDate(1);

      /* ---------- toolbar: search and the recording pill ---------- */
      const q = h('input', { class: 'field tl-q', type: 'search', placeholder: T('Search your Timeline'), spellcheck: 'false', 'aria-label': T('Search your Timeline') });
      const pill = h('button', { class: 'tl-pill', 'aria-haspopup': 'menu' });
      win.toolbar.append(h('div', { class: 'tl-tbspace' }), q, pill);
      q.addEventListener('input', PatOS.debounce(() => { query = q.value.trim(); render(); }, 120));
      q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { q.value = ''; query = ''; render(); } });

      const rail = h('div', { class: 'tl-rail' });
      const main = h('div', { class: 'tl-main' });
      win.body.appendChild(h('div', { class: 'tl-app' }, rail, main));

      function paintPill() {
        const off = PatOS.settings.timeline === false, p = TL.paused();
        pill.className = 'tl-pill' + (off ? ' off' : p ? ' paused' : ' rec');
        pill.innerHTML = '';
        pill.append(h('span', { class: 'tl-dot' }), off ? T('Off') : p ? T('Paused') : T('Recording'));
      }
      pill.addEventListener('click', () => {
        const r = pill.getBoundingClientRect(); const off = PatOS.settings.timeline === false, p = TL.paused();
        PatOS.menu([
          off ? { label: T('Turn On Timeline'), action: () => PatOS.setSetting('timeline', true) } : null,
          !off && !p ? { label: T('Pause for 1 Hour'), action: () => TL.pause(HOUR) } : null,
          !off && !p ? { label: T('Pause Until Tomorrow'), action: () => TL.pause(startOf(Date.now()) + DAY - Date.now()) } : null,
          !off && p ? { label: T('Resume Recording'), action: () => TL.pause(0) } : null,
          { divider: true },
          { label: T('Clipboard History'), checked: PatOS.settings.timelineClips !== false, action: () => PatOS.setSetting('timelineClips', PatOS.settings.timelineClips === false) },
          { header: T('Keep for') },
          ...[7, 30, 90, 365].map((d) => ({ label: d === 365 ? T('1 year') : d + ' ' + T('days'), checked: (+PatOS.settings.timelineDays || 30) === d, action: () => PatOS.setSetting('timelineDays', d) })),
          { divider: true },
          { label: T('Forget the Last Hour'), action: () => forgetAsk(Date.now() - HOUR, null, T('Forget the last hour?')) },
          { label: T('Forget Today'), action: () => forgetAsk(startOf(Date.now()), null, T('Forget today?')) },
          { label: T('Forget Everything…'), action: () => forgetAsk(0, null, T('Forget everything in your Timeline?')) },
          { divider: true },
          !off ? { label: T('Turn Off Timeline'), action: () => PatOS.setSetting('timeline', false) } : null
        ], r.right - 220, r.bottom + 6);
      });
      async function forgetAsk(from, to, title) {
        if (!(await PatOS.confirmBox(title, T('Activity, moments and copied text from that time are deleted from this device. Pinned clips stay.'), { ok: T('Forget') }))) return;
        TL.forget(from, to); render();
      }

      /* ---------- the data ---------- */
      function items() {
        const out = [];
        TL.events().forEach((e) => out.push(Object.assign({ kind: e.k }, e)));
        TL.moments().forEach((m) => out.push({ kind: 'moment', t: m.t, t1: m.t1, m }));
        TL.clips().forEach((c) => out.push({ kind: 'clip', t: c.t, c }));
        return out.sort((a, b) => b.t - a.t);
      }
      const nameOf = (id) => { const a = PatOS.apps[id]; return a ? T(a.name) : id; };
      function text(it) {
        if (it.kind === 'moment') return it.m.wins.map((w) => nameOf(w.app) + ' ' + (w.title || '')).join(' ');
        if (it.kind === 'clip') return it.c.text;
        return [it.l, it.s, it.x].join(' ');
      }
      // "yesterday", "monday", "hier", "lundi"... in the search pick the day
      const WD = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
      function parse(raw) {
        let s = raw.toLowerCase(), from = 0, to = Infinity; const today = startOf(Date.now());
        const take = (re, f) => { if (re.test(s)) { s = s.replace(re, ' '); f(); } };
        take(/\b(today|aujourd['’]hui)\b/, () => { from = today; to = today + DAY; });
        take(/\b(yesterday|hier)\b/, () => { from = today - DAY; to = today; });
        take(/\b(this week|cette semaine)\b/, () => { from = today - 6 * DAY; });
        take(/\b(last week|la semaine derni[eè]re)\b/, () => { from = today - 13 * DAY; to = today - 6 * DAY; });
        Object.keys(WD).forEach((w) => take(new RegExp('\\b' + w + '\\b'), () => { const back = (new Date(today).getDay() - WD[w] + 7) % 7 || 7; from = today - back * DAY; to = from + DAY; }));
        return { words: s.split(/\s+/).filter(Boolean), from, to };
      }

      /* ---------- small pieces ---------- */
      const time = (t) => new Date(t).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' });
      function dayTitle(d) {
        const today = startOf(Date.now());
        if (d === today) return T('Today'); if (d === today - DAY) return T('Yesterday');
        const s = new Date(d).toLocaleDateString(PatOS.locale, { weekday: 'long', month: 'long', day: 'numeric', year: new Date(d).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
        return s.charAt(0).toUpperCase() + s.slice(1);
      }
      function miniDesk(m, cls) {
        // the windows of a moment, drawn where they were on the screen
        const box = h('div', { class: 'tl-desk ' + (cls || '') });
        const W = Math.max(innerWidth, 800), H = Math.max(innerHeight, 500);
        m.wins.slice(-8).forEach((w, i) => {
          const a = PatOS.apps[w.app];
          const r = w.max ? { x: 0, y: 28, w: W, h: H - 28 } : w;
          box.appendChild(h('div', { class: 'tl-dw' + (w.active ? ' act' : ''), style: { left: (r.x / W * 100).toFixed(2) + '%', top: (r.y / H * 100).toFixed(2) + '%', width: (r.w / W * 100).toFixed(2) + '%', height: (r.h / H * 100).toFixed(2) + '%', '--d': i * 40 + 'ms' } },
            h('span', { class: 'tl-dwi', html: PatOS.iconHTML(a ? a.icon || w.app : 'finder') })));
        });
        return box;
      }
      function momentTitle(m) {
        const names = [...new Set(m.wins.map((w) => nameOf(w.app)))];
        return names.length <= 3 ? names.join(', ') : names.slice(0, 3).join(', ') + ' ' + T('and') + ' ' + (names.length - 3) + ' ' + T('more');
      }
      function open(it) {
        if (it.kind === 'moment') return TL.restoreMoment(it.m);
        if (it.kind === 'clip') { TL.copy(it.c.text); return PatOS.notify({ title: T('Copied'), body: it.c.text.slice(0, 80), icon: 'timeline', duration: 2000 }); }
        const r = it.ref || {};
        if (r.path) { if (PatOS.fs.get(r.path)) return PatOS.openFile(r.path); return PatOS.notify({ title: T('This file is gone'), body: r.path, icon: 'finder' }); }
        if (r.url) return PatOS.launch('browser', { url: r.url });
        if (r.note) return PatOS.launch('notes', { id: r.note });
        if (r.app) return PatOS.launch(r.app, r.args || {});
      }
      function iconOf(it) {
        if (it.kind === 'file') { const n = PatOS.fs.get(it.ref.path); return n ? PatOS.fileIconHTML(it.ref.path, n) : PatOS.iconHTML('finder'); }
        if (it.kind === 'web') return PatOS.iconHTML('browser');
        if (it.kind === 'note') return PatOS.iconHTML('notes');
        if (it.kind === 'app') return PatOS.iconHTML(it.ic || 'finder');
        return '';
      }
      function mark(str, words) {
        str = String(str || ''); if (!words.length) return str;
        const low = str.toLowerCase(); let best = -1, w0 = '';
        words.forEach((w) => { const i = low.indexOf(w); if (i >= 0 && (best < 0 || i < best)) { best = i; w0 = w; } });
        if (best < 0) return str;
        const a = Math.max(0, best - 60);
        return h('span', {}, (a ? '…' : '') + str.slice(a, best), h('mark', {}, str.slice(best, best + w0.length)), str.slice(best + w0.length, best + w0.length + 160));
      }
      function card(it, i, words) {
        words = words || [];
        const forget = h('button', { class: 'tl-x', title: T('Forget this'), 'aria-label': T('Forget this'), html: PatOS.sym('close'), onclick: (e) => { e.stopPropagation(); TL.forgetItem(it.kind === 'moment' ? 'moment' : it.kind === 'clip' ? 'clip' : 'event', it.kind === 'moment' ? it.m.t : it.kind === 'clip' ? it.c.id : it.t); render(); } });
        const style = { '--i': Math.min(i, 14) };
        if (it.kind === 'moment') {
          const dur = Math.max(1, Math.round((it.t1 - it.t) / 60000));
          return h('div', { class: 'tl-card tl-moment', style, onclick: () => open(it) }, miniDesk(it.m),
            h('div', { class: 'tl-cm' }, h('small', { class: 'tl-kind' }, T('Moment') + ' · ' + time(it.t) + (dur > 1 ? ' – ' + time(it.t1) : '')), h('b', {}, mark(momentTitle(it.m), words)),
              h('small', {}, it.m.wins.length + ' ' + T(it.m.wins.length === 1 ? 'window' : 'windows') + (dur > 1 ? ' · ' + (dur >= 60 ? Math.floor(dur / 60) + ' h ' + (dur % 60 ? dur % 60 + ' min' : '') : dur + ' min') : '')),
              h('button', { class: 'btn primary tl-restore', onclick: (e) => { e.stopPropagation(); open(it); } }, h('span', { html: PatOS.sym('rotate') }), T('Restore'))), forget);
        }
        if (it.kind === 'clip') {
          const c = it.c;
          return h('div', { class: 'tl-card tl-clip' + (c.pin ? ' pin' : ''), style, onclick: () => open(it), title: T('Copy again') },
            h('span', { class: 'tl-ci', html: PatOS.sym('history') }),
            h('div', { class: 'tl-ct' }, h('small', { class: 'tl-kind' }, T('Copied') + ' · ' + time(c.t) + (c.app && PatOS.apps[c.app] ? ' · ' + nameOf(c.app) : '')), h('div', { class: 'tl-ctext' }, mark(c.text.length > 400 ? c.text.slice(0, 400) + '…' : c.text, words))),
            h('button', { class: 'tl-pin' + (c.pin ? ' on' : ''), title: c.pin ? T('Unpin') : T('Pin'), 'aria-label': c.pin ? T('Unpin') : T('Pin'), html: PatOS.sym('pin'), onclick: (e) => { e.stopPropagation(); TL.pin(c.id); render(); } }), forget);
        }
        const verb = T(VERB[it.verb] || (it.kind === 'app' ? 'Opened' : 'Opened'));
        return h('div', { class: 'tl-card tl-ev k-' + it.kind, style, onclick: () => open(it), title: it.kind === 'web' && it.ref.url ? it.ref.url : '' },
          h('span', { class: 'tl-ei', html: iconOf(it) }),
          h('div', { class: 'tl-et' }, h('small', { class: 'tl-kind' }, verb + ' · ' + time(it.t) + (it.n > 1 ? ' · ' + it.n + '×' : '')), h('b', {}, mark(it.l, words)), it.x && words.length ? h('small', { class: 'tl-snip' }, mark(it.x, words)) : (it.s ? h('small', {}, it.kind === 'file' ? '~' + it.s : it.s) : null)),
          forget);
      }

      /* ---------- the rail: pick up, the calendar, the filters ---------- */
      function paintRail(all) {
        rail.innerHTML = '';
        const last = TL.lastSession();
        if (last && !query && day === startOf(Date.now())) {
          rail.appendChild(h('div', { class: 'tl-resume' }, h('small', {}, T('Pick up where you left off')), miniDesk(last, 'big'),
            h('b', {}, momentTitle(last)), h('small', { class: 'tl-rs' }, (startOf(last.t1) === startOf(Date.now()) ? T('Today') : startOf(last.t1) === startOf(Date.now()) - DAY ? T('Yesterday') : new Date(last.t1).toLocaleDateString(PatOS.locale, { month: 'short', day: 'numeric' })) + ', ' + time(last.t1)),
            h('button', { class: 'btn primary', onclick: () => TL.restoreMoment(last) }, T('Restore These Windows'))));
        }
        // a month: each day shaded by how much happened
        const counts = {}; all.forEach((it) => { const d = startOf(it.t); counts[d] = (counts[d] || 0) + 1; });
        const max = Math.max(1, ...Object.values(counts));
        const cal = h('div', { class: 'tl-cal' });
        const mName = month.toLocaleDateString(PatOS.locale, { month: 'long', year: 'numeric' });
        cal.appendChild(h('div', { class: 'tl-calh' }, h('button', { class: 'tbtn', 'aria-label': T('Previous month'), onclick: () => { month.setMonth(month.getMonth() - 1); paintRail(all); }, html: CHEV(-1) }), h('b', {}, mName.charAt(0).toUpperCase() + mName.slice(1)), h('button', { class: 'tbtn', 'aria-label': T('Next month'), onclick: () => { month.setMonth(month.getMonth() + 1); paintRail(all); }, html: CHEV(1) })));
        const grid = h('div', { class: 'tl-calg' });
        const first = new Date(month); const lead = (first.getDay() + 6) % 7; // weeks start on Monday
        const base = new Date(1970, 0, 5); // a Monday
        for (let i = 0; i < 7; i++) grid.appendChild(h('span', { class: 'tl-wd' }, new Date(base.getTime() + i * DAY).toLocaleDateString(PatOS.locale, { weekday: 'narrow' })));
        for (let i = 0; i < lead; i++) grid.appendChild(h('span'));
        const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), today = startOf(Date.now());
        for (let d = 1; d <= dim; d++) {
          const t = new Date(month.getFullYear(), month.getMonth(), d).getTime(), n = counts[t] || 0;
          const lvl = n ? Math.min(4, 1 + Math.floor(n / max * 3.99)) : 0;
          grid.appendChild(h('button', { class: 'tl-day l' + lvl + (t === day ? ' sel' : '') + (t === today ? ' today' : ''), disabled: t > today, title: n ? n + ' ' + T('things') : '', onclick: () => { day = t; query = ''; q.value = ''; render(); } }, String(d)));
        }
        cal.appendChild(grid); rail.appendChild(cal);
        // filters, with how many of each there are on the day shown
        const dayItems = all.filter((it) => it.t >= day && it.t < day + DAY);
        const fl = h('div', { class: 'tl-filters' });
        KINDS.forEach(([k, label, sym]) => {
          const n = k === 'all' ? dayItems.length : dayItems.filter((it) => it.kind === k).length;
          fl.appendChild(h('button', { class: 'fd-si tl-f' + (filter === k ? ' on' : ''), onclick: () => { filter = k; render(); } }, h('span', { html: PatOS.sym(sym) }), h('span', { class: 'tl-fl' }, T(label)), h('small', {}, n || '')));
        });
        rail.appendChild(fl);
        rail.appendChild(h('div', { class: 'tl-private' }, h('span', { html: PatOS.sym('lock') }), T('Only on this device. Never synced, no screenshots, nothing from Passwords.')));
      }

      /* ---------- the day ---------- */
      function ribbon(list) {
        const per = new Array(24).fill(0); list.forEach((it) => per[new Date(it.t).getHours()]++);
        const max = Math.max(1, ...per); const nowH = day === startOf(Date.now()) ? new Date().getHours() : -1;
        const r = h('div', { class: 'tl-ribbon', role: 'img', 'aria-label': T('Activity by hour') });
        per.forEach((n, hr) => r.appendChild(h('button', { class: 'tl-bar' + (n ? '' : ' none') + (hr === nowH ? ' now' : ''), style: { '--v': (n / max).toFixed(3), '--d': hr * 18 + 'ms' }, title: String(hr).padStart(2, '0') + ':00 · ' + n, onclick: () => { const g = main.querySelector('[data-hour="' + hr + '"]'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); } })));
        const lab = h('div', { class: 'tl-rlab' }); [0, 6, 12, 18, 24].forEach((x) => lab.appendChild(h('span', {}, new Date(2000, 0, 1, x % 24).toLocaleTimeString(PatOS.locale, { hour: 'numeric' }))));
        return h('div', { class: 'tl-rib' }, r, lab);
      }
      function empty(msg, sub) { return h('div', { class: 'tl-empty' }, h('div', { class: 'tl-eic', html: PatOS.iconHTML('timeline') }), h('b', {}, msg), sub ? h('p', {}, sub) : null); }

      function render() {
        paintPill();
        const all = items();
        paintRail(all);
        main.innerHTML = '';
        const off = PatOS.settings.timeline === false;
        if (off) main.appendChild(h('div', { class: 'tl-banner' }, h('span', { html: PatOS.sym('pause') }), h('div', {}, h('b', {}, T('Timeline is off')), h('small', {}, T('Nothing new is recorded. What is already here stays until you forget it.'))), h('button', { class: 'btn', onclick: () => PatOS.setSetting('timeline', true) }, T('Turn On'))));
        else if (TL.paused()) main.appendChild(h('div', { class: 'tl-banner' }, h('span', { html: PatOS.sym('pause') }), h('div', {}, h('b', {}, T('Paused until') + ' ' + time(TL.pauseUntil())), h('small', {}, T('Nothing is recorded while Timeline is paused.'))), h('button', { class: 'btn', onclick: () => TL.pause(0) }, T('Resume'))));

        if (query) {
          const p = parse(query);
          const res = all.filter((it) => it.t >= p.from && it.t < p.to && (filter === 'all' || it.kind === filter) && p.words.every((w) => text(it).toLowerCase().includes(w))).slice(0, 300);
          main.appendChild(h('div', { class: 'tl-head' }, h('h1', {}, T('Results')), h('p', {}, res.length + ' ' + T(res.length === 1 ? 'match' : 'matches') + ' · “' + query + '”')));
          if (!res.length) return main.appendChild(empty(T('Nothing found'), T('Try other words, or a day: “yesterday”, “monday”, “this week”.')));
          let lastD = -1, i = 0; const stream = h('div', { class: 'tl-stream' });
          res.forEach((it) => { const d = startOf(it.t); if (d !== lastD) { stream.appendChild(h('div', { class: 'tl-hour tl-dayh' }, h('span', {}, dayTitle(d)))); lastD = d; } stream.appendChild(card(it, i++, p.words)); });
          return main.appendChild(stream);
        }

        const list = all.filter((it) => it.t >= day && it.t < day + DAY);
        const shown = list.filter((it) => filter === 'all' || it.kind === filter);
        const firstT = list.length ? list[list.length - 1].t : 0, lastT = list.length ? list[0].t : 0;
        const nav = h('div', { class: 'tl-nav' },
          h('button', { class: 'tbtn', 'aria-label': T('Previous day'), html: CHEV(-1), onclick: () => { day -= DAY; day = startOf(day + HOUR * 2); month = new Date(day); month.setDate(1); render(); } }),
          h('button', { class: 'tbtn', 'aria-label': T('Next day'), disabled: day >= startOf(Date.now()), html: CHEV(1), onclick: () => { day = startOf(day + DAY + HOUR * 2); month = new Date(day); month.setDate(1); render(); } }),
          day !== startOf(Date.now()) ? h('button', { class: 'btn sm', onclick: () => { day = startOf(Date.now()); month = new Date(day); month.setDate(1); render(); } }, T('Today')) : null);
        main.appendChild(h('div', { class: 'tl-head' }, h('div', {}, h('h1', {}, dayTitle(day)),
          h('p', {}, list.length ? list.length + ' ' + T(list.length === 1 ? 'thing' : 'things') + ' · ' + time(firstT) + ' – ' + time(lastT) : T('Nothing recorded this day'))), nav));
        main.appendChild(ribbon(list));
        if (!shown.length) {
          const fresh = !TL.events().length && !TL.moments().length && !TL.clips().length;
          return main.appendChild(fresh ? empty(T('Your Timeline starts now'), T('Use PatOS as usual. The apps and files you open, the websites you visit, what you copy and the windows you had open show up here, so you can find them again and pick up where you left off.'))
            : empty(filter === 'all' ? T('Nothing recorded this day') : T('Nothing of this kind this day')));
        }
        // hour by hour, newest first, along a line
        const stream = h('div', { class: 'tl-stream' }); let lastHr = -1, i = 0;
        shown.forEach((it) => {
          const hr = new Date(it.t).getHours();
          if (hr !== lastHr) { stream.appendChild(h('div', { class: 'tl-hour', 'data-hour': hr }, h('span', {}, new Date(2000, 0, 1, hr).toLocaleTimeString(PatOS.locale, { hour: 'numeric', minute: '2-digit' })))); lastHr = hr; }
          stream.appendChild(card(it, i++));
        });
        main.appendChild(stream);
      }

      const offs = [PatOS.on('timeline', () => { if (!main.matches(':hover') || !document.hasFocus()) render(); else renderSoon(); }),
        PatOS.on('setting:timeline', render), PatOS.on('setting:timelineClips', render), PatOS.on('setting:timelineDays', render)];
      const renderSoon = PatOS.debounce(render, 2500);
      win.on('closed', () => offs.forEach((f) => f()));
      // reopened with other arguments (Alt+V › Open Timeline)
      win.on('args', (a) => { if (a && a.filter) { filter = a.filter; render(); } });
      render();
      setTimeout(() => q.focus(), 60);
    }
  });
})();
