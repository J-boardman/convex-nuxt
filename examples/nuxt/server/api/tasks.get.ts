import { ConvexHttpClient } from 'convex/browser'
import { api } from '@j-boardman/convex-example-backend/api'

// Server routes call Convex with its own HTTP client, using the same
// deployment URL the module reads from runtime config.
export default defineEventHandler(async (event) => {
  const { url } = useRuntimeConfig(event).public.convex
  return await new ConvexHttpClient(url!).query(api.tasks.list, {})
})
