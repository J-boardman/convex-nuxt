import {
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  watch,
} from 'vue'
import { useConvexRuntime } from './plugin.js'

export type ConvexAuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated' }
  | { status: 'error', error: Error }

export interface ConvexAuthProvider {
  fetchAccessToken: (
    args: { forceRefreshToken: boolean },
  ) => Promise<string | null>
  isAuthenticated: boolean
  isLoading: boolean
}

export interface SetupConvexAuthOptions {
  initialState?: { isAuthenticated: boolean }
}

export interface UseConvexAuthResult {
  readonly isAuthenticated: boolean
  readonly isLoading: boolean
  readonly state: ConvexAuthState
}

/** @internal */
export interface ConvexAuthController {
  readonly result: UseConvexAuthResult
  stop: () => void
}

function errorFrom(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function setupConvexAuth(
  provider: () => ConvexAuthProvider,
  options: SetupConvexAuthOptions = {},
): void {
  const runtime = useConvexRuntime()
  if (runtime.auth) {
    throw new Error('Convex authentication is already configured for this application.')
  }

  const initialState: ConvexAuthState = options.initialState
    ? options.initialState.isAuthenticated
      ? { status: 'authenticated' }
      : { status: 'unauthenticated' }
    : { status: 'loading' }
  const state = shallowRef<ConvexAuthState>(initialState)
  let generation = 0
  let providerHasSettled = false
  let stopped = false

  const stopWatching = watch(
    provider,
    (snapshot) => {
      if (stopped) return
      generation += 1
      const authGeneration = generation

      if (snapshot.isLoading) {
        if (providerHasSettled || !options.initialState) {
          state.value = { status: 'loading' }
        }
        return
      }

      providerHasSettled = true
      if (!snapshot.isAuthenticated) {
        state.value = { status: 'unauthenticated' }
        runtime.client?.setAuth(async () => null, () => {})
        return
      }

      state.value = { status: 'loading' }
      runtime.client?.setAuth(
        async ({ forceRefreshToken }) => {
          try {
            return await snapshot.fetchAccessToken({ forceRefreshToken })
          }
          catch (error) {
            if (!stopped && authGeneration === generation) {
              state.value = { status: 'error', error: errorFrom(error) }
            }
            throw error
          }
        },
        (isAuthenticated) => {
          if (stopped || authGeneration !== generation) return
          state.value = isAuthenticated
            ? { status: 'authenticated' }
            : { status: 'unauthenticated' }
        },
      )
    },
    { deep: true, flush: 'sync', immediate: true },
  )

  const result: UseConvexAuthResult = {
    get isAuthenticated(): boolean {
      return state.value.status === 'authenticated'
    },
    get isLoading(): boolean {
      return state.value.status === 'loading'
    },
    get state(): ConvexAuthState {
      return state.value
    },
  }

  const controller: ConvexAuthController = {
    result,
    stop(): void {
      if (stopped) return
      stopped = true
      generation += 1
      stopWatching()
      if (runtime.client && !runtime.client.closed) {
        runtime.client.setAuth(async () => null, () => {})
      }
      if (runtime.auth === controller) {
        runtime.auth = undefined
      }
    },
  }
  runtime.auth = controller

  if (getCurrentScope()) {
    onScopeDispose(controller.stop)
  }
}

export function useConvexAuth(): UseConvexAuthResult {
  const auth = useConvexRuntime().auth
  if (!auth) {
    throw new Error(
      'Convex authentication is not configured. '
      + 'Call setupConvexAuth() before useConvexAuth().',
    )
  }
  return auth.result
}
