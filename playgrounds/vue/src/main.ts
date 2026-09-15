import { convexVue } from '@j-boardman/convex-vue'
import { createApp } from 'vue'
import type { App as VueApp } from 'vue'
import App from './App.vue'
import SetupRequired from './SetupRequired.vue'
import './style.css'

const deploymentUrl = import.meta.env.VITE_CONVEX_URL

if (deploymentUrl) {
  let app: VueApp<Element>
  const mount = () => {
    app = createApp(App)
    app.use(convexVue, { url: deploymentUrl })
    app.mount('#app')
  }

  mount()

  if (import.meta.env.DEV) {
    const playgroundWindow = window as typeof window & {
      __remountConvexPlayground?: () => void
    }
    playgroundWindow.__remountConvexPlayground = () => {
      app.unmount()
      mount()
    }
  }
}
else {
  createApp(SetupRequired).mount('#app')
}
