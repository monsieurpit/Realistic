# PatOS 4.0 "Beyond the desktop": final report

Status: **4.0.0 beta 14**. It's a beta, and stays one until you decide to release it. The architecture is in
[PATOS-4.0.md](PATOS-4.0.md).

## A. What was built

| Beta | What |
| --- | --- |
| 1 | **Widgets**: desktop dashboard, 13 built-in widgets, edit mode, 3 sizes, a process per widget, third-party widgets in a sandboxed iframe with permissions, Studio widgets (blocks, no code) |
| 2 | **Desktop configurations** (validated, 10 versions, panels, menus, keyboard shortcuts) and **Profiles** (separate environments with their own settings, widgets and windows) |
| 3 | **PatOS Studio**: visual editor for the whole desktop, with preview, keep or revert, import and export |
| 4 | **PatOS World**: infinite boards (stickies, files, links, notes, widgets, apps, collections, zones that move files after a yes, pinned real windows), drawing only what is on screen |
| 5 | **PatOS Data**: deterministic relationship engine (reasons for every link, collections, history, graph, privacy controls) |
| 6 | **Gallery**: visual collections, 5 layouts, present mode, following a folder or a Data collection, sharing without file paths |
| 7 | **PatOS AI** (no model): files by when you used them, everything about a subject, prepare the desktop, duplicates (trashed only after a yes, undoable), notification summary, automations from words, app capabilities, a transparent history |
| 8 | **PatOS Live**: presence, boards, live notes, tasks and voice in a Shared Space, with revision-checked writes (a clash keeps both versions). Launchpad shows every app again |
| 9 | **PatOS Commons**: communities, posts, events, showcases, challenges, profiles, follows, likes, reports, bans, blocks |
| 10 | Lag fix: no rainbow lens on desktop widgets (the bend and bevel are kept) |
| 11 | Commons redesigned on the design system; **the Pill completed** (weather, Music favourites and up next, copy speed), moved from 4.1 |
| 12 | Profile switcher in the menu bar |
| 13 | **Faster on slow Chromebooks** (measured: 79% less idle processor work, 122 → 34 graphics layers) |
| 14 | **Search inside everything** (moved from 4.1): Spotlight, Piles and Pat find the words inside, with the passage |

## B. Architecture

See [PATOS-4.0.md](PATOS-4.0.md) for how the parts fit together:
- the action model, item keys and schemas;
- each part's files;
- Live's conflict handling and voice signaling;
- the security rules;
- storage and sync;
- the search index;
- the speed measurements.

## C. What was kept working

- The App Store, Sync (new device-only keys are excluded), backups and process isolation, so every widget is a process.
- Liquid Glass transparency is unchanged. The lens bend is kept on widgets; only the rainbow edge was removed there.
- The 3D Studio app: it was overwritten once by mistake and restored from git, and the new editor is a separate app
  (`deskstudio`).
- The released 3.3.0 stays frozen in `releases/3.3.0`, and no beta was published as a finished version.

## D. Testing (honest)

- **Unit:** 44 tests, all passing.
- **Browser (full suite):** see the result filled in below.
- **Cloud (Firebase emulator, with the real rules):** Spaces, accounts, rules and Live/Commons, all passing at their last
  run.
  - The Live app test uses two people and a real WebRTC call with Chromium's pretend microphone.
  - The Commons app test also uses two people.
- **Flaky tests seen:** Capture, a Cloud Chrome video-speed test, a Liquid Glass segmented-control animation, PatDrop,
  and Control Center's small-drag spring-back. Each passed on its own, and they failed only under the load of the full
  run (timing). They were not changed.
- **Speed:** measured with a processor slowed 6×, the median of 3 runs. Graphics-chip costs were measured as layer
  counts, not frame times, because the headless browser renders in software.
- **Not tested on your actual Chromebook.** Please tell me what still feels slow there.

## E. Security

- Firestore rules enforce:
  - roles in Spaces and Communities;
  - next-revision writes for everything shared that people edit;
  - signed authorship (`by`, `byName`, server time);
  - field whitelists and size limits;
  - the Commons posting rate limit (20 s);
  - private reports;
  - bans, and blocks that remove follows and prevent new ones;
  - voice signals readable only by their two people.
- Nothing shared is code. Desktops, galleries and widgets are data, validated again on the device before use; a shared
  desktop is previewed and can be reverted.
- Third-party widgets run in `sandbox="allow-scripts"` iframes with a CSP, and reach PatOS only through granted
  permissions.
- No AI model is used anywhere. Pat, Data and search are deterministic.
- **To do on your side:** publish `firestore.rules` in the Firebase console. Live and Commons need it.

## F. Known limits

- Voice has no TURN relay, so two strict networks may not connect. Video calls are planned for 4.1.
- Commons has no reply notifications, no image uploads (the free Firebase plan has no file storage), and Discovery shows
  the newest 100 public communities.
- Data and search compare words, not meanings.
- Weather alerts come from the forecast, not official alerts.
- The search index is in memory: it is rebuilt after each start, in the background.

## G. Release status

**4.0.0 beta 14**, on both branches. It becomes the finished 4.0.0 only when you say so.
