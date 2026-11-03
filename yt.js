/* YouTube data for the PatOS YouTube app, without an API key.
   The server asks YouTube's own web API for search results, video details, related videos, comments and
   channels, and sends back simple JSON. Videos themselves still play in the official YouTube player
   in the visitor's browser, so nothing here streams video. */
'use strict';
const { sendJSON } = require('./http-util.js');

const BASE = 'https://www.youtube.com/youtubei/v1/';
const VERSION = '2.20250101.00.00';
const cache = new Map(), inflight = new Map();
const FRESH = 10 * 60 * 1000, STALE = 6 * 60 * 60 * 1000;

async function fetchUp(endpoint, body, hl, gl) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(BASE + endpoint + '?prettyPrint=false', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': hl },
      body: JSON.stringify(Object.assign({ context: { client: { clientName: 'WEB', clientVersion: VERSION, hl, gl } } }, body))
    });
    if (!r.ok) throw new Error('YouTube answered ' + r.status);
    return await r.json();
  } catch (e) { throw e.name === 'AbortError' ? new Error('YouTube took too long to answer.') : e; }
  finally { clearTimeout(tm); }
}
function refresh(key, endpoint, body, hl, gl) {
  if (inflight.has(key)) return inflight.get(key);
  const p = fetchUp(endpoint, body, hl, gl).then((v) => { cache.set(key, { t: Date.now(), v }); if (cache.size > 800) cache.delete(cache.keys().next().value); return v; }).finally(() => inflight.delete(key));
  inflight.set(key, p); return p;
}
/* fresh for 10 minutes; after that the old answer is sent at once while a new one is fetched in the background */
async function call(endpoint, body, hl, gl) {
  const key = endpoint + JSON.stringify(body) + hl + gl; const hit = cache.get(key); const age = hit ? Date.now() - hit.t : Infinity;
  if (age < FRESH) return hit.v;
  if (age < STALE) { refresh(key, endpoint, body, hl, gl).catch(() => {}); return hit.v; }
  return refresh(key, endpoint, body, hl, gl);
}

const text = (x) => !x ? '' : typeof x === 'string' ? x : x.simpleText || x.content || (x.runs ? x.runs.map((r) => r.text).join('') : '');
function walk(o, fn, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 40) return;
  if (Array.isArray(o)) { for (const x of o) walk(x, fn, depth + 1); return; }
  if (fn(o) === false) return;
  for (const k in o) walk(o[k], fn, depth + 1);
}
function find(o, test) { let out = null; walk(o, (x) => { if (out) return false; if (test(x)) { out = x; return false; } }); return out; }
const browseId = (o) => { const e = find(o, (x) => x.browseEndpoint && /^UC/.test(x.browseEndpoint.browseId || '')); return e ? e.browseEndpoint.browseId : ''; };
const thumbOf = (id) => 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
const lastThumb = (t) => { const a = (t && (t.thumbnails || t.sources)) || []; const u = a.length ? a[a.length - 1].url : ''; return u.startsWith('//') ? 'https:' + u : u; };

