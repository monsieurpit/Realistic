/* Builds examples/device-lab.patapp (the app, ready to import) and examples/device-lab.patappproject (the same app as a PitCode Studio
   project, to read and change) from the three source files in examples/device-lab/. The page is made the way PitCode Studio makes it:
   the stylesheet and script that index.html links are put inside it.
   Usage: node scripts/build-example.js */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('../js/patapp-format.js');
const dir = path.join(__dirname, '..', 'examples', 'device-lab');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const files = { 'index.html': read('index.html'), 'style.css': read('style.css'), 'app.js': read('app.js') };
const meta = { name: 'Device Lab', id: 'com.patos.devicelab', version: '1.0.0', author: 'PatOS', description: 'Tests everything an app can do: files, notifications, clipboard, camera, microphone, location and internet.', icon: 'DL', color: '#5e5ce6',
  permissions: ['files', 'notifications', 'clipboard', 'camera', 'microphone', 'location', 'network'], language: 'web', entry: 'index.html', width: 980, height: 720 };
let html = files['index.html'];
html += '\n<style>\n' + files['style.css'].replace(/<\/style/gi, '<\\/style') + '\n</style>\n<script>\n' + files['app.js'].replace(/<\/script/gi, '<\\/script') + '\n</script>\n';
const v = F.validate({ format: 'patapp', formatVersion: 1, id: meta.id, engine: 'web', name: meta.name, version: meta.version, author: meta.author, description: meta.description, icon: meta.icon, color: meta.color, permissions: meta.permissions, width: meta.width, height: meta.height, html });
if (!v.ok) { console.error(v.error); process.exit(1); }
fs.writeFileSync(path.join(__dirname, '..', 'examples', 'device-lab.patapp'), JSON.stringify(v.app, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, '..', 'examples', 'device-lab.patappproject'), JSON.stringify({ format: 'patappproject', formatVersion: 1, exported: new Date().toISOString().slice(0, 10), meta, files }, null, 2) + '\n');
console.log('examples/device-lab.patapp (' + Math.round(JSON.stringify(v.app).length / 1024) + ' KB) and examples/device-lab.patappproject');
