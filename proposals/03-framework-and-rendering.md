# Framework & Rendering

The boards are SVG built from Vue templates: every hex, stack, creature, and icon is a component, with transforms computed per-component from Vuex getters. Constraint from the project owner: game functionality and the in-game UI should stay largely the same.

## Baseline: upgrade Vue itself (do this regardless)

Vue resolves to 3.2.45; current stable is 3.5.x, with 3.6 at RC (July 2026). 3.4–3.5 brought a rewritten reactivity system with substantially less overhead and better memory behavior — free wins for exactly the "heavy dynamic SVG" workload suspected to be slow.

- **Pros:** no code changes required; prerequisite for everything below.
- **Cons:** none.

## Measure before choosing a rendering strategy

The inefficiency is suspected, not measured. Profile first (Vue devtools flamegraph, `performance` marks around drag/muster/battle interactions, forced re-render counts). Likely cheap wins visible in the code today, in rough order of effort:

1. Options-API `mapGetters` over the reflection-built store (doc 04) makes many getters non-cacheable — the store refactor is probably the single biggest performance lever.
2. Per-component transform objects rebuilt on every dependency touch; memoize or precompute static hex geometry (the masterboard layout never changes).
3. `v-memo` / `shallowRef` for lists of hexes and stacks.

- **Pro:** may make the framework question moot.
- **Con:** delays the fun rewrite.

## Option A — stay Vue, migrate to `<script setup>` Composition API (decided: do regardless)

All components use Options API with `mapState`/`mapGetters`. Migrating to `<script setup>` is mechanical, doesn't change markup, and is the current mainstream Vue API.

What it buys on its own: better TS inference (props are currently typed via runtime constructors), smaller compiled output, and eligibility for Vapor (Option B) — Vapor requires Composition API. What it does **not** buy: runtime performance. Computed caching works the same in both APIs, and the non-cacheable getters come from the Vuex reflection bridge, which survives an API migration untouched. The performance items above land with the store refactor (doc 04), not with this one — which is why doing the two together per component is the efficient path.

- **Pros:** as above; pairs naturally with Pinia (doc 04); no visual change.
- **Cons:** touches every component; no immediate user-visible payoff.

## Option B — Vue 3.6 Vapor mode for the board components

Vapor (stable in the 3.6 line, RC as of July 2026) compiles opted-in components to direct DOM updates with no virtual DOM — the same architectural bet as Svelte/Solid, without leaving Vue. It can be adopted per-component, so the SVG board tree could go Vapor while Vuetify chrome stays on the vDOM.

- **Pros:** targets precisely this workload (large dynamic trees, frequent small updates); incremental adoption; no ecosystem switch.
- **Cons:** requires Composition API migration first; 3.6 is RC — wait for stable; newest-code risk; Vuetify components can't be Vapor, so the app runs mixed-mode.

## Option C — rewrite the frontend in Svelte 5

Svelte 5 (runes) is mature and its compiled fine-grained reactivity is a genuinely good fit for SVG boards. But it is a full rewrite: every component, the store layer, and the UI chrome (no Vuetify; nearest equivalents are skeleton-level or Tailwind-based kits).

- **Pros:** likely the fastest-possible-baseline of the framework options; smaller bundles; pleasant authoring.
- **Cons:** weeks of rewrite for a game whose logic layer (plain TS) wouldn't benefit at all; loses Vuetify and its migration path; Vapor mode delivers most of the same performance story within Vue. Hard to justify unless there's independent appetite to leave Vue.

## Option D — canvas/WebGL board renderer (PixiJS 8)

Replace the SVG board with a canvas scene graph, keeping Vue for chrome and panels.

- **Pros:** highest performance ceiling; animations and effects (drag, strikes, dice) get much easier to make smooth.
- **Cons:** biggest architectural change; loses free SVG affordances (CSS styling, DOM events per element, crisp zoom, accessibility/inspectability); the existing creature/hazard art is SVG and would need a texture pipeline. Board size here (~100 hexes, dozens of stacks) is far below where SVG typically breaks down — likely overkill.

## Recommendation

A → measure → B if numbers still disappoint. C and D only if a rewrite is independently desired; the board's element count is modest and the suspected slowness more plausibly lives in the store/reactivity wiring than in SVG itself.
