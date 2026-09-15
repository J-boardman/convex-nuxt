<script setup lang="ts">
import { setupConvexAuth } from '@j-boardman/convex-nuxt/runtime'
import {
  convexAuthProbeKey,
  type AuthProbeUser,
} from './auth-probe'

const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)
const authProbeEnabled = Boolean(config.public.convexAuthProbeEnabled)
const browserToken = ref<string | null>(null)
const browserTokenLoading = ref(authProbeEnabled)
const activeTestUser = ref<AuthProbeUser | 'signedOut'>('alpha')
const tokenFetchCount = ref(0)

async function loadTestUser(user: AuthProbeUser) {
  const response = await $fetch<{ token: string }>('/api/test-token', {
    query: { user },
  })
  browserToken.value = response.token
  activeTestUser.value = user
}

provide(convexAuthProbeKey, authProbeEnabled
  ? {
      activeUser: readonly(activeTestUser),
      tokenFetchCount: readonly(tokenFetchCount),
      refresh: () => loadTestUser('alphaRefresh'),
      signIn: loadTestUser,
      signOut: () => {
        activeTestUser.value = 'signedOut'
        browserToken.value = null
      },
    }
  : undefined)

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
      await loadTestUser('alpha')
    }
    finally {
      browserTokenLoading.value = false
    }
  })
}

if (deploymentUrl) {
  setupConvexAuth(() => ({
    fetchAccessToken: async () => {
      tokenFetchCount.value += 1
      return browserToken.value
    },
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
