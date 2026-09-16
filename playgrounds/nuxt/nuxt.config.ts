import type {} from '@j-boardman/convex-nuxt'

const deploymentUrl = process.env.NUXT_PUBLIC_CONVEX_URL
const testUsers = process.env.CONVEX_TEST_USERS

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  css: ['@j-boardman/convex-playground-shared/style.css'],
  devtools: { enabled: false },
  modules: deploymentUrl ? ['@j-boardman/convex-nuxt'] : [],
  convex: deploymentUrl ? { url: deploymentUrl } : undefined,
  runtimeConfig: {
    convexTestUsers: testUsers ?? '',
    public: {
      convexAuthProbeEnabled: Boolean(testUsers),
      convexPlaygroundUrl: deploymentUrl ?? '',
    },
  },
  typescript: {
    strict: true,
  },
})
