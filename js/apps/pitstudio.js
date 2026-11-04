/* PitCode Studio: make PatOS apps in PatOS, like Xcode.
   - A project is a folder in Documents › Studio: your code files and a project.patproj (name, id, icon, permissions...).
   - Write in PitCode (.pitx pages, .pit code, .pitoss styles: github.com/monsieurpit/PitCode) or in plain HTML and JavaScript.
   - ▶ Run starts the app in a locked box right here, with a console for what it prints and the errors it hits.
   - Build installs it, saves a .patapp file, or sends it for review (see docs/APP-SDK.md). */
(function () {
  'use strict';
  const { h } = PatOS; const T = (s) => PatOS.t(s);
  const ROOT = '/Documents/Studio', META = 'project.patproj';
  const PERMS = ['files', 'clipboard', 'notifications', 'camera', 'microphone', 'location', 'network'];
  const EXT_OK = /\.(pitx|pit|pitoss|html|css|js|json|txt|md)$/i;

  /* ---------- starting points ---------- */
  const TEMPLATES = {
    pitcode: [
      { id: 'blank', name: 'Blank', note: 'A page that says hello.', files: {
        'main.pitx': '// Your app starts here. Press Run to see it.\nApp() => <main>\n  <h1>Hello from {js.patos.app.name}!</h1>\n  <p>Change this text, then press Run again.</p>\n</main>\n\ndraw(App)\n',
        'styles.pitoss': 'style body {\n  margin: 0\n  padding: 20\n  font-family: system-ui, sans-serif\n}\n\nstyle h1 {\n  text-color: #0e4d5c\n}\n' } },
      { id: 'counter', name: 'Counter', note: 'Buttons, state, and saving between runs.', files: {
        'main.pitx': '// A counter that remembers its number.\npit state = store({count: 0})\n\nstart() => {\n  pit saved = wait js.patos.storage.get("count")\n  when saved != nil {\n    state.count = saved\n  }\n}\n\nchange(by) => {\n  state.count = state.count + by\n  js.patos.storage.set("count", state.count)\n}\n\nApp() => <main>\n  <h1>{state.count}</h1>\n  <div class="row">\n    <button onClick={() => change(-1)}>-1</button>\n    <button onClick={() => change(1)}>+1</button>\n  </div>\n</main>\n\nstart()\ndraw(App)\n',
        'styles.pitoss': 'style body {\n  margin: 0\n  padding: 20\n  font-family: system-ui, sans-serif\n  text-align: center\n}\n\nstyle h1 {\n  font-size: 64\n  margin: 10 0\n}\n\nstyle .row {\n  display: flex\n  gap: 10\n  arrange: center\n}\n\nstyle button {\n  font: inherit\n  padding: 8 18\n  border: 0\n  corners: 8\n  text-color: white\n  background: var(--patos-accent)\n}\n' } },
      { id: 'notes', name: 'Notes', note: 'A text box that saves as you type.', files: {
        'main.pitx': '// A tiny notepad.\npit state = store({text: ""})\n\nstart() => {\n  pit saved = wait js.patos.storage.get("text")\n  when saved != nil {\n    state.text = saved\n  }\n}\n\nsave(event) => {\n  state.text = event.target.value\n  js.patos.storage.set("text", state.text)\n}\n\nApp() => <main>\n  <textarea value={state.text} onInput={save} placeholder="Write something..."></textarea>\n  <small>{state.text.size} characters</small>\n</main>\n\nstart()\ndraw(App)\n',
        'styles.pitoss': 'style body {\n  margin: 0\n  padding: 12\n  font-family: system-ui, sans-serif\n}\n\nstyle textarea {\n  width: 100%\n  height: 220\n  box-sizing: border-box\n  font: inherit\n  padding: 10\n  corners: 8\n  border: 1px solid #8884\n  background: transparent\n  text-color: inherit\n}\n' } }
    ],
    web: [
      { id: 'blank', name: 'Blank', note: 'A page that says hello.', files: {
        'index.html': '<h1>Hello!</h1>\n<p>Change this text, then press Run again.</p>\n<link rel="stylesheet" href="style.css">\n<script src="app.js"></script>\n',
        'style.css': 'body { padding: 20px; }\nh1 { color: var(--patos-accent); }\n',
        'app.js': '// Your JavaScript. patos.storage, patos.notify and more are ready to use.\nconsole.log("Hello from " + patos.app.name);\n' } },
      { id: 'counter', name: 'Counter', note: 'Buttons, and saving between runs.', files: {
        'index.html': '<h1 id="n">0</h1>\n<button id="down">-1</button> <button id="up">+1</button>\n<link rel="stylesheet" href="style.css">\n<script src="app.js"></script>\n',
        'style.css': 'body { text-align: center; padding: 20px; }\nh1 { font-size: 64px; margin: 10px 0; }\nbutton { font: inherit; padding: 8px 18px; border: 0; border-radius: 8px; color: #fff; background: var(--patos-accent); }\n',
        'app.js': 'var n = 0, out = document.getElementById("n");\nfunction show() { out.textContent = n; patos.storage.set("count", n); }\npatos.storage.get("count").then(function (v) { n = v || 0; out.textContent = n; });\ndocument.getElementById("up").onclick = function () { n++; show(); };\ndocument.getElementById("down").onclick = function () { n--; show(); };\n' } }
    ]
  };

  /* ---------- projects live in Documents › Studio ---------- */
  const fsx = () => PatOS.fs;
  const pdir = (name) => ROOT + '/' + name;
  function listProjects() {
    if (!fsx().isDir(ROOT)) return [];
    return fsx().list(ROOT).filter((x) => x.type === 'dir' && fsx().exists(pdir(x.name) + '/' + META)).map((x) => { const m = readMeta(x.name); return m ? { name: x.name, meta: m, mtime: x.mtime || 0 } : null; }).filter(Boolean);
  }
  function readMeta(name) { try { const m = JSON.parse(fsx().read(pdir(name) + '/' + META)); return m && typeof m === 'object' ? m : null; } catch (e) { return null; } }
  function mkdirs(p) { let cur = ''; p.split('/').filter(Boolean).forEach((x) => { cur += '/' + x; if (!fsx().exists(cur)) fsx().mkdir(cur); }); }
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
  const colors = ['#0a84ff', '#34c759', '#ff9f0a', '#ff375f', '#bf5af2', '#64d2ff', '#0e4d5c'];
  function newProject({ name, language, template }) {
    const t = TEMPLATES[language].find((x) => x.id === template) || TEMPLATES[language][0];
    let nm = name, i = 2; while (fsx().exists(pdir(nm))) nm = name + ' ' + i++;
    mkdirs(pdir(nm));
    const meta = { name: nm, id: 'local.' + slug(nm) + '.' + Math.random().toString(36).slice(2, 6), version: '1.0.0', author: '', description: '', icon: '✨', color: colors[Math.floor(Math.random() * colors.length)], permissions: [], language, entry: language === 'pitcode' ? 'main.pitx' : 'index.html', width: 460, height: 420 };
    fsx().write(pdir(nm) + '/' + META, JSON.stringify(meta, null, 2));
    Object.keys(t.files).forEach((f) => fsx().write(pdir(nm) + '/' + f, t.files[f]));
    return nm;
  }
  function loadProject(name) {
    const meta = readMeta(name); if (!meta) return null;
    const files = {};
    fsx().list(pdir(name)).forEach((x) => { if (x.type === 'file' && x.name !== META && EXT_OK.test(x.name) && !x.blob) files[x.name] = String(fsx().read(pdir(name) + '/' + x.name) || ''); });
    meta.permissions = Array.isArray(meta.permissions) ? meta.permissions.filter((p) => PERMS.indexOf(p) >= 0) : [];
    return { name, meta, files };
  }

  /* ---------- from a project to an app file ---------- */
  const forHtml = (s) => s.replace(/<\/script/gi, '<\\/script');
  function buildHtml(p) {
    const f = p.files;
    if (p.meta.language === 'pitcode') {
      const entry = f[p.meta.entry] != null ? p.meta.entry : Object.keys(f).find((n) => /\.pitx?$/.test(n));
      if (!entry) throw new Error(T('There is no PitCode file to start from. Add a main.pitx.'));
      const json = JSON.stringify(f).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
      return '<div id="root"></div>\n<script type="application/json" id="pit-files">' + json + '</script>\n<script>\n(function () {\n  var files = JSON.parse(document.getElementById("pit-files").textContent);\n  var entry = ' + JSON.stringify(entry) + ';\n  var out = function (t) { patos.log(String(t).replace(/\\n$/, ""), false); }, bad = function (t) { patos.log(String(t).replace(/\\n$/, ""), true); };\n  var sheets = Object.keys(files).filter(function (n) { return /\\.pitoss$/.test(n); });\n  Promise.all(sheets.map(function (n) {\n    return PitCode.styles(files[n], { file: n, files: files }).then(function (css) { var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); });\n  })).then(function () {\n    return PitCode.run(files[entry], { file: entry, files: files, root: document.getElementById("root"), write: out, writeError: bad });\n  }).catch(function (e) { bad(e && e.message ? e.message : e); });\n})();\n<\/script>\n';
    }
    let html = f[p.meta.entry] != null ? f[p.meta.entry] : f['index.html'];
    if (html == null) throw new Error(T('There is no index.html to start from.'));
    html = html.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (m, href) => (f[href] != null && /\.css$/i.test(href) ? '<style>\n' + f[href].replace(/<\/style/gi, '<\\/style') + '\n</style>' : m));
    html = html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (m, src) => (f[src] != null && /\.js$/i.test(src) ? '<script>\n' + forHtml(f[src]) + '\n<\/script>' : m));
    return html;
  }
  function toApp(p) {
    const m = p.meta;
    return PatOS.patapps.make({ id: m.id, engine: m.language === 'pitcode' ? 'pitcode' : 'web', name: m.name, version: m.version, author: m.author, description: m.description, icon: m.icon, color: m.color, permissions: m.permissions, width: m.width, height: m.height, html: buildHtml(p) });
  }

  /* ---------- the code editor: a text box with colors drawn behind it ---------- */
  function editor(onInput) {
    const gut = h('div', { class: 'ps-gut', 'aria-hidden': 'true' });
    const pre = h('pre', { class: 'ps-hl', 'aria-hidden': 'true' });
    const ta = h('textarea', { class: 'ps-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', 'aria-label': T('Code') });
    const code = h('div', { class: 'ps-code' }, pre, ta);
    const el = h('div', { class: 'ps-ed' }, gut, code);
    let opts = {}, plain = true;
    const render = () => {
      const src = ta.value; let html = '';
      const pit = window.PitCode;
      if (!plain && pit) { try { pit.highlight(src, opts).forEach((pc) => { html += pc.kind === 'plain' ? PatOS.esc(pc.text) : '<span class="ps-k-' + pc.kind + '">' + PatOS.esc(pc.text) + '</span>'; }); } catch (e) { html = PatOS.esc(src); } } else html = PatOS.esc(src);
      pre.innerHTML = html + '\n';
      const n = src.split('\n').length; if (gut.childElementCount !== n) { gut.innerHTML = ''; for (let i = 1; i <= n; i++) gut.appendChild(h('div', {}, String(i))); }
      ta.style.width = pre.offsetWidth + 'px'; ta.style.height = pre.offsetHeight + 'px';
    };
    const caretVisible = () => {
      const lh = parseFloat(getComputedStyle(ta).lineHeight) || 19; const line = ta.value.slice(0, ta.selectionStart).split('\n').length;
      const top = (line - 1) * lh + 10, bottom = top + lh + 10; const v = el.clientHeight;
      if (top < el.scrollTop) el.scrollTop = top - 10; else if (bottom > el.scrollTop + v) el.scrollTop = bottom - v;
    };
    const edit = (start, end, text, selStart, selEnd) => { ta.focus(); ta.setSelectionRange(start, end); if (!document.execCommand || !document.execCommand('insertText', false, text)) { ta.setRangeText(text, start, end, 'end'); ta.dispatchEvent(new Event('input')); } if (selStart != null) ta.setSelectionRange(selStart, selEnd == null ? selStart : selEnd); };
    ta.addEventListener('input', () => { render(); caretVisible(); onInput(ta.value); });
    ta.addEventListener('keydown', (e) => {
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (s === en && !e.shiftKey) return edit(s, en, '  ');
        const ls = v.lastIndexOf('\n', s - 1) + 1; const block = v.slice(ls, en); const lines = block.split('\n');
        const out = lines.map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l)).join('\n'); edit(ls, en, out, ls, ls + out.length);
      } else if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        const ls = v.lastIndexOf('\n', s - 1) + 1; const indent = (v.slice(ls, s).match(/^[ \t]*/) || [''])[0]; const prev = v.slice(ls, s).trimEnd(); const more = /[{(\[]$/.test(prev) ? '  ' : '';
        const closing = /^[}\])]/.test(v.slice(en)) && more ? '\n' + indent : '';
        e.preventDefault(); edit(s, en, '\n' + indent + more + closing, s + 1 + indent.length + more.length);
      }
    });
    return {
      el, ta, focus: () => ta.focus(),
      set(text, o) { opts = o || {}; plain = !o; ta.value = text; render(); el.scrollTop = 0; el.scrollLeft = 0; },
      get: () => ta.value, rerender: render,
      goto(line, col) { const lines = ta.value.split('\n'); let off = 0; for (let i = 0; i < Math.min(line - 1, lines.length); i++) off += lines[i].length + 1; ta.focus(); ta.setSelectionRange(off + Math.max(0, col - 1), off + Math.max(0, col - 1)); caretVisible(); }
    };
  }

  /* ---------- the app ---------- */
  PatOS.registerApp({
    id: 'pitstudio', name: 'PitCode Studio', icon: 'pitstudio', width: 1080, height: 680, minWidth: 360, minHeight: 320, category: 'Developer', keywords: 'studio xcode pitcode code develop app sdk patapp make build ide programming developer code',
    about: 'Make your own PatOS apps in PitCode or HTML and JavaScript, run them, and share them.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      const P = PatOS.patapps;
      let proj = null, cur = null, view = 'code', saveTimer = null, run = null, problemsTimer = null;
      const root = h('div', { class: 'ps' }); win.body.appendChild(root);
      const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'pitstudio' });
      const fail = (e) => msg(T('That didn’t work'), String((e && e.message) || e));
      if (PatOS.pitcodeSource) PatOS.loadPitCode().then(() => { if (ed) ed.rerender(); if (proj) checkNow(); }).catch(() => {});

      /* toolbar */
      const bProjects = h('button', { class: 'tbtn', title: T('Projects') }, T('Projects'));
      const title = h('span', { class: 'ps-title' });
      const bRun = h('button', { class: 'btn primary ps-run' }, T('Run')), bStop = h('button', { class: 'btn ps-stop' }, T('Stop'));
      const bBuild = h('button', { class: 'btn ps-build' }, T('Build'));
      const bFiles = h('button', { class: 'tbtn ps-narrow', title: T('Files') }, '☰'), bPrev = h('button', { class: 'btn ps-prevbtn' }, T('Preview'));
      win.toolbar.append(bProjects, title, h('div', { style: { flex: 1 } }), bFiles, bRun, bStop, bBuild, bPrev);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px'; win.toolbar.style.gap = '8px';

      /* project view */
      const side = h('div', { class: 'ps-side' });
      const center = h('div', { class: 'ps-center' });
      const prev = h('div', { class: 'ps-prev' });
      const stage = h('div', { class: 'ps-stage' }, h('div', { class: 'ps-hint' }, T('Press Run to start your app here.')));
      const cons = h('div', { class: 'ps-console', role: 'log', 'aria-live': 'polite' });
      const consBar = h('div', { class: 'ps-consbar' }, h('b', {}, T('Console')), h('button', { class: 'tbtn', title: T('Clear'), onclick: () => { cons.innerHTML = ''; } }, T('Clear')));
      prev.append(stage, consBar, cons);
      const ed = editor((val) => { if (!proj || !cur) return; proj.files[cur] = val; clearTimeout(saveTimer); saveTimer = setTimeout(saveFile, 400); clearTimeout(problemsTimer); problemsTimer = setTimeout(checkNow, 600); });
      const problems = h('div', { class: 'ps-problems' });
      const settings = h('div', { class: 'ps-settings' });
      const codeBox = h('div', { class: 'ps-codebox' }, h('div', { class: 'ps-fname' }), ed.el, problems);
      center.append(codeBox, settings);
      const main = h('div', { class: 'ps-main' }, side, center, prev);

      const say = (text, err) => { const l = h('div', { class: 'ps-line' + (err ? ' err' : '') }, text); cons.appendChild(l); while (cons.childElementCount > 300) cons.firstChild.remove(); cons.scrollTop = cons.scrollHeight; };
      const optsFor = (name) => (/\.pitx$/.test(name) ? { jsx: true } : /\.pitoss$/.test(name) ? { css: true } : /\.pit$/.test(name) ? {} : null);

      function saveFile() { if (!proj || !cur || proj.files[cur] == null) return; try { fsx().write(pdir(proj.name) + '/' + cur, proj.files[cur]); } catch (e) {} }
      function saveMeta() { try { fsx().write(pdir(proj.name) + '/' + META, JSON.stringify(proj.meta, null, 2)); } catch (e) {} }
      function checkNow() {
        problems.innerHTML = ''; const o = proj && cur ? optsFor(cur) : null;
        if (!o || !window.PitCode) { problems.classList.add('empty'); return; }
        let list = []; try { list = window.PitCode.check(ed.get(), o); } catch (e) { list = [{ severity: 'error', message: String(e.message || e), line: 1, col: 1 }]; }
        problems.classList.toggle('empty', !list.length);
        list.slice(0, 20).forEach((pr) => problems.appendChild(h('button', { class: 'ps-prob ' + pr.severity, onclick: () => ed.goto(pr.line, pr.col) }, h('b', {}, (pr.severity === 'error' ? T('Error') + ' ' : T('Warning') + ' ') + pr.line + ':' + pr.col), ' ' + pr.message)));
      }

      /* the file list */
      function drawSide() {
        side.innerHTML = '';
        const gen = h('button', { class: 'ps-file ps-gen' + (view === 'settings' ? ' on' : '') }, h('span', { class: 'ps-ico' }, '•••'), h('b', {}, T('Project Settings'))); gen.onclick = () => { view = 'settings'; drawAll(); };
        const add = h('button', { class: 'tbtn', title: T('New file'), 'aria-label': T('New file'), onclick: newFile }, '+');
        side.append(h('div', { class: 'ps-sidehead' }, h('b', {}, proj.name), add), gen);
        Object.keys(proj.files).sort((a, b) => (a === proj.meta.entry ? -1 : b === proj.meta.entry ? 1 : a.localeCompare(b))).forEach((f) => {
          const b = h('button', { class: 'ps-file' + (view === 'code' && f === cur ? ' on' : '') }, h('span', { class: 'ps-ico' }, /\.pitx?$/.test(f) ? 'P' : /\.pitoss$/.test(f) ? '#' : /\.html$/.test(f) ? '<>' : /\.css$/.test(f) ? '#' : /\.js$/.test(f) ? 'JS' : '·'), h('b', {}, f), f === proj.meta.entry ? h('small', {}, T('start')) : null);
          b.onclick = () => { saveFile(); cur = f; view = 'code'; drawAll(); win.el.classList.remove('ps-show-side'); };
          b.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('Rename'), action: () => renameFile(f) }, { label: T('Make this the start file'), action: () => { proj.meta.entry = f; saveMeta(); drawSide(); } }, { label: T('Delete'), action: () => delFile(f) }], e.clientX, e.clientY); };
          let t = null; b.addEventListener('touchstart', () => { t = setTimeout(() => b.oncontextmenu({ preventDefault() {}, clientX: b.getBoundingClientRect().left + 40, clientY: b.getBoundingClientRect().bottom }), 600); }, { passive: true }); ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => b.addEventListener(ev, () => clearTimeout(t), { passive: true }));
          side.appendChild(b);
        });
        side.appendChild(h('small', { class: 'ps-tip' }, T('Right-click a file to rename or delete it. Press and hold on a phone.')));
      }
      async function newFile() {
        const name = await PatOS.ask(T('New file'), proj.meta.language === 'pitcode' ? 'extra.pit' : 'extra.js', { icon: 'pitstudio', ok: T('Add'), text: T('Use .pitx, .pit or .pitoss for PitCode; .html, .css or .js for the web.') });
        if (!name) return; const n = name.trim();
        if (!/^[\w.-]{1,60}$/.test(n) || !EXT_OK.test(n) || n === META) return msg(T('That name doesn’t work'), T('Use letters, numbers, dots and dashes, and end with .pitx, .pit, .pitoss, .html, .css, .js, .json, .txt or .md.'));
        if (proj.files[n] != null) return msg(T('That name doesn’t work'), T('A file with that name is already here.'));
        proj.files[n] = ''; fsx().write(pdir(proj.name) + '/' + n, ''); saveFile(); cur = n; view = 'code'; drawAll();
      }
      async function renameFile(f) {
        const name = await PatOS.ask(T('Rename'), f, { icon: 'pitstudio', ok: T('Rename') }); if (!name || name.trim() === f) return; const n = name.trim();
        if (!/^[\w.-]{1,60}$/.test(n) || !EXT_OK.test(n) || n === META || proj.files[n] != null) return msg(T('That name doesn’t work'), T('Use letters, numbers, dots and dashes, end with a file type like .pit or .js, and pick a name that is free.'));
        saveFile(); fsx().rename(pdir(proj.name) + '/' + f, n); proj.files[n] = proj.files[f]; delete proj.files[f]; if (proj.meta.entry === f) { proj.meta.entry = n; saveMeta(); } if (cur === f) cur = n; drawAll();
      }
      async function delFile(f) {
        if (f === proj.meta.entry) return msg(T('This is the start file'), T('Make another file the start file first (right-click it).'));
        if (!(await PatOS.confirmBox(T('Delete') + ' ' + f + '?', T('It goes to the Trash.'), { ok: T('Delete'), danger: true, icon: 'pitstudio' }))) return;
        fsx().remove(pdir(proj.name) + '/' + f); delete proj.files[f]; if (cur === f) cur = proj.meta.entry; drawAll();
      }

      /* project settings (like Xcode's General tab) */
      function drawSettings() {
        const m = proj.meta; settings.innerHTML = '';
        const field = (label, el, note) => h('label', { class: 'ps-field' }, h('span', {}, label), el, note ? h('small', {}, note) : null);
        const txt = (key, max, after) => { const i = h('input', { class: 'field', value: m[key] || '', maxlength: String(max) }); i.onchange = () => { m[key] = i.value.trim(); saveMeta(); if (after) after(); }; return i; };
        const nameIn = h('input', { class: 'field', value: proj.name, maxlength: '40' });
        nameIn.onchange = async () => {
          const n = nameIn.value.trim().replace(/[\/\\]/g, ''); if (!n || n === proj.name) { nameIn.value = proj.name; return; }
          if (fsx().exists(pdir(n))) { nameIn.value = proj.name; return msg(T('That name is taken'), T('Another project already has that name.')); }
          saveFile(); fsx().rename(pdir(proj.name), n); proj.name = n; m.name = n; saveMeta(); title.textContent = n; drawSide();
        };
        const lang = h('select', { class: 'field' }, h('option', { value: 'pitcode' }, 'PitCode (.pitx, .pit, .pitoss)'), h('option', { value: 'web' }, 'HTML + JavaScript')); lang.value = m.language;
        lang.onchange = () => { m.language = lang.value; if (!proj.files[m.entry]) m.entry = m.language === 'pitcode' ? (Object.keys(proj.files).find((f) => /\.pitx?$/.test(f)) || 'main.pitx') : (proj.files['index.html'] != null ? 'index.html' : Object.keys(proj.files).find((f) => /\.html$/.test(f)) || 'index.html'); saveMeta(); drawAll(); };
        const entry = h('select', { class: 'field' }, ...Object.keys(proj.files).filter((f) => (m.language === 'pitcode' ? /\.pitx?$/ : /\.html$/).test(f)).map((f) => h('option', { value: f }, f))); entry.value = m.entry;
        entry.onchange = () => { m.entry = entry.value; saveMeta(); drawSide(); };
        const color = h('input', { type: 'color', value: m.color || '#0a84ff', 'aria-label': T('Color') }); color.onchange = () => { m.color = color.value; saveMeta(); drawPreviewIcon(); };
        const icon = txt('icon', 4, drawPreviewIcon); icon.style.width = '90px';
        const num = (key, lo, hi) => { const i = h('input', { class: 'field', type: 'number', min: lo, max: hi, value: m[key], style: { width: '100px' } }); i.onchange = () => { m[key] = Math.max(lo, Math.min(hi, +i.value || lo)); i.value = m[key]; saveMeta(); }; return i; };
        const permRows = PERMS.map((p) => { const c = h('input', { type: 'checkbox' }); c.checked = m.permissions.indexOf(p) >= 0; c.onchange = () => { m.permissions = PERMS.filter((q) => (q === p ? c.checked : m.permissions.indexOf(q) >= 0)); saveMeta(); }; return h('label', { class: 'ps-perm' }, c, h('span', {}, h('b', {}, P.permInfo(p)[0]), h('small', {}, P.permInfo(p)[1]))); });
        const pi = h('div', { class: 'ps-pic' }); function drawPreviewIcon() { pi.innerHTML = ''; const t = h('div', { class: 'as-ic', html: '<div class="icon-tile" style="background:linear-gradient(160deg,rgba(255,255,255,.28),rgba(0,0,0,.22)),' + PatOS.esc(m.color || '#0a84ff') + '"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><text x="32" y="44" font-size="34" font-family="system-ui,sans-serif" text-anchor="middle" fill="#fff">' + PatOS.esc(m.icon || '?') + '</text></svg></div>' }); pi.appendChild(t); } drawPreviewIcon();
        const del = h('button', { class: 'btn danger' }, T('Delete Project…')); del.onclick = async () => { if (!(await PatOS.confirmBox(T('Delete') + ' “' + proj.name + '”?', T('The project folder goes to the Trash. An app you installed from it stays installed.'), { ok: T('Delete'), danger: true, icon: 'pitstudio' }))) return; fsx().remove(pdir(proj.name)); closeProject(); };
        settings.append(
          h('h2', {}, T('Project Settings')),
          h('div', { class: 'ps-grid' }, field(T('App name'), nameIn), field(T('Identifier'), txt('id', 49), T('Like com.maya.timer. Keep it the same for updates.')), field(T('Version'), txt('version', 14), T('Like 1.0.0. Raise it when you update.')), field(T('Your name'), txt('author', 40)), field(T('What it does'), txt('description', 300))),
          h('div', { class: 'ps-grid' }, field(T('Icon'), h('div', { class: 'ps-row' }, pi, icon, color), T('An emoji or a letter, and a color.')), field(T('Language'), lang, T('PitCode is the language from github.com/monsieurpit/PitCode.')), field(T('Start file'), entry), field(T('Window size'), h('div', { class: 'ps-row' }, num('width', 240, 1600), '×', num('height', 200, 1200)))),
          h('h3', {}, T('Permissions')), h('p', { class: 'ps-note' }, T('Tick only what the app really needs. People are asked again, on their device, the first time it is used.')), h('div', { class: 'ps-perms' }, ...permRows),
          h('h3', {}, T('Danger zone')), del);
      }

      /* run, build */
      function stopRun() { if (run) { run.stop(); run = null; } stage.innerHTML = ''; stage.appendChild(h('div', { class: 'ps-hint' }, T('Press Run to start your app here.'))); win.el.classList.remove('ps-running'); }
      async function doRun() {
        if (!proj) return; saveFile(); stopRun(); cons.innerHTML = ''; win.el.classList.add('ps-show-prev');
        let app; try { app = toApp(proj); } catch (e) { say(String(e.message || e), true); return; }
        stage.innerHTML = '';
        try { run = await P.mount(app, stage, win, { onConsole: say }); win.el.classList.add('ps-running'); say(T('Started') + ' ' + app.name + ' ' + app.version, false); }
        catch (e) { say(String((e && e.message) || e), true); }
      }
      bRun.onclick = doRun; bStop.onclick = () => { stopRun(); say(T('Stopped'), false); };
      async function buildMenu() {
        const r = bBuild.getBoundingClientRect();
        PatOS.menu([
          { label: T('Install on this PatOS'), action: async () => { try { const app = toApp(proj); if (await P.install(app, { source: 'file' })) PatOS.notify({ title: T('Installed'), body: app.name, icon: 'pitstudio' }); } catch (e) { fail(e); } } },
          { label: T('Save .patapp in the project'), action: () => { try { const app = toApp(proj); const f = pdir(proj.name) + '/' + app.id + '.patapp'; fsx().write(f, JSON.stringify(app, null, 2)); PatOS.notify({ title: T('Saved'), body: app.id + '.patapp', icon: 'pitstudio' }); } catch (e) { fail(e); } } },
          { label: T('Download .patapp'), action: () => { try { const app = toApp(proj); PatOS.downloadFile(app.id + '.patapp', JSON.stringify(app, null, 2)); } catch (e) { fail(e); } } },
          { divider: true },
          { label: T('Send for review…'), action: async () => { try { const app = toApp(proj); if (!(await PatOS.confirmBox(T('Send') + ' “' + app.name + '” ' + T('for review?'), T('The owner of this PatOS reads the app and decides. If it is accepted, it shows up in Community for everyone who uses this server. You can follow its status below.'), { ok: T('Send'), icon: 'pitstudio' }))) return; await P.submit(app); PatOS.notify({ title: T('Sent for review'), body: app.name, icon: 'pitstudio' }); } catch (e) { fail(e); } } }
        ], r.left, r.bottom + 4);
      }
      bBuild.onclick = buildMenu;
      bPrev.onclick = () => win.el.classList.toggle('ps-show-prev'); bFiles.onclick = () => win.el.classList.toggle('ps-show-side');
      win.el.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doRun(); } else if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveFile(); } });

      /* showing things */
      function drawAll() {
        drawSide(); title.textContent = proj.name;
        const code = view === 'code'; codeBox.style.display = code ? '' : 'none'; settings.style.display = code ? 'none' : '';
        if (code) {
          if (cur == null || proj.files[cur] == null) cur = proj.files[proj.meta.entry] != null ? proj.meta.entry : Object.keys(proj.files)[0];
          codeBox.firstChild.textContent = cur || ''; ed.set(cur ? proj.files[cur] : '', cur ? optsFor(cur) : null); ed.ta.disabled = !cur; checkNow();
        } else drawSettings();
      }
      function open(name) {
        const p = loadProject(name); if (!p) return fail(new Error(T('That project could not be opened.')));
        stopRun(); proj = p; cur = null; view = 'code'; win.setTitle('PitCode Studio'); drawProject(); drawAll();
      }
      function drawProject() { root.innerHTML = ''; root.append(main); bRun.style.display = bStop.style.display = bBuild.style.display = bPrev.style.display = ''; bFiles.style.display = ''; }
      function closeProject() { saveFile(); stopRun(); proj = null; cur = null; welcome(); }
      bProjects.onclick = () => { if (proj) closeProject(); else welcome(); };

      /* the first screen: new project or open one */
      function welcome() {
        root.innerHTML = ''; title.textContent = ''; bRun.style.display = bStop.style.display = bBuild.style.display = bPrev.style.display = 'none'; bFiles.style.display = 'none';
        let lang = 'pitcode', tpl = 'blank'; const nameIn = h('input', { class: 'field', value: T('My App'), maxlength: '40', 'aria-label': T('App name') });
        const langRow = h('div', { class: 'ps-seg' }); const tplRow = h('div', { class: 'ps-tpls' });
        const drawTpl = () => {
          langRow.innerHTML = ''; [['pitcode', 'PitCode'], ['web', 'HTML + JavaScript']].forEach(([k, l]) => langRow.appendChild(h('button', { class: 'btn' + (lang === k ? ' primary' : ''), onclick: () => { lang = k; tpl = 'blank'; drawTpl(); } }, l)));
          tplRow.innerHTML = ''; TEMPLATES[lang].forEach((t) => tplRow.appendChild(h('button', { class: 'ps-tpl' + (tpl === t.id ? ' on' : ''), onclick: () => { tpl = t.id; drawTpl(); } }, h('b', {}, T(t.name)), h('small', {}, T(t.note)))));
        };
        const make = h('button', { class: 'btn primary' }, T('Create Project'));
        make.onclick = () => { const n = nameIn.value.trim().replace(/[\/\\]/g, '') || T('My App'); try { mkdirs(ROOT); open(newProject({ name: n, language: lang, template: tpl })); } catch (e) { fail(e); } };
        nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') make.click(); });
        const list = listProjects().sort((a, b) => b.mtime - a.mtime);
        const mine = h('div', { class: 'ps-projects' }, ...(list.length ? list.map((p) => { const b = h('button', { class: 'ps-proj', onclick: () => open(p.name) }, h('div', { class: 'as-ic', html: '<div class="icon-tile" style="background:linear-gradient(160deg,rgba(255,255,255,.28),rgba(0,0,0,.22)),' + PatOS.esc(p.meta.color || '#0a84ff') + '"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><text x="32" y="44" font-size="34" font-family="system-ui,sans-serif" text-anchor="middle" fill="#fff">' + PatOS.esc(p.meta.icon || '?') + '</text></svg></div>' }), h('div', {}, h('b', {}, p.name), h('small', {}, (p.meta.language === 'pitcode' ? 'PitCode' : 'HTML + JavaScript') + ' · ' + p.meta.version))); return b; }) : [h('p', { class: 'ps-note' }, T('No projects yet. Make your first app on the left.'))]));
        drawTpl();
        root.appendChild(h('div', { class: 'ps-welcome' },
          h('div', { class: 'ps-wcol' }, h('h1', {}, 'PitCode Studio'), h('p', { class: 'ps-note' }, T('Make apps for PatOS, like Xcode. Write in PitCode (your own language) or in HTML and JavaScript, run the app right here, then install it or send it to the store.')),
            h('label', { class: 'ps-field' }, h('span', {}, T('App name')), nameIn), h('div', { class: 'ps-field' }, h('span', {}, T('Language')), langRow), h('div', { class: 'ps-field' }, h('span', {}, T('Start from')), tplRow), make,
            h('p', { class: 'ps-note' }, T('Projects are folders in Documents › Studio, so Backup and Sync keep them safe. Learn the SDK in the App Store, Develop tab.'))),
          h('div', { class: 'ps-wcol' }, h('h2', {}, T('Your projects')), mine)));
      }

      win.on('closed', () => { saveFile(); stopRun(); });
      win._open = open;
      if (args && args.project && readMeta(args.project)) open(args.project); else welcome();
    },
    onArgs(win, a) { if (a.project && win._open) win._open(a.project); }
  });
  PatOS.iconDefs.pitstudio = { bg: 'linear-gradient(160deg,#0e6a7e,#0b2e38)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M22 20 12 32l10 12M42 20l10 12-10 12" stroke="#7ff0e0" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 16 28 48" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>' };
  PatOS.studio = { TEMPLATES, buildHtml, loadProject, newProject, listProjects, toApp };
})();
