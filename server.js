/* Tiny zero-dependency static server for PatOS (used on Render / any Node host). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const yt = require('./yt.js');
const services = require('./services.js');
const syncServer = require('./sync-server.js');
const appsServer = require('./apps-server.js');
const linkServer = require('./link-server.js');
const proxyServer = require('./proxy-server.js');
const cloudBrowser = require('./cloud-browser.js');
const adminServer = require('./admin-server.js');
const { sendFile, sendJSON, sendPyodide } = require('./http-util.js');
const updateManager = require('./update-manager.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.patapp': 'application/json'
};
const versions = updateManager.create({ root: ROOT }); // which files each version of PatOS is made of (see update-manager.js)
versions.problems().forEach((p) => console.error('PatOS update setup: ' + p));

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (p.startsWith('/api/yt/')) return yt.handle(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/api/news') || p.startsWith('/api/books/') || p === '/api/suggest' || p === '/api/frameable') return services.handle(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/api/sync/')) return syncServer.handle(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/api/link/')) return linkServer.handle(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/api/apps/')) return appsServer.handle(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/api/cloud/')) return cloudBrowser.handle(req, res, new URL(req.url, 'http://x')).catch(() => { if (!res.headersSent) { res.writeHead(502); res.end(); } }); // Cloud Chrome (cloud-browser.js)
  if (p === '/api/proxy') return proxyServer.handle(req, res, new URL(req.url, 'http://x')).catch(() => { if (!res.headersSent) { res.writeHead(502); res.end('Proxy error'); } else res.destroy(); }); // Patoogle (proxy-server.js)
  if (p.startsWith('/api/admin/')) return adminServer.handle(req, res, new URL(req.url, 'http://x')); // the PatOS account's powers (admin-server.js)
  if (p === '/apprequests' || p === '/apprequests/') return appsServer.page(req, res);
  if (p.startsWith('/pyodide/')) return sendPyodide(req, res, p).then((ok) => { if (!ok) { res.writeHead(404); res.end('Not found'); } });
  if (p === '/api/config') return sendJSON(req, res, 200, { googleCx: (process.env.GOOGLE_CX || '').trim() });
  // the list of PatOS versions and what changed in each (read fresh, so a running PatOS can see the newest one)
  if (p === '/api/updates' || p === '/api/updates/beta') {
    let all = []; try { all = JSON.parse(fs.readFileSync(path.join(ROOT, 'updates.json'), 'utf8')); } catch (e) {}
    return sendJSON(req, res, 200, p === '/api/updates' ? all.filter((r) => !r.beta) : all.find((r) => r.beta) || null); // releases, or the beta being built
  }
  // the files of one version of PatOS: /_v/<version>/<file> (see update-manager.js and sw.js)
  if (p.startsWith('/_v/')) {
    const parts = p.split('/'); const r = versions.resolve(parts[2] || '');
    if (!r) { res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end('No such version'); }
    const rel = parts.slice(3).join('/');
    if (rel === 'patos-release.json') return sendJSON(req, res, 200, versions.manifestOf(r));
    const vfile = versions.fileOf(r, rel);
    if (!vfile) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    return sendFile(req, res, vfile, TYPES[path.extname(vfile).toLowerCase()] || 'application/octet-stream').then((ok) => { if (!ok) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); } }).catch(() => { res.writeHead(500); res.end(); });
  }
  if (p === '/api/ping') { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end('{"patos":true}'); }
  // the plain address shows the newest finished version (or the beta, when the server is started with PATOS_ROOT=beta)
  const ch = (/(?:^|;\s*)patos_ch=([0-9a-z.]{1,20})/.exec(req.headers.cookie || '') || [])[1] || ''; // (the version this device installed)
  const file = versions.rootFile(p, ch);
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  sendFile(req, res, file, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', { Vary: 'Accept-Encoding, Cookie' }).then((ok) => { if (!ok) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); } }).catch(() => { res.writeHead(500); res.end('Server error'); });
});
// Cloud Chrome's live connection (WebSocket): pictures out, clicks and keys in
server.on('upgrade', (req, sock) => { if (String(req.url).startsWith('/api/cloud/ws')) cloudBrowser.upgrade(req, sock); else sock.destroy(); });
server.keepAliveTimeout = 65000; server.headersTimeout = 70000;
server.listen(PORT, () => { console.log('PatOS running on port ' + PORT); try { yt.warm(); } catch (e) {} });
