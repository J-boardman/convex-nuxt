import { ConvexClient } from 'convex/browser'
import type { ConvexClientOptions } from 'convex/browser'
import { inject } from 'vue'
import type { App, InjectionKey, Plugin } from 'vue'
import type { ConvexAuthController } from './auth.js'

export type ConvexVueClientOptions = Omit<ConvexClientOptions, 'disabled'>

export interface ConvexVueOptions {
  client?: ConvexVueClientOptions
  url: string
}

/** @internal */
export interface ConvexVueRuntime {
  auth?: ConvexAuthController
  client: ConvexClient | null
  close: () => Promise<void>
  querySubscriptionsStarted: boolean
  url: string
}

interface ConvexVuePluginDependencies {
  createClient: (url: string, options: ConvexVueClientOptions) => ConvexClient
  isBrowser: () => boolean
}

const convexVueRuntimeKey: InjectionKey<ConvexVueRuntime> = Symbol.for(
  '@j-boardman/convex-vue/runtime',
)
const appRuntimes = new WeakMap<App, ConvexVueRuntime>()

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
      const existing = appRuntimes.get(app)

      if (existing) {
        if (existing.url !== options.url) {
          throw new Error(
            `Convex is already installed in this Vue application for ${existing.url}. `
            + `Close that runtime before installing ${options.url}.`,
          )
        }
        app.provide(convexVueRuntimeKey, existing)
        return
      }

      const client = dependencies.isBrowser()
        ? dependencies.createClient(options.url, options.client ?? {})
        : null
      let closePromise: Promise<void> | undefined

      const runtime: ConvexVueRuntime = {
        client,
        close(): Promise<void> {
          closePromise ??= (async () => {
            if (client && !client.closed) {
              await client.close()
            }
            if (appRuntimes.get(app) === runtime) {
              appRuntimes.delete(app)
            }
          })()
          return closePromise
        },
        querySubscriptionsStarted: false,
        url: options.url,
      }

      appRuntimes.set(app, runtime)
      app.provide(convexVueRuntimeKey, runtime)
      app.onUnmount(() => {
        void runtime.close()
      })
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

export function closeConvex(): Promise<void> {
  return useConvexRuntime().close()
}
