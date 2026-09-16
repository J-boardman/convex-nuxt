export type RelayRuntime = 'nuxt' | 'vue'

export interface RelayPerson {
  avatar: string
  handle: string
  id: string
  isOnline: boolean
  name: string
  role: string
}

export interface RelayPost {
  body: string
  createdAt: number
  id: string
  isReacted: boolean
  reactionCount: number
  replyCount: number
  author: RelayPerson
}

export interface RelayMessage {
  author: RelayPerson
  body: string
  createdAt: number
  id: string
  isOwn: boolean
}

export type RelayAsyncState =
  | 'error'
  | 'exhausted'
  | 'loading'
  | 'loadingMore'
  | 'ready'
  | 'success'
