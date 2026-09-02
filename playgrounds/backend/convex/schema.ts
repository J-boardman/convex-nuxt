import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const playgroundSurface = v.union(v.literal('vue'), v.literal('nuxt'))

export default defineSchema({
  probes: defineTable({
    label: v.string(),
    requestId: v.string(),
    surface: playgroundSurface,
  })
    .index('by_surface', ['surface'])
    .index('by_request_id', ['requestId']),
})
