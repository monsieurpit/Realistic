/* Builds examples/device-lab-pit.patappproject (the PitCode project: main.pitx, lab.pit, tools.pit, styles.pitoss) and
   examples/device-lab-pit.patapp (the app made from it by PitCode Studio's own builder, so the two always agree) from the files in
   examples/device-lab-pit/. It starts PatOS in a headless browser to use Studio's builder (the same one the Build menu uses).
   Usage: node scripts/build-example-pit.js   (needs Playwright, like the tests) */
'use strict';
const fs = require('fs');
const path = require('path');
const { startServer, browser, boot } = require('../test/helpers');
const dir = path.join(__dirname, '..', 'examples', 'device-lab-pit'), out = path.join(__dirname, '..', 'examples');
(async () => {
  const files = {}; fs.readdirSync(dir).sort().forEach((f) => { if (/\.(pitx|pit|pitoss)$/.test(f)) files[f] = fs.readFileSync(path.join(dir, f), 'utf8'); });
  const meta = { name: 'Device Lab PitCode', id: 'com.patos.devicelab.pit', version: '1.0.0', author: 'PatOS', description: 'The Device Lab test app, written in PitCode: files, notifications, clipboard, camera, microphone, location and internet.', icon: 'DL', color: '#0e7490',
    permissions: ['files', 'notifications', 'clipboard', 'camera', 'microphone', 'location', 'network'], language: 'pitcode', entry: 'main.pitx', width: 980, height: 720 };
  const project = { format: 'patappproject', formatVersion: 1, exported: new Date().toISOString().slice(0, 10), meta, files };
  const text = JSON.stringify(project, null, 2) + '\n';
  const srv = await startServer(); const b = await browser(); const page = await b.newPage();
  try {
    await boot(page, srv.base, { fresh: true });
    const app = await page.evaluate((t) => { const p = PatOS.studio.parseProject(t); return PatOS.studio.toApp({ name: p.meta.name, meta: p.meta, files: p.files }); }, text);
    fs.writeFileSync(path.join(out, 'device-lab-pit.patappproject'), text);
    fs.writeFileSync(path.join(out, 'device-lab-pit.patapp'), JSON.stringify(app, null, 2) + '\n');
    console.log('examples/device-lab-pit.patapp (' + Math.round(JSON.stringify(app).length / 1024) + ' KB) and examples/device-lab-pit.patappproject');
  } finally { await b.close(); srv.stop(); }
})().catch((e) => { console.error(e); process.exit(1); });
