// Starts the example backend, then both example apps against the local
// deployment URL that `convex dev` writes to examples/backend/.env.local.
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const children = []

function start(example, env = {}) {
  const child = spawn(pnpm, ['--filter', `@j-boardman/convex-example-${example}`, 'dev'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
  children.push(child)
  child.once('exit', stop)
}

function stop() {
  for (const child of children) child.kill('SIGINT')
}

async function deploymentUrl() {
  for (;;) {
    try {
      const env = parseEnv(await readFile(resolve(root, 'examples/backend/.env.local'), 'utf8'))
      if (env.CONVEX_URL) return env.CONVEX_URL
    }
    catch {
      // `convex dev` has not written the file yet.
    }
    await delay(500)
  }
}

process.once('SIGINT', stop)
process.once('SIGTERM', stop)

start('backend')
const url = await deploymentUrl()
start('vue', { VITE_CONVEX_URL: url })
start('nuxt', { NUXT_PUBLIC_CONVEX_URL: url })
