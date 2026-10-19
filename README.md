# Convex for Vue and Nuxt

First-class Vue 3 and Nuxt integrations for [Convex](https://convex.dev), built
from the behavior of Convex's officially supported Svelte client rather than
from an abandoned community implementation.

This workspace produces two public packages:

- [`@j-boardman/convex-vue`](./packages/vue) contains the shared Vue runtime,
  typed composables, authentication, and pagination.
- [`@j-boardman/convex-nuxt`](./packages/nuxt) installs that same runtime in
  Nuxt and adds auto-imports, request-scoped authentication, and automatic
  server-render-to-live query hydration.

Choose the Vue package for a Vue application. Choose the Nuxt package for a
Nuxt application; it installs the Vue runtime as a dependency, so application
code does not need two integrations.

The shared runtime provides typed live queries (single, keyed sets, and
paginated), mutations with Convex-native optimistic updates, actions,
provider-neutral authentication, and connection state. Nuxt adds
server rendering that hands off to a live subscription without a second fetch,
per-request authentication on the server, and auto-imports. Auth tokens never
reach public runtime config or the hydration payload.

## Support

| | Supported |
| --- | --- |
| Vue | 3.5 and later |
| Nuxt | 4.5 and later (Nuxt 3 is not supported) |
| Convex | 1.45 and later |
| Node.js | 22 and later |
| Nitro presets | Node server, Cloudflare Module |
| Module format | ESM only |

The packages are pre-release. Until 1.0, a minor version may change the public
API; the changelog says how to migrate.

## Coming from community packages

| Before | Here |
| --- | --- |
| `const { mutate } = useConvexMutation(...)` | `const mutate = useConvexMutation(...)`, called directly |
| A hand-rolled `client.setAuth` plugin | `setupConvexAuth(() => ({ isLoading, isAuthenticated, fetchAccessToken }))` |
| `await query.suspense()` in Nuxt pages | Nothing: Nuxt queries server-render automatically |
| Custom pagination | `useConvexPaginatedQuery(query, args, { initialNumItems })` |
| String function names | Generated `api.*` references |

## Examples

[`examples/vue`](./examples/vue) and [`examples/nuxt`](./examples/nuxt) are
the same small task list, one per package, sharing the Convex functions in
[`examples/backend`](./examples/backend). Each shows a live query, an
optimistic mutation, and (in Nuxt) a server-rendered first paint that turns
live without a refetch.

```sh
pnpm install
pnpm dev
```

`pnpm dev` builds both packages, starts a local Convex deployment, and serves
the Vue example and the Nuxt example against it.

[`showcase`](./showcase) is a fuller Nuxt app: a live poll with signed-in
server rendering, optimistic votes, paginated history, and a panel that traces
each query and can cut the connection to Convex. Run it with
`pnpm dev:showcase`.

Contributors should read [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache-2.0
