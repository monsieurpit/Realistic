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
- Launchpad, Spotlight search (apps, files, notes, math, unit conversions like "5 km to mi", quick timers like "timer 10", with a preview panel), Mission Control
- Quick Look: select a file and press Space
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
| Finder | icon and list views, sorting, path bar, multi-select, color tags, info panel, Quick Look (Space), keyboard navigation, Trash, import from your computer |
| Patoogle | tabbed web browser with bookmarks, site icons and history. Searches show real Google results right inside PatOS (no setup). Optional: Google's official search box (free ID, or `GOOGLE_CX` on Render), Patoogle's Wikipedia results, or Bing. YouTube links open in the YouTube app |
| Calendar | month and week views, event editor (time, color, notes), upcoming events, reminders |
| Notes | folders, pinned notes, pictures (paste or insert), checklists, tables, Recently Deleted, export to text or Docs |
| Reminders | lists with colors, due dates and times with alerts, priorities, flags, smart lists (Today, Scheduled, Flagged, All, Completed) |
| TextEdit | plain text and code editor |
| Calculator (basic and scientific), Clock (world clock, alarms, stopwatch, timer), Weather (live forecast, saved cities, 24-hour chart, air quality) | |
| Music | songs composed live by your computer, a 3D visualizer, your own MP3s, shuffle and repeat, and your device's media controls (Chromebook media keys, iPhone lock screen) |
| Photos | albums, favorites, slideshow, and an editor with filters, brightness, contrast, color, warmth, vignette, crop and rotate |
| Paint, Photo Booth | |
| Terminal | pipes (`|`), `&&`, `>` redirects; `ls -l`, `grep`, `wc`, `head`, `tail`, `sort`, `find`, `curl`, `ping`, `weather`, `todo`, `neofetch`, `matrix` and more |
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
| Grapher | plot several functions (y = x², sin(x), ln(x)…), pan, zoom, trace values, save the graph as a picture |
| Elements | the full periodic table with details on all 118 elements, category filters and a molar mass calculator |
| Focus | study timer (25/5/15) with your task, rain or noise sounds, a daily goal, streaks and a 7-day chart |
| Journal | one page a day with your mood, a writing prompt, word count, streak and search |
| Sudoku | fresh puzzles with one solution (easy, medium, hard), notes, hints, undo, timer and best times |
| YouTube | works like youtube.com: home feed, search with suggestions, Shorts, channels, comments, related videos, autoplay, subscriptions, likes, Watch later and history. No API key needed on the PatOS website |
| News | live headlines from NPR, Al Jazeera, Engadget, Space.com, NASA, Radio-Canada and La Presse, with saved stories |
| Books | 70,000 free classics from Project Gutenberg in a page-turning reader (text size, themes, remembers your page) |
| Radio | thousands of live radio stations from around the world, by country or genre, with favorites |
| Videos | play your own video files with speed control and Picture in Picture |
| Phone & Web apps | install Snapchat, Instagram, TikTok, WhatsApp, Spotify, Discord, Roblox and 30 more from the App Store. On iPhone/iPad they open the real app (or its App Store page), on Android/Samsung the real app (or Google Play), and on a computer the app's website (inside PatOS when the site allows it, otherwise in its own window) |
| Solitaire | classic Klondike: drag or tap, draw 1 or 3, undo, auto-finish, stats |

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
- Environment variables: none needed. Render sets `PORT` itself. Optional: `GOOGLE_CX` (a Google Programmable Search ID) to give everyone Google's official search box in Patoogle.

YouTube, News and Books get their data through the PatOS server (`yt.js`, `services.js`), so they work on the website. The single-file and Claude Artifact versions have no server, so those apps ask you to open the website.

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
server.js           tiny server for Render (static files + /api)
yt.js               YouTube data for the YouTube app (no API key)
services.js         News and Books data
build.js            makes the single-file versions in dist/
```

## Storage, files and code (added)
- Everything is stored in IndexedDB (large quota, survives reloads). Old localStorage data migrates once.
- Real files: open files from the Chromebook or link a folder (File System Access API), save copies back.
- Real formats: Docs/Sheets/Slides import and export .docx/.xlsx/.pptx; zip compress/extract.
- Screen Recorder: screen with optional microphone, system sound and camera bubble; saves to Videos.
- Python (Pyodide, served by `/pyodide/*`) in Code Studio and Terminal (`python`, `node`).
- `/api/frameable` tells Patoogle whether a site allows being shown inside PatOS; if not, it opens in its own window.
