import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('release workflow', () => {
  it('separates versioning authority from protected publication', async () => {
    const workflow = await readFile('.github/workflows/release.yml', 'utf8')

    expect(workflow).toContain('permissions: {}')
    expect(workflow).toContain('uses: changesets/action/select-mode@v2')
    expect(workflow).toContain("if: needs.select-mode.outputs.mode == 'version'")
    expect(workflow).toContain('pull-requests: write')
    expect(workflow).toContain('uses: changesets/action/version@v2')
    expect(workflow).toContain('script: pnpm version-packages')
    expect(workflow).toContain("if: needs.select-mode.outputs.mode == 'publish'")
    expect(workflow).toContain('environment: release')
    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain('uses: changesets/action/publish@v2')
    expect(workflow).toContain('script: pnpm release')
    expect(workflow).not.toContain('NPM_TOKEN')
  })
})
