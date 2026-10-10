import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const list = query({
  args: {},
  handler: async ctx => await ctx.db.query('tasks').order('desc').take(50),
})

export const add = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 200) {
      throw new Error('A task needs between 1 and 200 characters.')
    }
    return await ctx.db.insert('tasks', { isCompleted: false, text: trimmed })
  },
})

export const toggle = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    const task = await ctx.db.get(id)
    if (task) {
      await ctx.db.patch(id, { isCompleted: !task.isCompleted })
    }
  },
})
