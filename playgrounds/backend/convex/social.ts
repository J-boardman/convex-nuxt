import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

const relayPersonId = v.union(
  v.literal('ada'),
  v.literal('lin'),
  v.literal('noa'),
  v.literal('sam'),
)

type RelayPersonId = 'ada' | 'lin' | 'noa' | 'sam'

const people = {
  ada: {
    avatar: 'AB',
    handle: 'adabell',
    id: 'ada' as const,
    isOnline: true,
    name: 'Ada Bell',
    role: 'Product design',
  },
  lin: {
    avatar: 'LM',
    handle: 'linmakes',
    id: 'lin' as const,
    isOnline: true,
    name: 'Lin Martin',
    role: 'Engineering',
  },
  noa: {
    avatar: 'NO',
    handle: 'noaoutside',
    id: 'noa' as const,
    isOnline: false,
    name: 'Noa Ortiz',
    role: 'Research',
  },
  sam: {
    avatar: 'SK',
    handle: 'samk',
    id: 'sam' as const,
    isOnline: true,
    name: 'Sam Kim',
    role: 'Brand',
  },
}

const person = v.object({
  avatar: v.string(),
  handle: v.string(),
  id: relayPersonId,
  isOnline: v.boolean(),
  name: v.string(),
  role: v.string(),
})

const post = v.object({
  author: person,
  body: v.string(),
  createdAt: v.number(),
  id: v.id('relayPosts'),
  isReacted: v.boolean(),
  reactionCount: v.number(),
  replyCount: v.number(),
})

const message = v.object({
  author: person,
  body: v.string(),
  createdAt: v.number(),
  id: v.string(),
})

const demoPosts: Array<{
  authorId: RelayPersonId
  body: string
  reactionCount: number
  replyCount: number
  requestId: string
}> = [
  {
    authorId: 'noa',
    body: 'Research note: people understood the new activity trail without a tooltip. The live movement did the teaching for us.',
    reactionCount: 8,
    replyCount: 2,
    requestId: 'relay-demo-post-noa',
  },
  {
    authorId: 'lin',
    body: 'The new feed is running on one reactive query. Leave this tab open and post from the other playground — it should arrive here immediately.',
    reactionCount: 14,
    replyCount: 4,
    requestId: 'relay-demo-post-lin',
  },
  {
    authorId: 'sam',
    body: 'Dropped the first Relay wordmark into the launch board. The rough edges are staying; they make it feel like a place people actually work.',
    reactionCount: 11,
    replyCount: 3,
    requestId: 'relay-demo-post-sam',
  },
]

const demoMessages: Array<{
  authorId: RelayPersonId
  body: string
  requestId: string
}> = [
  {
    authorId: 'sam',
    body: 'Morning! The launch board is ready for a look.',
    requestId: 'relay-demo-message-sam',
  },
  {
    authorId: 'lin',
    body: 'Perfect. I’ll test it in both runtimes before stand-up.',
    requestId: 'relay-demo-message-lin',
  },
  {
    authorId: 'noa',
    body: 'I added the three research clips from yesterday too.',
    requestId: 'relay-demo-message-noa',
  },
]

function normalizeText(value: string, label: string, maximum: number) {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new Error(`${label} must contain between 1 and ${maximum} characters.`)
  }
  return normalized
}

function normalizeRequestId(value: string) {
  return normalizeText(value, 'Request IDs', 120)
}

function getPerson(id: RelayPersonId) {
  return people[id]
}

export const listPeople = query({
  args: {},
  returns: v.array(person),
  handler: async () => Object.values(people),
})

export const listPosts = query({
  args: {
    actorId: relayPersonId,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(post),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('relayPosts')
      .order('desc')
      .paginate(args.paginationOpts)

    const page = await Promise.all(result.page.map(async current => ({
      author: getPerson(current.authorId),
      body: current.body,
      createdAt: current._creationTime,
      id: current._id,
      isReacted: Boolean(await ctx.db
        .query('relayReactions')
        .withIndex('by_post_id_and_actor_id', q => q
          .eq('postId', current._id)
          .eq('actorId', args.actorId))
        .unique()),
      reactionCount: current.reactionCount,
      replyCount: current.replyCount,
    })))

    return { ...result, page }
  },
})

