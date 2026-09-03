<script setup lang="ts">
import { api } from '@j-boardman/convex-playground-backend/api'
import {
  useConvexAction,
  useConvexAuth,
  useConvexClient,
  useConvexConnectionState,
  useConvexMutation,
  useConvexPaginatedQuery,
  useConvexQuery,
} from '@j-boardman/convex-nuxt/runtime'
import type {
  RecordNuxtProbe,
  RoundTripNuxtProbe,
} from '../composables/useNuxtProbeOperations'

defineProps<{
  deploymentUrl: string
}>()

const probes = useConvexQuery(api.probes.list, { surface: 'nuxt' })
const paginatedProbes = useConvexPaginatedQuery(
  api.probes.paginated,
  { surface: 'nuxt' },
  { initialNumItems: 3 },
)
const auth = useConvexAuth()
const client = import.meta.client ? useConvexClient() : undefined
const connection = import.meta.client ? useConvexConnectionState() : undefined
const record: RecordNuxtProbe = import.meta.client
  ? useConvexMutation(api.probes.record)
  : async () => ({ created: false })
const roundTrip: RoundTripNuxtProbe = import.meta.client
  ? useConvexAction(api.probes.roundTrip)
  : async args => ({ ...args, runtime: 'action' })
const operations = useNuxtProbeOperations(record, roundTrip)
const probeCount = computed(() => probes.data?.length ?? 0)
const clientClosed = computed(() => client?.closed ?? false)
const socketConnected = computed(() =>
  connection?.value.isWebSocketConnected ?? false,
)
const connectionCount = computed(() => connection?.value.connectionCount ?? 0)
</script>

