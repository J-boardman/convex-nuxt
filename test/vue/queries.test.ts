import type { ConvexClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import type { FunctionReference } from 'convex/server'
import {
  createSSRApp,
  effectScope,
  nextTick,
  ref,
} from 'vue'
import type { App, EffectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createConvexVuePlugin,
  useConvexRuntime,
} from '../../packages/vue/src/plugin.js'
import { useConvexQueries } from '../../packages/vue/src/queries.js'

type MessagesQuery = FunctionReference<
  'query',
  'public',
  { channel: string },
  string[]
>

interface Subscription {
  args: { channel: string }
  error: (error: Error) => void
  query: MessagesQuery
  unsubscribe: ReturnType<typeof vi.fn>
  update: (value: string[]) => void
}

interface QueryHarness {
  app: App
  scope: EffectScope
  subscriptions: Subscription[]
}

const messagesQuery = makeFunctionReference<
  'query',
  { channel: string },
  string[]
>('messages:list')

function createHarness(): QueryHarness {
  const subscriptions: Subscription[] = []
  const client = {
    closed: false,
    close: vi.fn(async () => {}),
    onUpdate: vi.fn((
      query: MessagesQuery,
      args: { channel: string },
      update: (value: string[]) => void,
      error: (failure: Error) => void,
    ) => {
      const subscription: Subscription = {
        args,
        error,
        query,
        unsubscribe: vi.fn(),
        update,
      }
      subscriptions.push(subscription)
      return subscription.unsubscribe
    }),
  } as unknown as ConvexClient
  const app = createSSRApp({})
  app.use(createConvexVuePlugin({
    createClient: () => client,
    isBrowser: () => true,
  }), { url: 'https://one.convex.cloud' })

  return { app, scope: effectScope(), subscriptions }
}

function withinHarness<T>(harness: QueryHarness, run: () => T): T {
  return harness.app.runWithContext(() => harness.scope.run(run) as T)
}

describe('useConvexQueries', () => {
  it('publishes results from one callback turn as one snapshot', async () => {
    const harness = createHarness()
    const result = withinHarness(harness, () => useConvexQueries({
      general: { query: messagesQuery, args: { channel: 'general' } },
      random: { query: messagesQuery, args: { channel: 'random' } },
    }))
    const initialSnapshot = result.state

    harness.subscriptions[0]?.update(['one'])
    harness.subscriptions[1]?.update(['two'])

    expect(result.state).toBe(initialSnapshot)
    await Promise.resolve()
    expect(result.state).not.toBe(initialSnapshot)
    expect(result.state).toEqual({
      general: { status: 'success', data: ['one'] },
      random: { status: 'success', data: ['two'] },
    })
  })

  it('reconciles changed, added, and removed requests', async () => {
    const harness = createHarness()
    const requests = ref({
      first: { query: messagesQuery, args: { channel: 'general' } },
    } as Record<string, {
      query: MessagesQuery
      args: { channel: string }
    }>)
    const result = withinHarness(harness, () => useConvexQueries(requests))

    requests.value = {
      first: { query: messagesQuery, args: { channel: 'random' } },
      second: { query: messagesQuery, args: { channel: 'support' } },
    }
    await nextTick()

    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce()
    expect(harness.subscriptions.slice(1).map(({ args }) => args.channel))
      .toEqual(['random', 'support'])
    expect(Object.keys(result.state)).toEqual(['first', 'second'])

    requests.value = {
      second: { query: messagesQuery, args: { channel: 'support' } },
    }
    await nextTick()

    expect(harness.subscriptions[1]?.unsubscribe).toHaveBeenCalledOnce()
    expect(Object.keys(result.state)).toEqual(['second'])
  })

  it('keeps errors per query and recovers on a later value', async () => {
    const harness = createHarness()
    const result = withinHarness(harness, () => useConvexQueries({
      general: { query: messagesQuery, args: { channel: 'general' } },
    }))
    const failure = new Error('query failed')

    harness.subscriptions[0]?.error(failure)
    await Promise.resolve()
    expect(result.state.general).toEqual({ status: 'error', error: failure })

    harness.subscriptions[0]?.update(['recovered'])
    await Promise.resolve()
    expect(result.state.general).toEqual({
      status: 'success',
      data: ['recovered'],
    })
  })

  it('disposes every active subscription with its Vue scope', () => {
    const harness = createHarness()
    withinHarness(harness, () => useConvexQueries({
      general: { query: messagesQuery, args: { channel: 'general' } },
      random: { query: messagesQuery, args: { channel: 'random' } },
    }))

    expect(withinHarness(harness, useConvexRuntime).querySubscriptionsStarted)
      .toBe(true)
    harness.scope.stop()

    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce()
    expect(harness.subscriptions[1]?.unsubscribe).toHaveBeenCalledOnce()
  })
})
