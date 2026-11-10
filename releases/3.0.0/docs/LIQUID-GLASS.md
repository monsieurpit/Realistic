# Liquid Glass in PatOS

PatOS has one glass material, defined in `css/glass.css` and driven by `js/shell.js` (`applyTheme` and `PatOS.glassLens`).
Apps never make their own glass: they use a tier.

## Tiers

| Tier | Used for | Blur | Tint (dark / light) |
| --- | --- | --- | --- |
| **clear** | Dock, phone dock, app switcher, Launchpad search (`.lg-clear`): bars of icons, not text | 0.6px | 5% / 12% white, a thick bright bevel |
| **regular** | desktop widgets, Control Center tiles, notifications, segmented controls, Dock labels (`.lg`) | 1.2px (14px over busy wallpapers) | 42% / 50% |
| **elevated** | menus, Spotlight, dialogs, Pat, the notification list (`.lg-elevated`) | 10px (22px over busy wallpapers) | 66% / 74% |

Each tier is an **alpha tint** (never `opacity` on the element, so words and icons stay fully opaque) over the real backdrop,
blurred, saturated (×1.9) and slightly brightened, plus a specular rim (a masked gradient border that catches light at two
corners), a soft inner highlight that follows the pointer (`--mx`/`--my`), and an ambient shadow. Every value is a token
(`--g-*`), so the Tinted style, the light theme and the fallbacks only change tokens.

**Tinted** (Settings › Appearance › Glass style) raises every tint for more contrast, for busy wallpapers.

## Clear glass, read from an iPhone (2.3)

Read from an iOS 26 lock screen (notifications over a dark car photo): the glass adds no color and almost no frost (the photo
stays sharp through the cards), the edge is a 1px specular line whose brightness changes around the shape (brightest upper
left, a second highlight lower right, dim between), the picture bends only where it crosses the rounded edge, and nothing is
painted on the bevel. PatOS now does the same:

- Tints near zero (clear 2.5%, regular 3.5% white in dark mode), blur 0 / 0.4px; menus keep 10px because they hold text.
- `::before` is a 1.25px ring with a `conic-gradient` (angle around the shape → brightness).
- Saturation ≈ 1 everywhere. **2.2.2 saturated the backdrop 1.6–3.2×, which turned purple wallpapers pink**; the deeper
  bevel is now only 7% darker, and the lighter top 4%, both of the background's own color.
- Over a busy wallpaper, regular glass frosts only 4px.
- Pills for bars (Dock, sliders, Launchpad search, segmented controls), 30–34px corners for panels.

## More glass icons and silk wallpapers (2.3.1)

- Docs, Sheets, Slides, Forms and Drive (PatOS's own apps) and the file icons (folder, file with its type, image, audio, link)
  are drawn with the same glass toolkit; file icons have no tile.
- The ~77 system symbols (`PatOS.sym`): closed shapes get a translucent body of their own color (`fill-opacity: .2`) and the
  symbol a soft glow of its color (not in Speed mode or with Reduce transparency).
- Wallpapers Silk, Obsidian, Flame, Glacier and Dune (`paintSilk` in js/wallpaper.js): ribbons of ~70 fine strands, each
  shaded by where it sits across the ribbon (specular highlight near the upper edge, shade in the fold), with a width that
  swells and pinches so the fabric twists; an ambient glow, a vignette and grain. Painted at full size (capped at 2560px wide)
  once, then kept. New installs start on Silk.

## Drawn glass icons (2.3.1)

PatOS's own 57 app icons are drawn as glass objects (js/icons.js, `GLASS`), read from an iOS 26 dark-mode icon (a light bulb):
a graphite tile lit from above, and a toolkit of four layers: `glass()` (a translucent shape in the app's color, see-through at
the top and building to a luminous core near the bottom, a rim bright on top and fading down, and a halo of its color),
`light()` (glowing strokes: halo, bright stroke, white-hot core), `solid()` (opaque parts with a gradient and a bright top
edge) and `bead()` (small glass dots). Each icon's halos share one blur, so an icon costs one blur pass. They carry their own
light, so the embossing filter is not used on them. Google and YouTube keep their logos; file icons are unchanged.

## App icons (2.3)

Icons are small 3D tiles (css/glass.css, "app icons"): inset light for a bright top lip and a shaded bottom edge, a glossy
curved reflection across the top (`::after`), and where icons live (Dock, Launchpad, the phone's home screen, the desktop, the
app switcher) a two-layer shadow. Pointing at one lifts it and sweeps a band of light across it once (`::before`, animated
`background-position`), pressing squishes it (scale .9), and Launchpad's icons pop in with a spring. Fewer animations turns the
movement off. Glass surfaces also have a blur you can almost not see (0.5px clear, 0.6px regular); buttons and search bars
have none.

## Buttons and search bars (2.3)

Every button and search bar uses the same glass, light enough for hundreds of controls (css/glass.css, "controls"):

- **Which:** the shared `.btn`, `.tbtn`, `.field`, `input[type=search]`, and the apps' own buttons and search bars (`.ytx-btn`,
  `.ytx-pill`, `.ytx-q`/`.ytx-sbtn`, `.as-get`, `.of-share`, `.mu-b`, `.ph-nav`, `.wx-unit`, `.wx-search`, `.rc-pb`, `.su-opt`,
  `.pg-qwrap`, `.br-omniwrap`, `.nt-search`, `.of-ssearch`, `.fd-search`, `.st-search`, `.rm-search`, `.ph-search`,
  `.pb-hsearch`, `.m2-search`, `.cal-search`). Text links, list rows, the stopwatch's ring and the game's button keep their design.
