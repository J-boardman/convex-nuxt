import type {
  ConvexAuthSeedRequest,
  ConvexQuerySeedRequest,
  ConvexSsrBridge,
} from '@j-boardman/convex-vue/adapter'
import { convexToJson, jsonToConvex } from 'convex/values'
import type { JSONValue, Value } from 'convex/values'
import { hash } from 'ohash'
import { computed } from 'vue'
import type { Ref } from 'vue'

export interface NuxtAuthSeedValue {
  readonly isAuthenticated: boolean
}

/**
 * The Nuxt calls the bridge makes, injected so the payload behaviour can be
 * tested without a Nuxt application.
 */
export interface NuxtBridgeDependencies {
  createQueryLoader: (
    request: ConvexQuerySeedRequest,
  ) => () => Promise<Value>
  prepareServerToken: (
    request: ConvexAuthSeedRequest,
  ) => (() => Promise<string | null>) | undefined
  useAuthData: (
    key: string,
    handler: () => Promise<NuxtAuthSeedValue>,
    executeOnServer: boolean,
  ) => { readonly data: Readonly<Ref<NuxtAuthSeedValue | undefined>> }
  useQueryData: (
    key: string,
    handler: () => Promise<JSONValue>,
    enabled: boolean,
  ) => {
    readonly data: Readonly<Ref<JSONValue | undefined>>
    readonly error: Readonly<Ref<unknown>>
    readonly status: Readonly<Ref<'error' | 'idle' | 'pending' | 'success'>>
  }
}

function toError(error: unknown): Error | undefined {
  if (error === undefined || error === null) return undefined
  return error instanceof Error ? error : new Error(String(error))
}

export function createNuxtSsrBridge(
  deploymentUrl: string,
  dependencies: NuxtBridgeDependencies,
  defaultServerRendering = true,
): ConvexSsrBridge {
  return {
    defaultServerRendering,
    name: 'nuxt',
    useAuthSeed(request) {
      const loadToken = dependencies.prepareServerToken(request)
      const asyncData = dependencies.useAuthData(
        `convex:auth:${hash(deploymentUrl)}`,
        async () => ({ isAuthenticated: Boolean(await loadToken?.()) }),
        Boolean(loadToken),
      )
      return { initialState: computed(() => asyncData.data.value) }
    },
    useQuerySeed<ValueType>(request: ConvexQuerySeedRequest) {
      // Hashing keeps query arguments out of the payload keys.
      const key = `convex:${hash([deploymentUrl, request.key])}`
      const loadQuery = request.enabled
        ? dependencies.createQueryLoader(request)
        : async (): Promise<Value> => {
            throw new Error('A disabled Convex SSR seed cannot be loaded.')
          }
      const asyncData = dependencies.useQueryData(
        key,
        async () => convexToJson(await loadQuery()),
        request.enabled,
      )

      return {
        data: computed(() => {
          const seed = asyncData.data.value
          return seed === undefined ? undefined : jsonToConvex(seed) as ValueType
        }),
        error: computed(() => toError(asyncData.error.value)),
        pending: computed(() =>
          request.enabled && asyncData.status.value === 'pending',
        ),
      }
    },
  }
}
