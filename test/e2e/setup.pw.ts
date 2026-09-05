import { expect, test } from '@playwright/test'

const surfaces = {
  'nuxt-setup': {
    environmentName: 'NUXT_PUBLIC_CONVEX_URL',
    packageName: '@j-boardman/convex-nuxt',
    port: '4174',
  },
  'vue-setup': {
    environmentName: 'VITE_CONVEX_URL',
    packageName: '@j-boardman/convex-vue',
    port: '4173',
  },
} as const

test('an unconfigured app explains setup without starting Convex', async ({
  page,
}, testInfo) => {
  const surface = surfaces[testInfo.project.name as keyof typeof surfaces]
  const webSockets: string[] = []
  page.on('websocket', socket => webSockets.push(socket.url()))

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Connect a deployment.' }),
  ).toBeVisible()
  await expect(page.getByText(surface.environmentName, { exact: true })).toBeVisible()
  await expect(page.getByText(surface.packageName, { exact: true })).toBeVisible()
  expect(webSockets.filter(url => new URL(url).port !== surface.port)).toEqual([])
})
