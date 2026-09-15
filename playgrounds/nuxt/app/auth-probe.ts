import type { InjectionKey, Ref } from 'vue'

export type AuthProbeUser = 'alpha' | 'alphaRefresh' | 'beta'

export interface ConvexAuthProbe {
  readonly activeUser: Readonly<Ref<AuthProbeUser | 'signedOut'>>
  readonly tokenFetchCount: Readonly<Ref<number>>
  refresh: () => Promise<void>
  signIn: (user: AuthProbeUser) => Promise<void>
  signOut: () => void
}

export const convexAuthProbeKey: InjectionKey<ConvexAuthProbe | undefined>
  = Symbol('convex-auth-probe')
