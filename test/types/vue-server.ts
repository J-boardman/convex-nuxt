import type { ConvexHttpClient } from 'convex/browser'
import { expectTypeOf } from 'vitest'
import { createConvexHttpClient } from '@j-boardman/convex-vue/server'

const anonymousClient = createConvexHttpClient({
  url: 'https://example.convex.cloud',
})
expectTypeOf(anonymousClient).toEqualTypeOf<ConvexHttpClient>()

createConvexHttpClient({
  clientOptions: {
    fetch: globalThis.fetch,
    logger: false,
    skipConvexDeploymentUrlCheck: true,
  },
  token: 'request-token',
  url: 'https://self-hosted.example.com',
})

// @ts-expect-error auth is supplied through the request-scoped token option
createConvexHttpClient({ url: 'https://example.convex.cloud', clientOptions: { auth: 'shared' } })
