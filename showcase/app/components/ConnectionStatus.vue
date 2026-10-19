<script setup lang="ts">
const connection = useConvexConnectionState()
const { offline } = useNetwork()

const waiting = computed(() => connection.value.inflightMutations)
const label = computed(() => {
  if (offline.value) return 'Connection cut'
  return connection.value.isWebSocketConnected ? 'Live' : 'Connecting…'
})
</script>

<template>
  <p class="status" :data-state="offline ? 'cut' : connection.isWebSocketConnected ? 'live' : 'connecting'">
    <span class="status-dot" aria-hidden="true" />
    {{ label }}
    <span v-if="waiting > 0" class="status-waiting">
      · {{ waiting }} {{ waiting === 1 ? 'vote' : 'votes' }} waiting to send
    </span>
  </p>
</template>
