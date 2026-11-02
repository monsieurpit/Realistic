/* Code Studio — HTML/CSS/JS playground with live preview */
(function () {
  'use strict';
  const { h } = PatOS;
  const TEMPLATES = {
    'Hello World': { html: '<h1>Hello, PatOS!</h1>\n<p>Edit the code on the left. The page updates as you type.</p>\n<button id="btn">Click me</button>', css: 'body { font-family: system-ui; padding: 30px; background: linear-gradient(135deg, #7d5cff, #ff4fa0); color: white; min-height: 100vh; margin: 0; }\nh1 { font-size: 48px; margin: 0 0 10px; }\nbutton { font-size: 18px; padding: 10px 22px; border: 0; border-radius: 12px; cursor: pointer; }', js: "let n = 0;\ndocument.getElementById('btn').onclick = (e) => {\n  n++;\n  e.target.textContent = 'Clicked ' + n + (n === 1 ? ' time' : ' times');\n};" },
    'Bouncing Balls': { html: '<canvas id="c"></canvas>', css: 'body { margin: 0; background: #0b0b14; overflow: hidden; }\ncanvas { display: block; }', js: "const c = document.getElementById('c'), x = c.getContext('2d');\nconst fit = () => { c.width = innerWidth; c.height = innerHeight; }; fit(); onresize = fit;\nconst balls = Array.from({ length: 40 }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, r: 6 + Math.random() * 18, h: Math.random() * 360 }));\n(function loop() {\n  x.fillStyle = 'rgba(11,11,20,.25)'; x.fillRect(0, 0, c.width, c.height);\n  for (const b of balls) {\n    b.x += b.vx; b.y += b.vy;\n    if (b.x < b.r || b.x > c.width - b.r) b.vx *= -1;\n    if (b.y < b.r || b.y > c.height - b.r) b.vy *= -1;\n    x.fillStyle = `hsl(${b.h},90%,60%)`; x.beginPath(); x.arc(b.x, b.y, b.r, 0, 7); x.fill();\n  }\n  requestAnimationFrame(loop);\n})();" },
    'To-Do App': { html: '<h2>My To-Do List</h2>\n<form id="f"><input id="t" placeholder="Add a task"><button>Add</button></form>\n<ul id="list"></ul>', css: 'body { font-family: system-ui; max-width: 420px; margin: 30px auto; padding: 0 16px; }\ninput { padding: 8px; width: 70%; }\nli { padding: 8px 0; cursor: pointer; }\nli.done { text-decoration: line-through; opacity: .5; }', js: "const list = document.getElementById('list');\ndocument.getElementById('f').onsubmit = (e) => {\n  e.preventDefault();\n  const t = document.getElementById('t');\n  if (!t.value) return;\n  const li = document.createElement('li');\n  li.textContent = t.value;\n  li.onclick = () => li.classList.toggle('done');\n  list.appendChild(li); t.value = '';\n};" },
    'Blank': { html: '', css: '', js: '' }
  };
  PatOS.registerApp({
    id: 'code', name: 'Code Studio', icon: 'code', width: 1080, height: 660, dark: true, category: 'Utilities', keywords: 'programming html css javascript coding editor ide',
    about: 'A live HTML, CSS and JavaScript playground.',
    launch(win, args) {
      win.el.classList.add('has-toolbar');
      let proj = PatOS.store.get('codeProject', null) || Object.assign({}, TEMPLATES['Hello World']);
      let tab = 'html';
      const seg = h('div', { class: 'seg' });
      ['html', 'css', 'js'].forEach((k) => seg.appendChild(h('button', { class: 'tab', 'data-k': k, onclick: () => { tab = k; sync(); } }, k.toUpperCase())));
      const tpl = h('select', { class: 'field' }, h('option', { value: '' }, 'Templates…'), ...Object.keys(TEMPLATES).map((k) => h('option', { value: k }, k)));
      tpl.onchange = () => { if (!tpl.value) return; proj = Object.assign({}, TEMPLATES[tpl.value]); tpl.value = ''; sync(); run(); save(); };
      const bRun = h('button', { class: 'btn primary' }, '▶ Run');
      const bSave = h('button', { class: 'tbtn', title: 'Save as .html in Documents' }, '💾');
      const bOpen = h('button', { class: 'tbtn', title: 'Open the page in Patoogle' }, '↗');
      const auto = h('label', { class: 'cs-auto' }, h('input', { type: 'checkbox', checked: true }), ' Live');
      win.toolbar.append(seg, tpl, h('div', { style: { flex: 1 } }), auto, bOpen, bSave, bRun);
      win.toolbar.style.justifyContent = 'flex-start'; win.toolbar.style.paddingLeft = '76px';
      const gutter = h('div', { class: 'cs-gutter' });
      const ta = h('textarea', { class: 'cs-code', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' });
      const editor = h('div', { class: 'cs-editor' }, gutter, ta);
      const frame = h('iframe', { class: 'cs-frame', sandbox: 'allow-scripts allow-modals allow-forms' });
      const consoleEl = h('div', { class: 'cs-console' });
      const right = h('div', { class: 'cs-right' }, frame, consoleEl);
      win.body.appendChild(h('div', { class: 'cs-wrap' }, editor, right));
      const save = PatOS.debounce(() => PatOS.store.set('codeProject', proj), 400);
      function lines() { const n = ta.value.split('\n').length; gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
      function sync() { [...seg.children].forEach((b) => b.classList.toggle('on', b.dataset.k === tab)); ta.value = proj[tab]; lines(); }
      function doc() {
        const hook = `<script>(function(){const send=(t,a)=>parent.postMessage({patosConsole:1,t,m:[].map.call(a,x=>{try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')},'*');['log','warn','error','info'].forEach(k=>{const o=console[k];console[k]=function(){send(k,arguments);o.apply(console,arguments)}});addEventListener('error',e=>send('error',[e.message+' (line '+e.lineno+')']));})();<\/script>`;
        return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${hook}<style>${proj.css}</style></head><body>${proj.html}<script>${proj.js.replace(/<\/script/gi, '<\\/script')}<\/script></body></html>`;
      }
      function run() { consoleEl.innerHTML = ''; frame.srcdoc = doc(); }
      const onMsg = (e) => { if (e.source === frame.contentWindow && e.data && e.data.patosConsole) { consoleEl.appendChild(h('div', { class: 'cs-log ' + e.data.t }, (e.data.t === 'error' ? '✖ ' : '› ') + e.data.m)); consoleEl.scrollTop = 1e9; } };
      window.addEventListener('message', onMsg);
      const live = PatOS.debounce(() => { if (auto.firstChild.checked) run(); }, 600);
      ta.addEventListener('input', () => { proj[tab] = ta.value; lines(); save(); live(); });
      ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
        const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
        if (pairs[e.key] && ta.selectionStart === ta.selectionEnd) { e.preventDefault(); document.execCommand('insertText', false, e.key + pairs[e.key]); ta.selectionStart = ta.selectionEnd = ta.selectionStart - 1; }
        if (e.key === 'Enter') { const before = ta.value.slice(0, ta.selectionStart); const indent = (before.split('\n').pop().match(/^\s*/) || [''])[0]; const extra = /[{([>]$/.test(before.trim()) ? '  ' : ''; e.preventDefault(); document.execCommand('insertText', false, '\n' + indent + extra); }
        if ((e.ctrlKey || e.altKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      });
      bRun.onclick = run;
      bSave.onclick = async () => { const nm = await PatOS.ask('Save project as', 'my-page.html', { icon: 'code', ok: 'Save', text: 'Saved in Documents. Double-click it to open it in Patoogle.' }); if (!nm) return; PatOS.fs.write('/Documents/' + (nm.endsWith('.html') ? nm : nm + '.html'), doc()); PatOS.notify({ title: 'Project saved', body: nm, icon: 'code' }); };
      bOpen.onclick = () => PatOS.launch('browser', { html: doc(), title: 'Code Studio preview' });
      win.on('closed', () => window.removeEventListener('message', onMsg));
      sync(); run();
    }
  });
})();
