import type { ConvexClient } from 'convex/browser'
import type {
  FunctionReference,
  PaginationOptions,
  PaginationResult,
} from 'convex/server'
import { makeFunctionReference } from 'convex/server'
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
import { useConvexPaginatedQuery } from '../../packages/vue/src/pagination.js'
import {
  createConvexVuePlugin,
  useConvexRuntime,
} from '../../packages/vue/src/plugin.js'

interface Message {
  body: string
  id: number
}

type MessagesQuery = FunctionReference<
  'query',
  'public',
  { channel: string, paginationOpts: PaginationOptions },
  PaginationResult<Message>
>

type ClientStatus =
  | 'LoadingFirstPage'
  | 'CanLoadMore'
  | 'LoadingMore'
  | 'Exhausted'

interface ClientResult {
  loadMore: ReturnType<typeof vi.fn<(numItems: number) => boolean>>
  results: Message[]
  status: ClientStatus
}

interface Subscription {
  args: { channel: string }
  error: (error: Error) => void
  initialNumItems: number
  stopped: boolean
  unsubscribe: ReturnType<typeof vi.fn>
  update: (result: ClientResult) => void
}

interface PaginationHarness {
  app: App
  scope: EffectScope
  subscriptions: Subscription[]
}

const messagesQuery = makeFunctionReference<
  'query',
  { channel: string, paginationOpts: PaginationOptions },
  PaginationResult<Message>
>('messages:paginated')

