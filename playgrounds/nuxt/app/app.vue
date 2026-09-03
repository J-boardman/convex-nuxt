<script setup lang="ts">
const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)
</script>

<template>
  <NuxtRouteAnnouncer />
  <ConfiguredBench v-if="deploymentUrl" :deployment-url="deploymentUrl" />
  <SetupRequired v-else />
</template>
