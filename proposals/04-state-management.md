# State Management

Today: Vuex 4, with the `game` module generated at runtime by reflecting over `TitanGame.prototype` method names — `get*` become getters, `m*` mutations, `do*` actions — and the store state *is* a `TitanGame` class instance (likewise `Battle`), persisted to localStorage by JSON-stringifying the instance and rehydrated through class-specific `hydrate` methods.

## Vuex → Pinia

Vuex is in maintenance mode (last release 2022); Pinia (4.x) is Vue's official successor. The `ui/*` modules are small and port mechanically.

- **Pros:** first-class TS inference (the reflection layer currently erases all types — everything is `any` at the store boundary); devtools support; no `commit("string")` indirection; composes with `<script setup>`.
- **Cons:** touches every component's store access; worth doing together with the Composition API migration (doc 03) rather than as separate passes.

## Retire the reflection bridge

Whatever the store library, the prefix-reflection wiring deserves replacement with explicit store definitions that call into the game model. It defeats TypeScript, hides the store's real API surface, and makes getter caching and devtools tracing opaque.

- **Pros:** typed, greppable, debuggable store; enables the getter-caching wins doc 03 counts on.
- **Cons:** it's clever and compact; the replacement is more lines. The lines are worth it.

## Separate game state from game rules

`TitanGame` mixes serializable state (players, stacks, round) with rules logic (pathfinding, mustering, battle resolution) in one class graph, and reactive proxies wrap the class instances. Two workable shapes:

- **Plain-data state + pure functions:** state is a serializable object tree; rules are functions `(state, action) → new state` (or mutating, with Pinia). Serialization becomes `JSON.stringify` with no per-class `hydrate` methods; Vue's reactivity works on plain objects without proxy-vs-class pitfalls; and the rules run identically on a server (doc 05).
- **Keep classes, add explicit serialization schema:** smaller change, but keeps the hydrate-method maintenance and keeps class instances inside reactive proxies (a recurring source of subtle bugs — e.g. identity comparisons like `stack === selectedStack` already depend on proxy behavior).

The plain-data shape is strongly preferred given multiplayer plans; it is the standard prerequisite for authoritative-server and action-log designs.

- **Cons:** the largest single refactor proposed in this folder; battle.ts alone is ~1000 lines. Tests first (doc 07).

## Replace localStorage snapshot persistence with an action log

Persisting a snapshot works for solo play but discards history. If actions become explicit data (doc 05), persistence becomes "store the action log, replay to restore" — which also gives undo and post-game review nearly for free.

- **Pros:** aligns local persistence with the future network protocol; undo/replay.
- **Cons:** replay requires deterministic rules (dice seeds recorded in the log); schema versioning of actions across rule changes needs a story (a version stamp and "discard old saves" is acceptable at this stage).

## Miscellaneous cleanup

- The global `Object.prototype.guid` extension (main.ts) hands every object a lazily-assigned random-seeded counter id. Replace with an explicit id field on the few model types that need identity, or a `WeakMap`. Prototype extension is invisible at use sites and hostile to any future serialization/structured-clone path.
- `app.config.unwrapInjectedRef` was a transitional flag (default since Vue 3.3); delete with the Vue upgrade.
