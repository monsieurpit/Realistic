/* Bundles vendor-src/firebase-entry.js and the Firebase SDK into one file, vendor/firebase.js (global: PatFirebase).
   Run it after changing vendor-src/firebase-entry.js or updating the firebase package:  npm run build:firebase
   The bundle is committed, so Railway does not need to build anything. */
const esbuild = require('esbuild');
const path = require('path');
const root = path.join(__dirname, '..');
esbuild.build({
  entryPoints: [path.join(root, 'vendor-src', 'firebase-entry.js')], bundle: true, minify: true, format: 'iife', globalName: '__PatFirebaseModule',
  footer: { js: 'var PatFirebase = __PatFirebaseModule.default;' }, target: 'es2020', outfile: path.join(root, 'vendor', 'firebase.js'), legalComments: 'none', logLevel: 'info'
}).catch(() => process.exit(1));
