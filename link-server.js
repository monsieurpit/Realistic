/* PatLink server: a mailbox for ENCRYPTED messages between people (or devices) who share a code.
   The server never sees who writes to whom or what is sent: each device encrypts every item before sending it
   (see js/link.js). Here there are only an opaque room id, scrambled bytes, a time and a size.
   - A room is made from the code the friends share: its id and a login token both come from that code. The server
     keeps only a hash of the token. Anyone with the code can write to and read the room.
   - Items older than 30 days are forgotten, and when a room is over its limit the oldest items go first
     (a chat keeps working; it just forgets the oldest things). Items already received stay on each device.
   - Rooms live in PATOS_DATA/link. If that folder is lost, the room is made again by the next device that talks to it.
   Limits (environment variables): LINK_QUOTA_MB per room (100), LINK_MAX_ROOMS (100), LINK_RATE requests a minute per address (240). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = () => path.resolve(process.env.PATOS_DATA || path.join(__dirname, 'data'), 'link');
const L = () => ({ body: 16 * 1048576, item: 13 * 1048576, quota: (+process.env.LINK_QUOTA_MB || 100) * 1048576, rooms: +process.env.LINK_MAX_ROOMS || 100, items: 3000, perPoll: 60, pollBytes: 8 * 1048576, keepMs: 30 * 86400000 });
const UID = /^[A-Za-z0-9_-]{22,64}$/, IID = /^[A-Za-z0-9_-]{12,64}$/, B64 = /^[A-Za-z0-9+/=]*$/;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const json = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b) }); res.end(b); };
const hits = new Map();
function limited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); const now = Date.now(); let h = hits.get(ip);
  if (!h || now - h.t > 60000) { h = { t: now, n: 0 }; hits.set(ip, h); }
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > 60000) hits.delete(k);
  return ++h.n > (+process.env.LINK_RATE || 240);
}
const locks = new Map();
function locked(uid, fn) { const prev = locks.get(uid) || Promise.resolve(); const next = prev.then(fn, fn); locks.set(uid, next.catch(() => {})); return next; }
const dirOf = (uid) => path.join(DATA(), uid);
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const writeJSON = (f, o) => { const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o)); fs.renameSync(tmp, f); };
const room = (uid) => readJSON(path.join(dirOf(uid), 'room.json'));
const loadIndex = (uid) => readJSON(path.join(dirOf(uid), 'index.json')) || { seq: 0, items: [] };
const itemFile = (uid, seq) => path.join(dirOf(uid), 'i', seq + '.json');
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > max) { reject(Object.assign(new Error('too big'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('bad json'), { code: 400 })); } });
    req.on('error', reject);
  });
}
function auth(req) {
  const uid = String(req.headers['x-patos-uid'] || ''); const tok = String((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (!UID.test(uid) || !tok || tok.length > 200) return { error: 'bad credentials' };
  return { uid, hash: sha(tok) };
}
const same = (a, b) => { try { return a.length === b.length && crypto.timingSafeEqual(a, b); } catch (e) { return false; } };
const drop = (uid, x) => { try { fs.unlinkSync(itemFile(uid, x.seq)); } catch (e) {} };

async function handle(req, res, url) {
  const route = url.pathname.replace(/^\/api\/link\/?/, '');
  // another PatOS site may talk to this server (an old copy filling a new server); every request needs the room's token
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Patos-Uid'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS'); res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (limited(req)) return json(res, 429, { error: 'slow down' });
  try {
    const a = auth(req); if (a.error) return json(res, 400, { error: a.error });
    if (route === 'register' && req.method === 'POST') {
      return json(res, 200, await locked(a.uid, async () => {
        const ex = room(a.uid);
        if (ex) { if (!same(Buffer.from(ex.tokenHash, 'hex'), a.hash)) throw Object.assign(new Error('wrong key'), { code: 403 }); return { epoch: ex.epoch, rev: loadIndex(a.uid).seq, created: false }; }
        let n = 0; try { n = fs.readdirSync(DATA()).length; } catch (e) {}
        if (n >= L().rooms) throw Object.assign(new Error('this server is full'), { code: 507 });
        fs.mkdirSync(path.join(dirOf(a.uid), 'i'), { recursive: true });
        const r = { tokenHash: a.hash.toString('hex'), epoch: crypto.randomBytes(9).toString('base64url'), created: Date.now() };
        writeJSON(path.join(dirOf(a.uid), 'room.json'), r); writeJSON(path.join(dirOf(a.uid), 'index.json'), { seq: 0, items: [] });
        return { epoch: r.epoch, rev: 0, created: true };
      }));
    }
    const r = room(a.uid); if (!r) return json(res, 401, { error: 'unknown room' });
    if (!same(Buffer.from(r.tokenHash, 'hex'), a.hash)) return json(res, 403, { error: 'wrong key' });

    if (route === 'poll' && req.method === 'GET') {
      const since = Math.max(0, +url.searchParams.get('since') || 0); const ix = loadIndex(a.uid); const lim = L();
      const out = []; let bytes = 0, more = false;
      for (const x of ix.items) {
        if (x.seq <= since) continue;
        if (out.length >= lim.perPoll || bytes > lim.pollBytes) { more = true; break; }
        const rec = readJSON(itemFile(a.uid, x.seq)); if (!rec) continue; out.push(rec); bytes += (rec.data || '').length;
      }
      const last = out.length ? out[out.length - 1].seq : since;
      return json(res, 200, { epoch: r.epoch, rev: more ? last : Math.max(ix.seq, since), items: out, more });
    }

    if (route === 'send' && req.method === 'POST') {
      const body = await readBody(req, L().body); const items = Array.isArray(body.items) ? body.items : [];
      return json(res, 200, await locked(a.uid, async () => {
        const ix = loadIndex(a.uid); const lim = L(); let applied = 0, duplicate = 0, rejected = 0; const have = new Set(ix.items.map((x) => x.id));
        for (const it of items.slice(0, 50)) {
          if (!it || !IID.test(it.id || '') || !Number.isFinite(+it.t)) { rejected++; continue; }
          const data = String(it.data || ''), iv = String(it.iv || '');
          if (!data || !B64.test(data) || !B64.test(iv) || data.length > lim.item || iv.length > 32) { rejected++; continue; }
          if (have.has(it.id)) { duplicate++; continue; } // the device sent it again (a retry): keep one
          ix.seq++; have.add(it.id);
          ix.items.push({ seq: ix.seq, id: it.id, t: +it.t, size: data.length });
          writeJSON(itemFile(a.uid, ix.seq), { seq: ix.seq, id: it.id, t: +it.t, iv, data }); applied++;
        }
        // forget old items, and the oldest ones when over the limit
        const cut = Date.now() - lim.keepMs; let total = ix.items.reduce((n, x) => n + x.size, 0);
        while (ix.items.length && (ix.items[0].t < cut || total > lim.quota || ix.items.length > lim.items) && ix.items.length > 1) { const x = ix.items.shift(); total -= x.size; drop(a.uid, x); }
        writeJSON(path.join(dirOf(a.uid), 'index.json'), ix);
        return { epoch: r.epoch, rev: ix.seq, applied, duplicate, rejected };
      }));
    }

    if (route === 'room' && req.method === 'DELETE') {
      await locked(a.uid, async () => { fs.rmSync(dirOf(a.uid), { recursive: true, force: true }); });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) { return json(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.code ? e.message : 'server error' }); }
}
module.exports = { handle };
