import type {} from 'nuxt/schema'
import type { ConvexVueClientOptions } from '@j-boardman/convex-vue'

/** Only JSON-serializable client flags can travel through runtime config. */
export type ConvexNuxtClientOptions = Pick<
  ConvexVueClientOptions,
  'skipConvexDeploymentUrlCheck' | 'unsavedChangesWarning'
>

export interface ConvexNuxtPublicRuntimeConfig {
  client?: ConvexNuxtClientOptions
  ssr?: boolean
  url?: string
}

/** The configured deployment URL, or undefined while none is set. */
export function deploymentUrl(
  config: ConvexNuxtPublicRuntimeConfig | undefined,
): string | undefined {
  return config?.url?.trim() || undefined
}

declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    convex: ConvexNuxtPublicRuntimeConfig
  }
}
