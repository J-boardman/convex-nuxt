<script setup lang="ts">
import { api } from '~~/convex/_generated/api'

const feed = useConvexPaginatedQuery(api.activity.recent, {}, { initialNumItems: 6 })
useQueryTrace('activity.recent', () => feed.results)
</script>

<template>
  <aside class="feed" aria-labelledby="feed-title">
    <h2 id="feed-title" class="feed-title">
      Recent votes
    </h2>
    <p v-if="feed.error" class="notice">
      Recent votes could not load: {{ feed.error.message }}
    </p>
    <p v-else-if="feed.state.status === 'exhausted' && feed.results.length === 0" class="notice">
      No votes yet. Yours will be the first.
    </p>
    <ol class="feed-list">
      <li v-for="entry in feed.results" :key="entry._id" class="feed-item">
        <span><strong>{{ entry.voterName }}</strong> picked <em>{{ entry.option }}</em></span>
        <span class="feed-meta">
          {{ entry.question }} · <NuxtTime :datetime="entry._creationTime" relative />
        </span>
      </li>
    </ol>
    <button
      v-if="feed.state.status === 'ready' || feed.state.status === 'loadingMore'"
      class="more"
      type="button"
      :disabled="feed.state.status === 'loadingMore'"
      @click="feed.loadMore(6)"
    >
      {{ feed.state.status === 'loadingMore' ? 'Loading older votes…' : 'Show older votes' }}
    </button>
  </aside>
</template>
