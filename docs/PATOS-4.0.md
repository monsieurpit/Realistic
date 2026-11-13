# PatOS 4.0: Beyond the desktop (architecture)

PatOS 4.0 adds nine parts that work together. None of them uses an AI model: everything is fixed rules you can read,
and every claim below is covered by a test (listed at the end).

## How the parts fit

```
                         ┌──────────── Studio (deskstudio) ─────────────┐
                         │ edits a desktop configuration (patos.desktop/1)│
                         └───────────────┬───────────────────────────────┘
                                         │ validate / apply / save (js/desk.js)
  Widgets (js/widgets.js) ◄──────────────┤
  Profiles (js/profiles.js) ── each profile keeps its own settings, widgets, panels, menus, shortcuts and windows
                                         │
  Data (js/data.js) ── one index of files, notes, events, reminders, captures, worlds; links with reasons
     ▲      ▲      ▲
     │      │      └── Gallery (collections follow a Data collection or a folder)
     │      └───────── World (an infinite board; Data collections as items)
     └──────────────── PatOS AI (js/intel-40.js: "everything related to biology")
  Shared Spaces (js/spaces.js, 3.3) ── membership and roles
     ├── Live (livespace): presence, boards, live notes, tasks, voice
     └── (separate) Commons (commons): communities, posts, showcases of desktops, galleries and widgets
```

Start-up code (always loaded): `widgets.js`, `desk.js`, `profiles.js`, `data.js`, `intel-40.js`. The apps (Studio, World,
Data, Gallery, Live, Commons) load only when opened (`patos/lazy`). Their APIs (`PatOS.world`, `PatOS.gallery`) load the app
file the first time they are used.

## Shared foundations

- **One action model** (`PatOS.desk.runAction`): `{ kind: 'app' | 'shortcut' | 'url' (https only) | 'file' | 'profile' |
  'world' | 'widgets' }`. Panels, menus, keyboard shortcuts and widget buttons all use it, and every action is checked
  (`cleanAction`) before it is saved.
- **One item key** for things PatOS knows: `file:/path`, `note:id`, `event:day:id`, `reminder:id`, `capture:id`, `world:id`.
- **Schemas** for everything that is imported or shared, validated before use: `patos.desktop/1`, `patos.widget/1` (third-party
  widget, sandboxed iframe), `patos.studiowidget/1` (blocks only, never code), `patos.profile/1`, `patos.gallery/1`.
- **Processes**: every widget runs in a process (`PatOS.proc.forApp`), so Activity Monitor shows it and quitting it frees it.

## The nine parts

| Part | Files | What it is |
| --- | --- | --- |
| Widgets | `js/widgets.js` | Desktop dashboard: 13 built-in widgets, edit mode, three sizes. Third-party widgets in a sandboxed iframe (`sandbox="allow-scripts"`, CSP) reach PatOS only through permissions you grant. Studio widgets are blocks (text, value, button, image). |
| Studio | `js/desk.js`, `js/apps/deskstudio.js` | A visual editor for the whole desktop: widgets, panels, look, Dock, menus, shortcuts. Preview, then keep or revert. Versions (10 kept), duplicate, import and export `.patdesk`. |
| Profiles | `js/profiles.js` | Separate environments (School, Work…): each keeps its own wallpaper, theme, Dock, widgets, panels, menus, shortcuts, notification rules and open windows. Export and import `.patprofile`. The active profile is per device and never synced. |
| World | `js/apps/world.js` | Infinite boards: stickies, files, links, notes, widgets, apps, Data collections, zones that move files when you drop them in (after a yes), groups, and real windows pinned onto the board. Only what is on screen is drawn. |
| Data | `js/data.js`, `js/apps/data.js` | Finds what goes together, with fixed rules and a reason for each link: linked by you, shared #tags, one names the other, distinctive words in common, same folder, same day. Collections, history, graph. You can remove links, mark things private, leave folders out or turn it off. The index stays in memory and is never uploaded. |
| Gallery | `js/apps/gallery.js` | Visual collections in five layouts. Present mode. They can follow a folder or a Data collection. A shared copy carries small previews and titles, never your paths. |
| PatOS AI | `js/intel-40.js` (+ `intelligence.js`, `pat.js`) | New Pat actions in the Intelligence registry: files by when you used them, everything related to a subject, prepare the desktop, duplicates, notification summary, automations from words. World and Gallery offer their own actions. The history shows what was understood, each step's result, and your yes or no. **No language model.** |
| Live | `js/apps/livespace.js`, cloud layer | Inside a Shared Space: who is here, boards, live notes (one block per paragraph), tasks, voice (WebRTC, up to 4 people). |
| Commons | `js/apps/commons.js`, cloud layer | Communities, public or private: posts, announcements, events (to Calendar), challenges and entries, showcases (desktops, galleries, Studio widgets), profiles, follows, likes, reports, bans, blocks. |

