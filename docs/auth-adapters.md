# Authentication adapter guide

`@j-boardman/convex-vue` does not own a user session. It adapts a session
manager to Convex through `setupConvexAuth`, then exposes the state that the
Convex backend has confirmed through `useConvexAuth`.

This separation matters: a session manager can report a signed-in session
before its token has been fetched or accepted by Convex. Application UI that
gates Convex queries should use `useConvexAuth`, not the session manager's
signed-in flag.

## Adapter contract

Call `setupConvexAuth` once, before any live query composable runs. Its getter
must synchronously return the current reactive snapshot:

```ts
setupConvexAuth(() => ({
  isLoading: session.isLoading.value,
  isAuthenticated: session.isAuthenticated.value,
  fetchAccessToken: ({ forceRefreshToken }) =>
    session.fetchAccessToken({ forceRefreshToken }),
}))
```

- `isLoading` stays true until the session manager knows whether a session
  exists.
- `isAuthenticated` describes the local session, not Convex confirmation.
- `fetchAccessToken` returns a JWT accepted by the Convex deployment, or
  `null` when the session has ended.
- `forceRefreshToken` must bypass the cached access token and rotate or refresh
  the session.

In Nuxt, authenticated server rendering also needs a request-scoped token:

```ts
setupConvexAuth(sessionSnapshot, {
  serverToken: () => getTokenForCurrentRequest(),
})
```

The callback is evaluated at most once for that H3 request. It must never read
from a process-global session, and the token must not be placed in
`runtimeConfig.public`, `useState`, or a Nuxt payload. The integration sends
only an authenticated/unauthenticated seed to the browser.

## Reference provider: Convex Auth v2

Convex Auth is the preferred first-party example. It runs inside the
application's Convex deployment and does not require a hosted identity
provider.

Convex Auth v2 is currently alpha software. Its documentation warns that the
API can change without a stable upgrade path, and its frontend-framework guide
is still marked WIP. The package must therefore remain an optional integration,
not a dependency of either core package, until its stable framework contract is
available.

The feasibility is stronger than a hypothetical design. The published
`@convex-dev/auth` 2.0 alpha exposes:

- `AuthClient` from `@convex-dev/auth/browser`, explicitly documented as a
  framework-agnostic session owner with a subscribe/snapshot API;
- SPA and SSR modes with distinct refresh-token ownership;
- `ServerAuthSession`, cookie primitives, and WHATWG request handlers from
  `@convex-dev/auth/server`; and
- React bindings implemented on those same public browser and server
  primitives.

Vue and Nuxt should adapt those primitives rather than port the React provider
or reach into an internal module.

## Plain Vue binding

For a client-rendered Vue application, bind the public `AuthClient` store to a
Vue ref and hand its state and token fetcher to `setupConvexAuth`:

```ts
import {
  AuthClient,
  defaultStorage,
} from '@convex-dev/auth/browser'
import { ConvexHttpClient } from 'convex/browser'
import { onScopeDispose, shallowRef } from 'vue'
import { setupConvexAuth } from '@j-boardman/convex-vue'
import { api } from '../convex/_generated/api'

const url = import.meta.env.VITE_CONVEX_URL
const http = new ConvexHttpClient(url)
const session = new AuthClient({
  mode: 'spa',
  authApi: {
    refreshSession: refreshToken =>
      http.mutation(api.auth.refreshSession, { refreshToken }),
    signOut: async (refreshToken) => {
      await http.mutation(api.auth.signOut, { refreshToken })
    },
  },
  storage: defaultStorage(),
  storageNamespace: url,
})

const sessionState = shallowRef(session.getSnapshot())
const unsubscribe = session.subscribe(() => {
  sessionState.value = session.getSnapshot()
})

setupConvexAuth(() => ({
  isLoading: sessionState.value.isLoading,
  isAuthenticated: sessionState.value.isAuthenticated,
  fetchAccessToken: args => session.fetchAccessToken(args),
}))

void session.init()
onScopeDispose(() => {
  unsubscribe()
  session.dispose()
})
```

