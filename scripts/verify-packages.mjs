import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function run(command, args, cwd = root) {
  execFileSync(command, args, {
    cwd,
    env: {
      ...process.env,
      COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
      NO_COLOR: '1',
    },
    stdio: 'inherit',
  })
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function exportTargets(exports) {
  return Object.values(exports).flatMap((entry) => {
    if (typeof entry === 'string') {
      return [entry]
    }

    return Object.values(entry).filter((value) => typeof value === 'string')
  })
}

async function verifyArchive(packageRoot, archive, extractionRoot) {
  run(pnpm, ['--dir', packageRoot, 'pack', '--out', archive])
  run(pnpm, ['exec', 'publint', 'run', archive, '--strict'])
  run(pnpm, [
    'exec',
    'attw',
    archive,
    '--profile',
    'esm-only',
    '--no-definitely-typed',
  ])

  await mkdir(extractionRoot, { recursive: true })
  run('tar', ['-xzf', archive, '-C', extractionRoot])

  const unpacked = join(extractionRoot, 'package')
  const manifest = await readJson(join(unpacked, 'package.json'))
  const serializedManifest = JSON.stringify(manifest)

  assert.equal(manifest.license, 'Apache-2.0')
  assert.equal(manifest.publishConfig?.access, 'public')
  assert.ok(manifest.files?.includes('dist'))
  assert.ok(!serializedManifest.includes('workspace:'))

  await access(join(unpacked, 'README.md'))
  await access(join(unpacked, 'LICENSE'))

  for (const target of exportTargets(manifest.exports)) {
    await access(join(unpacked, target))
  }

  return manifest
}

async function verifyConsumer(temporaryRoot, vueArchive, nuxtArchive) {
  const consumerRoot = join(temporaryRoot, 'consumer')
  await mkdir(consumerRoot)

  await writeFile(join(consumerRoot, 'package.json'), JSON.stringify({
    name: 'packed-convex-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@j-boardman/convex-nuxt': `file:${nuxtArchive}`,
      '@j-boardman/convex-vue': `file:${vueArchive}`,
      convex: '1.45.0',
      nuxt: '4.5.2',
      typescript: '5.9.3',
      vue: '3.5.42',
    },
  }, null, 2))

  await writeFile(join(consumerRoot, 'pnpm-workspace.yaml'), `
packages:
  - .

overrides:
  '@j-boardman/convex-vue': file:${vueArchive}
`)

  await writeFile(join(consumerRoot, 'check.mjs'), `
import assert from 'node:assert/strict'
import convexNuxt from '@j-boardman/convex-nuxt'
import * as nuxtRuntime from '@j-boardman/convex-nuxt/runtime'
import * as nuxtServer from '@j-boardman/convex-nuxt/server'
import * as convexVue from '@j-boardman/convex-vue'
import * as vueAdapter from '@j-boardman/convex-vue/adapter'
import * as vueServer from '@j-boardman/convex-vue/server'

assert.equal(typeof convexNuxt, 'function')
assert.equal(typeof nuxtRuntime.useConvexQuery, 'function')
assert.equal(typeof nuxtServer.useConvexHttpClient, 'function')
assert.equal(typeof convexVue.convexVue, 'object')
assert.equal(typeof convexVue.useConvexPaginatedQuery, 'function')
assert.equal(typeof vueAdapter.installConvexSsrBridge, 'function')
assert.equal(typeof vueServer.createConvexHttpClient, 'function')
`)

  await writeFile(join(consumerRoot, 'check.ts'), `
import convexNuxt from '@j-boardman/convex-nuxt'
import type { ModuleOptions } from '@j-boardman/convex-nuxt'
import {
  useConvexHttpClient,
  type UseConvexHttpClientOptions,
} from '@j-boardman/convex-nuxt/server'
import {
  convexVue,
  useConvexPaginatedQuery,
  useConvexQuery,
  type ConvexVueOptions,
} from '@j-boardman/convex-vue'
import { installConvexSsrBridge } from '@j-boardman/convex-vue/adapter'
import { createConvexHttpClient } from '@j-boardman/convex-vue/server'

const moduleOptions: ModuleOptions = { url: 'https://example.convex.cloud' }
const vueOptions: ConvexVueOptions = { url: 'https://example.convex.cloud' }
const serverOptions: UseConvexHttpClientOptions = { token: null }

void convexNuxt
void moduleOptions
void vueOptions
void serverOptions
void convexVue
void useConvexQuery
void useConvexPaginatedQuery
void useConvexHttpClient
void installConvexSsrBridge
void createConvexHttpClient
`)

  await writeFile(join(consumerRoot, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      lib: ['ES2022', 'DOM'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: 'ES2022',
    },
    include: ['check.ts'],
  }, null, 2))

  run(pnpm, [
    'install',
    '--ignore-scripts',
    '--no-frozen-lockfile',
  ], consumerRoot)
  run(process.execPath, ['check.mjs'], consumerRoot)
  run(pnpm, ['exec', 'tsc', '--project', 'tsconfig.json'], consumerRoot)
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'convex-packages-'))

try {
  const vueArchive = join(temporaryRoot, 'convex-vue.tgz')
  const nuxtArchive = join(temporaryRoot, 'convex-nuxt.tgz')

  const [vueManifest, nuxtManifest] = await Promise.all([
    verifyArchive(
      join(root, 'packages/vue'),
      vueArchive,
      join(temporaryRoot, 'vue'),
    ),
    verifyArchive(
      join(root, 'packages/nuxt'),
      nuxtArchive,
      join(temporaryRoot, 'nuxt'),
    ),
  ])

  assert.equal(vueManifest.name, '@j-boardman/convex-vue')
  assert.equal(nuxtManifest.name, '@j-boardman/convex-nuxt')
  assert.equal(nuxtManifest.version, vueManifest.version)
  assert.equal(
    nuxtManifest.dependencies['@j-boardman/convex-vue'],
    vueManifest.version,
  )

  await verifyConsumer(temporaryRoot, vueArchive, nuxtArchive)
  process.stdout.write(
    'Packed Vue and Nuxt packages passed publication checks.\n',
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
