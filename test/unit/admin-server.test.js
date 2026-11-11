/* admin-server.js: only the PatOS account (the system account), signed in moments ago, can release a version. The sign-in token
   is checked like Firebase's Admin SDK does: Google's signature, this project, not expired. Here the "Google" key is made up
   for the test. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const http = require('http');
const admin = require('../../admin-server.js');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'k1';
admin._setKeys({ [KID]: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
function token(over, opts) {
  opts = opts || {};
  const claims = Object.assign({ iss: 'https://securetoken.google.com/patos-92a43', aud: 'patos-92a43', sub: 'GOD', email: 'patos@patos.invalid', iat: now() - 10, exp: now() + 3000, auth_time: now() - 10 }, over || {});
  const head = b64(Object.assign({ alg: 'RS256', kid: KID, typ: 'JWT' }, opts.head || {})), body = b64(claims);
  const sig = crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), opts.key || privateKey).toString('base64url');
  return head + '.' + body + '.' + sig;
}
const rejects = (t, why) => assert.rejects(admin.verifyIdToken(t), (e) => e.status === 401, why);

test('a good token is read; forged, expired, other-project and unsigned ones are refused', async () => {
  assert.equal((await admin.verifyIdToken(token())).sub, 'GOD');
  await rejects(token({}, { key: other.privateKey }), 'signed with another key');
  await rejects(token({ exp: now() - 1 }), 'expired');
  await rejects(token({ aud: 'someone-else' }), 'another project');
  await rejects(token({ iss: 'https://evil.example' }), 'another issuer');
  await rejects(token({}, { head: { alg: 'none' } }), 'alg none');
  await rejects(token({}, { head: { kid: 'nope' } }), 'unknown key');
  await rejects(token().replace(/\.[^.]+$/, '.'), 'no signature');
  const t = token().split('.'); const forged = t[0] + '.' + b64({ sub: 'GOD', aud: 'patos-92a43', iss: 'https://securetoken.google.com/patos-92a43', exp: now() + 99, iat: now(), auth_time: now(), admin: true }) + '.' + t[2];
  await rejects(forged, 'changed claims with the old signature');
  await rejects('garbage', 'not a token');
});

test('the release: only the PatOS account, only with a fresh sign-in, only the beta that was shown', async () => {
  process.env.PATOS_SYSTEM_UID = 'GOD'; delete process.env.GITHUB_TOKEN;
  const srv = http.createServer((req, res) => admin.handle(req, res, new URL(req.url, 'http://x'))); await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const post = async (tok, body) => { const r = await fetch(base + '/api/admin/release', { method: 'POST', headers: tok ? { Authorization: 'Bearer ' + tok } : {}, body: JSON.stringify(body || { version: '3.1.0', beta: 14 }) }); return [r.status, (await r.json()).error || '']; };
  try {
    assert.deepEqual(await (await fetch(base + '/api/admin/status')).json(), { release: false });
    assert.equal((await post(null))[0], 401, 'no sign-in');
    assert.equal((await post(token({}, { key: other.privateKey })))[0], 401, 'a forged sign-in');
    assert.deepEqual(await post(token({ sub: 'SOMEONE' })), [403, 'Only the PatOS account can release a version.']);
    assert.deepEqual(await post(token({ auth_time: now() - 900 })), [401, 'Enter your password again.'], 'a sign-in from long ago');
    assert.equal((await post(token(), { version: '../x', beta: 1 }))[0], 400);
    assert.match((await post(token()))[1], /GITHUB_TOKEN/, 'the PatOS account, but the server is not set up');
    assert.equal((await fetch(base + '/api/admin/release')).status, 405);
  } finally { srv.close(); delete process.env.PATOS_SYSTEM_UID; }
});

test('releasing turns the beta into the finished version, and only the beta that was shown', () => {
  const all = [{ version: '3.1.0', beta: 14, date: '2026-11-11', notes: {} }, { version: '3.0.0', date: '2026-11-10' }];
  const out = admin.finish(all, { version: '3.1.0', beta: 14 }, '2026-11-12');
  assert.deepEqual(out[0], { version: '3.1.0', date: '2026-11-12', notes: {} }); assert.equal(all[0].beta, 14, 'the original is untouched');
  assert.throws(() => admin.finish(all, { version: '3.1.0', beta: 13 }, 'x'), /changed since you looked/);
  assert.throws(() => admin.finish(out, { version: '3.1.0', beta: 14 }, 'x'), /no beta/);
  const v = require('../../update-manager.js').versionJS(out); assert.match(v, /PatOS\.version = "3\.1\.0"/); assert.match(v, /"channel":"stable"/);
});

test('the release commit on GitHub: updates.json and js/version.js, on each branch, never forced', async () => {
  process.env.PATOS_SYSTEM_UID = 'GOD'; process.env.GITHUB_TOKEN = 'test-token'; process.env.GITHUB_BRANCHES = 'main,dev';
  const calls = []; const real = globalThis.fetch;
  const updates = Buffer.from(JSON.stringify([{ version: '3.1.0', beta: 14, date: '2026-11-11' }, { version: '3.0.0', date: '2026-11-10' }])).toString('base64');
  globalThis.fetch = async (url, o) => {
    if (!String(url).startsWith('https://api.github.com')) return real(url, o);
    const m = (o && o.method) || 'GET', p = String(url).slice(22), body = o && o.body ? JSON.parse(o.body) : null; calls.push([m, p, body, o.headers.Authorization]);
    const j = /\/git\/ref\/heads\//.test(p) ? { object: { sha: 'head-' + p.split('/').pop() } } : /\/git\/commits\/head/.test(p) ? { tree: { sha: 'tree0' } } : /contents\/updates\.json/.test(p) ? { content: updates } : /\/git\/trees$/.test(p) ? { sha: 'tree1' } : /\/git\/commits$/.test(p) ? { sha: 'commit1' } : {};
    return new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const srv = http.createServer((req, res) => admin.handle(req, res, new URL(req.url, 'http://x'))); await new Promise((r) => srv.listen(0, r));
  try {
    const r = await real('http://127.0.0.1:' + srv.address().port + '/api/admin/release', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: JSON.stringify({ version: '3.1.0', beta: 14 }) });
    assert.deepEqual(await r.json(), { ok: true, version: '3.1.0', branches: ['main', 'dev'] });
    const trees = calls.filter((c) => /\/git\/trees$/.test(c[1])); assert.equal(trees.length, 2);
    const files = Object.fromEntries(trees[0][2].tree.map((f) => [f.path, f.content]));
    assert.equal(JSON.parse(files['updates.json'])[0].beta, undefined); assert.match(files['js/version.js'], /"channel":"stable","version":"3\.1\.0"/);
    const pushes = calls.filter((c) => c[0] === 'PATCH'); assert.deepEqual(pushes.map((c) => [c[1].split('/').pop(), c[2].force]), [['main', false], ['dev', false]]);
    assert.ok(calls.every((c) => c[3] === 'Bearer test-token'));
  } finally { globalThis.fetch = real; srv.close(); delete process.env.PATOS_SYSTEM_UID; delete process.env.GITHUB_TOKEN; delete process.env.GITHUB_BRANCHES; }
});
