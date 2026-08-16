# Mutation Classification: Server-Committed vs. Local

Extends doc 05's slice 2 (actions as data through a single dispatch). Doc 05 established *that* every state change should flow through a serializable action; this doc asks which of those actions a server would have to commit and order, and which never need to leave the client that made them. Everything below is read off the code as it stands today, including the `GameAction` union on the open `feat/dispatch-entry-point` branch.

## The binary doesn't survive contact with the code

The obvious framing is two buckets: server-committed records (an attack) versus local UI state (a pending split). Applied to the actual mutations, the second bucket comes out empty.

Local UI state already lives entirely outside the engine. Selection (`selectedStack`, `focusedHexes`), preferences, and `localPlayer` are in `src/ui/stores/ui/`; the in-flight strike inputs (`selectedCreature`, `target`, `optionalToHit` before submission) are component-local refs in `BattleBoard.vue`. None of it touches `TitanGame`, none of it is persisted with the game, and no `GameAction` variant writes to it. That work is already done.

Pending splits are not in that bucket. `Stack.togglePendingSplit` flips `stack.split[index]` on the persisted `Stack`, and `TitanGame.nextPhase`'s SPLIT case reads those same flags — through `Stack.finalizeSplit` — to decide which creatures leave and to allocate the new stack's marker. `getMayProceed` gates the phase-advance button on `Stack.isValidSplit`, reading the flags again. The split flags are the sole input to the split commit. A server that doesn't hold them cannot commit the split.

So the useful axis is not local-versus-remote. It is **how long a decision stays reversible, and who may see it while it is**.

## Three tiers

### Tier 1 — committed events

Irreversible on application, or they consume randomness, or they change what another player may do next. These are the log.

| Action | Why it commits |
|---|---|
| `setRoll` | Consumes randomness; sets the movement allowance for the whole phase. Passing `undefined` while a roll exists is the mulligan, which sets `mulliganTaken`. |
| `attackCreature` | Consumes randomness; `performAttack` adds wounds immediately and sets `hasStruck`. |
| `rangestrikeCreature` | Same, minus the carryover branch. |
| `assignCarryover` | Allocates already-rolled excess hits onto a second target; no path un-allocates them. |
| `skipCarryover` | Sets `carryoverSkipped`, permanently forfeiting those hits. |
| `nextPhase` (masterboard) | Finalizes every pending split and muster, decrements the creature pool, detects engagements, and hands the turn on. |
| `Battle.nextPhase` | Finalizes battle movement (off-board creatures at hex 0), clears `activeStrike`, removes dead creatures after STRIKEBACK, and hands the initiative to the other side. **Not in the union today** — see the gaps below. |
| `initiateBattle` | Reveals both stacks' contents to the opponent. |

`initiateBattle` is a special case: no UI path reaches it, only `nextPhase`'s MOVE branch calls it. Doc 05 already argues it should become an internal precondition of the phase advance rather than a separately dispatchable action, and this classification agrees — it is a consequence of a committed event, not a decision a player makes.

### Tier 2 — provisional decisions

Freely reversible by re-dispatching until a Tier 1 event consumes them, and hidden from the opponent while reversible. This is the category the "pending splits" example is reaching for, and it is larger than splits.

| Action | What it stages | What consumes it |
|---|---|---|
| `togglePendingSplit` | `stack.split[index]` | `nextPhase` SPLIT branch, via `finalizeSplit` |
| `setRecruit` | `stack.currentMuster` | `nextPhase` MUSTER branch, via `finalizeMuster` (this is also where the pool decrements) |
| `move` | `stack.hex`, `stack.attackEdge` | `nextPhase` MOVE branch, which reads engagements off the final positions |
| `moveCreature` | `creature.hex` | `Battle.nextPhase`, which is when off-board creatures are resolved |

Reversibility here is not theoretical — the UI already exercises it, and does so by re-dispatching the same action rather than by any undo mechanism. `MasterboardStack.select` calls `TitanGame.move` back to `stack.initialHex`, and `BattleBoard.removeSelected` calls `Battle.moveCreature` back to `creature.initialHex`.

Tier 2 is nonetheless **server-held, not client-local**, for two reasons. The commit reads it: `nextPhase` derives the split, muster, and engagement outcomes from state living inside `TitanGame`. And it survives reload today: everything in `game` is persisted, so a player who refreshes mid-split keeps their toggles. Making these purely client-side means either losing them on reload or building a second persistence path alongside the first.

What Tier 2 *does* change is visibility and durability. A Tier 2 action goes into the acting player's filtered view rather than the broadcast, and only its commit needs a durable log record — replaying `move`, `move`, `move` back to the same hex reconstructs nothing the final `nextPhase` doesn't already carry.

### Tier 3 — local UI state

Selection, focused hexes, preferences, `localPlayer`, and the pre-submission strike inputs. Already outside `game`, already outside the action union, nothing to do.

### Outside the tiers — state replacement

Three writes reach `game` without going through any action at all, and the classification has nothing to say about them because they are not gameplay:

- `gameStore.reset()` — `Object.assign(game, TitanGame.create(2))`
- `SystemMenu.loadJson()` — `Object.assign(game, JSON.parse(json))`, the paste-a-save path
- `SystemMenu.summon()` — pushes a creature straight onto `selectedStack.creatures`, a debug cheat

