# PatOS signature and Flow

`css/signature.css` (loaded last) and `js/flow.js` give PatOS its own frame and motion. The Liquid Glass material in
`css/glass.css` is not touched.

- **Window controls**: `.traffic` is one capsule; `.tl.close/.min/.max` draw glyphs with CSS masks (`--g-close`, `--g-min`,
  `--g-max`, `--g-restore`). The DOM and the behavior are unchanged (zoom = full screen, Alt+zoom = maximize).
- **Focused window**: `.window.active` gets an accent rim and a soft accent glow.
- **PatOS mark**: `--patos-mark` (a drawn P) on `--mark-bg` (accent gradient) in `.mb-logo` and `.boot-logo`.
- **Lock screen** (desktop): clock lower left, login card lower right, power capsules top right. Phones keep their layout.
- **Flow** (all off with Reduce Motion or Speed mode):
  - arrival after login (watches `#lock.unlocking`), animating `translate`/`scale` so it never fights other transforms;
  - light/dark through a View Transition circle from the last pointer position; accent cross-fades. Only for changes made by a
    click or key (`navigator.userActivation`); the setting is saved synchronously, only the repaint is inside the transition;
  - `.seg` tabs: a FLIP "glide" of the selected highlight (`.seg-glide`);
  - Launchpad wave (`--w` = distance from the middle), `PatOS.paneIn(el)` for page changes (used by Settings);
  - menus, notifications and button presses.
Tests: `test/browser/signature.test.js`.
