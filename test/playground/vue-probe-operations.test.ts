import { describe, expect, it, vi } from 'vitest'
import { useProbeOperations } from '../../playgrounds/vue/src/useProbeOperations'

describe('Vue playground probe operations', () => {
  it('retries the exact mutation request and reports the server outcome', async () => {
    const record = vi.fn()
      .mockResolvedValueOnce({ created: true })
      .mockResolvedValueOnce({ created: false })
    const roundTrip = vi.fn()
    const createRequestId = vi.fn(() => 'request-1')
    const operations = useProbeOperations(record, roundTrip, createRequestId)

    await operations.sendMutation()
    expect(operations.mutationState.value).toBe('created')
    expect(record).toHaveBeenLastCalledWith({
      label: 'Vue mutation reached Convex',
      requestId: 'request-1',
      surface: 'vue',
    })

    await operations.sendMutation(true)
    expect(operations.mutationState.value).toBe('reused')
    expect(record).toHaveBeenCalledTimes(2)
    expect(record.mock.calls[1]?.[0]).toStrictEqual(record.mock.calls[0]?.[0])
    expect(createRequestId).toHaveBeenCalledTimes(1)
  })

  it('surfaces action results and operation failures independently', async () => {
    const record = vi.fn().mockRejectedValue(new Error('mutation unavailable'))
    const roundTrip = vi.fn().mockResolvedValue({
      label: 'Vue action crossed the runtime boundary',
      runtime: 'action',
      surface: 'vue',
    })
    const operations = useProbeOperations(record, roundTrip, () => 'request-2')

    await operations.sendMutation()
    await operations.sendAction()

    expect(operations.mutationState.value).toBe('error')
    expect(operations.mutationError.value).toBe('mutation unavailable')
    expect(operations.actionState.value).toBe('success')
    expect(operations.actionResult.value).toBe(
      'action / Vue action crossed the runtime boundary',
    )
  })
})
