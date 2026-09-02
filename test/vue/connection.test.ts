import type { ConnectionState, ConvexClient } from 'convex/browser'
import { createSSRApp, effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useConvexConnectionState } from '../../packages/vue/src/connection.js'
import { createConvexVuePlugin } from '../../packages/vue/src/plugin.js'

function connectionState(connected: boolean): ConnectionState {
  return {
    connectionCount: connected ? 1 : 0,
    hasEverConnected: connected,
    hasInflightRequests: false,
    isWebSocketConnected: connected,
    timeOfOldestInflightRequest: null,
  }
}

describe('useConvexConnectionState', () => {
  it('tracks transport changes and unsubscribes with its scope', () => {
    let listener: ((state: ConnectionState) => void) | undefined
    const unsubscribe = vi.fn()
    const client = {
      closed: false,
      close: vi.fn(async () => {}),
      connectionState: vi.fn(() => connectionState(false)),
      subscribeToConnectionState: vi.fn((callback: (state: ConnectionState) => void) => {
        listener = callback
        return unsubscribe
      }),
    } as unknown as ConvexClient
    const app = createSSRApp({})
    app.use(createConvexVuePlugin({
      createClient: () => client,
      isBrowser: () => true,
    }), { url: 'https://one.convex.cloud' })
    const scope = effectScope()

    const state = app.runWithContext(() => scope.run(useConvexConnectionState))
    expect(state?.value).toEqual(connectionState(false))

    listener?.(connectionState(true))
    expect(state?.value).toEqual(connectionState(true))

    scope.stop()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
