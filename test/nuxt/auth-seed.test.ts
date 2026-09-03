import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  useNuxtAuthSeed,
} from '../../packages/nuxt/src/runtime/auth-seed-core'
import type {
  NuxtAuthSeedDependencies,
  NuxtAuthSeedValue,
} from '../../packages/nuxt/src/runtime/auth-seed-core'

function createAuthPayloadHarness(
  payload: Map<string, NuxtAuthSeedValue>,
  loadToken: (() => Promise<string | null>) | undefined,
) {
  const pendingTasks: Promise<void>[] = []
  const dependencies: NuxtAuthSeedDependencies = {
    prepareServerToken: vi.fn(() => loadToken),
    useAsyncData(key, handler, executeOnServer) {
      const cached = payload.get(key)
      const data = ref<NuxtAuthSeedValue | undefined>(cached)
      if (!cached && executeOnServer) {
        pendingTasks.push(handler().then((value) => {
          payload.set(key, value)
          data.value = value
        }))
      }
      return { data }
    },
  }
  return { dependencies, pendingTasks }
}

describe('Nuxt auth seed', () => {
  it('serializes auth state without serializing or reloading the token', async () => {
    const payload = new Map<string, NuxtAuthSeedValue>()
    const loadToken = vi.fn(async () => 'secret-request-token')
    const serverHarness = createAuthPayloadHarness(payload, loadToken)
    const serverSeed = useNuxtAuthSeed(
      'https://example.convex.cloud',
      { serverToken: loadToken },
      serverHarness.dependencies,
    )

    await Promise.all(serverHarness.pendingTasks)

    expect(serverSeed.initialState.value).toEqual({ isAuthenticated: true })
    expect(JSON.stringify([...payload.entries()])).not.toContain(
      'secret-request-token',
    )

    const browserLoad = vi.fn(async () => 'must-not-run')
    const browserHarness = createAuthPayloadHarness(payload, undefined)
    const hydratedSeed = useNuxtAuthSeed(
      'https://example.convex.cloud',
      { serverToken: browserLoad },
      browserHarness.dependencies,
    )

    expect(hydratedSeed.initialState.value).toEqual({ isAuthenticated: true })
    expect(browserLoad).not.toHaveBeenCalled()
    expect(browserHarness.pendingTasks).toHaveLength(0)
  })

  it('carries an explicit unauthenticated state as usable payload data', async () => {
    const payload = new Map<string, NuxtAuthSeedValue>()
    const harness = createAuthPayloadHarness(
      payload,
      vi.fn(async () => null),
    )
    const seed = useNuxtAuthSeed(
      'https://example.convex.cloud',
      {},
      harness.dependencies,
    )

    await Promise.all(harness.pendingTasks)

    expect(seed.initialState.value).toEqual({ isAuthenticated: false })
  })
})
