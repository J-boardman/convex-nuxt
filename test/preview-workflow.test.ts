import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('package preview workflow', () => {
  it('publishes the reviewed revision only after maintainer approval', async () => {
    const workflow = await readFile('.github/workflows/preview.yml', 'utf8')

    expect(workflow).toContain('pull_request_review:')
    expect(workflow).toContain("if: github.event.review.state == 'approved'")
    expect(workflow).toContain('uses: actions-cool/check-user-permission@v2')
    expect(workflow).toContain('require: write')
    expect(workflow).toContain("if: needs.authorize.outputs.allowed == 'true'")
    expect(workflow).toContain('ref: ${{ github.event.pull_request.head.sha }}')
    expect(workflow).toContain('run: pnpm verify')
    expect(workflow).toContain('run: pnpm preview')
    expect(workflow).toContain('permissions: {}')
  })
})
