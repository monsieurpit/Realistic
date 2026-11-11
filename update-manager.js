/* PatOS update manager (server side).
   PatOS used to be one set of files: whatever was on the server, everyone got, and the browser swapped to it by itself.
   Now every version has its own files, and each person's device keeps the version that person chose:

     releases/<version>/   the frozen files of a finished version (for example releases/1.7.0/). Never changes once made.
     the main folder       the files of the beta being built (the live files). Only people with Beta updates on get them.

   The server hands these files out under /_v/<id>/..., where <id> is
     1.7.0                          a finished version (stable)
     2.0.0-beta.11.ab12cd34         the beta build with those exact files (the last part is a fingerprint of the files)
   and three nicknames: stable (the newest finished version), beta (the beta being built) and root (what the plain
   address / shows to someone who has never opened PatOS: stable, or the beta when PATOS_ROOT=beta, which the tests use).
   /_v/<id>/patos-release.json lists every file of that version with its fingerprint, so a device can download a whole
   version, check every file, and only then switch to it. The service worker (sw.js) does the rest on the device.

   This file is used by server.js (to hand out files), build.js (to stop a build that would give the beta to everyone) and
   scripts/freeze-release.js (to make releases/<version>/). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STABLE_ID = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const BETA_ID = /^\d{1,4}\.\d{1,4}\.\d{1,4}-beta\.\d{1,4}\.[0-9a-f]{8}$/;
// never handed out (server code, tests, data, and the folders of frozen versions themselves)
const PRIVATE_DIRS = new Set(['test', 'node_modules', 'data', 'sync-data', 'vendor-src', 'scripts', 'releases']);
const PRIVATE = new Set(['server.js', 'yt.js', 'services.js', 'http-util.js', 'sync-server.js', 'apps-server.js', 'link-server.js', 'admin-server.js', 'update-manager.js', 'apprequests.html', 'firestore.rules', 'firebase.json', 'package.json', 'package-lock.json', 'build.js', 'updates.json']);
// the same for every version, so they are not copied into releases/<version>/: the service worker itself (it must never differ
// between versions, or the browser would swap versions by itself), the PDF tools and the single-file builds
const SHARED = (rel) => rel === 'sw.js' || rel.startsWith('vendor/pdf/') || rel.startsWith('dist/');
const FIXED_ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png'];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* true when this path (relative to a version's folder) may be handed out */
function allowed(rel) {
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const parts = rel.split(path.sep);
  if (parts.some((s) => s === '' || s.startsWith('.'))) return false;
  return !(PRIVATE.has(rel) || PRIVATE_DIRS.has(parts[0]));
}

/* the files a device must keep to run a version offline: what index.html loads, plus the icons */
function filesOf(dir) {
  const out = FIXED_ASSETS.slice();
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  html.replace(/(?:src|href)="((?:css|js|vendor)\/[^"]+)"/g, (m, p) => { if (!out.includes(p)) out.push(p); return m; });
  return out;
}

