import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

interface PackageExport {
  import: string
  types: string
}

interface PackageManifest {
  exports: Record<string, PackageExport>
  name: string
}

const packageManifestPaths = [
  'packages/vue/package.json',
  'packages/nuxt/package.json',
]

describe.each(packageManifestPaths)('%s', (manifestPath) => {
  it('publishes importable JavaScript with declarations for every entry', async () => {
    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8'),
    ) as PackageManifest
    const packageDirectory = dirname(manifestPath)

    for (const packageExport of Object.values(manifest.exports)) {
      const importPath = resolve(packageDirectory, packageExport.import)
      const typesPath = resolve(packageDirectory, packageExport.types)

      await expect(access(typesPath)).resolves.toBeUndefined()
      await expect(import(pathToFileURL(importPath).href)).resolves.toBeDefined()
    }
  })
})
