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
import { installConvexSsrBridge } from '../../packages/vue/src/adapter/ssr.js'
import type { ConvexSsrBridge } from '../../packages/vue/src/adapter/ssr.js'
import {
  createConvexVuePlugin,
  useConvexRuntime,
} from '../../packages/vue/src/plugin.js'
import { useConvexQuery } from '../../packages/vue/src/query.js'

type MessagesQuery = FunctionReference<
  'query',
  'public',
  { channel: string },
  string[]
>

interface Subscription {
  args: { channel: string }
  error: (error: Error) => void
  stopped: boolean
  unsubscribe: ReturnType<typeof vi.fn>
  update: (value: string[]) => void
}

interface QueryHarness {
  app: App
  client: ConvexClient
  scope: EffectScope
  subscriptions: Subscription[]
}

const messagesQuery = {} as MessagesQuery

function createHarness(): QueryHarness {
  const subscriptions: Subscription[] = []
  const client = {
    closed: false,
    close: vi.fn(async () => {}),
    onUpdate: vi.fn((
      _query: MessagesQuery,
      args: { channel: string },
      update: (value: string[]) => void,
      error: (error: Error) => void,
    ) => {
      const subscription: Subscription = {
        args,
        error,
        stopped: false,
        unsubscribe: vi.fn(() => {
          subscription.stopped = true
        }),
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

  return { app, client, scope: effectScope(), subscriptions }
}

function withinHarness<T>(harness: QueryHarness, run: () => T): T {
  return harness.app.runWithContext(() => harness.scope.run(run) as T)
}

describe('useConvexQuery', () => {
  it('moves from pending to success when a live result arrives', () => {
    const harness = createHarness()
    const result = withinHarness(harness, () =>
      useConvexQuery(messagesQuery, { channel: 'general' }),
    )

    expect(result.state).toEqual({ status: 'pending' })
    expect(harness.subscriptions[0]?.args).toEqual({ channel: 'general' })
    expect(withinHarness(harness, useConvexRuntime).querySubscriptionsStarted)
      .toBe(true)

    harness.subscriptions[0]?.update(['hello'])

    expect(result.state).toEqual({ status: 'success', data: ['hello'] })
    expect(result.data).toEqual(['hello'])
    expect(result.isLoading).toBe(false)
  })

  it('skips without subscribing and starts when reactive args appear', async () => {
    const harness = createHarness()
    const args = ref<'skip' | { channel: string }>('skip')
    const result = withinHarness(harness, () =>
      useConvexQuery(messagesQuery, args),
    )

    expect(result.state).toEqual({ status: 'skipped' })
    expect(harness.subscriptions).toHaveLength(0)

    args.value = { channel: 'general' }
    await nextTick()

    expect(result.state).toEqual({ status: 'pending' })
    expect(harness.subscriptions).toHaveLength(1)

    args.value = 'skip'
    await nextTick()

    expect(result.state).toEqual({ status: 'skipped' })
    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does not resubscribe for canonically equal Convex arguments', async () => {
    type OrderedQuery = FunctionReference<
      'query',
      'public',
      { channel: string, limit: bigint },
      string[]
    >
    const harness = createHarness()
    const args = ref({ channel: 'general', limit: 2n })

    withinHarness(harness, () =>
      useConvexQuery({} as OrderedQuery, args),
    )
    args.value = { limit: 2n, channel: 'general' }
    await nextTick()

    expect(harness.subscriptions).toHaveLength(1)
  })

  it('reports errors and recovers on a later live result', () => {
    const harness = createHarness()
    const result = withinHarness(harness, () =>
      useConvexQuery(messagesQuery, { channel: 'general' }),
    )
    const failure = new Error('query failed')

    harness.subscriptions[0]?.error(failure)
    expect(result.state).toEqual({ status: 'error', error: failure })

    harness.subscriptions[0]?.update(['recovered'])
    expect(result.state).toEqual({ status: 'success', data: ['recovered'] })
  })

  it('keeps previous data stale while changed arguments load', async () => {
    const harness = createHarness()
    const channel = ref('general')
    const result = withinHarness(harness, () =>
      useConvexQuery(
        messagesQuery,
        () => ({ channel: channel.value }),
        { keepPreviousData: true },
      ),
    )
    harness.subscriptions[0]?.update(['first'])

    channel.value = 'random'
    await nextTick()

    expect(result.state).toEqual({ status: 'stale', data: ['first'] })
    expect(result.isStale).toBe(true)
    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)

    harness.subscriptions[1]?.update(['second'])
    expect(result.state).toEqual({ status: 'success', data: ['second'] })
  })

  it('uses initial data only for the initial argument set', async () => {
    const harness = createHarness()
    const channel = ref('general')
    const result = withinHarness(harness, () =>
      useConvexQuery(
        messagesQuery,
        () => ({ channel: channel.value }),
        { initialData: ['server'] },
      ),
    )

    expect(result.state).toEqual({ status: 'success', data: ['server'] })

    channel.value = 'random'
    await nextTick()

    expect(result.state).toEqual({ status: 'pending' })
  })

  it('unsubscribes when its Vue effect scope stops', () => {
    const harness = createHarness()
    const result = withinHarness(harness, () =>
      useConvexQuery(messagesQuery, { channel: 'general' }),
    )

    harness.scope.stop()
    harness.subscriptions[0]?.update(['too late'])

    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
    expect(result.state).toEqual({ status: 'pending' })
  })

  it('uses a manual seed during SSR without constructing a browser client', () => {
    const app = createSSRApp({})
    const createClient = vi.fn()
    app.use(createConvexVuePlugin({
      createClient,
      isBrowser: () => false,
    }), { url: 'https://one.convex.cloud' })
    const scope = effectScope()

    const result = app.runWithContext(() => scope.run(() =>
      useConvexQuery(
        messagesQuery,
        { channel: 'general' },
        { initialData: ['server'] },
      ),
    ))

    expect(createClient).not.toHaveBeenCalled()
    expect(result?.state).toEqual({ status: 'success', data: ['server'] })
  })

  it('rejects explicit SSR without an adapter or manual seed', () => {
    const app = createSSRApp({})
    app.use(createConvexVuePlugin({
      createClient: vi.fn(),
      isBrowser: () => false,
    }), { url: 'https://one.convex.cloud' })
    const scope = effectScope()

    expect(() => app.runWithContext(() => scope.run(() =>
      useConvexQuery(
        messagesQuery,
        { channel: 'general' },
        { server: true },
      ),
    ))).toThrow('without a Convex SSR adapter or initialData')

    expect(() => app.runWithContext(() => scope.run(() =>
      useConvexQuery(
        messagesQuery,
        { channel: 'general' },
        { server: false },
      ),
    ))).not.toThrow()
  })

  it('preserves an adapter seed until the first live value arrives', () => {
    const harness = createHarness()
    const data = ref<string[] | undefined>(['server'])
    const error = ref<Error>()
    const pending = ref(false)
    const bridge: ConvexSsrBridge = {
      name: 'test',
      useQuerySeed: vi.fn(() => ({ data, error, pending })) as never,
    }
    installConvexSsrBridge(harness.app, bridge)
    const query = makeFunctionReference<'query', { channel: string }, string[]>(
      'messages:list',
    )

    const result = withinHarness(harness, () =>
      useConvexQuery(query, { channel: 'general' }),
    )

    expect(result.state).toEqual({ status: 'success', data: ['server'] })
    expect(harness.subscriptions).toHaveLength(1)

    harness.subscriptions[0]?.update(['live'])
    data.value = ['late server value']

    expect(result.state).toEqual({ status: 'success', data: ['live'] })
  })

  it('uses the adapter SSR default unless the query overrides it', () => {
    const harness = createHarness()
    const data = ref<string[]>()
    const error = ref<Error>()
    const pending = ref(false)
    const useQuerySeed = vi.fn(() => ({ data, error, pending })) as never
    installConvexSsrBridge(harness.app, {
      defaultServerRendering: false,
      name: 'test',
      useQuerySeed,
    })
    const query = makeFunctionReference<'query', { channel: string }, string[]>(
      'messages:list',
    )

    withinHarness(harness, () =>
      useConvexQuery(query, { channel: 'default' }),
    )
    withinHarness(harness, () =>
      useConvexQuery(query, { channel: 'override' }, { server: true }),
    )

    expect(useQuerySeed).toHaveBeenNthCalledWith(1, expect.objectContaining({
      enabled: false,
    }))
    expect(useQuerySeed).toHaveBeenNthCalledWith(2, expect.objectContaining({
      enabled: true,
    }))
  })

  it('discards an adapter seed when reactive arguments change', async () => {
    const harness = createHarness()
    const channel = ref('general')
    const data = ref<string[] | undefined>(['server'])
    const error = ref<Error>()
    const pending = ref(false)
    installConvexSsrBridge(harness.app, {
      name: 'test',
      useQuerySeed: (() => ({ data, error, pending })) as never,
    })
    const query = makeFunctionReference<'query', { channel: string }, string[]>(
      'messages:list',
    )
    const result = withinHarness(harness, () =>
      useConvexQuery(query, () => ({ channel: channel.value })),
    )

    channel.value = 'random'
    await nextTick()
    data.value = ['obsolete server value']

    expect(result.state).toEqual({ status: 'pending' })
    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce()
    expect(harness.subscriptions[1]?.args).toEqual({ channel: 'random' })
  })

  it('settles suspense from success, error, and skip states', async () => {
    const successHarness = createHarness()
    const success = withinHarness(successHarness, () =>
      useConvexQuery(messagesQuery, { channel: 'general' }),
    )
    const successPromise = success.suspense()
    successHarness.subscriptions[0]?.update(['ready'])
    await expect(successPromise).resolves.toEqual(['ready'])

    const errorHarness = createHarness()
    const failed = withinHarness(errorHarness, () =>
      useConvexQuery(messagesQuery, { channel: 'general' }),
    )
    const errorPromise = failed.suspense()
    errorHarness.subscriptions[0]?.error(new Error('nope'))
    await expect(errorPromise).rejects.toThrow('nope')

    const skipHarness = createHarness()
    const skipped = withinHarness(skipHarness, () =>
      useConvexQuery(messagesQuery, 'skip'),
    )
    await expect(skipped.suspense()).resolves.toBeUndefined()
  })
})
