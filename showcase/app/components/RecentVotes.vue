<script setup lang="ts">
import { api } from '~~/convex/_generated/api'

const feed = useConvexPaginatedQuery(api.activity.recent, {}, { initialNumItems: 6 })
useQueryTrace(
  'activity.recent',
  'useConvexPaginatedQuery(api.activity.recent, {}, { initialNumItems: 6 })',
  () => feed.results,
)
</script>

<template>
  <section class="hood-section" aria-labelledby="feed-title">
    <h3 id="feed-title">
      Votes as they arrive
    </h3>
    <p v-if="feed.error" class="hint">
      Recent votes could not load: {{ feed.error.message }}
    </p>
    <p v-else-if="feed.state.status === 'exhausted' && feed.results.length === 0" class="hint">
      No votes yet. Yours will be the first.
    </p>
    <TransitionGroup tag="ol" name="arrive" class="feed-list">
      <li v-for="entry in feed.results" :key="entry._id" class="feed-item">
        <span><strong>{{ entry.voterName }}</strong> picked <em>{{ entry.option }}</em></span>
        <span class="feed-meta">
          {{ entry.question }} · <NuxtTime :datetime="entry._creationTime" relative />
        </span>
      </li>
    </TransitionGroup>
    <button
      v-if="feed.state.status === 'ready' || feed.state.status === 'loadingMore'"
      class="more"
      type="button"
      :disabled="feed.state.status === 'loadingMore'"
      @click="feed.loadMore(6)"
    >
      {{ feed.state.status === 'loadingMore' ? 'Loading older votes…' : 'Show older votes' }}
    </button>
  </section>
</template>
