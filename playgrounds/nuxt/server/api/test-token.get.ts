export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const users = JSON.parse(String(config.convexTestUsers || '{}')) as Record<
    string,
    string
  >
  const requestedUser = getHeader(event, 'x-convex-test-user')
  const token = requestedUser ? users[requestedUser] : undefined

  if (!token) {
    throw createError({ statusCode: 404, statusMessage: 'Auth probe is disabled' })
  }
  return { token }
})
