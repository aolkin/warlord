# CI & Deployment

The single workflow builds on push to `main` and deploys to GitHub Pages. Action versions verified against their release pages, July 2026.

## Update the actions

Every action in the workflow is several majors behind: `actions/checkout` v3 → v7, `actions/setup-node` v3 → v7, `actions/configure-pages` v2 → current, `actions/upload-pages-artifact` v1 → v5, `actions/cache` v3 → v4+. The v1 upload-pages-artifact / older deploy-pages pairings have been deprecated by GitHub, so the deploy may already be broken or on borrowed time.

- **Pros:** required for continued function (older artifact actions are being turned off); Node 24 runners.
- **Cons:** checkout v7 and setup-node v7 have minor breaking changes to review, nothing structural.

## Add a PR quality gate

There is no lint, typecheck, or test job anywhere. Add a workflow on pull requests running install → lint → `vue-tsc` typecheck → test → build.

- **Pros:** the safety net every other proposal in this folder wants; catches the class of breakage dependabot PRs currently merge blind.
- **Cons:** a few minutes of CI per PR.

## Remove the workflow hacks

The workflow renames `tsconfig.json` out of the way before building (a symptom of the Nuxt-extends problem, doc 01) and carries a `dist`-keyed cache plus commented-out steps. With a standalone tsconfig and modern Vite, all of that can go; caching via `setup-node`'s built-in yarn/pnpm cache is sufficient.

- **Pros:** the workflow becomes ~20 honest lines; build caching of `dist` keyed on `hashFiles('dist')` is doing nothing useful today anyway.
- **Cons:** none.

## Dependency automation: dependabot → Renovate (or grouped dependabot)

History shows dependabot security bumps merged one-at-a-time with no CI validation. Renovate groups updates, schedules them, and can auto-merge patch bumps once the PR gate exists; dependabot's own `groups` config is the lighter-touch alternative.

- **Pros:** less merge noise; updates actually validated by CI.
- **Cons:** Renovate is another config surface; grouped dependabot is nearly as good for a repo this size.

## Preview deploys

Optional: deploy PR branches to a preview URL. GitHub Pages doesn't do per-PR previews natively, so this would mean Cloudflare Pages or Netlify — which could also replace Pages for the main deploy.

- **Pros:** visual review of UI changes before merge; Cloudflare Pages is free-tier friendly and becomes relevant again if multiplayer lands on Cloudflare (doc 05).
- **Cons:** ties deployment to a third-party account; GitHub Pages is working fine for a static SPA.
