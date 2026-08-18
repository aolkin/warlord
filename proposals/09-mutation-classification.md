# Mutation Classification: Server-Committed vs. Local

Extends doc 05's slice 2 (actions as data through a single dispatch). Doc 05 established *that* every state change should flow through a serializable action; this doc asks which of those actions a server must commit and order. Everything below is read off the code as it stands, including the `GameAction` union on the open `feat/dispatch-entry-point` branch.

The answer is two buckets, and getting there means moving every staged decision out of the engine.

## Committed

A committed action produces randomness, is irreversible once observed, or changes what another player may do next. These are the log, and every one of them broadcasts.

Action names take a namespace prefix matching the model layer's own split: `TitanGame` functions become `masterboard/…`, `Battle` functions `battle/…`.

| Action | Why it commits |
|---|---|
| `masterboard/finalizeSplits` | Splits the submitted creatures off each stack onto a fresh marker, advances `activePhase` from SPLIT to MOVE, and rolls for movement. Today `nextPhase(game)`'s SPLIT branch does the first two and `setRoll` does the third; entering MOVE is the only thing that occasions a movement roll (rule 6.2), so the roll is this commit's output rather than an action of its own. |
| `masterboard/rerollMove` | The first-move mulligan (rule 7.6): the player asks for one more roll, binding, offered once in round 0 before any stack has moved. `isMulliganAvailable` enforces exactly that today. The request carries nothing; the record carries the new roll. |
| `masterboard/finalizeMoves` | Applies the submitted moves, then either advances to MUSTER or opens the battle. |
| `masterboard/finalizeMusters` | Applies the submitted recruits and decrements the creature pool. |
| `masterboard/initiateBattle` | Reveals both stacks to the opponent. Has a variant but no caller — only `masterboard/finalizeMoves` reaches it. Doc 05 already proposes demoting it to an internal precondition of that action, and this classification agrees. |
| `battle/finalizeMoves` | Applies the submitted battle moves, then eliminates creatures still off-board and enters the strike phase. **Not in the union today.** |
| `battle/endStrikes` | Ends a STRIKE or STRIKEBACK phase: clears `activeStrike`, removes the dead after STRIKEBACK, passes initiative. **Not in the union today.** |
| `battle/attackCreature` | Names a target and, per rule 12.4, optionally a raised to-hit; the commit rolls the attacker's dice, and `performAttack` adds wounds immediately and sets `hasStruck`. |
| `battle/rangestrikeCreature` | Same, minus the carryover branch and the optional to-hit. |
| `battle/commitCarryover` | Applies already-rolled excess hits to the listed targets in order, or forfeits them if the list is empty. |

`assignCarryover(battle, target)` and `skipCarryover(battle)` today build one decision incrementally: call `assignCarryover` once per secondary target, in order, until the excess hits run out or the player calls `skipCarryover` to forfeit the rest. The player is choosing among creatures already visible as carryover-eligible (`Battle.carryoverTargets`), so the client accumulates the target list locally and the two collapse into one dispatch: `{ type: "battle/commitCarryover", payload: BattleCreature["id"][] }`. The engine applies the listed targets in order with the same `min(remaining hits, target's remaining capacity)` allocation `assignCarryover` already uses. `Battle.assignCarryover` and `Battle.skipCarryover` fold into one `Battle.commitCarryover(battle, targets)`.

## Client-only

Everything a player can still change their mind about. None of it is an action, none of it reaches the server, none of it lives in `game`.

| Staged decision | Where it lives today |
|---|---|
| Which creatures split off | `stack.split: boolean[]`, flipped by `Stack.togglePendingSplit` |
| Muster choice in progress | `stack.currentMuster`, set by `TitanGame.setRecruit` |
| Masterboard positions and attack edges | `stack.hex` / `stack.attackEdge`, set by `TitanGame.move` |
| Battle positions | `creature.hex`, set by `Battle.moveCreature` |

The UI already treats all four as reversible, and does it by re-dispatching rather than through any undo mechanism — `MasterboardStack.select` calls `TitanGame.move` back to `stack.initialHex`, `BattleBoard.removeSelected` calls `Battle.moveCreature` back to `creature.initialHex`. Selection, focused hexes, preferences, `localPlayer`, and the pre-submission strike inputs are already outside `game` and outside the union; staging joins them.

Staging stores go in `src/ui/stores/ui/` beside `selection.ts`, following its pattern: phase-scoped client state, cleared with `watch(() => gameStore.game.activePhase, ...)`. Surviving a reload costs a watcher, not a second persistence path — `preferences.ts` already persists a reactive object to localStorage the same way.

## Named actions instead of one phase advance

`nextPhase(game)` takes no payload today and reads the staged decisions off `game`; `Battle.nextPhase(battle)` does the same for battle moves. Each becomes one named action per phase, carrying that phase's decisions:

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

`MovePayload`, `MusterPayload`, and `BattleMovePayload` are today's shapes unchanged, so `move`, `setRecruit`, and `moveCreature` become list entries rather than actions. `setRoll` has no counterpart: its movement roll moves under `finalizeSplits` (below).

The name states the phase, so one arriving against a phase the game has already left is rejected on its name alone — `move`, `setRecruit`, and `setRoll` each assert `activePhase` today. `battle/endStrikes` covers both STRIKE and STRIKEBACK, which `Battle.nextPhase` handles in one branch and which stage nothing, each strike having committed on its own. The masterboard BATTLE phase gets no action at all: `nextPhase`'s BATTLE branch asserts a battle exists and advances, nothing calls it, and no code ends a battle.

