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

test('Reminders: quick add understands dates, times, priority and lists', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(() => {
    const now = new Date(2026, 10, 3, 10, 0); const lists = [{ id: 'h', name: 'Homework' }];
    return ['Math test friday at 3pm !!', 'Devoir de français demain 15h', 'Read chapter 5', 'Essay due nov 12 #Homework', 'Gym 6:30am']
      .map((t) => { const p = PatOS.parseReminder(t, lists, now); return [p.text, p.due || '', p.time || '', p.prio || 0, p.list || ''].join('|'); });
  });
  assert.deepEqual(r, ['Math test|2026-11-06|15:00|2|', 'Devoir de français|2026-11-04|15:00|0|', 'Read chapter 5|||0|', 'Essay due|2026-11-12||0|h', 'Gym|2026-11-04|06:30|0|']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Calendar: repeating events, quick add, alerts and .ics', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return PatOS.dateKey(x); };
    const soon = new Date(Date.now() + 20 * 60000); const hm = String(soon.getHours()).padStart(2, '0') + ':' + String(soon.getMinutes()).padStart(2, '0');
    PatOS.store.set('calendar', { [d(0)]: [{ id: 'w', title: 'Math class', time: hm, repeat: 'weekly', alert: '10', skip: [d(14)] }] });
    const w = PatOS.launch('calendar'); await new Promise((res) => setTimeout(res, 300));
    const week = [0, 7, 14, 3].map((n) => PatOS.calendarOn(d(n)).length);
    const quick = PatOS.calendarQuick('Piano every tuesday 4pm');
    const alerts = (PatOS.store.get('alarmQueue') || []).filter((x) => String(x.id).startsWith('cal:')).length;
    const back = PatOS.ics.fromICS(PatOS.ics.toICS(PatOS.store.get('calendar')))[0].ev;
    w.close();
    return { week, quick: [quick.text, quick.time, quick.repeat, new Date(quick.key + 'T12:00').getDay()], alerts, back: [back.title, back.repeat, back.alert, back.skip.length] };
  });
  assert.deepEqual(r.week, [1, 1, 0, 0]);
  assert.deepEqual(r.quick, ['Piano', '16:00', 'weekly', 2]);
  assert.equal(r.alerts, 1);
  assert.deepEqual(r.back, ['Math class', 'weekly', '10', 1]);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Contacts: vCard round trip, old contacts upgraded, duplicates, accent-free search', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    PatOS.store.set('contacts', [{ id: 'old', first: 'Éloïse', last: 'Tremblay', phone: '514-555-0100', email: 'e@x.ca', birthday: '2010-11-04' }]);
    const w = PatOS.launch('contacts'); await wait(300);
    const c0 = PatOS.store.get('contacts')[0];
    out.migrated = !!(window.__x) || (w.body.querySelector('.ct-row span').textContent);
    const vc = 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Roy;Marc;;;\r\nFN:Marc Roy\r\nORG:Café\\, Inc\r\nTEL;TYPE=CELL:(438) 555-0101\r\nTEL;TYPE=WORK:438-555-0199\r\nEMAIL;TYPE=WORK:marc@cafe.ca\r\nBDAY:--0315\r\nNOTE:Line one\\nLine two\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nFN:Éloïse Tremblay\r\nTEL:5145550100\r\nEND:VCARD\r\n';
    const parsed = PatOS.vcard.fromVCard(vc);
    out.parsed = [parsed.length, parsed[0].phones.map((p) => p.l + ':' + p.v).join(','), parsed[0].company, parsed[0].birthday, parsed[0].notes];
    const back = PatOS.vcard.fromVCard(PatOS.vcard.toVCard(parsed.slice(0, 1)))[0];
    out.back = [back.first, back.last, back.company, back.phones.length, back.emails[0].v, back.birthday, back.notes];
    const q = w.body.querySelector('.ct-search input'); q.value = 'eloise'; q.dispatchEvent(new Event('input')); await wait(50);
    out.search = w.body.querySelectorAll('.ct-row').length;
    return out;
  });
  assert.equal(r.migrated, 'Éloïse Tremblay');
  assert.deepEqual(r.parsed, [2, 'mobile:(438) 555-0101,work:438-555-0199', 'Café, Inc', '1900-03-15', 'Line one\nLine two']);
  assert.deepEqual(r.back, ['Marc', 'Roy', 'Café, Inc', 2, 'marc@cafe.ca', '1900-03-15', 'Line one\nLine two']);
  assert.equal(r.search, 1);
  assert.deepEqual(errors, []);
  await page.close();
});
