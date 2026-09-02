import { ref } from 'vue'

export interface NuxtProbeRequest {
  label: string
  requestId: string
  surface: 'nuxt'
}

interface ProbeMutationResult {
  created: boolean
}

interface ProbeActionResult {
  label: string
  runtime: 'action'
  surface: 'vue' | 'nuxt'
}

export type RecordNuxtProbe = (
  args: NuxtProbeRequest,
) => Promise<ProbeMutationResult>

export type RoundTripNuxtProbe = (args: {
  label: string
  surface: 'nuxt'
}) => Promise<ProbeActionResult>

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function useNuxtProbeOperations(
  record: RecordNuxtProbe,
  roundTrip: RoundTripNuxtProbe,
  createRequestId: () => string = () => crypto.randomUUID(),
) {
  const label = ref('Nuxt mutation reached Convex')
  const mutationState = ref<'idle' | 'sending' | 'created' | 'reused' | 'error'>('idle')
  const mutationError = ref<string>()
  const actionState = ref<'idle' | 'sending' | 'success' | 'error'>('idle')
  const actionResult = ref<string>()
  const actionError = ref<string>()
  const lastRequest = ref<NuxtProbeRequest>()

  async function sendMutation(retry = false) {
    const currentLabel = label.value.trim()
    if (!currentLabel) return

    const args = retry && lastRequest.value
      ? lastRequest.value
      : {
          label: currentLabel,
          requestId: createRequestId(),
          surface: 'nuxt' as const,
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
        label: 'Nuxt action crossed the runtime boundary',
        surface: 'nuxt',
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
