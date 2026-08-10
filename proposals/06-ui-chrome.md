# UI Chrome

The chrome is Vuetify 4.1: app bar, panels, dialogs, menus. The game UI itself (boards, creatures, markers) is custom SVG and unaffected by anything here.

## Vuetify 4 (done)

Upgraded from 3.1 to 4.1 (PR #139). Vuetify 4 shrank the elevation scale from 0-24 to 0-5 and changed `v-btn`'s default text-transform from uppercase to none: `StackPanel.vue`'s selected-stack elevation was clamped to the new max, and a global `VBtn` default (`class: "text-uppercase"` in `src/ui/plugins/vuetify.ts`) keeps button text uppercase as before. Vuetify 4 also dropped the old universal `* { margin: 0 }` reset; `StackPanel.vue`'s two `<p>` tags got an explicit `margin: 0` to preserve prior spacing. `vite-plugin-vuetify` (component tree-shaking, doc 08) needed no change — its 2.1.3 release already supports Vuetify 4.

## Icons: `@mdi/font` → per-icon SVG imports (rejected)

Proposed and closed twice (PR #98, plus a follow-up commit on the same branch). `@mdi/font` stays.

## Fonts: `webfontloader` removed (done)

Replaced with `preconnect`/`stylesheet` `<link>` tags in `index.html` (PR #135). The `webfontloader` dependency and `src/ui/plugins/webfontloader.js` are gone.

## Small chrome opportunities

- Vuetify 4's `system` default theme (follows OS light/dark preference) — the app still pins `defaultTheme: "dark"`; adopting `system` needs a review pass over hard-coded SVG colors.
- PWA manifest + service worker (`vite-plugin-pwa`) — not started. Revisit once multiplayer exists, since offline semantics change.
