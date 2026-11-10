# PatOS — Master Roadmap: Audit and Status

The governing plan is [`docs/LONG-TERM-ROADMAP.md`](LONG-TERM-ROADMAP.md) (written by Patrick). This file holds the
**Task 1 audit** and the **live status** of the roadmap. It is updated at the end of each authorized task.

- Audit date: 2026-11-09 · PatOS version at audit: **3.0.0 beta 6** (last finished release: 2.3.1)
- Branches: work on `claude/vibrant-volta-skf77u`, mirrored to the default branch `claude/friendly-pasteur-lqz0bz`
- Rule: **one task → complete → test → commit → push → stop → wait for Patrick.**

### How to read the findings

| Mark | Meaning |
| --- | --- |
| **[V]** | Verified by running PatOS (a reproduction or a test on 2026-11-09). |
| **[C]** | Confirmed by reading the code: the cited lines do this. Not necessarily observed as a user-facing problem. |
| **[H]** | Hypothesis: plausible from the code, still to be measured or reproduced (usually in Task 2, 3, 5 or 51). |

---

## 0. Roadmap status

| Task | Status | Notes |
| --- | --- | --- |
| 1. Architecture and quality audit | **Done** (this document) | |
| 2. Quality baseline | **Done** (3.0.0 beta 7) | `npm run baseline`, [`docs/QUALITY-BASELINE.md`](QUALITY-BASELINE.md), size budgets in `test/unit/budget.test.js` |
| 3. Core reliability | **Done**, 3.1.0 beta 3 | Every app opened and closed 4× on a computer and on an iPhone: no listener, timer, bus subscription or DOM node left behind; one animation loop that outlived its window fixed (Weather). One error log (`PatOS.errors`, Terminal `errors`), apps that fail to start (also asynchronously) show why with Try Again, closing twice cleans up once, duplicate bus listeners run once, storage failures no longer all called “Storage is full”. Tests: `test/browser/reliability.test.js` |
| 4–6. Recovery, storage, diagnostics | Not started (Task 4 recommended next) | Groundwork: write journal, session restore, Activity Monitor, the error log from Task 3 |
| 8. Advanced window management | Partly there | Snap layouts picker, window groups, Stage Focus (3.0 beta 1) |
| 11. Spotlight evolution | Largely there | Apps, file names and contents, notes, reminders, contacts, passwords (site/user only), websites, settings, math, units, timers, actions, clipboard. Missing: calendar events, messages, filters, an index |
| 14. Liquid Glass refinement | **Done**, 3.1.0 beta 4 | Same clarity (tints, blurs, lens unchanged and guarded by a test); menus grow out of their control, the segmented selection stretches like a drop of glass, presses light the glass from the touch and tiles swell, concentric menu corners. See `docs/LIQUID-GLASS.md` |
| 13. Design-system audit | Partly there | `css/design.css` tokens and component kit (3.0 beta 1); adoption is uneven across apps |
| 16. Motion system | Partly there | One spring (`PatOS.motion`, 3.0 beta 2) and Flow (`js/flow.js`, beta 6) |
| 41. Privacy controls | Partly there | Timeline: pause, retention, forget; Settings › Privacy for community apps |
| 65. Distinct identity | Partly there | De-macOS app pass (beta 4), signature frame and lock screen (beta 6) |
| 58. Constrained-device performance | **Done (first pass)**, beta 8–9 | Dock magnification −36% main-thread time and no dropped frames on a 4× slower CPU; no blur animations; active-window glow → ring; 3D wallpaper holds during drags. Real-GPU tuning (an adaptive quality step-down) needs real-device numbers (Task 67) |
| 20. Piles (file manager) evolution | **Done**, beta 10 | Overview (recents, piles by kind, storage by kind, places), Piles view (by kind or date, opens in place), search inside files with kind/date/place filters, Smart Piles (saved searches), rename many (replace, add, name + number; tags follow; clashes refused), PatOS sidebar. Not in scope this round: multiple tags per file, column view |
| 62. A unified experience (desktop ↔ mobile) | **Started** in 3.1.0 beta 1 | Handoff: continue on one device what you were doing on the other (app + what is open, via Sync, encrypted; 30-minute window; Passwords excluded; switch in Settings › Privacy) |
| All other tasks | Not started | |

---

## 1. Current architecture

### 1.1 Shape of the codebase (measured)

