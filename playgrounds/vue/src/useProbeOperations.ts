import { ref } from 'vue'

export interface ProbeRequest {
  label: string
  requestId: string
  surface: 'vue'
}

interface ProbeMutationResult {
  created: boolean
}

interface ProbeActionResult {
  label: string
  runtime: 'action'
  surface: 'vue' | 'nuxt'
}

export type RecordProbe = (args: ProbeRequest) => Promise<ProbeMutationResult>
export type RoundTripProbe = (args: {
  label: string
  surface: 'vue'
}) => Promise<ProbeActionResult>

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function useProbeOperations(
  record: RecordProbe,
  roundTrip: RoundTripProbe,
  createRequestId: () => string = () => crypto.randomUUID(),
) {
  const label = ref('Vue mutation reached Convex')
  const mutationState = ref<'idle' | 'sending' | 'created' | 'reused' | 'error'>('idle')
  const mutationError = ref<string>()
  const actionState = ref<'idle' | 'sending' | 'success' | 'error'>('idle')
  const actionResult = ref<string>()
  const actionError = ref<string>()
  const lastRequest = ref<ProbeRequest>()

  async function sendMutation(retry = false) {
    const currentLabel = label.value.trim()
    if (!currentLabel) return

    const args = retry && lastRequest.value
      ? lastRequest.value
      : {
          label: currentLabel,
          requestId: createRequestId(),
          surface: 'vue' as const,
        }

    mutationState.value = 'sending'
    mutationError.value = undefined

    try {
      const result = await record(args)
      lastRequest.value = args
      mutationState.value = result.created ? 'created' : 'reused'
    }
    catch (error) {
      mutationState.value = 'error'
      mutationError.value = errorMessage(error)
    }
  }

  async function sendAction() {
    actionState.value = 'sending'
    actionError.value = undefined

    try {
      const result = await roundTrip({
        label: 'Vue action crossed the runtime boundary',
        surface: 'vue',
      })
      actionResult.value = `${result.runtime} / ${result.label}`
      actionState.value = 'success'
    }
    catch (error) {
      actionState.value = 'error'
      actionError.value = errorMessage(error)
    }
  }

  return {
    actionError,
    actionResult,
    actionState,
    label,
    lastRequest,
    mutationError,
    mutationState,
    sendAction,
    sendMutation,
  }
}
