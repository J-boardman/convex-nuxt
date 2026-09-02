# Project instructions

## Commits

Treat a branch as a milestone-sized goal, a commit as one independently true
micro-goal, and its test as the proof. When a task includes committing work,
handle the commit as follows.

### Agree the commit before implementation

Before editing, write the proposed subject in commentary. Use it as the
acceptance criterion for the change; the implementation is complete when the
sentence is true and a test proves it.

If implementation changes what is true, revise the subject before committing.
If the subject needs an `and` to join independent outcomes, split the work into
separate commits. Do not make a broad or mixed commit merely because the files
were edited in the same session.

### Write a statement, not a work report

Every ordinary commit subject has this shape:

```text
type(scope): a sentence saying what is now true
```

The subject must:

- use present tense and describe observable behaviour after the commit;
- name the thing that experiences the behaviour as its subject;
- begin with lower case after the colon, except for proper names such as
  `Word`, `Enter`, or `ProseMirror`;
- fit within 72 characters, including the prefix; and
- omit filler such as "now".

Do not narrate the work. For example, prefer
`feat(nuxt): hydrated queries reuse the server payload` to
`feat(nuxt): add query hydration`. Avoid subjects beginning with verbs such as
`add`, `fix`, `update`, `remove`, `refactor`, `implement`, or `change`.

Allowed types are:

- `feat` — the software can do something new;
- `fix` — the software stops doing something wrong;
- `perf` — behaviour is unchanged and measured performance improves;
- `refactor` — behaviour is unchanged; frame the subject around why the new
  shape is right;
- `docs` — documentation changes; frame the subject around why;
- `test` — proof is added for behaviour that already existed;
- `build` — package, TypeScript, lockfile, or bundling changes;
- `chore` — work that fits no other type and does not merit a product-facing
  log entry; use rarely; and
- `spike` — exploration whose message is written after the learning exists.

Allowed scopes are `vue`, `nuxt`, `auth`, `pagination`, `adapters`,
`playground`, `ci`, and `build`. A scope names a subject area, not merely a
directory. Omit it when no single scope is honest.

Use a body when the subject cannot carry the reason or evidence. Leave one
blank line after the subject, wrap body prose at 72 columns, and explain what
was believed before, how the result was found, why it matters, and what proves
it. Put measurements in `perf` bodies and the discovery path in `fix` bodies.
Do not use tables or diagrams in a commit message.

### Review, verify, and stage deliberately

Before committing:

1. Inspect `git status` and the complete diff.
2. Stage only the files and hunks belonging to this micro-goal. Preserve all
   pre-existing and unrelated changes in the working tree.
3. Confirm the diff makes the proposed subject true and includes its proof.
4. Run `pnpm typecheck && pnpm lint`; the pre-commit hook enforces these checks.
5. Let `.githooks/commit-msg` validate the message. Do not bypass it for
   ordinary work.

Before pushing, run `pnpm test`; the pre-push hook enforces the full suite.
Never claim a commit or push is ready while its relevant gate is failing.

Spike branches are the sole routine exception: exploration may use
`--no-verify`, is squash-merged, and receives one `spike` message after its
learning is known. Do not use the spike exception to bypass a failing ordinary
change.

The canonical worked examples and longer explanations should live in
`.claude/skills/commit-message/SKILL.md`; the executable message grammar should
live in `.githooks/commit-msg`. Until those files exist, this section is the
canonical policy. Once they exist, reconcile prose and enforcement before
committing instead of guessing around the hook.
