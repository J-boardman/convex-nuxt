import type { ConvexHttpClient } from 'convex/browser'
import { expectTypeOf } from 'vitest'
import {
  setConvexServerToken,
  useConvexHttpClient,
} from '@j-boardman/convex-nuxt/server'

declare const event: Parameters<typeof setConvexServerToken>[0]

setConvexServerToken(event, 'request-token')
setConvexServerToken(event, null)
setConvexServerToken(event, async () => 'lazy-request-token')

expectTypeOf(useConvexHttpClient({ event }))
  .toEqualTypeOf<Promise<ConvexHttpClient>>()
expectTypeOf(useConvexHttpClient({ event, token: null }))
  .toEqualTypeOf<Promise<ConvexHttpClient>>()

// @ts-expect-error server token providers must resolve strings or null
setConvexServerToken(event, async () => 42)
