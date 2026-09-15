import type { ConvexClient } from 'convex/browser'
import {
  createSSRApp,
  effectScope,
  ref,
} from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { installConvexSsrBridge } from '../../packages/vue/src/adapter/ssr'
import type { ConvexAuthProvider } from '../../packages/vue/src/auth'
import {
  setupConvexAuth,
  useConvexAuth,
} from '../../packages/vue/src/auth'
import {
  createConvexVuePlugin,
  useConvexRuntime,
} from '../../packages/vue/src/plugin'

interface AuthRegistration {
  fetchToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>
  onChange: (isAuthenticated: boolean) => void
}

function createAuthHarness(initialProvider: ConvexAuthProvider) {
  const registrations: AuthRegistration[] = []
  let hasAuth = false
  const clearAuth = vi.fn(() => {
    hasAuth = false
  })
  const client = {
    client: { clearAuth },
    closed: false,
    close: vi.fn(async () => {}),
    getAuth: vi.fn(() => hasAuth
      ? { decoded: {}, token: 'token' }
      : undefined),
    setAuth: vi.fn((
      fetchToken: AuthRegistration['fetchToken'],
      onChange: AuthRegistration['onChange'],
    ) => registrations.push({
      fetchToken,
      onChange: (isAuthenticated) => {
        hasAuth = isAuthenticated
        onChange(isAuthenticated)
      },
    })),
  } as unknown as ConvexClient
  const app = createSSRApp({})
  app.use(createConvexVuePlugin({
    createClient: () => client,
    isBrowser: () => true,
  }), { url: 'https://auth.convex.cloud' })
  const provider = ref(initialProvider)
  const scope = effectScope()

  return { app, clearAuth, client, provider, registrations, scope }
}

function installAuth(
  harness: ReturnType<typeof createAuthHarness>,
  initialState?: { isAuthenticated: boolean },
) {
  return harness.app.runWithContext(() => harness.scope.run(() => {
    setupConvexAuth(() => harness.provider.value, { initialState })
    return useConvexAuth()
  }))
}

describe('Convex authentication', () => {
  it('waits for Convex to confirm an authenticated provider', () => {
    const fetchAccessToken = vi.fn(async () => 'token')
    const harness = createAuthHarness({
      fetchAccessToken,
      isAuthenticated: true,
      isLoading: false,
    })
    const auth = installAuth(harness)

    expect(auth?.state).toEqual({ status: 'loading' })
    expect(harness.registrations).toHaveLength(1)

    harness.registrations[0]?.onChange(true)

    expect(auth?.state).toEqual({ status: 'authenticated' })
    expect(auth?.isAuthenticated).toBe(true)
  })

  it('forwards refresh intent and surfaces token failures', async () => {
    const failure = new Error('token unavailable')
    const harness = createAuthHarness({
      fetchAccessToken: vi.fn(async () => { throw failure }),
      isAuthenticated: true,
      isLoading: false,
    })
    const auth = installAuth(harness)

    await expect(harness.registrations[0]?.fetchToken({
      forceRefreshToken: true,
    })).rejects.toThrow('token unavailable')

    expect(auth?.state).toEqual({ status: 'error', error: failure })
  })

  it('rejects stale backend callbacks after the provider signs out', () => {
    const harness = createAuthHarness({
      fetchAccessToken: vi.fn(async () => 'token'),
      isAuthenticated: true,
      isLoading: false,
    })
    const auth = installAuth(harness)
    const runtime = harness.app.runWithContext(useConvexRuntime)
    const authenticatedRegistration = harness.registrations[0]

    authenticatedRegistration?.onChange(true)
    expect(runtime.authEpoch.value).toBe(0)

    harness.provider.value = {
      fetchAccessToken: vi.fn(async () => null),
      isAuthenticated: false,
      isLoading: false,
    }
    authenticatedRegistration?.onChange(true)

    expect(auth?.state).toEqual({ status: 'loading' })
    expect(harness.registrations).toHaveLength(2)

    harness.registrations[1]?.onChange(false)
    expect(auth?.state).toEqual({ status: 'unauthenticated' })
    expect(runtime.authEpoch.value).toBe(1)
    expect(harness.clearAuth).toHaveBeenCalledOnce()
  })

  it('retains an SSR auth seed until the provider settles', () => {
    const harness = createAuthHarness({
      fetchAccessToken: vi.fn(async () => null),
      isAuthenticated: false,
      isLoading: true,
    })
    const auth = installAuth(harness, { isAuthenticated: true })

    expect(auth?.state).toEqual({ status: 'authenticated' })

    harness.provider.value = {
      fetchAccessToken: vi.fn(async () => null),
      isAuthenticated: false,
      isLoading: false,
    }

    expect(auth?.state).toEqual({ status: 'loading' })
    harness.registrations[0]?.onChange(false)
    expect(auth?.state).toEqual({ status: 'unauthenticated' })
  })

  it('keeps an authenticated SSR seed while the browser token is confirmed', () => {
    const harness = createAuthHarness({
      fetchAccessToken: vi.fn(async () => null),
      isAuthenticated: false,
      isLoading: true,
    })
    const auth = installAuth(harness, { isAuthenticated: true })

    harness.provider.value = {
      fetchAccessToken: vi.fn(async () => 'browser-token'),
      isAuthenticated: true,
      isLoading: false,
    }

    expect(auth?.state).toEqual({ status: 'authenticated' })
    expect(harness.registrations).toHaveLength(1)

    harness.registrations[0]?.onChange(true)
    expect(auth?.state).toEqual({ status: 'authenticated' })
  })

  it('adopts an asynchronous adapter seed while the provider is loading', () => {
    const harness = createAuthHarness({
      fetchAccessToken: vi.fn(async () => null),
      isAuthenticated: false,
      isLoading: true,
    })
    const initialState = ref<{ isAuthenticated: boolean }>()
    installConvexSsrBridge(harness.app, {
      name: 'test',
      useAuthSeed: () => ({ initialState }),
      useQuerySeed: vi.fn() as never,
    })
    const auth = installAuth(harness)

    initialState.value = { isAuthenticated: true }
    harness.provider.value = {
      fetchAccessToken: vi.fn(async () => null),
      isAuthenticated: false,
      isLoading: true,
    }

    expect(auth?.state).toEqual({ status: 'authenticated' })
  })

  it('invalidates callbacks and clears auth when its scope stops', () => {
    const harness = createAuthHarness({
      fetchAccessToken: vi.fn(async () => 'token'),
      isAuthenticated: true,
      isLoading: false,
    })
    const auth = installAuth(harness)
    const registration = harness.registrations[0]

    harness.scope.stop()
    registration?.onChange(true)

    expect(auth?.state).toEqual({ status: 'loading' })
    expect(harness.registrations).toHaveLength(2)
  })

  it('requires one auth registration before consumers can observe it', () => {
    const harness = createAuthHarness({
      fetchAccessToken: vi.fn(async () => null),
      isAuthenticated: false,
      isLoading: false,
    })

    expect(() => harness.app.runWithContext(() => useConvexAuth()))
      .toThrow('Call setupConvexAuth() before useConvexAuth().')
  })

  it('rejects auth setup after a live query has started', () => {
    const harness = createAuthHarness({
      fetchAccessToken: vi.fn(async () => 'token'),
      isAuthenticated: true,
      isLoading: false,
    })
    harness.app.runWithContext(() => {
      useConvexRuntime().querySubscriptionsStarted = true
    })

    expect(() => installAuth(harness)).toThrow(
      'before live query subscriptions start',
    )
    expect(harness.client.setAuth).not.toHaveBeenCalled()
  })
})