- **How:** a 1px border painted with a conic gradient (brightest upper left, second highlight lower right), a highlight on the
  top half, a near-clear tint and a soft shadow. Because the rim is painted under the whole control, an opaque base (the
  window's color) keeps it to the border. Buttons and search bars are capsules; fields are recessed (inner shade at the top,
  the rim turned 180°). Colored buttons (primary, danger) are the same glass filled with their color.
- **In a titlebar** (which is glass) controls have no opaque base: see-through, with the rim drawn as inset light.
- **Over pictures** (Photos' arrows, Weather's controls, the recorder) controls use the dark glass and blur what is behind.
- **No backdrop blur inside windows:** what is behind a button there is the window itself, so a blur would show nothing and
  cost a compositing layer per button.

## Thick glass (2.2.2)

Modeled on a thick gel slab lit from above (the reference was an iOS lock screen: a pink clock slab and a flashlight/camera
pill over a pink picture). Read part by part, and how each is made:

| In the reference | In PatOS |
| --- | --- |
| A milky body, slightly lighter than what is behind, almost no blur | The tier's tint over the backdrop (clear 0.6px blur, regular 1.2px, elevated 10px because menus hold text), a milky top half |
| The whole slab magnifies; the digits stretch toward the edges | The lens (Chromium) is a dome: the face magnifies 10% (at most 14px of shift), and a quarter-circle rim `--g-rim-w` wide bends hardest |
| Sides and bottom are a deeper, more saturated version of the color behind | Inside the lens filter: a copy of the bent backdrop, saturated ×3.2 and darkened to 72%, laid on through a rim picture (bottom full, sides half, top none). The color is always the background's |
| A soft white band hugging the top curve and the upper corners | `::before` inset shadows (they follow the rounded corners) |
| A thin bright line just inside the bottom edge | A 1.5px inset highlight hugging the bottom curve |
| No outline | No border or ring anywhere |
| A soft shadow below | Three outer shadows offset downward |

White highlights are scaled by `--g-glint` (1 over light wallpapers, .75 in dark mode, .4 over dark wallpapers), so glass on a
night sky has a quiet edge, not a glowing frame. Over a busy wallpaper (`html[data-wp-busy]`, measured once per wallpaper),
regular glass frosts to 14px and menus to 22px so words stay readable. Tiles and widgets tilt up to 5° toward the pointer and
everything you press sinks in.

**What did not work, and why it changed:** 2.2.1 tried to make the deeper rim with a `::after` whose `backdrop-filter`
re-read the glass. In Chromium the backdrop of a glass element's own `::after` is empty, so that rim never appeared (tested by
darkening it to 20%: nothing changed). It now lives in the lens filter, which has the real backdrop. Without the lens (other
browsers), a soft neutral shade along the bottom and sides stands in. 2.2.1 also moved the light with the pointer in steps,
which made rims jump; the light is fixed at the upper left. And a missing map used to read as "shift everything", flashing a
bar along an edge while the Dock magnified; a flat 128 grey under the map now means "do not move".

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

## 3.0.0 beta 12: glass follows the wallpaper, not the theme
- Desktop surfaces (Dock, widgets, menu bar) take their tokens from `data-wp-tone` (the wallpaper's overall brightness,
  measured once in `js/wallpaper.js#readTone`): white words over dark pictures, dark words over light ones, in either theme.
  The theme only decides when the picture can't be read (no `data-wp-tone`).
- Surfaces that float over windows (menus, Spotlight, dialogs, notifications, Control Center, Pat) follow the theme, because a
  window of that theme is usually behind them; in light mode they have more body (`--g-tint` .5, `--g-tint-elev` .62).
- Reduce Transparency makes surfaces solid, so their words follow the theme (`--g-text: var(--text)`).
- App icon tiles: `html.icons-light` (Settings › Appearance › App icons: Automatic follows the theme, or Dark / Light).
