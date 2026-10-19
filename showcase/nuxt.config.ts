export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  css: ['~/assets/main.css'],
  devtools: { enabled: false },
  modules: ['@j-boardman/convex-nuxt'],
  // Server-only: signs each visitor's Convex token. Set NUXT_SHOWCASE_PRIVATE_KEY.
  runtimeConfig: { showcasePrivateKey: '' },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'This or That · Convex for Nuxt',
      meta: [
        { name: 'description', content: 'A live poll built with Convex and Nuxt. Every vote reaches every open tab as it is cast.' },
        { name: 'theme-color', content: '#F3F5F8' },
      ],
      link: [
        { rel: 'icon', href: 'data:,' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap' },
      ],
      script: [{ src: '/network-simulator.js', tagPosition: 'head' }],
    },
  },
})
