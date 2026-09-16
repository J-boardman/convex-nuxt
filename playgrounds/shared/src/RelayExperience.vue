<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import type {
  RelayAsyncState,
  RelayMessage,
  RelayPerson,
  RelayPost,
  RelayRuntime,
} from './types'

const props = withDefaults(defineProps<{
  canLoadMore?: boolean
  chatState: RelayAsyncState
  feedState: RelayAsyncState
  isPosting?: boolean
  isSending?: boolean
  messages: RelayMessage[]
  paginationState: RelayAsyncState
  people: RelayPerson[]
  posts: RelayPost[]
  runtime: RelayRuntime
  timeOrigin: number
  viewer: RelayPerson
}>(), {
  canLoadMore: false,
  isPosting: false,
  isSending: false,
})

const emit = defineEmits<{
  createPost: [body: string]
  loadMore: []
  sendMessage: [body: string]
  toggleReaction: [postId: string, reacted: boolean]
}>()

const composerOpen = ref(false)
const postBody = ref('')
const messageBody = ref('')
const postInput = useTemplateRef<HTMLTextAreaElement>('post-input')

const runtimeLabel = computed(() => props.runtime === 'nuxt' ? 'Nuxt' : 'Vue')
const onlinePeople = computed(() => props.people.filter(person => person.isOnline))

