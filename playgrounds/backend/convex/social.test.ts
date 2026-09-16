/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('Relay social playground', () => {
  it('seeds the same friendly starting point exactly once', async () => {
    const t = convexTest(schema, modules)

    await expect(t.mutation(api.social.ensureDemoData, {})).resolves.toEqual({
      messagesCreated: 3,
      postsCreated: 3,
    })
    await expect(t.mutation(api.social.ensureDemoData, {})).resolves.toEqual({
      messagesCreated: 0,
      postsCreated: 0,
    })

    const people = await t.query(api.social.listPeople, {})
    const messages = await t.query(api.social.listMessages, {})
    expect(people).toHaveLength(4)
    expect(messages).toHaveLength(3)
  })

  it('paginates posts and marks reactions for the active persona', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(api.social.ensureDemoData, {})

    const first = await t.query(api.social.listPosts, {
      actorId: 'ada',
      paginationOpts: { cursor: null, numItems: 2 },
    })
    expect(first.page).toHaveLength(2)
    expect(first.isDone).toBe(false)

    const target = first.page[0]
    const liked = await t.mutation(api.social.setReaction, {
      actorId: 'ada',
      postId: target.id,
      reacted: true,
    })
    await expect(t.mutation(api.social.setReaction, {
      actorId: 'ada',
      postId: target.id,
      reacted: true,
    })).resolves.toEqual(liked)

    const ada = await t.query(api.social.listPosts, {
      actorId: 'ada',
      paginationOpts: { cursor: null, numItems: 2 },
    })
    const lin = await t.query(api.social.listPosts, {
      actorId: 'lin',
      paginationOpts: { cursor: null, numItems: 2 },
    })
    expect(ada.page[0]).toMatchObject({
      isReacted: true,
      reactionCount: target.reactionCount + 1,
    })
    expect(lin.page[0]).toMatchObject({
      isReacted: false,
      reactionCount: target.reactionCount + 1,
    })

    const second = await t.query(api.social.listPosts, {
      actorId: 'ada',
      paginationOpts: { cursor: first.continueCursor, numItems: 2 },
    })
    expect(second.page).toHaveLength(1)
    expect(second.isDone).toBe(true)
  })

  it('treats retried posts and messages as one conversation event', async () => {
    const t = convexTest(schema, modules)
    const postArgs = {
      authorId: 'ada' as const,
      body: '  The prototype is ready for a second pair of eyes.  ',
      requestId: 'post-retry-1',
    }
    const messageArgs = {
      authorId: 'ada' as const,
      body: '  I left a note in the feed.  ',
      requestId: 'message-retry-1',
    }

    const firstPost = await t.mutation(api.social.createPost, postArgs)
    const retriedPost = await t.mutation(api.social.createPost, postArgs)
    const firstMessage = await t.mutation(api.social.sendMessage, messageArgs)
    const retriedMessage = await t.mutation(api.social.sendMessage, messageArgs)

    expect(firstPost.created).toBe(true)
    expect(retriedPost).toEqual({ created: false, postId: firstPost.postId })
    expect(firstMessage.created).toBe(true)
    expect(retriedMessage).toEqual({
      created: false,
      messageId: firstMessage.messageId,
    })
    expect(await t.query(api.social.listMessages, {})).toHaveLength(1)
  })

  it('rejects blank content and conflicting request reuse', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(api.social.createPost, {
      authorId: 'ada',
      body: 'Original update',
      requestId: 'conflicting-post',
    })

    await expect(t.mutation(api.social.createPost, {
      authorId: 'lin',
      body: 'Different update',
      requestId: 'conflicting-post',
    })).rejects.toThrow('cannot describe two posts')
    await expect(t.mutation(api.social.sendMessage, {
      authorId: 'sam',
      body: '   ',
      requestId: 'blank-message',
    })).rejects.toThrow('between 1 and 240 characters')
  })
})
