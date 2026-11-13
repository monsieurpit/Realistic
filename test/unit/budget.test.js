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
  eagerJs: { kb: 1920, gz: 640 },   // 3.0.0 beta 7: 1,223 KB, 398 KB gzipped; raised in 3.1.0 beta 7 (1,330 KB): Handoff, Pat skills, error log, Liquid Glass motion, Patoogle proxy features, 3.1 notes; raised in 3.1.0 beta 14 (1,403 KB, 455 KB gz): the firmware (boot screens, Recovery, reinstall) must run before login; raised in 3.2.0 beta 3 (1,488 KB): PatOS Intelligence (js/intelligence.js, the action registry used by Pat, Spotlight, Shortcuts and apps) and the shared date parser (js/dates.js, moved out of a lazy app); then 505 KB gz with the settings catalog and diagnostics (start-up files, so Spotlight finds settings before Settings is opened); then 530 KB gz for Intelligence 2 (js/intel-mind.js: conversation memory, questions, places; js/places.js); 545 KB gz for Pat 3 (js/intel-know.js: facts, translate, weather, currencies, web answers; the facts themselves load on demand); 3.3 (547 KB gz): the system services (notifications 2.0, live activities, universal actions, Command Center, Capture, the file queue and versions, Shared Spaces), about 26 KB gz, which must run from the start; 3.3 beta 8 (1,721 KB): sound design, window manager 2.0, the glass renderer and the PatOS Pill (all must run from the start); 3.3 beta 11 (1,772 KB): the process system (js/process.js must be the first thing to run, so it sees every app start); 4.0: the widget platform, desktop configurations and profiles run from the start (the desktop is made of them); the 4.0 apps (Studio, World, Data, Gallery, Commons) load only when opened
  css: { kb: 640 }                  // 3.0.0 beta 7: 447 KB; 3.2.0 beta 5 (492 KB): Pat’s new conversation panel; beta 7 (502 KB, after removing the old orb and dead Messages rules): Settings polish, the wallpaper page and code suggestions; 3.3 (515 KB): Command Center, the crystal Dock, notifications 2.0, and room for the 3.3 system screens; 3.3 beta 8: window tabs and the PatOS Pill; 4.0: widgets, Studio, World, Gallery, Data, Commons and Live
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
