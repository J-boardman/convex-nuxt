import {
  installConvexSsrBridge,
} from '@j-boardman/convex-vue/adapter'
import type {
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

export function installNuxtSsrBridge(app: App, deploymentUrl: string): void {
  installConvexSsrBridge(
    app,
    createNuxtSsrBridge(deploymentUrl, nuxtBridgeDependencies),
  )
}
