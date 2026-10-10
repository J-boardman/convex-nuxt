import { describe, expect, it } from 'vitest'
import { deploymentUrl } from '../../packages/nuxt/src/runtime/config'

describe('Nuxt runtime config', () => {
  it('leaves the app inert until a deployment URL is configured', () => {
    expect(deploymentUrl(undefined)).toBeUndefined()
    expect(deploymentUrl({})).toBeUndefined()
    expect(deploymentUrl({ url: '   ' })).toBeUndefined()
    expect(deploymentUrl({ url: ' https://calm-wren-123.convex.cloud ' }))
      .toBe('https://calm-wren-123.convex.cloud')
  })
})
