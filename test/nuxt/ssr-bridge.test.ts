import { makeFunctionReference } from 'convex/server'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type {
  ConvexSsrSeed,
} from '../../packages/vue/src/adapter/index'
import {
  createNuxtSsrBridge,
} from '../../packages/nuxt/src/runtime/ssr-bridge-core'
import type {
  NuxtSsrBridgeDependencies,
} from '../../packages/nuxt/src/runtime/ssr-bridge-core'

interface SeedHarness {
  dependencies: NuxtSsrBridgeDependencies
  pendingTasks: Promise<void>[]
}

function createSeedHarness(
  payload: Map<string, ConvexSsrSeed>,
  loadQuery: () => Promise<string[]>,
): SeedHarness {
  const pendingTasks: Promise<void>[] = []
  const dependencies: NuxtSsrBridgeDependencies = {
    createQueryLoader: vi.fn(() => loadQuery),
    useAsyncData(key, handler, enabled) {
      const cached = payload.get(key)
      const data = ref<ConvexSsrSeed | undefined>(cached)
      const error = ref<unknown>()
      const status = ref<'error' | 'idle' | 'pending' | 'success'>(
        cached ? 'success' : enabled ? 'pending' : 'idle',
      )

      if (!cached && enabled) {
        pendingTasks.push(handler().then((seed) => {
          payload.set(key, seed)
          data.value = seed
          status.value = 'success'
        }))
      }

      return { data, error, status }
    },
  }
  return { dependencies, pendingTasks }
}

describe('Nuxt SSR bridge', () => {
  it('hydrates from its opaque payload key without loading again', async () => {
    const payload = new Map<string, ConvexSsrSeed>()
    const serverLoad = vi.fn(async () => ['server result'])
    const serverHarness = createSeedHarness(payload, serverLoad)
    const query = makeFunctionReference<'query', { viewer: string }, string[]>(
      'messages:privateList',
    )
    const request = {
      args: { viewer: 'sensitive-user-id' },
      enabled: true,
      key: 'messages:privateList:{"viewer":"sensitive-user-id"}',
      query,
    }
    const serverBridge = createNuxtSsrBridge(
      'https://example.convex.cloud',
      serverHarness.dependencies,
    )
    const serverSeed = serverBridge.useQuerySeed<string[]>(request)

    await Promise.all(serverHarness.pendingTasks)

    expect(serverLoad).toHaveBeenCalledOnce()
    expect(serverSeed.data.value).toEqual(['server result'])
    const [payloadKey] = payload.keys()
    expect(payloadKey).toMatch(/^convex:[\w-]+$/)
    expect(payloadKey).not.toContain('sensitive-user-id')

    const browserLoad = vi.fn(async () => ['duplicate result'])
    const browserHarness = createSeedHarness(payload, browserLoad)
    const browserBridge = createNuxtSsrBridge(
      'https://example.convex.cloud',
      browserHarness.dependencies,
    )
    const hydratedSeed = browserBridge.useQuerySeed<string[]>(request)

    expect(hydratedSeed.data.value).toEqual(['server result'])
    expect(hydratedSeed.pending.value).toBe(false)
    expect(browserLoad).not.toHaveBeenCalled()
    expect(browserHarness.pendingTasks).toHaveLength(0)
  })

  it('does not create a query loader for a disabled seed', () => {
    const payload = new Map<string, ConvexSsrSeed>()
    const harness = createSeedHarness(payload, vi.fn())
    const bridge = createNuxtSsrBridge(
      'https://example.convex.cloud',
      harness.dependencies,
    )
    const query = makeFunctionReference<'query', Record<string, never>, null>(
      'viewer:get',
    )

    const seed = bridge.useQuerySeed<null>({
      args: {},
      enabled: false,
      key: 'viewer:get:{}',
      query,
    })

    expect(harness.dependencies.createQueryLoader).not.toHaveBeenCalled()
    expect(seed.pending.value).toBe(false)
    expect(harness.pendingTasks).toHaveLength(0)
  })
})
