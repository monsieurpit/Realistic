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
    const soon = new Date(Date.now() + 20 * 60000); const hm = String(soon.getHours()).padStart(2, '0') + ':' + String(soon.getMinutes()).padStart(2, '0');
    // the event is filed under the day it really happens on (that is tomorrow when the test runs near midnight)
    const d = (n) => { const x = new Date(soon); x.setDate(x.getDate() + n); return PatOS.dateKey(x); };
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

test('Weather: summary, 10 days, units, city suggestions (forecast stubbed)', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d, hr) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(hr) + ':00';
  const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hourly = { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [], is_day: [], visibility: [] };
  for (let i = 0; i < 72; i++) { const d = new Date(start.getTime() + i * 3600000); hourly.time.push(iso(d, d.getHours())); hourly.temperature_2m.push(10 + (i % 24) / 3); hourly.weather_code.push(i === now.getHours() + 4 ? 63 : 1); hourly.precipitation_probability.push(i === now.getHours() + 4 ? 70 : 0); hourly.is_day.push(d.getHours() >= 7 && d.getHours() < 19 ? 1 : 0); hourly.visibility.push(24000); }
  const days = Array.from({ length: 10 }, (_, i) => { const d = new Date(start.getTime() + i * 86400000); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); });
  const forecast = { utc_offset_seconds: -now.getTimezoneOffset() * 60, current: { time: iso(now, now.getHours()), temperature_2m: 12, apparent_temperature: 9, relative_humidity_2m: 60, weather_code: 1, wind_speed_10m: 20, wind_direction_10m: 90, wind_gusts_10m: 45, pressure_msl: 1015, is_day: 1 }, hourly,
    daily: { time: days, weather_code: days.map(() => 3), temperature_2m_max: days.map(() => 14), temperature_2m_min: days.map(() => 4), sunrise: days.map((d) => d + 'T07:12'), sunset: days.map((d) => d + 'T16:48'), uv_index_max: days.map(() => 2), precipitation_sum: days.map(() => 1.2), precipitation_probability_max: days.map(() => 30) } };
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, (r) => r.fulfill({ json: forecast }));
  await page.route(/air-quality-api/, (r) => r.fulfill({ json: { current: { us_aqi: 42 } } }));
  await page.route(/geocoding-api/, (r) => r.fulfill({ json: { results: [{ name: 'Québec', admin1: 'Québec', country: 'Canada', latitude: 46.8, longitude: -71.2 }, { name: 'Quebec City Hall', admin1: 'X', country: 'Y', latitude: 1, longitude: 2 }] } }));
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    const w = PatOS.launch('weather'); await wait(900);
    out.summary = w.body.querySelector('.wx-sum') && w.body.querySelector('.wx-sum').textContent;
    out.days = w.body.querySelectorAll('.wx-day').length; out.tiles = w.body.querySelectorAll('.wx-tile').length;
    out.emoji = /[\u{1F300}-\u{1FAFF}☀-➿]/u.test(w.body.querySelector('.wx').textContent);
    out.wind = [...w.body.querySelectorAll('.wx-tile')].find((t) => /^wind$/i.test(t.querySelector('.wx-ch').textContent.trim())).querySelector('.wx-tv').textContent;
    w.body.querySelector('.wx-top .wx-unit:last-child').click(); await wait(200);
    out.windF = [...w.body.querySelectorAll('.wx-tile')].find((t) => /^wind$/i.test(t.querySelector('.wx-ch').textContent.trim())).querySelector('.wx-tv').textContent;
    const s = w.body.querySelector('.wx-search'); s.value = 'queb'; s.dispatchEvent(new Event('input')); await wait(500);
    out.sug = w.body.querySelectorAll('.wx-sg').length;
    s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await wait(600);
    out.city = w.body.querySelector('.wx-city').textContent; out.saved = PatOS.store.get('weatherPlaces').length;
    return out;
  });
  assert.match(r.summary, /^Rain expected around/);
  assert.equal(r.days, 10); assert.equal(r.tiles, 10); assert.equal(r.emoji, false);
  assert.equal(r.wind, '20 km/h'); assert.equal(r.windF, '12 mph');
  assert.equal(r.sug, 2); assert.equal(r.city, 'Québec'); assert.equal(r.saved, 2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Photos: small thumbnails, large photos, select, albums, zoom and info', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1200, height: 760 } }); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    const pic = (w, h, hue) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, `hsl(${hue},80%,50%)`); g.addColorStop(1, `hsl(${hue + 60},80%,30%)`); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { x.fillStyle = `hsla(${Math.random() * 360},70%,60%,.5)`; x.fillRect(Math.random() * w, Math.random() * h, 30, 30); } return c; };
    for (let i = 0; i < 4; i++) PatOS.fs.write(`/Pictures/p${i}.jpg`, pic(1600, 1000, i * 70).toDataURL('image/jpeg', 0.92));
    const blob = await new Promise((res) => pic(900, 600, 200).toBlob(res, 'image/png')); await PatOS.fs.writeBlob('/Pictures/big.png', blob);
    const w = PatOS.launch('photos'); w.toggleMax(); await wait(1200);
    const imgs = [...w.body.querySelectorAll('.ph-thumb img')];
    out.count = imgs.length; out.loaded = imgs.filter((i) => i.src.startsWith('data:image/jpeg')).length;
    out.thumbSmall = imgs.every((i) => i.src.length < 60000);
    out.names = [...w.body.querySelectorAll('.ph-thumb')].map((t) => t.getAttribute('aria-label')).sort().join(',');
    // select two and add to a new album
    w.el.querySelector('.ph-selbtn').click(); await wait(100);
    const th = w.body.querySelectorAll('.ph-thumb'); th[0].click(); th[1].click(); await wait(50);
    out.selected = w.body.querySelector('.ph-selcount').textContent;
    PatOS.ask = async () => 'Trip';
    const addBtn = [...w.body.querySelectorAll('.ph-selbar .btn')].find((b) => /Add to Album/.test(b.textContent)); addBtn.click(); await wait(100);
    document.querySelectorAll('.menu .menu-item').forEach((m) => { if (/New Album/.test(m.textContent)) m.click(); }); await wait(500);
    const a = PatOS.store.get('photoAlbums', []); out.album = a.length && [a[0].name, a[0].paths.length];
    out.albumShows = w.body.querySelectorAll('.ph-thumb').length;
    // viewer: zoom with the wheel, then info
    w.el.querySelector('.ph-selbtn').click(); await wait(50);
    w.body.querySelectorAll('.ph-thumb')[0].click(); await wait(500);
    const stage = w.body.querySelector('.ph-stage'); const img = stage.querySelector('img');
    stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, clientX: 600, clientY: 400, bubbles: true, cancelable: true })); await wait(50);
    out.zoomed = /scale\((?!1\))/.test(img.style.transform);
    w.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true })); await wait(80);
    out.info = w.body.querySelector('.ph-info') && !w.body.querySelector('.ph-info').classList.contains('hidden') && w.body.querySelector('.ph-info').textContent.includes('×');
    return out;
  });
  assert.equal(r.count, 5); assert.equal(r.loaded, 5); assert.equal(r.thumbSmall, true);
  assert.equal(r.names, 'big.png,p0.jpg,p1.jpg,p2.jpg,p3.jpg');
  assert.equal(r.selected, '2 photos selected');
  assert.deepEqual(r.album, ['Trip', 2]); assert.equal(r.albumShows, 2);
  assert.equal(r.zoomed, true); assert.equal(r.info, true);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Paint: drawing, opacity, shapes, undo, rotate, save and reopen', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1200, height: 760 } }); const errors = await boot(page, srv.base, { fresh: true });
  const w = await page.evaluateHandle(() => { const x = PatOS.launch('paint'); x.toggleMax(); return x; });
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => { const r = document.querySelector('.pt-over').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const px = (x, y) => page.evaluate(([x, y]) => { const c = document.querySelector('.pt-canvas'); const r = c.getBoundingClientRect(); const d = c.getContext('2d').getImageData(Math.round((x - r.left) * c.width / r.width), Math.round((y - r.top) * c.height / r.height), 1, 1).data; return [...d]; }, [x, y]);
  // a red brush stroke
  await page.evaluate(() => { document.querySelector('.pt-pick').value = '#ff0000'; document.querySelector('.pt-pick').dispatchEvent(new Event('input')); });
  const y0 = box.y + 100;
  await page.mouse.move(box.x + 100, y0); await page.mouse.down(); await page.mouse.move(box.x + 300, y0, { steps: 8 }); await page.mouse.up();
  const stroke = await px(box.x + 200, y0);
  // 50% opacity: overlapping the same line twice in one stroke must not get darker than one pass
  await page.evaluate(() => { const a = document.querySelector('.pt-alpha'); a.value = 50; a.dispatchEvent(new Event('input')); });
  const y1 = box.y + 200;
  await page.mouse.move(box.x + 100, y1); await page.mouse.down(); await page.mouse.move(box.x + 300, y1, { steps: 6 }); await page.mouse.move(box.x + 100, y1, { steps: 6 }); await page.mouse.up();
  const soft = await px(box.x + 200, y1);
  // a filled rectangle
  await page.keyboard.press('r'); await page.evaluate(() => document.querySelector('.pt-fillbtn').click());
  await page.evaluate(() => { const a = document.querySelector('.pt-alpha'); a.value = 100; a.dispatchEvent(new Event('input')); });
  await page.mouse.move(box.x + 400, box.y + 300); await page.mouse.down(); await page.mouse.move(box.x + 500, box.y + 380, { steps: 4 }); await page.mouse.up();
  const rect = await px(box.x + 450, box.y + 340);
  // undo removes the rectangle, rotate swaps the size
  await page.keyboard.press('Control+z'); const gone = await px(box.x + 450, box.y + 340);
  const dims = await page.evaluate(() => { const c = document.querySelector('.pt-canvas'); return [c.width, c.height]; });
  await page.evaluate(() => document.querySelector('.pt-win .tbtn[title="Rotate"]').click()); await page.waitForTimeout(100);
  const dims2 = await page.evaluate(() => { const c = document.querySelector('.pt-canvas'); return [c.width, c.height]; });
  // save and reopen
  await page.evaluate(() => { PatOS.ask = async () => 'Test Drawing.png'; }); await page.evaluate(() => PatOS.wm.active._paint.save()); await page.waitForTimeout(400);
  const saved = await page.evaluate(() => { const n = PatOS.fs.get('/Pictures/Test Drawing.png'); return n && n.content.startsWith('data:image/png'); });
  await page.evaluate(() => { PatOS.wm.closeAll(); const x = PatOS.launch('paint', { path: '/Pictures/Test Drawing.png' }); }); await page.waitForTimeout(700);
  const reopened = await page.evaluate(() => { const c = document.querySelector('.pt-canvas'); return [c.width, c.height]; });
  assert.deepEqual(stroke.slice(0, 3), [255, 0, 0]);
  assert.ok(soft[0] === 255 && soft[1] > 100 && soft[1] < 160, 'half-opaque red on white should be about 50% (got ' + soft + ')');
  assert.deepEqual(rect.slice(0, 3), [255, 0, 0]);
  assert.deepEqual(gone.slice(0, 3), [255, 255, 255]);
  assert.deepEqual(dims2, [dims[1], dims[0]]);
  assert.equal(saved, true); assert.deepEqual(reopened, dims2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Messages: Pat runs timers, alarms, calendar, reminders, conversions and finds files (English and French)', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {}; const say = (t) => PatOS.assistantReply(t);
    PatOS.launch('calendar').close(); await wait(100);
    out.timer = say('timer 10 min'); out.queue = (PatOS.store.get('alarmQueue') || []).length;
    out.badTimer = say('timer soon');
    out.alarm = say('wake me at 7:30'); out.alarms = PatOS.store.get('alarms').map((a) => a.time + a.repeat).join();
    out.event = say('add event lunch today at 12pm'); out.cal = say('what is on my calendar today?');
    PatOS.store.set('reminders', [{ id: 1, text: 'Math homework', done: false, due: PatOS.dateKey(new Date()) }]); out.due = say('my reminders');
    out.pct = say('15% of 80'); out.conv = say('5 km to mi'); out.math = say('2 + 3 * 4');
    PatOS.fs.write('/Documents/Zebra essay.txt', 'x'); out.find = say('find file zebra');
    out.pick = say('pick pizza or tacos'); out.near = say('galxy'); out.open = say('open galaxy'); out.clear = say('clear');
    PatOS.lang = 'fr'; out.frTimer = say('minuteur 5 min'); out.frAlarm = say('réveille-moi à 6h45'); out.frCal = say('qu’est-ce que j’ai aujourd’hui?'); out.frConv = say('convertis 5 km en mi'); PatOS.lang = 'en';
    return out;
  });
  assert.match(r.timer, /^Timer set for 10 min/); assert.equal(r.queue, 1); assert.match(r.badTimer, /How long/);
  assert.match(r.alarm, /^Alarm set for/); assert.equal(r.alarms, '07:30once');
  assert.match(r.event, /^Added “lunch”/); assert.match(r.cal, /lunch/); assert.match(r.due, /Math homework/);
  assert.equal(r.pct, '15% of 80 = 12'); assert.equal(r.conv, "5 km = 3.107 mi"); assert.equal(r.math, '2 + 3 * 4 = 14');
  assert.match(r.find, /Zebra essay\.txt/); assert.match(r.pick, /^I pick: (pizza|tacos)\.$/); assert.match(r.near, /Did you mean Galaxy/);
  assert.match(r.open, /opening Galaxy/); assert.equal(r.clear, '\u0000clear');
  assert.match(r.frTimer, /^Minuteur réglé/); assert.match(r.frAlarm, /^Alarme réglée/); assert.match(r.frCal, /lunch|Rien|calendrier/); assert.match(r.frConv, /3[.,]107/);
  assert.deepEqual(errors, []);
  await page.close();
});
