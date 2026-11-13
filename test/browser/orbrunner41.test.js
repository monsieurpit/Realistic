/* Orb Runner (4.1): worlds every 1,500 points, the Ball Shop (gems are money), power-ups. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, boot, skipNoBrowser, playwright } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await playwright().chromium.launch({ channel: 'chromium' }); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('Orb Runner: the shop, worlds, power-ups, and it all stays', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { window.O = () => PatOS.wm.windowsOf('orbrunner')[0]._orb; });
  await ev(() => PatOS.launch('orbrunner')); await page.waitForSelector('.or-over.menu h1', { timeout: 20000 });
  if (!(await ev(() => PatOS.has3D))) { await page.close(); return; } // (no WebGL here)
  assert.match(await page.innerText('.or-over'), /ORB RUNNER[\s\S]*Best\s*0[\s\S]*0[\s\S]*World\s*1[\s\S]*Play[\s\S]*Balls/);

  // the shop: 11 balls, the first one is yours
  await page.click('.or-btn.ghost'); await page.waitForSelector('.or-ball');
  assert.equal(await ev(() => document.querySelectorAll('.or-ball').length), 11);
  assert.match(await page.innerText('.or-ball[data-ball="neon"]'), /In use/);
  assert.match(await page.innerText('.or-ball[data-ball="ruby"]'), /150/);
  // not enough gems: nothing happens
  await page.click('.or-ball[data-ball="ruby"]');
  assert.deepEqual(await ev(() => [O().owned(), O().ball(), O().wallet()]), [['neon'], 'neon', 0]);
  // with gems: buy, it's used at once, and paid for
  await ev(() => PatOS.store.set('orbWallet', 400)); await ev(() => O().shop());
  await page.click('.or-ball[data-ball="ruby"]');
  assert.deepEqual(await ev(() => [O().owned(), O().ball(), O().wallet()]), [['neon', 'ruby'], 'ruby', 250]);
  assert.match(await page.innerText('.or-ball[data-ball="ruby"]'), /In use/);
  assert.equal(await ev(() => O().buy('sapphire')), true); assert.equal(await ev(() => O().wallet()), 0);
  assert.equal(await ev(() => O().buy('emerald')), false, 'can’t pay');
  assert.equal(await ev(() => O().equip('diamond')), false, 'can’t use a ball you don’t have');
  assert.equal(await ev(() => O().equip('neon')), true); assert.equal(await ev(() => O().equip('ruby')), true);
  // every ball draws (the shop pictures)
  const drawn = await ev(() => [...document.querySelectorAll('.or-art')].map((c) => { const d = c.getContext('2d').getImageData(c.width / 2, c.height * 0.47, 1, 1).data; return d[3] > 0; }));
  assert.deepEqual(drawn, Array(11).fill(true));
  await page.keyboard.press('Escape'); await page.waitForSelector('.or-over.menu');

  // play: a new world every 1,500 points, with its name
  await ev(() => O().start()); await page.waitForTimeout(300);
  assert.equal(await ev(() => O().S.state), 'play');
  assert.match(await page.innerText('.or-hud'), /World 1/i);
  await ev(() => { O().S.safe = 999; O().setScore(1520); }); await page.waitForFunction(() => O().world() === 1, null, { timeout: 5000 });
  assert.match(await page.innerText('.or-banner'), /World 2[\s\S]*Crystal Caverns/i);
  await page.waitForFunction(() => /World 2/.test(document.querySelector('.or-hud').textContent));
  await ev(() => O().setScore(7 * 1500 + 10)); await page.waitForFunction(() => O().world() === 7, null, { timeout: 5000 });
  assert.match(await page.innerText('.or-banner'), /World 8[\s\S]*Prism/i);
  assert.ok(await ev(() => (+PatOS.store.get('orbWorldMax', 1)) >= 8), 'the furthest world is kept');
  // power-ups show in the HUD
  await ev(() => { O().power('magnet'); O().power('shield'); O().power('double'); }); await page.waitForTimeout(200);
  assert.match(await page.innerText('.or-pows'), /Shield[\s\S]*Magnet[\s\S]*Double|Shield[\s\S]*Double[\s\S]*Magnet/);
  // double counts twice
  const a = await ev(() => O().S.pts); await page.waitForTimeout(600); const b2 = await ev(() => O().S.pts);
  assert.ok(b2 > a, 'the run goes on');
  // pause
  await ev(() => O().pause()); assert.match(await page.innerText('.or-over'), /Paused[\s\S]*Resume/);
  assert.deepEqual(errors, []);

  // it stays: the ball you use and what you own, after closing and opening again
  await ev(() => PatOS.wm.windowsOf('orbrunner')[0].close()); await page.waitForTimeout(400);
  await ev(() => PatOS.launch('orbrunner')); await page.waitForSelector('.or-over.menu h1');
  assert.deepEqual(await ev(() => [O().ball(), O().owned()]), ['ruby', ['neon', 'ruby', 'sapphire']]);
  // in French
  await ev(() => { PatOS.setLanguage('fr'); O().shop(); }); await page.waitForTimeout(300);
  assert.match(await page.innerText('.or-ball[data-ball="royal"]'), /Or royal/);
  await page.keyboard.press('Escape'); await page.waitForSelector('.or-over.menu');
  assert.match(await page.innerText('.or-over'), /Jouer[\s\S]*Boules/);
  assert.deepEqual(errors, []); await page.close();
});
