<script setup lang="ts">
import { ConvexError } from 'convex/values'
import { api } from '~~/convex/_generated/api'
import type { Id } from '~~/convex/_generated/dataModel'

// Both queries render on the server with this visitor's identity, then stay
// live in the browser without being fetched again.
const polls = useConvexQuery(api.polls.list)
const viewer = useConvexQuery(api.polls.viewer)
useQueryTrace('polls.list', 'useConvexQuery(api.polls.list)', () => polls.data)
useQueryTrace('polls.viewer', 'useConvexQuery(api.polls.viewer)', () => viewer.data)

// The bar moves the moment you click; Convex confirms or rolls it back.
const vote = useConvexMutation(api.polls.vote).withOptimisticUpdate(
  (store, { choice, pollId }) => {
    const current = store.getQuery(api.polls.list, {})
    if (!current) return
    store.setQuery(api.polls.list, {}, current.map((poll) => {
      if (poll._id !== pollId || poll.myChoice === choice) return poll
      const counts = [...poll.counts]
      if (poll.myChoice !== null) {
        counts[poll.myChoice] = (counts[poll.myChoice] ?? 1) - 1
      }
      counts[choice] = (counts[choice] ?? 0) + 1
      return { ...poll, counts, myChoice: choice }
    }))
  },
)

// The first poll is the page's hero; the rest sit beside the internals.
const featured = computed(() => polls.data?.[0])
const others = computed(() => polls.data?.slice(1) ?? [])

const problem = ref<string>()

async function cast(pollId: Id<'polls'>, choice: 0 | 1) {
  problem.value = undefined
  try {
    await vote({ choice, pollId })
  }
  catch (error) {
    problem.value = error instanceof ConvexError
      ? String(error.data)
      : 'Your vote did not go through. Try again.'
  }
}
</script>

<template>
  <div class="page">
    <nav class="topbar" aria-label="Site">
      <span class="wordmark">convex-nuxt <span>· showcase</span></span>
      <ClientOnly>
        <ConnectionStatus />
        <template #fallback>
          <p class="status" data-state="connecting">
            <span class="status-dot" aria-hidden="true" />
            Connecting…
          </p>
        </template>
      </ClientOnly>
      <a class="repo" href="https://github.com/J-boardman/convex-nuxt">GitHub</a>
    </nav>

    <header class="intro">
      <p>
        A live poll built with <strong>convex-nuxt</strong>. Every vote
        reaches every open tab as it is cast: vote, then open a second window
        and watch the rope move.
        <span v-if="viewer.data" class="voter">
          You are voting as <strong>{{ viewer.data.name }}</strong>.
        </span>
      </p>
      <InstallCommand />
    </header>

    <p v-if="polls.error" class="notice">
      The polls could not load: {{ polls.error.message }}
    </p>
    <p v-else-if="polls.data?.length === 0" class="notice">
      There are no polls yet. Run <code>npx convex run seed:polls</code>
      to create them.
    </p>

    <PollRow
      v-if="featured"
      :poll="featured"
      featured
      @vote="cast(featured._id, $event)"
    />

    <main class="layout">
      <section class="board" aria-label="More polls">
        <PollRow
          v-for="poll in others"
          :key="poll._id"
          :poll="poll"
          @vote="cast(poll._id, $event)"
        />
      </section>
      <UnderTheHood />
    </main>

    <p class="problem" role="status">
      {{ problem }}
    </p>
  </div>
</template>
