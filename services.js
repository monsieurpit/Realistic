/* Small data services for PatOS apps (News and Books). Each one only talks to a fixed list of sites,
   so this is not a general web proxy. */
'use strict';
const { sendJSON } = require('./http-util.js');

const FEEDS = {
  top: ['Top stories', 'https://feeds.npr.org/1001/rss.xml', 'NPR'],
  world: ['World', 'https://www.aljazeera.com/xml/rss/all.xml', 'Al Jazeera'],
  tech: ['Technology', 'https://www.engadget.com/rss.xml', 'Engadget'],
  science: ['Science', 'https://www.sciencedaily.com/rss/top/science.xml', 'ScienceDaily'],
  space: ['Space', 'https://www.space.com/feeds/all', 'Space.com'],
  nasa: ['NASA', 'https://www.nasa.gov/news-release/feed/', 'NASA'],
  hn: ['Hacker News', 'https://hnrss.org/frontpage', 'Hacker News'],
  fr_une: ['À la une', 'https://ici.radio-canada.ca/rss/4159', 'Radio-Canada'],
  fr_presse: ['La Presse', 'https://www.lapresse.ca/actualites/rss', 'La Presse'],
  fr_sport: ['Sports', 'https://ici.radio-canada.ca/rss/771', 'Radio-Canada'],
  fr_science: ['Science', 'https://ici.radio-canada.ca/rss/4175', 'Radio-Canada']
};
const cache = new Map();
async function cached(key, ms, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ms) return hit.v;
  const v = await fn(); cache.set(key, { t: Date.now(), v });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return v;
}
async function get(url, type) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (PatOS; +https://github.com)' }, redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return type === 'json' ? r.json() : r.text();
  } finally { clearTimeout(tm); }
}
const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([\da-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const strip = (s) => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>', 'i')); return m ? m[1] : ''; };

async function news(key) {
  const f = FEEDS[key]; if (!f) throw new Error('Unknown feed');
  return cached('news:' + key, 10 * 60 * 1000, async () => {
    const xml = await get(f[1]);
    const items = [];
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const b of blocks.slice(0, 40)) {
      let link = strip(tag(b, 'link'));
      if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); if (m) link = decode(m[1]); }
      const rawDesc = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content');
      let img = '';
      const m1 = b.match(/<media:(?:thumbnail|content)[^>]*url="([^"]+)"/i) || b.match(/<enclosure[^>]*url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i) || decode(rawDesc).match(/<img[^>]*src="([^"]+)"/i) || decode(tag(b, 'content:encoded')).match(/<img[^>]*src="([^"]+)"/i);
      if (m1) img = decode(m1[1]);
      items.push({ title: strip(tag(b, 'title')), link, desc: strip(rawDesc).slice(0, 400), date: strip(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')), img });
    }
    return { name: f[0], source: f[2], items };
  });
}

async function bookSearch(q, lang) {
  return cached('bs:' + q + lang, 60 * 60 * 1000, async () => {
    const j = await get('https://gutendex.com/books/?search=' + encodeURIComponent(q) + (lang ? '&languages=' + lang : ''), 'json');
    return { items: (j.results || []).slice(0, 32).map((b) => ({ id: b.id, title: b.title, author: (b.authors[0] || {}).name || '', cover: (b.formats || {})['image/jpeg'] || '', downloads: b.download_count, lang: (b.languages || [])[0] })) };
  });
}
async function bookText(id) {
  return cached('bt:' + id, 6 * 60 * 60 * 1000, async () => {
    let t = '';
    try { t = await get('https://www.gutenberg.org/cache/epub/' + id + '/pg' + id + '.txt'); } catch (e) { t = await get('https://www.gutenberg.org/ebooks/' + id + '.txt.utf-8'); }
    // keep only the book itself, without the Project Gutenberg license text
    const s = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i);
    const e = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
    if (s >= 0) t = t.slice(t.indexOf('***', s + 3) + 3, e > s ? e : undefined);
    return { id, text: t.trim().slice(0, 3000000) };
  });
}

/* Can this web page be shown inside another page? Sites say no with the X-Frame-Options header or the
   frame-ancestors rule. We only read those two headers. The page itself never goes through PatOS. */
