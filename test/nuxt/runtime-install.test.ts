import { createSSRApp } from 'vue'
import { describe, expect, it } from 'vitest'
import { installConvexRuntime } from '../../packages/nuxt/src/runtime/install'
import { resolveConvexRuntimeOptions } from '../../packages/nuxt/src/runtime/config'
import { useConvexRuntime } from '../../packages/vue/src/plugin'

describe('Nuxt runtime installation', () => {
  it('installs the shared Vue runtime without creating an SSR client', () => {
    const app = createSSRApp({})

    installConvexRuntime(app, {
      client: { unsavedChangesWarning: false },
      url: ' https://calm-wren-123.convex.cloud ',
    })

    const runtime = app.runWithContext(useConvexRuntime)
    expect(runtime).toMatchObject({
      client: null,
      url: 'https://calm-wren-123.convex.cloud',
    })
  })

  it('requires a public deployment URL and validates client flags', () => {
    expect(() => resolveConvexRuntimeOptions({ url: '' })).toThrow(
      'Set convex.url in nuxt.config.ts or NUXT_PUBLIC_CONVEX_URL',
    )
    expect(() => resolveConvexRuntimeOptions({
      client: { unsavedChangesWarning: 'sometimes' },
      url: 'https://calm-wren-123.convex.cloud',
    })).toThrow('unsavedChangesWarning must be a boolean')
  })
})
