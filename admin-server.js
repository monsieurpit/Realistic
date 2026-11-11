/* The PatOS account's powers on PatOS's own server (the system account, see docs/SYSTEM-ACCOUNT.md).
   Today: releasing the beta being built as a finished version, from Settings › Software Update, without a developer.

   Who may: only the system account. The server checks that itself, it never trusts the page:
   - the request carries a Firebase sign-in token; its signature is checked against Google's public keys, and it must be for this
     Firebase project, not expired, and from a sign-in made in the last 5 minutes (PatOS asks the password again just before)
   - the account in it must be the system account: the uid in config/system (which only the Firebase console can write),
     or PATOS_SYSTEM_UID when that is set on the server
   How: the release is a commit to the repository on GitHub (updates.json without the beta number, and js/version.js), made
   with GITHUB_TOKEN (a token that can only write this repository's contents). Railway then deploys it, like any other change.
   Settings (Railway › Variables): GITHUB_TOKEN (needed), GITHUB_REPO (owner/name, default monsieurpit/Realistic),
   GITHUB_BRANCHES (comma-separated, default the repository's default branch), FIREBASE_PROJECT_ID (default patos-92a43). */
'use strict';
const crypto = require('crypto');
const { versionJS } = require('./update-manager.js');

const PROJECT = () => (process.env.FIREBASE_PROJECT_ID || 'patos-92a43').trim();
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FRESH_SEC = 300;
let certs = { at: 0, ttl: 0, keys: {} };

const b64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const fail = (code, msg) => Object.assign(new Error(msg), { status: code });

async function googleKeys(fetchImpl) {
  if (Date.now() - certs.at < certs.ttl) return certs.keys;
  const r = await (fetchImpl || fetch)(CERTS_URL); if (!r.ok) throw fail(502, 'Google’s sign-in keys could not be read.');
  const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  certs = { at: Date.now(), ttl: Math.min(+(m && m[1]) || 3600, 21600) * 1000, keys: await r.json() };
  return certs.keys;
}

/* a Firebase ID token -> its claims, or an error. (The same checks as Firebase's own Admin SDK.) */
async function verifyIdToken(token, opts) {
  opts = opts || {};
  const parts = String(token || '').split('.'); if (parts.length !== 3) throw fail(401, 'Sign in again.');
  let head, claims; try { head = JSON.parse(b64url(parts[0])); claims = JSON.parse(b64url(parts[1])); } catch (e) { throw fail(401, 'Sign in again.'); }
  if (head.alg !== 'RS256' || !head.kid) throw fail(401, 'Sign in again.');
  const keys = opts.keys || await googleKeys(opts.fetch); const pem = keys[head.kid]; if (!pem) throw fail(401, 'Sign in again.');
  const good = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey(pem), b64url(parts[2]));
  if (!good) throw fail(401, 'Sign in again.');
  const now = Math.floor((opts.now || Date.now()) / 1000), project = opts.project || PROJECT();
  if (claims.aud !== project || claims.iss !== 'https://securetoken.google.com/' + project) throw fail(401, 'This sign-in is for another project.');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) throw fail(401, 'Sign in again.');
  if (!(claims.exp > now) || !(claims.iat <= now + 60) || !(claims.auth_time <= now + 60)) throw fail(401, 'Sign in again.');
  return claims;
}

