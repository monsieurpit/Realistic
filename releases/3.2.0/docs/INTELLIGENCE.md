# PatOS Intelligence

PatOS Intelligence is how PatOS does what you ask in **Pat**, **Spotlight** and **Shortcuts**. It is **not an AI** and uses no
language model, no AI service and no server: every capability is an *action* written in `js/intelligence.js` (or declared by
an app), with the exact words that call it. The same words always do the same thing; every action says what it did or why it
didn't; it runs on the device and works offline (except actions marked `online`).

## How a request is handled

1. **Polite words are dropped**: "hey Pat, could you please open the calculator for me" → "open the calculator".
2. **Understanding**: each action recognizes its own words (`match`), in English and French; accents and capitals don't matter,
   but names are kept as typed ("crée un dossier appelé Été"). Actions are tried by `priority`; the first match wins.
   Entities: app names (`findApp`, with "did you mean" for near misses), dates and times (`js/dates.js`: "tomorrow at 5pm",
   "friday", "le 12 mars", "dans 3 jours"), numbers and percentages, setting names (`PatOS.settingsCatalog`).
3. **Checks** before anything runs: the parameters (types, ranges, required), the kind of action is allowed (Settings ›
   Pat & Intelligence), the action is available (internet, phone), and apps may only use actions marked `apps: true`.
4. **Confirmation**: actions that destroy something ask first (`confirm`); nothing happens before the yes.
5. **Running**, then a **result** `{ ok, status, message, data, canUndo }`. `status` is `done`, `failed`, `denied`,
   `invalid`, `unavailable` or `confirm`. A failure is never reported as success.
6. **Undo**: actions that return an `undo` can be undone ("undo") for 30 minutes.
7. **History**: the last 50 actions (no parameters, messages cut to 140 characters), on this device only, in Settings.

```js
PatOS.intel.parse('create a folder called Projects')   // → { id: 'folder.create', params: { name: 'Projects', dir: '/Documents' } } (no side effects)
PatOS.intel.respond('set the volume to 40%')           // → { ok: true, message: 'Volume set to 40%.', canUndo: true }
PatOS.intel.execute('app.open', { app: 'calendar' }, { source: 'shortcut' })
PatOS.intel.list({ apps: true })                       // the actions apps may run
```

## The actions

| Action | Examples |
| --- | --- |
| `app.open`, `app.close`, `app.recent`, `app.list` | open calendar · quit music · open my most recently used app |
| `files.latest`, `files.find` | open my latest document · find files containing PatOS · find file essay |
| `folder.create`, `trash.empty` (asks first) | create a folder called Projects in Desktop · empty the trash |
| `reminders.create`, `reminders.list` | create a reminder to finish my project tomorrow · show my reminders for friday |
| `calendar.list`, `calendar.create` | what's on my calendar tomorrow · add event dentist friday 2pm |
| `notes.create` | note: buy milk |
| `timer.start`, `alarm.set` | timer 10 min · wake me at 7:30 |
| `settings.theme`, `settings.set`, `settings.open` | turn on dark mode · set the volume to 40% · turn on reduce motion · open sound settings |
| `focus.set`, `system.lock`, `notifications.apps`, `context.now` | turn on do not disturb · lock the screen · show applications that have notifications · what am I working on |
| `shortcuts.list`, `shortcuts.explain`, `shortcuts.create`, `pat.shortcuts.run` | create a shortcut called Morning that opens calendar and turns on dark mode · what does my Morning shortcut do · run shortcut Morning |
| `workspace.start` | start my study workspace · prepare my workspace for studying |
| `intel.undo` | undo |
| `pat.*` | Pat's skills (search notes, find documents about…, create a document, tidy a folder, summarize, my day…) are actions too |

## Workspaces

A workspace is a list of steps, each something you could ask Pat ("turn on do not disturb", "open notes", "my reminders").
Every step is understood, permission-checked and run on its own; the answer lists each step with ✓ or ✗ and why, and the
workspace only counts as ready when every step worked. Edit them in Settings › Pat & Intelligence (each step is checked as you
type). Defaults: Study, Focus, Relax.

## Shortcuts

Shortcuts and Intelligence are one engine: a shortcut step "Do a command" runs any command through Intelligence;
`shortcuts.create` turns "a shortcut called X that does A and B" into a shortcut whose steps are A and B, refusing any step it
doesn't understand; `shortcuts.explain` describes a shortcut's steps and trigger.

## Permissions

Settings › Pat & Intelligence turns off whole kinds of action: apps, files (read), files (write), settings, calendar,
reminders, notes, shortcuts, system. A turned-off kind is refused with a message that says where to turn it back on.
Context (the app in front, open apps, recent files, online, device, focus) is only read when an action asks for it, and is
never given to apps.

## Apps (.patapp)

Apps offer actions with `patos.actions.register` (see docs/APP-SDK.md). They run at priority 10, below every PatOS action, so
an app can't take over "open calendar"; they reach only their own app (PatOS opens it to do them, 8 s to open, 10 s to answer).
Apps may run only actions marked `apps: true` (today `app.open`, `settings.open`), at most 20 a minute, each written in
Settings › Privacy. Uninstalling an app removes its actions.

## Adding an action (for PatOS itself)

```js
PatOS.intel.action({
  id: 'music.play', owner: 'music', title: 'Play music', permission: 'apps', priority: 40,
  params: { song: { type: 'string', max: 100 } }, examples: ['play some music'],
  match: (t, raw, E) => (/^play (?:some )?music$/.test(t) ? {} : null),   // t: lower case, no accents; raw: as typed; E: entity helpers
  run: (p) => ({ message: 'Playing.', undo: () => 'Stopped.' })
});
```

Tests: `test/browser/intelligence.test.js` (parsing, results, permissions, confirmation, undo, workspaces, Shortcuts, app
actions, French), `test/browser/patapps.test.js` (app actions end to end), `test/browser/settings32.test.js` (Spotlight).
