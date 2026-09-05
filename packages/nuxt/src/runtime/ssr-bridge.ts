import {
  installConvexSsrBridge,
} from '@j-boardman/convex-vue/adapter'
import type {
  ConvexAuthSeedRequest,
  ConvexQuerySeedRequest,
  ConvexSsrSeed,
} from '@j-boardman/convex-vue/adapter'
import { useConvexClient } from '@j-boardman/convex-vue'
import type { Value } from 'convex/values'
import { useAsyncData, useRequestEvent, useRuntimeConfig } from 'nuxt/app'
import type { App } from 'vue'
import {
  createNuxtSsrBridge,
} from './ssr-bridge-core.js'
import { useNuxtAuthSeed } from './auth-seed-core.js'
import type {
  NuxtAuthAsyncData,
  NuxtAuthSeedDependencies,
  NuxtAuthSeedValue,
} from './auth-seed-core.js'
import type {
  NuxtAsyncDataSeed,
  NuxtSsrBridgeDependencies,
} from './ssr-bridge-core.js'

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
      const client = await createConvexHttpClientForRequest({
        config,
        event,
      })
      return await client.query(request.query, request.args) as Value
    }
  }

  const client = useConvexClient()
  return async () => await client.query(request.query, request.args) as Value
}

function useQueryAsyncData(
  key: string,
  handler: () => Promise<ConvexSsrSeed>,
  enabled: boolean,
): NuxtAsyncDataSeed {
  return useAsyncData(key, handler, {
    deep: false,
    enabled,
    immediate: enabled,
    server: enabled,
  })
}

const nuxtBridgeDependencies: NuxtSsrBridgeDependencies = {
  createQueryLoader,
  useAsyncData: useQueryAsyncData,
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
  const context = event.context as typeof event.context & {
    convex?: { token: () => Promise<string | null> }
  }
  context.convex = { token: loadToken }
  return loadToken
}

function useAuthAsyncData(
  key: string,
  handler: () => Promise<NuxtAuthSeedValue>,
  executeOnServer: boolean,
): NuxtAuthAsyncData {
  return useAsyncData(key, handler, {
    deep: false,
    immediate: executeOnServer,
    server: true,
  })
}

const nuxtAuthSeedDependencies: NuxtAuthSeedDependencies = {
  prepareServerToken,
  useAsyncData: useAuthAsyncData,
}

export function installNuxtSsrBridge(
  app: App,
  deploymentUrl: string,
  defaultServerRendering: boolean,
): void {
  const queryBridge = createNuxtSsrBridge(
    deploymentUrl,
    nuxtBridgeDependencies,
    defaultServerRendering,
  )
  installConvexSsrBridge(
    app,
    {
      ...queryBridge,
      useAuthSeed: request => useNuxtAuthSeed(
        deploymentUrl,
        request,
        nuxtAuthSeedDependencies,
      ),
    },
  )
}
