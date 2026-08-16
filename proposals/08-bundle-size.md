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

`world.offscreen.js`'s size is partly dice-box's own doing and partly this build's: the npm package's own file (`node_modules/@3d-dice/dice-box/dist/world.offscreen.js`) is 1,448,273 bytes, almost entirely one module-level base64-encoded `const p` (1.44 MB) — dice-box embeds its Worker code as a data URI instead of a separate fetchable file, and references it twice: `new Blob([atob(p)], …)` on the normal path, `new Worker("data:application/javascript;base64," + p)` on the fallback path when `createObjectURL` fails. The built chunk (`dist/assets/world.offscreen-*.js`) is 2,891,846 bytes (827.74 kB gzip) — almost exactly double.

**Root cause, confirmed:** Rolldown constant-folds `"literal" + p` concatenations where `p` is a module-level string constant, and once it decides to fold, it substitutes the literal at every reference site with no size guard. Folding the `"data:application/javascript;base64," + p` concatenation makes Rolldown also substitute the literal at the unrelated `atob(p)` call, purely as collateral, duplicating the 1.44 MB constant in the output. Reduced to a minimal 3-line repro independent of dice-box; reproduces on Rolldown 1.1.5 (pinned by Vite 8.1.5) and 1.2.3 (latest), does not reproduce on esbuild 0.28.2 given the same input. This is a genuine upstream Rolldown bug — not a Vite misconfiguration (no `manualChunks`/`rolldownOptions` in `vite.config.js`), not a chunk-splitting/dynamic-import duplication, and not a dice-box packaging problem (their published module has exactly one copy of the string). Filed: [rolldown/rolldown#10656](https://github.com/rolldown/rolldown/issues/10656).

Options tried, none landed:
- `optimization.inlineConst: false` — no effect, doesn't gate this fold path.
- `rolldownOptions.treeshake: false` — shrinks `world.offscreen` back to ~1,447.26 kB, but grows the initial `index` chunk (on the critical path) from 449.59 → 571.80 kB (156.70 → 200.24 kB gzip). Rejected: trades size off a lazy-loaded chunk for size on the chunk that blocks initial load.
- A `vite.config.js` transform plugin rewriting dice-box's minified module to prevent the fold — measured working cleanly (`world.offscreen` 2,891.84 → 1,447.26 kB, every other chunk byte-identical) but not landed: it's regex surgery on a vendored minified artifact, depending on undocumented Rolldown folding behavior that could silently stop matching a future Rolldown/dice-box version. Kept as a fallback (~12 lines, with a build-time throw if the pattern stops matching) if wanted despite the fragility — not applied by default.

`offscreen: false` remains available separately from the above: it drops the shipped chunk to `world.onscreen.js`'s 385 KB, at the cost of running Babylon.js rendering on the main thread instead of a Worker — unverified whether that's noticeably janky on lower-end devices, needs a manual check before deciding.

**Status:** parked on the upstream fix. `DiceRoller.vue` is already lazy-loaded ([PR #97](https://github.com/aolkin/warlord/pull/97)), so this chunk doesn't block initial page load regardless of size — that's what makes leaving the duplication parked tolerable.

## Lazy-load `DiceRoller.vue` (independent of doc 06)

`DiceRoller.vue` is statically imported and unconditionally rendered in `App.vue` (`<DiceRoller ref="diceRoller" />`, no `v-if`), so `Dice-*.js` plus whichever `world.*` chunk gets picked — up to ~3.6 MB with the default `offscreen: true` — loads on every page visit, including for a session that never rolls dice.

Switching to `defineAsyncComponent(() => import(...))` raises one complication: `App.vue` currently exposes the mounted instance via `provide("diceRoller", readonly(diceRoller))`, and three components (`TurnPanel.vue`, `SystemMenu.vue`, `BattleBoard.vue`) `inject: ["diceRoller"]` and call `this.diceRoller.roll(...)` directly with no null check. That works today because `diceRoller` is bound as a template ref to a component that's always mounted synchronously. With an async component, Vue only populates that ref once the (now-async) chunk resolves and mounts, so the injected value stays `null` for a window after initial render — calling `.roll()` during that window would throw synchronously instead of behaving as it does today, where `DiceRoller.vue` handles "not ready" internally by rejecting the returned promise if `diceBox.init()` hasn't resolved.

Rather than pushing a null check into each of the three call sites, `App.vue` can provide a small facade object instead of the raw instance — created synchronously at setup time, with a stable identity and a `roll()` method that delegates to the mounted instance once it exists and otherwise rejects: `roll: (...args) => instance.value ? instance.value.roll(...args) : Promise.reject(new Error("dice not ready"))`, passed to `provide("diceRoller", facade)` in place of the template ref.

The three consumers keep calling `this.diceRoller.roll(...)` exactly as they do today — `diceRoller` is never `null` from their perspective, so none of them change. The "is it ready" check moves from three call sites into this one facade, and since `roll()` is already async/promise-based today, the facade preserves the existing rejection-based contract rather than introducing a new synchronous-throw failure mode.

Separately, the component is still unconditionally present in the template (not behind `v-if`), so wrapping it in `defineAsyncComponent` alone starts the fetch at initial mount. That moves dice-box out of `index-*.js` and off the initial script-evaluation cost, but doesn't defer the network fetch itself — gating actual mount on first use (e.g. a `v-if` flipped by the first roll) would defer that too.

- **Pros:** initial load stops evaluating/parsing megabytes of Babylon.js before the board is interactive.
- **Cons:** adds a small facade indirection in `App.vue` between the provided value and the mounted instance.
- **Decided:** do this regardless of the `offscreen`/chunk-dedup decisions above — it helps whichever `world.*` chunk ends up loaded.

## Vuetify component tree-shaking (done)

`vite-plugin-vuetify` replaced the whole-library `import * as components from "vuetify/components"` with per-component tree-shaken imports ([PR #95](https://github.com/aolkin/warlord/pull/95)).

## Icon font: `@mdi/font` → per-icon SVG imports (rejected a third time)

`@mdi/font` ships all ~7,000 icon classes (391 KB of CSS, plus a several-hundred-KB webfont file) for the roughly 20 distinct icons `src/ui` actually uses (18 static names, plus two built from a die-face or round-number suffix at runtime, e.g. `` `mdi-dice-${roll}` ``). Swapping to per-icon `@mdi/js` SVG imports, resolved through a custom Vuetify icon set keyed by those same `mdi-*` name strings, has now been proposed and rejected three times: twice before this doc existed (PR #98 and a follow-up commit on the same branch, recorded in the now-deleted doc 06), and again in [PR #227](https://github.com/aolkin/warlord/pull/227), rejected on the same grounds as before — hand-enumerating every icon name in a lookup table is annoying to maintain for the roughly 300 KB it saves. `@mdi/font` stays.

PR #227 also looked into avoiding the enumeration itself rather than re-proposing the same SVG swap:

- Vuetify's own documented tree-shaking path for MDI icons *is* the manual `@mdi/js` import + icon-set-alias pattern above — there's no separate automatic tooling behind it.
- Webfont-subsetting plugins (e.g. `vite-font-extractor-plugin`) only detect glyphs already present in the CSS that ships; since `@mdi/font`'s CSS would be imported whole, "auto" mode keeps all ~7,000 icons. A real reduction needs a first pass — like PurgeCSS — that determines which `mdi-*` classes the app actually references, and that pass can't see the two suffix-built names without a hand-written safelist. Both the PurgeCSS Vite wrappers and the font-extractor plugin are single-maintainer, low-adoption packages.
- Lazy-loading `@mdi/font`'s CSS off the critical path (as its own async chunk, instead of shrinking it) needs no enumeration at all, but ships the same total bytes and reintroduces the icon-glyph flash-of-unstyled-content that the SVG swap was valued for avoiding.

- **Decided:** stays rejected. Don't propose an `@mdi/font` → `@mdi/js` swap again without a genuinely new way to derive the icon list automatically — hand-enumeration, whether centralized in one file or spread across call sites, and every automatic alternative looked at so far cost more than the ~300 KB they'd save.

## Sequencing

Nothing in this doc depends on anything else in the `proposals/` folder. Dice-box's chunking and lazy-loading `DiceRoller.vue` can land any time, including before doc 01's toolchain work. The icon-font item above is rejected, not pending.
