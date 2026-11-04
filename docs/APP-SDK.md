# PatOS App SDK

A PatOS app is **one file**: `something.patapp`. It is a web page (HTML, CSS and JavaScript in one piece) plus a few lines that say what it is called and what it needs. You can write one in the **Develop** tab of the App Store, or by hand.

Apps run in a locked box. They cannot see PatOS, your files, other apps, or the page around them. The only way out is the `patos` object, and PatOS decides every time.

## The file

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
  "width": 420,
  "height": 360,
  "html": "<!doctype html><h1>Hello</h1><script>patos.notify({title:'Hi'})</script>"
}
```

| Field | Rules |
| --- | --- |
| `id` | 3 to 49 characters: lowercase letters, numbers, dots, dashes. Must be unique. A new version of the same app uses the same id. |
| `name` | Up to 40 characters. |
| `version` | `1.2.3`. A higher number is an update. |
| `description`, `author` | Up to 300 and 40 characters. |
| `icon` | One or two characters (an emoji or a letter). |
| `color` | `#rrggbb`, the icon's background. |
| `permissions` | Any of: `files`, `clipboard`, `notifications`, `camera`, `microphone`, `location`, `network`. |
| `width`, `height` | The window's first size. |
| `engine` | Optional. `"web"` (the default) or `"pitcode"` (see below). |
| `html` | The whole app, at most 1 MB. |

## What your page can use

Your HTML is shown inside a sandboxed frame. Because it is locked down:

* **Everything must be in the file.** Scripts, styles and images are inline (use `data:` addresses for images). You cannot load scripts from other websites, and `eval` / `new Function` are blocked (except for PitCode apps, see below).
* **No internet unless you ask for `network`**, and then only `https:` (for `fetch`, images, audio and video).
* **No `localStorage`, cookies or IndexedDB.** Use `patos.storage`.
* **No popups, and no way to reach `parent`, `top` or PatOS.**

PatOS adds three CSS variables so your app matches the system: `--patos-bg`, `--patos-text`, `--patos-accent`. They change when the user switches between light and dark. The page starts with a sensible font and background that follow them; you can restyle everything.

## The `patos` object

Every call returns a Promise. A rejected Promise has a readable `message`.

```js
patos.log('text', isError)   // writes to the console in PitCode Studio (and nowhere else); console.log and errors go there too
patos.app            // { id, name, version, network }
await patos.info()   // { dark, bg, text, accent, language, mobile, app }
patos.on('theme', (t) => {})   // t = { dark, bg, text, accent }; the CSS variables update by themselves
```

### Storage (no permission needed)

Each app has its own private storage, up to 5 MB, saved on the device (and carried to other devices by Sync).

```js
await patos.storage.set('score', { best: 12 })   // any JSON value
await patos.storage.get('score')                  // the value, or null
await patos.storage.remove('score')
await patos.storage.keys()                        // ['score', ...]
await patos.storage.clear()
```

### Window (no permission needed)

```js
await patos.window.setTitle('Level 2')
await patos.window.close()
```

### Permissions

The first time your app uses one of these, PatOS asks the person, in a box that says what and which app. The answer is remembered, and they can change it in **Settings › Privacy**. If you did not list the permission in the file, the call is refused and nothing is asked. If they say no, the call rejects: handle it.

| Permission | Calls |
| --- | --- |
| `notifications` | `patos.notify({ title, body })` |
| `files` | `patos.files.list(dir?)`, `.read(path)`, `.write(path, text)`, `.remove(path)`. Only inside the app's own folder, **Documents › Apps › (app name)**. Paths like `../` are refused. Contents are text (or a `data:` address for pictures), up to 5 MB each. |
| `clipboard` | `patos.clipboard.write(text)`, `patos.clipboard.read()` |
| `camera` | `patos.camera.snapshot()` → a JPEG `data:` address |
| `microphone` | `patos.microphone.record(milliseconds)` → an audio `data:` address (0.5 to 60 seconds) |
| `location` | `patos.location.get()` → `{ lat, lon, accuracy }` |
| `network` | Asked when the app opens. Allows `https:` for `fetch`, images, audio and video. |

Camera, microphone and location are handled by PatOS, which uses the device only for the moment of that call and logs it. Your page never gets the raw camera or microphone.

## Write apps in PitCode

[PitCode](https://github.com/monsieurpit/PitCode) is a friendly language that compiles to JavaScript (`.pitx` pages like JSX, `.pit` code, `.pitoss` styles). PatOS has it built in, so an app can be written entirely in PitCode: set `"engine": "pitcode"` and PatOS puts the language into the app's box when it opens (it is not copied into the file, so the file stays small). Because PitCode turns code into JavaScript as it runs, a PitCode app's box also allows building code from text (`unsafe-eval`). The box is just as locked in every other way.

Reach the SDK from PitCode through `js`, JavaScript's global object:

```pit
pit saved = wait js.patos.storage.get("count")
js.patos.storage.set("count", 5)
js.patos.notify({title: "Hi"})
```

**PitCode Studio** writes the page that starts your files for you (it puts the sources in the app file as JSON and calls `PitCode.run`), so you only write PitCode.

## PitCode Studio (like Xcode)

Open **PitCode Studio** from the Launchpad. A project is a folder in **Documents › Studio** (so Backup and Sync keep it safe) with your files and a `project.patproj`.

* **New project:** pick PitCode or HTML + JavaScript, and a starting point (Blank, Counter, Notes).
* **Edit:** colors from the real PitCode lexer, mistakes listed under the code (click one to jump to it), Tab and Enter indent like an editor, it saves as you type. Right-click a file (press and hold on a phone) to rename it, delete it, or make it the start file.
* **Run** (or Ctrl/Cmd+Enter): the app starts in the preview, in the same locked box as an installed app, with a console for `say`, `console.log` and errors.
* **Project Settings:** name, identifier, version, author, description, icon and color, language, start file, window size and permissions (like Xcode's General tab).
* **Build:** install on this PatOS, save the `.patapp` in the project, download it, or send it for review.

For an HTML + JavaScript project, `style.css` and `app.js` linked from `index.html` are put into the single page when you build.

## Try it

1. The easiest way: open **PitCode Studio** (above).
2. Or open the **App Store**, then the **Develop** tab. Paste your HTML into the box, fill in a name, tick what it needs, then press **Install to Try It**.
3. When you are happy, press **Save .patapp** to keep the file, or **Send for Review**.

You can also double-click a `.patapp` file in Finder, or use **Open a .patapp File…**.

## Sending an app for review

**Send for Review** uploads the file to the PatOS server you are using. Nothing is published yet. The owner of that server reads it at `/apprequests` (the page asks for a password that only the owner has) and accepts or rejects it, with a short note you can read in the Develop tab. Accepted apps appear in **App Store › Community** for everyone on that server. A new version goes back to review, and people still get the old one until it is accepted.

What the reviewer checks: that it does what it says, that it asks for no more than it needs, and that it does not try to trick or harm anyone.

## For the owner of a server

* Set `APPS_ADMIN_PASSWORD` in your environment (on Railway: Variables). It is the password for `/apprequests`. If it is not set, a random one is printed in the server log each time the server starts.
* Submissions and accepted apps are stored in `PATOS_DATA/apps` (use the same volume as Sync).
* `/apprequests` shows each app's code as text (for PitCode apps, each source file, and the whole page PatOS will run), flags things worth a look (network calls, `eval`, storage tricks), and has a **Download** button so you can try it in PatOS before you decide. It never runs the app itself.
* Accepting publishes the app. **Remove from store** unpublishes it (people who installed it keep their copy).
