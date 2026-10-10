import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapter/index': 'src/adapter/ssr.ts',
  },
  dts: true,
  deps: {
    neverBundle: true,
  },
  format: ['esm'],
})
