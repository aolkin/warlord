# Testing & Code Quality

Vitest unit tests, `vue-tsc` typechecking, and lint all run in `.github/workflows/build.yml` on every PR. Playwright E2E infrastructure landed separately (#140) but isn't wired into CI yet — see below.

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

## End-to-end tests (Playwright)

`playwright.config.ts` and `e2e/smoke.spec.ts` landed in [#140](https://github.com/aolkin/warlord/pull/140) as infrastructure only: the app loads into a fresh game, the masterboard renders both starting stacks, and clicking a stack selects it. That PR called itself "a starting point to get a ruling on whether E2E testing is worth investing in further," not a full suite, and left wiring it into CI as a deferred follow-up decision. Neither has happened since; `pnpm test:e2e` still only runs when someone remembers to run it locally.

The case for investing further isn't about re-checking the rules engine's own arithmetic — `TitanGame` and `Battle` have no browser dependencies (doc 05), so that belongs in the model-layer Vitest tests above. It's about confirming the UI's click handlers actually reach that engine with the right arguments and render the result, which nothing but a real browser can verify. A CI suite also replaces a real cost: manual browser verification doesn't parallelize, since only one interactive session can drive the app at a time, forcing every check to happen one at a time instead of concurrently.

- **Pros:** turns a manual, one-at-a-time browser pass into an automatic, parallelizable CI check; the fixture mechanism below (seeded `localStorage` + forced dice) makes every phase directly reachable without playing a game from round zero.
- **Cons:** fixtures are hand-built against `TitanGame`'s current state shape, so a shape change silently breaks them until a test fails; SVG click-target selection is more brittle than typical DOM apps; a real browser plus Vuetify plus dice-box asset loading makes each run slower than the Vitest suite.

Below is one scenario for each masterboard phase and battle-phase type that has UI of its own to click through — Split, Move, Muster, and all three battle-phase types. Battle and End don't, and each explains why under its own heading instead. Every scenario loads a game positioned at that phase's start, clicks through the real actions a player has available, and asserts the resulting state or phase advance. `TitanGame` being plain, browser-free TypeScript makes fixtures cheap: construct one with `new TitanGame(...)`, mutate it into position, `JSON.stringify` it, and seed it into `localStorage["warlord-v1"]` before `page.goto` — the key `useGameStore` reads on startup, in the same shape `SystemMenu`'s existing "Load JSON" already hydrates from. Dice rolls are already deterministic for exactly this purpose: `DiceRoller.vue` checks `window.DebugDice.nextRolls` before touching the physics engine, so a test can force specific rolls without depending on `@3d-dice/dice-box`'s animation.

### Masterboard phases

**Split.** Load a fresh 2-player game (round 0, one full starting stack per player). Select the active stack, click creatures until the selection satisfies the round-1 rule (four creatures including exactly one lord), confirm "Finish Splits and Roll" enables, click it, confirm the die rolls and the phase becomes Move with the new stack now present on the board.

**Move.** Two scenarios:
- Load a game past Split with a roll already set and two stacks that both need to move (the "must move at least one stack from each split" rule — `TitanGame.getMandatoryMoves`). Click each stack's highlighted destination hex, confirm "Proceed to Muster" stays disabled until both have moved, then confirm it enables and advances the phase.
- Load a game with a roll and a real (non-debug) path that lands the active stack on a hex a genuine enemy stack occupies. Select the active stack, click the engage icon that appears directly on the enemy stack, confirm the battle board becomes visible (`App.vue` switches on `activeBattle` going from undefined to defined) with creatures placed on the board side matching the edge the attacker actually approached from. This is the flow [#192](https://github.com/aolkin/warlord/pull/192) broke — the masterboard's engage-icon rotation landed on the wrong physical side of the hex for roughly half the board despite the underlying `attackEdge` value always being correct. This scenario is the one in the set that pins down real SVG output rather than just confirming a click landed on the right element.

**Battle.** Because engaging a stack hands off straight to the battle board, `TurnPanel` renders no action for this phase, and no dedicated masterboard-level UI exists for it. Its actions are the battle-phase scenarios below; the engagement click that puts the game into this phase is already covered above, by moving onto a hex a real enemy stack occupies.

**Muster.** Load a game in Muster phase with two active stacks that already moved this turn, on terrain offering more than one basis creature for at least one recruit choice. For one stack, click a recruit with a single basis and confirm `currentMuster` is set immediately; for the other, click a recruit with multiple bases, confirm the basis-choice dialog (`MusterChoices.vue`) opens, pick a basis, confirm it records the choice and closes. Click "End Turn", confirm the active player/round advances and each recruited creature is now in its stack.

**End.** Not reachable as an observable UI state: `advancePhase` walks through it and back to Split synchronously inside the same `nextPhase()` call that leaves Muster, so nothing ever renders it. Its effect (turn/round advance) is already asserted by the Muster scenario's "End Turn" click.

### Battle phases

`BattlePhase` has six values, but they pair up into three phase *types* (`BattlePhaseType`) that share identical UI — only the active side (attacker or defender, via `Battle.getActivePlayer()`) differs. One scenario per type exercises both members of its pair.

**Move (Defender's/Attacker's Move).** Load a battle at `DEFENDER_MOVE` on Tower terrain, with defending creatures still at their off-board entry hex (`hex >= 36`, unmoved). Tower forces the attack edge — `Battle`'s constructor normalizes it to `HexEdge.SECOND` regardless of the real approach direction — and constrains board geometry more than any other terrain. Click each creature, click a legal destination from its highlighted movement hexes (`Battle.movementFor`), confirm the ActionPanel's "creatures that have not entered the battle board" warning clears once all have moved, click "End Movement". Confirm the phase advances and none of the moved creatures got sent back off-board — `nextPhase` in `engine.ts` resets any creature still at `hex >= 36` to `hex = 0` (eliminated) when Move ends, so this also catches a UI move that silently fails to register.

**Strike (Defender's/Attacker's Strikes).** Load a battle at `DEFENDER_STRIKE` with an attacker and defender creature already adjacent on the interior board, and force a hit via `window.DebugDice.nextRolls`. Select the striking creature, click the enemy target, confirm the StrikeConfirmation dialog shows the expected dice count and to-hit number, click "Attack", confirm the target's wound count updates and the "every eligible creature must strike" warning (`Battle.getPendingStrikes`) clears once it has. Click "End Strikes", confirm the phase advances.

**Strikeback (Attacker's/Defender's Strikebacks).** Load a battle at a strikeback phase with a creature already near-dead, and force a lethal roll via the same target-and-confirm steps as the Strike scenario above. Click "End Strikebacks" and confirm the killed creature is actually removed from the board (`hex` reset to `0`) once the phase advances — `nextPhase`'s strikeback-only cleanup, the one behavior specific to this phase type rather than shared with Strike. (Full battle resolution is known-incomplete per doc 05, so there's no "battle ends" scenario to test yet.)

### Necessary follow-up: wire into CI

None of the above pays off if it doesn't run automatically. Add a `pnpm test:e2e` step (with `pnpm exec playwright install --with-deps chromium`) to `build.yml` alongside the existing Lint/Typecheck/Test/Build steps — the deferred decision from #140.

## Cleanup items observed in passing

- `Object.prototype.guid` extension and `unwrapInjectedRef` (doc 04).
- Debug `console.log` of the entire persisted game state on load (models/game.ts).
- The README is the untouched Nuxt starter README; replace with actual run/build instructions and a short architecture note (models vs. store vs. components).
- `@3d-dice/dice-box` is pinned at 0.4.x; current is 1.1.x with API changes — upgrade alongside its call sites in DiceRoller.vue.
