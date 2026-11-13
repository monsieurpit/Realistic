/* The Games app (4.1): home (daily challenge, what's new, every game), achievements, leaderboards, and the Game Center
   service every game reports to (js/gamecenter.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

test('Games: home, achievements, the daily challenge, leaderboards signed out, French', { skip: skipNoBrowser }, async () => {
  const page = await b.newPage({ viewport: { width: 1280, height: 860 } }); const errors = await boot(page, srv.base, { fresh: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { window.G = () => PatOS.wm.windowsOf('games')[0]._games; window.__n = []; const n0 = PatOS.notify; PatOS.notify = (n) => { window.__n.push(n); return n0(n); }; });
  await ev(() => PatOS.launch('games')); await page.waitForSelector('.gm-daily');
  // home: the daily challenge, Orb Runner is new, and all 12 games
  assert.match(await page.innerText('.gm-daily'), /Daily Challenge[\s\S]*2048[\s\S]*Play/i);
  assert.match(await page.innerText('.gm-feature'), /New[\s\S]*Orb Runner/i);
  assert.equal(await ev(() => document.querySelectorAll('.gm-grid .gm-card').length), 12);
  assert.ok(await ev(() => [...document.querySelectorAll('.gm-card')].every((c) => /Not played yet/.test(c.textContent))));
  assert.match(await page.innerText('.ui-side'), /Home[\s\S]*Achievements[\s\S]*Leaderboards/);

  // rounds that end in other games: stats, and one banner for several achievements
  await ev(() => { PatOS.gc.report('chess', { win: true }); });
  await page.waitForFunction(() => /Checkmate/.test(document.querySelector('.gm-main').textContent) || window.__n.length >= 1);
  const n1 = await ev(() => window.__n.filter((n) => n.icon === 'games').map((n) => [n.title, n.body]));
  assert.deepEqual(n1, [['Achievements unlocked', 'First Game · Checkmate']]);
  assert.match(await ev(() => [...document.querySelectorAll('.gm-card')].find((c) => /Chess/.test(c.textContent)).textContent), /1 win/);
  assert.match(await page.innerText('.gm-player'), /2 \/ 25/);

  // the daily challenge: the same tiles every time today
  const deal = async () => { await ev(() => G().start('2048', { daily: PatOS.gc.daily().id })); await page.waitForSelector('.g2-tile'); return ev(() => [...document.querySelectorAll('.g2-tile')].map((t) => t.style.getPropertyValue('--r') + t.style.getPropertyValue('--c') + ':' + t.textContent).sort().join()); };
  const d1 = await deal(); await ev(() => G().home()); const d2 = await deal();
  assert.equal(d1, d2, 'the daily deal is the same'); assert.match(await page.innerText('.gm-title'), /Daily Challenge/);
  // a round of it ends: it counts for the day, and for Daily Player
  // (a few moves)
  for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { await page.keyboard.press(k); await page.waitForTimeout(150); }
  // (a 2048 round only ends when no move is left: report its end the way the app does)
  await ev(() => PatOS.gc.report('2048', { score: 64, tile: 16, daily: PatOS.gc.daily().id }));
  assert.equal(await ev(() => PatOS.gc.daily().played), true); assert.equal(await ev(() => PatOS.gc.daily().best), 64);
  assert.ok(await ev(() => !!PatOS.gc.unlocked()['daily-1']));
  // back home: it says so
  await ev(() => G().home()); await page.waitForSelector('.gm-daily');
  assert.match(await page.innerText('.gm-daily'), /Play Again[\s\S]*Your best 64/);

  // Orb Runner stops being "new" once opened from here
  await page.click('.gm-feature'); await page.waitForFunction(() => PatOS.wm.windowsOf('orbrunner').length === 1);
  await ev(() => PatOS.wm.windowsOf('orbrunner')[0].close()); await ev(() => G().home());
  assert.equal(await ev(() => !!document.querySelector('.gm-feature')), false);

  // achievements page
  await ev(() => G().go('achievements'));
  assert.match(await page.innerText('.gm-main'), /Achievements\s*4 \/ 25|Achievements[\s\S]*\/ 25/);
  assert.equal(await ev(() => document.querySelectorAll('.gm-ach.got').length), await ev(() => Object.keys(PatOS.gc.unlocked()).length));
  assert.equal(await ev(() => document.querySelectorAll('.gm-ach').length), 25);
  // leaderboards, signed out
  await ev(() => G().go('boards'));
  assert.match(await page.innerText('.gm-main'), /Sign in to see leaderboards/);
  // a real arcade round: Snake ends, and counts
  await ev(() => G().start('snake')); await page.waitForTimeout(300);
  await page.waitForFunction(() => document.querySelector('.gm-over'), null, { timeout: 15000 }); // (the snake runs into the wall by itself)
  assert.equal(await ev(() => PatOS.gc.stats('snake').plays), 1);
  // in French
  await ev(() => { G().home(); PatOS.setLanguage('fr'); G().go('home'); }); await page.waitForTimeout(300);
  assert.match(await page.innerText('.gm-daily'), /Défi du jour[\s\S]*Jouer|Défi du jour[\s\S]*Rejouer/i);
  assert.match(await page.innerText('.ui-side'), /Accueil[\s\S]*Succès[\s\S]*Classements/);
  assert.deepEqual(errors, []); await page.close();
});
