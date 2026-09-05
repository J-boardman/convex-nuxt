import type { ConvexClient } from 'convex/browser'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  PaginationOptions,
  PaginationResult,
} from 'convex/server'
import { getFunctionName } from 'convex/server'
import { convexToJson, jsonToConvex } from 'convex/values'
import type { Value } from 'convex/values'
import {
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useConvexSsrBridge } from './adapter/ssr.js'
import { useConvexRuntime } from './plugin.js'
import type { ConvexQuerySkip } from './query.js'

export type ConvexPaginatedQueryReference = FunctionReference<
  'query',
  'public',
  { paginationOpts: PaginationOptions },
  PaginationResult<unknown>
>

export type ConvexPaginatedQueryArgs<
  Query extends ConvexPaginatedQueryReference,
> = Omit<FunctionArgs<Query>, 'paginationOpts'>

export type ConvexPaginatedQueryItem<
  Query extends ConvexPaginatedQueryReference,
> = FunctionReturnType<Query>['page'][number]

export type ConvexPaginatedQueryState<T> =
  | { status: 'skipped', results: [] }
  | { status: 'pending', results: [] }
  | { status: 'ready', results: T[], canLoadMore: true }
  | { status: 'loadingMore', results: T[] }
  | { status: 'exhausted', results: T[] }
  | { status: 'stale', results: T[] }
  | { status: 'error', results: T[], error: Error }

export interface UseConvexPaginatedQueryOptions<T> {
  initialData?: PaginationResult<T>
  initialNumItems: number
  keepPreviousData?: boolean
  server?: boolean
}

export interface UseConvexPaginatedQueryResult<T> {
  readonly error: Error | undefined
  readonly isLoading: boolean
  readonly isStale: boolean
  readonly results: T[]
  readonly state: ConvexPaginatedQueryState<T>
  loadMore: (numItems: number) => boolean
  stop: () => void
}

type ClientPaginationStatus =
  | 'LoadingFirstPage'
  | 'CanLoadMore'
  | 'LoadingMore'
  | 'Exhausted'

interface ClientPaginationResult<T> {
  loadMore: (numItems: number) => boolean
  results: T[]
  status: ClientPaginationStatus
}

interface PaginatedClient {
  onPaginatedUpdate_experimental: (
    query: FunctionReference<'query'>,
    args: Record<string, Value>,
    options: { initialNumItems: number },
    update: (result: ClientPaginationResult<unknown>) => void,
    onError: (error: Error) => void,
  ) => () => void
}

interface NormalizedArgs {
  args: Record<string, Value>
  key: string
  skipped: false
}

interface NormalizedSkip {
  skipped: true
}

function normalizeArgs(input: Record<string, Value> | ConvexQuerySkip): NormalizedArgs | NormalizedSkip {
  if (input === 'skip') {
    return { skipped: true }
  }
  const encoded = convexToJson(input)
  return {
    args: jsonToConvex(encoded) as Record<string, Value>,
    key: JSON.stringify(encoded),
    skipped: false,
  }
}

function resultsFromState<T>(state: ConvexPaginatedQueryState<T>): T[] {
  return state.results
}

function initialState<T>(
  data: PaginationResult<T> | undefined,
): ConvexPaginatedQueryState<T> {
  if (!data) return { status: 'pending', results: [] }
  if (data.isDone) return { status: 'exhausted', results: data.page }
  return { status: 'ready', results: data.page, canLoadMore: true }
}

function isInvalidCursorError(error: Error): boolean {
  if (error.message.includes('InvalidCursor')) return true
  const data = (error as Error & { data?: unknown }).data
  return typeof data === 'object'
    && data !== null
    && 'paginationError' in data
    && data.paginationError === 'InvalidCursor'
}

function validateInitialNumItems(initialNumItems: number): void {
  if (!Number.isInteger(initialNumItems) || initialNumItems <= 0) {
    throw new Error(
      `useConvexPaginatedQuery() requires initialNumItems to be a positive integer. Received ${initialNumItems}.`,
    )
  }
}

export function useConvexPaginatedQuery<
  Query extends ConvexPaginatedQueryReference,
