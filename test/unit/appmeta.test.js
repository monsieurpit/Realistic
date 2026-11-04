/* Per-app loading: js/appmeta.js and the type="patos/lazy" marks in index.html must be what scripts/appmeta.js says today. (Run node build.js to refresh them.) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { generate } = require('../../scripts/appmeta.js');
const ROOT = path.join(__dirname, '..', '..');

test('js/appmeta.js is up to date', () => {
  const r = generate(false);
  assert.equal(fs.readFileSync(path.join(ROOT, 'js', 'appmeta.js'), 'utf8'), r.text, 'run node build.js');
});
test('exactly the self-contained app files are marked to load on demand', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); const r = generate(false).analysis; const lazy = new Set(r.lazy);
  const marked = [...html.matchAll(/<script type="patos\/(js|lazy)" src="(js\/apps\/[^"]+)"><\/script>/g)];
  assert.ok(marked.length > 50);
  marked.forEach(([, type, file]) => assert.equal(type, lazy.has(file) ? 'lazy' : 'js', file + ' is marked wrong (node build.js)'));
  assert.ok(r.lazy.length >= 40, 'most apps load on demand: ' + r.lazy.length);
  assert.ok(html.indexOf('js/appmeta.js') > html.indexOf('js/core.js') && html.indexOf('js/appmeta.js') < html.indexOf('js/apps/'), 'the name list loads after the core and before the apps');
  // every lazy file is cached for offline use (the service worker's list comes from index.html)
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); r.lazy.forEach((f) => assert.ok(sw.includes('"' + f + '"'), f + ' is not in the offline cache'));
});
test('the single-file build (one HTML file, for Artifacts and offline use) has every app inside and no on-demand marks', () => {
  const single = fs.readFileSync(path.join(ROOT, 'dist', 'PatOS.html'), 'utf8');
  assert.ok(!/patos\/lazy/.test(single) && !/PatOS\.appRank = /.test(single) && single.includes("id: 'calculator'"), 'every app is in the single file');
});
