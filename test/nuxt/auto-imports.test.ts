import * as runtime from '../../packages/nuxt/src/runtime/index'
import { describe, expect, it } from 'vitest'
import { convexAutoImports } from '../../packages/nuxt/src/auto-imports'

describe('Nuxt Convex auto-imports', () => {
  it('resolve every generated name to the shared Vue runtime', () => {
    expect(convexAutoImports.map(entry => entry.name)).toEqual([
      'closeConvex',
      'setupConvexAuth',
      'useConvexAction',
      'useConvexAuth',
      'useConvexClient',
      'useConvexConnectionState',
      'useConvexMutation',
      'useConvexQuery',
    ])
    expect(convexAutoImports.every(
      entry => entry.from === '@j-boardman/convex-nuxt/runtime',
    )).toBe(true)

    for (const entry of convexAutoImports) {
      expect(runtime[entry.name as keyof typeof runtime]).toBeTypeOf('function')
    }
  })
})
