# This or That

A live poll built with `@j-boardman/convex-nuxt`. Every vote reaches every
open tab as it is cast. It shows the parts of the integration that are hard to
see in a small example:

- **Server rendering with a signed-in visitor.** Each visitor gets an
  anonymous session. The first HTML already shows their name and their picks;
  the browser then takes over without fetching again.
- **Optimistic updates.** The bar moves on click, before Convex replies.
- **Pagination.** "Recent votes" loads older entries on demand.
- **Under the hood.** A panel traces each query from server render to live
  updates, and lets you add latency or cut the connection to Convex. The
  network controls come from `public/network-simulator.js`, a showcase-only
  WebSocket wrapper; they are not part of the package.

## How sign-in works

`server/middleware/session.ts` gives every visitor a random session id in an
HTTP-only cookie. The server signs a one-hour ES256 token for that id
(`server/utils/session-token.ts`), which Convex verifies with the public key in
`SHOWCASE_JWKS` (`convex/auth.config.ts`). `app/plugins/convex-auth.ts` hands
both sides to `setupConvexAuth`: the browser fetches tokens from
`/api/session/token`, and server rendering signs one directly.

## Run it locally

```sh
pnpm install
pnpm dev:showcase
```

The first run asks how to set up a local Convex deployment, creates a signing
key in `showcase/.env`, gives Convex the matching public key, and seeds the
polls.

## Deploy it

1. Create a production Convex deployment and generate a key pair:

   ```sh
   cd showcase
   node scripts/keys.mjs
   ```

2. Give Convex the public key, deploy the functions, and seed the polls:

   ```sh
   npx convex env set SHOWCASE_JWKS '<SHOWCASE_JWKS from step 1>' --prod
   npx convex deploy
   npx convex run seed:polls --prod
   ```

3. Deploy the Nuxt app to any Nitro host (Vercel, Netlify, and Cloudflare
   detect it automatically) with these environment variables:

   | Variable | Value |
   | --- | --- |
   | `NUXT_PUBLIC_CONVEX_URL` | The production deployment URL |
   | `NUXT_SHOWCASE_PRIVATE_KEY` | `NUXT_SHOWCASE_PRIVATE_KEY` from step 1 |

The private key signs every visitor's token: keep it in the host's secret
settings, never in the repository. Each voter can cast 20 votes a minute, and
an hourly cron trims activity older than a day.