>(
  query: Query,
  argsInput: MaybeRefOrGetter<ConvexPaginatedQueryArgs<Query> | ConvexQuerySkip>,
  options: UseConvexPaginatedQueryOptions<ConvexPaginatedQueryItem<Query>>,
): UseConvexPaginatedQueryResult<ConvexPaginatedQueryItem<Query>> {
  if (typeof query === 'string') {
    throw new Error(
      'useConvexPaginatedQuery() requires a generated function reference, not a string.',
    )
  }
  validateInitialNumItems(options.initialNumItems)

  type Item = ConvexPaginatedQueryItem<Query>
  const runtime = useConvexRuntime()
  const bridge = useConvexSsrBridge()
  const serverRendering = options.server
    ?? (bridge ? bridge.defaultServerRendering ?? true : false)
  let initialNormalized: NormalizedArgs | NormalizedSkip
  try {
    initialNormalized = normalizeArgs(
      toValue(argsInput) as Record<string, Value> | ConvexQuerySkip,
    )
  }
  catch {
    initialNormalized = { skipped: true }
  }
  const initialKey = initialNormalized.skipped
    ? undefined
    : initialNormalized.key
  if (
    serverRendering
    && !runtime.client
    && !bridge
    && options.initialData === undefined
    && !initialNormalized.skipped
  ) {
    throw new Error(
      'useConvexPaginatedQuery() cannot server-render without a Convex SSR adapter or initialData. '
      + 'Install a framework adapter, pass initialData, or set server to false.',
    )
  }
  const seed = bridge?.useQuerySeed<PaginationResult<Item>>({
    args: initialNormalized.skipped
      ? {}
      : {
          ...initialNormalized.args,
          paginationOpts: {
            cursor: null,
            numItems: options.initialNumItems,
          },
        },
    enabled: serverRendering
      && options.initialData === undefined
      && !initialNormalized.skipped,
    key: `${getFunctionName(query)}:pagination:${options.initialNumItems}:${initialKey ?? 'skip'}`,
    query,
  })
  const seededData = options.initialData ?? seed?.data.value
  const state = shallowRef<ConvexPaginatedQueryState<Item>>(
    initialState(seededData),
  )
  let currentKey: string | undefined
  let generation = 0
  let hasStarted = false
  let invalidCursorResetAvailable = true
  let seedActive = options.initialData === undefined
  let stopped = false
  let unsubscribe: (() => void) | undefined
  let liveLoadMore: ((numItems: number) => boolean) | undefined
  let queuedLoadMore: number | undefined

  const stopSubscription = (): void => {
    unsubscribe?.()
    unsubscribe = undefined
    liveLoadMore = undefined
  }

  const publishClientResult = (
    result: ClientPaginationResult<Item>,
  ): void => {
    seedActive = false
    liveLoadMore = result.loadMore
    if (result.status === 'CanLoadMore' || result.status === 'Exhausted') {
      invalidCursorResetAvailable = true
    }

    if (result.status === 'LoadingFirstPage') {
      const previous = resultsFromState(state.value)
      state.value = previous.length > 0
        ? { status: 'stale', results: previous }
        : { status: 'pending', results: [] }
    }
    else if (result.status === 'CanLoadMore') {
      state.value = { status: 'ready', results: result.results, canLoadMore: true }
    }
    else if (result.status === 'LoadingMore') {
      state.value = { status: 'loadingMore', results: result.results }
    }
    else {
      state.value = { status: 'exhausted', results: result.results }
    }

    if (queuedLoadMore !== undefined && result.status === 'CanLoadMore') {
      const numItems = queuedLoadMore
      queuedLoadMore = undefined
      if (result.loadMore(numItems)) {
        state.value = { status: 'loadingMore', results: result.results }
      }
    }
  }

  const subscribe = (normalized: NormalizedArgs): void => {
    if (!runtime.client || runtime.client.closed) return
    runtime.querySubscriptionsStarted = true
    generation += 1
    const subscriptionGeneration = generation
    const client = runtime.client as ConvexClient & PaginatedClient
    unsubscribe = client.onPaginatedUpdate_experimental(
      query,
      normalized.args,
      { initialNumItems: options.initialNumItems },
      (result) => {
        if (!stopped && subscriptionGeneration === generation) {
          publishClientResult(result as ClientPaginationResult<Item>)
        }
      },
      (error) => {
        if (stopped || subscriptionGeneration !== generation) return
        seedActive = false
        if (isInvalidCursorError(error) && invalidCursorResetAvailable) {
          invalidCursorResetAvailable = false
          const previous = resultsFromState(state.value)
          stopSubscription()
          state.value = previous.length > 0
            ? { status: 'stale', results: previous }
            : { status: 'pending', results: [] }
          subscribe(normalized)
          return
        }
        state.value = {
          status: 'error',
          results: resultsFromState(state.value),
          error,
        }
      },
    )
  }

  const stopSeedWatch = seed
    ? watch(
        [seed.data, seed.error, seed.pending],
        ([data, error, pending]) => {
          if (!seedActive || stopped) return
          if (error) {
            state.value = {
              status: 'error',
              results: resultsFromState(state.value),
              error,
            }
          }
          else if (!pending && data) {
            state.value = initialState(data)
          }
        },
        { immediate: true, flush: 'sync' },
      )
    : undefined

  const stopWatching = watch(
    () => toValue(argsInput),
    (input) => {
      if (stopped) return

      let normalized: NormalizedArgs | NormalizedSkip
      try {
        normalized = normalizeArgs(
          input as Record<string, Value> | ConvexQuerySkip,
        )
      }
      catch (cause) {
        generation += 1
        currentKey = undefined
        stopSubscription()
        state.value = {
          status: 'error',
          results: resultsFromState(state.value),
          error: cause instanceof Error ? cause : new Error(String(cause)),
        }
        return
      }

      if (normalized.skipped) {
        seedActive = false
        generation += 1
        currentKey = undefined
        queuedLoadMore = undefined
        stopSubscription()
        state.value = { status: 'skipped', results: [] }
        hasStarted = true
        return
      }
      if (normalized.key === currentKey) return

      const previous = resultsFromState(state.value)
      if (normalized.key !== initialKey) {
        seedActive = false
      }
      generation += 1
      currentKey = normalized.key
      queuedLoadMore = undefined
      invalidCursorResetAvailable = true
      stopSubscription()

      if (!hasStarted && seededData) {
        state.value = initialState(seededData)
      }
      else if (options.keepPreviousData && previous.length > 0) {
        state.value = { status: 'stale', results: previous }
      }
      else {
        state.value = { status: 'pending', results: [] }
      }
      hasStarted = true
      subscribe(normalized)
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  const stop = (): void => {
    if (stopped) return
    stopped = true
    generation += 1
    queuedLoadMore = undefined
    stopSubscription()
    stopWatching()
    stopSeedWatch?.()
  }

  if (getCurrentScope()) {
    onScopeDispose(stop)
  }

  return {
    get error(): Error | undefined {
      return state.value.status === 'error' ? state.value.error : undefined
    },
    get isLoading(): boolean {
      return state.value.status === 'pending'
        || state.value.status === 'loadingMore'
    },
    get isStale(): boolean {
      return state.value.status === 'stale'
    },
    get results(): Item[] {
      return resultsFromState(state.value)
    },
    get state(): ConvexPaginatedQueryState<Item> {
      return state.value
    },
    loadMore(numItems: number): boolean {
      if (!Number.isInteger(numItems) || numItems <= 0) {
        throw new Error(
          `loadMore() requires a positive integer. Received ${numItems}.`,
        )
      }
      if (
        state.value.status === 'pending'
        || state.value.status === 'stale'
        || (state.value.status === 'ready' && !liveLoadMore)
      ) {
        queuedLoadMore = numItems
        return true
      }
      if (state.value.status !== 'ready' || !liveLoadMore) return false
      const accepted = liveLoadMore(numItems)
      if (accepted) {
        state.value = { status: 'loadingMore', results: state.value.results }
      }
      return accepted
    },
    stop,
  }
}
