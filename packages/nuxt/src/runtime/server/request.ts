import { ConvexHttpClient } from 'convex/browser'
import type { H3Event } from 'h3'
import { resolveConvexRuntimeOptions } from '../config.js'

export type ConvexHttpClientOptions = Omit<
  NonNullable<ConstructorParameters<typeof ConvexHttpClient>[1]>,
  'auth'
>

export type ConvexServerToken =
  | string
  | null
  | (() => Promise<string | null>)

export interface ConvexServerRequestContext {
  token: ConvexServerToken
}

export interface CreateConvexRequestClientOptions {
  clientOptions?: ConvexHttpClientOptions
  config: unknown
  event: H3Event
  token?: string | null
}

export function setConvexServerToken(
  event: H3Event,
  token: ConvexServerToken,
): void {
  event.context.convex = { token }
}

async function resolveServerToken(
  event: H3Event,
): Promise<string | null | undefined> {
  const token = event.context.convex?.token
  return typeof token === 'function' ? await token() : token
}

/** @internal */
export async function createConvexHttpClientForRequest(
  options: CreateConvexRequestClientOptions,
): Promise<ConvexHttpClient> {
  const { url } = resolveConvexRuntimeOptions(options.config)
  const token = options.token === undefined
    ? await resolveServerToken(options.event)
    : options.token

  return new ConvexHttpClient(url, {
    ...options.clientOptions,
    ...(token ? { auth: token } : {}),
  })
}

declare module 'h3' {
  interface H3EventContext {
    convex?: ConvexServerRequestContext
  }
}
