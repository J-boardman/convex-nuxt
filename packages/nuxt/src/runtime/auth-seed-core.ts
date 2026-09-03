import type {
  ConvexAuthSeed,
  ConvexAuthSeedRequest,
} from '@j-boardman/convex-vue/adapter'
import { hash } from 'ohash'
import { computed } from 'vue'
import type { Ref } from 'vue'

export interface NuxtAuthSeedValue {
  readonly isAuthenticated: boolean
}

export interface NuxtAuthAsyncData {
  readonly data: Readonly<Ref<NuxtAuthSeedValue | undefined>>
}

export interface NuxtAuthSeedDependencies {
  prepareServerToken: (
    request: ConvexAuthSeedRequest,
  ) => (() => Promise<string | null>) | undefined
  useAsyncData: (
    key: string,
    handler: () => Promise<NuxtAuthSeedValue>,
    executeOnServer: boolean,
  ) => NuxtAuthAsyncData
}

export function useNuxtAuthSeed(
  deploymentUrl: string,
  request: ConvexAuthSeedRequest,
  dependencies: NuxtAuthSeedDependencies,
): ConvexAuthSeed {
  const loadToken = dependencies.prepareServerToken(request)
  const asyncData = dependencies.useAsyncData(
    `convex:auth:${hash(deploymentUrl)}`,
    async () => ({ isAuthenticated: Boolean(await loadToken?.()) }),
    Boolean(loadToken),
  )

  return {
    initialState: computed(() => asyncData.data.value),
  }
}
