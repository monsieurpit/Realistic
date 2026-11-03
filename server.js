/* Tiny zero-dependency static server for PatOS (used on Render / any Node host). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const yt = require('./yt.js');
const services = require('./services.js');
const { sendFile, sendJSON, sendPyodide } = require('./http-util.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};
const PRIVATE = new Set(['server.js', 'yt.js', 'services.js', 'http-util.js', 'package.json', 'package-lock.json', 'build.js']);

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (p.startsWith('/api/yt/')) return yt.handle(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/api/news') || p.startsWith('/api/books/') || p === '/api/suggest' || p === '/api/frameable') return services.handle(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/pyodide/')) return sendPyodide(req, res, p).then((ok) => { if (!ok) { res.writeHead(404); res.end('Not found'); } });
  if (p === '/api/config') return sendJSON(req, res, 200, { googleCx: (process.env.GOOGLE_CX || '').trim() });
  if (p === '/api/ping') { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end('{"patos":true}'); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || rel.split(path.sep).some((s) => s.startsWith('.')) || PRIVATE.has(rel)) { res.writeHead(404); return res.end('Not found'); }
  sendFile(req, res, file, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream').then((ok) => { if (!ok) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); } }).catch(() => { res.writeHead(500); res.end('Server error'); });
});
server.keepAliveTimeout = 65000; server.headersTimeout = 70000;
server.listen(PORT, () => { console.log('PatOS running on port ' + PORT); try { yt.warm(); } catch (e) {} });
