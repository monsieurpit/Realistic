# PatOS

A macOS-style desktop operating system that runs in any web browser. It's built to work on a school Chromebook, and on an iPhone it turns into a phone OS.

![PatOS](assets/icon.svg)

## What's inside

**First start**
- A Setup Assistant asks for your language, name, look and wallpaper

**The desktop**
- Boot screen, lock screen with an optional password, Sleep, Restart and Shut Down
- Menu bar with app menus, battery (real Chromebook battery level), Wi-Fi, clock
- A dock with magnification, bouncing app icons, running-app dots, Trash, right-click menus and auto-hide
- Windows you can drag, resize, minimize (with a genie effect into the dock), zoom and snap to the left or right half
- Launchpad, Spotlight search (apps, files, notes, math, web), Mission Control
- Control Center (brightness, volume, dark mode, Focus, full screen) and Notification Center with widgets
- Desktop widgets (clock, calendar, events, music), a particle boot intro, and windows that zoom out of the icon you clicked
- Desktop icons, drag-select, right-click menus, drag files onto folders or the Trash
- Live **three.js 3D wallpapers** (Nebula, Dot Waves, Crystals, Warp) that react to your mouse, plus 8 picture wallpapers or your own photo

**Liquid Glass**
- See-through glass on the dock, menus, Control Center, notifications, widgets and the iPhone home screen, with a light that follows your pointer
- In Chrome the glass also bends what's behind it (System Settings › Appearance)

**English and French**
- PatOS uses French when your device is in French, English otherwise; change it in System Settings › General › Language
- Pat in Messages understands French too ("ouvre calculatrice", "raconte une blague")

**On iPhone (and other phones)**
- PatOS switches to a phone layout automatically (or pick it in System Settings › General › Device style)
- Lock screen: swipe up to open
- Home screen pages with widgets and a 4-app dock; touch and hold an icon for quick actions
- Apps open full screen, zooming out of their icon
- Swipe up from the bottom bar to go home; swipe up and pause for the app switcher (swipe a card up to close it)
- Pull down from the top right for Control Center, top left for notifications; pull down on the home screen to search
- Dynamic Island shows the song that's playing
- In Safari: Share → Add to Home Screen to run PatOS full screen like a real app

**Apps**
| | |
|---|---|
| Finder | files and folders, list/icon view, Trash, import from your computer |
| Patoogle | tabbed web browser with bookmarks, site icons and history. Real Google results with your free Programmable Search ID (Bing until you add one); YouTube links open in the YouTube app |
| Notes, TextEdit, Reminders, Calendar | saved automatically |
| Calculator (basic and scientific), Clock (world clock, alarms, stopwatch, timer), Weather (live forecast) | |
| Music | songs composed live by your computer, a 3D visualizer, and your own MP3s |
| Photos, Paint, Photo Booth | |
| Terminal | `ls`, `cd`, `cat`, `mkdir`, `open`, `neofetch`, `matrix`, `cowsay` and more |
| Galaxy | 3D galaxy generator (three.js) |
| Orb Runner | original 3D neon runner game (three.js) |
| 3D Studio | build a 3D scene with shapes and materials (three.js) |
| Messages | chat with Pat, the built-in assistant (opens apps, does math, adds reminders and notes, tells jokes) |
| App Store | browse every app, open it, add it to the Dock, hide or show it |
| Code Studio | HTML/CSS/JS editor with live preview and a console |
| Piano, Flashcards, Typing Trainer, Voice Memos, Stickies, Dictionary | |
| Contacts | address book with photos, favorites, birthdays and vCard import/export |
| Freeform | endless whiteboard: drawing, sticky notes, text, shapes, pictures, several boards |
| Preview | opens PDFs and pictures |
| Chess | full rules against the computer (3 levels) or a friend |
| Screenshot | real screen pictures and screen recordings (on computers) |
| Tic-Tac-Toe, Maps, System Settings, Activity Monitor | |
| Docs | word processor: styles, fonts, colors, lists, tables, images, find & replace, print, export |
| Sheets | spreadsheet with real formulas (SUM, AVERAGE, IF, COUNTIF, SUMIF…), sorting, charts, CSV import/export |
| Slides | slide decks with themes, text, images, shapes, speaker notes and full-screen presenting with transitions |
| Drive | every document, spreadsheet, presentation and form in one place |
| Forms | surveys and graded quizzes with a results view |
| Translate | 20 languages (MyMemory, needs internet) with read-aloud |
| YouTube | the real YouTube player inside PatOS; search, trending and comments with your own free YouTube API key |

## Keyboard shortcuts

Chromebooks reserve most Ctrl shortcuts, so PatOS uses **Alt**:

| Keys | Action |
|---|---|
| Ctrl+Space or Alt+Space | Spotlight |
| Alt+L or F4 | Launchpad |
| Hold Alt, press ` | App switcher |
| Alt+↑ or F3 | Mission Control |
| Alt+W / Alt+Q / Alt+M | Close window / Quit app / Minimize |
| Alt+← / Alt+→ | Tile window left / right |
| Alt+T / Alt+E / Alt+B / Alt+, | Terminal / Finder / Patoogle / Settings |

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
