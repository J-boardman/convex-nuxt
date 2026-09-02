import { describe, expect, it, vi } from 'vitest'
import { useNuxtProbeOperations } from '../../playgrounds/nuxt/app/composables/useNuxtProbeOperations'

describe('Nuxt playground probe operations', () => {
  it('uses the Nuxt surface and retries the exact mutation request', async () => {
    const record = vi.fn()
      .mockResolvedValueOnce({ created: true })
      .mockResolvedValueOnce({ created: false })
    const roundTrip = vi.fn()
    const createRequestId = vi.fn(() => 'nuxt-request-1')
    const operations = useNuxtProbeOperations(record, roundTrip, createRequestId)

    await operations.sendMutation()
    expect(operations.mutationState.value).toBe('created')
    expect(record).toHaveBeenLastCalledWith({
      label: 'Nuxt mutation reached Convex',
      requestId: 'nuxt-request-1',
      surface: 'nuxt',
    })

    await operations.sendMutation(true)
    expect(operations.mutationState.value).toBe('reused')
    expect(record.mock.calls[1]?.[0]).toStrictEqual(record.mock.calls[0]?.[0])
    expect(createRequestId).toHaveBeenCalledTimes(1)
  })

  it('reports action success independently from mutation failure', async () => {
    const record = vi.fn().mockRejectedValue(new Error('mutation unavailable'))
    const roundTrip = vi.fn().mockResolvedValue({
      label: 'Nuxt action crossed the runtime boundary',
      runtime: 'action',
      surface: 'nuxt',
    })
    const operations = useNuxtProbeOperations(record, roundTrip, () => 'nuxt-request-2')

    await operations.sendMutation()
    await operations.sendAction()

    expect(operations.mutationState.value).toBe('error')
    expect(operations.mutationError.value).toBe('mutation unavailable')
    expect(operations.actionState.value).toBe('success')
    expect(operations.actionResult.value).toBe(
      'action / Nuxt action crossed the runtime boundary',
    )
  })
})
