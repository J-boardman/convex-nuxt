// Session-token keys for the showcase. The Nuxt server signs with the private
// key (NUXT_SHOWCASE_PRIVATE_KEY); Convex verifies with the public JWKS
// (SHOWCASE_JWKS). Run directly to print a fresh pair for a new deployment.
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** A new private key, base64-encoded so Nuxt keeps it as a string. */
export async function createPrivateKey() {
  const { privateKey } = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const jwk = await globalThis.crypto.subtle.exportKey('jwk', privateKey)
  return Buffer.from(JSON.stringify({ ...jwk, kid: 'showcase' })).toString('base64')
}

/** The JWKS data URI Convex needs to verify tokens from that private key. */
export function jwksFor(privateKey) {
  const publicJwk = JSON.parse(Buffer.from(privateKey, 'base64').toString())
  delete publicJwk.d
  delete publicJwk.key_ops
  const jwks = Buffer.from(JSON.stringify({ keys: [{ ...publicJwk, alg: 'ES256', use: 'sig' }] }))
  return `data:application/json;base64,${jwks.toString('base64')}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const privateKey = await createPrivateKey()
  process.stdout.write(
    `# Nuxt server environment\nNUXT_SHOWCASE_PRIVATE_KEY=${privateKey}\n\n`
    + `# Convex deployment: npx convex env set SHOWCASE_JWKS '<value>'\n`
    + `SHOWCASE_JWKS=${jwksFor(privateKey)}\n`,
  )
}
