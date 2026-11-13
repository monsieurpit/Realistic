# Patoogle: websites inside Patoogle (the proxy)

Most websites tell browsers "don't show me inside another page" (`X-Frame-Options`, CSP `frame-ancestors`), and no web page can
override that. So when a site refuses, Patoogle asks the PatOS server for the page (`/api/proxy`, `proxy-server.js`): the server
fetches it, removes those headers, adds a small script, and Patoogle shows it inside the tab. Sites that allow being shown are
still shown directly (faster, with their own cookies). YouTube still opens the YouTube app.

## How it works
- Patoogle first asks `/api/frameable` whether the site can be shown directly. If not (or if it is on the known list in
  `js/apps/browser.js`), it loads `/api/proxy?u=<address>` in a sandboxed frame.
- The server returns the page with a `<base>` pointing at the real site, so **pictures, styles, scripts and fonts load straight
  from the site**: only the page itself and the page's own requests (fetch, XHR, forms) pass through the server.
- The added script, inside the page: keeps links, forms, `window.open`, fetch/XHR and single-page navigation (`pushState`)
  going through the proxy, scrolls same-page anchors, asks Patoogle for a new tab when a link wants one, and tells Patoogle the
  real address and title. Patoogle keeps Back/Forward and History with real addresses; a redirect replaces the address it came
  from, as browsers do.
- **Searches typed in Patoogle stay in Patoogle** when the proxy is available: Bing's results, shown through PatOS, every result
  opening in the tab, with "Search on Google instead" (Google's results page does not work through a server; see below).
- Settings: the store key `proxyBrowse` (default on). Off, or without a PatOS server (a downloaded copy, a Claude Artifact),
  Patoogle behaves as before: the "doesn't allow being shown" page and its own window.

## Safety
- **Sandbox**: every proxied page is served with `Content-Security-Policy: sandbox …` (no `allow-same-origin`) and shown in an
  iframe with the same sandbox, so it has an **opaque origin**: it can't read PatOS's storage, IndexedDB, cookies or files, or
  touch the PatOS window, even though it comes from PatOS's address. It gets empty stand-ins for `localStorage`/`document.cookie`
  so sites that read them don't crash. Every PatOS `message` listener checks which frame sent a message; Patoogle accepts only
  web addresses from proxied pages, and at most one new tab a second (20 in all) per page.
- **SSRF**: only `http`/`https` on ports 80/443, no credentials in the address; the name is resolved once, every resolved address
  must be public (private, loopback, link-local and cloud-metadata ranges, IPv4-mapped/NAT64/6to4/Teredo forms are refused), and
  the connection is pinned to the checked IP (no DNS rebinding). **Every redirect is checked again.** PatOS can't proxy itself.
- **Privacy**: no cookies are kept or forwarded, nothing is written to disk or logged. Request headers are a short ordinary set
  (forwarding everything made some sites suspicious); a page's own requests also carry the custom API headers they set and their
  site's `Origin`/`Referer`.
- **Limits (Railway)**, environment variables:
  - `PROXY_DAILY_MB` (default 1500): data the proxy may carry per day; after that it answers "Done for today" until tomorrow.
  - `PROXY_RATE` (default 600): requests per minute per address.
  - `PROXY_OFF=1`: turns it off.
  - Per request: 20 s timeout (`PROXY_TIMEOUT_MS`), pages up to 8 MB, a sent form up to 2 MB, streams up to 200 MB.
  - `/api/proxy?status=1` shows today's use and the cap.
  - `PROXY_TEST_HOSTS` is for the tests only (exact `127.0.0.1:port` pairs); never set it on a real server.

## Measured (3.1.0 beta 6, headless Chromium, the test container's network)
- Server cost: 62 MB idle; 84 MB at most with 10 large pages (320 KB each) at once; 30 such pages took under 0.1 s of work.
- Data through the server per page: 0.2–1.8 MB for the real sites below (the page and its own API calls; pictures etc. load
  directly). The default cap is therefore roughly 1,000+ pages a day. Check Railway's usage page for what that costs on your plan.

| Site | Result |
| --- | --- |
| GitHub | Works: page, pictures, links (Pricing) |
| Amazon | Works: 35/36 pictures, links |
| Apple | Works: 49/49 pictures, links and redirects (Store) |
| MDN Web Docs | Works, links |
| Discord (website) | Works, links (the chat app itself needs a login: no) |
| LinkedIn (public pages) | Works, links (signing in: no) |
| Netflix (home page) | Works, links (watching: no, needs a login and DRM) |
| Microsoft | Partly: the header and pictures, part of the page stays empty |
| Bing search | Works: 10 results, they open in the tab |
| Wikipedia, BBC, New York Times, IMDb | Allow frames: shown directly, as before |
| Twitch, X (Twitter), Spotify, Roblox, DuckDuckGo (main site) | **Don't work**: big single-page apps that don't start inside the sandbox |
| Google search | **Doesn't work** through a server (a blank page); searches use Bing, with "Search on Google instead" |
| Canva, Khan Academy, Stack Overflow, DuckDuckGo (HTML) | **Bot checks** (Cloudflare and similar) refuse server addresses; they may also refuse Railway |
| Reddit, CNN | Not tested: blocked by the test container's own network policy |

## Not supported
- **Logins and anything that needs cookies** (accounts, carts, chats). Those sites still open in their own window.
- **Big single-page apps** that fail inside a sandbox (opaque origin, no real storage, no service worker).
- **WebSockets** go straight to the site (and usually fail from a sandbox): live chats, live video, multiplayer.
- **Bot checks** from datacenter addresses.
- `location.assign`/`location.href = …` to an absolute address on the site itself leaves the proxy (browsers don't let a page
  change how `location` works); the next page shows the "refused to connect" frame. Links and forms are handled.

## Tests
`test/browser/proxy.test.js` (real Chromium, local test sites): pictures, styles and the page's own requests; the sandbox (no
PatOS, no storage, no cookies, opaque origin, `javascript:` refused, no tab flood); links, a redirect and Back after it, anchors,
new tabs, `pushState`, Back/Forward; GET and POST forms; a dead address, a slow site, a page too big, a 404, real addresses in
History; SSRF (14 refused addresses, redirects to metadata, `localhost` and IPv4-mapped IPv6); framable sites directly, YouTube
in its app, the proxy off; the daily cap and the rate limit; searches staying in Patoogle.
