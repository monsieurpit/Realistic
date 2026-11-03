/* Terminal — a little shell for the PatOS file system */
(function () {
  'use strict';
  const { h, esc } = PatOS;
  const LOGO = [
    '        ____        ',
    '       / __ \\       ',
    '      / /_/ /       ',
    '     / ____/        ',
    '    /_/  PatOS      '
  ];
  PatOS.registerApp({
    id: 'terminal', name: 'Terminal', icon: 'terminal', single: false, width: 700, height: 440, dark: true, category: 'Utilities', keywords: 'shell command line console bash',
    launch(win) {
      const user = PatOS.settings.userName.toLowerCase().replace(/\s+/g, '');
      let cwd = '/';
      const hist = PatOS.store.get('termHist', []); let hi = hist.length;
      const out = h('div', { class: 'term-out' });
      const prompt = h('span', { class: 'term-prompt' });
      const input = h('input', { class: 'term-in', spellcheck: 'false', autocomplete: 'off' });
      const line = h('div', { class: 'term-line' }, prompt, input);
      const scr = h('div', { class: 'term' }, out, line);
      win.body.appendChild(scr);
      scr.addEventListener('click', () => { if (!window.getSelection().toString()) input.focus(); });
      const pathLabel = () => (cwd === '/' ? '~' : '~' + cwd);
      const setPrompt = () => { prompt.innerHTML = `<span class="tg">${esc(user)}@patos</span> <span class="tb">${esc(pathLabel())}</span> % `; win.setTitle(user + ' — ' + pathLabel() + ' — zsh'); };
      let capture = null, stdin = null; // used by pipes and > redirects
      const print = (html, cls) => {
        if (capture) { const d = document.createElement('div'); d.innerHTML = html.replace(/<br>/g, '\n'); capture.push(d.textContent); return; }
        out.appendChild(h('div', { class: 'term-row ' + (cls || ''), html })); scr.scrollTop = scr.scrollHeight;
      };
      const text = (s, cls) => { if (capture) { capture.push(String(s)); return; } print(esc(s), cls); };
      const input2 = (a) => { const f = a.filter((x) => !x.startsWith('-')); if (f.length) { const c = PatOS.fs.read(resolve(f[f.length - 1])); if (c == null) throw new Error(f[f.length - 1] + ': No such file'); return c; } return stdin == null ? '' : stdin; };
      const flag = (a, f) => a.includes(f);
            const resolve = (p) => !p ? cwd : p.startsWith('/') || p.startsWith('~') ? PatOS.fs.norm(p) : PatOS.fs.norm(cwd + '/' + p);
      let matrixStop = null;

      const cmds = {
        help() {
          text('Commands you can use:');
          [['ls [dir]', 'list files'], ['cd <dir>', 'change folder'], ['pwd', 'print current folder'], ['cat <file>', 'show a file'], ['touch <file>', 'create an empty file'],
           ['mkdir <dir>', 'make a folder'], ['rm <path>', 'move to Trash'], ['mv <src> <dir>', 'move'], ['cp <src> <dir>', 'copy'], ['echo <text> [> file]', 'print or write text'],
           ['tree', 'show folder tree'], ['open <app|file>', 'open an app or file'], ['apps', 'list apps'], ['calc <expr>', 'calculator'], ['date', 'current date'], ['whoami', 'your name'],
           ['neofetch', 'system info'], ['theme dark|light', 'change appearance'], ['wallpaper <name>', 'change wallpaper'], ['matrix', 'enter the matrix (press any key to stop)'],
           ['grep / wc / head / tail', 'filter text (works with |)'], ['sort / uniq / rev / seq', 'more text tools'], ['find [dir] -name <pattern>', 'find files'], ['ls -l', 'detailed list'], ['python <file.py>', 'run a Python program (also python -c "code")'], ['node <file.js>', 'run a JavaScript file'], ['curl <url>', 'download a web page'], ['ping <host>', 'check a website'], ['weather', 'current weather'], ['todo [text]', 'list or add reminders'], ['cmd > file', 'save output to a file'], ['cmd1 && cmd2', 'run one after another'], ['cowsay <text>', 'a talking cow'], ['fortune', 'a random message'], ['history', 'command history'], ['clear', 'clear screen'], ['exit', 'close terminal']]
            .forEach(([c, d]) => print(`  <span class="ty">${esc(c.padEnd(22))}</span>${esc(d)}`));
        },
        ls(a) {
          const p = resolve(a[0]);
          if (!PatOS.fs.exists(p)) return text('ls: ' + a[0] + ': No such file or directory', 'err');
          if (!PatOS.fs.isDir(p)) return text(PatOS.fs.basename(p));
          const items = PatOS.fs.list(p);
          print(items.map((i) => i.type === 'dir' ? `<span class="tb">${esc(i.name)}/</span>` : esc(i.name)).join('    ') || '<span class="tm">(empty)</span>');
        },
        cd(a) {
          const p = resolve(a[0] || '/');
          if (!PatOS.fs.isDir(p)) return text('cd: no such directory: ' + (a[0] || ''), 'err');
          cwd = p; setPrompt();
        },
        pwd() { text(cwd === '/' ? '/Users/' + user : '/Users/' + user + cwd); },
        cat(a) {
          if (!a[0]) return text('usage: cat <file>', 'err');
          const c = PatOS.fs.read(resolve(a.join(' ')));
          if (c == null) return text('cat: ' + a.join(' ') + ': No such file', 'err');
          text(c.startsWith('data:') ? '[binary data: ' + PatOS.fmtBytes(c.length) + ']' : c);
        },
        touch(a) { if (!a[0]) return text('usage: touch <file>', 'err'); const p = resolve(a.join(' ')); if (!PatOS.fs.exists(p)) PatOS.fs.write(p, ''); },
        mkdir(a) { if (!a[0]) return text('usage: mkdir <dir>', 'err'); try { PatOS.fs.mkdir(resolve(a.join(' '))); } catch (e) { text('mkdir: ' + e.message, 'err'); } },
        rm(a) { if (!a[0]) return text('usage: rm <path>', 'err'); const args = a.filter((x) => !x.startsWith('-')); try { PatOS.fs.remove(resolve(args.join(' '))); text('Moved to Trash.', 'tm'); } catch (e) { text('rm: ' + e.message, 'err'); } },
        mv(a) { if (a.length < 2) return text('usage: mv <src> <dir>', 'err'); try { PatOS.fs.move(resolve(a[0]), resolve(a[1])); } catch (e) { text('mv: ' + e.message, 'err'); } },
        cp(a) { if (a.length < 2) return text('usage: cp <src> <dir>', 'err'); try { PatOS.fs.copy(resolve(a[0]), resolve(a[1])); } catch (e) { text('cp: ' + e.message, 'err'); } },
        echo(a, raw) {
          const m = raw.match(/^echo\s+(.*?)\s*(>>?)\s*(.+)$/);
          if (m) {
            const p = resolve(m[3].trim()); const s = m[1].replace(/^["']|["']$/g, '');
            try { PatOS.fs.write(p, m[2] === '>>' ? (PatOS.fs.read(p) || '') + s + '\n' : s + '\n'); } catch (e) { text('echo: ' + e.message, 'err'); }
          } else text(a.join(' ').replace(/^["']|["']$/g, ''));
        },
        tree(a) {
          const p = resolve(a[0]); const lines = [pathLabel()];
          const walk = (dir, pre) => { const items = PatOS.fs.list(dir); items.forEach((it, i) => { const last = i === items.length - 1; lines.push(pre + (last ? '└── ' : '├── ') + it.name); if (it.type === 'dir') walk(it.path, pre + (last ? '    ' : '│   ')); }); };
          walk(p, ''); text(lines.join('\n'));
        },
        open(a) {
          const q = a.join(' ').toLowerCase(); if (!q) return text('usage: open <app or file>', 'err');
          const p = resolve(a.join(' '));
          if (PatOS.fs.exists(p)) return PatOS.openFile(p);
          const id = PatOS.appOrder.find((k) => k === q || PatOS.apps[k].name.toLowerCase() === q) || PatOS.appOrder.find((k) => PatOS.apps[k].name.toLowerCase().startsWith(q));
          if (id) { PatOS.launch(id); text('Opening ' + PatOS.apps[id].name + '…', 'tm'); } else text('open: cannot find “' + q + '”', 'err');
        },
        apps() { print(PatOS.appOrder.map((k) => `<span class="ty">${esc(k)}</span> ${esc(PatOS.apps[k].name)}`).join('<br>')); },
        calc(a) { try { const v = Function('"use strict";return (' + a.join(' ').replace(/\^/g, '**').replace(/[^\d+\-*/().%\s*e]/gi, '') + ')')(); text(String(v)); } catch (e) { text('calc: invalid expression', 'err'); } },
        date() { text(new Date().toString()); },
        whoami() { text(user); },
        uptime() { text('up ' + Math.round(performance.now() / 60000) + ' minutes'); },
        neofetch() {
          const info = [
            `<span class="tg">${esc(user)}@patos</span>`, '-----------------',
            `<span class="ty">OS</span>: PatOS ${PatOS.version}`,
            `<span class="ty">Host</span>: ${esc(navigator.userAgent.includes('CrOS') ? 'Chromebook' : navigator.platform || 'Web')}`,
            `<span class="ty">Kernel</span>: JavaScript (${esc((navigator.userAgent.match(/Chrome\/[\d.]+/) || ['Browser'])[0])})`,
            `<span class="ty">Uptime</span>: ${Math.round(performance.now() / 60000)} mins`,
            `<span class="ty">Shell</span>: patsh 1.0`,
            `<span class="ty">Resolution</span>: ${screen.width}x${screen.height}`,
            `<span class="ty">Theme</span>: ${PatOS.settings.theme}`,
            `<span class="ty">GPU</span>: ${PatOS.has3D ? 'WebGL (three.js r' + THREE.REVISION + ')' : PatOS.webgl ? 'WebGL' : 'none'}`,
            `<span class="ty">CPU</span>: ${navigator.hardwareConcurrency || '?'} cores`,
            `<span class="ty">Memory</span>: ${navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'unknown'}`,
            `<span class="ty">Apps</span>: ${PatOS.appOrder.length}`,
            '', ['#ff5f57', '#febc2e', '#28c840', '#0a84ff', '#bf5af2', '#ff375f', '#64d2ff', '#fff'].map((c) => `<span style="background:${c}">&nbsp;&nbsp;&nbsp;</span>`).join('')
          ];
          const rows = Math.max(LOGO.length, info.length);
          let s = ''; for (let i = 0; i < rows; i++) s += `<span class="tp">${esc((LOGO[i] || '').padEnd(22))}</span>${info[i] || ''}<br>`;
          print(s);
        },
        theme(a) { if (!['dark', 'light', 'auto'].includes(a[0])) return text('usage: theme dark|light|auto', 'err'); PatOS.setSetting('theme', a[0]); },
        wallpaper(a) {
          const all = [...Object.keys(PatOS.wallpaper.live), ...Object.keys(PatOS.wallpaper.palettes)];
          if (!all.includes(a[0])) return text('wallpapers: ' + all.join(', '));
          PatOS.setSetting('wallpaper', a[0]);
        },
        history() { text(hist.map((c, i) => String(i + 1).padStart(4) + '  ' + c).join('\n')); },
        clear() { out.innerHTML = ''; },
        exit() { win.close(); },
        sudo() { text('Nice try. ' + user + ' is not in the sudoers file. This incident will be reported.', 'err'); },
        cowsay(a) {
          const msg = a.join(' ') || 'Moo! Welcome to PatOS.';
          text(' ' + '_'.repeat(msg.length + 2) + '\n< ' + msg + ' >\n ' + '-'.repeat(msg.length + 2) + '\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||');
        },
        fortune() {
          const f = ['You will write amazing code today.', 'A 3D galaxy is just a few clicks away. Try `open galaxy`.', 'Homework first, games second. Probably.', 'The best OS is the one you made yourself.', 'Press Alt+L to see every app.', 'Fortune favors the bold (and the people who save their work).'];
          text(f[Math.floor(Math.random() * f.length)]);
        },
        matrix() {
          const c = h('canvas', { class: 'term-matrix' }); scr.appendChild(c);
          const ctx = c.getContext('2d'); c.width = scr.clientWidth; c.height = scr.clientHeight;
          const cols = Math.floor(c.width / 14); const drops = Array(cols).fill(0).map(() => Math.random() * -50);
          let raf;
          const step = () => {
            ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.fillStyle = '#32d74b'; ctx.font = '14px monospace';
            drops.forEach((y, i) => { ctx.fillText(String.fromCharCode(0x30a0 + Math.random() * 96), i * 14, y * 14); drops[i] = y * 14 > c.height && Math.random() > 0.975 ? 0 : y + 1; });
            raf = requestAnimationFrame(step);
          };
          step();
          matrixStop = () => { cancelAnimationFrame(raf); c.remove(); matrixStop = null; };
        }
      };
      Object.assign(cmds, {
        grep(a) {
          const opts = a.filter((x) => x.startsWith('-')).join(''); const rest = a.filter((x) => !x.startsWith('-'));
          const pat = rest.shift(); if (!pat) return text('usage: grep [-i] [-n] [-v] <text> [file]', 'err');
          const src = rest.length ? PatOS.fs.read(resolve(rest[0])) : stdin; if (src == null) return text('grep: ' + rest[0] + ': No such file', 'err');
          const re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), opts.includes('i') ? 'i' : '');
          String(src).split('\n').forEach((l, i) => { if (re.test(l) !== opts.includes('v')) capture ? text((opts.includes('n') ? (i + 1) + ':' : '') + l) : print((opts.includes('n') ? `<span class="tm">${i + 1}:</span>` : '') + esc(l).replace(new RegExp(esc(pat).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g' + (opts.includes('i') ? 'i' : '')), (m) => `<span class="ty">${m}</span>`)); });
        },
        wc(a) { const s = input2(a); const lines = s ? s.split('\n').length - (s.endsWith('\n') ? 1 : 0) : 0; if (flag(a, '-l')) return text(String(lines)); if (flag(a, '-w')) return text(String((s.match(/\S+/g) || []).length)); text(lines + '  ' + (s.match(/\S+/g) || []).length + '  ' + s.length); },
        head(a) { const n = a.includes('-n') ? +a[a.indexOf('-n') + 1] || 10 : 10; const rest = a.filter((x, i) => !(x === '-n' || a[i - 1] === '-n')); text(input2(rest).split('\n').slice(0, n).join('\n')); },
        tail(a) { const n = a.includes('-n') ? +a[a.indexOf('-n') + 1] || 10 : 10; const rest = a.filter((x, i) => !(x === '-n' || a[i - 1] === '-n')); const l = input2(rest).replace(/\n$/, '').split('\n'); text(l.slice(-n).join('\n')); },
        sort(a) { let l = input2(a).replace(/\n$/, '').split('\n'); l.sort(flag(a, '-n') ? (x, y) => parseFloat(x) - parseFloat(y) : (x, y) => x.localeCompare(y)); if (flag(a, '-r')) l.reverse(); text(l.join('\n')); },
        uniq(a) { const l = input2(a).replace(/\n$/, '').split('\n'); text(l.filter((x, i) => x !== l[i - 1]).join('\n')); },
        rev(a) { text(input2(a).split('\n').map((x) => [...x].reverse().join('')).join('\n')); },
        seq(a) { const [x, y] = a.length > 1 ? [+a[0], +a[1]] : [1, +a[0] || 10]; const o = []; for (let i = x; i <= y && o.length < 1000; i++) o.push(i); text(o.join('\n')); },
        find(a) {
          const ni = a.indexOf('-name'); const pat = ni >= 0 ? a[ni + 1] : null; const dir = resolve(a[0] && a[0] !== '-name' ? a[0] : '.');
          const re = pat ? new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i') : null; const o = [];
          PatOS.fs.walk(dir, (p) => { if (!re || re.test(PatOS.fs.basename(p))) o.push(p === '/' ? '~' : '~' + p); }); text(o.join('\n') || '(nothing found)');
        },
        du(a) { const p = resolve(a[0]); const n = PatOS.fs.get(p); if (!n) return text('du: no such file', 'err'); text(PatOS.fmtBytes(PatOS.fs.size(n)) + '\t' + (a[0] || '.')); },
        rmdir(a) { const p = resolve(a[0]); if (!PatOS.fs.isDir(p)) return text('rmdir: not a folder', 'err'); if (PatOS.fs.list(p).length) return text('rmdir: folder is not empty', 'err'); PatOS.fs.remove(p); },
        async python(a) {
          if (!PatOS.python) return text('python: not available here', 'err');
          const ci = a.indexOf('-c'); let code, name = 'main.py';
          if (ci >= 0) code = a.slice(ci + 1).join(' ');
          else { const f = a.find((x) => !x.startsWith('-')); if (!f) return text('usage: python <file.py>   or   python -c "print(1+1)"', 'err'); const n = PatOS.fs.get(resolve(f)); if (!n || n.type !== 'file') return text('python: can’t open file ' + f + ': No such file', 'err'); code = n.content; name = PatOS.fs.basename(f); }
          let buf = ''; const flush = (t, cls) => { buf += t; let i; while ((i = buf.indexOf('\n')) >= 0) { text(buf.slice(0, i), cls); buf = buf.slice(i + 1); } };
          try {
            const r = await PatOS.python.run(code, { name, onOut: (t) => flush(t), onErr: (t) => flush(t, 'err'), onStatus: () => {},
              onInput: async () => { const prompt = buf; buf = ''; const v = await PatOS.ask(prompt || 'input()', '', { icon: 'terminal', ok: 'Enter' }); text(prompt + (v == null ? '' : v), 'tm'); PatOS.python.sendInput(v == null ? '' : v); } });
            if (buf) text(buf);
            if (r.written.length) text('(saved: ' + r.written.map((p) => p.replace(/^\/(Documents|Desktop|Downloads)\//, '')).join(', ') + ')', 'tm');
          } catch (e) { text('python: ' + e.message, 'err'); }
        },
        async node(a) {
          const ei = a.indexOf('-e'); let code;
          if (ei >= 0) code = a.slice(ei + 1).join(' ');
          else { const f = a.find((x) => !x.startsWith('-')); if (!f) return text('usage: node <file.js>   or   node -e "console.log(1+1)"', 'err'); const n = PatOS.fs.get(resolve(f)); if (!n || n.type !== 'file') return text('node: Cannot find module ' + f, 'err'); code = n.content; }
          const src = 'const fmt=(x)=>{try{return typeof x==="string"?x:typeof x==="object"&&x!==null?JSON.stringify(x,null,1):String(x)}catch(e){return String(x)}};const send=(t,a)=>postMessage({t,m:a.map(fmt).join(" ")});self.console={log:(...a)=>send("out",a),info:(...a)=>send("out",a),warn:(...a)=>send("out",a),error:(...a)=>send("err",a)};onmessage=async(e)=>{try{await(0,eval)("(async()=>{"+e.data+"\\n})()")}catch(err){send("err",[err&&err.stack?String(err.stack).split("\\n")[0]:err])}postMessage({t:"done"})};';
          await new Promise((res) => {
            const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); const to = setTimeout(() => { w.terminate(); text('node: stopped after 15 seconds', 'err'); res(); }, 15000);
            w.onmessage = (e) => { if (e.data.t === 'done') { clearTimeout(to); w.terminate(); res(); } else text(e.data.m, e.data.t === 'err' ? 'err' : undefined); };
            w.onerror = (e) => { text('node: ' + e.message, 'err'); clearTimeout(to); w.terminate(); res(); }; w.postMessage(code);
          });
        },
        async curl(a) {
          const u = a.find((x) => !x.startsWith('-')); if (!u) return text('usage: curl <url>', 'err');
          const url = /^https?:/.test(u) ? u : 'https://' + u; const t0 = performance.now();
          try { const r = await fetch(url); const body = await r.text(); text(flag(a, '-I') ? 'HTTP ' + r.status + ' ' + r.statusText + '\ncontent-type: ' + r.headers.get('content-type') : body.slice(0, 4000) + (body.length > 4000 ? '\n… (' + body.length + ' bytes)' : '')); }
          catch (e) { text('curl: this site doesn’t allow requests from web pages (CORS), or there’s no internet (' + Math.round(performance.now() - t0) + ' ms)', 'err'); }
        },
        async ping(a) {
          const host = (a[0] || '').replace(/^https?:\/\//, '').split('/')[0]; if (!host) return text('usage: ping <host>', 'err');
          text('PING ' + host);
          for (let i = 0; i < 4; i++) { const t0 = performance.now(); try { await fetch('https://' + host + '/favicon.ico?' + Date.now(), { mode: 'no-cors', cache: 'no-store' }); text('reply from ' + host + ': time=' + Math.round(performance.now() - t0) + ' ms'); } catch (e) { text('request to ' + host + ' failed', 'err'); } await new Promise((r) => setTimeout(r, 400)); }
        },
        async weather() {
          const pl = PatOS.store.get('weatherPlace', { name: 'Montréal', lat: 45.5019, lon: -73.5674 });
          try { const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pl.lat}&longitude=${pl.lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m`)).json(); text(pl.name + ': ' + Math.round(j.current.temperature_2m) + '°C, wind ' + Math.round(j.current.wind_speed_10m) + ' km/h, humidity ' + j.current.relative_humidity_2m + '%'); }
          catch (e) { text('weather: no internet connection', 'err'); }
        },
        todo(a) { if (!a.length) { const l = PatOS.store.get('reminders', []).filter((r) => !r.done); return text(l.map((r, i) => (i + 1) + '. ' + r.text).join('\n') || 'Nothing to do.'); } const items = PatOS.store.get('reminders', []); items.push({ id: Date.now(), text: a.join(' '), done: false }); PatOS.store.set('reminders', items); text('Added to Reminders.', 'tm'); },
        env() { text(['USER=' + user, 'HOME=/Users/' + user, 'SHELL=/bin/patsh', 'LANG=' + (PatOS.lang === 'fr' ? 'fr_CA' : 'en_CA') + '.UTF-8', 'OS=PatOS ' + PatOS.version, 'TERM=patos-256color'].join('\n')); },
        uname(a) { text(flag(a, '-a') ? 'PatOS ' + PatOS.version + ' patos ' + navigator.userAgent : 'PatOS'); },
        free() { const m = performance.memory; text(m ? 'used ' + PatOS.fmtBytes(m.usedJSHeapSize) + ' of ' + PatOS.fmtBytes(m.jsHeapSizeLimit) : 'Memory info is not available in this browser.'); },
        hostname() { text('patos.local'); },
        yes(a) { text(Array(20).fill(a.join(' ') || 'y').join('\n')); }
      });
      const oldLs = cmds.ls;
      cmds.ls = (a) => {
        if (!flag(a, '-l') && !flag(a, '-la')) return oldLs(a.filter((x) => !x.startsWith('-')));
        const p = resolve(a.find((x) => !x.startsWith('-')));
        PatOS.fs.list(p).forEach((i) => print(`<span class="tm">${i.type === 'dir' ? 'd' : '-'}rw-r--r--  ${esc(user)}  ${esc(PatOS.fmtBytes(PatOS.fs.size(i)).padStart(9))}  ${esc(new Date(i.mtime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).padEnd(7))}</span> ${i.type === 'dir' ? `<span class="tb">${esc(i.name)}/</span>` : esc(i.name)}`));
      };
      const oldHist = cmds.history; cmds.history = (a) => { if (flag(a, '-c')) { hist.length = 0; PatOS.store.set('termHist', hist); return text('History cleared.', 'tm'); } oldHist(a); };
      const oldMv = cmds.mv; cmds.mv = (a) => { if (a.length === 2 && !PatOS.fs.isDir(resolve(a[1])) && PatOS.fs.dirname(resolve(a[1])) === PatOS.fs.dirname(resolve(a[0]))) { try { PatOS.fs.rename(resolve(a[0]), PatOS.fs.basename(resolve(a[1]))); } catch (e) { text('mv: ' + e.message, 'err'); } return; } oldMv(a); };
      const oldCat = cmds.cat; cmds.cat = (a) => { if (!a.length && stdin != null) return text(stdin); if (a.length > 1) return a.forEach((f) => oldCat([f])); oldCat(a); };
      cmds.python3 = cmds.python; cmds.py = cmds.python; cmds.dir = cmds.ls; cmds.cls = cmds.clear; cmds.man = cmds.help; cmds.say = cmds.echo;

      const splitTop = (s, sep) => { const out = []; let cur = '', q = null; for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === q) q = null; cur += c; } else if (c === '"' || c === "'") { q = c; cur += c; } else if (s.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; } else cur += c; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); };
      async function exec1(seg, inData, capt) {
        const parts = seg.match(/"[^"]*"|'[^']*'|\S+/g).map((p) => p.replace(/^["']|["']$/g, ''));
        const name = parts.shift().toLowerCase();
        if (!cmds[name]) { text('patsh: command not found: ' + name + '  (type “help”)', 'err'); return false; }
        const prevCap = capture, prevIn = stdin; capture = capt; stdin = inData;
        try { await cmds[name](parts, seg); return true; } catch (e) { capture = prevCap; text(name + ': ' + e.message, 'err'); return false; } finally { capture = prevCap; stdin = prevIn; }
      }
      async function runLine(line) {
        let redirect = null; const m = line.match(/^(.*?)\s(>>?)\s*([^>|&]+)$/);
        if (m && !/^echo\s/.test(line.trim())) { line = m[1]; redirect = { append: m[2] === '>>', file: m[3].trim() }; }
        const stages = splitTop(line, '|'); let data = null;
        for (let i = 0; i < stages.length; i++) {
          const last = i === stages.length - 1;
          const buf = (!last || redirect) ? [] : null;
          const ok = await exec1(stages[i], data, buf); if (!ok) return false;
          if (buf) data = buf.join('\n');
        }
        if (redirect) { const p = resolve(redirect.file); try { PatOS.fs.write(p, (redirect.append ? (PatOS.fs.read(p) || '') : '') + (data || '') + '\n'); } catch (e) { text(e.message, 'err'); return false; } }
        return true;
      }
      async function run(raw) {
        print(prompt.innerHTML + esc(raw), 'cmd');
        raw = raw.trim(); if (!raw) return;
        hist.push(raw); if (hist.length > 200) hist.shift(); hi = hist.length; PatOS.store.set('termHist', hist);
        input.disabled = true;
        for (const part of splitTop(raw, '&&')) { const ok = await runLine(part); if (!ok) break; }
        input.disabled = false; input.focus(); scr.scrollTop = scr.scrollHeight;
      }
      input.addEventListener('keydown', (e) => {
        if (matrixStop) { e.preventDefault(); matrixStop(); return; }
        if (e.key === 'Enter') { const v = input.value; input.value = ''; run(v); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
        else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
        else if (e.key === 'c' && e.ctrlKey && !window.getSelection().toString()) { print(prompt.innerHTML + esc(input.value) + '^C'); input.value = ''; }
        else if (e.key === 'Tab') {
          e.preventDefault();
          const parts = input.value.split(' '); const last = parts.pop();
          const base = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : '';
          const dir = resolve(base || '.'); const frag = last.slice(base.length).toLowerCase();
          const pool = parts.length ? PatOS.fs.list(dir).map((i) => i.name + (i.type === 'dir' ? '/' : '')) : Object.keys(cmds);
          const m = pool.filter((n) => n.toLowerCase().startsWith(frag));
          if (m.length === 1) input.value = [...parts, base + m[0]].join(' ');
          else if (m.length > 1) print(m.map(esc).join('    '), 'tm');
        }
      });
      setPrompt();
      print(`<span class="tm">Last login: ${esc(new Date().toLocaleString())} on ttys001</span>`);
      print('Welcome to <b>PatOS Terminal</b>. Type <span class="ty">help</span> to see commands.');
      win.on('focus', () => setTimeout(() => input.focus(), 0));
      win.on('closed', () => matrixStop && matrixStop());
      setTimeout(() => input.focus(), 60);
    }
  });
})();
