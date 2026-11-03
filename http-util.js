/* Small helpers for the PatOS server: compressed JSON, and static files that are compressed once and cached. */
'use strict';
const zlib = require('zlib');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip), brotli = promisify(zlib.brotliCompress);

const pick = (req) => { const a = String(req.headers['accept-encoding'] || ''); return /\bbr\b/.test(a) ? 'br' : /\bgzip\b/.test(a) ? 'gzip' : null; };
const compressible = (type) => /^(text\/|application\/(json|javascript|manifest\+json|wasm)|image\/svg)/.test(type);

async function sendJSON(req, res, code, obj, headers) {
  const body = Buffer.from(JSON.stringify(obj));
  const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', Vary: 'Accept-Encoding' }, headers || {});
  const enc = body.length > 800 ? pick(req) : null;
  if (!enc) { res.writeHead(code, h); return res.end(body); }
  const out = await (enc === 'br' ? brotli(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }) : gzip(body));
  h['Content-Encoding'] = enc; res.writeHead(code, h); res.end(out);
}

const files = new Map(); // file path -> { mtimeMs, etag, raw, br, gz }
async function sendFile(req, res, file, type, extra) {
  let st; try { st = await fs.promises.stat(file); } catch (e) { return false; }
  if (!st.isFile()) return false;
  let f = files.get(file);
  if (!f || f.mtimeMs !== st.mtimeMs) {
    const raw = await fs.promises.readFile(file);
    f = { mtimeMs: st.mtimeMs, raw, etag: '"' + crypto.createHash('sha1').update(raw).digest('base64').slice(0, 20) + '"', br: null, gz: null };
    files.set(file, f);
  }
  const h = Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: f.etag, Vary: 'Accept-Encoding' }, extra || {});
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, h); res.end(); return true; }
  let body = f.raw; const enc = compressible(type) && f.raw.length > 600 ? pick(req) : null;
  if (enc === 'br') { f.br = f.br || await brotli(f.raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: f.raw.length > 2e6 ? 5 : 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: f.raw.length } }); body = f.br; h['Content-Encoding'] = 'br'; }
  else if (enc === 'gzip') { f.gz = f.gz || await gzip(f.raw, { level: 9 }); body = f.gz; h['Content-Encoding'] = 'gzip'; }
  h['Content-Length'] = body.length;
  res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

/* Pyodide (Python for the browser) is fetched once from its official CDN and kept on disk, so schools that block the CDN can still run Python */
const os = require('os');
const PY_VER = 'v0.26.4', PY_DIR = path.join(os.tmpdir(), 'patos-pyodide-' + PY_VER);
const PY_OK = /^\/pyodide\/[A-Za-z0-9._+-]+\.(js|mjs|wasm|zip|json|whl|data|tar)$/;
const pyFetching = new Map();
async function pyFile(name) {
  const file = path.join(PY_DIR, name);
  try { await fs.promises.access(file); return file; } catch (e) {}
  if (pyFetching.has(name)) return pyFetching.get(name);
  const p = (async () => {
    await fs.promises.mkdir(PY_DIR, { recursive: true });
    const r = await fetch('https://cdn.jsdelivr.net/pyodide/' + PY_VER + '/full/' + name);
    if (!r.ok) throw new Error('CDN ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer()); const tmp = file + '.' + process.pid + '.part';
    await fs.promises.writeFile(tmp, buf); await fs.promises.rename(tmp, file); return file;
  })().finally(() => pyFetching.delete(name));
  pyFetching.set(name, p); return p;
}
async function sendPyodide(req, res, pathname) {
  if (!PY_OK.test(pathname)) return false;
  const name = pathname.slice('/pyodide/'.length); let file;
  try { file = await pyFile(name); } catch (e) { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Python files are not available: ' + e.message); return true; }
  const type = { js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', wasm: 'application/wasm', json: 'application/json', zip: 'application/zip' }[name.split('.').pop()] || 'application/octet-stream';
  const ok = await sendFile(req, res, file, type, { 'Cache-Control': 'public, max-age=604800, immutable' }); if (!ok) { res.writeHead(404); res.end('Not found'); }
  return true;
}
module.exports = { sendJSON, sendFile, sendPyodide };
