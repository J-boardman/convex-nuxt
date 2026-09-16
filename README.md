# Convex for Vue and Nuxt

First-class Vue 3 and Nuxt integrations for [Convex](https://convex.dev), built
from the behavior of Convex's officially supported Svelte client rather than
from an abandoned community implementation.

This workspace produces two public packages:

- [`@j-boardman/convex-vue`](./packages/vue) contains the shared Vue runtime,
  typed composables, authentication, pagination, and framework-neutral server
  utilities.
- [`@j-boardman/convex-nuxt`](./packages/nuxt) installs that same runtime in
  Nuxt and adds auto-imports, request-scoped authentication, and automatic
  server-render-to-live query hydration.

Choose the Vue package for a Vue application. Choose the Nuxt package for a
Nuxt application; it installs the Vue runtime as a dependency, so application
code does not need two integrations.

## Current scope

The shared runtime supports generated Convex function references, reactive and
skipped queries, stale data, typed mutations and actions, Convex-native
optimistic updates, reactive pagination, generic authentication, connection
state, explicit teardown, and one-shot HTTP clients.

Nuxt additionally supports anonymous and authenticated SSR, Convex-safe Nuxt
payload transport, hydration without a duplicate HTTP query, direct Convex
reads during client navigation, and H3 request-token isolation. Authentication
tokens are never put in public runtime config or hydration payloads.

The packages remain pre-release software. Their release gate includes the
packed-consumer and browser verification matrix in the
[design](./docs/convex-nuxt-design.md).

## Develop both integrations

```sh
pnpm install
pnpm dev
```

`pnpm dev` prepares the local packages and starts the shared Convex backend,
the Vue playground, and the Nuxt playground together. Each surface also has a
root command: `pnpm dev:backend`, `pnpm dev:vue`, and `pnpm dev:nuxt`.

The development and release gates are described in
[`docs/development-and-release.md`](./docs/development-and-release.md).
Applications moving from the existing community integrations should follow the
deliberate [migration guide](./docs/migrating-from-community-packages.md).
Authentication is integrated through the low-level contract; the
[Convex Auth v2 adapter guide](./docs/auth-adapters.md) records the first-party
reference design and its current alpha boundary.
The [support policy](./docs/support-policy.md) records the currently proven
version, runtime, browser, and deployment matrix.

## License

Apache-2.0
