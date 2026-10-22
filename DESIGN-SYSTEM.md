# Design system

The active portfolio is `prototype-v2`. The original `prototype` and root-level `prototype-v2/app.js` / `styles.css` are archived experiments; the running React app uses `src/`. All new site work must use this system.

## Editing the system

`src/design/tokens.css` is the public import. It loads these authoring collections and reusable styles:

- **primitives.css** — Color, Font (family/weight), Scale. Nine full color ramps use 50, 100–900. Existing material/light/screen colors remain explicit scene primitives. The current palette is provisional and intentionally preserved. Font weights are numeric CSS values, including the variable-font weights already used by the site.
- **responsive.css** — Breakpoints, Layout, Spacing, Radius, Border, Text, Transparency. Base values are Desktop; named Tablet and Mobile media blocks override the same variables. Dimensional values alias pixel Scale; columns use unitless count Scale; opacity uses unitless ratio Scale. Fluid lengths use Scale-backed endpoints and viewport interpolation. `1px` is an explicit exception for hairlines and exact migration of existing odd measurements.
- **theme.css** — Surface, Line, Action, State, Text, Icon. Light and Dark share the same semantic names, using primitive aliases. Warning/error/info and disabled control roles are included. Scene colors, fixed artwork surfaces and `--code-*` syntax roles have explicit roles so illustrations, photo-overlay text and code remain readable independently of page theme.
- **typography.css** — Complete `.text-xxs` through `.text-9xl` styles: family, weight, size, line-height and tracking. Editorial hero/project sizes remain separate aliases to preserve the existing composition.
- **effects.css** — Gradient, outer/inner shadow, blur and liquid-glass recipes. Card, Elevated and Icon retain the exact supplied Figma angle/intensity/refraction/depth/dispersion/frost/splay metadata. Web rendering uses layered fill/highlight, backdrop blur and shadow; optical metadata has no native CSS equivalent. Unsupported backdrop blur uses opaque fallbacks for reusable glass styles.

Change the narrowest shared role matching the request. To change all canvas backgrounds, edit `--surface-canvas` in the relevant theme. To change the underlying neutral everywhere it is used, edit `--color-stone-100` in Primitives. To change header padding across consumers, edit `--space-header-y`; to change the heading family everywhere, edit `--font-family-heading`. Changes propagate automatically through CSS aliases.

Components must use Theme/Responsive/text/effect aliases. Only this system's reference page displays color primitives directly. New repeated values belong in the appropriate collection; never add component-local raw colors or pixel dimensions. Zero resets, percentages, grid fractions, artwork geometry and motion math are structural values and may remain literal. Timing and motion-distance aliases are an additional effects convenience.

## Responsive modes

Mobile is up to and including 700px; Tablet is above 700px through 980px; Desktop is above 980px. Desktop's reference width is 1440px. Layout columns are 4/8/12, gutters are 12/16/24px and margins are 20px on Mobile and Tablet and 40px on Desktop, matching the bricxlabs.com reference so the header, hero and every section share one edge.

Use `@media (--tablet)` and `@media (--mobile)`. `scripts/design-breakpoints.mjs` resolves these queries from `--breakpoint-*` aliases in Responsive and their Primitives values. Never repeat numeric query widths in component CSS. Next.js runs this through the local `postcss-design-media` package (`scripts/postcss-design-media`, registered in `postcss.config.mjs`), and `next.config.mjs` exposes the resolved Mobile width to image `sizes`. Restart the development server after changing breakpoint definitions so every cached stylesheet is rebuilt.

## Theme behavior and reference

New visitors start in Light. The theme switch lives in the footer utility row (home and Library footers), not the header: theme is a rare preference, and the hero artwork looks the same in both themes, so a header toggle gave no visible feedback. It remembers the choice and synchronizes changes across tabs and across toggles on the same page. Blocked storage does not prevent switching. Initialization runs before rendering; the browser theme color follows the canvas token. Capture mode starts in Light for deterministic captures and does not overwrite a saved preference.

Open `/design-system` on the local preview to inspect ramps, semantic roles, layout grids, spacing, every text style and all three glass treatments. Resize the viewport and toggle theme to review changes. This is a reference, not a token-editing UI: edit the collection source to change the site.

## Verification

