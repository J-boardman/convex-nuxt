import type { FunctionReference } from 'convex/server'
import { expectTypeOf } from 'vitest'
import { useConvexQuery } from '@j-boardman/convex-vue'
import type { ConvexQueryState } from '@j-boardman/convex-vue'

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

// @ts-expect-error required query arguments cannot be omitted
useConvexQuery(messagesQuery)
// @ts-expect-error generated argument fields retain their types
useConvexQuery(messagesQuery, { channel: 42 })
// @ts-expect-error only generated query references are accepted
useConvexQuery('messages:list', { channel: 'general' })
