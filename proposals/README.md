# Modernization Proposals

Written July 2026. The last feature commit landed January 2023, the last dependency bump July 2023 — every layer of the toolchain is two or more major versions behind. Each doc here covers one category: concrete proposals, trade-offs, alternatives. Version claims checked against npm, Node's release schedule, and upstream release pages in July 2026.

## Current state, briefly

- Vue 3.5.41 (a direct dependency), `<script setup>` components
- Pinia for state management, wrapping plain-interface-plus-free-function TypeScript models
- Vuetify 4.1, Vite 8.1, TypeScript 6.0, ESLint 10 with flat config, pnpm
- CI runs lint, typecheck, unit tests, and build on every PR on Node 24, then deploys to Cloudflare Workers (custom domain, opt-in per-PR preview URLs); e2e tests run in a separate workflow, opt-in per PR via the `e2e` label
- Vitest unit tests over the model layer, Playwright e2e tests over the masterboard and battle-board UI
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
| [09-mutation-classification.md](09-mutation-classification.md) | Which mutations a server must commit and order, and which stay on the client |
| [11-rendering-performance-findings.md](11-rendering-performance-findings.md) | Measured findings for doc 03's rendering performance question |

## Suggested sequencing

1. **Toolchain** (doc 01): everything else is easier on current Vite/TS/ESLint, and none of it changes app behavior.
2. **Mechanical model split + tests around game logic** (doc 07): the models are pure TypeScript and testable today; do this before refactoring them.
3. **State management** (doc 04): the Vuex-reflection layer is the biggest structural obstacle to both performance work and multiplayer.
4. **Multiplayer groundwork** (docs 05 and 09): engine extraction behind a local-server interface while touching the store anyway. Doc 09 classifies the mutations that interface carries.
5. **Rendering** (doc 03): measure once the store refactor has landed, then decide on Vapor/canvas.

## Status by doc

- **Doc 01 (toolchain):** done.
- **Doc 02 (CI and deployment):** done; the doc has been removed.
- **Doc 03 (framework and rendering):** resolved — the Vue upgrade, `<script setup>` migration, and doc 11's performance measurement are all done, and the numbers don't justify Vapor, Svelte, or canvas.
- **Doc 04 (state management):** done — the model layer is plain interfaces plus free functions, no classes left.
- **Doc 05 (multiplayer groundwork):** partial — persistence is out of the engine and the old `do*`/`m*` split is gone, but the action-union/dispatch entry point, the workspace-package extraction, and the hidden-information audit are still pending.
- **Doc 06 (UI chrome):** done; the doc has been removed.
- **Doc 07 (testing and code quality):** done.
- **Doc 08 (bundle size):** resolved except one open item — a Vite/Rolldown chunk-duplication bug in dice-box's `world.offscreen.js` output, non-urgent since lazy-loading already keeps that chunk off the critical path.
- **Doc 09 (mutation classification):** steps 3–4 (moving split/muster/move staging into UI stores) are merged (#244–#247, #256). Steps 1, 2, and 5 (the dispatch entry point, the `GameAction` union, and the carryover collapse) are open in #241/#242. Step 6 (workspace-package extraction) hasn't started.
