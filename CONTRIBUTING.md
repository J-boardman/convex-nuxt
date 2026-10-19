# Contributing

## Layout

```text
packages/vue    @j-boardman/convex-vue: the runtime and composables
packages/nuxt   @j-boardman/convex-nuxt: the Nuxt module over that runtime
examples/       a task list for each package, sharing one Convex backend
test/           unit, type, Nuxt module, and live browser tests
```

Package code never imports example or test code.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Builds both packages, starts a local Convex deployment, and serves both examples against it. |
| `pnpm typecheck` | Builds, then typechecks packages, examples, and the public type tests. |
| `pnpm lint` | ESLint over the repository. |
| `pnpm test` | Unit tests, Nuxt module tests, and packed-package checks. Needs no credentials. |
| `pnpm test:live` | Starts a disposable local Convex backend and drives the examples in Chrome. |
| `pnpm verify` | `typecheck`, `lint`, and `test` together; CI runs this on Node 22 and 24. |

`pnpm test:live` runs a pinned backend version (see
`scripts/run-live-tests.mjs`) because newer artifacts can need newer host
libraries. Raise the pin deliberately and rerun the suite. Set `CONVEX_URL` to
run the browser tests against a deployment you manage instead.

## Commits

`AGENTS.md` holds the commit policy and `.githooks/commit-msg` enforces its
grammar. `pnpm install` points Git at those hooks: commits run `typecheck` and
`lint`, and pushes run `test`.

Package-facing changes include a changeset (`pnpm changeset`). Both packages
share one version.

## Releasing

Merging changesets to `main` opens a version pull request; merging that
publishes both packages from `.github/workflows/release.yml` with npm
provenance.

npm can only trust a workflow for a package that already exists, so the first
release is bootstrapped once:

1. Publish `0.1.0` of both packages from a GitHub-hosted runner with a
   short-lived granular npm token, then revoke the token.
2. On npm, make each package trust `release.yml` in this repository, with the
   `release` environment.
3. In GitHub, create the protected `release` environment and allow Actions to
   create pull requests.

## Before 1.0

The live suite does not yet cover authenticated server rendering or
pagination against a real backend; unit tests with a fake client cover both.
The showcase app is expected to restore that coverage.
