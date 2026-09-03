import type { FunctionReference } from 'convex/server'
import { expectTypeOf } from 'vitest'
import {
  setupConvexAuth,
  useConvexAuth,
  useConvexQuery,
} from '@j-boardman/convex-vue'
import type {
  ConvexAuthState,
  ConvexQueryState,
} from '@j-boardman/convex-vue'

declare const messagesQuery: FunctionReference<
  'query',
  'public',
  { channel: string },
  string[]
>
declare const viewerQuery: FunctionReference<
  'query',
  'public',
  Record<string, never>,
  { name: string } | null
>

const messages = useConvexQuery(messagesQuery, { channel: 'general' })
expectTypeOf(messages.data).toEqualTypeOf<string[] | undefined>()
expectTypeOf(messages.state).toEqualTypeOf<ConvexQueryState<string[]>>()

useConvexQuery(messagesQuery, 'skip')
useConvexQuery(
  messagesQuery,
  () => ({ channel: 'general' }),
  { server: true },
)
useConvexQuery(viewerQuery)
useConvexQuery(viewerQuery, 'skip')

setupConvexAuth(() => ({
  fetchAccessToken: async ({ forceRefreshToken }) =>
    forceRefreshToken ? 'fresh-token' : 'token',
  isAuthenticated: true,
  isLoading: false,
}))
expectTypeOf(useConvexAuth().state).toEqualTypeOf<ConvexAuthState>()

// @ts-expect-error required query arguments cannot be omitted
useConvexQuery(messagesQuery)
// @ts-expect-error generated argument fields retain their types
useConvexQuery(messagesQuery, { channel: 42 })
// @ts-expect-error only generated query references are accepted
useConvexQuery('messages:list', { channel: 'general' })
