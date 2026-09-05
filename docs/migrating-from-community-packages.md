# Migrating from community Vue and Nuxt packages

This project is a new integration, not a continuation or compatibility fork of
`convex-vue`, `convex-nuxt`, `vue-convex`, or `nuxt-convex`. Its contracts are
based on the officially supported Convex Svelte client and the framework-neutral
Convex browser APIs. Plan a deliberate migration rather than changing only the
package name.

## Choose one application package

For a regular Vue 3 application:

```sh
pnpm remove convex-vue vue-convex
pnpm add @j-boardman/convex-vue convex vue
```

For a Nuxt application:

```sh
pnpm remove convex-nuxt nuxt-convex
pnpm add @j-boardman/convex-nuxt convex
```

Do not install `@j-boardman/convex-vue` separately in a Nuxt application. The
Nuxt module has an exact dependency on the matching Vue runtime so only one
client contract is present.

The first support line targets Vue 3.5 and Nuxt 4.5 or newer. Nuxt 3 is not
supported until a packed minimum-version fixture proves it; an application that
must remain on Nuxt 3 should not migrate yet.

## Application setup

Plain Vue keeps the familiar plugin shape, with a scoped import:

```ts
import { convexVue } from '@j-boardman/convex-vue'

app.use(convexVue, {
  url: import.meta.env.VITE_CONVEX_URL,
})
```

Nuxt registers the scoped module and uses the conventional public environment
variable:

```ts
export default defineNuxtConfig({
  modules: ['@j-boardman/convex-nuxt'],
  convex: {
    url: process.env.NUXT_PUBLIC_CONVEX_URL,
  },
})
```

The deployment URL is public. Never put a Convex auth token in `runtimeConfig`
or module options.

## API mapping

| Community concept | This project | Migration difference |
| --- | --- | --- |
| `convexVue` plugin | `convexVue` | One client belongs to each Vue app and closes when that app unmounts. |
| `useConvexClient` | `useConvexClient` | Browser-only; use a server entry for SSR and server routes. |
| `useConvexQuery` | `useConvexQuery` | Returns one explicit `pending`, `success`, `stale`, `error`, or `skipped` state machine. |
| Dynamic query collection | `useConvexQueries` | A reactive keyed request map produces one atomically published state snapshot. |
| `useConvexMutation` returning `{ mutate }` | Callable `useConvexMutation` result | Await the callable directly; its resolved value is the generated mutation return type. |
| Optimistic mutation | `.withOptimisticUpdate(...)` or per-call options | Uses Convex's local store, reconciliation, and rollback behavior. |
| Missing or custom action helper | `useConvexAction` | The callable preserves generated action arguments and return types. |
| Missing or custom pagination | `useConvexPaginatedQuery` | The composable owns `paginationOpts`, cursor resets, and early `loadMore`. |
| Manual `client.setAuth` plugin | `setupConvexAuth` | Provider state and Convex token confirmation remain distinct. |
| Direct connection inspection | `useConvexConnectionState` | Returns a readonly reactive Convex connection snapshot. |
| Manual client disposal | App unmount or `closeConvex()` | Query scopes unsubscribe without closing the app-owned client. |

Generated `api.*` function references remain the calling contract. String
function names are rejected.

## Query templates

Community examples commonly destructure independent loading fields:

```ts
const { data, isPending, error } = useConvexQuery(api.tasks.list, {})
```

Use the discriminated state when rendering mutually exclusive outcomes:

```vue
<script setup lang="ts">
const tasks = useConvexQuery(api.tasks.list, {})
</script>

<template>
  <p v-if="tasks.state.status === 'pending'">Loading…</p>
  <p v-else-if="tasks.state.status === 'error'">
    {{ tasks.state.error.message }}
  </p>
  <ul v-else-if="tasks.data">
    <li v-for="task in tasks.data" :key="task._id">{{ task.title }}</li>
  </ul>
</template>
```

The derived `data`, `error`, `isLoading`, and `isStale` getters remain available
for concise templates, but they never store state independently.

Return `'skip'` from reactive arguments to stop network work:

```ts
const viewer = useConvexQuery(
  api.users.viewer,
  () => sessionReady.value ? {} : 'skip',
)
```

Use `{ keepPreviousData: true }` when an argument change should retain the old
result as `stale` until the new live value arrives.

## Writes and optimistic updates

Mutation and action composables are stable callables rather than wrappers with
their own request-status fields:

```ts
const createTask = useConvexMutation(api.tasks.create)
const summarize = useConvexAction(api.tasks.summarize)

const taskId = await createTask({ title: 'Ship the migration' })
const summary = await summarize({ taskId })
```

Keep local form submission state in the component. Convex remains responsible
for the mutation promise, optimistic query-store update, rollback, and final
server reconciliation.

## Authentication

Replace plugins that obtain `useConvexClient()` and call `setAuth` directly with
`setupConvexAuth`. Install it before any query composable runs:

```ts
setupConvexAuth(() => ({
  isLoading: session.status.value === 'loading',
  isAuthenticated: session.status.value === 'authenticated',
  fetchAccessToken: ({ forceRefreshToken }) =>
    session.getConvexToken({ forceRefreshToken }),
}))
```

In Nuxt, put this in a named plugin with `dependsOn: ['convex']`. For
authenticated SSR, also provide `serverToken`; it is evaluated within the H3
request and is never serialized to the browser. Render auth-gated queries from
`useConvexAuth().state`, which distinguishes provider loading from Convex's
confirmation of the token.

## Nuxt SSR behavior

Do not carry over a page-level `await query.suspense()` pattern. Nuxt queries
server-render by default through the module's request-owned HTTP client. Their
Convex-encoded payload value is reused during hydration, then replaced by the
browser's live subscription without a second browser HTTP query.

Use `{ server: false }` for a browser-only query. Set `convex.ssr: false` to
change the application default, and opt an individual query back in with
`{ server: true }`.

Server routes and middleware import from the server-only entry:

```ts
import { useConvexHttpClient } from '@j-boardman/convex-nuxt/server'

export default defineEventHandler(async (event) => {
  const client = await useConvexHttpClient({ event })
  return await client.query(api.tasks.list, {})
})
```

Plain Vue SSR uses `@j-boardman/convex-vue/server` and transports an explicitly
encoded `initialData` value through the host framework. Automatic payload
integration is intentionally provided only by the Nuxt adapter.

## Features that are not compatibility targets

The `#convex/*` aliases, storage scaffolding, advanced controller entry points,
Better Auth integration, and Cloudflare R2 integration exposed by some
community packages do not have compatibility shims here. File storage and auth
providers should call generated Convex functions and the public integration
contracts directly. A future ecosystem adapter should be designed and tested as
its own package rather than added as an undocumented alias.

## Recommended migration order

1. Upgrade to a supported Vue and, if applicable, Nuxt version.
2. Replace package installation and application setup.
3. Convert query rendering to the explicit state union.
4. Convert mutations and actions to typed callables.
5. Install auth before any query and add a request-scoped server token for SSR.
6. Remove manual suspense loaders and verify raw Nuxt HTML contains query data.
7. Exercise skip, reactive arguments, optimistic rollback, pagination, sign-out,
   and app unmount in the browser.
8. Remove old aliases, plugins, and direct client-auth calls only after the new
   path passes production builds and user-facing tests.

The old projects remain useful references for identifying application-specific
usage, but their undocumented behavior is not a compatibility promise.
