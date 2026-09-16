import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

async function read(path: string) {
  return await readFile(path, 'utf8')
}

describe('shared playground presentation', () => {
  it('stays private and framework-neutral at the data boundary', async () => {
    const manifest = JSON.parse(
      await read('playgrounds/shared/package.json'),
    ) as {
      dependencies?: Record<string, string>
      name: string
      private: boolean
    }
    const component = await read(
      'playgrounds/shared/src/RelayExperience.vue',
    )

    expect(manifest).toMatchObject({
      name: '@j-boardman/convex-playground-shared',
      private: true,
    })
    expect(manifest.dependencies ?? {}).not.toHaveProperty('convex')
    expect(component).not.toMatch(/@j-boardman\/convex-(?:nuxt|vue)/)
    expect(component).not.toMatch(/useConvex|ConvexClient/)
  })

  it('is consumed by both playground applications', async () => {
    const [vueManifest, nuxtManifest] = await Promise.all([
      read('playgrounds/vue/package.json'),
      read('playgrounds/nuxt/package.json'),
    ])

    expect(JSON.parse(vueManifest).dependencies)
      .toHaveProperty('@j-boardman/convex-playground-shared', 'workspace:*')
    expect(JSON.parse(nuxtManifest).dependencies)
      .toHaveProperty('@j-boardman/convex-playground-shared', 'workspace:*')
  })
})
