import { defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'

export interface ModuleOptions {
  url?: string
}

const convexNuxtModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@j-boardman/convex-nuxt',
    configKey: 'convex',
  },
  defaults: {},
  setup() {},
})

export default convexNuxtModule
