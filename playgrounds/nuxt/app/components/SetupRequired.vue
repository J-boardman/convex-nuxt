<template>
  <main class="shell setup-shell">
    <header class="masthead">
      <p class="overline">Nuxt integration playground</p>
      <p>runtime / idle</p>
    </header>

    <section class="setup-panel" aria-labelledby="setup-title">
      <p class="signal-label">Universal signal lab</p>
      <h1 id="setup-title">Connect a deployment.</h1>
      <p class="lede">
        Set <code>NUXT_PUBLIC_CONVEX_URL</code> in
        <code>playgrounds/nuxt/.env</code>, then restart this playground. The
        module and browser client stay inactive until the URL is present.
      </p>
      <pre><span>NUXT_PUBLIC_CONVEX_URL=</span>https://your-deployment.convex.cloud</pre>
    </section>

    <footer>
      <span>@j-boardman/convex-nuxt</span>
      <span>waiting for signal</span>
    </footer>
  </main>
</template>

<style scoped src="../assets/diagnostic.css" />
