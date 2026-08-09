# Multiplayer Architecture

Not a proposal to build multiplayer now — a proposal for which modernization choices keep it cheap later. Framework versions verified against npm, July 2026.

## Groundwork worth doing now

A model-layer audit (August 2026) found the engine closer to extractable than this doc first assumed: production code under `src/game` imports nothing from Vue, Pinia, or the stores, and its only browser dependencies are the persistence path's three `localStorage`/`window.CompressionStream` touches. The groundwork decomposes into three slices, in dependency order, each shippable on its own — no big bang required.

1. **Move persistence out of the engine.** Every `do*` action ends with `await this.persist()` (four in `game.ts`, seven in `game/battle.ts`), which writes `localStorage` from `game/persistence.ts` and reaches `window.CompressionStream`/`DecompressionStream` through `utils/base64` — the model layer's only browser dependencies. Snapshot persistence is slated for replacement by an action log anyway (doc 04), so it doesn't belong in the rules layer: move it to the store, which persists after each action and owns the localStorage read at startup, and drop the `persist()` tails and the `base64` import from `src/game`. Smallest slice; after it the engine has zero browser dependencies.
2. **Actions as data, through a single dispatch.** Every state change flows through a serializable action (`{type, payload}`) with a pure/deterministic reducer. This is the same refactor doc 04 recommends, and it *is* the network protocol: local play dispatches to a local reducer, networked play sends the same actions to a server.

   Today's payloads carry live class instances instead of data: `MovePayload`/`MusterPayload` hold a `Stack`, the battle payloads hold `BattleCreature`s, and the handlers mutate the payload object itself after checking membership by lodash-`matches` structural equality — which only works because the payload *is* the reactive proxy of the battle's own creature. The ids to reference instead already exist (`Stack.id`, `BattleCreature.id`), but nothing yet looks entities up by id. Define the action union with id/hex payloads and one `dispatch(game, action)` that resolves ids and applies the change; the existing `do*` methods are nearly a 1:1 inventory of the action types, and the Vuex-era `m*`/`do*` pairs (each battle `m*` has exactly one production caller, its own `do*` wrapper) collapse into the handlers. This slice works against the current class model — doc 04's per-class plain-data conversion trails it rather than gating it.

   The audit found three holes in the current action surface; each is a live bug today, and each closes as part of this slice:
   - `togglePendingSplit` is called directly from `StackPanel.vue`, mutating game state with no action and no persist, so pending-split toggles don't survive a reload until the next `doNextPhase` persists.
   - `doNextPhase` fire-and-forgets `doInitiateBattle` when advancing out of MOVE with an engagement, so two `persist()` calls race; the stored snapshot ends up correct only because the mutations are synchronous and the fully-advanced write lands last in program order. Under a dispatch model, initiating the pending battle becomes part of the phase-advance handler's single reduction, not a nested dispatch.
   - The `Stack`/`BattleCreature` id counters are module globals; rehydration constructs fresh instances (incrementing the counters) and then assigns the persisted ids over them, so a restored save whose ids outrun the fresh counters can collide with ids allocated afterwards (`Stack.id` is a `v-for` key). Id allocation moves into state, or becomes deterministic from the log.

   Separately, `activeBattle` is never cleared after a battle resolves — battle-conclusion logic doesn't exist yet. That is the known, parked end-of-battle work, not a new gap; under the dispatch model it arrives as one more handler.
3. **Extract game logic into a package** (decided: do ASAP — slices 1 and 2 are its real prerequisites). Move `src/game` (plus the dispatcher) into a workspace package with no Vue/DOM imports, so a Node server imports the identical rules. A pnpm workspace (`packages/engine`, `packages/client`) is the standard shape.

   Shape the boundary as a client↔server protocol from day one: the UI talks only to a `GameServer` interface (submit action, receive state/events), with two implementations of the same interface — an in-memory one running the engine in the browser for local play, and later a WebSocket one for remote play. Local play is then permanently a one-line transport swap away from multiplayer, and the interface stops UI code from ever reaching into engine internals. The extra cost over a plain extraction is small: the interface is async from the start (local play just resolves immediately) and hot-seat play routes through it like any client.

   The realistic size of this boundary is dominated by the read side, not the dozen write actions: battle components call `Battle` methods directly (`getTargetedStrike`, `getRangestrike`, `getBoard`, `getOffense`/`getDefense`) and the turn/stack/masterboard components read engine fields raw, and each such call site becomes protocol surface. The read side can migrate gradually behind the interface; it doesn't gate the extraction.
4. **Hidden information audit** (needed, but deferrable — not hard to add once the protocol boundary above exists). Stack contents in Titan-style play are hidden from opponents. A client that holds full game state cannot enforce that. Flag which state is per-player-visible so the eventual server can send filtered views.

**Deterministic randomness is already mostly in place.** `src/game` contains no `Math.random`: strikes take `rolls: number[]` payloads, the masterboard roll enters via `doSetRoll`, and the one in-engine random need (the starting color shuffle) goes through an injected `Random` seam with deterministic test doubles. What remains is authority-side — whoever is authoritative seeds the rolls and the action log records them — a slice-2/persistence concern, not an engine refactor. (The 3D dice-box animation can still render whatever result the log dictates.)

Each of these improves the single-player codebase on its own (testability, undo/replay, faster typechecking of a Vue-free package), so none is speculative work wasted if multiplayer slips.

## Server model options (for when the time comes)

**Authoritative server, thin clients (decided: the long-term approach).** Server owns state, validates actions, rolls dice, broadcasts filtered views/actions. The only model that handles hidden information and cheating honestly. Turn-based games need no tick loop — a request/response + broadcast pattern over WebSockets is enough.

**Lockstep peer-relay.** Server just relays actions; every client simulates. Minimal server code, but hidden info is impossible and any client desync is unrecoverable. Not a fit for Titan-style stacks.

## Hosting/framework options

- **Plain Node + WebSocket (`ws` or socket.io 4.x), custom rooms.** Most control, most code; the engine package does the heavy lifting anyway. Turn-based scope keeps this genuinely small.
- **Colyseus (0.17, actively maintained).** Rooms, state sync with delta patching, per-client filtered views out of the box — the filtered-view feature maps directly onto the hidden-stack requirement. Con: its schema-class state model would compete with the engine's own state shape; adopting it half-way yields the worst of both.
- **boardgame.io.** Conceptually a perfect match (turn orders, phases, secret state, log/replay) but effectively unmaintained — last release 2022. Study its design; don't adopt it.
- **Cloudflare Durable Objects / PartyKit.** One durable object per game room, WebSocket hibernation, no servers to run; pairs with Cloudflare Pages hosting (doc 02). Con: vendor lock-in and a less conventional dev/test loop; PartyKit itself has slowed since the Cloudflare acquisition, so prefer raw Durable Objects if going this route.
- **Supabase/Firebase realtime-database style.** Fastest to first demo, but authoritative rules enforcement ends up in edge functions anyway, and hidden info via row-level security gets contorted. Better for lobby/matchmaking/persistence than for the game protocol itself.

## Persistence & identity (deferrable)

Games as action logs in any SQL store (SQLite/Postgres/D1) — append-only, replayable. Auth can start as magic links or OAuth via the host platform; nothing in the groundwork above constrains this choice.
