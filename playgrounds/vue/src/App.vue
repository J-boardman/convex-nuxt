<script setup lang="ts">
import { api } from '@j-boardman/convex-playground-backend/api'
import {
  RelayExperience,
  type RelayAsyncState,
  type RelayMessage,
  type RelayPerson,
} from '@j-boardman/convex-playground-shared'
import {
  setupConvexAuth,
  useConvexConnectionState,
  useConvexMutation,
  useConvexPaginatedQuery,
  useConvexQuery,
} from '@j-boardman/convex-vue'
import { computed, onMounted, ref } from 'vue'
import { hmrUpdateCount } from './hmr-probe'

setupConvexAuth(() => ({
  fetchAccessToken: async () => null,
  isAuthenticated: false,
  isLoading: false,
}))

const viewer: RelayPerson = {
  avatar: 'AB',
  handle: 'adabell',
  id: 'ada',
  isOnline: true,
  name: 'Ada Bell',
  role: 'Product design',
}
const connection = useConvexConnectionState()
const people = useConvexQuery(api.social.listPeople, {})
const messages = useConvexQuery(api.social.listMessages, {})
const posts = useConvexPaginatedQuery(
  api.social.listPosts,
  { actorId: 'ada' },
  { initialNumItems: 5 },
)
const ensureDemoData = useConvexMutation(api.social.ensureDemoData)
const createPost = useConvexMutation(api.social.createPost)
const setReaction = useConvexMutation(api.social.setReaction)
const sendMessage = useConvexMutation(api.social.sendMessage)
const isPosting = ref(false)
const isSending = ref(false)
const timeOrigin = Date.now()

const feedState = computed<RelayAsyncState>(() => {
  if (posts.state.status === 'error') return 'error'
  if (posts.state.status === 'pending') return 'loading'
  return 'success'
})
const paginationState = computed<RelayAsyncState>(() => {
  if (posts.state.status === 'pending') return 'loading'
  if (posts.state.status === 'stale') return 'loading'
  if (posts.state.status === 'skipped') return 'loading'
  return posts.state.status
})
const chatState = computed<RelayAsyncState>(() => {
  if (messages.state.status === 'error') return 'error'
  if (messages.state.status === 'pending') return 'loading'
  if (messages.state.status === 'stale') return 'loading'
  return 'success'
})
const relayMessages = computed<RelayMessage[]>(() =>
  (messages.data ?? []).map(message => ({
    ...message,
    isOwn: message.author.id === viewer.id,
  })),
)

onMounted(async () => {
  await ensureDemoData({})
})

async function publishPost(body: string) {
  isPosting.value = true
  try {
    await createPost({
      authorId: 'ada',
      body,
      requestId: crypto.randomUUID(),
    })
  }
  finally {
    isPosting.value = false
  }
}

async function reactToPost(postId: string, reacted: boolean) {
  const post = posts.results.find(candidate => candidate.id === postId)
  if (!post) return

  await setReaction({
    actorId: 'ada',
    postId: post.id,
    reacted,
  })
}

async function publishMessage(body: string) {
  isSending.value = true
  try {
    await sendMessage({
      authorId: 'ada',
      body,
      requestId: crypto.randomUUID(),
    })
  }
  finally {
    isSending.value = false
  }
}
</script>

<template>
  <RelayExperience
    runtime="vue"
    :time-origin="timeOrigin"
    :viewer="viewer"
    :people="people.data ?? [viewer]"
    :posts="posts.results"
    :messages="relayMessages"
    :feed-state="feedState"
    :chat-state="chatState"
    :pagination-state="paginationState"
    :can-load-more="posts.state.status === 'ready' || posts.state.status === 'loadingMore'"
    :is-posting="isPosting"
    :is-sending="isSending"
    @create-post="publishPost"
    @toggle-reaction="reactToPost"
    @send-message="publishMessage"
    @load-more="posts.loadMore(5)"
  >
    <template #receipt-title>Vue owns one live client</template>
    <template #receipt-copy>
      Feed and chat subscriptions share the application-owned connection.
    </template>
    <template #receipt-detail>
      <span class="relay-runtime-receipt">
        <span>{{ connection.isWebSocketConnected ? 'socket live' : 'connecting' }}</span>
        <span data-testid="hmr-update-count">hmr {{ hmrUpdateCount }}</span>
        <a href="/__diagnostics">Diagnostics</a>
      </span>
    </template>
  </RelayExperience>
</template>
