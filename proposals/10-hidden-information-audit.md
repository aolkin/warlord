# Hidden Information Audit

Doc 05 lists this as pending under "Hidden information audit" (groundwork slice 4): which `TitanGame`/`Stack`/`Battle` state must not go to every player's client once a server sits between them. Descriptive research, not implementation.

Rulebook citations are section numbers from `assets/reference/titan-rules.md`.

## 1. What's genuinely hidden, per the rulebook

**A Legion's creature composition is secret from every other player by default.** Rule 4.5: characters stack face down under their Legion Marker and stay hidden even if the stack is disturbed. Rule 5.2: each player's two opening Legions start with three Creatures and one Lord, secret the same way.

**Composition is revealed to the opposing player, privately, once the two examine each other's Legion in the Engagement Phase.** Rule 9 starts an Engagement the moment a moving Legion enters an occupied Land, during Movement; rule 9.1 places the actual private examination later, in the Engagement Phase (6.3), where the Mover orders that turn's Engagements for resolution. The current codebase collapses that gap: only one simultaneous Engagement is supported — `initiateBattle` (`src/game/models/game.ts`) resolves whichever stack `getStacksForHex` finds first via `.find()`, so a second Engagement on the same turn is silently dropped rather than queued for later examination (a gap doc 05 already tracks). So today's redaction trigger is just "the two stacks share a hex," per `getEngagedStacks`; it becomes "which Engagement the Mover is currently examining" only once multi-Engagement support exists.

**Composition is revealed to everyone once the Engagement resolves by Battle.** Rule 9.1: characters stay secret "until they are either voluntarily slain as part of an agreement or concession..., or the Engagement is resolved by Battle which must be conducted in view of the other players." Rule 10.1 places both sides on the shared Battleland and rule 12.3's hit chits track wounds openly there for the rest of the Battle.

**Resolving an Engagement without Battle — flee, concession, or agreement — also reveals composition, at least to the winner**, because rules 9.2, 9.4, and 9.5 all total the losing Legion's character values into score. Whether that reveal reaches uninvolved third parties too, or stays known only to the two players plus the scorekeeper (20.2) or caretaker (20.1), isn't in the rulebook — flag for manual review before a server implementation defaults to one.

**Which creatures move in a split is never revealed, to anyone, at any time.** Rule 4.3: "players do not reveal which characters they split off." The resulting Legions' locations and owners are public; the split itself stays secret even after a later Engagement reveals each Legion's current contents.

**A Lord's identity is revealed only when its presence is the basis for a publicly-exercised ability**: Tower Teleportation (8.1), Titan Teleportation (8.2), and mustering a Warlock (18.5) each require showing the Lord that justifies them.

**Mustering reveals only the qualifying creature(s), not the rest of the stack.** Rule 18.0; a Legion mustering a Troll via two Ogres shows only those two Ogres (18.4).

**Everything else is public**: Legion positions/owners/counts (shared board; 4.1 forces a full reveal past seven characters), scores (20.2) and the Titan Power-factor derived from them (19.1), the caretaker's remaining creature pool (20.1), and dice rolls, phase, and turn (inherent to a shared board).

## 2. What's already separated out, and what isn't

None of the exposure below is a bug: `TitanGame` is one reactive object rendered by one Vue instance in one browser tab for local pass-and-play, so there's no other client to keep it from. The point is what a server split would need to redact.

Two of the three `Stack` fields this audit would have flagged are already gone. Splitting no longer stages a `split: boolean[]` on `Stack` — the pick lives in `useStackSplitsStore` (`src/ui/stores/ui/stackSplits.ts`), a Pinia store never merged into `game`. The in-progress muster choice likewise lives in `useMusterStagingStore` (`src/ui/stores/ui/musterStaging.ts`), also never merged into `game`; `Stack.latestMuster` is set only once `finalizeMusters` commits it, at the same time as `recruits[round]`, so by rule 18.0 it's already public by the time it appears. Neither staging store exists on a synced model at all — in a server-authoritative deployment each browser holds its own Pinia instance, so a store that never enters `game` never reaches another client regardless of any redaction logic. Ownership is checked, too: `stackSplitsStore.toggle` delegates to `TitanGame.isStackActive`, which returns false for a stack another player owns, so clicking someone else's stack no longer mutates anything.

What's left is `Stack.creatures: CreatureType[]` — a Legion's full composition, own or opponent's, with no visibility distinction in the type or in any function that reads it — and the display code that renders it unconditionally. [`MasterboardStack.vue`](../src/ui/components/game/masterboard/MasterboardStack.vue) shows a `visibleMuster` (the staged pick, or else `stack.latestMuster`) on the board for any stack, with no owner check or hovering required — harmless today only because that value happens to already be public or client-local, not because the display itself is owner-gated. [`Masterboard.vue`](../src/ui/components/game/masterboard/Masterboard.vue)'s `enterStack`/`leaveStack` fire on hovering any stack in `sortedStacks`, attacker's or defender's alike. [`StackPanel.vue`](../src/ui/components/ui/game/StackPanel.vue) renders the hovered stack's full `creatures` unconditionally; the one owner check in the file now gates the entire split-guide and mustering-picker block, including the interactive `MusterChoices` component, not just cosmetic text. Hovering an opponent's unengaged Legion still shows its exact contents — the one place rules 4.5 and 9.1 still say that shouldn't happen outside an Engagement.

Battle state (`Battle.creatures`, `BattleSide.creatures`, both in [`battle/engine.ts`](../src/game/models/battle/engine.ts)) is exposed unconditionally too, but that isn't a gap: rule 9.1 makes Battle state fully public once `activeBattle` exists.

## 3. What a server-authoritative split implies

The server holds one canonical `TitanGame` and sends each client a per-player view built from it, redacted per viewer and, for engaged stacks, per Engagement stage.

Given section 2, the redaction surface is down to one field: `Stack.creatures`, for any Legion not owned by the viewer and not currently engaged with them — the same `hex`/`owner` comparison `getEngagedStacks` already does. Everything else on `TitanGame` — `players`, `score`, `creaturePool`, `round`, `activePhase`, `activeRoll`, and every stack's `owner`/`hex`/`marker`/`id`/`latestMuster`/`recruits` — is public per section 1 and needs no filtering. `Battle` needs none either, once it exists.

A `redactStackFor(stack, viewerPlayerId, game): PublicStack` that passes everything through except `creatures` (replaced with nothing, or `creatures.length` to keep matching what `MasterboardStack.vue` already renders) is the whole redaction function; `redactGameFor` just maps it across `game.stacks`. With a single field to strip, this is simpler than restructuring `Stack` into a public/private split — that alternative would touch every read site (`Masterboard.vue`, `MasterboardStack.vue`, `StackPanel.vue`, `TitanGame`'s free functions, `toBattleSide`) for no remaining gain, now that `split` and the pending muster have already moved off `Stack` on their own.

## 4. Sequencing

This audit is a companion to doc 05, not a replacement — it fills in slice 4 without changing doc 05's sequencing for slices 1–3.

It isn't actionable yet: redaction needs the `GameServer` interface doc 05's slice 3 describes (submit action / receive state) to attach to. `redactStackFor`/`redactGameFor` belong in that interface's "receive state" half, starting as a full-passthrough no-op for the in-memory local implementation until a second, real client exists to redact for.

Before that implementation happens, the open rules question in section 1 — how much of a losing Legion's composition reaches uninvolved third parties on flee, concession, or agreement — needs a deliberate answer, not a default picked by whichever implementation lands first.
