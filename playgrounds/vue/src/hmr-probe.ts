import { shallowRef } from 'vue'

const updateCount = import.meta.hot?.data.updateCount ?? shallowRef(0)

if (import.meta.hot) {
  import.meta.hot.data.updateCount = updateCount
  import.meta.hot.accept(() => {
    updateCount.value += 1
  })
}

export const hmrUpdateCount = updateCount
