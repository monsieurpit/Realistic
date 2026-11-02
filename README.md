# PatOS

A macOS-style desktop operating system that runs in any web browser. It's built to work on a school Chromebook.

![PatOS](assets/icon.svg)

## What's inside

**The desktop**
- Boot screen, lock screen with an optional password, Sleep, Restart and Shut Down
- Menu bar with app menus, battery (real Chromebook battery level), Wi-Fi, clock
- A dock with magnification, bouncing app icons, running-app dots, Trash, right-click menus and auto-hide
- Windows you can drag, resize, minimize (they fly into the dock), zoom and snap to the left or right half
- Launchpad, Spotlight search (apps, files, notes, math, web), Mission Control
- Control Center (brightness, volume, dark mode, Focus, full screen) and Notification Center with widgets
- Desktop icons, drag-select, right-click menus, drag files onto folders or the Trash
- Live **three.js 3D wallpapers** (Nebula, Dot Waves, Crystals, Warp) that react to your mouse, plus 8 picture wallpapers or your own photo

**Apps**
| | |
|---|---|
| Finder | files and folders, list/icon view, Trash, import from your computer |
| Surf | tabbed web browser with bookmarks; plays YouTube links |
| Notes, TextEdit, Reminders, Calendar | saved automatically |
| Calculator, Clock (world clock, stopwatch, timer), Weather (live forecast) | |
| Music | songs composed live by your computer, a 3D visualizer, and your own MP3s |
| Photos, Paint, Photo Booth | |
| Terminal | `ls`, `cd`, `cat`, `mkdir`, `open`, `neofetch`, `matrix`, `cowsay` and more |
| Galaxy | 3D galaxy generator (three.js) |
| Orb Runner | original 3D neon runner game (three.js) |
| 3D Studio | build a 3D scene with shapes and materials (three.js) |
| Tic-Tac-Toe, Maps, YouTube, System Settings, Activity Monitor | |
| Google apps | Gmail, Docs, Sheets, Slides, Forms, Drive, Classroom, Meet, Calendar, Keep, Chat, Photos, Translate (open in a real tab, since Google blocks being shown inside other pages) |

## Keyboard shortcuts

Chromebooks reserve most Ctrl shortcuts, so PatOS uses **Alt**:

| Keys | Action |
|---|---|
| Ctrl+Space or Alt+Space | Spotlight |
| Alt+L or F4 | Launchpad |
| Alt+↑ or F3 | Mission Control |
| Alt+W / Alt+Q / Alt+M | Close window / Quit app / Minimize |
| Alt+← / Alt+→ | Tile window left / right |
| Alt+T / Alt+E / Alt+B / Alt+, | Terminal / Finder / Surf / Settings |

## Running it

**On a Chromebook with no setup:** download `dist/PatOS.html` and open it. Everything (including three.js) is inside that one file and works offline.

**Locally:** open `index.html`, or run `npm start` and go to http://localhost:3000.

**On Render (Web Service):**
- Build Command: leave empty (or `npm install`)
- Start Command: `npm start`
- Environment variables: none. Render sets `PORT` itself and the server reads it.

Once it's on a real website, Chrome can install it as an app (⋮ menu → Install), and it keeps working offline.

**Rebuild the single-file versions** after changing code: `npm run build` (writes `dist/PatOS.html` and `dist/artifact.html`).

## How it's built

Plain HTML, CSS and JavaScript with no build step and no dependencies. three.js r160 is in `vendor/` so it loads even when school Wi-Fi blocks CDNs. Your files, notes and settings are saved in the browser's local storage (about 5 MB); System Settings › Storage can back them up to a file.

```
index.html          the page
css/                shell + app styles
js/core.js          storage, file system, settings, sounds, app registry
js/wm.js            window manager
js/shell.js         menu bar, dock, Launchpad, Spotlight, Control Center…
js/wallpaper.js     picture + live 3D wallpapers
js/apps/*.js        one file per app
server.js           tiny static server for Render
build.js            makes the single-file versions in dist/
```
