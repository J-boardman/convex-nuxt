<template>
  <main class="bench setup-bench">
    <header class="masthead">
      <p class="eyebrow">Vue integration playground</p>
      <p class="edition">runtime / idle</p>
    </header>

    <section class="setup-panel" aria-labelledby="setup-title">
      <p class="kicker">Convex signal bench</p>
      <h1 id="setup-title">Connect a deployment.</h1>
      <p class="introduction">
        Set <code>VITE_CONVEX_URL</code> in <code>playgrounds/vue/.env</code>,
        then restart this playground. No client is created until the URL is
        present.
      </p>
      <pre><span>VITE_CONVEX_URL=</span>https://your-deployment.convex.cloud</pre>
    </section>

    <footer>
      <span>@j-boardman/convex-vue</span>
      <span>waiting for signal</span>
    </footer>
  </main>
</template>
