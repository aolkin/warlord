# Toolchain & Dependencies

Verified against npm and nodejs.org, July 2026.

## Node.js: 18 → 22 or 24

CI pins Node 18, which reached end-of-life 2025-04-30; Node 20 also went EOL 2026-04-30. Node 22 (LTS until April 2027) or 24 (LTS until April 2028) are the sensible targets; 24 gives the longest runway.

- **Pros:** security support; required by current Vite (Vite 8 needs Node ≥20).
- **Cons:** none meaningful for a frontend project.

Add an `engines` field and an `.nvmrc`/`.node-version` file so local and CI versions stay aligned.

## Package manager: yarn classic → pnpm

The repo uses yarn 1 (classic), which is in maintenance mode. pnpm (11.x) is faster, stricter about undeclared dependencies, and its lockfile diffs are readable. npm is the zero-extra-tooling alternative; yarn berry is viable but its PnP mode fights some tooling.

- **Pros:** strictness would have caught that `vue` itself is not a declared dependency; disk-efficient; wide adoption.
- **Cons:** one more tool to install; lockfile migration is a one-time churny diff.
- **Alternative:** plain npm — boring, universal, slightly slower; fine if you value zero setup.

## Vite: 2.9 → 8.x

Current Vite is 8.1 (vite 2.9 is four majors and ~4 years behind). The config here is small, so the migration is mostly plugin updates: `@vitejs/plugin-vue` 1.x → 6.x, and the alpha `@vuetify/vite-plugin` is superseded by `vite-plugin-vuetify` (2.1.x).

- **Pros:** required for current Vue/Vuetify plugin ecosystem; dev-server and build performance; native ESM everywhere.
- **Cons:** a handful of config/behavior changes across four majors, but this config surface is tiny.

## TypeScript: `<4.5.0` → 6.x or 7.x

TypeScript 7.0 (GA July 2026) is the Go-native compiler, roughly 10× faster; 6.0 is the JS-based bridge release with matching behavior. Jumping from 4.4 means adopting several years of new defaults and stricter checks.

- **Pros:** massively faster checks (7.x); years of language features; current `@types` packages require modern TS.
- **Cons:** the jump will surface new type errors; editor/plugin ecosystem for 7.x is still settling — 6.x is the conservative landing spot, 7.x the forward-looking one.
- Also: `tsconfig.json` currently extends `./.nuxt/tsconfig.json`, which doesn't exist outside a Nuxt build (CI literally renames tsconfig away to build). Write a real standalone tsconfig.

## ESLint: 7 → 10, flat config

ESLint 10 (Feb 2026) removed `.eslintrc` support entirely; flat `eslint.config.js` is mandatory. The current config stack (`eslint-config-standard-with-typescript`, `babel-eslint`, `eslint-plugin-standard`) is abandoned or renamed upstream. Rebuild on `eslint-plugin-vue` 10.x + `@vue/eslint-config-typescript` 14.x.

- **Pros:** working lint again with far less config; typed linting is much faster on modern TS.
- **Cons:** flat-config rewrite is manual; standard-style shareable configs largely died, so some rule choices need re-deciding.
- **Alternatives:** oxlint (Rust, ~100× faster, no type-aware rules yet) as a fast first pass alongside ESLint; or Biome (lint + format in one) if you'd rather drop Prettier-style tooling entirely. Either can complement rather than replace ESLint.

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

`lodash` 4 is fine but CJS; `lodash-es` tree-shakes better under Vite. Usage is ~40 call sites across ~16 functions (`range`, `sum`, `matches`, …), so swapping to `lodash-es` is the cheap win; dropping lodash entirely is possible but a larger find-and-replace than it looks.

- **Pros:** smaller bundle either way.
- **Cons:** dropping it entirely costs hand-written equivalents for `matches`, `memoize`, etc.
