const runtimeEntry = '@j-boardman/convex-nuxt/runtime'

export interface ConvexAutoImport {
  readonly from: string
  readonly name: string
}

export const convexAutoImports: readonly ConvexAutoImport[] = [
  { from: runtimeEntry, name: 'closeConvex' },
  { from: runtimeEntry, name: 'setupConvexAuth' },
  { from: runtimeEntry, name: 'useConvexAction' },
  { from: runtimeEntry, name: 'useConvexAuth' },
  { from: runtimeEntry, name: 'useConvexClient' },
  { from: runtimeEntry, name: 'useConvexConnectionState' },
  { from: runtimeEntry, name: 'useConvexMutation' },
  { from: runtimeEntry, name: 'useConvexPaginatedQuery' },
  { from: runtimeEntry, name: 'useConvexQuery' },
]
