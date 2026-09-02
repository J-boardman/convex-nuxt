import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapter/index': 'src/adapter/index.ts',
    'server/index': 'src/server/index.ts',
  },
  dts: true,
  deps: {
    neverBundle: true,
  },
  format: ['esm'],
})
