/* PatOS firmware: what makes PatOS start like a real operating system (all of it pretend: nothing here touches the device).
   - /System: PatOS's system folder. You can't open, change or delete it, except with sudo in the Terminal.
   - Deleting it (sudo rm -rf /System): PatOS freezes, restarts, can't find its system ("PatOS might have been deleted from this
     device"), and offers to reinstall. Reinstalling erases PatOS and starts it fresh (setup again), and /System is back. Before
     erasing, a copy of your files and settings is kept on this device (outside PatOS's own storage) and offered back after setup,
     so a reinstall never loses your work.
   - Startup keys, held while PatOS starts: R Recovery, Shift Safe Mode, V verbose boot (the boot log instead of the logo),
     Alt/Option the startup disk picker. Also from the Terminal: reboot --recovery / --safe / --verbose.
   - Recovery: restore a snapshot, reinstall PatOS, Disk Utility (First Aid), a Terminal (resetpassword, csrutil), restart.
   - Kernel panic (sudo kill 1), and the real restart and shut down sequences.
   The state that must survive a restart (or a reinstall) is in localStorage "patos-fw", outside PatOS's own data. */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (s) => PatOS.t(s);
  const KEY = 'patos-fw', RESCUE_DB = 'patos-rescue';
  const fw = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const setFw = (o) => { try { if (o && Object.keys(o).length) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch (e) {} };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reload = () => { PatOS._leaving = true; location.reload(); };

  /* ---------- startup keys (held keys repeat, so they are seen as soon as PatOS listens) ---------- */
  const held = new Set(), t0 = Date.now();
  const onKey = (e) => { if (Date.now() - t0 > 5000) return; const k = e.key; if (k === 'Shift') held.add('shift'); else if (k === 'Alt') held.add('alt'); else if (/^r$/i.test(k)) held.add('r'); else if (/^v$/i.test(k)) held.add('v'); };
  addEventListener('keydown', onKey, true); setTimeout(() => removeEventListener('keydown', onKey, true), 5000);

  /* ---------- /System ---------- */
  const v = () => PatOS.version || '3';
  const SYSTEM = () => ({
    Kernel: { 'patos-kernel': 'PatOS kernel ' + v() + ' (x86_64)\n', 'kernel.cache': '\u0000'.repeat(32) },
    CoreServices: { 'boot.efi': 'PatOS boot loader\n', 'loginwindow': 'PatOS login window\n', 'SystemVersion.plist': '<plist><dict><key>ProductName</key><string>PatOS</string><key>ProductVersion</key><string>' + v() + '</string></dict></plist>\n' },
    Library: { Drivers: { 'display.driver': '', 'audio.driver': '', 'input.driver': '', 'network.driver': '' }, Fonts: { 'PatOS Sans.font': '' }, Frameworks: { 'LiquidGlass.framework': '', 'Windows.framework': '', 'Spotlight.framework': '' } },
    'README.txt': 'This folder is PatOS itself. Don’t delete it.\n'
  });
  function ensureSystem() {
    if (fw().state === 'nosystem' || !PatOS.fs || PatOS.fs.exists('/System')) return;
    PatOS.fs.asRoot(() => {
      const make = (dir, tree) => Object.entries(tree).forEach(([name, val]) => { const p = dir + '/' + name; if (typeof val === 'string') PatOS.fs.write(p, val); else { PatOS.fs.mkdir(p); make(p, val); } });
      PatOS.fs.mkdir('/System'); make('/System', SYSTEM());
    });
  }
  // the Terminal (or anything with sudo) removed /System: PatOS freezes, then restarts and can't find itself
  async function systemDeleted() {
    setFw(Object.assign(fw(), { state: 'nosystem', t: Date.now() }));
    freeze();
    await wait(3000);
    power('restart', true);
  }
  function freeze() {
    document.documentElement.classList.add('fw-frozen');
    const veil = h('div', { class: 'fw-freeze', tabindex: '-1' }); document.body.appendChild(veil);
    ['keydown', 'keyup', 'pointerdown', 'wheel', 'contextmenu'].forEach((ev) => veil.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, passive: false }));
    addEventListener('keydown', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
    veil.focus();
  }

  /* ---------- screens ---------- */
  function screen(cls, ...kids) { if (window.__patosBootOK) window.__patosBootOK(); // (PatOS started fine: a firmware screen is not a failed start, js/preload.js)
    const s = h('div', { class: 'fw-screen ' + cls }, ...kids); document.body.appendChild(s); requestAnimationFrame(() => s.classList.add('in')); return s; }
  const hideBoot = () => { const b = document.getElementById('boot'); if (b) b.classList.add('hidden'); };
  function bootBar(msg) {
    const b = document.getElementById('boot'); if (!b) return { set() {} };
    b.classList.remove('hidden'); const fill = b.querySelector('.boot-fill'); let m = b.querySelector('.boot-msg'); if (msg) { if (!m) { m = h('div', { class: 'boot-msg' }); b.appendChild(m); } m.textContent = msg; }
    return { set(p) { if (fill) fill.style.width = p + '%'; } };
  }
  const DISK = '<svg viewBox="0 0 64 64" width="96" height="96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="8" y="18" width="48" height="30" rx="5"/><path d="M8 38h48"/><circle cx="48" cy="43" r="1.8" fill="currentColor"/><path d="M27 26.5a5 5 0 1 1 6.5 4.8c-1.3.4-1.5 1.2-1.5 2.4" stroke-linecap="round"/></svg>';

  // the boot that can't find /System: the bar creeps, stops, and the firmware says so
  async function failedBoot() {
    const bar = bootBar(''); bar.set(8);
    const ms = 3000 + Math.random() * 2000, s0 = Date.now();
    while (Date.now() - s0 < ms) { bar.set(8 + 30 * (Date.now() - s0) / ms); await wait(120); }
    await wait(500); hideBoot();
    const sc = screen('fw-nosys',
      h('div', { class: 'fw-ic', html: DISK }),
      h('h1', {}, T('PatOS might have been deleted from this device')),
      h('p', {}, T('PatOS couldn’t find its System folder, so it can’t start.')),
      h('div', { class: 'fw-btns' }, h('button', { class: 'fw-btn primary', onclick: () => { sc.remove(); reinstall(); } }, T('Reinstall PatOS')), h('button', { class: 'fw-btn', onclick: () => { sc.remove(); setFw(Object.assign(fw(), {})); power('restart', true); } }, T('Restart'))),
      h('small', {}, T('This erases PatOS on this device. Your files and settings are kept and offered back after setup.')));
    return sc;
  }

  /* ---------- reinstall (with a rescue copy of your work) ---------- */
  function rescueDB() { return new Promise((ok, bad) => { const r = indexedDB.open(RESCUE_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('x'); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); }); }
  async function rescueSet(val) { const db = await rescueDB(); await new Promise((ok, bad) => { const tx = db.transaction('x', 'readwrite'); if (val == null) tx.objectStore('x').delete('state'); else tx.objectStore('x').put(val, 'state'); tx.oncomplete = ok; tx.onerror = () => bad(tx.error); }); db.close(); }
  async function rescueGet() { const db = await rescueDB(); const v2 = await new Promise((ok) => { const r = db.transaction('x').objectStore('x').get('state'); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); db.close(); return v2; }
  async function reinstall() {
    hideBoot();
    const step = h('p', {}, ''), fill = h('div', { class: 'fw-fill' });
    const sc = screen('fw-install', h('div', { class: 'fw-logo' }, 'P'), h('h1', {}, T('Reinstalling PatOS')), h('div', { class: 'fw-bar' }, fill), step);
    const steps = ['Keeping a copy of your files and settings…', 'Preparing the disk…', 'Copying the system files…', 'Installing the System folder…', 'Setting up apps…', 'Finishing…'];
    let rescued = false;
    for (let i = 0; i < steps.length; i++) {
      step.textContent = T(steps[i]); fill.style.width = Math.round((i + 1) / steps.length * 100) + '%';
      if (i === 0) { try { if (PatOS.backup && PatOS.backup.collect) { const st = await PatOS.backup.collect({ blobs: false }); await rescueSet({ t: Date.now(), state: st }); rescued = true; } } catch (e) { rescued = false; } }
      await wait(i === 0 ? 900 : 1000 + Math.random() * 900);
    }
    step.textContent = T('PatOS is installed. Restarting…'); await wait(900); void sc;
    setFw({ state: 'installed', rescue: rescued, t: Date.now() });
    try { localStorage.setItem('patos-wipe', '1'); } catch (e) {}
    reload();
  }
  // after setup: bring back what you had before reinstalling?
  async function offerRescue() {
    const f = fw(); if (f.state !== 'installed') return;
    // only once setup is finished and someone is signed in
    while (!PatOS.store.get('setupDone', false) || !PatOS.loggedIn || document.getElementById('setup')) await wait(1000);
    await wait(800);
    setFw({});
    if (!f.rescue) return;
    let r = null; try { r = await rescueGet(); } catch (e) {}
    if (!r || !r.state) return;
    const yes = await PatOS.confirmBox(T('Bring back your files and settings?'), T('PatOS was reinstalled. A copy of what you had before is on this device.'), { ok: T('Bring Back'), icon: 'settings' });
    if (yes) { try { await PatOS.backup.apply(r.state); await rescueSet(null); PatOS.notify({ title: T('Your files are back'), body: T('PatOS restarts to finish.'), icon: 'settings' }); await wait(1200); power('restart', true); } catch (e) { PatOS.alertBox(T('That didn’t work'), e.message, { icon: 'settings' }); } }
    else { try { await rescueSet(null); } catch (e) {} }
  }

  /* ---------- Recovery ---------- */
  function recovery() {
    hideBoot();
    const body = h('div', { class: 'fw-rbody' });
    const opt = (ic, title, sub, fn) => h('button', { class: 'fw-ropt', onclick: fn }, h('span', { class: 'fw-ric' }, ic), h('span', {}, h('b', {}, T(title)), h('small', {}, T(sub))));
    const home = () => { body.innerHTML = ''; body.append(
      opt('↺', 'Restore from a Snapshot', 'Go back to how PatOS was at an earlier moment.', snapshots),
      opt('⤓', 'Reinstall PatOS', 'Install PatOS again (your files are kept and offered back).', () => { sc.remove(); reinstall(); }),
      opt('✚', 'Disk Utility', 'Check PatOS’s disk with First Aid.', firstAid),
      opt('>_', 'Terminal', 'Commands for recovery: resetpassword, csrutil, reboot.', terminal)); };
    const back = () => h('button', { class: 'fw-btn', onclick: home }, '‹ ' + T('Back'));
    async function snapshots() {
      body.innerHTML = ''; const l = PatOS.backup ? PatOS.backup.list() : [];
      body.append(h('h2', {}, T('Restore from a Snapshot')));
      if (!l.length) body.append(h('p', {}, T('There are no snapshots on this device.')));
      l.slice(0, 12).forEach((s) => body.append(h('button', { class: 'fw-ropt small', onclick: async (e) => { e.currentTarget.disabled = true; try { await PatOS.backup.restoreSnapshot(s.key); body.innerHTML = ''; body.append(h('h2', {}, T('Restored')), h('p', {}, T('PatOS restarts with that snapshot.')), h('button', { class: 'fw-btn primary', onclick: () => { setFw({}); reload(); } }, T('Restart'))); } catch (x) { PatOS.alertBox(T('That didn’t work'), x.message); } } },
        h('span', {}, h('b', {}, s.label || T('Snapshot')), h('small', {}, new Date(s.t).toLocaleString(PatOS.locale) + ' · ' + (s.files || 0) + ' ' + T('files'))))));
      body.append(back());
    }
    async function firstAid() {
      body.innerHTML = ''; const log = h('pre', { class: 'fw-log' }); body.append(h('h2', {}, T('First Aid on “PatOS”')), log);
      const line = async (s, ms) => { log.textContent += s + '\n'; await wait(ms || 600); };
      let files = 0, dirs = 0; try { PatOS.fs.asRoot(() => PatOS.fs.walk('/', (p, n) => { if (n.type === 'dir') dirs++; else files++; })); } catch (e) {}
      let used = '?'; try { const e = await navigator.storage.estimate(); used = Math.round((e.usage || 0) / 1048576) + ' MB'; } catch (e) {}
      await line(T('Checking the volume “PatOS”…'));
      await line(T('Checking the file system:') + ' ' + files + ' ' + T('files') + ', ' + dirs + ' ' + T('folders'), 900);
      await line(T('Checking storage:') + ' ' + used + ' ' + T('used'));
      const sys = PatOS.fs.exists('/System') && fw().state !== 'nosystem';
      await line(sys ? T('Checking the System folder… OK') : T('The System folder is missing. First Aid can’t repair this: reinstall PatOS.'), 900);
      await line(sys ? T('First Aid finished. The volume “PatOS” appears to be OK.') : T('First Aid found a problem it can’t repair.'), 200);
      body.append(back());
    }
    function terminal() {
      body.innerHTML = ''; const log = h('pre', { class: 'fw-log' }, 'PatOS Recovery Terminal. Type help.\n'); const inp = h('input', { class: 'fw-tin', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Command' });
      const out = (s) => { log.textContent += s + '\n'; log.scrollTop = log.scrollHeight; };
      inp.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return; const c = inp.value.trim(); inp.value = ''; out('# ' + c); const [cmd, arg] = c.split(/\s+/);
        if (cmd === 'help') out('resetpassword   remove the login password\ncsrutil status|disable|enable   System Integrity Protection\nreboot   restart\nexit   back');
        else if (cmd === 'resetpassword') { if (await PatOS.confirmBox(T('Remove the login password?'), T('PatOS will start without asking for a password.'))) { PatOS.setSetting('password', ''); out('The login password was removed.'); } }
        else if (cmd === 'csrutil') { const f = fw(); if (arg === 'disable') { setFw(Object.assign(f, { sip: false })); out('System Integrity Protection is off. Restart for it to take effect.'); } else if (arg === 'enable') { delete f.sip; setFw(f); out('System Integrity Protection is on.'); } else out('System Integrity Protection status: ' + (f.sip === false ? 'disabled' : 'enabled') + '.'); }
        else if (cmd === 'reboot') { setFw(Object.assign(fw(), {})); reload(); }
        else if (cmd === 'exit') home();
        else if (cmd) out(cmd + ': command not found');
      });
      body.append(log, inp, back()); setTimeout(() => inp.focus(), 50);
    }
    const sc = screen('fw-recovery', h('div', { class: 'fw-rhead' }, h('div', { class: 'fw-logo sm' }, 'P'), h('b', {}, 'PatOS Recovery'), h('div', { style: { flex: 1 } }), h('button', { class: 'fw-btn', onclick: () => { setFw(Object.assign(fw(), {})); reload(); } }, T('Restart'))), body);
    home();
  }

  /* ---------- boot picker (Alt/Option) ---------- */
  function picker(normal) {
    hideBoot();
    const go = (fn) => { sc.remove(); fn(); };
    const disk = (name, fn, on) => { const b = h('button', { class: 'fw-disk' + (on ? ' on' : ''), onclick: () => go(fn) }, h('span', { class: 'fw-ic', html: DISK.replace('M27 26.5a5 5 0 1 1 6.5 4.8c-1.3.4-1.5 1.2-1.5 2.4', '') }), h('span', {}, name)); return b; };
    const sc = screen('fw-picker', h('div', { class: 'fw-disks' }, disk('PatOS', () => { const b = document.getElementById('boot'); if (b) b.classList.remove('hidden'); normal(); }, true), disk('Recovery', recovery)), h('small', {}, T('Choose the startup disk')));
    sc.querySelector('.fw-disk').focus();
  }

  /* ---------- verbose boot (V): the boot log instead of the logo ---------- */
  const LOG = () => ['PatOS boot loader ' + v(), 'Loading kernel /System/Kernel/patos-kernel', 'kernel: PatOS ' + v() + ' x86_64', 'kernel: memory map: ' + (navigator.deviceMemory || 4) + ' GB usable', 'kernel: ' + (navigator.hardwareConcurrency || 4) + ' processors online',
    'acpi: power button ready', 'pci: display controller (' + screen_() + ')', 'input: keyboard, pointer' + (navigator.maxTouchPoints ? ', touchscreen' : ''), 'audio: output device ready', 'net: ' + (navigator.onLine ? 'link up' : 'no link'),
    'fs: mounting “PatOS” (IndexedDB)', 'fs: journal replayed, 0 errors', 'storage: persistent', 'sip: System Integrity Protection ' + (fw().sip === false ? 'disabled' : 'enabled'), 'launchd: starting services',
    'launchd: windowserver (Liquid Glass)', 'launchd: spotlightd', 'launchd: syncd', 'launchd: timelined', 'launchd: notifyd', 'launchd: loginwindow', 'boot: done'];
  function screen_() { return Math.round(window.screen.width * devicePixelRatio) + 'x' + Math.round(window.screen.height * devicePixelRatio); }
  async function verbose(normal) {
    hideBoot();
    const log = h('pre', {}); const sc = screen('fw-verbose', log); let ms = 0;
    for (const l of LOG()) { ms = (performance.now() / 1000).toFixed(6); log.textContent += '[' + String(ms).padStart(12) + '] ' + l + '\n'; await wait(40 + Math.random() * 90); }
    await wait(400); sc.remove(); const b = document.getElementById('boot'); if (b) b.classList.remove('hidden'); normal();
  }

  /* ---------- kernel panic ---------- */
  let panicking = false;
  async function panic(reason) {
    panicking = true;
    setFw(Object.assign(fw(), { panic: { t: Date.now(), reason: String(reason || 'Attempted to kill init!').slice(0, 200) } }));
    freeze();
    const log = h('pre', {}, 'panic(cpu 0 caller 0xffffff8001a2c3d4): "' + (reason || 'Attempted to kill init!') + '"\n' +
      'Backtrace (CPU 0), Frame : Return Address\n' + Array.from({ length: 8 }, () => '0x' + Math.random().toString(16).slice(2, 14) + ' : 0x' + Math.random().toString(16).slice(2, 14)).join('\n') +
      '\n\nKernel version: PatOS ' + v() + ' patos-kernel\nSystem uptime: ' + Math.round(performance.now() / 1000) + ' s');
    const left = h('b', {}, '5');
    screen('fw-panic', h('h1', {}, T('PatOS ran into a problem and needs to restart.')), log, h('p', {}, T('Restarting in'), ' ', left, ' s'));
    for (let i = 5; i > 0; i--) { left.textContent = String(i); await wait(1000); }
    reload();
  }
  async function panicReport() {
    const f = fw(); if (!f.panic || panicking) return; const p = f.panic; delete f.panic; setFw(f);
    if (await PatOS.confirmBox(T('PatOS restarted because of a problem'), T('Your windows were closed. You can see the report of what happened.'), { ok: T('Show Report'), icon: 'settings' }))
      PatOS.alertBox(T('Problem report'), 'panic: ' + p.reason + '\n' + new Date(p.t).toLocaleString(PatOS.locale) + '\nPatOS ' + v(), { icon: 'settings' });
  }

  /* ---------- restart and shut down, like a computer ---------- */
  async function power(kind, now) {
    if (!now && !(await PatOS.confirmBox(T(kind === 'restart' ? 'Restart PatOS?' : 'Shut down PatOS?'), T('Open windows will close.'), { ok: T(kind === 'restart' ? 'Restart' : 'Shut Down') }))) return;
    try { PatOS.session && PatOS.session.snapshot(); await PatOS.flush(); } catch (e) {}
    try { PatOS.wm.closeAll(); } catch (e) {}
    PatOS.loggedIn = false;
    const sc = screen('fw-power', h('div', { class: 'fw-spin' }), h('p', {}, T(kind === 'restart' ? 'Restarting…' : 'Shutting down…')));
    await wait(1400); sc.classList.add('black'); await wait(700);
    if (kind === 'restart') return reload();
    try { PatOS.wallpaper.stop(); } catch (e) {}
    const d = document.getElementById('desktop'); if (d) d.classList.add('hidden');
    const off = document.getElementById('off'); if (off) { off.querySelector('.off-msg').innerHTML = T('PatOS is shut down.') + '<br><small>' + T('Click anywhere to start up.') + '</small>'; off.classList.remove('hidden'); off.addEventListener('pointerdown', reload, { once: true }); }
    sc.remove();
  }
  if (PatOS.power) { PatOS.power.restart = () => power('restart'); PatOS.power.shutdown = () => power('shutdown'); }

  /* ---------- the boot ---------- */
  function start(normal) {
    const f = fw();
    if (f.state === 'nosystem') { failedBoot(); return; }
    const once = f.next || null; if (once) { delete f.next; setFw(f); }
    const go = () => {
      if (once === 'recovery' || held.has('r')) return recovery();
      if (held.has('alt')) return picker(normal);
      // Safe Boot lasts until the next normal start (a restart without Shift)
      try { if (once === 'safe' || held.has('shift')) sessionStorage.setItem('patos-safe', '1'); else sessionStorage.removeItem('patos-safe'); } catch (e) {}
      applySafe();
      if (once === 'verbose' || held.has('v') || f.verboseAlways) return verbose(normal);
      normal();
    };
    setTimeout(go, held.size ? 0 : 150);
  }
  function applySafe() {
    const safe = (() => { try { return sessionStorage.getItem('patos-safe') === '1'; } catch (e) { return false; } })();
    PatOS.safeBoot = safe; document.documentElement.classList.toggle('safe-boot', safe);
  }
  PatOS.on('wm:ready', () => { setTimeout(() => { panicReport(); if (PatOS.safeBoot) PatOS.notify({ title: T('Safe Boot'), body: T('Safe Boot: no widgets, 3D wallpaper or automations. Restart to leave it.'), icon: 'settings' }); }, 1200); });

  ensureSystem();
  if (fw().state === 'installed') offerRescue();
  PatOS.firmware = {
    start, ensureSystem, systemDeleted, panic, recovery, reinstall, power, freeze,
    sipOff: () => fw().sip === false,
    next(kind) { const f = fw(); f.next = kind; setFw(f); },
    verboseAlways(on) { const f = fw(); if (on) f.verboseAlways = true; else delete f.verboseAlways; setFw(f); },
    log: LOG, state: fw
  };
})();
