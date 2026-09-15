/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

describe('shared playground probes', () => {
  it('keeps each integration surface in its own bounded live feed', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.probes.record, {
      label: 'Vue query subscribed',
      requestId: 'vue-1',
      surface: 'vue',
    })
    await t.mutation(api.probes.record, {
      label: 'Nuxt payload hydrated',
      requestId: 'nuxt-1',
      surface: 'nuxt',
    })

    const vueProbes = await t.query(api.probes.list, { surface: 'vue' })

    expect(vueProbes).toHaveLength(1)
    expect(vueProbes[0]).toMatchObject({
      label: 'Vue query subscribed',
      requestId: 'vue-1',
      surface: 'vue',
    })
  })

  it('retains only the newest 25 events for each surface', async () => {
    const t = convexTest(schema, modules)

    for (let index = 0; index < 27; index += 1) {
      await t.mutation(api.probes.record, {
        label: `Vue event ${index}`,
        requestId: `retention-${index}`,
        surface: 'vue',
      })
    }

    const probes = await t.query(api.probes.list, { surface: 'vue' })

    expect(probes).toHaveLength(25)
    expect(probes[0]?.label).toBe('Vue event 2')
    expect(probes.at(-1)?.label).toBe('Vue event 26')
  })

  it('paginates each surface without gaps or repeated events', async () => {
    const t = convexTest(schema, modules)

    for (let index = 0; index < 7; index += 1) {
      await t.mutation(api.probes.record, {
        label: `Nuxt page event ${index}`,
        requestId: `page-${index}`,
        surface: 'nuxt',
      })
    }

    const first = await t.query(api.probes.paginated, {
      paginationOpts: { cursor: null, numItems: 3 },
      surface: 'nuxt',
    })
    const second = await t.query(api.probes.paginated, {
      paginationOpts: { cursor: first.continueCursor, numItems: 4 },
      surface: 'nuxt',
    })

    expect(first.page).toHaveLength(3)
    expect(first.isDone).toBe(false)
    expect(second.page).toHaveLength(4)
    expect(second.isDone).toBe(true)
    expect(new Set([...first.page, ...second.page].map(probe => probe._id)).size).toBe(7)
  })

  it('treats a retried mutation as the same event', async () => {
    const t = convexTest(schema, modules)
    const args = {
      label: 'Mutation retried',
      requestId: 'retry-1',
      surface: 'vue' as const,
    }

    const first = await t.mutation(api.probes.record, args)
    const retry = await t.mutation(api.probes.record, args)

    expect(first).toMatchObject({ created: true })
    expect(retry).toEqual({ created: false, probeId: first.probeId })
    expect(await t.query(api.probes.list, { surface: 'vue' })).toHaveLength(1)
  })

  it('records both integration feeds in one transaction', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.probes.recordAtomicPair, {
      label: 'Atomic pair',
      requestId: 'atomic-1',
    })

    const [vue, nuxt] = await Promise.all([
      t.query(api.probes.list, { surface: 'vue' }),
      t.query(api.probes.list, { surface: 'nuxt' }),
    ])
    expect(vue.at(-1)).toMatchObject({
      label: 'Atomic pair',
      requestId: 'atomic-1:vue',
    })
    expect(nuxt.at(-1)).toMatchObject({
      label: 'Atomic pair',
      requestId: 'atomic-1:nuxt',
    })
  })

  it('rejects conflicting retries and invalid labels', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.probes.record, {
      label: 'Original event',
      requestId: 'conflict-1',
      surface: 'vue',
    })

    await expect(t.mutation(api.probes.record, {
      label: 'Different event',
      requestId: 'conflict-1',
      surface: 'vue',
    })).rejects.toThrow('cannot describe two events')

    await expect(t.mutation(api.probes.record, {
      label: '   ',
      requestId: 'invalid-1',
      surface: 'nuxt',
    })).rejects.toThrow('between 1 and 120 characters')
  })

  it('rejects the optimistic probe without changing server data', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.probes.record, {
      label: 'Server value',
      requestId: 'rollback-1',
      surface: 'vue',
    })

    await expect(t.mutation(api.probes.rejectOptimistic, {
      surface: 'vue',
    })).rejects.toThrow('Intentional playground rejection')

    const probes = await t.query(api.probes.list, { surface: 'vue' })
    expect(probes).toHaveLength(1)
    expect(probes[0]?.label).toBe('Server value')
  })

  it('derives the viewer from Convex auth rather than query arguments', async () => {
    const t = convexTest(schema, modules)

    await expect(t.query(api.probes.viewer, {})).resolves.toBeNull()
    await expect(t.withIdentity({ subject: 'viewer-alpha' })
      .query(api.probes.viewer, {}))
      .resolves.toEqual({ subject: 'viewer-alpha' })
  })

  it('offers the same deterministic action contract to both clients', async () => {
    const t = convexTest(schema, modules)

    await expect(t.action(api.probes.roundTrip, {
      label: '  payload crossed the action boundary  ',
      surface: 'nuxt',
    })).resolves.toEqual({
      label: 'payload crossed the action boundary',
      runtime: 'action',
      surface: 'nuxt',
    })

    await expect(t.action(api.probes.roundTrip, {
      label: '   ',
      surface: 'vue',
    })).rejects.toThrow('between 1 and 120 characters')
  })
})
