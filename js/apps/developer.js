/* Developer Center: one place for making PatOS apps. It does not have its own editor: apps are written in Code Studio
   (js/apps/pitstudio.js), and this is where you check, inspect and publish them.
   - Start: templates (they open in Code Studio), and what an app is.
   - Check a .patapp: the same validation PatOS and the store use (js/patapp-format.js), with compatibility, permissions and actions.
   - Installed apps: each one's manifest, the permissions it asked for and was given, the actions it offers, its recent problems.
   - Reference: the patos.* SDK, permissions, PatOS Intelligence actions an app may run, the optional manifest fields.
   - Publish: how the community store works (submissions are read by the server's owner before anyone can install them). */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const F = () => window.PatAppFormat;
  const SDK = [
    ['patos.storage.get / set / remove / keys / clear', 'The app’s own storage on this device (5 MB).', ''],
    ['patos.notify({ title, body })', 'A notification.', 'notifications'],
    ['patos.files.list / read / write / remove', 'Files in the app’s own folder (Documents › Apps › your app).', 'files'],
    ['patos.clipboard.read / write', 'The clipboard.', 'clipboard'],
    ['patos.camera.snapshot()', 'A picture from the camera.', 'camera'],
    ['patos.microphone.record(ms)', 'A short recording.', 'microphone'],
    ['patos.location.get()', 'Where the device is.', 'location'],
    ['patos.window.setTitle / close', 'The app’s window.', ''],
    ['patos.on("theme", f)', 'Light or dark mode changed (CSS variables --patos-bg, --patos-text, --patos-accent are set for you).', ''],
    ['patos.actions.register([{ id, title, phrases }])', 'Offer actions to PatOS Intelligence: people can ask Pat or Spotlight for them, and PatOS opens your app to do them.', ''],
    ['patos.actions.handle((id, params) => message)', 'Do one of your actions; return what to tell the person (or throw an error).', ''],
    ['patos.actions.run(id, params)', 'Ask PatOS to do one of the system actions apps may use (see below).', '']
  ];
  const MANIFEST = [['minPatOS', '"3.2.0": PatOS refuses to install the app on an older PatOS.'], ['category', F() ? F().CATEGORIES.join(', ') : ''], ['screenshots', 'Up to 4 PNG, JPEG or WebP data: addresses, under 400 KB each. The App Store shows them.'],
    ['changelog', 'What changed in this version (shown on its App Store page).'], ['actions', 'The actions the app offers, so they work before it was ever opened.'], ['homepage', 'An https:// address.']];

  PatOS.registerApp({
    id: 'developer', name: 'Developer Center', icon: 'code', width: 940, height: 640, minWidth: 360, category: 'Utilities',
    keywords: 'developer center sdk patapp app make build publish permissions manifest api pitcode developpeur creer application publier',
    about: 'Make PatOS apps: templates, checking a .patapp, inspecting installed apps, the SDK reference and publishing.',
    launch(win) {
      const side = h('nav', { class: 'dv-side', 'aria-label': T('Sections') }); const main = h('div', { class: 'dv-main', role: 'region', 'aria-live': 'polite' });
      win.body.appendChild(h('div', { class: 'dv-wrap' }, side, main));
      const MB = PatOS.mobile; if (MB && MB.stack) { MB.stack(win, T('Developer Center')); side.classList.add('m-list'); main.classList.add('m-detail'); }
      const card = (...k) => h('div', { class: 'st-group dv-card' }, ...k);
      const row = (l, ctl, sub) => h('div', { class: 'st-row' }, h('div', { class: 'st-rl' }, h('span', {}, l), sub ? h('small', {}, sub) : null), ctl || h('span'));
      const code = (t) => h('code', { class: 'dv-code' }, t);
      const S = {
        start() {
          return [h('h1', {}, T('Developer Center')), h('p', { class: 'st-desc' }, T('A PatOS app is one .patapp file: a web page (HTML, CSS, JavaScript, or PitCode) with a name, an icon and what it asks for. It runs in a locked box and reaches PatOS only through patos.*.')),
            card(row(T('Write an app'), h('button', { class: 'btn primary', onclick: () => PatOS.launch('code') }, T('Open Code Studio')), T('Templates, a live preview, and export as .patapp.')),
              row(T('Try the example'), h('button', { class: 'btn', onclick: async () => { const src = PatOS.patapps.make({ id: 'local.example.' + Date.now().toString(36).slice(-4), name: 'Example', html: PatOS.patapps.example }); try { await PatOS.patapps.install(src, { source: 'file' }); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message); } } }, T('Install Example')), T('A small app that remembers how often it was opened.')),
              row(T('Check a .patapp file'), h('button', { class: 'btn', onclick: () => go('check') }, T('Check…'))),
              row(T('Publish to the App Store'), h('button', { class: 'btn', onclick: () => go('publish') }, T('How')))) ];
        },
        check() {
          const out = h('div'); const res = h('div');
          const pick = h('input', { type: 'file', accept: '.patapp,application/json', style: { display: 'none' } });
          pick.onchange = async () => { const f = pick.files[0]; pick.value = ''; if (f) show(await f.text(), f.name); };
          function show(text, name) {
            res.innerHTML = ''; let raw; try { raw = JSON.parse(text); } catch (e) { res.appendChild(card(row('✗ ' + T('This is not JSON'), h('span'), e.message))); return; }
            const v = F().validate(raw);
            if (!v.ok) { res.appendChild(card(row('✗ ' + T('Not valid'), h('span'), v.error))); return; }
            const a = v.app; const comp = F().compatible(a, PatOS.version);
            res.append(card(row('✓ ' + T('Valid') + ': ' + a.name + ' ' + a.version, h('span', { class: 'st-badge ' + (comp ? 'ok' : 'bad') }, h('span', { class: 'st-dot' }), comp ? T('Runs on this PatOS') : T('Needs PatOS') + ' ' + a.minPatOS), name),
              row(T('Id'), code(a.id)), row(T('Engine'), h('span', { class: 'st-val' }, a.engine)), row(T('Size'), h('span', { class: 'st-val' }, Math.round(a.html.length / 1024) + ' KB')),
              row(T('Permissions'), h('span', { class: 'st-val' }, a.permissions.join(', ') || T('none'))), row(T('Actions it offers'), h('span', { class: 'st-val' }, (a.actions || []).map((x) => x.title).join(', ') || T('none'))),
              row(T('Category'), h('span', { class: 'st-val' }, a.category || '—')), row(T('Screenshots'), h('span', { class: 'st-val' }, String((a.screenshots || []).length)))),
              card(row(T('Install it here to test it'), h('button', { class: 'btn', onclick: async () => { try { await PatOS.patapps.install(raw, { source: 'file' }); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message); } } }, T('Install')))));
          }
          const ta = h('textarea', { class: 'field dv-paste', rows: 6, placeholder: T('…or paste the file’s text here'), 'aria-label': T('The .patapp text') });
          ta.addEventListener('input', () => { if (ta.value.trim().length > 10) show(ta.value, T('Pasted')); });
          out.append(h('h1', {}, T('Check a .patapp')), h('p', { class: 'st-desc' }, T('The same checks PatOS and the App Store use, plus whether it runs on this PatOS.')), pick, card(row(T('Choose a file'), h('button', { class: 'btn primary', onclick: () => pick.click() }, T('Choose…')))), ta, res);
          return [out];
        },
        installed() {
          const list = PatOS.patapps.list(); const acts = PatOS.store.get('patAppActions', {}) || {};
          const out = [h('h1', {}, T('Installed apps')), h('p', { class: 'st-desc' }, T('What each community app asked for, what it was given, and what it offers to PatOS Intelligence.'))];
          if (!list.length) out.push(card(row(T('No community apps installed yet.'), h('button', { class: 'btn', onclick: () => PatOS.launch('appstore') }, T('App Store')))));
          list.forEach((x) => { const a = x.app; const g = PatOS.patapps.grants(a.id); const errs = PatOS.errors.list().filter((e) => String(e.where).includes(a.id) || e.app === 'pa:' + a.id).slice(-3);
            out.push(h('h3', {}, a.name + ' ' + a.version), card(row(T('Id'), code(a.id)), row(T('Source'), h('span', { class: 'st-val' }, x.source === 'store' ? T('App Store (reviewed)') : T('File (not reviewed)'))),
              ...a.permissions.map((p) => row(T('Permission') + ': ' + p, h('span', { class: 'st-val' }, g[p] === 'allow' ? T('Allowed') : g[p] === 'deny' ? T('Denied') : T('Asks first')))),
              row(T('Actions it offers'), h('span', { class: 'st-val' }, (acts[a.id] || []).map((y) => y.title).join(', ') || T('none'))),
              ...errs.map((e) => row('⚠ ' + e.msg, h('small', {}, new Date(e.t).toLocaleString(PatOS.locale)))),
              row(T('Open'), h('button', { class: 'btn', onclick: () => PatOS.patapps.open(a.id) }, T('Open'))))); });
          return out;
        },
        reference() {
          const sys = PatOS.intel ? PatOS.intel.list({ apps: true }) : [];
          return [h('h1', {}, T('Reference')), h('h3', {}, 'patos.*'), card(...SDK.map(([api, what, perm]) => row(api, perm ? h('span', { class: 'st-badge' }, perm) : h('span'), T(what)))),
            h('h3', {}, T('Permissions')), card(...(F() ? F().PERMS : []).map((p) => { const [l, w] = PatOS.patapps.permInfo(p); return row(p, h('span'), l + ': ' + w); })),
            h('p', { class: 'st-desc' }, T('Each permission is listed in the file, shown before installing, and asked again on the device the first time the app uses it. Settings › Privacy shows what each app did.')),
            h('h3', {}, T('System actions apps may run')), card(...sys.map((a) => row(code(a.id), h('span'), T(a.title) + (Object.keys(a.params).length ? ' (' + Object.keys(a.params).join(', ') + ')' : '')))),
            h('p', { class: 'st-desc' }, T('Apps can’t run any other system action. Every run is written in Settings › Privacy, and an app can run at most 20 a minute.')),
            h('h3', {}, T('Optional manifest fields')), card(...MANIFEST.map(([k, w]) => row(code(k), h('span'), T(w)))),
            card(row(T('The full guide'), h('span'), 'docs/APP-SDK.md · docs/INTELLIGENCE.md')) ];
        },
        publish() {
          return [h('h1', {}, T('Publish')), card(
            row('1. ' + T('Export your app as a .patapp file'), h('button', { class: 'btn', onclick: () => PatOS.launch('code') }, T('Code Studio'))),
            row('2. ' + T('Check it here'), h('button', { class: 'btn', onclick: () => go('check') }, T('Check…'))),
            row('3. ' + T('Send it to the App Store'), h('button', { class: 'btn', onclick: () => PatOS.launch('appstore') }, T('App Store')), T('In the App Store: Submit an App. The owner of this PatOS server reads it before anyone can install it.')),
            row('4. ' + T('Update it'), h('span'), T('Raise the version (1.0.1, 1.1.0…) and submit again: people who have it get the update; their data and permissions stay.'))),
            h('p', { class: 'st-desc' }, T('The App Store only shows real information: no made-up ratings or download counts.')) ];
        }
      };
      const NAV = [['start', 'Start', 'rocket|#ff6a3d'], ['check', 'Check a .patapp', 'check|#30d158'], ['installed', 'Installed apps', 'grid|#ff9f0a'], ['reference', 'Reference', 'list|#0a84ff'], ['publish', 'Publish', 'upload|#bf5af2']];
      let cur = 'start';
      function go(k) { cur = k; side.innerHTML = ''; NAV.forEach(([key, l, ic]) => { const [n, c] = ic.split('|'); side.appendChild(h('button', { class: 'dv-si' + (key === cur ? ' on' : ''), 'aria-current': key === cur ? 'page' : null, onclick: () => go(key) }, h('span', { class: 'st-ic', style: { '--ic': c }, html: PatOS.sym(n) }), T(l))); });
        main.innerHTML = ''; main.append(...S[k]()); win.setTitle(T(NAV.find((x) => x[0] === k)[1])); if (MB && MB.detail && k !== 'start') MB.detail(win, true, T(NAV.find((x) => x[0] === k)[1])); }
      go('start');
    }
  });
})();
