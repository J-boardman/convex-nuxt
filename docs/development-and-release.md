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
  backend/             # shared Convex project and Relay/diagnostic data
  shared/              # private presentational Vue components and styles
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
paths into `src`. The private shared playground package can depend on Vue, but
must not import Convex, `@j-boardman/convex-vue`, or
`@j-boardman/convex-nuxt`.

## Playground and consumer contracts

The playgrounds and packed consumers answer different questions.

- A playground is a workspace-linked development application. Its `/` route is
  the Relay social workspace used for human-facing examples; its
  `/__diagnostics` route provides the lower-level probes used by maintainers and
  Playwright.
- A consumer fixture installs generated `.tgz` files outside the workspace. It
  proves package metadata, exports, dependency rewriting, types, and production
  builds as npm users receive them.
- A passing playground cannot prove that a tarball is publishable. A passing
  consumer build cannot prove live browser lifecycle behavior. Both are release
  requirements.

The Relay surface exercises a paginated live feed, desired-state reactions, and
chat through normal product interactions. Vue and Nuxt receive the same plain
view models and intent events from `playgrounds/shared`; each application owns
its own queries, mutations, auth setup, client lifecycle, SSR decisions, and
error handling. Runtime variants use an explicit badge and receipt as well as a
different accent, so the apps remain distinguishable without relying on colour.

The Vue diagnostic surface exercises reactive arguments, skip and stale states,
mutations, actions, optimistic rollback, pagination, auth state, connection
state, and teardown. Its live browser test also drives a real Vite hot update
and an application-root remount while counting active Convex sockets.

The Nuxt Relay surface renders its first feed on the server, reuses that payload
during hydration, upgrades it to a live subscription, and retains one client
across product-route navigation. Its diagnostic surface exercises the same
low-level behavior as Vue plus server helpers. Focused tests cover authenticated
SSR state and concurrent request isolation without putting credentials in the
browser fixture.

The shared Convex playground backend supplies the Relay posts, reactions,
messages, and four fixed demo personas alongside deterministic query,
pagination, auth, action, transaction, error, and unusual-value probes. Relay
personas are public, non-sensitive demo actors; they are not an authentication
example. The live suite starts an accountless disposable Convex backend by
default, generates an ephemeral signing key for its auth checks, and removes
both after the run. An explicit `CONVEX_URL` can instead target a separately
managed compatible deployment.

## Root script contract

The root package owns orchestration. Package scripts own package-specific build
details.

| Script | Contract |
| --- | --- |
| `pnpm dev:prepare` | Generate module stubs and playground types. |
| `pnpm dev` | Run the backend and both playgrounds against its generated URL. |
| `pnpm dev:backend` | Run only the shared Convex backend. |
| `pnpm dev:vue` | Run only the Vue playground. |
| `pnpm dev:nuxt` | Run only the Nuxt playground. |
| `pnpm typecheck` | Build declarations, then check both packages and public types. |
| `pnpm lint` | Check source, tests, scripts, fixtures, and configuration. |
| `pnpm build` | Build both public packages in dependency order. |
| `pnpm test:unit` | Run deterministic controller and lifecycle tests. |
| `pnpm test:types` | Verify public generic inference and import boundaries. |
| `pnpm test:module` | Build and exercise Nuxt module fixtures. |
| `pnpm test:e2e` | Run deterministic Vue and Nuxt browser tests. |
| `pnpm test:package` | Pack, inspect, install, and build both npm tarballs. |
| `pnpm test` | Run the complete deterministic, credential-free local suite. |
| `pnpm test:live` | Provision a disposable Convex backend and exercise live browser behavior, authenticated SSR, and static generation. |
| `CONVEX_URL=... pnpm test:live` | Exercise the live suite against a separately managed compatible deployment. |
| `pnpm verify` | Typecheck, lint, build, and run the local suite. |
| `pnpm changeset` | Record release intent for a package-facing change. |
| `pnpm preview` | Publish both packages to `pkg.pr.new` from CI. |
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

CI repeats every local gate because hooks can be bypassed. A separate Node 24
job also runs `pnpm test:live` against the disposable backend, so live queries,
WebSockets, authenticated SSR isolation, hydration, and static generation do
not depend on repository credentials.

## Versioning and previews

Changesets owns versions, changelogs, tags, and publication. The two packages
form a fixed group: changing either published package versions both. This keeps
the Nuxt adapter and its exact Vue dependency on one supportable release line.

Package-facing pull requests include a changeset. Documentation-only, test-only,
and internal maintenance changes normally do not. After a reviewer with write
access approves a pull request, CI publishes both packages in one `pkg-pr-new`
invocation. The preview uses the exact approved commit and a synthetic preview
version, so installing it cannot pin a consumer lockfile to a future npm release.
The repository's `pkg.pr.new` GitHub App must be installed before this workflow
can upload or comment with preview links.

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
