import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { displayName } from './names'
import { choice } from './schema'

const votesPerMinute = 20

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    const polls = await ctx.db.query('polls').withIndex('by_position').take(20)

    return await Promise.all(polls.map(async (poll) => {
      const vote = identity
        ? await ctx.db
            .query('votes')
            .withIndex('by_voter_and_poll', q =>
              q.eq('voter', identity.tokenIdentifier).eq('pollId', poll._id))
            .unique()
        : null
      return {
        _id: poll._id,
        counts: poll.counts,
        myChoice: vote?.choice ?? null,
        options: poll.options,
        question: poll.question,
      }
    }))
  },
})

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    return identity ? { name: displayName(identity.tokenIdentifier) } : null
  },
})

export const vote = mutation({
  args: { choice, pollId: v.id('polls') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError('Your session has expired. Reload the page to vote.')
    }
    const voter = identity.tokenIdentifier

    const recent = await ctx.db
      .query('activity')
      .withIndex('by_voter', q =>
        q.eq('voter', voter).gt('_creationTime', Date.now() - 60_000))
      .take(votesPerMinute)
    if (recent.length >= votesPerMinute) {
      throw new ConvexError('That is a lot of votes. Try again in a minute.')
    }

    const poll = await ctx.db.get(args.pollId)
    if (!poll) throw new ConvexError('That poll no longer exists.')

    const existing = await ctx.db
      .query('votes')
      .withIndex('by_voter_and_poll', q =>
        q.eq('voter', voter).eq('pollId', poll._id))
      .unique()
    if (existing?.choice === args.choice) return

    const counts = [...poll.counts]
    if (existing) {
      counts[existing.choice] = (counts[existing.choice] ?? 1) - 1
      await ctx.db.patch(existing._id, { choice: args.choice })
    }
    else {
      await ctx.db.insert('votes', { choice: args.choice, pollId: poll._id, voter })
    }
    counts[args.choice] = (counts[args.choice] ?? 0) + 1
    await ctx.db.patch(poll._id, { counts })

    await ctx.db.insert('activity', {
      option: poll.options[args.choice] ?? '',
      question: poll.question,
      voter,
      voterName: displayName(voter),
    })
  },
})
