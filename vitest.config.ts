import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: 'edge-runtime',
          include: ['playgrounds/backend/convex/**/*.test.ts'],
          name: 'convex',
        },
      },
      {
        test: {
          environment: 'node',
          include: ['test/**/*.test.ts'],
          name: 'workspace',
        },
      },
    ],
  },
})
