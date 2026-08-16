# Modernization Proposals

Written July 2026. The last feature commit landed January 2023 and the last dependency bump July 2023, so essentially every layer of the toolchain is two or more major versions behind. Each document in this folder covers one category, lists concrete proposals, and notes trade-offs and alternatives. Version claims were checked against npm, the Node.js release schedule, and upstream release pages in July 2026.

## Current state, briefly

- Vue 3.2.45 (transitive only — `vue` is not even a direct dependency), Options API components
- Pinia for state management, wrapping plain-interface-plus-free-function TypeScript models
- Vuetify 4.1, Vite 8.1, TypeScript 6.0, ESLint 10 with flat config, pnpm
- Vestigial Nuxt 3 RC and Vue CLI dependencies that are not part of the actual build
- CI runs lint, typecheck, test, and build on every PR on Node 24, then deploys to Cloudflare Workers (custom domain, opt-in per-PR preview URLs)
- No tests of any kind
- Rendering is SVG generated from Vue templates; game state persists to localStorage as JSON

## Documents

| Doc | Category |
|---|---|
| [01-toolchain-and-dependencies.md](01-toolchain-and-dependencies.md) | Node, package manager, build tool, TypeScript, linting, dead dependencies |
| [03-framework-and-rendering.md](03-framework-and-rendering.md) | Vue vs. Svelte, SVG vs. canvas, rendering performance |
| [04-state-management.md](04-state-management.md) | Vuex → Pinia, decoupling game logic from the store |
| [05-multiplayer-architecture.md](05-multiplayer-architecture.md) | Preparing for server-mediated multiplayer |
| [07-testing-and-code-quality.md](07-testing-and-code-quality.md) | Test infrastructure, type strictness, cleanup |
| [08-bundle-size.md](08-bundle-size.md) | Production bundle size: dice-box chunking, lazy-loading, Vuetify/icon tree-shaking |

## Suggested sequencing

1. **Toolchain** (doc 01): everything else is easier on current Vite/TS/ESLint, and none of it changes app behavior.
2. **Mechanical model split + tests around game logic** (doc 07): the models are pure TypeScript and testable today; do this before refactoring them.
3. **State management** (doc 04): the Vuex-reflection layer is the biggest structural obstacle to both performance work and multiplayer.
4. **Multiplayer groundwork** (doc 05): engine extraction behind a local-server interface while touching the store anyway.
5. **Rendering** (doc 03): measure once the store refactor has landed, then decide on Vapor/canvas.

Doc 01 (toolchain) is fully done: pnpm updated to 11.22.0. Doc 02 (CI and deployment) is fully landed; the doc has been removed. Doc 04 (state management) is done: `Stack`, `BattleCreature`, `ActiveStrike`, `Battle`, and `TitanGame` are all plain interfaces plus free functions now, with no classes left in the model layer. Doc 05 (multiplayer groundwork) is partially landed: persistence has moved out of the engine and the old `do*`/`m*` method split has collapsed, but the action-union/single-dispatch entry point, the workspace-package extraction, and the hidden-information audit are still pending. Doc 06 (UI chrome) is fully landed; the doc has been removed. Doc 08 (bundle size) is resolved except one open item: a Vite/Rolldown chunk-duplication bug in dice-box's `world.offscreen.js` build output, non-urgent since lazy-loading already keeps that chunk off the critical path.
