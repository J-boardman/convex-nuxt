import type {} from '@j-boardman/convex-nuxt'

const deploymentUrl = process.env.NUXT_PUBLIC_CONVEX_URL

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  css: ['~/assets/main.css'],
  devtools: { enabled: true },
  modules: deploymentUrl ? ['@j-boardman/convex-nuxt'] : [],
  convex: deploymentUrl ? { url: deploymentUrl } : undefined,
  runtimeConfig: {
    public: {
      convexPlaygroundUrl: deploymentUrl ?? '',
    },
  },
  typescript: {
    strict: true,
  },
})
