# Multiplayer Architecture

Not a proposal to build multiplayer now — a proposal for which modernization choices keep it cheap later. Framework versions verified against npm, July 2026.

## Groundwork worth doing now

1. **Actions as data.** Every state change flows through a serializable action (`{type, payload}`) with a pure/deterministic reducer. This is the same refactor doc 04 recommends, and it *is* the network protocol: local play dispatches to a local reducer, networked play sends the same actions to a server.
2. **Deterministic randomness.** Dice rolls must come from a seeded RNG owned by whoever is authoritative, recorded in the action log — not `Math.random()` at point of use. (The 3D dice-box animation can still render whatever result the log dictates.)
3. **Extract game logic into a package** (decided: do ASAP). Move `src/models` (plus the reducer) into a workspace package with no Vue/DOM imports, so a Node server imports the identical rules. A pnpm workspace (`packages/engine`, `packages/client`) is the standard shape.

   Shape the boundary as a client↔server protocol from day one: the UI talks only to a `GameServer` interface (submit action, receive state/events), with two implementations of the same interface — an in-memory one running the engine in the browser for local play, and later a WebSocket one for remote play. Local play is then permanently a one-line transport swap away from multiplayer, and the interface stops UI code from ever reaching into engine internals. The extra cost over a plain extraction is small: the interface is async from the start (local play just resolves immediately) and hot-seat play routes through it like any client.
4. **Hidden information audit** (needed, but deferrable — not hard to add once the protocol boundary above exists). Stack contents in Titan-style play are hidden from opponents. A client that holds full game state cannot enforce that. Flag which state is per-player-visible so the eventual server can send filtered views.

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
