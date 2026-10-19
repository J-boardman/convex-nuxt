<script setup lang="ts">
const traces = useQueryTraces()
</script>

<template>
  <aside class="hood" aria-labelledby="hood-title">
    <h2 id="hood-title" class="hood-title">
      Under the hood
    </h2>
    <p class="hood-intro">
      What the integration is doing on this page, as it happens.
    </p>

    <RecentVotes />

    <ClientOnly>
      <section class="hood-section" aria-labelledby="queries-title">
        <h3 id="queries-title">
          Queries on this page
        </h3>
        <div v-for="trace in traces" :key="trace.name" class="trace">
          <code class="trace-code">{{ trace.code }}</code>
          <ul class="trace-steps">
            <li :data-done="trace.fromServer">
              {{ trace.fromServer ? 'Server-rendered, reused on hydration' : 'Fetched in the browser' }}
            </li>
            <li :data-done="trace.liveAfter !== undefined">
              {{ trace.liveAfter === undefined ? 'Waiting for Convex' : `Live after ${trace.liveAfter} ms` }}
            </li>
            <li :data-done="trace.changes > 0">
              {{ trace.changes }} {{ trace.changes === 1 ? 'change' : 'changes' }} pushed
            </li>
          </ul>
        </div>
      </section>
      <NetworkControls />
    </ClientOnly>
  </aside>
</template>
