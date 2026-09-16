<script setup lang="ts">
const config = useRuntimeConfig()
const deploymentUrl = String(config.public.convexPlaygroundUrl)
</script>

<template>
  <DiagnosticBench
    :deployment-url="deploymentUrl"
    destination="/__diagnostics/alternate"
    destination-label="Open alternate route"
    route-name="primary route"
  />
</template>
