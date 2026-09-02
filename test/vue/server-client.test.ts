import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import { createConvexHttpClient } from '../../packages/vue/src/server/client'

describe('createConvexHttpClient', () => {
  it('keeps authentication isolated between concurrent server clients', async () => {
    const requests: Array<{ authorization: string | null, url: string }> = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        authorization: new Headers(init?.headers).get('Authorization'),
        url: String(input),
      })
      return new Response(JSON.stringify({ status: 'success', value: null }))
    })
    const first = createConvexHttpClient({
      clientOptions: { fetch, logger: false },
      token: 'first-token',
      url: 'https://first.convex.cloud',
    })
    const second = createConvexHttpClient({
      clientOptions: { fetch, logger: false },
      token: 'second-token',
      url: 'https://second.convex.cloud',
    })
    const query = makeFunctionReference<'query', Record<string, never>, null>(
      'probes:viewer',
    )

    await Promise.all([first.query(query), second.query(query)])

    expect(first).not.toBe(second)
    expect(requests).toEqual([
      {
        authorization: 'Bearer first-token',
        url: 'https://first.convex.cloud/api/query',
      },
      {
        authorization: 'Bearer second-token',
        url: 'https://second.convex.cloud/api/query',
      },
    ])
  })

  it('creates an anonymous client when the token is null', async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).has('Authorization')).toBe(false)
      return new Response(JSON.stringify({ status: 'success', value: null }))
    })
    const client = createConvexHttpClient({
      clientOptions: { fetch, logger: false },
      token: null,
      url: 'https://anonymous.convex.cloud',
    })
    const query = makeFunctionReference<'query', Record<string, never>, null>(
      'probes:viewer',
    )

    await client.query(query)

    expect(fetch).toHaveBeenCalledOnce()
  })
})
