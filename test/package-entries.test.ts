import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

interface PackageExport {
  import: string
  types: string
}

interface PackageManifest {
  bugs: { url: string }
  exports: Record<string, PackageExport>
  homepage: string
  keywords: string[]
  main: string
  module: string
  name: string
  repository: { directory: string, type: string, url: string }
  types: string
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

  it('ships package-specific installation and support guidance', async () => {
    const packageDirectory = dirname(manifestPath)
    const readme = await readFile(resolve(packageDirectory, 'README.md'), 'utf8')

    expect(readme).toContain('## Install')
    expect(readme).toMatch(/Plain Vue|regular\s+Vue/)
    expect(readme).toContain('@j-boardman/convex-')
  })

  it('identifies its code, documentation, issues, and primary entry', async () => {
    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8'),
    ) as PackageManifest
    const primaryExport = manifest.exports['.']

    expect(manifest.repository).toMatchObject({
      type: 'git',
      url: 'git+https://github.com/j-boardman/convex-nuxt.git',
    })
    expect(manifest.repository.directory).toMatch(/^packages\/(vue|nuxt)$/)
    expect(manifest.homepage).toBe(
      'https://github.com/j-boardman/convex-nuxt#readme',
    )
    expect(manifest.bugs.url).toBe(
      'https://github.com/j-boardman/convex-nuxt/issues',
    )
    expect(manifest.keywords).toContain('convex')
    expect(manifest.main).toBe(primaryExport?.import)
    expect(manifest.module).toBe(primaryExport?.import)
    expect(manifest.types).toBe(primaryExport?.types)
  })
})