`npm run check:design` validates token references, theme groups, complete text styles, breakpoint ordering and component stylesheet usage. `npm run build` runs that check, TypeScript and the production build. The guard rejects new raw colors, pixel values, font weights, typography metrics, primitive color/scale/family references and numeric responsive queries in component CSS.

For visual changes, inspect the affected view in both themes and at Desktop/Tablet/Mobile. Check 700/701px and 980/981px after breakpoint changes, narrow 320px layouts, focus visibility, contrast and glass fallbacks. A successful build alone does not confirm visual fidelity. Figma optical glass fidelity is approximate.

## Primary keycap

All four primary CTAs use the shared Design Minis keycap recipe: shell, inset face, raised label and source rest/hover/press geometry and shadows. Light uses the reference charcoal palette; Dark uses the approved stone palette. Edit `--action-keycap-*` in Theme, `--keycap-*` geometry in Responsive, `--text-control-*` in Typography, and `--shadow-keycap-*` / `--gradient-keycap-*` in Effects. The primitives preserve exact source alpha bytes. The reference page includes both palettes and forced interaction samples. Existing labels and hrefs are retained.

The keycap has three sizes. The default (Closing, HireBand, reference page) keeps its padding-derived height. The header uses `--header-control-size` (32px, 14px label) and the hero uses `--hero-action-height` (44px, `--text-control-lg-size` 16px label). Fixed-height keycaps add `--keycap-lip` (face bottom inset minus top inset) as bottom padding so the label centers on the key face, not the shell.

The reference site's Geist font download was declined. `--font-family-control` requests Geist Sans and falls back to the existing bundled body font; exact glyph matching is pending a locally bundled Geist font. No remote font request is introduced. Source: https://www.designminis.com/ (public keycap CSS inspected 7 October 2026).

## Header and hero HUD

The header and hero HUD follow the bricxlabs.com reference sizes (measured from computed styles at 1440×900, 9 October 2026). Edit the role tokens in Responsive rather than the component rules:

