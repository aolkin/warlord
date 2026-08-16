# Mutation Classification: Server-Committed vs. Local

Extends doc 05's slice 2 (actions as data through a single dispatch). Doc 05 established *that* every state change should flow through a serializable action; this doc asks which of those actions a server must commit and order. Everything below is read off the code as it stands, including the `GameAction` union on the open `feat/dispatch-entry-point` branch.

The answer is two buckets, and getting there means moving every staged decision out of the engine.

## Committed

A committed action consumes randomness, is irreversible once observed, or changes what another player may do next. These are the log, and every one of them broadcasts.

| Action | Why it commits |
|---|---|
| `setRoll` | Consumes randomness; bounds every path the movement phase can stage. Passing `undefined` while a roll exists is the mulligan. |
| `attackCreature` | Consumes randomness; `performAttack` adds wounds immediately and sets `hasStruck`. |
| `rangestrikeCreature` | Same, minus the carryover branch. |
| `commitCarryover` | Applies already-rolled excess hits to the listed targets in order, or forfeits them if the list is empty. |
| `nextPhase` | Applies the phase's staged decisions, then advances. Payload described below. |
| `battleNextPhase` | Same for `Battle.nextPhase`: applies staged battle moves, resolves off-board creatures, clears `activeStrike`, removes the dead after STRIKEBACK, passes initiative. **Not in the union today.** |
| `initiateBattle` | Reveals both stacks to the opponent. Has a variant but no caller — only `nextPhase`'s MOVE branch reaches it. Doc 05 already proposes demoting it to an internal precondition of that advance, and this classification agrees. |

`assignCarryover(battle, target)` and `skipCarryover(battle)` today build one decision incrementally: call `assignCarryover` once per secondary target, in order, until the excess hits run out or the player calls `skipCarryover` to forfeit the rest. The player is choosing among creatures already visible as carryover-eligible (`Battle.carryoverTargets`), and nothing applies until the allocation settles, so the two collapse into one dispatch: `{ type: "commitCarryover", payload: BattleCreature["id"][] }`. The engine applies the listed targets in order with the same `min(remaining hits, target's remaining capacity)` allocation `assignCarryover` already uses; an empty array is what `skipCarryover` means. `Battle.assignCarryover` and `Battle.skipCarryover` fold into one `Battle.commitCarryover(battle, targets)`.

## Client-only

Everything a player can still change their mind about. None of it is an action, none of it reaches the server, none of it lives in `game`.

| Staged decision | Where it lives today |
|---|---|
| Which creatures split off | `stack.split: boolean[]`, flipped by `Stack.togglePendingSplit` |
| Muster choice in progress | `stack.currentMuster`, set by `TitanGame.setRecruit` |
| Masterboard positions and attack edges | `stack.hex` / `stack.attackEdge`, set by `TitanGame.move` |
| Battle positions | `creature.hex`, set by `Battle.moveCreature` |

The UI already treats all four as reversible, and does it by re-dispatching rather than through any undo mechanism — `MasterboardStack.select` calls `TitanGame.move` back to `stack.initialHex`, `BattleBoard.removeSelected` calls `Battle.moveCreature` back to `creature.initialHex`. Selection, focused hexes, preferences, `localPlayer`, and the pre-submission strike inputs are already outside `game` and outside the union; staging joins them.

Staging stores go in `src/ui/stores/ui/` beside `selection.ts`, which is the pattern: it holds phase-scoped client state and clears it with `watch(() => gameStore.game.activePhase, ...)`. Reload durability costs a watcher, not a second persistence path — `preferences.ts` already persists a reactive object to localStorage with the same deep `watch` the game store uses.

## The phase-advance payload

`nextPhase(game)` takes no payload today and reads the staged decisions off `game`. It instead carries them, discriminated by the phase being left:

```ts
export interface SplitCommit {
  stack: StackRef
  creatures: number[] // indices into stack.creatures
}

export type PhaseCommit =
  | { phase: MasterboardPhase.SPLIT, splits: SplitCommit[] }
  | { phase: MasterboardPhase.MOVE, moves: MovePayload[] }
  | { phase: MasterboardPhase.MUSTER, musters: MusterPayload[] }
  | { phase: MasterboardPhase.BATTLE }
```

`MovePayload` and `MusterPayload` are today's shapes unchanged, so `move` and `setRecruit` become list entries rather than actions. `battleNextPhase` carries `BattleMovePayload[]`, empty outside the MOVE phases. Tagging the payload with the phase also lets the server reject an advance staged against a phase it has already left.

