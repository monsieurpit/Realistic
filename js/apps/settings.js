/* System Settings */
(function () {
  'use strict';
  const { h } = PatOS;
  const ACCENTS = ['#0a84ff', '#bf5af2', '#ff375f', '#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#64d2ff', '#8e8e93'];
  const PANES = [
    ['general', 'General', '⚙️'], ['appearance', 'Appearance', '🎨'], ['wallpaper', 'Wallpaper', '🖼'], ['dock', 'Home Screen & Dock', '🧭'],
    ['display', 'Displays & 3D', '🖥'], ['sound', 'Sound', '🔊'], ['lock', 'Lock Screen', '🔒'], ['network', 'Network', '📶'],
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
            group(row('Your name', name), row('Language', (() => { const s2 = h('select', { class: 'field' }, ...[['auto', 'Automatic (device language)'], ['en', 'English'], ['fr', 'French']].map(([v, l]) => h('option', { value: v, selected: (S().language || 'auto') === v }, l))); s2.onchange = async () => { const v = s2.value; if (await PatOS.confirmBox(PatOS.t('Language'), PatOS.t('PatOS restarts to change the language.'), { ok: PatOS.t('Restart'), icon: 'settings' })) { PatOS.setSetting('language', v); setTimeout(() => location.reload(), 200); } else s2.value = S().language || 'auto'; }; return s2; })(), PatOS.lang === 'fr' ? 'Langue de l’appareil : ' + (PatOS.deviceLang === 'fr' ? 'français' : 'anglais') : 'Device language: ' + (PatOS.deviceLang === 'fr' ? 'French' : 'English')), row('Layout', select('deviceMode', [['auto', 'Automatic (phone or computer)'], ['desktop', 'Computer'], ['mobile', 'Phone']]), 'Automatic uses the phone layout on small touch screens'), row('Ask for full screen at login', toggle('askFullscreen'), 'Makes PatOS feel like a real OS'), row('24-hour clock', toggle('clock24')), row('Show seconds in menu bar', toggle('showSeconds'))),
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
          const c = navigator.connection || {};
          return [h('h3', {}, 'Network'), group(row('Status', h('span', { class: 'st-val' }, navigator.onLine ? 'Connected' : 'Offline')), row('Connection type', h('span', { class: 'st-val' }, c.effectiveType ? c.effectiveType.toUpperCase() : 'Unknown')), row('Speed estimate', h('span', { class: 'st-val' }, c.downlink ? c.downlink + ' Mbps' : 'Unknown')))];
        },
        keyboard() {
          const sc = [['Ctrl+Space / Alt+Space', 'Spotlight search'], ['Alt+L or F4', 'Launchpad'], ['Alt+↑ or F3', 'Mission Control'], ['Alt+W', 'Close window'], ['Alt+Q', 'Quit app'], ['Alt+M', 'Minimize'], ['Alt+F', 'Zoom window'], ['Alt+← / Alt+→', 'Tile window left / right'], ['Alt+N', 'New window'], ['Alt+`', 'Cycle windows'], ['Alt+T', 'Terminal'], ['Alt+E', 'Finder'], ['Alt+B', 'Patoogle browser'], ['Alt+,', 'Settings'], ['Alt+Esc', 'Lock screen'], ['Esc', 'Close menus & overlays']];
          return [h('h3', {}, 'Keyboard Shortcuts'), h('p', { class: 'st-note' }, 'PatOS uses Alt because Chromebooks reserve most Ctrl shortcuts.'), group(...sc.map(([k, d]) => row(d, h('kbd', {}, k))))];
        },
        storage() {
          const used = PatOS.store.usage(); const cap = 5 * 1024 * 1024;
          return [h('h3', {}, 'Storage'), h('div', { class: 'st-storage' }, h('div', { class: 'fd-bar big' }, h('span', { style: { width: Math.min(100, used / cap * 100) + '%' } })), h('small', {}, PatOS.fmtBytes(used) + ' used of about 5 MB browser storage')),
            group(row('Empty Trash', h('button', { class: 'btn', onclick: () => { PatOS.fs.emptyTrash(); render(); } }, 'Empty')),
              row('Back up everything', h('button', { class: 'btn', onclick: () => { const all = {}; try { Object.keys(localStorage).filter((k) => k.startsWith('patos:')).forEach((k) => (all[k] = localStorage.getItem(k))); } catch (e) {} PatOS.downloadFile('PatOS-backup.json', JSON.stringify(all)); } }, 'Download Backup')),
              row('Restore backup', h('button', { class: 'btn', onclick: () => { const i = h('input', { type: 'file', accept: '.json' }); i.onchange = () => { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, v)); location.reload(); } catch (e) { PatOS.alertBox('That file is not a PatOS backup', 'Choose a PatOS-backup.json file.', { icon: 'settings' }); } }; r.readAsText(i.files[0]); }; i.click(); } }, 'Restore…')),
              row('Erase all content and settings', h('button', { class: 'btn danger', onclick: async () => { if (await PatOS.confirmBox('Erase PatOS?', 'Everything in PatOS will be erased and it will start fresh. This cannot be undone.', { ok: 'Erase', danger: true, icon: 'settings' })) { PatOS.store.clearAll(); location.reload(); } } }, 'Erase PatOS…')))];
        }
      };
      const KW = { general: 'name language langue layout disposition full screen plein écran clock horloge seconds secondes 24', appearance: 'dark sombre light clair theme thème color couleur glass verre transparency transparence motion animations', wallpaper: 'background fond écran 3d picture image photo', dock: 'dock icons icônes size taille grow hide masquer widgets home accueil apps', display: 'brightness luminosité 3d quality qualité graphics graphismes webgl', sound: 'volume sounds sons chime son', lock: 'password mot de passe lock verrouiller', network: 'wifi internet connection connexion', keyboard: 'shortcuts raccourcis keys touches alt', storage: 'backup sauvegarde erase effacer trash corbeille reset restore restaurer space espace' };
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
