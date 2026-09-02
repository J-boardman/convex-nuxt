import { addImports, addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { ConvexVueClientOptions } from '@j-boardman/convex-vue'
import type { NuxtModule } from '@nuxt/schema'
import { defu } from 'defu'
import { convexAutoImports } from './auto-imports.js'
import type { ConvexNuxtPublicRuntimeConfig } from './runtime/config.js'

export interface ModuleOptions {
  autoImports?: boolean
  client?: ConvexVueClientOptions
  url?: string
}

const convexNuxtModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@j-boardman/convex-nuxt',
    configKey: 'convex',
    compatibility: {
      nuxt: '>=4.5.0',
    },
  },
  defaults: {
    autoImports: true,
    client: {},
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const publicConfig = defu(
      nuxt.options.runtimeConfig.public.convex,
      {
        client: options.client,
        url: options.url ?? '',
      } satisfies ConvexNuxtPublicRuntimeConfig,
    ) as ConvexNuxtPublicRuntimeConfig

    nuxt.options.runtimeConfig.public.convex = publicConfig

    addPlugin({
      src: resolver.resolve('./runtime/plugin'),
    })

    if (options.autoImports) {
      addImports([...convexAutoImports])
    }
  },
})

export default convexNuxtModule

declare module '@nuxt/schema' {
  interface NuxtConfig {
    convex?: ModuleOptions
  }

  interface NuxtOptions {
    convex: ModuleOptions
  }
}