**The lists are ordered and the engine replays them in order**, because a later move's legality depends on the earlier ones: `getPathsForHex` rejects a hex another of the mover's own stacks occupies, and `creatureCanLand` rejects an occupied battle hex.

**Validation moves from gating the button to checking the payload.** `getMayProceed` gates `TurnPanel`'s advance button today, reading the staged decisions straight off `game`; the same rules become the commit's preconditions — `Stack.isValidSplit` over each submitted index list (including the round-0 four-with-one-lord rule), each move lying on a path `getPathsForHex` returns, no mandatory move left unmade, `Stack.canMuster` and pool availability per muster. The client keeps running them to gate the button; the server runs them because a client may lie.

**What leaves the engine.** `Stack.split` and `Stack.currentMuster` come off `Stack`; `Stack.togglePendingSplit` and `TitanGame.setRecruit` stop existing; `TitanGame.move` and `Battle.moveCreature` stop being actions and become the loop bodies of the two commits. `Stack.finalizeSplit` takes the index list instead of reading flags, and `finalizeMuster` takes the choice. `Moveable.initialHex` stays: it is the committed pre-move position, and `Stack.canMuster` reads `hasMoved` off it during the muster phase.

## Randomness is the other refactor

Three payloads carry numbers the client generated: `setRoll(game, payload?: number)` from `TurnPanel.roll()`'s 3D dice widget, and `AttackPayload.rolls` / `RangestrikePayload.rolls` from the same widget via `BattleBoard.attackTargetedCreature`. Under an authoritative server these are outputs. A player sends "strike this target, optionally at this raised to-hit"; the server rolls, and the record carries the rolls. So **`GameAction` is two related types**, a request a client may send and a record the log holds, differing on exactly these three payloads. Nothing else in the union has that split.

Fold the mulligan into the same slice. `TurnPanel.roll()` sends `setRoll(undefined)` then `setRoll(n)` — two dispatches for one intent, where the first one's meaning is inferred from `activeRoll !== undefined` rather than stated.

## What this means for `dispatch`

Nothing. Once staging is client-only every remaining variant is committed, so there is no per-action routing decision to encode — no `serverCommitted` field, no second union, no lookup table. The transport broadcasts everything `dispatch` accepts. #226's shape — single entry point, discriminated union, id-carrying payloads — is unaffected; what it needs is the battle phase-advance variant and a decision on demoting `initiateBattle`.

## Interaction with the hidden-information audit

The hidden-information audit (doc 05 slice 4, drafted in #230) puts `Stack.creatures`, `Stack.split`, and `Stack.currentMuster` in the redaction surface. Two of those three stop reaching the server at all, leaving `Stack.creatures` as the only field to strip, and rule 4.3 (which creatures split off is never revealed to anyone) then holds by construction rather than by remembering to filter. It also removes the leak that audit flags in `MasterboardStack.stackSize`, which renders `"5 / 3"` off any stack's split flags.

Movement is not a hidden-information win. That audit has `hex` public and, under rule 9.1, battle state fully public once a battle exists — so staging movement client-side delays information the rules make public rather than protecting anything secret. The case for it is the one above: a smaller server-held surface and a uniformly committed union.

## Outside the buckets — state replacement

Three writes reach `game` through no action at all, and the classification has nothing to say about them because they are not gameplay: `gameStore.reset()`, `SystemMenu.loadJson()` (the paste-a-save path), and `SystemMenu.summon()` (a debug cheat that pushes a creature straight onto `selectedStack.creatures`). Under a server these become an admin capability or they go away. Worth deciding rather than discovering during the extraction.

## Sequencing

1. **Close the union's gaps.** Add the battle phase-advance variant; demote `initiateBattle`. The only change #226 itself needs, and it unblocks it.
2. **Collapse carryover into `commitCarryover`.** Independent of #226 — it lands whenever the UI is ready to accumulate the target list locally.
3. **Move split and muster staging to the client.** `nextPhase` grows its `PhaseCommit` payload for those two phases, the two actions leave the union, and the two fields leave `Stack`.
4. **Move masterboard and battle movement to the client**, the same way. Larger than step 3 because the staged moves are an ordered list the commit has to replay, not an independent choice per stack.
5. **Split request from record** for the three randomness-carrying payloads, keeping a local implementation that fills rolls from today's dice widget so single-player behavior is unchanged. This is what makes the log replayable, which doc 04 wants for undo and post-game review. Fold in the mulligan.
6. **Route the union through the `GameServer` interface** (doc 05 slice 3).
7. **Decide the fate of the three state-replacement writes.**

Steps 1–5 stand on their own and need no server.
