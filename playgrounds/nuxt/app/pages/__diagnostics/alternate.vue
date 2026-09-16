<script setup lang="ts">
const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)
</script>

<template>
  <DiagnosticBench
    :deployment-url="deploymentUrl"
    destination="/__diagnostics"
    destination-label="Open primary route"
    route-name="alternate route"
  />
</template>
