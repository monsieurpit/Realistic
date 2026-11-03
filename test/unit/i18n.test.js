/* The French dictionary: no key written twice (the second would silently win), and a report of
   English strings shown with T(...) that have no French yet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8');
const fr = src.slice(src.indexOf('const FR = {'), src.indexOf('\n  };', src.indexOf('const FR = {')));
const keys = [...fr.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'/g)].map((m) => m[1]);

test('no French key is written twice', () => {
  const seen = new Set(), dup = [];
  keys.forEach((k) => { if (seen.has(k)) dup.push(k); seen.add(k); });
  assert.deepEqual(dup, []);
});
test('report: strings without a French translation', () => {
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && !p.endsWith('i18n.js')) files.push(p); } })(path.join(ROOT, 'js'));
  const have = new Set(keys); const missing = new Set();
  files.forEach((f) => { const s = fs.readFileSync(f, 'utf8'); for (const m of s.matchAll(/\b(?:PatOS\.t|T)\('((?:[^'\\]|\\.)+)'\)/g)) if (!have.has(m[1]) && /[a-z]/i.test(m[1])) missing.add(m[1]); });
  if (missing.size) console.log('# ' + missing.size + ' strings have no French yet, e.g.: ' + [...missing].slice(0, 8).join(' | '));
  assert.ok(true);
});
