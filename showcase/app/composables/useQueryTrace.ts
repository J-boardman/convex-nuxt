export interface QueryTrace {
  /** The line in this app that creates the query. */
  readonly code: string
  readonly name: string
  /** The value was in the server HTML and reused while hydrating. */
  readonly fromServer: boolean
  /** Milliseconds from hydration to the first live result, once it arrives. */
  liveAfter: number | undefined
  /** Live results after the first, i.e. changes pushed by Convex. */
  changes: number
}

const traces = shallowReactive<QueryTrace[]>([])

/** Records what happened to one query, for the "Under the hood" panel. */
export function useQueryTrace(
  name: string,
  code: string,
  data: () => unknown,
): void {
  if (import.meta.server) return
  const startedAt = performance.now()
  const trace = reactive<QueryTrace>({
    changes: 0,
    code,
    fromServer: useNuxtApp().isHydrating === true && data() !== undefined,
    liveAfter: undefined,
    name,
  })
  watch(data, () => {
    if (trace.liveAfter === undefined) {
      trace.liveAfter = Math.round(performance.now() - startedAt)
    }
    else {
      trace.changes += 1
    }
  })
  traces.push(trace)
  onScopeDispose(() => traces.splice(traces.indexOf(trace), 1))
}

export function useQueryTraces(): readonly QueryTrace[] {
  return traces
}
