import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../examples/backend/convex/_generated/api.js'

const convex = new ConvexHttpClient(process.env.CONVEX_URL as string)

async function storedTask(text: string) {
  const tasks = await convex.query(api.tasks.list, {})
  return tasks.find(task => task.text === text)
}

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydration/i.test(message.text())) {
      errors.push(message.text())
    }
  })
  return errors
}

test('tasks stay live from first render through writes', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  const stamp = `${testInfo.project.name} ${Date.now()}`
  const seeded = `seeded ${stamp}`
  await convex.mutation(api.tasks.add, { text: seeded })

  await page.goto('/')
  await expect(page.getByText(seeded)).toBeVisible()

  const remote = `remote ${stamp}`
  await convex.mutation(api.tasks.add, { text: remote })
  await expect(page.getByText(remote), 'another client\'s write arrives live')
    .toBeVisible()

  const local = `local ${stamp}`
  await page.getByLabel('New task').fill(local)
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText(local)).toBeVisible()
  await expect.poll(async () => await storedTask(local)).toBeDefined()

  await page.getByRole('checkbox', { name: local }).check()
  await expect.poll(async () => (await storedTask(local))?.isCompleted).toBe(true)

  expect(errors).toEqual([])
})

test('Nuxt hydrates the server result without waiting for Convex', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'nuxt', 'Only Nuxt server-renders.')
  const errors = collectErrors(page)
  const seeded = `server rendered ${Date.now()}`
  await convex.mutation(api.tasks.add, { text: seeded })

  const html = await (await request.get('/')).text()
  expect(html, 'the server renders the query result').toContain(seeded)

  // Hold the WebSocket open without answering, so anything on screen after
  // hydration must have come from the server payload.
  await page.routeWebSocket(/\/api\/.*\/sync$/, () => {})
  await page.goto('/')
  await page.waitForFunction(() =>
    Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)
      ?.__vue_app__))

  await expect(page.getByText(seeded)).toBeVisible()
  await expect(page.getByText('Loading…')).toHaveCount(0)
  expect(errors).toEqual([])
})
