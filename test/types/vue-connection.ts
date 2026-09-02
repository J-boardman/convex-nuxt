import type { ConnectionState } from 'convex/browser'
import { expectTypeOf } from 'vitest'
import { useConvexConnectionState } from '@j-boardman/convex-vue'

const connection = useConvexConnectionState()
expectTypeOf(connection.value).toEqualTypeOf<ConnectionState>()

// @ts-expect-error the connection ref is readonly to callers
connection.value = {
  connectionCount: 0,
  hasEverConnected: false,
  hasInflightRequests: false,
  isWebSocketConnected: false,
  timeOfOldestInflightRequest: null,
}
