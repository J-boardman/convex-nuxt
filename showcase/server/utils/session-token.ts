import type { H3Event } from 'h3'

// Must match convex/auth.config.ts.
const issuer = 'https://showcase.convex-nuxt.local'
const audience = 'convex-nuxt-showcase'

let signingKey: Promise<CryptoKey> | undefined

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function encodeJson(value: object): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)))
}

/** A one-hour Convex token whose subject is the visitor's anonymous session. */
export async function mintSessionToken(event: H3Event, session: string): Promise<string> {
  signingKey ??= crypto.subtle.importKey(
    'jwk',
    JSON.parse(atob(useRuntimeConfig(event).showcasePrivateKey)) as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${encodeJson({ alg: 'ES256', kid: 'showcase', typ: 'JWT' })}.${encodeJson({
    aud: audience,
    exp: now + 60 * 60,
    iat: now,
    iss: issuer,
    sub: session,
  })}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await signingKey,
    new TextEncoder().encode(unsigned),
  )
  return `${unsigned}.${base64url(new Uint8Array(signature))}`
}
