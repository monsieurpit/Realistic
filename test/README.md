# PatOS tests

```
npm test            # everything
npm run test:unit   # server and dictionary checks (no browser needed)
npm run test:browser
```

Browser tests use Playwright with Chromium. If Playwright isn't installed they are skipped:

```
npm i -D playwright && npx playwright install chromium
```

| File | What it checks |
| --- | --- |
| `unit/server.test.js` | files, compression, 304s, private files never served, path tricks, the frame check refusing private addresses |
| `unit/i18n.test.js` | no French key written twice; lists strings that have no French yet |
| `browser/core.test.js` | file system (create, rename, move, copy, trash, restore), saving across restarts (including a reload right after saving), moving old localStorage data, settings defaults |
| `browser/apps.test.js` | every app opens in English, French and on an iPhone (with a way home); window maximize, minimize, restore, close |
| `browser/formats.test.js` | Word, Excel, PowerPoint and zip round trips, the Scanner's PDF, spreadsheet formulas, the Grapher's math |
| `browser/glass.test.js` | Liquid Glass: see-through tiers, the Dock's lens, glass titlebars over opaque windows, the menu bar following the wallpaper, Tinted, Reduce transparency and the system preferences, notifications never covering Control Center |
| `browser/system.test.js` | starting offline, windows coming back, timers ringing, Spotlight, the phone's back button |
