import * as runtime from '../../packages/nuxt/src/runtime/index'
import { describe, expect, it } from 'vitest'
import { convexComposables } from '../../packages/nuxt/src/module'

describe('Nuxt Convex auto-imports', () => {
  it('name only functions the runtime entry exports', () => {
    for (const name of convexComposables) {
      expect(runtime[name]).toBeTypeOf('function')
    }
  })
})
