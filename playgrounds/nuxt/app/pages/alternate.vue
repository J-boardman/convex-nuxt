<script setup lang="ts">
const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)
</script>

<template>
  <ConfiguredBench
    :deployment-url="deploymentUrl"
    destination="/"
    destination-label="Open primary route"
    route-name="alternate route"
  />
</template>
