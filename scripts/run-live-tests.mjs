import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import {
  cp,
  mkdir,
  mkdtemp,
  rm,
  symlink,
} from 'node:fs/promises'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

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

async function stopBackend(child) {
  if (child.exitCode !== null || child.signalCode !== null) return

  const exited = new Promise(resolveExit => child.once('exit', resolveExit))
  child.kill('SIGTERM')
  await exited
}

function runAgainst(convexUrl) {
  return run(pnpm, ['exec', 'playwright', 'test'], {
    env: { ...process.env, CONVEX_URL: convexUrl },
  })
}

if (process.env.CONVEX_URL) {
  await runAgainst(process.env.CONVEX_URL)
}
else {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'convex-nuxt-live-'))
  let backend

  try {
    const cloudPort = await reservePort()
    let sitePort = await reservePort()
    while (sitePort === cloudPort) sitePort = await reservePort()
    const convexUrl = `http://127.0.0.1:${cloudPort}`

    // Deploy a copy so the run cannot touch the developer's own deployment.
    await cp(
      resolve(root, 'examples/backend'),
      temporaryRoot,
      {
        filter: source => !/(?:node_modules|\.env\.local)$/.test(source),
        recursive: true,
      },
    )
    await symlink(
      resolve(root, 'node_modules'),
      join(temporaryRoot, 'node_modules'),
    )

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

    backend = spawn(binary, [
      ...instance,
      '--interface',
      '127.0.0.1',
      '--port',
      String(cloudPort),
      '--site-proxy-port',
      String(sitePort),
      '--local-storage',
      join(temporaryRoot, 'storage'),
      join(temporaryRoot, 'backend.sqlite3'),
    ], {
      cwd: temporaryRoot,
      stdio: ['ignore', 'ignore', 'inherit'],
    })

    await waitForBackend(convexUrl, backend)
    await run(pnpm, ['exec', 'convex', 'deploy', '--yes'], {
      cwd: temporaryRoot,
      env: {
        ...process.env,
        CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey,
        CONVEX_SELF_HOSTED_URL: convexUrl,
      },
    })
    await runAgainst(convexUrl)
  }
  finally {
    if (backend) await stopBackend(backend)
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
