<script setup lang="ts">
import { useConvexClient } from '@j-boardman/convex-vue'

const client = useConvexClient()
const deployment = import.meta.env.VITE_CONVEX_URL
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
        </dl>
      </aside>
    </section>

    <section class="signal-panel" aria-labelledby="signal-title">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Lifecycle trace</p>
          <h2 id="signal-title">One runtime, four observation points</h2>
        </div>
        <p class="panel-note">Future features attach here as they land.</p>
      </div>

      <ol class="signal-rail">
        <li class="is-live">
          <span class="rail-marker" />
          <strong>Client</strong>
          <small>app-owned</small>
        </li>
        <li>
          <span class="rail-marker" />
          <strong>Query</strong>
          <small>awaiting probe</small>
        </li>
        <li>
          <span class="rail-marker" />
          <strong>Auth</strong>
          <small>awaiting probe</small>
        </li>
        <li>
          <span class="rail-marker" />
          <strong>Payload</strong>
          <small>Nuxt bridge</small>
        </li>
      </ol>
    </section>

    <footer>
      <span>@j-boardman/convex-vue</span>
      <span>diagnostic surface</span>
    </footer>
  </main>
</template>
