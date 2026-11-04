/* The Sync server: it only ever holds encrypted records, keeps accounts apart, and tells a device when it
   has forgotten the account (a new or wiped server) so the device can recreate it. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('../helpers');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patos-sync-'));
process.env.PATOS_DATA = dir;
const uid = (c) => (c.repeat(22));
const call = (base, u, tok, method, route, body) => fetch(base + '/api/sync/' + route, { method, headers: Object.assign({ 'X-Patos-Uid': u, Authorization: 'Bearer ' + tok }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, body: await r.json() }));
const rid = (n) => 'record' + String(n).padStart(12, '0');
const T0 = Date.now() - 60000; // real times: the server forgets deletions older than 90 days
const rec = (n, t, data) => ({ rid: rid(n), t, iv: 'AAAAAAAAAAAAAAAA', data: data || Buffer.from('secret ' + n).toString('base64') });

test('accounts: made once, the same key opens it, another key does not, bad input is refused', async () => {
  const srv = await startServer();
  try {
    const A = uid('a'), B = uid('b');
    let r = await call(srv.base, A, 'tokenA', 'POST', 'register'); assert.equal(r.status, 200); assert.equal(r.body.created, true); const epoch = r.body.epoch; assert.ok(epoch);
    r = await call(srv.base, A, 'tokenA', 'POST', 'register'); assert.equal(r.body.created, false); assert.equal(r.body.epoch, epoch);
    r = await call(srv.base, A, 'someone else', 'POST', 'register'); assert.equal(r.status, 403);
    r = await call(srv.base, A, 'someone else', 'GET', 'status'); assert.equal(r.status, 403);
    r = await call(srv.base, B, 'tokenB', 'GET', 'status'); assert.equal(r.status, 401); assert.equal(r.body.error, 'unknown account');
    r = await call(srv.base, 'short', 'tokenA', 'POST', 'register'); assert.equal(r.status, 400);
    const noAuth = await fetch(srv.base + '/api/sync/status'); assert.equal(noAuth.status, 400);
    // the server code and the data folder are never served as files
    for (const p of ['/sync-server.js', '/data/sync/' + A + '/account.json', '/updates.json']) assert.equal((await fetch(srv.base + p)).status, 404, p);
  } finally { srv.stop(); }
});

test('records: push, pull, newest wins, deletions, and two accounts never see each other', async () => {
  const srv = await startServer();
  try {
    const A = uid('c'), B = uid('d'); await call(srv.base, A, 'tA', 'POST', 'register'); await call(srv.base, B, 'tB', 'POST', 'register');
    let r = await call(srv.base, A, 'tA', 'POST', 'push', { records: [rec(1, T0 + 100), rec(2, T0 + 100), rec(3, T0 + 100)] }); assert.deepEqual([r.body.applied, r.body.skipped, r.body.rejected], [3, 0, 0]);
    r = await call(srv.base, A, 'tA', 'GET', 'pull?since=0'); assert.equal(r.body.records.length, 3); assert.deepEqual(r.body.records.map((x) => x.rev), [1, 2, 3]); assert.equal(r.body.records[0].data, Buffer.from('secret 1').toString('base64'));
    r = await call(srv.base, A, 'tA', 'GET', 'pull?since=2'); assert.equal(r.body.records.length, 1);
    // an older change never overwrites a newer one; a newer one does
    r = await call(srv.base, A, 'tA', 'POST', 'push', { records: [rec(1, T0 + 50, Buffer.from('OLD').toString('base64'))] }); assert.equal(r.body.skipped, 1);
    r = await call(srv.base, A, 'tA', 'POST', 'push', { records: [rec(1, T0 + 200, Buffer.from('NEW').toString('base64')), { rid: rid(2), t: T0 + 200, deleted: true }] }); assert.equal(r.body.applied, 2);
    r = await call(srv.base, A, 'tA', 'GET', 'pull?since=3'); const by = Object.fromEntries(r.body.records.map((x) => [x.rid, x]));
    assert.equal(Buffer.from(by[rid(1)].data, 'base64').toString(), 'NEW'); assert.equal(by[rid(2)].deleted, true);
    r = await call(srv.base, A, 'tA', 'GET', 'status'); assert.equal(r.body.records, 2);
    // the other account has nothing
    r = await call(srv.base, B, 'tB', 'GET', 'pull?since=0'); assert.equal(r.body.records.length, 0);
    // bad records are refused, not stored
    r = await call(srv.base, A, 'tA', 'POST', 'push', { records: [{ rid: 'x', t: 1, data: 'AA', iv: 'AA' }, { rid: rid(9), t: 'no', data: 'AA', iv: 'AA' }, { rid: rid(8), t: 1, data: '<script>', iv: 'AA' }, { rid: rid(7), t: 1 }] }); assert.equal(r.body.rejected, 4);
    // deleting the account removes everything
    r = await call(srv.base, A, 'tA', 'DELETE', 'account'); assert.equal(r.status, 200); r = await call(srv.base, A, 'tA', 'GET', 'status'); assert.equal(r.status, 401);
  } finally { srv.stop(); }
});

test('paging: many records come back in pieces that add up', async () => {
  const srv = await startServer();
  try {
    const A = uid('e'); await call(srv.base, A, 't', 'POST', 'register');
    for (let i = 0; i < 3; i++) await call(srv.base, A, 't', 'POST', 'push', { records: Array.from({ length: 150 }, (_, k) => rec(i * 150 + k, 10 + k)) });
    let since = 0, got = 0, pages = 0, more = true; while (more && pages < 10) { const r = await call(srv.base, A, 't', 'GET', 'pull?since=' + since); got += r.body.records.length; since = r.body.rev; more = r.body.more; pages++; }
    assert.equal(got, 450); assert.ok(pages >= 3);
  } finally { srv.stop(); }
});

test('quota: an account can not grow past its limit', async () => {
  process.env.SYNC_QUOTA_MB = '1'; const srv = await startServer();
  try {
    const A = uid('f'); await call(srv.base, A, 't', 'POST', 'register'); const big = Buffer.alloc(600 * 1024, 1).toString('base64');
    let r = await call(srv.base, A, 't', 'POST', 'push', { records: [rec(1, 1, big)] }); assert.equal(r.body.applied, 1);
    r = await call(srv.base, A, 't', 'POST', 'push', { records: [rec(2, 1, big)] }); assert.equal(r.body.rejected, 1); assert.equal(r.body.applied, 0);
  } finally { srv.stop(); delete process.env.SYNC_QUOTA_MB; }
});

test('a restarted server keeps accounts; a wiped one forgets them (so devices recreate them)', async () => {
  let srv = await startServer(); const A = uid('g');
  try { await call(srv.base, A, 't', 'POST', 'register'); await call(srv.base, A, 't', 'POST', 'push', { records: [rec(1, 5)] }); } finally { srv.stop(); }
  srv = await startServer();
  try { const r = await call(srv.base, A, 't', 'GET', 'pull?since=0'); assert.equal(r.status, 200); assert.equal(r.body.records.length, 1); } finally { srv.stop(); }
  fs.rmSync(path.join(dir, 'sync'), { recursive: true, force: true });
  srv = await startServer();
  try { const r = await call(srv.base, A, 't', 'GET', 'status'); assert.equal(r.status, 401); const again = await call(srv.base, A, 't', 'POST', 'register'); assert.equal(again.body.created, true); } finally { srv.stop(); }
});
test.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });
