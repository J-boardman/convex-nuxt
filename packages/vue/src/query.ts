import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
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

export type ConvexQuerySkip = 'skip'
export type MaybeReactive<T> = T | MaybeRefOrGetter<T>
type EmptyObject = Record<string, never>

export type ConvexQueryState<T> =
  | { status: 'skipped' }
  | { status: 'pending' }
  | { status: 'success', data: T }
  | { status: 'stale', data: T }
  | { status: 'error', error: Error, previousData?: T }

export interface UseConvexQueryOptions<T> {
  initialData?: T
  keepPreviousData?: boolean
  server?: boolean
}

export interface UseConvexQueryResult<T> {
  readonly data: T | undefined
  readonly error: Error | undefined
  readonly isLoading: boolean
  readonly isStale: boolean
  readonly state: ConvexQueryState<T>
  stop: () => void
  suspense: () => Promise<T | undefined>
}

export type ReactiveQueryArgsAndOptions<
  Query extends FunctionReference<'query'>,
  Options,
> = FunctionArgs<Query> extends EmptyObject
  ? [args?: MaybeReactive<FunctionArgs<Query> | ConvexQuerySkip>, options?: Options]
  : [args: MaybeReactive<FunctionArgs<Query> | ConvexQuerySkip>, options?: Options]

interface NormalizedArgs {
  args: Record<string, Value>
  key: string
  skipped: false
}

interface NormalizedSkip {
  skipped: true
}

