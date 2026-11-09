/* The PatOS server: files, compression, caching, private files, and its small APIs. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { startServer } = require('../helpers');

let srv;
test.before(async () => { srv = await startServer(); });
test.after(() => srv && srv.stop());

// raw request so we control the path (fetch would clean up "../")
function raw(pathname, headers) {
  return new Promise((res, rej) => {
    const r = http.request({ host: 'localhost', port: srv.port, path: pathname, headers: headers || {} }, (resp) => { let n = 0; resp.on('data', (d) => (n += d.length)); resp.on('end', () => res({ status: resp.statusCode, headers: resp.headers, size: n })); });
    r.on('error', rej); r.end();
  });
}

test('serves the home page and the app files', async () => {
  for (const p of ['/', '/index.html', '/js/core.js', '/css/patos.css', '/manifest.webmanifest', '/assets/icon-192.png', '/sw.js']) {
    const r = await raw(p); assert.equal(r.status, 200, p); assert.ok(r.size > 0, p);
  }
});
test('compresses text and answers 304 when nothing changed', async () => {
  const br = await raw('/js/core.js', { 'Accept-Encoding': 'br, gzip' });
  assert.equal(br.headers['content-encoding'], 'br');
  const gz = await raw('/js/core.js', { 'Accept-Encoding': 'gzip' });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  const etag = br.headers.etag; assert.ok(etag, 'has an ETag');
  const again = await raw('/js/core.js', { 'If-None-Match': etag, 'Accept-Encoding': 'br' });
  assert.equal(again.status, 304);
});
test('never serves the server code or hidden files', async () => {
  for (const p of ['/server.js', '/yt.js', '/services.js', '/http-util.js', '/package.json', '/build.js', '/.git/config', '/../server.js', '/js/../server.js', '/%2e%2e/server.js', '/test/helpers.js']) {
    const r = await raw(p); assert.notEqual(r.status, 200, p + ' should not be served');
  }
});
test('the small APIs answer', async () => {
  const ping = await (await fetch(srv.base + '/api/ping')).json(); assert.equal(ping.patos, true);
  const cfg = await fetch(srv.base + '/api/config'); assert.equal(cfg.status, 200);
  const bad = await fetch(srv.base + '/api/books/text?id=../../etc'); assert.notEqual(bad.status, 200);
});
test('the frame check refuses private addresses', async () => {
  for (const u of ['http://127.0.0.1/', 'http://localhost:' + srv.port + '/', 'http://10.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'file:///etc/passwd', 'http://192.168.1.1:8080/']) {
    const j = await (await fetch(srv.base + '/api/frameable?url=' + encodeURIComponent(u))).json();
    assert.ok(j.unknown || j.error || j.frameable === undefined || /not allowed|only web|port/i.test(j.reason || ''), u + ' must not be fetched: ' + JSON.stringify(j));
    assert.ok(!j.status, u + ' was fetched (status ' + j.status + ')');
  }
});

test('private addresses are recognised, also when hidden in IPv6', () => {
  const { privateIP } = require('../../services.js');
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::10.0.0.1', '2002:c0a8:0101::1', '[::1]']) assert.equal(privateIP(ip), true, ip);
  for (const ip of ['8.8.8.8', '142.250.72.14', '2607:f8b0:4004:800::200e', '1.1.1.1']) assert.equal(privateIP(ip), false, ip);
  // the same private addresses written in every IPv6 way: NAT64 in hex, expanded, IPv4-mapped in hex, 6to4, Teredo…
  for (const ip of ['64:ff9b::a00:1', '64:ff9b::7f00:1', '64:ff9b::c0a8:1', '64:ff9b::10.0.0.1', '64:ff9b:0:0:0:0:a00:1', '64:ff9b:1::a00:1', '::ffff:a00:1', '0:0:0:0:0:ffff:a00:1', '0:0:0:0:0:ffff:10.0.0.1', '::10.0.0.1', '::a00:1', '2002:a00:1::', '0:0:0:0:0:0:0:1', 'febf::1', 'fec0::1', 'ff02::1', '2001:0:4136:e378:8000:63bf:3fff:fdd2', '2001:db8::1', '[::1]', 'fe80::1%eth0', 'garbage']) assert.equal(privateIP(ip), true, ip + ' should be private');
  // and public ones written the same ways stay public
  for (const ip of ['64:ff9b::808:808', '::ffff:8.8.8.8', '::ffff:808:808', '2002:808:808::', '2606:4700:4700::1111']) assert.equal(privateIP(ip), false, ip + ' should be public');
});
test('the frame check still reads a real site (when there is internet)', async () => {
  const j = await (await fetch(srv.base + '/api/frameable?url=' + encodeURIComponent('https://www.google.com/'))).json();
  assert.ok(j.unknown || typeof j.frameable === 'boolean', JSON.stringify(j));
});

test('/api/updates lists the versions, newest first, matching js/version.js', async () => {
  const fs = require('fs'); const path = require('path');
  const r = await fetch(srv.base + '/api/updates'); assert.equal(r.status, 200);
  const list = await r.json(); assert.ok(Array.isArray(list) && list.length);
  const v = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'version.js'), 'utf8').match(/PatOS\.version = "([^"]+)"/)[1];
  assert.ok(!list.some((x) => x.beta), 'betas are not in the normal list');
  const beta = await (await fetch(srv.base + '/api/updates/beta')).json();
  assert.ok(beta === null || (beta.beta > 0 && beta.version), 'the beta, if there is one');
  assert.equal(list[0].version, v, 'run npm run build after adding a version to updates.json');
  list.forEach((x) => { assert.ok(x.version && x.date && x.title && x.title.en && x.notes && x.notes.en && x.notes.fr, JSON.stringify(x).slice(0, 80)); });
});
test('every response says nosniff, and PatOS pages can only be framed by PatOS itself (no clickjacking)', async () => {
  const page = await raw('/');
  assert.equal(page.headers['x-content-type-options'], 'nosniff');
  assert.equal(page.headers['x-frame-options'], 'SAMEORIGIN');
  assert.match(page.headers['content-security-policy'] || '', /frame-ancestors 'self'/);
  const js = await raw('/js/core.js');
  assert.equal(js.headers['x-content-type-options'], 'nosniff');
  assert.equal(js.headers['x-frame-options'], undefined, 'only pages need the frame rule');
  const api = await raw('/api/updates');
  assert.equal(api.headers['x-content-type-options'], 'nosniff');
});
