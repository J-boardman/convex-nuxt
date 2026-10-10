import { defineConfig } from '@playwright/test'

// Run through `pnpm test:live`, which provides a disposable CONVEX_URL.
const convexUrl = process.env.CONVEX_URL

if (!convexUrl) {
  throw new Error('Playwright needs CONVEX_URL; run it through pnpm test:live.')
}

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.pw.ts',
  forbidOnly: true,
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    channel: 'chrome',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'vue', use: { baseURL: 'http://127.0.0.1:4273' } },
    { name: 'nuxt', use: { baseURL: 'http://127.0.0.1:4274' } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @j-boardman/convex-example-vue exec vite --host 127.0.0.1 --port 4273 --strictPort',
      env: { VITE_CONVEX_URL: convexUrl },
      url: 'http://127.0.0.1:4273',
    },
    {
      command: 'pnpm --filter @j-boardman/convex-example-nuxt exec nuxt dev --host 127.0.0.1 --port 4274',
      env: { NUXT_PUBLIC_CONVEX_URL: convexUrl },
      url: 'http://127.0.0.1:4274',
    },
  ],
})
