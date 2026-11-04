/* PatOS community apps: submissions, review and the list of accepted apps.
   - Anyone can send an app (a .patapp file) from App Store › Develop. It waits here, unpublished.
   - The owner reviews it at /apprequests. That page is protected by a password that is NOT in the code:
     it comes from the environment variable APPS_ADMIN_PASSWORD (set it on Railway). If it is not set, a random
     one is made at start-up and printed in the log.
   - Accepted apps appear in App Store › Community for everyone. A new version of an app goes back to review.
   Files live in PATOS_DATA/apps (pending/, accepted/, tickets/). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fmt = require('./js/patapp-format.js');

const DATA = () => path.resolve(process.env.PATOS_DATA || path.join(__dirname, 'data'), 'apps');
const dir = (n) => { const d = path.join(DATA(), n); fs.mkdirSync(d, { recursive: true }); return d; };
const LIM = { body: 1.3 * 1048576, pending: 200, accepted: 300, perHour: 10 };
const json = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b) }); res.end(b); };
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const writeJSON = (f, o) => { const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o)); fs.renameSync(tmp, f); };
const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

/* the review password, and sign-in tokens that last 12 hours */
let adminPass = (process.env.APPS_ADMIN_PASSWORD || '').trim();
if (!adminPass) { adminPass = crypto.randomBytes(9).toString('base64url'); console.log('PatOS /apprequests: APPS_ADMIN_PASSWORD is not set, so a temporary password was made for this run: ' + adminPass); }
const secret = crypto.randomBytes(32);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sign = (exp) => crypto.createHmac('sha256', secret).update(String(exp)).digest('base64url');
function makeToken() { const exp = Date.now() + 12 * 3600e3; return exp + '.' + sign(exp); }
function goodToken(t) {
  const [exp, sig] = String(t || '').split('.'); if (!exp || !sig || !(+exp > Date.now())) return false;
  const a = Buffer.from(sign(exp)), b = Buffer.from(sig); return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const fails = new Map(), subs = new Map();
function tooMany(map, key, max, ms) { const now = Date.now(); let h = map.get(key); if (!h || now - h.t > ms) { h = { t: now, n: 0 }; map.set(key, h); } if (map.size > 5000) for (const [k, v] of map) if (now - v.t > ms) map.delete(k); return h.n >= max; }
const bump = (map, key) => { const h = map.get(key); if (h) h.n++; };

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > max) { reject(Object.assign(new Error('That is too big.'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('Bad request.'), { code: 400 })); } });
    req.on('error', reject);
  });
}
const meta = (a) => ({ id: a.id, name: a.name, version: a.version, author: a.author, description: a.description, icon: a.icon, color: a.color, permissions: a.permissions, engine: a.engine || 'web', size: a.html.length });
const list = (sub) => { try { return fs.readdirSync(dir(sub)).filter((f) => /\.json$/.test(f)).map((f) => readJSON(path.join(dir(sub), f))).filter(Boolean); } catch (e) { return []; } };

