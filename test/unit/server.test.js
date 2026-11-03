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
  assert.equal(list[0].version, v, 'run npm run build after adding a version to updates.json');
  list.forEach((x) => { assert.ok(x.version && x.date && x.title && x.title.en && x.notes && x.notes.en && x.notes.fr, JSON.stringify(x).slice(0, 80)); });
});
