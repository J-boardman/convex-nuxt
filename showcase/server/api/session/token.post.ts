// The browser's Convex client calls this whenever it needs a fresh token.
export default defineEventHandler(async (event) => {
  if (!event.context.showcaseToken) {
    throw createError({ statusCode: 500, statusMessage: 'No session for this request' })
  }
  return { token: await event.context.showcaseToken() }
})
