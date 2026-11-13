/* Web Push for Messages (push-server.js) end to end, against the Firebase emulator: Ann messages Ben, and PatOS's server pushes
   it to Ben's device (here a pretend push service on this machine, which decrypts it like a browser would). Strangers, replays,
   requests not yet accepted and a device that is gone are all checked. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const emu = require('./emulator');
const { startServer, browser, boot } = require('../helpers');

let server, srv, b, svc, svcPort; const got = [];
const tag = Date.now().toString(36).slice(-5);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-pushdata-'));
const b64u = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
function decrypt(body, ua, authSecret) {
  const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const ikm = hmac(hmac(authSecret, ua.computeSecret(asPublic)), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm); const d = crypto.createDecipheriv('aes-128-gcm', hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12));
  d.setAuthTag(ct.subarray(ct.length - 16)); const p = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]); return JSON.parse(p.subarray(0, p.length - 1).toString());
}
const dev = () => { const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); return { ua, auth: crypto.randomBytes(16) }; };

test.before(async () => {
  if (emu.skip) return; server = await emu.start();
  svc = http.createServer((req, res) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => { got.push({ url: req.url, headers: req.headers, body: Buffer.concat(ch) }); res.writeHead(/gone/.test(req.url) ? 410 : 201); res.end(); }); });
  await new Promise((r) => svc.listen(0, '127.0.0.1', r)); svcPort = svc.address().port;
  Object.assign(process.env, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', FIREBASE_PROJECT_ID: 'demo-patos', PATOS_DATA: DATA, PUSH_ALLOW_HOSTS: '127.0.0.1:' + svcPort, PUSH_SUBJECT: 'https://patos.test' });
  srv = await startServer(); b = await browser();
});
test.after(async () => { if (b) await b.close(); if (srv) srv.stop(); if (svc) svc.close(); if (server) server.stop(); });
const EMU = { auth: 'http://127.0.0.1:9199', firestoreHost: '127.0.0.1', firestorePort: 8180, projectId: 'demo-patos' };
async function person(name) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } }); await ctx.addInitScript((e) => { window.__PATOS_FIREBASE_EMULATOR = e; }, EMU);
  const page = await ctx.newPage(); const errors = await boot(page, srv.base, { fresh: true });
  const u = name + tag; await page.evaluate(async (u) => { await PatOS.account.signUp(u, 'a long password 1'); }, u);
  await page.waitForFunction(() => PatOS.chat.ready(), null, { timeout: 20000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { ctx, page, ev, errors, name: u, uid: await ev(() => PatOS.account.info().uid) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms) => { const end = Date.now() + (ms || 15000); while (Date.now() < end) { if (fn()) return true; await wait(200); } return false; };
const api = (P, p, body) => P.ev(async ([p, body]) => { try { return { ok: true, r: await PatOS.chat._push.post(p, body) }; } catch (e) { return { ok: false, e: e.message }; } }, [p, body]);

test('a message reaches the other person’s device as an encrypted push, and only then', { skip: emu.skip }, async () => {
  assert.match(await (await fetch(srv.base + '/api/push/key')).text(), /"key":"[A-Za-z0-9_-]{80,}"/);
  const A = await person('pa'), B = await person('pb'), C = await person('pc');
  // Ben's device subscribes (a real browser would get this address from Google, Apple, Mozilla or Microsoft)
  const d = dev(); const sub = { endpoint: 'http://127.0.0.1:' + svcPort + '/push/ben', keys: { p256dh: b64u(d.ua.getPublicKey()), auth: b64u(d.auth) } };
  assert.deepEqual(await api(B, 'subscribe', sub), { ok: true, r: { ok: true } });
  // an address that isn't a push service is refused
  assert.equal((await api(B, 'subscribe', Object.assign({}, sub, { endpoint: 'http://127.0.0.1:1/x' }))).ok, false);
  assert.equal((await fetch(srv.base + '/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub) })).status, 401, 'not without signing in');

  // a request not accepted yet: no push
  const cid = await A.ev(async (o) => PatOS.chat.request(o, 'hi Ben'), { uid: B.uid, username: B.name });
  await wait(2500); assert.equal(got.length, 0, 'a message request does not push');
  await B.page.waitForFunction(() => PatOS.chat.requests().length === 1, null, { timeout: 15000 });
  await B.ev(async (id) => PatOS.chat.respond(id, true), cid);
  await A.page.waitForFunction((id) => (PatOS.chat.find(id) || {}).status === 'accepted', cid, { timeout: 15000 });

  // Ann sends a message: Ben's device gets it
  await A.ev((id) => PatOS.chat.send(id, 'Salut Ben, ça va? 👋'), cid);
  assert.ok(await until(() => got.length === 1), 'the push arrived');
  const p = got[0];
  assert.equal(p.url, '/push/ben'); assert.equal(p.headers['content-encoding'], 'aes128gcm'); assert.equal(p.headers.ttl, '86400'); assert.match(p.headers.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  const msg = decrypt(p.body, d.ua, d.auth);
  assert.equal(msg.title, A.name); assert.equal(msg.body, 'Salut Ben, ça va? 👋'); assert.equal(msg.cid, cid); assert.equal(msg.tag, 'msg-' + cid);
  assert.ok(!p.body.toString('latin1').includes('Salut'), 'the push service can’t read it');

  // replaying the same message: nothing; Ben asking about Ann's message: nothing; a stranger: refused
  assert.deepEqual((await api(A, 'message', { cid })).r, { sent: 0 });
  assert.deepEqual((await api(B, 'message', { cid })).r, { sent: 0 });
  const s = await api(C, 'message', { cid }); assert.equal(s.ok, false); assert.match(s.e, /403/);
  assert.equal(got.length, 1);

  // a device that is gone (410) is forgotten
  const d2 = dev(); await api(B, 'subscribe', { endpoint: 'http://127.0.0.1:' + svcPort + '/push/gone', keys: { p256dh: b64u(d2.ua.getPublicKey()), auth: b64u(d2.auth) } });
  await A.ev((id) => PatOS.chat.send(id, 'second'), cid);
  assert.ok(await until(() => got.length === 3), 'both of Ben’s devices were tried');
  assert.equal(decrypt(got.find((g, i) => i > 0 && g.url === '/push/ben').body, d.ua, d.auth).body, 'second');
  await wait(600); const saved = JSON.parse(fs.readFileSync(path.join(DATA, 'push', 'subs.json'), 'utf8'));
  assert.deepEqual(saved[B.uid].map((x) => x.endpoint), [sub.endpoint], 'the gone device was removed');

  // Ben signs out on that device: it stops being his (unsubscribe)
  assert.deepEqual((await api(B, 'unsubscribe', { endpoint: sub.endpoint })).r, { ok: true });
  await A.ev((id) => PatOS.chat.send(id, 'third'), cid); await wait(2500);
  assert.equal(got.length, 3, 'no more pushes to a device that unsubscribed');
  for (const P of [A, B, C]) { assert.deepEqual(P.errors, []); await P.ctx.close(); }
});