## The PatOS Pill, completed (moved from 4.1 to 4.0)

- **Weather** (`js/widgets.js` shares one open-meteo request every 20 minutes with the Weather widget): the temperature in
  the Pill's overview. In the capsule: rain or snow coming within the hour (15-minute steps), and thunderstorms, freezing
  rain, heavy rain or snow, or strong wind (gusts of 70 km/h or more) in the next 6 hours. These come from the forecast,
  and the Pill says so: open-meteo gives no official alerts. Settings › Pill › Weather in the Pill turns it off.
- **Music**: a Favourite button (a star) and the next 3 songs. Favourites are a new Music list (`musicFavs`, synced like
  playlists) with its own place in the sidebar and in each song's menu.
- **Copies**: the file queue (`js/fileops.js`) measures what it really copied over the time it took and reports the speed,
  the file being copied and where it goes, through Live Activities (`stats`). The Pill shows them, with "Open the
  destination folder".

## Conflicts (Live)

Every board item, note paragraph and task has a `rev`. A write (`livePut`) is a transaction that only succeeds on top of
the revision the change was **started** from: the one when you began typing or dragging, not the one when you finished.
`firestore.rules` checks it again (`rev == resource.rev + 1`). If someone changed it first:

- for a board item, theirs stays and your text is kept as a new item beside it ("Your version: …");
- for a note paragraph, theirs stays and yours is inserted just after it;
- a move by two people at once keeps the first one.

When the server refuses a stale write, the cloud layer reads the item again and reports a clash, never an error.

## Voice (Live)

The microphone is asked for only when you press Join, and every track is stopped when you leave. Browsers connect directly
(WebRTC, STUN `stun.l.google.com`). The database only carries the connection messages (`signals`), and only the two people
each one is between can read it. The person with the smaller id makes the offer, so two people never both offer. The last
one out ends the call. There is **no TURN server**, so two people behind strict networks (some school or company networks)
may not connect.

## Security (server-side, in firestore.rules)

- Live: roles come from the space itself. Writes are stamped with your own account (`by`, `byName`, `at` = server time).
  Fields are whitelisted, and sizes, positions and colours are checked. Tasks can only be assigned to members. Presence
  is only your own.
- Commons: public or private visibility, roles (owner > mod > member, pending). Only the owner makes moderators, and nobody
  becomes owner. Announcements and challenges come from moderators. An entry needs an open challenge. Shared things are
  data, 150 KB at most. **Rate limit**: a post must also set your `lastPost` to now, and the previous one must be over
  20 s old. Reports are one per person per post and readable only by moderators. Bans block joining, posting, liking and
  reporting. A blocked person can't follow you, and blocking removes the follows both ways.
- What a showcase brings in is checked again on this device before use: `PatOS.desk.importText` (whitelist), Gallery's
  importer (no paths), `validateStudioWidget` (blocks only). A shared desktop is previewed, and "Put mine back" restores
  yours.

**To use Live and Commons on the real site, publish `firestore.rules` in the Firebase console** (docs/FIREBASE.md).

## Storage and sync

New device-only keys (never synced, `js/sync.js` DENY): `profileActive`, `deskWidgets`, `deskPanels`, `deskMenus`,
`deskShortcuts`, `pillHistory`, `pillActs`. Profiles, Worlds, Galleries, Data collections, Studio configurations,
installed widgets, joined communities and the Intelligence history are ordinary PatOS data: they are kept in backups
and synced like the rest.

## Tests

| Part | Test |
| --- | --- |
| Widgets | `test/browser/widgets40.test.js` |
| Studio, Profiles | `studio40`, `profiles40` (including the panel-size regression) |
| World, Data, Gallery | `world40`, `data40`, `gallery40` |
| PatOS AI | `ai40` |
| Launchpad shows every app | `launchpad40` |
| Live rules, Live app (two people, real WebRTC) | `test/cloud/live.test.js`, `test/cloud/live-app.test.js` |
| Commons rules, Commons app (two people) | `test/cloud/commons.test.js`, `test/cloud/commons-app.test.js` |

`npm test` runs the unit and browser tests. `npm run test:cloud` needs the Firebase emulator (Java + firebase-tools).

## Known limits

- Voice has no TURN relay (see above); video calls are planned for 4.1 and will build on Live's voice.
- Presence is written every 30 s, only while the Live window is open. Someone whose browser closes without saying so
  disappears after 90 s.
- Commons has no search across posts, no notifications for replies, and no image uploads (the free Firebase plan has no
  file storage). Discovery lists the newest 100 public communities.
- Data compares words, not meanings: "car" and "automobile" are not linked unless a tag or a link says so.
- Pat understands the sentences its rules know (English and French). It does not understand everything.
