# @j-boardman/convex-nuxt

A Nuxt module that installs `@j-boardman/convex-vue` and adds Nuxt-native
server rendering, payload hydration, auto-imports, and request-scoped
authentication.

## Install

```sh
pnpm add @j-boardman/convex-nuxt convex
```

Configure the module with your public Convex deployment URL:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@j-boardman/convex-nuxt'],
  convex: {
    url: process.env.NUXT_PUBLIC_CONVEX_URL,
  },
})
```

The conventional environment variable also maps to the module's public runtime
config:

```sh
NUXT_PUBLIC_CONVEX_URL=https://example.convex.cloud
```

The URL is public by design. Authentication tokens are request-scoped and are
never stored in public runtime config.

## Use in pages and components

The module auto-imports the shared Vue composables:

```vue
<script setup lang="ts">
import { api } from '~/convex/_generated/api'

const tasks = useConvexQuery(api.tasks.list, {})
const createTask = useConvexMutation(api.tasks.create)
const summarize = useConvexAction(api.tasks.summarize)

const messages = useConvexPaginatedQuery(
  api.messages.list,
  { channel: 'general' },
  { initialNumItems: 20 },
)
</script>
```

Available auto-imports are `useConvexQuery`, `useConvexPaginatedQuery`,
`useConvexMutation`, `useConvexAction`, `setupConvexAuth`, `useConvexAuth`,
`useConvexClient`, `useConvexConnectionState`, and `closeConvex`.

Set `convex.autoImports` to `false` to disable them, then import from
`@j-boardman/convex-nuxt/runtime` explicitly.

## SSR and hydration

Queries server-render by default. The module:

1. runs the first query or paginated page through a request-owned
   `ConvexHttpClient`;
2. serializes the result through Convex's value codec into an opaque Nuxt
   payload key;
3. renders the result into HTML;
4. reuses that payload during hydration without repeating the HTTP query; and
5. keeps the value visible until the browser's live subscription takes over.

Set `{ server: false }` on a query or paginated query when its first value must
be browser-only. Client-side navigation talks directly to the authenticated
Convex browser client rather than routing reads through a Nitro endpoint.

## Authenticated SSR

Create an application plugin that runs after the module's `convex` plugin:

```ts
// app/plugins/convex-auth.ts
export default defineNuxtPlugin({
  name: 'convex-auth',
  dependsOn: ['convex'],
  setup() {
    const session = useSession()

    setupConvexAuth(
      () => ({
        isLoading: session.status.value === 'loading',
        isAuthenticated: session.status.value === 'authenticated',
        fetchAccessToken: ({ forceRefreshToken }) =>
          session.getConvexToken({ forceRefreshToken }),
      }),
      {
        serverToken: () => session.getServerConvexToken(),
      },
    )
  },
})
```

The server token getter is evaluated at most once for the current H3 request.
SSR queries inherit that token, while the Nuxt payload receives only the
boolean authenticated state. On hydration, this state remains visible until
the browser provider settles and Convex confirms the new token.

Auth must be configured before page queries begin. Late setup throws with a
targeted message instead of allowing an unauthenticated subscription race.

## Server routes and middleware

Server-only helpers live in a separate export:

```ts
import {
  setConvexServerToken,
  useConvexHttpClient,
} from '@j-boardman/convex-nuxt/server'

export default defineEventHandler(async (event) => {
  setConvexServerToken(event, () => getTokenFromRequest(event))
  const client = await useConvexHttpClient({ event })
  return await client.query(api.viewer.get, {})
})
```

An explicit `token` passed to `useConvexHttpClient` overrides the token stored
on the request. Each operation gets a fresh HTTP client; concurrent requests
cannot share authentication.

## Module options

```ts
interface ModuleOptions {
  url?: string
  autoImports?: boolean // default: true
  client?: {
    skipConvexDeploymentUrlCheck?: boolean
    unsavedChangesWarning?: boolean
  }
}
```

Only JSON-serializable browser options belong in Nuxt config. Use the server
entry for one-shot server operations and the runtime entry for explicit browser
imports.

## Plain Vue applications

Regular Vue applications are supported by the shared package, not by importing
the Nuxt module without Nuxt. Install `@j-boardman/convex-vue` and use the same
query, write, auth, pagination, connection, and teardown contracts. Only Nuxt's
auto-imports, runtime config, H3 helpers, and automatic payload bridge are
Nuxt-specific.

## License

Apache-2.0
