import { ConvexHttpClient } from 'convex/browser'
import type { H3Event } from 'h3'

/**
 * A fresh HTTP client for one SSR request, authenticated with that page's
 * setupConvexAuth() server token, so concurrent requests never share auth.
 */
export async function createRequestClient(
  url: string,
  event: H3Event,
): Promise<ConvexHttpClient> {
  const token = await event.context.convex?.token()
  return new ConvexHttpClient(url, token ? { auth: token } : {})
}

declare module 'h3' {
  interface H3EventContext {
    /** The page's setupConvexAuth() server token, loaded at most once. */
    convex?: { token: () => Promise<string | null> }
  }
}
