import { convexVue } from '@j-boardman/convex-vue'
import type { App } from 'vue'
import { resolveConvexRuntimeOptions } from './config.js'

export function installConvexRuntime(app: App, config: unknown): void {
  app.use(convexVue, resolveConvexRuntimeOptions(config))
}
