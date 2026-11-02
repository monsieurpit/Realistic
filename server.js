/* Tiny zero-dependency static server for PatOS (used on Render / any Node host). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const yt = require('./yt.js');
const services = require('./services.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};
const PRIVATE = new Set(['server.js', 'yt.js', 'services.js', 'package.json', 'package-lock.json', 'build.js']);

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (p.startsWith('/api/yt/')) return yt.handle(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/api/news') || p.startsWith('/api/books/')) return services.handle(req, res, new URL(req.url, 'http://x'));
  if (p === '/api/config') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ googleCx: (process.env.GOOGLE_CX || '').trim() })); }
  if (p === '/api/ping') { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end('{"patos":true}'); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || rel.split(path.sep).some((s) => s.startsWith('.')) || PRIVATE.has(rel)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => console.log('PatOS running on port ' + PORT));
