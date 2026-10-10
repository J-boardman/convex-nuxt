import type { OptimisticUpdate } from 'convex/browser'
import type { ConvexClient } from 'convex/browser'
import type {
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

export interface ConvexMutation<Mutation extends FunctionReference<'mutation'>> {
  (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>>
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
  const callable = ((...args: OptionalRestArgs<Mutation>) =>
    client.mutation(mutation, (args[0] ?? {}) as FunctionArgs<Mutation>, {
      optimisticUpdate,
    })) as ConvexMutation<Mutation>
  callable.withOptimisticUpdate = (update) => {
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
  return createMutation(mutation, useConvexClient())
}

export function useConvexAction<Action extends FunctionReference<'action'>>(
  action: Action,
): ConvexAction<Action> {
  const client = useConvexClient()
  return (...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>> => {
    const actionArgs = (args[0] ?? {}) as FunctionArgs<Action>
    return client.action(action, actionArgs)
  }
}
