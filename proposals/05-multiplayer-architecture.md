# Multiplayer Architecture

Not a proposal to build multiplayer now — a proposal for which modernization choices keep it cheap later. Framework versions verified against npm, July 2026.

## Groundwork worth doing now

Production code under `src/game` imports nothing from Vue, Pinia, or the stores, and — since the persistence move below — has zero browser dependencies at all. The groundwork decomposes into slices, in dependency order, each shippable on its own.

1. **Move persistence out of the engine — done.** `src/game` no longer touches `localStorage` or `window.CompressionStream`/`DecompressionStream`; `TitanGame.hydrate(persisted?: string)` takes the persisted JSON string as a parameter instead of reading storage itself, and `game/persistence.ts` is gone. Persistence is now a single deep `watch(game, ...)` in `src/ui/stores/game.ts` that writes `JSON.stringify(game)` to `localStorage` — it coalesces every mutation within one action into one write, and doesn't fire on initial hydration or mid-action. The old `persist()` return value (the compressed/encoded save string) lives on separately, as `SystemMenu.vue`'s `persistToClipboard`.

   One behavior change: writes now land on a later microtask instead of synchronously at the end of an action, so `await gameStore.someAction()` no longer guarantees the write has already happened. Nothing currently depends on that ordering.

   This slice also thinned every action to a single free function: with no `persist()` call left to strip and no reactive-proxy `this` to close over, the old `do*` (assert + persist) / `m*` (mutate) split had nothing left to justify it (slice 2).

