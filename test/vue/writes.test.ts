import type { ConvexClient, OptimisticUpdate } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import { createSSRApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createConvexVuePlugin } from '../../packages/vue/src/plugin.js'
import {
  useConvexAction,
  useConvexMutation,
} from '../../packages/vue/src/writes.js'

type CreateMessage = FunctionReference<
  'mutation',
  'public',
  { body: string },
  string
>
type GenerateSummary = FunctionReference<
  'action',
  'public',
  { channel: string },
  { summary: string }
>

const createMessage = {} as CreateMessage
const generateSummary = {} as GenerateSummary

function createHarness() {
  const mutation = vi.fn(async () => 'message-id')
  const action = vi.fn(async () => ({ summary: 'ready' }))
  const client = {
    action,
    closed: false,
    close: vi.fn(async () => {}),
    mutation,
  } as unknown as ConvexClient
  const app = createSSRApp({})
  app.use(createConvexVuePlugin({
    createClient: () => client,
    isBrowser: () => true,
  }), { url: 'https://one.convex.cloud' })

  return { action, app, mutation }
}

describe('Convex writes', () => {
  it('executes a typed mutation through the application client', async () => {
    const harness = createHarness()
    const mutate = harness.app.runWithContext(() =>
      useConvexMutation(createMessage),
    )

    await expect(mutate({ body: 'hello' })).resolves.toBe('message-id')
    expect(harness.mutation).toHaveBeenCalledWith(
      createMessage,
      { body: 'hello' },
      { optimisticUpdate: undefined },
    )
  })

  it('passes optimistic updates to Convex for rollback and replay', async () => {
    const harness = createHarness()
    const optimisticUpdate = vi.fn() as OptimisticUpdate<{ body: string }>
    const mutate = harness.app.runWithContext(() =>
      useConvexMutation(createMessage).withOptimisticUpdate(optimisticUpdate),
    )

    await mutate({ body: 'optimistic' })

    expect(harness.mutation).toHaveBeenCalledWith(
      createMessage,
      { body: 'optimistic' },
      { optimisticUpdate },
    )
  })

  it('accepts an optimistic update for one mutation call', async () => {
    const harness = createHarness()
    const optimisticUpdate = vi.fn() as OptimisticUpdate<{ body: string }>
    const mutate = harness.app.runWithContext(() =>
      useConvexMutation(createMessage),
    )

    await mutate({ body: 'one call' }, { optimisticUpdate })

    expect(harness.mutation).toHaveBeenCalledWith(
      createMessage,
      { body: 'one call' },
      { optimisticUpdate },
    )
  })

  it('rejects combining fluent and per-call optimistic updates', () => {
    const harness = createHarness()
    const mutate = harness.app.runWithContext(() =>
      useConvexMutation(createMessage).withOptimisticUpdate(() => {}),
    )

    expect(() => mutate(
      { body: 'ambiguous' },
      { optimisticUpdate: () => {} },
    )).toThrow('already has an optimistic update')
    expect(harness.mutation).not.toHaveBeenCalled()
  })

  it('rejects configuring a second optimistic update', () => {
    const harness = createHarness()
    const mutate = harness.app.runWithContext(() =>
      useConvexMutation(createMessage).withOptimisticUpdate(() => {}),
    )

    expect(() => mutate.withOptimisticUpdate(() => {})).toThrow(
      'already has an optimistic update',
    )
  })

  it('executes a typed action through the application client', async () => {
    const harness = createHarness()
    const act = harness.app.runWithContext(() =>
      useConvexAction(generateSummary),
    )

    await expect(act({ channel: 'general' })).resolves.toEqual({ summary: 'ready' })
    expect(harness.action).toHaveBeenCalledWith(
      generateSummary,
      { channel: 'general' },
    )
  })

  it('rejects string function names before sending a write', () => {
    const harness = createHarness()

    expect(() => harness.app.runWithContext(() =>
      useConvexMutation('messages:create' as unknown as CreateMessage),
    )).toThrow('requires a generated function reference')
    expect(() => harness.app.runWithContext(() =>
      useConvexAction('messages:summary' as unknown as GenerateSummary),
    )).toThrow('requires a generated function reference')
  })
})
