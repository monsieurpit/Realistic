/* The design system is used everywhere: every navigation sidebar, sidebar item and empty page an app styles must be one the
   kit (css/ui.css) knows, so none of them drifts into its own look. Add a new one to the lists in css/ui.css (or use PatOS.ui). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const css = fs.readdirSync(path.join(ROOT, 'css')).filter((f) => f !== 'ui.css').map((f) => fs.readFileSync(path.join(ROOT, 'css', f), 'utf8')).join('\n');
const kit = fs.readFileSync(path.join(ROOT, 'css', 'ui.css'), 'utf8');
const NOT_NAV = new Set(['.cc-side', '.sd-side', '.yt-side', '.ytx-side', '.cal-side']); // (listed in css/ui.css: not navigation)
const found = (re) => [...new Set(css.match(re) || [])];

test('every sidebar, sidebar item and empty page is part of the design system', () => {
  const missing = [];
  found(/\.[a-z0-9]+-side\b(?![-\w])/g).filter((c) => !NOT_NAV.has(c)).forEach((c) => { if (!kit.includes(c + ',') && !kit.includes(c + ')')) missing.push(c); });
  found(/\.[a-z0-9]+-(?:si|sitem)\b(?![-\w])/g).forEach((c) => { if (!kit.includes(c + ',') && !kit.includes(c + ')')) missing.push(c); });
  found(/\.[a-z0-9]+-empty\b(?![-\w])/g).forEach((c) => { if (!kit.includes(c + ',') && !kit.includes(c + ')')) missing.push(c); });
  assert.deepEqual(missing, [], 'add these to css/ui.css (or build with PatOS.ui): ' + missing.join(' '));
});

test('the kit is loaded last, and PatOS.ui loads before the apps', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(links[links.length - 1], 'css/ui.css');
  assert.ok(html.indexOf('js/ui.js') < html.indexOf('js/services.js') && html.indexOf('js/ui.js') < html.indexOf('js/apps/'));
});