function fromVideoRenderer(v) {
  const badges = JSON.stringify(v.badges || []) + JSON.stringify(v.thumbnailOverlays || []);
  return {
    type: 'video', id: v.videoId, title: text(v.title), channel: text(v.ownerText || v.longBylineText || v.shortBylineText),
    channelId: browseId(v.ownerText || v.longBylineText || v.shortBylineText), thumb: thumbOf(v.videoId),
    duration: text(v.lengthText), views: text(v.shortViewCountText || v.viewCountText), published: text(v.publishedTimeText),
    avatar: lastThumb(v.channelThumbnailSupportedRenderers && v.channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.thumbnail),
    live: /LIVE/.test(badges) && !v.lengthText, desc: text(v.detailedMetadataSnippets && v.detailedMetadataSnippets[0] && v.detailedMetadataSnippets[0].snippetText) || text(v.descriptionSnippet)
  };
}
function fromLockup(l) {
  if (l.contentType && l.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null;
  const md = (l.metadata && l.metadata.lockupMetadataViewModel) || {};
  const rows = ((md.metadata && md.metadata.contentMetadataViewModel && md.metadata.contentMetadataViewModel.metadataRows) || []).map((r) => (r.metadataParts || []).map((p) => text(p.text)));
  const badge = find(l.contentImage, (x) => x.thumbnailBadgeViewModel);
  const av = find(md.image, (x) => x.avatarViewModel);
  const flat = rows.flat();
  return {
    type: 'video', id: l.contentId, title: text(md.title), channel: /view|vue|ago|il y a/i.test((rows[0] || [])[0] || '') ? '' : (rows[0] || [])[0] || '', channelId: browseId(md),
    thumb: thumbOf(l.contentId), duration: badge ? text(badge.thumbnailBadgeViewModel.text) : '',
    views: flat.find((s) => /view|vue|watching|regard/i.test(s)) || '', published: flat.find((s) => /ago|il y a|Streamed|Premiered/i.test(s)) || '',
    avatar: av ? lastThumb(av.avatarViewModel.image) : '', live: badge ? /LIVE|DIRECT/i.test(text(badge.thumbnailBadgeViewModel.text)) : false
  };
}
function fromShort(s) {
  const id = (s.onTap && find(s.onTap, (x) => x.reelWatchEndpoint)) ? find(s.onTap, (x) => x.reelWatchEndpoint).reelWatchEndpoint.videoId : s.videoId;
  if (!id) return null;
  return { type: 'short', id, title: text(s.overlayMetadata ? s.overlayMetadata.primaryText : s.headline), views: text(s.overlayMetadata ? s.overlayMetadata.secondaryText : s.viewCountText), thumb: 'https://i.ytimg.com/vi/' + id + '/oar2.jpg', thumb2: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' };
}
function fromChannel(c) {
  return { type: 'channel', id: c.channelId, title: text(c.title), avatar: lastThumb(c.thumbnail), subs: text(c.videoCountText) || text(c.subscriberCountText), handle: text(c.subscriberCountText), desc: text(c.descriptionSnippet) };
}
function collect(root) {
  const items = [], seen = new Set();
  let cont = '';
  walk(root, (x) => {
    let it = null;
    if (x.videoRenderer && x.videoRenderer.videoId) it = fromVideoRenderer(x.videoRenderer);
    else if (x.gridVideoRenderer && x.gridVideoRenderer.videoId) it = fromVideoRenderer(x.gridVideoRenderer);
    else if (x.compactVideoRenderer && x.compactVideoRenderer.videoId) it = fromVideoRenderer(x.compactVideoRenderer);
    else if (x.lockupViewModel && x.lockupViewModel.contentId) it = fromLockup(x.lockupViewModel);
    else if (x.shortsLockupViewModel) it = fromShort(x.shortsLockupViewModel);
    else if (x.reelItemRenderer) it = fromShort(x.reelItemRenderer);
    else if (x.channelRenderer && x.channelRenderer.channelId) it = fromChannel(x.channelRenderer);
    else if (x.continuationItemRenderer) { const t = find(x.continuationItemRenderer, (y) => y.continuationCommand); if (t) cont = t.continuationCommand.token; return false; }
    else return;
    if (it && it.id && !seen.has(it.type + it.id)) { seen.add(it.type + it.id); items.push(it); }
    return false;
  });
  return { items, cont };
}

async function search(q, hl, gl, cont) {
  const j = await call('search', cont ? { continuation: cont } : { query: q }, hl, gl);
  return collect(j.contents || j.onResponseReceivedCommands);
}

async function home(topics, hl, gl) {
  const list = topics.slice(0, 4);
  const [lists, shorts] = await Promise.all([
    Promise.all(list.map((t) => search(t, hl, gl).then((r) => r.items.filter((x) => x.type === 'video' && !x.live)).catch(() => []))),
    search(list[0] + ' #shorts', hl, gl).then((r) => r.items.filter((x) => x.type === 'short').slice(0, 10)).catch(() => [])
  ]);
  const out = [], seen = new Set();
  for (let i = 0; i < 12; i++) for (const l of lists) { const v = l[i]; if (v && !seen.has(v.id)) { seen.add(v.id); out.push(v); } }
  return { items: out, shorts };
}
/* keep the first screen of YouTube ready so it opens instantly */
function warm() {
  const sets = [['music', 'gaming', 'science', 'comedy'], ['musique', 'jeux vidéo', 'science', 'humour']];
  const run = () => { home(sets[0], 'en', 'CA').catch(() => {}); home(sets[1], 'fr', 'CA').catch(() => {}); };
  run(); const t = setInterval(run, 8 * 60 * 1000); if (t.unref) t.unref();
}

async function video(id, hl, gl) {
  const j = await call('next', { videoId: id }, hl, gl);
  const c = j.contents && j.contents.twoColumnWatchNextResults;
  if (!c) throw new Error('This video isn’t available.');
  const main = c.results.results.contents || [];
  const p = (main.find((x) => x.videoPrimaryInfoRenderer) || {}).videoPrimaryInfoRenderer || {};
  const s = (main.find((x) => x.videoSecondaryInfoRenderer) || {}).videoSecondaryInfoRenderer || {};
  const o = (s.owner && s.owner.videoOwnerRenderer) || {};
  const like = find(p.videoActions, (x) => x.likeButtonViewModel && x.likeButtonViewModel.likeButtonViewModel);
  const likeBtn = like && find(like, (x) => x.buttonViewModel && x.buttonViewModel.iconName === 'LIKE');
  let commentsToken = '';
  const cs = main.find((x) => x.itemSectionRenderer && /comment/.test(x.itemSectionRenderer.sectionIdentifier || x.itemSectionRenderer.targetId || ''));
  if (cs) { const t = find(cs, (x) => x.continuationCommand); if (t) commentsToken = t.continuationCommand.token; }
  const rel = collect(c.secondaryResults);
  const vc = p.viewCount && p.viewCount.videoViewCountRenderer;
  return {
    id, title: text(p.title), views: vc ? text(vc.viewCount) : '', shortViews: vc ? text(vc.extraShortViewCount) || text(vc.shortViewCount) : '',
    date: text(p.dateText), relativeDate: text(p.relativeDateText), likes: likeBtn ? likeBtn.buttonViewModel.title || '' : '',
    channel: text(o.title), channelId: browseId(o.title || o), avatar: lastThumb(o.thumbnail), subs: text(o.subscriberCountText),
    desc: s.attributedDescription ? s.attributedDescription.content : text(s.description),
    related: rel.items.filter((x) => x.type === 'video'), relatedCont: rel.cont, commentsToken
  };
}

async function comments(token, hl, gl) {
  const j = await call('next', { continuation: token }, hl, gl);
  const items = [];
  const muts = (j.frameworkUpdates && j.frameworkUpdates.entityBatchUpdate && j.frameworkUpdates.entityBatchUpdate.mutations) || [];
  muts.forEach((m) => {
    const c = m.payload && m.payload.commentEntityPayload; if (!c) return;
    items.push({
      author: (c.author && c.author.displayName) || '', avatar: (c.author && c.author.avatarThumbnailUrl) || (c.avatar && lastThumb(c.avatar.image)) || '',
      text: (c.properties && c.properties.content && c.properties.content.content) || '', published: (c.properties && c.properties.publishedTime) || '',
      likes: (c.toolbar && c.toolbar.likeCountNotliked) || '', replies: (c.toolbar && c.toolbar.replyCount) || ''
    });
  });
  if (!items.length) walk(j, (x) => {
    if (!x.commentRenderer) return;
    const r = x.commentRenderer;
    items.push({ author: text(r.authorText), avatar: lastThumb(r.authorThumbnail), text: text(r.contentText), published: text(r.publishedTimeText), likes: text(r.voteCount), replies: '' });
    return false;
  });
  let cont = '', count = '';
  walk(j.onResponseReceivedEndpoints, (x) => {
    if (x.commentsHeaderRenderer) count = text(x.commentsHeaderRenderer.countText);
    if (x.continuationItemRenderer) { const t = find(x.continuationItemRenderer, (y) => y.continuationCommand); if (t && !/reply/i.test(JSON.stringify(x).slice(0, 400))) cont = t.continuationCommand.token; return false; }
  });
  return { items, cont, count };
}

async function channel(id, hl, gl, cont) {
  if (cont) { const j = await call('browse', { continuation: cont }, hl, gl); return collect(j.onResponseReceivedActions || j); }
  const j = await call('browse', { browseId: id, params: 'EgZ2aWRlb3PyBgQKAjoA' }, hl, gl);
  const meta = (j.metadata && j.metadata.channelMetadataRenderer) || {};
  const hdr = j.header || {};
  const page = find(hdr, (x) => x.pageHeaderViewModel);
  const rows = page ? JSON.stringify(page.pageHeaderViewModel.metadata || {}) : '';
  const subs = (rows.match(/"content":"([^"]*(subscriber|abonné)[^"]*)"/i) || [])[1] || '';
  const handle = (rows.match(/"content":"(@[^"]+)"/) || [])[1] || '';
  const banner = page ? lastThumb((find(page.pageHeaderViewModel.banner, (x) => x.image) || {}).image) : '';
  const list = collect(j.contents);
  list.items.forEach((x) => { if (!x.channel) { x.channel = meta.title || ''; x.channelId = id; } });
  return { id, title: meta.title || '', desc: meta.description || '', avatar: lastThumb(meta.avatar), banner, subs, handle, items: list.items.filter((x) => x.type === 'video'), cont: list.cont };
}

async function more(token, hl, gl) {
  const j = await call('next', { continuation: token }, hl, gl);
  const r = collect(j.onResponseReceivedEndpoints || j);
  return { items: r.items.filter((x) => x.type === 'video'), cont: r.cont };
}

async function suggest(q, hl, gl) {
  const r = await fetch('https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&hl=' + encodeURIComponent(hl) + '&gl=' + encodeURIComponent(gl) + '&q=' + encodeURIComponent(q));
  const t = await r.text();
  const m = t.match(/\((.*)\)\s*$/s); if (!m) return [];
  try { return JSON.parse(m[1])[1].map((x) => x[0]).slice(0, 10); } catch (e) { return []; }
}

async function handle(req, res, url) {
  const p = url.searchParams;
  const hl = /^[a-z]{2}(-[A-Z]{2})?$/.test(p.get('hl') || '') ? p.get('hl') : 'en';
  const gl = /^[A-Z]{2}$/.test(p.get('gl') || '') ? p.get('gl') : 'CA';
  const send = (code, obj) => sendJSON(req, res, code, obj);
  const id = p.get('id') || '';
  try {
    const what = url.pathname.replace('/api/yt/', '');
    if (what === 'search' && (p.get('q') || p.get('cont'))) return send(200, await search((p.get('q') || '').slice(0, 200), hl, gl, p.get('cont')));
    if (what === 'home') return send(200, await home((p.get('topics') || 'music,gaming,science').split(',').map((s) => s.trim().slice(0, 60)).filter(Boolean), hl, gl));
    if (what === 'video' && /^[\w-]{11}$/.test(id)) return send(200, await video(id, hl, gl));
    if (what === 'comments' && p.get('token')) return send(200, await comments(p.get('token'), hl, gl));
    if (what === 'channel' && (/^UC[\w-]{22}$/.test(id) || p.get('cont'))) return send(200, await channel(id, hl, gl, p.get('cont')));
    if (what === 'more' && p.get('token')) return send(200, await more(p.get('token'), hl, gl));
    if (what === 'suggest' && p.get('q')) return send(200, await suggest(p.get('q').slice(0, 100), hl, gl));
    return send(400, { error: 'Bad request' });
  } catch (e) {
    return send(502, { error: e.message || 'YouTube didn’t answer' });
  }
}

module.exports = { warm, handle, search, video, comments, channel, home, suggest, more };
