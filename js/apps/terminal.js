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
           ['neofetch', 'system info'], ['errors [clear]', 'problems PatOS wrote down'], ['sudo <command>', 'run a command as root (asks for your password)'], ['reboot [--recovery|--safe|--verbose]', 'restart PatOS'], ['shutdown -h now', 'shut down'], ['uname -a / dmesg / df -h / ps', 'about the system'], ['theme dark|light', 'change appearance'], ['wallpaper <name>', 'change wallpaper'], ['matrix', 'enter the matrix (press any key to stop)'],
           ['grep / wc / head / tail', 'filter text (works with |)'], ['sort / uniq / rev / seq', 'more text tools'], ['cut / tr / sed / nl / tee', 'cut -d, -f1 · tr a-z A-Z · sed s/a/b/g'], ['diff <a> <b>', 'compare two files'], ['stat <file>', 'size, type and date'], ['basename / dirname', 'parts of a path'], ['NAME=value / $NAME', 'variables (export to keep them)'], ['alias ll="ls -l"', 'make your own shortcut'], ['!!', 'repeat the last command'], ['which / sleep', 'find a command · wait'], ['find [dir] -name <pattern>', 'find files'], ['ls -l', 'detailed list'], ['python <file.py>', 'run a Python program (also python -c "code")'], ['node <file.js>', 'run JavaScript (in the browser: not real Node.js, no require or npm)'], ['curl <url>', 'download a web page'], ['ping <host>', 'check a website'], ['weather', 'current weather'], ['todo [text]', 'list or add reminders'], ['cmd > file', 'save output to a file'], ['cmd1 && cmd2', 'run one after another'], ['cowsay <text>', 'a talking cow'], ['fortune', 'a random message'], ['history', 'command history'], ['clear', 'clear screen'], ['exit', 'close terminal']]
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
        /* the system (js/firmware.js): sudo asks for your login password, then runs the command as root */
        async sudo(a, seg) {
          if (!a.length) return text('usage: sudo <command>', 'err');
          const pass = await PatOS.ask(PatOS.t('Password'), '', { password: true, icon: 'terminal', ok: 'OK' });
          if (pass == null) return text('sudo: a password is required', 'err');
          if (PatOS.settings.password && pass !== PatOS.settings.password) return text('Sorry, try again.', 'err');
          return PatOS.fs.asRoot(() => exec1(String(seg).replace(/^\s*sudo\s+/i, ''), stdin, capture));
        },
        reboot(a) { const m = a.join(' '); if (/recovery/.test(m)) PatOS.firmware.next('recovery'); else if (/safe/.test(m)) PatOS.firmware.next('safe'); else if (/verbose|-v/.test(m)) PatOS.firmware.next('verbose'); text('Restarting…'); setTimeout(() => PatOS.firmware.power('restart', true), 400); },
        shutdown(a) { const m = a.join(' '); if (!/now|-h|-r/.test(m)) return text('usage: shutdown -h now | shutdown -r now', 'err'); setTimeout(() => PatOS.firmware.power(/-r/.test(m) ? 'restart' : 'shutdown', true), 300); },
        uname(a) { text(a.includes('-a') ? 'PatOS patos ' + PatOS.version + ' patos-kernel ' + PatOS.version + ' #1 SMP ' + new Date().toDateString() + ' x86_64 PatOS' : 'PatOS'); },
        dmesg() { PatOS.firmware.log().forEach((l, i) => text('[' + (0.1 + i * 0.07).toFixed(6).padStart(12) + '] ' + l)); },
        async df() { let used = 0, quota = 0; try { const e = await navigator.storage.estimate(); used = e.usage || 0; quota = e.quota || 0; } catch (e) {} const g = (n) => (n / 1073741824).toFixed(1) + 'G'; text('Filesystem    Size   Used  Avail Use%  Mounted on'); text('patos-disk   ' + g(quota).padStart(6) + ' ' + g(used).padStart(6) + ' ' + g(Math.max(0, quota - used)).padStart(6) + ' ' + (quota ? Math.round(used / quota * 100) : 0) + '%    /'); },
        // (3.3) real processes (js/process.js): ps · top · kill [-9] <pid> · killall <name>
        ps(a) {
          const l = PatOS.proc ? PatOS.proc.list() : [];
          const all = a.some((x) => /a|x/.test(x)); text('  PID  %CPU   TIME     STATE           COMMAND');
          l.filter((p) => all || !p.system || p.pid === 1).forEach((p) => text(String(p.pid).padStart(5) + '  ' + p.cpu.toFixed(1).padStart(4) + '  ' + (p.cpuTime / 1000).toFixed(2).padStart(7) + 's  ' + p.state.padEnd(15) + ' ' + (p.system ? p.name : p.name)));
          if (!all) text('(ps aux: with the system processes)');
        },
        top() {
          const l = PatOS.proc ? PatOS.proc.list().sort((x, y) => y.cpu - x.cpu) : [];
          const mem = performance.memory ? PatOS.fmtBytes(performance.memory.usedJSHeapSize) : 'n/a';
          text('Processes: ' + l.length + ' total, ' + l.filter((p) => p.state === 'running').length + ' running, ' + l.filter((p) => p.state === 'background').length + ' in the background · CPU (measured): ' + l.reduce((s2, p) => s2 + p.cpu, 0).toFixed(1) + '% · JS memory: ' + mem);
          text('  PID  %CPU  THREADS  ENERGY  MEMORY      COMMAND');
          l.slice(0, 12).forEach((p) => text(String(p.pid).padStart(5) + '  ' + p.cpu.toFixed(1).padStart(4) + '  ' + String(p.threads).padStart(7) + '  ' + String(p.energy).padStart(6) + '  ' + (p.memory ? PatOS.fmtBytes(p.memory) : '-').padEnd(10) + '  ' + p.name));
        },
        kill(a) {
          const force = a.includes('-9') || a.includes('-KILL'); const pid = a.filter((x) => !x.startsWith('-'))[0];
          if (!pid) return text('usage: kill [-9] <pid>', 'err');
          if (pid === '1' || pid === '42') { if (!PatOS.fs.isRoot()) return text('kill: ' + pid + ': Operation not permitted', 'err'); PatOS.firmware.panic(pid === '1' ? 'Attempted to kill init!' : 'Attempted to kill the kernel'); return; }
          const p = PatOS.proc && PatOS.proc.get(pid);
          if (!p) return text('kill: ' + pid + ': No such process', 'err');
          if (p.system) return text('kill: ' + pid + ': ' + (PatOS.fs.isRoot() ? p.name + ' is part of PatOS and can’t be stopped' : 'Operation not permitted'), 'err');
          if (force) PatOS.proc.kill(p.pid); else PatOS.proc.quit(p.pid);
        },
        killall(a) {
          const name = a.filter((x) => !x.startsWith('-')).join(' ').toLowerCase(); if (!name) return text('usage: killall [-9] <name>', 'err');
          const l = (PatOS.proc ? PatOS.proc.list() : []).filter((p) => !p.system && (p.name.toLowerCase() === name || p.app === name));
          if (!l.length) return text('No matching processes were found', 'err');
          l.forEach((p) => (a.includes('-9') ? PatOS.proc.kill(p.pid) : PatOS.proc.quit(p.pid)));
        },
        nvram(a) { const m = a.join(' '); if (/boot-args=.*-v/.test(m)) { if (!PatOS.fs.isRoot()) return text('nvram: Operation not permitted (use sudo)', 'err'); PatOS.firmware.verboseAlways(true); text('boot-args set: PatOS will start with the boot log.'); } else if (/-d\s+boot-args/.test(m)) { if (!PatOS.fs.isRoot()) return text('nvram: Operation not permitted (use sudo)', 'err'); PatOS.firmware.verboseAlways(false); text('boot-args removed.'); } else text('boot-args\t' + (PatOS.firmware.state().verboseAlways ? '-v' : '')); },
        csrutil(a) { if (a[0] === 'disable' || a[0] === 'enable') return text('csrutil: this can only be changed in Recovery (restart holding R, or: reboot --recovery)', 'err'); text('System Integrity Protection status: ' + (PatOS.firmware.sipOff() ? 'disabled' : 'enabled') + '.'); },
        errors(a) {
          if (a[0] === 'clear') { PatOS.errors.clear(); return text('errors: cleared'); }
          const l = PatOS.errors.list(); if (!l.length) return text('No problems written down.');
          l.slice(-20).forEach((e) => print(`<span class="ty">${esc(new Date(e.t).toLocaleString())}</span> ${e.before ? '(before reload) ' : ''}${esc(e.where)}${e.n > 1 ? ' ×' + e.n : ''}<br>&nbsp;&nbsp;${esc(e.msg)}`));
          if (l.length > 20) text('(' + (l.length - 20) + ' older not shown)');
        },
        neofetch() {
          const info = [
            `<span class="tg">${esc(user)}@patos</span>`, '-----------------',
            `<span class="ty">OS</span>: PatOS ${(PatOS.versionNow ? PatOS.versionNow() : PatOS.version)}`,
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
          else { const f = a.find((x) => !x.startsWith('-')); if (flag(a, '-v') || flag(a, '--version')) return text('PatOS JavaScript runner (it runs JavaScript in your browser; it is not Node.js, so there is no require() or npm)'); if (!f) return text('usage: node <file.js>   or   node -e "console.log(1+1)"   (runs JavaScript in the browser, not real Node.js)', 'err'); const n = PatOS.fs.get(resolve(f)); if (!n || n.type !== 'file') return text('node: Cannot find module ' + f, 'err'); code = n.content; }
          const src = PatOS.workerLockdown + 'const fmt=(x)=>{try{return typeof x==="string"?x:typeof x==="object"&&x!==null?JSON.stringify(x,null,1):String(x)}catch(e){return String(x)}};const send=(t,a)=>postMessage({t,m:a.map(fmt).join(" ")});self.console={log:(...a)=>send("out",a),info:(...a)=>send("out",a),warn:(...a)=>send("out",a),error:(...a)=>send("err",a)};onmessage=async(e)=>{try{await(0,eval)("(async()=>{"+e.data+"\\n})()")}catch(err){send("err",[err&&err.stack?String(err.stack).split("\\n")[0]:err])}postMessage({t:"done"})};';
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
        env() { text(['USER=' + user, 'HOME=/Users/' + user, 'SHELL=/bin/patsh', 'LANG=' + (PatOS.lang === 'fr' ? 'fr_CA' : 'en_CA') + '.UTF-8', 'OS=PatOS ' + (PatOS.versionNow ? PatOS.versionNow() : PatOS.version), 'TERM=patos-256color'].join('\n')); },
        uname(a) { text(flag(a, '-a') ? 'PatOS ' + (PatOS.versionNow ? PatOS.versionNow() : PatOS.version) + ' patos ' + navigator.userAgent : 'PatOS'); },
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
      /* ---------- shell basics: variables, aliases, and a few more tools ---------- */
      const vars = Object.assign({ USER: user, HOME: '/Users/' + user, SHELL: '/bin/patsh' }, PatOS.store.get('termVars', {}));
      const aliases = PatOS.store.get('termAlias', {});
      const saveVars = () => { const o = {}; Object.keys(vars).forEach((k) => { if (!['USER', 'HOME', 'SHELL'].includes(k)) o[k] = vars[k]; }); PatOS.store.set('termVars', o); };
      const readAll = (a) => { const f = a.filter((x) => !x.startsWith('-')); const files = f.slice(1); return files.length ? files.map((n) => { const c = PatOS.fs.read(resolve(n)); if (c == null) throw new Error(n + ': No such file'); return c; }).join('\n') : stdin == null ? '' : stdin; };
      const lines = (t) => String(t).replace(/\n$/, '').split('\n');
      Object.assign(cmds, {
        export(a) { if (!a.length) return cmds.env([]); a.forEach((x) => { const m = /^([A-Za-z_]\w*)=(.*)$/.exec(x); if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); saveVars(); },
        unset(a) { a.forEach((k) => { delete vars[k]; }); saveVars(); },
        alias(a, raw) {
          const rest = raw.replace(/^\s*alias\s*/i, '');
          if (!rest) return text(Object.keys(aliases).map((k) => k + "='" + aliases[k] + "'").join('\n') || '(no aliases)');
          const m = /^([\w.-]+)=(.*)$/.exec(rest); if (!m) return text(aliases[rest] ? rest + "='" + aliases[rest] + "'" : 'alias: ' + rest + ': not found', aliases[rest] ? undefined : 'err');
          aliases[m[1]] = m[2].replace(/^["']|["']$/g, ''); PatOS.store.set('termAlias', aliases);
        },
        unalias(a) { a.forEach((k) => { delete aliases[k]; }); PatOS.store.set('termAlias', aliases); },
        which(a) { a.forEach((n) => text(cmds[n.toLowerCase()] ? (aliases[n] ? n + ': aliased to ' + aliases[n] : n + ': built in to PatOS Terminal') : n + ' not found', cmds[n.toLowerCase()] ? undefined : 'err')); },
        basename(a) { if (!a[0]) return text('usage: basename <path>', 'err'); const b = a[0].replace(/\/+$/, '').split('/').pop(); text(a[1] && b.endsWith(a[1]) ? b.slice(0, -a[1].length) : b); },
        dirname(a) { if (!a[0]) return text('usage: dirname <path>', 'err'); const p = a[0].replace(/\/+$/, ''); const i = p.lastIndexOf('/'); text(i < 0 ? '.' : i === 0 ? '/' : p.slice(0, i)); },
        sleep(a) { const n = parseFloat(a[0]); if (!(n >= 0)) return text('usage: sleep <seconds>', 'err'); return new Promise((r) => setTimeout(r, Math.min(n, 30) * 1000)); },
        nl(a) { text(lines(readAll(['', ...a])).map((l, i) => String(i + 1).padStart(6) + '  ' + l).join('\n')); },
        tee(a) { const f = a.filter((x) => !x.startsWith('-'))[0]; const data = stdin == null ? '' : stdin; text(data); if (f) { const p = resolve(f); try { PatOS.fs.write(p, (flag(a, '-a') ? (PatOS.fs.read(p) || '') : '') + data + '\n'); } catch (e) { text('tee: ' + e.message, 'err'); } } },
        cut(a) {
          const di = a.findIndex((x) => x === '-d' || (x.startsWith('-d') && x.length > 2)), fi = a.findIndex((x) => x === '-f' || /^-f\d/.test(x)); if (fi < 0) return text('usage: cut -d, -f1,3 [file]', 'err');
          const delim = di < 0 ? '\t' : a[di] === '-d' ? (a[di + 1] || '\t') : a[di].slice(2); const spec = a[fi] === '-f' ? a[fi + 1] : a[fi].slice(2);
          const want = []; String(spec).split(',').forEach((r) => { const m = /^(\d+)-(\d*)$/.exec(r); if (m) { for (let i = +m[1]; i <= (+m[2] || 50); i++) want.push(i); } else if (+r) want.push(+r); });
          const skip = new Set([di, fi]); if (di >= 0 && a[di] === '-d') skip.add(di + 1); if (a[fi] === '-f') skip.add(fi + 1);
          const rest = a.filter((x, i) => !skip.has(i));
          lines(readAll(['', ...rest])).forEach((l) => { const p = l.split(delim); text(want.map((n) => p[n - 1]).filter((x) => x != null).join(delim)); });
        },
        tr(a) {
          const set = (x) => String(x || '').replace(/(.)-(.)/g, (m, c, d) => { let o = ''; for (let i = c.charCodeAt(0); i <= d.charCodeAt(0); i++) o += String.fromCharCode(i); return o; }).replace(/\\n/g, '\n');
          const del = flag(a, '-d'); const sets = a.filter((x) => !x.startsWith('-')); const A = set(sets[0]), B = set(sets[1]);
          if (!A) return text('usage: tr a-z A-Z   or   tr -d chars', 'err');
          const src = stdin == null ? '' : stdin; text([...src].map((c) => { const i = A.indexOf(c); if (i < 0) return c; return del ? '' : (B[Math.min(i, B.length - 1)] || c); }).join(''));
        },
        sed(a) {
          const ex = a.find((x) => /^s(.).+\1.*\1[gi]*$/.test(x)); if (!ex) return text("usage: sed 's/old/new/g' [file]", 'err');
          const d = ex[1]; const parts = ex.slice(2).split(d); const re = new RegExp(parts[0], (parts[2] || '').includes('g') ? (parts[2].includes('i') ? 'gi' : 'g') : (parts[2] || '').includes('i') ? 'i' : '');
          lines(readAll(['', ...a.filter((x) => x !== ex && !x.startsWith('-'))])).forEach((l) => text(l.replace(re, parts[1])));
        },
        stat(a) { if (!a[0]) return text('usage: stat <file>', 'err'); const p = resolve(a[0]); const n = PatOS.fs.get(p); if (!n) return text('stat: ' + a[0] + ': No such file or directory', 'err'); text(['  File: ' + PatOS.fs.basename(p) + (n.type === 'dir' ? '/' : ''), '  Type: ' + (n.type === 'dir' ? 'folder' : 'file'), '  Size: ' + PatOS.fmtBytes(PatOS.fs.size(n)), '  Where: ' + (PatOS.fs.dirname(p) || '/'), 'Modified: ' + new Date(n.mtime).toLocaleString()].join('\n')); },
        diff(a) {
          const f = a.filter((x) => !x.startsWith('-')); if (f.length < 2) return text('usage: diff <file1> <file2>', 'err');
          const A = PatOS.fs.read(resolve(f[0])), B = PatOS.fs.read(resolve(f[1])); if (A == null || B == null) return text('diff: ' + (A == null ? f[0] : f[1]) + ': No such file', 'err');
          const x = lines(A), y = lines(B); if (x.length * y.length > 4e6) return text('diff: the files are too big to compare here', 'err');
          const L = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1));
          for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
          const out = []; let i = 0, j = 0;
          while (i < x.length || j < y.length) { if (i < x.length && j < y.length && x[i] === y[j]) { i++; j++; } else if (i < x.length && (j >= y.length || L[i + 1][j] >= L[i][j + 1])) out.push('< ' + x[i++]); else out.push('> ' + y[j++]); }
          text(out.length ? out.join('\n') : 'The files are the same.', out.length ? undefined : 'tm');
        }
      });
      const oldEnv = cmds.env; cmds.env = () => text(Object.keys(vars).map((k) => k + '=' + vars[k]).concat(['LANG=' + (PatOS.lang === 'fr' ? 'fr_CA' : 'en_CA') + '.UTF-8', 'OS=PatOS ' + (PatOS.versionNow ? PatOS.versionNow() : PatOS.version), 'TERM=patos-256color']).join('\n'));
      void oldEnv;
      // $NAME and ${NAME} become their values (not inside single quotes)
      const expand = (line) => { let out = '', q = null; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === q) q = null; out += c; } else if (c === '"' || c === "'") { q = c; out += c; } else if (c === '$') { const m = /^\$(?:\{(\w+)\}|(\w+)|\?)/.exec(line.slice(i)); if (m) { out += m[0] === '$?' ? '0' : (vars[m[1] || m[2]] != null ? vars[m[1] || m[2]] : ''); i += m[0].length - 1; } else out += c; } else out += c; } return out; };
      cmds.python3 = cmds.python; cmds.py = cmds.python; cmds.js = cmds.node; cmds.dir = cmds.ls; cmds.cls = cmds.clear; cmds.man = cmds.help; cmds.say = cmds.echo;

      const splitTop = (s, sep) => { const out = []; let cur = '', q = null; for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === q) q = null; cur += c; } else if (c === '"' || c === "'") { q = c; cur += c; } else if (s.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; } else cur += c; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); };
      async function exec1(seg, inData, capt) {
        seg = seg.trim(); if (!seg) return true;
        const assign = /^([A-Za-z_]\w*)=(.*)$/.exec(seg); if (assign) { vars[assign[1]] = expand(assign[2]).replace(/^["']|["']$/g, ''); saveVars(); return true; }
        const first = seg.split(/\s+/)[0]; if (aliases[first]) seg = aliases[first] + seg.slice(first.length);
        seg = expand(seg);
        const parts = (seg.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((p) => p.replace(/^["']|["']$/g, ''));
        const name = (parts.shift() || '').toLowerCase(); if (!name) return true;
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
        if (/^!!/.test(raw)) { if (!hist.length) return text('patsh: no previous command', 'err'); raw = hist[hist.length - 1] + raw.slice(2); print('<span class="tm">' + esc(raw) + '</span>'); }
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
          if (m.length === 1) input.value = [...parts, base + m[0]].join(' ') + (m[0].endsWith('/') ? '' : ' ');
          else if (m.length > 1) {
            // fill in what all the matches share, then list them
            let pre = m[0]; m.forEach((n) => { while (!n.toLowerCase().startsWith(pre.toLowerCase())) pre = pre.slice(0, -1); });
            if (pre.length > frag.length) input.value = [...parts, base + pre].join(' ');
            print(m.map(esc).join('    '), 'tm');
          }
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
