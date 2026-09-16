import { expect, test } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../playgrounds/backend/convex/_generated/api.js'
import { belongsToConvexDeployment } from './live-deployment'

const convexUrl = process.env.CONVEX_URL

if (!convexUrl) {
  throw new Error('The live Relay test requires CONVEX_URL.')
}

const surfaces = {
  'nuxt-live': {
    externalAuthorId: 'ada',
    label: 'Nuxt',
    runtime: 'nuxt',
    serverRendered: true,
    viewer: {
      id: 'lin',
      name: 'Lin Martin',
    },
  },
  'vue-live': {
    externalAuthorId: 'lin',
    label: 'Vue',
    runtime: 'vue',
    serverRendered: false,
    viewer: {
      id: 'ada',
      name: 'Ada Bell',
    },
  },
} as const

test('the playground behaves like a live Relay workspace', async ({
  page,
}, testInfo) => {
  const surface = surfaces[testInfo.project.name as keyof typeof surfaces]
  const client = new ConvexHttpClient(convexUrl)
  const stamp = Date.now()
  const initialPost = `Initial server post ${surface.runtime} ${stamp}`
  const externalPost = `Posted from another client ${stamp}`
  const browserPost = `${surface.label} shared an update ${stamp}`
  const browserMessage = `${surface.label} joined the room ${stamp}`
  const browserHttpQueries: string[] = []
  const runtimeErrors: string[] = []
  const sockets: string[] = []

  await client.mutation(api.social.ensureDemoData, {})
  await client.mutation(api.social.createPost, {
    authorId: 'sam',
    body: initialPost,
    requestId: `initial-${surface.runtime}-${stamp}`,
  })
  page.on('console', (message) => {
    if (message.type() === 'error'
      && !message.text().startsWith('Failed to load resource:')) {
      runtimeErrors.push(message.text())
    }
  })
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('websocket', socket => sockets.push(socket.url()))
  page.on('request', (request) => {
    if (request.method() === 'POST'
      && new URL(request.url()).pathname === '/api/query') {
      browserHttpQueries.push(request.url())
    }
  })

  const response = await page.goto('/')
  const rawHtml = await response?.text()
  if (surface.serverRendered) {
    expect(rawHtml).toContain(initialPost)
    await expect(page.getByTestId('hydration-state'))
      .toHaveAttribute('data-hydrated', 'true')
  }
  else {
    expect(rawHtml).not.toContain(initialPost)
  }
  await expect(page.locator('.relay'))
    .toHaveAttribute('data-runtime', surface.runtime)
  await expect(page.getByRole('heading', {
    name: `Good morning, ${surface.viewer.name.split(' ')[0]}.`,
  }))
    .toBeVisible()
  await expect(page.locator('.relay-post')).not.toHaveCount(0)
  await expect.poll(() => sockets.some(socket =>
    belongsToConvexDeployment(socket, convexUrl),
  )).toBe(true)

  await client.mutation(api.social.createPost, {
    authorId: surface.externalAuthorId,
    body: externalPost,
    requestId: `${surface.runtime}-external-${stamp}`,
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
  await expect.poll(async () => {
    const feed = await client.query(api.social.listPosts, {
      actorId: surface.viewer.id,
      paginationOpts: { cursor: null, numItems: 20 },
    })
    const createdPost = feed.page.find(post => post.body === browserPost)
    return {
      authorId: createdPost?.author.id,
      isReacted: createdPost?.isReacted,
    }
  }).toEqual({
    authorId: surface.viewer.id,
    isReacted: true,
  })

  await page.getByLabel('Message the studio').fill(browserMessage)
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText(browserMessage, { exact: true })).toBeVisible()
  await expect.poll(async () => {
    const messages = await client.query(api.social.listMessages, {})
    return messages.find(message => message.body === browserMessage)?.author.id
  }).toBe(surface.viewer.id)

  await expect(page.getByRole('link', { name: 'Diagnostics' }))
    .toHaveAttribute('href', '/__diagnostics')
  if (surface.runtime === 'vue') {
    await expect(page.getByTestId('hmr-update-count')).toHaveText('hmr 0')
  }

  if (surface.runtime === 'nuxt') {
    const deploymentSockets = () => sockets.filter(socket =>
      belongsToConvexDeployment(socket, convexUrl),
    )
    expect(deploymentSockets()).toHaveLength(1)
    await page.getByRole('link', { name: 'Alternate view' }).click()
    await expect(page).toHaveURL('/alternate')
    await expect(page.getByText('alternate route', { exact: true }))
      .toBeVisible()
    await expect(page.getByText(browserPost, { exact: true })).toBeVisible()
    expect(deploymentSockets()).toHaveLength(1)
    await page.getByRole('link', { name: 'Primary view' }).click()
    await expect(page).toHaveURL('/')
    expect(deploymentSockets()).toHaveLength(1)
  }

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`relay-${surface.runtime}-desktop.png`),
  })
  await page.setViewportSize({ height: 844, width: 390 })
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' }))
    .toBeVisible()
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`relay-${surface.runtime}-mobile.png`),
  })
  expect(browserHttpQueries).toEqual([])
  expect(runtimeErrors).toEqual([])
})
