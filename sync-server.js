/* PatOS Sync server: a small store for ENCRYPTED records.
   The server never sees what your files are called or what is in them. Each device encrypts every record
   before sending it (see js/sync.js); here there are only opaque ids, scrambled bytes, a time and a size.
   - An account is made from a key the devices share: its id (uid) and a login token both come from that key.
     The server keeps only a hash of the token.
   - Accounts live in PATOS_DATA (default ./data). On Railway, mount a volume and set PATOS_DATA to it.
     If that folder is ever lost (a new Railway, a deleted volume), nothing is lost: devices still have
     everything, and the first time one syncs it recreates the account here and sends it all again.
   Limits (environment variables): SYNC_QUOTA_MB per account (300), SYNC_MAX_ACCOUNTS (200). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = () => path.resolve(process.env.PATOS_DATA || path.join(__dirname, 'data'), 'sync');
const L = () => ({
  body: 30 * 1024 * 1024, record: 14 * 1024 * 1024, quota: (+process.env.SYNC_QUOTA_MB || 300) * 1048576,
  accounts: +process.env.SYNC_MAX_ACCOUNTS || 200, records: 30000, perPull: 200, pullBytes: 8 * 1024 * 1024
});
const UID = /^[A-Za-z0-9_-]{22,64}$/, RID = /^[A-Za-z0-9_-]{16,64}$/, B64 = /^[A-Za-z0-9+/=]*$/;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const json = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b) }); res.end(b); };

/* a simple rate limit, per address */
const hits = new Map();
function limited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); const now = Date.now(); let h = hits.get(ip);
  if (!h || now - h.t > 60000) { h = { t: now, n: 0 }; hits.set(ip, h); }
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > 60000) hits.delete(k);
  return ++h.n > (+process.env.SYNC_RATE || 240);
}

/* one thing at a time per account, so revision numbers never go wrong */
const locks = new Map();
function locked(uid, fn) { const prev = locks.get(uid) || Promise.resolve(); const next = prev.then(fn, fn); locks.set(uid, next.catch(() => {})); return next; }

const dirOf = (uid) => path.join(DATA(), uid);
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const writeJSON = (f, o) => { const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o)); fs.renameSync(tmp, f); };
const account = (uid) => readJSON(path.join(dirOf(uid), 'account.json'));
const loadIndex = (uid) => readJSON(path.join(dirOf(uid), 'index.json')) || { rev: 0, records: {} };

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
function same(a, b) { try { return a.length === b.length && crypto.timingSafeEqual(a, b); } catch (e) { return false; } }
function check(a) {
  const acc = account(a.uid); if (!acc) return { code: 401, error: 'unknown account' };
  if (!same(Buffer.from(acc.tokenHash, 'hex'), a.hash)) return { code: 403, error: 'wrong key' };
  return { acc };
}

