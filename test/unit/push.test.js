/* push-server.js: the Web Push pieces PatOS makes itself (no library): the payload encrypted for one device (RFC 8291),
   the server's signed note (VAPID, RFC 8292), and the push services it may send to. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.PATOS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-push-'));
delete process.env.PUSH_VAPID_PUBLIC; delete process.env.PUSH_VAPID_PRIVATE;
const P = require('../../push-server.js');
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();

/* what a browser does with a push it receives (the receiving side of RFC 8291) */
function decrypt(body, ua, authSecret) {
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  assert.equal(rs, 4096); assert.equal(idlen, 65);
  const secret = ua.computeSecret(asPublic); const uaPublic = ua.getPublicKey();
  const ikm = hmac(hmac(authSecret, secret), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, 'the last record ends with the delimiter 2'); return plain.subarray(0, plain.length - 1).toString();
}

test('a push payload can only be read by the device it is for', () => {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } };
  const msg = JSON.stringify({ title: 'ann', body: 'Salut, ça va? 👋' });
  const body = P.encrypt(sub, msg);
  assert.equal(decrypt(body, ua, auth), msg);
  // another device (other keys) can't
  const other = crypto.createECDH('prime256v1'); other.generateKeys();
  assert.throws(() => decrypt(body, other, auth)); assert.throws(() => decrypt(body, ua, crypto.randomBytes(16)));
  // each push is different (new salt and key every time)
  assert.notDeepEqual(P.encrypt(sub, msg), body);
});

test('the signed note (VAPID) is a valid ES256 token for the push service, signed by the server’s key', () => {
  const h = P.vapidHeader('https://web.push.apple.com/abc', 'https://patos.example');
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(h); assert.ok(m, h);
  const [head, body, sig] = m[1].split('.'); const pub = unb64u(m[2]); assert.equal(pub.length, 65);
  assert.deepEqual(JSON.parse(unb64u(head)), { typ: 'JWT', alg: 'ES256' });
  const c = JSON.parse(unb64u(body)); assert.equal(c.aud, 'https://web.push.apple.com'); assert.equal(c.sub, 'https://patos.example'); assert.ok(c.exp > Date.now() / 1000 && c.exp <= Date.now() / 1000 + 24 * 3600);
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' }, unb64u(sig)));
  assert.equal(m[2], P._keys().pub, 'the same key the devices subscribe with');
  // kept, so subscriptions stay valid after a restart
  const saved = JSON.parse(fs.readFileSync(path.join(process.env.PATOS_DATA, 'push', 'vapid.json'), 'utf8')); assert.equal(saved.pub, m[2]);
});

test('pushes only go to real push services', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://web.push.apple.com/QAbc', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-par02p.notify.windows.com/w/?token=x']) assert.equal(P.allowedEndpoint(ok), true, ok);
  for (const bad of ['http://fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'https://169.254.169.254/latest', 'http://127.0.0.1:8080/', 'file:///etc/passwd', 'nonsense', 'https://notify.windows.com.evil.io/']) assert.equal(P.allowedEndpoint(bad), false, bad);
});

test('matches the official example of RFC 8291 (Appendix A) byte for byte', () => {
  const as = crypto.createECDH('prime256v1'); as.setPrivateKey(unb64u('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'));
  const sub = { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } };
  const body = P.encrypt(sub, 'When I grow up, I want to be a watermelon', unb64u('DGv6ra1nlYgDCS1FRnbzlw'), as);
  assert.equal(b64u(body), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});