const dns = require('dns').promises; const net = require('net');
const frameCache = new Map(); const hits = new Map();
/* an IPv6 address as its 8 parts, whatever way it was written (::, ::ffff:1.2.3.4, 0:0:0:0:0:ffff:102:304 …) */
function expandV6(ip) {
  let tail = [];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (dotted) { const o = dotted[1].split('.').map(Number); if (o.some((n) => n > 255)) return null; tail = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]]; ip = ip.slice(0, -dotted[1].length) + '0:0'; }
  const halves = ip.split('::'); if (halves.length > 2) return null;
  const parse = (t) => (t ? t.split(':').map((x) => parseInt(x, 16)) : []);
  const head = parse(halves[0]), rest = halves.length === 2 ? parse(halves[1]) : [];
  if (halves.length === 1 ? head.length !== 8 : head.length + rest.length > 7) return null;
  const parts = halves.length === 1 ? head : head.concat(new Array(8 - head.length - rest.length).fill(0), rest);
  if (parts.some((n) => !(n >= 0 && n <= 0xffff))) return null;
  if (dotted) { parts[6] = tail[0]; parts[7] = tail[1]; }
  return parts;
}
const v4of = (hi, lo) => [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
function privateIP(ip) {
  ip = String(ip).replace(/^\[|\]$/g, '').toLowerCase().replace(/%.*$/, '');
  if (net.isIPv6(ip)) {
    const p = expandV6(ip); if (!p) return true; // anything unreadable is treated as private
    const zero = (a, b) => p.slice(a, b).every((n) => n === 0);
    if (zero(0, 8) || (zero(0, 7) && p[7] === 1)) return true; // :: and ::1
    if (zero(0, 5) && p[5] === 0xffff) return privateIP(v4of(p[6], p[7])); // IPv4-mapped (::ffff:a.b.c.d, in any spelling)
    if (zero(0, 6)) return privateIP(v4of(p[6], p[7])); // old IPv4-compatible (::a.b.c.d)
    if (p[0] === 0x64 && p[1] === 0xff9b) return p[2] === 1 ? true : zero(2, 6) ? privateIP(v4of(p[6], p[7])) : true; // NAT64: the IPv4 inside is checked; 64:ff9b:1::/48 is local-use
    if (p[0] === 0x2002) return privateIP(v4of(p[1], p[2])); // 6to4 carries an IPv4 address too
    if (p[0] === 0x2001 && p[1] === 0) return true; // Teredo
    if (p[0] === 0x2001 && p[1] === 0xdb8) return true; // documentation range, never a real site
    if (p[0] === 0x100 && zero(1, 4)) return true; // discard-only 100::/64
    return (p[0] & 0xfe00) === 0xfc00 || (p[0] & 0xffc0) === 0xfe80 || (p[0] & 0xffc0) === 0xfec0 || (p[0] & 0xff00) === 0xff00; // fc00::/7, fe80::/10, fec0::/10, ff00::/8
  }
  if (!net.isIPv4(ip)) return true;
  const [a, b, c] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && c === 0) || a >= 224;
}
// check an address and return the IP it resolves to; the request then connects to exactly that IP,
// so a second DNS answer (DNS rebinding) can't point it somewhere private
async function safeURL(u) {
  const url = new URL(u); if (!/^https?:$/.test(url.protocol)) throw new Error('Only web addresses');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Port not allowed');
  if (url.username || url.password) throw new Error('Not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let ip, family;
  if (net.isIP(host)) { ip = host; family = net.isIP(host); }
  else { const addrs = await dns.lookup(host, { all: true }); if (!addrs.length || addrs.some((a) => privateIP(a.address))) throw new Error('Not allowed'); ip = addrs[0].address; family = addrs[0].family; }
  if (privateIP(ip)) throw new Error('Not allowed');
  return { url, ip, family };
}
// a GET that only reads the headers, connected to the checked IP (TLS still checks the real host name)
function headersOf(target) {
  const { url, ip, family } = target; const mod = url.protocol === 'https:' ? require('https') : require('http');
  return new Promise((res, rej) => {
    const req = mod.request({ protocol: url.protocol, hostname: url.hostname.replace(/^\[|\]$/g, ''), port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + url.search, method: 'GET', servername: net.isIP(url.hostname) ? undefined : url.hostname,
      headers: { 'User-Agent': 'PatOS/1.0 (frame check)', Accept: 'text/html' }, lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: ip, family }]) : cb(null, ip, family)), timeout: 6000 }, (r) => { res({ status: r.statusCode, headers: r.headers }); r.destroy(); });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', rej); req.end();
  });
}
async function frameable(target, embedder) {
  const key = target + '|' + embedder; const hit = frameCache.get(key);
  if (hit && Date.now() - hit.t < 30 * 60 * 1000) return hit.v;
  let t = await safeURL(target), res = null;
  for (let i = 0; i < 5; i++) {
    res = await headersOf(t);
    const loc = res.headers.location;
    if (res.status >= 300 && res.status < 400 && loc) { t = await safeURL(new URL(loc, t.url).href); continue; } // every hop is checked again
    break;
  }
  const url = t.url; const hdr = (n) => { const v = res.headers[n]; return Array.isArray(v) ? v.join(', ') : v || ''; };
  const xfo = hdr('x-frame-options').toLowerCase(); const csp = hdr('content-security-policy');
  const fa = (csp.match(/frame-ancestors([^;]*)/i) || [])[1]; let ok = true, why = '';
  if (xfo && /deny|sameorigin|allow-from/.test(xfo)) { ok = false; why = 'X-Frame-Options: ' + xfo; }
  if (fa != null) {
    const v = fa.trim().toLowerCase().split(/\s+/); const emb = (embedder || '').toLowerCase();
    const allowed = v.some((x) => x === '*' || x === 'https:' || x === 'http:' || (emb && (emb === x || (x.startsWith('*.') && emb.endsWith(x.slice(1))) || emb.replace(/^https?:\/\//, '') === x)));
    if (!allowed) { ok = false; why = 'frame-ancestors ' + fa.trim(); } else if (!xfo) { ok = true; why = ''; }
  }
  const v = { frameable: ok, reason: why, url: url.href, status: res.status };
  frameCache.set(key, { t: Date.now(), v }); if (frameCache.size > 800) frameCache.delete(frameCache.keys().next().value);
  return v;
}

async function suggest(q, hl) {
  return cached('sg:' + hl + ':' + q, 10 * 60 * 1000, async () => {
    const j = await get('https://suggestqueries.google.com/complete/search?client=firefox&hl=' + encodeURIComponent(hl) + '&q=' + encodeURIComponent(q), 'json');
    return (Array.isArray(j) && Array.isArray(j[1]) ? j[1] : []).slice(0, 8);
  });
}

async function handle(req, res, url) {
  const send = (code, obj) => sendJSON(req, res, code, obj);
  const p = url.searchParams;
  try {
    if (url.pathname === '/api/frameable') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); const now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 60000); h.push(now); hits.set(ip, h); if (hits.size > 5000) hits.clear();
      if (h.length > 90) return send(429, { error: 'Too many checks. Wait a minute.' });
      const embedder = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : '');
      try { return send(200, await frameable(p.get('url') || '', embedder)); } catch (e) { return send(200, { frameable: true, unknown: true, reason: e.message }); }
    }
    if (url.pathname === '/api/suggest') return send(200, await suggest((p.get('q') || '').slice(0, 120), /^[a-z]{2}$/.test(p.get('hl') || '') ? p.get('hl') : 'en'));
    if (url.pathname === '/api/news/feeds') return send(200, Object.entries(FEEDS).map(([k, f]) => ({ key: k, name: f[0], source: f[2] })));
    if (url.pathname === '/api/news') return send(200, await news(p.get('feed') || 'top'));
    if (url.pathname === '/api/books/search') return send(200, await bookSearch((p.get('q') || '').slice(0, 100), /^[a-z]{2}$/.test(p.get('lang') || '') ? p.get('lang') : ''));
    if (url.pathname === '/api/books/text' && /^\d{1,6}$/.test(p.get('id') || '')) return send(200, await bookText(p.get('id')));
    return send(400, { error: 'Bad request' });
  } catch (e) { return send(502, { error: e.message || 'Service didn’t answer' }); }
}
module.exports = { handle, news, bookSearch, bookText, suggest, privateIP, safeURL };
