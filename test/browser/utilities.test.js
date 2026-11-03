/* Small apps: Calculator */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('Calculator: percent, repeated =, inverse trig, history', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    PatOS.store.set('calcSci', false); PatOS.store.set('calcHistory', []);
    const w = PatOS.launch('calculator'); await wait(200);
    const press = (...ks) => ks.forEach((k) => w.body.querySelector(`[data-k="${k}"]`).click());
    const d = () => w.body.querySelector('.calc-disp').textContent;
    press('5', '0', '+', '1', '0', '%', '='); out.pct = d();
    press('AC', '2', '×', '3', '=', '='); out.repeat = d();
    w.body.querySelector('.calc-mode:not(.calc-hbtn)').click(); await wait(50);
    press('AC', '2nd', 'sin⁻¹', '1', ')', '='); out.asin = d();
    press('AC', '|x|', '−', '4', ')', '='); out.abs = d();
    out.hist = PatOS.store.get('calcHistory').length;
    w.body.querySelector('.calc-hbtn').click(); await wait(50);
    w.body.querySelectorAll('.calc-hrow')[2].click(); out.reused = d();
    return out;
  });
  assert.deepEqual(r, { pct: '55', repeat: '18', asin: '90', abs: '4', hist: 5, reused: '18' });
  assert.deepEqual(errors, []);
  await page.close();
});

test('Clock: durations, half-hour time zones, a stopwatch that survives closing', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    out.parse = ['7', '1:30', '1:30:00', '90s', '1h 20m', 'abc'].map(PatOS.parseDuration);
    let w = PatOS.launch('clock', { tab: 0 }); await wait(300);
    w.body.querySelector('.clk-wtop .btn').click(); await wait(100);
    const q = w.body.querySelector('.clk-pick .field'); q.value = 'kolkata'; q.dispatchEvent(new Event('input')); await wait(50);
    w.body.querySelector('.clk-prow').click(); await wait(1200);
    out.kolkata = [...w.body.querySelectorAll('.clk-city')].map((c) => c.querySelector('.clk-sub').textContent).find((x) => /5:30/.test(x)) || null;
    w._tab(2); await wait(100);
    w.body.querySelector('.clk-btn.green').click(); await wait(250);
    w.close(); await wait(300);
    w = PatOS.launch('clock'); await wait(300);
    out.running = PatOS.store.get('clockStopwatch').running && w.body.querySelector('.clk-big').textContent !== '00:00.00';
    return out;
  });
  assert.deepEqual(r.parse, [420000, 90000, 5400000, 90000, 4800000, 0]);
  assert.ok(r.kolkata && /\+5:30 h/.test(r.kolkata), r.kolkata);
  assert.equal(r.running, true);
  assert.deepEqual(errors, []);
  await page.close();
});
