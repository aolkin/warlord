# Bundle Size

`pnpm build` (measured August 2026) produces 117 files, ~15 MB total. The six JS chunks:

| File | Size | Gzip |
|---|---|---|
| `world.offscreen-*.js` | 2.89 MB | 828 KB |
| `index-*.js` | 1.17 MB | 324 KB |
| `Dice-*.js` | 679 KB | 165 KB |
| `world.onscreen-*.js` | 385 KB | 86 KB |
| `webfontloader-*.js` | 12 KB | 5 KB |
| `world.none-*.js` | 3 KB | 1 KB |

Plus `index-*.css` at 830 KB (118 KB gzip). There's no router or route-based splitting: the app has no `vue-router`, and `App.vue` toggles views with `v-show` instead. So `index-*.js` is effectively the whole app in one chunk. Four of the other five chunks (`world.offscreen`, `world.onscreen`, `world.none`, `Dice`) belong to `@3d-dice/dice-box`; `webfontloader` is its own tiny async chunk, already covered by [doc 06](06-ui-chrome.md)'s proposal to drop that dependency.

## `@3d-dice/dice-box`'s own chunking (independent of doc 06)

`DiceBox.init()` picks one of the three `world.*` chunks at runtime based on its `offscreen` option (default `true`, per the [config docs](https://fantasticdice.games/docs/usage/config#configuration-options)). Reading dice-box's own bundled source (`node_modules/@3d-dice/dice-box/dist/dice-box.es.js`): if `OffscreenCanvas` is supported and `offscreen` is `true`, it imports `world.offscreen.js` (renders in a Worker); otherwise, as long as WebGL is supported at all, it imports `world.onscreen.js` (renders on the main thread) — `world.none.js` only loads when WebGL itself is unavailable (dice-box's own fallback message calls this "random number generator" mode), unrelated to the `offscreen` setting. So `offscreen: false` deterministically switches to `world.onscreen.js`.

`world.offscreen.js`'s size is partly dice-box's own doing and partly this build's: the npm package's own file (`node_modules/@3d-dice/dice-box/dist/world.offscreen.js`) is 1.45 MB, almost entirely one base64-encoded string (1.44 MB) passed to `new Worker("data:application/javascript;base64," + …)`, decoding to a ~1.08 MB JS bundle — dice-box embeds its Worker code as a data URI instead of a separate fetchable file. But the built chunk (`dist/assets/world.offscreen-*.js`) is 2.89 MB — roughly double the npm package's own file — and grepping a snippet from that base64 string against the built chunk finds it twice, at two locations 1.44 MB apart. Vite's build (Rolldown, via Vite 8) is duplicating this module inside the output chunk; the npm package itself only contains it once. No `manualChunks`/`rolldownOptions` are configured in `vite.config.js`, so this is default chunking behavior, not something this repo's config introduced.

- Worth a minimal reproduction and a Vite/Rolldown issue before reaching for `offscreen: false` — deduplicating would recover close to half this chunk (2.89 MB → ~1.45 MB) with no behavior change.
- `offscreen: false` remains available on top of that: it drops the shipped chunk to `world.onscreen.js`'s 385 KB, at the cost of running Babylon.js rendering on the main thread instead of a Worker — unverified whether that's noticeably janky on lower-end devices, needs a manual check before deciding.
- Not urgent either way: once `DiceRoller.vue` is lazy-loaded (below), neither chunk blocks initial page load regardless of which one gets shipped.

## Lazy-load `DiceRoller.vue` (independent of doc 06)

`DiceRoller.vue` is statically imported and unconditionally rendered in `App.vue` (`<DiceRoller ref="diceRoller" />`, no `v-if`), so `Dice-*.js` plus whichever `world.*` chunk gets picked — up to ~3.6 MB with the default `offscreen: true` — loads on every page visit, including for a session that never rolls dice.

Switching to `defineAsyncComponent(() => import(...))` has one real complication. `App.vue` exposes the mounted instance via `provide("diceRoller", readonly(diceRoller))`, and three components (`TurnPanel.vue`, `SystemMenu.vue`, `BattleBoard.vue`) `inject: ["diceRoller"]` and call `this.diceRoller.roll(...)` directly with no null check. `DiceRoller.vue` handles "not ready" internally today: it rejects the returned promise if `diceBox.init()` hasn't resolved. With an async component, the injected ref stays `null` until the chunk resolves and mounts — calling `.roll()` before then throws synchronously instead of rejecting a promise, so the three call sites need a guard added. Separately, the component is still unconditionally present in the template (not behind `v-if`), so wrapping it in `defineAsyncComponent` alone starts the fetch at initial mount. That moves dice-box out of `index-*.js` and off the initial script-evaluation cost, but doesn't defer the network fetch itself — gating actual mount on first use (e.g. a `v-if` flipped by the first roll) would defer that too.

- **Pros:** initial load stops evaluating/parsing megabytes of Babylon.js before the board is interactive.
- **Cons:** the three injected call sites need a null check added.
- **Decided:** do this regardless of the `offscreen`/chunk-dedup decisions above — it helps whichever `world.*` chunk ends up loaded.

## Vuetify tree-shaking and icon font (do now, don't wait for doc 06)

`src/plugins/vuetify.ts` does `import * as components from "vuetify/components"` (the whole library) and `import "vuetify/styles"` (336 KB of compiled CSS, unaffected by which components are actually used). `@mdi/font` ships all ~7,000 icon classes (391 KB of CSS) for the roughly 20 distinct icons actually used in `src/` (18 static names, plus two that get a die-face or round-number suffix appended at runtime). Together vuetify/mdi CSS alone is ~730 KB of the 830 KB `index-*.css`.

[Doc 06](06-ui-chrome.md) already proposes both fixes — per-component tree-shaken imports and `@mdi/js` per-icon SVG imports — but frames them as part of the Vuetify 3 → 4 upgrade. Vuetify's own v4 upgrade guide describes the recommended tree-shakable import (`import { VBtn, VCard } from "vuetify/components"`) as consistent with prior versions, not a v4-specific change, and doesn't touch icon configuration at all. So there's nothing to redo when v4 lands later.

- **Decided:** do the tree-shaking and icon-font swap now, independent of doc 06's version upgrade — it's the largest CSS win in the app and doesn't need to wait on a major-version bump that's motivated by a visual refresh, not bundle size.

## Sequencing

Nothing in this doc depends on anything else in the `proposals/` folder. All three items — dice-box's chunking, lazy-loading `DiceRoller.vue`, and the Vuetify/icon tree-shaking — can land any time, including before doc 01's toolchain work; the last one no longer needs to wait for [doc 06](06-ui-chrome.md)'s Vuetify 4 upgrade.
