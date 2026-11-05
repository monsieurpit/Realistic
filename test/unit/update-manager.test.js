/* The update manager: every version has its own files, a device only gets the version it chose, and nobody gets the beta by accident. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const um = require('../../update-manager.js');
const { startServer, copyProject, ROOT } = require('../helpers');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const REAL = um.create({ root: ROOT });

test('a finished version is saved in its own folder, and it still matches what was saved (it never changes)', () => {
  const { stable, beta } = REAL.info();
  assert.ok(stable && /^\d+\.\d+\.\d+$/.test(stable.version));
  if (beta) assert.ok(fs.existsSync(path.join(ROOT, 'releases', stable.version, 'index.html')), 'while a beta is built, the newest finished version must have releases/<version>/');
  assert.deepEqual(REAL.problems(), []);
  fs.readdirSync(path.join(ROOT, 'releases')).forEach((v) => {
    const dir = path.join(ROOT, 'releases', v); const saved = JSON.parse(fs.readFileSync(path.join(dir, 'patos-release.json'), 'utf8'));
    assert.equal(saved.version, v); assert.ok(saved.files.length > 50);
    saved.files.forEach((f) => assert.equal(sha(fs.readFileSync(path.join(dir, f.p))), f.h, 'releases/' + v + '/' + f.p + ' was changed after the version was finished'));
    assert.ok(!fs.existsSync(path.join(dir, 'sw.js')) && !fs.existsSync(path.join(dir, 'server.js')) && !fs.existsSync(path.join(dir, 'updates.json')), 'only public files are saved');
  });
});

test('ids and nicknames: stable is the newest finished version, beta is the live files, anything else is refused', () => {
  const { stable, beta } = REAL.info();
  const s = REAL.resolve('stable'); assert.equal(s.id, stable.version); assert.equal(s.channel, 'stable'); assert.ok(s.dir.endsWith(path.join('releases', stable.version)) || !beta);
  assert.equal(REAL.resolve(stable.version).id, s.id);
  assert.equal(REAL.resolve('root').id, s.id, 'a new visitor gets the finished version');
  if (beta) {
    const b = REAL.resolve('beta'); assert.match(b.id, /^\d+\.\d+\.\d+-beta\.\d+\.[0-9a-f]{8}$/); assert.equal(b.channel, 'beta'); assert.equal(b.dir, REAL.root); assert.equal(REAL.resolve(b.id).id, b.id);
    assert.equal(REAL.resolve(b.id.replace(/[0-9a-f]{8}$/, '00000000')), null, 'an old beta build is no longer handed out');
    assert.equal(um.create({ root: ROOT, rootChannel: 'beta' }).resolve('root').id, b.id, 'PATOS_ROOT=beta shows the beta');
  }
  ['../x', '9.9.9', '1.7', 'latest', '', '1.7.0/../..', '2.0.0-beta.1.zz'].forEach((bad) => assert.equal(REAL.resolve(bad), null, bad));
});

test('what may be handed out: no code of the server, no tests, no hidden files, no way out of the folder', () => {
  ['index.html', 'js/core.js', 'css/patos.css', 'vendor/three.min.js', 'docs/APP-SDK.md'].forEach((p) => assert.equal(um.allowed(p), true, p));
  ['server.js', 'update-manager.js', 'updates.json', 'package.json', 'test/x.js', 'releases/1.7.0/index.html', 'node_modules/a.js', '../server.js', '/etc/passwd', '.git/config', 'js/.env', 'data/x', 'scripts/perf.js'].forEach((p) => assert.equal(um.allowed(p), false, p));
  const r = REAL.resolve('stable');
  assert.equal(REAL.fileOf(r, '../../server.js'), null); assert.equal(REAL.fileOf(r, 'sw.js'), null); assert.ok(REAL.fileOf(r, 'js/core.js')); assert.ok(REAL.fileOf(r, '').endsWith('index.html'));
  assert.ok(REAL.rootFile('/sw.js').startsWith(ROOT) && !REAL.rootFile('/sw.js').includes('releases'), 'the service worker is the same file for every version');
  assert.equal(REAL.rootFile('/server.js'), null); assert.equal(REAL.rootFile('/releases/1.7.0/index.html'), null);
});

test('versions are compared like a person would: a beta is older than its finished version', () => {
  assert.equal(um.newerThan({ version: '1.8.0' }, { version: '1.7.0' }), true);
  assert.equal(um.newerThan({ version: '2.0.0', beta: 11 }, { version: '1.7.0' }), true);
  assert.equal(um.newerThan({ version: '2.0.0' }, { version: '2.0.0', beta: 11 }), true);
  assert.equal(um.newerThan({ version: '2.0.0', beta: 11 }, { version: '2.0.0' }), false);
  assert.equal(um.newerThan({ version: '1.7.0' }, { version: '1.7.0' }), false);
  assert.equal(um.newerThan({ version: '1.10.0' }, { version: '1.9.0' }), true);
});

test('freezing makes releases/<version>/ from the files, refuses to overwrite, and a build is stopped when a beta has no finished version saved', () => {
  const c = copyProject();
  try {
    const m = um.create({ root: c.dir });
    fs.rmSync(path.join(c.dir, 'releases'), { recursive: true });
    assert.ok(m.problems().some((x) => /releases\/1\.7\.0/.test(x)), 'beta without a saved finished version is a problem');
    // freeze the live files as 1.7.0 (just to have something): it is a complete, working version
    const r = m.freeze('1.7.0'); assert.ok(r.files > 50);
    assert.deepEqual(m.problems(), []);
    assert.throws(() => m.freeze('1.7.0'), /already exists/); assert.throws(() => m.freeze('x'), /looks like/);
    assert.ok(!fs.existsSync(path.join(c.dir, 'releases', '1.7.0', 'sw.js')) && !fs.existsSync(path.join(c.dir, 'releases', '1.7.0', 'server.js')) && !fs.existsSync(path.join(c.dir, 'releases', '1.7.0', 'releases')));
    const saved = JSON.parse(fs.readFileSync(path.join(c.dir, 'releases', '1.7.0', 'patos-release.json'), 'utf8')); assert.equal(saved.files.length, r.files);
    // changing the live files afterwards does not touch the frozen ones
    fs.appendFileSync(path.join(c.dir, 'css', 'patos.css'), '\n/* later */\n');
    assert.ok(!fs.readFileSync(path.join(c.dir, 'releases', '1.7.0', 'css', 'patos.css'), 'utf8').includes('/* later */'));
    // the CLI does the same thing
    const out = execFileSync(process.execPath, [path.join(c.dir, 'scripts', 'freeze-release.js'), '1.7.1'], { encoding: 'utf8' }); assert.match(out, /Saved \d+ files/);
  } finally { c.remove(); }
});

