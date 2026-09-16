import { expect, test } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../playgrounds/backend/convex/_generated/api.js'
import { belongsToConvexDeployment } from './live-deployment'

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
  request,
}, testInfo) => {
  const surface = surfaces[testInfo.project.name as keyof typeof surfaces]
  const stamp = `${testInfo.project.name}-${Date.now()}`
  const labels = await seedBothSurfaces(stamp)
  const browserHttpQueries: string[] = []
  const expectedRollbackErrors: string[] = []
  const openWebSockets = new Map<number, string>()
  const runtimeErrors: string[] = []
  const webSockets: string[] = []
  let webSocketId = 0
  const alphaSubject = process.env.CONVEX_TEST_SUBJECT_ALPHA
  const betaSubject = process.env.CONVEX_TEST_SUBJECT_BETA
  const testUsers = process.env.CONVEX_TEST_USERS

  if (surface.own === 'nuxt' && alphaSubject && betaSubject && testUsers) {
    const users = JSON.parse(testUsers) as Record<string, string>
    const [alphaResponse, betaResponse] = await Promise.all([
      request.get('/', { headers: { 'x-convex-test-user': 'alpha' } }),
      request.get('/', { headers: { 'x-convex-test-user': 'beta' } }),
    ])
    const [alphaHtml, betaHtml] = await Promise.all([
      alphaResponse.text(),
      betaResponse.text(),
    ])

    expect(alphaHtml).toContain(alphaSubject)
    expect(alphaHtml).not.toContain(betaSubject)
    expect(betaHtml).toContain(betaSubject)
    expect(betaHtml).not.toContain(alphaSubject)
    for (const html of [alphaHtml, betaHtml]) {
      for (const token of Object.values(users)) {
        expect(html).not.toContain(token)
      }
    }
  }

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
    const isExpectedRollback = text.includes('[CONVEX M(probes:rejectOptimistic)]')
      && text.includes('Intentional playground rejection for optimistic rollback.')
    if (isExpectedRollback) {
      expectedRollbackErrors.push(text)
      return
    }
    const isRuntimeError = message.type() === 'error'
      && !text.startsWith('Failed to load resource:')
    if (isRuntimeError || /hydration/i.test(text)) {
      runtimeErrors.push(text)
    }
  })
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('websocket', (socket) => {
    const id = webSocketId
    webSocketId += 1
    webSockets.push(socket.url())
    openWebSockets.set(id, socket.url())
    socket.on('close', () => openWebSockets.delete(id))
  })

  if (surface.own === 'nuxt' && alphaSubject) {
    await page.addInitScript(() => {
      const authStates: string[] = []
      Object.defineProperty(window, '__convexAuthStates', { value: authStates })
      const recordAuthState = () => {
        const state = document
          .querySelector('[data-testid="auth-state"]')
          ?.getAttribute('data-state')
        if (state && authStates.at(-1) !== state) authStates.push(state)
      }
      new MutationObserver(recordAuthState).observe(document, {
        attributeFilter: ['data-state'],
        attributes: true,
        childList: true,
        subtree: true,
      })
      document.addEventListener('DOMContentLoaded', recordAuthState)
    })
  }

  const response = await page.goto(
    surface.own === 'vue' ? '/__diagnostics' : '/',
  )
  const rawHtml = await response?.text()
  const pageItems = page.locator('.page-items li')
  const paginationState = page.getByTestId('pagination-state')
  const loadMore = page.getByRole('button', { name: 'Load three more' })

  if (surface.serverRendered) {
    expect(rawHtml).toContain(labels.nuxt[6])
    await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true')
    if (alphaSubject) {
      expect(rawHtml).toContain(alphaSubject)
      await expect(page.getByTestId('auth-state'))
        .toHaveAttribute('data-state', 'authenticated')
      await expect(page.getByTestId('viewer-subject')).toHaveText(alphaSubject)
      const authStates = await page.evaluate(() =>
        (window as typeof window & { __convexAuthStates?: string[] })
          .__convexAuthStates ?? [],
      )
      expect(authStates).toContain('authenticated')
      expect(authStates).not.toContain('loading')
      expect(authStates).not.toContain('unauthenticated')
      expect(authStates).not.toContain('error')

      const authSession = page.getByTestId('auth-probe-session')
      const initialFetchCount = Number(
        await authSession.getAttribute('data-fetch-count'),
      )
      await page.getByRole('button', { name: 'Refresh session' }).click()
      await expect(authSession).toHaveAttribute('data-user', 'alphaRefresh')
      await expect.poll(async () => Number(
        await authSession.getAttribute('data-fetch-count'),
      )).toBeGreaterThan(initialFetchCount)
      await expect(page.getByTestId('auth-state'))
        .toHaveAttribute('data-state', 'authenticated')
      await expect(page.getByTestId('viewer-subject')).toHaveText(alphaSubject)

      await page.getByRole('button', { name: 'Switch to beta' }).click()
      await expect(authSession).toHaveAttribute('data-user', 'beta')
      await expect(page.getByTestId('viewer-subject')).toHaveText(betaSubject)
      await expect(page.getByTestId('auth-state'))
        .toHaveAttribute('data-state', 'authenticated')

      await page.getByRole('button', { name: 'Sign out' }).click()
      await expect(authSession).toHaveAttribute('data-user', 'signedOut')
      await expect(page.getByTestId('auth-state'))
        .toHaveAttribute('data-state', 'unauthenticated')
      await expect(page.getByTestId('client-auth-subject')).toHaveText('anonymous')
      await expect(page.getByTestId('viewer-subject')).toHaveText('anonymous')

      await page.getByRole('button', { name: 'Sign in as alpha' }).click()
      await expect(authSession).toHaveAttribute('data-user', 'alpha')
      await expect(page.getByTestId('auth-state'))
        .toHaveAttribute('data-state', 'authenticated')
      await expect(page.getByTestId('viewer-subject')).toHaveText(alphaSubject)
    }
    await expect(pageItems).toHaveCount(3)
    await loadMore.click()
    await expect(pageItems).toHaveCount(6)
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
    () => webSockets.some(url => belongsToConvexDeployment(url, convexUrl)),
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

  const atomicState = page.getByTestId('atomic-query-state')
  await expect(atomicState).toHaveAttribute('data-state', 'ready')
  await page.getByRole('button', { name: 'Prove atomic queries' }).click()
  await expect(atomicState).toHaveAttribute('data-state', 'complete')
  await expect(atomicState).toHaveAttribute('data-mixed', 'false')

  await page.getByRole('button', { name: 'Prove optimistic rollback' }).click()
  const optimisticState = page.getByTestId('optimistic-state')
  await expect(optimisticState).toHaveAttribute('data-state', 'rolledBack')
  await expect(optimisticState).toHaveAttribute('data-seen', 'true')
  await expect(trace.getByText('Optimistic value awaiting rollback')).toHaveCount(0)
  await expect(trace.getByText(mutationLabel, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Invoke action' }).click()
  await expect(page.getByText(/action \/ .*crossed the runtime boundary/i))
    .toBeVisible()

  await expect(pageItems).not.toHaveCount(0)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await paginationState.getAttribute('data-state') === 'exhausted') break

    const loadedBefore = await pageItems.count()
    await loadMore.click()
    await expect.poll(async () =>
      await paginationState.getAttribute('data-state') === 'exhausted'
      || await pageItems.count() > loadedBefore,
    ).toBe(true)
  }
  await expect(paginationState).toHaveAttribute('data-state', 'exhausted')
  const probeIds = await pageItems.evaluateAll(items =>
    items.map(item => (item as HTMLElement).dataset.probeId),
  )
  expect(new Set(probeIds).size).toBe(probeIds.length)

  if (surface.own === 'vue') {
    const deploymentSocketCount = () => [...openWebSockets.values()]
      .filter(url => belongsToConvexDeployment(url, convexUrl))
      .length

    expect(deploymentSocketCount()).toBe(1)
    await expect(page.getByTestId('hmr-update-count')).toHaveText('0')
    await page.evaluate(async () => {
      const response = await fetch('/__convex-hmr-probe', { method: 'POST' })
      if (!response.ok) {
        throw new Error(`HMR probe failed with status ${response.status}.`)
      }
    })
    await expect(page.getByTestId('hmr-update-count')).toHaveText('1')
    expect(deploymentSocketCount()).toBe(1)
    expect(webSockets.filter(url =>
      belongsToConvexDeployment(url, convexUrl),
    )).toHaveLength(1)
    await expect(queryState).toHaveAttribute('data-state', 'success')
    await expect(trace.getByText(mutationLabel, { exact: true })).toBeVisible()

    await page.evaluate(() => {
      const remount = (window as typeof window & {
        __remountConvexPlayground?: () => void
      }).__remountConvexPlayground
      if (!remount) throw new Error('Vue remount probe is unavailable.')
      remount()
    })

    await expect(queryState).toHaveAttribute('data-state', 'success')
    await expect(trace.getByText(mutationLabel, { exact: true })).toBeVisible()
    await expect.poll(() => webSockets.filter(url =>
      belongsToConvexDeployment(url, convexUrl),
    ).length).toBe(2)
    await expect.poll(deploymentSocketCount).toBe(1)

    const remountLabel = `vue remount mutation ${stamp}`
    await page.getByLabel('Event label').fill(remountLabel)
    await page.getByRole('button', { name: 'Record mutation' }).click()
    await expect(page.getByText('created one event', { exact: true })).toBeVisible()
    await expect(trace.getByText(remountLabel, { exact: true })).toBeVisible()
  }

  if (surface.own === 'nuxt') {
    const deploymentSockets = () => webSockets.filter(url =>
      belongsToConvexDeployment(url, convexUrl),
    )

    expect(deploymentSockets()).toHaveLength(1)
    await page.getByRole('link', { name: 'Open alternate route' }).click()
    await expect(page).toHaveURL('/alternate')
    await expect(page.getByText('runtime / 002 · alternate route')).toBeVisible()
    await expect(queryState).toHaveAttribute('data-state', 'success')
    await expect(trace.getByText(mutationLabel, { exact: true })).toBeVisible()
    expect(browserHttpQueries).toEqual([])
    expect(deploymentSockets()).toHaveLength(1)

    await page.getByRole('link', { name: 'Open primary route' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('runtime / 002 · primary route')).toBeVisible()
    await expect(queryState).toHaveAttribute('data-state', 'success')
    expect(deploymentSockets()).toHaveLength(1)
  }

  expect(expectedRollbackErrors).toHaveLength(1)
  expect(runtimeErrors).toEqual([])
})
