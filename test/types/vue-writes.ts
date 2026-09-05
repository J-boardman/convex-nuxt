import type { FunctionReference } from 'convex/server'
import { expectTypeOf } from 'vitest'
import {
  useConvexAction,
  useConvexMutation,
} from '@j-boardman/convex-vue'

declare const createMessage: FunctionReference<
  'mutation',
  'public',
  { body: string },
  string
>
declare const clearMessages: FunctionReference<
  'mutation',
  'public',
  Record<string, never>,
  number
>
declare const summarize: FunctionReference<
  'action',
  'public',
  { channel: string },
  { summary: string }
>

const create = useConvexMutation(createMessage)
expectTypeOf(create({ body: 'hello' })).toEqualTypeOf<Promise<string>>()
create.withOptimisticUpdate((_store, args) => {
  expectTypeOf(args).toEqualTypeOf<{ body: string }>()
})
create({ body: 'one call' }, {
  optimisticUpdate: (_store, args) => {
    expectTypeOf(args).toEqualTypeOf<{ body: string }>()
  },
})

const clear = useConvexMutation(clearMessages)
expectTypeOf(clear()).toEqualTypeOf<Promise<number>>()

const runSummary = useConvexAction(summarize)
expectTypeOf(runSummary({ channel: 'general' }))
  .toEqualTypeOf<Promise<{ summary: string }>>()

// @ts-expect-error required mutation arguments cannot be omitted
create()
// @ts-expect-error mutation argument fields retain their generated types
create({ body: 42 })
// @ts-expect-error required action arguments cannot be omitted
runSummary()
// @ts-expect-error optimistic updates must be synchronous
create.withOptimisticUpdate(async () => {})
// @ts-expect-error per-call optimistic updates must be synchronous
create({ body: 'async' }, { optimisticUpdate: async () => {} })