export const listMessages = query({
  args: {},
  returns: v.array(message),
  handler: async (ctx) => {
    const messages = await ctx.db
      .query('relayMessages')
      .order('desc')
      .take(40)

    return messages.reverse().map(current => ({
      author: getPerson(current.authorId),
      body: current.body,
      createdAt: current._creationTime,
      id: current._id,
    }))
  },
})

export const ensureDemoData = mutation({
  args: {},
  returns: v.object({
    messagesCreated: v.number(),
    postsCreated: v.number(),
  }),
  handler: async (ctx) => {
    let postsCreated = 0
    let messagesCreated = 0

    for (const demo of demoPosts) {
      const existing = await ctx.db
        .query('relayPosts')
        .withIndex('by_request_id', q => q.eq('requestId', demo.requestId))
        .unique()
      if (!existing) {
        await ctx.db.insert('relayPosts', demo)
        postsCreated += 1
      }
    }

    for (const demo of demoMessages) {
      const existing = await ctx.db
        .query('relayMessages')
        .withIndex('by_request_id', q => q.eq('requestId', demo.requestId))
        .unique()
      if (!existing) {
        await ctx.db.insert('relayMessages', demo)
        messagesCreated += 1
      }
    }

    return { messagesCreated, postsCreated }
  },
})

export const createPost = mutation({
  args: {
    authorId: relayPersonId,
    body: v.string(),
    requestId: v.string(),
  },
  returns: v.object({
    created: v.boolean(),
    postId: v.id('relayPosts'),
  }),
  handler: async (ctx, args) => {
    const body = normalizeText(args.body, 'Posts', 280)
    const requestId = normalizeRequestId(args.requestId)
    const existing = await ctx.db
      .query('relayPosts')
      .withIndex('by_request_id', q => q.eq('requestId', requestId))
      .unique()

    if (existing) {
      if (existing.authorId !== args.authorId || existing.body !== body) {
        throw new Error('A post request ID cannot describe two posts.')
      }
      return { created: false, postId: existing._id }
    }

    const postId = await ctx.db.insert('relayPosts', {
      authorId: args.authorId,
      body,
      reactionCount: 0,
      replyCount: 0,
      requestId,
    })
    return { created: true, postId }
  },
})

export const setReaction = mutation({
  args: {
    actorId: relayPersonId,
    postId: v.id('relayPosts'),
    reacted: v.boolean(),
  },
  returns: v.object({
    reactionCount: v.number(),
    reacted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const currentPost = await ctx.db.get(args.postId)
    if (!currentPost) throw new Error('The post no longer exists.')

    const currentReaction = await ctx.db
      .query('relayReactions')
      .withIndex('by_post_id_and_actor_id', q => q
        .eq('postId', args.postId)
        .eq('actorId', args.actorId))
      .unique()

    if (args.reacted && !currentReaction) {
      await ctx.db.insert('relayReactions', {
        actorId: args.actorId,
        postId: args.postId,
      })
      await ctx.db.patch(args.postId, {
        reactionCount: currentPost.reactionCount + 1,
      })
      return {
        reacted: true,
        reactionCount: currentPost.reactionCount + 1,
      }
    }

    if (!args.reacted && currentReaction) {
      await ctx.db.delete(currentReaction._id)
      const reactionCount = Math.max(0, currentPost.reactionCount - 1)
      await ctx.db.patch(args.postId, { reactionCount })
      return { reacted: false, reactionCount }
    }

    return {
      reacted: args.reacted,
      reactionCount: currentPost.reactionCount,
    }
  },
})

export const sendMessage = mutation({
  args: {
    authorId: relayPersonId,
    body: v.string(),
    requestId: v.string(),
  },
  returns: v.object({
    created: v.boolean(),
    messageId: v.id('relayMessages'),
  }),
  handler: async (ctx, args) => {
    const body = normalizeText(args.body, 'Messages', 240)
    const requestId = normalizeRequestId(args.requestId)
    const existing = await ctx.db
      .query('relayMessages')
      .withIndex('by_request_id', q => q.eq('requestId', requestId))
      .unique()

    if (existing) {
      if (existing.authorId !== args.authorId || existing.body !== body) {
        throw new Error('A message request ID cannot describe two messages.')
      }
      return { created: false, messageId: existing._id }
    }

    const messageId = await ctx.db.insert('relayMessages', {
      authorId: args.authorId,
      body,
      requestId,
    })
    return { created: true, messageId }
  },
})
