# Shared playground backend

This private workspace package supplies one deterministic Convex backend to the
Vue and Nuxt playgrounds. Its public functions are anonymous diagnostic probes
rather than application-domain examples, so both integrations exercise the
same query, mutation, action, retry, and isolation behavior. Each surface keeps
only its newest 25 probe events.

Copy a Convex deployment's environment file into this directory, then run:

```sh
pnpm --filter @j-boardman/convex-playground-backend exec convex dev
```

The Vue and Nuxt playgrounds should point at the resulting deployment URL.
Tests use `convex-test` and do not require a deployment.