| Element | Token | Value |
|---|---|---|
| Header padding | `--space-header-y`, `--layout-margin` | 16px top and bottom · 40px sides (mobile header: 16px top, 20px sides) |
| View pills | `--header-pill-height`, padding `--space-sm`, gap `--space-3xs` | 30px · 0 12px · 2px, no divider before Library |
| Logo | `--header-logo-height` | 20px tall (40×20; the 2:1 mark is matched on height) |
| WhatsApp button, header keycap | `--header-control-size`, icon `--header-icon-size`, gap `--space-3xs` + `--keycap-outline-width` | 32px · 16px icon · visible 2px gap |
| Hero badge | `--badge-height`, pulse `--duration-2000` | 28px · the dot sends out a fading ring |
| Hero actions | `--hero-action-height`, `--text-control-lg-size`, gap `--space-2xs` + `--keycap-outline-width` | 44px · 16px · visible 4px gap, equal widths |
| Hero headline | `--text-hero-size` | ≤64px desktop, ≤48px tablet, ≤46px mobile (always below the reference's 72px) |
| Hero name line | `.hero-line--name`, same tokens as the headline | "Abbas Alabura -" opens the `<h1>` on its own line, then the sentence follows with the role in Source Serif 4 Italic (olenkevich.com, "high" mode). It shares the char reveal, the weight hover and the HUD contrast check |
| Hero meta | `--text-meta-size`, `--space-hero-footer-gap`, `--space-hero-bottom` | 12px (11px mobile) · 64px below the buttons (56px mobile) · 40px from the bottom edge, no divider |

The keycap draws a 1.5px outline ring outside its box, so any gap beside a keycap adds `--keycap-outline-width` to keep the visible space equal to the reference.

**Current view.** The pill for the view you're on fills with `--action-current` and white ink (`--action-on-current`), with `--action-current-hover` on hover.
- **Which pill:** `SiteHeader` reads the URL. `/` and case studies (`/work/...`) mark Work; `/library` marks Library. The link gets `aria-current="page"`, which is also the CSS hook.
- **Index and Yard:** they still scroll within the home page, so they join the mapping once they become views of their own.
- **Over the hero:** the home hero declares `data-header-current="glass"`, and the current pill keeps the same glass as the others there. `SiteHeader`'s tone sample also sets `data-current` (`glass` or `accent`) on the pills, so the red fades in once the hero scrolls out from behind them. The first paint guesses from the URL: `glass` on `/`, `accent` elsewhere. `aria-current` stays either way.
- **Colour:** red-600, not the red-500 accent. White 14px labels pass AA at 5.0:1 on red-600 and fail at 4.1:1 on red-500. It's the same in both themes and both header tones, and red appears nowhere else in the HUD, so it only ever means "you are here".
- **Mobile menu:** a `--current-dot-size` red dot before the current item.

Every translucent HUD element (view pills, WhatsApp, badge, the secondary `.glass-button`, the mobile logo and action tray) shares one glass recipe in Effects: `--glass-icon-fill` (stone-900 at 25%), `--glass-icon-blur` (12px), `--shadow-glass-icon`, and `--glass-icon-fill-hover` (40%) on hover. The tint is the same in both themes because the HUD always sits over artwork. Controls inside the glass mobile tray stay clear so glass is never stacked. Don't add a second translucent recipe; retune these tokens. The pill hover keeps its `translateZ` lift.

The fixed desktop header changes tone with whatever is behind it, cluster by cluster. `SiteHeader` samples behind the pills, the logo and the tools separately (on scroll, resize, theme change and image load) and sets `data-tone` on each.
- **What decides:** walking the stack under the cluster's centre, topmost first, the first match wins:
  1. a declared `data-header-tone`;
  2. else the first image or solid background that fills the cluster's whole box. An image is judged by its average brightness from a 24px thumbnail, cached per file.
- **Elements count too:** a dark card or photo behind the pills turns them dark inside a light section. A small chip or a line of text never flips them.
- **Light glass:** over light backdrops a cluster re-points the glass aliases to `--glass-light-*`: stone-50 at 90% over a plain `blur(12px)` (the page frosts through), solid stone-50 on hover, and stone-900 ink. The logo turns black.
- **Keycap:** "Book a call" is white whenever the tools sit on dark.
- **Artwork sections:** sections whose background is artwork declare `data-header-tone="dark"`, as the hero does. Add that attribute to any new section or element whose visible surface differs from its background colour.

## Client logo grid

The "Trusted by" grid sits directly below the hero (`ClientLogos`, data in `src/content/clients.ts`) and copies the bricxlabs.com client grid. Cells run: the label, one tile per client, then an outlined "And many more". Tiles carry no stand-in text; each explains itself in a tooltip about the work, taken from the résumé. Don't cite or invent press.

- **Layout:** 5 columns on Desktop (label + 4 logos, then 4 logos + "And many more", so a logo card sits under the label), 3 on Tablet and 2 on Mobile. Tablet and Mobile hide "And many more" so every row is full; on Mobile the label takes its own row at half width with no tile. Cells use a 173/88 aspect ratio, `--radius-tile` (10px), `--logo-tile-pad` and `--logo-grid-gap`.
- **Colour levels** match the reference in our palette. Each is the section white mixed with ink: `--surface-tile` 2%, `--surface-tile-hover` and `--line-tile` 6%, `--text-tile` 60%. The reference's label grey is about 3.9:1; ours is a shade darker (about 5:1) to pass WCAG AA at 14px. The mixes use the theme's own ink, so Dark gets the same steps automatically.
- **Logo files** go in `public/logos/clients/`, named by slug or company name (`marven-grey.svg` or `Marven Grey.svg`; `.png` / `.webp` / `.ico` also work). `src/lib/clientLogos.ts` finds them at build time (on each request in development). Logos keep their grey tones through `--icon-logo-filter` (`grayscale(1)`; Dark adds `invert(1)`); a client with `onDark` (a logo drawn for dark backgrounds, with white lettering) uses `--icon-logo-filter-on-dark`, which flips the other way. They sit at `--opacity-60` rising to `--opacity-90` on hover. They share `--logo-height` and `--logo-max-width`; a client's `scale` field balances an optically large or small mark.
- **Tooltips** come in two variants, as on the reference. The plain one is a centred sentence, 240px wide. A client with `funding` gets the rich one: 340px wide, the sentence, then "Raised **$X** from" or "Backed by" and investor chips (a 20px white circle with the investor's icon, then an 11px name). Both use `--tooltip-fill` (stone-900 at 70%), `--tooltip-line`, 12px blur and `--shadow-tooltip`. They open on hover or keyboard focus, toggle on tap, and shift to stay `--tooltip-edge` inside the viewport.
- **Funding data must be sourced.** `funding.source` is required: add only amounts and investors published by the company or a reputable outlet. Investor icons go in `public/logos/investors/<slug>.(svg|png|webp|ico)`; until a file exists the circle shows the investor's initial.


## Statement section

`Statement` sits directly below the client grid. It copies avecanni.studio's about layout, measured at 1440×900 on 13 October 2026:
- **Section:** one viewport tall on desktop, on `--surface-bright` like the grid above, so the two read as one surface.
- **Statement:** top left, up to `--statement-headline-width` (1000px). It uses cr8ivelarry.live's about-line metrics in the display serif: `--text-statement-size` (48px, 24px on mobile), weight 500, `--text-statement-line` 1.05, tracking −0.02em.
- **Portrait block:** bottom right, `--statement-aside-width` wide. An 80×100 portrait (`--statement-portrait-*`, 144×180 on mobile, 4:5 crops from `assets/profile.png`), the handwritten "Led by Abbas" (`--text-signature-*`, *Nothing You Could Do*), then the note in the `lg` body style.
- **action studios:** the lowercase wordmark fills the bottom left. Its column is a size container, so `--text-wordmark-size` (19.4cqi) always spans it.
- **Tablet and mobile:** one column. Mobile stacks it as the reference does: statement, note, portrait, wordmark.

**Scroll fill** (`ScrollFillText`) is an exact port of cr8ivelarry.live's `ScrollColorChangeText`:
- Progress runs while the statement's top moves from 80% to 20% of the viewport.
- Letter *k* of *N* (spaces excluded) fills over [k/N, (k+1)/N]: opacity 0.2 → 1 and `--text-statement-start` → `--text-statement-end`, linear.
- The server HTML is fully inked; reduced motion and captures stay that way.

**Wordmark reveal** (`WordmarkReveal`): ink masked by a soft radial light (`--statement-torch-radius`, `--mask-solid`).
- **Fine pointer:** the light trails the cursor and swells in and out with the section.
- **Touch:** it sweeps across the word once, scrubbed by scroll.
- **Reduced motion:** a static `--text-wordmark-ghost`.
- The effect is self-contained, so it can be swapped without touching the section.
## Favicon

The favicon is two files: `public/favicon-light.svg` (dark mark on a light tile) and `public/favicon-dark.svg` (light mark on a dark tile). `layout.tsx` links the light file, `themeInit` switches to the dark file before first paint, and `useTheme` swaps them when the theme changes. Edit the files directly to change the icon; keep the two in step.

## Cursors

The site's cursors are 3D renders baked into tiny PNGs and served as native CSS cursors. The operating system draws them, so they never lag the mouse, run no JavaScript and cost no GPU time. A live three.js cursor would trail the pointer by 1–3 frames and stutter whenever the main thread is busy. A GLB model would add a download and still need a live renderer.

- **Source:** the vector cursors in `lab/cursors/source/`, with `pointer.png` and `hand.png` as the look references. `lab/cursor-specs.mjs` maps each SVG to a token, a hotspot, a rim width and a keyword fallback.
- **Studio:** `lab/cursors.html` is a single-file, plain three.js lab outside Next.js.
  - **Geometry:** each cursor is built from its SVG as a white satin face on a near-black lacquer body. Clipper grows the outline by the SVGs' 3-unit rim. Every cursor uses the same materials, as in the references.
  - **Camera:** a shift lens, as in architectural photography. The camera stands down-left but faces the cursor square-on, so the face keeps its exact SVG shape (level stays level) while the depth shows on the left and bottom.
  - **Light:** a procedural warm room with neutral softboxes, a near area light that gives the face its fade, and one shadow-casting key.
  - **Render:** 256 jittered samples per image, for anti-aliasing and soft area-light shadows. Each file renders at 4× or more, the bake downsamples it with Lanczos, and tone mapping (Khronos PBR Neutral) runs once.
  - **Colours:** materials and shadow come from `--scene-cursor-face`, `--scene-cursor-body` and `--scene-cursor-shadow`. The shadow is tinted stone-700 because pure black reads violet on our warm page.
- **1x hinting:** the SVGs are drawn on a 64-unit grid and the cursors are about 22px, so 1x strokes would fall under 1.5px. As fonts do at small sizes, the 1x files get a fuller rim, a shallower body and, for thin icons (`hint` in the specs), a wider face. All three densities share one crop and hotspot.
- **Bake:** run `npm run cursors`. It renders in headless Chrome on the GPU and writes `public/cursors/<name>.png`, `@2x` and `@3x`, plus the generated tokens in `src/design/cursors.css`. Never edit that file. `npm run cursors -- --serve` opens the lab at `localhost:4190/lab/cursors.html` (the `cursor-lab` launch config). `--sheet <file.png>` captures the review sheet for scoring.
- **Tokens:**
  - `--cursor-default`, `--cursor-pointer` and `--cursor-text`, plus `--cursor-grab`, `--cursor-grabbing`, `--cursor-ew-resize` and `--cursor-ns-resize`, which are ready for drag and resize UI.
  - **Where each applies:**
    - `html` uses the default (the arrow), so empty space and decorative words (the wordmark) keep it.
    - Readable, selectable text (`p`, headings, `li`, `blockquote`, `figcaption`, `dt`/`dd`, table cells, `pre`/`code`) uses the I-beam, unless it sits inside a link, button, `summary` or label.
    - Links, buttons and other clickable roles use the pointer.
    - Things you drag (the range slider) use the open hand, closing while held.
    - Text fields use the I-beam.
    - The resize cursors wait for real resize UI. Don't fake a drag on something that doesn't move.
  - Write `cursor: var(--cursor-pointer)`, never `cursor: pointer`. `npm run check:design` fails on raw cursor keywords.
- **Limits:**
  - Each image stays at most 32×32 CSS px, cropped tightly.
  - Chrome 156+ and Safari show the keyword cursor whenever the whole image wouldn't fit inside the viewport, so the native cursor appears within about 20px of the right and bottom edges.
  - Custom cursors ignore the OS enlarged-cursor setting.
  - In forced-colours mode every token falls back to its keyword.
- **Taste rules** (written in the lab header and checked on every bake):
  - no decorative shines or light sweeps;
  - shadows warm grey, never violet;
  - no pixelation or banding at 1x, 2x or 3x;
  - the hotspot pixel sits on the tip;
  - one family: the same camera, lights and materials;
  - a product shot, not a WebGL demo.

## Spacing and typography principles

**Spacing**

1. **4/8pt grid.** Every gap and padding is a token on the scale.
2. **Proximity.** Space inside a group is smaller than space between groups. Clustered controls sit 2–4px apart; separate groups get at least 3× that.
3. **Internal ≤ external.** A component's padding never exceeds the space around it.
4. **A fixed height ladder.** Badge 28, pill 30, compact control 32, primary action 44. Neighbouring controls share a step or differ by a whole step.
5. **Pill padding about 0.4× height.** 12px on 30–32px, 16px on 44px.
6. **Nested radius = outer − inset.** Keycap 12px minus a 3px inset gives a 9px face.
7. **Optical over mathematical.** Center labels on the visible surface (the keycap lip), use asymmetric padding beside a dot or icon, and share baselines across a row of buttons.
8. **Touch targets.** At least 44px for primary actions (WCAG 2.5.5); never below 24px (2.5.8).
9. **One margin line.** Header, hero copy and footer align to `--layout-margin`.
10. **Clamp fluid spacing.** Let it scale between a minimum and a maximum, never unbounded.

**Typography**

1. **A modular scale.** Steps follow a ratio (the hero uses 1.125: 64 → 72). Avoid near-duplicate sizes in one view.
2. **Three or four sizes and two or three weights per view.** Build hierarchy from size, weight and colour together, not size alone.
3. **Tracking runs opposite to size.** Display −2% to −4.5%, UI about −1% to 0, small caps +2% to +10%.
4. **Line height runs opposite to size.** Display 0.95–1.1, UI 1.2–1.5, body 1.45–1.6.
5. **Measure.** Body text runs 45–75 characters. Headlines use `text-wrap: balance`.
6. **Size floors.** 12px for HUD and meta text, 14px for controls, 16px for body text and primary actions.
7. **Contrast.** 4.5:1 for text under 24px, 3:1 for large text. Over imagery, guarantee it with a scrim or glass.
8. **One display face plus one UI sans.** UI chrome always uses the sans.
9. **Fluid type uses `clamp()`** with bounds that land on the scale.
10. **Tabular figures** for numbers that change, such as clocks and stats.
