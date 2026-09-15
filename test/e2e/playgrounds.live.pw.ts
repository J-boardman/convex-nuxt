import { expect, test } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../playgrounds/backend/convex/_generated/api.js'

const convexUrl = process.env.CONVEX_URL

if (!convexUrl) {
  throw new Error('The live playground test requires CONVEX_URL.')
}

const surfaces = {
  'nuxt-live': {
    own: 'nuxt' as const,
    other: 'vue' as const,
    queryState: '.query-state',
    serverRendered: true,
    traceName: 'Nuxt event trace',
  },
  'vue-live': {
    own: 'vue' as const,
    other: 'nuxt' as const,
    queryState: '.query-status',
    serverRendered: false,
    traceName: 'Live event trace',
  },
} as const

async function seedBothSurfaces(stamp: string) {
  const client = new ConvexHttpClient(convexUrl as string)
  const labels: Record<'nuxt' | 'vue', string[]> = {
    nuxt: [],
    vue: [],
  }

  for (const surface of ['vue', 'nuxt'] as const) {
    for (let index = 0; index < 7; index += 1) {
      const label = `${surface} e2e ${stamp} / ${index + 1}`
      labels[surface].push(label)
      await client.mutation(api.probes.record, {
        label,
        requestId: `e2e-${stamp}-${surface}-${index}`,
        surface,
      })
    }
  }

  return labels
}

test('the integration crosses its complete live boundary', async ({
  page,
}, testInfo) => {
  const surface = surfaces[testInfo.project.name as keyof typeof surfaces]
  const stamp = `${testInfo.project.name}-${Date.now()}`
  const labels = await seedBothSurfaces(stamp)
  const browserHttpQueries: string[] = []
  const runtimeErrors: string[] = []
  const webSockets: string[] = []

  page.on('request', (request) => {
    if (
      request.method() === 'POST'
      && new URL(request.url()).pathname === '/api/query'
    ) {
      browserHttpQueries.push(request.url())
    }
  })
  page.on('console', (message) => {
    const text = message.text()
    const isRuntimeError = message.type() === 'error'
      && !text.startsWith('Failed to load resource:')
    if (isRuntimeError || /hydration/i.test(text)) {
      runtimeErrors.push(text)
    }
  })
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('websocket', socket => webSockets.push(socket.url()))

  const response = await page.goto('/')
  const rawHtml = await response?.text()

  if (surface.serverRendered) {
    expect(rawHtml).toContain(labels.nuxt[6])
  }
  else {
    expect(rawHtml).not.toContain(labels.vue[6])
  }

  const queryState = page.locator(surface.queryState)
  const trace = page.getByRole('region', { name: surface.traceName })
  await expect(queryState).toHaveAttribute('data-state', 'success')
  await expect(trace.getByText(labels[surface.own][6]!, { exact: true })).toBeVisible()
  expect(browserHttpQueries).toEqual([])
  await expect.poll(
    () => webSockets.some(url => new URL(url).port === '3210'),
  ).toBe(true)

  await page.getByTestId('query-enabled').uncheck()
  await expect(queryState).toHaveAttribute('data-state', 'skipped')
  await page.getByTestId('query-enabled').check()
  await expect(queryState).toHaveAttribute('data-state', 'success')

  await page.getByTestId('query-surface').selectOption(surface.other)
  await expect(queryState).toHaveAttribute('data-state', 'success')
  await expect(trace.getByText(labels[surface.other][6]!, { exact: true })).toBeVisible()

  const mutationLabel = `${surface.own} browser mutation ${stamp}`
  await page.getByLabel('Event label').fill(mutationLabel)
  await page.getByRole('button', { name: 'Record mutation' }).click()
  await expect(page.getByText('created one event', { exact: true })).toBeVisible()
  await page.getByTestId('query-surface').selectOption(surface.own)
  await expect(trace.getByText(mutationLabel, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Invoke action' }).click()
  await expect(page.getByText(/action \/ .*crossed the runtime boundary/i))
    .toBeVisible()

  const pageItems = page.locator('.page-items li')
  const loadedBefore = await pageItems.count()
  expect(loadedBefore).toBeGreaterThanOrEqual(3)
  await page.getByRole('button', { name: 'Load three more' }).click()
  await expect(pageItems).toHaveCount(loadedBefore + 3)
  expect(runtimeErrors).toEqual([])
})
