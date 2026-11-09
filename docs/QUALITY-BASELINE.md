# PatOS quality baseline

Roadmap **Task 2**. The first measured baseline of PatOS, the targets that follow from it, and how to repeat it.

- Measured: 2026-11-09 on **3.0.0 beta 7** · raw numbers: [`docs/baseline/3.0.0-beta7.json`](baseline/3.0.0-beta7.json)
- Tool: `npm run baseline` ([`scripts/baseline.js`](../scripts/baseline.js)), Playwright + Chromium, 3 runs per profile, medians
- Size budgets that CI enforces: [`test/unit/budget.test.js`](../test/unit/budget.test.js)

## How it is measured

| Profile | What it stands for | Setup |
| --- | --- | --- |
| **desktop** | a laptop or desktop | 1440×900, real CPU speed |
| **chromebook** | an entry-level school / office Chromebook | 1366×768, CPU slowed 4× with Chrome's DevTools throttling |
| **phone** | a phone | iPhone 13 emulation (touch, 390×844, DPR 3), CPU slowed 4× |

Each profile measures: a first-ever start (nothing cached) and three starts of an installed PatOS (service worker ready);
opening 15 apps twice; then, after loading it with a lived-in data set (300 notes, 300 visited pages, 200 contacts, 1,000
files in 20 folders): a start with that data, Spotlight typing (10 queries), a one-second window drag (desktop and chromebook),
storage writes, 5 MB and 20 MB files, memory after opening and closing the 15 apps three times, and an offline start. On
desktop it also runs axe-core (WCAG 2.0/2.1/2.2 A and AA) and a JavaScript coverage tour.

**Caveats (read before comparing numbers):**
- Timings depend on the host. The CPU throttle makes profiles comparable to each other on one machine, not across machines.
  Compare a new run with `--compare` against a baseline made on the same host.
- “App open” and “Spotlight key” are measured up to the second animation frame after the action, so at 60 Hz the floor is
  about 17–33 ms: numbers near that floor mean “as fast as the screen can show it”.
- Headless Chromium has no real GPU: the 3D wallpaper and Liquid Glass's GPU cost are not represented. GPU-side numbers
  need a real-device pass (roadmap Task 67).
- Memory is the JS heap, DOM nodes and event listeners reported by Chrome after a forced garbage collection.

## Results (3.0.0 beta 7)

### Start-up

| | desktop | chromebook | phone |
| --- | --- | --- | --- |
| First-ever start → lock screen | 2,129 ms | **5,976 ms** | 3,110 ms |
| Installed start → lock screen | 376 ms | 713 ms | 1,001 ms |
| Installed start with 1,000 files and 300 notes → lock screen | 371 ms | 783 ms | 699 ms |
| Login → desktop drawn | 236 ms | 437 ms | 748 ms |
| Long tasks during start (count / worst) | 0 / – | 3 / 190 ms | 1 / **548 ms** |
| Script / style+layout time until the lock screen (installed start) | 64 / 27 ms | 196 / 108 ms | 155 / 66 ms |

### Apps and interaction

| | desktop | chromebook | phone |
| --- | --- | --- | --- |
| Open an app, first time (median of 15) | 32 ms | 83 ms | 95 ms |
| Open an app again (median) | 30 ms | 65 ms | 73 ms |
| Slowest first opens | Timeline 45, Patoogle 39, Calculator 36 | **Timeline 169**, Patoogle 130, Notes 118 | **Notes 195**, Timeline 165, Piles 119 |
| Spotlight keystroke, median / worst | 46 / 80 ms | 34 / **214 ms** | 33 / 149 ms |
| Window drag, frame time median / p95 | 17 / 17 ms | 17 / 33 ms | – |

### Storage and memory

| | desktop | chromebook | phone |
| --- | --- | --- | --- |
| Edit one file and save everything, 1,027 nodes in the tree | 2 ms | 14 ms | 18 ms |
| Write a 5 MB file and save | 25 ms | 70 ms | 48 ms |
| Write a 20 MB file and save | 52 ms | 175 ms | 151 ms |
| Read a 20 MB file back | 0 ms (in memory) | 0 ms | 1 ms |
| One `store.get` of 300 notes (deep copy) | 0.33 ms | 1.91 ms | 1.55 ms |
| JS heap after warm-up → after 3 rounds of 15 apps | 32.3 → 31.1 MB | 32.3 → 31.0 MB | 32.8 → 31.2 MB |
| Event listeners / DOM nodes, change over 3 rounds | −212 / −746 | −206 / −747 | −147 / −400 |

### Network and offline

| | desktop | chromebook | phone |
| --- | --- | --- | --- |
| First-ever start | 115 requests, 765 KB transferred (2,785 KB decoded) | 776 KB | 704 KB |
| Installed start | 31 KB transferred | 31 KB | 31 KB |
| Offline start (network off, installed) | works, 1,169 ms to lock | works, 1,094 ms | works, 1,203 ms |

### Accessibility (axe-core 4.14, WCAG A/AA; affected elements)

| View | Count | Impact | Main rules |
| --- | --- | --- | --- |
| Desktop | 1 | moderate | `meta-viewport` (`user-scalable=no, maximum-scale=1` blocks zoom) |
| Settings | 8 | 7 critical, 1 serious | `button-name` ×4, `select-name` ×2, `label` ×1, `color-contrast` ×1 |
| Piles | 2 | serious | `color-contrast`, `scrollable-region-focusable` |
| Notes | 3 | serious | `color-contrast` ×3 |
| Timeline | 3 | serious | `color-contrast` ×2, `nested-interactive` ×1 |

