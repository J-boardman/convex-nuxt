import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'
import { shallowRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useLiveQuery } from './live-query.js'

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
}

export type ReactiveQueryArgsAndOptions<
  Query extends FunctionReference<'query'>,
  Options,
> = FunctionArgs<Query> extends EmptyObject
  ? [args?: MaybeReactive<FunctionArgs<Query> | ConvexQuerySkip>, options?: Options]
  : [args: MaybeReactive<FunctionArgs<Query> | ConvexQuerySkip>, options?: Options]

function dataFromState<T>(state: ConvexQueryState<T>): T | undefined {
  if (state.status === 'success' || state.status === 'stale') {
    return state.data
  }
  if (state.status === 'error') {
    return state.previousData
  }
  return undefined
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
  type QueryResult = FunctionReturnType<Query>
  const state = shallowRef<ConvexQueryState<QueryResult>>({ status: 'pending' })
  const fail = (error: Error): void => {
    state.value = { status: 'error', error, previousData: dataFromState(state.value) }
  }

  const { stop } = useLiveQuery<QueryResult>({
    args: argsInput,
    composable: 'useConvexQuery()',
    initialData: options.initialData,
    query,
    server: options.server,
    begin(initialData, authenticationChanged) {
      const previousData = dataFromState(state.value)
      if (initialData !== undefined) {
        state.value = { status: 'success', data: initialData }
      }
      else if (
        !authenticationChanged
        && options.keepPreviousData
        && previousData !== undefined
      ) {
        state.value = { status: 'stale', data: previousData }
      }
      else {
        state.value = { status: 'pending' }
      }
    },
    failed: fail,
    seeded(data) {
      state.value = { status: 'success', data }
    },
    skipped() {
      state.value = { status: 'skipped' }
    },
    subscribe: (client, args, live) => client.onUpdate(
      query,
      args as FunctionArgs<Query>,
      live((data: QueryResult) => {
        state.value = { status: 'success', data }
      }),
      live(fail),
    ),
  })

  return {
    get data(): QueryResult | undefined {
      return dataFromState(state.value)
    },
    get error(): Error | undefined {
      return state.value.status === 'error' ? state.value.error : undefined
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
  }
}