2. **Actions as data, through a single dispatch — payloads converted, dispatch itself not yet built.** Every state change should flow through a serializable action (`{type, payload}`) with a pure/deterministic reducer — the same refactor doc 04 recommends, and it *is* the network protocol: local play dispatches to a local reducer, networked play sends the same actions to a server.

   **Payloads carry ids, not live instances — done.** `MovePayload`/`MusterPayload` hold a `StackRef`/`MusterChoice`, and the battle payloads hold a `BattleCreature["id"]`; each handler resolves the id itself rather than receiving a live reactive-proxy reference.

   **The `do*`/`m*` split has collapsed into single free functions — done, with one exception.** Every action is now one function (`TitanGame.finalizeSplits`, `.takeMulligan`, `.finalizeMoves`, `.finalizeMusters`, `.initiateBattle`; `Battle.finalizeMoves`, `.attackCreature`, `.rangestrikeCreature`, `.assignCarryover`, `.skipCarryover`) — no `do*`/`m*` name remains anywhere in the model layer. The exception is `nextPhase(battle)`, which stays separate because it's genuinely reused: called recursively from within `engine.ts` (auto-skipping empty battle phases) as well as invoked as the phase-advance handler.

   **What's still missing is the single dispatch entry point itself.** There is no `dispatch(game, action)` function and no serializable action union. UI components call the free functions above directly, one per button handler across `TurnPanel.vue`, `ActionPanel.vue`, and the battle components. Defining the action union and one `dispatch` that resolves ids and applies the change is the remaining work; the existing exported functions are nearly a 1:1 inventory of the action types.

   Every action's validation `assert`/`throw` survived the collapse, and not all of it is equally load-bearing today. Some checks guard against a state corruption an achievable UI click sequence can actually trigger right now — e.g. `finalizeMusters`'s pool-exhaustion check, since the muster UI never consults the global pool on its own, and `Battle.finalizeMoves`/`attackCreature`/`rangestrikeCreature`'s phase checks, since movement/rangestrike targeting is pure geometry with no phase gate and the UI's "interactive" highlighting isn't backed by any click-blocking. Others are defensive only, currently unreachable given today's UI call graph (most phase/state checks, since the UI already gates the button correctly) and could be dropped as dead code by that standard alone.

   Neither category should actually vanish once dispatch exists, though: a server can't trust a network-delivered action any more than today's UI can be trusted to gate correctly, and most "unreachable" checks guard actions a network client could send directly even with no current UI path to them. None of the checks depend on class-instance `this` — they already run against an explicit `(state, payload)` pair — so nothing about them needs to change when `dispatch` is added. Throwing (a custom `Error` subclass with a `.reason` field, not yet built, caught once at the dispatch boundary) rather than returning a `Result` is the right shape specifically because a single dispatch boundary exists to catch it: a nested check several layers deep can just throw and let it propagate, where a `Result` would need `if (!result.accepted) return result` chained at every call site.

   Two gaps in the action surface closed as side effects of slice 1: `togglePendingSplit`, which used to mutate `game` with no action wrapper, has since been replaced entirely by `useStackSplitsStore.toggle` (doc 09), which doesn't touch `game` at all; and `nextPhase`'s old synchronous call into `initiateBattle` when advancing out of MOVE is gone too — `finalizeMoves` no longer calls `initiateBattle` at all (#256), landing in BATTLE with no battle open and letting the player start each engagement themselves.

   One gap remains open: the `Stack`/`BattleCreature` id counters (`stackIdCounter`, `battleCreatureIdCounter`) are still module globals. `TitanGame.hydrate` allocates fresh ids from those counters via `TitanGame.create(2)` before merging persisted state on top, so a restored save whose ids outrun the fresh counters can still collide with ids allocated afterwards. Id allocation needs to move into state, or become deterministic from the log.

   Separately, `activeBattle` is never cleared after a battle resolves — end-of-battle resolution (scoring, stack elimination, clearing `activeBattle`) is known-incomplete, deliberately parked work (doc 04) that arrives as one more dispatch handler once resumed.
3. **Extract game logic into a package (decided: do ASAP — slices 1 and 2 are its real prerequisites).** Slice 1 is done; slice 2's dispatch entry point isn't, so this hasn't started — no workspace package exists yet (`pnpm-workspace.yaml` only configures native-module allow-listing). Move `src/game` (plus the dispatcher, once built) into a workspace package with no Vue/DOM imports, so a Node server imports the identical rules — a pnpm workspace (`packages/engine`, `packages/client`) is the standard shape.

   Shape the boundary as a client↔server protocol from day one: the UI talks only to a `GameServer` interface (submit action, receive state/events), with two implementations — an in-memory one running the engine in the browser for local play, and later a WebSocket one for remote play. Local play is then a one-line transport swap away from multiplayer, and the interface stops UI code from reaching into engine internals. The extra cost is small: the interface is async from the start (local play just resolves immediately), and hot-seat play routes through it like any client.

   The read side dominates this boundary's real size, not the dozen write actions — battle and masterboard components call model-layer functions and read state fields directly today, and every such call site becomes protocol surface. It can migrate gradually behind the interface and doesn't gate the extraction.
4. **Hidden information audit (needed, but deferrable).** Stack contents in Titan-style play are hidden from opponents; a client holding full game state can't enforce that. Flag which state is per-player-visible so the eventual server can send filtered views. Not started — no state field or component currently distinguishes public from owner-only information.

**Deterministic randomness is already mostly in place.** `src/game` contains no `Math.random` — strikes take `rolls: number[]` payloads, and both the masterboard roll and the starting color shuffle go through an injected `Random` seam with deterministic test doubles. What remains is authority-side (whoever is authoritative seeds the rolls and the log records them) — a slice-2/persistence concern, not an engine refactor.

Each of these slices improves the single-player codebase on its own (testability, undo/replay, faster typechecking of a Vue-free package), so none is wasted work if multiplayer slips.

## Server model options (for when the time comes)

**Authoritative server, thin clients (decided: the long-term approach).** Server owns state, validates actions, rolls dice, broadcasts filtered views/actions — the only model that handles hidden information and cheating honestly. Turn-based play needs no tick loop, just request/response plus broadcast over WebSockets.

**Lockstep peer-relay.** Server just relays actions; every client simulates. Minimal server code, but hidden info is impossible and any client desync is unrecoverable — not a fit for Titan-style stacks.

## Hosting/framework options

- **Plain Node + WebSocket (`ws` or socket.io 4.x), custom rooms.** Most control, most code; the engine package does the heavy lifting anyway, and turn-based scope keeps this genuinely small.
- **Colyseus (0.17, actively maintained).** Rooms, delta-patched state sync, per-client filtered views out of the box — maps directly onto the hidden-stack requirement. Its schema-class state model would compete with the engine's own state shape, so adopting it half-way is worse than either extreme.
- **boardgame.io.** Conceptually a perfect match (turn orders, phases, secret state, log/replay) but effectively unmaintained since 2022 — study its design, don't adopt it.
- **Cloudflare Durable Objects / PartyKit.** One durable object per game room, WebSocket hibernation, no servers to run; pairs with Cloudflare Pages hosting (doc 02). Vendor lock-in and a less conventional dev/test loop; PartyKit itself has slowed since the Cloudflare acquisition, so prefer raw Durable Objects if going this route.
- **Supabase/Firebase realtime-database style.** Fastest to a demo, but authoritative rules enforcement ends up in edge functions anyway, and hidden info via row-level security gets contorted. Better for lobby/matchmaking/persistence than for the game protocol itself.

## Persistence & identity (deferrable)

Games as action logs in any SQL store (SQLite/Postgres/D1) — append-only, replayable. Auth can start as magic links or OAuth via the host platform; nothing above constrains this choice.
