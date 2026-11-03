/* Small helpers for the PatOS server: compressed JSON, and static files that are compressed once and cached. */
'use strict';
const zlib = require('zlib');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip), brotli = promisify(zlib.brotliCompress);

const pick = (req) => { const a = String(req.headers['accept-encoding'] || ''); return /\bbr\b/.test(a) ? 'br' : /\bgzip\b/.test(a) ? 'gzip' : null; };
const compressible = (type) => /^(text\/|application\/(json|javascript|manifest\+json)|image\/svg)/.test(type);

async function sendJSON(req, res, code, obj, headers) {
  const body = Buffer.from(JSON.stringify(obj));
  const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', Vary: 'Accept-Encoding' }, headers || {});
  const enc = body.length > 800 ? pick(req) : null;
  if (!enc) { res.writeHead(code, h); return res.end(body); }
  const out = await (enc === 'br' ? brotli(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }) : gzip(body));
  h['Content-Encoding'] = enc; res.writeHead(code, h); res.end(out);
}

const files = new Map(); // file path -> { mtimeMs, etag, raw, br, gz }
async function sendFile(req, res, file, type) {
  let st; try { st = await fs.promises.stat(file); } catch (e) { return false; }
  if (!st.isFile()) return false;
  let f = files.get(file);
  if (!f || f.mtimeMs !== st.mtimeMs) {
    const raw = await fs.promises.readFile(file);
    f = { mtimeMs: st.mtimeMs, raw, etag: '"' + crypto.createHash('sha1').update(raw).digest('base64').slice(0, 20) + '"', br: null, gz: null };
    files.set(file, f);
  }
  const h = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: f.etag, Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, h); res.end(); return true; }
  let body = f.raw; const enc = compressible(type) && f.raw.length > 600 ? pick(req) : null;
  if (enc === 'br') { f.br = f.br || await brotli(f.raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: f.raw.length } }); body = f.br; h['Content-Encoding'] = 'br'; }
  else if (enc === 'gzip') { f.gz = f.gz || await gzip(f.raw, { level: 9 }); body = f.gz; h['Content-Encoding'] = 'gzip'; }
  h['Content-Length'] = body.length;
  res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}
module.exports = { sendJSON, sendFile };
