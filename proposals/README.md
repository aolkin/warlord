# Modernization Proposals

Written July 2026. The last feature commit landed January 2023 and the last dependency bump July 2023, so essentially every layer of the toolchain is two or more major versions behind. Each document in this folder covers one category, lists concrete proposals, and notes trade-offs and alternatives. Version claims were checked against npm, the Node.js release schedule, and upstream release pages in July 2026.

## Current state, briefly

- Vue 3.2.45 (transitive only — `vue` is not even a direct dependency), Options API components
- Pinia for state management, wrapping plain TypeScript model classes
- Vuetify 4.1, Vite 8.1, TypeScript 6.0, ESLint 10 with flat config, pnpm
- Vestigial Nuxt 3 RC and Vue CLI dependencies that are not part of the actual build
- CI builds on EOL Node 18 with outdated actions and deploys to GitHub Pages; no lint, typecheck, or test steps
- No tests of any kind
- Rendering is SVG generated from Vue templates; game state persists to localStorage as JSON

## Documents

| Doc | Category |
|---|---|
| [01-toolchain-and-dependencies.md](01-toolchain-and-dependencies.md) | Node, package manager, build tool, TypeScript, linting, dead dependencies |
| [02-ci-and-deployment.md](02-ci-and-deployment.md) | GitHub Actions, deploy pipeline, automation |
| [03-framework-and-rendering.md](03-framework-and-rendering.md) | Vue vs. Svelte, SVG vs. canvas, rendering performance |
| [04-state-management.md](04-state-management.md) | Vuex → Pinia, decoupling game logic from the store |
| [05-multiplayer-architecture.md](05-multiplayer-architecture.md) | Preparing for server-mediated multiplayer |
| [06-ui-chrome.md](06-ui-chrome.md) | Vuetify 4, fonts, icons |
| [07-testing-and-code-quality.md](07-testing-and-code-quality.md) | Test infrastructure, type strictness, cleanup |
| [08-bundle-size.md](08-bundle-size.md) | Production bundle size: dice-box chunking, lazy-loading, Vuetify/icon tree-shaking |

## Suggested sequencing

1. **Minimal CI gate first** (doc 02): a PR workflow running just the build, on current Node — cheapest possible safety net, and lint/typecheck can't run until the toolchain is fixed anyway. Grow it to lint + typecheck + test as step 2 delivers them.
2. **Toolchain** (doc 01): everything else is easier on current Vite/TS/ESLint, and none of it changes app behavior.
3. **Mechanical model split + tests around game logic** (doc 07): the models are pure TypeScript and testable today; do this before refactoring them.
4. **State management** (doc 04): the Vuex-reflection layer is the biggest structural obstacle to both performance work and multiplayer.
5. **Multiplayer groundwork** (doc 05): engine extraction behind a local-server interface while touching the store anyway.
6. **Rendering** (doc 03): measure once the store refactor has landed, then decide on Vapor/canvas.

Doc 06 (UI chrome) is done — the Vuetify 4 upgrade and the fonts change it proposed both landed. Doc 08 (bundle size) is resolved except one open item: a Vite/Rolldown chunk-duplication bug in dice-box's `world.offscreen.js` build output, non-urgent since lazy-loading already keeps that chunk off the critical path.
