/* The PatOS Pill, completed in 4.0: the weather (rain coming, storms from the forecast), Music favourites and what's up next,
   and copies with their speed, the file being copied and the folder they go to. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

// a forecast like open-meteo's, with rain starting in `rainIn` minutes and a storm in `stormIn` hours (or none)
function forecast(rainIn, stormIn) {
  const now = Math.floor(Date.now() / 1000), q = (k) => now - (now % 900) + k * 900;
  const times = [0, 1, 2, 3, 4, 5, 6, 7].map(q);
  const precip = times.map((t) => (rainIn != null && t >= now + rainIn * 60 - 450 ? 1.2 : 0));
  const hours = [0, 1, 2, 3, 4, 5].map((k) => now - (now % 3600) + k * 3600);
  return { current: { temperature_2m: 7.4, weather_code: 3 }, daily: { temperature_2m_max: [11], temperature_2m_min: [2] },
    minutely_15: { time: times, precipitation: precip, temperature_2m: times.map(() => 6) },
    hourly: { time: hours, weather_code: hours.map((_, k) => (stormIn != null && k === stormIn ? 95 : 3)), wind_gusts_10m: hours.map(() => 20) } };
}

test('Pill: the weather now, rain coming, a storm from the forecast; turned off in Settings', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1300, height: 800 } });
  let fc = forecast(null, null);
  await page.route('**/api.open-meteo.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fc) }));
  const errors = await boot(page, srv.base, { fresh: true });
  const list = () => page.evaluate(() => PatOS.pill.list());
  await page.evaluate(() => PatOS.weatherNow()); await page.waitForTimeout(600);
  let l = await list();
  const now = l.all.find((x) => x.id === 'wx:now'); assert.ok(now, JSON.stringify(l.all));
  assert.match(now.title, /7°/); assert.ok(!l.compact.includes('wx:now'), 'the plain weather stays in the overview');
  // rain in about 30 minutes: in the capsule
  fc = forecast(30, null); await page.evaluate(() => PatOS.weatherRefresh()); await page.waitForTimeout(600);
  l = await list(); const rain = l.all.find((x) => x.id === 'wx:rain'); assert.ok(rain, JSON.stringify(l.all)); assert.match(rain.title, /Rain in \d+ min/); assert.ok(l.compact.includes('wx:rain'));
  // a thunderstorm in 2 hours: a warning that says where it comes from
  fc = forecast(null, 2); await page.evaluate(() => PatOS.weatherRefresh()); await page.waitForTimeout(600);
  l = await list(); const sev = l.all.find((x) => x.id === 'wx:severe'); assert.ok(sev, JSON.stringify(l.all)); assert.match(sev.title, /Thunderstorms/); assert.match(sev.sub, /From the forecast/);
  // off in Settings: gone
  await page.evaluate(() => PatOS.setSetting('pillWeather', false));
  assert.ok(!(await list()).all.some((x) => /^wx:/.test(x.id)));
  assert.deepEqual(errors, []); await page.close();
});

test('Pill: Music favourites and up next; copies show their speed, the file and Open the destination folder', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1300, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  // music: a PatOS Original plays; favourite it from the Pill
  await ev(() => PatOS.launch('music')); await page.waitForTimeout(800);
  await ev(() => PatOS.music.toggle()); await page.waitForTimeout(600);
  assert.ok(await ev(() => !!PatOS.music.nowPlaying()));
  assert.equal(await ev(() => PatOS.music.isFavourite()), false);
  await ev(() => PatOS.pill.expand()); await page.waitForTimeout(400);
  await page.click('#pill .pl-act[data-i="star"]'); await page.waitForTimeout(300);
  assert.equal(await ev(() => PatOS.music.isFavourite()), true, 'favourited from the Pill');
  assert.equal(await ev(() => PatOS.music.favourites().length), 1);
  assert.ok(await ev(() => PatOS.music.upcoming(3).length >= 1), 'there is something up next');
  await page.waitForTimeout(2200); await ev(() => PatOS.pill.expand()); await page.waitForTimeout(500);
  assert.match(await ev(() => document.getElementById('pill').textContent), /Up next/, 'the queue shows in the Pill');
  assert.equal(await ev(() => document.querySelector('#pill .pl-act[data-i="star"]').getAttribute('aria-pressed')), 'true', 'the star is lit');
  await ev(() => { PatOS.music.toggle(); PatOS.pill.collapse(); });
  // a copy: speed, the file now, and the folder it goes to
  await ev(() => { PatOS.fs.mkdir('/Documents/Big'); for (let i = 0; i < 60; i++) PatOS.fs.write('/Documents/Big/f' + i + '.txt', 'x'.repeat(20000)); PatOS.fs.mkdir('/Desktop/Copies'); });
  const seen = await ev(() => new Promise((res) => {
    const paths = PatOS.fs.list('/Documents/Big').map((x) => x.path); let best = null;
    const off = PatOS.on('live', () => { const a = PatOS.live.list().find((x) => x.app === 'finder'); if (a && a.stats && a.stats.speed && a.stats.file) best = a; });
    PatOS.fileOps.enqueue('copy', paths, '/Desktop/Copies');
    const t = setInterval(() => { if (!PatOS.live.list().some((x) => x.app === 'finder')) { clearInterval(t); off && off(); res(best && { speed: best.stats.speed, file: best.stats.file, dest: best.stats.dest }); } }, 50);
  }));
  assert.ok(seen && seen.speed > 0 && /^f\d+\.txt$/.test(seen.file) && seen.dest === '/Desktop/Copies', 'measured: ' + JSON.stringify(seen));
  assert.equal(await ev(() => PatOS.fs.list('/Desktop/Copies').length), 60, 'and everything was copied');
  assert.deepEqual(errors, []); await page.close();
});
