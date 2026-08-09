# State Management

Today: Vuex 4, with the `game` module generated at runtime by reflecting over `TitanGame.prototype` method names — `get*` become getters, `m*` mutations, `do*` actions — and the store state *is* a `TitanGame` class instance (likewise `Battle`), persisted to localStorage by JSON-stringifying the instance and rehydrated through class-specific `hydrate` methods.

## Vuex → Pinia

Vuex is in maintenance mode (last release 2022); Pinia (4.x) is Vue's official successor. The `ui/*` modules are small and port mechanically.

- **Pros:** first-class TS inference (the reflection layer currently erases all types — everything is `any` at the store boundary); devtools support; no `commit("string")` indirection; composes with `<script setup>`.
- **Cons:** touches every component's store access. It does not have to be a big bang, though: Pinia and Vuex run side by side, so this can go store-by-store (`ui/*` first, `game` last) and component-by-component, converting each component to `<script setup>` + Pinia in the same small PR.

## Retire the reflection bridge

The prefix-reflection wiring defeats TypeScript, hides the store's real API surface, and makes getter caching and devtools tracing opaque. No standalone project needed, though: the state/rules separation below (the more important refactor) removes its reason to exist — once rules are explicit functions, the store defines explicit typed getters/actions that call them, and the bridge falls away as a byproduct.

## Separate game state from game rules

`TitanGame` mixes serializable state (players, stacks, round) with rules logic (pathfinding, mustering, battle resolution) in one class graph, and reactive proxies wrap the class instances. Two workable shapes:

- **Plain-data state + pure functions:** state is a serializable object tree; rules are functions `(state, action) → new state` (or mutating, with Pinia). Vue's reactivity works on plain objects without proxy-vs-class pitfalls, the rules run identically on a server (doc 05), and the per-class `hydrate` methods go away — a minor bonus rather than a driver, since today's serialization only serves local persistence and debugging.
- **Keep classes, add explicit serialization schema:** smaller change, but keeps the hydrate-method maintenance and keeps class instances inside reactive proxies (a recurring source of subtle bugs — e.g. identity comparisons like `stack === selectedStack` already depend on proxy behavior).

The plain-data shape is strongly preferred given multiplayer plans; it is the standard prerequisite for authoritative-server and action-log designs.

A model-layer audit (August 2026) resized this refactor downward: it is no longer the largest in this folder. The state tree is already effectively serializable plain data — every stateful field on `TitanGame`, `Player`, `Stack`, `Battle`, `BattleCreature`, and `ActiveStrike` is a number, enum, boolean, array, or `Record`; entities reference board positions by hex number, never by object; and the masterboard, battle boards, creature stats, and muster tables are static module data outside the state graph. (`JSON.stringify` of a game works today for exactly this reason.) The conversion is "detach the methods," not "re-model the state." With the battle module since split into one-concern files and substantive model tests in place, doc 07's tests-first precondition is met. It also does not gate doc 05: the action/dispatch refactor there works against the current class model, and this conversion trails it, one class per PR:

1. `Player` and `Stack` (thin);
2. `BattleCreature` and `ActiveStrike`;
3. `Battle` and `TitanGame`.

Each step converts one class to an interface plus free functions and deletes its hydrate glue. The only production `instanceof` on a state class is `hex instanceof MasterboardHex` in `doMove`, and `MasterboardHex` is static board data rather than state, so nothing structurally resists the conversion.

**Is `Battle` nested inside `TitanGame` the problem?** No — an aggregate root holding a child entity is an ordinary shape, and the audit traced the discomfort to two other causes. First, the merged method surface: `TitanGame` after its `Object.assign` prototype mixins (`game.ts` + `game/battle.ts` + `game/persistence.ts`) is ~520 lines and 42 methods across three files, the largest class in the model layer — but that is the Vuex-era `get*`/`m*`/`do*` convention, not the nesting; the persistence mixin's three methods contribute the same bloat and have nothing to do with `Battle`. Second, reactive-proxy nesting friction: `BattleCreature` sits two proxy levels deep (`TitanGame` → `activeBattle` → `creatures[]`), so the battle mutators check payload membership with lodash `matches` instead of `===`, and Vue's `UnwrapNestedRefs` cannot reconstruct class-private members, forcing casts back to the class type (`BattleBoard.vue`, the selection store).

Both causes are what the plain-data conversion removes, so extracting `Battle` into a sibling state tree is not worth doing as its own near-term slice: the friction lives in having class instances inside reactive proxies at all, and structural surgery on them hits that friction head-on. Once state is plain data, "field on `TitanGame` or sibling tree" becomes a nearly-free choice either way.

## Replace localStorage snapshot persistence with an action log (not urgent)

Persisting a snapshot works for solo play but discards history. If actions become explicit data (doc 05), persistence becomes "store the action log, replay to restore" — which also gives undo and post-game review nearly for free. Independent of the log itself, doc 05's first groundwork slice moves today's snapshot persistence out of the rules layer into the store; the log later replaces that store-side persistence.

- **Pros:** aligns local persistence with the future network protocol; undo/replay.
- **Cons:** replay requires deterministic rules (dice seeds recorded in the log); schema versioning of actions across rule changes needs a story (a version stamp and "discard old saves" is acceptable at this stage).

## Miscellaneous cleanup

- The global `Object.prototype.guid` extension (main.ts) hands every object a lazily-assigned random-seeded counter id. It arrived in c4b8759 (Feb 2022, "Start work on adding support for mustering"), and its only consumers are three `v-for` `:key` bindings on creatures/stacks — i.e. it exists to give class instances stable list keys. Replace with an explicit id field on those model types. Prototype extension is invisible at use sites and hostile to any future serialization/structured-clone path.
- `app.config.unwrapInjectedRef` was a transitional flag (default since Vue 3.3); delete with the Vue upgrade.
