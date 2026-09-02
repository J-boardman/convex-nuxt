import type { ConnectionState } from 'convex/browser'
import {
  getCurrentScope,
  onScopeDispose,
  shallowReadonly,
  shallowRef,
} from 'vue'
import type { ShallowRef } from 'vue'
import { useConvexClient } from './plugin.js'

export function useConvexConnectionState(): Readonly<ShallowRef<ConnectionState>> {
  const client = useConvexClient()
  const state = shallowRef<ConnectionState>(client.connectionState())
  const unsubscribe = client.subscribeToConnectionState((nextState) => {
    state.value = nextState
  })

  if (getCurrentScope()) {
    onScopeDispose(unsubscribe)
  }

  return shallowReadonly(state)
}