| Area | Size | Notes |
| --- | --- | --- |
| Core JS (`js/*.js`) | 45 files loaded at start, **1,222 KB** | Biggest: `i18n.js` 209 KB, `shell.js` 98 KB, `icons.js` 69 KB, `core.js` 57 KB, `version.js` 51 KB |
| Apps (`js/apps/*.js`) | 63 files; 54 lazy (**1,025 KB**, loaded on first open) | Biggest: settings 73 KB, sheets 57 KB, browser 57 KB, youtube 52 KB, pitstudio 46 KB, music 46 KB |
| CSS | 12 sheets, **446 KB**, all loaded at start | `office.css` and `apps3.css` hold most app styles |
| Vendor | three.js 670 KB, firebase 603 KB, pitcode 483 KB, pdf.js | Loaded on demand (`type="patos/3d"`, `patos/firebase`, `patos/pit`) |
| Servers | `server.js` + `services.js`, `sync-server.js`, `link-server.js`, `apps-server.js`, `yt.js`, `update-manager.js`, `http-util.js` | Zero-dependency Node `http` |
| Single-file builds | `dist/PatOS.html`, `dist/artifact.html` (3.8 MB each) | Rebuilt and committed on every change (CI checks they are current) |
| Frozen releases | `releases/` 11 versions, **52 MB** | 1.7.0 … 2.3.1, served by the update manager |
| Tests | 44 files, **176 tests** (unit, browser, cloud) | CI runs unit + browser; browser tests may not be skipped in CI |

### 1.2 Start-up and loading
`index.html` → `js/preload.js` reads IndexedDB (the key-value store and the file contents), puts back any write journal left in
localStorage, then injects the scripts in order (`type="patos/js"` eager, `patos/lazy` registered by name through the
generated `js/appmeta.js` and loaded on first launch). `js/boot.js` shows the boot and lock screens; login runs
`PatOS.shell.init()`, the legal gate (`js/legal.js`), session restore (`js/session.js`) and first-run.

