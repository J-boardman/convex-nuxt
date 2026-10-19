<script setup lang="ts">
import type { FunctionReturnType } from 'convex/server'
import type { api } from '~~/convex/_generated/api'

type Poll = FunctionReturnType<typeof api.polls.list>[number]
type Choice = 0 | 1

const props = defineProps<{ poll: Poll }>()
const emit = defineEmits<{ vote: [choice: Choice] }>()
const choices = [0, 1] as const

const total = computed(() => props.poll.counts.reduce((sum, count) => sum + count, 0))
const share = computed(() =>
  total.value === 0 ? 50 : (100 * (props.poll.counts[0] ?? 0)) / total.value)

function percent(choice: Choice) {
  if (total.value === 0) return '–'
  return `${Math.round(choice === 0 ? share.value : 100 - share.value)}%`
}

// A spark rises from a side when a vote from anywhere else lands on it:
// another visitor, or this visitor in another window. A pick made by
// clicking in this tab does not spark.
interface Spark { id: number, choice: Choice, amount: number }
const sparks = ref<Spark[]>([])
let nextSpark = 0
let clickedHere = false

function vote(choice: Choice) {
  if (props.poll.myChoice !== choice) clickedHere = true
  emit('vote', choice)
}

watch(
  () => [props.poll.counts, props.poll.myChoice] as const,
  ([counts, mine], [previousCounts, previousMine]) => {
    const ownChange = clickedHere && mine !== previousMine
    if (ownChange) clickedHere = false
    for (const choice of choices) {
      const own = ownChange
        ? (mine === choice ? 1 : 0) - (previousMine === choice ? 1 : 0)
        : 0
      const others = (counts[choice] ?? 0) - (previousCounts[choice] ?? 0) - own
      if (others > 0) {
        sparks.value.push({ amount: others, choice, id: nextSpark++ })
      }
    }
  },
)

function retire(id: number) {
  sparks.value = sparks.value.filter(spark => spark.id !== id)
}
</script>

<template>
  <article
    class="poll"
    :class="{ empty: total === 0, tugged: sparks.length > 0 }"
    :style="{ '--share': `${share}%` }"
  >
    <h2 class="question">
      {{ poll.question }}
    </h2>
    <div class="sides" role="group" :aria-label="poll.question">
      <button
        v-for="choice in choices"
        :key="choice"
        type="button"
        class="side"
        :class="choice === 0 ? 'side-a' : 'side-b'"
        :aria-pressed="poll.myChoice === choice"
        @click="vote(choice)"
      >
        <span class="option">{{ poll.options[choice] }}</span>
        <span class="tally">
          <span class="percent">{{ percent(choice) }}</span>
          {{ poll.counts[choice] }} {{ poll.counts[choice] === 1 ? 'vote' : 'votes' }}
        </span>
        <span class="mine" :class="{ hidden: poll.myChoice !== choice }">Your pick</span>
        <span
          v-for="spark in sparks.filter(spark => spark.choice === choice)"
          :key="spark.id"
          class="spark"
          aria-hidden="true"
          @animationend="retire(spark.id)"
        >+{{ spark.amount }}</span>
      </button>
    </div>
    <div class="rope" aria-hidden="true">
      <span class="knot" />
    </div>
    <p v-if="total === 0" class="empty-note">
      No votes yet. Pick a side to start the tug.
    </p>
  </article>
</template>
