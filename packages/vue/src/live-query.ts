import type { ConvexClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { convexToJson, jsonToConvex } from 'convex/values'
import type { Value } from 'convex/values'
import { getCurrentScope, onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useConvexSsrBridge } from './adapter/ssr.js'
import { useConvexRuntime } from './plugin.js'

type QueryArgs = Record<string, Value>

interface ActiveArgs {
  args: QueryArgs
  key: string
}

/** Wraps a subscription callback so it is dropped once that subscription is superseded. */
export type LiveCallback = <Args extends unknown[]>(
  callback: (...args: Args) => void,
) => (...args: Args) => void

/** @internal */
export interface LiveQueryOptions<Seed> {
  args: MaybeRefOrGetter<unknown>
  /** Names the calling composable in diagnostics. */
  composable: string
  initialData: Seed | undefined
  query: FunctionReference<'query'>
  seedArgs?: (args: QueryArgs) => QueryArgs
  seedKey?: string
  server: boolean | undefined
  /** Publishes the state for newly active arguments, before live data arrives. */
  begin: (initialData: Seed | undefined, authenticationChanged: boolean) => void
  failed: (error: Error) => void
  seeded: (data: Seed) => void
  skipped: () => void
  subscribe: (
    client: ConvexClient,
    args: QueryArgs,
    live: LiveCallback,
  ) => () => void
}

function activeArgs(input: unknown): ActiveArgs | 'skip' {
  if (input === 'skip') return 'skip'
  const encoded = convexToJson(input as QueryArgs)
  return {
    args: jsonToConvex(encoded) as QueryArgs,
    key: JSON.stringify(encoded),
  }
}

/**
 * Owns what queries and paginated queries share: canonical argument
 * identity, the SSR seed, auth-boundary resubscription, and teardown.
 *
 * @internal
 */
export function useLiveQuery<Seed>(options: LiveQueryOptions<Seed>): {
  resubscribe: () => void
  stop: () => void
} {
  const runtime = useConvexRuntime()
  const bridge = useConvexSsrBridge()
  let initial: ActiveArgs | 'skip'
  try {
    initial = activeArgs(toValue(options.args))
  }
  catch {
    initial = 'skip'
  }
  const initialKey = initial === 'skip' ? undefined : initial.key
  const seedEnabled = (options.server ?? bridge?.defaultServerRendering ?? Boolean(bridge))
    && options.initialData === undefined
    && initial !== 'skip'
  if (seedEnabled && !runtime.client && !bridge) {
    throw new Error(
      `${options.composable} cannot server-render without a Convex SSR adapter or initialData. `
      + 'Install a framework adapter, pass initialData, or set server to false.',
    )
  }
  const seed = bridge?.useQuerySeed<Seed>({
    args: initial === 'skip' ? {} : options.seedArgs?.(initial.args) ?? initial.args,
    enabled: seedEnabled,
    key: `${getFunctionName(options.query)}:${options.seedKey ?? ''}${initialKey ?? 'skip'}`,
    query: options.query,
  })
  const seededData = options.initialData ?? seed?.data.value

  let current: ActiveArgs | undefined
  let currentAuthEpoch: number | undefined
  let generation = 0
  let hasStarted = false
  let seedActive = options.initialData === undefined
  let stopped = false
  let unsubscribe: (() => void) | undefined

  const invalidate = (): void => {
    generation += 1
    unsubscribe?.()
    unsubscribe = undefined
  }

  const open = (): void => {
    const client = runtime.client
    if (!current || !client || client.closed) return
    const subscriptionGeneration = generation
    runtime.querySubscriptionsStarted = true
    unsubscribe = options.subscribe(client, current.args, callback =>
      (...args) => {
        if (stopped || subscriptionGeneration !== generation) return
        seedActive = false
        callback(...args)
      })
  }

  const stopSeedWatch = seed
    ? watch(
        [seed.data, seed.error, seed.pending],
        ([data, error, pending]) => {
          if (!seedActive || stopped) return
          if (error) options.failed(error)
          else if (!pending && data !== undefined) options.seeded(data)
        },
        { immediate: true, flush: 'sync' },
      )
    : undefined

  const stopWatching = watch(
    [() => toValue(options.args), runtime.authEpoch],
    ([input, authEpoch]) => {
      if (stopped) return

      let next: ActiveArgs | 'skip'
      try {
        next = activeArgs(input)
      }
      catch (cause) {
        invalidate()
        current = undefined
        currentAuthEpoch = authEpoch
        options.failed(cause instanceof Error ? cause : new Error(String(cause)))
        return
      }

      if (next === 'skip') {
        seedActive = false
        invalidate()
        current = undefined
        currentAuthEpoch = authEpoch
        hasStarted = true
        options.skipped()
        return
      }
      if (next.key === current?.key && authEpoch === currentAuthEpoch) return

      const authenticationChanged = currentAuthEpoch !== undefined
        && authEpoch !== currentAuthEpoch
      if (next.key !== initialKey || authenticationChanged) {
        seedActive = false
      }
      invalidate()
      current = next
      currentAuthEpoch = authEpoch
      options.begin(
        !hasStarted && !authenticationChanged ? seededData : undefined,
        authenticationChanged,
      )
      hasStarted = true
      open()
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  const stop = (): void => {
    if (stopped) return
    stopped = true
    invalidate()
    stopWatching()
    stopSeedWatch?.()
  }

  if (getCurrentScope()) {
    onScopeDispose(stop)
  }

  return {
    resubscribe(): void {
      invalidate()
      open()
    },
    stop,
  }
}
