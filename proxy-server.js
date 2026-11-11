/* Patoogle's proxy: shows websites that refuse to be shown inside other pages, right inside Patoogle.
   Most sites tell browsers "don't show me in a frame" (X-Frame-Options, CSP frame-ancestors), and a web page can't override that.
   So for those sites Patoogle asks this server for the page: the server fetches it, removes those headers, adds a small script
   that keeps links, forms and the page's own requests going through here (and tells Patoogle the real address and title), and
   sends it back. Pictures, styles and scripts still load straight from the site (a <base> points at it), so most bytes never
   pass through here.

   Safety, because this runs on the owner's server:
   - every proxied page is SANDBOXED with an opaque origin (a CSP sandbox header, and Patoogle's iframe sandbox): it can't read
     PatOS's storage, cookies or files, even though it is served from PatOS's address
   - only public web addresses: every address and every redirect is checked (services.js safeURL), private networks and the
     server itself are refused, and the connection is pinned to the checked IP (no DNS rebinding)
   - limits: per-address rate limit, a size and time limit per request, and a daily data cap (PROXY_DAILY_MB, default 1500), so a
     stranger who finds the address can't run up the bill. PROXY_OFF=1 turns it off.
   - no cookies are kept or forwarded between sites, nothing is written to disk or logged. Logins mostly won't work (no cookies);
     those sites still open in their own window. */
'use strict';
const net = require('net');
const zlib = require('zlib');
const { safeURL } = require('./services.js');

const MAX_HTML = 8 * 1048576, MAX_BODY = 2 * 1048576, MAX_STREAM = 200 * 1048576;
const TIMEOUT = () => +process.env.PROXY_TIMEOUT_MS || 20000;
const budgetMB = () => +process.env.PROXY_DAILY_MB || 1500;
const check = (u) => safeURL(u); // (services.js: public addresses only, each redirect again; see PROXY_TEST_HOSTS there for tests)
const DROP = new Set(['set-cookie', 'set-cookie2', 'x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'strict-transport-security',
  'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy', 'permissions-policy', 'feature-policy', 'report-to', 'nel', 'reporting-endpoints',
  'clear-site-data', 'alt-svc', 'connection', 'keep-alive', 'transfer-encoding', 'access-control-allow-origin', 'access-control-allow-credentials', 'access-control-allow-headers',
  'access-control-allow-methods', 'access-control-expose-headers', 'origin-agent-cluster', 'x-xss-protection', 'location', 'refresh', 'link', 'server-timing', 'set-login']);
// the proxied page is a sandbox with an opaque origin, wherever it is opened
const SANDBOX = 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation';

let day = '', used = 0;
const hits = new Map();
const today = () => new Date().toISOString().slice(0, 10);
function count(n) { const d = today(); if (d !== day) { day = d; used = 0; } used += n; }
const overBudget = () => { if (today() !== day) { day = today(); used = 0; } return used > budgetMB() * 1048576; };
const clientIP = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
function limited(req) {
  const ip = clientIP(req), now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 60000); h.push(now); hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > (+process.env.PROXY_RATE || 600);
}

