# Portfolio prototype v2

The active portfolio: a Next.js (App Router) site. The original `prototype/` was archived; root-level `app.js` and `styles.css` are legacy experiment files.

All visual work uses the shared system in [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

## Commands

- `npm run dev`: local site at http://localhost:4173. `/design-system` is the living token reference.
- `npm run build`: design-system check, TypeScript and the production build. Every page is pre-rendered.
- `npm start`: serve the production build on port 4173.
- `npm run posters [slug ...]`: capture Library posters and link-preview images from the live demos. Run it against `npm start` (set `POSTER_BASE` for another origin) so no dev overlay is captured.
- `npm run assets`: rebuild the responsive Work images in `public/media`.

Set `SITE_URL` (for example `https://abbasalabura.com`) when deploying, so link previews and the sitemap use the real domain.

## Library

Free assets live at `/library`; each has its own page at `/library/<slug>` and, if it has a live demo, a bare page at `/demo/<slug>` that the asset page embeds in an iframe.

- Items: `src/content/library.ts`. Code shown on an asset page is read from the real source files listed in `source`, so it never drifts.
- Tutorials: `src/content/tutorials.ts`. The newest one becomes the Library hero; until there is one, the newest item is featured. Self-host each thumbnail at `public/tutorials/<id>.jpg`.
- Demos: `src/library/demos/`, registered in `DemoHost.tsx`. In `?poster` mode a demo hides its controls, holds a representative frame and calls `markPosterReady()`.
- Work shows a Library sample only when at least three items are flagged `featuredOnWork`.
- Rules from `Strategy/architecture.md`: own work only, never gated, launch with four or more real items.
