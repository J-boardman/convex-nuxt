<script setup lang="ts">
const traces = useQueryTraces()
const { latency, offline } = useNetwork()
</script>

<template>
  <aside class="hood" aria-label="Under the hood">
    <h2 class="hood-title">
      Under the hood
    </h2>

    <section class="hood-section">
      <h3>Queries on this page</h3>
      <dl v-for="trace in traces" :key="trace.name" class="trace">
        <dt>{{ trace.name }}</dt>
        <dd :data-done="trace.fromServer">
          {{ trace.fromServer ? 'Rendered on the server and reused while hydrating, with no second fetch' : 'Fetched in the browser' }}
        </dd>
        <dd :data-done="trace.liveAfter !== undefined">
          {{ trace.liveAfter === undefined ? 'Waiting for Convex…' : `Live ${trace.liveAfter} ms after the page woke up` }}
        </dd>
        <dd :data-done="trace.changes > 0">
          {{ trace.changes }} {{ trace.changes === 1 ? 'change' : 'changes' }} pushed since
        </dd>
      </dl>
    </section>

    <section class="hood-section">
      <h3>Network</h3>
      <label class="control">
        <span>Added latency <output>{{ latency }} ms</output></span>
        <input v-model.number="latency" type="range" min="0" max="3000" step="250">
      </label>
      <label class="control switch">
        <input v-model="offline" type="checkbox" role="switch">
        <span>Cut the connection to Convex</span>
      </label>
      <p class="hint">
        Cut the connection and vote. The bar moves at once; the vote is sent
        when you restore the connection, and every other tab catches up.
      </p>
    </section>

    <section class="hood-section">
      <h3>Also try</h3>
      <ul class="hint-list">
        <li>Open this page in a second window and vote in one of them.</li>
        <li>View the page source: the counts and your picks are already in the HTML.</li>
      </ul>
    </section>
  </aside>
</template>
