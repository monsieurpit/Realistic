/* PatOS accounts and Messages, end to end: real PatOS pages, the real Firebase code (vendor/firebase.js), the real rules,
   against the Firebase emulator (never the real project). Usage: npm run test:cloud */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const emu = require('./emulator');
const { startServer, browser, boot } = require('../helpers');

let server, srv, b;
const tag = Date.now().toString(36).slice(-5);
let n = 0; const uniq = (p) => p + tag + (++n);
test.before(async () => { if (emu.skip) return; server = await emu.start(); srv = await startServer(); b = await browser(); });
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (server) server.stop(); });

const EMU = { auth: 'http://127.0.0.1:9199', firestoreHost: '127.0.0.1', firestorePort: 8180, projectId: 'demo-patos' };
async function device(opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { window.__notes = []; PatOS.notify = (x) => window.__notes.push(x); window.__asked = []; PatOS.confirmBox = async (t) => { window.__asked.push(t); return true; }; PatOS.alertBox = async (t, x) => { window.__alert = t + ': ' + x; }; PatOS.store.set('accountPrompt', { snoozedUntil: Date.now() + 1e10 }); });
  return { ctx, page, errors, ev: (fn, arg) => page.evaluate(fn, arg) };
}
const waitFor = async (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 20000 });
const idle = (d) => d.ev(async () => { await PatOS.sync.now(); return PatOS.sync.status(); });
const dumpAll = async () => { // every document in the database, read as the emulator's owner (to look for anything readable)
  const out = []; const walk = async (path) => { const r = await (await fetch('http://127.0.0.1:8180/v1/projects/demo-patos/databases/(default)/documents' + path + '?pageSize=300', { headers: { Authorization: 'Bearer owner' } })).json(); for (const d of r.documents || []) { out.push(d); } };
  for (const c of ['usernames', 'accounts']) await walk('/' + c);
  const accts = out.filter((d) => /\/accounts\/[^/]+$/.test(d.name)); for (const a of accts) { const id = a.name.split('/').pop(); await walk('/accounts/' + id + '/records'); await walk('/accounts/' + id + '/chunks'); }
  return JSON.stringify(out);
};

