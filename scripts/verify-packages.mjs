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
  assert.equal(manifest.publishConfig?.provenance, true)
  assert.ok(manifest.files?.includes('dist'))
  assert.ok(!serializedManifest.includes('workspace:'))

  await access(join(unpacked, 'README.md'))
  await access(join(unpacked, 'LICENSE'))

  for (const target of exportTargets(manifest.exports)) {
    await access(join(unpacked, target))
  }

  return manifest
}

async function installConsumer(consumerRoot) {
  run(pnpm, [
    'install',
    '--ignore-scripts',
    '--no-frozen-lockfile',
  ], consumerRoot)
}

// One Nuxt consumer installs both tarballs, which also proves the Nuxt
// package resolves the Vue package it was published with.
async function verifyConsumer(temporaryRoot, vueArchive, nuxtArchive) {
  const consumerRoot = join(temporaryRoot, 'consumer')
  await mkdir(consumerRoot)

  await writeFile(join(consumerRoot, 'package.json'), JSON.stringify({
    name: 'packed-convex-nuxt-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@j-boardman/convex-nuxt': `file:${nuxtArchive}`,
      '@j-boardman/convex-vue': `file:${vueArchive}`,
      convex: '1.45.0',
      nuxt: '4.5.2',
      vue: '3.5.42',
    },
    devDependencies: {
      typescript: '5.9.3',
      'vue-tsc': '3.3.11',
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
import * as convexVue from '@j-boardman/convex-vue'
import * as nuxtRuntime from '@j-boardman/convex-nuxt/runtime'
import * as nuxtServer from '@j-boardman/convex-nuxt/server'

assert.equal(typeof convexNuxt, 'function')
assert.equal(typeof convexVue.convexVue, 'object')
assert.equal(typeof nuxtRuntime.useConvexQuery, 'function')
assert.equal(typeof nuxtServer.useConvexHttpClient, 'function')
`)

  await writeFile(join(consumerRoot, 'app.vue'), `
<script setup lang="ts">
const connection = useConvexConnectionState()
</script>

<template>
  <main>Connected: {{ connection.isWebSocketConnected }}</main>
</template>
`)

  await writeFile(join(consumerRoot, 'nuxt.config.ts'), `
export default defineNuxtConfig({
  modules: ['@j-boardman/convex-nuxt'],
  convex: { url: 'https://example.convex.cloud' },
})
`)

  await writeFile(join(consumerRoot, 'tsconfig.json'), JSON.stringify({
    extends: './.nuxt/tsconfig.json',
  }, null, 2))

  await installConsumer(consumerRoot)
  run(process.execPath, ['check.mjs'], consumerRoot)
  run(pnpm, ['exec', 'nuxt', 'typecheck'], consumerRoot)
  run(pnpm, ['exec', 'nuxt', 'build'], consumerRoot)
  run(
    pnpm,
    ['exec', 'nuxt', 'build', '--preset', 'cloudflare-module'],
    consumerRoot,
  )
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