async function handle(req, res, url) {
  const route = url.pathname.replace(/^\/api\/sync\/?/, '');
  if (limited(req)) return json(res, 429, { error: 'slow down' });
  try {
    const a = auth(req); if (a.error) return json(res, 400, { error: a.error });

    if (route === 'register' && req.method === 'POST') {
      return json(res, 200, await locked(a.uid, async () => {
        const existing = account(a.uid);
        if (existing) { if (!same(Buffer.from(existing.tokenHash, 'hex'), a.hash)) throw Object.assign(new Error('wrong key'), { code: 403 }); const ix = loadIndex(a.uid); return { epoch: existing.epoch, rev: ix.rev, created: false }; }
        let n = 0; try { n = fs.readdirSync(DATA()).length; } catch (e) {}
        if (n >= L().accounts) throw Object.assign(new Error('this server is full'), { code: 507 });
        fs.mkdirSync(path.join(dirOf(a.uid), 'r'), { recursive: true });
        const acc = { tokenHash: a.hash.toString('hex'), epoch: crypto.randomBytes(9).toString('base64url'), created: Date.now() };
        writeJSON(path.join(dirOf(a.uid), 'account.json'), acc); writeJSON(path.join(dirOf(a.uid), 'index.json'), { rev: 0, records: {} });
        return { epoch: acc.epoch, rev: 0, created: true };
      }));
    }

    const c = check(a); if (c.error) return json(res, c.code, { error: c.error });
    const acc = c.acc;

    if (route === 'status' && req.method === 'GET') {
      const ix = loadIndex(a.uid); let bytes = 0, count = 0; Object.values(ix.records).forEach((r) => { if (!r.del) { bytes += r.size || 0; count++; } });
      return json(res, 200, { epoch: acc.epoch, rev: ix.rev, records: count, bytes, quota: L().quota });
    }

    if (route === 'pull' && req.method === 'GET') {
      const since = Math.max(0, +url.searchParams.get('since') || 0); const ix = loadIndex(a.uid); const lim = L();
      const ids = Object.keys(ix.records).filter((k) => ix.records[k].rev > since).sort((x, y) => ix.records[x].rev - ix.records[y].rev);
      const out = []; let bytes = 0, more = false;
      for (const rid of ids) {
        if (out.length >= lim.perPull || bytes > lim.pullBytes) { more = true; break; }
        const rec = readJSON(path.join(dirOf(a.uid), 'r', rid + '.json')); if (!rec) continue; out.push(rec); bytes += (rec.data || '').length;
      }
      const last = out.length ? out[out.length - 1].rev : ix.rev; // when there is more, the next pull starts after the last record sent
      return json(res, 200, { epoch: acc.epoch, rev: more ? last : ix.rev, serverRev: ix.rev, records: out, more });
    }

    if (route === 'push' && req.method === 'POST') {
      const body = await readBody(req, L().body); const recs = Array.isArray(body.records) ? body.records : [];
      return json(res, 200, await locked(a.uid, async () => {
        const ix = loadIndex(a.uid); const lim = L(); let applied = 0, skipped = 0, rejected = 0;
        let bytes = 0; Object.values(ix.records).forEach((r) => { if (!r.del) bytes += r.size || 0; });
        for (const r of recs.slice(0, 2000)) {
          if (!r || !RID.test(r.rid || '') || !Number.isFinite(+r.t)) { rejected++; continue; }
          const del = !!r.deleted; const data = del ? '' : String(r.data || ''); const iv = del ? '' : String(r.iv || '');
          if (!del && (!B64.test(data) || !B64.test(iv) || data.length > lim.record || iv.length > 32 || !data)) { rejected++; continue; }
          const old = ix.records[r.rid];
          if (old && +old.t > +r.t) { skipped++; continue; } // a newer version is already here: the oldest change never wins
          const size = del ? 0 : Math.ceil(data.length * 3 / 4);
          const newBytes = bytes - (old && !old.del ? old.size || 0 : 0) + size;
          if (newBytes > lim.quota) { rejected++; continue; }
          if (!old && Object.keys(ix.records).length >= lim.records) { rejected++; continue; }
          ix.rev++; ix.records[r.rid] = { rev: ix.rev, t: +r.t, del, size };
          writeJSON(path.join(dirOf(a.uid), 'r', r.rid + '.json'), { rid: r.rid, rev: ix.rev, t: +r.t, deleted: del, iv, data });
          bytes = newBytes; applied++;
        }
        // tombstones older than 90 days are forgotten
        const cut = Date.now() - 90 * 86400000; Object.keys(ix.records).forEach((k) => { const x = ix.records[k]; if (x.del && x.t < cut) { delete ix.records[k]; try { fs.unlinkSync(path.join(dirOf(a.uid), 'r', k + '.json')); } catch (e) {} } });
        writeJSON(path.join(dirOf(a.uid), 'index.json'), ix);
        return { epoch: acc.epoch, rev: ix.rev, applied, skipped, rejected };
      }));
    }

    if (route === 'account' && req.method === 'DELETE') {
      await locked(a.uid, async () => { fs.rmSync(dirOf(a.uid), { recursive: true, force: true }); });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.code ? e.message : 'server error' });
  }
}

module.exports = { handle };
