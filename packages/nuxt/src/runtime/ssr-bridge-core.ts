import {
  decodeConvexSsrSeed,
  encodeConvexSsrSeed,
} from '@j-boardman/convex-vue/adapter'
import type {
  ConvexQuerySeedRequest,
  ConvexSsrBridge,
  ConvexSsrSeed,
} from '@j-boardman/convex-vue/adapter'
import type { Value } from 'convex/values'
import { hash } from 'ohash'
import { computed } from 'vue'
import type { Ref } from 'vue'

export interface NuxtAsyncDataSeed {
  readonly data: Readonly<Ref<ConvexSsrSeed | undefined>>
  readonly error: Readonly<Ref<unknown>>
  readonly status: Readonly<Ref<'error' | 'idle' | 'pending' | 'success'>>
}

export interface NuxtSsrBridgeDependencies {
  createQueryLoader: (
    request: ConvexQuerySeedRequest,
  ) => () => Promise<Value>
  useAsyncData: (
    key: string,
    handler: () => Promise<ConvexSsrSeed>,
    enabled: boolean,
  ) => NuxtAsyncDataSeed
}

function normalizeError(error: unknown): Error | undefined {
  if (error === undefined || error === null) return undefined
  return error instanceof Error ? error : new Error(String(error))
}

export function createNuxtSsrBridge(
  deploymentUrl: string,
  dependencies: NuxtSsrBridgeDependencies,
  defaultServerRendering = true,
): ConvexSsrBridge {
  return {
    defaultServerRendering,
    name: 'nuxt',
    useQuerySeed<ValueType>(request: ConvexQuerySeedRequest) {
      const key = `convex:${hash([deploymentUrl, request.key])}`
      const loadQuery = request.enabled
        ? dependencies.createQueryLoader(request)
        : async (): Promise<Value> => {
            throw new Error('A disabled Convex SSR seed cannot be loaded.')
          }
      const asyncData = dependencies.useAsyncData(
        key,
        async () => encodeConvexSsrSeed(await loadQuery()),
        request.enabled,
      )

      return {
        data: computed<ValueType | undefined>(() => {
          const seed = asyncData.data.value
          return seed
            ? decodeConvexSsrSeed<ValueType & Value>(seed) as ValueType
            : undefined
        }),
        error: computed<Error | undefined>(() =>
          normalizeError(asyncData.error.value),
        ),
        pending: computed(() =>
          request.enabled && asyncData.status.value === 'pending',
        ),
      }
    },
  }
}
