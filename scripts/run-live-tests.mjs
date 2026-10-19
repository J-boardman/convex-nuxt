import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createPrivateKey, jwksFor } from '../showcase/scripts/keys.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
// Upgrade deliberately: newer artifacts can require newer host libraries.
const backendVersion = 'precompiled-2026-09-28-5c7cb5b'

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      ...options,
    })
    child.once('error', rejectRun)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun()
      }
      else {
        rejectRun(new Error(
          `${command} exited with ${signal ?? `status ${code ?? 'unknown'}`}.`,
        ))
      }
    })
  })
}

function reservePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer()
    server.once('error', rejectPort)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        rejectPort(new Error('Could not reserve a local Convex port.'))
        return
      }
      const { port } = address
      server.close(error => error ? rejectPort(error) : resolvePort(port))
    })
  })
}

// Shares the Convex CLI's cache, so a binary it already fetched is reused.
async function ensureBackendBinary() {
  const directory = join(homedir(), '.cache/convex/binaries', backendVersion)
  const binary = join(directory, 'convex-local-backend')
  if (existsSync(binary)) return binary

  const targets = {
    'darwin-arm64': 'aarch64-apple-darwin',
    'darwin-x64': 'x86_64-apple-darwin',
    'linux-arm64': 'aarch64-unknown-linux-gnu',
    'linux-x64': 'x86_64-unknown-linux-gnu',
  }
  const target = targets[`${process.platform}-${process.arch}`]
  if (!target) {
    throw new Error(`No Convex backend artifact for ${process.platform}-${process.arch}.`)
  }

  const archive = join(directory, 'backend.zip')
  await mkdir(directory, { recursive: true })
  await run('curl', [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--output',
    archive,
    `https://github.com/get-convex/convex-backend/releases/download/${backendVersion}/convex-local-backend-${target}.zip`,
  ])
  await run('unzip', ['-o', '-q', archive, '-d', directory])
  await rm(archive)
  return binary
}

async function waitForBackend(url, child) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`The Convex backend exited with status ${child.exitCode}.`)
    }
    try {
      if ((await globalThis.fetch(`${url}/version`)).ok) return
    }
    catch {
      // Not listening yet.
    }
    await delay(500)
  }
  throw new Error('Timed out waiting for the disposable Convex backend.')
}

/**
 * Starts a disposable backend and deploys a copy of `project`'s convex/
 * folder to it, so a run can never touch the developer's own deployment.
 */
async function startBackend(project, { env = {}, seed } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'convex-nuxt-live-'))
  await cp(resolve(root, project, 'convex'), join(directory, 'convex'), {
    filter: source => !source.endsWith('.env.local'),
    recursive: true,
  })
  await cp(resolve(root, project, 'package.json'), join(directory, 'package.json'))
  await symlink(resolve(root, 'node_modules'), join(directory, 'node_modules'))

  const cloudPort = await reservePort()
  let sitePort = await reservePort()
  while (sitePort === cloudPort) sitePort = await reservePort()
  const url = `http://127.0.0.1:${cloudPort}`
  const binary = await ensureBackendBinary()
  const instance = [
    '--instance-name',
    'convex-nuxt-live',
    '--instance-secret',
    randomBytes(32).toString('hex'),
  ]
  const adminKey = execFileSync(binary, ['keygen', 'admin-key', ...instance])
    .toString()
    .trim()
  const child = spawn(binary, [
    ...instance,
    '--interface',
    '127.0.0.1',
    '--port',
    String(cloudPort),
    '--site-proxy-port',
    String(sitePort),
    '--local-storage',
    join(directory, 'storage'),
    join(directory, 'backend.sqlite3'),
  ], {
    cwd: directory,
    stdio: ['ignore', 'ignore', 'inherit'],
  })

  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolveExit => child.once('exit', resolveExit))
      child.kill('SIGTERM')
      await exited
    }
    await rm(directory, { force: true, recursive: true })
  }

  try {
    await waitForBackend(url, child)
    const convex = (...args) => run(pnpm, ['exec', 'convex', ...args], {
      cwd: directory,
      env: {
        ...process.env,
        CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey,
        CONVEX_SELF_HOSTED_URL: url,
      },
    })
    for (const [name, value] of Object.entries(env)) {
      await convex('env', 'set', name, value)
    }
    await convex('deploy', '--yes')
    if (seed) await convex('run', seed)
    return { stop, url }
  }
  catch (error) {
    await stop()
    throw error
  }
}

const backends = []
try {
  const showcaseKey = await createPrivateKey()
  const started = await Promise.allSettled([
    startBackend('examples/backend'),
    startBackend('showcase', {
      env: { SHOWCASE_JWKS: jwksFor(showcaseKey) },
      seed: 'seed:polls',
    }),
  ])
  for (const result of started) {
    if (result.status === 'fulfilled') backends.push(result.value)
  }
  const failure = started.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
  const [examples, showcase] = backends

  await run(pnpm, ['exec', 'playwright', 'test'], {
    env: {
      ...process.env,
      CONVEX_URL: examples.url,
      SHOWCASE_CONVEX_URL: showcase.url,
      SHOWCASE_PRIVATE_KEY: showcaseKey,
    },
  })
}
finally {
  await Promise.all(backends.map(backend => backend.stop()))
}
