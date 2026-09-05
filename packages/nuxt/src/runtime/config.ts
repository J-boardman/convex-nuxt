import type { ConvexVueClientOptions, ConvexVueOptions } from '@j-boardman/convex-vue'

export type ConvexNuxtClientOptions = Pick<
  ConvexVueClientOptions,
  'skipConvexDeploymentUrlCheck' | 'unsavedChangesWarning'
>

export interface ConvexNuxtPublicRuntimeConfig {
  client?: ConvexNuxtClientOptions
  ssr?: boolean
  url: string
}

export interface ConvexNuxtRuntimeOptions extends ConvexVueOptions {
  ssr: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalBoolean(
  value: unknown,
  key: keyof ConvexNuxtClientOptions,
): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    throw new Error(`runtimeConfig.public.convex.client.${key} must be a boolean.`)
  }
  return value
}

export function resolveConvexRuntimeOptions(value: unknown): ConvexNuxtRuntimeOptions {
  if (!isRecord(value) || typeof value.url !== 'string' || value.url.trim() === '') {
    throw new Error(
      'Convex requires runtimeConfig.public.convex.url. '
      + 'Set convex.url in nuxt.config.ts or NUXT_PUBLIC_CONVEX_URL.',
    )
  }

  if (value.client !== undefined && !isRecord(value.client)) {
    throw new Error('runtimeConfig.public.convex.client must be an object.')
  }
  if (value.ssr !== undefined && typeof value.ssr !== 'boolean') {
    throw new Error('runtimeConfig.public.convex.ssr must be a boolean.')
  }

  const suppliedClient = value.client as Record<string, unknown> | undefined
  const supportedClientKeys = new Set<keyof ConvexNuxtClientOptions>([
    'skipConvexDeploymentUrlCheck',
    'unsavedChangesWarning',
  ])
  const unsupportedClientKey = Object.keys(suppliedClient ?? {}).find(
    key => !supportedClientKeys.has(key as keyof ConvexNuxtClientOptions),
  )
  if (unsupportedClientKey) {
    throw new Error(
      `runtimeConfig.public.convex.client.${unsupportedClientKey} is not supported. `
      + 'Nuxt public runtime config accepts only JSON-serializable Convex client flags.',
    )
  }

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
    ssr: value.ssr ?? true,
    url: value.url.trim(),
  }
}

declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    convex: ConvexNuxtPublicRuntimeConfig
  }
}
