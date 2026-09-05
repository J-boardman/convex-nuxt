import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.pw.ts',
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    channel: 'chrome',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'vue-setup',
      use: { baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'nuxt-setup',
      use: { baseURL: 'http://127.0.0.1:4174' },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @j-boardman/convex-vue-playground exec vite --host 127.0.0.1 --port 4173',
      env: { VITE_CONVEX_URL: '' },
      reuseExistingServer: false,
      url: 'http://127.0.0.1:4173',
    },
    {
      command: 'pnpm --filter @j-boardman/convex-nuxt-playground exec nuxt dev --host 127.0.0.1 --port 4174',
      env: { NUXT_PUBLIC_CONVEX_URL: '' },
      reuseExistingServer: false,
      url: 'http://127.0.0.1:4174',
    },
  ],
})
