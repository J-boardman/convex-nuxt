// Runs the showcase locally: configures a local Convex deployment, makes sure
// the session-signing key exists, then starts Convex and Nuxt together.
import { execFileSync, spawn } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import process from 'node:process'
import { parseEnv } from 'node:util'
import { createPrivateKey, jwksFor } from './keys.mjs'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

async function readEnv(file) {
  try {
    return parseEnv(await readFile(file, 'utf8'))
  }
  catch {
    return {}
  }
}

// The first run asks how to set up the Convex project; later runs are quiet.
// Nothing is pushed yet: auth.config.ts needs SHOWCASE_JWKS first.
execFileSync(pnpm, ['exec', 'convex', 'dev', '--once', '--skip-push'], {
  stdio: 'inherit',
})

let privateKey = (await readEnv('.env')).NUXT_SHOWCASE_PRIVATE_KEY
if (!privateKey) {
  privateKey = await createPrivateKey()
  await appendFile('.env', `NUXT_SHOWCASE_PRIVATE_KEY=${privateKey}\n`)
}
execFileSync(pnpm, ['exec', 'convex', 'env', 'set', 'SHOWCASE_JWKS', jwksFor(privateKey)], {
  stdio: 'inherit',
})

const local = await readEnv('.env.local')
const url = local.CONVEX_URL ?? local.NUXT_PUBLIC_CONVEX_URL
const children = [
  // Seeding is idempotent, so every start can run it.
  spawn(pnpm, ['exec', 'convex', 'dev', '--run', 'seed:polls'], { stdio: 'inherit' }),
  spawn(pnpm, ['exec', 'nuxt', 'dev'], {
    env: { ...process.env, NUXT_PUBLIC_CONVEX_URL: url },
    stdio: 'inherit',
  }),
]

const stop = () => children.forEach(child => child.kill('SIGINT'))
for (const child of children) child.once('exit', stop)
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
