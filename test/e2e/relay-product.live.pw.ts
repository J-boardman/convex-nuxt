import { expect, test } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../playgrounds/backend/convex/_generated/api.js'
import { belongsToConvexDeployment } from './live-deployment'

const convexUrl = process.env.CONVEX_URL

if (!convexUrl) {
  throw new Error('The live Relay test requires CONVEX_URL.')
}

test('the Vue playground behaves like a live Relay workspace', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'vue-live')

  const client = new ConvexHttpClient(convexUrl)
  const stamp = Date.now()
  const externalPost = `Posted from another client ${stamp}`
  const browserPost = `Vue shared an update ${stamp}`
  const browserMessage = `Vue joined the room ${stamp}`
  const runtimeErrors: string[] = []
  const sockets: string[] = []

  await client.mutation(api.social.ensureDemoData, {})
  page.on('console', (message) => {
    if (message.type() === 'error'
      && !message.text().startsWith('Failed to load resource:')) {
      runtimeErrors.push(message.text())
    }
  })
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('websocket', socket => sockets.push(socket.url()))

  const response = await page.goto('/')
  expect(await response?.text()).not.toContain('The new feed is running')
  await expect(page.locator('.relay')).toHaveAttribute('data-runtime', 'vue')
  await expect(page.getByRole('heading', { name: 'Good morning, Ada.' }))
    .toBeVisible()
  await expect(page.locator('.relay-post')).not.toHaveCount(0)
  await expect.poll(() => sockets.some(socket =>
    belongsToConvexDeployment(socket, convexUrl),
  )).toBe(true)

  await client.mutation(api.social.createPost, {
    authorId: 'lin',
    body: externalPost,
    requestId: `vue-external-${stamp}`,
  })
  await expect(page.getByText(externalPost, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Share an update/ }).click()
  await page.getByLabel('Share an update with the studio').fill(browserPost)
  await page.getByRole('button', { name: 'Post update' }).click()
  await expect(page.getByText(browserPost, { exact: true })).toBeVisible()

  const firstReaction = page.locator('.relay-post').first()
    .locator('.relay-reaction')
  await firstReaction.click()
  await expect(firstReaction).toHaveAttribute('aria-pressed', 'true')

  await page.getByLabel('Message the studio').fill(browserMessage)
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText(browserMessage, { exact: true })).toBeVisible()

  await expect(page.getByRole('link', { name: 'Diagnostics' }))
    .toHaveAttribute('href', '/__diagnostics')
  await expect(page.getByTestId('hmr-update-count')).toHaveText('hmr 0')
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('relay-vue-desktop.png'),
  })
  await page.setViewportSize({ height: 844, width: 390 })
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' }))
    .toBeVisible()
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('relay-vue-mobile.png'),
  })
  expect(runtimeErrors).toEqual([])
})
