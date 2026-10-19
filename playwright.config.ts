import { defineConfig } from '@playwright/test'

// Run through `pnpm test:live`, which starts disposable deployments.
const { CONVEX_URL, SHOWCASE_CONVEX_URL, SHOWCASE_PRIVATE_KEY } = process.env

if (!CONVEX_URL || !SHOWCASE_CONVEX_URL || !SHOWCASE_PRIVATE_KEY) {
  throw new Error('Run the browser tests through pnpm test:live.')
}

export default defineConfig({
  testDir: './test/e2e',
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
    {
      name: 'vue',
      testMatch: 'examples.pw.ts',
      use: { baseURL: 'http://127.0.0.1:4273' },
    },
    {
      name: 'nuxt',
      testMatch: 'examples.pw.ts',
      use: { baseURL: 'http://127.0.0.1:4274' },
    },
    {
      name: 'showcase',
      testMatch: 'showcase.pw.ts',
      use: { baseURL: 'http://127.0.0.1:4275' },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @j-boardman/convex-example-vue exec vite --host 127.0.0.1 --port 4273 --strictPort',
      env: { VITE_CONVEX_URL: CONVEX_URL },
      url: 'http://127.0.0.1:4273',
    },
    {
      command: 'pnpm --filter @j-boardman/convex-example-nuxt exec nuxt dev --host 127.0.0.1 --port 4274',
      env: { NUXT_PUBLIC_CONVEX_URL: CONVEX_URL },
      url: 'http://127.0.0.1:4274',
    },
    {
      command: 'pnpm --filter @j-boardman/convex-showcase exec nuxt dev --host 127.0.0.1 --port 4275',
      env: {
        NUXT_PUBLIC_CONVEX_URL: SHOWCASE_CONVEX_URL,
        NUXT_SHOWCASE_PRIVATE_KEY: SHOWCASE_PRIVATE_KEY,
      },
      url: 'http://127.0.0.1:4275',
    },
  ],
})
