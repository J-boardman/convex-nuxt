<script setup lang="ts">
const { latency, offline } = useNetwork()
</script>

<template>
  <section class="hood-section" aria-labelledby="network-title">
    <h3 id="network-title">
      Network
    </h3>
    <label class="control">
      <span>Added latency <output>{{ latency }} ms</output></span>
      <input v-model.number="latency" type="range" min="0" max="3000" step="250">
    </label>
    <label class="control switch">
      <input v-model="offline" type="checkbox" role="switch">
      <span>Cut the connection to Convex</span>
    </label>
    <p class="hint">
      Cut the connection and vote: the bar moves at once, and the vote is sent
      when you reconnect. Other tabs catch up then.
    </p>
  </section>
</template>
