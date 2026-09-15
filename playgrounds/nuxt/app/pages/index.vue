<script setup lang="ts">
const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)
</script>

<template>
  <ConfiguredBench
    :deployment-url="deploymentUrl"
    destination="/alternate"
    destination-label="Open alternate route"
    route-name="primary route"
  />
</template>