async function handle(req, res, url) {
  const route = url.pathname.replace(/^\/api\/apps\/?/, '');
  try {
    if (route === 'store' && req.method === 'GET') return json(res, 200, { apps: list('accepted').map((r) => Object.assign(meta(r.app), { accepted: r.accepted })) });
    if (route === 'get' && req.method === 'GET') {
      const id = url.searchParams.get('id') || ''; if (!fmt.ID.test(id)) return json(res, 400, { error: 'Bad id.' });
      const r = readJSON(path.join(dir('accepted'), id + '.json')); if (!r) return json(res, 404, { error: 'Not found.' });
      return json(res, 200, { app: r.app });
    }
    if (route === 'status' && req.method === 'GET') {
      const t = url.searchParams.get('ticket') || ''; if (!/^[A-Za-z0-9_-]{16,40}$/.test(t)) return json(res, 400, { error: 'Bad ticket.' });
      const r = readJSON(path.join(dir('tickets'), t + '.json')); if (!r) return json(res, 404, { error: 'Not found.' });
      return json(res, 200, { status: r.status, id: r.id, name: r.name, version: r.version, note: r.note || '', at: r.at });
    }
    if (route === 'submit' && req.method === 'POST') {
      if (tooMany(subs, ip(req), LIM.perHour, 3600e3)) return json(res, 429, { error: 'Too many submissions. Try again later.' });
      const body = await readBody(req, LIM.body); const v = fmt.validate(body.app);
      if (!v.ok) return json(res, 400, { error: v.error });
      if (list('pending').length >= LIM.pending) return json(res, 507, { error: 'The review list is full. Try again later.' });
      bump(subs, ip(req));
      const ticket = crypto.randomBytes(16).toString('base64url');
      writeJSON(path.join(dir('pending'), v.app.id + '.json'), { ticket, app: v.app, submitted: Date.now() });
      writeJSON(path.join(dir('tickets'), ticket + '.json'), { id: v.app.id, name: v.app.name, version: v.app.version, status: 'pending', at: Date.now() });
      return json(res, 200, { ticket, status: 'pending' });
    }
    if (route === 'admin/login' && req.method === 'POST') {
      const k = ip(req); if (tooMany(fails, k, 5, 15 * 60e3)) return json(res, 429, { error: 'Too many tries. Wait 15 minutes.' });
      const body = await readBody(req, 4096);
      const ok = crypto.timingSafeEqual(sha(body.password || ''), sha(adminPass));
      if (!ok) { bump(fails, k); return json(res, 403, { error: 'Wrong password.' }); }
      return json(res, 200, { token: makeToken() });
    }
    if (route.startsWith('admin/')) {
      if (!goodToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) return json(res, 401, { error: 'Sign in again.' });
      if (route === 'admin/list' && req.method === 'GET') return json(res, 200, {
        pending: list('pending').map((r) => Object.assign(meta(r.app), { ticket: r.ticket, submitted: r.submitted })).sort((a, b) => a.submitted - b.submitted),
        accepted: list('accepted').map((r) => Object.assign(meta(r.app), { accepted: r.accepted })) });
      if (route === 'admin/app' && req.method === 'GET') {
        const id = url.searchParams.get('id') || ''; if (!fmt.ID.test(id)) return json(res, 400, { error: 'Bad id.' });
        const r = readJSON(path.join(dir(url.searchParams.get('from') === 'accepted' ? 'accepted' : 'pending'), id + '.json')); if (!r) return json(res, 404, { error: 'Not found.' });
        return json(res, 200, { app: r.app, ticket: r.ticket || null });
      }
      if (route === 'admin/decide' && req.method === 'POST') {
        const body = await readBody(req, 8192); const id = String(body.id || ''); if (!fmt.ID.test(id)) return json(res, 400, { error: 'Bad id.' });
        const pf = path.join(dir('pending'), id + '.json'); const r = readJSON(pf); if (!r) return json(res, 404, { error: 'Nothing to review for that app.' });
        const note = String(body.note || '').slice(0, 300); const tf = path.join(dir('tickets'), r.ticket + '.json'); const t = readJSON(tf) || { id, name: r.app.name, version: r.app.version };
        if (body.decision === 'accept') {
          if (list('accepted').length >= LIM.accepted && !fs.existsSync(path.join(dir('accepted'), id + '.json'))) return json(res, 507, { error: 'The store is full.' });
          writeJSON(path.join(dir('accepted'), id + '.json'), { app: r.app, accepted: Date.now(), note }); t.status = 'accepted';
        } else if (body.decision === 'reject') t.status = 'rejected'; else return json(res, 400, { error: 'Choose accept or reject.' });
        t.note = note; t.at = Date.now(); writeJSON(tf, t); fs.unlinkSync(pf);
        return json(res, 200, { ok: true, status: t.status });
      }
      if (route === 'admin/remove' && req.method === 'POST') {
        const body = await readBody(req, 2048); const id = String(body.id || ''); if (!fmt.ID.test(id)) return json(res, 400, { error: 'Bad id.' });
        try { fs.unlinkSync(path.join(dir('accepted'), id + '.json')); } catch (e) { return json(res, 404, { error: 'Not found.' }); }
        return json(res, 200, { ok: true });
      }
    }
    return json(res, 404, { error: 'Not found.' });
  } catch (e) { return json(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.code ? e.message : 'Server error.' }); }
}

/* the review page: /apprequests (plain text only, everything an app sends is shown as text, never run) */
const PAGE = fs.readFileSync(path.join(__dirname, 'apprequests.html'), 'utf8');
function page(req, res) {
  const nonce = crypto.randomBytes(12).toString('base64');
  const html = PAGE.replace(/__NONCE__/g, nonce);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex',
    'Content-Security-Policy': "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'nonce-" + nonce + "'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
  res.end(html);
}
module.exports = { handle, page };
