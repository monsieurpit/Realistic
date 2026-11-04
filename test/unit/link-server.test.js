/* The PatLink server: a mailbox that only ever holds encrypted items, keeps rooms apart, ignores repeats,
   forgets old things and the oldest things when full. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('../helpers');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-link-'));
process.env.PATOS_DATA = dir;
const uid = (c) => c.repeat(22);
const call = (base, u, tok, method, route, body) => fetch(base + '/api/link/' + route, { method, headers: Object.assign({ 'X-Patos-Uid': u, Authorization: 'Bearer ' + tok }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => null) }));
const item = (n, t, data) => ({ id: 'item' + String(n).padStart(12, '0'), t, iv: 'AAAAAAAAAAAAAAAA', data: data || Buffer.from('secret ' + n).toString('base64') });

test('rooms: made once, the same key opens it, another key does not, bad input is refused', async () => {
  const srv = await startServer();
  try {
    const A = uid('a');
    let r = await call(srv.base, A, 'tok', 'POST', 'register'); assert.equal(r.status, 200); assert.equal(r.body.created, true);
    r = await call(srv.base, A, 'tok', 'POST', 'register'); assert.equal(r.body.created, false);
    assert.equal((await call(srv.base, A, 'other', 'POST', 'register')).status, 403);
    assert.equal((await call(srv.base, A, 'other', 'GET', 'poll')).status, 403);
    assert.equal((await call(srv.base, uid('b'), 'tok', 'GET', 'poll')).status, 401);
    assert.equal((await call(srv.base, 'short', 'tok', 'GET', 'poll')).status, 400);
    assert.equal((await call(srv.base, A, 'x'.repeat(201), 'GET', 'poll')).status, 400);
    r = await fetch(srv.base + '/api/link/poll', { method: 'OPTIONS' }); assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), '*'); assert.match(r.headers.get('access-control-allow-headers'), /X-Patos-Uid/);
  } finally { srv.stop(); }
});

test('sending and reading: order, repeats, paging, refusals, and rooms never see each other', async () => {
  const srv = await startServer();
  try {
    const A = uid('a'), B = uid('b'), now = Date.now();
    await call(srv.base, A, 'tok', 'POST', 'register'); await call(srv.base, B, 'tokB', 'POST', 'register');
    let r = await call(srv.base, A, 'tok', 'POST', 'send', { items: [item(1, now), item(2, now + 1), item(1, now)] }); assert.deepEqual([r.body.applied, r.body.duplicate, r.body.rejected], [2, 1, 0]);
    r = await call(srv.base, A, 'tok', 'POST', 'send', { items: [{ id: 'x', t: now, iv: 'AA', data: 'AA' }, { id: 'item000000000009', t: now, iv: 'AA', data: 'not base64!' }, { id: 'item00000000000a', t: 'no', iv: 'AA', data: 'AA' }, { id: 'item00000000000b', t: now, iv: 'AA', data: '' }, null] }); assert.equal(r.body.rejected, 5); assert.equal(r.body.applied, 0);
    r = await call(srv.base, A, 'tok', 'GET', 'poll?since=0'); assert.deepEqual(r.body.items.map((x) => x.id), [item(1).id, item(2).id]); assert.equal(r.body.rev, 2); assert.equal(r.body.more, false);
    r = await call(srv.base, A, 'tok', 'GET', 'poll?since=1'); assert.equal(r.body.items.length, 1); r = await call(srv.base, A, 'tok', 'GET', 'poll?since=2'); assert.equal(r.body.items.length, 0); assert.equal(r.body.rev, 2);
    assert.equal((await call(srv.base, B, 'tokB', 'GET', 'poll?since=0')).body.items.length, 0, 'another room sees nothing');
    // paging
    const many = []; for (let i = 10; i < 50; i++) many.push(item(i, now + i)); await call(srv.base, A, 'tok', 'POST', 'send', { items: many });
    await call(srv.base, A, 'tok', 'POST', 'send', { items: Array.from({ length: 40 }, (_, i) => item(100 + i, now + 100 + i)) });
    let got = [], since = 0, rounds = 0; for (;;) { r = await call(srv.base, A, 'tok', 'GET', 'poll?since=' + since); got = got.concat(r.body.items.map((x) => x.id)); since = r.body.rev; rounds++; if (!r.body.more) break; }
    assert.equal(got.length, 82); assert.equal(new Set(got).size, 82); assert.ok(rounds >= 2, 'it came in pieces');
    // nothing readable is stored
    const all = (function walk(d) { let s = ''; fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); s += e.isDirectory() ? walk(p) : fs.readFileSync(p, 'utf8'); }); return s; })(path.join(dir, 'link'));
    assert.ok(!all.includes('"tokB"') && !/"token":/.test(all) && !all.includes('secret 1') && !all.includes('"secret'), 'no token, no plain text'); assert.match(all, /tokenHash/);
  } finally { srv.stop(); }
});

test('forgetting: old items go after 30 days, and the oldest go first when a room is full', async () => {
  process.env.LINK_QUOTA_MB = '1'; const srv = await startServer(); delete process.env.LINK_QUOTA_MB;
  try {
    const A = uid('c'), now = Date.now(); await call(srv.base, A, 'tok', 'POST', 'register');
    await call(srv.base, A, 'tok', 'POST', 'send', { items: [item(1, now - 40 * 86400000), item(2, now - 1000)] });
    let r = await call(srv.base, A, 'tok', 'POST', 'send', { items: [item(3, now)] });
    r = await call(srv.base, A, 'tok', 'GET', 'poll?since=0'); assert.deepEqual(r.body.items.map((x) => x.id), [item(2).id, item(3).id], 'the 40 day old item is gone');
    const big = Buffer.alloc(400 * 1024, 1).toString('base64');
    for (let i = 0; i < 5; i++) await call(srv.base, A, 'tok', 'POST', 'send', { items: [item(20 + i, now + 10 + i, big)] });
    r = await call(srv.base, A, 'tok', 'GET', 'poll?since=0'); const ids = r.body.items.map((x) => x.id);
    assert.ok(ids.length < 7 && ids.includes(item(24).id), 'the newest is kept: ' + ids.length); assert.ok(!ids.includes(item(2).id), 'the oldest went to make room');
    assert.equal((await call(srv.base, A, 'tok', 'DELETE', 'room')).status, 200); assert.equal((await call(srv.base, A, 'tok', 'GET', 'poll')).status, 401);
  } finally { srv.stop(); }
});
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
