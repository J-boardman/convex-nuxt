import type { OptimisticUpdate } from 'convex/browser'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from 'convex/server'
import { browserClient, useConvexRuntime } from './plugin.js'
import type { ConvexVueRuntime } from './plugin.js'

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

// Writes resolve the client when called, so components can declare them
// during SSR and only a server-side call fails.
function createMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
  runtime: ConvexVueRuntime,
  optimisticUpdate?: OptimisticUpdate<FunctionArgs<Mutation>>,
): ConvexMutation<Mutation> {
  const callable = (async (...args: OptionalRestArgs<Mutation>) =>
    await browserClient(runtime, 'Calling a Convex mutation').mutation(
      mutation,
      (args[0] ?? {}) as FunctionArgs<Mutation>,
      { optimisticUpdate },
    )) as ConvexMutation<Mutation>
  callable.withOptimisticUpdate = (update) => {
    if (optimisticUpdate) {
      throw new Error('This Convex mutation already has an optimistic update.')
    }
    return createMutation(mutation, runtime, update)
  }
  return callable
}

export function useConvexMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
): ConvexMutation<Mutation> {
  return createMutation(mutation, useConvexRuntime())
}

export function useConvexAction<Action extends FunctionReference<'action'>>(
  action: Action,
): ConvexAction<Action> {
  const runtime = useConvexRuntime()
  return async (...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>> =>
    await browserClient(runtime, 'Calling a Convex action').action(
      action,
      (args[0] ?? {}) as FunctionArgs<Action>,
    )
}
