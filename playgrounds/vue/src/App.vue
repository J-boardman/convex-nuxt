<script setup lang="ts">
import { api } from '@j-boardman/convex-playground-backend/api'
import {
  setupConvexAuth,
  useConvexAuth,
  useConvexAction,
  useConvexClient,
  useConvexConnectionState,
  useConvexMutation,
  useConvexQuery,
} from '@j-boardman/convex-vue'
import { computed } from 'vue'
import { useProbeOperations } from './useProbeOperations'

const client = useConvexClient()
setupConvexAuth(() => ({
  fetchAccessToken: async () => null,
  isAuthenticated: false,
  isLoading: false,
}))
const auth = useConvexAuth()
const deployment = import.meta.env.VITE_CONVEX_URL
const connection = useConvexConnectionState()
const probes = useConvexQuery(api.probes.list, { surface: 'vue' })
const record = useConvexMutation(api.probes.record)
const roundTrip = useConvexAction(api.probes.roundTrip)
const {
  actionError,
  actionResult,
  actionState,
  label,
  lastRequest,
  mutationError,
  mutationState,
  sendAction,
  sendMutation,
} = useProbeOperations(record, roundTrip)

const probeCount = computed(() => probes.data?.length ?? 0)
</script>

<template>
  <main class="bench">
    <header class="masthead">
      <p class="eyebrow">Vue integration playground</p>
      <p class="edition">runtime / 001</p>
    </header>

    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy">
        <p class="kicker">Convex signal bench</p>
        <h1 id="page-title">
          Watch the client.<br>
          Trust the transition.
        </h1>
        <p class="introduction">
          A development surface for the state changes that matter: one client,
          live query hand-off, authentication, pagination, and teardown.
        </p>
      </div>

      <aside class="runtime-card" aria-label="Active Convex runtime">
        <div class="runtime-heading">
          <span class="status-light" aria-hidden="true" />
          <span>Client active</span>
        </div>
        <dl>
          <div>
            <dt>Owner</dt>
            <dd>Vue application</dd>
          </div>
          <div>
            <dt>Deployment</dt>
            <dd>{{ deployment }}</dd>
          </div>
          <div>
            <dt>Closed</dt>
            <dd>{{ client.closed ? 'yes' : 'no' }}</dd>
          </div>
          <div>
            <dt>Auth</dt>
            <dd>{{ auth.state.status }}</dd>
          </div>
          <div>
            <dt>Socket</dt>
            <dd>{{ connection.isWebSocketConnected ? 'connected' : 'connecting' }}</dd>
          </div>
          <div>
            <dt>Reconnects</dt>
            <dd>{{ connection.connectionCount }}</dd>
          </div>
        </dl>
      </aside>
    </section>

    <section class="probe-grid" aria-label="Convex integration probes">
      <section class="signal-panel live-feed" aria-labelledby="feed-title">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Reactive query</p>
            <h2 id="feed-title">Live event trace</h2>
          </div>
          <p class="panel-note">
            {{ probeCount }} / 25 retained
          </p>
        </div>

        <div class="query-status" :data-state="probes.state.status">
          <span class="status-light" aria-hidden="true" />
          <strong>{{ probes.state.status }}</strong>
          <span v-if="probes.error">{{ probes.error.message }}</span>
          <span v-else>Subscription state is explicit and reactive.</span>
        </div>

        <ol v-if="probes.data?.length" class="event-list">
          <li v-for="probe in probes.data" :key="probe._id">
            <time>{{ new Date(probe._creationTime).toLocaleTimeString() }}</time>
            <span>{{ probe.label }}</span>
            <code>{{ probe.requestId.slice(0, 8) }}</code>
          </li>
        </ol>
        <p v-else-if="probes.state.status === 'success'" class="empty-state">
          No events yet. Record the first mutation to watch this query update.
        </p>
        <p v-else class="empty-state">
          Waiting for the first server value.
        </p>
      </section>

      <section class="control-panel" aria-labelledby="control-title">
        <div>
          <p class="eyebrow">Write controls</p>
          <h2 id="control-title">Cross the boundary</h2>
        </div>

        <form @submit.prevent="sendMutation(false)">
          <label for="probe-label">Event label</label>
          <input
            id="probe-label"
            v-model="label"
            maxlength="120"
            autocomplete="off"
          >
          <button type="submit" :disabled="mutationState === 'sending' || !label.trim()">
            {{ mutationState === 'sending' ? 'Recording…' : 'Record mutation' }}
          </button>
        </form>

        <div class="operation-result" aria-live="polite">
          <span>Mutation</span>
          <strong v-if="mutationState === 'created'">created one event</strong>
          <strong v-else-if="mutationState === 'reused'">retry reused the event</strong>
          <strong v-else-if="mutationState === 'error'">{{ mutationError }}</strong>
          <strong v-else>{{ mutationState }}</strong>
        </div>

        <button
          class="secondary-button"
          type="button"
          :disabled="!lastRequest || mutationState === 'sending'"
          @click="sendMutation(true)"
        >
          Retry same request
        </button>

        <div class="action-probe">
          <button type="button" :disabled="actionState === 'sending'" @click="sendAction">
            {{ actionState === 'sending' ? 'Invoking…' : 'Invoke action' }}
          </button>
          <p aria-live="polite">
            {{ actionError ?? actionResult ?? 'No action result yet.' }}
          </p>
        </div>
      </section>
    </section>

    <section class="signal-panel lifecycle-panel" aria-labelledby="signal-title">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Lifecycle trace</p>
          <h2 id="signal-title">One runtime, four observation points</h2>
        </div>
        <p class="panel-note">The same probe contract will drive Nuxt.</p>
      </div>

      <ol class="signal-rail">
        <li :class="{ 'is-live': !client.closed }">
          <span class="rail-marker" />
          <strong>Client</strong>
          <small>app-owned</small>
        </li>
        <li :class="{ 'is-live': probes.state.status === 'success' }">
          <span class="rail-marker" />
          <strong>Query</strong>
          <small>{{ probes.state.status }}</small>
        </li>
        <li>
          <span class="rail-marker" />
          <strong>Auth</strong>
          <small>awaiting probe</small>
        </li>
        <li :class="{ 'is-live': mutationState === 'created' || mutationState === 'reused' }">
          <span class="rail-marker" />
          <strong>Write</strong>
          <small>{{ mutationState }}</small>
        </li>
      </ol>
    </section>

    <footer>
      <span>@j-boardman/convex-vue</span>
      <span>diagnostic surface</span>
    </footer>
  </main>
</template>
