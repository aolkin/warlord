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

The state tree is already effectively serializable plain data — every stateful field on `TitanGame`, `Player`, `Stack`, `Battle`, `BattleCreature`, and `ActiveStrike` is a number, enum, boolean, array, or `Record`; entities reference board positions by hex number, never by object; and the masterboard, battle boards, creature stats, and muster tables are static module data outside the state graph. (`JSON.stringify` of a game works today for exactly this reason.) The conversion is "detach the methods," not "re-model the state." With the battle module since split into one-concern files and substantive model tests in place, doc 07's tests-first precondition is met. It also does not gate doc 05: the action/dispatch refactor there works against the current class model, and this conversion trails it, one class per PR:

1. `Player` and `Stack` (thin);
2. `BattleCreature` and `ActiveStrike`;
3. `Battle` and `TitanGame`.

Each step converts one class to an interface plus free functions and deletes its hydrate glue. The only production `instanceof` on a state class is `hex instanceof MasterboardHex` in `doMove`, and `MasterboardHex` is static board data rather than state, so nothing structurally resists the conversion.

**`Battle` nested inside `TitanGame` is not the problem.** An aggregate root holding a child entity is an ordinary shape; the discomfort traces to two other causes. First, the merged method surface: `TitanGame` after its `Object.assign` prototype mixins (`game.ts` + `game/battle.ts` + `game/persistence.ts`) is ~520 lines and 42 methods across three files, the largest class in the model layer — but that is the Vuex-era `get*`/`m*`/`do*` convention, not the nesting; the persistence mixin's three methods contribute the same bloat and have nothing to do with `Battle`. Second, reactive-proxy nesting friction: `BattleCreature` sits two proxy levels deep (`TitanGame` → `activeBattle` → `creatures[]`), so the battle mutators check payload membership with lodash `matches` instead of `===`, and Vue's `UnwrapNestedRefs` cannot reconstruct class-private members, forcing casts back to the class type (`BattleBoard.vue`, the selection store).

Both causes are what the plain-data conversion removes, so extracting `Battle` into a sibling state tree is not worth doing as its own near-term slice: the friction lives in having class instances inside reactive proxies at all, and structural surgery on them hits that friction head-on. Once state is plain data, "field on `TitanGame` or sibling tree" becomes a nearly-free choice either way.

**Storing a `PlayerId` and resolving it through `getPlayerById` everywhere is the right pattern — keep it.** `Stack.owner`, `BattleCreature.player`, and `Battle`'s `attacker`/`defender` all hold a `PlayerId`, and rendering anything player-flavored (name, color, score) resolves it through `getPlayerById`, a linear `find` over `this.players`. The lookup frequency reflects the domain — nearly everything on screen renders in its owner's color — not a design smell, and the scan cost is unmeasurable: the constructor caps the game at five players (colors, not `INITIAL_HEXES`, are the binding limit), and the UI call sites are `computed`s or per-render template bindings either way iterating a ≤5-element array. A `Map<PlayerId, Player>` or memoized `Record` would add indirection with no observable win at this scale. Call-site count isn't fully fixed by the domain, though: some resolves were passthrough ceremony from a child component's prop type demanding a `Player` rather than a `PlayerId`, and pushing the id prop down to the leaf and resolving only where needed cut `Creature.vue`'s call sites roughly in half (8 → 4).

The id reference is also load-bearing for everything else in this doc: snapshot persistence works precisely because entities carry ids rather than object references, and `mRehydrate` constructs fresh `Player` and `Stack` instances independently — a denormalized `Player` reference stored on `Stack` would sever on every restore and need explicit re-linking, recreating the object-identity fragility doc 05's actions-as-data slice exists to remove (that slice moves action *payloads* from live instances to ids; the entity fields are already there). One existing counterexample shows the alternative's cost: `BattleCreature.playerScore` is a *copy* of the owner's score taken at battle initiation, and like any copy it has implicit staleness semantics the id reference doesn't. Under the plain-data conversion above, `getPlayerById` simply becomes one of the free selector functions; nothing about the pattern changes.

**`Player`'s three fields belong in `TitanGame`, but for different reasons:**

- `score` is rules state and must stay. It feeds titan combat strength (`getStrength`: 6 + score/100, via the `playerScore` snapshot) and titan tower-teleport eligibility (`score >= 400` in `MasterboardStack.vue`'s roll-6 path). Nothing mutates it yet — `addPoints` has zero production callers, because end-of-battle scoring is the parked work doc 05 notes — but once scoring lands, score changes on battle resolution and must replay from the action log.
- `id` is the seat, and a game concept: the `PlayerId` enum doubles as the color, shuffle-assigned at game creation, keying marker art, theming (`bg-player-${id}`), and every entity's owner field.
- `name` is the one roster field: written once in the constructor (`Player ${i + 1}`), never read by rules, only displayed. Under doc 05's authoritative-server model, "who occupies seat X" — display name, account, connection — is session state the server tracks beside the game, resolved by the same `PlayerId`.

The eventual multiplayer refinement is that `Player` slims to seat-keyed rules state while `name` migrates to the roster — not that id lookups go away.

## Replace localStorage snapshot persistence with an action log (not urgent)

Persisting a snapshot works for solo play but discards history. If actions become explicit data (doc 05), persistence becomes "store the action log, replay to restore" — which also gives undo and post-game review nearly for free. Independent of the log itself, doc 05's first groundwork slice moves today's snapshot persistence out of the rules layer into the store; the log later replaces that store-side persistence.

- **Pros:** aligns local persistence with the future network protocol; undo/replay.
- **Cons:** replay requires deterministic rules (dice seeds recorded in the log); schema versioning of actions across rule changes needs a story (a version stamp and "discard old saves" is acceptable at this stage).

## Miscellaneous cleanup

- The global `Object.prototype.guid` extension (main.ts) hands every object a lazily-assigned random-seeded counter id. It arrived in c4b8759 (Feb 2022, "Start work on adding support for mustering"), and its only consumers are three `v-for` `:key` bindings on creatures/stacks — i.e. it exists to give class instances stable list keys. Replace with an explicit id field on those model types. Prototype extension is invisible at use sites and hostile to any future serialization/structured-clone path.
- `app.config.unwrapInjectedRef` was a transitional flag (default since Vue 3.3); delete with the Vue upgrade.
