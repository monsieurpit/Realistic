/* One time: makes releases/1.7.0/ from the files of PatOS 1.7.0 as they were released (git commit cf5df9e), plus the small
   "bridge" that lets 1.7.0 use the new update system: the update manager (js/updatemanager.js) in place of the old automatic
   update code in boot.js, and the same update texts in Settings. Nothing else of 1.7.0 changes.
   Why a bridge: the old 1.7.0 could not ask for a version, so a person on it could never move to 2.0.0 on purpose.
   Usage: node scripts/make-1.7.0-release.js   (needs git; refuses to run when releases/1.7.0 already exists) */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const updateManager = require('../update-manager.js');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(f, 'utf8');
const swap = (file, from, to) => { const t = read(file); if (!t.includes(from)) throw new Error('The 1.7.0 bridge could not find its place in ' + path.basename(file)); fs.writeFileSync(file, t.replace(from, to)); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-1.7.0-'));
execSync('git archive cf5df9e | tar -x -C ' + JSON.stringify(tmp), { cwd: root, shell: '/bin/bash' });
if (JSON.parse(read(path.join(tmp, 'updates.json')))[0].version !== '1.7.0') throw new Error('That commit is not 1.7.0.');

const r = updateManager.create({ root }).freeze('1.7.0', tmp, { after(dest) {
  const live = (f) => path.join(root, f), at = (f) => path.join(dest, f);
  fs.copyFileSync(live('js/updatemanager.js'), at('js/updatemanager.js'));
  swap(at('index.html'), '  <script type="patos/js" src="js/version.js"></script>\n', '  <script type="patos/js" src="js/version.js"></script>\n  <script type="patos/js" src="js/updatemanager.js"></script>\n');
  // boot.js: the old update code goes, the update manager takes over (the same edit as in the live files)
  const boot = read(at('js/boot.js'));
  const a = boot.indexOf('  /* Versions: the normal releases, plus a beta being built'), b = boot.indexOf('  /* restart PatOS itself: its boot screen');
  if (a < 0 || b < a) throw new Error('The 1.7.0 bridge could not find the old update code.');
  let out = boot.slice(0, a) + boot.slice(b);
  out = out.replace("  const relText = (r, k) => (r && r[k] ? (typeof r[k] === 'string' ? r[k] : r[k][PatOS.lang === 'fr' ? 'fr' : 'en'] || r[k].en) : '');\n", '');
  out = out.replace('!PatOS.singleFile) setupUpdates();', '!PatOS.singleFile && PatOS.updateManager) PatOS.updateManager.setup({ soft });');
  if (!out.includes('PatOS.updateManager.setup')) throw new Error('The 1.7.0 bridge could not start the update manager.');
  fs.writeFileSync(at('js/boot.js'), out);
  fs.appendFileSync(at('js/version.js'), 'PatOS.build = ' + JSON.stringify({ channel: 'stable', version: '1.7.0', beta: 0 }) + ';\n');
  // the texts of Settings › Software Update that described the old behavior
  swap(at('js/apps/settings.js'), "T('This chooses what you are told, not what is downloaded: PatOS always keeps the newest files from the website, so a beta can start running at your next restart.')", "T('PatOS never changes version by itself, except a beta (with this on), which is downloaded quietly and used the next time PatOS starts. A finished version only installs when you press the update button.')");
  swap(at('js/apps/settings.js'), "T('Updates are found and downloaded on their own. You choose when to install.')", "T('Updates are found on their own. You choose when to download and install them.')");
  const i18n = read(live('js/i18n.js')), line = (key) => i18n.split('\n').find((l) => l.trim().startsWith("'" + key + "':"));
  swap(at('js/i18n.js'), "    'This chooses what you are told, not what is downloaded: PatOS always keeps the newest files from the website, so a beta can start running at your next restart.': 'Ceci choisit ce dont on vous prévient, pas ce qui est téléchargé : PatOS garde toujours les fichiers les plus récents du site, donc une bêta peut commencer à fonctionner à votre prochain redémarrage.',", line('PatOS never changes version by itself, except a beta (with this on), which is downloaded quietly and used the next time PatOS starts. A finished version only installs when you press the update button.'));
  swap(at('js/i18n.js'), "    'Updates are found and downloaded on their own. You choose when to install.': 'Les mises à jour sont trouvées et téléchargées toutes seules. Vous choisissez quand les installer.',", line('Updates are found on their own. You choose when to download and install them.'));
} });
console.log('Saved ' + r.files + ' files in ' + path.relative(process.cwd(), r.dest));
