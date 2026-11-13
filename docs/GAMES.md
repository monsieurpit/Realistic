# Games (4.1)

## The Games app (`js/apps/games.js`)

- **Home:** the Daily Challenge, what's new (Orb Runner, until it's opened from here), and every PatOS game with your best
  score.
- **Achievements:** 25 of them, grouped by game.
- **Leaderboards:** for 2048, Snake, Breakout, Orb Runner, Slither and the daily challenge. You can view your friends
  (the people you talk to in Messages) or everyone.
- It is built with the design system (`PatOS.ui`): sidebar, sections, groups, segmented controls and empty pages.

## Game Center (`js/gamecenter.js`, loaded from the start)

Every game calls `PatOS.gc.report(game, { score, win, level, tile, world, gems, daily })` when a round ends, and
`PatOS.gc.event(game, name)` for other moments (a ball bought).

- **Stats and achievements** are kept on the device: `gcStats`, `gcAch`.
- **Unlocks:** several achievements unlocked at once show as one banner.
- **Daily Challenge:** a 2048 dealt from a seed made from the date, so everyone gets the same tiles. Its board is
  `2048-d<YYYYMMDD>`.
- **Leaderboards** are stored in Firestore at `scores/{board}/players/{uid}`. `firestore.rules` enforces:
  - one best score per person;
  - you write only your own, under your own username;
  - a score can only go up;
  - between 0 and 100,000,000;
  - board names are checked;
  - banned accounts can't post.
- **Offline:** scores wait on the device until there's a connection.

**To do:** publish `firestore.rules` in the Firebase console, or leaderboards won't save.

## Orb Runner (`js/apps/orbrunner.js`)

- **8 worlds**, a new one every 1,500 points. Each has its own colors, weather, scenery and obstacle shapes. Later worlds
  add rolling balls and gem arcs.
- **The Ball Shop:** gems are money, and there are 11 balls.
- **Power-ups:** Magnet, Shield and Double.

## Tests

- `test/browser/games41.test.js`
- `test/browser/orbrunner41.test.js`
- `test/cloud/leaderboards.test.js` (the real rules, against the emulator)