function relativeTime(createdAt: number) {
  const seconds = Math.max(0, Math.floor((props.timeOrigin - createdAt) / 1000))
  if (seconds < 60) return 'now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

async function openComposer() {
  composerOpen.value = true
  await nextTick()
  postInput.value?.focus()
}

function submitPost() {
  const body = postBody.value.trim()
  if (!body || props.isPosting) return

  emit('createPost', body)
  postBody.value = ''
  composerOpen.value = false
}

function submitMessage() {
  const body = messageBody.value.trim()
  if (!body || props.isSending) return

  emit('sendMessage', body)
  messageBody.value = ''
}
</script>

<template>
  <main class="relay" :data-runtime="runtime">
    <aside class="relay-sidebar" aria-label="Relay navigation">
      <a class="relay-wordmark" href="#feed" aria-label="Relay home">
        <span class="relay-mark" aria-hidden="true">R</span>
        <span>Relay</span>
      </a>

      <nav class="relay-nav" aria-label="Primary navigation">
        <a class="is-current" href="#feed">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>
          <span>Home</span>
        </a>
        <a href="#people">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <span>People</span>
        </a>
        <a href="#chat">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>
          <span>Messages</span>
          <span class="relay-nav-count">{{ messages.length }}</span>
        </a>
      </nav>

      <button class="relay-compose-button" type="button" @click="openComposer">
        <span aria-hidden="true">+</span>
        Post an update
      </button>

      <div class="relay-account">
        <span class="relay-avatar" :data-avatar="viewer.avatar">{{ viewer.avatar }}</span>
        <span>
          <strong>{{ viewer.name }}</strong>
          <small>@{{ viewer.handle }}</small>
        </span>
        <span class="relay-account-menu" aria-hidden="true">•••</span>
      </div>
    </aside>

    <section id="feed" class="relay-feed" aria-labelledby="feed-title">
      <header class="relay-mobile-header">
        <a class="relay-wordmark" href="#feed" aria-label="Relay home">
          <span class="relay-mark" aria-hidden="true">R</span>
          <span>Relay</span>
        </a>
        <span class="relay-runtime-badge">
          <span class="relay-runtime-dot" aria-hidden="true" />
          {{ runtimeLabel }} live
        </span>
      </header>

      <div class="relay-feed-heading">
        <div>
          <p class="relay-kicker">The studio</p>
          <h1 id="feed-title">Good morning, {{ viewer.name.split(' ')[0] }}.</h1>
        </div>
        <span class="relay-runtime-badge relay-desktop-badge">
          <span class="relay-runtime-dot" aria-hidden="true" />
          {{ runtimeLabel }} live
        </span>
      </div>

      <section class="relay-receipt" aria-label="Integration status">
        <span class="relay-signal" aria-hidden="true"><i /><i /><i /></span>
        <div>
          <strong><slot name="receipt-title">Connected to Convex</slot></strong>
          <p><slot name="receipt-copy">Updates arrive live without a refresh.</slot></p>
        </div>
        <slot name="receipt-detail">
          <span class="relay-receipt-detail">{{ feedState }}</span>
        </slot>
      </section>

      <form
        v-if="composerOpen"
        class="relay-composer relay-composer-expanded"
        @submit.prevent="submitPost"
      >
        <span class="relay-avatar" :data-avatar="viewer.avatar">{{ viewer.avatar }}</span>
        <label for="relay-post">Share an update with the studio</label>
        <textarea
          id="relay-post"
          ref="post-input"
          v-model="postBody"
          maxlength="280"
          placeholder="What are you working on?"
          rows="3"
        />
        <div class="relay-composer-actions">
          <span>{{ postBody.length }} / 280</span>
          <button class="relay-text-button" type="button" @click="composerOpen = false">Cancel</button>
          <button class="relay-primary-button" type="submit" :disabled="!postBody.trim() || isPosting">
            {{ isPosting ? 'Posting…' : 'Post update' }}
          </button>
        </div>
      </form>

      <button v-else class="relay-composer-prompt" type="button" @click="openComposer">
        <span class="relay-avatar" :data-avatar="viewer.avatar">{{ viewer.avatar }}</span>
        <span>Share an update with the studio…</span>
        <span class="relay-prompt-action">Post</span>
      </button>

      <div v-if="feedState === 'loading'" class="relay-feed-state" aria-live="polite">
        Tuning into the studio…
      </div>
      <div v-else-if="feedState === 'error'" class="relay-feed-state is-error" role="alert">
        The studio feed could not be loaded.
      </div>
      <ol v-else class="relay-post-list" aria-label="Studio updates">
        <li v-for="post in posts" :key="post.id">
          <article class="relay-post">
            <span class="relay-avatar" :data-avatar="post.author.avatar">{{ post.author.avatar }}</span>
            <div class="relay-post-content">
              <header>
                <strong>{{ post.author.name }}</strong>
                <span>@{{ post.author.handle }}</span>
                <span aria-hidden="true">·</span>
                <time :datetime="new Date(post.createdAt).toISOString()">{{ relativeTime(post.createdAt) }}</time>
              </header>
              <p>{{ post.body }}</p>
              <footer>
                <button type="button" aria-label="Reply to post">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>
                  <span>{{ post.replyCount }}</span>
                </button>
                <button
                  class="relay-reaction"
                  :class="{ 'is-active': post.isReacted }"
                  type="button"
                  :aria-label="post.isReacted ? 'Remove appreciation' : 'Appreciate post'"
                  :aria-pressed="post.isReacted"
                  @click="emit('toggleReaction', post.id, !post.isReacted)"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
                  <span>{{ post.reactionCount }}</span>
                </button>
                <button type="button" aria-label="Share post">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" /></svg>
                </button>
              </footer>
            </div>
          </article>
        </li>
      </ol>

      <button
        v-if="canLoadMore"
        class="relay-load-more"
        type="button"
        :disabled="paginationState === 'loadingMore'"
        @click="emit('loadMore')"
      >
        {{ paginationState === 'loadingMore' ? 'Loading more…' : 'Load earlier updates' }}
      </button>
      <p v-else-if="posts.length" class="relay-feed-end">You’re all caught up.</p>
    </section>

    <aside id="chat" class="relay-chat" aria-labelledby="chat-title">
      <header>
        <div>
          <p class="relay-kicker">Live room</p>
          <h2 id="chat-title">Studio chat</h2>
        </div>
        <span class="relay-online-count">{{ onlinePeople.length }} online</span>
      </header>

      <div id="people" class="relay-people" aria-label="People online">
        <div v-for="person in onlinePeople" :key="person.id" class="relay-person">
          <span class="relay-avatar" :data-avatar="person.avatar">{{ person.avatar }}</span>
          <span class="relay-presence" aria-label="Online" />
          <small>{{ person.name.split(' ')[0] }}</small>
        </div>
      </div>

      <div class="relay-room-rule">
        <span>Today</span>
      </div>

      <div v-if="chatState === 'loading'" class="relay-chat-state">Opening the room…</div>
      <ol v-else class="relay-message-list" aria-label="Studio messages">
        <li v-for="message in messages" :key="message.id" :class="{ 'is-own': message.isOwn }">
          <span class="relay-avatar" :data-avatar="message.author.avatar">{{ message.author.avatar }}</span>
          <div>
            <span class="relay-message-meta">
              <strong>{{ message.isOwn ? 'You' : message.author.name }}</strong>
              <time :datetime="new Date(message.createdAt).toISOString()">{{ relativeTime(message.createdAt) }}</time>
            </span>
            <p>{{ message.body }}</p>
          </div>
        </li>
      </ol>

      <form class="relay-message-form" @submit.prevent="submitMessage">
        <label for="relay-message">Message the studio</label>
        <input
          id="relay-message"
          v-model="messageBody"
          maxlength="240"
          placeholder="Write a message…"
          autocomplete="off"
        >
        <button type="submit" :disabled="!messageBody.trim() || isSending" aria-label="Send message">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" /></svg>
        </button>
      </form>
    </aside>

    <nav class="relay-mobile-nav" aria-label="Mobile navigation">
      <a class="is-current" href="#feed">Home</a>
      <a href="#people">People</a>
      <a href="#chat">Chat</a>
      <button type="button" @click="openComposer">Post</button>
    </nav>
  </main>
</template>
