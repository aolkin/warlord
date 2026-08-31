# Toolchain & Dependencies

Verified against npm and nodejs.org, July 2026.

## Node.js: 18 → 24 (done)

CI pinned Node 18, which reached end-of-life 2025-04-30 (Node 20 followed 2026-04-30). Node 24 is LTS until April 2028 and is what current Vite requires (≥20). An `engines` field plus an `.nvmrc`/`.node-version` file keep local and CI versions aligned.

## Package manager: yarn classic → pnpm (done)

The repo used yarn 1 (classic), in maintenance mode. pnpm is faster, stricter about undeclared dependencies — it would have caught that `vue` itself wasn't declared — and disk-efficient, with readable lockfile diffs. Plain npm was the zero-setup alternative; yarn berry's PnP mode fights some tooling.

pnpm over npm specifically because of the planned workspace split (`packages/engine` + client, doc 05): pnpm's non-hoisted layout and stricter cross-package isolation fit that better than npm workspaces.

## Vite: 2.9 → 8.x (done)

Four majors and ~4 years behind. The migration was mostly plugin updates: `@vitejs/plugin-vue` 1.x → 6.x, and the alpha `@vuetify/vite-plugin` superseded by `vite-plugin-vuetify` (2.1.x). Worth it for the current Vue/Vuetify plugin ecosystem, dev-server/build performance, and native ESM — the config surface here is small enough that the handful of behavior changes across four majors barely mattered.

## TypeScript: `<4.5.0` → 6.x (7.x later, done)

TypeScript 7.0 (GA July 2026) is the Go-native compiler, roughly 10× faster; 6.0 is the JS-based bridge release with matching behavior. Two tools this repo needs can't use 7.x yet: `vue-tsc`/Volar embeds TypeScript's programmatic API, which the Go compiler won't ship until ~7.1 (expected fall 2026), and typescript-eslint's supported range is `>=4.8.4 <6.1.0`. So the practical target is 6.x — revisit 7.x once Volar adopts 7.1. (A future Vue-free engine package could use `tsc` 7 immediately; oxlint's tsgolint already does type-aware linting on the native compiler.)

`tsconfig.json` is now a real standalone config (no `extends`, no Nuxt reference); CI runs `pnpm typecheck` directly.

## ESLint: 7 → 10, flat config (done)

ESLint 10 (Feb 2026) removed `.eslintrc` support entirely; flat `eslint.config.js` is mandatory. The old config stack (`eslint-config-standard-with-typescript`, `babel-eslint`, `eslint-plugin-standard`) is abandoned or renamed upstream, so the config was rebuilt on `eslint-plugin-vue` 10.x + `@vue/eslint-config-typescript` 14.x — losing the shareable standard-style config meant re-deciding some rule choices by hand.

Alternatives if more speed is wanted later: oxlint (Rust, ~100× faster, no type-aware rules yet) as a fast first pass alongside ESLint, or Biome (lint + format in one) to drop Prettier-style tooling entirely. Either can complement rather than replace ESLint.

## Prettier (done)

Adopted incrementally, directory by directory, now complete — each directory's reformat was a small, isolated diff instead of one repo-wide churn commit, at the cost of needing a rebase-and-reformat pass on any in-flight PR touching a newly-covered directory. `eslint-config-prettier` turns off the ESLint stylistic rules that would otherwise fight Prettier; no lint rule changed behavior beyond that. All of `src/` is now formatted, covered by a single `format`/`format:check` glob.

Config overrides Prettier's defaults on three settings to match the codebase's existing conventions: `semi: false`, `printWidth: 120`, `arrowParens: "avoid"`. Everything else (double quotes, 2-space indent, trailing commas) already matched Prettier's defaults.

## Remove dead and vestigial dependencies (done)

None of these are in `package.json` any more:

- `nuxt3` (a 2022 RC snapshot; the package line itself is dead — Nuxt is now `nuxt` 4.x), `nuxt.config.ts`, and the Nuxt-flavored README
- `@vue/cli-service`, `@vue/cli-plugin-babel`, `vue-cli-plugin-vuetify`, `vuetify-loader`, `sass-loader` (webpack-era)
- `webfontloader` (see doc 06), `deep-freeze` (unmaintained since 2013; `Object.freeze` or TS `readonly` covers it), `roboto-fontface`
- `yorkie` + `lint-staged` 9 (yorkie is abandoned; husky or lefthook with current lint-staged is the replacement if pre-commit hooks are wanted, or rely on CI only)

## Declare real dependencies (done)

`vue` is now a direct dependency (`^3.5.41`) instead of resolving transitively.

## Lodash (decided: keep, swap to `lodash-es`)

`lodash` 4 is fine but CJS; `lodash-es` tree-shakes better under Vite. Usage is ~40 call sites across ~16 functions, so the swap is cheap — dropping lodash entirely isn't worth hand-writing equivalents for `matches`, `memoize`, etc.
