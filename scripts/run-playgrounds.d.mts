export type PlaygroundSurface = 'all' | 'backend' | 'nuxt' | 'vue'

export interface PlaygroundProcess {
  arguments: string[]
  command: string
  environment: Record<string, string | undefined>
  name: Exclude<PlaygroundSurface, 'all'>
}

export function createPlaygroundProcesses(options: {
  backendEnvironment: string
  inheritedEnvironment: Record<string, string | undefined>
  pnpm: string
  surface: PlaygroundSurface
}): PlaygroundProcess[]