The refresh client is deliberately separate from the live browser client. A
refresh can occur while the live client is paused waiting for a token, so
sending the refresh mutation over that same client would deadlock.

Password, passkey, OAuth, and anonymous sign-in flows return a session bundle
that is handed to `session.setSession`. Sign-out calls `session.signOut`. Those
small provider-facing composables should follow the corresponding Convex Auth
flow's result types; they should not duplicate token storage or refresh logic.

This is a version-pinned alpha recipe, not a support claim. Before publishing a
Vue adapter, its fixture must install the same Convex Auth build that the recipe
targets and prove initialization, sign-in, refresh, cross-tab synchronization,
sign-out, and disposal.

## Nuxt SSR binding

Nuxt uses Convex Auth's SSR mode. The refresh token stays in an HTTP-only
cookie, while browser JavaScript receives only a short-lived access token.
Three thin pieces are required:

1. Mount the `refreshHandler`, `signOutHandler`, and `convexProxyHandler` from
   `setupConvexAuthServer` as Nitro routes. H3's `toWebRequest` and
   `sendWebResponse` adapt the handlers without changing their wire format.
2. Create one `ServerAuthSession` per H3 request with a `CookieStore` backed by
   `getCookie`, `setCookie`, and `deleteCookie`. Pass `session.getToken` as the
   `serverToken` callback to `setupConvexAuth` so SSR queries use that request's
   identity.
3. In the browser, create `AuthClient` in `ssr` mode. Its refresh and sign-out
   callbacks POST to the Nitro routes, and sign-in calls go through the proxy
   route so the refresh token is moved into the HTTP-only cookie before the
   response reaches browser JavaScript.

A mounted handler has this shape:

```ts
// server/api/auth/refresh.post.ts
import { sendWebResponse, toWebRequest } from 'h3'
import { auth } from '../../utils/convex-auth'

export default defineEventHandler(async (event) => {
  const response = await auth.refreshHandler(toWebRequest(event))
  await sendWebResponse(event, response)
})
```

During hydration, initialize the browser session inside
`session.withSignInPending`: call `session.init()`, then force one refresh if no
access token was restored. That keeps the authenticated SSR seed visible until
the cookie-backed session either returns a fresh access token or confirms that
the user is signed out. No token needs to enter the Nuxt payload.

This H3 layer is feasible using public APIs, but it is not part of the current
release. It should become an optional `convex-auth` entry only after a live
fixture proves:

- username/password sign-up, sign-in, refresh, and sign-out;
- HTTP-only refresh-token storage and CSRF origin checks;
- authenticated SSR and hydration without a flash;
- two concurrent H3 requests with different sessions remain isolated;
- client navigation and mounted queries follow session changes; and
- Node and Cloudflare Module Nitro builds contain no server code in the client
  bundle.

## Why the alpha is not bundled yet

The supplied v2 documentation and the published alpha do not currently agree
on every provider result shape, which is expected during an alpha. Bundling an
adapter now would either pin consumers to one preview build or claim
compatibility that the test matrix has not proved.

For the first release, the stable public promise remains the provider-neutral
`setupConvexAuth` contract. Convex Auth is the reference implementation and the
first planned optional adapter. The adapter should be promoted only when its
exact alpha or stable version is installed in the live Vue and Nuxt fixtures.

The source material for this decision is:

- [Convex Auth v2 documentation](https://labs.convex.dev/auth)
- [Convex Auth repository](https://github.com/get-convex/convex-auth)
- [`@convex-dev/auth` on npm](https://www.npmjs.com/package/@convex-dev/auth)

## Adapter checklist

Before documenting any provider adapter as supported, prove that it:

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
semantics. A named adapter still needs its own installed SDK fixture before it
can become a supported package surface.
