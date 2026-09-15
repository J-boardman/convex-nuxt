import type {
  FunctionReference,
  PaginationOptions,
  PaginationResult,
} from 'convex/server'
import { expectTypeOf } from 'vitest'
import {
  setupConvexAuth,
  useConvexAuth,
  useConvexPaginatedQuery,
  useConvexQuery,
  useConvexQueries,
} from '@j-boardman/convex-vue'
import type {
  ConvexAuthState,
  ConvexPaginatedQueryState,
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
declare const generatedSurfaceQuery: FunctionReference<
  'query',
  'public',
  { surface: 'vue' | 'nuxt' },
  Array<{ label: string }>,
  string | undefined
>
declare const paginatedMessagesQuery: FunctionReference<
  'query',
  'public',
  { channel: string, paginationOpts: PaginationOptions },
  PaginationResult<{ body: string }>
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

const queryMap = useConvexQueries({
  messages: { query: messagesQuery, args: { channel: 'general' } },
  viewer: { query: viewerQuery, args: {} },
})
expectTypeOf(queryMap.state.messages).toEqualTypeOf<
  ConvexQueryState<string[]>
>()
expectTypeOf(queryMap.state.viewer).toEqualTypeOf<
  ConvexQueryState<{ name: string } | null>
>()
const generatedQueryMap = useConvexQueries({
  nuxt: { query: generatedSurfaceQuery, args: { surface: 'nuxt' } },
  vue: { query: generatedSurfaceQuery, args: { surface: 'vue' } },
})
expectTypeOf(generatedQueryMap.state.vue).toEqualTypeOf<
  ConvexQueryState<Array<{ label: string }>>
>()

const paginatedMessages = useConvexPaginatedQuery(
  paginatedMessagesQuery,
  { channel: 'general' },
  { initialNumItems: 10 },
)
expectTypeOf(paginatedMessages.results).toEqualTypeOf<{ body: string }[]>()
expectTypeOf(paginatedMessages.state).toEqualTypeOf<
  ConvexPaginatedQueryState<{ body: string }>
>()
useConvexPaginatedQuery(paginatedMessagesQuery, 'skip', { initialNumItems: 10 })
useConvexPaginatedQuery(
  paginatedMessagesQuery,
  { channel: 'general' },
  { initialNumItems: 10, server: false },
)

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
useConvexQueries({
  invalid: {
    query: messagesQuery,
    args: {
      // @ts-expect-error multi-query arguments retain their generated types
      channel: 42,
    },
  },
})
useConvexPaginatedQuery(
  paginatedMessagesQuery,
  // @ts-expect-error paginationOpts is managed by the composable
  { channel: 'general', paginationOpts: { cursor: null, numItems: 10 } },
  { initialNumItems: 10 },
)
// @ts-expect-error required paginated query arguments cannot be omitted
useConvexPaginatedQuery(paginatedMessagesQuery, 'not-an-args-object', {
  initialNumItems: 10,
})
