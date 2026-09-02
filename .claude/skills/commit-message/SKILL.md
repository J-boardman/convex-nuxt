---
name: commit-message
description: Write and review this repository's pre-agreed commit sentence before every commit.
---

# Writing a commit message

Agree the message before implementation. The sentence is the acceptance
criterion, and the diff plus its test are reviewed against it. If implementation
changes what is true, revise the sentence. If it needs an `and` to join two
independent outcomes, split the work.

## Shape

```text
type(scope): a sentence saying what is now true

The reason, discovery path, trade-off, or evidence that did not fit in the
subject. Wrap body prose at 72 columns.
```

The subject is at most 72 characters including its prefix. The scope is
optional. `.githooks/commit-msg` validates this grammar, but a hook cannot decide
whether the sentence is true or well written.

### Types

| Type | Meaning |
| --- | --- |
| `feat` | The software does something it could not do before. |
| `fix` | The software stops doing something wrong. Explain discovery in the body. |
| `perf` | Behaviour is unchanged and measured performance improves. Include measurements. |
| `refactor` | Behaviour is unchanged; frame the sentence around why the shape is right. |
| `docs` | Documentation changes; frame the sentence around what readers can understand. |
| `test` | Proof is added for behaviour that already existed. |
| `build` | Package, TypeScript, lockfile, or bundling behaviour changes. |
| `chore` | No other type fits and the change does not merit a product-facing log entry. |
| `spike` | Exploration, squash-merged after the learning is known. |

### Scopes

`vue` · `nuxt` · `auth` · `pagination` · `adapters` · `playground` · `ci` ·
`build`

A scope names a subject area, not just a directory. Omit it when no single scope
is honest.

## The sentence

Use present tense and describe observable behaviour after the commit. Name the
thing experiencing the behaviour as the grammatical subject.

```text
feat(nuxt): hydrated queries reuse the server payload
fix(auth): signed-out queries stop before opening a subscription
feat(vue): an application owns one Convex client
build: the workspace resolves both public packages
```

Do not narrate the work:

```text
feat(nuxt): add query hydration
fix(auth): fix sign-out race
build: update package exports
```

Begin with lower case after the colon except for a proper name such as `Vue`,
`Nuxt`, or `Convex`. Omit filler such as `now`.

## Bodies

Use a body when the reason or evidence cannot fit in the subject. Leave one blank
line after the subject. Explain what was believed before, how the result was
found, why it matters, and what proves it. A `fix` body records the discovery
path; a `perf` body records measurements. Do not use tables or diagrams in a
commit message.

## Before committing

- Does the sentence describe behaviour rather than the work session?
- Does one focused test prove it?
- Does `and` reveal another independently true outcome?
- Does every staged hunk contribute to this sentence or its proof?
- Do `pnpm typecheck` and `pnpm lint` pass?
- Does the complete staged diff match the agreed sentence?
