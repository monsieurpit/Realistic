/* Web Push for Messages: a new message reaches the other person's devices even when PatOS is in the background, minimized,
   or closed (Chrome on ChromeOS, Windows, macOS and Android; Edge; Firefox; Safari on Mac; PatOS added to the Home Screen on
   iPhone and iPad, iOS 16.4 or later).

   - POST /api/push/subscribe   { endpoint, keys: { p256dh, auth } }   with a Firebase sign-in token: this device wants pushes
   - POST /api/push/unsubscribe { endpoint }                           with a Firebase sign-in token
   - POST /api/push/message     { cid }                                with the SENDER's Firebase sign-in token, after sending
   - GET  /api/push/key         the server's public key (applicationServerKey)

   The server never trusts the page about a message: it reads the conversation from Firestore with the sender's own token
   (so the database rules decide what they may read), and only pushes when that conversation is accepted, the sender is in
   it and wrote its last message a moment ago. The words pushed are the conversation's own last message, not anything the
   page sends. The payload is encrypted for the receiving device (RFC 8291), so the push service can't read it.
   Pushes only go to real push services (Google, Apple, Mozilla, Microsoft), never to any other address.

   Keys: PUSH_VAPID_PUBLIC / PUSH_VAPID_PRIVATE (base64url), or made once and kept in PATOS_DATA/push/vapid.json.
   Subscriptions are kept in PATOS_DATA/push/subs.json; a device sends its subscription again each time PatOS starts, so
   losing that file only pauses pushes until each device next opens PatOS. PUSH_SUBJECT: the contact sent to push services
   (default: https://<this server>). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { verifyIdToken } = require('./admin-server.js');

const PROJECT = () => (process.env.FIREBASE_PROJECT_ID || 'patos-92a43').trim();
const DIR = () => path.resolve(process.env.PATOS_DATA || path.join(__dirname, 'data'), 'push');
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const fail = (code, msg) => Object.assign(new Error(msg), { status: code });
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const writeJSON = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o)); fs.renameSync(tmp, f); };

/* ---------- the server's key pair (VAPID, P-256) ---------- */
let vapid = null;
function keys() {
  if (vapid) return vapid;
  const pub = (process.env.PUSH_VAPID_PUBLIC || '').trim(), priv = (process.env.PUSH_VAPID_PRIVATE || '').trim();
  if (pub && priv) vapid = { pub, priv };
  else {
    const f = path.join(DIR(), 'vapid.json'); vapid = readJSON(f);
    if (!vapid || !vapid.pub || !vapid.priv) {
      const ec = crypto.createECDH('prime256v1'); ec.generateKeys();
      vapid = { pub: b64u(ec.getPublicKey()), priv: b64u(ec.getPrivateKey()) };
      try { writeJSON(f, vapid); } catch (e) {}
    }
  }
  return vapid;
}
function privateKeyObject(pubB64, privB64) {
  const pub = unb64u(pubB64);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(unb64u(privB64)), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
}
/* the signed note that says this server sent the push (RFC 8292) */
function vapidHeader(endpoint, subject, now) {
  const k = keys(); const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor((now || Date.now()) / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: privateKeyObject(k.pub, k.priv), dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + k.pub;
}

/* ---------- the payload, encrypted for one device (RFC 8291, aes128gcm) ---------- */
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
function encrypt(sub, plaintext, salt, asKeys) {
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw fail(400, 'Bad subscription keys.');
  const as = asKeys || crypto.createECDH('prime256v1'); if (!asKeys) as.generateKeys();
  const asPublic = as.getPublicKey(); const secret = as.computeSecret(uaPublic);
  salt = salt || crypto.randomBytes(16);
  const prkKey = hmac(authSecret, secret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = 65;
  return Buffer.concat([head, asPublic, ct]);
}

/* ---------- where pushes may go ---------- */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^web\.push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
function allowedEndpoint(e) {
  let u; try { u = new URL(String(e)); } catch (x) { return false; }
  if (String(e).length > 1000) return false;
  const extra = (process.env.PUSH_ALLOW_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean); // (tests: a local pretend push service)
  if (extra.includes(u.host)) return true;
  return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((r) => r.test(u.hostname));
}

/* ---------- subscriptions: uid -> [{ endpoint, keys, at }] ---------- */
let subs = null;
const subsFile = () => path.join(DIR(), 'subs.json');
function load() { if (!subs) subs = readJSON(subsFile()) || {}; return subs; }
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { writeJSON(subsFile(), subs); } catch (e) {} }, 200); }
function addSub(uid, s) {
  const all = load();
  Object.keys(all).forEach((u) => { all[u] = all[u].filter((x) => x.endpoint !== s.endpoint); if (!all[u].length) delete all[u]; }); // a device belongs to one account
  const l = (all[uid] = all[uid] || []); l.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, at: Date.now() });
  all[uid] = l.slice(-10); save();
}
function removeSub(endpoint) { const all = load(); Object.keys(all).forEach((u) => { all[u] = all[u].filter((x) => x.endpoint !== endpoint); if (!all[u].length) delete all[u]; }); save(); }

