import { describe, expect, it } from 'vitest'
import {
  decodeConvexSsrSeed,
  encodeConvexSsrSeed,
} from '../../packages/vue/src/server/seed'

describe('Convex SSR seeds', () => {
  it.each([
    ['null', null],
    ['false', false],
    ['zero', 0],
    ['bigint', 9_007_199_254_740_993n],
    ['bytes', new Uint8Array([0, 127, 255]).buffer],
    ['id', 'jh76af00d6h1h8d4czep6c17n57abcde'],
    ['nested values', {
      array: [null, false, 0, 42n, new Uint8Array([1, 2, 3]).buffer],
      object: { id: 'jh76af00d6h1h8d4czep6c17n57abcde' },
    }],
  ])('round-trips %s through a JSON-safe envelope', (_name, value) => {
    const encoded = encodeConvexSsrSeed(value)
    const transferred = JSON.parse(JSON.stringify(encoded))

    expect(decodeConvexSsrSeed(transferred)).toStrictEqual(value)
  })

  it('rejects payloads from an unknown encoding version', () => {
    expect(() => decodeConvexSsrSeed({
      encoding: 'convex-json',
      value: null,
      version: 2,
    } as never)).toThrow('Unsupported Convex SSR seed encoding.')
  })
})