interface SuspenseWaiter<T> {
  reject: (reason: Error) => void
  resolve: (value: T | undefined) => void
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

function dataFromState<T>(state: ConvexQueryState<T>): T | undefined {
  if (state.status === 'success' || state.status === 'stale') {
    return state.data
  }
  if (state.status === 'error') {
    return state.previousData
  }
  return undefined
}

function errorFromState<T>(state: ConvexQueryState<T>): Error | undefined {
  return state.status === 'error' ? state.error : undefined
}

export function useConvexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  ...args: ReactiveQueryArgsAndOptions<
    Query,
    UseConvexQueryOptions<FunctionReturnType<Query>>
  >
): UseConvexQueryResult<FunctionReturnType<Query>>
export function useConvexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  argsInput: MaybeReactive<FunctionArgs<Query> | ConvexQuerySkip> = {} as FunctionArgs<Query>,
  options: UseConvexQueryOptions<FunctionReturnType<Query>> = {},
): UseConvexQueryResult<FunctionReturnType<Query>> {
  if (typeof query === 'string') {
    throw new Error('useConvexQuery() requires a generated function reference, not a string.')
  }

  type QueryResult = FunctionReturnType<Query>
  const runtime = useConvexRuntime()
  const bridge = useConvexSsrBridge()
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
    options.server === true
    && !runtime.client
    && !bridge
    && options.initialData === undefined
    && !initialNormalized.skipped
  ) {
    throw new Error(
      'useConvexQuery() cannot server-render without a Convex SSR adapter or initialData. '
      + 'Install a framework adapter, pass initialData, or set server to false.',
    )
  }
  const seed = bridge?.useQuerySeed<QueryResult>({
    args: initialNormalized.skipped ? {} : initialNormalized.args,
    enabled: options.server !== false
      && options.initialData === undefined
      && !initialNormalized.skipped,
    key: `${getFunctionName(query)}:${initialKey ?? 'skip'}`,
    query,
  })
  const initialData = options.initialData ?? seed?.data.value
  const state = shallowRef<ConvexQueryState<QueryResult>>({ status: 'pending' })
  const waiters = new Set<SuspenseWaiter<QueryResult>>()
  let currentKey: string | undefined
  let generation = 0
  let hasStarted = false
  let stopped = false
  let seedActive = options.initialData === undefined
  let unsubscribe: (() => void) | undefined

  const publish = (nextState: ConvexQueryState<QueryResult>): void => {
    state.value = nextState
    if (nextState.status === 'success') {
      for (const waiter of waiters) {
        waiter.resolve(nextState.data)
      }
      waiters.clear()
    }
    else if (nextState.status === 'skipped') {
      for (const waiter of waiters) {
        waiter.resolve(undefined)
      }
      waiters.clear()
    }
    else if (nextState.status === 'error') {
      for (const waiter of waiters) {
        waiter.reject(nextState.error)
      }
      waiters.clear()
    }
  }

  const stopSubscription = (): void => {
    unsubscribe?.()
    unsubscribe = undefined
  }

  const stopSeedWatch = seed
    ? watch(
        [seed.data, seed.error, seed.pending],
        ([data, error, pending]) => {
          if (!seedActive || stopped) return
          if (error) {
            publish({ status: 'error', error })
          }
          else if (!pending && data !== undefined) {
            publish({ status: 'success', data })
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
        normalized = normalizeArgs(input as Record<string, Value> | ConvexQuerySkip)
      }
      catch (cause) {
        generation += 1
        currentKey = undefined
        stopSubscription()
        publish({
          status: 'error',
          error: cause instanceof Error ? cause : new Error(String(cause)),
          previousData: dataFromState(state.value),
        })
        return
      }

      if (normalized.skipped) {
        seedActive = false
        generation += 1
        currentKey = undefined
        stopSubscription()
        publish({ status: 'skipped' })
        hasStarted = true
        return
      }

      if (normalized.key === currentKey) {
        return
      }

      const previousData = dataFromState(state.value)
      if (normalized.key !== initialKey) {
        seedActive = false
      }
      generation += 1
      const subscriptionGeneration = generation
      currentKey = normalized.key
      stopSubscription()

      if (!hasStarted && initialData !== undefined) {
        publish({ status: 'success', data: initialData })
      }
      else if (options.keepPreviousData && previousData !== undefined) {
        publish({ status: 'stale', data: previousData })
      }
      else {
        publish({ status: 'pending' })
      }
      hasStarted = true

      if (!runtime.client || runtime.client.closed) {
        return
      }

      unsubscribe = runtime.client.onUpdate(
        query,
        normalized.args as FunctionArgs<Query>,
        (data) => {
          if (!stopped && subscriptionGeneration === generation) {
            seedActive = false
            publish({ status: 'success', data })
          }
        },
        (error) => {
          if (!stopped && subscriptionGeneration === generation) {
            seedActive = false
            publish({
              status: 'error',
              error,
              previousData: dataFromState(state.value),
            })
          }
        },
      )
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  const stop = (): void => {
    if (stopped) return
    stopped = true
    generation += 1
    stopSubscription()
    stopWatching()
    stopSeedWatch?.()
    const cancellation = new Error('The Convex query was stopped.')
    for (const waiter of waiters) {
      waiter.reject(cancellation)
    }
    waiters.clear()
  }

  if (getCurrentScope()) {
    onScopeDispose(stop)
  }

  const result: UseConvexQueryResult<QueryResult> = {
    get data(): QueryResult | undefined {
      return dataFromState(state.value)
    },
    get error(): Error | undefined {
      return errorFromState(state.value)
    },
    get isLoading(): boolean {
      return state.value.status === 'pending'
    },
    get isStale(): boolean {
      return state.value.status === 'stale'
    },
    get state(): ConvexQueryState<QueryResult> {
      return state.value
    },
    stop,
    suspense(): Promise<QueryResult | undefined> {
      if (state.value.status === 'success') {
        return Promise.resolve(state.value.data)
      }
      if (state.value.status === 'skipped') {
        return Promise.resolve(undefined)
      }
      if (state.value.status === 'error') {
        return Promise.reject(state.value.error)
      }
      if (stopped) {
        return Promise.reject(new Error('The Convex query was stopped.'))
      }
      return new Promise<QueryResult | undefined>((resolve, reject) => {
        waiters.add({ reject, resolve })
      })
    },
  }

  return result
}
