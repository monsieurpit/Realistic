/* Size budgets from the quality baseline (docs/QUALITY-BASELINE.md, roadmap Task 2). Timing numbers depend on the
   machine, so CI can't hold them; sizes can. These limits leave ~8% headroom over 3.0.0 beta 7, so normal work fits and a
   sudden jump (a library pulled in at start-up, a big file inlined) fails here and has to be a decision, not an accident.
   Raise a budget on purpose, in the same commit, with the reason in the commit message. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sizeOf = (files) => files.reduce((o, f) => { const b = fs.readFileSync(path.join(ROOT, f)); o.kb += b.length / 1024; o.gz += zlib.gzipSync(b, { level: 9 }).length / 1024; return o; }, { kb: 0, gz: 0 });
const scripts = [...html.matchAll(/<script(?: type="patos\/(\w+)")? src="([^"]+)"/g)].map((m) => ({ kind: m[1] || 'plain', src: m[2] }));

const BUDGET = {
  eagerJs: { kb: 1330, gz: 430 },   // 3.0.0 beta 7: 1,223 KB, 398 KB gzipped
  css: { kb: 485 }                  // 3.0.0 beta 7: 447 KB
};

test('JavaScript loaded before login stays within its budget', () => {
  const s = sizeOf(scripts.filter((x) => x.kind === 'js' || x.kind === 'plain').map((x) => x.src));
  assert.ok(s.kb <= BUDGET.eagerJs.kb, 'start-up JS is ' + Math.round(s.kb) + ' KB, budget ' + BUDGET.eagerJs.kb + ' KB');
  assert.ok(s.gz <= BUDGET.eagerJs.gz, 'start-up JS is ' + Math.round(s.gz) + ' KB gzipped, budget ' + BUDGET.eagerJs.gz + ' KB');
});

test('stylesheets stay within their budget', () => {
  const s = sizeOf([...html.matchAll(/href="(css\/[^"]+)"/g)].map((m) => m[1]));
  assert.ok(s.kb <= BUDGET.css.kb, 'CSS is ' + Math.round(s.kb) + ' KB, budget ' + BUDGET.css.kb + ' KB');
});

test('big libraries stay out of start-up (three.js, Firebase, PitCode load on demand)', () => {
  scripts.filter((x) => /three|firebase|pitcode/.test(x.src)).forEach((x) => assert.match(x.kind, /^(3d|firebase|pit)$/, x.src + ' must not load at start-up'));
});
