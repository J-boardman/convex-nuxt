const adjectives = [
  'Brisk', 'Curious', 'Daring', 'Gentle', 'Jolly', 'Lucky',
  'Mellow', 'Nimble', 'Plucky', 'Quiet', 'Sunny', 'Witty',
]
const animals = [
  'Badger', 'Crane', 'Dolphin', 'Fox', 'Heron', 'Lynx',
  'Marmot', 'Otter', 'Panda', 'Quokka', 'Raven', 'Walrus',
]

/** A stable, friendly name for an anonymous voter. */
export function displayName(voter: string): string {
  let hash = 0
  for (const character of voter) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return `${adjectives[hash % adjectives.length]} ${animals[(hash >>> 8) % animals.length]}`
}
