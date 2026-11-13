# PatOS tests

```
npm test            # everything
npm run test:unit   # server and dictionary checks (no browser needed)
npm run test:browser
```

Browser tests use Playwright with Chromium. If Playwright isn't installed they are skipped:

```
npm i -D playwright && npx playwright install chromium
```

| File | What it checks |
| --- | --- |
| `unit/server.test.js` | files, compression, 304s, private files never served, path tricks, the frame check refusing private addresses |
| `unit/i18n.test.js` | no French key written twice; lists strings that have no French yet |
| `browser/core.test.js` | file system (create, rename, move, copy, trash, restore), saving across restarts (including a reload right after saving), moving old localStorage data, settings defaults |
| `browser/apps.test.js` | every app opens in English, French and on an iPhone (with a way home); window maximize, minimize, restore, close |
| `browser/formats.test.js` | Word, Excel, PowerPoint and zip round trips, the Scanner's PDF, spreadsheet formulas, the Grapher's math |
| `browser/motion.test.js` | one spring for all motion (Calm, Natural, Playful), panels that follow a drag, the photo that flies into the viewer |
| `browser/windows3.test.js` | PatOS 3 windows: the snap layout picker, window groups (same apps, same places) and stage focus (and everything back after) |
| `browser/legal.test.js` | the Terms and Privacy Policy must be read and accepted before anything works (keys blocked too), once per version; Settings shows them from a link at the bottom of its sidebar |
| `browser/glass.test.js` | Liquid Glass: see-through tiers, the Dock's lens, glass titlebars over opaque windows, the menu bar following the wallpaper, Tinted, Reduce transparency and the system preferences, notifications never covering Control Center, buttons and search bars made of the same glass |
| `browser/system.test.js` | starting offline, windows coming back, timers ringing, Spotlight, the phone's back button |
| `browser/timeline.test.js` | Timeline records apps, files, websites, notes and copies; nothing from Passwords or password fields; pause and off; never synced; Alt+V pastes; moments restore after a restart; forget |
| `browser/signature.test.js` | PatOS window controls (drawn glyphs, still close and zoom), the PatOS mark, gliding segmented controls (and none with Reduce Motion), light/dark transition saving at once, the lock screen layout |
| `browser/piles.test.js` | Piles: the Overview (recents, piles by kind, storage, places), the Piles view by kind and date, search inside files with filters, Smart Piles surviving a restart, renaming many files (tags follow, clashes refused), French and phone |
| `browser/handoff.test.js` | Handoff: a note open on an iPhone is offered on a Chromebook through a real sync code, opens with one click, nothing readable on the server; Passwords never handed over; Not now, the switch in Settings, offers older than 30 minutes |
| `browser/iphone-sweep.test.js` | iPhone: every app opens with no errors and no button pushed off the right edge; Messages signed out is not blank; the Notes toolbar fits; YouTube search fits; wide toolbars fade where they scroll; Control Center, banners and Spotlight are readable over the home screen |
| `browser/reliability.test.js` | Core reliability: one error log kept across a reload (never synced); a throwing listener does not stop the others; duplicate listeners run once; apps that fail to start (also asynchronously) show Try Again; closing twice cleans up once; opening and closing apps leaves no listeners, timers or animation loops behind; Weather stays still after closing |
| `browser/liquid.test.js` | Liquid Glass (Task 14): the glass stays exactly as clear (blurs and tints guarded); menus grow out of their control and go back into it; the segmented selection stretches on its way; a press lights the glass from where you press and the light fades after; none of it with Fewer animations |
| `browser/pat.test.js` | Pat (Tasks 42–43): polite and natural asking in English and French; two commands in one message, never cutting a note; search Notes and documents by content, then “open it” / “the second one”; create a document; tidying asks first, moves nothing on a no, and undoes; summaries only use sentences from the text; never says an app opened when it didn’t; hints; explicit skill registry with sensitive skills; context-aware suggestions |
| `browser/proxy.test.js` | Patoogle proxy: sites that refuse frames open inside Patoogle with pictures, styles and their own requests; sandbox isolation from PatOS; links, redirects (and Back after one), anchors, new tabs, pushState, Back/Forward; GET/POST forms; errors and timeouts; SSRF incl. redirects and DNS; framable sites direct, YouTube app, proxy off; daily cap and rate limit; searches stay in Patoogle (see docs/PATOOGLE-PROXY.md) |
| `browser/cloud.test.js` | Cloud Chrome: a real Chrome as the server’s, shown in Patoogle: picture at the exact tab size, clicks, Back/Forward, new-tab links, typing, page alerts, find on page, the network gate (server itself, metadata, private addresses), sleep after idle and start again, a wrong key falls back (see docs/CLOUD-CHROME.md) |
| `unit/budget.test.js` | size budgets from the quality baseline: start-up JavaScript (raw and gzipped), CSS, and big libraries kept out of start-up |
| `browser/widgets40`, `studio40`, `profiles40`, `world40`, `data40`, `gallery40`, `ai40`, `launchpad40` | PatOS 4.0: widgets, Studio, profiles, World, Data, Gallery, the new Pat actions (no model), and Launchpad showing every app (see docs/PATOS-4.0.md) |
| `cloud/live`, `cloud/live-app`, `cloud/commons`, `cloud/commons-app` | PatOS Live and Commons against the real rules in the emulator; the apps with two people, a real WebRTC call |
| other files | `finder`, `windows`, `shortcuts`, `settings`, `security`, `backup`, `sync`, `patapps`, `patdrop`, `studio`, `slither`, `textedit`, `updates`, `perf`, `phone`, `devicelab`, `lazy`, `utilities` cover what their names say; `cloud/` needs the Firestore emulator and runs with `npm run test:cloud` (not part of `npm test`) |

## Quality baseline (not a test)

```
npm run baseline                                   # desktop, Chromebook-class and phone profiles
npm run baseline -- --json docs/baseline/<version>.json
npm run baseline -- --compare docs/baseline/3.0.0-beta7.json
```

Measures start-up, app opening, Spotlight typing, window dragging, storage, big files, memory after opening and closing apps,
network, offline start, accessibility (axe-core) and code run during a smoke tour. Timings depend on the machine: compare
runs made on the same host. See `docs/QUALITY-BASELINE.md`.