**The lists are ordered and the engine replays them in order**, because a later move's legality depends on the earlier ones: `getPathsForHex` rejects a hex another of the mover's own stacks occupies, and `creatureCanLand` rejects an occupied battle hex.

**Validation moves from gating the button to checking the payload.** `getMayProceed` gates `TurnPanel`'s advance button today, reading the staged decisions straight off `game`; the same rules become the commit's preconditions — `Stack.isValidSplit` over each submitted index list (including the round-0 four-with-one-lord rule), each move lying on a path `getPathsForHex` returns, no mandatory move left unmade, `Stack.canMuster` and pool availability per muster. The client keeps running them to gate the button; the server runs them because a client may lie.

**What leaves the engine.** `Stack.split` and `Stack.currentMuster` come off `Stack`; `Stack.togglePendingSplit` and `TitanGame.setRecruit` stop existing; `TitanGame.move` and `Battle.moveCreature` stop being actions and become the loop bodies of the two move finalizations. `Stack.finalizeSplit` takes the index list instead of reading flags, and `finalizeMuster` takes the choice. `Moveable.initialHex` stays: it is the committed pre-move position, and `Stack.canMuster` reads `hasMoved` off it during the muster phase.

## Randomness is the server's

**No request a client sends ever carries a rolled number.** A client names the choice — finish splitting, take the mulligan, strike this target at this to-hit — and the server rolls while committing it, broadcasting the roll in the record. A client that supplies its own dice can cheat: today `TurnPanel.roll()` and `BattleBoard.attackTargetedCreature` read numbers off the 3D dice roller and pass them into `setRoll` and `AttackPayload.rolls` / `RangestrikePayload.rolls`.

So **`GameAction` is two related types**, a request a client may send and a record the log holds, differing only on the four variants that roll: `masterboard/finalizeSplits` and `masterboard/rerollMove` records add the movement roll, `battle/attackCreature` and `battle/rangestrikeCreature` records add the strike's dice. A roll is never its own action — it attaches to the commit that occasions it, which is why the mulligan gets its own action (rule 7.6) rather than reusing `finalizeSplits`. Dice count and the unraised to-hit are derived from attacker, target, and terrain — `getAdjustedStrike` and `getRangestrike` already compute both — so the request never supplies either; only `attackCreature`'s optional raised to-hit (rule 12.4) rides along. `TurnPanel.roll()` expresses the mulligan today as two dispatches, `setRoll(undefined)` then `setRoll(n)`; `masterboard/rerollMove` names it once.

The dice widget stops producing rolls and starts replaying the ones the record carries, so rule 12.4's requirement that a raised to-hit be announced before any dice roll holds by construction — the declaration is part of the request that occasions the roll.

`TitanGame.create`'s `random.shuffle` over player colors is the one roll outside this list and never was an action; game setup is server-side under the same rule.

## What this means for `dispatch`

Nothing. Every remaining variant is committed, so there is no per-action routing decision to encode — no `serverCommitted` field, no lookup table. The transport broadcasts everything `dispatch` accepts. The one distinction the union does carry is request versus record, and that is about who fills in a roll, not about where an action goes. #226's shape — single entry point, discriminated union, id-carrying payloads — is unaffected; what changes is which variants the union holds and what they are called.

## Interaction with the hidden-information audit

The hidden-information audit (doc 05 slice 4, drafted in #230) puts `Stack.creatures`, `Stack.split`, and `Stack.currentMuster` in the redaction surface. Two of those three stop reaching the server at all, leaving `Stack.creatures` as the only field to strip, and rule 4.3 (which creatures split off is never revealed to anyone) then holds by construction rather than by remembering to filter. It also removes the leak that audit flags in `MasterboardStack.stackSize`, which renders `"5 / 3"` off any stack's split flags.

Movement is not a hidden-information win. That audit has `hex` public and, under rule 9.1, battle state fully public once a battle exists — so staging movement client-side delays information the rules make public rather than protecting anything secret. The case for it is the one above: a smaller server-held surface and a uniformly committed union.

## Outside the buckets — state replacement

Three writes reach `game` through no action at all, and the classification has nothing to say about them because they are not gameplay: `gameStore.reset()`, `SystemMenu.loadJson()` (the paste-a-save path), and `SystemMenu.summon()` (a debug cheat that pushes a creature straight onto `selectedStack.creatures`). Under a server these become an admin capability or they go away. Worth deciding rather than discovering during the extraction.

## Sequencing

1. **Split `nextPhase` into the per-phase actions and adopt the prefixes.** `battle/finalizeMoves` and `battle/endStrikes` are new; `initiateBattle` gets demoted. The only change #226 itself needs, and it unblocks it.
2. **Collapse carryover into `battle/commitCarryover`.** Independent of #226 — it lands whenever the UI is ready to accumulate the target list locally.
3. **Move split and muster staging to the client** (what leaves the engine, above): `finalizeSplits` and `finalizeMusters` take the decisions as payload.
4. **Move masterboard and battle movement to the client**, the same way. Larger than step 3 because the moves are an ordered list to replay, not an independent choice per stack.
5. **Split request from record** for the four roll-carrying variants. The commit path rolls through `src/game/models/random.ts`'s `Random` seam, which gains a die roll beside its `shuffle`, so single-player behavior is unchanged and the dice widget animates numbers it is handed. This makes the log replayable, supporting undo and post-game review.
6. **Route the union through the `GameServer` interface** (doc 05 slice 3).
7. **Decide the fate of the three state-replacement writes.**

Steps 1–5 stand on their own and need no server.
