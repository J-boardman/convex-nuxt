import type { OptimisticUpdate } from 'convex/browser'
import type { ConvexClient } from 'convex/browser'
import type { Value } from 'convex/values'
import type {
  ArgsAndOptions,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from 'convex/server'
import { useConvexClient } from './plugin.js'

type SynchronousOptimisticUpdate<Update> = Update extends (
  ...args: infer Args
) => infer Result
  ? Update & (
      Result extends Promise<unknown>
        ? 'Optimistic update handlers must be synchronous'
        : (...args: Args) => Result
    )
  : never

export interface ConvexMutationOptions<
  Args extends Record<string, Value>,
  Update extends OptimisticUpdate<Args> = OptimisticUpdate<Args>,
> {
  optimisticUpdate?: SynchronousOptimisticUpdate<Update>
}

export interface ConvexMutation<Mutation extends FunctionReference<'mutation'>> {
  (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>>
  <Update extends OptimisticUpdate<FunctionArgs<Mutation>>>(
    ...args: ArgsAndOptions<
      Mutation,
      ConvexMutationOptions<FunctionArgs<Mutation>, Update>
    >
  ): Promise<FunctionReturnType<Mutation>>
  withOptimisticUpdate<T extends OptimisticUpdate<FunctionArgs<Mutation>>>(
    update: SynchronousOptimisticUpdate<T>,
  ): ConvexMutation<Mutation>
}

export interface ConvexAction<Action extends FunctionReference<'action'>> {
  (...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>>
}

function createMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
  client: ConvexClient,
  optimisticUpdate?: OptimisticUpdate<FunctionArgs<Mutation>>,
): ConvexMutation<Mutation> {
  const execute = (
    ...args: ArgsAndOptions<
      Mutation,
      ConvexMutationOptions<FunctionArgs<Mutation>>
    >
  ): Promise<FunctionReturnType<Mutation>> => {
    const mutationArgs = (args[0] ?? {}) as FunctionArgs<Mutation>
    const perCallUpdate = args[1]?.optimisticUpdate
    if (optimisticUpdate && perCallUpdate) {
      throw new Error(
        'This Convex mutation already has an optimistic update. '
        + 'Remove either the fluent or per-call update.',
      )
    }
    return client.mutation(mutation, mutationArgs, {
      optimisticUpdate: perCallUpdate ?? optimisticUpdate,
    })
  }

  const callable = execute as ConvexMutation<Mutation>
  callable.withOptimisticUpdate = <T extends OptimisticUpdate<FunctionArgs<Mutation>>>(
    update: SynchronousOptimisticUpdate<T>,
  ): ConvexMutation<Mutation> => {
    if (optimisticUpdate) {
      throw new Error('This Convex mutation already has an optimistic update.')
    }
    return createMutation(mutation, client, update)
  }
  return callable
}

export function useConvexMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
): ConvexMutation<Mutation> {
  if (typeof mutation === 'string') {
    throw new Error('useConvexMutation() requires a generated function reference, not a string.')
  }
  return createMutation(mutation, useConvexClient())
}

export function useConvexAction<Action extends FunctionReference<'action'>>(
  action: Action,
): ConvexAction<Action> {
  if (typeof action === 'string') {
    throw new Error('useConvexAction() requires a generated function reference, not a string.')
  }
  const client = useConvexClient()
  return (...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>> => {
    const actionArgs = (args[0] ?? {}) as FunctionArgs<Action>
    return client.action(action, actionArgs)
  }
}
