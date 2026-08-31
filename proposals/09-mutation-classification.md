# Mutation Classification: Server-Committed vs. Local

Extends doc 05's slice 2, which established that every state change should flow through a serializable action. This doc classifies those actions into what a server must commit and order versus what stays client-only, and lays out the resulting `GameAction` union — the shape #241 (`feat/dispatch-entry-point-v2`) is rewriting `dispatch` to hold. Everything below is read off `main` as it stands.

The answer is two buckets, reached by moving every staged decision out of the engine.

## Committed

A committed action produces randomness, is irreversible once observed, or changes what another player may do next. These are the log, and every one broadcasts.

Each action's `type` discriminant is a literal string prefix matching the model layer's own split (`TitanGame` vs. `Battle`) — `TitanGame.finalizeSplits` dispatches as `{ type: "masterboard/finalizeSplits", ... }`, `Battle.finalizeMoves` as `{ type: "battle/finalizeMoves", ... }`, and so on — with `dispatch` switching on the whole string as one discriminated union.

| Action | Why it commits |
|---|---|
| `masterboard/finalizeSplits` | Splits the submitted creatures onto a fresh marker, advances `activePhase` to MOVE, and rolls for movement — `TitanGame.finalizeSplits` already does all three, since entering MOVE is the only trigger for a movement roll (rule 6.2). |
| `masterboard/rerollMove` | The first-move mulligan (rule 7.6): one extra roll, offered once in round 0 before any stack has moved. `isMulliganAvailable` enforces that today. Carries no payload; the record carries the new roll. |
| `masterboard/finalizeMoves` | Applies the submitted moves and commits movement only. If no stack ends up engaged, the phase advances to MUSTER; otherwise to BATTLE with none of them resolved yet. |
| `masterboard/finalizeMusters` | Applies the submitted recruits and decrements the creature pool. |
| `masterboard/initiateBattle` | Reveals both stacks to the opponent, called once per battle. Rule 9.1 has the active player choose the engagement order first, before either side inspects the opposing Legion — a choice `finalizeMoves` can't make on the player's behalf, since it commits before any stack is revealed — and since a round can engage more than one stack at once (`getEngagedStacks`), this stays a separate action rather than folding into `finalizeMoves`. `finalizeMoves` no longer opens the first engagement automatically (#256), but no UI calls `initiateBattle` yet — there is currently no way to start a battle from the running app. |
| `battle/finalizeMoves` | Applies submitted battle moves, eliminates creatures still off-board, enters the strike phase. `Battle.nextPhase` refuses to run during MOVE, asserting `finalizeMoves` handles it instead. |
| `battle/endStrikes` | Ends a STRIKE or STRIKEBACK phase: clears `activeStrike`, removes the dead after STRIKEBACK, passes initiative — what `Battle.nextPhase`'s STRIKE/STRIKEBACK branch does today. |
| `battle/attackCreature` | Names a target and, per rule 12.4, optionally a raised to-hit; commits by rolling the attacker's dice, then `performAttack` adds wounds and sets `hasStruck`. |
| `battle/rangestrikeCreature` | Same, minus the carryover branch and the optional to-hit. |
| `battle/commitCarryover` | Applies already-rolled excess hits to the listed targets in order, or forfeits them if the list is empty. |

`assignCarryover`/`skipCarryover` today build one decision incrementally — call `assignCarryover` per target until hits run out or `skipCarryover` forfeits the rest — over creatures already visible as eligible (`Battle.carryoverTargets`). Since the client already knows the full eligible set, it can accumulate the target list locally and collapse both into one dispatch, `{ type: "battle/commitCarryover", payload: BattleCreature["id"][] }`, applied in order with the same `min(remaining hits, target's remaining capacity)` allocation. `Battle.assignCarryover` and `.skipCarryover` fold into one `Battle.commitCarryover(battle, targets)`.

## Client-only

Everything a player can still change their mind about. None of it is an action, none reaches the server, none lives in `game`.

| Staged decision | Where it lives today |
|---|---|
| Which creatures split off | `src/ui/stores/ui/stackSplits.ts`, toggled by `useStackSplitsStore.toggle` |
| Muster choice in progress | `src/ui/stores/ui/musterStaging.ts`, set by `useMusterStagingStore.stage` |
| Masterboard positions and attack edges | `src/ui/stores/ui/moveStaging.ts`, set by `useMoveStagingStore.stage` |
| Battle positions | `src/ui/stores/ui/battleMoveStaging.ts`, set by `useBattleMoveStagingStore.stage` |

All four stay this way until their finalize action commits, and are reversible by removing them from the staging store's map (`unstage`, or toggling back off) rather than through any undo mechanism. Selection, focused hexes, preferences, `localPlayer`, and pre-submission strike inputs are outside `game` and the union the same way. Staging stores live in `src/ui/stores/ui/` beside `selection.ts`, following its pattern: phase-scoped, cleared with a `watch` on the relevant phase field, surviving a reload the same way `preferences.ts` already persists a reactive object to localStorage.

## Named actions instead of one phase advance

The masterboard side has already split this way: `TitanGame.finalizeSplits`, `.finalizeMoves`, and `.finalizeMusters` already exist as separately named functions taking that phase's decisions as payload, matching the action names below almost exactly. `Battle.nextPhase(battle)` hasn't split yet — it still handles both STRIKE and STRIKEBACK advances in one function (becoming `battle/endStrikes`) — while `Battle.finalizeMoves` has already peeled the MOVE case off it. What's left is wrapping these already-split functions in a `GameAction` union, one named action per phase:

```ts
export interface SplitCommit {
  stack: StackRef
  creatures: number[] // indices into stack.creatures
}

// The GameAction variants replacing `nextPhase` and `setRoll`:
  | { type: "masterboard/finalizeSplits", payload: SplitCommit[] }
  | { type: "masterboard/rerollMove" }
  | { type: "masterboard/finalizeMoves", payload: MovePayload[] }
  | { type: "masterboard/finalizeMusters", payload: MusterPayload[] }
  | { type: "battle/finalizeMoves", payload: BattleMovePayload[] }
  | { type: "battle/endStrikes" }
```

`MovePayload`, `MusterPayload`, and `BattleMovePayload` are today's shapes, unchanged — the old `move`, `setRecruit`, and `moveCreature` functions are already gone, their per-stack decisions staged as list entries in the UI stores above rather than dispatched individually. `setRoll` has no counterpart either: the movement roll already happens inside `finalizeSplits`.

The name states the phase, so an action arriving against a phase the game has already left is rejected on its name alone — `finalizeSplits`, `finalizeMoves`, `finalizeMusters`, and `takeMulligan` each assert `activePhase` today. `battle/endStrikes` covers both STRIKE and STRIKEBACK, since `Battle.nextPhase` handles both in one branch and neither stages anything (each strike commits on its own). The masterboard BATTLE phase gets no action at all — no function transitions out of it, and no code ends a battle.

**The lists are ordered and the engine replays them in order**, because a later move's legality depends on the earlier ones: `getPathsForHex` rejects a hex another of the mover's own stacks occupies, and `creatureCanLand` rejects an occupied battle hex.

**Validation moves from gating the button to checking the payload.** `mayProceedFromSplit`, `mayProceedFromMove`, and `mayProceedFromMuster` gate `TurnPanel`'s advance button today, each reading its phase's staged decisions from the corresponding UI store; the same rules become the commit's preconditions — `Stack.isValidSplit` over each submitted index list, each move lying on a path `getPathsForHex` returns, no mandatory move left unmade, `Stack.canMuster` and pool availability per muster. The client keeps running them to gate the button; the server runs them because a client may lie.

**What left the engine.** `TitanGame.move` and `Battle.moveCreature` are gone, replaced by the loop bodies of their `finalize*` counterparts. `Moveable.initialHex` stays, though: it's the committed pre-move position, and `Stack.canMuster` reads `hasMoved` off it during the muster phase.

## Randomness is the server's

**No request a client sends ever carries a rolled number.** A client names the choice — finish splitting, take the mulligan, strike this target at this to-hit — and the server rolls while committing it, broadcasting the roll in the record. The masterboard half is already true: `TitanGame.finalizeSplits` and `.takeMulligan` roll internally through the `Random` seam rather than taking a roll from their caller. The battle side isn't: `BattleBoard.attackTargetedCreature` today reads numbers off the 3D dice roller and passes them into `AttackPayload.rolls`/`RangestrikePayload.rolls`, which a client could forge.

So `GameAction` is two related types — a request a client may send, and a record the log holds — differing only on the four variants that roll: `masterboard/finalizeSplits` and `.rerollMove` records add the movement roll; `battle/attackCreature` and `.rangestrikeCreature` records add the strike's dice. A roll is never its own action; it attaches to the commit that occasions it, which is why the mulligan gets its own action rather than reusing `finalizeSplits`. Dice count and the unraised to-hit are derived from attacker, target, and terrain (`getAdjustedStrike`, `getRangestrike` already compute both), so only `attackCreature`'s optional raised to-hit (rule 12.4) rides along in the request — and since the dice widget will replay the roll the record carries instead of producing it, rule 12.4's requirement that a raised to-hit be announced before any roll holds by construction.

`TitanGame.create`'s `random.shuffle` over player colors is the one roll outside this list and never was an action; game setup is server-side under the same rule.

## What this means for `dispatch`

Nothing. Every remaining variant is committed, so there's no per-action routing decision to encode — no `serverCommitted` field, no lookup table. The transport broadcasts everything `dispatch` accepts. The only distinction the union carries is request versus record, which is about who fills in a roll, not where an action goes. Doc 05's dispatch shape — single entry point, discriminated union, id-carrying payloads — is unaffected; this classification only settles which variants the union holds and what they're called.

## Interaction with the hidden-information audit

The hidden-information audit (doc 05 slice 4, drafted in #230) put `Stack.creatures`, `Stack.split`, and `Stack.currentMuster` in the redaction surface. Two of those three are already gone from `Stack` — split and muster staging moved into per-client UI stores above — leaving `Stack.creatures` as the only field left to strip. Rule 4.3 (which creatures split off is never revealed) now holds by construction rather than by remembering to filter, since a staged split only ever exists in the browser of the client that owns it; `MasterboardStack.stackSize`, which renders `"5 / 3"` off a staged split, no longer risks leaking that either.

Movement is not a hidden-information win, though: that audit already has `hex` public, and rule 9.1 makes battle state fully public once a battle exists — so staging movement client-side delays public information rather than protecting anything secret. The case for it is the one above: a smaller server-held surface and a uniformly committed union.

## Outside the buckets — state replacement

Three writes reach `game` through no action at all, and the classification has nothing to say about them because they aren't gameplay: `gameStore.reset()`, `SystemMenu.loadJson()` (the paste-a-save path), and `SystemMenu.summon()` (a debug cheat that pushes a creature straight onto `selectedStack.creatures`). These stay outside the action union and keep bypassing `dispatch` — browser-local cheat paths, kept and maintained as such rather than migrated into a server-visible capability or removed.

## Sequencing

1. **Split `nextPhase` into the per-phase actions and adopt the prefixes — in progress in #241.** `battle/finalizeMoves` and `battle/endStrikes` are new as dispatchable actions; `initiateBattle` already stays standalone and can be dispatched once per battle. The only change #241 itself needs, and it unblocks it.
2. **Collapse carryover into `battle/commitCarryover` — in progress in #242, stacked on #241.** Lands whenever the UI is ready to accumulate the target list locally.
3. **Move split and muster staging to the client — done (#244, #246).**
4. **Move masterboard and battle movement to the client — done (#245, #247, #256)**, the same way, but larger since moves are an ordered list to replay rather than an independent per-stack choice.
5. **Split request from record — in progress in #241/#242** for the four roll-carrying variants. The commit path rolls through `src/game/models/random.ts`'s `Random` seam, which gains a die roll beside its `shuffle`, so single-player behavior is unchanged and the dice widget animates numbers it's handed. This makes the log replayable, supporting undo and post-game review.
6. **Route the union through the `GameServer` interface** (doc 05 slice 3). Not started.

Steps 1–5 stand on their own and need no server.