function cors(req, extra) {
  const o = req.headers.origin;
  // (the proxied page has an opaque origin, "null": answering exactly that, with credentials, lets its requests through)
  const h = { 'access-control-allow-origin': o || '*', 'access-control-allow-credentials': o ? 'true' : 'false', 'access-control-expose-headers': '*', vary: 'Origin' };
  for (const [k, v] of Object.entries(extra || {})) h[k.toLowerCase()] = v;
  return h;
}
function page(req, res, code, title, body) {
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
    '<style>body{font:15px/1.5 system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#333;background:#f6f6f8}div{max-width:460px;padding:24px;text-align:center}h1{font-size:20px}p{color:#666}</style>' +
    '<div><h1>' + esc(title) + '</h1><p>' + esc(body) + '</p></div><script>try{parent.postMessage({patosProxy:"error",title:' + JSON.stringify(title) + '},"*")}catch(e){}</script>';
  res.writeHead(code, cors(req, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': SANDBOX }));
  res.end(html);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function readBody(req) {
  return new Promise((ok, bad) => {
    const parts = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { bad(new Error('Too much to send')); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts))); req.on('error', bad);
  });
}
// one request to the checked IP (TLS still checks the real name)
function upstream(target, method, headers, body) {
  const { url, ip, family } = target; const mod = url.protocol === 'https:' ? require('https') : require('http');
  return new Promise((ok, bad) => {
    const r = mod.request({ protocol: url.protocol, hostname: url.hostname.replace(/^\[|\]$/g, ''), port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + url.search, method,
      servername: net.isIP(url.hostname) ? undefined : url.hostname, headers, lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: ip, family }]) : cb(null, ip, family)), timeout: TIMEOUT() }, ok);
    r.on('timeout', () => r.destroy(new Error('The site took too long to answer')));
    r.on('error', bad);
    if (body && body.length) r.write(body);
    r.end();
  });
}
function decode(buf, enc) {
  enc = String(enc || '').toLowerCase();
  if (enc === 'gzip' || enc === 'x-gzip') return zlib.gunzipSync(buf);
  if (enc === 'deflate') { try { return zlib.inflateSync(buf); } catch (e) { return zlib.inflateRawSync(buf); } }
  if (enc === 'br') return zlib.brotliDecompressSync(buf);
  return buf;
}
function charsetOf(ct, head) {
  const m = /charset=["']?([\w-]+)/i.exec(ct || '') || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [];
  try { return new TextDecoder(m[1] || 'utf-8') && (m[1] || 'utf-8'); } catch (e) { return 'utf-8'; }
}

/* the script put at the top of every proxied page (it runs inside the sandbox) */
function helper(proxy, base) {
  return '<script>(function(){"use strict";var P=' + JSON.stringify(proxy) + ',cur=' + JSON.stringify(base) + ';' +
  // (an address of the proxy itself, as a page sees in location.href, means the real address inside it)
  'function abs(u){try{var a=new URL(u,document.baseURI).href;if(a.indexOf(P+"?")===0){var r=new URL(a).searchParams.get("u");if(r)return r}return a}catch(e){return null}}' +
  'function web(u){return /^https?:/i.test(u)&&u.indexOf(P)!==0}' +
  'function px(u){var o="";try{o=new URL(cur).origin}catch(e){}return P+"?u="+encodeURIComponent(u)+(o?"&o="+encodeURIComponent(o):"")}' +
  'function tell(k,x){try{parent.postMessage(Object.assign({patosProxy:k},x||{}),"*")}catch(e){}}' +
  'function page(){tell("page",{url:cur,title:document.title||""})}' +
  // storage and cookies: a sandboxed page has none, and many sites stop working when reading them throws; give them memory ones
  'function mem(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}' +
  '["localStorage","sessionStorage"].forEach(function(k){try{window[k].length}catch(e){try{Object.defineProperty(window,k,{value:mem(),configurable:true})}catch(e2){}}});' +
  'try{document.cookie}catch(e){var jar={};try{Object.defineProperty(document,"cookie",{configurable:true,get:function(){return Object.keys(jar).map(function(k){return k+"="+jar[k]}).join("; ")},set:function(v){var p=String(v).split(";")[0],i=p.indexOf("=");if(i>0)jar[p.slice(0,i).trim()]=p.slice(i+1).trim()}})}catch(e2){}}' +
  // the page's own requests go through the proxy too (the site would refuse them from a sandbox)
  'var F=window.fetch;if(F)window.fetch=function(i,o){try{if(typeof i==="string"||i instanceof URL){var a=abs(String(i));if(a&&web(a))i=px(a)}else if(i&&i.url){var b=abs(i.url);if(b&&web(b))i=new Request(px(b),i)}}catch(e){}return F.call(this,i,o)};' +
  'var O=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{var a=abs(String(u));if(a&&web(a))arguments[1]=px(a)}catch(e){}return O.apply(this,arguments)};' +
  'if(navigator.sendBeacon){var SB=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){var a=abs(String(u));return SB(a&&web(a)?px(a):u,d)}}' +
  // pages that change their address without loading (single-page sites): keep the real address and tell Patoogle
  '["pushState","replaceState"].forEach(function(k){var o=history[k];history[k]=function(s,t,u){var a=u!=null?abs(String(u)):null;try{o.call(history,s,t)}catch(e){}if(a){cur=a;var bs=document.querySelector("base[data-patos]");if(bs)bs.href=a;page();setTimeout(page,60)}}});' +
  'function go(a){tell("go",{url:a});location.href=px(a)}' +
  // links: the same page scrolls, a new tab opens a new Patoogle tab, anything else goes through the proxy
  'function link(e){if(e.defaultPrevented)return;var el=e.target&&e.target.closest&&e.target.closest("a[href],area[href]");if(!el)return;var h=el.getAttribute("href");if(!h||/^\\s*javascript:/i.test(h))return;var a=abs(h);if(!a||!web(a))return;' +
  'var t=(el.getAttribute("target")||"").toLowerCase(),nt=e.ctrlKey||e.metaKey||e.shiftKey||e.button===1||(t&&t!=="_self"&&t!=="_top"&&t!=="_parent");if(el.hasAttribute("download"))return;e.preventDefault();' +
  'var c=new URL(cur),n=new URL(a);if(!nt&&n.hash&&n.origin+n.pathname+n.search===c.origin+c.pathname+c.search){var id=decodeURIComponent(n.hash.slice(1)),x=document.getElementById(id)||document.getElementsByName(id)[0];if(x)x.scrollIntoView();return}' +
  'if(nt)tell("open",{url:a});else go(a)}' +
  'document.addEventListener("click",link,false);document.addEventListener("auxclick",function(e){if(e.button===1)link(e)},false);' +
  // forms: a search form loads its results through the proxy; a form that posts is sent through it
  'function form(f){var a=abs(f.getAttribute("action")||cur)||cur,m=(f.getAttribute("method")||"get").toLowerCase();if(!web(a))return false;if(m==="get"){var u=new URL(a);u.search=new URLSearchParams(new FormData(f)).toString();go(u.href);return true}f.setAttribute("action",px(a));f.setAttribute("target","_self");return false}' +
  'document.addEventListener("submit",function(e){if(e.defaultPrevented)return;if(form(e.target))e.preventDefault()},false);' +
  'var FS=HTMLFormElement.prototype.submit;HTMLFormElement.prototype.submit=function(){if(!form(this))FS.call(this)};' +
  'var W=window.open;window.open=function(u){var a=u?abs(String(u)):null;if(a&&web(a)){tell("open",{url:a});return null}return W.apply(window,arguments)};' +
  'document.addEventListener("DOMContentLoaded",page);addEventListener("load",function(){page();setTimeout(page,1500)});' +
  // (a title that changes later, as single-page sites do, is told too)
  'var lastT;function watchTitle(){var t=document.querySelector("title");if(!t||!window.MutationObserver)return;new MutationObserver(function(){if(document.title!==lastT){lastT=document.title;page()}}).observe(t,{childList:true,characterData:true,subtree:true})}' +
  'document.addEventListener("DOMContentLoaded",watchTitle);' +
  '})();</script>';
}
function rewriteHTML(html, final, proxy) {
  // the page's own address for its relative links (an existing <base> counts), and nothing that would undo the sandbox
  let base = final;
  const bm = /<base\s[^>]*href\s*=\s*["']?([^"'\s>]+)/i.exec(html); if (bm) { try { base = new URL(bm[1].replace(/&amp;/g, '&'), final).href; } catch (e) {} }
  html = html.replace(/<base\s[^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv\s*=\s*["']?(content-security-policy|x-frame-options)[^>]*>/gi, '')
    .replace(/<meta([^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']\s*\d+\s*;\s*url=)([^"']+)(["'][^>]*)>/gi, (m, a, u, b) => { try { return '<meta' + a + proxy + '?u=' + encodeURIComponent(new URL(u.replace(/&amp;/g, '&'), base).href) + b + '>'; } catch (e) { return ''; } })
    .replace(/\sintegrity\s*=\s*["'][^"']*["']/gi, '');
  const inject = '<base data-patos href="' + esc(base) + '">' + helper(proxy, final);
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + inject + html.slice(head.index + head[0].length);
  const top = /<html(\s[^>]*)?>/i.exec(html);
  if (top) return html.slice(0, top.index + top[0].length) + '<head>' + inject + '</head>' + html.slice(top.index + top[0].length);
  return inject + html;
}

async function handle(req, res, url) {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors(req, { 'Access-Control-Allow-Methods': 'GET, POST, HEAD, PUT, PATCH, DELETE', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Max-Age': '600' })); return res.end(); }
  // how much it has carried today, and the cap (Patoogle shows it; nothing about who asked for what)
  if (url.searchParams.get('status') === '1') { overBudget(); res.writeHead(200, cors(req, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })); return res.end(JSON.stringify({ on: process.env.PROXY_OFF !== '1', usedMB: Math.round(used / 10485.76) / 100, capMB: budgetMB() })); }
  if (process.env.PROXY_OFF === '1') return page(req, res, 503, 'Not available', 'This PatOS server doesn’t show other websites.');
  if (limited(req)) return page(req, res, 429, 'Slow down a little', 'Too many pages at once. Wait a minute and try again.');
  if (overBudget()) return page(req, res, 503, 'Done for today', 'This PatOS server has shown as many pages as it allows today. It will work again tomorrow.');
  const raw = url.searchParams.get('u') || '';
  const host = String(req.headers.host || '').toLowerCase();
  const proto = (String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()) || (req.socket.encrypted ? 'https' : 'http');
  const proxy = proto + '://' + host + '/api/proxy';
  let target;
  try { target = await check(raw); } catch (e) { return page(req, res, 400, 'This address can’t be opened', e.message === 'Not allowed' ? 'Only public websites can be shown.' : 'That isn’t a web address.'); }
  if (target.url.host.toLowerCase() === host) return page(req, res, 400, 'This address can’t be opened', 'PatOS can’t show itself through itself.');
  let method = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? req.method : 'GET';
  let body = null;
  if (!['GET', 'HEAD'].includes(method)) { try { body = await readBody(req); } catch (e) { return page(req, res, 413, 'Too much to send', e.message); } }
  const dest = String(req.headers['sec-fetch-dest'] || '');
  const navigation = dest === 'document' || dest === 'iframe' || (!dest && /text\/html/.test(req.headers.accept || '') && !req.headers['x-requested-with']);
  // the site the request comes from (the page in Patoogle), so a site's own API sees its own Origin and Referer
  let from = ''; try { const o = new URL(url.searchParams.get('o') || ''); if (/^https?:$/.test(o.protocol)) from = o.origin; } catch (e) {}
  const fwd = (t) => {
    // a short, ordinary set (forwarding everything the browser sends makes some sites suspicious), plus, for a page's own
    // requests, the custom headers its API expects (x-…, client ids, authorization) and its own Origin and Referer. Never cookies
    const h = { 'user-agent': req.headers['user-agent'] || 'Mozilla/5.0', accept: req.headers.accept || '*/*', 'accept-language': req.headers['accept-language'] || 'en', 'accept-encoding': 'gzip, deflate, br', host: t.url.host };
    ['range', 'content-type', 'if-none-match', 'if-modified-since', 'x-requested-with'].forEach((k) => { if (req.headers[k]) h[k] = req.headers[k]; });
    if (!navigation) {
      for (const [k, v] of Object.entries(req.headers)) if ((/^x-/.test(k) && !/^x-(forwarded|real-ip)/.test(k)) || ['authorization', 'client-id', 'csrf-token'].includes(k)) h[k] = v;
      if (from) { h.origin = from; h.referer = from + '/'; }
    }
    if (body && body.length) h['content-length'] = body.length;
    return h;
  };
  let up;
  try {
    for (let hop = 0; ; hop++) {
      up = await upstream(target, method, fwd(target), body);
      const loc = up.headers.location;
      if (up.statusCode >= 300 && up.statusCode < 400 && loc && hop < 8) {
        up.resume();
        // every hop is checked again (a refusal here is about the address, not the site)
        try { target = await check(new URL(loc, target.url).href); } catch (e) { e.refused = true; throw e; }
        if (target.url.host.toLowerCase() === host) { const e = new Error('Not allowed'); e.refused = true; throw e; }
        if (up.statusCode === 303 || ((up.statusCode === 301 || up.statusCode === 302) && method === 'POST')) { method = 'GET'; body = null; }
        continue;
      }
      break;
    }
  } catch (e) { return page(req, res, 502, 'This page didn’t load', e.refused ? 'It sent Patoogle to an address that isn’t a public website.' : 'The site didn’t answer: ' + e.message); }

  const final = target.url.href;
  const ct = String(up.headers['content-type'] || '');
  const headers = cors(req, { 'X-PatOS-URL': final, 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': SANDBOX });
  for (const [k, v] of Object.entries(up.headers)) { const l = k.toLowerCase(); if (!DROP.has(l) && !(l in headers)) headers[l] = v; }

  if (navigation && /text\/html|application\/xhtml/i.test(ct) && method !== 'HEAD') {
    // a page: read it, adjust it, send it
    const parts = []; let n = 0, tooBig = false;
    up.on('data', (c) => { n += c.length; if (n > MAX_HTML) { tooBig = true; up.destroy(); } else parts.push(c); });
    let done = false;
    up.on('error', () => { if (!done && !tooBig) { done = true; page(req, res, 502, 'This page didn’t load', 'The connection to the site broke.'); } });
    up.on('close', () => { if (tooBig && !done) { done = true; page(req, res, 502, 'This page is too big', 'Patoogle can show pages up to 8 MB through PatOS. Open it in its own window instead.'); } });
    up.on('end', () => {
      if (done) return; done = true;
      if (tooBig) return page(req, res, 502, 'This page is too big', 'Patoogle can show pages up to 8 MB through PatOS. Open it in its own window instead.');
      let text;
      try { const buf = decode(Buffer.concat(parts), up.headers['content-encoding']); const cs = charsetOf(ct, buf.slice(0, 2048).toString('latin1')); text = new TextDecoder(cs).decode(buf); } catch (e) { return page(req, res, 502, 'This page didn’t load', 'Patoogle couldn’t read it.'); }
      const out = Buffer.from(rewriteHTML(text, final, proxy), 'utf8');
      ['content-encoding', 'content-length', 'etag', 'last-modified'].forEach((k) => delete headers[k]);
      headers['content-type'] = 'text/html; charset=utf-8'; headers['content-length'] = out.length; headers['cache-control'] = 'no-store';
      count(out.length); res.writeHead(up.statusCode, headers); res.end(out);
    });
    return;
  }
  // anything else (what the page fetches, a download): streamed as it comes, with its own encoding
  let n = 0;
  res.writeHead(up.statusCode, headers);
  up.on('data', (c) => { n += c.length; count(c.length); if (n > MAX_STREAM || overBudget()) { up.destroy(); res.destroy(); } });
  up.pipe(res);
  up.on('error', () => res.destroy());
  req.on('close', () => up.destroy());
}

module.exports = { handle, rewriteHTML, _reset: () => { day = ''; used = 0; hits.clear(); } };
