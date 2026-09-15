import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { v } from 'convex/values'
import { action, mutation, query } from './_generated/server'

const playgroundSurface = v.union(v.literal('vue'), v.literal('nuxt'))

const probe = v.object({
  _creationTime: v.number(),
  _id: v.id('probes'),
  label: v.string(),
  requestId: v.string(),
  surface: playgroundSurface,
})

function normalizeLabel(label: string) {
  const normalized = label.trim()

  if (normalized.length === 0 || normalized.length > 120) {
    throw new Error('Probe labels must contain between 1 and 120 characters.')
  }

  return normalized
}

export const list = query({
  args: {
    surface: playgroundSurface,
  },
  returns: v.array(probe),
  handler: async (ctx, args) => {
    const probes = await ctx.db
      .query('probes')
      .withIndex('by_surface', (q) => q.eq('surface', args.surface))
      .order('desc')
      .take(25)

    return probes.reverse()
  },
})

export const paginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    surface: playgroundSurface,
  },
  returns: paginationResultValidator(probe),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('probes')
      .withIndex('by_surface', q => q.eq('surface', args.surface))
      .order('desc')
      .paginate(args.paginationOpts)
  },
})

export const record = mutation({
  args: {
    label: v.string(),
    requestId: v.string(),
    surface: playgroundSurface,
  },
  returns: v.object({
    created: v.boolean(),
    probeId: v.id('probes'),
  }),
  handler: async (ctx, args) => {
    const label = normalizeLabel(args.label)
    const requestId = args.requestId.trim()

    if (requestId.length === 0 || requestId.length > 120) {
      throw new Error('Probe request IDs must contain between 1 and 120 characters.')
    }

    const existing = await ctx.db
      .query('probes')
      .withIndex('by_request_id', (q) => q.eq('requestId', requestId))
      .unique()

    if (existing) {
      if (existing.label !== label || existing.surface !== args.surface) {
        throw new Error('A probe request ID cannot describe two events.')
      }

      return { created: false, probeId: existing._id }
    }

    const retained = await ctx.db
      .query('probes')
      .withIndex('by_surface', (q) => q.eq('surface', args.surface))
      .order('asc')
      .take(25)

    const oldest = retained[0]
    if (oldest && retained.length === 25) {
      await ctx.db.delete(oldest._id)
    }

    const probeId = await ctx.db.insert('probes', {
      label,
      requestId,
      surface: args.surface,
    })

    return { created: true, probeId }
  },
})

export const rejectOptimistic = mutation({
  args: {
    surface: playgroundSurface,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    void ctx
    void args
    throw new Error('Intentional playground rejection for optimistic rollback.')
  },
})

export const roundTrip = action({
  args: {
    label: v.string(),
    surface: playgroundSurface,
  },
  returns: v.object({
    label: v.string(),
    runtime: v.literal('action'),
    surface: playgroundSurface,
  }),
  handler: async (ctx, args) => {
    void ctx

    return {
      label: normalizeLabel(args.label),
      runtime: 'action' as const,
      surface: args.surface,
    }
  },
})
