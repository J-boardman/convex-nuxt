import type { AuthConfig } from 'convex/server'

// The Nuxt server signs a token for each anonymous session; see
// server/utils/session-token.ts. Convex refuses to push without SHOWCASE_JWKS,
// so a deployment can never end up trusting no one by accident.
export default {
  providers: [{
    type: 'customJwt',
    algorithm: 'ES256',
    applicationID: 'convex-nuxt-showcase',
    issuer: 'https://showcase.convex-nuxt.local',
    jwks: process.env.SHOWCASE_JWKS!,
  }],
} satisfies AuthConfig
