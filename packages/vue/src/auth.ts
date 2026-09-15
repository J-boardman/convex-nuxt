import {
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  watch,
} from 'vue'
import type { ConvexClient } from 'convex/browser'
import { useConvexSsrBridge } from './adapter/ssr.js'
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
  serverToken?: () => Promise<string | null>
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

function clearClientAuth(
  client: ConvexClient,
  onChange: (isAuthenticated: boolean) => void,
): void {
  // ConvexClient does not expose clearAuth(), but its public base client does.
  // Clear before setAuth() pauses the socket so the server receives the
  // anonymous identity transition. setAuth() then owns timer cleanup.
  if (client.getAuth()) {
    client.client.clearAuth()
  }
  client.setAuth(async () => null, onChange)
}

export function setupConvexAuth(
  provider: () => ConvexAuthProvider,
  options: SetupConvexAuthOptions = {},
): void {
  const runtime = useConvexRuntime()
  if (runtime.auth) {
    throw new Error('Convex authentication is already configured for this application.')
  }
  if (runtime.querySubscriptionsStarted) {
    throw new Error(
      'Convex authentication must be configured before live query subscriptions start. '
      + 'Call setupConvexAuth() in the root component before child queries, '
      + 'or in a Nuxt plugin that depends on "convex".',
    )
  }

  const authSeed = useConvexSsrBridge()?.useAuthSeed?.({
    serverToken: options.serverToken,
  })
  const initialAuth = options.initialState ?? authSeed?.initialState.value
  const initialState: ConvexAuthState = initialAuth
    ? initialAuth.isAuthenticated
      ? { status: 'authenticated' }
      : { status: 'unauthenticated' }
    : { status: 'loading' }
  const state = shallowRef<ConvexAuthState>(initialState)
  let confirmedAuthentication = initialAuth?.isAuthenticated
  let generation = 0
  let providerHasSettled = false
  let hasAuthSeed = Boolean(initialAuth)
  let stopped = false

  const publishConfirmation = (isAuthenticated: boolean): void => {
    const authenticationChanged = confirmedAuthentication !== undefined
      && confirmedAuthentication !== isAuthenticated
    confirmedAuthentication = isAuthenticated
    state.value = isAuthenticated
      ? { status: 'authenticated' }
      : { status: 'unauthenticated' }
    if (authenticationChanged) {
      runtime.authEpoch.value += 1
    }
  }

  const stopSeedWatch = authSeed
    ? watch(
        authSeed.initialState,
        (seed) => {
          if (!stopped && !providerHasSettled && seed) {
            hasAuthSeed = true
            state.value = seed.isAuthenticated
              ? { status: 'authenticated' }
              : { status: 'unauthenticated' }
          }
        },
        { flush: 'sync' },
      )
    : undefined

  const stopWatching = watch(
    provider,
    (snapshot) => {
      if (stopped) return
      generation += 1
      const authGeneration = generation

      if (snapshot.isLoading) {
        if (providerHasSettled || !hasAuthSeed) {
          state.value = { status: 'loading' }
        }
        return
      }

      if (!runtime.client && authSeed) {
        return
      }

      const preserveSeedUntilConfirmation = hasAuthSeed && !providerHasSettled
      providerHasSettled = true
      if (!snapshot.isAuthenticated) {
        if (!runtime.client) {
          state.value = { status: 'unauthenticated' }
          return
        }
        state.value = { status: 'loading' }
        clearClientAuth(
          runtime.client,
          (isAuthenticated) => {
            if (stopped || authGeneration !== generation) return
            publishConfirmation(isAuthenticated)
          },
        )
        return
      }

      if (!preserveSeedUntilConfirmation) {
        state.value = { status: 'loading' }
      }
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
          publishConfirmation(isAuthenticated)
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
      stopSeedWatch?.()
      if (runtime.client && !runtime.client.closed) {
        clearClientAuth(runtime.client, () => {})
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
