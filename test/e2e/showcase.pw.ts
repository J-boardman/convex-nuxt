import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../showcase/convex/_generated/api.js'

const convex = new ConvexHttpClient(process.env.SHOWCASE_CONVEX_URL as string)

async function storedCounts(question: string) {
  const polls = await convex.query(api.polls.list, {})
  return polls.find(poll => poll.question === question)?.counts
}

function side(page: Page, question: string, option: string) {
  return page
    .getByRole('group', { name: question })
    .getByRole('button', { name: new RegExp(`^${option}\\b`) })
}

async function visitor(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    // Web fonts load from Google; only this app's own errors count.
    const fromApp = message.location().url.startsWith('http://127.0.0.1')
    if ((message.type() === 'error' && fromApp) || /hydration/i.test(message.text())) {
      errors.push(message.text())
    }
  })
  await page.goto('/')
  // The status line renders only after hydration, once Convex is connected.
  await expect(page.locator('.status')).toHaveText('Live')
  return { context, errors, page }
}

test('each visitor\'s server HTML already shows their own picks', async ({ browser }) => {
  const ada = await visitor(browser)
  await side(ada.page, 'Coffee or tea?', 'Tea').click()
  const picked = /aria-pressed="true"[^>]*>\s*<span class="option">Tea</

  await expect.poll(async () => await (await ada.context.request.get('/')).text())
    .toMatch(picked)

  const stranger = await browser.newContext()
  const strangerHtml = await (await stranger.request.get('/')).text()
  expect(strangerHtml, 'another visitor does not see Ada\'s pick').not.toMatch(picked)
  expect(strangerHtml, 'no token or key reaches the page').not.toContain('eyJ')

  const name = /You are voting as <strong>([^<]+)</
  const serverName = (await (await ada.context.request.get('/')).text()).match(name)?.[1]
  await ada.page.reload()
  await expect(ada.page.locator('.voter strong')).toHaveText(serverName ?? 'missing')
  expect(ada.errors).toEqual([])
})

test('votes travel live between visitors', async ({ browser }) => {
  const watcher = await visitor(browser)
  const voter = await visitor(browser)
  const before = (await storedCounts('Light mode or dark mode?'))?.[0] ?? 0

  await side(voter.page, 'Light mode or dark mode?', 'Light').click()

  await expect(side(watcher.page, 'Light mode or dark mode?', 'Light'))
    .toContainText(`${before + 1} vote`)
  expect([...watcher.errors, ...voter.errors]).toEqual([])
})

test('a vote cast while the connection is cut is sent when it returns', async ({
  browser,
}) => {
  const { errors, page } = await visitor(browser)
  const before = (await storedCounts('Ship on Friday?'))?.[0] ?? 0

  await page.getByRole('button', { name: 'Under the hood' }).click()
  await page.getByRole('switch', { name: 'Cut the connection to Convex' }).check()
  await side(page, 'Ship on Friday?', 'Ship it').click()

  await expect(side(page, 'Ship on Friday?', 'Ship it'))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.status')).toContainText('1 vote waiting to send')
  expect((await storedCounts('Ship on Friday?'))?.[0]).toBe(before)

  await page.getByRole('switch', { name: 'Cut the connection to Convex' }).uncheck()
  await expect.poll(async () => (await storedCounts('Ship on Friday?'))?.[0])
    .toBe(before + 1)
  await expect(page.locator('.status')).toHaveText('Live')
  expect(errors).toEqual([])
})

test('recent votes page through older history', async ({ browser }) => {
  // Seven votes from one visitor, so a fresh page's first six are not all.
  const history = await visitor(browser)
  const polls = await convex.query(api.polls.list, {})
  const picks = polls.map(poll => [poll.question, poll.options[0] ?? ''] as const)
  picks.push([polls[0]?.question ?? '', polls[0]?.options[1] ?? ''])
  for (const [question, option] of picks) {
    await side(history.page, question, option).click()
    await expect(side(history.page, question, option)).toHaveAttribute('aria-pressed', 'true')
  }
  await expect.poll(async () => (await convex.query(api.activity.recent, {
    paginationOpts: { cursor: null, numItems: 10 },
  })).page.length).toBeGreaterThan(6)

  const { errors, page } = await visitor(browser)
  await expect(page.locator('.feed-item')).toHaveCount(6)
  await page.getByRole('button', { name: 'Show older votes' }).click()
  await expect.poll(async () => await page.locator('.feed-item').count())
    .toBeGreaterThan(6)
  expect([...history.errors, ...errors]).toEqual([])
})

test('the page is usable from server HTML before Convex answers', async ({ page }) => {
  // Hold the socket open without answering, so everything on screen after
  // hydration must have come from the server payload.
  await page.routeWebSocket(/\/api\/.*\/sync$/, () => {})
  await page.goto('/')
  await page.waitForFunction(() =>
    Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)
      ?.__vue_app__))

  await expect(page.locator('.voter strong')).not.toBeEmpty()
  await expect(page.getByRole('group', { name: 'Tabs or spaces?' })).toBeVisible()
  await expect(page.locator('.feed-title')).toHaveText('Recent votes')
})
