// Every visitor has an anonymous session, so the provider is never loading
// and always signed in. The browser fetches tokens from the server; during
// server rendering the request signs one directly, so the first HTML is
// already personal ("your pick" is highlighted before any JavaScript runs).
export default defineNuxtPlugin({
  name: 'convex-auth',
  dependsOn: ['convex'],
  setup() {
    const signServerToken = (useRequestEvent()?.context as {
      showcaseToken?: () => Promise<string>
    } | undefined)?.showcaseToken

    setupConvexAuth(
      () => ({
        fetchAccessToken: async () =>
          (await $fetch<{ token: string }>('/api/session/token', { method: 'POST' })).token,
        isAuthenticated: true,
        isLoading: false,
      }),
      { serverToken: async () => await signServerToken?.() ?? null },
    )
  },
})
