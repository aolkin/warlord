# Testing & Code Quality

Vitest unit tests, `vue-tsc` typechecking, lint, and Playwright e2e tests all run in CI (`.github/workflows/build.yml` and `.github/workflows/e2e.yml`) on every PR.

## Unit tests for the game engine (highest value, done)

`src/game/models` has Vitest unit tests over movement, mustering, battle, and rangestrike rules (`game.test.ts`, `stack.test.ts`, `battle/board.test.ts`, `battle/engine.test.ts`, `battle/strike.test.ts`).

The oversized model files have also been split into one-concern modules: `src/game/models/battle.ts` is now a 24-line barrel re-export, with the actual logic in `battle/board.ts`, `battle/combatant.ts`, `battle/engine.ts`, `battle/phase.ts`, and `battle/strike.ts`; `game.ts` is 374 lines.

## Typechecking in CI (done)

`vue-tsc --noEmit` runs as a `Typecheck` step in `build.yml`'s PR gate. `tsconfig.json` is a real standalone config (doc 01).

## End-to-end tests (Playwright, done)

`playwright.config.ts` and `e2e/smoke.spec.ts` landed in [#140](https://github.com/aolkin/warlord/pull/140) as infrastructure only: the app loads into a fresh game, the masterboard renders both starting stacks, and clicking a stack selects it. That PR called itself "a starting point to get a ruling on whether E2E testing is worth investing in further," not a full suite, and left wiring it into CI as a deferred follow-up decision. Both have since happened — see below.

The case for investing further isn't about re-checking the rules engine's own arithmetic — `TitanGame` and `Battle` have no browser dependencies (doc 05), so that belongs in the model-layer Vitest tests above. It's about confirming the UI's click handlers actually reach that engine with the right arguments and render the result, which nothing but a real browser can verify. A CI suite also replaces a real cost: manual browser verification doesn't parallelize, since only one interactive session can drive the app at a time, forcing every check to happen one at a time instead of concurrently.

- **Pros:** turns a manual, one-at-a-time browser pass into an automatic, parallelizable CI check; the fixture mechanism below (seeded `localStorage` + forced dice) makes every phase directly reachable without playing a game from round zero.
- **Cons:** fixtures are hand-built against `TitanGame`'s current state shape, so a shape change silently breaks them until a test fails; SVG click-target selection is more brittle than typical DOM apps; a real browser plus Vuetify plus dice-box asset loading makes each run slower than the Vitest suite.

One scenario now exists for each masterboard phase and battle-phase type that has UI of its own to click through — Split, Move, Muster, and all three battle-phase types (Battle and End don't, for the reasons given under their own headings below). Each scenario loads a game positioned at that phase's start, clicks through the real actions a player has available, and asserts the resulting state or phase advance. `TitanGame` being plain, browser-free TypeScript makes the fixtures cheap: `e2e/fixtures.ts` constructs one, mutates it into position, `JSON.stringify`s it, and seeds it into `localStorage["warlord-v1"]` before `page.goto` — the key `useGameStore` reads on startup, in the same shape `SystemMenu`'s "Load JSON" hydrates from. Dice rolls are deterministic for exactly this purpose: `DiceRoller.vue` checks `window.DebugDice.nextRolls` before touching the physics engine, so a test forces specific rolls without depending on `@3d-dice/dice-box`'s animation; `quickDice: true` in the preferences store keeps any unforced roll from waiting on the physics animation.

### Masterboard phases

**Split** (`e2e/split.spec.ts`, [#218](https://github.com/aolkin/warlord/pull/218)). Loads a fresh 2-player game (round 0, one full starting stack per player). Selects the active stack, clicks creatures until the selection satisfies the round-1 rule (four creatures including exactly one lord), confirms "Finish Splits and Roll" enables. Clicks a fifth creature: confirms the button disables again and `StackPanel`'s "You have selected a valid split" message disappears — `Stack.isValidSplit` requires exactly four selected in round 1 — then clicks that creature again to deselect it and confirms the button re-enables. Clicks "Finish Splits and Roll", confirms the die rolls and the phase becomes Move with the new stack now present on the board.

**Move** (`e2e/move.spec.ts`, [#220](https://github.com/aolkin/warlord/pull/220)). Two scenarios:
- Loads a game past Split with a roll already set and two stacks sharing a hex from this turn's split. Confirms "Proceed to Muster" starts disabled — no stack has moved yet, and Law of Titan 6.2 requires at least one to. Clicks just one stack's highlighted destination hex and confirms the button enables without moving the second: `TitanGame.getMandatoryMoves` only requires a split's origin hex to drop back to one stack, not that both halves move (Law of Titan 4.3 — "one of them must be moved... They may both be moved, but they may not move to the same Land").
- Loads a game with a roll and a real (non-debug) path that lands the active stack on a hex a genuine enemy stack occupies. Selects the active stack, clicks the engage icon that appears directly on the enemy stack, confirms the battle board becomes visible (`App.vue` switches on `activeBattle` going from undefined to defined) with creatures placed on the board side matching the edge the attacker actually approached from. This is the flow [#192](https://github.com/aolkin/warlord/pull/192) broke — the masterboard's engage-icon rotation landed on the wrong physical side of the hex for roughly half the board despite the underlying `attackEdge` value always being correct. This scenario is the one in the set that pins down real SVG output rather than just confirming a click landed on the right element.

**Battle.** Because engaging a stack hands off straight to the battle board, `TurnPanel` renders no action for this phase, and no dedicated masterboard-level UI exists for it. Its actions are the battle-phase scenarios below; the engagement click that puts the game into this phase is already covered above, by moving onto a hex a real enemy stack occupies.

**Muster** (`e2e/muster.spec.ts`, [#221](https://github.com/aolkin/warlord/pull/221)). Loads a game in Muster phase with two active stacks that already moved this turn, on terrain offering more than one basis creature for at least one recruit choice. For one stack, clicks a recruit with a single basis and confirms the choice is staged immediately; for the other, clicks a recruit with multiple bases, confirms the basis-choice dialog (`MusterChoices.vue`) opens, picks a basis, confirms it records the choice and closes. Clicks "End Turn", confirms the active player/round advances and each recruited creature is now in its stack.

**End.** Not reachable as an observable UI state: `advancePhase` walks through it and back to Split synchronously inside the same `finalizeMusters` call that leaves Muster, so nothing ever renders it. Its effect (turn/round advance) is already asserted by the Muster scenario's "End Turn" click.

### Battle phases

`BattlePhase` has six values, but they pair up into three phase *types* (`BattlePhaseType`) that share identical UI — only the active side (attacker or defender, via `Battle.getActivePlayer()`) differs. One scenario per type exercises both members of its pair; Rangestrike gets an additional scenario of its own below, since it's a second UI path available within the Strike type rather than a fourth type.

**Move (Defender's/Attacker's Move)** (`e2e/battle-move.spec.ts`, [#223](https://github.com/aolkin/warlord/pull/223)). Loads a battle at `DEFENDER_MOVE` on Mountains terrain, with defending creatures still at their off-board entry hex (`hex >= 36`, unmoved). Mountains carries the widest hazard mix of any entry in `BATTLE_BOARDS`: two elevation tiers, a Volcano hex (15) that only a Dragon may enter (`creatureMovementCost` returns `UNATTAINABLE_MOVEMENT_COST` for anything else), Slope edges that cost a non-native creature an extra step, and Cliff edges (e.g. 15↔20, 17↔22, 32↔27) that block non-flying movement outright. Includes a non-Dragon, non-flying creature among the movers and confirms hex 15 and any Cliff-adjacent hex never appear among its highlighted `Battle.movementFor` destinations. Clicks each creature, clicks a legal destination from its highlighted movement hexes, confirms the ActionPanel's "creatures that have not entered the battle board" warning clears once all have moved, clicks "End Movement". Confirms the phase advances and none of the moved creatures got sent back off-board — `Battle.finalizeMoves` resets any creature still at `hex >= 36` to `hex = 0` (eliminated) when Move ends, so this also catches a UI move that silently fails to register.

**Strike (Defender's/Attacker's Strikes)** (`e2e/battle-strike.spec.ts`, [#224](https://github.com/aolkin/warlord/pull/224)). Loads a battle at `DEFENDER_STRIKE` with an attacker and defender creature already adjacent on the interior board, and forces a hit via `window.DebugDice.nextRolls`. Selects the striking creature, clicks the enemy target, confirms the StrikeConfirmation dialog shows the expected dice count and to-hit number, clicks "Attack", confirms the target's wound count updates and the "every eligible creature must strike" warning (`Battle.getPendingStrikes`) clears once it has. Clicks "End Strikes", confirms the phase advances.

**Rangestrike** (`e2e/battle-strike.spec.ts`, [#224](https://github.com/aolkin/warlord/pull/224)). Exercised within the same Strike-type phase as the scenario above, but through the ranged-attack UI path instead of an adjacent target. Loads a battle at `DEFENDER_STRIKE` on Plains terrain (no hazards to complicate pathing) with a defending Minotaur three hexes from an attacking creature — `Battle.rangestrikeTargets` excludes anything within melee range or a creature still locked in contact — and forces a hit via `window.DebugDice.nextRolls`. Selects the Minotaur, confirms a `RangestrikeIcon` renders on the target's hex (`BattleBoard.vue`'s `rangestrikeTargets` computed), clicks it, confirms `RangestrikeConfirmation` shows the expected dice count and to-hit number, clicks "Attack", confirms the target's wound count updates. Clicks "End Strikes", confirms the phase advances.

**Strikeback (Attacker's/Defender's Strikebacks)** (`e2e/battle-strikeback.spec.ts`, [#225](https://github.com/aolkin/warlord/pull/225)). Loads a battle at a strikeback phase with a creature already near-dead, and forces a lethal roll via the same target-and-confirm steps as the Strike scenario above. Clicks "End Strikebacks" and confirms the killed creature is actually removed from the board (`hex` reset to `0`) once the phase advances — `Battle.nextPhase`'s strikeback-only cleanup, the one behavior specific to this phase type rather than shared with Strike. (Full battle resolution is known-incomplete per doc 05, so there's no "battle ends" scenario to test yet.)

### CI (done)

The e2e suite runs in its own `.github/workflows/e2e.yml`, separate from `build.yml`'s Lint/Typecheck/Test/Build job so a flaky or failed run doesn't force retrying that whole job. It installs with `pnpm exec playwright install --with-deps chromium` and runs `pnpm test:e2e` on every `pull_request`.

## Cleanup items observed in passing (done)

- `Object.prototype.guid` extension and `unwrapInjectedRef` (doc 04) are gone.
- No debug `console.log` of the persisted game state on load remains in `models/game.ts`.
- The README now has real install/dev/build/lint instructions plus an Architecture section (models vs. store vs. components).
- `@3d-dice/dice-box` is now `^1.1.4`, and `DiceRoller.vue` uses its current API.
