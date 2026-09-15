import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'
import { getFunctionName } from 'convex/server'
import { convexToJson } from 'convex/values'
import {
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue'
import type { MaybeReactive } from './query.js'
import type { ConvexQueryState } from './query.js'
import { useConvexRuntime } from './plugin.js'

export interface RequestForConvexQuery<
  Query extends FunctionReference<'query'> = FunctionReference<'query'>,
> {
  args: FunctionArgs<Query>
  query: Query
}

export type ConvexQueriesRequest = Record<string, RequestForConvexQuery>

type ValidConvexQueries<Requests extends ConvexQueriesRequest> = {
  [Identifier in keyof Requests]: RequestForConvexQuery<
    Requests[Identifier]['query']
  >
}

export type ConvexQueriesState<Requests extends ConvexQueriesRequest> = {
  readonly [Identifier in keyof Requests]: ConvexQueryState<
    FunctionReturnType<Requests[Identifier]['query']>
  >
}

export interface UseConvexQueriesResult<Requests extends ConvexQueriesRequest> {
  readonly isLoading: boolean
  readonly state: ConvexQueriesState<Requests>
  stop: () => void
}

interface QueryEntry {
  identity: string
  state: ConvexQueryState<unknown>
  unsubscribe: () => void
}

function queryIdentity(request: RequestForConvexQuery): string {
  return `${getFunctionName(request.query)}:${JSON.stringify(convexToJson(request.args))}`
}

export function useConvexQueries<Requests extends ConvexQueriesRequest>(
  requestsInput: MaybeReactive<Requests & ValidConvexQueries<Requests>>,
): UseConvexQueriesResult<Requests> {
  const runtime = useConvexRuntime()
  const entries = new Map<string, QueryEntry>()
  const snapshot = shallowRef<Record<string, ConvexQueryState<unknown>>>({})
  let publishQueued = false
  let stopped = false

  const publish = (): void => {
    publishQueued = false
    if (stopped) return

    snapshot.value = Object.fromEntries(
      [...entries].map(([identifier, entry]) => [identifier, entry.state]),
    )
  }

  const schedulePublish = (): void => {
    if (publishQueued || stopped) return
    publishQueued = true
    queueMicrotask(publish)
  }

  const stopWatching = watch(
    () => toValue(requestsInput),
    (requests) => {
      if (stopped) return
      if (!requests || Array.isArray(requests) || typeof requests !== 'object') {
        throw new TypeError('useConvexQueries() requires a keyed query request object.')
      }

      const normalized = Object.entries(requests).map(([identifier, request]) => ({
        identifier,
        identity: queryIdentity(request),
        request,
      }))

      for (const { identifier, identity, request } of normalized) {
        const existing = entries.get(identifier)
        if (existing?.identity === identity) continue

        existing?.unsubscribe()
        const entry: QueryEntry = {
          identity,
          state: { status: 'pending' },
          unsubscribe: () => {},
        }
        entries.set(identifier, entry)

        if (runtime.client && !runtime.client.closed) {
          runtime.querySubscriptionsStarted = true
          entry.unsubscribe = runtime.client.onUpdate(
            request.query,
            request.args,
            (data) => {
              if (stopped || entries.get(identifier) !== entry) return
              entry.state = { status: 'success', data }
              schedulePublish()
            },
            (error) => {
              if (stopped || entries.get(identifier) !== entry) return
              entry.state = { status: 'error', error }
              schedulePublish()
            },
          )
        }
      }

      const identifiers = new Set(normalized.map(({ identifier }) => identifier))
      for (const [identifier, entry] of entries) {
        if (!identifiers.has(identifier)) {
          entry.unsubscribe()
          entries.delete(identifier)
        }
      }

      publish()
    },
    { deep: true, flush: 'sync', immediate: true },
  )

  const stop = (): void => {
    if (stopped) return
    stopped = true
    stopWatching()
    for (const entry of entries.values()) {
      entry.unsubscribe()
    }
    entries.clear()
  }

  if (getCurrentScope()) {
    onScopeDispose(stop)
  }

  return {
    get isLoading(): boolean {
      return Object.values(snapshot.value).some(state => state.status === 'pending')
    },
    get state(): ConvexQueriesState<Requests> {
      return snapshot.value as ConvexQueriesState<Requests>
    },
    stop,
  }
}
