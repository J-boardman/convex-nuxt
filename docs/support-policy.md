# Support and compatibility policy

This policy describes what the first pre-release line can honestly support from
the repository's automated evidence. A version being installable is not the
same as it being supported.

## Supported application matrix

| Surface | Supported floor | Current verification |
| --- | --- | --- |
| Vue | Vue 3.5 | Source typecheck, clean packed Vite consumer, production build, generic SSR seed render, and live browser behavior |
| Nuxt | Nuxt 4.5 | Module fixture, generated types, packed production consumer, anonymous and authenticated live SSR hydration, request isolation, and static generation |
| Convex | Convex 1.45 | Unit fakes exercise its public contracts, packed consumers install the declared peer, and the live suite deploys the playground functions to a disposable backend |
| Node.js | Node 22 | CI runs the complete repository gate on Node 22 and 24 |
| Browser | Chrome | Playwright launches the system Chrome channel against both playgrounds; local verification uses Chrome 143 |
| Nitro | Node server and Cloudflare Module | The packed Nuxt consumer production-builds for both presets |

The public peer ranges are `vue: ^3.5.0`, `nuxt: ^4.5.0`, and
`convex: ^1.45.0`. Each release is verified against exact current versions in
the workspace as well as the declared resolution behavior in clean consumers.

## Supported environments

`@j-boardman/convex-vue` supports client-rendered Vue applications using its
plugin and explicit composable imports. Generic Vue SSR is supported through a
manual per-request HTTP client and an encoded `initialData` hand-off; automatic
payload transport is the responsibility of a framework adapter.

`@j-boardman/convex-nuxt` supports Nuxt server rendering and client rendering,
including request-scoped auth tokens and deployment to the Node server and
Cloudflare Module Nitro presets. Anonymous queries can also be prerendered into
static output and become live subscriptions after hydration. A browser Convex
client is never constructed during SSR or prerendering.

The automated browser support claim covers component disposal and route
navigation, but not an application-root remount or source-file hot replacement.
Those remain manual development checks until a repeatable browser fixture
proves the exact lifecycle.

Both packages are ESM-only. CommonJS `require()` is not supported. TypeScript
must use a modern Node or bundler module-resolution mode capable of following
package `exports`.

## Candidate and unverified combinations

The following are not supported merely because they may compile:

- Nuxt 3;
- Vue releases older than 3.5;
- Convex releases older than 1.45;
- Bun or Deno as the build and server runtime;
- Firefox, Safari, or WebKit-specific browser behavior;
- additional Nitro presets not named above;
- multiple Convex deployments inside one Vue application; and
- automatic SSR for Vue meta-frameworks other than Nuxt.

A candidate moves into the supported matrix only after a clean packed-consumer
fixture and the relevant runtime or browser test become part of the required
CI gate. Compatibility reports without a reproduction are useful input, but do
not establish a support promise.

## Versioning before 1.0

The packages are published as one fixed Changesets group. Every release gives
`@j-boardman/convex-vue` and `@j-boardman/convex-nuxt` the same version, and the
Nuxt package depends on that exact Vue version. Applications should update both
through the Nuxt dependency rather than forcing a second Vue-runtime version.

Before 1.0:

- a patch release corrects behavior without intentionally changing a public
  contract;
- a minor release may add APIs or make a documented breaking change;
- every breaking change must appear in the changelog and migration notes; and
- deprecated behavior is removed only when retaining it would undermine a
  security, lifecycle, or SSR invariant, or after a documented replacement has
  shipped.

Preview builds from `pkg.pr.new` use synthetic versions and are never a support
line. They exist so applications can test the exact reviewed pull-request
revision before it reaches npm.

## Dependency and security maintenance

The repository pins development and fixture dependencies so a passing commit
remains reproducible. Peer ranges change only through a package-facing change
with a clean-consumer proof. A new upstream major is never considered supported
until its public client, types, Nuxt module build, SSR boundary, and tarball
consumers pass.

Security fixes may narrow a peer range or retire a runtime sooner than ordinary
compatibility changes. Such a release must state the affected versions and the
required consumer action. Authentication tokens must never appear in Nuxt
public runtime config, hydration payloads, logs, query keys, fixtures, or test
artifacts.

## Reporting a compatibility problem

Open a GitHub issue with:

- the Vue, Nuxt, Convex, Node, package, and package-manager versions;
- the rendering mode and Nitro preset;
- a minimal reproduction using generated `api.*` references;
- whether the failure occurs during typecheck, build, SSR, hydration, or a live
  update; and
- the smallest observed error or state transition, with all tokens removed.

An issue against an unverified combination may result in a new candidate
fixture rather than an immediate compatibility claim.
