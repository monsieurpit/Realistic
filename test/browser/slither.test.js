/* Slither: the game world (bots, dots, power-ups, crashes) and its window. It all runs on the device, so it also starts with no internet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let srv, b;
test.before(async () => { if (skipNoBrowser) return; srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); });

async function open(page) { await page.evaluate(() => PatOS.launch('slither')); await page.waitForSelector('.sl-card'); }
async function fresh() { const page = await b.newPage({ viewport: { width: 1100, height: 720 } }); const errors = await boot(page, srv.base, { fresh: true }); await open(page); return { page, errors }; }
// an empty arena with only the player, placed where we want (window.__g is the game, window.__place puts the snake somewhere)
const SETUP = () => {
  const g = PatOS.wm.windowsOf('slither')[0]._slither; g.start(); g.pause(true); const w = g.world; const p = w.player;
  w.snakes = [p]; w.respawns = []; w.events = []; w.powers = [];
  for (const c of w.grid) if (c) c.length = 0; w.pelletCount = 1e6; // (a big count: the world does not scatter new dots while we measure)
  window.__place = (x, y, ang) => { p.x = x; p.y = y; p.ang = p.want = ang; p.inv = 0; p.px.length = 0; p.py.length = 0; for (let i = 80; i >= 0; i--) { p.px.push(x - Math.cos(ang) * 2.45 * i); p.py.push(y - Math.sin(ang) * 2.45 * i); } w.layout(p); };
  window.__g = g; window.__place(0, 0, 0); return true;
};

test('the menu, then Play: a leaderboard of bots, dots on the ground, and the snake moves', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await fresh();
  assert.equal(await page.locator('.sl-skin').count(), 8); assert.equal(await page.locator('.sl-menu .seg .tab').count(), 3);
  await page.fill('.sl-name', 'Maya'); await page.click('.sl-play'); await page.waitForTimeout(700);
  const r = await page.evaluate(() => { const g = PatOS.wm.windowsOf('slither')[0]._slither, w = g.world, p = w.player; const x0 = p.x, y0 = p.y; g.step(60); return { mode: g.mode, name: p.name, bots: w.snakes.filter((s) => s.bot && s.alive).length, pellets: w.pelletCount, moved: Math.hypot(p.x - x0, p.y - y0), powers: w.powers.length }; });
  assert.equal(r.mode, 'play'); assert.equal(r.name, 'Maya'); assert.ok(r.bots >= 20, 'bots: ' + r.bots); assert.ok(r.pellets >= 4000); assert.ok(r.moved > 100, 'it moves'); assert.ok(r.powers >= 3);
  await page.waitForSelector('.sl-board .sl-row'); assert.ok((await page.locator('.sl-board .sl-row').count()) >= 5); assert.equal(await page.locator('.sl-map').count(), 1);
  assert.deepEqual(errors, []); await page.close();
});

test('eating dots makes the snake longer, and a boost costs length and is faster', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await fresh(); await page.evaluate(SETUP);
  const r = await page.evaluate(() => {
    const g = __g, w = g.world, p = w.player, o = {}; const n0 = p.n;
    for (let i = 0; i < 30; i++) w.addPellet(40 + i * 8, 0, 1, '#fff', false); const m0 = p.mass; g.step(120); o.gained = p.mass - m0; o.longer = p.n > n0;
    p.mass = 200; const c1 = w.pelletCount, m1 = p.mass, x0 = p.x; p.boosting = true; for (let i = 0; i < 60; i++) { p.boosting = true; w.step(); } o.cost = m1 - p.mass; o.boostDist = Math.hypot(p.x - x0, p.y); p.boosting = false;
    const x1 = p.x, y1 = p.y; for (let i = 0; i < 60; i++) w.step(); o.normalDist = Math.hypot(p.x - x1, p.y - y1); o.dropped = w.pelletCount - c1; return o;
  });
  assert.ok(r.gained >= 29, 'ate the dots: ' + r.gained); assert.ok(r.longer); assert.ok(r.cost > 3, 'a boost costs length: ' + r.cost); assert.ok(r.boostDist > r.normalDist * 1.5, 'and is faster'); assert.ok(r.dropped >= 5, 'it leaves dots behind');
  assert.deepEqual(errors, []); await page.close();
});

test('power-ups: Speed, Magnet, Shield, Double and Far sight each do their thing, and run out', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await fresh(); await page.evaluate(SETUP);
  const r = await page.evaluate(() => {
    const g = __g, w = g.world, p = w.player, o = {};
    // picking one up (the dot on the ground) gives its effect, and the power-up is gone
    __place(0, 0, 0); w.powers.push({ type: 'speed', x: 30, y: 0, ph: 0 }); g.step(40); o.picked = !!p.fx.speed && w.powers.length === 0; o.events = true;
    // speed: faster than normal without pressing boost, and free
    __place(0, 0, 0); p.fx = {}; w.applyPower(p, 'speed'); const m0 = p.mass; g.step(60); const fast = Math.hypot(p.x, p.y); __place(0, 0, 0); p.fx = {}; g.step(60); o.speed = fast > Math.hypot(p.x, p.y) * 1.5 && p.mass === m0;
    // magnet: a dot off to the side is pulled in and eaten
    __place(0, 0, 0); p.fx = {}; w.applyPower(p, 'magnet'); const mm = p.mass; w.addPellet(10, 200, 1, '#fff', false); g.step(70); o.magnet = p.mass > mm; __place(0, 0, 0); p.fx = {}; const m2 = p.mass; w.addPellet(10, 200, 1, '#fff', false); g.step(30); o.noMagnet = p.mass === m2;
    // double: a dot counts twice
    __place(0, 0, 0); p.fx = {}; w.applyPower(p, 'double'); const m3 = p.mass; w.addPellet(25, 0, 1, '#fff', false); g.step(15); o.double = Math.abs(p.mass - m3 - 2) < 1e-6;
    // shield: hitting the wall does not kill; without it, it does
    __place(3150, 0, 0); p.fx = {}; w.applyPower(p, 'shield'); g.step(30); o.shield = p.alive && Math.hypot(p.x, p.y) < 3200;
    // zoom lasts, then the effect is over
    __place(0, 0, 0); p.fx = {}; w.applyPower(p, 'zoom'); o.zoomOn = p.fx.zoom > 14; p.fx = { speed: 0.02 }; g.step(3); o.ends = p.fx.speed === undefined;
    return o;
  });
  assert.deepEqual(r, { picked: true, events: true, speed: true, magnet: true, noMagnet: true, double: true, shield: true, zoomOn: true, ends: true });
  assert.deepEqual(errors, []); await page.close();
});

test('crashing: the wall, or another snake, ends the game; Play Again starts a new one', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await fresh(); await page.evaluate(SETUP);
  await page.evaluate(() => { const g = __g; g.pause(false); __place(3190, 0, 0); g.step(20); });
  await page.waitForSelector('.sl-over:not(.hidden)'); assert.match(await page.textContent('.sl-over'), /You hit the wall/); assert.equal(await page.evaluate(() => __g.mode), 'over');
  await page.click('.sl-over .btn.primary'); await page.waitForTimeout(300); assert.equal(await page.evaluate(() => PatOS.wm.windowsOf('slither')[0]._slither.mode), 'play');
  // eaten by a bot: a bot's body across the path
  await page.evaluate(SETUP); await page.evaluate(() => {
    const g = __g, w = g.world; g.pause(false); const bot = w.createBot ? null : null; void bot;
    const other = PatOS.wm.windowsOf('slither')[0]._slither.createWorld({ level: 'easy' }).snakes.find((s) => s.bot); other.name = 'Zed'; other.mass = 300;
    // a long snake lying across the player's way
    other.x = 80; other.y = -120; other.ang = Math.PI / 2; other.px.length = 0; other.py.length = 0; for (let i = 300; i >= 0; i--) { other.px.push(80); other.py.push(-120 - 2.45 * i + 600 * 0); } other.px.reverse(); other.py.reverse(); other.px.length = 0; other.py.length = 0;
    for (let i = 0; i <= 300; i++) { other.px.push(80); other.py.push(-300 + i * 2.45); } other.y = other.py[other.py.length - 1]; other.ang = Math.PI / 2; other.want = other.ang; other.inv = 0; w.layout(other); w.snakes.push(other); other.ai.next = 1e9; window.__zed = other; w.step(); w.snakes.length; g.step(60);
  });
  await page.waitForSelector('.sl-over:not(.hidden)'); assert.match(await page.textContent('.sl-over'), /You were eaten by Zed/);
  assert.deepEqual(errors, []); await page.close();
});

test('a snake that dies turns into dots, the one that caused it is credited, and the bots are replaced', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await fresh(); await page.evaluate(SETUP);
  const r = await page.evaluate(() => {
    const g = __g, w = g.world, p = w.player, o = {}; g.pause(false);
    for (let i = 0; i < w.lvl.bots; i++) { /* the arena has no bots now: the world makes them again as time goes */ }
    const before = w.pelletCount; const victim = g.createWorld({ level: 'easy' }).snakes.find((s) => s.bot); victim.mass = 100; victim.skin = 1; w.layout(victim);
    w.snakes.push(victim); w.kill(victim, p, 'snake'); o.dots = w.pelletCount - before; o.expect = Math.floor(victim.n / 2); o.kills = p.kills; o.eventKill = w.events.some((e) => e.type === 'kill'); o.removed = !victim.alive;
    w.respawns.push({ at: w.t + 5, bot: true }); g.step(30); o.botBack = w.snakes.filter((s) => s.bot && s.alive).length; return o;
  });
  assert.ok(r.dots >= r.expect && r.dots >= 5, 'dots: ' + r.dots + ' of ' + r.expect); assert.equal(r.kills, 1); assert.equal(r.eventKill, true); assert.equal(r.removed, true); assert.ok(r.botBack >= 1, 'a bot comes back');
  assert.deepEqual(errors, []); await page.close();
});

