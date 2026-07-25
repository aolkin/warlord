# Testing & Code Quality

There are currently no tests, no typecheck step, and lint that cannot run (its config stack is dead — doc 01).

## Unit tests for the game engine (highest value)

`src/models` is ~2100 lines of plain TypeScript implementing movement, mustering, battle, and rangestrike rules — testable today with zero refactoring. Vitest (4.x) is the obvious runner: Vite-native, TS out of the box.

A good opening move (possibly the first refactor of all): a purely mechanical split of the oversized model files — battle.ts is ~980 lines and game.ts ~520 — into one-concern modules, no behavior change. It makes the test-writing below more targeted and every later refactor diff smaller.

- **Pros:** the rules are the hardest-won code in the repo and the part every other proposal wants to refactor; tests make the doc 04/05 refactors safe instead of terrifying. Rules bugs are also the class of bug users actually notice.
- **Cons:** dice-driven paths need injectable RNG to be testable — a small seam worth cutting now since multiplayer requires the same seam (doc 05).
- **Alternative:** node:test — no extra dependency, but no Vite module resolution; Vitest earns its slot here.

## Typechecking in CI

`vue-tsc` (3.x) typechecks `.vue` SFCs; today nothing typechecks anything (CI renames tsconfig away to build). Add `vue-tsc --noEmit` to the PR gate.

- **Pros:** the store reflection layer and `any`-typed component boundaries mean the compiler currently verifies almost nothing; each refactor in docs 03–04 widens what it can check.
- **Cons:** first run will produce a backlog of errors; burn it down opportunistically rather than blocking on zero.

## Component/E2E tests (lower priority)

A handful of Playwright smoke tests (game loads, a stack can split and move, a battle resolves) covers the integration risk of the framework/chrome upgrades better than component-level tests would.

- **Pros:** directly de-risks the Vuetify 4 and Vue upgrade passes; runs headless in CI.
- **Cons:** SVG click-target selection makes selectors more brittle than typical DOM apps; keep the suite tiny.

## Cleanup items observed in passing

- `Object.prototype.guid` extension and `unwrapInjectedRef` (doc 04).
- Debug `console.log` of the entire persisted game state on load (models/game.ts).
- The README is the untouched Nuxt starter README; replace with actual run/build instructions and a short architecture note (models vs. store vs. components).
- `@3d-dice/dice-box` is pinned at 0.4.x; current is 1.1.x with API changes — upgrade alongside its call sites in DiceRoller.vue.
