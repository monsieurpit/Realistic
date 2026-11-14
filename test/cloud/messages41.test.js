/* Messages (4.1) with two people, against the Firebase emulator and the real firestore.rules: replies, voice messages, game
   challenges, edits and unsending (only your own), and the app: grouped bubbles, actions on hover, reply from the bar,
   search in a chat, pinned and muted chats. */
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
  const ctx = await b.newContext({ viewport: { width: 1280, height: 820 } }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const u = name + tag; await page.evaluate(async (u) => { await PatOS.account.signUp(u, 'a long password 1'); }, u);
  await page.waitForFunction(() => PatOS.chat.ready(), null, { timeout: 20000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { ctx, page, ev, errors, name: u, uid: await ev(() => PatOS.account.info().uid) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = (P, fn, arg, ms) => P.page.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 200 });
const VOICE = 'data:audio/webm;codecs=opus;base64,' + 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAAA'.repeat(4);

test('Messages: replies, voice, game challenges, edit and unsend (only your own), and the app', { skip: emu.skip }, async () => {
  const A = await person('mxa'), B = await person('mxb');
  const cid = await A.ev(async (o) => PatOS.chat.request(o, 'hi Ben'), { uid: B.uid, username: B.name });
  await until(B, () => PatOS.chat.requests().length === 1); await B.ev((id) => PatOS.chat.respond(id, true), cid);
  await until(A, (id) => (PatOS.chat.find(id) || {}).status === 'accepted', cid);
  await A.ev((id) => PatOS.chat.open(id), cid); await B.ev((id) => PatOS.chat.open(id), cid);
  const msgs = (P) => P.ev(() => PatOS.chat.messages());
  // a reply, a voice message, a game challenge
  await B.ev((id) => PatOS.chat.send(id, 'what are you doing?'), cid); await until(A, () => PatOS.chat.messages().length === 2);
  const q = (await msgs(A))[1];
  await A.ev(([id, q]) => PatOS.chat.send(id, 'playing Orb Runner', null, { reply: { id: q.id, text: q.text, from: q.from } }), [cid, q]);
  await A.ev(([id, v]) => PatOS.chat.send(id, '', null, { voice: v, dur: 2.4 }), [cid, VOICE]);
  await A.ev((id) => PatOS.chat.send(id, '', null, { game: { id: 'orbrunner', label: 'Orb Runner', score: 8450 } }), cid);
  await until(B, () => PatOS.chat.messages().length === 5);
  const got = await msgs(B);
  assert.deepEqual(got[2].reply, { id: q.id, text: 'what are you doing?', from: B.uid }); assert.equal(got[2].text, 'playing Orb Runner');
  assert.equal(got[3].voice, VOICE); assert.equal(got[3].dur, 2.4);
  assert.deepEqual(got[4].game, { id: 'orbrunner', label: 'Orb Runner', score: 8450 });
  assert.equal(await B.ev((id) => PatOS.chat.find(id).last, cid), '🎮 Orb Runner', 'the chat list shows what it was');
  // edit and unsend your own
  await A.ev((id) => PatOS.chat.send(id, 'typo mesage'), cid); await until(B, () => PatOS.chat.messages().length === 6);
  const mine = (await msgs(A)).find((m) => m.text === 'typo mesage');
  assert.equal(await A.ev((m) => PatOS.chat.canChange(m), mine), true);
  await A.ev(([id, m]) => PatOS.chat.edit(id, m, 'fixed message'), [cid, mine.id]);
  await until(B, () => PatOS.chat.messages().some((m) => m.text === 'fixed message' && m.edited));
  await A.ev(([id, m]) => PatOS.chat.unsend(id, m), [cid, (await msgs(A))[3].id]); // the voice message
  await until(B, () => PatOS.chat.messages()[3].unsent && !PatOS.chat.messages()[3].voice);

  // the rules: someone else's message, made-up content
  const raw = (P, fn, arg) => P.ev(async ([src, arg]) => { const F = await PatOS.account.cloud(); try { await (0, eval)('(' + src + ')')(F, arg); return 'ok'; } catch (e) { return String(e.code || e.message); } }, [fn.toString(), arg]);
  assert.match(await raw(B, (F, a) => F.editMessage(a.cid, a.mid, 'hacked'), { cid, mid: mine.id }), /rules|permission/i, 'not someone else’s words');
  assert.match(await raw(B, (F, a) => F.unsendMessage(a.cid, a.mid), { cid, mid: mine.id }), /rules|permission/i, 'not someone else’s message');
  assert.match(await raw(A, (F, a) => F.editMessage(a.cid, a.mid, 'again'), { cid, mid: (await msgs(A))[3].id }), /rules|permission/i, 'an unsent message stays unsent');
  const me = await A.ev(() => ({ uid: PatOS.account.info().uid, username: PatOS.account.info().username }));
  assert.match(await raw(A, (F, a) => F.sendMessage(a.cid, a.me, '', 'mx' + Date.now(), null, { voice: 'data:text/html;base64,PHNjcmlwdD4=', dur: 1 }), { cid, me }), /rules|permission/i, 'a voice message is sound');
  assert.match(await raw(A, (F, a) => F.sendMessage(a.cid, a.me, '', 'my' + Date.now(), null, { game: { id: 'Bad Game!', label: 'x', score: 5 } }), { cid, me }), /rules|permission/i, 'a game card is checked');
  assert.match(await raw(A, (F, a) => F.sendMessage(a.cid, a.me, '', 'mz' + Date.now(), null, {}), { cid, me }), /rules|permission/i, 'never an empty message');

  // the app
  await A.ev((id) => PatOS.launch('messages', { chat: id }), cid); await A.page.waitForSelector('.m2-mw');
  assert.equal(await A.ev(() => document.querySelectorAll('.m2-quote').length), 1, 'the reply shows what it answers');
  assert.equal(await A.ev(() => !!document.querySelector('.m2-game')), true);
  assert.match(await A.ev(() => document.querySelector('.msg-b.unsent').textContent), /You unsent a message/);
  assert.match(await A.ev(() => [...document.querySelectorAll('.m2-edited')].map((x) => x.textContent).join()), /Edited/);
  // reply from the actions next to a message
  await A.page.hover('.m2-mw.them'); await A.page.click('.m2-mw.them .m2-acts button[aria-label="Reply"]');
  assert.match(await A.ev(() => document.querySelector('.m2-ctx').textContent), /Replying to @/);
  await A.page.keyboard.type('a reply from the bar'); await A.page.keyboard.press('Enter');
  await until(B, () => { const m = PatOS.chat.messages().slice(-1)[0]; return m.text === 'a reply from the bar' && m.reply && m.reply.text === 'what are you doing?'; });
  // search in the chat
  await A.ev(() => PatOS.wm.windowsOf('messages')[0]._m.find('orb'));
  assert.equal(await A.ev(() => document.querySelectorAll('.msg-b mark').length), 1); assert.match(await A.ev(() => document.querySelector('.m2-fcount').textContent), /1 \/ 1/);
  // pin and mute (this device): no banner from a muted chat
  await B.ev((id) => { PatOS.chat.pin(id, true); PatOS.chat.mute(id, true); window.__n = 0; const n0 = PatOS.notify; PatOS.notify = (n) => { if (n.icon === 'messages') window.__n++; return n0(n); }; PatOS.chat.close(); }, cid);
  assert.deepEqual(await B.ev(() => [PatOS.chat.pinned().length, PatOS.chat.muted().length]), [1, 1]);
  await A.ev((id) => PatOS.chat.send(id, 'are you there?'), cid); await until(B, () => PatOS.chat.conversations()[0].last === 'are you there?');
  await wait(800); assert.equal(await B.ev(() => window.__n), 0, 'a muted chat stays quiet');
  await B.ev(() => PatOS.launch('messages')); await B.page.waitForSelector('.m2-row');
  assert.match(await B.ev(() => document.querySelector('.m2-list').textContent), /Pinned[\s\S]*@mxa/);
  assert.equal(await B.ev(() => !!document.querySelector('.m2-row .m2-ic')), true, 'the muted icon');
  for (const P of [A, B]) { assert.deepEqual(P.errors, []); await P.ctx.close(); }
});