/* the system account's uid: PATOS_SYSTEM_UID, or config/system in the database (read with the person's own token) */
async function systemUid(token, fetchImpl) {
  const env = (process.env.PATOS_SYSTEM_UID || '').trim(); if (env) return env;
  const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(PROJECT()) + '/databases/(default)/documents/config/system';
  const r = await (fetchImpl || fetch)(url, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return '';
  if (!r.ok) throw fail(502, 'The database could not be read.');
  const d = await r.json(); return (d.fields && d.fields.uid && d.fields.uid.stringValue) || '';
}

/* ---------- GitHub: one commit per branch ---------- */
async function gh(method, p, body) {
  const r = await fetch('https://api.github.com' + p, { method, headers: { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN.trim(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'PatOS-server', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(r.status === 401 || r.status === 403 ? 502 : r.status === 409 || r.status === 422 ? 409 : 502, 'GitHub said: ' + (j.message || r.status));
  return j;
}
/* updates.json with the beta made finished (today's date), or an error when the beta is not the one the person saw */
function finish(all, want, today) {
  const i = all.findIndex((r) => r.beta); if (i < 0) throw fail(409, 'There is no beta to release.');
  const b = all[i]; if (b.version !== want.version || b.beta !== want.beta) throw fail(409, 'The beta changed since you looked (it is now ' + b.version + ' beta ' + b.beta + '). Look again.');
  const done = Object.assign({}, b); delete done.beta; done.date = today;
  const out = all.slice(); out[i] = done; return out;
}
async function release(want, who) {
  const repo = (process.env.GITHUB_REPO || 'monsieurpit/Realistic').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw fail(500, 'GITHUB_REPO looks like owner/name.');
  let branches = (process.env.GITHUB_BRANCHES || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!branches.length) branches = [(await gh('GET', '/repos/' + repo)).default_branch];
  const today = new Date().toISOString().slice(0, 10); const done = [];
  for (const br of branches) {
    const ref = await gh('GET', '/repos/' + repo + '/git/ref/heads/' + encodeURIComponent(br));
    const commit = await gh('GET', '/repos/' + repo + '/git/commits/' + ref.object.sha);
    const file = await gh('GET', '/repos/' + repo + '/contents/updates.json?ref=' + ref.object.sha);
    const all = finish(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), want, today);
    const tree = await gh('POST', '/repos/' + repo + '/git/trees', { base_tree: commit.tree.sha, tree: [
      { path: 'updates.json', mode: '100644', type: 'blob', content: JSON.stringify(all, null, 2) + '\n' },
      { path: 'js/version.js', mode: '100644', type: 'blob', content: versionJS(all) }] });
    const c = await gh('POST', '/repos/' + repo + '/git/commits', { message: 'PatOS ' + want.version + ' released as a finished version (from the PatOS account)\n\nBeta ' + want.beta + ' becomes ' + want.version + '. Released by ' + who + ' in Settings › Software Update.', tree: tree.sha, parents: [ref.object.sha] });
    await gh('PATCH', '/repos/' + repo + '/git/refs/heads/' + encodeURIComponent(br), { sha: c.sha, force: false });
    done.push(br);
  }
  return done;
}

/* ---------- requests ---------- */
const tries = new Map(); // address -> [times]
function limited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); const now = Date.now();
  const l = (tries.get(ip) || []).filter((t) => now - t < 600000); l.push(now); tries.set(ip, l); if (tries.size > 5000) tries.clear();
  return l.length > 10;
}
const body = (req) => new Promise((ok, bad) => { let s = ''; req.on('data', (d) => { s += d; if (s.length > 4096) { bad(fail(413, 'Too big.')); req.destroy(); } }); req.on('end', () => ok(s)); req.on('error', bad); });

async function handle(req, res, url) {
  try {
    if (url.pathname === '/api/admin/status' && req.method === 'GET') return send(res, 200, { release: !!(process.env.GITHUB_TOKEN || '').trim() });
    if (url.pathname !== '/api/admin/release') return send(res, 404, { error: 'Not found' });
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    if (limited(req)) return send(res, 429, { error: 'Too many tries. Wait a few minutes.' });
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || ''); if (!token) return send(res, 401, { error: 'Sign in first.' });
    let want; try { want = JSON.parse(await body(req)); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    if (!want || typeof want.version !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(want.version) || !Number.isInteger(want.beta) || want.beta < 1) return send(res, 400, { error: 'Bad request' });
    const claims = await verifyIdToken(token[1]);
    const sys = await systemUid(token[1]);
    if (!sys || claims.sub !== sys) return send(res, 403, { error: 'Only the PatOS account can release a version.' });
    if (Math.floor(Date.now() / 1000) - claims.auth_time > FRESH_SEC) return send(res, 401, { error: 'Enter your password again.' });
    if (!(process.env.GITHUB_TOKEN || '').trim()) return send(res, 503, { error: 'Releasing from PatOS isn’t set up on the server yet (GITHUB_TOKEN). See docs/SYSTEM-ACCOUNT.md.' });
    const branches = await release(want, String(claims.email || '').replace(/@patos\.invalid$/, '') || claims.sub);
    console.log('PatOS ' + want.version + ' released from the PatOS account on ' + branches.join(', '));
    return send(res, 200, { ok: true, version: want.version, branches });
  } catch (e) { return send(res, e.status || 500, { error: e.status ? e.message : 'Server error' }); }
}

module.exports = { handle, verifyIdToken, systemUid, finish, _setKeys: (keys) => { certs = { at: Date.now(), ttl: 3600e3, keys }; } };