<template>
  <main class="shell">
    <header class="masthead">
      <p class="overline">Nuxt integration playground</p>
      <p>runtime / 002</p>
    </header>

    <section class="hero" aria-labelledby="page-title">
      <div>
        <p class="signal-label">Universal signal lab</p>
        <h1 id="page-title">One module.<br><em>Two runtimes.</em></h1>
        <p class="lede">
          This page proves the Nuxt module reaches the same Vue runtime and
          shared Convex backend while preserving a clear server/client boundary.
        </p>
      </div>

      <aside class="runtime-card" aria-label="Active Nuxt runtime">
        <span class="pulse" aria-hidden="true" />
        <p>Runtime installed</p>
        <dl>
          <div><dt>Owner</dt><dd>Nuxt application</dd></div>
          <div><dt>Deployment</dt><dd>{{ deploymentUrl }}</dd></div>
          <div><dt>Closed</dt><dd>{{ clientClosed ? 'yes' : 'no' }}</dd></div>
          <div><dt>Auth</dt><dd>{{ auth.state.status }}</dd></div>
          <div>
            <dt>Socket</dt>
            <dd>{{ socketConnected ? 'connected' : 'connecting' }}</dd>
          </div>
          <div><dt>Reconnects</dt><dd>{{ connectionCount }}</dd></div>
        </dl>
      </aside>
    </section>

    <section class="trace-grid" aria-label="Convex integration probes">
      <section class="trace-panel" aria-labelledby="trace-title">
        <div class="panel-heading">
          <div>
            <p class="overline">Reactive query</p>
            <h2 id="trace-title">Nuxt event trace</h2>
          </div>
          <p>{{ probeCount }} / 25 retained</p>
        </div>

        <div class="query-state" :data-state="probes.state.status">
          <span class="pulse" aria-hidden="true" />
          <strong>{{ probes.state.status }}</strong>
          <span v-if="probes.error">{{ probes.error.message }}</span>
          <span v-else>The subscription begins after client hydration.</span>
        </div>

        <ol v-if="probes.data?.length" class="events">
          <li v-for="probe in probes.data" :key="probe._id">
            <time>{{ new Date(probe._creationTime).toLocaleTimeString() }}</time>
            <span>{{ probe.label }}</span>
            <code>{{ probe.requestId.slice(0, 8) }}</code>
          </li>
        </ol>
        <p v-else-if="probes.state.status === 'success'" class="empty-state">
          The Nuxt trace is clear. Record a mutation to create its first event.
        </p>
        <p v-else class="empty-state">Waiting for the first client value.</p>
      </section>

      <section class="controls" aria-labelledby="controls-title">
        <div>
          <p class="overline">Boundary controls</p>
          <h2 id="controls-title">Send a signal</h2>
        </div>

        <form @submit.prevent="operations.sendMutation(false)">
          <label for="nuxt-probe-label">Event label</label>
          <input
            id="nuxt-probe-label"
            v-model="operations.label.value"
            maxlength="120"
            autocomplete="off"
          >
          <button
            type="submit"
            :disabled="operations.mutationState.value === 'sending' || !operations.label.value.trim()"
          >
            {{ operations.mutationState.value === 'sending' ? 'Recording…' : 'Record mutation' }}
          </button>
        </form>

        <div class="operation-result" aria-live="polite">
          <span>Mutation</span>
          <strong v-if="operations.mutationState.value === 'created'">created one event</strong>
          <strong v-else-if="operations.mutationState.value === 'reused'">retry reused the event</strong>
          <strong v-else-if="operations.mutationState.value === 'error'">
            {{ operations.mutationError.value }}
          </strong>
          <strong v-else>{{ operations.mutationState.value }}</strong>
        </div>

        <button
          class="secondary"
          type="button"
          :disabled="!operations.lastRequest.value || operations.mutationState.value === 'sending'"
          @click="operations.sendMutation(true)"
        >
          Retry same request
        </button>

        <div class="action-probe">
          <button
            type="button"
            :disabled="operations.actionState.value === 'sending'"
            @click="operations.sendAction"
          >
            {{ operations.actionState.value === 'sending' ? 'Invoking…' : 'Invoke action' }}
          </button>
          <p aria-live="polite">
            {{ operations.actionError.value ?? operations.actionResult.value ?? 'No action result yet.' }}
          </p>
        </div>
      </section>
    </section>

    <section class="boundary-rail" aria-labelledby="boundary-title">
      <div>
        <p class="overline">Current architecture</p>
        <h2 id="boundary-title">The client boundary is visible</h2>
      </div>
      <ol>
        <li class="complete"><span>01</span><strong>Module config</strong><small>runtime URL</small></li>
        <li class="complete"><span>02</span><strong>Vue runtime</strong><small>app-owned client</small></li>
        <li :class="{ complete: probes.state.status === 'success' }">
          <span>03</span><strong>Live query</strong><small>{{ probes.state.status }}</small>
        </li>
        <li class="complete"><span>04</span><strong>SSR seed</strong><small>payload reused</small></li>
      </ol>
    </section>

    <section class="pagination-panel" aria-labelledby="pagination-title">
      <div>
        <p class="overline">Reactive pagination</p>
        <h2 id="pagination-title">Incremental event window</h2>
        <p class="pagination-copy">
          {{ paginatedProbes.results.length }} events loaded ·
          {{ paginatedProbes.state.status }}
        </p>
      </div>
      <ol v-if="paginatedProbes.results.length" class="page-items">
        <li v-for="probe in paginatedProbes.results" :key="probe._id">
          <strong>{{ probe.label }}</strong>
          <code>{{ probe.requestId.slice(0, 8) }}</code>
        </li>
      </ol>
      <p v-else class="pagination-copy">Record a few events to open the window.</p>
      <button
        type="button"
        :disabled="paginatedProbes.state.status !== 'ready'"
        @click="paginatedProbes.loadMore(3)"
      >
        {{ paginatedProbes.state.status === 'loadingMore' ? 'Loading…' : 'Load three more' }}
      </button>
    </section>

    <footer>
      <span>@j-boardman/convex-nuxt</span>
      <span>module consumer / shared backend</span>
    </footer>
  </main>
</template>
