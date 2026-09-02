import { execFile } from 'node:child_process'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { env } from 'node:process'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const hookPath = resolve('.githooks/pre-commit')
const temporaryDirectories: string[] = []

async function createPnpmRecorder() {
  const directory = await mkdtemp(join(tmpdir(), 'convex-pre-commit-'))
  const commandPath = join(directory, 'pnpm')
  const logPath = join(directory, 'calls')
  temporaryDirectories.push(directory)

  await writeFile(commandPath, `#!/bin/sh
echo "$1" >> "$HOOK_LOG"
if [ "$1" = "$FAIL_COMMAND" ]; then
  exit 1
fi
`)
  await chmod(commandPath, 0o755)

  return { directory, logPath }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory =>
      rm(directory, { force: true, recursive: true }),
    ),
  )
})

describe('pre-commit hook', () => {
  it('runs typecheck before lint', async () => {
    const { directory, logPath } = await createPnpmRecorder()

    await execFileAsync('sh', [hookPath], {
      env: {
        ...env,
        HOOK_LOG: logPath,
        PATH: `${directory}${delimiter}${env.PATH}`,
      },
    })

    await expect(readFile(logPath, 'utf8')).resolves.toBe('typecheck\nlint\n')
  })

  it('does not lint a commit that fails typecheck', async () => {
    const { directory, logPath } = await createPnpmRecorder()

    await expect(execFileAsync('sh', [hookPath], {
      env: {
        ...env,
        FAIL_COMMAND: 'typecheck',
        HOOK_LOG: logPath,
        PATH: `${directory}${delimiter}${env.PATH}`,
      },
    })).rejects.toBeDefined()

    await expect(readFile(logPath, 'utf8')).resolves.toBe('typecheck\n')
  })
})
