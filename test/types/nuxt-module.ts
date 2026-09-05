import type { ModuleOptions } from '@j-boardman/convex-nuxt'

const supported: ModuleOptions = {
  autoImports: false,
  client: {
    skipConvexDeploymentUrlCheck: true,
    unsavedChangesWarning: false,
  },
  ssr: false,
  url: 'https://example.convex.cloud',
}

void supported

const unsupported: ModuleOptions = {
  client: {
    // @ts-expect-error function-valued client options cannot cross runtime config
    logger: false,
  },
}

void unsupported
