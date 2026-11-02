/* Small data services for PatOS apps (News and Books). Each one only talks to a fixed list of sites,
   so this is not a general web proxy. */
'use strict';

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

async function handle(req, res, url) {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
  const p = url.searchParams;
  try {
    if (url.pathname === '/api/news/feeds') return send(200, Object.entries(FEEDS).map(([k, f]) => ({ key: k, name: f[0], source: f[2] })));
    if (url.pathname === '/api/news') return send(200, await news(p.get('feed') || 'top'));
    if (url.pathname === '/api/books/search') return send(200, await bookSearch((p.get('q') || '').slice(0, 100), /^[a-z]{2}$/.test(p.get('lang') || '') ? p.get('lang') : ''));
    if (url.pathname === '/api/books/text' && /^\d{1,6}$/.test(p.get('id') || '')) return send(200, await bookText(p.get('id')));
    return send(400, { error: 'Bad request' });
  } catch (e) { return send(502, { error: e.message || 'Service didn’t answer' }); }
}
module.exports = { handle, news, bookSearch, bookText };