### 1.3 Core systems
- **Event bus and settings** (`js/core.js`): `PatOS.on/emit`, `PatOS.settings` with `setSetting` (wrapped by `js/flow.js`
  for view transitions), `PatOS.store` (in-memory KV mirror of IndexedDB; writes batched every 120 ms, journaled to
  localStorage so a closing tab doesn't lose them; `get` returns a deep copy).
- **Virtual filesystem** (`js/core.js`): a tree kept in one KV record `fs`; large contents (data URLs, blobs) live in a
  separate object store and are referenced from the tree; saves are debounced to 250 ms.
- **Window manager** (`js/wm.js`): windows, focus, z-order, minimize (genie), maximize, full screen, snap layouts, groups,
  Stage Focus, the spring motion system.
- **Shell** (`js/shell.js`): menu bar, Dock, Launchpad, Spotlight, Control Center, notifications, desktop icons, Mission
  Control, app switcher, keys, power, theme, glass lens.
- **Design layers**: `css/patos.css` (base), app sheets, `css/glass.css` (Liquid Glass tiers and lens), `css/design.css`
  (type, spacing, component kit), `css/signature.css` (PatOS frame), `css/timeline.css`.
- **i18n** (`js/i18n.js`): English source strings, a French dictionary, plus a page-wide MutationObserver that translates
  text nodes and a few attributes as they appear, except inside a list of 42 skipped selectors.
- **Timeline and clipboard history** (`js/timeline.js`, `js/apps/timeline.js`): local-only activity, moments, clips.
- **Sync and accounts**: `js/sync.js` (end-to-end encrypted records, to the PatOS sync server with a code, or to Firestore
  with a PatOS account), `js/account.js`, `js/backup.js` (snapshots and export), `js/link.js` + `link-server.js` (PatDrop).
- **Apps SDK** (`js/patapps.js`): `.patapp` apps in sandboxed iframes (`allow-scripts`, no same-origin) talking through a
  validated postMessage bridge with per-permission grants; `apps-server.js` hosts the reviewed community store.
- **Code**: PitCode interpreter (`vendor/pitcode.js`), Python through Pyodide in a Web Worker (`js/pyrun.js`).
- **Updates and offline**: `sw.js` keeps each version in its own cache; `update-manager.js` serves `/_v/<version>/...`;
  finished versions are frozen into `releases/` with `scripts/freeze-release.js`; the build stops if a beta is being built
  without the last finished version frozen.

### 1.4 Servers (all in one Node process, `server.js`)
Static files with compression and 304s; `/api/yt/*`, `/api/news`, `/api/books/*`, `/api/suggest`, `/api/frameable`
(services, with private-address blocking), `/api/sync/*`, `/api/link/*`, `/api/apps/*`, `/pyodide/*`, `/api/updates`,
`/_v/*`, `/api/ping`. Data of the sync, link and apps servers is written as JSON files under `PATOS_DATA` (default `./data`).

---

## 2. Existing features and systems
63 app modules, including: Finder, Patoogle (browser), Notes, TextEdit, Write/Tables/Stage/Surveys/Cloud (office), Calendar,
Reminders, Clock, Weather, Music, Radio, Videos, YouTube, Photos, Camera (Photo Booth), Paint, Preview, PDF viewer, Scanner,
Messages, Contacts, Passwords, Terminal, Code Studio, PitStudio, Shortcuts, Pat assistant, App Store and community apps,
PatDrop, Timeline, Settings, Activity Monitor, games (Chess, Solitaire, Sudoku, Slither, Tic-tac-toe, Orb Runner and more),
Grapher, Elements, Flashcards, Journal, Focus, Dictionary, Translate, Books, News, Freeform, Stickies, Voice Memos, Piano,
Studio, Screenshot. System features: Liquid Glass, 3D and drawn wallpapers, widgets, snap layouts, window groups, Stage
Focus, session restore, Timeline, clipboard history, legal gate, Sync, Backup, accounts, phone mode, English and French.

---

## 3. Confirmed strengths
- **Offline-first and safe updates** [C]: versioned caches in `sw.js`, frozen releases, and a build that refuses a broken
  update setup (`build.js`, `update-manager.js#problems`). Finished-version users never receive beta files.
- **Write safety in the browser** [C]: batched IndexedDB writes plus a localStorage journal replayed by `preload.js`; covered
  by `core.test.js` (“saving across restarts, including a reload right after saving”).
- **Server hardening** [C]: SSRF protection with DNS-rebinding defense and IPv6 forms (`services.js:95–132`); request-body
  caps and per-address rate limits on sync, link and apps servers; atomic writes (temp file + rename).
- **Secrets** [C]: Passwords uses AES-GCM with a non-extractable device key, or PBKDF2 (250,000 rounds) from a master password.
- **Sandboxing** [C]: community apps, Code Studio previews and the browser's rendered pages run in iframes without
  `allow-same-origin`; the patapp bridge checks `e.source` and a protocol version.
- **Firestore rules** [C]: default deny; usernames bound to the signed-in email; accounts private; conversations limited to
  members; messages immutable.
- **Tests and CI** [C]: 176 tests; CI builds, checks generated files are committed, and forbids skipped browser tests; a test
  fails the build when a `T('…')` string has no French.
- **Accessibility groundwork** [C]: reduce motion and reduce transparency (system and setting), screen-reader live region
  for notifications, 170 `aria-label`s, focus-visible rings.
- **Privacy by design in new work** [C]: Timeline data is in the sync deny-list, nothing is recorded from Passwords or
  password fields (tested in `timeline.test.js`).

---

## 4. Identified weaknesses (prioritized)

### High
1. **French mode translates the user's own content** [V]. The page-wide translator (`js/i18n.js`, end of file) translates any
   text node that matches a dictionary key unless it sits inside one of 42 skipped selectors. Reproduced: in French, a
   copied text “Delete” is shown in Timeline as “Supprimer”. The same can happen to note titles, file names, website titles,
   messages or clipboard text anywhere not on the skip list (Timeline cards and the Alt+V panel are not on it). It is a
   **deny-list design**: every new view showing user data must remember to opt out. Direction: mark user content explicitly
   (one shared class or `translate="no"`, applied by the components that render user data) and translate only interface
   strings; short-term, add the Timeline/clipboard containers.
2. **The whole filesystem is one record** [C]. `saveFSNow` (`js/core.js:373`) walks and re-serializes the entire tree on every
   change (debounced 250 ms), and text file contents are inline in the tree. Cost grows with the number and size of files;
   an autosaving editor triggers it every few seconds. [H] This becomes noticeable on Chromebooks with large Documents
   folders; a damaged `fs` record would affect every file. → Task 2 (measure), Task 5 (per-node or chunked records with migration).
   **Measured in Task 2:** one edit plus a full save with 1,027 nodes costs 2 ms (desktop) to 14–18 ms (4× slower CPU), so the
   performance side is not a problem at that scale (re-measure at 10,000 files); the single-record integrity risk remains.
3. **Server data may not survive a redeploy** [H]. Sync, PatDrop and app-store data are JSON files under `PATOS_DATA`
   (default `./data`). On Railway the container filesystem is replaced on each deploy unless a volume is mounted; the repo
   has no Railway config saying which. If no volume is attached, code-based sync data and community-app submissions are lost
   on every deploy. → Check the Railway service settings; document the required volume.

### Medium
4. **Reads deep-copy every time** [C]. `PatOS.store.get` returns `structuredClone` of the value (`js/core.js:79`). Hot paths read
   large lists repeatedly: Spotlight reads notes, reminders, contacts, bookmarks and up to 300 history entries on each
   keystroke (`js/shell.js`, `search`); Timeline reads the browser history on every history write. [H] Measurable typing lag
   with big notes collections. **Measured in Task 2:** ≈2 ms per read of 300 notes on a 4× slower CPU: low priority.
5. **Silent failures** [C]. 154 empty `catch (e) {}` blocks across `js/`. Many are deliberate (feature detection), but there is
   no central error log, so real failures disappear. → Task 3 / Task 6. **Task 3:** there is one now (`PatOS.errors`): uncaught
   errors, unhandled promises, throwing listeners, failed app start-ups and failed saves are written down. The deliberate
   empty catches (feature detection) stay.
6. **Listener and timer lifecycle** [C/H]. 589 `addEventListener` vs 69 `removeEventListener`, 48 `setInterval`. Most listeners
   die with their elements, but app code that listens on `document`/`window` or the bus must clean up on close; not
   systematically checked. [H] Leaks after opening and closing apps many times. → Task 3. **Measured in Task 3:** every app
   opened and closed 4× (computer and iPhone): no growth in window/document listeners, intervals, bus listeners or DOM nodes.
   One leak found and fixed: Weather's animation restarted when a forecast arrived after its window closed.
7. **Duplicated expression evaluators** [C]. Five separate `Function('"use strict";return (' + … + ')')` calculators guarded by
   regexes (`shell.js:651`, `browser.js:318`, `terminal.js:92`, `pat.js:129`, `calculator.js:81`), plus the Tables formula
   compiler (`sheets.js:64`, whitelist-based). Each guard is plausible, but five copies means five places to get wrong and
   they block a strict CSP (`unsafe-eval`). → One shared safe evaluator (parser, no `Function`).
8. **Start-up weight** [C]. 1.22 MB of JS and 446 KB of CSS load before login, including the 209 KB French dictionary for
   English users, 51 KB of release notes (`version.js`), and every app's CSS. → Task 2 measures; Task 55 splits.
9. **Very dense files** [C]. 330 lines over 400 characters; `shell.js` (98 KB) holds a dozen subsystems. Hard to review and
   to test in isolation. Refactor only alongside the tasks that touch these areas, never as a big-bang rewrite.
10. **Readability over wallpapers** [V]. Light theme on a dark wallpaper: widget and notification secondary text is hard to read
    (screenshots of 2026-11-09; happens before the beta 6 changes too). → Task 15.

### Low
11. **Repository weight** [C]. `.git` is 79 MB; `releases/` keeps 11 full copies (52 MB); both single-file builds (7.6 MB) are
    rewritten in every commit. Clones and CI get slower over time. Any dedupe must respect the frozen-release rule (Task 69).
12. **Docs drift** [C]. `test/README.md` lacks timeline, signature and other newer test files; `package.json` still says
    “a macOS-style desktop”; the agent instruction files sit in `.github/workflows/` (`Claude.md`, `prompt.md`) although
    `Claude.md` says `prompt.md` is at the repository root, so tools that read a root `CLAUDE.md` never see them.
13. **Timeline on phones** [C]. The left column (calendar, filters, “pick up where you left off”) is hidden in phone mode
    (`css/timeline.css`), leaving only the day view.
14. **Untranslated literals rely on the page translator** [C]. 18 `notify({ title: '…' })` calls pass English literals and work in
    French only because of finding 1's observer; they are invisible to the i18n test.

---

## 5. Technical risks
- **Single points of failure in storage** (finding 2) and **ephemeral server storage** (finding 3) are the two risks with the
  largest blast radius for user data.
- **Global DOM translation** (finding 1) can alter what users see of their own data and costs work on every DOM mutation [H].
- **`setSetting` is now wrapped** by `js/flow.js` for gestures: the value is saved synchronously but listeners run inside a view
  transition (asynchronously). Code that reads the DOM right after a user-initiated theme/accent change sees the old state for
  a frame [C]. Acceptable today; keep it in mind in Task 3.
- **Generated files in Git** (`js/version.js`, `js/appmeta.js`, `dist/`) must be rebuilt in every commit or CI fails [C];
  easy to forget, already enforced by CI.
- **Test environment ≠ production** [C]: cloud tests (`test/cloud/`, Firestore emulator) are not part of `npm test` or CI, so
  rules regressions are not caught automatically.

## 6. Security concerns
| # | Concern | Evidence | Mark |
| --- | --- | --- | --- |
| S1 | No Content Security Policy on the main site (only `frame-ancestors 'self'`) | `http-util.js:13` | [C] |
| S2 | CSP feasibility: hosted scripts load by `src` (good), but `Function()` evaluators need `unsafe-eval`, and many inline `style` attributes need `style-src 'unsafe-inline'` | `preload.js:37–38`, finding 7 | [C] |
| S3 | Pyodide loads from `cdn.jsdelivr.net` without Subresource Integrity when the server copy isn't used | `pyrun.js:7` | [C] |
| S4 | The Python worker removes `indexedDB`, `caches`, `Worker`… from its global scope; whether a program can recover them (prototype, new realm) is unverified, so it must not be described as a hard boundary | `pyrun.js:20` | [H] |
| S5 | Any signed-in user can `list` the whole `usernames` collection (enumeration of all usernames); documented as intended for search | `firestore.rules:16` | [C] |
| S6 | Conversation `get` uses `cid.matches('.*' + uid + '.*')` plus membership; correct but regex-based; review in Task 37 | `firestore.rules:57` | [C] |
| S7 | Many `innerHTML` assignments (306) and `html:` props (282); most render static markup or escaped text, not audited one by one | `grep innerHTML js/` | [H] |
| S8 | Clipboard history keeps copied text (up to 20,000 chars per clip, 150 clips) in IndexedDB unencrypted; excluded from sync, Passwords and password fields; but text copied from elsewhere (e.g. a password shown in plain text in a web page) is kept | `js/timeline.js` | [C] |

No secrets or credentials were found committed (`.env` absent; Firebase web config is public by design; server keys come
from environment variables) [C].

## 7. Performance opportunities
1. Measure before optimizing (Task 2): cold start to lock screen, to desktop, first app open, Spotlight keystroke, autosave
   cost with 100/1,000 files, memory after opening and closing 20 apps, 3D wallpaper frame time.
2. Lazy-load the French dictionary only in French; move release notes out of `version.js` into a fetched file (keeping the
   offline cache) [C → measure].
3. Avoid deep copies on hot reads (read-only accessors or memoized snapshots) [H].
4. Incremental filesystem persistence (finding 2) [H].
5. Split app CSS so only open apps' styles are parsed [H].

## 8. Application-quality findings
- Interiors already redesigned: Camera, Scanner, Settings, Calculator, Clock, Voice Memos, Reminders, Notes, Timeline [C].
  About 50 apps still have their original interiors; several still echo macOS layouts.
- All 63 apps open in English, French and on an iPhone profile (`apps.test.js`) [V], which proves launch, not quality.
- No app-level quality matrix exists yet (functionality, keyboard, mobile, offline, errors). → Task 19.
- Office suite files are the largest app modules; their document compatibility is covered by `formats.test.js` [C].

## 9. Missing or incomplete capabilities
- Central error log and diagnostics (Task 6); recovery center (Task 4).
- Spotlight: calendar events, messages, search filters (Task 11).
- Mobile Timeline layout (finding 13); mobile app layouts in general (Phase 9).
- Firestore rules tests in CI (risk above).
- Documented server-data persistence on Railway (finding 3).
- Architecture documentation (`docs/` has SDK, Firebase, Glass, Updates, Timeline, Signature, but no system overview).

---

## 10. Recommended priorities
Order of the roadmap is kept, with two evidence-based notes:

1. **Task 2 — Quality baseline (recommended next).** Findings 2, 4, 6 and 8 are hypotheses about cost; a repeatable baseline
   (Playwright-driven, reusing `scripts/perf.js` and `test/browser/perf.test.js`) turns them into numbers and targets
   before any optimization.
2. Task 3 (reliability) and Task 5 (storage integrity) next, informed by the baseline; finding 2 is the most important data
   integrity item in the codebase.
3. **Small verified defects that could be fixed when Patrick authorizes them as separate requests** (not done in this task):
   finding 1's short-term fix (exclude Timeline and clipboard views from translation), finding 12 (docs and instruction-file
   locations), and checking the Railway volume for finding 3.
4. Security (Phase 10) should not wait for the end: S1/S2/S3 are cheap to start once the evaluators are unified.

**Next recommended task (after Task 2): Task 3 — Core reliability improvements.** The baseline found no leak in the
open/close cycle, but start-up long tasks (548 ms on the phone profile), 154 silent catches and unchecked listener cleanup
make reliability the next foundation. Performance-specific targets from the baseline (first start on slow CPUs, Timeline and
Notes open time, Spotlight's worst keystroke) are queued for Tasks 55–56.
