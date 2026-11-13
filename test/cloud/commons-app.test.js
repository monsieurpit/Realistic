/* The PatOS Commons app (js/apps/commons.js) with two people in the Firebase emulator: make a community in the app, find
   and join it, post, an event added to the Calendar, a shared desktop tried and put back, a report the moderator sees,
   and blocking someone hides what they post. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const emu = require('./emulator');
const { startServer, browser, boot } = require('../helpers');

let server, srv, b;
const tag = Date.now().toString(36).slice(-5);
test.before(async () => { if (emu.skip) return; server = await emu.start(); srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (server) server.stop(); });
const EMU = { auth: 'http://127.0.0.1:9199', firestoreHost: '127.0.0.1', firestorePort: 8180, projectId: 'demo-patos' };
async function person(name) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 860 } }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const u = name + tag; await page.evaluate(async (u) => { await PatOS.account.signUp(u, 'a long password 1'); window.F = await PatOS.loadFirebase(); window.ME = { uid: PatOS.account.info().uid, username: u }; }, u);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { ctx, page, ev, errors, name: u, uid: await ev(() => window.ME.uid) };
}
const C = () => PatOS.wm.windowsOf('commons')[0]._commons;
const until = (P, fn, arg, ms) => P.page.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 200 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('PatOS Commons: a community made in the app, posts, an event, a shared desktop, reports and blocks', { skip: emu.skip }, async () => {
  const A = await person('cma'), B = await person('cmb');
  // A makes a public community with the app
  await A.ev(() => PatOS.launch('commons')); await A.page.waitForSelector('.cm-head h1');
  await A.page.click('.cm-head .btn.primary'); await A.page.waitForSelector('.cm-form');
  await A.page.fill('.cm-form input >> nth=0', 'Desk Setups'); await A.page.fill('.cm-form textarea', 'Show your PatOS desktop');
  await A.page.click('text=Create');
  await until(A, () => PatOS.wm.windowsOf('commons')[0]._commons.view().kind === 'com');
  await A.page.waitForSelector('.cm-compose');
  // A posts an event
  const cid = await A.ev(() => PatOS.wm.windowsOf('commons')[0]._commons.view().cid);
  await A.page.click('.cm-opener'); await A.page.click('.cm-kinds button:has-text("Event")');
  await A.page.fill('.cm-ctitle', 'Show and tell');
  await A.page.fill('.cm-compose input[type=datetime-local]', '2026-12-05T18:30'); await A.page.fill('.cm-compose input[placeholder="Where"]', 'Online');
  await A.page.click('.cm-compose .btn.primary');
  await until(A, () => document.querySelectorAll('.cm-post').length === 1);
  // B finds it in Discover and joins
  await B.ev(() => PatOS.launch('commons')); await B.page.waitForSelector('.cm-crow');
  await B.page.click('.cm-crow:has-text("Desk Setups")'); await B.page.waitForSelector('.cm-head');
  await B.page.click('.cm-head >> text=Join');
  await until(B, () => !!document.querySelector('.cm-compose'));
  const jj = await B.ev(() => ({ store: PatOS.store.get('commonsJoined', []), mine: PatOS.wm.windowsOf('commons')[0]._commons.mine().map((c) => c.id + ':' + c.myRole), view: PatOS.wm.windowsOf('commons')[0]._commons.view().kind }));
  assert.equal(jj.store.length, 1, 'remembered as joined: ' + JSON.stringify(jj));
  // B adds A's event to their Calendar
  await B.page.click('.cm-post >> text=Add to Calendar');
  assert.ok(await B.ev(() => (PatOS.store.get('calendar', {})['2026-12-05'] || []).some((e) => e.title === 'Show and tell' && e.time === '18:30')));
  // A shares their desktop in a showcase (20 s after their event: the rate limit)
  await wait(21000);
  await A.ev(() => { PatOS.setSetting('accent', '#ff375f'); });
  await A.page.click('.cm-opener'); await A.page.click('.cm-kinds button:has-text("Showcase")'); await A.page.fill('.cm-ctitle', 'My pink desk');
  await A.page.click('.cm-compose >> text=Share…'); await A.page.click('.menu >> text=My desktop');
  await A.page.click('.cm-compose .btn.primary');
  await until(B, () => document.querySelectorAll('.cm-post').length === 2);
  // A starts writing; posts arriving must not wipe it
  await A.page.click('.cm-opener'); await A.page.fill('.cm-compose textarea', 'my draft');
  // B tries it: their accent changes; "Put mine back" restores it
  const before = await B.ev(() => PatOS.settings.accent);
  await B.page.click('.cm-post >> text=Try this desktop'); await B.page.waitForTimeout(500);
  assert.equal(await B.ev(() => PatOS.settings.accent), '#ff375f', 'previewing the shared desktop');
  await B.page.click('text=Put mine back'); await B.page.waitForTimeout(400);
  assert.equal(await B.ev(() => PatOS.settings.accent), before, 'and back');
  // a member can’t announce: the kind isn’t offered, and the server refuses it anyway
  await B.page.click('.cm-opener'); assert.ok(!(await B.ev(() => [...document.querySelectorAll('.cm-kinds button')].map((o) => o.textContent))).some((t) => /Announcement/.test(t)), 'members aren’t offered announcements');
  assert.equal(await B.ev((cid) => F.comPost(ME, cid, { kind: 'announcement', title: 'x', text: 'x' }).then(() => 'ok', () => 'refused'), cid), 'refused');
  // B posts (the rate limit message comes from a second post right away)
  await B.page.fill('.cm-ctitle', 'Hello all'); await B.page.click('.cm-compose .btn.primary');
  await until(A, () => document.querySelectorAll('.cm-post').length === 3);
  assert.equal(await A.ev(() => document.querySelector('.cm-compose textarea').value), 'my draft', 'a new post coming in keeps what A is writing');
  await B.page.click('.cm-opener'); await B.page.fill('.cm-ctitle', 'Again'); await B.page.click('.cm-compose .btn.primary');
  await B.page.waitForSelector('text=Slow down a little'); await B.page.keyboard.press('Enter');
  // A reports nothing, B reports A's showcase; A (owner) sees the report in Moderation
  await B.ev(async (cid) => { const p = PatOS.wm.windowsOf('commons')[0]._commons.posts().find((x) => x.title === 'My pink desk'); await F.comReport(ME, cid, p.id, 'too pink'); }, cid);
  await A.ev(() => { const s = [...document.querySelectorAll('.ui-seg button')].find((x) => /Moderation/.test(x.textContent)); s.click(); });
  await A.page.waitForSelector('text=too pink');
  // A blocks B: B's posts disappear for A
  await A.ev(() => { const s = [...document.querySelectorAll('.ui-seg button')].find((x) => /Posts/.test(x.textContent)); s.click(); });
  await A.ev((uid) => F.block(ME, uid, true), B.uid);
  await A.ev((cid) => PatOS.wm.windowsOf('commons')[0].close(), cid); await A.ev((cid) => PatOS.launch('commons', { cid }), cid);
  await until(A, () => document.querySelectorAll('.cm-post').length === 2);
  assert.ok(!(await A.ev(() => document.querySelector('.cm-col').textContent)).includes('Hello all'), 'hidden for A');
  assert.deepEqual(A.errors, []); assert.deepEqual(B.errors, []);
  await A.ctx.close(); await B.ctx.close();
});
