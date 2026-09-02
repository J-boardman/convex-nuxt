import { convexVue } from '@j-boardman/convex-vue'
import { createApp } from 'vue'
import App from './App.vue'
import SetupRequired from './SetupRequired.vue'
import './style.css'

const deploymentUrl = import.meta.env.VITE_CONVEX_URL

if (deploymentUrl) {
  createApp(App)
    .use(convexVue, { url: deploymentUrl })
    .mount('#app')
}
else {
  createApp(SetupRequired).mount('#app')
}
