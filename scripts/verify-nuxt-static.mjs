import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../playgrounds/backend/convex/_generated/api.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const convexUrl = process.env.CONVEX_URL
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

if (!convexUrl) {
  throw new Error(
    'test:live:static requires CONVEX_URL for a disposable or protected Convex deployment.',
  )
}

const label = `Nuxt static Relay post ${randomUUID()}`
const client = new ConvexHttpClient(convexUrl)

await client.mutation(api.social.createPost, {
  authorId: 'lin',
  body: label,
  requestId: `nuxt-static-${randomUUID()}`,
})

execFileSync(pnpm, [
  '--filter',
  '@j-boardman/convex-nuxt-playground',
  'exec',
  'nuxt',
  'generate',
], {
  cwd: root,
  env: {
    ...process.env,
    CONVEX_TEST_USERS: '',
    NUXT_PUBLIC_CONVEX_URL: convexUrl,
    NO_COLOR: '1',
  },
  stdio: 'inherit',
})

const html = await readFile(
  resolve(root, 'playgrounds/nuxt/.output/public/index.html'),
  'utf8',
)

assert.match(html, new RegExp(label))
process.stdout.write(
  `Static Nuxt HTML contains its Relay server payload: ${label}\n`,
)
