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

Plus `index-*.css` at 830 KB (118 KB gzip). There's no router or route-based splitting — the app has no `vue-router`, and `App.vue` toggles views with `v-show` — so `index-*.js` is effectively the whole app in one chunk. Four of the other five chunks (`world.offscreen`, `world.onscreen`, `world.none`, `Dice`) belong to `@3d-dice/dice-box`; `webfontloader` is its own tiny async chunk, already covered by [doc 06](06-ui-chrome.md)'s proposal to drop that dependency.

## `@3d-dice/dice-box`'s own chunking (independent of doc 06, parked on upstream)

`DiceBox.init()` picks one of the three `world.*` chunks at runtime based on its `offscreen` option (default `true`): with `OffscreenCanvas` support it loads `world.offscreen.js` (renders in a Worker), otherwise `world.onscreen.js` as long as WebGL is available, otherwise `world.none.js`. `offscreen: false` deterministically switches to the smaller `world.onscreen.js` (385 KB) at the cost of rendering on the main thread instead of a Worker — unverified whether that's noticeably janky on lower-end devices.

`world.offscreen.js`'s built chunk is 2.89 MB, almost exactly double the npm package's own 1.45 MB file — dice-box embeds its Worker code as a base64 string referenced twice (`atob(p)` and a data-URI fallback `new Worker(...)`). **Root cause, confirmed:** Rolldown constant-folds `"literal" + p` string concatenations, and once it decides to fold the data-URI concatenation, it also substitutes the same literal at the unrelated `atob(p)` call site, duplicating the 1.44 MB constant. Reproduces on Rolldown 1.1.5 (pinned by Vite 8.1.5) and 1.2.3, not on esbuild given the same input — a genuine upstream bug, not a Vite config or dice-box packaging issue. Filed: [rolldown/rolldown#10656](https://github.com/rolldown/rolldown/issues/10656).

Nothing tried has landed: `optimization.inlineConst: false` has no effect; disabling treeshake fixes the duplication but grows the initial `index` chunk (on the critical path) by ~44 KB gzip, trading a lazy-loaded chunk's size for the chunk that blocks initial load; a `vite.config.js` transform plugin rewriting the vendored minified module works cleanly but depends on undocumented Rolldown folding behavior that could silently stop matching a future version, so it's kept as an untrusted fallback rather than applied by default.

**Status:** parked on the upstream fix. `DiceRoller.vue` is already lazy-loaded ([PR #97](https://github.com/aolkin/warlord/pull/97)), so this chunk doesn't block initial page load regardless of size.

## Lazy-load `DiceRoller.vue` (independent of doc 06, done)

`DiceRoller.vue` was statically imported and unconditionally rendered in `App.vue`, so `Dice-*.js` plus whichever `world.*` chunk gets picked — up to ~3.6 MB — loaded on every page visit, including sessions that never roll dice.

Switching to `defineAsyncComponent(() => import(...))` meant the `diceRoller` template ref, injected by consumers via `provide`/`inject` and called directly as `.roll(...)`, now stays `null` until the async chunk resolves and mounts. Each consumer now handles that window itself: `BattleBoard.vue` throws if `diceRoller.value` is `null` mid-strike, and `SystemMenu.vue`'s debug roll button no-ops via optional chaining. (`TurnPanel.vue` no longer injects `diceRoller` at all — masterboard rolls no longer go through the 3D widget.) `App.vue`'s template still renders `<DiceRoller>` unconditionally rather than behind `v-if`, so the fetch still starts at initial mount — it's off the initial script-evaluation cost, but not off the network entirely; gating on first use would defer that too.

**Landed as [PR #97](https://github.com/aolkin/warlord/pull/97).**

## Vuetify component tree-shaking (done)

`vite-plugin-vuetify` replaced the whole-library `import * as components from "vuetify/components"` with per-component tree-shaken imports ([PR #95](https://github.com/aolkin/warlord/pull/95)).

## Icon font: `@mdi/font` → per-icon SVG imports (rejected a third time)

`@mdi/font` ships all ~7,000 icon classes (391 KB CSS plus a webfont) for the ~20 icons `src/ui` actually uses. Swapping to per-icon `@mdi/js` SVG imports, resolved through a custom Vuetify icon set, has been proposed and rejected three times — twice before this doc existed, and again in [PR #227](https://github.com/aolkin/warlord/pull/227) on the same grounds: hand-enumerating every icon name in a lookup table is annoying to maintain for the roughly 300 KB it saves.

PR #227 also checked for a way to avoid the enumeration itself, and found none: Vuetify's own documented tree-shaking path for MDI icons *is* the manual `@mdi/js` + icon-set-alias pattern; webfont-subsetting plugins only detect glyphs already present in the shipped CSS, so with the whole `@mdi/font` CSS imported they keep all ~7,000 icons regardless — a real reduction needs a first pass (like PurgeCSS) to find which classes are actually referenced, which still can't see the two icon names built from a runtime suffix (e.g. `` `mdi-dice-${roll}` ``) without a hand-written safelist; and lazy-loading the font's CSS off the critical path avoids enumeration but ships the same bytes and reintroduces the icon flash-of-unstyled-content the SVG swap was meant to avoid.

**Decided:** stays rejected. Don't re-propose this swap without a genuinely new way to derive the icon list automatically — every option looked at so far, hand-enumeration included, costs more than the ~300 KB it would save.

## Sequencing

Nothing in this doc depends on anything else in the `proposals/` folder. Lazy-loading `DiceRoller.vue` has landed; dice-box's chunking can land whenever the upstream fix does. The icon-font item is rejected, not pending.
