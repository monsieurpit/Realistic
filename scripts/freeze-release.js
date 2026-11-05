/* Saves a finished version of PatOS in its own folder, releases/<version>/, so people who stay on that version keep getting
   exactly those files while newer ones (a beta, or the next version) are being built.
   Usage:  node scripts/freeze-release.js <version> [folder-with-the-files]
   With no folder, it takes the live files. A frozen version is never overwritten. See update-manager.js. */
'use strict';
const path = require('path');
const updateManager = require('../update-manager.js');
const [version, from] = process.argv.slice(2);
if (!version) { console.error('Usage: node scripts/freeze-release.js <version> [folder]'); process.exit(1); }
try {
  const r = updateManager.create({ root: path.join(__dirname, '..') }).freeze(version, from);
  console.log('Saved ' + r.files + ' files in ' + path.relative(process.cwd(), r.dest));
} catch (e) { console.error(e.message); process.exit(1); }
