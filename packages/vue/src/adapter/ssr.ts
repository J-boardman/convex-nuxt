import { inject } from 'vue'
import type { App, InjectionKey, Ref } from 'vue'
import type { FunctionReference } from 'convex/server'
import type { Value } from 'convex/values'

export interface ConvexQuerySeed<ValueType> {
  readonly data: Readonly<Ref<ValueType | undefined>>
  readonly error: Readonly<Ref<Error | undefined>>
  readonly pending: Readonly<Ref<boolean>>
}

export interface ConvexQuerySeedRequest {
  readonly args: Record<string, Value>
  readonly enabled: boolean
  readonly key: string
  readonly query: FunctionReference<'query'>
}

export interface ConvexAuthSeed {
  readonly initialState: Readonly<Ref<{
    isAuthenticated: boolean
  } | undefined>>
}

export interface ConvexAuthSeedRequest {
  readonly serverToken?: () => Promise<string | null>
}

export interface ConvexSsrBridge {
  readonly name: string
  useAuthSeed?: (request: ConvexAuthSeedRequest) => ConvexAuthSeed
  useQuerySeed<ValueType>(
    request: ConvexQuerySeedRequest,
  ): ConvexQuerySeed<ValueType>
}

const convexSsrBridgeKey: InjectionKey<ConvexSsrBridge> = Symbol.for(
  '@j-boardman/convex-vue/ssr-bridge',
)

export function installConvexSsrBridge(
  app: App,
  bridge: ConvexSsrBridge,
): void {
  app.provide(convexSsrBridgeKey, bridge)
}

/** @internal */
export function useConvexSsrBridge(): ConvexSsrBridge | undefined {
  return inject(convexSsrBridgeKey, undefined)
}
