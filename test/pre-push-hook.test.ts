import { execFile } from 'node:child_process'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { env } from 'node:process'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const hookPath = resolve('.githooks/pre-push')
const temporaryDirectories: string[] = []

async function createPnpmRecorder(exitCode: number) {
  const directory = await mkdtemp(join(tmpdir(), 'convex-pre-push-'))
  const commandPath = join(directory, 'pnpm')
  const logPath = join(directory, 'calls')
  temporaryDirectories.push(directory)

  await writeFile(commandPath, `#!/bin/sh
echo "$1" >> "$HOOK_LOG"
exit "$PNPM_EXIT_CODE"
`)
  await chmod(commandPath, 0o755)

  return {
    commandEnvironment: {
      ...env,
      HOOK_LOG: logPath,
      PATH: `${directory}${delimiter}${env.PATH}`,
      PNPM_EXIT_CODE: String(exitCode),
    },
    logPath,
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory =>
      rm(directory, { force: true, recursive: true }),
    ),
  )
})

describe('pre-push hook', () => {
  it('runs the complete local test suite', async () => {
    const { commandEnvironment, logPath } = await createPnpmRecorder(0)

    await execFileAsync('sh', [hookPath], { env: commandEnvironment })

    await expect(readFile(logPath, 'utf8')).resolves.toBe('test\n')
  })

  it('rejects a push when the suite fails', async () => {
    const { commandEnvironment, logPath } = await createPnpmRecorder(1)

    await expect(execFileAsync('sh', [hookPath], {
      env: commandEnvironment,
    })).rejects.toBeDefined()

    await expect(readFile(logPath, 'utf8')).resolves.toBe('test\n')
  })
})
