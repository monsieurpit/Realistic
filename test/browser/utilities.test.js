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