/* ---------- checking who is asking ---------- */
const emulated = () => !!(process.env.FIREBASE_AUTH_EMULATOR_HOST || '').trim();
async function who(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || ''); if (!m) throw fail(401, 'Sign in first.');
  if (emulated()) { // the Firebase emulator signs nothing; tests only
    let c; try { c = JSON.parse(unb64u(m[1].split('.')[1])); } catch (e) { throw fail(401, 'Sign in again.'); }
    if (!c || typeof c.sub !== 'string' || !c.sub || c.aud !== PROJECT()) throw fail(401, 'Sign in again.');
    return { uid: c.sub, token: m[1] };
  }
  const c = await verifyIdToken(m[1]); return { uid: c.sub, token: m[1] };
}
/* a conversation, read with the asker's own token (the database rules decide) */
async function conversation(cid, token) {
  const emu = (process.env.FIRESTORE_EMULATOR_HOST || '').trim();
  const base = emu ? 'http://' + emu : 'https://firestore.googleapis.com';
  const r = await fetch(base + '/v1/projects/' + encodeURIComponent(PROJECT()) + '/databases/(default)/documents/conversations/' + encodeURIComponent(cid), { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 403 || r.status === 404) throw fail(403, 'Not your conversation.');
  if (!r.ok) throw fail(502, 'The database could not be read.');
  const f = (await r.json()).fields || {};
  const str = (x) => (x && (x.stringValue != null ? x.stringValue : x.timestampValue)) || '';
  return {
    members: ((f.members && f.members.arrayValue && f.members.arrayValue.values) || []).map((v) => v.stringValue),
    status: str(f.status), lastFrom: str(f.lastFrom), lastMessage: str(f.lastMessage), lastAt: Date.parse(str(f.lastMessageAt)) || 0,
    usernames: Object.fromEntries(Object.entries((f.usernames && f.usernames.mapValue && f.usernames.mapValue.fields) || {}).map(([k, v]) => [k, v.stringValue || '']))
  };
}

/* ---------- sending one push ---------- */
async function pushTo(sub, payload, subject) {
  const body = encrypt(sub, JSON.stringify(payload));
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high', Topic: String(payload.tag || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'patos', Authorization: vapidHeader(sub.endpoint, subject) }, body });
  if (r.status === 404 || r.status === 410) removeSub(sub.endpoint); // that device is gone
  return r.status;
}

const recent = new Map(); // cid -> lastAt already pushed
const tries = new Map(); // uid -> [times]
function limited(uid) {
  const now = Date.now(); const l = (tries.get(uid) || []).filter((t) => now - t < 60000); l.push(now); tries.set(uid, l);
  if (tries.size > 5000) tries.clear(); return l.length > 30;
}
const body = (req) => new Promise((ok, bad) => { let s = ''; req.on('data', (d) => { s += d; if (s.length > 4096) { bad(fail(413, 'Too big.')); req.destroy(); } }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { bad(fail(400, 'Bad request')); } }); req.on('error', bad); });
const subjectOf = (req) => (process.env.PUSH_SUBJECT || '').trim() || 'https://' + String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();

async function handle(req, res, url) {
  try {
    const p = url.pathname;
    if (p === '/api/push/key' && req.method === 'GET') return send(res, 200, { key: keys().pub });
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    const me = await who(req); if (limited(me.uid)) return send(res, 429, { error: 'Too many.' });
    const b = await body(req);
    if (p === '/api/push/subscribe') {
      if (!b || !allowedEndpoint(b.endpoint) || !b.keys || typeof b.keys.p256dh !== 'string' || typeof b.keys.auth !== 'string' || b.keys.p256dh.length > 200 || b.keys.auth.length > 100) return send(res, 400, { error: 'Bad subscription.' });
      addSub(me.uid, b); return send(res, 200, { ok: true });
    }
    if (p === '/api/push/unsubscribe') { if (b && typeof b.endpoint === 'string') { const l = load()[me.uid] || []; if (l.some((x) => x.endpoint === b.endpoint)) removeSub(b.endpoint); } return send(res, 200, { ok: true }); }
    if (p === '/api/push/message') {
      const cid = String((b && b.cid) || ''); if (!/^[\w-]{1,200}$/.test(cid)) return send(res, 400, { error: 'Bad request' });
      const c = await conversation(cid, me.token);
      if (!c.members.includes(me.uid) || c.status !== 'accepted' || c.lastFrom !== me.uid) return send(res, 200, { sent: 0 });
      if (!(Date.now() - c.lastAt < 120000) || recent.get(cid) === c.lastAt) return send(res, 200, { sent: 0 }); // only a message just sent, once
      recent.set(cid, c.lastAt); if (recent.size > 10000) recent.clear();
      const to = c.members.find((u) => u !== me.uid); const list = (load()[to] || []).slice();
      const payload = { title: c.usernames[me.uid] || 'PatOS', body: c.lastMessage.slice(0, 140), tag: 'msg-' + cid, cid, at: c.lastAt };
      const subject = subjectOf(req);
      const out = await Promise.all(list.map((s) => pushTo(s, payload, subject).catch(() => 0)));
      return send(res, 200, { sent: out.filter((s) => s >= 200 && s < 300).length });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (e) { return send(res, e.status || 500, { error: e.status ? e.message : 'Server error' }); }
}

module.exports = { handle, encrypt, vapidHeader, allowedEndpoint, _keys: keys, _reset: () => { vapid = null; subs = null; } };
