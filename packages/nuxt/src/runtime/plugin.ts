import { defineNuxtPlugin, useRuntimeConfig } from 'nuxt/app'
import type { Plugin } from 'nuxt/app'
import { resolveConfiguredConvexRuntimeOptions } from './config.js'
import { installConvexRuntime } from './install.js'
import { installNuxtSsrBridge } from './ssr-bridge.js'

const convexNuxtPlugin: Plugin<Record<string, never>> = defineNuxtPlugin({
  name: 'convex',
  enforce: 'pre',
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    const options = resolveConfiguredConvexRuntimeOptions(config.public.convex)
    if (!options) return

    installConvexRuntime(nuxtApp.vueApp, options)
    installNuxtSsrBridge(
      nuxtApp.vueApp,
      options.url,
      options.ssr,
    )
  },
})

export default convexNuxtPlugin
