import type { ConvexClient } from 'convex/browser'
import { createSSRApp } from 'vue'
import type { App } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  closeConvex,
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
  it('reuses one client when the same application is initialized again', () => {
    const app = createSSRApp({})
    const fake = createFakeClient()
    const createClient = vi.fn(() => fake.client)

    install(app, 'https://one.convex.cloud', createClient)
    install(app, 'https://one.convex.cloud', createClient)

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(app.runWithContext(useConvexClient)).toBe(fake.client)
  })

  it('rejects a different deployment in the same application', () => {
    const app = createSSRApp({})
    const fake = createFakeClient()

    install(app, 'https://one.convex.cloud', () => fake.client)

    expect(() => install(app, 'https://two.convex.cloud', () => fake.client))
      .toThrow('Convex is already installed in this Vue application')
  })

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

  it('closes its client once and permits a fresh runtime', async () => {
    const app = createSSRApp({})
    const first = createFakeClient()
    const second = createFakeClient()

    install(app, 'https://one.convex.cloud', () => first.client)

    await app.runWithContext(closeConvex)
    await app.runWithContext(closeConvex)

    expect(first.close).toHaveBeenCalledTimes(1)

    install(app, 'https://two.convex.cloud', () => second.client)
    expect(app.runWithContext(useConvexClient)).toBe(second.client)
  })

  it('names the missing installation in its diagnostic', () => {
    const app = createSSRApp({})

    expect(() => app.runWithContext(useConvexClient)).toThrow(
      'Call app.use(convexVue, { url })',
    )
  })
})
