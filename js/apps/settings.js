/* System Settings */
(function () {
  'use strict';
  const { h } = PatOS;
  const T = (x) => PatOS.t(x);
  const ACCENTS = ['#0a84ff', '#bf5af2', '#ff375f', '#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#64d2ff', '#8e8e93'];
  const PANES = [
    ['general', 'General', '⚙️'], ['account', 'Account', '👤'], ['voice', 'Pat Voice', '🎙'], ['update', 'Software Update', '⬇️'], ['appearance', 'Appearance', '🎨'], ['accessibility', 'Accessibility', '♿'], ['wallpaper', 'Wallpaper', '🖼'], ['dock', 'Home Screen & Dock', '🧭'],
    ['display', 'Displays & 3D', '🖥'], ['sound', 'Sound', '🔊'], ['lock', 'Lock Screen', '🔒'], ['network', 'Network', '📶'], ['startup', 'Install & Start Up', '🚀'], ['permissions', 'Permissions', '🛡'], ['system', 'This Device', '💻'],
    ['keyboard', 'Keyboard', '⌨️'], ['storage', 'Storage', '💾'], ['backup', 'Backup & Restore', '🕘'], ['sync', 'Sync', '☁️'], ['privacy', 'Privacy', '🔐']
  ];
  const KW = { voice: 'voice hey pat microphone speech listen talk say wake voix micro parler ecouter', account: 'account username password sign in sign up cloud save login compte nom utilisateur mot de passe connexion creer', privacy: 'privacy apps permissions camera microphone location log confidentialite applications permissions camera micro position journal', sync: 'sync cloud devices iphone chromebook account encrypted key code synchroniser appareils compte chiffre cle', backup: 'backup restore snapshot export import sauvegarde restaurer copie folder dossier recover recuperer data safe', update: 'update mise à jour version new nouveau what changed nouveautés restart redémarrer', general: 'name language langue layout disposition full screen plein écran clock horloge seconds secondes 24', appearance: 'dark sombre light clair theme thème color couleur glass verre transparency transparence motion animations', wallpaper: 'background fond écran 3d picture image photo', dock: 'dock icons icônes size taille grow hide masquer widgets home accueil apps', display: 'brightness luminosité 3d quality qualité graphics graphismes webgl', sound: 'volume sounds sons chime son', lock: 'password mot de passe lock verrouiller', network: 'wifi internet connection connexion', keyboard: 'shortcuts raccourcis keys touches alt', storage: 'backup sauvegarde erase effacer trash corbeille reset restore restaurer space espace', accessibility: 'contrast bold text motion focus screen reader lecteur écran accessibilité', permissions: 'camera microphone location notifications permissions', startup: 'install installer app application startup démarrage shelf étagère pin épingler files fichiers open with ouvrir avec full screen plein écran', system: 'device battery memory processor system appareil batterie mémoire' };
  // Spotlight searches Settings with this list
  PatOS.settingsIndex = () => PANES.map(([k, l]) => ({ pane: k, label: l, keywords: KW[k] || '' }));
  PatOS.registerApp({
    id: 'settings', name: 'System Settings', icon: 'settings', width: 800, height: 560, minWidth: 600, keywords: 'preferences settings control wallpaper theme dark parametres paramètres réglages reglages préférences',
    launch(win, args) {
      const toast = (t) => PatOS.notify({ title: t, body: '', icon: 'settings' });
      let pane = args.pane || 'general';
      const side = h('div', { class: 'st-side' });
      const main = h('div', { class: 'st-main' });
      win.body.appendChild(h('div', { class: 'st-wrap' }, side, main));
      // on a phone: the list of settings first, each pane on its own screen
      const MB = PatOS.mobile; if (MB && MB.stack) { MB.stack(win, PatOS.t('Settings')); side.classList.add('m-list'); main.classList.add('m-detail'); }
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
          return [h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('about') }), h('div', {}, h('h2', {}, 'PatOS ' + (PatOS.versionNow ? PatOS.versionNow() : PatOS.version)), h('p', {}, T('A full desktop that runs in your browser, even on a school Chromebook.')))),
            group(row('Your name', name), row('Language', (() => { const s2 = h('select', { class: 'field' }, ...[['auto', 'Automatic (device language)'], ['en', 'English'], ['fr', 'French']].map(([v, l]) => h('option', { value: v, selected: (S().language || 'auto') === v }, l))); s2.onchange = async () => { const v = s2.value; if (await PatOS.confirmBox(PatOS.t('Language'), PatOS.t('PatOS restarts to change the language.'), { ok: PatOS.t('Restart'), icon: 'settings' })) { PatOS.setSetting('language', v); setTimeout(() => (PatOS._leaving = true, location.reload()), 200); } else s2.value = S().language || 'auto'; }; return s2; })(), PatOS.lang === 'fr' ? 'Langue de l’appareil : ' + (PatOS.deviceLang === 'fr' ? 'français' : 'anglais') : 'Device language: ' + (PatOS.deviceLang === 'fr' ? 'French' : 'English')), row('Layout', select('deviceMode', [['auto', 'Automatic (phone or computer)'], ['desktop', 'Computer'], ['mobile', 'Phone']]), 'Automatic uses the phone layout on small touch screens'), row('Ask for full screen at login', toggle('askFullscreen'), 'Makes PatOS feel like a real OS'), row(T('Reopen windows when PatOS starts'), toggle('reopenWindows'), T('Your open apps and files come back after a reload or a crash.')), row('24-hour clock', toggle('clock24')), row('Show seconds in menu bar', toggle('showSeconds'))),
            group(row('About this computer', h('button', { class: 'btn', onclick: () => PatOS.launch('about') }, 'About PatOS…')))];
        },
        update() {
          const out = h('div', { class: 'su' });
          const U = PatOS.update;
          const lang = PatOS.lang === 'fr' ? 'fr' : 'en';
          const rt = (r, k) => (r && r[k] ? (typeof r[k] === 'string' ? r[k] : r[k][lang] || r[k].en) : '');
          const label = PatOS.versionLabel || ((r) => 'PatOS ' + (r ? r.version : PatOS.version));
          const fmtDate = (d) => { try { return new Date(d + 'T12:00').toLocaleDateString(PatOS.lang === 'fr' ? 'fr-CA' : undefined, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return d; } };
          const notesOf = (r) => h('ul', { class: 'su-notes' }, ...((r && r.notes && (r.notes[lang] || r.notes.en)) || []).map((n) => h('li', {}, n)));
          const badge = (r) => (r && r.beta ? h('span', { class: 'su-beta' }, T('Beta')) : null);
          const paint = () => {
            out.innerHTML = '';
            const st = U ? U.state : 'none';
            const cur = U ? U.current : (PatOS.releases && PatOS.releases[0]) || { version: PatOS.version };
            const tgt = U && U.target, newer = U && U.newer;
            const status = { idle: T('PatOS checks for updates by itself every few minutes while it is open.'), checking: T('Checking for updates…'), downloading: T('Downloading') + ' ' + label(tgt) + '…', ready: T('A new version is ready to install.'), uptodate: T('PatOS is up to date.'), offline: T('You’re offline. PatOS checks again when the internet is back.'), none: T('Updates come with the PatOS website. This copy of PatOS is a single file.') }[st];
            out.append(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('about') }), h('div', {}, h('h2', {}, label(cur), ' ', badge(cur)), h('p', { class: 'su-status' + (st === 'ready' ? ' ready' : '') }, status))));
            if (st === 'ready' && tgt && newer) {
              out.appendChild(h('div', { class: 'su-card' },
                h('div', { class: 'su-chead' }, h('b', {}, label(tgt), ' ', badge(tgt)), tgt.date ? h('small', {}, fmtDate(tgt.date)) : null),
                rt(tgt, 'title') ? h('div', { class: 'su-title' }, rt(tgt, 'title')) : null, notesOf(tgt),
                tgt.beta ? h('p', { class: 'su-small' }, T('This is a beta: it has the newest features, and maybe a few bugs.')) : null,
                h('p', { class: 'su-small' }, T('PatOS restarts in a few seconds. Your work is saved and your windows come back.')),
                h('div', { class: 'su-btns' }, h('button', { class: 'btn primary', onclick: () => U.restart() }, T('Restart PatOS to Update')))));
            } else if (U) {
              out.appendChild(group(row(T('Check for updates'), h('button', { class: 'btn', disabled: st === 'checking' || st === 'downloading', onclick: () => U.check(true) }, T(st === 'checking' ? 'Checking…' : 'Check Now')), T('Updates are found and downloaded on their own. You choose when to install.'))));
            }
            // the beta switch
            if (U) {
              const sw = h('button', { class: 'switch' + (U.betaOn() ? ' on' : ''), role: 'switch', 'aria-checked': String(U.betaOn()), 'aria-label': T('Beta updates') });
              sw.onclick = () => { U.setBeta(!U.betaOn()); paint(); };
              const nb = U.newestBeta;
              out.appendChild(group(row(T('Beta updates'), sw, (U.betaOn() ? (nb ? T('You are told about each beta as soon as it is ready. Now testing:') + ' ' + label(nb) + '.' : T('You are told about each beta as soon as it is ready. There is no beta right now.')) : T('You are only told about finished updates. Betas can have bugs.')) + ' ' + T('This chooses what you are told, not what is downloaded: PatOS always keeps the newest files from the website, so a beta can start running at your next restart.'))));
            }
            // what's in the version you have, and the ones before
            if (cur && cur.notes) out.append(h('h3', {}, T('What’s new in') + ' ' + label(cur)), h('div', { class: 'su-card' }, h('div', { class: 'su-chead' }, h('b', {}, rt(cur, 'title'), ' ', badge(cur)), cur.date ? h('small', {}, fmtDate(cur.date)) : null), notesOf(cur)));
            const list = ((U && U.releases && U.releases.length ? U.releases : PatOS.releases) || []).filter((x) => idOf(x) !== idOf(cur) && !(newer && tgt && idOf(x) === idOf(tgt)));
            if (list.length) {
              out.appendChild(h('h3', {}, T('Update history')));
              out.appendChild(h('div', { class: 'su-history' }, ...list.map((r) => h('details', { class: 'su-old' }, h('summary', {}, h('b', {}, label(r)), h('span', {}, rt(r, 'title')), h('small', {}, fmtDate(r.date))), notesOf(r)))));
            }
            out.appendChild(group(row(T('Something wrong after an update?'), h('button', { class: 'btn', onclick: () => { pane = 'system'; renderMain(); drawSide(); } }, T('Go Back to the Previous Version…')))));
          };
          const idOf = (r) => (r ? r.version + (r.beta ? 'b' + r.beta : '') : '');
          if (U) { const on = () => { if (pane === 'update' && out.isConnected) paint(); }; const off = PatOS.on('update', on); win.on('closed', off); U.fetchReleases().then(on); if (U.state === 'idle' || U.state === 'uptodate') U.check(false); }
          paint(); return [out];
        },
        backup() {
          const out = h('div', { class: 'bk' }); const B = PatOS.backup;
          const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'settings' });
          const sizeOf = (b) => PatOS.fmtBytes(b);
          const spin = (btn, fn) => async () => { if (btn) btn.disabled = true; try { await fn(); } catch (e) { if (e && e.name !== 'AbortError') msg(T('That didn’t work'), String(e.message || e)); } finally { if (btn) btn.disabled = false; } };
          const restore = (title, run) => B.ui.confirmRestore(title, run), fromFile = (f) => B.ui.fromFile(f), pickFile = () => B.ui.pickFile();
          function exportDialog() {
            const c = B.count(PatOS.fs.exportTree());
            const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
            const big = h('input', { type: 'checkbox', checked: c.blobFiles > 0 && c.blobBytes < 150 * 1048576 }); big.disabled = !c.blobFiles;
            const p1 = h('input', { class: 'field', type: 'password', placeholder: T('Password (optional)'), autocomplete: 'new-password', 'aria-label': T('Password') }), p2 = h('input', { class: 'field', type: 'password', placeholder: T('Type it again'), autocomplete: 'new-password', 'aria-label': T('Password again') });
            const note = h('div', { class: 'bk-note' });
            const go = h('button', { class: 'btn primary' }, T('Export'));
            go.onclick = async () => {
              if (p1.value && p1.value !== p2.value) { note.textContent = T('The two passwords are different.'); return; }
              if (p1.value && p1.value.length < 6) { note.textContent = T('Use at least 6 characters.'); return; }
              go.disabled = true; note.textContent = T('Making the backup…');
              try { const f = await B.exportFile({ blobs: big.checked, password: p1.value || null }); const how = await B.saveFile(f); close(); if (how !== 'cancelled') PatOS.notify({ title: T('Backup file ready'), body: f.name + ' · ' + sizeOf(f.blob.size) + (f.stats.bigSkipped ? ' · ' + f.stats.bigSkipped + ' ' + T('big files left out') : ''), icon: 'settings', duration: 8000 }); }
              catch (e) { go.disabled = false; note.textContent = String(e.message || e); }
            };
            layer.appendChild(h('div', { class: 'dlg ce bk-dlg' }, h('b', {}, T('Export a backup file')), h('p', { class: 'bk-note' }, T('One file with all your files, notes and settings. Keep it somewhere safe, like a USB stick or your Files app.') + ' ' + c.files + ' ' + T('files') + ', ' + sizeOf(c.bytes + c.blobBytes) + '.'),
              c.blobFiles ? h('label', { class: 'ce-row' }, h('span', {}, T('Include big files') + ' (' + c.blobFiles + ', ' + sizeOf(c.blobBytes) + ')'), big) : null,
              h('p', { class: 'bk-note' }, T('A password locks the file. If you forget it, the backup can’t be opened.')), p1, p2, note,
              h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), go)));
            layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); }); layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
            document.body.appendChild(layer); setTimeout(() => p1.focus(), 30);
          }
          const folderBackups = (btn) => B.ui.folderMenu(null, btn);
          const paint = async () => {
            const [persisted, fst] = await Promise.all([B.persist.status(), B.folder.status()]);
            const snaps = B.list(); const inf = B.info();
            out.innerHTML = '';
            out.append(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('settings') }), h('div', {}, h('h2', {}, T('Your data is yours')), h('p', { class: 'su-status' }, T('PatOS keeps everything on this device and works without internet. Backups protect it if the browser’s data is erased, PatOS is removed, or you switch devices.')))));
            const vaultWarn = PatOS.passwords && PatOS.passwords.deviceOnly && PatOS.passwords.all().length;
            if (vaultWarn) out.appendChild(h('div', { class: 'pw-warn bk-warn' }, h('span', {}, T('Your saved passwords are locked with a key that never leaves this device, so a backup can’t open them on another device or after PatOS is erased. Add a master password in Passwords to include them safely.')), h('button', { class: 'btn', onclick: () => PatOS.launch('passwords') }, T('Open Passwords'))));
            out.appendChild(group(row(T('Kept safe by the browser'), persisted ? h('span', { class: 'st-val' }, T('Yes')) : h('button', { class: 'btn', onclick: spin(null, async () => { await B.persist.request(); paint(); }) }, T('Ask')), persisted ? T('The browser won’t clear PatOS’s data when the device is low on space.') : T('The browser may clear PatOS’s data when the device is low on space. Ask it not to.'))));
            // snapshots
            const now = h('button', { class: 'btn' }, T('Back Up Now')); now.onclick = spin(now, async () => { await B.snapshot(T('Snapshot'), 'manual'); toast(T('Snapshot saved')); paint(); });
            const auto = h('button', { class: 'switch' + (B.autoOn() ? ' on' : ''), role: 'switch', 'aria-checked': String(B.autoOn()), 'aria-label': T('Daily snapshot') }); auto.onclick = () => { B.setAuto(!B.autoOn()); paint(); };
            out.append(h('h3', {}, T('Snapshots')), group(row(T('Take a snapshot every day'), auto, T('Keeps the last 7 days inside PatOS. Big files like videos are not copied into snapshots.')), row(T('Snapshot now'), now)));
            if (snaps.length) out.appendChild(h('div', { class: 'bk-list' }, ...snaps.map((x) => {
              const b = h('button', { class: 'btn' }, T('Restore')); b.onclick = spin(b, () => restore(T('Restore PatOS to') + ' ' + B.when(x.t) + '?', () => B.restoreSnapshot(x.key)));
              const del = x.kind === 'auto' ? null : h('button', { class: 'tbtn', title: T('Delete'), 'aria-label': T('Delete'), onclick: async () => { await B.removeSnapshot(x.key); paint(); } }, '×');
              return h('div', { class: 'bk-snap' }, h('div', {}, h('b', {}, B.when(x.t)), h('small', {}, T(x.kind === 'auto' ? 'Daily snapshot' : x.kind === 'before' ? 'Before restoring' : 'Snapshot') + ' · ' + x.files + ' ' + T('files') + ' · ' + sizeOf(x.bytes))), h('div', { class: 'bk-acts' }, b, del));
            })));
            else out.appendChild(h('div', { class: 'bk-empty' }, T('No snapshots yet. The first one is made a few seconds after PatOS opens, then once a day.')));
            // backup file
            const ex = h('button', { class: 'btn', onclick: exportDialog }, T('Export…')), im = h('button', { class: 'btn' }, T('Import…')); im.onclick = spin(im, pickFile);
            out.append(h('h3', {}, T('Backup file')), group(row(T('Save everything to a file'), ex, PatOS.hw && PatOS.hw.ios ? T('On an iPhone the file goes to your Files app.') : T('One file you can keep anywhere. Use it to move PatOS to a new device.')), row(T('Restore from a file'), im, T('Replaces what is here with the backup (a copy of right now is saved first).'))));
            // the folder
            out.appendChild(h('h3', {}, T('Auto-backup folder')));
            if (!fst.supported) out.appendChild(h('div', { class: 'bk-empty' }, T('Folders need Chrome on a computer or Chromebook. On an iPhone, use Export and save the file to Files.')));
            else if (!fst.linked) {
              const ch = h('button', { class: 'btn primary' }, T('Choose Folder…')); ch.onclick = spin(ch, async () => { await B.folder.link(); toast(T('Backup folder set')); paint(); });
              out.appendChild(group(row(T('Back up to a folder'), ch, T('Every day PatOS saves a backup in a folder you choose. It is on your real disk, so it survives even if PatOS or this website is deleted. Already have one? Choose it again to restore from it.'))));
              out.appendChild(h('div', { class: 'bk-empty' }, T('Reinstalled PatOS? Choose your backup folder above, then press Restore.')));
            } else {
              const allow = fst.permission !== 'granted' ? h('button', { class: 'btn primary' }, T('Allow')) : null; if (allow) allow.onclick = spin(allow, async () => { await B.folder.writeNow(true); paint(); });
              const bn = h('button', { class: 'btn' }, T('Back Up Now')); bn.onclick = spin(bn, async () => { const r = await B.folder.writeNow(true); if (!r.ok) throw new Error(r.why === 'permission' ? T('Allow PatOS to save in the folder first.') : r.why); toast(T('Backup saved')); paint(); });
              const rs = h('button', { class: 'btn' }, T('Restore…')); rs.onclick = spin(rs, () => folderBackups(rs));
              const stop = h('button', { class: 'btn', onclick: async () => { await B.folder.unlink(); paint(); } }, T('Stop'));
              out.appendChild(group(row(fst.name, h('div', { class: 'bk-acts' }, allow, bn, rs, stop), fst.permission !== 'granted' ? T('The browser needs a click to let PatOS save here again.') : (fst.last ? T('Last saved') + ' ' + B.when(fst.last) : T('Not saved yet')))));
            }
          };
          const on = () => { if (pane === 'backup' && out.isConnected) paint(); }; const off = PatOS.on('backup', on); win.on('closed', off);
          paint(); return [out];
        },
        account() {
          const out = h('div', { class: 'bk ac' }); const A = PatOS.account;
          const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'settings' });
          const paint = () => {
            out.innerHTML = '';
            out.appendChild(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('settings') }), h('div', {}, h('h2', {}, T('PatOS Account')), h('p', { class: 'su-status' }, T('A username and a password, no email. Everything you have is saved to your account and follows you to every device. A copy stays on each device, so PatOS works offline too.')))));
            if (!A || !A.available()) { out.appendChild(h('div', { class: 'bk-empty' }, T('Accounts need PatOS opened from its web address (https) in a browser that can do encryption.'))); return; }
            if (!A.signedIn()) {
              out.appendChild(group(row(T('Create an account'), h('button', { class: 'btn primary', onclick: () => PatOS.accountUI.open('signup') }, T('Create Account…')), T('Everything on this device is saved to it.')), row(T('Already have one?'), h('button', { class: 'btn', onclick: () => PatOS.accountUI.open('signin') }, T('Sign In…')), T('Your saved things come to this device.'))));
              out.appendChild(h('div', { class: 'bk-empty' }, T('There is no “forgot my password”: your saved things are locked with your password, so nobody can open them without it.'))); return;
            }
            const st = PatOS.sync.status(); const i = A.info();
            const label = A.status().state === 'reauth' ? T('Your sign-in expired. Sign in again to keep saving.') : st.state === 'syncing' ? T('Saving…') : st.state === 'offline' || st.offline ? T('Offline. Your changes are safe here and are saved when you are back online.') : st.error ? T('Saving had a problem. PatOS will try again.') : st.last ? T('Everything is saved') + ' · ' + (PatOS.backup ? PatOS.backup.when(st.last) : '') : T('Not saved yet');
            const now = h('button', { class: 'btn' }, T('Save Now')); now.onclick = async () => { now.disabled = true; try { await PatOS.sync.now(); } finally { now.disabled = false; } };
            out.appendChild(group(row(T('Signed in as'), h('span', { class: 'st-val' }, '@' + i.username)), row(T('Status'), now, label), row(T('Saved in your account'), h('span', { class: 'st-val' }, st.items + ' ' + T('items')), st.stay ? st.stay + ' ' + T('big files (videos and recordings) stay on this device only.') : T('Files, notes, calendar, contacts, settings, apps and more.'))));
            if (A.status().state === 'reauth') out.appendChild(group(row(T('Sign in again'), h('button', { class: 'btn primary', onclick: () => PatOS.accountUI.open('signin') }, T('Sign In…')))));
            out.appendChild(h('h3', {}, T('Sign out')));
            const so = h('button', { class: 'btn', onclick: async () => { if (await PatOS.confirmBox(T('Sign out?'), T('Everything stays on this device. PatOS stops saving to your account until you sign in again.'), { ok: T('Sign Out'), icon: 'settings' })) { await A.signOut(); paint(); } } }, T('Sign Out…'));
            const del = h('button', { class: 'btn danger', onclick: async () => {
              const pw = await PatOS.ask(T('Delete your account?'), '', { password: true, ok: T('Delete Account'), danger: true, icon: 'settings', text: T('This deletes your username and everything saved in your account (not what is on this device). Messages you sent stay in your friends’ chats. Type your password to confirm.') });
              if (!pw) return; try { await A.deleteAccount(pw); paint(); msg(T('Account deleted'), T('Your account and its saved copy are gone. Everything is still on this device.')); } catch (e) { msg(T('That didn’t work'), String(e.message || e)); } } }, T('Delete Account…'));
            out.appendChild(group(row(T('Stop using this account on this device'), so), row(T('Delete this account'), del, T('Removes your username and the saved copy from the cloud.'))));
          };
          const on = () => { if (pane === 'account' && out.isConnected) paint(); }; const offs = [PatOS.on('account', on), PatOS.on('sync', on)]; win.on('closed', () => offs.forEach((f) => f()));
          paint(); return [out];
        },
        voice() {
          const out = h('div', { class: 'bk vo' }); const V = PatOS.voice;
          const paint = () => {
            out.innerHTML = '';
            out.appendChild(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('messages') }), h('div', {}, h('h2', {}, T('Pat Voice')), h('p', { class: 'su-status' }, T('Say “Hey Pat” and then what you want: “Hey Pat, timer 10 minutes”, “Hey Pat, open Notes”, or the name of one of your Shortcuts.')))));
            if (!V.supported()) { out.appendChild(h('div', { class: 'bk-empty' }, T('This browser cannot listen. Use Chrome or Safari.'))); return; }
            const on = h('button', { class: 'switch' + (V.on() ? ' on' : ''), role: 'switch', 'aria-checked': String(V.on()), 'aria-label': T('Hey Pat') });
            on.onclick = () => { try { V.on() ? V.disable() : V.enable(); } catch (e) { PatOS.alertBox(T('That didn’t work'), String(e.message || e), { icon: 'settings' }); } paint(); };
            const sp = h('button', { class: 'switch' + (V.speaks() ? ' on' : ''), role: 'switch', 'aria-checked': String(V.speaks()), 'aria-label': T('Pat answers out loud') }); sp.onclick = () => { PatOS.store.set('voiceSpeak', !V.speaks()); paint(); };
            out.appendChild(group(row(T('Hey Pat'), on, V.on() ? (V.state().listening ? T('Listening for “Hey Pat” while PatOS is open.') : T('Starting…')) : T('Off. Nothing is listening.')), row(T('Pat answers out loud'), sp, T('Pat also speaks the answer.'))));
            out.appendChild(group(row(T('Try it'), h('button', { class: 'btn', onclick: () => V.speak(T('Hi, I am Pat. Say Hey Pat, and then what you need.')) }, T('Hear Pat')))));
            out.appendChild(h('div', { class: 'bk-empty' }, T('How it works: your browser turns what you say into text. In Chrome, the sound is sent to Google’s speech service to do that. PatOS listens only while this switch is on and PatOS is open, and shows a microphone pill the whole time. Your Shortcuts and the Pat commands do the rest on your device.')));
          };
          const offs = [PatOS.on('voice:state', () => { if (pane === 'voice' && out.isConnected) paint(); })]; win.on('closed', () => offs.forEach((f) => f()));
          paint(); return [out];
        },
        privacy() {
          const out = h('div', { class: 'bk pv' }); const A = PatOS.patapps;
          const paint = () => {
            out.innerHTML = '';
            out.appendChild(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('settings') }), h('div', {}, h('h2', {}, T('Privacy')), h('p', { class: 'su-status' }, T('Apps from the App Store Community run in a locked box. Each one has to ask before it uses your camera, microphone, location, files, clipboard, notifications or the internet. Here you see what each app may do, and what it did.')))));
            const apps = A ? A.list() : [];
            if (!apps.length) out.appendChild(h('div', { class: 'bk-empty' }, T('No community apps are installed. PatOS’s own apps are not listed here.')));
            apps.forEach((r) => {
              const g = A.grants(r.id); const rows = [];
              if (!r.app.permissions.length) rows.push(row(T('Asks for'), h('span', { class: 'st-val' }, T('nothing special'))));
              r.app.permissions.forEach((p) => {
                const st = g[p] || 'ask'; const sw = h('button', { class: 'switch' + (st === 'allow' ? ' on' : ''), role: 'switch', 'aria-checked': String(st === 'allow'), 'aria-label': A.permInfo(p)[0] });
                sw.onclick = () => { A.setGrant(r.id, p, st === 'allow' ? 'deny' : 'allow'); paint(); };
                rows.push(row(A.permInfo(p)[0], h('div', { class: 'st-inline' }, h('span', { class: 'st-val' }, st === 'allow' ? T('Allowed') : st === 'deny' ? T('Not allowed') : T('Will ask')), sw), A.permInfo(p)[1].replace(/^./, (c) => c.toUpperCase()) + '.'));
              });
              rows.push(row(T('Remove this app'), h('button', { class: 'btn', onclick: async () => { if (await A.uninstall(r.id)) paint(); } }, T('Remove…')), r.source === 'store' ? T('Checked by the owner of this PatOS.') : T('Installed from a file. Nobody checked it.')));
              out.appendChild(h('h3', {}, r.app.name + ' ' + r.app.version)); out.appendChild(group(...rows));
            });
            const lg = A ? A.logOf() : [];
            out.appendChild(h('h3', {}, T('Recent activity')));
            if (!lg.length) out.appendChild(h('div', { class: 'bk-empty' }, T('Nothing yet.')));
            else {
              const word = (w) => w === 'used' ? T('used') : w === 'allowed' ? T('was allowed') : w === 'denied' ? T('was denied') : T('was blocked');
              out.appendChild(h('div', { class: 'bk-list pv-log' }, ...lg.slice(0, 40).map((x) => h('div', { class: 'bk-snap' }, h('div', {}, h('b', {}, x.name), h('small', {}, A.permInfo(x.perm)[0] + ' ' + word(x.what))), h('small', {}, PatOS.backup ? PatOS.backup.when(x.t) : new Date(x.t).toLocaleString())))));
              out.appendChild(h('div', { class: 'bk-acts', style: { marginTop: '8px' } }, h('button', { class: 'btn', onclick: () => { A.clearLog(); paint(); } }, T('Clear Activity'))));
            }
          };
          const on = () => { if (pane === 'privacy' && out.isConnected) paint(); }; const off = PatOS.on('patapps', on); win.on('closed', off);
          paint(); return [out];
        },
        sync() {
          const out = h('div', { class: 'bk sy' }); const Y = PatOS.sync;
          const msg = (title, body) => PatOS.alertBox(title, body, { icon: 'settings' });
          const spin = (btn, fn) => async () => { if (btn) btn.disabled = true; try { await fn(); } catch (e) { msg(T('That didn’t work'), T(String(e.message || e))); } finally { if (btn) btn.disabled = false; } };
          let shown = false;
          function joinDialog() {
            const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
            const inp = h('input', { class: 'field', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', spellcheck: 'false', autocapitalize: 'characters', autocomplete: 'off', 'aria-label': T('Sync code') });
            const note = h('div', { class: 'bk-note' }); const go = h('button', { class: 'btn primary' }, T('Join'));
            go.onclick = async () => {
              go.disabled = true; note.textContent = T('Joining…');
              try { await Y.join(inp.value); close(); paint(); } catch (e) { go.disabled = false; note.textContent = T(String(e.message || e)); }
            };
            inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
            layer.appendChild(h('div', { class: 'dlg ce bk-dlg' }, h('b', {}, T('Join Sync')), h('p', { class: 'bk-note' }, T('Type the code shown in Settings › Sync on your other device. Things that are on both devices will use the version from Sync. PatOS keeps a snapshot first, so you can go back.')), inp, note, h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), go)));
            layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); }); layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
            document.body.appendChild(layer); setTimeout(() => inp.focus(), 30);
          }
          function offDialog() {
            const layer = h('div', { class: 'dlg-layer' }); const close = () => layer.remove();
            const wipe = h('input', { type: 'checkbox' });
            const go = h('button', { class: 'btn primary' }, T('Turn Off'));
            go.onclick = async () => { go.disabled = true; const r = await Y.disable(wipe.checked); close(); paint(); if (r.failed) msg(T('Sync is off'), T('Sync is off on this device, but the copy on the server could not be deleted now.')); };
            layer.appendChild(h('div', { class: 'dlg ce bk-dlg' }, h('b', {}, T('Turn off Sync?')), h('p', { class: 'bk-note' }, T('Everything stays on this device. Your other devices keep their own copies too.')),
              h('label', { class: 'ce-row' }, h('span', {}, T('Also delete my encrypted copy from the server')), wipe), h('div', { class: 'dlg-btns' }, h('button', { class: 'btn', onclick: close }, T('Cancel')), go)));
            layer.addEventListener('pointerdown', (e) => { if (e.target === layer) close(); }); layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
            document.body.appendChild(layer);
          }
          const paint = async () => {
            const st = Y.status(); out.innerHTML = '';
            out.appendChild(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-ic', html: PatOS.iconHTML('settings') }), h('div', {}, h('h2', {}, T('Sync')), h('p', { class: 'su-status' }, T('Your files, notes, calendar and settings follow you between your devices. It is optional: PatOS works fully without it, and offline, and changes wait until you are back online. Everything is locked with a key that stays on your devices, so the server only keeps scrambled data.')))));
            if (!Y.available()) { out.appendChild(h('div', { class: 'bk-empty' }, T('This browser can’t do the encryption Sync needs. Open PatOS from its https address, or in a newer browser.'))); return; }
            if (!st.on) {
              const on = h('button', { class: 'btn primary' }, T('Turn On Sync')); on.onclick = spin(on, async () => { await Y.enable(); shown = true; paint(); });
              const jn = h('button', { class: 'btn', onclick: joinDialog }, T('Join with a Code…'));
              out.appendChild(group(row(T('Start Sync on this device'), on, T('Makes a code. Type it on your other devices to connect them.')), row(T('Already use Sync on another device?'), jn)));
              out.appendChild(h('div', { class: 'bk-empty' }, T('Already using Sync? Restoring a backup brings the sync code back too, so a new server fills itself again.')));
              return;
            }
            const label = st.state === 'syncing' ? T('Syncing…') : st.state === 'offline' || st.offline ? T('Waiting for the internet. Your changes are safe here and go out later.') : st.error === 'key' ? T('This server has an account with a different key. Check the code.') : st.error === 'full' ? T('The server is full. Free some space or raise its limit.') : st.error === 'busy' ? T('Too many requests, trying again soon.') : st.error ? T('The server had a problem. Trying again soon.') : st.last ? T('Up to date') + ' · ' + (PatOS.backup ? PatOS.backup.when(st.last) : new Date(st.last).toLocaleString()) : T('Not synced yet');
            const now = h('button', { class: 'btn' }, T('Sync Now')); now.onclick = spin(now, async () => { await Y.now(); });
            out.appendChild(group(row(T('Status'), now, label)));
            const code = Y.code();
            const show = h('button', { class: 'btn' }, shown ? T('Hide') : T('Show Code')); show.onclick = () => { shown = !shown; paint(); };
            const cp = shown ? h('button', { class: 'btn', onclick: () => { try { navigator.clipboard.writeText(code); } catch (e) {} toast(T('Copied')); } }, T('Copy')) : null;
            out.appendChild(group(row(T('Your sync code'), h('div', { class: 'bk-acts' }, cp, show), T('Type this code in Settings › Sync on another device to connect it. Keep it private: it unlocks your data. It is included in backups.')), shown ? h('div', { class: 'sy-code', 'aria-live': 'polite' }, code) : null));
            out.appendChild(group(row(T('On this device'), h('span', { class: 'st-val' }, st.items + ' ' + T('items')), st.stay ? st.stay + ' ' + T('big files (videos and recordings) stay on the device where they are.') : T('Files, notes, calendar, reminders, contacts, flashcards and some settings.'))));
            if (st.hold) { const ok = h('button', { class: 'btn primary' }, T('Sync These Deletions')); ok.onclick = spin(ok, async () => { await Y.now({ force: true }); }); out.appendChild(h('div', { class: 'pw-warn bk-warn' }, h('span', {}, st.hold + ' ' + T('items are missing on this device, so they would be deleted on your other devices too. If that is not what you wanted, restore a snapshot in Backup & Restore first.')), ok)); }
            if (st.rejected) { const rs = h('button', { class: 'btn' }, T('Try Again')); rs.onclick = spin(rs, async () => { await Y.resend(); }); out.appendChild(h('div', { class: 'pw-warn bk-warn' }, h('span', {}, st.rejected + ' ' + T('items could not be saved on the server (it may be full).')), rs)); }
            const sv = h('input', { class: 'field', placeholder: T('This website (recommended)'), value: Y.server_url(), spellcheck: 'false', autocapitalize: 'none', 'aria-label': T('Server address') });
            const svb = h('button', { class: 'btn' }, T('Save')); svb.onclick = spin(svb, async () => { await Y.setServer(sv.value); toast(T('Server saved')); paint(); });
            out.appendChild(group(row(T('Server address'), h('div', { class: 'bk-acts' }, sv, svb), T('Deleted your Railway and made a new one? If this copy of PatOS is still open on the old address, paste the new address here: it sends everything it has to the new server. On the new website itself, restore a backup or join with your code.'))));
            const nc = h('button', { class: 'btn' }, T('Make a New Code…')); nc.onclick = spin(nc, async () => {
              if (!(await PatOS.confirmBox(T('Make a new code?'), T('This device keeps everything and starts fresh on the server with a new code. The old code stops working, so your other devices must join again with the new one.'), { ok: T('Make New Code'), icon: 'settings' }))) return;
              shown = true; await Y.regenerate(); toast(T('New code ready')); paint();
            });
            out.appendChild(group(row(T('New code'), nc, T('Lost your code, or shared it by mistake? Everything on this device is kept, and it can be shared again with a new code.'))));
            out.appendChild(group(row(T('Full copy on this computer'), h('button', { class: 'btn', onclick: () => { pane = 'backup'; renderMain(); drawSide(); } }, T('Open Backup & Restore')), T('Choose a backup folder there: PatOS keeps a copy of everything in it, big files and your Sync code too (up to 1 GB). If PatOS or the website is ever deleted, the folder brings it all back.'))));
            out.appendChild(h('h3', {}, T('Turn off')));
            out.appendChild(group(row(T('Stop syncing this device'), h('button', { class: 'btn', onclick: offDialog }, T('Turn Off…')))));
            Y.server().then((s) => { if (s && out.isConnected && pane === 'sync') { const line = h('div', { class: 'bk-empty' }, T('On the server') + ': ' + s.records + ' ' + T('encrypted items') + ', ' + PatOS.fmtBytes(s.bytes) + ' ' + T('of') + ' ' + PatOS.fmtBytes(s.quota)); const old = out.querySelector('.sy-srv'); if (old) old.remove(); line.classList.add('sy-srv'); out.appendChild(line); } });
          };
          const on = () => { if (pane === 'sync' && out.isConnected) paint(); }; const off = PatOS.on('sync', on); win.on('closed', off);
          paint(); return [out];
        },
        appearance() {
          const modes = h('div', { class: 'st-modes' });
          [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].forEach(([k, l]) => {
            const b = h('button', { class: 'st-mode' + (S().theme === k ? ' on' : '') }, h('div', { class: 'st-mode-pv ' + k }), l);
            b.onclick = () => { PatOS.setSetting('theme', k); render(); }; modes.appendChild(b);
          });
          const acc = h('div', { class: 'st-acc' });
          ACCENTS.forEach((c) => { const b = h('button', { class: 'st-dot' + (S().accent === c ? ' on' : ''), style: { background: c } }); b.onclick = () => { PatOS.setSetting('accent', c); render(); }; acc.appendChild(b); });
          return [h('h3', {}, 'Appearance'), modes, group(row('Highlight color', acc), row('Liquid Glass', toggle('liquidGlass'), 'See-through glass for the dock, menus, panels and widgets'), row('Glass bends the background', toggle('glassRefraction'), 'Works in Chrome. Uses more battery.'), row('Reduce transparency', toggle('reduceTransparency'), T('Solid windows. Runs faster on older Chromebooks.')), row('Fewer animations', toggle('reduceMotion')))];
        },
        wallpaper() {
          const grid = (ids, src) => { const g = h('div', { class: 'st-wps' }); ids.forEach((id) => { const b = h('button', { class: 'st-wp' + (S().wallpaper === id ? ' on' : '') }, h('img', { src: PatOS.wallpaper.thumb(id), alt: '' }), h('span', {}, src[id].name + (src[id].live ? ' ✦' : ''))); b.onclick = () => { PatOS.setSetting('wallpaper', id); if (src[id].live && !S().live3d) PatOS.setSetting('live3d', true); render(); }; g.appendChild(b); }); return g; };
          const upload = h('button', { class: 'btn', onclick: () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 1920 / img.width); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); PatOS.setSetting('customWallpaper', c.toDataURL('image/jpeg', 0.82)); PatOS.setSetting('wallpaper', 'custom'); render(); }; img.src = r.result; }; r.readAsDataURL(f); }; i.click(); } }, 'Choose a Photo…');
          return [h('h3', {}, 'Live 3D Wallpapers'), h('p', { class: 'st-note' }, 'Animated with three.js. They react to your mouse!'), grid(Object.keys(PatOS.wallpaper.live), PatOS.wallpaper.live),
            group(row('Animate 3D wallpaper', toggle('live3d'), PatOS.webgl ? 'Turn off to save battery' : 'WebGL is not available on this device')),
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
            h('h3', {}, T('Speed')), group(row(T('Speed mode'), select('perfMode', [['auto', T('Automatic')], ['light', T('Lighter (faster on slow computers)')], ['full', T('Full looks')]]), T('Lighter turns off the see-through blur and shortens animations. Automatic tests this computer each time PatOS starts.'))), h('h3', {}, '3D Graphics'), group(row('3D quality', select('quality3d', [['low', T('Low (best for older Chromebooks)')], ['auto', 'Balanced'], ['high', 'High (sharpest)']])), row('WebGL', h('span', { class: 'st-val' }, PatOS.has3D ? 'Available (three.js r' + THREE.REVISION + ')' : 'Not available on this device')))];
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
          // update safety: which copy of PatOS is running, and going back to the one before
          const upd = h('div', {});
          const ask = (msg) => new Promise((res) => { const sw = navigator.serviceWorker && navigator.serviceWorker.controller; if (!sw || !window.MessageChannel) return res(null); const ch = new MessageChannel(); const to = setTimeout(() => res(null), 3000); ch.port1.onmessage = (e) => { clearTimeout(to); res(e.data); }; sw.postMessage(msg, [ch.port2]); });
          const paintUpd = async () => {
            const m = await ask({ patosVersion: true }); upd.innerHTML = '';
            if (!m) { upd.appendChild(group(row(T('Updates'), h('span', { class: 'st-val st-wrapval' }, T('Available when PatOS is opened from its website.'))))); return; }
            const short = (k) => String(k || '').replace('patos-', '');
            const onOld = m.useOld && m.previous;
            const btn = onOld
              ? h('button', { class: 'btn', onclick: async () => { await ask({ patosUseNewest: true }); PatOS._leaving = true; location.reload(); } }, T('Use the newest version'))
              : m.previous ? h('button', { class: 'btn', onclick: async () => { if (!(await PatOS.confirmBox(T('Go back to the previous version?'), T('PatOS restarts with the version you had before this update. Your files and settings stay the same.'), { ok: T('Go Back'), icon: 'settings' }))) return; const r = await ask({ patosRollback: true }); if (r && r.ok) { PatOS._leaving = true; location.reload(); } else PatOS.alertBox(T('No previous version'), T('There is no earlier version saved on this device yet.'), { icon: 'settings' }); } }, T('Go back…')) : null;
            upd.appendChild(group(
              row(T('Running'), h('span', { class: 'st-val' }, short(onOld ? m.previous : m.newest) + (onOld ? ' (' + T('previous version') + ')' : ''))),
              row(T('Previous version'), h('div', { class: 'st-inline' }, h('span', { class: 'st-val' }, m.previous ? short(m.previous) : T('none yet')), btn), T('PatOS keeps the version before each update. If an update doesn’t start, PatOS goes back to it by itself.'))));
          };
          paintUpd();
          return [
            group(info(T('System'), os), info(T('Browser'), bname + ' ' + (br[2] || '')), info(T('Device'), PatOS.extApps ? PatOS.extApps.device().name : ''), info(T('Processor threads'), navigator.hardwareConcurrency), info(T('Memory'), navigator.deviceMemory ? '≥ ' + navigator.deviceMemory + ' GB' : ''), info(T('Graphics'), gpu), info(T('Screen'), screen.width + ' × ' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x'), info(T('Touch points'), navigator.maxTouchPoints || '0'), info(T('Language'), (navigator.languages || [navigator.language]).slice(0, 3).join(', ')), info(T('Time zone'), Intl.DateTimeFormat().resolvedOptions().timeZone)),
            group(row(T('Battery'), bat), row(T('Browser storage used'), store), row(T('PatOS version'), h('span', { class: 'st-val' }, (PatOS.versionNow ? PatOS.versionNow() : PatOS.version))), row(T('Time since PatOS opened'), h('span', { class: 'st-val' }, Math.round(performance.now() / 60000) + ' min'))), upd];
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
          return [h('h3', {}, 'Keyboard Shortcuts'), h('p', { class: 'st-note' }, T('PatOS uses Alt because Chromebooks reserve most Ctrl shortcuts.')), group(...sc.map(([k, d]) => row(d, h('kbd', {}, k))))];
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
      let filter = '';
      const sq = h('input', { class: 'field st-search', placeholder: 'Search', spellcheck: 'false' });
      sq.addEventListener('input', () => { filter = sq.value.trim().toLowerCase(); drawSide(); const hits = PANES.filter(match); if (filter && hits.length && !hits.some((p) => p[0] === pane)) { pane = hits[0][0]; renderMain(); drawSide(); } });
      sq.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const hits = PANES.filter(match); if (hits[0]) { pane = hits[0][0]; renderMain(); drawSide(); } } });
      const match = ([k, l]) => !filter || (l + ' ' + PatOS.t(l) + ' ' + KW[k]).toLowerCase().includes(filter);
      function drawSide() {
        side.querySelectorAll('.st-si, .st-noresult').forEach((e) => e.remove());
        const hits = PANES.filter(match);
        hits.forEach(([k, l, ic]) => { const b = h('button', { class: 'st-si' + (k === pane ? ' on' : '') }, h('span', { class: 'st-ic' }, ic), l); b.onclick = () => { pane = k; renderMain(); drawSide(); if (PatOS.mobile && PatOS.mobile.detail) PatOS.mobile.detail(win, true, PatOS.t(l)); }; side.appendChild(b); });
        if (!hits.length) side.appendChild(h('div', { class: 'st-noresult' }, 'No results'));
      }
      function render(keepSearch) {
        side.innerHTML = '';
        side.appendChild(h('div', { class: 'st-user' }, h('div', { class: 'lock-avatar sm' }, S().userName.charAt(0).toUpperCase()), h('div', {}, h('b', {}, S().userName), h('small', {}, PatOS.account && PatOS.account.signedIn() ? '@' + PatOS.account.info().username : PatOS.t('Sign in or create an account')))));
        side.appendChild(sq); if (!keepSearch) { sq.value = filter; }
        drawSide();
        renderMain();
      }
      function renderMain() {
        PatOS.remember && PatOS.remember(win, { pane });
        main.innerHTML = '';
        main.append(h('h1', {}, PANES.find((p) => p[0] === pane)[1]), ...panes[pane]());
        win.setTitle(PANES.find((p) => p[0] === pane)[1]);
      }
      const paneName = (k) => PatOS.t((PANES.find((x) => x[0] === k) || [k, k])[1]);
      win._pane = (p) => { pane = p; render(); if (MB && MB.detail) MB.detail(win, true, paneName(p)); };
      render();
      if (args.pane && MB && MB.detail) MB.detail(win, true, paneName(args.pane));
    },
    onArgs(win, args) { if (args.pane) win._pane(args.pane); }
  });
})();
