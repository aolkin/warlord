# Toolchain & Dependencies

Verified against npm and nodejs.org, July 2026.

## Node.js: 18 → 24

**Decided: Node 24.** CI pins Node 18, which reached end-of-life 2025-04-30; Node 20 also went EOL 2026-04-30. Node 24 is LTS until April 2028.

- **Pros:** security support; required by current Vite (Vite 8 needs Node ≥20).
- **Cons:** none meaningful for a frontend project.

Add an `engines` field and an `.nvmrc`/`.node-version` file so local and CI versions stay aligned.

## Package manager: yarn classic → pnpm

The repo uses yarn 1 (classic), which is in maintenance mode. pnpm (11.x) is faster, stricter about undeclared dependencies, and its lockfile diffs are readable. npm is the zero-extra-tooling alternative; yarn berry is viable but its PnP mode fights some tooling.

- **Pros:** strictness would have caught that `vue` itself is not a declared dependency; disk-efficient; wide adoption.
- **Cons:** one more tool to install; lockfile migration is a one-time churny diff.
- **Alternative:** plain npm — boring, universal, slightly slower; fine if you value zero setup.

pnpm over npm for *this* project: today the difference is marginal — the case is the planned workspace split (`packages/engine` + client, doc 05), where pnpm's non-hoisted layout and stricter cross-package dependency isolation work better than npm workspaces, plus the undeclared-dependency strictness above. If the workspace split weren't planned, npm would be fine.

## Vite: 2.9 → 8.x

Current Vite is 8.1 (vite 2.9 is four majors and ~4 years behind). The config here is small, so the migration is mostly plugin updates: `@vitejs/plugin-vue` 1.x → 6.x, and the alpha `@vuetify/vite-plugin` is superseded by `vite-plugin-vuetify` (2.1.x).

- **Pros:** required for current Vue/Vuetify plugin ecosystem; dev-server and build performance; native ESM everywhere.
- **Cons:** a handful of config/behavior changes across four majors, but this config surface is tiny.

## TypeScript: `<4.5.0` → 6.x (7.x later)

TypeScript 7.0 (GA July 2026) is the Go-native compiler, roughly 10× faster; 6.0 is the JS-based bridge release with matching behavior. Jumping from 4.4 means adopting several years of new defaults and stricter checks.

- **Pros:** massively faster checks (7.x); years of language features; current `@types` packages require modern TS.
- **Cons:** the jump will surface new type errors; and two tools this repo needs cannot use 7.x yet — `vue-tsc`/Volar embeds TypeScript's programmatic API, which the Go compiler doesn't ship until ~7.1 (expected fall 2026), and typescript-eslint's supported range is `>=4.8.4 <6.1.0`. **So the practical target now is 6.x**; revisit 7.x when 7.1 lands and Volar adopts it. (A future Vue-free engine package could use `tsc` 7 immediately; oxlint's tsgolint also does type-aware linting on the native compiler already.)
- Also: `tsconfig.json` currently extends `./.nuxt/tsconfig.json`, which doesn't exist outside a Nuxt build (CI literally renames tsconfig away to build). Write a real standalone tsconfig.

## ESLint: 7 → 10, flat config

ESLint 10 (Feb 2026) removed `.eslintrc` support entirely; flat `eslint.config.js` is mandatory. The current config stack (`eslint-config-standard-with-typescript`, `babel-eslint`, `eslint-plugin-standard`) is abandoned or renamed upstream. Rebuild on `eslint-plugin-vue` 10.x + `@vue/eslint-config-typescript` 14.x.

- **Pros:** working lint again with far less config; typed linting is much faster on modern TS.
- **Cons:** flat-config rewrite is manual; standard-style shareable configs largely died, so some rule choices need re-deciding.
- **Alternatives:** oxlint (Rust, ~100× faster, no type-aware rules yet) as a fast first pass alongside ESLint; or Biome (lint + format in one) if you'd rather drop Prettier-style tooling entirely. Either can complement rather than replace ESLint.

## Prettier

**Decided: adopt, incrementally.** ESLint's flat config now includes `eslint-config-prettier`, which turns off the stylistic rules that would otherwise fight Prettier; no lint rule changed behavior beyond that. Formatting itself is enforced directory by directory rather than repo-wide in one pass, since every directory Prettier reformats needs a rebase-and-reformat pass on any PR with pending changes there. `src/game/models/` and `src/utils/` are done: reformatted and enforced in CI via `format:models:check` and `format:utils:check`. Later PRs will extend enforcement to the rest of `src/`, one directory at a time.

- **Pros:** removes formatting bikeshedding from review; each directory's reformat is a small, isolated, easy-to-review diff instead of one repo-wide churn commit.
- **Cons:** until every directory is covered, some files are formatted and some aren't; each in-flight PR touching a newly-covered directory needs a rebase-and-reformat pass.
- **Config:** `semi: false`, `printWidth: 120`, and `arrowParens: "avoid"` override Prettier's defaults to match the codebase's existing conventions (no semicolons, wide lines already common, single-arg arrows unparenthesized); everything else (double quotes, 2-space indent, trailing commas) already matched Prettier's default.

## Remove dead and vestigial dependencies

None of these participate in the actual Vite build:

- `nuxt3` (a 2022 RC snapshot; the package line itself is dead — Nuxt is now `nuxt` 4.x), `nuxt.config.ts`, and the Nuxt-flavored README
- `@vue/cli-service`, `@vue/cli-plugin-babel`, `vue-cli-plugin-vuetify`, `vuetify-loader`, `sass-loader` (webpack-era)
- `webfontloader` (see doc 06), `deep-freeze` (unmaintained since 2013; `Object.freeze` or TS `readonly` covers it), `roboto-fontface`
- `yorkie` + `lint-staged` 9 (yorkie is abandoned; if pre-commit hooks are wanted, use husky or lefthook with current lint-staged — or rely on CI only)

**Pro:** install size and audit noise drop sharply; the lockfile stops pulling webpack 5, express, etc. **Con:** none, beyond verifying nothing quietly imports them (a grep shows only `webfontloader` is imported).

## Declare real dependencies

`vue` is not in `package.json`; it resolves transitively (currently 3.2.45). Declare `vue` explicitly and pin the intended major. Same review for anything else imported but undeclared.

## Lodash

**Decided: swap to `lodash-es`, keep lodash.** `lodash` 4 is fine but CJS; `lodash-es` tree-shakes better under Vite. Usage is ~40 call sites across ~16 functions, so the swap is cheap; dropping lodash entirely isn't worth the hand-written equivalents for `matches`, `memoize`, etc.
