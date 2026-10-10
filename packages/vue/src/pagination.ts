import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  PaginationOptions,
  PaginationResult,
} from 'convex/server'
import type { Value } from 'convex/values'
import { shallowRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useLiveQuery } from './live-query.js'
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
  validateInitialNumItems(options.initialNumItems)

  type Item = ConvexPaginatedQueryItem<Query>
  const { initialNumItems } = options
  const state = shallowRef<ConvexPaginatedQueryState<Item>>({
    status: 'pending',
    results: [],
  })
  let invalidCursorResetAvailable = true
  let liveLoadMore: ((numItems: number) => boolean) | undefined
  let queuedLoadMore: number | undefined

  const fail = (error: Error): void => {
    state.value = { status: 'error', results: state.value.results, error }
  }

  const showFirstPageLoading = (): void => {
    const previous = state.value.results
    state.value = previous.length > 0
      ? { status: 'stale', results: previous }
      : { status: 'pending', results: [] }
  }

  const publishClientResult = (result: ClientPaginationResult<Item>): void => {
    liveLoadMore = result.loadMore
    if (result.status === 'CanLoadMore' || result.status === 'Exhausted') {
      invalidCursorResetAvailable = true
    }

    if (result.status === 'LoadingFirstPage') {
      showFirstPageLoading()
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

  const lifecycle = useLiveQuery<PaginationResult<Item>>({
    args: argsInput,
    composable: 'useConvexPaginatedQuery()',
    initialData: options.initialData,
    query,
    seedArgs: args => ({
      ...args,
      paginationOpts: { cursor: null, numItems: initialNumItems },
    }),
    seedKey: `pagination:${initialNumItems}:`,
    server: options.server,
    begin(initialData, authenticationChanged) {
      invalidCursorResetAvailable = true
      liveLoadMore = undefined
      queuedLoadMore = undefined
      const previous = state.value.results
      if (initialData) {
        state.value = initialState(initialData)
      }
      else if (
        !authenticationChanged
        && options.keepPreviousData
        && previous.length > 0
      ) {
        state.value = { status: 'stale', results: previous }
      }
      else {
        state.value = { status: 'pending', results: [] }
      }
    },
    failed: fail,
    seeded(data) {
      state.value = initialState(data)
    },
    skipped() {
      liveLoadMore = undefined
      queuedLoadMore = undefined
      state.value = { status: 'skipped', results: [] }
    },
    subscribe: (client, args, live) => (
      client as typeof client & PaginatedClient
    ).onPaginatedUpdate_experimental(
      query,
      args,
      { initialNumItems },
      live((result: ClientPaginationResult<unknown>) => {
        publishClientResult(result as ClientPaginationResult<Item>)
      }),
      live((error: Error) => {
        if (isInvalidCursorError(error) && invalidCursorResetAvailable) {
          invalidCursorResetAvailable = false
          liveLoadMore = undefined
          showFirstPageLoading()
          lifecycle.resubscribe()
          return
        }
        fail(error)
      }),
    ),
  })

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
      return state.value.results
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
    stop: lifecycle.stop,
  }
}
