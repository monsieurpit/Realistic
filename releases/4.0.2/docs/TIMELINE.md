# Timeline

PatOS remembers what you do so you can find it again and pick up where you left off.

| Piece | File | What it does |
| --- | --- | --- |
| Recorder | `js/timeline.js` | Listens to `wm:open`, `fs`, `store:set` (browser history, notes), `copy`/`cut` and `navigator.clipboard.writeText`; keeps moments of open windows via `PatOS.session.current()` |
| App | `js/apps/timeline.js`, `css/timeline.css` | Day view (hour ribbon, cards along a line), month heat calendar, filters, search with day words ("yesterday", "monday", "this week", French too), restore moments |
| Clipboard panel | `js/timeline.js` | Alt+V anywhere; Enter or 1–9 pastes into the field that had focus; pin, remove |
| Session helpers | `js/session.js` | `current()` lists open windows, `reopen(list)` puts them back (also used at startup) |

## Why this feature
Research (Nov 2026): the parts people say they miss or use most are a fast command bar with clipboard history (Raycast, Arc),
Recall's *search* (reviewers found the timeline search the only part they used, and disliked screenshots), and ChromeOS's
"reopen where you left off". Timeline puts those together without screenshots and without anything leaving the device.

## Privacy rules (tested in `test/browser/timeline.test.js`)
- Store keys `timeline`, `timelineMoments`, `clipHistory`, `timelinePause` are in the sync DENY list: never synced.
- Never recorded: Passwords, the Timeline itself, setup, launchpad; copies from password fields.
- Pause (1 hour, until tomorrow), off switch, retention (7/30/90/365 days), forget last hour / today / everything / one item.
- Settings: `timeline`, `timelineClips`, `timelineDays` (Settings › Privacy).