Automated checks find only part of the WCAG issues; keyboard and screen-reader passes stay in Task 59.

### Build and tests

| | 3.0.0 beta 7 | Budget (CI) |
| --- | --- | --- |
| JavaScript loaded at start | 45 files, 1,223 KB (398 KB gzipped) | 1,330 KB / 430 KB gz |
| JavaScript loaded on first use | 54 files, 1,026 KB | – |
| CSS (all loaded at start) | 447 KB | 485 KB |
| three.js, Firebase, PitCode at start | none (on demand) | must stay on demand |
| Single-file build | 3.8 MB | – |
| Tests | unit 8 files / 36, browser 28 / 131, cloud 2 / 9 (cloud not in `npm test`) | – |
| JS executed during start + 15 apps | 45% of 1,216 KB | – |

The 45% is not test coverage: it is how much of the loaded code a simple tour runs, a rough measure of how much code
loads without being needed. True per-test coverage across the browser suite is not measured yet.

## What the numbers say

1. **Installed starts are fast; the first-ever start on a slow machine is not.** 6 s to the lock screen on a Chromebook-class
   CPU for a first visit (115 requests, 2.8 MB of code to parse). Installed starts are under a second. → Task 55.
2. **A few long tasks block the first frames.** One 548 ms task at start on the phone profile and ~200 ms ones on the
   Chromebook profile: the page can't respond during them. → Task 55 / Task 3.
3. **Timeline and Notes are the slowest apps to open** on constrained CPUs (165–195 ms), roughly twice the median. → Task 56.
4. **Spotlight's worst keystroke reaches 214 ms** on the Chromebook profile with a lived-in data set (the first query builds
   the file index). Medians are at the frame floor. → Task 11 / Task 56.
5. **Storage is not a bottleneck at this scale.** One edit plus a full save with 1,027 tree nodes costs 14–18 ms on slow CPUs,
   and 20 MB files write in under 200 ms. This **measures against audit finding 2** (whole-tree saves): at 1,000 files it is
   cheap. The data-integrity side of finding 2 (one record holds the whole tree) still stands for Task 5; the performance side
   should be re-measured at 10,000 files before acting on it.
6. **Deep-copy reads are cheap at this scale** (≈2 ms for 300 notes on slow CPUs), so audit finding 4 is low priority.
7. **No leak was found in the open-and-close cycle**: heap, listeners and DOM nodes all go down across three rounds after the
   warm-up. This covers the 15 measured apps, not every app.
8. **Offline works on all three profiles**, and an installed start downloads only 31 KB.
9. **Accessibility:** 17 automated violations in the views checked; Settings has 7 critical unnamed controls. The viewport
   setting prevents pinch zoom everywhere. → Task 59.

## Targets

Targets are tied to the devices PatOS serves (school and office Chromebooks, phones), and to the Core Web Vitals /
RAIL guidance: an answer within 100 ms feels instant, interaction (INP) is good under 200 ms, a load is good under 2.5 s.
“Keep” means hold today's level; regressions beyond it are bugs.

| Measure | Profile | Today | Target | Status |
| --- | --- | --- | --- | --- |
| First-ever start → lock | chromebook | 5,976 ms | ≤ 3,500 ms | improve (Task 55) |
| First-ever start → lock | desktop | 2,129 ms | ≤ 2,500 ms | keep |
| Installed start → lock | chromebook / phone | 713 / 1,001 ms | ≤ 1,000 / 1,200 ms | keep |
| Login → desktop | chromebook / phone | 437 / 748 ms | ≤ 500 / 800 ms | keep |
| Longest task at start | chromebook / phone | 190–208 / 548 ms | ≤ 200 ms | improve on phone |
| App first open, median | chromebook | 83 ms | ≤ 100 ms | keep |
| App first open, slowest | chromebook / phone | 169 / 195 ms | ≤ 150 ms | improve (Timeline, Notes) |
| Spotlight keystroke, worst | chromebook | 214 ms | ≤ 100 ms | improve |
| Window drag, frame p95 | desktop / chromebook | 17 / 33 ms | ≤ 20 / 34 ms | keep |
| Edit + save (1,000 files) | chromebook | 14 ms | ≤ 50 ms | keep; re-measure at 10,000 files |
| 20 MB file write | chromebook | 175 ms | ≤ 500 ms | keep |
| Memory after 3 open/close rounds | all | −1.2 to −1.6 MB | growth ≤ +2 MB, listeners not growing | keep |
| First-start transfer | desktop | 765 KB | ≤ 800 KB | keep |
| Installed-start transfer | all | 31 KB | ≤ 50 KB | keep |
| Offline start | all | works | must work | keep |
| axe critical + serious, checked views | desktop | 16 (7 critical) | 0 | improve (Task 59) |
| Start-up JS / CSS size | – | 1,223 KB / 447 KB | budgets above (CI) | keep |

## Repeating it

```
npm run baseline                                         # all profiles, prints a summary
npm run baseline -- --json docs/baseline/<version>.json  # save a new baseline
npm run baseline -- --compare docs/baseline/3.0.0-beta7.json
npm run baseline -- --profiles chromebook --runs 1       # a quick check of one profile
```

A full run takes a few minutes. Save a new baseline when a task changes performance on purpose, and quote the before/after
in that task's report. Older `scripts/perf.js` remains for quick single-profile timing.
