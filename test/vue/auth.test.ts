import type { ConvexClient } from 'convex/browser'
import {
  createSSRApp,
  effectScope,
  ref,
} from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { ConvexAuthProvider } from '../../packages/vue/src/auth'
import {
  setupConvexAuth,
  useConvexAuth,
} from '../../packages/vue/src/auth'
import { createConvexVuePlugin } from '../../packages/vue/src/plugin'

interface AuthRegistration {
  fetchToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>
  onChange: (isAuthenticated: boolean) => void
}

function createAuthHarness(initialProvider: ConvexAuthProvider) {
  const registrations: AuthRegistration[] = []
  const client = {
    closed: false,
    close: vi.fn(async () => {}),
    setAuth: vi.fn((
      fetchToken: AuthRegistration['fetchToken'],
      onChange: AuthRegistration['onChange'],
    ) => registrations.push({ fetchToken, onChange })),
  } as unknown as ConvexClient
  const app = createSSRApp({})
  app.use(createConvexVuePlugin({
    createClient: () => client,
    isBrowser: () => true,
  }), { url: 'https://auth.convex.cloud' })
  const provider = ref(initialProvider)
  const scope = effectScope()

  return { app, client, provider, registrations, scope }
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
    const authenticatedRegistration = harness.registrations[0]

    harness.provider.value = {
      fetchAccessToken: vi.fn(async () => null),
      isAuthenticated: false,
      isLoading: false,
    }
    authenticatedRegistration?.onChange(true)

    expect(auth?.state).toEqual({ status: 'unauthenticated' })
    expect(harness.registrations).toHaveLength(2)
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

    expect(auth?.state).toEqual({ status: 'unauthenticated' })
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
})
