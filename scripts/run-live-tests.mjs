import { spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import {
  generateKeyPairSync,
  sign as signPayload,
} from 'node:crypto'
import {
  cp,
  copyFile,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const authAudience = 'convex-nuxt-live'
const authIssuer = 'https://convex-nuxt-live.test'
const authKeyId = 'convex-nuxt-live-key'

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function createTestAuth() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })
  const publicJwk = {
    ...publicKey.export({ format: 'jwk' }),
    alg: 'RS256',
    kid: authKeyId,
    use: 'sig',
  }
  const jwks = Buffer.from(JSON.stringify({ keys: [publicJwk] }))
    .toString('base64')
  const authConfig = `
import type { AuthConfig } from 'convex/server'

export default {
  providers: [{
    type: 'customJwt',
    applicationID: '${authAudience}',
    issuer: '${authIssuer}',
    jwks: 'data:application/json;base64,${jwks}',
    algorithm: 'RS256',
  }],
} satisfies AuthConfig
`.trimStart()

  const now = Math.floor(Date.now() / 1000)
  const token = (subject) => {
    const encoded = `${encodeJson({
      alg: 'RS256',
      kid: authKeyId,
      typ: 'JWT',
    })}.${encodeJson({
      aud: authAudience,
      exp: now + 3600,
      iat: now,
      iss: authIssuer,
      sub: subject,
    })}`
    const signature = signPayload('RSA-SHA256', Buffer.from(encoded), privateKey)
      .toString('base64url')
    return `${encoded}.${signature}`
  }

  const subjects = { alpha: 'live-user-alpha', beta: 'live-user-beta' }
  return {
    authConfig,
    subjects,
    users: {
      alpha: token(subjects.alpha),
      beta: token(subjects.beta),
    },
  }
}

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

function waitForBackend(child) {
  return new Promise((resolveReady, rejectReady) => {
    let output = ''
    const timeout = setTimeout(() => {
      rejectReady(new Error('Timed out waiting for the disposable Convex backend.'))
    }, 120_000)

    const inspect = (chunk) => {
      const text = chunk.toString()
      output += text
      process.stderr.write(text)
      if (output.includes('Convex functions ready!')) {
        clearTimeout(timeout)
        resolveReady()
      }
    }

    child.stdout.on('data', inspect)
    child.stderr.on('data', inspect)
    child.once('error', (error) => {
      clearTimeout(timeout)
      rejectReady(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      rejectReady(new Error(
        `Disposable Convex backend exited before it was ready (${signal ?? code}).`,
      ))
    })
  })
}

async function stopBackend(child) {
  if (child.exitCode !== null || child.signalCode !== null) return

  child.kill('SIGINT')
  await new Promise((resolveExit) => {
    const force = setTimeout(() => child.kill('SIGTERM'), 10_000)
    child.once('exit', () => {
      clearTimeout(force)
      resolveExit()
    })
  })
}

async function runAgainst(convexUrl, testAuth) {
  await run(pnpm, ['run', 'test:live:against'], {
    env: {
      ...process.env,
      ...(testAuth
        ? {
            CONVEX_TEST_SUBJECT_ALPHA: testAuth.subjects.alpha,
            CONVEX_TEST_SUBJECT_BETA: testAuth.subjects.beta,
            CONVEX_TEST_USERS: JSON.stringify(testAuth.users),
          }
        : {}),
      CONVEX_URL: convexUrl,
    },
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
    const testAuth = createTestAuth()

    await cp(
      resolve(root, 'playgrounds/backend/convex'),
      join(temporaryRoot, 'convex'),
      { recursive: true },
    )
    await copyFile(
      resolve(root, 'playgrounds/backend/convex.json'),
      join(temporaryRoot, 'convex.json'),
    )
    await copyFile(
      resolve(root, 'playgrounds/backend/package.json'),
      join(temporaryRoot, 'package.json'),
    )
    await writeFile(
      join(temporaryRoot, 'convex/auth.config.ts'),
      testAuth.authConfig,
    )
    await symlink(
      resolve(root, 'node_modules'),
      join(temporaryRoot, 'node_modules'),
    )

    backend = spawn(pnpm, [
      'exec',
      'convex',
      'dev',
      '--local-cloud-port',
      String(cloudPort),
      '--local-site-port',
      String(sitePort),
      '--tail-logs',
      'disable',
    ], {
      cwd: temporaryRoot,
      env: {
        ...process.env,
        CONVEX_AGENT_MODE: 'anonymous',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    await waitForBackend(backend)
    await runAgainst(`http://127.0.0.1:${cloudPort}`, testAuth)
  }
  finally {
    if (backend) await stopBackend(backend)
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
