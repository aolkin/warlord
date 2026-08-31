# Testing & Code Quality

Vitest unit tests, `vue-tsc` typechecking, lint, and Playwright e2e tests all run in CI (`.github/workflows/build.yml` and `.github/workflows/e2e.yml`) on every PR.

## Unit tests for the game engine (highest value, done)

`src/game/models` has Vitest unit tests over movement, mustering, battle, and rangestrike rules (`game.test.ts`, `stack.test.ts`, `battle/board.test.ts`, `battle/engine.test.ts`, `battle/strike.test.ts`).

The oversized model files have also been split into one-concern modules: `src/game/models/battle.ts` is now a 24-line barrel re-export, with the actual logic in `battle/board.ts`, `battle/combatant.ts`, `battle/engine.ts`, `battle/phase.ts`, and `battle/strike.ts`; `game.ts` is 374 lines.

## Typechecking in CI (done)

`vue-tsc --noEmit` runs as a `Typecheck` step in `build.yml`'s PR gate. `tsconfig.json` is a real standalone config (doc 01).

## End-to-end tests (Playwright, done)

`TitanGame` and `Battle` have no browser dependencies (doc 05), so the model-layer Vitest tests above already cover the rules engine's own arithmetic. What e2e coverage adds is confirming the UI's click handlers actually reach that engine with the right arguments and render the result — something only a real browser can verify, and something that also replaces a real cost: manual browser verification can't parallelize, since only one interactive session can drive the app at a time.

- **Pros:** turns a manual, one-at-a-time browser pass into an automatic, parallelizable CI check; the fixture mechanism below makes every phase directly reachable without playing a game from round zero.
- **Cons:** fixtures are hand-built against `TitanGame`'s current state shape, so a shape change silently breaks them until a test fails; SVG click-target selection is more brittle than typical DOM apps; a real browser plus Vuetify plus dice-box asset loading makes each run slower than the Vitest suite.

One scenario exists for each masterboard phase and battle-phase type that has UI of its own to click through. Each loads a game positioned at that phase's start via a seeded fixture, clicks through the real actions a player has available, and asserts the resulting state or phase advance. `TitanGame` being plain, browser-free TypeScript makes fixtures cheap: `e2e/fixtures.ts` builds one, mutates it into position, and seeds it into `localStorage["warlord-v1"]` before `page.goto` — the same key and shape `useGameStore` and `SystemMenu`'s "Load JSON" already use. Dice rolls are deterministic for testing: `DiceRoller.vue` checks `window.DebugDice.nextRolls` before touching the physics engine, and `quickDice: true` skips the roll animation for any unforced roll.

### Masterboard phases

- **Split** ([`e2e/split.spec.ts`](https://github.com/aolkin/warlord/pull/218)). Confirms the round-1 rule (exactly four creatures, one lord) gates the "Finish Splits and Roll" button correctly, including re-enabling after a deselect, then confirms the roll and phase advance to Move.
- **Move** ([`e2e/move.spec.ts`](https://github.com/aolkin/warlord/pull/220)). Confirms "Proceed to Muster" requires at least one stack to move (Law of Titan 6.2) but not both halves of a fresh split (4.3), and confirms engaging an enemy stack opens the battle board with creatures placed on the correct approach side — the flow [#192](https://github.com/aolkin/warlord/pull/192) once broke by rotating the engage icon onto the wrong physical side of the hex for about half the board.
- **Battle.** No dedicated masterboard UI exists for this phase — engaging a stack hands off straight to the battle board — so it's covered by the Move scenario's engagement click plus the battle-phase scenarios below.
- **Muster** ([`e2e/muster.spec.ts`](https://github.com/aolkin/warlord/pull/221)). Confirms both muster paths — a single-basis recruit staged immediately, and a multi-basis recruit routed through `MusterChoices.vue`'s basis-choice dialog — then confirms "End Turn" advances the round with recruits applied.
- **End.** Not independently reachable — `advancePhase` walks through it synchronously inside the same `finalizeMusters` call that leaves Muster — so its effect (turn/round advance) is already asserted by the Muster scenario.

### Battle phases

`BattlePhase` has six values that pair into three phase *types* (`BattlePhaseType`) sharing identical UI, differing only in which side (attacker or defender) is active. One scenario covers both members of a pair; Rangestrike gets its own scenario as a second UI path within Strike rather than a fourth type.

- **Move** ([`e2e/battle-move.spec.ts`](https://github.com/aolkin/warlord/pull/223)). Loads a battle on Mountains terrain, which carries the widest hazard mix in `BATTLE_BOARDS` (elevation tiers, a Dragon-only Volcano hex, Slope and Cliff edges), and confirms a non-flying mover's highlighted destinations correctly exclude the hazards it can't cross. Confirms "End Movement" advances the phase and that a creature left unmoved is eliminated rather than silently staying off-board.
- **Strike** ([`e2e/battle-strike.spec.ts`](https://github.com/aolkin/warlord/pull/224)). Forces a hit via `window.DebugDice.nextRolls`, confirms the strike-confirmation dialog and the resulting wound update, and that "every eligible creature must strike" clears once it has.
- **Rangestrike** (same file and PR). Same assertions through the ranged-attack path instead of melee — confirms the rangestrike icon appears only for a target outside melee range, per `Battle.rangestrikeTargets`.
- **Strikeback** ([`e2e/battle-strikeback.spec.ts`](https://github.com/aolkin/warlord/pull/225)). Forces a lethal roll and confirms the killed creature is actually removed from the board once the phase advances — the one behavior specific to strikeback rather than shared with Strike. (Full battle resolution is known-incomplete per doc 05, so there's no "battle ends" scenario yet.)

### CI (done)

The e2e suite runs in its own `.github/workflows/e2e.yml`, separate from `build.yml`'s Lint/Typecheck/Test/Build job so a flaky or failed run doesn't force retrying that whole job. It installs with `pnpm exec playwright install --with-deps chromium` and runs `pnpm test:e2e` on every `pull_request`.

## Cleanup items observed in passing (done)

- `Object.prototype.guid` extension and `unwrapInjectedRef` (doc 04) are gone.
- No debug `console.log` of the persisted game state on load remains in `models/game.ts`.
- The README now has real install/dev/build/lint instructions plus an Architecture section (models vs. store vs. components).
- `@3d-dice/dice-box` is now `^1.1.4`, and `DiceRoller.vue` uses its current API.
