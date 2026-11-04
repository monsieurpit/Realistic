/* Community apps: the file format check, sending an app in, the password-protected review page, and what
   people can and can't see before an app is accepted. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('../helpers');
const F = require('../../js/patapp-format.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-apps-'));
process.env.PATOS_DATA = dir; process.env.APPS_ADMIN_PASSWORD = 'unit-test-password';
const mk = (o) => Object.assign({ format: 'patapp', formatVersion: 1, id: 'com.test.timer', name: 'Timer', version: '1.0.0', author: 'Tester', description: 'Counts.', icon: '⏱', color: '#ff9f0a', permissions: ['notifications'], html: '<h1>hi</h1>' }, o || {});
const api = async (base, method, route, body, token) => { const r = await fetch(base + '/api/apps/' + route, { method, headers: Object.assign(body ? { 'Content-Type': 'application/json' } : {}, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };

test('the format: good files pass, bad ones say why', () => {
  assert.equal(F.validate(mk()).ok, true);
  assert.equal(F.validate(mk({ icon: '' })).app.icon, 'T'); // falls back to the first letter
  [[{ id: 'Bad Id' }, /app id/], [{ id: 'ab' }, /app id/], [{ version: '1.0' }, /version/], [{ name: '' }, /name/], [{ html: '' }, /no HTML/], [{ permissions: ['root'] }, /does not offer/], [{ permissions: ['files', 'files'] }, /does not offer/], [{ format: 'zip' }, /not a PatOS/], [{ formatVersion: 2 }, /different version/], [{ html: 'x'.repeat(1000001) }, /too big/]]
    .forEach(([o, re]) => { const r = F.validate(mk(o)); assert.equal(r.ok, false, JSON.stringify(Object.keys(o))); assert.match(r.error, re); });
  assert.equal(F.validate(mk()).app.engine, 'web'); assert.equal(F.validate(mk({ engine: 'pitcode' })).app.engine, 'pitcode');
  assert.match(F.validate(mk({ engine: 'flash' })).error, /engine/);
  assert.equal(F.validate(null).ok, false);
  const a = F.validate(mk({ extra: 'ignored', width: 99999 })).app; assert.equal(a.extra, undefined); assert.equal(a.width, 1600);
  assert.equal(F.cmp('1.2.0', '1.10.0'), -1); assert.equal(F.cmp('2.0.0', '1.9.9'), 1); assert.equal(F.cmp('1.0.0', '1.0.0'), 0);
});

test('sending, reviewing and publishing: nothing is public until the owner accepts', async () => {
  const srv = await startServer();
  try {
    const b = srv.base;
    let r = await api(b, 'POST', 'submit', { app: mk() }); assert.equal(r.status, 200); const ticket = r.body.ticket; assert.ok(ticket);
    assert.equal((await api(b, 'POST', 'submit', { app: mk({ id: 'x' }) })).status, 400);
    assert.deepEqual((await api(b, 'GET', 'store')).body.apps, []); // still waiting
    assert.equal((await api(b, 'GET', 'get?id=com.test.timer')).status, 404);
    assert.equal((await api(b, 'GET', 'status?ticket=' + ticket)).body.status, 'pending');
    // the review side needs the password
    assert.equal((await api(b, 'GET', 'admin/list')).status, 401);
    assert.equal((await api(b, 'GET', 'admin/list', null, 'x.y')).status, 401);
    assert.equal((await api(b, 'GET', 'admin/list', null, (Date.now() + 99999999) + '.forged')).status, 401);
    assert.equal((await api(b, 'POST', 'admin/login', { password: 'nope' })).status, 403);
    r = await api(b, 'POST', 'admin/login', { password: 'unit-test-password' }); assert.equal(r.status, 200); const tok = r.body.token;
    r = await api(b, 'GET', 'admin/list', null, tok); assert.equal(r.body.pending.length, 1); assert.equal(r.body.pending[0].name, 'Timer'); assert.equal(r.body.pending[0].html, undefined);
    assert.equal((await api(b, 'GET', 'admin/app?id=com.test.timer', null, tok)).body.app.html, '<h1>hi</h1>');
    assert.equal((await api(b, 'POST', 'admin/decide', { id: 'com.test.timer', decision: 'maybe' }, tok)).status, 400);
    assert.equal((await api(b, 'POST', 'admin/decide', { id: 'com.test.timer', decision: 'accept', note: 'Nice' }, tok)).body.status, 'accepted');
    r = await api(b, 'GET', 'store'); assert.equal(r.body.apps.length, 1); assert.equal(r.body.apps[0].html, undefined); assert.equal(r.body.apps[0].name, 'Timer');
    assert.equal((await api(b, 'GET', 'get?id=com.test.timer')).body.app.html, '<h1>hi</h1>');
    r = await api(b, 'GET', 'status?ticket=' + ticket); assert.equal(r.body.status, 'accepted'); assert.equal(r.body.note, 'Nice');
    // a new version is reviewed again, and the old one stays up meanwhile
    const t2 = (await api(b, 'POST', 'submit', { app: mk({ version: '1.1.0', html: '<h1>v2</h1>' }) })).body.ticket;
    assert.equal((await api(b, 'GET', 'get?id=com.test.timer')).body.app.version, '1.0.0');
    assert.equal((await api(b, 'POST', 'admin/decide', { id: 'com.test.timer', decision: 'reject', note: 'Too many notifications' }, tok)).body.status, 'rejected');
    assert.equal((await api(b, 'GET', 'get?id=com.test.timer')).body.app.version, '1.0.0');
    r = await api(b, 'GET', 'status?ticket=' + t2); assert.equal(r.body.status, 'rejected'); assert.equal(r.body.note, 'Too many notifications');
    assert.equal((await api(b, 'POST', 'admin/remove', { id: 'com.test.timer' }, tok)).status, 200);
    assert.deepEqual((await api(b, 'GET', 'store')).body.apps, []);
    assert.equal((await api(b, 'GET', 'status?ticket=../etc')).status, 400);
    assert.equal((await api(b, 'GET', 'get?id=../x')).status, 400);
  } finally { srv.stop(); }
});

test('the review password is not in the code, and wrong guesses are slowed down', async () => {
  const srv = await startServer();
  try {
    for (const f of ['apps-server.js', 'apprequests.html', 'server.js']) assert.ok(!fs.readFileSync(path.join(__dirname, '../..', f), 'utf8').includes('CampNou'), f + ' must not contain the password');
    let last; for (let i = 0; i < 6; i++) last = await api(srv.base, 'POST', 'admin/login', { password: 'guess' + i });
    assert.equal(last.status, 429);
    assert.equal((await api(srv.base, 'POST', 'admin/login', { password: 'unit-test-password' })).status, 429, 'even the right one waits after too many wrong ones');
  } finally { srv.stop(); }
});

test('/apprequests: a page that runs nothing from apps, and the files behind it are not served', async () => {
  const srv = await startServer();
  try {
    const r = await fetch(srv.base + '/apprequests'); const html = await r.text();
    assert.equal(r.status, 200); assert.match(html, /PatOS app requests/); assert.ok(!html.includes('unit-test-password'));
    const csp = r.headers.get('content-security-policy'); const nonce = (csp.match(/nonce-([^']+)'/) || [])[1];
    assert.ok(nonce && html.includes('nonce="' + nonce + '"')); assert.match(csp, /default-src 'none'/); assert.match(csp, /frame-ancestors 'none'/); assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    for (const f of ['/apprequests.html', '/apps-server.js']) assert.equal((await fetch(srv.base + f)).status, 404, f);
    assert.equal((await fetch(srv.base + '/docs/APP-SDK.md')).status, 200);
    assert.equal((await fetch(srv.base + '/js/patapp-format.js')).status, 200);
  } finally { srv.stop(); }
});
test('the review page script is valid JavaScript and only builds the page with text', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../apprequests.html'), 'utf8'); const m = html.match(/<script nonce="__NONCE__">([\s\S]*)<\/script>/);
  assert.ok(m); new (require('vm').Script)(m[1]);
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write\(|[^\w]eval\(/.test(m[1]), 'nothing an app sends may be turned into markup');
});
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
