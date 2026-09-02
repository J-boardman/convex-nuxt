import { convexToJson, jsonToConvex } from 'convex/values'
import type { JSONValue, Value } from 'convex/values'

export interface ConvexSsrSeed {
  readonly encoding: 'convex-json'
  readonly value: JSONValue
  readonly version: 1
}

export function encodeConvexSsrSeed(value: Value): ConvexSsrSeed {
  return {
    encoding: 'convex-json',
    value: convexToJson(value),
    version: 1,
  }
}

export function decodeConvexSsrSeed<ValueType extends Value>(
  seed: ConvexSsrSeed,
): ValueType {
  if (seed.encoding !== 'convex-json' || seed.version !== 1) {
    throw new Error('Unsupported Convex SSR seed encoding.')
  }

  return jsonToConvex(seed.value) as ValueType
}
