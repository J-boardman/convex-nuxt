import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const hookPath = resolve('.githooks/commit-msg')

async function validate(message: string) {
  const directory = await mkdtemp(join(tmpdir(), 'convex-commit-message-'))
  const messagePath = join(directory, 'message')

  try {
    await writeFile(messagePath, message)
    return await execFileAsync('sh', [hookPath, messagePath])
  }
  finally {
    await rm(directory, { force: true, recursive: true })
  }
}

describe('commit message grammar', () => {
  it.each([
    'build: the workspace resolves both public packages',
    'feat(nuxt): hydrated queries reuse the server payload',
    'fixup! feat(vue): an application owns one Convex client',
  ])('accepts %s', async (subject) => {
    await expect(validate(`${subject}\n`)).resolves.toBeDefined()
  })

  it.each([
    ['rejects unknown types', 'style: package exports stay explicit'],
    ['rejects unknown scopes', 'feat(runtime): queries remain reactive'],
    ['rejects undeclared breaking syntax', 'feat(vue)!: queries change shape'],
    ['rejects work-report openers', 'feat(vue): add reactive queries'],
    [
      'rejects subjects over 72 characters',
      'feat(nuxt): hydrated authenticated paginated queries reuse every server payload',
    ],
    [
      'requires a blank line before a body',
      'fix(auth): signed-out queries stop before subscribing\nThis is the body.',
    ],
  ])('%s', async (_name, message) => {
    await expect(validate(`${message}\n`)).rejects.toMatchObject({
      stderr: expect.stringContaining('commit-msg:'),
    })
  })
})
