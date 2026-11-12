/* A Windows laptop (HP EliteBook...): the same PatOS, with its own words, thin scrollbars, a small screen that fits, and a speed mode. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CROS = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

test('on Windows the words say computer, on a Chromebook they say Chromebook', { skip: skipNoBrowser }, async () => {
  for (const [ua, word, cls] of [[WIN, 'computer', true], [CROS, 'Chromebook', false]]) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, userAgent: ua }); const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
    const r = await page.evaluate(() => ({ a: PatOS.t('Save to This Chromebook…'), c: PatOS.t('Allow saving to this Chromebook?'), d: PatOS.t('Linking a folder needs Chrome on a computer, with PatOS opened from its website.'), win: document.documentElement.classList.contains('win'), hw: PatOS.hw.windows }));
    if (cls) { assert.equal(r.a, 'Save to This Computer…'); assert.equal(r.c, 'Allow saving to this computer?'); assert.ok(!/Chromebook/.test(r.d)); assert.equal(r.win, true); }
    else { assert.equal(r.a, 'Save to This Chromebook…'); assert.ok(r.d.length > 10); assert.equal(r.win, false); }
    assert.ok(r.a.includes(word === 'computer' ? 'Computer' : 'Chromebook')); assert.deepEqual(errors, []); await ctx.close();
  }
});

test('in French a Windows laptop reads ordinateur, never Chromebook', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, userAgent: WIN, locale: 'fr-CA' }); const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(() => [PatOS.t('Save to This Chromebook…'), PatOS.t('Allow saving to this Chromebook?'), PatOS.t('Open from This Chromebook…'), PatOS.t('Low (best for older Chromebooks)'), PatOS.t('In the Chromebook’s Settings, search “Restore apps on startup” and choose Always.')]);
  assert.deepEqual(r.slice(0, 3), ['Enregistrer sur cet ordinateur…', 'Autoriser l’enregistrement sur cet ordinateur ?', 'Ouvrir depuis cet ordinateur…']);
  for (const x of r) assert.ok(!/Chromebook/.test(x), x); assert.ok(/vieux ordinateurs/.test(r[3])); assert.deepEqual(errors, []); await ctx.close();
});

test('the whole desktop fits a 1366x768 laptop and the speed mode switches the blur off', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, userAgent: WIN }); const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const o = {}; PatOS.launch('settings'); await new Promise((x) => setTimeout(x, 300));
    const H = document.documentElement; o.before = H.classList.contains('perf-light');
    PatOS.setSetting('perfMode', 'light'); o.light = H.classList.contains('perf-light') && H.classList.contains('reduce-transparency');
    PatOS.setSetting('perfMode', 'full'); o.full = !H.classList.contains('perf-light');
    PatOS.setSetting('perfMode', 'auto'); o.score = PatOS.perf.measure() && PatOS.perf.score;
    const w = document.querySelector('.window'); const rc = w.getBoundingClientRect(); o.fits = rc.right <= innerWidth && rc.bottom <= innerHeight;
    o.noScroll = document.documentElement.scrollWidth <= innerWidth;
    return o;
  });
  assert.equal(r.light, true); assert.equal(r.full, true); assert.ok(r.score > 0); assert.equal(r.fits, true); assert.equal(r.noScroll, true); assert.deepEqual(errors, []); await ctx.close();
});
