// The deployment URL comes from NUXT_PUBLIC_CONVEX_URL at runtime.
export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  modules: ['@j-boardman/convex-nuxt'],
})