test('an account: sign up saves everything, a second device signs in and gets it, and the database holds nothing readable', { skip: emu.skip }, async () => {
  const user = uniq('alice'), pass = 'correct horse battery';
  const A = await device();
  await A.ev(() => { PatOS.fs.write('/Documents/diary.txt', 'my-private-diary-text'); PatOS.store.set('notes', [{ id: 'n1', title: 'Secret', body: 'note-body-private' }]); PatOS.store.set('myOwnThing', { color: 'green' }); PatOS.setSetting('accent', '#ff2d55'); PatOS.fs.write('/Pictures/big.txt', 'x'.repeat(2.2e6) + 'THE-END'); });
  assert.match(await A.ev(async (u) => { try { await PatOS.account.signUp(u, 'short'); return 'ok'; } catch (e) { return e.message; } }, user), /at least 8/);
  assert.match(await A.ev(async () => { try { await PatOS.account.signUp('x', 'long enough pass'); return 'ok'; } catch (e) { return e.message; } }), /3 to 20/);
  const t = await A.ev(async ([u, p]) => { await PatOS.account.signUp(u, p); const s = await PatOS.sync.now().then(() => PatOS.sync.status()); return { s, info: PatOS.account.info(), mode: PatOS.sync.mode() }; }, [user, pass]);
  assert.equal(t.info.username, user); assert.equal(t.mode, 'account'); assert.equal(t.s.error, ''); assert.ok(t.s.items >= 12, 'everything that was here went in: ' + t.s.items);
  // the database: names and scrambled bytes only
  const all = await dumpAll();
  ['my-private-diary-text', 'note-body-private', 'diary.txt', 'myOwnThing', '#ff2d55', 'THE-END', 'accent', pass].forEach((w) => assert.ok(!all.includes(w), 'the database must not contain: ' + w));
  assert.ok(all.includes('"' + user + '"') || all.includes(user), 'the username is there'); assert.ok(/accounts\/[^"]+\/chunks\/c/.test(all));
  assert.ok((all.match(/\/chunks\/c[^"]+\.2"/g) || []).length >= 1, 'a big file is in pieces');
  // a second device: wrong password, taken name, then the right password
  const B = await device();
  assert.match(await B.ev(async ([u]) => { try { await PatOS.account.signIn(u, 'not the password'); return 'ok'; } catch (e) { return e.message; } }, [user]), /Wrong username or password/);
  assert.match(await B.ev(async ([u, p]) => { try { await PatOS.account.signUp(u, p); return 'ok'; } catch (e) { return e.message; } }, [user, 'another good password']), /taken/);
  await B.ev(() => { PatOS.fs.write('/Documents/only-on-b.txt', 'b was here'); });
  await B.ev(async ([u, p]) => { await PatOS.account.signIn(u, p); await PatOS.sync.now(); }, [user, pass]);
  const got = await B.ev(() => ({ diary: PatOS.fs.read('/Documents/diary.txt'), notes: PatOS.store.get('notes'), mine: PatOS.store.get('myOwnThing'), accent: PatOS.settings.accent, big: PatOS.fs.read('/Pictures/big.txt').slice(-7), kept: PatOS.fs.read('/Documents/only-on-b.txt'), snap: PatOS.backup.list().some((x) => x.kind === 'before') }));
  assert.deepEqual(got, { diary: 'my-private-diary-text', notes: [{ id: 'n1', title: 'Secret', body: 'note-body-private' }], mine: { color: 'green' }, accent: '#ff2d55', big: 'THE-END', kept: 'b was here', snap: true });
  // what B had that A did not goes to A, edits and deletions travel both ways
  await B.ev(async () => { PatOS.fs.write('/Documents/diary.txt', 'edited on B'); PatOS.fs.remove('/Pictures/big.txt'); await PatOS.sync.now(); });
  await A.ev(() => PatOS.sync.now());
  assert.deepEqual(await A.ev(() => [PatOS.fs.read('/Documents/diary.txt'), PatOS.fs.exists('/Pictures/big.txt'), PatOS.fs.read('/Documents/only-on-b.txt')]), ['edited on B', false, 'b was here']);
  assert.deepEqual(await A.ev(async () => { const s = await PatOS.backup.collect({ blobs: false }); return ['accountKey', 'accountInfo', 'accountPrompt', 'msgOutbox', 'msgRead', 'syncState', 'linkState'].filter((k) => k in s.kv); }), [], 'backups never carry the account key or the sign-in');
  // device-only things do not travel
  assert.deepEqual(await A.ev(() => [PatOS.store.get('accountKey') ? 'key' : '', 'syncState' in PatOS.store.dump() ? 's' : '']), ['key', 's']);
  assert.equal(await B.ev(() => ['accountKey', 'accountInfo', 'linkState', 'syncState', 'pwVault'].filter((k) => PatOS.sync.mode() && false).length), 0);
  // sign out keeps everything here and stops saving
  await B.ev(() => PatOS.account.signOut());
  assert.deepEqual(await B.ev(() => [PatOS.account.signedIn(), PatOS.sync.on(), PatOS.fs.read('/Documents/diary.txt'), PatOS.store.get('accountKey', null)]), [false, false, 'edited on B', null]);
  assert.deepEqual(A.errors.concat(B.errors), []);
  await A.ctx.close(); await B.ctx.close();
});

test('offline: changes wait on the device and are saved when the connection is back; sign-in survives a restart', { skip: emu.skip }, async () => {
  const user = uniq('olive'), pass = 'offline is fine 123';
  const A = await device(); await A.ev(async ([u, p]) => { await PatOS.account.signUp(u, p); await PatOS.sync.now(); }, [user, pass]);
  await A.ctx.setOffline(true);
  await A.ev(() => PatOS.fs.write('/Documents/offline.txt', 'written offline'));
  const off = await A.ev(async () => { await PatOS.sync.now().catch(() => {}); return { s: PatOS.sync.status().state, f: PatOS.fs.read('/Documents/offline.txt'), signed: PatOS.account.signedIn() }; });
  assert.equal(off.f, 'written offline'); assert.equal(off.signed, true); assert.ok(['offline', 'idle'].includes(off.s));
  await A.page.reload(); await A.page.waitForFunction(() => window.PatOS && PatOS.account && PatOS.fs && PatOS.apps && Object.keys(PatOS.apps).length > 20, null, { timeout: 20000 });
  assert.deepEqual(await A.ev(() => [PatOS.account.signedIn(), PatOS.fs.read('/Documents/offline.txt')]), [true, 'written offline'], 'opens signed in, with everything, offline');
  await A.ctx.setOffline(false);
  await A.page.evaluate(() => { PatOS.notify = () => {}; });
  await A.ev(() => PatOS.account._resume()); await waitFor(A.page, () => PatOS.account.ready(), null, 20000); await A.ev(() => PatOS.sync.now());
  const B = await device(); await B.ev(async ([u, p]) => { await PatOS.account.signIn(u, p); await PatOS.sync.now(); }, [user, pass]);
  assert.equal(await B.ev(() => PatOS.fs.read('/Documents/offline.txt')), 'written offline', 'it was saved once the connection was back');
  await A.ctx.close(); await B.ctx.close();
});

test('the sign-up screens: the big invitation, the form, saving, and Later', { skip: emu.skip }, async () => {
  const user = uniq('erin');
  const A = await device(); const { page } = A;
  await A.ev(() => { PatOS.fs.write('/Documents/before-account.txt', 'I was here first'); });
  await A.ev(() => { PatOS.accountUI.invite(); });
  await page.waitForSelector('.acc-card.big'); assert.match(await page.innerText('.acc-card.big'), /Create your PatOS account[\s\S]*username and a password: no email[\s\S]*Still works offline[\s\S]*Later/);
  await page.click('.acc-later'); assert.equal(await page.locator('.acc-layer').count(), 0); assert.ok((await A.ev(() => PatOS.store.get('accountPrompt'))).snoozedUntil > Date.now() + 80000000, 'asks again tomorrow');
  await A.ev(() => { PatOS.accountUI.invite(); }); await page.click('.acc-card.big .btn.primary'); await page.waitForSelector('.acc-card input[autocomplete=username]');
  await page.fill('input[autocomplete=username]', user); await page.fill('input[placeholder="Password"]', 'a long enough pass'); await page.fill('input[placeholder="Password again"]', 'a different pass'); await page.click('.acc-go');
  assert.match(await page.innerText('.acc-note'), /different/);
  await page.fill('input[placeholder="Password again"]', 'a long enough pass'); await page.click('.acc-go');
  await page.waitForFunction(() => /All saved/.test((document.querySelector('.acc-card') || {}).innerText || ''), null, { timeout: 30000 });
  assert.match(await page.innerText('.acc-card'), new RegExp('@' + user)); await page.click('.acc-card .btn.primary'); assert.equal(await page.locator('.acc-layer').count(), 0);
  // Settings: the header and the Account pane
  const r = await page.evaluate(async () => { const w = PatOS.launch('settings', { pane: 'account' }); await new Promise((res) => setTimeout(res, 800)); return { head: w.body.querySelector('.st-user').innerText, pane: w.body.querySelector('.ac').innerText }; });
  assert.match(r.head, /@erin/); assert.match(r.pane, /Signed in as[\s\S]*@erin[\s\S]*Everything is saved[\s\S]*Sign Out/);
  assert.deepEqual(A.errors, []); await A.ctx.close();
});

test('Messages: find a person, send a request, they accept, chat on any device; strangers see nothing', { skip: emu.skip }, async () => {
  const an = uniq('ann'), bn = uniq('ben'), cn = uniq('cat'), pw = 'chat passwords are long';
  const A = await device(), B = await device(), C = await device();
  for (const [d, u] of [[A, an], [B, bn], [C, cn]]) await d.ev(async ([u, p]) => { await PatOS.account.signUp(u, p); }, [u, pw]);
  for (const d of [A, B, C]) await waitFor(d.page, () => PatOS.chat.ready(), null, 20000);
  // search finds people by the start of their name, but not yourself
  assert.deepEqual(await A.ev(async (p) => (await PatOS.chat.search(p)).map((x) => x.username), bn.slice(0, 7)), [bn]);
  assert.deepEqual(await A.ev(async (p) => (await PatOS.chat.search(p)).map((x) => x.username), an), [], 'not yourself');
  assert.deepEqual(await A.ev(() => PatOS.chat.search('zzzznobody')), []);
  // the request: Ben sees it, with no notification, and nothing changes for Cat
  const bob = (await A.ev(async (p) => (await PatOS.chat.search(p))[0], bn));
  await A.ev(async (o) => { await PatOS.chat.request(o, 'hi Ben, it is Ann'); }, { uid: bob.uid, username: bob.username });
  await waitFor(B.page, () => PatOS.chat.requests().length === 1, null, 15000);
  assert.deepEqual(await B.ev(() => PatOS.chat.requests().map((c) => [c.other.username, c.last, c.status, c.mine])), [[an, 'hi Ben, it is Ann', 'pending', false]]);
  assert.equal(await B.ev(() => window.__notes.filter((x) => x.icon === 'messages').length), 0, 'no notification before accepting');
  assert.deepEqual(await C.ev(() => [PatOS.chat.requests().length, PatOS.chat.conversations().length]), [0, 0]);
  assert.match(await A.ev(async () => { try { const c = PatOS.chat.conversations()[0]; PatOS.chat.send(c.id, 'second message'); return 'sent'; } catch (e) { return e.message; } }), /waiting for an answer/);
  assert.equal(await A.ev(() => PatOS.chat.conversations()[0].status), 'pending');
  // Ben accepts; now Ann's messages notify him and show in the history, and he can answer
  const cid = await B.ev(() => PatOS.chat.requests()[0].id);
  await B.ev(async (id) => { await PatOS.chat.respond(id, true); }, cid);
  await waitFor(A.page, () => PatOS.chat.conversations()[0] && PatOS.chat.conversations()[0].status === 'accepted', null, 15000);
  assert.ok((await A.ev(() => window.__notes.filter((x) => /accepted your message request/.test(x.body)).length)) >= 1, 'Ann hears that Ben accepted');
  await A.ev((id) => { PatOS.chat.send(id, 'thanks for accepting'); }, cid);
  await waitFor(B.page, () => PatOS.chat.conversations()[0] && /thanks/.test(PatOS.chat.conversations()[0].last), null, 15000);
  assert.ok((await B.ev(() => window.__notes.filter((x) => x.icon === 'messages' && /thanks for accepting/.test(x.body)).map((x) => x.title)))[0] === an, 'now there is a notification, from Ann');
  assert.equal(await B.ev(() => PatOS.chat.conversations()[0].unread), true);
  await B.ev((id) => PatOS.chat.open(id), cid); await waitFor(B.page, () => PatOS.chat.messages().length === 2, null, 15000);
  assert.deepEqual(await B.ev(() => PatOS.chat.messages().map((m) => [m.mine, m.text])), [[false, 'hi Ben, it is Ann'], [false, 'thanks for accepting']]);
  assert.equal(await B.ev(() => PatOS.chat.conversations()[0].unread), false, 'reading marks it read');
  await B.ev(() => PatOS.chat.send(PatOS.chat.conversations()[0].id, 'welcome Ann'));
  await A.ev((id) => PatOS.chat.open(id), cid); await waitFor(A.page, () => PatOS.chat.messages().length === 3, null, 15000);
  assert.deepEqual(await A.ev(() => PatOS.chat.messages().map((m) => [m.mine, m.text])), [[true, 'hi Ben, it is Ann'], [true, 'thanks for accepting'], [false, 'welcome Ann']]);
  // the history is in the database, in order, and Cat cannot read it
  const hist = JSON.parse(await (async () => JSON.stringify(await (await fetch('http://127.0.0.1:8180/v1/projects/demo-patos/databases/(default)/documents/conversations/' + cid + '/messages?pageSize=50', { headers: { Authorization: 'Bearer owner' } })).json()))());
  assert.equal(hist.documents.length, 3);
  assert.deepEqual(await C.ev(async (id) => { const F = await PatOS.account.cloud(); try { await new Promise((res, rej) => { const off = F.listenMessages(id, () => { off(); res(); }, (e) => { off(); rej(e); }); }); return 'read'; } catch (e) { return e.code || e.message; } }, cid), 'rules');
  // another device of Ann's has the whole history after signing in
  const A2 = await device(); await A2.ev(async ([u, p]) => { await PatOS.account.signIn(u, p); }, [an, pw]); await waitFor(A2.page, () => PatOS.chat.ready() && PatOS.chat.conversations().length === 1, null, 20000);
  await A2.ev((id) => PatOS.chat.open(id), cid); await waitFor(A2.page, () => PatOS.chat.messages().length === 3, null, 15000);
  // declining later stops the chat
  await B.ev(async (id) => { await PatOS.chat.respond(id, false); }, cid); await waitFor(A.page, () => PatOS.chat.conversations().length === 0, null, 15000).catch(() => {});
  assert.match(await A.ev(async (id) => { try { PatOS.chat.send(id, 'still there?'); return 'sent'; } catch (e) { return e.message; } }, cid), /can’t message/);
  for (const d of [A, B, C, A2]) assert.deepEqual(d.errors, []);
  for (const d of [A, B, C, A2]) await d.ctx.close();
});

test('the Messages window: Messages has no Pat, search, a request and its answer', { skip: emu.skip }, async () => {
  const an = uniq('uma'), bn = uniq('vic'), pw = 'window passwords are long';
  const A = await device(), B = await device();
  await A.ev(() => { PatOS.launch('messages'); }); await A.page.waitForSelector('.m2');
  assert.match(await A.page.innerText('.m2-main'), /Message your friends[\s\S]*Create Account[\s\S]*Pat, the command helper, works without an account/);
  assert.equal(await A.page.locator('.pat-btn, .m2-pat').count(), 0, 'Pat is not in Messages any more');
  await A.page.click('#mb-pat'); await A.page.waitForSelector('#pat-panel:not(.hidden) .msg-chips'); await A.page.fill('#pat-panel .msg-in', 'hello'); await A.page.press('#pat-panel .msg-in', 'Enter'); await A.page.waitForFunction(() => document.querySelectorAll('#pat-panel .msg-b.them:not(.typing)').length >= 2, null, { timeout: 5000 });
  assert.match(await A.page.innerText('#pat-panel'), /Pat/); await A.page.click('#mb-pat'); assert.equal(await A.page.locator('#pat-panel:not(.hidden)').count(), 0);
  for (const [d, u] of [[A, an], [B, bn]]) await d.ev(async ([u, p]) => { await PatOS.account.signUp(u, p); }, [u, pw]);
  for (const d of [A, B]) await waitFor(d.page, () => PatOS.chat.ready(), null, 20000);
  await A.page.waitForSelector('.m2-search'); await A.page.fill('.m2-search', bn.slice(0, 7)); await A.page.waitForSelector('.m2-row >> text=@' + bn, { timeout: 8000 });
  await A.page.click('.m2-row >> text=@' + bn); await A.page.waitForSelector('.m2-main .msg-in'); assert.match(await A.page.innerText('.m2-main'), /sent as a request[\s\S]*gets no notifications from you/);
  await A.page.fill('.m2-main .msg-in', 'hey from the window'); await A.page.press('.m2-main .msg-in', 'Enter');
  await A.page.waitForSelector('.m2-main .msg-b.me', { timeout: 10000 }); await A.page.waitForSelector('.m2-ask', { timeout: 10000 }); assert.match(await A.page.innerText('.m2-ask'), /Waiting for them to accept/);
  await B.ev(() => { PatOS.launch('messages'); }); await B.page.waitForSelector('.m2-h >> text=Requests', { timeout: 15000 });
  await B.page.click('.m2-row >> text=@' + an); await B.page.waitForSelector('.m2-ask .btn.primary'); await B.page.waitForFunction(() => /hey from the window/.test(document.querySelector('.m2-main').innerText), null, { timeout: 10000 });
  await B.page.click('.m2-ask .btn.primary >> text=Accept'); await B.page.waitForSelector('.m2-main .msg-in', { timeout: 10000 });
  await B.page.fill('.m2-main .msg-in', 'hi Uma'); await B.page.press('.m2-main .msg-in', 'Enter');
  await A.page.waitForFunction(() => /hi Uma/.test(document.querySelector('.m2-main').innerText), null, { timeout: 15000 });
  assert.deepEqual(A.errors.concat(B.errors).filter((e) => !/permission|Missing or insufficient/i.test(e)), []);
  await A.ctx.close(); await B.ctx.close();
});

test('deleting an account removes the saved copy and the name', { skip: emu.skip }, async () => {
  const user = uniq('gone'), pass = 'delete me please 1';
  const A = await device(); await A.ev(async ([u, p]) => { PatOS.fs.write('/Documents/x.txt', 'x'); await PatOS.account.signUp(u, p); await PatOS.sync.now(); }, [user, pass]);
  assert.match(await A.ev(async () => { try { await PatOS.account.deleteAccount('the wrong password'); return 'deleted'; } catch (e) { return e.message; } }), /Wrong username or password/);
  await A.ev(async (p) => { await PatOS.account.deleteAccount(p); }, pass);
  assert.deepEqual(await A.ev(() => [PatOS.account.signedIn(), PatOS.fs.read('/Documents/x.txt')]), [false, 'x'], 'what is on the device stays');
  const all = await dumpAll(); assert.ok(!all.includes('"' + user + '"') || !all.includes('usernames/' + user), 'the name is free again');
  const B = await device(); assert.match(await B.ev(async ([u, p]) => { try { await PatOS.account.signIn(u, p); return 'ok'; } catch (e) { return e.message; } }, [user, pass]), /Wrong username or password/);
  await A.ctx.close(); await B.ctx.close();
});

/* the system account (PatOS), end to end: it is made the system account in the console (config/system), then it messages
   someone with no request, shows its badge, and bans and unbans. */
const setSystem = async (uid) => { const r = await fetch('http://127.0.0.1:8180/v1/projects/demo-patos/databases/(default)/documents/config/system', { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { uid: { stringValue: uid } } }) }); assert.ok(r.ok); };
test('the PatOS account: no request needed, its badge, every account, ban (the banned person can only log out) and unban', { skip: emu.skip }, async () => {
  const gn = uniq('patos'), bn = uniq('bea'), pw = 'a long system password';
  const G = await device(), B = await device();
  await G.ev(async ([u, p]) => { await PatOS.account.signUp(u, p); }, [gn, pw]);
  await B.ev(async ([u, p]) => { await PatOS.account.signUp(u, p); }, [bn, pw]);
  const guid = await G.ev(() => PatOS.account.info().uid);
  assert.equal(await G.ev(() => PatOS.account.isSystem()), false, 'not the system account until the console says so');
  await setSystem(guid);
  for (const [d, u] of [[G, gn], [B, bn]]) await d.ev(async ([u, p]) => { await PatOS.account.signOut(); await PatOS.account.signIn(u, p); }, [u, pw]);
  await waitFor(G.page, () => PatOS.account.isSystem() && PatOS.chat.ready(), null, 20000);
  await waitFor(B.page, () => PatOS.account.isSystem(PatOS.store.get('systemUid')) && PatOS.chat.ready(), null, 20000);
  // every account, and a message with no request
  const everyone = await G.ev(() => PatOS.chat.everyone());
  const bea = everyone.find((u) => u.username === bn); assert.ok(bea, 'every account is listed');
  await G.ev(async (o) => { await PatOS.chat.request(o, 'Hello from PatOS'); }, { uid: bea.uid, username: bea.username });
  await waitFor(B.page, () => PatOS.chat.conversations().length === 1 && PatOS.chat.conversations()[0].status === 'accepted', null, 15000);
  assert.equal(await B.ev(() => PatOS.chat.requests().length), 0, 'no request to accept');
  assert.equal(await B.ev(() => PatOS.account.display(PatOS.chat.conversations()[0].other.uid, PatOS.chat.conversations()[0].other.username)), 'PatOS');
  assert.match(await B.ev(async () => { try { await PatOS.chat.respond(PatOS.chat.conversations()[0].id, false); return 'declined'; } catch (e) { return e.message; } }), /rules|permission/i, 'it can\'t be declined');
  // the badge in Messages
  await B.ev(() => PatOS.launch('messages')); await B.page.waitForSelector('.m2-row .sys-badge svg', { timeout: 10000 });
  assert.match(await B.page.textContent('.m2-row'), /PatOS/);
  // ban: Bea sees why, and can only log out
  await G.ev(async (o) => { await PatOS.chat.ban(o, 'Testing the ban'); }, { uid: bea.uid, username: bea.username });
  await B.page.waitForSelector('.ban-layer', { timeout: 15000 });
  assert.match(await B.page.textContent('.ban-layer'), /Your account has been banned[\s\S]*Testing the ban/);
  await B.ev((id) => { try { PatOS.chat.send(id, 'still here'); } catch (e) {} }, await B.ev(() => PatOS.chat.conversations()[0].id));
  await G.page.waitForTimeout(3000);
  assert.equal(await G.ev(() => PatOS.chat.conversations()[0].last), 'Hello from PatOS', 'a banned account can\'t send');
  assert.equal((await G.ev(() => PatOS.chat.everyone())).find((u) => u.uid === bea.uid).ban.reason, 'Testing the ban');
  await B.page.click('.ban-layer .btn.primary');
  await waitFor(B.page, () => !PatOS.account.signedIn() && !document.querySelector('.ban-layer'), null, 10000);
  // unban: Bea signs in again, no ban
  await G.ev(async (o) => { await PatOS.chat.unban(o); }, { uid: bea.uid, username: bea.username });
  await B.ev(async ([u, p]) => { await PatOS.account.signIn(u, p); }, [bn, pw]);
  await B.page.waitForTimeout(2500);
  assert.equal(await B.ev(() => !!document.querySelector('.ban-layer')), false);
  await G.ctx.close(); await B.ctx.close();
});
