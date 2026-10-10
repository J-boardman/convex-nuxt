import { convexVue, useConvexClient } from '@j-boardman/convex-vue'
import { installConvexSsrBridge } from '@j-boardman/convex-vue/adapter'
import type {
  ConvexAuthSeedRequest,
  ConvexQuerySeedRequest,
} from '@j-boardman/convex-vue/adapter'
import type { Value } from 'convex/values'
import {
  defineNuxtPlugin,
  useAsyncData,
  useRequestEvent,
  useRuntimeConfig,
} from 'nuxt/app'
import type { Plugin } from 'nuxt/app'
import { createNuxtSsrBridge } from './bridge.js'
import type { NuxtBridgeDependencies } from './bridge.js'
import { deploymentUrl } from './config.js'

function createQueryLoader(
  request: ConvexQuerySeedRequest,
): () => Promise<Value> {
  if (import.meta.server) {
    const event = useRequestEvent()
    if (!event) {
      throw new Error('Convex SSR queries require an active Nuxt request.')
    }
    const config = useRuntimeConfig(event).public.convex

    return async () => {
      const { createConvexHttpClientForRequest } = await import(
        './server/request.js'
      )
      const client = await createConvexHttpClientForRequest({ config, event })
      return await client.query(request.query, request.args) as Value
    }
  }

  const client = useConvexClient()
  return async () => await client.query(request.query, request.args) as Value
}

function prepareServerToken(
  request: ConvexAuthSeedRequest,
): (() => Promise<string | null>) | undefined {
  if (!import.meta.server) return undefined

  const event = useRequestEvent()
  if (!event) {
    throw new Error('Convex auth seeds require an active Nuxt request.')
  }
  let tokenPromise: Promise<string | null> | undefined
  const loadToken = (): Promise<string | null> => {
    tokenPromise ??= request.serverToken?.() ?? Promise.resolve(null)
    return tokenPromise
  }
  event.context.convex = { token: loadToken }
  return loadToken
}

const dependencies: NuxtBridgeDependencies = {
  createQueryLoader,
  prepareServerToken,
  useAuthData: (key, handler, executeOnServer) => useAsyncData(key, handler, {
    deep: false,
    immediate: true,
    server: executeOnServer,
  }),
  useQueryData: (key, handler, enabled) => useAsyncData(key, handler, {
    deep: false,
    enabled,
    immediate: enabled,
    server: enabled,
  }),
}

const convexNuxtPlugin: Plugin<Record<string, never>> = defineNuxtPlugin({
  name: 'convex',
  enforce: 'pre',
  setup(nuxtApp) {
    const config = useRuntimeConfig().public.convex
    const url = deploymentUrl(config)
    // Without a URL the app stays inert, so a fresh project still typechecks.
    if (!url) return

    nuxtApp.vueApp.use(convexVue, { client: config.client, url })
    installConvexSsrBridge(
      nuxtApp.vueApp,
      createNuxtSsrBridge(url, dependencies, config.ssr ?? true),
    )
  },
})

export default convexNuxtPlugin