/* "a.b.c" and a beta number to something comparable: bigger means newer, and a beta is older than its finished version */
function rank(v, beta) { const n = String(v).split('.').map(Number); return [n[0] || 0, n[1] || 0, n[2] || 0, beta ? 0 : 1, beta || 0]; }
function newerThan(a, b) { const x = rank(a.version, a.beta), y = rank(b.version, b.beta); for (let i = 0; i < 5; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; }

function create(options) {
  const root = path.resolve((options && options.root) || __dirname);
  const rootChannel = (options && options.rootChannel) || process.env.PATOS_ROOT || 'stable'; // what / shows to a new visitor
  const releasesDir = path.join(root, 'releases');
  const cache = new Map(); // directory -> { sig, manifest }

  const readUpdates = () => { try { const l = JSON.parse(fs.readFileSync(path.join(root, 'updates.json'), 'utf8')); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
  const stableDirOf = (v) => path.join(releasesDir, v);

  /* the newest finished version and the beta being built (from updates.json), and where the files of each are */
  function info() {
    const all = readUpdates();
    const stable = all.find((r) => !r.beta) || null, beta = all.find((r) => r.beta) || null;
    return { stable, beta };
  }

  /* a quick fingerprint of "has any file changed", from sizes and times only, so a manifest is not rebuilt on every request */
  function signature(dir, files) {
    return files.map((p) => { try { const s = fs.statSync(path.join(dir, p === './' ? 'index.html' : p)); return s.size + ':' + s.mtimeMs; } catch (e) { return 'x'; } }).join('|');
  }
  /* every file of a folder with its fingerprint and size */
  function filesWithHashes(dir) {
    const list = filesOf(dir).filter((p) => p !== './');
    const sig = signature(dir, list); const hit = cache.get(dir);
    if (hit && hit.sig === sig) return hit.files;
    const files = list.map((p) => { const buf = fs.readFileSync(path.join(dir, p)); return { p, h: sha256(buf), s: buf.length }; });
    cache.set(dir, { sig, files });
    return files;
  }
  const treeFingerprint = (files) => sha256(files.map((f) => f.p + ':' + f.h).join('\n')).slice(0, 8);

  /* what an id or nickname means right now: { id, channel, version, beta, dir } or null when there is no such version */
  function resolve(name) {
    const u = info();
    if (name === 'root') name = rootChannel === 'beta' && u.beta ? 'beta' : 'stable';
    if (name === 'stable') { if (!u.stable) return null; name = u.stable.version; }
    if (name === 'beta') {
      if (!u.beta) return null;
      const files = filesWithHashes(root);
      return { id: u.beta.version + '-beta.' + u.beta.beta + '.' + treeFingerprint(files), channel: 'beta', version: u.beta.version, beta: u.beta.beta, dir: root, files, date: u.beta.date };
    }
    if (STABLE_ID.test(name)) {
      const frozen = stableDirOf(name);
      if (fs.existsSync(path.join(frozen, 'index.html'))) {
        const rec = readUpdates().find((r) => !r.beta && r.version === name);
        return { id: name, channel: 'stable', version: name, beta: 0, dir: frozen, files: filesWithHashes(frozen), date: rec && rec.date };
      }
      // the newest finished version while no beta is being built is simply the live files
      if (u.stable && u.stable.version === name && !u.beta) return { id: name, channel: 'stable', version: name, beta: 0, dir: root, files: filesWithHashes(root), date: u.stable.date };
      return null;
    }
    if (BETA_ID.test(name)) { const b = resolve('beta'); return b && b.id === name ? b : null; } // only the beta build as it is right now
    return null;
  }

  const manifestOf = (r) => ({ id: r.id, channel: r.channel, version: r.version, beta: r.beta || 0, date: r.date || null, files: r.files });

  /* a file of a version, as a path on disk (null when it is not one of that version's public files) */
  function fileOf(r, rel) {
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(r.dir, rel));
    const within = path.relative(r.dir, file);
    return allowed(within) && !SHARED(within) ? file : null;
  }

  /* where a plain address (/css/x.css) comes from: the version the plain address shows, except for files that are the same for all */
  function rootFile(p) {
    const rel = p.endsWith('/') ? p.slice(1) + 'index.html' : p.slice(1);
    const shared = SHARED(path.normalize(rel));
    const r = shared ? { dir: root } : resolve('root');
    if (!r) return null;
    const file = path.normalize(path.join(r.dir, rel));
    const within = path.relative(r.dir, file);
    return allowed(within) ? file : null;
  }

  /* Makes releases/<version>/ from a folder of files (the live files, or an old version taken out of git).
     It never overwrites a frozen version: a finished version does not change. */
  function freeze(version, fromDir, opts) {
    if (!STABLE_ID.test(version)) throw new Error('A version looks like 1.7.0.');
    const dest = stableDirOf(version);
    if (fs.existsSync(dest)) throw new Error('releases/' + version + ' already exists. A finished version is never changed.');
    const src = path.resolve(fromDir || root);
    const copy = (rel) => {
      const from = path.join(src, rel); const st = fs.statSync(from);
      if (st.isDirectory()) { fs.readdirSync(from).forEach((n) => { const r = path.join(rel, n); if (allowed(r) && !SHARED(r) && !SHARED(r + '/')) copy(r); }); return; }
      if (!allowed(rel) || SHARED(rel)) return;
      fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true }); fs.copyFileSync(from, path.join(dest, rel));
    };
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((n) => { if (allowed(n) && !SHARED(n) && !SHARED(n + '/')) copy(n); });
    if (opts && typeof opts.after === 'function') opts.after(dest);
    const files = filesWithHashes(dest);
    fs.writeFileSync(path.join(dest, 'patos-release.json'), JSON.stringify({ version, frozen: new Date().toISOString().slice(0, 10), files }, null, 1) + '\n');
    return { dest, files: files.length };
  }

  /* a build or a start-up check: while a beta is being built, the newest finished version must have its own frozen folder,
     or people who stay on finished versions would get the beta files instead */
  function problems() {
    const u = info(); const out = [];
    if (!u.stable) out.push('updates.json has no finished version.');
    if (u.stable && u.beta && !fs.existsSync(path.join(stableDirOf(u.stable.version), 'index.html'))) out.push('A beta is being built, but releases/' + u.stable.version + '/ does not exist. Run: node scripts/freeze-release.js ' + u.stable.version + ' (from the files of that version).');
    if (u.stable && u.beta && newerThan(u.beta, u.stable) === false) out.push('The beta (' + u.beta.version + ') is not newer than the finished version (' + u.stable.version + ').');
    return out;
  }

  return { root, rootChannel, info, resolve, manifestOf, fileOf, rootFile, freeze, problems, filesOf, readUpdates };
}

/* js/version.js, from the list in updates.json (build.js writes it; so does a release made from the PatOS account, admin-server.js) */
function versionJS(all) {
  const rel = all.filter((r) => !r.beta), beta = all.find((r) => r.beta) || null;
  // PatOS.build says what THESE files are: the beta being built, or a finished version (the update manager uses it, see js/updatemanager.js)
  const build = beta ? { channel: 'beta', version: beta.version, beta: beta.beta } : { channel: 'stable', version: rel[0].version, beta: 0 };
  return '/* generated by build.js from updates.json: do not edit */\nPatOS.version = ' + JSON.stringify(rel[0].version) + ';\nPatOS.releases = ' + JSON.stringify(rel) + ';\nPatOS.beta = ' + JSON.stringify(beta) + ';\nPatOS.build = ' + JSON.stringify(build) + ';\n';
}

module.exports = { versionJS, create, allowed, filesOf, rank, newerThan, sha256, STABLE_ID, BETA_ID, PRIVATE, PRIVATE_DIRS, SHARED };
