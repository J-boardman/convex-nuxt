import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const playgroundSurface = v.union(v.literal('vue'), v.literal('nuxt'))
const relayPerson = v.union(
  v.literal('ada'),
  v.literal('lin'),
  v.literal('noa'),
  v.literal('sam'),
)

export default defineSchema({
  probes: defineTable({
    label: v.string(),
    requestId: v.string(),
    surface: playgroundSurface,
  })
    .index('by_surface', ['surface'])
    .index('by_request_id', ['requestId']),
  relayMessages: defineTable({
    authorId: relayPerson,
    body: v.string(),
    requestId: v.string(),
  }).index('by_request_id', ['requestId']),
  relayPosts: defineTable({
    authorId: relayPerson,
    body: v.string(),
    reactionCount: v.number(),
    replyCount: v.number(),
    requestId: v.string(),
  }).index('by_request_id', ['requestId']),
  relayReactions: defineTable({
    actorId: relayPerson,
    postId: v.id('relayPosts'),
  }).index('by_post_id_and_actor_id', ['postId', 'actorId']),
})
