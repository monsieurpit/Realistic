/* System Settings */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (x) => PatOS.t(x);
  const ACCENTS = ['#0a84ff', '#bf5af2', '#ff375f', '#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#64d2ff', '#8e8e93'];
  const PANES = [
    ['general', 'General', '⚙️'], ['appearance', 'Appearance', '🎨'], ['accessibility', 'Accessibility', '♿'], ['wallpaper', 'Wallpaper', '🖼'], ['dock', 'Home Screen & Dock', '🧭'],
    ['display', 'Displays & 3D', '🖥'], ['sound', 'Sound', '🔊'], ['lock', 'Lock Screen', '🔒'], ['network', 'Network', '📶'], ['startup', 'Install & Start Up', '🚀'], ['permissions', 'Permissions', '🛡'], ['system', 'This Device', '💻'],
    ['keyboard', 'Keyboard', '⌨️'], ['storage', 'Storage', '💾']
  ];
  PatOS.registerApp({
    id: 'settings', name: 'System Settings', icon: 'settings', width: 800, height: 560, minWidth: 600, keywords: 'preferences settings control wallpaper theme dark',
    launch(win, args) {
      let pane = args.pane || 'general';
      const side = h('div', { class: 'st-side' });
      const main = h('div', { class: 'st-main' });
      win.body.appendChild(h('div', { class: 'st-wrap' }, side, main));
      const S = () => PatOS.settings;
      const row = (label, ctl, sub) => h('div', { class: 'st-row' }, h('div', { class: 'st-rl' }, h('span', {}, label), sub ? h('small', {}, sub) : null), ctl);
      const group = (...rows) => h('div', { class: 'st-group' }, ...rows);
      const toggle = (key, after) => { const t = h('button', { class: 'switch' + (S()[key] ? ' on' : '') }); t.onclick = () => { PatOS.setSetting(key, !S()[key]); t.classList.toggle('on', S()[key]); after && after(); }; return t; };
      const range = (key, min, max, step, fmt) => { const v = h('span', { class: 'st-val' }); const r = h('input', { type: 'range', min, max, step: step || 1, value: S()[key] }); const upd = () => (v.textContent = fmt ? fmt(+r.value) : r.value); r.oninput = () => { PatOS.setSetting(key, +r.value); upd(); }; upd(); return h('div', { class: 'st-range' }, r, v); };
      const select = (key, opts) => { const s = h('select', { class: 'field' }, ...opts.map(([v, l]) => h('option', { value: v, selected: S()[key] === v }, l))); s.onchange = () => PatOS.setSetting(key, s.value); return s; };

      const panes = {
        general() {
          const name = h('input', { class: 'field', value: S().userName, style: { width: '180px' } });
          name.onchange = () => PatOS.setSetting('userName', name.value.trim() || 'Pat');
          return [h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('about') }), h('div', {}, h('h2', {}, 'PatOS ' + PatOS.version), h('p', {}, 'A full desktop that runs in your browser, even on a school Chromebook.'))),
            group(row('Your name', name), row('Language', (() => { const s2 = h('select', { class: 'field' }, ...[['auto', 'Automatic (device language)'], ['en', 'English'], ['fr', 'French']].map(([v, l]) => h('option', { value: v, selected: (S().language || 'auto') === v }, l))); s2.onchange = async () => { const v = s2.value; if (await PatOS.confirmBox(PatOS.t('Language'), PatOS.t('PatOS restarts to change the language.'), { ok: PatOS.t('Restart'), icon: 'settings' })) { PatOS.setSetting('language', v); setTimeout(() => (PatOS._leaving = true, location.reload()), 200); } else s2.value = S().language || 'auto'; }; return s2; })(), PatOS.lang === 'fr' ? 'Langue de l’appareil : ' + (PatOS.deviceLang === 'fr' ? 'français' : 'anglais') : 'Device language: ' + (PatOS.deviceLang === 'fr' ? 'French' : 'English')), row('Layout', select('deviceMode', [['auto', 'Automatic (phone or computer)'], ['desktop', 'Computer'], ['mobile', 'Phone']]), 'Automatic uses the phone layout on small touch screens'), row('Ask for full screen at login', toggle('askFullscreen'), 'Makes PatOS feel like a real OS'), row('24-hour clock', toggle('clock24')), row('Show seconds in menu bar', toggle('showSeconds'))),
            group(row('About this computer', h('button', { class: 'btn', onclick: () => PatOS.launch('about') }, 'About PatOS…')))];
        },
        appearance() {
          const modes = h('div', { class: 'st-modes' });
          [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].forEach(([k, l]) => {
            const b = h('button', { class: 'st-mode' + (S().theme === k ? ' on' : '') }, h('div', { class: 'st-mode-pv ' + k }), l);
            b.onclick = () => { PatOS.setSetting('theme', k); render(); }; modes.appendChild(b);
          });
          const acc = h('div', { class: 'st-acc' });
          ACCENTS.forEach((c) => { const b = h('button', { class: 'st-dot' + (S().accent === c ? ' on' : ''), style: { background: c } }); b.onclick = () => { PatOS.setSetting('accent', c); render(); }; acc.appendChild(b); });
          return [h('h3', {}, 'Appearance'), modes, group(row('Highlight color', acc), row('Liquid Glass', toggle('liquidGlass'), 'See-through glass for the dock, menus, panels and widgets'), row('Glass bends the background', toggle('glassRefraction'), 'Works in Chrome. Uses more battery.'), row('Reduce transparency', toggle('reduceTransparency'), 'Solid windows. Runs faster on older Chromebooks.'), row('Fewer animations', toggle('reduceMotion')))];
        },
        wallpaper() {
          const grid = (ids, src) => { const g = h('div', { class: 'st-wps' }); ids.forEach((id) => { const b = h('button', { class: 'st-wp' + (S().wallpaper === id ? ' on' : '') }, h('img', { src: PatOS.wallpaper.thumb(id), alt: '' }), h('span', {}, src[id].name + (src[id].live ? ' ✦' : ''))); b.onclick = () => { PatOS.setSetting('wallpaper', id); if (src[id].live && !S().live3d) PatOS.setSetting('live3d', true); render(); }; g.appendChild(b); }); return g; };
          const upload = h('button', { class: 'btn', onclick: () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 1920 / img.width); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); PatOS.setSetting('customWallpaper', c.toDataURL('image/jpeg', 0.82)); PatOS.setSetting('wallpaper', 'custom'); render(); }; img.src = r.result; }; r.readAsDataURL(f); }; i.click(); } }, 'Choose a Photo…');
          return [h('h3', {}, 'Live 3D Wallpapers'), h('p', { class: 'st-note' }, 'Animated with three.js. They react to your mouse!'), grid(Object.keys(PatOS.wallpaper.live), PatOS.wallpaper.live),
            group(row('Animate 3D wallpaper', toggle('live3d'), PatOS.has3D ? 'Turn off to save battery' : 'WebGL is not available on this device')),
            h('h3', {}, 'Pictures'), grid(Object.keys(PatOS.wallpaper.palettes), PatOS.wallpaper.palettes), group(row('Your own picture', upload))];
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
            h('h3', {}, '3D Graphics'), group(row('3D quality', select('quality3d', [['low', 'Low (best for older Chromebooks)'], ['auto', 'Balanced'], ['high', 'High (sharpest)']])), row('WebGL', h('span', { class: 'st-val' }, PatOS.has3D ? 'Available (three.js r' + THREE.REVISION + ')' : 'Not available on this device')))];
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
        system() {
          const box = h('div'); const ua = navigator.userAgent;
          const os = /CrOS/.test(ua) ? 'ChromeOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : T('Unknown');
          const br = (/(Edg|Chrome|Firefox|Version)\/([\d.]+)/.exec(ua) || []); const bname = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : T('Unknown');
          let gpu = ''; try { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) {}
          const info = (k, v) => v ? row(k, h('span', { class: 'st-val st-wrapval' }, String(v))) : null;
          const bat = h('span', { class: 'st-val' }, '…');
          if (navigator.getBattery) navigator.getBattery().then((b) => { const f = () => { bat.textContent = Math.round(b.level * 100) + '% · ' + (b.charging ? T('Charging') : T('On battery')) + (isFinite(b.dischargingTime) && !b.charging ? ' · ' + Math.round(b.dischargingTime / 60) + ' min' : ''); }; f(); b.addEventListener('levelchange', f); b.addEventListener('chargingchange', f); }); else bat.textContent = T('Not available in this browser');
          const store = h('span', { class: 'st-val' }, '…'); PatOS.storageInfo().then((i) => { store.textContent = PatOS.fmtBytes(i.used) + ' / ' + PatOS.fmtBytes(i.quota); });
          return [
            group(info(T('System'), os), info(T('Browser'), bname + ' ' + (br[2] || '')), info(T('Device'), PatOS.extApps ? PatOS.extApps.device().name : ''), info(T('Processor threads'), navigator.hardwareConcurrency), info(T('Memory'), navigator.deviceMemory ? '≥ ' + navigator.deviceMemory + ' GB' : ''), info(T('Graphics'), gpu), info(T('Screen'), screen.width + ' × ' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x'), info(T('Touch points'), navigator.maxTouchPoints || '0'), info(T('Language'), (navigator.languages || [navigator.language]).slice(0, 3).join(', ')), info(T('Time zone'), Intl.DateTimeFormat().resolvedOptions().timeZone)),
            group(row(T('Battery'), bat), row(T('Browser storage used'), store), row(T('PatOS version'), h('span', { class: 'st-val' }, PatOS.version)), row(T('Time since PatOS opened'), h('span', { class: 'st-val' }, Math.round(performance.now() / 60000) + ' min')))];
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
              : I && I.canPrompt() ? T('Install PatOS to open it in its own window, with no browser bars, like a real app.')
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
              h('p', { class: 'st-note' }, T('School Chromebooks may lock some of these settings. If you can’t change one, that is your school’s choice.')));
            const addr = I ? I.address() : location.href;
            const copyBtn = h('button', { class: 'btn', onclick: () => { (navigator.clipboard ? navigator.clipboard.writeText(addr) : Promise.reject()).then(() => { copyBtn.textContent = T('Copied'); setTimeout(() => (copyBtn.textContent = T('Copy')), 1500); }).catch(() => PatOS.ask(T('PatOS address'), addr, { icon: 'settings' })); } }, T('Copy'));
            box.append(group(row(T('PatOS address'), h('div', { class: 'st-inline' }, h('code', { class: 'st-code' }, addr), copyBtn)),
              row(T('Ask for full screen at login'), toggle('askFullscreen'), T('PatOS asks Chrome for full screen when you log in, so nothing else is on screen.'))));
            box.append(h('h3', { class: 'st-h3' }, T('Open your Chromebook’s files with PatOS')),
              h('p', { class: 'st-note' }, I && I.fileHandling()
                ? T('Once PatOS is installed, right-click a file in the Chromebook’s Files app and choose Open with › PatOS. Word, Excel, PowerPoint, PDF, text, code, pictures, music and videos all work. When you save in PatOS, the real file is saved too.')
                : T('This browser can’t hand files to PatOS. Use Finder › Open Files… instead.')),
              h('h3', { class: 'st-h3' }, T('Shortcuts')),
              h('p', { class: 'st-note' }, T('Right-click the PatOS icon in the shelf to jump straight to Finder, Docs, Notes or Code Studio.')));
          };
          paint();
          const off = I ? I.onChange(paint) : null; if (off) win.on('closed', off);
          return [box];
        },
        accessibility() {
          return [
            group(row(T('Reduce motion'), toggle('reduceMotion'), T('Fewer animations.')), row(T('Reduce transparency'), toggle('reduceTransparency'), T('Solid backgrounds instead of glass.')), row(T('High contrast'), toggle('highContrast'), T('Stronger borders and text.')), row(T('Bold text'), toggle('boldText')), row(T('Always show keyboard focus'), toggle('showFocus'), T('Draws an outline around the item you are on when you press Tab.')), row(T('Larger click targets'), toggle('bigTargets'), T('Bigger buttons, good for touch screens.'))),
            group(row(T('Read notifications aloud to screen readers'), toggle('srAnnounce'))),
            h('p', { class: 'st-note' }, T('To make everything bigger, press Ctrl and + (and Ctrl and 0 to reset). PatOS rearranges itself to fit. On a Chromebook you can also use ChromeVox, the built-in screen reader (Ctrl+Alt+Z).'))];
        },
        keyboard() {
          const sc = [['Ctrl+Space / Alt+Space', 'Spotlight search'], ['Alt+L or F4', 'Launchpad'], ['Alt+↑ or F3', 'Mission Control'], ['Alt+W', 'Close window'], ['Alt+Q', 'Quit app'], ['Alt+M', 'Minimize'], ['Alt+F', 'Zoom window'], ['Alt+← / Alt+→', 'Tile window left / right'], ['Alt+N', 'New window'], ['Alt+`', 'Cycle windows'], ['Alt+T', 'Terminal'], ['Alt+E', 'Finder'], ['Alt+B', 'Patoogle browser'], ['Alt+,', 'Settings'], ['Alt+Esc', 'Lock screen'], ['Esc', 'Close menus & overlays']];
          return [h('h3', {}, 'Keyboard Shortcuts'), h('p', { class: 'st-note' }, 'PatOS uses Alt because Chromebooks reserve most Ctrl shortcuts.'), group(...sc.map(([k, d]) => row(d, h('kbd', {}, k))))];
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
            if (blobs) PatOS.notify({ title: T('Backup saved'), body: blobs + ' ' + T('big files (videos and recordings) are not in the backup. Save them from Finder with “Save to This Chromebook…”.'), icon: 'settings' });
          };
          const importAll = () => { const i = h('input', { type: 'file', accept: '.json' }); i.onchange = () => { const r = new FileReader(); r.onload = async () => { try { const d = JSON.parse(r.result); if (d.patosBackup) { Object.entries(d.kv || {}).forEach(([k, v]) => PatOS.store.set(k, v)); PatOS.store.set('fs', d.fs); } else Object.entries(d).forEach(([k, v]) => { if (k.startsWith('patos:')) PatOS.store.set(k.slice(6), JSON.parse(v)); }); await PatOS.store.flush(); PatOS._leaving = true; location.reload(); } catch (e) { PatOS.alertBox(T('That file is not a PatOS backup'), T('Choose a PatOS-backup.json file.'), { icon: 'settings' }); } }; r.readAsText(i.files[0]); }; i.click(); };
          return [bar,
            group(row(T('Protect my data'), h('div', { class: 'st-inline' }, pers, h('button', { class: 'btn', onclick: async () => { const ok = await PatOS.askPersist(); PatOS.notify({ title: ok ? T('Your data is protected') : T('Chrome said not yet'), body: ok ? T('The browser won’t clear PatOS when space is low.') : T('Install PatOS as an app and try again.'), icon: 'settings' }); render(); } }, T('Ask Chrome'))), T('Stops the browser from clearing PatOS’s files when the device runs low on space.')),
              row(T('Empty Trash'), h('button', { class: 'btn', onclick: () => { PatOS.fs.emptyTrash(); render(); } }, T('Empty'))),
              row(T('Back up everything'), h('button', { class: 'btn', onclick: exportAll }, T('Download backup…'))),
              row(T('Restore backup'), h('button', { class: 'btn', onclick: importAll }, T('Restore…'))),
              row(T('Erase all content and settings'), h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox(T('Erase PatOS?'), T('Everything in PatOS will be erased and it will start fresh. This cannot be undone.'), { ok: T('Erase'), danger: true, icon: 'settings' })) { await PatOS.store.clearAll(); PatOS._leaving = true; location.reload(); } } }, T('Erase PatOS…'))))];
        }
      };
      const KW = { general: 'name language langue layout disposition full screen plein écran clock horloge seconds secondes 24', appearance: 'dark sombre light clair theme thème color couleur glass verre transparency transparence motion animations', wallpaper: 'background fond écran 3d picture image photo', dock: 'dock icons icônes size taille grow hide masquer widgets home accueil apps', display: 'brightness luminosité 3d quality qualité graphics graphismes webgl', sound: 'volume sounds sons chime son', lock: 'password mot de passe lock verrouiller', network: 'wifi internet connection connexion', keyboard: 'shortcuts raccourcis keys touches alt', storage: 'backup sauvegarde erase effacer trash corbeille reset restore restaurer space espace', accessibility: 'contrast bold text motion focus screen reader lecteur écran accessibilité', permissions: 'camera microphone location notifications permissions', startup: 'install installer app application startup démarrage shelf étagère pin épingler files fichiers open with ouvrir avec full screen plein écran', system: 'device battery memory processor system appareil batterie mémoire' };
      let filter = '';
      const sq = h('input', { class: 'field st-search', placeholder: 'Search', spellcheck: 'false' });
      sq.addEventListener('input', () => { filter = sq.value.trim().toLowerCase(); drawSide(); const hits = PANES.filter(match); if (filter && hits.length && !hits.some((p) => p[0] === pane)) { pane = hits[0][0]; renderMain(); drawSide(); } });
      sq.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const hits = PANES.filter(match); if (hits[0]) { pane = hits[0][0]; renderMain(); drawSide(); } } });
      const match = ([k, l]) => !filter || (l + ' ' + PatOS.t(l) + ' ' + KW[k]).toLowerCase().includes(filter);
      function drawSide() {
        side.querySelectorAll('.st-si, .st-noresult').forEach((e) => e.remove());
        const hits = PANES.filter(match);
        hits.forEach(([k, l, ic]) => { const b = h('button', { class: 'st-si' + (k === pane ? ' on' : '') }, h('span', { class: 'st-ic' }, ic), l); b.onclick = () => { pane = k; renderMain(); drawSide(); }; side.appendChild(b); });
        if (!hits.length) side.appendChild(h('div', { class: 'st-noresult' }, 'No results'));
      }
      function render(keepSearch) {
        side.innerHTML = '';
        side.appendChild(h('div', { class: 'st-user' }, h('div', { class: 'lock-avatar sm' }, S().userName.charAt(0).toUpperCase()), h('div', {}, h('b', {}, S().userName), h('small', {}, 'PatOS Account'))));
        side.appendChild(sq); if (!keepSearch) { sq.value = filter; }
        drawSide();
        renderMain();
      }
      function renderMain() {
        main.innerHTML = '';
        main.append(h('h1', {}, PANES.find((p) => p[0] === pane)[1]), ...panes[pane]());
        win.setTitle(PANES.find((p) => p[0] === pane)[1]);
      }
      win._pane = (p) => { pane = p; render(); };
      render();
    },
    onArgs(win, args) { if (args.pane) win._pane(args.pane); }
  });
})();
