<script setup lang="ts">
import { setupConvexAuth } from '@j-boardman/convex-nuxt/runtime'

const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)
const authProbeEnabled = Boolean(config.public.convexAuthProbeEnabled)
const browserToken = ref<string | null>(null)
const browserTokenLoading = ref(authProbeEnabled)

let serverToken: (() => Promise<string | null>) | undefined
if (import.meta.server && authProbeEnabled) {
  const users = JSON.parse(String(config.convexTestUsers)) as Record<string, string>
  const requestedUser = useRequestHeader('x-convex-test-user')
  const requestToken = requestedUser ? users[requestedUser] ?? null : null
  serverToken = async () => requestToken
}

if (import.meta.client && authProbeEnabled) {
  onMounted(async () => {
    try {
      const response = await $fetch<{ token: string }>('/api/test-token')
      browserToken.value = response.token
    }
    finally {
      browserTokenLoading.value = false
    }
  })
}

if (deploymentUrl) {
  setupConvexAuth(() => ({
    fetchAccessToken: async () => browserToken.value,
    isAuthenticated: browserToken.value !== null,
    isLoading: browserTokenLoading.value,
  }), { serverToken })
}
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage v-if="deploymentUrl" />
  <SetupRequired v-else />
</template>
