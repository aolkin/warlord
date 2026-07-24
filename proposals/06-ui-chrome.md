# UI Chrome

The chrome is Vuetify 3.1: app bar, panels, dialogs, menus. The owner has accepted that modernization may change its look somewhat; the game UI itself (boards, creatures, markers) is custom SVG and unaffected by anything here.

## Vuetify 3.1 → 4.x (recommended)

Vuetify 4 (current: 4.1.x, released late 2025) adopts Material Design 3, CSS cascade layers, a `system` default theme that follows OS light/dark preference, and a simplified elevation scale. The upgrade guide ships revert snippets for each behavioral default it changes. Coming from 3.1 also picks up ~30 minors of 3.x fixes on the way.

- **Pros:** stays on the current component API (no rewrite, unlike a library switch); MD3 refresh is exactly the sanctioned "chrome looks a bit different"; cascade layers make the custom SVG styling less likely to fight framework CSS.
- **Cons:** grid/breakpoint changes need a visual pass over dialogs and side panels; MD3 look is a real change (roundier, tonal) — if unwanted, theme tokens can pull it back toward the old look.
- **Alternatives:**
  - **Stay on Vuetify 3.x latest** — smallest change, defers MD3; 3.x is now maintenance-track, so this only postpones.
  - **Replace with headless components + Tailwind (Reka UI / shadcn-vue style)** — full control and lighter bundles, but a chrome rewrite for ~10 views with no functional gain; only worth bundling into a hypothetical Svelte rewrite (doc 03), which brings its own equivalents.

## Icons: `@mdi/font` → per-icon SVG imports

The full MDI webfont ships every icon (~1000s) for the handful used. Vuetify supports `@mdi/js` SVG icons natively.

- **Pros:** hundreds of KB off the payload; no font FOUT.
- **Cons:** icons referenced by string name need converting to imports; trivial but fiddly.

## Fonts: drop `webfontloader`

`webfontloader` (JS runtime font loading, last meaningfully updated years ago) loads Roboto from Google Fonts. Modern practice is a `<link>` with `font-display: swap`, or better, self-hosted subset woff2 (e.g. via Fontsource) — which also removes the Google Fonts request entirely.

- **Pros:** one less dependency and render-blocking script; self-hosting removes a third-party request (and its availability/privacy footprint).
- **Cons:** none of substance.

## Small chrome opportunities while in there

- The `system` theme default in Vuetify 4 gives dark mode nearly free; the SVG boards would need a review pass for hard-coded colors.
- PWA manifest + service worker (vite-plugin-pwa) would make the game installable/offline — a natural fit for a client-side game with localStorage saves. Con: service-worker cache invalidation is a classic footgun; keep the strategy minimal (precache app shell only). Revisit once multiplayer exists since offline semantics change.
