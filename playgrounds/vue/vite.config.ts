import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const hmrProbePath = '/src/hmr-probe.ts'

function convexHmrProbe(): Plugin {
  return {
    name: 'convex-hmr-probe',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__convex-hmr-probe', async (_request, response) => {
        const probeModule = await server.moduleGraph.getModuleByUrl(hmrProbePath)
        if (!probeModule) {
          response.statusCode = 409
          response.end('The HMR probe module has not loaded.')
          return
        }

        const timestamp = Date.now()
        server.moduleGraph.invalidateModule(
          probeModule,
          new Set(),
          timestamp,
          true,
        )
        server.ws.send({
          type: 'update',
          updates: [{
            acceptedPath: hmrProbePath,
            path: hmrProbePath,
            timestamp,
            type: 'js-update',
          }],
        })
        response.statusCode = 204
        response.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), convexHmrProbe()],
})
