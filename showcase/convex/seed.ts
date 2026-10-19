import { internalMutation } from './_generated/server'

const questions: [string, string, string][] = [
  ['Tabs or spaces?', 'Tabs', 'Spaces'],
  ['Light mode or dark mode?', 'Light', 'Dark'],
  ['Composition API or Options API?', 'Composition', 'Options'],
  ['One monorepo or many repos?', 'Monorepo', 'Many repos'],
  ['Ship on Friday?', 'Ship it', 'Wait for Monday'],
  ['Coffee or tea?', 'Coffee', 'Tea'],
]

/** Creates the polls once; running it again changes nothing. */
export const polls = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query('polls').first()) return
    for (const [position, [question, ...options]] of questions.entries()) {
      await ctx.db.insert('polls', { counts: [0, 0], options, position, question })
    }
  },
})
