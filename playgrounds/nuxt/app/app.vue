<script setup lang="ts">
const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)
</script>

<template>
  <NuxtRouteAnnouncer />
  <ClientOnly v-if="deploymentUrl">
    <ConfiguredBench :deployment-url="deploymentUrl" />
    <template #fallback>
      <main class="shell loading-shell">
        <p class="overline">Nuxt integration playground</p>
        <h1>Hydrating the signal bench.</h1>
      </main>
    </template>
  </ClientOnly>
  <SetupRequired v-else />
</template>
