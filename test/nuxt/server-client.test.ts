import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import {
  createConvexHttpClientForRequest,
  setConvexServerToken,
} from '../../packages/nuxt/src/runtime/server/request'

function requestEvent(url = 'https://server.convex.cloud'): H3Event {
  return {
    context: {
      nitro: {
        runtimeConfig: {
          public: {
            convex: { client: {}, url },
          },
        },
      },
    },
  } as unknown as H3Event
}

describe('Nuxt server HTTP clients', () => {
  it('resolves lazy tokens within their own concurrent request', async () => {
    const firstEvent = requestEvent('https://first.convex.cloud')
    const secondEvent = requestEvent('https://second.convex.cloud')
    const firstToken = vi.fn(async () => 'first-token')
    const secondToken = vi.fn(async () => 'second-token')
    setConvexServerToken(firstEvent, firstToken)
    setConvexServerToken(secondEvent, secondToken)

    const [firstClient, secondClient] = await Promise.all([
      createConvexHttpClientForRequest({
        config: firstEvent.context.nitro.runtimeConfig.public.convex,
        event: firstEvent,
      }),
      createConvexHttpClientForRequest({
        config: secondEvent.context.nitro.runtimeConfig.public.convex,
        event: secondEvent,
      }),
    ])

    expect(firstClient).not.toBe(secondClient)
    expect(firstClient.url).toBe('https://first.convex.cloud')
    expect(secondClient.url).toBe('https://second.convex.cloud')
    expect(firstToken).toHaveBeenCalledOnce()
    expect(secondToken).toHaveBeenCalledOnce()
  })

  it('lets an operation override the request token with anonymous access', async () => {
    const event = requestEvent()
    const requestToken = vi.fn(async () => 'request-token')
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).has('Authorization')).toBe(false)
      return new Response(JSON.stringify({ status: 'success', value: null }))
    })
    setConvexServerToken(event, requestToken)

    const client = await createConvexHttpClientForRequest({
      clientOptions: { fetch, logger: false },
      config: event.context.nitro.runtimeConfig.public.convex,
      event,
      token: null,
    })
    await client.query('probes:viewer' as never)

    expect(requestToken).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
  })
})
