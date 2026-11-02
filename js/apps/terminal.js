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
      const print = (html, cls) => { out.appendChild(h('div', { class: 'term-row ' + (cls || ''), html })); scr.scrollTop = scr.scrollHeight; };
      const text = (s, cls) => print(esc(s), cls);
      const resolve = (p) => !p ? cwd : p.startsWith('/') || p.startsWith('~') ? PatOS.fs.norm(p) : PatOS.fs.norm(cwd + '/' + p);
      let matrixStop = null;

      const cmds = {
        help() {
          text('Commands you can use:');
          [['ls [dir]', 'list files'], ['cd <dir>', 'change folder'], ['pwd', 'print current folder'], ['cat <file>', 'show a file'], ['touch <file>', 'create an empty file'],
           ['mkdir <dir>', 'make a folder'], ['rm <path>', 'move to Trash'], ['mv <src> <dir>', 'move'], ['cp <src> <dir>', 'copy'], ['echo <text> [> file]', 'print or write text'],
           ['tree', 'show folder tree'], ['open <app|file>', 'open an app or file'], ['apps', 'list apps'], ['calc <expr>', 'calculator'], ['date', 'current date'], ['whoami', 'your name'],
           ['neofetch', 'system info'], ['theme dark|light', 'change appearance'], ['wallpaper <name>', 'change wallpaper'], ['matrix', 'enter the matrix (press any key to stop)'],
           ['cowsay <text>', 'a talking cow'], ['fortune', 'a random message'], ['history', 'command history'], ['clear', 'clear screen'], ['exit', 'close terminal']]
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
            `<span class="ty">GPU</span>: ${PatOS.has3D ? 'WebGL (three.js r' + THREE.REVISION + ')' : 'none'}`,
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
      cmds.dir = cmds.ls; cmds.cls = cmds.clear; cmds.man = cmds.help; cmds.say = cmds.echo;

      function run(raw) {
        print(prompt.innerHTML + esc(raw), 'cmd');
        raw = raw.trim(); if (!raw) return;
        hist.push(raw); if (hist.length > 200) hist.shift(); hi = hist.length; PatOS.store.set('termHist', hist);
        const parts = raw.match(/"[^"]*"|'[^']*'|\S+/g).map((p) => p.replace(/^["']|["']$/g, ''));
        const name = parts.shift().toLowerCase();
        if (cmds[name]) { try { cmds[name](parts, raw); } catch (e) { text(name + ': ' + e.message, 'err'); } }
        else text('patsh: command not found: ' + name + '  (type “help”)', 'err');
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
