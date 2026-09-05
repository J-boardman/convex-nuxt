import { defineConfig } from '@playwright/test'

const convexUrl = process.env.CONVEX_URL

if (!convexUrl) {
  throw new Error(
    'test:live requires CONVEX_URL for a disposable or protected Convex deployment.',
  )
}

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.live.pw.ts',
  forbidOnly: true,
  fullyParallel: false,
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    channel: 'chrome',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'vue-live',
      use: { baseURL: 'http://127.0.0.1:4273' },
    },
    {
      name: 'nuxt-live',
      use: { baseURL: 'http://127.0.0.1:4274' },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @j-boardman/convex-vue-playground exec vite --host 127.0.0.1 --port 4273',
      env: { VITE_CONVEX_URL: convexUrl },
      reuseExistingServer: false,
      url: 'http://127.0.0.1:4273',
    },
    {
      command: 'pnpm --filter @j-boardman/convex-nuxt-playground exec nuxt dev --host 127.0.0.1 --port 4274',
      env: { NUXT_PUBLIC_CONVEX_URL: convexUrl },
      reuseExistingServer: false,
      url: 'http://127.0.0.1:4274',
    },
  ],
})
