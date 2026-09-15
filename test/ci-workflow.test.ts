import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('continuous integration workflow', () => {
  it('runs the complete gate on every supported Node release', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8')

    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain('permissions:\n  contents: read')
    expect(workflow).toContain('uses: actions/checkout@v7')
    expect(workflow).toContain('uses: pnpm/setup@v2')
    expect(workflow).toContain('require-lockfile: true')
    expect(workflow).toContain('          - 22\n          - 24')
    expect(workflow).toContain('run: pnpm verify')
    expect(workflow).toContain('name: Verify live Convex behavior')
    expect(workflow).toContain('run: pnpm test:live')
  })
})