Under a server these become an admin capability or they go away. Worth an explicit decision rather than discovering them during the extraction.

## Two gaps in the union

Independent of the classification, comparing the union against the mutations the UI actually calls turns up two things.

`Battle.nextPhase(battle)` is bound to a click handler in `ActionPanel.vue` and has no variant in `GameAction`. It is a Tier 1 event by any reading — it ends a battle phase and passes initiative. The union's existing `nextPhase` variant covers only `TitanGame.nextPhase`.

`initiateBattle` has a variant but no caller, per the previous section. Doc 05 already proposes demoting it.

Everything else that mutates state under `src/game/models` is internal to another action: `Battle.performAttack` (called only by the two strike actions), `Battle.phaseEnterStrike` (only by `Battle.nextPhase`), `Stack.finalizeSplit` (only by `TitanGame.nextPhase`), and `Stack.reserveIdsThrough` (only by `hydrate`). None of them wants an action variant.

## Randomness is the actual refactor

The sharpest consequence of Tier 1. Three payloads carry numbers the client generated:

- `setRoll(game, payload?: number)` — `TurnPanel.roll()` calls the 3D dice widget and passes `rolled[0]` in.
- `AttackPayload.rolls` and `RangestrikePayload.rolls` — `BattleBoard.attackTargetedCreature` awaits the same widget and passes the array in.

Under an authoritative server these are outputs, not inputs. What a player sends is "strike this target, optionally at this raised to-hit"; the server rolls, and the committed record carries the rolls. Doc 05 already states the endpoint — whoever is authoritative seeds the rolls and the log records them, and the dice animation can render whatever the log says. What this classification adds is the shape: **`GameAction` is not one type but two related ones**, a request a client may send and a record the log holds, differing on exactly these three payloads. Nothing else in the union has that split.

The mulligan is worth folding into the same slice. `TurnPanel.roll()` sends `setRoll(undefined)` then `setRoll(n)` — two dispatches for one player intent, where the first one's meaning is inferred from `activeRoll !== undefined` rather than stated. Separating request from record is the natural moment to make it one action.

## What this means for `dispatch`

**The classification should not go in the action type.** Three shapes were considered:

A `serverCommitted: boolean` field on each variant restates what `type` already determines, so it can disagree with itself, and it is a field a network client could lie about. It also stops two clients from comparing actions by structural equality. Reject.

Two separate unions with two dispatch functions is honest about the difference, but every call site and every transport then has to know which union it holds, and the exhaustiveness machinery doubles. The two tiers also want identical treatment on the way *in* — validate, resolve ids, apply — and differ only in what happens after. Reject.

A lookup table beside the union:

```ts
const ACTION_TIER: Record<GameAction["type"], "committed" | "provisional"> = { ... }
```

`GameAction` stays a plain serializable discriminated union with no redundant field, `Record<GameAction["type"], …>` makes the table exhaustive at compile time the same way the `satisfies never` default case does, and the transport layer reads it to decide broadcast-to-all versus return-to-author. `dispatch` itself is unaffected — it applies the mutation identically either way.

**So #226's shape already accommodates this.** The single entry point, the discriminated union, and the id-carrying payloads are all still right. What #226 needs is the missing `Battle.nextPhase` variant, and a decision on demoting `initiateBattle`; the request/record split lands later and is additive.

## Sequencing

1. **Close the union's gaps.** Add the battle phase-advance variant; demote `initiateBattle` to an internal precondition of the MOVE phase advance. This is the only change #226 itself needs, and it unblocks it.
2. **Add the tier table.** Mechanical, no behavior change, and it is the artifact every later slice reads.
3. **Split request from record for the three randomness-carrying payloads.** Keep a local implementation that fills rolls in from today's dice widget, so single-player behavior is unchanged. Independently valuable: it is what makes the action log replayable, which doc 04 wants for undo and post-game review. Fold in the mulligan.
4. **Route both tiers through the `GameServer` interface** (doc 05 slice 3): provisional actions resolve to their author only, committed actions broadcast. This is where the tiers first *behave* differently; before it they are only a label.
5. **Hidden-information audit** (doc 05 slice 4), seeded by the Tier 2 list. One leak is already visible: `MasterboardStack.stackSize` renders `"5 / 3"` for any stack with split flags set, for every stack on the board, not only the viewer's own.
6. **Decide the fate of the three state-replacement writes.**

Steps 1–3 stand on their own and need no server. Steps 4–6 depend on the extraction.

## The open question

Tier 2 could instead be abolished, and this is the fork the classification exposes rather than settles.

Today the staged decision lives in `TitanGame` (`stack.split[]`, `stack.currentMuster`) and the commit reads it from there. The alternative is to move the decision into the phase-advance payload: `nextPhase` would carry the full split and muster choices, `togglePendingSplit` and `setRecruit` would vanish from the union entirely, and the staging state would live in the UI stores next to selection.

That is exactly the "pending splits are local UI state" model, and it earns real things — one fewer thing for the server to hold, filter, and validate, and a genuinely two-bucket action union. It costs two things: the UI has to own staging state it currently gets for free from `game`, and a mid-split reload loses the toggles unless the client persists them separately. Battle movement resists the same treatment more strongly, since a battle move is reversible across a much longer window and its legality depends on where every other creature currently stands.

Deciding this before step 1 is not necessary — the union gaps and the tier table are right either way — but it should be settled before step 4.
