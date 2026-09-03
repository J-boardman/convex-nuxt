import {
  createConvexHttpClient,
} from '@j-boardman/convex-vue/server'
import type {
  ConvexHttpClientOptions,
} from '@j-boardman/convex-vue/server'
import type { ConvexHttpClient } from 'convex/browser'
import type { H3Event } from 'h3'
import { resolveConvexRuntimeOptions } from '../config.js'

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

  return createConvexHttpClient({
    clientOptions: options.clientOptions,
    token,
    url,
  })
}

declare module 'h3' {
  interface H3EventContext {
    convex?: ConvexServerRequestContext
  }
}
