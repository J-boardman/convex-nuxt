import { paginationOptsValidator } from 'convex/server'
import { internalMutation, query } from './_generated/server'

export const recent = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query('activity').order('desc').paginate(paginationOpts)
    return {
      ...result,
      // Voter identities stay on the server; the feed shows only names.
      page: result.page.map(({ _creationTime, _id, option, question, voterName }) =>
        ({ _creationTime, _id, option, question, voterName })),
    }
  },
})

/** Keeps the public feed to the last day so it cannot grow without bound. */
export const trim = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query('activity')
      .withIndex('by_creation_time', q =>
        q.lt('_creationTime', Date.now() - 24 * 60 * 60 * 1000))
      .take(500)
    await Promise.all(old.map(row => ctx.db.delete(row._id)))
  },
})
