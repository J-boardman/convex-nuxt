import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequestClient } from '../../packages/nuxt/src/runtime/request'

function requestEvent(token?: () => Promise<string | null>): H3Event {
  return { context: { convex: token ? { token } : undefined } } as H3Event
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Nuxt SSR request clients', () => {
  it('authenticate each concurrent request with its own page token', async () => {
    const authorizations: (string | null)[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init?: RequestInit) => {
      authorizations.push(new Headers(init?.headers).get('Authorization'))
      return new Response(JSON.stringify({ status: 'success', value: null }))
    }))

    const clients = await Promise.all([
      createRequestClient('https://one.convex.cloud', requestEvent(async () => 'first')),
      createRequestClient('https://one.convex.cloud', requestEvent(async () => 'second')),
      createRequestClient('https://one.convex.cloud', requestEvent()),
    ])
    for (const client of clients) {
      await client.query('tasks:list' as never)
    }

    expect(authorizations).toEqual(['Bearer first', 'Bearer second', null])
  })
})
