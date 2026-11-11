# Cloud Chrome: a real Chrome on your PatOS server, inside Patoogle

With Cloud Chrome on, every website you open in Patoogle runs in a real Chrome on your Railway server and is shown live in the
tab. You click, scroll, type and paste in Patoogle; the Chrome on the server does it. Every site works as it does in Chrome
(apps like Twitch, X or Spotify included), because it is Chrome. Without it, Patoogle works as before (the proxy for sites
without a login, and sites you sign in to in their own window).

## Turn it on (Railway)
1. **Chrome on the server.** Nothing to do if Railway builds PatOS with Railpack (its current builder): `railpack.json` in the
   repository installs `chromium`, fonts, and PulseAudio and ffmpeg for sound. With the older Nixpacks builder, `nixpacks.toml` does the same. If Chrome still
   isn't found, add the service variable `RAILPACK_DEPLOY_APT_PACKAGES=chromium` (or set `CHROME_PATH` to Chrome's path).
2. **A key.** In Railway › your service › Variables, add `CLOUD_BROWSER_KEY` with a password of at least 8 characters. Only
   someone with this key can use Cloud Chrome, so strangers who find your PatOS address can't use your server.
3. **Stay signed in (optional).** Chrome's profile (your cookies and sign-ins) is kept in `PATOS_DATA/cloud-chrome`. A
   redeploy erases it unless that folder is on a Railway volume: add a volume, and set `PATOS_DATA` to its mount path.
4. Redeploy. Then in Patoogle: **••• › Cloud Chrome…**, type the same key, and press Turn on. Each device asks once (the key
   is kept with your other PatOS settings and synced, encrypted, to your other devices).

`/api/cloud/status` says whether the server found Chrome and has a key.

## How it behaves
- **Starts when needed, stops when not**: Chrome starts with the first Cloud Chrome tab and stops after `CLOUD_IDLE_MIN`
  minutes (default 5) with no Patoogle watching, or 30 minutes with nobody touching it. Patoogle then shows "Cloud Chrome went
  to sleep" with a button to wake it (the page comes back at the same address).
- **The connection**: one live WebSocket per tab: pictures come as images, your clicks, taps and keys go out at once and in
  order (several moves become one, scroll steps add up). A picture is skipped when the connection is still busy with the last
  ones, so you always see the newest page, never a backlog. If a network blocks WebSockets, it falls back to a stream plus a
  request per batch of input.
- **The picture**: Chrome photographs the page about 15 times a second while you interact and while a video plays, once a
  second otherwise; identical pictures aren't sent. Scrolling moves the picture on your screen at once, before the new one
  arrives. Chrome's page is the exact size of the tab.
- **On a phone**: sites get their phone layout, and your finger is real touch (taps, presses, the page's own scrolling); the
  keyboard button in the address bar brings up the keyboard.
- **What works**: links, buttons, forms, typing, paste (Ctrl+V), copy (Ctrl+C copies the page's selection into your clipboard),
  right-click, double-click, the mouse wheel with a little glide on touchscreens, Back/Forward/Reload, new-tab links and pop-ups,
  page dialogs, find on page (Ctrl+F), zoom, History, **sound** (when the server has PulseAudio and ffmpeg: an MP3 stream that
  starts with your first click, with a speaker button to mute), **uploading files** (a page's file box opens your own file
  picker), **dropping files** on a page, and **downloads** (saved into PatOS's Downloads folder).
- **Limits**: sound arrives about a second late; video is about 15 pictures a second, not 30; uploads up to `CLOUD_UPLOAD_MB`
  (50), downloads up to `CLOUD_DOWNLOAD_MB` (200).
- **YouTube** still opens the YouTube app (with sound).

## Signing in
You sign in inside Cloud Chrome as on any computer. Google sees the sign-in coming from your server (a datacenter in
Railway's region), so it may ask for extra checks, and some accounts (often school or work accounts) refuse it ("This browser
or app may not be secure", "your organization doesn't authorize…"). That is the account's own rule and can't be changed from
PatOS; the Open outside button opens the page in your own browser, where you are already signed in.

## Safety and limits
- **Only you**: every request needs the key (compared in constant time; 20 wrong tries a minute per address are refused).
- **Not a way into the server**: all of Chrome's traffic goes through a gate in `cloud-browser.js` that allows only public
  addresses on ports 80 and 443 (the same checks as Patoogle's proxy: private, loopback, link-local and cloud-metadata ranges are
  refused, the connection is pinned to the checked address). Chrome can't reach PatOS's own server either.
- **Your data**: Chrome's profile stays on your server; nothing is sent anywhere else. PatOS doesn't log what you visit.
- **Cost**: Chrome uses about 300–600 MB of memory while it runs. Limits: `CLOUD_MAX_TABS` (8), `CLOUD_DAILY_MB` (4000 MB of
  pictures and web traffic a day), `CLOUD_IDLE_MIN` (5). Check Railway's usage page for what it costs on your plan.
- Settings: `CLOUD_JPEG` (picture quality, 62), `CLOUD_LANG` (Chrome's language, en-US).

## Tests
`test/browser/cloud.test.js` runs a real Chrome as the server's against local test sites: the picture (exact size, real
pixels), clicks, Back/Forward, a new-tab link, typing with Backspace, a page alert, find on page, the gate (the server itself,
cloud metadata, a private address), going to sleep and starting again, a wrong key (the page opens without Cloud Chrome and
PatOS says why).
