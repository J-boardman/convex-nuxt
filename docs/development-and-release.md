# Development and release contract

Status: accepted

Date: 2026-09-02

This repository is a private pnpm workspace that produces two public npm
packages:

- `@j-boardman/convex-vue`
- `@j-boardman/convex-nuxt`

The packages share one version and one release line. The Nuxt package depends
on the exact matching Vue package. Both packages use Apache-2.0 so work derived
from the official Apache-licensed Convex clients has an uncomplicated
attribution path.

## Workspace ownership

```text
packages/
  vue/                 # public Vue runtime and composables
  nuxt/                # public Nuxt module and SSR adapter
playgrounds/
  backend/             # shared Convex project and diagnostic data
  vue/                 # interactive Vue + Vite application
  nuxt/                # interactive Nuxt application
test/
  consumers/           # clean applications that install packed tarballs
  unit/
  types/
  e2e/
```

Package code must never import playground or test code. Playground applications
import the libraries through their workspace package names, not through relative
paths into `src`.

## Playground and consumer contracts

The playgrounds and packed consumers answer different questions.

- A playground is a workspace-linked development application. It provides HMR,
  manual diagnostics, and browser surfaces for Playwright.
- A consumer fixture installs generated `.tgz` files outside the workspace. It
  proves package metadata, exports, dependency rewriting, types, and production
  builds as npm users receive them.
- A passing playground cannot prove that a tarball is publishable. A passing
  consumer build cannot prove live browser lifecycle behavior. Both are release
  requirements.

The Vue playground exercises live queries, reactive arguments, skip and stale
states, mutations, actions, optimistic updates, pagination, auth, connection
state, teardown, remounting, and HMR.

The Nuxt playground exercises the same shared behavior plus server-rendered
HTML, payload reuse, hydration, authenticated SSR, client navigation, SSG,
server helpers, and concurrent request isolation.

The shared Convex playground backend supplies deterministic query, pagination,
auth, action, transaction, error, and unusual-value cases. Tests that require a
hosted Convex deployment are separate from the credential-free local suite.

## Root script contract

The root package owns orchestration. Package scripts own package-specific build
details.

| Script | Contract |
| --- | --- |
| `pnpm dev:prepare` | Generate module stubs and playground types. |
| `pnpm dev` | Run the backend, Vue playground, and Nuxt playground together. |
| `pnpm dev:backend` | Run only the shared Convex backend. |
| `pnpm dev:vue` | Run only the Vue playground. |
| `pnpm dev:nuxt` | Run only the Nuxt playground. |
| `pnpm typecheck` | Check both packages, public type tests, and supported consumers. |
| `pnpm lint` | Check source, tests, scripts, fixtures, and configuration. |
| `pnpm build` | Build both public packages in dependency order. |
| `pnpm test:unit` | Run deterministic controller and lifecycle tests. |
| `pnpm test:types` | Verify public generic inference and import boundaries. |
| `pnpm test:module` | Build and exercise Nuxt module fixtures. |
| `pnpm test:e2e` | Run deterministic Vue and Nuxt browser tests. |
| `pnpm test:package` | Pack, inspect, install, and build both npm tarballs. |
| `pnpm test` | Run the complete deterministic, credential-free local suite. |
| `pnpm test:live` | Exercise a real Convex deployment in protected CI. |
| `pnpm verify` | Typecheck, lint, build, and run the local suite. |
| `pnpm changeset` | Record release intent for a package-facing change. |
| `pnpm version-packages` | Apply package versions and changelogs. |
| `pnpm release` | Verify and publish the versioned packages. |

`pnpm test:package` builds and packs both packages, runs `publint` and
`@arethetypeswrong/cli`, inspects the tarball manifests and file lists, installs
the tarballs into temporary Vue and Nuxt consumers, and production-builds those
consumers. Workspace links are forbidden in this test.

## Git hooks

Tracked POSIX shell hooks live in `.githooks`. The private root package's
`prepare` script sets `core.hooksPath` to that directory.

- `commit-msg` enforces the grammar in `AGENTS.md`. It checks shape rather than
  attempting to judge whether prose is true.
- `pre-commit` runs `pnpm typecheck` followed by `pnpm lint`. It must remain fast
  enough that ordinary micro-commits do not invite `--no-verify`.
- `pre-push` runs `pnpm test`. The suite is deterministic and requires no npm
  credentials or hosted Convex secrets.

CI repeats every local gate because hooks can be bypassed. Networked live tests
run in protected CI and again before publication.

## Versioning and previews

Changesets owns versions, changelogs, tags, and publication. The two packages
form a fixed group: changing either published package versions both. This keeps
the Nuxt adapter and its exact Vue dependency on one supportable release line.

Package-facing pull requests include a changeset. Documentation-only, test-only,
and internal maintenance changes normally do not. Approved pull requests publish
temporary previews with `pkg-pr-new` so reviewers can install the exact package
artifacts without creating npm releases.

Before a pull request is mergeable, CI must run:

1. frozen dependency installation;
2. typecheck and lint;
3. package builds;
4. deterministic tests;
5. package lint and type-resolution checks; and
6. packed Vue and Nuxt consumer builds.

## npm publication

Both manifests set `publishConfig.access` to `public`, contain repository and
license metadata, and publish only their declared distribution files.

The first versions are published manually with npm account 2FA because npm
trusted publishing can only be configured for packages that already exist.
After that bootstrap:

1. create a protected GitHub environment named `release` and require a
   maintainer's approval;
2. configure each npm package to trust `.github/workflows/release.yml` in this
   repository, using the `release` environment;
3. enable GitHub Actions to create pull requests in the repository settings;
4. publish from the GitHub-hosted runner using npm OIDC;
5. disallow long-lived publication tokens; and
6. retain npm provenance for the public repository and packages.

The workflow deliberately gives different jobs different permissions. Mode
selection can only read the repository, versioning can write the release pull
request but cannot request an npm identity token, and publication receives an
OIDC token only after the protected `release` environment is approved. No
`NPM_TOKEN` secret is used.

Merging ordinary changesets to `main` opens or updates a version pull request.
Merging that version pull request verifies the repository again, publishes both
packages, pushes tags, and creates GitHub releases.

## Contribution rhythm

Each behavior grows as one vertical micro-goal: agree the observable commit
sentence, add its proof, implement through the public API, expose it in the
relevant playground, and verify its packed surface when that surface changes.
Editing several directories is acceptable when every hunk makes the same
sentence true. Independent outcomes remain independent commits.
