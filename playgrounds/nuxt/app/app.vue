<script setup lang="ts">
import { setupConvexAuth } from '@j-boardman/convex-nuxt/runtime'

const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)

if (deploymentUrl) {
  setupConvexAuth(() => ({
    fetchAccessToken: async () => null,
    isAuthenticated: false,
    isLoading: false,
  }))
}
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage v-if="deploymentUrl" />
  <SetupRequired v-else />
</template>
