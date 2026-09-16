<script setup lang="ts">
import { api } from '@j-boardman/convex-playground-backend/api'
import {
  RelayExperience,
  type RelayAsyncState,
  type RelayMessage,
  type RelayPerson,
} from '@j-boardman/convex-playground-shared'
import {
  useConvexAuth,
  useConvexConnectionState,
  useConvexMutation,
  useConvexPaginatedQuery,
  useConvexQuery,
} from '@j-boardman/convex-nuxt/runtime'

defineProps<{
  destination: string
  destinationLabel: string
  routeName: string
}>()

const viewer: RelayPerson = {
  avatar: 'LM',
  handle: 'linmakes',
  id: 'lin',
  isOnline: true,
  name: 'Lin Martin',
  role: 'Engineering',
}
const auth = useConvexAuth()
const people = useConvexQuery(api.social.listPeople, {})
const messages = useConvexQuery(api.social.listMessages, {})
const posts = useConvexPaginatedQuery(
  api.social.listPosts,
  { actorId: 'lin' },
  { initialNumItems: 5 },
)
const connection = import.meta.client ? useConvexConnectionState() : undefined
const ensureDemoData = import.meta.client
  ? useConvexMutation(api.social.ensureDemoData)
  : undefined
const createPost = import.meta.client
  ? useConvexMutation(api.social.createPost)
  : undefined
const setReaction = import.meta.client
  ? useConvexMutation(api.social.setReaction)
  : undefined
const sendMessage = import.meta.client
  ? useConvexMutation(api.social.sendMessage)
  : undefined
const hasMounted = ref(false)
const isPosting = ref(false)
const isSending = ref(false)
const timeOrigin = useState('relay-time-origin', () => Date.now())

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
const socketStatus = computed(() =>
  hasMounted.value && connection?.value.isWebSocketConnected
    ? 'socket live'
    : 'server seed',
)

onMounted(async () => {
  hasMounted.value = true
  await ensureDemoData?.({})
})

async function publishPost(body: string) {
  if (!createPost) return

  isPosting.value = true
  try {
    await createPost({
      authorId: 'lin',
      body,
      requestId: crypto.randomUUID(),
    })
  }
  finally {
    isPosting.value = false
  }
}

async function reactToPost(postId: string, reacted: boolean) {
  if (!setReaction) return

  const post = posts.results.find(candidate => candidate.id === postId)
  if (!post) return
  await setReaction({
    actorId: 'lin',
    postId: post.id,
    reacted,
  })
}

async function publishMessage(body: string) {
  if (!sendMessage) return

  isSending.value = true
  try {
    await sendMessage({
      authorId: 'lin',
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
    runtime="nuxt"
    :time-origin="timeOrigin"
    :data-hydrated="hasMounted"
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
    <template #receipt-title>Nuxt reuses the server payload</template>
    <template #receipt-copy>
      The first feed is rendered on the server, then becomes a live subscription.
    </template>
    <template #receipt-detail>
      <span class="relay-runtime-receipt">
        <span data-testid="hydration-state" :data-hydrated="hasMounted">
          {{ socketStatus }}
        </span>
        <span data-testid="product-auth-state">auth {{ auth.state.status }}</span>
        <NuxtLink :to="destination">{{ destinationLabel }}</NuxtLink>
        <NuxtLink to="/__diagnostics">Diagnostics</NuxtLink>
        <span class="relay-route-name">{{ routeName }}</span>
      </span>
    </template>
  </RelayExperience>
</template>