function createHarness(): PaginationHarness {
  const subscriptions: Subscription[] = []
  const client = {
    closed: false,
    close: vi.fn(async () => {}),
    onPaginatedUpdate_experimental: vi.fn((
      _query: MessagesQuery,
      args: { channel: string },
      options: { initialNumItems: number },
      update: (result: ClientResult) => void,
      error: (error: Error) => void,
    ) => {
      const subscription: Subscription = {
        args,
        error,
        initialNumItems: options.initialNumItems,
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

  return { app, scope: effectScope(), subscriptions }
}

function withinHarness<T>(harness: PaginationHarness, run: () => T): T {
  return harness.app.runWithContext(() => harness.scope.run(run) as T)
}

function clientResult(
  status: ClientStatus,
  results: Message[],
  loadMore = vi.fn<(numItems: number) => boolean>(() => true),
): ClientResult {
  return { loadMore, results, status }
}

describe('useConvexPaginatedQuery', () => {
  it('maps the Convex subscription into an incremental result state', () => {
    const harness = createHarness()
    const result = withinHarness(harness, () =>
      useConvexPaginatedQuery(
        messagesQuery,
        { channel: 'general' },
        { initialNumItems: 10 },
      ),
    )
    const firstPage = [{ body: 'hello', id: 1 }]
    const loadMore = vi.fn<(numItems: number) => boolean>(() => true)

    expect(result.state).toEqual({ status: 'pending', results: [] })
    expect(harness.subscriptions[0]).toMatchObject({
      args: { channel: 'general' },
      initialNumItems: 10,
    })

    harness.subscriptions[0]?.update(
      clientResult('CanLoadMore', firstPage, loadMore),
    )
    expect(result.state).toEqual({
      status: 'ready',
      results: firstPage,
      canLoadMore: true,
    })

    expect(result.loadMore(5)).toBe(true)
    expect(loadMore).toHaveBeenCalledWith(5)
    expect(result.state).toEqual({ status: 'loadingMore', results: firstPage })

    const allPages = [...firstPage, { body: 'world', id: 2 }]
    harness.subscriptions[0]?.update(clientResult('Exhausted', allPages))
    expect(result.state).toEqual({ status: 'exhausted', results: allPages })
    expect(result.results).toEqual(allPages)
  })

  it('queues an early load request until the first page is ready', () => {
    const harness = createHarness()
    const result = withinHarness(harness, () =>
      useConvexPaginatedQuery(
        messagesQuery,
        { channel: 'general' },
        { initialNumItems: 3 },
      ),
    )
    const loadMore = vi.fn<(numItems: number) => boolean>(() => true)

    expect(result.loadMore(7)).toBe(true)
    harness.subscriptions[0]?.update(
      clientResult('CanLoadMore', [{ body: 'first', id: 1 }], loadMore),
    )

    expect(loadMore).toHaveBeenCalledOnce()
    expect(loadMore).toHaveBeenCalledWith(7)
    expect(result.state.status).toBe('loadingMore')
  })

  it('keeps prior pages stale while changed arguments load', async () => {
    const harness = createHarness()
    const channel = ref('general')
    const result = withinHarness(harness, () =>
      useConvexPaginatedQuery(
        messagesQuery,
        () => ({ channel: channel.value }),
        { initialNumItems: 3, keepPreviousData: true },
      ),
    )
    const firstPage = [{ body: 'first', id: 1 }]
    harness.subscriptions[0]?.update(clientResult('CanLoadMore', firstPage))

    channel.value = 'random'
    await nextTick()

    expect(result.state).toEqual({ status: 'stale', results: firstPage })
    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce()
    expect(harness.subscriptions[1]?.args).toEqual({ channel: 'random' })

    harness.subscriptions[0]?.update(
      clientResult('Exhausted', [{ body: 'obsolete', id: 2 }]),
    )
    expect(result.results).toEqual(firstPage)
  })

  it('drops prior pages and restarts across an auth boundary', () => {
    const harness = createHarness()
    const result = withinHarness(harness, () =>
      useConvexPaginatedQuery(
        messagesQuery,
        { channel: 'general' },
        { initialNumItems: 3, keepPreviousData: true },
      ),
    )
    const firstPage = [{ body: 'signed-in', id: 1 }]
    harness.subscriptions[0]?.update(clientResult('Exhausted', firstPage))

    withinHarness(harness, useConvexRuntime).authEpoch.value += 1

    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce()
    expect(harness.subscriptions).toHaveLength(2)
    expect(result.state).toEqual({ status: 'pending', results: [] })

    harness.subscriptions[0]?.update(
      clientResult('Exhausted', [{ body: 'obsolete', id: 2 }]),
    )
    expect(result.results).toEqual([])
  })

  it('restarts once when Convex rejects a pagination cursor', () => {
    const harness = createHarness()
    const result = withinHarness(harness, () =>
      useConvexPaginatedQuery(
        messagesQuery,
        { channel: 'general' },
        { initialNumItems: 3 },
      ),
    )
    const firstPage = [{ body: 'first', id: 1 }]
    harness.subscriptions[0]?.update(clientResult('CanLoadMore', firstPage))
    result.loadMore(3)

    harness.subscriptions[0]?.error(new Error('InvalidCursor'))

    expect(harness.subscriptions).toHaveLength(2)
    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce()
    expect(result.state).toEqual({ status: 'stale', results: firstPage })

    const repeatedFailure = new Error('InvalidCursor again')
    harness.subscriptions[1]?.error(repeatedFailure)

    expect(harness.subscriptions).toHaveLength(2)
    expect(result.state).toEqual({
      status: 'error',
      results: firstPage,
      error: repeatedFailure,
    })
  })

  it('skips subscriptions and cleans up its Vue effect scope', async () => {
    const harness = createHarness()
    const args = ref<'skip' | { channel: string }>('skip')
    const result = withinHarness(harness, () =>
      useConvexPaginatedQuery(
        messagesQuery,
        args,
        { initialNumItems: 3 },
      ),
    )

    expect(result.state).toEqual({ status: 'skipped', results: [] })
    expect(harness.subscriptions).toHaveLength(0)

    args.value = { channel: 'general' }
    await nextTick()
    harness.scope.stop()

    expect(harness.subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce()
  })

  it('rejects invalid page sizes before subscribing', () => {
    const harness = createHarness()

    expect(() => withinHarness(harness, () =>
      useConvexPaginatedQuery(
        messagesQuery,
        { channel: 'general' },
        { initialNumItems: 0 },
      ),
    )).toThrow('positive integer')
    expect(harness.subscriptions).toHaveLength(0)
  })

  it('preserves an SSR page until the live subscription takes ownership', () => {
    const harness = createHarness()
    const serverPage = {
      continueCursor: 'server-cursor',
      isDone: false,
      page: [{ body: 'server', id: 1 }],
    }
    const data = ref<PaginationResult<Message> | undefined>(serverPage)
    const error = ref<Error>()
    const pending = ref(false)
    const bridge: ConvexSsrBridge = {
      name: 'test',
      useQuerySeed: vi.fn(() => ({ data, error, pending })) as never,
    }
    installConvexSsrBridge(harness.app, bridge)

    const result = withinHarness(harness, () =>
      useConvexPaginatedQuery(
        messagesQuery,
        { channel: 'general' },
        { initialNumItems: 3 },
      ),
    )

    expect(result.state).toEqual({
      status: 'ready',
      results: serverPage.page,
      canLoadMore: true,
    })
    expect(bridge.useQuerySeed).toHaveBeenCalledWith(expect.objectContaining({
      args: {
        channel: 'general',
        paginationOpts: { cursor: null, numItems: 3 },
      },
      enabled: true,
    }))

    const loadMore = vi.fn<(numItems: number) => boolean>(() => true)
    expect(result.loadMore(4)).toBe(true)
    expect(loadMore).not.toHaveBeenCalled()

    harness.subscriptions[0]?.update(
      clientResult('CanLoadMore', serverPage.page, loadMore),
    )
    expect(loadMore).toHaveBeenCalledWith(4)
    expect(result.state).toEqual({
      status: 'loadingMore',
      results: serverPage.page,
    })

    harness.subscriptions[0]?.update(
      clientResult('Exhausted', [{ body: 'live', id: 2 }]),
    )
    data.value = {
      continueCursor: 'late',
      isDone: true,
      page: [{ body: 'obsolete', id: 3 }],
    }

    expect(result.state).toEqual({
      status: 'exhausted',
      results: [{ body: 'live', id: 2 }],
    })
  })

  it('rejects explicit paginated SSR without a hydration strategy', () => {
    const app = createSSRApp({})
    app.use(createConvexVuePlugin({
      createClient: vi.fn(),
      isBrowser: () => false,
    }), { url: 'https://one.convex.cloud' })
    const scope = effectScope()

    expect(() => app.runWithContext(() => scope.run(() =>
      useConvexPaginatedQuery(
        messagesQuery,
        { channel: 'general' },
        { initialNumItems: 3, server: true },
      ),
    ))).toThrow('without a Convex SSR adapter or initialData')

    const initialData: PaginationResult<Message> = {
      continueCursor: 'done',
      isDone: true,
      page: [],
    }
    expect(() => app.runWithContext(() => scope.run(() =>
      useConvexPaginatedQuery(
        messagesQuery,
        { channel: 'general' },
        { initialData, initialNumItems: 3, server: true },
      ),
    ))).not.toThrow()
  })
})