test('the website: the plain address is the finished version, /_v/ hands out each version, and the service worker is one fixed file', async () => {
  const srv = await startServer({ root: 'stable' });
  try {
    const get = async (p, o) => fetch(srv.base + p, o);
    const { stable, beta } = REAL.info();
    // a new visitor gets the finished version, never the beta
    const ver = await (await get('/js/version.js')).text(); assert.match(ver, new RegExp('PatOS\\.build = \\{"channel":"stable","version":"' + stable.version.replace(/\./g, '\\.') + '"')); assert.ok(!/PatOS\.beta = \{/.test(ver) || !beta || /channel":"stable/.test(ver));
    // its list of files: every file downloads and matches its fingerprint
    const man = await (await get('/_v/stable/patos-release.json')).json(); assert.equal(man.id, stable.version); assert.equal(man.channel, 'stable');
    for (const f of man.files.slice(0, 25)) { const b = Buffer.from(await (await get('/_v/' + man.id + '/' + f.p)).arrayBuffer()); assert.equal(sha(b), f.h, f.p); assert.equal(b.length, f.s); }
    const mine = await (await get('/_v/' + stable.version + '/patos-release.json')).json(); assert.deepEqual(mine, man);
    if (beta) {
      const bm = await (await get('/_v/beta/patos-release.json')).json(); assert.equal(bm.channel, 'beta'); assert.match(bm.id, /-beta\.\d+\./);
      const bv = await (await get('/_v/' + bm.id + '/js/version.js')).text(); assert.match(bv, /"channel":"beta"/);
      assert.equal((await get('/_v/' + bm.id.replace(/.{8}$/, '00000000') + '/index.html')).status, 404);
    }
    // the service worker is the same for every version
    const sw = await (await get('/sw.js')).text(); assert.equal(sw, fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'));
    for (const p of ['/server.js', '/update-manager.js', '/updates.json', '/releases/' + stable.version + '/index.html', '/_v/' + stable.version + '/server.js', '/_v/' + stable.version + '/../server.js', '/_v/nothing/index.html', '/_v/' + stable.version + '/sw.js']) assert.equal((await get(p)).status, 404, p);
  } finally { srv.stop(); }
});

test('build.js does not write sw.js (it is the same for every version) and stops when the setup is wrong', () => {
  const before = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  execFileSync(process.execPath, ['build.js'], { cwd: ROOT, stdio: 'ignore' });
  assert.equal(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), before);
  assert.ok(!/const CACHE = /.test(before), 'no version-specific cache name inside sw.js');
  const c = copyProject();
  try { fs.rmSync(path.join(c.dir, 'releases'), { recursive: true }); let failed = false; try { execFileSync(process.execPath, ['build.js'], { cwd: c.dir, stdio: 'pipe' }); } catch (e) { failed = /releases\/1\.7\.0/.test(String(e.stderr)); } assert.equal(failed, true, 'build.js stops'); } finally { c.remove(); }
});
