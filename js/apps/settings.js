/* Settings */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (x) => PatOS.t(x);
  const ACCENTS = ['#0a84ff', '#bf5af2', '#ff375f', '#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#64d2ff', '#8e8e93'];
  /* each setting: [key, name, icon] - the icon is a drawn symbol on a small colored glass tile ("symbol|color") */
  const PANES = PatOS.settingsPages; // (js/settings-catalog.js)
  const CATS = PatOS.settingsCategories; // (js/settings-catalog.js)
  // a small glass tile of the setting's color with its drawn symbol
  const stIc = (spec) => { const [n, c] = String(spec).split('|'); return h('span', { class: 'st-ic', style: { '--ic': c || '#8e8e93' }, html: PatOS.sym(n) }); };
  const catOf = (pane) => (CATS.find((c) => c[3].includes(pane)) || [])[0] || null;
  const KW = PatOS.settingsKeywords;
  // Spotlight searches Settings with this list
  PatOS.registerApp({
    id: 'settings', name: 'Settings', icon: 'settings', width: 800, height: 560, minWidth: 600, keywords: 'preferences settings control wallpaper theme dark parametres paramètres réglages reglages préférences',
    launch(win, args) {
      const toast = (t) => PatOS.notify({ title: t, body: '', icon: 'settings' });
      let findKey = args.find || ''; // a single setting to open right on (from Spotlight, Pat or Settings search)
      let pane = args.pane || (args.cat ? null : 'general'); let cat = args.cat || catOf(pane) || 'general'; if (args.cat && !args.pane) pane = null;
      const side = h('div', { class: 'st-side' });
      const main = h('div', { class: 'st-main' });
      win.body.appendChild(h('div', { class: 'st-wrap' }, side, main));
      // on a phone: the list of settings first, each pane on its own screen
      const MB = PatOS.mobile; if (MB && MB.stack) { MB.stack(win, PatOS.t('Settings')); side.classList.add('m-list'); main.classList.add('m-detail'); }
      const S = () => PatOS.settings;
      // a control takes its row's words as its accessible name (screen readers say "24-hour clock, switch, off")
      const row = (label, ctl, sub) => { if (ctl && ctl.nodeType === 1 && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(ctl.tagName) && !ctl.getAttribute('aria-label') && typeof label === 'string' && !(ctl.tagName === 'BUTTON' && ctl.textContent.trim())) ctl.setAttribute('aria-label', label); return h('div', { class: 'st-row' }, h('div', { class: 'st-rl' }, h('span', {}, label), sub ? h('small', {}, sub) : null), ctl); };
      const group = (...rows) => h('div', { class: 'st-group' }, ...rows);
      const toggle = (key, after) => { const t = h('button', { class: 'switch' + (S()[key] ? ' on' : ''), 'data-key': key, role: 'switch', 'aria-checked': String(!!S()[key]) }); t.onclick = () => { PatOS.setSetting(key, !S()[key]); t.classList.toggle('on', S()[key]); t.setAttribute('aria-checked', String(!!S()[key])); after && after(); }; return t; };
      const range = (key, min, max, step, fmt) => { const v = h('span', { class: 'st-val' }); const r = h('input', { type: 'range', min, max, step: step || 1, value: S()[key], 'data-key': key }); const upd = () => (v.textContent = fmt ? fmt(+r.value) : r.value); r.oninput = () => { PatOS.setSetting(key, +r.value); upd(); }; upd(); return h('div', { class: 'st-range' }, r, v); };
      const select = (key, opts) => { const s = h('select', { class: 'field', 'data-key': key }, ...opts.map(([v, l]) => h('option', { value: v, selected: S()[key] === v }, l))); s.onchange = () => PatOS.setSetting(key, s.value); return s; };

      const fold = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const fmtBytes = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');
      const when = (t) => new Date(t).toLocaleString(PatOS.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const badge = (state, text) => h('span', { class: 'st-badge ' + state }, h('span', { class: 'st-dot', 'aria-hidden': 'true' }), text); // (color AND words, never color alone)
      const panes = {
        /* ---------- Applications: every app, what it is, what it may do, what it keeps, what went wrong ---------- */
        apps() {
          const out = h('div', { class: 'st-apps' }); const PA = PatOS.patapps;
          const q = h('input', { class: 'field st-search', placeholder: T('Search apps'), 'aria-label': T('Search apps'), type: 'search' });
          const listEl = h('div', { class: 'st-group' }); const detail = h('div');
          const muted = () => S().mutedApps || [];
          function draw() {
            listEl.innerHTML = ''; const f = fold(q.value.trim());
            const ids = PatOS.appOrder.filter((k) => PatOS.apps[k] && !(PatOS.apps[k].hidden && !PatOS.apps[k].patapp) && (!f || fold(T(PatOS.apps[k].name)).includes(f)));
            ids.forEach((k) => { const a = PatOS.apps[k]; const errs = (PatOS.errors.list() || []).filter((e) => e.app === k || String(e.where).includes(k)).length;
              listEl.appendChild(h('button', { class: 'st-row st-link', onclick: () => open(k) }, h('span', { class: 'st-app-ic', html: PatOS.iconHTML(a.icon || k) }), h('span', { class: 'st-link-l' }, T(a.name), h('small', {}, a.patapp ? T('Community app') : T('Built into PatOS'))), errs ? badge('warn', errs + ' ' + T('problems')) : null, h('span', { class: 'st-chev', 'aria-hidden': 'true' }, '›'))); });
            if (!ids.length) listEl.appendChild(h('div', { class: 'bk-empty' }, T('No app has that name.')));
          }
          function open(k) {
            const a = PatOS.apps[k]; detail.innerHTML = ''; const ent = a.patapp && PA ? PA.list().find((x) => 'pa:' + x.id === k) : null; const rec = ent && ent.app ? Object.assign({ source: ent.source }, ent.app) : null;
            const data = rec ? JSON.stringify((PatOS.store.get('patAppData', {}) || {})[rec.id] || {}).length : 0;
            
            const errs = (PatOS.errors.list() || []).filter((e) => e.app === k || String(e.where).includes(k)).slice(-5);
            const mute = h('button', { class: 'switch' + (muted().includes(k) ? '' : ' on'), role: 'switch', 'aria-checked': String(!muted().includes(k)), 'aria-label': T('Notifications') });
            mute.onclick = () => { const m = muted(); PatOS.setSetting('mutedApps', m.includes(k) ? m.filter((x) => x !== k) : m.concat(k)); mute.classList.toggle('on', !S().mutedApps.includes(k)); mute.setAttribute('aria-checked', String(!S().mutedApps.includes(k))); };
            const hid = h('button', { class: 'switch' + ((S().hiddenApps || []).includes(k) ? '' : ' on'), role: 'switch', 'aria-label': T('Show in Launchpad') });
            hid.onclick = () => { const l = S().hiddenApps || []; PatOS.setSetting('hiddenApps', l.includes(k) ? l.filter((x) => x !== k) : l.concat(k)); hid.classList.toggle('on', !S().hiddenApps.includes(k)); };
            detail.append(h('h2', { class: 'st-sub' }, T(a.name)),
              group(row(T('Version'), h('span', { class: 'st-val' }, rec ? rec.version : PatOS.version), rec ? T('By') + ' ' + rec.author : T('Comes with PatOS')),
                row(T('Kind'), h('span', { class: 'st-val' }, rec ? (rec.source === 'store' ? T('From the App Store (reviewed)') : T('Opened from a file (not reviewed)')) : T('Built into PatOS'))),
                rec ? row(T('Storage it uses'), h('span', { class: 'st-val' }, fmtBytes(data))) : null,
                row(T('Notifications'), mute, T('When off, its notifications are kept in Notification Center but make no banner or sound.')),
                row(T('Show in Launchpad'), hid),
                row(T('Open'), h('button', { class: 'btn', onclick: () => PatOS.launch(k) }, T('Open')))),
              rec ? h('h3', {}, T('Permissions')) : null,
              rec ? group(...(rec.permissions.length ? rec.permissions.map((perm) => { const g = (PA.grants ? PA.grants(rec.id) : {})[perm]; return row(perm, h('span', { class: 'st-val' }, g === 'allow' ? T('Allowed') : g === 'deny' ? T('Denied') : T('Asks first'))); }) : [row(T('This app asked for no permissions.'), h('span'))])) : null,
              errs.length ? h('h3', {}, T('Recent problems')) : null,
              errs.length ? group(...errs.map((e) => row(e.msg, h('small', { class: 'st-val' }, when(e.t)), e.where))) : null,
              rec ? group(row(T('Uninstall'), h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Uninstall') + ' ' + rec.name + '?', T('The app and the data it saved are removed from this device. Files it saved in Documents › Apps stay.'), { ok: T('Uninstall'), danger: true, icon: 'settings' })) { await PA.uninstall(rec.id); detail.innerHTML = ''; draw(); } } }, T('Uninstall…')))) : null);
            detail.scrollIntoView({ block: 'nearest' });
          }
          q.addEventListener('input', draw); draw();
          out.append(h('p', { class: 'st-desc' }, T('Every app on this device: its version, what it may do, what it keeps, and its notifications. Community apps can be uninstalled here.')), q, listEl, detail,
            group(row(T('Get more apps'), h('button', { class: 'btn', onclick: () => PatOS.launch('appstore') }, T('App Store'))), row(T('Make your own'), h('button', { class: 'btn', onclick: () => PatOS.launch('developer') }, T('Developer Center')))));
          return [out];
        },
        /* ---------- Notifications ---------- */
        notifications() {
          const out = h('div'); const hist = h('div', { class: 'st-group' });
          const dnd = h('button', { class: 'switch' + (PatOS.focusMode ? ' on' : ''), role: 'switch', 'aria-checked': String(!!PatOS.focusMode), 'aria-label': T('Do Not Disturb') });
          dnd.onclick = () => { PatOS.focusMode = !PatOS.focusMode; PatOS.emit('focus', PatOS.focusMode); dnd.classList.toggle('on', PatOS.focusMode); dnd.setAttribute('aria-checked', String(PatOS.focusMode)); };
          const drawHist = () => { hist.innerHTML = ''; const l = PatOS.notifications ? PatOS.notifications.list() : []; if (!l.length) hist.appendChild(h('div', { class: 'bk-empty' }, T('No notifications yet.'))); l.slice(0, 15).forEach((n) => hist.appendChild(row(n.title, h('small', { class: 'st-val' }, when(n.time)), PatOS.apps[n.icon] ? T(PatOS.apps[n.icon].name) : 'PatOS'))); };
          drawHist();
          const muted = (S().mutedApps || []).filter((k) => PatOS.apps[k]);
          out.append(group(row(T('Do Not Disturb'), dnd, T('Banners and sounds stay quiet; notifications still go to Notification Center.')),
            row(T('Notification sounds'), toggle('notifSound'), T('A short sound with each banner.')),
            row(T('Notifications in other tabs'), toggle('systemNotifications'), T('When PatOS is in a background tab, your browser shows the notification (if you allowed it).'))),
            h('h3', {}, T('Apps you silenced')), group(...(muted.length ? muted.map((k) => row(T(PatOS.apps[k].name), h('button', { class: 'btn', onclick: () => { PatOS.setSetting('mutedApps', (S().mutedApps || []).filter((x) => x !== k)); renderMain(); } }, T('Turn On')))) : [h('div', { class: 'bk-empty' }, T('None. Silence an app in Settings › Applications.'))])),
            h('h3', {}, T('History')), hist, group(row(T('Clear the history'), h('button', { class: 'btn', onclick: () => { PatOS.notifications && PatOS.notifications.clear(); drawHist(); } }, T('Clear')))));
          return [out];
        },
        /* ---------- PatOS Intelligence ---------- */
        intelligence() {
          const I = PatOS.intel; const out = h('div');
          out.appendChild(h('p', { class: 'st-desc' }, T('PatOS Intelligence does what you ask in Pat, Spotlight and Shortcuts. It is not an AI: it knows a fixed list of actions, says exactly what it did, runs on this device and works offline.')));
          out.appendChild(h('h3', {}, T('What it may do')));
          out.appendChild(group(...I.perms().map((p) => { const t = h('button', { class: 'switch' + (p.on ? ' on' : ''), role: 'switch', 'aria-checked': String(p.on), 'aria-label': p.label }); t.onclick = () => { I.setPerm(p.key, !t.classList.contains('on')); t.classList.toggle('on'); t.setAttribute('aria-checked', String(t.classList.contains('on'))); }; return row(p.label, t); })));
          out.appendChild(h('h3', {}, T('Code')));
          { const t = h('button', { class: 'switch' + (S().codeSuggestions !== false ? ' on' : ''), role: 'switch', 'data-key': 'codeSuggestions', 'aria-checked': String(S().codeSuggestions !== false), 'aria-label': T('Code suggestions') }); t.onclick = () => { PatOS.setSetting('codeSuggestions', S().codeSuggestions === false); t.classList.toggle('on', S().codeSuggestions !== false); t.setAttribute('aria-checked', String(S().codeSuggestions !== false)); };
            out.appendChild(group(row(T('Code suggestions'), t, T('In PitCode Studio, Pat suggests the rest of what you type in PitCode, HTML, CSS and JavaScript, and closes your tags. Tab takes a suggestion, Ctrl+Space asks for one.')))); }
          // workspaces: several actions at once ("start my study workspace")
          out.appendChild(h('h3', {}, T('Workspaces')));
          const wsBox = h('div'); const drawWs = () => { wsBox.innerHTML = ''; I.workspaces().forEach((w, i) => {
            const steps = h('textarea', { class: 'field st-ws-steps', rows: Math.max(2, w.steps.length), 'aria-label': T('Steps, one per line') }); steps.value = w.steps.join('\n');
            const name = h('input', { class: 'field', value: T(w.name), 'aria-label': T('Name') });
            const save = () => { const all = I.workspaces().map((x) => Object.assign({}, x)); all[i] = Object.assign({}, w, { name: name.value.trim() || w.name, words: [fold(name.value.trim() || w.name)].concat(w.words || []), steps: steps.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12) }); I.setWorkspaces(all); };
            steps.onchange = save; name.onchange = save;
            const test = h('small', { class: 'st-ws-check' }); const check = () => { const bad = steps.value.split('\n').map((x) => x.trim()).filter(Boolean).filter((x) => !I.parse(x)); test.textContent = bad.length ? '✗ ' + T('Not understood:') + ' ' + bad.join(', ') : '✓ ' + T('Every step is understood.'); test.className = 'st-ws-check ' + (bad.length ? 'bad' : 'ok'); };
            steps.addEventListener('input', check); check();
            wsBox.appendChild(h('div', { class: 'st-group st-ws' }, row(T('Name'), name), h('div', { class: 'st-row st-col' }, h('span', {}, T('Steps, one per line (anything you could ask Pat)')), steps, test),
              h('div', { class: 'st-row' }, h('small', {}, T('Say') + ' “' + T('start my') + ' ' + fold(T(w.name)) + ' ' + T('workspace') + '”'), h('div', { class: 'su-btns' }, h('button', { class: 'btn', onclick: () => { const r = I.runWorkspace(w.name); PatOS.alertBox(T(w.name), r.message, { icon: 'settings' }); } }, T('Start')), h('button', { class: 'btn', onclick: () => { const all = I.workspaces().filter((_, j) => j !== i); I.setWorkspaces(all.length ? all : []); drawWs(); } }, T('Remove'))))));
          }); };
          drawWs();
          out.append(wsBox, group(row(T('New workspace'), h('button', { class: 'btn', onclick: () => { I.setWorkspaces(I.workspaces().concat([{ id: 'w' + Date.now().toString(36), name: T('My workspace'), words: [], steps: ['open notes'] }])); drawWs(); } }, T('Add')))));
          // phrases you taught ("when I say …, …")
          out.appendChild(h('h3', {}, T('Phrases you taught')));
          const ph = S().intelPhrases || [];
          out.appendChild(group(...(ph.length ? ph.map((x) => row('“' + x.phrase + '”', h('button', { class: 'btn', onclick: () => { PatOS.setSetting('intelPhrases', (S().intelPhrases || []).filter((y) => y.phrase !== x.phrase)); renderMain(); } }, T('Remove')), '→ ' + x.command)) : [h('div', { class: 'bk-empty' }, T('None yet. Tell Pat: “when I say homework time, start my study workspace”.'))])));
          // what it understands
          out.appendChild(h('h3', {}, T('What you can ask')));
          const acts = I.list().filter((a) => a.examples.length);
          out.appendChild(group(...acts.map((a) => row(T(a.title), h('span'), a.examples.slice(0, 2).map((x) => '“' + x + '”').join('  ·  ') + (a.confirm ? '  ·  ' + T('asks first') : '') + (a.undo ? '' : '')))));
          // what it did
          out.appendChild(h('h3', {}, T('Recent actions')));
          const hist = I.history().slice(-12).reverse();
          out.appendChild(group(...(hist.length ? hist.map((x) => row((x.ok ? '✓ ' : x.status === 'denied' ? '⊘ ' : '✗ ') + T(x.title), h('small', { class: 'st-val' }, when(x.t)), x.message)) : [h('div', { class: 'bk-empty' }, T('Nothing yet. Ask Pat something.'))]),
            row(T('Clear this list'), h('button', { class: 'btn', onclick: () => { I.clearHistory(); renderMain(); } }, T('Clear')), T('Kept on this device only.'))));
          out.appendChild(group(row(T('Shortcuts'), h('button', { class: 'btn', onclick: () => PatOS.launch('shortcuts') }, T('Open Shortcuts')), T('A shortcut step can be any command (“Do a command”).'))));
          return [out];
        },
        /* ---------- Diagnostics: measured facts only, and safe checks ---------- */
        diagnostics() {
          const out = h('div'); const res = h('div');
          const L = PatOS.fs.integrity ? PatOS.fs.integrity.load() : { state: 'ok', problems: [] };
          const errs = PatOS.errors.list(); const sev = (s) => errs.filter((e) => e.sev === s).length;
          const sync = PatOS.sync && PatOS.sync.status ? PatOS.sync.status() : null; const acct = PatOS.account ? PatOS.account.status() : null;
          const bk = PatOS.backup ? PatOS.backup.list() : []; const lastSnap = bk[0];
          const health = [
            [T('Your files'), L.state === 'ok' ? badge('ok', T('Healthy at start-up')) : L.state === 'mended' ? badge('warn', T('Mended at start-up')) : badge('bad', T('Problem at start-up')), L.problems.length ? L.problems.length + ' ' + T('problems were found and written down') : ''],
            [T('Snapshots'), lastSnap ? badge('ok', when(lastSnap.t)) : badge('warn', T('None yet')), lastSnap ? bk.length + ' ' + T('on this device') : T('Settings › Backup & Restore makes one')],
            [T('Sync'), !sync || !sync.on ? badge('off', T('Off')) : sync.error ? badge('bad', T('Problem')) : badge('ok', T('Working')), sync && sync.error ? String(sync.error) : ''],
            [T('Account (Firebase)'), !acct || !acct.signedIn ? badge('off', T('Not signed in')) : acct.state === 'ok' ? badge('ok', T('Connected')) : badge('warn', T(acct.state === 'offline' ? 'Offline' : 'Sign in again')), ''],
            [T('Internet'), navigator.onLine === false ? badge('off', T('Offline')) : badge('ok', T('Online')), T('As the browser reports it')],
            [T('Problems written down'), errs.length ? badge(sev('critical') ? 'bad' : sev('error') ? 'warn' : 'ok', String(errs.length)) : badge('ok', '0'), sev('critical') + ' ' + T('critical') + ' · ' + sev('error') + ' ' + T('errors') + ' · ' + sev('warning') + ' ' + T('warnings')]
          ];
          out.append(h('p', { class: 'st-desc' }, T('What PatOS can measure from inside the browser. Things a browser can’t see (the battery’s health, the processor’s temperature…) are not shown, and estimates say so.')),
            h('h3', {}, T('System health')), group(...health.map(([l, b, s2]) => row(l, b, s2))));
          // resources: measured or estimated, and labeled
          const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB ' + T('(measured: this page’s JavaScript)') : T('Not available in this browser');
          const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
          const st = h('span', { class: 'st-val' }, '…'); if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => { st.textContent = fmtBytes(e.usage || 0) + ' / ' + fmtBytes(e.quota || 0) + ' ' + T('(estimated by the browser)'); }, () => { st.textContent = T('Not available'); }); else st.textContent = T('Not available');
          out.append(h('h3', {}, T('Resources')), group(row(T('Memory used by PatOS'), h('span', { class: 'st-val' }, mem)), row(T('Storage used'), st), row(T('Start-up'), h('span', { class: 'st-val' }, nav ? Math.round(nav.domContentLoadedEventEnd) + ' ms ' + T('(measured)') : T('Not available'))), row(T('Processor cores'), h('span', { class: 'st-val' }, navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) + ' ' + T('(reported by the browser)') : T('Not available')))));
          // checks
          const btn = (label, fn) => h('button', { class: 'btn', onclick: async (e) => { const b = e.currentTarget; b.disabled = true; res.innerHTML = ''; try { await fn(); } catch (x) { res.appendChild(group(row(T('That didn’t work'), h('span'), String(x.message || x)))); } b.disabled = false; } }, label);
          out.append(h('h3', {}, T('Checks')), group(
            row(T('Check your files'), btn(T('Check'), async () => { const c = await PatOS.fs.integrity.check(); res.appendChild(group(row(c.ok ? '✓ ' + T('No problems found') : '✗ ' + c.problems.length + ' ' + T('problems found'), h('span', { class: 'st-val' }, c.ms + ' ms'), c.files + ' ' + T('files') + ', ' + c.dirs + ' ' + T('folders') + ', ' + c.bigFiles + ' ' + T('big files')), ...c.problems.slice(0, 10).map((p) => row(p.path, h('span'), T(p.what))))); }), T('Reads everything and changes nothing.')),
            row(T('Verify snapshots'), btn(T('Verify'), async () => { const v = await PatOS.backup.verifyAll(); res.appendChild(group(...(v.length ? v.map((x) => row(x.label || T('Snapshot'), badge(x.state === 'ok' ? 'ok' : x.state === 'unverified' ? 'warn' : 'bad', T(x.state === 'ok' ? 'Whole' : x.state === 'unverified' ? 'Unverified (older)' : 'Damaged')), when(x.t))) : [row(T('No snapshots yet.'), h('span'))]))); })),
            row(T('Check Sync'), btn(T('Check'), async () => { if (!PatOS.sync || !PatOS.sync.status().on) { res.appendChild(group(row(T('Sync is off.'), h('span')))); return; } await PatOS.sync.now(); const s2 = PatOS.sync.status(); res.appendChild(group(row(s2.error ? '✗ ' + s2.error : '✓ ' + T('Sync is working'), h('span', { class: 'st-val' }, (s2.items || 0) + ' ' + T('items'))))); })),
            row(T('Recent problems'), btn(T('Show'), async () => { const l = PatOS.errors.list().slice(-15).reverse(); res.appendChild(group(...(l.length ? l.map((e) => row(e.msg, h('small', { class: 'st-val' }, (e.sev || 'error') + ' · ' + when(e.t)), (e.cat || '') + (e.where ? ' · ' + e.where : '') + (e.recovered === true ? ' · ' + T('recovered') : ''))) : [row(T('No problems written down.'), h('span'))]))); }))),
            res);
          // the report: reviewed before it leaves
          out.append(h('h3', {}, T('Diagnostic report')), group(row(T('Make a report'), h('button', { class: 'btn', onclick: async () => { const r = await PatOS.diagnostics.report(); PatOS.diagnostics.review(r); } }, T('Make Report…')), T('You see everything in it before copying or saving it. It never contains passwords, keys, sign-in tokens, messages or your files.'))));
          return [out];
        },
        general() {
          const name = h('input', { class: 'field', value: S().userName, style: { width: '180px' } });
          name.onchange = () => PatOS.setSetting('userName', name.value.trim() || 'Pat');
          return [h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('about') }), h('div', {}, h('h2', {}, 'PatOS ' + (PatOS.versionNow ? PatOS.versionNow() : PatOS.version)))),
            group(row('Your name', name), row('Language', (() => { const s2 = h('select', { class: 'field' }, ...[['auto', 'Automatic (device language)'], ['en', 'English'], ['fr', 'French']].map(([v, l]) => h('option', { value: v, selected: (S().language || 'auto') === v }, l))); s2.onchange = async () => { const v = s2.value; if (await PatOS.confirmBox(PatOS.t('Language'), PatOS.t('PatOS restarts to change the language.'), { ok: PatOS.t('Restart'), icon: 'settings' })) { PatOS.setSetting('language', v); setTimeout(() => (PatOS._leaving = true, location.reload()), 200); } else s2.value = S().language || 'auto'; }; return s2; })(), PatOS.lang === 'fr' ? 'Langue de l’appareil : ' + (PatOS.deviceLang === 'fr' ? 'français' : 'anglais') : 'Device language: ' + (PatOS.deviceLang === 'fr' ? 'French' : 'English')), row('Layout', select('deviceMode', [['auto', 'Automatic (phone or computer)'], ['desktop', 'Computer'], ['mobile', 'Phone']]), ''), row('Ask for full screen at login', toggle('askFullscreen'), ''), row(T('Reopen windows when PatOS starts'), toggle('reopenWindows'), ''), row('24-hour clock', toggle('clock24')), row('Show seconds in menu bar', toggle('showSeconds'))),
            group(row('About this computer', h('button', { class: 'btn', onclick: () => PatOS.launch('about') }, 'About PatOS…')))];
        },
        update() {
          const out = h('div', { class: 'su' });
          const U = PatOS.update;
          const lang = PatOS.lang === 'fr' ? 'fr' : 'en';
          const rt = (r, k) => (r && r[k] ? (typeof r[k] === 'string' ? r[k] : r[k][lang] || r[k].en) : '');
          const label = PatOS.versionLabel || ((r) => 'PatOS ' + (r ? r.version : PatOS.version));
          const fmtDate = (d) => { try { return new Date(d + 'T12:00').toLocaleDateString(PatOS.lang === 'fr' ? 'fr-CA' : undefined, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return d; } };
          const notesOf = (r) => h('ul', { class: 'su-notes' }, ...((r && r.notes && (r.notes[lang] || r.notes.en)) || []).map((n) => h('li', {}, n)));
          const badge = (r) => (r && r.beta ? h('span', { class: 'su-beta' }, T('Beta')) : null);
          const paint = () => {
            out.innerHTML = '';
            const st = U ? U.state : 'none';
            const cur = U ? U.current : (PatOS.releases && PatOS.releases[0]) || { version: PatOS.version };
            const tgt = U && U.target, newer = U && U.newer;
            const status = { idle: '', checking: T('Checking for updates…'), downloading: T('Downloading') + ' ' + label(tgt) + '…', ready: T('A new version is ready to install.'), uptodate: T('PatOS is up to date.'), offline: T('You’re offline. PatOS checks again when the internet is back.'), none: T('Updates come with the PatOS website. This copy of PatOS is a single file.') }[st];
            out.append(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('about') }), h('div', {}, h('h2', {}, label(cur), ' ', badge(cur)), h('p', { class: 'su-status' + (st === 'ready' ? ' ready' : '') }, status))));
            if (st === 'ready' && tgt && newer) {
              out.appendChild(h('div', { class: 'su-card' },
                h('div', { class: 'su-chead' }, h('b', {}, label(tgt), ' ', badge(tgt)), tgt.date ? h('small', {}, fmtDate(tgt.date)) : null),
                rt(tgt, 'title') ? h('div', { class: 'su-title' }, rt(tgt, 'title')) : null, notesOf(tgt),
                tgt.beta ? h('p', { class: 'su-small' }, '') : null,
                h('p', { class: 'su-small' }, ''),
                h('div', { class: 'su-btns' }, h('button', { class: 'btn primary', onclick: () => U.restart() }, T('Restart PatOS to Update')))));
            } else if (U) {
              out.appendChild(group(row(T('Check for updates'), h('button', { class: 'btn', disabled: st === 'checking' || st === 'downloading', onclick: () => U.check(true) }, T(st === 'checking' ? 'Checking…' : 'Check Now')), '')));
            }
            // the beta switch
            if (U) {
              const sw = h('button', { class: 'switch' + (U.betaOn() ? ' on' : ''), role: 'switch', 'aria-checked': String(U.betaOn()), 'aria-label': T('Beta updates') });
              sw.onclick = () => { U.setBeta(!U.betaOn()); paint(); };
              const nb = U.newestBeta;
              out.appendChild(group(row(T('Beta updates'), sw, U.betaOn() && nb ? T('Now testing:') + ' ' + label(nb) : '')));
            }
            // the PatOS account (the system account) can release the beta being built as a finished version
            if (PatOS.account && PatOS.account.isSystem()) out.appendChild(releaseCard());
            // what's in the version you have, and the ones before
            if (cur && cur.notes) out.append(h('h3', {}, T('What’s new in') + ' ' + label(cur)), h('div', { class: 'su-card' }, h('div', { class: 'su-chead' }, h('b', {}, rt(cur, 'title'), ' ', badge(cur)), cur.date ? h('small', {}, fmtDate(cur.date)) : null), notesOf(cur)));
            const list = ((U && U.releases && U.releases.length ? U.releases : PatOS.releases) || []).filter((x) => idOf(x) !== idOf(cur) && !(newer && tgt && idOf(x) === idOf(tgt)));
            // (older versions' notes load only now: js/release-notes.js, kept out of start-up)
            if (list.some((r) => r.more && !r.notes) && !PatOS.releaseNotes && !win._notesAsked) { win._notesAsked = true; const sc = document.createElement('script'); sc.src = 'js/release-notes.js'; sc.onload = () => { if (pane === 'update') renderMain(); }; document.head.appendChild(sc); }
            if (list.length) {
              out.appendChild(h('h3', {}, T('Update history')));
              out.appendChild(h('div', { class: 'su-history' }, ...list.map((r) => h('details', { class: 'su-old' }, h('summary', {}, h('b', {}, label(r)), h('span', {}, rt(r, 'title')), h('small', {}, fmtDate(r.date))), notesOf(r)))));
            }
            out.appendChild(group(row(T('Something wrong after an update?'), h('button', { class: 'btn', onclick: () => { pane = 'system'; renderMain(); drawSide(); } }, T('Go Back to the Previous Version…')))));
          };
          const idOf = (r) => (r ? r.version + (r.beta ? 'b' + r.beta : '') : '');
          function releaseCard() {
            const box = h('div', { class: 'su-card su-release' }, h('div', { class: 'su-chead' }, h('b', {}, T('Release a Version')), PatOS.systemBadge(16)), h('p', { class: 'su-small' }, T('Checking…')));
            (async () => {
              let beta = null, ready = false;
              try { beta = await (await fetch('/api/updates/beta', { cache: 'no-store' })).json(); ready = (await (await fetch('/api/admin/status', { cache: 'no-store' })).json()).release; } catch (e) {}
              const p = box.querySelector('.su-small');
              if (!beta) { p.textContent = T('There is no beta being built right now.'); return; }
              p.textContent = T('Make') + ' ' + beta.version + ' ' + T('beta') + ' ' + beta.beta + ' ' + T('the finished version: everyone gets “Update available”, not only people with Beta updates on.') + (ready ? '' : ' ' + T('(The server isn’t set up for this yet: GITHUB_TOKEN, see docs/SYSTEM-ACCOUNT.md.)'));
              const go = h('button', { class: 'btn primary', disabled: !ready }, T('Release') + ' PatOS ' + beta.version);
              go.onclick = async () => {
                const pw = await PatOS.ask(T('Release') + ' PatOS ' + beta.version + '?', '', { password: true, icon: 'about', ok: T('Release'), text: T('Enter the PatOS account’s password to confirm.') });
                if (pw == null) return; go.disabled = true; go.textContent = T('Releasing…');
                try {
                  const tok = await PatOS.account.freshToken(pw);
                  const r = await fetch('/api/admin/release', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ version: beta.version, beta: beta.beta }) });
                  const j = await r.json().catch(() => ({}));
                  if (!r.ok) throw new Error(j.error || r.status);
                  p.textContent = T('Released. The server is installing it now (usually a few minutes), then everyone is told about') + ' PatOS ' + beta.version + '.'; go.remove();
                } catch (e) { go.disabled = false; go.textContent = T('Release') + ' PatOS ' + beta.version; PatOS.alertBox(T('That didn’t work'), String(e.message || e), { icon: 'about' }); }
              };
              box.appendChild(h('div', { class: 'su-btns' }, go));
            })();
            return box;
          }
          if (U) { const on = () => { if (pane === 'update' && out.isConnected) paint(); }; const off = PatOS.on('update', on); win.on('closed', off); U.fetchReleases().then(on); if (U.state === 'idle' || U.state === 'uptodate') U.check(false); }
          paint(); return [out];
        },
        backup() {
          const out = h('div', { class: 'bk' }); const B = PatOS.backup;
          const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'settings' });
          const sizeOf = (b) => PatOS.fmtBytes(b);
          const spin = (btn, fn) => async () => { if (btn) btn.disabled = true; try { await fn(); } catch (e) { if (e && e.name !== 'AbortError') msg(T('That didn’t work'), String(e.message || e)); } finally { if (btn) btn.disabled = false; } };
          const restore = (title, run) => B.ui.confirmRestore(title, run), fromFile = (f) => B.ui.fromFile(f), pickFile = () => B.ui.pickFile();
          function exportDialog() {
            const c = B.count(PatOS.fs.exportTree());
            const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
            const big = h('input', { type: 'checkbox', checked: c.blobFiles > 0 && c.blobBytes < 150 * 1048576 }); big.disabled = !c.blobFiles;
            const p1 = h('input', { class: 'field', type: 'password', placeholder: T('Password (optional)'), autocomplete: 'new-password', 'aria-label': T('Password') }), p2 = h('input', { class: 'field', type: 'password', placeholder: T('Type it again'), autocomplete: 'new-password', 'aria-label': T('Password again') });
            const note = h('div', { class: 'bk-note' });
            const go = h('button', { class: 'btn primary' }, T('Export'));
            go.onclick = async () => {
              if (p1.value && p1.value !== p2.value) { note.textContent = T('The two passwords are different.'); return; }
              if (p1.value && p1.value.length < 6) { note.textContent = T('Use at least 6 characters.'); return; }
              go.disabled = true; note.textContent = T('Making the backup…');
              try { const f = await B.exportFile({ blobs: big.checked, password: p1.value || null }); const how = await B.saveFile(f); close(); if (how !== 'cancelled') PatOS.notify({ title: T('Backup file ready'), body: f.name + ' · ' + sizeOf(f.blob.size) + (f.stats.bigSkipped ? ' · ' + f.stats.bigSkipped + ' ' + T('big files left out') : ''), icon: 'settings', duration: 8000 }); }
              catch (e) { go.disabled = false; note.textContent = String(e.message || e); }
            };
            layer.appendChild(h('div', { class: 'dlg ce bk-dlg' }, h('b', {}, T('Export a backup file')), h('p', { class: 'bk-note' }, '' + ' ' + c.files + ' ' + T('files') + ', ' + sizeOf(c.bytes + c.blobBytes) + '.'),
              c.blobFiles ? h('label', { class: 'ce-row' }, h('span', {}, T('Include big files') + ' (' + c.blobFiles + ', ' + sizeOf(c.blobBytes) + ')'), big) : null,
              h('p', { class: 'bk-note' }, ''), p1, p2, note,
              h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), go)));
            layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); }); layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
            document.body.appendChild(layer); setTimeout(() => p1.focus(), 30);
          }
          const folderBackups = (btn) => B.ui.folderMenu(null, btn);
          const paint = async () => {
            const [persisted, fst] = await Promise.all([B.persist.status(), B.folder.status()]);
            const snaps = B.list(); const inf = B.info();
            out.innerHTML = '';
            out.append(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('settings') }), h('div', {}, h('h2', {}, T('Your data is yours')), h('p', { class: 'su-status' }, ''))));
            const vaultWarn = PatOS.passwords && PatOS.passwords.deviceOnly && PatOS.passwords.all().length;
            if (vaultWarn) out.appendChild(h('div', { class: 'pw-warn bk-warn' }, h('span', {}, T('Your saved passwords are locked with a key that never leaves this device, so a backup can’t open them on another device or after PatOS is erased. Add a master password in Passwords to include them safely.')), h('button', { class: 'btn', onclick: () => PatOS.launch('passwords') }, T('Open Passwords'))));
            out.appendChild(group(row(T('Kept safe by the browser'), persisted ? h('span', { class: 'st-val' }, T('Yes')) : h('button', { class: 'btn', onclick: spin(null, async () => { await B.persist.request(); paint(); }) }, T('Ask')), persisted ? '' : '')));
            // snapshots
            const now = h('button', { class: 'btn' }, T('Back Up Now')); now.onclick = spin(now, async () => { await B.snapshot(T('Snapshot'), 'manual'); toast(T('Snapshot saved')); paint(); });
            const auto = h('button', { class: 'switch' + (B.autoOn() ? ' on' : ''), role: 'switch', 'aria-checked': String(B.autoOn()), 'aria-label': T('Daily snapshot') }); auto.onclick = () => { B.setAuto(!B.autoOn()); paint(); };
            out.append(h('h3', {}, T('Snapshots')), group(row(T('Take a snapshot every day'), auto, ''), row(T('Snapshot now'), now)));
            if (snaps.length) out.appendChild(h('div', { class: 'bk-list' }, ...snaps.map((x) => {
              const b = h('button', { class: 'btn' }, T('Restore')); b.onclick = spin(b, () => restore(T('Restore PatOS to') + ' ' + B.when(x.t) + '?', () => B.restoreSnapshot(x.key)));
              const del = x.kind === 'auto' ? null : h('button', { class: 'tbtn', title: T('Delete'), 'aria-label': T('Delete'), onclick: async () => { await B.removeSnapshot(x.key); paint(); } }, '×');
              return h('div', { class: 'bk-snap' }, h('div', {}, h('b', {}, B.when(x.t)), h('small', {}, T(x.kind === 'auto' ? 'Daily snapshot' : x.kind === 'before' ? 'Before restoring' : 'Snapshot') + ' · ' + x.files + ' ' + T('files') + ' · ' + sizeOf(x.bytes))), h('div', { class: 'bk-acts' }, b, del));
            })));
            else out.appendChild(h('div', { class: 'bk-empty' }, ''));
            // backup file
            const ex = h('button', { class: 'btn', onclick: exportDialog }, T('Export…')), im = h('button', { class: 'btn' }, T('Import…')); im.onclick = spin(im, pickFile);
            out.append(h('h3', {}, T('Backup file')), group(row(T('Save everything to a file'), ex, PatOS.hw && PatOS.hw.ios ? '' : ''), row(T('Restore from a file'), im, '')));
            // the folder
            out.appendChild(h('h3', {}, T('Auto-backup folder')));
            if (!fst.supported) out.appendChild(h('div', { class: 'bk-empty' }, T('Folders need Chrome on a computer or Chromebook. On an iPhone, use Export and save the file to Files.')));
            else if (!fst.linked) {
              const ch = h('button', { class: 'btn primary' }, T('Choose Folder…')); ch.onclick = spin(ch, async () => { await B.folder.link(); toast(T('Backup folder set')); paint(); });
              out.appendChild(group(row(T('Back up to a folder'), ch, '')));
              out.appendChild(h('div', { class: 'bk-empty' }, ''));
            } else {
              const allow = fst.permission !== 'granted' ? h('button', { class: 'btn primary' }, T('Allow')) : null; if (allow) allow.onclick = spin(allow, async () => { await B.folder.writeNow(true); paint(); });
              const bn = h('button', { class: 'btn' }, T('Back Up Now')); bn.onclick = spin(bn, async () => { const r = await B.folder.writeNow(true); if (!r.ok) throw new Error(r.why === 'permission' ? T('Allow PatOS to save in the folder first.') : r.why); toast(T('Backup saved')); paint(); });
              const rs = h('button', { class: 'btn' }, T('Restore…')); rs.onclick = spin(rs, () => folderBackups(rs));
              const stop = h('button', { class: 'btn', onclick: async () => { await B.folder.unlink(); paint(); } }, T('Stop'));
              out.appendChild(group(row(fst.name, h('div', { class: 'bk-acts' }, allow, bn, rs, stop), fst.permission !== 'granted' ? T('The browser needs a click to let PatOS save here again.') : (fst.last ? T('Last saved') + ' ' + B.when(fst.last) : T('Not saved yet')))));
            }
          };
          const on = () => { if (pane === 'backup' && out.isConnected) paint(); }; const off = PatOS.on('backup', on); win.on('closed', off);
          paint(); return [out];
        },
        account() {
          const out = h('div', { class: 'bk ac' }); const A = PatOS.account;
          const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'settings' });
          const paint = () => {
            out.innerHTML = '';
            out.appendChild(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('settings') }), h('div', {}, h('h2', {}, T('PatOS Account')), h('p', { class: 'su-status' }, ''))));
            if (!A || !A.available()) { out.appendChild(h('div', { class: 'bk-empty' }, T('Accounts need PatOS opened from its web address (https) in a browser that can do encryption.'))); return; }
            if (!A.signedIn()) {
              out.appendChild(group(row(T('Create an account'), h('button', { class: 'btn primary', onclick: () => PatOS.accountUI.open('signup') }, T('Create Account…')), ''), row(T('Already have one?'), h('button', { class: 'btn', onclick: () => PatOS.accountUI.open('signin') }, T('Sign In…')), '')));
              out.appendChild(h('div', { class: 'bk-empty' }, T('There is no “forgot my password”: your saved things are locked with your password, so nobody can open them without it.'))); return;
            }
            const st = PatOS.sync.status(); const i = A.info();
            const label = A.status().state === 'reauth' ? T('Your sign-in expired. Sign in again to keep saving.') : st.state === 'syncing' ? T('Saving…') : st.state === 'offline' || st.offline ? T('Offline. Your changes are safe here and are saved when you are back online.') : st.error ? T('Saving had a problem. PatOS will try again.') : st.last ? T('Everything is saved') + ' · ' + (PatOS.backup ? PatOS.backup.when(st.last) : '') : T('Not saved yet');
            const now = h('button', { class: 'btn' }, T('Save Now')); now.onclick = async () => { now.disabled = true; try { await PatOS.sync.now(); } finally { now.disabled = false; } };
            out.appendChild(group(row(T('Signed in as'), h('span', { class: 'st-val' }, A.display(i.uid, i.username), A.isSystem() ? PatOS.systemBadge(14) : null)), row(T('Status'), now, label), row(T('Saved in your account'), h('span', { class: 'st-val' }, st.items + ' ' + T('items')), st.stay ? st.stay + ' ' + T('big files (videos and recordings) stay on this device only.') : '')));
            // the PatOS account: the system account once its id is in config/system (Firebase console). Until then, how.
            if (A.isSystem()) out.appendChild(h('div', { class: 'su-card su-release' }, h('div', { class: 'su-chead' }, h('b', {}, T('PatOS system account')), PatOS.systemBadge(16)), h('p', { class: 'su-small' }, T('This account is PatOS. It has every account in Messages, its messages need no request and can’t be declined, it can ban and unban accounts (Messages), and it can release a beta as a finished version (Software Update).'))));
            else if (i.username === 'patos') {
              const copy = h('button', { class: 'btn', onclick: () => { try { navigator.clipboard.writeText(i.uid); copy.textContent = T('Copied'); } catch (e) {} } }, T('Copy'));
              out.appendChild(h('div', { class: 'su-card su-release' }, h('div', { class: 'su-chead' }, h('b', {}, T('Make this the PatOS system account')), PatOS.systemBadge(16)),
                h('p', { class: 'su-small' }, T('One step, in the Firebase console (so nobody else can ever do it): Firestore Database › Start collection “config” › Document ID “system” › field “uid” (string) with this value:')),
                h('div', { class: 'su-btns' }, h('code', { class: 'st-val', style: { userSelect: 'all', wordBreak: 'break-all' } }, i.uid), copy),
                h('p', { class: 'su-small' }, T('Then restart PatOS. docs/SYSTEM-ACCOUNT.md explains it.'))));
            }
            if (A.status().state === 'reauth') out.appendChild(group(row(T('Sign in again'), h('button', { class: 'btn primary', onclick: () => PatOS.accountUI.open('signin') }, T('Sign In…')))));
            out.appendChild(h('h3', {}, T('Sign out')));
            const so = h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox(T('Sign out?'), T('Everything stays on this device. PatOS stops saving to your account until you sign in again.'), { ok: T('Sign Out'), icon: 'settings' })) { await A.signOut(); paint(); } } }, T('Sign Out…'));
            const del = h('button', { class: 'btn danger', onclick: async () => {
              const pw = await PatOS.ask(T('Delete your account?'), '', { password: true, ok: T('Delete Account'), danger: true, icon: 'settings', text: T('This deletes your username and everything saved in your account (not what is on this device). Messages you sent stay in your friends’ chats. Type your password to confirm.') });
              if (!pw) return; try { await A.deleteAccount(pw); paint(); msg(T('Account deleted'), T('Your account and its saved copy are gone. Everything is still on this device.')); } catch (e) { msg(T('That didn’t work'), String(e.message || e)); } } }, T('Delete Account…'));
            out.appendChild(group(row(T('Stop using this account on this device'), so), row(T('Delete this account'), del, '')));
          };
          const on = () => { if (pane === 'account' && out.isConnected) paint(); }; const offs = [PatOS.on('account', on), PatOS.on('sync', on)]; win.on('closed', () => offs.forEach((f) => f()));
          paint(); return [out];
        },
        voice() {
          const out = h('div', { class: 'bk vo' }); const V = PatOS.voice;
          const paint = () => {
            out.innerHTML = '';
            out.appendChild(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('messages') }), h('div', {}, h('h2', {}, T('Pat Voice')), h('p', { class: 'su-status' }, T('Say “Hey Pat” and then what you want: “Hey Pat, timer 10 minutes”, “Hey Pat, open Notes”, or the name of one of your Shortcuts.')))));
            if (!V.supported()) { out.appendChild(h('div', { class: 'bk-empty' }, T('This browser cannot listen. Use Chrome or Safari.'))); return; }
            const on = h('button', { class: 'switch' + (V.on() ? ' on' : ''), role: 'switch', 'aria-checked': String(V.on()), 'aria-label': T('Hey Pat') });
            on.onclick = () => { try { V.on() ? V.disable() : V.enable(); } catch (e) { PatOS.alertBox(T('That didn’t work'), String(e.message || e), { icon: 'settings' }); } paint(); };
            const sp = h('button', { class: 'switch' + (V.speaks() ? ' on' : ''), role: 'switch', 'aria-checked': String(V.speaks()), 'aria-label': T('Pat answers out loud') }); sp.onclick = () => { PatOS.store.set('voiceSpeak', !V.speaks()); paint(); };
            out.appendChild(group(row(T('Hey Pat'), on, V.on() ? (V.state().listening ? T('Listening for “Hey Pat” while PatOS is open.') : T('Starting…')) : T('Off. Nothing is listening.')), row(T('Pat answers out loud'), sp, T('Pat also speaks the answer.'))));
            out.appendChild(group(row(T('Try it'), h('button', { class: 'btn', onclick: () => V.speak(T('Hi, I am Pat. Say Hey Pat, and then what you need.')) }, T('Hear Pat')))));
            out.appendChild(h('div', { class: 'bk-empty' }, T('How it works: your browser turns what you say into text. In Chrome, the sound is sent to Google’s speech service to do that. PatOS listens only while this switch is on and PatOS is open, and shows a microphone pill the whole time. Your Shortcuts and the Pat commands do the rest on your device.')));
          };
          const offs = [PatOS.on('voice:state', () => { if (pane === 'voice' && out.isConnected) paint(); })]; win.on('closed', () => offs.forEach((f) => f()));
          paint(); return [out];
        },
        privacy() {
          const out = h('div', { class: 'bk pv' }); const A = PatOS.patapps;
          const paint = () => {
            out.innerHTML = '';
            out.appendChild(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('settings') }), h('div', {}, h('h2', {}, T('Privacy')), h('p', { class: 'su-status' }, T('Apps from the App Store Community run in a locked box. Each one has to ask before it uses your camera, microphone, location, files, clipboard, notifications or the internet. Here you see what each app may do, and what it did.')))));
            // Timeline: what PatOS remembers about what you do (js/timeline.js)
            out.appendChild(h('h3', {}, T('Timeline')));
            const days = h('select', { class: 'field', 'aria-label': T('Keep for'), onchange: (e) => PatOS.setSetting('timelineDays', +e.target.value) },
              ...[7, 30, 90, 365].map((d) => h('option', { value: d, selected: (+S().timelineDays || 30) === d }, d === 365 ? T('1 year') : d + ' ' + T('days'))));
            const tg = (k, lab) => { const t = toggle(k); t.setAttribute('role', 'switch'); t.setAttribute('aria-label', lab); return t; };
            const tlg = group(
              row(T('Timeline'), tg('timeline', T('Timeline')), T('Remembers the apps, files, websites and notes you open, and the windows you had open, so you can find them again. Only on this device, never synced, no screenshots, nothing from Passwords.')),
              row(T('Clipboard History'), tg('timelineClips', T('Clipboard History')), T('Keeps what you copy. Alt+V opens it anywhere and pastes.')),
              row(T('Keep for'), days),
              row(T('Handoff'), tg('handoff', T('Handoff')), T('Your other devices can continue what you are doing here (the app and what is open in it, never its content), and this one can continue theirs. Needs Sync.')),
              row(T('Open Timeline'), h('button', { class: 'btn', onclick: () => PatOS.launch('timeline') }, T('Open')), T('Pause it, forget the last hour, a day or everything from the Timeline app.')));
            tlg.classList.add('pv-tl'); out.appendChild(tlg);
            out.appendChild(h('h3', {}, T('Community apps')));
            const apps = A ? A.list() : [];
            if (!apps.length) out.appendChild(h('div', { class: 'bk-empty' }, T('No community apps are installed. PatOS’s own apps are not listed here.')));
            apps.forEach((r) => {
              const g = A.grants(r.id); const rows = [];
              if (!r.app.permissions.length) rows.push(row(T('Asks for'), h('span', { class: 'st-val' }, T('nothing special'))));
              r.app.permissions.forEach((p) => {
                const st = g[p] || 'ask'; const sw = h('button', { class: 'switch' + (st === 'allow' ? ' on' : ''), role: 'switch', 'aria-checked': String(st === 'allow'), 'aria-label': A.permInfo(p)[0] });
                sw.onclick = () => { A.setGrant(r.id, p, st === 'allow' ? 'deny' : 'allow'); paint(); };
                rows.push(row(A.permInfo(p)[0], h('div', { class: 'st-inline' }, h('span', { class: 'st-val' }, st === 'allow' ? T('Allowed') : st === 'deny' ? T('Not allowed') : T('Will ask')), sw), A.permInfo(p)[1].replace(/^./, (c) => c.toUpperCase()) + '.'));
              });
              rows.push(row(T('Remove this app'), h('button', { class: 'btn', onclick: async () => { if (await A.uninstall(r.id)) paint(); } }, T('Remove…')), r.source === 'store' ? T('Checked by the owner of this PatOS.') : T('Installed from a file. Nobody checked it.')));
              out.appendChild(h('h3', {}, r.app.name + ' ' + r.app.version)); out.appendChild(group(...rows));
            });
            const lg = A ? A.logOf() : [];
            out.appendChild(h('h3', {}, T('Recent activity')));
            if (!lg.length) out.appendChild(h('div', { class: 'bk-empty' }, T('Nothing yet.')));
            else {
              const word = (w) => w === 'used' ? T('used') : w === 'allowed' ? T('was allowed') : w === 'denied' ? T('was denied') : T('was blocked');
              out.appendChild(h('div', { class: 'bk-list pv-log' }, ...lg.slice(0, 40).map((x) => h('div', { class: 'bk-snap' }, h('div', {}, h('b', {}, x.name), h('small', {}, A.permInfo(x.perm)[0] + ' ' + word(x.what))), h('small', {}, PatOS.backup ? PatOS.backup.when(x.t) : new Date(x.t).toLocaleString())))));
              out.appendChild(h('div', { class: 'bk-acts', style: { marginTop: '8px' } }, h('button', { class: 'btn', onclick: () => { A.clearLog(); paint(); } }, T('Clear Activity'))));
            }
          };
          const on = () => { if (pane === 'privacy' && out.isConnected) paint(); }; const off = PatOS.on('patapps', on); win.on('closed', off);
          paint(); return [out];
        },
        sync() {
          const out = h('div', { class: 'bk sy' }); const Y = PatOS.sync;
          const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'settings' });
          const spin = (btn, fn) => async () => { if (btn) btn.disabled = true; try { await fn(); } catch (e) { msg(T('That didn’t work'), T(String(e.message || e))); } finally { if (btn) btn.disabled = false; } };
          let shown = false;
          function joinDialog() {
            const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
            const inp = h('input', { class: 'field', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', spellcheck: 'false', autocapitalize: 'characters', autocomplete: 'off', 'aria-label': T('Sync code') });
            const note = h('div', { class: 'bk-note' }); const go = h('button', { class: 'btn primary' }, T('Join'));
            go.onclick = async () => {
              go.disabled = true; note.textContent = T('Joining…');
              try { await Y.join(inp.value); close(); paint(); } catch (e) { go.disabled = false; note.textContent = T(String(e.message || e)); }
            };
            inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
            layer.appendChild(h('div', { class: 'dlg ce bk-dlg' }, h('b', {}, T('Join Sync')), h('p', { class: 'bk-note' }, T('Type the code shown in Settings › Sync on your other device. Things that are on both devices will use the version from Sync. PatOS keeps a snapshot first, so you can go back.')), inp, note, h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), go)));
            layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); }); layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
            document.body.appendChild(layer); setTimeout(() => inp.focus(), 30);
          }
          function offDialog() {
            const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
            const wipe = h('input', { type: 'checkbox' });
            const go = h('button', { class: 'btn primary' }, T('Turn Off'));
            go.onclick = async () => { go.disabled = true; const r = await Y.disable(wipe.checked); close(); paint(); if (r.failed) msg(T('Sync is off'), T('Sync is off on this device, but the copy on the server could not be deleted now.')); };
            layer.appendChild(h('div', { class: 'dlg ce bk-dlg' }, h('b', {}, T('Turn off Sync?')), h('p', { class: 'bk-note' }, T('Everything stays on this device. Your other devices keep their own copies too.')),
              h('label', { class: 'ce-row' }, h('span', {}, T('Also delete my encrypted copy from the server')), wipe), h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), go)));
            layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); }); layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
            document.body.appendChild(layer);
          }
          const paint = async () => {
            const st = Y.status(); out.innerHTML = '';
            out.appendChild(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('settings') }), h('div', {}, h('h2', {}, T('Sync')), h('p', { class: 'su-status' }, ''))));
            if (!Y.available()) { out.appendChild(h('div', { class: 'bk-empty' }, T('This browser can’t do the encryption Sync needs. Open PatOS from its https address, or in a newer browser.'))); return; }
            if (!st.on) {
              const on = h('button', { class: 'btn primary' }, T('Turn On Sync')); on.onclick = spin(on, async () => { await Y.enable(); shown = true; paint(); });
              const jn = h('button', { class: 'btn', onclick: joinDialog }, T('Join with a Code…'));
              out.appendChild(group(row(T('Start Sync on this device'), on, ''), row(T('Already use Sync on another device?'), jn)));
              out.appendChild(h('div', { class: 'bk-empty' }, ''));
              return;
            }
            const label = st.state === 'syncing' ? T('Syncing…') : st.state === 'offline' || st.offline ? T('Waiting for the internet. Your changes are safe here and go out later.') : st.error === 'key' ? T('This server has an account with a different key. Check the code.') : st.error === 'full' ? T('The server is full. Free some space or raise its limit.') : st.error === 'busy' ? T('Too many requests, trying again soon.') : st.error ? T('The server had a problem. Trying again soon.') : st.last ? T('Up to date') + ' · ' + (PatOS.backup ? PatOS.backup.when(st.last) : new Date(st.last).toLocaleString()) : T('Not synced yet');
            const now = h('button', { class: 'btn' }, T('Sync Now')); now.onclick = spin(now, async () => { await Y.now(); });
            out.appendChild(group(row(T('Status'), now, label)));
            const code = Y.code();
            const show = h('button', { class: 'btn' }, shown ? T('Hide') : T('Show Code')); show.onclick = () => { shown = !shown; paint(); };
            const cp = shown ? h('button', { class: 'btn', onclick: () => { try { navigator.clipboard.writeText(code); } catch (e) {} toast(T('Copied')); } }, T('Copy')) : null;
            out.appendChild(group(row(T('Your sync code'), h('div', { class: 'bk-acts' }, cp, show), T('Type this code in Settings › Sync on another device to connect it. Keep it private: it unlocks your data. It is included in backups.')), shown ? h('div', { class: 'sy-code', 'aria-live': 'polite' }, code) : null));
            out.appendChild(group(row(T('On this device'), h('span', { class: 'st-val' }, st.items + ' ' + T('items')), st.stay ? st.stay + ' ' + T('big files (videos and recordings) stay on the device where they are.') : '')));
            if (st.hold) { const ok = h('button', { class: 'btn primary' }, T('Sync These Deletions')); ok.onclick = spin(ok, async () => { await Y.now({ force: true }); }); out.appendChild(h('div', { class: 'pw-warn bk-warn' }, h('span', {}, st.hold + ' ' + T('items are missing on this device, so they would be deleted on your other devices too. If that is not what you wanted, restore a snapshot in Backup & Restore first.')), ok)); }
            if (st.rejected) { const rs = h('button', { class: 'btn' }, T('Try Again')); rs.onclick = spin(rs, async () => { await Y.resend(); }); out.appendChild(h('div', { class: 'pw-warn bk-warn' }, h('span', {}, st.rejected + ' ' + T('items could not be saved on the server (it may be full).')), rs)); }
            const sv = h('input', { class: 'field', placeholder: T('This website (recommended)'), value: Y.server_url(), spellcheck: 'false', autocapitalize: 'none', 'aria-label': T('Server address') });
            const svb = h('button', { class: 'btn' }, T('Save')); svb.onclick = spin(svb, async () => { await Y.setServer(sv.value); toast(T('Server saved')); paint(); });
            out.appendChild(group(row(T('Server address'), h('div', { class: 'bk-acts' }, sv, svb), T('Deleted your Railway and made a new one? If this copy of PatOS is still open on the old address, paste the new address here: it sends everything it has to the new server. On the new website itself, restore a backup or join with your code.'))));
            const nc = h('button', { class: 'btn' }, T('Make a New Code…')); nc.onclick = spin(nc, async () => {
              if (!(await PatOS.confirmBox(T('Make a new code?'), T('This device keeps everything and starts fresh on the server with a new code. The old code stops working, so your other devices must join again with the new one.'), { ok: T('Make New Code'), icon: 'settings' }))) return;
              shown = true; await Y.regenerate(); toast(T('New code ready')); paint();
            });
            out.appendChild(group(row(T('New code'), nc, T('Lost your code, or shared it by mistake? Everything on this device is kept, and it can be shared again with a new code.'))));
            out.appendChild(group(row(T('Full copy on this computer'), h('button', { class: 'btn', onclick: () => { pane = 'backup'; renderMain(); drawSide(); } }, T('Open Backup & Restore')), '')));
            out.appendChild(h('h3', {}, T('Turn off')));
            out.appendChild(group(row(T('Stop syncing this device'), h('button', { class: 'btn', onclick: offDialog }, T('Turn Off…')))));
            Y.server().then((s) => { if (s && out.isConnected && pane === 'sync') { const line = h('div', { class: 'bk-empty' }, T('On the server') + ': ' + s.records + ' ' + T('encrypted items') + ', ' + PatOS.fmtBytes(s.bytes) + ' ' + T('of') + ' ' + PatOS.fmtBytes(s.quota)); const old = out.querySelector('.sy-srv'); if (old) old.remove(); line.classList.add('sy-srv'); out.appendChild(line); } });
          };
          const on = () => { if (pane === 'sync' && out.isConnected) paint(); }; const off = PatOS.on('sync', on); win.on('closed', off);
          paint(); return [out];
        },
        legal() { // the full text (js/legal.js), and when this device accepted it
          const L = PatOS.legal; if (!L) return [];
          const at = L.acceptedAt();
          return [at ? h('div', { class: 'st-legal-when' }, L.strings().acceptedOn + ' ' + at.toLocaleDateString(PatOS.locale, { year: 'numeric', month: 'long', day: 'numeric' }) + '.') : null,
            h('div', { class: 'st-legal-text lg-doc', html: L.html().replace(/^<h1>[^<]*<\/h1>/, '') })];
        },
        appearance() {
          const modes = h('div', { class: 'st-modes' });
          [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].forEach(([k, l]) => {
            const b = h('button', { class: 'st-mode' + (S().theme === k ? ' on' : '') }, h('div', { class: 'st-mode-pv ' + k }), l);
            b.onclick = () => { PatOS.setSetting('theme', k); render(); }; modes.appendChild(b);
          });
          const acc = h('div', { class: 'st-acc' });
          ACCENTS.forEach((c) => { const b = h('button', { class: 'st-dot' + (S().accent === c ? ' on' : ''), style: { background: c } }); b.onclick = () => { PatOS.setSetting('accent', c); render(); }; acc.appendChild(b); });
          return [h('h3', {}, T('Light or dark')), modes, group(row('Highlight color', acc), row(T('Motion'), select('motion', [['calm', T('Calm')], ['natural', T('Natural')], ['playful', T('Playful')]]), T('How windows, menus and panels move')), row(T('App icons'), select('iconStyle', [['auto', T('Automatic')], ['light', T('Light')], ['dark', T('Dark')]]), T('Apps with a color of their own get a tile of that color; the others are white with Light, dark with Dark. Automatic follows light or dark mode')), row('Fewer animations', toggle('reduceMotion'))),
            h('h3', {}, 'Liquid Glass'),
            group(row('Liquid Glass', toggle('liquidGlass', render), ''),
              S().liquidGlass ? row(T('Glass style'), select('glassStyle', [['clear', T('Transparent')], ['tinted', T('Tinted (more contrast)')]]), '') : null,
              S().liquidGlass ? row(T('Lens edges'), toggle('glassRefraction'), PatOS.glassLens && PatOS.glassLens.supported() ? T('The edges of the Dock bend what is behind them') : T('Needs Chrome, Edge or a Chromebook')) : null,
              row('Reduce transparency', toggle('reduceTransparency'), matchMedia('(prefers-reduced-transparency: reduce)').matches ? T('Your device asks for less transparency, so PatOS uses less') : ''))];
        },
        wallpaper() {
          const W = PatOS.wallpaper, cur = S().wallpaper, all = Object.assign({}, W.live, W.palettes);
          const pick = (id) => { PatOS.setSetting('wallpaper', id); if (all[id] && all[id].live && !S().live3d) PatOS.setSetting('live3d', true); render(); };
          const tile = (id, big) => h('button', { class: 'st-wp' + (big ? ' big' : '') + (cur === id ? ' on' : ''), 'aria-pressed': String(cur === id), onclick: () => pick(id) },
            h('span', { class: 'st-wp-img' }, h('img', { src: W.thumb(id), alt: '' }), cur === id ? h('i', { class: 'st-wp-check', html: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' }) : null),
            h('span', { class: 'st-wp-n' }, T(all[id].name) + (all[id].live ? ' ✦' : '')));
          const grid = (ids, big) => h('div', { class: 'st-wps' + (big ? ' big' : '') }, ...ids.map((id) => tile(id, big)));
          const sig = Object.keys(W.palettes).filter((k) => W.palettes[k].lumen), pics = Object.keys(W.palettes).filter((k) => !W.palettes[k].lumen);
          const LV = { dawn: T('Dawn'), day: T('Day'), dusk: T('Dusk'), night: T('Night') };
          const curP = all[cur], desc = cur === 'custom' ? T('Your own picture') : curP && curP.lumen ? (curP.variant === 'auto' ? T('Changes with the time of day. Right now: ') + LV[W.lumenVariant()] : T('Liquid light, folded like satin')) : curP && curP.live ? T('Moves gently in 3D') : curP && curP.fold ? T('Follows light and dark mode') : T('A still picture');
          const upload = h('button', { class: 'btn', onclick: () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 1920 / img.width); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); PatOS.setSetting('customWallpaper', c.toDataURL('image/jpeg', 0.82)); PatOS.setSetting('wallpaper', 'custom'); render(); }; img.src = r.result; }; r.readAsDataURL(f); }; i.click(); } }, T('Choose a Photo…'));
          const heroImg = cur === 'custom' && S().customWallpaper ? S().customWallpaper : W.thumbLarge(all[cur] ? cur : 'lumen');
          return [h('div', { class: 'st-wp-hero' }, h('div', { class: 'st-wp-screen', style: { backgroundImage: 'url(' + heroImg + ')' } }, h('span', { class: 'st-wp-bar' }), h('span', { class: 'st-wp-dock' })),
              h('div', { class: 'st-wp-meta' }, h('small', {}, T('Current wallpaper')), h('h2', {}, cur === 'custom' ? T('Your picture') : T((curP || { name: 'Lumen' }).name)), h('p', {}, desc), upload)),
            h('h3', {}, T('PatOS Signature')), h('p', { class: 'st-note' }, T('Lumen is painted by PatOS on your device, sharp at any screen size. The first one follows the time of day: dawn, day, dusk and night.')), grid(sig, true),
            h('h3', {}, T('Live 3D Wallpapers')), grid(Object.keys(W.live)),
            group(row(T('Animate 3D wallpaper'), toggle('live3d'), PatOS.webgl ? '' : T('WebGL is not available on this device'))),
            h('h3', {}, T('Pictures')), grid(pics)];
        },
        dock() {
          if (PatOS.isMobile) {
            const ids = PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden && id !== 'launchpad');
            const sec = (title, key, max) => [h('h3', {}, title), h('div', { class: 'st-dockapps' }, ...ids.map((id) => { const on = key === 'hiddenApps' ? !(S().hiddenApps || []).includes(id) : S()[key].includes(id); const b = h('button', { class: 'st-da' + (on ? ' on' : '') }, h('div', { class: 'st-da-ic', html: PatOS.iconHTML(PatOS.apps[id].icon || id) }), h('span', {}, PatOS.apps[id].name)); b.onclick = () => { let l = (S()[key] || []).slice(); const i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else { if (max && l.length >= max) l.shift(); l.push(id); } PatOS.setSetting(key, l); render(); }; return b; }))];
            return [...sec('Dock (up to 4 apps)', 'mobileDock', 4), ...sec('Apps on the Home Screen', 'hiddenApps')];
          }
          return [h('h3', {}, 'Dock'), group(row('Size', range('dockSize', 36, 84, 1, (v) => v + 'px')), row('Grow icons under the pointer', toggle('magnify')), row('How much icons grow', range('magnifyScale', 1.2, 2.2, 0.1, (v) => Math.round(v * 100) + '%')), row('Automatically hide the Dock', toggle('dockAutohide')), row('Show desktop widgets', toggle('showWidgets'))),
            h('h3', {}, 'Apps in the Dock'), h('div', { class: 'st-dockapps' }, ...PatOS.appOrder.filter((id) => !PatOS.apps[id].hidden || id === 'launchpad').map((id) => {
              const on = S().dockPinned.includes(id);
              const b = h('button', { class: 'st-da' + (on ? ' on' : '') }, h('div', { class: 'st-da-ic', html: PatOS.iconHTML(PatOS.apps[id].icon || id) }), h('span', {}, PatOS.apps[id].name));
              b.onclick = () => { const l = S().dockPinned.slice(); const i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); PatOS.setSetting('dockPinned', l); render(); };
              return b;
            })),
            group(row('Desktop icons', h('button', { class: 'btn', onclick: () => PatOS.setSetting('desktopPositions', {}) }, 'Clean Up')))];
        },
        display() {
          return [h('h3', {}, 'Display'), group(row('Brightness', range('brightness', 0.2, 1, 0.01, (v) => Math.round(v * 100) + '%')), row('Full screen', h('button', { class: 'btn', onclick: PatOS.toggleFullscreen }, document.fullscreenElement ? 'Exit Full Screen' : 'Enter Full Screen'))),
            h('h3', {}, T('Speed')), group(row(T('Speed mode'), select('perfMode', [['auto', T('Automatic')], ['light', T('Lighter (faster on slow computers)')], ['full', T('Full looks')]]), '')), h('h3', {}, '3D Graphics'), group(row('3D quality', select('quality3d', [['low', T('Low (best for older Chromebooks)')], ['auto', 'Balanced'], ['high', 'High (sharpest)']])), row('WebGL', h('span', { class: 'st-val' }, PatOS.has3D ? 'Available (three.js r' + THREE.REVISION + ')' : 'Not available on this device')))];
        },
        sound() { return [h('h3', {}, 'Sound'), group(row('Output volume', range('volume', 0, 1, 0.01, (v) => Math.round(v * 100) + '%')), row('Play user interface sounds', toggle('uiSounds')), row('Test', h('button', { class: 'btn', onclick: () => PatOS.sound.startup() }, 'Play Startup Chime')))]; },
        lock() {
          const pw = h('input', { class: 'field', type: 'password', placeholder: S().password ? '••••••' : 'No password', style: { width: '160px' } });
          return [h('h3', {}, 'Lock Screen'), group(row('Login password', h('div', { class: 'st-inline' }, pw, h('button', { class: 'btn', onclick: () => { PatOS.setSetting('password', pw.value); pw.value = ''; pw.placeholder = S().password ? '••••••' : 'No password'; PatOS.notify({ title: S().password ? 'Password set' : 'Password removed', body: 'Used on the PatOS lock screen.', icon: 'settings' }); } }, 'Set')), 'Leave empty for no password. This only protects PatOS, not your computer.'), row('Lock now', h('button', { class: 'btn', onclick: () => PatOS.power.lock() }, 'Lock Screen')))];
        },
        network() {
          const box = h('div'); const out = [box];
          const paint = () => {
            box.innerHTML = '';
            const c = navigator.connection || {}; const kind = c.type ? ({ wifi: 'Wi-Fi', cellular: T('Mobile data'), ethernet: 'Ethernet', none: T('None') }[c.type] || c.type) : null;
            const lat = h('span', { class: 'st-val' }, '…'), spd = h('span', { class: 'st-val' }, T('Not tested'));
            box.append(group(
              row(T('Status'), h('span', { class: 'st-val', style: { color: navigator.onLine ? '#32d74b' : '#ff453a' } }, navigator.onLine ? T('Connected') : T('Offline'))),
              row(T('Connection type'), h('span', { class: 'st-val' }, kind || (c.effectiveType ? c.effectiveType.toUpperCase() : T('Unknown')))),
              c.effectiveType ? row(T('Quality'), h('span', { class: 'st-val' }, c.effectiveType.toUpperCase())) : null,
              c.downlink ? row(T('Estimated speed'), h('span', { class: 'st-val' }, c.downlink + ' Mbps')) : null,
              c.rtt != null ? row(T('Round-trip time'), h('span', { class: 'st-val' }, c.rtt + ' ms')) : null,
              c.saveData ? row(T('Data saver'), h('span', { class: 'st-val' }, T('On'))) : null),
            group(row(T('Response time of the PatOS server'), lat), row(T('Download speed'), h('div', { class: 'st-inline' }, spd, h('button', { class: 'btn', onclick: async (e) => { const b = e.currentTarget; b.disabled = true; spd.textContent = T('Testing…'); try { spd.textContent = await speedTest(); } catch (err) { spd.textContent = T('Couldn’t test'); } b.disabled = false; } }, T('Test'))))));
            box.appendChild(h('p', { class: 'st-note' }, T('Wi-Fi and Bluetooth are controlled by ChromeOS. Click the clock in the bottom right corner of the screen (outside PatOS) to change them. PatOS shows what it can see from the browser.')));
            pingMs().then((ms) => { lat.textContent = ms == null ? T('Not reachable (PatOS is running as a file)') : ms + ' ms'; });
          };
          async function pingMs() { const base = PatOS.server && await PatOS.server(); if (!base) return null; const t = []; for (let i = 0; i < 3; i++) { const t0 = performance.now(); try { await fetch(base + '/api/ping', { cache: 'no-store' }); t.push(performance.now() - t0); } catch (e) {} } return t.length ? Math.round(Math.min(...t)) : null; }
          async function speedTest() { const base = (PatOS.server && await PatOS.server()) || ''; const t0 = performance.now(); const r = await fetch((base || '') + '/vendor/three.min.js?x=' + Date.now(), { cache: 'no-store', headers: { 'Accept-Encoding': 'identity' } }); const buf = await r.arrayBuffer(); const sec = (performance.now() - t0) / 1000; return (buf.byteLength * 8 / 1e6 / sec).toFixed(1) + ' Mbps'; }
          const rerun = () => { if (pane === 'network' && main.isConnected) paint(); };
          addEventListener('online', rerun); addEventListener('offline', rerun); if (navigator.connection) navigator.connection.addEventListener('change', rerun);
          win.on('closed', () => { removeEventListener('online', rerun); removeEventListener('offline', rerun); });
          paint(); return out;
        },
        me() {
          const acct = PatOS.account && PatOS.account.signedIn() ? PatOS.account.info() : null;
          const info = (k, v) => v ? row(k, h('span', { class: 'st-val st-wrapval' }, String(v))) : null;
          const made = acct && acct.at ? new Date(acct.at).toLocaleDateString() : '';
          const who = h('div', { class: 'st-me' }, h('div', { class: 'lock-avatar st-me-av' }, S().userName.charAt(0).toUpperCase()), h('h2', {}, S().userName), h('p', {}, acct ? (PatOS.account.isSystem(acct.uid) ? h('span', { class: 'm2-name' }, 'PatOS', PatOS.systemBadge(13)) : '@' + acct.username) : T('Not signed in to a PatOS account')));
          const go = (p) => { pane = p; cat = catOf(p) || cat; render(); PatOS.paneIn && PatOS.paneIn(main); if (MB && MB.detail) MB.detail(win, true, paneName(p)); };
          return [who,
            h('h3', {}, T('You')), group(
              row(T('Name'), h('span', { class: 'st-val' }, S().userName)),
              info(T('Username'), acct ? '@' + acct.username : ''),
              row(T('PatOS account'), h('span', { class: 'st-inline' }, h('span', { class: 'st-val' }, acct ? T('Signed in') : T('Not signed in')), h('button', { class: 'btn', onclick: () => go('account') }, acct ? T('Manage') : T('Sign in')))),
              info(T('Signed in on this device since'), made),
              info(T('Language'), PatOS.lang === 'fr' ? 'Français' : 'English')),
            h('h3', {}, T('This computer')), ...panes.system()];
        },
        system() {
          const box = h('div'); const ua = navigator.userAgent;
          const os = /CrOS/.test(ua) ? 'ChromeOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : T('Unknown');
          const br = (/(Edg|Chrome|Firefox|Version)\/([\d.]+)/.exec(ua) || []); const bname = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : T('Unknown');
          let gpu = ''; try { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) {}
          const info = (k, v) => v ? row(k, h('span', { class: 'st-val st-wrapval' }, String(v))) : null;
          const bat = h('span', { class: 'st-val' }, '…');
          if (navigator.getBattery) navigator.getBattery().then((b) => { const f = () => { bat.textContent = Math.round(b.level * 100) + '% · ' + (b.charging ? T('Charging') : T('On battery')) + (isFinite(b.dischargingTime) && !b.charging ? ' · ' + Math.round(b.dischargingTime / 60) + ' min' : ''); }; f(); b.addEventListener('levelchange', f); b.addEventListener('chargingchange', f); }); else bat.textContent = T('Not available in this browser');
          const store = h('span', { class: 'st-val' }, '…'); PatOS.storageInfo().then((i) => { store.textContent = PatOS.fmtBytes(i.used) + ' / ' + PatOS.fmtBytes(i.quota); });
          // update safety: which copy of PatOS is running, and going back to the one before
          const upd = h('div', {});
          const ask = (msg) => new Promise((res) => { const sw = navigator.serviceWorker && navigator.serviceWorker.controller; if (!sw || !window.MessageChannel) return res(null); const ch = new MessageChannel(); const to = setTimeout(() => res(null), 3000); ch.port1.onmessage = (e) => { clearTimeout(to); res(e.data); }; sw.postMessage(msg, [ch.port2]); });
          const paintUpd = async () => {
            const m = await ask({ patosVersion: true }); upd.innerHTML = '';
            if (!m) { upd.appendChild(group(row(T('Updates'), h('span', { class: 'st-val st-wrapval' }, T('Available when PatOS is opened from its website.'))))); return; }
            const short = (k) => String(k || '').replace('patos-', '');
            const onOld = m.useOld && m.previous;
            const btn = onOld
              ? h('button', { class: 'btn', onclick: async () => { await ask({ patosUseNewest: true }); PatOS._leaving = true; location.reload(); } }, T('Use the newest version'))
              : m.previous ? h('button', { class: 'btn', onclick: async () => { if (!(await PatOS.confirmBox(T('Go back to the previous version?'), T('PatOS restarts with the version you had before this update. Your files and settings stay the same.'), { ok: T('Go Back'), icon: 'settings' }))) return; const r = await ask({ patosRollback: true }); if (r && r.ok) { PatOS._leaving = true; location.reload(); } else PatOS.alertBox(T('No previous version'), T('There is no earlier version saved on this device yet.'), { icon: 'settings' }); } }, T('Go back…')) : null;
            upd.appendChild(group(
              row(T('Running'), h('span', { class: 'st-val' }, short(onOld ? m.previous : m.newest) + (onOld ? ' (' + T('previous version') + ')' : ''))),
              row(T('Previous version'), h('div', { class: 'st-inline' }, h('span', { class: 'st-val' }, m.previous ? short(m.previous) : T('none yet')), btn), '')));
          };
          paintUpd();
          return [
            group(info(T('System'), os), info(T('Browser'), bname + ' ' + (br[2] || '')), info(T('Device'), PatOS.extApps ? PatOS.extApps.device().name : ''), info(T('Processor threads'), navigator.hardwareConcurrency), info(T('Memory'), navigator.deviceMemory ? '≥ ' + navigator.deviceMemory + ' GB' : ''), info(T('Graphics'), gpu), info(T('Screen'), screen.width + ' × ' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x'), info(T('Touch points'), navigator.maxTouchPoints || '0'), info(T('Language'), (navigator.languages || [navigator.language]).slice(0, 3).join(', ')), info(T('Time zone'), Intl.DateTimeFormat().resolvedOptions().timeZone)),
            group(row(T('Battery'), bat), row(T('Browser storage used'), store), row(T('PatOS version'), h('span', { class: 'st-val' }, (PatOS.versionNow ? PatOS.versionNow() : PatOS.version))), row(T('Time since PatOS opened'), h('span', { class: 'st-val' }, Math.round(performance.now() / 60000) + ' min'))), upd];
        },
        permissions() {
          const box = h('div'); const rows = [];
          const defs = [['camera', 'Camera', async () => { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); }], ['microphone', 'Microphone', async () => { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); }], ['geolocation', 'Location', () => new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej))], ['notifications', 'Notifications', () => Notification.requestPermission()]];
          const paint = async () => {
            box.innerHTML = '';
            const g = [];
            for (const [name, label, ask] of defs) {
              let st = 'unknown'; try { st = (await navigator.permissions.query({ name })).state; } catch (e) { if (name === 'notifications' && window.Notification) st = Notification.permission === 'default' ? 'prompt' : Notification.permission; }
              const lab = { granted: T('Allowed'), denied: T('Blocked'), prompt: T('Not asked yet'), unknown: T('Unknown') }[st] || st;
              g.push(row(T(label), h('div', { class: 'st-inline' }, h('span', { class: 'st-val', style: { color: st === 'granted' ? '#32d74b' : st === 'denied' ? '#ff453a' : '' } }, lab), st !== 'granted' ? h('button', { class: 'btn', onclick: async () => { try { await ask(); } catch (e) {} paint(); } }, T(st === 'denied' ? 'Try again' : 'Allow…')) : null), st === 'denied' ? T('Click the lock icon next to the address, then set it to Allow.') : null));
            }
            box.append(group(...g));
            const sys = h('button', { class: 'switch' + (S().systemNotifications !== false ? ' on' : '') }); sys.onclick = () => { PatOS.setSetting('systemNotifications', S().systemNotifications === false); sys.classList.toggle('on'); };
            box.append(group(row(T('Show PatOS notifications when this tab is in the background'), sys, T('Needs the Notifications permission above.'))));
            const pers = h('span', { class: 'st-val' }, '…'); PatOS.storageInfo().then((i) => { pers.textContent = i.persisted ? T('Protected from clean-up') : T('Browser may clear it when space is low'); });
            box.append(group(row(T('Your saved data'), pers), row(T('Install as an app'), h('button', { class: 'btn', onclick: () => { pane = 'startup'; renderMain(); drawSide(); } }, T('Open Install & Start Up')))));
          };
          paint(); return [box];
        },
        startup() {
          const I = PatOS.install; const box = h('div', {});
          const steps = (...items) => h('ol', { class: 'st-steps' }, ...items.map((x) => h('li', {}, x)));
          const paint = () => {
            box.innerHTML = '';
            const installed = I && I.standalone();
            const canInstall = I && I.supported();
            let action;
            if (installed) action = h('span', { class: 'st-badge ok' }, T('Installed'));
            else if (I && I.canPrompt()) action = h('button', { class: 'btn primary', onclick: async () => { await I.prompt(); paint(); } }, T('Install PatOS'));
            else action = null;
            const status = installed ? T('You are using the PatOS app. It has its own window and its own icon in the shelf.')
              : !canInstall ? T('Installing needs PatOS to be opened from its website (not from a saved file or a preview).')
              : PatOS.store.get('appInstalled', false) ? T('PatOS is installed on this Chromebook. Open it from the Launcher or the shelf to use it as an app.')
              : I && I.canPrompt() ? ''
              : T('Chrome hasn’t offered to install PatOS yet. You can install it from Chrome’s menu (see below).');
            box.append(h('div', { class: 'st-hero' }, h('img', { class: 'st-hero-ic', src: 'assets/icon-192.png', alt: '' }), h('div', {}, h('h2', {}, T('PatOS app')), h('p', {}, status), action ? h('div', { style: { marginTop: '10px' } }, action) : null)));
            if (!installed && canInstall && !(I && I.canPrompt())) {
              box.append(h('h3', { class: 'st-h3' }, T('Install from Chrome')), steps(T('Click the three dots (⋮) at the top right of Chrome.'), T('Choose “Cast, save and share”, then “Install page as app…”. On some versions it is “Install PatOS…” directly in the menu.'), T('Click Install.')));
            }
            box.append(h('h3', { class: 'st-h3' }, T('Open PatOS when your Chromebook starts')),
              steps(T('Install PatOS (above).'),
                T('Right-click the PatOS icon in the shelf at the bottom of the screen and choose Pin.'),
                T('Open the Chromebook’s Settings, search for “Restore apps on startup” and choose Always. If PatOS is open when you shut down, it opens again when you sign in.')),
              h('p', { class: 'st-note' }, T('Only using Chrome? In Chrome Settings › On startup, choose “Open a specific page or set of pages” and add the PatOS address below.')),
              h('p', { class: 'st-note' }, ''));
            const addr = I ? I.address() : location.href;
            const copyBtn = h('button', { class: 'btn', onclick: () => { (navigator.clipboard ? navigator.clipboard.writeText(addr) : Promise.reject()).then(() => { copyBtn.textContent = T('Copied'); setTimeout(() => (copyBtn.textContent = T('Copy')), 1500); }).catch(() => PatOS.ask(T('PatOS address'), addr, { icon: 'settings' })); } }, T('Copy'));
            box.append(group(row(T('PatOS address'), h('div', { class: 'st-inline' }, h('code', { class: 'st-code' }, addr), copyBtn)),
              row(T('Ask for full screen at login'), toggle('askFullscreen'), '')));
            box.append(h('h3', { class: 'st-h3' }, T('Open your Chromebook’s files with PatOS')),
              h('p', { class: 'st-note' }, I && I.fileHandling()
                ? T('Once PatOS is installed, right-click a file in the Chromebook’s Files app and choose Open with › PatOS. Word, Excel, PowerPoint, PDF, text, code, pictures, music and videos all work. When you save in PatOS, the real file is saved too.')
                : T('This browser can’t hand files to PatOS. Use Piles › Open Files… instead.')),
              h('h3', { class: 'st-h3' }, T('Shortcuts')),
              h('p', { class: 'st-note' }, ''));
          };
          paint();
          const off = I ? I.onChange(paint) : null; if (off) win.on('closed', off);
          return [box];
        },
        accessibility() {
          const ts = h('select', { class: 'field', 'data-key': 'textScale' }, ...[[1, T('Default')], [1.15, T('Larger')], [1.3, T('Large')], [1.5, T('Largest')]].map(([v, l]) => h('option', { value: v, selected: +S().textScale === v }, l)));
          ts.onchange = () => PatOS.setSetting('textScale', +ts.value);
          return [
            group(row(T('Text size'), ts, T('Makes everything inside app windows bigger: text, buttons and pictures.'))),
            group(row(T('Reduce motion'), toggle('reduceMotion'), ''), row(T('Reduce transparency'), toggle('reduceTransparency'), ''), row(T('High contrast'), toggle('highContrast'), ''), row(T('Bold text'), toggle('boldText')), row(T('Always show keyboard focus'), toggle('showFocus'), ''), row(T('Larger click targets'), toggle('bigTargets'), '')),
            group(row(T('Read notifications aloud to screen readers'), toggle('srAnnounce'))),
            h('p', { class: 'st-note' }, T('To make everything bigger, press Ctrl and + (and Ctrl and 0 to reset). PatOS rearranges itself to fit. On a Chromebook you can also use ChromeVox, the built-in screen reader (Ctrl+Alt+Z).'))];
        },
        keyboard() {
          const sc = [['Ctrl+Space / Alt+Space', 'Spotlight search'], ['Alt+L or F4', 'Launchpad'], ['Alt+↑ or F3', 'Mission Control'], ['Alt+W', 'Close window'], ['Alt+Q', 'Quit app'], ['Alt+M', 'Minimize'], ['Alt+F', 'Zoom window'], ['Alt+← / Alt+→', 'Tile window left / right'], ['Alt+N', 'New window'], ['Alt+`', 'Cycle windows'], ['Alt+T', 'Terminal'], ['Alt+E', 'Piles'], ['Alt+B', 'Patoogle browser'], ['Alt+,', 'Settings'], ['Alt+Esc', 'Lock screen'], ['Esc', 'Close menus & overlays']];
          return [h('h3', {}, 'Keyboard Shortcuts'), h('p', { class: 'st-note' }, ''), group(...sc.map(([k, d]) => row(d, h('kbd', {}, k))))];
        },
        storage() {
          const bar = h('div', { class: 'st-storage' }, h('div', { class: 'fd-bar big' }, h('span', { style: { width: '2%' } })), h('small', {}, T('Checking…')));
          const pers = h('span', { class: 'st-val' }, '…');
          PatOS.storageInfo().then((i) => { bar.querySelector('span').style.width = Math.max(2, Math.min(100, i.used / i.quota * 100)) + '%'; bar.querySelector('small').textContent = PatOS.fmtBytes(i.used) + ' ' + T('used of') + ' ' + PatOS.fmtBytes(i.quota) + (i.real ? '' : ' (' + T('estimate') + ')'); pers.textContent = i.persisted ? T('Protected') : T('Not protected yet'); });
          const exportAll = async () => {
            const kv = PatOS.store.dump();
            const tree = JSON.parse(JSON.stringify(PatOS.fs.get('/'), (k, v) => (k === 'cid' ? undefined : v)));
            let blobs = 0; (function w(n) { if (n.type === 'dir') Object.values(n.children).forEach(w); else if (n.blob) blobs++; })(tree);
            PatOS.downloadFile('PatOS-backup.json', JSON.stringify({ patosBackup: 2, kv, fs: tree }));
            if (blobs) PatOS.notify({ title: T('Backup saved'), body: blobs + ' ' + T('big files (videos and recordings) are not in the backup. Save them from Piles with “Save to This Chromebook…”.'), icon: 'settings' });
          };
          const importAll = () => { const i = h('input', { type: 'file', accept: '.json' }); i.onchange = () => { const r = new FileReader(); r.onload = async () => { try { const d = JSON.parse(r.result); if (d.patosBackup) { Object.entries(d.kv || {}).forEach(([k, v]) => PatOS.store.set(k, v)); PatOS.store.set('fs', d.fs); } else Object.entries(d).forEach(([k, v]) => { if (k.startsWith('patos:')) PatOS.store.set(k.slice(6), JSON.parse(v)); }); await PatOS.store.flush(); PatOS._leaving = true; location.reload(); } catch (e) { PatOS.alertBox(T('That file is not a PatOS backup'), T('Choose a PatOS-backup.json file.'), { icon: 'settings' }); } }; r.readAsText(i.files[0]); }; i.click(); };
          return [bar,
            group(row(T('Protect my data'), h('div', { class: 'st-inline' }, pers, h('button', { class: 'btn', onclick: async () => { const ok = await PatOS.askPersist(); PatOS.notify({ title: ok ? T('Your data is protected') : T('Chrome said not yet'), body: ok ? T('The browser won’t clear PatOS when space is low.') : T('Install PatOS as an app and try again.'), icon: 'settings' }); render(); } }, T('Ask Chrome'))), ''),
              row(T('Empty Trash'), h('button', { class: 'btn', onclick: () => { PatOS.fs.emptyTrash(); render(); } }, T('Empty'))),
              row(T('Back up everything'), h('button', { class: 'btn', onclick: exportAll }, T('Download backup…'))),
              row(T('Restore backup'), h('button', { class: 'btn', onclick: importAll }, T('Restore…'))),
              row(T('Erase all content and settings'), h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Erase PatOS?'), T('Everything in PatOS will be erased and it will start fresh. This cannot be undone.'), { ok: T('Erase'), danger: true, icon: 'settings' })) { await PatOS.store.clearAll(); PatOS._leaving = true; location.reload(); } } }, T('Erase PatOS…'))))];
        }
      };
      let filter = '';
      const sq = h('input', { class: 'field st-search', placeholder: PatOS.t('Search'), spellcheck: 'false', type: 'search', 'aria-label': PatOS.t('Search settings') });
      const sqWrap = h('label', { class: 'st-sq' }, h('span', { class: 'st-sq-ic', html: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>' }), sq);
      sq.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sq.value) { e.stopPropagation(); sq.value = ''; filter = ''; drawSide(); } });
      win.el.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.target.closest('.st-main input, .st-main textarea')) { e.preventDefault(); sq.focus(); sq.select(); } });
      sq.addEventListener('input', () => { filter = sq.value.trim().toLowerCase(); drawSide(); const hits = PANES.filter(match); if (filter && hits.length && !hits.some((p) => p[0] === pane)) { pane = hits[0][0]; renderMain(); drawSide(); } });
      sq.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const hits = PANES.filter(match); if (hits[0]) { pane = hits[0][0]; renderMain(); drawSide(); } } });
      const match = ([k, l]) => !filter || (l + ' ' + PatOS.t(l) + ' ' + KW[k]).toLowerCase().includes(filter);
      const goPane = (k) => { pane = k; cat = catOf(k) || cat; renderMain(); drawSide(); if (PatOS.mobile && PatOS.mobile.detail) PatOS.mobile.detail(win, true, PatOS.t(PANES.find((x) => x[0] === k)[1])); };
      const goCat = (c) => { const cc = CATS.find((x) => x[0] === c); if (cc && cc[3].length === 1) return goPane(cc[3][0]); cat = c; pane = null; renderMain(); drawSide(); if (PatOS.mobile && PatOS.mobile.detail) PatOS.mobile.detail(win, true, PatOS.t(CATS.find((x) => x[0] === c)[1])); };
      function drawSide() {
        side.querySelectorAll('.st-si, .st-noresult, .st-legal').forEach((e) => e.remove());
        const legalLink = () => PatOS.legal && side.appendChild(h('button', { class: 'st-legal' + (pane === 'legal' ? ' on' : ''), onclick: () => goPane('legal') }, PatOS.legal.strings().link));
        side.querySelector('.st-card').classList.toggle('on', pane === 'me');
        if (!filter) { CATS.forEach(([c, l, ic]) => side.appendChild(h('button', { class: 'st-si' + (c === cat && pane !== 'me' && pane !== 'legal' ? ' on' : ''), onclick: () => goCat(c) }, stIc(ic), PatOS.t(l)))); legalLink(); return; }
        const hits = PANES.filter(match);
        hits.forEach(([k, l, ic]) => side.appendChild(h('button', { class: 'st-si' + (k === pane ? ' on' : ''), onclick: () => goPane(k) }, stIc(ic), PatOS.t(l))));
        // single settings, each opening right on itself
        const one = (PatOS.settingsCatalog || []).filter((c) => { const f = fold(filter); return fold(T(c.label)).includes(f) || fold(c.label).includes(f) || fold(c.words).includes(f); }).slice(0, 8);
        one.forEach((c) => { const pg = PANES.find((x) => x[0] === c.pane) || ['', '', 'gear|#8e8e93']; side.appendChild(h('button', { class: 'st-si st-si-one', onclick: () => { findKey = c.key; goPane(c.pane); } }, stIc(pg[2]), h('span', {}, T(c.label), h('small', {}, T(pg[1]))))); });
        if (!hits.length && !one.length) side.appendChild(h('div', { class: 'st-noresult' }, T('No results')));
        legalLink();
      }
      function render(keepSearch) {
        side.innerHTML = '';
        const acct = PatOS.account && PatOS.account.signedIn() ? PatOS.account.info() : null;
        side.appendChild(h('button', { class: 'st-card', onclick: () => goPane('me') }, h('div', { class: 'lock-avatar st-card-av' }, S().userName.charAt(0).toUpperCase()), h('div', { class: 'st-card-t' }, h('b', {}, S().userName), h('small', {}, acct ? (PatOS.account.isSystem(acct.uid) ? h('span', { class: 'm2-name' }, 'PatOS', PatOS.systemBadge(13)) : '@' + acct.username) : PatOS.t('Sign in or create an account'))), h('span', { class: 'st-card-go' }, '›')));
        side.appendChild(sqWrap); if (!keepSearch) { sq.value = filter; }
        drawSide();
        renderMain();
      }
      let shown = null;
      function renderMain() {
        const where = pane || ('cat:' + cat); if (where !== shown) { shown = where; main.scrollTop = 0; PatOS.paneIn && PatOS.paneIn(main); } // (a new page slides in; a change on the same page doesn't move it)
        PatOS.remember && PatOS.remember(win, pane ? { pane } : { cat });
        main.innerHTML = '';
        if (!pane) { // a group: the list of its settings
          const c = CATS.find((x) => x[0] === cat) || CATS[0];
          main.append(h('h1', {}, PatOS.t(c[1])), h('div', { class: 'st-group' }, ...c[3].map((k) => { const p = PANES.find((x) => x[0] === k); return h('button', { class: 'st-row st-link', onclick: () => goPane(k) }, stIc(p[2]), h('span', { class: 'st-link-l' }, PatOS.t(p[1])), h('span', { class: 'st-card-go' }, '›')); })));
          win.setTitle(c[1]); return;
        }
        const p = PANES.find((x) => x[0] === pane); const c = CATS.find((x) => x[0] === catOf(pane));
        main.append(...[c && c[3].length > 1 && PatOS.t(c[1]) !== PatOS.t(p[1]) ? h('button', { class: 'st-back', onclick: () => goCat(c[0]) }, '‹ ' + PatOS.t(c[1])) : null, h('h1', {}, PatOS.t(p[1])), ...panes[pane]()].filter(Boolean)); // (append(null) would write "null")
        win.setTitle(p[1]);
        if (findKey) { const want = (PatOS.settingsCatalog || []).find((x) => x.key === findKey); findKey = '';
          if (want) setTimeout(() => { const lab = fold(T(want.label)); const tagged = main.querySelector('[data-key="' + want.key + '"]'); const rowEl = (tagged && tagged.closest('.st-row')) || [...main.querySelectorAll('.st-row')].find((r) => { const s2 = r.querySelector('.st-rl span, .st-rl'); return s2 && fold(s2.textContent).includes(lab); });
            if (rowEl) { rowEl.scrollIntoView({ block: 'center' }); rowEl.classList.add('st-found'); const ctl = rowEl.querySelector('button, input, select'); if (ctl) ctl.focus({ preventScroll: true }); setTimeout(() => rowEl.classList.remove('st-found'), 2600); } }, 60); }
      }
      const paneName = (k) => PatOS.t((PANES.find((x) => x[0] === k) || [k, k])[1]);
      win._pane = (p, f) => { findKey = f || ''; pane = p; cat = catOf(p) || cat; render(); PatOS.paneIn && PatOS.paneIn(main); if (MB && MB.detail) MB.detail(win, true, paneName(p)); };
      render();
      if (args.pane && MB && MB.detail) MB.detail(win, true, paneName(args.pane));
    },
    onArgs(win, args) { if (args.pane) win._pane(args.pane, args.find); }
  });
})();
