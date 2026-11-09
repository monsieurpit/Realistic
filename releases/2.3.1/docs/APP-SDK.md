# PatOS App SDK

Everything about making, running, sharing and publishing a PatOS app. Jump to:

1. [The idea](#the-idea)
2. [The `.patapp` file](#the-patapp-file)
3. [The `.patappproject` file](#the-patappproject-file)
4. [The box your app runs in](#the-box-your-app-runs-in)
5. [The `patos` object](#the-patos-object) (info, theme, storage, window, notifications, files, clipboard, camera, microphone, location, console)
6. [Permissions and Settings › Privacy](#permissions-and-settings--privacy)
7. [Limits (all of them)](#limits-all-of-them)
8. [Errors and what they mean](#errors-and-what-they-mean)
9. [Write apps in PitCode](#write-apps-in-pitcode)
10. [PitCode Studio](#pitcode-studio)
11. [The Develop tab (App Store)](#the-develop-tab-app-store)
12. [Installing, updating and removing apps](#installing-updating-and-removing-apps)
13. [Publishing, updating and the review](#publishing-updating-and-the-review)
14. [For the owner of a server](#for-the-owner-of-a-server)
15. [Server API reference](#server-api-reference)
16. [Examples](#examples)
17. [Troubleshooting](#troubleshooting)

---

## The idea

A PatOS app is **one file**: `something.patapp`. It is a web page (HTML, CSS and JavaScript in one piece) plus a few lines that say what it is called and what it needs. You make one in **PitCode Studio** (recommended), in the **Develop** tab of the App Store, or by hand in a text editor.

Apps run in a **locked box**. They cannot see PatOS, your files, other apps, or the page around them. The only way out is the `patos` object, and PatOS decides every time. Anything sensitive (notifications, files, clipboard, camera, microphone, location, internet) has to be listed in the file and is asked again, on the device, the first time the app uses it.

Where things live:

| Thing | Where |
| --- | --- |
| An installed app | saved on the device (works offline), follows you with Sync |
| An app's private data (`patos.storage`) | on the device, up to 5 MB per app, follows you with Sync |
| An app's files (`patos.files`) | Documents › Apps › (app name) |
| A Studio project | Documents › Studio › (project name) |
| Permission answers and the activity log | on the device only (each device asks for itself) |
| Your publisher keys | on your devices, follow you with Sync and Backup |

## The `.patapp` file

A `.patapp` file is JSON:

```json
{
  "format": "patapp",
  "formatVersion": 1,
  "id": "com.maya.timer",
  "name": "Tiny Timer",
  "version": "1.0.0",
  "author": "Maya",
  "description": "A timer that remembers your last time.",
  "icon": "⏱",
  "color": "#ff9f0a",
  "permissions": ["notifications"],
  "engine": "web",
  "width": 420,
  "height": 360,
  "html": "<!doctype html><h1>Hello</h1><script>patos.notify({title:'Hi'})</script>"
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `format` | yes | Always `"patapp"`. |
| `formatVersion` | yes | Always `1`. |
| `id` | yes | 3 to 49 characters: lowercase letters, numbers, dots, dashes, starting with a letter or number (like `com.maya.timer`). Unique. A new version of the same app keeps the same id. |
| `name` | yes | Up to 40 characters. |
| `version` | yes | `1.2.3` (three numbers, up to four digits each). A higher number is an update. |
| `html` | yes | The whole app, at most 1 MB (1,000,000 characters). |
| `author` | no | Up to 40 characters. |
| `description` | no | Up to 300 characters. Shown in the store and in search. |
| `icon` | no | One or two characters (an emoji or a letter). If empty, the first letter of the name. |
| `color` | no | `#rrggbb`, the icon's background. Default `#0a84ff`. |
| `permissions` | no | Any of `files`, `clipboard`, `notifications`, `camera`, `microphone`, `location`, `network`, each at most once. |
| `engine` | no | `"web"` (default) or `"pitcode"` (see [Write apps in PitCode](#write-apps-in-pitcode)). |
| `width`, `height` | no | The window's first size. 240 to 1600 wide (default 520), 200 to 1200 high (default 420). |

Other fields are ignored (and dropped). PatOS checks every file when it opens it, and the server checks it again when it is sent, with the same rules (`js/patapp-format.js`). A bad file is refused with a sentence that says why.

You can open a `.patapp` file by double-clicking it in Finder, with **Open a .patapp File…** in the App Store, or when a friend sends it to you with PatDrop.

## The `.patappproject` file

A **project** in one JSON file: the settings and **every file with its code**. PitCode Studio exports and imports it. (A `.patapp` is the finished, built app; a `.patappproject` is the source you work on.)

```json
{
  "format": "patappproject",
  "formatVersion": 1,
  "exported": "2026-11-05",
  "meta": {
    "name": "Clock",
    "id": "com.maya.clock",
    "version": "1.0.0",
    "author": "Maya",
    "description": "A clock.",
    "icon": "⏰",
    "color": "#0a84ff",
    "permissions": ["notifications"],
    "language": "pitcode",
    "entry": "main.pitx",
    "width": 520,
    "height": 420
  },
  "files": {
    "main.pitx": "App() => <h1>Hello</h1>\n\ndraw(App)\n",
    "styles.pitoss": "style body {\n  margin: 0\n}\n",
    "tools.pit": "double(n) => n * 2\n"
  }
}
```

`meta`:

| Field | Meaning |
| --- | --- |
| `name` | The project and app name (up to 40 characters, no `/` or `\`). |
| `id`, `version`, `author`, `description`, `icon`, `color`, `permissions`, `width`, `height` | The same as in a `.patapp`. |
| `language` | `"pitcode"` (files `.pitx`, `.pit`, `.pitoss`) or `"web"` (files `.html`, `.css`, `.js`). |
| `entry` | The start file: a `.pitx` / `.pit` file for PitCode, an `.html` file for web. |

`files` (the code):

* The file name is the key and the code is the value (text).
* **Flat**: no folders. Names use letters, numbers, dots, dashes and underscores, 1 to 60 characters, and end in `.pitx`, `.pit`, `.pitoss`, `.html`, `.css`, `.js`, `.json`, `.txt` or `.md`.
* At most **60 files**, **500 KB** each, **3 MB** in all.
* `project.patproj` is Studio's own settings file and cannot be a name inside `files`.

What Studio does when it **imports** one:

* It checks everything. A bad name (like `../evil.js`), a non-text file, too many or too big files, a wrong `format` or `formatVersion`, or text that is not JSON is **refused with a message**, and nothing is written.
* Odd settings are **cleaned up**, never trusted: a bad `id` is replaced by a new one, unknown permissions are dropped, a bad `version` becomes `1.0.0`, a bad color becomes the default blue, and a missing start file is replaced by `main.pitx` (or the first file that can start the app).
* If a project for the **same app id** is already in Studio, you choose: **Replace** (its files become the ones in the file; its publishing history is kept) or **Make a Copy** (a separate project with its **own new identifier**, so it never touches the original app).
* Otherwise it becomes a new project (with a number added to its name if the name is taken) and opens.

What an **export** holds: the settings and every file. It never holds your **publisher key** (see [Publishing](#publishing-updating-and-the-review)), so sharing a project file does not give anyone the right to update your app in the store.

Ways in: **Import Project…** on Studio's first screen, or double-click a `.patappproject` in Finder. Ways out: **Build › Export project (.patappproject)**.

## The box your app runs in

Your HTML is shown inside a sandboxed frame (`sandbox="allow-scripts allow-forms allow-modals allow-downloads"`, no same-origin access). Because it is locked down:

* **Everything must be in the file.** Scripts, styles and images are inline (use `data:` addresses for images and fonts). You cannot load scripts from other websites, and `eval` / `new Function` are blocked (except for PitCode apps).
* **No internet unless you ask for `network`**, and then only `https:` (for `fetch`, images, audio, video and fonts).
* **No `localStorage`, `sessionStorage`, cookies or IndexedDB.** Use `patos.storage`.
* **No popups, and no way to reach `parent`, `top` or PatOS** other than `patos`. Forms cannot submit anywhere; handle `submit` in script.
* The page's security policy (CSP) is: `default-src 'none'; script-src 'unsafe-inline'` (plus `'unsafe-eval'` for PitCode apps); `style-src 'unsafe-inline'`; `img-src data: blob:`; `media-src data: blob:`; `font-src data:`; `connect-src 'none'`; `form-action 'none'`; `base-uri 'none'`. With the `network` permission, `https:` is added to `img-src`, `media-src`, `font-src` and `connect-src`.

PatOS adds three CSS variables so your app matches the system: `--patos-bg`, `--patos-text`, `--patos-accent`. They change by themselves when the person switches between light and dark or changes the accent color. The page starts with a sensible font and background that follow them (`color-scheme` too); you can restyle everything.

## The `patos` object

Every call returns a Promise. A rejected Promise has a readable `message` (see [Errors](#errors-and-what-they-mean)). `patos` is ready as soon as your script runs.

```js
patos.app             // { id, name, version, network }   (network = true when the internet permission was allowed)
await patos.info()    // { dark, bg, text, accent, language, mobile, app: { id, name, version } }
patos.on('theme', (t) => {})   // t = { dark, bg, text, accent }; the CSS variables already update by themselves
patos.log('text', isError)     // writes to the console in PitCode Studio (see Console)
```

`patos.info()` fields: `dark` (boolean), `bg`, `text`, `accent` (colors, as `#rrggbb`), `language` (`"en"` or `"fr"`), `mobile` (true on a phone layout), and `app`.

The only event is `'theme'`. `patos.on(name, fn)` can be called several times for the same event; each function is called.

### Storage (no permission needed)

Each app has its own private storage, saved on the device and carried to other devices by Sync. Other apps cannot see it.

```js
await patos.storage.set('score', { best: 12 })   // any JSON value (true if saved)
await patos.storage.get('score')                  // the value, or null
await patos.storage.remove('score')
await patos.storage.keys()                        // ['score', ...]
await patos.storage.clear()
```

Keys are text, 1 to 100 characters. The whole storage of one app is capped at **5 MB** of JSON. `storage.set` rejects when it would go over. Removing the app removes its storage.

### Window (no permission needed)

```js
await patos.window.setTitle('Level 2')   // up to 80 characters; empty puts the app's name back
await patos.window.close()
```

### Notifications (permission: `notifications`)

```js
await patos.notify({ title: 'Timer done', body: 'Your tea is ready' })
```

* `title`: up to 80 characters. If left out, the app's name.
* `body`: up to 200 characters. Optional.
* It shows in PatOS's notification area (top right) with **your app's icon**, like a notification from any PatOS app. Nothing else can be set: no sound, no buttons, no link, no image.
* The first call asks the person (see [Permissions](#permissions-and-settings--privacy)). If they say no, it rejects and nothing is shown.
* It works while your app is **open**. An app cannot show notifications when it is closed, or schedule them for later.
* Every call is written in the activity log (Settings › Privacy › Recent activity) as "Notifications used".

### Files (permission: `files`)

```js
await patos.files.write('notes/today.txt', 'hello')   // true. Folders in the path are made for you.
await patos.files.read('notes/today.txt')              // the text, or null if there is no such file
await patos.files.list()                               // [{ name, folder, size }]  (the app's folder)
await patos.files.list('notes')                        // the contents of a subfolder ([] if it does not exist)
await patos.files.remove('notes/today.txt')            // true (also fine if it was not there)
```

* Only inside the app's own folder, **Documents › Apps › (app name)**. The person can open it in Finder and see what the app made.
* A path is made of names separated by `/`. `..` and `.` are refused, a name is up to 100 characters, the whole path up to 200.
* Contents are **text** (or a `data:` address for a picture), up to **5 MB** each.
* The folder is named after the app (special characters removed). Files an app made are **kept** when the app is removed.

### Clipboard (permission: `clipboard`)

```js
await patos.clipboard.write('copied text')   // up to 1,000,000 characters
await patos.clipboard.read()                 // the text on the clipboard
```

The browser may also ask the person itself the first time (clipboard reading is protected by the browser).

### Camera (permission: `camera`)

```js
const picture = await patos.camera.snapshot()   // a JPEG "data:image/jpeg;base64,..." address
```

PatOS opens the camera for about half a second, takes one picture (at most 1280 pixels wide), and closes the camera. Your page never gets the camera itself.

### Microphone (permission: `microphone`)

```js
const sound = await patos.microphone.record(5000)   // milliseconds; an audio "data:" address
```

Between 500 and 60,000 milliseconds (0.5 to 60 seconds). If the number is missing or wrong, 5 seconds. PatOS records, then closes the microphone. Your page never gets the microphone itself.

### Location (permission: `location`)

```js
const where = await patos.location.get()   // { lat, lon, accuracy }  (accuracy in meters)
```

It waits up to 15 seconds. It rejects with "Your location is not available." if the device cannot say.

### Console

```js
patos.log('hello')        // a normal line
patos.log('oops', true)   // an error line
console.log('also works') // console.log, console.error and uncaught errors go to the same place
```

The console is in **PitCode Studio**, under the preview, while you Run an app. For an installed app it goes nowhere (there is no output to read). Text is cut at 4,000 characters per line.

## Permissions and Settings › Privacy

Permissions: `files`, `clipboard`, `notifications`, `camera`, `microphone`, `location`, `network`.

* An app must **list** a permission in its file to use it. If it did not list it, the call is refused and **nothing is asked**.
* The first time the app uses it, PatOS asks the person in a box that says **which app** and **what it wants to do**. The answer is remembered for that device.
* If they say no, the call rejects with "You did not allow this app to use the …". Handle it (show a message, carry on without).
* `network` is asked **when the app opens**, because it changes what the page may load. If the person refuses, the app opens without internet.
* **Settings › Privacy** lists every installed community app with, for each permission, whether it is allowed, not allowed or will ask, a switch to change it, a **Remove this app** button, and whether the app was **checked by the owner of this PatOS** (from the store) or **installed from a file** (nobody checked it).
* **Recent activity** lists what apps did ("used", "was allowed", "was denied", "was blocked"): PatOS keeps the 300 newest entries and the list shows the latest 40. **Clear Activity** empties it.
* Apps from a friend, a file or Studio say "Installed from a file. Nobody checked it." Only install files from people you trust.

## Limits (all of them)

| What | Limit |
| --- | --- |
| The app's `html` | 1 MB |
| `name` / `author` / `description` | 40 / 40 / 300 characters |
| `id` | 3 to 49 characters |
| `icon` | 2 characters |
| Window size | 240 to 1600 wide, 200 to 1200 high |
| `patos.storage` | 5 MB per app, keys up to 100 characters |
| `patos.files` | 5 MB per file, paths up to 200 characters, names up to 100 |
| `patos.clipboard.write` | 1,000,000 characters |
| `patos.notify` | title 80, body 200 characters |
| `patos.window.setTitle` | 80 characters |
| `patos.microphone.record` | 0.5 to 60 seconds |
| `patos.camera.snapshot` | picture at most 1280 pixels wide |
| `patos.location.get` | 15 seconds |
| `patos.log` | 4,000 characters per line |
| A Studio project | 60 files, 500 KB each, 3 MB in all |
| What the server accepts in one send | about 1.3 MB |
| Apps waiting for review on one server | 200 |
| Apps in one server's store | 300 |
| Sends from one address | 10 per hour |

## Errors and what they mean

A rejected Promise has a `message`. The ones your app can get:

| Message | Why |
| --- | --- |
| `This app did not ask for the <permission> permission.` | The permission is not in `permissions` in the file. Add it. |
| `You did not allow this app to use the <permission>.` | The person said no (now, or earlier in Settings › Privacy). |
| `Keys are text, up to 100 characters.` | A bad key for `patos.storage`. |
| `This app has used all of its storage (5 MB).` | `storage.set` would go over the limit. |
| `That is not a valid file name.` | A path with `..`, an empty name, or too long. |
| `Files are text (or a data: address), up to 5 MB.` | `files.write` with something that is not a string, or too big. |
| `Your location is not available.` | The device could not find where it is (or it timed out). |
| `Could not read it` | Turning a recording into a `data:` address failed. |
| `Unknown request: …` | A call that does not exist (check the spelling of the function). |

Camera and microphone errors are the browser's own (for example "Permission denied", or "Requested device not found" when there is no camera).

## Write apps in PitCode

[PitCode](https://github.com/monsieurpit/PitCode) is a friendly language that compiles to JavaScript (`.pitx` pages like JSX, `.pit` code, `.pitoss` styles). PatOS has it built in, so an app can be written entirely in PitCode: set `"engine": "pitcode"` and PatOS puts the language into the app's box when it opens (it is not copied into the file, so the file stays small). Because PitCode turns code into JavaScript as it runs, a PitCode app's box also allows building code from text (`unsafe-eval`). The box is just as locked in every other way.

Reach the SDK from PitCode through `js`, JavaScript's global object:

```pit
pit saved = wait js.patos.storage.get("count")
js.patos.storage.set("count", 5)
js.patos.notify({title: "Hi"})
say "Hello from {js.patos.app.name}!"
```

`say` prints to the Studio console. **PitCode Studio** writes the page that starts your files for you (it puts every source file in the app file as JSON and calls `PitCode.run` on the start file, after turning each `.pitoss` into a stylesheet), so you only write PitCode.

The **Counter** starting project in Studio (`main.pitx`, then `styles.pitoss`) is a complete small app: a counter that remembers its number.

```pit
// A counter that remembers its number.
pit state = store({count: 0})

start() => {
  pit saved = wait js.patos.storage.get("count")
  when saved != nil {
    state.count = saved
  }
}

change(by) => {
  state.count = state.count + by
  js.patos.storage.set("count", state.count)
}

App() => <main>
  <h1>{state.count}</h1>
  <div class="row">
    <button onClick={() => change(-1)}>-1</button>
    <button onClick={() => change(1)}>+1</button>
  </div>
</main>

start()
draw(App)
```

```pit
style body {
  margin: 0
  padding: 20
  font-family: system-ui, sans-serif
  text-align: center
}

style h1 {
  font-size: 64
  margin: 10 0
}

style .row {
  display: flex
  gap: 10
  arrange: center
}

style button {
  font: inherit
  padding: 8 18
  border: 0
  corners: 8
  text-color: white
  background: var(--patos-accent)
}
```

## PitCode Studio

Open **PitCode Studio** from the Launchpad. A project is a folder in **Documents › Studio** (so Backup and Sync keep it safe) with your files and a `project.patproj` (the settings, the same fields as `meta` in a `.patappproject`).

**The first screen**

* **Create Project:** a name, PitCode or HTML + JavaScript, and a starting point (Blank, Counter, Notes).
* **Import Project…:** open a `.patappproject` (see [the file](#the-patappproject-file)).
* **Your projects:** every project, newest first. Click one to open it.

**Inside a project**

* **Files** (left): click to edit. **+** adds a file (`.pitx`, `.pit`, `.pitoss` for PitCode; `.html`, `.css`, `.js` for the web; also `.json`, `.txt`, `.md`). Right-click a file (press and hold on a phone) to rename it, delete it (it goes to the Trash) or make it the **start file**. The start file is marked.
* **Editor:** colors from the real PitCode lexer, mistakes and warnings listed under the code (click one to jump to it), Tab and Shift+Tab indent, Enter keeps the indent and opens a block after `{`, `(` or `[`. It **saves as you type**. Ctrl/Cmd+S saves right away.
* **Run** (or Ctrl/Cmd+Enter): the app starts in the preview, in the same locked box as an installed app, with a **Console** for `say`, `patos.log`, `console.log` and errors. **Stop** ends it. **Preview** shows or hides the preview on narrow windows; **☰** shows the file list.
* **Project Settings:** name, identifier, version, author, description, icon (an emoji or a letter) and color, language, start file, window size and permissions (like Xcode's General tab), and **Delete Project…** (to the Trash; an installed copy of the app stays installed). The identifier and version are checked as you type; the identifier is **locked** once the app is published.
* **Build** menu:
  * **Install on this PatOS:** installs the app here (it asks like any install).
  * **Save .patapp in the project:** writes `<id>.patapp` next to your files.
  * **Download .patapp:** a download.
  * **Send to a friend with PatDrop:** sends the app straight into a linked PatOS.
  * **Publish to the store…** / **Update in the store…** (see below).
  * **Export project (.patappproject):** the whole project in one file.
* **Projects** (top left) goes back to the first screen.

For an HTML + JavaScript project, `style.css` and `app.js` linked from `index.html` (`<link href>`, `<script src>`) are put into the single page when you build. For a PitCode project, the sources go into the app as JSON.

## The Develop tab (App Store)

A simpler way to make a single-page app without Studio: **App Store › Develop**.

1. Fill in the name, your name, what it does, an icon (an emoji or a letter) and a color. The identifier is optional (one is made for you; keep it the same for updates).
2. Tick what the app needs (**It will ask for:**).
3. Paste your HTML into the box (it starts with a small working example).
4. **Install to Try It** installs it here and opens it. Trying it again **updates the same app** (it does not make another). What you typed is kept, also after a restart.
5. **Save .patapp** downloads the file, **Send for Review** publishes it (see below), and **Open a .patapp File…** installs a file and loads it into the form so you can change it. **Edit this app** in Community does the same for an app you installed from a file.
6. **Send a File for Review…** publishes a `.patapp` file you already have.

## Installing, updating and removing apps

* **Install:** from a file (Finder, **Open a .patapp File…**), from Studio, from PatDrop, or from the store (**App Store › Community › GET**). PatOS shows the name, version, author, description and what it asks for, and installs when you confirm. The app appears in the Launchpad and in search (category Community) and can be pinned to the Dock.
* **Update:** installing a file with the **same `id`** and a higher `version` updates the app in place (the title says "Update"). Its saved data and permissions are kept. Installing an **older** version asks first ("Install an older version?"). In the store, an app you have shows **UPDATE** when the store's version is higher, and **OPEN** otherwise.
* **Remove:** Settings › Privacy › **Remove…**, or **Remove** in Community. The app, its saved data and its permissions are removed. Files it made in Documents › Apps are kept.
* **Sync:** your installed apps follow you between your devices. Their permissions do not: each device asks for itself.
* **Where an app came from:** `store` (accepted by the owner of this PatOS) or `file`. Apps from the store say so in Settings › Privacy.

## Publishing, updating and the review

You can publish from **PitCode Studio** (Build menu) or from the App Store's **Develop** tab (**Send for Review**).

1. **Publish to the store…** sends the app to the PatOS server you are using. Nothing is public yet.
2. The owner of that server reads it at `/apprequests` (a page with a password only the owner has) and **accepts** or **rejects** it, with a short note.
3. You can follow its status in the Develop tab (**Sent for review**): Waiting for review, Accepted, or Not accepted with the note.
4. Accepted apps appear in **App Store › Community** for everyone who uses that server.

**After an app is in the store, publishing again is an update**, never a second app:

* The menu changes to **Update in the store…**. It sends a new version of the **same app**, which replaces the old one when the owner accepts it. The old version stays up while the new one waits.
* The **identifier is locked** once published (a different identifier would be a different app).
* The **version must be higher** than the one in the store (the server refuses the same or a lower version). If you forget, Studio offers the next one (1.0.0 → 1.0.1) before sending.
* Sending again **while a version is waiting** replaces the one waiting.
* People who installed the app see **UPDATE** in Community when the new version is accepted.
* The reviewer page says **(update of x.y.z)** for updates and **(new app)** for new ones.

**Who can update an app.** An app id belongs to **whoever sent it first**:

* The first time you send an app, your device makes a secret **publisher key** for it (24 random bytes). It is kept on your devices (it follows you with Sync and Backup) and sent with each submission. The server keeps only a **fingerprint** (a one-way hash) of it, never the key.
* Only the same key can send updates for that id. Anyone else gets "This app id already belongs to another publisher. Choose a different identifier." Nobody can take your app's id, and nobody can overwrite your app.
* The key is **not** in a `.patapp` or `.patappproject` file. If you lose it (for example by erasing PatOS without a backup), you cannot update that app any more; publish it under a new identifier.
* Apps accepted before owners existed have no owner yet: the first person to send an update for one becomes its owner.

What the reviewer checks: that it does what it says, that it asks for no more than it needs, and that it does not try to trick or harm anyone.

## For the owner of a server

* Set **`APPS_ADMIN_PASSWORD`** in your environment (on Railway: Variables). It is the password for `/apprequests`. If it is not set, a random one is printed in the server log each time the server starts (search for "APPS_ADMIN_PASSWORD is not set"). The password is never in the code.
* Five wrong passwords from one address lock it out for 15 minutes. A signed-in session lasts 12 hours.
* Submissions and accepted apps are stored in **`PATOS_DATA/apps`** (use the same volume as Sync): `pending/` (waiting, one file per app id), `accepted/` (published), `tickets/` (the status each sender follows) and `owners.json` (app id → fingerprint of its publisher's key).
* `/apprequests` shows each app's code as text (for PitCode apps, each source file, and the whole page PatOS will run), flags things worth a look (network calls, `eval`, storage tricks), says whether it is a new app or an update, and has a **Download** button so you can try it in PatOS before you decide. It never runs the app itself.
* **Accept** publishes (or replaces the published version). **Reject** keeps the old version up and gives the sender your note. **Remove from store** unpublishes an app (people who installed it keep their copy; its owner stays the same).
* The review page is not part of PatOS, so it is never served from the offline copy: it always comes from the server.

## Server API reference

All under `/api/apps/`, JSON in and out. Errors are `{ "error": "…" }` with a status code.

| Route | Who | What |
| --- | --- | --- |
| `GET store` | anyone | The accepted apps (without their code): `{ apps: [{ id, name, version, author, description, icon, color, permissions, engine, size, accepted }] }`. |
| `GET get?id=<id>` | anyone | One accepted app, with its code: `{ app }`. 404 if not accepted. |
| `GET status?ticket=<ticket>` | the sender | `{ status: 'pending' \| 'accepted' \| 'rejected', id, name, version, note, at }`. |
| `POST submit` | anyone | Body `{ app, key }` (`key`: the publisher key, 22 to 64 letters, numbers, `-` or `_`). Returns `{ ticket, status: 'pending', update, previous }`. 400 bad file or no key, 403 id belongs to another publisher, 409 version not higher than the store's, 429 too many sends, 507 review list full. |
| `POST app-state` | anyone | Body `{ id, key? }`. Returns `{ taken, mine, accepted, pending }`: is the id used, is it yours (key matches), the version in the store, and the version waiting (yours only). |
| `POST admin/login` | the owner | Body `{ password }`. Returns `{ token }` (12 hours). 403 wrong password, 429 locked out. |
| `GET admin/list` | the owner | `{ pending: [...with ticket, submitted, update], accepted: [...] }`. |
| `GET admin/app?id=<id>&from=accepted` | the owner | The full app (from `pending`, or from `accepted` with `from=accepted`). |
| `POST admin/decide` | the owner | Body `{ id, decision: 'accept' \| 'reject', note }`. |
| `POST admin/remove` | the owner | Body `{ id }`. Unpublishes. |

Owner routes need `Authorization: Bearer <token>`. The review page itself is `/apprequests`.

## Examples

**The smallest app** (`examples/hello.patapp` in this repository): counts how many times it was opened and shows a notification.

```html
<h2>Hello!</h2>
<p>You opened this app <b id="n">0</b> times.</p>
<button id="b">Say hi</button>
<script>
  patos.storage.get("opens").then(function (n) {
    n = (n || 0) + 1;
    document.getElementById("n").textContent = n;
    patos.storage.set("opens", n);
  });
  document.getElementById("b").onclick = function () {
    patos.notify({ title: "Hello", body: "Made with the PatOS SDK" }).catch(function (e) { patos.log(e.message, true); });
  };
</script>
```

**Device Lab** (`examples/device-lab.patapp`, and its project `examples/device-lab.patappproject` to open in Studio): a big app that uses **every** permission (files, notifications, clipboard, camera, microphone, location, internet), has a button for each call, shows what each permission did, and has **Run every test** with a report you can copy or save. Its source is in `examples/device-lab/` (rebuild the two files with `node scripts/build-example.js`).

**Device Lab in PitCode** (`examples/device-lab-pit.patapp`, and its project `examples/device-lab-pit.patappproject`): the same app written entirely in PitCode, in four files you can read in Studio: `main.pitx` (the screen), `lab.pit` (what every button does, calling `js.patos`), `tools.pit` (the shared state and helpers, with `share` and `use`) and `styles.pitoss` (the look). Its sources are in `examples/device-lab-pit/` (rebuild the two files with `node scripts/build-example-pit.js`).

**An app that saves notes in a file** (permission `files`):

```html
<textarea id="t" style="width:100%;height:200px"></textarea>
<script>
  var t = document.getElementById("t");
  patos.files.read("notes.txt").then(function (x) { t.value = x || ""; });
  t.oninput = function () { patos.files.write("notes.txt", t.value); };
</script>
```

**An app that follows the theme and asks politely** (permission `location`):

```html
<h2 style="color: var(--patos-accent)">Where am I?</h2>
<button id="go">Find me</button><p id="out"></p>
<script>
  document.getElementById("go").onclick = function () {
    patos.location.get().then(function (p) {
      document.getElementById("out").textContent = p.lat.toFixed(3) + ", " + p.lon.toFixed(3);
    }).catch(function (e) { document.getElementById("out").textContent = e.message; });
  };
  patos.on("theme", function (t) { patos.log("dark: " + t.dark); });
</script>
```

## Troubleshooting

| Problem | What to do |
| --- | --- |
| "This app did not ask for the … permission." | Add it to `permissions` (Project Settings in Studio, or the file). |
| A permission box never shows again | The answer is remembered. Change it in Settings › Privacy. |
| Nothing prints in the console | The console is only in Studio while you press Run. Use `patos.log` or `console.log`. |
| An image or script does not load | Everything must be in the file (use `data:` addresses). Internet needs the `network` permission and `https:`. |
| `eval` does not work | It is blocked in the locked box. PitCode apps (`"engine": "pitcode"`) are the exception. |
| Studio refuses my `.patappproject` | Read the message: a file name outside the allowed form, a file that is not text, too many or too big files, or a wrong `format`. |
| "Version x is already in the store" | Raise `version` in Project Settings (Studio offers the next one). |
| "This app id already belongs to another publisher" | Someone else sent that id first, or this device does not have your publisher key. Use a new identifier, or get your key back by signing in to your account (Sync) or restoring a backup. |
| The identifier cannot be changed | It is locked once the app is published; a different identifier is a different app. Make a copy of the project (Import as a copy) to start a new app. |
| `/apprequests` says "Not found" in Safari | Open PatOS once so Safari gets the newest offline helper, then reload. If it keeps happening, clear this site's data in Safari. |
| The review password does not work | It comes from `APPS_ADMIN_PASSWORD` on the server (Railway › Variables); it is not in the code. |
