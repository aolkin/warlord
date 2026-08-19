# Framework & Rendering

The boards are SVG built from Vue templates: every hex, stack, creature, and icon is a component, with transforms computed per-component. Constraint from the project owner: game functionality and the in-game UI should stay largely the same.

(Originally written when transforms were computed from Vuex getters — doc 04's store refactor and the `<script setup>` migration below have both since landed; see each section's status.)

## Baseline: upgrade Vue itself (done)

Vue is pinned as a direct dependency at 3.5.41, the current stable release (3.6 remains RC). 3.4–3.5 brought a rewritten reactivity system with substantially less overhead and better memory behavior — free wins for exactly the "heavy dynamic SVG" workload suspected to be slow.

## Measure before choosing a rendering strategy (done — see doc 11)

[Doc 11](11-rendering-performance-findings.md) profiled this after doc 04 landed. Summary: doc 04's store refactor already eliminated the concern below (confirmed by grep, not just inferred); a real but small O(stack-count) recompute cost exists in `MasterboardStack.vue`'s hex-occupancy check, not in the static geometry math as originally suspected; and a measured move interaction lands within about one display frame (~16ms, click to painted update) on an unoptimized dev build. Doc 11's recommendation: the numbers don't justify Vapor, Svelte, or canvas — stop here.

The three items originally listed here, for reference (see doc 11 for what measurement found for each):

1. ~~Options-API `mapGetters` over the reflection-built store (doc 04) makes many getters non-cacheable — the store refactor is probably the single biggest performance lever.~~ Confirmed resolved: doc 04 removed the Vuex reflection bridge entirely, and no component uses `mapGetters`/`mapState`.
2. Per-component transform objects rebuilt on every dependency touch; memoize or precompute static hex geometry (the masterboard layout never changes).
3. `v-memo` / `shallowRef` for lists of hexes and stacks.

## Option A — stay Vue, migrate to `<script setup>` Composition API (done)

Every `.vue` component now uses `<script setup>` — no Options API, no `mapState`/`mapGetters` (`grep -rL "<script setup" src --include="*.vue"` and `grep -r "mapGetters\|mapState" src/` both return nothing).

What this bought on its own: better TS inference (props are typed via `defineProps<T>()` instead of runtime constructors), smaller compiled output, and eligibility for Vapor (Option B), which requires Composition API. It did not, by itself, buy runtime performance — that came from doc 04's store refactor landing alongside it. See [doc 11](11-rendering-performance-findings.md) for the measurement.

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

A → measure → B if numbers still disappoint. [Doc 11](11-rendering-performance-findings.md) is that measurement, and the numbers don't disappoint — stop here. C and D remain options only if a rewrite is independently desired, not for performance: the board's element count is modest, and doc 11 found the store/reactivity wiring cheap in absolute terms even before any optimization.
