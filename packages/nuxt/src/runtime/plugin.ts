import { defineNuxtPlugin, useRuntimeConfig } from 'nuxt/app'
import type { Plugin } from 'nuxt/app'
import { installConvexRuntime } from './install.js'

const convexNuxtPlugin: Plugin<Record<string, never>> = defineNuxtPlugin({
  name: 'convex',
  enforce: 'pre',
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    installConvexRuntime(nuxtApp.vueApp, config.public.convex)
  },
})

export default convexNuxtPlugin
