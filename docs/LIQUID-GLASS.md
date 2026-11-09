# Liquid Glass in PatOS

PatOS has one glass material, defined in `css/glass.css` and driven by `js/shell.js` (`applyTheme` and `PatOS.glassLens`).
Apps never make their own glass: they use a tier.

## Tiers

| Tier | Used for | Blur | Tint (dark / light) |
| --- | --- | --- | --- |
| **clear** | Dock, phone dock, app switcher, Launchpad search (`.lg-clear`): bars of icons, not text | 1.5px | 5% / 12% white, a thick bright bevel |
| **regular** | desktop widgets, Control Center tiles, notifications, segmented controls, Dock labels (`.lg`) | 20px | 42% / 50% |
| **elevated** | menus, Spotlight, dialogs, Pat, the notification list (`.lg-elevated`) | 32px | 66% / 74% |

Each tier is an **alpha tint** (never `opacity` on the element, so words and icons stay fully opaque) over the real backdrop,
blurred, saturated (×1.9) and slightly brightened, plus a specular rim (a masked gradient border that catches light at two
corners), a soft inner highlight that follows the pointer (`--mx`/`--my`), and an ambient shadow. Every value is a token
(`--g-*`), so the Tinted style, the light theme and the fallbacks only change tokens.

**Tinted** (Settings › Appearance › Glass style) raises every tint for more contrast, for busy wallpapers.

## Thick glass (2.2.1)

Every glass surface is drawn as a thick, curved slab rather than a flat sheet:

- **Bevel**: a bright top lip and a glow just inside the edge, a shaded bottom lip (`--g-depth`).
- **Thickness color**: `::after` is a band about 8–16px wide along every edge that re-reads the glass itself
  (an element with `backdrop-filter` is the backdrop of its own `::after`) more saturated and a little darker. The rim
  therefore takes the color of whatever is behind it, deeper, like light crossing more glass. It adds no color of its own.
- **Bulging face**: brighter toward the top left and wherever the pointer is, a little darker toward the bottom right.
- **Float**: a three-layer shadow (contact, near, far).
- **Lens on every surface** (Chromium): menus, Control Center tiles, notifications, widgets, Spotlight, dialogs, not just
  the Dock. The edge follows a quarter circle (flat face, steepest at the rim). Surfaces that appear later (menus,
  notifications) are found by a MutationObserver and get their lens as soon as they are laid out.
- **Tilt**: Control Center tiles and desktop widgets tilt up to 5° toward the pointer (not with Fewer animations).
- **Same rim on every size**: the rim band and the lens both use `--g-rim-w` (11px, at most 30% of a small surface), so a
  tiny tile and a wide panel look cut from the same glass.
- **Caustic**: a bright curved line just inside the bottom edge (light focused by the rounded rim), strongest on the side away
  from the light, and a fainter arc along the top lip.
- **One light**: `--g-angle`, `--g-lx`, `--g-dx` place a single light above the screen that leans toward the pointer in 15°
  steps (only 7 positions, so styles are rarely recalculated). Every rim, sheen and caustic is drawn from it.
- **Busy wallpapers**: `readTone` also measures how much fine detail the wallpaper has (average brightness jump between
  neighbouring pixels of a 48×32 copy). Over a busy picture (`html[data-wp-busy]`), glass that holds words blurs 22–32px
  and gets a little more tint, and words get a stronger halo. The Dock stays clear.
- **Highlights follow the light that is there** (`--g-glint`): every white rim, lip and glint is scaled by 1 over light
  wallpapers, .75 in dark mode and .4 over a dark wallpaper, so glass on a night sky has a quiet edge, not a glowing frame.
- **Pressed in**: buttons, menu items, tiles, toggles and app icons sink when pressed (shade moves inside the top edge, light to
  the bottom, a slight darkening and shrink).

All of it is turned off by Reduce transparency, forced colors and Speed mode.

## Lens edges (refraction)

