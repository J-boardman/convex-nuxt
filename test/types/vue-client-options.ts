import type { ConvexVueOptions } from '@j-boardman/convex-vue'

const options: ConvexVueOptions = {
  client: {
    authRefreshTokenLeewaySeconds: 20,
    expectAuth: true,
    initialAuthTokenReuse: true,
    logger: false,
    onServerDisconnectError: () => {},
    reportDebugInfoToConvex: true,
    skipConvexDeploymentUrlCheck: true,
    unsavedChangesWarning: false,
    verbose: true,
    webSocketConstructor: WebSocket,
  },
  url: 'https://example.convex.cloud',
}

void options

const unsupported: ConvexVueOptions = {
  client: {
    // @ts-expect-error a disabled client cannot satisfy live composables
    disabled: true,
  },
  url: 'https://example.convex.cloud',
}

void unsupported
