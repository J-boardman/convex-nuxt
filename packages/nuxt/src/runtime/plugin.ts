import { defineNuxtPlugin, useRuntimeConfig } from 'nuxt/app'
import type { Plugin } from 'nuxt/app'
import { resolveConvexRuntimeOptions } from './config.js'
import { installConvexRuntime } from './install.js'
import { installNuxtSsrBridge } from './ssr-bridge.js'

const convexNuxtPlugin: Plugin<Record<string, never>> = defineNuxtPlugin({
  name: 'convex',
  enforce: 'pre',
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    installConvexRuntime(nuxtApp.vueApp, config.public.convex)
    installNuxtSsrBridge(
      nuxtApp.vueApp,
      resolveConvexRuntimeOptions(config.public.convex).url,
    )
  },
})

export default convexNuxtPlugin
