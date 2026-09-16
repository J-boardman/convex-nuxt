# Shared playground backend

This private workspace package supplies one deterministic Convex backend to the
Vue and Nuxt playgrounds. `social.ts` backs the Relay product example with
paginated posts, desired-state reactions, bounded chat, and four fixed demo
personas. `probes.ts` remains the lower-level diagnostic contract for query,
mutation, action, retry, transaction, auth, and isolation behavior. Each
diagnostic surface keeps only its newest 25 probe events.

Relay personas are public demo actors rather than an authentication boundary.
They keep the product example approachable while the diagnostic route tests the
integration's generic auth contract. The first-party authentication direction
is Convex Auth, as described in the
[adapter guide](../../docs/auth-adapters.md).

Copy a Convex deployment's environment file into this directory, then run:

```sh
pnpm --filter @j-boardman/convex-playground-backend exec convex dev
```

The Vue and Nuxt playgrounds should point at the resulting deployment URL.
Tests use `convex-test` and do not require a deployment. `pnpm test:live`
creates a disposable local deployment, exercises both Relay apps and their
diagnostic routes, then removes it.
