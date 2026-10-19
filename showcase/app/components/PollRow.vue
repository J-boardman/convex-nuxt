<script setup lang="ts">
import type { FunctionReturnType } from 'convex/server'
import type { api } from '~~/convex/_generated/api'

type Poll = FunctionReturnType<typeof api.polls.list>[number]

const props = defineProps<{ poll: Poll }>()
const emit = defineEmits<{ vote: [choice: 0 | 1] }>()

const total = computed(() => props.poll.counts.reduce((sum, count) => sum + count, 0))
const share = computed(() =>
  total.value === 0 ? 50 : (100 * (props.poll.counts[0] ?? 0)) / total.value)

function percent(choice: 0 | 1) {
  const value = choice === 0 ? share.value : 100 - share.value
  return Math.round(value)
}

// When someone else votes, the knot between the sides gives a small tug.
const tugged = ref(false)
watch(total, (next, previous) => {
  if (next === previous) return
  tugged.value = false
  requestAnimationFrame(() => {
    tugged.value = true
  })
})
</script>

<template>
  <article class="poll" :style="{ '--share': `${share}%` }">
    <h2 class="question">
      {{ poll.question }}
    </h2>
    <div class="sides" role="group" :aria-label="poll.question">
      <button
        v-for="choice in ([0, 1] as const)"
        :key="choice"
        type="button"
        class="side"
        :class="choice === 0 ? 'side-a' : 'side-b'"
        :aria-pressed="poll.myChoice === choice"
        @click="emit('vote', choice)"
      >
        <span class="option">{{ poll.options[choice] }}</span>
        <span class="tally">
          <span class="percent">{{ percent(choice) }}%</span>
          {{ poll.counts[choice] }} {{ poll.counts[choice] === 1 ? 'vote' : 'votes' }}
        </span>
        <span class="mine" :class="{ hidden: poll.myChoice !== choice }">Your pick</span>
      </button>
    </div>
    <div class="rope" aria-hidden="true">
      <span class="knot" :class="{ tugged }" @animationend="tugged = false" />
    </div>
  </article>
</template>
