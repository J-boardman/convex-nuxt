import type { ConvexHttpClient } from 'convex/browser'
import type { H3Event } from 'h3'
import { createConvexHttpClientForRequest } from './request.js'
import type { ConvexHttpClientOptions } from './request.js'

export {
  setConvexServerToken,
} from './request'
export type {
  ConvexHttpClientOptions,
  ConvexServerRequestContext,
  ConvexServerToken,
} from './request'

export interface UseConvexHttpClientOptions {
  clientOptions?: ConvexHttpClientOptions
  event?: H3Event
  token?: string | null
}

export async function useConvexHttpClient(
  options: UseConvexHttpClientOptions = {},
): Promise<ConvexHttpClient> {
  const { useRequestEvent, useRuntimeConfig } = await import('nuxt/app')
  const event = options.event ?? useRequestEvent()
  if (!event) {
    throw new Error(
      'useConvexHttpClient() requires an active Nuxt server request. '
      + 'Pass { event } when calling it from an H3 handler.',
    )
  }

  return createConvexHttpClientForRequest({
    clientOptions: options.clientOptions,
    config: useRuntimeConfig(event).public.convex,
    event,
    token: options.token,
  })
}
