/* Patoogle's proxy (proxy-server.js): a site that refuses to be shown inside other pages is shown inside Patoogle anyway.
   Real-browser tests against small local sites (allowed only through PROXY_TEST_HOSTS, a test-only list of exact loopback
   addresses): what you see (pictures, styles, the page's own requests), what you do (links, a redirect, search and post forms,
   anchors, new tabs, single-page navigation, Back and Forward), errors and timeouts, the sandbox (a proxied page can't reach
   PatOS's data), SSRF (redirects to private addresses and names, other ports, other schemes), the daily cap and the rate limit,
   and that sites that can be shown directly, YouTube and Proxy off behave as before. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { startServer, browser, boot, skipNoBrowser } = require('../helpers');

let site, sitePort, closedPort, srv, b, ctx, page;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const html = (title, body, deny = true) => ({ type: 'text/html; charset=utf-8', deny, body: '<!doctype html><html><head><title>' + title + '</title><link rel="stylesheet" href="/style.css"></head><body>' + body + '</body></html>' });
function route(req) {
  const u = new URL(req.url, 'http://x');
  switch (u.pathname) {
    case '/': return html('Fixture Home', `
      <h1 id="h">Home</h1><img id="pic" src="/pic.png" width="10" height="10">
      <a id="two" href="/two">Two</a> <a id="jump" href="#bottom">Jump</a> <a id="blank" href="/three" target="_blank">Three</a> <a id="redir" href="/go">Redirect</a>
      <form id="sf" action="/search"><input name="q" value="lisbon trip"><button id="sb">Search</button></form>
      <form id="pf" action="/post" method="post"><input name="msg" value="hello there"><button id="pb">Send</button></form>
      <button id="push" onclick="history.pushState({}, '', '/virtual?x=1'); document.title = 'Virtual page'">Push</button>
      <div id="data">…</div><div id="xhr">…</div><div id="iso">…</div>
      <script>
        fetch('/api/data').then(function (r) { return r.json(); }).then(function (j) { document.getElementById('data').textContent = j.ok; }).catch(function (e) { document.getElementById('data').textContent = 'fail ' + e; });
        var x = new XMLHttpRequest(); x.open('GET', '/api/data2'); x.onload = function () { document.getElementById('xhr').textContent = x.responseText; }; x.send();
        // a hostile page: try to reach PatOS's data
        var r = {};
        try { r.parentPatOS = typeof parent.PatOS; } catch (e) { r.parentPatOS = 'blocked'; }
        try { r.topDoc = !!top.document.body; } catch (e) { r.topDoc = 'blocked'; }
        try { r.ls = localStorage.getItem('patos:settings'); } catch (e) { r.ls = 'blocked'; }
        try { r.cookie = document.cookie; } catch (e) { r.cookie = 'blocked'; }
        try { r.origin = window.origin; } catch (e) { r.origin = 'blocked'; }
        try { var q = indexedDB.open('patos'); q.onsuccess = function () { r.idb = 'opened'; done(); }; q.onerror = function () { r.idb = 'blocked'; done(); }; } catch (e) { r.idb = 'blocked'; done(); }
        function done() { document.getElementById('iso').textContent = JSON.stringify(r); }
        setTimeout(function () { if (!r.idb) { r.idb = 'blocked'; done(); } }, 1500);
      </script>
      <div style="height:3000px"></div><p id="bottom">Bottom</p>`);
    case '/style.css': return { type: 'text/css', body: 'body { color: rgb(1, 2, 3); }' };
    case '/pic.png': return { type: 'image/png', body: PNG };
    case '/two': return html('Page Two', '<p id="p2">Second page</p><a id="home" href="/">Home</a>');
    case '/three': return html('Page Three', '<p>Third</p>');
    case '/go': return { status: 302, location: '/two' };
    case '/search': return html('Results for ' + (u.searchParams.get('q') || ''), '<p id="res">Results: ' + (u.searchParams.get('q') || '') + '</p>');
    case '/api/data': return { type: 'application/json', body: '{"ok":"fetched"}' };
    case '/api/data2': return { type: 'text/plain', body: 'xhr-ok' };
    case '/framable': return html('Framable page', '<p>shown directly</p>', false);
    case '/ssrf-meta': return { status: 302, location: 'http://169.254.169.254/latest/meta-data/' };
    case '/ssrf-local': return { status: 302, location: 'http://127.0.0.1:' + closedPort + '/' };
    case '/ssrf-name': return { status: 302, location: 'http://localhost:' + sitePort + '/' };
    case '/ssrf-v6': return { status: 302, location: 'http://[::ffff:127.0.0.1]/' };
    case '/slow': return { slow: true };
    case '/big': return { type: 'text/html', body: '<!doctype html><title>Big</title>' + 'x'.repeat(9 * 1048576) };
    default: return { status: 404, type: 'text/plain', body: 'nope' };
  }
}
test.before(async () => {
  if (skipNoBrowser) return;
  site = http.createServer((req, res) => {
    const r = route(req);
    if (req.url === '/flaky' && /frame check/.test(req.headers['user-agent'] || '')) { res.writeHead(200, { 'Content-Type': 'text/html', 'X-Frame-Options': 'DENY' }); res.end('<title>x</title>'); return; }
    if (req.url === '/flaky') { setTimeout(() => { try { res.end(); } catch (e) {} }, 5000); return; }
    if (r.slow) { setTimeout(() => { try { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<title>Late</title>'); } catch (e) {} }, 5000); return; }
    if (req.method === 'POST' && req.url === '/post') { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => { res.writeHead(200, { 'Content-Type': 'text/html', 'X-Frame-Options': 'DENY' }); res.end('<title>Posted</title><p id="got">Got ' + new URLSearchParams(d).get('msg') + '</p>'); }); return; }
    const h = {}; if (r.type) h['Content-Type'] = r.type; if (r.location) h.Location = r.location; if (r.deny) h['X-Frame-Options'] = 'DENY';
    res.writeHead(r.status || 200, h); res.end(r.body || '');
  });
  await new Promise((ok) => site.listen(0, '127.0.0.1', ok)); sitePort = site.address().port;
  const tmp = http.createServer(); await new Promise((ok) => tmp.listen(0, '127.0.0.1', ok)); closedPort = tmp.address().port; await new Promise((ok) => tmp.close(ok));
  // the test site, and a port where nothing listens (both listed: "listed" is not enough to make a dead address answer)
  process.env.PROXY_TEST_HOSTS = '127.0.0.1:' + sitePort + ',127.0.0.1:' + (closedPort + 0);
  process.env.PROXY_TIMEOUT_MS = '1500';
  srv = await startServer(); b = await browser();
  ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); page = await ctx.newPage();
  await boot(page, srv.base, { fresh: true });
  await page.evaluate(() => { PatOS.notify = () => {}; });
});
test.after(async () => { delete process.env.PROXY_TEST_HOSTS; delete process.env.PROXY_TIMEOUT_MS; if (ctx) await ctx.close(); if (b) await b.close(); if (srv) srv.stop(); if (site) site.close(); });
const S = () => 'http://127.0.0.1:' + sitePort;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => page.evaluate(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); if (!w) return null; return { omni: w.el.querySelector('.br-omni').value, title: w.title, tabs: w.el.querySelectorAll('.br-tab').length, proxied: !!w.el.querySelector('.br-pane:not([hidden]) iframe.br-proxied, iframe.br-proxied'), back: !w.el.querySelector('[aria-label="Back"], .br-back') || !(w.el.querySelector('[aria-label="Back"], .br-back') || {}).disabled }; });
const frame = () => page.frames().find((f) => f.url().includes('/api/proxy?u=') && !f.isDetached());
// clicks in the proxied page, again if it was being replaced by a new one at that moment
async function clickIn(sel, ms = 10000) { const t0 = Date.now(); let err; while (Date.now() - t0 < ms) { const f = frame(); if (f) { try { await f.click(sel, { timeout: 1500 }); return; } catch (e) { err = e; } } await wait(200); } throw err || new Error('no frame for ' + sel); }
async function until(fn, ms = 8000) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await wait(150); } return v; }

test('a site that refuses frames opens inside Patoogle, with its pictures, styles and own requests', { skip: skipNoBrowser }, async () => {
  await page.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/');
  const st = await until(async () => { const s = await state(); return s && s.title.startsWith('Fixture Home') ? s : null; });
  assert.ok(st, 'the page opened: ' + JSON.stringify(await state()));
  assert.equal(st.omni, S() + '/', 'the address bar shows the real address');
  assert.equal(st.proxied, true);
  const f = frame();
  const look = await until(() => f.evaluate(() => { const i = document.getElementById('pic'); const d = document.getElementById('data').textContent, x = document.getElementById('xhr').textContent; return i.complete && d !== '…' && x !== '…' ? { img: i.naturalWidth, color: getComputedStyle(document.body).color, data: d, xhr: x } : null; }));
  assert.deepEqual(look, { img: 1, color: 'rgb(1, 2, 3)', data: 'fetched', xhr: 'xhr-ok' });
});

test('the proxied page is walled off from PatOS: no PatOS, no storage, no cookies, an opaque origin', { skip: skipNoBrowser }, async () => {
  const f = frame();
  const iso = JSON.parse(await until(() => f.evaluate(() => { const t = document.getElementById('iso').textContent; return t !== '…' ? t : null; })));
  assert.equal(iso.parentPatOS, 'blocked'); assert.equal(iso.topDoc, 'blocked'); assert.equal(iso.origin, 'null');
  assert.equal(iso.ls, null, 'only an empty stand-in storage'); assert.equal(iso.cookie, '', 'only an empty stand-in cookie jar'); assert.equal(iso.idb, 'blocked');
  // and PatOS's own data is still there and untouched
  assert.ok(await page.evaluate(() => !!PatOS.store.get('settings', null) || PatOS.store.keys().length > 3));
  // messages from the page can only open web addresses
  await f.evaluate(() => parent.postMessage({ patosProxy: 'open', url: 'javascript:alert(1)' }, '*'));
  await wait(300);
  assert.equal((await state()).tabs, 1, 'a javascript: address is ignored');
});

test('links, a redirect, anchors, new tabs, single-page navigation, Back and Forward', { skip: skipNoBrowser }, async () => {
  // an anchor on the same page scrolls, the address stays
  await clickIn('#jump'); await wait(400);
  assert.ok(await frame().evaluate(() => scrollY > 1000), 'scrolled to the anchor'); assert.equal((await state()).omni, S() + '/');
  await frame().evaluate(() => scrollTo(0, 0));
  // a link
  await clickIn('#two');
  let st = await until(async () => { const s = await state(); return s.title === 'Page Two' ? s : null; });
  assert.ok(st, 'followed the link: ' + JSON.stringify(await state())); assert.equal(st.omni, S() + '/two');
  // Back and Forward
  await page.evaluate(() => PatOS.wm.windows.find((x) => x.app.id === 'browser').el.querySelector('.br-back, [aria-label="Back"]').click());
  st = await until(async () => { const s = await state(); return s.title.startsWith('Fixture Home') ? s : null; });
  assert.ok(st, 'Back: ' + JSON.stringify(await state())); assert.equal(st.omni, S() + '/');
  await page.evaluate(() => PatOS.wm.windows.find((x) => x.app.id === 'browser').el.querySelector('.br-fwd, [aria-label="Forward"]').click());
  st = await until(async () => { const s = await state(); return s.title === 'Page Two' ? s : null; });
  assert.ok(st, 'Forward: ' + JSON.stringify(await state()));
  await page.evaluate(() => PatOS.wm.windows.find((x) => x.app.id === 'browser').el.querySelector('.br-back, [aria-label="Back"]').click());
  await until(async () => (await state()).title.startsWith('Fixture Home'));
  // a redirect ends on its real address
  await clickIn('#redir');
  st = await until(async () => { const s = await state(); return s.title === 'Page Two' ? s : null; });
  assert.ok(st, 'followed the redirect'); assert.equal(st.omni, S() + '/two', 'the address after the redirect');
  await page.evaluate(() => PatOS.wm.windows.find((x) => x.app.id === 'browser').el.querySelector('.br-back, [aria-label="Back"]').click());
  assert.ok(await until(async () => (await state()).title.startsWith('Fixture Home')), 'Back after a redirect returns to the page before it, not to the redirect: ' + JSON.stringify(await state()));
  // a link that wants a new tab gets a new Patoogle tab
  await clickIn('#blank');
  st = await until(async () => { const s = await state(); return s.tabs === 2 ? s : null; });
  assert.ok(st, 'a new tab: ' + JSON.stringify(await state()));
  await until(async () => (await state()).title === 'Page Three');
  assert.equal((await state()).omni, S() + '/three');
  await page.evaluate(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); w.el.querySelectorAll('.br-tab')[1].querySelector('.br-tx').click(); });
  await until(async () => (await state()).title.startsWith('Fixture Home'));
  // a single-page site changing its address
  await clickIn('#push');
  st = await until(async () => { const s = await state(); return s.omni === S() + '/virtual?x=1' ? s : null; });
  assert.ok(st, 'pushState: ' + JSON.stringify(await state())); assert.equal(st.title, 'Virtual page');
});

test('search forms and forms that post go through and come back', { skip: skipNoBrowser }, async () => {
  await page.evaluate((u) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const o = w.el.querySelector('.br-omni'); o.value = u; o.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, S() + '/');
  await until(async () => (await state()).title.startsWith('Fixture Home'));
  await clickIn('#sb');
  let st = await until(async () => { const s = await state(); return s.title === 'Results for lisbon trip' ? s : null; });
  assert.ok(st, 'search results: ' + JSON.stringify(await state())); assert.equal(st.omni, S() + '/search?q=lisbon+trip');
  await page.evaluate(() => PatOS.wm.windows.find((x) => x.app.id === 'browser').el.querySelector('.br-back, [aria-label="Back"]').click());
  await until(async () => (await state()).title.startsWith('Fixture Home'));
  await clickIn('#pb');
  const got = await until(async () => { const f = frame(); if (!f) return null; try { const e = await f.$('#got'); return e ? await e.textContent() : null; } catch (e) { return null; } });
  assert.equal(got, 'Got hello there');
});

test('errors: a dead address, a slow site, a page too big, a 404, and the history keeps real addresses', { skip: skipNoBrowser }, async () => {
  // (asked as a page load, as Patoogle's frame does: a page's own script can't set Sec-Fetch-Dest, so these go straight from here)
  const get = async (path) => { const r = await fetch(srv.base + '/api/proxy?u=' + encodeURIComponent(path), { headers: { 'Sec-Fetch-Dest': 'iframe', Accept: 'text/html' } }); return { status: r.status, text: (await r.text()).slice(0, 1500) }; };
  const dead = await get('http://127.0.0.1:' + closedPort + '/');
  assert.equal(dead.status, 502); assert.match(dead.text, /didn’t load/);
  const t0 = Date.now(); const slow = await get(S() + '/slow');
  assert.equal(slow.status, 502); assert.match(slow.text, /took too long/); assert.ok(Date.now() - t0 < 4500, 'gave up after the timeout');
  const big = await get(S() + '/big');
  assert.match(big.text, /too big/);
  const nf = await get(S() + '/nowhere');
  assert.equal(nf.status, 404, 'the site’s own status is kept');
  const H = await page.evaluate(() => PatOS.store.get('browserHistory', []).map((x) => x.u));
  assert.ok(H.includes(S() + '/two') && H.includes(S() + '/search?q=lisbon+trip'), 'history has the real addresses');
  assert.ok(!H.some((u) => /\/api\/proxy/.test(u)), 'never the proxy’s');
  // a dead site inside Patoogle shows a page saying so, not a blank tab
  await page.evaluate((u) => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const o = w.el.querySelector('.br-omni'); o.value = u; o.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, S() + '/flaky');
  const shown = await until(async () => { const f = frame(); if (!f) return null; try { return /took too long/.test(await f.textContent('body')) ? true : null; } catch (e) { return null; } }, 9000);
  assert.ok(shown, 'the tab explains it');
});

test('SSRF: private addresses, names, other ports and schemes are refused, also behind a redirect', { skip: skipNoBrowser }, async () => {
  const get = (u) => page.evaluate(async (x) => { const r = await fetch('/api/proxy?u=' + encodeURIComponent(x)); return { status: r.status, text: (await r.text()).slice(0, 600) }; }, u);
  for (const u of ['http://127.0.0.1/', 'http://localhost/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/', 'http://192.168.1.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://0.0.0.0/', 'http://example.com:8080/', 'file:///etc/passwd', 'ftp://example.com/', 'javascript:alert(1)', 'data:text/html,hi', 'http://user:pw@example.com/']) {
    const r = await get(u); assert.equal(r.status, 400, u + ' → ' + r.status + ' ' + r.text.slice(0, 120));
  }
  for (const p of ['/ssrf-meta', '/ssrf-name', '/ssrf-v6']) {
    const r = await get(S() + p); assert.equal(r.status, 502, p); assert.match(r.text, /isn’t a public website/, p);
  }
  // PatOS can't be shown through itself
  const self = await get(srv.base + '/'); assert.equal(self.status, 400);
});

test('Patoogle uses the proxy only when needed: framable sites directly, YouTube in its app, and Proxy off as before', { skip: skipNoBrowser }, async () => {
  const go = (u) => page.evaluate((x) => { const w = PatOS.wm.windows.find((y) => y.app.id === 'browser'); const o = w.el.querySelector('.br-omni'); o.value = x; o.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, u);
  await go(S() + '/framable');
  const direct = await until(() => page.evaluate((u) => { const w = PatOS.wm.windows.find((y) => y.app.id === 'browser'); const f = w.el.querySelector('iframe'); return f && f.getAttribute('src') === u ? { proxied: f.classList.contains('br-proxied') } : null; }, S() + '/framable'));
  assert.deepEqual(direct, { proxied: false }, 'a site that allows frames is shown directly');
  await page.evaluate(() => PatOS.store.set('proxyBrowse', false));
  await go(S() + '/two');
  const off = await until(() => page.evaluate(() => { const w = PatOS.wm.windows.find((y) => y.app.id === 'browser'); return w.el.querySelector('.br-blocked') ? 'blocked page' : null; }));
  assert.equal(off, 'blocked page', 'with the proxy off, the old “doesn’t allow being shown” page');
  await page.evaluate(() => PatOS.store.set('proxyBrowse', true));
  await go('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.ok(await until(() => page.evaluate(() => PatOS.wm.windows.some((w) => w.app.id === 'youtube'))), 'YouTube still opens its app');
  await page.evaluate(() => PatOS.wm.closeAll());
});

test('limits: a daily data cap and a rate limit, and the status shows today’s use', { skip: skipNoBrowser }, async () => {
  const s = await page.evaluate(async () => (await fetch('/api/proxy?status=1')).json());
  assert.equal(s.on, true); assert.equal(s.capMB, 1500); assert.ok(s.usedMB > 0, 'pages were counted: ' + JSON.stringify(s));
  // a server with a tiny cap and a tiny rate
  process.env.PROXY_DAILY_MB = '0.001'; process.env.PROXY_RATE = '6';
  const small = await startServer();
  delete process.env.PROXY_DAILY_MB; delete process.env.PROXY_RATE;
  try {
    const get = async () => { const r = await fetch(small.base + '/api/proxy?u=' + encodeURIComponent(S() + '/'), { headers: { 'Sec-Fetch-Dest': 'iframe' } }); return { status: r.status, text: await r.text() }; };
    const first = await get(); assert.equal(first.status, 200);
    const second = await get(); assert.equal(second.status, 503); assert.match(second.text, /Done for today/);
    let last; for (let i = 0; i < 6; i++) last = await get();
    assert.equal(last.status, 429); assert.match(last.text, /Slow down/);
  } finally { small.stop(); }
});

test('a proxied page can’t flood Patoogle with new tabs', { skip: skipNoBrowser }, async () => {
  await page.evaluate((u) => PatOS.launch('browser', { url: u }), S() + '/');
  await until(async () => { const s = await state(); return s && s.title.startsWith('Fixture Home'); });
  const before = (await state()).tabs;
  await frame().evaluate((u) => { for (let i = 0; i < 30; i++) parent.postMessage({ patosProxy: 'open', url: u + '/three?' + i }, '*'); }, S());
  await wait(800);
  assert.equal((await state()).tabs - before, 1, 'one new tab, not thirty');
  await page.evaluate(() => PatOS.wm.closeAll());
});

test('a search typed in Patoogle stays in Patoogle (Bing’s results through PatOS), with Google one click away', { skip: skipNoBrowser }, async () => {
  const ext = await page.evaluate(() => { window.__ext = []; PatOS.openExternal = (u) => window.__ext.push(u); PatOS.launch('browser'); return true; });
  assert.ok(ext); await wait(600);
  await page.evaluate(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); const o = w.el.querySelector('.br-omni'); o.value = 'lisbon trip ideas'; o.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  const r = await until(() => page.evaluate(() => { const w = PatOS.wm.windows.find((x) => x.app.id === 'browser'); if (!w) return { closed: true }; const f = w.el.querySelector('iframe.br-proxied'); const bar = w.el.querySelector('.br-sbar'); return f ? { src: decodeURIComponent(f.src), omni: w.el.querySelector('.br-omni').value, bar: bar && !bar.hidden } : null; }));
  assert.ok(r && !r.closed, 'Patoogle stays open: ' + JSON.stringify(r));
  assert.match(r.src, /\/api\/proxy\?u=https:\/\/www\.bing\.com\/search\?q=lisbon%20trip%20ideas/);
  assert.match(r.omni, /^https:\/\/www\.bing\.com\/search\?q=lisbon%20trip%20ideas/);
  assert.equal(r.bar, true);
  await page.click('.br-sbar .pg-link');
  assert.match((await page.evaluate(() => window.__ext))[0] || '', /^https:\/\/www\.google\.com\/search\?q=lisbon%20trip%20ideas/);
  await page.evaluate(() => PatOS.wm.closeAll());
});
