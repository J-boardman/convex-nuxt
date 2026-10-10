import { convexVue } from '@j-boardman/convex-vue'
import { createApp } from 'vue'
import App from './App.vue'

createApp(App)
  .use(convexVue, { url: import.meta.env.VITE_CONVEX_URL })
  .mount('#app')
