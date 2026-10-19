import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const choice = v.union(v.literal(0), v.literal(1))

export default defineSchema({
  polls: defineTable({
    counts: v.array(v.number()),
    options: v.array(v.string()),
    position: v.number(),
    question: v.string(),
  }).index('by_position', ['position']),
  votes: defineTable({
    choice,
    pollId: v.id('polls'),
    voter: v.string(),
  }).index('by_voter_and_poll', ['voter', 'pollId']),
  activity: defineTable({
    option: v.string(),
    question: v.string(),
    voter: v.string(),
    voterName: v.string(),
  }).index('by_voter', ['voter']),
})
