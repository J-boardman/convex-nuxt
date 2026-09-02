import { ConvexHttpClient } from 'convex/browser'

type ConvexConstructorOptions = NonNullable<
  ConstructorParameters<typeof ConvexHttpClient>[1]
>

export type ConvexHttpClientOptions = Omit<ConvexConstructorOptions, 'auth'>

export interface CreateConvexHttpClientOptions {
  clientOptions?: ConvexHttpClientOptions
  token?: string | null
  url: string
}

export function createConvexHttpClient(
  options: CreateConvexHttpClientOptions,
): ConvexHttpClient {
  const { clientOptions, token, url } = options

  return new ConvexHttpClient(url, {
    ...clientOptions,
    ...(token ? { auth: token } : {}),
  })
}
