import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendEnvironmentPath = resolve(
  root,
  'playgrounds/backend/.env.local',
)

const surfacePackages = {
  backend: '@j-boardman/convex-playground-backend',
  nuxt: '@j-boardman/convex-nuxt-playground',
  vue: '@j-boardman/convex-vue-playground',
}

export function createPlaygroundProcesses({
  backendEnvironment,
  inheritedEnvironment,
  pnpm,
  surface,
}) {
  const convexUrl = parseEnv(backendEnvironment).VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error(
      'The playground backend has no VITE_CONVEX_URL in its .env.local file.',
    )
  }

  const environments = {
    backend: { ...inheritedEnvironment },
    nuxt: {
      ...inheritedEnvironment,
      NUXT_PUBLIC_CONVEX_URL: convexUrl,
    },
    vue: {
      ...inheritedEnvironment,
      VITE_CONVEX_URL: convexUrl,
    },
  }
  const surfaces = surface === 'all'
    ? ['backend', 'vue', 'nuxt']
    : [surface]

  return surfaces.map(name => ({
    arguments: ['--filter', surfacePackages[name], 'run', 'dev'],
    command: pnpm,
    environment: environments[name],
    name,
  }))
}

function startProcess(specification) {
  return spawn(specification.command, specification.arguments, {
    cwd: root,
    env: specification.environment,
    stdio: 'inherit',
  })
}

async function run() {
  const surface = process.argv[2] ?? 'all'
  if (!['all', 'backend', 'nuxt', 'vue'].includes(surface)) {
    throw new Error(`Unknown playground surface: ${surface}`)
  }

  const backendEnvironment = await readFile(backendEnvironmentPath, 'utf8')
  const specifications = createPlaygroundProcesses({
    backendEnvironment,
    inheritedEnvironment: process.env,
    pnpm: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    surface,
  })
  const children = specifications.map(startProcess)
  let stopping = false

  const stop = (signal = 'SIGINT') => {
    if (stopping) return
    stopping = true
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal)
    }
  }

  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))

  const result = await Promise.race(children.map((child, index) =>
    new Promise((resolveExit, rejectExit) => {
      child.once('error', rejectExit)
      child.once('exit', (code, signal) => resolveExit({
        code,
        name: specifications[index].name,
        signal,
      }))
    }),
  ))

  stop()
  await Promise.all(children.map(child =>
    child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise(resolveExit => child.once('exit', resolveExit)),
  ))

  if (!stopping || (result.code !== 0 && result.signal === null)) {
    throw new Error(
      `${result.name} playground process exited with ${result.signal ?? `status ${result.code}`}.`,
    )
  }
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : undefined
if (entryPath === fileURLToPath(import.meta.url)) await run()
