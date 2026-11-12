/* Pat 3 (js/intel-know.js, js/knowledge-data.js, the new panel): facts in English and French, translation through the
   Translate app, the weather, currencies, short web answers with their source and a Google button, small talk, helpers,
   and the premium panel (welcome, answer cards, buttons). The online services are faked here: no real network. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b, ctx, page;
test.before(async () => {
  if (skipNoBrowser) return; srv = await startServer(); b = await browser();
  ctx = await b.newContext({ geolocation: { latitude: 45.5, longitude: -73.57 }, permissions: ['geolocation'], viewport: { width: 1280, height: 820 } });
  await ctx.route(/mymemory\.translated\.net/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ responseData: { translatedText: /buenas/.test(r.request().url()) ? 'x' : 'buenas noches' } }) }));
  await ctx.route(/geocoding-api\.open-meteo\.com/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ latitude: 48.85, longitude: 2.35, name: 'Paris' }] }) }));
  await ctx.route(/\/\/api\.open-meteo\.com/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 4.2, apparent_temperature: 1.1, weather_code: 3 }, daily: { temperature_2m_max: [7, 9], temperature_2m_min: [1, 2], weather_code: [3, 61], precipitation_probability_max: [10, 80], sunrise: ['2026-11-12T06:55'], sunset: ['2026-11-12T16:30'] } }) }));
  await ctx.route(/api\.frankfurter\.app/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ amount: 20, date: '2026-11-12', rates: { CAD: 27.5 } }) }));
  await ctx.route(/wikipedia\.org\/w\/api\.php/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ query: { search: [{ title: 'Marie Curie' }] } }) }));
  await ctx.route(/wikipedia\.org\/api\/rest_v1/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ title: 'Marie Curie', extract: 'Marie Curie was a Polish and naturalised-French physicist and chemist. She was the first woman to win a Nobel Prize. She won it twice.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Marie_Curie' } } }) }));
  page = await ctx.newPage(); await boot(page, srv.base, { fresh: true });
});
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });
const ask = (t) => page.evaluate(async (x) => { const r = await PatOS.intel.respond(x); return r ? { ok: r.ok, message: r.message, card: r.card || null, buttons: (r.buttons || []).map((y) => y.label) } : null; }, t);

test('facts, offline, in English and French', { skip: skipNoBrowser }, async () => {
  assert.match((await ask('what is the capital of Japan')).message, /The capital of Japan is Tokyo/);
  assert.match((await ask('Ottawa is the capital of what country')).message, /Ottawa is the capital of Canada/);
  assert.match((await ask('what is the symbol for gold')).message, /Gold: symbol Au, atomic number 79/);
  assert.match((await ask('how many moons does Jupiter have')).message, /Jupiter has 95/);
  await page.waitForFunction(() => PatOS.intel.parse('what is the tallest mountain?'), null, { timeout: 8000 });
  assert.match((await ask('what is the tallest mountain?')).message, /Everest/);
  assert.match((await ask('what currency is used in Japan')).message, /JPY/);
  const fr = await page.evaluate(async () => { PatOS.lang = 'fr'; const a = (await PatOS.intel.respond('quelle est la capitale du Canada')).message; const b2 = (await PatOS.intel.respond('quel est le symbole de l’or')).message; PatOS.lang = 'en'; return [a, b2]; });
  assert.match(fr[0], /La capitale de Canada est Ottawa/); assert.match(fr[1], /Or : symbole Au/);
});

test('translate uses the Translate app; weather, currencies, sunset, helpers and small talk', { skip: skipNoBrowser }, async () => {
  const tr = await ask('translate good night to Spanish');
  assert.match(tr.message, /“good night” in Spanish: “buenas noches”/); assert.equal(tr.card.value, 'buenas noches');
  await page.waitForSelector('.tr-out'); assert.equal(await page.evaluate(() => document.querySelector('.tr-box').value), 'good night', 'the Translate app shows it');
  assert.match((await ask('how do you say thank you in German')).message, /in German/);
  const wx = await ask('what’s the weather in Paris'); assert.match(wx.message, /It’s 4° and cloudy in Paris \(feels like 1°\)\. Today: 1° to 7°, 10% chance of rain/); assert.deepEqual(wx.buttons, ['Open Weather']);
  assert.match((await ask('will it rain tomorrow in Paris')).message, /Tomorrow in Paris: light rain, 2° to 9°, 80% chance/);
  assert.match((await ask('convert 20 usd to cad')).message, /= CA\$27\.50|27\.50/);
  assert.match((await ask('when is sunset')).message, /Sunset is at/);
  assert.match((await ask('how do you spell banana')).message, /B-A-N-A-N-A/);
  assert.match((await ask('square root of 144')).message, /√144 = 12/);
  assert.match((await ask('tip 15% on 40')).message, /6\.00, for a total of 46\.00/);
  assert.match((await ask('how many letters in hello world')).message, /10 letters/);
  assert.match((await ask('are you an AI?')).message, /Not an AI/);
  assert.equal((await ask('remind me to buy a rain coat')).message.includes('Reminder created'), true, 'a reminder about rain is still a reminder');
});

test('the panel: welcome, a question it looks up on the web (with source and Google button), and answer cards', { skip: skipNoBrowser }, async () => {
  await page.evaluate(() => PatOS.pat.open()); await page.waitForSelector('#pat-panel .pat3-welcome');
  assert.ok(await page.locator('#pat-panel .pat3-card-try').count() >= 4);
  await page.fill('#pat-panel .pat3-in', 'who is Marie Curie'); await page.press('#pat-panel .pat3-in', 'Enter');
  await page.waitForSelector('#pat-panel .pat3-ans', { timeout: 10000 });
  const t = await page.textContent('#pat-panel .pat3-list');
  assert.match(t, /Marie Curie was a Polish[\s\S]*first woman to win a Nobel Prize[\s\S]*Source: Wikipedia/);
  assert.ok(await page.locator('#pat-panel .pat3-act:has-text("Search Google")').count() >= 1);
  await page.fill('#pat-panel .pat3-in', 'what is the capital of Japan'); await page.press('#pat-panel .pat3-in', 'Enter');
  await page.waitForFunction(() => /Tokyo/.test(document.querySelector('#pat-panel .pat3-list').textContent));
  await page.fill('#pat-panel .pat3-in', 'turn on dark mode, set the volume to 30 and start a 25 min timer'); await page.press('#pat-panel .pat3-in', 'Enter');
  await page.waitForSelector('#pat-panel .pat3-ul li.ok');
  assert.ok(await page.locator('#pat-panel .pat3-ul li.ok').count() >= 3, 'each step as its own row');
  await page.screenshot({ path: require('path').join(require('os').tmpdir(), 'patos-pat3.png') });
});
