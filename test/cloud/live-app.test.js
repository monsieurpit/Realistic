/* The PatOS Live app (js/apps/livespace.js) with two people in the Firebase emulator: who is here, a board both change at
   once (a clash keeps both), a live note written by two people at the same time, shared tasks, and a real voice call
   between the two browsers (Chromium's pretend microphone: WebRTC connects for real, nothing is faked in PatOS). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const emu = require('./emulator');
const { startServer, boot } = require('../helpers');

let server, srv, b;
const tag = Date.now().toString(36).slice(-5);
test.before(async () => {
  if (emu.skip) return; server = await emu.start(); srv = await startServer();
  b = await require('playwright').chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
});
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (server) server.stop(); });
const EMU = { auth: 'http://127.0.0.1:9199', firestoreHost: '127.0.0.1', firestorePort: 8180, projectId: 'demo-patos' };
async function person(name) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 820 }, permissions: ['microphone'] }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const u = name + tag; await page.evaluate(async (u) => { await PatOS.account.signUp(u, 'a long password 1'); window.F = await PatOS.loadFirebase(); window.ME = { uid: PatOS.account.info().uid, username: u }; }, u);
  await page.waitForFunction(() => PatOS.spaces.ready(), null, { timeout: 20000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { ctx, page, ev, errors, name: u, uid: await ev(() => window.ME.uid) };
}
const L = 'PatOS.wm.windowsOf("livespace")[0]._live';
const until = (P, fn, arg, ms) => P.page.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 200 });

test('PatOS Live: here now, a board, a live note, tasks and a voice call between two people', { skip: emu.skip }, async () => {
  const A = await person('lva'), B = await person('lvb');
  const sid = await A.ev(() => F.spaceCreate(ME, 'Science'));
  await A.ev(([sid, u]) => F.spaceInvite(ME, sid, 'Science', u, 'editor'), [sid, B.name]);
  const inv = await B.ev(() => new Promise((res) => { const off = F.invitesListen(ME.uid, (l) => { if (l.length) { off(); res(l[0]); } }); }));
  await B.ev((inv) => F.inviteAccept(ME, inv), inv);
  await until(A, (sid) => PatOS.spaces.get(sid), sid); await until(B, (sid) => PatOS.spaces.get(sid), sid);
  // both open the space in Live: each sees the other here
  for (const P of [A, B]) { await P.ev((sid) => PatOS.launch('livespace', { sid }), sid); await P.page.waitForSelector('.lv-main'); }
  await until(A, (n) => PatOS.wm.windowsOf('livespace')[0]._live.people().some((p) => p.name === n), B.name);
  assert.match(await A.ev(() => document.querySelector('.lv-here').innerHTML), /lv-av/);
  // a board: A makes it and adds a sticky; B sees it appear
  const bid = await A.ev((sid) => F.liveHeadCreate(ME, sid, 'boards', 'Plan'), sid);
  for (const P of [A, B]) { await until(P, () => PatOS.wm.windowsOf('livespace')[0]._live.boards().length === 1); await P.ev(([l, bid]) => eval(l).open({ kind: 'board', id: bid }), [L, bid]); await P.page.waitForSelector('.lv-board'); }
  await A.ev((l) => eval(l).board ? null : null, L);
  await A.ev(() => PatOS.wm.windowsOf('livespace')[0]._live.board.add('sticky', 100, 100));
  await until(B, () => document.querySelectorAll('.lv-it').length === 1);
  // both change the sticky's text from the same revision: one wins, the other's text is kept as a second sticky
  await until(A, () => PatOS.wm.windowsOf('livespace')[0]._live.board.items().length === 1);
  const id = await A.ev(() => PatOS.wm.windowsOf('livespace')[0]._live.board.items()[0].id);
  await Promise.all([A.ev((id) => PatOS.wm.windowsOf('livespace')[0]._live.board.put(id, { text: 'Volcano model' }), id), B.ev((id) => PatOS.wm.windowsOf('livespace')[0]._live.board.put(id, { text: 'Solar system' }), id)]);
  await until(A, () => PatOS.wm.windowsOf('livespace')[0]._live.board.items().length === 2);
  const texts = await A.ev(() => PatOS.wm.windowsOf('livespace')[0]._live.board.items().map((i) => i.text).sort());
  assert.equal(texts.length, 2); assert.ok(texts.some((t) => /^Your version: /.test(t)), 'the loser’s text is kept: ' + JSON.stringify(texts));
  assert.ok(texts.some((t) => t === 'Volcano model' || t === 'Solar system'));
  // moving on screen: B drags the winner's sticky, A sees it move
  const before = await A.ev((id) => PatOS.wm.windowsOf('livespace')[0]._live.board.items().find((i) => i.id === id).x, id);
  const grip = await B.page.$(`.lv-it[data-id="${id}"] .lv-grip`); const box = await grip.boundingBox();
  await B.page.mouse.move(box.x + 20, box.y + 5); await B.page.mouse.down(); await B.page.mouse.move(box.x + 220, box.y + 85, { steps: 6 }); await B.page.mouse.up();
  await until(A, ([id, x]) => PatOS.wm.windowsOf('livespace')[0]._live.board.items().find((i) => i.id === id).x > x + 100, [id, before]);
  // a live note: two people write two paragraphs at once, both stay
  const nid = await A.ev((sid) => F.liveHeadCreate(ME, sid, 'notes', 'Minutes'), sid);
  for (const P of [A, B]) { await until(P, () => PatOS.wm.windowsOf('livespace')[0]._live.notes().length === 1); await P.ev(([l, nid]) => eval(l).open({ kind: 'note', id: nid }), [L, nid]); await P.page.waitForSelector('.lv-note'); }
  await Promise.all([A.ev(() => PatOS.wm.windowsOf('livespace')[0]._live.note.addBlock(1, 'We met at noon.', false)), B.ev(() => PatOS.wm.windowsOf('livespace')[0]._live.note.addBlock(2, 'Next: buy clay.', false))]);
  await until(A, () => document.querySelectorAll('.lv-blk').length === 2); await until(B, () => document.querySelectorAll('.lv-blk').length === 2);
  assert.deepEqual(await B.ev(() => [...document.querySelectorAll('.lv-blk textarea')].map((t) => t.value)), ['We met at noon.', 'Next: buy clay.']);
  // typing in a paragraph reaches the other person
  const ta = await A.page.$('.lv-blk textarea'); await ta.click(); await A.page.keyboard.press('End'); await A.page.keyboard.type(' In the lab.'); await A.page.locator('.lv-bar b').click();
  await until(B, () => document.querySelector('.lv-blk textarea').value === 'We met at noon. In the lab.');
  // tasks
  for (const P of [A, B]) await P.ev((l) => eval(l).open({ kind: 'tasks' }), L);
  await A.page.fill('.lv-tadd input', 'Paint the volcano'); await A.page.keyboard.press('Enter');
  await until(B, () => document.querySelectorAll('.lv-task').length === 1);
  await B.page.check('.lv-task input[type=checkbox]');
  await until(A, () => PatOS.wm.windowsOf('livespace')[0]._live.tasks()[0] && PatOS.wm.windowsOf('livespace')[0]._live.tasks()[0].done === true);
  // voice: A starts a call, B joins, the two browsers connect, then both leave and the call is gone
  for (const P of [A, B]) await P.ev((l) => eval(l).open({ kind: 'call' }), L);
  await A.page.click('text=Start a call');
  await until(B, () => PatOS.wm.windowsOf('livespace')[0]._live && document.body.textContent.includes('A call is on'));
  await B.page.click('text=Join the call');
  const connected = (P) => until(P, () => { const c = PatOS.wm.windowsOf('livespace')[0]._live.call(); return c && [...c.peers.values()].some((p) => p.pc.connectionState === 'connected'); }, null, 30000);
  await connected(A); await connected(B);
  assert.ok(await B.ev(() => { const c = PatOS.wm.windowsOf('livespace')[0]._live.call(); return [...c.peers.values()][0].audio.srcObject.getAudioTracks().length > 0; }), 'B hears A’s microphone track');
  await A.ev(() => PatOS.wm.windowsOf('livespace')[0]._live.hangUp()); await B.ev(() => PatOS.wm.windowsOf('livespace')[0]._live.hangUp());
  assert.equal(await A.ev(() => PatOS.wm.windowsOf('livespace')[0]._live.call()), null);
  await until(A, () => PatOS.wm.windowsOf('livespace')[0]._live && !document.body.textContent.includes('A call is on'));
  // closing the window clears the presence
  await B.ev(() => PatOS.wm.close(PatOS.wm.windowsOf('livespace')[0]));
  await A.ev((l) => eval(l).open({ kind: 'home' }), L);
  await until(A, (n) => !PatOS.wm.windowsOf('livespace')[0]._live.people().some((p) => p.name === n), B.name);
  assert.deepEqual(A.errors, []); assert.deepEqual(B.errors, []);
  await A.ctx.close(); await B.ctx.close();
});
