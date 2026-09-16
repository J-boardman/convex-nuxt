# Authentication adapter guide

`@j-boardman/convex-vue` does not own a user session. It adapts an existing
provider to Convex through `setupConvexAuth`, then exposes the state that the
Convex backend has confirmed through `useConvexAuth`.

This separation matters: a provider can report a signed-in session before its
token has been fetched or accepted by Convex. Application UI that gates Convex
queries should use `useConvexAuth`, not the provider's signed-in flag.

## Adapter contract

Call `setupConvexAuth` once, before any live query composable runs. Its getter
must synchronously return the provider's current reactive snapshot:

```ts
setupConvexAuth(() => ({
  isLoading: provider.isLoading.value,
  isAuthenticated: provider.isAuthenticated.value,
  fetchAccessToken: ({ forceRefreshToken }) =>
    provider.getToken({ forceRefreshToken }),
}))
```

- `isLoading` stays true until the provider knows whether a session exists.
- `isAuthenticated` describes the provider session, not Convex confirmation.
- `fetchAccessToken` returns a JWT accepted by the configured Convex auth
  provider, or `null` when the session has ended.
- `forceRefreshToken` must bypass the provider's token cache. Convex uses it
  when an expiring or rejected token needs to be replaced.

In Nuxt, authenticated server rendering also needs a request-scoped token:

```ts
setupConvexAuth(providerSnapshot, {
  serverToken: () => getTokenForCurrentRequest(),
})
```

The callback is evaluated at most once for that H3 request. It must never read
from a process-global session, and the token must not be placed in
`runtimeConfig.public`, `useState`, or a Nuxt payload. The integration sends
only an authenticated/unauthenticated seed to the browser.

## Clerk with Vue

First follow Clerk's Vue setup and Convex's Clerk backend configuration. The
Convex integration in Clerk issues a JWT named `convex`; the Convex backend
configuration uses `applicationID: "convex"`.

Install `clerkPlugin` before the Convex plugin. In the root component, adapt
Clerk before rendering children that create Convex queries:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { useAuth } from '@clerk/vue'
import {
  setupConvexAuth,
  useConvexAuth,
} from '@j-boardman/convex-vue'

const clerk = useAuth()

setupConvexAuth(() => ({
  isLoading: !clerk.isLoaded.value,
  isAuthenticated: Boolean(clerk.isSignedIn.value),
  fetchAccessToken: ({ forceRefreshToken }) => clerk.getToken.value({
    template: 'convex',
    skipCache: forceRefreshToken,
  }),
}))

const convexAuth = useConvexAuth()
</script>

<template>
  <p v-if="convexAuth.isLoading">Connecting…</p>
  <RouterView v-else />
</template>
```

Clerk documents `isLoaded`, `isSignedIn`, and `getToken` as Vue refs. Its
client-side `skipCache` option forces a fresh token, which maps directly to
Convex's refresh request.

## Clerk with Nuxt SSR

Install `@clerk/nuxt` alongside `@j-boardman/convex-nuxt`. Clerk's Nuxt module
provides the same Vue `useAuth` composable in the browser and a request-owned
auth object at `event.context.auth()` on the server.

```ts
// app/plugins/convex-auth.ts
export default defineNuxtPlugin({
  name: 'convex-auth',
  dependsOn: ['convex'],
  setup() {
    const clerk = useAuth()
    const event = useRequestEvent()

    setupConvexAuth(
      () => ({
        isLoading: !clerk.isLoaded.value,
        isAuthenticated: Boolean(clerk.isSignedIn.value),
        fetchAccessToken: ({ forceRefreshToken }) => clerk.getToken.value({
          template: 'convex',
          skipCache: forceRefreshToken,
        }),
      }),
      {
        serverToken: async () => {
          if (!event) return null
          return await event.context.auth().getToken({ template: 'convex' })
        },
      },
    )
  },
})
```

The event is captured from the current Nuxt application request; no module
singleton retains it. Clerk's `skipCache` option is client-only, so the server
request asks for the named template without that option.

The example follows the current official contracts:

- [Convex and Clerk](https://docs.convex.dev/auth/clerk)
- [Clerk Vue `useAuth`](https://clerk.com/docs/vue/reference/composables/use-auth)
- [Clerk Nuxt SDK](https://clerk.com/docs/reference/nuxt/overview)
- [Clerk token refresh](https://clerk.com/docs/guides/sessions/force-token-refresh)

Provider SDKs evolve independently. Keep the adapter small, test sign-in,
token refresh, organization or tenant switches, sign-out, SSR, and hydration,
and update only this boundary when a provider changes its API.

## Adapter checklist

Before documenting another provider as supported, prove that its adapter:

1. configures auth before the first live query;
2. maps provider loading separately from signed-in state;
3. returns a Convex-compatible JWT and honors forced refresh;
4. clears mounted authenticated queries after sign-out;
5. ignores late token callbacks from an older session;
6. obtains SSR tokens from the current request only;
7. sends no token through public config, payload data, logs, or query keys; and
8. preserves authenticated HTML through hydration until Convex confirms the
   browser token.

The repository's provider-neutral live suite proves these integration
semantics. A named provider adapter still needs its own SDK-level fixture
before it can become a separately supported package.
