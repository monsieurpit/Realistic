/* Shortcuts: build little automations. A shortcut is a list of steps that run one after the other, and it can start by hand,
   when you unlock PatOS, every day at a time, or when you say "Hey Pat, ..." (see js/shortcuts.js). */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const S = () => PatOS.shortcuts;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const apps = () => PatOS.appOrder.filter((k) => PatOS.apps[k] && !PatOS.apps[k].hidden && !PatOS.apps[k].action).map((k) => [k, PatOS.t(PatOS.apps[k].name)]).sort((a, b) => a[1].localeCompare(b[1]));
  const triggerText = (t) => !t || t.type === 'manual' ? T('Runs when you press it') : t.type === 'login' ? T('When you unlock PatOS') : t.type === 'time' ? T('Every day at') + ' ' + t.at + (t.days && t.days.length && t.days.length < 7 ? ' (' + t.days.map((d) => T(DAYS[d])).join(', ') + ')' : '') : T('When you say') + ' “Hey Pat, ' + (t.phrase || '…') + '”';

  PatOS.registerApp({
    id: 'shortcuts', name: 'Shortcuts', icon: 'shortcuts', width: 900, height: 620, minWidth: 360, minHeight: 360, category: 'Utilities', keywords: 'shortcuts automation automate routine macro hey pat voice when i unlock raccourcis automatisation',
    about: 'Build automations: open apps, ask Pat for a timer, change the theme and more. Start them by hand, when you unlock PatOS, at a time of day, or by saying “Hey Pat”.',
    launch(win) {
      win.el.classList.add('has-toolbar');
      const side = h('div', { class: 'sc-side' }), main = h('div', { class: 'sc-main' }); win.body.appendChild(h('div', { class: 'sc' }, side, main));
      let cur = null, logs = {}; const bNew = h('button', { class: 'btn primary' }, T('New Shortcut')), bGal = h('button', { class: 'btn' }, T('Gallery'));
      win.toolbar.append(bNew, bGal); win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px'; win.toolbar.style.gap = '8px';
      const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'shortcuts' });
      bNew.onclick = () => { const sc = S().save({ name: T('New Shortcut'), steps: [{ type: 'openApp', p: { app: 'notes' } }] }); cur = sc.id; drawSide(); drawMain(); win.el.classList.add('sc-open'); };
      bGal.onclick = () => { cur = '__gallery'; drawSide(); drawMain(); win.el.classList.add('sc-open'); };

      function drawSide() {
        side.innerHTML = ''; const all = S().list();
        if (!all.length) side.appendChild(h('div', { class: 'sc-empty' }, T('No shortcuts yet. Press New Shortcut, or look in the Gallery.')));
        all.forEach((s) => side.appendChild(h('div', { class: 'sc-row' + (cur === s.id ? ' on' : '') + (s.on === false ? ' off' : ''), role: 'button', tabindex: '0', onclick: () => { cur = s.id; drawSide(); drawMain(); win.el.classList.add('sc-open'); } }, h('div', { class: 'sc-ic' }, s.name.charAt(0).toUpperCase()), h('div', { class: 'sc-rt' }, h('b', {}, s.name), h('small', {}, triggerText(s.trigger))), h('button', { class: 'sc-play', title: T('Run'), 'aria-label': T('Run') + ' ' + s.name, onclick: (e) => { e.stopPropagation(); runIt(s.id); } }, T('Run')))));
      }
      async function runIt(id) { const sc = S().get(id); if (!sc) return; logs[id] = null; drawMain(); const r = await S().run(sc); logs[id] = r.log; if (cur === id) drawMain(); }

      function field(label, el) { return h('label', { class: 'ps-field' }, h('span', {}, label), el); }
      function paramInput(sc, step, d) {
        const val = step.p[d.k] != null ? step.p[d.k] : d.def; let el;
        if (d.type === 'app') { el = h('select', { class: 'field' }, ...apps().map(([k, n]) => h('option', { value: k }, n))); el.value = val; }
        else if (d.type === 'choice') { el = h('select', { class: 'field' }, ...d.choices.map(([k, n]) => h('option', { value: k }, T(n)))); el.value = val; }
        else if (d.type === 'number') { el = h('input', { class: 'field', type: 'number', min: d.min, max: d.max, value: val, style: { width: '110px' } }); }
        else el = h('input', { class: 'field', value: val == null ? '' : val, maxlength: '300', spellcheck: 'false' });
        el.setAttribute('aria-label', T(d.label)); el.onchange = () => { step.p[d.k] = d.type === 'number' ? Math.max(d.min == null ? -1e9 : d.min, Math.min(d.max == null ? 1e9 : d.max, +el.value || 0)) : el.value; S().save(sc); drawSide(); };
        return h('label', { class: 'sc-param' }, h('span', {}, T(d.label)), el);
      }
      function drawMain() {
        main.innerHTML = '';
        if (cur === '__gallery') {
          main.appendChild(h('div', { class: 'sc-edit' }, h('div', { class: 'sc-head' }, h('button', { class: 'tbtn sc-back', onclick: () => { win.el.classList.remove('sc-open'); cur = null; drawSide(); drawMain(); } }, '‹'), h('h2', {}, T('Gallery'))), h('p', { class: 'sc-note' }, T('Start from one of these, then change it to be yours.')),
            ...S().gallery().map((g) => h('div', { class: 'sc-gal' }, h('div', {}, h('b', {}, g.name), h('small', {}, triggerText(g.trigger) + ' · ' + g.steps.map((x) => T(S().actions[x.type].label)).join(', '))), h('button', { class: 'btn', onclick: () => { const sc = S().save({ name: g.name, trigger: g.trigger, steps: JSON.parse(JSON.stringify(g.steps)) }); cur = sc.id; drawSide(); drawMain(); } }, T('Add'))))));
          return;
        }
        const sc = cur ? S().get(cur) : null;
        if (!sc) { main.appendChild(h('div', { class: 'sc-card' }, h('h2', {}, T('Shortcuts')), h('p', {}, T('Small automations: open apps, start a timer, change the theme. Run them by hand, at a time, at unlock or with “Hey Pat”.')), h('p', { class: 'sc-note' }, S().voice.supported() ? T('Turn on Hey Pat in Settings › Pat Voice to use your voice.') : T('Voice needs Chrome or Safari.')))); return; }
        const nameIn = h('input', { class: 'field', value: sc.name, maxlength: '40', 'aria-label': T('Name') }); nameIn.onchange = () => { sc.name = nameIn.value.trim() || T('New Shortcut'); S().save(sc); drawSide(); };
        const on = h('button', { class: 'switch' + (sc.on !== false ? ' on' : ''), role: 'switch', 'aria-checked': String(sc.on !== false), 'aria-label': T('Turned on') }); on.onclick = () => { sc.on = sc.on === false; S().save(sc); drawSide(); drawMain(); };
        // when it starts
        const t = sc.trigger || { type: 'manual' };
        const sel = h('select', { class: 'field', 'aria-label': T('Starts') }, ...[['manual', T('When I press Run')], ['login', T('When I unlock PatOS')], ['time', T('Every day at a time')], ['voice', T('When I say “Hey Pat, …”')]].map(([k, l]) => h('option', { value: k }, l))); sel.value = t.type;
        sel.onchange = () => { sc.trigger = sel.value === 'time' ? { type: 'time', at: '08:00', days: [0, 1, 2, 3, 4, 5, 6] } : sel.value === 'voice' ? { type: 'voice', phrase: sc.name.toLowerCase() } : { type: sel.value }; S().save(sc); drawSide(); drawMain(); };
        const extra = [];
        if (t.type === 'time') { const at = h('input', { class: 'field', type: 'time', value: t.at || '08:00', 'aria-label': T('Time') }); at.onchange = () => { t.at = at.value || '08:00'; S().save(sc); drawSide(); }; extra.push(h('div', { class: 'sc-days' }, at, ...DAYS.map((d, i) => { const c = h('input', { type: 'checkbox' }); c.checked = !t.days || !t.days.length || t.days.includes(i); c.onchange = () => { const cur2 = new Set(t.days && t.days.length ? t.days : [0, 1, 2, 3, 4, 5, 6]); c.checked ? cur2.add(i) : cur2.delete(i); t.days = [...cur2].sort(); S().save(sc); drawSide(); }; return h('label', { class: 'sc-day' }, c, T(d)); }))); }
        if (t.type === 'voice') { const ph = h('input', { class: 'field', value: t.phrase || '', maxlength: '60', placeholder: T('the words you say'), 'aria-label': T('Phrase') }); ph.onchange = () => { t.phrase = ph.value.trim(); S().save(sc); drawSide(); }; extra.push(h('div', { class: 'sc-days' }, h('span', {}, 'Hey Pat,'), ph)); }
        // the steps
        const steps = h('div', { class: 'sc-steps' });
        (sc.steps || []).forEach((step, i) => {
          const def = S().actions[step.type]; if (!def) return; step.p = step.p || {};
          steps.appendChild(h('div', { class: 'sc-step' }, h('div', { class: 'sc-sn' }, String(i + 1)), h('div', { class: 'sc-sb' }, h('b', {}, T(def.label)), ...def.params.map((d) => paramInput(sc, step, d))),
            h('div', { class: 'sc-sa' }, h('button', { class: 'tbtn', title: T('Move up'), 'aria-label': T('Move up'), disabled: i === 0, onclick: () => { [sc.steps[i - 1], sc.steps[i]] = [sc.steps[i], sc.steps[i - 1]]; S().save(sc); drawMain(); } }, '↑'), h('button', { class: 'tbtn', title: T('Move down'), 'aria-label': T('Move down'), disabled: i === sc.steps.length - 1, onclick: () => { [sc.steps[i + 1], sc.steps[i]] = [sc.steps[i], sc.steps[i + 1]]; S().save(sc); drawMain(); } }, '↓'), h('button', { class: 'tbtn', title: T('Remove step'), 'aria-label': T('Remove step'), onclick: () => { sc.steps.splice(i, 1); S().save(sc); drawMain(); } }, '×'))));
        });
        if (!sc.steps || !sc.steps.length) steps.appendChild(h('div', { class: 'sc-note' }, T('No steps yet. Press Add Step.')));
        const add = h('button', { class: 'btn' }, T('Add Step')); add.onclick = () => { const r = add.getBoundingClientRect(); PatOS.menu(Object.keys(S().actions).map((k) => ({ label: T(S().actions[k].label), action: () => { sc.steps = sc.steps || []; const p = {}; S().actions[k].params.forEach((d) => { p[d.k] = d.def; }); sc.steps.push({ type: k, p }); S().save(sc); drawMain(); } })), r.left, r.bottom + 4); };
        const lg = logs[sc.id]; const running = S().isRunning(sc.id);
        main.appendChild(h('div', { class: 'sc-edit' },
          h('div', { class: 'sc-head' }, h('button', { class: 'tbtn sc-back', 'aria-label': T('Back'), onclick: () => { win.el.classList.remove('sc-open'); } }, '‹'), h('h2', {}, sc.name), h('div', { class: 'sc-hb' }, h('button', { class: 'btn primary', disabled: running, onclick: () => runIt(sc.id) }, running ? T('Running…') : T('Run')))),
          h('div', { class: 'sc-grid' }, field(T('Name'), nameIn), field(T('Turned on'), on), field(T('Starts'), sel)), ...extra,
          h('h3', {}, T('Steps')), steps, h('div', { class: 'sc-acts' }, add, h('button', { class: 'btn', onclick: () => { const c = S().save({ name: sc.name + ' ' + T('copy'), trigger: sc.trigger && sc.trigger.type === 'manual' ? sc.trigger : { type: 'manual' }, steps: JSON.parse(JSON.stringify(sc.steps || [])) }); cur = c.id; drawSide(); drawMain(); } }, T('Duplicate')), h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Delete') + ' “' + sc.name + '”?', T('This shortcut is removed.'), { ok: T('Delete'), danger: true, icon: 'shortcuts' })) { S().remove(sc.id); cur = null; win.el.classList.remove('sc-open'); drawSide(); drawMain(); } } }, T('Delete'))),
          lg ? h('div', { class: 'sc-log', role: 'log' }, h('h3', {}, T('Last run')), ...lg.map((x) => h('div', { class: 'sc-ll' + (x.ok ? '' : ' bad') }, h('b', {}, T(x.label)), x.ok ? (x.out ? ' · ' + x.out : '') : ' · ' + x.error))) : null));
      }
      const offs = [PatOS.on('shortcuts', () => { if (win.el.isConnected) drawSide(); })]; win.on('closed', () => offs.forEach((f) => f()));
      drawSide(); drawMain();
    }
  });
  PatOS.iconDefs.shortcuts = { bg: 'linear-gradient(160deg,#ff6a5c,#c13bd1)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="14" width="26" height="20" rx="7" fill="#fff" opacity=".95"/><rect x="26" y="30" width="26" height="20" rx="7" fill="#fff" opacity=".7"/></svg>' };
})();
