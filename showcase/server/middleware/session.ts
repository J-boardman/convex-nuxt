// Every visitor gets an anonymous session: a random, unguessable id in an
// HTTP-only cookie. It is the subject of the Convex tokens the server signs.
const cookie = 'showcase_session'

export default defineEventHandler((event) => {
  if (event.path.startsWith('/_nuxt/')) return

  let session = getCookie(event, cookie)
  if (!session || !/^[\w-]{36}$/.test(session)) {
    session = crypto.randomUUID()
    setCookie(event, cookie, session, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: !import.meta.dev,
    })
  }
  const id = session
  event.context.showcaseToken = () => mintSessionToken(event, id)
})

declare module 'h3' {
  interface H3EventContext {
    /** Signs a Convex token for this request's session. */
    showcaseToken?: () => Promise<string>
  }
}
