import { ConvexClient } from 'convex/browser'
import type { ConvexClientOptions } from 'convex/browser'
import { inject, shallowRef } from 'vue'
import type { App, InjectionKey, Plugin, ShallowRef } from 'vue'
import type { ConvexAuthController } from './auth.js'

export type ConvexVueClientOptions = Omit<ConvexClientOptions, 'disabled'>

export interface ConvexVueOptions {
  client?: ConvexVueClientOptions
  url: string
}

/** @internal */
export interface ConvexVueRuntime {
  auth?: ConvexAuthController
  authEpoch: ShallowRef<number>
  client: ConvexClient | null
  querySubscriptionsStarted: boolean
}

interface ConvexVuePluginDependencies {
  createClient: (url: string, options: ConvexVueClientOptions) => ConvexClient
  isBrowser: () => boolean
}

const convexVueRuntimeKey: InjectionKey<ConvexVueRuntime> = Symbol.for(
  '@j-boardman/convex-vue/runtime',
)

const defaultDependencies: ConvexVuePluginDependencies = {
  createClient: (url, options) => new ConvexClient(url, options),
  isBrowser: () => typeof window !== 'undefined',
}

/** @internal */
export function useConvexRuntime(): ConvexVueRuntime {
  const runtime = inject(convexVueRuntimeKey)
  if (!runtime) {
    throw new Error(
      'Convex is not installed in this Vue application. '
      + 'Call app.use(convexVue, { url }) before using Convex composables.',
    )
  }
  return runtime
}

function validateOptions(options: ConvexVueOptions | undefined): ConvexVueOptions {
  if (!options || typeof options.url !== 'string' || options.url.length === 0) {
    throw new Error('convexVue requires a non-empty string url option.')
  }
  return options
}

/** @internal */
export function createConvexVuePlugin(
  dependencies: ConvexVuePluginDependencies = defaultDependencies,
): Plugin<[ConvexVueOptions]> {
  return {
    install(app: App, suppliedOptions: ConvexVueOptions): void {
      const options = validateOptions(suppliedOptions)
      const client = dependencies.isBrowser()
        ? dependencies.createClient(options.url, options.client ?? {})
        : null

      app.provide(convexVueRuntimeKey, {
        authEpoch: shallowRef(0),
        client,
        querySubscriptionsStarted: false,
      })
      if (client) {
        app.onUnmount(() => void client.close())
      }
    },
  }
}

export const convexVue: Plugin<[ConvexVueOptions]> = createConvexVuePlugin()

export function useConvexClient(): ConvexClient {
  const runtime = useConvexRuntime()
  if (!runtime.client) {
    throw new Error(
      'useConvexClient() is browser-only. '
      + 'Use createConvexHttpClient() from @j-boardman/convex-vue/server during SSR.',
    )
  }
  if (runtime.client.closed) {
    throw new Error('The Convex client for this Vue application is closed.')
  }
  return runtime.client
}