In Chromium browsers (Chrome, Edge, Chromebooks), every glass surface (since 2.2.1; before, the Dock, the app switcher and Launchpad's search) bends what is behind
their rounded edges, while their middle stays clear, like the rim of a thick pane. `PatOS.glassLens` draws a displacement
map for each bar's exact size and corner radius (a signed distance to the rounded rectangle: red is sideways, green is
up/down, 128 means no move, strongest at the rim and fading along a quarter circle to nothing 8 to 26px inside, about 30% of the short side, so the face stays clear; big panes get a half-size map) and puts it in an SVG
`feDisplacementMap` that the bar's `backdrop-filter` uses before the blur. Maps are cached by size and made only when a bar
settles at a new size, so the Dock's magnification does not redraw them every frame. Other browsers can't use an SVG filter
in `backdrop-filter` (Safari would drop the whole blur), so they get the same glass without the bend.

## Windows

Window contents are opaque (`.win-body` sits on `--win` over `--win-solid`): text, editors and tables are always solid.
The **titlebar** is glass (regular blur over the window's toolbar color at 72%, 86% when Tinted). Before 2.2.0 every window
blurred everything behind its whole area, under a 92% opaque background where the blur could barely be seen. With six windows
open that was 3.04 megapixels of blur and is now 0.44 (headless Chromium, 1440×900; dragging a window went from about 72ms
to about 24ms a frame on the same machine with software rendering, so a real graphics chip will show different numbers, but
the work saved is the same). Windows with no titlebar (`titlebar: 'hidden'`) are one solid piece.

## Adapting to the wallpaper

Each time the wallpaper is drawn, `readTone` (js/wallpaper.js) looks at 48×32 pixels of it once and sets
`html[data-wp-top]` and `html[data-wp-bottom]` to `light` or `dark` (relative luminance above 0.3, where black and white text
have about the same contrast). The menu bar uses it: dark words over a light picture and white words over a dark one,
whatever the theme. Nothing runs in the background.

## Turning it down

- **Reduce transparency** (the setting, the system's `prefers-reduced-transparency`, or Speed mode): solid surfaces, no blur,
  no lens, same shapes.
- **Fewer animations**, or the system's `prefers-reduced-motion`: no transitions.
- **No backdrop blur in the browser**: every tint becomes almost opaque, so nothing reads as a see-through sheet with sharp
  text behind it.
- **Forced colors** (Windows High Contrast): system colors with real borders, no glass.
- **Phones**: smaller blurs, no lens.

## Compared with macOS Liquid Glass

This comparison is from Apple's published description of Liquid Glass (WWDC 2025 and the macOS 26 releases), not from
screenshots taken side by side on a Mac: no Mac was available when it was written. It should be checked against a real Mac.

| Dimension | macOS 26 | PatOS 2.2 |
| --- | --- | --- |
| Transparency | Clear tier shows the content behind | Same idea: the clear tier is a 5–12% white lift at 1.5px blur with a bright bevel and lens rim, so the wallpaper reads through the Dock (since 2.2.1, after comparing with a macOS 27 Dock picture) |
| Material quality | Blur, saturation, tint, depth | Blur, saturation, tint and shadow from shared tokens; the clear tier lifts toward white (×1.1) instead of darkening |
| Lighting | Light that moves with the device and content, specular edges | A fixed specular rim, plus an inner highlight that follows the pointer; nothing reacts to motion sensors |
| Lensing | Real-time refraction of what is behind, everywhere | Displacement-map lens on the Dock, app switcher and Launchpad search, Chromium only; static, no chromatic dispersion |
| Adaptability | Adapts continuously to the content under each element | Menu bar adapts to the wallpaper (read once per wallpaper); other surfaces use theme tokens and do not adapt to windows under them |
| Consistency | System-wide | One file, three tiers; app sidebars are styled panes but are not see-through to the desktop |
| Readability | Automatic contrast | Text-heavy surfaces are the thickest tier, window contents are opaque, Tinted style for more contrast |
| Animations | Fluid morphing between shapes | Short scale-in for menus, springy presses; no shape morphing |
| Performance | Native GPU compositing | Browser `backdrop-filter`; blur area cut by 86% for windows, fewer blurs on phones, none in Speed mode |
| Accessibility | Reduce Transparency, Increase Contrast, Reduce Motion | The same three, from the settings or the system, plus forced colors |
| Customization | Clear or Tinted (26.1) | On/off, Transparent or Tinted, lens on/off, Reduce transparency |

Where macOS is clearly ahead: live adaptation to whatever is under each element, refraction everywhere and on every
browser, and shape morphing. Those need either per-frame pixel reading (too costly in a browser) or support that only
Chromium has.
