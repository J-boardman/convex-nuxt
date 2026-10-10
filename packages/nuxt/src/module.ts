import { addImports, addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import { defu } from 'defu'
import type {
  ConvexNuxtClientOptions,
  ConvexNuxtPublicRuntimeConfig,
} from './runtime/config.js'

export type { ConvexNuxtClientOptions } from './runtime/config.js'

/** @internal */
export const convexComposables = [
  'setupConvexAuth',
  'useConvexAction',
  'useConvexAuth',
  'useConvexClient',
  'useConvexConnectionState',
  'useConvexMutation',
  'useConvexPaginatedQuery',
  'useConvexQuery',
  'useConvexQueries',
] as const

export interface ModuleOptions {
  client?: ConvexNuxtClientOptions
  ssr?: boolean
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
    client: {},
    ssr: true,
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const publicConfig = defu(
      nuxt.options.runtimeConfig.public.convex,
      {
        client: options.client,
        ssr: options.ssr,
        url: options.url ?? '',
      } satisfies ConvexNuxtPublicRuntimeConfig,
    ) as ConvexNuxtPublicRuntimeConfig

    nuxt.options.runtimeConfig.public.convex = publicConfig

    addPlugin({
      src: resolver.resolve('./runtime/plugin'),
    })

    addImports(convexComposables.map(name => ({
      from: '@j-boardman/convex-nuxt/runtime',
      name,
    })))
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
