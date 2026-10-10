<script setup lang="ts">
import { useConvexMutation, useConvexQuery } from '@j-boardman/convex-vue'
import { ref } from 'vue'
import { api } from '@j-boardman/convex-example-backend/api'
import type { Id } from '@j-boardman/convex-example-backend/dataModel'

const tasks = useConvexQuery(api.tasks.list)
const toggleTask = useConvexMutation(api.tasks.toggle)

// The task appears immediately; Convex replaces it with the stored one, or
// rolls it back if the mutation fails.
const addTask = useConvexMutation(api.tasks.add).withOptimisticUpdate(
  (store, { text }) => {
    const current = store.getQuery(api.tasks.list, {})
    if (!current) return
    store.setQuery(api.tasks.list, {}, [
      {
        _creationTime: Date.now(),
        _id: crypto.randomUUID() as Id<'tasks'>,
        isCompleted: false,
        text,
      },
      ...current,
    ])
  },
)

const draft = ref('')

async function submit() {
  const text = draft.value.trim()
  if (!text) return
  draft.value = ''
  await addTask({ text })
}
</script>

<template>
  <main>
    <h1>Tasks</h1>
    <form @submit.prevent="submit">
      <input v-model="draft" aria-label="New task" placeholder="What needs doing?">
      <button type="submit">Add</button>
    </form>
    <p v-if="tasks.error">{{ tasks.error.message }}</p>
    <p v-else-if="tasks.isLoading">Loading…</p>
    <ul v-else>
      <li v-for="task in tasks.data" :key="task._id">
        <label>
          <input
            type="checkbox"
            :checked="task.isCompleted"
            @change="toggleTask({ id: task._id })"
          >
          {{ task.text }}
        </label>
      </li>
    </ul>
  </main>
</template>

<style>
body { font: 16px/1.5 system-ui, sans-serif; margin: 0; }
main { margin: 4rem auto; max-width: 32rem; padding: 0 1rem; }
form { display: flex; gap: 0.5rem; }
input:not([type]) { flex: 1; padding: 0.5rem; }
ul { list-style: none; padding: 0; }
li { border-bottom: 1px solid #ddd; padding: 0.5rem 0; }
label:has(:checked) { color: #888; text-decoration: line-through; }
</style>
