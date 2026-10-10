import type { ConvexClient } from 'convex/browser'
import { createSSRApp } from 'vue'
import type { App } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createConvexVuePlugin,
  useConvexClient,
} from '../../packages/vue/src/plugin.js'
import type { ConvexVueClientOptions } from '../../packages/vue/src/plugin.js'

interface FakeClient {
  client: ConvexClient
  close: ReturnType<typeof vi.fn>
}

function createFakeClient(): FakeClient {
  const close = vi.fn(async () => {})
  return {
    client: {
      closed: false,
      close,
    } as unknown as ConvexClient,
    close,
  }
}

function install(
  app: App,
  url: string,
  createClient: (url: string, options: ConvexVueClientOptions) => ConvexClient,
  client?: ConvexVueClientOptions,
) {
  const plugin = createConvexVuePlugin({
    createClient,
    isBrowser: () => true,
  })
  app.use(plugin, { client, url })
}

describe('convexVue', () => {
  it('isolates clients owned by different Vue applications', () => {
    const firstApp = createSSRApp({})
    const secondApp = createSSRApp({})
    const first = createFakeClient()
    const second = createFakeClient()

    install(firstApp, 'https://one.convex.cloud', () => first.client)
    install(secondApp, 'https://two.convex.cloud', () => second.client)

    expect(firstApp.runWithContext(useConvexClient)).toBe(first.client)
    expect(secondApp.runWithContext(useConvexClient)).toBe(second.client)
  })

  it('forwards supported Convex transport options to the browser client', () => {
    const app = createSSRApp({})
    const fake = createFakeClient()
    const createClient = vi.fn(() => fake.client)

    install(app, 'https://one.convex.cloud', createClient, {
      authRefreshTokenLeewaySeconds: 20,
      expectAuth: true,
      initialAuthTokenReuse: true,
      logger: false,
      reportDebugInfoToConvex: true,
      verbose: true,
    })

    expect(createClient).toHaveBeenCalledWith(
      'https://one.convex.cloud',
      {
        authRefreshTokenLeewaySeconds: 20,
        expectAuth: true,
        initialAuthTokenReuse: true,
        logger: false,
        reportDebugInfoToConvex: true,
        verbose: true,
      },
    )
  })

  it('does not construct a WebSocket client during SSR', () => {
    const app = createSSRApp({})
    const createClient = vi.fn()
    const plugin = createConvexVuePlugin({
      createClient,
      isBrowser: () => false,
    })

    app.use(plugin, { url: 'https://one.convex.cloud' })

    expect(createClient).not.toHaveBeenCalled()
    expect(() => app.runWithContext(useConvexClient)).toThrow(
      'useConvexClient() is browser-only',
    )
  })

  it('closes its client when the application unmounts', () => {
    const app = createSSRApp({})
    const fake = createFakeClient()
    const unmountHooks: (() => void)[] = []
    app.onUnmount = (hook) => {
      unmountHooks.push(hook)
    }

    install(app, 'https://one.convex.cloud', () => fake.client)
    unmountHooks.forEach(hook => hook())

    expect(fake.close).toHaveBeenCalledOnce()
  })

  it('names the missing installation in its diagnostic', () => {
    const app = createSSRApp({})

    expect(() => app.runWithContext(useConvexClient)).toThrow(
      'Call app.use(convexVue, { url })',
    )
  })
})
