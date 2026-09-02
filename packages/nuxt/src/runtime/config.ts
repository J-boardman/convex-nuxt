import type { ConvexVueClientOptions, ConvexVueOptions } from '@j-boardman/convex-vue'

export interface ConvexNuxtPublicRuntimeConfig {
  client?: ConvexVueClientOptions
  url: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalBoolean(
  value: unknown,
  key: keyof ConvexVueClientOptions,
): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    throw new Error(`runtimeConfig.public.convex.client.${key} must be a boolean.`)
  }
  return value
}

export function resolveConvexRuntimeOptions(value: unknown): ConvexVueOptions {
  if (!isRecord(value) || typeof value.url !== 'string' || value.url.trim() === '') {
    throw new Error(
      'Convex requires runtimeConfig.public.convex.url. '
      + 'Set convex.url in nuxt.config.ts or NUXT_PUBLIC_CONVEX_URL.',
    )
  }

  if (value.client !== undefined && !isRecord(value.client)) {
    throw new Error('runtimeConfig.public.convex.client must be an object.')
  }

  const suppliedClient = value.client as Record<string, unknown> | undefined
  const client: ConvexVueClientOptions = {
    skipConvexDeploymentUrlCheck: optionalBoolean(
      suppliedClient?.skipConvexDeploymentUrlCheck,
      'skipConvexDeploymentUrlCheck',
    ),
    unsavedChangesWarning: optionalBoolean(
      suppliedClient?.unsavedChangesWarning,
      'unsavedChangesWarning',
    ),
  }

  return {
    client,
    url: value.url.trim(),
  }
}

declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    convex: ConvexNuxtPublicRuntimeConfig
  }
}
