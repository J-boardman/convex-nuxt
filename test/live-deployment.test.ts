import { describe, expect, it } from 'vitest'
import { belongsToConvexDeployment } from './e2e/live-deployment'

describe('live Convex deployment matching', () => {
  it('matches local sockets on the configured port', () => {
    expect(belongsToConvexDeployment(
      'ws://127.0.0.1:3210/api/sync',
      'http://127.0.0.1:3210',
    )).toBe(true)
    expect(belongsToConvexDeployment(
      'ws://127.0.0.1:3211/api/sync',
      'http://127.0.0.1:3210',
    )).toBe(false)
  })

  it('matches secure sockets for hosted deployments', () => {
    expect(belongsToConvexDeployment(
      'wss://example.convex.cloud/api/sync',
      'https://example.convex.cloud',
    )).toBe(true)
    expect(belongsToConvexDeployment(
      'ws://example.convex.cloud/api/sync',
      'https://example.convex.cloud',
    )).toBe(false)
  })
})