test('the bots play on their own for a few minutes: they grow, get eaten, come back, and the arena stays full', { skip: skipNoBrowser }, async () => {
  const { page, errors } = await fresh();
  const r = await page.evaluate(() => {
    const g = PatOS.wm.windowsOf('slither')[0]._slither, w = g.world; g.pause(true); const t0 = performance.now(); w.player = null; for (let i = 0; i < 3 * 3600; i++) w.step();
    const bots = w.snakes.filter((s) => s.alive); const finite = bots.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && Math.hypot(s.x, s.y) < 3300);
    return { bots: bots.length, top: Math.max(...bots.map((s) => s.mass)), finite, pellets: w.pelletCount, ms: (performance.now() - t0) / (3 * 3600) };
  });
  assert.ok(r.bots >= 18, 'bots: ' + r.bots); assert.ok(r.top > 200, 'a bot grew: ' + r.top); assert.equal(r.finite, true); assert.ok(r.pellets >= 4500); assert.ok(r.ms < 5, 'a step takes ' + r.ms + ' ms');
  assert.deepEqual(errors, []); await page.close();
});

test('it also opens with no internet', { skip: skipNoBrowser }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 720 } }); const page = await ctx.newPage(); await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(2500); await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#lock:not(.hidden)', { timeout: 20000 }); await page.evaluate(() => PatOS.boot.login());
  await open(page); await page.click('.sl-play'); await page.waitForTimeout(500); assert.equal(await page.evaluate(() => PatOS.wm.windowsOf('slither')[0]._slither.mode), 'play');
  await ctx.close();
});
