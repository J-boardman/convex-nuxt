import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

interface PackageManifest {
  devDependencies?: Record<string, string>
  scripts: Record<string, string>
}

async function readManifest(path: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as PackageManifest
}

describe('workspace development scripts', () => {
  it('starts both playgrounds and their shared backend from the root', async () => {
    const root = await readManifest('package.json')
    const backend = await readManifest('playgrounds/backend/package.json')

    expect(root.scripts.dev).toContain('run dev')
    expect(root.scripts.dev).toContain('@j-boardman/convex-playground-backend')
    expect(root.scripts.dev).toContain('@j-boardman/convex-vue-playground')
    expect(root.scripts.dev).toContain('@j-boardman/convex-nuxt-playground')
    expect(root.scripts).toMatchObject({
      'dev:backend': expect.stringContaining('convex-playground-backend'),
      'dev:nuxt': expect.stringContaining('convex-nuxt-playground'),
      'dev:vue': expect.stringContaining('convex-vue-playground'),
    })
    expect(backend.scripts.dev).toBe('convex dev')
  })

  it('prepares generated module and backend types before development', async () => {
    const root = await readManifest('package.json')

    expect(root.scripts['dev:prepare']).toContain('nuxt-module-build prepare')
    expect(root.scripts['dev:prepare']).toContain('run codegen')
  })

  it('builds public packages without treating playgrounds as artifacts', async () => {
    const root = await readManifest('package.json')

    expect(root.scripts.build).toContain('@j-boardman/convex-vue')
    expect(root.scripts.build).toContain('@j-boardman/convex-nuxt')
    expect(root.scripts.build).not.toContain('playground')
    expect(root.scripts.build).not.toContain('--recursive')
  })

  it('versions the two public packages through Changesets', async () => {
    const root = await readManifest('package.json')
    const config = JSON.parse(
      await readFile('.changeset/config.json', 'utf8'),
    ) as { access: string, fixed: string[][] }

    expect(root.scripts.changeset).toBe('changeset')
    expect(root.scripts.preview).toContain("pkg-pr-new publish --pnpm")
    expect(root.scripts.preview).toContain("'./packages/*'")
    expect(root.scripts['version-packages']).toBe('changeset version')
    expect(root.scripts.release).toBe('pnpm verify && changeset publish')
    expect(root.devDependencies?.['@changesets/cli']).toBe('3.0.1')
    expect(root.devDependencies?.['pkg-pr-new']).toBe('0.0.86')
    expect(config.access).toBe('public')
    expect(config.fixed).toEqual([[
      '@j-boardman/convex-vue',
      '@j-boardman/convex-nuxt',
    ]])
  })

  it('verifies the packages in the form npm consumers receive', async () => {
    const root = await readManifest('package.json')

    expect(root.scripts['test:package']).toContain('verify-packages.mjs')
    expect(root.devDependencies?.publint).toBe('0.3.24')
    expect(root.devDependencies?.['@arethetypeswrong/cli']).toBe('0.18.5')
  })

  it('runs every deterministic gate through verify', async () => {
    const root = await readManifest('package.json')

    expect(root.scripts['test:unit']).toContain('vitest run')
    expect(root.scripts['test:module']).toContain('test/nuxt')
    expect(root.scripts.test).toContain('test:unit')
    expect(root.scripts.test).toContain('test:module')
    expect(root.scripts.test).toContain('test:package')
    expect(root.scripts.verify).toBe('pnpm typecheck && pnpm lint && pnpm test')
  })
})
