<script setup lang="ts">
const command = 'pnpm add @j-boardman/convex-nuxt convex'
const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(command)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1600)
}
</script>

<template>
  <div class="install">
    <code>{{ command }}</code>
    <button type="button" @click="copy">
      {{ copied ? 'Copied' : 'Copy' }}
    </button>
  </div>
</template>
