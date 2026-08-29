# Mutation Classification: Server-Committed vs. Local

Extends doc 05's slice 2 (actions as data through a single dispatch). Doc 05 established *that* every state change should flow through a serializable action; this doc asks which of those actions a server must commit and order, and lays out the resulting `GameAction` union. Everything below is read off the code as it stands on `main`; that union is what #241 (`feat/dispatch-entry-point-v2`) gets rewritten to hold, not an extension of what it holds today.

The answer is two buckets, and getting there means moving every staged decision out of the engine.

## Committed

A committed action produces randomness, is irreversible once observed, or changes what another player may do next. These are the log, and every one of them broadcasts.

Action names take a literal string prefix on the `type` discriminant itself, not a description of which file the function lives in: `TitanGame.finalizeSplits` dispatches as `{ type: "masterboard/finalizeSplits", ... }`, `Battle.finalizeMoves` as `{ type: "battle/finalizeMoves", ... }`, and so on for every action below. `dispatch` switches on that whole string as one discriminated union, the same way for every variant; the prefix isn't a separate routing key, it's naming convention baked into the string, chosen to match the model layer's own split (`TitanGame` vs `Battle`).

| Action | Why it commits |
|---|---|
| `masterboard/finalizeSplits` | Splits the submitted creatures off each stack onto a fresh marker, advances `activePhase` from SPLIT to MOVE, and rolls for movement. `TitanGame.finalizeSplits` already does all three today; entering MOVE is the only thing that occasions a movement roll (rule 6.2), so the roll is this commit's output rather than an action of its own. |
| `masterboard/rerollMove` | The first-move mulligan (rule 7.6): the player asks for one more roll, binding, offered once in round 0 before any stack has moved. `isMulliganAvailable` enforces exactly that today. The request carries nothing; the record carries the new roll. |
| `masterboard/finalizeMoves` | Applies the submitted moves and commits movement only — it does not open a battle itself. If no stack ends up engaged, the phase advances to MUSTER; if one or more do, it advances to BATTLE with none of them resolved yet. |
| `masterboard/finalizeMusters` | Applies the submitted recruits and decrements the creature pool. |
| `masterboard/initiateBattle` | Reveals both stacks to the opponent. Rule 9.1 has the active player choose the order engagements are resolved in only after inspecting each defending stack — a choice `finalizeMoves` can't make on the player's behalf, since it commits before any stack's contents are revealed. A round can engage more than one of the active player's stacks at once (`getEngagedStacks` returns all of them, and since #256 `finalizeMoves` lands in BATTLE with none of them opened, leaving the player to start each from a per-stack list rather than only the first), so `initiateBattle` must stay a separately dispatchable action, called once per battle, in the order the player picks. This classification does not follow doc 05's proposal to fold it into `finalizeMoves` as an internal precondition — that proposal assumed a round engages at most one stack. |
| `battle/finalizeMoves` | Applies the submitted battle moves, then eliminates creatures still off-board and enters the strike phase. `Battle.finalizeMoves` already does this today; `Battle.nextPhase` explicitly refuses to run during the MOVE phase, asserting that `finalizeMoves` is what carries it instead. |
| `battle/endStrikes` | Ends a STRIKE or STRIKEBACK phase: clears `activeStrike`, removes the dead after STRIKEBACK, passes initiative. Today `Battle.nextPhase`'s STRIKE/STRIKEBACK branch does the same. |
| `battle/attackCreature` | Names a target and, per rule 12.4, optionally a raised to-hit; the commit rolls the attacker's dice, and `performAttack` adds wounds immediately and sets `hasStruck`. |
| `battle/rangestrikeCreature` | Same, minus the carryover branch and the optional to-hit. |
| `battle/commitCarryover` | Applies already-rolled excess hits to the listed targets in order, or forfeits them if the list is empty. |

`assignCarryover(battle, target)` and `skipCarryover(battle)` today build one decision incrementally: call `assignCarryover` once per secondary target, in order, until the excess hits run out or the player calls `skipCarryover` to forfeit the rest. The player is choosing among creatures already visible as carryover-eligible (`Battle.carryoverTargets`), so the client accumulates the target list locally and the two collapse into one dispatch: `{ type: "battle/commitCarryover", payload: BattleCreature["id"][] }`. The engine applies the listed targets in order with the same `min(remaining hits, target's remaining capacity)` allocation `assignCarryover` already uses. `Battle.assignCarryover` and `Battle.skipCarryover` fold into one `Battle.commitCarryover(battle, targets)`.

## Client-only

Everything a player can still change their mind about. None of it is an action, none of it reaches the server, none of it lives in `game`.

| Staged decision | Where it lives today |
|---|---|
| Which creatures split off | `src/ui/stores/ui/stackSplits.ts`, toggled by `useStackSplitsStore.toggle` |
| Muster choice in progress | `src/ui/stores/ui/musterStaging.ts`, set by `useMusterStagingStore.stage` |
| Masterboard positions and attack edges | `src/ui/stores/ui/moveStaging.ts`, set by `useMoveStagingStore.stage` |
| Battle positions | `src/ui/stores/ui/battleMoveStaging.ts`, set by `useBattleMoveStagingStore.stage` |

All four are now staged this way, never landing on `game` until the corresponding finalize action commits. The UI treats each as reversible by removing it from the staging store's map directly (`unstage`, or toggling it back off) rather than through any undo mechanism or a round-trip through the model layer. Selection, focused hexes, preferences, `localPlayer`, and the pre-submission strike inputs are outside `game` and outside the union the same way; staging joined them once steps 3 and 4 below landed (#244–#247, #256).

Staging stores live in `src/ui/stores/ui/` beside `selection.ts`, following its pattern: phase-scoped client state, cleared with a `watch` on the relevant phase field. Surviving a reload costs a watcher, not a second persistence path — `preferences.ts` already persists a reactive object to localStorage the same way.

## Named actions instead of one phase advance

The masterboard side of this split has already happened: `TitanGame.finalizeSplits`, `TitanGame.finalizeMoves`, and `TitanGame.finalizeMusters` already exist as separately named functions, each taking that phase's decisions as payload, matching the action names below almost exactly. `Battle.nextPhase(battle)` hasn't split the same way yet — it still handles both the STRIKE and STRIKEBACK phase advances in one function (becoming `battle/endStrikes` below), while `Battle.finalizeMoves` has already peeled the MOVE case off it. What's left is wrapping these already-split functions in a `GameAction` union, one named action per phase:

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

`MovePayload`, `MusterPayload`, and `BattleMovePayload` are today's shapes, unchanged: the old `move`, `setRecruit`, and `moveCreature` functions are already gone, their per-stack decisions staged as list entries in the UI stores above rather than dispatched as actions. `setRoll` has no counterpart either: its movement roll already happens inside `finalizeSplits` (above).

The name states the phase, so one arriving against a phase the game has already left is rejected on its name alone — `finalizeSplits`, `finalizeMoves`, `finalizeMusters`, and `takeMulligan` each assert `activePhase` today. `battle/endStrikes` covers both STRIKE and STRIKEBACK, which `Battle.nextPhase` handles in one branch and which stage nothing, each strike having committed on its own. The masterboard BATTLE phase gets no action at all: no function transitions out of it, and no code ends a battle.

**The lists are ordered and the engine replays them in order**, because a later move's legality depends on the earlier ones: `getPathsForHex` rejects a hex another of the mover's own stacks occupies, and `creatureCanLand` rejects an occupied battle hex.

**Validation moves from gating the button to checking the payload.** `mayProceedFromSplit`, `mayProceedFromMove`, and `mayProceedFromMuster` gate `TurnPanel`'s advance button today, each reading its phase's staged decisions from the corresponding UI store; the same rules become the commit's preconditions — `Stack.isValidSplit` over each submitted index list (including the round-0 four-with-one-lord rule), each move lying on a path `getPathsForHex` returns, no mandatory move left unmade, `Stack.canMuster` and pool availability per muster. The client keeps running them to gate the button; the server runs them because a client may lie.

**What left the engine.** `Stack.split` and `Stack.currentMuster` have come off `Stack`; `Stack.togglePendingSplit` and `TitanGame.setRecruit` no longer exist; `TitanGame.move` and `Battle.moveCreature` are gone, replaced by the loop bodies of `TitanGame.finalizeMoves` and `Battle.finalizeMoves`. `Stack.finalizeSplit` takes the index list instead of reading flags, and `TitanGame.finalizeMusters` takes the choice. `Moveable.initialHex` stays: it is the committed pre-move position, and `Stack.canMuster` reads `hasMoved` off it during the muster phase.

## Randomness is the server's

**No request a client sends ever carries a rolled number.** A client names the choice — finish splitting, take the mulligan, strike this target at this to-hit — and the server rolls while committing it, broadcasting the roll in the record. The masterboard half of this is already true: `TitanGame.finalizeSplits` and `TitanGame.takeMulligan` already roll internally through the `Random` seam rather than taking a roll from their caller (`TurnPanel.vue` calls each with no roll argument). A client that supplies its own dice can still cheat on the battle side: today `BattleBoard.attackTargetedCreature` reads numbers off the 3D dice roller and passes them into `AttackPayload.rolls` / `RangestrikePayload.rolls`.

So **`GameAction` is two related types**, a request a client may send and a record the log holds, differing only on the four variants that roll: `masterboard/finalizeSplits` and `masterboard/rerollMove` records add the movement roll, `battle/attackCreature` and `battle/rangestrikeCreature` records add the strike's dice. A roll is never its own action — it attaches to the commit that occasions it, which is why the mulligan gets its own action (rule 7.6) rather than reusing `finalizeSplits`. Dice count and the unraised to-hit are derived from attacker, target, and terrain — `getAdjustedStrike` and `getRangestrike` already compute both — so the request never supplies either; only `attackCreature`'s optional raised to-hit (rule 12.4) rides along. `TitanGame.takeMulligan` already expresses the mulligan as the one call `masterboard/rerollMove` names.

The dice widget stops producing rolls and starts replaying the ones the record carries, so rule 12.4's requirement that a raised to-hit be announced before any dice roll holds by construction — the declaration is part of the request that occasions the roll.

`TitanGame.create`'s `random.shuffle` over player colors is the one roll outside this list and never was an action; game setup is server-side under the same rule.

## What this means for `dispatch`

Nothing. Every remaining variant is committed, so there is no per-action routing decision to encode — no `serverCommitted` field, no lookup table. The transport broadcasts everything `dispatch` accepts. The one distinction the union does carry is request versus record, and that is about who fills in a roll, not about where an action goes. Doc 05's dispatch shape — single entry point, discriminated union, id-carrying payloads — is unaffected; this classification only settles which variants the union holds and what they're called.

## Interaction with the hidden-information audit

The hidden-information audit (doc 05 slice 4, drafted in #230) put `Stack.creatures`, `Stack.split`, and `Stack.currentMuster` in the redaction surface. Two of those three are already gone from `Stack` entirely — split and muster staging moved into per-client UI stores (above) — leaving `Stack.creatures` as the only field left to strip, and rule 4.3 (which creatures split off is never revealed to anyone) already holds by construction rather than by remembering to filter, since a stack's staged split now only exists in the browser of the client that owns it. `MasterboardStack.stackSize`, which renders `"5 / 3"` off a stack's staged split, no longer risks leaking that to other clients for the same reason.

Movement is not a hidden-information win. That audit has `hex` public and, under rule 9.1, battle state fully public once a battle exists — so staging movement client-side delays information the rules make public rather than protecting anything secret. The case for it is the one above: a smaller server-held surface and a uniformly committed union.

## Outside the buckets — state replacement

Three writes reach `game` through no action at all, and the classification has nothing to say about them because they are not gameplay: `gameStore.reset()`, `SystemMenu.loadJson()` (the paste-a-save path), and `SystemMenu.summon()` (a debug cheat that pushes a creature straight onto `selectedStack.creatures`). These stay outside the action union and keep bypassing `dispatch`: they are browser-local cheat paths, kept and maintained as such rather than migrated into a server-visible capability or removed.

## Sequencing

1. **Split `nextPhase` into the per-phase actions and adopt the prefixes — in progress in #241 (`feat/dispatch-entry-point-v2`).** `battle/finalizeMoves` and `battle/endStrikes` are new as dispatchable actions; `initiateBattle` already stays standalone and already dropped its `engagedStacks.length <= 1` assert (#256), so it can be dispatched once per battle when a round engages more than one stack. The only change #241 itself needs, and it unblocks it.
2. **Collapse carryover into `battle/commitCarryover` — in progress in #242 (`feat/dispatch-battle-actions`), stacked on #241.** It lands whenever the UI is ready to accumulate the target list locally.
3. **Move split and muster staging to the client — done (#244, #246)** (what left the engine, above): `finalizeSplits` and `finalizeMusters` take the decisions as payload.
4. **Move masterboard and battle movement to the client — done (#245, #247, #256)**, the same way. Larger than step 3 because the moves are an ordered list to replay, not an independent choice per stack.
5. **Split request from record — in progress in #241/#242** for the four roll-carrying variants. The commit path rolls through `src/game/models/random.ts`'s `Random` seam, which gains a die roll beside its `shuffle`, so single-player behavior is unchanged and the dice widget animates numbers it is handed. This makes the log replayable, supporting undo and post-game review.
6. **Route the union through the `GameServer` interface** (doc 05 slice 3). Not started.

Steps 1–5 stand on their own and need no server.
