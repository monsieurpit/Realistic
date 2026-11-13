/* Pat code suggestions (PatOS Intelligence for code): completes PitCode (.pitx, .pit), PitCode styles (.pitoss), HTML,
   CSS, JavaScript and JSON as you type. Rules only, no AI model: the words of the language, the PatOS app API, snippets for
   the usual shapes, the names already in your file, HTML tags and their attributes, CSS properties and their values, and
   closing tags. Nothing leaves the device.
   PatOS.codesense.suggest(text, caret, lang) → { from, prefix, items: [{ label, insert, kind, detail, caret? }] }
     insert may hold "|" where the caret should land (it is removed); from..caret is the text an item replaces. */
(function () {
  'use strict';
  const uniq = (a) => [...new Set(a)];
  const KW = {
    pitcode: ['pit', 'lock', 'back', 'say', 'when', 'orwhen', 'other', 'loop', 'in', 'stop', 'skip', 'and', 'or', 'not', 'is', 'true', 'false', 'nil', 'kind', 'me', 'up', 'match', 'attempt', 'rescue', 'always', 'raise', 'wait', 'give', 'use', 'share', 'next', 'store', 'draw', 'start'],
    js: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'class', 'extends', 'this', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'document', 'window', 'console', 'patos', 'Math', 'JSON', 'Array', 'Object', 'String', 'Number', 'Promise', 'setTimeout', 'setInterval', 'addEventListener', 'querySelector', 'querySelectorAll', 'getElementById', 'textContent', 'innerHTML', 'classList', 'forEach', 'map', 'filter', 'reduce', 'push', 'length', 'includes', 'indexOf', 'slice', 'split', 'join', 'trim', 'toFixed', 'parseInt', 'parseFloat', 'fetch', 'then', 'localStorage']
  };
  // members after a dot: obj. → what it has
  const MEMBERS = {
    console: ['log', 'warn', 'error', 'info', 'table', 'clear'],
    document: ['getElementById', 'querySelector', 'querySelectorAll', 'createElement', 'body', 'title', 'addEventListener'],
    Math: ['round', 'floor', 'ceil', 'random', 'min', 'max', 'abs', 'sqrt', 'pow', 'PI'],
    JSON: ['parse', 'stringify'],
    patos: ['storage', 'notify', 'app', 'files', 'clipboard', 'theme'],
    'patos.storage': ['get', 'set', 'remove', 'keys'],
    'patos.app': ['name', 'id', 'version'],
    'js.patos': ['storage', 'notify', 'app', 'files', 'clipboard'],
    'js.patos.storage': ['get', 'set', 'remove', 'keys'],
    'js.patos.app': ['name', 'id', 'version'],
    classList: ['add', 'remove', 'toggle', 'contains'],
    _any: ['length', 'map', 'filter', 'forEach', 'push', 'includes', 'join', 'slice', 'split', 'trim', 'toUpperCase', 'toLowerCase', 'then', 'textContent', 'value', 'style', 'classList', 'addEventListener']
  };
  const CALLS = { log: '(|)', warn: '(|)', error: '(|)', get: '("|")', set: '("|", )', notify: '({ title: "|" })', getElementById: '("|")', querySelector: '("|")', querySelectorAll: '("|")', createElement: '("|")', addEventListener: '("|", () => {\n  \n})', map: '((x) => |)', filter: '((x) => |)', forEach: '((x) => {\n  |\n})', round: '(|)', floor: '(|)', random: '()|', parse: '(|)', stringify: '(|)', includes: '(|)', join: '("|")', split: '("|")', push: '(|)', add: '("|")', remove: '("|")', toggle: '("|")', contains: '("|")', then: '((v) => {\n  |\n})' };
  const SNIP = {
    pitcode: [
      ['when', 'when | {\n  \n}', 'when … { }'], ['orwhen', 'orwhen | {\n  \n}', 'orwhen … { }'], ['other', 'other {\n  |\n}', 'other { }'],
      ['loop', 'loop item in | {\n  \n}', 'loop … in … { }'], ['attempt', 'attempt {\n  |\n} rescue err {\n  say(err)\n}', 'attempt / rescue'],
      ['match', 'match | {\n  \n}', 'match … { }'], ['pit', 'pit | = ', 'a new variable'], ['store', 'store({|})', 'state the page redraws from'],
      ['start', 'start() => {\n  |\n}', 'runs when the app opens'], ['draw', 'draw(|)', 'shows a page'], ['say', 'say(|)', 'prints to the console'],
      ['wait', 'wait |', 'waits for an answer'], ['fn', '|() => {\n  \n}', 'a function']
    ],
    js: [
      ['function', 'function |() {\n  \n}', 'function'], ['if', 'if (|) {\n  \n}', 'if'], ['ife', 'if (|) {\n  \n} else {\n  \n}', 'if / else'],
      ['for', 'for (let i = 0; i < |; i++) {\n  \n}', 'for loop'], ['forof', 'for (const item of |) {\n  \n}', 'for … of'],
      ['while', 'while (|) {\n  \n}', 'while'], ['try', 'try {\n  |\n} catch (e) {\n  console.error(e);\n}', 'try / catch'],
      ['arrow', '(|) => {\n  \n}', 'arrow function'], ['log', 'console.log(|);', 'console.log'], ['timeout', 'setTimeout(() => {\n  |\n}, 1000);', 'setTimeout'],
      ['click', '.addEventListener("click", () => {\n  |\n});', 'on click'], ['class', 'class | {\n  constructor() {\n    \n  }\n}', 'class'],
      ['fetch', 'fetch("|").then((r) => r.json()).then((data) => {\n  \n});', 'fetch JSON'], ['save', 'patos.storage.set("|", );', 'save a value'], ['load', 'patos.storage.get("|").then((v) => {\n  \n});', 'read a saved value']
    ]
  };
  const TAGS = ['div', 'span', 'p', 'a', 'h1', 'h2', 'h3', 'h4', 'button', 'input', 'label', 'form', 'select', 'option', 'textarea', 'img', 'ul', 'ol', 'li', 'main', 'section', 'header', 'footer', 'nav', 'article', 'aside', 'strong', 'em', 'small', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'canvas', 'video', 'audio', 'script', 'style', 'link', 'meta', 'br', 'hr', 'pre', 'code', 'details', 'summary', 'dialog', 'svg', 'template'];
  const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area', 'col', 'wbr']);
  const ATTR = { _: ['class', 'id', 'style', 'title', 'hidden', 'onclick', 'aria-label', 'role', 'tabindex', 'data-'],
    a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading'], input: ['type', 'name', 'value', 'placeholder', 'checked', 'disabled', 'min', 'max', 'step', 'required', 'autofocus'],
    button: ['type', 'disabled'], form: ['action', 'method'], label: ['for'], link: ['rel', 'href'], script: ['src', 'type', 'defer'], meta: ['name', 'content', 'charset'],
    select: ['name', 'multiple'], option: ['value', 'selected'], textarea: ['rows', 'cols', 'placeholder', 'name'], video: ['src', 'controls', 'autoplay', 'loop', 'muted'], audio: ['src', 'controls', 'autoplay', 'loop'], canvas: ['width', 'height'] };
  const ATTRVAL = { type: ['text', 'button', 'submit', 'checkbox', 'radio', 'number', 'email', 'password', 'range', 'color', 'date', 'file'], target: ['_blank', '_self'], rel: ['stylesheet', 'noopener'], loading: ['lazy', 'eager'], method: ['get', 'post'] };
  const CSSP = { display: ['flex', 'grid', 'block', 'inline-block', 'inline', 'none'], position: ['relative', 'absolute', 'fixed', 'sticky', 'static'], 'flex-direction': ['row', 'column'], 'justify-content': ['center', 'space-between', 'space-around', 'flex-start', 'flex-end'], 'align-items': ['center', 'flex-start', 'flex-end', 'stretch'], 'text-align': ['center', 'left', 'right'], 'font-weight': ['400', '500', '600', '700', 'bold'], cursor: ['pointer', 'default', 'text'], overflow: ['hidden', 'auto', 'scroll', 'visible'], 'box-sizing': ['border-box'], 'font-family': ['system-ui, sans-serif', 'ui-monospace, monospace', 'Georgia, serif'], color: ['var(--patos-accent)', '#ffffff', '#000000'], background: ['var(--patos-accent)', 'transparent', '#ffffff'], margin: ['0', 'auto', '0 auto'], padding: ['0', '8px', '12px', '20px'], 'border-radius': ['8px', '12px', '50%'], border: ['0', '1px solid #8884'], width: ['100%', 'auto'], height: ['100%', 'auto'], gap: ['8px', '12px'], transition: ['all .2s ease'], 'box-shadow': ['0 4px 12px rgba(0,0,0,.2)'], 'font-size': ['14px', '16px', '24px', '32px'], opacity: ['0', '.5', '1'], 'grid-template-columns': ['repeat(3, 1fr)', '1fr 1fr'], 'z-index': ['1', '10'], 'line-height': ['1.4', '1.6'], 'object-fit': ['cover', 'contain'], 'white-space': ['nowrap', 'pre'], 'user-select': ['none'], 'pointer-events': ['none', 'auto'], transform: ['scale(1.05)', 'translateY(-2px)'], animation: [], 'max-width': ['100%'], 'min-height': ['100vh'], 'flex-wrap': ['wrap'], flex: ['1'], 'aspect-ratio': ['1', '16 / 9'] };
  // PitCode styles: the friendly names it adds (vendor/pitcode.js) next to the usual ones; no ":" and plain numbers mean pixels
  const PITOSS = { 'text-color': ['#ffffff', '#000000'], corners: ['8', '12'], arrange: ['center', 'space-between', 'start', 'end'], align: ['center', 'start', 'end'], flow: ['row', 'column'], wrap: ['wrap'], stack: ['1', '10'], shadow: ['0 4 12 #0003'], 'column-sizes': ['1fr 1fr'], 'row-sizes': ['auto 1fr'], fit: ['cover', 'contain'], ratio: ['1', '16 / 9'], clicks: ['none'], select: ['none'], weight: ['600', '700'] };

  const word = (s) => (s.match(/[A-Za-z_$][\w$-]*$/) || [''])[0];
  function docWords(text, prefix) { const m = text.match(/[A-Za-z_$][\w$]{2,}/g) || []; const c = {}; m.forEach((w) => { if (w !== prefix) c[w] = (c[w] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]); }
  const rank = (list, prefix) => { const p = prefix.toLowerCase(); return list.filter((x) => x.label.toLowerCase().startsWith(p) && x.label !== prefix); };
  const it = (label, insert, kind, detail) => ({ label, insert: insert == null ? label : insert, kind, detail: detail || '' });

  function openTags(before) { // the tags still open before the caret, innermost last
    const st = []; const re = /<(\/?)([a-zA-Z][\w-]*)[^<>]*?(\/?)>/g; let m;
    while ((m = re.exec(before))) { const t = m[2].toLowerCase(); if (m[1]) { const i = st.lastIndexOf(t); if (i >= 0) st.length = i; } else if (!m[3] && !VOID.has(t)) st.push(t); }
    return st;
  }
  function html(text, pos) {
    const before = text.slice(0, pos), line = before.slice(before.lastIndexOf('\n') + 1);
    let m;
    if ((m = before.match(/<\/([\w-]*)$/))) { const st = openTags(before.slice(0, before.length - m[0].length)); const t = st[st.length - 1]; return t ? { from: pos - m[1].length, prefix: m[1], items: [it(t, t + '>', 'tag', 'close')] } : null; }
    if ((m = before.match(/<([\w-]*)$/))) return { from: pos - m[1].length, prefix: m[1], items: rank(TAGS.map((t) => it(t, VOID.has(t) ? t + (t === 'img' ? ' src="|" alt="">' : t === 'input' ? ' type="|">' : t === 'link' ? ' rel="stylesheet" href="|">' : '>|') : t + '>|</' + t + '>', 'tag')), m[1]) };
    if ((m = before.match(/<([\w-]+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s+([\w-]*)$/))) { const tag = m[1].toLowerCase(); const have = new Set((m[2].match(/[\w-]+(?==|\s|$)/g) || [])); return { from: pos - m[3].length, prefix: m[3], items: rank(uniq([...(ATTR[tag] || []), ...ATTR._]).filter((a) => !have.has(a)).map((a) => it(a, /^(hidden|checked|disabled|required|autofocus|controls|autoplay|loop|muted|multiple|selected|defer)$/.test(a) ? a : a + '="|"', 'attr')), m[3]) }; }
    if ((m = before.match(/\s([\w-]+)="([^"]*)$/)) && ATTRVAL[m[1]]) return { from: pos - m[2].length, prefix: m[2], items: rank(ATTRVAL[m[1]].map((v) => it(v, v, 'value')), m[2]) };
    // a short way to write tags (like Emmet): div.card, ul>li*3, button#go
    if ((m = line.match(/(?:^|\s)([a-z][\w]*(?:[.#][\w-]+)*(?:>[a-z][\w]*(?:[.#][\w-]+)*(?:\*\d+)?)*)$/)) && /[.#>*]/.test(m[1]) && TAGS.includes(m[1].split(/[.#>*]/)[0])) {
      const one = (s) => { const [, t, rest] = s.match(/^([a-z]\w*)(.*)$/); const cls = (rest.match(/\.[\w-]+/g) || []).map((x) => x.slice(1)), id = (rest.match(/#[\w-]+/) || [''])[0].slice(1); return { t, a: (id ? ' id="' + id + '"' : '') + (cls.length ? ' class="' + cls.join(' ') + '"' : '') }; };
      const build = (parts) => { if (!parts.length) return '|'; const [p0, ...rest] = parts; const n = +((p0.match(/\*(\d+)$/) || [0, 1])[1]); const o = one(p0.replace(/\*\d+$/, '')); let out = ''; for (let i = 0; i < Math.min(n, 20); i++) out += '<' + o.t + o.a + '>' + (VOID.has(o.t) ? '' : build(rest).replace(i ? /\|/g : /(?!)/, '') + '</' + o.t + '>'); return out; };
      const ins = build(m[1].split('>')); return { from: pos - m[1].length, prefix: m[1], items: [it(m[1], ins.includes('|') ? ins : ins + '|', 'snippet', 'expand')], expand: true };
    }
    const w = word(before); if (!w) return null;
    return { from: pos - w.length, prefix: w, items: rank(docWords(text, w).map((x) => it(x, x, 'word')), w).slice(0, 8) };
  }
  function css(text, pos, pit) {
    const before = text.slice(0, pos), line = before.slice(before.lastIndexOf('\n') + 1);
    const props = pit ? Object.assign({}, CSSP, PITOSS) : CSSP; let m;
    if (pit && (m = line.match(/^\s*([\w-]*)$/)) && !/\{\s*$/.test(line)) { // pitoss: "style" to start a rule, or a property
      const it2 = rank([it('style', 'style | {\n  \n}', 'snippet', 'a rule'), ...Object.keys(props).map((p) => it(p, p + ': |', 'prop', PITOSS[p] ? 'PitCode' : ''))], m[1]);
      return { from: pos - m[1].length, prefix: m[1], items: it2 };
    }
    if ((m = line.match(/^\s*([\w-]*)$/))) return { from: pos - m[1].length, prefix: m[1], items: rank(Object.keys(props).map((p) => it(p, p + ': |;', 'prop')), m[1]) };
    if ((m = line.match(/^\s*([\w-]+)\s*:\s*([^;]*)$/)) && props[m[1]]) { const v = (m[2].match(/[^\s]*$/) || [''])[0]; return { from: pos - v.length, prefix: v, items: (v ? rank : (l) => l)(props[m[1]].map((x) => it(x, x + (pit ? '' : ';'), 'value')), v) }; }
    return null;
  }
  function code(text, pos, lang) {
    const before = text.slice(0, pos); let m;
    if ((m = before.match(/([\w$]+(?:\.[\w$]+)*)\.([\w$]*)$/))) { // members
      const obj = m[1], last = obj.split('.').pop(); const list = MEMBERS[obj] || MEMBERS[last] || MEMBERS._any;
      return { from: pos - m[2].length, prefix: m[2], items: rank(list.map((x) => it(x, x + (CALLS[x] && lang === 'js' ? CALLS[x] : CALLS[x] && lang === 'pitcode' && /^(get|set|log)$/.test(x) ? CALLS[x] : ''), 'member', obj)), m[2]) };
    }
    if (lang === 'pitcode' && (m = before.match(/<([\w-]*)$/))) return html(text, pos); // pages in PitCode are HTML-like
    const w = word(before), ln = before.slice(before.lastIndexOf('\n') + 1).replace(/\\./g, '');
    if (!w || ['"', "'", '`'].some((q) => (ln.split(q).length - 1) % 2)) return null; // (not inside a string)
    const sn = (SNIP[lang] || []).map(([k, ins, d]) => Object.assign(it(k, ins, 'snippet', d)));
    const kw = (KW[lang] || []).filter((k) => !sn.some((s) => s.label === k)).map((k) => it(k, k, 'keyword'));
    const dw = docWords(text, w).filter((x) => !(KW[lang] || []).includes(x)).map((x) => it(x, x, 'word'));
    return { from: pos - w.length, prefix: w, items: rank([...sn, ...kw, ...dw], w).slice(0, 12) };
  }
  function langOf(name) { const e = (String(name).match(/\.(\w+)$/) || ['', ''])[1].toLowerCase(); return { pitx: 'pitcode', pit: 'pitcode', pitoss: 'pitoss', html: 'html', htm: 'html', css: 'css', js: 'js', mjs: 'js', json: 'json' }[e] || ''; }
  function suggest(text, pos, lang) {
    try {
      if (lang === 'html') { const before = text.slice(0, pos); const inScript = /<script[^>]*>(?![\s\S]*<\/script>)[\s\S]*$/i.test(before), inStyle = /<style[^>]*>(?![\s\S]*<\/style>)[\s\S]*$/i.test(before); return inScript ? code(text, pos, 'js') : inStyle ? css(text, pos, false) : html(text, pos); }
      if (lang === 'css') return css(text, pos, false);
      if (lang === 'pitoss') return css(text, pos, true);
      if (lang === 'js' || lang === 'pitcode') return code(text, pos, lang);
      if (lang === 'json') { const w = word(text.slice(0, pos)); return w ? { from: pos - w.length, prefix: w, items: rank(['true', 'false', 'null'].map((x) => it(x, x, 'keyword')), w) } : null; }
    } catch (e) { return null; }
    return null;
  }
  /* after typing ">" in HTML (or a PitCode page): the closing tag to put after the caret, or '' */
  function autoClose(text, pos, lang) {
    if (!(lang === 'html' || lang === 'pitcode')) return '';
    const m = text.slice(0, pos).match(/<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>$/); if (!m || /\/>$/.test(m[0]) || VOID.has(m[1].toLowerCase())) return '';
    if (text.slice(pos).startsWith('</' + m[1])) return '';
    return '</' + m[1] + '>';
  }
  PatOS.codesense = { suggest, autoClose, langOf };
})();

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

  /* ---------- a whole project in one file: .patappproject ----------
     { format: 'patappproject', formatVersion: 1, meta: { name, id, version, ... }, files: { 'main.pit': '...code...', ... } }
     Every file of the project is inside, with its code. The publisher key is never in it (it stays on your devices). */
  const FILE_NAME = /^[\w.-]{1,60}$/, LIMITS = { files: 60, file: 500000, total: 3000000 };
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  function exportProject(p) {
    const m = p.meta, meta = { name: m.name, id: m.id, version: m.version, author: m.author || '', description: m.description || '', icon: m.icon || '', color: m.color || '', permissions: (m.permissions || []).slice(), language: m.language, entry: m.entry, width: m.width, height: m.height };
    const files = {}; Object.keys(p.files).sort().forEach((f) => { files[f] = p.files[f]; });
    return { format: 'patappproject', formatVersion: 1, exported: new Date().toISOString().slice(0, 10), meta, files };
  }
  /* reads a .patappproject (as text) and checks everything; returns { meta, files } or throws a message a person can read */
  function parseProject(text) {
    let raw; try { raw = JSON.parse(text); } catch (e) { throw new Error(T('This is not a PatOS project file.')); }
    if (!raw || typeof raw !== 'object' || raw.format !== 'patappproject') throw new Error(T('This is not a PatOS project file.'));
    if (raw.formatVersion !== 1) throw new Error(T('This project was made for a different version of PitCode Studio.'));
    const src = raw.files; if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error(T('The project has no files.'));
    const names = Object.keys(src); if (!names.length) throw new Error(T('The project has no files.'));
    if (names.length > LIMITS.files) throw new Error(T('The project has too many files.'));
    const files = {}; let total = 0;
    names.forEach((n) => {
      if (!FILE_NAME.test(n) || !EXT_OK.test(n) || n === META) throw new Error(T('A file name in the project is not allowed:') + ' ' + n.slice(0, 40));
      if (typeof src[n] !== 'string') throw new Error(T('A file in the project is not text:') + ' ' + n);
      if (src[n].length > LIMITS.file) throw new Error(T('A file in the project is too big:') + ' ' + n);
      total += src[n].length; files[n] = src[n];
    });
    if (total > LIMITS.total) throw new Error(T('The project is too big.'));
    const m = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    const name = str(m.name, 40).replace(/[\/\\]/g, '') || T('My App');
    const language = m.language === 'web' || m.language === 'pitcode' ? m.language : (names.some((n) => /\.pitx?$/.test(n)) ? 'pitcode' : 'web');
    const startable = (language === 'pitcode' ? /\.pitx?$/ : /\.html$/);
    let entry = typeof m.entry === 'string' && files[m.entry] != null ? m.entry : (language === 'web' && files['index.html'] != null ? 'index.html' : (language === 'pitcode' ? (files['main.pitx'] != null ? 'main.pitx' : names.find((n) => /\.pitx$/.test(n)) || names.find((n) => /\.pit$/.test(n))) : names.find((n) => startable.test(n))));
    if (!entry) throw new Error(language === 'pitcode' ? T('There is no PitCode file to start from. Add a main.pitx.') : T('There is no index.html to start from.'));
    const id = window.PatAppFormat && window.PatAppFormat.ID.test(str(m.id, 60)) ? str(m.id, 60) : 'local.' + slug(name) + '.' + Math.random().toString(36).slice(2, 6);
    const num = (v, lo, hi, d) => (Number.isFinite(+v) && v !== '' && v != null ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
    const meta = { name, id, version: /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(str(m.version, 20)) ? str(m.version, 20) : '1.0.0', author: str(m.author, 40), description: str(m.description, 300), icon: Array.from(str(m.icon, 8)).slice(0, 2).join('') || '✨',
      color: /^#[0-9a-fA-F]{6}$/.test(m.color || '') ? m.color : colors[0], permissions: Array.isArray(m.permissions) ? PERMS.filter((q) => m.permissions.indexOf(q) >= 0) : [], language, entry, width: num(m.width, 240, 1600, 520), height: num(m.height, 200, 1200, 420) };
    return { meta, files };
  }
  /* puts a parsed project in Documents › Studio: as a new project, or over the project that has the same app id (how = 'replace' | 'copy' | 'new') */
  function placeProject(pr, how, existingName) {
    const meta = Object.assign({}, pr.meta); let folder;
    if (how === 'replace' && existingName) {
      const old = readMeta(existingName) || {}; if (old.published) meta.published = old.published;
      fsx().list(pdir(existingName)).forEach((x) => { if (x.type === 'file' && x.name !== META && !x.blob) fsx().remove(pdir(existingName) + '/' + x.name); });
      folder = existingName; if (meta.name !== existingName && !fsx().exists(pdir(meta.name))) { fsx().rename(pdir(existingName), meta.name); folder = meta.name; }
    } else {
      if (how === 'copy') meta.id = 'local.' + slug(meta.name) + '.' + Math.random().toString(36).slice(2, 6);
      let nm = meta.name, i = 2; while (fsx().exists(pdir(nm))) nm = meta.name + ' ' + i++; folder = nm; mkdirs(ROOT); mkdirs(pdir(folder));
    }
    meta.name = folder; fsx().write(pdir(folder) + '/' + META, JSON.stringify(meta, null, 2));
    Object.keys(pr.files).forEach((f) => fsx().write(pdir(folder) + '/' + f, pr.files[f]));
    return folder;
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
    /* Pat's suggestions: a list under the caret, and the rest of the best one shown faintly after it (Tab takes it) */
    const ICON = { snippet: '{ }', keyword: 'K', member: '.', word: 'W', tag: '<>', attr: '=', prop: 'P', value: 'V' };
    const ghost = h('span', { class: 'ps-ghost', 'aria-hidden': 'true' });
    const pop = h('div', { class: 'ps-ac', role: 'listbox', 'aria-label': T('Suggestions') });
    code.append(ghost); el.appendChild(pop);
    let sug = null, sel = 0, typed = false, picked = false, overs = []; // closing tags Pat wrote, which typing them again just walks through
    const on = () => PatOS.settings.codeSuggestions !== false && api.lang;
    let cw = 0; const charW = () => { if (cw) return cw; const m = h('span', { style: { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', font: getComputedStyle(ta).font } }, 'x'.repeat(40)); document.body.appendChild(m); cw = m.getBoundingClientRect().width / 40 || 7.8; m.remove(); return cw; };
    const caretXY = () => { const b = ta.value.slice(0, ta.selectionStart), line = b.split('\n').length - 1, col = b.length - b.lastIndexOf('\n') - 1; const cs = getComputedStyle(ta), lh = parseFloat(cs.lineHeight) || 19; return { x: parseFloat(cs.paddingLeft) + col * charW(), y: parseFloat(cs.paddingTop) + line * lh, lh }; };
    function hideSug() { sug = null; pop.classList.remove('on'); ghost.textContent = ''; }
    function showSug() {
      if (!on() || ta.selectionStart !== ta.selectionEnd) return hideSug();
      const r = PatOS.codesense.suggest(ta.value, ta.selectionStart, api.lang);
      if (!r || !r.items || !r.items.length || (!r.prefix && !r.expand && !/[.<]$|<\/$/.test(ta.value.slice(0, ta.selectionStart)) && !/:\s*$/.test(ta.value.slice(0, ta.selectionStart).split('\n').pop()))) return hideSug();
      sug = r; sel = 0; picked = false; pop.innerHTML = '';
      pop.appendChild(h('div', { class: 'ps-ac-head' }, h('i', { class: 'ps-ac-orb' }), T('Pat suggests'), h('small', {}, 'Tab')));
      r.items.slice(0, 8).forEach((x, i) => { const b = h('div', { class: 'ps-ac-it' + (i ? '' : ' on'), role: 'option', 'aria-selected': String(!i) }, h('b', { class: 'ps-ac-k k-' + x.kind }, ICON[x.kind] || '·'), h('span', { class: 'ps-ac-l' }, x.label), x.detail ? h('small', {}, T(x.detail)) : null);
        b.addEventListener('mousedown', (e) => { e.preventDefault(); sel = i; take(); }); pop.appendChild(b); });
      const p = caretXY(); pop.style.left = (gut.offsetWidth + p.x - r.prefix.length * charW() + 2) + 'px'; pop.style.top = (p.y + p.lh + 4) + 'px';
      pop.classList.add('on'); drawGhost(); if (pop.offsetTop + pop.offsetHeight > el.scrollTop + el.clientHeight && p.y - pop.offsetHeight - 4 > el.scrollTop) pop.style.top = (p.y - pop.offsetHeight - 4) + 'px';
    }
    function drawGhost() {
      ghost.textContent = ''; if (!sug) return; const x = sug.items[sel]; const plainIns = x.insert.replace('|', '');
      if (!sug.expand && plainIns.toLowerCase().startsWith(sug.prefix.toLowerCase())) { const rest = plainIns.slice(sug.prefix.length).split('\n')[0]; if (rest) { const p = caretXY(); ghost.textContent = rest; ghost.style.left = p.x + 'px'; ghost.style.top = p.y + 'px'; } }
    }
    function move(d) { if (!sug) return; picked = true; const n = Math.min(8, sug.items.length); sel = (sel + d + n) % n; [...pop.querySelectorAll('.ps-ac-it')].forEach((b, i) => { b.classList.toggle('on', i === sel); b.setAttribute('aria-selected', String(i === sel)); if (i === sel) b.scrollIntoView({ block: 'nearest' }); }); drawGhost(); }
    function take() {
      if (!sug) return false; const x = sug.items[sel], from = sug.from, to = ta.selectionStart;
      const ls = ta.value.lastIndexOf('\n', from - 1) + 1, indent = (ta.value.slice(ls, from).match(/^[ \t]*/) || [''])[0];
      const ins = x.insert.replace(/\n/g, '\n' + indent), at = ins.indexOf('|'), text = ins.replace('|', '');
      hideSug(); edit(from, to, text, at >= 0 ? from + at : from + text.length); typed = false; return true;
    }
    ta.addEventListener('blur', () => setTimeout(hideSug, 120));
    ta.addEventListener('click', hideSug);
    const render = () => {
      const src = ta.value; let html = '';
      const pit = window.PitCode;
      if (!plain && pit) { try { pit.highlight(src, opts).forEach((pc) => { html += pc.kind === 'plain' ? PatOS.esc(pc.text) : '<span class="ps-k-' + pc.kind + '">' + PatOS.esc(pc.text) + '</span>'; }); } catch (e) { html = PatOS.esc(src); } } else html = PatOS.esc(src);
      pre.innerHTML = html + '\n';
      const n = src.split('\n').length; if (gut.childElementCount !== n) { gut.innerHTML = ''; for (let i = 1; i <= n; i++) gut.appendChild(h('div', {}, String(i))); }
      ta.style.width = pre.offsetWidth + 'px'; ta.style.height = pre.offsetHeight + 'px';
    };
    // the line numbers stay put over the code: keep the caret from hiding under them
    const fixX = () => requestAnimationFrame(() => { const b = ta.value.slice(0, ta.selectionStart), col = b.length - b.lastIndexOf('\n') - 1, x = 14 + col * (cw || 7.8);
      if (x < el.scrollLeft + 8) el.scrollLeft = Math.max(0, x - 40); });
    ['keyup', 'click', 'focus'].forEach((ev) => ta.addEventListener(ev, fixX));
    const caretVisible = () => { fixX();
      const lh = parseFloat(getComputedStyle(ta).lineHeight) || 19; const line = ta.value.slice(0, ta.selectionStart).split('\n').length;
      const top = (line - 1) * lh + 10, bottom = top + lh + 10; const v = el.clientHeight;
      if (top < el.scrollTop) el.scrollTop = top - 10; else if (bottom > el.scrollTop + v) el.scrollTop = bottom - v;
    };
    const edit = (start, end, text, selStart, selEnd) => { ta.focus(); ta.setSelectionRange(start, end); if (!document.execCommand || !document.execCommand('insertText', false, text)) { ta.setRangeText(text, start, end, 'end'); ta.dispatchEvent(new Event('input')); } if (selStart != null) ta.setSelectionRange(selStart, selEnd == null ? selStart : selEnd); };
    ta.addEventListener('input', (e) => {
      render(); caretVisible(); onInput(ta.value);
      if (!on()) return;
      // typing ">" after an opening tag writes its closing tag
      if (e.data === '>' && ta.selectionStart === ta.selectionEnd) { const c = PatOS.codesense.autoClose(ta.value, ta.selectionStart, api.lang); if (c) { const at = ta.selectionStart; edit(at, at, c, at); overs.push({ len: c.length, tail: ta.value.length - at - c.length }); return hideSug(); } }
      if (e.inputType && /^insert/.test(e.inputType) && e.data != null) { typed = true; showSug(); } else hideSug();
    });
    ta.addEventListener('keydown', (e) => {
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      if (overs.length) { // (counted from the end of the file, so typing before them doesn't move them)
        if (s !== en || e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && /^[az]$/i.test(e.key))) overs = [];
        overs = overs.filter((o) => { const oEnd = v.length - o.tail; return s <= oEnd && oEnd - o.len >= 0; });
        const o = overs.find((x) => { const oEnd = v.length - x.tail; return s >= oEnd - x.len && s < oEnd; });
        if (o && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && v[s] === e.key) {
          e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); if (s + 1 >= v.length - o.tail) overs = overs.filter((x) => x !== o); if (e.key === '>') hideSug(); return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') { e.preventDefault(); typed = true; showSug(); if (!sug && on()) { const r = PatOS.codesense.suggest(v, s, api.lang); if (r && r.items.length) { sug = r; sel = 0; showSug(); } } return; }
      if (sug) {
        if (e.key === 'ArrowDown') { e.preventDefault(); return move(1); }
        if (e.key === 'ArrowUp') { e.preventDefault(); return move(-1); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return hideSug(); }
        if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); take(); return; }
        if (e.key === 'Enter' && !e.shiftKey && picked) { e.preventDefault(); take(); return; } // (Enter is a new line unless a suggestion was picked with the arrows)
        if (/^(ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(e.key)) hideSug();
      }
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
    const api = {
      lang: '', suggest: showSug, accept: take, hideSuggestions: hideSug, suggestions: () => sug,
      el, ta, focus: () => ta.focus(),
      set(text, o) { opts = o || {}; plain = !o; ta.value = text; render(); el.scrollTop = 0; el.scrollLeft = 0; },
      get: () => ta.value, rerender: render,
      goto(line, col) { const lines = ta.value.split('\n'); let off = 0; for (let i = 0; i < Math.min(line - 1, lines.length); i++) off += lines[i].length + 1; ta.focus(); ta.setSelectionRange(off + Math.max(0, col - 1), off + Math.max(0, col - 1)); caretVisible(); }
    };
    return api;
  }

  /* ---------- the app ---------- */
  PatOS.registerApp({
    id: 'pitstudio', name: 'PitCode Studio', icon: 'pitstudio', width: 1080, height: 680, minWidth: 360, minHeight: 320, category: 'Developer', keywords: 'studio xcode pitcode code develop app sdk patapp make build ide programming developer code',
    about: 'Make your own PatOS apps in PitCode or HTML and JavaScript, run them, and share them.',
    launch(win, args) {
      win.el.classList.add('has-toolbar', 'ps-win', 'ps-pane-code', 'ps-home');
      const P = PatOS.patapps;
      let proj = null, cur = null, view = 'code', saveTimer = null, run = null, problemsTimer = null, pubState = null;
      const root = h('div', { class: 'ps' }); win.body.appendChild(root);
      const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'pitstudio' });
      const fail = (e) => msg(T('That didn’t work'), String((e && e.message) || e));
      if (PatOS.pitcodeSource) PatOS.loadPitCode().then(() => { if (ed) ed.rerender(); if (proj) checkNow(); }).catch(() => {});

      /* toolbar */
      const bProjects = h('button', { class: 'tbtn ps-projbtn', title: T('Projects') }, T('Projects'));
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
      /* on a phone the three parts (files, code, preview) take turns on the whole screen, with tabs at the bottom */
      const PANES = [['files', T('Files')], ['code', T('Code')], ['prev', T('Preview')]];
      const tabs = h('div', { class: 'ps-tabs' }, ...PANES.map(([k, l]) => h('button', { 'data-pane': k, onclick: () => setPane(k) }, l)));
      function setPane(k) { PANES.forEach(([n]) => win.el.classList.toggle('ps-pane-' + n, n === k)); [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.pane === k)); }
      setPane('code');

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
          b.onclick = () => { saveFile(); cur = f; view = 'code'; drawAll(); win.el.classList.remove('ps-show-side'); setPane('code'); };
          b.oncontextmenu = (e) => { e.preventDefault(); PatOS.menu([{ label: T('Rename'), action: () => renameFile(f) }, { label: T('Make this the start file'), action: () => { proj.meta.entry = f; saveMeta(); drawSide(); } }, { label: T('Delete'), action: () => delFile(f) }], e.clientX, e.clientY); };
          let t = null; b.addEventListener('touchstart', () => { t = setTimeout(() => b.oncontextmenu({ preventDefault() {}, clientX: b.getBoundingClientRect().left + 40, clientY: b.getBoundingClientRect().bottom }), 600); }, { passive: true }); ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => b.addEventListener(ev, () => clearTimeout(t), { passive: true }));
          side.appendChild(b);
        });
      }
      async function newFile() {
        const name = await PatOS.ask(T('New file'), proj.meta.language === 'pitcode' ? 'extra.pit' : 'extra.js', { icon: 'pitstudio', ok: T('Add'), text: T('Use .pitx, .pit or .pitoss for PitCode; .html, .css or .js for the web.') });
        if (!name) return; const n = name.trim();
        if (!/^[\w.-]{1,60}$/.test(n) || !EXT_OK.test(n) || n === META) return msg(T('That name doesn’t work'), T('Use letters, numbers, dots and dashes, ending with .pitx, .pit, .pitoss, .html, .css, .js, .json, .txt or .md.'));
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
        // the identifier and the version must be valid, and the identifier cannot change once the app is in the store (that would be another app)
        const idIn = txt('id', 49); idIn.onchange = () => { const v = idIn.value.trim(); if (!window.PatAppFormat.ID.test(v)) { idIn.value = m.id; return msg(T('That doesn’t work'), T('The app id must be 3 to 49 characters: lowercase letters, numbers, dots and dashes (like com.maya.timer).')); } m.id = v; saveMeta(); pubState = null; refreshPub(); };
        if (m.published) idIn.readOnly = true;
        const verIn = txt('version', 14); verIn.onchange = () => { const v = verIn.value.trim(); if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v)) { verIn.value = m.version; return msg(T('That doesn’t work'), T('The version must look like 1.0.0.')); } m.version = v; saveMeta(); };
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
        const del = h('button', { class: 'btn danger' }, T('Delete Project…')); del.onclick = async () => { if (!(await PatOS.confirmBox(T('Delete') + ' “' + proj.name + '”?', T('The project goes to the Trash. Apps installed from it stay.'), { ok: T('Delete'), danger: true, icon: 'pitstudio' }))) return; fsx().remove(pdir(proj.name)); closeProject(); };
        settings.append(
          h('h2', {}, T('Project Settings')),
          h('div', { class: 'ps-grid' }, field(T('App name'), nameIn), field(T('Identifier'), idIn, m.published ? T('Locked: this app is in the store.') : T('Like com.maya.timer. Keep it the same for updates.')), field(T('Version'), verIn, T('Like 1.0.0. Raise it when you update.')), field(T('Your name'), txt('author', 40)), field(T('What it does'), txt('description', 300))),
          h('div', { class: 'ps-grid' }, field(T('Icon'), h('div', { class: 'ps-row' }, pi, icon, color), T('An emoji or a letter, and a color.')), field(T('Language'), lang, T('PitCode is the language from github.com/monsieurpit/PitCode.')), field(T('Start file'), entry), field(T('Window size'), h('div', { class: 'ps-row' }, num('width', 240, 1600), '×', num('height', 200, 1200)))),
          h('h3', {}, T('Permissions')), h('p', { class: 'ps-note' }, T('Only tick what the app needs. People are asked the first time it’s used.')), h('div', { class: 'ps-perms' }, ...permRows),
          h('h3', {}, T('Danger zone')), del);
      }

      /* run, build */
      function stopRun() { if (run) { run.stop(); run = null; } stage.innerHTML = ''; stage.appendChild(h('div', { class: 'ps-hint' }, T('Press Run to start your app here.'))); win.el.classList.remove('ps-running'); }
      async function doRun() {
        if (!proj) return; saveFile(); stopRun(); cons.innerHTML = ''; win.el.classList.add('ps-show-prev'); if (PatOS.isMobile) setPane('prev');
        let app; try { app = toApp(proj); } catch (e) { say(String(e.message || e), true); return; }
        stage.innerHTML = '';
        try { run = await P.mount(app, stage, win, { onConsole: say }); win.el.classList.add('ps-running'); say(T('Started') + ' ' + app.name + ' ' + app.version, false); }
        catch (e) { say(String((e && e.message) || e), true); }
      }
      bRun.onclick = doRun; bStop.onclick = () => { stopRun(); say(T('Stopped'), false); };
      /* the store: is this app already in it? Then sending it again is an update (same app, a higher version), never a second app. */
      const isUpdate = () => !!(pubState ? pubState.mine && (pubState.accepted || pubState.pending) : proj && proj.meta.published);
      async function refreshPub() { if (!proj) return; const id = proj.meta.id; const st = await P.appState(id); if (proj && proj.meta.id === id) pubState = st; }
      const nextPatch = (v) => { const n = v.split('.').map(Number); n[2]++; return n.join('.'); };
      async function publish() {
        if (!proj) return; saveFile(); saveMeta(); let app; try { app = toApp(proj); } catch (e) { return fail(e); }
        const st = await P.appState(app.id); pubState = st;
        if (!st) return msg(T('That didn’t work'), T('The store can’t be reached right now.'));
        if (st.taken && !st.mine) return msg(T('This identifier is taken'), T('Another publisher already uses this identifier. Change it in Project Settings.'));
        const live = st.mine ? st.accepted : null;
        if (live && P.cmp(app.version, live) <= 0) { // the store already has this version: offer the next one
          const next = nextPatch(live);
          if (!(await PatOS.confirmBox(T('Version') + ' ' + live + ' ' + T('is already in the store'), T('Use version') + ' ' + next + '?', { ok: T('Use') + ' ' + next, icon: 'pitstudio' }))) return;
          proj.meta.version = next; saveMeta(); try { app = toApp(proj); } catch (e) { return fail(e); } if (view !== 'code') drawSettings();
        }
        const upd = !!(live || (st.mine && st.pending));
        const ok = await PatOS.confirmBox(upd ? T('Update') + ' “' + app.name + '” ' + app.version + '?' : T('Publish') + ' “' + app.name + '” ' + app.version + '?',
          upd ? (live ? T('It replaces version') + ' ' + live + ' ' + T('once the owner accepts it.') : T('It replaces the version waiting for review.')) : T('The server’s owner reviews the app. If accepted, it shows in Community. Its status is below.'), { ok: upd ? T('Update') : T('Publish'), icon: 'pitstudio' });
        if (!ok) return;
        try { await P.submit(app); proj.meta.published = { version: app.version, at: Date.now() }; saveMeta(); PatOS.notify({ title: upd ? T('Update sent for review') : T('Sent for review'), body: app.name + ' ' + app.version, icon: 'pitstudio' }); refreshPub(); if (view !== 'code') drawSettings(); } catch (e) { fail(e); }
      }
      async function buildMenu() {
        refreshPub();
        const r = bBuild.getBoundingClientRect();
        PatOS.menu([
          { label: T('Install on this PatOS'), action: async () => { try { const app = toApp(proj); if (await P.install(app, { source: 'file' })) PatOS.notify({ title: T('Installed'), body: app.name, icon: 'pitstudio' }); } catch (e) { fail(e); } } },
          { label: T('Save .patapp in the project'), action: () => { try { const app = toApp(proj); const f = pdir(proj.name) + '/' + app.id + '.patapp'; fsx().write(f, JSON.stringify(app, null, 2)); PatOS.notify({ title: T('Saved'), body: app.id + '.patapp', icon: 'pitstudio' }); } catch (e) { fail(e); } } },
          { label: T('Download .patapp'), action: () => { try { const app = toApp(proj); PatOS.downloadFile(app.id + '.patapp', JSON.stringify(app, null, 2)); } catch (e) { fail(e); } } },
          { label: T('Send to a friend with PatDrop'), action: () => { try { if (!PatOS.link.linked()) { PatOS.launch('patdrop'); return msg(T('Link PatDrop first'), T('Make or enter a code in PatDrop, then try again.')); } const app = toApp(proj); PatOS.link.sendApp(app); PatOS.notify({ title: T('Sent to your friend'), body: app.name, icon: 'pitstudio' }); } catch (e) { fail(e); } } },
          { divider: true },
          { label: isUpdate() ? T('Update in the store…') : T('Publish to the store…'), action: publish },
          { label: T('Export project (.patappproject)'), action: () => { try { PatOS.downloadFile(slug(proj.name) + '.patappproject', JSON.stringify(exportProject(proj), null, 2)); } catch (e) { fail(e); } } },
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
          codeBox.firstChild.textContent = cur || ''; ed.lang = cur ? PatOS.codesense.langOf(cur) : ''; ed.set(cur ? proj.files[cur] : '', cur ? optsFor(cur) : null); ed.ta.disabled = !cur; checkNow();
        } else drawSettings();
      }
      function open(name) {
        const p = loadProject(name); if (!p) return fail(new Error(T('That project could not be opened.')));
        stopRun(); proj = p; cur = null; view = 'code'; pubState = null; win.setTitle('PitCode Studio'); drawProject(); drawAll(); refreshPub();
      }
      function drawProject() { win.el.classList.remove('ps-home'); root.innerHTML = ''; root.append(main, tabs); setPane('code'); bRun.style.display = bStop.style.display = bBuild.style.display = bPrev.style.display = ''; bFiles.style.display = ''; }
      function closeProject() { saveFile(); stopRun(); proj = null; cur = null; welcome(); }
      bProjects.onclick = () => { if (proj) closeProject(); else welcome(); };

      /* importing a .patappproject: a new project, or (when this app is already here) replace it or make a copy */
      async function importText(text) {
        let pr; try { pr = parseProject(text); } catch (e) { return fail(e); }
        const same = listProjects().find((x) => x.meta.id === pr.meta.id); let how = 'new', target = null;
        if (same) {
          if (await PatOS.confirmBox(T('Replace') + ' “' + same.name + '”?', T('A project for this app is already here. Replace its files with the ones in this file?'), { ok: T('Replace'), icon: 'pitstudio' })) { how = 'replace'; target = same.name; }
          else if (await PatOS.confirmBox(T('Import as a copy?'), T('It becomes a separate project with its own identifier.'), { ok: T('Make a Copy'), icon: 'pitstudio' })) how = 'copy';
          else return;
        }
        try { if (proj) { saveFile(); } const name = placeProject(pr, how, target); PatOS.notify({ title: T('Project imported'), body: name, icon: 'pitstudio' }); open(name); } catch (e) { fail(e); }
      }
      function pickProjectFile() {
        // the input stays in the page (out of sight) until a file is chosen: phones are happier that way. No file type filter (phones gray out types they do not know).
        const i = h('input', { type: 'file', style: { position: 'fixed', left: '-9999px', top: '0', opacity: '0' } }); document.body.appendChild(i); let used = false;
        const done = async () => {
          const f = i.files && i.files[0]; if (!f || used) return; used = true;
          try { const t = await f.text(); i.remove(); if (!t.trim()) throw new Error(T('That file is empty.')); await importText(t); } catch (e) { i.remove(); fail(e); }
        };
        i.addEventListener('change', done); i.addEventListener('input', done); i.addEventListener('cancel', () => i.remove()); i.click();
      }
      /* the same, from text: copy the file's text (the Claude app shows it) and paste it here */
      function pasteProject() {
        const ta = h('textarea', { class: 'field ps-pastebox', rows: '10', spellcheck: 'false', placeholder: T('Paste the whole file here') });
        const ok = h('button', { class: 'btn primary' }, T('Import')), no = h('button', { class: 'btn' }, T('Cancel'));
        const box = h('div', { class: 'ps-paste' }, h('div', { class: 'ps-pastecard' }, h('h2', {}, T('Import from text')), ta, h('div', { class: 'ps-row' }, ok, no)));
        no.onclick = () => box.remove(); ok.onclick = async () => { const t = ta.value; if (!t.trim()) return; box.remove(); await importText(t); };
        root.appendChild(box); ta.focus();
      }
      /* the first screen: new project or open one */
      function welcome() {
        win.el.classList.add('ps-home'); root.innerHTML = ''; title.textContent = ''; bRun.style.display = bStop.style.display = bBuild.style.display = bPrev.style.display = 'none'; bFiles.style.display = 'none';
        let lang = 'pitcode', tpl = 'blank'; const nameIn = h('input', { class: 'field', value: T('My App'), maxlength: '40', 'aria-label': T('App name') });
        const langRow = h('div', { class: 'ps-seg' }); const tplRow = h('div', { class: 'ps-tpls' });
        const drawTpl = () => {
          langRow.innerHTML = ''; [['pitcode', 'PitCode'], ['web', 'HTML + JavaScript']].forEach(([k, l]) => langRow.appendChild(h('button', { class: 'btn' + (lang === k ? ' primary' : ''), onclick: () => { lang = k; tpl = 'blank'; drawTpl(); } }, l)));
          tplRow.innerHTML = ''; TEMPLATES[lang].forEach((t) => tplRow.appendChild(h('button', { class: 'ps-tpl' + (tpl === t.id ? ' on' : ''), onclick: () => { tpl = t.id; drawTpl(); } }, h('b', {}, T(t.name)), h('small', {}, T(t.note)))));
        };
        const make = h('button', { class: 'btn primary' }, T('Create Project')), imp = h('button', { class: 'btn', onclick: pickProjectFile }, T('Import Project…')), pasteBtn = h('button', { class: 'btn', onclick: pasteProject }, T('Paste Project…'));
        make.onclick = () => { const n = nameIn.value.trim().replace(/[\/\\]/g, '') || T('My App'); try { mkdirs(ROOT); open(newProject({ name: n, language: lang, template: tpl })); } catch (e) { fail(e); } };
        nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') make.click(); });
        const list = listProjects().sort((a, b) => b.mtime - a.mtime);
        const mine = h('div', { class: 'ps-projects' }, ...(list.length ? list.map((p) => { const b = h('button', { class: 'ps-proj', onclick: () => open(p.name) }, h('div', { class: 'as-ic', html: '<div class="icon-tile" style="background:linear-gradient(160deg,rgba(255,255,255,.28),rgba(0,0,0,.22)),' + PatOS.esc(p.meta.color || '#0a84ff') + '"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><text x="32" y="44" font-size="34" font-family="system-ui,sans-serif" text-anchor="middle" fill="#fff">' + PatOS.esc(p.meta.icon || '?') + '</text></svg></div>' }), h('div', {}, h('b', {}, p.name), h('small', {}, (p.meta.language === 'pitcode' ? 'PitCode' : 'HTML + JavaScript') + ' · ' + p.meta.version))); return b; }) : [h('p', { class: 'ps-note' }, T('No projects yet.'))]));
        drawTpl();
        root.appendChild(h('div', { class: 'ps-welcome' },
          h('div', { class: 'ps-wcol' }, h('h1', {}, 'PitCode Studio'), h('p', { class: 'ps-note' }, ''),
            h('label', { class: 'ps-field' }, h('span', {}, T('App name')), nameIn), h('div', { class: 'ps-field' }, h('span', {}, T('Language')), langRow), h('div', { class: 'ps-field' }, h('span', {}, T('Start from')), tplRow), h('div', { class: 'ps-row' }, make, imp, pasteBtn),
            h('p', { class: 'ps-note' }, '')),
          h('div', { class: 'ps-wcol' }, h('h2', {}, T('Your projects')), mine)));
      }

      win.on('closed', () => { saveFile(); stopRun(); });
      win._open = open; win._import = importText;
      const fromPath = (path) => { const t = fsx().read(path); if (t == null) return fail(new Error(T('That file could not be read.'))); return importText(String(t)); };
      win._importPath = fromPath;
      if (args && args.importPath) { welcome(); fromPath(args.importPath); } else if (args && args.project && readMeta(args.project)) open(args.project); else welcome();
    },
    onArgs(win, a) { if (a.importPath && win._importPath) win._importPath(a.importPath); else if (a.project && win._open) win._open(a.project); }
  });
  PatOS.iconDefs.pitstudio = { bg: 'linear-gradient(160deg,#0e6a7e,#0b2e38)', svg: () => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M22 20 12 32l10 12M42 20l10 12-10 12" stroke="#7ff0e0" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 16 28 48" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>' };
  PatOS.studio = { TEMPLATES, buildHtml, loadProject, newProject, listProjects, toApp, exportProject, parseProject, placeProject };
})();
