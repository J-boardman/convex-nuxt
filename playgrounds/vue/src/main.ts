import { convexVue } from '@j-boardman/convex-vue'
import { createApp } from 'vue'
import type { App as VueApp } from 'vue'
import App from './App.vue'
import DiagnosticBench from './DiagnosticBench.vue'
import SetupRequired from './SetupRequired.vue'

const deploymentUrl = import.meta.env.VITE_CONVEX_URL

async function mountPlayground() {
  if (!deploymentUrl) {
    await import('./style.css')
    createApp(SetupRequired).mount('#app')
    return
  }

  const diagnostics = window.location.pathname === '/__diagnostics'
  if (diagnostics) await import('./style.css')
  else await import('@j-boardman/convex-playground-shared/style.css')

  let app: VueApp<Element>
  const mount = () => {
    app = createApp(diagnostics ? DiagnosticBench : App)
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

void mountPlayground()
