import type { Ref } from 'vue'

interface ShowcaseNetwork {
  latency: number
  offline: boolean
  setLatency: (milliseconds: number) => void
  setOffline: (offline: boolean) => void
}

let controls: { latency: Ref<number>, offline: Ref<boolean> } | undefined

/** Shared, reactive controls for public/network-simulator.js (browser only). */
export function useNetwork() {
  if (controls) return controls
  const network = (window as unknown as { showcaseNetwork: ShowcaseNetwork }).showcaseNetwork
  const latency = ref(network.latency)
  const offline = ref(network.offline)
  // Detached, so the controls outlive whichever component asked first.
  effectScope(true).run(() => {
    watch(latency, value => network.setLatency(value))
    watch(offline, value => network.setOffline(value))
  })
  controls = { latency, offline }
  return controls
}
