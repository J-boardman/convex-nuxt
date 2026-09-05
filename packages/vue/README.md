# @j-boardman/convex-vue

Vue 3 composables for Convex live queries, writes, authentication, pagination,
and connection state. This is the framework layer used by
`@j-boardman/convex-nuxt`, but it is also a complete integration for regular
Vue applications.

## Install

```sh
pnpm add @j-boardman/convex-vue convex vue
```

Install one application-owned client before mounting the app:

```ts
import { createApp } from 'vue'
import { convexVue } from '@j-boardman/convex-vue'
import App from './App.vue'

const app = createApp(App)

app.use(convexVue, {
  url: import.meta.env.VITE_CONVEX_URL,
  client: {
    expectAuth: true,
  },
})

app.mount('#app')
```

The plugin creates one browser `ConvexClient` for the Vue application and
closes it when the application unmounts. It never creates a WebSocket client
during server rendering.

The optional `client` object accepts Convex's browser transport options,
including auth-startup behavior, token-refresh leeway, logging, diagnostics,
and a custom WebSocket constructor. The `disabled` option is intentionally
excluded because this integration's browser composables require a live client.

## Queries and writes

Use generated `api.*` references so arguments and results remain end-to-end
typed:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  useConvexAction,
  useConvexMutation,
  useConvexQuery,
} from '@j-boardman/convex-vue'
import { api } from '../convex/_generated/api'

const completed = ref(false)
const tasks = useConvexQuery(
  api.tasks.list,
  () => ({ completed: completed.value }),
  { keepPreviousData: true },
)
const createTask = useConvexMutation(api.tasks.create)
const summarize = useConvexAction(api.tasks.summarize)
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

Return `'skip'` instead of arguments to suspend a query without making a
request. `keepPreviousData` exposes the previous result as `stale` while new
reactive arguments load. Query controllers unsubscribe with their Vue effect
scope; they do not close the application client.

Optimistic updates use Convex's local store and rollback behavior:

```ts
const renameTask = useConvexMutation(api.tasks.rename).withOptimisticUpdate(
  (store, args) => {
    const task = store.getQuery(api.tasks.get, { id: args.id })
    if (task) {
      store.setQuery(
        api.tasks.get,
        { id: args.id },
        { ...task, title: args.title },
      )
    }
  },
)
```

For an update that applies to one invocation, pass it with that call instead:

```ts
await renameTask({ id, title }, {
  optimisticUpdate(store, args) {
    const task = store.getQuery(api.tasks.get, { id: args.id })
    if (task) {
      store.setQuery(api.tasks.get, { id: args.id }, {
        ...task,
        title: args.title,
      })
    }
  },
})
```

The fluent and per-call forms cannot be combined on the same invocation.

## Pagination

The pagination composable omits `paginationOpts` from caller arguments and
manages the cursor chain through Convex's reactive pagination client:

```ts
const messages = useConvexPaginatedQuery(
  api.messages.list,
  { channel: 'general' },
  { initialNumItems: 20, keepPreviousData: true },
)

if (messages.state.status === 'ready') {
  messages.loadMore(20)
}
```

It exposes `pending`, `ready`, `loadingMore`, `exhausted`, `stale`, `error`, and
`skipped` states. A load requested before the live cursor chain is ready is
queued once, and an invalid cursor triggers one bounded first-page restart.

## Authentication

Configure auth before any live query is created, normally in the root
component:

```ts
setupConvexAuth(() => ({
  isLoading: session.value.status === 'loading',
  isAuthenticated: session.value.status === 'authenticated',
  fetchAccessToken: ({ forceRefreshToken }) =>
    authProvider.getToken({ forceRefreshToken }),
}))

const auth = useConvexAuth()
```

`auth.isAuthenticated` changes only after Convex confirms the browser token.
Provider token failures enter an explicit error state and are rethrown to the
Convex client. Signing out clears auth and stale callbacks cannot overwrite the
newer state.

## Connection and client access

- `useConvexClient()` returns the injected browser client and throws during
  SSR.
- `useConvexConnectionState()` returns a shallow-readonly reactive connection
  snapshot.
- `closeConvex()` explicitly tears down the current application's client, which
  is useful in tests.

These functions use Vue injection and must be called while the current Vue app
context is available.

## One-shot server calls and generic Vue SSR

Import server utilities from the separate server entry:

```ts
import { createConvexHttpClient } from '@j-boardman/convex-vue/server'

const client = createConvexHttpClient({
  url: process.env.CONVEX_URL!,
  token: requestToken,
})

const tasks = await client.query(api.tasks.list, {})
```

Generic Vue SSR has no standard request context or hydration payload. Create a
fresh HTTP client for each request, encode values with `encodeConvexSsrSeed`,
and pass the decoded result as `initialData` to the same composable on the
server and browser. A framework adapter can instead implement the contract from
`@j-boardman/convex-vue/adapter`.

If `server: true` is explicitly requested without an adapter or `initialData`,
the composable fails early instead of silently rendering a permanent loading
state. Nuxt applications should use `@j-boardman/convex-nuxt`, which automates
this transport.

## License

Apache-2.0
