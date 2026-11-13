# The PatOS design system (3.3)

One look for everything, from one place.

- **Tokens** (`css/design.css`, `:root`): type scale (`--fs-*`), spacing (`--sp-1`…`--sp-6`), corners (`--r-*`), heights
  (`--h-control` 32px, `--h-side` 34px, `--h-row` 44px, `--h-toolbar` 52px), meaning colors (`--ok --warn --bad --info`),
  focus ring, durations and easing, layers (`--z-*`).
- **The kit** (`css/ui.css`, loaded last): sidebar, sidebar item, section heading, grouped list and row, empty page, badge,
  avatar, progress, keycap, search field, segmented control, sheet, inspector; and one pressed / focused / disabled / selected
  look, one selection color and one scrollbar for every app. Each app's older version of a component is mapped onto the
  kit, so they all match.
- **PatOS.ui** (`js/ui.js`): the same components as functions. New screens use these instead of inventing classes:
  `ui.sidebar`, `ui.item`, `ui.heading`, `ui.empty`, `ui.group`, `ui.row`, `ui.section`, `ui.badge`, `ui.avatar`,
  `ui.progress`, `ui.kbd`, `ui.search`, `ui.segmented`, `ui.sheet`.
- **The guard** (`test/unit/design-system.test.js`): fails if an app styles a sidebar, a sidebar item or an empty page the kit
  doesn't know, so nothing drifts.
